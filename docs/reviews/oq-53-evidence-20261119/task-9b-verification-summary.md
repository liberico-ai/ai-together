# Task 9b — kiểm toàn bộ OQ-53 chạy lại (đầu nhánh affe28a, gốc 80c1ad8)

Phạm vi đo: nhánh `feat/oq-53-subject-verification`, HEAD `affe28a` (đo ngày 19/11/2026, sau vòng sửa của cổng Codex và đợt quét theo lớp; chủ yếu `migrations/023_thread_order.sql` và `tests/`). Mọi số dưới đây là số đo trong lượt này; log nằm trong thư mục này. Không có lệnh nào đỏ. Z4 chưa bật; không áp migration lên dữ liệu thật; không có tuyến HTTP mới.

Đây là số đo kiểm chứng, không phải nghiệm thu: không gộp với các mức «đã có mã · đã triển khai · đã dùng thật · đã nghiệm thu».

## Bảng Lệnh · Kết quả · Log

| Lệnh | Kết quả | Log |
|---|---|---|
| 1. `npm run typecheck` (sau khi xoá bản « N.ts» trong `.next/types`, nếu có) | mã thoát 0; 0 dòng `error TS` | `task-9b-typecheck.txt` |
| 2. `rm -rf .next && npm run build` | mã thoát 0; 0 dòng cảnh báo | `task-9b-build.txt` |
| 3. `npx vitest run --coverage` (PGlite, không biến CSDL) | mã thoát 0; 67 tệp đạt, 13 bỏ qua (80 tệp); 1 287 ca đạt, 118 bỏ qua (1 405); 0 đỏ; 0 hook-timeout / PGlite closed; 0 AssertionError | `task-9b-pglite-coverage.txt` |
| 4. `npx vitest run --reporter=verbose` (PostgreSQL 16 thật, CSDL `slice1_verify_531119`) | mã thoát 0; 80 tệp đạt (80); 1 405 ca đạt, 0 bỏ qua; 0 đỏ; 0 hook-timeout; 0 AssertionError; 0 dòng `40P01`; 9 dòng khớp «deadlock» đều là TÊN CA ĐÃ ĐẠT (không có deadlock thật) | `task-9b-native-verbose.txt` |
| 5. Áp – lùi – áp lại – áp lần hai – lùi 022 trên CSDL thử `slice1_verify_5311195` (đã xoá) | (a)–(e) đều đúng; xem bảng dưới | `task-9b-migration-cycle.txt` |
| 6. Vệ sinh và ràng buộc | (a), (b), (b2), (c), (d), (e), (f) đều đúng; xem bảng dưới | `task-9b-hygiene.txt` |
| Build tối thiểu: `npm run build` đã ở lệnh 2 | mã thoát 0 | `task-9b-build.txt` |

Trước mỗi lệnh nặng: `pgrep -f '[v]itest'` = 0; load 5–7 (dưới ngưỡng 8). Một lệnh vitest một lúc. Mọi log đã quét `<repo>` ngay lúc ghi.

## Chỉ số coverage (PGlite, lệnh 3)

Covered/total lấy từ `coverage/coverage-summary.json` (khối tổng của log khớp JSON).

| Tệp / tổng | Nền PR #22 (câu · nhánh · hàm · dòng) | Task 9 đầu `4df2db3` | Task 9b `affe28a` (câu · nhánh · hàm · dòng) | covered/total (câu · nhánh · hàm · dòng) |
|---|---|---|---|---|
| All files | 96.35 · 91.68 · 98.06 · 97.61 | 96.40 · 91.89 · 98.07 · 97.64 | **96.40 · 91.89 · 98.07 · 97.64** | 3435/3563 · 2257/2456 · 763/778 · 2575/2637 |
| `suggestions.ts` | 97.61 · 96.47 · 100 · 99.42 (chưa phủ dòng 346) | 97.71 · 96.98 · 100 · 99.46 | **97.71 · 96.98 · 100 · 99.46** (chưa phủ dòng 372) | 257/263 · 225/232 · 33/33 · 185/186 |
| `skill-context.ts` | 93.05 · 90.16 · 100 · 100 (dòng 35-40,42,89-90) | 93.05 · 90.16 · 100 · 100 (dòng 35-40,42,96-97) | **93.05 · 90.16 · 100 · 100** (dòng 35-40,42,96-97) | 67/72 · 55/61 · 10/10 · 44/44 |
| `source-text.ts` | không có trong nền | 100 · 97.5 · 100 · 100 | **100 · 97.5 · 100 · 100** (chưa phủ dòng 164) | 51/51 · 39/40 · 14/14 · 38/38 |
| `skill-contracts.ts` | không có trong nền | không có trong log văn bản | **không có dòng trong bảng văn bản của log**; JSON: 99.38 · 100 · 100 · 100 | 162/163 · 122/122 · 34/34 · 99/99 |

