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
const VALUE='("[^"]*"|\'[^\']*\'|[^\\s"\',;}]+)';
// Compound key names (OPENAI_API_KEY, DB_PASSWORD, "password":) followed by an optional closing quote and : or =.
const KEYED=new RegExp(`((?<![A-Za-z0-9])[A-Za-z0-9_]*(?:${KW})[A-Za-z0-9_]*["']?\\s*[:=]\\s*)${VALUE}`,'gi');
// A bare keyword followed by whitespace ("bearer abc"); prose such as "secretary meeting" or "tokens are" is untouched.
const SPACED=new RegExp(`((?<![A-Za-z0-9_])(?:${KW})\\s+)${VALUE}`,'gi');
const FORMATS:RegExp[]=[
 /\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}/g,
 /\bsk-[A-Za-z0-9_-]{20,}/g,
 /\bAKIA[0-9A-Z]{16}\b/g,
 /\bxox[abpr]-[A-Za-z0-9-]{10,}/g,
 /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
];
const USERINFO=/(\b[a-z][a-z0-9+.-]*:\/\/[^\s:\/@]+:)[^\s@\/]+(@)/gi;
export function redactSecrets(text:string):string {
 let t=text.replace(KEYED,(_m,k:string)=>k+MASK).replace(SPACED,(_m,k:string)=>k+MASK).replace(USERINFO,(_m,a:string,b:string)=>a+MASK+b);
 for(const f of FORMATS) t=t.replace(f,MASK);
 return t;
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
