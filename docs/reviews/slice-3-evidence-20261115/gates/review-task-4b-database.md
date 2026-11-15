# Database review — Task 4b (migration 020, document review)

Reviewer: `liberico-database-reviewer` (advisory, task-scoped gate; not a merge review).
Scope: commit `c888e77` on `e779f12` — `migrations/020_document_review.sql`, `migrations/rollback/020_document_review.sql`,
`tests/review-schema.test.ts`, `tests/migrations-rollback.test.ts` (new case), `tests/slice3-fixtures.ts` (`delegate`, `revokeDelegation`).
Inputs read: brief v0.5 (`task-4b-brief-v05.md`), plan Global Constraints and rulings S3/S4/S5/S7/S10/S34/S38/S41/S50/S51/S61/S62/S74,
implementer report, the diff file. No database was started or connected; no test was run. Claims about lock behaviour are
`#inference` from PostgreSQL 16 lock semantics, not observed.

Focused checks outside the diff (one per named risk):
- `migrations/014_document_registry.sql:103-142` — existing `document_records` policies/grants/triggers that 020 extends (pointer grant interaction, row-lock privilege for `FOR SHARE`).
- `migrations/006_bom_allocations.sql:86-116` — `bom_eligible_members` semantics (active, password set, `coalesce(project_role, account role)`, scope-gated).
- `migrations/019_document_approver_grant.sql:61-78` — `document_approvers` (alphabetical `doc_types`, role filter, scope-gated).
- `migrations/001_foundation.sql:90-91` — `reject_history_mutation`.
- `src/server/db.ts:47-53` — `scoped()` sets only `app.tenant_id` and `app.project_ids`, **not** `app.person_id`.
- `src/server/documents.ts:161` — `proposeRevision` locks `document_records ... FOR UPDATE` first (lock order of the competing writer).
- grep of all migrations for other triggers/grants on `document_records` (only 014 `no_delete`, 015 projector `SELECT`).

### Spec compliance

| Brief item | Status | Where |
|---|---|---|
| `review_delegations` columns, CHECKs (basis, revoke_basis, version, 1..8 known types, no self-grant, revoke triple), `UNIQUE(id,tenant_id,project_id,delegate_id)`, partial unique live index | ✅ | `020:13-30`, `:100` |
| `review_comments` columns, scoped FKs, self FK, kind/parent CHECK | ✅ | `020:31-46` |
| `review_decisions` columns, `UNIQUE(document_revision_id)`, delegation FK on 4 columns, authority/approval/hash/exceptions CHECKs | ✅ | `020:47-70` |
| `document_dependencies` columns, not-self, pair unique, both doc FKs, two revision FKs, flag pair CHECK | ✅ | `020:71-88` |
| `review_events` columns, entity_type CHECK | ✅ | `020:89-97` |
| Common columns on every table (uuid PK default, `created_at`/`updated_at timestamptz NOT NULL DEFAULT now()`, tenant/project, scoped FK to `projects`) | ✅ | each table |
| RLS `ENABLE` + `FORCE` on all five | ✅ | `020:125-134` |
| Policies per brief, all `TO libetech_runtime`, scope on every one, person binding on every insert, revoke-only update shape, dependency update USING + WITH CHECK | ✅ | `020:137-203` |
| Grants: SELECT x5, column INSERT lists exactly as brief, `UPDATE(revoked_at,revoked_by,revoke_basis)`, dependency UPDATE set, `UPDATE(approved_revision_id) ON document_records`, no DELETE | ✅ | `020:327-335` |
| `review_delegations_guard` (BEFORE INSERT, superuser skip, `bom_eligible_members`, `LTR02` one code for both causes) | ✅ | `020:207-221` |
| `review_delegations_revoke_guard` (BEFORE UPDATE, every role; integrity branches without code; manager check `LTR03` for non-superuser; stamps time/version/updated_at) | ✅ | `020:225-249` |
| `review_decisions_guard` (authority `LTR01`; revision/author/number/hash; latest + version; freezing for approval) | ✅ (+ deviations a, b) | `020:253-289` |
| `document_records_approval_guard` (`BEFORE UPDATE OF approved_revision_id`, superuser skip, NULL refused) | ✅ | `020:293-311` |
| Immutable triggers on comments/decisions/events; no-delete on delegations/dependencies | ✅ | `020:314-323` |
| Index list of the brief | ✅ (+ deviation c) | `020:103-123` |
| Migration hygiene: `BEGIN/COMMIT`, idempotent, last statement records `020` with `ON CONFLICT DO NOTHING`, no data INSERT, pinned `search_path`, no SECURITY DEFINER | ✅ | `020:10-11`, `:337-338` |
| Rollback: refuses later version, refuses approved decision, drops 4 triggers + 4 functions, revokes pointer grant, drops 5 tables, no CASCADE, no role, nothing of 019, deletes `020` | ✅ | `rollback/020:1-33` |
| Fixtures `delegate`, `revokeDelegation` with the brief's signatures | ✅ | `tests/slice3-fixtures.ts` (diff `:1296-1316`) |
| Test case `each authority branch raises its own SQLSTATE and no integrity branch does` (named in the brief) | ⚠️ no case with that name; the assertions are spread over other cases (see Minor M7) | `tests/review-schema.test.ts` |
| Rollback case for 020 using the S41 pattern | ✅ | `tests/migrations-rollback.test.ts` (diff `:+222-304`) |
| Red-then-green evidence, native and PGlite | ✅ (logs in diff; I did not re-run) | diff `:16-240` |

