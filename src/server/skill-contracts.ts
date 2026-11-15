import { z } from 'zod';
import { storable } from './text-safety';
import type { DisplayMode } from './source-text';
import type { DocType } from './types';

// Slice 3, Task 9: input/output contracts of the six PM/BA skills and the gate on a skill's output. Pure: no I/O, no clock, no randomness.
// Text inside a context source or an output is data. An output can only cite ids from its context, never widen the tool allowlist,
// and has no field for an assignee, a due date, an approval or a delivery state. Contracts are strict and use no default or transform.
export const SKILLS = ['intake_analyst', 'ba_elicitation', 'pm_planning', 'technical_writer', 'doc_reviewer', 'release_librarian'] as const;
export type SkillName = typeof SKILLS[number];
export type ContextSource =
  | { id: string; kind: 'source_event'; ref: string; mode: DisplayMode; text: string | null; hash: string | null; observedAt: string; forwarded: boolean }
  | { id: string; kind: 'document'; refCode: string; docType: DocType; title: string | null; latestRevisionId: string | null; approvedRevisionId: string | null }
  | { id: string; kind: 'document_revision'; documentId: string; revisionNo: number; summary: string | null; present: string[]; missing: string[]; sourceHash: string | null; hashVerification: 'self_declared' | 'verified' };
export type SkillContext = { skill: SkillName; projectId: string; pointerOnly: boolean; sources: ContextSource[] };

const skillEnum = z.enum(SKILLS);
const docTypes = ['project_index', 'change_brief', 'requirements', 'design', 'plan', 'verification', 'guide', 'other'] as const satisfies readonly DocType[];
export const contextSchema: z.ZodType<SkillContext> = z.strictObject({
  skill: skillEnum, projectId: z.string(), pointerOnly: z.boolean(),
  sources: z.array(z.discriminatedUnion('kind', [
    z.strictObject({ id: z.string(), kind: z.literal('source_event'), ref: z.string(), mode: z.enum(['excerpt', 'hidden', 'pointer_only']), text: z.string().nullable(), hash: z.string().nullable(), observedAt: z.string(), forwarded: z.boolean() }),
    z.strictObject({ id: z.string(), kind: z.literal('document'), refCode: z.string(), docType: z.enum(docTypes), title: z.string().nullable(), latestRevisionId: z.string().nullable(), approvedRevisionId: z.string().nullable() }),
    z.strictObject({ id: z.string(), kind: z.literal('document_revision'), documentId: z.string(), revisionNo: z.number().int(), summary: z.string().nullable(), present: z.array(z.string()), missing: z.array(z.string()), sourceHash: z.string().nullable(), hashVerification: z.enum(['self_declared', 'verified']) }),
  ])),
});

export type SkillOutput = { skill: SkillName; manifestHash: string; sources: { id: string }[]; claims: { field: string; value: string; basis: string[] }[];
  questions: { field: string; question: string }[]; conflicts: { field: string; sourceIds: string[]; note: string }[]; confidence: number; toolRequests: { tool: string }[]; result: unknown };

// Limits no looser than the backstop CHECKs of the table that stores these outputs (migration 021).
export const MAX_OUTPUT_BYTES = 32768;
const MAX_SOURCES = 100, MAX_QUESTIONS = 50, MAX_QUESTIONS_BYTES = 16384;

const str = z.string();
const basis = z.array(str);
const so = z.strictObject;
const results = {
  intake_analyst: so({ classification: z.enum(['incident', 'request', 'document']).nullable(), duplicateOf: str.nullable(), missingFields: z.array(str) }),
  ba_elicitation: so({ userStories: z.array(so({ text: str, basis })), rules: z.array(so({ text: str, basis })), acceptance: z.array(so({ text: str, basis })), unknowns: z.array(str) }),
  pm_planning: so({ milestones: z.array(so({ title: str, basis, estimate: str.nullable() })), actions: z.array(so({ text: str, basis })), decisionsNeeded: z.array(str) }),
  technical_writer: so({ sections: z.array(so({ heading: str, text: str, basis })), terms: z.array(so({ term: str, meaning: str, basis })) }),
  doc_reviewer: so({ baseRevisionId: str.nullable(), candidateRevisionId: str, diff: z.array(so({ section: str, change: z.enum(['added', 'removed', 'modified']), note: str })), impacts: z.array(str), missing: z.array(str), scopeRead: str }),
  release_librarian: so({ approvedRevisionId: str.nullable(), index: z.array(so({ documentId: str, revisionId: str })), staleReminders: z.array(so({ documentId: str, note: str })) }),
} as const;

