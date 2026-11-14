# Reality check — Lát 2, mức «đã có mã» — 14/11/2026

Verifier: `liberico-reality-checker` (advisory; acceptance authority = Chairman). I did not build this slice. Read-only run: no file in the repo edited, no commit, no push, no container touched.

## Claim under test (verbatim, receipt `docs/DELIVERY-011-intake-outbox-20261113.md:7`)
«**Đạt cổng Codex ở vòng 5** (PASS, không finding) tại mã `001d387`, nhánh `slice-2-intake-outbox`, PR liberico-ai/ai-together#10 vào `libetech-ai-os`, chưa merge. Test, typecheck, build xanh ở `001d387`. … ⟨RC⟩ Mức này chỉ nói mã khớp test trên dữ liệu tổng hợp; ba mức dưới đều **chưa**»

Acceptance source: the slice command criteria (quoted in the brief to me) + `docs/SLICE-BRIEFS.md:87-152` («Đạt khi», «Ca quyền âm bắt buộc»).

## Verdict: NEEDS WORK (receipt text only — the code-level evidence supports «đã có mã»)

The code at `001d387` holds up: every P0/P1 fix is in the code, the tests I re-ran are green, a mutation control makes the plugin tests fail as they should, and Codex round 5 is PASS. What is not ready is the receipt itself: one sentence still says the receipt reads «chưa đạt cổng Codex», and the PR that the top row names does not contain the code that passed the gate. These are text fixes (plus, for B2, either a push or a reworded sentence); no code change is needed. Once B1 and B2 are fixed, I would record READY for «đã có mã» only.

Blocking: 2 · Non-blocking: 11

## Planned probes (listed before running)
1. Happy path: re-run `pytest tests/test_bot_bridge.py`, `typecheck`, and the focused PGlite files behind the receipt's case table.
2. Adversarial: confirm the PR on GitHub carries the code the receipt names (state ≠ claim).
3. Adversarial: look for a plugin path where an intake message ends in no place, against the claim «không đường nào xoá tin tiếp nhận».
4. Adversarial: check that the fix commits actually contain the code changes (not only docs), and that the remapped-group/edit case fails closed.
5. Failing-fixture control: put back the round-3 P0 behaviour (401 treated as a message refusal) in memory and check that the plugin tests go red.
6. Two-way comparison: receipt numbers vs logs vs manifest; Codex finding list vs fix commits vs the next round's confirmation.

## Criteria

