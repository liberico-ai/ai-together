import {afterEach,beforeEach,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {ZodError} from 'zod';
import {openHarness,type Harness} from './slice1-db';
import {member,outsider,pm,seedSlice1,viewer} from './slice1-fixtures';
import {bridgeConfig,chatSales,chatTransport,intakePrincipalId,messageEvent,ticketStateColumns,type EventOverride} from './slice2-fixtures';
import {IntakeService} from '../src/server/intake';
import {InboxService} from '../src/server/inbox';
import {eventKey} from '../src/server/intake-rules';
import {inboxRows,reconcileLedger,type LedgerTicketRow} from '../src/server/ledger-reconcile';
import {ids} from '../src/server/identities';

let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);});
afterEach(async()=>{await h.reset();await h.close();});

const intake=()=>new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,bridgeConfig.intake!.chats);
const rows=async<T=Record<string,unknown>>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const k=()=>randomUUID();
const win={from:'2000-01-01T00:00:00.000Z',to:'2100-01-01T00:00:00.000Z'};
const put=async(messageId:string,chatId=chatSales,o:EventOverride={})=>{
  const ack=await intake().ingest(messageEvent({...o,context:{chatId,messageId,...o.context}}));
  const id=(await rows<{id:string}>('SELECT id FROM intake_candidates WHERE root_source_event_id=$1',[ack.sourceEventId]))[0]?.id??null;
  return {id,sourceEventId:ack.sourceEventId};
};
const tk=(ticketId:string,messageId:string,over:Partial<LedgerTicketRow>={}):LedgerTicketRow=>({ticketId,chatId:chatSales,messageId,threadId:'1',status:'open',createdAt:'2026-11-13T00:00:00.000Z',...over});
const snapshot=async()=>({
  cand:(await rows("SELECT count(*) n, md5(coalesce(string_agg(id::text||version::text,',' ORDER BY id),'')) m, md5(coalesce(string_agg(id::text||coalesce(ticket_ref,'-'),',' ORDER BY id),'')) r FROM intake_candidates"))[0],
  src:(await rows('SELECT count(*) n FROM source_events'))[0],
  out:(await rows('SELECT count(*) n FROM outbox_messages'))[0],
  ev:(await rows('SELECT count(*) n FROM intake_events'))[0],
});

test('OQ-09 a message with both a ticket and a SourceEvent is joined by the shared event key',async()=>{
  const a=await put('101');
  const inbox=await inboxRows(h.db,pm,ids.sales,win);
  expect(inbox).toHaveLength(1);
  expect(inbox[0]).toMatchObject({sourceEventId:a.sourceEventId,chatId:chatSales,messageId:'101',candidateId:a.id,ticketRef:null});
  const rep=reconcileLedger(inbox,[tk('TK-TEST-202611-001','101')]);
  expect(rep.matched).toEqual([{eventKey:eventKey(chatSales,'101'),sourceEventId:a.sourceEventId,candidateId:a.id,ticketId:'TK-TEST-202611-001',linked:false}]);
  expect(rep.onlyInInbox).toEqual([]);expect(rep.onlyInLedger).toEqual([]);expect(rep.conflicts).toEqual([]);
});

test('reconciliation creates no candidate and changes no row',async()=>{
  await put('101');await put('102');
  const before=await snapshot();
  const inbox=await inboxRows(h.db,pm,ids.sales,win);
  reconcileLedger(inbox,[tk('TK-TEST-202611-001','101'),tk('TK-TEST-202611-003','103')]);
  expect(await snapshot()).toEqual(before);
});

test('AI OS holds no ticket state to change',async()=>{
  const a=await put('101');
  const inbox=await inboxRows(h.db,pm,ids.sales,win);
  const rep=reconcileLedger(inbox,[tk('TK-TEST-202611-001','101',{status:'closed-in-ledger'}),tk('TK-TEST-202611-003','103',{status:'closed-in-ledger'}),
    tk('TK-TEST-202611-005','104',{status:'x'}),tk('TK-TEST-202611-006','104',{status:'y'})]);
  const text=JSON.stringify(rep);
  expect(text).not.toContain('status');
  expect(text).not.toContain('closed-in-ledger');
  expect(JSON.stringify(inbox)).not.toContain('status');
  expect(rep.matched[0].candidateId).toBe(a.id);
  expect(await ticketStateColumns(async q=>(await h.operator.query<{column_name:string}>(q)).rows)).toEqual([]);
});

