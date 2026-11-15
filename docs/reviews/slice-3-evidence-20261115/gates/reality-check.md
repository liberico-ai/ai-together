VERDICT: READY

# Reality check — slice 3 receipt (`docs/DELIVERY-012-review-skills-20261115.md`, draft, uncommitted)

- Checker: `liberico-reality-checker` (advisory; acceptance authority stays with the Chairman). Not the maker of this slice.
- Tree: branch `slice-3-review-skills`, HEAD `3eee1c5`, code head `ee990b4`, base `ec3b5e7`. Observed 2026-11-15.
- Level checked: «đã có mã» only, as the receipt words it, including its statement about the Codex verdict.
- Summary: the code-level claim is carried by the evidence. Every acceptance case I re-ran is green; my mutation went red; the Codex paragraph is honest (CHANGES_REQUIRED, one P2 open, never called PASS); no level beyond «đã có mã» is claimed. Two receipt defects block: a disclosure that a reviewer marked mandatory is missing, and one Chairman-decision pointer names a file that does not hold the quote. Both are wording fixes; no code change and no new run is needed.

## Blocking

**B1 — Missing mandatory disclosure: the operational (superuser) login bypasses RLS and four of the new guards.**
- Receipt lines: «Khoảng trống phải biết» items 7, 14, 33. They say a superuser can disable triggers, that only a superuser can become `libetech_ai`, and that the runtime role can set `app.person_id`. None says that the operational login, which is a superuser, bypasses RLS, the designation guard, the revoke-manager check and both approved-pointer guards, and that it does not bypass the decision guards.
- Evidence: `gates/tier1-database.md` §4 note (a): «The operational login is a superuser and bypasses RLS and three guards by design (S7, S34, S61). The receipt must say so.» The same file's «For the receipt» has a «Superuser bypass» bullet listing the bypassed guards and the decision guards it does not bypass. `migrations/020_document_review.sql:5` and `migrations/021_ai_suggestions_z4.sql:6` carry the same note. A grep of the receipt for «superuser», «vận hành», «bỏ qua», «BYPASS» finds no such statement (hits only at lines 140, 185, 188).
- Fix: add one item, for example under «Review, uỷ quyền, quyền duyệt»: «Login vận hành là superuser: nó vượt RLS, guard chỉ định người nhận xét, kiểm "điều phối mới thu hồi được" và hai guard con trỏ bản chuẩn; nó không vượt các guard của quyết định review (tier1-database §4 (a), «For the receipt»).»

**B2 — One Chairman-decision record points at the wrong file.**
- Receipt line 19: «Câu hỏi và đủ các phương án Chairman thấy chép nguyên văn ở `docs/OPEN-QUESTIONS.md`». Line 20 then quotes the ordering decision: «Giữ việc tách luật hiển thị làm task đầu của lát 3 chứ?» / «Giữ task đầu».
- Evidence: `grep -cF` of both strings in `docs/OPEN-QUESTIONS.md` gives 0 and 0. Both are verbatim in `docs/plans/slice-3-review-skills.md:23`, `:285`, `:1349`, together with the second button «PR riêng trước». The other fifteen labels (OQ-31…OQ-42, Task 7c, «Giữ cả hai (Recommended)») are verbatim in `docs/OPEN-QUESTIONS.md` (2–3 hits each). The quote is genuine. Only the pointer is false, and it is a pointer to the record of a Chairman decision.
- Fix: change line 19 to say that the ordering question and its two buttons are recorded in `docs/plans/slice-3-review-skills.md:23`, and that the OQ-31…OQ-42 and Task 7c questions are in `docs/OPEN-QUESTIONS.md`. The alternative is to copy the ordering question into `docs/OPEN-QUESTIONS.md`, but that is a new record, not a correction.

## Non-blocking

