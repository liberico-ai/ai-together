import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {ZodError} from 'zod';
import {openHarness,type Harness} from './slice1-db';
import {bridgeConfig,botKey,intakeKey,chatSales,signedRequest} from './slice2-fixtures';
import {IdentityService} from '../src/server/identity';
import {handleBridge} from '../src/server/bridge';
import {handleBridgeIo,IO_PATHS} from '../src/server/bridge-io';
import {parseBridgeConfig} from '../src/server/bridge-config';
import {ids} from '../src/server/identities';

let h:Harness,identity:IdentityService;
beforeEach(async()=>{h=await openHarness();identity=new IdentityService(h.operator,ids.tenant);});
afterEach(async()=>{await h.close();});
const deps=()=>({intakeDb:h.operator,identity,config:bridgeConfig,tenantId:ids.tenant});
const call=(req:Request)=>{const p=new URL(req.url).pathname;return handleBridgeIo(req,p.replace('/api/bridge/','').split('/'),deps());};
const body=(p:string)=>p.endsWith('pull')?{limit:5}:{};

test('(1) wrong key, stale timestamp and a reused nonce are rejected on every intake route',async()=>{
  for(const p of IO_PATHS){
    await expect(call(signedRequest(p,body(p),{key:randomBytes(48).toString('base64url')}))).rejects.toMatchObject({code:'BRIDGE_AUTH_DENIED'});
    await expect(call(signedRequest(p,body(p),{timestamp:String(Date.now()-120000)}))).rejects.toMatchObject({code:'BRIDGE_AUTH_DENIED'});
    const nonce=randomBytes(24).toString('base64url');
    // Every route validates its body: {} is a ZodError on events and receipts; pull accepts {limit}.
    if(p.endsWith('outbox/pull')) await expect(call(signedRequest(p,body(p),{nonce}))).resolves.toMatchObject({deliveries:[]});
    else await expect(call(signedRequest(p,body(p),{nonce}))).rejects.toBeInstanceOf(ZodError);
    await expect(call(signedRequest(p,body(p),{nonce}))).rejects.toMatchObject({code:'BRIDGE_REPLAY'});
  }
});
test('a signature made for another path is rejected',async()=>{
  await expect(call(signedRequest('/api/bridge/intake/events',{},{signPath:'/api/bridge'}))).rejects.toMatchObject({code:'BRIDGE_AUTH_DENIED'});
  await expect(call(signedRequest('/api/bridge/outbox/receipts',{},{signPath:'/api/bridge/outbox/pull'}))).rejects.toMatchObject({code:'BRIDGE_AUTH_DENIED'});
});
test('the bot key cannot sign intake routes and the intake key cannot sign /api/bridge',async()=>{
  for(const p of IO_PATHS) await expect(call(signedRequest(p,body(p),{key:botKey}))).rejects.toMatchObject({code:'BRIDGE_AUTH_DENIED',status:401});
  const bot=signedRequest('/api/bridge',{operation:'account_approval_pending'},{key:intakeKey});
  await expect(handleBridge(bot,h.operator,identity,botKey,bridgeConfig.chatScopes)).rejects.toMatchObject({code:'BRIDGE_AUTH_DENIED'});
});
const walk=(d:string):string[]=>readdirSync(d).flatMap(f=>{const p=path.join(d,f);return statSync(p).isDirectory()?walk(p):[p];});
test('(7) every intake endpoint lives under /api/bridge/ and answers 401 without a valid signature',async()=>{
  // The real proxy block (^~ /api/bridge/) is a runtime check: DEPLOY-003-team-access.md:103-104.
  for(const p of IO_PATHS) expect(p.startsWith('/api/bridge/')).toBe(true);
  const base='src/app/api/bridge/[...path]/route.ts';
  expect(statSync(base).isFile()).toBe(true);
  const users=walk('src/app/api').filter(f=>/route\.ts$/.test(f)&&readFileSync(f,'utf8').includes('bridge-io'));
  expect(users).toEqual([base]);
  for(const p of IO_PATHS){
    const req=new Request('http://127.0.0.1:3148'+p,{method:'POST',body:'{}'});
    await expect(call(req)).rejects.toMatchObject({status:401});
  }
  const unknown=signedRequest('/api/bridge/intake/unknown',{});
  await expect(handleBridgeIo(unknown,['intake','unknown'],deps())).rejects.toMatchObject({code:'NOT_FOUND',status:404});
  expect(unknown.bodyUsed).toBe(false);
});
test('config rejects an intake key equal to the bot key and intake chats outside chatScopes',()=>{
  const ok={key:botKey,chatScopes:{[chatSales]:[ids.sales]}};
  expect(parseBridgeConfig(ok)).toMatchObject({key:botKey});
  expect(parseBridgeConfig({...ok,intake:{key:intakeKey,principalId:ids.tenant,chats:[chatSales]}}).intake?.key).toBe(intakeKey);
  expect(()=>parseBridgeConfig({...ok,intake:{key:botKey,principalId:ids.tenant,chats:[chatSales]}})).toThrow();
  expect(()=>parseBridgeConfig({...ok,intake:{key:intakeKey,principalId:ids.tenant,chats:['-1000000000099']}})).toThrow();
  expect(()=>parseBridgeConfig({...ok,intake:{key:'short',principalId:ids.tenant,chats:[chatSales]}})).toThrow();
  expect(()=>parseBridgeConfig({...ok,extra:1})).toThrow();
});
test('config keeps one copy of a project id listed twice for a group',()=>{
  const cfg=(l:string[])=>parseBridgeConfig({key:botKey,chatScopes:{[chatSales]:l}}).chatScopes[chatSales];
  expect(cfg([ids.sales,ids.sales])).toEqual([ids.sales]);
  expect(cfg([ids.sales,ids.transport,ids.sales])).toEqual([ids.sales,ids.transport]);
});
test('config stores project ids in lowercase and keeps one copy',()=>{
  const cfg=(l:string[])=>parseBridgeConfig({key:botKey,chatScopes:{[chatSales]:l}}).chatScopes[chatSales];
  const A='abcdef01-0000-4000-8000-0000000000ab';
  expect(cfg([A.toUpperCase(),A])).toEqual([A]);
});
test('config rejects excerpt chats outside intake.chats; no excerptChats means none',()=>{
  const ok={key:botKey,chatScopes:{[chatSales]:[ids.sales],'-1000000000002':[ids.transport]}};
  const intake={key:intakeKey,principalId:ids.tenant,chats:[chatSales]};
  expect(parseBridgeConfig({...ok,intake}).intake?.excerptChats).toBeUndefined();
  expect(parseBridgeConfig({...ok,intake:{...intake,excerptChats:[]}}).intake?.excerptChats).toEqual([]);
  expect(parseBridgeConfig({...ok,intake:{...intake,excerptChats:[chatSales]}}).intake?.excerptChats).toEqual([chatSales]);
  // in chatScopes but not an intake chat, and in neither
  expect(()=>parseBridgeConfig({...ok,intake:{...intake,excerptChats:['-1000000000002']}})).toThrow('Intake excerpt chats must be a subset of intake chats.');
  expect(()=>parseBridgeConfig({...ok,intake:{...intake,excerptChats:[chatSales,'-1000000000099']}})).toThrow('Intake excerpt chats must be a subset of intake chats.');
  expect(()=>parseBridgeConfig({...ok,intake:{...intake,excerptChats:['not-a-chat']}})).toThrow();
});
test('oversized bodies are refused before parsing',async()=>{
  await expect(call(signedRequest('/api/bridge/intake/events','x'.repeat(16385)))).rejects.toMatchObject({code:'PAYLOAD_TOO_LARGE'});
  await expect(call(signedRequest('/api/bridge/outbox/receipts','x'.repeat(4097)))).rejects.toMatchObject({code:'PAYLOAD_TOO_LARGE'});
});