Kết luận so sánh: **không tệp nào và không khối tổng nào giảm** so với Task 9 đầu (cả % lẫn covered/total giữ nguyên) và so với nền PR #22 (% tăng nhẹ; mẫu số tăng từ 3514 lên 3563 câu lệnh, do có thêm mã và ca). Dòng `skill-contracts.ts` không xuất hiện trong bảng văn bản của cả hai lượt đo (kể cả nền); chỉ có trong JSON nên bảng trên lấy từ JSON. Không thấy dao động `document-dependencies.ts`.

## Chu trình migration 023 (lệnh 5, CSDL thử `slice1_verify_5311195`, đã xoá)

| Bước | Kết quả |
|---|---|
| Áp 001–023 qua harness (`npx vitest run tests/thread-order.test.ts`) | mã thoát 0; 37/37 ca đạt (số ca của tệp này nay là 37; lượt trước ghi 30 vì tệp đã có thêm ca, không so trực tiếp được). Bảng `schema_migrations`: 001–023 đủ |
| (a) Catalog sau áp (psql, superuser) | Bốn trigger do 023 tạo, trên hai bảng: `source_event_revisions_thread_position` AFTER INSERT ROW **`tgenabled='A'`**; `draft_decisions_subject_order_guard` AFTER INSERT ROW **`tgenabled='O'`**; `intake_thread_heads_no_delete` BEFORE DELETE ROW `O`; `source_revision_positions_immutable` BEFORE UPDATE OR DELETE ROW `O`. Hai hàm 023: `prosecdef=t`; `proconfig` = search_path=pg_catalog,pg_temp; row_security=off; lock_timeout=5s (và `plan_cache_mode=force_custom_plan` ở hàm xác nhận). Chủ hàm là superuser; EXECUTE chỉ còn cho chủ hàm. Hai bảng mới `relrowsecurity=t`, `relforcerowsecurity=t`, đúng 1 chính sách `runtime_select` (SELECT) mỗi bảng. `draft_decisions.subject_thread_seq` kiểu bigint. Bản ghi không có số = **0**. Ghi nhận: `schema_migrations` có 022 và 023 |
| (b) Lùi 023 (`migrations/rollback/023_thread_order.sql`) | mã thoát 0. Sau lùi: bảng 0, hàm 0, trigger 0, cột 0, bản ghi 023 = 0 |
| (c) Áp lại 023 | mã thoát 0; catalog khớp (a) ở mọi mục trừ chủ hàm: (a) chủ `oq53_operator` (áp qua harness), (c) chủ `postgres` (áp bằng psql). Cả hai là superuser |
| (d) Áp 023 lần hai | mã thoát 0; `INSERT 0 0` (không ghi thêm bản ghi); catalog khớp (c); trigger cấp số vẫn `A` |
| (e) Lùi 022 khi 023 còn ghi nhận | **TỪ CHỐI**: «Roll back the later migrations before 022.», mã thoát 3; sau đó 2 bảng / 2 hàm / 4 trigger / 1 cột / 1 bản ghi: không đổi |

Giới hạn: CSDL thử không có dữ liệu seed (bản không số = 0 là tầm thường, 0 = 0); không chứng minh bộ đếm đúng với dữ liệu thật. Chủ hàm khác nhau giữa (a) và (c)/(d) là hệ quả của cách áp, không phải lỗi; cả hai đều superuser như tệp đòi hỏi.

## Vệ sinh và ràng buộc (lệnh 6, `task-9b-hygiene.txt`)

