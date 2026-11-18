# Soát thực tế biên nhận DELIVERY-015 (OQ-45, OQ-46) · 18/11/2026

- Người soát: `liberico-reality-checker` (soát độc lập; không phải người làm; chỉ đề xuất, quyền chấp nhận thuộc Chairman).
- Thứ được soát: `docs/DELIVERY-015-ai-drafts-read-and-stale-20261118.md` (chưa theo dõi, 474 dòng) và `docs/IMPLEMENTATION-ROADMAP.md:53-63`, trên nhánh `feat/oq-45-46-ai-drafts`, HEAD `b8c70df`, gốc `4f12a3c`.
- Nhãn giữ chỗ ⟦PR⟧, ⟦CODE-STATUS⟧, ⟦REALITY⟧ là cố ý, không tính là lỗi.
- Cách soát: chỉ lệnh đọc (`git`, `grep`, `wc`, `node -e`) và một lần `npm run typecheck` ở HEAD `b8c70df` (mã thoát 0). Không chạy vitest, không chạm Docker, không đọc biến môi trường.
- Các phép thử đã định trước khi chạy: (1) so từng con số với log; (2) so thời điểm log với thời điểm commit (log không mang commit); (3) chèn lỗi ngược: tìm hành vi mã có mà biên nhận không nói, hoặc biên nhận nói mà mã không có; (4) đối chứng: một khẳng định mà nếu sai thì phép soát phải bắt được (dòng `dupes:` trong log — bắt được, xem lỗi L1).

## 1. Bảng khẳng định đã soát

