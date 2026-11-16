# Task 7c, Task 1a: code review (base 5bfeccb, head 6228649)

### Spec Compliance
- ✅ Spec compliant. No Missing, no Extra, no Misunderstood item that blocks the task. Details below.
  - **33 cases present** (1 in `describe('docApprovalDelta')`, 32 in `describe('propose')`), one `test` each, in brief order; each asserts the brief's list (checked case by case against `tests/doc-approval-proposal.test.ts` in the diff, lines 576-1104 of the diff file). Two titles differ from the brief's quoted names (Minor 1).
  - **P0-P17 order** matches `src/server/doc-approval-proposals.ts` (diff 251-352): parse, then bot/tenant, then ADMIN/SELF with no database, then `throttle`, then the two P3b checks, then the transaction with the unlocked role read, the admin row `FOR KEY SHARE`, the one `ORDER BY id FOR NO KEY UPDATE` statement, the re-check under the lock, P7 seats, P8 subject, P9, P10, P11 assertions, P12, P13 replay, P14 pair wait, P15 expire, P16 insert/voters/notify/event, P17 return. Lock order T7C-5 holds in the code.
  - **Error table**: every code, status and sentence in the service was compared to the brief's table character by character: SCOPE_DENIED, MANAGER_REQUIRED, SELF, ADMIN, INELIGIBLE, APPROVERS_NOT_READY, both VERSION_CONFLICT sentence used here, ACCESS_CHANGE_NOT_NEEDED, APPROVAL_PENDING, the pair-wait RATE_LIMITED. All match; files are NFC (checked).
  - **P14 SQL** equals the brief's (including the `LEAST(...)` and `e.actor_id=a.proposer_id` terms); **P16** maps 23505 to APPROVAL_PENDING only for the one-open-ballot index (code AND constraint, message fallback when `constraint` is empty) and rethrows everything else unwrapped (`isOneOpenBallot`, diff 237-240, 340-343).
  - **`listOwn`**: admin gets `[]` with no read; role-agnostic membership gate; SQL filter on the project before `ORDER BY created_at,id LIMIT 200`; `docApprovalDelta` as the second layer; returns the stored `state`; no lock. Matches the brief, except the order note in Minor 3.
  - **Step 5**: the five mutations (b)-(f) are credible against the case list (ca 6/7/8/28/30, ca 2/29, ca 18, ca 32, ca 33); (a) is correctly left to 1b. I did not re-run them (read-only; PGlite cases are cheap but each mutation edits the tree).
  - **Step 6**: the diff touches only the files the file map names plus the two evidence logs. `account-approval.ts`, `bot-plugin/`, `AGENTS.md`, `CLAUDE.md`, `migrations/`, `accessChangeTally`: absent from the diff. `accounts.ts` has exactly two changed lines, each adding `export ` (diff 140-141, 163-164). `vitest.config.ts` appends one path at the end of the array. `identity.ts` +1 method, `access-grants.ts` +1 function. No handler, route or HTTP/concurrency test. `proposals` never writes `identity.memberships`.
  - **Owner's hard limits**: the admin path (`proposeAccessChange`, `command`) is unchanged; the service uses only `identity.scope`, no request identity (zod `.strict()` on both commands; actor and tenant come from `p`).
