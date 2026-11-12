import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {openHarness,type Harness} from './slice1-db';
import {bot as _bot,outsider,pm,seedSlice1,viewer} from './slice1-fixtures';
import {scoped} from '../src/server/db';
import {ids} from '../src/server/identities';

void _bot;
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

test('runtime cannot create an active channel or a domain mapping',async()=>{
  const ch=(state:string,approver:string|null)=>scoped(h.db,pm,tx=>tx.query(
    "INSERT INTO project_channels(tenant_id,project_id,chat_id,mode,state,approver_id,policy_version,proposed_by) VALUES($1,$2,'-100999','active',$3,$4,'p1',$5)",
    [ids.tenant,ids.sales,state,approver,pm.id]));
  await expect(ch('active',null)).rejects.toThrow();
  await expect(ch('proposed',pm.id)).rejects.toThrow();
  await expect(ch('proposed',null)).resolves.toBeTruthy();
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
