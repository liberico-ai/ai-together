import {describe,expect,test,vi} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {Client} from 'pg';
import {assertSessionTimeouts,IDLE_IN_TRANSACTION_TIMEOUT_MS,pooledDatabase,type Queryable} from '../src/server/db';
import {assertIsolated,native} from './slice1-db';

// N1 of DELIVERY-016. Since migration 023 a transaction of the intake path that is left open holds the counter row of its thread, and every other message of that thread waits for it
// (55P03 after 5 seconds, each time). A held transaction therefore has to end by itself: every login the application uses carries idle_in_transaction_session_timeout, and the application
// reads it back with SHOW before it serves anything. The cases that need a second connection run on native PostgreSQL only; the read-back runs on both.
const KEY=424242;
const sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
const latch=()=>{let open!:()=>void;const promise=new Promise<void>(r=>{open=r;});return {promise,open};};
// a case that waits for another connection must fail, not hang, when the other connection never lets go
const within=<T>(p:Promise<T>,ms:number,what:string)=>Promise.race([p,sleep(ms).then(()=>{throw new Error(`Timed out waiting for ${what}.`);})]);
const url=()=>{const u=process.env.SLICE1_TEST_DATABASE_URL as string;assertIsolated(u);return u;};
// asks the server what it says about the session, the way the application does
const effectiveMs=async(q:Queryable)=>Number((await q.query<{ms:string}>("SELECT setting AS ms FROM pg_settings WHERE name='idle_in_transaction_session_timeout'")).rows[0].ms);

describe('the application reads the idle-transaction timeout back with SHOW (PGlite and native)',()=>{
  test('a session without the timeout is refused with a fixed sentence, and nothing about the database is in it',async()=>{
    const pg=await PGlite.create();
    try {
      const q:Queryable={query:(sql,params)=>pg.query(sql,params)};
      expect(await effectiveMs(q)).toBe(0);
      await expect(assertSessionTimeouts(q)).rejects.toThrow('Runtime login must end an idle transaction by itself (idle_in_transaction_session_timeout between 1 ms and 30000 ms).');
    } finally {await pg.close();}
  });
  test('30 seconds is accepted; one millisecond over it is refused; 1 ms is accepted',async()=>{
    expect(IDLE_IN_TRANSACTION_TIMEOUT_MS).toBe(30000);
    const pg=await PGlite.create();
    try {
      const q:Queryable={query:(sql,params)=>pg.query(sql,params)};
      for(const [ms,ok] of [[30000,true],[30001,false],[1,true],[0,false]] as const){
        await pg.exec(`SET idle_in_transaction_session_timeout=${ms}`);
        if(ok) await expect(assertSessionTimeouts(q)).resolves.toBeUndefined();
        else await expect(assertSessionTimeouts(q)).rejects.toThrow('idle_in_transaction_session_timeout');
      }
    } finally {await pg.close();}
  });
});

