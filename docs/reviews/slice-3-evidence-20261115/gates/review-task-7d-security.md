# Task 7d security and quality review — commit b5d6d21 (base 2e81796)

Reviewer: liberico-security-reviewer (advisory, findings only). No test run, no database connection, nothing edited except this file.
Evidence base: the diff, `src/server/review-delegations.ts` (whole file), `src/server/document-review.ts` (`reader`, `authority`, `items`), `migrations/006` (`bom_eligible_members`), `migrations/019` (`document_approvers`), `migrations/020` (`runtime_select`), tests of 7d and test (j).

### Spec compliance
Matches the brief and S86 on every point I could check; nothing missing, nothing extra beyond one legitimate stricter choice.
- Caller status read from the database in the same transaction (`dbRole` at review-delegations.ts:96 area, inside `this.run`); session role/grants only used as an extra AND for `canDesignate` (unchanged meaning).
- Coordinator: all rows, both indicators. Other reader: own rows (all states) with both basis texts; others' rows only live and not dormant, id/delegateId/docTypes, rest null; revoked and dormant rows of others never returned. viewer/bot/outsider/other tenant: unchanged 404 (`reader()` before the transaction, RLS + `app.project_ids` inside).
- No migration; grant/revoke code untouched; no logging of basis; no new definer function.
- Misread: none. Extra: (a) the caller whose database role is no longer a reading role gets 404 (stricter than the brief, and correct; the brief says «vai của người gọi lấy từ CSDL»); (b) LIMIT raised 200 -> 1000 with a 200 slice after filtering (needed so hidden rows do not consume the page; see M2).
- Open reading: own rows carry null indicators (see Questions).

### Who receives what
Fields of a row: id, delegateId, docTypes | projectId, grantedBy, basis, revokedAt, revokedBy, revokeBasis, version, createdAt | designatorIsCoordinator, dormant. Top level: `reviewers`, `approvers`, `canDesignate`. No total/count field exists.

| Caller | (a) own rows | (b) others, in effect | (c) others, revoked | (d) others, dormant |
|---|---|---|---|---|
| Coordinator (session manager AND database manager) | all fields; both indicators set (own row as delegate is just a row) | all fields, both indicators | all fields, `dormant:false` always, `designatorIsCoordinator` set | all fields, `dormant:true` |
| Non-coordinator reader who is a delegate (engineer/technical/business in DB, any session role below manager) | all fields incl. grantedBy, basis, revokeBasis, revokedBy; both indicators `null`; own row is never dormant (caller must hold a reading role to get here) | id, delegateId, docTypes; other 9 fields `null`; | not returned (excluded by SQL predicate and, redundantly, by the loop) | not returned |
| Non-coordinator reader, not a delegate | none | same as above | not returned | not returned |
| Session says manager, database says engineer/technical/business | as the ordinary reader; `canDesignate:false` | as ordinary reader | not returned | not returned |
| Session says manager (or any reader role), database role is viewer / none / disabled | 404 SCOPE_DENIED, identical text and status to outsider | same | same | same |
| Session viewer, bot | 404 (`reader()` / `role==='bot'` before any query) | same | same | same |
| Member of another project / other tenant | 404 (`reader()`; inside, RLS plus `bom_eligible_members` answer only for the project in scope) | same | same | same |
| Session says engineer, database says manager | ordinary reader view (`canDesignate` needs both) — conservative, no leak | | | |

Channel check, field by field:
- `canDesignate`: boolean of the caller's own standing; no hidden-row dependence.
- `approvers`: untouched, derived from `document_approvers` (membership grants), not from delegation rows; ids and types only. It is visible to every reader as before; it carries no basis, designator or dormant fact. See Question Q2.
- Count / total: none. The 200 slice and the 1000 SQL limit are applied after the visibility filter for what is returned; hidden rows only affect the output when more than 1000 rows exist (M2).
- Ordering: `ORDER BY (revoked_at IS NOT NULL), created_at DESC, id` runs on the SQL-filtered set, so hidden rows do not influence it; but the order of the visible rows reveals the relative creation order of others' rows, while `createdAt` is withheld (M1).
- `null` vs absent: every key is always present; there is no shape difference between «withheld» and «not applicable», so no distinction to read. For others' rows `null` is the only value for the nine fields.
- Errors: single `SCOPE_DENIED` 404 for all denial classes; `listSchema` strict parse unchanged.
- Absence as a signal: a non-coordinator who learns by another route that X comments (comment authors are visible in review) and sees X missing from the list can infer revoked-or-dormant. This is inherent in the Chairman's wording (only those who comment) and S86; not a defect, stated for completeness.

