# Review — OQ-27 / OQ-28 / OQ-29 applied (slice 2, uncommitted on top of 917c8b0)

Reviewer: advisory task gate (not a merge review, not an approval). Scope: `src/` and `tests/` diff in
`oq-decisions-review-package.md`, checked against `oq-decisions-brief.md`, `docs/OPEN-QUESTIONS.md` OQ-27/28/29,
`docs/plans/slice-2-intake-outbox.md` S13/S14 (and the Task 9 lines :441, :453). I confirmed the package matches the
working tree (`git diff --stat 917c8b0 -- src tests`: same 19 files and counts). I did not re-run the suite.

Tags: `#fact` = read in code or log at the cited line. `#inference` = reasoning from those facts.

---

## Part 1 — Spec compliance: ❌ (one UI item wrong; everything else matches)

### A. OQ-27 — ✅
- Test renamed exactly: `tests/intake.test.ts:177` `#fact`.
- Comment added: `src/server/intake.ts:48` `#fact`.
- No other placeholder wording for the multi-project refusal in `src`/`tests` (grep for placeholder/giữ chỗ + ambiguous/OQ-27: 0 hits) `#fact`.

### B. OQ-28 — ✅
- `bridge-config.ts:5,10,18`: type, strict schema `excerptChats:z.array(chatId).optional()`, subset check with the exact
  message `Intake excerpt chats must be a subset of intake chats.` `#fact`.
- `intake.ts:39` constructor takes `intake:{chats;excerptChats?}` in the same position; `:44` uses `this.intake.chats` `#fact`.
- `intake.ts:63-67`: `flagged` from `excerptChats`; mapping read only when flagged; `excerpt` only when `flagged && mapping!=='IBS_HI'`;
  comment names OQ-28 (c) and both fail-closed rules `#fact`. `LIBERICO_BU`/`XECA` no longer decide anything (grep: the only
  remaining domain-label use in `src/server/intake.ts` is the `IBS_HI` clause) `#fact`.
- `bridge-io.ts:22` passes `i` `#fact`. Only construction site in `src` (grep `new IntakeService`) `#fact`. Every test
  constructor updated; typecheck green in `oq-decisions-green.log` `#fact`.
- `tests/slice2-fixtures.ts` untouched (`git diff --quiet` clean), so the default stays unflagged `#fact`.
- `inbox.ts:132` comment reworded as asked `#fact`.
- Tests: the four OQ-28 tests at `tests/intake.test.ts:186,195,204,213` each assert `content_mode`, `text_excerpt` and
  `content_hash ~ /^[a-f0-9]{64}$/`. The body-flag test covers all three shapes, ZodError + `allZero()`, then a normal `pointer_only` ingest `#fact`.
  Credential test (`:251`) now uses a flagged group `#fact`. inbox-service `newest revision`, `M1`, `M2` switched to a flagged
  intake; M1 intent kept `#fact`. Config test `tests/bridge-io.test.ts:66`; the 503 case is in the existing Sec M1 pattern
  (`tests/bridge-limits.test.ts:68`, `requireBridgeConfig`), as the brief allowed `#fact`. Wiring test `tests/bridge-limits.test.ts:169`
  drives `handleBridgeIo` with a signed `/api/bridge/intake/events` request, once with the flag and once without `#fact`. S10 (`:227`) unchanged and green `#fact`.
- Synthetic ids only (`-1000000000002`, `-1000000000004`, `-1000000000099`, fixture chats) `#fact`.

### C. OQ-29 — ❌ (server and tests ✅; UI copy item C.3 for `team-accounts.tsx` wrong)
- `account-approval.ts:61-73` `tally` unchanged byte for byte (`git diff -U0` shows only additions after :74) `#fact`.
- `accessChangeTally` at `:77-89` follows the brief: rejected if Chairman rejects (S13) or every frozen BoM rejects; else
  approved on ≥1 BoM agree; else pending; Chairman's agree never counts; `required:'1bom'` `#fact`.
