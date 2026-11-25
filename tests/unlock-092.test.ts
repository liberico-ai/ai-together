import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {openHarness,type Harness} from './slice1-db';
import {member,pm,seedSlice1} from './slice1-fixtures';
import {approver,mapDomain,reviewer,seedMembers} from './slice3-fixtures';
import {WorkRequestService,requestScope} from '../src/server/work-requests';
import {WorkService} from '../src/server/service';
import {BomService} from '../src/server/bom';
import {IdentityService,digest,secret} from '../src/server/identity';
import {scoped} from '../src/server/db';
import {demoProfiles,ids} from '../src/server/identities';
import {projectRole} from '../src/server/types';
import type {Principal} from '../src/server/types';

// GIAO VIỆC 7 (bản 0.9.2 «MỞ KHOÁ»): one group per item M1–M7 and M10, and a group for an IBS HI project. Synthetic people only: made-up names, made-up ids.
// Every case answers through an assertion (attempt() turns a refusal into a value), so a red run counts AssertionErrors, never a thrown service error.
type R=Record<string,unknown>;
const person=(n:number)=>'14000000-0000-4000-8000-0000000000'+String(n).padStart(2,'0');
const techId='14000000-0000-4000-8000-000000000077';
const tech:Principal={id:techId,tenantId:ids.tenant,projectIds:[ids.transport],name:'Thành viên Tech thử',role:'viewer',techMember:true,
  grants:[{projectId:ids.transport,role:'viewer',reportPermissions:[]}]};
const bare=(id:string,name:string):Principal=>({id,tenantId:ids.tenant,projectIds:[],name,role:'viewer',grants:[],techMember:true});
const bomA=bare(person(81),'BoM Tech thử A'),bomB=bare(person(82),'BoM Tech thử B'),bomC=bare(person(83),'BoM Tech thử C');
const rosterTechnical:Principal={id:person(84),tenantId:ids.tenant,projectIds:[ids.sales],name:'Tech vai kỹ thuật thử',role:'technical',techMember:true,
  grants:[{projectId:ids.sales,role:'technical',reportPermissions:[]}]};
const offRoster:Principal={id:person(85),tenantId:ids.tenant,projectIds:[ids.sales],name:'Người xem ngoài Team Tech',role:'viewer',
  grants:[{projectId:ids.sales,role:'viewer',reportPermissions:[]}]};
const rosterNoGrant=person(86),offRosterNoGrant=person(87);
const ibs={project:'11000000-0000-4000-8000-0000000000a1',service:'12000000-0000-4000-8000-0000000000a1',name:'IBS HI · Dự án thử'};
const NOTE='Đã xem xét và đồng ý tạo việc.';
const SHA='b'.repeat(40);

