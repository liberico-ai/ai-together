import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {ZodError} from 'zod';
import {openHarness,type Harness} from './slice1-db';
import {seedSlice1} from './slice1-fixtures';
import {bridgeConfig,messageEvent,signedRequest} from './slice2-fixtures';
import {IdentityService} from '../src/server/identity';
import {handleBridgeIo} from '../src/server/bridge-io';
import {body} from '../src/server/http';
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
      ['excerpt-outside.json',JSON.stringify({...bridgeConfig,intake:{...bridgeConfig.intake,excerptChats:['-1000000000004']}})],['same-key.json',JSON.stringify({...bridgeConfig,intake:{...bridgeConfig.intake,key:bridgeConfig.key}})],['missing.json',null]];
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

// Codex round 2 P1: a body sent without a length (chunked) is read as a stream and given up at the cap, never buffered whole.
/** A streamed body with no declared length: `chunks` given in turn, one per read (highWaterMark 0), then the end.
 * `probe` counts the chunks pulled and records whether the reader cancelled the stream. */
const streamOf=(chunks:Uint8Array[],opts:{cancelThrows?:boolean}={})=>{
  const probe={pulls:0,cancelled:false};
  const stream=new ReadableStream<Uint8Array>({
    pull(c){const next=chunks[probe.pulls];probe.pulls+=1;if(next) c.enqueue(next); else c.close();},
    cancel(){probe.cancelled=true;if(opts.cancelThrows) throw new Error('synthetic cancel failure');},
  },{highWaterMark:0});
  return {stream,probe};
};
/** 256 chunks of 1 KiB JSON whitespace: far past every cap, and it would go on being read. */
const flood=()=>Array.from({length:256},()=>new TextEncoder().encode(' '.repeat(1024)));
/** `raw` as bytes cut every `size` bytes, so multi-byte letters fall across chunk boundaries. */
const cut=(raw:string,size:number)=>{const bytes=Buffer.from(raw);const out:Uint8Array[]=[];for(let i=0;i<bytes.length;i+=size) out.push(new Uint8Array(bytes.subarray(i,i+size)));return out;};
const streamedRequest=(url:string,stream:ReadableStream<Uint8Array>,headers:Record<string,string>={})=>
  new Request(url,{method:'POST',body:stream,duplex:'half',headers} as RequestInit);
/** The signed headers of signedRequest(path, raw), without any length. */
const signedHeaders=(path:string,raw:string)=>Object.fromEntries(signedRequest(path,raw).headers);

test('Codex r2 P1 a bridge body with no length is cancelled once it passes the cap, before it is read to the end',async()=>{
  const {stream,probe}=streamOf(flood());
  const req=streamedRequest('http://127.0.0.1:3148'+EVENTS,stream,signedHeaders(EVENTS,'{}'));
  expect(req.headers.get('content-length')).toBeNull();
  await expect(call(req)).rejects.toMatchObject({code:'PAYLOAD_TOO_LARGE',status:413,message:'Yêu cầu quá lớn.'});
  // 16 KiB is passed on the 17th chunk of 1 KiB: the rest is never pulled
  expect(probe.cancelled).toBe(true);
  expect(probe.pulls).toBe(17);
  // a declared length above the cap is still refused before anything is pulled
  const declared=streamOf(flood());
  const big=streamedRequest('http://127.0.0.1:3148'+EVENTS,declared.stream,{...signedHeaders(EVENTS,'{}'),'content-length':'16385'});
  await expect(call(big)).rejects.toMatchObject({code:'PAYLOAD_TOO_LARGE',status:413});
  expect(declared.probe.pulls).toBe(0);
  expect(await sourceEvents()).toBe(0);
});

