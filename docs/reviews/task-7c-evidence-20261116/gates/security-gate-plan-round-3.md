# Security gate, round 3: Task 7c plan v0.3 (commit `0319374`)

Verdict: PLAN READY

- Reviewer role: security reviewer, advisory only. The Chairman approves merges.
- Scope (as briefed, nothing wider):
  - My round-2 items.
  - The Task 1 split into 1a and 1b.
  - The security-relevant pre-flight fixes F2, F3, F5, F7, F14 and D.
  - An end-to-end re-check of the OQ-48 (b) and OQ-50 (c) parts.
  - The three session rulings the coordinator flagged.
- Method: read-only. I wrote no file other than this report. I touched no database and ran no native tests. Line numbers are plan v0.3 lines unless a file is named.
- Counts:
  - 0 must-change.
  - 1 should-change (R13).
  - 0 missing tests.
  - Questions: none new; the four from round 2 stand.

---

## Status of round-2 items (checked against the text, not the mapping table)

| Item | Status | Where |
|---|---|---|
| N3 | **Resolved.** R2 now selects `subject_account_version` (:667). In R5, after the ballot is locked `FOR UPDATE` (:670), the step order is: closed or expired first, then the subject's current `account_version` against the frozen version, giving `APPROVAL_CLOSED` with nothing written (:671-672), then the `approved` placeholder (:673). So a ballot that was approved and then went dead also gets `APPROVAL_CLOSED`. W12 (:696) covers both branches and the follow-on `RATE_LIMITED`. Mutation (g) (:721) turns W12 red. HTTP case (:714) includes a version-dead ballot. | T7C-30 :286; T7C-5 (i) :261 |
| R10 | **Resolved.** P14 adds `AND e.actor_id=a.proposer_id` (:500). | T7C-19 (7) :275 |
| R11 | **Resolved by stating the bound.** The bound, up to `expires_at` + 24 h (72 h after opening), is written in four places: P14 (:505), T7C-19 (8), «Giới hạn đã biết» item 2 (:995) and `docs/OPEN-QUESTIONS.md:716`. Each says it is the session's own words. The OPEN-QUESTIONS line lists three things that mark such a ballot: a vote, an admin proposal, or another coordinator's proposal. #inference: that list is correct; another coordinator's P14 is a different pair, so it reaches P15. The `RATE_LIMITED` sentence no longer names a deadline (item 21 :984). Case 27(d) (:588) pins that the ballot stays `pending` after a refusal. | — |
| R12 | **Resolved.** «Giới hạn đã biết» item 1 (:994) quotes the decision sentence verbatim beside the residual and the two remaining brakes. | T7C-19 (9) |
| C11 | **Resolved.** Case 32 (:593): an expired row whose `expires_at` is 25 h ago and whose `updated_at` is 1 h ago passes. The control row, with `expires_at` 23 h ago, gets `RATE_LIMITED`. Mutation (e) (:601) separates `LEAST(updated_at, expires_at)` from `updated_at`. | Task 1a |
| C12 | **Resolved.** | W12 :696; mutation (g) :721 |
| C13 | **Resolved.** Case 33 (:594): a withdrawal event written by the admin does not exempt the ballot. The control, written by the proposer, does. Mutation (f) (:601). | Task 1a |
| 3c condition | **Recorded** in three places: Global «Chữ tự do» (:225), T7C-20 and «Giới hạn đã biết» item 5 (:998). | — |

---

## Task 1 split (T7C-34; shared contract :441-517; 1a :519; 1b :606)

- **No case, step or mutation was lost.** #fact, from `git show` of both commits:
  - Every case name in v0.2 appears in v0.3.
  - Every labelled case W1–W11, H1–H8, A1–A8, U1–U9 and P1–P15 is still present.
  - v0.3 adds cases 32 and 33, W12, «an admin change to the subject racing a withdrawal is seen by it» and «withdraw takes the ballot id from the path only».
- **Mutations.** v0.2 Task 1 had (a) to (c). In v0.3:
  - (b) and (c) are in 1a (:601).
  - The new (d), (e) and (f) are in 1a (:601).
  - (a), dropping the admin-row `FOR KEY SHARE`, is in 1b step 6 on native PostgreSQL.
- **Both sub-tasks are marked as requiring the security reviewer** (:519, :606).
- **The lock-order proof sits only in 1b.** 1a can commit code whose deadlock freedom is not yet proven: all nine concurrency cases and mutation (a) are in 1b. That is acceptable for three reasons:
  - 1b is reviewed by the same gate.
  - Item 22 (:985) requires 1b to fix 1a's file and re-run all 33 cases of 1a if a race exposes a fault.
  - Both land in one PR before merge.
