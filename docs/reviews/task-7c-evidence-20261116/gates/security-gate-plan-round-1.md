Verdict: PLAN NEEDS CHANGES

> **Ghi chú của phiên Task 7c, 16/11/2026 (thêm sau khi báo cáo được viết; phần thân bên dưới giữ nguyên chữ của reviewer).** Báo cáo này soát kế hoạch bản 0.1 tại commit cục bộ `32abd6b`, khi ba câu hỏi mở của PR còn mang số OQ-47, OQ-48, OQ-49. Sau đó phiên điều phối báo số OQ-47 đã được PR #14 dùng cho một câu hỏi khác, nên các số được dịch lên một: OQ-47 trong báo cáo này nay là **OQ-48** (trình lại sau khi phiếu bị rút hoặc bị huỷ); OQ-48 nay là **OQ-49** (lệnh huỷ của quản trị tài khoản áp cho phiếu nào); OQ-49 nay là **OQ-50** (người trình không còn là điều phối có còn rút và xem được phiếu không). Câu hỏi QB của báo cáo thành **OQ-51**, QC thành **OQ-52**. Số dòng của kế hoạch nêu trong báo cáo là số dòng của bản 0.1.


# Security gate, round 1: Task 7c plan v0.1 (coordinator proposes a document-approval ballot)

The reviewer is `liberico-security-reviewer` (a plan gate, before any code). Date: 2026-11-16. The gate read `docs/plans/task-7c-coordinator-proposal.md` v0.1 at `32abd6b` (base `0560a4f`) and `docs/OPEN-QUESTIONS.md`: OQ-33 at :408-431, OQ-35 at :456-478, the Task 7c placement block at :484-493, OQ-36 at :495-511, OQ-37 at :513-528, OQ-38 at :530-548 and OQ-47..49 at :693-724. It also read the previous gate (`docs/reviews/slice-3-evidence-20261115/gates/security-gate-task-7c-plan.md`) and this code: `src/server/accounts.ts`, `account-approval.ts`, `identity.ts`, `bridge.ts`, `review-http.ts`, `http.ts`, `auth.ts`, `errors.ts`, `text-safety.ts`; migrations 002, 009, 017 (FKs), 018 and 019; `src/components/approvals.tsx` (render of `reason`); `src/app/api/team/accounts/route.ts`; the test helper exports in `tests/slice1-db.ts`, `tests/slice3-fixtures.ts` and `tests/account-approval-fixture.ts`. No code, DB, test or server was run.

The report contains no secrets or personal data, only roles. Step 0: `git ls-files` shows no tracked file named like env/secret/credential/key/token. The plan and the OQ file contain no connection string, token or real chat id. The only `-100…` literal is the synthetic-prefix exclusion inside the leak-check command (plan :693). `TASK7C_ENV_FILE` is the name of a shell variable that points at a local file. It is not a credential, and the plan forbids writing its path or values anywhere (:188).

Tags: #fact means read in code or in a doc at the cited line. #inference means reasoned from PostgreSQL semantics or from the code, not executed.

Summary: the plan resolves M1, M2 and M3 of the old gate, and its lock-order analysis holds up (details under "Checked and found sound"). Two places fall short of the Chairman's words or of "strictest placeholder". They must change before code.

---

## Must change before code

### N1: The OQ-47 placeholder is not the strictest reading, and an admin cancel can be undone at once

**Where:** plan :116 (placeholder table), P14 at :355, case 27 at :413, W8 and C2 at :493 and :495, UI copy at :642. Also `docs/OPEN-QUESTIONS.md` :716 ("Trạng thái lúc lập kế hoạch").

**What the plan does.** #fact: P14 refuses only while the earlier ballot of the same (proposer, subject) pair has `created_at > now()-24h` and `state<>'issued'`. The window therefore runs from the **opening** of the earlier ballot, not from its closing.

