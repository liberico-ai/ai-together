### Spec Compliance
- ✅ **Spec compliant.** Every interface in the three briefs exists with the stated shape. Every listed test case has a test: T7 has 10 brief cases plus 3 extra, T8 has 6 plus 1 window case, and T9 covers account-approval-dm ×5, access-change ×11, the rollback-018 case and the outbox-crash DM branch. Every listed file has a hunk. All controller rulings T7/T8/T9 are met:
  - failures overdue rule and project-only list: `src/server/inbox.ts:207-214`
  - FOR UPDATE before the version compare: `inbox.ts:224-226`
  - `app.person_id` is set: `inbox.ts:96`
  - requeue and abandon go only through `applyOutboxSignal`
  - a mismatch is reported only as a conflict: `ledger-reconcile.ts:26`
  - the acknowledgement is keyed by `ballotDmKey(approvalId,p.id)`: `account-approval.ts:185-186`
  - `tally` is unchanged
  - 018 is expand-only
- Deviations (Minor; neither is a functional gap):
  - **T7 placement.** The brief puts the read and action side in `src/server/intake.ts`. It was built as a new `src/server/inbox.ts`; `intake.ts` only exports `refOf`. This stays inside the `src/server` structure and is more cohesive. Consequence: `task-13-brief.md:3` lists `intake.ts` for `coverage.include` but not `inbox.ts`, so Task 13 must add `src/server/inbox.ts` or the InboxService escapes the coverage gate.
  - **T9 process.** The builder made commits 79a9e54 and 8164e54 itself (task-9-report header), against ruling S12 ("Builder không commit"). The content is what this gate reviews; the controller should record the exception.
- ⚠️ Cannot verify from the diff:
  - **onboarding-feedback 9/9 before and after.** The file has no hunk, so only the reported run supports it.
  - **Native evidence.** The native harness and the real runner both skip already-recorded versions (`tests/slice1-db.ts:35`, `scripts/migrate.ts:14`). The in-place 017 guard edit therefore reaches the shared native DB only when `migrations-rollback` or the outbox-schema 017-rollback test re-applies it. The receipt must record that `migrations-rollback` ran first (progress.md:132). 017 is unreleased, so there is no deploy impact.
  - **`libetech_identity` writing the four new 018 columns.** This relies on 009's table-level INSERT (018 header comment) and is proven only by the native run.
  - **Interim rendering.** Until T11 (`task-11-brief.md:26`) and T12 (`task-12-brief.md:3,30`) land, `src/components/approvals.tsx:30` renders an access-change ballot as a registration ("Người đăng ký đề nghị:" with an empty value and no current grants). This must land before merge, so a voter never approves a widening they cannot see.

### Strengths
- **Uniform denial.** One sentence `SCOPE_DENIED` 404 (`inbox.ts:27`), and the id's project is located under RLS (`inbox.ts:101-106`), so "missing" and "out of scope" are indistinguishable. Test (3) asserts 6 operations × {viewer, bot, other-project member, other tenant}, plus a missing id and a non-member project, all collapse to a single message. Strict zod rejects `actorId` and `tenantId`.
- **Write path.** Each command runs in one scoped transaction: `deduplicate` with a fingerprint that includes `expectedVersion`, then row lock, then version check, then `candidateTransition` (pure, closed table, no work actions), then `UPDATE … WHERE version`, then `intake_events` with `actor_kind='user'`. The tests cover replay, `IDEMPOTENCY_CONFLICT`, a stale version leaving no event, and an invalid move changing nothing. Requeue asserts that the DB-written state event carries `actor=user/pm`.
- **T8.** It is truly pure and read-only. The snapshot test hashes `id||version` and `ticket_ref`, ledger `status` never appears in the output, and no reader, adapter or route exists (OQ-26 respected).
- **T9 ballot integrity is layered:**
  - the subject's seat is dropped at selection (`account-approval.ts:30-37`)
  - `frozenVoters` re-asserts it (`:43-52`)
  - a vote by the subject is refused (test)
  - `approvalReady` now takes `kind`, and its only two callers pass the right one (`accounts.ts:143` `'registration'`, `:214` `'access_change'`; grep of `src`)
  - `activate` filters `kind='registration'` (`identity.ts:108-111`)
  - frozen grants are compared order-insensitively, role included (`accounts.ts:212`)
- **Lock order is sound.** `command` locks the user, then the ballot. A vote locks the ballot and only reads the user. `access` re-checks the frozen version under the user lock.
- **Ballot DMs are written in the ballot's transaction** (`accounts.ts:134,277`). That is proven by a fault-injection unit test and a native crash test. The payload is `{}`, the pulled delivery contains no ballot id, and delivery and acknowledgement are shown as separate states (test "the DM has a delivery receipt of its own").
- **The 017 relaxation is narrow.** Only `libetech_identity` holds `UPDATE(acknowledged_at,updated_at)` (`017_outbox.sql:373`). Its UPDATE policy is DM-only (`:141-143`). The guard allows set-once from NULL and refuses any change or clear (tests on pending, leased and delivered).
- **018 is safe:**
  - guarded constraint creation, so re-running it is idempotent
  - FK and index in the same file
  - partial unique index for one open ballot per subject
  - the rollback refuses later versions and existing `access_change` rows, and uses `row_security=off` so that a filtered role fails loudly
  - no CASCADE and no role drop
  - the test proves catalog equality after a double re-forward, and that an old row reads `kind='registration'`
  - focused check: 009's `account_approval_active_registration (tenant_id,registration_id)` is NULLS DISTINCT, so `access_change` rows with a NULL `registration_id` never collide

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
1. **T7 · `inbox.ts:131` (named security risk).** `detail` returns `contentHash` for every revision even when `content_mode='pointer_only'`.
   - The hash is an unsalted sha256 of the full text (the gateway contract in `intake.ts:24`; fixture `slice2-fixtures.ts`). Short messages are dictionary-reversible, and progress.md:64 already defers this to OQ-28.
   - No brief asks for the hash in the API: duplicate hints are computed in SQL (`inbox.ts:60-64`). The API therefore widens exposure from DB operators to every reader role of an IBS HI project, while the policy question is still open.
   - The incremental risk is low: AGENTS.md permits hashes for IBS HI, and the readers are scoped project members who usually see the chat anyway.
   - Fix: return `contentHash:null` (or omit it) when the project is pointer_only, and keep revision identity via `revisionNo`.
