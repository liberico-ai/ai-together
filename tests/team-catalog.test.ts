import {test,expect} from 'vitest';
import {embeddedDatabase} from '../src/server/db';
import {seed} from '../src/server/seed';
import {ids,demoProfiles} from '../src/server/identities';
import {teamCatalog} from '../src/server/team-catalog';
import type {Principal} from '../src/server/types';

test('source catalog enforces project RLS and does not create canonical work',async()=>{
 const db=await embeddedDatabase();
 try {
  await seed(db);
  const before=(await db.query('SELECT id FROM work_items')).rows.length;
  for(const [projectId,row,stt,title] of [[ids.sales,2,'5','LBRC source'],[ids.transport,3,'6','Other source']] as const) {
   await db.query(`INSERT INTO analytics.tech_source_tasks
    (tenant_id,project_id,source_id,source_row,stt,source_ref,snapshot_hash,fingerprint,title,source_status)
    VALUES($1,$2,'fixture',$3,$4,$5,$6,$7,$8,'Đang triển khai')`,
    [ids.tenant,projectId,row,stt,`fixture!A${row}:H${row}`,'a'.repeat(64),'b'.repeat(64),title]);
  }
  const p:Principal={id:demoProfiles.manager.id,tenantId:ids.tenant,projectIds:[ids.sales],name:'Test',role:'manager'};
  const result=await teamCatalog(db,p);
  expect(result.tasks.map(t=>t.title)).toEqual(['LBRC source']);
  expect((await db.query('SELECT id FROM work_items')).rows).toHaveLength(before);
 } finally {await db.close();}
});
