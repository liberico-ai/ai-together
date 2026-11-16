# Tier-1 database review: Task 7c, whole branch `460653e..53b3277`

Verdict: READY WITH FIXES

- Reviewer role: database reviewer, advisory only. The Chairman approves merges.
- Scope: the whole branch, 22 commits, no migration. The new and changed SQL is in `src/server/doc-approval-proposals.ts`, `src/server/accounts.ts`, `src/server/identity.ts` and `src/server/doc-approval-http.ts`. The unchanged paths it shares rows with are in `src/server/account-approval.ts` and `src/server/identity.ts`.
- Requirements read: plan v0.4 `docs/plans/task-7c-coordinator-proposal.md` (lock order at `:197-203`; T7C-5 at `:264`; T7C-19 at `:278`; T7C-24 at `:283`; the known-limits list at `:997-1008`). Migrations read: `002_identity.sql`, `004_team_accounts.sql`, `009_telegram_account_approval.sql`, `017_outbox.sql`, `018_access_change_approval.sql`, `019`.
- Method:
  - I read the code and migrations. Line numbers are at `53b3277`.
  - I ran read-only `EXPLAIN` (no `ANALYZE`) on the native test container. Each statement ran inside `BEGIN READ ONLY ... ROLLBACK`, as `libetech_identity`, with a synthetic tenant set by `set_config(..., true)`. I checked first that no other backend was active. I did not stop the container.
  - I did not re-run the suite. Test evidence is `docs/reviews/task-7c-evidence-20261116/task-5-*.txt`.
  - The only file I wrote in the checkout is this one.
- Counts:
  - Critical (P0): 0.
  - Important (P1): 0.
  - Minor: 2 P2 and 8 P3.
  - Deployment notes: 1 check, no blocker.
- Tags: `#fact` means read in code, in a migration or in tool output. `#inference` means reasoned from those. All plans were taken on near-empty tables, so what they say about production is `#inference`.

---

## 1. Lock graph

Notation:
- `A` is the account-admin row in `identity.users`.
- `P` is the proposer (coordinator) row, and `S` is the subject row.
- `B` is the ballot row in `identity.account_approvals`.
- Lock modes: `KS` = FOR KEY SHARE, `SH` = FOR SHARE, `NKU` = FOR NO KEY UPDATE, `U` = FOR UPDATE.
- A foreign-key check on insert takes `KS` on the referenced row. `KS` conflicts only with `U`.

| Transaction | Lock sequence, in order | Source |
|---|---|---|
| `propose` (new) | Throttle upsert in its own transaction, committed before the scope opens (`doc-approval-proposals.ts:79`, `identity.ts:30-37`) · `A` KS (`:88`) · `{P,S}` NKU in one statement, `ORDER BY id` (`:90-91`) · P15 NKU on dead ballots of `S` (`:151-153`) · insert `B` (`:158-161`) · voters insert: KS on `A` and the BoM rows (`:166-167`) · outbox insert: KS on the recipient rows (`:168`, FK to `identity.users` in `017_outbox.sql`) · event insert, no FK (`002_identity.sql:51-54`) | #fact |
| `withdraw` (new) | Throttle in its own transaction (`:218`) · R2 plain read of `B` (`:222-224`) · `A` KS (`:230`) · `P` SH (`:231`) · `B` U (`:235-237`) · plain read of `S` version (`:240`) · update `B` (`:246`) · event insert (`:247-248`) | #fact |
| `cancel_access_change` (new admin command) | `A` U (`accounts.ts:61`, `operator`) · `S` U (`:226`) · `B` U (`:338-340`) · update `B` (`:345`) · audit event (`:346`) | #fact |
| `access` apply (changed) | `A` U · `S` U · `B` U, approved ballots only (`account-approval.ts:95-105` `approvalReady`) · memberships, sessions, codes and `users` writes on `S` | #fact |
| `proposeAccessChange` (admin path) | `A` U · `S` U · dead ballots · inserts (`accounts.ts:307-331`) | #fact |
| `list` (admin) | `A` U · plain reads only, including `openAccessChange` for each account (`accounts.ts:70-84`, `:89-105`) | #fact |
| Registration decision (unchanged) | `A` U · registration request U · update the registration ballots (`accounts.ts:134-141`) | #fact |
| Vote, web or bot bridge (unchanged) | `B` U (`account-approval.ts:171-172`) · plain read of `S` version (`:180-181`) · vote insert, which takes KS on the voter row through the FK `(voter_id,tenant_id)` (`:199`; FK at `009_telegram_account_approval.sql:45`) · outbox update of the voter's own DM (`:203`) · update `B` (`:206`) | #fact |
| Login, pairing code, unlink, pair, activate (unchanged) | One own `users` row U (`identity.ts:76`, `:183`, `:210`, `:197-198`); `activate` locks `FOR UPDATE OF i,u` on the invitation and its user (`:105`) | #fact |

