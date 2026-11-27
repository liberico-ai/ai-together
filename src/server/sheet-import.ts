import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { readSheetCsv, SHEET_LIMITS, type SheetRow } from './csv';
import type { Database, Queryable } from './db';
import { AppError, invariant } from './errors';
import { demoProfiles } from './identities';
import { reportingDomainLabel, type ReportingDomain } from './projects-registry';
import { sourceHostProblem } from './source-hosts';
import { cellsFingerprint, dueIssue } from './source-snapshot';
import { projectRole } from './types';
import type { Principal } from './types';
import { requestScope } from './work-requests';
import { ibsLabel } from './ibs-label';

// Import of the PM's team work list (tab «Đầu việc Tech», exported as CSV): a preview that writes nothing, then a commit that files every valid row as a pending
// work request (origin 'import') for a BoM seat to approve, exactly as PR A's rule says (migration 024). Identity and tenant come from the principal only. The cells
// are kept as written; a blank or ambiguous cell stays blank and is flagged, never guessed. A repeated import writes nothing new: the idempotency is three UNIQUE keys
// (the STT over tenant, source and sheet; the code and the content over those and the importer) and INSERT … ON CONFLICT DO NOTHING (migration 027), never check-then-insert. The service does not touch WorkRequestService.submit/decide,
// work_items or bom_sources. IBS HI rows: the free-text note is never stored, echoed or logged (holding default 25/11/2026).
const uuid = z.string().uuid();
const base64 = z.string().min(1).max(Math.ceil(SHEET_LIMITS.fileBytes / 3) * 4 + 8).regex(/^[A-Za-z0-9+/]+={0,2}$/).refine(v => v.length % 4 === 0);
/** The only tab this import reads (the header check already limits a file to it). Compared and stored in NFC. */
export const SHEET_NAME = 'Đầu việc Tech';
const sheetName = z.string().trim().min(1).max(100).refine(v => v.normalize('NFC') === SHEET_NAME, 'Chỉ nhận trang «' + SHEET_NAME + '».').transform(() => SHEET_NAME);
// the name of the exported file the PM picked (M8 câu 6, 0.9.2): kept on the batch with its hash and time, never a path
const fileName = z.string().trim().min(1).max(255).refine(v => !/[\/\\\p{Cc}]/u.test(v), 'Chỉ ghi tên tệp, không ghi đường dẫn.');
const envelopeShape = { fileBase64: base64, sourceUrl: z.string().min(1).max(1000), sheet: sheetName, fileName: fileName.optional() };
const projectPair = z.object({ buLabel: z.string().min(1).max(100), projectId: uuid }).strict();
const ownerPair = z.object({ text: z.string().min(1).max(SHEET_LIMITS.cellChars), projectId: uuid, userId: uuid }).strict();
// the preview may be told the mapping the commit will use (the digest does not depend on it); left out, it uses the defaults
const previewSchema = z.object({ ...envelopeShape, projects: z.array(projectPair).max(50).optional(), owners: z.array(ownerPair).max(SHEET_LIMITS.dataRows).optional() }).strict();
const commitSchema = z.object({
  ...envelopeShape, previewDigest: z.string().regex(/^[a-f0-9]{64}$/), requestKey: uuid,
  projects: z.array(projectPair).max(50), owners: z.array(ownerPair).max(SHEET_LIMITS.dataRows),
}).strict();
/** The switch of the whole import: off unless the operator turns it on after the PM confirms the source (EV-10). */
export const workImportEnabled = () => process.env.LIBETECH_WORK_IMPORT === '1';

export type Verdict = 'valid' | 'duplicate' | 'needs_reconciliation';
export type RowResult = { row: number; stt: string; result: 'imported' | 'duplicate' | 'needs_reconciliation'; reasons: string[]; flags: string[] };
export type Group = { label: string; rows: number; valid: number; needsReconciliation: number; duplicate: number };
export type Counts = { byBuLabel: Group[]; byReportingDomain: Group[] };
export type PreviewRow = { row: number; stt: string; buLabel: string; title: string; code: string | null; titleOnly: boolean; owner: string; collaborators: string; status: string; due: string; result: Verdict; reasons: string[]; flags: string[] };
export type Candidate = { userId: string; name: string; projectIds: string[] };
export type ImportPreview = {
  fileHash: string; previewDigest: string; source: { sourceId: string; sourceUrl: string; sheet: string }; rows: PreviewRow[];
  buLabels: { label: string; rows: number; defaultProjectId: string | null }[]; owners: { text: string; rows: number; candidates: Candidate[] }[];
  counts: Counts; catalog: { id: string; name: string; bu: string }[];
};
export type ImportReceipt = { id: string; replayed: boolean; fileHash: string; fileName: string | null; previewDigest: string; sourceId: string; sheet: string; createdAt: string; counts: Counts; results: RowResult[] };
export type ImportAnnotation = { sourceStatus: string; dueRaw: string; sourceRef: string; sourceId: string; sheet: string; stt: string; buLabel: string; ownerRaw: string; flags: string[]; batchId: string };
export type PeopleSource = (p: Principal) => Promise<Principal[]>;

