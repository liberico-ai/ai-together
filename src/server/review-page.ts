import { AppError } from './errors';
import type { DependencyView } from './document-dependencies';

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