| # | Criterion (slice command) | Verdict | Evidence I observed |
|---|---|---|---|
| C1 | test, typecheck, build xanh, output in the receipt | **VERIFIED for test + typecheck (by re-run, partial); build and native NOT VERIFIABLE by me (logs consistent)** | My runs at `001d387` (no code diff: `git diff --stat HEAD -- src migrations tests bot-plugin package.json` empty): `python3 -m pytest tests/test_bot_bridge.py -q` → «66 passed, 69 subtests passed», exit 0. Focused PGlite: `intake, inbox-service, access-change, outbox, bridge-limits, bridge-io, inbox-http, inbox-ui, intake-schema, account-approval-dm` → «10 passed (10) · 190 passed, 2 skipped», exit 0 (the 2 skips are native-only). `npm run typecheck` exit 1 here only because of `.next/types/routes.d 2.ts` (iCloud duplicates, environment); `tsc --noEmit` with the same config minus `.next/** 2.ts` → exit 0. Logs: `vitest-native-001d387.log` tail «41 passed (41) · 506 passed (506)»; `vitest-pglite-001d387.log` «36 passed \| 5 skipped (41) · 485 passed \| 21 skipped (506)»; `coverage-001d387.log` 95.1 / 86.79 / 96.69 / 96.19 with thresholds 60 in `vitest.config.ts`; `pytest-001d387.log` «66 passed, 69 subtests passed»; `build-001d387.log` routes `/inbox` (l.44), `/api/inbox/[[...path]]` (l.30), `/api/bridge/[...path]` (l.26); `manifest.json` `rerunAfterFixRound4.codeHead` = `001d3873…`, every command `exit: 0`. All receipt numbers at `:72-79` match the logs. I did not run native or build (out of my permitted commands). |
| C2 | DOC-xx / SPEC-008 cases are automated and pass; negative-permission cases | **VERIFIED (spot-checked)** | DOC-01 `tests/intake.test.ts:56` (unknown and non-intake chat → `SCOPE_DENIED` 403, `allZero()`); DOC-03 `:87` (resend → one row, `replayed:true`; edit → revision 2; forward score 60, no `decided_by`); DOC-12 `tests/outbox.test.ts:83` + `test_bot_bridge.py:448`; PM-07 `tests/outbox.test.ts:56`, `tests/inbox-service.test.ts:197` (reopen keeps receipts and `delivered_at`), `inbox-ui` «PM-07 … Đã ghi, chưa gửi» (l.230); negative (2) `intake.test.ts:137` (tenant/project/actor/role in body → ZodError, nothing stored); negative (5) `inbox-service.test.ts:107` (no `work_items` change; bot create/close → `READ_ONLY` 403; no `create_work/assign/accept/close` transition). OQ-28: `intake.test.ts:189,198,207,216,226`. OQ-30: `intake.test.ts:260-293`, `inbox-service.test.ts:427,437` (stored text kept, Inbox shows `hidden`). OQ-27 / round 4: `intake.test.ts:598` `[A,A]` taken, `:606` `[A,A,B]` 409, `:612` two letter cases = one project. Ballot «one BoM»: `access-change.test.ts:72` (applies after one BoM, `required:'1bom'`), `:112` Chairman alone → pending, `:120` reject rules, `:135` registration still Chairman + one BoM. All of these files passed in my PGlite run. |
| C3 | UI: empty, error, loading, no-permission states; usable on a phone | **VERIFIED at code level; manual phone check is older than the current UI (see N5)** | `src/components/inbox.tsx:155` loading, `:159` error + «Thử lại», `:160` empty, `:41` hidden/pointer notice; `src/app/inbox/loading.tsx`, `error.tsx` exist; `tests/inbox-ui.test.tsx:73` four states, `:281` hidden. Manual 360px check recorded at `121d35a`/`2898def`/`2e37f17` (`docs/UI-HANDOFF-2-inbox.md:103`), before `1054222` changed `inbox.tsx`. |
| C4 | Receipt states the four levels separately | **VERIFIED** | Receipt `:5-10`: «Đã triển khai — Chưa», «Đã dùng thật — Chưa», «Đã nghiệm thu — Chưa», each with its reason. |
| C5 | No unhandled Codex P0/P1 | **VERIFIED in code (spot-checked); the Codex run itself is NOT independently verifiable (N7)** | `codex-round-5.md`: «VERDICT: PASS», no finding; head named in `codex-context-round-5.md` («Head: `001d3873…`»). Round 1 fixes in code: `src/server/outbox.ts:94` (delivered ⇔ `telegramMessageId`), `bot-plugin/__init__.py:1122-1141` (`_refusals`, accepted + replayed + rejected must equal the batch). Round 2: `src/server/request-body.ts:10-25` (streamed cap → 413), `bot-plugin/__init__.py:731-735,748-766` (`_stored_ack`). Round 3: `bot-plugin/__init__.py:186-219` (401/redirect/config → `channel`, kept), `:627-683` (drain buries, never drops), `:687-708` (unlocked dead-letter, 64 MiB cap); `src/server/intake.ts:30` `LATEST_REVISION_ORDER` with no `observed_at`, used at `src/server/inbox.ts:69,154`; mode per revision `intake.ts:69-71,88-93` + CHECK `migrations/016_intake_inbox.sql:73`. Round 4: `intake.ts:48` distinct lowercase ids, `src/server/bridge-config.ts` (commits `f6f4ead`, `001d387` touch `src/server/*` and tests, not only docs). Each round's file confirms the previous fixes (rounds 2, 3, 4, 5). |
| Control | A gate must fail when it should | **VERIFIED** | Scratch probe `…/scratchpad/control_probe.py` (outside the repo) loads `tests/test_bot_bridge.py`, runs three plugin loss tests: original «run 3 failures 0»; with `_failure_kind` changed so a 401 is `refused` (the round-3 P0 class) «run 3 failures 5». The tests bite. |

