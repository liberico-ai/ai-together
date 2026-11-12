// Codified REST-source -> Z2 import. Never changes workbook, ticket or acceptance state.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {Pool} from 'pg';
const tenant='b63f99bf-3a85-4a1f-b74a-66b5793871ef',project='8f1b6aca-b20f-469a-a92b-cbde731581fc';
const pilot=JSON.parse(await readFile('docs/LBRC014-RECONCILIATION-20261108.json','utf8'));
const hash=createHash('sha256').update(JSON.stringify(pilot)).digest('hex');
if(!process.env.MIGRATION_DATABASE_URL) throw new Error('Migration credential required for operator-controlled import.');
const pool=new Pool({connectionString:process.env.MIGRATION_DATABASE_URL,max:1});const tx=await pool.connect();
try {
 await tx.query('BEGIN');
 await tx.query("INSERT INTO projects(id,tenant_id,name,bu) VALUES($1,$2,'LBRC · App Saleman','LBRC') ON CONFLICT(id) DO NOTHING",[project,tenant]);
 await tx.query(`INSERT INTO analytics.reconciliations(tenant_id,project_id,code,source_id,source_type,ingested_at,quality_score,source_sha,snapshot_hash,result) VALUES($1,$2,'LBRC014',$3,'github-rest+workbook-snapshot',$4,0.75,$5,$6,$7) ON CONFLICT(tenant_id,project_id,code,snapshot_hash) DO NOTHING`,[tenant,project,pilot.sourceId,pilot.ingestedAt,pilot.sourceSha,hash,pilot]);
 let user=(await tx.query<{id:string}>("SELECT id FROM identity.users WHERE tenant_id=$1 AND username='chairman'",[tenant])).rows[0];
 if(!user){
  user={id:randomUUID()};const token=randomBytes(32).toString('base64url');
  await tx.query("INSERT INTO identity.users(id,tenant_id,username,name,role) VALUES($1,$2,'chairman','Chairman','manager')",[user.id,tenant]);
  await tx.query('INSERT INTO identity.memberships(tenant_id,user_id,project_id) VALUES($1,$2,$3)',[tenant,user.id,project]);
  await tx.query("INSERT INTO identity.invitations(tenant_id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '24 hours')",[tenant,user.id,createHash('sha256').update(token).digest('hex')]);
  // Private handoff only. Fragment is not sent in HTTP requests or server access logs.
  await writeFile('.runtime/first-user-invitation.txt',(process.env.LIBETECH_ORIGIN??'http://127.0.0.1:3148')+'/activate#'+token+'\n',{mode:0o600});
 }
 await tx.query('COMMIT');console.log(JSON.stringify({status:'imported',code:'LBRC014',sourceSha:pilot.sourceSha,snapshotHash:hash,workRecordsCreated:0,acceptancesCreated:0,username:'chairman',invitation:'protected-file-only'}));
}catch(e){await tx.query('ROLLBACK');throw e;}finally{tx.release();await pool.end();}
