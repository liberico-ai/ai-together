import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {native,openHarness,waitForBlocked,type Harness} from './slice1-db';
import {bot,member,outsider,pm,seedSlice1,viewer} from './slice1-fixtures';
import {scoped} from '../src/server/db';
import {ids} from '../src/server/identities';
import {createHmac,randomUUID} from 'node:crypto';
import {ZodError} from 'zod';
import {IdentityService,secret} from '../src/server/identity';
import {handleBridge,signingText} from '../src/server/bridge';
import {demoSha} from '../src/server/seed';
import {ProjectRegistryService} from '../src/server/projects-registry';
import type {ProjectChannel} from '../src/server/types';

let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);});
afterEach(async()=>{await h.reset();await h.close();});

const tables=['project_profiles','project_channels','project_domain_mappings','registry_events'];
const event=(project:string,tenant:string,actor:string)=>["INSERT INTO registry_events(tenant_id,project_id,entity_type,entity_id,actor_id,kind,command_key,payload) VALUES($1,$2,'project_profile',gen_random_uuid(),$3,'k','ck','{}')",[tenant,project,actor]] as [string,string[]];

async function seedRows(){
  const o=h.operator;
  await o.query("INSERT INTO project_profiles(tenant_id,project_id,updated_by) VALUES($1,$2,$3)",[ids.tenant,ids.sales,pm.id]);
  await o.query("INSERT INTO project_channels(tenant_id,project_id,chat_id,mode,policy_version,proposed_by) VALUES($1,$2,'-100123','command_reply','p1',$3)",[ids.tenant,ids.sales,pm.id]);
  await o.query("INSERT INTO project_domain_mappings(tenant_id,project_id,domain_code,confirmed_by,source,mapping_version) VALUES($1,$2,'XECA',$3,'synthetic-source',1)",[ids.tenant,ids.sales,pm.id]);
  await o.query(...event(ids.sales,ids.tenant,pm.id));
}

test('new registry tables return nothing without RLS context',async()=>{
  await seedRows();
  for(const t of tables){
    const rows=await h.db.transaction(async tx=>{await tx.query('SET LOCAL ROLE libetech_runtime');return (await tx.query(`SELECT * FROM ${t}`)).rows;});
    expect(rows,t).toHaveLength(0);
  }
});

test('runtime cannot insert a registry row for another project or tenant',async()=>{
  await expect(scoped(h.db,viewer,tx=>tx.query(...event(ids.sales,ids.tenant,viewer.id)))).rejects.toThrow();
  await expect(scoped(h.db,outsider,tx=>tx.query(...event(ids.sales,ids.tenant,outsider.id)))).rejects.toThrow();
  await expect(scoped(h.db,pm,tx=>tx.query(...event(ids.sales,ids.tenant,pm.id)))).resolves.toBeTruthy();
});

test('a project member cannot insert profile or channel rows for another project or tenant',async()=>{
  // member belongs to ids.sales only; ids.transport is a real project of the same tenant, so only the scope_insert policy can refuse it.
  const profileSql="INSERT INTO project_profiles(tenant_id,project_id,updated_by) VALUES($1,$2,$3)";
  const channelSql="INSERT INTO project_channels(tenant_id,project_id,chat_id,mode,policy_version,proposed_by) VALUES($1,$2,'-100777','command_reply','p1',$3)";
  for(const [name,sql] of [['profile',profileSql],['channel',channelSql]] as const){
    await expect(scoped(h.db,member,tx=>tx.query(sql,[ids.tenant,ids.transport,member.id])),name+' other project').rejects.toThrow();
    await expect(scoped(h.db,member,tx=>tx.query(sql,[ids.otherTenant,ids.sales,member.id])),name+' other tenant').rejects.toThrow();
    await expect(scoped(h.db,member,tx=>tx.query(sql,[ids.otherTenant,ids.otherProject,member.id])),name+' other tenant and project').rejects.toThrow();
  }
  const n=async(t:string)=>(await h.operator.query<{n:number}>(`SELECT count(*)::int n FROM ${t}`)).rows[0].n;
  expect(await n('project_profiles')).toBe(0);
  expect(await n('project_channels')).toBe(0);
  // control: the same statements are accepted for the member's own project, so the refusals above come from the scope check
  await expect(scoped(h.db,member,tx=>tx.query(profileSql,[ids.tenant,ids.sales,member.id]))).resolves.toBeTruthy();
  await expect(scoped(h.db,member,tx=>tx.query(channelSql,[ids.tenant,ids.sales,member.id]))).resolves.toBeTruthy();
});

