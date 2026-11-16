# Task 7c: tier-1 code review and final whole-branch review

- Branch `task-7c-coordinator-proposal`, range `460653e..53b3277`. The code head is `0c7ab7f`, as `manifest.json` records; `53b3277` adds only logs.
- Package: `.superpowers/sdd/task-7c-coordinator-proposal/review-branch-460653e..53b3277.diff`.
- Measured against:
  - plan v0.4 (`docs/plans/task-7c-coordinator-proposal.md`);
  - OQ-33..38 and OQ-48..52;
  - `AGENTS.md`;
  - Engineering Standards;
  - Quality Gate §I, including 34a–e.
- Ledger: `.superpowers/sdd/task-7c-coordinator-proposal/progress.md`.
- Reviewer: liberico-code-reviewer (opus). This review is advisory. Merge authority stays with the Chairman.
- Evidence relied on, not re-run:
  - `task-5-pglite.txt`: 1086 passed, 57 skipped.
  - `task-5-native.txt`: 1143 passed, 0 skipped, no 40P01.
  - `task-5-coverage.txt`, `task-5-limits.txt`, `task-5-negative-cases.md`, `manifest.json`.
  - No focused test was run; no doubt needed one.
- Tags:
  - `#fact`: read in the repo at the cited line.
  - `#inference`: reasoned from code I read.

## Strengths

