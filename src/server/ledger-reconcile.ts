import {z} from 'zod';
import {scoped,type Database} from './db';
import {readable} from './inbox';
import {eventKey} from './intake-rules';
import type {Principal} from './types';

// Read-only comparison of the inbox with a ticket ledger (OQ-09 item 2). Writes nothing: no candidate, no ticket_ref, no state.
// The ledger rows come from the caller (synthetic fixtures in this slice). No reader of a real ledger exists here (OQ-26).
// Join key = eventKey(chatId,messageId); the topic/thread id is never part of it. The ledger `status` goes in, never out.
export type LedgerTicketRow={ticketId:string;chatId:string;messageId:string;threadId:string;status:string;createdAt:string};
export type InboxRow={sourceEventId:string;chatId:string;messageId:string;candidateId:string|null;ticketRef:string|null};
export type ReconcileReport={matched:{eventKey:string;sourceEventId:string;candidateId:string|null;ticketId:string;linked:boolean}[];
  onlyInInbox:{eventKey:string;sourceEventId:string}[];onlyInLedger:{eventKey:string;ticketId:string}[];
  conflicts:{eventKey:string;kind:'two_tickets_one_message'|'ticket_ref_mismatch';ticketIds:string[];ticketRef:string|null}[]};

export function reconcileLedger(inbox:InboxRow[],ledger:LedgerTicketRow[]):ReconcileReport {
  const byKey=new Map<string,InboxRow>();
  for(const r of inbox){const key=eventKey(r.chatId,r.messageId);if(!byKey.has(key)) byKey.set(key,r);}
  const tickets=new Map<string,Set<string>>();
  for(const t of ledger){const key=eventKey(t.chatId,t.messageId);(tickets.get(key)??tickets.set(key,new Set()).get(key)!).add(t.ticketId);}
  const rep:ReconcileReport={matched:[],onlyInInbox:[],onlyInLedger:[],conflicts:[]};
  for(const [key,r] of byKey){
    const ids=[...(tickets.get(key)??[])].sort();
    if(!ids.length) rep.onlyInInbox.push({eventKey:key,sourceEventId:r.sourceEventId});
    else if(ids.length>1) rep.conflicts.push({eventKey:key,kind:'two_tickets_one_message',ticketIds:ids,ticketRef:r.ticketRef});
    else if(r.ticketRef!==null&&r.ticketRef!==ids[0]) rep.conflicts.push({eventKey:key,kind:'ticket_ref_mismatch',ticketIds:ids,ticketRef:r.ticketRef});
    else rep.matched.push({eventKey:key,sourceEventId:r.sourceEventId,candidateId:r.candidateId,ticketId:ids[0],linked:r.ticketRef===ids[0]});
  }
  for(const [key,ids] of tickets) if(!byKey.has(key)) for(const ticketId of [...ids].sort()) rep.onlyInLedger.push({eventKey:key,ticketId});
  return rep;
}

const iso=z.string().datetime({offset:true});
const windowSchema=z.object({from:iso,to:iso}).strict().refine(w=>Date.parse(w.from)<=Date.parse(w.to),{message:'from must not be after to'});

// Window filters on source_events.observed_at (when the gateway saw the message), inclusive at both ends.
export async function inboxRows(db:Database,p:Principal,projectId:string,window:{from:string;to:string}):Promise<InboxRow[]> {
  const w=windowSchema.parse(window);
  const pid=z.string().uuid().parse(projectId);
  readable(p,pid);
  return scoped(db,p,async tx=>(await tx.query<{sid:string;chat_id:string;message_id:string;cid:string|null;ticket_ref:string|null}>(
    `SELECT e.id AS sid,e.chat_id,e.message_id,c.id AS cid,c.ticket_ref
     FROM source_events e
     LEFT JOIN LATERAL (SELECT id,ticket_ref FROM intake_candidates WHERE root_source_event_id=e.id ORDER BY created_at,id LIMIT 1) c ON true
     WHERE e.project_id=$1 AND e.observed_at>=$2 AND e.observed_at<=$3
     ORDER BY e.observed_at,e.id`,[pid,w.from,w.to])).rows
    .map(r=>({sourceEventId:r.sid,chatId:r.chat_id,messageId:r.message_id,candidateId:r.cid,ticketRef:r.ticket_ref})));
}
