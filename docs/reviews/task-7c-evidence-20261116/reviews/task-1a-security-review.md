# Security review: Task 7c, sub-task 1a (commit `6228649`, base `5bfeccb`)

Verdict: PASS

- Reviewer role: security reviewer, advisory only. The Chairman approves merges. This is the task-scoped gate for 1a. A whole-branch review comes later.
- Counts: Critical 0 · Important 0 · Minor 3. There are also four notes that are not findings: three observations and one item handed to 1b.
- Merge condition carried over from plan gate round 3: 1a must not merge without 1b. Both ship in one PR. Nothing in this review relaxes that condition. The lock-order race proof (mutation (a) and the nine native concurrency cases) is still owed by 1b.
- Method: read-only.
  - I read the review package `.superpowers/sdd/task-7c-coordinator-proposal/review-5bfeccb..6228649.diff` once.
  - I read the code it depends on at HEAD: `src/server/account-approval.ts`, `accounts.ts`, `identity.ts`, `outbox.ts`, `http.ts`, `db.ts`, and migrations 002, 009, 017, 018 and 019.
  - I ran no database test, native or PGlite. I ran one pure-function check with `tsx` from a scratch directory outside the repo, for finding M2. It imports only `grantsSchema` and `docApprovalDelta` and opens no connection.
  - I wrote nothing other than this file.
  - Line numbers are HEAD (`6228649`) file lines.
- Tags: `#fact` = read in code or command output; `#inference` = reasoned from code, not executed.

## Step 0: secrets scan

- `git ls-files | grep -Ei '\.env|secret|credential|key|token'`: no tracked file matches. `.gitignore:7-8` covers `.env*` and lets only `.env.example` through. `#fact`
- The diff contains:
  - no URL;
  - no connection string;
  - no JWT-shaped literal;
  - no number of nine digits or more, so no Telegram group-shaped id;
  - no local home path.

  The two evidence logs show `<repo>` in place of the checkout path. The native section of `task-1a-green.txt` names the env file only as `$TASK7C_ENV_FILE`. `#fact`
- Fixture identities in the diff:
  - ids come from `randomUUID()` or the existing synthetic ids;
  - names are «… mẫu»;
  - `password_hash` holds the literal `'fixture-hash'`;
  - Telegram ids `900001…` come from the existing `tests/account-approval-fixture.ts:10-12`;
  - `botKey` is `randomBytes(48)` per run (`tests/slice2-fixtures.ts:18`). `#fact`
- Files that must not change are byte-identical. `src/server/account-approval.ts` has blob `011b22b4…` at `0560a4f`, `5bfeccb` and `6228649`. `git diff --stat 0560a4f 6228649 -- src/server/account-approval.ts bot-plugin AGENTS.md CLAUDE.md migrations` is empty. `accounts.ts` changes only by the two `export ` words (`:12`, `:38`). `vitest.config.ts` gains one appended path. `#fact`

## Findings

