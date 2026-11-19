import {randomUUID} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {expect,test} from 'vitest';
import {openHarness} from './slice1-db';
import {seedSlice1} from './slice1-fixtures';
import {ids} from '../src/server/identities';
import {member,pm} from './slice1-fixtures';
import {approver,delegate,frozenRevision,grantDocApproval,registerDoc,reviewer,seedMembers} from './slice3-fixtures';

const dir=(p:string)=>path.join(process.cwd(),p);
const sqlFiles=async(p:string)=>(await readdir(dir(p))).filter(f=>/^\d+.*\.sql$/.test(f)).sort();
const num=(f:string)=>Number(f.match(/^\d+/)![0]);
const from013=async()=>(await sqlFiles('migrations')).filter(f=>num(f)>=13);

test('every migration from 013 has a rollback file with the same name',async()=>{
  const forward=await from013();
  expect(forward.length).toBeGreaterThan(0);
  const rollback=await sqlFiles('migrations/rollback');
  for(const f of forward) expect(rollback).toContain(f);
  expect(rollback.filter(f=>num(f)<13)).toEqual([]);
});

test('forward → rollback → forward leaves source tables untouched',async()=>{
  const h=await openHarness();
  try {
    await h.reset();
    await seedSlice1(h);
    const hash='a'.repeat(64);
    await h.operator.transaction(async tx=>{
      await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true)",[ids.tenant,ids.sales]);
      for(const row of [2,3]) await tx.query(`INSERT INTO analytics.tech_source_tasks(tenant_id,project_id,source_id,source_row,stt,source_ref,snapshot_hash,fingerprint,title,source_status)
        VALUES($1,$2,'synthetic-src',$3,$4,$5,$6,$7,$8,'Đang làm')`,[ids.tenant,ids.sales,row,String(row),'synthetic#'+row,hash,String(row).repeat(64),'Dòng tổng hợp '+row]);
    });
    const measure=async()=>h.operator.transaction(async tx=>{
      await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true)",[ids.tenant,ids.sales]);
      const s=(await tx.query<{n:number;h:string}>("SELECT count(*)::int n,md5(string_agg(fingerprint,',' ORDER BY source_row)) h FROM analytics.tech_source_tasks")).rows[0];
      const w=(await tx.query<{n:number}>('SELECT count(*)::int n FROM work_items')).rows[0].n;
      return {tasks:s.n,hash:s.h,work:w};
    });
    const before=await measure();
    expect(before.tasks).toBe(2);
    const files=await from013();
    const tablesOf=async(f:string)=>[...(await readFile(dir('migrations/'+f),'utf8')).matchAll(/CREATE TABLE IF NOT EXISTS\s+([\w.]+)/g)].map(m=>m[1]);
    const regclass=async(t:string)=>(await h.operator.query<{r:string|null}>('SELECT to_regclass($1)::text r',[t])).rows[0].r;
    // expand-only migrations (018) add columns to an older table instead of creating one
    const columnsOf=async(f:string)=>[...(await readFile(dir('migrations/'+f),'utf8')).matchAll(/TABLE\s+([\w.]+)\s+ADD COLUMN IF NOT EXISTS\s+(\w+)/g)].map(m=>({table:m[1],column:m[2]}));
    const hasColumn=async(c:{table:string;column:string})=>(await h.operator.query(
      'SELECT 1 FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name=$3',
      [c.table.includes('.')?c.table.split('.')[0]:'public',c.table.split('.').pop(),c.column])).rows.length===1;
    expect(await columnsOf('018_access_change_approval.sql')).toHaveLength(4);
    for(const f of [...files].reverse()){
      await h.exec(await readFile(dir('migrations/rollback/'+f),'utf8'));
      for(const t of await tablesOf(f)) expect(await regclass(t),t).toBeNull();
      for(const c of await columnsOf(f)) expect(await hasColumn(c),c.column).toBe(false);
      expect((await h.operator.query('SELECT 1 FROM schema_migrations WHERE version=$1',[String(num(f)).padStart(3,'0')])).rows).toHaveLength(0);
    }
    for(let pass=0;pass<2;pass++)
      for(const f of files) await h.exec(await readFile(dir('migrations/'+f),'utf8'));
    for(const f of files){
      for(const t of await tablesOf(f)) expect(await regclass(t),t).not.toBeNull();
      for(const c of await columnsOf(f)) expect(await hasColumn(c),c.column).toBe(true);
      expect((await h.operator.query('SELECT 1 FROM schema_migrations WHERE version=$1',[String(num(f)).padStart(3,'0')])).rows).toHaveLength(1);
    }
    expect(await measure()).toEqual(before);
  } finally { await h.reset(); await h.close(); }
});

