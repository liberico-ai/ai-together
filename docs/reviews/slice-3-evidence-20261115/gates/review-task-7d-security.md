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