- **Condition for the merge gate, not for the plan:** the PR must not merge with 1a alone.

---

## Pre-flight fixes (security-relevant ones)

- **F2, case 18 (:579).** The admin and the subject both get 30 synthetic memberships. The subject's 31 entries are all inside the admin's scope, so the 30-entry `grantsSchema` cap is the only check that can fail. The control case with 30 entries opens a ballot. Mutation (d) proves the case has teeth. Sound.
- **F3, withdraw takes `approvalId` only from the path (T7C-31 :287; route :661; R0 :664; W8 :689; HTTP :715).**
  - The signature is `withdraw(p, approvalId, input)` and the body schema is strict `{reason}`.
  - A body carrying `approvalId` gives 422 whether it matches the path or not. A path id that is not a uuid gives 404, checked before the body.
  - The handler passes the path segment and the body through unmerged.
  - The HTTP case with B1/B2 proves the body cannot redirect the withdrawal and that the path does not silently win.
  - R0 runs before R1 (tenant, bot), but both refusals are 404 or 422 and reveal nothing.
  - Sound.
- **F5, `openWorld()` per test.**
  - The hourly throttle commits separately and would otherwise accumulate across tests. Rebuilding the world per test removes that cross-test leakage, so a refusal cannot pass for the wrong reason.
  - W9 still exercises the 11th attempt inside one world, after `resetThrottle`.
  - Sound.
- **F7, `transportMember` and `setProjectRole` (:532, :544).**
  - The rename removes the clash with `tests/slice1-fixtures.ts`.
  - `setProjectRole` is test setup through the operator login. It changes `project_role` only, not `doc_approve:*`, so the 019 guard is not involved.
  - W10 and case 29 now set roles explicitly at the start of each case, so the OQ-50 assertions no longer depend on fixture defaults.
  - Sound.
- **F14, the text rules run on the raw string (:225; T7C-33).**
  - Forbidden characters and unstorable strings are checked on the raw input, and so is the length cap. Only U+0020 is trimmed before the floor of 5 is checked.
  - A leading or trailing LF or U+2028 is refused, not trimmed. W8 pins this, and also the 500-code-point raw string with edge spaces.
  - #fact: this matches the existing `basisCheck` order in `src/components/review-view.ts`, which T7C-33 reuses.
  - Residual, not a change: U+00A0 and other `\p{Zs}` spaces are neither trimmed nor forbidden, so five no-break spaces form a valid but empty-looking basis. This is the same behaviour as the existing reviewer basis. It has no impact on authorisation, and the frozen reason is still attributed to the named proposer.
- **D, case 31 (:592).**
  - Branches (a) and (b) raise a real `23505` through `beforeStatementInTx`, which re-runs the service's own statement inside the service's transaction. Branch (a) hits the one-open-ballot index and gets `APPROVAL_PENDING`. Branch (b) hits a voter-table unique constraint and the error is rethrown raw.
  - Branch (c) keeps a constructed error, and its limit is noted (item 18 :981). The fallback for PGlite filling no `constraint` is covered by P16's message-based branch.
  - Sound.

---

## OQ-48 (b), end to end, as it stands in v0.3

- **Who waits.** The same proposer, for the same subject (`a.proposer_id=$1 AND a.subject_user_id=$2`, :496-497). A co-manager and the admin path are not blocked (27(e), H2, H7). This matches the pair framing of the OQ-48 options.
- **From when.**
  - A `rejected` or `expired` ballot waits from `LEAST(updated_at, expires_at)`.
  - A ballot still `pending` or `approved` but dead waits from `LEAST(expires_at, now())`, which can mean up to `expires_at` + 24 h. This is fail-closed and now stated.
  - `issued` ballots never block.
  - "From closing" is labelled point A, awaiting Chairman confirmation.
- **How a withdrawal is recognised.**
  - Withdrawal writes an `access_change_withdrawn` event whose `detail.approvalId` is the ballot id and whose `actor_id` is the proposer.
  - Only the proposer can withdraw (R1, R2).
  - Only a live ballot can be withdrawn: `pending`, unexpired, and at the current account version (R5).
  - #inference: so the exemption cannot be bought for a ballot that the admin, a vote, expiry or an account change has already closed. The remaining race, withdrawing just before a reject or a cancel lands, is the decision itself (R12).
- **Tests that would fail if the rule drifted:**
  - 27(a)-(f), 32, 33, W9, W12, H2 and H7.
  - Mutations (e) and (f) in 1a; (f) and (g) in Task 2.
