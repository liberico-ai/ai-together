# Security review: Task 7c, sub-task 1b (commit `85766b4`, base `fb37ee3`)

Verdict: PASS

- Reviewer role: security reviewer, advisory only. The Chairman approves merges. This is the task-scoped gate for 1b; a whole-branch review comes later.
- Counts: Critical 0 · Important 0 · Minor 2. There are also seven notes that are not findings. Scale: Critical = P0, Important = P1, Minor = P2.
- Merge condition from plan gate round 3 still holds: 1a and 1b ship in one PR. 1b now carries the lock-order proof that 1a owed.
- Method: read-only.
  - I read the brief (`.superpowers/sdd/task-7c-coordinator-proposal/task-1b-brief.md`: Global Constraints, T7C-5, T7C-22, T7C-24, the shared Task 1 contract and the 1b section), the implementer report, the review package `review-fb37ee3..85766b4.diff`, and my 1a report.
  - I read the code the diff depends on at HEAD: `src/server/http.ts`, `auth.ts`, `errors.ts`, `identity.ts`, `accounts.ts`, `account-approval.ts`, `review-http.ts`, `doc-approval-proposals.ts`, `src/proxy.ts`, the route files of `team/accounts`, `team/approvals` and `reviews`, the test helpers `tests/slice1-db.ts`, `tests/slice3-fixtures.ts`, `tests/doc-approval-fixtures.ts`, and migrations 009, 017 and 018.
  - I read the session's `progress.md`. It summarises the 1b code review's findings in one line. I did not open the code-review report.
  - I ran no test, native or PGlite. Every check below is code reading, git output or the committed evidence logs.
  - I wrote nothing other than this file.
- Line numbers: HEAD `80ab225` file lines. `git diff --stat 85766b4 HEAD` touches only `docs/plans/task-7c-coordinator-proposal.md`, so the 1b files at HEAD are byte-identical to `85766b4`. `#fact`
- Tags: `#fact` = read in code or command output; `#inference` = reasoned from code, not executed.

## Step 0: secrets scan

- `git ls-files | grep -Ei '\.env|secret|credential|key|token'`: no tracked file matches. `.gitignore:7-8` ignores `.env*` and lets only `.env.example` through. `#fact`
- 1b files: `src/server/doc-approval-http.ts`, the route file, both test files, `vitest.config.ts` and the two evidence logs.
  - I scanned them for URLs, connection strings, home or tmp paths, numbers of nine digits or more, JWT shapes, bot-token shapes and cloud key prefixes.
    - The only URLs are the loopback `http://127.0.0.1:3147` (`tests/doc-approval-proposal-http.test.ts:24`, `tests/doc-approval-proposal-concurrency.test.ts:220`) and the reserved `https://evil.example` (`…-http.test.ts:61`, `:63`).
    - No number of nine digits or more appears, so there is no Telegram group-shaped id.
    - The evidence logs show `<repo>` in place of the checkout path. They name the env file only as `$TASK7C_ENV_FILE` (`task-1b-green.txt:15`, `:126`). `#fact`
  - I scanned the four source files for bidi, format, separator and control characters (U+200B–200F, U+202A–202E, U+2028/2029, U+2060–2069, U+FEFF, U+00AD, C0 controls): none. `#fact`
  - The session token in the tests is `'t'+randomUUID()`. It goes into the local demo store and is removed in `afterEach` (`…-http.test.ts:21`) or in a `finally` block (`…-concurrency.test.ts:227`). `#fact`
- History. `git log --all --diff-filter=A` finds one secret-like file ever added: `.env.example`, in older commits of a predecessor codebase (`7f9dd6e`, `9802a17`; both are ancestors of HEAD; the file no longer exists at HEAD).
  - Its secret fields are empty or are template text.
  - One database password field holds a short lowercase dev default, which a compose file of that same commit also contains.
  - Class: a dev default in a template, not a credential pattern. This is out of scope for 1b and is not a finding. The Chairman may wish to confirm that this value never protected a deployed database.
