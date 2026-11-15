# Task 7b — security, spec-compliance and quality review (base c43b9b0, head 1163572)

Scope: the diff only, plus the named risks below (each one focused check). No test run, nothing mutated. #fact = read in code or in the evidence logs; #inference = reasoned.

Named risks checked outside the diff: `src/server/accounts.ts:100-120,195-262` (submit path, widening rule, ballot match), `src/server/access-grants.ts` (shared `widensAccess`, `docApprovalTypes`), `src/server/account-approval.ts:120-145` (card source), `migrations/019_document_approver_grant.sql` (CHECK and guard trigger), `src/app/team/page.tsx`, `src/app/globals.css:29-33`, `tests/rsc-boundary.test.ts`. `git diff --stat c43b9b0 HEAD -- src/server bot-plugin migrations` is empty (#fact).

### Spec compliance
- ✅ Account form draws eight boxes per project, name `<projectId>-report`, value `doc_approve:<type>`, `defaultChecked` from `initial`: `src/components/team-accounts.tsx:424-428` (in the diff, Grants).
- ✅ Registration form has none: its `<Grants projects={projects}/>` has no flag (diff, team-accounts `request` block); the single `withDocApproval` use is the existing-account form (`:473`). The server also refuses a registration carrying the code: `accounts.ts:115-116`, 422 (#fact).
- ✅ `readGrants` exported and returns every checked box including the codes (`:446-452`); `expandsAccess` still the shared `widensAccess`.
- ✅ `permissionLabel` extended in place, no second table; names come from `TYPE_NAMES` (`grant-labels.ts`, `approvals.tsx:5,12`).
- ✅ Card splits two groups, old-only ballots unchanged (golden), unknown codes stay in the report group as themselves.
- ✅ No new route/command/voting rule; protected paths untouched. No Task 7c path in the diff.
- ✅ Subject's project_role set explicitly to engineer; the viewer persona is not reused except in the one case that is about viewer.
- ⚠️ Not verifiable here: real rendering of the nested fieldset (no browser), hydration of `defaultChecked` in a real browser.

### Strengths
- The fix for the silent reduction is the right shape: the boxes are rendered from the account's grants and read back with the same field name, so there is no second code path that could diverge from the submit path.
- Server remains the authority and was re-verified: widening needs an approved, version-frozen ballot whose grants equal the submitted set (`accounts.ts:207-214`); the DB CHECK admits only the eleven known codes and a trigger admits a `doc_approve` code only with an approved/issued ballot (migration 019). Client-side `expandsAccess` is advisory only.
- Card and apply step read the same column: card from `a.grants` (`account-approval.ts:131-136`), apply compares `ballot.grants` with the submitted set (`accounts.ts:211`). They cannot show one thing and apply another except for the fixed-order/de-dup presentation, which is harmless.
- Golden comparison is genuine: the red run (`task-07b-red.txt`) shows the golden case and the "rendered as text" case passing against the unchanged `approvals.tsx` while the card case fails with the old raw `doc_approve:design` text. So the golden file matches pre-change output (#fact from the log). It is synthetic ("Thành viên Thử", "thu", "Dự án A/B"); no personal data.
- The flow file drives the real services and re-reads the DB (membership row, pointer, `review_decisions.authority`, event count) rather than trusting return values.
- Text is rendered through React text; the test with `<img onerror>` / `<b>` / `<i>` names pins escaping. No logging added. Client imports (`access-grants`, `documents-view`) are pure modules; `rsc-boundary` stays valid.

### Findings

#### Critical
None.

#### Important
None.

#### Minor
- **M1. Nested fieldset legend carries no project name.** `team-accounts.tsx:424` (diff). Each project block repeats the legend "Duyệt bản chuẩn theo loại tài liệu"; the project name lives only in the `<label>` wrapping the role select, which is not an ancestor group. A screen-reader user tabbing through gets "Phạm vi dự án group, Duyệt bản chuẩn theo loại tài liệu group, Thiết kế checkbox" twice and cannot tell which project the box grants. The three old checkboxes have the same pre-existing gap, but these boxes confer approval authority. Smallest fix: legend text `Duyệt bản chuẩn — {project.name}` (or `aria-label`/`aria-labelledby` on the nested fieldset). Admin-only screen and the server needs a ballot anyway, so this is a mis-tick risk, not an exposure.
- **M2. Card lists both sides in full; the added types are not marked.** `approvals.tsx:13-18`. Binding rule says voters see what is added next to the current grants; that is met by two lists, but with up to eight types the voter must diff by eye. Not a defect; a later improvement (e.g. «thêm: Kế hoạch») would remove the mis-reading chance. Do not change now without the Chairman's copy decision (the « · » wording is the implementer's choice and pinned by tests).
- **M3. A viewer-role grant that carries a code reads as granting approval.** Card text "Chỉ đọc, duyệt bản chuẩn: Thiết kế" can be taken as "will be able to approve" while the server rule makes a viewer not an approver (flow test proves it). Misreading is in the safe direction (over-states), so Minor. Optional copy note; not for this task.
- **M4. Test comment/coverage gap, `tests/doc-approver-ui.test.tsx` (case "ticking…", the `other` block).** The comment says "a code on another project is another widening" but the assertion proves only that a box ticked on a project with no role chosen produces no grant (`readGrants` skips it). No case holds codes on two projects and saves an unrelated change, nor ticks a code on a second project that has a role. The code handles it (per-project loop, same name scheme), so this is a missing proof, not a bug. Smallest fix: one `held` with two projects and codes on both, round-trip untouched; reword the comment.
- **M5. Source-text assertions are brittle.** Same file: `expect(source).toMatch(/<Grants projects=\{projects\} initial=\{user\.grants\} withDocApproval\/>/)` and the `<Grants` count break on harmless reformatting; they do give a real guard that no second form switches the flag on. Acceptable; note for whole-branch review.
- **M6. Weak assertions in the flow file.** `tests/doc-approver-flow.test.ts`: `await expect(apply(...)).rejects.toThrow()` for the past-deadline case (no code asserted; the next line asserts `TELEGRAM_APPROVAL_REQUIRED` only after `state='expired'`), and the "second decision on the same revision" line calls `failure(...)` without asserting the code. The state assertions after them (pointer, counts) do carry the proof.

### Questions that are not the session's to decide
- None new. Existing: OQ-29 readings and S13 still "waiting for Chairman confirmation"; this task adds no voting rule. Task 7c (coordinator proposing) is a separate PR by Chairman decision; none of its path is here.

### To check by hand in a browser
1. `/team`, an account that holds `doc_approve:design` + one report permission, two projects: boxes drawn ticked as held; change only the reason field and a report permission, click «Lưu quyền»; reopen: the code is still there.
2. Same account, untick only «Thiết kế»: button reads «Lưu quyền», code gone after save. Tick a new type: button switches to «Trình phiếu đổi quyền»; after proposing and approving, reload the page and confirm the admin must re-tick exactly the same set for «Áp quyền đã được duyệt» (pre-existing UX; the server compares the set).
3. Nested fieldset at 360 px: eight labels («Mục lục dự án», «Phiếu thay đổi», …) wrap inside `.team-form fieldset` (`min-width:0`, 12px padding); no horizontal scroll; legend wraps.
4. Screen reader or accessibility tree: what is announced for a box (see M1).
5. `/approvals` card with all eight types on a 360 px width: the single long line wraps without clipping; compare the "current" and "proposed" lines.
6. Registration pending entry: its form shows only the three old checkboxes, no «Duyệt bản chuẩn».

### Checked and found safe
- **Silent reduction.** Every held code is one of eight known values (DB CHECK, migration 019), and all eight are drawn for every project in `projects`, so an unknown/future `doc_approve:<type>` cannot be held today and cannot be dropped; a new type needs a migration plus a UI change, caught by the 8-type test and `DOC_APPROVAL_TYPES` shared list. Several projects: loop over `projects`. A project whose select is left "Chưa cấp" drops the whole grant (an explicit revoke, existing behaviour, matches the implementer's note). Role changed down to viewer keeps the codes (a pure reduction by `widensAccess`; a viewer is not an approver). Grants change between load and submit: `expectedVersion` is checked first (`accounts.ts:102`), and `access` re-reads `before` from the DB, so a stale form cannot overwrite; a widening needs the exact ballot set. Accounts with a membership on a project missing from the admin's list are refused by `validate(before,scope)` (`accounts.ts:100`) rather than silently trimmed, as far as scope equals the page's project list (#inference; pre-existing, not changed here).
- **Other forms/actions that post grants.** In `submit` only `access` and `propose_access_change` send `grants`; role change, disable/enable, revoke sessions, reissue, GitHub verify/unlink do not (and the role/permission edits all live in the same `Grants` block). The registration `review` sends `readGrants` of a form without document boxes, and the server rejects the code there anyway.
- **Voter versus applied.** One source column; unknown-type codes are not hidden (they appear in the report group as themselves); order is fixed by `DOC_APPROVAL_TYPES`; the same code listed twice shows once (presentation only; `setGrants` de-duplicates as before). Nothing from ballot data reaches HTML (no `dangerouslySetInnerHTML`; escaping test present).
- **No new way to obtain approval.** No control for a coordinator or the subject (`list` excludes the caller's own account, `accounts.ts:65`; the proposal route is account-admin only; the screen is gated on `accountAdmin`, `team/page.tsx`). Server repeats: self-scope via `validate`, widening needs an approved version-frozen ballot, registration refuses the code, DB trigger requires an approved/issued ballot row.
- **Secrets/hygiene.** No tokens or credentials in the diff; fixtures use `fixture-hash`/`test-fixture`; evidence logs use `<worktree>` and synthetic ids; golden file synthetic. No personal data in logs (no logging added).
- **Mutation proof.** Mutation 2 (boxes not drawn) turns three UI cases red including the S84 case and shows `reportPermissions: []` where `doc_approve:plan` was expected, which is the drop. The implementer's honesty note about the red cause is accurate (#fact from `task-07b-red.txt`).

Cases whose teeth I doubt: flow "per document type and per project" (the transport 404 comes from scope, not from the grant; the type check is carried by the plan-doc refusal, which is real); flow "pending, rejected or expired" (expired-by-deadline assertion is `toThrow()`); UI "ticking…" for the second-project clause (M4). The seven flow cases got one mutation in total (apply step removed), so the others have no demonstrated teeth beyond the state assertions I read; the "reducing" case would fail if the server read the principal's session grants, and the viewer case would fail if the approver list ignored project_role, as far as the assertions go.

### Assessment
No exploitable path found; server enforcement was re-read and does not depend on the client. Remaining items are accessibility copy and test hygiene.

**Security verdict for Task 7b:** Approved
**Task quality:** Approved (six Minor notes; M1 is worth fixing before pilot, the rest can go to the whole-branch review)
