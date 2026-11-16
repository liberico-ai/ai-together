# Task 4 UI and accessibility review (step 16b, proposal block)

Range b3742e1..4a60823. Seat: user interface only. Static review of code, CSS and spec; no browser was run, so layout and focus behaviour are `#inference` where marked. Advisory; the Chairman approves merges.

**Verdict:** Needs fixes (two Important findings, both small; nothing blocks the block's logic).

Counts: Critical 0 / Important 2 / Minor 5.

## Findings

### Important

**I-1. Focus is lost when the withdraw box opens, is confirmed or is cancelled.** `#fact` (code), `#inference` (browser effect)
- `src/components/doc-approval-proposals.tsx:56-63`: the «Rút phiếu» button is rendered only when `!open`, and the box (`review-inline`) only when `open`. Clicking the button removes the focused element, so keyboard focus falls to `<body>`; the new input has no `autoFocus` and nothing moves focus to it. «Hủy» and a successful «Xác nhận rút» unmount the box and drop focus again. No `ref`, `focus()` or `autoFocus` exists in the file (grep).
- Why: a keyboard or screen-reader user presses Enter on «Rút phiếu» and lands at the top of the document with no announcement of the new field; they must tab through the whole page to find it. The review brief asks for focus after opening the withdraw box.
- Fix: give the withdraw input `autoFocus` (works on mount, no ref needed) and, on «Hủy», return focus to the row's «Rút phiếu» button through a ref. After success, `role="status"` already announces. Add the check to «Kiểm tay» in the spec.

**I-2. Local validation errors and success notices appear at the top of the block, far from the button that caused them, on a phone.** `#inference`
- `doc-approval-proposals.tsx:30-36` puts the status line and the `role="alert"` box above all content. In `ready`/`empty` the «Trình phiếu» button is at the bottom (line 90), below the list, the 3-sentence 24-hour paragraph (`PROPOSALS_WAIT_COPY`, about 10 lines at 360 px) and the whole form. A sighted person who taps «Trình phiếu» with a missing member, type or basis sees nothing change in the viewport; the message is above the fold. Same for «Đã trình phiếu…» and the withdraw errors. Screen-reader users are fine (live regions).
- The order is what the brief fixes («theo thứ tự từ trên xuống») and the existing reviewers panel behaves the same, so this is a shared pattern, not a regression. It is still a user-misled risk on the narrowest screen.
- Fix (either): move focus to the alert container (`tabIndex={-1}`, `focus()` in an effect when a new error appears) so the browser scrolls to it; or repeat the local error directly above the button. Alternatively record it as a known limit in the spec's «Việc chưa làm» if the Chairman accepts the shared pattern.

### Minor

**M-1. Skeleton name is not exposed.** `doc-approval-proposals.tsx:38` `aria-label` on a plain `div` (no role) is not a supported name target (ARIA 1.2), so «Đang tải phiếu đã trình» is probably not announced; `aria-busy` on a div with no live region also announces nothing. `#fact` (ARIA rule), `#inference` (reader behaviour). Brief-verbatim and the same as the five existing skeletons, so leave unless fixed for all. Fix: `role="status"` on the skeleton, or rely on the always-present status line.

**M-2. Several pending rows give several identical «Rút phiếu» buttons.** `doc-approval-proposals.tsx:56-57`. Context comes only from list position. Fix: `aria-label={'Rút phiếu của ' + name}` would change the verbatim button name the brief and tests use; alternative is `aria-describedby` pointing at the row's name element. `#inference`.

**M-3. Busy state disables the focused button.** `busy` disables «Trình phiếu», «Rút phiếu», «Xác nhận rút», «Hủy» (lines 56, 60, 62, 90). Some browsers move focus to body when the focused control becomes disabled, and the block has no `aria-busy`. `#inference`. Fix: `aria-disabled` plus ignoring clicks, or restore focus after the command (same mechanism as I-1).

**M-4. Heading and group name repeat.** `doc-approval-proposals.tsx:78-79` `role="group" aria-label="Trình phiếu mới"` containing `h3` «Trình phiếu mới» is read twice. Brief-fixed; leave. The panel `section aria-label` + `h2` repeats the same way.

**M-5. `docs/UI-HANDOFF-3-review.md` layout line carries text beyond the brief.** The first edit appends «(câu ghi chú quyền duyệt bản chuẩn ở khối này khi đó là câu của đặc tả ấy)» after the sentence the brief gives. The statement is true, but the brief says the edit adds that sentence only. `#fact`. Fix: drop the parenthesis or have the Chairman accept it. The other two edits (Props, «Việc chưa làm») match the brief; the Props edit also touches the `ReviewersPanel` line, which the brief's file list names.

## Checked, fine

- **Wording.** All visible strings in `doc-approval-view.ts` and `doc-approval-proposals.tsx` equal the brief character for character: the seven state sentences, h2/h3 texts, «Mở trang Quản trị tài khoản», «Thử lại», «Rút phiếu», «Căn cứ rút phiếu (5–500 ký tự)», «Xác nhận rút», «Hủy» (not «Huỷ»), «huỷ» inside the approved note as the brief writes it, «Chọn thành viên», «<tên> · <nhãn vai>», legend, « — đang giữ», «Căn cứ (5–300 ký tự, một dòng)», «Trình phiếu», the three-sentence wait paragraph, local errors, both success notices, the five fixed refusal sentences, `APPROVAL_NOTE_WITH_PROPOSALS_COPY`. No drift found. «Hết hạn lúc» and «Thành viên chưa rõ tên» match.
- **States.** Seven states render as specified; `admin` has one link and no form or button, `error` has alert plus «Thử lại» only, `denied` is one sentence, `former` has the sentence and list but no form and no 24-hour paragraph, `empty`/`ready` order is fixed sentence, list, 24-hour paragraph, form. `approved` rows have no «Rút phiếu»; `pending` rows have it.
- **Landmarks and labels.** `section aria-label`, `h2` then `h3`; `role="status"` always mounted; `role="alert"` for errors; every input is wrapped in its `label`; checkbox group is `fieldset`/`legend`; held boxes are checked, disabled and carry « — đang giữ» in the label text.
- **Enter.** There is no `<form>` and every button is `type="button"`, so Enter cannot trigger «Trình phiếu» or «Xác nhận rút». The cost is that Enter submits nothing; acceptable and stated in the spec (`UI-HANDOFF-3-doc-approval.md:23`). The `/team` hidden disabled default submit button exists (`team-accounts.tsx:114`).
- **User text.** Names render as React text inside `bdi dir="auto"` (line 50); no `style=`, no `dangerouslySetInnerHTML`.
- **Layout (`#inference` from `globals.css`).** Only existing classes. `review-panel`, `review-person`, `review-text`, `review-meta`, `review-check`, `review-person-name` all set `min-width:0` and `overflow-wrap:anywhere`, so long unbroken names and text should wrap and not scroll at 360 px. `.review-action{width:100%}` below 700 px; `doc-action`, `review-action` and `.doc-field` inputs have `min-height:44px`; `review-check` rows are 44 px high with a full-width label. At 700 px and above `.review-inline` goes horizontal with auto-width buttons; «Trình phiếu» and «Rút phiếu» stay full width inside column flex parents, as the spec says. Select options cannot be wrapped in `bdi`; accepted.
- **Handoff spec.** Six sections in the template's shape plus «Kiểm tay» and «Việc chưa làm». Prop signatures, routes, bodies, `loadOwnProposals`, `canProposeFrom`, `DocApprovalProposal` shape (checked against `src/server/doc-approval-proposals.ts:15`), `{approvalId,state:'withdrawn'}`, limit 200, `no-store` headers, and the server sentences in the error table (SELF, ADMIN, INELIGIBLE, APPROVERS_NOT_READY, ACCESS_CHANGE_NOT_NEEDED, VERSION_CONFLICT, both RATE_LIMITED sentences, applied for propose and for withdraw) all match code. The `/team` part (`OpenBallot`, `standingEcho`, `ballotCommand`, `shouldReloadAccounts`, `reloadAfterConflict`, `AccountForm`, hidden disabled first submit, `role="note"` sentence, cancel success sentence, `APPROVAL_NOT_FOUND`, `BALLOT_CANCEL_NOT_ALLOWED`) matches `team-accounts.tsx` and `accounts.ts`. Task 4 does not touch `team-accounts.tsx` (diff stat), as the spec says.
- **Kiểm tay honesty.** Every «Kiểm tay» box is unchecked and the text says the writer ran none; the closing «Kiểm tay chưa làm» line is consistent. The spec should gain a focus check (see I-1) and a note on I-2 if it is accepted as a limit.