- Files that must not change, checked against the new base `679ff6c`:
  - `git diff --stat 679ff6c HEAD -- src/server/account-approval.ts bot-plugin AGENTS.md CLAUDE.md migrations src/server/http.ts src/server/review-http.ts src/server/auth.ts` is empty.
  - `accounts.ts` differs only by the two 1a `export` words.
  - `identity.ts` differs only by the 9 lines of 1a's `activeProjectRole`.
  - `vitest.config.ts` only appends `doc-approval-proposals.ts` (1a) and `doc-approval-http.ts` (1b).
  - `git diff --stat fb37ee3 85766b4 -- src/server/doc-approval-proposals.ts tests/doc-approval-fixtures.ts tests/doc-approval-proposal.test.ts` is empty, so 1b did not edit 1a.

  All `#fact`. The limit checks in the evidence log were run against the pre-rebase base `0560a4f` (`task-1b-green.txt:224-271`). My run above repeats them against `679ff6c`, the base the brief now pins.

## Findings

| # | Severity | Location | Class | Evidence ref | Recommended fix | Owner role |
|---|---|---|---|---|---|---|
| M1 | Minor | `tests/doc-approval-proposal-concurrency.test.ts:144-146` (race case 3, second order) | The proof claims more than it isolates | The comment says that, once the ballot is marked approved, «the only reason left to refuse the frozen grants is the version they were frozen at». The admin path refuses on two conditions at once: `ballot.subject_account_version===user.version` **and** `sameGrants(previous_grants,before)` (`src/server/accounts.ts:211-213`). In this case both are false. `previous_grants` is `[S technical people_read]` (`:141`), while `before` at apply time is `[S technical]`, because the admin cut removed `people_read` (`:106`, `:132`). The assertion at `:146` therefore passes even if the version comparison is removed. The security property holds: a ballot frozen before an admin change cannot be applied after it. But this case does not show which guard holds it. `#fact` from code; `#inference` for the mutation outcome, not run. | To isolate the version guard: before `applyFrozen`, set the subject's `identity.memberships` back to the frozen `previous_grants` through the operator login. That path does not bump `account_version`, so only the version differs. Expect the same `TELEGRAM_APPROVAL_REQUIRED`. Alternatively, reword the comment to «two guards refuse it: the frozen version and the frozen previous grants». | Builder |
| M2 | Minor | `tests/doc-approval-proposal-http.test.ts:90` (POST only); no case in `tests/doc-approval-proposal.test.ts` | Principal-refusal and isolation test gap on the read path (AR-06, Quality Gate 34a) | No test sends `GET` or `HEAD` (`listOwn`) as the `bot` principal or as a principal of another tenant. The HTTP suite checks the bot only on `POST` (`:90`). The service suite checks bot and foreign tenant only on `propose` (`tests/doc-approval-proposal.test.ts:269`, `:437`). The code does refuse both: `listOwn` calls `this.same(p)` first (`src/server/doc-approval-proposals.ts:176`, `:65-67`), before parsing and before any database read, with the common 404 sentence. That is `#fact` by reading, but nothing pins it, so a later reorder (for example, moving the parse first again) would go unnoticed. Reachability today is low. Production sessions come from `identityService().session()` (`src/server/auth.ts:62-66`), which builds principals of the one configured tenant, and the bot uses the bridge. `#inference` | Add `GET ?projectId=<S>` and `HEAD` as `bot`, and as `{...coordinator,tenantId:ids.otherTenant}`. Expect `shape()` equal to the unknown-project 404 (the `:133-140` pattern). It is one loop in HTTP case 3. | Builder |

Neither finding blocks the PR. Both are test-precision items on a property the code already enforces.

## Checks against the code as written

### 1. Entry point