const questions = z.array(so({ field: str, question: str })).max(MAX_QUESTIONS)
  .refine(q => Buffer.byteLength(JSON.stringify(q), 'utf8') <= MAX_QUESTIONS_BYTES, 'questions too large');
const outputOf = <R extends z.ZodType>(result: R) => so({
  skill: skillEnum, manifestHash: str, sources: z.array(so({ id: str })).max(MAX_SOURCES),
  claims: z.array(so({ field: str, value: str, basis })), questions,
  conflicts: z.array(so({ field: str, sourceIds: z.array(str), note: str })),
  confidence: z.number().int().min(0).max(100), toolRequests: z.array(so({ tool: str })), result,
});
export const outputSchemas: Record<SkillName, z.ZodType<SkillOutput>> = {
  intake_analyst: outputOf(results.intake_analyst), ba_elicitation: outputOf(results.ba_elicitation), pm_planning: outputOf(results.pm_planning),
  technical_writer: outputOf(results.technical_writer), doc_reviewer: outputOf(results.doc_reviewer), release_librarian: outputOf(results.release_librarian),
};

type Measured = { fits: boolean; parsed: unknown };
// One measurement: the JSON round-tripped value is what is size-checked, character-checked and (by the gate) parsed and returned.
function measure(value: unknown): Measured {
  const no: Measured = { fits: false, parsed: undefined };
  let json: unknown;
  try { json = JSON.stringify(value); } catch { return no; }
  if (typeof json !== 'string' || Buffer.byteLength(json, 'utf8') > MAX_OUTPUT_BYTES) return no;
  // Re-read the JSON itself (toJSON already applied); JSON.stringify escapes NUL and lone surrogates, so only decoded strings show them. Iterative: no recursion limit.
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { return no; }
  const stack: unknown[] = [parsed];
  while (stack.length) {
    const v = stack.pop();
    if (typeof v === 'string') { if (!storable(v)) return no; }
    else if (Array.isArray(v)) for (const x of v) stack.push(x);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (!storable(k)) return no; stack.push(x); }
  }
  return { fits: true, parsed };
}
/** True when Buffer.byteLength(JSON.stringify(value),'utf8') <= MAX_OUTPUT_BYTES and no string, key or value, at any depth, holds U+0000 or a lone surrogate. */
export function outputFits(value: unknown): boolean { return measure(value).fits; }

export type HoldReason = 'SCHEMA_INVALID' | 'MANIFEST_MISMATCH' | 'SOURCE_REQUIRED' | 'SOURCE_OUT_OF_CONTEXT' | 'UNSOURCED_CLAIM' | 'TOOL_NOT_ALLOWED' | 'TEXT_NOT_VISIBLE' | 'NOT_APPROVED_REVISION';
const ORDER: readonly HoldReason[] = ['SCHEMA_INVALID', 'MANIFEST_MISMATCH', 'SOURCE_REQUIRED', 'SOURCE_OUT_OF_CONTEXT', 'UNSOURCED_CLAIM', 'TOOL_NOT_ALLOWED', 'TEXT_NOT_VISIBLE', 'NOT_APPROVED_REVISION'];
type Verdict = { verdict: 'accept' | 'hold'; reasons: HoldReason[]; output: SkillOutput | null };
const hold = (...r: HoldReason[]): Verdict => ({ verdict: 'hold', reasons: ORDER.filter(x => r.includes(x)), output: null });

type Item = { basis: string[] };
type R = { [K in keyof typeof results]: z.infer<typeof results[K]> };