- `tallyFor` (`:91`) used in `approvalReady` (`:102`), replay branch (`:195`), fresh-vote branch (`:205`). These are the only callers (grep) `#fact`.
- `approvalReady` message per kind, same code/status `#fact`. `validSeats`, `verifiedApprovalSeats`, `frozenVoters`, voter insert and expiry unchanged `#fact`.
- `accounts.ts:276` returns `required:'1bom'`; doc comment `:251` updated; `:132` unchanged `#fact`.
- `approvals.tsx:36` approved notice for `change` is the exact text asked for `#fact`.
- **Missing:** `src/components/team-accounts.tsx:86` (the `propose_access_change` notice) still reads
  «Đã trình phiếu đổi quyền. Anh và ít nhất một thành viên BoM chọn Yes trên nền; …». The brief (C.3) asked for
  «Đã trình phiếu đổi quyền. Cần ít nhất một thành viên BoM chọn Yes trên nền; quyền chưa đổi cho tới khi áp quyền đã được duyệt.» `#fact`.
- **Misunderstood / Extra:** the hunk changed `src/components/team-accounts.tsx:65`, the **registration** notice
  (`kind==='approve_registration'`), from «Anh và ít nhất một thành viên BoM chọn Yes» to «Cần ít nhất một thành viên BoM chọn Yes».
  Registration still needs Chairman + one BoM (`tally`, `accounts.ts:132` `required:'chairman+1bom'`). The brief says registration wording
  stays as it is `#fact`. The report's claim «team-accounts notice per brief» (report :14) is therefore not true `#fact`.
- Tests in `tests/access-change.test.ts`: header `:12-14` updated; `:72` renamed and changed (one BoM, no Chairman → approved;
  apply → `issued`, version +1, session revoked, `required:'1bom'`); `:112` Chairman-alone (pending + `approvalReady` refuses 409);
  `:120` BoM-rejection pending/closing, plus a second ballot where reject then agree gives approved; `:145` Chairman rejection kept;
  `:135` registration still needs Chairman `#fact`. `onboarding-feedback` and `account-approval-dm` unchanged (`git diff --quiet`) `#fact`.
- Naming note (not counted): the plan checklist `docs/plans/slice-2-intake-outbox.md:453` names
  `the first-registration ballot still needs Chairman and one BoM`; the code uses the brief's name `a registration ballot still needs Chairman and one BoM`.
  The controller should align one with the other.

Constraints: no actor/tenant/project/flag from request JSON (the body-flag test proves the strict schema rejects them) ✅.
Write path unchanged (transaction, `FOR UPDATE` on the ballot `account-approval.ts:172`, vote insert + `identity.events` audit) ✅.
`AGENTS.md`, `CLAUDE.md`, migrations, `bot-plugin/` untouched ✅. Codex round-3 lines (`intake.ts:84` revision excerpt,
`LATEST_REVISION_ORDER` `:28`) untouched ✅.

---

## Part 2 — Quality findings

### Critical — none.

### Important

**I-1 · `src/components/team-accounts.tsx:86` — the access-change notice still tells the Chairman his Yes is needed.**
`#fact`: the text is «Anh và ít nhất một thành viên BoM chọn Yes trên nền». Under OQ-29 and S13 (`account-approval.ts:84-85`) the Chairman's agree never counts.
Failure scenario `#inference`: the Chairman proposes a widening on `/team`, reads the notice, and decides to withhold his Yes so the change
"waits for him". One BoM agrees, the ballot turns `approved`, and an admin can apply it. Withholding a Yes stops nothing; only an explicit No while the
ballot is pending closes it (S13). The screen misstates who can authorize a widening of access.
Fix: replace with the brief's exact text (C.3).

**I-2 · `src/components/team-accounts.tsx:65` — the registration notice now says one BoM is enough.**
`#fact`: «Đã tạo phiếu. Cần ít nhất một thành viên BoM chọn Yes trên nền.» on `kind==='approve_registration'`. The same page still says
Chairman + BoM at `:66`, `:102` («Anh: … · BoM: …/1 tối thiểu»), `:111` and `:116`, and `tally` still requires the Chairman.
Failure scenario `#inference`: the Chairman creates a registration ballot, reads that one BoM is enough, does not vote. A BoM agrees and the ballot stays
`pending`. `issue_approved_registration` is refused with `APPROVAL_NOT_READY` until the Chairman votes or the 48 h expiry. This is fail-safe on the
server but it contradicts the page itself and stalls onboarding. Fix: restore `:65` to the 917c8b0 text
(`git show 917c8b0:src/components/team-accounts.tsx` line 65).