**Invariant.** Every transaction that locks two or more `users` rows takes `A` first. Admin commands take it `U` and coordinator writes take it `KS`, so the two kinds are serialized at `A`. After `A`, other `users` rows are locked in id order, then ballots. #fact (all call sites above)

**Pairs checked with no cycle** (#inference from the table):
- `propose` against `propose`, co-managers included. `{P,S}` are locked in id order in one statement, so the two cannot interleave.
- `propose` against `withdraw`. Both take `A` KS, which is compatible. Then `NKU`/`SH` on user rows, then `B`. The orders are compatible.
- `propose` against a vote. P15 takes `NKU` on a ballot and the vote takes `KS` on a user row. Neither waits for a row the other holds in a conflicting mode before its own next step.
- `withdraw` against a vote. The two meet only at `B` U. `withdraw` never needs a row the vote holds.
- `withdraw` against cancel or apply. They are serialized at `A`.
- `propose` against login or pairing, which lock a single own row. Login holds `U` on one row and needs nothing more. `propose` can wait on it, but login never waits on `propose`.
- `propose` at P16 against the unique index `account_approval_active_access_change`. The wait happens behind `S` NKU, which is already held, so it is serialized.

**Cycle found.** Cancel against a vote in the chairman seat. Details in P2-1 below.

---

## 2. Findings

### P2-1 · Cancel and a chairman-seat vote on the same live ballot can deadlock (40P01)

- **What.** The two transactions take the same two rows in opposite order:
  - Admin cancel: `A` U at `accounts.ts:61`, then `S` U at `:226`, then `B` U at `:338-340`.
  - Vote in the chairman seat: `B` U at `account-approval.ts:171-172`, then the vote insert at `:199`, which takes `KS` on the voter row through the FK. The chairman seat is always the admin (`account-approval.ts:21-27`), so that voter row is `A`. `KS` conflicts with the `U` that the cancel holds.
- **How it happens.** The vote holds `B` and reaches the insert while the cancel holds `A` and waits on `B`. That is a cycle. PostgreSQL aborts one side after `deadlock_timeout` (1 s on the container). `src` maps no `40P01`, so the aborted side gets a generic error. #fact (grep finds no `40P01`, `40001` or `55P03` in `src`)
- **Who can hit it.** One person: the admin, cancelling a coordinator's pending ballot on `/team` while voting on that same ballot in Telegram or on the approvals page. The window is the few statements between `:172` and `:199`. #inference: rare. Data stays consistent, because the surviving transaction commits whole and the aborted one rolls back whole.
- **What the plan says.** T7C-5 (f) (`plan :264`) calls this residual pre-existing from slice 2, says this PR does not change it, and says a native case catches it.
  - The class is pre-existing. Registration reject (`accounts.ts:138-139`) against a chairman vote on a registration ballot forms the same cycle.
  - The cancel instance is new. `cancel_access_change` arrives in this branch (`7ce0f56`; the base `460653e` has no `cancelAccessChange`). #fact
  - No native case races a chairman-seat vote against a live cancel. The only cancel-and-vote case (`tests/doc-approval-withdraw-concurrency.test.ts:194-206`) uses a BoM seat (`w.approvers[2]`) on a version-dead ballot, and its comment at `:198` says the cancel never waits on the ballot. #fact
  - The known-limits list (`plan :997-1008`) does not mention this residual. #fact
- **Fix (pick one).**
  1. Take the ballot in `cancelAccessChange` with `FOR UPDATE NOWAIT` (`accounts.ts:338-340`). Map `55P03` to a 409 such as "Phiếu đang được xử lý, thử lại." Add a native case that pauses a chairman-seat vote before `INSERT INTO identity.account_approval_votes` and runs the cancel, then expects 409 or ok, never `40P01`.
  2. At minimum, correct T7C-5 (f) so that it names the cancel instance as new. Add the residual to the known-limits list, and replace "ca native bắt được" with the actual coverage, which is none.

  Fix 1 does not cover registration reject. That instance stays as it was before this branch.

### P2-2 · The code relies on READ COMMITTED but never sets it

- **What.** `db.ts:44` opens every transaction with a plain `BEGIN`, so the isolation level is inherited from server, database or role settings. On the container it is `read committed` and nothing overrides it. #fact (`SHOW default_transaction_isolation`; `pg_db_role_setting` is empty for the database and has no setting for any `libetech*` role)
- **Why it matters.** The serialization point at `A` works only if the reads after the lock are fresh statement snapshots. Under REPEATABLE READ the snapshot is fixed by the first query of the transaction, which is the `set_config` at `identity.ts:23`, before any lock wait. Taking `KS` on `A` raises no serialization error afterwards, because `operator` only locks the admin row and never updates it. #inference from PostgreSQL semantics.
- **What would break under REPEATABLE READ:**
  - **`withdraw` R5 version check, the worst case.** `doc-approval-proposals.ts:240` would read the subject's version from before an admin command that committed while the withdrawal waited at `:230`. A ballot that the account change killed would be withdrawn. Its `access_change_withdrawn` event then exempts the pair from the 24-hour wait at P14 (`:143-145`). That bypasses N3 and T7C-30, and T7C-5 (i) assumes READ COMMITTED here (`plan :264`).
  - **`propose`.** P6, P7 and P8 (`:95-116`) would judge role, seats and grants on stale data. P13 (`:131-138`) could replay a ballot that a concurrent cancel already closed, answering `replayed:true` with state `pending`. A double-click would end in `23505` mapped to `APPROVAL_PENDING` (`:163`), not in a replay, because the second snapshot predates the first commit. P5 `NKU` on a subject row that changed after the snapshot would raise `40001`, an unmapped error.
  - **Admin `access`.** The `proposerIsCoordinator` read (`accounts.ts:259`) and `openAccessChange` in `list` (`:79`, `:89-105`) would give a stale T7C-11 echo.
  - **P15, `withdraw` R5 FOR UPDATE, `cancel` and the throttle upsert (`identity.ts:32-35`).** Under READ COMMITTED these re-check the row after the wait. Under REPEATABLE READ they raise `40001`, which `src` does not map.
- **Fix.** Pin the level in code:
  - Put `SET TRANSACTION ISOLATION LEVEL READ COMMITTED` as the first statement in `IdentityService.scope` (`identity.ts:21`), or use `BEGIN ISOLATION LEVEL READ COMMITTED` at `db.ts:44`.
  - Add one test that asserts `current_setting('transaction_isolation')='read committed'` inside `scope`.
  - The cost is one statement per transaction and no migration.

### P3 items (defense-in-depth or later work)

| # | File:line | Observation | Suggested fix |
|---|---|---|---|
| P3-1 | `doc-approval-proposals.ts:246`, `accounts.ts:345` | The closing `UPDATE ... SET state='expired' WHERE id=$1` has no state predicate. It is safe today because the same transaction holds `B` U and checked the state just before. #fact | Add `AND state IN ('pending','approved')` with a `RETURNING id` check, so that a later refactor cannot overwrite `issued` or `rejected`. |
| P3-2 | `accounts.ts:70-84` | `list` holds `A` U across up to 200 accounts. Each account makes sequential per-account reads (`openAccessChange` at `:79` and the grants), so up to about 800 round trips. While it runs, these all wait: coordinator `propose` and `withdraw`, chairman-seat vote inserts, ballot inserts that list the chairman as voter, and admin login. The waits are bounded by `statement_timeout` 10 s (`db.ts:32`) for each waiting statement, not for the whole list. #inference | Later: one set-based query (LATERAL join to the open ballot), or read the list without `operator`'s `U` after an authorization check that takes `KS`. |
| P3-3 | `doc-approval-proposals.ts:141-148` | P14 probes `identity.events` through `identity_events_user (user_id, tenant_id)` and filters `kind`, `actor_id` and `detail->>'approvalId'` row by row (plan below). The cost grows with all events of the subject, `session_started` included. #inference | No action now. If it grows, add a partial index on `(user_id, (detail->>'approvalId')) WHERE kind='access_change_withdrawn'`. That needs migration 022. |
| P3-4 | `doc-approval-proposals.ts:185-193` | `listOwn` has no index on `proposer_id`. The plan drives from `users` and probes approvals by subject. It is bounded by the number of open ballots. #inference | None now. Watch it if open ballots grow. |
| P3-5 | `doc-approval-proposals.ts:90-91`, `:131-153`, `:222-241`, `accounts.ts:338-340` | Most new statements have no explicit `tenant_id` predicate. Tenant scope comes from RLS (ENABLE and FORCE, fail-closed `nullif(current_setting('app.tenant_id',true),'')::uuid`), composite FKs `(id, tenant_id)`, and global UUID primary keys. Every plan shows the RLS tenant filter. #fact. The plan mandates this design and ledger 1a Minor 7 accepted it. | Accept. Optional: add `AND tenant_id=$n` on the locking reads for belt-and-braces. |
| P3-6 | `tests/` | No SQL-layer case puts a foreign-tenant ballot row in front of `withdraw`, `cancel`, P14, P15 or `openAccessChange` (Quality Gate 34c). The cross-tenant tests that exist work at principal level (see section 4). | Optional native case: insert a ballot for tenant B with the same subject UUID shape, then run the four statements as tenant A and expect 0 rows. |
| P3-7 | `tests/doc-approval-proposal.test.ts:385-418`, `tests/doc-approval-withdraw.test.ts:424-435` | The pair-wait boundary is tested at 1 h, 23 h and 25 h, not at the edge. The SQL is correct at exactly 24 h (section 3). #fact | Optional: one case at 24 h minus 1 min and one at 24 h plus 1 min, using the same clock fixture. |
| P3-8 | `doc-approval-proposals.ts:247-248`, `accounts.ts:346` | The withdraw and cancel event details carry no `request_id` or `trace_id`; `propose` carries `traceId` (`:170`). E-DB-13 asks for both on multi-tenant audit rows. The gap is repo-wide and pre-existing. #fact | Cheap later fix: add `traceId` to both details. |

---

## 3. State transitions and the pair wait

**Every transition to `expired` checks the row under a lock.** #fact
- P15 (`:151-153`) is a conditional `UPDATE` on `state IN ('pending','approved')` plus a deadline or version condition. Under READ COMMITTED, a row that a concurrent vote or apply changed is re-checked after the wait (EPQ). A ballot that has become `issued` or `rejected` no longer matches and is left alone.
- `withdraw` and `cancel` take `B` U, then check state, deadline and frozen version, then update (see P3-1).
- The vote's version-dead close (`account-approval.ts:183`) runs under its own `B` U.

**Against a concurrent vote, apply or close.**
- Vote against `withdraw` or `cancel`: whichever takes `B` U first wins, and the other re-reads the closed state and answers `APPROVAL_CLOSED`. The cases at `tests/doc-approval-withdraw-concurrency.test.ts` cover this in both orders.
- Apply against `withdraw`: they are serialized at `A`, and apply takes approved ballots only. `withdraw` refuses approved ballots (`:242-243`, OQ-51 b).

**Events are append-only.** #fact
- `002_identity.sql:92-93` has an immutability trigger.
- The role has only SELECT and INSERT on `identity.events` (`002:86-90`, `004:33-35`).
- New code only inserts events.

**The only account-version write is `accounts.ts:290`.** It sits inside `command`, after `operator`. #fact (grep)

**Pair wait, OQ-48 (b) and T7C-19, at `:141-148`.**

| Boundary | Behaviour | Tag |
|---|---|---|
| Exactly 24 h after the closing time C | `closing > now() - 24h` is strict, so the proposer is blocked during [C, C+24h) and allowed at C+24h. `now()` is the transaction start. | #fact |
| Expired but not yet marked closed | Falls into `ELSE LEAST(expires_at, now())`, so the deadline counts as the closing time. | #fact |
| Frozen at an older version and not marked | The ballot counts until it is closed. The wait can last up to `expires_at`+24h. Documented as R11 in the plan. | #fact |
| Self-withdrawal against admin cancel | Only an `access_change_withdrawn` event whose `actor_id` is the proposer exempts the pair. A cancel writes `access_change_cancelled`, so it does not exempt the pair. | #fact |
| Admin changed later | P14 does not depend on `adminId`. Ballots that a former admin proposed through the admin path still count for that person's pair, which fails closed. | #inference |
| `issued` | Excluded, so a successful grant never blocks. | #fact |

---

## 4. Tenant isolation at the SQL layer (Quality Gate 34a-e)

| Check | New statements | Evidence |
|---|---|---|
| 34a read | Every new SELECT runs under `SET LOCAL ROLE libetech_identity` and `set_config('app.tenant_id', ..., true)` (`identity.ts:20-26`). The RLS policy `tenant_scope` is ENABLE and FORCE (`002:66-74`; ballots, voters and votes at `009:55-64`), and every plan shows the RLS tenant predicate. Tests: `tests/doc-approval-proposal.test.ts:213-216` (foreign-tenant subject) and `tests/doc-approval-proposal-http.test.ts:127-130`. | #fact |
| 34b write | Inserts on ballots, voters and votes are checked by `WITH CHECK` (`009:55-64`); in `002` the FOR ALL `USING` doubles as the write check. Outbox inserts are checked by `identity_insert WITH CHECK` on tenant and `audience='dm'` (`017_outbox.sql:176-177`). `tenant_id` is always the service tenant and never comes from the request. | #fact |
| 34c delete or update across tenants | Updates to ballot state match by `id`. A foreign-tenant id is invisible under `USING`, so 0 rows. Withdraw and cancel find no row and answer 404. Tests: `tests/doc-approval-withdraw.test.ts:259-260` and `tests/doc-approval-apply.test.ts:222`, `:266-267`, at principal level. There is no SQL-layer foreign-row case (P3-6). | #fact / #inference |
| 34d no context | `nullif(current_setting('app.tenant_id', true), '')::uuid` gives NULL when unset, so every policy is false and access fails closed. | #fact |
| 34e bypass | `db.ts:20-30` refuses a login role that is superuser, `BYPASSRLS`, a table owner, or a member of several roles. The runtime switches to `libetech_identity` with `SET LOCAL ROLE`. | #fact |

---

## 5. Query cost (`EXPLAIN`, synthetic container)

Settings on the container: PostgreSQL 16.15; `default_transaction_isolation` = read committed; `deadlock_timeout` = 1 s; `lock_timeout` = 0; `idle_in_transaction_session_timeout` = 0; no database-level or `libetech*` role-level settings. Row estimates: `events` 8837; `account_approvals`, `users` and `memberships` 0. #fact

| Statement | Plan, with `enable_seqscan` on and off | Production reading |
|---|---|---|
| P5 `{P,S}` NKU (`:90-91`) | With seqscan on: LockRows over Sort(id) over Scan. With seqscan off: LockRows over an Index Scan on `users_pkey` with `id = ANY`, already ordered. Both lock in id order. | #fact: id order holds in both plans |
| P13 open ballot, P15 close, `openAccessChange`, cancel lock | Index Scan on `account_approvals_subject` | #inference: index-driven, small |
| P14 pair wait | Index Scan on `account_approvals_subject`, then a Nested Loop Anti Join to a Bitmap Index Scan on `identity_events_user`; filters on `kind` and `actor_id`; join filter on `detail->>'approvalId'` | #inference: grows with the subject's events (P3-3) |
| `listOwn` | Drives from `users` and probes approvals by subject; LIMIT 200 | #inference: production will likely use `account_approvals_pending`; bounded (P3-4) |
| `activeProjectRole` (`identity.ts:46-52`) | `memberships_project` with a user filter | #inference: small |
| `withdraw` R2 and R5 | `account_approvals_pkey` | #fact |
| Throttle upsert | Arbiter `throttle_tenant_id_bucket_key` | #fact |

No statement scans a growing table sequentially when its index is usable. #inference

---

## 6. Pool, transactions and throttle

- **Pool.** `pg.Pool`, `max` 10, `connectionTimeoutMillis` 5000, `statement_timeout` 10000 (`db.ts:32`). #fact
- **No open transaction across a non-database await.**
  - argon2 verify runs before the login transaction (`identity.ts:72`). #fact
  - Inside the new scopes, every await is a `tx.query` or pure computation. `notifyVoters` writes the outbox in the same transaction, so no send happens before commit (E-INT-06). #fact
- **Throttle.** It commits in its own scope before the main scope opens, so no single request ever holds two pool connections. #fact
  - The upsert `ON CONFLICT (tenant_id, bucket) DO UPDATE ... RETURNING attempts` is atomic. It uses a fixed window and goes through RLS. #fact
  - Refused attempts count, as intended, so P3 and the throttle at `:218` run before any lock. #fact
- **H1.** An unmapped `23505` becomes the generic error (`doc-approval-http.ts:33-34`), and the mapped one-open-ballot `23505` becomes `APPROVAL_PENDING` (`:163`). Fine. #fact

---

## 7. Gaps in the 16 native concurrency cases

The cases are in `tests/doc-approval-proposal-concurrency.test.ts` (9) and `tests/doc-approval-withdraw-concurrency.test.ts` (7). They do not cover:

1. A chairman-seat vote against a live cancel. This is P2-1, the one gap with a reachable `40P01`.
2. A chairman-seat vote against registration reject. This is pre-existing.
3. `list` holding `A` U while coordinator writes wait. This is latency only.
4. Admin login, pairing or unlink against `propose` or `withdraw` (single-row lockers). #inference: no cycle.
5. Two coordinators who both hold seats proposing at once (T7C-5 d). The `seatCoordinator` fixture exists but is not raced.
6. P15 against a vote on the same dead ballot (the EPQ re-check).
7. `withdraw` against another coordinator's P15 on the same dead ballot.
8. A lock wait that reaches `statement_timeout`.

All except item 1 are #inference no-cycle or latency-only.

---

## 8. Triage of the database-relevant deferred minors (ledger `.superpowers/sdd/task-7c-coordinator-proposal/progress.md`)

| Ledger item | Decision | Reason |
|---|---|---|
| 7 pg `DeprecationWarning` lines in `task-5-native.txt` | P3, defer | The source is the pre-existing `Promise.all` on one client at `accounts.ts:80`, the only `Promise.all` in `src/server`. pg is pinned exactly at `8.23.1` (`package.json:19`), so nothing changes until a pg@9 upgrade. There is one warning per worker process. Follow-up: a sequential loop before that upgrade. #fact |
| 1a Minor 7: no tenant predicate in P5 | Accept | RLS, composite FKs and global UUID primary keys cover it (P3-5). |
| 1a M2 and Minor 8: P11 internal `Error` on repeated codes | Accept | It fails closed and is never written. |
| 1b Minor 5 | Same as the DeprecationWarning row | |
| 1b N6: `errorType` is `'Error'` | Defer | Observability only. |
| Task 2: unreachable `state!=='pending'` guard, unused R2 columns | Accept | Harmless. |
| Task 2: no withdraw throttle | Closed | Fixed at `doc-approval-proposals.ts:218`. |
| Task 3: `list` per-account reads | Closed, see P3-2 | Now sequential; holding the admin row is a latency matter. |
| Task 3: a former admin's ballots go through the coordinator checks | Accept | Fails closed. |
| Task 3: event detail lacks `request_id`/`trace_id` | Defer (P3-8) | Pre-existing under E-DB-13. |
| Task 3: comment relying on READ COMMITTED | Comment done; see P2-2 | The level is still not pinned. |

---

## 9. Deployment notes

- There is no migration, DDL or grant change. The code relies on what is already deployed:
  - `009`: `UPDATE(state, updated_at)` on ballots for `libetech_identity`.
  - `002` and `004`: INSERT on `identity.events`.
  - `017`: the outbox insert policy.
- **Check before deploy, until P2-2 is fixed.** On the production identity database, confirm that `SHOW default_transaction_isolation` is `read committed`, and that `pg_db_role_setting` has no override for the database, the login role or `libetech_identity`.
- Waits are governed by `statement_timeout` 10 s (`db.ts:32`) and the server's `deadlock_timeout` (default 1 s).

## 10. Notes

- I found no P0 or P1 issue. The lock order T7C-5 holds for every new path I traced, except the cancel-and-vote pair in P2-1.
- Neither P2 needs a migration. Both are small changes: P2-1 is one `NOWAIT` with an error mapping and one native case, or a plan and known-limits correction. P2-2 is one statement in `scope` and one assertion test.
- I wrote two scripts outside the repository to run the plans: a read-only `EXPLAIN` script and its output file. Neither is copied here. I also did not copy the environment file, its path or any connection string.
