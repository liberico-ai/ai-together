# Review gate 4 — Task 11 (bot-plugin intake/delivery adapter), 1371a25..7e73e7f

Line numbers are for `bot-plugin/__init__.py` and `tests/test_bot_bridge.py` at 7e73e7f. I read the diff once. I read three things outside it: `validated_context` (`:64-74`), which the hunk cut off, and the release-packaging and manifest scripts plus the server contract files listed under named risks. I ran no tests.

### Spec Compliance
- ❌ **Issues found.** There are two deviations from contracts the brief states. Both are named risks. Everything else matches.
  1. The brief gives `intake_event(event) -> dict | None`. The code raises `ValueError('INTAKE_EVENT_INVALID')` when optional metadata is malformed (`:206`, `:218-219`, `:247`). The only caller, `intake_hook` (`:494-512`), catches the error, so it never reaches the gateway. The cost is that the whole message is lost instead of recorded (Minor M-2).
  2. The brief says only network errors and 5xx go to `spool.put`. `_retryable` (`:153-159`) also spools 401, 404, 408 and 429, plus local `BRIDGE_NOT_CONFIGURED` and `BRIDGE_CONFIG_PERMISSIONS` (Minor M-1; its effect at SPOOL_FULL is covered by Important I-1).
  - Matches:
    - **Interface:** every name and signature is present: the three path constants, `MAX_EVENT_BYTES=16384`, `MAX_ATTACHMENT_BYTES=20971520`, `ALLOWED_MIME` (exactly the 9 types), `call_backend(..., path=, key_file=)`, `fit_event`, `store_attachment`, `Spool.put/drain`, `submit_event`, `SendJournal`, `render`, `drain_outbox(..., limit=10)` and `approval_question` with the `access_change` branch.
    - **Brief tests:** all 16 named tests exist (`tests/test_bot_bridge.py:210-679`), plus 4 extra.
    - **Text:** the four templates match the brief verbatim (`:515-519`), and so do the access-change card text and the `plugin.yaml` description.
    - **Versions:** `VERSION` and the yaml `version` are unchanged (S7).
    - **Old tests:** the 11 old tests are byte-identical. The stat shows 598 insertions and 0 deletions, and the hunk only appends after line 110.
    - **Registration:** the 7 registrations are kept, and the hook is added only when `register_hook` exists and `intake.json` is present (`:1000-1004`).
    - **Rejected receipts:** `report.rejected` is read, and refused receipts are journaled and closed (`:767-807`).
    - **No wiring:** `drain_outbox` is called only from tests. There is no send wiring and no pull schedule.
- ⚠️ **Cannot verify from the diff:**
  - The hook name `pre_gateway_dispatch` (`:47`), how the hook is called (`event=` keyword or first positional argument, `:498`), and every attribute in the event contract comment (`:175-178`). If the gateway calls `hook(gateway, event)`, then `args[0]` is the gateway, `intake_event` returns None, and intake records nothing without any error.
  - Whether calling `event.download_attachment()` inside the hook is safe for the gateway's own dispatch (thread, timeout, side effects).
  - Whether Hermes requires hooks to be declared in `plugin.yaml`.
  - That nothing was installed or sent. Nothing in the diff suggests either.
  - The implementer's Python-to-zod cross-check was done in a scratch area and is not committed. I spot-checked parts of it (next section).