| # | Severity | Location | Class | Evidence ref | Recommended fix | Owner role |
|---|---|---|---|---|---|---|
| M1 | Minor | `tests/doc-approval-proposal.test.ts:320`, `:323`, `:326` | Source hygiene: invisible and bidi characters written raw in a public repo (the Trojan-Source class) | Code points in string literals, typed as raw characters: U+2028, U+2029, U+202E, U+2066 and U+200D at `:320`; U+2028 at `:323`; U+2028 and U+202E at `:326`. The same file writes U+0000, U+0085 and U+D800 as `\u` escapes on the same line. `#fact` (scan by Unicode category). GitHub and most editors show these lines reordered or invisible, so a reviewer cannot see from the screen which code points the test actually sends. There is no runtime effect: the characters are test data inside quotes. The same pattern already exists at `tests/intake.test.ts:592-593` and `tests/review-ui.test.tsx:448,452`, which are out of scope. | Write the five as `' '`, `' '`, `'‮'`, `'⁦'`, `'‍'`, and the names at `:326` as `'A\nB C‮D'`. Expectations do not change. | Builder |
| M2 | Minor | `src/server/doc-approval-proposals.ts:122-126` (P11) | Fail-closed 500 instead of a refusal | Suppose a membership holds repeated permission codes: 11 entries but fewer than 11 distinct, for example two `people_read`, two `quality_review` and seven `doc_approve:*` without `design`. That `before` passes `grantsSchema` at P8. `after` then has 12 entries and fails `.max(11)` (`accounts.ts:14`), so P11 throws an internal `Error`. `#fact`: tsx run, before → `true`, after → `false`, and `docApprovalDelta` still `{added:['design']}`. The shared `failure()` turns that into a generic 500 and logs only `errorType` (`src/server/http.ts:13-14`). Nothing is written, nothing leaks, and the throttle counts it. Reachability is low: `setGrants` deduplicates on every app write (`accounts.ts:166`), so only rows written by an operations login can reach it. `#inference` | Build `after` from the deduplicated permission list, or answer INELIGIBLE at P8 when an entry repeats a code. Either way, add one row to case 18. Leaving it as is stays safe. | Builder |
| M3 | Minor | `tests/doc-approval-proposal.test.ts:209-220` (case 12), `:434` (case 28, branch P1) | Isolation test gap (AR-06, Quality Gate 34a) | The P8 contract lists «tenant khác» as an INELIGIBLE reason. Case 12 only uses a random uuid. Case 28 P1 changes the tenant of the *principal*, not the subject. No case points `userId` at a real active, activated account row of `ids.otherTenant`. Two independent barriers should give INELIGIBLE and no ballot: the `tenant_scope` RLS on `identity.users` (`migrations/002_identity.sql:68-71`, applied by `SET LOCAL ROLE` plus `set_config(...,true)` in `identity.ts:22-23`), and the `(project_id,tenant_id)` key of memberships, so a foreign account has no entry in `ids.sales`. `#inference`, not exercised by this file. `listOwn` cannot meet a foreign-tenant ballot of the caller: the composite foreign key on `proposer_id` (`migrations/009_telegram_account_approval.sql:22`) forbids it. | Add one target to case 12: seed a foreign-tenant user the way `tests/doc-approver-grant.test.ts:193` does. Expect the same INELIGIBLE answer and an unchanged `snapshot`. This can go in 1b or in the 1a fix round. | Builder |

## Checks against the code as written

### 1. Scope (OQ-33 b)

- **Input.** The command is a zod `.strict()` object with exactly `projectId`, `userId`, `docTypes`, `expectedTypes` and `reason` (`doc-approval-proposals.ts:42`).
  - `docTypes` and `expectedTypes` are `z.enum(DOC_APPROVAL_TYPES)` arrays with no repeats (`:41`).
  - No role, report permission, project list or grants can be expressed.
  - Case 20 (`tests/…:300-317`) pins the unknown keys and the `doc_approve:`-prefixed value. `#fact`
- **Caller's own project.** P4 reads the caller's role in the database before any lock: `activeProjectRole` (`identity.ts:46-52`) at `:82-84`. P6 reads it again under the lock (`:93-95`). Only `manager` passes. Case 11 refuses a manager of project A acting in project B with the same answer as an unknown project; case 17 shows the role comes from the database, not the session. `#fact`
- **Subject.**
  - The subject must be a non-viewer member of that project (`:109-110`).
  - Every project entry of the subject must be inside the account admin's scope (`:111-112`). This is the same rule as the admin path's `validate(before,scope)` (`accounts.ts:196`).
  - `before` must pass `grantsSchema` (`:112`). `#fact`
- **Frozen grants.**
  - `before` is read inside the write transaction (`:108`), after the subject row is locked (`:88-89`).
  - The only application writer of memberships is `setGrants` (`accounts.ts:162-167`). It runs inside an admin `operator` transaction, and the admin-row `FOR KEY SHARE` taken at `:86` excludes it. So `before` is the current state. `#inference` from code; the race proof is in 1b.
  - `after` is `before` plus exactly `added.map(docApprovalCode)` on the one entry (`:122-123`).
  - Before writing, P11 asserts `grantsSchema`, `docApprovalDelta(before,after)` equal to `{projectId,added}`, and `widensAccess` (`:124-126`). `docApprovalDelta` (`access-grants.ts:33-49`) returns null for any other change, and for repeated project entries.
  - Case 2 pins `docApprovalDelta(previous_grants,grants)` on the stored row; case 19 pins that other-project entries keep their values. `#fact`
