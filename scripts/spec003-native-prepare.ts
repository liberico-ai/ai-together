// Isolated PostgreSQL verification. This script never targets a team database.
import { readFile,writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Pool,escapeLiteral } from 'pg';
import { passwordHash,secret } from '../src/server/identity';
import { pooledDatabase } from '../src/server/db';
import { projectEvidence } from '../src/server/evidence-projector';
import { ids } from '../src/server/identities';
import { lbrc014Report } from './lbrc014-report';

const config=Object.fromEntries((await readFile('.runtime/spec003-postgres.env','utf8')).trim().split('\n')
  .map(line=>[line.slice(0,line.indexOf('=')),line.slice(line.indexOf('=')+1)]));
if(config.POSTGRES_DB!=='spec003_verify'||config.POSTGRES_USER!=='spec003_operator') throw new Error('Expected the isolated verification database.');
const base=new URL('postgresql://127.0.0.1:35447/spec003_verify');
base.username=config.POSTGRES_USER;base.password=config.POSTGRES_PASSWORD;
process.env.MIGRATION_DATABASE_URL=base.href;
await import('./migrate');
const pool=new Pool({connectionString:base.href,max:1});
const adminId=randomUUID(),password=secret(),key=secret();
const env:Record<string,string>={
  LIBETECH_DEMO:'0',LIBETECH_ORIGIN:'http://127.0.0.1:3348',LIBETECH_LOCAL_AUTH:'1',
  LIBETECH_TENANT_ID:lbrc014Report.tenantId,LIBETECH_ACCOUNT_ADMIN_ID:adminId,
  LIBETECH_BRIDGE_CONFIG:process.cwd()+'/.runtime/spec003-bridge.json',
};
try {
  for(const [role,name] of [['libetech_web','DATABASE_URL'],['libetech_auth','IDENTITY_DATABASE_URL']]){
    const credential=secret();
    await pool.query(`ALTER ROLE ${role} PASSWORD ${escapeLiteral(credential)}`);
    const url=new URL(base);url.username=role;url.password=credential;env[name]=url.href;
  }
  await pool.query('INSERT INTO projects(id,tenant_id,name,bu) VALUES($1,$2,$3,$4),($5,$2,$6,$7),($8,$9,$10,$11)',
    [lbrc014Report.projectId,lbrc014Report.tenantId,'LBRC · App Saleman','LBRC',
      ids.transport,'Dự án đối chứng','TEST',ids.otherProject,ids.otherTenant,'Tenant đối chứng','TEST']);
  await pool.query("INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,'spec003-operator','Điều phối thử','manager',$3)",
    [adminId,lbrc014Report.tenantId,await passwordHash(password)]);
  await pool.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,report_permissions)
    VALUES($1,$2,$3,ARRAY['people_read','quality_review','report_approve']),($1,$2,$4,'{}')`,
    [lbrc014Report.tenantId,adminId,lbrc014Report.projectId,ids.transport]);
  await pool.query(`INSERT INTO analytics.reconciliations(tenant_id,project_id,code,source_id,source_type,ingested_at,
    quality_score,source_sha,snapshot_hash,result) VALUES($1,$2,'LBRC014',$3,'github-rest+workbook-snapshot',$4,.75,$5,$6,$7)`,
    [lbrc014Report.tenantId,lbrc014Report.projectId,lbrc014Report.evidence[1].source_id,
      lbrc014Report.evidence[1].occurredAt,lbrc014Report.works[0].sourceSha,'4f8aaa43dce649ec6ea6224e91120939c0b4a20125688e4f61f26d536db34b48',
      JSON.stringify({code:'LBRC014',checksCount:0,acceptedSha:null})]);
  const db=pooledDatabase(base.href);
  try {
    const report=await projectEvidence(db,lbrc014Report);
    await writeFile('.runtime/spec003-test.json',JSON.stringify({adminId,password,key,operatorUrl:base.href,runId:report.runId}),
      {mode:0o600,flag:'wx'});
  } finally {await db.close();}
  await writeFile(env.LIBETECH_BRIDGE_CONFIG,JSON.stringify({key,chatScopes:{'-5298399184':[lbrc014Report.projectId]}}),
    {mode:0o600,flag:'wx'});
  await writeFile('.runtime/spec003-web.env',Object.entries(env).map(([name,value])=>name+'='+value).join('\n')+'\n',
    {mode:0o600,flag:'wx'});
  console.log('Prepared native PostgreSQL, restricted logins and LBRC014 projection.');
} finally {await pool.end();}
