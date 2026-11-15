VERDICT: READY WITH FIXES

# Tier-1 code review — slice 3, whole branch (base ec3b5e7, head 2a267c5)

Reviewer: tier-1 code reviewer (advisory; a recommendation to the Chairman, not an approval). Read-only: diffs, source and test files were read; no test, build or state-changing git command was run. Test results quoted below are the builders' evidence files, not runs I watched (#hypothesis until the fresh full run with exit codes lands).

Scope in full: Task 15 (`src/server/review-http.ts`, both route files, `tests/review-http.test.ts`), Task 16 (`src/app/review/**`, `src/components/review.tsx`, `review-view.ts`, `tests/review-ui.test.tsx`, `docs/UI-HANDOFF-3-review.md`), Task 17 (`src/app/decisions/**`, `decisions.tsx`, `decisions-view.ts`, `tests/decisions-ui.test.tsx`, `docs/UI-HANDOFF-3-decisions.md`), sweep commit `2a267c5`. Cross-task integration, Quality Gate, acceptance-case adequacy and deferred minors as briefed. Schema depth and attack scenarios are left to the database and security reviewers.

Counts: P0 0 · P1 1 · P2 4 · P3 11.

## P0
None found.

## P1

**P1-1 — The Review detail page silently drops a failure to read dependency links, so a reviewer can decide without the «Tài liệu phụ thuộc cần xem lại» warning.**
- Where: `src/app/review/[documentId]/page.tsx:27` — `new DependencyService(db).list(...).catch(() => ({ items: [], total: 0 }))`.
- Scenario: a design document has a flagged dependent (upstream changed). The dependency query fails at page load (connection drop, a statement timeout, or the caller's project role changed between `detail` and `list`). The catch swallows every error class, logs nothing, and `RevisionDiff` (`src/components/review.tsx:163`) renders no block and no sentence when the list is empty. The approver sees a page indistinguishable from «no flagged dependents» and approves.
- Rule: E-BE-02 (MUST — an error is wrapped and thrown, or answered as a clear error; not swallowed); Quality Gate #02; slice brief «tài liệu phụ thuộc đang có cờ hiện dưới tiêu đề…» (`task-16-brief.md:42`); reviewer guide §V.3 failure mode.
- Fix (small): catch only `AppError` `SCOPE_DENIED` there (same as the queue page does for delegations at `src/app/review/page.tsx:33`) and let anything else reach `error.tsx`; or pass a `linksUnavailable` flag and render «Không tải được danh sách tài liệu phụ thuộc — chưa nên duyệt trước khi tải lại.» with a log line carrying a request id. Add one static case in `tests/review-ui.test.tsx` for the unavailable sentence.

## P2

**P2-1 — The Review queue screen cannot reach items beyond the first page.**
- Where: `src/app/review/page.tsx:28` (`queue(principal, { projectId })`, service default `limit 50`, `src/server/document-review.ts:37`) and `src/components/review.tsx:284` (reload without `limit`/`offset`), `:39` («{items.length} / {total} tài liệu»).
- Scenario: a project with 73 documents that have a revision. `/review` shows 50 cards and «50 / 73 tài liệu»; there is no control to load the other 23, so they can only be opened by URL. The Decisions screen has its own documented cap (200, `docs/UI-HANDOFF-3-decisions.md:66`); the Review handoff states none.
- Rule: E-BE-05 is met at the API (cap and `total`), but the screen exposes no paging — UI behaviour gap; not stated in `docs/UI-HANDOFF-3-review.md`.
- Fix: a «Tải thêm» button that calls `/api/reviews?projectId=…&limit=50&offset=n`, or at minimum state the cut in the handoff and the receipt.

**P2-2 — «Đã sửa» and «Xác nhận đã xử lý» are offered to every reader on every unresolved comment.**
- Where: `src/components/review.tsx:173` (`onReply && !closed`), wired unconditionally at `:258`. The service rule is `src/server/document-review.ts:238-240` (addressed: revision author or project manager; resolved: comment writer, or a non-author covering the type).
- Scenario: an engineer with `NO_DELEGATION` who is neither author nor writer opens a document with an open comment; both buttons show; each click answers `APPROVER_NOT_AUTHORIZED` in place. Brief `task-16-brief.md:34` says the buttons are for «người có vai tương ứng». No permission leaks (the service decides), but the screen offers actions it knows nothing about.
- This is the ledger's Task 16 deferred minor (`progress.md:321`) that was routed to the sweep; the sweep skipped it (`minor-sweep-report.md`, B5). It is still open; the handoff documents it (`docs/UI-HANDOFF-3-review.md`, «Việc chưa làm»).
- Fix (keeps «the UI computes no permission»): the service adds `canAddress` / `canResolve` per top-level `CommentView`, and `RevisionDiff` renders each button from its flag. May wait for a follow-up PR if the receipt states it.

**P2-3 — The stateful wiring of the three screens is untested; only the stateless views are.**
- Where: `ReviewDetailScreen.send` (`src/components/review.tsx:234-248`: `REVISION_CONFLICT` → stale banner, error routed to the right form, key reset on success), `ReviewQueue.command` (`:288-295`: reload after success, draft kept on failure), `VoteItem.vote` (`src/components/decisions.tsx:89-99`: note cleared only after a recorded vote).
- Scenario: delete `if (d.code === 'REVISION_CONFLICT') setStale(true);` at `review.tsx:241`. The named case «Conflict: a stale decision shows the source-changed banner…» (`tests/review-ui.test.tsx:116`) still passes, because it renders `RevisionDiff` with `sourceChanged: true` directly. Same for a regression that clears the vote note on failure. The tests render with `renderToStaticMarkup` only; the screens' state transitions have no driver, and the hand check in both handoffs is marked not run.
- Rule: Quality Gate #36 (API/integration path, SHOULD) and the brief's own Conflict case intent (DESIGN «Conflict» state).
- Fix: drive the three functions with an injected `fetch` (the same seam `postReview` already accepts at `review-view.ts:78`) — e.g. extract `send`'s error routing into a pure `routeCommandError(code, target)` in `review-view.ts` and test it; or add a small jsdom case. At least, run the hand check before the PR and record it.

**P2-4 — At head, the coverage gate does not measure any slice-3 server module.**
- Where: committed `vitest.config.ts` (`git show 2a267c5:vitest.config.ts`) — `coverage.include` lists slice 1–2 modules only; `document-review.ts`, `review-delegations.ts`, `document-dependencies.ts`, `decisions.ts`, `review-http.ts`, `suggestions.ts`, `skill-*.ts`, `ai-scope.ts`, `source-text.ts`, `document-commands.ts` and `bom.ts` are absent. The working tree has an **uncommitted** edit adding them (`git status`: ` M vitest.config.ts`), presumably by the verification agent.
- Scenario: the PR merges with the committed config; `npm run test:coverage` (thresholds 60) passes without looking at the new domain logic, and Quality Gate #35 (domain logic ≥ 60 %) has no evidence. I could not verify the coverage numbers (no run).
- Fix: commit the include list with this branch and attach the coverage summary (per-file lines/branches for the new modules) to the receipt.

## P3

1. **Duplicated helpers that will drift** — `nameOf` + «Thành viên chưa rõ tên» (`review.tsx:19-20`, `decisions.tsx:14`, `decisions-view.ts:18`), `KeyStore` type (`review.tsx:18`, `decisions.tsx:13`, `review-view.ts:71`), `Skeleton` (`review.tsx:21`, `decisions.tsx:15`); query-string parser `query()` (`review-http.ts:23-27` vs `inbox-http.ts:16-20`). Move to one shared module. (Ledger Task 17 minor.)
2. **Role list duplicated client-side** — `READING` in `review-view.ts:150` mirrors `READ_ROLES` in `document-review.ts:20`. Importing the server constant would pull server code into the client bundle, so the duplication is understandable; put the set in a dependency-free shared file used by both, or add a test that asserts the two are equal.
3. **Client not-found sentence not bound to the server's** — `NOT_FOUND_COPY` (`review-view.ts:21`) equals the handler's sentence (`review-http.ts:13`) today, but each is asserted in a different test file; a change on one side stays green. One assertion comparing the two closes it.
4. **Unused re-export** — `export type { Eligibility }` (`review-view.ts:155`) has no importer.
5. **Unreachable codes** — `describeVoteError` maps `REVISION_CONFLICT` and `REVIEW_ALREADY_DECIDED` (`decisions-view.ts:66`), which `/api/team/bom` never raises (`bom.ts` raises `PROPOSAL_CLOSED`, `VERSION_CONFLICT`, `VOTE_LOCKED`, …). Harmless; drop or comment.
6. **UI-side state override** — `decisions.tsx:38` re-maps `applied` without receipt to `reconcile`, while the file header says the screen computes no state. The service already does this (`decisions.ts:30`); keep it as a belt but correct the comment (accepted as built in the ledger).
7. **`NO_REVISION` on the detail page** — `ReviewService.load` throws `NO_REVISION` 409 (`document-review.ts:172`); the page (`[documentId]/page.tsx:20-24`) only handles `SCOPE_DENIED`, so a document without a revision opened by URL lands on the error boundary whose «Thử lại» can never succeed. Map it to a fixed sentence.
8. **Draft carried across «Đọc bản mới»** — after a conflict and reload, `ReviewDecisionForm` keeps the note typed for the old revision and the next click sends it against the new one (`review.tsx:195-198`, body built from the reloaded `item` at `:265`). It needs a click, so not an automatic switch; consider a line «Ghi chú này viết cho bản rN — kiểm lại trước khi gửi.».
9. **`docs/UI-HANDOFF-3-decisions.md` has no «Breakpoint» section** — the brief asks for the six sections of the `UI-HANDOFF-2-inbox.md` template (Bố cục · Token · Props · Trạng thái · Breakpoint · Edge case); the file numbers «Kiểm tay» as §6 and folds breakpoints into Token (`:14`).
10. **CSS overlap at exactly 700px** — `@media(min-width:700px)` and `@media(max-width:700px)` both apply at 700px for `.review-*` and `.decision-*` (`globals.css`, review block and decision block); use `max-width:699.98px`.
11. **Sweep B3 fails the whole Decisions page closed** — `bom.ts` `pending` now throws `BOM_INCONSISTENT` 500 for a ballot without its work row, and `DecisionService.list` rethrows it, so the seat holder also loses every review card. Unreachable under the composite FK, and fail-closed is the stated ruling; noting only that the blast radius is the page, not the card.

## Task-by-task check against the briefs

**Task 15 (handlers)** — matches the brief. Principal from the session (`review-http.ts:52`), `checkOrigin` for every non-GET (`:54`), one `requestId` per request handed to the service and returned in `meta`, literal paths matched before ids (`:61-71`), one not-found body for every denial via `normalised()` (R15-g), `Idempotency-Key` checked before the body is read (`:58`), `Cache-Control: no-store` on every answer including route-level failures (`reviewRouteFailure`). No route touches document approval; imports are the four services plus shared helpers (asserted at `tests/review-http.test.ts:387-400`). Route files only import the handler and `db` (`:402-417`). Every named case of the brief exists with real assertions (status, code, byte-identical bodies with `meta.requestId` removed — 40+ denial bodies — row counts before/after, request id equal to the stored decision and event). Thin adapter: yes.

**Task 16 (Review screen)** — fixed sentences match the brief verbatim (`review-view.ts:18-37`, `:54-56`); four states with `aria-busy`, `role="alert"` + «Thử lại», denied without name or count; eligibility buttons follow the service only; hash label «tự khai — chưa kiểm» / «đã kiểm»; Thêm/Xóa/Sửa text labels; two-column diff only inside `@media(min-width:950px)`; `overflow-wrap:anywhere` and 44px actions; no px width above 328. Reviewers panel: member list excludes the viewer and «Chỉ đọc», at least one type, basis 5–500, revoke with basis and the row's `expectedVersion`, `DELEGATION_CONFLICT` sentence with «Tải lại», approval note sentence, no `doc_approve:` control. Pages pass no function to client components; the delegation list is passed as returned (nulls included) and rendered as `ListedDelegation`. Open items: P1-1, P2-1, P2-2, P3-7/8. Step 16b not built, by decision.

**Task 17 (Decisions screen)** — `reassignmentLabel`, `reviewLabels`, `voteBlockCopy` wording matches the brief; «đủ phiếu» and «đã áp dụng» are two separate lines; «Đã áp dụng» only with `appliedReceipt`; vote body `{action, proposalId, choice, note}` exactly as `bom-workspace.tsx:117`, with one key per action reused on retry (ruling R17-d amended); account approvals are a link to `/approvals`. Open items: P3-5/6/9.

**Sweep `2a267c5`** — the four product changes are what the report says: legend names the project (`team-accounts.tsx:28`, React text), one lower-cased viewer id for vote and seat checks (`decisions.ts:52-62`), `pending` refuses a malformed id with the BoM 404 sentence and fails closed on a missing work row (`bom.ts:103-118`), a doc comment (`source-text.ts:41-42`). `bom.ts` against base shows added lines only; the 3/3 command path is untouched. The test changes tighten assertions (exact codes, a real foreign revision, the CHECK alone, the FK by SQLSTATE 23503). No regression seen.

## Cross-task integration

- Request bodies match the service schemas: decision `{revisionId, sourceHash (nullable), expectedVersion = recordVersion, result, scopeNote, exceptions}` ↔ `decideSchema`; comment `{kind:'comment', revisionId, anchor ('' allowed), body}` and replies `{kind, parentId, body}` ↔ the discriminated `commentSchema`; grant `{projectId, delegateId, docTypes, basis}` and revoke `{expectedVersion, basis}` ↔ `grantSchema` / `revokeSchema` (strict). The UI never sends an actor, tenant, authority or request id (asserted at `tests/review-ui.test.tsx:192-206`).
- `Idempotency-Key` is sent on every POST by `postReview`; the handler requires it on all five POST routes (asserted at `tests/review-http.test.ts:210-223`).
- Pages pass exactly what services return, through `JSON.parse(JSON.stringify(...))` (dates to strings).
- Error codes the UI maps are the ones the services raise (`REVISION_CONFLICT`, `REVIEW_ALREADY_DECIDED`, `SCOPE_DENIED`, `DELEGATION_CONFLICT`, `DELEGATION_EXISTS`, `MANAGER_REQUIRED`); everything else shows the server's message as text. Exception: P3-5.
- Duplication that will drift: P3-1, P3-2, P3-3. Two not-found sentences remain in the code base («…mục…» vs «…tài liệu…»); the review handler normalises everything behind it to one body (R15-g); the ledger already routes this to the receipt.

## Quality Gate — items that apply

| # | Check | Result |
|---|---|---|
| 01 | No sync I/O in request path | Pass — no `*Sync(` in the slice's `src/` files (grep). |
| 02 | Error handling, no empty catch | **Fail at one place** — P1-1. The `catch { redirect('/login') }` in the three pages follows the existing inbox pattern. |
| 04 | Validation at entry | Pass — strict Zod schemas in every service; handler passes raw input. |
| 05 | Pagination + cap | API pass (queue/dependencies ≤ 200 with `total`; delegations 200 without total — ledger 7a M5; decisions 200 + 30, documented). Screen: P2-1. |
| 06 | Auth at entry | Pass. |
| 07 / 26 | Transactions, side effects after commit | Pass for the slice's writes (one scoped transaction each; no queue side effect in these paths). |
| 08 | Idempotent handlers | Pass — `claimDocumentCommand` (UNIQUE + ON CONFLICT, per earlier task reviews); asserted through the handler. |
| 27 | State transitions through domain logic | Pass — decisions through `ReviewService.decide`; 3/3 through `BomService.command`. |
| 31 | No raw rows; PII | Pass — views map rows; names only from the project's member list; others' basis hidden. |
| 32 | Structured log with request id | Partial — `failure()` logs JSON with `requestId` for 500s; P1-1 path logs nothing. |
| 34a–e | Tenant isolation | Covered by the earlier task reviews and the DB reviewer; through the handler, out-of-scope = unknown id (one body). |
| 35 | Domain unit coverage ≥ 60 % | **Not evidenced at head** — P2-4. |
| 36 | API integration (happy + error) | Pass for the handlers (`tests/review-http.test.ts`, 17 cases). Screens: P2-3. |
| 37 | Regression | `tests/foundation.test.ts`, `tests/spec004.test.ts`, `src/server/service.ts`, `src/server/account-approval.ts`, `bot-plugin/`, migrations 001–018: **no diff** base..head (checked). |
| 42 | Folder structure (E-AI-01) | `skills/` at the repository root is not listed in `AGENTS.md`. Acceptable for this PR: the Chairman-approved slice brief names it (`docs/SLICE-BRIEFS.md:178`), it holds data (manifests, prompts, evals), not code on a request path, and `AGENTS.md` may be edited only by the Chairman. Do not move it; the receipt asks the Chairman to add a `skills/` line together with the Z4 line (brief `:213`). |
| — | Handler pattern (thin, identity from session, one 404 body, `no-store`) | Pass. |

## Test adequacy — acceptance cases of the brief

| Case | Test | Would it fail if the behaviour broke? |
|---|---|---|
| DOC-05 | `tests/suggestions.test.ts:112`; DB CHECK `tests/z4-schema.test.ts:322` | Yes — `SOURCE_REQUIRED`, zero decisions, revision and event counts unchanged. |
| DOC-06 | `tests/document-review.test.ts:61`, `:76` (stale id, hash, dropped hash, version ±1) | Yes — code, message, snapshot unchanged, decision lands only on r2. |
| DOC-08 | `tests/document-review.test.ts:90`, `:100`; self-acceptance `tests/slice3-bom-events.test.ts:150` | Yes. |
| DOC-09 | `tests/slice3-bom-events.test.ts:30`, `:45`; `tests/decisions.test.ts:73`; UI `tests/decisions-ui.test.tsx:76-118` | Yes. |
| DOC-15 | `tests/skills-eval.test.ts:117` | Weak by nature — proves the allowlist and manifest hash do not change and the gate's empty allowlist; no model runs, so model resistance is untested (ledger 11 M-3, receipt). |
| PM-05 | `tests/slice3-bom-events.test.ts:66`, `:99` | Yes. |
| PM-06 | `tests/slice3-bom-events.test.ts:127` (sweep A4 made the ordering assertion deterministic) | Yes. |
| Negative (1)–(7) | (1) `document-review.test.ts:90`; (2) `slice3-bom-events.test.ts:150`; (3) `document-review.test.ts:76`; (4) `z4-schema.test.ts:61` (catalog-driven); (5) `document-review.test.ts:139` + `review-http.test.ts:81`; (6) `document-review.test.ts:164`; (7) `skill-context.test.ts:61` | Yes, all seven. |
| Concurrency ×2 | `tests/slice3-bom-concurrency.test.ts:33` (one `bom_receipts` row); `tests/document-review-concurrency.test.ts:40`, `:50`, `:60`, `:71` | Yes, but **native PostgreSQL only** (`describe.skipIf(!native)`); the PGlite run skips them. The native evidence (929 passed, 0 skipped) is what proves them. |
| Eval, five cases per skill | `tests/skills-eval.test.ts:34` (one case per category), `:72` (good passes, bad caught for the stated reason) | Yes against mocked outputs; «revoked» and «same name other BU» are asserted as «id absent from context» (ledger 11 M-4) — state in the receipt. |
| UI Conflict cases (Task 16/17) | `review-ui.test.tsx:116`, `decisions-ui.test.tsx:210` | Weak — the stateless view only; see P2-3. |

## Deferred minors — triage (code and tests only)

Must fix before merge: **none of the ledger minors**. (My P1-1 and P2-4 are new.)

Done by the sweep and verified in the diff: Task 1 `DUPLICATE_HINT_SQL` doc line; Task 3 PM-06 ordering and T17 comment; Task 4b FK by 23503; Task 5 M-6 real foreign revision; Task 7b M1 legend, M4 two projects, M6 exact codes; Task 7d N1 wider source check; Task 8 N-1 CHECK alone; Task 13 M1–M4 and the uuid check.

Still open, may wait (state in the receipt where marked):
- Task 16 reply buttons for every reader — open, sweep skipped it (B5). P2-2; receipt + follow-up (service flags).
- Task 17 `nameOf` duplicated — P3-1; may wait.
- Task 15 query string on `GET /api/reviews/:documentId` ignored, not refused — harmless (no effect, tested at `review-http.test.ts:295`); may wait.
- Task 5 M-3 comments cut at 1000 without a signal — receipt. M-4 a comment on an older decided revision answers `REVIEW_ALREADY_DECIDED` (the UI then says «Bản này đã có quyết định…» while a newer revision exists; the user must reload) — may wait. M-5 race order not forced — may wait (native race cases exist). M-7 duplication — may wait. M-8 unreachable.
- Task 5 M-2 (author/writer replies do not re-read membership from the database) — security reviewer's call; may wait for this PR only if the security reviewer agrees, receipt.
- Task 7a M5 delegation list 200 without total/cursor — receipt. M6 replay after eligibility change — may wait.
- Task 7b M2, M3, M5 — may wait. Task 7d M4, N2 — may wait.
- Task 1 inline `iso` and the triple-evaluated subquery; Task 3 duplicated helpers; Task 6 three items — may wait.
- Task 9 M-5, Tasks 9/11 N-2 and the `doc_reviewer` messages-only case — may wait.
- Task 12 M12-1 random `trace_id` (E-OBS-02 SHOULD), M12-7 — may wait; receipt for M12-1/M12-3.

Wrong: none found.

## Rulings I disagree with

None. One reservation, not a disagreement: the sweep's B3 ruling (fail closed with a 500) is right for the ballot, but taking the review cards down with it (P3-11) is a wider effect than the finding (M2) asked for.

## For the receipt

- Code exists only: not deployed, not used, not accepted; nothing pushed; no browser hand check run for `/review`, `/review/[documentId]`, `/decisions` (360×740 and 1280×800 still owed, both handoffs say so).
- The state transitions of the three screens are not covered by automated tests (P2-3); the UI tests are static renders.
- The concurrency guarantees are proven on native PostgreSQL only; the PGlite suite skips them.
- Coverage of the slice-3 modules has to be measured with the include list committed (P2-4); quote the numbers.
- The Review queue shows the first 50 items (P2-1) unless fixed; Decisions caps at 200 review cards and 30 ballots; delegation list at 200 without total; comments at 1000.
- «Đã sửa» / «Xác nhận đã xử lý» show for every reader; the service decides (P2-2).
- Eval runs against mocked outputs; injection resistance of a model is untested; «revoked» and «same name other BU» are «id absent» checks.
- `AGENTS.md` does not list `skills/`; the Chairman adds it with the Z4 line.
- Step 16b, Task 7c and Task 14 are out of this PR by decision.

## Re-review of the fix wave (f0d08c8)

Scope: `git diff ffa5781..f0d08c8`, read only. I did not run tests, a build or a dev server. Green runs are cited from `tier1-fix-green-*.txt` and the fix report (#hypothesis until the controller reruns them). W2, W7 and W10 belong to the database reviewer.

| Item | Verdict | Evidence |
|---|---|---|
| W1 (my P1) | ADDRESSED | `src/server/review-page.ts:9` turns only SCOPE_DENIED into an empty list and rethrows everything else. It is used at `src/app/review/[documentId]/page.tsx:29`. `tests/review-page.test.ts` "lets every other failure reach…" uses failing doubles (Error, INTERNAL, near-miss code, TypeError, string) that would go red under a blanket catch, and there is a source check against `.catch(()=>` and empty catch blocks. #fact |
| W3 | ADDRESSED | `tests/skill-context.test.ts:24` changes `chatTwo` to `-1000000000007`. The fix report's leak grep shows only regex literals. #fact |
| W4 (P2-1 paging) | ADDRESSED | `src/components/review-view.ts:93-98` parses the offset strictly (digits only, safe integer, multiple of 50, else 0). `src/app/review/page.tsx:19,33` and `queueHref` encode the server-validated projectId. **The redirect to page 1 is acceptable**: it fires only when `offset>0` and the page is empty, lands on offset 0 so it cannot loop, and rebuilds the URL from a projectId the service has already scoped, not from raw input. Next's redirect error passes through the catch because it is not an AppError. #fact |
| W5 (P2-2 flags) | ADDRESSED | There is one predicate, `src/server/document-review.ts:111`, and it is the same rule that used to be inline. It is called at `:196` (flags) and `:256` (`comment()`). The test diff only adds lines after `:563` plus the import, so the existing `comment()` cases are unedited. The UI renders only from the flags (`src/components/review.tsx:134-135,179`) and computes no permission. The flags reveal nothing new: each one is the server's own answer for the viewer, on a comment the viewer can already read. #fact |
| W6 | ADDRESSED | `commandFailure`, `commandSuccess`, `panelFailure`, `panelSuccess` and `panelReloadFailure` (`review-view.ts:75,83`) and `voteFailure`/`voteRecorded` (`decisions.tsx:100,105`) are pure and tested, and a "no second copy" source check exists. #fact |
| W8 | ADDRESSED | `src/server/documents.ts:172` uses `requestId ?? randomUUID()`. `tests/suggestions.test.ts` checks that the flag event's request_id equals the decision's, and that a manual proposal uses one id across the transaction. #fact |
| W9 | ADDRESSED | `list-cut.ts`, `document-review.ts:188-189`, `review-delegations.ts:110-126` and `decisions.ts:81`. **The `reviewersTruncated` key edit (`tests/review-http.test.ts:402`) is legitimate**: it is the only removed `expect` in the whole test diff, it is still an exact `toEqual` on the key list, and it follows an additive response field. The non-coordinator query filters to visible rows before `LIMIT 1001`, so the flag counts only rows the viewer may see and does not disclose hidden rows. #fact |
| W11 | ADDRESSED, not a defect | `review-http.ts:54` maps HEAD to GET, and the decisions handler at `:85` exempts HEAD. The two are written differently but behave the same: in both, HEAD reaches the read path and skips the origin check. Writes still refuse a foreign origin (`review-http.test.ts` W11 case). No HEAD export exists in the route files. #fact |
| W12 | ADDRESSED | `dir="auto"`/`<bdi>` are on titles, summaries, diff, list items and comment/reply bodies, with one test per screen. Voter/name lines carry no `dir` (P3, deferred). #fact |
| W13 (P3-3) | ADDRESSED | `review-http.test.ts` W13 checks that `NOT_FOUND_COPY` (`review-view.ts:21`) equals both the handler and the service literal. #fact |
| W14 (P3-4/5/6) | ADDRESSED | The panel/command outcomes go through the W6 functions, the draft is kept on failure and cleared on success, and the `'page'` fallback is gone. #fact |
| W15 (P3-7) | ADDRESSED | `detailFailure` (`review-page.ts:18`) handles NO_REVISION, which renders `ReviewDetailNoRevision` with a link back and no retry button. The test covers both the rethrow set and the copy. #fact |
| W16 (P3-9) | ADDRESSED | `docs/UI-HANDOFF-3-decisions.md:56` adds «5. Breakpoint». #fact |
| W17 (P3-10) | ADDRESSED | `max-width:699.98px` in both CSS blocks, plus the corrected header comments. #fact |

**New P0/P1/P2 in the fix diff: none.** I checked each of these:
- Rule extraction: unchanged.
- Permission in the browser: none.
- Flags: none reveals something beyond what the viewer may read.
- Assertions: no existing assertion weakened or renamed; the only `-expect` is the key-list extension.
- Paging links: built from a strict offset and a scoped projectId.
- Error paths: no new title or id; NO_REVISION copy is fixed text.

Deferred (P3, out of scope):
- Voter/name lines on Decisions have no `dir="auto"`.
- The test that pins W11 shows `review-http.test.ts` is one session from the demo store cap (the fix report notes it). The next test that logs in there should return its session.
- The `runtime_insert` tenant clause on `review_decisions` is not pinned by a behavioural test because the BEFORE guard refuses first (fix report). This is for the DB reviewer.
- The receipt items above still stand: there are no browser hand checks, the screen state transitions are static-render only, and the P2-3 and P2-4 numbers are owed.

VERDICT after the fix wave: READY

## Class sweep before the gate's last run (c363992)

I read the committed text only (`git show c363992:<path>`) and ran nothing. These items were already known and are not repeated here: link revision, decide fingerprint, closed thread, `reassignmentState` applied<3, the `conflicting_sources` cases of release_librarian/doc_reviewer, and the 020 pointer guard. Schema guards are left to the database reviewer. Unless marked otherwise, every finding is #fact from the cited line.

### Class 1: «whatever is current» instead of what the caller saw

| Write | What the command names | What the service compares, and under which lock | Answer when the state moved |
|---|---|---|---|
| `ReviewService.comment` kind `comment` (`document-review.ts:250-256`) | revisionId | `rec.latest_revision_id` under the document row's FOR UPDATE (`:246`) | REVISION_CONFLICT; REVIEW_ALREADY_DECIDED if decided |
| `comment` `addressed`/`resolved` (`:257-267`) | parentId only | parent exists, follow-up rule, `threadClosed` under the same row lock | COMMENT_RESOLVED. The thread's open/closed state is the only state the reply depends on, and it is re-checked under the lock. Naming the revision is not needed: the reply attaches to the parent's revision. |
| `ReviewService.decide` (`:290-301`) | revisionId, sourceHash, expectedVersion | latest, hash and record version all under the row lock; the pointer UPDATE carries `version=$3` (`:318`) | REVISION_CONFLICT |
| `DelegationService.grant` (`review-delegations.ts:138-154`) | nothing (a create) | caller and delegate roles read from the DB in the transaction; the LTR02 guard; the live-row UNIQUE | DELEGATION_EXISTS / DELEGATION_INVALID / 404. Acceptable for a create. |
| `DelegationService.revoke` (`:176-183`) | expectedVersion | `version=$5 AND revoked_at IS NULL` in the UPDATE | DELEGATION_CONFLICT |
| `DependencyService.link` (`document-dependencies.ts:78-84`) | upstreamRevisionId | latest under FOR SHARE | REVISION_CONFLICT (the known fix holds) |
| `DocumentService.proposeRevisionIn` (`documents.ts:156,166`) | expectedVersion, basedOnRevisionId | both under FOR UPDATE | REVISION_CONFLICT |
| `SuggestionService.decide` (`suggestions.ts:143-191`) | valueHash (+ the revision body for a document draft) | the draft's own hash under the advisory lock. **Nothing is compared with the draft's input.** | see C1-1 |
| `review-http.ts` handlers (`:57-77`) | path id goes to the service; no state of its own | — | — |

- **C1-1 (P2) A draft is confirmed against a context that may have moved since the draft was made.**
  - The draft stores `input_hash` (`suggestions.ts:96-99`), and nothing ever reads it back. `grep input_hash` in src finds only that insert.
  - The confirmation path (`:175-185`) rebuilds the context *now* and checks only that the draft's cited ids are still in it. `buildSkillContextIn` returns every revision up to the cap (`skill-context.ts` revisions query), so an older revision still passes.
  - The decide command names nothing about the candidate or document state the person saw.
  - Scenario for a document: doc_reviewer drafts against revision 3. Someone proposes revision 4. A person confirms the draft with a body based on 4. The confirmation is accepted, and the new revision 5 is recorded as coming from a draft that analysed revision 3.
  - Scenario for an intake candidate: a correcting message arrives in the thread after the draft, and the confirmation is still accepted.
  - No route reaches this today (Z4 is off), hence P2 and not P1.
  - Smallest fix: hold the confirmation with `INPUT_MOVED` when the draft is older than the newest context item. For a document draft, that means the draft's cited `document_revision` is not `latestRevisionId`. For a candidate, a visible message's `observedAt` is later than the draft's `created_at`. Alternative: recompute and compare the input hash, if its formula is defined server-side.

### Class 2: fingerprint or replay narrower than the command

| Claim / replay | Fingerprint or replay fields | Parsed command and path | Covered? |
|---|---|---|---|
| `comment` (`document-review.ts:247`) | op, documentId, ...input | path documentId + discriminated body (defaults applied) | yes |
| `decide` (`:289`) | op, documentId, ...input | path documentId + revisionId, sourceHash, expectedVersion, result, scopeNote, exceptions | yes |
| `grant` (`review-delegations.ts:143`) | op, ...input | projectId, delegateId, docTypes (sorted), basis | yes |
| `revoke` (`:172`) | op, delegationId, ...input | path delegationId + expectedVersion, basis | yes |
| `link` (`document-dependencies.ts:81`) | op, ...input | projectId, both document ids, upstreamRevisionId, note | yes |
| `proposeRevisionIn` manual (`documents.ts:164,181`) | op, documentId, ...input | path + full proposeSchema | yes |
| draft `decide` (`suggestions.ts:152`) | op, draftId, ...input | path draftId + result, valueHash, reason, revision | yes (known fix holds) |
| `register` (`documents.ts:129`) | op, ...input | full registerSchema | yes |
| `review_decisions.command_key` | no hand-rolled replay; replay goes through the claim, and `ON CONFLICT(document_revision_id)` → REVIEW_ALREADY_DECIDED | — | yes |
| `draft_decisions.command_key` | no hand-rolled replay; `ON CONFLICT(draft_id)` → DRAFT_ALREADY_DECIDED | — | yes |
| `ai_drafts.dedupe_key` replay (`suggestions.ts:102-104`) | project, skill, entityType, entityId, valueHash | + **inputHash, modelVersion**, traceId | **no**, see C2-1 |

- **C2-1 (P2) The draft dedupe replay ignores `inputHash` and `modelVersion`.**
  - Scenario: the pipeline retries key K after the source changed (or with another model). The output is the same, so the valueHash is the same. The service answers `stored:false` with the old draft id, so the pipeline believes the draft for input B / model M2 is stored, while the row records input A / M1.
  - The provenance fields are part of the command's content. `traceId` differs per attempt by design, so leaving it out is right.
  - Fix: select `input_hash, model_version` and add both to the comparison at `:104`.
- P3: `grant` re-checks the delegate's role (`:141-142`) before the claim. A same-key replay after the delegate left therefore answers DELEGATION_INVALID instead of the recorded result. This refuses rather than misleads, so it is P3.

### Class 3: a label that can say more than its facts

| Derived value | Facts read | Over-claim found |
|---|---|---|
| `eligibility` (`document-review.ts:85-95`) | decided, author, delegation types, approval types, frozen | none: each reason follows from its row |
| `approverState` (`:175`) | `document_approvers` minus the author | none |
| `isFrozen` / «Nguồn đã đóng băng» (`:58`, `review.tsx:151`) | snapshot_ref, verified, hash non-null | none |
| `hashLabel` «đã kiểm» (`review-view.ts:47`; `review.tsx:35`, `:152`) | `hash_verification` only | C3-3 (queue line) |
| `canAddress`/`canResolve` (`:202-205`) | follow-up rule, thread closed | none (same rule as the command) |
| review card `state`, `quorum`, `reviewLabels` (`decisions.ts:41-45`, `decisions-view.ts:36-41`) | the decision row | none: vote and baseline are separate lines |
| review card `appliedReceipt` / «Đã áp dụng làm bản chuẩn» / «Biên nhận lúc» (`decisions.ts:37,44`; `decisions.tsx:29,31`) | approved decision + pointer = revision | C3-2 |
| `reassignmentState` (`decisions.ts:28-33`) | stored state, agree count, receipt | C3-4 (another combination in the function being fixed) |
| reassignment «Đã áp dụng · biên nhận» line (`decisions.tsx:46`) | receipt only | **C3-1** |
| «Đủ phiếu» (`decisions-view.ts:24`) | `quorum_met` | via C3-4 only |
| truncation flags (`list-cut.ts`; `review-delegations.ts:114,126`; `decisions.ts:81`; `document-review.ts:195`) | fetched vs cap / total | C3-5 |
| `designatorIsCoordinator`, `dormant` (`review-delegations.ts:121`; `review.tsx:64-65`) | granter / delegate current role | none: «không còn là điều phối» and «đang ngủ» are what the roles say; shown only to a coordinator |

- **C3-1 (P2) A reconcile card still says «Đã áp dụng».**
  - `decisions.tsx:46` prints «Đã áp dụng · biên nhận lúc …» whenever `appliedReceipt` exists. The quorum line (`:39,45`) and `reassignmentState` (`decisions.ts:30`) read `reconcile` when a receipt exists on a stored `pending` / `rejected` / `cancelled` / `expired` proposal.
  - Scenario: an operator, or a bug, leaves a receipt on a rejected proposal. The card shows «Cần đối soát» and, on the next line, «Đã áp dụng». The brief keeps «đã áp dụng» and «biên nhận» as separate facts, and the stored state does not establish «applied».
  - Fix: print «Đã áp dụng» only when the shown state is `applied`. Otherwise print «Có biên nhận lúc … — cần đối soát».
  - This is the file being edited now, and a different combination from the known item.
- **C3-2 (P3) The review card's «Biên nhận lúc» is not a receipt.** It is the decision's `decidedAt` (`decisions.ts:44`), labelled as a receipt, and no receipt row exists for a review decision. The time is right only if the pointer moved in the decision's own transaction. Fix: label it «Áp dụng cùng quyết định lúc …», or drop the line.
- **C3-3 (P3) The queue line prints a hash label when there is no hash.** `review.tsx:35` prints «hash tự khai — chưa kiểm» even when `sourceHash` is null. If an inconsistent row has `hash_verification='verified'` with a null hash, it prints «hash đã kiểm». Line 152 already handles the null case. Fix: use the same null branch on the queue line.
- **C3-4 (P2, note for the builder of the in-flight fix)** `decisions.ts:29`: a stored `applied` with **no** receipt and ≥3 agree reads `quorum_met` («Đủ phiếu, chưa áp dụng»). The store says applied and the screen says not applied: two facts disagree, and the fail-closed rule in the comment at `:26-27` says `reconcile`. The UI belt (`decisions.tsx:39`) does not catch it, because the state is already `quorum_met`. Please confirm the fix covers this combination as well as the known one.
- C3-5 (P3) A non-coordinator's `reviewersTruncated` can be true because of rows the viewer will never see. The SQL fetch cap (`review-delegations.ts:111-114`) counts dormant rows that `visibleDelegation` drops. The screen then says «dài hơn phần đang hiện» while every visible row is shown. It needs more than 1000 rows in one project. Fix: compute `fetchedCut` after the visibility filter, or put the dormant condition in the SQL.

### Class 4: eval cases (30)

The two known cases (release_librarian and doc_reviewer `conflicting_sources`) are skipped. «Fits» means the context exhibits the category, «good» means the good output is acceptable, and «bad» means the bad output is wrong for the stated reason. Injection bads are `toolRequests:[send_message]` in all six skills.

| Skill | fabrication | injection | conflicting | revoked | same name other BU |
|---|---|---|---|---|---|
| ba_elicitation | fits, good, bad | fits, good, bad | fits (two rounding rules at once), good, bad | id-absent only; good question presumes a hidden source (C4-3) | id-absent only, good, bad |
| intake_analyst | fits, good, bad | fits, good, bad | fits (customer 20/11 vs owner 25/11), good, bad | id-absent only, good, bad | **good wrong: C4-2** |
| pm_planning | fits, good, bad | fits, good, bad | fits (team A 2 weeks vs team B 5 weeks), good, bad | id-absent; C4-3 | id-absent, good, bad |
| technical_writer | fits, good, bad | fits (injection in the title), good, bad | **does not fit: C4-1** | id-absent; C4-3 | id-absent, good, bad |
| doc_reviewer | fits; good has an unsourced impact (C4-4) | fits, good, bad | (known) | fits better (r2 without r1 shows a missing base), good, bad | id-absent, good, bad |
| release_librarian | fits, good, bad | fits, good, bad | (known) | id-absent; C4-3 | id-absent, good, bad |

- **C4-1 (P2) technical_writer `conflicting_sources` is supersession, not conflict.** This is the same defect as the known release_librarian case, in a third skill. `skills/technical-writer/eval.json:4`: revision 1 says 30 days and revision 2, the document's latest, says 90 days. The later revision replaces the earlier value, so the two are not incompatible at the same time. The good output reports a conflict, while the bad output (no conflict) is the honest reading. Fix: two different documents, or two sources dated the same, stating 30 and 90 days.
- **C4-2 (P2) intake_analyst `same_name_other_bu` good sample marks the message a duplicate of itself.** `skills/intake-analyst/eval.json:6`: the context has one message (`…043`). The good output sets `duplicateOf: "…043"`, but `skill-contracts.ts:100` defines `duplicateOf` as *another* message of the context. A careful person would reject it, and the eval passes it as good. The bad output has the same value, so the bad is also wrong for an incidental reason. Fix: `duplicateOf: null` in both.
- C4-3 (P3) In the `revoked_access` cases of ba, pm, tw and release_librarian, the good question asserts that something «không còn trong ngữ cảnh» («Tài liệu thứ hai…», «Quy tắc phê duyệt…»). Nothing in the context says such a source existed, so the good output knows what it cannot know. This is the same root as the recorded P3 that these cases test only «id absent». Fix: phrase it as missing («chưa có nguồn về …»), or put a revocation marker in the context.
- C4-4 (P3) doc_reviewer `fabrication_when_missing` good sample (`skills/doc-reviewer/eval.json:2`) carries the impact «Cần cập nhật kịch bản kiểm rollback». No source says that, so in the one case that tests fabrication, the good output contains an unsourced inference. Fix: `impacts: []`, or tie the impact to a sourced fact.

### Outside the four classes (seen, for the record)
- `DependencyService.link` (`document-dependencies.ts:74`) and `SuggestionService.decide` (`suggestions.ts:155-157`) take the manager / write role from the session's `projectRole`. `DelegationService` and `ReviewService` re-read the role in the transaction. I found no guard in 020 for the dependency insert or the draft decision (DB reviewer to confirm). Rated P3 if the session principal is rebuilt from memberships on each request, P2 if it is not.

**Counts:** P0 0 · P1 0 · P2 6 (C1-1, C2-1, C3-1, C3-4, C4-1, C4-2) · P3 7.
