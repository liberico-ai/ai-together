import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {native,openHarness,waitForBlocked,type Harness} from './slice1-db';
import {seedSlice1} from './slice1-fixtures';
import {seedMembers} from './slice3-fixtures';
import {clearImports,envelope,newKey,projectIds,row8,seedImport,tech} from './sheet-import-fixtures';
import {SheetImportService} from '../src/server/sheet-import';
import {ids} from '../src/server/identities';
import type {Principal} from '../src/server/types';

const SECOND_ID='14000000-0000-4000-8000-000000000078';
const second:Principal={...tech,id:SECOND_ID,name:'Thành viên Tech hai'};
const mapping=[{buLabel:'LBRC',projectId:projectIds.lbrc},{buLabel:'XECA',projectId:projectIds.xeca}];
const lines=Array.from({length:12},(_,i)=>row8({stt:String(i+1),bu:i%2?'XECA':'LBRC',title:`Việc chạy song song số ${i+1} TEST${3000+i}`}));

describe.skipIf(!native)('(21) two imports of one file at the same time (native PostgreSQL)',()=>{
  let h:Harness;
  beforeEach(async()=>{
    h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);await seedImport(h);await clearImports(h);
    await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,'imp-tech2',$3,'viewer','fixture-only')`,[SECOND_ID,ids.tenant,second.name]);
    await h.operator.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'viewer')`,[ids.tenant,SECOND_ID,ids.transport]);
    await h.operator.query('INSERT INTO identity.tech_roster(tenant_id,user_id) VALUES($1,$2)',[ids.tenant,SECOND_ID]);
  });
  afterEach(async()=>{await h.reset();await h.close();});
  const svc=()=>new SheetImportService(h.db);
  const n=async(t:string)=>Number((await h.operator.query<{n:string}>(`SELECT count(*) n FROM ${t}`)).rows[0].n);

  test('two importers, two keys: every row has exactly one request, whoever wins; the loser is told «duplicate», «cần đối soát» or that its preview is stale',async()=>{
    const env=envelope(lines);
    const [a,b]=await Promise.all([svc().preview(tech,env),svc().preview(second,env)]);
    const run=(who:Principal,digest:string)=>svc().commit(who,{...env,previewDigest:digest,requestKey:newKey(),projects:mapping,owners:[]});
    const res=await Promise.allSettled([run(tech,a.previewDigest),run(second,b.previewDigest)]);
    for(const r of res) if(r.status==='rejected') expect(r.reason).toMatchObject({code:'PREVIEW_STALE',status:409});
    expect(res.filter(r=>r.status==='fulfilled').length).toBeGreaterThanOrEqual(1);
    const imported=res.flatMap(r=>r.status==='fulfilled'?r.value.results.filter(x=>x.result==='imported').map(x=>x.row):[]);
    // no row was imported twice, and the rows of the file that were imported are exactly the requests that exist
    expect(new Set(imported).size).toBe(imported.length);
    expect(await n('work_requests')).toBe(imported.length);
    expect(await n('work_import_rows')).toBe(imported.length);
    expect(await n('work_request_events')).toBe(imported.length);
    const dup=await h.operator.query<{c:string}>('SELECT count(*) c FROM work_import_rows GROUP BY source_id,sheet,stt HAVING count(*)>1');
    expect(dup.rows).toHaveLength(0);
    // whatever the race, a later import of the same file completes the set and writes the missing rows only
    const again=await svc().preview(tech,env);
    const done=await svc().commit(tech,{...env,previewDigest:again.previewDigest,requestKey:newKey(),projects:mapping,owners:[]});
    expect(done.results.filter(x=>x.result==='imported').length+imported.length).toBe(lines.length);
    expect(await n('work_requests')).toBe(lines.length);
  });

  test('one importer, one key, two calls at once: one batch, one request per row, both calls get that receipt',async()=>{
    const env=envelope(lines);
    const pre=await svc().preview(tech,env);
    const key=newKey();
    const call=()=>svc().commit(tech,{...env,previewDigest:pre.previewDigest,requestKey:key,projects:mapping,owners:[]});
    const res=await Promise.all([call(),call()]);
    expect(res[0].id).toBe(res[1].id);
    expect(res.filter(r=>r.replayed)).toHaveLength(1);
    expect(await n('work_import_batches')).toBe(1);
    expect(await n('work_requests')).toBe(lines.length);
    expect(await n('work_import_rows')).toBe(lines.length);
  });

  test('(3) an IBS_HI mapping that is still open makes the import wait for the project row, and the import is then refused: no note of an IBS HI project is stored',async()=>{
    const env=envelope([row8({stt:'1',title:'Việc đang chờ ánh xạ miền TEST3901',note:'ghi-chú-chờ-ánh-xạ'})]);
    const pre=await svc().preview(tech,env);
    let release!:()=>void;const gate=new Promise<void>(r=>{release=r;});
    // the mapping transaction takes the project lock (migration 022) and stays open
    const open=h.operator.transaction(async tx=>{
      await tx.query("INSERT INTO project_domain_mappings(tenant_id,project_id,domain_code,confirmed_by,source,mapping_version) VALUES($1,$2,'IBS_HI',$3,'synthetic-source',1)",[ids.tenant,projectIds.lbrc,tech.id]);
      await gate;
    });
    await new Promise(r=>setTimeout(r,300));
    const importing=svc().commit(tech,{...env,previewDigest:pre.previewDigest,requestKey:newKey(),projects:mapping,owners:[]}).then(()=>null,e=>e as Error);
    await waitForBlocked(h,1);
    expect(await n('work_import_rows')).toBe(0);
    release();await open;
    const refused=await importing;
    expect(refused).toBeInstanceOf(Error);expect(String(refused?.message)).toMatch(/IBS HI import row holds no note/);
    expect(await n('work_import_rows')).toBe(0);expect(await n('work_requests')).toBe(0);
  });

  test('the guard refuses a row written outside READ COMMITTED, with or without a note',async()=>{
    await expect(h.operator.transaction(async tx=>{
      await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      await tx.query("SELECT count(*) FROM projects");
      const request=newKey(),batch=newKey();
      await tx.query(`INSERT INTO work_requests(id,tenant_id,project_id,requester_id,requester_name,origin,request_key,request_hash,title) VALUES($1,$2,$3,$4,'Tên thử','import',$5,$6,'Việc ghi trực tiếp thử')`,[request,ids.tenant,projectIds.lbrc,tech.id,newKey(),'c'.repeat(64)]);
      await tx.query(`INSERT INTO work_import_batches(id,tenant_id,importer_id,importer_name,request_key,preview_digest,file_hash,source_id,source_url,sheet,counts,mapping,mapping_hash,results)
        VALUES($1,$2,$3,'Tên thử',$4,$5,$5,'iso','https://docs.google.com/x','s','{}','{}',$5,'[]')`,[batch,ids.tenant,tech.id,newKey(),'d'.repeat(64)]);
      await tx.query(`INSERT INTO work_import_rows(tenant_id,project_id,importer_id,batch_id,request_id,source_id,sheet,source_row,stt,source_ref,fingerprint,content_hash,bu_label,quality_score)
        VALUES($1,$2,$3,$4,$5,'iso','s',2,'i1','iso/s!A2:H2',$6,$6,'LBRC',100)`,[ids.tenant,projectIds.lbrc,tech.id,batch,request,'1'.repeat(64)]);
    })).rejects.toThrow(/READ COMMITTED/);
  });
});
