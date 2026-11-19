# Task 9 — kiểm toàn bộ OQ-53 (đầu nhánh 4df2db3, gốc 80c1ad8)

Phạm vi đo: nhánh `feat/oq-53-subject-verification`, HEAD `4df2db3`. Mọi số dưới đây là số đo trong phiên này, log nằm trong thư mục này. Không có lệnh nào đỏ.

## Bảng Lệnh · Kết quả · Log

| Lệnh | Kết quả | Log |
|---|---|---|
| `npm run typecheck` (sau khi kiểm `.next/types` không có bản « 2.ts») | mã thoát 0 | `task-9-typecheck.txt` |
| `rm -rf .next && npm run build` | mã thoát 0 | `task-9-build.txt` |
| `npx vitest run --coverage` (PGlite, không biến CSDL) | mã thoát 0; 67 tệp đạt, 13 bỏ qua (80 tệp); 1 280 ca đạt, 112 bỏ qua (1 392); 0 đỏ; 0 hook-timeout / PGlite closed; 0 AssertionError | `task-9-pglite-coverage.txt` |
| `npx vitest run --reporter=verbose` (PostgreSQL 16, CSDL `slice1_verify_531119`) | mã thoát 0; 80 tệp đạt (80); 1 392 ca đạt, 0 bỏ qua; 0 đỏ; 0 hook-timeout; 0 AssertionError; 8 dòng khớp «deadlock» đều là tên ca đạt (không có 40P01 thật) | `task-9-native-verbose.txt` |
| Chu trình migration 023 trên CSDL thử `slice1_verify_5311195` (đã xoá sau khi đo) | (a)–(e) đều đúng; xem bảng dưới | `task-9-migration-cycle.txt` |
| Vệ sinh và ràng buộc PR | xem bảng dưới | `task-9-hygiene.txt` |
| Ma trận đột biến (đối chiếu log của builder, không chạy lại) | 10/11 nhãn db có log có ca đỏ; db9 chưa khớp | `task-9-mutation-matrix.txt` |

## Chỉ số coverage (cùng bốn tệp, so với `docs/reviews/oq-45-46-evidence-20261118/head-9b0f83f-coverage.txt`)

Đo bằng reporter văn bản. (Sửa sau lượt reality-check: khối tổng của cả hai log có covered/total — câu lệnh 3 386/3 514 → 3 435/3 563; nhánh 2 204/2 404 → 2 257/2 456; hàm 761/776 → 763/778; dòng 2 536/2 598 → 2 575/2 637. Bảng dưới dùng %.)

| Tệp / tổng | Nền (câu · nhánh · hàm · dòng) | Bây giờ (câu · nhánh · hàm · dòng) | Dòng chưa phủ (nền → bây giờ) |
|---|---|---|---|
| All files | 96.35 · 91.68 · 98.06 · 97.61 | 96.40 · 91.89 · 98.07 · 97.64 | — |
| `suggestions.ts` | 97.61 · 96.47 · 100 · 99.42 | 97.71 · 96.98 · 100 · 99.46 | 346 → 372 (dòng dời, số nhánh chưa phủ giảm) |
| `skill-context.ts` | 93.05 · 90.16 · 100 · 100 | 93.05 · 90.16 · 100 · 100 | 89-90 → 96-97 (cùng số dòng, chỉ dời) |
| `source-text.ts` | không có dòng trong nền | 100 · 97.5 · 100 · 100 | 164 |
| `skill-contracts.ts` | có dòng trong bảng của cả hai lần (sửa sau reality-check; scout ghi sót) | 99,38 · 100 · 100 · 100 | — |

Kết luận coverage: không tệp nào giảm về %. Không có dòng `document-dependencies.ts` trong cả hai bảng, nên không thấy dao động nhánh 97,22 ↔ 94,44 trong lần đo này. (Câu «`skill-contracts.ts` không xuất hiện» của bản đầu sai: tệp có dòng trong bảng.)

## Chu trình migration 023 (CSDL thử riêng, đã xoá)

| Bước | Kết quả |
|---|---|
| Áp 001–023 qua harness (`tests/thread-order.test.ts`) | 30/30 đạt |
| (a) Catalog sau áp | hai trigger `tgenabled='O'`, `AFTER INSERT ROW` (không BEFORE); hai hàm `prosecdef=t`, `proconfig` = search_path, row_security=off, lock_timeout=5s; chủ hàm là superuser; ACL chỉ có chủ; `public_exec=f`, `runtime_exec=false`; hai bảng mới `relrowsecurity=t`, `relforcerowsecurity=t`, đúng 1 policy `runtime_select` mỗi bảng; `subject_thread_seq` tồn tại (bigint). Bản không có số = 0; luồng mismatch = 0 |
| (b) Lùi 023 | mã thoát 0; hai bảng, hai hàm, hai trigger, cột: đều còn 0 |
| (c) Áp lại 023 | mã thoát 0; catalog như (a) |
| (d) Áp 023 lần hai | mã thoát 0; catalog như (c) (không đổi) |
| (e) Lùi 022 khi 023 còn ghi nhận | TỪ CHỐI: «Roll back the later migrations before 022.», mã thoát 3; số đối tượng không đổi (2/2/2/1) |