- ⚠️ Cannot verify from the diff:
  - `git diff --stat 0560a4f -- ...` as reported: the diff base is 5bfeccb, so I confirmed the commit's own files only; commits between 0560a4f and 5bfeccb are outside this review.
  - Native-PostgreSQL behaviour of the hook cases (28's P5/P6 hooks, 31 a/b), the 205-row `generate_series` insert and all lock behaviour: the appended log (`task-1a-green.txt`, 101 passed, exit 0) is the only evidence, and it is session-supplied. Lock-order and deadlock claims belong to 1b.
  - That the one `pg` DeprecationWarning in the native log is not newly triggered by the new hook cases (it is said to be in the baseline; the PGlite run printed no warning). Nothing in the new code issues overlapping queries on one client (every call is awaited), so I see no new source.
  - Mutation outcomes (not re-run).

### Strengths
- The service is a faithful, readable transcription of the contract: each `P` step is commented, errors are factory functions, no `catch` swallows anything (the two `catch` blocks rethrow, diff 279-283, 340-343).
- Defence in depth where the brief asks for it: `docApprovalDelta` plus `widensAccess` plus `grantsSchema` asserted before write (P11); SQL project filter before the cap and again in code in `listOwn`; role, activity and activation read from the database, never from the session.
- Cases exercise real SQL (PGlite, native-capable), build real constraint conflicts for 31 (a)(b) through `beforeStatementInTx`, and say plainly what 31 (c) cannot do. No `sleep`, no mocks of the service.
- Ca 28 checks "no ballot, voter, DM, event" with `snapshot` for each branch and the counted/not-counted rule with `attempts`, with `resetThrottle` between branches so the cap does not hide a branch.
- Test output is pristine on PGlite (log shows no warning); the native log carries the single baseline DeprecationWarning line only. No new dependency, no migration.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
1. **Two case titles differ from the brief's quoted names.** Brief ca 17 "the proposer's role is read from the database, not from the session" vs `tests/doc-approval-proposal.test.ts` "the proposer role is read …" (diff 789); brief ca 18 "the subject's grants must fit …" vs "the subject grants must fit …" (diff 804). Later tasks and evidence tables refer to cases by name; a `-t` filter by the brief's name finds nothing. Restore the apostrophes.
2. **Unused import**: `import type {Queryable} from './db'` in `src/server/doc-approval-proposals.ts:5` (diff 185) is never used (`tsc` passes because `noUnusedLocals` is not set). Remove.
3. **`listOwn` parses before the bot/tenant check** (diff 357-358), so a bot or foreign-tenant caller with a malformed body gets a 422 instead of the 404 of P1. The brief lists "P1; …" first for `listOwn` with no P0 step; the report discloses this. Low risk, but put `this.same(p)` first to follow the brief literally (and keep the 404 uniform for callers who must not learn the command shape).
4. **DRY**: the SCOPE_DENIED sentence is written out again in `same()` (diff 247) next to the `SCOPE_DENIED()` factory; the APPROVAL_PENDING sentence is written out twice (diff 316, 341). Use one constant or factory each, so a later wording change cannot split them.
5. **Fixture trap**: `seatCoordinator.name` is the seat code (`approvers[1].seat`, fixture line 467), not the account name the service reads from the database for `reasonPrefix`. No case in 1a asserts the reason of a `seatCoordinator` ballot, but a later case that does would fail confusingly. Use the real account name or note it.
6. **Ca 19's `not.toContain` checks on the answer cannot fail** (the returned object has no field that could carry them); the case's real teeth are the two ballot-row assertions, and ca 2's exact `toEqual` guards the shape. The report already says ca 19 stayed green under mutation (c). Acceptable; a one-line comment in the case saying where the shape guard lives would help.
7. **P5 locks `identity.users WHERE id=ANY(...)` without a tenant predicate** (diff 268-269). The brief's SQL has the same form, and the composite foreign keys `(project_id,tenant_id)` / `(user_id,tenant_id)` of migration 002 make a foreign-tenant subject unable to hold a membership in this tenant's project, so the answer is the one INELIGIBLE sentence. Plan-mandated and not exploitable; a `AND tenant_id=$2` would be cheap defence in depth if the plan is ever reopened.
8. **Edge in P11**: if a stored `before` entry holds duplicate permission codes (the code comment says duplicates are "not refused here") and sits at 11 entries, appending codes can exceed `max(11)` and the assertion throws the internal `Error` (a 500) rather than INELIGIBLE. Very unlikely, no data shows it; mention only so 1b's HTTP mapping knows that an internal `Error` is possible there.

### Assessment
**Task quality:** Approved

**Reasoning:** The service, the pure function, the method and the 33 cases follow the brief's P0-P17 order, error table, `listOwn` contract and limits step by step, with no forbidden file touched and no swallowed error; the findings are naming, a dead import, one ordering preference and small DRY points. Native and concurrency behaviour rest on the supplied log and on Task 1b.
