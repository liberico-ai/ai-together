import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {afterAll,beforeAll,expect,test} from 'vitest';
import {openHarness,type Harness} from './slice1-db';

const dir=path.join(process.cwd(),'migrations');
let h:Harness;
beforeAll(async()=>{h=await openHarness();});
afterAll(async()=>{await h.close();});

const tables=async()=>{
  const files=(await readdir(dir)).filter(f=>/^\d+.*\.sql$/.test(f)&&Number(f.match(/^\d+/)![0])>=13).sort();
  const out:string[]=[];
  for(const f of files) {
    const sql=await readFile(path.join(dir,f),'utf8');
    for(const m of sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+([\w.]+)/g)) out.push(m[1]);
    // an expand-only migration (018) widens an older table: that table must still carry FORCE RLS and complete policies
    for(const m of sql.matchAll(/TABLE\s+([\w.]+)\s+ADD COLUMN IF NOT EXISTS/g)) if(!out.includes(m[1])) out.push(m[1]);
  }
  return out;
};
const bare=(t:string)=>t.split('.').pop()!;
const schemaOf=(t:string)=>t.includes('.')?t.split('.')[0]:'public';

test('migrations from 013 create tables, and every one has FORCE RLS plus USING and WITH CHECK from the catalog',async()=>{
  const list=await tables();
  expect(list.length).toBeGreaterThanOrEqual(8);
  expect(list).toContain('identity.account_approvals');
  for(const t of list){
    const cls=(await h.operator.query<{s:boolean;f:boolean}>(
      'SELECT c.relrowsecurity s,c.relforcerowsecurity f FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=$2',[schemaOf(t),bare(t)])).rows;
    expect(cls,t).toHaveLength(1);
    expect(cls[0].s,t+' ENABLE').toBe(true);
    expect(cls[0].f,t+' FORCE').toBe(true);
    const pol=(await h.operator.query<{policyname:string;cmd:string;qual:string|null;with_check:string|null}>(
      'SELECT policyname,cmd,qual,with_check FROM pg_policies WHERE schemaname=$1 AND tablename=$2',[schemaOf(t),bare(t)])).rows;
    expect(pol.length,t+' has a policy').toBeGreaterThan(0);
    for(const p of pol){
      if(['INSERT','UPDATE','ALL'].includes(p.cmd)) expect(p.with_check,t+'.'+p.policyname+' WITH CHECK').not.toBeNull();
      if(['SELECT','UPDATE','ALL'].includes(p.cmd)) expect(p.qual,t+'.'+p.policyname+' USING').not.toBeNull();
    }
  }
});

