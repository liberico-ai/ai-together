import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {native,openHarness,type Harness} from './slice1-db';
import {seedSlice1} from './slice1-fixtures';
import {bridgeConfig,chatSales,intakeKey,intakePrincipalId,botKey,messageEvent,type EventOverride} from './slice2-fixtures';
import {canaryHits as scanCanary,chatPool,poolOverride,seedTech,techA} from './pool-fixtures';
import {pm} from './slice1-fixtures';
import {seedMembers} from './slice3-fixtures';
import {IntakeService,refOf} from '../src/server/intake';
import {OutboxService} from '../src/server/outbox';
import {IdentityService} from '../src/server/identity';
import {asRole} from './pool-fixtures';
import {parseBridgeConfig,requireBridgeConfig} from '../src/server/bridge-config';
import {ids} from '../src/server/identities';

// GIAO VIỆC 5 B, T2/T3: a message of a pool group becomes a pool item (no text, no file name, no sender label) and gets its own receipt.
let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);await seedTech(h);});
afterEach(async()=>{await h.reset();await h.close();});

type R=Record<string,unknown>;
const CANARY='canary-7f3a91';
const poolCfg={chats:bridgeConfig.intake!.chats,excerptChats:[chatSales,chatPool],poolChats:[chatPool]};
const svc=(scopes:Record<string,string[]>=bridgeConfig.chatScopes,cfg=poolCfg)=>new IntakeService(h.operator,ids.tenant,intakePrincipalId,scopes,cfg);
const rows=async<T=R>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const n=async(t:string)=>Number((await rows<{n:string}>(`SELECT count(*) n FROM ${t}`))[0].n);
const ev=(o:EventOverride={})=>messageEvent({...poolOverride(),...o,context:{...poolOverride().context,...o.context}});
const hex=(c:string)=>c.repeat(64);
const canaryHits=()=>scanCanary(h,CANARY);
const stored=(c='a',over:R={})=>({state:'stored' as const,locator:'gw://libetech/attachments/'+hex(c),sha256:hex(c),mimeType:'application/pdf',sizeBytes:1000,fileName:`${CANARY}.pdf`,...over});
const poolTables=['intake_pool_items','intake_pool_events','intake_work_links','source_events','source_event_revisions','intake_attachments','intake_candidates','intake_events','outbox_messages'];
const allZero=async()=>{for(const t of poolTables) expect(await n(t),t).toBe(0);};