const denied = () => new AppError('IMPORT_DENIED', 'Chỉ thành viên Team Tech, hoặc điều phối của mọi dự án đích, được nhập bảng việc. Nhờ điều phối dự án nhập giúp, hoặc nhờ người quản trị thêm bạn vào Team Tech.', 403);
const scopeDenied = () => new AppError('SCOPE_DENIED', 'Không tìm thấy dự án trong phạm vi được cấp. Chọn một dự án trong danh sách.', 404);
const notFound = () => new AppError('NOT_FOUND', 'Không tìm thấy biên nhận trong phạm vi được cấp. Mở lại biên nhận từ lần nhập của chính bạn.', 404);
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const chars = (v: string) => [...v].length;
const KNOWN_STATUS = new Set(['Chưa làm', 'Đang làm', 'Hoàn thành', 'Tạm dừng']);
const STT = /^[A-Za-z0-9._-]{1,40}$/;
/** Flags that record a policy of this import, not a defect of the sheet: they do not lower the quality score. */
const POLICY_FLAGS = new Set(['IBS_NOTE_NOT_STORED', 'OWNER_NOT_MAPPED', 'CODE_FROM_NOTE']);
const DEFAULT_NAMES: Record<string, string> = { XECA: 'XECA · Team Tech', LBRC: 'LBRC · Team Tech', 'IBS HI': 'IBS HI · Team Tech' };

/** The importer's view of people: the directory the rest of the service uses (demo profiles in demo, the identity directory otherwise). */
const defaultPeople: PeopleSource = async p => {
  if (process.env.LIBETECH_DEMO === '1') return Object.values(demoProfiles);
  const { identityService } = await import('./identity');
  return identityService().directory(p);
};

// ---------------------------------------------------------------- the file, row by row (pure)
type Facts = {
  row: number; stt: string; bu: string; title: string; owner: string; collab: string; status: string; due: string; note: string; ref: string;
  fingerprint: string; contentHash: string; code: string | null; codeCount: number; codeFromNote: boolean; ownerKind: 'none' | 'single' | 'multi'; dueAt: string | null; dueFlag: string | null;
  blocks: string[]; existing: string | null;
};
const CODE_TOKEN = /(?<![A-Za-z0-9-])[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*(?![A-Za-z0-9-])/g;
// «Tách LBRC015», «tách ra khỏi mã LBRC015, LBRC016»: in a note, the codes right after the split words name the work this row was split from. They are references,
// never the row's own code. The words match in any letter case; a code stays upper case, as in codesIn, and needs a digit here, so «tách khỏi XECA, LBRC046» takes
// nothing. Any other wording is read as before: two rows that then claim one code both wait.
const anyCase = (word: string) => [...word].map(c => `[${c}${c.toUpperCase()}]`).join('');
const REFERENCE_CODE = String.raw`(?=[A-Z0-9-]*\d)${CODE_TOKEN.source}`;
const SPLIT_REFERENCE = new RegExp([
  String.raw`(?<![\p{L}\p{N}_-])${anyCase('tách')}`,
  String.raw`(?:\s+${anyCase('ra')})?(?:\s+(?:${anyCase('từ')}|${anyCase('khỏi')}))?(?:\s+${anyCase('mã')}(?:\s+${anyCase('việc')})?)?`,
  String.raw`\s*(?::\s*)?${REFERENCE_CODE}(?:\s*(?:[,/&+]|${anyCase('và')})\s*${REFERENCE_CODE})*`,
].join(''), 'gu');
/** The note as its own codes are read from it: in NFC, so a decomposed «tách» is the same word, and without the split references. The stored note is not changed. */
const withoutSplitReferences = (note: string) => note.normalize('NFC').replace(SPLIT_REFERENCE, ' ');
function codesIn(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(CODE_TOKEN)) if (/\d/.test(m[0]) && /^[A-Z0-9][A-Z0-9-]{2,39}$/.test(m[0])) found.add(m[0]);
  return [...found];
}
function dueIso(raw: string): string | null {
  if (!raw || dueIssue(raw)) return null;
  const s = /^\d{4}-\d{2}-\d{2} 00:00:00$/.test(raw) ? raw.slice(0, 10) : raw;
  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s), slashes = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (iso) [y, m, d] = iso.slice(1).map(Number);
  else if (slashes) [d, m, y] = slashes.slice(1).map(Number);
  else return null;
  // the same convention as the form of PR A: the due day at 16:00 Vietnam time
  return new Date(`${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T16:00:00+07:00`).toISOString();
}
/** The work code is read from the title; when the title holds none, from the note, but only for a row that is not title-only (M8 câu 7 (2), 0.9.2: LBRC and XECA);
 * a code the note names as the source of a split is not the row's own (0.9.7).
 * `titleOnly(label)`: the row is, or may become, IBS HI (or has no target): its note is never read, and its fingerprint and content hash are taken with the note cell
 * blanked, so no hash, answer or request field depends on the note. */
