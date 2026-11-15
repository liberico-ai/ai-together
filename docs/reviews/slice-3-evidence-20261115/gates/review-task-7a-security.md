# Security review — Task 7a (`DelegationService`), slice 3

- Reviewer role: security reviewer (task-scoped gate, findings only; no fix made).
- Diff: base `bd8f814`, head `828158a` (one commit), read from `.superpowers/sdd/slice-3-review-skills/review-bd8f814..828158a.diff`.
- Line numbers: `src/server/review-delegations.ts` and `tests/review-delegations.test.ts` at `828158a`.
- No test was run. Findings come from reading the code, the committed migration and the test file. Each named-risk check outside the diff is listed under «Checked and found safe».

### Spec compliance

| Requirement (brief / binding rules) | State | Evidence |
|---|---|---|
| Bot refused, out of scope project gives the same 404 as an unknown project | ✅ | `review-delegations.ts:96,99` (grant), `:82,84` (list), `:65-67` (locate); tests `:304-312`, `:338-340` |
| Session role not `manager` → `MANAGER_REQUIRED` 403 | ✅ | `:100` (grant), `:132` (revoke, delegate included); tests `:308`, `:337-339`, `:275` |
| Caller's role re-read from the database inside the writing transaction | ✅ | `:103`, `:135` (through `bom_eligible_members`, the same reader the guards use); `canDesignate` `:89` |
| No self-designation, identifiers lower-cased at parse | ✅ | `:104` compares against `p.id.toLowerCase()`; `uuid` lower-cases (`document-review.ts:30`); DB CHECK `review_delegations_no_self_grant` is the backstop (`020:26`); tests `:294-300`, `:380-391` |
| Delegate must be an active member with a reading role, one answer for outsider / viewer / disabled / unknown | ✅ | `:105-106`; test `:323-335` compares the four messages |
| Document types 1..8, no repeats, from the enum | ✅ | `:37` (`DOC_APPROVAL_TYPES` = DB CHECK list `020:24-25`); test `:315-321` |
| `.strict()` schemas, forged fields refused | ✅ | `:34-40`; tests `:344-351`, `:495-497` |
| One `scoped()` transaction per command with `app.person_id` | ✅ | `:52-57` |
| Idempotency claim with UNIQUE + `ON CONFLICT` | ✅ | `:107`, `:136` → `document-commands.ts:13-14` |
| Live-designation uniqueness by the partial unique index, not SELECT-then-INSERT | ✅ | `:110-112`; index `uq_review_delegations_active` (`020:109`); test `:393-401`; native concurrency test |
| Immutable `review_events` row in the same transaction, payload without basis | ✅ | `:75-78`, `:119`, `:148`; tests `:283-284`, `:463` |
| A refusal leaves nothing behind | ✅ | every refusal test snapshots delegations, events, commands, decisions, comments before and after (`snap`, `:257`) |
| Revoke: expected version, basis, one code for stale version and already revoked | ✅ | `:140-147`; test `:491-507` |
| Revoke stamps (`revoked_at`, `version`, `updated_at`) set by the trigger, not by the caller | ✅ | `:140` writes only fixed `now()` and parameters for `revoked_by` / `revoke_basis`; trigger overwrites `revoked_at`, sets `version`, `updated_at` (`020:248-250`); column grant `020:412` |
| `LTR02` mapped only on the INSERT, `LTR03` only on the UPDATE, everything else passes through | ✅ | `:113-117`, `:142-146`; test `:236-248` |
| No path to approval; untouched `accounts.ts`, `account-approval.ts`, migrations, `bot-plugin/` | ✅ | no reference in the source (test `:392-398`); `git diff --stat bd8f814 828158a` on those paths is empty |
| No names, titles or basis text in errors or logs; nothing logged | ✅ | messages are fixed strings (`:18-21`, `:118`, `:147`); no logger import |
| S62: a manager who is also the delegate may revoke | ✅ | test `:485-489` |
| «Effective at once» for the next `comment` / `decide` | ✅ | `document-review.ts:134-143` reads the live row each command; test `:357-391` |
| In-flight `comment` at revoke time still written (S71) | ⚠️ plan-mandated; not testable without a race harness | — |