## Blocking items (receipt text)

**B1 — `:159` stale, and it contradicts the top row.**
Quote: «`liberico-reality-checker` **chưa chạy**. Lệnh lát gọi nó trước khi biên nhận ghi «đạt»; biên nhận này ghi «chưa đạt cổng Codex».»
The receipt now says «đạt cổng Codex ở vòng 5» (`:7`, `:174`). Correction: «`liberico-reality-checker` chạy ngày 14/11/2026 ở mã `001d387`: ⟨verdict⟩, báo cáo ở `.superpowers/sdd/slice-2-intake-outbox/reality-check-report.md` (ngoài repo, gitignored).» The same stale sentence is in the companion file `docs/reviews/REVIEW-slice-2-20261113.md:25` (non-blocking there, but fix both together).

**B2 — `:7` PR #10 does not carry the code that passed the gate.**
`gh pr view 10 --repo liberico-ai/ai-together` → `headRefOid 429adeb…`, `isDraft:true`, title «… (draft: Codex gate not passed)». `git rev-parse origin/slice-2-intake-outbox` = `429adeb`. The fixes `f6f4ead` and `001d387` are only local. Anyone who opens the PR the receipt names sees code that Codex round 4 rejected, under a title that says the gate failed. Correction (pick one): push the branch and update the PR title/body (push of this branch was approved by Chairman on 14/11: «Push + PR nháp ngay»; whether that covers a second push is the coordinator's call), or reword `:7` to say: «mã `001d387` ở nhánh cục bộ; PR #10 hiện ở `429adeb` (trước hai commit sửa vòng 4), chưa cập nhật».

## Non-blocking items

- **N1 `:167`** «Codex **chưa** review `8f181af`. Nếu Chairman cho vòng sửa thứ ba, Codex vòng 4 sẽ thấy cả commit này.» Now false in the present tense: `8f181af` is an ancestor of `6038014` (checked) and rounds 4–5 reviewed it. Suggest: «Codex vòng 4 (mã `6038014`) đã review cả commit này.»
- **N2 `:130`** «Hai test plugin đang khẳng định đúng hai hành vi mà Codex vòng 3 xếp P0 (`tests/test_bot_bridge.py:599-604` và `:1052-1072`).» Present tense in a historical section; those tests were rewritten (`:96`) and the line numbers now point to other tests. Suggest «Tại `2eb9437`, hai test plugin từng khẳng định …; đã viết lại ở vòng sửa thứ ba.»
- **N3 `:17` and `:62`** «không đường nào của plugin xoá tin tiếp nhận» / «tin nằm ở backend, spool hoặc tệp dead-letter» is slightly stronger than the code. The `disabled` class (intake key file missing or unsafe at POST time) returns a code and stores the live message nowhere: `bot-plugin/__init__.py:792-793`, docstring `:747`, and the test asserts it (`tests/test_bot_bridge.py:679,697`, `want=None` for live). Ruling `L342` in `controller-rulings.md` says «disabled class unchanged». In the hook it is reachable only if `intake.json` changes between `_intake_config` (`:832`) and `call_backend` (`:157`), so the risk is small. Suggest adding «trừ lớp `disabled` (khoá tiếp nhận bị gỡ hoặc sai quyền giữa lúc gọi hook): tin mới không được giữ, chỉ log mã (R3-5)», next to the existing note on `INTAKE_LOST` at `:233`.
- **N4 `:231`** «Hai phán quyết L240 và L241 …» reads like line numbers of this receipt (where `:240-241` are other gaps). Suggest «phán quyết `L240`, `L241` trong [controller-rulings.md](…)».
- **N5 `:175-193` (Giao diện).** The section does not say which commit was checked. Per `docs/UI-HANDOFF-2-inbox.md:103`, the check ran at `121d35a`/`2898def`/`2e37f17`, before `8f181af` (copy on `/team`), `1054222` (`inbox.tsx`, hidden state) and the later fixes. Gap 22 (`:246`) admits this for «ẩn» only. Suggest one line under the heading: «Kiểm ở `121d35a`/`2898def`/`2e37f17`; chưa kiểm lại sau `8f181af` và `1054222` (360px, `/team`, trạng thái «ẩn»).»
- **N6** `docs/reviews/REVIEW-slice-2-20261113.md:25` has the same stale reality-checker sentence as B1.
- **N7 Codex evidence depth.** `codex-round-5.md` holds only the final message (2 lines); the repo has no raw CLI transcript, session id or «tokens used» line, so the head binding and the figure «vòng 5 439 028» (`:286`) rest on `codex-context-round-5.md` and the coordinator. #hypothesis that round 5 ran on exactly `001d387`. Also, the context file sends Codex a long list of «không phải lỗi thiếu» items. It does say «thấy mục nào là P0/P1 thật thì vẫn báo», but this framing can bias a reviewer. Suggest saving the raw Codex log (redacted) next to the verdict file.
- **N8 Log binding.** The `*-001d387.log` files are untracked and contain no `git rev-parse`; the SHA comes only from `manifest.json`. `typecheck-001d387.log` has no exit line (the exit is only in the manifest). Also, in this worktree `npm run typecheck` currently fails on `.next/types/* 2.ts` duplicates (environment; the code typechecks clean). Suggest one sentence noting that a fresh checkout or deleting those duplicates is needed to reproduce.
- **N9 Coverage scope (`:75`).** The numbers come from a PGlite run (native-only cases skipped) over the TS server files in the `vitest.config.ts` include list. The Python plugin has no coverage figure. The receipt doesn't claim otherwise; state it so nobody reads 95% as covering the plugin.
- **N10** `docs/IMPLEMENTATION-ROADMAP.md` has no slice 2 status line (slice 1 has one at `:20`). Not a receipt defect; update it when the receipt is final.
- **N11 `:139`** «9 ca cũ `onboarding-feedback`» vs brief «Bảy ca hiện có». Merge base `ce11242` has 9 tests in that file, so the receipt's 9 is the observed count. Optional: say «brief ghi bảy; ở merge base có 9».

Checked and correct (no action): token sums `:284` 9 737 273, `:286` 2 130 686, `:288` 1 077 848 (= 569 710 + 426 056 + 82 082), per-row sums `:268-283`; SLO numbers at `001d387` (`:150`) match the native log; the four-level table; gaps 21–24 match the code I read.

## Not verifiable by me
- Native PostgreSQL suite (506) and `npm run build`: not run (container stopped on purpose; build not permitted). Logs and manifest agree.
- That Codex round 5 actually ran on `001d387` (N7).
- Real gateway behaviour, the real-group DOC-01, OQ-09 (1), SPEC-007 (c): outside this level, and the receipt says «chưa».

## What would change the verdict to READY
B1 and B2 fixed in the receipt (B2: push plus PR title/body update, or the reworded sentence). Nothing else is needed for «đã có mã». N1–N6 should go into the same edit.

---

## Re-check — 14/11/2026 (after the coordinator's edits)

Same read-only rules. Code unchanged: local and `origin/slice-2-intake-outbox` are both `001d3873…`; the working-tree changes are under `docs/` only (`DELIVERY-011`, `REVIEW-slice-2`, `IMPLEMENTATION-ROADMAP`, `manifest.json` plus untracked evidence files). So the code-level results from the first pass still apply (pytest 66/69, 10 PGlite files with 190 passed, typecheck clean, the mutation control red).

### Verdict: READY for «đã có mã» (only this level)
Blocking left: 0 · Non-blocking left: 3

### (1) B1 and B2
- **B1 — VERIFIED fixed.** The old sentence is gone. `DELIVERY-011:162` now reads «`liberico-reality-checker` chạy ngày 14/11/2026 … Lần đầu: NEEDS WORK, chỉ ở chữ của biên nhận (2 mục chặn, 11 mục không chặn); mã không cần sửa. Kiểm lại …: ⟨kết quả kiểm lại …⟩» (the placeholder is expected). `DELIVERY-011:7` says the same and matches my first report. `REVIEW-slice-2-20261113.md:25` (N6) is rewritten the same way, and its numbers (66 + 69, 190, 5 red under mutation) match what I observed.
- **B2 — VERIFIED fixed.** `gh pr view 10 --repo liberico-ai/ai-together` → `headRefOid 001d3873a71739147610ee4c4b4d1bebdc964728`, `title "feat(intake): slice 2 — Telegram intake, outbox, PM inbox"`, `isDraft true`, `baseRefName libetech-ai-os`. The body is rewritten: «Codex gate passed at round 5 … on code head `001d387`», four levels kept apart, «Do not merge without the Chairman's approval».

### (2) Receipt re-read — what is left
Checked as fixed: N1 (`:170` «Lúc đó Codex chưa review `8f181af`; Codex vòng 4 … và vòng 5 đã review cả commit này»), N2 (`:133` past tense), N3 (`:17`, `:63`, and the first bullet of gap 21 at `:238`, which states the `disabled` window correctly and matches `bot-plugin/__init__.py:792-793` and `tests/test_bot_bridge.py:679`), N4 (`:236` points to `controller-rulings.md`), N5 (`:181` names `121d35a`/`2898def`/`2e37f17` and what was not re-checked), N8 + N11 (`:82`), N9 (`:75`), N7 (transcripts present), N10 (roadmap P1.1 status added).

Left (non-blocking):
- **R1 — PR body, not the receipt, still says it without the exception in one place.** The WHAT bullet «Since fix round 3 no path deletes an intake message: it ends in the backend …, the spool, or the dead-letter file» has no `disabled` exception. The exception is stated further down under «Review findings». Suggest adding «(one exception: see Review findings)» to the WHAT bullet.
- **R2 — The PR points at evidence that is not pushed yet.** The PR body cites logs with suffix `-001d387`, Codex round 5 and the reality check, but `git ls-tree origin/slice-2-intake-outbox docs/reviews/slice-2-evidence-20261113/` has none of the `-001d387` logs, `codex-round-5*`, the transcripts or `reality-check.md` (all untracked). It resolves itself once the docs commit with the filled-in placeholders is pushed. Do that before the PR leaves draft.
- **R3 — `DELIVERY-011:174`** «Codex vòng 4 (mã `6038014`, vòng cuối)». Round 5 happened after it, so «vòng cuối» now reads wrong. Suggest «(khi đó dự định là vòng cuối)». Cosmetic.

No overstated claim left in the receipt that the code or tests contradict. The four levels are still separate, and the lower three still say «Chưa» (`:8-10`).

### (3) Did round 5 run on `001d387`? — CONFIRMED (with the usual caveat)
`codex-round-5-transcript.log`: header `model: gpt-6-sol`, `sandbox: read-only`, `session id: 01a1d855-…`. Codex's own `git rev-parse HEAD` printed `001d3873a71739147610ee4c4b4d1bebdc964728` (l.412 and l.775), and its `git status --short` showed only docs changes (l.395-407), so the code tree was clean. It read the fixed code itself: `nl -ba src/server/bridge-config.ts … src/server/intake.ts` (l.980), `intake.ts:39-69` (l.1551), and the `[A,A]` and letter-case tests (l.1653, l.2781). The verdict is «VERDICT: PASS» and «tokens used 439,028», which matches the receipt `:292`. `codex-context-round-5.md` pins the same head. Caveat: the transcript is a trimmed, redacted copy made by the coordinator, so I trust that it is faithful; nothing in it is inconsistent with the repo.

### What would change this verdict
A code change after `001d387`, or the placeholders being filled with anything other than this re-check's result. Merge, deployment, real use and acceptance stay separate Chairman decisions; this verdict says nothing about them.
