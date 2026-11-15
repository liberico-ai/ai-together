# Review — slice 3, Task 5 (`ReviewService`)

Scope: commit `3b2d9ca` on base `1f61d7c` (one commit), read from the review package `.superpowers/sdd/slice-3-review-skills/review-1f61d7c..3b2d9ca.diff`. Bound by `task-5-brief.md` and `schema-notes-for-services.md`. Reviewed in one pass over the service, then one over the two test files. No test was re-run; no database was touched.

Focused checks outside the diff (one per named risk):
- `migrations/020_document_review.sql:31-109, 147-212, 260-328` — table shape, live-delegation uniqueness, insert policies, decision guard (the LTR01 branch), approved-pointer guard: does the service rely on anything the schema does not give.
- `migrations/019_document_approver_grant.sql:56-78` — `document_approvers`: does it exclude viewers and inactive accounts, and is `doc_types` ordered.
- `migrations/006_bom_allocations.sql:86-112` — `bom_eligible_members`: is the two-argument call lock-free (S38) and does it return the effective project role.
- `src/server/documents.ts:133-141` — `proposeRevision` lock order versus `decide` (deadlock path).
- `src/server/types.ts:7-11` — `projectRole`, used by the read gate.
- `docs/reviews/slice-3-evidence-20261115/task-04{a,b}-*native.txt` — whether the two `DeprecationWarning`s pre-date this task.

### Spec Compliance

Interface and files
- ✅ `src/server/document-commands.ts:7-28` — `claimDocumentCommand` moved verbatim (byte-for-byte equal to the removed block at `documents.ts:-80-102`), exported; `documents.ts:3` imports it; the unused `createHash` import went with it.
- ✅ Types and signatures in `document-review.ts:219-228, 252-289, 314-504` match the brief's interface block.
- ✅ `tests/slice3-fixtures.ts:+1284-1293` — `beforeStatement` appended; no existing export changed.

Brief checkbox list (`tests/document-review.test.ts`, `tests/document-review-concurrency.test.ts`)

