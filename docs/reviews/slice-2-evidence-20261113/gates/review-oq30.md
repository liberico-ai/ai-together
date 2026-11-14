# Review — OQ-30 (b) content mode per revision (9643b7f..1054222)

Reviewer: liberico-database-reviewer (advisory, R1/R2). Read-only. No tests run (green log read: focused 176 passed / 4 skipped, full 477 passed / 21 skipped, typecheck 0).
Sources read: brief `oq30-brief.md` (S15), `docs/OPEN-QUESTIONS.md` OQ-30 entry (:338-352), `oq30-report.md`, `oq30-review-package.md`, and at `1054222`:
`migrations/016_intake_inbox.sql`, `migrations/013_project_registry.sql` (RLS/grants on `project_domain_mappings`), `migrations/rollback/016_intake_inbox.sql`,
`src/server/{inbox,intake,bridge-config,db}.ts`, `scripts/migrate.ts`, `src/server/db.ts` (embedded migration loop).

## Part 1 — Spec compliance: ✅ (no Missing, no Misunderstood; one justified Extra)

| Brief item | Status | Evidence |
|---|---|---|
| 1a revision `content_mode` NOT NULL + IN check | ✅ | `migrations/016_intake_inbox.sql:70` |
| 1a named CHECK pointer-only ⇒ no text | ✅ | `:73` `source_event_revisions_pointer_only_no_text` |
| 1a `content_mode` in revision column INSERT grant | ✅ | `:251` |
| 1b `source_events.content_mode` dropped + out of its grant | ✅ | `:56` (comment only), `:250` |
| 2 mode computed per call, written on that revision with redacted text or NULL; event insert has no mode; replay unchanged; audit `{revisionNo,contentMode}` is the revision's mode; comment names OQ-30 (b) | ✅ | `src/server/intake.ts:65-71`, `:75-80`, `:88-93`, `:111-112` |
| 3 `InboxService(db, excerptChats=[])` fail-closed default | ✅ | `src/server/inbox.ts:111-112` |
| 3 `currentExcerptChats()` → `[]` on unset/unreadable/malformed/inconsistent, fixed-code log without path/content; used at both construction sites | ✅ | `src/server/bridge-config.ts:43-51`; `src/server/inbox-http.ts:35`; `src/app/inbox/page.tsx:26` |
| 3 three display modes computed in the service, per revision, latest revision for the card | ✅ | `src/server/inbox.ts:86-93`, `:97`, `:157` |
| 3 current-config test = event `chat_id` ∈ list AND latest mapping row ≠ `IBS_HI` | ✅ | `:91-93` (`ORDER BY mapping_version DESC LIMIT 1`, read as `libetech_runtime` under RLS); `chat_id` from the root `source_events` row (`:97`, `:151`) |
| 3 hidden text/hash leave in no field; dup hint SQL-only, ids only | ✅ | `:97-99`, `:157-158`, dup `:72` |
| 4 UI text only for `'excerpt'`; hidden copy exact; pointer-only copy kept | ✅ | `src/components/inbox.tsx:41`, `:51`, `:99-101`; `src/components/inbox-view.ts` `HIDDEN_COPY` |
| 5 types | ✅ | `DisplayMode`, `RevisionView.contentMode`, `CandidateCard.contentMode` |
| Tests (all brief names) | ✅ | intake ×4 OQ-30 + 4 OQ-28 + S10 re-pointed; schema ×3; service ×4 + M1; HTTP ×2 (non-vacuous: marker present under flagged config, absent under unflagged/malformed/unset, hash absent too, DB row still holds marker); UI ×2 |
| Extra | ✅ justified | `tests/bridge-limits.test.ts:174` re-pointed to `r.content_mode` (compiler/test-driven, within the brief's "any other raw insert") |

Global constraints: no identity/flag/mode from request JSON (flag only from operator config; `intake.test.ts` "a flag in the request body is never honoured" still green). No UPDATE/DELETE path added; immutability triggers unchanged (`016:234-237`). Migration still `IF NOT EXISTS`/`DROP … IF EXISTS` on a fresh DB; rollback file unchanged and still correct (drops the five tables, so column and constraint go with them). Fixtures synthetic. UUID PK / timestamptz / RLS ENABLE+FORCE untouched.

DB-rule judgment on the new CHECK: `content_mode='excerpt' OR text_excerpt IS NULL` is a cross-column consistency invariant of the row itself (a pointer-only row carrying text is a corrupt row, never a policy choice), not a business rule a PO could change without migration — the policy (flag, IBS_HI) stays in `intake.ts`. Accept as data integrity (E-DB-05 compliant), same class as the existing `text_excerpt` length check.

## Part 2 — Findings

No Critical. No Important.

### Minor

**m1 — 016 edit is idempotent only against its own shape; a DB that ran the OLD 016 is not upgraded and fails loudly (rebuild required).**
`migrations/016_intake_inbox.sql:45-74` (`CREATE TABLE IF NOT EXISTS`) + `:251`.
- `scripts/migrate.ts:12-13` skips any version already in `schema_migrations`, so a server DB that ran old 016 keeps `source_events.content_mode NOT NULL` and has no `source_event_revisions.content_mode`. Scenario: intake INSERT into `source_events` without `content_mode` → NOT NULL violation → 5xx (plugin spools/retries); Inbox `CARD_SQL` → `column l.content_mode does not exist` → 500. Silent drift until the first call; `/api/health` still lists `016`.
- `src/server/db.ts:11` (embedded PGlite, `.data/postgres`) re-executes every file at start: on an old-shape store the `GRANT INSERT(…content_mode…) ON source_event_revisions` at `:251` raises "column does not exist", the 016 transaction aborts, start-up fails.
- Fail mode is loud, never a leak. Path: `migrations/rollback/018` → `017` → `016` (016's rollback deletes `schema_migrations` '016') then forward migrate; or delete `.data/postgres` for the local demo. Rollback→forward does cover it; data in the five intake tables is lost (acceptable for unreleased 016; rollback on a real DB needs Chairman approval per AGENTS.md).
- Fix (optional, cheap): a guard block at the top of 016, e.g. `DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='source_events' AND column_name='content_mode') THEN RAISE EXCEPTION '016 shape changed (OQ-30): roll back 018, 017, 016 and re-apply'; END IF; END $$;` so both runners fail with an actionable message. At minimum, state the rebuild step in the PR body.

**m2 — Duplicate hint is an inference channel for text not shown (pre-existing since OQ-28, unchanged here).**
`src/server/inbox.ts:72`, `:99`. `lat` compares the latest `content_hash` of every candidate in the project regardless of display mode. Scenario: same project, chat A flagged, chat B not; candidate X (chat B, `pointer_only` or `hidden`) and Y (chat A, `excerpt`) have the same hash → X's card lists Y «cùng nội dung», and Y's text is on screen, so the PM reads X's content. IBS_HI hiding is project-wide, so this cannot cross into an IBS_HI project. Brief explicitly kept "as today" — not a spec defect. Recommend recording for Chairman: either restrict the hint to pairs where both sides display `'excerpt'`, or accept it as a hint by design.

**m3 — Tests do not prove "latest mapping row" wins.**
`tests/inbox-service.test.ts:412` and `tests/intake.test.ts:27` insert a single mapping (`mapping_version` 1). A regression to `ORDER BY mapping_version ASC` (or no order) would stay green. Add: v1 `XECA` then v2 `IBS_HI` → hidden; v1 `IBS_HI` then v2 `XECA` → shown (the latter also documents that hide-not-delete means re-loosening re-shows stored text, which is what «Inbox ẩn theo cấu hình hiện tại» implies).

**m4 — Event payload says `contentMode:'excerpt'` while the revision displays `'hidden'`.**
`src/server/inbox.ts:161` returns `intake_events.payload` raw; `source_event.persisted/revised` payload carries the stored mode. Not a leak (no text, no hash), but an API consumer sees two different "contentMode" values for the same revision. Optional: name the audit field `storedMode` in future, or document that `detail().events[].payload.contentMode` is the stored mode, not the display mode. Do not rewrite stored events.

**m5 — Rule is private to `inbox.ts` (implementer concern 5).**
`src/server/inbox.ts:86-93`. Slices 3–4 (OQ-30 "Lát: 3–4") will read `source_event_revisions`; a second reader that checks only `content_mode='excerpt'` would re-open the leak. Recommend extracting `displayMode`/`allowedFor` to a shared server module before slice 3 and adding a grep/test guard ("only module X selects `text_excerpt`"). Not required for this task.

## ⚠️ Not verifiable from the diff
- Whether any non-local DB (isolated deployment, lab) already ran the old 016 on this branch. If yes, m1 applies there and needs a Chairman-approved rollback→forward.
- Native-role behaviour of the new CHECK and column grant (native suite skipped on PGlite here). PGlite does run `SET LOCAL ROLE libetech_runtime` (`src/server/db.ts:50`), so the IBS_HI hide test already proves the runtime role can read `project_domain_mappings` under RLS (otherwise `domain` is undefined → shown → test fails). Controller's native run should still confirm.
- Unmapped project ⇒ allowed (`inbox.ts:93`, same as `intake.ts:70-71`). This is the OQ-28 (c) rule ("unmapped decides nothing"), not fail-open by this change; noted because it means a mapping row invisible for any reason would show text in a flagged group.

## Specific questions from the controller
- Any reader deciding visibility from something other than (revision mode AND current config)? **No.** `git grep text_excerpt|content_mode|source_event_revisions` at 1054222 over `src scripts bot-plugin migrations/017 018`: only `intake.ts` (writer) and `inbox.ts` (the two readers, both through `displayMode`). `e.content_mode` no longer exists, so no reader can use it.
- Any field/log/error/dup hint carrying hidden text or hash? **No text, no hash.** Card and revisions null both for non-excerpt (`inbox.ts:98`, `:158`); dup hint returns ids (`:99`); outbox params are ref + observedAt only (`intake.ts:126`); command idempotent response stores ids/state/version and the card is re-read with current config (`inbox.ts:182`); config error log has code + error class only. Only the inference channel in m2.
- Current-config test uses event chat id and latest mapping row? **Yes** (`inbox.ts:91-93`, `:97`, `:151`); test strength gap in m3.
- Missing/malformed config fails closed? **Yes**: unset → `loadBridgeConfig` returns null → `[]`; missing file / bad JSON / schema or subset violation → throws → logged → `[]`; constructor default `[]`. HTTP test covers unset, malformed, subset-violating.
- Migration idempotent on a DB that ran OLD 016? **No** — see m1: needs rebuild (rollback 018→017→016 then migrate, or delete `.data/postgres`); the rollback→forward path covers it.
- Grants and immutability after the column move? **Correct.** Intake INSERT columns now include `content_mode` on revisions and exclude it on events; table-level `REVOKE INSERT` precedes column grants; runtime keeps SELECT only on revisions (no UPDATE); `source_events_immutable` / `source_event_revisions_immutable` unchanged; schema test confirms intake cannot UPDATE/DELETE either table.

## Verdict on implementer concerns
1. Concurrent edits in `bot-plugin/__init__.py` / `tests/test_bot_bridge.py` — outside this diff (not in 9643b7f..1054222 stat); controller keeps commits apart. Already landed separately as 82d30c6 per `git log`. No action for this task.
2. Notice under every non-excerpt revision — **accept**. Brief says "per revision in the detail view"; a revision without its notice would be ambiguous (empty vs hidden). Cosmetic only.
3. New fixed code `INBOX_EXCERPT_CONFIG` — **accept**. Same event name and shape as the existing line, fixed literal, no path/content; distinguishes Inbox fail-closed from intake 503 in logs.
4. Hidden text selected then dropped in JS — **accept for slice 2**. The service is the boundary, the drop happens before any return, no row is logged. A SQL `CASE WHEN r.content_mode='excerpt' AND e.chat_id=ANY($n::text[]) AND <latest mapping> IS DISTINCT FROM 'IBS_HI' THEN r.text_excerpt END` is defence-in-depth worth doing together with m5 (shared module), not a blocker.
5. Rule private to `inbox.ts` — **valid**; see m5. Record as a slice-3 entry condition.

## Verdict
**READY FOR ARCH LEAD** (spec ✅; 0 Critical, 0 Important, 5 Minor). Before merge: state the 016 rebuild step (m1) in the PR body; m2 is a Chairman call to record, m3 a cheap test addition.
