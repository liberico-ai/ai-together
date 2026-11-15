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

/** True when Buffer.byteLength(JSON.stringify(value),'utf8') <= MAX_OUTPUT_BYTES and no string, key or value, at any depth, holds U+0000 or a lone surrogate. */
export function outputFits(value: unknown): boolean {
  let json: unknown;
  try { json = JSON.stringify(value); } catch { return false; }
  if (typeof json !== 'string' || Buffer.byteLength(json, 'utf8') > MAX_OUTPUT_BYTES) return false;
  // Re-read the JSON itself (toJSON already applied); JSON.stringify escapes NUL and lone surrogates, so only decoded strings show them. Iterative: no recursion limit.
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { return false; }
  const stack: unknown[] = [parsed];
  while (stack.length) {
    const v = stack.pop();
    if (typeof v === 'string') { if (!storable(v)) return false; }
    else if (Array.isArray(v)) for (const x of v) stack.push(x);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (!storable(k)) return false; stack.push(x); }
  }
  return true;
}

export type HoldReason = 'SCHEMA_INVALID' | 'MANIFEST_MISMATCH' | 'SOURCE_REQUIRED' | 'SOURCE_OUT_OF_CONTEXT' | 'UNSOURCED_CLAIM' | 'TOOL_NOT_ALLOWED' | 'TEXT_NOT_VISIBLE' | 'NOT_APPROVED_REVISION';
const ORDER: readonly HoldReason[] = ['SCHEMA_INVALID', 'MANIFEST_MISMATCH', 'SOURCE_REQUIRED', 'SOURCE_OUT_OF_CONTEXT', 'UNSOURCED_CLAIM', 'TOOL_NOT_ALLOWED', 'TEXT_NOT_VISIBLE', 'NOT_APPROVED_REVISION'];
type Verdict = { verdict: 'accept' | 'hold'; reasons: HoldReason[]; output: SkillOutput | null };
const hold = (...r: HoldReason[]): Verdict => ({ verdict: 'hold', reasons: ORDER.filter(x => r.includes(x)), output: null });

type Item = { basis: string[] };
type R = { [K in keyof typeof results]: z.infer<typeof results[K]> };

// ONE table of every id-bearing field of an output, per skill. Paths use `*` for an array index. `supports` marks the fields that back a statement
// (their target must be a visible excerpt); the plain `sources` list may point at any context source. A new id field must be added here:
// the gate reads only this table, and the tests fail if a clean output holds a context id at a path that is not listed.
type IdField = { path: string; supports: boolean };
const COMMON_IDS: readonly IdField[] = [
  { path: 'sources.*.id', supports: false }, { path: 'claims.*.basis.*', supports: true }, { path: 'conflicts.*.sourceIds.*', supports: true },
];
const SKILL_IDS: Record<SkillName, readonly IdField[]> = {
  intake_analyst: [{ path: 'result.duplicateOf', supports: false }],
  ba_elicitation: ['userStories', 'rules', 'acceptance'].map(k => ({ path: `result.${k}.*.basis.*`, supports: true })),
  pm_planning: ['milestones', 'actions'].map(k => ({ path: `result.${k}.*.basis.*`, supports: true })),
  technical_writer: ['sections', 'terms'].map(k => ({ path: `result.${k}.*.basis.*`, supports: true })),
  doc_reviewer: [{ path: 'result.baseRevisionId', supports: false }, { path: 'result.candidateRevisionId', supports: false }],
  release_librarian: [{ path: 'result.approvedRevisionId', supports: false }, { path: 'result.index.*.documentId', supports: false },
    { path: 'result.index.*.revisionId', supports: false }, { path: 'result.staleReminders.*.documentId', supports: false }],
};
export const ID_FIELDS: Readonly<Record<SkillName, readonly IdField[]>> = Object.freeze(Object.fromEntries(SKILLS.map(k => [k, Object.freeze([...COMMON_IDS, ...SKILL_IDS[k]])])) as Record<SkillName, readonly IdField[]>);

function collect(value: unknown, path: readonly string[]): string[] {
  if (path.length === 0) return typeof value === 'string' ? [value] : [];
  const [head, ...rest] = path;
  if (head === '*') return Array.isArray(value) ? value.flatMap(v => collect(v, rest)) : [];
  return value && typeof value === 'object' && !Array.isArray(value) ? collect((value as Record<string, unknown>)[head], rest) : [];
}
const idsOf = (out: SkillOutput, skill: SkillName, supportsOnly: boolean) =>
  ID_FIELDS[skill].filter(f => !supportsOnly || f.supports).flatMap(f => collect(out, f.path.split('.')));

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
  if (!outputFits(raw)) return hold('SCHEMA_INVALID');
  const parsed = outputSchemas[m.name].safeParse(raw);
  if (!parsed.success) return hold('SCHEMA_INVALID');
  const out = parsed.data;
  const reasons: HoldReason[] = [];
  const known = new Map(ctx.sources.map(s => [s.id, s] as const));
  if (out.skill !== m.name || out.manifestHash !== m.hash || ctx.skill !== m.name) reasons.push('MANIFEST_MISMATCH');
  if (out.sources.length === 0) reasons.push('SOURCE_REQUIRED');
  const items: Item[] = [...out.claims, ...basisItems(m.name, out.result)];
  if (idsOf(out, m.name, false).some(id => !known.has(id))) reasons.push('SOURCE_OUT_OF_CONTEXT');
  if (items.some(i => i.basis.length === 0)) reasons.push('UNSOURCED_CLAIM');
  if (out.toolRequests.some(t => !m.toolAllowlist.includes(t.tool))) reasons.push('TOOL_NOT_ALLOWED');
  const notShown = idsOf(out, m.name, true).some(id => { const s = known.get(id); return s?.kind === 'source_event' && s.mode !== 'excerpt'; });
  const statements = out.claims.length > 0 || out.conflicts.length > 0 || items.some(i => i.basis.length > 0);
  if (notShown || (ctx.pointerOnly && statements)) reasons.push('TEXT_NOT_VISIBLE');
  if (m.name === 'release_librarian') {
    const r = out.result as R['release_librarian'];
    const docs = new Map(ctx.sources.flatMap(s => s.kind === 'document' ? [[s.id, s.approvedRevisionId] as const] : []));
    const approvedIds = new Set([...docs.values()].filter((v): v is string => v !== null));
    const listed = r.index.every(i => { const a = docs.get(i.documentId); return a !== undefined && a !== null && a === i.revisionId; });
    if ((r.approvedRevisionId !== null && !approvedIds.has(r.approvedRevisionId)) || !listed) reasons.push('NOT_APPROVED_REVISION');
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
