import type {AttachmentState} from './types';
// Pure rules for Telegram intake. No I/O.
export const eventKey=(chatId:string,messageId:string)=>`telegram:${chatId}:${messageId}`;
export function threadKey(i:{messageId:string;mediaGroupId?:string;parentThreadKey?:string}):string {
 if(i.mediaGroupId) return 'g:'+i.mediaGroupId;
 if(i.parentThreadKey) return i.parentThreadKey;
 return 'm:'+i.messageId;
}
export function qualityScore(i:{forwarded:boolean;textTruncated:boolean;attachmentState?:AttachmentState}):number {
 let s=100;
 if(i.forwarded) s-=40;
 if(i.textTruncated) s-=20;
 if(i.attachmentState&&i.attachmentState!=='stored') s-=20;
 return Math.max(0,s);
}
const MASK='[đã che]';
const KW='token|secret|passw(?:or)?d|pwd|api[_\\s-]?key|private[_\\s-]?key|bearer';
const VALUE='("[^"]*"|\'[^\']*\'|\\S+)';
// Tokenizer for key/value pairs. KEY matches a key name of any length (letters, digits, _ and -, optionally
// preceded by "api " or "private ") + optional closing quote + : or =. It starts only where a name starts, so
// each name is scanned once: linear. The name is then tested for a keyword anywhere inside it
// (accessToken, DB_PASSWORD, X-API-Key). The value is not part of KEY: after a non-secret pair the scan resumes
// at the value, so "user=bob&password=x" and "Server=db;Password=x" still reach the secret key.
const KEY=/(?<![A-Za-z0-9_-])((?:(?:api|private)\s)?[A-Za-z0-9_-]+)(["']?\s*[:=]\s*)/gi;
const KW_IN_KEY=new RegExp(`(${KW})`,'i');
const VALUE_AT=new RegExp(VALUE,'y');
function maskKeyedValues(text:string):string {
 let out='',last=0;
 KEY.lastIndex=0;
 for(let m=KEY.exec(text);m;m=KEY.exec(text)){
  if(!KW_IN_KEY.test(m[1])) continue;
  VALUE_AT.lastIndex=KEY.lastIndex;
  const v=VALUE_AT.exec(text);
  if(!v) continue;
  out+=text.slice(last,KEY.lastIndex)+MASK;
  last=KEY.lastIndex=VALUE_AT.lastIndex;
 }
 return out+text.slice(last);
}
// A bare keyword followed by whitespace ("bearer abc"); prose such as "secretary meeting" or "tokens are" is untouched.
const SPACED=new RegExp(`((?<![A-Za-z0-9_])(?:${KW})\\s+)${VALUE}`,'gi');
const FORMATS:RegExp[]=[
 /\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}/g,
 /\bsk-[A-Za-z0-9_-]{20,}/g,
 /\bAKIA[0-9A-Z]{16}\b/g,
 /\bxox[abpr]-[A-Za-z0-9-]{10,}/g,
];
// JWT: three base64url segments whose head begins with eyJ at the start of the segment run or after '-'
// (where \beyJ used to start). One /\beyJ…/ attempt per '-eyJ' rescanned the whole run, quadratic on 'eyJ-' runs;
// DOTTED starts only at run starts, and a triple without a head resumes at its second segment.
const DOTTED=/(?<![A-Za-z0-9_-])([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const JWT_HEAD=/(?:^|-)eyJ./;
function maskJwt(text:string):string {
 let out='',last=0;
 DOTTED.lastIndex=0;
 for(let m=DOTTED.exec(text);m;m=DOTTED.exec(text)){
  const h=JWT_HEAD.exec(m[1]);
  if(!h){DOTTED.lastIndex=m.index+m[1].length+1;continue;}
  const start=m.index+h.index+(h[0].startsWith('-')?1:0);
  out+=text.slice(last,start)+MASK;
  last=m.index+m[0].length;
 }
 return out+text.slice(last);
}
// URL userinfo. The scheme run starts only where a run of scheme characters starts, so a run with no "://"
// ('a-a-a-…') is scanned once instead of once per letter.
const USERINFO=/((?<![a-z0-9+.-])[a-z0-9+.-]+:\/\/[^\s:\/@]+:)[^\s@\/]+(@)/gi;
export function redactSecrets(text:string):string {
 let t=maskKeyedValues(text).replace(SPACED,(_m,k:string)=>k+MASK).replace(USERINFO,(_m,a:string,b:string)=>a+MASK+b);
 for(const f of FORMATS) t=t.replace(f,MASK);
 return maskJwt(t);
}
export function cleanFileName(name:string):string {
 const last=name.split(/[\\/]/).pop()??'';
 return last.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,200);
}
export const MAX_ATTACHMENT_BYTES=20971520;
export const ALLOWED_MIME:ReadonlySet<string>=new Set([
 'image/jpeg','image/png','image/webp','application/pdf','text/plain','text/csv',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);
export function attachmentVerdict(a:{mimeType:string;sizeBytes:number}):'stored'|'too_large'|'unsupported_type' {
 if(!ALLOWED_MIME.has(a.mimeType.trim().toLowerCase())) return 'unsupported_type';
 if(a.sizeBytes>MAX_ATTACHMENT_BYTES) return 'too_large';
 return 'stored';
}
