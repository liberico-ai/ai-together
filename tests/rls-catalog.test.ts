import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {afterAll,beforeAll,expect,test} from 'vitest';
import {openHarness,type Harness} from './slice1-db';

const dir=path.join(process.cwd(),'migrations');
let h:Harness;
beforeAll(async()=>{h=await openHarness();});
afterAll(async()=>{await h.close();});

const tables=async()=>{
  const files=(await readdir(dir)).filter(f=>/^\d+.*\.sql$/.test(f)&&Number(f.match(/^\d+/)![0])>=13&&Number(f.match(/^\d+/)![0])<=15).sort();
  const out:string[]=[];
  for(const f of files) for(const m of (await readFile(path.join(dir,f),'utf8')).matchAll(/CREATE TABLE IF NOT EXISTS\s+([\w.]+)/g)) out.push(m[1]);
  return out;
};
const bare=(t:string)=>t.split('.').pop()!;
const schemaOf=(t:string)=>t.includes('.')?t.split('.')[0]:'public';

test('migrations 013-015 create tables, and every one has FORCE RLS plus USING and WITH CHECK from the catalog',async()=>{
  const list=await tables();
  expect(list.length).toBeGreaterThanOrEqual(8);
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