- **Authentication comes first.** `authenticatedPrincipal(request)` is the first statement inside the `try` (`src/server/doc-approval-http.ts:38`). Only `randomUUID()` runs before it (`:36`). HTTP case 1 checks 401 for GET, HEAD, POST, DELETE and an unknown path without a session (`…-http.test.ts:59-60`). `#fact`
- **Identity and tenant come only from the session principal.**
  - The handler passes `principal`, plus the raw body or the raw query object, to strict schemas (`:45-46`).
  - The service reads actor and tenant only from `p` and writes `tenant_id` from `this.identity.tenantId` (`doc-approval-proposals.ts:66`, `:157`, `:164`, `:167`). Neither the handler nor the service reads `tenantId`, `proposerId`, a role or grants from input.
  - HTTP case 1 sends each of `proposerId`, `tenantId`, `grants`, `role`, `reportPermissions`, `projectIds`, `state` and an own `__proto__` in the body, and `proposerId`, `tenantId`, `role` and `projectIds` in the query of GET and HEAD. Every one answers 422, with an unchanged snapshot and throttle count 0 (`…-http.test.ts:64-73`).
  - The aggregated session role is not used. A coordinator whose session `role` is `viewer` succeeds, because the role that counts is read from the database (`:78-79`). `#fact`
- **The bot principal is refused.** `same(p)` refuses `role==='bot'` with the common 404 (`doc-approval-proposals.ts:65-67`), as the first step of `listOwn` (`:176`) and right after the parse in `propose` (`:72`). It is pinned for POST (`…-http.test.ts:90`), not for GET (M2). `#fact`
- **`checkOrigin` runs on every method other than GET or HEAD.** The test is `m !== 'GET'` (`:41`), so POST, PUT, PATCH, DELETE and any other method go through the check. That includes `patch`, which the Fetch standard does not upper-case. The check comes before `identity()` and before the body is read. The body is read only inside the POST branch (`:46`), so nothing is parsed or written for a cross-origin write. HTTP case 1 checks 403 for the four write methods (`:61`), and the builder's «origin» mutation turned that case red (`task-1b-green.txt:206-209`). `#fact`
  - Order: 401 comes before 403, as in `review-http.ts:52-55`. That is acceptable. A forged cross-origin request needs the victim's cookie to get past 401, and then it gets 403 before any work. `session()` is read-only (`identity.ts:142-149`), so authenticating a cross-origin request has no side effect. `#fact`
- **HEAD.**
  - HEAD is mapped to `GET` (`:40`), so it reaches only `listOwn`, which reads and writes nothing, not even the throttle. It never reaches `propose`.
  - HEAD answers the same body and status as GET for the same principal (case 3, `:117-120`, `:139-140`). Through Next.js, the exported `GET` serves HEAD, and Node's HTTP server sends no body on a HEAD response. Even where a body is present, as in the direct handler calls of the tests, it is the body the same principal gets by GET.
  - A cross-origin GET or HEAD answers 200 (`…-http.test.ts:63`). That is a read the attacker's page cannot see without CORS, and it has no side effect. No leak beyond GET. `#inference` for the Next.js and Node behaviour; `#fact` for the handler.
- **Route file.**
  - `runtime='nodejs'`, `dynamic='force-dynamic'`. It exports GET, POST, PUT, PATCH and DELETE as one `handler` that calls `handleDocApprovalApi(request,(await ctx.params).path??[],identityService)`. Its only imports are the handler and `identityService` (`src/app/api/team/doc-approvals/[[...path]]/route.ts:1-13`). This matches the brief's contract word for word, and HTTP case 6 pins it (`…-http.test.ts:198-201`).
  - `identityService` is passed uncalled, so `identity()` runs inside the handler's `try` (`:42`).
  - `src/proxy.ts:24` excludes `api/` from the middleware, so no other gate applies or is bypassed. `#fact`

### 2. Input

- **The body is strict.** `body()` reads at most 16 KB, then runs `JSON.parse` (`src/server/http.ts:16-18`). `proposeSchema` is `.strict()` with exactly five keys (`doc-approval-proposals.ts:41`).
  - Malformed JSON is a `SyntaxError` and answers 422.
  - An own `__proto__` from `JSON.parse` answers 422 (`…-http.test.ts:68-69`). `#fact`
