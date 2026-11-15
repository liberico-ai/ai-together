VERDICT: READY WITH FIXES

# Tier-1 security review — slice 3, whole branch (ec3b5e7..2a267c5)

Reviewer role: security (findings only; remediation by builders, approval by the Chairman). Read-only pass over the diff packages, the per-task gate reports and the files named below. No test, build or state-changing command was run. Per-task reviews 7a, 7b, 7d, 10, 12 are not repeated.

Counts: P0 0 · P1 0 · P2 2 · P3 6.

## What was checked and holds (#fact unless tagged)

**HTTP handlers** (`src/server/review-http.ts`, `src/app/api/reviews/[[...path]]/route.ts`, `src/app/api/decisions/route.ts`)
- Identity only from the session: `authenticatedPrincipal` at `review-http.ts:52/83`; `requestId` is `randomUUID()` (`:50/81`); path ids go as separate arguments (`:69,72,73,74`) and every service schema is `.strict()` and has no id field for the path (`document-review.ts:37-51`, `review-delegations.ts:39-46`), so a path id is never merged into a body.
- The principal is rebuilt from the database on every request (`identity.ts:133-139`: session row → `principal(tx,user_id)` → memberships). «Session still lists the old role» therefore exists only inside one request; every new write path additionally re-reads authority in its transaction (`document-review.ts:134-143`, `review-delegations.ts:136`).
- Order is auth (401) → origin for non-GET (403) → path → key (400, before the body) → service (`review-http.ts:52-58`). An unauthenticated caller learns only 401; a cross-origin authenticated POST learns only 403, before any path or id is looked at.
- One not-found body: `normalised` (`:34`) replaces every 404 SCOPE_DENIED, so review, dependency and delegation families cannot be told apart by words. Unknown id, another project's id, a malformed id, a viewer and a bot all go through `locate` (`document-review.ts:127-133`): one RLS-scoped SELECT, then `reader`. Status, code, message and shape are identical; work done is the same single query in each case, so there is no structural timing difference (#inference: no measurement taken).
- Write commands call `locate` before parsing the body (`document-review.ts:217-218, 258-259`), so an invalid body answers 422 only for an in-scope document and 404 otherwise. Missing key answers 400 for any id (`review-http.ts:58`), which reveals nothing.
- `Cache-Control: no-store` on every finished response including 401/403/404/422/500 (`:37-40, 43, 76, 86`).
- Idempotency: `claimDocumentCommand` keys on `(tenant_id, actor_id, command_key)` with `ON CONFLICT DO NOTHING` (`document-commands.ts:13-14`). Another person replaying a key gets their own namespace; a replay by the same person after a rights change returns the stored id and re-reads the detail under current rights (`locate` runs first), creating nothing.

**Pages** (`src/app/review/**`, `src/app/decisions/**`)
- `/review` and `/decisions` decide `reader()` from the session-rebuilt principal before touching the database (`review/page.tsx:21`, `decisions/page.tsx:20`); detail decides through `ReviewService.detail` (`[documentId]/page.tsx:19-23`). Out-of-scope gives the fixed denied component, never project data.
- Delegation rows are filtered server-side by `visibleDelegation` (`review-delegations.ts:52-58`): a non-coordinator's browser receives for other people's rows only id, delegate id and types; basis texts are `null` on the wire, not merely hidden by `review.tsx:55`.
- `people` is restricted to members of the one project and to id, name, role (`review/page.tsx:30`, `[documentId]/page.tsx:29`, `decisions/page.tsx:29`). No other project's name reaches the client: `projects` is the filtered list of readable projects (`review/page.tsx:24`).
- Components render all stored text as React text; every `href` is built from a uuid (`review.tsx:37,165,251`; `decisions.tsx:32`). No `dangerouslySetInnerHTML`. No permission is computed in the browser; buttons follow `eligibility` / `canDesignate` / `canVote`, and the services re-check.

