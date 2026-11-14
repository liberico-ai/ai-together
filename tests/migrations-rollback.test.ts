import {randomUUID} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {expect,test} from 'vitest';
import {openHarness} from './slice1-db';
import {seedSlice1} from './slice1-fixtures';
import {ids} from '../src/server/identities';

const dir=(p:string)=>path.join(process.cwd(),p);
const sqlFiles=async(p:string)=>(await readdir(dir(p))).filter(f=>/^\d+.*\.sql$/.test(f)).sort();
const num=(f:string)=>Number(f.match(/^\d+/)![0]);
const from013=async()=>(await sqlFiles('migrations')).filter(f=>num(f)>=13);

test('every migration from 013 has a rollback file with the same name',async()=>{
  const forward=await from013();
  expect(forward.length).toBeGreaterThan(0);
  const rollback=await sqlFiles('migrations/rollback');
  for(const f of forward) expect(rollback).toContain(f);
  expect(rollback.filter(f=>num(f)<13)).toEqual([]);
});

test('forward → rollback → forward leaves source tables untouched',async()=>{
  const h=await openHarness();
  try {
    await h.reset();
    await seedSlice1(h);
    const hash='a'.repeat(64);
    await h.operator.transaction(async tx=>{
      await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true)",[ids.tenant,ids.sales]);
      for(const row of [2,3]) await tx.query(`INSERT INTO analytics.tech_source_tasks(tenant_id,project_id,source_id,source_row,stt,source_ref,snapshot_hash,fingerprint,title,source_status)
        VALUES($1,$2,'synthetic-src',$3,$4,$5,$6,$7,$8,'Đang làm')`,[ids.tenant,ids.sales,row,String(row),'synthetic#'+row,hash,String(row).repeat(64),'Dòng tổng hợp '+row]);
    });
    const measure=async()=>h.operator.transaction(async tx=>{
      await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true)",[ids.tenant,ids.sales]);
      const s=(await tx.query<{n:number;h:string}>("SELECT count(*)::int n,md5(string_agg(fingerprint,',' ORDER BY source_row)) h FROM analytics.tech_source_tasks")).rows[0];
      const w=(await tx.query<{n:number}>('SELECT count(*)::int n FROM work_items')).rows[0].n;
      return {tasks:s.n,hash:s.h,work:w};
    });
    const before=await measure();
    expect(before.tasks).toBe(2);
    const files=await from013();
    const tablesOf=async(f:string)=>[...(await readFile(dir('migrations/'+f),'utf8')).matchAll(/CREATE TABLE IF NOT EXISTS\s+([\w.]+)/g)].map(m=>m[1]);
    const regclass=async(t:string)=>(await h.operator.query<{r:string|null}>('SELECT to_regclass($1)::text r',[t])).rows[0].r;
    // expand-only migrations (018) add columns to an older table instead of creating one
    const columnsOf=async(f:string)=>[...(await readFile(dir('migrations/'+f),'utf8')).matchAll(/TABLE\s+([\w.]+)\s+ADD COLUMN IF NOT EXISTS\s+(\w+)/g)].map(m=>({table:m[1],column:m[2]}));
    const hasColumn=async(c:{table:string;column:string})=>(await h.operator.query(
      'SELECT 1 FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name=$3',
      [c.table.includes('.')?c.table.split('.')[0]:'public',c.table.split('.').pop(),c.column])).rows.length===1;
    expect(await columnsOf('018_access_change_approval.sql')).toHaveLength(4);
    for(const f of [...files].reverse()){
      await h.exec(await readFile(dir('migrations/rollback/'+f),'utf8'));
      for(const t of await tablesOf(f)) expect(await regclass(t),t).toBeNull();
      for(const c of await columnsOf(f)) expect(await hasColumn(c),c.column).toBe(false);
      expect((await h.operator.query('SELECT 1 FROM schema_migrations WHERE version=$1',[String(num(f)).padStart(3,'0')])).rows).toHaveLength(0);
    }
    for(let pass=0;pass<2;pass++)
      for(const f of files) await h.exec(await readFile(dir('migrations/'+f),'utf8'));
    for(const f of files){
      for(const t of await tablesOf(f)) expect(await regclass(t),t).not.toBeNull();
      for(const c of await columnsOf(f)) expect(await hasColumn(c),c.column).toBe(true);
      expect((await h.operator.query('SELECT 1 FROM schema_migrations WHERE version=$1',[String(num(f)).padStart(3,'0')])).rows).toHaveLength(1);
    }
    expect(await measure()).toEqual(before);
  } finally { await h.reset(); await h.close(); }
});

