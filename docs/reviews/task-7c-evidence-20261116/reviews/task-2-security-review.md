# Security review: Task 7c, Task 2 (commit `7ce0f56`, base `ebd8e11`)

Verdict: PASS

- Reviewer role: security reviewer, advisory only. The Chairman approves merges. This is the task-scoped gate for Task 2; a whole-branch review comes later.
- Counts: Critical 0 · Important 0 · Minor 2. Six notes follow that are not findings. Scale: Critical = P0, Important = P1, Minor = P2.
- Method: read-only.
  - Inputs I read:
    - the brief (`.superpowers/sdd/task-7c-coordinator-proposal/task-2-brief.md`: Global Constraints, T7C-5, T7C-10, T7C-19, T7C-27 to T7C-31, and the Task 2 section);
    - the implementer report and the review package `review-ebd8e11..7ce0f56.diff`;
    - decisions OQ-36 and OQ-48 to OQ-52 in `docs/OPEN-QUESTIONS.md`, found by heading;
    - plan gates rounds 1–3, searched for throttle, latency and lock topics.
  - Code I read at HEAD:
    - `src/server/doc-approval-proposals.ts`, `doc-approval-http.ts`, `accounts.ts` and `access-grants.ts` (`docApprovalDelta`);
    - `identity.ts`: `scope`, `throttle`, `activeProjectRole`, `principal`, `login`;
    - `account-approval.ts`: `accessChangeTally`, `approvalReady`, `voteForPrincipal`;
    - `http.ts`, `db.ts`, `src/proxy.ts`, the route files of `team/accounts` and `team/doc-approvals`;
    - migrations 002, 004, 009 and 018.
  - Tests: I read both new test files in full, plus the HTTP additions.
  - I ran no test, native or PGlite. Every check below comes from code reading, git output or the committed evidence logs.
  - I did not open the Task 2 code-review report, although a file of that name is in this folder.
  - I wrote only this file. A text comparison of `proposeAccessChange` went to the session scratchpad, outside the repo.
- Line numbers: HEAD `7ce0f56`, clean working tree. `P…` means `src/server/doc-approval-proposals.ts`, `A…` means `src/server/accounts.ts` and `H…` means `src/server/doc-approval-http.ts`.
- Tags: `#fact` means I read it in code or command output. `#inference` means I reasoned it from code and did not execute it.

## Step 0: secrets scan

- `git ls-files | grep -Ei '\.env|secret|credential|key|token'` returns no match (exit 1). `#fact`
- The commit adds or changes nine files: three in `src/server`, four test files and the two evidence logs.
  - I scanned them for URLs, connection strings, home or tmp paths, JWT shapes, bot-token shapes and long digit runs.
  - The only URLs are the existing loopback `http://127.0.0.1:3147` (`tests/doc-approval-proposal-http.test.ts:24`) and the reserved `https://evil.example` (`:199`).
  - The logs:
    - they show `<repo>` in place of the checkout path, twice each;
    - they name the env file only as `$TASK7C_ENV_FILE` (`task-2-red.txt:528`, `task-2-green.txt:16`);
    - they contain no run of seven or more digits.
  - No Telegram group-shaped id appears. `#fact`
- Hidden characters: one file holds raw bidi-control and separator characters, `tests/doc-approval-withdraw.test.ts:240-241`. See F2. `#fact`
- Files that must not change:
  - `git diff --stat 679ff6c 7ce0f56 -- src/server/account-approval.ts bot-plugin AGENTS.md CLAUDE.md migrations` is empty.
  - `git diff --numstat ebd8e11 7ce0f56` gives `accounts.ts` 21/0, `doc-approval-proposals.ts` 48/0, and `doc-approval-http.ts` 5/2, where the two removed lines are comments.
  - The `proposeAccessChange` text at `679ff6c` and at `7ce0f56` is byte-identical (`cmp`, 25 lines). `#fact`
- History: the commit adds no secret-class file. `#fact`

## Findings