### Strengths

- Defence in depth on every authority point: session check → database re-read in the transaction → guard trigger (`LTR02`/`LTR03`) → table CHECK (`no_self_grant`, `revoke_complete`) → RLS `WITH CHECK` binding `granted_by` / `revoked_by` to `app.person_id`.
- The guards and RLS make the database the real boundary: even a service bug cannot set `granted_by` / `revoked_by` to someone else, back-date a revoke, un-revoke, or edit `doc_types` (`020:234-250`, `020:150-163`).
- The SQLSTATE mapping is narrow, and a test sends the wrong code to each statement and a mapped code to an unrelated statement (`tests:236-248`).
- The stale-role tests fake only the service's read; the trigger in the database runs for real, so the guard mapping is proven end to end.
- The commenter-never-approves property holds by construction at three layers (see Checked and found safe, item 3), and the end-to-end test also checks that re-designating gives back commenting but not approval.

### Findings

#### Critical
None.

#### Important
None.

#### Minor

**M1 — Nothing tests the service-level database re-read in `grant` / `revoke` on its own** (`review-delegations.ts:103`, `:135`; tests `:205-210`, `:225-234`).
Scenario: someone deletes the re-read on line 103 or 135. The test «stale session role (grant)» still passes because the trigger raises `LTR02` → 404 and the rollback leaves the snapshot equal. «(revoke)» also passes because `LTR03` → 404. Only `list.canDesignate` (`tests:350-353`) would fail. Why it matters: today the trigger still covers it, so nothing is exposed. But the review brief names this read as a binding rule, and no test fails if it is removed. Without it, a caller the database has demoted gets a 422 or 409 instead of the 404.
Smallest fix: two tests that differ only when the re-read exists. (a) The database has demoted the caller to `engineer`, and the caller sends `delegateId` = themself. Expect 404, not `DELEGATION_INVALID`. (b) The database has demoted the caller, and the caller sends a stale `expectedVersion`. Expect 404, not `DELEGATION_CONFLICT`: the UPDATE matches 0 rows, so the trigger never fires.

**M2 — A designation stays live while the delegate has no reading role, and comes back by itself when the role returns** (schema consequence of Task 4b, «plan-mandated»; consumed at `document-review.ts:139-141`).
Scenario: a commenter is lowered to `viewer`, or removed from the project, or their account is disabled. The row keeps `revoked_at IS NULL`. `authority()` ignores it while the role is not a reading role, so no wrong outcome today. If the person is later re-added with a reading role, the old designation and its old document types apply again without any manager acting. Meanwhile `list` shows the row as live, and `grant` refuses a new designation for them only because of the eligibility check. Why it matters: an earlier designation silently comes back into force. See Q2.
Smallest fix, if the Chairman wants the second option: add an `active` / `dormant` indicator in `list`, computed from `bom_eligible_members`. Ending the designation on role loss would need a migration and is out of this task.

**M3 — The basis accepts Unicode format characters (bidi overrides, zero-width)** (`review-delegations.ts:29-32`).
Scenario: a manager writes a basis containing U+202E or U+200B. The text is stored, then shown to every reader of the project (see Q3), where it can display misleadingly. There is no injection risk as long as the UI renders it as text. Why it matters: this is display spoofing in a governance record.
Smallest fix: also refuse `\p{Cf}`, or have Task 16 render the basis inside `<bdi>` / `dir="auto"`.