// ONE table of every id-bearing field of an output, per skill. Paths use `*` for an array index. Every id here must be a context source, and a message among them must have been shown.
// `supports` marks the fields that back a statement: those ids must also be listed in `sources` (UNSOURCED_CLAIM). A new id field must be added here:
// the gate reads only this table, and the tests fail if a clean output holds a context id at a path that is not listed.
type Kind = ContextSource['kind'];
// `kind`, when set, is the kind the id must have in the context (a wrong kind is SOURCE_OUT_OF_CONTEXT).
type IdField = { path: string; supports: boolean; kind?: Kind };
const COMMON_IDS: readonly IdField[] = [
  { path: 'sources.*.id', supports: false }, { path: 'claims.*.basis.*', supports: true }, { path: 'conflicts.*.sourceIds.*', supports: true },
];
const SKILL_IDS: Record<SkillName, readonly IdField[]> = {
  // duplicateOf: another message of the context (a source_event); a document or revision is not a duplicate of an incoming message.
  intake_analyst: [{ path: 'result.duplicateOf', supports: false, kind: 'source_event' }],
  ba_elicitation: ['userStories', 'rules', 'acceptance'].map(k => ({ path: `result.${k}.*.basis.*`, supports: true })),
  pm_planning: ['milestones', 'actions'].map(k => ({ path: `result.${k}.*.basis.*`, supports: true })),
  technical_writer: ['sections', 'terms'].map(k => ({ path: `result.${k}.*.basis.*`, supports: true })),
  doc_reviewer: [{ path: 'result.baseRevisionId', supports: false, kind: 'document_revision' }, { path: 'result.candidateRevisionId', supports: false, kind: 'document_revision' }],
  release_librarian: [{ path: 'result.approvedRevisionId', supports: false }, { path: 'result.index.*.documentId', supports: false, kind: 'document' },
    { path: 'result.index.*.revisionId', supports: false }, { path: 'result.staleReminders.*.documentId', supports: false, kind: 'document' }],
};
export const ID_FIELDS: Readonly<Record<SkillName, readonly IdField[]>> = Object.freeze(Object.fromEntries(SKILLS.map(k => [k, Object.freeze([...COMMON_IDS, ...SKILL_IDS[k]])])) as Record<SkillName, readonly IdField[]>);

function collect(value: unknown, path: readonly string[]): string[] {
  if (path.length === 0) return typeof value === 'string' ? [value] : [];
  const [head, ...rest] = path;
  if (head === '*') return Array.isArray(value) ? value.flatMap(v => collect(v, rest)) : [];
  return value && typeof value === 'object' && !Array.isArray(value) ? collect((value as Record<string, unknown>)[head], rest) : [];
}
const idsOf = (out: SkillOutput, skill: SkillName, supportsOnly: boolean) =>
  ID_FIELDS[skill].filter(f => !supportsOnly || f.supports).flatMap(f => collect(out, f.path.split('.')).map(id => ({ id, kind: f.kind })));

// True when every leaf of a parsed value is empty: null, '', false, an empty array, or an object whose leaves are all empty. Iterative.
function onlyEmptyLeaves(value: unknown): boolean {
  const stack: unknown[] = [value];
  while (stack.length) {
    const v = stack.pop();
    if (v === null || v === '' || v === false) continue;
    if (Array.isArray(v)) { for (const x of v) stack.push(x); continue; }
    if (v && typeof v === 'object') { for (const x of Object.values(v)) stack.push(x); continue; }
    return false;
  }
  return true;
}

// Every item of `result` that carries a basis (for the empty-basis and pointer-only rules).
function basisItems(skill: SkillName, result: unknown): Item[] {
  switch (skill) {
    case 'ba_elicitation': { const r = result as R['ba_elicitation']; return [...r.userStories, ...r.rules, ...r.acceptance]; }
    case 'pm_planning': { const r = result as R['pm_planning']; return [...r.milestones, ...r.actions]; }
    case 'technical_writer': { const r = result as R['technical_writer']; return [...r.sections, ...r.terms]; }
    default: return [];
  }
}