Giới hạn quan trọng: CSDL thử có **0 bản** (không có dữ liệu seed). Hai kiểm «bản không có số = 0» và «mỗi luồng đếm bằng số dòng» vì vậy đúng tầm thường (0 = 0); chúng KHÔNG chứng minh tính đúng của bộ đếm với dữ liệu thật. Ghi nhận: chủ hàm là `oq53_operator` khi áp qua harness và `postgres` khi áp tay bằng superuser (cả hai đều superuser; đây là hệ quả của login áp, không phải lỗi).

## Vệ sinh và ràng buộc PR (`task-9-hygiene.txt`)

- (a) `git diff --stat 80c1ad8..HEAD -- AGENTS.md CLAUDE.md bot-plugin src/server/ai-scope.ts src/server/intake.ts src/app`: rỗng.
- (b) `src/app` name-status: rỗng; không có tệp mới dưới `src/app/api`.
- (c) Ca canh «no route imports the suggestion service…»: thân ca (40 dòng từ tiêu đề) **giống hệt byte** giữa `80c1ad8` và HEAD. Tệp `tests/suggestions.test.ts` có sửa nhiều ca khác, nhưng không đụng ca canh.
- (d) `SUBJECT_ORDER_UNVERIFIED` / `SUBJECT_EDIT_UNVERIFIED` trong src, tests, skills, migrations: 0 dòng.
- (e) `git ls-files -m -o`: chỉ có tệp trong `docs/reviews/oq-53-evidence-20261119/` (không có tệp lạ).
- (f) Quét dòng THÊM của diff `80c1ad8..HEAD` theo mẫu đường dẫn máy / tên người dùng / URL có mật khẩu / token / khoá: 0 dòng trúng. Không có chat ID Telegram thật trong phần thêm. Bản đầu của dòng này ghi «quét thư mục bằng chứng: 0» — SAI: mẫu quét chỉ tìm tiền tố thư mục home có dấu gạch chéo nên sót đường dẫn tạm của phiên ở `task-9-hygiene.txt` (đã thay bằng `<scratch>`); quét lại bằng mẫu rộng ở biên nhận.

## Bất thường và cách xử lý

1. **Không có lệnh đỏ** trong 1–4.
2. **db9 không khớp kỳ vọng kế hoạch.** Kế hoạch đòi «thêm FOR UPDATE lên dòng đếm ở đầu trigger → N16 phải đỏ». Log của builder (`task-1-mutants-and-numbering-time.txt`, mục g) chỉ có biến thể FOR UPDATE trên dòng **dự án**, và ghi rõ FOR UPDATE thừa trong trigger **không làm N16 đỏ**. Biến thể đúng như kế hoạch chưa có log. Không tự chạy đột biến; cần builder xử lý.
3. **Số ca PGlite thay đổi so với nền PR #22.** Nền: 1 220 đạt + 79 bỏ qua (66 tệp đạt, 12 bỏ qua; tổng 78 tệp). Bây giờ: 1 280 đạt + 112 bỏ qua (67 đạt, 13 bỏ qua; tổng 80 tệp). Số bỏ qua tăng vì các ca đồng thời chỉ chạy native (ghi trong log typecheck/vitest, cùng chế độ đã có). Native: nền 1 299 đạt + 0 bỏ qua (78 tệp) → bây giờ 1 392 đạt + 0 bỏ qua (80 tệp).
4. **Thư mục cũ `logs/`** có tệp mutant của builder; tôi không sửa tệp nào trong đó.
5. Trong log của Task 9 còn hai dòng mang đường dẫn tạm của phiên (`task-9-hygiene.txt:8-9`) — phát hiện sau, đã thay bằng `<scratch>`; quét lại bằng mẫu rộng ghi ở biên nhận.

## Số liệu so với nền PR #22

| Chỉ số | Nền PR #22 | Task 9 (HEAD 4df2db3) |
|---|---|---|
| PGlite ca đạt / bỏ qua | 1 220 / 79 | 1 280 / 112 |
| PGlite tệp đạt / bỏ qua (tổng) | 66 / 12 (78) | 67 / 13 (80) |
| PostgreSQL 16 ca đạt / bỏ qua | 1 299 / 0 | 1 392 / 0 |
| PostgreSQL 16 tệp | 78 | 80 |
| Coverage All files (câu · nhánh · hàm · dòng) | 96.35 · 91.68 · 98.06 · 97.61 | 96.40 · 91.89 · 98.07 · 97.64 |
