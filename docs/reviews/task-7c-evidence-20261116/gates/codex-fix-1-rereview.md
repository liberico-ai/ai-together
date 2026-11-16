Verdict: CHANGES NEEDED

# Codex fix round 1 re-review (acbd11c..986285f, gate base 460653e)

Advisory, read-only. Inputs: the fix brief and the builder's report (`.superpowers/sdd/task-7c-coordinator-proposal/codex-fix-1-*.md`), the review package of acbd11c..986285f, the code at HEAD, `git show 460653e:<file>` for base lines, and the evidence logs `codex-fix1-*.txt`. No test run. Tags: #fact = read in the repo or a log; #inference = reasoning from PostgreSQL behaviour, not from repo code.

P1 is fully addressed. The one open item is a gap in the P2 class (N1, P2): a coordinator demoted to `viewer` still sees the form after «Tải lại», which the spec sentences added in this round say cannot happen. The fix is small and touches the lines this round already touched.

## Finding verdicts

| Finding | Verdict | Evidence |
|---|---|---|
| Codex P1, `src/server/doc-approval-proposals.ts:236` (stale `now()` on withdraw), and its class | ADDRESSED | See C1 below. |
| Codex P2, `src/components/review.tsx:298` (form keeps the page standing after a reload) | PARTIALLY | The cited scenario is closed: a demotion to `engineer`, `technical` or `business`, where the reread returns `canDesignate=false`. A demotion to `viewer` is not closed, because the reread answers `SCOPE_DENIED` and the standing is never refreshed (N1). |

### C1 (P1), detail

- #fact No `now()` is left in any SQL this PR added under `src/`. `git diff 460653e..HEAD -- src | grep '^+.*now()'` returns only three comment lines: `doc-approval-proposals.ts:130`, `:239` and `accounts.ts:345`.
- #fact `src/server/doc-approval-proposals.ts` does not exist at 460653e, so every statement in it is in scope. All of them now use `clock_timestamp()`:
  - P13 `:133`;
  - P14 `:147-148`, both branches and the bound, one clock;
  - P15 `:153-154`, the stamp and the deadline, one clock;
  - `listOwn` `:192`;
  - R5: the lock statement `:238` no longer carries the clock, and the deadline is read in its own statement at `:242` and checked at `:243`, fail-closed when the row is missing or the value is NULL;
  - the R6 stamp `:253`.
- #fact `src/server/accounts.ts`:
  - the open read of the admin list `:93`;
  - cancel: the lock statement `:339-341` without the clock, then the deadline in its own statement `:348`, the check at `:349`, and the stamp `:350`.
  - The cancel check order is unchanged: NOT_FOUND `:342`, then NOT_ALLOWED `:343-344`, then CLOSED `:349`.
- #fact No lock was added, removed or reordered. The only changed line with a lock clause is R5 `:238`, which keeps `FOR UPDATE` and loses a target-list column. The two new statements are plain `SELECT`s.
- #fact Frozen material is intact:
  - the `proposeAccessChange` body md5, recomputed, is `742c7e2a4d1813cfc7ad41c895b0e4d4` at 460653e, at acbd11c and at HEAD (25 lines);
  - the `src/server/account-approval.ts` md5 is `3f7e9d08eefdc29e6b24173b65c3d35d`, identical to base;
  - `migrations/`, `bot-plugin/`, `AGENTS.md`, `CLAUDE.md` and `src/server/db.ts` are not in `git diff 460653e..HEAD`.
- #fact Tests:
  - 7 cases in `tests/doc-approval-statement-clock.test.ts`, on both engines;
  - 4 native-only cases in `tests/doc-approval-withdraw-concurrency.test.ts:290-361`.
  - Red: `codex-fix1-red.txt` shows 18 `^AssertionError` lines for C1 before the fix, plus 2 for the throwaway same-statement variant. No timeouts.
  - Green: `codex-fix1-native.txt` has 1165 passed, 0 skipped, 0 failed. The only `40P01` hit is the header sentence that reports zero. All 12 new cases are marked passed. `codex-fix1-pglite.txt` has 1103 passed and 62 skipped.
- #fact Existing tests:
  - No assertion changed. The only removed test line is the hook pattern `WITHDRAW_UPDATE` (`tests/doc-approval-withdraw-concurrency.test.ts:20`). It is used only as a `beforeStatement` trigger (`:85`, `:114`, `:229`, `:248`), never inside an `expect`.
  - The change is required by the new SQL text, and a hook that did not fire would fail `ran()`'s "the hook ran" assertion.
  - No other test pattern matches the old SQL text (`grep` for `now\(\)` and `overdue` patterns in `tests/`).
