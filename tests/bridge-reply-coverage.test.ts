// GIAO VIỆC 5 D: «mỗi mã lỗi một câu trả lời đúng» — every code the bridge path can throw at the bot has its own sentence in the plugin's table.
// The list is read from the server sources, so a new code on these paths fails here until the bot has a sentence for it.
import {expect,test} from 'vitest';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

const source=(file:string)=>readFile(path.join(process.cwd(),file),'utf8');
const codes=(text:string)=>[...text.matchAll(/'([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)'/g)].map(m=>m[1]);
/** One class member of identity.ts, from its header to the next member. */
function member(text:string,header:string):string{
 const start=text.indexOf(header);expect(start,header).toBeGreaterThan(-1);
 const next=text.slice(start+header.length).search(/\n (?:private )?(?:async )?[a-zA-Z]+\(/);
 return text.slice(start,next<0?undefined:start+header.length+next);
}

test('every refusal code on the bridge path has a sentence in the plugin reply table',async()=>{
 const identity=await source('src/server/identity.ts');
 const thrown=new Set([
  ...codes(await source('src/server/bridge.ts')),...codes(await source('src/server/bridge-auth.ts')),...codes(await source('src/server/account-approval.ts')),
  ...codes(member(identity,' async throttle(')),...codes(member(identity,' private async principal(')),
  ...codes(member(identity,' async pair(')),...codes(member(identity,' async telegramPrincipal(')),
  'BRIDGE_UNCONFIGURED','IDENTITY_UNAVAILABLE','INVALID_INPUT','INTERNAL_ERROR',
 ]);
 // `reason` words, not codes
 for(const reason of ['CHAT_SOURCE_INVALID','NO_PROJECT_YET','NOT_PROJECT_MEMBER','CHAT_NOT_MAPPED','RECORD_NOT_FOUND']) thrown.delete(reason);
 const plugin=await source('bot-plugin/__init__.py');
 const table=plugin.slice(plugin.indexOf('\nREPLIES = {'),plugin.indexOf('\nSCOPE_REPLIES'));
 const known=new Set([...table.matchAll(/^ {4}"([A-Z0-9_]+)":/gm)].map(m=>m[1]));
 known.add('SCOPE_DENIED');// answered from SCOPE_REPLIES by reason and status
 expect(thrown.size).toBeGreaterThan(10);
 expect([...thrown].filter(code=>!known.has(code)).sort()).toEqual([]);
});
