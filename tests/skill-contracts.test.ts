import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ID_FIELDS, MAX_OUTPUT_BYTES, MINIMUM_DOSSIER, SKILLS, checkSkillOutput, contextSchema, namedIds, namedRevisions, outputFits, outputSchemas } from '../src/server/skill-contracts';
import type { ContextSource, SkillContext, SkillName } from '../src/server/skill-contracts';

// Synthetic fixtures only. Ids are short labels, not real identifiers.
const ctx = (over: Partial<SkillContext> = {}): SkillContext => ({
  skill: 'intake_analyst', projectId: 'p1', pointerOnly: false,
  sources: [
    { id: 'e1', kind: 'source_event', ref: 'ref-1', mode: 'excerpt', text: 'synthetic text', hash: 'h1', observedAt: '2026-11-15T00:00:00.000Z', forwarded: false, revisionNo: 1 },
    { id: 'e2', kind: 'source_event', ref: 'ref-2', mode: 'hidden', text: null, hash: null, observedAt: '2026-11-15T00:00:00.000Z', forwarded: false, revisionNo: 2 },
    { id: 'e3', kind: 'source_event', ref: 'ref-3', mode: 'pointer_only', text: null, hash: null, observedAt: '2026-11-15T00:00:00.000Z', forwarded: true, revisionNo: 1 },
    { id: 'd1', kind: 'document', refCode: 'DOC-1', docType: 'guide', title: 'Synthetic guide', latestRevisionId: 'r2', approvedRevisionId: 'r1' },
    { id: 'r1', kind: 'document_revision', documentId: 'd1', revisionNo: 1, summary: 'first', present: ['a'], missing: [], sourceHash: null, hashVerification: 'self_declared' },
    { id: 'r2', kind: 'document_revision', documentId: 'd1', revisionNo: 2, summary: 'second', present: ['a', 'b'], missing: ['c'], sourceHash: 'h2', hashVerification: 'verified' },
  ],
  ...over,
});
const HASH = 'manifest-hash-1';
const manifest = (name: SkillName, toolAllowlist: readonly string[] = []) => ({ name, hash: HASH, toolAllowlist });

// OQ-53 Task 4: the three skills that receive messages state the revision number of every message whose text they were shown (e1 is the one shown message of the fixture context);
// the other three have no such field.
const MESSAGE_SKILLS: readonly SkillName[] = ['intake_analyst', 'ba_elicitation', 'pm_planning'];
const OTHER_SKILLS: readonly SkillName[] = SKILLS.filter(s => !MESSAGE_SKILLS.includes(s));
const base = (skill: SkillName, result: unknown) => ({
  skill, manifestHash: HASH, sources: [{ id: 'e1' }, { id: 'r1' }], claims: [{ field: 'f', value: 'v', basis: ['e1'] }],
  questions: [{ field: 'f', question: 'q?' }], conflicts: [{ field: 'f', sourceIds: ['e1', 'r1'], note: 'n' }], confidence: 80, toolRequests: [] as { tool: string }[], result,
  ...(MESSAGE_SKILLS.includes(skill) ? { messageRevisions: [{ id: 'e1', revisionNo: 1 }] } : {}),
});
// Every array holds an element and every nullable string is filled, so each string leaf can be probed.
const results: Record<SkillName, unknown> = {
  intake_analyst: { classification: 'incident', duplicateOf: 'e1', missingFields: ['owner'] },
  ba_elicitation: { userStories: [{ text: 's', basis: ['e1'] }], rules: [{ text: 'r', basis: ['e1'] }], acceptance: [{ text: 'a', basis: ['e1'] }], unknowns: ['u'] },
  pm_planning: { milestones: [{ title: 't', basis: ['e1'], estimate: '2 weeks' }], actions: [{ text: 'a', basis: ['e1'] }], decisionsNeeded: ['d'] },
  technical_writer: { sections: [{ heading: 'h', text: 't', basis: ['e1'] }], terms: [{ term: 't', meaning: 'm', basis: ['e1'] }] },
  doc_reviewer: { baseRevisionId: 'r1', candidateRevisionId: 'r2', diff: [{ section: 's', change: 'modified', note: 'n' }], impacts: ['i'], missing: ['m'], scopeRead: 'all' },
  release_librarian: { approvedRevisionId: 'r1', index: [{ documentId: 'd1', revisionId: 'r1' }], staleReminders: [{ documentId: 'd1', note: 'n' }] },
};
const clean = (skill: SkillName) => base(skill, structuredClone(results[skill]));
const check = (skill: SkillName, raw: unknown, allow: readonly string[] = [], c?: SkillContext) => checkSkillOutput(manifest(skill, allow), c ?? ctx({ skill }), raw);