- **GET query.** `query()` (`doc-approval-http.ts:16-19`) builds an object from **every** parameter:
  - It uses `Object.fromEntries`, which creates an own `__proto__` key rather than setting the prototype.
  - A repeated key becomes an array.
  - `listSchema` is `z.object({projectId:uuid}).strict()` (`doc-approval-proposals.ts:42`). So an unknown key, an own `__proto__`, a repeated `projectId` and a non-uuid all answer 422 (case 3, `:117-120`).
  - The builder's «query» mutation (last value wins) turned case 3 red (`task-1b-green.txt:202-205`). `#fact`
- **Can either behaviour let a caller choose a project they should not see?** No, for either one.
  - `listOwn` authorises the one `projectId` it receives. It checks the caller's own active membership inside the transaction (`:181`) and filters on `proposer_id=$1` with the caller's id (`:186`). Whatever value reaches the service is the value that is authorised.
  - Under the last-value rule of `review-http.ts:23-27`, a pollution attempt only changes which project is asked about. It cannot widen the answer, because no other layer authorises a different value.
  - Answering 422 for a repeated parameter is stricter. It also removes any first-value versus last-value disagreement with a proxy or cache in front. Judged safe; no change asked. `#inference`

### 3. Error mapping and answers

- **H1 is resolved.**
  - `unexpected()` (`doc-approval-http.ts:32-33`) replaces every non-`AppError` whose `code` is `'23505'` with `new Error('Unmapped unique violation.')` before `failure()`. `failure()` then takes its generic branch: it logs only `{event:'request_failed',requestId,errorType}` and answers 500 `INTERNAL_ERROR` with the fixed sentence (`http.ts:13-14`). The `DUPLICATE_CODE` branch (`http.ts:12`) is no longer reachable from this handler.
  - The one-open-ballot index is still mapped by the service to `AppError('APPROVAL_PENDING')` (`doc-approval-proposals.ts:159-161`), which passes through unchanged. Race case 9 proves this through the handler: 409, the exact sentence, `no-store` (`…-concurrency.test.ts:208-231`).
  - HTTP case 5 makes a **real** voter-row unique conflict inside the service's own transaction (`…-http.test.ts:167`). It gets 500 `INTERNAL_ERROR`, and the body does not match `account_approval|duplicate|23505` (`:169-171`).
  - The builder's «h1» mutation (`failure(error)`) turned that case into `409 DUPLICATE_CODE`, which is red (`task-1b-green.txt:191-194`).
  - `#fact`
- **Any other non-`AppError` answers the generic 500.** That includes P11's internal assertion (`doc-approval-proposals.ts:124-125`) and `new Error('boom')` from `identity()`. HTTP case 5 checks both (`…-http.test.ts:158-164`, `:173-177`): the body contains neither `boom` nor `pure addition|grants`, and no row is written. `#fact`
  - The only non-`AppError`s that do not answer 500 are `ZodError` and `SyntaxError`, which answer 422 with one fixed sentence (`http.ts:11`). An internal `ZodError` would therefore read as «invalid input» rather than 500. In this module that cannot happen: every schema use on database data is `safeParse` (`doc-approval-proposals.ts:111`, `:124`, `:132`, `:193`). The only `.parse` calls are on input (`:71`, `:177`). `#fact`
- **The shared `failure()` is unchanged.** `git diff --stat 679ff6c HEAD -- src/server/http.ts` is empty. `#fact`
- **No stack, SQL, seat, name, account version or other-project data appears in any answer.**
  - The handler adds one sentence of its own, the common 404 (`:13`). It is the service's `SCOPE_DENIED` sentence character for character (`doc-approval-proposals.ts:17`), and HTTP case 4 compares the two bodies (`…-http.test.ts:150`).
  - Every service refusal is a fixed sentence; see my 1a report, section 8.
  - `success()` carries only `DocApprovalProposal` (`doc-approval-proposals.ts:15`, `:170`, `:196`). HTTP case 2 pins its exact keys (`…-http.test.ts:85`).
  - HTTP case 5 checks that the captured `console.error` lines are `request_failed` lines naming no message, constraint, permission, name or basis (`:179-183`). `#fact`
