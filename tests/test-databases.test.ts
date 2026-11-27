import {setTimeout as sleep} from 'node:timers/promises';
import {Client} from 'pg';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {native} from './slice1-db';
import {testDatabases} from './test-databases';

// The removal of the databases that a test file creates beside the harness database (tests/test-databases.ts). Real PostgreSQL only: PGlite has no CREATE DATABASE to wait for.
// DROP DATABASE waits for a checkpoint, and in the shared test container that wait has passed 10 s many times. A checkpoint cannot be slowed on demand, so the first case holds the drop
// back with a lock instead: for the client it is the same thing, a DROP DATABASE that has not answered after 10 s.
const serverUrl=process.env.SLICE1_TEST_DATABASE_URL??'';
async function connected():Promise<Client>{const client=new Client({connectionString:serverUrl});await client.connect();return client;}
async function onServer<T>(fn:(client:Client)=>Promise<T>):Promise<T>{const client=await connected();try{return await fn(client);}finally{await client.end();}}
const exists=(name:string)=>onServer(async c=>(await c.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rows.length===1);
const oidOf=(name:string)=>onServer(async c=>(await c.query<{oid:string}>('SELECT oid::text AS oid FROM pg_database WHERE datname=$1',[name])).rows[0]?.oid??null);

// The safety net of the cases, apart from the code under test: what a case made is removed after it, however far the case got, so a failing case leaves no database in the shared container.
// The container is shared: a database is dropped only while its name still stands for the oid that the case saw. Once it is gone, a database of that name made later by anyone is not touched.
// (oid null: the lookup right after the creation failed, and the case with it; the database is the one just made.)
const made:{name:string;oid:string|null}[]=[],holders:Client[]=[];
async function track(name:string):Promise<string>{const entry={name,oid:null as string|null};made.push(entry);entry.oid=await oidOf(name);return name;}
const removeMade=({name,oid}:{name:string;oid:string|null})=>onServer(async c=>{
  const row=(await c.query<{datistemplate:boolean}>('SELECT datistemplate FROM pg_database WHERE datname=$1 AND ($2::oid IS NULL OR oid=$2::oid)',[name,oid])).rows[0];
  if(!row) return;
  if(row.datistemplate) await c.query(`ALTER DATABASE "${name}" IS_TEMPLATE false`);
  await c.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
});
/** A session that holds the lock of a database object until its transaction ends: COMMENT ON DATABASE takes it, and DROP DATABASE waits for it. */
async function hold(name:string):Promise<Client>{
  const holder=await connected();holders.push(holder);
  await holder.query('BEGIN');
  await holder.query(`COMMENT ON DATABASE "${name}" IS 'held by the test'`);
  return holder;
}
afterEach(async()=>{
  vi.restoreAllMocks();
  // the locks first: a drop of the net would wait behind them
  for(const holder of holders.splice(0)) await holder.end();
  const failed=(await Promise.allSettled(made.splice(0).map(removeMade))).flatMap(r=>r.status==='rejected'?[r.reason]:[]);
  if(failed.length) throw new AggregateError(failed,'the safety net could not remove a database of this case');
},180000);

describe.skipIf(!native)('removal of the databases a test creates (native PostgreSQL only)',()=>{
  it('removes a database whose DROP DATABASE takes longer than 10 s',async()=>{
    const databases=testDatabases(serverUrl);
    const name=await track(await databases.create());
    const holder=await hold(name);
    const released=sleep(12000).then(()=>holder.query('ROLLBACK'));
    const began=Date.now();
    const outcome=await databases.dropAll().then(()=>'dropAll resolved',(e:Error)=>e.message);
    const waited=Date.now()-began;
    await released;
    expect.soft(outcome).toBe('dropAll resolved');
    expect.soft(await exists(name),'the database is gone').toBe(false);
    expect.soft(waited,'the drop was really held past 10 s').toBeGreaterThanOrEqual(11000);
  },180000);

  it('goes on to the next database when the connection of a drop is ended, and names the one that is left',async()=>{
    const databases=testDatabases(serverUrl);
    const cut=await track(await databases.create()),other=await track(await databases.create());
    // the first drop is held at its lock, so that its backend can be found and ended while it waits
    const holder=await hold(cut);
    let settled=false;
    const dropping=databases.dropAll().then(()=>'dropAll resolved',(e:Error)=>e.message).finally(()=>{settled=true;});
    // a wide window for a slow server; it closes at once when the held drop is found, or when dropAll is over without having waited
    let ended=0;
    for(const until=Date.now()+60000;!ended&&!settled&&Date.now()<until;await sleep(100))
      ended=(await onServer(c=>c.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE wait_event_type='Lock' AND query=$1`,[`DROP DATABASE IF EXISTS "${cut}" WITH (FORCE)`]))).rows.length;
    expect(ended,'the held drop was found and its backend ended').toBe(1);
    const outcome=await dropping;
    await holder.query('ROLLBACK');
    expect.soft(outcome).toContain(`${cut}: `);
    expect.soft(outcome,'only the database that is left is named').not.toContain(other);
    expect.soft(await exists(other),'the other database is gone').toBe(false);
    expect.soft(await exists(cut),'the database of the ended drop is still there').toBe(true);
  },180000);

  it('names a database it could not drop, with the reason, and still drops the others',async()=>{
    const databases=testDatabases(serverUrl);
    const stuck=await track(await databases.create()),other=await track(await databases.create());
    // a template database cannot be dropped: a refusal of the server that does not depend on time. It is the first of the two, so the second is reached only if the first refusal does not end the loop.
    await onServer(c=>c.query(`ALTER DATABASE "${stuck}" IS_TEMPLATE true`));
    const outcome=await databases.dropAll().then(()=>'dropAll resolved',(e:Error)=>e.message);
    expect.soft(outcome).toContain(`${stuck}: cannot drop a template database`);
    expect.soft(outcome,'only the database that is left is named').not.toContain(other);
    expect.soft(await exists(other),'the other database is gone').toBe(false);
    expect.soft(await exists(stuck),'the refused database is still there').toBe(true);
  },180000);

  it('names the database of a CREATE DATABASE that failed, and leaves alone a database that it did not create',async()=>{
    const databases=testDatabases(serverUrl);
    // a database under the very name that create() is about to ask for: it stands for the database of another session
    const at=Date.now(),theirs=`slice1_verify_${at}01`;
    await onServer(c=>c.query(`CREATE DATABASE "${theirs}"`));
    await track(theirs);
    vi.spyOn(Date,'now').mockReturnValueOnce(at);
    const outcome=await databases.create().then(()=>'create resolved',(e:Error)=>e.message);
    expect.soft(outcome).toContain(`CREATE DATABASE "${theirs}" failed: database "${theirs}" already exists`);
    await databases.dropAll();
    expect.soft(await exists(theirs),'a database that create() did not make is still there').toBe(true);
  },180000);
});