function analyze(rows: SheetRow[], sourceId: string, sheet: string, titleOnly: (label: string) => boolean): Facts[] {
  const facts: Facts[] = rows.map(({ row, cells }) => {
    const [stt, bu, title, owner, collab, status, due, note] = cells;
    const only = titleOnly(bu);
    const fromTitle = codesIn(title);
    const codes = fromTitle.length || only ? fromTitle : codesIn(withoutSplitReferences(note));
    const hashed = only ? [...cells.slice(0, 7), ''] : cells;
    const ownerKind = !owner ? 'none' : /[,;/&\n]|\s+và\s+|\s+and\s+/i.test(owner) ? 'multi' : 'single';
    const blocks: string[] = [];
    if (!stt) blocks.push('MISSING_STT'); else if (!STT.test(stt)) blocks.push('INVALID_STT');
    if (chars(title) < 5 || chars(title) > 200) blocks.push('TITLE_LENGTH');
    return { row, stt, bu, title, owner, collab, status, due, note, ref: `${sourceId}/${sheet}!A${row}:H${row}`,
      fingerprint: cellsFingerprint(hashed), contentHash: sha256(JSON.stringify(hashed.slice(1))),
      code: codes.length === 1 ? codes[0] : null, codeCount: codes.length, codeFromNote: !fromTitle.length && codes.length > 0, ownerKind, dueAt: dueIso(due), dueFlag: due ? dueIssue(due) : 'MISSING_DUE', blocks, existing: null };
  });
  // two rows of one file that share an STT, a work code or a content: both wait, neither wins
  for (const [key, reason] of [['stt', 'DUPLICATE_STT'], ['code', 'DUPLICATE_CODE_IN_FILE'], ['contentHash', 'DUPLICATE_CONTENT_IN_FILE']] as const) {
    const seen = new Map<string, number>();
    for (const f of facts) { const v = f[key]; if (v) seen.set(v, (seen.get(v) ?? 0) + 1); }
    for (const f of facts) { const v = f[key]; if (v && (seen.get(v) ?? 0) > 1) f.blocks.push(reason); }
  }
  return facts;
}
// ---------------------------------------------------------------- decisions per row (pure)
type Target = { projectId: string; name: string; ibs: boolean; domain: ReportingDomain | null; filer: boolean };
type Decision = { f: Facts; target: Target | null; assignee: string | null; verdict: Verdict; reasons: string[]; flags: string[]; ibs: boolean };
function decide(facts: Facts[], targetOf: (label: string) => Target | null, ownerOf: (text: string, projectId: string) => string | null, existingCodes: Set<string>): Decision[] {
  return facts.map(f => {
    const target = targetOf(f.bu);
    const ibs = ibsLabel(f.bu) || (target?.ibs ?? false);
    const assignee = f.ownerKind === 'single' && target ? ownerOf(f.owner, target.projectId) : null;
    const reasons = [...f.blocks];
    if (!target) reasons.push('UNMAPPED_BU');
    // the database decides who may file into a project (work_request_filer, migration 024); a row of a project the importer may not file into waits, the others go on
    else if (!target.filer) reasons.push('NOT_A_FILER');
    // an unchanged row that was imported and since approved names a work item of its own: that is «trùng», not a clash
    if (target?.filer && f.code && f.existing !== 'DUPLICATE' && existingCodes.has(target.projectId + '|' + f.code)) reasons.push('CODE_EXISTS');
    if (f.existing && f.existing !== 'DUPLICATE') reasons.push(f.existing);
    const flags: string[] = [];
    if (f.ownerKind === 'none') flags.push('MISSING_OWNER'); else if (f.ownerKind === 'multi') flags.push('MULTI_OWNER'); else if (!assignee) flags.push('OWNER_NOT_MAPPED');
    if (f.dueFlag) flags.push(f.dueFlag);
    if (!f.status) flags.push('MISSING_STATUS'); else if (!KNOWN_STATUS.has(f.status)) flags.push('UNKNOWN_STATUS');
    if (f.codeCount > 1) flags.push('MULTI_CODE');
    if (f.codeFromNote) flags.push('CODE_FROM_NOTE');
    if (ibs && f.note) flags.push('IBS_NOTE_NOT_STORED');
    const verdict: Verdict = reasons.length ? 'needs_reconciliation' : f.existing === 'DUPLICATE' ? 'duplicate' : 'valid';
    return { f, target, assignee, verdict, reasons, flags, ibs };
  });
}
function tally(items: { key: string; label: string; verdict: Verdict | RowResult['result'] }[]): Group[] {
  const groups = new Map<string, Group>();
  for (const { key, label, verdict } of items) {
    const g = groups.get(key) ?? { label, rows: 0, valid: 0, needsReconciliation: 0, duplicate: 0 };
    g.rows++;
    if (verdict === 'valid' || verdict === 'imported') g.valid++; else if (verdict === 'duplicate') g.duplicate++; else g.needsReconciliation++;
    groups.set(key, g);
  }
  return [...groups.values()];
}
/** A confirmed domain groups its projects; a project with no confirmed domain is its own group, «Chưa xác nhận · <tên dự án>»: unconfirmed projects are never folded into one figure. */
const domainGroup = (t: Target) => t.domain ? { key: 'domain:' + t.domain, label: reportingDomainLabel(t.domain) } : { key: 'project:' + t.projectId, label: reportingDomainLabel(null) + ' · ' + t.name };
function countsOf(items: { f: Facts; target: Target | null; verdict: Verdict | RowResult['result'] }[]): Counts {
  return {
    byBuLabel: tally(items.map(i => ({ key: i.f.bu || '(trống)', label: i.f.bu || '(trống)', verdict: i.verdict }))),
    // a row with no target project has no reporting domain to count under
    byReportingDomain: tally(items.filter(i => i.target).map(i => ({ ...domainGroup(i.target!), verdict: i.verdict }))),
  };
}
const safeStt = (stt: string) => STT.test(stt) ? stt : '';