describe('T2 receiving a message of a pool group',()=>{
  test('(8) the canary in the text, the file name and the sender label is found in no column of any table',async()=>{
    expect(await n('intake_pool_items')).toBe(0);
    const ack=await svc().ingest(ev({text:`xin gửi ${CANARY} vào nhóm`,actorLabel:`Người gửi ${CANARY}`,attachment:stored()}));
    expect(ack).toMatchObject({persisted:true,replayed:false,receipt:'queued'});
    expect(await n('intake_pool_items')).toBe(1);
    expect(await canaryHits()).toEqual([]);
    // what is kept: pointers, a hash, mime and size; the ack carries the IN code of the pool item
    const item=(await rows<R>('SELECT * FROM intake_pool_items'))[0];
    expect(item).toMatchObject({project_id:null,state:'unassigned',sender_id:techA.id,chat_id:chatPool,revision_count:0,version:1,attachment_mime:'application/pdf'});
    expect(ack.candidateRef).toBe(refOf(String(item.id)));
    expect(ack.sourceEventId).toBe(item.id);
    // the project-bound intake tables stay empty for a pool message
    for(const t of ['source_events','source_event_revisions','intake_attachments','intake_candidates','intake_events']) expect(await n(t),t).toBe(0);
    expect((await rows<{kind:string;actor_kind:string}>('SELECT kind,actor_kind FROM intake_pool_events')).map(e=>e.kind+'/'+e.actor_kind)).toEqual(['pool.received/intake_service']);
  });

  test('(9) a sender who is not linked, not on the roster or not addressing the bot leaves nothing and gets no receipt',async()=>{
    expect(await n('intake_pool_items')).toBe(0);
    const denied=async(o:EventOverride)=>expect(svc().ingest(ev(o))).rejects.toMatchObject({code:'SCOPE_DENIED',status:403});
    await denied({context:{telegramId:'900000555'}});                 // not linked to anyone
    await denied({context:{telegramId:'900000201'}});                 // linked, a project manager, not on the roster
    await denied({addressed:false});                                  // on the roster, not calling the bot
    await h.operator.query('DELETE FROM identity.tech_roster WHERE user_id=$1',[techA.id]);
    await denied({});                                                 // removed from the roster since
    await allZero();
    // a roster member who is no longer active
    await h.operator.query('INSERT INTO identity.tech_roster(tenant_id,user_id) VALUES($1,$2)',[ids.tenant,techA.id]);
    await h.operator.query('UPDATE identity.users SET active=false WHERE id=$1',[techA.id]);
    await denied({});
    await allZero();
  });

  test('(10) the same message again is a replay; an edit raises the revision count and writes pool.revised; no second item',async()=>{
    expect(await n('intake_pool_items')).toBe(0);
    const first=ev({});
    const a=await svc().ingest(first);
    expect(a.replayed).toBe(false);
    const b=await svc().ingest(first);
    expect(b).toMatchObject({replayed:true,sourceEventId:a.sourceEventId,receipt:'none'});
    expect(await n('intake_pool_items')).toBe(1);
    expect(await n('outbox_messages')).toBe(1);
    // an edit: a newer edit time and a new hash
    const edited={...first,editedAt:new Date(Date.parse(first.observedAt)+60000).toISOString(),contentHash:hex('e'),text:'đã sửa'};
    const c=await svc().ingest(edited);
    expect(c).toMatchObject({replayed:false,sourceEventId:a.sourceEventId,receipt:'none'});
    expect(c.revisionNo).toBe(2);
    const item=(await rows<R>('SELECT * FROM intake_pool_items'))[0];
    expect(item).toMatchObject({revision_count:1,content_hash:hex('e'),version:2});
    // the same edit once more, and an older edit arriving late: replays
    expect((await svc().ingest(edited)).replayed).toBe(true);
    expect((await svc().ingest({...first,editedAt:new Date(Date.parse(first.observedAt)+1000).toISOString(),contentHash:hex('f')})).replayed).toBe(true);
    expect((await rows<R>('SELECT * FROM intake_pool_items'))[0]).toMatchObject({revision_count:1,content_hash:hex('e')});
    expect((await rows<{kind:string}>('SELECT kind FROM intake_pool_events')).map(e=>e.kind).sort()).toEqual(['pool.received','pool.revised']);
    expect(await n('outbox_messages')).toBe(1);
  });

  test.runIf(native)('(10) two sends of the same message at once leave one item and one receipt (native)',async()=>{
    const e=ev({});
    const results=await Promise.allSettled([svc().ingest(e),svc().ingest(e),svc().ingest(e)]);
    expect(results.every(r=>r.status==='fulfilled')).toBe(true);
    expect((results as PromiseFulfilledResult<{replayed:boolean}>[]).filter(r=>!r.value.replayed)).toHaveLength(1);
    expect(await n('intake_pool_items')).toBe(1);
    expect(await n('outbox_messages')).toBe(1);
  });

  test('(11) a pool group is refused at load when it is also an intake chat, an excerpt chat or a group with a project in chatScopes (503); a service handed such a group still gives no project',async()=>{
    expect(await n('intake_pool_items')).toBe(0);
    // defence in depth: the service never reads chatScopes for a pool group
    await svc({...bridgeConfig.chatScopes,[chatPool]:[ids.sales]}).ingest(ev({}));
    expect((await rows<R>('SELECT project_id FROM intake_pool_items'))[0].project_id).toBeNull();
    expect(await n('source_events')).toBe(0);
    // the config: a pool group has no project of its own anywhere
    const base={key:botKey,chatScopes:{[chatSales]:[ids.sales]},intake:{key:intakeKey,principalId:intakePrincipalId,chats:[chatSales]}};
    expect(parseBridgeConfig({...base,intake:{...base.intake,poolChats:[chatPool]}}).intake?.poolChats).toEqual([chatPool]);
    expect(parseBridgeConfig({...base,chatScopes:{...base.chatScopes,[chatPool]:[]},intake:{...base.intake,poolChats:[chatPool]}}).intake?.poolChats).toEqual([chatPool]);
    expect(()=>parseBridgeConfig({...base,chatScopes:{...base.chatScopes,[chatPool]:[ids.sales]},intake:{...base.intake,poolChats:[chatPool]}})).toThrow('Intake pool chats must not grant a project in chatScopes.');
    expect(()=>parseBridgeConfig({...base,chatScopes:{...base.chatScopes,[chatPool]:[ids.sales]},intake:{...base.intake,chats:[chatSales,chatPool],poolChats:[chatPool]}})).toThrow(/pool/i);
    expect(()=>parseBridgeConfig({...base,intake:{...base.intake,chats:[chatSales],excerptChats:[chatSales],poolChats:[chatSales]}})).toThrow(/pool/i);
    expect(()=>parseBridgeConfig({...base,intake:{...base.intake,poolChats:['not-a-chat']}})).toThrow();
    const dir=await mkdtemp(path.join(tmpdir(),'gv5b-cfg-'));
    const was=process.env.LIBETECH_BRIDGE_CONFIG;
    try {
      const file=path.join(dir,'bridge.json');
      await writeFile(file,JSON.stringify({...base,chatScopes:{...base.chatScopes,[chatPool]:[ids.sales]},intake:{...base.intake,poolChats:[chatPool]}}),{mode:0o600});
      process.env.LIBETECH_BRIDGE_CONFIG=file;
      await expect(requireBridgeConfig('INTAKE_UNCONFIGURED')).rejects.toMatchObject({code:'INTAKE_UNCONFIGURED',status:503});
      await writeFile(file,JSON.stringify({...base,intake:{...base.intake,poolChats:[chatPool]}}),{mode:0o600});
      await expect(requireBridgeConfig('INTAKE_UNCONFIGURED')).resolves.toMatchObject({intake:{poolChats:[chatPool]}});
    } finally {
      if(was===undefined) delete process.env.LIBETECH_BRIDGE_CONFIG;else process.env.LIBETECH_BRIDGE_CONFIG=was;
      await rm(dir,{recursive:true,force:true});
    }
    await expect(svc(bridgeConfig.chatScopes,{...poolCfg,chats:[chatSales,chatPool]}).ingest(ev({}))).rejects.toMatchObject({code:'SCOPE_DENIED'});
  });

  test('(3) the stored hash is only compared: a newer edit with a new hash is a revision, with the same hash nothing is written; a free-text mime type is not stored (8)',async()=>{
    const first=ev({});
    await svc().ingest(first);
    const later=(ms:number)=>new Date(Date.parse(first.observedAt)+ms).toISOString();
    const same=await svc().ingest({...first,editedAt:later(60000)});
    expect(same.replayed).toBe(true);
    expect(await n('intake_pool_events')).toBe(1);
    expect((await rows<R>('SELECT * FROM intake_pool_items'))[0]).toMatchObject({revision_count:0,version:1});
    const changed=await svc().ingest({...first,editedAt:later(60000),contentHash:hex('9')});
    expect(changed.replayed).toBe(false);
    expect((await rows<{kind:string}>('SELECT kind FROM intake_pool_events')).map(e=>e.kind).sort()).toEqual(['pool.received','pool.revised']);
    // (8) a mime type that is not a mime type is dropped, a real one is kept
    for(const [i,mime,want] of [[0,`${CANARY} không phải mime`,null],[1,'application/pdf','application/pdf'],[2,'text/plain; x='+CANARY,null]] as const){
      const e=ev({context:{messageId:String(5000+i)},attachment:stored(String(i),{mimeType:mime,fileName:undefined})});
      await svc().ingest(e);
      expect((await rows<R>('SELECT attachment_mime FROM intake_pool_items WHERE message_id=$1',[String(5000+i)]))[0].attachment_mime,mime).toBe(want);
    }
    expect(await canaryHits()).toEqual([]);
  });
});

