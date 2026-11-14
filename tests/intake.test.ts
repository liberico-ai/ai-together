import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {ZodError} from 'zod';
import {openHarness,type Harness} from './slice1-db';
import {pm,seedSlice1} from './slice1-fixtures';
import {bridgeConfig,chatMulti,chatNotIntake,chatSales,chatTransport,chatUnknown,intakePrincipalId,messageEvent,type EventOverride} from './slice2-fixtures';
import {IntakeService,LATEST_REVISION_ORDER,type EnqueueReceipt} from '../src/server/intake';
import {attachmentVerdict,cleanFileName,qualityScore,redactSecrets,threadKey} from '../src/server/intake-rules';
import {enqueueReceipt} from '../src/server/outbox';
import {ids} from '../src/server/identities';

let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);});
afterEach(async()=>{vi.restoreAllMocks();await h.reset();await h.close();});

const chats=bridgeConfig.intake!.chats;
const svcWith=(scopes=bridgeConfig.chatScopes,enq?:EnqueueReceipt,excerptChats?:string[])=>new IntakeService(h.operator,ids.tenant,intakePrincipalId,scopes,{chats,excerptChats},enq);
// OQ-28 (c): the excerpt flag comes from the operator's intake config; the default fixture carries none.
const flagged=(...flag:string[])=>svcWith(bridgeConfig.chatScopes,undefined,flag);
const svc=()=>svcWith();
const tables=['source_events','source_event_revisions','intake_attachments','intake_candidates','intake_events'];
const count=async(t:string)=>Number((await h.operator.query<{n:string}>(`SELECT count(*) n FROM ${t}`)).rows[0].n);
const allZero=async()=>{for(const t of tables) expect(await count(t),t).toBe(0);};
const hex=(c:string)=>c.repeat(64);
const stored=(c='a',over:Record<string,unknown>={})=>({state:'stored' as const,locator:'gw://libetech/attachments/'+hex(c),sha256:hex(c),mimeType:'application/pdf',sizeBytes:1000,fileName:'a.pdf',...over});
const ev=(o:EventOverride)=>messageEvent(o);
const mapDomain=(project:string,code:string,version=1)=>h.operator.query("INSERT INTO project_domain_mappings(tenant_id,project_id,domain_code,confirmed_by,source,mapping_version) VALUES($1,$2,$3,$4,'synthetic-source',$5)",[ids.tenant,project,code,pm.id,version]);

test('pure rules: key, quality, redaction, file name, verdict',()=>{
  expect(threadKey({messageId:'5'})).toBe('m:5');
  expect(threadKey({messageId:'5',parentThreadKey:'m:1'})).toBe('m:1');
  expect(threadKey({messageId:'5',mediaGroupId:'77',parentThreadKey:'m:1'})).toBe('g:77');
  expect(qualityScore({forwarded:false,textTruncated:false})).toBe(100);
  expect(qualityScore({forwarded:true,textTruncated:true,attachmentState:'failed'})).toBe(20);
  expect(redactSecrets('password=hunter2 ok')).not.toContain('hunter2');
  expect(cleanFileName('../../etc/passwd')).toBe('passwd');
  expect(attachmentVerdict({mimeType:'application/pdf',sizeBytes:20971521})).toBe('too_large');
  expect(attachmentVerdict({mimeType:'application/zip',sizeBytes:1})).toBe('unsupported_type');
});

test('I1 redactSecrets covers compound keys, quoted forms and known token formats; prose stays intact',()=>{
  const must:string[]=['OPENAI_API_KEY=sk-live-XYZ','GITHUB_TOKEN=ghp_XYZ','DB_PASSWORD=hunter2','access_token=XYZ','client_secret: XYZ','{"password":"hunter2"}','"api_key": "XYZ"'];
  const leaks=['sk-live-XYZ','ghp_XYZ','hunter2','XYZ'];
  for(const m of must){const r=redactSecrets(m);expect(r,m).toContain('[đã che]');for(const l of leaks) expect(r,m).not.toContain(l);}
  const fmt:[string,string][]=[
    ['ghp_'+'A1b2C3d4E5f6G7h8I9j0K1','ghp_A1b2'],['gho_'+'A1b2C3d4E5f6G7h8I9j0K1','gho_A1b2'],['github_pat_'+'A1b2C3d4E5f6G7h8I9j0K1','github_pat_A1b2'],
    ['sk-'+'abcdefghij0123456789ABCD','sk-abcdefghij'],['AKIA'+'ABCDEFGHIJKLMNOP','AKIAABCDEF'],['xoxb-'+'1234567890-abcdef','xoxb-1234'],
    ['eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abc_DEF-123','eyJhbGci']];
  for(const [tok,frag] of fmt){const r=redactSecrets(`xin xem ${tok} nhé`);expect(r,tok).not.toContain(frag);expect(r).toContain('[đã che]');expect(r).toContain('xin xem');}
  const u=redactSecrets('mở postgres://admin:S3cretPw@db.example.test:5432/app');
  expect(u).not.toContain('S3cretPw');expect(u).toContain('postgres://admin:');expect(u).toContain('@db.example.test');
  expect(redactSecrets('secretary meeting')).toBe('secretary meeting');
  expect(redactSecrets('tokens are fine')).toBe('tokens are fine');
});

test('DOC-01 a message from an unmapped group is refused and nothing is stored (mức mã; nhóm thật là kiểm runtime)',async()=>{
  for(const chatId of [chatUnknown,chatNotIntake]) await expect(svc().ingest(ev({context:{chatId}}))).rejects.toMatchObject({code:'SCOPE_DENIED',status:403});
  await expect(svcWith({...bridgeConfig.chatScopes,[chatSales]:[]}).ingest(ev({}))).rejects.toMatchObject({code:'SCOPE_DENIED',status:403});
  await allZero();
});

