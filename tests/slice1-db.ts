import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {pooledDatabase,type Database} from '../src/server/db';

export type Harness={operator:Database;db:Database;native:boolean;exec(sql:string):Promise<void>;reset():Promise<void>;close():Promise<void>};
export const native:boolean=Boolean(process.env.SLICE1_TEST_DATABASE_URL);

export function assertIsolated(testUrl:string,webUrl?:string):void{
  const t=new URL(testUrl);
  if(t.hostname!=='127.0.0.1'||t.port!=='55471'||!/^slice1_verify(?:_[0-9]+)?$/.test(t.pathname.slice(1)))
    throw new Error('Use an isolated loopback slice-1 database.');
  if(webUrl){
    const w=new URL(webUrl);
    if(w.host!==t.host||w.pathname!==t.pathname) throw new Error('Web must use the same isolated test database.');
  }
}

const migrationFiles=async()=>(await readdir(path.join(process.cwd(),'migrations'))).filter(f=>/^\d+.*\.sql$/.test(f)).sort();
const readMigration=(file:string)=>readFile(path.join(process.cwd(),'migrations',file),'utf8');

export async function openHarness():Promise<Harness>{
  process.env.LIBETECH_DEMO='1';
  const testUrl=process.env.SLICE1_TEST_DATABASE_URL,webUrl=process.env.SLICE1_WEB_DATABASE_URL;
  if(testUrl){
    assertIsolated(testUrl,webUrl);
    const operator=pooledDatabase(testUrl);
    const db=webUrl?pooledDatabase(webUrl,true):operator;
    const existing=(await operator.query<{t:string|null}>("SELECT to_regclass('public.schema_migrations')::text AS t")).rows[0].t;
    const applied=existing
      ?new Set((await operator.query<{version:string}>('SELECT version FROM public.schema_migrations')).rows.map(r=>r.version))
      :new Set<string>();
    for(const file of await migrationFiles()){
      const version=file.match(/^\d+/)?.[0];
      if(version&&applied.has(version)) continue;
      await operator.query(await readMigration(file));
    }
    return {operator,db,native:true,
      exec:async sql=>{await operator.query(sql);},
      reset:async()=>{
        await operator.query('TRUNCATE projects, identity.users, identity.memberships, identity.telegram_links, analytics.reconciliations, analytics.tech_source_imports CASCADE');
        if((await operator.query<{t:string|null}>("SELECT to_regclass('public.document_templates')::text AS t")).rows[0].t)
          await operator.query('TRUNCATE document_templates');
      },
      close:async()=>{if(db!==operator) await db.close();await operator.close();}};
  }
  const pg=await PGlite.create();
  for(const file of await migrationFiles()) await pg.exec(await readMigration(file));
  const operator:Database={
    query:(sql,params)=>pg.query(sql,params),
    transaction:fn=>pg.transaction(tx=>fn({query:(sql,params)=>tx.query(sql,params)})),
    close:()=>pg.close(),
  };
  return {operator,db:operator,native:false,exec:async sql=>{await pg.exec(sql);},reset:async()=>{},close:()=>operator.close()};
}

export async function waitForBlocked(h:Harness,count:number,timeoutMs=5000):Promise<void>{
  const deadline=Date.now()+timeoutMs;
  for(;;){
    const n=(await h.operator.query<{n:number}>("SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'")).rows[0].n;
    if(n>=count) return;
    if(Date.now()>deadline) throw new Error(`Timed out waiting for ${count} blocked session(s); saw ${n}.`);
    await new Promise(r=>setTimeout(r,50));
  }
}
