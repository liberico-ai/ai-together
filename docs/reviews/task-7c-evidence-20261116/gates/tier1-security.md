# Tier-1 security review: Task 7c, whole branch (`460653e..53b3277`)

Verdict: READY WITH FIXES

- Reviewer role: security reviewer, advisory only. The Chairman approves merges. This is the whole-branch gate that runs before the Codex gate.
- Counts: Critical 0 · Important 1 · Minor 1. Seven notes follow that are not findings. Scale: Critical = P0, Important = P1, Minor = P2/P3.
- Must fix before merge: F1 only. None of the deferred minors in the ledger belongs in that group (see the triage table).
- Method: read-only.
  - Range: base `460653e`, head `53b3277`, branch `task-7c-coordinator-proposal`. 65 files, +14506/−48. The repo is temporarily PUBLIC, so I applied the public-repo rules.
  - Code I read at HEAD:
    - `src/server/doc-approval-proposals.ts` (all 252 lines), `doc-approval-http.ts`, `accounts.ts` (`operator`, `list`, `openAccessChange`, `access` apply, `cancelAccessChange`), `access-grants.ts` (`docApprovalDelta`), `identity.ts` (`scope`, `throttle`, `activeProjectRole`, `login`, `requestRegistration`, `identityService`), `review-page.ts`, `db.ts`;
    - the route `src/app/api/team/doc-approvals/[[...path]]/route.ts`, `src/app/review/page.tsx`;
    - `src/components/doc-approval-proposals.tsx`, `team-accounts.tsx`, `approvals.tsx`, `review.tsx` (the proposal command and reload);
    - unchanged code the new paths depend on: `account-approval.ts` (vote, tally, `frozenVoters`), `bridge.ts`, migrations 002, 004, 009 and 018.
  - `git diff --stat 460653e 53b3277` is empty for `account-approval.ts`, `bridge.ts`, bridge auth, `bot-plugin`, `migrations`, `AGENTS.md`, `CLAUDE.md`, `src/proxy.ts`, `http.ts`, `auth.ts`, `db.ts` and `src/app/team`. `#fact`
  - Tests: I read the five new doc-approval test files at the cited lines, the two concurrency files by case title, `tests/identity.test.ts`, `tests/rls-catalog.test.ts` and `tests/doc-approver-grant.test.ts:188-206`.
  - Plan and ledger: `docs/plans/task-7c-coordinator-proposal.md` (Global Constraints lock order, T7C-3 to T7C-9, T7C-21, T7C-24, «Giới hạn đã biết» items 1–10), the deferred items in the progress ledger, and the Task 1a to Task 4 security reviews in `reviews/`.
  - Evidence: `task-5-native.txt`, `task-5-pglite.txt`, `task-5-pglite-verbose.txt`, `task-5-negative-cases.md` and `manifest.json`.
    - Native: 1143 tests passed in 75 files.
    - PGlite: 1086 passed and 57 skipped.
    - The only `40P01` in the logs is a log header. «deadlock» appears only in test titles. No statement timeout appears. `#fact`
  - I ran no test. Every check below comes from code reading, git output or the committed evidence logs.
  - I did not read `.runtime/` or any `.env*` file. I printed no process command line.
  - I wrote only this file. My scan files are in the session scratchpad, outside the repo.
- Line numbers: HEAD `53b3277`. `P…` means `src/server/doc-approval-proposals.ts`, `A…` means `src/server/accounts.ts`, `H…` means `src/server/doc-approval-http.ts`, and `T…` means `src/components/team-accounts.tsx`.
- Tags: `#fact` means I read it in code or command output. `#inference` means I reasoned it from code and did not execute it.

## Step 0: secrets scan

- `git ls-files | grep -Ei '\.env|secret|credential|key|token'` returns no match (exit 1). `#fact`
- `.gitignore`:
  - lines 7-8 hold `.env*` and `!.env.example`, and no `.env.example` is tracked at HEAD;
  - line 30 ignores `.superpowers/`, and no file under it is tracked;
  - the working tree held one untracked file when I started, `gates/tier1-code.md`, which another reviewer wrote. `#fact`
