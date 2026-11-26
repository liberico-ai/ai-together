// Migration 029 (OQ-62 câu 4 (b)): the free-text note of an IBS HI row leaves the Z2 source table for a table no application role can read. The text stays for
// the operator. AGENTS.md: IBS HI keeps pointers, hashes and Tech work metadata only. Runs on PGlite and on native PostgreSQL.
import {afterAll,beforeAll,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {openHarness,type Harness} from './slice1-db';
import {seed} from '../src/server/seed';
import {ids,demoProfiles} from '../src/server/identities';
import {teamCatalog} from '../src/server/team-catalog';
import type {Principal} from '../src/server/types';

const migration=(p:string)=>readFile(path.join(process.cwd(),'migrations',p),'utf8').catch(()=>'');
const projects={ibs:'11000000-0000-4000-8000-0000000000e1',lbrc:'11000000-0000-4000-8000-0000000000e2',other:'11000000-0000-4000-8000-0000000000e3'};
const notes={ibs:'Ghi chú nghiệp vụ IBS thử',lbrc:'Ghi chú LBRC thử',other:'Ghi chú dự án sẽ xác nhận IBS'};
let h:Harness;
const q=async<T=Record<string,unknown>>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
let nextRow=100;
const insert=(project:string,note:string,row=++nextRow)=>h.operator.query(
 `INSERT INTO analytics.tech_source_tasks(tenant_id,project_id,source_id,source_row,stt,source_ref,snapshot_hash,fingerprint,title,source_owner,collaborators,source_status,source_note)
  VALUES($1,$2,'mask-fixture',$3::int,$3::text,'mask!A'||$3::text,$4,$4,'Tiêu đề '||$3::text,'Người phụ trách','Người phối hợp','Đang làm',$5)`,[ids.tenant,project,row,'a'.repeat(64),note]);
const noteOf=async(project:string)=>(await q<{source_note:string}>('SELECT source_note FROM analytics.tech_source_tasks WHERE project_id=$1 ORDER BY source_row',[project])).map(r=>r.source_note);
const held=async()=>q<{project_id:string;source_note:string}>("SELECT project_id,source_note FROM analytics.tech_source_notes_held ORDER BY source_note").catch(()=>[] as {project_id:string;source_note:string}[]);
const asRole=(role:string,sql:string)=>h.operator.transaction(async tx=>{
 await tx.query(`SET LOCAL ROLE ${role}`);
 await tx.query("SELECT set_config('app.tenant_id',$1,true), set_config('app.project_ids',$2,true)",[ids.tenant,Object.values(projects).join(',')]);
 return (await tx.query(sql)).rows;
});
const forward=()=>migration('029_mask_ibs_hi_source_notes.sql');
const rollback=()=>migration('rollback/029_mask_ibs_hi_source_notes.sql');
const exec=async(sql:string)=>{try{await h.exec(sql);}catch(error){await h.exec('ROLLBACK');throw error;}};

beforeAll(async()=>{
 h=await openHarness();await h.reset();await seed(h.operator);
 for(const [id,name,bu] of [[projects.ibs,'Dự án IBS thử','IBS HI'],[projects.lbrc,'Dự án LBRC thử','LBRC'],[projects.other,'Dự án khác thử','BU Khác']] as const)
  await h.operator.query('INSERT INTO projects(id,tenant_id,name,bu) VALUES($1,$2,$3,$4)',[id,ids.tenant,name,bu]);
 // rows written before 029, as the 0.9.2 importer wrote them
 await exec(await rollback());
 await insert(projects.ibs,notes.ibs,2);await insert(projects.lbrc,notes.lbrc,3);await insert(projects.other,notes.other,4);
 await exec(await forward());
},120000);
afterAll(async()=>{await h.reset();await h.close();});

test('029 moves the old IBS HI note to the held table and leaves every other column and row as it was',async()=>{
 expect(await noteOf(projects.ibs)).toEqual(['']);
 expect(await noteOf(projects.lbrc)).toEqual([notes.lbrc]);
 expect(await noteOf(projects.other)).toEqual([notes.other]);
 expect(await held()).toEqual([{project_id:projects.ibs,source_note:notes.ibs}]);
 expect(await q('SELECT title,source_owner,collaborators,source_status FROM analytics.tech_source_tasks WHERE project_id=$1',[projects.ibs]))
  .toEqual([{title:'Tiêu đề 2',source_owner:'Người phụ trách',collaborators:'Người phối hợp',source_status:'Đang làm'}]);
});

test('no application role reads the held table, even with the IBS HI project in its scope',async()=>{
 for(const role of ['libetech_runtime','libetech_projector','libetech_identity','libetech_intake'])
  await expect(asRole(role,'SELECT source_note FROM analytics.tech_source_notes_held'),role).rejects.toThrow(/permission denied/);
 expect(JSON.stringify(await asRole('libetech_runtime','SELECT * FROM analytics.tech_source_tasks'))).not.toContain(notes.ibs);
});

test('even granted the table, an application role reads no held row',async()=>{
 await exec('GRANT SELECT ON analytics.tech_source_notes_held TO libetech_runtime').catch(()=>{});
 try{await expect(asRole('libetech_runtime','SELECT source_note FROM analytics.tech_source_notes_held')).resolves.toEqual([]);}
 finally{await exec('REVOKE SELECT ON analytics.tech_source_notes_held FROM libetech_runtime').catch(()=>{});}
});

test('the team catalog of a person in the IBS HI project carries no IBS HI note text',async()=>{
 const person:Principal={id:demoProfiles.manager.id,tenantId:ids.tenant,projectIds:[projects.ibs,projects.lbrc],name:'Test',role:'manager'};
 const result=await teamCatalog(h.db,person);
 expect(result.tasks.length).toBe(2);
 expect(JSON.stringify(result)).not.toContain(notes.ibs);
 expect(JSON.stringify(result)).toContain(notes.lbrc);
});

test('a new IBS HI row with a note is refused; the same row without a note and an LBRC row with a note are taken',async()=>{
 await expect(insert(projects.ibs,'chữ mới của IBS')).rejects.toThrow(/IBS HI/);
 await expect(insert(projects.ibs,'')).resolves.toBeDefined();
 await expect(insert(projects.lbrc,'ghi chú thường')).resolves.toBeDefined();
 await expect(h.operator.query("UPDATE analytics.tech_source_tasks SET source_note='sửa chữ vào' WHERE project_id=$1",[projects.ibs])).rejects.toThrow(/IBS HI/);
});

test('confirming a project as IBS HI moves its notes to the held table in the same transaction',async()=>{
 await h.operator.query(`INSERT INTO project_domain_mappings(id,tenant_id,project_id,domain_code,confirmed_by,source,mapping_version)
  VALUES($1,$2,$3,'IBS_HI',$4,'Biên bản thử 26/11',1)`,[randomUUID(),ids.tenant,projects.other,demoProfiles.manager.id]);
 expect(await noteOf(projects.other)).toEqual(['']);
 expect((await held()).map(r=>r.source_note).sort()).toEqual([notes.ibs,notes.other].sort());
 await expect(insert(projects.other,'chữ sau xác nhận')).rejects.toThrow(/IBS HI/);
});

test('applying 029 twice keeps one held copy per row',async()=>{
 await exec(await forward());await exec(await forward());
 expect((await held()).length).toBe(2);
 expect((await q("SELECT count(*)::int n FROM schema_migrations WHERE version='029'"))[0]).toEqual({n:1});
});

const mapping=(project:string,domain:string,version:number)=>h.operator.query(`INSERT INTO project_domain_mappings(id,tenant_id,project_id,domain_code,confirmed_by,source,mapping_version)
  VALUES($1,$2,$3,$4,$5,'Biên bản thử 26/11',$6)`,[randomUUID(),ids.tenant,project,domain,demoProfiles.manager.id,version]);
const rawNote=(project:string,row:number,note:string)=>h.operator.transaction(async tx=>{await tx.query('SET LOCAL session_replication_role = replica');
  await tx.query('UPDATE analytics.tech_source_tasks SET source_note=$3 WHERE project_id=$1 AND source_row=$2',[project,row,note]);});
const dropRow=async(project:string,row:number)=>{
  await h.operator.query('DELETE FROM analytics.tech_source_notes_held WHERE project_id=$1 AND source_row=$2',[project,row]).catch(()=>{});
  await h.operator.query('DELETE FROM analytics.tech_source_tasks WHERE project_id=$1 AND source_row=$2',[project,row]);
};

// Codex gate, P0: IBS_HI, then another domain, a new note, then IBS_HI again. The row already has a held note; the new one must not stay readable.
test('a project confirmed IBS HI again holds the newer note too and shows neither',async()=>{
 const row=200;
 await mapping(projects.other,'LIBERICO_BU',2);
 await h.operator.query("UPDATE analytics.tech_source_tasks SET source_note=$3 WHERE project_id=$1 AND source_row=$2",[projects.other,4,'ghi chú B sau khi đổi miền']);
 await insert(projects.other,'ghi chú dòng mới',row);
 await expect(mapping(projects.other,'IBS_HI',3)).resolves.toBeDefined();
 expect(await noteOf(projects.other)).toEqual(['','']);
 expect((await held()).filter(r=>r.project_id===projects.other).map(r=>r.source_note).sort())
  .toEqual(['ghi chú B sau khi đổi miền',notes.other,'ghi chú dòng mới'].sort());
 expect(JSON.stringify(await asRole('libetech_runtime','SELECT * FROM analytics.tech_source_tasks'))).not.toContain('ghi chú B sau khi đổi miền');
 await dropRow(projects.other,row);
 // two texts held for one row: giving one back would lose the other, so the rollback refuses
 await expect(exec(await rollback())).rejects.toThrow(/would lose/);
 await h.operator.query("DELETE FROM analytics.tech_source_notes_held WHERE project_id=$1 AND source_note=$2",[projects.other,'ghi chú B sau khi đổi miền']).catch(()=>{});
});

test('renaming a project to an IBS HI label holds its notes in the same statement',async()=>{
 const row=300;
 await insert(projects.lbrc,'ghi chú trước khi đổi nhãn',row);
 await h.operator.query("UPDATE projects SET bu='IBS HI' WHERE id=$1",[projects.lbrc]);
 try{
  expect((await noteOf(projects.lbrc)).every(n=>n==='')).toBe(true);
  expect((await held()).map(r=>r.source_note)).toContain('ghi chú trước khi đổi nhãn');
 }finally{
  await h.operator.query("UPDATE projects SET bu='LBRC' WHERE id=$1",[projects.lbrc]);
  // give the LBRC rows back as they were for the cases below
  await h.operator.query(`UPDATE analytics.tech_source_tasks t SET source_note=k.source_note FROM analytics.tech_source_notes_held k WHERE t.project_id=$1 AND k.project_id=t.project_id AND k.source_row=t.source_row AND k.source_id=t.source_id`,[projects.lbrc]).catch(()=>{});
  await h.operator.query('DELETE FROM analytics.tech_source_notes_held WHERE project_id=$1',[projects.lbrc]).catch(()=>{});
  await dropRow(projects.lbrc,row);
 }
});

// a row that carries other text than the one already held for it (written with the triggers off, as a restore could)
test('applying 029 again holds that second text as well; the rollback then refuses rather than lose either',async()=>{
 await rawNote(projects.ibs,2,'bản chữ khác');
 await expect(exec(await forward())).resolves.toBeUndefined();
 expect((await noteOf(projects.ibs))[0]).toBe('');
 expect((await held()).filter(r=>r.project_id===projects.ibs).map(r=>r.source_note).sort()).toEqual([notes.ibs,'bản chữ khác'].sort());
 await expect(exec(await rollback())).rejects.toThrow(/would lose/);
 await h.operator.query("DELETE FROM analytics.tech_source_notes_held WHERE source_note='bản chữ khác'");
});

test('rollback 029 refuses while a later migration is recorded or a held note has no source row, gives the text back, and runs again',async()=>{
 await h.operator.query("INSERT INTO schema_migrations(version) VALUES('030')");
 try{await expect(exec(await rollback())).rejects.toThrow(/later/i);}finally{await h.operator.query("DELETE FROM schema_migrations WHERE version='030'");}
 await h.operator.query(`INSERT INTO analytics.tech_source_notes_held(tenant_id,project_id,source_id,source_row,source_note) VALUES($1,$2,'mask-fixture',999,'chữ không còn dòng')`,[ids.tenant,projects.ibs]);
 await expect(exec(await rollback())).rejects.toThrow(/would lose/);
 await h.operator.query("DELETE FROM analytics.tech_source_notes_held WHERE source_row=999");
 await exec(await rollback());
 expect((await noteOf(projects.ibs))[0]).toBe(notes.ibs);
 expect(await noteOf(projects.other)).toEqual([notes.other]);
 expect(await q("SELECT to_regclass('analytics.tech_source_notes_held')::text t")).toEqual([{t:null}]);
 await exec(await rollback());
 await exec(await forward());
 expect((await noteOf(projects.ibs))[0]).toBe('');
});
