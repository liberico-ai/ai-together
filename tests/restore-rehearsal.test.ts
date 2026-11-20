import {afterAll,beforeAll,describe,expect,test} from 'vitest';
import {execFile} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {native,openHarness,assertIsolated,type Harness} from './slice1-db';
import {pm,seedSlice1} from './slice1-fixtures';
import {pooledDatabase,scoped,type Database,type Queryable} from '../src/server/db';
import {ids} from '../src/server/identities';
import {IntakeService} from '../src/server/intake';
import {bridgeConfig,chatSales,intakePrincipalId,messageEvent} from './slice2-fixtures';

// N4 of DELIVERY-016: a restore rehearsal with the real pg_dump and pg_restore. Native PostgreSQL only, and only when SLICE1_PG_CONTAINER names the container whose pg_dump / pg_restore /
// psql this file runs (`docker exec -i <container> ...`, local socket, no password: the default pg_hba of the postgres image). The login of SLICE1_TEST_DATABASE_URL must be a superuser:
// the restore disables triggers, and migration 023 needs one. Archives are made as DEPLOY-002 says: pg_dump -Fc --data-only --exclude-table-data=public.schema_migrations, and travel through
// memory (stdout of pg_dump, stdin of pg_restore): no archive is written to a file. Every target is a fresh database that has the migrations applied and no data, as the installer leaves it
// before it restores. Each source and target is a database of its own whose name matches the isolation rule of slice1-db.ts, and only those names are dropped at the end.
const CONTAINER=process.env.SLICE1_PG_CONTAINER;
const enabled=native&&Boolean(CONTAINER);
const hex=(c:string)=>c.repeat(64);
const SOURCES='[{"ref":"synthetic-source"}]';
const APP_SCHEMAS=['public','identity','analytics','intelligence'];
const NUMBERING='source_event_revisions_thread_position',GUARD='draft_decisions_subject_order_guard';

type Run={code:number;out:Buffer;err:string};
/** One tool of the PostgreSQL container, as its superuser; the archive (or any input) goes through stdin. Never throws: the caller reads the exit code. */
function tool(args:string[],input?:Buffer|string):Promise<Run>{
  return new Promise(resolve=>{
    const child=execFile('docker',['exec','-i',CONTAINER!,...args],{encoding:'buffer',maxBuffer:512*1024*1024},(error,stdout,stderr)=>
      resolve({code:error?(typeof error.code==='number'?error.code:1):0,out:stdout,err:stderr.toString('utf8')}));
    child.stdin!.end(input);
  });
}
/** deploy/restore-plan.py: the one rule for what an archive is and how it is loaded (the installers call the same file). */
function plan(args:string[],input=''):Promise<{code:number;out:string;err:string}>{
  return new Promise(resolve=>{
    const child=execFile('python3',['-I',path.join(process.cwd(),'deploy/restore-plan.py'),...args],{encoding:'utf8'},(error,stdout,stderr)=>
      resolve({code:error?(typeof error.code==='number'?error.code:1):0,out:stdout,err:stderr}));
    child.stdin!.end(input);
  });
}

let superuser='',baseUrl:URL;
const urlOf=(db:string)=>{const u=new URL(baseUrl.toString());u.pathname='/'+db;return u.toString();};
const created:string[]=[];
const pools:Database[]=[];
let serial=0;
const dbName=()=>`slice1_verify_${Date.now()}${String(++serial).padStart(2,'0')}`;
let admin:Database;
/** The first lines of what a tool said, for the evidence log: the messages are fixed sentences of PostgreSQL and of the files, never data. */
// No DETAIL or CONTEXT line: a message of PostgreSQL can quote a row, and this log is read in a public repository. The data of this file is synthetic, but the pattern must not print a real row.
const said=(label:string,text:string)=>console.info(`${label}: ${text.split('\n').filter(l=>/^pg_restore: error|^ERROR|POST-RESTORE|^\{/.test(l)).slice(0,2).join(' | ').slice(0,300)}`);
/** The first line of what a tool said: the message of a failed assertion (never the whole of stderr). */
const first=(text:string)=>text.split('\n')[0].slice(0,200);
/** The lines of a tool's stderr that carry a message of ours or of pg_restore's own error line: what an assertion may match without printing the rest (DETAIL, CONTEXT). */
const errLines=(text:string)=>text.split('\n').filter(l=>/pg_restore: error|^ERROR|POST-RESTORE|PRE-RESTORE/.test(l)).join('\n');

