import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { createHmac,randomUUID } from 'node:crypto';
import { secret } from '../src/server/identity';
import { pooledDatabase } from '../src/server/db';
import { signingText } from '../src/server/bridge';
import { projectEvidence } from '../src/server/evidence-projector';
import { ids } from '../src/server/identities';
import { scoreFixture } from '../tests/spec003-fixtures';
import { lbrc014Report } from './lbrc014-report';

const base='http://127.0.0.1:3348';
const config=JSON.parse(await readFile('.runtime/spec003-test.json','utf8'));
const operatorUrl=new URL(config.operatorUrl);
assert.equal(operatorUrl.host,'127.0.0.1:35447');
assert.equal(operatorUrl.pathname,'/spec003_verify');
const projectId=lbrc014Report.projectId;
const password=secret();
const checks:string[]=[];
async function call(path:string,options:{cookie?:string;input?:unknown;status?:number;origin?:string}={}){
  const headers:Record<string,string>={};
  if(options.cookie)headers.cookie=options.cookie;
  if(options.input!==undefined){
    headers.origin=options.origin??base;
    headers['Content-Type']='application/json';
  }
  const result=await fetch(base+path,{headers,method:options.input!==undefined?'POST':'GET',
    body:options.input!==undefined?JSON.stringify(options.input):undefined,redirect:'manual'});
  assert.equal(result.status,options.status??200,path);
  return {data:(await result.json()).data,cookie:result.headers.get('set-cookie')?.split(';')[0]??''};
}
const health=await call('/api/health');
assert(health.data.schema.includes('005'));
assert.equal(health.data.storage,'postgresql-server');
await call('/api/auth/me',{status:401});
const html=await fetch(base+'/login');
assert.match(await html.text(),/Tên đăng nhập/);
const csp=html.headers.get('content-security-policy')??'';
assert.match(csp,/script-src[^;]*nonce-/);
const admin=await call('/api/auth/login',{input:{username:'spec003-operator',password:config.password}});
const suffix=randomUUID().slice(0,7);
async function invite(name:string,id:string) {
  return (await call('/api/team/accounts',{cookie:admin.cookie,input:{kind:'invite',username:name+'-'+suffix,name,
    reason:'Kiểm thử cô lập SPEC-003',grants:[{projectId:id,role:'viewer',reportPermissions:[]}]}})).data;
}
const invitation=await invite('spec003-member',projectId);
const outsider=await invite('spec003-outsider',ids.transport);
await call('/api/auth/activate',{input:{token:invitation.invitation.token,password},origin:'https://invalid.example',status:403});
const member=await call('/api/auth/activate',{input:{token:invitation.invitation.token,password}});
await call('/api/auth/activate',{input:{token:invitation.invitation.token,password},status:403});
const other=await call('/api/auth/activate',{input:{token:outsider.invitation.token,password}});
assert.deepEqual(member.data.principal.projectIds,[projectId]);
assert.deepEqual(other.data.principal.projectIds,[ids.transport]);
const signedIn=await call('/api/auth/login',{input:{username:'spec003-member-'+suffix,password}});
assert.equal(signedIn.data.principal.id,member.data.principal.id);
await call('/api/team/accounts',{cookie:member.cookie,status:403});
checks.push('A01 isolated portal activation/login and A02 single-use/CSRF/admin isolation');

const telegramId='7500'+String(Date.now()).slice(-9);
const pairCode=(await call('/api/auth/telegram-code',{cookie:member.cookie,input:{}})).data.code;
const context={telegramId,chatId:telegramId,chatType:'private',profile:'libetech',messageId:'77'};
async function bridge(payload:unknown,status=200) {
  const raw=JSON.stringify(payload),time=String(Date.now()),nonce=secret();
  const result=await fetch(base+'/api/bridge',{method:'POST',body:raw,headers:{
    'x-libetech-timestamp':time,'x-libetech-nonce':nonce,
    'x-libetech-signature':createHmac('sha256',config.key).update(signingText(time,nonce,raw)).digest('hex'),
  }});
  assert.equal(result.status,status,'bridge');
  return (await result.json()).data;
}
await bridge({operation:'pair',context:{...context,chatType:'group',chatId:'-5298399184'},code:pairCode},403);
assert.equal((await bridge({operation:'pair',context,code:pairCode})).linked,true);
await bridge({operation:'pair',context,code:pairCode},403);
assert.equal((await call('/api/auth/me',{cookie:member.cookie})).data.telegram.linked,true);
const recon={operation:'reconciliation',context:{...context,chatType:'group',chatId:'-5298399184'},
  code:'LBRC014',sourceSha:lbrc014Report.works[0].sourceSha};
assert.equal((await bridge(recon)).record.source_sha,recon.sourceSha);
await bridge({...recon,context:{...recon.context,chatId:'-1002308580311'}},403);
checks.push('A01 signed private Telegram pairing, replay and group denial; exact SHA read and Xeca denial');

