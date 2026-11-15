VERDICT: READY WITH FIXES

# Slice 3: tier-1 database review of the whole branch (`ec3b5e7..2a267c5`)

Reviewer: `liberico-database-reviewer`. This review is advisory: it recommends and does not approve. It is a tier-1 seat from the same model family as the builder, so it does not count as an independent check. The Codex gate runs after it.

**What I read.** I read these files at head `2a267c5`:
- the migrations and rollbacks for 019, 020 and 021;
- the three task reviews and their deployment notes (`review-task-4a.md`, `review-task-4b-database.md`, `review-task-8-database.md`);
- the rulings and deferred minors in the ledger (`.superpowers/sdd/slice-3-review-skills/progress.md`), including Ruling R12-c;
- `docs/OPEN-QUESTIONS.md`, OQ-45;
- the service files named in the brief, plus `src/server/db.ts`, `src/server/review-http.ts` and `scripts/migrate.ts`;
- the sweep commit `2a267c5`, as far as it touches `src/server`;
- the schema tests `tests/review-schema.test.ts`, `tests/z4-schema.test.ts`, `tests/rls-catalog.test.ts`, and the test names in `tests/migrations-rollback.test.ts`.

**What I did not do.** I started and connected to no database, and I ran no test. Statements about locks are `#inference` from PostgreSQL 16 lock rules; I did not observe them. Statements about which test asserts what come from reading the test files.

## Summary

| Priority | Count |
|---|---|
| P0 | 0 |
| P1 | 1 |
| P2 | 4 |
| P3 | 7 |

