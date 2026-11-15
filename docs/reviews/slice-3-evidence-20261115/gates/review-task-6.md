# Review of Task 6 (3decd9b..90e0b61): document dependencies and the "needs review" flag

### Spec Compliance
- Authority: ✅ `document-dependencies.ts` link: bot, non-member, and any role other than manager give `denied()` (404 SCOPE_DENIED, one message) before any query. `confirmed_by` is `p.id` from the session; the schema is `.strict()`.
- Same project and same answer: ✅ both documents are selected with `project_id=$2`. A missing, cross-project or out-of-scope document throws the same `denied()`. The test checks the message does not contain the title.
- Identifiers and text: ✅ `uuid` lower-cases at parse (S76). `note` is bounded to 500 and refuses U+0000 and lone surrogates (S80). SQL uses fixed fragments and positional parameters.
- Link integrity: ✅ self-link and "no revision" give 422 DEPENDENCY_INVALID. Insert is `ON CONFLICT DO NOTHING` and a duplicate gives 409 DEPENDENCY_EXISTS. It goes through `claimDocumentCommand`, so replay returns the same link and a different body with the same key gives IDEMPOTENCY_CONFLICT. One `dependency.linked` event.
- Flagging: ✅ `documents.ts:155` runs `flagDependents` after the `latest_revision_id` update, inside the same `scoped()` transaction and inside the idempotency claim. An error (guard, RLS) rolls back the whole proposal, with no swallow. The flag is stored, set or advanced (`version+1`), never cleared. The event actor is the proposer, because `app.person_id` is set at `documents.ts:140` before the lock. The `UPDATE` filters `tenant_id`, `project_id` and `upstream_document_id` only, so there is no transitive flagging (tested, including the A->B->A cycle).
- Proposal without dependents: ✅ one extra `UPDATE` matching zero rows. The only new failure surface is the `set_config`. Only caller of `proposeRevision` is `documents-http.ts:39`.
- Lock order: ✅ document row first, then claim, as in `proposeRevision` and `decide`. `link` takes `FOR SHARE` on upstream, then the claim. I traced the paths and found no deadlock. The share lock conflicts only with `FOR UPDATE`. The FK check on the dependent row is a KEY SHARE and it also conflicts with `FOR UPDATE`. A concurrent proposal holding `FOR UPDATE` on B and updating rows whose upstream is B never waits on `link`'s uncommitted insert (invisible), and never waits on A. Two crossing links (A->B, B->A) take SHARE and KEY SHARE, which are compatible.
- Migration alignment: ✅ the insert policy needs `needs_review=false` and null flag, which the insert satisfies. The `UPDATE` supplies only granted columns (`needs_review`, `flagged_revision_id`, `version`). `flagged_at` and `updated_at` come from the trigger.
- Brief cases: ✅ all present. S40 under the runtime role with event actor asserted. Flag every dependent. Failed (stale) proposal leaves a full snapshot unchanged. Not transitive/cycle. Authority matrix (viewer, bot, viewer-grant, member, reviewer, other-project approver, other tenant) with the snapshot unchanged. Cross-project, self, no-revision, duplicate, replay, key reuse. List requires project and rejects forged keys. Forged-fields case. Logs show PGlite and native green; I did not re-run.
- ⚠️ Cannot verify from the diff: `outsider` is another tenant (named `otherPrincipal`, so very likely); the slice-1/slice-3 existing suites were green on both runs per the logs.

### Strengths
- The flag, the event and the revision are one transaction. The test snapshots deps, events, commands and records after a refused call.
- Defence in depth: tenant filter on the `UPDATE`, DB guard and policy behind the service checks, deterministic event order.
- The authority matrix test loops over seven principals and asserts code, status, message and "nothing written".
- Honest red log, and the person_id line was removed to show three cases fail.

### Issues
#### Critical
None.
#### Important
None.
#### Minor
- `tests/document-dependencies.test.ts`: no case where flagging itself fails (for example a flag the guard refuses) and the whole proposal, including the new revision, rolls back. "A failed proposal flags nothing" covers the stale-version direction only. Smallest fix: one PGlite case that makes the `UPDATE` fail (for example a dependency row with an inconsistent flagged revision seeded by the operator) and asserts the snapshot is unchanged.
- No native race test of `link` against `proposeRevision` (the implementer already notes this). The `FOR SHARE` reasoning is sound on paper; Task 12 or the whole-branch review should add one.
- `set_config('app.person_id', …)` now appears in `inbox.ts:98`, `document-review.ts:122`, `documents.ts:140`, `document-dependencies.ts:62`. It is a one-line statement, not a logic block; I do not count it as duplication. If a fifth appears, extract `setActingPerson(tx,p)` next to `scoped()`.
- `documents.ts:3` puts `node:crypto` after the local imports (style only).
- `flagDependents` trusts the caller for `projectId`; the tenant/project filters and RLS cover a wrong value, so safe.

### The implementer's departures
1. `flagged_at`/`updated_at` not supplied: correct. The runtime role has no grant to treat them freely and the trigger stamps them; supplying them would be overwritten.
2. `UPDATE` also filters `tenant_id`: correct, harmless belt-and-braces.
3. Non-manager gets 404, not 403: matches the brief's case (and the global same-answer rule); fine.
4. `FOR SHARE` on upstream in `link`: justified. It makes "latest revision" in the link the one a concurrent proposal will flag against. I found no deadlock.

### Assessment
**Task quality:** Approved
