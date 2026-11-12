/** Additive Z2 import of the Chairman-reviewed Team Tech source snapshot. */
import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {z} from 'zod';
import {inspectSourceSnapshot,sourceSnapshot} from '../src/server/source-snapshot';

const catalogSchema=z.object({
 snapshot:sourceSnapshot,
 platform_source:z.object({source_id:z.string(),source_url:z.url(),source_modified_at:z.iso.datetime({offset:true}),note:z.string()}),
 platforms:z.array(z.object({bu:z.enum(['XECA','LBRC','IBS HI']),name:z.string().min(1)}).strict()),
}).strict();
const names:Record<string,string>={'XECA':'XECA · Team Tech','LBRC':'LBRC · Team Tech','IBS HI':'IBS HI · Team Tech'};

async function main() {
 const file=process.argv[2]??'data/team-tech-catalog-20261111.json';
 const catalog=catalogSchema.parse(JSON.parse(await readFile(file,'utf8')));
 const report=inspectSourceSnapshot(catalog.snapshot);
 if(report.counts.rows!==45||catalog.platforms.length!==17) throw Error('Unexpected source coverage; review the new snapshot.');
 const tenant=z.uuid().parse(process.env.LIBETECH_TENANT_ID);
 if(!process.env.MIGRATION_DATABASE_URL) throw Error('MIGRATION_DATABASE_URL required');
 const pool=new Pool({connectionString:process.env.MIGRATION_DATABASE_URL,max:1});
 const tx=await pool.connect();
 try {
  await tx.query('BEGIN');
  const migration=(await tx.query<{version:string}>("SELECT version FROM schema_migrations WHERE version='011'")).rows[0];
  if(!migration) throw Error('Migration 011 required before catalog import.');
  const projects=(await tx.query<{id:string;bu:string}>(`SELECT id,bu FROM projects WHERE tenant_id=$1
    AND ((bu='XECA' AND name=$2) OR (bu='LBRC' AND name=$3) OR (bu='IBS HI' AND name=$4))`,
    [tenant,names.XECA,names.LBRC,names['IBS HI']])).rows;
  if(projects.length!==3) throw Error('Exactly three scoped catalog projects required.');
  const project=new Map(projects.map(row=>[row.bu,row.id]));
  let tasksInserted=0,platformsInserted=0;
  for(const row of report.rows) {
   const cells=catalog.snapshot.values[row.row-1].map(value=>(value??'').trim());
   const [stt,bu,title,owner,collaborators,status,due,note]=cells;
   if(!project.has(bu)||!stt||!title||!status) throw Error(`Invalid source row ${row.row}`);
   const prior=(await tx.query<{fingerprint:string}>(`SELECT fingerprint FROM analytics.tech_source_tasks
      WHERE tenant_id=$1 AND source_id=$2 AND source_row=$3`,[tenant,catalog.snapshot.source_id,row.row])).rows[0];
   if(prior&&prior.fingerprint!==row.fingerprint) throw Error(`Source row ${row.row} changed; human mapping review required.`);
   if(!prior) {
    const result=await tx.query(`INSERT INTO analytics.tech_source_tasks
      (tenant_id,project_id,source_id,source_row,stt,source_ref,snapshot_hash,fingerprint,
       source_modified_at,title,source_owner,collaborators,source_status,due_raw,source_note)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT DO NOTHING RETURNING id`,
      [tenant,project.get(bu),catalog.snapshot.source_id,row.row,stt,row.source_ref,report.snapshot_hash,
       row.fingerprint,catalog.snapshot.source_modified_at,title,owner,collaborators,status,due,note]);
    tasksInserted+=result.rowCount??result.rows.length;
   }
  }
  for(const item of catalog.platforms) {
   const result=await tx.query(`INSERT INTO analytics.tech_platform_catalog
    (tenant_id,project_id,source_id,source_url,source_modified_at,name)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id`,
    [tenant,project.get(item.bu),catalog.platform_source.source_id,catalog.platform_source.source_url,
      catalog.platform_source.source_modified_at,item.name]);
   platformsInserted+=result.rowCount??result.rows.length;
  }
  await tx.query(`INSERT INTO analytics.tech_source_imports
    (tenant_id,source_id,snapshot_hash,source_modified_at,task_count,platform_count)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
    [tenant,catalog.snapshot.source_id,report.snapshot_hash,catalog.snapshot.source_modified_at,
      report.counts.rows,catalog.platforms.length]);
  await tx.query('COMMIT');
  console.log(JSON.stringify({snapshotHash:report.snapshot_hash,sourceModifiedAt:catalog.snapshot.source_modified_at,
   tasks:report.counts.rows,platforms:catalog.platforms.length,tasksInserted,platformsInserted,
   canonicalWorkItemsChanged:0,sourceSheetChanged:0}));
 } catch(error){await tx.query('ROLLBACK');throw error;}
 finally{tx.release();await pool.end();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
