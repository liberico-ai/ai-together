// Every SECURITY DEFINER function of the application schemas pins its search path with the temporary schema named last (migration 032).
import {afterAll,beforeAll,describe,expect,test} from 'vitest';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {openHarness,type Harness} from './slice1-db';
import {putBack,takeOffAbove} from './migration-stack';

let h:Harness;
beforeAll(async()=>{h=await openHarness();});
afterAll(async()=>{await h.close();});

type Fn={fn:string;config:string};
const definers=async()=>(await h.operator.query<Fn>(`SELECT n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' AS fn,
   coalesce(array_to_string(p.proconfig,';'),'') AS config
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE p.prosecdef AND n.nspname IN ('public','identity','analytics','intelligence')
   AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
 ORDER BY 1`)).rows;
/** Pinned: the temporary schema is named once, last, and every name is plain, unquoted and lower case (a quoted name keeps its case and may be an ordinary schema). */
const pinned=(config:string)=>config.split(';').some(c=>/^search_path=([a-z_][a-z0-9_]* *, *)*pg_temp$/.test(c)&&!/(=|, *)pg_temp[a-z0-9_]* *,/.test(c));
const lacking=async()=>(await definers()).filter(r=>!pinned(r.config)).map(r=>r.fn);
const configOf=async(name:string)=>(await definers()).find(r=>r.fn.startsWith(name+'('))?.config.replace(/ /g,'');
const sql=(p:string)=>readFile(path.join(process.cwd(),'migrations',p),'utf8').catch(()=>'SELECT 1');
/** Runs a migration file; a refused one leaves its transaction open, so it is rolled back before the error goes on. */
const exec=async(text:string)=>{try{await h.exec(text);}catch(error){await h.exec('ROLLBACK').catch(()=>{});throw error;}};

test('no privileged function leaves the temporary schema ahead of the ones it names',async()=>{
 expect((await definers()).length).toBeGreaterThanOrEqual(35);
 expect(await lacking()).toEqual([]);
});

test('a function that also switches row security off keeps that setting',async()=>{
 const config=await configOf('public.tech_source_project_is_ibs');
 expect(config).toContain('search_path=pg_catalog,pg_temp');
 expect(config).toContain('row_security=off');
});

describe('migration 032',()=>{
 test('applies twice; its rollback restores the settings it changed, and applying again pins them',async()=>{
  const above=await takeOffAbove(h,31);
  try {
   const before=await lacking();
   expect(before).toHaveLength(17);
   await exec(await sql('032_definer_search_path.sql'));await exec(await sql('032_definer_search_path.sql'));
   expect(await lacking()).toEqual([]);
   await exec(await sql('rollback/032_definer_search_path.sql'));await exec(await sql('rollback/032_definer_search_path.sql'));
   expect(await lacking()).toEqual(before);
  } finally {await putBack(h,above);}
  expect(await lacking()).toEqual([]);
 });

 const probe=(path:string)=>h.operator.query(`CREATE FUNCTION public.zz_unpinned_probe() RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path=${path} AS 'SELECT 1'`);
 // a path where the temporary schema also appears earlier is searched there first, whatever comes last
 for(const [label,path] of [['only the catalog','pg_catalog'],['the temporary schema earlier and again last','pg_catalog,pg_temp,public,pg_temp'],
   ['a quoted temporary schema first','"pg_temp",pg_catalog,pg_temp'],['a temporary schema before a named one','pg_temp,pg_catalog'],
   // quoted names keep their case: "PG_TEMP" is an ordinary schema, so the temporary one is not named at all and is searched first
   ['a quoted upper-case name in the last place','pg_catalog,"PG_TEMP"'],['one string holding the whole list','\'pg_catalog,pg_temp\'']] as const)
  test('it stops, changing nothing, when another privileged function is left unpinned: '+label,async()=>{
   const above=await takeOffAbove(h,31);
   await probe(path);
   try {
    await expect(exec(await sql('032_definer_search_path.sql'))).rejects.toThrow(/zz_unpinned_probe/);
    expect((await lacking()).length).toBe(18);
    expect((await h.operator.query("SELECT 1 FROM schema_migrations WHERE version='032'")).rows).toHaveLength(0);
   } finally {await h.operator.query('DROP FUNCTION public.zz_unpinned_probe()');await putBack(h,above);}
  });

 test('a longer path that names the temporary schema once, last, passes',async()=>{
  const above=await takeOffAbove(h,31);
  await probe('pg_catalog,public,pg_temp');
  try {
   await exec(await sql('032_definer_search_path.sql'));
   expect(await lacking()).toEqual([]);
   await exec(await sql('rollback/032_definer_search_path.sql'));
  } finally {await h.operator.query('DROP FUNCTION public.zz_unpinned_probe()');await putBack(h,above);}
 });
});