test('differences are listed, never repaired',async()=>{
  const a101=await put('101');const a102=await put('102');const a104=await put('104');const a105=await put('105');
  const inbox=new InboxService(h.db);
  await inbox.command(pm,a105.id!,{kind:'link_ticket',expectedVersion:1,ticketRef:'TK-TEST-202611-009'},k());
  const before=await snapshot();
  const rows1=await inboxRows(h.db,pm,ids.sales,win);
  const rep=reconcileLedger(rows1,[tk('TK-TEST-202611-001','101'),tk('TK-TEST-202611-003','103'),tk('TK-TEST-202611-005','104'),tk('TK-TEST-202611-006','104'),tk('TK-TEST-202611-004','105')]);
  expect(rep.onlyInInbox).toEqual([{eventKey:eventKey(chatSales,'102'),sourceEventId:a102.sourceEventId}]);
  expect(rep.onlyInLedger).toEqual([{eventKey:eventKey(chatSales,'103'),ticketId:'TK-TEST-202611-003'}]);
  expect(rep.conflicts).toEqual(expect.arrayContaining([
    {eventKey:eventKey(chatSales,'104'),kind:'two_tickets_one_message',ticketIds:['TK-TEST-202611-005','TK-TEST-202611-006'],ticketRef:null},
    {eventKey:eventKey(chatSales,'105'),kind:'ticket_ref_mismatch',ticketIds:['TK-TEST-202611-004'],ticketRef:'TK-TEST-202611-009'}]));
  expect(rep.conflicts).toHaveLength(2);
  expect(rep.matched.map(m=>m.sourceEventId)).toEqual([a101.sourceEventId]);
  void a104;
  const refs=await rows<{ticket_ref:string|null}>('SELECT ticket_ref FROM intake_candidates WHERE id=$1',[a105.id]);
  expect(refs[0].ticket_ref).toBe('TK-TEST-202611-009');
  const after=await snapshot();
  expect(after).toEqual(before);
});

test('a matched and already linked pair is reported as linked',async()=>{
  const a=await put('101');
  await new InboxService(h.db).command(pm,a.id!,{kind:'link_ticket',expectedVersion:1,ticketRef:'TK-TEST-202611-001'},k());
  const rep=reconcileLedger(await inboxRows(h.db,pm,ids.sales,win),[tk('TK-TEST-202611-001','101')]);
  expect(rep.matched).toHaveLength(1);
  expect(rep.matched[0]).toMatchObject({linked:true,ticketId:'TK-TEST-202611-001'});
  expect(rep.conflicts).toEqual([]);
});

test("rows outside the caller's project are never read",async()=>{
  await put('101');
  const other=await put('201',chatTransport);
  const sales=await inboxRows(h.db,pm,ids.sales,win);
  expect(sales.map(r=>r.chatId)).toEqual([chatSales]);
  expect(sales.map(r=>r.sourceEventId)).not.toContain(other.sourceEventId);
  const denied=async(p:Promise<unknown>)=>{const e=await p.then(()=>{throw new Error('expected SCOPE_DENIED');},x=>x);expect(e).toMatchObject({code:'SCOPE_DENIED',status:404});return (e as Error).message;};
  const m1=await denied(inboxRows(h.db,viewer,ids.sales,win));
  const m2=await denied(inboxRows(h.db,outsider,ids.sales,win));
  const m3=await denied(inboxRows(h.db,member,ids.transport,win));
  expect(new Set([m1,m2,m3]).size).toBe(1);
});

test('window is strict ISO with from <= to and filters on observed_at',async()=>{
  const a=await put('101');
  const obs=new Date((await rows<{o:string}>('SELECT observed_at o FROM source_events WHERE id=$1',[a.sourceEventId]))[0].o).toISOString();
  expect(await inboxRows(h.db,pm,ids.sales,{from:obs,to:obs})).toHaveLength(1);
  expect(await inboxRows(h.db,pm,ids.sales,{from:'2100-01-01T00:00:00.000Z',to:'2100-01-02T00:00:00.000Z'})).toEqual([]);
  await expect(inboxRows(h.db,pm,ids.sales,{from:win.to,to:win.from})).rejects.toBeInstanceOf(ZodError);
  await expect(inboxRows(h.db,pm,ids.sales,{from:'yesterday',to:win.to})).rejects.toBeInstanceOf(ZodError);
  await expect(inboxRows(h.db,pm,ids.sales,{...win,projectId:ids.transport} as never)).rejects.toBeInstanceOf(ZodError);
});