**Where the schema is sound** (#fact, from the files):
- Every new table uses UUID keys and `timestamptz`, and is scoped by tenant and project.
- Every new table has ENABLE and FORCE row-level security. Every policy has USING, WITH CHECK where it applies, or both.
- Each policy compares against `nullif(current_setting(...,true),'')`. A missing setting therefore gives NULL, or an empty `ANY` list, and that fails closed.
- Grants are column-level. Nothing is granted to PUBLIC.
- `libetech_ai` holds SELECT and column INSERT on `intelligence.ai_drafts` only.
- Immutability triggers sit on comments, decisions, events, drafts and draft decisions. Delegations and dependencies cannot be deleted.
- The one SECURITY DEFINER function is `public.document_approvers`. Its owner is `libetech_identity`, its `search_path` is pinned to `pg_catalog, pg_temp`, and only `libetech_runtime` may execute it.
- The three migrations do not silently change 001–018, with one exception: 020 adds two pointer guards on `document_records` and grants `UPDATE(approved_revision_id)` on it. Both are stated in the 020 header and the 020 notes.
- I found no deadlock cycle between the services (see «Locks and lock order»).

**What blocks a clean merge** is one P1. The tenant-isolation test matrix of Quality Gate 34a, 34b and 34d is incomplete for `draft_decisions`, and in the cross-tenant direction for the review tables. The fix touches tests only.

## Findings

### P0

None.

### P1

**P1-1: The isolation tests do not cover every dimension on every new table, and one test's name claims more than it checks.**

- **Where:**
  - `tests/review-schema.test.ts:120-142`. The test is titled «runtime cannot read or write another project or tenant». It reads only across projects inside one tenant (`:124`, `WHERE project_id=$1` with `ids.transport`). The only cross-tenant write it tries is on `review_events` (`:128`).
  - `tests/z4-schema.test.ts`. No case reads `draft_decisions` as `libetech_runtime` from another project, another tenant or with no context. A grep for `draft_decisions` in the z4 and suggestion tests finds only operator-side counts, plus the AI role being refused at `:313`. Cross-scope and no-context reads are tested for `intelligence.ai_drafts` only (`:160-163`, `:170-185`).
- **Scenario:** someone later edits `runtime_select ON draft_decisions` (`migrations/021_ai_suggestions_z4.sql:108-111`). Say a refactor drops the `project_id = ANY(...)` clause, or writes `current_setting('app.tenant_id')` without `missing_ok`.
  - `tests/rls-catalog.test.ts:25-43` stays green, because it only checks that a USING clause exists.
  - Every behavioural test stays green too.
  - The result: a runtime reader in project A then sees B's draft decisions, or, with the second edit, a missing setting raises an error instead of failing closed.
  - The same applies to the tenant clause of `runtime_select` and `runtime_insert` on the four review tables, other than `review_events`.
- **Rule:** Quality Gate §I 34a (read across tenants returns nothing), 34b (a write into another tenant is refused) and 34d (no context fails closed). All three are MUST. AR-06 / E-TEST-01 require 100 %.
- **Fix** (tests only):
  - Add a `draft_decisions` read case: seed one decision in sales. Expect 0 rows as runtime with context `[transport]`, 0 rows with tenant `otherTenant`, and 0 rows with no context at all (the `runtimeBare` form at `z4-schema.test.ts:180`).
  - Extend `review-schema.test.ts:124` with a loop that reads every review table under `tenant = otherTenant` with the sales project id in `app.project_ids`. This is the case S-1 of 4a used for `document_approvers`.
  - Add the cross-tenant insert (`{tenant: ids.otherTenant}`) for comments, decisions, dependencies and delegations next to `:128`.
  - Rename the test at `:120` if a dimension stays out.

### P2

**P2-1: Rollback 020 destroys immutable history without refusal; only an `approved` decision blocks it.**

- **Where:**
  - `migrations/rollback/020_document_review.sql:9-21` is the only data check.
  - `:35` then runs `DROP TABLE … review_events, document_dependencies, review_decisions, review_comments, review_delegations`.
- **Scenario:** on a server with comments, `changes_requested` decisions, delegations and review events, but no approval yet, an operator runs the rollback. Every one of those append-only records is gone, with no refusal.
- **Comparison with 021:** `migrations/rollback/021_ai_suggestions_z4.sql:13-19` refuses while any person's recorded decision exists. That stricter pattern was adopted after M-2 of the 021 review. The 020 rollback was never brought up to it.
- **Rule:** E-DB-13 says an audit log is append-only. The 020 deployment note (`review-task-4b-database.md`, «Rollback preconditions») already says «export first». The file itself enforces nothing.
- **Fix** (cheap while 020 is applied nowhere): with the same `to_regclass` and dynamic-count form, refuse while any row exists in `review_decisions`, `review_comments`, `review_events`, `review_delegations` or `document_dependencies`. Add one rollback test case. Recommended before the apply stop point; it does not block merge.

**P2-2: `dependency.flagged` events carry a made-up `request_id`.**

- **Where:**
  - `src/server/documents.ts:171`: `flagDependents(tx, p, {…, requestId: randomUUID()})`.
  - `src/server/document-dependencies.ts:49-51` writes it into `review_events.request_id`.
- **Scenario:** a person proposes revision 3 of A over HTTP, and B depends on A. The flag event's `request_id` matches no HTTP request id in any log. An incident trace from «why is B flagged?» back to the request that caused it therefore dead-ends. The same holds when the proposal comes from a confirmed AI draft (`suggestions.ts:183`). That path does have the real `requestId` in scope, but `proposeRevisionIn` cannot accept it.
- **Rule:** E-DB-13, under which `request_id` and `trace_id` are required for multi-tenant audit rows. A random value is worse than the honest NULL the column forbids.
- **Fix:** thread an optional `requestId` through `proposeRevisionIn` and use it in `flagDependents`. `SuggestionService.decide` already has one. For the slice-1 `proposeRevision` route, generate it once in the handler. Otherwise, state in the receipt that flag events carry a per-transaction id, not the HTTP request id.

**P2-3: 019's «drop every other CHECK on `report_permissions`» loop runs again at every embedded start.**

- **Where:**
  - The loop is at `migrations/019_document_approver_grant.sql:24-29`.
  - `src/server/db.ts:11` makes `embeddedDatabase` execute every migration file on each start (the demo and the PGlite test harness). It does not consult `schema_migrations`.
- **Scenario:** a later migration adds, for example, `CHECK(cardinality(report_permissions) <= 11)` on `identity.memberships`. On the next demo start, 019 runs again before it and drops that CHECK by definition match. The later migration then re-adds it in the same start. The final state is right, but only because the later file is also idempotent. A later migration that adds such a CHECK with `NOT VALID`, or only under `IF NOT EXISTS` on a different name, ends up dropped and not re-added.
- **Note:** `scripts/migrate.ts:12-16` skips recorded versions, so production is unaffected.
- **Rule:** maintenance risk. The migration is idempotent today, but its second run is not «no-op whatever came after».
- **Fix:** restrict the loop to the 004 constraint name (`memberships_report_permissions_check`), or to definitions equal to the old three-value set. Alternatively, add a header line telling later migrations to name such a CHECK and exclude it.

**P2-4: Three lists are cut silently.**

- **Where:**
  - `src/server/review-delegations.ts:109-123`: `LIMIT 1000`, then `slice(0,200)`, with no `total` or cursor. This is ledger 7a M5.
  - `src/server/document-review.ts:179`: comments `LIMIT 1000`, with no signal. This is ledger 5 M-3.
  - `src/server/decisions.ts:73`: queue `limit: 200`, with a «known cap» comment.
- **Scenario:** in a project with more than 200 live delegations, more than 1 000 comments on one document, or more than 200 documents with revisions, the extra rows are not shown. Nothing in the answer says so.
- **Rule:** E-BE-05 (MUST) requires a response with `total` or `cursor`.
- **Fix:** return `total` (a count is already computed for the queue) or a `truncated` flag. At minimum, the receipt must state the three caps. For the pilot sizes this may wait.

### P3

- **P3-1: `review_events` has no entity-existence guard and no fixed list of kinds** (`migrations/020_document_review.sql:96-106`). The runtime role can write an event about any entity id in its own project, under its own person id. The table follows the `registry_events` / `intake_events` precedent. Nothing in `src` reads it: a grep finds only inserts. Triage is under «Deferred minors».
- **P3-2: The idempotency key is not claimed for a draft rejection or an intake-candidate confirmation.**
  - Where: `src/server/suggestions.ts:186-189`. Only the document-confirmation path claims the key in `document_commands`, through `proposeRevisionIn`.
  - Scenario: a person reuses key K to reject draft X and then draft Y. Both inserts succeed. Key K used for a draft rejection is also not detected if the same person later uses it in `ReviewService.decide`.
  - Rule: the code base's precedent (R12-b) treats a key reused with other content as a conflict. Nothing is lost here, because `UNIQUE(draft_id)` still holds.
  - Fix: call `claimDocumentCommand` for every decision, or state the narrower semantics in the receipt.
- **P3-3: N+1 queries.**
  - `src/server/bom.ts:115-119` calls `card(tx,proposal)` per proposal, which is 2 queries × at most 30.
  - `src/server/document-dependencies.ts:48-52` does one `INSERT` per flagged link.
  - Both are bounded. An `INSERT … SELECT` and a batched votes/receipts read would make them O(1).
- **P3-4: `listVisibleRevisions` has no `LIMIT`** (`src/server/source-text.ts:47-51`). It is bounded only by the number of edits of one message, and the order is deterministic.
- **P3-5: An approval moves a Z1 pointer that the document's own history does not show.** `src/server/document-review.ts:293` sets `approved_revision_id`. The record of that move is in `review_events` only. `DocumentService.load` (`documents.ts:107-108`) shows `registry_events` only, so the document's history page never shows the approval.
- **P3-6: Rollback 019 checks before it locks** (ledger, 4a). Between its `EXISTS` checks and the `DROP`, a ballot naming a code could be inserted. `LOCK TABLE identity.memberships, identity.account_approvals IN SHARE MODE` before the `DO` block closes this. The file only runs on copies.
- **P3-7: A draft can never be erased.** `intelligence.ai_drafts` rows are immutable even for a superuser: `reject_history_mutation` fires on DELETE, and only `TRUNCATE` or disabling the trigger gets past it. If OQ-45 point 3 is later decided as (b) or (c), drafts already stored for an IBS HI project cannot be removed within the rules. This is a deployment constraint, not a code defect (see the deployment note).

## 1. The three migrations together

**Order and dependencies:**

| Migration | Needs |
|---|---|
| 019 | 018 (ballots with `kind`, `previous_grants`) |
| 020 | 019 (`document_approvers`, used in `review_decisions_guard`), 006 (`bom_eligible_members`), 001 (`reject_history_mutation`), 014 (tables and the `UNIQUE(id,document_id)` / `UNIQUE(id,tenant_id,project_id)` keys) |
| 021 | 014 (`document_revisions UNIQUE(id,tenant_id,project_id)`, `014:42`, for the `draft_decisions` FK), 013 (`projects`); it is independent of 019 and 020 in SQL |

Each file runs as one `BEGIN…COMMIT` with `lock_timeout 5s`.

**Second run:**
- Tables and indexes use `IF NOT EXISTS`.
- Policies and triggers use `DROP IF EXISTS` plus `CREATE`.
- Functions use `CREATE OR REPLACE`.
- Grants repeat without effect.
- The `schema_migrations` insert uses `ON CONFLICT DO NOTHING`.
- The role creation in 021 is guarded, and the role check reruns.
- A second run is therefore a no-op, with the P2-3 caveat for 019 on embedded starts.

**Rollback chain, 021 → 020 → 019.** Each rollback refuses while a later version is recorded (string comparison on three-digit versions).

| Rollback | Refuses while | Destroys when it runs |
|---|---|---|
| 021 | any `draft_decisions` row exists (`row_security = off`, dynamic count) | drafts, without refusal; keeps role `libetech_ai` |
| 020 | an `approved` decision exists | every other review row (P2-1); revokes `UPDATE(approved_revision_id)` and drops both pointer guards, so runtime may again move `latest_revision_id` backwards |
| 019 | any membership, or any ballot in any state (`grants` or `previous_grants`), carries `doc_approve:` | — ; it restores the 004 three-value CHECK under its 004 name before dropping the 019 CHECK, so the column is never unchecked |

No rollback uses CASCADE. Every rollback is reruntable after its objects are gone.

**Locks:**

| Migration | Locks | Where it matters |
|---|---|---|
| 019 | ACCESS EXCLUSIVE on `identity.memberships` for `ADD CONSTRAINT … CHECK` (validated by a full scan) and `DROP CONSTRAINT`; SHARE ROW EXCLUSIVE for the trigger | This is the only lock on a table holding real data that blocks reads. Logins, session checks and grant reads queue behind it, including the up-to-5 s wait in the lock queue. Hold time is O(rows of memberships), so seconds at most. |
| 020 | SHARE ROW EXCLUSIVE on `projects`, `document_records`, `document_revisions` (FKs and two triggers) | Reads continue; writes wait. |
| 021 | SHARE ROW EXCLUSIVE on `projects`, `document_revisions` and the new `intelligence.ai_drafts` | Reads continue; writes wait. |

No table is rewritten and no index is built on existing data.

**What a later migration changes in an earlier one:**
- 020 changes the behaviour of 014's update path. The runtime role may move `latest_revision_id` only forward, may move `approved_revision_id` only as described in the 020 header, and every decision row-locks its document.
- 021 changes nothing earlier. `src/server/db.ts:20-30` now also refuses a login that can reach `libetech_ai` or owns tables in `intelligence`.

**Zone placement:**
- `public.review_*`, `document_dependencies` and `draft_decisions` are Z1 owned records written by a person through `libetech_runtime`.
- `intelligence.ai_drafts` is Z4, written only by `libetech_ai`.
- No Z2 table is added. No new table lives in `analytics`.
- This matches AGENTS.md («Z4: future AI suggestions; not enabled»), AR-03 and E-AI-04.

**Grants by role:**

| Role | Holds after 019–021 |
|---|---|
| `libetech_runtime` | SELECT on the five review tables, on `draft_decisions` and on `intelligence.ai_drafts`; USAGE on schema `intelligence`; column INSERT on the five review tables and on `draft_decisions`; column UPDATE as listed at `020:412-414`; EXECUTE on `document_approvers` |
| `libetech_ai` | USAGE on `intelligence`, SELECT and column INSERT on `ai_drafts`; nothing else |
| `libetech_intake`, `libetech_identity` | nothing new on these tables (asserted at `z4-schema.test.ts:277-283`); `libetech_identity` owns the definer function |
| `libetech_web` | nothing directly; it reaches the runtime role |

No DELETE or TRUNCATE is granted anywhere. Nothing is wider than the services use. I checked every column the services write against the grants (section 2).

**Indexes:** every FK and every `created_at` is indexed, or is led by a UNIQUE. This holds for:
- 020: `:109-132`;
- 021: `:79-86`;
- `draft_decisions.draft_id`, by `UNIQUE(draft_id)`;
- the `ai_drafts` FK, by `idx_ai_drafts_project_fk`.

`decided_by` / `actor_id` / `confirmed_by` have no FK to `identity.users`, following the 014 precedent (`registered_by`).

**Guards and SQLSTATEs:**

| Code | Raised by |
|---|---|
| `LTR01` | decision authority |
| `LTR02` | designation |
| `LTR03` | revoke by a non-manager |

Integrity refusals are `P0001` with fixed sentences that contain no names. The 019 membership guard is `P0001` (ledger 4a, deferred).
- Superuser bypass applies only in the designation guard, the revoke manager check, the approved-pointer guard, the latest-pointer guard and the flag direction check.
- `review_decisions_guard` and `draft_decisions_guard` stop the operational login too.
- No guard is SECURITY DEFINER. All pin `search_path` with `pg_catalog` first.

## 2. Queries the services added

Every statement below is parameterised: values go as `$n`, and the only interpolations are constant column lists and the SQL helpers of `source-text.ts`. Every statement runs inside `scoped()` (`SET LOCAL ROLE libetech_runtime`, with tenant and projects set transaction-locally) or `aiScoped()`. The tenant filter therefore always comes from RLS, and the project filter from RLS plus an explicit `project_id=$n`, except where noted.

| File | Statements | Notes |
|---|---|---|
| `document-review.ts` | queue `:189-191`, items `:149-152`, load `:170-179`, lock `:203`, comment `:234-248`, decide `:280-300` | All lists have `LIMIT` and a deterministic `ORDER BY` (`updated_at DESC, id`; `created_at, id`). The batch reads in `items` are bounded by the page (≤ 200). There is no N+1: authority is read once per page. The column grants needed for `FOR UPDATE` and for the pointer `UPDATE` are present (`014:142`, `020:414`). `ON CONFLICT(document_revision_id) DO NOTHING` plus «no id» gives `REVIEW_ALREADY_DECIDED`. |
| `document-dependencies.ts` | link `:75-90`, list `:100-103`, flag `:44-51` | Link takes `FOR SHARE` on the upstream row (runtime holds UPDATE on some columns, so the lock is permitted). The list has `LIMIT` and `ORDER BY created_at DESC, id`. `ON CONFLICT(pair) DO NOTHING` plus «no row» gives `DEPENDENCY_EXISTS`. The flag statement filters tenant, project and upstream explicitly. |
| `review-delegations.ts` | list `:108-121`, grant `:143-145`, revoke `:173-174` | Grant uses `ON CONFLICT … WHERE revoked_at IS NULL DO NOTHING` (the partial unique index) plus «no id» gives `DELEGATION_EXISTS`. Revoke uses `version=$5 AND revoked_at IS NULL`; zero rows gives `DELEGATION_CONFLICT`. The list cap is P2-4. |
| `decisions.ts`, `bom.ts:104-123` | read only | `pending`: `LIMIT 30`, `ORDER BY created_at DESC, id DESC`, N+1 bounded (P3-3); fail-closed invariant since the sweep. |
| `skill-context.ts` | `:43-86` | Each statement filters `project_id=$1` explicitly. Every list has a `LIMIT` (20 / 50 / 30) and a deterministic order, with `COLLATE "C"` and an id tiebreak. Message text comes only through `source-text.ts`. For a pointer-only project, titles and summaries are NULL in SQL. |
| `source-text.ts` | `:47-72` | Thread messages: `LIMIT`, newest by `observed_at, id`, latest revision by `LATERAL … LIMIT 1`. Revisions of one event: no `LIMIT` (P3-4). |
| `suggestions.ts` | submit `:94-104`, list `:116-118`, decide `:136-190` | Submit: `ON CONFLICT(tenant_id,dedupe_key) DO NOTHING`; a follow-up read under the AI's single-project scope; «nothing inserted, nothing visible» gives `IDEMPOTENCY_CONFLICT` (R12-a, correct). List: `LIMIT`, `ORDER BY created_at DESC, id DESC`, served by `idx_ai_drafts_entity` (the RLS tenant term is a stable expression usable as an index qual). Decide: `ON CONFLICT(draft_id) DO NOTHING` plus «no row» gives `DRAFT_ALREADY_DECIDED`. |
| `documents.ts` `proposeRevisionIn` | `:153-174` | `FOR UPDATE` first, under RLS on the caller's projects. `max(revision_no)+1` under that lock satisfies the forward-only latest guard. |
| `document-commands.ts` | `:13-26` | `ON CONFLICT(tenant_id,actor_id,command_key) DO NOTHING`. A row hidden by RLS (another project) gives `IDEMPOTENCY_CONFLICT`, never a replay. This is correct. |

**AR-07:** no added query is a report or aggregate over Z1. The `count(*)` totals are pagination of operational lists inside one project. Nothing reads across projects or reporting domains.

**Locks and lock order** (#inference):

| Path | Locks, in order |
|---|---|
| `ReviewService` comment and decide | `document_records … FOR UPDATE` first; the decision guard then takes `FOR NO KEY UPDATE` on the row it already holds |
| `proposeRevisionIn` | `FOR UPDATE` first |
| `link` | `FOR SHARE` on the upstream row; the FK `KEY SHARE` on the dependent at insert |
| `SuggestionService.decide` | `pg_advisory_xact_lock(0x44524654, hashtext(draft_id))`, then, for a document confirmation, `FOR UPDATE` on the document inside `proposeRevisionIn` |
| revoke | `NO KEY UPDATE` on the delegation (the partial unique index is not a key), compatible with the decision FK's `KEY SHARE` |

- **No cycle exists**, because no path takes a document lock and then the advisory lock, and no path locks two document rows exclusively.
- **What `link` can do:** wait on a concurrent proposal or decision on the dependent document. That document's transaction never needs the upstream row.
- **Hash collisions** of the advisory key between drafts only serialise two unrelated decisions.
- **Key spaces:** the advisory lock's two-int key space is disjoint from the one-bigint keys of `intake.ts` and `scripts/migrate.ts`.

## 3. Audit and events

| Write path | Immutable record | Who | What | Entity | Tenant | Request id | Trace id |
|---|---|---|---|---|---|---|---|
| Comment | `review_comments` row + `review_events` `review.<kind>` | ✓ (`actor_id`, RLS-bound) | ✓ | ✓ | ✓ | ✓ HTTP | random per write |
| Review decision (+ pointer move) | `review_decisions` row + `review_events` with `versionBefore`/`versionAfter` | ✓ (`decided_by`, RLS-bound) | ✓ | ✓ | ✓ | ✓ HTTP | random |
| Delegation grant / revoke | row (`granted_by`, `revoked_by`, trigger-stamped `revoked_at` and `version`) + `review_events` | ✓ | ✓ | ✓ | ✓ | ✓ HTTP (event only) | random |
| Dependency link | row (`confirmed_by`) + `review_events` | ✓ | ✓ | ✓ | ✓ | ✓ HTTP | random |
| Dependency flag | row update (version +1, DB-stamped times) + `review_events` | ✓ | ✓ | ✓ | ✓ | **✗, made up** (P2-2) | random |
| Revision proposal (slice-1 path, reused) | `registry_events` `revision_proposed` | ✓ | ✓ | ✓ | ✓ | — (table has no column; pre-existing) | — |
| AI draft | `intelligence.ai_drafts` row | `ai_principal_id` (RLS-bound) | ✓ | `entity_type`/`entity_id` | ✓ | — | from the pipeline |
| Draft decision | `draft_decisions` row | ✓ (`decided_by`, RLS-bound) | `result` + `draft_value_hash` | `draft_id` (+ `document_revision_id`) | ✓ | ✓ HTTP | random (M12-1) |

**Ruling R12-c: I agree.** A `draft_decisions` row is attributed, scoped and immutable even for the operator (`021:153-154`, test `z4-schema.test.ts:255-269`). It carries every E-DB-13 field except `old_value`. For a decision, `old_value` is meaningless; `draft_value_hash` stands as the «what was seen». A second `review_events` row would only duplicate it, and would need `entity_type` widened in an approved migration. Two conditions belong in the receipt:
1. Its `trace_id` is random, not propagated (E-OBS-02, SHOULD).
2. For a confirmed document draft, the `revision_proposed` event does not name the draft. The link from revision to draft is `draft_decisions.document_revision_id`, plus the shared `command_key`.

**`review_events`** has no entity-existence guard and no fixed list of kinds (P3-1). Its integrity rests on the services, as with `registry_events`. Nothing reads it today.

## 4. Test coverage of the schema layer (Quality Gate 34a–34e)

| Table | 34a read | 34b write | 34c delete / update | 34d no context | 34e bypass |
|---|---|---|---|---|---|
| `review_delegations` | project ✓ / tenant **✗** | project ✓ (LTR02) / tenant **✗** | DELETE not granted ✓; cross-scope UPDATE 0 rows ✓ (`:138-140`) | read ✓ / insert ✓ | ✓ (a) |
| `review_comments` | project ✓ / tenant **✗** | project ✓ / tenant **✗** | not granted + immutable ✓ | ✓ / ✓ | ✓ (a) |
| `review_decisions` | project ✓ / tenant **✗** | project ✓ / tenant **✗** | not granted + immutable ✓ | ✓ / ✓ | ✓ (a); the guard stops the operator |
| `document_dependencies` | project ✓ / tenant **✗** | project ✓ / tenant **✗** | not granted ✓; cross-scope UPDATE 0 rows ✓ (`:135-137`) | ✓ / ✓ | ✓ (a) |
| `review_events` | project ✓ / tenant **✗** | project ✓ / tenant ✓ (`:128`) | not granted + immutable ✓ | ✓ / ✓ | ✓ (a) |
| `intelligence.ai_drafts` | project ✓ / tenant on insert only | ✓ / ✓ (`:153-159`) | not granted + immutable ✓ | ✓ (`:170-185`) | role NOBYPASSRLS ✓ (`:135-143`) |
| `draft_decisions` | **✗** | ✓ / ✓ (`:333-334`) | not granted + immutable ✓ | read **✗** / insert: person only (`:331`) | ✓ (a); the guard stops the operator |
| `document_approvers()` (definer) | ✓ incl. the tenant mutation of 4a S-1 | n/a | n/a | ✓ | definer owner is not a superuser ✓ |

(a) The runtime login is refused at start if it is a superuser or BYPASSRLS (`src/server/db.ts:63-64`), and `assertRestrictedLogin` adds more checks (`:20-30`). The operational login is a superuser and bypasses RLS and three guards by design (S7, S34, S61). The receipt must say so.

The gaps marked **✗** are P1-1.

`tests/migrations-rollback.test.ts:137`, `:222` and `:306` cover the refusals of all three rollbacks, and the later-migration refusal. `:24` covers forward → rollback → forward for every file from 013.

## 5. Consolidated deployment note (input to the Chairman's stop point; nothing is applied anywhere)

**Pre-checks** (read-only, on the target server):
- `SELECT max(version) FROM schema_migrations` returns `018`.
- No `memberships_grant_permissions_check`, `memberships_doc_approve_guard`, `public.document_approvers`, review tables or schema `intelligence` exist yet.
- The CHECK constraints on `identity.memberships` are exactly `memberships_project_role_check` and the three-value `memberships_report_permissions_check` (4a D-M6).
- Roles `libetech_runtime` and `libetech_identity` exist. `libetech_ai` is absent, or present with NOLOGIN, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE and NOREPLICATION, with no member and in no role.
- `has_schema_privilege('public','public','CREATE')`, evaluated for PUBLIC, is false (021 M-6).
- `pg_default_acl` has no entry for PUBLIC or `libetech_ai`.
- PostgreSQL is version 16 or later.
- The runtime and web logins are neither superuser nor BYPASSRLS.
- Record in the receipt the row count of `identity.memberships` and the list of superusers.
- No long transaction is touching `identity.*`, `document_records` or `document_revisions`.

**Order and role:**
- Apply 019 → 020 → 021, through `scripts/migrate.ts` with `MIGRATION_DATABASE_URL` as a **superuser** migration login, never the web or runtime login. A superuser is required because:
  - 021 creates a role and its guard refuses an automatic CREATEROLE membership;
  - 019 runs `ALTER FUNCTION … OWNER TO libetech_identity`;
  - 020 creates triggers and FKs on 014's tables.
- The runner applies **every pending file in one run** and has no «stop at version» option (`scripts/migrate.ts:12-16`). If the Chairman wants 019 alone first, it has to be run as its own file, by hand, by the same login. Each file is its own transaction.

**Locks and duration class:**
- 019: ACCESS EXCLUSIVE on `identity.memberships`, held for O(rows), so seconds at most. Logins queue behind it. Choose a quiet window.
- 020 and 021: SHARE ROW EXCLUSIVE on `projects`, `document_records` and `document_revisions`. Writes wait for the duration of the transaction; reads continue.
- Each file has a 5 s `lock_timeout`. If it times out, the whole file rolls back and can be retried.
- Nothing is rewritten.

**Behaviour change on apply:**
- The runtime role can no longer move `latest_revision_id` backwards or to NULL.
- Decisions and proposals on one document serialise.
- `app.person_id` must be set by each writing service; the services in this branch do so.
- After 021, every app start refuses a login that can reach `libetech_ai` or owns tables in `intelligence`.

**When each step becomes irreversible:**

| Migration | Irreversible from | Why |
|---|---|---|
| 019 | the first access-change ballot that names a `doc_approve:` code, in any state | ballots cannot be deleted by any app role, and the rollback refuses while one exists |
| 020 | the first `approved` decision, by its own check | the rollback otherwise destroys all review history (P2-1); treat the first comment, delegation or decision as the practical point of no return unless P2-1 is fixed |
| 021 | the first `draft_decisions` row | none exists while Z4 is off; drafts alone do not block the rollback but are destroyed by it |

**Must not be done before OQ-14, and for the drafts also OQ-45, are decided:**
- no `ALTER ROLE libetech_ai LOGIN`, no password for it, no `GRANT libetech_ai TO …`;
- no login or connection string for the pipeline;
- no `SuggestionService` constructed with an AI database handle;
- no HTTP route for drafts;
- no model call.

Draft rows can never be deleted (P3-7). Any draft stored before OQ-45 point 3 is decided, including one for an IBS HI project, is permanent.

**After apply, check:**
- `pg_get_triggerdef` of `memberships_doc_approve_guard` names its four columns;
- the owner of `document_approvers` is `libetech_identity`, and `has_function_privilege('libetech_intake', …, 'EXECUTE')` is false;
- `relforcerowsecurity` is set on all seven new tables;
- `libetech_ai` has no members;
- `schema_migrations` holds 019, 020 and 021.

**Rollback** only on a copy, and only with Chairman approval (AGENTS.md).

## 6. Deferred minors: triage (schema, SQL and migration items of the ledger)

**Must be fixed before merge:** none of the ledger items. The only must-fix in this review is P1-1, which is new.

**Already fixed** in the sweep `2a267c5` or earlier (verified in the files):
- T1 `DUPLICATE_HINT_SQL` alias note (`source-text.ts:41-42`);
- T2 later-migration rollback path (`migrations-rollback.test.ts:137/222/306`);
- 4a `doc_types` order (consumers use `includes`, `document-review.ts:86-87,109`);
- 4b FK on `flagged_revision_id` (`review-schema.test.ts:504`);
- 8 M-5 (Ruling R12-a, `suggestions.ts:100-103`);
- 8 N-1 (sweep);
- 13 M1 and M2 (`decisions.ts:51-59`, `bom.ts:116-117`).

**May wait** (state each in the receipt):
- T1: the correlated mapping subquery is evaluated up to three times per row (performance only).
- 4a: the membership guard is a consistency net, not a boundary against `libetech_identity`. **Must** be in the receipt.
- 4a: rollback 019 does not lock before its checks (P3-6).
- 4a: the membership guard has no own SQLSTATE. The service refuses first with `DOC_APPROVAL_NEEDS_ACCESS_CHANGE` on the registration path.
- 4b: `review_events` has no entity or kind guard (P3-1).
- 4b: comment authority and «effective at once» for comments are service-only (M3).
- 4b: a commenter's `changes_requested` takes the only decision slot (M9, Chairman trade-off).
- 4b: self-revocation by a delegate who is a manager (M8, S62).
- 5 M-2: `addressed`/`resolved` by the author do not re-read membership. `auth.role` is read from the database; the author/writer identity checks are not.
- 5 M-3: comments are cut at 1000 (P2-4).
- 6: no case where flagging fails and rolls the proposal back (transaction semantics cover it).
- 6: no native race between `link` and `proposeRevision`. I traced the lock paths too and found no cycle.
- 6: `flagDependents` takes the project id from its caller (the statement also filters tenant, project and upstream; RLS covers).
- 7a M5: the delegation list has no total (P2-4).
- 7a M6: a replay after an eligibility change.
- 7d M4, N1, N2.
- 8 M-6: the PUBLIC `CREATE` pre-check (moved into the deployment note above).
- 12 M12-1: `trace_id` is random (receipt).
- 12 M12-3: «confirmed» does not bind the revision body to the draft value (receipt; the database cannot).
- 12 M12-4: a dedupe conflict reveals that the key exists elsewhere in the tenant (the pipeline principal is trusted, and only a key is revealed, not content).
- 12 M12-7: a stored value nested too deeply to hash answers 500 (reachable only by a direct insert).

**Wrong or obsolete:** none. T2 is obsolete rather than wrong: it was superseded once 019–021 had rollback tests.

## Rulings I disagree with

None.
- **R12-c:** I agree, with the two receipt conditions in section 3.
- **The 4a D-1 ruling** (the guard checks a ballot state; vote counting stays in the service): I agree. The migration header states exactly what the database guarantees.

## For the receipt

- **Level of the claim:** the code exists. Migrations 019, 020 and 021 are applied to no real database. Applying them is a Chairman stop point, and section 5 is the input to it.
- **019's database guarantee:** a `doc_approve` code enters a membership only if an `issued` ballot, or an `approved` and unexpired one, names that person, project and code. That is a ballot state label, not proof that the votes were counted.
- **When each migration becomes irreversible:**
  - 019: from the first ballot naming a code.
  - 020: from the first approval. In practice from the first review row, because the rollback destroys history (P2-1, unless fixed).
  - 021: from the first draft decision.
- **Superuser bypass:** the operational login is a superuser. It bypasses RLS, and it bypasses the designation guard, the revoke manager check and both pointer guards. It does not bypass the decision guards. Superusers can also disable triggers or `TRUNCATE` history tables (pre-existing since 001).
- **Rows cut silently:** delegations at 200, comments at 1000, the decision queue at 200 (P2-4).
- **Audit ids:**
  - `dependency.flagged` events carry a per-transaction request id, not the HTTP request id (P2-2, unless fixed).
  - Every `trace_id` written by this slice is generated per write and not propagated.
  - A draft decision has no separate event row (R12-c). It is linked to its revision by `document_revision_id` and the shared `command_key`.
- **Z4:**
  - Z4 is not switched on: `libetech_ai` has no login and no member, and no route or handle reaches `SuggestionService.submitDraft`.
  - Draft rows are permanent, so nothing may be stored before OQ-14 and OQ-45 are decided.
  - The dedupe key is unique per tenant across projects, and a key used in another project answers `IDEMPOTENCY_CONFLICT`.
- **Tenant-isolation tests:** they cover the dimensions in the section 4 table. Until P1-1 is fixed, cross-tenant read is not tested for the review tables, and no isolation read at all is tested for `draft_decisions`.
- **Migration runner:** `scripts/migrate.ts` applies all pending migrations in one run. Staged application needs a manual per-file run.

## Re-review of the fix wave (f0d08c8)

**Scope.** The database items W2, W7, W8, W9 and W10 of `ffa5781..f0d08c8`, read through:
- `review-tier1-fix-ffa5781..f0d08c8.diff`;
- the wave brief;
- the implementer's report;
- `tier1-fix-mutation.txt`;
- the green logs: native 971 passed, 0 skipped; PGlite 932 passed, 39 skipped; typecheck exit 0.

I ran no database and no test. Line numbers are at `f0d08c8`. Lock statements are `#inference`.

### Verdict per item

| Item | Verdict | Evidence |
|---|---|---|
| W2 (P1-1) | **ADDRESSED** | Details in «W2 in detail» below. |
| W7 (P2-1, P3-6) | **ADDRESSED** | Details in «W7 in detail» below. |
| W8 (P2-2) | **ADDRESSED** | `src/server/suggestions.ts:183` passes the decision's `requestId` to `proposeRevisionIn`, and `src/server/documents.ts:172` uses `requestId ?? randomUUID()`. Tests at `tests/suggestions.test.ts` (two new W8 cases): (1) the flag event and the draft decision carry the same request id; (2) a manual proposal gives every flag event of its transaction one shared generated id. The manual path's per-transaction id must be stated in the receipt (updated below). |
| W9 (P2-4) | **ADDRESSED** | Pure helper `src/server/list-cut.ts:2`, with a unit test. The three flags, with no pagination, by ruling: (1) delegations `LIMIT 1001` (`review-delegations.ts:110,112`), cut back to 1000 (`:114-115`), flag from the fetch or from the 200 slice (`:126`); (2) comments `LIMIT 1001` (`document-review.ts:188-190`); (3) decision cards from the queue's `total` (`decisions.ts:81`). The `ORDER BY` clauses and visibility filters are unchanged; only the number in `LIMIT` moved. The comments query now joins `document_revisions` on `v.id=c.document_revision_id`. That join cannot drop a row: by FK, the revision belongs to the comment's document, in the same project and scope. |
| W10 (P2-3) | **ADDRESSED** | `migrations/019_document_approver_grant.sql:10-12` adds three header lines and nothing else. `git diff ffa5781 f0d08c8 -- migrations/0{19,20,21}_*.sql` shows 3 insertions in 019, all comments, and no change in 020 or 021. |

### W2 in detail

**What the new cases check:**
- `tests/z4-schema.test.ts`, new case «draft decisions are invisible to another project, another tenant and a session with no context». It reads `draft_decisions` four ways: as the owning scope (control row visible), under project `[transport]` (0 rows), as another tenant holding the sales id (0 rows), and with no context (`[]`).
- `tests/review-schema.test.ts`, new case «review tables are invisible to another tenant that holds the project id, and fail closed with no context». For each of the five tables it reads three ways: control (1 row), other tenant with the sales id in `app.project_ids` (0 rows), and no context (0 rows).
- Cross-tenant inserts are added for comments, dependencies, delegations and decisions (`review-schema.test.ts:132-138`).
- The test at `:123` is renamed to what it checks.
- Mutations 1 and 2 show that removing the tenant clause on `review_comments` and the project clause on `draft_decisions` each turn a case red.

**The decision insert.** The implementer is right that a cross-tenant decision insert is refused by `review_decisions_guard` before WITH CHECK runs. A BEFORE ROW trigger runs ahead of the policy check. The guard looks the document up by `NEW.tenant_id` under the runtime's own RLS, so with another tenant it never finds it.

So the *dimension* (34b: a write into another tenant is refused) is adequately covered. The barrier the runtime actually meets is the guard, and the guard is itself bound to the RLS-scoped lookup and to `d.tenant_id = NEW.tenant_id`. Through the runtime role, the WITH CHECK tenant clause on `review_decisions` is unreachable defence in depth. No behavioural assertion can pin it while the guard stands.

To pin the clause itself, without a mutation, add one catalog assertion. For each of the seven `runtime_insert` policies (and `ai_insert`), assert that `pg_policies.with_check` contains both `tenant_id` and `app.tenant_id`, for example with `~ 'tenant_id = NULLIF\(current_setting\(''app.tenant_id''::text, true\)'`. That turns `rls-catalog.test.ts`'s «WITH CHECK exists» into «WITH CHECK binds the tenant». This is a P3; it is not required.

**The delegation insert** pins the clause by behaviour. The designation guard reads `bom_eligible_members(NEW.project_id, …)` under the context tenant and never compares `NEW.tenant_id`, so it passes, and WITH CHECK is what refuses. The `row-level security` match proves that.

### W7 in detail

**Rollback 020.** `migrations/rollback/020_document_review.sql:22-30` refuses while any row exists in any of the five review tables. It uses `to_regclass` and `format('… %I', t)`, so it can be run again after the tables are gone. The message names only the table. This runs after the approval check, under `row_security = off`.

**The changed rollback-020 test** (`tests/migrations-rollback.test.ts:283-295`) is a **legitimate consequence of the ruling, not a weakening**:
- Old step 4 ran the rollback while a `changes_requested` decision existed. The new rule forbids exactly that.
- The new step 3b adds a refusal: one person's comment alone blocks the rollback, names the table, drops nothing, and the row survives. That covers the new rule's main case.
- Step 4 then empties the five tables and proves the drop path.
- Nothing that was asserted before is asserted less. The «approval blocks» and «later migration blocks» steps are unchanged.
- One gap remains: only `review_comments` is shown refusing on its own (see the Deferred list).

**Forward → rollback → forward** is the generic case at `migrations-rollback.test.ts:24`. It runs on freshly migrated, empty tables, so the new refusal never fires there. Both green logs include it: native has 0 skips; on PGlite that case is not native-only. I read that from the test names and the logs; I did not run it.

**On a legitimately empty server**, both rollbacks still run. An empty review schema passes the 020 loop. 019 is unchanged apart from the new lock.

**Rollback 019 lock** (`migrations/rollback/019_document_approver_grant.sql:11`): `LOCK TABLE identity.memberships, identity.account_approvals IN SHARE MODE`. These are the right two tables: exactly the ones its checks read.
- SHARE conflicts with ROW EXCLUSIVE, so no ballot or membership write can slip in between the checks and the DROP. Readers (ACCESS SHARE), meaning logins, session checks and grant reads, are not blocked by it.
- The forward path never runs concurrently with its own rollback (the runner holds an advisory lock).
- There is one new, minor hazard, a lock upgrade (#inference); see N-1.

### New breakage in the fix diff

- **P0, P1, P2: none.**
- **N-1, P3: the SHARE lock in rollback 019 can turn into a detected deadlock against a live identity transaction.**
  - Mechanism: the file later needs ACCESS EXCLUSIVE on `identity.memberships` (`ADD CONSTRAINT`, then `DROP CONSTRAINT`). Two sequences end in `40P01`:
    - (a) An identity transaction already holds ACCESS SHARE on `memberships` (it has read it) and then wants ROW EXCLUSIVE for its `DELETE`/`INSERT` (`accounts.ts:163-165`). It waits on our SHARE, while our upgrade waits on its ACCESS SHARE.
    - (b) An identity transaction holds ROW EXCLUSIVE on `account_approvals` and then inserts into `memberships`, while the multi-table `LOCK` holds `memberships` and waits for `account_approvals`.
  - Outcome: PostgreSQL detects the cycle and aborts one side after `deadlock_timeout`. Nothing is applied in part, and the rollback runs only on copies with Chairman approval. Before the fix, sequence (a) ended in a wait or a lock timeout, not a deadlock.
  - Smallest fix: take the final mode at once and in the service's order: `LOCK TABLE identity.account_approvals IN SHARE MODE; LOCK TABLE identity.memberships IN ACCESS EXCLUSIVE MODE;`. That removes the upgrade. The cost is that readers of `memberships` (logins) also wait during the checks, which is acceptable for a copy-only rollback that holds that lock right after anyway.
- **N-2, P3: on rare data, the delegation flag tells a non-coordinator something about rows they cannot see.**
  - Where: `review-delegations.ts:114,126`. For a non-coordinator, `fetchedCut` is computed on rows that passed the SQL filter but before the JavaScript filter drops other people's dormant rows.
  - Scenario: in a project with more than 1000 such rows, most of them dormant, a reader sees fewer than 200 rows with `reviewersTruncated: true`. That reveals «more than 1000 rows exist, including dormant ones».
  - It is one boolean, and it needs more than 1000 delegations in one project. This loss of visible rows to dormant ones existed before the fix; the flag now makes it observable.
  - Fix: compute the flag after `visibleDelegation`, or move the dormant test into SQL. This can wait.
- `wasCut` with a total (`decisions.ts:81`) compares `items.length` with the queue's `total`. A record skipped for a missing revision (an unreachable state) reads as «cut», which errs in the safe direction. `total` was already in the queue's own answer, so no new count leaks.

### Quality Gate 34a–34e after the wave (the eight new database objects)

| Table | 34a read | 34b write | 34c delete / update | 34d no context | 34e bypass |
|---|---|---|---|---|---|
| `review_delegations` | project ✓ / tenant ✓ | project ✓ (LTR02) / tenant ✓ (policy) | DELETE not granted ✓; cross-scope UPDATE 0 rows ✓ | read ✓ / insert ✓ | ✓ (a) |
| `review_comments` | ✓ / ✓ (mutation 1) | ✓ / ✓ | not granted + immutable ✓ | ✓ / ✓ | ✓ (a) |
| `review_decisions` | ✓ / ✓ | ✓ / ✓ (guard first; the WITH CHECK clause is pinned only by the catalog test's existence check, P3) | not granted + immutable ✓ | ✓ / ✓ | ✓ (a); the guard stops the operator |
| `document_dependencies` | ✓ / ✓ | ✓ / ✓ | not granted ✓; cross-scope UPDATE 0 rows ✓ | ✓ / ✓ | ✓ (a) |
| `review_events` | ✓ / ✓ | ✓ / ✓ | not granted + immutable ✓ | ✓ / ✓ | ✓ (a) |
| `intelligence.ai_drafts` | ✓ / tenant on insert | ✓ / ✓ | not granted + immutable ✓ | ✓ | role NOBYPASSRLS ✓ |
| `draft_decisions` | ✓ / ✓ (mutation 2 for the project clause) | ✓ / ✓ | not granted + immutable ✓ | read ✓ / insert: person only | ✓ (a); the guard stops the operator |
| `document_approvers()` | ✓ incl. the tenant mutation of 4a | n/a | n/a | ✓ | owner is not a superuser ✓ |

(a) The runtime login is refused at start if it is a superuser or BYPASSRLS (`db.ts:63-64`). The operational login is a superuser by design (S7, S34, S61).

What remains short of full marks: the tenant clause of `review_decisions.runtime_insert` WITH CHECK is not pinned by behaviour (it cannot be, while the guard stands). The suggested catalog assertion would close that.

### Deferred (out of scope of this wave)

- N-1 and N-2 above.
- A catalog assertion that every insert policy's WITH CHECK binds `app.tenant_id`.
- A refusal case for each of the other four tables in rollback 020. Only `review_comments` is exercised; the loop is generic, so this is low risk.

### Updates to «For the receipt» and the deployment note

The wave changes these entries:
- **Rollback 020 preconditions:** nothing above 020 is recorded, and there is **no row at all** in `review_decisions`, `review_comments`, `review_events`, `review_delegations` or `document_dependencies`; an approved decision is one such row. With rows present it refuses and names the table. So 020 is irreversible, within the rules, from the first review row of any kind, unless the rows are exported and the Chairman approves their destruction. This replaces «from the first approval» and the P2-1 caveat.
- **Rollback 019** now takes `SHARE` on `identity.memberships` and `identity.account_approvals` before its checks. It blocks writes to both tables, not reads, until it commits. Run it in a window with no identity writes (N-1). Its preconditions are unchanged.
- **Request ids:** a `dependency.flagged` event carries the HTTP request id when the revision comes from a confirmed AI draft. On the manual proposal path it carries one id generated for the transaction, shared by every flag event of that proposal, because the slice-1 proposal API carries no request id. This replaces the P2-2 line.
- **List cuts:** the three silent cuts now answer with `reviewersTruncated` (at 200 shown, from at most 1000 fetched), `commentsTruncated` (at 1000) and `reviewCardsTruncated` (at 200 documents). There is still no pagination, by ruling. This replaces the P2-4 line.
- **Re-running 019 on embedded starts:** the 019 header now warns later migrations about the CHECK-drop loop. There is no code change.

VERDICT after the fix wave: READY

## Class sweep before the gate's last run (c363992)

Scope: `019`/`020`/`021` and their rollbacks at `c363992` (read with `git show`; `git diff f0d08c8 c363992 -- migrations` is empty), the 014 objects that 020 relies on, and the four service files changed since `f0d08c8`. Not repeated here: the approved-pointer same-transaction gap, the `DependencyService.link` revision and the draft-decision idempotency fingerprint (the coordinator's known items). Read-only; no test was run.

Standing trust boundary (applies to every «same person» row below, not counted again): every attribution policy and guard keys on `app.person_id`, which `libetech_runtime` sets itself with `set_config(...,true)`. «Same person» therefore means «the person the web tier says», which is the trust D-M8 already places on `app.tenant_id`/`app.project_ids`. Recorded as a receipt (A-0, P3), not as a defect.

### Class A — promise versus check

| # | Object (committed text) | Promise | Actual check | Gap |
|---|---|---|---|---|
| A-0 | all `runtime_insert`/`runtime_update` policies, 020:154,165,175,185,195,212; 021:116 | «the person who …» | `col = nullif(current_setting('app.person_id',true),'')::uuid` | GUC settable by the runtime role — trust boundary above. P3 receipt |
| A-1 | `review_decisions_guard` 020:284-287 with 014:124-127 | S7: «author ≠ decider» enforced by the database | compares `NEW.decided_by` with `document_revisions.proposed_by`; the 014 insert policy binds tenant, project, `self_declared` and `snapshot_ref IS NULL` but **not** `proposed_by` | the author side of the check is a free column. Under one fixed `app.person_id`, raw SQL can insert a revision naming another person as `proposed_by`, move `latest_revision_id` to it (020:332-350 allows any higher `revision_no`), then record a `changes_requested` decision on its own content, and comment on it as if it were the author. An `approved` decision is still stopped, because runtime-inserted revisions are never frozen (`snapshot_ref IS NULL`, no UPDATE path). **P2** |
| A-2 | `document_records_latest_guard` 020:330-350 | «only moves forward» | forward = any existing revision of the same document with a higher `revision_no`; the 014 grant (014:142) lets `latest_revision_id` change without `version` changing, and no guard ties the move to the transaction that inserted the revision | holds for direction. Does not hold for «the next revision» or «version moves with the pointer»: a two-step path (insert rev N+5 now, move the pointer later) is accepted, and the record's `version` can stay unchanged while latest moves. The decision guard's `record_version` check then accepts a decision against a version number that predates the pointer move (it still binds the revision itself, so no wrong revision is decided). P3 |
| A-3 | `document_dependencies_flag_guard` 020:354-390 | «set or advanced, never cleared; version +1» | enforced as written; «newer» = any higher upstream revision, not the latest, not tied to the proposing transaction; `+1` only, with no expected-version check | matches its own comment; only the schema notes' implication «flag follows a proposal» is service-only. Folded into B-2 |
| A-4 | `draft_decisions_guard` 021:122-149 (revision clause 139-143) | suggestions.ts order (6): «the person's own revision proposal, under the same claim» | the revision only has to belong to the draft's document; a `confirmed` document draft may carry `document_revision_id IS NULL`; no `proposed_by = decided_by`, no «is the latest» | raw SQL can record «AI draft confirmed → revision X» against an older revision, or another person's revision, so that revision reads as AI-derived. Row is immutable and attributed to the decider, so only the link is weak. P3 |
| A-5 | `reject_history_mutation` triggers: 014:131; 020:393-402; 021:151-154 | «never change» | `BEFORE UPDATE OR DELETE … FOR EACH ROW`; TRUNCATE not covered | no application role holds TRUNCATE (grants 020:406-414, 021:159-165), so only the owner or the operational login can do it. Already recorded in task 1. P3 |
| A-6 | `review_comments` 020:31-36; service `document-review.ts:264-266` | a thread is closed by its one `resolved` reply | service-only: a read under the document row lock (`lockRecord`, :227/:246), then a refusal; the schema has no partial unique index on `(parent_id) WHERE kind='resolved'` | the service path is now correct. Raw SQL can add a second `resolved`, or any reply after it. This matches the standing «comment authority is service-only» position. P3 |
| A-7 | `memberships_doc_approve_guard`, `document_approvers` (019); designation and revoke guards 020:216-258; rollback 019/020/021 | as written | as written (re-read; unchanged since the fix wave) | none found beyond the known item and N-1/N-2 |

### Class B — Z1 change with no DB-required immutable attributed record

| # | Change the runtime role can make | Record the DB requires | Gate phrasing | P |
|---|---|---|---|---|
| B-1 | move `document_records.latest_revision_id` (014:142, 020:332-350) | an immutable `document_revisions` row exists, but its `proposed_by` is not bound to the actor (A-1); no `registry_events` row is required; `version` need not change | «a document's latest revision can be moved by the runtime role to a revision whose author column it chose itself» | rated with A-1 (P2) |
| B-2 | set or advance `document_dependencies.needs_review`/`flagged_revision_id` (020:195-199 policy, 354-390 guard) | none: the row has no `flagged_by`, and `review_events` `dependency.flagged` is written by the service only | «a dependency flag can be set or advanced by the runtime role with no attributed record» | P3 (a flag cannot be cleared, so the worst case is a false «needs review») |
| B-3 | revoke a delegation | the row itself: `revoked_by = app.person_id` (020:165), a manager check, live→revoked once, stamped | — | none found |
| B-4 | insert decision, comment, event, draft decision | each row is immutable and bound to `app.person_id` (020:175,185,212; 021:116) | — | none found |
| B-5 | `approved_revision_id` | known item (not repeated) | — | — |

### Findings and smallest fixes

- **P2 — A-1/B-1. Revision author not bound to the actor** (014:124-127, relied on by 020:287 and 020:332-350).
  - Fix: in 020 (forward, idempotent), replace the `scope_insert` policy on `document_revisions` with the same predicate plus `AND proposed_by = nullif(current_setting('app.person_id',true),'')::uuid`, and restore the 014 text in `rollback/020`.
  - The only inserter is `documents.ts:169`, and it sets `app.person_id` first at :155, so no service path changes.
  - Test: insert a revision as person A with `proposed_by = B` → refused; with no `app.person_id` → refused.
- **P3 — A-2.** Add `NEW.version = OLD.version + 1` to the latest guard when the pointer moves. Optionally require the target `revision_no = OLD + 1`.
- **P3 — B-2.** Add `flagged_by uuid` to `document_dependencies`, stamped by the flag guard from `app.person_id` (and refused when it is empty), or accept the gap as service-only and record that in the schema notes.
- **P3 — A-4.** In `draft_decisions_guard`, for `result='confirmed'` on a document draft, require a non-null revision with `v.proposed_by = NEW.decided_by` and `v.id = (SELECT latest_revision_id FROM document_records WHERE id = d.entity_id)`.
- **P3 — A-6.** `CREATE UNIQUE INDEX IF NOT EXISTS … ON review_comments(parent_id) WHERE kind='resolved'`. This blocks a second `resolved` but not a reply after one; that part stays service-only.
- **P3 — A-0, A-5.** Receipts only: the trust boundary, and TRUNCATE held by no app role.

Counts for this sweep: P0 0 · P1 0 · P2 1 · P3 6 (A-0, A-2, A-4, A-5, A-6, B-2).

VERDICT after the class sweep: READY WITH FIXES (one P2, A-1/B-1; the P3s may be deferred with receipts)
