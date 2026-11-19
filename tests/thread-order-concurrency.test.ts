import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {native,openHarness,waitForBlocked,type Harness} from './slice1-db';
import {pm,seedSlice1} from './slice1-fixtures';
import {scoped,type Queryable} from '../src/server/db';
import {ids} from '../src/server/identities';
import {IntakeService,type IntakeAck} from '../src/server/intake';
import {bridgeConfig,chatSales,chatTransport,intakePrincipalId,messageEvent} from './slice2-fixtures';

// Migration 023, the intake half (N1-N6, N16): the numbers of one thread follow the order of commit. The confirming half (N7-N11, N17, N19, N20): a confirmation of a candidate draft
// carries the position it read, and the database compares it with the counter row of the thread under a lock. The rollback file (N18) waits for a confirmation in flight. Every case here
// needs two connections, so it runs on native PostgreSQL only (PGlite has one connection and shows no lock wait). The order of each case is set by the case itself: a raw transaction
// holds the counter row of a thread until the case lets it go. Nothing is read from a clock: a statement that waits is shown by `inFlight` (it has not settled while a session is blocked),
// a statement that must not wait by its answer (the code of the error, 42501 or P0001, is not 55P03) and by the absence of any blocked session.
const hex=(c:string)=>c.repeat(64);
// a promise that is settled from outside: the way a case holds a transaction open on one connection while another connection acts
const latch=()=>{let open!:()=>void;const promise=new Promise<void>(r=>{open=r;});return {promise,open};};

