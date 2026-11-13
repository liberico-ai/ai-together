import {afterEach,beforeEach,expect,test} from 'vitest';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {ZodError} from 'zod';
import {openHarness,type Harness} from './slice1-db';
import {seedSlice1} from './slice1-fixtures';
import {bridgeConfig,messageEvent,signedRequest} from './slice2-fixtures';
import {IdentityService} from '../src/server/identity';
import {handleBridgeIo} from '../src/server/bridge-io';
import {requireBridgeConfig} from '../src/server/bridge-config';
import {ids} from '../src/server/identities';

// Bridge body limits and config failures (T2 M5, Security M1 and M2). All keys, ids and texts are the synthetic fixtures.
let h:Harness,identity:IdentityService;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);identity=new IdentityService(h.operator,ids.tenant);});
afterEach(async()=>{await h.reset();await h.close();});
const call=(req:Request)=>handleBridgeIo(req,new URL(req.url).pathname.replace('/api/bridge/','').split('/'),{intakeDb:h.operator,identity,config:bridgeConfig,tenantId:ids.tenant});
const EVENTS='/api/bridge/intake/events';
/** A valid event padded with JSON whitespace to an exact byte length. */
const sized=(bytes:number,text?:string)=>{
  const raw=JSON.stringify(messageEvent(text===undefined?{}:{text}));
  const pad=bytes-Buffer.byteLength(raw);
  if(pad<0) throw new Error('event longer than '+bytes);
  return raw+' '.repeat(pad);
};
const sourceEvents=async()=>(await h.operator.query<{n:number}>('SELECT count(*)::int n FROM source_events')).rows[0].n;

test('T2 M5 an intake body of exactly 16384 bytes is accepted, 16385 is refused, and the limit counts bytes',async()=>{
  const at=sized(16384);
  expect(Buffer.byteLength(at)).toBe(16384);
  await expect(call(signedRequest(EVENTS,at))).resolves.toMatchObject({persisted:true});
  const over=sized(16385);
  expect(Buffer.byteLength(over)).toBe(16385);
  await expect(call(signedRequest(EVENTS,over))).rejects.toMatchObject({code:'PAYLOAD_TOO_LARGE',status:413});
  // 4000 three-byte letters: far fewer than 16384 characters, still 16385 bytes
  const wide=sized(16385,'ệ'.repeat(4000));
  expect(wide.length).toBeLessThan(16384);
  await expect(call(signedRequest(EVENTS,wide))).rejects.toMatchObject({code:'PAYLOAD_TOO_LARGE',status:413});
  expect(await sourceEvents()).toBe(1);
});

test('Sec M2 a declared Content-Length above the cap is refused before the body is read; the read itself stays capped',async()=>{
  const streamed=(declared:string,raw='{}')=>{
    const signed=signedRequest(EVENTS,raw);
    const body=new ReadableStream<Uint8Array>({start(c){c.enqueue(new TextEncoder().encode(raw));c.close();}});
    return new Request(signed.url,{method:'POST',body,duplex:'half',headers:{...Object.fromEntries(signed.headers),'content-length':declared}} as RequestInit);
  };
  const big=streamed('16385');
  expect(big.headers.get('content-length')).toBe('16385');
  await expect(call(big)).rejects.toMatchObject({code:'PAYLOAD_TOO_LARGE',status:413});
  expect(big.bodyUsed).toBe(false);
  // at the cap the early check lets it through; the signature and the body schema decide from there
  const atCap=streamed('16384');
  await expect(call(atCap)).rejects.toBeInstanceOf(ZodError);
  expect(atCap.bodyUsed).toBe(true);
  // no declared length (or a wrong one): the size check after the read still refuses
  await expect(call(signedRequest(EVENTS,'x'.repeat(16385)))).rejects.toMatchObject({code:'PAYLOAD_TOO_LARGE'});
  expect(await sourceEvents()).toBe(0);
});

test('Sec M1 a missing, unreadable or invalid bridge config answers 503 (the plugin retries), never 422 (the plugin drops)',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'bridge-config-'));
  const prev=process.env.LIBETECH_BRIDGE_CONFIG;
  try {
    const cases:[string,string|null][]=[['broken.json','{"key":'],['schema.json',JSON.stringify({key:'short',chatScopes:{}})],
      ['same-key.json',JSON.stringify({...bridgeConfig,intake:{...bridgeConfig.intake,key:bridgeConfig.key}})],['missing.json',null]];
    for(const [name,content] of cases){
      const file=path.join(dir,name);
      if(content!==null) await writeFile(file,content);
      process.env.LIBETECH_BRIDGE_CONFIG=file;
      for(const code of ['INTAKE_UNCONFIGURED','BRIDGE_UNCONFIGURED'] as const)
        await expect(requireBridgeConfig(code),name+' '+code).rejects.toMatchObject({code,status:503});
    }
    delete process.env.LIBETECH_BRIDGE_CONFIG;
    await expect(requireBridgeConfig('INTAKE_UNCONFIGURED')).rejects.toMatchObject({code:'INTAKE_UNCONFIGURED',status:503});
    await writeFile(path.join(dir,'ok.json'),JSON.stringify(bridgeConfig));
    process.env.LIBETECH_BRIDGE_CONFIG=path.join(dir,'ok.json');
    await expect(requireBridgeConfig('INTAKE_UNCONFIGURED')).resolves.toMatchObject({key:bridgeConfig.key});
  } finally {
    if(prev===undefined) delete process.env.LIBETECH_BRIDGE_CONFIG; else process.env.LIBETECH_BRIDGE_CONFIG=prev;
    await rm(dir,{recursive:true,force:true});
  }
  // both bridge routes load the config through it
  for(const f of ['src/app/api/bridge/[...path]/route.ts','src/app/api/bridge/route.ts']){
    const src=await readFile(f,'utf8');
    expect(src,f).toMatch(/requireBridgeConfig\(/);
    expect(src,f).not.toMatch(/loadBridgeConfig\(/);
  }
});