| Brief case | Present | Code asserted | Nothing written asserted | Would fail if broken |
|---|---|---|---|---|
| DOC-06 source change → REVISION_CONFLICT, re-decide on r2 | ✅ :765-778 | ✅ + exact sentence | ✅ snapshot | ✅ |
| (3) stale revision id / hash / version | ✅ :780-792 (also hash dropped, future version) | ✅ | ✅ | ✅ |
| (1) author cannot decide (delegation and grant) | ✅ :794-802 | ✅ | ✅ per case | ✅ |
| no authority / outside type, no name or title | ✅ :804-813 | ✅ | ✅ | ✅ |
| delegate cannot approve; changes_requested stored as `review_delegation` + id | ✅ :815-826 | ✅ | ✅ | ✅ |
| grant covers comment + changes_requested only for its types; `approval_grant`, NULL delegation | ✅ :828-841 | ✅ | ✅ | ✅ |
| (5) project A approver on project B = unknown id; viewer, bot, outsider | ✅ :843-866 (also a sales viewer) | ✅ whole-sentence equality | ✅ | ✅ |
| (6) same key → one decision; same key other content → IDEMPOTENCY_CONFLICT | ✅ :868-878 | ✅ | ✅ decisions + events | ✅ |
| SOURCE_NOT_FROZEN writes nothing; changes_requested on it stored | ✅ :880-890 | ✅ | ✅ | ✅ |
| frozen approval moves pointer once, version +1, one event; DOC-07 | ✅ :892-911 | ✅ payload ids/versions, no exception text in payload | n/a | ✅ |
| second decision either order, other key, other person | ✅ :913-929 | ✅ | ✅ | ✅ |
| authority lost before the click (revoke; stale session grant; membership lost → 404) | ✅ :931-949 | ✅ | ✅ (global counts) | ✅ |
| revision without hash; document without revisions not queued, decision conflicts | ✅ :951-964 | ✅ | ✅ | ✅ |
| queue approverState (nobody / only author / other / viewer-role holder) + reasons | ✅ :1003-1030, pure table :1032-1045 (set order checked) | ✅ | n/a | ✅ |
| queue lists latest revision once, also after decision, never older | ✅ :1047-1071 (+ paging, limits, strict) | ✅ | n/a | ✅ |
| comments on latest; addressed/resolved roles; markup kept; 2001 refused | ✅ :1118-1152 | ✅ | ✅ | ✅ |
| reply stored on the root's revision; foreign / unknown / reply parent → 404 | ✅ :1154-1171 | ✅ + sentence | ✅ | ✅ |
| comment without authority → APPROVER_NOT_AUTHORIZED (none, wrong type, revoked, addressed, resolved) | ✅ :1173-1195 | ✅ | ✅ | ✅ |
| decided revision: new comment REVIEW_ALREADY_DECIDED, follow-ups stored; after both results | ✅ :1197-1213 | ✅ + `canComment:false` | ✅ | ✅ |
| ids in any case; U+0000 / lone surrogates → ZodError | ✅ :1217-1249 (doc id, revision id, parent id upper-cased) | ✅ | ✅ | ✅ |
| forged fields | ✅ :1251-1266 (decide, comment, reply; also `revisionId` on a reply, unknown kind, bad request id) | ✅ ZodError | ✅ | ✅ |
| failed decision leaves nothing (per branch) | ✅ :966-987 (9 branches) | ✅ | ✅ per branch | ✅ |
| approval does not touch work, evidence, audit, acceptance | ✅ :989-999 (counts + digest over `work_items` rows) | n/a | ✅ | ✅ |
| concurrency: two approvers; one person two keys; approval vs changes_requested | ✅ concurrency :614-643 | ✅ one ok, one REVIEW_ALREADY_DECIDED | ✅ one row, one event, pointer once, version +1 | ✅ |
| decision racing a proposal never lands on the newer revision | ✅ :645-666 | ✅ | ✅ | partly — see M-5 |
| authority lost between read and insert (revoke; grant reduced) → 403, nothing stored | ✅ :668-697 | ✅ 403, not 500 | ✅ decisions, events, commands, version | ✅ (implementer's mutation of the LTR01 check turned it red) |

Security questions

1. **Authority.**
   - ✅ Read in the writing transaction: `decide` calls `authority()` inside `run()` after the row lock (`document-review.ts:459-465`); `authority()` reads `public.document_approvers` and `bom_eligible_members` and the live `review_delegations` row (`:332-341`). `p.grants` is never consulted for authority; only the read gate uses the session role (`reader`, `:310-312`), which is the `InboxService` convention.
   - ✅ Commenter cannot approve: `:469-471` — the delegation branch is taken only for `changes_requested`; the table CHECK `review_decisions_approval_needs_grant` (`020:65`) backs it.
   - ✅ Author refused before any authority branch (`:466`); the guard re-checks (`020:287`).
   - ✅ Another person's delegation cannot be used: the query filters `delegate_id=$me` (`:338`); the guard checks `delegate_id = decided_by` and the FK ties `delegation_id` to `decided_by` (`020:74, 271-272`).
   - ✅ Revoked / other type / other project: `revoked_at IS NULL`, `project_id=$1`, `includes(doc_type)` (`:338, 469-470`); one live delegation per person and project is a unique index (`020:109`), so `rows[0]` is never an arbitrary pick.
   - ✅ Viewer / bot: refused with 404 at `locate` / `queue` (`:327-329, 383-385`); `document_approvers` and the guard exclude viewers at the database (`019:72`, `020:274-277`).
   - ✅ Time-of-check/time-of-use: the document row is locked (`:401`); delegation and membership are plain reads (S38); a revoke or grant reduction committed after the read is caught by the guard's LTR01 and mapped to 403 (`:483-487`), proven by the native case.
   - ✅ Comment authority: `comment` needs `covers()` and not author (`:426`); `addressed` needs author of the root's revision (from the database) or a database `manager` role (`:436-437`); `resolved` needs the root writer or a covering non-author (`:438`). Revocation for comments is service-only, as S71 rules.
2. **Exact revision.**
   - ✅ Revision must belong to the document (`revisionOf` filters `document_id`, `:405-407`) → REVISION_CONFLICT.
   - ✅ Version, latest pointer and hash compared under the lock, NULL compared as NULL (`:473`); the guard repeats it (`020:288-293`).
   - ✅ Document without revisions: decide → REVISION_CONFLICT (`revisionOf` misses); queue skips it (`:387-388`); detail → `NO_REVISION` (departure 4).
   - ✅ Pointer moves only on approval of a frozen revision, in the same transaction, in one `UPDATE` that does not touch `latest_revision_id`, with `version=$3` guard → REVISION_CONFLICT (`:490-495`); the pointer guard (`020:307-322`) backs every condition.
3. **Isolation and leakage.**
   - ✅ Unknown id, other project, other tenant, viewer, bot all go through `denied()` with one sentence (`:212-213, 325-330, 400-403`), tested by whole-sentence equality.
   - ✅ Errors are fixed sentences; no name, title, count or text in any error. Queue/detail return ids only for people (`proposedBy`, `decidedBy`, `actorId`), no names (test `:1091`).
   - ✅ `approverState` is a two-value flag; the approver list read at `:350` is never returned.
   - ✅ Every list runs on one project: `queue` requires `projectId` and `run()` narrows `app.project_ids` to it (`:318-323`).
   - ✅ No logging in the new code.
4. **Write integrity.**
   - ✅ One `scoped()` transaction with `app.person_id` set (`:318-323`); claim, decision, pointer and event inside it; any throw rolls the claim back too (test "key reused for other content" snapshot includes `document_commands`).
   - ✅ Lock order: document row `FOR UPDATE` first, then claim — the same order as `proposeRevision` (`documents.ts:137-141`); the guard's `FOR NO KEY UPDATE` is on the row already held. No deadlock path found; the native ×3 run shows none.
   - ✅ Idempotency: UNIQUE + `ON CONFLICT DO NOTHING` for the claim and the decision; no select-then-insert as the duplicate guard (`hasDecision`, `:408-410`, only picks the code, as the brief allows). Fingerprint = op + document id + parsed input incl. `expectedVersion` (`:420, 462`).
   - ✅ LTR01 mapping is narrow: one `try` around the decision `INSERT` only, `code === 'LTR01'` only, everything else re-thrown unchanged (`:477-487`).
5. **Input handling.**
   - ✅ All schemas `.strict()` (discriminated union members each strict) (`:235-249`); no actor, tenant, project, authority or delegation taken from input; `requestId` validated as uuid (`:414, 455`).
   - ✅ Ids lower-cased at parse (`:234`) and compared with database ids (`me = p.id.toLowerCase()`; DB-returned `rev.id`, `parent.id`).
   - ✅ U+0000 and lone surrogates refused in `body`, `anchor`, `scopeNote`, each `exceptions` element (`:231-233`); other controls stored (test `:1247-1248`).
   - ✅ SQL built from fixed column-list constants and positional parameters only.
6. **Concurrency evidence.**
   - ✅ `race()` holds the row lock on the operational connection, starts both calls, `waitForBlocked(h,2)`, then commits to release (`concurrency :603-611`); asserts one `ok` + one `REVIEW_ALREADY_DECIDED`, `count(review_decisions)=1`, one event, pointer once, version +1.

⚠️ Cannot verify from this diff alone: that `outsider` in `slice1-fixtures` is of another tenant (the cross-tenant case rests on it); that the runtime role holds `UPDATE(version, updated_at)` on `document_records` from an earlier migration (020 only grants `approved_revision_id`) — the green native run implies it does.

### Strengths
- Check order in `decide` follows the brief step by step and is annotated (1)…(8); the guard is a true second line, not the first.
- Authority read from the database is tested both ways: a stale session still carrying `doc_approve:design` is refused, and the native case revokes/reduces between the read and the insert.
- Negative cases snapshot decisions, events, comments, commands and the record (version, latest, approved pointer) before and after, not just the error.
- Leakage tests compare whole sentences against the unknown-id answer and also scan for titles and person names.
- `beforeStatement` is a small, honest test seam; the closing "authority back → decides" step in the native case shows the refusals came from the lost authority.
- Events carry ids and versions only; the approval test proves the exception text is not in the payload.

### Issues

#### Critical
None.

#### Important
None.

#### Minor
- **M-1 — `resolved` excludes the revision's author (business-rule addition).** `document-review.ts:438`. Scenario: a person designated as a commenter for `design` who also authored r1 wants to resolve a reviewer's remark on r1 → refused, though the brief says "người có một trong hai thẩm quyền" may resolve. The direction is safe (stricter) and consistent with the `AUTHOR` row, but it is a rule the brief does not state. Smallest fix: keep it, and record it for the controller/Chairman as an addition to OQ-31 (or drop the `parent.proposed_by !== me` clause if refused).
- **M-2 — `addressed` by the author and `resolved` by the root writer do not re-read membership.** `:437-438`. Scenario: the author is removed from the project in the database while their session still lists it → `addressed` is still stored. Only the manager branch reads the role from the database. The brief requires database authority for decide (S30), not for these follow-ups, and commenting is service-only (S71), so this is within scope; noting it so Task 13 (HTTP) does not assume otherwise. Smallest fix if wanted: require `auth.role` ∈ READ_ROLES for both branches.
- **M-3 — comments in `detail` are cut at 1000 silently.** `:377` `ORDER BY created_at,id LIMIT 1000` returns the oldest 1000 and hides newer ones without a signal. Smallest fix: return a `commentsTruncated` flag or page comments (E-BE-05).
- **M-4 — a new `comment` on an older, decided revision answers REVIEW_ALREADY_DECIDED rather than REVISION_CONFLICT.** `:427-428` check "decided" before "latest". Both refuse and write nothing; only the code a stale card sees differs. Smallest fix: swap the two lines (latest first) if the controller prefers the stale-card code.
- **M-5 — the decision-versus-proposal race does not force both orders.** `concurrency :645-666`: which call takes the lock first after release is not controlled, so one interleaving may never run; `decided.length + conflicts ≥ 1` is weak. The safety property (no decision on the newer revision) is asserted correctly. Smallest fix: stage two runs, each parking one call first (e.g. start the second only after `waitForBlocked(h,1)`).
- **M-6 — "foreign revision id" uses a random uuid, not a real revision of another document.** `test :972`. The query filters `document_id` (`:406`), so the risk is low. Smallest fix: add one case with `other.revisionId`.
- **M-7 — small duplication and long lines.** `NOT_FOUND`/`denied`/`iso`/`RecordRow` repeat `documents.ts`; `run`/`locate` mirror `inbox.ts`; `READ_ROLES` repeats the role list the SQL functions hold. Several lines exceed 250 characters (`:243, 358-362, 473-474`). No logic block is copied verbatim. Smallest fix: share `NOT_FOUND`/`denied` from one module when Task 13 adds handlers.
- **M-8 — `detail` assumes the latest revision row exists.** `:371-373`: if `items()` skips the record (`:355`), `item` is `undefined` and the next line throws a TypeError (500). Unreachable with the FK on `latest_revision_id` plus RLS on the same project; defensive `if (!item) throw denied()` would make it explicit.

### The implementer's six departures
1. **Delegation counts only while the delegate is an active member with a reading role** — ✅ accept. It mirrors the decision guard exactly (`020:274-275`), keeps the service answer equal to the guard's, and makes LTR01 the rare path the brief intends.
2. **A new `comment` by the revision's author → APPROVER_NOT_AUTHORIZED** — ✅ accept. It follows the brief's own `eligibility()` row (`AUTHOR` → `canComment:false`) and S70's code.
3. **`resolved` through an authority excludes the revision's author** — ⚠️ accept with confirmation (M-1): safe direction, but a rule addition the brief does not carry.
4. **`detail` on a document without revisions → `NO_REVISION` 409** — ✅ accept. The caller has passed the read gate and can see the document through `DocumentService`, so 409 leaks nothing; Task 13 must map the code.
5. **Defaults and limits stricter than the CHECKs** (`anchor` default `''`, `exceptions` default `[]`, lowercase-only `sourceHash`, `trim()` on `scopeNote`, byte estimate for `exceptions`) — ✅ accept. Each refuses earlier than the database, never later; the jsonb byte estimate (`+ a.length`) is an upper bound of the `", "` separators. Uppercase hash → 422 matches `proposeSchema`; S76 lower-casing covers identifiers, not hashes.
6. **Two Node `DeprecationWarning`s in the native full log** — ✅ pre-existing, demonstrably: the same warning appears in `task-04a-full-native.txt`, `task-04a-green-native.txt`, `task-04b-*-native.txt` (all fix rounds), before this task existed. Still a finding for the slice (a pg client is given overlapping `query()` calls somewhere in older native tests), not for this task.

### Checked and found sound
- `claimDocumentCommand` move is verbatim; `documents.ts` behaviour unchanged (green suites, no edited test).
- One live delegation per person and project (`020:109`) — the single-row read is correct.
- `document_approvers` returns alphabetical `doc_types`, excludes viewers, inactive and passwordless accounts (`019:61-74`); the service uses `includes` everywhere; the pure test proves order independence.
- `bom_eligible_members` two-argument call is lock-free (`lock_rows DEFAULT false`, `006:86-91`), as S38 requires.
- Reply rows carry the root's `document_id` and `document_revision_id`, satisfying the composite FK (`020:47`); `parentId` must be a `kind='comment'` row of this document, else 404.
- Approval guard and the service's single `UPDATE` agree: pointer to `OLD.latest_revision_id`, decision by `app.person_id`, frozen revision, never NULL.
- `review_events` payloads carry ids, result and versions only; `kind` ≤ 64; payload far under 8 192 bytes.
- Fingerprints differ per operation (`document.review.comment` / `document.review.decide`), so a key cannot be replayed across commands.
- Evidence logs: RED is a module-not-found at import (expected), GREEN PGlite 72/72, native 80/80, full suites green, concurrency ×3 green, no deadlock.

### Assessment
**Task quality:** Approved

The decision path holds every safety invariant at both layers — exact revision, hash and version under the row lock, authority from the database, LTR01 narrowly mapped, pointer moved once in the approver's transaction — and the tests prove each refusal writes nothing. The Minors are a rule addition to confirm (M-1), two coverage tightenings and a silent comment cap; none blocks the next tasks.