- No secret-class file is added in `460653e..53b3277`. `#fact`
- The chat-id check command from the brief returns nothing (exit 1). `#fact`
- Scan of the 14506 added lines:
  - no absolute local path, and no home-directory or tmp path;
  - URLs: only loopback `http://127.0.0.1:3147` (5), the reserved `https://evil.example` (5) and `https://react.dev` (104, the React warning links in the task-5 logs);
  - token-shaped strings: only the redactor-test labels «redact timing … xoxb- / -----BEGIN» in `task-5-native.txt` and `task-5-pglite-verbose.txt`. They are prefixes that the redactor test feeds in, not secrets;
  - env names: only `TASK7C_ENV_FILE`;
  - no email address and no handle;
  - the only long digit run is the synthetic `-100000000000`;
  - the personal-name hits are false positives, the Vietnamese word «khuyến» in `docs/OPEN-QUESTIONS.md` and the plan;
  - infrastructure: only `127.0.0.1:3147`. `#fact`
- Hidden characters: a scan of all 65 files for Cf characters, U+2028, U+2029, U+0085 and C0/C1 controls finds 0. I checked the scanner first against a probe file that held U+202E and U+2028. `#fact`
- `manifest.json` is redacted: it shows `<repo>` in place of the checkout path, holds no environment values, and records «bidi … 0 found». `#fact`
- Not inspected, by instruction: the content of the historical `.env.example`. It is outside this range, and the Task 1b review already recorded it.

Step 0 result: clean for this range.

## Findings

| # | Severity | Location | Class | Evidence ref | Recommended fix | Owner role |
|---|---|---|---|---|---|---|
| F1 | Important (P1) | `tests/identity.test.ts:52-59`; no case for the new ballot queries in `P178-251`, `A70-84`, `A337-349`, `P130-149` | Tenant isolation: test gap (AR-06, Quality Gate 34a, 34c, 34d). Not exploitable. | the loop at `identity.test.ts:54` covers 9 tables and none of the 4 tables from migration 009 | Add one foreign-ballot isolation case and extend the loop (details below) | Builder |
| F2 | Minor (P3) | `src/components/doc-approval-proposals.tsx:89`; `src/components/approvals.tsx:25,30`; `src/server/identity.ts:83` | Display spoofing: a name with no bidi isolation, and no character class on registration names | `<option>{m.name} · …</option>`; `Căn cứ: {item.reason}` with no `bdi` | Character class for names at registration and invite; `bdi` on the /approvals reason; isolate or strip the option text | Builder |

### F1 (Important, P1): no runtime case shows RLS hiding another tenant's ballots on the new paths

What exists:
- `tests/rls-catalog.test.ts:25-40` checks the catalog. Every table from 013 on, `identity.account_approvals` included, has ENABLE, FORCE, a policy, `USING` and `WITH CHECK`. This pins the shape of the policy, not its effect on a query. `#fact`
- `tests/identity.test.ts:52-59` runs an `IdentityService` of another tenant over the identity tables and expects 0 rows. Its list (`:54`) is `users, memberships, invitations, sessions, throttle, telegram_codes, telegram_links, events, bridge_nonces`. The four tables from migration 009 are not in it: `account_approval_seats`, `account_approvals`, `account_approval_voters`, `account_approval_votes`. `#fact`
- The branch's tenant cases stop at the application guard:
  - propose: a principal of another tenant (`tests/doc-approval-proposal.test.ts:438`); a real subject account from another tenant (`:213-223`);
  - withdraw: a principal of another tenant (`tests/doc-approval-withdraw.test.ts:260`);
  - list and apply: principals of another tenant (`tests/doc-approval-apply.test.ts:222`, `:267`);
  - HTTP: GET and HEAD as the bot or another tenant (`tests/doc-approval-proposal-http.test.ts:130`). `#fact`
  - All of these are refused by `same(p)` (`P68-70`), by `operator` (`A57-63`) or by membership logic before any ballot row of another tenant is in play. `#fact`