| # | Khẳng định của biên nhận | Kết quả | Bằng chứng |
|---|---|---|---|
| 1 | Typecheck ở `9b0f83f` mã thoát 0 | đúng (log) | `head-9b0f83f-typecheck.txt`: `EXIT=0`; lần chạy của người soát ở `b8c70df` cũng thoát 0 |
| 2 | PGlite: 66 tệp đạt / 12 bỏ qua; 1 220 đạt / 79 bỏ qua (1 299) | đúng | `head-9b0f83f-coverage.txt:6-7` |
| 3 | Phủ mọi tệp 96,35 · 91,68 · 98,06 · 97,61; `suggestions.ts` 97,61 · 96,47 · 100 · 99,42, dòng 346 không phủ | đúng | `head-9b0f83f-coverage.txt:15`, `:50`; `src/server/suggestions.ts:346` là `throw e;` của lệnh chèn quyết định |
| 4 | Lượt coverage là lượt «ở đầu nhánh» `9b0f83f` | **không chứng minh được** | `Start at 15:50:45` (`head-9b0f83f-coverage.txt:8`) — sau `d9b0974` (15:50:23), **trước** `9b0f83f` (15:52:58). Lỗi L2 |
| 5 | PostgreSQL 16: 78 tệp, 1 299 đạt, 0 bỏ qua, không `timed out`, không `40P01` | đúng | `head-9b0f83f-native-verbose.txt:1731-1732`; `grep -c 'timed out'` = 0, `grep -c 40P01` = 0 |
| 6 | Lượt PostgreSQL 16 thuộc mã ở `9b0f83f` | đúng theo nội dung | log mang tên ca V2 mới của `9b0f83f` (1 lần), không mang tên cũ; bắt đầu 16:01:02, sau mọi commit mã |
| 7 | Build mã thoát 0 | đúng (log) | `head-9b0f83f-build.txt`: `EXIT=0`; log không mang commit, không mang thời điểm |
| 8 | Không thay đổi `src/`, `migrations/`, `tests/` sau `9b0f83f` | đúng | `git diff --stat 9b0f83f HEAD -- src migrations tests` rỗng; `git log -1` của ba thư mục: `d9b0974`, `05a6da0`, `9b0f83f` |
| 9 | `9b0f83f` chỉ đổi tên ca V2 | đúng | `git show 9b0f83f -- tests/suggestions.test.ts`: 1 dòng `-`, 1 dòng `+`, đều là chuỗi tên ca |
| 10 | Số ca của gốc, `83d5e2f`, `56d257c`, `05a6da0`, `383c394` (bảng «Bằng chứng kiểm», dòng 210-230) | đúng | dòng `Test Files`/`Tests`/`All files` của từng log trùng từng số |
| 11 | Số ca của từng task F1, F2, F3, F1b, F1c, F5, G1, G2 (dòng 217-233) | đúng | từng log `codex-fix*-green.txt`, `*-native-verbose.txt`; typecheck của G1, G2 có trong log xanh (`typecheck exit 0`) |
| 12 | Số dòng `AssertionError` của các log đỏ (dòng 249-264) | đúng về con số | `grep -c AssertionError`: 8, 2, 10, 8, 5, 4, 3, 2, 9, 12, 10, 6, 1, 7, 7; G2: 3 và 3 |
| 13 | Task 1: «G8 … đỏ vì thiếu hàm hoặc tệp, không tính» | **sai** | `task-1-red.txt:112-113`: G8 có một dòng `AssertionError`, và là dòng thứ tám trong số 8. Lỗi L4 |
| 14 | F5 đỏ: 3 tệp, 7 ca đỏ, 131 đạt, 12 bỏ qua; tên ca theo sổ | đúng | `codex-fix1-F5-red.txt`: `Test Files 3 failed`, `Tests 7 failed | 131 passed | 12 skipped`; bảy tên FAIL trùng |
| 15 | G2 đỏ: H8, V2 ý 4, ca ứng viên OQ-53 (2); lượt đỏ thứ hai: ba ca «mốc» | đúng | tên FAIL của `codex-fix2-G2-red.txt`, `-red-2.txt` |
| 16 | Đo PostgreSQL 16.15: 282 giao dịch, 418 ms, 5 003 ms, 14 s `57014`, 23503 sau 1 ms, chín role đều `42501` | đúng | `measurements-pg16-rowlock.txt:35-47`, `:80-84`, `:97-121` (9 role phân biệt) |
| 17 | Bản data-only: nháp thứ 27, ánh xạ thứ 53 trên 61; `COPY` dưới role AI `0A000` | đúng | `measurements-pg16.txt:15-21` |
| 18 | Codex vòng 1: `CHANGES_REQUIRED`, 2 P0, 2 P1 | đúng | `codex-round-1.md:1`, `:3`, `:7`, `:11`, `:15` |
| 19 | Codex vòng 2: `CHANGES_REQUIRED`, một P0 ở `suggestions.ts:106`, chữ chép nguyên, căn cứ OQ-45 2 (b) | đúng | `codex-round-2.md:1`, `:3`, `:5`; chuỗi trích trùng từng ký tự |
| 20 | Codex vòng 3: `VERDICT: PASS`, «Không có finding.», đầu `b29b929`, gốc `4f12a3c` | đúng | `codex-round-3.md:1-3`; `codex-context-round-3.md:7-8` |
| 21 | Đầu vòng 1 `83d5e2f`, vòng 2 `d41cb4a` | đúng | `codex-context-round-1.md:6`, `codex-context-round-2.md:8` |
| 22 | Không bản ghi Codex nào được commit trong PR | đúng | `git diff 4f12a3c HEAD --name-only` không có tệp transcript; hai tệp `*-transcript.log` của lát 2 có từ trước gốc |
| 23 | 25 báo cáo dưới `gates/` có mặt, mỗi tệp kết bằng phán quyết biên nhận nêu | đúng | dòng cuối từng tệp: `VERDICT: READY FOR GATE` (tier1 ×3, recheck, F1-db, F1-sec, F1b ×2, F5 ×2, G1, G2), `Task quality: Approved/Needs fixes` (6 tệp task), `PLAN NEEDS CHANGES` (dòng 1 của ba tệp cổng kế hoạch), `SWEEP: …` (hai lượt quét) |
| 24 | Số finding theo mức của các review vòng sửa | đúng | F1-db `:15` (P2 3, P3 6); F1b-db `:17` (P3 5); sweep-races `:57`; G2 (P3 2); recheck `:13` |
| 25 | Cổng kế hoạch lượt 2: «1 mục phải sửa cơ học» | đúng nhưng thiếu | `security-gate-plan-round-2.md:7`: 1 phải sửa (N4), 2 nên sửa, 3 ca thiếu. Lỗi L5 |
| 26 | `tier1-recheck-fix2.md` «READY FOR GATE» | đúng, có điều kiện, điều kiện đã đạt | `:113-117` đặt hai điều kiện; G17 xanh trong `final-native-verbose.txt:806`; G12 sửa ở `5c08fda` |
| 27 | Migration 022: bốn trigger `BEFORE INSERT … FOR EACH ROW` trên ba bảng; bốn hàm; một `SECURITY INVOKER`, ba `SECURITY DEFINER`; không `GRANT` | đúng | `migrations/022_…sql:37-38` (không `SECURITY DEFINER`), `:57-58`, `:92-93`, `:111-112`; `:146-156`; chỉ có `REVOKE … FROM PUBLIC` |
| 28 | `FOR NO KEY UPDATE` lọc theo tenant; `23503` khi không thấy dòng dự án; `lock_timeout '5s'`, `search_path` ghim, `row_security = off` | đúng | `:73`, `:100`, `:128`; `:58`, `:93`, `:112` |
| 29 | `LTZ02` khi không READ COMMITTED; `LTZ01` cho `IBS_HI`; dòng `rejected` đi qua | đúng | `:64-65`, `:86`, `:116-121`, `:139` |
| 30 | Tệp lùi gỡ mọi thân trước đó | đúng | tệp lùi gỡ bốn trigger và bốn hàm theo tên có điều kiện; tên trong bốn thân cũ (`564712f`, `412c8a4`, `cb1d7dc`, `56d257c`) là tập con của bốn tên đó |
| 31 | Đúng một migration (022) và tệp lùi của nó | đúng | `git diff 4f12a3c HEAD --name-only -- migrations`: hai tệp |
| 32 | Dưới mọi lớp che `valueHash` rỗng, `sources` là `[]` | đúng | `src/server/suggestions.ts:106-107` (nhánh che của `toView`, nơi duy nhất dựng `DraftView`) |
| 33 | `decide` không so hash cho người mà nháp bị che; so lại sau bước giữ | đúng | `:282-283`, `:330` |
| 34 | Câu giữ trên nháp bị che chỉ nêu mã che cộng `SUBJECT_ORDER_UNVERIFIED` | đúng | `:324-326`, hằng `MASK_REASONS` `:38` trùng kiểu `MaskReason` `:37` (tám mã) |
| 35 | Mọi lệnh xác nhận nháp ứng viên bị giữ | đúng | `:320` vô điều kiện trong nhánh `confirmed`; `entity_type` chỉ có `intake_candidate`, `document` (`migrations/021_…sql:37`) |
| 36 | `PROJECT_TEXT_HIDDEN` cho mọi nháp, lúc đọc và lúc xác nhận | đúng | `:213-215`, `:314` |
| 37 | `LTZ01` ở lệnh chèn quyết định thành `DRAFT_HELD` `POINTER_ONLY_PROJECT`; mã khác đi thô | đúng | `:342-346` |
| 38 | Thứ tự `decide`: quyền → đã quyết → hash (chỉ khi hiện) → lỗi lệnh → giữ → hash lần hai | đúng | `:274-330` |
| 39 | Không đổi `AGENTS.md`, `CLAUDE.md`, `bot-plugin/`, `src/server/intake.ts` | đúng | `git diff --stat 4f12a3c HEAD --` bốn đường đó: rỗng |
| 40 | Ca «no route imports the suggestion service…» có mặt và không đổi | đúng | `tests/suggestions.test.ts:1321-1331`; `git blame`: 11 dòng đều từ `b69d50a5`, tổ tiên của gốc |
| 41 | Không login, khoá, quyền cho `libetech_ai`; không `.env*`, `data/`, `coverage`, `.next`, `node_modules` được theo dõi | đúng | diff không có `GRANT`/`CREATE ROLE`/`ALTER ROLE` ngoài chú thích; `git ls-files` không có các đường đó; `.superpowers/` bị `.gitignore:30` loại |
| 42 | `docs/OPEN-QUESTIONS.md` 940 dòng; 1–866 trùng gốc trừ 671, 687 sửa tại chỗ | đúng | `wc -l` = 940; gốc 866 dòng; `diff` chỉ ra `671c671`, `687c687` |
| 43 | Lời Chairman thứ nhất chép nguyên, đúng một lần, nguồn `:855` | đúng | `grep -c` = 1; `docs/OPEN-QUESTIONS.md:855` |
| 44 | Chuỗi «B: chặn tạm (Recommended)» đúng một lần; chữ phương án B trùng khối cuối tệp | đúng | `grep -o … | wc -l` = 1; chuỗi phương án ở dòng 33 có nguyên văn trong `docs/OPEN-QUESTIONS.md:931` |
| 45 | Chữ phương án trong bảng «Căn cứ» là chữ của OQ-45, OQ-46 | đúng | `node -e`: bốn chuỗi đều có trong `docs/OPEN-QUESTIONS.md` (`:667-669`, `:684`) |
| 46 | Số dòng dẫn vào OPEN-QUESTIONS (`:855`, `:865`, `:872`, `:884`, `:899`, `:914`, `:924`, `:928`) | đúng | từng dòng mở đúng mục được nêu |
| 47 | Số dòng dẫn vào kế hoạch (`:217`, `:751`, `:791-800`, `:802`, `:833-837`, `:953`, `:1338-1350`, `:1431`, `:1443`, `:1448`, `:1602`, `:1654`, `:1747`, `:1865`, `:1877`, `:1904`, `:1995`, `:2056`, `:2152`) | đúng | từng dòng là tiêu đề hay mục được nêu |
| 48 | Kế hoạch bản 0.9 | đúng theo mục | `docs/plans/oq-45-46-ai-drafts.md:1933` «(bản 0.9)»; dòng `Version` ở đầu tệp dừng ở 0.4 (lỗi của kế hoạch, không của biên nhận) |
| 49 | Danh sách commit sau cổng vòng 1 (dòng 89) đủ và đúng | **thiếu một** | mọi commit nêu có thật và đúng loại (`git show --stat`); thiếu `b8c70df`. Lỗi L3 |
| 50 | `0ec1e1b`, `5c08fda` chỉ ca kiểm; `bcdb360` có ba chạm ở `src` | đúng | `git show --stat` |
| 51 | Sau mỗi lượt đều có dòng `dupes: untracked=0 next-types=0` trong log | **sai** | dòng đó chỉ có ở 8 log tới `83d5e2f`; không có ở `head-56d257c-*`, `head-05a6da0-*`, `head-9b0f83f-*`, `codex-fix*-*`. Lỗi L1 |
| 52 | Bốn mức: chỉ «đã có mã» để ngỏ; ba mức kia «Chưa.» | đúng | dòng 13-16; không có câu «sẵn sàng», «production», «đã triển khai» nào; «đã đo» (dòng 175, 361) và «đo trên» (130, 267) đều có log; mức khoá lúc áp và trần 10 giây ghi rõ «chưa đo» (359, 385) |
| 53 | «Không làm» nêu Q2, Q4, P3-4 và các giữ chỗ | đúng | dòng 138, 192, 393; khối «Cần Chairman quyết» 451-456 |
| 54 | Vệ sinh repo công khai: không đường dẫn máy, chuỗi kết nối, bí mật, chat id, email trong `docs/` mà nhánh thêm hoặc đổi | đúng | quét regex trên `git diff 4f12a3c HEAD -- docs`, diff chưa commit, và biên nhận: 0 email, 0 đường dẫn thư mục nhà hay thư mục tạm của máy, 0 IP, 0 chat id `-100…`, 0 khoá; các chuỗi `password=`/`token=` là tên mẫu trong log thời gian của bộ lọc che |
| 55 | `src/server/source-text.ts` và `intake.ts` là hai nơi duy nhất nêu bảng bản sửa | đúng | `grep -rln source_event_revisions src` |

