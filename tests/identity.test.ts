import {beforeEach,afterEach,test,expect} from 'vitest';
import {createHmac,randomUUID} from 'node:crypto';
import pilotScope from '../deploy/pilot-scope.json';
import {embeddedDatabase,scoped,type Database} from '../src/server/db';
import {IdentityService,digest,secret,passwordHash} from '../src/server/identity';
import {handleBridge,signingText} from '../src/server/bridge';
import {seed,demoSha} from '../src/server/seed';
import {ids,demoProfiles} from '../src/server/identities';
import {checkOrigin,createSession} from '../src/server/auth';
import {handleAuth} from '../src/server/auth-http';
let db:Database,auth:IdentityService,invite:string;
const user=demoProfiles.manager.id,password='Test-only passphrase 2026!',telegram='123456789',key=secret();
beforeEach(async()=>{
 process.env.LIBETECH_DEMO='1';db=await embeddedDatabase();await seed(db);auth=new IdentityService(db,ids.tenant);invite=secret();
 await db.query('INSERT INTO identity.users(id,tenant_id,username,name,role) VALUES($1,$2,$3,$4,$5)',[user,ids.tenant,'tester','Test user','manager']);
 await db.query('INSERT INTO identity.memberships(tenant_id,user_id,project_id) VALUES($1,$2,$3)',[ids.tenant,user,ids.sales]);
 await db.query("INSERT INTO identity.invitations(tenant_id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[ids.tenant,user,digest(invite)]);
});
afterEach(async()=>{await db.close();});
const activate=()=>auth.activate({token:invite,password});
async function paired(){const s=await activate();const {code}=await auth.pairingCode(s.principal);await auth.pair(code,telegram,telegram,'private');return s;}
function signed(payload:unknown,options:{nonce?:string;timestamp?:string;key?:string}={}){
 const raw=JSON.stringify(payload),timestamp=options.timestamp??String(Date.now()),nonce=options.nonce??secret();
 return new Request('http://127.0.0.1/api/bridge',{method:'POST',headers:{'x-libetech-timestamp':timestamp,'x-libetech-nonce':nonce,'x-libetech-signature':createHmac('sha256',options.key??key).update(signingText(timestamp,nonce,raw)).digest('hex')},body:raw});
}
const context={telegramId:telegram,chatId:'-1001',chatType:'supergroup',profile:'libetech',messageId:'1'};
test('invitation activates once, password is Argon2id, session survives a new service instance',async()=>{
 const s=await activate();expect(s.principal.projectIds).toEqual([ids.sales]);
 const stored=(await db.query<{password_hash:string}>('SELECT password_hash FROM identity.users')).rows[0].password_hash;
 expect(stored).toMatch(/^\$argon2id\$/);expect(stored).not.toContain(password);
 await expect(auth.activate({token:invite,password})).rejects.toMatchObject({code:'INVITATION_INVALID'});
 expect((await new IdentityService(db,ids.tenant).session(s.token)).id).toBe(user);
 expect((await auth.login({username:'TESTER',password})).principal.id).toBe(user);
 expect((await db.query<{token_hash:string}>('SELECT token_hash FROM identity.sessions')).rows.every(r=>r.token_hash!==s.token)).toBe(true);
});
test('unknown/wrong passwords fail generically and account rate limit persists',async()=>{
 await activate();for(const username of ['tester','missing']) await expect(auth.login({username,password:'wrong'})).rejects.toMatchObject({code:'LOGIN_FAILED'});
 for(let i=0;i<7;i++) await expect(auth.login({username:'tester',password:'wrong'})).rejects.toMatchObject({code:'LOGIN_FAILED'});
 await expect(new IdentityService(db,ids.tenant).login({username:'tester',password})).rejects.toMatchObject({code:'RATE_LIMITED'});
});
test('logout, expiration and disable revoke sessions',async()=>{
 let s=await activate();await auth.logout(s.token);await expect(auth.session(s.token)).rejects.toMatchObject({code:'UNAUTHENTICATED'});
 s=await auth.login({username:'tester',password});await db.query("UPDATE identity.sessions SET expires_at=now()-interval '1 second'");await expect(auth.session(s.token)).rejects.toMatchObject({code:'UNAUTHENTICATED'});
 s=await auth.login({username:'tester',password});await db.query('UPDATE identity.users SET active=false');await expect(auth.session(s.token)).rejects.toMatchObject({code:'UNAUTHENTICATED'});await expect(auth.login({username:'tester',password})).rejects.toMatchObject({code:'LOGIN_FAILED'});
});
test('strict inputs reject role/tenant injection, expired invite and weak password',async()=>{
 await expect(auth.activate({token:invite,password,role:'manager'})).rejects.toThrow();await expect(auth.activate({token:invite,password:'short'})).rejects.toThrow();
 await db.query("UPDATE identity.invitations SET expires_at=now()-interval '1 second'");await expect(activate()).rejects.toMatchObject({code:'INVITATION_INVALID'});
 await expect(auth.login({username:'tester',password,tenantId:ids.otherTenant})).rejects.toThrow();
});
test('every identity table isolates tenant and business runtime has no identity access',async()=>{
 const s=await paired();const foreign=new IdentityService(db,ids.otherTenant);
 for(const table of ['users','memberships','invitations','sessions','throttle','telegram_codes','telegram_links','events','bridge_nonces']) {
  expect(await foreign.scope(async tx=>(await tx.query('SELECT * FROM identity.'+table)).rows)).toHaveLength(0);
  await expect(scoped(db,s.principal,tx=>tx.query('SELECT * FROM identity.'+table))).rejects.toThrow();
 }
 await expect(foreign.session(s.token)).rejects.toMatchObject({code:'UNAUTHENTICATED'});
 await expect(auth.scope(tx=>tx.query('SELECT * FROM work_items'))).rejects.toThrow();
});
test('Telegram pairing requires private proof; replay, expiry and replacing another identity fail',async()=>{
 const s=await activate();let {code}=await auth.pairingCode(s.principal);
 await expect(auth.pair(code,telegram,'-1001','supergroup')).rejects.toMatchObject({code:'PRIVATE_CHAT_REQUIRED'});
 await expect(auth.pair(code,telegram,'999','private')).rejects.toMatchObject({code:'PRIVATE_CHAT_REQUIRED'});
 await db.query("UPDATE identity.telegram_codes SET expires_at=now()-interval '1 second'");await expect(auth.pair(code,telegram,telegram,'private')).rejects.toMatchObject({code:'PAIRING_INVALID'});
 ({code}=await auth.pairingCode(s.principal));await auth.pair(code,telegram,telegram,'private');
 await expect(auth.pair(code,telegram,telegram,'private')).rejects.toMatchObject({code:'PAIRING_INVALID'});await expect(auth.pairingCode(s.principal)).rejects.toMatchObject({code:'ALREADY_LINKED'});
 expect(await auth.linkStatus(s.principal)).toMatchObject({linked:true,telegramId:telegram});
 await expect(auth.telegramPrincipal('999')).rejects.toMatchObject({code:'TELEGRAM_NOT_LINKED'});
});
test('bridge verifies signature, freshness and nonce then applies both user and chat project scope',async()=>{
 await paired();await db.query(`INSERT INTO analytics.reconciliations(tenant_id,project_id,code,source_id,source_type,ingested_at,quality_score,source_sha,snapshot_hash,result) VALUES($1,$2,'TEST-014','https://github.com/example/test','github',now(),1,$3,$4,$5)`,[ids.tenant,ids.sales,demoSha,'a'.repeat(64),{checks:0,accepted:false}]);
 const data={operation:'reconciliation',context,code:'TEST-014',sourceSha:demoSha};const scopes={'-1001':[ids.sales],'-1002':[ids.transport]};
 expect(await handleBridge(signed(data),db,auth,key,scopes)).toMatchObject({readOnly:true,acceptance:'not-inferred'});
 for(const req of [signed(data,{key:secret()}),signed(data,{timestamp:String(Date.now()-120000)})]) await expect(handleBridge(req,db,auth,key,scopes)).rejects.toMatchObject({code:'BRIDGE_AUTH_DENIED'});
 const nonce=secret();await handleBridge(signed(data,{nonce}),db,auth,key,scopes);await expect(handleBridge(signed(data,{nonce}),db,auth,key,scopes)).rejects.toMatchObject({code:'BRIDGE_REPLAY'});
 await expect(handleBridge(signed({...data,context:{...context,chatId:'-1002'}}),db,auth,key,scopes)).rejects.toMatchObject({code:'SCOPE_DENIED'});
 await expect(handleBridge(signed({...data,sourceSha:'b'.repeat(40)}),db,auth,key,scopes)).rejects.toMatchObject({code:'SCOPE_DENIED'});
 await expect(handleBridge(signed({...data,operation:'accept'}),db,auth,key,scopes)).rejects.toThrow();
 await expect(scoped(db,demoProfiles.customer,tx=>tx.query('SELECT * FROM analytics.reconciliations'))).resolves.toMatchObject({rows:[]});
 await expect(db.query('UPDATE analytics.reconciliations SET result=$1',[{}])).rejects.toThrow('Append-only');
});
test('server mode requires exact HTTPS origin and rejects demo identity',()=>{
 process.env.LIBETECH_DEMO='0';process.env.LIBETECH_ORIGIN='https://os.example.test';
 const request=(origin:string)=>new Request('http://localhost/api/auth/login',{method:'POST',headers:{host:'os.example.test',origin}});
 expect(()=>checkOrigin(request('https://os.example.test'))).not.toThrow();expect(()=>checkOrigin(request('https://evil.test'))).toThrow();expect(()=>createSession(request('https://os.example.test'),{profileKey:'manager'})).toThrow();
});
test('HTTP identity flow sets secure cookies and enforces authentication and CSRF',async()=>{
 process.env.LIBETECH_DEMO='0';process.env.LIBETECH_ORIGIN='https://os.example.test';
 const req=(action:string,input?:unknown,cookie='',method='POST',origin='https://os.example.test')=>new Request('https://os.example.test/api/auth/'+action,{method,headers:{host:'os.example.test',origin,cookie},...(input?{body:JSON.stringify(input)}:{})});
 const activated=await handleAuth(req('activate',{token:invite,password}),'activate',auth);expect(activated.status).toBe(200);
 const cookie=activated.headers.get('set-cookie')!;expect(cookie).toContain('HttpOnly');expect(cookie).toContain('SameSite=Strict');expect(cookie).toContain('Secure');
 const me=await handleAuth(req('me',undefined,cookie,'GET'),'me',auth);expect(me.status).toBe(200);expect((await me.json()).data.telegram.linked).toBe(false);
 expect((await handleAuth(req('me',undefined,'','GET'),'me',auth)).status).toBe(401);
 expect((await handleAuth(req('telegram-code',{},cookie),'telegram-code',auth)).status).toBe(200);
 expect((await handleAuth(req('login',{username:'tester',password}),'login',auth)).status).toBe(200);
 expect((await handleAuth(req('login',{username:'tester',password:'wrong'}),'login',auth)).status).toBe(401);
 expect((await handleAuth(req('logout',{},cookie,'POST','https://evil.test'),'logout',auth)).status).toBe(403);
 expect((await handleAuth(req('unknown',{},cookie),'unknown',auth)).status).toBe(404);
 expect((await handleAuth(req('logout',{},cookie),'logout',auth)).status).toBe(200);
 expect((await handleAuth(req('me',undefined,cookie,'GET'),'me',auth)).status).toBe(401);
});

// A live metadata read showed Dragon Forge and LibeAI are different groups.
test('deployment chat mapping permits LibeAI and denies Dragon Forge and Xeca',async()=>{
 await paired();
 expect(pilotScope.internalChatId).toBe('-5298399184');
 const scopes=Object.fromEntries([[pilotScope.internalChatId,[ids.sales]],...pilotScope.deniedChatIds.map(chat=>[chat,[]])]);
 await db.query(`INSERT INTO analytics.reconciliations(tenant_id,project_id,code,source_id,source_type,ingested_at,quality_score,source_sha,snapshot_hash,result) VALUES($1,$2,'TEST-014','https://github.com/example/test','github',now(),1,$3,$4,$5)`,[ids.tenant,ids.sales,demoSha,'a'.repeat(64),{checks:0,accepted:false}]);
 const data={operation:'reconciliation',context:{...context,chatId:pilotScope.internalChatId},code:'TEST-014',sourceSha:demoSha};
 expect(await handleBridge(signed(data),db,auth,key,scopes)).toMatchObject({readOnly:true});
 for(const chatId of ['-1004338813921','-1002308580311','-99999'])
  await expect(handleBridge(signed({...data,context:{...context,chatId}}),db,auth,key,scopes)).rejects.toMatchObject({code:'SCOPE_DENIED'});
});