- (a) `git diff --stat 80c1ad8..HEAD -- AGENTS.md CLAUDE.md bot-plugin src/server/ai-scope.ts src/server/intake.ts src/app`: **rỗng**.
- (b) `git diff --name-status 80c1ad8..HEAD -- src/app`: **rỗng**; (b2) tệp mới dưới `src/app/api`: **không có**.
- (c) Ca canh «no route imports the suggestion service, and nothing in src builds it with an AI handle» (`tests/suggestions.test.ts`): thân ca **12 dòng** (từ tiêu đề đến ca kế tiếp), trích ở `80c1ad8` và ở HEAD bằng `git show`, **giống hệt byte** (`diff` rỗng). Ghi chú: log Task 9 ghi «40 dòng»; lần này đo 12 dòng theo ranh giới ca kế tiếp, con số cũ không so được.
- (d) `SUBJECT_ORDER_UNVERIFIED` / `SUBJECT_EDIT_UNVERIFIED` trong `src`, `tests`, `skills`, `migrations`: **0 dòng**.
- (e) `git ls-files -m -o --exclude-standard`: chỉ sáu tệp `docs/reviews/oq-53-evidence-20261119/task-9b-*.txt` của lượt này (và file `.md` này khi ghi xong). Không có tệp lạ. `coverage/` bị gitignore.
- (f) Quét dòng THÊM của mọi commit `80c1ad8..HEAD` và các tài liệu (`docs/reviews/oq-53-evidence-20261119`, `docs/plans/oq-53-subject-verification.md`, `docs/DELIVERY-016-*.md`, `docs/OPEN-QUESTIONS.md`) bằng mẫu RỘNG (tiền tố thư mục home dạng gạch chéo và gạch ngang, tên người dùng máy, thư mục tạm hệ thống, thư mục phiên, URL Postgres có mật khẩu, PGPASSWORD, token GitHub, khoá PEM): **0 dòng trúng** ở cả hai nơi. Quét lại sau khi ghi log: không tệp `task-9b-*` nào chứa đường dẫn máy hay tên người dùng.
- (f2) Chat ID Telegram dạng `-100…`: các id xuất hiện trong dòng thêm của commit và trong tài liệu (`-100000000000`, `-1000000000001`, `-1000000000002`, `-1000000009001`) đều là **chuỗi số giả** (dãy số 0 kèm đuôi nhỏ); không có id thật.

## Bất thường và cách xử lý

1. **Không có lệnh 1–4 đỏ.** Không có tự sửa nào trong `src/`, `migrations/`, `tests/`.
2. **Số ca tăng so với Task 9 đầu** (`4df2db3`): PGlite 1 280 đạt / 112 bỏ qua → 1 287 / 118; PostgreSQL 1 392 → 1 405. Tăng 13 ca tổng (7 đạt, 6 bỏ qua trên PGlite) do tệp có thêm ca trong vòng sửa Codex; không phân tích thêm từng ca. Tệp PGlite: 80 tệp (67 đạt, 13 bỏ qua), đúng như Task 9 đầu.
3. **Mục cần chú ý khi nghiệm thu:** ca native có 9 dòng khớp «deadlock», đều là tên ca đạt; không có `40P01`.
4. **Hai bảng không có dòng trong tệp nền:** `source-text.ts` và `skill-contracts.ts` (nền PR #22 không có). `skill-contracts.ts` không xuất hiện trong bảng văn bản của log lượt này lẫn lượt Task 9 đầu; số lấy từ JSON.
5. **Thư mục `logs/` cũ** và **log mutant của builder** không đụng tới; lượt này không chạy đột biến.

## Số liệu so với nền PR #22 và Task 9 đầu

| Chỉ số | Nền PR #22 | Task 9 đầu (`4df2db3`) | Task 9b (`affe28a`) |
|---|---|---|---|
| PGlite ca đạt / bỏ qua | 1 220 / 79 | 1 280 / 112 | **1 287 / 118** |
| PGlite tệp đạt / bỏ qua (tổng) | 66 / 12 (78) | 67 / 13 (80) | **67 / 13 (80)** |
| PostgreSQL 16 ca đạt / bỏ qua | 1 299 / 0 | 1 392 / 0 | **1 405 / 0** |
| PostgreSQL 16 tệp | 78 | 80 | **80** |
| Coverage All files (câu · nhánh · hàm · dòng) | 96.35 · 91.68 · 98.06 · 97.61 | 96.40 · 91.89 · 98.07 · 97.64 | **96.40 · 91.89 · 98.07 · 97.64** |
| Typecheck · build | — | 0 · 0 | **0 · 0** |
| Migration 023 (a)–(e) | — | đúng | **đúng** |
| Vệ sinh (a)–(f) | — | (f) quét thiếu, đã sửa | **đúng; (f) quét rộng 0 trúng** |

## Đầu nhánh đã đo

HEAD `affe28a` — `fix(drafts): migration 023 locks draft_decisions only when re-applied and checks the numbering trigger more strictly; receipt updated for the Codex fix rounds`. Nhánh `feat/oq-53-subject-verification`, gốc `80c1ad8`.