**Seams**
- Approval code in the ledger → `public.document_approvers` (active user, reading role, `doc_approve:` prefix; `migrations/019_document_approver_grant.sql:61-75`) → `authority()` inside the decide transaction → LTR01 guard at insert mapped to 403 (`document-review.ts:279-289`). Revocation or demotion takes effect on the next command.
- Designation gives comment and request-changes only: `decide` accepts `review_delegation` authority only for `changes_requested` (`document-review.ts:271-273`).
- Author ≠ approver: `rev.proposed_by === me` refused for comment and decision (`:228, 268`); self-designation refused (`review-delegations.ts:137`).
- Letter case: identifiers lower-cased at parse (`document-review.ts:36`); comparisons use lower-cased `me` (`:219, 260`); 3/3 card normalised once (`decisions.ts:51-59`).
- `BomService.pending` is seat-gated and Telegram-linked (`bom.ts:103-121`); `DecisionService.list` swallows only SCOPE_DENIED so a non-seat sees no 3/3 card, count or reason (`decisions.ts:76-77`). Vote notes are not mapped into the card (`decisions.ts:58`).
- IBS HI: the new screens show a member of an IBS HI project that project's document titles, revision summaries, comments, scope notes and the 3/3 work titles — ordinary project access. Nothing on `/review`, `/review/[id]` or `/decisions` crosses projects or reporting domains: every query is bound to one project under RLS. The skill path applies pointer-only for IBS HI in SQL (`skill-context.ts:43-57`, `source-text.ts:21`).

