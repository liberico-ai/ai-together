import {createHash,randomUUID} from 'node:crypto';
import {ids} from '../src/server/identities';
import type {Principal} from '../src/server/types';
import type {Harness} from './slice1-db';
import {approver,reviewer} from './slice3-fixtures';
import {pm} from './slice1-fixtures';
import {intakePrincipalId} from './slice2-fixtures';

// Synthetic fixtures for the pool (GIAO VIỆC 5 B). Short fake ids only; nothing here is a real group or person.
export const chatPool='-10012345';
export const chatPool2='-10012346';
export const techA:Principal={id:'14000000-0000-4000-8000-0000000000a1',tenantId:ids.tenant,projectIds:[ids.transport],name:'Thành viên Tech A thử',role:'viewer',
  grants:[{projectId:ids.transport,role:'viewer',reportPermissions:[]}]};
export const techB:Principal={id:'14000000-0000-4000-8000-0000000000a2',tenantId:ids.tenant,projectIds:[ids.transport],name:'Thành viên Tech B thử',role:'viewer',
  grants:[{projectId:ids.transport,role:'viewer',reportPermissions:[]}]};
export const techTelegram={a:'900000101',b:'900000102'};
export const poolOverride=(telegramId=techTelegram.a)=>({context:{chatId:chatPool,telegramId}});

/** Two Team Tech members with Telegram linked, the three BoM seats of the sales project (pm, reviewer, approver) and the scope enabled. */
export async function seedTech(h:Harness):Promise<void>{
  for(const [i,p] of [techA,techB].entries()){
    await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,$3,$4,'viewer','fixture-only')`,[p.id,p.tenantId,'pool-tech-'+i,p.name]);
    await h.operator.query(`INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role) VALUES($1,$2,$3,'viewer')`,[ids.tenant,p.id,ids.transport]);
    await h.operator.query('INSERT INTO identity.tech_roster(tenant_id,user_id) VALUES($1,$2)',[ids.tenant,p.id]);
    await h.operator.query('INSERT INTO identity.telegram_links(tenant_id,user_id,telegram_id) VALUES($1,$2,$3)',[ids.tenant,p.id,i===0?techTelegram.a:techTelegram.b]);
  }
  for(const [i,p] of [pm,reviewer,approver].entries())
    await h.operator.query('INSERT INTO identity.telegram_links(tenant_id,user_id,telegram_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[ids.tenant,p.id,String(900000201+i)]);
  await h.operator.query('INSERT INTO bom_scopes(tenant_id,project_id,seat_ids,enabled) VALUES($1,$2,$3,true)',[ids.tenant,ids.sales,[pm.id,reviewer.id,approver.id]]);
}

export const hex=(s:string)=>createHash('sha256').update(s).digest('hex');
let seq=0;
/** Inserts one pool item the way the intake role does: no text, no file name, no sender label. Returns its id. */
export async function insertPoolItem(h:Harness,over:Record<string,unknown>={}):Promise<string>{
  seq+=1;
  const r={tenant:ids.tenant,sender:techA.id,chat:chatPool,message:String(1000+seq),...over};
  return h.operator.transaction(async tx=>{
    await tx.query('SET LOCAL ROLE libetech_intake');
    await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids','',true),set_config('app.intake_principal_id',$2,true)",[String(r.tenant),intakePrincipalId]);
    return (await tx.query<{id:string}>(
      `INSERT INTO intake_pool_items(tenant_id,source_id,source_type,quality_score,chat_id,topic_id,message_id,locator,sender_id,observed_at,content_hash,forwarded,trace_id,correlation_id)
       VALUES($1,$2,'telegram_gateway',100,$3,'',$4,'',$5,$6,$7,false,$8,$9) RETURNING id`,
      [r.tenant,'telegram:'+r.chat+':'+r.message,r.chat,r.message,r.sender,new Date(1760000000000+seq*1000).toISOString(),hex('m'+seq),randomUUID(),randomUUID()])).rows[0].id;
  });
}

/** Runs fn as one application role with the transaction context a service would set. */
export function asRole<T>(h:Harness,role:'libetech_runtime'|'libetech_intake',ctx:{tenant?:string|null;projects?:string[];person?:string|null},fn:(tx:{query:<R=Record<string,unknown>>(sql:string,p?:unknown[])=>Promise<{rows:R[]}>})=>Promise<T>):Promise<T>{
  return h.operator.transaction(async tx=>{
    await tx.query(`SET LOCAL ROLE ${role}`);
    if(ctx.tenant!==null) await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true)",[ctx.tenant??ids.tenant,(ctx.projects??[]).join(',')]);
    if(ctx.person) await tx.query("SELECT set_config('app.person_id',$1,true),set_config('app.intake_principal_id',$1,true)",[ctx.person]);
    return fn(tx);
  });
}

/** every text, varchar and jsonb column of every table of the application schemas, searched for the canary */
export const canaryHits=async(h:Harness,canary:string):Promise<string[]>=>{
  const rows=async<T=Record<string,unknown>>(sql:string,p:unknown[]=[])=>(await h.operator.query<T>(sql,p)).rows;
  const cols=await rows<{s:string;t:string;c:string;k:string}>(
    `SELECT c.table_schema s,c.table_name t,c.column_name c,c.data_type k FROM information_schema.columns c JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name AND t.table_type='BASE TABLE'
     WHERE c.table_schema IN ('public','identity','analytics','intelligence') AND c.data_type IN ('text','character varying','character','jsonb','json','ARRAY') ORDER BY 1,2,3`);
  const hits:string[]=[];
  for(const x of cols){
    const r=await rows<{n:string}>(`SELECT count(*) n FROM "${x.s}"."${x.t}" WHERE "${x.c}"::text ILIKE $1`,['%'+canary+'%']);
    if(Number(r[0].n)>0) hits.push(`${x.s}.${x.t}.${x.c}`);
  }
  return hits;
};