| # | Severity | Location | Class | Evidence | Recommended fix | Owner |
|---|---|---|---|---|---|---|
| F1 | Minor (P2) | `P208-234` | Availability: unthrottled lock on the account-admin row | `P79` vs no throttle in `withdraw`; `P222-225` ignores state; `P227` lock before `P234` refusal; W7 | Throttle `withdraw` per caller; optionally refuse closed ballots before any lock | Builder (the planner records the step change); Chairman approves |
| F2 | Minor (P2) | `tests/doc-approval-withdraw.test.ts:240-241` | Public-repo hygiene: raw RLO, LRI, U+2028 and U+2029 in source (Trojan Source class) | perl scan of the file | Write the four characters as `\u` escapes, as 1a's test already does | Builder |

### F1 — any proposer can hold the account-admin row lock, with no throttle and no trace

What the code does (`#fact`):
- `withdraw` calls no throttle anywhere between `P209` and `P216`. The module's only throttle is `propose`'s P3 at `P79`, which runs before that method's own admin-row lock at `P88`.
- R2 refuses only on kind, proposer, admin proposer and delta (`P222-225`). It selects `state,expires_at` (`P220`) but never uses them. A ballot closed long ago therefore passes R2, whether it was expired, rejected, issued or already withdrawn.
- The transaction then takes three locks before it refuses with `APPROVAL_CLOSED` (`P234`):
  - `FOR KEY SHARE` on the account-admin row (`P227`);
  - `FOR SHARE` on the caller's row (`P228`);
  - `FOR UPDATE` on the ballot (`P233`).
- W7 sends four closed ballots down exactly this path (`tests/doc-approval-withdraw.test.ts:229-230`).
- A refused withdrawal writes no event. It also writes no log line, because `failure()` logs only unexpected errors (`src/server/http.ts:13`).
- There is no rate limit in the handler (`H50`) or in `src/proxy.ts`.

Consequence (`#inference`, from PostgreSQL row-lock behaviour; not run):
- Any coordinator who has ever proposed one ballot can loop `POST /<that id>/withdraw`. Each request holds `KEY SHARE` on the admin row for the length of one short transaction.
- `KEY SHARE` conflicts only with `FOR UPDATE`. Every admin transaction takes `FOR UPDATE` first: `operator` (`A54`) covers every account command and `list`, and the admin's own `login` does too (`src/server/identity.ts:76`). That is the coupling T7C-5 (h) accepts as latency.
- A `FOR UPDATE` request waits while any `KEY SHARE` holder is live. A new `KEY SHARE` request that meets only `KEY SHARE` holders does not sleep, so it never takes the tuple lock that orders waiters, and it overtakes the queued `FOR UPDATE`.
- A few overlapping loops are therefore enough to keep the admin row share-locked without a gap. That is fewer than the pool's 10 connections (`src/server/db.ts:32`), so other users still get connections and the effect lands on the admin alone.
- The admin's commands and login then fail as 500 after `statement_timeout` (10 s, same line). That includes `disable` and `revoke_sessions` against the person running the loop. Nothing records the attempts.
- Why P2 and not P1:
  - the attacker must be an authenticated insider with a session and an own ballot;
  - there is no confidentiality or integrity impact;
  - the effect ends when the requests stop;
  - recovery is operational: revoke the session in the database.
- Implementer concern 3 says «Each withdrawal needs an own pending ballot». That is not true of the lock path: an own ballot in any state reaches `P227`.

