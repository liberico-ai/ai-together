import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { pageState, approvedLabel, draftLabel, hashLabel, freshnessLabel, SOURCE_STATE_VIEW } from '../src/components/documents-view';
import { DocumentCard, SourceAvailability, DocumentsBody } from '../src/components/documents';
import type { DocumentIndexRow, SourceState } from '../src/server/types';

const row: DocumentIndexRow = { document_id: '11111111-1111-4111-8111-111111111111', project_id: '22222222-2222-4222-8222-222222222222', ref_code: 'XECA006', doc_type: 'plan',
  title: 'Nâng package theo npm audit', owner_label: '', source_type: 'drive', latest_revision_no: 2, approved_revision_no: null, hash_verification: 'self_declared',
  source_state: 'fresh', freeze_state: 'SOURCE_NOT_FROZEN', missing_count: 3, review_due_at: null, record_updated_at: '2026-11-12T01:00:00Z', projected_at: '2026-11-12T02:00:00Z' };
const STATES: SourceState[] = ['fresh', 'stale', 'unavailable', 'denied', 'not-configured', 'partially-received'];
const body = (state: Parameters<typeof DocumentsBody>[0]['state']) => renderToStaticMarkup(
  <DocumentsBody state={state} rows={[]} projectedAt={null} canRegister={false} error="Lỗi mạng" projectLabel="Dự án Bí Mật" />);

describe('documents UI', () => {
  it('pageState ranks loading, denied, error, empty, ready', () => {
    expect(pageState({ loading: true, error: 'x', denied: true, rows: 0 })).toBe('loading');
    expect(pageState({ loading: false, error: 'x', denied: true, rows: 0 })).toBe('denied');
    expect(pageState({ loading: false, error: 'x', denied: false, rows: 0 })).toBe('error');
    expect(pageState({ loading: false, error: null, denied: false, rows: 0 })).toBe('empty');
    expect(pageState({ loading: false, error: null, denied: false, rows: 2 })).toBe('ready');
  });
  it('each of the four non-ready states renders its own copy', () => {
    expect(body('loading')).toContain('aria-busy="true"');
    expect(body('loading')).not.toContain('>0<');
    expect(body('empty')).toContain('Chưa có tài liệu đã đăng ký');
    expect(body('error')).toContain('role="alert"');
    expect(body('error')).toContain('Thử lại');
    expect(body('denied')).toContain('Tài khoản chưa được cấp dự án này');
    expect(body('denied')).not.toContain('Dự án Bí Mật');
  });
  it('empty and denied are different text', () => {
    const e = body('empty'), d = body('denied');
    expect(e).not.toBe(d);
    expect(e).not.toContain('Tài khoản chưa được cấp dự án này');
    expect(d).not.toContain('Chưa có tài liệu đã đăng ký');
  });
  it('all six source states render distinct labels', () => {
    const out = STATES.map(s => renderToStaticMarkup(<SourceAvailability state={s} lastSuccessAt={null} />));
    expect(new Set(out).size).toBe(6);
    STATES.forEach((s, i) => expect(out[i]).toContain(SOURCE_STATE_VIEW[s].label));
    expect(SOURCE_STATE_VIEW.fresh.label).toBe('Nguồn vừa kiểm');
    expect(SOURCE_STATE_VIEW.denied.label).toBe('Không đủ quyền xem nguồn');
  });
  it('an empty approved pointer renders the neutral Chưa có tag', () => {
    const m = renderToStaticMarkup(<DocumentCard row={row} projectLabel="Xeca" canOpen />);
    expect(m).toMatch(/class="doc-tag-neutral"[^>]*>Bản chuẩn: Chưa có</);
    expect(m).not.toContain('đã duyệt');
    expect(m).toContain('r2 · Cần bổ sung');
  });
  it('a self-declared hash is never shown as verified', () => {
    const m = renderToStaticMarkup(<DocumentCard row={row} projectLabel="Xeca" canOpen />);
    expect(m).toContain('Hash tự khai — chưa kiểm');
    expect(m).not.toContain('Hash đã kiểm');
    expect(approvedLabel(null)).toBe('Chưa có');
    expect(draftLabel(null, 0)).toBe('Chưa có');
    expect(draftLabel(2, 0)).toBe('r2');
    expect(hashLabel(null)).toBe('Chưa có hash');
  });
  it('a stale projection is labelled', () => {
    expect(freshnessLabel('2026-11-12T01:00:00Z', '2026-11-12T02:00:00Z').startsWith('Chưa kiểm mới')).toBe(true);
    expect(freshnessLabel(null, '2026-11-12T02:00:00Z')).toBe('Chưa chiếu');
    expect(freshnessLabel('2026-11-12T03:00:00Z', '2026-11-12T02:00:00Z').startsWith('Chiếu lúc')).toBe(true);
  });
  it('denied source hides source metadata and the open action', () => {
    const m = renderToStaticMarkup(<SourceAvailability state="denied" lastSuccessAt="2026-11-12T01:00:00Z" />);
    expect(m).not.toContain('Kiểm lúc');
    const card = renderToStaticMarkup(<DocumentCard row={{ ...row, source_state: 'denied' }} projectLabel="Xeca" canOpen={false} />);
    expect(card).not.toContain('Mở nguồn');
  });
  it('long hashes and URLs do not force a fixed width', () => {
    const css = readFileSync('src/app/globals.css', 'utf8');
    const rules = [...css.matchAll(/([^{}]*\.doc-[^{}]*)\{([^{}]*)\}/g)];
    expect(rules.length).toBeGreaterThan(5);
    for (const [, , decl] of rules) for (const m of decl.matchAll(/(?:^|[;\s])(?:min-)?width\s*:\s*([^;}]+)/g)) {
      const v = m[1].trim();
      const px = /^(\d+(?:\.\d+)?)px$/.exec(v);
      expect(px ? Number(px[1]) <= 328 : /^(0|\d+%|auto)$/.test(v)).toBe(true);
    }
  });
});