### Strengths

- Every authority invariant of S7/S34/S61 is enforced by a trigger that runs as the writing role, so FORCE RLS applies to its own lookups: a lookup that returns nothing fails closed (document not found → refusal; delegation not visible → `LTR01`; `bom_eligible_members`/`document_approvers` are themselves scope-gated and return nothing out of scope).
- The revoke path is tight: column grant limited to three columns, `USING (... AND revoked_at IS NULL)` makes a revoked row unreachable for runtime, `WITH CHECK` binds the revoker to `app.person_id` and requires a basis, the trigger enforces the single transition for **every** role including the operator, and stamps `revoked_at`/`version`/`updated_at` itself (back-dating impossible, and the runtime needs no grant on `version`/`updated_at`). RLS `WITH CHECK` on UPDATE is evaluated after BEFORE ROW triggers, so the stamped row is what is checked.
- Array membership is non-positional everywhere (`rec.doc_type = ANY(g.doc_types)` / `= ANY(a.doc_types)`), so the alphabetical order of `document_approvers.doc_types` cannot matter.
- `IS DISTINCT FROM` is used for every NULL-able comparison in the decision guard (hash, number, latest pointer, version) and in the revoke guard's column freeze.
- Tests assert exact SQLSTATEs on authority branches and assert the *absence* of `LTR0x` on integrity branches; column grants are asserted as exact sets with `has_column_privilege` and also refused at statement time.
- The rollback case follows S41, proves refusal leaves objects identical, proves 019 untouched, and proves forward → back → forward identity. It already strips migrations > 020 first, so it keeps working when 021 lands.

### Findings

#### Critical

None.

#### Important

**I1 — The delegation authority branch does not re-check that the delegate is still an eligible member of the project.**
`migrations/020_document_review.sql:260-262`.
- Scenario: `reviewer` (project_role `technical`) holds a live `design` delegation in sales. A manager downgrades the reviewer's membership to `viewer` (S51 calls this "a reduction of rights, no ballot") or the account is deactivated, and nobody revokes the delegation. In a runtime transaction whose scope still contains sales (any principal construction that still lists the project, e.g. a session that predates the change), with `app.person_id` = reviewer: `INSERT INTO review_decisions (... authority='review_delegation', result='changes_requested', delegation_id=<live row>, decided_by=reviewer ...)` → the guard finds the live delegation and passes; the decision is stored.
- Why it matters: the approval branch re-checks effective role and active account on every decision (`document_approvers`, `019:71-72`, S51: "a holder downgraded to `viewer` stops being an approver at once"); the delegation branch does not, so the two authority branches have different strength. Because of S3 (`UNIQUE(document_revision_id)`), that stale `changes_requested` permanently occupies the revision's single decision slot and prevents its approval; a new revision is needed. The Global Constraints say viewers never act and that the review rules are enforced "at both service and database"; today only the service would stop this.
- Smallest fix: add to the delegation branch `AND EXISTS (SELECT 1 FROM public.bom_eligible_members(NEW.project_id, ARRAY[NEW.decided_by]) e WHERE e.project_role IN ('manager','engineer','technical','business'))` (same function and role set as the designation guard, S34), still raising `LTR01`; add one case (delegate downgraded to `viewer`, and deactivated, with a live delegation → `LTR01`).

