# Tier 1 code review — slice 2 (intake + outbox + PM inbox)

Reviewer: liberico-code-reviewer (advisory). Range `ce11242..121d35a` (31 commits), branch `slice-2-intake-outbox`.
Lens: Quality Gate §I rows 01–45, Definition of Done, plan Review Focus (`docs/plans/slice-2-intake-outbox.md:76`), the binding constraints in `tier1-brief.md`.
Tags: `#fact` = read in code/test or reproduced; `#inference` = reasoned from code, not run.

## Verdict

**READY WITH FIXES.** This is a recommendation to Chairman, not an approval.

The backend is sound for this slice: intake, outbox, inbox service, bridge IO and account-change ballots. Every write I traced follows the binding rules: a transaction, `expectedVersion`, an immutable audit row, `ON CONFLICT` idempotency and a same-transaction outbox row. The Inbox screen is the problem. It fails on every load (I-1), and its main PM flows can't be reached from real data (I-2). Both fixes stay inside `src/app/inbox`, `src/components/inbox*` and one line of `src/server/inbox.ts`. Neither touches schema, migrations or the bridge. Once I-1 and I-2 land with the regression tests asked for below, and the manual UI table is actually run, I would expect a READY.

Counts: **Critical 0 · Important 2 · Minor 9** (new findings only; deferred items are triaged separately below).

The controller's manual UI check independently found both Important items (`progress.md:266` and `progress.md:267-271`, UI-1..UI-3). This review confirms them from code and adds two parts the controller did not record. First, the incident note is never written to any surface the screen reads. Second, the UI tests prove behaviour on card states the server cannot produce.

---

## Findings

### Critical

None.

### Important

#### I-1 · `/inbox` fails at runtime: the Server Component `loading.tsx` passes a function prop to a Client Component
- **Where:** `src/app/inbox/loading.tsx:4`. `<InboxBody … onCommand={async () => {}} />`. The file has no `'use client'`, while `src/components/inbox.tsx` is a client module.
- **Evidence:**
  - #fact: I rendered this module tree with the repo's own `next/dist/compiled/react-server-dom-webpack` server build. It throws `Event handlers cannot be passed to Client Component props. {state: "loading", onCommand: function onCommand}`.
  - #fact: the controller saw HTTP 500 on `GET /inbox` on the demo dev server (`progress.md:266`).
  - The slice-1 counterpart `src/app/documents/loading.tsx` passes no function props, which is why it works.
- **Failure scenario:** every navigation to `/inbox` renders the route's Suspense fallback. React Flight rejects the fallback's props, so the PM gets the error boundary or a 500 instead of the Inbox. Build and typecheck pass. `tests/inbox-ui.test.tsx` renders components with `renderToStaticMarkup` outside the RSC boundary, so no automated check can see this.
- **Fix:**
  - Make `onCommand` optional on `InboxBody` and omit it in `loading.tsx`, or render a plain skeleton there. Either is better than adding `'use client'` to a route file.
  - Add a regression test that renders `src/app/inbox/loading.tsx` (and `error.tsx`) through the RSC server renderer, as the probe did. Alternatively, add a smoke step that `GET`s `/inbox` on the demo server and asserts 200. The test must fail on the current file.

#### I-2 · The Inbox cannot request missing information, cannot record an incident note and never shows missing fields; its tests use card states the server never produces
- **Where:**
  - `src/components/inbox-view.ts:37-41` (`primaryAction`)
  - `src/components/inbox.tsx:82-83, 105-110, 115-119` (type-specific inputs)
  - `src/server/inbox.ts:171` (`confirm` audit detail)
  - `src/components/inbox.tsx:49` (DetailView)
  - `tests/inbox-ui.test.tsx:37-64, 141-147`
