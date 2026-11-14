# Planner analysis — Codex round 3, slice 2 (head `2eb9437`)

14/11/2026 · agent `planner` · one-time analysis under slice step 6. No product code, test, migration or plugin file was changed. One file was edited: `docs/OPEN-QUESTIONS.md` (OQ-30 appended, awaiting Chairman).

Evidence produced here:
- `codex-round-3-analysis-pytest.log` — the two plugin tests Codex's P0s point at pass at head (2 passed).
- `codex-round-3-analysis-order.log` (script `codex-round-3-analysis-order.mjs`) — PGlite run of the head ordering key and the proposed one on two synthetic cases.

Not run: native suite, build, full pytest, full PGlite suite (the scout owns those).

## Summary

| # | Finding | Valid | Codex | My severity | Root cause | Fix size | Migration | OQ |
|---|---|---|---|---|---|---|---|---|
| 1 | `bot-plugin/__init__.py:448` SPOOL_BUSY loses the message | yes | P0 | **P1** | design choice, ruling L241 | S | no | no |
| 2 | `bot-plugin/__init__.py:583` 401 deletes spooled messages | yes | P0 | **P0** | design choice, ruling L240 | S–M | no | no |
| 3 | `src/server/intake.ts:80` edit stores text on a `pointer_only` event | yes | P1 | **P1** | plan conflicts with itself | S | no | **OQ-30** |
| 4 | `src/server/intake.ts:28` latest revision can be the original | yes | P1 | **P1** | code defect; test hides it | S | no | no |

Recommendation: **(a)**, with a hard stop after round 4. Details at the end.

---

## Finding 1 — SPOOL_BUSY loses the incoming message (`bot-plugin/__init__.py:448`)

**1. Valid: yes.**
Path at head: `intake_hook` (`:690`) → `submit_event` (`:623`) → live POST fails with a network error → `spool.put` (`:543`) → `_locked` (`:436`) retries `LOCK_NB` for `SPOOL_LOCK_SECONDS = 1.0` (`:59`) → `ValueError("SPOOL_BUSY")` (`:448`) → propagates to the hook's `except` (`:716`), which logs the fixed code and returns `None`. The message is in neither the backend, the spool nor the dead-letter file.

A test asserts exactly this: `tests/test_bot_bridge.py:1052-1072`, comment at `:1069` «The message was lost (a documented limit)» and `spool.pending() == 0`. It passes at head (`codex-round-3-analysis-pytest.log`).

Codex names one trigger (backend down). Reading the code gives three more of the same class, which round 4 would otherwise find:
- Backend **up**, spool not empty: `submit_event` drains first (`:649-650`); `Spool._commit` (`:605`) takes the same lock inside `drain`'s `finally` (`:598`). `SPOOL_BUSY` there leaves `submit_event` before the new message is posted or spooled. The lines already sent stay in the spool (harmless, replay is keyed), but the new message is lost.
- `SPOOL_FULL` (`:547`): same exit, same loss. Plan `:528` asks only that it is not silent; it is logged, and lost.
- A `final` answer on the live POST (`:658-660`): returned as an error and dropped, no dead-letter. This overlaps finding 2.

**2. Severity: P1, not P0.**
- For Codex's level: the slice goal is durable intake (`docs/SLICE-BRIEFS.md:89`), and DOC-16 (`:129`) says the user must not have to re-enter a request. A silent drop breaks DOC-16 for that message.
- Against it: `:89` says «lưu bền **trước khi báo nhận**». On this path no receipt is issued, so no false acknowledgement is made. The trigger needs another process to hold the lock for more than 1 s, while every lock holder at head does only a read plus an append or an atomic replace (`:545-548`, `:609-615`); `drain` does not hold the lock while it sends. So it needs a stalled process or disk. One message is lost per occurrence, with a fixed log code. Under OQ-09 the priority1 ledger is still the owner of ticket state, and the two-store reconciliation lists the gap.
- Ruling L241 chose this and named its cost truthfully («known limit: that message is lost, logged»). The draft receipt already discloses it (`docs/DELIVERY-011-intake-outbox-20261113.md:99`). The ruling's stated cost-if-wrong is about the download blocking dispatch, not about the loss; the loss itself was accepted as a limit, not weighed as a cost.
- My reading: disclosed and narrow, so not P0; but the fix is cheap and the limit is not needed to keep the hook bounded, so it should not stay.

