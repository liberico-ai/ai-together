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

## Third pass — after the extra fix round and Codex round 4

- Scope: a read-only check of the rewritten receipt, review summary and roadmap against the files that prove them.
- State: HEAD `2654abf` (docs), code head `007cded`.
- Not run: any suite, the build, a server, a container, an `EXPLAIN`. Every number below is read from a log or an evidence file.
- Verdict for «đã có mã» as the receipt now words it: **READY**. This is a recommendation; acceptance stays with the Chairman.

### Claims 1–8

| # | Claim | Result | What I read |
|---|---|---|---|
| 1 | Codex round 4 PASS at the code the gate read; round 3 still CHANGES_REQUIRED with one P2 | **supported** | `codex-round-4.md` line 1 is `VERDICT: PASS`, followed by «Không có finding.» and no finding line. `codex-context-round-4.md:8` pins head `2654abf5…`, base `ec3b5e7` (`:7`). `git diff --stat 007cded 2654abf -- src tests migrations skills bot-plugin vitest.config.ts package.json` is empty, and so is the working tree for those paths. The receipt says PASS only for round 4 (level cell line 7; «Tầng 2» bullet «Vòng 4»). The receipt (line 111) and the REVIEW round-3 row (line 49) keep round 3 as `CHANGES_REQUIRED`, 1 P2 · 0 P0 · 0 P1. |
| 2 | The Chairman's P2 decision is quoted the same way in both records and adds nothing | **supported** (only that the records agree; whether the Chairman said it cannot be checked here) | Receipt «Căn cứ và quyết định» line 30 and REVIEW row 3 give the same question «Sửa mục P2 của Codex vòng 3 rồi chạy cổng thêm một lượt chứ?», the same two buttons «Sửa P2, chạy lại» / «Giữ nguyên», the same answer «Sửa P2, chạy lại», and the same place (the slice session's next-step box). `controller-rulings.md:70` matches. The receipt labels «một vòng sửa và một lượt chạy cổng» as the session's reading («Phiên lát 3 hiểu…»). REVIEW calls it «vòng sửa thêm, ngoài hai vòng của quy trình», and its round-4 row says «Lượt chạy thêm theo lời Chairman». No added wording. |
| 3 | Numbers at `007cded` | **supported** | `logs/vitest-pglite-007cded.log`: 58 passed, 10 skipped; 973 passed, 41 skipped (1014). `logs/vitest-native-007cded.log`: 68 files, 1014 passed, 1014 `✓`, 0 `×`. `logs/coverage-007cded.log` «All files»: 96.17 / 91.04 / 97.71 / 97.39. pytest: `67 passed, 69 subtests passed`. typecheck: `tsc --noEmit`, no output. build: «Compiled successfully» and the five routes. `manifest.json`: `codeHead` `007cded…`, `headAtRun` `2654abf`; every exit is 0 except `absent-7c` = 1, by design. `previousRun` keeps `ee990b4` and, nested inside it, `2a267c5`. The receipt table (lines 59-72) and roadmap line 35 carry the same numbers. The case table and both `task-18-*.txt` files are re-stamped at `007cded`. The eval JSON line in the native log is unchanged. |
| 4 | The fix as described (item 39, «Vòng sửa thêm» bullet) | **supported** | `git diff ee990b4 007cded -- src/server/review-delegations.ts`: only the non-coordinator SQL changes. Another person's row is fetched only when `revoked_at IS NULL` and its `delegate_id` is in one `bom_eligible_members` call with `project_role = ANY($3)`, before `LIMIT 1001`; the docstring names both lines. Seven cases G-1…G-7 (`tests/review-delegations.test.ts:617-674`) are `✓` in both 007cded logs. `codex-fix3-mutation.txt` reruns m1 (G-1, G-2, G-5, G-6 red), m2 (G-6 red) and m3 (G-4 red) on the final test file. m4 is honestly marked «not a mutation» (the rule lives in migration 006, guarded by G-7). This matches «ba phép đột biến đều đỏ». In `codex-fix3-query-plan.txt` the outer scan visits 300 rows (`Rows Removed by Filter: 300`), and «hashed SubPlan 2» holds one «Function Scan on bom_eligible_members» with `loops=1`; InitPlan 1 also runs once. The receipt's «một lần cho mỗi câu lệnh… 300 dòng, chưa xem ở khối lượng lớn hơn» is accurate. |
| 5 | The two tier-1 passes of this round | **supported** | `gates/tier1-code.md`, last section: `VERDICT: CLEAN`, N1 P2 + N2–N5 P3, «neighbouring issues… not the exact class», nothing fixed. `gates/review-task-7d-security.md`, last section: `VERDICT: READY`, P3-1…P3-3, «No P0, P1 or P2». The receipt «Tầng 1» bullet and REVIEW line 36 state that the `007cded` follow-up had no tier-1 reviewer of its own («phiên lát 3 đọc diff, rồi cổng Codex đọc»). It is stated, not hidden. |
| 6 | Items 44–48 against the sweep's N1–N5 | **supported** | 44 = N1, with «(reviewer xếp P2)», the scenario and the two-line fix. 45 = N2: oldest kept, newest cut, the button is offered and then refused. 46 = N3 (50, no «còn nữa»). 47 = N4 (unstable paging, total correct). 48 = N5 (no cut marker). The sub-heading says «ghi nhận, không sửa». Nothing is softened. Item 25 now names the uncapped-flag fourth list (N1's note on item 25) and describes the reviewer-list flag after the fix. |
| 7 | Nothing above «đã có mã» | **supported** | Deployed, used and accepted are still «Chưa» (lines 8-10). PM-02 is «Không coi đạt» (line 87). OQ-45 and OQ-46 are under «Chưa quyết» and «Câu hỏi mở chưa quyết»; their pointers `:661` and `:677` match the headings in `docs/OPEN-QUESTIONS.md`. OQ-43 and OQ-44 read (a)/(a). Both labels are verbatim in `docs/OPEN-QUESTIONS.md`, with the question and both options (added in `b8f5a99`). The «Ghi chú của phiên điều phối» lines there are marked as not the Chairman's. |
| 8 | Leftovers of the earlier state | **none found** | Grepped the three documents for `ee990b4`, `1007`, `966`, `97,26`, «chưa sửa», «chờ Chairman», «còn mở». `ee990b4` survives only in historical contexts (round-2 fix, round-3 head, the growth line «ee990b4 … 1007», the reality-checker's earlier pass). «Lúc đó chưa sửa» (receipt :111, REVIEW :49) is explicitly past. The ruling at receipt :260 is annotated «về sau Chairman chọn "Sửa P2, chạy lại"». Item 39 now reads «đã sửa». The roadmap's «Chờ Chairman» (line 39) no longer lists the P2. Roadmap line 30 is the slice-2 block. |

### Blocking

None.

### Non-blocking

- **T1 — Coverage changed engine between runs, and the receipt calls the cause unknown.** `logs/coverage-007cded.log` ran the native suite («68 passed (68)», 1014 tests). `logs/coverage-ee990b4.log` ran on PGlite («58 passed | 10 skipped»). The native-only concurrency tests explain `bom.ts` (98.09 → 100 lines) and `document-review.ts` (98.81 → 99.4) going up without code changes. The receipt says «nguyên nhân chưa điều tra». `manifest.json` records the command as plain `npx vitest run --coverage`, without the environment file the run evidently loaded. Suggested wording: «lượt coverage ở `007cded` chạy trên PostgreSQL thật (68 tệp), lượt ở `ee990b4` trên PGlite; các ca chỉ chạy native giải thích phần nhích lên». Record the engine in the manifest's coverage entry.
- **T2 — The query plan was taken as the operational login.** `codex-fix3-query-plan.txt` says «as the operator login». That is a superuser, so RLS on the inner `review_delegations d` read does not apply. The plan under `libetech_runtime` adds the RLS filter, and its shape could differ. Item 39 (c) should add «chạy bằng login vận hành (RLS không áp)».
- **T3 — The record of the P2 decision lives outside `docs/OPEN-QUESTIONS.md`.** The receipt, REVIEW and `controller-rulings.md:70` agree, and the receipt never claims otherwise. The committed message of `b8f5a99` («record … and on the Codex round-3 P2») could be read as saying `OPEN-QUESTIONS.md` holds it; it does not. Nothing to change in the uncommitted files. A reader should not look there.
- **T4 — The round-4 prompt context gave Codex stale run numbers.** `codex-context-round-4.md:32` gives Codex the `ee990b4` full-run numbers as the latest. This does not affect the verdict (Codex reads code, not counts). Noted so nobody cites that file for `007cded` numbers.

### The planned sentences

- `@@RC@@`: true as written. Each pass matches the record:
  - first pass NEEDS WORK, two blocking wording items, fixed;
  - second pass READY at `ee990b4` (HEAD was `3eee1c5`);
  - third pass READY after the extra round and Codex round 4, read-only, with no tests run.
- `@@RC-ROW@@` and the extra sentence in the «Tầng 1» reality-checker bullet: correct if they say the same, and add that the third pass found 0 blocking and 4 non-blocking items (T1–T4).
- They must not say the third pass ran tests or the build, or looked at a query plan itself. It did none of those.
- Before the commit, `grep -n "@@"` over the receipt, REVIEW and roadmap must return nothing.

### What I ran (third pass)

- `git log`, `git status --short`.
- `git diff --stat 007cded 2654abf -- src tests migrations skills bot-plugin vitest.config.ts package.json`, plus the working tree for the same paths.
- `git diff ee990b4 007cded -- src/server/review-delegations.ts` and `git diff --stat ee990b4 007cded`; `git show b8f5a99` (message and `OPEN-QUESTIONS.md` diff).
- `python3` parse of `manifest.json`; summary lines of the six `*-007cded.log` files and the two coverage logs.
- Reads of:
  - `codex-round-4.md`, `codex-context-round-4.md`;
  - `codex-fix3-mutation.txt`, `codex-fix3-query-plan.txt`;
  - the last sections of `tier1-code.md` and `review-task-7d-security.md`;
  - `controller-rulings.md:70`;
  - the changed receipt, REVIEW and roadmap lines.
- `grep` for the verbatim labels across the four documents, for G-1…G-7 in the test file and logs, and for leftovers.
- No other file changed.
