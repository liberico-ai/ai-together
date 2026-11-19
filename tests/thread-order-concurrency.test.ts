import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {native,openHarness,waitForBlocked,type Harness} from './slice1-db';
import {pm,seedSlice1} from './slice1-fixtures';
import type {Queryable} from '../src/server/db';
import {ids} from '../src/server/identities';
import {IntakeService,type IntakeAck} from '../src/server/intake';
import {bridgeConfig,chatSales,chatTransport,intakePrincipalId,messageEvent} from './slice2-fixtures';

// Migration 023, the intake half: the numbers of one thread follow the order of commit. Every case here needs two connections, so it runs on native PostgreSQL only
// (PGlite has one connection and shows no lock wait). The order of each case is set by the case itself: a raw transaction holds the counter row of a thread
// until the case lets it go; nothing is timed except the caps that the migration sets (5 seconds) and the answers that must not wait.
const hex=(c:string)=>c.repeat(64);

describe.skipIf(!native)('thread numbers under concurrency (native PostgreSQL)',()=>{
  let h:Harness;
  beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);});
  afterEach(async()=>{await h.reset();await h.close();});

  const svc=()=>new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,bridgeConfig.intake!);
  const q=async<T=Record<string,unknown>>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
  const count=async(t:string)=>(await q<{n:number}>(`SELECT count(*)::int n FROM ${t}`))[0].n;
  const numbers=(thread:string)=>q<{seq:number;message_id:string;revision_no:number}>(
    `SELECT p.thread_seq::int seq,e.message_id,r.revision_no FROM source_revision_positions p JOIN source_event_revisions r ON r.id=p.revision_id
     JOIN source_events e ON e.id=p.source_event_id WHERE p.thread_key=$1 ORDER BY p.thread_seq`,[thread]);
  const head=async(thread:string)=>(await q<{last_seq:number}>('SELECT last_seq::int last_seq FROM intake_thread_heads WHERE thread_key=$1',[thread]))[0]?.last_seq;
  const settle=<T,>(p:Promise<T>)=>p.then(v=>v,(e:unknown)=>e);

  /** A transaction that has written one more revision into a thread, as the intake does, and goes on holding the counter row of that thread. */
  const eventSql=`INSERT INTO source_events(tenant_id,project_id,source_id,source_type,quality_score,chat_id,message_id,thread_key,source_actor,observed_at,forwarded,addressed,trace_id,correlation_id)
    VALUES($1,$2,$3,'telegram_gateway',80,$4,$5,$6,'actor-1',now(),false,false,$7,$7) RETURNING id`;
  const COLS='tenant_id,project_id,source_event_id,revision_no,revision_key,content_hash,content_mode';
  const writeIn=async(tx:Queryable,chat:string,thread:string,message:string,project=ids.sales)=>{
    const e=(await tx.query<{id:string}>(eventSql,[ids.tenant,project,'gw-'+message,chat,message,thread,randomUUID()])).rows[0].id;
    await tx.query(`INSERT INTO source_event_revisions(${COLS}) VALUES($1,$2,$3,1,$4,$5,'pointer_only')`,[ids.tenant,project,e,hex('3'),hex('b')]);
    return e;
  };
  const asIntake=<T,>(projects:string[],fn:(tx:Queryable)=>Promise<T>)=>h.operator.transaction(async tx=>{
    await tx.query('SET LOCAL ROLE libetech_intake');
    await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true),set_config('app.intake_principal_id',$3,true)",[ids.tenant,projects.join(','),pm.id]);
    return fn(tx);
  });
  const root=async()=>{const e=messageEvent({});await svc().ingest(e);return {e,thread:'m:'+e.context.messageId};};

  test('N1 two intake transactions of one thread take turns: the second waits for the first to commit and gets the next number',async()=>{
    const {e,thread}=await root();
    let second!:Promise<unknown>;
    await h.operator.transaction(async tx=>{
      // the first writer has its number (2) and has not committed
      await writeIn(tx,chatSales,thread,'9101');
      second=settle(svc().ingest(messageEvent({context:{replyToMessageId:e.context.messageId}})));
      await waitForBlocked(h,1);
    });
    const ack=await second as IntakeAck;
    expect(ack.replayed).toBe(false);
    // the order of the numbers is the order of commit: the writer that had the counter first is 2, the one that waited is 3
    expect((await numbers(thread)).map(r=>r.seq)).toEqual([1,2,3]);
    expect((await numbers(thread))[1].message_id).toBe('9101');
    expect(await head(thread)).toBe(3);
  });

  test('N2 a thread that has no head row yet is safe with two writers',async()=>{
    const a=messageEvent({context:{mediaGroupId:'albumN2'}}),b=messageEvent({context:{mediaGroupId:'albumN2'}});
    let both!:Promise<PromiseSettledResult<IntakeAck>[]>;
    await h.operator.transaction(async tx=>{
      // both are in flight before either has written: the first insert of the counter row is raced by the other
      await tx.query('LOCK TABLE source_events IN SHARE ROW EXCLUSIVE MODE');
      both=Promise.allSettled([svc().ingest(a),svc().ingest(b)]);
      await waitForBlocked(h,2);
    });
    const res=await both;
    expect(res.map(r=>r.status)).toEqual(['fulfilled','fulfilled']);
    expect((await numbers('g:albumN2')).map(r=>r.seq)).toEqual([1,2]);
    expect(await head('g:albumN2')).toBe(2);
    expect(await q("SELECT 1 FROM intake_thread_heads WHERE thread_key='g:albumN2'")).toHaveLength(1);
  });

  test('N3 another thread of the same project does not wait',async()=>{
    const {thread}=await root();
    let other!:IntakeAck;
    await h.operator.transaction(async tx=>{
      await writeIn(tx,chatSales,thread,'9102');
      // the counter row of the first thread is held: a message of another thread is stored and numbered before that transaction ends
      other=await svc().ingest(messageEvent({}));
    });
    expect(other.replayed).toBe(false);
    expect(await q('SELECT thread_seq::int seq FROM source_revision_positions WHERE source_event_id=$1',[other.sourceEventId])).toEqual([{seq:1}]);
  });

  test('N4 an intake that waits past the cap fails with 55P03 and stores nothing; the same event is stored once the thread is free',async()=>{
    const {e,thread}=await root();
    const reply=messageEvent({context:{replyToMessageId:e.context.messageId}});
    const tables=['source_events','source_event_revisions','intake_attachments','intake_candidates','intake_events','intake_thread_heads','source_revision_positions'];
    const before=Object.fromEntries(await Promise.all(tables.map(async t=>[t,await count(t)])));
    let err:unknown=null,elapsed=0,sessionTimeout:{before:string;after:string}|null=null;
    await h.operator.transaction(async tx=>{
      await writeIn(tx,chatSales,thread,'9103');
      // the session setting of a connection that waited and failed is what it was: the function sets its own cap and puts the session value back
      await h.operator.transaction(async other=>{
        const read=async()=>(await other.query<{lock_timeout:string}>('SHOW lock_timeout')).rows[0].lock_timeout;
        const was=await read();
        await other.query('SAVEPOINT s');
        await other.query(`INSERT INTO source_events(tenant_id,project_id,source_id,source_type,quality_score,chat_id,message_id,thread_key,source_actor,observed_at,forwarded,addressed,trace_id,correlation_id)
          VALUES($1,$2,'gw-9104','telegram_gateway',80,$3,'9104',$4,'actor-1',now(),false,false,$5,$5)`,[ids.tenant,ids.sales,chatSales,thread,randomUUID()]);
        const t0=Date.now();
        let sawCode:string|undefined;
        try {await other.query(`INSERT INTO source_event_revisions(${COLS}) SELECT $1,$2,id,1,$3,$4,'pointer_only' FROM source_events WHERE message_id='9104'`,[ids.tenant,ids.sales,hex('5'),hex('b')]);}
        catch(x){sawCode=(x as {code?:string}).code;}
        expect(sawCode).toBe('55P03');
        expect(Date.now()-t0).toBeGreaterThanOrEqual(4000);
        await other.query('ROLLBACK TO SAVEPOINT s');
        sessionTimeout={before:was,after:await read()};
      });
      const t0=Date.now();
      err=await svc().ingest(reply).then(()=>null,x=>x);
      elapsed=Date.now()-t0;
    });
    expect((err as {code?:string}|null)?.code).toBe('55P03');
    expect(elapsed).toBeGreaterThanOrEqual(4000);
    expect(elapsed).toBeLessThan(9000);
    expect(sessionTimeout).not.toBeNull();
    expect(sessionTimeout!.after).toBe(sessionTimeout!.before);
    // the failed intake stored nothing, in any of the seven tables; the holder stored one event, one revision and one number
    const after=Object.fromEntries(await Promise.all(tables.map(async t=>[t,await count(t)])));
    expect(after).toEqual({...before,source_events:before.source_events+1,source_event_revisions:before.source_event_revisions+1,source_revision_positions:before.source_revision_positions+1});
    expect(await q('SELECT 1 FROM source_events WHERE chat_id=$1 AND message_id=$2',[chatSales,reply.context.messageId])).toEqual([]);
    // the thread is free: the same event is stored, as new, and numbered after the holder
    const again=await svc().ingest(reply);
    expect(again.replayed).toBe(false);
    expect((await numbers(thread)).map(r=>r.seq)).toEqual([1,2,3]);
    expect(await head(thread)).toBe(3);
  },30000);

  test('N5 the intake role scoped to another project is answered at once while the thread is held',async()=>{
    const mine=await root();
    const theirs=messageEvent({context:{chatId:chatTransport}});
    await svc().ingest(theirs);
    const theirThread='m:'+theirs.context.messageId;
    const eventOf=async(chat:string,message:string)=>(await q<{id:string}>('SELECT id FROM source_events WHERE chat_id=$1 AND message_id=$2',[chat,message]))[0].id;
    const sales=await eventOf(chatSales,mine.e.context.messageId),transport=await eventOf(chatTransport,theirs.context.messageId);
    const REV=`INSERT INTO source_event_revisions(${COLS})`;
    const forms:[string,string,unknown[]][]=[
      ['one row of another project',`${REV} VALUES($1,$2,$3,2,$4,$5,'pointer_only')`,[ids.tenant,ids.transport,transport,hex('9'),hex('8')]],
      ['two rows, VALUES',`${REV} VALUES($1,$2,$3,2,$4,$5,'pointer_only'),($1,$6,$7,2,$8,$5,'pointer_only')`,[ids.tenant,ids.sales,sales,hex('7'),hex('8'),ids.transport,transport,hex('6')]],
      ['two rows, INSERT … SELECT',`${REV} SELECT $1::uuid,v.p,v.e,2,v.k,$2::text,'pointer_only' FROM (VALUES($3::uuid,$4::uuid,$5::text),($6::uuid,$7::uuid,$8::text)) v(p,e,k)`,[ids.tenant,hex('8'),ids.sales,sales,hex('7'),ids.transport,transport,hex('6')]],
    ];
    const answers:{name:string;message:string;ms:number}[]=[];
    const positionsBefore=await count('source_revision_positions');
    // the thread of the other project and the thread in scope are both held by writers that have not committed
    await h.operator.transaction(async holderA=>{
      await writeIn(holderA,chatTransport,theirThread,'9111',ids.transport);
      await h.operator.transaction(async holderB=>{
        await writeIn(holderB,chatSales,mine.thread,'9112');
        for(const [name,sql,params] of forms){
          await asIntake([ids.sales],async tx=>{
            const t0=Date.now();
            const e=await tx.query(sql,params).then(()=>null,x=>x as Error);
            answers.push({name,message:e?.message??'stored',ms:Date.now()-t0});
          });
        }
      });
    });
    for(const a of answers){
      expect(a.message,a.name).toMatch(/row-level security/);
      expect(a.ms,a.name).toBeLessThan(100);
    }
    expect(answers).toHaveLength(3);
    // the two holders each stored one number; the refused statements stored none
    expect(await count('source_revision_positions')).toBe(positionsBefore+2);
    expect(await head(mine.thread)).toBe(2);expect(await head(theirThread)).toBe(2);
  });

  test('N6 a REPEATABLE READ writer that raced is refused with 40001',async()=>{
    const {thread}=await root();
    const race=async()=>{
      let racer!:Promise<unknown>;
      await h.operator.transaction(async holder=>{
        await writeIn(holder,chatSales,thread,'9121');
        racer=settle(h.operator.transaction(async tx=>{
          await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
          // the snapshot is taken before the holder commits
          await tx.query('SELECT count(*) FROM source_event_revisions');
          await writeIn(tx,chatSales,thread,'9122');
        }));
        await waitForBlocked(h,1);
      });
      return racer;
    };
    const e=await race() as {code?:string};
    expect(e?.code).toBe('40001');
    // the racer stored nothing and took no number; the thread carries the holder's number and no hole
    expect((await numbers(thread)).map(r=>r.seq)).toEqual([1,2]);
    expect(await head(thread)).toBe(2);
    expect(await q("SELECT 1 FROM source_events WHERE message_id='9122'")).toEqual([]);
  });

  test('N16 a replayed revision returns at once while its thread is held, and takes no lock',async()=>{
    const s=svc(),e=messageEvent({});
    await s.ingest(e);
    const thread='m:'+e.context.messageId;
    // 1. the thread is held by a writer that has not committed: the replay is answered before that writer ends
    let replayed:IntakeAck|undefined;
    await h.operator.transaction(async tx=>{
      await writeIn(tx,chatSales,thread,'9131');
      replayed=await s.ingest(e);
    });
    expect(replayed!.replayed).toBe(true);
    expect((await numbers(thread)).map(r=>r.seq)).toEqual([1,2]);
    // 2. nobody holds the thread. The replay statement, in a transaction that stays open, holds no lock on the counter row: a second connection takes it with NOWAIT.
    const key=(await q<{revision_key:string;source_event_id:string;content_hash:string}>(
      `SELECT r.revision_key,r.source_event_id,r.content_hash FROM source_event_revisions r JOIN source_events ev ON ev.id=r.source_event_id WHERE ev.message_id=$1`,[e.context.messageId]))[0];
    const lockHead=(tx:Queryable)=>tx.query('SELECT 1 FROM intake_thread_heads WHERE thread_key=$1 FOR NO KEY UPDATE NOWAIT',[thread]);
    await asIntake([ids.sales],async tx=>{
      const replay=await tx.query(`INSERT INTO source_event_revisions(${COLS}) SELECT $1::uuid,$2::uuid,$3::uuid,5,$4::text,$5::text,'pointer_only' ON CONFLICT(source_event_id,revision_key) DO NOTHING RETURNING id`,
        [ids.tenant,ids.sales,key.source_event_id,key.revision_key,key.content_hash]);
      expect(replay.rows).toEqual([]);
      await h.operator.transaction(async other=>{await lockHead(other);});
    });
    // the control that gives the probe its meaning: a revision that IS stored holds the counter row until its transaction ends
    await asIntake([ids.sales],async tx=>{
      await tx.query(`INSERT INTO source_event_revisions(${COLS}) VALUES($1,$2,$3,5,$4,$5,'pointer_only')`,[ids.tenant,ids.sales,key.source_event_id,hex('2'),hex('b')]);
      let code:string|undefined;
      await h.operator.transaction(async other=>{
        await other.query('SAVEPOINT s');
        try {await lockHead(other);} catch(x){code=(x as {code?:string}).code;}
        await other.query('ROLLBACK TO SAVEPOINT s');
      });
      expect(code).toBe('55P03');
    });
  });
});