**3. Root cause:** design choice — ruling L241 (bounded hook work, spool lock wait). Not a code defect: the code does what the ruling says.

**4. Fix shape.**
- Files: `bot-plugin/__init__.py`, `tests/test_bot_bridge.py`, receipt gap 3 and line 185 of `docs/DELIVERY-011…`.
- Rule: *no code path deletes an intake message; it ends in the backend (confirmed by IntakeAck), in the spool, or in the dead-letter file.* When the spool cannot take a message within the bound (`SPOOL_BUSY`, `SPOOL_FULL`), the hook appends it to `intake-dead.jsonl` with that reason, **without** the spool lock. This is safe because the dead-letter file is append-only everywhere (`:613-614` only appends; nothing rewrites it) and is opened `O_APPEND`. The 1 s bound of L241 stays. If even that append fails, log a new fixed code (for example `INTAKE_LOST`); that residue is a disk failure and goes in the receipt.
- `drain`: a `SPOOL_BUSY` from `_commit` must not abort `submit_event`; nothing is consumed, the new message then follows the rule above.
- Tests: rewrite `test_a_busy_spool_lock_is_given_up_quickly_with_spool_busy` (message is in the dead-letter file with reason, elapsed still < 2 s); spool full → dead-letter line, not loss (touches the assertion near `:489`); busy lock during `_commit` with the backend up → new message not lost; dead-letter append failure → fixed code, no exception into the gateway.
- Size: **S**.
- Risk: low to medium. An unlocked append racing `_commit`'s locked append relies on `O_APPEND` single-write behaviour; `_write_all` (`:399`) may split a write in theory. If the reviewer does not accept that, the alternative is one file per message under an owner-only folder (`_write_atomic`), size M. The dead-letter file can grow during a long outage with a full spool (≤ 16 KiB per message); there is no re-inject tool, the operator reads the file (already the stated cost of L239).
- Migration: no. OQ: no — this replaces a controller ruling, not a Chairman decision.

**5. SPEC contradiction: no.** Brief and plan agree (durable, not silent). The gap is between ruling L241 and the brief. `docs/OPEN-QUESTIONS.md` not touched for this finding.

---

## Finding 2 — a 401 deletes messages already in the spool (`bot-plugin/__init__.py:583`)

**1. Valid: yes.**
Path at head: `Spool.drain` (`:550`) → `send` raises `BackendError(…, 401)` → `_failure_kind` (`:184-198`) returns `final` for every status that is not 0, 404, 408, 429 or 5xx → `:583-584` logs «dropped one event» → `index += 1` → `_commit` removes the line. The loop **continues**, so every following line meets the same 401 and is removed too. Nothing goes to the dead-letter file.

A test asserts exactly this: `tests/test_bot_bridge.py:599-604` — two spooled lines, drain with 401, then `(spool_lines, dead_lines) == ([], [])`, with the comment «dropped with its code, not retried and not dead-lettered». It passes at head. The live path does the same for a new message (`:658-660`, test `:590-593`).

What the server answers 401 for (`src/server/bridge-auth.ts:18-20`): bad header format, **timestamp more than 60 s from server time**, or HMAC mismatch. None of these says anything about the message. All three are conditions of the channel: gateway clock drift, a key rotated on one side first, a wrong key file. Each is temporary and each hits every line the same way.

So one misconfiguration at recovery time empties the backlog built during the outage — up to `SPOOL_LIMIT = 1000` messages, five per incoming message (`HOOK_REPLAYS`), plus each new message.