/** A new empty database with the migrations up to `upTo` applied (the state the installer leaves before it restores). */
async function freshDatabase(upTo='999'):Promise<{name:string;db:Database}>{
  const name=dbName();
  assertIsolated(urlOf(name));
  await admin.query(`CREATE DATABASE "${name}"`);
  created.push(name);
  const db=pooledDatabase(urlOf(name));
  pools.push(db);
  for(const file of (await readdir(path.join(process.cwd(),'migrations'))).filter(f=>/^\d+.*\.sql$/.test(f)).sort()){
    if(file.slice(0,3)>upTo) continue;
    await db.query(await readFile(path.join(process.cwd(),'migrations',file),'utf8'));
  }
  return {name,db};
}

// --- the data of the rehearsal: written by the service, as the pilot does ---
const insertDecision=(tx:Queryable,draft:string,over:Record<string,unknown>={})=>{
  const v:Record<string,unknown>={tenant_id:ids.tenant,project_id:ids.sales,draft_id:draft,draft_value_hash:hex('c'),result:'confirmed',reason:'',
    decided_by:pm.id,command_key:'rehearsal-'+randomUUID(),request_id:randomUUID(),trace_id:randomUUID(),...over};
  const keys=Object.keys(v);
  return tx.query(`INSERT INTO draft_decisions(${keys.join(',')}) VALUES(${keys.map((_,i)=>`$${i+1}`).join(',')})`,keys.map(k=>v[k]));
};
const decideAsRuntime=(db:Database,draft:string,over:Record<string,unknown>)=>
  scoped(db,{...pm,projectIds:[ids.sales]},async tx=>{await tx.query("SELECT set_config('app.person_id',$1,true)",[pm.id]);return insertDecision(tx,draft,over);});
const draftOf=async(db:Database,entityId:string)=>(await db.query<{id:string}>(
  `INSERT INTO intelligence.ai_drafts(tenant_id,project_id,entity_type,entity_id,signal_type,skill_version,manifest_hash,model_version,value,value_hash,sources,confidence,input_hash,ai_principal_id,trace_id,dedupe_key)
   VALUES($1,$2,'intake_candidate',$3,'intake_analyst','1',$4,'m','{}',$4,$5::jsonb,1,$4,$3,$3,$6) RETURNING id`,
  [ids.tenant,ids.sales,entityId,hex('c'),SOURCES,'rehearsal-'+randomUUID()])).rows[0].id;
const candidateOf=async(db:Database,thread:string)=>(await db.query<{id:string}>('SELECT id FROM intake_candidates WHERE thread_key=$1',[thread])).rows[0].id;
const svcOf=(db:Database)=>new IntakeService(db,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,bridgeConfig.intake!);

/**
 * Two threads in the sales project. Thread one has four messages and revisions, and a decision that confirms its candidate while it stood at position 3: the thread then moved on
 * to 4, so that decision carries a position that is no longer the last one (the case of class sweep CS-DB-2). Thread two: a confirmation at its last position and a rejection.
 * `numbered` is false for a database before 023: the service writes the same rows, nothing numbers them, and a decision has no column for a position.
 */
