# Scoped re-review: N1 fix (commit 4f7e000, base 56a7362)

Scope: `src/components/doc-approval-view.ts`, `src/components/review.tsx`, `tests/doc-approval-ui.test.tsx`, `docs/UI-HANDOFF-3-doc-approval.md`, the negative-case table. Read-only; suites not re-run (evidence in `docs/reviews/task-7c-evidence-20261116/codex-fix1b-*.txt` taken as recorded, not re-verified).

## Answers

**1. Is N1 resolved? Yes (#fact, read in code).**
- `reloadDelegations` now reads with `.catch(rereadFailed)`. `rereadFailed` calls `setProposals(p => standingAfterRereadFailure(p, e))`, then rethrows the same error. `standingAfterRereadFailure` is `ApiError` with code `SCOPE_DENIED` → `standingAfterReread(initial, false)`, else the same reference.
- With a `ready` standing, `canPropose` becomes false, so `proposalPanelState` gives `former` (own ballots left) or `denied` (none). The `section()` wrapper in `src/components/doc-approval-proposals.tsx` renders the error line and the «Tải lại» button before the state branches, so both stay in `former` and `denied`.
- Callers:
  - `reloadAll`: its own catch sets `panelError` from the rethrown error, as before.
  - `reloadProposals` (called from `reloadOwn`): it already swallows the delegations error into `delegationsError`. `reloadOwn` then sets `proposalError` and `proposalReloadable`, and still reads the own list (OQ-50 c).
  - `command()`: `panelReloadFailure(e)` receives the same error, so the panel line and «Tải lại» are unchanged.
- `reloadProposals` runs the reread first, so the standing flips before the own list is applied. No ordering problem found.
- The form is not shown to someone the server would refuse, on every path where the reread actually ran and was refused. The one exception is the path in Q5.

**2. Non-scope failures: no change.** TypeError, 500, `RATE_LIMITED`, a plain `Error` and a non-`ApiError` object with code `SCOPE_DENIED` all return the identical reference. The updater `p => p` bails out of a re-render. The rethrow is the original error object, so every caller shows what it showed before. The one new behaviour is `SCOPE_DENIED` on the reread for a coordinator whose project left their scope. That gives `former`/`denied`, which is right, since they cannot propose either.

**3. P21: pins the behaviour well, the wiring adequately.**
- Behaviour: asserts `former` and `denied` via `proposalPanelState` + `canProposeFrom` with a stale `canDesignate=true`, equality with `standingAfterReread(…, false)`, the six non-scope inputs, and the `admin`/`undefined` pass-through. It also asserts through the real `reloadProposals` that the error text survives. A regression in the mapping goes red.
- Wiring: two string checks. One is the exact `rereadFailed` body. The other is a regex requiring `.catch(rereadFailed);` before `setDelegations(fresh);` inside `reloadDelegations`. Dropping the catch, renaming it or changing its body goes red. The review author recorded the test red first with 2 AssertionError lines.
- Gap (Minor): the wiring is pinned by source text, with no render of `ReviewQueue` through a refused reread. The three callers' error lines are not asserted end to end, only `reloadProposals` is. The regex would also pass if `rereadFailed` were defined but its `setProposals` updater were later made a no-op elsewhere. The exact-string check on its body covers that.

**4. Spec sentences match the code.** The signature and description of `standingAfterRereadFailure`, the `rereadFailed` wiring sentence, the «Việc chưa làm» item and the negative-case row N1 all match. Two small wording points are in the Minor findings.

**5. The recorded narrower path: description accurate, but slightly under-stated; one more reachable variant.**
- Described path (own list `error` at page open → «Thử lại» ok → demotion → reread refused): confirmed. `standingAfterReread` returns `error` and `denied` unchanged, so `canProposeFrom` falls back to the stale `delegations.canDesignate`, and the form shows.
- Same root, no refused reread needed: `error` at open → demotion → «Thử lại». The own list reads fine (OQ-50 c) and, with `proposalReloadable` false, no reread of the panel happens. The form shows without any `SCOPE_DENIED` having been seen, so no client information exists in that variant.
- Also: after a refused reread, `setDelegations` is never called. The reviewers panel keeps its stale `canDesignate` (see Out of scope).

## Findings

| # | Severity | Finding |
|---|---|---|
| 1 | Minor | In the recorded path (own-list `error` state, refused reread), the client has seen `SCOPE_DENIED` and still shows the form. That is literally in tension with the binding constraint "never show the form when the client has the information to know it". The server refuses (`MANAGER_REQUIRED`), the path is narrow and documented. Closing it would need a small client flag, e.g. "panel read refused for scope", read by `canProposeFrom`. A product decision, not a defect of this commit. |
| 2 | Minor | Spec «Việc chưa làm» item names «Thử lại» then a refused reread. The variant with no reread at all (see Q5) shares the root cause but is not mentioned. One clause would make the limit complete. |
| 3 | Minor | `tests/doc-approval-ui.test.tsx` adds a second `import … from '../src/components/doc-approval-view'` line directly under the existing `standingAfterReread` one. Harmless, but the two could be one. |
| 4 | Minor | P21 asserts the error line only through `reloadProposals`. `reloadAll` and `command()` keep theirs by construction (same rethrow) but have no assertion of their own. |

No Critical or Important findings.

## Out of scope (code this commit did not touch)
- After a refused reread, `reloadDelegations` leaves `delegations` stale, so the reviewers panel still shows grant/revoke controls to a demoted coordinator until the page is reloaded. The server refuses the commands. Same class as N1, not in the block under review.
- A coordinator demoted while the page is open, with a `ready` standing and no reread yet, still sees the form until the first reread. Inherent to the design (server is the authority).

Verdict: READY