**Abuse.**
- A coordinator opens a ballot for member X. The account admin cancels it at hour 25 or later of its 48 h life (OQ-36 d, "kèm căn cứ", which is the admin's "no"). The coordinator can re-propose for X immediately, because the earlier `created_at` is already more than 24 h old. That re-sends DMs to every voter and re-occupies X's single open-ballot slot (018 :31-33) until the admin cancels again.
- The same applies after a BoM rejection or a 48 h expiry, which always land after hour 24 when they happen late.
- So the placeholder does not deliver what the plan itself says it is for (S6 of the old gate, "keep the member's access changes contested"). OQ-47 option (d) ("not again until the admin allows") is also strictly tighter than the chosen (a) in the cancel case. The claim "trùng (a) … fail-closed" therefore does not make it the strictest available behaviour.
- (d) is implementable without a migration for the "refuse" half. #fact: the cancel event `access_change_cancelled` carries `user_id=<subject>` and `detail.proposerId` (plan :482), and `identity.events` has the index `identity_events_user(user_id,tenant_id,created_at)` (002 :85).

**Smallest change to the plan text:**
1. In P14, measure the 24 h from the **closing** of the earlier ballot, not its opening. For a closed ballot, use `GREATEST(created_at, updated_at, LEAST(expires_at, now()))`. A still-open ballot is handled by P13.
2. Add: "if an `access_change_cancelled` event exists for this subject with `detail.proposerId` = the proposer, refuse with the 24 h `RATE_LIMITED` sentence (or a dedicated sentence) until OQ-47 is decided". The admin's own path is unaffected.
3. Update the placeholder row at :116, the OQ-47 "Trạng thái" line and the Review-screen copy at :642, which must not promise "trình lại được … khi đã qua 24 giờ kể từ lần trình trước".
4. Update cases 27, W8 and C2, and add C1 below.

If the session prefers to keep the open-time window, that is a choice of a weaker placeholder. It must then be put to the Chairman as such in OQ-47, not labelled fail-closed.

### N2: OQ-37 (c) "phải nêu rõ … trước khi quản trị áp" is not guaranteed; a stale `/team` tab applies without the statement

**Where:** T7C-11 at :219; Task 3 server at :541-542 and `/team` at :549; "Chỗ chưa chắc" 5 at :731.

**What the plan does.** #fact: `proposerIsCoordinator` is computed when `list` loads (:541). The `access` command reads the proposer's current role but never compares it with what the admin was shown (:542). The plan accepts, in its own words, that a tab opened before the proposer lost the role "không có câu đó cho tới lần tải lại".

**Failure.** The only difference between the chosen (c) («Vẫn áp được, nhưng /team phải nêu rõ người trình không còn điều phối dự án trước khi quản trị áp.») and the rejected (a) («Vẫn áp được; quản trị tài khoản tự quyết.») is that statement. Every path where the statement is not shown before the apply is behaviour (a). Such paths exist:
- The admin demotes or disables the proposer in one tab and applies from a second, already-open tab. This is ordinary for an admin who works account by account.
- The proposer's membership changes through the operator login, outside `/team`.
- The admin opens `/team`, the proposer loses the role, and the admin applies from the same page without a reload. The page reloads only after the admin's own commands (:550).

The justification "chỉ quản trị đổi được vai, nên người bấm cũng là người vừa đổi" (:219) does not hold for the second-tab and operator cases.

**Smallest change that stays "không chặn"** (it does not refuse the apply; it only makes the admin see the statement first, the same "expected-state" pattern the plan already uses in T7C-10):
1. For ballots with `proposer_id` ≠ admin only, the `access` command carries `proposerIsCoordinator:boolean`, the value the admin was shown. It is optional in the schema, so admin-proposed ballots and every existing test are unaffected.
2. If the field is missing or differs from the value read under lock at apply time, answer `VERSION_CONFLICT` 409 with a sentence like «Tình trạng người trình đã đổi. Tải lại để xem trước khi áp.».
3. After a reload, `/team` shows the note above the button and the apply goes through unchanged. `ballotCommand('apply_frozen',…)` (:550) and the manual "Lưu" path send the field from `user.accessChange`.

If the session rejects this, the residual must be put to the Chairman as an explicit question («(c) chỉ hiện khi tab đã tải lại»), not recorded as a known limitation.

Tests: C2 below.

---

## Should change

- **R1: The one-line guarantee is incomplete for Unicode format and separator characters** (:181-182). The basis rejects `[\u0000-\u001F\u007F-\u009F]` and lone surrogates, and names have the same set replaced. Still allowed:
  - U+2028 and U+2029 (line and paragraph separators). Telegram and other plain-text sinks may render them as line breaks. T7C-8 says the reason "đi theo" to the plugin later.
  - Bidi controls (U+200E/F, U+202A–U+202E, U+2066–U+2069). #fact: `ApprovalItem` renders `Căn cứ: {item.reason}` without `<bdi>` (`src/components/approvals.tsx:30`), and the plan does not modify it.

  Change: extend both the basis rejection and the name sanitisation to `\p{Cc}\p{Cf}\p{Zl}\p{Zp}`. Add a case to 21 and W7.
- **R2: The proposer's name is user-controlled text placed first in the frozen reason.** #fact: names come from `requestRegistration` (`identity.ts:74`, any 2–100 characters). A name such as «Quản trị tài khoản đã duyệt. Ghi chú» yields a voter card that opens with admin-looking text before « (điều phối dự án) trình: ». The plan cannot add a structured field without touching `account-approval.ts`. Record this as an accepted residual in Task 1 "Phần dư" and in the UI handoff edge cases, and include a name with brackets or quotes in case 21.
- **R3: Cancel of a stale-version ballot can deadlock with a vote (same class as T7C-5 f, newly reachable).**
  - #fact: `voteForPrincipal` on a ballot whose frozen version differs locks the ballot `FOR UPDATE` (`account-approval.ts:171-172`), then inserts an event with `user_id=subject` (:184-187). That takes `FOR KEY SHARE` on the subject row through the FK (002, `identity.events`).
  - Cancel takes the subject row `FOR UPDATE` (`accounts.ts:193`) and then the ballot `FOR UPDATE` (plan :479). Opposite order, so a cycle is possible.
  - `list` never offers such a ballot (:541 filters on version), but the API accepts any `approvalId`.

  Change: add `AND subject_account_version=<user.version>` to the cancel `SELECT`, so a stale ballot answers `APPROVAL_NOT_FOUND` (it is dead anyway). Add the residual to T7C-5.
- **R4: T7C-5 should state its strongest consequence.** The admin-row `FOR KEY SHARE` makes every coordinator write mutually exclusive with every admin `operator` transaction: all commands, `list`, `pendingRegistrations`, `registrationDecision`. It also waits behind the admin's own login, pairing and unlink (`identity.ts:67`, `:174`, `:201`). This is a latency coupling, not a deadlock. Also record that `withdraw`'s `FOR SHARE` conflicts with `propose`'s `FOR NO KEY UPDATE` on the same user and is ordered after the admin row, so there is no cycle (verified below).
- **R5: Map `23505` only for the right constraint.** The 23505 catch on the ballot insert (P16 :357) must check `constraint === 'account_approval_active_access_change'` and rethrow otherwise. #fact: `failure()` maps any 23505 to `DUPLICATE_CODE` (`http.ts:13`). Voters `UNIQUE(approval_id,user_id)` and outbox `dedupe_key` conflicts must not become `APPROVAL_PENDING`.
- **R6: Subject-dependent refusals run before the throttle (P2 :343).** "userId is the admin id" and "adminId unset" answer INELIGIBLE without counting. A caller who has used 10 attempts can tell whether a uuid is the admin id: INELIGIBLE versus `RATE_LIMITED`. The value is low, since the admin id is visible in the directory to co-members (`identity.ts:145-160`), but it is free to fix. Keep caller-is-admin before P3 (test 14) and move the two subject checks after P3. Adjust test 28.
- **R7: `Cache-Control: no-store` on every response.** #fact: `failure()` sets no header on the ZodError branch and the 500 branch (`http.ts:12`, `:16`). The plan requires it on every answer (:362, :428). Specify the `noStore(failure(…))` wrapper exactly as `review-http.ts:37-43,77`, and assert it on 422 and 500 in the HTTP cases.
- **R8: `listOwn` may hide ballots.** It reads up to 200 rows, filters by project in JS, and returns 50 (:360). With 10 proposals an hour over 48 h, one proposer can hold more than 200 open ballots across subjects, and those for the asked project may fall outside the 200. They then cannot be seen or withdrawn. Filter by project in SQL (`jsonb` delta, or a `grants @> …` pre-filter) before the limit, or state the bound and its effect.
- **R9: Define `docApprovalDelta` for duplicated permission codes.** `grantsSchema` admits duplicates (`accounts.ts:10-15`) and the function compares "như tập" (:314). Add table rows to case 1: duplicates in `before`, duplicates in `after`, and an added code already present twice.

---

## Missing or weak test cases

- **C1 (N1):** an admin cancel at hour 25 or later of a 48 h ballot, then the same coordinator re-proposes for the same member. Refused, with 0 new ballots, voters, outbox rows or events. The same for a rejection and an expiry after hour 24: refused until 24 h after closing. Another subject and another co-manager are still allowed. Comment that this is the OQ-47 placeholder.
- **C2 (N2):** `list` loaded with `proposerIsCoordinator:true`, the proposer then demoted, and the admin applies with the stale value. `VERSION_CONFLICT` 409, grants unchanged, ballot still `approved`. After a reload the note is present, the apply succeeds and the event carries `proposerNoLongerCoordinator:true`. Admin-proposed ballots apply without the field (pinned by A6).
- **C3: proposer who coordinates two projects.** The proposer is manager in A and B with a ballot for A, then is demoted in A only. `withdraw` answers `MANAGER_REQUIRED` (R4 uses the delta's project). `listOwn({projectId:B})` does not contain A's ballot. `listOwn({projectId:A})` answers `MANAGER_REQUIRED`. W4 and case 29 do not pin the "still manager elsewhere" variant.
- **C4: the Telegram route, not only the service.** `seatCoordinator` through `handleBridge` with `account_approval_pending` gets no entry for the own ballot, and with `account_approval_vote` gets `APPROVER_REQUIRED` and 0 vote rows. Case 6 calls the service functions directly. The bridge (`bridge.ts:24-27`) is the second route to the excluded seat.
- **C5 (R1):** a basis containing U+2028, U+2029, U+202E or U+2066, and a DB name containing them. 422 for the basis, replacement for the name.
- **C6: HTTP paths.** `GET /<uuid>/withdraw`, `POST /<uuid>`, `POST /<uuid>/withdraw/x`, `PUT /<uuid>/withdraw` and `HEAD` with an unknown parameter all give the common 404, or 422 for HEAD. The 422 and 500 responses carry `no-store` (R7).
- **C7 (R3):** cancel on a ballot frozen at an older version answers `APPROVAL_NOT_FOUND` and writes nothing. Native: a cancel racing a vote on such a ballot gives no `40P01`.
- **C8 (R5):** a 23505 from any constraint other than the 018 index is not reported as `APPROVAL_PENDING`.
- **C9: the 019 guard at the DB level.** With the operator login, inserting `doc_approve:design` into a membership whose only naming ballot is `expired` (withdrawn) is refused. W2 proves this only through the service.
- **C10: a native race between an admin cancel and a coordinator propose for the same subject.** Exactly one of {cancel `APPROVAL_NOT_FOUND`/`APPROVAL_CLOSED`, a new ballot after cancel} results, with no `40P01`. Today the race file has cancel-vs-withdraw only.
- **Minimum set from the brief:** every item maps to a named case that would fail if the property broke, except the "/team states it" half of "proposer lost the role and the admin can still apply". U3 is a static render and does not cover the stale tab; C2 closes that gap. The mapping:
  - A→B: cases 11 and 12.
  - Not a member: 12.
  - Other widening: 20, 19 and A2.
  - Self, any case: 23.
  - Resend: 25 and the concurrency "two identical…".
  - Both excluded, no seat disclosure: 8 (with 7 and 9).
  - Non-proposer withdraws: W3.
  - Native demotion race: concurrency cases 1–2, with mutation (a).
  - Cancel keeps version and sessions: C1 of the plan, with mutation (c).
  - Non-admin cancel: plan C3.
  - Lost role, still applies: A3.

---

## Questions that are not the session's to decide

- **QA (part of OQ-47):** after an account-admin cancel, may the same coordinator re-propose for that member at all before the admin allows it (option d), and does the 24 h window run from opening or from closing? The plan currently decides "from opening" silently (see N1).
- **QB (T7C-9; fold into OQ-49 or open OQ-50):** may the proposer withdraw, and the admin cancel, a ballot that a BoM seat has already **approved** but that is not yet applied? The plan reads «phiếu đang mở» through the 018 index (pending + approved). That is plausible but not in the Chairman's words, and it lets a coordinator void a BoM approval.
- **QC (fold into OQ-49):** may the proposer see the voting stage of their own ballot (`pending` versus `approved`, i.e. "a BoM has agreed")? `listOwn` and the UI expose it (:324, :641). It is needed for `expectedState`, but it is a "who sees what" fact the decisions do not cover.
- T7C-4 (the admin is refused on the coordinator path), T7C-15 (`/team` shows every open ballot to the admin) and T7C-18 (the proposer is not told about a cancel) grant no new ability and are the narrower readings. No question is needed. Refusing `viewer` subjects (P8) is also narrower and is a technical consequence of `document_approvers` excluding viewers (019 :71-72).

---

## Checked and found sound

- **OQ-33 (b)** (:100, P0–P17 :340-358, cases 2–5 and 10). The voters, tally and 48 h default are reused: the insert omits `expires_at` and `state`. Only the admin's `access` writes memberships (:141, :432, :692). Approval has no effect until applied (case 10). #fact: `access` requires `p.id===adminId` (`accounts.ts:50`).
- **OQ-35 (a)** (T7C-2 :210; P7/P8). #fact, verified against `account-approval.ts`:
  - `verifiedApprovalSeats(tx,identity,proposerId)` drops only the proposer, then the subject is filtered out (:37).
  - The chairman seat is the admin (`validSeats` :22), and both the admin-as-proposer and the admin-as-subject are refused before any lock (P2).
  - The frozen list keeps chairman plus at least one BoM, so `frozenVoters` passes. It checks frozen ⊆ current seats and subject ∉ frozen (:46-48), not current ⊆ frozen, so the missing proposer seat is fine at vote time (:174) and at apply time (`approvalReady` :100-101).
  - `pendingForPrincipal` joins `account_approval_voters` on the caller (:146), so the proposer never sees the ballot.
  - `voteForPrincipal` answers `APPROVER_REQUIRED` («…phiếu này», :175) for a non-frozen seat holder, and the bridge calls the same functions (`bridge.ts:24-27`).
  - `accessChangeTally` counts only frozen voters (:80-87). P8 guarantees at least one BoM, so `bom.every(reject)` cannot be vacuously true.
  - No route lets the excluded seat count.
  - «Cần ít nhất một ghế BoM khác» is case 7 (proposer only) and case 8 (both excluded).
- **No-seat-disclosure** (T7C-3 :211). Case (i) depends only on the caller and the seat table, and runs before every subject check. For a proposer without a seat it reveals only the global readiness that `GET /api/team/approvals` already reveals to every logged-in user (`account-approval.ts:125-126`, #fact). Case (ii) is folded into the single INELIGIBLE sentence.
  - The accepted residual (a seat-holding proposer learns "no other BoM seat is ready", not whose) is acceptable: it names nobody, the caller knows their own seat, and folding it in would leave seat-holding coordinators with a misleading INELIGIBLE for every member.
  - A non-seat proposer can only infer "this visibly active member is ineligible for some reason". The reason is ambiguous among not-activated, outside admin scope, schema failure and seat-holding.
- **OQ-36 (b)+(d)** (Task 2 :468-483):
  - Withdraw is limited to the proposer. R2 returns one 404 for every other caller, the admin included, and for registration ballots and admin ballots (W3). It needs a basis (5–500). The state goes to `expired` with an immutable event.
  - Cancel is admin-only, through `operator` (C3), with a basis. It sits after `expectedVersion` (`accounts.ts:197`) and before `nextVersion` (:199), so it does not touch `account_version`, sessions, invitations, Telegram codes or memberships (C1, mutation c).
  - A co-manager cannot withdraw (W3).
  - Cancel cannot reach a registration ballot (`kind='access_change'`) or an account outside the admin's scope (`validate(before,scope)` :196).
  - The admin cannot use withdraw to bypass OQ-48: R1, and R2 `proposer_id≠admin`.
- **`expired` cannot be misread** (T7C-6). #fact: the CHECK admits it (009 :19). The 019 guard admits only `approved` and unexpired, or `issued` (019 :41-42). `approvalReady` requires `approved` (:98). `pendingForPrincipal` requires `pending` (:149). The `access` lookup requires `approved` (`accounts.ts:209`). `activate` reads only `kind='registration'` (`identity.ts:109-111`). A late vote answers `APPROVAL_CLOSED` (:197-198) or a replay (:193-195). No code reads `identity.events` kinds (#fact, grep).
- **OQ-38 (c) and M1.**
  - Ids are lower-cased at parse, then re-compared with DB ids after load (:139, P2, P8). The self check runs before locks and again after.
  - The sentence is placed in the server-built prefix, ahead of any user text (:182, case 15). It reaches the voter through `reason` (`approvals.tsx:30`). Case 23 pins upper case.
- **M2** is resolved by the decided withdraw and cancel. The version-bump lever is pinned (plan C6).
- **M3, and the lock order** (T7C-5 :213, Global Constraints :151-157). #inference from PostgreSQL's row-lock conflict table, checked against every writer:
  - `FOR KEY SHARE` conflicts only with `FOR UPDATE`.
  - Every `FOR UPDATE` on the admin row is an `operator` transaction, or the admin's own login, pairing or unlink, which hold nothing else.
  - The voter, ballot, outbox (017 :61) and event inserts take `FOR KEY SHARE` through FKs.
  - Votes never take a user-row lock stronger than KEY SHARE.

  With the admin row first, coordinator writes and admin commands never interleave past their first lock. That removes the FK cycle the plan found. #inference: mutation (a) at :439 reproduces that cycle exactly. Without the admin-row lock, the proposal holds NKU on the proposer, waits for KEY SHARE on the admin row at the voter insert, and the admin then waits for the proposer row: `40P01`.

  Per scenario:
  - Admin command on the proposer or on the subject: serialised at the admin row.
  - Two co-managers proposing for each other: both hold KEY SHARE on the admin row (compatible). One `SELECT … WHERE id=ANY ORDER BY id FOR NO KEY UPDATE` locks in sort order, because LockRows sits above Sort and the PostgreSQL docs say ORDER BY is applied before locking. One waits; no cycle.
  - Two coordinator seat holders as each other's voters: NKU versus KEY SHARE are compatible.
  - Withdraw versus apply or cancel: serialised at the admin row.
  - Withdraw versus propose touching the same user: FOR SHARE versus NKU, ordered after the admin row, and neither waits on a ballot the other holds.
  - A vote during withdraw or cancel: the vote holds only the ballot plus KEY SHARE on the voter row.
  - Propose's P15 sweep versus a stale vote: the vote's KEY SHARE on the subject is compatible with NKU, so only the propose waits.

  `FOR NO KEY UPDATE` excludes the admin's `FOR UPDATE` and a second NKU for the same subject. Demotion and disable lock the admin row and the proposer row (`accounts.ts:52`, `:193`). Memberships change only under that lock (`setGrants` :162-168; `users.role` is not updatable by `libetech_identity`, 002 :89). P6 re-reads under the lock, so a demotion either precedes the proposal and is seen, or follows it, which is OQ-37 (c). The remaining cycle is the R3 cancel case.
- **Apply-time check** (S1, Task 3 :542). It runs only when `proposer_id≠admin`. It uses the frozen row that must equal `cmd.grants` and `before` (`accounts.ts:211-213`), so it cannot be bypassed by the request. Admin ballots keep their codes, sentences and event keys (A6). An admin-rotation edge would change nothing, since such ballots already fail `validSeats` on the chairman seat. Not requiring an acknowledgement matches «Áp được» **only** together with N2's state check.
- **Scope of the command** (:337, P8–P11, cases 18–20).
  - Strict zod. Ids are lower-cased.
  - `docTypes` is an enum of 8 types without the prefix.
  - `after` is built on the server from `before`, read under the subject lock, then asserted with `grantsSchema`, `docApprovalDelta` and `widensAccess`.
  - The subject must be an active, activated, non-viewer member of the project, not the admin, and with every entry inside the admin's scope.
  - Every authority fact (proposer role, subject state and grants, admin scope) is read inside the write transaction under the stated locks. Seats are read unlocked; they change only through the operator login.
- **Free text, length.** The fixed parts are 26 and 73 code points, and the maximum is 100 + 73 + 300 = 473 ≤ the 009 CHECK `length(reason) BETWEEN 5 AND 500` (009 :18, #fact). Counting in code points matches PostgreSQL `length()`. `Array.from` truncation cannot split a surrogate pair. The UI uses React text inside `<bdi dir="auto">`, with no `dangerouslySetInnerHTML` (:183, U6, P10).
- **HTTP** (:362).
  - The session comes first (401). Non-GET/HEAD requests are origin-checked (`auth.ts:15-33`).
  - Identity is never taken from JSON: strict schemas, with the actor, tenant and proposer from the session. No `Idempotency-Key` is read (T7C-10 is justified by the DB unique index and the row lock, E-BE-08).
  - Unknown path or method gives the common 404, and `IDENTITY_UNAVAILABLE` gives 503.
  - Only `team/accounts/route.ts` applies grants (:432).
- **Outbox (E-INT-06).** DMs are queued in the same transaction by the unchanged `notifyVoters` (`account-approval.ts:55-59`), and the payload is `params:{}` (case 4). T7C-16 (DMs not recalled) matches today's expiry behaviour.
- **Hard limits respected by the plan text.** It does not modify `account-approval.ts`, `accessChangeTally`, `bot-plugin/`, `AGENTS.md` or `CLAUDE.md`. The body of `proposeAccessChange` is untouched. Existing tests are listed as "no edited expectations". The bot is refused, and roles come from the DB, not from `p.role==='viewer'`. No migration is needed. #fact: the role already has `UPDATE(state,updated_at)` (009 :70) and `identity.events` has no `kind` CHECK (002).
- **Placeholders.**
  - OQ-48 = (a), with cancel only for coordinator ballots. This is the strictest option.
  - OQ-49 = (b), with withdraw and list only while still an active manager of that project. This is the strictest option, and the admin's cancel keeps the ballot from getting stuck.
  - OQ-47 is not the strictest (N1).

A recommendation, not an approval: the Chairman approves merges.