**AI boundary (AR-03, E-AI-04)**
- `grep` over `src/` (#fact): `suggestions`, `ai-scope`, `skill-context`, `skills` are imported only by `src/server/suggestions.ts`; nothing in `src/app` imports them; no `new SuggestionService(` outside its own file. Kept by `tests/suggestions.test.ts:507-516`.
- `aiDb` defaults to `null` and `submitDraft` refuses with 503 (`suggestions.ts:72, 74`). Role `libetech_ai` is `NOLOGIN` and granted to no role (`migrations/021_ai_suggestions_z4.sql:5, 13, 21`), so `SET LOCAL ROLE libetech_ai` cannot succeed for the runtime login; `assertRestrictedLogin` refuses a login that can reach it (`db.ts:26`).
- A confirmed document draft reaches Z1 only as the person's own `proposeRevisionIn` with the person's `input.revision` (`suggestions.ts:181-184`); draft `value` is never copied. All six manifests: `enabled:false`, `model:null`, `toolAllowlist:[]`; no URL or fetch in `skills/*/prompt.md`. No `fetch(` in `src/server`.

**Logging and errors**: no `console.*` in any new server module; the only shared log line is `http.ts:13` (request id and error class only). Error messages carry no id, title or count; `DRAFT_HELD` lists fixed reason codes only (`suggestions.ts:180`).

**Public-repository hygiene** (added lines of `src tests migrations skills docs`, the whole evidence folder including the untracked `logs/`, both UI hand-offs, `OPEN-QUESTIONS.md`, the plan): no secret, token, key, connection string (the only `postgres://` strings are pre-existing redaction fixtures with `.example.test` / `.invalid` hosts in `tests/intake.test.ts`, `tests/fix-wave-db.test.ts`, not added by this branch), no e-mail, no phone number, no absolute home path, no internal hostname, no personal name found. One chat-id form issue, see P2-1.

## Findings

### P2-1 — new fixture chat id outside the synthetic form (S48)
- `tests/skill-context.test.ts:24` — `chatTwo` uses a `-100…077` form (13 digits) that is not `-100000000000x`. The file is new in this branch (`9a2761b`).
- Scenario: the Task 18 leak grep prescribed by S48 (`docs/plans/slice-3-review-skills.md:1303`, «chỉ chấp nhận `-100000000000x`») runs over added lines and reports this line; the hygiene gate goes red, or is waived by hand, on a repository that is temporarily public. #inference: the value is not a real group (all-zero channel part), so there is no exposure — the defect is the gate.
- Rule: common brief «synthetic ids have the form `-100000000000x`»; plan S48.
- Fix: use a `-100000000000x` value not already used in that file (for example ending in `2`). Must be fixed before merge.

### P2-2 — detail page swallows every error from the dependency read
- `src/app/review/[documentId]/page.tsx:27` — `.catch(() => ({ items: [], total: 0 }))`.
- Scenario: a database or programming error in `DependencyService.list` (not a scope refusal) is discarded with no log line; the reviewer sees no «Tài liệu phụ thuộc cần xem lại» block and may approve a revision whose upstream was flagged, with nothing in the logs to show the block was missing.
- Rule: E-BE-02 (error must propagate; no swallow) — MUST in core, here on a page; Quality Gate #02.
- Fix: catch only `AppError` with code `SCOPE_DENIED` (as `review/page.tsx:33` does) and rethrow the rest, or show a «không tải được danh sách phụ thuộc» notice instead of an empty block. May wait until before pilot if the Chairman accepts; recommended before merge (one line).

### P3-1 — HEAD reaches the origin check
- `src/server/review-http.ts:54` treats every non-GET as a write. Next.js serves HEAD through the exported GET handler (#inference from framework behaviour, not run), so HEAD answers 403 `ORIGIN_DENIED` instead of the GET status. No data leaks (no body). Fix: treat HEAD like GET, or leave and note.

### P3-2 — client payload larger than what the queue renders
- `src/app/review/page.tsx:34` serialises the whole `ReviewItem` (revision `present`/`missing`/`sourceRefs`, decision `scopeNote`/`exceptions`) into the RSC payload while `ReviewQueueBody` renders title and labels only. Same reader can read all of it through `GET /api/reviews/:id`, so no rights boundary is crossed. Data-minimisation only (E-SEC-01 spirit). Fix: map to a queue view type before passing.

### P3-3 — bidi isolation only on the basis text
- `review.tsx:63,65` wrap basis in `<bdi dir="auto">` (7a M3), but comment bodies, replies, titles, summaries, scope notes and exceptions (`review.tsx:33,171,172,252,261`; `decisions.tsx:24,26,41,43`) are not isolated. A project member can write a comment with bidi controls that visually reorders the attribution line next to it (spoofing within the project). Fix: `dir="auto"` / `<bdi>` on free-text nodes, or refuse bidi controls in `storable` for comment bodies.

### P3-4 — `app.person_id` set without lower-casing in ReviewService
- `document-review.ts:122` passes `p.id` raw; `review-delegations.ts:73` lower-cases. Ids come from PostgreSQL `uuid` output (lower-case) in server mode, so no effect today (#inference); in demo mode with hand-made ids a text comparison in a guard could differ. Fix: lower-case once, as in delegations.

### P3-5 — `failure()` labels every unhandled 23505 as a duplicate work code
- `http.ts:12` answers `DUPLICATE_CODE` «Mã việc đã tồn tại trong dự án» for any unique violation. Every unique on the new paths is handled by `ON CONFLICT` today (`document-commands.ts:14-16`, `review-delegations.ts:144`, `document-dependencies.ts:81`, `document-review.ts:282`), so this is latent. Fix later: scope the mapping to the work-item route.

### P3-6 — commit metadata
- The 55 commits carry an author e-mail address in git metadata. Same practice as earlier pushed slices; listed so the push decision is made knowingly, not as a defect.

## Open questions — safe at «code exists, not deployed»?

- **OQ-43** (who sees «người chỉ định không còn là điều phối»): current (a) shows it to coordinators only (`review-delegations.ts:52-58`, indicators `null` for others). Safe: it withholds information. Before pilot: BoM Tech decides (a)/(b); (b) is one line and still within the project.
- **OQ-44** (who sees approval holders): current (a) gives every project reader user ids and document types from `document_approvers`, and the panel shows names (`review.tsx:83-85`). Within one project, no basis text, no other project. Safe to merge. Before pilot: decide; if (b), the filter belongs in `DelegationService.list`, and `ReviewItem.approverState` must stay the only signal for non-coordinators.
- **OQ-45** (who reads draft content; IBS HI drafts): no route, `aiDb` null, `libetech_ai` NOLOGIN — no draft can be written or read by any HTTP caller. Safe at this level. Before adding a draft read route or switching Z4 on, all three points must be decided, and `SuggestionService.list` (`suggestions.ts:103-116`, any reading role, no re-check of text visibility) must not be wired as it stands: it is a second path for Telegram text that bypasses `source-text.ts` at read time.

## Deferred minors — triage (rights, exposure, secrets only)

Must be fixed before merge: none of the ledger's deferred minors (P2-1 and P2-2 above are new).

May wait (state in the receipt where marked):
- 4a guard on memberships is a consistency net, not a boundary — **receipt** (already marked MUST).
- 4a guard exception without own SQLSTATE; rollback 019 without lock; doc_types order (consumers use `includes`, verified `document-review.ts:86-87,161`).
- 4b no entity/kind guard on `review_events` (actor writes only under own id in own project).
- 4b comment authority and immediate revocation service-only — **receipt**.
- 4b a commenter's `changes_requested` takes the revision's only decision slot (S3) — **receipt + Chairman trade-off**: a designated commenter can block approval of any revision of a covered type until a new revision is proposed. Visible in the queue (`decisionStateLabel`).
- 7a M5 list cap 200 without cursor; M6 replay after eligibility change.
- 7b M3 a viewer's grant with a code reads as «approval granted» on the card (over-states; safe direction).
- 7d M4 / N1 / N2 (test strength).
- 8 M-6 production pre-check that PUBLIC cannot CREATE in schema `public` — **receipt / deployment**.
- 9 M-5 `checkSkillOutput` does not validate `ctx` (built server-side).
- 10 M10-1 `refCode` in pointer-only context; M10-2 hidden message visible as pointer and time — **receipt**.
- 11 M-8 eval JSON in client bundle: a grep of the existing `.next/static` for skill identifiers found nothing, and no client component imports `skills.ts` (only type imports from server modules). The build tree may be stale; the controller should repeat the check after the fresh build — **receipt**.
- 12 M12-4 dedupe conflict tells the pipeline a key exists elsewhere in the tenant — only the AI role can observe it; must be decided before Z4 is switched on.
- 16 «Đã sửa» / «Xác nhận đã xử lý» shown to every reader; the service refuses others with 403. No rights gap; fix before pilot for the brief's `:34`.

Wrong as stated:
- 5 M-2 «`addressed` / `resolved` do not re-read membership (stale session scope)»: the principal, its project list and roles are rebuilt from `identity.memberships` on every request (`identity.ts:133-139`), and `locate` → `reader` runs on that fresh principal before either path. A removed or demoted person is refused on the next request. Residual window: within one request only. Downgrade to a note.

## Rulings I disagree with

None on security grounds. S3 (one decision slot shared by approval and a commenter's request for changes) is accepted as a Chairman trade-off, but it is a rights effect, not only a UX one, and should be listed as such in the receipt.

## For the receipt

- Code exists, not deployed, not used, not accepted. No model is called, no AI login exists (`libetech_ai` NOLOGIN, granted to no role), no route reaches Z4 drafts; the «no route imports» test is the guard until OQ-45 is decided.
- Not-found indistinguishability is by status, code, message and shape; timing was reasoned from the query shape, not measured.
- HEAD on the review routes answers 403 (P3-1).
- IBS HI projects: the new screens show human-written titles, summaries, comments, scope notes and exceptions to that project's members; only the skill path is pointer-only. Content discipline for those free-text fields is human, not enforced by code.
- A designated commenter's «Yêu cầu sửa» occupies the revision's only decision slot (S3).
- Approval-holder visibility (OQ-44), indicator visibility (OQ-43) and draft-content visibility (OQ-45) follow «Hành vi hiện tại», undecided.
- Re-check the client bundle for skill/eval content after the fresh build (11 M-8).
- Production pre-check on `CREATE` in schema `public` (8 M-6).