test('intake authority comes from chatScopes, never from project_channels',async()=>{
  await h.operator.query("INSERT INTO project_channels(tenant_id,project_id,chat_id,topic_id,mode,policy_version,proposed_by,state) VALUES($1,$2,$3,'','active','v1',$4,'active')",[ids.tenant,ids.sales,chatUnknown,pm.id]).catch(async()=>{
    await h.operator.query("INSERT INTO project_channels(tenant_id,project_id,chat_id,topic_id,mode,policy_version,proposed_by) VALUES($1,$2,$3,'','active','v1',$4)",[ids.tenant,ids.sales,chatUnknown,pm.id]);
    await h.operator.query("UPDATE project_channels SET state='active' WHERE chat_id=$1",[chatUnknown]).catch(()=>undefined);
  });
  expect(await count('project_channels')).toBe(1);
  await expect(svc().ingest(ev({context:{chatId:chatUnknown}}))).rejects.toMatchObject({code:'SCOPE_DENIED'});
  await expect(svc().ingest(ev({}))).resolves.toMatchObject({persisted:true});
});

test('DOC-02 plain text, a reply, a file and a topic message all land in one inbox',async()=>{
  const first=ev({});
  await svc().ingest(first);
  const reply=await svc().ingest(ev({context:{replyToMessageId:first.context.messageId}}));
  await svc().ingest(ev({attachment:stored('b')}));
  await svc().ingest(ev({context:{topicId:'7'}}));
  const rows=(await h.operator.query<{project_id:string;thread_key:string}>('SELECT project_id,thread_key FROM source_events ORDER BY created_at')).rows;
  expect(rows).toHaveLength(4);
  expect(new Set(rows.map(r=>r.project_id))).toEqual(new Set([ids.sales]));
  expect(rows[1].thread_key).toBe(rows[0].thread_key);
  expect(await count('intake_candidates')).toBe(3);
  expect(reply.candidateRef).toMatch(/^IN-[0-9A-F]{8}$/);
  expect((await h.operator.query<{t:string}>("SELECT topic_id t FROM source_events WHERE topic_id<>''")).rows).toEqual([{t:'7'}]);
});

test('DOC-03 resending the same update keeps one record; an edit adds a revision; a forward is not an author',async()=>{
  const e=ev({});
  const a=await svc().ingest(e),b=await svc().ingest(e);
  expect(b).toMatchObject({replayed:true,sourceEventId:a.sourceEventId,revisionNo:1});
  expect(a.replayed).toBe(false);
  expect(await count('source_events')).toBe(1);expect(await count('source_event_revisions')).toBe(1);
  const edit=await svc().ingest({...e,editedAt:new Date(1760009999000).toISOString(),contentHash:hex('c')});
  expect(edit).toMatchObject({revisionNo:2,replayed:false,receipt:'none'});
  expect(await count('source_events')).toBe(1);expect(await count('intake_candidates')).toBe(1);
  await svc().ingest(ev({forwarded:true}));
  const f=(await h.operator.query<{forwarded:boolean;quality_score:number}>('SELECT forwarded,quality_score FROM source_events WHERE forwarded')).rows;
  expect(f).toEqual([{forwarded:true,quality_score:60}]);
  expect((await h.operator.query('SELECT 1 FROM intake_candidates WHERE decided_by IS NOT NULL')).rows).toHaveLength(0);
});

test('an album keeps every part under one candidate',async()=>{
  const g={context:{mediaGroupId:'5550001'}};
  const r1=await svc().ingest(ev({...g,attachment:stored('1')}));
  const r2=await svc().ingest(ev({...g,attachment:stored('2')}));
  const r3=await svc().ingest(ev({...g,attachment:{state:'failed',reasonCode:'download_failed'}}));
  expect(await count('source_events')).toBe(3);expect(await count('intake_attachments')).toBe(3);expect(await count('intake_candidates')).toBe(1);
  expect(new Set([r1.candidateRef,r2.candidateRef,r3.candidateRef]).size).toBe(1);
  expect(r3).toMatchObject({receipt:'withheld',reason:'ATTACHMENT_NOT_STORED'});
});

test('DOC-04 a failed, oversized or unsupported file never yields a success receipt',async()=>{
  const enq=vi.fn<EnqueueReceipt>(async()=>'queued');
  const s=svcWith(bridgeConfig.chatScopes,enq);
  const cases:[Record<string,unknown>,string][]=[
    [{state:'failed',reasonCode:'download_failed'},'failed'],
    [stored('d',{sizeBytes:20971521}),'too_large'],
    [stored('e',{mimeType:'application/zip'}),'unsupported_type'],
  ];
  for(const [attachment,state] of cases){
    const r=await s.ingest(ev({attachment:attachment as never}));
    expect(r).toMatchObject({persisted:true,receipt:'withheld',reason:'ATTACHMENT_NOT_STORED'});
    const a=(await h.operator.query<{state:string;locator:string|null;sha256:string|null}>('SELECT state,locator,sha256 FROM intake_attachments WHERE source_event_id=$1',[r.sourceEventId])).rows[0];
    expect(a).toEqual({state,locator:null,sha256:null});
  }
  // Task 6: the failure notice is queued, the ack still never claims success.
  expect(enq.mock.calls.map(c=>c[1].template)).toEqual(['intake.attachment_failed','intake.attachment_failed','intake.attachment_failed']);
  expect(await count('source_events')).toBe(3);
});

test('a locator whose hash segment differs from sha256 is rejected',async()=>{
  await expect(svc().ingest(ev({attachment:stored('a',{locator:'gw://libetech/attachments/'+hex('b')})}))).rejects.toMatchObject({code:'ATTACHMENT_HASH_MISMATCH',status:422});
  await expect(svc().ingest(ev({attachment:stored('a',{locator:'https://example.test/x'})}))).rejects.toMatchObject({code:'ATTACHMENT_HASH_MISMATCH'});
  await allZero();
});

test('(2) a body that declares tenant, project, actor or role is rejected',async()=>{
  for(const extra of [{tenantId:ids.tenant},{projectId:ids.sales},{actorId:pm.id},{role:'manager'}])
    await expect(svc().ingest({...ev({}),...extra})).rejects.toBeInstanceOf(ZodError);
  const e=ev({});
  await expect(svc().ingest({...e,context:{...e.context,projectId:ids.sales}})).rejects.toBeInstanceOf(ZodError);
  await allZero();
});

