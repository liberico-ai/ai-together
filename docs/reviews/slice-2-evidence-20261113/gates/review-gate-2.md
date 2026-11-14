# Review gate 2: Tasks 5 and 6 (migration 017 and OutboxService), 82788e2..eeb0e59

### Spec Compliance
- ✅ Task 5, tables: every column, CHECK, UNIQUE and composite FK in the brief is present (`migrations/017_outbox.sql:7-51`). The target-format CHECK from ruling 3 is at `:36`.
- ✅ Task 5, indexes: the due index, the scope index, `created_at` and every FK on both tables (`017_outbox.sql:53-64`).
- ✅ Task 5, RLS: ENABLE and FORCE on both tables (`:66-69`). Policies are per role, with the initial-state gates the brief asks for (`:73-112`). Receipt policies, including the EXISTS second layer from ruling 2, are at `:114-131`.
- ✅ Task 5, grants: ruling 1 column-level INSERT and the brief's UPDATE lists match exactly (`:204-214`). The `schema_migrations` row is the last statement (`:215`).
- ✅ Ruling 2: the receipt trigger is not SECURITY DEFINER. It raises when the outbox row is invisible or the project differs (`:135-144`).
- ✅ Ruling 3: the group target is bound to its visible source event (chat, topic, reply) and the DM target to `identity.telegram_links`. `project_channels` is not read (`:147-166`).
- ✅ Ruling 4: the guard trigger allows the same moves as `outboxTransition`. The runtime may only requeue dead with `attempt_no=0` or abandon dead|uncertain, and touches nothing else while the state stays (`:171-197`).
- ✅ Task 5 rollback: refuses while `identity.account_approvals.kind` exists; drops triggers, then functions, then tables; no CASCADE; no DROP ROLE (`migrations/rollback/017_outbox.sql:5-17`).
- ✅ Task 5 tests: all eight brief cases are present, plus the ruling 1–4 cases (`tests/outbox-schema.test.ts:55-320`).
- ✅ Task 6 interface: `outboxTransition`, constants, `backoffSeconds`, `Envelope`, `Delivery`, `enqueueReceipt`, `enqueueDm`, `OutboxService.pull/report` (`src/server/outbox.ts:10-199`). `report` adds `rejected` per ruling 6 (`:149-197`).
- ✅ Ruling 5 templates: no receipt unless new and addressed; `params={ref,observedAt}`; ack stays `withheld`/`ATTACHMENT_NOT_STORED` (`src/server/intake.ts:111-120`).
- ✅ Ruling 6: one SAVEPOINT per receipt; only LEASE_INVALID and RECEIPT_CONFLICT are caught and collected (`outbox.ts:157-195`).
- ✅ Task 6 routes: wired in `src/server/bridge-io.ts:22-28`. The pull scope is the union of the intake chats' scopes; an empty scope fails closed.
- ✅ Task 6 tests: every listed case is present in `tests/outbox.test.ts` and `tests/outbox-crash.test.ts`, plus a batch-isolation case (`tests/outbox.test.ts:171`).
- ⚠️ Cannot verify from the diff: the native run output (339/339) and the RED for Task 6, which was shown only by removing the module.

### Strengths
- E-INT-06 holds. `enqueueReceipt` runs on the ingest `tx` (`intake.ts:115`), and the diff has no enqueue after commit. The crash test forces a throw after the outbox write and expects 0 events and 0 outbox rows (`outbox-crash.test.ts:21`). A commit-then-enqueue implementation would fail it, because `source_events` would equal 1.
- Lease handling is correct.
  - Expiry and the batch claim both use `FOR UPDATE SKIP LOCKED` (`outbox.ts:107,113`).
  - Every write goes through `applyOutboxSignal`, guarded by `state` and `version` (`:50-59`).
  - Uncertain rows are only returned as `reconcile` and are never re-leased (`:122`).
  - The parallel-pull test would fail against a pull without locking: it would raise OUTBOX_CONFLICT or return a duplicate (`outbox-crash.test.ts:45`).
- Receipt handling is correct.
  - `ON CONFLICT DO NOTHING` plus an outcome comparison separates replayed from RECEIPT_CONFLICT (`outbox.ts:161-168`).
  - A send receipt must match the state, lease token and attempt; a reconcile receipt must find the row `uncertain` on the same attempt (`:171-173`).
  - Every throw comes before the audit write, and the savepoint rolls back the inserted receipt.
- Trigger lookups fail closed when a row is invisible: `found IS NOT TRUE` (`017:139`), `IF NOT FOUND` (`:154`), `tg IS NULL` (`:161`). Tests cover this (`outbox-schema.test.ts:227-228`, `:254`).
- `delivered_at` is set only from a receipt (`outbox.ts:177`). It is not insertable, and PM-07 checks it is still NULL after a pull. No intake path can set `acknowledged_at` (it is not in the grant, `017:212`).
- Backoff and cap: 30·2^(n−1) capped at 900, and dead on attempt 6. The test checks the wait after each attempt (`outbox.test.ts:126`). `failed_permanent` goes to dead at once.
- The envelope has exactly 10 fields and no message text; a test asserts the key set and absence of the text (`outbox.test.ts:48-51`).

### Issues
#### Critical
- None.

#### Important
- `src/server/outbox.ts:95` writes no audit event for DM rows: `if(!row.project_id) return`. **(plan-mandated)**
  - What: no audit event is written for a DM lease (`:113-120`), a lease expiry (`:107-111`), a RECIPIENT_UNLINKED kill (`:135-140`) or a receipt-driven move (`:176-187`). The kill has neither an audit row nor a receipt.
  - Why: AGENTS.md says "Every write uses a transaction, expected version and immutable audit event", and the global constraints require «sự kiện audit bất biến cùng transaction». The brief limits `intake_events` to «dòng dự án», because `intake_events.project_id` is NOT NULL.
  - Scope: latent today. `enqueueDm` has no production caller yet, only tests.
  - Fix: a controller ruling before Task 9 wires DM producers. Either add an append-only, nullable-project outbox history (the same exception as the two 017 tables) written in the same `intakeScoped` transaction, or rule that receipts plus `last_error_code` are the record for DM rows.