test('Codex r2 P1 a streamed bridge body at the cap, signed, is accepted and decoded like request.text()',async()=>{
  const raw=sized(16384,'Nhờ kiểm tra ệ '.repeat(250));
  expect(Buffer.byteLength(raw)).toBe(16384);
  const {stream,probe}=streamOf(cut(raw,1000));
  await expect(call(streamedRequest('http://127.0.0.1:3148'+EVENTS,stream,signedHeaders(EVENTS,raw)))).resolves.toMatchObject({persisted:true});
  expect(probe.cancelled).toBe(false);
  expect(await sourceEvents()).toBe(1);
});

test('Codex r2 P1 the web body() refuses a streamed body over 16 KB with no length without reading it to the end',async()=>{
  const {stream,probe}=streamOf(flood());
  await expect(body(streamedRequest('http://127.0.0.1:3147/api/v1/work',stream))).rejects.toMatchObject({code:'PAYLOAD_TOO_LARGE',status:413,message:'Nội dung vượt 16 KB.'});
  expect(probe.cancelled).toBe(true);
  expect(probe.pulls).toBe(17);
  // at the cap it is parsed as before, multi-byte letters split across chunks included
  const value={title:'Việc mẫu ệ'.repeat(100)};
  const json=JSON.stringify(value);
  const at=json+' '.repeat(16384-Buffer.byteLength(json));
  const ok=streamOf(cut(at,999));
  await expect(body(streamedRequest('http://127.0.0.1:3147/api/v1/work',ok.stream))).resolves.toEqual(value);
  // no body at all reads as '' and stays a JSON syntax error (422 through failure()), as request.text() gave
  await expect(body(new Request('http://127.0.0.1:3147/api/v1/work',{method:'POST'}))).rejects.toBeInstanceOf(SyntaxError);
  // a chunk that is not bytes is refused as request.text() refuses it, never counted as zero bytes
  const odd=streamOf(['x' as unknown as Uint8Array,...flood()]);
  await expect(body(streamedRequest('http://127.0.0.1:3147/api/v1/work',odd.stream))).rejects.toBeInstanceOf(TypeError);
  expect([odd.probe.pulls,odd.probe.cancelled]).toEqual([1,true]);
});

test('Codex r2 P1 a cancel that fails is logged by a fixed code and the body is still refused 413',async()=>{
  const logged:string[]=[];
  const spy=vi.spyOn(console,'error').mockImplementation((line:unknown)=>{logged.push(String(line));});
  try {
    const {stream,probe}=streamOf(flood(),{cancelThrows:true});
    await expect(body(streamedRequest('http://127.0.0.1:3147/api/v1/work',stream))).rejects.toMatchObject({code:'PAYLOAD_TOO_LARGE',status:413});
    expect(probe.cancelled).toBe(true);
    expect(logged.map(line=>JSON.parse(line))).toEqual([{level:'warn',event:'request_body_cancel_failed',errorType:'Error'}]);
    expect(logged.join('\n')).not.toMatch(/synthetic cancel failure/);
  } finally { spy.mockRestore(); }
});

test('the intake route takes the excerpt flag from the operator config',async()=>{
  const run=async(config:typeof bridgeConfig)=>{
    const event=messageEvent({text:'chữ theo cấu hình'});
    await handleBridgeIo(signedRequest(EVENTS,event),['intake','events'],{intakeDb:h.operator,identity,config,tenantId:ids.tenant});
    return (await h.operator.query<{content_mode:string;text_excerpt:string|null}>(
      'SELECT e.content_mode,r.text_excerpt FROM source_events e JOIN source_event_revisions r ON r.source_event_id=e.id WHERE e.message_id=$1',[event.context.messageId])).rows[0];
  };
  const flagged={...bridgeConfig,intake:{...bridgeConfig.intake!,excerptChats:[bridgeConfig.intake!.chats[0]]}};
  expect(await run(flagged)).toEqual({content_mode:'excerpt',text_excerpt:'chữ theo cấu hình'});
  expect(await run(bridgeConfig)).toEqual({content_mode:'pointer_only',text_excerpt:null});
});