### Strengths
- Visibility object for others' rows is built by an explicit literal, not by spread of `toView`, and typed `ListedDelegation` so that a later field must be consciously added; basis text of others never reaches the response object.
- Same notion of eligibility on both sides: `dormant` = unrevoked and delegate not an active member with a reading role (`READ_ROLES.has(role ?? '')` over `bom_eligible_members`), exactly the `authority()` test at document-review.ts:139 and the LTR02 guard; the label cannot disagree with the effect. `designatorIsCoordinator` uses `granted_by` of the row and `project_role==='manager'`, the guard's own test (020: g.project_role='manager'); absent from the function result (disabled, left project) gives `false`.
- Caller's role from the database inside the same scoped transaction; fail-closed to the outsider answer when the database no longer gives a reading role.
- SQL: fixed fragment, positional parameters only (`$1` project, `$2::boolean`, `$3::uuid`, `$1::uuid`, `$2::uuid[]`), nothing concatenated; the only interpolated token is the constant `COLUMNS`. No logging; errors carry no names.
- Tests: the negative case scans the whole serialised result (`JSON.stringify`) for `MARKER-` and the designator id, asserts the exact object shape for others' rows with `toEqual`, includes a revoked row (seed) and a dormant row (second half); the effect-unchanged cases go through `ReviewService` in both directions and assert zero comments written while dormant.

### Findings

#### Critical
None.

