### Spec Compliance
- Task 1: ✅ Spec compliant. The fixture exports match the brief (tests/slice2-fixtures.ts:10-23 ids, keys and config, :26-32 `signedRequest`, :35-45 `messageEvent`). `chatNotIntake` is in `chatScopes` but not in `intake.chats` (:21-22), and `chatMulti` maps to `[ids.sales, sameBuProject]`. The `<=15` bound is gone (tests/rls-catalog.test.ts:12). The native reset case exists (tests/slice1-harness.test.ts, `native reset` block) and now covers all five 016 tables, so it is no longer vacuous.
- Task 2: ✅ Spec compliant. Roles, tables, indexes, per-role policies, triggers and grants match the brief (migrations/016_intake_inbox.sql:5-218). The rollback matches the brief (migrations/rollback/016_intake_inbox.sql:5-17). Every `- [ ]` case has a test (tests/intake-schema.test.ts:47-186). The rollback-loop cases are covered by the per-file loop in tests/migrations-rollback.test.ts:9,13-21,44 (focused check). One plan-mandated defect: table-level INSERT grants (Important #2).
- Task 3: ✅ Spec compliant. `verifySigned` checks in the briefed order (src/server/bridge-auth.ts:9-17). Config rules: src/server/bridge-config.ts:6-18. In `handleBridgeIo`: 404 before any body read, then 503 for missing intake config, then per-route caps, then 501 stubs (src/server/bridge-io.ts:14-24). Catch-all route: src/app/api/bridge/[...path]/route.ts:7-19. All six cases are present (tests/bridge-io.test.ts:21-69). tests/identity.test.ts is not in the diff, so it is unchanged.
- Task 4: ❌ Issues found. `redactSecrets` fails its own brief text: "thay giá trị sau token|secret|password… (kèm : hoặc = …)". It leaves `DB_PASSWORD=hunter2`, `GITHUB_TOKEN=…` and `"password":"…"` unredacted (src/server/intake-rules.ts:16-17; Important #1). Every listed case plus S10 has a test (tests/intake.test.ts:25-237, tests/intake-concurrency.test.ts:15-40). The parallel-edits case does not force overlap (Minor).
- Extra: none unrequested. Each addition traces to a ruling: tests/intake-scoped.test.ts (actor_id ruling), tests/fix-wave-db.test.ts:44 (Task 2 controller fix), `LATEST_REVISION_ORDER` (src/server/intake.ts:27, Review Focus 3), and the composite revision FK (016:44-45,58).
- ⚠️ Cannot verify from diff:
  - Native-only results. I did not run them: concurrency, the role case and the harness reset.
  - The production path (`libetech_intake_svc` login → `SET LOCAL ROLE libetech_intake`). No password exists yet (S1); every test drives `IntakeService` through `h.operator`.
  - The proxy `^~ /api/bridge/` block. This is a runtime check.
  - The assertion body of tests/rls-catalog.test.ts below the hunk. Those lines are unchanged context, so I cannot see how split SELECT/INSERT policies satisfy "USING plus WITH CHECK". The implementer reports it green.
  - The exact Bot API download limit (20 MiB vs 20 MB).

### Named-risk checks
1. RLS: ✅
   - ENABLE+FORCE on all five tables (016:108-117).
   - Policies are per role: SELECT has USING, INSERT has WITH CHECK, and runtime UPDATE has both (016:121-199).
   - Fail-closed with no context: `nullif(...)::uuid` gives NULL, and an empty `string_to_array` gives an empty array. Tested for both roles (tests/intake-schema.test.ts:47-57).
   - No grant to `libetech_web` (016:212-218).
   - The `actor_id` binding ruling is implemented (016:185-189,195-199; src/server/bridge-io.ts:31) and tested fail-closed (tests/intake-schema.test.ts:164-175).
2. Idempotency: ✅ Each write uses `ON CONFLICT DO NOTHING`, with a re-read only after the conflict (source event src/server/intake.ts:70-77, revision :83, candidate :104). There is no SELECT-then-INSERT. The attachment insert has no ON CONFLICT, but it runs only for a revision created in the same transaction and is backed by `UNIQUE(revision_id)` (016:59).
3. Revision numbering: ✅ The code takes `pg_advisory_xact_lock(hashtextextended(id,0))` (src/server/intake.ts:78) and then runs `INSERT…SELECT coalesce(max,0)+1` as a new READ COMMITTED statement, so it sees the prior holder's commit (:80-84). `UNIQUE(source_event_id,revision_no)` backs it (016:44). The proof test is weak (Minor #2).
4. Identity from JSON: ✅ All schemas are `.strict()` (src/server/intake.ts:16-24). The project comes only from `chatScopes` (:45-48), the tenant from `identity.tenantId` (route.ts:18), and the actor from config (:99). The 5 injection keys → ZodError → 422 `INVALID_INPUT` (src/server/http.ts:11), tested in tests/intake.test.ts:117-123.
5. Text/chat id in logs and errors: ✅ The AppError messages carry no ids (src/server/intake.ts:32,47,53,76). `failure()` logs only `errorType` and maps ZodError/SyntaxError to a generic 422, so V8's JSON.parse snippet never leaves the process (src/server/http.ts:11,13; focused check). The intake code adds no logging. The S10 console spy test is at tests/intake.test.ts:164-176.
6. pointer_only: ✅ for message text. `text_excerpt` is null (src/server/intake.ts:79). The audit payload carries only `{revisionNo,contentMode}` (:101) and the receipt params only `candidateRef` (:114). Caveat: `file_name` and `source_actor_label` are still stored in pointer_only mode (:71,93); see Minor #6.
7. Rollback 016: ✅
   - It refuses while `outbox_messages` exists (rollback/016:6-8).
   - It drops tables without CASCADE (:10), and REVOKE sits inside guards (:11-16).
   - There is no DROP ROLE.
   - Gap: no rollback of 013-015 refuses while 016 is applied (Minor #7).
8. verifySigned and `/api/bridge`: ✅
   - The order and codes match the brief (src/server/bridge-auth.ts:9-17).
   - The key and path are bound into the HMAC, so a cross-key or cross-path signature fails (tests/bridge-io.test.ts:32-40).
   - `/api/bridge` keeps BRIDGE_UNCONFIGURED/413/401/409/429 (src/server/bridge.ts:20; src/app/api/bridge/route.ts:9-11).
   - Behaviour change: a signed request that fails validation now burns its nonce and counts toward the throttle (bridge.ts:20-21; Minor #8).
9. `project_channels`: ✅ The only reads in src are pre-existing registry code (src/server/projects-registry.ts:57,93); found by grep. The intake role is denied any read of it (tests/intake-schema.test.ts:59-72).
10. Caps and MIME (proposals): technically sound, with three caveats.
    - 16 384 B body: a 4 096-unit text message is at most 12 288 B. Telegram limits media captions to 1 024 characters, so a message with an attachment stays well under the cap. Escape-heavy text (`\u00XX`, 6 B per unit) can exceed it; the briefed gateway truncation (`textTruncated`) covers that case. Caveat: the schema allows `fileName` up to 1 000 characters while only 200 are kept (src/server/intake.ts:16-17 vs src/server/intake-rules.ts:20), which wastes up to ~3 KB of the budget.
    - 1 024 B for pull and 4 096 B for receipts: sound.
    - 20 MiB: the Bot API documents "up to 20MB" for getFile. Whether that means 20 000 000 or 20 971 520 bytes is not stated in the docs (#inference). The difference is harmless: a file the bot cannot fetch arrives as `failed`.
    - MIME list: the list matches the plan (intake-rules.ts:23-28), but it checks the client-declared type, so it is advisory only. That is acceptable because AI OS stores no bytes. Static stickers are `image/webp` and would pass, so the gateway must drop stickers by message type, not by MIME. MIME types with parameters (`text/plain; charset=…`) are rejected as unsupported.

### Strengths
- Authority is checked before any SQL. `SCOPE_DENIED` and `INTAKE_PROJECT_AMBIGUOUS` store nothing, as `allZero` proves (src/server/intake.ts:43-47; tests/intake.test.ts:37-41,145-148).
- Idempotency is correct under RLS. A conflict whose row RLS hides becomes `SOURCE_EVENT_CONFLICT` instead of a crash (src/server/intake.ts:74-77; tests/intake.test.ts:211-217).
- The machine principal is gated in the schema, not only in code: decided candidates, `verified` hashes and `user` actor rows are refused by policy (016:168,154,188), and each gate has a negative test.
- The tests run against a real database, not mocks. Removing ON CONFLICT, the transaction, pointer_only, cleanFileName or the AMBIGUOUS check would turn a named test red. The S10 test scans every intake table as `x::text` (tests/intake.test.ts:170-174).
- The shared verifier removes the duplicated HMAC code and binds the route path into the signature (src/server/bridge-auth.ts:5,13).
- The out-of-order rollback ordering is enforced and the fix-wave test now derives its file list from the directory (tests/fix-wave-db.test.ts:44).

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
1. **src/server/intake-rules.ts:16-17: `redactSecrets` misses the most common secret formats.**
   - The leading `\b` never matches after `_`. The separator also does not allow a closing quote.
   - Probe (node, same regex): these pass through unchanged:
     - `OPENAI_API_KEY=sk-live-XYZ`, `GITHUB_TOKEN=ghp_XYZ`, `DB_PASSWORD=hunter2`
     - `access_token=XYZ`, `client_secret: XYZ`
     - `{"password":"hunter2"}`, `"api_key": "XYZ"`
   - Only space- or colon-separated bare words such as `token: x` are caught.
   - Why it matters: in `excerpt` mode the text is stored at rest and readable by runtime roles. Pasted env lines and JSON configs are exactly what a Tech support group posts. The only test is `token: abc123SECRET` (tests/intake.test.ts:188-196), so the gap is invisible.
   - Fix: replace `\b` with `(?<![a-z0-9])` and make the separator `(["']?(?:\s*[:=]\s*)|\s+)`. The probe of this version redacts all seven forms above and leaves `secretary meeting` and `tokens are fine` intact.
   - Add those forms to the test.
   - Plan-level suggestion for Chairman: Vietnamese keys (`mật khẩu`, `mk`, `pass`) and URL userinfo (`<redacted-url>`) are also unredacted.
2. **migrations/016_intake_inbox.sql:213,218: table-level INSERT grants regress the repo's column-level INSERT control. Plan-mandated (brief: "`SELECT, INSERT` năm bảng mới"; "`INSERT` trên `intake_events`").**
   - Precedent: migrations 013 (:102-106) and 014 (:135-140) grant INSERT by column so that `id`, timestamps, `ingested_at`, `quality_score`, `hash_verification` and `version` come from defaults. tests/fix-wave-db.test.ts:70-83 ("item 2 column-level INSERT grants") enforces this.
   - As written, `libetech_intake` can set:
     - `ingested_at` (the "persisted" timestamp of the five-state model)
     - `created_at`/`id` on the append-only tables
     - `version`/`note`/`missing_fields` on a new candidate; its INSERT policy (016:165-168) does not gate these
   - `libetech_runtime` can backdate `created_at` on `intake_events` audit rows.
   - Fix: grant INSERT by column, using exactly the columns that src/server/intake.ts:68,81,91,103,98 insert. The code sets none of the protected columns, so this is drop-in. Add the five tables to the fix-wave item-2 case list or to intake-schema.test.ts.

#### Minor (Nice to Have)
1. **src/server/intake.ts:97-99: each audit row gets its own `randomUUID()` request_id.** The `source_event.persisted` and `candidate.created` rows of one ingest therefore cannot be grouped by `request_id`, which E-DB-13 exists for. Fix: hoist one `requestId` per `ingest` call; Task 6's outbox rows will need the same id.
2. **tests/intake-concurrency.test.ts:31-40: no barrier forces the two edits to overlap.** The test can pass with the advisory lock removed whenever the two transactions happen to serialize. Fix:
   - Hold `LOCK TABLE source_event_revisions IN SHARE ROW EXCLUSIVE MODE` in an operator transaction.
   - Call `waitForBlocked(h,2)` (one waiter blocks on the table lock, the other on the advisory lock), then release, as the first case does at :18-22.
3. **tests/intake.test.ts:44-47: the `project_channels` setup hedges with a fallback insert and `.catch(()=>undefined)`.** The schema has `state` with `'active'` (migrations/013_project_registry.sql:20), so the fallback is dead code, and if it ever ran it would swallow an UPDATE failure. Fix: one INSERT with `state='active'` and an assertion on the state.
4. **src/server/intake.ts:65,71: no test asserts several computed values.** These are the message locator `https://t.me/c/<id>/<msg>`, `source_id = telegram:<chat>:<msg>` (the ticket-ledger join key), `source_actor = 'tg:'+id` and `correlation_id`. All four are briefed. Mutating any of them stays green.
5. **tests/intake-schema.test.ts:114: no write-isolation tests for runtime on candidates.** The runtime UPDATE on candidates is only shown to succeed. No test shows that a cross-project or cross-tenant UPDATE affects 0 rows (Quality Gate 34c). No test passes a body of exactly 16 384 bytes (tests/bridge-io.test.ts:67-68 covers only the over side).
6. **src/server/intake.ts:71,93: pointer_only still stores `file_name` and `source_actor_label`.** File names and sender names can carry IBS HI content and personal names. Separately, an unsalted SHA-256 of a short message can be reversed by dictionary. AGENTS.md allows "pointers, hashes and Tech work metadata", so this is for the OQ-28 decision, not a code defect.
7. **migrations/016_intake_inbox.sql:215: rollback ordering gap.** 016 depends on 013's `project_domain_mappings` (its GRANT), but no rollback of 013-015 refuses while `source_events` exists. Rolling back 013 under 016 silently drops the grant. The implementer hit exactly this (Task 2 Concern 1) and fixed the test, not the guard. Separately, rollback/016:11-16 does not revoke `USAGE ON SCHEMA public`, which later blocks `DROP ROLE libetech_intake` in that database.
8. **src/server/bridge.ts:20-21: `handleBridge` now consumes the nonce and throttle before schema validation.** A replay of an invalid body now returns `BRIDGE_REPLAY` instead of 422. This follows from the briefed `verifySigned` and is arguably safer. Record it in the slice receipt as a behaviour change.
9. **src/server/bridge-io.ts:6 and src/server/intake.ts:5 import each other** (`IntakeService` ↔ `intakeScoped`). This works because the bindings are only used at call time, but `intakeScoped` belongs beside `scoped()` in src/server/db.ts. Plan-placed.
10. **Forward trap: `scoped()` does not set `app.person_id`** (src/server/db.ts:33-40). With the ruling's `runtime_insert` (016:199), every Task 5/7 human `intake_events` insert is denied until the service sets it, as src/server/reports.ts:29 does.
11. **src/server/intake.ts:112: a message whose attachment first arrives `failed` and later `stored` never gets a success receipt.** The second delivery becomes revision 2, and revision 2 returns `none`. Leave for Task 6 to decide.
12. Polish:
    - src/server/intake.ts has five lines over 250 characters (:67-71 among them), which hurts review.
    - tests/slice2-fixtures.ts:1-2 imports `node:crypto` twice.
    - `attachmentVerdict` lowercases the MIME type but the raw value is stored (src/server/intake-rules.ts:30 vs src/server/intake.ts:93).

### Assessment
**Task quality:** Needs fixes
**Reasoning:** Schema isolation, idempotency, revision locking, signed routing and fail-closed scope are correct and backed by real-database tests. Two defects block approval: the secret redactor misses the env-var and JSON forms its own brief covers, and 016 reintroduces the table-level INSERT grants that the earlier fix wave (item 2) removed for migrations 013-014. Both are small, drop-in fixes.