**2. Severity: P0 — I keep Codex's level.**
- DOC-12 (`docs/SLICE-BRIEFS.md:128`): outage, recovery, replay → no duplicate, **with a recovery receipt**. This path deletes the very messages DOC-12 is about. The DOC-12 tests cover only the network-error case, so they stay green.
- Ruling L240 chose it: «401/403 ⇒ not retryable, dropped … — cost if wrong: a revoked key drops messages instead of hoarding them (intended)». The stated cost covers one cause (a revoked key) and one message at a time. It does not cover clock drift or a rotation in progress, and it does not count the amplification over the whole spool. The cost was understated.
- The reason given for dropping — do not hoard — is already met by other means in the same file: `SPOOL_LIMIT`, and the dead-letter file that L239 added in the same wave. Dropping is not needed for it.
- Basis for «permission errors are not retried forever»: `docs/SLICE-BRIEFS.md:100` and plan `:40`. Both are about the **outbox** (delivery to Telegram) and both end in state `dead`, a kept row with an owner, not in deletion. The plan says nothing about 401/403 on the intake direction (`:505` names only network and 5xx).
- Limits of the exposure today: the hook is off unless `intake.json` has `"hookEnabled": true`; no plugin is installed; nothing real is at risk at the «đã có mã» level. It is still a P0 for the gate, because the behaviour is deliberate, tested as correct, and would be live the day the hook is enabled.

**3. Root cause:** design choice — ruling L240 (retry classes). The plan has a missing case (intake 401/403), which the ruling filled by borrowing the outbox rule and turning `dead` into delete.

**4. Fix shape.**
- Files: `bot-plugin/__init__.py` (`_failure_kind`, `Spool.drain`, `submit_event`), `tests/test_bot_bridge.py`, receipt line 185.
- Rule: same invariant as finding 1 — nothing is deleted. Two classes replace `final`:
  - **Channel refused (401):** stop the drain, keep the line and the order, count nothing, spool the new message behind it, log a fixed code (for example `INTAKE_AUTH_DENIED`) on every call. Bounded by `SPOOL_LIMIT`, then by the dead-letter overflow of finding 1. This follows the reasoning of L248 (a condition that blocks everything should not age lines out). Alternative the controller may prefer: count it against the cap of five and dead-letter — also loses nothing, but moves the whole backlog to the dead-letter file under a clock drift, which then needs manual re-entry.
  - **Message refused (403, 409, 413, 422, any other answered status):** move to the dead-letter file with the server's code as reason, in the drain and on the live path. Not retried — this keeps the intent of L240 — and not deleted.
- Tests: rewrite `test_retry_classes_401_and_403_drop_and_408_429_404_5xx_spool` (`:586-608`); 401 during drain keeps all lines in order and makes one call, not one per line; 401 on live POST spools; 403/422 on live POST and in drain land in the dead-letter file with the code; recovery after the 401 clears replays everything in order with `spooled=True`; update the 403 assertion near `:1241-1246`. None of these are among the 11 byte-frozen original tests (L249) — to be confirmed by the builder with `git diff ce11242 -- tests/test_bot_bridge.py` before editing.
- Size: **S–M** (about 30–50 lines of plugin code, 5–7 tests). Do it in the same change as finding 1; they share the rule and the dead-letter write.
- Risk: medium. `_failure_kind` is used by both paths; the «disabled» class (key file missing: nothing new is spooled, `:605-607`) must stay as it is. A 401 that never clears now fills the spool and then the dead-letter file instead of vanishing — that is the point, and the receipt must say the operator has to watch the fixed code.
- Migration: no. OQ: no.

**5. SPEC contradiction: no.** The brief is consistent; the plan is silent, not contradictory. No entry added for this finding.

---

## Finding 3 — an edit can store text for a `pointer_only` SourceEvent (`src/server/intake.ts:80`)