let h:Harness;
const rows=async<T=R>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
const user=(id:string,username:string,name:string,role:string)=>h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,$3,$4,$5,'fixture-only')`,[id,ids.tenant,username,name,role]);
const grant=(id:string,project:string,role:string)=>h.operator.query('INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,$4)',[ids.tenant,id,project,role]);
const roster=(id:string)=>h.operator.query('INSERT INTO identity.tech_roster(tenant_id,user_id) VALUES($1,$2)',[ids.tenant,id]);
beforeEach(async()=>{
  h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);
  await user(tech.id,'gv7-tech',tech.name,'viewer');await grant(tech.id,ids.transport,'viewer');await roster(tech.id);
  for(const [i,b] of [bomA,bomB,bomC].entries()) { await user(b.id,'gv7-bom-'+i,b.name,'viewer');await roster(b.id); }
  for(const [i,b] of [bomA,bomB,bomC].entries()) await h.operator.query('INSERT INTO identity.tech_bom(tenant_id,user_id,seat) VALUES($1,$2,$3)',[ids.tenant,b.id,i+1]);
  await user(rosterTechnical.id,'gv7-technical',rosterTechnical.name,'technical');await grant(rosterTechnical.id,ids.sales,'technical');await roster(rosterTechnical.id);
  await user(offRoster.id,'gv7-off-roster',offRoster.name,'viewer');await grant(offRoster.id,ids.sales,'viewer');
  await user(rosterNoGrant,'gv7-roster-nogrant','Tech chưa có dự án thử','viewer');await roster(rosterNoGrant);
  await user(offRosterNoGrant,'gv7-off-nogrant','Người chưa có dự án thử','viewer');
  // the three BoM seats of sales, each with Telegram linked (the 3/3 ballot needs it)
  for(const [i,p] of [pm,reviewer,approver].entries())
    await h.operator.query('INSERT INTO identity.telegram_links(tenant_id,user_id,telegram_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[ids.tenant,p.id,String(930100+i)]);
  await h.operator.query('INSERT INTO bom_scopes(tenant_id,project_id,seat_ids,enabled) VALUES($1,$2,$3,true)',[ids.tenant,ids.sales,[pm.id,reviewer.id,approver.id]]);
  // an IBS HI project with one service and its reporting-domain row; nobody of this file holds a grant in it
  await h.operator.query('INSERT INTO projects(id,tenant_id,name,bu) VALUES($1,$2,$3,$4)',[ibs.project,ids.tenant,ibs.name,'IBS HI']);
  await h.operator.query(`INSERT INTO services(id,tenant_id,project_id,name,owner,repository,environment) VALUES($1,$2,$3,'Hệ thống thử IBS','Đội thử','demo/ibs-test','Môi trường thử')`,[ibs.service,ids.tenant,ibs.project]);
  await mapDomain(h,ibs.project,'IBS_HI');
});
afterEach(async()=>{await h.reset();await h.close();});

const svc=()=>new WorkRequestService(h.db);
const work=()=>new WorkService(h.db);
const k=()=>randomUUID();
const input=(over:R={})=>({projectId:ids.sales,requestKey:randomUUID(),code:null,title:'Việc mới do Tech gửi để duyệt',priority:'normal',dueAt:null,criteria:'',specUrl:null,assigneeId:null,technicalId:null,businessId:null,...over});
const file=async(over:R={},who:Principal=tech)=>(await svc().submit(who,input(over))).request;
const decision=(over:R={})=>({decision:'approve',expectedVersion:1,serviceId:ids.salesService,code:null,note:NOTE,assigneeId:member.id,technicalId:null,businessId:null,...over});
type Outcome<T>={ok:true;value:T}|{ok:false;code:string;status:number;message:string};
/** A refusal becomes a value, so every case fails by assertion. */
async function attempt<T>(fn:()=>Promise<T>):Promise<Outcome<T>> {
  try { return {ok:true,value:await fn()}; }
  catch(e) { const x=e as {code?:string;status?:number;message?:string}; return {ok:false,code:x.code??'THROWN',status:x.status??0,message:x.message??String(e)}; }
}
/** The principal the server builds from a session of this account (identity service, the same code a login runs). */
async function sessionOf(userId:string):Promise<Outcome<Principal>> {
  const token=secret();
  await h.operator.query("INSERT INTO identity.sessions(tenant_id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[ids.tenant,userId,digest(token)]);
  return attempt(()=>new IdentityService(h.operator,ids.tenant).session(token));
}
const approve=(who:Principal,id:string,over:R={})=>attempt(()=>svc().decide(who,id,decision(over),k()));
const transition=(who:Principal,workId:string,version:number,state:string)=>attempt(()=>work().command(who,workId,{kind:'transition',expectedVersion:version,state,note:'Chuyển bước thử.'},k()));
const grants=(workId:string)=>rows<{user_id:string;granted_by:string;source_kind:string;source_id:string;project_id:string}>('SELECT user_id,granted_by,source_kind,source_id,project_id FROM work_access_grants WHERE work_id=$1 ORDER BY created_at',[workId]);

describe('M1 · a BoM seat may be the performer',()=>{
  test('M1 a seat approves new work for itself, and for another seat of the project',async()=>{
    const r=await file();
    const own=await approve(pm,r.id,{assigneeId:pm.id});
    expect(own).toMatchObject({ok:true,value:{request:{state:'approved',decided_by:pm.id},work:{assignee_id:pm.id}}});
    const s=await file();
    const other=await approve(pm,s.id,{assigneeId:reviewer.id});
    expect(other).toMatchObject({ok:true,value:{work:{assignee_id:reviewer.id}}});
  });
  test('M1 the creator still never approves, and the performer still differs from each acceptor',async()=>{
    const r=await file({},pm);
    expect(await approve(pm,r.id)).toMatchObject({ok:false,code:'SELF_APPROVAL'});
    const s=await file();
    expect(await approve(pm,s.id,{assigneeId:reviewer.id,technicalId:reviewer.id})).toMatchObject({ok:false,code:'SELF_ACCEPTANCE'});
    expect((await rows('SELECT 1 FROM work_requests WHERE id=ANY($1::uuid[]) AND state=$2',[[r.id,s.id],'pending'])).length).toBe(2);
  });
});

describe('M2 · every Team Tech member may be the performer, in every project',()=>{
  test('M2 a roster member with no grant in the project is assigned, gets a traced grant and does every performer step',async()=>{
    const r=await file();
    const done=await approve(pm,r.id,{assigneeId:tech.id,technicalId:reviewer.id,businessId:approver.id});
    expect(done).toMatchObject({ok:true,value:{work:{assignee_id:tech.id}}});
    const w=(done as {value:{work:{id:string;version:number}}}).value.work;
    expect(await grants(w.id)).toEqual([{user_id:tech.id,granted_by:pm.id,source_kind:'work_request',source_id:r.id,project_id:ids.sales}]);
    const s=await sessionOf(tech.id);
    expect(s).toMatchObject({ok:true});
    const me=(s as {value:Principal}).value;
    expect(me.projectIds).toContain(ids.sales);
    expect(projectRole(me,ids.sales)).toBe('viewer');
    expect(await attempt(()=>work().detail(me,w.id))).toMatchObject({ok:true,value:{work:{id:w.id}}});
    const doing=await transition(me,w.id,w.version,'doing');
    expect(doing).toMatchObject({ok:true,value:{work:{state:'doing'}}});
    // the coordinator opens a revision with the code version; the performer then files evidence and hands over
    const v=(doing as {value:{work:{version:number}}}).value.work.version;
    const revised=await attempt(()=>work().command(pm,w.id,{kind:'revise',expectedVersion:v,sourceSha:SHA,criteria:'Đạt khi có biên bản kiểm thử.',specUrl:'https://example.com/spec/gv7',dueAt:null,
      assigneeId:tech.id,technicalId:reviewer.id,businessId:approver.id,note:'Gắn phiên bản mã nguồn.'},k()));
    expect(revised).toMatchObject({ok:true});
    const v2=(revised as {value:{work:{version:number}}}).value.work.version;
    const evidence=await attempt(()=>work().command(me,w.id,{kind:'evidence',expectedVersion:v2,evidenceKind:'checks',sourceId:'https://github.com/example/repo/pull/1',sourceType:'github',sourceSha:SHA,note:'Kết quả kiểm thử tự động.'},k()));
    expect(evidence).toMatchObject({ok:true});
    const v3=(evidence as {value:{work:{version:number}}}).value.work.version;
    expect(await transition(me,w.id,v3,'review')).toMatchObject({ok:true,value:{work:{state:'review'}}});
  });
  test('M2 a roster member who holds another role in the project gets no extra grant and does the performer steps',async()=>{
    const r=await file();
    const done=await approve(reviewer,r.id,{assigneeId:rosterTechnical.id,technicalId:null});
    expect(done).toMatchObject({ok:true,value:{work:{assignee_id:rosterTechnical.id}}});
    const w=(done as {value:{work:{id:string;version:number}}}).value.work;
    expect(await grants(w.id)).toEqual([]);
    expect(await transition(rosterTechnical,w.id,w.version,'doing')).toMatchObject({ok:true,value:{work:{state:'doing'}}});
  });
  test('M2 a person off the roster keeps the role rule: a viewer is not a performer and gains nothing',async()=>{
    const r=await file();
    const refused=await approve(pm,r.id,{assigneeId:offRoster.id});
    expect(refused).toMatchObject({ok:false,code:'INVALID_ASSIGNMENT',status:422});
    expect((refused as {message:string}).message).toMatch(/Team Tech/);
    expect(await rows('SELECT 1 FROM work_access_grants')).toEqual([]);
    expect((await rows('SELECT state FROM work_requests WHERE id=$1',[r.id]))[0]).toEqual({state:'pending'});
  });
  test('M2 a grant cannot be forged at the table: not the performer, off the roster, in someone else\'s name, and never changed',async()=>{
    const r=await file();
    const done=await approve(pm,r.id,{assigneeId:tech.id});
    const w=(done as {value:{work:{id:string}}}).value.work;
    const asPm=(sql:string,params:unknown[])=>attempt(()=>scoped(h.db,pm,async tx=>{await tx.query("SELECT set_config('app.person_id',$1,true)",[pm.id]);await tx.query(sql,params);}));
    const insert=`INSERT INTO work_access_grants(tenant_id,project_id,work_id,user_id,source_kind,source_id,granted_by) VALUES($1,$2,$3,$4,'work_request',$5,$6)`;
    for(const who of [member.id,offRoster.id,bomA.id]) expect(await asPm(insert,[ids.tenant,ids.sales,w.id,who,r.id,pm.id]),who).toMatchObject({ok:false});
    expect(await asPm(insert,[ids.tenant,ids.sales,w.id,tech.id,r.id,reviewer.id])).toMatchObject({ok:false});
    expect(await attempt(()=>rows('UPDATE work_access_grants SET granted_by=$1 WHERE work_id=$2',[reviewer.id,w.id]))).toMatchObject({ok:false});
    expect(await attempt(()=>rows('DELETE FROM work_access_grants WHERE work_id=$1',[w.id]))).toMatchObject({ok:false});
    expect(await grants(w.id)).toHaveLength(1);
  });
  test('M2 a granted roster member still acts only on work assigned to them',async()=>{
    const r=await file();
    await approve(pm,r.id,{assigneeId:tech.id});
    const me=((await sessionOf(tech.id)) as {value:Principal}).value;
    const other=(await rows<{version:number}>('SELECT version FROM work_items WHERE id=$1',[ids.pilot]))[0];
    expect(await transition(me,ids.pilot,other.version,'doing')).toMatchObject({ok:false});
  });
});

describe('M3 · at approval the seat may change a proposed person',()=>{
  test('M3 proposed, final and who changed are stored',async()=>{
    const r=await file({assigneeId:member.id},pm);
    const done=await approve(reviewer,r.id,{assigneeId:tech.id,technicalId:reviewer.id});
    expect(done).toMatchObject({ok:true,value:{work:{assignee_id:tech.id,technical_id:reviewer.id}}});
    const ev=(await rows<{actor_id:string;payload:R}>("SELECT actor_id,payload FROM work_request_events WHERE request_id=$1 AND kind='approved'",[r.id]))[0];
    expect(ev.actor_id).toBe(reviewer.id);
    expect(ev.payload).toMatchObject({proposed:{assigneeId:member.id,technicalId:null,businessId:null},final:{assigneeId:tech.id,technicalId:reviewer.id,businessId:null},
      changedBySeat:['assigneeId'],filledBySeat:['technicalId']});
    const w=(done as {value:{work:{id:string}}}).value.work;
    const created=(await rows<{payload:R}>("SELECT payload FROM audit_events WHERE work_id=$1 AND kind='created'",[w.id]))[0];
    expect(created.payload).toMatchObject({approvedBy:reviewer.id,proposed:{assigneeId:member.id},final:{assigneeId:tech.id},changedBySeat:['assigneeId']});
  });
});

describe('M4 · work approved from a request can be reassigned by the 3/3 ballot',()=>{
  test('M4 approval writes a source row that points at the request; the 3/3 ballot then moves the performer and grants access',async()=>{
    const r=await file();
    const done=await approve(pm,r.id,{assigneeId:member.id});
    const w=(done as {value:{work:{id:string;version:number}}}).value.work;
    const hash=(await rows<{request_hash:string}>('SELECT request_hash FROM work_requests WHERE id=$1',[r.id]))[0].request_hash;
    expect(await rows('SELECT source_ref,fingerprint,valid_until=$2::timestamptz AS forever FROM bom_sources WHERE work_id=$1',[w.id,'infinity'])).toEqual([{source_ref:'work_request:'+r.id,fingerprint:hash,forever:true}]);
    const bom=new BomService(h.db);
    const card=await attempt(()=>bom.command(pm,{action:'propose',workId:w.id,expectedVersion:w.version,allocation:{lead_id:tech.id,parts:[]},reason:'Chia lại cho thành viên Team Tech.'},k()));
    expect(card).toMatchObject({ok:true,value:{proposal:{state:'pending'}}});
    const proposalId=(card as {value:{proposal:{id:string}}}).value.proposal.id;
    for(const seat of [pm,reviewer,approver]) expect(await attempt(()=>bom.command(seat,{action:'vote',proposalId,choice:'agree',note:'Đồng ý chia lại.'},k())),seat.name).toMatchObject({ok:true});
    expect((await rows('SELECT assignee_id FROM work_items WHERE id=$1',[w.id]))[0]).toEqual({assignee_id:tech.id});
    expect((await grants(w.id)).map(g=>[g.user_id,g.source_kind,g.source_id])).toEqual([[tech.id,'bom_allocation',proposalId]]);
  });
  test('M4 a source row of a request cannot be changed or removed, and the runtime writes no other source row',async()=>{
    const r=await file();
    const w=((await approve(pm,r.id)) as {value:{work:{id:string}}}).value.work;
    expect(await attempt(()=>rows("UPDATE bom_sources SET fingerprint=$1 WHERE work_id=$2",['c'.repeat(64),w.id]))).toMatchObject({ok:false});
    expect(await attempt(()=>rows('DELETE FROM bom_sources WHERE work_id=$1',[w.id]))).toMatchObject({ok:false});
    const pending=await file();
    const asPm=(sql:string,params:unknown[])=>attempt(()=>scoped(h.db,pm,async tx=>{await tx.query("SELECT set_config('app.person_id',$1,true)",[pm.id]);await tx.query(sql,params);}));
    const insert="INSERT INTO bom_sources(work_id,tenant_id,project_id,source_ref,fingerprint,checked_at,valid_until) VALUES($1,$2,$3,$4,$5,now(),'infinity')";
    // a work item of the seed with no source row: neither a made-up source nor a request that is still pending may stand behind it
    expect(await asPm(insert,[ids.pilot,ids.tenant,ids.sales,'importer:made-up','d'.repeat(64)])).toMatchObject({ok:false});
    expect(await asPm(insert,[ids.pilot,ids.tenant,ids.sales,'work_request:'+pending.id,pending.request_hash])).toMatchObject({ok:false});
    expect(await rows('SELECT 1 FROM bom_sources WHERE work_id=$1',[ids.pilot])).toEqual([]);
  });
});

describe('M5 · no request waits forever',()=>{
  test('M5 a BoM Tech with no grant and no Telegram link approves in a project without seats and in a seated one',async()=>{
    const t=await file({projectId:ids.transport});
    const s=await file();
    const listed=await attempt(()=>svc().list(bomA,{}));
    expect(listed).toMatchObject({ok:true});
    const items=(listed as {value:{items:{id:string;can_decide:boolean}[]}}).value.items;
    expect(items.filter(i=>[t.id,s.id].includes(i.id)).map(i=>i.can_decide)).toEqual([true,true]);
    expect(await approve(bomA,t.id,{serviceId:ids.transportService,assigneeId:tech.id})).toMatchObject({ok:true,value:{request:{decided_by:bomA.id},work:{project_id:ids.transport,assignee_id:tech.id}}});
    expect(await approve(bomA,s.id)).toMatchObject({ok:true,value:{request:{decided_by:bomA.id},work:{project_id:ids.sales}}});
  });
  test('M5 a BoM Tech does not approve their own request; another BoM Tech does',async()=>{
    const r=await file({projectId:ids.transport},bomA);
    expect(await approve(bomA,r.id,{serviceId:ids.transportService,assigneeId:tech.id})).toMatchObject({ok:false,code:'SELF_APPROVAL'});
    expect(await approve(bomB,r.id,{serviceId:ids.transportService,assigneeId:tech.id})).toMatchObject({ok:true,value:{request:{decided_by:bomB.id}}});
  });
  test('M5 a project seat approves on the web without a Telegram link; the 3/3 ballot still needs every seat linked',async()=>{
    await h.operator.query('DELETE FROM identity.telegram_links WHERE user_id=$1',[approver.id]);
    const r=await file();
    const done=await approve(approver,r.id);
    expect(done).toMatchObject({ok:true,value:{request:{decided_by:approver.id}}});
    const w=(done as {value:{work:{id:string;version:number}}}).value.work;
    const propose=await attempt(()=>new BomService(h.db).command(pm,{action:'propose',workId:w.id,expectedVersion:w.version,allocation:{lead_id:tech.id,parts:[]},reason:'Chia lại thử khi thiếu ghép.'},k()));
    expect(propose).toMatchObject({ok:false,code:'BOM_UNAVAILABLE'});
  });
  test('M5 a roster member who is not BoM Tech, and a member who holds no seat, decide nothing',async()=>{
    const r=await file({projectId:ids.transport},bomA);
    for(const who of [tech,member,offRoster]) expect(await approve(who,r.id,{serviceId:ids.transportService,assigneeId:tech.id}),who.name).toMatchObject({ok:false,code:'NOT_FOUND'});
    expect((await rows('SELECT state FROM work_requests WHERE id=$1',[r.id]))[0]).toEqual({state:'pending'});
  });
  test('M5 a tenant has at most three BoM Tech, and every change is an identity event',async()=>{
    await user(person(88),'gv7-bom-4','BoM Tech thứ tư thử','viewer');
    expect(await attempt(()=>rows('INSERT INTO identity.tech_bom(tenant_id,user_id,seat) VALUES($1,$2,4)',[ids.tenant,person(88)]))).toMatchObject({ok:false});
    expect(await attempt(()=>rows('INSERT INTO identity.tech_bom(tenant_id,user_id,seat) VALUES($1,$2,1)',[ids.tenant,person(88)]))).toMatchObject({ok:false});
    const before=(await rows<{n:number}>("SELECT count(*)::int n FROM identity.events WHERE kind='tech_bom_removed'"))[0].n;
    await rows('DELETE FROM identity.tech_bom WHERE user_id=$1',[bomC.id]);
    expect((await rows<{n:number}>("SELECT count(*)::int n FROM identity.events WHERE kind='tech_bom_removed'"))[0].n).toBe(before+1);
    // once removed, the person approves nothing more
    const r=await file({projectId:ids.transport});
    expect(await approve(bomC,r.id,{serviceId:ids.transportService,assigneeId:tech.id})).toMatchObject({ok:false,code:'NOT_FOUND'});
  });
  test('M5 the operator script sets zero to three BoM Tech, idempotently, with the source on each event',async()=>{
    const script=await readFile(path.join(process.cwd(),'deploy/tech-bom.sql'),'utf8');
    const fill=(userIds:string)=>{
      let sql=script;
      const vars={tenant_id:ids.tenant,user_ids:userIds,source:'bien-ban-thu-nghiem-gv7'};
      for(const [key,v] of Object.entries(vars)) sql=sql.replaceAll(`:'${key}'`,"'"+v.replaceAll("'","''")+"'");
      return sql.split('\n').filter(l=>!l.startsWith('\\')).join('\n');
    };
    const sql=fill(`${bomB.id},${bomA.id},${rosterTechnical.id}`);
    const baseline=(await rows<{id:string}>('SELECT id FROM identity.events')).map(r=>r.id);
    await h.exec(sql);
    expect((await rows<{user_id:string}>('SELECT user_id FROM identity.tech_bom WHERE tenant_id=$1 ORDER BY seat',[ids.tenant])).map(r=>r.user_id)).toEqual([bomB.id,bomA.id,rosterTechnical.id]);
    const events=await rows<{kind:string;detail:R}>('SELECT kind,detail FROM identity.events WHERE kind LIKE $1 AND NOT (id=ANY($2::uuid[]))',['tech_bom_%',baseline]);
    expect(events.length).toBeGreaterThan(0);
    for(const e of events) expect(e.detail).toMatchObject({source:'bien-ban-thu-nghiem-gv7'});
    const after=(await rows<{id:string}>('SELECT id FROM identity.events')).map(r=>r.id);
    await h.exec(sql);
    expect((await rows('SELECT 1 FROM identity.events WHERE NOT (id=ANY($1::uuid[]))',[after]))).toEqual([]);
    // fewer than three while a seat is not yet named, and none at all, are accepted; four, a repeated id or a missing account are not
    const seats=async()=>(await rows<{user_id:string}>('SELECT user_id FROM identity.tech_bom WHERE tenant_id=$1 ORDER BY seat',[ids.tenant])).map(r=>r.user_id);
    expect(await attempt(()=>h.exec(fill(`${bomC.id},${bomA.id}`)))).toMatchObject({ok:true});
    expect(await seats()).toEqual([bomC.id,bomA.id]);
    expect(await attempt(()=>h.exec(fill('')))).toMatchObject({ok:true});
    expect(await seats()).toEqual([]);
    for(const bad of [`${bomA.id},${bomB.id},${bomC.id},${rosterTechnical.id}`,`${bomA.id},${bomA.id}`,`${bomA.id},${person(99)}`]) {
      expect(await attempt(()=>h.exec(fill(bad))),bad).toMatchObject({ok:false});
      await h.exec('ROLLBACK').catch(()=>{});
    }
    expect(await seats()).toEqual([]);
  });
});

describe('M6 · a roster member with no membership signs in',()=>{
  test('M6 they see the project list, file a request and see it',async()=>{
    const s=await sessionOf(rosterNoGrant);
    expect(s).toMatchObject({ok:true,value:{id:rosterNoGrant,projectIds:[],techMember:true}});
    const me=(s as {value:Principal}).value;
    const catalog=await attempt(()=>svc().catalog(me));
    expect(catalog).toMatchObject({ok:true});
    expect((catalog as {value:{id:string}[]}).value.map(c=>c.id)).toEqual(expect.arrayContaining([ids.sales,ids.transport,ibs.project]));
    const filed=await attempt(()=>svc().submit(me,input({projectId:ids.transport})));
    expect(filed).toMatchObject({ok:true,value:{request:{requester_id:rosterNoGrant,state:'pending'}}});
    const mine=await attempt(()=>svc().list(me,{}));
    expect(mine).toMatchObject({ok:true,value:{total:1}});
  });
  test('M6 off the roster with no membership is still refused, and told what to do',async()=>{
    const s=await sessionOf(offRosterNoGrant);
    expect(s).toMatchObject({ok:false,code:'NO_PROJECT_ACCESS'});
    expect((s as {message:string}).message).toMatch(/quản trị/);
  });
});

describe('M7 · many requests in one approval',()=>{
  test('M7 each request keeps its own event and approver; a failing row does not stop the others; a replay writes nothing new',async()=>{
    const a=await file({assigneeId:member.id},pm);
    const b=await file();
    const c=await file();
    await approve(reviewer,c.id);
    const body={requestIds:[a.id,b.id,c.id],services:[{projectId:ids.sales,serviceId:ids.salesService}],note:NOTE};
    const key=k();
    const out=await attempt(()=>svc().decideMany(reviewer,body,key));
    expect(out).toMatchObject({ok:true,value:{results:[
      {id:a.id,ok:true,workId:expect.any(String)},
      {id:b.id,ok:false,code:'ASSIGNEE_REQUIRED',message:expect.stringMatching(/Chọn người thực hiện/)},
      {id:c.id,ok:false,code:'REQUEST_DECIDED'},
    ]}});
    expect(await rows("SELECT actor_id FROM work_request_events WHERE request_id=$1 AND kind='approved'",[a.id])).toEqual([{actor_id:reviewer.id}]);
    const works=(await rows<{n:number}>('SELECT count(*)::int n FROM work_items'))[0].n;
    const again=await attempt(()=>svc().decideMany(reviewer,body,key));
    expect(again).toMatchObject({ok:true,value:{results:[{id:a.id,ok:true},{id:b.id,ok:false},{id:c.id,ok:false}]}});
    expect((await rows<{n:number}>('SELECT count(*)::int n FROM work_items'))[0].n).toBe(works);
  });
  test('M7 a project with one service needs no choice; a project with several asks for one, row by row',async()=>{
    await h.operator.query(`INSERT INTO services(tenant_id,project_id,name,owner,repository,environment) VALUES($1,$2,'Hệ thống thứ hai','Đội thử','demo/second','Môi trường thử')`,[ids.tenant,ids.sales]);
    const t=await file({projectId:ids.transport,assigneeId:null});
    const s=await file({assigneeId:null},pm);
    const out=await attempt(()=>svc().decideMany(bomA,{requestIds:[t.id,s.id],services:[],note:NOTE,assigneeId:tech.id},k()));
    expect(out).toMatchObject({ok:true,value:{results:[{id:t.id,ok:true},{id:s.id,ok:false,code:'SERVICE_REQUIRED'}]}});
  });
  test('M7 the list is capped and identity never comes from the body',async()=>{
    expect(await attempt(()=>svc().decideMany(bomA,{requestIds:Array.from({length:201},()=>randomUUID()),services:[],note:NOTE},k()))).toMatchObject({ok:false});
    expect(await attempt(()=>svc().decideMany(bomA,{requestIds:[randomUUID()],services:[],note:NOTE,decidedBy:pm.id},k()))).toMatchObject({ok:false});
    expect(await attempt(()=>svc().decideMany(bomA,{services:[],note:NOTE},k()))).toMatchObject({ok:false});
  });
});

describe('M10 · every refusal says what to do next',()=>{
  test('M10 filing, deciding and the role rule tell the user what to do; none waits for the Chairman',async()=>{
    const messages:string[]=[];
    const keep=(o:Outcome<unknown>)=>{expect(o.ok).toBe(false);messages.push((o as {message:string}).message);};
    keep(await attempt(()=>svc().submit(member,input())));                          // WORK_REQUEST_DENIED
    const own=await file({},pm);
    keep(await approve(pm,own.id));                                                   // SELF_APPROVAL
    const r=await file();
    keep(await approve(pm,r.id,{assigneeId:null}));                                   // ASSIGNEE_REQUIRED
    keep(await approve(pm,r.id,{assigneeId:offRoster.id}));                           // INVALID_ASSIGNMENT
    keep(await approve(pm,r.id,{assigneeId:member.id,technicalId:member.id}));        // SELF_ACCEPTANCE
    keep(await approve(pm,r.id,{serviceId:null}));                                    // SERVICE_REQUIRED
    for(const m of messages) expect(m,m).toMatch(/Nhờ|Chọn|chọn|Tải lại|BoM Tech|người quản trị/);
    // no copy anywhere in the server or the screens still tells the user to wait for the Chairman
    const sources:string[]=[];
    for(const d of ['src/server','src/components','src/app/work-requests','src/app/work-import'])
      for(const f of await readdir(path.join(process.cwd(),d))) if(/\.(ts|tsx)$/.test(f)) sources.push(await readFile(path.join(process.cwd(),d,f),'utf8'));
    for(const s of sources) expect(s).not.toMatch(/chờ Chairman/i);
  });
});

describe('IBS HI · M2 and M5 in an IBS HI project',()=>{
  test('IBS HI M5: a BoM Tech approves; a person off the roster sees nothing and an error names no project',async()=>{
    const r=await file({projectId:ibs.project});
    expect((await attempt(()=>svc().list(offRoster,{}))) ).toMatchObject({ok:true,value:{items:[],total:0}});
    const denied=await approve(offRoster,r.id,{serviceId:ibs.service,assigneeId:tech.id});
    expect(denied).toMatchObject({ok:false,code:'NOT_FOUND'});
    expect((denied as {message:string}).message).not.toMatch(/IBS|Dự án thử/);
    expect(await approve(bomA,r.id,{serviceId:ibs.service,assigneeId:tech.id})).toMatchObject({ok:true,value:{work:{project_id:ibs.project,assignee_id:tech.id}}});
  });
  test('IBS HI M2: the roster performer gets a traced grant and does the performer step; a person off the roster is not a performer and the refusal names no project',async()=>{
    const r=await file({projectId:ibs.project});
    const refused=await approve(bomA,r.id,{serviceId:ibs.service,assigneeId:offRoster.id});
    expect(refused).toMatchObject({ok:false,code:'INVALID_ASSIGNMENT'});
    expect((refused as {message:string}).message).not.toMatch(/IBS|Dự án thử/);
    const done=await approve(bomA,r.id,{serviceId:ibs.service,assigneeId:tech.id});
    const w=(done as {value:{work:{id:string;version:number}}}).value.work;
    expect(await grants(w.id)).toEqual([{user_id:tech.id,granted_by:bomA.id,source_kind:'work_request',source_id:r.id,project_id:ibs.project}]);
    const me=((await sessionOf(tech.id)) as {value:Principal}).value;
    expect(me.projectIds).toContain(ibs.project);
    expect(await transition(me,w.id,w.version,'doing')).toMatchObject({ok:true,value:{work:{state:'doing'}}});
    // the person off the roster still holds nothing in the IBS HI project
    const other=((await sessionOf(offRoster.id)) as {value:Principal}).value;
    expect(other.projectIds).not.toContain(ibs.project);
  });
});

// After the two sweeps and the automated review (before the Codex gate): the scope a BoM Tech reads, who may be granted, which grants count, and replays.
describe('Sau soát · phạm vi, quyền cấp và chạy lại',()=>{
  const count=(who:Principal,table:string)=>requestScope(h.db,who,async tx=>(await tx.query<{n:number}>(`SELECT count(*)::int n FROM ${table}`)).rows[0].n);
  test('F6 a BoM Tech reads no work, service or audit row of a project outside their memberships, before or after deciding there',async()=>{
    for(const t of ['work_items','services','audit_events','bom_scopes']) expect(await count(bomA,t),t).toBe(0);
    const r=await file({projectId:ids.transport});
    expect(await approve(bomA,r.id,{serviceId:ids.transportService,assigneeId:tech.id})).toMatchObject({ok:true});
    for(const t of ['work_items','services','audit_events','bom_scopes']) expect(await count(bomA,t),t).toBe(0);
    // the request they decided stays readable to them
    expect((await svc().list(bomA,{})).items.map(i=>i.id)).toContain(r.id);
  });
  test('F6 the decision screen of a BoM Tech holds only the projects of the requests waiting for them',async()=>{
    expect(await svc().context(bomA)).toMatchObject({projectIds:[],services:[],seats:{}});
    await file({projectId:ids.transport});
    const ctx=await svc().context(bomA);
    expect(ctx.projectIds).toEqual([ids.transport]);
    expect(ctx.services.map(s=>s.project_id)).toEqual(expect.arrayContaining([ids.transport]));
    expect(ctx.services.every(s=>s.project_id===ids.transport)).toBe(true);
    expect(ctx.seats).toEqual({});
  });
  test('F6 being a BoM Tech does not let a person link a message to work in a project outside their memberships',async()=>{
    const linked=await requestScope(h.db,bomA,async tx=>(await tx.query<{ok:boolean}>('SELECT public.intake_link_allowed($1) AS ok',[ids.transport])).rows[0].ok);
    expect(linked).toBe(false);
    // a seat of the project still links there
    expect(await requestScope(h.db,reviewer,async tx=>(await tx.query<{ok:boolean}>('SELECT public.intake_link_allowed($1) AS ok',[ids.sales])).rows[0].ok)).toBe(true);
  });
  test('SELF_GRANT a BoM Tech with no membership does not take the work they approve; they give it to another member of Team Tech',async()=>{
    const r=await file({projectId:ids.transport});
    const refused=await approve(bomA,r.id,{serviceId:ids.transportService,assigneeId:bomA.id});
    expect(refused).toMatchObject({ok:false,code:'SELF_GRANT',status:403});
    expect((refused as {message:string}).message).toMatch(/Nhờ/);
    expect((refused as {message:string}).message).not.toMatch(/Vận tải|IBS/);
    expect((await rows('SELECT state FROM work_requests WHERE id=$1',[r.id]))[0]).toEqual({state:'pending'});
    expect(await rows('SELECT 1 FROM work_access_grants')).toEqual([]);
    const given=await approve(bomA,r.id,{serviceId:ids.transportService,assigneeId:bomB.id});
    expect(given).toMatchObject({ok:true,value:{work:{assignee_id:bomB.id}}});
    const w=(given as {value:{work:{id:string}}}).value.work;
    expect(await grants(w.id)).toEqual([{user_id:bomB.id,granted_by:bomA.id,source_kind:'work_request',source_id:r.id,project_id:ids.transport}]);
  });
  test('SELF_GRANT the database refuses a grant to its own granter, even in the transaction of a decision',async()=>{
    const r=await file({projectId:ids.transport});
    const forged=await attempt(()=>h.db.transaction(async tx=>{
      await tx.query('SET LOCAL ROLE libetech_runtime');
      await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true),set_config('app.person_id',$3,true)",[ids.tenant,ids.transport,bomA.id]);
      const w=(await tx.query<{id:string}>(`INSERT INTO work_items(tenant_id,project_id,service_id,code,title,priority,assignee_id,criteria) VALUES($1,$2,$3,'GV7-SELF','Việc tự cấp thử','normal',$4,'') RETURNING id`,
        [ids.tenant,ids.transport,ids.transportService,bomA.id])).rows[0];
      await tx.query(`INSERT INTO audit_events(tenant_id,project_id,work_id,actor_id,kind,payload) VALUES($1,$2,$3,$4,'created',$5)`,[ids.tenant,ids.transport,w.id,bomA.id,JSON.stringify({requestId:r.id})]);
      await tx.query(`UPDATE work_requests SET state='approved',decided_by=$1,decider_name='BoM Tech thử A',decided_at=now(),decision_note='Tự duyệt thử.',work_id=$2,version=version+1 WHERE id=$3`,[bomA.id,w.id,r.id]);
      await tx.query(`INSERT INTO work_access_grants(tenant_id,project_id,work_id,user_id,source_kind,source_id,granted_by) VALUES($1,$2,$3,$4,'work_request',$5,$4)`,[ids.tenant,ids.transport,w.id,bomA.id,r.id]);
    }));
    expect(forged).toMatchObject({ok:false});
    expect((forged as {message:string}).message).toMatch(/themselves/);
    expect(await rows('SELECT 1 FROM work_access_grants')).toEqual([]);
  });
  test('grant a grant is written only in the transaction of the decision that gave the work',async()=>{
    const r=await file({projectId:ids.transport});
    const done=await approve(bomA,r.id,{serviceId:ids.transportService,assigneeId:bomB.id});
    const w=(done as {value:{work:{id:string}}}).value.work;
    // a later transaction of the same decider, naming the same decision: the guard refuses it before the unique key is reached (PGlite's clock is whole milliseconds)
    await new Promise(resolve=>setTimeout(resolve,5));
    const late=await attempt(()=>h.db.transaction(async tx=>{
      await tx.query('SET LOCAL ROLE libetech_runtime');
      await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true),set_config('app.person_id',$3,true)",[ids.tenant,ids.transport,bomA.id]);
      await tx.query(`INSERT INTO work_access_grants(tenant_id,project_id,work_id,user_id,source_kind,source_id,granted_by) VALUES($1,$2,$3,$4,'work_request',$5,$6)`,[ids.tenant,ids.transport,w.id,bomB.id,r.id,bomA.id]);
    }));
    expect(late).toMatchObject({ok:false});
    expect((late as {message:string}).message).toMatch(/points at the decision/);
    expect(await grants(w.id)).toHaveLength(1);
  });
  test('revise a coordinator makes a roster member with no membership the assignee of a new revision: the grant is written and traced',async()=>{
    // a project outside BoM control (the 3/3 ballot would own the assignee otherwise): sales with its scope switched off, and its two demo acceptors
    await h.operator.query('UPDATE bom_scopes SET enabled=false WHERE project_id=$1',[ids.sales]);
    const before=(await rows<{version:number}>('SELECT version FROM work_items WHERE id=$1',[ids.pilot]))[0];
    const revised=await attempt(()=>work().command(pm,ids.pilot,{kind:'revise',expectedVersion:before.version,sourceSha:SHA,criteria:'Đạt khi có biên bản kiểm thử.',
      specUrl:'https://example.com/spec/gv7-revise',dueAt:null,assigneeId:rosterNoGrant,technicalId:demoProfiles.technical.id,businessId:demoProfiles.business.id,note:'Giao lại cho thành viên Team Tech.'},k()));
    expect(revised).toMatchObject({ok:true,value:{work:{assignee_id:rosterNoGrant}}});
    const audit=(await rows<{id:string}>("SELECT id FROM audit_events WHERE work_id=$1 AND kind='revise'",[ids.pilot]))[0];
    expect(await grants(ids.pilot)).toEqual([{user_id:rosterNoGrant,granted_by:pm.id,source_kind:'revise',source_id:audit?.id,project_id:ids.sales}]);
    const me=await sessionOf(rosterNoGrant);
    expect((me as {value:Principal}).value.projectIds).toEqual([ids.sales]);
  });
  test('live a grant counts at sign-in only while its member holds the work: the 3/3 ballot moving the work away takes the project away',async()=>{
    const r=await file();
    const done=await approve(pm,r.id,{assigneeId:tech.id});
    const w=(done as {value:{work:{id:string;version:number}}}).value.work;
    expect(((await sessionOf(tech.id)) as {value:Principal}).value.projectIds).toEqual(expect.arrayContaining([ids.transport,ids.sales]));
    const bom=new BomService(h.db);
    const part={owner_id:tech.id,output:'Phần kiểm thử',criteria:'Có biên bản kiểm thử.',dueAt:null,dependency:''};
    // a part owner of the applied receipt still holds the work
    const kept=await attempt(()=>bom.command(pm,{action:'propose',workId:w.id,expectedVersion:w.version,allocation:{lead_id:member.id,parts:[part]},reason:'Chia phần cho thành viên Team Tech.'},k()));
    const keptId=(kept as {value:{proposal:{id:string}}}).value.proposal.id;
    for(const seat of [pm,reviewer,approver]) expect(await attempt(()=>bom.command(seat,{action:'vote',proposalId:keptId,choice:'agree',note:'Đồng ý chia phần.'},k())),seat.name).toMatchObject({ok:true});
    expect((await rows('SELECT assignee_id FROM work_items WHERE id=$1',[w.id]))[0]).toEqual({assignee_id:member.id});
    expect(((await sessionOf(tech.id)) as {value:Principal}).value.projectIds).toContain(ids.sales);
    // the next ballot gives the work to the member alone: the grant stays as history and no longer opens the project
    const v=(await rows<{version:number}>('SELECT version FROM work_items WHERE id=$1',[w.id]))[0].version;
    const moved=await attempt(()=>bom.command(pm,{action:'propose',workId:w.id,expectedVersion:v,allocation:{lead_id:member.id,parts:[]},reason:'Thu lại phần đã chia.'},k()));
    const movedId=(moved as {value:{proposal:{id:string}}}).value.proposal.id;
    for(const seat of [pm,reviewer,approver]) expect(await attempt(()=>bom.command(seat,{action:'vote',proposalId:movedId,choice:'agree',note:'Đồng ý thu lại.'},k())),seat.name).toMatchObject({ok:true});
    expect(await grants(w.id)).not.toHaveLength(0);
    const after=((await sessionOf(tech.id)) as {value:Principal}).value;
    expect(after.projectIds).toEqual([ids.transport]);
  });
  test('M4 a source row is a request row only by its literal prefix: an operator source whose name merely looks alike is the operator\'s',async()=>{
    expect(await attempt(()=>rows("INSERT INTO bom_sources(work_id,tenant_id,project_id,source_ref,fingerprint,checked_at,valid_until) VALUES($1,$2,$3,'workXrequest:made-up',$4,now(),now()+interval '1 day')",
      [ids.pilot,ids.tenant,ids.sales,'d'.repeat(64)]))).toMatchObject({ok:true});
    expect(await attempt(()=>rows("UPDATE bom_sources SET checked_at=now() WHERE work_id=$1",[ids.pilot]))).toMatchObject({ok:true});
    expect(await attempt(()=>rows('DELETE FROM bom_sources WHERE work_id=$1',[ids.pilot]))).toMatchObject({ok:true});
  });
  test('M4 a login holding the runtime privileges without SET ROLE writes no other source row either',async()=>{
    const role='gv7_inherits_'+randomUUID().slice(0,8).replace(/-/g,'');
    let message='';
    await h.operator.transaction(async tx=>{
      await tx.query(`CREATE ROLE ${role} NOLOGIN INHERIT`);
      await tx.query(`GRANT libetech_runtime TO ${role}`);
      await tx.query(`SET LOCAL ROLE ${role}`);
      await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true)",[ids.tenant,ids.sales]);
      await tx.query('SAVEPOINT probe');
      try {
        await tx.query("INSERT INTO bom_sources(work_id,tenant_id,project_id,source_ref,fingerprint,checked_at,valid_until) VALUES($1,$2,$3,'importer:made-up',$4,now(),'infinity')",[ids.pilot,ids.tenant,ids.sales,'d'.repeat(64)]);
        message='written';
      } catch(e) { message=(e as Error).message; await tx.query('ROLLBACK TO SAVEPOINT probe'); }
      throw new Error('rollback-sentinel');
    }).catch(e=>{ if(!/rollback-sentinel/.test(String(e))) throw e; });
    expect(message).toMatch(/runtime writes only/);
    expect(await rows('SELECT 1 FROM bom_sources WHERE work_id=$1',[ids.pilot])).toEqual([]);
  });
  test('M7 the same bulk call again gets the stored answers even when the services of the project changed in between',async()=>{
    const a=await file({assigneeId:member.id},pm);
    const body={requestIds:[a.id],services:[],note:NOTE};
    const key=k();
    expect(await attempt(()=>svc().decideMany(reviewer,body,key))).toMatchObject({ok:true,value:{results:[{id:a.id,ok:true}]}});
    await h.operator.query(`INSERT INTO services(tenant_id,project_id,name,owner,repository,environment) VALUES($1,$2,'Hệ thống thứ hai','Đội thử','demo/second','Môi trường thử')`,[ids.tenant,ids.sales]);
    expect(await attempt(()=>svc().decideMany(reviewer,body,key))).toMatchObject({ok:true,value:{results:[{id:a.id,ok:true}]}});
  });
});
