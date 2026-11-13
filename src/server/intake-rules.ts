import type {AttachmentState} from './types';
import {AppError} from './errors';
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
// Tokenizer for key/value pairs. KEY matches a key name of any length (letters, digits, _ and -) + optional
// closing quote + : or =. A name whose word ends in "api" or "private" may continue over one whitespace into a
// word starting with "key" (the only whitespace the keyword list allows, api[_\s-]?key / private[_\s-]?key), so
// "X-Api Key", "OpenAI_API KEY" and "Stripe-Private Key" stay one name. KEY starts only where a name starts, and
// each alternative scans a word once plus a bounded check at its end: linear. The name is then tested for a
// keyword anywhere inside it (accessToken, DB_PASSWORD, X-API-Key). The value is not part of KEY: after a
// non-secret pair the scan resumes at the value, so "user=bob&password=x" and "Server=db;Password=x" still reach
// the secret key.
const KEY=/(?<![A-Za-z0-9_-])([A-Za-z0-9_-]*(?:api|private)\skey[A-Za-z0-9_-]*|[A-Za-z0-9_-]+)(["']?\s*[:=]\s*)/gi;
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
// One linking word may sit between ("password is abc", "secret là abc"): the value after it is masked, not the word.
const LINK='(?:is|là|la)';
const SPACED=new RegExp(`((?<![A-Za-z0-9_])(?:${KW})\\s+(?:${LINK}\\s+)?)${VALUE}`,'gi');
// How the team writes a credential in its own words (Security I1). Every keyword is bounded by letters and digits on both
// sides (a "_" or "-" before it is allowed: DB_PASS, wifi-pass), so "mkdir", "bypass", "passenger" are not keywords.
// - mật khẩu / mat khau / passcode are unambiguous: one qualifier word may follow ("mật khẩu wifi"), then ":" / "=" or a
//   linking word. Without a separator ("mật khẩu mới đã đổi") nothing is masked.
// - mk (also slang for "mình"), pass ("pass qua") and otp are ambiguous: they need ":" or "=", with at most one qualifier
//   word; otp alone also takes a linking word ("mã OTP là 123456"). "pin" is left out: in Vietnamese it is a battery.
// Each attempt starts at a keyword and scans at most one word plus a separator: linear.
const WORD='[\\p{L}\\p{N}_-]+',EDGE='(?![\\p{L}\\p{N}_-])';
const PLAIN=new RegExp('((?<![\\p{L}\\p{N}])(?:'
 +`(?:mật\\s*khẩu|mat\\s*khau|passcode)${EDGE}(?:\\s+${WORD})?(?:\\s*[:=]\\s*|\\s+${LINK}\\s+)`
 +`|(?:mk|pass|otp)${EDGE}(?:\\s+${WORD})?\\s*[:=]\\s*`
 +`|otp\\s+${LINK}\\s+`
 +'))'+VALUE,'giu');
// HTTP Basic credentials: always after an Authorization header; elsewhere only when the token looks encoded (a digit,
// + / =, or a lower-to-upper case change), so "Basic training" stays prose.
const AUTH_BASIC=/(authorization["']?\s*[:=]\s*["']?\s*basic\s+)[A-Za-z0-9+/]+=*/gi;
const BARE_BASIC=/(\bBasic\s+)([A-Za-z0-9+/]{8,}=*)(?![A-Za-z0-9+/=])/g;
const ENCODED=/[0-9+/=]|[a-z][A-Z]/;
// A PEM private-key block, header to footer. With no footer (the excerpt is cut at 4096 characters before this runs)
// the rest of the text is masked: a partial key is still a key. One attempt per header, and a footer-less one ends the scan.
const PEM=/-----BEGIN [A-Z0-9 ]{0,40}PRIVATE KEY-----(?:[\s\S]*?-----END [A-Z0-9 ]{0,40}PRIVATE KEY-----|[\s\S]*$)/g;
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
 let t=maskKeyedValues(text.replace(PEM,MASK)).replace(SPACED,(_m,k:string)=>k+MASK).replace(PLAIN,(_m,k:string)=>k+MASK)
  .replace(AUTH_BASIC,(_m,k:string)=>k+MASK).replace(BARE_BASIC,(m,k:string,v:string)=>ENCODED.test(v)?k+MASK:m)
  .replace(USERINFO,(_m,a:string,b:string)=>a+MASK+b);
 for(const f of FORMATS) t=t.replace(f,MASK);
 return maskJwt(t);
}
/** Last path segment, without C0 controls, DEL and Unicode format characters (Cf: bidi overrides and isolates, LRM/RLM,
 * zero-width marks, BOM), so a right-to-left override cannot make "…fdp.exe" read as "…exe.pdf" in the Inbox (Sec M4). */
export function cleanFileName(name:string):string {
 const last=name.split(/[\\/]/).pop()??'';
 return last.replace(/[\u0000-\u001f\u007f\p{Cf}]/gu,'').slice(0,200);
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

export type CandidateState='new'|'needs_info'|'confirmed'|'duplicate'|'dismissed';
export type CandidateAction='confirm'|'need_info'|'mark_duplicate'|'dismiss'|'reopen'|'link_ticket';
const CANDIDATE_MOVES:Record<CandidateState,Partial<Record<CandidateAction,CandidateState>>>={
 new:{confirm:'confirmed',need_info:'needs_info',mark_duplicate:'duplicate',dismiss:'dismissed'},
 // needs_info + need_info: the manager asks again; the new list replaces the old one and the move is its own audit event.
 needs_info:{confirm:'confirmed',need_info:'needs_info',mark_duplicate:'duplicate',dismiss:'dismissed',reopen:'new'},
 confirmed:{reopen:'new'},duplicate:{reopen:'new'},dismissed:{reopen:'new'},
};
/** Sole decision of what a PM action does to a candidate (E-INT-05). link_ticket keeps the state. No action creates, assigns, closes or accepts work. */
export function candidateTransition(state:CandidateState,action:CandidateAction):CandidateState {
 if(action==='link_ticket') return state;
 const next=CANDIDATE_MOVES[state]?.[action];
 if(!next) throw new AppError('CANDIDATE_TRANSITION_INVALID','Không thực hiện được thao tác này ở trạng thái hiện tại.',409);
 return next;
}
