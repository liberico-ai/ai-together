import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {native,openHarness,type Harness} from './slice1-db';
import {member,pm,seedSlice1} from './slice1-fixtures';
import {aiPrincipal,frozenRevision,registerDoc,seedMembers} from './slice3-fixtures';
import {bridgeConfig,guardBlock,intakePrincipalId,messageEvent,rolledBack} from './slice2-fixtures';
import {assertRestrictedLogin,scoped,type Queryable} from '../src/server/db';
import {ids} from '../src/server/identities';
import {IntakeService} from '../src/server/intake';
import type {Principal} from '../src/server/types';

// Migration 021: the Z4 zone for AI drafts (schema intelligence), the Z1 table draft_decisions (a person's confirm or reject of a draft) and the role
// libetech_ai (NOLOGIN, granted to nobody, no login, no key). The AI role writes Z4 only and nothing else anywhere; only a person writes Z1.
// Runtime access goes through scoped() (SET LOCAL ROLE libetech_runtime); the AI role is assumed by SET LOCAL ROLE from the harness superuser.
let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);});
afterEach(async()=>{await h.reset();await h.close();});

type R=Record<string,unknown>;
const AI=aiPrincipal.id;
const HASH='a'.repeat(64),OTHER_HASH='b'.repeat(64);
const S=[ids.sales];
const rows=async<T=R>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const P=(id:string,projects:string[]):Principal=>({id,tenantId:ids.tenant,projectIds:projects,name:'Người mẫu',role:'manager'});
/** Runtime role in the scope of the given projects; app.person_id is set unless person is null. */
const asRuntime=<T>(person:string|null,projects:string[],fn:(tx:Queryable)=>Promise<T>)=>scoped(h.db,P(person??pm.id,projects),async tx=>{
  if(person) await tx.query("SELECT set_config('app.person_id',$1,true)",[person]);
  return fn(tx);
});
/** The AI role with the context of the pipeline: tenant, projects and its own principal id (principal null = not set). */
const asAi=<T>(fn:(tx:Queryable)=>Promise<T>,o:{tenant?:string;projects?:string[];principal?:string|null}={})=>h.operator.transaction(async tx=>{
  await tx.query('SET LOCAL ROLE libetech_ai');
  await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true)",[o.tenant??ids.tenant,(o.projects??S).join(',')]);
  if(o.principal!==null) await tx.query("SELECT set_config('app.ai_principal_id',$1,true)",[o.principal??AI]);
  return fn(tx);
});

const JSONB_COLUMNS=new Set(['value','sources','questions']);
// The default draft is about a document: migration 023 stores a confirmation of a candidate draft only when it names a real candidate and the position of its thread
// (candidateDraft below does that); a draft about a random candidate id could never be confirmed.
const draftVals=(over:R={}):R=>({tenant_id:ids.tenant,project_id:ids.sales,entity_type:'document',entity_id:randomUUID(),signal_type:'intake_analyst',
  skill_version:'1.0.0',manifest_hash:HASH,model_version:'synthetic-model',value:'{"summary":"mẫu"}',value_hash:HASH,sources:'[{"ref":"synthetic-source"}]',
  questions:'[]',confidence:50,input_hash:HASH,ai_principal_id:AI,trace_id:randomUUID(),dedupe_key:'draft-'+randomUUID(),...over});
const insertDraft=(tx:Queryable,over:R={})=>{
  const v=draftVals(over),keys=Object.keys(v);
  return tx.query<{id:string}>(`INSERT INTO intelligence.ai_drafts(${keys.join(',')}) VALUES(${keys.map((k,i)=>`$${i+1}${JSONB_COLUMNS.has(k)?'::jsonb':''}`).join(',')}) RETURNING id`,keys.map(k=>v[k]));
};
const seedDraft=async(over:R={})=>(await insertDraft(h.operator,over)).rows[0].id;
const decisionVals=(draft:string,over:R={}):R=>({tenant_id:ids.tenant,project_id:ids.sales,draft_id:draft,draft_value_hash:HASH,result:'confirmed',reason:'',
  decided_by:pm.id,command_key:'cmd-'+randomUUID(),request_id:randomUUID(),trace_id:randomUUID(),...over});
const insertDecision=(tx:Queryable,draft:string,over:R={})=>{
  const v=decisionVals(draft,over),keys=Object.keys(v);
  return tx.query<{id:string}>(`INSERT INTO draft_decisions(${keys.join(',')}) VALUES(${keys.map((_,i)=>`$${i+1}`).join(',')}) RETURNING id`,keys.map(k=>v[k]));
};
const decide=(draft:string,over:R={},person:string|null=pm.id)=>asRuntime(person,S,tx=>insertDecision(tx,draft,over));
/** A candidate draft about a candidate that the intake service really created, and the position of its thread: what a confirmation of it must carry (migration 023). */
const candidateDraft=async(over:R={})=>{
  const event=messageEvent({}),thread='m:'+event.context.messageId;
  await new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,bridgeConfig.intake!).ingest(event);
  const candidate=(await rows<{id:string}>('SELECT id FROM intake_candidates WHERE chat_id=$1 AND thread_key=$2',[event.context.chatId,thread]))[0].id;
  const position=(await rows<{n:number}>('SELECT last_seq::int n FROM intake_thread_heads WHERE chat_id=$1 AND thread_key=$2',[event.context.chatId,thread]))[0].n;
  return {draft:await seedDraft({entity_type:'intake_candidate',entity_id:candidate,...over}),candidate,position};
};