test('rollback 018 refuses while an access-change ballot exists',async()=>{
  const h=await openHarness();
  const forward=await readFile(dir('migrations/018_access_change_approval.sql'),'utf8');
  const rollback=await readFile(dir('migrations/rollback/018_access_change_approval.sql'),'utf8');
  const q=async<T=Record<string,unknown>>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
  const nullable=async(column:string)=>(await q<{is_nullable:string}>(`SELECT is_nullable FROM information_schema.columns
    WHERE table_schema='identity' AND table_name='account_approvals' AND column_name=$1`,[column]))[0]?.is_nullable??null;
  const shape=async()=>({
    constraints:(await q<{conname:string;def:string}>(`SELECT conname,pg_get_constraintdef(oid) def FROM pg_constraint
      WHERE conrelid='identity.account_approvals'::regclass ORDER BY conname`)),
    indexes:(await q<{indexname:string;indexdef:string}>(`SELECT indexname,indexdef FROM pg_indexes
      WHERE schemaname='identity' AND tablename='account_approvals' ORDER BY indexname`)),
  });
  let later:string[]=[];
  const applied=async()=>(await q("SELECT 1 FROM schema_migrations WHERE version='018'")).length;
  // the refusal raises inside the file's own BEGIN; PGlite keeps that aborted block open (a pooled client that errors is discarded)
  const refused=async(pattern:RegExp)=>{await expect(h.exec(rollback)).rejects.toThrow(pattern);await h.exec('ROLLBACK');};
  try {
    await h.reset();await seedSlice1(h);
    // migrations after 018 sit on top of it: take them off in reverse order first, put them back at the end
    later=(await from013()).filter(f=>num(f)>18);
    for(const f of [...later].reverse()) await h.exec(await readFile(dir('migrations/rollback/'+f),'utf8'));
    const admin=randomUUID(),subject=randomUUID();
    for(const [id,username] of [[admin,'rollback-admin'],[subject,'rollback-subject']] as const)
      await q(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,$3,$3,'viewer','fixture-hash')`,[id,ids.tenant,username]);
    const request=(await q<{id:string}>(`INSERT INTO identity.registration_requests(tenant_id,username,name,project_interest)
      VALUES($1,'rollback-reg','Đăng ký mẫu','Team Tech') RETURNING id`,[ids.tenant]))[0].id;
    const grants=JSON.stringify([{projectId:ids.sales,role:'viewer',reportPermissions:[]}]);
    const registration=(await q<{id:string}>(`INSERT INTO identity.account_approvals(tenant_id,registration_id,proposer_id,grants,reason)
      VALUES($1,$2,$3,$4,'Phiếu đăng ký mẫu') RETURNING id`,[ids.tenant,request,admin,grants]))[0].id;
    const accessChange=(await q<{id:string}>(`INSERT INTO identity.account_approvals(tenant_id,kind,subject_user_id,subject_account_version,
      previous_grants,proposer_id,grants,reason) VALUES($1,'access_change',$2,1,$3,$4,$3,'Phiếu đổi quyền mẫu') RETURNING id`,
      [ids.tenant,subject,grants,admin]))[0].id;
    const full=await shape();
    await refused(/access.change/i);
    expect(await nullable('kind')).toBe('NO');
    expect(await nullable('registration_id')).toBe('YES');
    expect(await applied()).toBe(1);
    expect(await shape()).toEqual(full);
    await q('DELETE FROM identity.account_approvals WHERE id=$1',[accessChange]);
    // a later version applied also blocks it (order 018 → 017 → 016 only)
    await q("INSERT INTO schema_migrations(version) VALUES('019')");
    try { await refused(/later|019/i); }
    finally { await q("DELETE FROM schema_migrations WHERE version='019'"); }
    expect(await nullable('kind')).toBe('NO');
    // with only registration ballots left it runs, drops what 018 added and keeps the old row as it was
    const kept=(await q('SELECT id,registration_id,state,grants,updated_at FROM identity.account_approvals WHERE id=$1',[registration]))[0];
    await h.exec(rollback);
    for(const column of ['kind','subject_user_id','subject_account_version','previous_grants']) expect(await nullable(column),column).toBeNull();
    expect(await nullable('registration_id')).toBe('NO');
    expect(await applied()).toBe(0);
    const bare=await shape();
    expect(JSON.stringify(bare)).not.toMatch(/subject_user_id|access_change|kind/);
    expect((await q('SELECT id,registration_id,state,grants,updated_at FROM identity.account_approvals WHERE id=$1',[registration]))[0]).toEqual(kept);
    await h.exec(rollback);
    // expand again, twice: the old row reads as a registration ballot and is otherwise unchanged; no constraint or index is doubled
    await h.exec(forward);await h.exec(forward);
    expect(await applied()).toBe(1);
    expect(await shape()).toEqual(full);
    expect((await q('SELECT id,registration_id,state,grants,updated_at,kind,subject_user_id,subject_account_version,previous_grants FROM identity.account_approvals WHERE id=$1',[registration]))[0])
      .toEqual({...kept,kind:'registration',subject_user_id:null,subject_account_version:null,previous_grants:null});
  } finally {
    await h.exec(forward);
    for(const f of later) await h.exec(await readFile(dir('migrations/'+f),'utf8'));
    await h.reset();await h.close();
  }
});

test('rollback 019 refuses while a membership or a ballot carries a doc_approve code, and while a later migration is applied',async()=>{
  const h=await openHarness();
  const forward=await readFile(dir('migrations/019_document_approver_grant.sql'),'utf8');
  const rollback=await readFile(dir('migrations/rollback/019_document_approver_grant.sql'),'utf8');
  const q=async<T=Record<string,unknown>>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
  const checks=async()=>(await q<{conname:string;def:string}>(`SELECT conname,pg_get_constraintdef(oid) def FROM pg_constraint
    WHERE conrelid='identity.memberships'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%report_permissions%' ORDER BY conname`));
  const objects=async()=>({
    trigger:(await q<{d:string}>("SELECT pg_get_triggerdef(oid) d FROM pg_trigger WHERE tgname='memberships_doc_approve_guard' AND NOT tgisinternal")).map(r=>r.d),
    guard:(await q<{d:string}>("SELECT pg_get_functiondef(p.oid) d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='identity' AND p.proname='memberships_doc_approve_guard'")).map(r=>r.d),
    reader:(await q<{d:string;owner:string;acl:string|null}>("SELECT pg_get_functiondef(p.oid) d,pg_get_userbyid(p.proowner) owner,p.proacl::text acl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='document_approvers'")),
  });
  const absent={trigger:[],guard:[],reader:[]};
  const applied=async()=>(await q("SELECT 1 FROM schema_migrations WHERE version='019'")).length;
  // the refusal raises inside the file's own BEGIN; PGlite keeps that aborted block open (a pooled client that errors is discarded)
  const refused=async(pattern:RegExp)=>{await expect(h.exec(rollback)).rejects.toThrow(pattern);await h.exec('ROLLBACK');};
  let later:string[]=[];
  try {
    await h.reset();await seedSlice1(h);
    // migrations after 019 sit on top of it: take them off in reverse order first, put them back at the end
    later=(await from013()).filter(f=>num(f)>19);
    for(const f of [...later].reverse()) await h.exec(await readFile(dir('migrations/rollback/'+f),'utf8'));
    const admin=randomUUID(),subject=randomUUID();
    for(const [id,username] of [[admin,'rollback-admin'],[subject,'rollback-subject']] as const)
      await q(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,$3,$3,'viewer','fixture-hash')`,[id,ids.tenant,username]);
    await q(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'engineer')`,[ids.tenant,subject,ids.sales]);
    const code='doc_approve:design';
    const grants=JSON.stringify([{projectId:ids.sales,role:'engineer',reportPermissions:[code]}]);
    const plain=JSON.stringify([{projectId:ids.sales,role:'engineer',reportPermissions:[]}]);
    const ballot=async(g:string,previous:string)=>(await q<{id:string}>(`INSERT INTO identity.account_approvals(tenant_id,kind,subject_user_id,subject_account_version,
      previous_grants,proposer_id,grants,reason,state) VALUES($1,'access_change',$2,1,$3,$4,$5,'Phiếu đổi quyền mẫu','issued') RETURNING id`,[ids.tenant,subject,previous,admin,g]))[0].id;
    const full=await checks();
    expect(full.map(c=>c.conname)).toEqual(['memberships_grant_permissions_check']);
    const fullObjects=await objects();
    expect(fullObjects.trigger).toHaveLength(1);expect(fullObjects.guard).toHaveLength(1);expect(fullObjects.reader).toHaveLength(1);
    expect(fullObjects.trigger[0]).toContain('UPDATE OF report_permissions, project_id, user_id, tenant_id');
    expect(fullObjects.reader[0]).toMatchObject({owner:'libetech_identity'});
    expect(fullObjects.reader[0].acl).toContain('libetech_runtime=X/libetech_identity');
    // 1. a membership carries a code (a ballot allowed it; the refusal names the membership)
    const first=await ballot(grants,plain);
    await q('UPDATE identity.memberships SET report_permissions=$2 WHERE user_id=$1',[subject,[code]]);
    await refused(/membership carries a doc_approve code/i);
    expect(await applied()).toBe(1);
    expect(await checks()).toEqual(full);
    expect(await objects()).toEqual(fullObjects);
    // 2. no membership carries it any more, the ballot's grants still name it
    await q("UPDATE identity.memberships SET report_permissions='{}' WHERE user_id=$1",[subject]);
    await refused(/ballot carries a doc_approve code/i);
    // 3. only previous_grants names it
    await q('DELETE FROM identity.account_approvals WHERE id=$1',[first]);
    await ballot(plain,grants);
    await refused(/ballot carries a doc_approve code/i);
    expect(await applied()).toBe(1);
    expect(await checks()).toEqual(full);
    // 4. a later version applied also blocks it (order 019 → 018 → 017 only)
    await q('DELETE FROM identity.account_approvals');
    await q("INSERT INTO schema_migrations(version) VALUES('999')");
    try { await refused(/later|019/i); }
    finally { await q("DELETE FROM schema_migrations WHERE version='999'"); }
    expect(await objects()).toEqual(fullObjects);
    // 5. clean: it runs, drops trigger and both functions, restores the three-value CHECK under its 004 name and forgets 019
    await ballot(plain,plain);
    await q("UPDATE identity.memberships SET report_permissions=ARRAY['people_read'] WHERE user_id=$1",[subject]);
    await h.exec(rollback);
    expect(await objects()).toEqual(absent);
    const bare=await checks();
    expect(bare.map(c=>c.conname)).toEqual(['memberships_report_permissions_check']);
    expect(bare[0].def).not.toContain('doc_approve');
    expect(await applied()).toBe(0);
    expect((await q('SELECT report_permissions FROM identity.memberships WHERE user_id=$1',[subject]))[0]).toEqual({report_permissions:['people_read']});
    await expect(q("UPDATE identity.memberships SET report_permissions=ARRAY['doc_approve:design'] WHERE user_id=$1",[subject])).rejects.toThrow(/memberships_report_permissions_check/);
    // the file is repeatable once rolled back, and forward twice leaves one CHECK, one trigger, one of each function
    await h.exec(rollback);
    await h.exec(forward);await h.exec(forward);
    expect(await applied()).toBe(1);
    expect(await checks()).toEqual(full);
    expect(await objects()).toEqual(fullObjects);
    expect((await q('SELECT report_permissions FROM identity.memberships WHERE user_id=$1',[subject]))[0]).toEqual({report_permissions:['people_read']});
  } finally {
    await h.exec(forward);
    for(const f of later) await h.exec(await readFile(dir('migrations/'+f),'utf8'));
    await h.reset();await h.close();
  }
});