describe.skipIf(!native)('thread numbers under concurrency (native PostgreSQL)',()=>{
  let h:Harness;
  // N19b switches the guard of 022 off with a COMMITTED statement (the other connections have to see it off). A case that dies between that statement and the one that puts it back must
  // not leave the shared native database in that state for the next run: both hooks put it back, idempotently (review R-S-9).
  const restoreGuards=async()=>{
    const r=await h.operator.query<{tgenabled:string}>("SELECT tgenabled FROM pg_trigger WHERE tgname='draft_decisions_pointer_only_guard' AND tgrelid='public.draft_decisions'::regclass AND NOT tgisinternal");
    if(r.rows[0]&&r.rows[0].tgenabled!=='O') await h.exec('ALTER TABLE public.draft_decisions ENABLE TRIGGER draft_decisions_pointer_only_guard');
  };
  beforeEach(async()=>{h=await openHarness();await restoreGuards();await h.reset();await seedSlice1(h);});
  afterEach(async()=>{try {await restoreGuards();} finally {await h.reset();await h.close();}});

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
    let err:unknown=null,sessionTimeout:{before:string;after:string}|null=null;
    await h.operator.transaction(async tx=>{
      await writeIn(tx,chatSales,thread,'9103');
      // the session setting of a connection that waited and failed is what it was: the function sets its own cap and puts the session value back
      await h.operator.transaction(async other=>{
        const read=async()=>(await other.query<{lock_timeout:string}>('SHOW lock_timeout')).rows[0].lock_timeout;
        const was=await read();
        await other.query('SAVEPOINT s');
        await other.query(`INSERT INTO source_events(tenant_id,project_id,source_id,source_type,quality_score,chat_id,message_id,thread_key,source_actor,observed_at,forwarded,addressed,trace_id,correlation_id)
          VALUES($1,$2,'gw-9104','telegram_gateway',80,$3,'9104',$4,'actor-1',now(),false,false,$5,$5)`,[ids.tenant,ids.sales,chatSales,thread,randomUUID()]);
        let sawCode:string|undefined;
        // the holder has not committed (this callback runs inside its transaction): the only way out of the wait is the cap of the function, 55P03, not a refusal at once
        try {await other.query(`INSERT INTO source_event_revisions(${COLS}) SELECT $1,$2,id,1,$3,$4,'pointer_only' FROM source_events WHERE message_id='9104'`,[ids.tenant,ids.sales,hex('5'),hex('b')]);}
        catch(x){sawCode=(x as {code?:string}).code;}
        expect(sawCode).toBe('55P03');
        await other.query('ROLLBACK TO SAVEPOINT s');
        sessionTimeout={before:was,after:await read()};
      });
      err=await svc().ingest(reply).then(()=>null,x=>x);
    });
    expect((err as {code?:string}|null)?.code).toBe('55P03');
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
    const answers:{name:string;message:string;code?:string}[]=[];
    const positionsBefore=await count('source_revision_positions');
    let waiting=-1;
    // the thread of the other project and the thread in scope are both held by writers that have not committed (these callbacks run inside their transactions)
    await h.operator.transaction(async holderA=>{
      await writeIn(holderA,chatTransport,theirThread,'9111',ids.transport);
      await h.operator.transaction(async holderB=>{
        await writeIn(holderB,chatSales,mine.thread,'9112');
        for(const [name,sql,params] of forms){
          await asIntake([ids.sales],async tx=>{
            const e=await tx.query(sql,params).then(()=>null,x=>x as Error&{code?:string});
            answers.push({name,message:e?.message??'stored',code:e?.code});
          });
        }
        // nobody waited for a lock while the answers were given
        waiting=(await q<{n:number}>("SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'"))[0].n;
      });
    });
    // answered by row-level security, not by the cap of a wait (55P03) that would have ended a wait for a thread this role may not write
    for(const a of answers){
      expect(a.message,a.name).toMatch(/row-level security/);
      expect(a.code,a.name).toBe('42501');
    }
    expect(waiting).toBe(0);
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

  // ---- The confirming half: a decision row that carries the position of the thread, compared with the counter row under FOR NO KEY UPDATE ----
  const SOURCES='[{"ref":"synthetic-source"}]';
  const codeOf=(x:unknown)=>(x as {code?:string}|undefined)?.code;
  const candidateOf=async(thread:string,chat=chatSales)=>(await q<{id:string}>('SELECT id FROM intake_candidates WHERE chat_id=$1 AND thread_key=$2',[chat,thread]))[0].id;
  /** A draft about the candidate, written as the operational login: one source, value hash hex('c'). */
  const draftOf=async(candidate:string,project=ids.sales)=>(await q<{id:string}>(`INSERT INTO intelligence.ai_drafts(tenant_id,project_id,entity_type,entity_id,signal_type,skill_version,manifest_hash,model_version,value,value_hash,sources,confidence,input_hash,ai_principal_id,trace_id,dedupe_key)
    VALUES($1,$2,'intake_candidate',$3,'intake_analyst','1',$4,'m','{}',$4,$5::jsonb,1,$4,$3,$3,$6) RETURNING id`,[ids.tenant,project,candidate,hex('c'),SOURCES,'thread-order-'+randomUUID()]))[0].id;
  const asRuntime=<T,>(projects:string[],fn:(tx:Queryable)=>Promise<T>)=>scoped(h.db,{...pm,projectIds:projects},async tx=>{
    await tx.query("SELECT set_config('app.person_id',$1,true)",[pm.id]);
    return fn(tx);
  });
  const insertDecision=(tx:Queryable,draft:string,over:Record<string,unknown>={})=>{
    const v:Record<string,unknown>={tenant_id:ids.tenant,project_id:ids.sales,draft_id:draft,draft_value_hash:hex('c'),result:'confirmed',reason:'',decided_by:pm.id,
      command_key:'thread-order-'+randomUUID(),request_id:randomUUID(),trace_id:randomUUID(),subject_thread_seq:null,...over},keys=Object.keys(v);
    return tx.query(`INSERT INTO draft_decisions(${keys.join(',')}) VALUES(${keys.map((_,i)=>`$${i+1}`).join(',')})`,keys.map(k=>v[k]));
  };
  const storedPosition=async(draft:string)=>(await q<{s:number|null}>('SELECT subject_thread_seq::int s FROM draft_decisions WHERE draft_id=$1',[draft]))[0]?.s;
  /** The statement `p` is in flight and waits for a lock: it has not settled while `n` sessions are blocked. A statement that is refused at once fails here, with a sentence. */
  const inFlight=async(p:Promise<unknown>,n=1)=>{
    const first=await Promise.race([p.then(()=>'settled' as const),waitForBlocked(h,n).then(()=>'blocked' as const)]);
    expect(first,'the statement was expected to wait for a lock').toBe('blocked');
  };
  /** Waits until a session is blocked by the backend `pid` (told apart from the sessions that wait for somebody else); `p` must not have settled meanwhile. */
  const waitBlockedBy=async(pid:number,p:Promise<unknown>,timeoutMs=5000)=>{
    let settled=false;
    void p.then(()=>{settled=true;});
    const deadline=Date.now()+timeoutMs;
    for(;;){
      const n=(await q<{n:number}>("SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND $1::int = ANY(pg_blocking_pids(pid))",[pid]))[0].n;
      if(n>=1) return;
      expect(settled,'the statement was expected to wait for the lock of the other transaction').toBe(false);
      if(Date.now()>deadline) throw new Error('Gave up waiting for a session blocked by the transaction that holds the lock');
      await new Promise(r=>setTimeout(r,50));
    }
  };

  test('N7 a confirmation that carries the position it read waits for an intake of the thread in flight and is refused once that intake commits',async()=>{
    const {thread}=await root();
    const draft=await draftOf(await candidateOf(thread));
    const read=await head(thread);
    expect(read).toBe(1);
    let decision!:Promise<unknown>;
    await h.operator.transaction(async tx=>{
      // the intake has its number (2) and has not committed: the counter row of the thread is held
      await writeIn(tx,chatSales,thread,'9201');
      decision=settle(asRuntime([ids.sales],t=>insertDecision(t,draft,{subject_thread_seq:read})));
      await inFlight(decision);
      // nothing is stored while the confirmation waits
      expect(await count('draft_decisions')).toBe(0);
    });
    expect(codeOf(await decision)).toBe('LTZ03');
    expect(await count('draft_decisions')).toBe(0);
    expect(await head(thread)).toBe(2);
  });

  test('N8 an intake waits for a confirmation in flight; the confirmation commits first',async()=>{
    const {e,thread}=await root();
    const draft=await draftOf(await candidateOf(thread));
    const read=await head(thread);
    const held=latch(),opened=latch();
    // the confirmation has written its row (the position is current) and has not committed: it holds the counter row
    const holder=settle(asRuntime([ids.sales],async tx=>{await insertDecision(tx,draft,{subject_thread_seq:read});opened.open();await held.promise;}));
    let intake!:Promise<unknown>;
    try {
      expect(await Promise.race([opened.promise.then(()=>null),holder]),'the confirmation was stored').toBeNull();
      intake=settle(svc().ingest(messageEvent({context:{replyToMessageId:e.context.messageId}})));
      await inFlight(intake);
      // the thread has not moved while the intake waits
      expect(await head(thread)).toBe(read);
    } finally {
      // a case that fails above must not leave its transaction open for the cases that follow
      held.open();
    }
    expect(codeOf(await holder)).toBeUndefined();
    const ack=await intake as IntakeAck;
    expect(ack.replayed).toBe(false);
    expect(await count('draft_decisions')).toBe(1);
    expect(await storedPosition(draft)).toBe(read);
    expect(await head(thread)).toBe(read+1);
    expect((await numbers(thread)).map(r=>r.seq)).toEqual([1,2]);
  });

  test('N9 a rejection does not wait for an intake of the thread',async()=>{
    const {thread}=await root();
    const draft=await draftOf(await candidateOf(thread));
    let answer:unknown;
    await h.operator.transaction(async tx=>{
      await writeIn(tx,chatSales,thread,'9202');
      // the counter row is held; the rejection is answered, and stored, before that transaction ends
      answer=await settle(asRuntime([ids.sales],t=>insertDecision(t,draft,{result:'rejected',reason:'Lý do đủ dài'})));
    });
    expect(codeOf(answer)).toBeUndefined();
    expect(await count('draft_decisions')).toBe(1);
    expect(await storedPosition(draft)).toBeNull();
  });

  test('N10 scoped to another project, the runtime role is answered at once while the thread is held',async()=>{
    const mine=await root();
    const theirs=messageEvent({context:{chatId:chatTransport}});
    await svc().ingest(theirs);
    const theirThread='m:'+theirs.context.messageId;
    const draftMine=await draftOf(await candidateOf(mine.thread)),draftTheirs=await draftOf(await candidateOf(theirThread,chatTransport),ids.transport);
    const minePos=await head(mine.thread),theirPos=await head(theirThread);
    const answers:{name:string;code:string|undefined}[]=[];
    let waiting=-1;
    // both threads are held by writers that have not committed (these callbacks run inside their transactions)
    await h.operator.transaction(async holderA=>{
      await writeIn(holderA,chatTransport,theirThread,'9211',ids.transport);
      await h.operator.transaction(async holderB=>{
        await writeIn(holderB,chatSales,mine.thread,'9212');
        const forms:[string,string,Record<string,unknown>][]=[
          ['a draft of another project, the row names that project',draftTheirs,{project_id:ids.transport,subject_thread_seq:theirPos}],
          ['a draft of another project, the row names the project in scope',draftTheirs,{subject_thread_seq:theirPos}],
          ['a draft in scope, decided_by another person',draftMine,{decided_by:randomUUID(),subject_thread_seq:minePos}],
        ];
        for(const [name,draft,over] of forms){
          const x=await settle(asRuntime([ids.sales],tx=>insertDecision(tx,draft,over)));
          answers.push({name,code:codeOf(x)});
        }
        // nobody waited for a lock while the answers were given
        waiting=(await q<{n:number}>("SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'"))[0].n;
      });
    });
    // answered by the guards that run before the lock (P0001) or by row-level security (42501), never by the cap of a wait (55P03)
    expect(answers.map(a=>a.code)).toEqual(['P0001','P0001','42501']);
    expect(waiting).toBe(0);
    expect(await count('draft_decisions')).toBe(0);
    // the two holders each stored one number; the refused rows stored none and moved no counter
    expect(await head(mine.thread)).toBe(minePos+1);expect(await head(theirThread)).toBe(theirPos+1);
  });

  test('N11 intake, a mapping insert and a confirmation of one project never deadlock: the confirmation waits for the mapping, then for the intake, and is refused',async()=>{
    const {thread}=await root();
    const draft=await draftOf(await candidateOf(thread));
    const read=await head(thread);
    const pidOf=async(tx:Queryable)=>(await tx.query<{p:number}>('SELECT pg_backend_pid() p')).rows[0].p;
    let confirmation!:Promise<unknown>;
    await h.operator.transaction(async intake=>{
      await intake.query("SET LOCAL lock_timeout = '3s'");
      const pidIntake=await pidOf(intake);
      // the intake takes the number (and holds the counter row of the thread), with a key-share lock on the project row
      await writeIn(intake,chatSales,thread,'9221');
      await h.operator.transaction(async mapping=>{
        const pidMapping=await pidOf(mapping);
        // the mapping insert holds the project row FOR NO KEY UPDATE (migration 022)
        await mapping.query("INSERT INTO project_domain_mappings(tenant_id,project_id,domain_code,confirmed_by,source,mapping_version) VALUES($1,$2,'XECA',$3,'synthetic-source',1)",[ids.tenant,ids.sales,pm.id]);
        // the intake goes on writing while the mapping holds the project row: a key-share lock does not conflict, so this does not wait
        await intake.query(eventSql,[ids.tenant,ids.sales,'gw-9222',chatSales,'9222','m:9222',randomUUID()]);
        confirmation=settle(asRuntime([ids.sales],t=>insertDecision(t,draft,{subject_thread_seq:read})));
        // first it waits for the mapping (project row) ...
        await waitBlockedBy(pidMapping,confirmation);
      });
      // ... the mapping has committed: now it waits for the intake (counter row of the thread)
      await waitBlockedBy(pidIntake,confirmation);
    });
    const done=await confirmation;
    expect(codeOf(done),'no deadlock, and the thread moved on').toBe('LTZ03');
    expect(await count('draft_decisions')).toBe(0);
    expect((await q<{n:number}>("SELECT count(*)::int n FROM project_domain_mappings WHERE project_id=$1",[ids.sales]))[0].n).toBe(1);
    expect((await numbers(thread)).map(r=>r.seq)).toEqual([1,2]);
  },20000);

  test('N17 an open triage of the candidate, an intake of its thread and a confirmation do not deadlock',async()=>{
    const {e,thread}=await root();
    const candidate=await candidateOf(thread),draft=await draftOf(candidate);
    const read=await head(thread);
    let intake!:Promise<unknown>,confirmation!:Promise<unknown>;
    await h.operator.transaction(async triage=>{
      // the triage as src/server/inbox.ts does it: the candidate row FOR UPDATE, then UPDATE; the transaction stays open
      await triage.query('SELECT id FROM intake_candidates WHERE id=$1 FOR UPDATE',[candidate]);
      await triage.query("UPDATE intake_candidates SET state='needs_info',missing_fields='[\"synthetic\"]'::jsonb,version=version+1,updated_at=now() WHERE id=$1",[candidate]);
      // the intake of the thread takes its number (and the counter row), then waits at the insert of the candidate that the triage holds
      intake=settle(svc().ingest(messageEvent({context:{replyToMessageId:e.context.messageId}})));
      await inFlight(intake);
      // the confirmation, with the position it read, waits for the counter row held by the intake
      confirmation=settle(asRuntime([ids.sales],t=>insertDecision(t,draft,{subject_thread_seq:read})));
      await inFlight(confirmation,2);
    });
    const ack=await intake as IntakeAck;
    expect(ack.replayed).toBe(false);
    expect(codeOf(await confirmation),'no deadlock, and the thread moved on').toBe('LTZ03');
    expect(await count('draft_decisions')).toBe(0);
    expect((await numbers(thread)).map(r=>r.seq)).toEqual([1,2]);
    expect(await head(thread)).toBe(read+1);
  },20000);

  // ---- After the tier-1 reviews (task 2b) ----
  const HEAD_LOCK=(project:string)=>`SELECT 1 FROM intake_thread_heads WHERE project_id='${project}' AND chat_id=$1 AND thread_key=$2 FOR NO KEY UPDATE NOWAIT`;
  /** The code a second connection gets when it asks for the counter row of (project, chat, thread) without waiting: 55P03 when somebody holds it, undefined when it is free. */
  const lockCodeOfHead=async(project:string,chat:string,thread:string)=>{
    let code:string|undefined;
    await h.operator.transaction(async other=>{
      await other.query('SAVEPOINT s');
      try {await other.query(HEAD_LOCK(project),[chat,thread]);} catch(x){code=(x as {code?:string}).code;}
      await other.query('ROLLBACK TO SAVEPOINT s');
    });
    return code;
  };
  const rollbackSql=()=>readFile(path.join(process.cwd(),'migrations/rollback/023_thread_order.sql'),'utf8');

  test('N18 the rollback waits for a confirmation in flight and then refuses: the position that was written is not lost',async()=>{
    const {thread}=await root();
    const draft=await draftOf(await candidateOf(thread));
    const read=await head(thread);
    const rollback=await rollbackSql();
    const held=latch(),opened=latch();
    // the confirmation has written its row, with its position, and has not committed
    const holder=settle(asRuntime([ids.sales],async tx=>{await insertDecision(tx,draft,{subject_thread_seq:read});opened.open();await held.promise;}));
    let rolling!:Promise<unknown>;
    try {
      expect(await Promise.race([opened.promise.then(()=>null),holder]),'the confirmation was stored').toBeNull();
      // the file takes the table before it looks for a position: it waits for the confirmation, as any ALTER of that table would
      rolling=settle(h.exec(rollback));
      await inFlight(rolling);
    } finally {
      held.open();
    }
    expect(codeOf(await holder)).toBeUndefined();
    const refused=await rolling as Error|undefined;
    expect(refused,'the rollback was expected to refuse').toBeInstanceOf(Error);
    expect(refused!.message).toMatch(/carries the position of its thread/);
    // nothing was dropped: the column, the trigger, the record of 023, and the position of the decision that committed meanwhile
    expect(await q("SELECT 1 FROM pg_attribute WHERE attrelid='public.draft_decisions'::regclass AND attname='subject_thread_seq' AND NOT attisdropped")).toHaveLength(1);
    expect(await q("SELECT 1 FROM pg_trigger WHERE tgname='draft_decisions_subject_order_guard' AND NOT tgisinternal")).toHaveLength(1);
    expect(await q("SELECT 1 FROM schema_migrations WHERE version='023'")).toHaveLength(1);
    expect(await storedPosition(draft)).toBe(read);
  });

  // Two confirmations of one thread belong to one project, and the guard of 022 makes them take turns on the row of the project before either reaches the counter row. So the strength of
  // the lock on the counter row (FOR NO KEY UPDATE, which a second confirmation conflicts with; FOR SHARE, which it does not) shows only when that guard is out of the way: the trigger
  // of 023 must not depend on the guard of another migration (plan, section 3, the row on FOR SHARE; review R-DB-6).
  const turns=async(guardOff:boolean)=>{
    const guard='draft_decisions_pointer_only_guard';
    if(guardOff) await h.exec(`ALTER TABLE draft_decisions DISABLE TRIGGER ${guard}`);
    try {
      const {e,thread}=await root();
      const candidate=await candidateOf(thread);
      const first=await draftOf(candidate),second=await draftOf(candidate);
      const read=await head(thread);
      const held=latch(),opened=latch();
      const holder=settle(asRuntime([ids.sales],async tx=>{await insertDecision(tx,first,{subject_thread_seq:read});opened.open();await held.promise;}));
      let intake!:Promise<unknown>,other!:Promise<unknown>;
      try {
        expect(await Promise.race([opened.promise.then(()=>null),holder]),'the confirmation was stored').toBeNull();
        intake=settle(svc().ingest(messageEvent({context:{replyToMessageId:e.context.messageId}})));
        await inFlight(intake);
        // a second confirmation of the same thread, with the position that is still the current one, does not go past the first: a lock that confirmations share would let it
        // through (and would starve the intake that is already waiting)
        other=settle(asRuntime([ids.sales],t=>insertDecision(t,second,{subject_thread_seq:read})));
        await inFlight(other,2);
        expect(await count('draft_decisions')).toBe(0);
      } finally {
        held.open();
      }
      expect(codeOf(await holder)).toBeUndefined();
      expect((await intake as IntakeAck).replayed).toBe(false);
      // The intake was there first. If it takes its number before the second confirmation asks for the counter row, that confirmation reads a thread that has moved on and is refused;
      // if the confirmation gets there first, it is stored with a position that was current when it locked the row, and the intake waits for it. Either way no stored decision is stale.
      const refused=codeOf(await other)==='LTZ03';
      expect(await count('draft_decisions')).toBe(refused?1:2);
      expect(await storedPosition(first)).toBe(read);
      if(!refused) expect(await storedPosition(second)).toBe(read);
      expect(await head(thread)).toBe(read+1);
      expect((await numbers(thread)).map(r=>r.seq)).toEqual([1,2]);
      return refused;
    } finally {
      if(guardOff) await h.exec(`ALTER TABLE draft_decisions ENABLE TRIGGER ${guard}`);
    }
  };

  test('N19 two confirmations of one thread take turns: while one holds the counter row the other waits, and so does an intake',async()=>{
    await turns(false);
  });

  test('N19b the same with the guard of 022 switched off, so that the lock on the project row does not do the work: the counter row alone makes them take turns',async()=>{
    // the guard is put back in a finally block; the second confirmation is refused (the intake queued first)
    expect(await turns(true),'the second confirmation was expected to wait for the intake and be refused').toBe(true);
    expect(await q("SELECT tgenabled FROM pg_trigger WHERE tgname='draft_decisions_pointer_only_guard' AND NOT tgisinternal")).toEqual([{tgenabled:'O'}]);
  });

  test('N20 the guard of a project locks the counter row of its own thread and none of another project that has the same chat and thread key',async()=>{
    const key='m:9801';
    // the same chat and thread key in both projects, each with its own counter row: the sales project holds one revision, the transport project three
    const rootOf=async(project:string,message:string)=>h.operator.transaction(tx=>writeIn(tx,chatSales,key,message,project));
    const salesRoot=await rootOf(ids.sales,'9801');
    const transportRoot=await rootOf(ids.transport,'9802');
    await rootOf(ids.transport,'9803');await rootOf(ids.transport,'9804');
    const candidateIn=async(project:string,rootEvent:string)=>(await q<{id:string}>(
      'INSERT INTO intake_candidates(tenant_id,project_id,chat_id,thread_key,root_source_event_id) VALUES($1,$2,$3,$4,$5) RETURNING id',[ids.tenant,project,chatSales,key,rootEvent]))[0].id;
    const sales={project:ids.sales,seq:1,draft:await draftOf(await candidateIn(ids.sales,salesRoot))};
    const transport={project:ids.transport,seq:3,draft:await draftOf(await candidateIn(ids.transport,transportRoot),ids.transport)};
    const heads=await q<{project_id:string;last_seq:number}>('SELECT project_id,last_seq::int last_seq FROM intake_thread_heads WHERE thread_key=$1 ORDER BY 1',[key]);
    expect(heads.map(r=>r.last_seq).sort()).toEqual([1,3]);
    for(const [mine,theirs] of [[sales,transport],[transport,sales]] as const){
      let own:string|undefined,foreign:string|undefined;
      await asRuntime([mine.project],async tx=>{
        // the guard has run in this open transaction, with the right position
        await insertDecision(tx,mine.draft,{project_id:mine.project,subject_thread_seq:mine.seq});
        own=await lockCodeOfHead(mine.project,chatSales,key);
        foreign=await lockCodeOfHead(theirs.project,chatSales,key);
      });
      expect(own,'the counter row of its own thread is held').toBe('55P03');
      expect(foreign,'the counter row of the other project is free').toBeUndefined();
    }
    expect(await count('draft_decisions')).toBe(2);
  });

  // ---- After the second look at the fix round (task 2c) ----

  // R-DB-11: the service reads the revision table (the text of the messages) and then writes the decision. The rollback file took the decision table first and the revision table later,
  // the other way round: a confirmation that had read and had not yet written, and the rollback, waited for each other (40P01). The file now takes the revision table first.
  test('N18b a confirmation that has read the revision table and has not written yet, and the rollback: no deadlock, the confirmation is stored and the rollback refuses',async()=>{
    const {thread}=await root();
    const draft=await draftOf(await candidateOf(thread));
    const read=await head(thread);
    const rollback=await rollbackSql();
    let rolling!:Promise<unknown>,wrote:unknown='not written';
    await asRuntime([ids.sales],async tx=>{
      // ACCESS SHARE on the revision table, held to the end of the transaction
      await tx.query('SELECT count(*) FROM source_event_revisions');
      // the rollback comes now and waits for that read, holding nothing that the confirmation needs: the revision table first, the decision table second
      rolling=settle(h.exec(rollback));
      await inFlight(rolling);
      wrote=await settle(insertDecision(tx,draft,{subject_thread_seq:read}));
    });
    // the decision was stored (with the decision table taken first, the two waited for each other and one of them got 40P01) ...
    expect(codeOf(wrote),'the confirmation was expected to be stored').toBeUndefined();
    // ... and then the rollback saw its position and refused, with the fixed sentence; nothing was dropped
    const refused=await rolling as Error|undefined;
    expect(refused,'the rollback was expected to refuse').toBeInstanceOf(Error);
    expect(refused!.message).toMatch(/carries the position of its thread/);
    expect(await q("SELECT 1 FROM pg_attribute WHERE attrelid='public.draft_decisions'::regclass AND attname='subject_thread_seq' AND NOT attisdropped")).toHaveLength(1);
    expect(await q("SELECT 1 FROM schema_migrations WHERE version='023'")).toHaveLength(1);
    expect(await storedPosition(draft)).toBe(read);
  });

  // R-S-9: the hooks that put the guard of 022 back. H3 switches it off with a committed statement and ends without putting it back; H4 runs after it, on the same database (cases of a
  // file run in order), and finds it on. Without the hooks H4 is red.
  test('H3 a case that switches the guard of 022 off with a committed statement and ends without putting it back',async()=>{
    await h.exec('ALTER TABLE public.draft_decisions DISABLE TRIGGER draft_decisions_pointer_only_guard');
    expect(await q("SELECT tgenabled FROM pg_trigger WHERE tgname='draft_decisions_pointer_only_guard' AND NOT tgisinternal")).toEqual([{tgenabled:'D'}]);
  });

  test('H4 the case that follows finds it on: the hooks put it back',async()=>{
    expect(await q("SELECT tgenabled FROM pg_trigger WHERE tgname='draft_decisions_pointer_only_guard' AND NOT tgisinternal")).toEqual([{tgenabled:'O'}]);
  });
});