// ---- the boundary: what the AI role holds ----
const Z1_Z2_NAMED=['public.work_items','public.audit_events','public.document_records','public.document_revisions','public.review_decisions','public.review_comments',
  'public.review_delegations','public.draft_decisions','public.intake_candidates','public.outbox_messages','analytics.work_summary','analytics.document_index',
  'identity.users','identity.memberships'];

test('(4) the AI role cannot write any Z1 or Z2 table',async()=>{
  // every table that exists in public, identity and analytics, read from the catalog: a table added later is covered without editing this test
  const all=(await rows<{t:string;col:string}>(`SELECT n.nspname||'.'||c.relname t,
      (SELECT quote_ident(a.attname) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum LIMIT 1) col
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p') AND n.nspname IN ('public','identity','analytics') ORDER BY 1`));
  const names=all.map(r=>r.t);
  for(const t of Z1_Z2_NAMED) expect(names,'named table missing from the catalog: '+t).toContain(t);
  expect(names.length).toBeGreaterThanOrEqual(Z1_Z2_NAMED.length);
  await rolledBack(h.operator,async(tx,probe)=>{
    await tx.query('SET LOCAL ROLE libetech_ai');
    await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true),set_config('app.ai_principal_id',$3,true)",[ids.tenant,ids.sales,AI]);
    for(const {t,col} of all){
      const [schema,table]=t.split('.');
      const target=`${schema}.${/^[a-z_][a-z0-9_]*$/.test(table)?table:`"${table}"`}`;
      expect(await probe(`INSERT INTO ${target} DEFAULT VALUES`),'INSERT '+t).toMatch(/permission denied/);
      expect(await probe(`UPDATE ${target} SET ${col}=DEFAULT WHERE false`),'UPDATE '+t).toMatch(/permission denied/);
    }
    expect(await probe('SELECT * FROM public.document_approvers($1)',[ids.sales])).toMatch(/permission denied/);
    expect(await probe('SELECT * FROM public.bom_eligible_members($1,$2::uuid[])',[ids.sales,[pm.id]])).toMatch(/permission denied/);
  });
});

test('privilege query: libetech_ai holds no INSERT, UPDATE, DELETE or TRUNCATE on any table of public, identity or analytics',async()=>{
  const write=await rows<{t:string}>(`SELECT n.nspname||'.'||c.relname t FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p','v','m') AND n.nspname IN ('public','identity','analytics')
      AND (has_table_privilege('libetech_ai',c.oid,'INSERT') OR has_table_privilege('libetech_ai',c.oid,'UPDATE')
        OR has_table_privilege('libetech_ai',c.oid,'DELETE') OR has_table_privilege('libetech_ai',c.oid,'TRUNCATE')
        OR has_any_column_privilege('libetech_ai',c.oid,'INSERT') OR has_any_column_privilege('libetech_ai',c.oid,'UPDATE'))`);
  expect(write).toEqual([]);
  // nor does it read any of them (S14)
  const read=await rows<{t:string}>(`SELECT n.nspname||'.'||c.relname t FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p','v','m') AND n.nspname IN ('public','identity','analytics')
      AND (has_table_privilege('libetech_ai',c.oid,'SELECT') OR has_any_column_privilege('libetech_ai',c.oid,'SELECT'))`);
  expect(read).toEqual([]);
  // REFERENCES and TRIGGER are not granted there either
  const other=await rows<{t:string}>(`SELECT n.nspname||'.'||c.relname t FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p','v','m') AND n.nspname IN ('public','identity','analytics')
      AND (has_table_privilege('libetech_ai',c.oid,'REFERENCES') OR has_table_privilege('libetech_ai',c.oid,'TRIGGER'))`);
  expect(other).toEqual([]);
  // in the Z4 schema exactly SELECT and INSERT, on the draft table only
  // INSERT is granted by column, so it is read from the column privileges as well as the table privilege
  const z4=(await rows<{t:string;p:string;ok:boolean}>(`SELECT n.nspname||'.'||c.relname t,p.p,
      (has_table_privilege('libetech_ai',c.oid,p.p) OR (p.p IN ('INSERT','UPDATE','SELECT') AND has_any_column_privilege('libetech_ai',c.oid,p.p))) ok
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(p)
    WHERE n.nspname='intelligence' AND c.relkind IN ('r','p','v','m') ORDER BY 1,2`));
  expect([...new Set(z4.map(r=>r.t))]).toEqual(['intelligence.ai_drafts']);
  expect(z4.filter(r=>r.ok).map(r=>r.p).sort()).toEqual(['INSERT','SELECT']);
  expect((await rows<{s:string}>(`SELECT has_schema_privilege('libetech_ai','intelligence','USAGE')::text s`))[0].s).toBe('true');
  expect((await rows<{s:string}>(`SELECT has_schema_privilege('libetech_ai','intelligence','CREATE')::text s`))[0].s).toBe('false');
  // the AI role owns nothing and can create nothing in the application schemas
  for(const schema of ['public','identity','analytics','intelligence'])
    expect((await rows<{s:string}>('SELECT has_schema_privilege($1,$2,$3)::text s',['libetech_ai',schema,'CREATE']))[0].s,schema).toBe('false');
  expect(await rows(`SELECT 1 FROM pg_class c WHERE c.relowner=(SELECT oid FROM pg_roles WHERE rolname='libetech_ai')`)).toEqual([]);
});

