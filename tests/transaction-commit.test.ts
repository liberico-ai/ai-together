import {afterAll,beforeAll,beforeEach,describe,expect,test,vi} from 'vitest';
import {Client} from 'pg';
import {pooledDatabase,scoped,type Database} from '../src/server/db';
import {assertIsolated,native,openHarness,type Harness} from './slice1-db';

// A statement of a transaction fails, the callback catches the error and returns normally. The transaction is already aborted, and COMMIT of an aborted transaction is answered with the
// command ROLLBACK and no error: transaction() used to resolve, the caller took the write for done, and nothing had been written. It has to reject, with one fixed sentence that carries
// nothing the database said, and the connection has to go back to the pool clean. The same cases run on PGlite and on native PostgreSQL.
const FIXED='The transaction was rolled back and nothing was written.';
const url=()=>{const u=process.env.SLICE1_TEST_DATABASE_URL as string;assertIsolated(u);return u;};
const TABLE='txc_probe.t';
const noteIds=async(db:Database)=>(await db.query<{id:number}>(`SELECT id FROM ${TABLE} ORDER BY id`)).rows.map(r=>r.id);
// the failing statement: the key exists already (23505); its database text names the table and the constraint
const duplicate=(tx:{query:(sql:string,p?:unknown[])=>Promise<unknown>})=>tx.query(`INSERT INTO ${TABLE}(id,note) VALUES (1,'duplicate')`);
const caught=async(p:Promise<unknown>)=>p.then(()=>null,(e:unknown)=>e as {message?:string;name?:string;code?:string;cause?:unknown}|null);

let h:Harness;
let db:Database;
beforeAll(async()=>{
  h=await openHarness();
  db=h.operator;
  await h.exec(`DROP SCHEMA IF EXISTS txc_probe CASCADE; CREATE SCHEMA txc_probe; CREATE TABLE ${TABLE}(id int PRIMARY KEY, note text NOT NULL)`);
});
afterAll(async()=>{
  try {await h.exec('DROP SCHEMA IF EXISTS txc_probe CASCADE');} finally {await h.close();}
});
beforeEach(async()=>{await h.exec(`TRUNCATE ${TABLE}; INSERT INTO ${TABLE}(id,note) VALUES (1,'first')`);});

describe(`COMMIT of an aborted transaction (${native?'native PostgreSQL':'PGlite'})`,()=>{
  test('a failed statement that the callback catches before it returns: transaction() rejects with the fixed sentence, and the write made before the failure is not there',async()=>{
    const error=await caught(db.transaction(async tx=>{
      await tx.query(`INSERT INTO ${TABLE}(id,note) VALUES (2,'before the failure')`);
      try {await duplicate(tx);} catch {/* the callback goes on as if nothing had happened */}
      return 'returned normally';
    }));
    expect(error,'the transaction resolved although nothing was written').not.toBeNull();
    expect(error?.message).toBe(FIXED);
    expect(error?.name).toBe('TransactionNotCommittedError');
    expect(await noteIds(db)).toEqual([1]);
  });
  test('the callback keeps sending statements after the failure and swallows their errors too: the same rejection',async()=>{
    const error=await caught(db.transaction(async tx=>{
      try {await duplicate(tx);} catch {/* swallowed */}
      for(let i=0;i<3;i++) {try {await tx.query(`INSERT INTO ${TABLE}(id,note) VALUES (${10+i},'after the failure')`);} catch {/* swallowed: the transaction is aborted */}}
      return 'returned normally';
    }));
    expect(error?.message).toBe(FIXED);
    expect(await noteIds(db)).toEqual([1]);
  });
  test('the error says nothing the database said: no SQLSTATE, no table, no constraint, no cause',async()=>{
    const error=await caught(db.transaction(async tx=>{try {await duplicate(tx);} catch {/* swallowed */} return 1;}));
    expect(error?.message).toBe(FIXED);
    expect(String(error?.message)).not.toMatch(/duplicate|violat|constraint|txc_probe|t_pkey|25P02|23505|aborted|current transaction/i);
    expect(error?.code).toBeUndefined();
    expect(error?.cause).toBeUndefined();
  });
  test('a callback whose statements all succeed still commits, and the caller gets its value',async()=>{
    await expect(db.transaction(async tx=>{
      await tx.query(`INSERT INTO ${TABLE}(id,note) VALUES (2,'kept')`);
      return (await tx.query<{n:number}>(`SELECT count(*)::int AS n FROM ${TABLE}`)).rows[0].n;
    })).resolves.toBe(2);
    expect(await noteIds(db)).toEqual([1,2]);
  });
  test('a failure that the callback heals with a savepoint is not an aborted transaction: the transaction commits (the outbox report depends on this)',async()=>{
    let healed=false;
    await expect(db.transaction(async tx=>{
      await tx.query(`INSERT INTO ${TABLE}(id,note) VALUES (2,'before the savepoint')`);
      await tx.query('SAVEPOINT one');
      try {await duplicate(tx);} catch {await tx.query('ROLLBACK TO SAVEPOINT one');healed=true;}
      await tx.query('RELEASE SAVEPOINT one');
      await tx.query(`INSERT INTO ${TABLE}(id,note) VALUES (3,'after the savepoint')`);
      return 'done';
    })).resolves.toBe('done');
    // the statement really failed and the savepoint healed it: this is not a plain success case
    expect(healed).toBe(true);
    expect(await noteIds(db)).toEqual([1,2,3]);
  });
  test('an error that the callback throws itself still reaches the caller as it is, not as the fixed sentence',async()=>{
    const error=await caught(db.transaction(async tx=>{
      await tx.query(`INSERT INTO ${TABLE}(id,note) VALUES (2,'rolled back')`);
      try {await duplicate(tx);} catch {/* swallowed */}
      throw new Error('SENTINEL');
    }));
    expect(error?.message).toBe('SENTINEL');
    expect(await noteIds(db)).toEqual([1]);
  });
  test('scoped() is a transaction too: the same rejection, and the caller does not see a success',async()=>{
    const principal={id:'00000000-0000-4000-8000-000000000001',tenantId:'00000000-0000-4000-8000-000000000002',projectIds:['00000000-0000-4000-8000-000000000003'],name:'probe',role:'manager' as const};
    const error=await caught(scoped(h.db,principal,async tx=>{
      try {await tx.query('SELECT 1/0');} catch {/* swallowed */}
      return 'returned normally';
    }));
    expect(error?.message).toBe(FIXED);
  });
});