test('(4) a resent message creates no second candidate',async()=>{
  const e=ev({});
  for(let i=0;i<3;i++) await svc().ingest(e);
  expect(await count('intake_candidates')).toBe(1);
  expect(Number((await h.operator.query<{n:string}>("SELECT count(*) n FROM intake_events WHERE kind='candidate.created'")).rows[0].n)).toBe(1);
  const kinds=(await h.operator.query<{kind:string;actor_id:string;actor_kind:string}>('SELECT kind,actor_id,actor_kind FROM intake_events ORDER BY created_at')).rows;
  expect(kinds.map(k=>k.kind).sort()).toEqual(['candidate.created','source_event.persisted']);
  for(const k of kinds) expect(k).toMatchObject({actor_id:intakePrincipalId,actor_kind:'intake_service'});
});

test('DOC-16 an edit or a reply never asks the reporter to re-enter the request',async()=>{
  // the real receipt enqueuer, so the visible "ask again" channel (a second receipt in the group) is measured too (code m-8)
  const s=svcWith(bridgeConfig.chatScopes,enqueueReceipt);
  const e=ev({});
  const a=await s.ingest(e);
  expect(await count('outbox_messages')).toBe(1);
  const b=await s.ingest({...e,editedAt:new Date(1760009999000).toISOString(),contentHash:hex('c')});
  // a follow-up reply to the reporter's own message (it does not call the bot, so the gateway marks it not addressed)
  const c=await s.ingest(ev({addressed:false,context:{replyToMessageId:e.context.messageId}}));
  expect(new Set([a.candidateRef,b.candidateRef,c.candidateRef]).size).toBe(1);
  expect(a.candidateRef).not.toBeNull();
  expect(await count('intake_candidates')).toBe(1);
  expect(await count('outbox_messages')).toBe(1);
  expect([b.receipt,c.receipt]).toEqual(['none','none']);
  // a reply that calls the bot is a new addressed event and gets its own receipt (plan Task 6 :322); it carries the SAME
  // reference, so it never presents the follow-up as a new request to re-enter
  const d=await s.ingest(ev({context:{replyToMessageId:e.context.messageId}}));
  expect(d.candidateRef).toBe(a.candidateRef);
  const refs=(await h.operator.query<{ref:string}>("SELECT payload->'params'->>'ref' AS ref FROM outbox_messages")).rows.map(r=>r.ref);
  expect(refs).toEqual([a.candidateRef,a.candidateRef]);
  expect(await count('intake_candidates')).toBe(1);
});

test('OQ-27 decision (a): a group mapped to several projects is refused with INTAKE_PROJECT_AMBIGUOUS and stores nothing',async()=>{
  await expect(svc().ingest(ev({context:{chatId:chatMulti}}))).rejects.toMatchObject({code:'INTAKE_PROJECT_AMBIGUOUS',status:409});
  await allZero();
});

// OQ-30 (b): the mode belongs to each revision; this reads revision 1 (or the one named).
const modeRows=async(id:string)=>(await h.operator.query<{revision_no:number;content_mode:string;text_excerpt:string|null;content_hash:string}>(
  'SELECT r.revision_no,r.content_mode,r.text_excerpt,r.content_hash FROM source_event_revisions r WHERE r.source_event_id=$1 ORDER BY r.revision_no',[id])).rows;
const modeRow=async(id:string,revisionNo=1)=>(await modeRows(id)).find(r=>r.revision_no===revisionNo)!;
const HASH=/^[a-f0-9]{64}$/;

test('OQ-28 a flagged group with an unmapped project stores the excerpt',async()=>{
  const a=await flagged(chatSales).ingest(ev({text:'token: abc123SECRET chữ riêng'}));
  const r=await modeRow(a.sourceEventId);
  expect(r.content_mode).toBe('excerpt');
  expect(r.text_excerpt).toContain('chữ riêng');
  expect(r.text_excerpt).toContain('[đã che]');
  expect(r.content_hash).toMatch(HASH);
});

test('OQ-28 an unflagged group keeps pointer and hash only even for a XECA project',async()=>{
  await mapDomain(ids.sales,'XECA');
  const a=await svc().ingest(ev({text:'chữ Xeca'}));
  const r=await modeRow(a.sourceEventId);
  expect(r.content_mode).toBe('pointer_only');
  expect(r.text_excerpt).toBeNull();
  expect(r.content_hash).toMatch(HASH);
});

test('OQ-28 an IBS HI project keeps pointer and hash only even in a flagged group',async()=>{
  await mapDomain(ids.transport,'IBS_HI');
  const a=await flagged(chatTransport).ingest(ev({context:{chatId:chatTransport},text:'chữ IBS'}));
  const r=await modeRow(a.sourceEventId);
  expect(r.content_mode).toBe('pointer_only');
  expect(r.text_excerpt).toBeNull();
  expect(r.content_hash).toMatch(HASH);
});

test('OQ-28 the latest mapping row decides: a project remapped to IBS HI stores pointer only, and remapped away from IBS HI stores the excerpt',async()=>{
  await mapDomain(ids.sales,'XECA',1);
  await mapDomain(ids.sales,'IBS_HI',2);
  const a=await flagged(chatSales).ingest(ev({text:'tin sau khi ánh xạ IBS HI'}));
  expect(await modeRow(a.sourceEventId)).toMatchObject({content_mode:'pointer_only',text_excerpt:null});
  await mapDomain(ids.sales,'XECA',3);
  const b=await flagged(chatSales).ingest(ev({text:'tin sau khi ánh xạ lại XECA'}));
  expect(await modeRow(b.sourceEventId)).toMatchObject({content_mode:'excerpt',text_excerpt:'tin sau khi ánh xạ lại XECA'});
});