- **`Cache-Control: no-store` is on every answer.**
  - `noStore()` sets the header on the finished response (`doc-approval-http.ts:22-25`). It wraps both `success` (`:43`) and `failure` (`:50`), and so covers the 422 and 500 branches where `failure()` sets none.
  - `expectErr` asserts the header on every refusal (`…-http.test.ts:53`). Success answers are checked at `:81` and `:122`. The 422 caused by an unknown key is checked on its own at `:113`.
  - The builder's «no-store» mutation turned four cases red (`task-1b-green.txt:195-201`).
  - Nothing can answer outside the `try` except `await ctx.params` in the route file; see N1. `#fact`
- **The 503 before routing when identity is not configured discloses nothing.**
  - In production, `authenticatedPrincipal` itself calls `identityService()` (`auth.ts:64-65`). The 503 therefore comes before authentication and before routing, for **every** request to **every** identity-backed route (`team/accounts`, `team/approvals`, this one). It says only that sign-in is not configured, which the sign-in page also shows.
  - In demo mode, `identityService()` always refuses (`identity.ts:227`, `LIBETECH_DEMO!=='1'`). So an authenticated demo caller gets the same 503 for every path of this family, whether known or unknown.
  - Within the family, no path, method or object can be told from another. Existence of the route family is already visible: a path outside `src/app/api` gets the framework's 404.
  - The same design keeps demo principals away from the identity database: no demo session can reach `DocApprovalProposalService` in production.
  - Judged no disclosure. `#fact` for code; `#inference` for the conclusion.

### 4. Race cases versus T7C-5

The order is built by `beforeStatement` (`tests/slice3-fixtures.ts:128-135`). It awaits a hook once, just before the first statement that matches. The tests then call `waitForBlocked` (`tests/slice1-db.ts:58-66`), which polls `pg_stat_activity` for `wait_event_type='Lock'`. `grep` finds no `setTimeout`, `sleep` or `pg_sleep` in either test file; the only timer is that 50 ms poll.

At each wait, `waiting()` (`…-concurrency.test.ts:35-36`) reads the **statement** that waits. It reads SQL text with `$n` placeholders, never a value. It runs on the operator login, which sees other sessions' text. If it could not, the anchored regex would fail, red rather than falsely green. Every case asserts that no result is `40P01` (`:27`). `#fact`

What the cases prove, step by step:

- **Step 1: the admin row is the first lock.**
  - Cases 1 and 3 (first order). The admin transaction holds its own row `FOR UPDATE` and is about to lock the target row (`accounts.ts:52`, `:193`). The proposal then waits **exactly** on `^SELECT id FROM identity.users WHERE id=$1 FOR KEY SHARE$`, and on nothing else (`:42`, `:62`, `:117`). The admin then locks the proposer's or subject's row and commits `ok`, without a deadlock. That shows the proposal held no account-row lock before step 1.
  - Cases 2 and 3 (second order). The proposal sits just before its ballot insert. The admin command waits **exactly** on its very first statement, the `operator` lock (`:44`, `:87`, `:137`). That shows the `KEY SHARE` is held through steps 2 to 4 until commit, so the whole admin command runs after the whole proposal.
  - `#fact` from code and assertions.
- **Step 2: both account rows, in one ordered statement.**
  - Case 8. The second co-manager passes the shared `KEY SHARE` and waits **exactly** on `…WHERE id=ANY($1::uuid[]) ORDER BY id FOR NO KEY UPDATE$` (`:202`). This pins three things: `KEY SHARE` does not serialise coordinators against each other, the two rows are taken by that one statement, and its text cannot be split without the case going red.
  - Cases 5 to 7 add outcome checks under concurrency.
  - The builder's P5 mutation (drop `FOR NO KEY UPDATE`) turned cases 5 and 8 red (`task-1b-green.txt:216-222`).
  - `#fact`