test('rollback 020 refuses while an approval decision exists and while a later migration is applied',async()=>{
  const h=await openHarness();
  const forward=await readFile(dir('migrations/020_document_review.sql'),'utf8');
  const rollback=await readFile(dir('migrations/rollback/020_document_review.sql'),'utf8');
  expect(rollback.replace(/--.*$/gm,'')).not.toMatch(/CASCADE|DROP\s+ROLE/i);
  const q=async<T=Record<string,unknown>>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
  const tables=['review_delegations','review_comments','review_decisions','document_dependencies','review_events'];
  const present=async()=>(await q<{t:string|null}>('SELECT to_regclass(n)::text t FROM unnest($1::text[]) n',[tables])).map(r=>r.t);
  const objects=async()=>({
    triggers:(await q<{d:string}>(`SELECT pg_get_triggerdef(oid) d FROM pg_trigger WHERE NOT tgisinternal AND tgname IN
      ('review_delegations_guard','review_delegations_revoke_guard','review_decisions_guard','document_records_approval_guard','document_dependencies_flag_guard','document_records_latest_guard') ORDER BY tgname`)).map(r=>r.d),
    functions:(await q<{n:string}>(`SELECT p.proname n FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace WHERE s.nspname='public'
      AND p.proname IN ('review_delegations_guard','review_delegations_revoke_guard','review_decisions_guard','document_records_approval_guard','document_dependencies_flag_guard','document_records_latest_guard') ORDER BY 1`)).map(r=>r.n),
    pointerGrant:(await q<{ok:boolean}>("SELECT has_column_privilege('libetech_runtime','public.document_records','approved_revision_id','UPDATE') ok"))[0].ok,
  });
  /** The insert policy of document_revisions: 014's text, or 014's plus the author binding of 020 (D4 of the Codex gate, round 2). */
  const policy=async()=>(await q<{w:string}>("SELECT with_check w FROM pg_policies WHERE tablename='document_revisions' AND policyname='scope_insert'")).map(r=>r.w);
  const nineteen=async()=>({
    guard:(await q<{d:string}>("SELECT pg_get_triggerdef(oid) d FROM pg_trigger WHERE tgname='memberships_doc_approve_guard' AND NOT tgisinternal")).map(r=>r.d),
    reader:(await q<{d:string}>("SELECT pg_get_functiondef(p.oid) d FROM pg_proc p WHERE p.proname='document_approvers'")).map(r=>r.d),
    applied:(await q("SELECT 1 FROM schema_migrations WHERE version='019'")).length,
  });
  const applied=async()=>(await q("SELECT 1 FROM schema_migrations WHERE version='020'")).length;
  // the refusal raises inside the file's own BEGIN; PGlite keeps that aborted block open (a pooled client that errors is discarded)
  const refused=async(pattern:RegExp)=>{await expect(h.exec(rollback)).rejects.toThrow(pattern);await h.exec('ROLLBACK');};
  let later:string[]=[];
  try {
    await h.reset();await seedSlice1(h);await seedMembers(h);
    // migrations after 020 sit on top of it: take them off in reverse order first, put them back at the end
    later=(await from013()).filter(f=>num(f)>20);
    for(const f of [...later].reverse()) await h.exec(await readFile(dir('migrations/rollback/'+f),'utf8'));
    const full=await objects();
    expect(full.triggers).toHaveLength(6);expect(full.functions).toHaveLength(6);expect(full.pointerGrant).toBe(true);
    expect(await present()).toEqual(tables);
    const withAuthor=await policy();
    expect(withAuthor).toHaveLength(1);expect(withAuthor[0]).toMatch(/app\.person_id/);expect(withAuthor[0]).toMatch(/proposed_by/);
    const kept=await nineteen();
    // an approval decision on a frozen revision, written the way the service will: approver holds the design code
    const doc=await registerDoc(h,pm);
    const fr=await frozenRevision(h,doc.record.id,member.id);
    await grantDocApproval(h,approver.id,ids.sales,['design']);
    const revisionNo=(await q<{n:number}>('SELECT revision_no n FROM document_revisions WHERE id=$1',[fr.revisionId]))[0].n;
    const decide=(result:string,authority:string,by:string,delegation:string|null)=>h.operator.transaction(async tx=>{
      await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true)",[ids.tenant,ids.sales]);
      await tx.query(`INSERT INTO review_decisions(tenant_id,project_id,document_id,document_revision_id,revision_no,revision_hash,record_version,result,scope_note,authority,delegation_id,decided_by,command_key,request_id,trace_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,'Phạm vi mẫu cho bản thử',$9,$10,$11,'rollback-key',$12,$12)`,
        [ids.tenant,ids.sales,doc.record.id,fr.revisionId,revisionNo,fr.hash,fr.version,result,authority,delegation,by,randomUUID()]);
    });
    await decide('approved','approval_grant',approver.id,null);
    // 1. a later version applied blocks it even though the approval exists (the later migration is named first)
    await q("INSERT INTO schema_migrations(version) VALUES('021')");
    try { await refused(/Roll back the later migrations before 020/i); }
    finally { await q("DELETE FROM schema_migrations WHERE version='021'"); }
    expect(await present()).toEqual(tables);expect(await objects()).toEqual(full);expect(await applied()).toBe(1);
    // 2. the approval decision blocks it; nothing was dropped
    await refused(/approved pointers would lose their basis/i);
    expect(await present()).toEqual(tables);expect(await objects()).toEqual(full);expect(await applied()).toBe(1);
    // 3. a later version applied also blocks it when there is no approval (order 021 → 020 → 019)
    await q('TRUNCATE review_decisions');
    const delegation=await delegate(h,ids.sales,reviewer.id);
    await decide('changes_requested','review_delegation',reviewer.id,delegation);
    await q("INSERT INTO schema_migrations(version) VALUES('021')");
    try { await refused(/later/i); }
    finally { await q("DELETE FROM schema_migrations WHERE version='021'"); }
    expect(await present()).toEqual(tables);expect(await objects()).toEqual(full);
    // 3b. a person's comment (not an approval) blocks it too, naming the table and nothing else; nothing was dropped
    await q('TRUNCATE review_decisions');
    await h.operator.transaction(async tx=>{
      await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true)",[ids.tenant,ids.sales]);
      await tx.query(`INSERT INTO review_comments(tenant_id,project_id,document_id,document_revision_id,kind,anchor,body,actor_id,request_id,trace_id)
        VALUES($1,$2,$3,$4,'comment','','Nhận xét thử của một người',$5,$6,$6)`,[ids.tenant,ids.sales,doc.record.id,fr.revisionId,reviewer.id,randomUUID()]);
    });
    await refused(/Roll back 020 refused: review_comments holds rows/i);
    expect(await present()).toEqual(tables);expect(await objects()).toEqual(full);expect(await applied()).toBe(1);
    expect(Number((await q<{n:string}>('SELECT count(*) n FROM review_comments'))[0].n)).toBe(1);
    // 4. every review table empty: it runs, drops tables, triggers and functions, takes the pointer grant back, leaves 019 alone and forgets 020
    await q('TRUNCATE review_comments, review_decisions, review_delegations, review_events, document_dependencies');
    await h.exec(rollback);
    expect(await present()).toEqual(tables.map(()=>null));
    expect(await objects()).toEqual({triggers:[],functions:[],pointerGrant:false});
    expect(await applied()).toBe(0);
    expect(await nineteen()).toEqual(kept);
    // the insert policy of document_revisions is 014's again: one policy, scope and self-declared conditions, no author binding
    const back=await policy();
    expect(back).toHaveLength(1);expect(back[0]).not.toMatch(/app\.person_id/);expect(back[0]).not.toMatch(/proposed_by/);
    expect(back[0]).toMatch(/hash_verification/);expect(back[0]).toMatch(/snapshot_ref IS NULL/);expect(back[0]).toMatch(/app\.project_ids/);
    // the document record and its revisions are as they were
    expect((await q('SELECT latest_revision_id,approved_revision_id,version FROM document_records WHERE id=$1',[doc.record.id]))[0]).toEqual({latest_revision_id:fr.revisionId,approved_revision_id:null,version:fr.version});
    // the file is repeatable once rolled back; forward twice leaves one of everything, then rollback and forward again is clean
    await h.exec(rollback);
    await h.exec(forward);await h.exec(forward);
    expect(await applied()).toBe(1);
    expect(await present()).toEqual(tables);expect(await objects()).toEqual(full);expect(await nineteen()).toEqual(kept);
    await h.exec(rollback);await h.exec(forward);
    expect(await objects()).toEqual(full);expect(await policy()).toEqual(withAuthor);
  } finally {
    await h.exec('ROLLBACK').catch(()=>{});
    await h.exec(forward);
    for(const f of later) await h.exec(await readFile(dir('migrations/'+f),'utf8'));
    await h.reset();await h.close();
  }
});