test('OQ-28 a flag in the request body is never honoured',async()=>{
  const base=ev({text:'chữ không được lưu'});
  const bad=[{...base,contentMode:'excerpt'},{...base,excerpt:true},{...base,context:{...base.context,excerpt:true}}];
  for(const b of bad){
    await expect(svc().ingest(b)).rejects.toBeInstanceOf(ZodError);
    await allZero();
  }
  const a=await svc().ingest(base);
  const r=await modeRow(a.sourceEventId);
  expect(r.content_mode).toBe('pointer_only');
  expect(r.text_excerpt).toBeNull();
  expect(r.content_hash).toMatch(HASH);
});

test('S10 a pointer_only revision\'s text is not written to any table and does not appear in logs',async()=>{
  const secret='ZEBRA-DISTINCT-7731 nội dung riêng';
  const logs:string[]=[];
  for(const m of ['log','info','warn','error','debug'] as const) vi.spyOn(console,m).mockImplementation((...a:unknown[])=>{logs.push(JSON.stringify(a));});
  const r=await svc().ingest(ev({text:secret,actorLabel:'Người gửi',attachment:stored('9')}));
  expect((await modeRow(r.sourceEventId)).content_mode).toBe('pointer_only');
  for(const t of tables){
    const rows=(await h.operator.query<{r:string}>(`SELECT x::text AS r FROM ${t} x`)).rows;
    expect(rows.length,t).toBeGreaterThan(0);
    for(const x of rows) expect(x.r,t).not.toContain('ZEBRA-DISTINCT-7731');
  }
  expect(logs.join('\n')).not.toContain('ZEBRA-DISTINCT-7731');
});

// OQ-30 decided 14/11/2026 (b): each revision is judged with the configuration current when it is written; it may loosen or tighten.
const sha=(t:string)=>createHash('sha256').update(t).digest('hex');
const editOf=(base:ReturnType<typeof ev>,text:string,minutes:number)=>({...base,text,contentHash:sha(text),editedAt:new Date(new Date(base.observedAt).getTime()+minutes*60000).toISOString()});
const auditModes=async(id:string)=>(await h.operator.query<{payload:{revisionNo:number;contentMode:string}}>(
  "SELECT payload FROM intake_events WHERE entity_id=$1 AND entity_type='source_event' ORDER BY created_at,id",[id])).rows.map(r=>r.payload);

test('OQ-30 an edit after the group is flagged stores the excerpt on that revision only',async()=>{
  const base=ev({text:'bản gốc chưa bật cờ'});
  const a=await svc().ingest(base);
  const b=await flagged(chatSales).ingest(editOf(base,'bản sửa sau khi bật cờ',1));
  expect(b).toMatchObject({sourceEventId:a.sourceEventId,revisionNo:2});
  const rows=await modeRows(a.sourceEventId);
  expect(rows.map(r=>[r.revision_no,r.content_mode,r.text_excerpt])).toEqual([[1,'pointer_only',null],[2,'excerpt','bản sửa sau khi bật cờ']]);
  for(const r of rows) expect(r.content_hash).toMatch(HASH);
  expect(await auditModes(a.sourceEventId)).toEqual([{revisionNo:1,contentMode:'pointer_only'},{revisionNo:2,contentMode:'excerpt'}]);
});

test('OQ-30 an edit after the flag is removed keeps pointer and hash only',async()=>{
  const base=ev({text:'bản gốc khi có cờ'});
  const a=await flagged(chatSales).ingest(base);
  const before=await modeRow(a.sourceEventId);
  await svc().ingest(editOf(base,'bản sửa khi đã gỡ cờ',1));
  const rows=await modeRows(a.sourceEventId);
  expect(rows.map(r=>[r.revision_no,r.content_mode,r.text_excerpt])).toEqual([[1,'excerpt','bản gốc khi có cờ'],[2,'pointer_only',null]]);
  expect(rows[0]).toEqual(before);
  expect(rows[1].content_hash).toBe(sha('bản sửa khi đã gỡ cờ'));
  for(const t of tables) for(const x of (await h.operator.query<{r:string}>(`SELECT x::text AS r FROM ${t} x`)).rows) expect(x.r,t).not.toContain('bản sửa khi đã gỡ cờ');
});

test('OQ-30 an edit after the project becomes IBS HI keeps pointer and hash only',async()=>{
  const base=ev({text:'bản gốc chưa ánh xạ'});
  const a=await flagged(chatSales).ingest(base);
  await mapDomain(ids.sales,'IBS_HI');
  await flagged(chatSales).ingest(editOf(base,'bản sửa sau IBS HI',1));
  const rows=await modeRows(a.sourceEventId);
  expect(rows.map(r=>[r.revision_no,r.content_mode,r.text_excerpt])).toEqual([[1,'excerpt','bản gốc chưa ánh xạ'],[2,'pointer_only',null]]);
  expect(await auditModes(a.sourceEventId)).toEqual([{revisionNo:1,contentMode:'excerpt'},{revisionNo:2,contentMode:'pointer_only'}]);
});

test('OQ-30 replaying a stored revision changes nothing after the configuration changes',async()=>{
  const p=ev({text:'tin con trỏ phát lại'}),x=ev({text:'tin có chữ phát lại'});
  const a=await svc().ingest(p),b=await flagged(chatSales).ingest(x);
  const snap=async()=>Promise.all(tables.map(async t=>(await h.operator.query<{r:string}>(`SELECT x::text AS r FROM ${t} x ORDER BY x.id`)).rows));
  const before=await snap();
  expect(await flagged(chatSales).ingest(p)).toMatchObject({sourceEventId:a.sourceEventId,revisionNo:1,replayed:true});
  expect(await svc().ingest(x)).toMatchObject({sourceEventId:b.sourceEventId,revisionNo:1,replayed:true});
  expect(await snap()).toEqual(before);
  expect(await modeRow(a.sourceEventId)).toMatchObject({content_mode:'pointer_only',text_excerpt:null});
  expect(await modeRow(b.sourceEventId)).toMatchObject({content_mode:'excerpt',text_excerpt:'tin có chữ phát lại'});
});

