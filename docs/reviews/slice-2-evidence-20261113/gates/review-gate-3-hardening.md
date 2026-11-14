### Finding Verdicts
- **M1 contentHash null for pointer_only** — ADDRESSED. inbox.ts detail map returns `contentHash:root.content_mode==='excerpt'?r.content_hash:null`; type is `string|null`. Test "M1" asserts null hash/excerpt for pointer_only and a 64-hex hash for excerpt.
- **M2 deduplicate stores ids only, re-read with loadCard** — ADDRESSED. command callback returns `{candidateId,state:next,version:row.version+1}`; `loadCard` runs after `deduplicate` in the same scoped tx, so replay returns the current card. failureCommand stores `{outboxId,state,version}`. Test "M2" reads commands.response and asserts no excerpt/fileName/sourceRef, exact `{candidateId,state,version}`, replay shows later ticketRef/version, and failure response keys are exactly outboxId/state/version.
- **M3 revisions order = card order** — ADDRESSED. detail SELECT now joins source_events e and uses `ORDER BY ${LATEST_REVISION_ORDER}` (aliases r/e match the constant). Test asserts revisions[0] is revision 2 equal to the card excerpt, order [2,3,1].
- **M4 lock both rows FOR UPDATE in id order** — ADDRESSED. For mark_duplicate, `SELECT id ... WHERE id=ANY(...) AND project_id=$2 ORDER BY id FOR UPDATE` runs before the row read/checks (LockRows sits above Sort, so lock order is id order). Native-only test runs A->B and B->A in parallel and requires exactly one winner; report says it ran 3 consecutive native runs but admits there is no deterministic RED (a race), so the test is a regression guard, not proof.
- **M5 requestId from caller** — ADDRESSED. `command` and `failureCommand` take `requestId`, `uuid.parse` it, and use it for intake_events.request_id and the applyOutboxSignal ctx; `randomUUID` import removed. Test "M5" checks intake_events and outbox_state_events carry the passed id and that a non-uuid rejects.
- **M8 access ballot also requires previous_grants match** — ADDRESSED. accounts.ts selects `previous_grants` and adds `sameGrants(grantsSchema.parse(ballot.previous_grants),before)`; sameGrants is order-insensitive (sorted by projectId, permissions sorted), so no false mismatch from ordering. New test adds a membership behind the service with unchanged account_version and expects TELEGRAM_APPROVAL_REQUIRED, with memberships and ballot state unchanged. Report shows RED before the code.
- **M10 identity ack on group row affects 0 rows** — ADDRESSED. outbox-schema.test.ts new test asserts `rows` length 0 and acknowledged_at still null via operator. It is not vacuous: line 121/363 are positive controls where the same UPDATE succeeds on DM rows. Report honestly notes no RED (already held by RLS).
- **M11 bot WorkService assertions carry the code** — ADDRESSED. Both create and command now `rejects.toMatchObject({code:'READ_ONLY',status:403})` (diff shows both `.rejects.toThrow()` replaced).

Test evidence: the report (task-7-report.md "Gate-3 hardening") names the covering tests per item and gives RED and GREEN counts (PGlite 385 passed/18 skipped; native 403 passed, 0 skipped; typecheck clean). I did not re-run them.

### New Breakage in the Fix Diff
None Critical or Important.
- Minor: `uuid.parse(requestId)` in command/failureCommand throws a raw ZodError, not an AppError, and runs before locate/authorization. It only fires on a caller bug (server-generated id), leaks nothing, but a handler that maps only AppError would return 500. inbox.ts command/failureCommand first lines.
- Minor: M2 replay re-reads the card at the caller's current scope; a replayed key after the candidate moved returns the newer card rather than the original result. This is the intended design (the test pins it); worth a line in the API doc.
- Checked and fine: the M4 lock is taken inside the deduplicate callback after the commands insert, in id order, and the later single-row `FOR UPDATE OF c` re-locks a row already held (no new lock order); failureCommand locks only outbox rows, so no cross-path deadlock appears in the diff. The M4 lock filters by project_id, so a cross-project target is not locked, but the existing later target check still rejects it.

### Out-of-Scope Observations
None

### Verdict
**Fix round:** All findings addressed, no new Critical/Important breakage. (M4 has no deterministic RED test; M10 is a pinning test only. Both disclosed by the implementer.)
