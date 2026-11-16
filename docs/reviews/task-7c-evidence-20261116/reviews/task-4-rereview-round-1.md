# Task 4 re-review, fix round 1 (4a60823..6525d6b)

Reviewed from the diff file only; the suite was not re-run. Test evidence is the implementer's log (`docs/reviews/task-7c-evidence-20261116/task-4-green.txt`, «Fix round 1»): 5 files / 100 tests pass, typecheck exit 0, 4 extra files / 90 pass, build exit 0. The red log shows assertion failures, not timeouts.

### Finding Verdicts

1. **Code review Important 1 (reload after VERSION_CONFLICT): ADDRESSED.**
   - `src/components/doc-approval-view.ts` adds `reloadProposals(io, withDelegations)`. It reads the approvers first, then the own list, and never throws. `SCOPE_DENIED` gives `denied`, other failures give `failed`, and a failed approvers read comes back as `delegationsError` while the list is still read.
   - `src/components/review.tsx` `reloadOwn(withDelegations)` passes `readDelegations: reloadDelegations`. The button is wired as `onReload={() => void reloadOwn(proposalReloadable)}`, so «Tải lại» beside a reloadable error rereads the approvers and «Thử lại» in the `error` state does not. It returns early when `proposalBusy`.
   - A `delegationsError` sets `proposalError` and `proposalReloadable`, so the user can retry.
   - P16 in `tests/doc-approval-ui.test.tsx` covers:
     - call order `['delegations','own']`;
     - stale `expectedTypes ['design']` against fresh `['design','plan']`;
     - the form showing «Kế hoạch — đang giữ»;
     - «Thử lại» reading `own` only;
     - the network, denied and failed branches;
     - the wiring, pinned by a source grep.
   - The behaviour case the ruling asked for exists.

2. **UI review I-1 (focus): ADDRESSED.**
   - The withdraw input has `autoFocus` (`src/components/doc-approval-proposals.tsx`). The row's «Rút phiếu» takes a ref through `withdrawButtonRef`.
   - «Hủy» is detected in `onDraft` (`patch.withdrawId === null` while `draft.withdrawId !== null`) and sets `focus {to:'withdraw', id}`. The effect then focuses that row's button.
   - After a successful withdrawal, `settle` sets `{to:'list'}`. The effect focuses the `h3` only when `draft.withdrawId === null`. The `h3` has `tabIndex={-1}` in both the list and the `former` state.
   - The effect is a no-op on first render (`focus` starts as `null`), so it does not steal focus on load.
   - The spec gains three unticked «Kiểm tay» focus lines and the `former` to `denied` limit.
   - P18 checks the markup (`autofocus=""`, one occurrence, `tabindex="-1"`). The focus moves are pinned only by source-text greps, because static markup cannot move focus. That is acceptable for this repo's test style, but it is not a behaviour test.

3. **UI review I-2 (error echo): ADDRESSED.**
   - `echo` is `<div className="review-problem" aria-hidden="true">` with a `review-text` paragraph, using existing classes only and no `role`.
   - It sits above «Trình phiếu» and above «Xác nhận rút» inside the open box. The top `role="status"`/`role="alert"` is unchanged.
   - P19 covers the markup directly above the button in both the `ready` and `former` states, the absence of an echo when there is no error, and a count of 2 occurrences of the sentence (one alert plus one hidden echo).
   - The spec records it (mục 1, mục 4, «Kiểm tay»). P13's class allow-list still applies, since no new class was added.

4. **Bundled: «Tải lại» disabled while busy: ADDRESSED.**
   - The button has `disabled={busy}` (`doc-approval-proposals.tsx`, in the `section` helper). P19 asserts `true` and `false`, and the spec says so.
   - `reloadOwn` also has a guard (`if (proposalBusy) return`).

5. **Bundled: `settle` clears the draft only if it is still the sent one: ADDRESSED.**
   - `settledDraft(current, sent, cleared, answer)` returns `current` when `answer === false`. Otherwise it clears only if every cleared field still equals the sent value (compared by `JSON.stringify`).
   - `settle` captures `draft` at click time as `sent`, so a retyped proposal survives.
   - P17 covers false, true, undefined, a retyped basis, changed types, a withdrawal that leaves a proposal alone, and a retyped withdraw basis.

6. **Bundled: three edits in `docs/UI-HANDOFF-3-review.md` match the brief: ADDRESSED.**
   - The layout line now ends «…đặc tả ở `docs/UI-HANDOFF-3-doc-approval.md`.», with the extra parenthetical gone.
   - The Props lines have `ReviewersPanelView` with `approvalNote?` and `ReviewersPanel` without it. `ReviewQueue` has a bare `proposals?` and its comment no longer names the spec.
   - «Việc chưa làm» is a pointer line only.
   - This matches the brief's description (`task-4-brief.md:249`).

### New Breakage in the Fix Diff (severity + file:line, or «None»)

None at Critical or Important. Minor observations:

- **Minor** — `src/components/doc-approval-proposals.tsx`, the `echo` constant (used in the withdraw box and above «Trình phiếu»). When a withdraw box is open in the `ready` state, one error is echoed above both buttons, so a propose-form error also appears above «Xác nhận rút», and a withdraw error appears above «Trình phiếu». This follows the ruling's wording and is visual only, so it is not a defect. The spec could say it.
- **Minor** — `doc-approval-proposals.tsx` `settle`: if `settledDraft` declines to clear a retyped withdraw basis after a successful withdrawal, `withdrawId` still points at a row that has left the list. The box is not rendered, because no row matches. The next «Rút phiếu» overwrites `withdrawId`. This is a harmless stale value and is not caused by this fix.
- **Minor** — `src/components/review.tsx` `reloadOwn` guards only `proposalBusy`. `reloadDelegations` can overlap a command of the reviewers panel (`busy`). That is last-writer-wins on `setDelegations`, the same as the existing `reloadAll`, with no data loss.
- **Check** — `src/components/review.tsx`: the `ApiError` import was dropped. Its remaining uses are not visible in the diff. A grep over the worktree file shows no remaining reference, and the logged typecheck passed.
- `tests/rsc-boundary.test.ts` is in the passing set. `doc-approval-view.ts` adds only a `describeError` import from `review-view`, with no server-only import and no function passed from server to client.
- Wording drift from the brief: none found. The new text is spec prose only.

### Out-of-Scope Observations

- Focus behaviour (P18) and the reload wiring (P16) are partly pinned by source greps. Real focus moves depend on the unticked «Kiểm tay» lines. Chairman or the UI reviewer should do those checks before the lát closes.
- Code review Important 2 (E-OBS-01 fields in the `loadOwnProposals` log line): not judged, as instructed.

### Verdict — **Fix round:** All findings addressed, no new Critical/Important breakage
