// GIAO VIỆC 5 D: the bridge tells the plugin WHY it refused (an added `reason`; code and status unchanged), so the bot can say the true cause.
import {afterEach,beforeEach,expect,test} from 'vitest';
import {createHmac,randomUUID} from 'node:crypto';
import {embeddedDatabase,type Database} from '../src/server/db';
import {IdentityService,secret} from '../src/server/identity';
import {handleBridge,signingText} from '../src/server/bridge';
import {failure} from '../src/server/http';
import {AppError} from '../src/server/errors';
import {seed,demoSha} from '../src/server/seed';
import {ids,demoProfiles} from '../src/server/identities';

let db:Database,auth:IdentityService;
const key=secret();
const member={id:demoProfiles.manager.id,telegram:'111'};
const offProject={id:'14000000-0000-4000-8000-0000000000d1',telegram:'222'};
const ibsOnly={id:'14000000-0000-4000-8000-0000000000d2',telegram:'333'};
const ibsProject='11000000-0000-4000-8000-0000000000d3';
const projectNames=['Cổng bán hàng mẫu','Điều phối vận tải mẫu','Dự án IBS thử'];

async function user(id:string,name:string,telegram:string,projects:string[],roster=false){
 await db.query('INSERT INTO identity.users(id,tenant_id,username,name,role) VALUES($1,$2,$3,$4,$5)',[id,ids.tenant,name,name,'viewer']);
 for(const project of projects) await db.query('INSERT INTO identity.memberships(tenant_id,user_id,project_id) VALUES($1,$2,$3)',[ids.tenant,id,project]);
 if(roster) await db.query('INSERT INTO identity.tech_roster(tenant_id,user_id) VALUES($1,$2)',[ids.tenant,id]);
 await db.query('INSERT INTO identity.telegram_links(tenant_id,user_id,telegram_id) VALUES($1,$2,$3)',[ids.tenant,id,telegram]);
}
beforeEach(async()=>{
 process.env.LIBETECH_DEMO='1';db=await embeddedDatabase();await seed(db);auth=new IdentityService(db,ids.tenant);
 await db.query("INSERT INTO projects(id,tenant_id,name,bu) VALUES($1,$2,$3,'IBS HI')",[ibsProject,ids.tenant,'Dự án IBS thử']);
 await user(member.id,'tester',member.telegram,[ids.sales]);
 await user(offProject.id,'techsolo',offProject.telegram,[],true);
 await user(ibsOnly.id,'ibsonly',ibsOnly.telegram,[ibsProject]);
 await db.query(`INSERT INTO analytics.reconciliations(tenant_id,project_id,code,source_id,source_type,ingested_at,quality_score,source_sha,snapshot_hash,result)
  VALUES($1,$2,'LBRC-TEST-014','https://github.com/example/test','github',now(),1,$3,$4,$5)`,[ids.tenant,ids.sales,demoSha,'a'.repeat(64),{checks:0,accepted:false,note:'dữ liệu Liberico thử'}]);
});
afterEach(async()=>{await db.close();});

const scopes={'-1001':[ids.sales],'-1003':[] as string[]};
function call(telegramId:string,chatId:string,chatType:string,sourceSha=demoSha){
 const raw=JSON.stringify({operation:'reconciliation',code:'LBRC-TEST-014',sourceSha,context:{telegramId,chatId,chatType,profile:'libetech',messageId:'1'}});
 const timestamp=String(Date.now()),nonce=secret();
 return handleBridge(new Request('http://127.0.0.1/api/bridge',{method:'POST',headers:{'x-libetech-timestamp':timestamp,'x-libetech-nonce':nonce,
  'x-libetech-signature':createHmac('sha256',key).update(signingText(timestamp,nonce,raw)).digest('hex')},body:raw}),db,auth,key,scopes);
}
const refusal=(promise:Promise<unknown>)=>promise.then(()=>({code:'NO_REFUSAL',status:200,reason:undefined as string|undefined,message:''}),
 (error:AppError&{reason?:string})=>({code:error.code,status:error.status,reason:error.reason,message:error.message}));

test('the bridge names which of the causes behind SCOPE_DENIED happened',async()=>{
 const group='supergroup';
 expect(await refusal(call(member.telegram,'-1002',group))).toMatchObject({code:'SCOPE_DENIED',status:403,reason:'CHAT_NOT_MAPPED'});
 expect(await refusal(call(member.telegram,'-1003',group))).toMatchObject({code:'SCOPE_DENIED',status:403,reason:'CHAT_NOT_MAPPED'});
 expect(await refusal(call(ibsOnly.telegram,'-1001',group))).toMatchObject({code:'SCOPE_DENIED',status:403,reason:'NOT_PROJECT_MEMBER'});
 expect(await refusal(call(offProject.telegram,offProject.telegram,'private'))).toMatchObject({code:'SCOPE_DENIED',status:403,reason:'NO_PROJECT_YET'});
 expect(await refusal(call(member.telegram,'999','private'))).toMatchObject({code:'SCOPE_DENIED',status:403,reason:'CHAT_SOURCE_INVALID'});
 expect(await refusal(call(member.telegram,'-1001',group,'b'.repeat(40)))).toMatchObject({code:'SCOPE_DENIED',status:404,reason:'RECORD_NOT_FOUND'});
 // the same request that succeeds stays as it was
 await expect(call(member.telegram,'-1001',group)).resolves.toMatchObject({readOnly:true});
});

test('the HTTP error body carries `reason` only when the refusal has one',async()=>{
 const withReason=await failure(new AppError('SCOPE_DENIED','Không có quyền.',403,'CHAT_NOT_MAPPED'),randomUUID()).json();
 expect(withReason.error).toEqual({code:'SCOPE_DENIED',message:'Không có quyền.',reason:'CHAT_NOT_MAPPED'});
 const without=await failure(new AppError('TELEGRAM_NOT_LINKED','Cần ghép.',403),randomUUID()).json();
 expect(without.error).toEqual({code:'TELEGRAM_NOT_LINKED',message:'Cần ghép.'});
});

test('IBS HI: an IBS-only person asking in a Liberico group is told nothing about any project',async()=>{
 const refused=await refusal(call(ibsOnly.telegram,'-1001','supergroup'));
 expect(refused.reason).toBe('NOT_PROJECT_MEMBER');
 const wire=await (await failure(new AppError(refused.code,refused.message,refused.status,refused.reason),randomUUID())).text();
 for(const secretText of [...projectNames,'LBRC-TEST-014','dữ liệu Liberico thử',ids.sales,ibsProject,'IBS','LBRC','Liberico','Xeca'])
  expect(wire.toLowerCase()).not.toContain(secretText.toLowerCase());
});