test('a file-only message and hostile file names are stored safely',async()=>{
  const names=['../../etc/passwd','a\u0000b\u0007.pdf','x'.repeat(300)+'.pdf'];
  let i=0;
  for(const fileName of names) await svc().ingest(ev({text:'',attachment:stored(String(++i),{fileName})}));
  const rows=(await h.operator.query<{file_name:string}>('SELECT file_name FROM intake_attachments')).rows;
  expect(rows).toHaveLength(3);
  for(const r of rows){expect(r.file_name).not.toMatch(/[\/\\\u0000-\u001f\u007f]/);expect(r.file_name.length).toBeLessThanOrEqual(200);}
  expect(rows.map(r=>r.file_name)).toContain('passwd');
});

test('credential-like text is stored redacted while the hash stays the gateway\'s',async()=>{
  const e=ev({text:'token: abc123SECRET'});
  const r=await flagged(chatSales).ingest(e);
  const row=(await h.operator.query<{text_excerpt:string;content_hash:string}>('SELECT text_excerpt,content_hash FROM source_event_revisions WHERE source_event_id=$1',[r.sourceEventId])).rows[0];
  expect(row.text_excerpt).not.toContain('abc123SECRET');
  expect(row.text_excerpt).toContain('[đã che]');
  expect(row.content_hash).toBe(e.contentHash);
});

test('an edit that arrives before the original, and edits out of order, are all kept',async()=>{
  const T=(n:number)=>new Date(1760000000000+n*60000).toISOString();
  const base=ev({observedAt:T(0)});
  await svc().ingest({...base,editedAt:T(2),contentHash:hex('2')});
  await svc().ingest({...base,contentHash:hex('0')});
  await svc().ingest({...base,editedAt:T(1),contentHash:hex('1')});
  expect(await count('source_event_revisions')).toBe(3);
  const latest=(await h.operator.query<{revision_no:number;edited_at:Date}>(
    `SELECT r.revision_no,r.edited_at FROM source_event_revisions r JOIN source_events e ON e.id=r.source_event_id ORDER BY ${LATEST_REVISION_ORDER} LIMIT 1`)).rows[0];
  expect(new Date(latest.edited_at).toISOString()).toBe(T(2));
  expect(latest.revision_no).toBe(1);
});

// Codex round 3, finding 4: «latest» is by edited_at whatever arrived first, never by the event's first observed_at.
const latestOf=async()=>(await h.operator.query<{revision_no:number;edited_at:Date|null;content_hash:string}>(
  `SELECT r.revision_no,r.edited_at,r.content_hash FROM source_event_revisions r JOIN source_events e ON e.id=r.source_event_id ORDER BY ${LATEST_REVISION_ORDER} LIMIT 1`)).rows[0];
test('an edit observed after its own edit time that arrives before the original stays the latest revision',async()=>{
  const T=(n:number)=>new Date(1760000000000+n*60000).toISOString();
  const base=ev({});
  await svc().ingest({...base,editedAt:T(2),observedAt:T(5),contentHash:hex('2')});
  await svc().ingest({...base,observedAt:T(6),contentHash:hex('0')});
  await svc().ingest({...base,editedAt:T(1),observedAt:T(7),contentHash:hex('1')});
  expect(await count('source_event_revisions')).toBe(3);
  const latest=await latestOf();
  expect(latest.content_hash).toBe(hex('2'));
  expect(new Date(latest.edited_at!).toISOString()).toBe(T(2));
});

test('in normal order an edit outranks an original observed later than the edit time (two clocks)',async()=>{
  const T=(n:number)=>new Date(1760000000000+n*1000).toISOString();
  const base=ev({});
  await svc().ingest({...base,observedAt:T(5),contentHash:hex('0')});
  await svc().ingest({...base,editedAt:T(3),observedAt:T(6),contentHash:hex('1')});
  const latest=await latestOf();
  expect(latest.content_hash).toBe(hex('1'));
  expect(latest.revision_no).toBe(2);
});

test('two revisions without edited_at: the higher revision_no is the latest',async()=>{
  const base=ev({});
  await svc().ingest({...base,contentHash:hex('0')});
  await svc().ingest({...base,contentHash:hex('5'),attachment:stored('5')});
  expect(await count('source_event_revisions')).toBe(2);
  const latest=await latestOf();
  expect(latest.edited_at).toBeNull();
  expect(latest.revision_no).toBe(2);
});

test('replaying a message after its group moved to another project is SOURCE_EVENT_CONFLICT',async()=>{
  const e=ev({});
  await svc().ingest(e);
  const moved=svcWith({...bridgeConfig.chatScopes,[chatSales]:[ids.transport]});
  await expect(moved.ingest(e)).rejects.toMatchObject({code:'SOURCE_EVENT_CONFLICT',status:409});
  expect(await count('source_events')).toBe(1);
});

test('a failed ingest leaves no row at all',async()=>{
  const boom=svcWith(bridgeConfig.chatScopes,async()=>{throw new Error('enqueue failed');});
  await expect(boom.ingest(ev({}))).rejects.toThrow('enqueue failed');
  await allZero();
});

test('receipts: queued only for a new addressed message; template follows spooled; replay, edit and unaddressed give none',async()=>{
  const calls:Parameters<EnqueueReceipt>[1][]=[];
  const s=svcWith(bridgeConfig.chatScopes,async(_tx,i)=>{calls.push(i);return 'queued';});
  const e=ev({});
  expect(await s.ingest(e)).toMatchObject({receipt:'queued'});
  expect(await s.ingest(e)).toMatchObject({receipt:'none',replayed:true});
  expect(await s.ingest({...e,editedAt:new Date(1760009999000).toISOString(),contentHash:hex('c')})).toMatchObject({receipt:'none',revisionNo:2});
  expect(await s.ingest(ev({addressed:false}))).toMatchObject({receipt:'none'});
  expect(await s.ingest(ev({spooled:true}))).toMatchObject({receipt:'queued'});
  expect(calls.map(c=>c.template)).toEqual(['intake.received','intake.recovered']);
  expect(calls[0]).toMatchObject({tenantId:ids.tenant,projectId:ids.sales,chatId:chatSales,replyToMessageId:e.context.messageId,traceId:expect.any(String),correlationId:expect.any(String)});
  expect(calls[0].params.ref).toMatch(/^IN-/);
  expect(Object.keys(calls[0].params).sort()).toEqual(['observedAt','ref']);
});

