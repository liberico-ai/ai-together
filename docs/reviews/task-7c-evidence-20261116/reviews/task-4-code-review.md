# Task 4 code review (step 16b: proposal block on the Review screen)

Range: b3742e1..4a60823. Reviewer read the brief, the report and the diff file only. Tests were not re-run; no file outside the diff was read.

### Spec Compliance

Verdict: spec compliant, with one functional gap inside a choice the brief left open (Important 1) and one plan-mandated logging gap (Important 2).

Checked against the brief:

- **Files.** All four new files exist. The five modified files and the two evidence logs are present. `src/app/globals.css`, `tests/review-ui.test.tsx` and `tests/review-page.test.ts` do not appear in the diff.
- **Step 5 (T7C-33).** `review-view.ts` has exactly three changes: `APPROVAL_NOTE_WITH_PROPOSALS_COPY`, the new exported `checkBasis`, and `basisCheck` reduced to one call with the four old values (CONTROL, the old forbidden sentence, 500, BASIS_COPY). #fact (diff hunks).
- **Page.** `loadOwnProposals` is called when `delegations` is non-null, with `coordinator: delegations.canDesignate` and `accountAdmin: principal.accountAdmin === true`. It is not behind a `canDesignate` branch (OQ-50 c). `proposals` is passed only when it exists, as JSON, so no function crosses the RSC boundary. There is no `.catch(` and no empty `catch`. #fact
- **`loadOwnProposals`.** `accountAdmin` returns `{state:'admin'}` without calling `read`. A `SCOPE_DENIED` returns `denied`. Any other failure, including a synchronous throw of `read`, returns `error` plus one JSON line. It never throws. #fact
- **Exact wording.** I compared every UI sentence in `doc-approval-view.ts` and `doc-approval-proposals.tsx` with the brief: title, admin, error, denied, former, empty, coordinator note, the three-sentence wait paragraph, the approved note, the co-manager sentence, both notices, the withdrawal and basis labels, the fieldset legend, « — đang giữ», and the five fixed refusal sentences. All match character for character.
- **Request bodies.** `proposeBody` has the five keys. `withdrawBody` has `reason` only, so the ballot id is in the path only (T7C-31). The path id goes through `encodeURIComponent`. No actor, tenant or role is accepted from the client. #fact
- **Approved row.** It has the approved note and no «Rút phiếu» button (OQ-51 b). `withdrawCommand` also refuses an `approved` row. `former` has the list and no form.
- **Classes.** Only the allowed classes are used. P13 pins them. No `style=`, no `dangerouslySetInnerHTML`.
- **Names.** Names in list rows are in `<bdi dir="auto">`. The `<option>` text is plain, as an option can only hold text.
- **Handoff.** `docs/UI-HANDOFF-3-doc-approval.md` has the six sections, «Kiểm tay» with all boxes empty, and «Việc chưa làm». `docs/UI-HANDOFF-3-review.md` has the three changes asked for, and the props line also covers the second component.

P1–P15: all fifteen are present under the brief's names and cover what the brief lists. P5 and P8 add useful extras (raw cap with spaces at both ends, trailing LF, keys `toString` and `__proto__`).

⚠️ Not verifiable from the diff:
- The handoff claims about CSS (`overflow-wrap:anywhere`, `width:100%`, ≥44 px for `review-check`) and about Task 3 code in `team-accounts.tsx` (`OpenBallot`, `standingEcho`, the hidden disabled submit). The brief gave no file for them.
- The withdraw `RATE_LIMITED` rows in the table (10 per hour, rejected attempts counted). They come from Task 2.
- The manual 360 and 1280 px check, which is correctly left unmarked.

### Strengths

- The split is clean: pure helpers in `doc-approval-view.ts`, a hook-free `DocApprovalPanelView`, a thin stateful `DocApprovalPanel`, and `loadOwnProposals` in the server helper file. The page stays a data-only adapter.
- `canProposeFrom` (concern 4) is a real bug found by self-review. A coordinator whose first read failed would have seen `denied` or `former` after a successful «Thử lại». The fix is small, pure and pinned in P11. The report is honest that red was shown by restoring the old logic. I judge concern 4 correct.
- The red evidence is made of assertions. Stage A is load failure, stage B is 15 `AssertionError`s with 0 other errors and 0 timeouts, and stage C is one `AssertionError`.
- The draft is kept on every error. It is cleared only when the command does not answer `false`, and only its own part (concern 2 is a sound reading).
- A command that succeeded but whose reload failed is still reported as success, with a reload alert (concern 3). This matches the existing `panelReloadFailure` rule.
- `FIXED` is a `Map`, so codes named `toString` or `__proto__` are not mistaken for known codes, and a test pins this.
- `checkBasis` has one rule for both boxes and the server-side order: forbidden class on the raw text, then the cap on the raw text, then the floor after trimming U+0020.
- Other concerns judged on merit:
  - 1, 5, 7, 8, 11 and 12 are fine.
  - 6 (`input type="text"`) is right, since LF is forbidden.
  - 9 is acceptable.
  - 10 is acceptable and documented.
  - 13 is good practice.
  - 14 is fine.

