Verdict: PLAN NEEDS CHANGES

# Security gate, round 2: Task 7c plan v0.2 (commit `0f7bed5`)

- Reviewer role: security reviewer. This is advisory. The Chairman approves merges.
- Scope: `docs/plans/task-7c-coordinator-proposal.md` v0.2; `docs/OPEN-QUESTIONS.md` OQ-48 to OQ-52 (:693-800); the code and migrations read in round 1.
- Read-only. No database was touched, no server was started, no git writes were made.
- Numbering: this report uses the new numbers (OQ-48 = 24 h wait, OQ-49 = cancel scope, OQ-50 = who may withdraw and view, OQ-51 = withdraw or cancel of an `approved` ballot, OQ-52 = whether the proposer sees the stage).
- Line numbers below are plan lines unless a file is named.
- Counts: 1 must-change (N3), 3 should-change (R10 to R12), 3 missing tests (C11 to C13), 4 questions.

---

## Status of round-1 items

| Item | Status | Where |
|---|---|---|
| N1 | **Resolved.** The 24 h now runs from closing. The withdrawal exemption follows OQ-48 (b). Tests H7 (cancel at hour 25), 27(b) (rejection with `created_at` 30 h ago and `updated_at` 1 h ago) and W9 (withdraw then re-propose; then reject then re-propose) would each fail under the v0.1 "from opening" rule or with the exemption removed (mutation f, :625). One residual: N3. | T7C-19 :269; P14 :441-451; :517; :600; :604; :609 |
| N2 | **Resolved.** The `access` command carries `proposerIsCoordinator`; a missing or mismatched value gives `VERSION_CONFLICT`. The server reads the proposer's standing in the transaction that holds the admin row. A7 tests the stale value, the missing field and the reverse direction. U9 tests that the manual-save path sends the field and that `/team` reloads. A3 proves the apply is never refused because the proposer lost the role. | T7C-11 :261; Task 3 :660-666; :681; :685-686; :692; :696 |
| R1 | Resolved. The cancel reason is handled under 3c below. | :222-225; T7C-20 :270; W8 :599 |
| R2 | Resolved as an accepted residual. | T7C-21 :271 |
| R3 | **Premise withdrawn; the remedy is kept.** #fact: `identity.events` has no foreign key. See `migrations/002_identity.sql:51-53` (no `FOREIGN KEY` clause) and `migrations/004_team_accounts.sql:9-10` (`actor_id`, `detail` added without `REFERENCES`). A grep of all migrations for an `identity.events` constraint or reference finds none. The event insert in the stale-version branch therefore takes no user-row lock, and the cycle I described cannot form that way. The version filter on cancel stays as a harmless narrowing (H8). | T7C-5 (g) :255; :585; :610 |
| R4 | Resolved. | T7C-5 (h) :255 |
| R5 | Resolved. | T7C-22 :272; P16 :453 |
| R6 | Resolved. P3b comes after the throttle and before every lock. | T7C-23 :273; :428-430 |
| R7 | Resolved. `noStore` wraps every response; `failure()` is not edited. | T7C-24 :274; :458; :619 |
| R8 | Resolved. The project filter runs in SQL before `LIMIT 200`; 205 decoy rows are tested. | T7C-25 :275; :456; :519 |
| R9 | Resolved. | T7C-26 :276 |
| C1 | Resolved for cancel and rejection. The branch for an `expired` row marked late is not covered; see C11. | :517; :609 |
| C2 | Resolved. | A7 :685 |
| C3 | Resolved, adapted to OQ-50 (c). | W10 :601 |
| C4 | Resolved. | case 30 :520 |
| C5 | Resolved. | case 21; W8 :599 |
| C6 | Resolved. | :620 |
| C7 | Resolved. | H8 :610; :617 |
| C8 | Resolved. | case 31 |
| C9 | Resolved. | W11 :602 |
| C10 | Resolved, three orderings. | :616 |
| QA, QB, QC | Became the OQ-48 decision, OQ-51 and OQ-52. | :150-159 |

### The four deviations (3a to 3d)

- **3a, the P14 closing-time expression: accept.** #inference: for a ballot closed early, my GREATEST expression evaluates to `now()` until `expires_at`, so it blocks until hour 72 rather than 24 h after closing. The planner is right. `LEAST(updated_at, expires_at)` gives the true closing time for `rejected` and `expired` rows. #fact: every state change sets `updated_at=now()` (`account-approval.ts:183`, `:206`; P15; R6; cancel). The `ELSE` branch has a gap in what it states; see R11.
- **3b, R3's premise: accept.** It is verified above. I withdraw the deadlock claim.
- **3c, the cancel reason uses the shared `reason` schema: accept.**
  - The reason is written only to `identity.events` through `audit`.
  - T7C-18 :268 states that no screen shows it.
  - Its author is the account admin, the most trusted principal.
  - Condition: if slice 4 or later shows the cancel reason to a proposer or a voter, that change must adopt the T7C-20 class. Record this in the known limits.
- **3d, the OQ-48 history lines are kept: accept.** They are history, not live rules. The decision line and points A to C are marked clearly.

