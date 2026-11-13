import {readFile} from 'node:fs/promises';
import {z} from 'zod';
import {AppError} from './errors';
export type ChatScopes=Record<string,string[]>;
export type BridgeConfig={key:string;chatScopes:ChatScopes;intake?:{key:string;principalId:string;chats:string[]}};
const chatId=z.string().regex(/^-[1-9][0-9]*$/);
const schema=z.object({
 key:z.string().min(43),
 chatScopes:z.record(chatId,z.array(z.string().uuid())),
 intake:z.object({key:z.string().min(43),principalId:z.string().uuid(),chats:z.array(chatId)}).strict().optional(),
}).strict();
export function parseBridgeConfig(raw:unknown):BridgeConfig {
 const c=schema.parse(raw);
 if(c.intake) {
  if(c.intake.key===c.key) throw new Error('Intake key must differ from the bot key.');
  const allowed=new Set(Object.keys(c.chatScopes));
  if(!c.intake.chats.every(x=>allowed.has(x))) throw new Error('Intake chats must be a subset of chatScopes.');
 }
 return c;
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