- **Memberships.** This module never writes `identity.memberships`. Its only writes are the `UPDATE` of `account_approvals` and the `INSERT`s into ballots, voters and events (`:149`, `:156`, `:164`, `:167`), plus the outbox insert inside `notifyVoters`. `#fact`

### 2. Identity

- **Actor and tenant.** Both come only from the principal. `same()` (`:66-68`) refuses `p.role==='bot'` and a tenant mismatch with SCOPE_DENIED; case 17 and case 28 P1 pin both. `#fact`
  - The written `tenant_id` is always `this.identity.tenantId` (`:158`, `:165`, `:168`).
  - `proposer_id` and `actor_id` are `proposer.id` as the database returned it (`:90`, `:159`, `:168`). `#fact`
- **UUID case (M1 of the gate).**
  - `uuid` lower-cases at parse (`:30`).
  - `callerId` lower-cases `p.id` (`:74`), and `adminId()` lower-cases `identity.adminId` (`:69`).
  - The proposer and subject rows are found by comparing with the lower-cased values (`:90`, `:105`). From then on every comparison uses the ids the database returned: `proposer.id` and `subject.id` at `:93`, `:98`, `:107`, `:108`, `:113`.
  - `projectId` is matched against project ids the database returned (`:109`, `:122`). `#fact`
- **Self-proposal.** Refused at P2 before the counter (`:76`), and again on the database ids (`:107`). Case 23 (`:348-354`) covers upper and lower case. `#fact`

### 3. Voters (OQ-35 a)

- **Proposer's seat.** P7 calls `verifiedApprovalSeats(tx,identity,proposer.id)` (`:98`). That function's existing exclusion parameter (`account-approval.ts:30,37`) removes the proposer's seat before `validSeats` runs.
  - A list that is not ready becomes the coordinator sentence, which names no seat, person or Telegram (`:99-103`).
  - P7 comes before every subject check, so the answer is the same for every subject. Case 7 checks that across three subjects. `#fact`
- **Subject's seat.** It is filtered out afterwards (`:113`). Requiring a `chairman` seat and `length>=2` (`:114`) on a subset of a list that already passed `validSeats` means a chairman plus at least one BoM seat, since `validSeats` allows only chairman or BoM seats, all different (`account-approval.ts:21-27`). If the check fails, the answer is the shared INELIGIBLE sentence. Cases 8 and 9 compare it deeply with any other ineligible member and check that it contains no «ghế|BoM|Telegram». `#fact`
- **Vote and apply time.**
  - `frozenVoters` (`account-approval.ts:43-51`) needs only that each frozen voter is still a seat and is not the subject. A list that lacks the proposer's seat therefore passes when votes are cast and when the ballot is applied.
  - A proposer who holds a seat is refused by the `voters.some(v=>v.user_id===p.id)` check (`:175`).
  - Cases 6 and 30 cover this on the web path and the bot path. `#fact`
- **Tally unchanged.** `accessChangeTally` (`account-approval.ts:77-89`) is byte-identical to base, as shown in Step 0. `#fact`

### 4. Lock order versus T7C-5

`propose` takes its locks in this order:

1. Before any row lock, only plain reads: P4 `activeProjectRole` (`:82`). The throttle (`:77`) commits in its own earlier transaction (`identity.ts:30-37`).
2. The admin row, `FOR KEY SHARE`, as the first row lock (`:86`).
3. Both account rows in one `WHERE id=ANY($1) ORDER BY id FOR NO KEY UPDATE` statement (`:88-89`). In PostgreSQL the row-locking step runs after the sort, so rows lock in id order.
4. Plain reads: P6, P7, P8, P13, P14 (`:93`, `:98`, `:108`, `:111`, `:129`, `:139`).
5. Ballot rows: the P15 `UPDATE` locks the subject's dead ballots (`:149-151`).
6. The inserts (`:156`, `:164`, `:166`, `:167`).

`#fact` from code. This matches T7C-5 steps 1–4. `listOwn` takes no lock.