test('runtime cannot create an active channel or a domain mapping',async()=>{
  const ch=(state:string,approver:string|null)=>scoped(h.db,pm,tx=>tx.query(
    "INSERT INTO project_channels(tenant_id,project_id,chat_id,mode,state,approver_id,policy_version,proposed_by) VALUES($1,$2,'-100999','active',$3,$4,'p1',$5)",
    [ids.tenant,ids.sales,state,approver,pm.id]));
  await expect(ch('active',null)).rejects.toThrow();
  await expect(ch('proposed',pm.id)).rejects.toThrow();
  await expect(ch('proposed',null)).rejects.toThrow(/permission denied/); // state is not an insertable column; the default is proposed
  await expect(scoped(h.db,pm,tx=>tx.query(
    "INSERT INTO project_channels(tenant_id,project_id,chat_id,mode,policy_version,proposed_by) VALUES($1,$2,'-100999','active','p1',$3)",
    [ids.tenant,ids.sales,pm.id]))).resolves.toBeTruthy();
  await expect(scoped(h.db,pm,tx=>tx.query(
    "INSERT INTO project_domain_mappings(tenant_id,project_id,domain_code,confirmed_by,source,mapping_version) VALUES($1,$2,'XECA',$3,'synthetic-source',1)",
    [ids.tenant,ids.sales,pm.id]))).rejects.toThrow();
});

test('history tables reject update and delete',async()=>{
  await seedRows();
  for(const t of ['registry_events','project_domain_mappings']){
    await expect(h.operator.query(`UPDATE ${t} SET created_at=now()`)).rejects.toThrow('Append-only history');
    await expect(h.operator.query(`DELETE FROM ${t}`)).rejects.toThrow('Append-only history');
  }
});

test('migration 013 ships no domain mapping row',async()=>{
  expect((await h.operator.query<{n:number}>('SELECT count(*)::int n FROM project_domain_mappings')).rows[0].n).toBe(0);
});


const profile=(over:Record<string,unknown>={})=>({expectedVersion:0,objective:'Mục tiêu mẫu',ownerBu:'BU mẫu',pmLabel:'PM mẫu',vaultPointer:null,repoUrl:null,status:'proposed',...over});
const key=()=>randomUUID().replace(/-/g,'');
const eventCount=async(type='project_profile')=>(await h.operator.query<{n:number}>('SELECT count(*)::int n FROM registry_events WHERE entity_type=$1',[type])).rows[0].n;

test('saveProfile creates then updates with expectedVersion and writes one event each',async()=>{
  const s=new ProjectRegistryService(h.db);
  const a=await s.saveProfile(pm,ids.sales,profile(),key());
  expect(a.version).toBe(1);
  const b=await s.saveProfile(pm,ids.sales,profile({expectedVersion:1,objective:'Mục tiêu mới',status:'active'}),key());
  expect(b).toMatchObject({version:2,objective:'Mục tiêu mới',status:'active'});
  expect(await eventCount()).toBe(2);
});

test('stale expectedVersion is REVISION_CONFLICT with no event and no version change',async()=>{
  const s=new ProjectRegistryService(h.db);
  await s.saveProfile(pm,ids.sales,profile(),key());
  await s.saveProfile(pm,ids.sales,profile({expectedVersion:1}),key());
  await expect(s.saveProfile(pm,ids.sales,profile({expectedVersion:1,objective:'Cũ'}),key())).rejects.toMatchObject({code:'REVISION_CONFLICT',status:409});
  await expect(s.saveProfile(pm,ids.sales,profile({expectedVersion:0}),key())).rejects.toMatchObject({code:'REVISION_CONFLICT',status:409});
  expect(await eventCount()).toBe(2);
  expect((await h.operator.query<{version:number}>('SELECT version FROM project_profiles')).rows[0].version).toBe(2);
});

test('same key and same request replays; same key with different content is IDEMPOTENCY_CONFLICT',async()=>{
  const s=new ProjectRegistryService(h.db),k=key();
  const first=await s.saveProfile(pm,ids.sales,profile(),k);
  expect(await s.saveProfile(pm,ids.sales,profile(),k)).toEqual(first);
  expect(await eventCount()).toBe(1);
  await expect(s.saveProfile(pm,ids.sales,profile({objective:'Khác'}),k)).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
  await expect(s.saveProfile(pm,ids.sales,profile(),'x')).rejects.toMatchObject({code:'IDEMPOTENCY_REQUIRED'});
});

