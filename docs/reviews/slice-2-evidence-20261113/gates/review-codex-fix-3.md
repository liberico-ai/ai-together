# Review: Codex fix round 3, slice 2 (a29e5c5..9643b7f)

Reviewer: liberico-code-reviewer (advisory, task-scoped gate; not a merge review). 14/11/2026.
Sources: `git show 9643b7f:<path>` and `git diff a29e5c5 9643b7f`. I did not read working-tree source. Briefs and analysis are local docs.
No tests run. The test I would run for each doubt is named below. Line numbers are at `9643b7f`.
Tags: #fact = read in the committed code, #inference = reasoning from that code, #hypothesis = not verifiable from the diff.

## Part 1: spec compliance. Verdict ✅ (with one deviation to confirm and one widening)

| Requirement | State | Evidence |
|---|---|---|
| Class rule: backend / spool / dead-letter, INTAKE_LOST if the dead-letter write fails, never raise | ✅ inside `submit_event` | `bot-plugin/__init__.py:662-722`. Every exit is `post` ok, `keep` (put, else bury), `bury`, or `disabled`. `bury` and `keep` never raise (#fact `:623-641`, `:692-697`). The pre-submit part of `intake_hook` is not covered (see Minor M1). |
| R3-1: unlocked append, one `os.write`, O_WRONLY\|O_APPEND\|O_CREAT, 0o600, short write → INTAKE_LOST, 1 s bound kept, same line shape | ✅ | `:623-641` uses `_open_private` (mode 0o600, O_NOFOLLOW, refuses 0o077) and one `os.write` compared to `len(data)`. `_dead_line` (`:522`) is shared with the drain's `bury` (`:577-579`). `SPOOL_LOCK_SECONDS = 1.0` is unchanged (`:59`). |
| R3-2: a SPOOL_BUSY from `_commit` does not abort `submit_event` | ✅ (one reading to confirm) | `:700-709`. See the verdict on concern 2. |
| R3-3: 401 stops the drain, keeps lines and order, counts nothing, makes one request, a live 401 spools, logs INTAKE_AUTH_DENIED each time | ✅ | `:198-199` adds the `channel` class. `:597-599` breaks the drain. `:720-722` covers the live path. The test asserts `refused.call_count == 1` and `backend.call_count == 1` through `submit_event`. |
| R3-4: other answered non-retryable statuses are dead-lettered with the server's code, on both paths | ✅ | Drain `:601-602`, live `:718-719`. Tested for 403/409/413/422/418. |
| R3-5: «disabled» unchanged | ✅ | `:204`, `:597` (`break`), `:716-717`. A backlog plus a missing key still spools the new message behind it, same as at a29e5c5. |
| Retryable classes unchanged | ✅ | `:200` is the same expression as before, apart from the `channel` split. `keep(1 if answered else 0)` gives the same counts as before. |
| Finding 4: `LATEST_REVISION_ORDER = 'r.edited_at DESC NULLS LAST, r.revision_no DESC'`, alias comment kept, inbox.ts unchanged | ✅ | `src/server/intake.ts:27-30`. `src/server/inbox.ts:63,131` interpolate the constant. No other ordering on revisions exists in `src/` or `migrations/` (grep at 9643b7f). |
| Finding 4 tests (edit first → T2; normal order two clocks; two without edited_at; card vs `detail().revisions[0]`) | ✅ | `tests/intake.test.ts` (3 tests), `tests/inbox-service.test.ts` (1 test). The `[2,3,1]` assertion is kept. RED shows 3 failures that are about behaviour; the no-`edited_at` test passes at head, as the brief expected. |
| Frozen: `tests/test_bot_bridge.py` 1–110 and 11 original tests byte-identical to ce11242 | ✅ | I checked it myself: `diff <(git show ce11242:… \| sed -n 1,110p) <(git show 9643b7f:… \| sed -n 1,110p)` is empty. All 11 `def test_` lines in ce11242 are ≤ line 110. Line 111 is the old `__main__` line, and an earlier round already moved it. |
| Versions unchanged | ✅ | `VERSION = "0.3.0"` (`:27`). `plugin.yaml` is not in the diff. |
| No content or secrets in logs; synthetic ids | ✅ | New log lines carry only fixed codes plus a reason code (`:599`, `:632-640`, `:705`, `:721`). Test ids are 50–552. |
| TDD RED/GREEN | ✅ | RED: 22 failed, all for behaviour (`codex-fix-3-red.log:866-888`). GREEN: 59 passed, 61 subtests; full PGlite 462 passed; typecheck exit 0 (`codex-fix-3-green.log`). These are the implementer's runs. I did not re-run them, so they are #hypothesis for me, but the logs are consistent with each other. |

- **Missing:** none. Finding 3 was dropped by the controller's scope change, so it is not counted.
- **Extra:**
  1. Local errors that are not network errors (`BRIDGE_REDIRECT_DENIED`, any unexpected exception) are now class `refused`, so they are dead-lettered (`:204-205`). This is wider than R3-4, which speaks of *answered* statuses. See Important I1.
  2. An error reading the spool before the drain dead-letters the new message (`:710-711`). See Minor M3.
- **Misunderstood:** none. One deviation needs confirmation. R3-2 reads «post, else spool, else dead-letter». The code posts only if the drain walked the whole spool. See concern 2.

## Part 2: quality findings

### Critical
None.

### Important

**I1. A channel-level local error is classed «message refused», so a backlog is moved to the dead-letter file five lines per incoming message.** `bot-plugin/__init__.py:204-205` (with `:117`, `:601-602`).
- #fact: `NoRedirect.redirect_request` raises `ValueError("BRIDGE_REDIRECT_DENIED")` (`:117`). `_failure_kind` returns `refused` for any `ValueError` not in the disabled pair, and for any non-OSError exception (`:204-205`). In `drain`, `refused` is buried and the loop **continues** (`:601-602`).
- Scenario (#inference): on a deploy, the loopback port `127.0.0.1:3148` answers 301/302/307/308 for the intake path. Causes could be a Next.js `trailingSlash`/`basePath` change, middleware redirecting to login, or another service bound to that port. Every spooled line meets the same redirect. Each hook call buries up to `HOOK_REPLAYS = 5` lines plus the new message. A one-hour outage backlog drains into `intake-dead.jsonl`, and with no re-inject tool (residue 1) every message must be re-entered by hand. The same holds for a deterministic programming error in `call_backend` (TypeError and the like), which hits every line.
- This is exactly the amplification that R3-3 refused for 401: «a clock drift would move the whole backlog to the dead-letter file and need manual re-entry». The class rule is not broken, because nothing is deleted. But the very outcome the controller ruled out for 401 comes back through a sibling the final external review is likely to name.
- Fix shape: class `BRIDGE_REDIRECT_DENIED` (an answer about the channel, not the message) as `channel`: stop, keep, spool behind. Keep `refused` only for a `BackendError` with a real status. For unexpected local exceptions the controller has to pick between two costs: `channel` (a poison line could stall the spool until `SPOOL_LIMIT`, then dead-letter `SPOOL_FULL`; nothing lost) or `refused` (mass dead-lettering on a code bug). Either choice should be written down, not left implicit.
- Test I would add: drain three lines, each raising `ValueError('BRIDGE_REDIRECT_DENIED')` → assert all three are still in the spool, in order, after one call. The walk test currently pins the opposite (`tests/test_bot_bridge.py`, case `('refused',ValueError('BRIDGE_REDIRECT_DENIED'))`), so it would change with the fix.

### Minor

**M1. The hook's outer catch-all can still drop a message without a dead-letter line.** `bot-plugin/__init__.py:770,777-778`.
- #fact: `fit_event(payload)` runs before `submit_event` and may raise `EVENT_TOO_LARGE` / `INTAKE_EVENT_INVALID` (`:355-384`). `_encode` uses `ensure_ascii=False` followed by `.encode()`, which raises `UnicodeEncodeError` on a lone surrogate. Text is sanitised (`:313`, `:362`), but `fileName` (`_file_name`, `:463-469`) and `mimeType` are not.
- Any such exception reaches `:777`: the code is logged and the message is in neither the backend, the spool nor the dead-letter file.
- #inference: `EVENT_TOO_LARGE` looks unreachable (every non-text field is bounded), and a lone surrogate from Telegram is unlikely. It is still a path of the same class outside the rule's net. Also, `Spool.bury` would fail on the same surrogate (`_line` → `.encode()`, `:633`) and log INTAKE_LOST.
- Fix shape: once `payload` exists, route a pre-submit failure through `Spool(profile_home).bury(payload, attempts=0, reason=…)`. Make `_line` safe with `ensure_ascii=True` for the dead-letter file only, or with `.encode("utf-8","surrogatepass")`. At minimum, state it in the receipt.

**M2. After a disk error the message can end up in two places, and manual re-entry could then duplicate it beyond keyed replay.**
- (a) `keep` → `put` → `_append_line` writes the line, then `os.fsync` raises (`:420-421`). `put` raises, and `keep` dead-letters the message (`:695-696`). The message is now in the spool **and** in the dead-letter file.
- (b) `_commit` appends dead lines (`:653`) and then `_write_atomic` fails (`:654`). The buried lines stay in the spool and are re-sent, and they are dead-lettered again or accepted. The `refused` class now goes through this path too, not only retry-limit lines.
- Either way, an operator re-entering from the dead-letter file can create a real duplicate. This needs a disk fault, so Minor, but the receipt should state it next to residue 3.

**M3. An unreadable spool dead-letters every new message even while the backend is up.** `:710-711`.
- #fact: `spool.pending()` → `_read_lines` → `_open_private` raises `RUNTIME_FILE_PERMISSIONS` if someone runs `chmod 644` on the spool. The outer `except` buries the new message without trying the backend.
- #inference: this is persistent until fixed, so every message goes to manual re-entry. Durable, but it costs the operator more than needed.
- The ordering argument (we cannot know whether a backlog exists) is valid, so I accept the choice. It should be in the receipt as a residue next to the 401 one.

**M4. `blocked` is reset only after the spool is read.** `:572` vs `:576`.
- If `_read_lines` raises inside `drain` on a **reused** `Spool` whose previous drain set `blocked=False`, then `submit_event` reads `behind = False` (`:707`) and posts live without knowing the backlog.
- The hook creates a fresh `Spool` per call (`:770`), so this is not reachable from the gateway today. Move `self.blocked = True` to the first line of `drain`.

**M5. In the R3-2 exception branch, `behind` does not re-check the spool for lines appended concurrently.** `:707`.
- The success branch re-reads `spool.pending()` (`:702`). The exception branch trusts `blocked`, which describes only the lines this drain read.
- A concurrent `put` by another process during the drain is therefore overtaken by this message's live post. No loss; an order slip only under concurrency.

**M6. Nits.**
- The log prefix differs: `libetech intake spool: INTAKE_DEAD_LETTER` (drain, `:579`) vs `libetech intake: INTAKE_DEAD_LETTER` (live, `:640`). Operators grep by code, so it is harmless.
- A live dead-letter line carries `firstSpooledAt` for a message that was never spooled (`:629`). This is the shape R3-1 asked for, but a future re-inject tool must not read it as spool age.
- The dead-letter file is fsynced but its directory is not, on first create.

### ⚠️ Could not verify from the diff
- Whether the real gateway calls the hook in several threads or processes. That sets how often M5, residue 5 (the unlocked line interleaving with a split `_write_all` in `_commit`) and SPOOL_BUSY actually happen. #hypothesis
- What status `identity.throttle` returns (`src/server/bridge-auth.ts` calls it after the nonce insert). If it is 429, a replay burst of 5 per message could age lines to `INTAKE_RETRY_LIMIT`. That behaviour is unchanged, and it is a dead-letter, not a loss.
- Whether a `BaseException` (thread cancel, `SystemExit`, async cancellation) can interrupt the hook in the real gateway. Nothing in the plugin catches it, so the message would be gone. This is outside the brief's classes.
- Finding 4 at the domain level: a revision without `edited_at` (an attachment re-sent on an unedited message) that arrives **after** an edit now sorts below the edit. This matches the plan («latest by edited_at»). Duplicate hints use the edit's hash. Attachments are listed per event, so nothing is hidden. I did not check this against the plan text beyond the analysis.
- The GREEN numbers are the implementer's. I ran nothing. To confirm the two points I reasoned about, I would run `python3 -m pytest tests/test_bot_bridge.py -q -k "busy_lock_while_the_drain_commits or every_failure_class"`.

## Verdict on the implementer's concerns

1. **(Docs L240/L241, DELIVERY-011 gap 3 and line 185 are stale.)** Agreed, and they are out of the builder's scope. The controller must update them before the receipt. Otherwise the receipt still says «tin đó mất».
2. **(R3-2: post live only if the drain walked the whole spool, else spool then dead-letter.)** **Accept.**
   - The brief's R3-2 says the new message «follows the live-path rule», and the live-path rule in the same docstring includes «while any remain, the new message is spooled behind them» (`:663-664`). Posting ahead of unsent lines would break the plugin's ordering guarantee.
   - The price: if the lock is still busy, the message lands in the dead-letter file, not the backend. That is durable but manual.
   - The test covers both branches. The only gap is M5 (no re-check under concurrency).
3. **(Wider rule: a spool-read error dead-letters; local non-network errors dead-letter.)**
   - **Accept the spool-read part** (M3, as a residue).
   - **Do not accept as-is for `BRIDGE_REDIRECT_DENIED`** (I1). A redirect is a channel condition and should be kept, like a 401. For unexpected exceptions, the controller should rule explicitly on which cost to take.
4. **(Residues: no re-inject tool; a 401 that never clears fills the spool then the dead-letter file; a short write leaves half a line; the drain's commit writes dead lines under the lock with the unchanged loop.)** All four are accurate as stated (#fact: `:403-406`, `:417-423`, `:653`). Add to the receipt:
   - M1 (pre-submit drop path);
   - M2 (double placement on fsync or rename failure);
   - M3 (spool unreadable → every message dead-lettered);
   - a half line in the **spool** (not only the dead-letter file) from a short `_append_line` fuses with the next appended line. The drain then buries both as `SPOOL_LINE_UNREADABLE`: kept raw, not delivered. #inference, pre-existing.

## Overall
**NEEDS WORK (light).**
- Part A meets every ruling.
- Finding 4 is correct and its tests fail for the right reason.
- No Critical findings. One Important finding, I1: a channel-level local error dead-letters the backlog, the same amplification R3-3 rejected for 401. It should be reclassified, or explicitly accepted by the controller, before the final external review. Otherwise that review is likely to raise it as a sibling of finding 2.
- The Minor findings are receipt residues more than code changes, apart from M4 (a one-line move).