### Named-risk checks (one focused check each)
- **Signing** (`src/server/bridge-auth.ts:5,11-13`): the server signs `ts\nnonce\nPOST\n{route}\n{raw}` with a 13-digit millisecond timestamp, a nonce of 20–80 `[A-Za-z0-9_-]` characters and a 60-second window. The plugin (`:129`) matches. `test_signing_text_uses_the_exact_route_path` recomputes the HMAC through the real `call_backend` and a fake opener. **OK.**
- **Nil-UUID lease on reconcile** (`src/server/outbox.ts:183`): `validReconcile` never compares the lease. `z.string().uuid()` in zod 4.6.7 accepts `00000000-0000-0000-0000-000000000000`; I checked this with a one-line node call. **OK.**
- **DM delivery shape** (`migrations/017_outbox.sql:26`): `target_topic_id` is `NOT NULL DEFAULT ''`, so `_delivery_target` (`:669-680`) receiving `topicId=''` for a DM is correct. **OK.**
- **Template parameters** (`src/server/intake.ts:36`): `refOf` gives `'IN-' + 8 uppercase hex`, which matches `TEMPLATE_PARAMS` (`:520`). **OK.**
- **Failed-attachment schema** (`intake.ts:18`, `016_intake_inbox.sql` intake_attachments): `reasonCode` and `reason_code` are free text, so the new `STORE_UNAVAILABLE` is accepted. `sizeBytes` may be 0. **OK.**
- **Stale manifests:** `scripts/package-release.py:16-25` rebuilds both manifests inside the tarball, and `deploy/verify-bundle.py` checks the copy in the bundle. The committed copies are stale but are not what gets verified, so this is **not a defect for this task.**
- **Retry classes and SPOOL_FULL:** see I-1 and M-1.
- **Synchronous hook:** see I-2.

### Strengths
- **Two principals, two keys.** `ROUTE_KEYS` (`:33`) pairs each route with one key file and is checked before any credential is read (`:122-124`). The test drives all seven bot handlers and records the path and key file of every call (`:210-240`). The reverse is tested too: bridge.json is set to 0644 and never read on an intake route (`:273-280`).
- **Identity comes only from the gateway source,** through the existing `validated_context` (`:64-74`). There is a spoofed-text test.
- **The delivery journal is careful.**
  - The `sending` line is fsynced before `send` is called.
  - Reconcile answers come from the journal only. A damaged journal never answers `not_sent` (`:740`).
  - `_receipt_batches` keeps one receipt per (outboxId, attemptNo), which matches how the server keys `rejected`.
  - A batch the server answers with 413 or 422 is split, and only the bad receipt is closed.
- **Text fitting is careful:** it counts UTF-16 units the way zod's `.max(4096)` does, fits the exact signed body by binary search, hashes the full text, and splits on `\n` only (it does not use `splitlines`) so U+2028 and U+0085 stay inside one line.
- **Logs carry fixed codes only.** The hook test puts the message text, the chat id and a name into an exception message and asserts that none of them reaches a log record (`:679-708`).
- **Runtime files are opened carefully:** `O_NOFOLLOW`, a mode check on files that already exist, temporary files created with `O_EXCL`, and spool appends under `flock`. A spool rewrite after a concurrent drain is compared by prefix, so it never drops an unsent line.

### Issues

#### Critical (Must Fix)
None.

#### Important (Should Fix)