- #fact Base occurrences that the report leaves alone, checked with `git show 460653e:<file>`:
  - `accounts.ts:245` (base `:209`), `:265` (`:215`), `:313-315` (`:263-265`), `:139` (`:105`), `:154-155` (`:120-121`) and `:186` (`:152`);
  - `account-approval.ts:98`, `:149`, `:183`, `:197`, `:203` and `:206`, a byte-identical file;
  - `migrations/009_telegram_account_approval.sql:19`.
  - All of these exist at base with the cited text.
  - One entry does not: `tests/doc-approval-fixtures.ts:73` is called "an existing helper", but the file was created on this branch (914a4b8). See N3.
- #fact The list of `now()` uses on `identity.account_approvals` at base is complete. The remaining base `now()` uses in `accounts.ts` are stamps on `registration_requests`, `sessions`, `invitations`, `telegram_codes`, `github_links` and `users`, so they are not the ballot pattern.

### The PostgreSQL claim behind the separate deadline statement

I agree with the claim, and I agree that the replacement closes the window in both paths.

- #inference This is PostgreSQL executor behaviour. In a `SELECT ... FOR UPDATE`, the LockRows node does not project. It locks the rows of a slot that its subplan has already projected, so the target list, `clock_timestamp()` included, is computed before the lock attempt.
  - If the lock has to wait and the holder commits leaving only a lock (no update or delete of the row), the lock succeeds without following an update chain (`traversed` stays false). No EvalPlanQual recheck runs, and the pre-wait slot is returned.
  - EvalPlanQual runs only when the row was updated. The re-run subplan then recomputes the target list, so a volatile clock would be fresh in that case only.
  - So a same-statement `clock_timestamp()` is stale exactly when the holder leaves the row unchanged.
- #fact That case happens in production. A vote replay with the same choice, a vote refused as `APPROVAL_CLOSED` or `APPROVER_REQUIRED`, and a vote that leaves the tally `pending` all hold the ballot row `FOR UPDATE` without changing it (`src/server/account-approval.ts:164-206`, lock at `:172`).
- #fact The repo shows it on the real engine. The throwaway same-statement variant left cases 9 and 10 red with `expected 'ok' to be 'APPROVAL_CLOSED'` (`codex-fix1-red.txt`, statement-split section).
- #fact In withdraw, the replacement read (`:242`) runs after every lock of the command: R3 admin `FOR KEY SHARE`, then caller `FOR SHARE`, then R5 ballot `FOR UPDATE`. In cancel, the read (`accounts.ts:348`) runs after operator `FOR UPDATE`, then account `FOR UPDATE`, then ballot `FOR UPDATE`. In both, the read takes no lock and so cannot wait itself. `expires_at` is never updated after the insert.
- #fact The statements between the deadline read and the commit do not wait:
  - the plain version read;
  - an `UPDATE` of a row this transaction already holds;
  - an `identity.events` insert, a table with no foreign key (`migrations/002_identity.sql:51-54`).
  - The decision moment is therefore the deadline read, with no lock wait after it.

### P15 residual (`src/server/doc-approval-proposals.ts:151-155`)

- #inference The claim is correct. For an `UPDATE`, the SET and WHERE are computed by the subplan before the row update. A wait on a row whose holder leaves it unchanged ends with no recheck, so that row is judged and stamped as of the moment before the wait.
- #fact The judgement cannot flip from "past" to "not past". The `UPDATE` waits only on rows that already passed its WHERE, `expires_at` and `subject_account_version` are immutable, and time only moves forward.
- #fact At most one row can match: `account_approval_active_access_change` is unique per subject over `pending`/`approved` (`migrations/018_access_change_approval.sql:32-33`).
- #fact The early stamp matters only for a version-dead ballot whose deadline has not passed and whose proposer is someone else:
  - A ballot already past its deadline gets a stamp later than `expires_at`, so the P14 `LEAST(...)` picks `expires_at` and the stamp is ignored.
  - A version-dead ballot of the same pair that has not passed its deadline is refused at P14 before P15 runs.
  - A version-dead ballot of the same pair that is past its deadline: P14 lets it through only once the deadline is more than 24 hours old, and then `LEAST` again picks `expires_at`.
- #inference The holders that can leave that row unchanged are short refused commands, for example another proposer's withdrawal refused as dead at R5, or a refused vote. A vote that sees the version change closes the row itself, so the `UPDATE` rechecks and skips it. The early stamp is bounded by such a holder's tail, milliseconds.
- The bounded-effect claim therefore holds, and the residual is acceptable as recorded. One correction is in N2.

## New findings (lines this round touched)

**N1 (P2): a coordinator demoted to `viewer` keeps the form after «Tải lại»; the new spec sentences say the opposite.**