describe('skill contracts', () => {
  it('a clean output of each of the six skills is accepted', () => {
    expect(SKILLS).toHaveLength(6);
    for (const s of SKILLS) {
      const r = check(s, clean(s));
      expect(r, s).toMatchObject({ verdict: 'accept', reasons: [] });
      expect(r.output).not.toBeNull();
    }
  });

  it('every skill has a strict output contract; unknown keys are rejected', () => {
    for (const s of SKILLS) for (const k of ['policy', 'assignee', 'dueAt', 'approve', 'delivered']) {
      const top = { ...clean(s), [k]: 'x' };
      expect(check(s, top), `${s} top ${k}`).toEqual({ verdict: 'hold', reasons: ['SCHEMA_INVALID'], output: null });
      const inner = clean(s); (inner.result as Record<string, unknown>)[k] = 'x';
      expect(check(s, inner), `${s} result ${k}`).toEqual({ verdict: 'hold', reasons: ['SCHEMA_INVALID'], output: null });
      expect(outputSchemas[s].safeParse(inner).success).toBe(false);
    }
    const nested = clean('release_librarian'); (nested.result as { index: Record<string, unknown>[] }).index[0].delivered = true;
    expect(check('release_librarian', nested).reasons).toEqual(['SCHEMA_INVALID']);
    const claim = clean('intake_analyst'); (claim.claims[0] as Record<string, unknown>).assignee = 'x';
    expect(check('intake_analyst', claim).reasons).toEqual(['SCHEMA_INVALID']);
  });

  it('the context schema is strict', () => {
    expect(contextSchema.safeParse(ctx()).success).toBe(true);
    expect(contextSchema.safeParse({ ...ctx(), extra: 1 }).success).toBe(false);
    const c = ctx(); (c.sources[0] as Record<string, unknown>).extra = 1;
    expect(contextSchema.safeParse(c).success).toBe(false);
    expect(contextSchema.safeParse({ ...ctx(), sources: [{ id: 'x', kind: 'other' }] }).success).toBe(false);
  });

  it('C2 the context schema refuses a message source without a revision number', () => {
    // a message source with a whole number of its revision is accepted (positive control: the fixtures above carry one)
    const msgs = ctx().sources.filter(s => s.kind === 'source_event');
    expect(msgs).toHaveLength(3);
    for (const m of msgs) {
      expect(contextSchema.safeParse(ctx({ sources: [m] })).success, `${m.id} with its number`).toBe(true);
      // the number is not optional: a source without it is refused, in every display mode
      const { revisionNo, ...without } = m as typeof m & { revisionNo: number };
      expect(revisionNo, `${m.id} fixture`).toBeGreaterThanOrEqual(1);
      expect(contextSchema.safeParse(ctx({ sources: [without as never] })).success, `${m.id} without it`).toBe(false);
      // and it is a whole number from 1 (the table holds revision_no > 0): not a string, a fraction, null or a boolean, and not 0 or a negative number
      for (const bad of ['1', 1.5, null, true, undefined, [1], 0, -1, -2147483648])
        expect(contextSchema.safeParse(ctx({ sources: [{ ...m, revisionNo: bad } as never] })).success, `${m.id} revisionNo ${JSON.stringify(bad)}`).toBe(false);
    }
    // a context with one message source lacking the number among well-formed ones is refused as a whole
    const mixed = ctx(); delete (mixed.sources[1] as Record<string, unknown>).revisionNo;
    expect(contextSchema.safeParse(mixed).success).toBe(false);
    // the other two kinds are unchanged by this field: a document and a revision of one carry no `revisionNo` of a message, and the revision of a document keeps its own
    const docOnly = ctx().sources.filter(s => s.kind === 'document');
    expect(contextSchema.safeParse(ctx({ sources: docOnly })).success).toBe(true);
    expect(contextSchema.safeParse(ctx({ sources: [{ ...docOnly[0], revisionNo: 1 } as never] })).success, 'a document does not take a revision number').toBe(false);
  });

  it('a manifest mismatch of skill or hash is held', () => {
    expect(check('intake_analyst', { ...clean('intake_analyst'), skill: 'pm_planning' }).reasons).toEqual(['MANIFEST_MISMATCH']);
    expect(check('intake_analyst', { ...clean('intake_analyst'), manifestHash: 'other' }).reasons).toEqual(['MANIFEST_MISMATCH']);
  });

  it('an output without sources is held', () => {
    const r = check('intake_analyst', { ...clean('intake_analyst'), sources: [], claims: [], conflicts: [] });
    expect(r).toEqual({ verdict: 'hold', reasons: ['SOURCE_REQUIRED'], output: null });
  });

  it('a claim or section without basis is held', () => {
    const c = clean('intake_analyst'); c.claims[0].basis = [];
    expect(check('intake_analyst', c).reasons).toEqual(['UNSOURCED_CLAIM']);
    for (const [s, path] of [['ba_elicitation', 'userStories'], ['ba_elicitation', 'rules'], ['ba_elicitation', 'acceptance'], ['pm_planning', 'milestones'], ['pm_planning', 'actions'], ['technical_writer', 'sections'], ['technical_writer', 'terms']] as const) {
      const o = clean(s); ((o.result as Record<string, { basis: string[] }[]>)[path])[0].basis = [];
      expect(check(s, o).reasons, `${s}.${path}`).toEqual(['UNSOURCED_CLAIM']);
    }
  });

  it('a cited id outside the context is held', () => {
    const where: [string, (o: ReturnType<typeof clean>) => void][] = [
      ['sources', o => { o.sources = [{ id: 'e1' }, { id: 'r1' }, { id: 'zzz' }]; }],
      ['claim basis', o => { o.claims[0].basis = ['zzz']; }],
      ['conflict sourceIds', o => { o.conflicts[0].sourceIds = ['e1', 'zzz']; }],
      ['result basis', o => { ((o.result as { userStories: { basis: string[] }[] }).userStories ?? [{ basis: [] }])[0].basis = ['zzz']; }],
    ];
    for (const [name, f] of where) {
      const o = clean('ba_elicitation'); f(o);
      expect(check('ba_elicitation', o).reasons, name).toEqual(['SOURCE_OUT_OF_CONTEXT']);
    }
    const dup = clean('intake_analyst'); (dup.result as { duplicateOf: string }).duplicateOf = 'zzz';
    expect(check('intake_analyst', dup).reasons).toEqual(['SOURCE_OUT_OF_CONTEXT']);
    for (const k of ['baseRevisionId', 'candidateRevisionId']) {
      const o = clean('doc_reviewer'); (o.result as Record<string, string>)[k] = 'zzz';
      expect(check('doc_reviewer', o).reasons, k).toEqual(['SOURCE_OUT_OF_CONTEXT']);
    }
    for (const k of ['documentId', 'revisionId']) {
      const o = clean('release_librarian'); (o.result as { index: Record<string, string>[] }).index[0][k] = 'zzz';
      expect(check('release_librarian', o).reasons, k).toEqual(['SOURCE_OUT_OF_CONTEXT', 'NOT_APPROVED_REVISION']);
    }
  });

  it('a claim based on a hidden or pointer-only message is held', () => {
    for (const id of ['e2', 'e3']) {
      const o = { ...clean('intake_analyst'), sources: [{ id: 'e1' }, { id: 'r1' }, { id }] }; o.claims[0].basis = [id];
      expect(check('intake_analyst', o), id).toEqual({ verdict: 'hold', reasons: ['TEXT_NOT_VISIBLE'], output: null });
      const p = { ...clean('pm_planning'), sources: [{ id: 'e1' }, { id: 'r1' }, { id }] }; (p.result as { actions: { basis: string[] }[] }).actions[0].basis = [id];
      expect(check('pm_planning', p).reasons, `result ${id}`).toEqual(['TEXT_NOT_VISIBLE']);
    }
  });

  it('DOC-15 a tool request outside the allowlist is held and the manifest object is unchanged', () => {
    const m = Object.freeze({ name: 'intake_analyst' as const, hash: HASH, toolAllowlist: Object.freeze([] as string[]) });
    const o = { ...clean('intake_analyst'), toolRequests: [{ tool: 'shell.exec' }] };
    const r = checkSkillOutput(m, ctx(), o);
    expect(r).toEqual({ verdict: 'hold', reasons: ['TOOL_NOT_ALLOWED'], output: null });
    expect(m.toolAllowlist).toEqual([]);
    expect(check('intake_analyst', o, ['shell.exec']).verdict).toBe('accept');
  });

  it('release_librarian can only name the approved revision of a document in context', () => {
    const wrong = clean('release_librarian'); (wrong.result as { approvedRevisionId: string }).approvedRevisionId = 'r2';
    expect(check('release_librarian', wrong).reasons).toEqual(['NOT_APPROVED_REVISION']);
    const none = clean('release_librarian'); (none.result as { approvedRevisionId: string | null }).approvedRevisionId = null;
    expect(check('release_librarian', none).verdict).toBe('accept');
    expect(check('release_librarian', clean('release_librarian')).verdict).toBe('accept');
  });

  it('the minimum dossier lists six work types with the items of SPEC-009', () => {
    expect(Object.keys(MINIMUM_DOSSIER).sort()).toEqual(['document_support', 'feature', 'incident', 'new_product', 'small_bug', 'technical_upgrade']);
    for (const v of Object.values(MINIMUM_DOSSIER)) expect(v.length).toBeGreaterThan(0);
    expect(MINIMUM_DOSSIER.incident).toEqual(['Intake', 'impact', 'hành động khôi phục', 'cách kiểm', 'receipt', 'phần còn nợ']);
    expect(MINIMUM_DOSSIER.new_product).toHaveLength(6);
  });

  it('reasons are complete and ordered', () => {
    const o = { ...clean('intake_analyst'), manifestHash: 'other', sources: [], toolRequests: [{ tool: 'x' }] };
    expect(check('intake_analyst', o).reasons).toEqual(['MANIFEST_MISMATCH', 'SOURCE_REQUIRED', 'UNSOURCED_CLAIM', 'TOOL_NOT_ALLOWED']);
    const all = clean('release_librarian');
    all.manifestHash = 'other'; all.sources = [];
    all.claims = [{ field: 'a', value: 'v', basis: ['zzz'] }, { field: 'b', value: 'v', basis: [] }, { field: 'c', value: 'v', basis: ['e2'] }];
    all.toolRequests = [{ tool: 'x' }, { tool: 'y' }];
    (all.result as { approvedRevisionId: string }).approvedRevisionId = 'r2';
    const r = check('release_librarian', all);
    expect(r.reasons).toEqual(['MANIFEST_MISMATCH', 'SOURCE_REQUIRED', 'SOURCE_OUT_OF_CONTEXT', 'UNSOURCED_CLAIM', 'TOOL_NOT_ALLOWED', 'TEXT_NOT_VISIBLE', 'NOT_APPROVED_REVISION']);
    expect(r).toMatchObject({ verdict: 'hold', output: null });
  });

  it('an oversized or deeply nested output is rejected by size, not by a crash', () => {
    const big = { ...clean('intake_analyst'), claims: [{ field: 'f', value: 'x'.repeat(MAX_OUTPUT_BYTES), basis: ['e1'] }] };
    expect(check('intake_analyst', big)).toEqual({ verdict: 'hold', reasons: ['SCHEMA_INVALID'], output: null });
    let deep: unknown = 'x'; for (let i = 0; i < 200000; i++) deep = [deep];
    expect(check('intake_analyst', { ...clean('intake_analyst'), result: deep }).reasons).toEqual(['SCHEMA_INVALID']);
    const cyc: Record<string, unknown> = {}; cyc.self = cyc;
    expect(check('intake_analyst', cyc).reasons).toEqual(['SCHEMA_INVALID']);
    expect(check('intake_analyst', { ...clean('intake_analyst'), result: 10n }).reasons).toEqual(['SCHEMA_INVALID']);
    expect(check('intake_analyst', undefined).reasons).toEqual(['SCHEMA_INVALID']);
    expect(check('intake_analyst', null).reasons).toEqual(['SCHEMA_INVALID']);
  });

  it('outputFits measures UTF-8 bytes of the compact JSON', () => {
    const at = (n: number) => ({ s: 'x'.repeat(n) });
    expect(Buffer.byteLength(JSON.stringify(at(32760)), 'utf8')).toBe(32768);
    expect(outputFits(at(32760))).toBe(true);
    expect(outputFits(at(32761))).toBe(false);
    const vi = { s: 'ệ'.repeat(15000) };
    expect(vi.s.length).toBeLessThan(MAX_OUTPUT_BYTES);
    expect(outputFits(vi)).toBe(false);
    expect(outputFits(undefined)).toBe(false);
    expect(outputFits(() => 1)).toBe(false);
    expect(outputFits(Symbol('x'))).toBe(false);
  });

  const through = (bad: string) => { const o = clean('intake_analyst'); o.claims[0].value = bad; return check('intake_analyst', o).reasons; };
  it('outputFits refuses U+0000 in a value or a key', () => {
    expect(outputFits({ a: ['x\u0000y'] })).toBe(false);
    expect(outputFits({ a: { b: [{ c: { ['k\u0000']: 'v' } }] } })).toBe(false);
    expect(through('x\u0000y')).toEqual(['SCHEMA_INVALID']);
  });
  it('outputFits refuses a lone surrogate in a value or a key', () => {
    expect(outputFits({ a: '\ud800' })).toBe(false);
    expect(outputFits({ a: '\udc00' })).toBe(false);
    expect(outputFits({ a: { b: [{ c: { ['k\ud800']: 'v' } }] } })).toBe(false);
    expect(through('\ud800')).toEqual(['SCHEMA_INVALID']);
    expect(through('\udc00')).toEqual(['SCHEMA_INVALID']);
  });
  it('outputFits accepts a valid surrogate pair and the six letters backslash-u0000', () => {
    expect(outputFits({ a: '\ud83d\ude00' })).toBe(true);
    expect(outputFits({ a: '\\u0000' })).toBe(true);
  });

  it('confidence is an integer from 0 to 100', () => {
    for (const c of [0.5, -1, 101, '80']) expect(check('intake_analyst', { ...clean('intake_analyst'), confidence: c }).reasons, String(c)).toEqual(['SCHEMA_INVALID']);
    for (const c of [0, 100]) expect(check('intake_analyst', { ...clean('intake_analyst'), confidence: c }).verdict).toBe('accept');
  });

  it('no contract admits another number, and parsing returns the value unchanged', () => {
    const leaves = (v: unknown, path: (string | number)[] = []): (string | number)[][] =>
      typeof v === 'string' ? [path] : Array.isArray(v) ? v.flatMap((x, i) => leaves(x, [...path, i])) : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => leaves(x, [...path, k])) : [];
    for (const s of SKILLS) {
      const good = clean(s);
      const parsed = outputSchemas[s].safeParse(good);
      expect(parsed.success, s).toBe(true);
      if (parsed.success) expect(parsed.data).toEqual(good);
      const paths = leaves(good);
      expect(paths.length).toBeGreaterThan(8);
      for (const p of paths) {
        const o = clean(s) as unknown as Record<string, unknown>;
        let t: any = o; for (const k of p.slice(0, -1)) t = t[k];
        t[p[p.length - 1]] = 7;
        expect(check(s, o).reasons, `${s} ${p.join('.')}`).toEqual(['SCHEMA_INVALID']);
      }
    }
  });

  it('sources are at most 100 references', () => {
    const mk = (n: number) => ({ ...clean('intake_analyst'), sources: [{ id: 'e1' }, { id: 'r1' }, ...Array.from({ length: n - 2 }, () => ({ id: 'e1' }))] });
    expect(check('intake_analyst', mk(100)).verdict).toBe('accept');
    expect(check('intake_analyst', mk(101))).toEqual({ verdict: 'hold', reasons: ['SCHEMA_INVALID'], output: null });
    expect(check('intake_analyst', { ...clean('intake_analyst'), sources: [{ id: 'e1', text: 'quoted' }] }).reasons).toEqual(['SCHEMA_INVALID']);
  });

  it('questions are at most 50 items and 16384 bytes', () => {
    const mk = (n: number) => ({ ...clean('intake_analyst'), questions: Array.from({ length: n }, () => ({ field: 'f', question: 'q' })) });
    expect(check('intake_analyst', mk(50)).verdict).toBe('accept');
    expect(check('intake_analyst', mk(51)).reasons).toEqual(['SCHEMA_INVALID']);
    const sized = (bytes: number) => {
      const probe = [{ field: 'f', question: '' }];
      const pad = bytes - Buffer.byteLength(JSON.stringify(probe), 'utf8');
      const questions = [{ field: 'f', question: 'x'.repeat(pad) }];
      expect(Buffer.byteLength(JSON.stringify(questions), 'utf8')).toBe(bytes);
      return { ...clean('intake_analyst'), questions };
    };
    expect(check('intake_analyst', sized(16384)).verdict).toBe('accept');
    expect(check('intake_analyst', sized(16385))).toEqual({ verdict: 'hold', reasons: ['SCHEMA_INVALID'], output: null });
  });

  it('R-a the context must be for the same skill as the manifest', () => {
    const r = check('ba_elicitation', clean('ba_elicitation'), [], ctx({ skill: 'pm_planning' }));
    expect(r).toEqual({ verdict: 'hold', reasons: ['MANIFEST_MISMATCH'], output: null });
  });

  it('R-b a statement cannot rest on text that was not shown', () => {
    const c = { ...clean('intake_analyst'), sources: [{ id: 'e1' }, { id: 'e2' }] }; c.claims = []; c.conflicts[0].sourceIds = ['e1', 'e2'];
    expect(check('intake_analyst', c).reasons).toEqual(['TEXT_NOT_VISIBLE']);
    const p = { ...clean('technical_writer'), sources: [{ id: 'e1' }, { id: 'r1' }, { id: 'e3' }] }; (p.result as { sections: { basis: string[] }[] }).sections[0].basis = ['e3'];
    expect(check('technical_writer', p).reasons).toEqual(['TEXT_NOT_VISIBLE']);
    const listed = { ...clean('intake_analyst'), sources: [{ id: 'e1' }, { id: 'r1' }, { id: 'e2' }, { id: 'e3' }] };
    // ruled change (F9-8): a pointer listed only in sources[] used to be accepted; it is now held
    expect(check('intake_analyst', listed)).toEqual({ verdict: 'hold', reasons: ['TEXT_NOT_VISIBLE'], output: null });
  });

  it('R-c every id-bearing field is checked against the context, and the table covers every id in a clean output', () => {
    const setAll = (o: any, path: string[], value: string): number => {
      if (path.length === 0) return 0;
      const [h, ...rest] = path;
      if (h === '*') { let n = 0; for (let i = 0; i < o.length; i++) { if (rest.length === 0) { o[i] = value; n++; } else n += setAll(o[i], rest, value); } return n; }
      if (rest.length === 0) { if (o[h] === null) return 0; o[h] = value; return 1; }
      return setAll(o[h], rest, value);
    };
    const leaves = (v: unknown, path: string[] = []): string[][] =>
      typeof v === 'string' ? [path] : Array.isArray(v) ? v.flatMap((x, i) => leaves(x, [...path, String(i)])) : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => leaves(x, [...path, k])) : [];
    const known = new Set(ctx().sources.map(x => x.id));
    for (const s of SKILLS) {
      // 1. each table entry, replaced by a foreign id, is refused
      for (const f of ID_FIELDS[s]) {
        const o = clean(s); expect(setAll(o, f.path.split('.'), 'zzz'), `${s} ${f.path} present in fixture`).toBeGreaterThan(0);
        expect(check(s, o).reasons, `${s} ${f.path}`).toContain('SOURCE_OUT_OF_CONTEXT');
      }
      // 2. every leaf of the clean output that holds a context id sits at a path of the table
      const patterns = ID_FIELDS[s].map(f => new RegExp('^' + f.path.replace(/\./g, '\\.').replace(/\*/g, '\\d+') + '$'));
      for (const p of leaves(clean(s))) {
        const v = p.reduce((x: any, k) => x[k], clean(s) as any) as string;
        if (known.has(v)) expect(patterns.some(r => r.test(p.join('.'))), `${s} ${p.join('.')} holds an id but is not in ID_FIELDS`).toBe(true);
      }
    }
  });

  it('R-d the release librarian only names approved revisions', () => {
    const latest = clean('release_librarian'); (latest.result as { approvedRevisionId: string }).approvedRevisionId = 'r2';
    expect(check('release_librarian', latest).reasons).toEqual(['NOT_APPROVED_REVISION']);
    const idx = clean('release_librarian'); (idx.result as { index: { revisionId: string }[] }).index[0].revisionId = 'r2';
    expect(check('release_librarian', idx).reasons).toEqual(['NOT_APPROVED_REVISION']);
    const c = ctx({ skill: 'release_librarian' });
    c.sources = c.sources.map(x => x.kind === 'document' ? { ...x, approvedRevisionId: null } : x);
    const none = clean('release_librarian'); (none.result as { approvedRevisionId: string | null }).approvedRevisionId = null;
    expect(check('release_librarian', none, [], c).reasons).toEqual(['NOT_APPROVED_REVISION']);
    (none.result as { index: unknown[] }).index = [];
    expect(check('release_librarian', none, [], c).verdict).toBe('accept');
  });

  it('NOT_APPROVED_REVISION is unchanged: naming the unapproved pointer in sources does not let index[].revisionId or approvedRevisionId be anything but the approved revision', () => {
    // OQ-57: the librarian's context holds the approved revision r1 with its content and the newest revision r2 (not approved) as a pointer without content
    const pointer: ContextSource = { id: 'r2', kind: 'document_revision', documentId: 'd1', revisionNo: 2, summary: null, present: [], missing: [], sourceHash: null, hashVerification: 'self_declared' };
    const withPointer = ctx({ skill: 'release_librarian' });
    withPointer.sources = [...withPointer.sources.filter(x => x.id !== 'r2'), pointer];
    // nothing approved: the same document, its approval pointer null, the pointer the only revision
    const nothingApproved = ctx({ skill: 'release_librarian' });
    nothingApproved.sources = [...nothingApproved.sources.filter(x => x.kind !== 'document_revision').map((x): ContextSource => x.kind === 'document' ? { ...x, approvedRevisionId: null } : x), pointer];
    // an output that makes no claim and no conflict: only the listed sources and the result are in play
    const draft = (sources: string[], result: { approvedRevisionId: string | null; index: { documentId: string; revisionId: string }[]; staleReminders: { documentId: string; note: string }[] }) =>
      ({ ...clean('release_librarian'), sources: sources.map(id => ({ id })), claims: [], conflicts: [], result });
    const entry = (revisionId: string) => [{ documentId: 'd1', revisionId }];

    // the pointer named in `sources`, to say it was seen: nothing is held for naming it
    expect(check('release_librarian', draft(['d1', 'r1', 'r2'], { approvedRevisionId: 'r1', index: entry('r1'), staleReminders: [] }), [], withPointer)).toMatchObject({ verdict: 'accept', reasons: [] });
    // the pointer as the revision of an index entry: not the approved revision
    expect(check('release_librarian', draft(['d1', 'r1', 'r2'], { approvedRevisionId: 'r1', index: entry('r2'), staleReminders: [] }), [], withPointer).reasons).toEqual(['NOT_APPROVED_REVISION']);
    // the pointer as the approved revision: not the approved revision
    expect(check('release_librarian', draft(['d1', 'r1', 'r2'], { approvedRevisionId: 'r2', index: entry('r1'), staleReminders: [] }), [], withPointer).reasons).toEqual(['NOT_APPROVED_REVISION']);
    // both at once
    expect(check('release_librarian', draft(['d1', 'r1', 'r2'], { approvedRevisionId: 'r2', index: entry('r2'), staleReminders: [] }), [], withPointer).reasons).toEqual(['NOT_APPROVED_REVISION']);
    // nothing approved in the context: the pointer is still no approved revision, in either field; naming it in `sources` alone holds nothing
    expect(check('release_librarian', draft(['d1', 'r2'], { approvedRevisionId: 'r2', index: [], staleReminders: [] }), [], nothingApproved).reasons).toEqual(['NOT_APPROVED_REVISION']);
    expect(check('release_librarian', draft(['d1', 'r2'], { approvedRevisionId: null, index: entry('r2'), staleReminders: [] }), [], nothingApproved).reasons).toEqual(['NOT_APPROVED_REVISION']);
    expect(check('release_librarian', draft(['d1', 'r2'], { approvedRevisionId: null, index: [], staleReminders: [] }), [], nothingApproved)).toMatchObject({ verdict: 'accept', reasons: [] });
  });

  it('R-e a pointer-only context carries no text to reason from', () => {
    const c = ctx({ skill: 'intake_analyst', pointerOnly: true });
    expect(check('intake_analyst', clean('intake_analyst'), [], c).reasons).toEqual(['TEXT_NOT_VISIBLE']);
    const onlyConflict = { ...clean('intake_analyst'), claims: [] };
    expect(check('intake_analyst', onlyConflict, [], c).reasons).toEqual(['TEXT_NOT_VISIBLE']);
    const ba = { ...clean('ba_elicitation'), claims: [], conflicts: [] };
    expect(check('ba_elicitation', ba, [], ctx({ skill: 'ba_elicitation', pointerOnly: true })).reasons).toEqual(['TEXT_NOT_VISIBLE']);
    // a pointer-only context shows no message text, so a draft that read nothing lists no message revision either
    const empty = { ...clean('ba_elicitation'), claims: [], conflicts: [], messageRevisions: [], result: { userStories: [], rules: [], acceptance: [], unknowns: [] } };
    expect(check('ba_elicitation', empty, [], ctx({ skill: 'ba_elicitation', pointerOnly: true }))).toMatchObject({ verdict: 'accept', reasons: [] });
  });

  it('F9-1 a conflict names at least two distinct sources', () => {
    for (const ids of [[], ['e1'], ['e1', 'e1']]) {
      const o = clean('intake_analyst'); o.conflicts[0].sourceIds = ids;
      expect(check('intake_analyst', o), JSON.stringify(ids)).toEqual({ verdict: 'hold', reasons: ['UNSOURCED_CLAIM'], output: null });
    }
    const two = clean('intake_analyst'); two.conflicts[0].sourceIds = ['e1', 'r1'];
    expect(check('intake_analyst', two).verdict).toBe('accept');
  });

  // Result with every leaf empty (null, '', empty array), per skill; `fields` give one non-empty leaf per statement-bearing field.
  const emptyOf: Record<SkillName, unknown> = {
    intake_analyst: { classification: null, duplicateOf: null, missingFields: [] },
    ba_elicitation: { userStories: [], rules: [], acceptance: [], unknowns: [] },
    pm_planning: { milestones: [], actions: [], decisionsNeeded: [] },
    technical_writer: { sections: [], terms: [] },
    doc_reviewer: { baseRevisionId: null, candidateRevisionId: '', diff: [], impacts: [], missing: [], scopeRead: '' },
    release_librarian: { approvedRevisionId: null, index: [], staleReminders: [] },
  };
  const leafOf: Record<SkillName, Record<string, unknown>> = {
    intake_analyst: { classification: 'incident', duplicateOf: 'e1', missingFields: ['x'] },
    ba_elicitation: { userStories: [{ text: 's', basis: ['e1'] }], rules: [{ text: 'r', basis: ['e1'] }], acceptance: [{ text: 'a', basis: ['e1'] }], unknowns: ['u'] },
    pm_planning: { milestones: [{ title: 't', basis: ['e1'], estimate: null }], actions: [{ text: 'a', basis: ['e1'] }], decisionsNeeded: ['d'] },
    technical_writer: { sections: [{ heading: 'h', text: 't', basis: ['e1'] }], terms: [{ term: 't', meaning: 'm', basis: ['e1'] }] },
    doc_reviewer: { baseRevisionId: 'r1', candidateRevisionId: 'r2', diff: [{ section: 's', change: 'added', note: 'n' }], impacts: ['i'], missing: ['m'], scopeRead: 'all' },
    release_librarian: { approvedRevisionId: 'r1', index: [{ documentId: 'd1', revisionId: 'r1' }], staleReminders: [{ documentId: 'd1', note: 'n' }] },
  };
  it('F9-2 in a pointer-only context any non-empty leaf of result is held, for all six skills', () => {
    for (const s of SKILLS) {
      const c = ctx({ skill: s, pointerOnly: true });
      const wrap = (result: unknown) => ({ ...clean(s), claims: [], conflicts: [], result });
      for (const [field, value] of Object.entries(leafOf[s])) {
        const r = check(s, wrap({ ...(emptyOf[s] as object), [field]: value }), [], c);
        expect(r.reasons, `${s}.${field}`).toContain('TEXT_NOT_VISIBLE');
        expect(r.verdict, `${s}.${field}`).toBe('hold');
      }
      const empty = check(s, wrap(emptyOf[s]), [], c);
      if (s === 'doc_reviewer') {
        // candidateRevisionId is a required id of a context revision, so an all-empty result is also out of context: this skill is always held here.
        expect(empty.reasons).toEqual(['SOURCE_OUT_OF_CONTEXT']);
      } else expect(empty, s).toMatchObject({ verdict: 'accept', reasons: [] });
    }
  });

  it('F9-2 the empty-leaf walk is recursive and reaches into nested objects', () => {
    const c = ctx({ skill: 'doc_reviewer', pointerOnly: true });
    const base = { ...clean('doc_reviewer'), claims: [], conflicts: [] };
    const empty = { ...(emptyOf.doc_reviewer as object), candidateRevisionId: 'r2' };
    // candidateRevisionId is a non-empty id here, so this proves only that the id leaf itself counts
    expect(check('doc_reviewer', { ...base, result: empty }, [], c).reasons).toContain('TEXT_NOT_VISIBLE');
    const pm = { ...clean('pm_planning'), claims: [], conflicts: [] };
    const deep = { milestones: [], actions: [], decisionsNeeded: [] };
    expect(check('pm_planning', { ...pm, result: deep }, [], ctx({ skill: 'pm_planning', pointerOnly: true })).verdict).toBe('accept');
    expect(check('pm_planning', { ...pm, result: { ...deep, milestones: [{ title: '', basis: [], estimate: null }] } }, [], ctx({ skill: 'pm_planning', pointerOnly: true })).reasons).toEqual(['UNSOURCED_CLAIM']); // nested all-empty object: no TEXT_NOT_VISIBLE
    expect(check('pm_planning', { ...pm, result: { ...deep, milestones: [{ title: 'x', basis: [], estimate: null }] } }, [], ctx({ skill: 'pm_planning', pointerOnly: true })).reasons).toContain('TEXT_NOT_VISIBLE');
  });

  it('a context with no shown text and no document yields only held outputs', () => {
    const msg = (id: string, mode: 'hidden' | 'pointer_only') => ({ id, kind: 'source_event' as const, ref: `ref-${id}`, mode, text: null, hash: null, observedAt: '2026-11-15T00:00:00.000Z', forwarded: false, revisionNo: 1 });
    for (const pointerOnly of [true, false]) for (const s of SKILLS) {
      const c: SkillContext = { skill: s, projectId: 'p1', pointerOnly, sources: [msg('h1', 'hidden'), msg('h2', 'pointer_only')] };
      const questionsOnly = { ...clean(s), sources: [], claims: [], conflicts: [], questions: [{ field: 'f', question: 'Cần văn bản hoặc tài liệu để phân tích?' }], result: emptyOf[s],
        ...(MESSAGE_SKILLS.includes(s) ? { messageRevisions: [] } : {}) };   // no message text is shown here, so none is listed
      const tag = `${s} pointerOnly=${pointerOnly}`;
      if (s === 'doc_reviewer') {
        // its required candidateRevisionId can never name a revision here
        expect(check(s, questionsOnly, [], c).verdict, tag).toBe('hold');
        continue;
      }
      expect(check(s, questionsOnly, [], c), tag).toEqual({ verdict: 'hold', reasons: ['SOURCE_REQUIRED'], output: null });
      for (const id of ['h1', 'h2']) {
        const listed = { ...questionsOnly, sources: [{ id }] };
        expect(check(s, listed, [], c), `${tag} lists ${id}`).toEqual({ verdict: 'hold', reasons: ['TEXT_NOT_VISIBLE'], output: null });
      }
    }
  });

  it('F9-3 an excerpt without text does not support a statement', () => {
    const c = ctx();
    c.sources.push({ id: 'e4', kind: 'source_event', ref: 'ref-4', mode: 'excerpt', text: null, hash: null, observedAt: '2026-11-15T00:00:00.000Z', forwarded: false, revisionNo: 1 });
    const o = { ...clean('intake_analyst'), sources: [{ id: 'e1' }, { id: 'r1' }, { id: 'e4' }] }; o.claims[0].basis = ['e4'];
    expect(check('intake_analyst', o, [], c).reasons).toEqual(['TEXT_NOT_VISIBLE']);
  });

  it('F9-4 the value that is measured is the value that is parsed and returned', () => {
    const plain = clean('intake_analyst');
    const wrapped = { toJSON: () => plain };
    const r = check('intake_analyst', wrapped);
    expect(r.verdict).toBe('accept');
    expect(r.output).toEqual(plain);
    expect(r.output).not.toBe(plain);
    const getter = { ...plain, get confidence() { return 50; } };
    expect(check('intake_analyst', getter).output?.confidence).toBe(50);
  });

  it('F9-5 whatever a statement cites is also listed in sources', () => {
    const claim = { ...clean('intake_analyst'), sources: [{ id: 'r1' }] };
    expect(check('intake_analyst', claim).reasons).toEqual(['UNSOURCED_CLAIM']);
    const item = { ...clean('ba_elicitation'), sources: [{ id: 'e1' }, { id: 'r1' }] }; (item.result as { rules: { basis: string[] }[] }).rules[0].basis = ['d1'];
    expect(check('ba_elicitation', item).reasons).toEqual(['UNSOURCED_CLAIM']);
    const conflict = { ...clean('intake_analyst'), sources: [{ id: 'e1' }] };
    expect(check('intake_analyst', conflict).reasons).toEqual(['UNSOURCED_CLAIM']);
  });

  it('F9-6 an id of the wrong kind is out of context', () => {
    const set = (s: SkillName, mut: (r: any) => void) => { const o = clean(s); mut(o.result); return check(s, o).reasons; };
    expect(set('doc_reviewer', r => { r.baseRevisionId = 'e1'; })).toEqual(['SOURCE_OUT_OF_CONTEXT']);
    expect(set('doc_reviewer', r => { r.candidateRevisionId = 'd1'; })).toEqual(['SOURCE_OUT_OF_CONTEXT']);
    expect(set('intake_analyst', r => { r.duplicateOf = 'd1'; })).toEqual(['SOURCE_OUT_OF_CONTEXT']);
    expect(set('release_librarian', r => { r.index[0].documentId = 'r1'; })).toEqual(['SOURCE_OUT_OF_CONTEXT', 'NOT_APPROVED_REVISION']);
    expect(set('release_librarian', r => { r.staleReminders[0].documentId = 'e1'; })).toEqual(['SOURCE_OUT_OF_CONTEXT']);
    // approvedRevisionId and index.*.revisionId keep their own rule: they need not be a source of the context
    expect(set('release_librarian', r => { r.approvedRevisionId = null; })).toEqual([]);
  });

  it('F9-8 a hidden or pointer-only message named in any id field, sources[] and duplicateOf included, is held', () => {
    for (const id of ['e2', 'e3']) {
      const onlyListed = { ...clean('intake_analyst'), sources: [{ id: 'e1' }, { id: 'r1' }, { id }] };
      expect(check('intake_analyst', onlyListed), `sources ${id}`).toEqual({ verdict: 'hold', reasons: ['TEXT_NOT_VISIBLE'], output: null });
      const dup = clean('intake_analyst'); (dup.result as { duplicateOf: string }).duplicateOf = id;
      expect(check('intake_analyst', dup).reasons, `duplicateOf ${id}`).toEqual(['TEXT_NOT_VISIBLE']);
    }
    // an excerpt without text counts as not shown here too
    const c = ctx();
    c.sources.push({ id: 'e4', kind: 'source_event', ref: 'ref-4', mode: 'excerpt', text: null, hash: null, observedAt: '2026-11-15T00:00:00.000Z', forwarded: false, revisionNo: 1 });
    expect(check('intake_analyst', { ...clean('intake_analyst'), sources: [{ id: 'e1' }, { id: 'r1' }, { id: 'e4' }] }, [], c).reasons).toEqual(['TEXT_NOT_VISIBLE']);
    // documents and revisions carry no visibility rule
    expect(check('intake_analyst', { ...clean('intake_analyst'), sources: [{ id: 'e1' }, { id: 'r1' }, { id: 'd1' }, { id: 'r2' }] }).verdict).toBe('accept');
  });

  it('R-f the gate imports nothing that reaches the database', () => {
    const imports = (file: string) => [...readFileSync(file, 'utf8').matchAll(/^\s*(?:import|export)\s+(type\s+)?[^;]*?from\s+'([^']+)'/gm)].map(m => ({ typeOnly: !!m[1], spec: m[2] }));
    const own = imports('src/server/skill-contracts.ts');
    expect(own.length).toBeGreaterThan(0);
    for (const i of own.filter(x => !x.typeOnly)) expect(['zod', './text-safety'], i.spec).toContain(i.spec);
    for (const i of own.filter(x => x.typeOnly)) expect(['./source-text', './types'], i.spec).toContain(i.spec);
    expect(imports('src/server/text-safety.ts')).toEqual([]);
    expect(readFileSync('src/server/text-safety.ts', 'utf8')).not.toMatch(/\brequire\(|\bimport\(/);
  });
  it('D6 namedIds returns every id at every id-bearing path of the skill, once each, and nothing for a value that is not an output', () => {
    const sorted = (a: string[]) => [...a].sort();
    // common paths: sources, claims basis, conflicts sourceIds; a repeated id comes back once
    const common = { ...base('intake_analyst', { classification: 'incident', duplicateOf: null, missingFields: [] }),
      messageRevisions: [],   // the fixture's own entry (e1) is not what this case is about; the ids of that list are D3 of the OQ-53 group below
      sources: [{ id: 'a1' }, { id: 'a2' }, { id: 'a1' }], claims: [{ field: 'f', value: 'v', basis: ['b1', 'a2'] }], conflicts: [{ field: 'f', sourceIds: ['c1', 'b1'], note: 'n' }] };
    expect(namedIds('intake_analyst', common)).toEqual(['a1', 'a2', 'b1', 'c1']);
    expect(sorted(namedIds('intake_analyst', { ...common, result: { classification: 'incident', duplicateOf: 'z9', missingFields: [] } }))).toEqual(['a1', 'a2', 'b1', 'c1', 'z9']);
    const none = (r: unknown, skill: SkillName) => ({ ...base(skill, r), sources: [], claims: [], conflicts: [] });
    expect(sorted(namedIds('doc_reviewer', none({ baseRevisionId: 'r1', candidateRevisionId: 'r2', diff: [], impacts: [], missing: [], scopeRead: 'all' }, 'doc_reviewer')))).toEqual(['r1', 'r2']);
    expect(sorted(namedIds('release_librarian', none({ approvedRevisionId: 'ra', index: [{ documentId: 'd1', revisionId: 'rb' }, { documentId: 'd2', revisionId: 'rb' }], staleReminders: [{ documentId: 'd3', note: 'n' }] }, 'release_librarian'))))
      .toEqual(['d1', 'd2', 'd3', 'ra', 'rb']);
    expect(namedIds('intake_analyst', null)).toEqual([]);
    expect(namedIds('intake_analyst', 'x')).toEqual([]);
    expect(namedIds('intake_analyst', { sources: 'nope' })).toEqual([]);
  });
});

