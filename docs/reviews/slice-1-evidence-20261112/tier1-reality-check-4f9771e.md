# Reality check — slice 1 (P1.0) at 4f9771e

- **Reviewer:** liberico-reality-checker. Advisory only (R1/R2). This is a recommendation, not an approval; acceptance belongs to the Chairman.
- **Pinned:** branch `slice-1-doc-ownership`, head `4f9771e` (merge of `libetech-ai-os` @ `ac01cf2`), slice base `208d37b`. I tested a `git archive 4f9771e` copy, not the working tree.
- **Date:** 2026-11-12, 18:10–18:40 local.
- **Independence:** I did not build any of this. The UI check, test logs and fix reports in the ledger come from the maker side (controller and builders). I treated them as claims and re-ran what I could.
- **Scope limits:** read-only. I did not use the loopback PostgreSQL container, d1-ai1 or `.runtime/`, and did not use Codex output (`docs/reviews/slice-1-evidence-20261112/codex-round-1.md` is 0 bytes).

> ⚠ **The worktree moved while I was checking.** Uncommitted edits appeared in `docs/UI-HANDOFF-1-documents.md`, `src/app/documents/page.tsx`, `tests/document-cases.test.ts` and `tests/document-index.test.ts`, plus new untracked `src/server/page-session.ts` and `tests/page-session.test.ts`. These edits add a DOC-18 «stale» state, a `pendingProjection` freshness signal and page-session handling. This verdict covers **4f9771e only**. Any new commit needs a new PGlite and native run before the receipt cites it.

## 1. Claim and criteria

The claim under test: slice 1 meets its «Đạt khi» and the receipt `DELIVERY-010` can be written.

Criteria sources:
- `docs/SLICE-BRIEFS.md:5-16` (common rules), `:54-83` (slice 1, with the test table at `:58-69`), and the «Đạt khi» of slice 1 at `:77-83`.
- `.claude/commands/slice.md:35-40`.
- Decisions OQ-22, OQ-23 and OQ-24, decided 12/11 (`docs/OPEN-QUESTIONS.md:233-261`). OQ-25 is still open (`:263-271`).

## 2. Probes, fixed before running

| # | Probe | Type |
|---|---|---|
| P0 | Re-run the full PGlite suite at 4f9771e on a clean copy; also typecheck, pytest and build | happy path |
| P1 | Which tests skip, and whether any acceptance case runs only on one engine | adversarial |
| P2 | Two-way trace: every criterion → test, and every test claim → criterion (MISSING and EXTRA) | adversarial |
| P3 | Read 5 high-value tests closely: does each attack the design or only confirm it? | adversarial |
| P4 | Is the "native" log really native? | adversarial |
| P5 | Items that exist only as claims: screenshots, UI checklist, review outputs, receipt | adversarial |
| C1–C4 | Failing-fixture controls: weaken one control in a scratch copy and see whether the suite turns red | control |

## 3. Raw evidence I produced

Scratch copy root: `/private/tmp/claude-501/-Users-huyenleduy-Documents-GitHub-libetech-ai-os--claude-worktrees-jolly-dewdney-bbabf0/cae6abc8-02fa-40b6-8d01-6c3f73cc32d9/scratchpad`. The logs below are in that folder.

