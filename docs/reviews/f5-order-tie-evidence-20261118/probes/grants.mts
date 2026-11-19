// Probe: the set-up of case F-5 as it was before this change (five designations through the service, one after the other), on N fresh PGlite databases.
// Run from the repository root: npx tsx docs/reviews/f5-order-tie-evidence-20261118/probes/grants.mts 25
// Per database: the time each grant took, the created_at each row got, and whether the coordinator's list is the reverse of the order of creation.
import {randomUUID} from 'node:crypto';
import {openHarness} from '../../../../tests/slice1-db.ts';
import {pm,seedSlice1} from '../../../../tests/slice1-fixtures.ts';
import {approver,reviewer,seedMembers} from '../../../../tests/slice3-fixtures.ts';
import {DelegationService} from '../../../../src/server/review-delegations.ts';
import {ids} from '../../../../src/server/identities.ts';
import type {Principal} from '../../../../src/server/types.ts';
const mk=(n:string,name:string,role:'manager'|'business'|'technical'):Principal=>({id:`14000000-0000-4000-8000-0000000000${n}`,tenantId:ids.tenant,projectIds:[ids.sales],name,role,grants:[{projectId:ids.sales,role,reportPermissions:[]}]});
const pm2=mk('41','Điều phối thứ hai mẫu','manager'),business2=mk('46','Nghiệp vụ thứ hai mẫu','business'),technical2=mk('47','Kỹ thuật thứ hai mẫu','technical');
const N=Number(process.argv[2]??25),tail=(id:string)=>id.slice(-2);
let differs=0,ties=0;
for(let run=1;run<=N;run++){
  const h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);
  for(const [i,p] of [pm2,business2,technical2].entries()){
    await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,$3,$4,$5,'fixture-only')`,[p.id,p.tenantId,'f5-probe-'+i,p.name,p.role]);
    await h.operator.query('INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,$4)',[p.tenantId,p.id,ids.sales,p.role]);
  }
  const svc=new DelegationService(h.db),people=[reviewer,approver,business2,technical2,pm2],took:string[]=[];
  for(const p of people){
    const t=performance.now();
    await svc.grant(pm,{projectId:ids.sales,delegateId:p.id,docTypes:['plan'],basis:'Điều phối giao nhận xét tài liệu thiết kế'},randomUUID(),randomUUID());
    took.push((performance.now()-t).toFixed(2));
  }
  const stamps=(await h.operator.query<{d:string;t:string}>("SELECT delegate_id d,to_char(created_at,'SS.US') t FROM review_delegations")).rows;
  const at=people.map(p=>stamps.find(s=>s.d===p.id)!.t);
  const got=(await svc.list(pm,{projectId:ids.sales})).reviewers.map(x=>tail(x.delegateId)),want=[...people].reverse().map(p=>tail(p.id));
  const ok=got.join()===want.join(),tie=new Set(at).size<at.length;
  if(!ok) differs++;if(tie) ties++;
  console.log(`#${String(run).padStart(2,'0')} grant ms [${took.join(', ')}] created_at s.us [${at.join(', ')}] tie=${tie} list=${got.join(',')} ${ok?'= reverse of creation':'DIFFERS from reverse of creation '+want.join(',')}`);
  await h.close();
}
console.log(`databases=${N}; with two rows of one created_at=${ties}; coordinator's list differs from the reverse of creation=${differs}`);