// OQ-53 point 1 (b), Task 4. The pair (message, revision number) is read by the confirmation as «the draft read that revision» (plan section 8); the output gate only holds the shape and the ids.
describe('skill contracts: messageRevisions (OQ-53 point 1 (b), Task 4)', () => {
  const pair = (id: string, revisionNo: unknown) => ({ id, revisionNo });
  const withRevs = (s: SkillName, messageRevisions: unknown) => ({ ...clean(s), messageRevisions });
  const SCHEMA = { verdict: 'hold', reasons: ['SCHEMA_INVALID'], output: null };
  const NOT_VISIBLE = { verdict: 'hold', reasons: ['TEXT_NOT_VISIBLE'], output: null };
  // a result with every leaf empty, for each skill that receives messages (an output that states nothing but the revisions it read)
  const quietResult: Record<string, unknown> = {
    intake_analyst: { classification: null, duplicateOf: null, missingFields: [] },
    ba_elicitation: { userStories: [], rules: [], acceptance: [], unknowns: [] },
    pm_planning: { milestones: [], actions: [], decisionsNeeded: [] },
  };
  const quiet = (s: SkillName) => ({ ...clean(s), sources: [{ id: 'r1' }], claims: [], conflicts: [], result: quietResult[s] });

  it('D1 the three message skills must state messageRevisions; the other three must not', () => {
    expect(OTHER_SKILLS).toEqual(['technical_writer', 'doc_reviewer', 'release_librarian']);
    for (const s of MESSAGE_SKILLS) {
      // positive control: the clean output, with the field, is accepted and the gate hands the list back as it came
      const ok = check(s, clean(s));
      expect(ok.verdict, `${s} control`).toBe('accept');
      expect(ok.output?.messageRevisions, `${s} handed back`).toEqual([{ id: 'e1', revisionNo: 1 }]);
      // the field is required, also as an empty list; a list that states nothing is a statement of its own (a context with no shown message has nothing to list)
      const { messageRevisions: _dropped, ...without } = clean(s);
      expect(check(s, without), `${s} without the field`).toEqual(SCHEMA);
      expect(outputSchemas[s].safeParse(without).success, `${s} schema without the field`).toBe(false);
      expect(check(s, withRevs(s, [])).verdict, `${s} empty list`).toBe('accept');
      // the number is a whole number from 1 to 2147483647, the same range as the column it will be compared with
      for (const n of [1, 2, 2147483647]) expect(check(s, withRevs(s, [pair('e1', n)])).verdict, `${s} ${n}`).toBe('accept');
      for (const n of [0, -1, 1.5, '1', null, true, 2147483648, Number.NaN, Infinity, undefined, [1], { n: 1 }])
        expect(check(s, withRevs(s, [pair('e1', n)])), `${s} revisionNo ${String(n)}`).toEqual(SCHEMA);
      // the shape: a list of strict {id, revisionNo}
      for (const bad of [null, 'e1', { id: 'e1', revisionNo: 1 }, [null], ['e1'], [{ id: 'e1' }], [{ revisionNo: 1 }], [{ id: 1, revisionNo: 1 }], [{ id: null, revisionNo: 1 }], [{ id: 'e1', revisionNo: 1, hash: 'x' }], [[ 'e1', 1 ]]])
        expect(check(s, withRevs(s, bad)), `${s} ${JSON.stringify(bad)}`).toEqual(SCHEMA);
      // at most 100 entries
      const many = (n: number) => Array.from({ length: n }, () => pair('e1', 1));
      expect(check(s, withRevs(s, many(100))).verdict, `${s} 100`).toBe('accept');
      expect(check(s, withRevs(s, many(101))), `${s} 101`).toEqual(SCHEMA);
    }
    for (const s of OTHER_SKILLS) {
      // a skill that receives no message has no such field: its strict contract refuses it, empty or not
      expect(check(s, clean(s)).verdict, `${s} control`).toBe('accept');
      for (const list of [[], [pair('e1', 1)]]) {
        expect(check(s, withRevs(s, list)), `${s} ${JSON.stringify(list)}`).toEqual(SCHEMA);
        expect(outputSchemas[s].safeParse(withRevs(s, list)).success, `${s} schema`).toBe(false);
      }
    }
  });

  it('D2 an id under messageRevisions is held to the rules of every id field', () => {
    const only = (s: SkillName, id: string) => withRevs(s, [pair(id, 1)]);   // `sources` stay [e1, r1]: the entry is the only id that can be held
    for (const s of MESSAGE_SKILLS) {
      // the table lists the path once, as an id of a message that backs no statement
      expect(ID_FIELDS[s].filter(f => f.path === 'messageRevisions.*.id'), `${s} table`).toEqual([{ path: 'messageRevisions.*.id', supports: false, kind: 'source_event' }]);
      // not a message of the context: a foreign id, a document, a revision of a document
      for (const id of ['zzz', 'd1', 'r1', 'r2'])
        expect(check(s, only(s, id)), `${s} ${id}`).toEqual({ verdict: 'hold', reasons: ['SOURCE_OUT_OF_CONTEXT'], output: null });
      // a message whose text was not shown: hidden, pointer-only, an excerpt without text
      const c = ctx({ skill: s });
      c.sources.push({ id: 'e4', kind: 'source_event', ref: 'ref-4', mode: 'excerpt', text: null, hash: null, observedAt: '2026-11-15T00:00:00.000Z', forwarded: false, revisionNo: 1 });
      for (const id of ['e2', 'e3', 'e4']) expect(check(s, only(s, id), [], c), `${s} ${id}`).toEqual(NOT_VISIBLE);
      // an entry is not a statement: a shown message need not be cited, and need not be listed in `sources`
      expect(check(s, quiet(s)).verdict, `${s} an entry for a message nothing cites`).toBe('accept');
      // a pointer-only context: the builder emits its messages with no text, so any entry is held, whichever message it names; an empty list is accepted
      const pc = ctx({ skill: s, pointerOnly: true });
      pc.sources = pc.sources.map(x => x.kind === 'source_event' ? { ...x, text: null, hash: null } : x);
      for (const id of ['e1', 'e2', 'e3']) expect(check(s, { ...quiet(s), messageRevisions: [pair(id, 1)] }, [], pc), `${s} pointer-only ${id}`).toEqual(NOT_VISIBLE);
      expect(check(s, { ...quiet(s), messageRevisions: [] }, [], pc).verdict, `${s} pointer-only, empty list`).toBe('accept');
    }
    // the other three skills have no such path in their table
    for (const s of OTHER_SKILLS) expect(ID_FIELDS[s].some(f => f.path.startsWith('messageRevisions')), s).toBe(false);
  });

  it('D3 namedIds includes the ids of messageRevisions; namedRevisions returns the pairs and nothing else', () => {
    for (const s of MESSAGE_SKILLS) {
      const o = { ...quiet(s), sources: [{ id: 'a1' }], messageRevisions: [pair('m1', 2), pair('a1', 1), pair('m1', 2), pair('m2', 3)] };
      // the ids of messageRevisions are named, once each, in order of first appearance across the table (`sources` come first)
      expect(namedIds(s, o), `${s} namedIds`).toEqual(['a1', 'm1', 'm2']);
      expect(namedIds(s, { ...o, sources: [], messageRevisions: [pair('m1', 1)] }), `${s} only here`).toEqual(['m1']);
      // the pairs, in order of first appearance; a pair repeated word for word comes back once
      expect(namedRevisions(s, o), `${s} pairs`).toEqual([pair('m1', 2), pair('a1', 1), pair('m2', 3)]);
      // the same message with two numbers: both come back, for the confirmation to read as «a number that is not the latest»
      expect(namedRevisions(s, { ...o, messageRevisions: [pair('m1', 1), pair('m1', 2)] }), `${s} two numbers`).toEqual([pair('m1', 1), pair('m1', 2)]);
      // range of the number
      expect(namedRevisions(s, { messageRevisions: [pair('m', 1), pair('m', 2147483647)] }), `${s} range`).toEqual([pair('m', 1), pair('m', 2147483647)]);
      // a pair with the wrong type comes back as nothing, among good ones too
      const wrong = [pair('m', 0), pair('m', -1), pair('m', 1.5), pair('m', '1'), pair('m', null), pair('m', true), pair('m', 2147483648), pair('m', Number.NaN), pair('m', Infinity), pair('m', undefined),
        pair('m', [1]), pair(1 as unknown as string, 1), pair(null as unknown as string, 1), pair(undefined as unknown as string, 1), { id: 'm' }, { revisionNo: 1 }, {}, null, 'm', 1, [], ['m', 1], [pair('m', 1)]];
      expect(namedRevisions(s, { messageRevisions: wrong }), `${s} wrong types`).toEqual([]);
      expect(namedRevisions(s, { messageRevisions: [...wrong, pair('ok', 5)] }), `${s} wrong types beside a good pair`).toEqual([pair('ok', 5)]);
      // a pair carries its two fields and no others; what comes back is a copy, not the caller's object
      const given = { id: 'm', revisionNo: 4, hash: 'x' };
      const back = namedRevisions(s, { messageRevisions: [given] });
      expect(back, `${s} copy`).toEqual([pair('m', 4)]);
      expect(back[0], `${s} not the same object`).not.toBe(given);
      // a value that is not an output, or has no such list, names no pair
      for (const v of [null, undefined, 'x', 7, true, [], {}, { messageRevisions: 'nope' }, { messageRevisions: null }, { messageRevisions: { id: 'm', revisionNo: 1 } }, { result: { messageRevisions: [pair('m', 1)] } }])
        expect(namedRevisions(s, v), `${s} ${JSON.stringify(v)}`).toEqual([]);
    }
    // a skill that receives no message has no such list: nothing comes back and no id of it is named
    for (const s of OTHER_SKILLS) {
      const o = withRevs(s, [pair('m1', 1)]);
      expect(namedRevisions(s, o), s).toEqual([]);
      expect(namedIds(s, o), s).not.toContain('m1');
    }
  });
});