| Ref | What | Result |
|---|---|---|
| E1 `rc-pglite-head.log` | `vitest run`, PGlite, on the head copy | exit 0. 19 files passed, 2 skipped; 202 tests passed, 8 skipped. This matches `test-results/slice-1-head-pglite-20261112T1805.log`. |
| E2 `rc-tsc-head.log` | `tsc --noEmit` on a clean copy with no `.next` | exit 0, empty output |
| E3 `rc-pytest-head.log` | pytest, `test_bot_bridge.py` + `test_install_user.py` | exit 0, 16 passed; `test_bot_bridge.py` alone has 11 passed |
| E4 `rc-build-head.log` | `next build` on the copy | exit 1, an environment artifact: the copy's `node_modules` is a symlink and Turbopack refuses it. **Not a code defect, but the build is not independently reproduced.** I rely on `test-results/slice-1-head-build-20261112T1809.log` («✓ Compiled successfully», route list includes `/documents`). That log has no exit code recorded. |
| E5 `rc-c1.log` | **C1:** remove the `project_id` clause from the `scope_insert` WITH CHECK of `project_channels` and `project_profiles` (013) | **8 files, 112/112 green.** The control does NOT fail. |
| E6 `rc-c2.log` | **C2:** remove the `project_id` clause from `document_records` `scope_insert` (014) | **red:** `documents.test.ts > runtime cannot insert for another project or tenant` |
| E7 `rc-c3.log` | **C3:** revert OQ-24, i.e. put `project_id` back into the `document_commands` UNIQUE, `ON CONFLICT` and lookup | **red:** both cross-project OQ-24 tests |
| E8 `rc-c4.log` | **C4:** delete every `FORCE ROW LEVEL SECURITY` line in 013–015 (9 lines) | **112/112 green.** The control does NOT fail. |
| E9 | `git diff --stat 208d37b..4f9771e -- bot-plugin deploy dashboard-plugin migrations/001…012` | empty; protected paths untouched |
| E10 | `git branch -r --contains 4f9771e` | empty; the commit is not pushed |
| E11 | `git grep` for an `INSERT INTO project_domain_mappings` in src, scripts, migrations and deploy | none. Only test fixtures insert, using the operator connection. |
| E12 | `ls docs/screenshots`, plus a search of `docs/` for images | only older files (`LibeTech-AI-OS-*.jpg`, `activate-0.2.0.png`); **no screenshot of the Tài liệu screen** |
| E13 | `git check-ignore` | `.superpowers/` is excluded by `.git/info/exclude`, so the ledger and tier-1 reviews are not in the repo |
| E14 | `ls docs/DELIVERY-01*` | no match; the receipt does not exist yet |

**Native run (P4), inferred from the code, not observed by me.** `test-results/slice-1-head-native-20261112T1805.log` shows 21 files and 210/210 tests with 0 skipped. Three facts support that it really ran against PostgreSQL:
- The `describe.skipIf(!native)` suites ran, so `SLICE1_TEST_DATABASE_URL` was set.
- `assertIsolated` (`tests/slice1-db.ts:8-17`) only accepts `127.0.0.1:55471/slice1_verify*`.
- `document-index.test.ts:96-104` ("web login cannot assume the projector role") passes only if `h.db` is a restricted login, not the operator.

**Caveats on the native run:**
- The log has no per-test listing and no environment echo.
- I could not re-run it.
- `feedback-idempotency.test.ts` and the older suites (foundation, identity, spec003/004, team-catalog, onboarding-feedback) use `embeddedDatabase`, so they are **PGlite in both runs**.

## 4. Verdict per «Đạt khi» item