test('nothing reaches libetech_ai by default: no default ACL, no usable sequence, no CREATE on a schema or on the database',async()=>{
  // a default privilege entry that names the AI role or PUBLIC (grantee empty) would hand it every table created later
  expect(await rows(`SELECT d.defaclnamespace FROM pg_default_acl d, aclexplode(d.defaclacl) a
    WHERE (a.grantee=0 OR a.grantee=(SELECT oid FROM pg_roles WHERE rolname='libetech_ai'))
      AND (d.defaclnamespace=0 OR d.defaclnamespace IN (SELECT oid FROM pg_namespace WHERE nspname IN ('public','identity','analytics','intelligence')))`)).toEqual([]);
  expect(await rows<{s:string}>(`SELECT n.nspname||'.'||c.relname s FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='S' AND (has_sequence_privilege('libetech_ai',c.oid,'USAGE') OR has_sequence_privilege('libetech_ai',c.oid,'SELECT') OR has_sequence_privilege('libetech_ai',c.oid,'UPDATE'))`)).toEqual([]);
  for(const schema of ['public','identity','analytics','intelligence'])
    expect((await rows<{s:string}>('SELECT has_schema_privilege($1,$2,$3)::text s',['libetech_ai',schema,'CREATE']))[0].s,schema).toBe('false');
  expect((await rows<{s:string}>("SELECT has_database_privilege('libetech_ai',current_database(),'CREATE')::text s"))[0].s).toBe('false');
});

test('no SECURITY DEFINER function is executable by libetech_ai',async()=>{
  const exposed=await rows<{f:string}>(`SELECT n.nspname||'.'||p.proname f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE p.prosecdef AND has_function_privilege('libetech_ai',p.oid,'EXECUTE')`);
  expect(exposed).toEqual([]);
});

test('the role exists as NOLOGIN, without elevated attributes, with no member and in no role',async()=>{
  const r=(await rows<R>(`SELECT rolcanlogin,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication,rolinherit,
    EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.roleid=r.oid) has_member,EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member=r.oid) is_member,
    (SELECT x.rolpassword IS NULL FROM pg_authid x WHERE x.oid=r.oid) AS no_password_hash
    FROM pg_roles r WHERE rolname='libetech_ai'`))[0];
  expect(r).toMatchObject({rolcanlogin:false,rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,has_member:false,is_member:false,no_password_hash:true});
  // no login can reach it, whatever its name
  expect(await rows(`SELECT m.member FROM pg_auth_members m JOIN pg_roles a ON a.rolname='libetech_ai' WHERE m.roleid=a.oid`)).toEqual([]);
});

// ---- the draft table ----
test('the AI role writes drafts only inside its tenant, project and principal',async()=>{
  const ok=await asAi(tx=>insertDraft(tx));
  expect(ok.rows).toHaveLength(1);
  const seen=await asAi(tx=>tx.query('SELECT id FROM intelligence.ai_drafts'));
  expect(seen.rows.map(r=>(r as {id:string}).id)).toEqual([ok.rows[0].id]);
  const RLS=/row-level security|permission denied/;
  // another tenant, a project outside the context, a principal other than the one the pipeline runs as, and no principal at all
  await expect(asAi(tx=>insertDraft(tx,{tenant_id:ids.otherTenant}))).rejects.toThrow(RLS);
  await expect(asAi(tx=>insertDraft(tx,{project_id:ids.transport}))).rejects.toThrow(RLS);
  await expect(asAi(tx=>insertDraft(tx,{project_id:ids.sales}),{projects:[ids.transport]})).rejects.toThrow(RLS);
  await expect(asAi(tx=>insertDraft(tx,{ai_principal_id:randomUUID()}))).rejects.toThrow(RLS);
  await expect(asAi(tx=>insertDraft(tx),{principal:randomUUID()})).rejects.toThrow(RLS);
  await expect(asAi(tx=>insertDraft(tx),{principal:null})).rejects.toThrow(RLS);
  await expect(asAi(tx=>insertDraft(tx),{tenant:ids.otherTenant})).rejects.toThrow(RLS);
  // the AI role reads its own scope only
  await seedDraft({project_id:ids.transport});
  expect((await asAi(tx=>tx.query('SELECT 1 FROM intelligence.ai_drafts WHERE project_id=$1',[ids.transport]))).rows).toHaveLength(0);
  expect((await asAi(tx=>tx.query('SELECT 1 FROM intelligence.ai_drafts WHERE project_id=$1',[ids.transport]),{projects:[ids.transport]})).rows).toHaveLength(1);
  // one dedupe key per tenant
  const key='draft-dedupe-0001';
  await asAi(tx=>insertDraft(tx,{dedupe_key:key}));
  await expect(asAi(tx=>insertDraft(tx,{dedupe_key:key}))).rejects.toThrow(/duplicate key|unique/);
});

test('drafts return nothing without RLS context',async()=>{
  await seedDraft();
  const bare=await h.operator.transaction(async tx=>{await tx.query('SET LOCAL ROLE libetech_ai');return (await tx.query('SELECT 1 FROM intelligence.ai_drafts')).rows;});
  expect(bare).toEqual([]);
  const projectOnly=await h.operator.transaction(async tx=>{
    await tx.query('SET LOCAL ROLE libetech_ai');
    await tx.query("SELECT set_config('app.tenant_id',$1,true)",[ids.tenant]);
    return (await tx.query('SELECT 1 FROM intelligence.ai_drafts')).rows;
  });
  expect(projectOnly).toEqual([]);
  const runtimeBare=await h.operator.transaction(async tx=>{await tx.query('SET LOCAL ROLE libetech_runtime');return (await tx.query('SELECT 1 FROM intelligence.ai_drafts')).rows;});
  expect(runtimeBare).toEqual([]);
  await expect(h.operator.transaction(async tx=>{await tx.query('SET LOCAL ROLE libetech_ai');return insertDraft(tx);})).rejects.toThrow(/row-level security/);
  expect((await asRuntime(null,[ids.transport],tx=>tx.query('SELECT 1 FROM intelligence.ai_drafts'))).rows).toHaveLength(0);
  expect((await asRuntime(null,S,tx=>tx.query('SELECT 1 FROM intelligence.ai_drafts'))).rows).toHaveLength(1);
});

