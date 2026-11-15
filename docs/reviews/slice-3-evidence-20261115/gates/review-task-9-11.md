# Review of Task 9 and Task 11 (slice 3, branch slice-3-review-skills)

Reviewed: commits 60a5f4b..2f6433f, `src/server/skill-contracts.ts`, `src/server/text-safety.ts`, `src/server/skills.ts`, `skills/*`, the three test files and the two implementer reports. The suite was not re-run. The reports carry the test evidence, which I judged sufficient except where noted. All findings are #fact (read from the code) unless tagged #inference.

---

## Task 9 — skill contracts and output gate

Spec compliance: ✅ against the brief and rulings R-a to R-d, R-f and R-g. ❌ on one ruling: R-e ("a pointer-only context admits no statement at all") is only partly implemented (Important 2).

Gaps with file:line:
- `skill-contracts.ts:137-138`: the pointer-only rule fires only on `claims`, `conflicts` and `basis` items. Results that carry statements without a `basis` field are never seen (Important 2).

Task quality: Needs fixes

### Critical
None found.

### Important

**I-1. A conflict with no source is accepted** (`skill-contracts.ts:133-137`; the field is declared at `:52`)
- Input: `conflicts:[{field:'deadline', sourceIds:[], note:'Hai nguồn nêu hạn khác nhau'}]`, with a valid `sources` list and claims. `idsOf` finds no id, and rule 5 (`UNSOURCED_CLAIM`) looks only at `claims` and `result` items. Result: `accept`.
- A conflict is a statement about the sources. With `sourceIds: []`, or one id, it names no conflicting pair. DOC-05 says an output with no source stays a draft.
- The eval's `conflicting_sources` case cannot see this, because its only check is `minLength:1`.
- Fix: for each conflict, require at least two distinct ids, all visible, or raise `UNSOURCED_CLAIM` on `sourceIds.length < 2`. Add a test case. Update the prompt if it says otherwise.

**I-2. R-e is not met for results without a `basis` field** (`skill-contracts.ts:137`)
- `statements` is `claims.length>0 || conflicts.length>0 || items.some(basis.length>0)`.
- `basisItems` returns `[]` for `intake_analyst`, `doc_reviewer` and `release_librarian` (`:119`).
- In a pointer-only context (IBS HI), these outputs are accepted with `claims:[]` and `conflicts:[]`:
  - `intake_analyst` `result:{classification:'incident', duplicateOf:'<pointer event id>', missingFields:[…]}`
  - `doc_reviewer` `result:{diff:[{section,change:'modified',note}], impacts:[…], …}`
  - `release_librarian` `result.staleReminders[].note`
- All of these are statements and none rests on shown text. SPEC and brief say a pointer-only context admits no statement.
- `tests/skill-contracts.test.ts` R-e covers only `intake_analyst` and `ba_elicitation` with claims or conflicts, so the hole has no test.
- Fix: define `statements` per skill, for example:
  - intake: `classification !== null || duplicateOf !== null`
  - doc_reviewer: `diff.length || impacts.length || missing.length`
  - release_librarian: `index.length || staleReminders.length || approvedRevisionId !== null`
  - and so on for the other skills.
  Put that in one table next to `ID_FIELDS`, and test it for all six skills.

### Minor