async function writeRehearsalData(db:Database,numbered:boolean):Promise<{thread1:string;thread2:string}>{
  await seedSlice1({operator:db,db,native:true} as unknown as Harness);
  const svc=svcOf(db);
  const root1=messageEvent({});await svc.ingest(root1);
  const thread1='m:'+root1.context.messageId;
  await svc.ingest(messageEvent({context:{replyToMessageId:root1.context.messageId}}));
  await svc.ingest({...root1,editedAt:new Date(1760009999000).toISOString(),contentHash:hex('b')});
  const root2=messageEvent({});await svc.ingest(root2);
  const thread2='m:'+root2.context.messageId;
  await svc.ingest(messageEvent({context:{replyToMessageId:root2.context.messageId}}));
  const [c1,c2]=[await candidateOf(db,thread1),await candidateOf(db,thread2)];
  const position=async(thread:string)=>numbered?{subject_thread_seq:(await db.query<{s:number}>('SELECT last_seq::int s FROM intake_thread_heads WHERE thread_key=$1',[thread])).rows[0].s}:{};
  const d1=await draftOf(db,c1),d2=await draftOf(db,c2),d3=await draftOf(db,c2);
  await decideAsRuntime(db,d1,await position(thread1));
  await decideAsRuntime(db,d2,await position(thread2));
  await decideAsRuntime(db,d3,{result:'rejected',reason:'Lý do đủ dài'});
  // the thread of the first decision moves on after it
  await svc.ingest(messageEvent({context:{replyToMessageId:root1.context.messageId}}));
  return {thread1,thread2};
}
/** A document with a revision that is its latest: the two tables point at each other (the foreign keys that no load order can satisfy). */
async function addDocument(db:Database):Promise<void>{
  const [doc,rev]=[randomUUID(),randomUUID()];
  await db.query(`INSERT INTO document_records(id,tenant_id,project_id,doc_type,title,source_type,canonical_uri,registered_by) VALUES($1,$2,$3,'spec','Tài liệu mẫu','git','https://example.test/doc',$4)`,[doc,ids.tenant,ids.sales,pm.id]);
  await db.query(`INSERT INTO document_revisions(id,tenant_id,project_id,document_id,revision_no,source_id,source_type,proposed_by) VALUES($1,$2,$3,$4,1,'https://example.test/doc','git',$5)`,[rev,ids.tenant,ids.sales,doc,pm.id]);
  await db.query('UPDATE document_records SET latest_revision_id=$1 WHERE id=$2',[rev,doc]);
}

async function triggerStates(db:Database):Promise<Record<string,string>>{
  const r=await db.query<{tgname:string;tgenabled:string}>(`SELECT tgname,tgenabled FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('${NUMBERING}','${GUARD}')`);
  return Object.fromEntries(r.rows.map(x=>[x.tgname,x.tgenabled]));
}
/** The rows of every table of the application schemas: row count and a digest of the rows as JSON, in a fixed order. A column that is NULL is left out of the row, so that a schema before 023
 * (no position column in the decisions) compares with one that has it; a position that has a value is compared, and a value turned into NULL is a difference. */
async function fingerprint(db:Database,only?:string[]):Promise<Record<string,string>>{
  const tables=(await db.query<{t:string}>(`SELECT n.nspname||'.'||c.relname AS t FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p') AND NOT c.relispartition AND n.nspname=ANY($1) AND c.relname<>'schema_migrations' ORDER BY 1`,[APP_SCHEMAS])).rows.map(r=>r.t).filter(t=>!only||only.includes(t));
  const out:Record<string,string>={};
  for(const t of tables){
    const r=(await db.query<{n:number;h:string}>(`SELECT count(*)::int n, coalesce(md5(string_agg(j,E'\\n' ORDER BY j)),'') h FROM (SELECT jsonb_strip_nulls(to_jsonb(x))::text j FROM ${t} x) y`)).rows[0];
    out[t]=`${r.n}:${r.h}`;
  }
  return out;
}

/**
 * pg_dump --data-only warns, for every foreign key that makes a cycle, that the archive "might not be restorable without --disable-triggers"
 * (self references of bom_proposals, intake_candidates, review_comments, document_revisions; document_records and document_revisions point at each other).
 * Those lines are the only ones a dump of this schema may print: anything else is a dump that went wrong.
 */