test('draft decisions are invisible to another project, another tenant and a session with no context',async()=>{
  const draft=await seedDraft();
  await decide(draft);
  // control: the scope that owns the row sees exactly it
  expect((await asRuntime(pm.id,S,tx=>tx.query('SELECT 1 FROM draft_decisions'))).rows).toHaveLength(1);
  // catches removal of the project_id = ANY(app.project_ids) clause of runtime_select
  expect((await asRuntime(pm.id,[ids.transport],tx=>tx.query('SELECT 1 FROM draft_decisions'))).rows).toHaveLength(0);
  // catches removal of the tenant_id clause of runtime_select: the sales project id is in the context, the tenant is not the row's
  const otherTenant={...P(pm.id,S),tenantId:ids.otherTenant};
  expect((await scoped(h.db,otherTenant,tx=>tx.query('SELECT 1 FROM draft_decisions'))).rows).toHaveLength(0);
  // catches a missing_ok-less current_setting (an error instead of fail-closed) and a policy that passes when the setting is absent
  const bare=await h.operator.transaction(async tx=>{await tx.query('SET LOCAL ROLE libetech_runtime');return (await tx.query('SELECT 1 FROM draft_decisions')).rows;});
  expect(bare).toEqual([]);
});

test('the table is a backstop at 49 152 bytes of stored text: the densest value that fits the application limit is stored, a larger one is refused',async()=>{
  const dense=JSON.stringify(Array(16383).fill(0));
  expect(dense.length).toBe(32767);
  const id=await asAi(async tx=>(await insertDraft(tx,{value:dense})).rows[0].id);
  const stored=(await rows<{n:number}>('SELECT octet_length(value::text) n FROM intelligence.ai_drafts WHERE id=$1',[id]))[0].n;
  expect(stored).toBe(49149);
  expect(stored).toBeLessThanOrEqual(49152);
  const big=JSON.stringify(Array(16385).fill(0));
  await expect(asAi(tx=>insertDraft(tx,{value:big}))).rejects.toThrow(/check constraint|ai_drafts_value/);
  // a multi-byte value is counted in bytes, not characters
  const wide=JSON.stringify({a:'é'.repeat(25000)});
  expect(wide.length).toBeLessThan(49152);
  await expect(asAi(tx=>insertDraft(tx,{value:wide}))).rejects.toThrow(/check constraint|ai_drafts_value/);
});

test('a confirmation can only attach a revision of the very document the draft is about',async()=>{
  const docA=await registerDoc(h,pm),docB=await registerDoc(h,pm);
  const revA=await frozenRevision(h,docA.record.id,member.id),revB=await frozenRevision(h,docB.record.id,member.id);
  const ATTACH=/attached to a draft about that very document/;
  const about=(id:string)=>seedDraft({entity_type:'document',entity_id:id});
  // a revision of document B on a draft about A (same project), also when the decision is a rejection that carries none of it by CHECK
  await expect(decide(await about(docA.record.id),{document_revision_id:revB.revisionId})).rejects.toThrow(ATTACH);
  // an intake-candidate draft takes no revision at all
  const candidate=await seedDraft({entity_type:'intake_candidate',entity_id:docA.record.id});
  await expect(decide(candidate,{document_revision_id:revA.revisionId})).rejects.toThrow(ATTACH);
  await expect(decide(await about(randomUUID()),{document_revision_id:revA.revisionId})).rejects.toThrow(ATTACH);
  // the operational login is stopped as well
  await expect(insertDecision(h.operator,await about(docA.record.id),{document_revision_id:revB.revisionId})).rejects.toThrow(ATTACH);
  expect(await rows('SELECT 1 FROM draft_decisions')).toHaveLength(0);
  // a revision of A on a draft about A, and no revision at all, are accepted
  await expect(decide(await about(docA.record.id),{document_revision_id:revA.revisionId})).resolves.toBeTruthy();
  // a candidate draft takes no revision and is confirmed with none: since 023 that needs a real candidate and the position of its thread, which `candidate` above
  // (a draft that names a document id as its candidate) cannot have
  const real=await candidateDraft();
  await expect(decide(real.draft,{subject_thread_seq:real.position})).resolves.toBeTruthy();
});

test('the guards of 021 still fire on a candidate draft of a real candidate, before the guard of 023; with every guard satisfied it is stored and the column carries the position',async()=>{
  const a=await candidateDraft(),unsourced=await candidateDraft({sources:'[]'});
  // the decision carries the right position each time: only the guard of 021 can be what refuses it
  await expect(decide(a.draft,{draft_value_hash:OTHER_HASH,subject_thread_seq:a.position})).rejects.toThrow(/value hash/);
  await expect(decide(unsourced.draft,{subject_thread_seq:unsourced.position})).rejects.toThrow(/names no source/);
  await expect(decide(a.draft,{document_revision_id:randomUUID(),subject_thread_seq:a.position})).rejects.toThrow(/attached to a draft about that very document/);
  // and with no position at all the answer is still the one of 021, not the refusal of 023 (BEFORE triggers answer first)
  await expect(decide(a.draft,{draft_value_hash:OTHER_HASH})).rejects.toThrow(/value hash/);
  await expect(insertDecision(h.operator,unsourced.draft,{subject_thread_seq:unsourced.position})).rejects.toThrow(/names no source/);
  expect(await rows('SELECT 1 FROM draft_decisions')).toHaveLength(0);
  await expect(decide(a.draft,{subject_thread_seq:a.position})).resolves.toBeTruthy();
  expect((await rows<{s:number}>('SELECT subject_thread_seq::int s FROM draft_decisions WHERE draft_id=$1',[a.draft]))[0].s).toBe(a.position);
});