const lbrcPath='/api/team/reports?projectId='+projectId+'&runId='+config.runId;
const caseReport=(await call(lbrcPath,{cookie:member.cookie})).data;
assert.equal(caseReport.project.works[0].code,'LBRC014');
assert.equal(caseReport.project.works[0].sourceStatus,'Hoàn thành');
assert.equal(caseReport.project.works[0].business,'pending');
assert.equal(caseReport.project.works[0].facts.length,6);
assert.equal(caseReport.person,null);
await call(lbrcPath,{cookie:other.cookie,status:403});
await call(lbrcPath+'&subjectId='+config.adminId,{cookie:member.cookie,status:403});
const page=await fetch(base+'/reports',{headers:{cookie:member.cookie}});
assert.match(await page.text(),/Dashboard LibeTech/);
assert.match(page.headers.get('content-security-policy')??'',/script-src[^;]*nonce-/);
checks.push('A03/E03 authorized LBRC014 drill-down and insufficient personnel evidence; cross-project/private person denied');

const db=pooledDatabase(config.operatorUrl);
try {
  const fixture=scoreFixture(lbrc014Report.tenantId,projectId,member.data.principal,config.adminId);
  const result=await projectEvidence(db,fixture,{allowSynthetic:true});
  assert.equal((await projectEvidence(db,fixture,{allowSynthetic:true})).runId,result.runId);
  const scorePath='/api/team/reports?projectId='+projectId+'&runId='+result.runId;
  const scored=(await call(scorePath,{cookie:member.cookie})).data;
  assert.equal(scored.person.result.total,54.17);
  assert(scored.project.contributions.some((item:{evidenceId:string})=>item.evidenceId==='reply-0'));
  assert(scored.person.result.evidence.some((item:{id:string})=>item.id==='reply-0'));
  await call(scorePath,{cookie:other.cookie,status:403});
  const action={projectId,runId:result.runId,subjectId:member.data.principal.id,requestKey:randomUUID(),reason:'Rà lại căn cứ thử nghiệm'};
  await call('/api/team/reports',{cookie:member.cookie,input:{...action,kind:'correction'},status:201});
  assert.equal((await call('/api/team/reports',{cookie:member.cookie,input:{...action,kind:'correction'},status:201})).data.replayed,true);
  await call('/api/team/reports',{cookie:admin.cookie,input:{...action,kind:'approval',requestKey:randomUUID()},status:422});
  await call('/api/team/reports',{cookie:admin.cookie,input:{...action,kind:'quality_review',requestKey:randomUUID(),
    evidenceId:'reply-0',criteria:[true,true,false]},status:201});
  fixture.period.asOf=new Date(Math.max(Date.now(),Date.parse(fixture.period.asOf))+1000).toISOString();
  const refreshed=await projectEvidence(db,fixture,{allowSynthetic:true,reviewRunId:result.runId});
  const changed=(await call('/api/team/reports?projectId='+projectId+'&runId='+refreshed.runId,{cookie:member.cookie})).data;
  assert.equal(changed.person.result.total,50);
  assert.equal((await call(scorePath,{cookie:member.cookie})).data.person.result.total,54.17);
  checks.push('E01/E02 deduplication, reproducible 54.17, shared evidence, audited review and immutable older calculation');
  await db.transaction(async tx=>{
    await tx.query('SET LOCAL ROLE libetech_runtime');
    await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true),set_config('app.person_id',$3,true)",
      [lbrc014Report.tenantId,projectId,other.data.principal.id]);
    assert.equal((await tx.query('SELECT user_id FROM analytics.evidence_people')).rows.length,0);
  });
  assert.equal((await db.query('SELECT id FROM work_items')).rows.length,0);
} finally {await db.close();}
await call('/api/team/accounts',{cookie:admin.cookie,input:{kind:'disable',userId:invitation.user.id,
  expectedVersion:invitation.user.version,reason:'Kiểm thử thu hồi web và bot'}});
await call('/api/auth/me',{cookie:member.cookie,status:401});
await bridge(recon,401);
checks.push('A02 revocation denies web and previously paired bridge');
if(process.env.SPEC003_BROWSER_TEST==='1'){
  const browserUser=(await call('/api/team/accounts',{cookie:admin.cookie,input:{kind:'invite',
    username:'spec003-browser',name:'Thành viên xem thử',reason:'Kiểm thử giao diện trên loopback',
    grants:[{projectId,role:'viewer',reportPermissions:[]}]}})).data;
  const browserSession=await call('/api/auth/activate',{input:{
    token:browserUser.invitation.token,password:'SPEC003 browser fixture only!'
  }});
  const browserDb=pooledDatabase(config.operatorUrl);
  try {await projectEvidence(browserDb,scoreFixture(lbrc014Report.tenantId,projectId,
    browserSession.data.principal,config.adminId),{allowSynthetic:true});}
  finally {await browserDb.close();}
}
const receipt={observedAt:new Date().toISOString(),storage:'isolated PostgreSQL 16',
  appVersion:health.data.version,migrations:health.data.schema,checks,fixtureTotal:54.17,lbrc014:{sourceStatus:'Hoàn thành',
    business:'pending',sourceSha:recon.sourceSha,evidence:6,officialPersonalScore:null},testEnvironmentOnly:true};
await writeFile('.runtime/spec003-native-receipt.json',JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify(receipt,null,2));