**No path in this diff locks in another order.** The only locks taken after the ballot rows are implicit `FOR KEY SHARE` locks on user rows, added by foreign keys:

- the chairman and BoM voters (`migrations/009_telegram_account_approval.sql:37`);
- the DM recipients (`migrations/017_outbox.sql:61`);
- the subject and proposer (`migrations/018…:27`, `009…:22`).

That is step 4 of T7C-5. `KEY SHARE` conflicts only with `FOR UPDATE`. `FOR UPDATE` on *another* person's row happens only inside an admin `operator` transaction (`accounts.ts:52`, `:193`), and the admin-row lock serializes that transaction against this one. The self-row `FOR UPDATE` paths lock only the caller's own row and hold nothing this command waits for: `login` (`identity.ts:76`), `pairingCode` (`:183`), `unlinkTelegram` (`:210`), and `pair` and `activate` (`FOR UPDATE OF … u` at `:198` and `:105`). `#inference`, with no cycle found. The race proof runs in 1b.

### 5. The 24-hour pair wait (OQ-48 b, readings A and C)

The query at `:139-146` is the plan's P14 text, character for character.

- Only ballots where `a.proposer_id=$1 AND a.subject_user_id=$2`, excluding `issued`.
- A self-withdrawal exempts the pair only through an `access_change_withdrawn` event for that `approvalId` **and** `e.actor_id=a.proposer_id` (`:141-143`, R10). Case 33 shows that an event whose actor is the admin does not exempt.
- For `rejected` or `expired` ballots the closing time is `LEAST(a.updated_at,a.expires_at)` (`:144`, C11). Case 32 tells this apart from bare `updated_at`, and the builder's mutations (e) and (f) turned cases 32 and 33 red.
- For ballots still `pending` or `approved` but dead, the closing time is `LEAST(a.expires_at,now())` (`:145`). Living open ballots never reach this query: P13 answers them first (`:129-137`).
- A refused attempt does not mark the dead ballot. Case 27 (d) pins this: the 72-hour ceiling of T7C-19 (8).
- Cancelled ballots (state `expired`, cancel event) will count from closing once Task 2 writes them; there is no exemption path for them. `#fact` for the code; `#inference` for Task 2.

In 1a, nothing writes `access_change_withdrawn`. `grep` finds the kind only in this query.

### 6. `listOwn` (OQ-50 c)

- **Membership.** It is read inside the transaction (`:182`). Any role passes. An account that was removed, disabled or never activated gets the same SCOPE_DENIED as an unknown project. Case 29 compares this deeply with a random project and with someone who never belonged (`:499-503`). `#fact`
- **Own ballots only.** The query uses `proposer_id=$1` with `callerId`, the subject's current `account_version`, open and unexpired ballots, a project filter in SQL before `LIMIT 200`, and a second-layer `docApprovalDelta(...).projectId===projectId` (`:183-197`).
- **Answer.** It returns only `approvalId`, the asked `projectId`, the subject id, `addedTypes`, `state` and `expiresAt` (`:197`). Case 19 shows no other-project id and no permission in the answer.
- **Admin.** The admin gets `[]` without a database read (`:180`). `#fact`
- **Builder concern 3: parse before the bot or tenant check.** Judged **no leak**. The 422 from `listSchema.parse` (`:177`) depends only on what the caller sent. No server state, project, membership or principal attribute is consulted before it. The order matches `propose` (P0 before P1), which the contract prescribes. On HTTP, `failure()` renders every `ZodError` as one generic `INVALID_INPUT` sentence (`src/server/http.ts:11`). No change is needed. Moving `same(p)` first in both methods would only be cosmetic. `#inference`

### 7. Text safety, audit and outbox

- **Basis (`basis`, `:34-40`), following T7C-33.**
  - On the raw string it refuses the class `[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]` (a non-global regex with the `u` flag, so `test()` keeps no `lastIndex`) and anything `storable` rejects.
  - It refuses a raw string over the cap.
  - It trims U+0020 only, then applies the floor of 5.
  - A forbidden character at either end is refused, not trimmed. Case 21 checks each character, including a trailing LF and a leading U+2028; case 20 covers the 301 cap and the padded 300.