test('non-manager, viewer, bot and outsider cannot write',async()=>{
  const s=new ProjectRegistryService(h.db);
  const chan={expectedVersion:1,chatId:'-1009990002',topicId:'',mode:'command_reply',policyVersion:'p1.0'};
  await expect(s.saveProfile(member,ids.sales,profile(),key())).rejects.toMatchObject({code:'MANAGER_REQUIRED',status:403});
  await expect(s.proposeChannel(member,ids.sales,chan,key())).rejects.toMatchObject({code:'MANAGER_REQUIRED'});
  await expect(s.saveProfile(viewer,ids.transport,profile(),key())).rejects.toMatchObject({code:'MANAGER_REQUIRED'});
  await expect(s.saveProfile(bot,ids.transport,profile(),key())).rejects.toMatchObject({code:'READ_ONLY',status:403});
  await expect(s.proposeChannel(bot,ids.transport,chan,key())).rejects.toMatchObject({code:'READ_ONLY'});
  await expect(s.registry(bot,ids.transport)).rejects.toMatchObject({code:'READ_ONLY'});
  const denied=await s.saveProfile(outsider,ids.sales,profile(),key()).catch(e=>e);
  expect(denied).toMatchObject({code:'SCOPE_DENIED',status:404});
  expect(denied.message).not.toContain('Cổng bán hàng mẫu');
  await expect(s.registry(outsider,ids.sales)).rejects.toMatchObject({code:'SCOPE_DENIED',status:404});
  expect(await eventCount()).toBe(0);
});

test('identity fields in the body are rejected',async()=>{
  const s=new ProjectRegistryService(h.db);
  await expect(s.saveProfile(pm,ids.sales,profile({tenantId:ids.otherTenant}),key())).rejects.toBeInstanceOf(ZodError);
  await expect(s.saveProfile(pm,ids.sales,profile({actorId:viewer.id}),key())).rejects.toBeInstanceOf(ZodError);
  await expect(s.proposeChannel(pm,ids.sales,{expectedVersion:1,chatId:'-100',topicId:'',mode:'active',policyVersion:'p',actorId:viewer.id},key())).rejects.toBeInstanceOf(ZodError);
  await expect(s.saveProfile(pm,ids.sales,profile({repoUrl:'https://user:pw@example.com/x'}),key())).rejects.toBeInstanceOf(ZodError);
});

const telegram='555000111',bridgeKey=secret(),chat='-1009990001';
function signed(payload:unknown){
  const raw=JSON.stringify(payload),timestamp=String(Date.now()),nonce=secret();
  return new Request('http://127.0.0.1/api/bridge',{method:'POST',headers:{'x-libetech-timestamp':timestamp,'x-libetech-nonce':nonce,'x-libetech-signature':createHmac('sha256',bridgeKey).update(signingText(timestamp,nonce,raw)).digest('hex')},body:raw});
}
const allRows=async()=>{
  const out:Record<string,number>={};
  for(const t of tables) out[t]=(await h.operator.query<{n:number}>(`SELECT count(*)::int n FROM ${t}`)).rows[0].n;
  return out;
};

test('a proposed channel grants nothing',async()=>{
  const s=new ProjectRegistryService(h.db);
  await s.saveProfile(pm,ids.sales,profile(),key());
  const c=await s.proposeChannel(pm,ids.sales,{expectedVersion:1,chatId:chat,topicId:'',mode:'command_reply',policyVersion:'p1.0'},key());
  expect(c).toMatchObject({state:'proposed',approver_id:null,enabled_from:null,chat_id:chat});
  await expect(s.proposeChannel(pm,ids.sales,{expectedVersion:2,chatId:chat,topicId:'',mode:'active',policyVersion:'p1.0'},key())).rejects.toMatchObject({code:'CHANNEL_ALREADY_PROPOSED',status:409});
  await h.operator.query('INSERT INTO identity.memberships(tenant_id,user_id,project_id) VALUES($1,$2,$3)',[ids.tenant,pm.id,ids.sales]);
  await h.operator.query('INSERT INTO identity.telegram_links(tenant_id,user_id,telegram_id) VALUES($1,$2,$3)',[ids.tenant,pm.id,telegram]);
  await h.operator.query(`INSERT INTO analytics.reconciliations(tenant_id,project_id,code,source_id,source_type,ingested_at,quality_score,source_sha,snapshot_hash,result) VALUES($1,$2,'TEST-014','https://github.com/example/test','github',now(),1,$3,$4,$5)`,[ids.tenant,ids.sales,demoSha,'a'.repeat(64),{checks:0,accepted:false}]);
  const before=await allRows();
  const req=signed({operation:'reconciliation',context:{telegramId:telegram,chatId:chat,chatType:'supergroup',profile:'libetech',messageId:'1'},code:'TEST-014',sourceSha:demoSha});
  await expect(handleBridge(req,h.db,new IdentityService(h.operator,ids.tenant),bridgeKey,{})).rejects.toMatchObject({code:'SCOPE_DENIED'});
  // DOC-01 second half: an unmapped chat creates no record in any registry table.
  expect(await allRows()).toEqual(before);
});