**I2 — `FOR SHARE` in the decision guard creates a lock-upgrade deadlock unless the service locks the document row exclusively first.**
`migrations/020_document_review.sql:257-258`.
- Scenario (`#inference`, PostgreSQL row-lock conflict table): two approvers decide the same latest revision concurrently and the service does not pre-lock. T1: guard takes `FOR SHARE` on the `document_records` row, inserts the decision. T2: guard takes `FOR SHARE` (compatible), insert blocks on T1's uncommitted entry in `review_decisions_document_revision_id_key`. T1: `UPDATE document_records SET approved_revision_id=…` (or a version bump) needs `FOR NO KEY UPDATE`, which conflicts with T2's share lock → T1 waits on T2, T2 waits on T1 → `40P01 deadlock detected` after `deadlock_timeout`, instead of a clean `23505`/stale-version refusal. Without the guard's `FOR SHARE` this sequence ends with T2 getting a clean `23505`.
- Why it matters: S38 already says `decide` reads authority "after having locked the `document_records` row" — if Task 5 does that with `FOR UPDATE` (as `src/server/documents.ts:161` does for `proposeRevision`) the guard's `FOR SHARE` is a harmless re-lock inside the same transaction and the hazard disappears. If Task 5 locks with `FOR SHARE`, or moves the pointer in a separate statement without a prior exclusive lock, the deadlock is reachable and would surface as a 500. The DB currently makes correctness depend on an unwritten lock-mode choice of the service.
- Smallest fix (pick one): (a) change the guard to `FOR NO KEY UPDATE` (runtime already holds `UPDATE(latest_revision_id,version,updated_at)` from `014:142`, so the lock is permitted, and RLS `scope_update` USING passes); it serialises deciders and makes the upgrade impossible regardless of the service; or (b) keep `FOR SHARE` and write into the Task 5 brief: "`decide` takes `SELECT … FROM document_records WHERE id=$1 FOR UPDATE` before any read or insert", plus a native concurrency case (`describe.skipIf(!native)`, `waitForBlocked`) for two concurrent approvals of one revision. (a) is the more robust choice.

#### Minor

**M1 — The approved pointer can be moved backwards, or to a non-latest approved revision, by any runtime transaction in scope.** `020:297-304`. State: revision 2 approved and canonical, revision 1 also has an `approved` decision. As `libetech_runtime` with any `app.person_id` (or none — the guard binds nobody): `UPDATE document_records SET approved_revision_id=<rev 1>` → accepted. Plan-mandated (S7 only asks "an approval decision on a frozen revision exists"). Note for Task 5: move the pointer only in the same transaction as the approval decision, never through a separate command. Optional hardening: also require `NOT EXISTS` an approved decision on a higher `revision_no` of the same document.

**M2 — `review_comments` replies are not tied to the parent's document and revision at the DB.** `020:44`. A runtime insert with `parent_id` of a comment on document A and `document_id` = B (same project) is accepted. Plan-mandated (S50: service enforces). Cheap now, painful later: `UNIQUE(id, document_id, document_revision_id)` plus `FOREIGN KEY(parent_id, document_id, document_revision_id) REFERENCES review_comments(id, document_id, document_revision_id)` would enforce S50 exactly (parent kind `comment` stays a service rule).

**M3 — Commenting authority and "revocation effective at the next command" are service-only for comments.** No guard on `review_comments` checks that `actor_id` holds a live delegation (or another commenting right). Plan-mandated (S7 does not list it); stated so the Chairman knows the DB enforces OQ-34 "effective at once" for decisions only.

**M4 — `document_dependencies` flag columns are loosely coupled.** `020:78-81`, `:334`. `flagged_at` is not paired with `flagged_revision_id` (a flagged row can have `flagged_at IS NULL`, an unflagged row a stale `flagged_at`); runtime can set `version` to any positive value (no monotonic stamp, unlike the revoke guard); and once re-review is cleared (out of this slice, S10) `upstream_revision_id` cannot be advanced (no grant), so the row will keep pointing at the first confirmed revision. Suggested: `CHECK((flagged_at IS NULL) = (flagged_revision_id IS NULL))` now; decide the re-confirm shape (grant on `upstream_revision_id` or a new row) before the slice that clears flags.