- **Sound.**

## OQ-50 (c), end to end, as it stands in v0.3

- **Withdraw.**
  - Withdraw takes `FOR KEY SHARE` on the admin row, then `FOR SHARE` on the caller's user row, requiring the account to be active and activated (R3 :668).
  - Then it reads `activeProjectRole(tx, p.id, <delta project>)` inside the same transaction (R4 :669). Null gives `SCOPE_DENIED`, the same 404 as an unknown ballot. Any non-null role passes, including `viewer`.
  - #inference: every app-path membership change holds the admin row `FOR UPDATE`, so the read cannot go stale within the transaction.
- **listOwn.** It applies the same `activeProjectRole` check in its transaction, without locks, because it is a pure read. It returns only the caller's own ballots, filtered by project in SQL.
- **Propose.** It still requires `manager`, both before and under the lock (P4, P6).
- **Tests:**
  - W4: a member demoted to `engineer` and then `viewer` can still withdraw and list.
  - W5: a removed member gets 404 for both withdraw and list, and the admin cancel still works.
  - W6: a demoted or removed member cannot propose.
  - W10: two projects.
  - Native race variants: removal gives `SCOPE_DENIED`; demotion to `viewer` still succeeds.
  - The 1b HTTP list case.
  - Mutation (e) of Task 2.
- **Sound.**

---

## The three session rulings flagged by the coordinator

- **F4 option (i) (T7C-32).** I do not object. It has no security relevance, and keeping `tests/review-ui.test.tsx` unchanged preserves an existing negative assertion ("the reviewers panel has no control that touches document approval").
- **R12 in «Giới hạn đã biết» rather than in OPEN-QUESTIONS.** Accepted.
  - R12 asks no new question. It spells out a consequence of the Chairman's own sentence, which is quoted verbatim next to it (:994).
  - The R11 bound, which is a session ruling the Chairman should see, is in OPEN-QUESTIONS (:716).
  - Optional: one pointer from OQ-48's "Áp vào PR" line to known-limits item 1.
- **The concurrency case at :712 as evidence that N3 needs no new lock.** Accepted as evidence, with one precondition that should be written down (R13).
  - Order 1 is the meaningful one. The withdrawal blocks at R3 behind the admin row, the admin's narrowing save commits, and the withdrawal must then see the new version at R5.
  - #inference: this passes only under READ COMMITTED, where each statement takes a new snapshot. Under REPEATABLE READ the snapshot is taken at R2, before the block, so R5 would read the old version and the withdrawal would succeed. The case would therefore go red under REPEATABLE READ, which makes it a real test of the claim, not a tautology.
  - Order 2 shows that the admin waits behind a withdrawal that is in flight.

---

## New must-change

None.

## New should-change

- **R13: Write down the isolation-level precondition of T7C-5 (i)** (:261, and item 17 at :980). #fact: `src/server/db.ts:44` opens transactions with a plain `BEGIN`, so they run at the server default isolation level, READ COMMITTED unless `default_transaction_isolation` is changed. The claim "the unlocked `account_version` read at R5 is the committed value after any admin change" depends on that.
  - Add one sentence: «dựa vào mức cô lập READ COMMITTED mặc định (`db.ts`, `BEGIN` trơn); nâng lên REPEATABLE READ thì phải khoá dòng người được cấp `FOR SHARE` ở R5».
  - The same precondition holds for the R4 membership read and the `proposerIsCoordinator` read at apply time.
  - No code change, no new test: order 1 of the :712 case already fails if the precondition breaks.

## Missing or weak tests

None new. The native cases (1b step 1, Task 2 step 2) were not run in this round, as instructed. Their evidence is pending the builder's `task-1b-green.txt` and `task-2-green.txt`.

## Questions that are not the session's to decide

These are unchanged from round 2: OQ-48 point A, OQ-48 point C (now with its stated 72 h bound), OQ-51 and OQ-52. v0.3 introduces no new decision about who may do what. #inference: F3 narrows the input, and N3 narrows withdraw.

## Checked and sound

- Every round-1 and round-2 "sound" item still holds in v0.3, including:
  - the lock order of T7C-5 (a)-(h);
  - the cancel version filter (H8);
  - OQ-49 (a) (H4, W3).
- R5's order puts version before stage, so the answer «đã đủ phiếu» (`BALLOT_ALREADY_APPROVED`) is never given for a dead ballot. That avoids revealing the stage of a ballot the list no longer shows.
- Withdraw still writes nothing on any refusal. A refused `propose` still marks nothing; P14 runs before P15 and the order is unchanged.