2. **T7 · `inbox.ts:152,184` with `service.ts:66-68`.** `deduplicate` stores the whole `CandidateCard` in `commands.response`.
   - That copies the message `excerpt` (excerpt-mode projects), `sourceRef` (which carries a chat id) and attachment `fileName` into a second table that has no content retention or redaction path.
   - A replay also returns a stale card (accepted by ruling, but avoidable).
   - Fix: make the deduplicated action return `{candidateId,state,version}`, then call `loadCard` after `deduplicate` inside the same transaction.
3. **T7 · `inbox.ts:130`.** `detail.revisions` is ordered by `revision_no DESC`, while the card's "newest" uses `LATEST_REVISION_ORDER` (edited_at first).
   - In the out-of-order edit case (test "the newest revision is chosen by edited_at"), `revisions[0]` is not the revision the card shows.
   - Fix: order by the same expression, or mark the current revision, so Task 12 cannot show a different "latest".
4. **T7 · `inbox.ts:166` (builder concern, confirmed).** The `mark_duplicate` target is read without a lock.
   - Two concurrent commands, A→dup B and B→dup A, both pass the "target not duplicate" check. The result is a cycle in which both candidates are hidden as duplicates.
   - Fix: lock both rows `FOR UPDATE` in id order before the checks.
5. **T7 · `inbox.ts:183` (and failureCommand).** `intake_events.request_id` is a fresh `randomUUID()` per call, not the HTTP request's id, so audit rows cannot be joined to request logs (E-OBS-01, E-DB-13). Task 10 should pass `requestId` into the service.
6. **T7 / T9 · `inbox.ts:207-214`.** `failures()` lists group rows only, per the ruling. Now that T9 emits ballot DMs, a dead or uncertain DM to a voter (for example, a voter who blocked the bot) has no operator surface. Raise this as an open question for the Chairman or Task 12; no code change is due under this brief.
7. **T8 · `ledger-reconcile.ts`:**
   - `inboxRows` has no LIMIT (`:37-46`). There is no route yet, but cap it before Task 10 exposes it.
   - Duplicate inbox keys are dropped silently (`:18`).
   - A candidate whose `ticketRef` is set but whose message has no ledger ticket is reported as plain `onlyInInbox`, losing the fact that it is linked to a ticket the ledger does not hold. A `ticket_ref_without_ledger` conflict (or carrying `ticketRef` in `onlyInInbox`) would make the difference visible.
   - The "one candidate per root event" assumption (`:44`) holds by construction: 016 has `UNIQUE(tenant_id,project_id,chat_id,thread_key)`, and the root decides the thread key. It is not DB-enforced on `root_source_event_id`, and `LIMIT 1` with an ORDER keeps the read deterministic.
8. **T9 · `accounts.ts:209-212`.** Applying a ballot relies only on `account_version` to prove the grants are unchanged since the proposal. As defense in depth, also require `sameGrants(before, ballot.previous_grants)`, so that any future membership write that forgets to bump `account_version` cannot let a stale ballot apply.
9. **T9 · `account-approval.ts:185-186`.** An acknowledgement before delivery leaves the DM `pending`, so the gateway still sends "a ballot waits" to someone who has already voted. The acknowledgement also neither bumps `version` nor writes an outbox state event; this is deliberate (it does not race the in-flight receipt), and the vote event is its only audit. Document the choice, and optionally have `pull` skip DM rows that are already acknowledged.
10. **T9 tests:**
    - `outbox-schema.test.ts:120-122` runs identity's acknowledgement UPDATE with no WHERE, so it would pass even if RLS let identity touch a group row. The relaxed guard no longer ties the acknowledgement to state, so RLS is now the only barrier. Add a negative case: identity's acknowledgement UPDATE on a group row affects 0 rows.
    - No test opens pending access-change ballots for two different subjects at once (correct by NULLS DISTINCT, but untested).
    - The access-change RED was mostly ZodError (report §7.1); accepted, noted.
11. **T7 tests · `inbox-service.test.ts:108-109`.** `WorkService.create(bot,…)` and `.command(bot,…)` only assert `.rejects.toThrow()`, which a validation error would also satisfy. Assert the authorization code.
12. **T7 · `inbox.ts:60-64`.** The `lat` CTE recomputes the newest revision for every candidate of the project on each `list`, `loadCard` and `command`. That is O(N) per action; acceptable now, worth an index-friendly rewrite before real volume.

### Assessment
**Task quality:** Approved

**Reasoning:** All three briefs and every controller ruling are implemented and tested against the real behaviour:
- authorization collapses to one denial
- every write is versioned, deduplicated, audited and in one transaction
- ballot DMs are transactional
- the subject is excluded at three layers
- 018 and its rollback are safe

The findings are hardening and contract-hygiene items. The one with a policy edge, the pointer_only hash in `detail`, is a one-line fix and should land before Task 12 consumes `detail`.
