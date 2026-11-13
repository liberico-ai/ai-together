import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {openHarness,type Harness} from './slice1-db';
import {seedSlice1} from './slice1-fixtures';
import {COOKIE,createSession} from '../src/server/auth';
import {handleDocumentsApi} from '../src/server/documents-http';
import {syncTemplateIndex} from '../src/server/document-templates';
import {projectDocumentIndex} from '../src/server/document-projector';
import {ids} from '../src/server/identities';

let h:Harness;
const url='http://127.0.0.1:3147';
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);
  for(const t of [ids.tenant,ids.otherTenant]) await h.operator.transaction(tx=>syncTemplateIndex(tx,t));});
afterEach(async()=>{await h.reset();await h.close();});

const login=(profileKey:string)=>COOKIE+'='+createSession(new Request(url+'/api/demo/session',{method:'POST',headers:{host:'127.0.0.1:3147',origin:url}}),{profileKey}).token;
async function call(method:string,route:string,o:{cookie?:string|null;payload?:unknown;key?:string|null;origin?:string}={}){
  const headers:Record<string,string>={host:'127.0.0.1:3147',origin:o.origin??url};
  if(o.cookie!==null) headers.cookie=o.cookie??login('manager');
  if(o.key!==null&&method!=='GET') headers['idempotency-key']=o.key??'http-key-'+Math.random().toString(36).slice(2,12);
  const res=await handleDocumentsApi(new Request(url+route,{method,headers,...(o.payload!==undefined?{body:JSON.stringify(o.payload)}:{})}),
    route.split('?')[0].split('/').filter(Boolean).slice(1),h.db);
  return res;
}
const json=async(r:Response)=>r.json() as Promise<any>;
const docBody=(over:Record<string,unknown>={})=>({projectId:ids.sales,refCode:'DOC-HTTP-1',docType:'design',title:'Tài liệu HTTP tổng hợp',templateCode:'T3',sourceType:'drive',
  canonicalUri:'https://docs.google.com/docs/http-1',ownerLabel:'',reviewDueAt:null,metadata:{missingFields:['a']},sourceLinks:[],...over});
const revBody={expectedVersion:1,basedOnRevisionId:null,sourceRevision:null,sourceHash:null,sourceModifiedAt:null,
  changes:{summary:'Tóm tắt thay đổi tổng hợp',present:['Mục A'],missing:['x']},sourceRefs:[]};
const count=async(t:string)=>(await h.operator.query<{n:number}>(`SELECT count(*)::int n FROM ${t}`)).rows[0].n;

