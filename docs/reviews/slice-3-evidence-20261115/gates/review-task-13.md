# Review: Task 13, decision cards (2f6433f..f24fb43)

Scope read: brief, report, review package, plus `src/server/document-review.ts` (queue, items, reader) and `src/server/bom.ts` (assertSeat, scopeFor). Evidence files `task-13-green-native.txt` (58 files, 765 passed) and `task-13-green-pglite.txt` (730 passed, 35 skipped) exist and match the report. Tests were not re-run. Tags: #fact = read in the diff or repo; #inference = reasoned.

Spec compliance: ✅ (no gaps against the brief or the rulings R13-a..h)
Task quality: Approved (0 Critical, 0 Important, 5 Minor)

## Spec compliance, item by item
- `bom.ts`: 19 lines added, none removed (`git diff --stat`: 19 insertions) #fact. `read`, `command` and `card()` untouched. `PendingCard` type and `pending(p, projectId)` match the brief's signature.
- `pending` repeats `scopeFor` + `assertSeat` + members/linked check in `read()`'s order and with the same sentences (`bom.ts` pending vs read lines 91-93) #fact. The 404 vs 403 split is the one `read()` already has; the 403 is reached only by a seat holder, so it reveals nothing to a non-seat. No write, no `FOR SHARE`/`FOR UPDATE`; the test records every SQL statement.
- `reassignmentState` is pure and exported. `applied` only when stored `applied` and a receipt exist (`decisions.ts:30-36`). Three agrees without a receipt read `quorum_met` or `reconcile`. Unknown state reads `reconcile` (R13-e).
- Review cards come from `ReviewService.queue` (`decisions.ts:70`). `queue` returns one item per document at `latest_revision_id`, decided or not, so a superseded revision has no card (S6, S39) #fact. `have` comes from the decision row (`decisions.ts:46`). `appliedReceipt` needs the document's current `approvedRevisionId` to equal the revision (`decisions.ts:41`). The two are read from different rows, which is what the brief asks for; the decision row only names `decisionId` and `at`.
- `changes_requested` gives `have:0`, `state:'changes_requested'` and an entry in `votes` (R13-d; asserted in a test).
- Roles: `queue` calls `reader()` (manager, engineer, technical, business; bot and viewer refused) and gives `denied()` with one sentence and 404 for not-found, out-of-scope, other project, other tenant and unknown project. Asserted for four principals plus a random project id.
- No command added; `DecisionService` has one public method (R13-h). Strict `{projectId}` input, lower-cased through `uuid`. No actor, tenant or project identity is taken from JSON.
- R13-b: only `AppError` with code `SCOPE_DENIED` is caught (`decisions.ts:73-74`); a plain error from `pending` propagates (test m3).
- R13-f: precedence CLOSED, EXPIRED, ALREADY_VOTED is in `reassignmentCard`.
- Case list: all brief cases exist. The "explains why" case is split into a review test (author, no delegation, comment only, not frozen, decided) and a reassignment test (closed, expired, voted in DOC-09). Regression files were reported green. Nothing is cross-domain.

## Findings

### Critical
None.

### Important
None.

### Minor
1. `src/server/decisions.ts:60` and `:62`: `canVote` uses `seat_ids.includes(p.id)` with the raw principal id, while `mine` compares both cases. If a principal id were ever upper-case, `canVote` would be false for a real seat. Same raw compare as `assertSeat`, so the card agrees with `pending`. Fix: use one normalised id in both places, or state that `Principal.id` is always lower-case.
2. `src/server/bom.ts` (pending, `if(work) cards.push`): a proposal whose work row is not returned is dropped without any signal. Not an error swallow, but a pending ballot could vanish quietly (for example a work row hidden by RLS). Fix: fail closed or record in a test why it cannot happen.
3. `tests/decisions.test.ts` (expired case, `.catch(async()=>{...})` on the operator UPDATE): the test code catches any error from the first UPDATE and runs a fallback. This is a blanket catch in a test, and it makes the setup path non-deterministic. Fix: pick the form that works and drop the catch.
4. `tests/decisions.test.ts`: precedence EXPIRED over ALREADY_VOTED is not asserted. The test goes expired (nobody voted), then closed (expired and closed), so CLOSED over EXPIRED is covered, but a voter on an expired proposal is not. Changing the order of the last two branches in `reassignmentCard` would stay green. Fix: add one case where a seat that already voted looks at an expired card and expect `EXPIRED`.
5. The mutation table lives only in the report. Task 13 has no mutation output file in the evidence folder, unlike tasks 3, 4a and 7d, so claims m1..m5 cannot be checked from files #fact.

## Implementer's concerns, on the merits
- Pointer equals revision but no approved decision row: `appliedReceipt` null. Agreed; the type needs a `decisionId`, and inventing one is worse.
- `appliedReceipt.at` is `decidedAt`, not the pointer move time. Correct and honest; it must be stated in the receipt.
- `canVote:false` with `reason:null` for a seat that is not in the proposal's frozen `seat_ids`. Acceptable; the brief's reason set has no value for it. The UI must not read `reason:null` as "can vote".
- App clock against database clock at the expiry boundary. Fine; `command` is the authority.
- Seat without Telegram link sees review cards only. Matches R13-b and `read()`.

## ⚠️ Cannot verify from diff
- That `scoped()` plus RLS stops `BomService.pending` called directly with a project outside `p.projectIds`. `DecisionService.list` is protected first by `queue`'s `reader()`, but `pending` itself checks only `seat_ids`. The brief's rule is that `pending` is not a route, so risk is low. `pending` also does not validate `projectId` as a uuid; a bad string would give a raw database error when called directly (`list` validates first). I did not read `scoped`.
- The mutation results m1..m5 (no output file).
- That `decide` moves `approved_revision_id` to the revision (the two-facts test depends on it). The test is green per the evidence file, so it holds, but I did not read `decide`.

## For the receipt
- Review cards are cut at the first 200 documents of a project (order `updated_at DESC, id`); a review waiting beyond that has no card. No cursor.
- 3/3 cards are the newest 30 proposals of the project, closed ones included. An open proposal older than 30 newer ones is not listed.
- The review card and the 3/3 card are read in two separate transactions, so a vote landing between them can show slightly different moments.
- `appliedReceipt` on a review card is null when the pointer was set by hand and no approved decision row exists; `appliedReceipt.at` is the decision time, not the pointer time.
- `canVote:false, reason:null` means "not a seat on this proposal".
- A seat without a Telegram link sees review cards only, with no sign that 3/3 cards exist.
- RED is the missing module only; `pending` already existed when RED was run (the report says so).
- No domain labels are produced or aggregated by this task.