test('rollback 021 refuses while a later migration is applied, drops the Z4 objects, keeps the AI role and touches nothing of 019 or 020',async()=>{
  const h=await openHarness();
  const forward=await readFile(dir('migrations/021_ai_suggestions_z4.sql'),'utf8');
  const rollback=await readFile(dir('migrations/rollback/021_ai_suggestions_z4.sql'),'utf8');
  expect(rollback.replace(/--.*$/gm,'')).not.toMatch(/CASCADE|DROP\s+ROLE/i);
  const q=async<T=Record<string,unknown>>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
  const present=async()=>(await q<{t:string|null}>("SELECT to_regclass(n)::text t FROM unnest(ARRAY['intelligence.ai_drafts','public.draft_decisions']) n")).map(r=>r.t);
  const objects=async()=>({
    schema:(await q('SELECT 1 FROM pg_namespace WHERE nspname=\'intelligence\'')).length,
    functions:(await q("SELECT 1 FROM pg_proc WHERE proname='draft_decisions_guard'")).length,
    role:(await q<{rolcanlogin:boolean;rolsuper:boolean;rolbypassrls:boolean}>("SELECT rolcanlogin,rolsuper,rolbypassrls FROM pg_roles WHERE rolname='libetech_ai'")),
  });
  const upstream=async()=>({
    triggers:(await q<{d:string}>(`SELECT pg_get_triggerdef(oid) d FROM pg_trigger WHERE NOT tgisinternal AND tgname IN
      ('review_delegations_guard','review_delegations_revoke_guard','review_decisions_guard','document_records_approval_guard','document_dependencies_flag_guard','document_records_latest_guard','memberships_doc_approve_guard') ORDER BY tgname`)).map(r=>r.d),
    tables:(await q<{t:string|null}>("SELECT to_regclass(n)::text t FROM unnest(ARRAY['review_delegations','review_comments','review_decisions','document_dependencies','review_events']) n")).map(r=>r.t),
    applied:(await q("SELECT version FROM schema_migrations WHERE version IN ('019','020') ORDER BY 1")).map(r=>(r as {version:string}).version),
  });
  const applied=async()=>(await q("SELECT 1 FROM schema_migrations WHERE version='021'")).length;
  // the refusal raises inside the file's own BEGIN; PGlite keeps that aborted block open (a pooled client that errors is discarded)
  const refused=async(pattern:RegExp)=>{await expect(h.exec(rollback)).rejects.toThrow(pattern);await h.exec('ROLLBACK');};
  let later:string[]=[];
  try {
    await h.reset();await seedSlice1(h);
    // migrations after 021 sit on top of it (022 today): take them off in reverse order first, put them back at the end
    later=(await from013()).filter(f=>num(f)>21);
    for(const f of [...later].reverse()) await h.exec(await readFile(dir('migrations/rollback/'+f),'utf8'));
    const full=await objects();
    expect(full.schema).toBe(1);expect(full.functions).toBe(1);
    expect(full.role).toEqual([{rolcanlogin:false,rolsuper:false,rolbypassrls:false}]);
    expect(await present()).toEqual(['intelligence.ai_drafts','draft_decisions']);
    const kept=await upstream();
    expect(kept.applied).toEqual(['019','020']);
    // 1. a later version applied blocks it; nothing was dropped
    await q("INSERT INTO schema_migrations(version) VALUES('022')");
    try { await refused(/later|022/i); }
    finally { await q("DELETE FROM schema_migrations WHERE version='022'"); }
    expect(await present()).toEqual(['intelligence.ai_drafts','draft_decisions']);expect(await objects()).toEqual(full);expect(await applied()).toBe(1);
    // 1b. a person's recorded decision blocks it and nothing is dropped; drafts alone do not block it. The history trigger stops even the operational
    // login from deleting the decision, so the row is cleared by TRUNCATE (not row-level) to reach a clean state.
    const hash='c'.repeat(64);
    const draftId=(await q<{id:string}>(`INSERT INTO intelligence.ai_drafts(tenant_id,project_id,entity_type,entity_id,signal_type,skill_version,manifest_hash,model_version,value,value_hash,confidence,input_hash,ai_principal_id,trace_id,dedupe_key)
      VALUES($1,$2,'intake_candidate',$3,'intake_analyst','1',$4,'m','{}',$4,1,$4,$3,$3,'rollback-draft-0001') RETURNING id`,[ids.tenant,ids.sales,randomUUID(),hash]))[0].id;
    await q(`INSERT INTO draft_decisions(tenant_id,project_id,draft_id,draft_value_hash,result,reason,decided_by,command_key,request_id,trace_id)
      VALUES($1,$2,$3,$4,'rejected','Lý do đủ dài',$5,'rollback-key',$6,$6)`,[ids.tenant,ids.sales,draftId,hash,pm.id,randomUUID()]);
    await refused(/recorded decision of a person would be destroyed/i);
    expect(await present()).toEqual(['intelligence.ai_drafts','draft_decisions']);expect(await objects()).toEqual(full);expect(await applied()).toBe(1);
    await expect(q('DELETE FROM draft_decisions')).rejects.toThrow(/Append-only/);
    await q('TRUNCATE draft_decisions');
    expect(await q('SELECT 1 FROM intelligence.ai_drafts')).toHaveLength(1);
    // 2. clean: it drops both tables, the guard function and the schema, forgets 021, keeps the role and leaves 019 and 020 as they were
    await h.exec(rollback);
    expect(await present()).toEqual([null,null]);
    expect(await objects()).toEqual({schema:0,functions:0,role:full.role});
    expect(await applied()).toBe(0);
    expect(await upstream()).toEqual(kept);
    // 3. repeatable once rolled back; forward twice leaves one of everything; rollback and forward again is clean
    await h.exec(rollback);
    await h.exec(forward);await h.exec(forward);
    expect(await applied()).toBe(1);
    expect(await present()).toEqual(['intelligence.ai_drafts','draft_decisions']);expect(await objects()).toEqual(full);expect(await upstream()).toEqual(kept);
    await h.exec(rollback);await h.exec(forward);
    expect(await objects()).toEqual(full);
  } finally {
    await h.exec('ROLLBACK').catch(()=>{});
    await h.exec(forward);
    for(const f of later) await h.exec(await readFile(dir('migrations/'+f),'utf8'));
    await h.reset();await h.close();
  }
});