- **N1 — Broken markup and a duplicated sentence in the most-read cell.** Line 7 opens with `****Đạt điều kiện…` and closes with `…ba mức dưới đều **chưa****`. Once `@@REALITY-MUC@@` is filled, the bold will not render as intended. The cell's last sentence repeats line 12 word for word. Fix: balance the `**` and drop one of the two sentences.
- **N2 — «Mọi lệnh có mã thoát 0» (line 57) is not literally true.** `manifest.json` entry `absent-7c` has `"exit": 1`. That is the expected result: `ls` finds neither path. Fix: «mọi lệnh mã thoát 0, trừ phép `ls` kiểm vắng mặt của Task 7c (mã 1 là kết quả mong đợi)».
- **N3 — The coverage row is accurate but reads as complete.**
  - `vitest.config.ts` includes 13 slice modules. Three new server modules of the slice are not measured: `src/server/text-safety.ts` (part of the output gate), `list-cut.ts` and `review-page.ts` (`git diff --name-status ec3b5e7 ee990b4 -- src/server`).
  - `logs/coverage-ee990b4.log` prints only 9 of the 13. The other four (`access-grants`, `source-text`, `ai-scope`, `decisions`) are absent because Vitest 5 sets `skipFull: true` for the text reporter when run by an agent (`node_modules/vitest/dist/chunks/index.*.js`, the comment beside `skipFull: true`). They are therefore at 100 % (#inference). The claim «thấp nhất: document-commands 85,71 / 75» holds on that reading.
  - Fix: name the three unmeasured modules and the `skipFull` reason.
- **N4 — The no-network evidence is narrower than the sentence.** `task-18-static-checks.txt` greps 5 files. The eval test (`tests/skills-eval.test.ts:198`) stubs only `fetch`. I extended the grep to `text-safety.ts`, `source-text.ts` and `skills/`, adding `node:http|https|net|undici` imports: empty. Fix: widen the recorded grep, or say «fetch bị thay; không import mô-đun mạng (grep)».
- **N5 — The UI hand check has no artifact.**
  - The receipt does not count it toward any level, but its details (three viewport sizes, «mọi yêu cầu 200, trừ một 422») are session-reported. No screenshot or server log is in the evidence folder.
  - The two hand-offs still show `- [ ] 360×740` / `- [ ] 1280×800` unchecked (`UI-HANDOFF-3-review.md:111-112`, `UI-HANDOFF-3-decisions.md:93-94`). The receipt says those sizes were checked.
  - Fix: «phiên tự báo, không lưu ảnh chụp hay log», plus a note on the open checkboxes.
- **N6 — «Không lượt nào có mục nghiêm trọng» (line 100) cannot be checked for Task 1 and Tasks 2–3.** Their reports are «ngoài thư mục `gates/`» (REVIEW table rows 1–2). Every report that is in `gates/` shows Critical: None. Fix: add «(Task 1, 2–3: báo cáo không nằm trong repo)».
- **N7 — Minor reviewer asks the receipt does not carry.**
  - `tier1-security.md`, 12 M12-4: a dedupe conflict tells the pipeline that a key exists elsewhere in the tenant, «must be decided before Z4 is switched on».
  - `review-task-10-12-security.md`, «For the receipt»: `SuggestionService` must be built with the live intake's `excerptChats`, otherwise every excerpt-backed draft is held.
  - `tier1-database.md`: 5 M-2 (author or writer follow-ups do not re-read membership) and 7a M6 (replay after an eligibility change).
  - None changes the level. Fix: one line each under «Kỹ năng, eval và Z4» and «Review, uỷ quyền».
- **N8 — The P2 threshold wording.** Line 108 says «trên 1 000 dòng "ngủ" xếp trước». The code (`review-delegations.ts:110-115`) fetches 1001 and keeps 1000, so 1000 dormant rows ahead of a live row already hide it. The same cut sets `reviewersTruncated`, so the screen shows the «đã cắt» sentence rather than only «chưa có ai». Fix (optional): «từ 1 000 dòng», and mention the flag.

## Verified (supported)

| Claim | How checked | Result |
|---|---|---|
| Four levels, only «đã có mã» claimed; deployed/used/accepted all «Chưa» | read lines 5–12; roadmap block | supported |
| Codex: round 1 2 P1 + 1 P2; round 2 2 P1 + 1 P2; round 3 first line `VERDICT: CHANGES_REQUIRED`, 0 P0, 0 P1, 1 P2 at `review-delegations.ts:111` | counted `- [Px]` lines in `codex-round-{1,2,3}.md`; heads in `codex-context-round-*.md` | supported; receipt never says PASS (lines 7, 108–109; REVIEW row 3; roadmap) |
| P2 not fixed; the fix-or-accept decision is put to the Chairman, not taken | code at `review-delegations.ts:104-127` unchanged since `ee990b4`; `git diff --stat ee990b4 3eee1c5` = two docs files only | supported |
| Gate conditions: «no P0/P1 left», max two fix rounds | `docs/HANDOFF-CLAUDE-CODE-20261111.md:85`, `:114`; `.claude/commands/slice.md:32`, `:40` | supported |
| 3eee1c5 is docs-only, so a native run on that tree equals `ee990b4` code | `git diff --stat ee990b4 3eee1c5`: `codex-context-round-3.md`, `codex-round-3.md` | supported |
| PGlite 966 passed / 41 skipped, 58+10 files | `logs/vitest-pglite-ee990b4.log` summary | supported |
| Native 1007 passed, 0 skipped, 68 files | `logs/vitest-native-ee990b4.log`: summary; 1007 `✓`, 0 `×`, 0 `↓` lines | supported |
| Coverage 96.04 / 90.84 / 97.71 / 97.26 | `logs/coverage-ee990b4.log` «All files» | supported (see N3) |
| pytest 67 passed | log, and my own run | supported |
| typecheck clean | log (no output after `tsc --noEmit`), and my own run, exit 0 | supported |
| build: five routes present, compiled | `logs/build-ee990b4.log` | supported by log (not re-run, per instruction) |
| AI principal: 0 write and 0 read rows on `public`/`identity`/`analytics`; only SELECT + INSERT on `intelligence.ai_drafts` | `task-18-ai-privileges.txt`; `tests/z4-schema.test.ts:84-98` uses `has_table_privilege`/`has_any_column_privilege` (inherited and PUBLIC grants count); the only schemas are those four (`CREATE SCHEMA` grep); `draft_decisions` is in `public`; «no SECURITY DEFINER executable by libetech_ai» test | supported; I re-ran the privilege-query and (4) tests on PGlite: green |
| Case table: DOC-05/06/08/09/15, PM-05, PM-06, seven negative cases, T06/T07/T15/T17/T18, A04–A06, eval | `task-18-case-table.md` against brief `docs/SLICE-BRIEFS.md:195-213`; native log names; my PGlite run | supported; both brief concurrency tests (`two third votes…`, `two approvals of the same revision in parallel…`) are `✓` in the native log |
| PM-02 not counted as passed | receipt line 85, case table, roadmap | supported |
| Eval line `{"skills_eval":{"skills":6,"cases":30,"good_pass":30,"bad_caught":30,"model":"none (mock outputs)"}}` | my run with `--reporter=verbose` printed it verbatim | supported |
| Six manifests: name, version, hash, `toolAllowlist: []`, `dataScope`, owner, `modelBinding: none`, `enabled: false`; five categories each | parsed all six `skills/*/manifest.json`; recomputed SHA-256 of each `prompt.md` and `eval.json`; all 12 match; each eval has the five required categories once | supported |
| `foundation`, `spec004`, `AGENTS.md`, `CLAUDE.md`, `bot-plugin/`, `account-approval.ts`, migrations 001–018 unchanged; no migration touches `evidence` | `task-18-static-checks.txt`; I read the diff list of pre-existing tests | supported |
| Pre-existing tests changed only in setup, not in assertions | `git diff ec3b5e7 HEAD` of `documents`, `fix-wave-db`, `migrations-rollback`, `outbox-schema`, `slice2-fixtures`, `test_bot_bridge.py`: removed lines are setup or helper moves only, no removed `expect` | supported (`test_bot_bridge.py` gained one case; plugin code unchanged) |
| Task 7c, 16b, Task 14 not half-present | no changed file under `src` matches doc-approval/proposal/telegram/team; no `docApprovalProposal`/`proposeDocApproval` identifiers; `src/app` diff lists only review/decisions routes; `bot-plugin/` diff empty | supported |
| OQ-43…OQ-46 exist at `:625`, `:634`, `:647`, `:663` and are undecided | read `docs/OPEN-QUESTIONS.md:625-672`: each carries «Hành vi hiện tại (không phải phương án được chọn)» | supported |
| Chairman labels OQ-31…OQ-42 and Task 7c verbatim, no ellipsis | `grep -cF` of each label in `docs/OPEN-QUESTIONS.md` | supported (exception: B2) |
| `AGENTS.md:11` is the Z4 line, left for the Chairman | read `AGENTS.md` | supported |
| Session rulings labelled as such, not as Chairman decisions | «Phán quyết của phiên lát 3 (không phải quyết định của Chairman)»; «Cách hiểu chờ Chairman xác nhận» | supported |
| Required documents exist | `ls` of plan, both UI hand-offs, receipt, review summary; roadmap block present | supported |
| No tracked `.env`, `data/`, `node_modules`, `coverage`, `.next`, `tsconfig.tsbuildinfo`, `tests/__pycache__` | `git ls-files` filter: empty | supported |
| No personal names or absolute home paths in the new docs | grep of receipt, review summary, `controller-rulings.md`, roadmap diff, new logs | supported (hits were regex literals in test code quoted by the receipt) |

## What I ran

| Command | Result |
|---|---|
| `npx vitest run --reporter=verbose` on 12 files (`document-review`, `slice3-bom-events`, `suggestions`, `z4-schema`, `skill-contracts`, `skills-eval`, `skill-context`, `decisions`, `decisions-ui.test.tsx`, `spec004`, `foundation`, `review-delegations`), PGlite | exit 0; 12 files passed; 314 passed, 3 skipped (all three native-only blocks); eval JSON line as quoted |
| `npm run typecheck` | exit 0 |
| `python3 -m pytest tests/test_bot_bridge.py -q` | `67 passed, 69 subtests passed` |
| Read-only `git` (`log`, `diff`, `diff --stat`, `ls-files`, `hash-object`, `status`) and `grep` over docs, migrations, tests, skills | as cited above |
| SHA-256 recomputation of six prompts and six eval sets | 12 of 12 match their manifests |
| Not run, per instruction | native suite, `npm run build`, coverage, any server |

## Mutation

- Change: `src/server/document-review.ts`, in `decide`, commented out `if (rev.proposed_by === me) throw notAuthorized();` (the service-level author check of DOC-08 / negative case (1)).
- Run: `npx vitest run --reporter=verbose tests/document-review.test.ts` → exit 1. Two failed, 30 passed:
  - `(1) DOC-08 the author cannot decide the own revision…`
  - `a failed decision leaves no decision, no event and no version change`
- Received: the database guard still refused the author («The author of a revision does not …»), but with a different error than the expected `APPROVER_NOT_AUTHORIZED`. Two layers hold, and the test pins the service layer.
- Revert: `git checkout -- src/server/document-review.ts`. `git hash-object` equals the value saved before the edit. `git status --short` again shows only the five modified documentation and evidence files and the ten untracked documentation and log files it showed before the run. No source file differs.

## What would change the verdict

Fix B1 and B2 in the receipt text. With those two lines corrected, and the markers filled as planned, the level «đã có mã» as worded, including «Codex verdict CHANGES_REQUIRED, one P2 open, not PASS», is READY from this check. N1–N8 are recommended, not required.

## Re-check after the receipt corrections

- Scope: a narrow re-read of the changed text against the first report. I did not re-run any suite.
- Verdict for «đã có mã» as the receipt now words it: **READY**. This is a recommendation. Acceptance stays with the Chairman.
- The first report above is kept as written. Its first line was NEEDS WORK and is now replaced by the verdict that holds.

### Wording-only change confirmed

- `git diff --stat ee990b4 HEAD -- src tests migrations skills`: empty.
- `git diff --stat -- src tests migrations skills` (working tree): empty.
- `git status --short`: modified files are only docs, evidence text and the two UI hand-offs. Untracked files are only the receipt, the review summary, `controller-rulings.md`, this report and the six `*-ee990b4.log` files.

### Per item

| Item | State | What I read |
|---|---|---|
| B1 | **fixed** | Item 40, under a new last sub-heading «Thêm sau lượt soát của `liberico-reality-checker`». It lists what the operational superuser login bypasses: RLS, the designation guard, the revoke-manager check, both pointer guards (approved and latest) and the flag-direction check. It also says the login does **not** bypass the review-decision or draft-decision guards; that superusers can disable triggers and `TRUNCATE` history tables; and that the runtime login is refused at start if it is a superuser or has BYPASSRLS. This matches `tier1-database.md:202-203`, `:271` and `:388`, and `migrations/021_ai_suggestions_z4.sql:6` (the operational login is «still stopped by draft_decisions_guard»). Because the item was appended, items 12, 22 and 39 keep their numbers. |
| B2 | **fixed** | Line 19 now says the ordering question and its two buttons «Giữ task đầu» / «PR riêng trước» are at `docs/plans/slice-3-review-skills.md:23`, and that OQ-31…OQ-42 and the Task 7c question are in `docs/OPEN-QUESTIONS.md`. Both places hold the quoted text (first-report check). |
| N1 | **fixed** | Line 7: 12 `**` markers, so the bold is balanced. The cell no longer contains «Mức này chỉ nói…»; line 12 keeps that sentence once. |
| N2 | **fixed** | Line 57 adds the `ls` exception for Task 7c: exit code 1, which is the expected result. |
| N3 | **fixed** | The coverage row names `text-safety.ts`, `list-cut.ts` and `review-page.ts` as not measured. It explains `skipFull` and that the four hidden modules are *inferred* to be at 100 %. |
| N4 | **fixed** | The static-check row records the widened grep as this checker's, kept in this file and not in the manifest. The eval paragraph says the `fetch` stub plus the grep is a check on the code, not a run in an environment with the network cut. |
| N5 | **fixed** | The first paragraph of «Giao diện» says the hand check is session-reported, that no screenshot or server log was saved, and that it counts toward no level. In the hand-offs: review ticks build, the denied view, and 1280/949; decisions ticks build and script-as-text; each has a sentence naming what was only partly checked. The ticks are consistent with the receipt's «Đã kiểm» list. The build tick is also backed by `logs/build-ee990b4.log`. |
| N6 | **fixed** | The tier-1 bullet says that for Task 1 and Tasks 2–3 the claim rests on the session's ledger, because those reports are not in the repo. |
| N7 | **fixed** | Item 41 matches `tier1-security.md`, 12 M12-4, «decide before Z4». Item 42 is the `excerptChats` requirement. Its claim «no code outside tests builds the service» holds: `grep -rn "new SuggestionService" src` gives 0 lines, and the only file under `src` that names `SuggestionService` is its own module, `src/server/suggestions.ts`. Item 43 matches Task 5 M-2 (`review-task-5.md:106`) and Task 7a M6 (`review-task-7a-security.md:69`, `DELEGATION_INVALID` on replay). |
| N8 | **fixed** | The round-3 bullet, item 39 and the REVIEW round-3 row now say: 1 001 rows are fetched and 1 000 kept; the cut starts «từ 1 000 dòng»; the same cut sets `reviewersTruncated`, and the screen shows «Danh sách dài hơn phần đang hiện.» That string exists as `TRUNCATED_COPY` in `src/components/review-view.ts:28`. Item 25 now reads «từ 1 000 dòng». |

### New defects introduced by the corrections

None that blocks. One precision note, optional:
- Item 39, the round-3 bullet and the REVIEW row explain what sits ahead in the cap as «dòng của chính người xem cộng các dòng "ngủ" của người khác».
- In the code, other people's live rows with a lower `delegate_id` also count toward the 1 000 (`review-delegations.ts:111-115`). They are shown, so they hide nothing themselves, but they move the point where a later live row drops out.
- Item 25 also counts only dormant rows.
- The level is not affected.

### The planned marker sentences

- `@@REALITY-MUC@@`: true as planned. The first pass was NEEDS WORK with two blocking wording items (the missing operational-login note; one pointer to the wrong file). Both are fixed, and the re-check is READY for «đã có mã» as worded.
- `@@REALITY-NOTE@@` and `@@REALITY@@`: correct if they say the following:
  - first pass: NEEDS WORK, 2 blocking and 8 non-blocking, all wording;
  - second pass: READY, all 10 fixed, no new blocking item;
  - the reviewer did not re-run the suites in the second pass. In the first pass it ran 12 PGlite files, typecheck and pytest, plus one reverted mutation.

  Do not write that the reality checker ran the native suite, the build or coverage. It ran none of them.
- `@@PR@@`: «mở ngay sau khi push; số PR ghi ở commit tài liệu kế tiếp» is a statement about the future. It is true only if the PR is in fact opened right after the push and recorded in the next docs commit. No overstatement as long as that happens.
- All four markers must be gone before the commit: `grep -n "@@" docs/DELIVERY-012-review-skills-20261115.md docs/reviews/REVIEW-slice-3-20261115.md docs/IMPLEMENTATION-ROADMAP.md` should return nothing.

### What I ran (re-check)

- `git status --short`
- `git diff --stat ee990b4 HEAD -- src tests migrations skills`
- `git diff --stat -- src tests migrations skills`
- `git diff` of the two UI hand-offs
- reads of the changed receipt and REVIEW lines
- a count of `**` on line 7
- `grep` for «Mức này chỉ nói», `new SuggestionService`, `SuggestionService`, `TRUNCATED_COPY`/«Danh sách dài hơn phần đang hiện.»
- reads of `tier1-database.md:198-205`, `:271`, `:388`, `review-task-7a-security.md:69`, `review-task-5.md:106` and `migrations/021_ai_suggestions_z4.sql:6`

No test, build or server was run, and no file other than this report was changed.