- **Step 4: inserts come last.** Cases 2, 3 and 8 park the proposal at `INSERT INTO identity.account_approvals` (`:21`) while it already holds the locks of steps 1 and 2, as the waits above show. `#fact`
- **Step 3, the ballot row.** No race case exercises it in 1b; see N3.
- **Mutation (a) goes red for the right reason.**
  - Without the admin-row lock, the proposal takes both account rows and then needs `KEY SHARE` on the admin row anyway: the chairman voter's foreign key (`migrations/009_telegram_account_approval.sql:37`) points at the admin, because `validSeats` requires `chairman` to be the admin (`account-approval.ts:22`). The admin transaction holds its own row and wants the proposal's row. That is the cycle of T7C-5 (b), and PostgreSQL ends it with a real `40P01` after its deadlock timeout.
  - The log shows exactly cases 1, 2 and 3 red with `AssertionError: a deadlock is never an answer: expected '40P01'` at `noDeadlock` (`task-1b-green.txt:112-188`), each after about 1.4 s. The six cases without an admin command stayed green.
  - The revert is confirmed: the line is present at `doc-approval-proposals.ts:85`, and the 1a files are unchanged.
  - `#fact` for the log and the code; `#inference` for the cycle mechanism. I did not re-run it, because native tests were off-limits.
  - Also by reading, `#inference`: two other wrong orders would be caught as well. Taking the admin row *after* step 2 would deadlock case 1. Using `FOR UPDATE` on the admin row would make case 8 wait on the admin-row statement, so its statement-text check would fail.
- **Race case 3 sets `state='approved'` directly (labelled synthetic, `:144-145`). The case is still meaningful.**
  - The state it builds is reachable without a direct write: a ballot approved by real votes, after which the admin narrows the account. A narrowing `access` command does not touch ballots, so the approved ballot stays frozen at the old version.
  - The case then proves that the admin's apply refuses those frozen grants.
  - Its weakness is precision, not meaning: see M1.
- **The lock-wait check that replaced the brief's `created_at` compare in race case 2 is stronger than the compare.**
  - `created_at` defaults to `now()`, the start time of each transaction. The proposal's transaction starts before the hook starts the admin command, so `a.created_at<=e.created_at` (`:91-93`) cannot fail. The builder says so in a comment (`:90`).
  - The order is shown by three things together. The admin command was observed waiting on its first lock while the proposal held its locks (`:87`), and row locks last until commit. The proposal answered `ok` (`:88`), so P6 under the lock still read `manager`. And the coordinator ends as `viewer` (`:95`), so the demotion committed afterwards.
  - Together these prove commit order. The `created_at` line can only show start order.
  - `#inference` from PostgreSQL lock semantics and the assertions.
- **Race case 4 (the admin as subject).** It awaits the whole proposal inside a hook that holds the admin row. Any lock touch would hang the proposal until `statement_timeout` (10 s, `src/server/db.ts:32`), giving `57014` instead of the INELIGIBLE answer. The builder's P3b mutation showed exactly that (`task-1b-green.txt:211-215`). `#fact`
- **Race case 9 (T5).** The operations login's insert runs on its own connection and commits first. It needs only `KEY SHARE` on the subject row, which does not conflict with the proposal's `FOR NO KEY UPDATE`. So the service's insert meets a committed row in the unique index `account_approval_active_access_change` (`migrations/018_access_change_approval.sql:32`) and gets a real `23505`. `#inference`, consistent with the result: 1 ballot, 0 voters, 0 events (`:228-230`).

### 5. Writes, expected version, audit, outbox (E-INT-06)

- The 1b production code writes nothing.
  - The handler calls only `listOwn`, which reads, and `propose` (`doc-approval-http.ts:45-46`). It builds no `AccountService`, reads no `Idempotency-Key` and runs no SQL.
  - The route file only forwards to the handler.
  - HTTP case 6 checks the following (`…-http.test.ts:186-201`). Among the route files under `src/app/api`, only `team/accounts/route.ts` both mentions `AccountService` and calls `.command(`. Neither `doc-approval-proposals.ts` nor `doc-approval-http.ts` contains `setGrants`, or any insert, update or delete on `identity.memberships`.
  - `#fact`
