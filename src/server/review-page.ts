import { AppError } from './errors';
import type { DependencyView } from './document-dependencies';
import type { DocApprovalProposal } from './doc-approval-proposals';

// Helpers of the Review pages, kept out of the page files so they can be tested without rendering.

type Links = { items: DependencyView[]; total: number };

/** The flagged-dependency read of the detail page. Only a scope denial reads as «no links»; any other failure propagates to the error boundary. */
export async function loadFlaggedLinks(read: () => Promise<Links>): Promise<Links> {
  try { return await read(); }
  catch (e) {
    if (e instanceof AppError && e.code === 'SCOPE_DENIED') return { items: [], total: 0 };
    throw e;
  }
}

/** What the detail page does with a failure of `ReviewService.detail`: a scope denial and a document without a revision have their own screens; the rest reaches the error boundary. */
export function detailFailure(e: unknown): 'denied' | 'no_revision' | 'rethrow' {
  if (e instanceof AppError && e.code === 'SCOPE_DENIED') return 'denied';
  if (e instanceof AppError && e.code === 'NO_REVISION') return 'no_revision';
  return 'rethrow';
}

/** What the queue page hands the proposal block (Task 7c, step 16b). Data only, never a function (tests/rsc-boundary.test.ts). */
export type ProposalsInitial = { state: 'ready'; items: DocApprovalProposal[]; canPropose: boolean } | { state: 'denied' } | { state: 'admin' } | { state: 'error' };

/**
 * The account admin is answered without a read (T7C-4: the admin proposes on /team). Everyone else is read, coordinator or not: any reader of the
 * project may be a person who proposed and has since lost the manager role (decision OQ-50 c). A scope refusal is the denied state; any other
 * failure, a synchronous throw of `read` included, is the error state with one JSON log line that carries no name and no basis. Never throws, so
 * the page needs no catch of its own.
 */
export async function loadOwnProposals(who: { coordinator: boolean; accountAdmin: boolean }, read: () => Promise<DocApprovalProposal[]>): Promise<ProposalsInitial> {
  if (who.accountAdmin) return { state: 'admin' };
  try { return { state: 'ready', items: await read(), canPropose: who.coordinator }; }
  catch (e) {
    if (e instanceof AppError && e.code === 'SCOPE_DENIED') return { state: 'denied' };
    console.error(JSON.stringify({ level: 'error', event: 'doc_approval_proposals_unavailable', errorType: e instanceof Error ? e.name : 'unknown' }));
    return { state: 'error' };
  }
}