test('rollback 022 refuses while a later migration is applied, drops the four triggers and four functions of 022, and leaves drafts, decisions, mappings and 021 as they were',async()=>{
  const h=await openHarness();
  const forward=await readFile(dir('migrations/022_ai_drafts_pointer_only_guard.sql'),'utf8');
  const rollback=await readFile(dir('migrations/rollback/022_ai_drafts_pointer_only_guard.sql'),'utf8');
  expect(rollback.replace(/--.*$/gm,'')).not.toMatch(/CASCADE|DROP\s+ROLE|DROP\s+TABLE|DROP\s+SCHEMA/i);
  const q=async<T=Record<string,unknown>>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
  // 022 has four triggers (two on intelligence.ai_drafts, one on public.project_domain_mappings, one on public.draft_decisions) and four functions
  const OWN="('ai_drafts_declared_scope_guard','ai_drafts_pointer_only_guard','project_domain_mappings_draft_lock','draft_decisions_pointer_only_guard')";
  const guard=async()=>({
    trigger:(await q<{t:string;d:string}>(`SELECT tgrelid::regclass::text t,pg_get_triggerdef(oid) d FROM pg_trigger WHERE tgname IN ${OWN} AND NOT tgisinternal ORDER BY 1,2`)),
    functions:(await q<{d:string}>(`SELECT pg_get_functiondef(p.oid) d FROM pg_proc p WHERE p.proname IN ${OWN} ORDER BY p.proname`)).map(r=>r.d),
  });
  const upstream=async()=>({
    triggers:(await q<{t:string;d:string}>(`SELECT tgrelid::regclass::text t,pg_get_triggerdef(oid) d FROM pg_trigger WHERE NOT tgisinternal AND tgname NOT IN ${OWN}
      AND tgrelid IN ('intelligence.ai_drafts'::regclass,'public.draft_decisions'::regclass,'public.project_domain_mappings'::regclass) ORDER BY 1,2`)),
    guardFn:(await q<{d:string}>("SELECT pg_get_functiondef(p.oid) d FROM pg_proc p WHERE p.proname='draft_decisions_guard'")).map(r=>r.d),
    applied:(await q("SELECT version FROM schema_migrations WHERE version IN ('021') ORDER BY 1")).map(r=>(r as {version:string}).version),
  });
  const counts=async()=>({
    drafts:(await q<{n:number}>('SELECT count(*)::int n FROM intelligence.ai_drafts'))[0].n,
    decisions:(await q<{n:number}>('SELECT count(*)::int n FROM draft_decisions'))[0].n,
    mappings:(await q<{n:number}>('SELECT count(*)::int n FROM public.project_domain_mappings'))[0].n,
  });
  const applied=async()=>(await q("SELECT 1 FROM schema_migrations WHERE version='022'")).length;
  // the refusal raises inside the file's own BEGIN; PGlite keeps that aborted block open (a pooled client that errors is discarded)
  const refused=async(pattern:RegExp)=>{await expect(h.exec(rollback)).rejects.toThrow(pattern);await h.exec('ROLLBACK');};
  const hash='c'.repeat(64);
  const insertDraft=()=>q(`INSERT INTO intelligence.ai_drafts(tenant_id,project_id,entity_type,entity_id,signal_type,skill_version,manifest_hash,model_version,value,value_hash,confidence,input_hash,ai_principal_id,trace_id,dedupe_key)
    VALUES($1,$2,'intake_candidate',$3,'intake_analyst','1',$4,'m','{}',$4,1,$4,$3,$3,$5) RETURNING id`,[ids.tenant,ids.transport,randomUUID(),hash,'rollback-draft-'+randomUUID()]);
  let later:string[]=[];
  try {
    await h.reset();await seedSlice1(h);
    // migrations after 022 sit on top of it (none today): take them off in reverse order first, put them back at the end
    later=(await from013()).filter(f=>num(f)>22);
    for(const f of [...later].reverse()) await h.exec(await readFile(dir('migrations/rollback/'+f),'utf8'));
    const full=await guard();
    expect(full.trigger).toHaveLength(4);expect(full.functions).toHaveLength(4);
    const kept=await upstream();
    // the three of 021 and project_domain_mappings_immutable of 013
    expect(kept.triggers).toHaveLength(4);
    // 1. a later version applied blocks it; nothing was dropped
    await q("INSERT INTO schema_migrations(version) VALUES('023')");
    try { await refused(/later|023/i); }
    finally { await q("DELETE FROM schema_migrations WHERE version='023'"); }
    expect(await guard()).toEqual(full);expect(await applied()).toBe(1);
    // a draft and a person's decision exist: rolling back keeps both
    const draftId=(await insertDraft())[0].id as string;
    await q(`INSERT INTO draft_decisions(tenant_id,project_id,draft_id,draft_value_hash,result,reason,decided_by,command_key,request_id,trace_id)
      VALUES($1,$2,$3,$4,'rejected','Lý do đủ dài',$5,'rollback-key',$6,$6)`,[ids.tenant,ids.transport,draftId,hash,pm.id,randomUUID()]);
    const rows0=await counts();
    expect(rows0).toMatchObject({drafts:1,decisions:1});
    // 2. clean: the four triggers and four functions go, 022 is forgotten, tables, rows and 021 stay
    await h.exec(rollback);
    expect(await guard()).toEqual({trigger:[],functions:[]});
    expect(await applied()).toBe(0);
    expect(await counts()).toEqual(rows0);
    expect(await upstream()).toEqual(kept);
    // the decision table keeps only the triggers of 021
    expect((await q<{tgname:string}>("SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgrelid='public.draft_decisions'::regclass ORDER BY 1")).map(r=>r.tgname))
      .toEqual(['draft_decisions_guard','draft_decisions_immutable']);
    // what the rollback re-opens: an IBS_HI project's draft is stored again (inside a transaction that always rolls back)
    const done=new Error('rolled back');
    await h.operator.transaction(async tx=>{
      await tx.query("INSERT INTO project_domain_mappings(tenant_id,project_id,domain_code,confirmed_by,source,mapping_version) VALUES($1,$2,'IBS_HI',$3,'synthetic-source',1)",[ids.tenant,ids.transport,pm.id]);
      await tx.query(`INSERT INTO intelligence.ai_drafts(tenant_id,project_id,entity_type,entity_id,signal_type,skill_version,manifest_hash,model_version,value,value_hash,confidence,input_hash,ai_principal_id,trace_id,dedupe_key)
        VALUES($1,$2,'intake_candidate',$3,'intake_analyst','1',$4,'m','{}',$4,1,$4,$3,$3,$5)`,[ids.tenant,ids.transport,randomUUID(),hash,'rollback-reopened']);
      expect((await tx.query('SELECT count(*)::int n FROM intelligence.ai_drafts')).rows[0]).toEqual({n:2});
      throw done;
    }).catch(e=>{if(e!==done) throw e;});
    expect(await counts()).toEqual(rows0);
    // 3. repeatable once rolled back; forward twice restores the same shape
    await h.exec(rollback);
    await h.exec(forward);await h.exec(forward);
    expect(await applied()).toBe(1);
    expect(await guard()).toEqual(full);expect(await upstream()).toEqual(kept);expect(await counts()).toEqual(rows0);
  } finally {
    await h.exec('ROLLBACK').catch(()=>{});
    await h.exec(forward);
    for(const f of later) await h.exec(await readFile(dir('migrations/'+f),'utf8'));
    await h.reset();await h.close();
  }
});