const dumpNoise=(stderr:string)=>stderr.split('\n').filter(l=>l.trim()&&!/^pg_dump: (warning: there are circular foreign-key constraints|detail: [a-z_]+$|hint: (You might not be able to restore the dump without using --disable-triggers|Consider using a full dump instead))/.test(l));
const dump=async(db:string,extra:string[]=[])=>{
  const made=await tool(['pg_dump','-U',superuser,'-d',db,'-Fc','--data-only','--exclude-table-data=public.schema_migrations',...extra]);
  expect(made.code,first(made.err)).toBe(0);expect(dumpNoise(made.err)).toEqual([]);
  return made.out;
};
const listing=async(archive:Buffer)=>(await tool(['pg_restore','--list'],archive)).out.toString();
/** The command the installers used before N4 (install-user.py and install-d1.sh): no --disable-triggers. */
const OLD_RESTORE=(db:string)=>['pg_restore','-U',superuser,'-d',db,'--exit-on-error','--single-transaction','--data-only','--no-owner'];
/** The command after N4: the arguments are the ones that restore-plan.py names, for every archive. */
async function newRestore(db:string):Promise<string[]>{
  const r=await plan(['--pg-restore-args']);expect(r.code,first(r.err)).toBe(0);
  return ['pg_restore','-U',superuser,'-d',db,...r.out.trim().split(' ')];
}
/** A file of SQL through psql, as the installers feed it (stdin), ON_ERROR_STOP, no psql variable. */
const psqlFile=(db:string,sql:string)=>tool(['psql','-U',superuser,'-X','-q','-At','-v','ON_ERROR_STOP=1','-v','VERBOSITY=terse','-v','SHOW_CONTEXT=never','-d',db],sql);
const postRestoreSql=()=>readFile(path.join(process.cwd(),'deploy/post-restore.sql'),'utf8');
const preRestoreSql=()=>readFile(path.join(process.cwd(),'deploy/pre-restore.sql'),'utf8');
/** A query that the installers run against the target, as restore-plan.py prints it. */
async function planQuery(flag:string,db:string):Promise<string>{
  const q=await plan([flag]);expect(q.code).toBe(0);
  const r=await tool(['psql','-U',superuser,'-X','-q','-At','-d',db,'-c',q.out.trim()]);expect(r.code,first(r.err)).toBe(0);
  return r.out.toString();
}
/** What the installers do with a listing: the tables of the target go to the plan, which names the kind or refuses. */
async function classify(archive:Buffer,targetDb:string){return plan(['--tables',await planQuery('--tables-sql',targetDb)],await listing(archive));}
const forwardSql=()=>readFile(path.join(process.cwd(),'migrations/023_thread_order.sql'),'utf8');
/** The row that the file answers: its last line of output, one JSON object. */
const answer=(r:Run)=>{const lines=r.out.toString().trim().split('\n');return JSON.parse(lines[lines.length-1]) as Record<string,unknown>;};