**M5 — Unbounded free fields.** `review_events.kind` has no length/CHECK, `review_events.payload` and `review_decisions.exceptions` have no size bound (`020:56`, `:94-95`). Names or comment text could be copied into `payload` without limit. Suggested: `CHECK(length(kind) BETWEEN 1 AND 64)` and `CHECK(pg_column_size(payload) <= 8192)` (similar for `exceptions`).

**M6 — Test gaps (DB evidence).**
- `confirmed_by` person binding has no case (neither wrong person nor missing `app.person_id`); `tests/review-schema.test.ts:156` uses a self-dependency (`upstream = dependent`) with `.toBeTruthy()`, so it would pass on the CHECK even without the policy clause.
- `:129` (cross-project decision) and `:130` (cross-project delegation) accept any error; they are actually refused by the guards (document not visible / `LTR02`), not by the policy. Assert the message/code.
- Cross-tenant write is tested on `review_events` only; no write-with-no-context-at-all case (tenant and projects unset) for the insert policies.
- No native concurrency case for the decision guard's row lock (proposal vs decision, decision vs decision) — the lock is untested on both engines; PGlite has one connection and cannot exercise it. Everything else asserted on PGlite (roles via `SET LOCAL ROLE`, RLS, column privileges, custom SQLSTATEs) is enforced by PGlite as by PostgreSQL; the superuser/non-superuser login split is covered by the native case of Task 4a (S43).

**M7 — The brief's case `each authority branch raises its own SQLSTATE and no integrity branch does` does not exist by name.** The assertions are present but spread over other cases, and "every CHECK, RLS and column-privilege violation carries no LTR code" is never asserted explicitly. Either add the named case (one table of branch → expected code) or record the mapping in the task receipt.

**M8 — Self-revocation by a delegate who is also a manager is allowed at the DB.** `020:236-240`. Plan-mandated by S62 (pending confirmation by the slice-3 session); the Global Constraint "the delegate has no right to step down alone … enforced at service and DB" holds only under S62's reading. If the ruling changes, the fix is one line: `IF NEW.revoked_by = OLD.delegate_id THEN RAISE … USING ERRCODE='LTR03'` in the non-superuser block.

**M9 — Plan-mandated consequence of S3, for awareness.** A commenter-delegate's `changes_requested` takes the revision's only decision slot, so a commenter can, by deciding first, prevent the approver from approving that revision. That is S3 ("to decide again, a new revision is needed"); listed so Task 5 shows it in the queue and the Chairman sees the trade-off.

### The implementer's four deviations

- **(a) Authority branch also checks `delegate_id = decided_by` and tenant/project of the delegation** — **Accept.** It makes "someone else's / another project's delegation" an authority refusal (`LTR01`, mapped to `APPROVER_NOT_AUTHORIZED` by S38) instead of a later FK error `23503` raised after the trigger; the composite FK stays as the second line. Correct and consistent with S74.
- **(b) `FOR SHARE` on the document row** — **Accept with a condition.** It closes a real freshness race in READ COMMITTED (the FK's `KEY SHARE` does not conflict with a revision proposal's `NO KEY UPDATE`; with the share lock a proposal waits, or the guard waits and re-reads the updated row and fails the freshness check). The runtime role has the UPDATE privilege a row lock needs (`014:142`) and the `scope_update` USING passes. It does not deadlock against `proposeRevision` (which locks `FOR UPDATE` first). It does create the lock-upgrade hazard of I2: switch to `FOR NO KEY UPDATE`, or pin "lock `FOR UPDATE` first" in the Task 5 brief. Side note: the guard now depends on runtime keeping some UPDATE privilege on `document_records`; if a later migration removed it, every decision would fail with `42501` (fail-closed, but not `LTR01`).
- **(c) Extra index `idx_document_dependencies_upstream_fk`** — **Accept; it is required, not optional.** The FK `(upstream_document_id,tenant_id,project_id)` is not led by any other index (the pair UNIQUE leads with `tenant_id`), and the repo rule asks for an index on every FK.
- **(d) Named CHECK constraints** — **Accept.** Stable names for tests and for the service's error mapping; no behavioural change. Unnamed CHECKs that remain (kind, anchor, body, result, …) are fine.

### Checked and found correct

