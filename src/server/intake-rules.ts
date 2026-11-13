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
const SECRET=/\b(token|secret|password|passwd|api[_-]?key|bearer)((?:\s*[:=]\s*)|\s+)("[^"]*"|'[^']*'|\S+)/gi;
export function redactSecrets(text:string):string { return text.replace(SECRET,(_m,k:string,sep:string)=>`${k}${sep}[đã che]`); }
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