- `tests/doc-approver-grant.test.ts:188-206` (native) shows that a ballot of another tenant does not count for the membership guard. It does not reach `listOwn`, `withdraw`, `cancelAccessChange` or the admin list. `#fact`

What is missing, by Quality Gate item:

| Path | Read (34a) | Close (34c) | No context (34d) |
|---|---|---|---|
| `listOwn` (`P178-203`) | missing: no case with another tenant's open ballot present in the same project id space | n/a | missing |
| `withdraw` R2 and R5 (`P208-251`) | missing: a ballot id from another tenant | missing: state and snapshot unchanged after the refusal | missing |
| `cancelAccessChange` (`A337-349`) | missing: a ballot id from another tenant | missing | missing |
| admin `list` / `openAccessChange` (`A70-84`) | missing: another tenant's ballot must not show | n/a | missing |
| propose P13 open-ballot check and P14 pair wait (`P130-149`) | missing: another tenant's `access_change_withdrawn` event must not exempt a ballot from the wait | n/a | missing |

- P14 is where the gap matters most. Its exemption subquery reads `identity.events` by `user_id`, `kind`, `detail->>'approvalId'` and `actor_id`, with no tenant predicate (`P141-147`). `identity.events` has no foreign key, so RLS is the only tenant boundary on that read. `#fact`

