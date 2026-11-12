import {Pool} from 'pg';
import {z} from 'zod';

const env=z.object({
 MIGRATION_DATABASE_URL:z.url(),LIBETECH_TENANT_ID:z.uuid(),LIBETECH_ACCOUNT_ADMIN_ID:z.uuid(),
 LIBETECH_BOM_CHU_USERNAME:z.string().min(3).optional(),
 LIBETECH_BOM_QUAN_USERNAME:z.string().min(3).optional(),
 LIBETECH_BOM_PHUONG_USERNAME:z.string().min(3).optional(),
}).parse(process.env);
const apply=process.argv.includes('--apply');
if(!apply&&!process.argv.includes('--check')) throw new Error('Use --check or --apply.');
const desired:{seat:string;id?:string;username?:string}[]=[
 {seat:'chairman',id:env.LIBETECH_ACCOUNT_ADMIN_ID},
 ...([
  {seat:'bom_chu',username:env.LIBETECH_BOM_CHU_USERNAME},
  {seat:'bom_quan',username:env.LIBETECH_BOM_QUAN_USERNAME},
  {seat:'bom_phuong',username:env.LIBETECH_BOM_PHUONG_USERNAME},
 ]).filter(row=>row.username),
];
if(desired.length<2) throw new Error('Chairman and at least one named BoM member are required.');
const pool=new Pool({connectionString:env.MIGRATION_DATABASE_URL,max:1});
const client=await pool.connect();
try {
 await client.query('BEGIN');
 await client.query("SELECT pg_advisory_xact_lock(hashtext('libetech-account-approvers'))");
 const rows:{seat:string;id:string}[]=[];
 for(const requested of desired) {
  const user=(await client.query<{id:string;username:string;active:boolean;activated:boolean;linked:boolean;memberships:number}>(`
   SELECT u.id,u.username,u.active,u.password_hash IS NOT NULL AS activated,
    EXISTS(SELECT 1 FROM identity.telegram_links l WHERE l.tenant_id=u.tenant_id AND l.user_id=u.id) AS linked,
    (SELECT count(*)::integer FROM identity.memberships m WHERE m.tenant_id=u.tenant_id AND m.user_id=u.id) AS memberships
   FROM identity.users u WHERE u.tenant_id=$1 AND ${requested.id?'u.id=$2':'u.username=$2'}`,
   [env.LIBETECH_TENANT_ID,requested.id??requested.username])).rows[0];
  if(!user?.active||!user.activated||!user.linked||!user.memberships||(requested.id&&user.id!==env.LIBETECH_ACCOUNT_ADMIN_ID))
   throw new Error(`Approver ${requested.seat} is not an active, Telegram-linked account with a project grant.`);
  rows.push({seat:requested.seat,id:user.id});
 }
 if(new Set(rows.map(row=>row.id)).size!==rows.length) throw new Error('Distinct approver accounts are required.');
 const existing=(await client.query<{seat:string;user_id:string}>(
  'SELECT seat,user_id FROM identity.account_approval_seats WHERE tenant_id=$1 ORDER BY seat',
  [env.LIBETECH_TENANT_ID])).rows;
 if(existing.some(old=>!rows.some(row=>row.seat===old.seat&&row.id===old.user_id)))
  throw new Error('Existing approver mapping cannot be removed or changed by this command.');
 const added=rows.filter(row=>!existing.some(old=>old.seat===row.seat));
 if(apply&&added.length) {
  for(const row of added) await client.query(`INSERT INTO identity.account_approval_seats(tenant_id,seat,user_id)
    VALUES($1,$2,$3)`,[env.LIBETECH_TENANT_ID,row.seat,row.id]);
  await client.query(`INSERT INTO identity.events(tenant_id,actor_id,kind,detail)
   VALUES($1,$2,'account_approval_seats_configured',$3)`,[env.LIBETECH_TENANT_ID,
   env.LIBETECH_ACCOUNT_ADMIN_ID,JSON.stringify({seats:added.map(row=>row.seat),count:added.length})]);
 }
 await client.query(apply?'COMMIT':'ROLLBACK');
 console.log(JSON.stringify({ready:true,applied:apply&&added.length>0,alreadyConfigured:added.length===0,
  seats:rows.map(row=>row.seat)}));
} catch(error) { await client.query('ROLLBACK'); throw error; }
finally { client.release(); await pool.end(); }