- `src/components/review.tsx:314-318`: `reloadDelegations` refreshes the standing only after a successful read.
- The reviewers-panel read refuses every role outside `READ_ROLES` (`src/server/review-delegations.ts:106`; `READ_ROLES` is `manager`, `engineer`, `technical`, `business` at `src/server/document-review.ts:23`), so for a `viewer` it throws `SCOPE_DENIED`.
- `reloadProposals` catches that, sets `delegationsError` and still reads the own list (`src/components/doc-approval-view.ts:70-75`). `listOwn` serves a viewer (OQ-50 c, `src/server/doc-approval-proposals.ts:186`).
- Result: the block stays `empty`/`ready` with the form, plus «Không tìm thấy tài liệu trong phạm vi được cấp.» and «Tải lại». «Trình phiếu» answers `MANAGER_REQUIRED` again, and the loop repeats.
- This contradicts the sentences added this round, `docs/UI-HANDOFF-3-doc-approval.md:162` («sau `MANAGER_REQUIRED`, «Tải lại» đưa khối về `former` hoặc `denied`, không còn biểu mẫu») and `:163`. It also contradicts the edge case at `:174` (a member who lost `manager` and still has ballots is `former`).
- Severity P2 by the gate's own grading of Codex P2: same symptom, same reachability.
  - Reachability: the only in-app writer of memberships is the `access` command (`src/server/accounts.ts:197-199`). It revokes every session of the subject (`:270-272`), and sessions are checked per request (`src/server/identity.ts:149`). So both Codex P2 and N1 need a role change made outside the app.
  - Impact is UI-only: the server refuses every proposal (`doc-approval-proposals.ts:84-97`).
- Fix sketch: when the reread fails with `SCOPE_DENIED`, apply `standingAfterReread(p, false)` before rethrowing, so the block shows `former` or `denied` and keeps the error line. Write the red case first in `tests/doc-approval-ui.test.tsx`, with a pure helper plus a source pin like P20. The alternative, a spec-only qualification, would leave `:174` false.

**N2 (P3): the report says the P15 residual "would need a lock change". That is overstated.**

- A second statement, `UPDATE identity.account_approvals SET updated_at=clock_timestamp() WHERE id=ANY($1)` over the `RETURNING` ids, would re-stamp after any wait.
- Those rows are already updated by this transaction, so the statement cannot wait and does not change the T7C-5 order.
- This is optional. Keeping the residual is defensible, but the receipt should not say that a lock change is the only remedy.

**N3 (P3): the report calls `tests/doc-approval-fixtures.ts:73` (`applyFrozen`, `expires_at>now()`) "an existing helper". It was created on this branch (914a4b8), not at base.**

- It is harmless: a single autocommit operator read with no lock wait.
- Drop it from the list of base occurrences in the receipt.

Checked with no finding:
- `src/components/doc-approval-view.ts:46-52` and `review.tsx:292-300`. `useState(pageProposals)` is declared before every hook that reads it, and `ReviewQueue` is keyed by `projectId` (`src/app/review/page.tsx:46`), so a stale prop on a project switch cannot happen.
- `page.tsx:44` feeds `loadOwnProposals` with `coordinator: delegations.canDesignate` (`review-page.ts:36`), so replacing `canPropose` with a fresh `canDesignate` keeps the same meaning.
- A failed reread changes nothing.
- The volatile `clock_timestamp()` costs no index: there is no index on `expires_at` (`migrations/009...:28-29`, `018...:30-33`).
- The byte scan of all 13 changed files found 0 code points in U+202A-U+202E, U+2066-U+2069, U+200B-U+200F, U+2028, U+2029 or U+FEFF, and no local checkout or temp-directory path.

## Out of scope (untouched or frozen code; not blockers)

1. Base stamps that set a closing time P14 reads, using `now()` after a possible wait:
   - `src/server/account-approval.ts:183` and `:206` (vote expiry and tally; report concern 3);
   - `src/server/accounts.ts:313-315`, the admin's `proposeAccessChange` expire-and-mark. It also closes coordinator ballots that are version-dead and not yet past, so that pair's 24-hour wait can end early by the admin transaction's lock waits.
   - The first is byte-frozen and the second is md5-pinned.
2. `migrations/009_telegram_account_approval.sql:19`: `expires_at` defaults to `now()+interval '48 hours'`, so a proposal that waited on locks gets a deadline counted from its transaction start.
   - This could be fixed without a migration by naming `expires_at` in the P16 insert (`doc-approval-proposals.ts:160-163`).
   - The admin path uses the same default. Choose one rule for both, and do it in a later round.
3. `src/server/accounts.ts:245`: the apply path's approved-ballot read uses `expires_at>now()`. `approvalReady` rechecks after its lock (`account-approval.ts:98`), but with the app clock (`Date.now()`). So one deadline is judged on two clocks.
4. The native logs carry a pg `DeprecationWarning` («client.query() when the client is already executing a query»), also present in `task-5-native.txt` and `final-fix-wave-native.txt`. It predates this round.
5. The timing cases (`MARGIN_MS`=1500) assert their own precondition, so under heavy load they fail loudly instead of passing vacuously, as report concern 5 says. Watch for false red on a busy machine.
