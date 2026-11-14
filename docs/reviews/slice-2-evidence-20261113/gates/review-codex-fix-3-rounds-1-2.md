# Scoped re-review — codex-fix-3, fix rounds 1 and 2 (plugin)

Base `9643b7f`, head `82d30c6`. Scope: `bot-plugin/__init__.py` and `tests/test_bot_bridge.py` fix diff only. Line numbers are `git show 82d30c6:bot-plugin/__init__.py`. Advisory; merge authority is the Chairman.

## Evidence run

- `python3 -m pytest tests/test_bot_bridge.py -q` → `66 passed, 69 subtests passed in 5.33s` (#fact, run by reviewer on worktree; worktree `bot-plugin/` and the test file match `82d30c6`, `git diff --quiet` clean).
- `tests/test_bot_bridge.py` lines 1–110: byte-identical between `ce11242` and `82d30c6` (`diff` empty) (#fact).

## Items

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| 1 | I1 / R3-7: redirect and unexpected exceptions | ADDRESSED | `NoRedirect.redirect_request` raises `ValueError("BRIDGE_REDIRECT_DENIED")` (:119), which escapes `opener.open` uncaught (only `HTTPError` is caught, :167) → `_failure_kind` ValueError branch → `CHANNEL_CODES` → `"channel"` (:214, :219). Unknown non-OSError exception → `"answered"` (:215), unknown ValueError → `"answered"` (:214). Drain channel: log `_channel_code` and `break` with `index` not advanced and `head=[]` (:656-658) → line and every later line kept, nothing counted, one send. Live channel: `keep(0)` (:796-798). Answered: `attempts += 1`, head kept, drain stops, dead-letter at 5 (:663-674). `refused` now only from `BackendError` with a non-retryable, non-401 status (:210). Tests: `test_a_redirect_is_a_channel_condition…`, `test_an_unexpected_local_exception_is_counted…`. |
| 2 | Security MEDIUM / R3-6: dead-letter cap | ADDRESSED | `DEAD_LIMIT_BYTES = 64*1024*1024` (:53). Live `bury`: `fstat(...).st_size + len(data) > DEAD_LIMIT_BYTES` → no write, `INTAKE_LOST DEAD_FULL`, returns, no raise (:695-698). Drain inner `bury` returns False at the cap and every call site `break`s before `index += 1` (:640-642, :660-661, :665-670) → the line is not in `lines[start:index]`, so it is not consumed. `_commit` re-checks under the lock and returns False without writing (:724-726); mid-loop False sets `committed=False` and skips the final commit (:676-679, :682-684). `INTAKE_DEAD_FULL` logged. Tests: `test_the_dead_letter_cap_on_the_live_path…`, `test_the_dead_letter_cap_in_the_drain…`. |
| 3 | M1 / R3-8: pointer record on build failure | ADDRESSED (with one Minor residue, below) | `payload = None` before the try (:832); on exception after `intake_event` returned a payload, `Spool.bury(_pointer_record(payload, error), attempts=0, reason="INTAKE_BUILD_FAILED")`, wrapped so a raise logs `INTAKE_LOST INTAKE_BUILD_FAILED` (:856-861). `_pointer_record` (:553-572) copies only `chatId`/`messageId`/`topicId` matching `-?[0-9]{1,21}` and the exception class name matching an identifier regex; both blocks under `except Exception`; result is a dict of str/bool, so `json.dumps` in `_dead_line` cannot fail. No text, file name, bytes, hash or traceId. Test asserts the exact record `{'pointerOnly', 'chatId', 'messageId', 'topicId', 'errorType'}`. |
| 4 | M4: `blocked` reset before the spool is read | ADDRESSED | `self.blocked = True` is the first statement of `drain` (:619), before `_paths()` and `_read_lines` (:620-621). Test `test_drain_marks_itself_blocked_before_it_reads_the_spool`. |
| 5 | R3-9: local configuration errors are channel class | ADDRESSED | `CHANNEL_CODES = {"BRIDGE_REDIRECT_DENIED","PROFILE_SCOPE_MISMATCH","BRIDGE_ROUTE_DENIED"}` (:219); both codes are raised by `call_backend` before the key file or payload is read (:154-157). Other ValueErrors → `"answered"` (:214). `BRIDGE_NOT_CONFIGURED`/`BRIDGE_CONFIG_PERMISSIONS` stay `"disabled"` (:212-213). Test `test_a_local_configuration_error_is_a_channel_condition_it_never_ages_the_backlog`. |

## Targeted checks

- (a) Loss / duplication / reorder: none found in the fix diff. Every new `break` path leaves the unsettled line unconsumed and `blocked=True`, so `submit_event` spools the live message behind it (`behind = spool.pending()` or `spool.blocked`, :766-773). A `_commit` refused at the cap leaves already-sent lines in the spool; they are replayed under the backend's chat+message key (keyed replay, allowed). The hook-level pointer record can only be written in addition to a message already stored or spooled if something after `submit_event` raises (e.g. `LOG.warning`); that is an extra pointer, not a loss. #inference
- (b) Cap cannot drop a spooled line: confirmed. Drain never removes a line whose `bury` failed (not consumed), and `_commit` returning False writes neither the dead lines nor the spool rewrite. Only the live message (never yet in the spool) can end in `INTAKE_LOST DEAD_FULL`, as R3-6 prescribes. #fact (code path) + tests.
- (c) Pointer record: no content; construction cannot raise (both fallible blocks guarded, base dict literal cannot fail). #fact
- (d) Channel class leaves counts untouched: confirmed in drain (break before the `attempts` increment, `head` stays `[]`, line rewritten unchanged) and live (`keep(0)`). #fact

## New Critical / Important breakage inside the fix diff

None.

## Minor / nits (do not block)

| Sev | file:line | Issue | Note |
|---|---|---|---|
| Minor | `bot-plugin/__init__.py:838` with `intake_event` :313-373 | `payload` is assigned only when `intake_event` returns, so an exception raised inside `intake_event` after the allowlist check (:333) leaves no pointer record. | #inference, low reachability: after :333 the code is `getattr` on the gateway event, `str.encode`, regex, hashlib and uuid; only a gateway event whose attribute access raises reaches it. Outside the literal "chat outside the allowlist" residue the implementer listed. Optional fix: capture `context` into a local before the remaining reads, or build the pointer from `context` when `payload` is None. |
| Minor | `:682-684`, `:724-726` | When the final `_commit` is refused at the cap, the head line's new attempt count is not written either; that drain's answered attempt is not counted. | Under-count only (no loss); consistent with the implementer's "line at retry limit while file full is retried every drain" residue. |
| Nit | `:612-617` | `drain` docstring still says channel refused = "401 … log INTAKE_AUTH_DENIED" and does not mention redirect/config codes, unexpected-exception counting or `INTAKE_DEAD_FULL`. | Doc drift only. |
| Nit | `:187` | `_failure_kind` docstring header says "rulings R3-1..R3-8" but the body cites R3-9. | Doc drift only. |

Implementer residues (no-lock live cap race overshoot by one line/batch; dead-full blocks the drain until an operator moves the file; unhandled 300/304/305 answered as refused; pointer lines not replayable; non-allowlisted build failure untraced): verified as described in code, accepted per the rulings; not re-raised.

## Verdict

**READY FOR ARCH LEAD** for the scope of these five items: all five addressed with code and test evidence, plugin suite green (66 passed) as run by the reviewer, protected test header intact, no new Critical/Important breakage in the fix diff. This verdict does not cover the TypeScript/migration half of the diff (`vitest`, typecheck, build not run by instruction).