#### Important
**I1 — tests/review-delegations.test.ts:196 (test (j)) is defeated by operand order, and the implementer used that to get past it.** The source check `not.toMatch(/SELECT[^;`]*FROM review_delegations[^;`]*delegate_id\s*=/)` exists to guard one property: the live-designation uniqueness in `grant` is decided by the unique index, not by a read-before-write (TOCTOU, ADR-018, E-BE-08). The new `list` SELECT legitimately reads `review_delegations` with a delegate comparison and would have tripped it; writing `$3::uuid=delegate_id` makes the regex blind to this query — and equally blind to any future `SELECT ... WHERE $2=delegate_id` inside `grant`, which is the exact thing (j) must catch. A property check that passes by operand order is not a guard. Scenario: someone adds `SELECT 1 FROM review_delegations WHERE $2::uuid=delegate_id AND revoked_at IS NULL` before the INSERT in `grant`; (j) stays green. Honest fix: change the property under test to what it means — extract the source of the `grant` method (from `async grant(` to `async revoke(`) and assert it contains no `FROM review_delegations` SELECT at all (operand-order independent), keep the ON CONFLICT assertion; then `list` may be written naturally (`delegate_id=$3::uuid`). Editing (j) is within the task because the task is what exposed its scope; the report claims «untouched» and presents the workaround as a feature. Smallest fix: scope (j) to the grant body; optionally revert the SQL operand order for readability.

#### Minor
**M1 — review-delegations.ts (list query ORDER BY).** For a non-coordinator, the order of others' live rows is `created_at DESC`, so the relative grant order of other people's designations is readable although `createdAt` is null. Low value fact; fix if wanted: order by `id` (or delegate_id) for the non-coordinator branch.

**M2 — LIMIT 1000 then `.slice(0,200)`, live rows before revoked.** For a non-coordinator with more than 200 live designations in the project, own revoked rows (sorted after all live rows) are cut off, so «their own rows complete» fails; dormant rows consume the 1000 before being dropped. Not a leak, not realistic at present volumes (at most one live designation per person). Fix: order own rows first for the non-coordinator (`ORDER BY ($3::uuid<>delegate_id)`, then the current order), or cap each class separately.

**M3 — «own row» is decided by comparing a database-returned `delegate_id` with `p.id.toLowerCase()` from the session** (the SQL predicate casts `$3::uuid`, so the two can disagree for a uuid spelling the cast accepts but lower-casing does not normalise: braces, missing hyphens). Failure is closed (the row falls to the others' branch and is nulled or dropped), but the own-row test should use one authority. Fix: select `(delegate_id=$3::uuid) AS mine` in the same query, or take the canonical id from `dbRole` (`bom_eligible_members` returns `user_id`).

**M4 — redundant filters mean two mutations are not detectable.** The SQL predicate `OR revoked_at IS NULL` and the loop guard `r.revoked_at == null` each exclude revoked rows of others; removing either leaves every test green. Defence in depth is good, but the brief asks that teeth be shown; add one case that would only be caught by the second filter (cannot be done black-box; accept and say so), or keep as documented redundancy. Likewise the SQL still selects `basis`/`revoke_basis` of others' rows into memory for the non-coordinator path; selecting `NULL` for them would make the withheld text never leave the database. Optional hardening.

**M5 — readability: «who gets what» is spread over five places** — the JSDoc of `list`, the comment on `DelegationView`, the type `ListedDelegation`, the SQL predicate, and the three-branch loop, and the coordinator test is the side effect `canDesignate` (so a later change to the meaning of `canDesignate`, e.g. a designate-only permission, silently changes who reads basis texts). Smallest fix: `const isCoordinator = canDesignate` named and commented as «may read everything», plus a single `visibility(r)` helper that returns the three outcomes; no behaviour change.

**M6 — the mutation log's third mutation is described as «change the dormant condition»; the report says «always false».** Equivalent in effect; the log text should state the real edit. Teeth I doubt: «indicators are for coordinators only» loops over rows but does not assert the list is non-empty for each caller (a bug that returns no rows would pass); add `expect(l.reviewers.length).toBeGreaterThan(0)`. The OQ-41 negative test uses only one non-coordinator caller (`business2`); the others are covered only by the null-indicator loop.

### The implementer's flagged points
1. **Own rows: both indicators null.** Acceptable and conservative; consistent with S86 and with the test named «indicators are for coordinators only». `dormant` for a caller's own row is always false by construction (the caller must hold a reading role), so it adds nothing; `designatorIsCoordinator` on an own row would reveal the current role of another person, though `grantedBy` of the own row is already visible. A product question, not a defect — Q1.
2. **404 for a caller whose database role is no longer a reading role.** Correct and wanted: same answer as an outsider, no distinguishing channel, fixed by the database role rule. Route must map it as the existing 404.
3. **Nullable fields in the return type.** Right way to do it (compile-time pressure on the route and screen). One caution: `ListedDelegation` makes every field except three nullable, so the screen cannot tell «withheld» from «none»; it should branch on `canDesignate` and on `r.delegateId === currentUser`, not on `null`. Test (j) operand ordering: see I1 — a workaround that weakens the guard; fix the test, not the SQL.

### Questions that are not the session's to decide
- **Q1.** Should a delegate see the two labels on their own rows? Options: (a) no, as built — labels only for coordinators; (b) own rows get `designatorIsCoordinator` (the delegate learns that their designation outlives its designator, which OQ-39 wants the «danh sách và giao diện» to state) but never `dormant`; (c) own rows get both. OQ-39's quoted words do not say to whom.
- **Q2.** `approvers` (who holds an approval grant, by document type) is returned to every reader. OQ-41 decides commenters and basis text only. Is the approval-grant holder list intentionally readable by every reader, or should it follow the same restriction?
- **Q3 (recorded decision, consequence to state).** `runtime_select` on `review_delegations` lets every scoped runtime reader read every column including basis: the restriction exists only in `DelegationService.list`. Any other service, route or report that selects from this table returns basis text to whoever it serves. At present only `list`, `grant`, `revoke`, and `authority()` (types only) touch the table; a future query needs the same rule or a database-level column restriction (a view or column privilege), which is a migration and so not this task.

### Checked and found safe
- `grant` / `revoke` return `toView` (full basis, indicators null) but only after session manager AND database manager; a non-coordinator cannot reach them (`managerRequired` / 404). No other method returns delegation rows. `document-review.ts` `authority`/`items`/`detail` expose only the caller's own delegation types through `eligibility`; no designator, basis or dormant state. `review_events` payload holds delegateId and docTypes only (no basis).
- Coordinator branch needs `canDesignate` = session manager AND database manager; a stale `manager` session never reaches it (test «status comes from the database», with a mutation that turns it red).
- No basis in logs or errors; `AppError` texts are fixed.
- `roleOf` map keys are database uuid text; `delegate_id` and `granted_by` come from the same database; consistent case.
- Indicators are computed only in the read path and do not feed `authority()`, the guards or any write; effect is unchanged both ways (tests assert it).

### Assessment
No withheld fact leaves the service for any caller class I could construct; the only residual reading channels are the order of visible rows (M1) and inference by absence that the Chairman's wording implies. The one real defect is the weakened test (j).

**Security verdict for Task 7d:** Approved

**Task quality:** Needs fixes (I1 only; M1–M6 optional and small)

For Task 15 (route): pass the result of `list` through untouched; never build a response from the database rows; answer a 404 exactly as other denial classes; do not re-add `basis` from any other source. For Task 16 (screen): show the two labels only when `canDesignate` is true (that is the only case the values are non-null); never show basis text unless non-null, and branch on «own row» by id, not on null; others' rows are only name and types; the list may be empty for a reader with no live designations.

## Re-review of fix round 1 (c3e6195)

Scope: the fix diff `review-7d-fix1-6f146fe..c3e6195` (src, tests, mutation log) and the six items. No test run, no database. Line numbers are from the diff hunks (the implementer's file is not re-read in full).

### Verdicts
- **F-1 (I1) — ADDRESSED.** tests/review-delegations.test.ts (test (j), hunk at ~l.193): the body of `grant` is cut from `async grant(` to `async revoke(`; asserts `start>0`, `end>start`, the `INSERT INTO review_delegations` is inside the body, and `/\b(from|join)\s+(?:"?[a-z_]+"?\s*\.\s*)?"?review_delegations\b/i` does not match (case, whitespace/newlines, schema qualification covered). The `ON CONFLICT` assertion and behavioural part are kept. `list` SQL is now written `delegate_id = $2::uuid` (natural). Mutation log: m1a and m1b both red. Vacuity: not possible in practice — the body must contain the INSERT, and a reordered file fails the `end>start` assertion loudly. Remaining brittleness (Minor, N1): the regex only recognises `from`/`join` directly before the table, so `FROM other, review_delegations`, `FROM ONLY review_delegations`, and a read hidden in a helper method defined outside `grant` (e.g. `this.exists(...)`) are not caught. The old check had the same blind spots; it is no worse.
- **F-2 (M5) — ADDRESSED.** `visibleDelegation(r, viewer, state)` (src, new exported function, ~l.55): coordinator -> whole row plus both indicators; own row (case-insensitive) -> complete, indicators null; other revoked or dormant -> `null`; else three fields. `list` calls it for every row via `flatMap`. The unit table covers coordinator × {live, revoked, dormant} and reader × {own live, own revoked, own dormant, other live, other revoked, other dormant}, with `toEqual` on the redacted shape. (The dormant/designator state is still computed inline in `list` and passed in — acceptable, one decision point for visibility.) `isCoordinator` is a named alias of `canDesignate` with a comment.
- **F-3 (M2) — ADDRESSED.** Non-coordinator SQL: `WHERE project_id=$1 AND (delegate_id = $2::uuid OR revoked_at IS NULL) ... LIMIT 1000`, ordered own rows first, so hidden revoked rows cannot take a place. Test inserts 205 live others and 1005 hidden revoked rows, asserts length 200, own revoked row at index 0 with both basis texts; mutation m3 (SQL filter removed) red. The 200 cap is applied after the visibility function for every viewer (`reviewers.slice(0,200)` after `flatMap`). Coordinator SQL unchanged.
- **F-4 (M3) — ADDRESSED.** Own-row test in the function lower-cases both sides; in SQL it is a `uuid` comparison (case-insensitive by type). The fixture now has hex letters, `expect(upper).not.toBe(lower)`; m4 turns F-4 red (the implementer's disclosure that the first all-digit fixture was blind is the right catch). Own rows are decided on the database-returned `delegate_id` versus the authenticated principal id, not on a string the caller can vary.
- **F-5 (M1) — ADDRESSED.** Other people's rows: `ORDER BY (delegate_id <> $2::uuid), (CASE WHEN delegate_id = $2::uuid THEN created_at END) DESC, delegate_id, id`. For non-own rows the third key is NULL (equal), so the order is delegate id then row id; `id` is `gen_random_uuid()` (v4) so it carries no time. Own rows keep newest first and come first (a position the viewer already knows). Coordinator order unchanged. Teeth: the test people are created reviewer, approver, business2 (…046), technical2 (…047), pm2 (…041); pm2 is created last but sorts before 046/047, so creation order differs from sorted order and the assertion cannot pass vacuously; the coordinator half asserts newest-first.
- **F-6 (M6) — ADDRESSED.** The «indicators are for coordinators only» case now asserts `reviewers.length>0` and that a row of another person is present, per caller.

### New breakage
None Critical or Important.

SQL versus function agreement, state by state (non-coordinator): own any state: SQL passes, function returns complete. Other live not dormant: SQL passes, function returns three fields. Other live dormant: SQL passes, function nulls it out (the SQL filter does not know dormancy; this is a place consumed in LIMIT 1000 only, no leak). Other revoked: SQL hides, function would also null. There is no state the SQL hides that the function would show, and none the function returns more completely than S86 allows: the function never reads anything beyond the row and the state; for a non-own, non-coordinator row it builds the redacted literal explicitly. Coordinator: SQL passes everything; function complete. If the principal id is in a spelling the uuid cast accepts but lower-casing does not normalise (braces, no hyphens), SQL treats the row as own while the function does not: fail closed (nulled or dropped), not a leak.

- **N2 (Minor) — own-row detection is implemented twice** (SQL `delegate_id = $2::uuid`, used three times in the filter/ORDER BY, and the function's lower-cased string compare). They agree for canonical uuids; a single `(delegate_id = $2::uuid) AS mine` column passed into the function would remove the second implementation. On m4: the implementer saw F-5 also red and did not investigate. The most plausible reading is that the m4 mutation touched the shared own-row operand and therefore the ORDER BY keys, which is the same duplication coupling; I could not confirm from the log (it names no edit). Not a security finding; it argues for N2's one-column fix and for the log naming the edit.
- Other inference checks: redacted rows have every key present with `null` (no omitted-vs-null difference between rows of one kind); position of own rows (first) is known to the viewer; ordering uses only delegate id and a random row id; no new field leaves the service. The dormant rows' basis text is still read into memory (M4, out of this round).

### Out-of-scope observations
- LIMIT 1000 is applied before the dormancy filter, so more than 1000 live dormant rows could crowd out visible ones; not reachable (at most one live designation per person).
- M4, Q1 and Q2 unchanged by controller decision; Q3 (column-level exposure through `runtime_select`) stands.

### Round verdict
All items addressed, no new Critical/Important breakage (two new Minor: N1 brittleness of (j) beyond direct reads; N2 duplicated own-row detection).

**Security verdict for Task 7d:** Approved

**Task quality:** Approved

## Review of the Codex fix round 3 (head ccbe70c)

VERDICT: READY

Scope: commit `ccbe70c` over `b8f5a99`, read against the brief `codex-fix3-brief.md` (ruling X1), the builder's report and the saved evidence `codex-fix3-*.txt`. Read-only; no suite, container or server was run by this review.

### a. Does the statement implement the finding completely

Yes (#fact, `src/server/review-delegations.ts:112-115`). For a reader who is not a coordinator, another person's row is fetched only when `revoked_at IS NULL` and its `delegate_id` is in the set returned by `public.bom_eligible_members` for the project with `project_role = ANY($3)`, and this filter sits in the `WHERE` before `ORDER BY ... LIMIT 1001`. Every way of being dormant is covered because the function itself decides them (`migrations/006_bom_allocations.sql:102-110`): no membership in the project (no row), role `viewer` or `bot` (row present, role not in `$3`), inactive account (`u.active`), missing password hash (`u.password_hash IS NOT NULL`), other tenant. Own rows are fetched in every state by `delegate_id = $2::uuid`, independent of eligibility, and sort first. With more than 1 000 rows in effect the cap still applies, but now only over rows the reader may receive, so `fetchedCut` and the 200 cut count only receivable rows. No hidden row can take a place under the cap.

### b. SQL correctness on PostgreSQL 16 and safety

- Parameter typing (#fact): `$1` is used as `project_id=$1` and as `$1::uuid`, both uuid; `$2::uuid`; `$3::text[]` receives a JS array from `[...READ_ROLES]`, sent by `pg` as an array literal. The function returns `project_role text`, so `= ANY(text[])` is well typed.
- One call (#inference, not observed by EXPLAIN): the function is `plpgsql`, `SECURITY DEFINER`, no volatility clause, therefore `VOLATILE`. Its arguments are uncorrelated: `$1` and an `ARRAY(...)` sub-select that is an InitPlan, computed once. Because the `IN` sits under an `OR`, it cannot become a semi-join and stays a SubPlan; for about 1 000 estimated rows it is normally hashed (built once). Even a non-hashed SubPlan only rescans the FunctionScan without changed parameters, and PostgreSQL then rewinds the stored result instead of calling the function again. So the body runs once per statement. The builder's green runs on both engines are consistent with this; I did not confirm the plan.
- Zero candidates (#fact): `ARRAY(SELECT ...)` over no rows yields `'{}'`; `u.id = ANY('{}')` is false, the function returns no rows, `IN (empty)` is false; own rows still come back. Fail-closed.
- NULL (#fact): `delegate_id` is `NOT NULL` (`migrations/020_document_review.sql:17`); `user_id` is a primary key; a `NULL` role would make `= ANY` unknown and drop the row. Fail-closed.
- Function scope (#fact): `scoped()` sets `app.tenant_id` and `app.project_ids` with `set_config(...,true)` (`src/server/db.ts:53`) and `run()` narrows `projectIds` to `[projectId]` (`src/server/review-delegations.ts:68`); the function checks both settings, so it answers only for this tenant and this project.
- RLS on the inner read `review_delegations d` (#fact): it runs as `libetech_runtime` (`SET LOCAL ROLE`, `src/server/db.ts:52`) outside the definer function, so `runtime_select` (`migrations/020_document_review.sql:147-149`, ENABLE + FORCE at `:134-135`) limits it to the tenant and project in scope. The candidate set cannot include delegates of another tenant or project. The partial unique index `uq_review_delegations_active` (`:109`) serves this read.

### c. Does the fix open anything

No. A reader now receives a subset of what the earlier query fetched, in the same order rule (own rows newest first, then others by delegate id). The fix closes a small leak: before it, `fetchedCut` could become `true` because of more than 1 000 hidden dormant rows, which told a reader that such rows existed; now the flag counts only receivable rows. The response time still grows with the number of not-revoked rows in the project (the candidate array), as the earlier query's 1 001-row fetch already did; nothing new is measurable. The function raises no error of its own, and no new error path exists. A non-reader cannot reach the statement: `bot`, missing scope and session role are rejected at `:99-101`, and the database role is re-read at `:104-105` before the query. Injection (#fact): the role list is bound as `$3`; the only interpolated text is the constant `COLUMNS`; no role name is typed in the SQL.

### d. Is «dormant» still one definition

Yes. Both the SQL filter and the JS check (`:119-123`) use `public.bom_eligible_members` for the same project and the same `READ_ROLES` set. They can disagree only through time: the transaction is READ COMMITTED (plain `BEGIN`, `src/server/db.ts:44`), the main statement and the `roleOf` statement take different snapshots, and a `VOLATILE` plpgsql function takes its own snapshot per inner query. Case 1: a delegate loses the reading role between the two statements; the SQL fetched the row, the JS marks it dormant and `visibleDelegation` drops it (`:57`); the reader receives one row fewer. Case 2: a delegate gains the role in between; the SQL did not fetch the row; the reader misses it until the next read. Both outcomes are fail-closed and reveal nothing. The coordinator path is unchanged and still labels from the JS computation.

### e. Tests

- G-1 to G-6 (`tests/review-delegations.test.ts:602-676`) pin the behaviour: reader behind 1 100 dormant rows (absence), flag `false`; 205 in effect behind 1 100 dormant, 200 rows and flag `true`; viewer-role and inactive delegates hidden from a reader and labelled `dormant: true` for the coordinator; one delegate per reading role reaches a reader; own revoked and own live rows first, newest first; 1 100 active viewer-role delegates do not hide the live row.
- Mutations (#fact, `codex-fix3-mutation.txt`): m1 turns G-1, G-2, G-5 red; m3 turns G-4 red; m2 stayed green until G-6 was added (the JS line hid viewers) and is red with G-6. Each is a real catch: G-1/G-2/G-5 depend on the pre-limit filter, G-4 enumerates all four roles, G-6 puts 1 100 eligible-but-viewer rows ahead of the live one.
- No existing assertion is weakened: the diff on the test file has 67 added lines and 0 removed.
- Fixtures are synthetic: generated ids in the `00000000-`, `0000abcd-`, `1500abcd-` ranges, placeholder Vietnamese labels, `fixture-only` hashes.
- Ordering in G-1 and G-6 is certain, not lucky: the live delegate is the fixed demo id `14000000-0000-4000-8000-000000000003` (`src/server/identities.ts:8,12`), which sorts after both dormant ranges byte-wise; G-1 asserts it explicitly. G-5 avoids a clock tie by inserting the old row one day earlier.

### f. Docstring at `src/server/review-delegations.ts:95-97`

These lines were not changed by this diff. Their last sentence («the SQL below applies the same ... condition before the limit») was untrue before the fix and is true now. The phrase «decided in one place, `visibleDelegation`» is now slightly loose, since the SQL is a first line with the same rule (see P3-1).

### g. Outside the allowed scope

None. The commit touches `src/server/review-delegations.ts` (the `list` method only), `tests/review-delegations.test.ts` (additions only) and the four evidence files the brief names. The coordinator query, `visibleDelegation`, migrations and `bom_eligible_members` are untouched.

### Findings

- P3-1 `src/server/review-delegations.ts:96` — the docstring still says who receives what is «decided in one place»; with the pre-limit filter there are two lines applying the same rule. A reader of the code may change one without the other. Suggest naming both lines and saying they must stay in step.
- P3-2 `tests/review-delegations.test.ts:602-676` — no case covers dormant by missing password hash. The function covers it and the code is right; a regression in the function would not be caught here.
- P3-3 `docs/reviews/slice-3-evidence-20261115/codex-fix3-mutation.txt` — m1 and m3 were run before the G-5 fixture change and were not repeated on the final test file; the final m2 run is on the final file. The note says so; the evidence is weaker for m1 and m3, not wrong.

No P0, P1 or P2.

### Outside this diff

None found in the lines read.

### Not checked

- The query plan on PostgreSQL 16 (no EXPLAIN was run); the single call of `bom_eligible_members` is an inference from the plan rules above.
- The test runs themselves; I relied on the saved evidence (PGlite 118 passed and 2 skipped, native 120 passed, typecheck exit 0) and did not re-run them.
- The UI and HTTP layers beyond the files in the diff.