- **Evidence (#fact, from code):**
  - Intake never sets `classification`. Only `confirm` sets it, and `confirm` also moves the state to `confirmed` (`inbox.ts:171`). `reopen` clears it back to `null` (`inbox.ts:181`). `need_info` leaves it unchanged (`inbox.ts:172`). So every open card (`new`/`needs_info`) coming from the server has `classification === null`.
  - Consequence 1: `primaryAction` returns `null` for every real card, because the third condition in `inbox-view.ts:38` always holds. The «Bổ sung thông tin» → `need_info` path at `inbox.tsx:82` can never run. The `need_info` command, which has a schema, a state move and tests on the server, can't be reached from the web.
  - Consequence 2: the request-variant missing-fields textarea and «Xác nhận đủ thông tin» (`inbox.tsx:110, 119`) are gated on `variant === 'request' && state === 'new'`, which never occurs.
  - Consequence 3: the incident note textarea (`inbox.tsx:105-107`) is gated on `variant === 'incident' && open`, which never occurs. Choosing «Sự cố» at `inbox.tsx:117` sends `confirm` at once with no note.
  - Consequence 4: suppose a note does arrive (the API accepts `note`). The confirm audit detail records only `classification` (`inbox.ts:171`, `detail.classification=input.classification`). The note goes only to `intake_candidates.note`, and the card never selects that column. So DetailView's `e.payload.note` (`inbox.tsx:49`) is always absent. The behaviour promised in `docs/UI-HANDOFF-2-inbox.md:11` («`note` được hiện» in the history) can't happen even after the UI gating is fixed.
  - Consequence 5: a `needs_info` card is unclassified, so its `missingFields` never render. They render only under the request variant (`inbox.tsx:108-109`). The PM cannot see what was asked.
  - The UI tests assert on states the server can't reach:
    - `card({classification:'request',state:'needs_info'})` (`:41`)
    - `primaryAction(card({classification:'request'}))` with the default `state:'new'` (`:59`)
    - `card({classification:'incident'})` while open (`:58`)
    - the `(5)`-style permission checks on `card({classification:'request'})` (`:142-146`)

    They pass, but they certify a flow no user can reach. `docs/UI-HANDOFF-2-inbox.md:32` describes the same unreachable behaviour as delivered.
- **Failure scenario:** a PM opens a new message that lacks information. The only choices are the three type buttons, which confirm immediately, plus dismiss and duplicate. They can't ask for the missing information, can't record impact/recovery for an incident, and can't see missing fields on a card someone else moved to `needs_info`. These are core PM inbox actions in this slice, and the receipt would list them as delivered.
- **Fix:**
  1. For an open card, let the PM pick a type locally first, with no server write, and then show the type-specific inputs. For incident: note plus «Xác nhận». For request: missing fields plus «Bổ sung thông tin» (`need_info`) or «Xác nhận đủ thông tin». For document: the link. Show `missingFields` whenever they are non-empty, whatever the type. This matches the controller's fix direction at `progress.md:271`.
  2. Server, one line: put the note into the confirm audit detail (`detail.note = input.note` when present) so the immutable history carries it. Optionally expose `note` on `CandidateCard`.
  3. Replace the impossible fixtures. Build UI test cards from what `InboxService.list` returns after `ingest`, `need_info` and `confirm(incident, note)`, or at least restrict the fixture helper to reachable `(state, classification)` pairs. Then add component-level tests that drive pick type → need_info and pick «Sự cố» → note → confirm, and assert the command payloads.
  4. Correct `docs/UI-HANDOFF-2-inbox.md:11,32` to describe the shipped flow.

  Task 12 concerns (3) and (4) are resolved by this finding.

### Minor

| # | Where | Issue / scenario | Recommended fix |
|---|---|---|---|
| m-1 | `src/components/inbox.tsx:159`; `src/server/inbox.ts:40` | The screen requests the first page only: newest 50 by `created_at`, no `state` filter, no offset. #inference: each new thread in a mapped group creates a candidate, so in an active group the open `new` items older than the newest 50 drop off the screen with no way to reach them. Paging and filter are documented as not done (`UI-HANDOFF-2-inbox.md:101`). The server already supports both (`listSchema` has `state`, `offset`, max 200). | Default the query to open states (`new`, `needs_info`) or add «Xem thêm» using `offset`. Chairman to decide whether shipping without it is acceptable (see triage). |
| m-2 | `src/components/team-accounts.tsx:29` vs `src/server/accounts.ts:34-40` | `expandsAccess` is a hand copy of the server's `reducesAccess`. No test ties them together, so if either drifts the UI offers the wrong button. The server still refuses, so this is not a safety issue. This is Task 12 concern (1). | Move the predicate into a shared pure module imported by both, or add one table test that runs both on the same pairs. |
| m-3 | `src/components/inbox.tsx:162-168` | After a command, `load()` refreshes only the candidate page. The `sources` and `failures` sections keep the server-rendered snapshot until a full reload. | Refresh them in the same `load()`, or label them «tại thời điểm mở trang». |
| m-4 | `src/components/inbox.tsx:91, 93` vs `:21`; `src/components/inbox-view.ts:7` | Cards print the full `sourceRef` (`telegram:<full chat id>:<msg>`), while the sources list deliberately shows only `chatTail`. The pointer-only copy says «Mở tin gốc trong Telegram», but no link is rendered. The locator built at `src/server/intake.ts:66` is not exposed on the card. This is Task 12 concern (8). | Pick one rule for chat-id display (tail everywhere, or full everywhere for readers in scope) and either expose the locator as a link or drop "Mở" from the copy. |
| m-5 | `src/app/inbox/page.tsx:22` | Loads the whole `WorkService.workspace(principal)` (work items, services and so on) only to get project id and name for the picker. That is heavy per page view and couples the Inbox to the work model. | Add a narrow `projects(principal)` read, or reuse the registry list. |
| m-6 | `src/server/outbox.ts:109-157` (`pull`) | Pull runs as three transactions: lease, identity read, mark unlinked DMs dead. If the third fails after the first committed, the DM rows stay `leased` until `LEASE_SECONDS` (60 s) expiry and then go `uncertain`. #inference: this self-heals and loses nothing, but the behaviour is not documented. | Add a comment at the split explaining the self-heal, plus one test that fails tx3 and asserts the row reaches `uncertain`, not lost. |
| m-7 | `tests/outbox.test.ts:191` | The test is named "(3) a pull scoped to Xeca projects never returns LBRC or IBS HI messages", but it maps no reporting domain. It proves project-scope isolation (`ids.transport` vs `ids.sales`), not domain separation. The domain-level proof lives in `tests/outbox-schema.test.ts:70`. | Rename to the project-scope claim, or call `mapDomain` before pulling. |
| m-8 | `tests/intake.test.ts:151-159` (DOC-16) | DOC-16 says the reporter is never asked to re-enter. The test proves only that the edit and the reply join the same candidate. It doesn't assert that the edit and the reply queue no second receipt, which is the visible "ask again" channel. | Add `expect(await count('outbox_messages')).toBe(<1 or 0>)` after the three ingests. |
| m-9 | `bot-plugin/__init__.py:1136, 1150` | The approval command now serves `access_change` ballots too (`APPROVAL_KINDS`, `:72`; `:1051`, added in 7e73e7f), but its copy still speaks only of account grants: «Không có phiếu cấp tài khoản cần xác nhận.» and «… Chưa tự cấp lời mời.». After voting on an access change, the voter is told no invitation was issued, which is the wrong statement for that ballot type. | Use kind-neutral copy: «Không có phiếu cần xác nhận.» and «Chưa tự áp dụng thay đổi nào.». |

Folded into I-2, not counted separately: «Xác nhận yêu cầu» used as the primary label for incident and document cards.
Seen by the controller and not repeated here: UI-4 (raw ISO in the sources label, `progress.md:272`) and UI-5 (raw template code in failures, `progress.md:273`). I agree with both, as Minor.

### Verified OK (#fact unless marked)
- **Layering:**
  - `src/app/api/inbox/[[...path]]/route.ts`, `src/server/inbox-http.ts`, `src/app/api/bridge/[...path]/route.ts` and `src/server/bridge-io.ts` are thin.
  - Handlers parse, authenticate and call one service method. No handler writes SQL.
- **Identity:**
  - All request schemas are `.strict()`.
  - Actor, tenant and project come from the session, the bridge key scope or `chatScopes`, never from JSON. Tests `(2)` (`tests/intake.test.ts:133`) and `tests/inbox-http.test.ts:44-49` assert this.
  - ProjectChannel is not consulted for scope.
- **Write discipline:**
  - Candidate commands (`inbox.ts:160-195`) lock `FOR UPDATE`, check `expectedVersion`, run `candidateTransition` and update `WHERE version=$2`, then insert an `intake_events` row in the same transaction.
  - `failureCommand` follows the same pattern through `applyOutboxSignal` (`outbox.ts:56-67`).
  - `outbox_state_events` is written by the database trigger.
- **Idempotency:**
  - `source_events`, revisions, candidates and outbox rows (`enqueueReceipt` and `enqueueDm`, dedupe key) all use `ON CONFLICT`.
  - Ingest does insert-then-reread (`intake.ts:71-76`), not select-then-insert.
  - PM commands go through `deduplicate` with a request hash.
  - The access-change ballot is backed by the partial UNIQUE index in 018.
- **Outbox (E-INT-06):**
  - The receipt row is written in the ingest transaction.
  - Ballot DMs are written in the ballot transaction (identity scope).
  - The envelope carries every E-INT-02 field.
- **Pagination caps:** list max 200 (default 50), pull ≤ 10, failures `LIMIT 200`, detail events `LIMIT 500`.
- **Error handling:**
  - `report` catches only `LEASE_INVALID` and `RECEIPT_CONFLICT` per savepoint and returns them in `rejected`.
  - I found no empty catch in the changed TS server code.
  - The plugin's `safe_error` returns fixed codes.
- **Lifecycle separation:**
  - `statusLabel` (`inbox-view.ts:16-25`) says «Đã gửi» only when `deliveredAt` is set and the state is `delivered`.
  - `projected` is always null and never rendered as reached.
  - PM-07 is covered on both server and UI (`tests/outbox.test.ts:54`, `tests/inbox-ui.test.tsx:88`).
- **Named cases that do exercise their claims:**
  - DOC-01/02/03/04 (`tests/intake.test.ts:52-108`), DOC-12 and DOC-04 receipts (`tests/outbox.test.ts:81, 89`), PM-03 (`:67`), PM-07 reopening (`tests/inbox-service.test.ts:169`).
  - SPEC-007 (a) (`tests/account-approval-dm.test.ts:14`) and (b) (`tests/access-change.test.ts:12-260`).
  - Negative cases (1), (7) (`tests/bridge-io.test.ts:21, 42`), (3) (`tests/inbox-service.test.ts:73`), (5) (`:103`), (6) (`tests/account-approval-dm.test.ts:157`).
  - Exceptions are listed as m-7 and m-8.
- **UI states:**
  - Empty, error, denied and no-manager states exist and render. Loading exists but fails at runtime (I-1).
  - No prop mutation. API calls go through `src/lib/api.ts`.
  - The CSS has phone rules (≤700 px, full-width buttons, `box-sizing` global). I checked this from the CSS only, not in a browser.
- **Earlier carries:** M9 (circular import) is resolved by `src/server/intake-scope.ts`. M10 (`app.person_id`) is resolved in `InboxService.run`.
- **Python plugin, quality only:**
  - Retry classes, the bounded hook, dead-letter and the allowlist match the rulings at `progress.md:239-243`.
  - `plugin.yaml` changed only its description (S7).

---

## Rulings on Task 12 builder concerns (`progress.md:258-259`)

| # | Concern | Ruling |
|---|---|---|
| 1 | `expandsAccess` copies server `reducesAccess`, no test ties them | **Minor, fix cheaply before merge** (m-2). The server refuses anyway, so this is a UX drift risk, not a safety one. |
| 2 | Added «Áp quyền đã được duyệt» button that sends the existing `access` command | **Acceptable.** The server applies only with an approved ballot whose `grants` and `previous_grants` match (`sameGrants`, ruling M8 at `progress.md:211`). The button cannot widen access by itself. Nice to have: prefill the form from the approved ballot so the PM doesn't retype grants. |
| 3 | `primaryAction` reading | **Moot as written.** The label mapping is unreachable for real cards (I-2). Rule on labels again after the type-first flow lands. |
| 4 | Incident note read from event payload under «Xem chi tiết» | **Defect.** The payload never contains the note (I-2, consequence 4). Fix server-side in the audit detail. |
| 5 | Failures list read-only; take/requeue/abandon buttons left in «Việc chưa làm» | **OK to defer.** The API and its permission/version tests exist (`tests/inbox-service.test.ts:218-260`). The read-only list doesn't claim to be operable. |
| 6 | Stale version shows «Tải lại danh sách» instead of auto-reload | **Acceptable.** An explicit reload keeps the PM from losing typed input. The `CONFLICT_COPY` message is clear. |
| 7 | Manual table «chưa chạy» | **Must be run before the UI is called done.** Running it is what surfaced I-1 and I-2 (`progress.md:266-273`). The receipt must not mark the UI as verified until the table is filled. Phone width and screen-reader checks are still open (`UI-HANDOFF-2-inbox.md:96-98`). |
| 8 | Chat id: last 4 characters in sources, full `sourceRef` on cards | **Minor** (m-4). Pick one display rule and fix the «Mở tin gốc» copy. |

---

## Deferred-items triage (my area: code quality, tests, plugin quality)

| Item (progress.md) | Ruling | Why |
|---|---|---|
| T4 M2: parallel-edits test has no barrier (`:61`, `tests/intake-concurrency.test.ts:31-40`) | **OK to defer** | Test-only. The native M4 cycle test proves the locking. Add a barrier when the file is next touched. |
| T4 M3: dead fallback and `.catch(()=>undefined)` in project_channels setup (`:62`, `tests/intake.test.ts:44-47`) | **OK to defer, cheap** | #fact: the `state` column exists in 013, so the fallback never runs. Its only risk is hiding a future setup failure. Delete it on next touch. |
| T2 M5: no cross-project/tenant UPDATE 0-row test for runtime on candidates; no exact-16384 B test (`:63`) | **Must fix before merge** | QG row 34c is MUST and AR-06 requires 100%. Service-level denial is covered by `(3)`, but at DB level `tests/intake-schema.test.ts:114` runs an UPDATE with no WHERE and asserts only that it resolves, never which rows changed. Add an assertion that the other project's and other tenant's candidates are unchanged (0 rows), plus `16384 → accepted` next to `16385 → rejected` (`tests/bridge-io.test.ts:67`). Two small tests. The database/security reviewers may overrule on 34c. |
| T4 M6: pointer_only keeps file_name and actor label; unsalted sha256 (`:64`) | **Needs Chairman** | This is OQ-28 policy, not code. |
| T2 M7: rollbacks 013-015 vs 016; USAGE revoke (`:65`) | Database reviewer's area | Not triaged here. |
| T3 M8: nonce consumed before schema parse (`:66`) | **OK to defer** | Ruled at `:39`. The gateway mints a new nonce anyway. Keep the receipt note. |
| T3 M9: circular import (`:67`) | **Resolved** | `src/server/intake-scope.ts`. |
| M10 carry: `scoped()` doesn't set `app.person_id` (`:68`) | **Resolved** | Set in `InboxService.run`. Forged-actor negative tests exist (ruling `:37`). |
| M11 carry and T6 ruling: failed-then-stored attachment gets no success receipt; album dedupe (`:69`, `:113`) | **OK to defer** | This is a receipt gap, not a false claim. No success is ever claimed for an unstored file (DOC-04). List it in the receipt's known gaps. |
| T4 M12: long lines; duplicate `node:crypto` import (`tests/slice2-fixtures.ts:1-2`); raw MIME stored (`src/server/intake.ts:94`) vs lowercased verdict (`:70`) | **OK to defer, cheap** | The MIME mismatch is cosmetic for now because the verdict lowercases. Storing `att.mimeType.toLowerCase()` is a one-token fix worth taking in the fix wave. |
| T4 redaction known limitations (`:77`, `:80`, `:94`, `:100`) | **OK** | Ruled at `:102`. Redaction is defence in depth; pointer_only is the control. The receipt must list them. |
| T5: trigger-disable test runs on the shared DB as superuser (`:109`) | Database reviewer's area | Not triaged here. |
| T6 minors (`:143`, `:153`, `:156`, `:157`, `:168`, `:171`, `:172`) | Database reviewer's area | From the code side, `:153` (same-state version bump on `take`) and `:168` (single-row updates only) match how the services call `applyOutboxSignal`. No code change needed. |
| T7: `failures()` shows group rows only; ballot DM failures have no surface (`:214`) | **Needs Chairman** | This is a product decision (UI-HANDOFF `:99`). Until it is made, a blocked voter's DM failure is visible only in the database. |
| T8: `inboxRows` has no LIMIT; duplicate inbox keys dropped silently; ticketRef without ledger reported as plain onlyInInbox (`:215`) | **OK to defer** | No route exposes it in this slice. Add a LIMIT and a duplicate count before OQ-26 wires a real feed. |
| T9: acknowledgement before delivery leaves the DM pending (`:216`) | **OK** | Documented in the receipt and consistent with ruling `:187`. |
| T7: `lat` CTE O(N) per call (`:217`) | **OK to defer** | Fine at current volume. Revisit with m-1 paging. |
| T11 M-3, M-4, M-9, M-11 (`:244`) | **OK to defer to the wiring round** | M-4 includes the journal ignoring 'failed', so a never-sent attempt can be held until reconcile. That must be closed before the real `send` is wired (a stop point). M-11: the file is now 1175 lines; split it in the wiring round. |
| T11 final-review minors (`:253`) | Split ruling | `intake_event(chats=None)` permissive default (`bot-plugin/__init__.py:280`): **fix before merge, cheap**. Default to refuse when `chats` is None; the hook always passes the set, so behaviour doesn't change. Worst-case hook time ~13 s: **defer to the wiring round** with a hard wall-clock budget as a named wiring-step check. Dead-letter at-least-once, SPOOL_BUSY after sends, 5×503 dead-lettering: **OK**, all harmless or owner-only. |
| T11 ruling: realistic name in a frozen original test (`:249`) | **Needs Chairman** | Already listed as a follow-up. |
| Gate-3 hardening: ZodError on a bad requestId | **OK** | The handler always passes the server-minted id. `tests/inbox-service.test.ts` (M5 test) asserts the throw. |
| Real-looking chat ids in two pre-existing scripts (`:264`) | **Out of scope (ruled)** | They predate the branch and are tracked by `docs/reviews/AUDIT-telegram-ids-20261112.md`. |

---

## What I could not verify

- **Real rendering:** layout at 360 px and 1280 px, zoom 200 %, contrast, screen reader. I didn't open a browser; phone width was judged from CSS only. The manual table is not filled (concern 7).
- **That the I-1 fix renders:** I reproduced the failure with the RSC server build and the controller saw the 500. I didn't run a fixed version.
- **Test suites:** I didn't re-run them. Counts (native 421 passed, PGlite 402/19 skipped, coverage 94.6 statements / 86.28 branches, pytest 42) are taken from `task-13-report.md` and the task-13 logs, so they are #hypothesis on my side. Coverage `include` in `vitest.config.ts` covers server files only. `src/components/*` and `inbox-view.ts` are not measured, which is how I-2 escaped the coverage gate.
- **CI enforcement:** the repo has no `.github/workflows`. Every Quality Gate row on this branch is therefore `manual` on the §IV scale, and the 60 % thresholds in `vitest.config.ts` are enforced only when someone runs them locally.
- **Gateway behaviour** (hook API, `ask_choice`, real `send`, outbox schedule) and real Telegram delivery: stop points, not exercised.
- **Database and security details** (RLS policies, grants, triggers in 016–018, rollback order): left to the database and security reviewers. I relied on their gates and the rulings in `progress.md`.