// The hand-made removal of two triggers and two functions below restores the state in its finally block (forward file, later migrations, reset), like RB1 and RB2.
test('022 over a database that carries only the pointer-only trigger and its function gives the four triggers and four functions; the rollback from that shape leaves nothing of 022',async()=>{
  const h=await openHarness();
  const forward=await readFile(dir('migrations/022_ai_drafts_pointer_only_guard.sql'),'utf8');
  const rollback=await readFile(dir('migrations/rollback/022_ai_drafts_pointer_only_guard.sql'),'utf8');
  const q=async<T=Record<string,unknown>>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
  const OWN="('ai_drafts_declared_scope_guard','ai_drafts_pointer_only_guard','project_domain_mappings_draft_lock','draft_decisions_pointer_only_guard')";
  const shape=async()=>({
    triggers:await q(`SELECT tgrelid::regclass::text t,tgname,pg_get_triggerdef(oid) d FROM pg_trigger WHERE tgname IN ${OWN} AND NOT tgisinternal ORDER BY 1,2`),
    functions:await q(`SELECT p.proname,pg_get_functiondef(p.oid) d FROM pg_proc p WHERE p.proname IN ${OWN} ORDER BY 1`),
  });
  const counts=async()=>({
    drafts:(await q<{n:number}>('SELECT count(*)::int n FROM intelligence.ai_drafts'))[0].n,
    mappings:(await q<{n:number}>('SELECT count(*)::int n FROM public.project_domain_mappings'))[0].n,
  });
  const applied=async()=>(await q("SELECT 1 FROM schema_migrations WHERE version='022'")).length;
  // the shape that the first body of 022 left: the pointer-only trigger and its function, and nothing else of 022
  const toOldShape=async()=>{
    await q('DROP TRIGGER IF EXISTS ai_drafts_declared_scope_guard ON intelligence.ai_drafts');
    await q('DROP TRIGGER IF EXISTS project_domain_mappings_draft_lock ON public.project_domain_mappings');
    await q('DROP FUNCTION IF EXISTS intelligence.ai_drafts_declared_scope_guard()');
    await q('DROP FUNCTION IF EXISTS intelligence.project_domain_mappings_draft_lock()');
    await q('DROP TRIGGER IF EXISTS draft_decisions_pointer_only_guard ON public.draft_decisions');
    await q('DROP FUNCTION IF EXISTS intelligence.draft_decisions_pointer_only_guard()');
    // the first body of 022 had no lock_timeout of its own: step (i) proves that the forward file puts it back
    await q('ALTER FUNCTION intelligence.ai_drafts_pointer_only_guard() RESET lock_timeout');
    expect((await q<{c:string[]}>("SELECT proconfig c FROM pg_proc WHERE proname='ai_drafts_pointer_only_guard'"))[0].c).toEqual(['search_path=pg_catalog, pg_temp','row_security=off']);
  };
  let later:string[]=[];
  try {
    await h.reset();await seedSlice1(h);
    later=(await from013()).filter(f=>num(f)>22);
    for(const f of [...later].reverse()) await h.exec(await readFile(dir('migrations/rollback/'+f),'utf8'));
    const full=await shape();
    expect(full.triggers).toHaveLength(4);expect(full.functions).toHaveLength(4);
    await toOldShape();
    const old=await shape();
    expect(old.triggers.map(r=>r.tgname)).toEqual(['ai_drafts_pointer_only_guard']);
    expect(old.functions.map(r=>r.proname)).toEqual(['ai_drafts_pointer_only_guard']);
    // (i) the forward file gives the full shape
    await h.exec(forward);
    expect(await shape()).toEqual(full);
    // (ii) from the old shape, the rollback leaves nothing of 022 and touches no row
    await toOldShape();
    const rows0=await counts();
    await h.exec(rollback);
    expect(await shape()).toEqual({triggers:[],functions:[]});
    expect(await applied()).toBe(0);
    expect(await counts()).toEqual(rows0);
  } finally {
    await h.exec('ROLLBACK').catch(()=>{});
    await h.exec(forward);
    for(const f of later) await h.exec(await readFile(dir('migrations/'+f),'utf8'));
    await h.reset();await h.close();
  }
});