Recommended fix (Builder; the step order is the plan's, so the planner records the change; the Chairman approves):
1. Throttle `withdraw` per caller, as `propose` does: `throttle('doc-approval-withdraw:'+callerId, N, 3600)` after R1 and before the transaction. This is the smallest change and mirrors P3.
2. Optionally, refuse early without locks. After R2, run an unlocked `activeProjectRole` check, then unlocked checks of state, deadline, subject version and `approved`, in R5's order and with R5's answers. Then take the locks and repeat R4 and R5 as now.
   - The unlocked R4 must come before the unlocked state checks. Otherwise a removed proposer would learn «closed» instead of getting the OQ-50 (c) 404.
   - The brief permits an unlocked read before step 1 to refuse early: Global Constraints, the line after the T7C-5 lock list.
3. Add one case: N refused withdrawals, then `RATE_LIMITED`, with `snapshot` unchanged.

### F2 — raw bidi override and separator characters in a public test file

- `tests/doc-approval-withdraw.test.ts:240` holds raw U+2028, U+2029, U+202E (RIGHT-TO-LEFT OVERRIDE) and U+2066 (LEFT-TO-RIGHT ISOLATE) inside string literals. Line `:241` starts a literal with a raw U+2028. `#fact`
- Neither the override nor the isolate is closed on its line. Editors and GitHub therefore display the rest of `:240` reordered, and GitHub puts its bidirectional-text warning on the file. `#inference`
- The behaviour is what W8 needs, since those strings must contain those characters. This is not a code defect.
- The risk is to review. In a public repo where a hidden-character warning is routine, reviewers stop reading it, and that is the precondition of the Trojan Source class (CVE-2021-42574).
- Task 1a's test of the same rule uses escapes: `tests/doc-approval-proposal.test.ts` has no such line. The same array on `:240` already escapes `'\u0000'` and `'\uD800'`.
- Older test files have the same pattern: `tests/intake.test.ts:592-593`, `tests/review-ui.test.tsx:448` and `:452`, and `tests/test_bot_bridge.py:504`. They are outside this task.
- Fix: write `'\u2028'`, `'\u2029'`, `'\u202E'` and `'\u2066'` at `:240-241`. A repository-wide sweep with a grep gate is separate work.

## Checks against the brief

### 1. Withdraw

- **Only the proposer.**
  - `P222` compares `row.proposer_id!==callerId`.
  - `callerId` is lowercased (`P213`), and `proposer_id` comes back lowercase from a `uuid` column.
  - Mutation (a) turned W3 red (`task-2-green.txt`, step 7). `#fact`
- **Only a coordinator ballot.**
  - `kind!=='access_change'` and a proposer equal to the admin both give `SCOPE_DENIED` (`P222`).
  - W3 checks a registration ballot and an admin `doc_approve` ballot (`tests/doc-approval-withdraw.test.ts:145-148`).
  - Only two statements insert `access_change` ballots:
    - `A274-277`, whose proposer is `p.id`, the admin, enforced by `operator`;
    - `P158-161`, whose proposer is the coordinator.
  - So «proposer is not the admin» means «created by this path» (except after an admin change, Note 3). `#fact`
- **Only `pending` (OQ-51 b).**
  - Checked under the ballot lock at `P234` and `P239-241`.
  - Covered by W2, W7 and mutation (d). `#fact`
- **An active member in any role (OQ-50 c), read inside the transaction.**
  - `P230` runs after the locks.
  - `activeProjectRole` requires an active, activated account with a membership in this tenant (`src/server/identity.ts:46-52`).
  - Covered by W4 (viewer passes), W5, W10 and mutation (e).
  - The read is stable: memberships change only in `setGrants` (`A164-169`). That runs only after `operator`'s `FOR UPDATE` on the admin row, which `P227` excludes. `#inference`
- **The ballot id comes from the path, and the body is strict `{reason}`.**
  - `P209-211` and `P44`.
  - Covered by the HTTP case «withdraw takes the ballot id from the path only» and by W8. `#fact`
- **A co-manager cannot withdraw; the admin cannot withdraw.**
  - Co-manager: W3, index 0.
  - Admin: `P215`; W3, indexes 3 and 8. `#fact`
- **A version-dead ballot gives `APPROVAL_CLOSED` and writes nothing (N3, T7C-30).**
  - The version check (`P237-238`) runs before the stage check (`P239`).
  - Covered by both branches of W12, by HTTP ballot `b4` and by mutation (g). `#fact`
- **READ COMMITTED (R13).**
  - `src/server/db.ts:44` opens a plain `BEGIN`, and `IdentityService.scope` (`identity.ts:20-25`) sets no isolation level. `P235-236` records the assumption.
  - Under REPEATABLE READ the snapshot would be taken at R2, before the admin commits. Order 1 of the native case «an admin change to the subject racing a withdrawal is seen by it» (`tests/doc-approval-withdraw-concurrency.test.ts:213-225`) would then go red. `#inference`
  - So the assumption is guarded, but only on native runs. PGlite cannot catch it.
- **A removed member gets the same 404 as an unknown ballot.**
  - W5 compares the two answers deep-equal (`:176-178`). The HTTP case compares the bodies with `shape`. `#fact`
- **No disclosure.**
  - Every refusal is a fixed sentence (`P17`, `P45`, `P239-240`). The success body is `{approvalId,state}` only (`P246`), and the HTTP test asserts the key set.
  - Nothing before R2's read depends on database state. After it, every non-proposer gets `SCOPE_DENIED` from one primary-key read.
  - The two 409 answers reach only the proposer who is still a member. They say only «closed» or «approved», and OQ-52 (a) and T7C-28 accept showing the stage. `#fact`
- **Tenant isolation.**
  - `same(p)` (`P212`, `P68-70`) refuses another tenant and the bot.
  - `scope` sets the role and the tenant transaction-locally (`identity.ts:21-23`).
  - `tenant_scope` policies:
    - on `account_approvals`: `USING` and `WITH CHECK`, `ENABLE` and `FORCE` (migration `009:56-63`);
    - on users and events: `002:67-73`.
  - W8 checks a principal of another tenant. `#fact`

### 2. Cancel (`cancel_access_change`)

- **Admin only.** `A189` calls `operator` (`A51-57`): same tenant, not the bot, id equal to `adminId`, active and activated, `FOR UPDATE`. H3 covers it. `#fact`
- **Coordinator ballots only (OQ-49 a).**
  - `A296-297`; covered by H4 and mutation (b).
  - A registration ballot gives `APPROVAL_NOT_FOUND` through the kind filter at `A294` (H4). `#fact`
- **`pending` and `approved` (OQ-51 b).** `A298`; covered by the second half of H1 and by W2. `#fact`
- **Only at the current account version (R3).** `A294` filters `subject_account_version=$3` with `user.version` (H8). The prelude's `expectedVersion` check is at `A199` (H5). `#fact`
- **A basis is required.** The shared `reason` schema is 5–500 characters after trimming (`A16-17`); H5 covers it. `#fact`
- **No `account_version` bump.** The branch at `A201` returns before `nextVersion` (`A202`) and before the `UPDATE identity.users` (`A244`). H1 and mutation (c) cover it. `#fact`
- **No session revoke, no Telegram codes, no invitations.** Those writes are at `A223-233`, all after the return. H1 asserts that the session, the pairing code and the invitations are unchanged. `#fact`
- **The admin propose and apply paths are unchanged.**
  - `accounts.ts` is additions only: numstat 21/0, with hunks at `A23-24`, `A201` and `A286-303`.
  - `proposeAccessChange` is byte-identical.
  - The `access` branch (`A204-222`) is untouched. `#fact`

### 3. Lock order (T7C-5 e)

- **Withdraw**, in order (`#fact`):
  1. admin `KEY SHARE` (`P227`);
  2. caller `FOR SHARE` (`P228`);
  3. plain reads (`P230`);
  4. ballot `FOR UPDATE` (`P233`);
  5. plain read of the subject (`P237`);
  6. `UPDATE` (`P243`);
  7. event insert (`P244`). `identity.events` has no foreign key (`002:51-54`, `004:9-10`), so this takes no lock.
- **Cancel**, in order (`#fact`):
  1. admin `FOR UPDATE` (`A54`);
  2. target `FOR UPDATE` (`A195`);
  3. ballot `FOR UPDATE` (`A294`);
  4. `UPDATE` (`A299`) and the event (`A300`).

  This is the same shape as the existing apply path (`approvalReady`, `account-approval.ts:96-97`).
- **Other paths.**
  - `propose` and withdraw:
    - `propose` holds `NO KEY UPDATE` on two account rows, and withdraw never locks the subject's row.
    - On the proposer's row, `FOR SHARE` and `NO KEY UPDATE` do conflict. But both are taken after the compatible admin `KEY SHARE`, and neither side then waits for a lock the other holds.
  - A vote locks the ballot, then takes `KEY SHARE` on the voter's own row through the votes foreign key (`009:45`):
    - Against withdraw: two `KEY SHARE` locks on the admin row are compatible, and withdraw locks no BoM row. Race case 2 covers both orders.
    - Against cancel: a BoM voter's row is never the subject's, because the subject's seat is removed from the frozen voters (`P115`).
  - A Chairman-seat vote against a cancel is the existing T7C-5 (f) residual: the admin acting on the same ballot in two tabs. `#inference`
- **Race evidence.**
  - Seven native cases. Each asserts the statement it waited on (`ADMIN_ROW_SHARE`, `ADMIN_ROW_UPDATE`, `BALLOT_ROW_LOCK`) and that no result is `40P01`.
  - The green run passed 146 tests. Mutation (h) shows that the waits sit on the admin-row lock.
  - What is not covered by a test is in Note 4. `#fact`

### 4. Pair wait (OQ-48 b, R10, R12)

- **The exemption needs `actor_id = proposer_id`** (`P143-145`).
  - The only writer of `access_change_withdrawn` in `src` is `P244`. Its actor is `callerId`, which `P222` has already required to equal `proposer_id`.
  - `identity.events` rows cannot be edited later:
    - the trigger refuses UPDATE and DELETE (`002:92-93`);
    - the role has INSERT and no UPDATE (`002:88-90`).
  - No caller chooses an event kind. Identity events use literal kinds or `'account_'+cmd.kind` (`A250`), and neither can produce `access_change_withdrawn`. `#fact`
- **A cancel counts from the cancel.** The cancel writes `access_change_cancelled` with the admin as actor and sets `updated_at=now()` (`A299`). In `P146` that makes the closing time the moment of the cancel. H2 and H7 cover it. `#fact`
- **Racing a cancel.**
  - A cancel and a withdrawal are serialized on the admin row. Each re-reads the state under the ballot lock.
  - Race case 3 shows exactly one closing event in both orders.
  - `expired` is terminal for every writer: P15 (`P151-152`), the admin's propose (`A266-268`), the vote (`account-approval.ts:180-188` and its tally), the cancel and the withdrawal all require `pending` or `approved`.
  - So a withdrawal event can never attach to a ballot that a cancel or a rejection closed. What remains is exactly R12: a withdrawal that lands before the cancel or the rejection. `#inference`
- **Version-dead ballots.** N3 blocks buying the exemption on a ballot dead by an account change (W12). `#fact`

### 5. Audit and outbox

- **One immutable event per close, in the same transaction:** `P243-245` and `A299-301`. W1 checks that there is exactly one, and race cases 1 and 3 check it under concurrency. `#fact`
- **Payload.**
  - Withdraw: `{approvalId,reason,previousState:'pending',projectId}`.
  - Cancel: `{approvalId,reason,previousState,proposerId,frozenVersion,accountVersion}`.
  - Neither carries a token, a username or a seat.
  - The versions and `proposerId` are of the same kind that `access_change_expired` (`account-approval.ts:185-187`) and `access_change_proposed` already record.
  - `reason` is the text the person typed. The withdrawal applies the character class and `storable`; the cancel uses the shared schema.
  - Nothing in `src` reads `identity.events.detail` except the `EXISTS` of P14: the only `FROM identity.events` is `P143`. So the 3c condition of gate round 2 still holds. `#fact`
- **No DM on either path.** No outbox write appears in the source diff. Nothing is enqueued after commit, so E-INT-06 has nothing to wrap. DMs already queued stay queued (T7C-16; W1 asserts the outbox count is unchanged). `#fact`
- **The state changes only through `UPDATE(state,updated_at)`** (`P243`, `A299`), the grant at `009:69`. `#fact`

### 6. HTTP

- **Order of checks:**
  1. authentication (`H39`);
  2. origin check for every method other than GET or HEAD (`H42`);
  3. `body()`, bounded at 16 KB (`H50`, `src/server/http.ts:16-17`);
  4. the service's R0. `#fact`
- **`no-store`** is set on every answer, success (`H44`) and failure (`H53`). `#fact`
- **Error mapping.**
  - A raw `23505` becomes the generic 500 (`H33-34`). No insert on the withdraw path can raise one: the event's primary key is random.
  - `ZodError` and `SyntaxError` become 422 `INVALID_INPUT` (`http.ts:11`). `#fact`
- **The bot is refused** in the service, at `P212`. `#fact`
- **Non-uuid path id with a non-JSON body gives 422** (concern 2).
  - `body()` runs before any database read, so the answer depends only on the request bytes. It is not an existence oracle.
  - The same holds for a bot or foreign-tenant principal that sends a bad body (concern 1). `#fact`
- **Paths the handler does not serve** give the common 404, whatever the method (third HTTP case). `#fact`
- **The accounts route** checks origin and authentication (`src/app/api/team/accounts/route.ts`, POST).
  - Pre-existing, outside Task 2: the shared `failure()` puts no `no-store` on its 422 answers there.

### 7. Public repo

- Step 0 found no secrets, no local paths, no real ids or tokens, and only synthetic names («Thành viên mẫu», «Người đăng ký mẫu»). The one hygiene point is F2.

## Notes (not findings)

1. **Implementer concerns.**
   - Concern 3 is inaccurate; see F1.
   - Concerns 1, 2, 4, 5, 6 and 8 raise no security issue.
   - Concern 7 (a 1184-line red log) contains no sensitive data. Trimming it is optional.
2. **Pre-existing raw id comparison** `cmd.userId!==p.id` (`A194`). It is already recorded: plan `docs/plans/slice-3-review-skills.md:1406` (S76, item 34) and `docs/reviews/slice-3-evidence-20261115/gates/security-gate-task-7c-plan.md:21`.
   - The cancel adds no exposure through it. No `access_change` ballot can name the admin as subject:
     - the coordinator path refuses that subject at `P80`;
     - the admin path fails closed, as that gate note records.
   - So an upper-case own id reaches `APPROVAL_NOT_FOUND`. `#inference`
3. **Admin rotation.** OQ-49 (a) is implemented as «the proposer is not the current admin id» (`A296`; withdraw `P215`, `P222`).
   - If `adminId` changes, the former admin's open ballots become cancellable by the new admin.
   - They also become withdrawable by the former admin, if that person is still a member and the ballot is a pure `doc_approve` addition.
   - Both actions only close a proposal. This is worth one line under known limits.
4. **Cancel against a live BoM vote** has no native case. Only the version-dead pairing is tested. By reading it cannot deadlock (§3), and it has the same lock shape as the tested apply path. `#inference`
5. **Close events carry no `request_id` or `trace_id`** (`P245`, `A300-301`).
   - This matches every other identity event except `access_change_proposed`, which carries `traceId`.
   - E-DB-13 lists both fields for multi-tenant audit. That belongs to a later sweep across identity events.
6. **Unstorable characters in the cancel reason.** A cancel reason with NUL or a lone surrogate fails at the `jsonb` cast. The admin gets a generic 500 and the transaction rolls back. Every admin command behaves the same today.

## Three highest-leverage fixes

1. **F1:** add a per-caller throttle to `withdraw` (optionally also the unlocked early refusal), so no unthrottled path holds the account-admin row.
2. **F2:** escape the four raw characters at `tests/doc-approval-withdraw.test.ts:240-241`.
3. **Note 4:** add a native case «a cancel racing a live BoM vote», so the last lock pairing of this task is proven by a test instead of by reading.