#### Minor
- The trigger functions resolve `source_events` and `outbox_messages` without a schema (`017_outbox.sql:138,152`).
  - What: `pg_temp` is searched first. No migration revokes TEMPORARY from PUBLIC.
  - Verified on throwaway PGlite: as `libetech_intake`, a temporary `source_events` table made the bind trigger accept target `-1000000000999`. The control without the temp table was rejected.
  - Impact: the receipt trigger is still backed by its policy, which resolves table OIDs at creation time. For the target binding, intake can already insert a `source_events` row with any well-formed chat in its scope (`016_intake_inbox.sql:125-127`), so this adds stealth, not reach.
  - Fix: qualify names as `public.` or add `SET search_path = pg_catalog, public, pg_temp` on the three functions, and add a regression test with a temporary shadow table.
- `reconciled_not_sent` has no cap and no backoff (`outbox.ts:27,185`). **(plan gap)**
  - What: a loop of uncertain followed by not_sent re-leases at once with `attempt_no+1`, so attempts beyond `MAX_ATTEMPTS` are reachable. This conflicts with the constraint "lỗi mạng thử lại có backoff và trần lượt".
  - Fix: at `attemptNo>=MAX_ATTEMPTS`, go to dead, or apply backoff.
- `017_outbox.sql:19` uses `length(payload::text)`, which counts characters, not bytes. **(plan-mandated wording)**
  - What: the constraint is ≤ 2 048 bytes, and the plugin reads at most 65 536 bytes. Ten non-ASCII payloads can exceed that.
  - Fix: use `octet_length`. Current params are ASCII only.
- The `IntakeService` constructor still defaults `enqueueReceipt` to a no-op (`intake.ts:38-39`).
  - What: the brief says «gọi enqueueReceipt thật». Only `bridge-io.ts:22` injects the real one, so a future call site that forgets the argument silently queues nothing.
  - Fix: default to the real function. Move `intakeScoped` out of `bridge-io.ts` if the import cycle gets in the way.
- The guard trigger checks state moves only (`017:171-197`).
  - What: while the state stays, intake can set `delivered_at` on a pending row, or rewrite `delivered_at`, `attempt_no` or `telegram_message_id` on a delivered row (grant at `:212`). Identity can set `acknowledged_at` on a DM row that was never delivered (`:214`).
  - Fix: allow `delivered_at` to change only on a move to delivered; freeze terminal rows except `acknowledged_at`; require `state='delivered'` for `acknowledged_at`.
- The envelope hard-codes `version:'v1'` and `source` (`outbox.ts:88`), while intake may insert `event_version` and `source` (`017:209`), so the two can diverge.
  - Fix: emit the column values, or drop those two columns from the intake grant.
- `errorCode` is free text up to 64 characters (`outbox.ts:83`) and is stored in `last_error_code` and in receipts.
  - Fix: restrict it to `^[A-Z0-9_]{1,64}$` so gateway text cannot land in the DB.
- `applyOutboxSignal` accepts raw SQL fragments through `rawSet` (`outbox.ts:55`) and is exported for Task 7.
  - Today's callers pass only constants and DB integers, so it is safe. It is a footgun for new callers.
  - Fix: take typed interval seconds and bind them as parameters.
- For an event that is both spooled and has a failed file, `intake.attachment_failed` wins (`intake.ts:116`).
  - This is correct under "no success receipt for a failed file", but it differs from the order ruling 5 lists, and no test covers it.
  - Fix: confirm the precedence and add the case.
- Test gaps:
  - a reconcile receipt against a still-leased row, or with the wrong attempt;
  - the `intake_events` count after rejected receipts;
  - a DM whose recipient relinked to a different telegram id.

### Checks run (read-only; no suites re-run)
- `src/server/db.ts:36` and `migrations/003_runtime_roles.sql:5,11`: `scoped` runs `SET LOCAL ROLE libetech_runtime`, and `libetech_web` is NOINHERIT. So the guard's `current_user='libetech_runtime'` check cannot be bypassed by an inherited membership.
- `migrations/016_intake_inbox.sql:21-22`: `topic_id` and `message_id` are NOT NULL, so the trigger's `<>` comparisons have no NULL hole.
- `migrations/002_identity.sql:46-49` and `src/server/identity.ts:202`: `telegram_links` has UNIQUE(tenant_id,user_id), and unlinking is a DELETE. So the pull check and the DM trigger are sound.
- `tests/migrations-rollback.test.ts:9` and `tests/rls-catalog.test.ts:12` discover files with `readdir`, so both cover 017.
- No TEMPORARY revoke anywhere in the migrations. The probe ran on an in-memory PGlite (repo untouched): `<scratchpad>`. Output: `current_user: libetech_intake`, `SHADOW ATTEMPT: ACCEPTED`, `CONTROL (no temp table): REJECTED Outbox target: chat, topic or message differ from the source event`.

### Assessment
**Task quality:** Needs fixes
**Reasoning:** The group-row outbox is correct and its tests catch the plausible wrong implementations: same-transaction write, `SKIP LOCKED` lease, receipt idempotency, savepoint isolation, DB state guard and RLS. The one Important item is plan-mandated: DM state changes have no audit event. It needs a controller ruling or a small audit path before Task 9 wires DM producers. Everything else is Minor.