- The service's writes are unchanged from 1a. They all run in one `identity.scope` transaction: the ballot, the voters, the DM through `notifyVoters` and then `enqueueDm` on the same `tx` (`account-approval.ts:57-61`), and the audit event (`doc-approval-proposals.ts:155-168`). Its optimistic check is `expectedTypes` (P9) together with the frozen `subject_account_version`. No DM is enqueued outside the transaction. `#fact`
- The direct `h.operator` writes in the tests are synthetic fixture steps, in test files only: `UPDATE memberships` (`…-concurrency.test.ts:102`), the `state='approved'` mark (`:145`), and the operator-login ballot (`:212-214`). `#fact`

### 6. Public repo

These use synthetic data only; see Step 0.

- Ids come from `randomUUID()`, the existing `ids.*` constants and the 1a fixtures.
- Names and reasons are «… mẫu» sentences.
- There is no real Telegram group id, token, URL or local path in code, tests or `task-1b-{red,green}.txt`.
- The two evidence logs also contain no `postgres://` string, home path or env value. `#fact`

## Notes (not findings)

- **N1, observation.** In the route file, `await ctx.params` runs outside the handler's `try` (`route.ts:5-7`). The `reviews` route has an outer `try` (`src/app/api/reviews/[[...path]]/route.ts:6`) because its `database()` call can throw. Here the only call that can throw, `identity()`, is already inside the handler's `try`, and Next.js hands over params that are already resolved. The brief prescribes this route word for word. No change.
- **N2, observation.** Race case 2's `created_at` compare is vacuous; it is plan-mandated. The real evidence is the lock-wait check; see section 4. Dropping the compare, or labelling it «start order only», would need a plan edit. It is harmless as it stands.
- **N3, T7C-5 step 3 (the ballot row) is not raced in 1b.**
  - `propose` takes no explicit `FOR UPDATE` on a ballot row. Its only ballot-row lock is P15's `UPDATE` of dead ballots (`doc-approval-proposals.ts:148-150`).
  - The one path that holds a ballot row `FOR UPDATE` while a proposal can run is the vote (`account-approval.ts:171-172`). After that lock, the vote only reads the subject's row without a lock (`:180-181`) and takes `KEY SHARE` through the voter foreign key of the votes table (`:199`, `migrations/009…:45`). `KEY SHARE` does not conflict with the proposal's `FOR NO KEY UPDATE`, so the vote never waits on the proposal, and no cycle can form. `#inference`
  - The ballot-row leg belongs to Task 2 (`withdraw`, cancel), whose race cases the plan already lists.
- **N4, observation.** Race case 7 is a free race (`Promise.allSettled`, `:183`) and so is probabilistic on its own. The deterministic evidence for «one ordered statement» is case 8's statement-text check plus the P5 mutation. That is adequate.
- **N5, observation (builder concern 5).** The race cases count every lock wait in the database. On a shared test database, a foreign wait would make a statement-text assertion fail, which shows up red, never falsely green.
- **N6, optional hardening.** The H1 replacement error has `name` `'Error'`, so `failure()` logs `errorType:'Error'` (`http.ts:13`). An operator cannot tell an unmapped unique violation from any other 500 except through the request id. Giving the replacement its own `name`, for example `UnmappedUniqueViolation`, would keep the class in the log without the constraint or SQL. This is a choice for E-OBS-01; there is no security effect either way.
- **N7, residuals.** The residuals accepted in the plan are present as designed, and this review did not reopen them: `APPROVAL_PENDING` discloses that an open ballot exists, the seat residual of T7C-3, the user-chosen name in the frozen reason, and `state` shown to the proposer (OQ-52).

## Three highest-leverage fixes

1. **M2.** Pin `same(p)` on the read path with a bot principal and a foreign-tenant principal on GET and HEAD, expecting the common 404. It is the one principal-level refusal of the new route that no case exercises (AR-06).
2. **M1.** Make race case 3 isolate the version guard: restore the frozen `previous_grants` before applying. Otherwise, reword its comment. As written, a reader believes the frozen-version check is pinned when another guard could be holding the line.
3. **N6.** Optional: give the H1 replacement error its own `name`, so operators can tell unmapped unique violations apart in the log.

None of the three blocks the PR. M1 and M2 fit in the 1b fix round or in the whole-branch round.
