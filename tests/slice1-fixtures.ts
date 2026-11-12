import {demoProfiles,ids,otherPrincipal} from '../src/server/identities';
import {seed} from '../src/server/seed';
import type {Principal} from '../src/server/types';
import type {Harness} from './slice1-db';

export const sameBuProject='11000000-0000-4000-8000-000000000003';
export const pm:Principal={...demoProfiles.manager,grants:[
  {projectId:ids.sales,role:'manager',reportPermissions:[]},{projectId:ids.transport,role:'manager',reportPermissions:[]}]};
export const member:Principal={...demoProfiles.engineer,grants:[{projectId:ids.sales,role:'engineer',reportPermissions:[]}]};
export const viewer:Principal=demoProfiles.customer;
export const bot:Principal=demoProfiles.bot;
export const outsider:Principal=otherPrincipal;

export async function seedSlice1(h:Harness):Promise<void>{
  await seed(h.operator);
  await h.operator.query('INSERT INTO projects(id,tenant_id,name,bu) VALUES($1,$2,$3,$4)',
    [sameBuProject,ids.tenant,'Dự án cùng BU mẫu','BU Bán hàng mẫu']);
  for(const [i,p] of [pm,member].entries())
    await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash)
      VALUES($1,$2,$3,$4,$5,'fixture-only')`,[p.id,p.tenantId,'slice1-'+i,p.name,p.role]);
}