test('unmapped project shows Chưa xác nhận and counts toward no total',async()=>{
  const s=new ProjectRegistryService(h.db);
  const unmapped={code:null,label:'Chưa xác nhận',countsTowardTotals:false};
  expect((await s.registry(pm,ids.sales)).domain).toEqual(unmapped);
  await h.operator.query("INSERT INTO project_domain_mappings(tenant_id,project_id,domain_code,confirmed_by,source,mapping_version) VALUES($1,$2,'XECA',$3,'fixture tổng hợp',1)",[ids.tenant,ids.transport,pm.id]);
  expect((await s.registry(pm,ids.transport)).domain).toEqual({code:'XECA',label:'Xeca',countsTowardTotals:true});
  expect((await s.registry(pm,ids.sales)).domain).toEqual(unmapped);
  expect((await s.registry(pm,ids.sales)).profile).toBeNull();
});

test('R5: runtime cannot insert a non-proposed or version-2 profile',async()=>{
  const ins=(status:string,version:number)=>scoped(h.db,pm,tx=>tx.query(
    'INSERT INTO project_profiles(tenant_id,project_id,status,version,updated_by) VALUES($1,$2,$3,$4,$5)',[ids.tenant,ids.sales,status,version,pm.id]));
  await expect(ins('active',1)).rejects.toThrow();
  await expect(ins('proposed',2)).rejects.toThrow();
  await expect(ins('proposed',1)).rejects.toThrow(/permission denied/); // version is not an insertable column; the default is 1
  await expect(scoped(h.db,pm,tx=>tx.query(
    'INSERT INTO project_profiles(tenant_id,project_id,status,updated_by) VALUES($1,$2,$3,$4)',[ids.tenant,ids.sales,'proposed',pm.id]))).resolves.toBeTruthy();
});

test('R5: creation as active is PROJECT_STATUS_CONFLICT',async()=>{
  const s=new ProjectRegistryService(h.db);
  await expect(s.saveProfile(pm,ids.sales,profile({status:'active'}),key())).rejects.toMatchObject({code:'PROJECT_STATUS_CONFLICT',status:409});
  expect(await eventCount()).toBe(0);
});

test('R5: status lifecycle follows the state machine',async()=>{
  const s=new ProjectRegistryService(h.db);
  let v=1;
  await s.saveProfile(pm,ids.sales,profile(),key());
  for(const st of ['active','paused','active','closed']){
    expect((await s.saveProfile(pm,ids.sales,profile({expectedVersion:v,status:st}),key())).status).toBe(st);v++;
  }
  expect(await eventCount()).toBe(5);
  await expect(s.saveProfile(pm,ids.sales,profile({expectedVersion:v,status:'active'}),key())).rejects.toMatchObject({code:'PROJECT_STATUS_CONFLICT',status:409});
  expect(await eventCount()).toBe(5);
  expect((await h.operator.query<{version:number}>('SELECT version FROM project_profiles')).rows[0].version).toBe(v);
  await s.saveProfile(pm,ids.transport,profile(),key());
  await expect(s.saveProfile(pm,ids.transport,profile({expectedVersion:1,status:'paused'}),key())).rejects.toMatchObject({code:'PROJECT_STATUS_CONFLICT'});
  expect(await eventCount()).toBe(6);
});

