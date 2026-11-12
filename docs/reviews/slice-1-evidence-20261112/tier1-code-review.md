# Final whole-branch review (tier 1, code) — slice 1 P1.0

Branch `slice-1-doc-ownership`, base `208d37b`, head `46439aa` (19 commits, 60 files, +3595/−27).
Reviewer: liberico-code-reviewer. Advisory only — this is a recommendation to the Chairman, not an approval.

## Verdict

**CHANGES** — one combined fix wave, then ready for the Codex gate. No Critical finding. Six Important items (three are the user-approved UI defects, confirmed present at head), all small.

What I verified myself (#fact):
- Read every new/changed file under `src/`, `migrations/`, `scripts/`, and the test files' structure; read the brief, constraints and ledger.
- `npx tsc --noEmit` → no output, exit 0.
- `npx vitest run` (PGlite) at `46439aa` → `Test Files 18 passed | 2 skipped (20)`, `Tests 162 passed | 8 skipped (170)`, 64 s. Working tree still clean afterwards.
- `git diff --stat 208d37b..HEAD -- bot-plugin deploy AGENTS.md migrations/001…012` → empty.

What I did NOT verify (#hypothesis until someone shows output):
- Native PostgreSQL run after Task 17 (ledger's 89/89 predates commit `46439aa`; the 8 skipped tests are exactly the native-only concurrency/role cases, including the OQ-24 cross-project race). The receipt must attach a native run at the final head.
- Coverage numbers (92.69/80.92/94.69/93.93 are the ledger's), `npm run build`, pytest.

Cross-task consistency — checked and found consistent (#fact):
- Error codes/messages: `IDEMPOTENCY_REQUIRED`/`IDEMPOTENCY_CONFLICT` identical text in `service.ts:58,64` and `documents.ts:48-49`; `SCOPE_DENIED` 404 with one sentence for "missing" and "out of scope" (`documents.ts:9-10`, `document-index.ts:8-9`, `projects-registry.ts:34,38`); `REVISION_CONFLICT` 409 in both services; `ZodError` → 422 `INVALID_INPUT` (`http.ts:11`); `SOURCE_UNAVAILABLE` message carries no URI.
- Write paths: register / proposeRevision / saveProfile / proposeChannel each run in one `scoped()` transaction, with dedup claim (`document_commands` for documents, `commands` for registry), `INSERT … ON CONFLICT DO NOTHING` (no SELECT-then-INSERT), version check, and a `registry_events` row in the same transaction; a thrown conflict rolls back the claim, the write and the event.
- No actor/tenant from body: all zod schemas `.strict()`; identity from `Principal` only.
- Bot: rejected first in every service entry point; bridge change is the version string only.
- Reporting domain: list/search/export require `projectId` (R1); `project_domain_mappings` has no runtime INSERT grant and no row in migration/seed/fixtures (test `document-cases.test.ts:110`).
- P1.0 gates in DB: `014:110-111` (approved NULL, SOURCE_NOT_FROZEN, not-configured), `014:126` (self_declared, snapshot NULL), column grant `014:137` (runtime cannot touch `approved_revision_id`/`freeze_state`); in UI: neutral «Chưa có», «Hash tự khai — chưa kiểm», no «đã duyệt».
- Migrations 013–015: BEGIN/COMMIT, IF NOT EXISTS, DROP/CREATE policy pairs, ENABLE+FORCE RLS, USING+WITH CHECK, `schema_migrations` row; rollbacks mirror them; forward→rollback→forward test exists.
- No database URLs, passwords or tokens in the diff (grep over the package). Chat IDs in tests are `-1009990001/2` (#inference: synthetic). The three LBRC014 commit SHAs in `tests/slice1-cases.ts:10-12` are required by the brief and are not secrets.

## Findings

### Important (fix in the wave, before merge)

**I1 — No-match search shows the empty-registry copy and the register button** (user-approved defect 1, confirmed)
- `src/components/documents.tsx:57-58`; state computed in `src/components/documents-view.ts:9` (`rows === 0 → 'empty'`).
- Scenario: project has 12 documents, user searches «abc» → «Chưa có tài liệu đã đăng ký» + «Đăng ký tài liệu». User concludes the registry is empty and re-registers.
- Minimal fix: keep the applied term in state (`const [applied,setApplied]=useState('')`, set inside `load(term)`; do not use the live input `q`). Pass `searchTerm={applied}` to `DocumentsBody`; in the `empty` branch, when `searchTerm` is non-empty render «Không có tài liệu khớp “{term}” trong dự án này» + a «Xoá tìm kiếm» button (`setQ(''); load('')`), no register button. Add one markup test for each copy.

**I2 — After a successful register nothing tells the user why the list did not change** (user-approved defect 2, confirmed)
- `src/components/documents.tsx:89` (`setForm(false); await load(q)`), index is refreshed only by the operator projector (OQ-22 b).
- Scenario: POST 201, list unchanged; on a first-ever registration the page still says «Chưa có tài liệu đã đăng ký» — also after a reload. User registers again and gets `DOCUMENT_ALREADY_REGISTERED`.
- Minimal fix: (a) on success set a notice rendered with `role="status"`: «Đã đăng ký “{title}”. Tài liệu sẽ hiện trong danh sách sau lần chiếu chỉ mục kế tiếp. {projectedAt ? 'Chỉ mục cập nhật lúc '+formatTime(projectedAt) : 'Chỉ mục chưa được chiếu lần nào'}.» using `page.projectedAt` after the reload; (b) make the persistent empty copy projection-aware, e.g. «Chưa có tài liệu trong chỉ mục» + the same projection-time line, so the message survives a page reload. Update `docs/UI-HANDOFF-1-documents.md` §4.

**I3 — «Mở nguồn» opens the popup after an `await`; a blocked popup is silent** (user-approved defect 3, confirmed)
- `src/components/documents.tsx:24-25`. With `noreferrer`, `window.open` returns `null` even on success, so blocking cannot be detected.
- Scenario: Safari blocks the popup (no user activation after the fetch); nothing happens, no message.
- Minimal fix: store the fetched URI in state and render, under the button, `<a className="doc-action" href={uri} target="_blank" rel="noreferrer">Mở nguồn ở thẻ mới</a>` with a line «Nếu thẻ mới không tự mở, bấm liên kết này». Render the link only when `uri.startsWith('https://')`; clear it at the start of each click so every open still goes through the per-call scope check. Keeping the `window.open` attempt is optional (drop it to avoid a double tab on browsers that allow it).

**I4 — `canRegister` uses the collapsed session role, not the role in this project**
- `src/app/documents/page.tsx:16` (`principal.role`), while the server uses `projectRole(p, projectId)` (`documents.ts:103-104`). `identity.ts:50` sets `role` to `'viewer'` whenever a user's grants differ across projects.
- Scenario: a user who is manager in project A and engineer in project B has session role `viewer` → no «Đăng ký tài liệu» button in either project although the API would accept the write. Reverse case (uniform session role but viewer grant) cannot occur, so this is a lost capability, not a leak.
- Minimal fix: `const canRegister = !!projectId && !['viewer','bot'].includes(projectRole(principal, projectId));` (import from `@/server/types`).

**I5 — No operator path fills the template index outside the demo seed**
- `syncTemplateIndex` is called only from `src/server/seed.ts:40`; `seed()` runs only in the embedded demo branch (`src/server/db.ts:51-56`). Runtime has SELECT only on `document_templates` (`014:133`). The form offers T0–T6 from the manifest, not from the index (`src/app/documents/page.tsx:17`).
- Scenario: on any server-mode database the index is empty; every registration that picks a template returns 422 `TEMPLATE_UNKNOWN`, and the only way to fill the table is ad-hoc SQL (against E-EXT-03/AR-08 spirit: no manual SQL for production data). The brief's «AI OS giữ chỉ mục mẫu» holds in code and tests but is not operable.
- Minimal fix: add `scripts/sync-document-templates.ts <tenantId>` shaped like `scripts/project-document-index.ts` (operator URL, `db.transaction(tx => syncTemplateIndex(tx, tenantId))`, print `{inserted}`), and list it next to the projector under the deployment stop point in the receipt. If the controller prefers not to add a script in this wave, record it explicitly in DELIVERY-010 as a deployment prerequisite — do not leave it implicit.

**I6 — Tenant-isolation tests miss the cross-scope UPDATE dimension (Quality Gate 34c)**
- Updatable-by-runtime tables: `project_profiles` (`013:92-96`, grant `013:103`), `document_records` (`014:113-117`, grant `014:137`), `document_commands` (`014:87-91`, grant `014:136`). Tests cover no-context SELECT and cross-scope INSERT, and in-scope UPDATEs, but no test runs an UPDATE as a principal scoped to another project/tenant (grep: no such statement in `tests/`). Ledger carried this for Task 7 as a deferred minor; with Task 9/17 it now spans three tables.
- Scenario: a later edit drops a `USING` clause or widens a policy; nothing goes red. The policies look correct today (#inference from reading the SQL) — the gap is evidence, and the gate is 100% with no waiver without owner + expiry.
- Minimal fix (tests only): for each of the three tables, create a row in `ids.transport`, then as `member` (sales only) and as `outsider` (other tenant) run `UPDATE … WHERE id=$1 RETURNING id` inside `scoped()` → expect 0 rows and the row unchanged when read by the operator. Runs on both engines through the harness.

### Minor — worth doing in the same wave (each is a few lines)

- **M1** `tests/document-cases.test.ts:69,75,83` and `tests/slice1-cases.ts:2,6` — three Xeca-data tests and the two Xeca constants lack the «synthetic — chờ tin gốc» label the other two carry (ledger T13 "for final wave"). Rename/comment only.
- **M2** `migrations/rollback/014_document_registry.sql:3` — `CASCADE` lets 014 be rolled back while 015 is still applied: the FK from `analytics.document_index` is dropped silently and `schema_migrations` still lists 015. Remove `CASCADE` (the four tables are dropped in one statement, which resolves their mutual FKs) so an out-of-order rollback fails loudly; re-run the rollback test on both engines.
- **M3** `migrations/014_document_registry.sql:40,73` — `document_revisions` has no index led by its `FOREIGN KEY(project_id,tenant_id)` (the only index starts with `document_id`); the global constraint says "index for every FK in the same file". 014 has never been applied to real data, so add `idx_document_revisions_scope_created(tenant_id,project_id,created_at DESC)` in place. Defer to the database reviewer's call if they disagree.
- **M4** `src/server/documents.ts:142-143` — the `revision_proposed` event payload has `expectedVersion` but no `versionBefore`/`versionAfter`, unlike `document_registered` (`:118`), `profile_saved` and `channel_proposed` (`projects-registry.ts:80,92`). Add both for a uniform audit shape.
- **M5** `src/server/integration-status.ts:14` — comment still says «OQ-23 undecided»; it was decided (a) on 12/11. Comment only.
- **M6** `src/components/documents.tsx:79-80` and `docs/UI-HANDOFF-1-documents.md` §6 — the UI never sends `limit`, so it shows at most 50 rows with no paging, while the handoff says "200 dòng (trần API)". Either send `limit=200` (client and `page.tsx:23`) or correct the handoff; documents past row 50 are otherwise reachable only by search.
- **M7** `src/app/documents/page.tsx:24` — add `key={projectId ?? 'picker'}` on `<Documents>` (ledger T15). Navigation today is a full page load so it is not a live bug; it becomes one the day the picker uses `next/link`.

### Minor — leave (record in the receipt where noted)

- `src/server/documents.ts:74,76,82`, `document-index.ts:55`, `projects-registry.ts:26` — output mappers hard-code `classification`, `freeze_state`, `hash_verification`, `snapshot_ref`, channel `state` instead of echoing the row. Correct for P1.0 (DB gates make the values equal) but must be removed when slice 3 introduces approval/freeze, or the API will misreport. Receipt: carry to slice 3.
- `src/server/documents.ts:90-93` — `load()` returns all revisions and events of a record without a limit. Fine at P1.0 volumes; paginate with the detail screen.
- `src/server/document-index.ts:77` — export stops at 5000 rows without saying so; `:80` no UTF-8 BOM, so Excel may garble Vietnamese titles. Receipt note.
- `scripts/project-document-index.ts:4` — one project per run; a scheduled job needs the project list. Belongs to the deployment stop point (OQ-22 b).
- `migrations/rollback/013_project_registry.sql:3` — dropping `registry_events` also removes document events written by 014's services; nothing enforces 014-before-013 order. Test-copy only by rule; leave.
- `migrations/014…:35` — `quality_score numeric(3,2)` in 0..1, whereas E-EXT-01 words it as 0–100 INT. I did not check which scale earlier migrations use (#hypothesis: repo precedent); revisions here are pointers, not ingested external rows. Leave; database reviewer may rule.
- `src/server/documents-http.ts:38` — a replayed register also answers 201. Cosmetic.
- `src/server/projects-registry.ts:57-60` — `registry()` returns `chat_id` of proposed channels to every project member including viewers. In scope by design (members of the project); note for slice 2 when channels become effective.

## Triage of ledger minors

| Ledger line | Decision | Why |
|---|---|---|
| T1 harness RLS assertion weak | leave | every new table has its own no-context test with seeded rows |
| T1 openHarness no reset on open | leave | suites call `h.reset()` before seeding |
| T1 no advisory lock / pool close on failure | leave | `fileParallelism:false`; test-only |
| T1 native-prepare ignores admin DB name | leave | loopback + port pinned; it only creates a new database |
| T2 waitForBlocked counts any waiter | leave | isolated DB, serial files |
| T2 replays take the report lock | leave | inherent to lock-first ordering |
| T2 unobserved promise on timeout | leave | test-only |
| T4+5 `.bridge-labels` contrast | closed | rule present in `globals.css` (12px, #c9d8d2) |
| T4+5 version test scans source text | leave | adequate guard against re-hard-coding |
| T6 no template source-drift guard | leave | manifest hash test pins file bytes |
| T7 no cross-project/tenant UPDATE test on profiles | **fix now** | finding I6 (extended to all three updatable tables) |
| T7 rollback test checks tables only | leave | acceptable for throwaway copy |
| T7 runtime UPDATE/DELETE on history untested | leave | trigger tested; runtime has no UPDATE/DELETE grant |
| T7 registry_events lacks request_id/trace_id | leave, receipt | repo-wide (E-DB-13); needs `scoped()` change — name an owner |
| T8 DB does not enforce status transitions | leave | E-DB-05: business rule in application (R5) |
| T8 expectedVersion 0 on existing profile → status conflict | leave | both are 409; unpinned edge |
| T8 ZodError → 4xx | closed | `http.ts:11`, test `documents-http.test.ts:64` |
| T9 `p?.role` style, href > 1000 after normalise, host-case test, tenant set in seed tx | leave | no behavioural risk found |
| T10 url sourceRef stored un-normalised | leave | validated; display only |
| T10 R8 test lacks positive control | leave | positive path exercised by every register test |
| T11 rollback revoke not asserted; empty-array case; redundant USAGE | leave | harmless |
| T12 partial-result guard untested; duplicate bot check; weak assertion | leave | defensive code |
| T12 export 5000 cap silent; formula guard and leading whitespace | leave, receipt | see "leave" list |
| T13 Xeca tests/constants lack «chờ tin gốc» | **fix now** | M1; the brief forbids reading Xeca cases as «đạt» |
| T13 openSource `denied` branch untested etc. | leave | same branch as `unavailable`, which is tested |
| T14 `Number(v)` on limit, more unrouted paths, missing-key only for register, redundant try/catch | leave | zod rejects 0/NaN; behaviour correct |
| T15 window.open after await | **fix now** | I3 |
| T15 no-match copy | **fix now** | I1 |
| T15 missing `key={projectId}` | fix now (trivial) | M7 |
| T15 `lastSuccessAt` dead prop | leave | reserved for the detail screen; documented in handoff |
| Manual check: register gives no confirmation | **fix now** | I2 |
| Manual check: screenshots not saved, error/loading not reproduced in browser | leave, receipt | state as "not done" in DELIVERY-010 |
| T16 projector file function coverage 54.5% | leave | threshold is global; file is exercised by index tests |
| T17 RLS-hidden branch on proposeRevision indirect; `old.response` null | leave | covered natively by the cross-project race test; null cannot commit |

## Quality Gate checklist — items that fail, are partial, or N/A

Everything not listed passed on reading (#fact for code, #hypothesis for runs I did not see).

| # | Item | Result | Evidence |
|---|---|---|---|
| 05 | Pagination | pass for list/search (50 default, 200 cap, `total`); partial for record detail (unbounded revisions/events) | `document-index.ts:18`, `documents.ts:90-93` |
| 16 | FK + created_at index in same migration | partial | `document_revisions` project FK, M3 |
| 19 | Audit log on critical mutation | partial | events are append-only and in-transaction; `request_id`/`trace_id` absent (`013:36-43`), repo-wide backlog — needs named owner |
| 20–22 | Vue frontend rules | N/A | Next.js profile applies |
| 24 | Event envelope | N/A | no queue in this slice |
| 28–30 | External data fields / price type / pipeline | N/A for pricing; revisions carry the four source fields; score scale differs from rule wording (see "leave") |
| 32–33 | Structured log with request_id / trace id | partial, pre-existing | `http.ts:13` logs failures only; no change in this slice |
| 34a/b/d/e | Isolation: read, write, no-context, bypass | pass | per-table tests; `db.ts:19-20,47-48`; native test that the web login cannot assume the projector role |
| 34c | Isolation: cross-scope UPDATE/DELETE → 0 rows | **fail (tests missing)** | I6 |
| 35–36 | Coverage ≥60 / ≥40 | not verified by me | ledger figure only; attach the coverage output |
| 40 | Transactional outbox | N/A | no side-effect after commit in this slice |
| 44–45 | Python domain logic / AI writes Z4 only | N/A | none |
| M-01…M-03 | Version, idempotent, rollback | pass | run-twice and forward→rollback→forward test |
| M-04…M-07 | Drop/NOT NULL/large table/rename | N/A | new tables only |
| R-01…R-06 | Release checklist | N/A at «đã có mã»; deployment is a Chairman stop point |
| CI | Enforcement state | `manual` — I found no evidence that CI blocks on these checks for this repo; do not cite a gate as CI-enforced |
| PR | Title/description discipline | not yet applicable | commit subjects follow `<type>(<scope>): …`; PR body must cite DECISION-PACK §5 and must not touch `AGENTS.md` (coordinator note) |

## One-paragraph verdict

**NEEDS WORK → one fix wave.** The branch is architecturally sound and consistent across tasks: scoped transactions, atomic idempotency in the right table per OQ-24, immutable events, P1.0 gates enforced in both the database and the screen, Z2-only listing with no cross-project totals, and migrations with working rollbacks. Before the Codex gate, land I1–I6 (three approved UI fixes, the per-project `canRegister`, the template-index operator path or an explicit receipt entry, and the cross-scope UPDATE isolation tests) plus the cheap minors M1–M7, then attach a native PostgreSQL run and coverage output taken at the final head.
