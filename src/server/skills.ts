import { createHash } from 'node:crypto';
import intakeAnalystManifest from '../../skills/intake-analyst/manifest.json';
import baElicitationManifest from '../../skills/ba-elicitation/manifest.json';
import pmPlanningManifest from '../../skills/pm-planning/manifest.json';
import technicalWriterManifest from '../../skills/technical-writer/manifest.json';
import docReviewerManifest from '../../skills/doc-reviewer/manifest.json';
import releaseLibrarianManifest from '../../skills/release-librarian/manifest.json';
import intakeAnalystEval from '../../skills/intake-analyst/eval.json';
import baElicitationEval from '../../skills/ba-elicitation/eval.json';
import pmPlanningEval from '../../skills/pm-planning/eval.json';
import technicalWriterEval from '../../skills/technical-writer/eval.json';
import docReviewerEval from '../../skills/doc-reviewer/eval.json';
import releaseLibrarianEval from '../../skills/release-librarian/eval.json';
import { checkSkillOutput } from './skill-contracts';
import type { ContextSource, SkillContext, SkillName } from './skill-contracts';

// Slice 3, Task 11: static manifests of the six PM/BA skills and the mock-output eval harness. Pure: no I/O, no clock, no model, no network.
// A manifest grants nothing: no tool, no model, not enabled. Its hash covers the prompt and eval hashes, so any edit of a skill file shows.
export type SkillManifest = {
  name: SkillName; version: string; owner: string; attribution: { ref: string; note: string }[]; prompt: { path: string; sha256: string };
  inputContract: 'SkillContext/v1'; outputContract: string; toolAllowlist: string[];
  dataScope: { projectScope: 'single'; kinds: ContextSource['kind'][]; ibsHi: 'pointer_hash_metadata_only'; hiddenText: 'never' };
  evalSet: { path: string; sha256: string; cases: 5 }; modelBinding: 'none'; enabled: false; hash: string;
};

export const EVAL_CATEGORIES = ['fabrication_when_missing', 'injection', 'conflicting_sources', 'revoked_access', 'same_name_other_bu'] as const;
export type EvalCheck = { path: string; minLength?: number; equals?: unknown };
export type EvalCase = { id: string; category: typeof EVAL_CATEGORIES[number]; context: SkillContext; good: unknown; bad: unknown; badReasons: string[]; checks: EvalCheck[] };

function deepFreeze<T>(v: T): T {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.freeze(v); for (const x of Object.values(v)) deepFreeze(x); }
  return v;
}

const manifests = {
  intake_analyst: intakeAnalystManifest, ba_elicitation: baElicitationManifest, pm_planning: pmPlanningManifest,
  technical_writer: technicalWriterManifest, doc_reviewer: docReviewerManifest, release_librarian: releaseLibrarianManifest,
} as unknown as Record<SkillName, SkillManifest>;
const evals = {
  intake_analyst: intakeAnalystEval, ba_elicitation: baElicitationEval, pm_planning: pmPlanningEval,
  technical_writer: technicalWriterEval, doc_reviewer: docReviewerEval, release_librarian: releaseLibrarianEval,
} as unknown as Record<SkillName, { cases: EvalCase[] }>;

export const skillManifests: Readonly<Record<SkillName, SkillManifest>> = deepFreeze(manifests);
export const skillEvalSets: Readonly<Record<SkillName, { readonly cases: readonly EvalCase[] }>> = deepFreeze(evals);

/** JSON with keys sorted by code unit order at every depth, array order kept, no whitespace. Throws on a value JSON cannot carry. */
export function canonicalJson(v: unknown): string {
  if (v === null) return 'null';
  switch (typeof v) {
    case 'string': return JSON.stringify(v);
    case 'boolean': return v ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(v)) throw new TypeError('canonicalJson: non-finite number');
      return JSON.stringify(v);
    case 'object': {
      if (Array.isArray(v)) {
        if (Object.keys(v).length !== v.length) throw new TypeError('canonicalJson: sparse array');
        return `[${v.map(canonicalJson).join(',')}]`;
      }
      const proto = Object.getPrototypeOf(v);
      if (proto !== Object.prototype && proto !== null) throw new TypeError('canonicalJson: not a plain object');
      const o = v as Record<string, unknown>;
      return `{${Object.keys(o).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
    }
    default: throw new TypeError(`canonicalJson: ${typeof v} cannot be carried by JSON`);
  }
}

export function manifestHash(m: Omit<SkillManifest, 'hash'>): string {
  return createHash('sha256').update(canonicalJson(m), 'utf8').digest('hex');
}

function pick(root: unknown, path: string): unknown {
  let cur = root;
  for (const k of path.split('.')) {
    if (cur === null || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, k)) return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}
function checkHolds(output: unknown, c: EvalCheck): boolean {
  const v = pick(output, c.path);
  if (v === undefined) return false;
  if (c.minLength !== undefined && !((typeof v === 'string' || Array.isArray(v)) && v.length >= c.minLength)) return false;
  if ('equals' in c) { try { if (canonicalJson(v) !== canonicalJson(c.equals)) return false; } catch { return false; } }
  return true;
}

/** Fills `skill` and `manifestHash` from the manifest (the eval file cannot hold its own manifest hash), runs the gate, then the case's checks. */
export function runEvalCase(m: SkillManifest, c: EvalCase, output: unknown): { pass: boolean; reasons: string[] } {
  const filled = output !== null && typeof output === 'object' && !Array.isArray(output) ? { ...output, skill: m.name, manifestHash: m.hash } : output;
  const reasons: string[] = [...checkSkillOutput({ name: m.name, hash: m.hash, toolAllowlist: m.toolAllowlist }, c.context, filled).reasons];
  for (const check of c.checks) if (!checkHolds(filled, check)) reasons.push(`CHECK_FAILED:${check.path}`);
  return { pass: reasons.length === 0, reasons };
}