test('sources, questions and version strings carry database backstops, in a form that never calls an array function on a non-array',async()=>{
  const refused=async(over:R)=>{await expect(asAi(tx=>insertDraft(tx,over)),JSON.stringify(over).slice(0,60)).rejects.toThrow(/check constraint|ai_drafts_/);};
  const list=(n:number,item:unknown)=>JSON.stringify(Array(n).fill(item));
  await expect(asAi(tx=>insertDraft(tx,{sources:list(100,1)}))).resolves.toBeTruthy();
  await refused({sources:list(101,1)});
  await refused({sources:JSON.stringify([{ref:'x'.repeat(65536)}])});
  await expect(asAi(tx=>insertDraft(tx,{questions:list(50,1)}))).resolves.toBeTruthy();
  await refused({questions:list(51,1)});
  await refused({questions:JSON.stringify(['x'.repeat(16384)])});
  await refused({sources:'{"a":1}'});await refused({questions:'"text"'});
  for(const n of [1,64]) await expect(asAi(tx=>insertDraft(tx,{skill_version:'v'.repeat(n),model_version:'m'.repeat(n)}))).resolves.toBeTruthy();
  await refused({skill_version:''});await refused({skill_version:'v'.repeat(65)});
  await refused({model_version:''});await refused({model_version:'m'.repeat(65)});
});

test('draft columns carry their own bounds: closed vocabularies, hash and key formats, array types, confidence 0 to 100',async()=>{
  const refused=async(over:R)=>{await expect(asAi(tx=>insertDraft(tx,over)),JSON.stringify(over).slice(0,80)).rejects.toThrow(/check constraint|violates|invalid input/);};
  await refused({entity_type:'work_item'});
  await refused({signal_type:'other_skill'});
  await refused({manifest_hash:'A'.repeat(64)});await refused({manifest_hash:'a'.repeat(63)});
  await refused({value_hash:'zz'});await refused({input_hash:'a'.repeat(65)});
  await refused({dedupe_key:'short'});await refused({dedupe_key:'has space in it'});await refused({dedupe_key:'x'.repeat(101)});
  await refused({confidence:-1});await refused({confidence:101});
  // a non-array never reaches an array function
  await refused({sources:'{"a":1}'});await refused({questions:'"text"'});await refused({sources:'null'});
  for(const bound of [0,100]) await expect(asAi(tx=>insertDraft(tx,{confidence:bound}))).resolves.toBeTruthy();
  for(const t of ['intake_candidate','document']) await expect(asAi(tx=>insertDraft(tx,{entity_type:t}))).resolves.toBeTruthy();
  for(const s of ['intake_analyst','ba_elicitation','pm_planning','technical_writer','doc_reviewer','release_librarian'])
    await expect(asAi(tx=>insertDraft(tx,{signal_type:s}))).resolves.toBeTruthy();
  // the scoped foreign key: a project that is not the tenant's
  await expect(h.operator.query(`INSERT INTO intelligence.ai_drafts(tenant_id,project_id,entity_type,entity_id,signal_type,skill_version,manifest_hash,model_version,value,value_hash,confidence,input_hash,ai_principal_id,trace_id,dedupe_key)
    VALUES($1,$2,'document',$3,'doc_reviewer','1',$4,'m','{}',$4,1,$4,$5,$3,'draft-fk-0001')`,[ids.otherTenant,ids.sales,randomUUID(),HASH,AI])).rejects.toThrow(/foreign key/);
});

test('drafts and draft decisions reject update and delete',async()=>{
  const draft=await seedDraft();
  const decision=(await decide(draft)).rows[0].id;
  // the operational login (superuser) is stopped by the trigger, every other role by missing privileges
  await expect(h.operator.query("UPDATE intelligence.ai_drafts SET model_version='x' WHERE id=$1",[draft])).rejects.toThrow(/Append-only/);
  await expect(h.operator.query('DELETE FROM intelligence.ai_drafts WHERE id=$1',[draft])).rejects.toThrow(/Append-only/);
  await expect(h.operator.query("UPDATE draft_decisions SET reason='x' WHERE id=$1",[decision])).rejects.toThrow(/Append-only/);
  await expect(h.operator.query('DELETE FROM draft_decisions WHERE id=$1',[decision])).rejects.toThrow(/Append-only/);
  await expect(asAi(tx=>tx.query("UPDATE intelligence.ai_drafts SET model_version='x'"))).rejects.toThrow(/permission denied/);
  await expect(asAi(tx=>tx.query('DELETE FROM intelligence.ai_drafts'))).rejects.toThrow(/permission denied/);
  await expect(asRuntime(pm.id,S,tx=>tx.query("UPDATE draft_decisions SET reason='x'"))).rejects.toThrow(/permission denied/);
  await expect(asRuntime(pm.id,S,tx=>tx.query('DELETE FROM draft_decisions'))).rejects.toThrow(/permission denied/);
  expect(await rows('SELECT 1 FROM intelligence.ai_drafts')).toHaveLength(1);
  expect(await rows('SELECT 1 FROM draft_decisions')).toHaveLength(1);
});