test('M1 one ingest shares one request_id across its intake_events rows',async()=>{
  const r=await svc().ingest(ev({}));
  const rows=(await h.operator.query<{request_id:string}>('SELECT request_id FROM intake_events')).rows;
  expect(rows.length).toBe(2);
  expect(new Set(rows.map(x=>x.request_id)).size).toBe(1);
  const r2=await svc().ingest(ev({}));
  expect(r2.sourceEventId).not.toBe(r.sourceEventId);
  expect((await h.operator.query('SELECT DISTINCT request_id FROM intake_events')).rows).toHaveLength(2);
});

test('M4 computed source fields: locator, source_id, source_actor, correlation_id',async()=>{
  const e=ev({context:{telegramId:'424242'}});
  const r=await svc().ingest(e);
  const row=(await h.operator.query<{locator:string;source_id:string;source_actor:string;correlation_id:string;trace_id:string}>('SELECT locator,source_id,source_actor,correlation_id,trace_id FROM source_events WHERE id=$1',[r.sourceEventId])).rows[0];
  expect(row.locator).toBe(`https://t.me/c/${chatSales.slice(4)}/${e.context.messageId}`);
  expect(row.locator).toBe(`https://t.me/c/0000000001/${e.context.messageId}`);
  expect(row.source_id).toBe(`telegram:${chatSales}:${e.context.messageId}`);
  expect(row.source_actor).toBe('tg:424242');
  expect(row.trace_id).toBe(e.traceId);
  expect(row.correlation_id).toMatch(/^[0-9a-f-]{36}$/);
  expect(row.correlation_id).not.toBe(e.traceId);
  const legacy='-5000000001';
  const s2=new IntakeService(h.operator,ids.tenant,intakePrincipalId,{...bridgeConfig.chatScopes,[legacy]:[ids.sales]},{chats:[...chats,legacy]});
  const r2=await s2.ingest(ev({context:{chatId:legacy}}));
  expect((await h.operator.query<{locator:string}>('SELECT locator FROM source_events WHERE id=$1',[r2.sourceEventId])).rows[0].locator).toBe('');
});

const rep=(s:string,n:number)=>s.repeat(Math.ceil(n/s.length)).slice(0,n);
const r21Shapes=(n:number):Record<string,string>=>({
  a_token_:rep('a_token_',n),
  _secret:rep('_secret',n),
  run:'a'.repeat(n),
  'password=':rep('password=',n),
  'token ':rep('token ',n),
  'token every 10':rep('abcd_token_',n).replace(/_/g,(_m,i:number)=>i%2?'x':'_'),
  'token every 10 plain':rep('tokenabcde',n),
});
test('R2-1 redactSecrets stays linear on adversarial 12 KB inputs',()=>{
  const shapes=r21Shapes(12288);
  let total=0;
  for(const [k,v] of Object.entries(shapes)){
    const t0=performance.now();redactSecrets(v);const dt=performance.now()-t0;total+=dt;
    console.info('redact timing',k,Math.round(dt),'ms');
  }
  expect(total).toBeLessThan(200);
});

test('R2-2 an unquoted value is redacted to the next whitespace; a quoted value to its matching quote',()=>{
  for(const [input,leak] of [['password=abc;def','def'],['token=ab,cd','cd'],['secret=a}b','b'],['api_key=x"y"z','z'],
    ["password='it\"s;ok, fine'",'fine'],['password="a\'b,c;d"','c;d'],['DB_PASSWORD=p@ss;w0rd,x','w0rd']] as const){
    const r=redactSecrets('trước '+input+' sau');
    expect(r,input).not.toContain(leak);expect(r).toContain('[đã che]');expect(r.startsWith('trước ')).toBe(true);
  }
  expect(redactSecrets('token=ab cd')).toBe('token=[đã che] cd');
});

test('R2-3 ingest writes run as libetech_intake: current_user is the role and an out-of-grant column is denied',async()=>{
  let who='',denied='';
  const s=svcWith(bridgeConfig.chatScopes,async tx=>{
    who=(await tx.query<{u:string}>('SELECT current_user u')).rows[0].u;
    await tx.query('SAVEPOINT probe');
    try{await tx.query("INSERT INTO source_event_revisions(tenant_id,project_id,source_event_id,revision_no,revision_key,content_hash,created_at) SELECT tenant_id,project_id,id,99,$1,$1,now() FROM source_events",[hex('f')]);}
    catch(err){denied=String((err as Error).message);}
    await tx.query('ROLLBACK TO SAVEPOINT probe');
    return 'none';
  });
  await s.ingest(ev({}));
  expect(who).toBe('libetech_intake');
  expect(denied).toMatch(/permission denied/);
  expect(await count('source_event_revisions')).toBe(1);
});

test('R3 camelCase and no-underscore key names, long prefixes, and the earlier cases stay covered',()=>{
  for(const [input,leak] of [['accessToken=XYZ','XYZ'],['{"clientSecret": "XYZ"}','XYZ'],['DBPASSWORD=hunter2','hunter2'],['apiKey: XYZ','XYZ'],
    ['PASSWORD_'+'a'.repeat(40)+'=xleak','xleak'],['OPENAI_API_KEY=sk-live-XYZ','XYZ'],['"api_key": "XYZ"','XYZ']] as const){
    const r=redactSecrets(input);
    expect(r,input).not.toContain(leak);expect(r,input).toContain('[đã che]');
  }
  expect(redactSecrets('secretary meeting')).toBe('secretary meeting');
  expect(redactSecrets('tokens are fine')).toBe('tokens are fine');
});

