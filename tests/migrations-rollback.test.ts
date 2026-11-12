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
    for(const f of [...files].reverse()){
      await h.exec(await readFile(dir('migrations/rollback/'+f),'utf8'));
      for(const t of await tablesOf(f)) expect(await regclass(t),t).toBeNull();
      expect((await h.operator.query('SELECT 1 FROM schema_migrations WHERE version=$1',[String(num(f)).padStart(3,'0')])).rows).toHaveLength(0);
    }
    for(let pass=0;pass<2;pass++)
      for(const f of files) await h.exec(await readFile(dir('migrations/'+f),'utf8'));
    for(const f of files){
      for(const t of await tablesOf(f)) expect(await regclass(t),t).not.toBeNull();
      expect((await h.operator.query('SELECT 1 FROM schema_migrations WHERE version=$1',[String(num(f)).padStart(3,'0')])).rows).toHaveLength(1);
    }
    expect(await measure()).toEqual(before);
  } finally { await h.reset(); await h.close(); }
});