test('runtime reads drafts but cannot insert, update or delete them',async()=>{
  const draft=await seedDraft();
  expect((await asRuntime(null,S,tx=>tx.query('SELECT id FROM intelligence.ai_drafts'))).rows).toHaveLength(1);
  await expect(asRuntime(pm.id,S,tx=>insertDraft(tx))).rejects.toThrow(/permission denied/);
  await expect(asRuntime(pm.id,S,tx=>tx.query("UPDATE intelligence.ai_drafts SET model_version='x' WHERE id=$1",[draft]))).rejects.toThrow(/permission denied/);
  await expect(asRuntime(pm.id,S,tx=>tx.query('DELETE FROM intelligence.ai_drafts WHERE id=$1',[draft]))).rejects.toThrow(/permission denied/);
  // the intake and identity roles hold nothing on either new table
  for(const role of ['libetech_intake','libetech_identity']){
    for(const table of ['intelligence.ai_drafts','public.draft_decisions'])
      for(const p of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'])
        expect((await rows<{ok:boolean}>('SELECT has_table_privilege($1,$2,$3) ok',[role,table,p]))[0].ok,`${role} ${p} ${table}`).toBe(false);
    expect((await rows<{ok:boolean}>('SELECT has_schema_privilege($1,$2,$3) ok',[role,'intelligence','USAGE']))[0].ok,role).toBe(false);
  }
});

test('column-level grants: ids and timestamps come from defaults; nothing is granted outside the named columns',async()=>{
  const cols=async(role:string,table:string,priv:string)=>(await rows<{c:string}>(
    `SELECT a.attname c FROM pg_attribute a WHERE a.attrelid=$2::regclass AND a.attnum>0 AND NOT a.attisdropped
      AND has_column_privilege($1,a.attrelid,a.attnum,$3) ORDER BY 1`,[role,table,priv])).map(r=>r.c);
  const all=async(table:string)=>(await rows<{c:string}>('SELECT attname c FROM pg_attribute WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped ORDER BY 1',[table])).map(r=>r.c);
  const draftInsert=(await all('intelligence.ai_drafts')).filter(c=>!['id','created_at','updated_at'].includes(c));
  expect(await cols('libetech_ai','intelligence.ai_drafts','INSERT')).toEqual(draftInsert);
  expect(await cols('libetech_ai','intelligence.ai_drafts','UPDATE')).toEqual([]);
  expect(await cols('libetech_runtime','intelligence.ai_drafts','INSERT')).toEqual([]);
  expect(await cols('libetech_runtime','intelligence.ai_drafts','UPDATE')).toEqual([]);
  const decisionInsert=(await all('public.draft_decisions')).filter(c=>!['id','created_at','updated_at'].includes(c));
  expect(await cols('libetech_runtime','public.draft_decisions','INSERT')).toEqual(decisionInsert);
  expect(await cols('libetech_runtime','public.draft_decisions','UPDATE')).toEqual([]);
  expect(await cols('libetech_ai','public.draft_decisions','INSERT')).toEqual([]);
  expect(await cols('libetech_ai','public.draft_decisions','SELECT')).toEqual([]);
  // an explicit id or timestamp is refused to the roles that write
  await expect(asAi(tx=>insertDraft(tx,{id:randomUUID()}))).rejects.toThrow(/permission denied/);
  await expect(asAi(tx=>insertDraft(tx,{created_at:'2000-01-01T00:00:00Z'}))).rejects.toThrow(/permission denied/);
  const draft=await seedDraft();
  await expect(decide(draft,{id:randomUUID()})).rejects.toThrow(/permission denied/);
  await expect(decide(draft,{created_at:'2000-01-01T00:00:00Z'})).rejects.toThrow(/permission denied/);
});

// ---- the decision table: only a person writes Z1 ----
test('the AI role has no privilege on draft_decisions at all',async()=>{
  const draft=await seedDraft();
  await expect(asAi(tx=>insertDecision(tx,draft))).rejects.toThrow(/permission denied/);
  await expect(asAi(tx=>tx.query('SELECT 1 FROM draft_decisions'))).rejects.toThrow(/permission denied/);
  await expect(asAi(tx=>tx.query('UPDATE draft_decisions SET reason=reason'))).rejects.toThrow(/permission denied/);
  await expect(asAi(tx=>tx.query('DELETE FROM draft_decisions'))).rejects.toThrow(/permission denied/);
});

test('runtime cannot confirm a draft that names no source, nor with a wrong value hash; a decision is bound to the acting person; one decision per draft',async()=>{
  const doc=await registerDoc(h,pm);
  const fr=await frozenRevision(h,doc.record.id,member.id);
  const sourced=await seedDraft({entity_type:'document',entity_id:doc.record.id}),unsourced=await seedDraft({sources:'[]'});
  // a draft that names no source cannot be confirmed (DOC-05 at the database), but it can be rejected with a reason
  await expect(decide(unsourced)).rejects.toThrow(/names no source/);
  await expect(decide(unsourced,{result:'rejected',reason:'Không đủ căn cứ'})).resolves.toBeTruthy();
  // the hash the person saw must be the hash of the stored draft
  await expect(decide(sourced,{draft_value_hash:OTHER_HASH})).rejects.toThrow(/value hash/);
  await expect(decide(sourced,{draft_value_hash:OTHER_HASH,result:'rejected',reason:'Không đúng bản nháp'})).rejects.toThrow(/value hash/);
  // bound to the acting person
  await expect(decide(sourced,{decided_by:randomUUID()})).rejects.toThrow(/row-level security/);
  await expect(decide(sourced,{decided_by:member.id})).rejects.toThrow(/row-level security/);
  await expect(decide(sourced,{},null)).rejects.toThrow(/row-level security/);
  // scope
  await expect(asRuntime(pm.id,[ids.transport],tx=>insertDecision(tx,sourced,{project_id:ids.transport}))).rejects.toThrow(/names a draft of its own project|row-level security/);
  await expect(decide(sourced,{tenant_id:ids.otherTenant})).rejects.toThrow(/names a draft of its own project|row-level security/);
  // shape: a rejection needs a reason, a rejection names no revision
  await expect(decide(sourced,{result:'rejected',reason:'ngắn'})).rejects.toThrow(/check constraint|draft_decisions/);
  await expect(decide(sourced,{result:'rejected',reason:'     ',document_revision_id:null})).rejects.toThrow(/check constraint|draft_decisions/);
  await expect(decide(sourced,{result:'rejected',reason:'Lý do đủ dài',document_revision_id:fr.revisionId})).rejects.toThrow(/draft_decisions_revision_only_confirmed/);
  await expect(decide(sourced,{result:'maybe'})).rejects.toThrow(/check constraint|draft_decisions/);
  await expect(decide(sourced,{reason:'x'.repeat(1001)})).rejects.toThrow(/check constraint|draft_decisions/);
  // a revision that does not exist is refused by the guard (before the foreign key); a real revision of the draft's document is accepted
  await expect(decide(sourced,{document_revision_id:randomUUID()})).rejects.toThrow(/attached to a draft about that very document/);
  expect(await rows('SELECT 1 FROM draft_decisions WHERE draft_id=$1',[sourced])).toHaveLength(0);
  await expect(decide(sourced,{document_revision_id:fr.revisionId})).resolves.toBeTruthy();
  // one decision per draft, whatever the result
  await expect(decide(sourced,{command_key:'cmd-other'})).rejects.toThrow(/duplicate key|unique/);
  await expect(decide(sourced,{result:'rejected',reason:'Quyết định thứ hai'})).rejects.toThrow(/duplicate key|unique/);
  const stored=(await rows<R>('SELECT draft_value_hash,result,decided_by FROM draft_decisions WHERE draft_id=$1',[sourced]))[0];
  expect(stored).toEqual({draft_value_hash:HASH,result:'confirmed',decided_by:pm.id});
  // a decision cannot name a draft that does not exist
  await expect(decide(randomUUID())).rejects.toThrow(/names a draft of its own project/);
});

test('a decision is refused for a draft of another project even when the decision names the right ids',async()=>{
  const other=await seedDraft({project_id:ids.transport});
  await expect(decide(other)).rejects.toThrow(/names a draft of its own project/);
  expect(await rows('SELECT 1 FROM draft_decisions')).toHaveLength(0);
});

test('the decision guard also stops the operational login',async()=>{
  const unsourced=await seedDraft({sources:'[]'}),sourced=await seedDraft();
  await expect(insertDecision(h.operator,unsourced)).rejects.toThrow(/names no source/);
  await expect(insertDecision(h.operator,sourced,{draft_value_hash:OTHER_HASH})).rejects.toThrow(/value hash/);
  await expect(insertDecision(h.operator,sourced)).resolves.toBeTruthy();
});

// ---- guards of the migration itself ----
const F='021_ai_suggestions_z4.sql';
const DUAL='libetech_test_dual_member';
test('021 refuses an AI role that has a member, is a member of a role, or can log in',async()=>{
  const g=await guardBlock(F,'ai-role');
  const MESSAGE=/libetech_ai must have no members and be a member of no role/;
  await rolledBack(h.operator,async(_tx,probe)=>{expect(await probe(g)).toBeNull();});
  const ROLE='ALTER '+'ROLE';
  for(const setup of [`${ROLE} libetech_ai LOGIN`,`${ROLE} libetech_ai SUPERUSER`,`${ROLE} libetech_ai BYPASSRLS`,`${ROLE} libetech_ai CREATEDB`,`${ROLE} libetech_ai CREATEROLE`,`${ROLE} libetech_ai REPLICATION`])
    await rolledBack(h.operator,async(tx,probe)=>{await tx.query(setup);expect(await probe(g),setup).toMatch(/libetech_ai must be NOLOGIN/);});
  await rolledBack(h.operator,async(tx,probe)=>{
    await tx.query(`CREATE ROLE ${DUAL} NOLOGIN`);
    await tx.query(`GRANT libetech_ai TO ${DUAL}`);
    expect(await probe(g)).toMatch(/libetech_ai must have no members and be a member of no role/);
  });
  await rolledBack(h.operator,async(tx,probe)=>{
    await tx.query(`CREATE ROLE ${DUAL} NOLOGIN`);
    await tx.query(`GRANT ${DUAL} TO libetech_ai`);
    expect(await probe(g)).toMatch(/libetech_ai must have no members and be a member of no role/);
  });
  await rolledBack(h.operator,async(tx,probe)=>{
    await tx.query('GRANT libetech_runtime TO libetech_ai');
    expect(await probe(g)).toMatch(MESSAGE);
  });
});

test('a restricted login that can reach libetech_ai refuses to start',async()=>{
  const as=async(tx:Queryable,role:string)=>{
    await tx.query('SAVEPOINT login');
    await tx.query(`SET LOCAL ROLE ${role}`);
    const r=await assertRestrictedLogin(tx).then(()=>null,(e:Error)=>e.message);
    await tx.query('ROLLBACK TO SAVEPOINT login');
    return r;
  };
  const REFUSED=/must not own tables, hold elevated database privileges or reach more than one application role/;
  await rolledBack(h.operator,async tx=>{
    // the three logins in use stay accepted
    for(const login of ['libetech_web','libetech_auth','libetech_intake_svc']) expect(await as(tx,login),login).toBeNull();
    // the AI role itself is not a login the service may run as
    expect(await as(tx,'libetech_ai')).toMatch(REFUSED);
  });
  await rolledBack(h.operator,async tx=>{
    await tx.query(`CREATE ROLE ${DUAL} LOGIN NOINHERIT`);
    expect(await as(tx,DUAL)).toBeNull();
    await tx.query(`GRANT libetech_ai TO ${DUAL}`);
    expect(await as(tx,DUAL)).toMatch(REFUSED);
  });
  await rolledBack(h.operator,async tx=>{
    // alone with the web role it is also refused: one app role plus the AI role
    await tx.query(`CREATE ROLE ${DUAL} LOGIN NOINHERIT`);
    await tx.query(`GRANT libetech_runtime, libetech_ai TO ${DUAL}`);
    expect(await as(tx,DUAL)).toMatch(REFUSED);
  });
  await rolledBack(h.operator,async tx=>{
    // a login that owns a Z4 table is refused like one that owns a Z1 table
    await tx.query(`CREATE ROLE ${DUAL} LOGIN NOINHERIT`);
    await tx.query(`ALTER TABLE intelligence.ai_drafts OWNER TO ${DUAL}`);
    expect(await as(tx,DUAL)).toMatch(REFUSED);
  });
});

describe.skipIf(!native)('the AI role on PostgreSQL',()=>{
  test('the web login cannot assume the AI role',async()=>{
    await expect(h.db.transaction(async tx=>{await tx.query('SET ROLE libetech_ai');})).rejects.toThrow(/permission denied to set role|must be member/);
    // and it still reaches the runtime role it is meant to
    await expect(h.db.transaction(async tx=>{await tx.query('SET LOCAL ROLE libetech_runtime');})).resolves.toBeUndefined();
  });
  test('the web login reads drafts through the runtime role and cannot write them',async()=>{
    await seedDraft();
    expect((await asRuntime(null,S,tx=>tx.query('SELECT 1 FROM intelligence.ai_drafts'))).rows).toHaveLength(1);
    await expect(asRuntime(pm.id,S,tx=>insertDraft(tx))).rejects.toThrow(/permission denied/);
  });
});

test('running 021 again changes nothing: one trigger, one function, the same policies and grants',async()=>{
  const sql=await readFile(path.join(process.cwd(),'migrations',F),'utf8');
  const shape=async()=>({
    policies:await rows('SELECT schemaname,tablename,policyname,roles::text r,cmd,qual,with_check FROM pg_policies WHERE schemaname IN (\'public\',\'intelligence\') AND tablename IN (\'ai_drafts\',\'draft_decisions\') ORDER BY 1,2,3'),
    triggers:await rows(`SELECT tgrelid::regclass::text t,tgname FROM pg_trigger WHERE NOT tgisinternal AND tgname NOT IN ('ai_drafts_pointer_only_guard','ai_drafts_declared_scope_guard','draft_decisions_pointer_only_guard','draft_decisions_subject_order_guard') AND tgrelid IN ('intelligence.ai_drafts'::regclass,'public.draft_decisions'::regclass) ORDER BY 1,2`),
    functions:await rows(`SELECT proname,prosecdef,proconfig::text c FROM pg_proc WHERE proname='draft_decisions_guard'`),
    acl:await rows(`SELECT relname,relacl::text a,relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid IN ('intelligence.ai_drafts'::regclass,'public.draft_decisions'::regclass) ORDER BY 1`),
    columns:await rows(`SELECT attrelid::regclass::text t,attname,attacl::text a FROM pg_attribute WHERE attrelid IN ('intelligence.ai_drafts'::regclass,'public.draft_decisions'::regclass) AND attnum>0 AND NOT attisdropped ORDER BY 1,2`),
    indexes:await rows(`SELECT indexname FROM pg_indexes WHERE schemaname IN ('public','intelligence') AND tablename IN ('ai_drafts','draft_decisions') ORDER BY 1`),
    migrations:await rows(`SELECT version FROM schema_migrations WHERE version='021'`),
  });
  const before=await shape();
  expect(before.triggers).toHaveLength(3);
  expect(before.functions).toHaveLength(1);
  await h.exec(sql);await h.exec(sql);
  expect(await shape()).toEqual(before);
  expect(sql.replace(/--.*$/gm,'')).not.toMatch(/\bINSERT INTO (?!schema_migrations)/i);
  const lines=sql.trimEnd().split('\n');
  expect(lines.pop()).toBe('COMMIT;');
  expect(lines.pop()).toBe("INSERT INTO schema_migrations(version) VALUES('021') ON CONFLICT(version) DO NOTHING;");
});

test('the migration file pins the search_path of its function and creates no login',async()=>{
  const sql=(await readFile(path.join(process.cwd(),'migrations',F),'utf8')).replace(/--.*$/gm,'');
  expect(sql).toMatch(/CREATE ROLE libetech_ai NOLOGIN NOSUPERUSER NOBYPASSRLS/);
  expect(sql).not.toMatch(/CREATE ROLE (?!libetech_ai\b)/i);
  expect(sql).not.toMatch(/\bPASSWORD\b/i);
  expect(sql).not.toMatch(/GRANT\s+libetech_ai\s+TO/i);
  const fn=await rows<{secdef:boolean;config:string[]|null}>("SELECT prosecdef secdef,proconfig config FROM pg_proc WHERE proname='draft_decisions_guard'");
  expect(fn).toHaveLength(1);
  expect(fn[0].secdef).toBe(false);
  expect((fn[0].config??[]).join(' ')).toMatch(/search_path=pg_catalog/);
});