describe('C4 channel proposal is versioned against the project profile',()=>{
  const chanBody=(over:Record<string,unknown>={})=>({expectedVersion:1,chatId:'-1009990010',topicId:'',mode:'command_reply',policyVersion:'p1.0',...over});
  const channelCount=async()=>(await h.operator.query<{n:number}>('SELECT count(*)::int n FROM project_channels')).rows[0].n;
  const version=async()=>(await h.operator.query<{version:number}>('SELECT version FROM project_profiles')).rows[0].version;

  test('success inserts a proposed channel, bumps the profile version and writes channel_proposed with before/after',async()=>{
    const s=new ProjectRegistryService(h.db);
    await s.saveProfile(pm,ids.sales,profile(),key());
    const c=await s.proposeChannel(pm,ids.sales,chanBody(),key());
    expect(c.state).toBe('proposed');
    expect(await version()).toBe(2);
    const ev=(await h.operator.query<{payload:Record<string,unknown>;actor_id:string}>("SELECT payload,actor_id FROM registry_events WHERE kind='channel_proposed'")).rows;
    expect(ev).toHaveLength(1);
    expect(ev[0].payload).toMatchObject({versionBefore:1,versionAfter:2,expectedVersion:1});
    expect(ev[0].actor_id).toBe(pm.id);
    expect((await h.operator.query<{updated_by:string}>('SELECT updated_by FROM project_profiles')).rows[0].updated_by).toBe(pm.id);
    expect((await s.registry(pm,ids.sales)).profile?.version).toBe(2);
  });
  test('stale expectedVersion is REVISION_CONFLICT: no channel, no event, no version change',async()=>{
    const s=new ProjectRegistryService(h.db);
    await s.saveProfile(pm,ids.sales,profile(),key());
    await s.saveProfile(pm,ids.sales,profile({expectedVersion:1}),key());
    const before=await eventCount('project_channel');
    for(const v of [1,3]) await expect(s.proposeChannel(pm,ids.sales,chanBody({expectedVersion:v}),key())).rejects.toMatchObject({code:'REVISION_CONFLICT',status:409});
    expect(await channelCount()).toBe(0);
    expect(await eventCount('project_channel')).toBe(before);
    expect(await version()).toBe(2);
  });
  test('no profile is PROFILE_REQUIRED and writes nothing',async()=>{
    const s=new ProjectRegistryService(h.db);
    await expect(s.proposeChannel(pm,ids.sales,chanBody(),key())).rejects.toMatchObject({code:'PROFILE_REQUIRED',status:409,message:'Cần lập hồ sơ dự án trước khi đề xuất kênh.'});
    expect(await channelCount()).toBe(0);
    expect(await eventCount('project_channel')).toBe(0);
  });
  test('expectedVersion is required, an integer >= 1',async()=>{
    const s=new ProjectRegistryService(h.db);
    for(const v of [undefined,0,1.5,'1']) await expect(s.proposeChannel(pm,ids.sales,chanBody({expectedVersion:v}),key())).rejects.toBeInstanceOf(ZodError);
  });
  test('same key replays; same key with another expectedVersion is IDEMPOTENCY_CONFLICT',async()=>{
    const s=new ProjectRegistryService(h.db),k=key();
    await s.saveProfile(pm,ids.sales,profile(),key());
    const first=await s.proposeChannel(pm,ids.sales,chanBody(),k);
    expect(await s.proposeChannel(pm,ids.sales,chanBody(),k)).toEqual(first);
    expect(await channelCount()).toBe(1);
    expect(await version()).toBe(2);
    await expect(s.proposeChannel(pm,ids.sales,chanBody({expectedVersion:2}),k)).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
  });
  test.skipIf(!native)('two different proposals from the same version: one success, one REVISION_CONFLICT (native)',async()=>{
    const s=new ProjectRegistryService(h.db);
    await s.saveProfile(pm,ids.sales,profile(),key());
    let both!:Promise<PromiseSettledResult<ProjectChannel>[]>;
    await h.operator.transaction(async tx=>{
      await tx.query('SELECT id FROM project_profiles WHERE project_id=$1 FOR UPDATE',[ids.sales]);
      both=Promise.allSettled([s.proposeChannel(pm,ids.sales,chanBody({chatId:'-1009990011'}),key()),s.proposeChannel(pm,ids.sales,chanBody({chatId:'-1009990012'}),key())]);
      await waitForBlocked(h,2);
    });
    const res=await both;
    expect(res.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    const bad=res.filter(r=>r.status==='rejected') as PromiseRejectedResult[];
    expect(bad).toHaveLength(1);expect(bad[0].reason).toMatchObject({code:'REVISION_CONFLICT',status:409});
    expect(await channelCount()).toBe(1);
    expect(await eventCount('project_channel')).toBe(1);
    expect(await version()).toBe(2);
  });
});