**I-3 (deferred, OQ-30, not a defect of this task) · `src/server/intake.ts:84` — a routine config edit now reaches the round-3 P1 path.**
`#fact`: the revision excerpt uses the mode computed at each ingest (`:84`, unchanged per brief). Runtime roles have only `SELECT` on
`project_domain_mappings` (`migrations/016_intake_inbox.sql:253`, `migrations/013_project_registry.sql:101`).
`#inference`: before this diff, an event's mode could change after its first ingest only through a new mapping row. With no runtime write path,
that needed an owner-level insert. After this diff, adding a group to `intake.excerptChats` is enough. The next edit of any message first stored as
`pointer_only` writes its text into the immutable `source_event_revisions`, while `source_events.content_mode` stays `pointer_only`. That breaches S10
(the Inbox hides it via `inbox.ts:133`, but the text is stored). This is already recorded in the OQ-30 addendum (`docs/OPEN-QUESTIONS.md:342`). Do not fix it here.
Recommendation: attach it to the OQ-28 «Điểm dừng» for real flag values. Until OQ-30 is decided, do not add to `excerptChats` a group that already has
`pointer_only` events.

### Minor

**M-1 · RED evidence overstated for OQ-28 (`oq-decisions-red.log:453-537`, report :24).**
`#fact`: the four OQ-28 intake tests and the credential test failed only with
`TypeError: this.intakeChats.includes is not a function` (28 occurrences). They did not fail on behaviour. The report calls them "behaviour-level reds".
The genuine behavioural reds are the wiring test (`red.log:146-160`: flagged config gave `pointer_only`), the config tests and the access-change tests.
`#inference`: the new tests do discriminate. The old rule (`mapping==='LIBERICO_BU'||mapping==='XECA'?'excerpt'`) would fail
"unflagged + XECA → pointer_only", and dropping the `IBS_HI` clause would fail `:204`. So only the evidence is weaker, not the tests.
Fix (optional): note it in the report, or rerun those tests once with only the old content-mode lines restored.

**M-2 · `src/server/bridge-io.ts:22` passes the whole intake config, including the HMAC `key`, into `IntakeService.intake`.**
This is what the brief asked for. The parameter type narrows what is read, and I found no path that logs or serializes the service.
Least-privilege option: pass `{chats:i.chats,excerptChats:i.excerptChats}`. Do not block on this.

### ⚠️ Could not verify from the diff
- I did not see the full 917c8b0→working-tree diff of `tests/access-change.test.ts:12-14` beyond the package. The package hunk shows the header rewritten; I took it as shown.
- Whether the real gateway ever sends unknown keys that the strict event schema would now reject is a question about the existing schema. This diff does not change it.
- UI copy is not covered by any test (grep `tests` for these strings: 0 hits). I-1 and I-2 would not be caught by the suite.

---

## Implementer concerns — verdicts

1. **`approvals.tsx:46` extra wording change — accept.** It is in scope: brief C.3 says to grep `src` for other access-change text stating
   Chairman + BoM and fix only access-change wording. The old line said every ballot needs Chairman + BoM. The new line keeps registration as it was
   and states one BoM for access change. «một trong ba thành viên BoM» matches the three `bomSeats` (`account-approval.ts:9`).
2. **`accounts.ts:198` left as «Chairman và một thành viên BoM» — correct to leave.** That refusal is on `access` for a not-yet-activated
   account. Such an account cannot get an access-change ballot (`proposeAccessChange` requires `user.activated`, `accounts.ts:254`). Its scope is
   re-submitted through a registration ballot, which still needs Chairman + one BoM (`tally`, `accounts.ts:132`). Not an OQ-29 path.
3. **Approved at the first BoM agree; later votes get `APPROVAL_CLOSED` — acceptable, follows from the decision.** It matches registration today:
   after approval the remaining voters get `APPROVAL_CLOSED`, and `approvals.tsx:48` reloads the list on that error. Side effect for the Chairman to
   know (`#inference`): once one BoM agrees, the Chairman's S13 rejection is no longer possible. His remaining control is not to apply the change.
   The approved ballot then blocks a new proposal for that account until it expires (48 h) or the account version moves (`accounts.ts:258-263`).
   Report this with S13, which is still waiting for confirmation.

---

## Verdict
**NEEDS WORK** for this task gate: fix I-1 and I-2 (two string literals in `team-accounts.tsx`); I-3 is deferred to OQ-30 and should be
carried into the real-flag stop point. Server logic, config, wiring and tests for OQ-27/28/29 match the brief.