**I-1. One event the backend always answers with an error stops all intake for good, and at 1 000 lines every new message is dropped.** `Spool.drain` stops at the first retryable failure (`:455-457`). `submit_event` then spools every new message behind it (`:481-485`). There is no per-line attempt count, no dead-letter file and no age limit.
- Any per-event failure the server answers deterministically with a retryable status is enough. Errors that are not `AppError`, ZodError or SyntaxError become a generic 500 (`src/server/http.ts:13`). One possible case (#hypothesis — I have not checked whether Telegram delivers U+0000): text with U+0000 in an excerpt-mode project. PostgreSQL text columns reject NUL.
- Once such an event is at the head, every later message queues behind it. At `SPOOL_LIMIT` each new message raises `SPOOL_FULL` inside the hook and is lost. The operator only sees repeated `INTAKE_SPOOLED` and then `SPOOL_FULL` codes, which look the same as an ordinary outage. Recovery means editing a 0600 JSONL file by hand on the gateway host.
- **Why it matters:** this spool is the slice's only buffer for "thu tin", and a single bad message disables it.
- **Fix:**
  - Store an attempt count (or the first-spooled time) in each spool line.
  - When the backend *answers* with 5xx (status ≠ 0) for the head line N times, or for longer than T, move that line to an owner-only `intake-dead.jsonl`, log a fixed code and continue. Network errors (status 0 or OSError) stay head-blocking, so order is kept while the backend is down.
  - Strip U+0000 from `text` in `fit_event`.
  - Add a regression test: event A always answers 500, event B succeeds.

**I-2. The hook does unbounded synchronous work in the gateway's dispatch path, and it goes live as soon as `intake.json` exists.** There is no other enable step (`:1000`). For one incoming group message, `intake_hook` (`:494-512`) can:
- call `download_attachment()` inline for up to 20 MiB, with no timeout set by the plugin (`:392`);
- read a spool of up to about 16 MB four times: `pending`, `drain`, `pending`, then `put` under the lock (`:424-433`, `:439`, `:481-485`);
- replay the whole spool inline. That is up to 1 000 signed POSTs with a 5-second timeout each (`:482`), stopped only when the shared 600-per-minute `bridge-intake` throttle answers 429 (`src/server/bridge-io.ts:19`). That throttle is shared with outbox pull and receipts, so the drain also takes their budget away;
- wait on `flock(LOCK_EX)` with no timeout (`:354`);
- add 5 seconds to every group message while the backend accepts connections but does not reply.

**Why it matters:** the brief says the hook must never stop or alter dispatch, and the named risk is that the hook runs synchronously. If the gateway calls hooks on its event loop, all chats in the process stall. The implementer's own concern 1 ("verify before enabling") has no switch other than the key file.

**Fix:**
- Bound the work per hook call: at most one live POST plus at most k replays (for example 5), with a short timeout (for example 2 s) for calls made from the hook, and `LOCK_EX|LOCK_NB` that spools or skips when the lock is held.
- Alternatively, hand the event to a daemon worker thread through a bounded in-memory queue and return at once.
- Either way, keep the spool drain out of the dispatch path, and add a test that asserts the number of backend calls per hook invocation.

**I-3. The plugin has no gateway-side chat allowlist, so files from groups the intake principal may not read are downloaded and kept forever.** `intake_event` accepts any libetech group (`:221-266`). The hook stores the attachment *before* the backend checks scope (`:503-505`). The backend refuses chats outside `intakeChats` with 403 `SCOPE_DENIED` (`src/server/intake.ts:45`), but by then the bytes are already in `attachments/<sha256>`. Nothing references them, and nothing removes them.
- Every out-of-scope message also costs a signed request and a nonce row, logs a `SCOPE_DENIED` warning, and spends the shared 600-per-minute throttle. A busy team group that is not an intake chat could therefore push in-scope intake into 429 (and so into the spool) and starve outbox pulls.
- **Why it matters:** the constraint "allowlist chat riêng" is enforced only after the plugin has already copied data from outside the allowlist. A content-addressed file cannot safely be deleted after a 403, because another, accepted event may point to the same hash.
- **Fix (needs a small design decision from the controller):** carry the intake chat ids in the runtime `intake.json` (not in the repo). `intake_event` or the hook then returns None for any other chat, before download, spool or POST. The server allowlist stays authoritative. Test: a group message from a chat outside the allowlist downloads nothing, spools nothing and calls no backend.

#### Minor (Nice to Have)
- **M-1. Retry classes** (`:153-159`).
  - Deleting `intake.json` at runtime is the natural way to switch intake off, and so is revoking the key on the server (401). With the hook already registered, both make the plugin keep writing every group message's full text to the spool until it is full.
  - A malformed `intake.json` behaves the opposite way: `KeyError` or `JSONDecodeError` from `_read_key` (`:115`) is *not* retryable, so the message is dropped.
  - Suggest: at runtime, treat a missing key file as "intake disabled, do nothing". Bound 401 retries by age. Make a malformed key file behave like `BRIDGE_NOT_CONFIGURED`.
- **M-2. `intake_event` raises instead of returning None** (`:206`, `:218-219`, `:247`).
  - A naive `edited_at`, an ISO-string `edited_at` or a non-numeric reply id loses the whole message.
  - A naive or epoch `timestamp` (Telegram's `date` is an epoch int) silently becomes `_now()` instead (`:255`), which is inconsistent.
  - The event contract is unverified, so prefer to drop the malformed optional field, record the message and log a code. Or settle the policy at the wiring step.
- **M-3. Concurrent `drain_outbox` passes.** The journal view is read once per pass (`:824`) and journal appends take no lock (`:624-631`). A `sent` line that another process writes after this pass's refresh is invisible to `_reconcile`, which would answer `not_sent`, and the attempt would be sent a second time. No scheduler exists yet, so this cannot happen today. Before wiring one, take an exclusive `flock` for the whole pass, or re-read the journal right before answering reconcile requests.
- **M-4. Retention and growth** (implementer concern 9).
  - `send-journal.jsonl` and `attachments/` are never compacted.
  - Each pass re-reads the whole journal.
  - One torn final line makes `damaged` true permanently, so every reconcile with no journal line is held forever (`:740`).
  - The `failed` state is written (`:647`) but ignored by `_JournalView.add` (`:593-604`).
  - These need a retention and compaction design before any schedule is wired.
- **M-5. Reconcile starvation** (cross-task, follows from the brief's "hold").
  - Every `uncertain` send outcome leaves a `sending` line with no `sent` line, so `_reconcile` holds it every time. That covers timeouts, `SEND_UNKNOWN` and `SEND_NO_MESSAGE_ID`.
  - The server offers only the 10 oldest uncertain rows (`src/server/outbox.ts:132`). Once 10 rows are held, newer uncertain rows are never offered, including rows the journal could answer.
  - Raise this with the server task or the controller.
- **M-6. The plugin's own commands and empty messages go into intake.**
  - `/libetech-link <pairing code>` typed in a group by mistake is posted, spooled and marked `addressed`, which triggers a receipt card.
  - Service messages and stickers with empty text create candidates.
  - Suggest skipping `/libetech-*` and `/duyet`, and skipping events with empty text and no attachment (implementer concern 6).
- **M-7.** `folder.mkdir(mode=0o700)` (`:405`) fails with FileExistsError if two hooks run at once, which returns `STORE_UNAVAILABLE`. It also never checks the mode of a folder that already exists. Use `exist_ok=True` plus a mode check.
- **M-8.** The registered lambda (`:1002`) passes `home` positionally. A gateway keyword argument named `home` would raise TypeError outside `intake_hook`'s `try`. Make the parameter positional-only: `def intake_hook(profile_home, /, *args, **kwargs)`.
- **M-9.** No committed test ties the Python payloads to the TypeScript zod schemas. For example, `TEMPLATE_PARAMS` (`:520`) must keep matching `refOf`, and `fit_event` must keep matching `intakeEventSchema`. A fixture checked by both suites would catch drift.
- **M-10. Public repo:** `'Trần  Văn Bình'` / `'binhtv'` (tests `:191`, `:608`) is a realistic name and username pair. Prefer obviously synthetic values such as the existing `'Người mẫu'`.
- **M-11. File size:** `__init__.py` is now 1 004 lines and mixes bot commands, intake, spool, journal, outbox and cards. The brief requires a single file; consider splitting it into sibling modules in the wiring round.

### Assessment
**Task quality:** Needs fixes

**Reasoning:** The contract-facing core is sound and matches the server: key separation, signing, identity, journal-before-send, reconcile-from-journal and rejected-receipt handling. The intake hook is not yet sound at runtime. One event the backend always refuses can stop intake permanently (I-1). The hook does unbounded synchronous work in the gateway's path (I-2). It copies files from groups outside the intake allowlist (I-3). All three go live as soon as `intake.json` is placed.