---

## New must-change

### N3: A proposer can "withdraw" a ballot that is already dead by an account change, and so dodge the 24 h wait

- #fact: R2 :577 does not select `subject_account_version`. R5 :580 refuses only `expires_at<=now()` and the states `rejected`, `expired` and `issued`. Neither step compares the ballot's frozen version with the subject's current `account_version`.
- #fact: P13 :440, `listOwn` :456, the admin `list` and cancel :585 all treat a version-mismatched ballot as dead. P14's `ELSE` branch :448 makes it block the pair (ruling C).
- #fact: only the admin's `command` writes `account_version` (`src/server/accounts.ts:241`; grep of `src/server`). A narrowing save leaves a coordinator ballot `pending` but dead (A8 :686: «phiếu sau đó lệch phiên bản, như hôm nay»). T7C-27 :277 relies on exactly this version-bump lever as the admin's existing power to close coordinator ballots.
- Path, #inference:
  1. The admin edits the subject (the version goes up), and the coordinator's ballot dies.
  2. The coordinator calls `POST /api/team/doc-approvals/<id>/withdraw`. They know the id from the earlier `listOwn`.
  3. R5 sees `pending` with time left, so R6 sets `expired` and writes `access_change_withdrawn`.
  4. P14's `NOT EXISTS` now exempts the ballot, and the coordinator re-proposes at once.
- Why it matters:
  - A closure that ruling C puts under the 24 h wait, and that the admin caused, becomes a self-withdrawal.
  - The audit trail records a withdrawal with `previousState:'pending'` of a ballot that was no longer open and that no screen showed.
  - It also breaks consistency with the cancel path, which got exactly this filter in v0.2 (R3).
- Fix:
  - In R5, read the subject's `account_version` and require it to equal `subject_account_version`. Otherwise return `APPROVAL_CLOSED` and write nothing.
  - No new lock is needed. Withdraw holds `FOR KEY SHARE` on the admin row, and every app-path version bump holds that row `FOR UPDATE` (T7C-5 (h)), so the unlocked read is stable for the length of the transaction.
- Tests and mutation: C12.

---

## New should-change

- **R10: Bind the withdrawal exemption to the proposer** (P14 :445-446). Add `AND e.actor_id=a.proposer_id` to the `NOT EXISTS`. Today only the proposer can write `access_change_withdrawn` (R1, R2), so this is defence in depth. It makes the query say what OQ-48 (b) says («do chính người trình rút»), and a future path that writes that kind (for example an admin tool) cannot widen the exemption silently.
- **R11: State the real bound of the `ELSE` branch** (T7C-19 (2)-(3) :269; P14 :448; the 24 h sentence in the error table).
  - #inference: for a `pending` ballot that is version-dead and not yet marked, `LEAST(expires_at, now())` is `now()` on every attempt. The P14 refusal rolls back before P15 :452 can mark it. Nothing on the app path marks it except a vote, an admin proposal, or this same proposer's P15, which never runs while P14 refuses.
  - So the pair stays blocked until `expires_at + 24 h`, which can be up to 72 h after opening. It is not "24 h after the account change".
  - This fails closed, which is acceptable as a session ruling. But T7C-19 calls it «coi như vừa đóng», and the `RATE_LIMITED` sentence («đã đóng chưa quá 24 giờ») is untrue in this case.
  - Either state the bound in T7C-19 and in OQ-48 point C for the Chairman, or run P15 before P14 so the first refused attempt records a closing time. The second option has its own cost: the mark is rolled back with the refusal unless it is committed separately.
- **R12: Name the residual of OQ-48 (b) in the known limits.**
  - A proposer who sees a rejection or a cancel coming can withdraw first and skip the wait. Whichever transaction takes the ballot `FOR UPDATE` first wins.
  - This is what the decision says, not a defect. But the Chairman should see it written down beside «Tự rút thì trình lại được ngay».
  - The admin can still cancel each new ballot, and each cancel imposes 24 h.
  - The 10-per-hour cap bounds the loop. #inference: it does not increase the direct-message volume beyond what v0.1 already allowed across different members.

---

## Missing or weak tests

- **C11 (3a, first branch):** an `expired` row with `expires_at` 25 h ago and `updated_at` 1 h ago, as marked late by a later P15 or vote, must **not** block. Today no case separates `LEAST(a.updated_at,a.expires_at)` from plain `updated_at`. Case 27(c) :517 exercises only the `ELSE` branch. Add it as a mutation too: replace the `LEAST` with `updated_at`, and C11 must go red.
- **C12 (N3):**
  - The coordinator's `pending` ballot, then an admin narrowing save on the subject (the version goes up).
  - `withdraw` must answer `APPROVAL_CLOSED`, with the ballot state unchanged and 0 `access_change_withdrawn` events.
  - Then `propose` for the same member must answer `RATE_LIMITED` with the 24 h sentence, and `snapshot` must be unchanged.
  - Mutation: drop the version comparison from R5, and C12 must go red.
- **C13 (R10, only if R10 is taken):** a login-operator insert of an `access_change_withdrawn` event for the ballot with `actor_id` set to the admin must **not** exempt the pair. Without R10, skip this test.