test('rollback 018 refuses while an access-change ballot exists',async()=>{
  const h=await openHarness();
  const forward=await readFile(dir('migrations/018_access_change_approval.sql'),'utf8');
  const rollback=await readFile(dir('migrations/rollback/018_access_change_approval.sql'),'utf8');
  const q=async<T=Record<string,unknown>>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
  const nullable=async(column:string)=>(await q<{is_nullable:string}>(`SELECT is_nullable FROM information_schema.columns
    WHERE table_schema='identity' AND table_name='account_approvals' AND column_name=$1`,[column]))[0]?.is_nullable??null;
  const shape=async()=>({
    constraints:(await q<{conname:string;def:string}>(`SELECT conname,pg_get_constraintdef(oid) def FROM pg_constraint
      WHERE conrelid='identity.account_approvals'::regclass ORDER BY conname`)),
    indexes:(await q<{indexname:string;indexdef:string}>(`SELECT indexname,indexdef FROM pg_indexes
      WHERE schemaname='identity' AND tablename='account_approvals' ORDER BY indexname`)),
  });
  const applied=async()=>(await q("SELECT 1 FROM schema_migrations WHERE version='018'")).length;
  // the refusal raises inside the file's own BEGIN; PGlite keeps that aborted block open (a pooled client that errors is discarded)
  const refused=async(pattern:RegExp)=>{await expect(h.exec(rollback)).rejects.toThrow(pattern);await h.exec('ROLLBACK');};
  try {
    await h.reset();await seedSlice1(h);
    const admin=randomUUID(),subject=randomUUID();
    for(const [id,username] of [[admin,'rollback-admin'],[subject,'rollback-subject']] as const)
      await q(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,$3,$3,'viewer','fixture-hash')`,[id,ids.tenant,username]);
    const request=(await q<{id:string}>(`INSERT INTO identity.registration_requests(tenant_id,username,name,project_interest)
      VALUES($1,'rollback-reg','Đăng ký mẫu','Team Tech') RETURNING id`,[ids.tenant]))[0].id;
    const grants=JSON.stringify([{projectId:ids.sales,role:'viewer',reportPermissions:[]}]);
    const registration=(await q<{id:string}>(`INSERT INTO identity.account_approvals(tenant_id,registration_id,proposer_id,grants,reason)
      VALUES($1,$2,$3,$4,'Phiếu đăng ký mẫu') RETURNING id`,[ids.tenant,request,admin,grants]))[0].id;
    const accessChange=(await q<{id:string}>(`INSERT INTO identity.account_approvals(tenant_id,kind,subject_user_id,subject_account_version,
      previous_grants,proposer_id,grants,reason) VALUES($1,'access_change',$2,1,$3,$4,$3,'Phiếu đổi quyền mẫu') RETURNING id`,
      [ids.tenant,subject,grants,admin]))[0].id;
    const full=await shape();
    await refused(/access.change/i);
    expect(await nullable('kind')).toBe('NO');
    expect(await nullable('registration_id')).toBe('YES');
    expect(await applied()).toBe(1);
    expect(await shape()).toEqual(full);
    await q('DELETE FROM identity.account_approvals WHERE id=$1',[accessChange]);
    // a later version applied also blocks it (order 018 → 017 → 016 only)
    await q("INSERT INTO schema_migrations(version) VALUES('019')");
    try { await refused(/later|019/i); }
    finally { await q("DELETE FROM schema_migrations WHERE version='019'"); }
    expect(await nullable('kind')).toBe('NO');
    // with only registration ballots left it runs, drops what 018 added and keeps the old row as it was
    const kept=(await q('SELECT id,registration_id,state,grants,updated_at FROM identity.account_approvals WHERE id=$1',[registration]))[0];
    await h.exec(rollback);
    for(const column of ['kind','subject_user_id','subject_account_version','previous_grants']) expect(await nullable(column),column).toBeNull();
    expect(await nullable('registration_id')).toBe('NO');
    expect(await applied()).toBe(0);
    const bare=await shape();
    expect(JSON.stringify(bare)).not.toMatch(/subject_user_id|access_change|kind/);
    expect((await q('SELECT id,registration_id,state,grants,updated_at FROM identity.account_approvals WHERE id=$1',[registration]))[0]).toEqual(kept);
    await h.exec(rollback);
    // expand again, twice: the old row reads as a registration ballot and is otherwise unchanged; no constraint or index is doubled
    await h.exec(forward);await h.exec(forward);
    expect(await applied()).toBe(1);
    expect(await shape()).toEqual(full);
    expect((await q('SELECT id,registration_id,state,grants,updated_at,kind,subject_user_id,subject_account_version,previous_grants FROM identity.account_approvals WHERE id=$1',[registration]))[0])
      .toEqual({...kept,kind:'registration',subject_user_id:null,subject_account_version:null,previous_grants:null});
  } finally { await h.exec(forward); await h.reset(); await h.close(); }
});