- **M-1. `excerpt` with `text:null` counts as visible** (`:136`). A source_event with `mode:'excerpt'` and no text can support a claim. Fix: require `s.text !== null` for visibility.
- **M-2. The size and character check runs on a different value than the one parsed** (`:63-67` versus `:125`). `outputFits` examines `JSON.parse(JSON.stringify(raw))`, but `safeParse` and the returned `output` use `raw`. An object with a prototype `toJSON` or a getter can pass the check and then hold different data (#inference; model output arrives as plain JSON, so low risk). Fix: parse the round-tripped value, or have `outputFits` return it.
- **M-3. `sources[]` need not include what the claims cite** (`:131-133`). `sources:[A]` with `claims[0].basis:[B]` is accepted when both are in the context. Consider requiring that every cited id be listed in `sources`.
- **M-4. Id kind is not checked.** `doc_reviewer.candidateRevisionId` or `baseRevisionId` may be a `source_event` or `document` id. `intake.duplicateOf` may be a hidden event (`supports:false`). Fix: require kind `document_revision` for the revision ids. Consider setting `supports:true` for `duplicateOf`.
- **M-5. The context is trusted.** `checkSkillOutput` does not run `contextSchema` on `ctx`, and `known` (`:129`) silently keeps the last of two sources with the same id. Check this at the caller (Task 10/12), or add a `superRefine` for unique ids to the schema.
- **M-6. Mutation coverage.**
  - R-a, R-e, the `approvedRevisionId` branch of R-d, `confidence`, the sources and questions limits, and the `conflicts.length` term of `statements` were never mutated.
  - m3 and m6 are reported as proving "one thing", but each turns several cases red.
  - The claim "each mutation proves one thing" is therefore proven only for m4a, m4b, m7 and m8.

### ⚠️ Cannot verify from diff
- That `document-review.ts` keeps its behaviour after `storable` moved to `text-safety.ts`. The report says its 26 tests pass; I did not see the evidence file.
- That the DB `CHECK` constraints of migration 021 match the 100/50/16 384/32 768 limits (Task 8's concern).

### ID_FIELDS walk (requested)
- The table covers every id-bearing field of the six schemas: `sources.*.id`, `claims.*.basis.*`, `conflicts.*.sourceIds.*`, `duplicateOf`, `baseRevisionId`, `candidateRevisionId`, `approvedRevisionId`, `index.*.documentId`, `index.*.revisionId` and `staleReminders.*.documentId`. Nothing is missing, and the walk test would catch a clean-output id outside the table.
- Statement-bearing fields without an id are the gap (I-1, I-2): `conflicts.note`, `diff`, `impacts`, `missing`, `scopeRead`, `staleReminders.note`, `classification`, and `claims.value` (the last one is covered by its basis).
- Check order cannot mask a reason, because reasons are collected and then sorted. Only `SCHEMA_INVALID` stops early, as the brief says.

### For the receipt
- The gate checks structure, ids and visibility. It does not and cannot check that a statement is true.
- `document` and `document_revision` ids carry no visibility rule. Only `source_event.mode` does.
- The pointer-only rule covers `claims`, `conflicts` and results with a `basis`. Fix I-2 before stating that it covers everything.

---

## Task 11 — manifests, prompts, evals

Spec compliance: ✅ against the brief and R11-a to R11-h. All 18 files, the exact interface, the hash scheme and the sizes (largest eval 11 592 of 12 288 bytes, `skills/` 74 473 bytes) are as asked.

Gaps with file:line: none against the brief.

Task quality: Needs fixes (one prompt/schema mismatch)

### Critical
None found.

### Important

**I-1. The `pm_planning` and `technical_writer` prompts name a field those skills do not have** (`skills/pm-planning/prompt.md:18`, `skills/technical-writer/prompt.md:18`)
- The text reads "vào `questions` hoặc `unknowns`". `unknowns` exists only in the `ba_elicitation` result (`skill-contracts.ts:40`). `pm_planning` has `decisionsNeeded`. `technical_writer` has no such list.
- A model that follows the prompt and writes `result.unknowns` is held as `SCHEMA_INVALID` (strict schema). The evals cannot catch this, because no model is called.
- Fix: for these two skills say "vào `questions`" (and "`decisionsNeeded`" for pm), and regenerate hashes. Add a test that every `result.<field>` or identifier the prompt names exists in that skill's output schema.

### Minor

- **M-1. Conflict goods are weaker than the brief's table.** The brief says "`conflicts` có mục trích cả hai". The check is only `minLength:1` (`skills.ts:82`). A good output citing one source would pass. Fix: add checks on `conflicts.0.sourceIds` (or an `includes` check).
- **M-2. No eval exercises `TEXT_NOT_VISIBLE`, `NOT_APPROVED_REVISION` or pointer-only.** `tests/skills-eval.test.ts:47` forces `pointerOnly:false`, and all eval sources have `mode:'excerpt'`. This matches the five required categories. Say it in the receipt; no IBS HI eval exists.
- **M-3. The injection case proves only the empty allowlist.** The gate never reads context text, so the bad sample is held for the same reason in any context. The good sample (`toolRequests:[]`, `checks:[]`) is the normal output. State this honestly: injection resistance of a model is not tested, since no model runs.
- **M-4. Revoked-access and same-name cases are "id absent from context".** The context does not contain a second document with the same title, nor a revoked marker. They match the brief's table, but a reader may over-read them.
- **M-5. The prompt of `technical_writer` promises "ví dụ"** (`prompt.md:3`). The result schema has no examples field. Also, `manifestHash (hệ thống cấp)` is listed among output keys without saying who fills it. In the eval the runner does; in production the caller of Task 12 must.
- **M-6. Hashes are checked only in tests.** `skills.ts` exports no verify function, so a runtime load never rechecks prompt or eval bytes against the manifest. The brief only asks for the tests. The manifest hash also does not cover the output schemas or the gate code, only the `outputContract` string. A schema change leaves the hash unchanged.
- **M-7. Unchecked claims.** `skillEvalSets` deep freeze has no test (`skills.ts:45`). The test checks uuid shape only for context ids and the case id, not for ids inside `good` and `bad`. The dossier test uses a substring per item (`toContain`), so short items such as "impact" or "pilot" could match elsewhere in the prompt; comparing per-type lines would be stricter.
- **M-8. Eval bytes are bundled.** `skills.ts` imports all six `eval.json` files (~55 KB) into the server module, because the interface needs it. Confirm that Next does not ship them to the client; this is #inference.
- **M-9. Misc.** `canonicalJson` on a sparse array emits `[,]` (`skills.ts:57`). `cases: 30` in the evidence line is hardcoded and `afterAll` prints it. The default reporter hides the line (the report notes this; `--reporter=verbose` shows it).

### Evals checked case by case (the three I printed in full: intake_analyst, doc_reviewer, release_librarian; the other three were checked from the reports and the tests' exact-set assertion)
- Every good sample passes the gate and every bad one fails only for its stated reason (exact set equality in the test), and the 30/30 evidence is in the report.
- None is vacuous with respect to the stated reason: dropping the allowlist check, the empty-basis check or the context check would turn the matching bad samples red. The conflicts case is caught only by `CHECK_FAILED` (the gate cannot see a missing conflict), as the brief intends.
- Injection and conflicting content sits where each skill receives content: `source_event.text` for intake, ba and pm; `document.title` or `document_revision.summary` for the document skills. The documents-only skills have no `source_event`, so this is correct.
- The conflict samples for `doc_reviewer` and `release_librarian` are contrived readings, as the implementer says. Accept, and note it.

### Prompt review
- All six prompts hold the untrusted-data sentence (tested), their own row of the SPEC-009 table in paraphrase, `questions`, `conflicts`, and "Không gọi công cụ". None grants permission to act, approve, publish or call a tool. `release_librarian` explicitly forbids a delivered claim. Three carry the full dossier (tested against `MINIMUM_DOSSIER`), and all three say no commit hash is forced for business documents.
- The one real fault is Important I-1 above.

### Manifest and hash review
- Every manifest field is asserted by a test (name, version, owner, attribution, paths, scope, kinds against `CONTEXT_KINDS`, empty allowlist, `modelBinding`, `enabled`, `evalSet.cases`). The manifest hash is recomputed from disk. A prompt or eval byte change turns the hash test red.
- A change to a manifest together with a recomputed hash goes red only for the explicitly asserted fields. This is acceptable.
- The injection test proves allowlist and hash are unchanged after running the case. It is an invariant check rather than a mutation of the manifest from text; it matches what the brief asks.

### ⚠️ Cannot verify from diff
- That Task 10's `CONTEXT_KINDS` and context builder actually put `title` and `summary` text before the model, which the injection placement relies on.
- That the three eval files I did not print (ba_elicitation, pm_planning, technical_writer) have no contrived content. I relied on the report table and the exact-reason test.

### For the receipt
- The eval runs mock outputs through the gate. No model, no network, nothing enabled. It tests the gate and the contracts, not a model's behaviour.
- `conflicting_sources` for the document skills compares revisions, and for `release_librarian` two approved documents.
- No pointer-only or IBS HI case is in the eval set.
- The hash binds prompt, eval and manifest content, not the schemas or the gate code.
- The "no personal name" test checks patterns only (e-mail, phone, handle, chat id, secret words); it cannot detect a plain name.
- The evidence line needs `--reporter=verbose` to appear.