describe.skipIf(!enabled)('N4 restore rehearsal with the real pg_dump and pg_restore',()=>{
  let source:Harness,archive:Buffer,sourceThreads:{thread1:string;thread2:string};
  beforeAll(async()=>{
    baseUrl=new URL(process.env.SLICE1_TEST_DATABASE_URL!);
    superuser=decodeURIComponent(baseUrl.username);
    admin=pooledDatabase(urlOf('postgres'));
    expect((await admin.query<{s:boolean}>('SELECT rolsuper s FROM pg_roles WHERE rolname=current_user')).rows[0].s,'the login of the rehearsal must be a superuser').toBe(true);
    source=await openHarness();
    await source.reset();
    sourceThreads=await writeRehearsalData(source.operator,true);
    archive=await dump(baseUrl.pathname.slice(1));
  });
  afterAll(async()=>{
    await source?.reset();await source?.close();
    for(const db of pools) await db.close().catch(()=>{});
    for(const name of created) await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`).catch(()=>{});
    await admin?.close();
  });

  describe('what the installers did before N4 (the red of N4)',()=>{
    test('R1 the archive of a post-023 database lists the two number tables and the decision that was confirmed at a position that is no longer the last',async()=>{
      const l=await listing(archive);
      expect(l).toMatch(/TABLE DATA public source_revision_positions /);
      expect(l).toMatch(/TABLE DATA public intake_thread_heads /);
      expect(l).not.toMatch(/TABLE DATA public schema_migrations /);
      expect((await source.operator.query<{n:number;m:number}>('SELECT (SELECT count(*) FROM source_revision_positions)::int n,(SELECT max(last_seq) FROM intake_thread_heads)::int m')).rows[0]).toEqual({n:6,m:4});
    });

    test('R2 the command of the installers before N4 cannot restore that archive: a trigger of 023 runs on rows that are history, and the transaction rolls back',async()=>{
      const target=await freshDatabase();
      const r=await tool(OLD_RESTORE(target.name),archive);
      expect(r.code,first(r.err)).not.toBe(0);
      said('R2 old command, exit '+r.code,r.err);
      expect(errLines(r.err)).toMatch(/COPY failed for table "(source_revision_positions|intake_thread_heads|draft_decisions)"/);
      expect(errLines(r.err)).toMatch(/duplicate key value violates unique constraint|The thread of the candidate moved on/);
      // one transaction: not one table of the application holds a row of the archive
      expect(Object.values(await fingerprint(target.db)).filter(v=>!v.startsWith('0:'))).toEqual([]);
    });

    test('R2b with the decision table out of the way, the numbering trigger meets the number rows that the archive carries',async()=>{
      const target=await freshDatabase();
      const l=(await listing(archive)).split('\n').filter(x=>!/TABLE DATA public draft_decisions /.test(x)).join('\n');
      // the list goes into a file that the container names itself (pg_restore reads -L from a file, and the archive is on stdin)
      const made=await tool(['sh','-c','f=$(mktemp) && cat > "$f" && echo "$f"'],l);
      expect(made.code).toBe(0);
      const file=made.out.toString().trim();
      const r=await tool([...OLD_RESTORE(target.name),'-L',file],archive);
      await tool(['rm','-f',file]);
      expect(r.code,first(r.err)).not.toBe(0);
      said('R2b old command without draft_decisions, exit '+r.code,r.err);
      expect(errLines(r.err)).toMatch(/COPY failed for table "(source_revision_positions|intake_thread_heads)"/);
      expect(errLines(r.err)).toMatch(/duplicate key value violates unique constraint/);
    });

    test('R3 a plain pg_restore --disable-triggers loads the archive, and leaves the numbering trigger enabled for the origin role only (O, no longer A): the gap that N4 and N12 name',async()=>{
      const target=await freshDatabase();
      expect(await triggerStates(target.db)).toEqual({[NUMBERING]:'A',[GUARD]:'O'});
      const r=await tool([...OLD_RESTORE(target.name),'--disable-triggers'],archive);
      expect(r.code,first(r.err)).toBe(0);
      expect(await triggerStates(target.db)).toEqual({[NUMBERING]:'O',[GUARD]:'O'});
      expect(await fingerprint(target.db)).toEqual(await fingerprint(source.operator));
    });
  });

  describe('the restore after N4, from the archive of a post-023 database',()=>{
    test('R4 the plan names the archive post-023; the load, then deploy/post-restore.sql as one command: A and O, the answer, and every table equal to the source',async()=>{
      const target=await freshDatabase();
      // the plan reads the tables of the target and the listing of the archive; the target holds no row (the check before the load)
      expect(await classify(archive,target.name)).toMatchObject({code:0,out:'post-023\n'});
      const pre=await psqlFile(target.name,await preRestoreSql());
      expect(pre.code,first(pre.err)).toBe(0);
      const r=await tool(await newRestore(target.name),archive);
      expect(r.code,first(r.err)).toBe(0);
      // between the load and the file the trigger stands at O: this is the state that the file exists to end
      expect(await triggerStates(target.db)).toEqual({[NUMBERING]:'O',[GUARD]:'O'});
      const p=await psqlFile(target.name,await postRestoreSql());
      expect(p.code,first(p.err)).toBe(0);
      said('R4 post-restore',p.out.toString());
      expect(answer(p)).toMatchObject({post_restore:'pass',numbering_trigger_was:'O',thread_order:'checked'});
      expect(await triggerStates(target.db)).toEqual({[NUMBERING]:'A',[GUARD]:'O'});
      expect(await fingerprint(target.db)).toEqual(await fingerprint(source.operator));
      // the numbers that the source gave are the numbers of the target
      const numbers=(db:Database)=>db.query('SELECT revision_id::text r,thread_seq::int s FROM source_revision_positions ORDER BY 1');
      expect((await numbers(target.db)).rows).toEqual((await numbers(source.operator)).rows);
    });

    test('R4b the check before the load passes on a new database and stops, with its code, on one that already holds the archive (a second load would put rows beside rows with no guard to say so)',async()=>{
      const target=await freshDatabase();
      expect((await psqlFile(target.name,await preRestoreSql())).code).toBe(0);
      expect((await tool(await newRestore(target.name),archive)).code).toBe(0);
      const again=await psqlFile(target.name,await preRestoreSql());
      expect(again.code).not.toBe(0);
      said('R4b target that already holds the archive, exit '+again.code,again.err);
      expect(errLines(again.err)).toMatch(/PRE-RESTORE-02/);
      expect(again.err).not.toMatch(/DETAIL|CONTEXT/);
    });

    test('R5 on the restored database the service goes on: a new message gets the next number, a confirmation at the new position is stored and one at the old position is refused (LTZ03); a loader in replica mode is numbered',async()=>{
      const target=await freshDatabase();
      expect((await tool(await newRestore(target.name),archive)).code).toBe(0);
      expect((await psqlFile(target.name,await postRestoreSql())).code).toBe(0);
      const db=target.db;
      const last=async()=>(await db.query<{s:number}>('SELECT last_seq::int s FROM intake_thread_heads WHERE thread_key=$1',[sourceThreads.thread2])).rows[0].s;
      const before=await last();
      const root=(await db.query<{message_id:string}>("SELECT message_id FROM source_events WHERE thread_key=$1 AND reply_to_message_id IS NULL",[sourceThreads.thread2])).rows[0].message_id;
      await svcOf(db).ingest(messageEvent({context:{replyToMessageId:root}}));
      const now=await last();
      expect(now).toBe(before+1);
      const c=await candidateOf(db,sourceThreads.thread2),draft=await draftOf(db,c);
      const refusal=await decideAsRuntime(db,draft,{subject_thread_seq:before}).then(()=>null,(e:{code?:string})=>e.code);
      expect(refusal).toBe('LTZ03');
      await decideAsRuntime(db,draft,{subject_thread_seq:now});
      expect((await db.query<{n:number}>('SELECT count(*)::int n FROM draft_decisions WHERE draft_id=$1',[draft])).rows[0].n).toBe(1);
      // a session with session_replication_role = replica writes a revision after the restore: numbered (it would not be at O)
      const seen=await db.transaction(async tx=>{
        await tx.query('SET LOCAL session_replication_role = replica');
        const ev=(await tx.query<{id:string}>("SELECT id FROM source_events WHERE thread_key=$1 AND reply_to_message_id IS NULL",[sourceThreads.thread2])).rows[0].id;
        const rev=(await tx.query<{id:string}>(`INSERT INTO source_event_revisions(tenant_id,project_id,source_event_id,revision_no,revision_key,content_hash,content_mode) VALUES($1,$2,$3,9,$4,$5,'pointer_only') RETURNING id`,[ids.tenant,ids.sales,ev,hex('9'),hex('a')])).rows[0].id;
        return (await tx.query<{s:number}>('SELECT thread_seq::int s FROM source_revision_positions WHERE revision_id=$1',[rev])).rows[0]?.s??null;
      });
      expect(seen).toBe(now+1);
    });

    test('R6 the file is idempotent on the restored database: a second run finds the trigger at A and answers pass again',async()=>{
      const target=await freshDatabase();
      expect((await tool(await newRestore(target.name),archive)).code).toBe(0);
      expect(answer(await psqlFile(target.name,await postRestoreSql()))).toMatchObject({post_restore:'pass',numbering_trigger_was:'O'});
      expect(answer(await psqlFile(target.name,await postRestoreSql()))).toMatchObject({post_restore:'pass',numbering_trigger_was:'A'});
      expect(await fingerprint(target.db)).toEqual(await fingerprint(source.operator));
    });

    test('R7 an archive of which one number table was left out at dump time is refused by the plan, and a full archive too',async()=>{
      const cut=await dump(baseUrl.pathname.slice(1),['--exclude-table-data=public.intake_thread_heads']);
      const r=await classify(cut,(await freshDatabase()).name);
      expect(r.code).not.toBe(0);expect(r.out).toBe('');
      expect(r.err).toMatch(/number tables/);
    });

    test('R7b an archive of which BOTH number tables were cut out is classified pre-023, and the check after its load finds the positions that its decisions carry: it is not numbered again',async()=>{
      const bare=await dump(baseUrl.pathname.slice(1),['--exclude-table-data=public.intake_thread_heads','--exclude-table-data=public.source_revision_positions']);
      const target=await freshDatabase();
      expect(await classify(bare,target.name)).toMatchObject({code:0,out:'pre-023\n'});
      expect((await tool(await newRestore(target.name),bare)).code).toBe(0);
      // the two decisions of the source that confirmed a candidate carry the position that they were written at
      expect(Number((await planQuery('--pre-023-check-sql',target.name)).trim())).toBe(2);
    });

    test('R7c an archive that left out the data of another table is refused: nothing says so but the plan, which reads the tables of the target',async()=>{
      const cut=await dump(baseUrl.pathname.slice(1),['--exclude-table-data=analytics.reconciliations']);
      const r=await classify(cut,(await freshDatabase()).name);
      expect(r.code).not.toBe(0);expect(r.out).toBe('');
      expect(r.err).toContain('analytics.reconciliations');
    });

    test('R8 a database restored with a revision that has no number stops the file at the first look, and the thread stays as the source had it (no number is made up)',async()=>{
      const held=await freshDatabase();
      await writeRehearsalData(held.db,true);
      await held.db.query(`ALTER TABLE public.source_event_revisions DISABLE TRIGGER ${NUMBERING}`);
      const ev=(await held.db.query<{id:string}>('SELECT id FROM source_events LIMIT 1')).rows[0].id;
      await held.db.query(`INSERT INTO source_event_revisions(tenant_id,project_id,source_event_id,revision_no,revision_key,content_hash,content_mode) VALUES($1,$2,$3,9,$4,$5,'pointer_only')`,[ids.tenant,ids.sales,ev,hex('9'),hex('a')]);
      await held.db.query(`ALTER TABLE public.source_event_revisions ENABLE ALWAYS TRIGGER ${NUMBERING}`);
      const heldArchive=await dump(held.name);
      const target=await freshDatabase();
      expect((await tool(await newRestore(target.name),heldArchive)).code).toBe(0);
      const p=await psqlFile(target.name,await postRestoreSql());
      expect(p.code).not.toBe(0);
      said('R8 held thread, exit '+p.code,p.err);
      expect(errLines(p.err)).toMatch(/POST-RESTORE-05/);
      expect(p.err,'the answer names no chat and no thread of the data').not.toContain(chatSales);
      expect(await triggerStates(target.db)).toEqual({[NUMBERING]:'O',[GUARD]:'O'});
      expect((await target.db.query<{n:number}>('SELECT count(*)::int n FROM source_event_revisions r WHERE NOT EXISTS (SELECT 1 FROM source_revision_positions p WHERE p.revision_id=r.id)')).rows[0].n).toBe(1);
    });
  });

  describe('an archive taken before 023 (F0 and D2 of the plan)',()=>{
    let before:{name:string;db:Database},oldArchive:Buffer;
    beforeAll(async()=>{
      before=await freshDatabase('022');
      await writeRehearsalData(before.db,false);
      await addDocument(before.db);
      oldArchive=await dump(before.name);
    });

    test('R9 the plan names it pre-023, and the command of before N4 fails on it for a reason that has nothing to do with 023: the document and its revision point at each other (the red of F0)',async()=>{
      const target=await freshDatabase();
      expect(await classify(oldArchive,target.name)).toMatchObject({code:0,out:'pre-023\n'});
      const r=await tool(OLD_RESTORE(target.name),oldArchive);
      expect(r.code,first(r.err)).not.toBe(0);
      said('R9 old command on a pre-023 archive with a document, exit '+r.code,r.err);
      expect(errLines(r.err)).toMatch(/fk_document_records_latest_revision/);
    });

    test('R10 loaded with --disable-triggers, numbered by applying 023 again, checked by the file: every revision has a number, and the numbers are the ones that an in-place upgrade of the source gives',async()=>{
      const target=await freshDatabase();
      const r=await tool(await newRestore(target.name),oldArchive);
      expect(r.code,first(r.err)).toBe(0);
      // loaded with the numbering trigger off: no number yet, the file refuses (the reason for the step that comes first)
      expect((await target.db.query<{n:number}>('SELECT count(*)::int n FROM source_revision_positions')).rows[0].n).toBe(0);
      const early=await psqlFile(target.name,await postRestoreSql());
      expect(early.code).not.toBe(0);expect(errLines(early.err)).toMatch(/POST-RESTORE-05/);
      // an archive from before 023 carries no position: the numbering that 023 gives is the first
      expect(Number((await planQuery('--pre-023-check-sql',target.name)).trim())).toBe(0);
      const again=await psqlFile(target.name,await forwardSql());
      expect(again.code,first(again.err)).toBe(0);
      const p=await psqlFile(target.name,await postRestoreSql());
      expect(p.code,first(p.err)).toBe(0);
      expect(answer(p)).toMatchObject({post_restore:'pass',numbering_trigger_was:'A',thread_order:'checked'});
      expect(await triggerStates(target.db)).toEqual({[NUMBERING]:'A',[GUARD]:'O'});
      expect(await fingerprint(target.db,Object.keys(await fingerprint(before.db)))).toEqual(await fingerprint(before.db));
    });

    test('R11 the same archive into a database that has only migrations 001-022 (a backup rehearsed before 023 is applied): the load works, the file answers pass and says that 023 is not applied',async()=>{
      const target=await freshDatabase('022');
      const r=await tool(await newRestore(target.name),oldArchive);
      expect(r.code,first(r.err)).toBe(0);
      const p=await psqlFile(target.name,await postRestoreSql());
      expect(p.code,first(p.err)).toBe(0);
      expect(answer(p)).toMatchObject({post_restore:'pass',thread_order:'023 not applied'});
      expect(await fingerprint(target.db)).toEqual(await fingerprint(before.db));
    });

    test('R12 an archive with a draft of a candidate that no person has decided: applying 023 again refuses, so the restore stops there and the service is not started',async()=>{
      const withDraft=await freshDatabase('022');
      await writeRehearsalData(withDraft.db,false);
      const root=(await withDraft.db.query<{thread_key:string}>('SELECT thread_key FROM intake_candidates LIMIT 1')).rows[0].thread_key;
      await draftOf(withDraft.db,await candidateOf(withDraft.db,root));
      const archiveWithDraft=await dump(withDraft.name);
      const target=await freshDatabase();
      expect((await tool(await newRestore(target.name),archiveWithDraft)).code).toBe(0);
      const again=await psqlFile(target.name,await forwardSql());
      expect(again.code).not.toBe(0);
      said('R12 023 applied again, exit '+again.code,again.err);
      expect(errLines(again.err)).toMatch(/no person has decided/);
    });

    test('R13 the last word on D2: the numbers of a restored and renumbered archive are the ones that migration 023 is DEFINED to give (created_at, revision_no, id within a thread), computed here by a query of its own over the source',async()=>{
      const target=await freshDatabase();
      expect((await tool(await newRestore(target.name),oldArchive)).code).toBe(0);
      expect((await psqlFile(target.name,await forwardSql())).code).toBe(0);
      const given=await target.db.query<{r:string;s:number}>('SELECT revision_id::text r,thread_seq::int s FROM source_revision_positions ORDER BY 1');
      // the source is a database of schema 022 that nothing has numbered: the oracle does not run 023
      const defined=await before.db.query<{r:string;s:number}>(`SELECT r.id::text r, row_number() OVER (PARTITION BY r.tenant_id,r.project_id,e.chat_id,e.thread_key ORDER BY r.created_at,r.revision_no,r.id)::int s
        FROM source_event_revisions r JOIN source_events e ON e.id=r.source_event_id AND e.tenant_id=r.tenant_id AND e.project_id=r.project_id ORDER BY 1`);
      expect(defined.rows.length).toBe(6);
      expect(given.rows).toEqual(defined.rows);
      const heads=await target.db.query<{k:string;s:number}>('SELECT thread_key k,last_seq::int s FROM intake_thread_heads ORDER BY 1');
      const sizes=await before.db.query<{k:string;s:number}>('SELECT e.thread_key k,count(*)::int s FROM source_event_revisions r JOIN source_events e ON e.id=r.source_event_id GROUP BY 1 ORDER BY 1');
      expect(heads.rows).toEqual(sizes.rows);
    });
  });
});