describe.skipIf(!native)('the connection after a COMMIT that answered ROLLBACK (native PostgreSQL)',()=>{
  test('premise: on this server COMMIT of an aborted transaction answers the command ROLLBACK and raises no error',async()=>{
    const c=new Client({connectionString:url()});
    await c.connect();
    try {
      await c.query('BEGIN');
      await expect(c.query('SELECT 1/0')).rejects.toBeTruthy();
      const result=await c.query('COMMIT');
      expect(result.command).toBe('ROLLBACK');
    } finally {await c.end();}
  });
  test('the connection goes back to the pool idle and usable: same backend, no transaction left open, no dropped-session event, and the next transaction works',async()=>{
    const pool=pooledDatabase(url());
    const admin=new Client({connectionString:url()});
    await admin.connect();
    const logged:string[]=[];
    const spy=vi.spyOn(console,'error').mockImplementation((line:unknown)=>{logged.push(String(line));});
    try {
      const pidBefore=(await pool.transaction(async tx=>(await tx.query<{pid:number}>('SELECT pg_backend_pid() AS pid')).rows[0].pid));
      let pidInside=0;
      const error=await caught(pool.transaction(async tx=>{
        pidInside=(await tx.query<{pid:number}>('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        try {await tx.query('SELECT 1/0');} catch {/* swallowed */}
        return 'returned normally';
      }));
      expect(error?.message).toBe(FIXED);
      // no transaction is left open on that session ('idle', not 'idle in transaction') ...
      const state=(await admin.query<{state:string}>('SELECT state FROM pg_stat_activity WHERE pid=$1',[pidInside])).rows[0]?.state;
      expect(state).toBe('idle');
      // ... and it was handed back to the pool, not destroyed: the next transaction runs on the same backend (a destroyed backend can still read 'idle' for a moment, so this is the check that counts)
      const pidAfter=(await pool.transaction(async tx=>(await tx.query<{pid:number}>('SELECT pg_backend_pid() AS pid')).rows[0].pid));
      expect([pidInside,pidAfter]).toEqual([pidBefore,pidBefore]);
      expect(logged.filter(l=>l.includes('db_session_ended'))).toEqual([]);
    } finally {spy.mockRestore();await admin.end();await pool.close();}
  });
});
