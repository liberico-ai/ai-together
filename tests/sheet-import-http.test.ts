import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {openHarness,type Harness} from './slice1-db';
import {seedSlice1} from './slice1-fixtures';
import {seedMembers} from './slice3-fixtures';
import {clearImports,envelope,projectIds,row8,seedImport,csvBytes} from './sheet-import-fixtures';
import {handleApi} from '../src/server/http';
import {COOKIE,createSession} from '../src/server/auth';
import {demoProfiles,ids} from '../src/server/identities';

const url='http://127.0.0.1:3147';
const CELL_CANARY='canary-ô-chữ-zk93';
let h:Harness;
let was:string|undefined;
beforeEach(async()=>{
  was=process.env.LIBETECH_WORK_IMPORT;process.env.LIBETECH_WORK_IMPORT='1';
  h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);await seedImport(h);await clearImports(h);
  // the demo customer (viewer, transport) is also on the Team Tech roster, so the roster path can be driven by a demo session
  await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,'imp-customer',$3,'viewer','fixture-only') ON CONFLICT DO NOTHING`,[demoProfiles.customer.id,ids.tenant,demoProfiles.customer.name]);
  await h.operator.query('INSERT INTO identity.tech_roster(tenant_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[ids.tenant,demoProfiles.customer.id]);
});
afterEach(async()=>{if(was===undefined) delete process.env.LIBETECH_WORK_IMPORT;else process.env.LIBETECH_WORK_IMPORT=was;vi.restoreAllMocks();await h.reset();await h.close();});

const cookie=(profileKey:string)=>COOKIE+'='+createSession(new Request(url+'/api/demo/session',{method:'POST',headers:{host:'127.0.0.1:3147',origin:url}}),{profileKey}).token;
const call=(method:string,route:string[],who:string,payload?:unknown,init:RequestInit={})=>handleApi(new Request(url+'/api/v1/'+route.join('/'),
  {method,headers:{host:'127.0.0.1:3147',origin:url,cookie:cookie(who)},...(payload!==undefined?{body:JSON.stringify(payload)}:{}),...init}),route,h.db);
const count=async(t:string)=>Number((await h.operator.query<{n:string}>(`SELECT count(*) n FROM ${t}`)).rows[0].n);
const body=(lines:string[])=>envelope(lines);
const commitBody=(lines:string[],digest:string,over:Record<string,unknown>={})=>({...envelope(lines),previewDigest:digest,requestKey:randomUUID(),
  projects:[{buLabel:'LBRC',projectId:projectIds.lbrc},{buLabel:'XECA',projectId:projectIds.xeca},{buLabel:'IBS HI',projectId:projectIds.ibs}],owners:[],...over});

test('(17) a viewer off the roster, an engineer and the bot are 403 on the preview and on the commit, and nothing is written',async()=>{
  const lines=[row8()];
  const pre=await (await call('POST',['work-imports','preview'],'customer',body(lines))).json();
  expect(pre.data.previewDigest).toMatch(/^[a-f0-9]{64}$/);   // the roster member may
  await h.operator.query('DELETE FROM identity.tech_roster WHERE user_id=$1',[demoProfiles.customer.id]);
  for(const who of ['customer','engineer','technical','bot']){
    const a=await call('POST',['work-imports','preview'],who,body(lines));
    expect(a.status,who).toBe(403);expect((await a.json()).error.code).toBe('IMPORT_DENIED');
    const b=await call('POST',['work-imports'],who,commitBody(lines,pre.data.previewDigest));
    expect(b.status,who).toBe(403);expect((await b.json()).error.code).toBe('IMPORT_DENIED');
  }
  // the manager of sales and transport may not import into the three Team Tech projects they do not manage
  const c=await call('POST',['work-imports'],'manager',commitBody(lines,pre.data.previewDigest));
  expect(c.status).toBe(201);
  expect((await c.json()).data.results).toMatchObject([{result:'needs_reconciliation',reasons:['NOT_A_FILER']}]);
  expect(await count('work_requests')+await count('work_import_rows')).toBe(0);
});

test('preview, commit and the receipt over HTTP: 200, 201 then 200 on a replay; the receipt is the importer\'s only',async()=>{
  const lines=[row8({stt:'1',title:'Việc qua đường HTTP TEST2001'}),row8({stt:'2',bu:'XECA',title:'Việc XECA qua HTTP TEST2002'})];
  const pre=await call('POST',['work-imports','preview'],'customer',body(lines));
  expect(pre.status).toBe(200);
  const digest=(await pre.json()).data.previewDigest as string;
  const b=commitBody(lines,digest);
  const first=await call('POST',['work-imports'],'customer',b);
  expect(first.status).toBe(201);
  const data=(await first.json()).data;
  expect(data).toMatchObject({replayed:false,results:[{row:2,result:'imported'},{row:3,result:'imported'}]});
  const replay=await call('POST',['work-imports'],'customer',b);
  expect(replay.status).toBe(200);expect((await replay.json()).data).toMatchObject({replayed:true,id:data.id});
  expect(await count('work_requests')).toBe(2);
  const mine=await call('GET',['work-imports',data.id],'customer');
  expect(mine.status).toBe(200);expect((await mine.json()).data.counts.byBuLabel).toHaveLength(2);
  expect((await call('GET',['work-imports',data.id],'manager')).status).toBe(404);
  expect((await call('GET',['work-imports',data.id],'bot')).status).toBe(403);
  expect((await call('GET',['work-imports','not-a-uuid'],'customer')).status).toBe(404);
  // a POST needs the same origin as every other write
  const foreign=await handleApi(new Request(url+'/api/v1/work-imports/preview',{method:'POST',headers:{host:'127.0.0.1:3147',origin:'http://evil.example',cookie:cookie('customer')},body:JSON.stringify(body(lines))}),['work-imports','preview'],h.db);
  expect(foreign.status).toBeGreaterThanOrEqual(400);expect(foreign.status).not.toBe(200);
});

test('(18) the envelope cannot name the tenant, the importer, the state or the origin; the body over the cap is 413 and is not read to the end',async()=>{
  const lines=[row8()];
  for(const extra of [{tenantId:ids.tenant},{importerId:demoProfiles.manager.id},{state:'approved'},{origin:'form'}]){
    expect((await call('POST',['work-imports','preview'],'customer',{...body(lines),...extra})).status).toBe(422);
    expect((await call('POST',['work-imports'],'customer',commitBody(lines,'a'.repeat(64),extra))).status).toBe(422);
  }
  expect((await call('POST',['work-imports','preview'],'customer',undefined,{body:'{not json'})).status).toBe(422);
  // a stream with no length: 1 KB chunks, many more than the 400 KB cap; the reader stops long before the end
  let pulled=0;const total=4000;
  const stream=new ReadableStream<Uint8Array>({pull(controller){if(pulled>=total){controller.close();return;}pulled++;controller.enqueue(new Uint8Array(1024).fill(97));}});
  const big=await handleApi(new Request(url+'/api/v1/work-imports/preview',{method:'POST',headers:{host:'127.0.0.1:3147',origin:url,cookie:cookie('customer')},body:stream,duplex:'half'} as RequestInit),['work-imports','preview'],h.db);
  expect(big.status).toBe(413);expect((await big.json()).error.code).toBe('PAYLOAD_TOO_LARGE');
  expect(pulled).toBeLessThan(1000);
  // a file over 256 KB inside an acceptable body is refused by the reader of the file
  const file=Buffer.alloc(256*1024+1,97).toString('base64');
  expect((await call('POST',['work-imports','preview'],'customer',{...body(lines),fileBase64:file})).status).toBe(413);
});

test('(19) errors and logs carry no cell text',async()=>{
  const sink:string[]=[];
  for(const m of ['log','error','warn','info','debug'] as const) vi.spyOn(console,m).mockImplementation((...a:unknown[])=>{sink.push(a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' '));});
  const bad=Buffer.concat([Buffer.from('STT,BU,Đầu việc,Người phụ trách,Phối hợp,Trạng thái,Hạn,Ghi chú,'+CELL_CANARY+'\n1,LBRC,x\n')]).toString('base64');
  const unclosed=Buffer.from('STT,BU,Đầu việc,Người phụ trách,Phối hợp,Trạng thái,Hạn,Ghi chú\n1,LBRC,"'+CELL_CANARY+'\n').toString('base64');
  const notUtf8=Buffer.concat([csvBytes(row8({title:'Việc TEST2101 đủ dài'})),Buffer.from([0xff]),Buffer.from(CELL_CANARY)]).toString('base64');
  const tooLong=Buffer.from(csvBytes(row8({title:CELL_CANARY+'x'.repeat(2001)}))).toString('base64');
  const texts:string[]=[];
  for(const fileBase64 of [bad,unclosed,notUtf8,tooLong]){
    const r=await call('POST',['work-imports','preview'],'customer',{...body([row8()]),fileBase64});
    texts.push(await r.text());expect(r.status).toBeGreaterThanOrEqual(400);
  }
  const ok=await call('POST',['work-imports','preview'],'customer',body([row8({stt:'1',title:CELL_CANARY+' TEST2102',note:CELL_CANARY})]));
  const digest=(await ok.json()).data.previewDigest;
  // a commit refused for a wrong digest and a commit refused for access: the sentences are fixed
  texts.push(await (await call('POST',['work-imports'],'customer',commitBody([row8({stt:'1',title:CELL_CANARY+' TEST2102',note:CELL_CANARY})],'0'.repeat(64)))).text());
  texts.push(await (await call('POST',['work-imports'],'engineer',commitBody([row8({stt:'1',title:CELL_CANARY+' TEST2102'})],digest))).text());
  for(const t of texts) expect(t).not.toContain(CELL_CANARY);
  expect(sink.join('\n')).not.toContain(CELL_CANARY);
});

test('(9) the import is off unless LIBETECH_WORK_IMPORT=1: its three routes answer as an unknown path, and nothing is written',async()=>{
  const lines=[row8()];
  const pre=await (await call('POST',['work-imports','preview'],'customer',body(lines))).json();
  delete process.env.LIBETECH_WORK_IMPORT;
  const unknown=await call('GET',['no-such-route'],'customer');
  const answers=[await call('POST',['work-imports','preview'],'customer',body(lines)),await call('POST',['work-imports'],'customer',commitBody(lines,pre.data.previewDigest)),await call('GET',['work-imports',randomUUID()],'customer')];
  for(const a of answers){expect(a.status).toBe(404);expect((await a.json()).error).toEqual((await unknown.clone().json()).error);}
  expect(await count('work_requests')+await count('work_import_rows')+await count('work_import_batches')).toBe(0);
  process.env.LIBETECH_WORK_IMPORT='0';
  expect((await call('POST',['work-imports','preview'],'customer',body(lines))).status).toBe(404);
  process.env.LIBETECH_WORK_IMPORT='1';
  expect((await call('POST',['work-imports','preview'],'customer',body(lines))).status).toBe(200);
});
