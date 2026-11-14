import {readFile} from 'node:fs/promises';
import {z} from 'zod';
import {AppError} from './errors';
export type ChatScopes=Record<string,string[]>;
export type BridgeConfig={key:string;chatScopes:ChatScopes;intake?:{key:string;principalId:string;chats:string[];excerptChats?:string[]}};
const chatId=z.string().regex(/^-[1-9][0-9]*$/);
const schema=z.object({
 key:z.string().min(43),
 chatScopes:z.record(chatId,z.array(z.string().uuid())),
 intake:z.object({key:z.string().min(43),principalId:z.string().uuid(),chats:z.array(chatId),excerptChats:z.array(chatId).optional()}).strict().optional(),
}).strict();
export function parseBridgeConfig(raw:unknown):BridgeConfig {
 const c=schema.parse(raw);
 if(c.intake) {
  if(c.intake.key===c.key) throw new Error('Intake key must differ from the bot key.');
  const allowed=new Set(Object.keys(c.chatScopes));
  if(!c.intake.chats.every(x=>allowed.has(x))) throw new Error('Intake chats must be a subset of chatScopes.');
  if(!(c.intake.excerptChats??[]).every(x=>c.intake!.chats.includes(x))) throw new Error('Intake excerpt chats must be a subset of intake chats.');
 }
 // A project id listed twice for one group is operator noise: lowercase (canonical uuid form), keep the first of each, in order (OQ-27 counts distinct projects).
 return {...c,chatScopes:Object.fromEntries(Object.entries(c.chatScopes).map(([k,v])=>[k,[...new Set(v.map(x=>x.toLowerCase()))]]))};
}
export async function loadBridgeConfig():Promise<BridgeConfig|null> {
 const file=process.env.LIBETECH_BRIDGE_CONFIG;
 if(!file) return null;
 return parseBridgeConfig(JSON.parse(await readFile(file,'utf8')));
}
/**
 * Config for a bridge route. Missing, unreadable, malformed or inconsistent config answers 503: the plugin spools and retries on
 * 5xx, while a 422 would make it drop the message as final (Security M1). Only a fixed code and the error class are logged.
 */
export async function requireBridgeConfig(code:'INTAKE_UNCONFIGURED'|'BRIDGE_UNCONFIGURED'):Promise<BridgeConfig> {
 let config:BridgeConfig|null=null;
 try {config=await loadBridgeConfig();}
 catch(error) {console.error(JSON.stringify({level:'error',event:'bridge_config_unreadable',code,errorType:error instanceof Error?error.name:'unknown'}));}
 if(!config) throw new AppError(code,code==='INTAKE_UNCONFIGURED'?'Tiếp nhận chưa được cấu hình.':'Cầu nối chưa được cấu hình.',503);
 return config;
}
/**
 * The operator's excerpt flag list, read for the Inbox each time it is built (OQ-30, 14/11/2026: stored text is hidden as soon as the
 * current config no longer allows it). Unset, unreadable, malformed or inconsistent config means no group is flagged (fail-closed).
 * Only the fixed event code and the error class are logged; never the path or the content.
 */
export async function currentExcerptChats():Promise<string[]> {
 try {
  const config=await loadBridgeConfig();
  return [...(config?.intake?.excerptChats??[])];
 } catch(error) {
  console.error(JSON.stringify({level:'error',event:'bridge_config_unreadable',code:'INBOX_EXCERPT_CONFIG',errorType:error instanceof Error?error.name:'unknown'}));
  return [];
 }
}