test('R4 key names of any length before or after the keyword are redacted, with = and :',()=>{
  const affixes=['a'.repeat(49),rep('my_',64),rep('Ab',128)];
  expect(affixes.map(a=>a.length)).toEqual([49,64,128]);
  for(const a of affixes) for(const kw of ['password','token']) for(const sep of ['=',': ']) for(const key of [a+kw,kw+'_'+a]){
    expect(redactSecrets(`trước ${key}${sep}leakvalue sau`),key+sep).toBe(`trước ${key}${sep}[đã che] sau`);
  }
});

test('R4 a non-secret pair never shields a later secret in the same run; hyphenated and two-word keys stay covered',()=>{
  for(const [input,leak] of [
    ['user=bob&password=hunter2','hunter2'],['Server=db;Database=app;User Id=u;Password=hunter2;','hunter2'],
    ['user:bob,password:hunter2','hunter2'],['a=1=token=leak9','leak9'],
    ['curl -H "X-API-Key: leak9" https://x.test','leak9'],['api-key=leak9','leak9'],['private-key: leak9','leak9'],
    ['API key: leak9','leak9'],['"api key": "leak9"','leak9'],["{'Private Key': 'leak9'}",'leak9'],
    ['x-eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abc_DEF-123','eyJhbGci'],['a.b.eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abc','eyJhbGci'],
    ['1.postgres://admin:S3cretPw@db.example.test','S3cretPw'],
  ] as const){
    const r=redactSecrets('trước '+input+' sau');
    expect(r,input).not.toContain(leak);expect(r,input).toContain('[đã che]');expect(r.startsWith('trước ')).toBe(true);
  }
  expect(redactSecrets('user=bob&password=hunter2')).toBe('user=bob&password=[đã che]');
  expect(redactSecrets('see db.example.test and a.b.c')).toBe('see db.example.test and a.b.c');
});

test('R4 redactSecrets stays linear at 12 KB and 48 KB, including scheme-like runs with no ://',()=>{
  const extra=(n:number):Record<string,string>=>({
    'a-':rep('a-',n),'token-':rep('token-',n),'a+b.c-':rep('a+b.c-',n),'sk-':rep('sk-',n),'xoxb-':rep('xoxb-',n),
    'ab:/':rep('ab:/',n),'a://b:':rep('a://b:',n),'eyJ-':rep('eyJ-',n),'eyJa.':rep('eyJa.',n),'a.':rep('a.',n),
    'a=':rep('a=',n),'token=':rep('token=',n),'api ':rep('api ',n),'token="':rep('token="',n),
    'x_api ':rep('x_api ',n),'api key ':rep('api key ',n),'x-private key ':rep('x-private key ',n),'api\\n':rep('api\n',n),
    'x_api one word':rep('x_api',n),'x_api one word + key':rep('x_api',n-5)+' key=',
  });
  let total=0;
  for(const n of [12288,49152]) for(const [k,v] of Object.entries({...r21Shapes(n),...extra(n)})){
    const t0=performance.now();redactSecrets(v);const dt=performance.now()-t0;total+=dt;
    console.info('redact timing',n,k,dt.toFixed(1),'ms');
  }
  console.info('redact timing total',total.toFixed(1),'ms');
  expect(total).toBeLessThan(200);
});

test('R5 two-word keys glued after a prefix (X-Api Key, client_api key, Stripe-Private Key) are masked',()=>{
  for(const [input,leak] of [
    ['X-Api Key: abc123','abc123'],['client_api key: abc9','abc9'],['OpenAI_API KEY=abc9','abc9'],['Stripe-Private Key: abc9','abc9'],
    ['myprivate key: abc9','abc9'],['bot-api key = abc9','abc9'],['"X-Api Key": "abc9"','abc9'],['X-Api KeyId: abc9','abc9'],
  ] as const){
    const r=redactSecrets('trước '+input+' sau');
    expect(r,input).not.toContain(leak);expect(r,input).toContain('[đã che]');expect(r.startsWith('trước ')).toBe(true);
  }
  expect(redactSecrets('X-Api Key: abc123')).toBe('X-Api Key: [đã che]');
  expect(redactSecrets('monkey key: visible')).toBe('monkey key: visible');
  expect(redactSecrets('secretary meeting')).toBe('secretary meeting');
  expect(redactSecrets('tokens are fine')).toBe('tokens are fine');
});

