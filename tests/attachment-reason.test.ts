// GIAO VIỆC 5 E: when a file of an addressed message is not stored, the receipt says why, from a fixed list. Anything else stays unnamed.
import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {openHarness,type Harness} from './slice1-db';
import {seedSlice1} from './slice1-fixtures';
import {bridgeConfig,intakePrincipalId,messageEvent} from './slice2-fixtures';
import {IntakeService,type EnqueueReceipt} from '../src/server/intake';
import {ids} from '../src/server/identities';

let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);});
afterEach(async()=>{vi.restoreAllMocks();await h.reset();await h.close();});
const hex='a'.repeat(64);
const stored=(over:Record<string,unknown>)=>({state:'stored' as const,locator:'gw://libetech/attachments/'+hex,sha256:hex,mimeType:'application/pdf',sizeBytes:1000,fileName:'a.pdf',...over});
const failed=(reasonCode:string)=>({state:'failed' as const,reasonCode});

test('the attachment receipt carries the reason the file was not stored, from the fixed list only',async()=>{
 const enq=vi.fn<EnqueueReceipt>(async()=>'queued');
 const svc=new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,{chats:bridgeConfig.intake!.chats},enq);
 const cases=[stored({sizeBytes:20971521}),stored({mimeType:'application/zip'}),failed('DOWNLOAD_UNAVAILABLE'),failed('STORE_UNAVAILABLE'),failed('TOO_LARGE'),failed('UNSUPPORTED_TYPE'),failed('SECRET_VALUE_FROM_WIRE')];
 for(const attachment of cases) await svc.ingest(messageEvent({attachment}));
 expect(enq.mock.calls.map(c=>c[1].template)).toEqual(Array(cases.length).fill('intake.attachment_failed'));
 expect(enq.mock.calls.map(c=>c[1].params.attachmentReason??null))
  .toEqual(['TOO_LARGE','UNSUPPORTED_TYPE','DOWNLOAD_UNAVAILABLE','STORE_UNAVAILABLE','TOO_LARGE','UNSUPPORTED_TYPE',null]);
 expect(JSON.stringify(enq.mock.calls.map(c=>c[1].params))).not.toContain('SECRET_VALUE_FROM_WIRE');
});

test('a stored file and a message without a file carry no reason',async()=>{
 const enq=vi.fn<EnqueueReceipt>(async()=>'queued');
 const svc=new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,{chats:bridgeConfig.intake!.chats},enq);
 await svc.ingest(messageEvent({attachment:stored({})}));await svc.ingest(messageEvent({}));
 expect(enq.mock.calls.map(c=>Object.keys(c[1].params).sort())).toEqual([['observedAt','ref'],['observedAt','ref']]);
});