**M4 — `list` returns every column to every reader** (`:86`, plan-mandated by S11 and the brief's `DelegationView`).
Scenario: an `engineer`, `technical` or `business` member reads the delegation list. They see each commenter's `basis`, `revokeBasis`, `grantedBy` and `revokedBy`, and the list of approval-grant holders. The text of a revoke basis may describe a person's work. See Q3. No fix proposed without a decision.

**M5 — `list` is capped at 200 rows, with no `total` or cursor** (`:86`).
Revoked history beyond 200 rows is dropped without notice (E-BE-05 asks for `total` or a cursor). This is not exploitable. Live rows sort first, so no live designation is hidden until there are 200 live rows.

**M6 — Replaying a successful `grant` after the delegate's eligibility changed answers `DELEGATION_INVALID` instead of the stored response** (`:104-107`: checks run before `claimDocumentCommand`).
The idempotency semantics are slightly off, but this is not a security issue. Order the claim first only if the HTTP task needs strict replay.

### Questions that are not the session's to decide

- **Q1 — Does a designation outlive its designator's manager role?** Today a designation survives after the manager who made it is lowered, leaves the project, or is disabled. It lasts until another `manager` revokes it. Options: (a) it survives, as now; (b) it ends automatically when the designator loses `manager` of that project; (c) it survives but `list` / the UI flag it as «người chỉ định không còn là điều phối».
- **Q2 — What happens to a designation when the delegate loses the reading role, leaves the project, or is disabled, and later comes back?** Options: (a) it lies dormant and revives with its old document types, as now; (b) it counts as ended, and a new designation is needed after return; (c) it stays dormant, but managers see it flagged as dormant.
- **Q3 — Who may see the list of commenters, their document types, the designation basis and the revoke basis?** Options: (a) every reader of the project (`manager`, `engineer`, `technical`, `business`), as now; (b) managers see everything, other readers see who comments on what without the basis text; (c) as (b), plus the delegate sees the basis of their own rows.
- **Q4 — A person with two accounts.** The service cannot tell that a second account belongs to the same person, so a manager could designate their own other account. Is «one person, one account» an identity rule that `accounts.ts` / the account admin must enforce? This is outside this task.

### Checked and found safe

1. **Guards, policies and grants of `review_delegations`** (`migrations/020_document_review.sql:13-30,134-163,216-258,399-412`).
   - ENABLE + FORCE RLS.
   - The INSERT policy binds `granted_by` to `app.person_id` and forbids revoke columns.
   - The UPDATE policy targets only live rows and requires `revoked_by = app.person_id`.
   - Column grants: INSERT on six columns only, UPDATE on the three revoke columns only.
   - The BEFORE UPDATE trigger refuses un-revoke, a second revoke and any change to identity, scope, type or basis columns. It stamps time, version and `updated_at`.
   - There is a no-delete trigger.
   - The superuser bypass applies only to `rolsuper`, and `scoped()` runs as `libetech_runtime`.
   - Effect: the placeholder `revoked_at=now()` cannot be influenced by the caller, because it is a fixed SQL fragment and the trigger overwrites it. `version` cannot be influenced either, because the trigger sets it to `OLD.version + 1`.
2. **What «manager of the project» means at the database** (`migrations/006_bom_allocations.sql:87-110`). `bom_eligible_members` returns rows only for a project in `app.project_ids` and the tenant in `app.tenant_id`, and only for active users with a password set. The role is `coalesce(project_role, global role)`, the same rule `identity.ts:39` uses to build the session principal. So the service read and the guards agree. A manager of A cannot be read as a manager of B, because the membership row is per project.
3. **A commenter can never approve** (`document-review.ts:134-143,267-273`; `020:64-65,264-280`).
   - An approval needs `approveTypes` from `public.document_approvers`. That function reads access grants, which this service never writes.
   - `review_delegation` authority is chosen only when `result === 'changes_requested'`.
   - The table CHECK `review_decisions_approval_needs_grant` forbids `approved` with `review_delegation`.
   - The decision guard re-checks a live delegation of the decider and that the decider is a reading member.
   - The approved pointer moves only in the approver's own decision transaction.
   - No input or state of `DelegationService` reaches any of these.
4. **Exported helpers** (`document-review.ts`): only the `export` keyword was added to `READ_ROLES`, `storable`, `text`, `uuid` and `reader`, with no behaviour change. `READ_ROLES` is a mutable `Set`, but nothing mutates it.
5. **Session scope** (`identity.ts:44-51`): the principal's `projectIds` and `grants` are rebuilt from the database for each authenticated request. A stale session role is therefore limited to the window inside one request. That window is covered by the service re-read and the triggers.
6. **Concurrency.** Two grants go through the partial unique index and `ON CONFLICT DO NOTHING`: the loser waits, then gets no row, then `DELEGATION_EXISTS`. Two revokes go through the row lock: the WHERE clause is re-evaluated after the wait, 0 rows match, the answer is `DELEGATION_CONFLICT`, and one event is written. Both cases are covered by the native test.
7. **Leakage.**
   - One 404 text for missing, out of scope, viewer, bot and malformed id.
   - On revoke, the body is validated only after `locate`, so an outsider cannot learn anything from validation errors.
   - `DELEGATION_INVALID` is one sentence for unknown, outsider, viewer and disabled, and each costs a single equal-cost function call.
   - `DELEGATION_EXISTS` is reached only after eligibility, and tells a manager nothing they cannot already see in `list`.
   - `MANAGER_REQUIRED` is given only to readers of that project.
   - `list` filters by the project, and RLS adds a second filter.
   - `document_approvers` is scoped to the same project.
8. **Input and SQL.** All SQL is fixed fragments with positional parameters (`COLUMNS` is a constant). The basis checks match the DB CHECK: code points, spaces-only trim, ≤500 untrimmed. U+0000, lone surrogates, C0 and C1 are refused. `expectedVersion` is capped at int4. `requestId` must be a uuid.
9. **Identifier case.** `app.person_id`, `granted_by`, `revoked_by` and `actor_id` use the lower-cased session id. `claimDocumentCommand` uses the raw `p.id`, but session ids come from the database, which stores them lower-case, so the two agree.
10. **Secrets and public-repo hygiene.** Fixtures use the synthetic `password_hash 'fixture-only'`, synthetic Vietnamese role names and synthetic UUIDs. Evidence logs replace paths with `<worktree>`. The diff contains no keys, tokens, hosts or personal data.

### Test teeth (no mutation log for this task)

- **Most doubted, «stale session role (grant)» and «(revoke)»** (`tests:205-210,225-234`). They pass with or without the service re-read (M1).
- **«a failed grant leaves no delegation, no event and no command row»** (`tests:362-378`). It asserts only `code`, not `status` or message. It overlaps other tests, so this is acceptable.
- **The source-grep tests** (`tests:393-397`, `:392-398`). Their regular expressions check the absence of patterns. A rename (for example SQL built through a helper) would slip past them. The behavioural tests carry the real weight.
- **The remaining negative cases bite.** Self-designation would fail on the raw `23514`. Removing the session-role check for revoke would turn 403 into 404. Over-broad SQLSTATE mapping is caught by `failOn`. Approval by a commenter is caught by the end-to-end test.

### Assessment

The task meets its security invariants:
- Only a `manager` of that very project designates or revokes.
- Nobody designates themself, and every row carries document types.
- A designation can never yield an approval.
- A revoke is one-way, carries a basis and the revoker's identity, and is time-stamped by the database.
- A failed command leaves nothing behind.

None of the findings is exploitable. M1 is a gap in test teeth. M2 and M4 follow from the plan and Task 4b's schema, and Q1–Q3 need a decision above the session.

**Security verdict for Task 7a:** Approved, with minor notes M1–M6 and questions Q1–Q4.

### Notes for Task 15 (HTTP) and Task 16 (UI)
- HTTP must take `requestId`, the idempotency key, `delegationId` (from the path) and the principal from the server or request context, never from JSON.
- Map `ZodError` to 422 without echoing the input, because the basis may contain personal text.
- Never log the body.
- Map `SCOPE_DENIED` 404, `MANAGER_REQUIRED` 403, `DELEGATION_INVALID` 422, `DELEGATION_EXISTS` 409, `DELEGATION_CONFLICT` 409 and `IDEMPOTENCY_*` exactly. A raw `LTR*` or `P0001` must surface as a generic 500 with no message text.
- The UI must render `basis` and `revokeBasis` as text, isolated for bidi (M3).
- Names come only from the project directory.
- `canDesignate` is also the right to revoke.
- The UI must not offer «approve» for a designation.
- The UI should show that a commenter's «changes requested» uses the revision's only decision slot (schema notes).