describe.skipIf(!native)('a held transaction ends by itself (native PostgreSQL)',()=>{
  test('every pool the application builds starts its sessions with the timeout, and SHOW says so',async()=>{
    const db=pooledDatabase(url());
    try {
      expect(await effectiveMs(db)).toBe(IDLE_IN_TRANSACTION_TIMEOUT_MS);
      await expect(db.transaction(async tx=>effectiveMs(tx))).resolves.toBe(IDLE_IN_TRANSACTION_TIMEOUT_MS);
      await expect(assertSessionTimeouts(db)).resolves.toBeUndefined();
    } finally {await db.close();}
  });
  test('a role-level default of 0 does not switch it off: a fresh session of the same login sees 0, the pool sees 30 seconds',async()=>{
    // the default is set for this login in this isolated database only (IN DATABASE), and put back in the finally
    const admin=new Client({connectionString:url()});
    await admin.connect();
    const database=(await admin.query<{d:string}>('SELECT current_database() AS d')).rows[0].d;
    const askFresh=async()=>{
      const c=new Client({connectionString:url()});await c.connect();
      try {return await effectiveMs({query:async<T>(sql:string,p?:unknown[])=>({rows:(await c.query(sql,p)).rows as T[]})});} finally {await c.end();}
    };
    try {
      await admin.query(`ALTER ROLE CURRENT_USER IN DATABASE ${database} SET idle_in_transaction_session_timeout = 0`);
      expect(await askFresh(),'the default is in force for a session that sends nothing').toBe(0);
      const db=pooledDatabase(url());
      try {expect(await effectiveMs(db)).toBe(IDLE_IN_TRANSACTION_TIMEOUT_MS);} finally {await db.close();}
    } finally {
      await admin.query(`ALTER ROLE CURRENT_USER IN DATABASE ${database} RESET idle_in_transaction_session_timeout`);
      await admin.end();
    }
  });
  // A transaction that takes the lock and then stays idle past the timeout is ended by the server; another session waits for the lock and gets it; what the first one does afterwards is the case.
  const killedHolder=async(afterKill:(tx:Queryable)=>Promise<unknown>):Promise<unknown>=>{
    const db=pooledDatabase(url(),false,{idleInTransactionMs:2000});
    try {
      const held=latch(),freed=latch();
      const holder=db.transaction(async tx=>{
        await tx.query('SELECT pg_advisory_xact_lock($1::bigint)',[KEY]);
        held.open();
        await within(freed.promise,12000,'the waiting session to get the lock');
        return afterKill(tx);
      });
      const holderResult=holder.then(()=>null,(e:unknown)=>e);
      await within(held.promise,5000,'the holder to take the lock');
      // the waiting session can only get the lock once the server has ended the holder's idle transaction
      await within(db.transaction(async tx=>{await tx.query('SELECT pg_advisory_xact_lock($1::bigint)',[KEY]);freed.open();}),12000,'the waiting session');
      return await within(holderResult,12000,'the holder to answer');
    } finally {await db.close();}
  };
  test('the holder is ended by the server, the waiting session gets the lock, nothing stops, and the caller gets the error of its own code, not one of the rollback',async()=>{
    // the old code ran ROLLBACK on the dead connection and let its error ("not queryable") replace this one
    const error=await killedHolder(async()=>{throw new Error('SENTINEL');}) as Error|null;
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe('SENTINEL');
  });
  test('a statement that the holder sends on the ended session fails with an error at once, it does not hang',async()=>{
    const error=await killedHolder(tx=>tx.query('SELECT 1')) as {message?:string}|null;
    expect(error).not.toBeNull();
    expect(String(error?.message)).toMatch(/idle-in-transaction|terminat|not queryable/i);
  });
  test('the pool is usable after a session was ended: the dead connection is dropped, not handed out again',async()=>{
    const db=pooledDatabase(url(),false,{idleInTransactionMs:1000});
    try {
      await expect(db.transaction(async tx=>{await tx.query('SELECT 1');await sleep(2500);await tx.query('SELECT 2');})).rejects.toBeTruthy();
      for(let i=0;i<5;i++) await expect(db.query('SELECT 1 AS one')).resolves.toEqual({rows:[{one:1}]});
      await expect(db.transaction(async tx=>(await tx.query('SELECT 3 AS three')).rows[0])).resolves.toEqual({three:3});
    } finally {await db.close();}
  });
  test('a transaction that keeps working is not cut: the timeout counts idle time, not total time',async()=>{
    const db=pooledDatabase(url(),false,{idleInTransactionMs:2000});
    try {
      await expect(db.transaction(async tx=>{
        for(let i=0;i<8;i++){await tx.query('SELECT 1');await sleep(300);}
        return (await tx.query<{n:number}>('SELECT 7 AS n')).rows[0].n;
      })).resolves.toBe(7);
    } finally {await db.close();}
  });
  test('the listener that transaction() puts on a connection is taken off again: fifteen transactions on one pool raise no warning about listeners',async()=>{
    const warnings:string[]=[];
    const onWarning=(w:Error)=>{warnings.push(w.name);};
    process.on('warning',onWarning);
    const db=pooledDatabase(url());
    try {
      for(let i=0;i<15;i++) await db.transaction(async tx=>(await tx.query('SELECT 1')).rows);
      await sleep(50);
      expect(warnings.filter(n=>n==='MaxListenersExceededWarning')).toEqual([]);
    } finally {process.off('warning',onWarning);await db.close();}
  });
  test('an idle pooled connection that the server ends does not stop the process, and the pool opens another one',async()=>{
    const db=pooledDatabase(url());
    const admin=new Client({connectionString:url()});
    await admin.connect();
    const logged:string[]=[];
    const spy=vi.spyOn(console,'error').mockImplementation((line:unknown)=>{logged.push(String(line));});
    try {
      const pid=(await db.query<{pid:number}>('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await admin.query('SELECT pg_terminate_backend($1)',[pid]);
      // an unhandled 'error' event would be reported by the runner as an unhandled error and fail the run
      for(let i=0;i<40&&!logged.some(l=>l.includes('pool_idle_client_error'));i++) await sleep(50);
      expect(logged.filter(l=>l.includes('pool_idle_client_error'))).toHaveLength(1);
      // fixed event and SQLSTATE only: no message, no host, user or database
      expect(logged.join('\n')).not.toMatch(/terminating connection|127\.0\.0\.1|slice1|password/i);
      await expect(db.query('SELECT 1 AS one')).resolves.toEqual({rows:[{one:1}]});
    } finally {spy.mockRestore();await admin.end();await db.close();}
  });
  test('the transaction that ended a session logs one fixed event with the SQLSTATE of the cause and nothing else',async()=>{
    const db=pooledDatabase(url(),false,{idleInTransactionMs:500});
    const logged:string[]=[];
    const spy=vi.spyOn(console,'error').mockImplementation((line:unknown)=>{logged.push(String(line));});
    try {
      await expect(db.transaction(async tx=>{await tx.query('SELECT 1');await sleep(1500);await tx.query('SELECT 2');})).rejects.toBeTruthy();
      const events=logged.filter(l=>l.includes('db_session_ended'));
      expect(events).toHaveLength(1);
      expect(JSON.parse(events[0])).toEqual({level:'error',event:'db_session_ended',sqlstate:'25P03'});
    } finally {spy.mockRestore();await db.close();}
  });
});

// The read-back is wired into the pool of a restricted login: it is refused before any statement of the service runs. It needs the restricted (web) login of the native test database.
describe.skipIf(!native||!process.env.SLICE1_WEB_DATABASE_URL)('the pool of a restricted login reads the timeout back before it serves (native PostgreSQL, web login)',()=>{
  const web=()=>process.env.SLICE1_WEB_DATABASE_URL as string;
  test('a pool whose sessions do not end an idle transaction is refused with the fixed sentence; the same login with the default is served',async()=>{
    const refused=pooledDatabase(web(),true,{idleInTransactionMs:0});
    try {await expect(refused.query('SELECT 1')).rejects.toThrow('Runtime login must end an idle transaction by itself (idle_in_transaction_session_timeout between 1 ms and 30000 ms).');} finally {await refused.close();}
    const tooLong=pooledDatabase(web(),true,{idleInTransactionMs:30001});
    try {await expect(tooLong.query('SELECT 1')).rejects.toThrow('idle_in_transaction_session_timeout');} finally {await tooLong.close();}
    const served=pooledDatabase(web(),true);
    try {await expect(served.query('SELECT 1 AS one')).resolves.toEqual({rows:[{one:1}]});} finally {await served.close();}
  });
});
