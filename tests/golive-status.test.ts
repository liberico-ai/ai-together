// GIAO VIỆC 5 F: the GO LIVE status of each Team Tech member in one project, projected into Z2 by one named projector (operator login, OQ-22).
import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {openHarness,type Harness} from './slice1-db';
import {member,pm} from './slice1-fixtures';
import {demoSha} from '../src/server/seed';
import {projectGoliveStatus} from '../src/server/golive-status';
import {WorkRequestService} from '../src/server/work-requests';
import {ids} from '../src/server/identities';
import type {Principal} from '../src/server/types';
import {sameBuProject,seedReminders,techA,techB} from './reminder-fixtures';
import {mapDomain} from './slice3-fixtures';

let h:Harness;
beforeEach(async()=>{
 h=await openHarness();await seedReminders(h);
 for(const p of [member,pm]) await h.operator.query('INSERT INTO identity.tech_roster(tenant_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[ids.tenant,p.id]);
});
afterEach(async()=>{await h.reset();await h.close();});

type Row={member_id:string;member_name:string;requests_filed:number;open_work:number;open_without_evidence:number};
const status=async(project:string=ids.sales)=>(await h.operator.query<Row>('SELECT member_id,member_name,requests_filed,open_work,open_without_evidence FROM analytics.golive_member_status WHERE project_id=$1 ORDER BY member_name',[project]).catch(()=>({rows:[] as Row[]}))).rows;
const byId=async(id:string,project:string=ids.sales)=>(await status(project)).find(r=>r.member_id===id);
const file=(p:Principal,projectId:string)=>new WorkRequestService(h.db).submit(p,{projectId,requestKey:randomUUID(),code:null,title:'Yêu cầu việc thử của thành viên',priority:'normal',dueAt:null,criteria:'',specUrl:null,assigneeId:null,technicalId:null,businessId:null});

describe('GO LIVE member status',()=>{
 test('each roster member has one row: requests filed in this project, open work, and open work without evidence at its current revision',async()=>{
  await file(techA,ids.sales);
  await file(pm,ids.transport);// another project: it does not count for sales
  await expect(projectGoliveStatus(h.operator,ids.tenant,ids.sales)).resolves.toMatchObject({members:4});
  const rows=await status();
  expect(rows.map(r=>r.member_id).sort()).toEqual([member.id,pm.id,techA.id,techB.id].sort());
  // seed: the engineer holds LT-DEMO-014 (evidence at revision 1) and 015 (none)
  expect(await byId(member.id)).toMatchObject({requests_filed:0,open_work:2,open_without_evidence:1});
  expect(await byId(techA.id)).toMatchObject({requests_filed:1,open_work:0,open_without_evidence:0});
  expect(await byId(pm.id)).toMatchObject({requests_filed:0,open_work:0});
 });

 test('evidence of an older revision does not count, and done work is not open work',async()=>{
  await h.operator.query("UPDATE work_items SET revision=2 WHERE id=$1",[ids.pilot]);
  await h.operator.query("UPDATE work_items SET state='done' WHERE code='LT-DEMO-015'");
  await expect(projectGoliveStatus(h.operator,ids.tenant,ids.sales)).resolves.toMatchObject({members:4});
  expect(await byId(member.id)).toMatchObject({open_work:1,open_without_evidence:1});
  await h.operator.query(`INSERT INTO evidence(tenant_id,project_id,work_id,kind,source_id,source_type,source_sha,revision,quality_score,note,actor_id)
    VALUES($1,$2,$3,'checks','https://example.com/x','manual',$4,2,0,'Bằng chứng thử',$5)`,[ids.tenant,ids.sales,ids.pilot,demoSha,member.id]);
  await projectGoliveStatus(h.operator,ids.tenant,ids.sales);
  expect(await byId(member.id)).toMatchObject({open_work:1,open_without_evidence:0});
 });

 test('a person taken off the roster leaves the projection at the next run; another project keeps its own rows',async()=>{
  await projectGoliveStatus(h.operator,ids.tenant,ids.sales);
  await projectGoliveStatus(h.operator,ids.tenant,ids.transport);
  await h.operator.query('DELETE FROM identity.tech_roster WHERE user_id=$1',[techB.id]);
  await expect(projectGoliveStatus(h.operator,ids.tenant,ids.sales)).resolves.toMatchObject({members:3});
  expect((await status()).map(r=>r.member_id)).not.toContain(techB.id);
  expect((await status(ids.transport)).map(r=>r.member_id)).toContain(techB.id);
 });

 test('an IBS HI or unconfirmed-domain project is refused and gets no row',async()=>{
  await expect(projectGoliveStatus(h.operator,ids.tenant,sameBuProject)).rejects.toMatchObject({code:'REMINDER_PROJECT_REFUSED'});
  await mapDomain(h,ids.transport,'IBS_HI',2);
  await expect(projectGoliveStatus(h.operator,ids.tenant,ids.transport)).rejects.toMatchObject({code:'REMINDER_PROJECT_REFUSED'});
  expect(await status(sameBuProject)).toEqual([]);
  expect(await status(ids.transport)).toEqual([]);
 });
});
