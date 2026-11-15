import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { loadFlaggedLinks, detailFailure } from '../src/server/review-page';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { ReviewDetailNoRevision } from '../src/components/review';
import { NO_REVISION_COPY } from '../src/components/review-view';
import { AppError } from '../src/server/errors';

// Round 1 of the tier-1 fix wave (W1): the dependency read of the Review detail page must not hide a failure.
describe('loadFlaggedLinks', () => {
  const links = { items: [{ id: 'x' }], total: 1 } as never;
  it('returns what the read returns', async () => {
    expect(await loadFlaggedLinks(async () => links)).toBe(links);
  });
  it('turns only SCOPE_DENIED into an empty list', async () => {
    expect(await loadFlaggedLinks(async () => { throw new AppError('SCOPE_DENIED', 'no', 404); })).toEqual({ items: [], total: 0 });
  });
  it('lets every other failure reach the error boundary instead of an empty list', async () => {
    const failures: unknown[] = [new Error('connection terminated'), new AppError('INTERNAL', 'x', 500), new AppError('SCOPE_DENIED_NOT', 'x'), new TypeError('boom'), 'text'];
    for (const f of failures) {
      await expect(loadFlaggedLinks(async () => { throw f; })).rejects.toBe(f);
    }
  });
  it('the page uses the helper and has no blanket or empty catch', async () => {
    for (const file of ['src/app/review/[documentId]/page.tsx', 'src/app/review/page.tsx']) {
      const src = await readFile(file, 'utf8');
      expect(src).not.toMatch(/\.catch\(\s*\(\s*\)\s*=>/);
      expect(src).not.toMatch(/catch\s*(\([^)]*\))?\s*\{\s*\}/);
    }
    expect(await readFile('src/app/review/[documentId]/page.tsx', 'utf8')).toContain('loadFlaggedLinks');
  });
});

// W15: a document without a revision, opened by URL, reads as a sentence and not as the error boundary.
describe('detailFailure', () => {
  it('maps SCOPE_DENIED and NO_REVISION only; everything else is rethrown', () => {
    expect(detailFailure(new AppError('SCOPE_DENIED', 'x', 404))).toBe('denied');
    expect(detailFailure(new AppError('NO_REVISION', 'Tài liệu chưa có bản nào để xét.', 409))).toBe('no_revision');
    for (const e of [new Error('x'), new AppError('REVISION_CONFLICT', 'x', 409), new AppError('INTERNAL', 'x', 500), 'text', null]) expect(detailFailure(e)).toBe('rethrow');
  });
  it('the sentence is the fixed one, with a way back to the list', () => {
    expect(NO_REVISION_COPY).toBe('Tài liệu này chưa có bản nào để review.');
    const out = renderToStaticMarkup(createElement(ReviewDetailNoRevision));
    expect(out).toContain('Tài liệu này chưa có bản nào để review.');
    expect(out).toContain('href="/review"');
    expect(out).not.toContain('Thử lại');
  });
  it('the page uses it', async () => {
    const src = await readFile('src/app/review/[documentId]/page.tsx', 'utf8');
    expect(src).toContain('detailFailure');
    expect(src).toContain('ReviewDetailNoRevision');
  });
});
