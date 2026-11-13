import {readFile} from 'node:fs/promises';
import {z} from 'zod';
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