### Issues

#### Critical

None.

#### Important

1. **`src/components/review.tsx` (`reloadOwn`, `onReload` of the block) with `src/components/doc-approval-view.ts` (`FIXED`, `proposalFailure`): a dead end after `VERSION_CONFLICT`.**
   - What: the refusal text is «Quyền duyệt của người này đã đổi. Tải lại trước khi trình.», and the block offers «Tải lại». That button runs `reloadOwn`, which reads only `GET /api/team/doc-approvals`. `expectedTypes` is computed from `delegations.approvers`, which is the page snapshot (or the last reviewers-panel reload). So after pressing «Tải lại» the form sends the same stale `expectedTypes` and gets the same `VERSION_CONFLICT`, until the whole page is reloaded. #fact (diff: `heldTypes(approvers, …)` fed from `delegations.approvers`; `reloadOwn` touches `own` only). Concern 4 and the handoff §4 say «Tải lại» does not reread roles, but neither mentions that it does not reread the approver list either.
   - Why: the one conflict the form can hit for stale held types cannot be cleared from the screen, and the sentence tells the person to do something that does nothing. This is the same class as the T7C-11 reload-after-conflict loop the plan built for `/team`.
   - Fix: when the failure is `VERSION_CONFLICT`, have the block's reload also call the existing `reloadDelegations()` of `ReviewQueue` (or `reloadAll`), so `approvers` is fresh. Add a behaviour case. Update handoff §4. If the brief's «three operations» is the constraint, take it to the session: the brief is silent on this and the result is still a defect.

2. **`src/server/review-page.ts` (`loadOwnProposals`, the `console.error` line): E-OBS-01 fields missing (plan-mandated).**
   - What: the line has `level`, `event` and `errorType` only. E-OBS-01 asks for `timestamp`, `level`, `message` and `request_id`. The brief fixes the shape and P12 pins the exact keys `['errorType','event','level']`, so the builder followed the brief.
   - Why: under the stated rubric a log line without a timestamp and message is a defect, although a page render has no request id to hand.
   - Fix: add `timestamp` and a fixed `message` (no name, no basis) and update the P12 key list. Or record an explicit E-OBS-01 exemption for page-render logs in the brief.

#### Minor

1. **Tests do not exercise the stateful paths.** The three stateful paths are:
   - `DocApprovalPanel.settle` (draft cleared only on success).
   - `ReviewQueue.reloadOwn`.
   - `ReviewQueue.proposalCommand` (notice after reload, reload-failure alert).

   They are covered only by `readFile` substring checks (P11) and by pure functions, because the test style is static rendering of hook-free views, as the brief prescribes. "Draft kept through every error" and concern 3 are therefore unproven by a behaviour test. Fix: add a small driven case for `settle` (a promise resolving `false` keeps the draft) or extract the decision into a pure helper. Also extract `reloadOwn`'s `SCOPE_DENIED → denied / else error` decision (concern 5) so it can be tested.
2. **`src/components/review.tsx` (`reloadOwn`, `proposalCommand`): concurrency.** «Tải lại» is not disabled while `proposalBusy`. A reload started during a pending command clears `proposalError`, flips the block to `loading` (which hides the form), and can finish after the command's own reload and overwrite the list with an older read. Fix: ignore or disable the reload while busy, and the command while `ownLoading`.
3. **`src/components/doc-approval-proposals.tsx` (`settle`).** After the await the clear is applied to whatever is in the form now. A person who starts a new proposal while the first is in flight loses it. Same pattern as `ReviewersPanel`, so low risk; busy disables the buttons, not the inputs.
4. **Operational noise: no identity service configured.** In that case (including the demo mode) every non-admin view of the Review page for a project with a reviewers panel shows the load-error block with «Thử lại» that can never succeed, plus one log line per render. This is what the brief specifies (edge case documented in handoff §6), so I record it only as a known cost.
5. **`ReviewQueue` growth.** It gained about 50 lines and a second state machine (seven `useState`) beside the panel one. Acceptable for this task. If the component grows again, move the proposal state into a `useProposals` composable (E-FE-02 spirit) so `review.tsx` is not both the screen and the transport.

### Assessment

Spec: compliant. Strengths: clean split, honest red evidence, a real bug found and fixed in review, exact wording throughout.

**Task quality:** Needs fixes. Important 1 (a conflict the screen cannot clear) should be fixed before the task is trusted. Important 2 is a plan-mandated gap that needs the Chairman's or the session's call, not only a builder change.
