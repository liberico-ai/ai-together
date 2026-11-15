import { z } from 'zod';
import { BomService, type PendingCard } from './bom';
import type { Database } from './db';
import { ReviewService, uuid, type Eligibility, type ReviewItem } from './document-review';
import { AppError } from './errors';
import type { Principal } from './types';

// Decision cards (slice 3, Task 13): a read-only view over the review queue and the 3/3 reassignment ballot. It writes nothing and has no command:
// a review decision goes through ReviewService.decide with the exact revision, hash and record version; a ballot vote through BomService.command with the proposal id.
// A card is valid only while it is live: newest revision of its document, not decided; an open proposal. Anything else answers REVISION_CONFLICT,
// REVIEW_ALREADY_DECIDED or PROPOSAL_CLOSED at the command, never a silent yes on a different card.
export type ReviewCard = { kind: 'document_review'; decisionId: string; projectId: string; documentId: string; refCode: string; title: string;
  revision: { id: string; no: number; hash: string | null; recordVersion: number }; summary: string; quorum: { needed: 1; have: 0 | 1 };
  votes: { actorId: string; choice: 'approved' | 'changes_requested'; at: string }[]; actorEligibility: Eligibility; expiresAt: null;
  appliedReceipt: { decisionId: string; approvedRevisionId: string; at: string } | null; state: 'open' | 'changes_requested' | 'approved' };
export type ReassignmentCard = { kind: 'reassignment'; decisionId: string; projectId: string; workId: string; workCode: string; title: string;
  revision: { workVersion: number }; summary: string; quorum: { needed: 3; have: number }; votes: { actorId: string; choice: 'agree' | 'reject' | 'revise'; at: string }[];
  actorEligibility: { canVote: boolean; reason: 'ALREADY_VOTED' | 'CLOSED' | 'EXPIRED' | null }; expiresAt: string; appliedReceipt: { workVersion: number; at: string } | null;
  state: 'pending' | 'quorum_met' | 'applied' | 'rejected' | 'revise' | 'cancelled' | 'expired' | 'reconcile' };
export type DecisionCard = ReviewCard | ReassignmentCard;

const listSchema = z.object({ projectId: uuid }).strict();
const TERMINAL = ['rejected', 'revise', 'cancelled', 'expired', 'reconcile'] as const;

/** The three events «enough votes», «applied» and «receipt» stay separate facts. `applied` only with a receipt on a stored `applied` proposal; an unknown or
 * inconsistent combination reads `reconcile` (fail closed), never `applied`. */
export function reassignmentState(i: { state: string; agree: number; hasReceipt: boolean }): ReassignmentCard['state'] {
  if (i.state === 'applied') return i.hasReceipt ? 'applied' : i.agree >= 3 ? 'quorum_met' : 'reconcile';
  if (i.hasReceipt) return 'reconcile';
  if (i.state === 'pending') return i.agree >= 3 ? 'quorum_met' : 'pending';
  return (TERMINAL as readonly string[]).includes(i.state) ? i.state as ReassignmentCard['state'] : 'reconcile';
}

function reviewCard(item: ReviewItem): ReviewCard {
  const d = item.decision;
  const applied = d?.result === 'approved' && item.approvedRevisionId === item.revision.id;   // the pointer is the fact; the decision row only names the receipt
  return {
    kind: 'document_review', decisionId: item.revision.id, projectId: item.projectId, documentId: item.documentId, refCode: item.refCode, title: item.title,
    revision: { id: item.revision.id, no: item.revision.revisionNo, hash: item.revision.sourceHash, recordVersion: item.recordVersion },
    summary: item.revision.changes.summary, quorum: { needed: 1, have: d?.result === 'approved' ? 1 : 0 },
    votes: d ? [{ actorId: d.decidedBy, choice: d.result, at: d.decidedAt }] : [],
    actorEligibility: item.eligibility, expiresAt: null,
    appliedReceipt: applied ? { decisionId: d!.id, approvedRevisionId: item.revision.id, at: d!.decidedAt } : null,
    state: d ? d.result : 'open',
  };
}

/** Pure; exported so the viewer-id handling can be tested without a database. */
export function reassignmentCard(p: Principal, c: PendingCard, now: number): ReassignmentCard {
  const agree = c.votes.filter(v => v.choice === 'agree').length;
  const me = p.id.toLowerCase();   // one normalised id for the vote check and the seat check
  const mine = c.votes.some(v => v.voter_id.toLowerCase() === me);
  const reason: ReassignmentCard['actorEligibility']['reason'] =
    c.proposal.state !== 'pending' ? 'CLOSED' : new Date(c.proposal.expires_at).getTime() <= now ? 'EXPIRED' : mine ? 'ALREADY_VOTED' : null;
  return {
    kind: 'reassignment', decisionId: c.proposal.id, projectId: c.proposal.project_id, workId: c.work.id, workCode: c.work.code, title: c.work.title,
    revision: { workVersion: c.proposal.work_version }, summary: c.proposal.reason, quorum: { needed: 3, have: agree },
    votes: c.votes.map(v => ({ actorId: v.voter_id, choice: v.choice, at: v.created_at })),
    actorEligibility: { canVote: reason === null && c.proposal.seat_ids.includes(me), reason }, expiresAt: c.proposal.expires_at,
    appliedReceipt: c.receipt ? { workVersion: c.receipt.work_version, at: c.receipt.created_at } : null,
    state: reassignmentState({ state: c.proposal.state, agree, hasReceipt: c.receipt !== null }),
  };
}

export class DecisionService {
  private review: ReviewService;
  private bom: BomService;
  constructor(db: Database) { this.review = new ReviewService(db); this.bom = new BomService(db); }

  async list(p: Principal, raw: unknown): Promise<{ cards: DecisionCard[] }> {
    const input = listSchema.parse(raw);
    // one page of the maximum size; a project with more documents than that is cut at 200 (known cap)
    const { items } = await this.review.queue(p, { projectId: input.projectId, limit: 200, offset: 0 });
    const cards: DecisionCard[] = items.map(reviewCard);
    let pending: PendingCard[] = [];
    try { pending = await this.bom.pending(p, input.projectId); }
    catch (e) { if (!(e instanceof AppError && e.code === 'SCOPE_DENIED')) throw e; }   // not a seat: no 3/3 card, no count, no reason
    const now = Date.now();
    for (const c of pending) cards.push(reassignmentCard(p, c, now));
    return { cards };
  }
}
