import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {openHarness,type Harness} from './slice1-db';
import {seedSlice1} from './slice1-fixtures';
import {bridgeConfig,chatSales,messageEvent,intakePrincipalId} from './slice2-fixtures';
import {COOKIE,createSession} from '../src/server/auth';
import {handleInboxApi} from '../src/server/inbox-http';
import {IntakeService} from '../src/server/intake';
import {ids} from '../src/server/identities';

let h:Harness;
const url='http://127.0.0.1:3147';
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);});
afterEach(async()=>{await h.reset();await h.close();});

const login=(profileKey:string)=>COOKIE+'='+createSession(new Request(url+'/api/demo/session',{method:'POST',headers:{host:'127.0.0.1:3147',origin:url}}),{profileKey}).token;
async function call(method:string,route:string,o:{cookie?:string|null;payload?:unknown;key?:string|null;origin?:string}={}){
  const headers:Record<string,string>={host:'127.0.0.1:3147',origin:o.origin??url};
  if(o.cookie!==null) headers.cookie=o.cookie??login('manager');
  if(o.key!==null&&method!=='GET') headers['idempotency-key']=o.key??'http-key-'+Math.random().toString(36).slice(2,12);
  return handleInboxApi(new Request(url+route,{method,headers,...(o.payload!==undefined?{body:JSON.stringify(o.payload)}:{})}),
    route.split('?')[0].split('/').filter(Boolean).slice(1),h.db);
}
const json=async(r:Response)=>r.json() as Promise<any>;
const ingest=async()=>{
  const intake=new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,bridgeConfig.intake!.chats);
  const ack=await intake.ingest(messageEvent({context:{chatId:chatSales}}));
  return (await h.operator.query<{id:string}>('SELECT id FROM intake_candidates WHERE root_source_event_id=$1',[ack.sourceEventId])).rows[0].id;
};
const confirm={kind:'confirm',expectedVersion:1,classification:'incident'};

describe('inbox HTTP',()=>{
  test('inbox routes need a session, an exact origin and an idempotency key for writes',async()=>{
    const id=await ingest();
    expect((await call('GET','/api/inbox?projectId='+ids.sales,{cookie:null})).status).toBe(401);
    expect((await call('POST',`/api/inbox/${id}/commands`,{cookie:null,payload:confirm})).status).toBe(401);
    expect((await call('POST',`/api/inbox/${id}/commands`,{payload:confirm,origin:'https://evil.example'})).status).toBe(403);
    const r=await call('POST',`/api/inbox/${id}/commands`,{payload:confirm,key:null});
    expect(r.status).toBe(400); expect((await json(r)).error.code).toBe('IDEMPOTENCY_REQUIRED');
  });
  test('a body that names tenant, actor or project is rejected with INVALID_INPUT',async()=>{
    const id=await ingest();
    for(const extra of [{tenantId:ids.otherTenant},{actorId:ids.otherTenant},{projectId:ids.transport}]){
      const r=await call('POST',`/api/inbox/${id}/commands`,{payload:{...confirm,...extra}});
      expect(r.status).toBe(422); expect((await json(r)).error.code).toBe('INVALID_INPUT');
    }
    expect((await h.operator.query<{state:string}>('SELECT state FROM intake_candidates WHERE id=$1',[id])).rows[0].state).toBe('new');
    expect((await call('GET',`/api/inbox?projectId=${ids.sales}&tenantId=${ids.otherTenant}`)).status).toBe(422);
    expect((await call('GET','/api/inbox/sources?projectId=nope')).status).toBe(422);
  });
  test('round trip: list -> detail -> confirm -> list shows the new state',async()=>{
    const id=await ingest();
    const list=await json(await call('GET',`/api/inbox?projectId=${ids.sales}&limit=10&offset=0`));
    expect(list.data.total).toBe(1); expect(list.data.items[0]).toMatchObject({candidateId:id,state:'new'});
    const det=await call('GET','/api/inbox/'+id); expect(det.status).toBe(200);
    expect((await json(det)).data.card.candidateId).toBe(id);
    const cmd=await call('POST',`/api/inbox/${id}/commands`,{payload:confirm});
    expect(cmd.status).toBe(200); expect((await json(cmd)).data.state).toBe('confirmed');
    const after=await json(await call('GET',`/api/inbox?projectId=${ids.sales}&state=confirmed`));
    expect(after.data.total).toBe(1);
    expect((await call('GET','/api/inbox/sources?projectId='+ids.sales)).status).toBe(200);
    expect((await call('GET','/api/inbox/failures?projectId='+ids.sales)).status).toBe(200);
  });
  test('unknown path, unknown candidate and a candidate outside scope answer the same 404',async()=>{
    const id=await ingest();
    const bodies:unknown[]=[];
    for(const [route,cookie] of [['/api/inbox/nothing/here/at/all',undefined],['/api/inbox/'+'00000000-0000-4000-8000-0000000000aa',undefined],['/api/inbox/'+id,login('customer')]] as const){
      const r=await call('GET',route,{cookie}); expect(r.status).toBe(404);
      const b=await json(r); delete b.meta.requestId; bodies.push(b);
    }
    expect(bodies[1]).toEqual(bodies[0]); expect(bodies[2]).toEqual(bodies[0]);
  });
  test('web routes expose no intake endpoint',async()=>{
    expect((await call('POST','/api/inbox/events',{payload:{}})).status).toBe(404);
    expect((await call('POST','/api/inbox/outbox/pull',{payload:{limit:1}})).status).toBe(404);
    const walk=(d:string):string[]=>readdirSync(d).flatMap(f=>{const p=join(d,f);return statSync(p).isDirectory()?walk(p):[p];});
    const files=[...walk('src/app/api/inbox'),'src/server/inbox-http.ts'];
    expect(files.length).toBeGreaterThan(1);
    for(const f of files) expect(readFileSync(f,'utf8')).not.toMatch(/bridge-io/);
  });
});