describe('T3 the receipt of a pool item',()=>{
  const outboxRows=()=>rows<R>('SELECT * FROM outbox_messages ORDER BY created_at,id');
  test('(13) a new pool message queues one receipt without project; its params are the ref and the time only; sending again adds none',async()=>{
    expect(await n('intake_pool_items')).toBe(0);
    const e=ev({text:`${CANARY} nội dung`});
    await svc().ingest(e);
    await svc().ingest(e);
    const out=await outboxRows();
    expect(out).toHaveLength(1);
    const item=(await rows<{id:string}>('SELECT id FROM intake_pool_items'))[0];
    expect(out[0]).toMatchObject({project_id:null,pool_item_id:item.id,template:'intake.pool_received',audience:'group',target_chat_id:chatPool,reply_to_message_id:e.context.messageId,state:'pending',source_event_id:null,candidate_id:null});
    expect(Object.keys((out[0].payload as {params:R}).params).sort()).toEqual(['observedAt','ref']);
    expect((out[0].payload as {params:R}).params).toMatchObject({ref:refOf(item.id)});
    expect(JSON.stringify(out[0].payload)).not.toContain(CANARY);
  });

  test('(14) a group row without project and without pool_item_id is refused by the CHECK; a pool row with another template or with a project is refused',async()=>{
    expect(await n('intake_pool_items')).toBe(0);
    await svc().ingest(ev({}));
    const item=(await rows<{id:string}>('SELECT id FROM intake_pool_items'))[0];
    const base=(over:R={})=>{
      const o={project:null,pool:null,template:'intake.pool_received',chat:chatPool,reply:'5',...over};
      return h.operator.query(`INSERT INTO outbox_messages(tenant_id,project_id,pool_item_id,event_id,event_type,trace_id,correlation_id,audience,target_chat_id,reply_to_message_id,template,payload,dedupe_key)
        VALUES($1,$2,$3,$4,$5,$6,$7,'group',$8,$9,$10,'{"params":{}}',$11)`,[ids.tenant,o.project,o.pool,randomUUID(),String(o.template),randomUUID(),randomUUID(),String(o.chat),o.reply,String(o.template),'t-'+randomUUID()]);
    };
    await expect(base({})).rejects.toThrow();                                       // no pool item, no project
    await expect(base({pool:item.id,template:'intake.received'})).rejects.toThrow(); // a pool row with a project template
    await expect(base({pool:item.id,project:ids.sales})).rejects.toThrow();         // both
    expect(await n('outbox_messages')).toBe(1);
  });

  test('(14) the pull with only a pool group configured leases the pool receipt and nothing of a project outside its scope; the Team Tech roster reads the receipt state, nobody else does',async()=>{
    expect(await n('intake_pool_items')).toBe(0);
    const e=ev({});
    await svc().ingest(e);
    // a project receipt that the pool-only pull must not see: a sales group message through the ordinary path
    await svc().ingest(messageEvent({context:{chatId:chatSales}}));
    expect(await n('outbox_messages')).toBe(2);
    const outbox=new OutboxService(h.operator,new IdentityService(h.operator,ids.tenant),{id:intakePrincipalId,tenantId:ids.tenant,projectIds:[]},true);
    const pulled=await outbox.pull({limit:5});
    expect(pulled.deliveries).toHaveLength(1);
    expect(pulled.deliveries[0]).toMatchObject({audience:'group',chatId:chatPool,replyToMessageId:e.context.messageId});
    expect(pulled.deliveries[0].envelope.payload.template).toBe('intake.pool_received');
    expect(Object.keys(pulled.deliveries[0].envelope.payload.params).sort()).toEqual(['observedAt','ref']);
    // without the pool flag an empty scope fails closed as before
    await expect(new OutboxService(h.operator,new IdentityService(h.operator,ids.tenant),{id:intakePrincipalId,tenantId:ids.tenant,projectIds:[]}).pull({limit:5})).rejects.toMatchObject({code:'UNAUTHENTICATED'});
    // delivered receipt reported: the pool receipt is delivered
    const d=pulled.deliveries[0];
    await outbox.report({receipts:[{outboxId:d.outboxId,attemptNo:d.attemptNo,leaseToken:d.leaseToken,phase:'send',outcome:'delivered',telegramMessageId:'77',reportedAt:new Date().toISOString()}]});
    expect((await rows<R>("SELECT state FROM outbox_messages WHERE template='intake.pool_received'"))[0].state).toBe('delivered');
    const seen=(who:string,projects:string[])=>asRole(h,'libetech_runtime',{person:who,projects},async tx=>(await tx.query('SELECT state FROM outbox_messages WHERE pool_item_id IS NOT NULL')).rows.length);
    expect(await seen(techA.id,[ids.transport])).toBe(1);
    expect(await seen(pm.id,[ids.sales,ids.transport])).toBe(0);
    const receipts=(who:string,projects:string[])=>asRole(h,'libetech_runtime',{person:who,projects},async tx=>(await tx.query('SELECT 1 FROM delivery_receipts WHERE project_id IS NULL')).rows.length);
    expect(await receipts(techA.id,[ids.transport])).toBe(1);
    expect(await receipts(pm.id,[ids.sales])).toBe(0);
  });
  test('(15) the pool rows of the outbox are tenant-bound: another tenant and no context read nothing, write nothing and update nothing',async()=>{
    expect(await n('intake_pool_items')).toBe(0);
    const e=ev({});
    await svc().ingest(e);
    const item=(await rows<{id:string}>('SELECT id FROM intake_pool_items'))[0].id;
    const asIntake=(ctx:{tenant?:string|null},fn:(tx:{query:<T=R>(sql:string,p?:unknown[])=>Promise<{rows:T[]}>})=>Promise<unknown>)=>asRole(h,'libetech_intake',{...ctx,person:intakePrincipalId},fn);
    expect(await asIntake({},async tx=>(await tx.query('SELECT 1 FROM outbox_messages WHERE pool_item_id IS NOT NULL')).rows.length)).toBe(1);
    for(const ctx of [{tenant:ids.otherTenant},{tenant:null}]){
      expect(await asIntake(ctx,async tx=>(await tx.query('SELECT 1 FROM outbox_messages WHERE pool_item_id IS NOT NULL')).rows.length)).toBe(0);
      // 0 rows affected, not a silent success on somebody else's row
      expect(await asIntake(ctx,async tx=>(await tx.query("UPDATE outbox_messages SET updated_at=now() WHERE pool_item_id IS NOT NULL RETURNING id")).rows.length)).toBe(0);
      await expect(asIntake(ctx,async tx=>tx.query(
        `INSERT INTO outbox_messages(tenant_id,project_id,pool_item_id,event_id,event_type,trace_id,correlation_id,audience,target_chat_id,reply_to_message_id,template,payload,dedupe_key)
         VALUES($1,NULL,$2,$3,'intake.pool_received',$4,$4,'group',$5,$6,'intake.pool_received','{}',$7)`,[ctx.tenant??ids.otherTenant,item,randomUUID(),randomUUID(),chatPool,e.context.messageId,'x-'+randomUUID()]))).rejects.toThrow();
    }
    expect(await n('outbox_messages')).toBe(1);
  });
});