export function checkSkillOutput(m: { name: SkillName; hash: string; toolAllowlist: readonly string[] }, ctx: SkillContext, raw: unknown): Verdict {
  const measured = measure(raw);
  if (!measured.fits) return hold('SCHEMA_INVALID');
  const parsed = outputSchemas[m.name].safeParse(measured.parsed);
  if (!parsed.success) return hold('SCHEMA_INVALID');
  const out = parsed.data;
  const reasons: HoldReason[] = [];
  const known = new Map(ctx.sources.map(s => [s.id, s] as const));
  if (out.skill !== m.name || out.manifestHash !== m.hash || ctx.skill !== m.name) reasons.push('MANIFEST_MISMATCH');
  if (out.sources.length === 0) reasons.push('SOURCE_REQUIRED');
  const items: Item[] = [...out.claims, ...basisItems(m.name, out.result)];
  if (idsOf(out, m.name, false).some(({ id, kind }) => { const s = known.get(id); return !s || (kind !== undefined && s.kind !== kind); })) reasons.push('SOURCE_OUT_OF_CONTEXT');
  // A statement needs a source: a basis, and for a conflict two distinct sources. What a statement cites must also be listed in `sources`.
  const listed = new Set(out.sources.map(s => s.id));
  const supporting = idsOf(out, m.name, true);
  if (items.some(i => i.basis.length === 0) || out.conflicts.some(c => new Set(c.sourceIds).size < 2)
    || supporting.some(({ id }) => known.has(id) && !listed.has(id))) reasons.push('UNSOURCED_CLAIM');
  if (out.toolRequests.some(t => !m.toolAllowlist.includes(t.tool))) reasons.push('TOOL_NOT_ALLOWED');
  // Any id the output names, in any id field (the plain `sources` list included), must not be a message whose text was not shown: a draft that cites one is held.
  const notShown = idsOf(out, m.name, false).some(({ id }) => { const s = known.get(id); return s?.kind === 'source_event' && !(s.mode === 'excerpt' && s.text !== null); });
  // In a pointer-only context nothing may be said: no claim, no conflict, and every leaf of `result` empty. No per-skill list: a new field is covered by the walk.
  const statements = out.claims.length > 0 || out.conflicts.length > 0 || !onlyEmptyLeaves(out.result);
  if (notShown || (ctx.pointerOnly && statements)) reasons.push('TEXT_NOT_VISIBLE');
  if (m.name === 'release_librarian') {
    const r = out.result as R['release_librarian'];
    const docs = new Map(ctx.sources.flatMap(s => s.kind === 'document' ? [[s.id, s.approvedRevisionId] as const] : []));
    const approvedIds = new Set([...docs.values()].filter((v): v is string => v !== null));
    const listedApproved = r.index.every(i => { const a = docs.get(i.documentId); return a !== undefined && a !== null && a === i.revisionId; });
    if ((r.approvedRevisionId !== null && !approvedIds.has(r.approvedRevisionId)) || !listedApproved) reasons.push('NOT_APPROVED_REVISION');
  }
  return reasons.length ? hold(...reasons) : { verdict: 'accept', reasons: [], output: out };
}

export type WorkType = 'incident' | 'small_bug' | 'technical_upgrade' | 'feature' | 'new_product' | 'document_support';
// SPEC-009 minimum dossier per work type. No skill forces a Git SHA for a purely business document.
export const MINIMUM_DOSSIER: Readonly<Record<WorkType, readonly string[]>> = Object.freeze({
  incident: Object.freeze(['Intake', 'impact', 'hành động khôi phục', 'cách kiểm', 'receipt', 'phần còn nợ']),
  small_bug: Object.freeze(['Trước/sau', 'tái hiện', 'acceptance', 'kiểm hồi quy', 'bản giao']),
  technical_upgrade: Object.freeze(['Change brief', 'ma trận trước–sau', 'tương thích', 'kiểm/rollback', 'UAT liên quan']),
  feature: Object.freeze(['Brief/yêu cầu', 'user story/tiêu chí', 'thiết kế phần đổi', 'test/UAT', 'hướng dẫn']),
  new_product: Object.freeze(['Product brief', 'PRD', 'roadmap', 'kiến trúc/phương án', 'pilot', 'vận hành']),
  document_support: Object.freeze(['Hướng dẫn/biên bản có phiên bản', 'đối tượng dùng', 'ca dùng thử']),
});