// Security I1. All values are synthetic. The PEM header is assembled from parts so a secret scanner reading this file
// does not take the fixture for a real key.
const pem=(kind:string,body:string,end=true)=>['-----BEGIN '+kind+' PRIVATE'+' KEY-----',body,...(end?['-----END '+kind+' PRIVATE'+' KEY-----']:[])].join('\n');
test('I1 Vietnamese and plain credential phrasings, Basic auth, PEM blocks and «<keyword> is <value>» are masked',()=>{
  const cases:[string,string][]=[
    ['mật khẩu: Vn2026abc','Vn2026abc'],['Mật khẩu wifi: Vn2026abc','Vn2026abc'],['MẬT KHẨU = Vn2026abc','Vn2026abc'],
    ['mat khau: Vn2026abc','Vn2026abc'],['matkhau=Vn2026abc','Vn2026abc'],['Mat khau server: Vn2026abc','Vn2026abc'],
    ['mật khẩu là Vn2026abc','Vn2026abc'],['mật khẩu wifi là Vn2026abc','Vn2026abc'],['mat khau la Vn2026abc','Vn2026abc'],
    ['mk: Vn2026abc','Vn2026abc'],['MK=Vn2026abc','Vn2026abc'],['mk wifi: Vn2026abc','Vn2026abc'],
    ['pass: Vn2026abc','Vn2026abc'],['Pass wifi: Vn2026abc','Vn2026abc'],['DB_PASS=Vn2026abc','Vn2026abc'],['wifi-pass: Vn2026abc','Vn2026abc'],
    ['passcode=482913','482913'],['passcode là 482913','482913'],['otp: 482913','482913'],['mã OTP là 482913','482913'],['otp is 482913','482913'],
    ['password is Vn2026abc','Vn2026abc'],['the token is Vn2026abc','Vn2026abc'],['secret là Vn2026abc','Vn2026abc'],
    ['Authorization: Basic dXNlcjpzeW50aGV0aWM=','dXNlcjpzeW50aGV0aWM'],['{"Authorization": "Basic dXNlcjpzeW50aGV0aWM="}','dXNlcjpzeW50aGV0aWM'],
    ['curl -H "authorization: basic dXNlcjpzeW50aGV0aWM="','dXNlcjpzeW50aGV0aWM'],['dùng Basic dXNlcjpzeW50aGV0aWM nhé','dXNlcjpzeW50aGV0aWM'],
    [pem('OPENSSH','c3ludGhldGljLW9wZW5zc2gtYm9keQ\nAAAAsynthetic'),'c3ludGhldGlj'],[pem('RSA','MIIEsyntheticRSAbody'),'MIIEsynthetic'],
    [pem('','MIGHsyntheticPKCS8'),'MIGHsynthetic'],[pem('ENCRYPTED','MIIFsyntheticEnc'),'MIIFsynthetic'],
    // the excerpt is cut at 4096 characters before redaction, so a block that lost its END line is still masked to the end
    [pem('OPENSSH','b3BlbnNzaC1zeW50aGV0aWM\nmore-synthetic-lines',false),'more-synthetic'],
  ];
  for(const [input,leak] of cases){
    const r=redactSecrets('trước '+input+' sau');
    expect(r,input).not.toContain(leak);expect(r,input).toContain('[đã che]');expect(r.startsWith('trước '),input).toBe(true);
  }
  // the value is masked, never the linking word; the keyword and the header stay readable
  expect(redactSecrets('password is Vn2026abc')).toBe('password is [đã che]');
  expect(redactSecrets('mật khẩu là Vn2026abc nhé')).toBe('mật khẩu là [đã che] nhé');
  expect(redactSecrets('Mật khẩu wifi: Vn2026abc')).toBe('Mật khẩu wifi: [đã che]');
  expect(redactSecrets('mk: Vn2026abc')).toBe('mk: [đã che]');
  expect(redactSecrets('Authorization: Basic dXNlcjpzeW50aGV0aWM=')).toBe('Authorization: Basic [đã che]');
  expect(redactSecrets('khoá: '+pem('OPENSSH','c3ludGhldGlj')+'\nhết')).toBe('khoá: [đã che]\nhết');
});

test('I1 ordinary Vietnamese and English words near the new keywords stay as written',()=>{
  for(const t of ['pass qua bước kiểm tra rồi','pass qua là xong','mk đi trước nhé','mk là sinh viên năm hai','mkdir -p /tmp/x','smk: 3',
    'bypass: bật','compass: hướng bắc','passenger: 3','mật khẩu mới đã đổi xong','gửi lại mã otp nhé','Basic training tuần sau',
    'Basic understanding of the flow','pin: 80%','pin là 4000mAh','secretary meeting','tokens are fine'])
    expect(redactSecrets(t),t).toBe(t);
});

test('I1 the new rules stay linear at 12 KB and 48 KB',()=>{
  const shapes=(n:number):Record<string,string>=>({
    'mật khẩu ':rep('mật khẩu ',n),'mat khau wifi ':rep('mat khau wifi ',n),'mk a-':rep('mk a-',n),'mk-':rep('mk-',n),'pass wifi ':rep('pass wifi ',n),
    'otp ':rep('otp ',n),'password is ':rep('password is ',n),'Basic ':rep('Basic ',n),'Basic aB':rep('Basic aB',n),
    'authorization: basic ':rep('authorization: basic ',n),'-----BEGIN ':rep('-----BEGIN ',n),'BEGIN header':rep('-----BEGIN RSA PRIVATE'+' KEY-----\n',n),
  });
  let total=0;
  for(const n of [12288,49152]) for(const [k,v] of Object.entries(shapes(n))){
    const t0=performance.now();redactSecrets(v);const dt=performance.now()-t0;total+=dt;
    console.info('redact timing I1',n,k,dt.toFixed(1),'ms');
  }
  expect(total).toBeLessThan(200);
});

test('Sec M4 attachment file names lose bidi and other Unicode format characters at ingest',()=>{
  for(const [input,out] of [['hoa-don‮fdp.exe','hoa-donfdp.exe'],['⁦bao-cao⁩.pdf','bao-cao.pdf'],['a‎‏b.pdf','ab.pdf'],
    ['﻿x.pdf','x.pdf'],['a‪‫‬‭b.txt','ab.txt'],['a⁧⁨b.csv','ab.csv'],['a\u0000\u001f\u007fb.pdf','ab.pdf'],
    ['Báo cáo tháng 11.pdf','Báo cáo tháng 11.pdf'],['../../etc/passwd','passwd']] as const)
    expect(cleanFileName(input),JSON.stringify(input)).toBe(out);
});

test('OQ-27 a group whose config lists the same project twice is one project and is taken in',async()=>{
  const dup={...bridgeConfig.chatScopes,[chatSales]:[ids.sales,ids.sales]};
  const ack=await svcWith(dup).ingest(ev({context:{chatId:chatSales}}));
  expect(ack.persisted).toBe(true);
  const rows=(await h.operator.query<{project_id:string}>('SELECT project_id FROM source_events')).rows;
  expect(rows).toEqual([{project_id:ids.sales}]);
});

test('OQ-27 a duplicated id next to a second project is still ambiguous',async()=>{
  const dup={...bridgeConfig.chatScopes,[chatSales]:[ids.sales,ids.sales,ids.transport]};
  await expect(svcWith(dup).ingest(ev({context:{chatId:chatSales}}))).rejects.toMatchObject({code:'INTAKE_PROJECT_AMBIGUOUS',status:409});
  await allZero();
});