- 34b (write with another tenant's `tenant_id`): every new insert takes `tenant_id` from `this.identity.tenantId`, never from the body, and the catalog test pins `WITH CHECK`. I count 34b as covered for this branch. `#fact` for the code, `#inference` for the effect.
- 34e (bypass): `assertRestrictedLogin` (`src/server/db.ts:20`) refuses superuser, BYPASSRLS and table-owner logins, and `scope` sets `SET LOCAL ROLE libetech_identity`. Not changed by this branch. `#fact`

Why it is not exploitable today (`#inference`):
- `users.id` is a global uuid primary key.
- The composite foreign keys `(proposer_id, tenant_id)` and `(subject_user_id, tenant_id)` tie a ballot to its tenant.
- The withdraw path checks proposer equality, and cancel filters by subject and version.
- The P14 exemption needs an event whose `approvalId` names the ballot. Only the server writes events, and ballot ids are server-made uuids, so another tenant cannot plant one without write access.
- The policy at `migrations/009_telegram_account_approval.sql:60-62` makes a missing `app.tenant_id` yield NULL, so a query with no context sees nothing.

Why it is still P1: Quality Gate §I lists 34a to 34e as MUST before merge, and AR-06 asks for 100 % isolation coverage. If someone later moves one of these queries off the scoped connection, or drops the tenant join, no test in this branch would turn red. The rulings in this session on Task 1a M3, Task 1b M2 and Task 3 F2 treated the same class the same way.

Fix (Builder), as one new test file or a block in `tests/doc-approval-withdraw.test.ts`, native and PGlite:
1. Through the operator, build a world in another tenant: user, project, membership, and a pending `access_change` ballot whose proposer is a coordinator of that tenant.
2. As tenant A (service and principal), aim at the foreign ballot id:
   - `withdraw` answers `SCOPE_DENIED`;
   - `cancel_access_change` answers `APPROVAL_NOT_FOUND`;
   - neither `listOwn` nor the admin list shows it;
   - the foreign ballot's state, version and event count are unchanged afterwards.
3. As tenant B, run `listOwn` and `withdraw` against tenant A's ballot, with the same answers and no change.
4. Through the operator, insert into tenant B an `access_change_withdrawn` event whose `user_id`, `actor_id` and `detail.approvalId` name a closed tenant-A ballot that is still inside its wait. A tenant-A re-propose for that pair must still answer RATE_LIMITED (P14).
5. Add `account_approval_seats`, `account_approvals`, `account_approval_voters` and `account_approval_votes` to the loop at `tests/identity.test.ts:54`.
6. One no-context case: under `SET LOCAL ROLE libetech_identity` with no `app.tenant_id`, `SELECT` from `identity.account_approvals` returns 0 rows.

### F2 (Minor, P3): names shown without bidi isolation, and no character class on names

- New in this branch: the member picker renders `{m.name} · {roleLabel(m.role)}` inside an `<option>` (`src/components/doc-approval-proposals.tsx:89`). `<bdi>` has no effect inside `<option>`, and React escapes only HTML, not bidi controls. The base already had the same pattern at `src/components/review.tsx:95`. `#fact`
- Pre-existing: /approvals renders the subject name (`src/components/approvals.tsx:25`) and `Căn cứ: {item.reason}` (`:30`) without `bdi`. This branch makes the second one more relevant, because a coordinator ballot's frozen reason starts with the proposer's name (T7C-21). `#fact`
- Root cause: the registration name schema is `z.string().trim().min(2).max(100)` (`src/server/identity.ts:83`), with no character class. A registered name can hold U+202E and reorder the rest of an option line or of a /approvals line. `#fact` for the schema, `#inference` for the rendering.
- Limits that already hold: `reasonPrefix` (P12) strips Cc, Cf, Zl and Zp from the name it writes into the frozen reason, and the coordinator's own basis is stripped the same way, so only strong right-to-left letters can reach the reason. The rows on /review and the /team reason are inside `<bdi dir="auto">` (`doc-approval-proposals.tsx:55`, `T65`). `#fact`
- Impact: a member who controls their own display name can make one line look different to a reviewer. No control changes, and the server checks ids, not names. `#inference`
- Fix: a character class for names at registration and at invitation (follow-up); `bdi dir="auto"` around `item.reason` and `item.name` on /approvals (a cheap fix in this PR, since the branch already touches `approvals.tsx`); wrap the option text in U+2068 … U+2069, or strip Cf before display.

## Checks that passed

### Authorization, web and bot

- A coordinator cannot propose for themself in any letter case. The uuids are lowercased at parse, compared at P2 before the DB, and compared again after the lock. `#fact`
- The admin is refused on the coordinator path (P2), and the subject cannot be the admin (P3b). `#fact`
- The proposer's seat is removed from the voters at P7 (`verifiedApprovalSeats(tx, identity, proposer.id)`), and the subject is removed at P8. At vote time, `frozenVoters` admits only a voter in the frozen set, and a reassigned seat answers APPROVERS_CHANGED. `#fact`
- The bot is refused by `same(p)` in all three service methods and by `operator`. `users.role` has a CHECK that excludes `bot`. The bridge is unchanged and still exposes four operations, with the vote running as the linked human principal. `#fact`
- No identity or tenant comes from JSON. Every body schema is strict (forged keys are refused at `tests/doc-approval-proposal.test.ts:305` and `tests/doc-approval-withdraw.test.ts:243-263`). The ballot id comes from the path, and actor and tenant come from the session. `#fact`
- Answers reveal only project-scoped data: `listOwn` answers SCOPE_DENIED when the caller holds no active role in the project, and a non-proposer gets SCOPE_DENIED on withdraw (R2). The leak that an open ballot exists, through APPROVAL_PENDING, is accepted as known limit 10. `#fact`
- `doc-approval-http.ts`: authentication runs first, then the origin check for every method except GET and HEAD. Every answer is `no-store`. A raw 23505 maps to a generic 500, not to DUPLICATE_CODE (T7C-24). `#fact`

### Tenant isolation (AR-06, Quality Gate 34a to 34e)

- Application guards hold on every new path, and the cases above show it. `#fact`
- The DB-layer runtime cases are missing. See F1, whose table lists them path by path.

### Lock order and availability

- Every coordinator write takes the admin row FOR KEY SHARE first (`P88`, `P230`). Admin commands take the admin row FOR UPDATE first (`A57-63`). `#fact`
- Propose then locks both user rows in id order (`P90-91`, `ORDER BY id FOR NO KEY UPDATE`). Withdraw takes the caller FOR SHARE (`P231`) and then the ballot FOR UPDATE (`P236`). Inserts come last. `#fact`
- The vote (unchanged) locks the ballot first, then takes KEY SHARE on the voter row through the votes foreign key. KEY SHARE does not conflict with FOR SHARE or FOR NO KEY UPDATE. `#fact` for the code, `#inference` for the lock table.
- I found no cycle. One cycle is accepted (T7C-5 f): the Chairman, who is the admin, votes while running their own cancel or apply, and one side can get 40P01. `#inference`
- Starvation of the admin row (the Task 2 F1 class): a new KEY SHARE does not queue behind a waiting FOR UPDATE, so a stream of coordinator writes could hold the admin off. That stream is bounded:
  - propose (`P79`) and withdraw (`P218`) throttle at 10 per hour per caller before any lock;
  - the throttle commits in its own transaction, so a refusal still counts;
  - only active managers, and only for their own ballots, reach a lock;
  - `listOwn` takes no lock. `#fact` for the code, `#inference` for the bound.
- `statement_timeout` is 10 s on the identity pool (`src/server/db.ts:32`). The new queries are small. The P14 `EXISTS` runs over one subject's events. `#inference`

### Ballot integrity

- The server builds the frozen grants (P11): the requested codes are added to exactly one existing project entry, and `docApprovalDelta` must accept the result. Otherwise the server answers 500 and writes nothing. `#fact`
- At apply, `sameGrants` must hold for both grant sets, `docApprovalDelta` must be non-null for a non-admin proposer, and a stale `proposerIsCoordinator` answers VERSION_CONFLICT. A ballot widened beyond `doc_approve` is refused (A2 in the apply tests). `#fact`
- The only writer of memberships is `setGrants` (`A195-199`), called at `A183` and `A267`. `#fact`
- Pair wait (OQ-48 b):
  - only withdraw writes `access_change_withdrawn`, only on a pending ballot, and in the same transaction that closes it;
  - a cancel closes with `access_change_cancelled`, so the 24 h wait starts at the cancel;
  - a withdraw after a cancel answers APPROVAL_CLOSED;
  - a race between withdraw and cancel is serialized on the admin row (known limit R12);
  - a version-dead ballot cannot be withdrawn (N3);
  - withdraw and re-propose cycles are allowed by decision and bounded at 10 per hour. The DMs they cause are covered by known limits 1 and 4. `#fact`

### Audit

- Each write adds one event to `identity.events`, which is immutable: the trigger at `migrations/002_identity.sql:92-93` refuses UPDATE and DELETE. The events are `access_change_proposed`, `access_change_withdrawn` and `access_change_cancelled`, and apply records proposedBy and proposerNoLongerCoordinator. `#fact`
- A refused action rolls back and writes nothing. The one exception is the throttle counter, which commits by design. `#fact`
- The new fields hold no phone, email or CCCD. Names appear only in the frozen reason (T7C-21). `#fact`
- The close events carry no request_id or trace_id (E-DB-13). The pattern is older than this branch, so I list it as a note and not a finding.

### UI

- All text is escaped React text. The rows on /review and the reason on /team are inside `<bdi dir="auto">`. `#fact`
- No control grants anything by itself: every action goes to the server, and the server checks it. `#fact`
- /review has no `<form>`, and every button there is `type="button"`, so Enter cannot fire an irreversible action. `#fact`
- `AccountForm` starts with a hidden, disabled submit button (`T114`). A disabled default button blocks implicit submission, so Enter in the ballot's reason field cannot apply or cancel. This follows the HTML spec; I did not try it in a browser. `#inference`
- The registration-form Enter pattern is logged as a follow-up, but the pointer is stale. See the triage table.

### Public-repo hygiene

- Clean across all 65 files. See Step 0.

## Triage of the deferred minors in the ledger

| Item | Source | Group | Reason |
|---|---|---|---|
| F1 above | this review | **Must fix before merge** | Quality Gate 34a, 34c and 34d are MUST |
| H1 replacement logs `errorType: 'Error'`; give it a named error class | Task 1b security N6 | Cheap fix in this PR | E-OBS-01; a one-line change makes the 500 traceable |
| Native case «cancel racing a live BoM vote» | Task 2 Note 4 | Cheap fix in this PR | The 7 withdraw/cancel and 9 proposal race cases do not cover it; the lock order says it serializes on the ballot |
| `bdi` on the /approvals reason and name | F2 above | Cheap fix in this PR (optional) | The branch already touches `approvals.tsx` |
| P5 has no tenant predicate | Task 1a code Minor 7 | Known limit | RLS plus the composite foreign keys; F1's case will pin it |
| P11 answers 500 on an internal assertion | Task 1a security M2, code Minor 8 | Known limit | Fails closed and writes nothing |
| Case 19 cannot fail | Task 1a code Minor 6 | Known limit | Test quality, not exposure |
| 503 before dispatch | Task 1b code Minor 3 | Known limit | No oracle |
| A repeated query parameter answers 422 | Task 1b code Minor 4 | Known limit | No oracle |
| The body is read before the path id is checked | Task 2 | Known limit | Answers 422 with no oracle |
| An unreachable guard | Task 2 | Known limit | Dead code, no exposure |
| Admin rotation and ballots of a former admin | Task 2 Note 3, Task 3 | Known limit | `validSeats` requires the chairman seat to be the current admin |
| request_id and trace_id missing from audit events | Task 2 Note 5, Task 3 | Known limit, repo-wide | E-DB-13 follow-up for the whole repo |
| A NUL in the cancel reason answers 500 | Task 2 Note 6, known limit 5 | Known limit | Fails closed |
| Registration form on /team: Enter submits the first submit button | Task 3 | Known limit, follow-up; **fix before go-live** | Pre-existing (base lines 108-121). The ledger cites `team-accounts.tsx:173-177`, which is stale; at HEAD the form is at `T199-213`. Enter in «Căn cứ xác nhận hoặc từ chối» fires «Từ chối» while a ballot is pending, and «Đủ anh + 1 BoM · Tạo lời mời» when it is approved. A hidden disabled first submit, as at `T114`, fixes it in one line. |
| A ballot widened through the operations login shows «Phiếu vẫn áp được» | Task 3 | Known limit | The server refuses it at apply |
| The Enter guard is pinned only by static markup | Task 3 | Known limit | Check by hand in a browser at staging |
| Per-account reads under the admin FOR UPDATE | Task 3 | Known limit | Bounded by the number of accounts in the tenant (`#inference`) |
| E-OBS-01 log fields | Task 4 I2 | Known limit, repo-wide | — |
| Several «Rút phiếu» buttons share one accessible name | Task 4 | Known limit | A wrong withdrawal can be undone under OQ-48 b |
| A stale `withdrawId` | Task 4 | Known limit | No path reaches the wrong ballot |

## Notes (not findings)

1. **Refusals are not logged.** `failure()` logs only unexpected errors, so probing leaves only a hashed throttle counter behind. This is repo-wide. A refusal log line without PII would help detection. `#fact`
2. **The identity pool is shared.** It has 10 connections, also used for session lookups. Coordinator writes that wait on the admin row hold connections while they wait. The throttles bound this. `#inference`
3. **P5 locks two rows before checking eligibility.** It takes NO KEY UPDATE on the caller and on any uuid the caller sends, before the subject check. The plan mandates this, it is throttled, and RLS limits it to the tenant. `#fact`
4. **Admin rotation.** A ballot outlives a change of admin only as far as `validSeats` allows. Covered by the Task 2 and Task 3 notes.
5. **The Chairman-vote 40P01.** Accepted under T7C-5 f.
6. **The historical `.env.example`.** Not inspected, by instruction.
7. **Order of the follow-ups.** The registration-name character class (F2) and the registration-form Enter fix are both small and both pre-existing. Doing them together before go-live closes both classes on /team and /approvals.

## Three highest-leverage fixes

1. **F1:** one foreign-ballot isolation case plus the four 009 tables in the identity loop and a no-context check. This closes the only MUST gap. Builder.
2. **Registration form Enter:** add a hidden disabled first submit at `T199`. It is one line and stops Enter from rejecting a request or issuing an invitation. Builder, before go-live.
3. **Names:** a character class at registration and invitation, plus `bdi` on /approvals. This removes the F2 class at its source. Builder; the `bdi` part can ride in this PR.