- **Name in the frozen reason.** Forbidden characters become spaces and the name is cut to 100 code points (`:47-50`). The fixed parts are 26 and 73 code points, so the longest reason is 473, within the database CHECK of 5–500 (`migrations/009…:17`). Case 22 inserts 473. `#fact`
- **Same transaction.** The audit event (`:167-169`) and the DMs (`:166`, which reaches `enqueueDm` with the transaction, `outbox.ts:80-85`) are both written in the `identity.scope` transaction (E-INT-06).
- **DM payload.** It is `{params:{}}`. Case 4 pins equality with the admin path, and that the payload contains no name, code or ballot id.
- **Event detail.** It carries `before`, `after`, the frozen `reason` and a random `traceId`. That is the admin path's shape plus `via`, `projectId`, `addedTypes` and `subjectIsCoordinator` (`accounts.ts:278-279`). There is no token or secret, and the module never writes to the console or a log. `#fact`

### 8. Error answers

Every refusal uses a fixed sentence (`:18-25`, `:100-101`, `:118`, `:120`, `:136`, `:147`, `:161`). None interpolates a seat, a name, an account version, a username or another project.

- The internal P11 error is a fixed English string that `failure()` hides behind the generic 500.
- `APPROVERS_NOT_READY` replaces the seat-naming sentence of `verifiedApprovalSeats` (`account-approval.ts:39`) with the coordinator sentence.
- `APPROVAL_PENDING` names no content of the other ballot (accepted residual 1). `#fact`

### 9. Fixtures

These use synthetic ids and names only; see Step 0. The new world is rebuilt for every case (`tests/doc-approval-proposal.test.ts:17-18`). No real Telegram group id, token or URL appears. `#fact`. The one hygiene point is M1.

## Notes (not findings)

- **N1, observation.** P3b refuses «subject is the account admin» with INELIGIBLE (`:78`) before P7 (`:97-103`). So when the seat list is not ready, the admin's uuid gets INELIGIBLE while every other subject gets APPROVERS_NOT_READY. This follows the contract's order (R6 of round 1 put P3b after the counter and before any lock, and P7 is under the lock). It reveals only which uuid is the account admin, who is structurally the holder of the chairman seat. No change is recommended. If the Chairman wants T7C-3 (i) to hold literally, that needs a plan change, not a code fix.
- **N2, observation.** Residuals that the plan accepted, are present as designed, and were not re-litigated here:
  - `APPROVAL_PENDING` discloses that another open ballot exists;
  - the seat residual of T7C-3;
  - the user-chosen name at the head of the frozen reason (T7C-21, pinned by case 21);
  - the proposer sees `approved` (OQ-52).
- **N3, observation.** Native evidence: the session appended a run of 8 files, 101 passed (`docs/reviews/task-7c-evidence-20261116/task-1a-green.txt:44-52`). I did not re-run it; the shared container was off-limits.
- **H1, for 1b.** Following T7C-22, the service rethrows any `23505` from the voter or outbox inserts unchanged (`:161-162`). The shared `failure()` renders every raw `23505` as `DUPLICATE_CODE` «Mã việc đã tồn tại trong dự án.» 409 (`src/server/http.ts:12`). That leaks nothing but gives a sentence from the wrong domain. In practice it is unreachable: a fresh ballot id cannot collide with existing voter rows, and `enqueueDm` uses `ON CONFLICT DO NOTHING` (`outbox.ts:83`). The 1b handler should decide whether to keep that rendering or wrap it as a 500. It must not edit `failure()` (T7C-24).

## Three highest-leverage fixes

1. **M3.** Add one foreign-tenant subject row to case 12. This is the only isolation direction of this module that no test exercises, and AR-06 requires 100%.
2. **M1.** Replace the raw bidi and format characters in the test source with `\u` escapes. In a public repo they make the test unreadable to reviewers, and they are the pattern code review should be able to catch.
3. **M2.** Deduplicate when building `after`, or refuse repeated codes with INELIGIBLE, so that data from an operations login gets a refusal rather than a 500.

None of the three blocks 1b. They fit in the 1a fix round the session has planned.