// ---- 027: batches and key rows of the work-list import (self-contained block) ----
test('(20) work_import_batches and work_import_rows: no context, other tenant, other importer, writes with another tenant or batch, and UPDATE/DELETE are all refused',async()=>{
  const {randomUUID}=await import('node:crypto');
  const {scoped}=await import('../src/server/db');
  const {ids,demoProfiles}=await import('../src/server/identities');
  const {seedSlice1,pm,member}=await import('./slice1-fixtures');
  const {clearImports,projectIds,seedImport,tech}=await import('./sheet-import-fixtures');
  await h.reset();await seedSlice1(h);await seedImport(h);await clearImports(h);
  try {
    const batch=randomUUID(),request=randomUUID(),other=randomUUID();
    const insertBatch=(tx:{query:(s:string,p?:unknown[])=>Promise<unknown>},id:string,tenant:string,importer:string)=>tx.query(
      `INSERT INTO work_import_batches(id,tenant_id,importer_id,importer_name,request_key,preview_digest,file_hash,source_id,source_url,sheet,counts,mapping,mapping_hash,results)
       VALUES($1,$2,$3,'Tên thử',$4,$5,$5,'rls-src','https://docs.google.com/x','s','{}','{}',$5,'[]')`,[id,tenant,importer,randomUUID(),'a'.repeat(64)]);
    const insertRow=(tx:{query:(s:string,p?:unknown[])=>Promise<unknown>},o:{tenant:string;project:string;importer:string;batch:string;request:string;stt:string})=>tx.query(
      `INSERT INTO work_import_rows(tenant_id,project_id,importer_id,batch_id,request_id,source_id,sheet,source_row,stt,source_ref,fingerprint,content_hash,bu_label,quality_score)
       VALUES($1,$2,$3,$4,$5,'rls-src','s',2,$6,'rls-src/s!A2:H2',$7,$7,'LBRC',100)`,[o.tenant,o.project,o.importer,o.batch,o.request,o.stt,Buffer.from(o.stt).toString('hex').padEnd(64,'0')]);
    const asTech=<T>(fn:(tx:Parameters<Parameters<typeof scoped>[2]>[0])=>Promise<T>)=>scoped(h.db,tech,async tx=>{await tx.query("SELECT set_config('app.person_id',$1,true)",[tech.id]);return fn(tx);});
    // the importer files a request, a key row and a batch (the request first; the key row and the batch are checked at COMMIT)
    await asTech(async tx=>{
      await tx.query(`INSERT INTO work_requests(id,tenant_id,project_id,requester_id,requester_name,origin,request_key,request_hash,title) VALUES($1,$2,$3,$4,'Tên thử','import',$5,$6,'Việc ghi cho kiểm tra RLS')`,
        [request,ids.tenant,projectIds.lbrc,tech.id,randomUUID(),'b'.repeat(64)]);
      await insertBatch(tx,batch,ids.tenant,tech.id);
      await insertRow(tx,{tenant:ids.tenant,project:projectIds.lbrc,importer:tech.id,batch,request,stt:'r1'});
    });
    // no context: no rows
    await h.operator.transaction(async tx=>{
      await tx.query('SET LOCAL ROLE libetech_runtime');
      expect((await tx.query('SELECT 1 FROM work_import_batches')).rows).toHaveLength(0);
      expect((await tx.query("SELECT 1 FROM work_import_rows")).rows).toHaveLength(0);
    });
    // the importer reads both; another tenant reads none; a manager of other projects reads none; a member of the row's project reads the row and not the batch
    expect(await asTech(async tx=>[(await tx.query('SELECT 1 FROM work_import_batches')).rows.length,(await tx.query("SELECT 1 FROM work_import_rows")).rows.length])).toEqual([1,1]);
    const {otherPrincipal}=await import('../src/server/identities');
    const read=(p:typeof pm)=>scoped(h.db,p,async tx=>{await tx.query("SELECT set_config('app.person_id',$1,true)",[p.id]);
      return [(await tx.query('SELECT 1 FROM work_import_batches')).rows.length,(await tx.query("SELECT 1 FROM work_import_rows")).rows.length];});
    expect(await read(otherPrincipal)).toEqual([0,0]);
    const insider={...member,id:demoProfiles.engineer.id,projectIds:[projectIds.lbrc],grants:[{projectId:projectIds.lbrc,role:'engineer' as const,reportPermissions:[]}]};
    // a member of the row's project who is not a BoM seat reads neither the batch nor the row (the same narrowing as the request the row points at)
    expect(await read(insider)).toEqual([0,0]);
    // a BoM seat of that project reads the row, not the batch
    const {seedMembers,reviewer,approver}=await import('./slice3-fixtures');
    await seedMembers(h);
    for(const [i,u] of [pm,reviewer,approver].entries()){
      await h.operator.query('INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[ids.tenant,u.id,projectIds.lbrc,'viewer']);
      await h.operator.query('INSERT INTO identity.telegram_links(tenant_id,user_id,telegram_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[ids.tenant,u.id,String(9400000000+i)]);
    }
    await h.operator.query('INSERT INTO bom_scopes(tenant_id,project_id,seat_ids,enabled) VALUES($1,$2,$3,true)',[ids.tenant,projectIds.lbrc,[pm.id,reviewer.id,approver.id]]);
    // (the seat check also needs the project in the actor's scope, as the person's grants say)
    expect(await read({...pm,projectIds:[...pm.projectIds,projectIds.lbrc]})).toEqual([0,1]);
    expect(await read({...reviewer,projectIds:[projectIds.lbrc],grants:[{projectId:projectIds.lbrc,role:'technical' as const,reportPermissions:[]}]})).toEqual([0,1]);
    // the free-text note is not readable by the runtime role at all, whoever asks
    await expect(asTech(tx=>tx.query('SELECT source_note FROM work_import_rows'))).rejects.toThrow(/permission denied/i);
    await expect(asTech(tx=>tx.query('SELECT * FROM work_import_rows'))).rejects.toThrow(/permission denied/i);
    // writes: another tenant, another importer's name, a batch of somebody else
    const tryWrite=(fn:Parameters<typeof asTech>[0])=>expect(asTech(fn)).rejects.toThrow(/row-level security|foreign key|violates/i);
    await tryWrite(async tx=>insertBatch(tx,randomUUID(),ids.otherTenant,tech.id));
    await tryWrite(async tx=>insertBatch(tx,randomUUID(),ids.tenant,pm.id));
    await tryWrite(async tx=>insertRow(tx,{tenant:ids.otherTenant,project:ids.otherProject,importer:tech.id,batch,request,stt:'r2'}));
    await tryWrite(async tx=>insertRow(tx,{tenant:ids.tenant,project:projectIds.lbrc,importer:pm.id,batch,request,stt:'r3'}));
    // a key row that points at a batch of another importer: the composite foreign key refuses it at COMMIT
    await h.operator.query(`INSERT INTO work_import_batches(id,tenant_id,importer_id,importer_name,request_key,preview_digest,file_hash,source_id,source_url,sheet,counts,mapping,mapping_hash,results)
      VALUES($1,$2,$3,'Tên thử',$4,$5,$5,'rls-src2','https://docs.google.com/x','s','{}','{}',$5,'[]')`,[other,ids.tenant,pm.id,randomUUID(),'c'.repeat(64)]);
    await tryWrite(async tx=>{
      const r2=randomUUID();
      await tx.query(`INSERT INTO work_requests(id,tenant_id,project_id,requester_id,requester_name,origin,request_key,request_hash,title) VALUES($1,$2,$3,$4,'Tên thử','import',$5,$6,'Việc ghi cho kiểm tra khoá')`,
        [r2,ids.tenant,projectIds.lbrc,tech.id,randomUUID(),'d'.repeat(64)]);
      await insertRow(tx,{tenant:ids.tenant,project:projectIds.lbrc,importer:tech.id,batch:other,request:r2,stt:'r4'});
    });
    // history: UPDATE and DELETE fail with an error, not with «0 rows», for the operational login and for the runtime role
    for(const sql of ['UPDATE work_import_rows SET flags=\'{}\'','DELETE FROM work_import_rows','UPDATE work_import_batches SET sheet=\'x\'','DELETE FROM work_import_batches'])
      await expect(h.operator.query(sql)).rejects.toThrow();
    await expect(asTech(tx=>tx.query('DELETE FROM work_import_rows'))).rejects.toThrow();
    await expect(asTech(tx=>tx.query('UPDATE work_import_batches SET sheet=\'x\''))).rejects.toThrow();
    expect(Number((await h.operator.query<{n:string}>('SELECT count(*) n FROM work_import_rows')).rows[0].n)).toBe(1);
  } finally { await clearImports(h);await h.reset(); }
});
