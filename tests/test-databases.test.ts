import {setTimeout as sleep} from 'node:timers/promises';
import {Client} from 'pg';
import {describe,expect,it} from 'vitest';
import {native} from './slice1-db';
import {testDatabases} from './test-databases';

// The removal of the databases that a test file creates beside the harness database (tests/test-databases.ts). Real PostgreSQL only: PGlite has no CREATE DATABASE to wait for.
// DROP DATABASE waits for a checkpoint, and in the shared test container that wait has passed 10 s many times. A checkpoint cannot be slowed on demand, so the first case holds the drop
// back with a lock instead: for the client it is the same thing, a DROP DATABASE that has not answered after 10 s.
const serverUrl=process.env.SLICE1_TEST_DATABASE_URL??'';
async function connected():Promise<Client>{const client=new Client({connectionString:serverUrl});await client.connect();return client;}
async function onServer<T>(fn:(client:Client)=>Promise<T>):Promise<T>{const client=await connected();try{return await fn(client);}finally{await client.end();}}
const exists=(name:string)=>onServer(async c=>(await c.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rows.length===1);
/** The safety net of a case: whatever the code under test left behind is removed here, so a failing case leaves no database in the shared container. */
const remove=(names:string[])=>onServer(async c=>{
  for(const name of names){
    if((await c.query('SELECT 1 FROM pg_database WHERE datname=$1 AND datistemplate',[name])).rows.length) await c.query(`ALTER DATABASE "${name}" IS_TEMPLATE false`);
    await c.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  }
});

describe.skipIf(!native)('removal of the databases a test creates (native PostgreSQL only)',()=>{
  it('removes a database whose DROP DATABASE takes longer than 10 s',async()=>{
    const databases=testDatabases(serverUrl);
    const name=await databases.create();
    const holder=await connected();
    try{
      // COMMENT ON DATABASE keeps a lock on the database object until the transaction ends; DROP DATABASE waits for it
      await holder.query('BEGIN');
      await holder.query(`COMMENT ON DATABASE "${name}" IS 'held by the test'`);
      const released=sleep(12000).then(()=>holder.query('ROLLBACK'));
      const began=Date.now();
      const outcome=await databases.dropAll().then(()=>'dropAll resolved',(e:Error)=>e.message);
      const waited=Date.now()-began;
      await released;
      expect.soft(outcome).toBe('dropAll resolved');
      expect.soft(await exists(name),'the database is gone').toBe(false);
      expect.soft(waited,'the drop was really held past 10 s').toBeGreaterThanOrEqual(11000);
    }finally{
      await holder.end();
      await remove([name]);
    }
  },180000);

  it('goes on to the next database when the connection of a drop is ended, and names the one that is left',async()=>{
    const databases=testDatabases(serverUrl);
    const cut=await databases.create(),other=await databases.create();
    const holder=await connected();
    try{
      // the first drop is held at its lock, so that its backend can be found and ended while it waits
      await holder.query('BEGIN');
      await holder.query(`COMMENT ON DATABASE "${cut}" IS 'held by the test'`);
      const dropping=databases.dropAll().then(()=>'dropAll resolved',(e:Error)=>e.message);
      let ended=0;
      for(const until=Date.now()+8000;!ended&&Date.now()<until;await sleep(100))
        ended=(await onServer(c=>c.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE wait_event_type='Lock' AND query=$1`,[`DROP DATABASE IF EXISTS "${cut}" WITH (FORCE)`]))).rows.length;
      expect(ended,'the held drop was found and its backend ended').toBe(1);
      const outcome=await dropping;
      await holder.query('ROLLBACK');
      expect.soft(outcome).toContain(`${cut}: `);
      expect.soft(outcome,'only the database that is left is named').not.toContain(other);
      expect.soft(await exists(other),'the other database is gone').toBe(false);
      expect.soft(await exists(cut),'the database of the ended drop is still there').toBe(true);
    }finally{
      await holder.end();
      await remove([cut,other]);
    }
  },180000);

  it('names a database it could not drop, with the reason, and still drops the others',async()=>{
    const databases=testDatabases(serverUrl);
    const stuck=await databases.create(),other=await databases.create();
    try{
      // a template database cannot be dropped: a refusal of the server that does not depend on time. It is the first of the two, so the second is reached only if the first refusal does not end the loop.
      await onServer(c=>c.query(`ALTER DATABASE "${stuck}" IS_TEMPLATE true`));
      const outcome=await databases.dropAll().then(()=>'dropAll resolved',(e:Error)=>e.message);
      expect.soft(outcome).toContain(`${stuck}: cannot drop a template database`);
      expect.soft(outcome,'only the database that is left is named').not.toContain(other);
      expect.soft(await exists(other),'the other database is gone').toBe(false);
      expect.soft(await exists(stuck),'the refused database is still there').toBe(true);
    }finally{
      await remove([stuck,other]);
    }
  },180000);
});