**1. Valid: yes.**
`intake.ts:62-63` computes `contentMode` from the **current** latest row of `project_domain_mappings` on every call. `:69-71` inserts the event with `ON CONFLICT … DO NOTHING`, so an existing event keeps the `content_mode` of its first sight. `:80` builds the excerpt from the call's `contentMode`, and `:82-85` writes it into the new revision. So: event stored as `pointer_only` (unmapped or `IBS_HI`) → a newer mapping row says `XECA` → an edit of the same message stores `text_excerpt`, while `source_events.content_mode` still says `pointer_only`. The audit payload at `:103` records the call's mode, not the event's.

No test covers a mapping change between two revisions. The OQ-28 test (`tests/intake.test.ts:180-192`) uses one mapping per event. The S10 test checks that no text reaches any table for a `pointer_only` event, but only for its first revision.

What limits the effect: Inbox decides what to show from the **event's** column (`src/server/inbox.ts:80`, `:133`), so this text is stored but not displayed. It is readable by anything that reads `source_event_revisions` directly — which slices 3–4 will.

Codex did not name the opposite direction, which has the same cause: event stored as `excerpt` under `XECA`, mapping later corrected to `IBS_HI`. New revisions get no text (good), but the text already stored stays in an immutable table and Inbox keeps showing it, because the event says `excerpt`.

**2. Severity: P1 — I agree.**
In Codex's scenario the project has, by then, an authorized mapping that allows an excerpt, so the substance of AGENTS.md `:16` is arguably not broken for the unmapped → `XECA` case. For `IBS_HI` → `XECA` nobody has said whether the earlier messages were IBS HI content. What is broken for certain is the invariant S10 states (plan `:651`): no text in any table when `content_mode='pointer_only'`. It sits on the boundary between legal entities, and plan uncertainty 13 (`:635`) says every real project is unmapped today, so the first mappings written will make this the normal case for every edited older message. P1 stands.

**3. Root cause: the plan conflicts with itself.** Plan `:242` says the mode is chosen per ingest from the latest mapping. Plan `:146` and `migrations/016_intake_inbox.sql:56` put `content_mode` on the immutable `source_events` row, fixed at first sight. S10 (`:651`) states the invariant in terms of the event's column. The code follows `:242` for writing and `:146` for reading.