| Criterion | Verdict | Evidence |
|---|---|---|
| `npm run test` / `typecheck` / `build` green, output kept | **VERIFIED** for test and typecheck (E1, E2). **PARTIAL** for build: log only, E4. | E1, E2, head logs |
| `tests/test_bot_bridge.py` green if the bot is touched | **VERIFIED** (bot-plugin not touched, E9; 11 passed, E3) | E3, E9 |
| DOC-01: unmapped group reads nothing, writes nothing | **VERIFIED** (synthetic) | `project-registry.test.ts` "a proposed channel grants nothing": signed bridge call → `SCOPE_DENIED`, and all registry tables are unchanged |
| DOC-07: a new revision does not move the approved pointer | **VERIFIED** | `documents.test.ts` "proposing a revision moves only the draft pointer": the approved pointer is set first, then a proposal, and the pointer is unchanged |
| DOC-10: cross project/BU blocked on list, search, open source, export; errors leak nothing | **VERIFIED** (synthetic) | `document-index.test.ts` "cross-project and cross-tenant reads are denied before any query" includes `sameBuProject`, a 0-DB-call proxy and a no-leak regex. Also export denied, openSource → 404 with no name, HTTP 404 with the generic message. |
| DOC-13: XECA006 ≠ XECA005 | **VERIFIED on synthetic data; must be stated as «chờ tin gốc»** | `document-cases.test.ts` DOC-13; fixtures labelled in `tests/slice1-cases.ts:2` |
| DOC-14: LBRC014 keeps the old and iOS revisions, three SHAs, present and missing parts | **VERIFIED** (fixture, repo-derived SHAs) | `document-cases.test.ts` DOC-14 |
| DOC-18: lost source → history kept, state **stale/unknown**, no auto-delete | **PARTIAL** | History is kept and nothing is deleted (`document-cases.test.ts` DOC-18, `document-index.test.ts` "a lost source keeps its history"). **At 4f9771e no state changes when the source row disappears.** Only the computed `present:false` changes on the link; `source_state` and the index stay the same. The uncommitted worktree edits add the `stale` state, which confirms the gap at head. |
| PM-08: indexing leaves Z2 source hash and row count unchanged | **VERIFIED** (2 synthetic rows) | `document-cases.test.ts` PM-08: md5 digest and count are the same before and after, including a projector run |
| R-01: replay, `FEEDBACK_KEY_CONFLICT`, conflict for another document/revision | **VERIFIED, with an engine gap** | Feedback: `feedback-idempotency.test.ts` (8 cases) runs on **PGlite only**; native has only 3 race/cross-project cases (`feedback-concurrency.test.ts`). Documents: same-project and cross-project cases on both engines; native race with a lock barrier. **Gap: the brief asks for both engines for every case that touches the DB; feedback R-01 non-race cases have no native run.** |
| R-02: same BU, other project blocked; membership revoked → blocked; projector re-run no duplicates; lost source keeps history | **VERIFIED, with a caveat on revocation** | The revocation test builds a new Principal object; it does not delete `identity.memberships` and go through the session. Session code does recompute grants on every request (`src/server/identity.ts:132-138`, `:38-51`), so the behaviour holds by code reading (#inference), but no end-to-end test covers it. |
| Nine negative cases (1)–(9) | **8 VERIFIED, 1 PARTIAL** | See §5 |
| Three migrations and the projector run twice without error or duplicate | **VERIFIED** (throwaway DBs) | `migrations-rollback.test.ts` applies forward ×2; `document-index.test.ts` runs the projector ×2 with count = 2 |
| Each rollback runs forward → back → forward **on a copy** | **VERIFIED on a throwaway synthetic DB; NOT on a copy of real data** | `migrations-rollback.test.ts`; `fix-wave-db.test.ts` item 1 restores an identical catalog (constraints, indexes, policies, column grants) and refuses out-of-order rollback |
| `analytics.tech_source_tasks` / `work_items` counts unchanged before/after | **VERIFIED around the migration cycle; PARTIAL around the projector** | The rollback test measures both. Around the projector only `tech_source_tasks` is measured (PM-08); `work_items` is measured around register, not around the projector. The projector SQL writes only `analytics.document_index` (#inference from `src/server/document-projector.ts`). |
| UI shows four states at 360px and ≥1200px | **PARTIAL** | All four states and no-results exist as markup tests (`documents-ui.test.tsx`). In a browser, the controller observed ready at 1280, the list at 360 (scrollWidth 360, 0 targets under 44px), and denied. Error and loading were **never rendered in a browser** (ledger: "only markup tests"). The ≥1200 check covers ready only. That check is maker-side; I did not reproduce it. |
| `docs/UI-HANDOFF-1-documents.md` exists with six sections | **VERIFIED** (§1–§6 present) | — |
| Screenshots in `docs/screenshots/` | **NOT MET** | E12. The handoff checklist `:76-81` is all `[ ]`, and «Việc chưa làm» says «Ảnh chụp (chưa có công cụ trình duyệt)». |
| Tài liệu screen = list **+ detail** (`SLICE-BRIEFS.md`, Giao diện) | **NOT MET for detail** | The handoff lists «chi tiết tài liệu» under «Việc chưa làm». Detail exists only as an API. |
| LBRC014: one record with ≥2 revisions and two separate pointers | **VERIFIED as a test fixture only** | DOC-14. Nothing is indexed in any running AI OS. |
| XECA006: own record with a «Chưa có» field list | **PARTIAL** | 7 `missingFields` stored and returned by the API (test). The UI shows only the count («Cần bổ sung»); no per-field «Chưa có» list exists, because there is no detail screen. |
| Receipt says Xeca cases wait for the original message | **NOT VERIFIABLE** (receipt not written, E14) | Test names carry «chờ tin gốc» |
| No real project gets a domain-mapping row from code | **VERIFIED** | E11; `project-registry.test.ts` "migration 013 ships no domain mapping row" |
| Reviews pinned to base/head and saved with their output | **NOT MET** | Tier-1 reviews pin `208d37b..46439aa`, but they live in `.superpowers/`, which is outside git (E13). The ledger has no tier-1 re-review of fix round 3 (`ef905e6`) or of merge `4f9771e`. The Codex file is 0 bytes. |
| Two review tiers; no open Codex P0/P1 | **NOT MET yet** | Codex round 1 still running |
| Receipt states the four levels separately | **NOT VERIFIABLE** (E14) | — |

## 5. Nine negative-permission cases (`SLICE-BRIEFS.md:71`)

1. **Xeca project member cannot see LBRC014's name, preview or file — VERIFIED.** The viewer is in the transport project only. `openSource` returns `SCOPE_DENIED` 404 with no «LBRC014» text. `findDocuments` on transport with `q:'LBRC014'` returns total 0. `detail` and `openSource` do not check role, so the denial comes from project scope, which is what the case needs.
2. **No RLS context → no rows on all 9 new tables, including Z2 — VERIFIED.** Each test seeds rows first, then reads as `libetech_runtime` without context and gets 0 rows. The index test also has a positive control.
3. **INSERT for another project or tenant is rejected — PARTIAL.**
   - Covered: `registry_events`, `document_records`, `document_commands`, `document_revisions` (other tenant only), `document_templates`, `analytics.document_index`, and `project_domain_mappings` (runtime has no grant).
   - **Not covered:** `project_profiles` and `project_channels`. Control C1 proves it: removing the project clause from their INSERT policies leaves the suite green (E5). The domain service still blocks this path today; the DB control has no test.
4. **Bot cannot write the document registry — VERIFIED.** `documents.test.ts`, "bot, viewer and outsider cannot register"; bot cannot propose.
5. **Same key → no duplicate; same key for another object → rejected — VERIFIED.** Same project and cross-project (OQ-24). Control C3 proves the OQ-24 tests bite (E7).
6. **Stale `expectedVersion` → rejected, with no audit row and no version change — VERIFIED.** `documents.test.ts` uses the `snap()` helper to compare revision, event and version counts before and after; `project-registry.test.ts` checks the same for profiles.
7. **No record holds snapshot content; IBS HI only pointer, hash and metadata — VERIFIED structurally.** The tests check: no `content`/`body`/`snapshot`/bytea column, `snapshot_ref` cannot be inserted, all hashes are `self_declared`. No IBS-HI-specific case.
8. **A proposed ProjectChannel grants no read — VERIFIED.** `chatScopes` stays the source of truth.
9. **Unmapped project shows «Chưa xác nhận» and counts in no total — VERIFIED, but vacuous for totals.** The flag `countsTowardTotals:false` is tested. No cross-project total exists in slice 1 (Ruling R1), so nothing yet consumes the flag.

## 6. Five spot-checked tests (question 2)

| Test | Attacks or confirms? | Finding |
|---|---|---|
| Cross-tenant/project RLS on new tables (`documents.test.ts` "runtime cannot insert…", `fix-wave-db.test.ts` item 5 UPDATE isolation) | **Attacks.** Raw SQL under `scoped()`, with a positive control | Control C2 turns it red (E6). Gaps: C1 (two tables) and C4 (FORCE). No test asserts `relforcerowsecurity`; FORCE is enforced by reading the migration only (`manual`). |
| OQ-24 cross-project key reuse (`documents.test.ts` :56, :258; native race `documents-concurrency.test.ts:54`) | **Attacks.** It uses the RLS-hidden path: `register` narrows `projectIds` to one project | Control C3 turns it red (E7). The native "race" uses `Promise.allSettled` with no lock barrier, so the two calls may not overlap; the 23505 catch path is not forced. |
| R-01 concurrency (`documents-concurrency.test.ts` :33, :44; `feedback-concurrency.test.ts`) | **Attacks.** It holds `FOR UPDATE` and waits until 2 sessions are blocked | Native-only, and I could not reproduce it. The evidence is the log plus the inference in §3. |
| DOC-07 pointer separation | **Attacks.** The approved pointer is set by the operator, then a new proposal; the test asserts the pointer is unchanged and the FK refuses a foreign revision | Sound |
| P1.0 gates at DB (`documents.test.ts` "runtime cannot set the approved pointer, a verified hash or a snapshot", "cannot claim a source state…") | **Attacks.** It tries `approved_revision_id`, `freeze_state`, `hash_verification`, `snapshot_ref`, `source_state`, `source_checked_at` and expects each to be rejected, with a positive control | Sound. Column-level grants plus WITH CHECK (`migrations/014_document_registry.sql:108-112`, `:124-127`, `:137-142`). |

## 7. Which level can the receipt claim? (question 3)

- **«đã có mã» — yes, narrowly.** The code exists as local commit `4f9771e` on an unpushed branch (E10): no PR, not merged into `libetech-ai-os`. The working tree already contains uncommitted follow-up changes. The receipt must pin the commit it describes.
- **«đã triển khai» — no.** Nothing is deployed to d1-ai1, migrations 013–015 are not applied to any real DB, and the projector job is not set up (OQ-22 (b) is a deploy stop point).
- **«đã dùng thật» — no.** No real user, no real document. LBRC014 and XECA006 exist only as test fixtures.
- **«đã nghiệm thu» — no.** No Chairman acceptance; the Xeca cases wait for the original message.

## 8. Overall verdict: **NEEDS WORK**

This is the normal outcome, not a failure. At «đã có mã» level the engineering core is strong:
- PGlite 202/8-skipped, reproduced by me (E1).
- Native 210/210 (log plus inference).
- Two of four controls bite (C2, C3).
- DB gates are real.

The receipt cannot yet be written as «đạt» because:
- the Codex gate is open;
- screenshots and the detail screen are missing;
- DOC-18's «stale/unknown» state is missing at head;
- review outputs are not saved in the repo;
- the head is about to change.

## 9. Gaps the receipt must state explicitly (question 4)

1. **Level: «đã có mã» only.** Name the commit, and say the branch is local and unpushed with no PR. Leave «đã triển khai», «đã dùng thật» and «đã nghiệm thu» empty.
2. **Xeca cases (DOC-13, XECA006, PM-08, DOC-18) wait for the original message («chờ tin gốc»).** All tests run on synthetic data. LBRC014 and XECA006 are fixtures, not indexed records in any running instance.
3. **Rollback forward → back → forward was run on throwaway synthetic DBs** (PGlite and loopback `slice1_verify`), not on a copy of real data. A rehearsal on a production copy, with a backup restore, is still a deploy stop point.
4. **UI:**
   - no screenshots in `docs/screenshots/`;
   - error and loading checked only as markup, never in a browser;
   - ≥1200 checked for ready only;
   - the browser check is maker-side;
   - the **detail screen is not built**;
   - XECA006's missing fields show only as a count;
   - contrast, 200% zoom and screen reader are not checked.
5. **DOC-18 at 4f9771e:** history is kept, but a vanished source does not become «stale/unknown». Either cite the commit that adds it, re-verified on both engines, or mark DOC-18 partial.
6. **Engine coverage:** feedback R-01 non-race cases (`feedback-idempotency.test.ts`) and all pre-slice suites run on PGlite only. The native evidence is a 9-line summary log without per-test output or an environment echo.
7. **Test-proven gaps:**
   - Cross-project INSERT on `project_profiles`/`project_channels` has no DB-level test (control C1 stayed green).
   - `FORCE ROW LEVEL SECURITY` is unasserted (control C4 stayed green): enforcement status `manual`.
   - Membership revocation is tested on a constructed Principal, not end to end.
   - The OQ-24 native race is not barrier-forced.
8. **Open decision OQ-25:** there is no source-host allowlist yet, so phishing links are possible. It must be decided before `/documents` and `/api/documents` go behind the public proxy.
9. **Review gate:**
   - Codex round 1 is pending, and its P0/P1 findings must be closed.
   - Tier-1 reviews pin `208d37b..46439aa`; there is no tier-1 re-review of `ef905e6` or of merge `4f9771e`.
   - The review outputs sit in `.superpowers/`, outside git, so they are not «lưu cùng output».
10. **Backlog carried forward:** `registry_events` has no `request_id`/`trace_id` (E-DB-13); there is no DB-level actor binding (Ruling R6); export is capped at 5000 rows; the projector is not wired to the web path (OQ-22 b), so new documents appear only after an operator run.

## 10. What would change the verdict

- The final head committed, with fresh PGlite and native logs at that head. Native should include per-test output (`--reporter=verbose`) and the database URL host/port/name with credentials removed.
- The Codex round-1 output saved in `docs/reviews/` with base/head pinned, its P0/P1 findings closed, and the tier-1 review files copied into `docs/reviews/`.
- Screenshots of the four states at 360×740 and 1280×800 in `docs/screenshots/`, preferably taken by someone other than the maker, and the handoff checklist ticked.
- DOC-18 «stale» committed and tested on both engines (or DOC-18 declared partial in the receipt).
- One test each for cross-project INSERT on `project_profiles` and `project_channels`, and one `relforcerowsecurity` assertion, so that controls C1 and C4 turn red.
- The detail screen built, or the receipt explicitly descoping it.
