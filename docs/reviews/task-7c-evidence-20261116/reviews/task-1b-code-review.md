# Task 7c / 1b code review (fb37ee3..85766b4)

Reviewer: liberico-code-reviewer. Recommendation only; the Chairman approves merges. Not re-run: git, native PostgreSQL tests. Read: the diff, the 1b brief, and four named spots outside the diff (`src/server/http.ts` failure(), `src/server/accounts.ts:205-214`, `tests/doc-approval-fixtures.ts` applyFrozen, and the report and green log).

## Spec Compliance

Verdict: compliant. Every item below was checked against the diff.

- Handler contract, `src/server/doc-approval-http.ts`:
  - 401 comes first through `authenticatedPrincipal` (:409).
  - HEAD is treated as GET (:411); `checkOrigin` runs for every other method (:412).
  - `identity()` is called inside `try` (:413), so IDENTITY_UNAVAILABLE becomes a 503.
  - GET/HEAD on `[]` calls `listOwn` with every query parameter (:416, query() at :387-390). A repeated parameter becomes a list and a `__proto__` parameter becomes an own key (Object.fromEntries), so the strict service schema refuses both with 422.
  - POST on `[]` calls `propose(await body(request))` (:417).
  - Everything else throws the SCOPE_DENIED 404 (:420). The wording matches the service's own sentence (:384). The test compares the body with the service's out-of-scope answer (http test :816).
  - Every answer, success or failure, goes through `noStore` (:414, :421).
  - `Idempotency-Key` is not read.
  - `failure()` is not touched (diff shows no change to http.ts).
- H1 resolution (:403-404). A non-AppError carrying `23505` becomes `new Error(...)` before `failure()`, so it answers INTERNAL_ERROR 500. The same applies to P11's plain Error. Test at http :831-843 covers both with a real conflict on the voter row. It asserts no `account_approval`, `duplicate` or `23505` in the body, an unchanged snapshot, and a log line that names only the event and request. Correct.
- Route file `[[...path]]/route.ts`: runtime nodejs, dynamic force-dynamic, five methods on one handler, `(await ctx.params).path??[]`, identityService. As briefed.
- Room for Task 2: a comment at :419 and the `parts.length===0` block leave one branch to add. Acceptable.
- Six HTTP cases, named as in the brief. The brief lists the 409 codes, and the 409 row of case 2 covers all four: APPROVERS_NOT_READY, APPROVAL_PENDING, VERSION_CONFLICT, ACCESS_CHANGE_NOT_NEEDED. All nine race cases exist with the brief's names and setups.
- Mutation (a) is recorded in the green log (:112-186). It makes three race cases red with 40P01, and the revert is shown clean. Six further mutations (H1, no-store, query, origin, P3b, P5) are also logged and reverted.
- Step 7 limit checks are in the log (:225-263), pre-rebase SHA `0560a4f`. The session already re-verified after the rebase. Not re-run by me: verifiable only by running git.
- `vitest.config.ts`: one path appended to the single line, none reordered.
- Hard limits: nothing under `bot-plugin/`, `AGENTS.md`, `CLAUDE.md`, `accessChangeTally` or the account-admin path. No actor or tenant identity read from the body or query; forged-field cases pin 422 on both.

## Strengths

- The handler is thin: no SQL, no business rule, no swallowed error. `catch` always produces a response, and unexpected errors go to `failure()`, which logs only the request id and error type.
- The H1 workaround is a three-line function with a rationale comment, and it does not touch shared code.
- Race ordering uses real lock waits. The `beforeStatement` hooks plus `waitForBlocked` are followed by a `pg_stat_activity` read that asserts which statement is waiting. This is stronger than the brief asked for and gives mutation (a) a precise failure. There is no `sleep`. The `settle()` wrapper avoids unhandled rejections from calls started inside hooks. Every case asserts no 40P01.
- Tests check behaviour, not wiring. They cover header presence on 401/403/404/422/500/503, byte-identical 404 bodies for unknown project, removed member and never-member, and database snapshots unchanged after refusals. The 500 case mocks `console.error` and checks that the log carries no content.
- `proposedEvents` correctly counts only this world's proposers, because `identity.events` has no FK and `reset()` does not empty it. This is a careful catch.
- Both test files build their own world per case, and `afterEach` removes the session tokens.

## Issues

### Critical
None.

### Important
None.

### Minor

1. `tests/doc-approval-proposal-concurrency.test.ts:519-521`, plan-mandated: the `created_at` comparison cannot fail. Both timestamps are `now()` (transaction start), and the proposal's transaction always starts before the hook launches the admin command. The builder is right to say so. The `ADMIN_ROW_UPDATE` lock-wait assertion (:515) is the real proof, and the comment at :518 half-says this. I suggest making it explicit that this assertion is decorative, or removing it. A passing check that proves nothing could be read as coverage later.
2. `tests/doc-approval-proposal-concurrency.test.ts:572-574`: the comment says the version is "the only reason left" for the refusal. `accounts.ts:210-213` also requires `previous_grants` to equal the account's current grants, and the cut changed them. So the refusal has two causes (version and previous_grants), not one. The case is still valid, because :568 pins `subject_account_version` directly. Fix the comment. The synthetic UPDATE to `approved` is labelled and acceptable, since there is no application path to approve without voters.
3. `src/server/doc-approval-http.ts:413`: `identity()` runs before path dispatch, so an unknown path answers 503 instead of 404 when identity is not configured. The brief's "inside `try`" does not decide this, and it leaks nothing. Keeping it is fine, and the builder disclosed it. No test pins it either way.
4. `doc-approval-http.ts:389`: a repeated query parameter answers 422, stricter than `review-http.ts`, where the last value wins. This is defensible, because it blocks parameter pollution picking a project. It is pinned by test (http :784) and by the (query) mutation. Approved on its merits. Do not harmonise to last-wins.
5. Native green log, :19-28: pg `DeprecationWarning` (concurrent `client.query()`) lines. The same warning appears in `task-1a-green.txt:22`, so it is likely pre-existing from the shared `beforeStatement` hook plumbing, not 1b-specific. "Pristine output" is not met on the native run, but the cause is outside this diff. Worth a ticket against `tests/slice1-db.ts`; I did not trace it.
6. DRY: `loginAs` is duplicated in the http test and inline in the concurrency test (:644-646). A one-line helper in `doc-approval-fixtures.ts` would remove the second copy. Not blocking.
7. Race cases assume exclusive use of the test database. `waiting()` filters only on `datname`, so a concurrent session would break the exact-one-waiter assertions. The repo's vitest config already sets `fileParallelism:false`, so this is consistent with existing practice. A single-sentence note in the file header would document it.
8. The `only /api/team/accounts can apply grants` case (http :852-868) reads source text, with a relative `src/app/api` path that depends on cwd. It matches the repo's existing style (`rsc-boundary`), and the brief names it as supplementary to the behaviour cases. Fine.

## Assessment

**Task quality:** Approved

**Reasoning:** The handler matches the contract exactly. The H1 resolution works without editing `failure()`, and the mutation evidence shows the tests have teeth. Findings are cosmetic or documentation only: a tautological assertion that is disclosed and compensated by the lock-wait check, one inaccurate comment, and pre-existing warning noise. Step-7 limit checks rest on the builder's log and the session's post-rebase verification, not on a re-run by me.