---

## Questions that are not the session's to decide

- **OQ-48 point A** (:158): whether the 24 h runs from closing. This is pending Chairman confirmation. "From closing" is never shorter than "from opening", so the interim is fail-closed. Sound.
- **OQ-48 point C** (:159) and R11: expired and version-closed ballots wait 24 h, and an unmarked version-dead ballot waits until `expires_at + 24 h`. These are session rulings. The Chairman should see the real bound.
- **OQ-51** (T7C-27 :277): the placeholder allows withdraw only while `pending`, which is fail-closed. The admin cancelling `approved` ballots is a session ruling that grants the admin no power they lack today: H6 :608 pins that the version bump already closes such ballots. It is correctly surfaced inside OQ-51, and no new question is needed.
- **OQ-52** (T7C-28 :278): the proposer sees the stage. The plan correctly says this is not the strictest reading, and the coupling with OQ-51 is real: under the placeholder, the refusal reveals the stage. No seat is named.

#inference: v0.2 does not decide any new "who may do what" outside these questions.
- The per-pair scope (27(e), H7) comes from the OQ-48 option text itself («theo cặp (người trình, người được cấp)», OPEN-QUESTIONS :706).
- `listOwn` opening to every reader of the project grants only one's own ballots.
- The `viewer` withdrawal by API only is the literal reading of «vai nào cũng được» and is listed as a known limit (T7C-29 (2)).

---

## Checked and sound

- **OQ-48 (b), exact wording.**
  - The exemption covers only ballots with an `access_change_withdrawn` event for that `approvalId`.
  - Cancel writes `access_change_cancelled` (:588), a vote writes `rejected`, expiry or version closure writes `expired` with no withdrawn event, and all of these wait.
  - The 10-per-hour cap is unchanged (W9 :600).
  - #fact: `libetech_identity` has `SELECT` on `identity.events` (`002_identity.sql:87`), and the index on `(user_id, tenant_id, created_at)` fits the `NOT EXISTS`.
  - Event `approvalId` is lower-case text, and `a.id::text` is lower-case, so the match is exact.
  - The gaming route is N3. The race route is R12.
- **OQ-49 (a).** `BALLOT_CANCEL_NOT_ALLOWED` applies to admin-proposed ballots (:586; H4 :606). Withdraw refuses the admin (R1 :576), so the admin cannot route around OQ-49 by withdrawing their own ballot (W3 :594).
- **OQ-50 (c): what a former coordinator can read.**
  - `listOwn` returns only rows with `proposer_id = caller` (:456): approval id, project id, subject user id, added types, `state` and expiry. This is information about the caller's own act plus the stage (OQ-52).
  - A plain member who never proposed gets `[]`. The `former` state lists the same rows, with the subject's name resolved only from the page's existing `people` (falling back to «Thành viên chưa rõ tên», :771). So no new name or permission set is fetched.
  - #inference: a ballot vanishing tells the proposer that the subject's account changed or the ballot was cancelled. That was equally true while they were a coordinator, so demotion adds nothing.
  - Removal from the project gives the 404 of an unknown project for both list and withdraw (W5 :596).
  - `former` shows no proposal form, and `propose` still requires `manager` (W6 :597).
- **Lock order with the new reads.**
  - Withdraw takes the admin row `FOR KEY SHARE`, then the proposer `FOR SHARE`, then `activeProjectRole` (a plain read), then the ballot `FOR UPDATE`, then the update and an event insert with no FK. P14's event read is a plain `SELECT` with no lock.
  - Every membership change on the app path holds the admin row `FOR UPDATE`, which excludes withdraw's `KEY SHARE`. So the R4 membership read is stable without a lock. The same holds for the `proposerIsCoordinator` read at apply time.
  - Withdraw against a co-manager's propose for the same subject: propose holds NKU on {co-manager, subject}; withdraw needs the proposer row and the ballot. Propose's P15 does not match a live ballot, and its unique-index insert can wait on the withdraw transaction, but withdraw waits on nothing propose holds.
  - Withdraw against a reject vote: the vote locks the ballot, then takes `KEY SHARE` on the voter rows (the admin row for the chairman seat). Both are compatible with what withdraw holds.
  - The proposer's own login (`FOR UPDATE` on the user row only) waits behind or blocks withdraw's `FOR SHARE` on a single lock. No cycle.
  - The C10, C7 and withdrawal-race native cases :611-617 cover the orderings.
- **The `R2` unlocked read.** `proposer_id`, `grants`, `previous_grants` and `kind` cannot change after insert: the identity role holds `UPDATE(state, updated_at)` only (migration 009). So the project id derived for R4 is stable. R5 re-reads `state` and `expires_at` under the lock.
- **Round-1 "sound" items.** All still hold except the one premise withdrawn under R3/3b. The OQ-33, OQ-35 seat exclusion, the no-seat-disclosure residual, OQ-36 (b)+(d) placement of cancel before `nextVersion`, the 019 guard, and the admin-row-first ordering are unchanged in v0.2.
