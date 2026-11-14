### Finding Verdicts

Range `121d35a..2898def`, read in the worktree and in the diff file. Tags: #fact means I read it in code or ran it; #inference means I reasoned from code I read.

I ran three focused probes:
- Two read-only native probes, each in a rolled-back transaction on the slice-1 test database. Database `slice2_ui` was not touched.
- One `tsx` probe of `redactSecrets` with synthetic strings.

The probe scripts are in the session scratchpad. I did not re-run any whole suite.

**Must fix**

1. **Code I-1 (`/inbox` 500, RSC boundary): ADDRESSED.**
   - The function prop is gone from both route files: `src/app/inbox/loading.tsx:4` and `src/app/inbox/error.tsx:5`.
   - `onCommand` is now optional (`src/components/inbox.tsx:135,147`). A card with no handler is read-only (`:142`).
   - Regression test, chosen approach: a static scan, `tests/rsc-boundary.test.ts:61`. A self-test at `:67` checks the scanner itself. `fix-wave-red-1.log` shows the scan named the exact `loading.tsx` line before the fix.
   - There is also a component test, `tests/inbox-ui.test.tsx:299`.
   - The approach is acceptable under the brief's stated alternative. Limit (as reported): the regex scan cannot see spread props or imported function identifiers.

2. **Code I-2 + UI-1/UI-2/UI-3 (reachable PM actions): ADDRESSED.**
   - Picking a type is local only: `CardDraft.pick` (`src/components/inbox-view.ts:44-51`), set with no API call (`inbox.tsx:119-123`).
   - Each type's commit actions come from `cardActions` (`inbox-view.ts:79-97`):
     - incident: `confirm{incident,note?}`
     - request: `need_info{missingFields}` or `confirm{request}`
     - document: `confirm{document}`, and the `/documents` link stays (`inbox.tsx:115-116`)
   - Missing fields are checked on the screen with the server's limits (`inbox-view.ts:68-74`).
   - A `needs_info` card always shows «Đã hỏi bổ sung» (`inbox.tsx:105-106`), whatever the type. Its re-ask list is prefilled (`inbox-view.ts:46-47`).
   - Server side, the note reaches the `candidate.confirmed` payload only when present (`src/server/inbox.ts:173-174`). The schema trims it and caps it at 1000 (`:46`).
   - Tests:
     - The UI fixtures are limited to states the server produces (`tests/inbox-ui.test.tsx:14-22,89`).
     - The flows are driven through `CardView` (`:96,116,128,154,163,182`).
     - Service-level, the note is read back through `detail()` (`tests/inbox-service.test.ts:169`).
     - Re-ask: `:183`.
   - Implementer concern 1 (`needs_info → needs_info`): **safe and audited.**
     - The move goes through the same command path: lock `FOR UPDATE`, `expectedVersion`, `UPDATE … WHERE version=$2`, `version+1`.
     - It writes an immutable `candidate.needs_info` event that carries `stateBefore/stateAfter=needs_info` and the new list (`inbox.ts:160-196`).
     - `need_info` triggers no outbox row or side effect, and nothing consumes `candidate.needs_info` events (#fact, `git grep`).
     - Remaining issue: the plan table at `docs/plans/slice-2-intake-outbox.md:370` was not updated (see Observations).

3. **Security I1 (`redactSecrets`): ADDRESSED.** Changes, all in `src/server/intake-rules.ts`:
   - `LINK` lets one linking word sit between keyword and value, and the value is masked, not the word (`:46-47`).
   - `PLAIN` covers «mật khẩu» / «mat khau» / `passcode`, and `mk` / `pass` / `otp` (`:56-60`). Word edges are Unicode-aware. `pin` is excluded on purpose.
   - `AUTH_BASIC` and `BARE_BASIC` with an "encoded" test cover Basic credentials (`:63-65`).
   - `PEM` runs first and masks a block that has lost its END line (`:68`, `:96`).

   Tests: a table test (`tests/intake.test.ts:410`), a negatives test (`:439`) and a linear-time test at 12 KB and 48 KB (`:446`).

   Implementer concern 4, from my probe (#fact): over-masking stays in the safe direction:
   - «mật khẩu là gì?» → «… là [đã che]»
   - «the secret is out» → «… is [đã che]»
   - «đã pass: test case 3» → «… [đã che] case 3»

   Under-masking cases beyond the brief's list are under Observations.

4. **Database I-1 (+ M-5), membership invariant: ADDRESSED.** All migrations were edited in place and stay idempotent; the rollbacks stay consistent (native forward → rollback → forward run: `fix-wave-native-rollback.log`).
   - 016:
     - `guard:intake-roles` (`migrations/016_intake_inbox.sql:16-30`) re-checks attributes on pre-existing roles. It also requires that `libetech_intake_svc` reaches none of runtime, identity, projector, outbox_audit, web or auth.
     - `guard:role-separation` (`:34-42`) checks transitive membership through `pg_has_role(...,'MEMBER')` and excludes superusers.
   - 017:
     - `guard:outbox-audit` (`migrations/017_outbox.sql:18-25`): no members, and a member of no role.
     - The same role-separation block (`:27-35`); a test asserts it is byte-equal to 016.
   - Triggers:
     - The validator refuses a state-event insert when `session_user` is a member of the audit role (`:320-325`).
     - `record_state_event` refuses a login that can act as both runtime and intake (`:372-375`).
   - Comment: the comment at the old `:317-321` now states the invariant (`:359-364`).
   - `db.ts`: `assertRestrictedLogin` (`src/server/db.ts:19-28`) runs once per pool and fails closed, because the rejected promise stays cached (`:32-35`).
   - Tests: `tests/outbox-schema.test.ts:726, 749, 763, 778`. The native-only `:811` (the reviewer's RETURNING forgery) and `:835` were RED natively before the fix (`fix-wave-red-db-native.log`).

   **The reviewer's probe, re-run against the new code (#inference, from code; native probe below):**
   - The BEFORE guard still passes `dead→abandoned` as runtime.
   - RETURNING still rewrites `role` and `app.outbox_invoker`.
   - But the AFTER trigger now raises at `:372-375` before it reads either value. Neither value can affect `session_user`.

   **Implementer concern 2, bypass checks:**
   - `SET SESSION AUTHORIZATION` / `set_config('session_authorization',…)`: natively, as the real non-superuser `libetech_web` login (#fact), `SET LOCAL SESSION AUTHORIZATION`, `set_config('session_authorization',…)`, `SET ROLE libetech_intake`, `set_config('role','libetech_intake',true)` and `SET ROLE libetech_outbox_audit` are all refused with "permission denied". So `session_user` cannot be moved by a non-superuser, and a RETURNING rewrite cannot reach it either. (From a superuser-authenticated connection, `set_config('session_authorization',…)` is allowed; that is the test harness, not an attack path.)
   - pg_temp and TEMP privilege: every new reference is schema-qualified (`pg_catalog.pg_roles`, `pg_catalog.pg_has_role`), and `session_user` is a keyword. Both functions pin `search_path = pg_catalog, public, pg_temp`, and pg_temp is never searched for functions or operators.
   - Transitive or role-chained membership is caught by `MEMBER`. So is a PG16 `WITH SET FALSE` grant, which errs toward refusing.
   - Legitimate logins (#fact, native catalog):
     - `libetech_web` reaches runtime only.
     - `libetech_intake_svc` reaches intake only, and not audit.
     - The audit role has 0 `pg_auth_members` edges.
     - The native suite runs runtime moves through `h.db` = `libetech_web` (`tests/slice1-db.ts:28`; `tests/inbox-service.test.ts:22`) and passes (`fix-wave-native.log`, 454 / 0 skipped).
   - Migration login: superuser `iptech` from `initdb -U iptech` (`deploy/install-user.py:123,135-138`), so it is excluded by `NOT rolsuper`. Identity's `acknowledged_at` update does not fire the state trigger (`017:395` `WHEN (OLD.state IS DISTINCT FROM NEW.state)`).

5. **Deferred T2 M5 (QG 34c, AR-06): ADDRESSED.**
   - DB-level test (`tests/intake-schema.test.ts:118`): a runtime UPDATE through `h.db` (`libetech_web` natively) on a candidate in another project, and in another tenant, returns 0 rows. Rows are compared before and after. An UPDATE with no WHERE reaches only the in-scope row.
   - Body cap (`tests/bridge-limits.test.ts:29`): 16384 B accepted, 16385 B refused with 413, and the cap counts bytes, not characters.
   - RED by mutation: `fix-wave-red-5-mutation.log`.

6. **Deferred T11 (plugin `intake_event(chats=None)`): ADDRESSED.**
   - `bot-plugin/__init__.py:305` now reads `chats is None or …`, so a missing allowlist refuses.
   - Test: `tests/test_bot_bridge.py:987`.
   - The first 110 frozen lines are byte-identical (#fact, `diff` of the two blobs).
   - Implementer concern 7 is under Observations.

**Also fix**

- **DB M-1: ADDRESSED.** `SET LOCAL lock_timeout = '5s'` sits right after `BEGIN` in 018 (`migrations/018_access_change_approval.sql:11`) and in `rollback/018` (`:6`). Test: `tests/outbox-schema.test.ts:851`.
- **DB M-3: ADDRESSED.** `failures()` now also lists `leased` rows whose lease has run out, marked overdue, and every row carries `candidateRef` (`src/server/inbox.ts:224-232`). The UI label is in `inbox-view.ts:29`. Test: `tests/inbox-service.test.ts:286`.
- **DB M-4: ADDRESSED.** The sweep is `ORDER BY created_at,id LIMIT $2 FOR UPDATE SKIP LOCKED`, using the pull `limit` (`src/server/outbox.ts:118`). Test: `tests/outbox.test.ts:334`.
- **DB M-8: ADDRESSED.** Named CHECKs `attempt_no>=0` and `version>=1` are added idempotently (`migrations/017_outbox.sql:98-107`). The test bypasses the guard triggers with replica mode, so the CHECK itself refuses (`tests/outbox-schema.test.ts:859`).
- **DB M-9: ADDRESSED.**
  - `DROP INDEX IF EXISTS` for the three redundant indexes (`016:128`, `017:118-119`).
  - The revision FK `(revision_id, …)` (`016:87`) is still served by `UNIQUE(revision_id)` (`:88`). The outbox FKs keep `(outbox_id, tenant_id)`.
  - Test: `tests/outbox-schema.test.ts:870`.
- **Security M1: ADDRESSED.**
  - `requireBridgeConfig` maps a missing, unreadable, malformed or inconsistent config to 503 and logs the code and error class only (`src/server/bridge-config.ts:30-36`).
  - Both routes use it (`src/app/api/bridge/[...path]/route.ts:13`, `src/app/api/bridge/route.ts:9`).
  - The plugin retries on 5xx (`bot-plugin/__init__.py:190`).
  - Test: `tests/bridge-limits.test.ts:62`.
- **Security M2: ADDRESSED.** A declared `content-length` above the cap is refused before `request.text()`, and the size check after the read stays (`src/server/bridge-auth.ts:12-14`). The test asserts `bodyUsed === false` (`tests/bridge-limits.test.ts:43`).
- **Security M4: ADDRESSED.** `\p{Cf}` is stripped on the server (`src/server/intake-rules.ts:106`, test `tests/intake.test.ts:460`) and in the plugin (`bot-plugin/__init__.py:456`). Combining marks are kept.
- **Security M5: ADDRESSED.**
  - A group target outside intake.json `chats` is refused before the journal line and before send (`bot-plugin/__init__.py:880-881`), using the allowlist read in `drain_outbox` (`:1009`).
  - `TARGET_NOT_ALLOWED` passes the server's error-code check `^[A-Z0-9_]{1,64}$` (`017:75`, `src/server/outbox.ts:91`).
  - Test: `tests/test_bot_bridge.py:658`.
- **Security M7: ADDRESSED.** `.gitignore:30` now holds `.superpowers/`.
- **Code m-2: ADDRESSED.** The single predicate is `src/server/access-grants.ts:9`. `src/server/accounts.ts:202,256` and `src/components/team-accounts.tsx:30` use it. A table test also asserts that neither side keeps its own copy (`tests/inbox-ui.test.tsx:349`).
- **Code m-3: ADDRESSED.** `reloadInbox` fetches page, sources and failures together (`inbox-view.ts:116-121`), and `Inbox.load()` sets all three (`inbox.tsx:173-177`). Test: `tests/inbox-ui.test.tsx:308`.
- **Code m-6: ADDRESSED.** There is a comment at the split (`src/server/outbox.ts:140-142`). A test fails the identity/DM transaction and shows the row going `leased → uncertain` and into reconcile (`tests/outbox.test.ts:348`).
- **Code m-7: ADDRESSED.** The test is renamed to the project-scope claim, and its body does assert the empty-scope refusal (`tests/outbox.test.ts:191-196`).
- **Code m-8: ADDRESSED** (the test gap is closed). The DOC-16 test now uses the real `enqueueReceipt` (`tests/intake.test.ts:152-172`). It asserts:
  - one receipt after the original;
  - `receipt:'none'` for the edit and for a reply that does not call the bot;
  - for a reply that calls the bot, a second receipt carrying the same `IN-` reference.

  The brief's literal "the reply queues no second receipt" holds only for a reply that does not call the bot. A second receipt for a new addressed event is required by `docs/plans/slice-2-intake-outbox.md:322`, so not changing the code is correct. Implementer concern 6 is under Observations.
- **Code m-9: ADDRESSED.**
  - Generic empty copy «Không có phiếu cần xác nhận.».
  - The closing sentence depends on the ballot kinds voted (`bot-plugin/__init__.py:1146,1160-1164`).
  - Test: `tests/test_bot_bridge.py:805-808`.
- **UI-4: ADDRESSED.** The server label no longer embeds ISO (`src/server/inbox.ts:216`). The screen formats `coverageStart` with `formatTime` (`inbox-view.ts:110-111`, used at `inbox.tsx:23`). Tests: `tests/inbox-service.test.ts` (sources test, the no-ISO assertion) and `tests/inbox-ui.test.tsx:217`.
- **UI-5: ADDRESSED.**
  - «Loại tin: <Vietnamese label>» plus « · tin IN-…» (`inbox.tsx:34`, labels at `inbox-view.ts:33-35`). The delivery lines in the detail view use the same labels (`inbox.tsx:52`). Test: `tests/inbox-ui.test.tsx:250`.
  - The type buttons sit in a row at ≥700 px (`src/app/globals.css:133,141`).
  - CSS only: I did not check it in a browser.
- **`/approvals` labels: ADDRESSED.** The shared `grant-labels.ts` is used by `approvals.tsx:10`; no raw permission codes remain. The test asserts «Xem điểm nhân sự» and no `people_read` (`tests/inbox-ui.test.tsx:329`).

### New Breakage in the Fix Diff

- **Minor**: `src/server/intake-rules.ts:46-47,56-60`. The new `LINK` and `PLAIN` rules mask the word after a linking word or a short keyword with a colon in ordinary prose. Probe examples:
  - «mật khẩu là gì?» → «mật khẩu là [đã che]»
  - «the secret is out» → «the secret is [đã che]»
  - «đã pass: test case 3» → «đã pass: [đã che] case 3»

  This errs toward hiding text, applies only to excerpt mode (every real project is `pointer_only` today), and is recorded as implementer concern 4. No action is needed beyond listing it in the receipt.

No Critical or Important breakage found:
- The trigger checks do not refuse `libetech_web` or `libetech_intake_svc`.
- The migration login is a superuser.
- The guards are idempotent.
- The `/inbox` route files pass no functions.
- The plugin's `_deliver` has a single caller (`bot-plugin/__init__.py:1010`).

### Out-of-Scope Observations

1. **Redaction gaps beyond the brief's list** (#fact, `tsx` probe, synthetic values). These were not masked:
   - «mật khẩu: …» in NFD (combining-mark) form, for example from Unikey's «Unicode tổ hợp» mode.
   - A qualifier of two or more words («Mật khẩu wifi nhà mình: …»).
   - No separator at all («tài khoản admin mật khẩu …»).
   - `pw:`
   - «OTP 482913»
   - The body of a `-----BEGIN PGP PRIVATE KEY BLOCK-----` block. Only the word «BLOCK-----» is masked, by the older SPACED rule.

   A `text.normalize('NFC')` before matching would close the NFD case cheaply. All of these are latent until a mapping puts a project in excerpt mode.
2. **Plan drift.** `docs/plans/slice-2-intake-outbox.md:370` still lists `needs_info→new|confirmed|duplicate|dismissed`, while the code adds `needs_info→needs_info` (`src/server/intake-rules.ts:126`). The brief barred edits to `docs/plans`, so the coordinator should record the deviation in the ledger or receipt.
3. **Two DB I-1 probes run on native PostgreSQL only** (`tests/outbox-schema.test.ts:811,835`), as implementer concern 3 says. On PGlite, `session_user` is always the superuser, so the new trigger checks never run under `npm run test`. The native suite must stay part of the gate.

   No test sends a state change through the new trigger checks as the real `libetech_intake_svc` login: intake tests use the superuser operator (`tests/outbox-schema.test.ts:25`). My catalog probe shows it would pass, but nothing guards a future regression on that path.
4. **The app now fails closed on a login with several app roles.** `assertRestrictedLogin` refuses to start a web, auth or intake login that reaches more than one app role. d1-ai1's real memberships are unverified. Run the database review's pre-apply checklist step 4 before deploying this code, or the app answers errors on every request.
5. **Plugin with no `chats` (implementer concern 7).**
   - `_intake_config` already returns `frozenset()` when `chats` is absent (`bot-plugin/__init__.py:641,645`), so the hook drops every group message, as it did before this wave.
   - `_deliver` now reports each group target as `failed_permanent TARGET_NOT_ALLOWED`, so every group receipt goes `dead` until a PM requeues it one by one. DMs are not affected.

   This is fail-closed as the brief asked. Holding the rows unreported instead would let them return through lease expiry and reconciliation once the config is fixed. That is a design choice for the wiring round.
6. **DOC-16 (implementer concern 6).** A reply that calls the bot posts a second receipt carrying the same `IN-` reference. This follows the plan (`:322`). Whether a second visible receipt in the group for one request is acceptable under DOC-16 is a product decision for Chairman, not a code defect.
7. **A client component imports runtime code from `src/server/`.** `src/components/team-accounts.tsx:5` now imports `src/server/access-grants.ts`. That works today because the module is pure and imports types only. Consider moving it to a shared folder so a later server-only import cannot break the client bundle.
8. **The manual UI table needs a re-run for the reworked card.** In particular: the loading state, which was blocked by the 500 before; the ≥700 px choice row; and the needs_info re-ask. I did not open a browser.

### Verdict

All findings addressed, no new Critical/Important breakage.

Counts: NOT ADDRESSED 0 · new Critical 0 · new Important 0 (new Minor 1).