test('rollback 022 runs again after 021 was rolled back and its schema is gone',async()=>{
  const h=await openHarness();
  const f21=await readFile(dir('migrations/021_ai_suggestions_z4.sql'),'utf8');
  const f22=await readFile(dir('migrations/022_ai_drafts_pointer_only_guard.sql'),'utf8');
  const r21=await readFile(dir('migrations/rollback/021_ai_suggestions_z4.sql'),'utf8');
  const r22=await readFile(dir('migrations/rollback/022_ai_drafts_pointer_only_guard.sql'),'utf8');
  let later:string[]=[];
  try {
    await h.reset();await seedSlice1(h);
    later=(await from013()).filter(f=>num(f)>22);
    for(const f of [...later].reverse()) await h.exec(await readFile(dir('migrations/rollback/'+f),'utf8'));
    await h.exec(r22);
    await h.exec(r21);
    await h.exec(r22);
    expect((await h.operator.query<{t:string|null}>("SELECT to_regclass('intelligence.ai_drafts')::text t")).rows[0].t).toBeNull();
  } finally {
    await h.exec('ROLLBACK').catch(()=>{});
    await h.exec(f21);await h.exec(f22);
    for(const f of later) await h.exec(await readFile(dir('migrations/'+f),'utf8'));
    await h.reset();await h.close();
  }
});

