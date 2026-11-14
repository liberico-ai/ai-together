import {afterEach,beforeEach,describe,expect,test,vi} from 'vitest';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {openHarness,type Harness} from './slice1-db';
import {seedSlice1} from './slice1-fixtures';
import {bridgeConfig,chatSales,messageEvent,intakePrincipalId} from './slice2-fixtures';
import {COOKIE,createSession} from '../src/server/auth';
import {handleInboxApi} from '../src/server/inbox-http';
import {IntakeService} from '../src/server/intake';
import {currentExcerptChats} from '../src/server/bridge-config';
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
  const intake=new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,bridgeConfig.intake!);
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

  // OQ-30 decided 14/11/2026: stored text is hidden as soon as the operator config no longer allows it.
  /** Runs fn with LIBETECH_BRIDGE_CONFIG pointing at a temp file holding `content` (null: variable unset). */
  const withConfig=async<T>(content:string|null,fn:()=>Promise<T>):Promise<T>=>{
    const prev=process.env.LIBETECH_BRIDGE_CONFIG;
    const dir=await mkdtemp(join(tmpdir(),'oq30-'));
    try {
      if(content===null) delete process.env.LIBETECH_BRIDGE_CONFIG;
      else {const f=join(dir,'bridge.json');await writeFile(f,content);process.env.LIBETECH_BRIDGE_CONFIG=f;}
      return await fn();
    } finally {
      if(prev===undefined) delete process.env.LIBETECH_BRIDGE_CONFIG; else process.env.LIBETECH_BRIDGE_CONFIG=prev;
      await rm(dir,{recursive:true,force:true});
    }
  };
  const flaggedConfig=JSON.stringify({...bridgeConfig,intake:{...bridgeConfig.intake!,excerptChats:[chatSales]}});
  const unflaggedConfig=JSON.stringify(bridgeConfig);

  test('OQ-30 hidden text never appears in the Inbox API',async()=>{
    const marker='MANGO-OQ30-9917';
    const intake=new IntakeService(h.operator,ids.tenant,intakePrincipalId,bridgeConfig.chatScopes,{...bridgeConfig.intake!,excerptChats:[chatSales]});
    const ev=messageEvent({context:{chatId:chatSales},text:'tin có dấu '+marker});
    const ack=await intake.ingest(ev);
    const id=(await h.operator.query<{id:string}>('SELECT id FROM intake_candidates WHERE root_source_event_id=$1',[ack.sourceEventId])).rows[0].id;
    const both=async()=>{
      const list=await call('GET',`/api/inbox?projectId=${ids.sales}`),det=await call('GET','/api/inbox/'+id);
      expect(list.status).toBe(200); expect(det.status).toBe(200);
      return {list:await json(list),det:await json(det)};
    };
    const allowed=await withConfig(flaggedConfig,both);
    expect(JSON.stringify(allowed.list)).toContain(marker);
    expect(JSON.stringify(allowed.det)).toContain(marker);
    expect(allowed.det.data.card.contentMode).toBe('excerpt');
    for(const cfg of [unflaggedConfig,'{not json',null]){
      const hidden=await withConfig(cfg,both);
      for(const b of [hidden.list,hidden.det]){const s=JSON.stringify(b);expect(s,String(cfg)).not.toContain(marker);expect(s,String(cfg)).not.toContain(ev.contentHash);}
      expect(hidden.list.data.items[0]).toMatchObject({contentMode:'hidden',excerpt:null});
      expect(hidden.det.data.revisions[0]).toMatchObject({contentMode:'hidden',excerpt:null,contentHash:null});
    }
    expect((await h.operator.query<{text_excerpt:string}>('SELECT text_excerpt FROM source_event_revisions WHERE source_event_id=$1',[ack.sourceEventId])).rows[0].text_excerpt).toContain(marker);
  });

  test('the Inbox reads the flag list from the operator config and treats an unreadable config as no flag',async()=>{
    const logs:string[]=[];
    const spy=vi.spyOn(console,'error').mockImplementation((...a:unknown[])=>{logs.push(a.map(String).join(' '));});
    try {
      expect(await withConfig(flaggedConfig,currentExcerptChats)).toEqual([chatSales]);
      expect(await withConfig(unflaggedConfig,currentExcerptChats)).toEqual([]);
      expect(logs).toEqual([]);
      expect(await withConfig(null,currentExcerptChats)).toEqual([]);
      expect(await withConfig('{"secret-looking":"PAPAYA-CONTENT-1"',currentExcerptChats)).toEqual([]);
      expect(await withConfig(JSON.stringify({...bridgeConfig,intake:{...bridgeConfig.intake!,excerptChats:['-1000000000099']}}),currentExcerptChats)).toEqual([]);
      expect(logs.length).toBe(2);
      for(const l of logs){
        expect(JSON.parse(l)).toMatchObject({level:'error',event:'bridge_config_unreadable'});
        expect(l).not.toContain('PAPAYA');expect(l).not.toContain(tmpdir());expect(l).not.toContain('bridge.json');
      }
    } finally { spy.mockRestore(); }
    for(const f of ['src/server/inbox-http.ts','src/app/inbox/page.tsx'])
      expect(readFileSync(f,'utf8'),f).toMatch(/new InboxService\(db, await currentExcerptChats\(\)\)/);
  });
});
