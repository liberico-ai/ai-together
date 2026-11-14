# Gate 2 re-review, round 1 (fix eeb0e59..4ae6e8b)

## Finding Verdicts
1. ADDRESSED - migrations/017_outbox.sql (outbox_state_events table, RLS intake/runtime/identity, derive trigger, immutable trigger); src/server/outbox.ts applyOutboxSignal (INSERT after UPDATE, same tx). intake_events outbox.* kept for project rows (outbox.ts audit()).
2. PARTIALLY, counted ADDRESSED as ruled, see Important 1 - outbox_state_events_validate (017) checks to_state, attempt_no, allowed move, runtime signal limits. Replay/duplicate of the same move still passes.
3. ADDRESSED - SET search_path = pg_catalog, public, pg_temp on all 5 trigger functions, schema-qualified tables; TEMP-shadow test in tests/outbox-schema.test.ts.
4. ADDRESSED - outbox_messages_guard_state (017). Move to delivered may set delivered_at/telegram_message_id (state-change branch, check only when NEW.state<>'delivered'); terminal freeze is in the unchanged-state branch only, so report(delivered) is not blocked. acknowledged_at once, delivered only.
5. ADDRESSED - payload CHECK octet_length(payload::text)<=2048.
6. ADDRESSED - CHECKs on event_version/source; envelopeOf emits row values (outbox.ts).
7. ADDRESSED - receiptSchema errorCode regex, DB CHECKs on last_error_code and error_code. (422 mapping of ZodError is not in this diff; test "FB-4" covers whole-request failure.)
8. ADDRESSED - OutboxSetColumn union, OutboxMove typed, all values bound; only column names (closed union) and fixed fragments interpolated.
9. ADDRESSED - report(): attempt_no>=MAX_ATTEMPTS -> reconciled_not_sent -> dead with MAX_ATTEMPTS_EXHAUSTED; below cap pending+backoff; TS table, guard and validator all allow uncertain->dead; runtime role cannot.
10. ADDRESSED - intake.ts default realEnqueueReceipt; intake-scope.ts new; bridge-io re-exports. No import cycle (outbox imports intake-scope, not bridge-io).
11. ADDRESSED - intake.ts:117 uses attachment_failed when notStored; test FB-7.
12. ADDRESSED - tests FB-1 (relinked DM), FB-1 rejected receipts leave intake_events count unchanged, bad reconcile receipts.

Named-risk checks: three state tables agree (TS outboxTransition, guard, validator: pending>leased; leased>delivered/pending/dead/uncertain; uncertain>delivered/pending/dead/abandoned; dead>pending/abandoned; runtime only dead>pending(attempt 0), dead|uncertain>abandoned). Trigger order on outbox_state_events by name: derive_project < validate (immutable is UPDATE/DELETE only); correct and order-independent anyway. Every applyOutboxSignal path (expired, lease, DM unlinked, all report outcomes) writes the event right after the UPDATE inside the savepoint/tx.

## New Issues in the Fix Diff
Critical: none.

Important
1. 017 outbox_state_events_validate: the validator does not bind an event to one actual move. It checks only to_state == live state and attempt_no == live attempt_no, and that from->to is an allowed move. So (a) two identical events for one move in one transaction both pass; (b) after the row is already abandoned/pending, a runtime person can insert unlimited extra `abandon` (dead->abandoned) or `requeue` (dead->pending) events, attributed to themselves, because to_state still equals the live state; (c) from_state is never compared to the prior real state, and signal is not checked against from/to for intake (e.g. signal=delivered with pending->leased). The audit table stays append-only but not forgery-proof, which was the point of finding 2. Fix: add outbox_version integer NOT NULL, require NEW.outbox_version = live version (applyOutboxSignal already knows row.version+1), UNIQUE(outbox_id,outbox_version); and check signal against the (from,to) pair for every role. Alternatively require the outbox row xmin to equal the current transaction.

Minor
2. 017 reject_history_mutation is not pinned to a search_path (pre-existing function, not changed here), while the five new functions are; note for consistency.
3. 017 guard: a state move does not require delivered_at/telegram_message_id to be set to specific values beyond the delivered_at CHECK; fine, informational.

## Out-of-Scope Observations
- Identity role UPDATE grant lacks version, so acknowledged_at updates by identity do not bump version (pre-existing).
- Tests were not re-run, as instructed.

## Assessment
**Fix round:** Needs another round (one Important: state-event replay/duplicate, finding 2 only partly closed)
