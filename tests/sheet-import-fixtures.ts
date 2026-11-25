import {randomUUID} from 'node:crypto';
import {ids} from '../src/server/identities';
import type {Harness} from './slice1-db';
import type {Principal} from '../src/server/types';

// Fake data only: made-up codes (TEST001), made-up names, a made-up sheet key. No test reads a real sheet.
export const HEAD='STT,BU,Đầu việc,Người phụ trách,Phối hợp,Trạng thái,Hạn,Ghi chú';
export const SHEET='Đầu việc Tech';
export const SOURCE_URL='https://docs.google.com/spreadsheets/d/TESTSHEETKEY0001/edit?gid=123';
export const SOURCE_KEY='TESTSHEETKEY0001';
export const SOURCE_ID=SOURCE_KEY;   // the spreadsheet key alone; the gid of the link is metadata
export const refOf=(row:number)=>`${SOURCE_ID}/${SHEET}!A${row}:H${row}`;
export const projectIds={lbrc:'15000000-0000-4000-8000-000000000001',xeca:'15000000-0000-4000-8000-000000000002',ibs:'15000000-0000-4000-8000-000000000003'};
export const techId='14000000-0000-4000-8000-000000000077';
/** A Team Tech member on the roster who holds one grant (viewer, transport) and none in the three Team Tech projects. */
export const tech:Principal={id:techId,tenantId:ids.tenant,projectIds:[ids.transport],name:'Thành viên Tech thử',role:'viewer',
  grants:[{projectId:ids.transport,role:'viewer',reportPermissions:[]}]};

/** One CSV line of eight cells, each quoted. */
export const line=(...cells:string[])=>cells.map(c=>'"'+c.replaceAll('"','""')+'"').join(',');
/** The eight cells of a row, with defaults. */
export const row8=(o:Partial<Record<'stt'|'bu'|'title'|'owner'|'collab'|'status'|'due'|'note',string>>={})=>
  line(o.stt??'1',o.bu??'LBRC',o.title??'Việc kiểm thử TEST001 đủ dài',o.owner??'',o.collab??'',o.status??'Đang làm',o.due??'25/11/2026',o.note??'');
export const csvBytes=(...lines:string[])=>new TextEncoder().encode([HEAD,...lines].join('\n')+'\n');
export const envelope=(lines:string[],over:Record<string,unknown>={})=>({fileBase64:Buffer.from(csvBytes(...lines)).toString('base64'),sourceUrl:SOURCE_URL,sheet:SHEET,...over});

/** The three Team Tech projects with the names and BU labels 011 uses, plus the tech member on the roster. */
export async function seedImport(h:Harness):Promise<void>{
  for(const [id,name,bu] of [[projectIds.lbrc,'LBRC · Team Tech','LBRC'],[projectIds.xeca,'XECA · Team Tech','XECA'],[projectIds.ibs,'IBS HI · Team Tech','IBS HI']])
    await h.operator.query('INSERT INTO projects(id,tenant_id,name,bu) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[id,ids.tenant,name,bu]);
  await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,'imp-tech',$3,'viewer','fixture-only')`,[tech.id,tech.tenantId,tech.name]);
  await h.operator.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'viewer')`,[ids.tenant,tech.id,ids.transport]);
  await h.operator.query('INSERT INTO identity.tech_roster(tenant_id,user_id) VALUES($1,$2)',[ids.tenant,tech.id]);
}
/** The native harness keeps batches between cases (they hold no foreign key to a project); an empty table makes the counts of a case its own. */
export async function clearImports(h:Harness):Promise<void>{
  await h.operator.query('TRUNCATE work_import_batches CASCADE');
}
export const newKey=()=>randomUUID();
