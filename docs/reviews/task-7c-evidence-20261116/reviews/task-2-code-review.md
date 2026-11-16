# Task 7c, Task 2: code review (ebd8e11..7ce0f56)

Recommendation only. Read-only review of the diff; I ran nothing. The native PostgreSQL and mutation results below are taken from the implementer's logs (`task-2-green.txt`: 146 passed native; mutations a-h), not re-run. They are #fact only as to what the log says.

## Spec Compliance

- ✅ `accounts.ts` is additions only (diff lines 1350-1351, 1373, 1395-1412). `proposeAccessChange` is untouched; its end is only context at 1385-1394. The `access` path is unaffected: the new dispatch (1373) sits after the propose return and before `const nextVersion`, and returns early, so only `kind==='cancel_access_change'` takes it. The new union member does not alter the others.
- ✅ `accessChangeTally`, `account-approval.ts`, `bot-plugin/`, `AGENTS.md`, `CLAUDE.md`, `failure()` and migrations do not appear in the diff.
- ✅ withdraw R0-R7, `doc-approval-proposals.ts:1500-1539`, matches the brief in order.
  - R0: the path uuid is checked before the body.
  - R1: `same(p)` (tenant, bot), then no admin or caller is admin.
  - R2: unlocked read with the five SCOPE_DENIED conditions.
  - R3: admin row `FOR KEY SHARE`, then caller `FOR SHARE` (active and activated).
  - R4: `activeProjectRole` null gives SCOPE_DENIED; a viewer passes.
  - R5: ballot `FOR UPDATE`, then closed or overdue, then version mismatch, then approved. Version is judged before approved (T7C-30).
  - R6: expire plus one event, with the payload exactly `{approvalId(lower),reason,previousState:'pending',projectId}`, `actor_id` = caller, `user_id` = subject, in the same transaction.
  - R7: returns `{approvalId,state:'withdrawn'}`.
  - Lock order follows T7C-5. The subject row is not locked and its version is a plain read.
- ✅ `cancelAccessChange` (1400-1412) matches the brief.
  - It reuses the `command` prologue (operator, FOR UPDATE on the target, validate, expectedVersion).
  - Ballot select filters on id, kind, subject and `subject_account_version=user.version`; no row gives APPROVAL_NOT_FOUND.
  - Check order is OQ-49, then closed or overdue.
  - State goes to `expired` via `UPDATE ... SET state,updated_at` only.
  - Event `access_change_cancelled` payload is `{approvalId,reason,previousState,proposerId,frozenVersion,accountVersion}`.
  - Returns `{user,invitation:undefined,cancelledApprovalId}` with the same `user` row.
  - No write to users, sessions, invitations, codes or memberships.
- ✅ HTTP (`doc-approval-http.ts:1451-1452`): only `POST` with `parts.length===2 && parts[1]==='withdraw'` is served. The path segment and the body go to the service unmerged. Everything else falls to the common 404. `noStore` wraps the answer.
- ✅ 24 h pair-wait.
  - Withdrawn ballots are exempt because the event carries a lowercase `approvalId` and `actor_id` = proposer. W8 asserts the upper-case path reaches this.
  - Cancelled ballots count from `updated_at` (state `expired`). Covered by H2 and H7, with the 25 h `updated_at` backdate.
  - W12 shows a dead ballot's refused withdrawal does not mark it, so the wait stands.
- ✅ Case inventory against the brief: W1-W12, H1-H8, the three HTTP cases and the seven concurrency cases all exist, with the brief's names and assertions. I read each and found no weakened assertion. Notable positives: W1 checks session, code, memberships, voters and outbox unchanged; W8 covers a lone surrogate, trailing LF, trimmed padding, upper-case id and the bot/other-tenant principals; W3 includes the admin-not-configured path.
- ✅ Mutations a-g are recorded with the expected red case, plus an extra native mutation (h) that drops the `KEY SHARE`. The restore is confirmed by `cmp` and `diff --stat`.
- ✅ Step 8 limits: the diff touches no forbidden file. The `proposeAccessChange` hunk check holds on this base.
- ⚠️ Cannot verify here: native PostgreSQL results (a PGlite skip would hide the race file), and the second half of mutation (g) (lower-order re-proposal), which the report says was not observed separately.
- ⚠️ The report's claim in concern 4 (H7: without the co-manager's withdraw, the coordinator would get `APPROVAL_PENDING`) depends on P14 and P15 order in `propose`, which is outside this diff. If P14 runs first the answer would be the pair-wait again. The extra step is harmless either way.

## Strengths

- Withdrawal and cancel are idempotent under race: the second caller gets APPROVAL_CLOSED. Two-withdrawal, withdraw-vs-vote, withdraw-vs-cancel and admin-change-vs-withdraw are all built with `beforeStatement` + `waitForBlocked` and assert which lock each side waits on (`ADMIN_ROW_SHARE`, `ADMIN_ROW_UPDATE`, `BALLOT_ROW_LOCK`), not just outcomes. This is real evidence for the T7C-5 order.
- Identity handling is strict: the id is lowercased on both sides and the caller is compared to the DB-returned `proposer_id`. Unknown, out-of-scope, removed and not-the-proposer cases all give the same SCOPE_DENIED, compared object for object.
- Refused commands leave `snapshot()` unchanged in every refusal case.
- Evidence logs contain only the env-var name `TASK7C_ENV_FILE`, no value or path.

## Issues

### Critical
None.

### Important
None.

### Minor
1. `doc-approval-http.ts:1452`: `await body(request)` is evaluated before `withdraw`, so a non-JSON body with a non-uuid path id returns 422, not the 404 that T7C-31 ("xét trước thân") implies at the service layer. A bot or other-tenant caller with a bad body also gets 422. This leaks nothing about any ballot and matches the call shape in the brief. The report's concerns 1 and 2 are accepted. Optional fix: check the path uuid in the handler, or parse the body lazily. No test pins the current behaviour, so a later change would be silent.
2. `doc-approval-proposals.ts:1533`: `if(locked.state!=='pending') throw APPROVAL_CLOSED()` is unreachable after the earlier state filter and the approved branch. It is harmless as a defensive guard. The R2 SELECT also reads `state` and `expires_at`, which are unused; the brief asks for them.
3. `tests/doc-approval-proposal.test.ts` has a comment-only edit (the report says one line). It is outside the Task 2 file list but not forbidden and has no behaviour effect.
4. H7 and W2: the extra withdraw step and the direct `access` command (instead of `applyFrozen`) are judged acceptable. The W2 command is the one Task 3 should keep green unchanged.
5. No throttle on `withdraw`. Not required by the brief, and each withdrawal needs an own pending ballot, which is limited by the 10-per-hour proposal cap (W9 pins it).
6. `task-2-red.txt` is 1184 lines of ZodError dumps. It is evidence, not code, and is fine to keep or trim.

## Assessment

**Task quality:** Approved

**Reasoning:** The implementation follows the brief step by step, `accounts.ts` is additions-only with the apply path unchanged, and every named case, race and mutation exists with real assertions. Only minor points remain (body parsed before the path uuid check, one dead guard); native results are as logged, not re-run here.