- No context → no row for every table and verb: every policy compares to `nullif(current_setting(...,true),'')`; NULL never matches; `ANY` of an empty array is false.
- Another project/tenant: SELECT invisible; INSERT refused (policy, or guard lookups that see nothing); UPDATE 0 rows (USING); no UPDATE grant on `tenant_id`/`project_id`/`id` of any table, so a row cannot be moved by UPDATE.
- Another person's id in the acting column: refused by `WITH CHECK` on all five inserts and on the revoke update.
- `UPDATE(approved_revision_id) ON document_records`: the only other UPDATE path is 014's `scope_update` (scope only); INSERT path still forces NULL (`014:111` plus no INSERT grant on the column); no other trigger on `document_records` can rewrite the column before the guard; `UPDATE OF` also fires for `INSERT … ON CONFLICT DO UPDATE SET approved_revision_id`; the FK to revisions has no cascading action and revisions cannot be deleted.
- Superuser bypass exactly where the brief allows: designation guard (S34), revoke manager check only (S61), pointer guard (S7); the decision guard has none (the operator is refused for the author rule too, test `:325-339`).
- `current_user` is the runtime role inside `scoped()` (`SET LOCAL ROLE`); the SECURITY DEFINER helpers it calls are owned by `libetech_identity` (not a superuser) and perform no writes that would re-enter these triggers.
- Revocation: only live → revoked; undo/repeat 0 rows for runtime and refused for the operator; re-designation after revoke allowed by the partial unique index; decisions keep their FK to the never-deleted delegation row; revoke takes `NO KEY UPDATE` (the partial index is not a key), so it does not conflict with the decisions' FK `KEY SHARE`.
- Decision CHECKs: a delegation decision can never be `approved`; an approval needs a hash; MATCH SIMPLE leaves approval-grant rows (NULL `delegation_id`) outside the delegation FK.
- New revision N+1 after a decision on N: further decisions on N are refused (not latest); the pointer may still be set to N if N was approved (see M1).
- Types and indexes: no SERIAL, no `timestamp` without zone, no bytes column (test `:502-508`); every FK and `created_at` indexed; actor columns without FK to `identity.users` follow the 014 precedent (`registered_by`).
- Idempotency: tables/indexes `IF NOT EXISTS`, policies and triggers `DROP IF EXISTS` + `CREATE`, functions `CREATE OR REPLACE`, GRANTs repeatable; the rollback is repeatable after the tables are gone (`to_regclass` + dynamic count; `DROP TRIGGER IF EXISTS … ON <missing table>` only notices).
- Rollback: `row_security = off` makes a non-bypass caller fail loudly rather than count zero; order check before the data check.

### Deployment notes for 020

- Prerequisites: `019` recorded; roles `libetech_runtime`, `libetech_identity` exist; `public.bom_eligible_members(uuid,uuid[],boolean)`, `public.document_approvers(uuid)`, `reject_history_mutation()` present; runtime login is neither superuser nor BYPASSRLS (`db.ts` checks this at start-up).
- Locks: one transaction with `lock_timeout = 5s`. Creating the FKs takes `SHARE ROW EXCLUSIVE` on `projects`, `document_records` and `document_revisions`; `CREATE TRIGGER … ON document_records` takes `SHARE ROW EXCLUSIVE`. Writes to those three tables block for the (short) duration; on timeout the whole file rolls back and can be retried. New tables are empty, so no rewrite or index build on existing data.
- The operational login must be a superuser for the slice-1 direct pointer path and for the fixtures (S7, S34, S43). If the isolated server's operator is a non-superuser owner, the pointer guard and the designation guard apply to it.
- Services must set `app.person_id` themselves in every writing transaction (`scoped()` does not); without it every insert and every revoke fails with an RLS error.
- Rollback preconditions: nothing above 020 recorded (order 021 → 020 → 019); no `approved` decision. The rollback then destroys all delegations, comments, `changes_requested` decisions, dependencies and review events irrecoverably and removes the runtime's right to move the pointer: export first, Chairman approval required (AGENTS.md).

### Assessment

The schema follows the brief closely, the revoke design is well closed, and the tests are real database evidence on both engines. Two items should be settled before Task 5 is written: I1 (re-check the delegate's eligibility in the delegation branch, one `EXISTS`) and I2 (remove the lock-upgrade hazard, by `FOR NO KEY UPDATE` in the guard or by fixing "lock `FOR UPDATE` first" in the Task 5 brief). The Minor items are optional or plan-mandated.

**Database verdict for Task 4b:** Needs fixes (I1; I2 either in the guard or as a binding line in the Task 5 brief).