Đã soát 55 khẳng định: 49 đúng, 3 sai hoặc thiếu (#13, #49, #51), 1 đúng nhưng thiếu (#25), 1 không chứng minh được (#4), 1 đúng có điều kiện đã đạt (#26).

## 2. Lỗi trong biên nhận và câu sửa

**L1 — dòng 469 (P2, khẳng định bằng chứng không có).** Câu «Từ đó, trước mỗi lượt test, typecheck, build và mỗi commit đều đếm lại bản sao (dòng `dupes: untracked=0 next-types=0` trong log)» sai với log: chỉ `final-*`, `head-83d5e2f-*` và `coverage-383c394.txt` mang dòng đó. Câu sửa:

> Từ đó, trước mỗi lượt test, typecheck, build và mỗi commit, phiên đếm lại bản sao; dòng `dupes: untracked=0 next-types=0` chỉ được ghi vào log ở các lượt tới `83d5e2f` (`final-*.txt`, `head-83d5e2f-*.txt`, `coverage-383c394.txt`). Các log sau đó — các lượt của vòng sửa và các lượt cả bộ ở `56d257c`, `05a6da0`, `9b0f83f` — không mang dòng này, nên việc đếm ở các lượt đó không có bằng chứng trong repo.

**L2 — dòng 235 và 238 (P2, log gắn sai đầu nhánh).** Lượt coverage được gọi là lượt ở `9b0f83f`, nhưng nó bắt đầu lúc 15:50:45, trước commit `9b0f83f` (15:52:58). Mã `src/` và `migrations/` giống hệt, và `9b0f83f` chỉ đổi một tên ca, nên con số đúng cho mã ở đầu nhánh; nhưng log không cho biết tên ca mới đã có trong cây lúc chạy hay chưa. Thêm vào cuối ô «Kết quả» của dòng 235:

> Lượt này bắt đầu lúc 15:50:45 (dòng `Start at` của log): sau commit `d9b0974` (15:50:23), trước commit `9b0f83f` (15:52:58). `9b0f83f` chỉ đổi tên một ca (một dòng của `tests/suggestions.test.ts`), nên số ca và số phủ là của mã `src/` và `migrations/` ở đầu nhánh; log không chứng minh được tên ca mới đã có trong cây lúc chạy. Lượt PostgreSQL 16 (bắt đầu 16:01:02) mang tên ca mới.

**L3 — dòng 89 (P3, danh sách commit thiếu).** Danh sách dừng ở `a557499`. Sửa đuôi câu thành:

> … · `b29b929` (kế hoạch bản 0.9; các dòng trạng thái của OQ-45, OQ-46 và DELIVERY-012) · `a557499` (kết quả cổng Codex vòng 3) · `b8c70df` (log cả bộ ở `9b0f83f`).

**L4 — dòng 249 (P3, ghi chú lệch con số).** Tám dòng `AssertionError` gồm cả G8, trong khi ghi chú nói G8 «không tính». Câu sửa cho ô «Ghi chú»:

> bảy ca đỏ vì hành vi (G1, G3, G5, G6, G7, G9, G14) và G8 (câu lỗi không khớp `/permission denied/` vì hàm chưa có) — tám dòng; G11, G12 và ca lùi đỏ vì thiếu hàm hoặc tệp, không có dòng `AssertionError`

**L5 — dòng 312 (P3, đếm thiếu).** Câu sửa:

> … và `gates/security-gate-plan-round-2.md` (1 mục phải sửa — N4 —, 2 nên sửa — R8, R9 —, 3 ca thiếu — C11–C13). Kế hoạch sửa theo cả hai.

**L6 — dòng 375 (P3, tự nhận «đủ», R-ĐÚNG-ĐỦ).** «Các phần dư của vòng sửa, nêu đủ:» là một câu tự nhận đủ. Câu sửa:

> **Các phần dư của vòng sửa, từng mục** (R33–R39, DB-8, R15, và hai mục sau Task G1, G2; danh sách đầy đủ ở kế hoạch):

(Dòng 434 «Tám điều kiện của vòng sửa, nêu đủ» đếm được — 18 tới 25, cả tám có mặt — nên không phải lỗi.)

**L7 — `docs/IMPLEMENTATION-ROADMAP.md:62` (P3, nguồn của con số).** «hai mươi lăm điều kiện … của biên nhận»: hai mươi lăm điều kiện là của kế hoạch; biên nhận dẫn lại, cộng bốn điều kiện ở ghi chú 3 của khối quyết định. Câu sửa:

> Việc để lại: bốn điều kiện ở ghi chú 3 của khối quyết định (`docs/OPEN-QUESTIONS.md:865`) và hai mươi lăm điều kiện «trước khi thêm tuyến đọc nháp hoặc bật Z4» của kế hoạch, biên nhận dẫn lại ở mục cùng tên; gộp hai bản của cổng xét nháp thành một hàm; ca F-5 của `tests/review-delegations.test.ts` thỉnh thoảng đỏ trên PGlite (có từ trước; nên sửa ở một PR riêng).

Không lỗi nào làm sai mức «đã có mã»: không câu nào nói quá về triển khai, dùng thật hay nghiệm thu; mã khớp mô tả ở mọi điểm đã soát.

## 3. Phép thử ngược (ba khẳng định khó tin nhất)

1. **«Điều bị che lúc đọc luôn bị giữ lúc xác nhận», trong khi `decide` dựng ngữ cảnh hai lần** (`present` ở `:282`, `contextFor` ở `:302`). Đọc từng mã che của `present` (`:199-220`): `ENTITY_NOT_FOUND`, `POINTER_ONLY_PROJECT`, `PROJECT_TEXT_HIDDEN`, `THREAD_TEXT_HIDDEN` có nguồn giữ cùng tên ở `:304-314`; `SOURCE_OUT_OF_CONTEXT`, `TEXT_NOT_VISIBLE`, `SCHEMA_INVALID` đến từ cùng `checkSkillOutput` khi có ngữ cảnh; không có ngữ cảnh thì `ENTITY_NOT_FOUND` giữ. Không phá được bằng đọc mã. Còn lại đúng điều biên nhận đã ghi (P3-1 của lượt xem lại Task G2, dòng 418): câu giữ có thể thiếu `SCHEMA_INVALID`. Việc hai lần dựng luôn cho cùng lớp che khi không ghi đồng thời chưa ai chạy để chứng minh (`review-codex-fix2-G2-security.md`, «Chưa kiểm được»).
2. **«Mọi lệnh xác nhận nháp ứng viên bị giữ».** Thử tìm đường vòng: một `entity_type` thứ ba (không có, CHECK của 021), một lệnh thiếu hash đi qua trước dòng 320 (không: `REVISION_CONFLICT` hoặc `INVALID_INPUT` ném trước, đều không ghi), một nhánh lỗi của lệnh chèn quyết định cho ứng viên (không tới được: dòng 320 ném trước). Không phá được.
3. **«Các log ở đầu nhánh cuối là của `9b0f83f`».** Phá được một phần: lượt coverage bắt đầu trước commit đó (L2). Lượt PostgreSQL 16 qua được phép thử theo nội dung: nó mang tên ca chỉ có từ `9b0f83f`. Typecheck và build không mang thời điểm hay nội dung nào để kiểm; lần typecheck của người soát ở `b8c70df` (cùng mã) thoát 0.

## 4. Điều không chứng minh được

- Log không mang commit. Ràng log với mã chỉ có ba cách gián tiếp: thời điểm `Start at` so với thời điểm commit, nội dung (tên ca), và việc mã không đổi sau đó. Build và typecheck ở `9b0f83f` không có cách nào trong ba cách đó; chỉ biết mã ở mọi commit từ `d9b0974` tới HEAD giống nhau ở `src/` và `migrations/`.
- Cây làm việc lúc chạy có sạch không (tệp chưa theo dõi, bản sao iCloud) — sau `83d5e2f` không log nào ghi (L1). Lúc soát: 0 bản sao ngoài `.next/`, 0 dưới `.next/types`; có 563 bản sao « 2» dưới `.next/` (đầu ra build, bị bỏ qua, không làm typecheck lệch).
- Các log đỏ «trên mã cũ» (F1…G2) — không chứng minh được mã nào đã chạy; chỉ biết tên ca đỏ khớp mô tả.
- Việc CSDL thử của PR đã bị xoá và container đã dừng (dòng 473): ngoài phạm vi đọc của người soát (không được chạm Docker).
- Mức khoá lúc áp 022 và trần chờ gần 10 giây: biên nhận tự ghi «chưa đo»; người soát không đo.
- Nếu muốn khép L2 bằng chạy chứ không bằng câu chữ: chạy lại `npx vitest run --coverage` trên PGlite ở HEAD (cả bộ, khoảng 10 phút) — người soát không chạy theo brief. Không có tệp test riêng nào cần chạy lại để khép một khẳng định khác.

VERDICT: READY