// ---------------------------------------------------------------- source link
function sourceOf(url: string): { sourceId: string; sourceUrl: string } {
  const rejected = () => new AppError('SOURCE_URL_REJECTED', 'Dán liên kết của bảng nguồn: https://docs.google.com/spreadsheets/d/…', 422);
  if (sourceHostProblem('drive', url)) throw rejected();
  const u = new URL(url);
  const key = /^\/spreadsheets\/d\/([A-Za-z0-9_-]{10,100})(?:\/|$)/.exec(u.pathname)?.[1];
  if (u.hostname !== 'docs.google.com' || !key) throw rejected();
  const gid = u.searchParams.get('gid') ?? /(?:^#|&)gid=([0-9]{1,12})/.exec(u.hash)?.[1] ?? null;
  if (gid !== null && !/^[0-9]{1,12}$/.test(gid)) throw rejected();
  // the spreadsheet key alone is the source; the gid is metadata of the link (the tab is pinned by name and by the header check)
  return { sourceId: key, sourceUrl: `https://docs.google.com/spreadsheets/d/${key}/edit${gid ? '?gid=' + gid : ''}` };
}

class BatchRaced extends Error {}

type ProjectInfo = { id: string; name: string; bu: string };
type Access = { tech: boolean; managed: string[]; catalog: ProjectInfo[] };
export class SheetImportService {
  constructor(private db: Database, private people: PeopleSource = defaultPeople) {}
  private run<T>(p: Principal, fn: (tx: Queryable) => Promise<T>, readOnly = false): Promise<T> {
    // the scope of the work-request flow: a Team Tech member with no project yet still imports (M6); a BoM Tech reads the import rows of the requests they decide
    // through the row policy (work_request_seat), never through a wider scope
    return requestScope(this.db, p, async tx => {
      if (readOnly) await tx.query('SET TRANSACTION READ ONLY');
      return fn(tx);
    });
  }
  /** Who is importing: a Team Tech member (every project of the tenant) or the manager of some project (those projects). The bot and everybody else are refused. */
  private async access(tx: Queryable, p: Principal): Promise<Access> {
    if (!p || p.role === 'bot') throw denied();
    const tech = (await tx.query<{ ok: boolean }>('SELECT public.app_actor_is_tech_member() AS ok')).rows[0].ok === true;
    const managed = p.projectIds.filter(id => projectRole(p, id) === 'manager');
    if (!tech && !managed.length) throw denied();
    const catalog = tech
      ? (await tx.query<ProjectInfo>('SELECT id,name,bu FROM public.tech_project_catalog()')).rows
      : (await tx.query<ProjectInfo>('SELECT id,name,bu FROM projects WHERE id=ANY($1::uuid[]) ORDER BY name,id', [managed])).rows;
    return { tech, managed, catalog };
  }
  private async facts(tx: Queryable, projectId: string, name: string, bu: string): Promise<Target> {
    // the same function that gates every insert into work_requests: Tech roster, or an active manager of that very project in scope
    const filer = (await tx.query<{ ok: boolean }>('SELECT public.work_request_filer($1) AS ok', [projectId])).rows[0]?.ok === true;
    const f = (await tx.query<{ bu: string | null; domain_code: ReportingDomain | null }>('SELECT bu,domain_code FROM public.work_import_project_facts($1)', [projectId])).rows[0];
    const domain = f?.domain_code ?? null;
    return { projectId, name: name || '(dự án ngoài phạm vi)', domain, filer, ibs: ibsLabel(bu) || ibsLabel(f?.bu) || domain === 'IBS_HI' };
  }
  private read(raw: { fileBase64: string; sourceUrl: string; sheet: string }) {
    const { sourceId, sourceUrl } = sourceOf(raw.sourceUrl);
    const file = readSheetCsv(Buffer.from(raw.fileBase64, 'base64'));
    return { ...file, sourceId, sourceUrl, sheet: raw.sheet };
  }
  private digestOf(fileHash: string, sourceId: string, sheet: string, facts: Facts[]) {
    return sha256(JSON.stringify([fileHash, sourceId, sheet, facts.map(f => [f.row, f.stt, f.fingerprint, f.blocks, f.existing])]));
  }
  /** Names, per row, why its keys are already held for this source and sheet (one SECURITY DEFINER answer: a class per row, nothing else). Preview and commit both ask it. */
  private async conflicts(tx: Queryable, facts: Facts[], sourceId: string, sheet: string): Promise<void> {
    const rows = (await tx.query<{ idx: number; class: string | null }>('SELECT idx,class FROM public.work_import_key_conflicts($1,$2,$3::text[],$4::text[],$5::text[],$6::text[])',
      [sourceId, sheet, facts.map(f => f.stt), facts.map(f => f.code), facts.map(f => f.contentHash), facts.map(f => f.fingerprint)])).rows;
    const byIndex = new Map(rows.map(r => [Number(r.idx), r.class]));
    facts.forEach((f, i) => { f.existing = byIndex.get(i + 1) ?? null; });
  }
  /** label → project for the labels of this file, checked against what the importer may import into; the targets carry the IBS HI and domain facts. */
  private async targetsOf(tx: Queryable, acc: Access, labels: string[], chosen: { buLabel: string; projectId: string }[] | undefined) {
    const mapped = new Map<string, string>();
    if (!chosen) for (const label of labels) {
      const name = DEFAULT_NAMES[label];
      const same = name ? acc.catalog.filter(c => c.name === name && c.bu === label) : [];
      if (same.length === 1) mapped.set(label, same[0].id);
    }
    for (const m of chosen ?? []) {
      invariant(!mapped.has(m.buLabel), 'INVALID_MAPPING', 'Mỗi nhãn BU chỉ ánh xạ tới một dự án. Bỏ bớt một ánh xạ rồi xem trước lại.', 422);
      if (labels.includes(m.buLabel)) mapped.set(m.buLabel, m.projectId);
    }
    const targetIds = [...new Set(mapped.values())];
    // a Team Tech member names projects of the tenant's catalog only; for anybody else a project they cannot file into is not an error: its rows get NOT_A_FILER
    if (acc.tech) for (const id of targetIds) if (!acc.catalog.some(c => c.id === id)) throw scopeDenied();
    const targets = new Map<string, Target>();
    for (const [label, id] of mapped) targets.set(label, await this.facts(tx, id, acc.catalog.find(c => c.id === id)?.name ?? '', label));
    return { mapped, targetIds, targets };
  }
  /** Confirmed owners: a person the importer sees as an engineer of that target project, or a Team Tech member (any target project, M2), bound to the cell text
   * only when the account name is that text. */
  private async ownersOf(tx: Queryable, p: Principal, people: Principal[], targetIds: string[], given: { text: string; projectId: string; userId: string }[]): Promise<Map<string, string>> {
    const owners = new Map<string, string>();
    const performers = given.length ? (await tx.query<{ user_id: string; name: string }>('SELECT user_id,name FROM public.tech_performers_among($1::uuid[])', [[...new Set(given.map(o => o.userId))]])).rows : [];
    for (const o of given) {
      const person = people.find(x => x.id === o.userId);
      const engineer = !!person && person.name === o.text && p.projectIds.includes(o.projectId) && person.projectIds.includes(o.projectId) && projectRole(person, o.projectId) === 'engineer';
      const tech = performers.some(x => x.user_id === o.userId && x.name === o.text);
      invariant(targetIds.includes(o.projectId) && (engineer || tech),
        'OWNER_NOT_IN_PROJECT', 'Người phụ trách đã chọn không phải người thực hiện của dự án đích, cũng không thuộc Team Tech. Chọn người khác hoặc để trống.', 422);
      owners.set(o.projectId + '\u0000' + o.text, o.userId);
    }
    return owners;
  }
  private titleOnlyOf = (targets: Map<string, Target>) => (label: string) => { const t = targets.get(label); return ibsLabel(label) || !t || t.ibs || !t.filer; };

  async preview(p: Principal, raw: unknown): Promise<ImportPreview> {
    const input = previewSchema.parse(raw);
    return this.run(p, async tx => {
      const acc = await this.access(tx, p);
      const file = this.read(input);
      // the digest is read from an analysis that does not depend on the mapping: every row is read as if it were IBS HI (hashes without the note)
      const strict = analyze(file.rows, file.sourceId, file.sheet, () => true);
      await this.conflicts(tx, strict, file.sourceId, file.sheet);
      const labels = [...new Set(file.rows.map(r => r.cells[1]))];
      const { targetIds, targets } = await this.targetsOf(tx, acc, labels, input.projects);
      const people = await this.people(p);
      const owners = await this.ownersOf(tx, p, people, targetIds, input.owners ?? []);
      const titleOnly = this.titleOnlyOf(targets);
      const facts = analyze(file.rows, file.sourceId, file.sheet, titleOnly);
      await this.conflicts(tx, facts, file.sourceId, file.sheet);
      const codes = await this.codesTaken(tx, facts, [...targets.values()]);
      const decisions = decide(facts, label => targets.get(label) ?? null, (text, projectId) => owners.get(projectId + '\u0000' + text) ?? null, codes);
      const defaults = (await this.targetsOf(tx, acc, labels, undefined)).mapped;
      return {
        fileHash: file.fileHash, previewDigest: this.digestOf(file.fileHash, file.sourceId, file.sheet, strict),
        source: { sourceId: file.sourceId, sourceUrl: file.sourceUrl, sheet: file.sheet },
        rows: decisions.map(d => ({ row: d.f.row, stt: d.f.stt, buLabel: d.f.bu, title: d.f.title, code: d.f.code, titleOnly: titleOnly(d.f.bu), owner: d.f.owner, collaborators: d.f.collab, status: d.f.status, due: d.f.due,
          result: d.verdict, reasons: d.reasons, flags: d.flags })),
        buLabels: labels.map(label => ({ label, rows: facts.filter(f => f.bu === label).length, defaultProjectId: defaults.get(label) ?? null })),
        owners: await this.ownerCandidates(tx, p, people, facts, acc.catalog.map(c => c.id)), counts: countsOf(decisions.map(d => ({ f: d.f, target: d.target, verdict: d.verdict }))), catalog: acc.catalog,
      };
    }, true);
  }

  private async codesTaken(tx: Queryable, facts: Facts[], targets: (Target | null)[]): Promise<Set<string>> {
    const codes = [...new Set(facts.map(f => f.code).filter((c): c is string => !!c))];
    const projects = [...new Set(targets.filter((t): t is Target => !!t).map(t => t.projectId))];
    if (!codes.length || !projects.length) return new Set();
    const rows = (await tx.query<{ project_id: string; code: string }>('SELECT project_id,code FROM work_items WHERE project_id=ANY($1::uuid[]) AND code=ANY($2::text[])', [projects, codes])).rows;
    return new Set(rows.map(r => r.project_id + '|' + r.code));
  }
  /** People the importer can already see as engineers of a project of their own scope, and Team Tech members (every project the importer may import into),
   * matched by exact name. Nobody is ticked for them. */
  private async ownerCandidates(tx: Queryable, p: Principal, people: Principal[], facts: Facts[], catalog: string[]) {
    const texts = new Map<string, number>();
    for (const f of facts) if (f.ownerKind === 'single') texts.set(f.owner, (texts.get(f.owner) ?? 0) + 1);
    const tech = texts.size ? (await tx.query<{ user_id: string; name: string }>('SELECT user_id,name FROM public.tech_performers_named($1::text[])', [[...texts.keys()]])).rows : [];
    return [...texts].map(([text, rows]) => {
      const engineers = people.filter(x => x.name === text).flatMap(x => {
        const projectIds = x.projectIds.filter(id => p.projectIds.includes(id) && projectRole(x, id) === 'engineer');
        return projectIds.length ? [{ userId: x.id, name: x.name, projectIds }] : [];
      });
      const members = tech.filter(x => x.name === text && !engineers.some(e => e.userId === x.user_id)).map(x => ({ userId: x.user_id, name: x.name, projectIds: catalog }));
      return { text, rows, candidates: [...engineers, ...members.filter(m => m.projectIds.length)] };
    });
  }

  async commit(p: Principal, raw: unknown): Promise<ImportReceipt> {
    const input = commitSchema.parse(raw);
    for (let attempt = 0; ; attempt++) {
      try { return await this.commitOnce(p, input); }
      catch (e) { if (!(e instanceof BatchRaced) || attempt > 0) throw e; }
    }
  }

  private async commitOnce(p: Principal, input: z.infer<typeof commitSchema>): Promise<ImportReceipt> {
    return this.run(p, async tx => {
      const acc = await this.access(tx, p);
      // the same key and the same preview and mapping: the receipt already stored; the same key and anything else: a conflict. Read before the preview is checked, because the
      // rows this very batch wrote make a fresh preview say «duplicate».
      const mappingHash = sha256(JSON.stringify([input.projects.map(m => [m.buLabel, m.projectId]).sort(), input.owners.map(o => [o.text, o.projectId, o.userId]).sort()]));
      const old = (await tx.query<BatchRow>('SELECT * FROM work_import_batches WHERE tenant_id=$1 AND importer_id=$2 AND request_key=$3', [p.tenantId, p.id, input.requestKey])).rows[0];
      if (old) {
        // the file name is data of the write too (OQ-62 câu 6): another name, or a name where there was none, under the same key is another import
        invariant(old.preview_digest === input.previewDigest && old.mapping_hash === mappingHash && (old.file_name ?? null) === (input.fileName ?? null),
          'IDEMPOTENCY_CONFLICT', 'Mã thao tác đã được dùng với một lần nhập khác. Tải lại trang rồi xem trước lại.', 409);
        return receiptOf(old, true);
      }
      const file = this.read(input);
      const strict = analyze(file.rows, file.sourceId, file.sheet, () => true);
      await this.conflicts(tx, strict, file.sourceId, file.sheet);
      invariant(this.digestOf(file.fileHash, file.sourceId, file.sheet, strict) === input.previewDigest, 'PREVIEW_STALE', 'Tệp hoặc dữ liệu đã đổi so với lúc xem trước. Xem trước lại trước khi ghi.', 409);

      const labels = [...new Set(file.rows.map(r => r.cells[1]))];
      const { mapped, targetIds, targets } = await this.targetsOf(tx, acc, labels, input.projects);
      const owners = await this.ownersOf(tx, p, await this.people(p), targetIds, input.owners);
      // hashes and the stored note are decided now that the target projects are known: an IBS HI row, or a row with no target, is read without its note
      const facts = analyze(file.rows, file.sourceId, file.sheet, this.titleOnlyOf(targets));
      await this.conflicts(tx, facts, file.sourceId, file.sheet);
      const codes = await this.codesTaken(tx, facts, [...targets.values()]);
      const decisions = decide(facts, label => targets.get(label) ?? null, (text, projectId) => owners.get(projectId + '\u0000' + text) ?? null, codes);

      const batchId = randomUUID();
      const results: RowResult[] = new Array(decisions.length);
      // rows are filed in STT order: two overlapping imports then take their key locks in the same order and cannot deadlock (40P01)
      const order = decisions.map((_, i) => i).sort((a, b) => (decisions[a].f.stt < decisions[b].f.stt ? -1 : decisions[a].f.stt > decisions[b].f.stt ? 1 : a - b));
      for (const i of order) {
        const d = decisions[i];
        let result: RowResult['result'] = d.verdict === 'valid' ? 'imported' : d.verdict, reasons = d.reasons;
        if (d.verdict === 'valid') {
          const filed = await this.file(tx, p, batchId, file, d);
          if (!filed.ok) { result = filed.reason === 'DUPLICATE' ? 'duplicate' : 'needs_reconciliation'; reasons = filed.reason === 'DUPLICATE' ? [] : [filed.reason]; }
        }
        results[i] = { row: d.f.row, stt: safeStt(d.f.stt), result, reasons, flags: d.flags };
      }
      const counts = countsOf(decisions.map((d, i) => ({ f: d.f, target: d.target, verdict: results[i].result })));
      const made = (await tx.query<BatchRow>(`INSERT INTO work_import_batches(id,tenant_id,importer_id,importer_name,request_key,preview_digest,file_hash,source_id,source_url,sheet,counts,mapping,mapping_hash,results,file_name)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (tenant_id,importer_id,request_key) DO NOTHING RETURNING *`,
        [batchId, p.tenantId, p.id, p.name, input.requestKey, input.previewDigest, file.fileHash, file.sourceId, file.sourceUrl, file.sheet,
          JSON.stringify(counts), JSON.stringify(Object.fromEntries(mapped)), mappingHash, JSON.stringify(results), input.fileName ?? null])).rows[0];
      // a twin of this very call won the key while this one worked: nothing of this transaction stays, and the call reads the twin's receipt
      if (!made) throw new BatchRaced();
      return receiptOf(made, false);
    });
  }

  /** One valid row: the key row first (ON CONFLICT DO NOTHING), then — only when the key row went in — the request and its first event. */
  private async file(tx: Queryable, p: Principal, batchId: string, file: { sourceId: string; sheet: string }, d: Decision): Promise<{ ok: true } | { ok: false; reason: string }> {
    const f = d.f, project = d.target!.projectId, requestId = randomUUID();
    const flags = d.flags;
    const quality = Math.max(0, 100 - 20 * flags.filter(x => !POLICY_FLAGS.has(x)).length);
    const keyed = (await tx.query<{ id: string }>(`INSERT INTO work_import_rows(tenant_id,project_id,importer_id,batch_id,request_id,source_id,sheet,source_row,stt,source_ref,code,fingerprint,content_hash,
        bu_label,owner_raw,collaborators_raw,source_status,due_raw,source_note,flags,quality_score)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) ON CONFLICT DO NOTHING RETURNING id`,
      [p.tenantId, project, p.id, batchId, requestId, file.sourceId, file.sheet, f.row, f.stt, f.ref, f.code, f.fingerprint, f.contentHash, f.bu, f.owner, f.collab, f.status, f.due,
        d.ibs ? '' : f.note, flags, quality])).rows[0];
    if (!keyed) {
      const one = { ...f, existing: null as string | null };
      await this.conflicts(tx, [one], file.sourceId, file.sheet);
      return { ok: false, reason: one.existing ?? 'KEY_HELD_ELSEWHERE' };
    }
    // the request hash is a hash of the stored request fields only: nothing of the sheet row (note included) goes into it
    const requestHash = sha256(JSON.stringify([project, f.ref, f.title, f.code, f.dueAt, d.assignee]));
    await tx.query(`INSERT INTO work_requests(id,tenant_id,project_id,requester_id,requester_name,origin,source_ref,request_key,request_hash,code,title,priority,due_at,criteria,spec_url,assignee_id,technical_id,business_id)
      VALUES($1,$2,$3,$4,$5,'import',$6,$7,$8,$9,$10,'normal',$11,'',NULL,$12,NULL,NULL)`,
      [requestId, p.tenantId, project, p.id, p.name, f.ref, randomUUID(), requestHash, f.code, f.title, f.dueAt, d.assignee]);
    await tx.query(`INSERT INTO work_request_events(tenant_id,project_id,request_id,requester_id,actor_id,kind,payload) VALUES($1,$2,$3,$4,$4,'submitted',$5)`,
      [p.tenantId, project, requestId, p.id, JSON.stringify({ origin: 'import', batchId, sourceRef: f.ref })]);
    return { ok: true };
  }

  /** The batch receipt for the importer: counts, row numbers, reason codes. No cell text. */
  async receipt(p: Principal, id: string): Promise<ImportReceipt> {
    if (!p || p.role === 'bot') throw denied();
    if (!uuid.safeParse(id).success) throw notFound();
    return this.run(p, async tx => {
      const row = (await tx.query<BatchRow>('SELECT * FROM work_import_batches WHERE id=$1', [id])).rows[0];
      if (!row) throw notFound();
      return receiptOf(row, false);
    }, true);
  }

  /** What the sheet said about each imported request, for the requester and the BoM seats of its project (the screen of pending requests shows it beside the request). */
  async annotations(p: Principal, requestIds: string[]): Promise<Record<string, ImportAnnotation>> {
    invariant(p && p.role !== 'bot', 'READ_ONLY', 'Vai này chỉ được đọc dữ liệu trong phạm vi dự án.', 403);
    const ids = requestIds.filter(i => uuid.safeParse(i).success).slice(0, 200);
    if (!ids.length) return {};
    return this.run(p, async tx => {
      const rows = (await tx.query<{ request_id: string; source_status: string; due_raw: string; source_ref: string; source_id: string; sheet: string; stt: string; bu_label: string; owner_raw: string; flags: string[]; batch_id: string }>(
        `SELECT request_id,source_status,due_raw,source_ref,source_id,sheet,stt,bu_label,owner_raw,flags,batch_id FROM work_import_rows
         WHERE request_id=ANY($1::uuid[]) AND (importer_id=$2 OR public.work_request_seat(project_id))`, [ids, p.id])).rows;
      return Object.fromEntries(rows.map(r => [r.request_id, { sourceStatus: r.source_status, dueRaw: r.due_raw, sourceRef: r.source_ref, sourceId: r.source_id, sheet: r.sheet, stt: r.stt,
        buLabel: r.bu_label, ownerRaw: r.owner_raw, flags: r.flags, batchId: r.batch_id }]));
    }, true);
  }
}

type BatchRow = { id: string; preview_digest: string; mapping_hash: string; file_hash: string; file_name: string | null; source_id: string; sheet: string; created_at: string | Date; counts: Counts; results: RowResult[] };
function receiptOf(row: BatchRow, replayed: boolean): ImportReceipt {
  return { id: row.id, replayed, fileHash: row.file_hash, fileName: row.file_name ?? null, previewDigest: row.preview_digest, sourceId: row.source_id, sheet: row.sheet, createdAt: new Date(row.created_at).toISOString(), counts: row.counts, results: row.results };
}