test('rollback 023 refuses while a later migration is recorded or a decision carries a thread position; it drops what 023 made and leaves source events, revisions, drafts and decisions as they were; applying 023 again restores the numbers',async()=>{
  const h=await openHarness();
  const forward=await readFile(dir('migrations/023_thread_order.sql'),'utf8');
  const rollback=await readFile(dir('migrations/rollback/023_thread_order.sql'),'utf8');
  expect(rollback.replace(/--.*$/gm,'')).not.toMatch(/CASCADE|DROP\s+ROLE|DROP\s+SCHEMA/i);
  // the file takes the decision table before it looks for a position (review R-S-1): a confirmation in flight is waited for, not missed. The case with two connections is N18.
  const rollbackCode=rollback.replace(/--.*$/gm,'').replace(/\s+/g,' ');
  const lock='LOCK TABLE public.draft_decisions IN ACCESS EXCLUSIVE MODE';
  expect(rollbackCode).toContain(lock);
  expect(rollbackCode.indexOf(lock)).toBeLessThan(rollbackCode.indexOf('subject_thread_seq IS NOT NULL'));
  // and the revision table before the decision table (review R-DB-11): the service reads the revision table and then writes the decision, so a file that takes them the other way
  // round waits for a confirmation that has read and not yet written, which waits for the file: 40P01. The case with two connections is N18b.
  const lockRevisions='LOCK TABLE public.source_event_revisions IN ACCESS EXCLUSIVE MODE';
  expect(rollbackCode).toContain(lockRevisions);
  expect(rollbackCode.indexOf(lockRevisions)).toBeLessThan(rollbackCode.indexOf(lock));
  const q=async<T=Record<string,unknown>>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
  const OWN="('source_event_revisions_thread_position','intake_thread_heads_no_delete','source_revision_positions_immutable','draft_decisions_subject_order_guard')";
  // 023 leaves two tables (with their own immutability triggers), two functions and two triggers (one on the revision table, one on the decision table),
  // and on the decision table a column, its check constraint and the INSERT grant of that column
  const objects=async()=>({
    tables:(await q<{t:string|null}>("SELECT to_regclass(n)::text t FROM unnest(ARRAY['public.intake_thread_heads','public.source_revision_positions']) n")).map(r=>r.t),
    triggers:(await q<{t:string;d:string}>(`SELECT tgrelid::regclass::text t,pg_get_triggerdef(oid) d FROM pg_trigger WHERE tgname IN ${OWN} AND NOT tgisinternal ORDER BY 1,2`)),
    functions:(await q<{d:string}>("SELECT pg_get_functiondef(p.oid) d FROM pg_proc p WHERE p.proname IN ('source_event_revisions_thread_position','draft_decisions_subject_order_guard') ORDER BY p.proname")).map(r=>r.d),
    column:(await q<{acl:string|null;comment:string|null}>(`SELECT a.attacl::text acl,col_description(a.attrelid,a.attnum) comment FROM pg_attribute a
      WHERE a.attrelid='public.draft_decisions'::regclass AND a.attname='subject_thread_seq' AND NOT a.attisdropped`)),
    constraint:(await q<{d:string}>("SELECT pg_get_constraintdef(oid) d FROM pg_constraint WHERE conname='draft_decisions_thread_seq_only_confirmed'")),
  });
  const upstream=async()=>({
    triggers:(await q<{t:string;d:string}>(`SELECT tgrelid::regclass::text t,pg_get_triggerdef(oid) d FROM pg_trigger WHERE NOT tgisinternal AND tgname NOT IN ${OWN}
      AND tgrelid IN ('public.source_events'::regclass,'public.source_event_revisions'::regclass,'public.intake_candidates'::regclass,'public.draft_decisions'::regclass) ORDER BY 1,2`)),
    applied:(await q("SELECT version FROM schema_migrations WHERE version IN ('016','021','022') ORDER BY 1")).map(r=>(r as {version:string}).version),
  });
  const counts=async()=>({
    events:(await q<{n:number}>('SELECT count(*)::int n FROM source_events'))[0].n,
    revisions:(await q<{n:number}>('SELECT count(*)::int n FROM source_event_revisions'))[0].n,
    drafts:(await q<{n:number}>('SELECT count(*)::int n FROM intelligence.ai_drafts'))[0].n,
    decisions:(await q<{n:number}>('SELECT count(*)::int n FROM draft_decisions'))[0].n,
  });
  const numbers=()=>q<{revision:string;thread:string;seq:number}>('SELECT r.id revision,p.chat_id||\'|\'||p.thread_key thread,p.thread_seq::int seq FROM source_revision_positions p JOIN source_event_revisions r ON r.id=p.revision_id ORDER BY 2,3');
  const heads=()=>q<{thread:string;last_seq:number}>('SELECT chat_id||\'|\'||thread_key thread,last_seq::int last_seq FROM intake_thread_heads ORDER BY 1');
  const applied=async()=>(await q("SELECT 1 FROM schema_migrations WHERE version='023'")).length;
  // the refusal raises inside the file's own BEGIN; PGlite keeps that aborted block open (a pooled client that errors is discarded)
  const refused=async(pattern:RegExp)=>{await expect(h.exec(rollback)).rejects.toThrow(pattern);await h.exec('ROLLBACK');};
  const chat='-1000000000001',hash='c'.repeat(64);
  // revisions written with their own creation time (the case does not depend on the clock of the database), in the order of that time
  const at=(s:number)=>new Date(Date.parse('2026-01-01T10:00:00Z')+s*1000).toISOString();
  const event=async(message:string,thread:string)=>(await q<{id:string}>(`INSERT INTO source_events(tenant_id,project_id,source_id,source_type,quality_score,chat_id,message_id,thread_key,source_actor,observed_at,forwarded,addressed,trace_id,correlation_id)
    VALUES($1,$2,$3,'telegram_gateway',80,$4,$5,$6,'actor-1',now(),false,false,$7,$7) RETURNING id`,[ids.tenant,ids.sales,'gw-'+message,chat,message,thread,randomUUID()]))[0].id;
  const revision=(event:string,no:number,seconds:number,key:string)=>q(`INSERT INTO source_event_revisions(created_at,tenant_id,project_id,source_event_id,revision_no,revision_key,content_hash,content_mode)
    VALUES($1,$2,$3,$4,$5,$6,$7,'pointer_only')`,[at(seconds),ids.tenant,ids.sales,event,no,key.repeat(64),'b'.repeat(64)]);
  let later:string[]=[];
  try {
    await h.reset();await seedSlice1(h);
    // migrations after 023 sit on top of it (none today): take them off in reverse order first, put them back at the end
    later=(await from013()).filter(f=>num(f)>23);
    for(const f of [...later].reverse()) await h.exec(await readFile(dir('migrations/rollback/'+f),'utf8'));
    const e1=await event('9201','m:9201'),e2=await event('9202','m:9201'),e3=await event('9203','m:9203');
    await revision(e1,1,1,'1');await revision(e3,1,2,'2');await revision(e2,1,3,'3');await revision(e1,2,5,'4');
    // a draft of a candidate and a person's decision on it: they stay
    const draftId=(await q<{id:string}>(`INSERT INTO intelligence.ai_drafts(tenant_id,project_id,entity_type,entity_id,signal_type,skill_version,manifest_hash,model_version,value,value_hash,confidence,input_hash,ai_principal_id,trace_id,dedupe_key)
      VALUES($1,$2,'intake_candidate',$3,'intake_analyst','1',$4,'m','{}',$4,1,$4,$3,$3,$5) RETURNING id`,[ids.tenant,ids.sales,randomUUID(),hash,'rollback-023-draft']))[0].id;
    await q(`INSERT INTO draft_decisions(tenant_id,project_id,draft_id,draft_value_hash,result,reason,decided_by,command_key,request_id,trace_id)
      VALUES($1,$2,$3,$4,'rejected','Lý do đủ dài',$5,'rollback-key',$6,$6)`,[ids.tenant,ids.sales,draftId,hash,pm.id,randomUUID()]);
    const full=await objects();
    expect(full.tables).toEqual(['intake_thread_heads','source_revision_positions']);
    expect(full.triggers).toHaveLength(4);expect(full.functions).toHaveLength(2);
    expect(full.column).toHaveLength(1);expect(full.constraint).toHaveLength(1);
    const kept=await upstream();
    const numbered=await numbers(),counted=await heads();
    expect(numbered.map(r=>r.seq)).toEqual([1,2,3,1]);
    expect(counted.map(r=>r.last_seq)).toEqual([3,1]);
    const rows0=await counts();
    expect(rows0).toEqual({events:3,revisions:4,drafts:1,decisions:1});
    // 1. a later version applied blocks it; nothing was dropped
    await q("INSERT INTO schema_migrations(version) VALUES('024')");
    try { await refused(/later|024/i); }
    finally { await q("DELETE FROM schema_migrations WHERE version='024'"); }
    expect(await objects()).toEqual(full);expect(await applied()).toBe(1);expect(await numbers()).toEqual(numbered);
    // 1b. a decision that carries the position of a thread blocks it: the position would be lost and the row cannot be removed (the decision table is append-only).
    // The decision is written in the same transaction as the rollback and discarded with it, so the cases below start from the same rows.
    const [pe,pc,pd]=[randomUUID(),randomUUID(),randomUUID()];
    const carrying=`BEGIN;
      INSERT INTO source_events(id,tenant_id,project_id,source_id,source_type,quality_score,chat_id,message_id,thread_key,source_actor,observed_at,forwarded,addressed,trace_id,correlation_id)
        VALUES('${pe}','${ids.tenant}','${ids.sales}','gw-9204','telegram_gateway',80,'${chat}','9204','m:9204','actor-1',now(),false,false,'${pe}','${pe}');
      INSERT INTO source_event_revisions(tenant_id,project_id,source_event_id,revision_no,revision_key,content_hash,content_mode)
        VALUES('${ids.tenant}','${ids.sales}','${pe}',1,'${'6'.repeat(64)}','${'b'.repeat(64)}','pointer_only');
      INSERT INTO intake_candidates(id,tenant_id,project_id,chat_id,thread_key,root_source_event_id) VALUES('${pc}','${ids.tenant}','${ids.sales}','${chat}','m:9204','${pe}');
      INSERT INTO intelligence.ai_drafts(id,tenant_id,project_id,entity_type,entity_id,signal_type,skill_version,manifest_hash,model_version,value,value_hash,sources,confidence,input_hash,ai_principal_id,trace_id,dedupe_key)
        VALUES('${pd}','${ids.tenant}','${ids.sales}','intake_candidate','${pc}','intake_analyst','1','${hash}','m','{}','${hash}','[{"ref":"synthetic-source"}]',1,'${hash}','${pe}','${pe}','rollback-023-carrying');
      INSERT INTO draft_decisions(tenant_id,project_id,draft_id,draft_value_hash,result,reason,decided_by,command_key,request_id,trace_id,subject_thread_seq)
        VALUES('${ids.tenant}','${ids.sales}','${pd}','${hash}','confirmed','','${pm.id}','rollback-carrying-key','${pe}','${pe}',1);
      SELECT count(*) FROM draft_decisions WHERE subject_thread_seq IS NOT NULL;
      ${rollback}`;
    await expect(h.exec(carrying)).rejects.toThrow(/position of its thread/);
    await h.exec('ROLLBACK');
    expect(await objects()).toEqual(full);expect(await applied()).toBe(1);expect(await numbers()).toEqual(numbered);
    expect(await counts()).toEqual(rows0);
    // 2. clean: the tables, the function and the trigger go, 023 is forgotten; events, revisions, the draft, the decision and the triggers of 016, 021 and 022 stay
    await h.exec(rollback);
    expect(await objects()).toEqual({tables:[null,null],triggers:[],functions:[],column:[],constraint:[]});
    expect(await applied()).toBe(0);
    expect(await counts()).toEqual(rows0);
    expect(await upstream()).toEqual(kept);
    // the decision table is as 021 and 022 left it: their triggers, no new column
    expect((await q<{tgname:string}>("SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgrelid='public.draft_decisions'::regclass ORDER BY 1")).map(r=>r.tgname))
      .toEqual(['draft_decisions_guard','draft_decisions_immutable','draft_decisions_pointer_only_guard']);
    // what the rollback re-opens: a revision stored now is numbered nowhere
    await revision(e2,2,7,'5');
    expect(await counts()).toEqual({...rows0,revisions:5});
    // 3. repeatable once rolled back; forward twice gives the same shape, and every revision, the one written meanwhile too, has its number again
    await h.exec(rollback);
    await h.exec(forward);await h.exec(forward);
    expect(await applied()).toBe(1);
    expect(await objects()).toEqual(full);expect(await upstream()).toEqual(kept);
    expect(await counts()).toEqual({...rows0,revisions:5});
    const again=await numbers();
    expect(again.filter(r=>numbered.some(n=>n.revision===r.revision))).toEqual(numbered);
    expect(again.map(r=>r.seq)).toEqual([1,2,3,4,1]);
    expect((await heads()).map(r=>r.last_seq)).toEqual([4,1]);
  } finally {
    await h.exec('ROLLBACK').catch(()=>{});
    await h.exec(forward);
    for(const f of later) await h.exec(await readFile(dir('migrations/'+f),'utf8'));
    await h.reset();await h.close();
  }
});