**4. Fix shape.**
- The question in the brief — fixed per SourceEvent at first sight, or re-evaluated per revision? **Neither the plan nor OQ-28 answers it.** OQ-28 asks only whether an unmapped project may store an excerpt, and its option (a) says «cho tới khi có ánh xạ», which leans towards re-evaluation for *new messages* but says nothing about revisions of old ones. Plan `:242` implies per call; plan `:146` + S10 imply per event. It is a data policy between legal entities, so it is the Chairman's to decide (same decider as OQ-28). I did not choose; see OQ-30.
- Fail-closed placeholder that needs no policy choice (OQ-30 option (c)): store an excerpt only when the **event's** `content_mode` is `excerpt` **and** the current mapping allows it. It can tighten after first sight, never loosen.
- Files: `src/server/intake.ts` (add `content_mode` to the `RETURNING` at `:71` and the select at `:76`; one condition at `:80`; audit payload at `:103` reports the event's mode and, if different, the applied one), `tests/intake.test.ts`.
- Tests: `pointer_only` event, then `XECA` mapping, then an edit → `text_excerpt IS NULL`, and the S10 row scan finds no text; `excerpt` event, then `IBS_HI` mapping, then an edit → `text_excerpt IS NULL`; a **new** message after the mapping change follows the new mapping; replay of the same revision changes nothing.
- Size: **S** (under 10 lines of code, 3–4 tests).
- Risk: low. Reads are unchanged. Text stored before a change to `IBS_HI` is not touched by this fix and stays visible — that is the open part of OQ-30.
- Migration: no for the placeholder. OQ-30 option (b) would need a change to 016 (unreleased on this branch) and to every reader; not proposed for this round. A database-level backstop (a trigger refusing `text_excerpt` when the parent event is `pointer_only`) is possible in 016 but widens the round; I would leave it to the Chairman's answer.
- OQ: **yes, OQ-30.**

**5. SPEC contradiction: yes — added as OQ-30** in `docs/OPEN-QUESTIONS.md`, same format as OQ-26…29, marked «chờ Chairman». It covers both directions (loosening on edit, and text already stored when a mapping changes to `IBS_HI`). It names option (c) as the proposed fail-closed placeholder, not as a chosen option.

---

## Finding 4 — «latest revision» can be the original (`src/server/intake.ts:28`)

**1. Valid: yes.**
`LATEST_REVISION_ORDER = 'coalesce(r.edited_at, e.observed_at) DESC, r.revision_no DESC'`. For the original (no `edited_at`) the key falls back to `e.observed_at`. That column is written once, by whichever payload arrives **first** (`:69-72`, `ON CONFLICT DO NOTHING`). When the edit arrives first, `e.observed_at` is the edit's `observedAt`. The plugin sets `observedAt` from the gateway's event time, or the time seen if absent (`bot-plugin/__init__.py:329-330`); for an edit that is at or after `editedAt`. So the original sorts at the edit's observation time, above the edit.

Confirmed on PGlite (`codex-round-3-analysis-order.log`): Codex's case (edit 12:00 observed 12:05 arrives first, original second) returns the original under the head key.

The existing tests do not catch it because they give every payload the same early `observedAt`: `tests/intake.test.ts:228-239` uses `observedAt: T(0)` for all three while the edits are `T(1)`, `T(2)`; `tests/inbox-service.test.ts:355-370` ingests the original first. A gateway whose event time for an edit is the edit's own time never produces that shape.

A second trigger, in **normal** arrival order, which Codex did not name: the two terms of the `coalesce` come from two clocks (`edited_at` from Telegram, `observed_at` possibly from the gateway). If the gateway clock is ahead and the user fixes a typo within that margin, the original outranks the edit. The same log shows it (original observed 12:00:05, edit 12:00:03 → head key returns the original). Whether it can happen depends on what the gateway puts in `event.timestamp` for a message — not verified against the running gateway (plan stop point 3).

**2. Severity: P1 — I agree.** Plan `:80` (Review Focus 3) and `:262` require the latest by `edited_at`, not by arrival, and name the edit-before-original case. The result of the defect is that the PM's Inbox shows superseded text and duplicate hints compare the wrong hash (`src/server/inbox.ts:59-66`). No data is lost; all revisions are kept.

**3. Root cause: code defect**, exported under ruling L48 so Task 7 reuses it; the test written for the plan's case uses a fixture that cannot fail.

**4. Fix shape.**
- Ordering key that gives «latest by `edited_at`» whatever arrives first: **`r.edited_at DESC NULLS LAST, r.revision_no DESC`**. A revision with an edit time always outranks one without; edits are compared with each other on Telegram's clock only; revisions without an edit time (the original, or a re-sent attachment on an unedited message) fall back to arrival order. It does not read `e.observed_at`, so first arrival and clock difference no longer matter. PGlite run: both cases return the edit.
- Files: `src/server/intake.ts:28` (one constant; the comment keeps alias `r`), no change needed in `src/server/inbox.ts` (it interpolates the constant at `:63` and `:131`; alias `e` stays joined for other columns). Tests in `tests/intake.test.ts` and `tests/inbox-service.test.ts`.
- Tests: edit (`editedAt=T2`, `observedAt=T5`) first, original (`observedAt=T6`) second, edit `T1` third → latest is `T2` (red at head); normal order with original `observedAt` later than the edit's `editedAt` → latest is the edit (red at head); two revisions without `edited_at` → higher `revision_no`; Inbox card and `detail().revisions[0]` agree.
- Size: **S**.
- Risk: low. The existing assertion `d.revisions.map(r=>r.revisionNo)` equal to `[2,3,1]` (`tests/inbox-service.test.ts:369`) keeps its order under the new key. No index depends on the expression.
- Migration: no. OQ: no.

**5. SPEC contradiction: no.** Plan `:80` and `:262` are clear and consistent with the brief (`docs/SLICE-BRIEFS.md:98`). No entry added for this finding.

---

## Recommendation to the Chairman: (a)

**Approve a third fix round, scoped to these four findings and their named siblings, then Codex round 4 as the last round.**

Why (a):
- All four are valid. None needs a migration. Three are size S and one S–M. Two are in one file with one shared rule; two are in another file and independent of each other.
- The slice's stated goal is durable intake. Accepting findings 1 and 2 as known gaps would ship, as tested and intended behaviour, a path that deletes the backlog on a 401. That is hard to defend in a receipt for this slice, even at the «đã có mã» level.
- Finding 3 sits on the IBS HI boundary; the fail-closed placeholder is a few lines and does not pre-empt OQ-30.
- Why not (b): the only candidate for «accept as a known gap» is finding 1 (already disclosed, narrow). But its fix is the same dead-letter write that finding 2 needs, so leaving it out saves almost nothing and leaves a test that asserts loss.

Conditions I would attach:
1. **Scope by class, not by line**, so round 4 does not reopen the same ground: in the plugin, the single rule «no path deletes an intake message» covers `SPOOL_BUSY`, `SPOOL_FULL`, a busy lock in `_commit`, and every non-retryable answer on both the live and the replay path. Rulings L240 and L241 are replaced in `controller-rulings.md` with the reason; L239, L242, L248 stay.
2. **Round 4 is the last.** Codex has returned new findings in every round (4, 2, 4), each time in code the previous round did not touch. If round 4 returns anything new: P1 and below go to the receipt as known gaps with an owner; a new P0 stops the slice and comes back to the Chairman. No round 5 without a new decision.
3. **OQ-30 is decided separately.** The round uses option (c) as a placeholder; the Chairman's answer may later change it.
4. The receipt (`docs/DELIVERY-011…`, gap 3 and line 185) is corrected in the same round: «tin đó mất» becomes the dead-letter behaviour, plus the new residue (dead-letter file has no re-inject tool; a 401 that never clears fills the spool).

**Size estimate for (a)** — an estimate, not a measurement:
- Code: about 40–70 changed lines in `bot-plugin/__init__.py`, about 10 in `src/server/intake.ts`. Tests: 9–12 added or rewritten in `tests/test_bot_bridge.py`, 6–8 in the two TypeScript test files.
- Work: one builder dispatch for the plugin, one for intake (they can be one dispatch; the files do not overlap), one scoped re-review, the full check set (pytest, PGlite, native, typecheck, build), one Codex run.
- Tokens on the Claude side: roughly 300–450 thousand in total — builder 150–250, re-review 80–120, checks and receipt 50–80. About half a working session. Codex round 4 is one more run of the same size as round 3.

**Draft PR meanwhile:** technically yes, and I see no harm in it. The four findings disclose no secret, the hook is off unless `intake.json` enables it, no plugin is installed and no migration has run on real data. The receipt would have to carry «chưa đạt cổng Codex» at the top, list the four findings with their state, and the PR must stay a draft (not mergeable) until round 4. Two cautions: opening a PR needs a push, and `AGENTS.md:15` says a repository push needs its own concrete scope — so it is the Chairman's decision, not the coordinator's; and the PR must go to the AI OS branch route only, not to the lab's default branch.

## What I am not sure of
- What the running gateway puts in `event.timestamp` and `event.edited_at` (plugin `:328-330`). The second trigger of finding 4 depends on it. The proposed key is correct either way.
- Whether another process can hold the spool lock at all in the real gateway (one process or several). Finding 1's probability depends on it; the fix does not.
- Whether an unlocked `O_APPEND` write of up to 16 KiB to the dead-letter file is acceptable to the reviewer, or a file per message is wanted (S versus M).
- The token estimate: I have no measured figure for fix rounds 1 and 2 in what I read.
- I confirmed the two plugin tests pass and the ordering on PGlite. Findings 2's amplification and finding 3 are from reading the code at head, not from a new failing test.