describe('documents HTTP',()=>{
  test('register -> propose -> list -> search -> export -> source round trip over HTTP',async()=>{
    const cookie=login('manager');
    const reg=await call('POST','/api/documents/register',{cookie,payload:docBody()});
    expect(reg.status).toBe(201);
    const rb=await json(reg); expect(rb).toMatchObject({error:null,meta:{requestId:expect.any(String)}});
    const id=rb.data.record.id as string;
    const prop=await call('POST',`/api/documents/${id}/revision-proposals`,{cookie,payload:revBody});
    expect(prop.status).toBe(200); expect((await json(prop)).data.revisions).toHaveLength(1);
    await projectDocumentIndex(h.operator,ids.tenant,ids.sales);
    const list=await call('GET','/api/documents?projectId='+ids.sales,{cookie});
    expect(list.status).toBe(200); expect((await json(list)).data.total).toBe(1);
    const search=await call('GET',`/api/documents/search?q=HTTP&projectId=${ids.sales}&docType=design&limit=10&offset=0`,{cookie});
    expect(search.status).toBe(200); expect((await json(search)).data.rows[0].ref_code).toBe('DOC-HTTP-1');
    const exp=await call('GET','/api/documents/export?projectId='+ids.sales,{cookie});
    expect(exp.status).toBe(200); expect(await exp.text()).toContain('DOC-HTTP-1');
    const det=await call('GET','/api/documents/'+id,{cookie}); expect(det.status).toBe(200);
    const src=await call('GET',`/api/documents/${id}/source`,{cookie});
    expect(src.status).toBe(200); expect((await json(src)).data.uri).toBe('https://docs.google.com/docs/http-1');
    expect((await call('GET','/api/documents',{cookie})).status).toBe(422);
    expect((await call('GET','/api/documents/export',{cookie})).status).toBe(422);
    expect((await call('GET','/api/documents/search?q=x',{cookie})).status).toBe(422);
    expect((await call('GET','/api/nothing/here',{cookie})).status).toBe(404);
  });
  test('project registry routes round trip',async()=>{
    const cookie=login('manager');
    const profile={expectedVersion:0,objective:'Mục tiêu tổng hợp',ownerBu:'BU mẫu',pmLabel:'PM mẫu',vaultPointer:null,repoUrl:null,status:'proposed'};
    expect((await call('PUT',`/api/projects/${ids.sales}/profile`,{cookie,payload:profile})).status).toBe(200);
    expect((await call('POST',`/api/projects/${ids.sales}/channels`,{cookie,payload:{expectedVersion:1,chatId:'-100123',topicId:'',mode:'command_reply',policyVersion:'v1'}})).status).toBe(200);
    const reg=await json(await call('GET',`/api/projects/${ids.sales}/registry`,{cookie}));
    expect(reg.data.profile.objective).toBe('Mục tiêu tổng hợp'); expect(reg.data.channels).toHaveLength(1);
  });
  test('a body carrying tenantId or actorId is INVALID_INPUT',async()=>{
    for(const extra of [{tenantId:ids.otherTenant},{actorId:ids.otherTenant}]){
      const r=await call('POST','/api/documents/register',{payload:docBody(extra)});
      expect(r.status).toBe(422); expect((await json(r)).error.code).toBe('INVALID_INPUT');
    }
    expect(await count('document_records')).toBe(0);
  });
  test('a write without Idempotency-Key is IDEMPOTENCY_REQUIRED',async()=>{
    const r=await call('POST','/api/documents/register',{payload:docBody(),key:null});
    expect(r.status).toBe(400); expect((await json(r)).error.code).toBe('IDEMPOTENCY_REQUIRED');
    expect(await count('document_records')).toBe(0);
  });
  test('a request without a session is 401 and a foreign Origin is rejected',async()=>{
    expect((await call('GET','/api/documents?projectId='+ids.sales,{cookie:null})).status).toBe(401);
    expect((await call('POST','/api/documents/register',{cookie:null,payload:docBody()})).status).toBe(401);
    const r=await call('POST','/api/documents/register',{payload:docBody(),origin:'https://evil.example'});
    expect(r.status).toBe(403); expect(await count('document_records')).toBe(0);
  });
  test("bot and viewer sessions get 403; another project's document id gets 404 with the generic message",async()=>{
    const made=await json(await call('POST','/api/documents/register',{payload:docBody()}));
    const id=made.data.record.id as string;
    expect((await call('GET','/api/documents?projectId='+ids.transport,{cookie:login('bot')})).status).toBe(403);
    expect((await call('GET','/api/documents/'+id,{cookie:login('bot')})).status).toBe(403);
    expect((await call('POST','/api/documents/register',{cookie:login('customer'),payload:docBody({projectId:ids.transport,canonicalUri:'https://docs.google.com/docs/v'})})).status).toBe(403);
    const foreign=await call('GET','/api/documents/'+id,{cookie:login('customer')});
    expect(foreign.status).toBe(404);
    const fb=await json(foreign); const text=JSON.stringify(fb);
    expect(text).not.toContain('Tài liệu HTTP tổng hợp'); expect(text).not.toContain('DOC-HTTP-1');
    const missing=await call('GET','/api/documents/00000000-0000-4000-8000-000000000000',{cookie:login('customer')});
    expect(missing.status).toBe(404); expect((await json(missing)).error).toEqual(fb.error);
  });
  test('the same document URI registered twice returns DOCUMENT_ALREADY_REGISTERED, not DUPLICATE_CODE',async()=>{
    expect((await call('POST','/api/documents/register',{payload:docBody()})).status).toBe(201);
    const r=await call('POST','/api/documents/register',{payload:docBody({refCode:'DOC-HTTP-2'})});
    expect(r.status).toBe(409); expect((await json(r)).error.code).toBe('DOCUMENT_ALREADY_REGISTERED');
  });
  test('export responds with text/csv and no-store',async()=>{
    const r=await call('GET','/api/documents/export?projectId='+ids.sales);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(r.headers.get('content-disposition')).toBe('attachment; filename="tai-lieu.csv"');
    expect(r.headers.get('cache-control')).toBe('no-store');
  });
});