1. **One lock order across every new writer, and proven** (#fact).
   - The order is: admin row, then user rows, then the ballot, then inserts.
   - `propose`:
     - admin row `FOR KEY SHARE` (`src/server/doc-approval-proposals.ts:88`);
     - then {caller, subject} in one `ORDER BY id FOR NO KEY UPDATE`;
     - then the ballot.
   - `withdraw`: admin row `FOR KEY SHARE` (`:230`), caller row `FOR SHARE` (`:231`), ballot `FOR UPDATE` (`:236`).
   - The admin `operator`: admin row `FOR UPDATE` (`src/server/accounts.ts:60`), subject row `FOR UPDATE` (`:226`), ballot `FOR UPDATE` (`:340`).
   - The lock modes fit the vote path (#inference):
     - `FOR NO KEY UPDATE` and `FOR SHARE` both stay compatible with the FK `KEY SHARE` that a vote insert takes on the voter row.
     - So a vote never waits on a coordinator's user-row lock.
   - The native races use `beforeStatement` / `waitForBlocked`, not sleeps, and the native log has no 40P01.
2. **Refusals fail closed, in a deliberate order** (#fact).
   - The service judges the path id before the body (R0, `:209-211`).
   - Both throttles run before any lock (`:79`, `:218`). They commit on their own, so refused attempts count.
   - A missing admin and an admin subject give one INELIGIBLE sentence, which hides who the admin is (T7C-23).
   - The admin cannot withdraw an own ballot (`:215`), which keeps OQ-49 (a) intact.
3. **Error codes and UI sentences line up.**
   - Every code in `FIXED` (`src/components/doc-approval-view.ts:110-116`) is one the service throws, with the same sentence.
   - Every other code shows the server's sentence, so `DOC_APPROVAL_PROPOSAL_INVALID` and `RATE_LIMITED` lose none of their variants (T7C-35).
   - H1 (`src/server/doc-approval-http.ts:33-34`) stops a stray 23505 from a voter or outbox insert from being reported as `DUPLICATE_CODE`.
4. **The account admin's path is byte-identical.**
   - The `proposeAccessChange` body is untouched, and its md5 equals the one at base.
   - `account-approval.ts`, migrations, the bot plugin and the protected tests are untouched (`task-5-limits.txt`).
5. **Strict input everywhere.**
   - Strict zod schemas.
   - UUIDs lower-cased at parse.
   - A repeated query parameter is refused.
   - `no-store` on every answer.
   - The basis check runs on the raw string (forbidden classes, then the cap, then the floor).
   - The client mirrors the server's sentences, so a refusal reads the same either way.
6. **The UI keeps what a person typed and keeps focus.**
   - `proposalFailure` always keeps the draft.
   - `settledDraft` (`doc-approval-view.ts:51-55`) clears only fields still equal to what was sent.
   - Focus returns where it should after the withdraw box and after a successful withdrawal.
   - The /team account form has a disabled hidden default submit (`src/components/team-accounts.tsx:114`), so Enter never applies or cancels a ballot.
7. **The tests are behavioural.**
   - Mutation-checked cases in the ledger rounds.
   - A7, the stale-standing case of `tests/doc-approval-apply.test.ts`, pins OQ-37 (c) end to end.
   - The PGlite/native split rests on an invariant (PGlite passed + skipped = native passed), not on a count.
   - Coverage: overall 96.44 / 91.66 / 98.02 / 97.69; `doc-approval-proposals.ts` 96.56 / 91.83 / 100 / 99.25; `doc-approval-http.ts` and `access-grants.ts` 100.
8. **`docs/UI-HANDOFF-3-doc-approval.md` matches the code.** It covers the states, props, copy, focus rules and the request bodies. One nit is noted under M6.

## Issues

### Critical (P0)

None.

### Important (P1)

**I-1. No case reaches a ballot row of another tenant, and the negative-case table has no row for Quality Gate 34a–e.**

- **Where:**
  - `tests/doc-approval-withdraw.test.ts:260`
  - `tests/doc-approval-apply.test.ts:222`, `:267`
  - `tests/doc-approval-proposal-http.test.ts:130`
  - `tests/doc-approval-proposal.test.ts:213-216`, `:438`
  - `docs/reviews/task-7c-evidence-20261116/task-5-negative-cases.md`: 33 rows, none for tenant isolation.
- **What** (#fact): these are the branch's tenant cases. Each one is one of two kinds:
  - a principal whose `tenantId` is foreign, which the app-level `same()`/`invariant` refuses before any SQL runs;
  - a foreign-tenant subject account.

  No case creates an `account_approvals` row in `ids.otherTenant` and then shows what the branch's new queries do with it:
  - `withdraw` R2/R5/R6 select and update by `WHERE id=$1` only (`src/server/doc-approval-proposals.ts:223`, `:236`, `:246`);
  - `listOwn` (`:186-193`);
  - `cancel_access_change` (`src/server/accounts.ts:340`);
  - the admin `list` and `openAccessChange` (`accounts.ts:79`, `:89-104`);
  - the P14 and P15 reads.
- **Why it matters:**
  - Quality Gate 34a (read) and 34c (cross-tenant update gives 0 rows, not a silent success) are MUST for every multi-tenant query.
  - The session's standing ruling grades tenant-isolation test gaps Important, as with 1a M3 and Task 3 F2. This gap is the same kind and is new.
- **Exploitability is nil** (#inference). Three barriers stand:
  - RLS under `SET LOCAL ROLE libetech_identity` with `app.tenant_id`, with ENABLE + FORCE asserted by `tests/rls-catalog.test.ts:25`;
  - composite FKs `(proposer_id, tenant_id)` and `(subject_user_id, tenant_id)` (`migrations/009_telegram_account_approval.sql:22`);
  - predicates on global UUIDs (`row.proposer_id!==callerId` at `:225`, `a.proposer_id=$1` at `:189`, `subject_user_id=$2` at `accounts.ts:340`).

  So this is a gap in evidence, not a leak. One more point: `libetech_identity` is created `NOBYPASSRLS` only when it does not already exist (`migrations/002_identity.sql:4-8`), and `tests/slice1-harness.test.ts:26` checks the login role, not this role. Only a behavioural read under `scope` proves that the role the branch actually queries as is filtered.
- **Fix** (one `it` and one table row): seed in `ids.otherTenant` through `w.h.operator`, as `doc-approval-proposal.test.ts:213-216` already does for a user. Seed a coordinator, a subject, a membership and a `pending` `access_change` ballot. Then assert:
  - (a) `withdraw(w.coordinator, foreignId, {reason})` gives `SCOPE_DENIED` 404. The row is still `pending` and has no `access_change_withdrawn` event (34c).
  - (b) `listOwn` for `w.coordinator` does not contain `foreignId` (34a).
  - (c) the admin's `cancel_access_change` with `approvalId: foreignId` gives `APPROVAL_NOT_FOUND` 404, and the row is unchanged (34c).
  - (d) inside `identity.scope`, `SELECT count(*) FROM identity.account_approvals WHERE id=$1` with `foreignId` returns 0. Under the predicates of (a)–(c), only (d) turns red when RLS or FORCE is removed, so (d) is the mutation-proof one.
  - Optionally (e): the same select with `SET LOCAL ROLE libetech_identity` and no `set_config` returns 0 (34d).

  Then add a 34a–e row to `task-5-negative-cases.md`:
  - 34a: (b), (d)
  - 34b: `rls-catalog.test.ts:25` (WITH CHECK present) and `doc-approval-proposal.test.ts:213-216`
  - 34c: (a), (c)
  - 34d: (e), or "not covered" stated
  - 34e: `slice1-harness.test.ts:26`, with the `002_identity.sql:4-8` caveat
- **Alternative:** a written waiver in the receipt with a named owner and an expiry date. The Liberico gate allows no waiver without both.

### Minor (P2 / P3)

**M1 (P2). `list` adds up to 400 sequential queries while the admin row is locked `FOR UPDATE`.**
- **Where:** `src/server/accounts.ts:77-79`, `:89-104`.
- **What:** one ballot query per account, plus one `activeProjectRole` for each coordinator ballot. That is ≤200 accounts, read before the existing `Promise.all`, all inside `operator`, which holds the admin row `FOR UPDATE` (`:60`).
- **Why** (#inference):
  - Every coordinator `propose`/`withdraw` waits on `FOR KEY SHARE` of that row (`doc-approval-proposals.ts:88`, `:230`) while the admin merely opens /team.
  - Lock wait counts toward `statement_timeout` (10 s), so a slow `list` turns into a generic 500 for a coordinator.
  - At ≤200 local round trips this stays well under the limit. Sequential was the right fix for the DeprecationWarning; batching is the better one.
- **Fix:** one `SELECT … WHERE kind='access_change' AND state IN ('pending','approved') AND subject_user_id = ANY($1)` plus one role query for the distinct (proposer, project) pairs. Otherwise record it as a known limit.

**M2 (P3). No index on `identity.account_approvals.proposer_id`.**
- **Where:** `listOwn` (`doc-approval-proposals.ts:189`) and P14 (`:142`) filter on it.
- **Why:** P14 also filters `subject_user_id`, which `account_approvals_subject` (migration 018) indexes. `listOwn` has only `proposer_id` plus state, so it scans the tenant's ballots. That is harmless at today's volume.
- **Fix:** none in this PR, which allows no migration. Record it for the next migration slice.

**M3 (P2). /team drops the typed reason when an account-version conflict reloads the list.**
- **Where:** `src/components/team-accounts.tsx:223`, where `AccountForm` is keyed `user.id+':'+user.version`.
- **What:** after `VERSION_CONFLICT` the form reloads (`reloadAfterConflict`), and the version in the key changes. The form remounts and the reason the admin typed is gone.
- **Why:** the Review block on the same branch promises the opposite (`keepDraft: true`, `doc-approval-view.ts:117-118`). A reasonable admin expects text to survive an error message telling them to look again. This was disclosed in Task 3 (ledger :151) with no ruling.
- **Fix if cheap:** lift the reason into the parent, keyed by `user.id` only, so that grants still reset from the fresh row. Otherwise record it.

**M4 (P3). The H1 replacement is a plain `Error`.**
- **Where:** `src/server/doc-approval-http.ts:33-34`.
- **What:** `failure()` logs it as `errorType:'Error'`, which looks the same as every other unexpected 500. This is 1b N6.
- **Fix:** `class UnmappedUniqueViolation extends Error {}`. Two lines; the existing H1 test keeps passing.

**M5 (P3). The same text is defined in several places.**
- The SCOPE_DENIED sentence appears four times: `doc-approval-proposals.ts:17`, `:69`, `doc-approval-http.ts:14`, `doc-approval-view.ts:113`.
- The `FORBIDDEN` class appears twice: `doc-approval-proposals.ts:27`, `doc-approval-view.ts:77`.
- The block "parse the grants, then `docApprovalDelta`" appears three times: `listOwn`, `withdraw` `:226-227`, `openAccessChange`.

Exact-text tests pin the sentences, so drift would turn red rather than ship. Leave it as a follow-up.

**M6 (P3, doc nit). The `ReviewersPanel` line of the handoff lacks `approvalNote?`.**
- **Where:** `docs/UI-HANDOFF-3-review.md:31`.
- **What:** the `ReviewersPanelView` line has it (`:30`), and `PanelProps` accepts it, but the `ReviewersPanel` line does not list it.
- **Fix:** add the prop to that line. One line.

**M7 (P3, nit). «Hủy» and «huỷ» are both used.** The withdraw box's button says «Hủy». The copy says «huỷ» (`doc-approval-view.ts:21-22`, `:115`). Both spellings are accepted Vietnamese; normalise later, never in this PR's pinned copy.

## Deferred-minor triage

Buckets: **Must** = must fix before merge. **Cheap** = fix in this PR if cheap. **Record** = leave and record in the receipt's known limits. **Leave** = leave, with nothing to record. **Resolved** = already fixed in a round.

| Ledger item | Bucket | Note |
|---|---|---|
| 1a: DRY of the SCOPE_DENIED / APPROVAL_PENDING sentences | Leave | Folded into M5; exact-text tests guard against drift |
| 1a: case 19 `not.toContain` cannot fail | Leave | The shape guard lives in case 2 |
| 1a: P5 has no tenant predicate (plan-mandated) | Record | RLS and the composite FK cover it; I-1 adds the evidence |
| 1a / security M2: P11 gives a 500 on stored grants that repeat a code | Record | Fail-closed; `doc-approval-proposal-http.test.ts:272` pins it |
| 1b: unknown path answers 503 when identity is unconfigured | Leave | Nothing leaks |
| 1b: repeated query parameter gives 422 (accepted) | Leave | Agree |
| 1b: pg DeprecationWarning on native runs | Record | Pre-existing `Promise.all` at `accounts.ts:80`; pg@9 upgrade list |
| 1b: `loginAs` duplicated in the http and concurrency tests | Leave | Test-only |
| 1b N6: H1 error class | Cheap | M4 |
| 2: withdraw HTTP reads the body before the path-uuid check | Record | A small T7C-31 deviation at the HTTP layer (422 instead of 404 for bad body + bad id); the service order is right |
| 2: unreachable `state!=='pending'` guard (`:244`); R2 reads unused columns | Leave | Harmless; the brief asked for it |
| 2: comment-only test edit; W2 builds the admin `access` command directly; H7 extra step; 1184-line red log | Leave | Accepted |
| 2: no throttle on withdraw | Resolved | Fixed at `:218` (Task 2 F1) |
| 3: «Người trình không còn…» note on pending ballots (plan-literal) | Leave | Informative, no apply button there |
| 3: `Promise.all` reads on one client; a failed reload overwrote the conflict message | Resolved | Fix round 1 |
| 3: reload after an account-version conflict drops the typed reason | Cheap | M3; Record if not cheap |
| 3: submit/catch behaviour pinned by source text | Leave | No DOM harness in the repo |
| 3: the /team registration form has the same Enter pattern | Record | Pre-existing, outside the diff; follow-up (`team-accounts.tsx:199`) |
| 3: a ballot widened through the operational login shows «Phiếu vẫn áp được» | Record | The server refuses it (TELEGRAM_APPROVAL_REQUIRED); only the label is wrong |
| 3: admin change sends the former admin's ballots through the coordinator checks | Record | Fails closed both ways |
| 3: events lack request_id / trace_id (E-DB-13) | Record | Pre-existing, repo-wide |
| 3: 7 DeprecationWarning lines | Record | Same as 1b |
| 3: Enter guard pinned by static markup only, not tried in a browser | Record | Browser check not possible in demo mode |
| 4: stateful paths tested by substring | Record | No DOM harness |
| 4: «Tải lại» not disabled while busy; `settle` cleared a draft typed meanwhile | Resolved | Fix round 1 |
| 4: no identity service leaves an unrecoverable error block (plan-literal) | Leave | Configuration error, not a user state |
| 4: `ReviewQueue` grew a second state machine | Leave | Follow-up refactor (a reducer or hook) |
| 4: skeleton aria-label on a roleless div (plan-literal) | Leave | Copies the existing Skeleton |
| 4: identical «Rút phiếu» accessible names on several rows | Cheap | `aria-label={'Rút phiếu của ' + name}` at `doc-approval-proposals.tsx:62`; Record if not done |
| 4: busy disables the focused button; h3 and group label read twice | Leave | Minor screen-reader noise |
| 4: the visual echo can show up to three copies; duplicates across the two forms | Leave | `aria-hidden`; announced once |
| 4: after MANAGER_REQUIRED, the form stays until a page reload | Record | The server still refuses |
| 4: a stale `withdrawId` after the basis is retyped mid-command | Leave | The next command reads the current row |
| 4: `reloadOwn` guards only `proposalBusy` | Leave | Last write wins on two reads of the same data |
| 4: /team answers 500 in demo mode | Record | Pre-existing, follow-up |
| 4 I2: log shape lacks timestamp, message and request_id (E-OBS-01) | Record | Repo-wide; the receipt must not claim E-OBS-01 compliance |

No deferred minor lands in **Must**.

## Rulings you disagree with

None materially. Notes:

- Task 3 "reload drops typed reason" (ledger :151) was disclosed but never ruled on. I place it at Cheap/Record, for consistency with `keepDraft` on the Review block (M3). This is not a disagreement with a ruling.
- Task 4 I2 (ledger, `{level,event,errorType}` log shape kept): I agree the shape is plan-pinned and repo-wide. The receipt must list E-OBS-01 as a known limit.
- Tier-1 adds the database reviewer even without a migration (ledger :215): I agree. The new locking SQL deserves it.
- The 72 h cap for a version-dead ballot (T7C-19 item 8) and the R12 residual were shown to the Chairman. Not disputed.

## Declined to judge

- Telegram card rendering of coordinator ballots: the bot plugin is out of scope in this PR.
- Notifying the proposer on cancel (T7C-18): scheduled for a later slice.
- Retracting voter DMs after withdraw or cancel (T7C-16): needs a migration.
- A history UI for closed ballots: not in the plan.
- The pre-existing deadlock residual T7C-5(f), the Chairman voting while running an account command: pre-existing and recorded.
- The ZWJ-emoji refusal (T7C-20) and name-prefix spoofing (T7C-21): Chairman-accepted trade-offs.
- An index on `proposer_id`: no migration allowed in this PR (M2 records it).
- Behaviour in a real browser at 360 / 1280 px: not runnable in demo mode; known limit.
- Case-sensitivity of `accountAdmin` in `identity.principal`: pre-existing, outside the diff.
- The `denied` panel shown to every non-coordinator reader: a plan-mandated state.
- The admin as a selectable subject answering INELIGIBLE: T7C-23 deliberately hides who the admin is.
- Coordinators bypassing the pair wait through a co-coordinator: the pair rule is per (proposer, subject) by decision OQ-48 / OQ-38.
- The Security and Database tier-1 verdicts: reviewed in parallel by others. I did not duplicate their RLS-policy or SQL-plan analysis beyond I-1 and M1/M2.

## Recommendations

1. Close I-1 with the case and the 34a–e row above, or record a waiver with a named owner and an expiry.
2. Take the cheap fixes in the same round: M4 (named error class), M6 (one handoff line), and, if cheap, M3 and per-row «Rút phiếu» names.
3. The receipt's known limits should list:
   - M1 (`list` round trips inside the admin lock);
   - M2 (no `proposer_id` index);
   - E-OBS-01 log shape;
   - E-DB-13 request_id / trace_id in events;
   - pg DeprecationWarning;
   - the registration-form Enter pattern;
   - the browser check not done;
   - the plan-literal UI items marked Record above.
4. Follow-ups outside this PR:
   - batch the `list` reads (M1);
   - add the `proposer_id` index in the next migration;
   - add the Enter guard to the registration form;
   - add a NOBYPASSRLS assertion for `libetech_identity`, like `migrations/016_intake_inbox.sql:18-19`;
   - fix the /team 500 in demo mode;
   - the pg@9 upgrade.

## Assessment

**Ready to merge? With fixes.**

- Critical: 0. Important: 1. Minor: 7 (two of them nits).
- Must fix before merge: I-1 (or a named, dated waiver). No minor is must-fix.
- This verdict is a recommendation to the Chairman, not an approval. Merge still needs the Chairman's approval and the Codex gate.
