import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {createHmac,randomUUID} from 'node:crypto';
import {pooledDatabase,scoped} from '../src/server/db';
import {seed,demoSha} from '../src/server/seed';
import {demoProfiles,ids,otherPrincipal} from '../src/server/identities';
import {IdentityService,digest,secret} from '../src/server/identity';
import {handleBridge,signingText} from '../src/server/bridge';
const admin=new URL(process.env.MIGRATION_DATABASE_URL!);
assert.equal(admin.port,'5547','This verification script may only use the isolated local port.');
const dbName='libetech_acceptance_'+Date.now();
const control=new Pool({connectionString:admin.toString(),max:1});
await control.query('CREATE DATABASE '+dbName);await control.end();admin.pathname='/'+dbName;
process.env.MIGRATION_DATABASE_URL=admin.toString();await import('./migrate');
const owner=pooledDatabase(admin.toString());await seed(owner);
const webUrl=new URL(process.env.DATABASE_URL!),authUrl=new URL(process.env.IDENTITY_DATABASE_URL!);webUrl.pathname='/'+dbName;authUrl.pathname='/'+dbName;
const web=pooledDatabase(webUrl.toString(),true),authDb=pooledDatabase(authUrl.toString(),true),auth=new IdentityService(authDb,ids.tenant);
const passed:string[]=[];const pass=(name:string)=>passed.push(name);
try {
 for(const client of [web,authDb]){const r=(await client.query<{rolsuper:boolean;rolbypassrls:boolean;rolcreatedb:boolean;rolcreaterole:boolean}>('SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0];assert.deepEqual(Object.values(r),[false,false,false,false]);}
 const tooPowerful=pooledDatabase(admin.toString(),true);await assert.rejects(tooPowerful.query('SELECT 1'));await tooPowerful.close();
 pass('both runtime logins have no superuser, bypass, create-db or create-role');
 for(const p of [demoProfiles.manager,demoProfiles.customer,otherPrincipal])await scoped(web,p,async tx=>{
  for(const table of ['projects','services','work_items','evidence','audit_events','commands','analytics.work_summary','analytics.reconciliations'])
   for(const row of (await tx.query<{tenant_id:string;project_id:string;id:string}>('SELECT * FROM '+table)).rows){assert.equal(row.tenant_id,p.tenantId);assert.ok(p.projectIds.includes(table==='projects'?row.id:row.project_id));}
 });pass('all 8 business/analytics tables enforce tenant and project scope');
 await Promise.all(Array.from({length:30},(_,i)=>{const p=i%2?otherPrincipal:demoProfiles.manager;return scoped(web,p,async tx=>{for(const r of (await tx.query<{tenant_id:string}>('SELECT tenant_id FROM work_items')).rows)assert.equal(r.tenant_id,p.tenantId);});}));
 await web.transaction(async tx=>{await tx.query('SET LOCAL ROLE libetech_runtime');assert.equal((await tx.query('SELECT * FROM work_items')).rows.length,0);});pass('30 concurrent pool transactions and subsequent unscoped transaction do not leak scope');
 await assert.rejects(auth.scope(tx=>tx.query('SELECT * FROM work_items')));await assert.rejects(scoped(web,demoProfiles.manager,tx=>tx.query('SELECT * FROM identity.users')));pass('business and identity roles cannot read each other schemas');
 const invite=secret(),password='Synthetic native verification only!';
 await owner.query("INSERT INTO identity.users(id,tenant_id,username,name,role) VALUES($1,$2,'native-test','Synthetic test','manager')",[demoProfiles.manager.id,ids.tenant]);
 await owner.query('INSERT INTO identity.memberships(tenant_id,user_id,project_id) VALUES($1,$2,$3)',[ids.tenant,demoProfiles.manager.id,ids.sales]);
 await owner.query("INSERT INTO identity.invitations(tenant_id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[ids.tenant,demoProfiles.manager.id,digest(invite)]);
 const session=await auth.activate({token:invite,password});assert.equal((await auth.session(session.token)).id,demoProfiles.manager.id);await assert.rejects(auth.activate({token:invite,password}));await assert.rejects(auth.login({username:'native-test',password:'incorrect'}));
 assert.equal((await auth.login({username:'native-test',password})).principal.id,demoProfiles.manager.id);pass('native password login, single-use invitation and persistent session');
 const {code}=await auth.pairingCode(session.principal);await assert.rejects(auth.pair(code,'123456789','-1001','supergroup'));await auth.pair(code,'123456789','123456789','private');await assert.rejects(auth.pair(code,'123456789','123456789','private'));pass('private Telegram proof consumes the code once');
 for(const table of ['users','memberships','invitations','sessions','throttle','telegram_codes','telegram_links','events','bridge_nonces'])assert.equal((await new IdentityService(authDb,ids.otherTenant).scope(tx=>tx.query('SELECT * FROM identity.'+table))).rows.length,0);pass('all 9 identity tables enforce tenant RLS');
 await owner.query(`INSERT INTO analytics.reconciliations(tenant_id,project_id,code,source_id,source_type,ingested_at,quality_score,source_sha,snapshot_hash,result) VALUES($1,$2,'TEST-014','https://example.com','test',now(),0,$3,$4,$5)`,[ids.tenant,ids.sales,demoSha,'b'.repeat(64),{synthetic:true}]);
 const key=secret(),scopes={'-1001':[ids.sales],'-1002':[ids.transport]};
 const request=(chatId:string)=>{const raw=JSON.stringify({operation:'reconciliation',context:{profile:'libetech',telegramId:'123456789',chatId,chatType:'supergroup',messageId:'1'},code:'TEST-014',sourceSha:demoSha}),timestamp=String(Date.now()),nonce=secret();return new Request('http://127.0.0.1/api/bridge',{method:'POST',headers:{'x-libetech-timestamp':timestamp,'x-libetech-nonce':nonce,'x-libetech-signature':createHmac('sha256',key).update(signingText(timestamp,nonce,raw)).digest('hex')},body:raw});};
 assert.equal((await handleBridge(request('-1001'),web,auth,key,scopes) as {readOnly:boolean}).readOnly,true);await assert.rejects(handleBridge(request('-1002'),web,auth,key,scopes),{code:'SCOPE_DENIED'});pass('signed bridge reads its scoped SHA and rejects cross-project chat');
 await auth.logout(session.token);await assert.rejects(auth.session(session.token));pass('logout revokes native session');
 const receipt={observedAt:new Date().toISOString(),postgres:(await owner.query<{version:string}>('SELECT version()')).rows[0].version,database:dbName,synthetic:true,passed,failed:0};
 await writeFile('docs/NATIVE-POSTGRES-VERIFICATION-20261108.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
}finally{await web.close();await authDb.close();await owner.close();}
