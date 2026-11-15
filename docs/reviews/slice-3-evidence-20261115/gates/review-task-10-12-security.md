# Security gate — Slice 3, Task 10 (skill context) and Task 12 (SuggestionService)

- Reviewer role: Liberico security reviewer (advisory). Findings only; no code changed, no tests run, no state-changing git command. This verdict is a recommendation to the Chairman, not an approval.
- Reviewed state: commits `9a2761b` (Task 10) and `b69d50a` (Task 12), through the package `.superpowers/sdd/slice-3-review-skills/review-10-12-3bb314d..b69d50a.diff`. Context read at the committed state: `migrations/021_ai_suggestions_z4.sql`, `src/server/document-commands.ts`, `src/server/db.ts` (`scoped`), `src/server/types.ts` (`projectRole`), `src/server/document-review.ts` (`READ_ROLES`), `b69d50a:src/server/skill-contracts.ts` (`checkSkillOutput`), `review-task-8-database.md` (final list).
- Line numbers refer to the committed files at `b69d50a`.
- Step 0 (secrets): the eight files of the package contain no key, token, connection string or JWT literal (#fact, read in full). No `.env` in the package. Nothing to rotate from this change.

---

## Task 10 — `src/server/skill-context.ts`, `visibleThreadMessages` in `src/server/source-text.ts`

**Security verdict: Approved** · **Spec compliance: ✅** · **Task quality: Approved**

### Critical
None.

### Important
None.

### Minor
- **M10-1 `refCode` stays in a pointer-only context** — `src/server/skill-context.ts:69,72`. For an IBS HI project `title`, `summary`, `present`, `missing`, message text and hash are nulled in SQL, but `ref_code` is returned. Plan S15 allows "ids, types, revision numbers, hashes and pointers". If a project's reference codes are human-written (e.g. carry a vessel, client or drawing name) they are free text, not a pointer. Scenario: an IBS HI document registered with a descriptive `ref_code` reaches a skill context and then a Z4 draft. Fix: decide whether `ref_code` is a pointer (state it in the receipt) or null it under `pointerOnly` like `title`. #inference — the content convention of `ref_code` for IBS HI documents is not in the diff.
- **M10-2 hidden messages still contribute `ref`, `observedAt`, `forwarded` and `mode`** — `skill-context.ts:58`. By design (R10-h) and consistent with source-text.ts; recorded so the receipt says a hidden message is visible as a pointer and a time, not absent.
- **M10-3 `CONTEXT_KIND_FORBIDDEN` / `CONTEXT_TOO_LARGE` are 500s** — `skill-context.ts:89-90`. Unreachable today (20+50+30 = 100), messages carry no id. Fine as invariants.

### Answers (Task 10 part of the questions)
- **Q5 — can foreign / hidden / IBS HI material enter a context?** No path found. Every statement binds `project_id=$1` (projects row, candidate, documents, revisions, thread join on both `c` and `e`); text and hash come only from `visibleColumnsSql` and are additionally nulled in JS when `pointerOnly` or `mode!=='excerpt'` (`:57`); pointer-only nulling of titles/summaries is in SQL so the values never reach Node. `buildSkillContextIn` trusts `tx` only for RLS; correctness does not depend on it — the case "every statement filters by project even when the transaction is scoped to two projects" goes red if a filter is dropped (mutation m1). A caller passing a *wider principal* is not defended against inside the function (it only gates on role/scope), which is why Task 12 must pass the confirming person — see Q2. The IBS HI flag reads `project_domain_mappings` under the caller's RLS; a project outside the scope is not found at all, so the mapping cannot silently read as "not IBS HI" for a visible project (#fact, `013_project_registry.sql:73-75` scope policy).
- **Oracle (404/422 order):** project denial is judged first on the database id; the R10-i 422 is decided from the skill table before any candidate/document lookup, so it does not reveal the existence of a candidate or document; malformed ids give the same 404. Strict-schema `ZodError` is raised before any database read and depends on input shape only. No oracle found.
- **Caps:** SQL LIMITs; the named document is ordered first so the cap never drops it; thread cut is deterministic (`observed_at, id`). ✅
- **R10-c:** one expression (`latestDomainSql`/`isIbsHiSql`) serves both the visibility rule and `pointerOnly`; `textAllowedSql` refactor is behaviour-preserving (existing `tests/source-text.test.ts` untouched and green per report).

### Tests
Mutation table is credible: each safety claim (other-project leak, pointer-only nulling in SQL and in JS, viewer/bot, approved-only for the librarian, chat equality) has a case that went red. m1d (revision `project_id` filter) is correctly classified as equivalent. The `JSON.stringify` marker scans plus `recordingDb` (rows returned by SQL also free of markers) are the right shape of evidence.

### ⚠️ Cannot verify from diff
- Whether `source_events.thread_key` can be NULL; if so, `e.thread_key=c.thread_key` yields an empty thread (fail-closed, but a functional gap).
- Native-PostgreSQL run results: only the report's statement (`task-10-green-native.txt`).

### For the receipt
- A pointer-only context still carries ids, `refCode`, `docType`, revision numbers, `sourceHash` of revisions, message `ref` (`telegram:<chat>:<message>`), `observedAt`, `forwarded`. State whether `refCode` counts as a pointer for IBS HI.
- The context is capped (20/50/30); a draft citing a source outside the cap is held, not confirmed — fail-closed, state it.

---

## Task 12 — `src/server/ai-scope.ts`, `src/server/suggestions.ts`, `proposeRevisionIn` in `src/server/documents.ts`

**Security verdict: Needs fixes** · **Spec compliance: ❌** (binding constraint "a draft citing … a message whose text is now hidden is held" is not met for every citation path; I12-2) · **Task quality: Needs fixes**

### Critical
None. AR-03 / E-AI-04 hold structurally: the AI role cannot write Z1/Z2, cannot decide, cannot read Z1 (Q1).

### Important

**I12-1 — Reusing an idempotency key across two drafts records a confirmation against a revision it did not create.**
`src/server/suggestions.ts:143,176,179-181` with `src/server/document-commands.ts` (claim replay returns the stored response) and `documents.ts:157`.
- Who / input: a person with document-write rights confirms draft A about document D with key K and revision body X → revision R1 + decision A. The same person (UI retry bug, copied request, or deliberately) then confirms draft B about the same D with the same K and the same body X. Same with a key K previously used for a *manual* `proposeRevision` on D with body X.
- Wrong result: the replay branch at `:143` does not fire (B has no decision). All holds for B pass. `proposeRevisionIn` → `claimDocumentCommand` finds `(tenant, actor, K)` with the same request hash and returns the stored `DocumentDetail` without running the action: no version check, no new revision. `:176` takes `record.latest_revision_id` from that stored response = R1. `draft_decisions` for B is inserted with `document_revision_id = R1`; the DB guard passes because R1 does belong to D. Result: two confirmed drafts point to one revision, and B's decision attests a revision proposed for A (or a manual one). This breaks "a confirmed document draft creates exactly one revision through the document service and one decision" and the audit meaning of `document_revision_id`. No privilege is gained (the person could write D anyway), hence Important, not Critical.
- Fix (one of): (a) put the draft id into the claimed payload — e.g. `proposeRevisionIn(tx,p,docId,raw,key,{draftId})` hashing `{op:'document.propose_revision',documentId,draftId,...input}` — so a key reused for a different draft or a manual proposal is `IDEMPOTENCY_CONFLICT`; or (b) have `proposeRevisionIn` report whether it created the revision and refuse (`IDEMPOTENCY_CONFLICT`) when the decision path hit a claim replay. Add a regression case for both reuse variants.

**I12-2 — A draft that cites a now-hidden message only in its plain `sources` list (or in a result field without a basis) is confirmable.**
`src/server/suggestions.ts:171` relying on `b69d50a:src/server/skill-contracts.ts:137-138` (`notShown` looks only at `supports:true` paths).
- Who / input: AI submits an `intake_analyst` draft for candidate C whose `result` paraphrases message M and whose `sources` lists M, with `claims` empty (or claims citing other, still-visible messages). Later the group flag is removed, so M is `hidden` for every reader. A project manager confirms.
- Wrong result: `SOURCE_REQUIRED` passes (sources non-empty), `SOURCE_OUT_OF_CONTEXT` passes (M is in the context as a hidden pointer), `TEXT_NOT_VISIBLE` does not fire (M is cited only at `sources.*.id`, `supports:false`), `POINTER_ONLY_PROJECT` does not apply (not IBS HI). The draft is confirmed. The binding constraint says a draft *citing* a message whose text is now hidden is held. For an IBS HI project the separate `POINTER_ONLY_PROJECT` hold in `decide` covers the Task 9 gap; for flag-removal hiding nothing does. Impact today: a candidate confirmation writes only the decision row, so no message text reaches Z1 — but the person "confirms" content derived from text they can no longer see.
- Fix: in `decide` (independent of the Task 9 round, so the property does not ride on one gate), hold with `TEXT_NOT_VISIBLE` when *any* id-bearing field of the stored value (all of `ID_FIELDS`, not only `supports`) names a `source_event` whose current `mode!=='excerpt'`. Re-verify after the Task 9 fix (pointer-only rule for results without a basis field; conflict with < 2 sources) lands, and add a case: draft citing a hidden message only in `sources` → `DRAFT_HELD`.

**I12-3 — `list` returns the stored `value` to every reading role, including text the viewer can no longer see and drafts of IBS HI projects (deferred: blocks any route and the Z4 switch-on, not this commit).**
`src/server/suggestions.ts:105-118,66`; `submitDraft` (`:74-103`) does not refuse an IBS HI project (the AI role has no grant to read mappings).
- Who / input: a `business` or `engineer` member of project P calls a future list route for an entity.
- Wrong result: `value` is a Z4 copy of whatever the model wrote — quotes of message excerpts included. It is shown although (a) the cited message has since become `hidden` (flag removed or project remapped to IBS_HI), (b) the project is IBS HI, where AGENTS.md allows pointers, hashes and Tech work metadata only, or (c) the draft was built under another person's context. This bypasses the rule that Telegram text leaves the database only through `source-text.ts`: the draft value is a second channel. No route exists in this slice (#fact: boundary test scans `src/app` and `new SuggestionService(`), so it is not exploitable now.
- Must be decided before a route: (1) whether `value` is shown at all to non-managers; (2) at read time, re-judge visibility — e.g. hide `value`/`questions` when the project is now pointer-only or any cited `source_event` is not `excerpt` for this reader, returning ids and the hold codes instead; (3) whether drafts of an IBS HI project may be stored at all (refuse at submit through a narrow, read-only pointer-flag grant to `libetech_ai`, or store only ids/hashes).

### Minor
- **M12-1 `trace_id` of the decision is `randomUUID()`** — `suggestions.ts:181`. R12-c says request_id and trace_id come from server context; only `requestId` does. Pass the request's trace id (E-OBS-02).
- **M12-2 swallowed exception around `sha256(d.value)`** — `suggestions.ts:161` (`catch {recomputed='';}`). Fail-closed (becomes `VALUE_HASH_MISMATCH`), but it is the empty-catch shape E-BE-02 bans; narrow it or comment why.
- **M12-3 the confirmed revision body is not bound to the draft value** — `suggestions.ts:176`. By design (the draft's content is never copied into Z1), but "confirmed" therefore means "a person accepted the draft and separately authored a revision"; the revision can say anything. Must be stated in the receipt so nobody reads `document_revision_id` as "the AI text that was approved".
- **M12-4 dedupe conflict reveals that a key exists elsewhere in the tenant** — `suggestions.ts:93-101`. Only to the AI pipeline, which mints the keys; negligible. R12-a is met (never success).
- **M12-5 `aiScoped` does not validate `projectIds` as uuids** — `ai-scope.ts:9-12`. Unreachable through `submitDraft` (narrowed to the parsed id), but a future caller with a malformed id would surface a raw `22P02`.
- **M12-6 `pg_advisory_xact_lock(hashtextextended(id,0))` shares its key space with `intake.ts:87`** — a 64-bit collision only serialises two unrelated transactions; neither path takes the other's locks, so no deadlock. Consider the two-int form with a namespace constant.

### Answers to the nine questions

1. **AI role / AiPrincipal writing Z1/Z2, deciding, reading Z1; runtime writing Z4.** No. `libetech_ai` holds only `USAGE` on `intelligence`, `SELECT` and column `INSERT` on `ai_drafts` (#fact, `021:…GRANT`); no privilege on `draft_decisions` or any Z1/Z2 table, NOBYPASSRLS, insert policy binds `ai_principal_id` to the server-set GUC. `aiScoped` is used only by `submitDraft`. `list`/`decide` run on `this.db` under `scoped()` (runtime role); an `AiPrincipal` passed as `Principal` gets `projectRole(...) === undefined` → not in `READ_ROLES` → 404 (tested). The runtime role has only `SELECT` on `ai_drafts` (no INSERT), and `SET LOCAL ROLE libetech_ai` fails for any non-superuser login because the migration guard forbids members (native test "the runtime role cannot submit a draft").
2. **Confirmation rebuilt under the confirmer at decision time.** Yes: `buildSkillContextIn(tx,p,…,this.excerptChats)` inside the decision transaction, `p` = the confirming person, `excerptChats` = current service config (`:165`). Walk of held cases: no source → `SOURCE_REQUIRED` (+ DB guard backstop on `sources` count); source outside scope / another project → not in context → `SOURCE_OUT_OF_CONTEXT`; hidden text → `TEXT_NOT_VISIBLE` **only when cited at a `supports` path** (I12-2); IBS HI → `POINTER_ONLY_PROJECT` from the context flag; stale manifest → `MANIFEST_MISMATCH`; value/hash mismatch → `VALUE_HASH_MISMATCH` (recomputed from stored value); entity missing / unhonourable pair → `ENTITY_NOT_FOUND` (only `SCOPE_DENIED`/`INVALID_INPUT` are converted; every other error rethrows, `:167`). Holds are collected before any write. Replay branch returns only an existing decision, which can exist only after the checks passed once. The one bypass of the document-side effects is the key reuse of I12-1 (checks still run for B; the revision link is wrong).
3. **Atomicity and races.** Same draft, two confirmations (same or different key): advisory lock on the draft id serialises; the second re-reads under READ COMMITTED, sees the decision → replay or `DRAFT_ALREADY_DECIDED`; `ON CONFLICT(draft_id)` + full rollback is the backstop (deterministic case). Confirm vs reject: same lock, same outcome. Confirm vs a manual revision: `FOR UPDATE` on the document row in `proposeRevisionIn` waits, then the version check fails → `REVISION_CONFLICT`, whole transaction rolls back. Lock order is always advisory(draft) → row(document); the manual path takes only row(document); no path takes them in reverse → no deadlock. Revision without decision or decision without revision: impossible within the one transaction, **except** I12-1 (decision linked to a revision it did not create). Not tested: confirm-vs-reject and confirm-vs-manual-revision races (reasoned, not evidenced).
4. **Idempotency and replay.** Replay requires same `command_key`, same `decided_by`, same `result` (`:143`); otherwise 409. A person who lost the project gets 404 at `located`; a person demoted to `viewer` gets 404 (`READ_ROLES`); a manager demoted to `engineer` replaying a candidate decision gets the recorded view — no information beyond what `list` already gives that reader; acceptable, state it. `submitDraft`: the conflict re-read runs under `libetech_ai` narrowed to the draft's project, so a key used in another project is invisible → `IDEMPOTENCY_CONFLICT`; no project/draft id is returned (M12-4 aside).
5. **Context builder leaks.** See Task 10 Q5 — none found; the principal passed is the confirmer (tested by call shape).
6. **`list` exposure.** See I12-3 — must be decided before any route.
7. **`proposeRevisionIn`.** Behaviour of `proposeRevision` unchanged: same no-DB checks before the transaction (bot, uuid, strict schema), same statements in the same order, same messages; schema parsed twice (harmless, same result). `app.person_id` is set at the start of `proposeRevisionIn` (`documents.ts:153`) before any statement, so every entry reaches `flagDependents` with the acting person. Note `proposeRevisionIn` is public and trusts the caller's `tx` for scope; its own role check uses `projectRole(p, record.project_id)`.
8. **Message hygiene.** `DRAFT_HELD` lists fixed codes only (`HoldReason` union + four service codes; test asserts no uuid in the message). All other messages are constant Vietnamese sentences. No logging in either module. DB guard exceptions (`draft_decisions_guard`) carry no id and are pre-empted by service checks.
9. **Tests and mutation table.** Good coverage for: forged fields, viewer/bot/AI principal/outsider, held codes, IBS HI, stale manifest, hash mismatch, entity missing, size/NUL/surrogate before any statement (throwing fake handle), dedupe across projects, lost-race rollback, native parallel confirmations. The m2 reasoning is **correct**: within `READ_ROLES` and one project, `buildSkillContextIn` uses the principal only as a gate, so a wider principal produces the same context; a call-shape assertion is the only observable. The meaningful "decision-time" property is instead evidenced by the hidden-text case (service config changed between submit and confirm). Missing cases that would go red on a real defect: key reuse across drafts / after a manual proposal (I12-1); citation of a hidden message only in `sources` (I12-2); confirm vs reject in parallel and confirm vs manual revision (native); replay after demotion.

### ⚠️ Cannot verify from diff
- Native results for `tests/suggestions-concurrency.test.ts` and the native-only runtime-role case: only the report's statement and evidence file names.
- That `canonicalJson` is stable under jsonb round-trip for every value the schemas allow (large integers, `-0`, key order). A mismatch would hold valid drafts (fail-closed), not confirm bad ones.
- The final shape of `checkSkillOutput` after the fix round now in progress; I12-2 must be re-checked against it.

### For the receipt (and before Z4 is switched on)
- State: no HTTP route, no model call, no AI login; `SuggestionService` is constructed nowhere with an AI handle. Under migration 021 the only login able to `SET ROLE libetech_ai` is a superuser (the guard forbids members), so switching Z4 on needs its own design and migration for a non-superuser AI login — not a config change.
- State: "confirmed" = a person accepted the draft and separately authored the revision; the revision content is not the draft value (M12-3).
- State: `SuggestionService` must be constructed with the same `excerptChats` as live intake; with the default `[]` every excerpt-backed draft is held.
- State: the decision row is the audit record (R12-c); no separate registry event for a rejection.
- Before a list route: decide I12-3 (value redaction at read time, IBS HI drafts at submit).
- Before Z4 switch-on: I12-1 and I12-2 fixed with regression cases; M12-1 trace id propagated.

---

## Re-review of fix round 1 (506b444)

Scope: the fix diff `.superpowers/sdd/slice-3-review-skills/review-12-fix1-844eb77..506b444.diff`, the «Fix round 1» section of `task-12-report.md`, the committed gate `2bc6944:src/server/skill-contracts.ts`, and OQ-45 in `docs/OPEN-QUESTIONS.md`. Read only: no tests run, no state-changing git command. Line numbers refer to `506b444` (the gate: `2bc6944`).

### Verdict per finding

- **F12-1 (I12-1, key reuse): ADDRESSED.** `src/server/documents.ts` `proposeRevisionIn(…, fromDraft?)`: when the call comes from a draft, the claimed payload is `{op:'document.propose_revision.from_draft', draftId, documentId, ...input}`; the manual payload `{op:'document.propose_revision', documentId, ...input}` is byte-for-byte the same as before, so stored manual hashes and manual replays behave as they did. `suggestions.ts:180` passes `{draftId:id}`. Two drafts, or a draft and a manual proposal, now hash differently under the same `(tenant, actor, key)` → `claimDocumentCommand` answers `IDEMPOTENCY_CONFLICT` before the action, and the whole decision transaction rolls back. A replay of the *same* draft with the same key is still answered by `decide`'s own replay branch (`:142`) before any claim. A claim row from a draft confirmation can only exist together with its decision (same transaction), so the draft-path claim replay cannot return a stale revision either. Three regression cases plus mutation m9 (dropping the draft id goes red).
- **F12-2 (I12-2, hidden message cited outside a basis): ADDRESSED.** `2bc6944:src/server/skill-contracts.ts:162` builds `notShown` from `idsOf(out, skill, false)`, i.e. **every** id field in `ID_FIELDS`: `sources.*.id`, `claims.*.basis.*`, `conflicts.*.sourceIds.*`, `result.duplicateOf` (`:101`), and the ba/pm/technical_writer basis paths. Any one naming a `source_event` that is not `excerpt` with text gives `TEXT_NOT_VISIBLE` (`:165`). So the property holds on every citation path I named. Keeping the rule in one place, in the gate, is acceptable to me for three reasons: `decide` calls the gate on every confirmation (`suggestions.ts:174`); first-round mutation m1 (skipping `checkSkillOutput`) already goes red; and the new `decide`-level cases (cited only in `sources`, cited only through `duplicateOf`, plus a positive control) pin the behaviour end to end, so a future weakening of the gate would turn a `decide` test red, not just a gate test. Limit: an id written into a free-text field rather than an id field is not a citation, and nothing detects it. That is the definition we chose, not a defect.
- **F12-3 (I12-3, `list` exposure): ADDRESSED as a deferral.** OQ-45 (`docs/OPEN-QUESTIONS.md:647-657`) states the decision correctly. Its three points are decided separately: who sees `value`, whether visibility is judged again at read time, and whether IBS HI drafts are stored, refused at write or stored as ids/hashes only. It names the conflicting rules (OQ-30 (b) / Task 1 read-time visibility, `AGENTS.md:16`), puts the decision with the Chairman for point 3, and records current behaviour as option (a) without presenting it as the chosen option. Nothing in the code makes the deferral unsafe today: no file in `src/app` imports the module, nothing in `src` constructs `SuggestionService` (with or without an AI handle), and the boundary test guards both. The other agent's UI task under `src/app/review/**` falls under that scan.
- **M12-2: ADDRESSED.** `suggestions.ts:160-164` catches only `TypeError` and treats it as `VALUE_HASH_MISMATCH`. `TypeError` is what `canonicalJson` throws for non-finite numbers and sparse or non-plain values (`2bc6944:src/server/skills.ts:54,58`). The narrowed catch cannot let a draft through: `recomputed` stays `''`, which never equals a 64-hex hash, so the draft is held.
- **M12-5: ADDRESSED.** `src/server/ai-scope.ts:28` validates `id`, `tenantId` and every `projectIds` entry before any statement. `submitDraft` (`suggestions.ts:113-114`) does the same. The 401→404 change is not an oracle: the principal is the pipeline's own server-side identity, and the answer depends only on its shape, not on any stored row.
- **M12-6: ADDRESSED.** `suggestions.ts:137` takes `pg_advisory_xact_lock($1::int, hashtext($2))` with `DRAFT_DECISION_LOCK = 0x44524654` (`:90`). The two-int and one-bigint forms are separate key spaces, so there is no overlap with `intake.ts:87`, and no other two-int user exists in `src`. Serialisation of decisions on one draft is kept, and the lock order is unchanged: advisory(draft), then row(document) in `proposeRevisionIn`. No path takes the row lock and then the advisory lock, so there is no deadlock. Moving to 32-bit `hashtext` makes collisions between draft ids likelier (about 2^-32 per pair). A collision only makes two unrelated decisions wait for each other; correctness is unaffected. Mutations m10a/m10b go red on native.
- **Missing cases: ADDRESSED.** The report and diff add native confirm versus reject, native confirm versus a manual revision, and replay after demotion (lost project or `viewer` → 404; manager lowered to `engineer` replaying a candidate decision → the recorded view). The native results are taken from `task-12-fix1-green-native.txt` as reported. I did not re-run them.
- **M12-1, M12-3, M12-4: deferred by ruling.** They remain minors and receipt items (random decision `trace_id`; the revision body is not bound to the draft value; dedupe conflict shows the pipeline that a key exists in the tenant).

### New Critical / Important in the fix diff
None.

Checked: the new claim payload cannot collide with the manual one (different `op`, sha256 of the whole payload) and does not change manual replays. The lock change keeps serialisation and adds no lock cycle. The narrowed catch turns no hold into a pass. The 404 change exposes no data.

### Minor (new, fix diff)
- **M12-7** — `suggestions.ts:163`: a non-`TypeError` from hashing propagates. For a deeply nested stored value, that is a `RangeError` (stack depth) and becomes a 500. Such a value is reachable only through a raw insert: `submitDraft` bounds the shape by schema and size. The error text names no id. Acceptable; record it.

### Deferred (out of scope of this round)
- OQ-45 must be decided before any route that reads drafts and before Z4 is switched on.
- Switching Z4 on still needs a design and migration for a non-superuser AI login: migration 021 forbids members of `libetech_ai`.
- M12-1 (trace id propagation, same pattern as `ReviewService`).

### Task 12 — updated verdicts
Security verdict: Approved
Spec compliance: ✅
Task quality: Approved
