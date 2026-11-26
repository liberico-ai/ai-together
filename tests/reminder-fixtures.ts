// Synthetic fixtures for GIAO VIỆC 5 F. Short fake group ids only; nothing here is a real group or person.
import {randomUUID} from 'node:crypto';
import {ids} from '../src/server/identities';
import {vnParts} from '../src/server/meeting-times';
import type {Principal} from '../src/server/types';
import type {Harness} from './slice1-db';
import {intakePrincipalId} from './slice2-fixtures';
import {mapDomain,seedMembers} from './slice3-fixtures';
import {seedSlice1,sameBuProject} from './slice1-fixtures';
import {seedTech,techA,techB} from './pool-fixtures';

export const groupSales='-10055501';
export const groupTransport='-10055502';
export const groupOther='-10055503';
export const reminderPrincipalId='33000000-0000-4000-8000-0000000000f1';
export const bomUser:Principal={id:'14000000-0000-4000-8000-0000000000b1',tenantId:ids.tenant,projectIds:[],name:'BoM Tech thử',role:'viewer',grants:[]};

export async function seedReminders(h:Harness):Promise<void>{
  await h.reset();await seedSlice1(h);await seedMembers(h);await seedTech(h);
  await mapDomain(h,ids.sales,'LIBERICO_BU');await mapDomain(h,ids.transport,'XECA');
  await h.operator.query(`INSERT INTO identity.users(id,tenant_id,username,name,role,password_hash) VALUES($1,$2,'gv5f-bom',$3,'viewer','fixture-only')`,[bomUser.id,ids.tenant,bomUser.name]);
  await h.operator.query('INSERT INTO identity.tech_bom(tenant_id,user_id,seat) VALUES($1,$2,1)',[ids.tenant,bomUser.id]);
}
export {sameBuProject,techA,techB};

export const regclass=async(h:Harness,name:string)=>(await h.operator.query<{t:string|null}>('SELECT to_regclass($1)::text AS t',[name])).rows[0].t;

export async function insertTarget(h:Harness,over:Partial<{project:string;kind:string;chat:string;topic:string;time:string;lead:number;enabled:boolean;source:string}>={}):Promise<string>{
  const r={project:ids.sales as string,kind:'golive_status',chat:groupSales,topic:'',time:'08:30',lead:1,enabled:true,source:'Quyết định thử',...over};
  return h.operator.transaction(async tx=>{
    await tx.query("SELECT set_config('libetech.reminder_source',$1,true)",[r.source]);
    return (await tx.query<{id:string}>(`INSERT INTO reminder_targets(tenant_id,project_id,kind,chat_id,topic_id,send_time,lead_days,enabled)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,[ids.tenant,r.project,r.kind,r.chat,r.topic,r.time,r.lead,r.enabled])).rows[0].id;
  });
}

export async function insertSeries(h:Harness,over:Partial<{project:string;title:string;weekday:number;time:string;enabled:boolean}>={}):Promise<string>{
  const r={project:ids.sales as string,title:'Họp BoM',weekday:4,time:'09:00',enabled:true,...over};
  return h.operator.transaction(async tx=>{
    await tx.query("SELECT set_config('libetech.reminder_source','Lịch gốc thử',true)");
    return (await tx.query<{id:string}>('INSERT INTO meeting_series(tenant_id,project_id,title,weekday,start_time,enabled) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
      [ids.tenant,r.project,r.title,r.weekday,r.time,r.enabled])).rows[0].id;
  });
}

export type AsRole='libetech_reminder'|'libetech_runtime'|'libetech_intake'|'libetech_identity'|'libetech_projector';
/** Runs fn as one application role with the transaction context a service would set. */
export function as<T>(h:Harness,role:AsRole,projects:string[],fn:(q:<R=Record<string,unknown>>(sql:string,p?:unknown[])=>Promise<R[]>)=>Promise<T>,person:string=reminderPrincipalId):Promise<T>{
  return h.operator.transaction(async tx=>{
    await tx.query(`SET LOCAL ROLE ${role}`);
    await tx.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.project_ids',$2,true),set_config('app.person_id',$3,true),set_config('app.intake_principal_id',$4,true)",
      [ids.tenant,projects.join(','),person,intakePrincipalId]);
    return fn(async<R=Record<string,unknown>>(sql:string,p?:unknown[])=>(await tx.query<R>(sql,p)).rows);
  });
}

/** One reminder row the way the scheduler writes it. */
export const reminderRow=(h:Harness,o:{target:string|null;project?:string;chat?:string;topic?:string;template?:string;dedupe?:string;reply?:string|null;scope?:string[];payload?:unknown})=>{
  const project=o.project??ids.sales,template=o.template??'reminder.golive_status';
  return as(h,'libetech_reminder',o.scope??[project],q=>q<{id:string}>(
    `INSERT INTO outbox_messages(tenant_id,project_id,reminder_target_id,event_id,event_type,trace_id,correlation_id,audience,target_chat_id,target_topic_id,reply_to_message_id,template,payload,dedupe_key)
     VALUES($1,$2,$3,$4,$5,$6,$7,'group',$8,$9,$10,$5,$12,$11) ON CONFLICT(tenant_id,dedupe_key) DO NOTHING RETURNING id`,
    [ids.tenant,project,o.target,randomUUID(),template,randomUUID(),randomUUID(),o.chat??groupSales,o.topic??'',o.reply??null,o.dedupe??'reminder:test:'+randomUUID(),
     JSON.stringify(o.payload??{params:{date:vnParts(new Date()).date}})]));
};
