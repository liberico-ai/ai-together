# Bằng chứng GV5-C — nhập bảng việc của PM thành yêu cầu chờ BoM duyệt (25/11/2026)

Nhánh `feat/gv5-c-sheet-import`, một commit trên `fc1d7b8` (merge của hạng mục B). Đường dẫn máy trong log đã thay bằng `<repo>`, `<local>`, `<tmp>`. Log không chứa dữ liệu team: chỉ dữ liệu mẫu của bộ test. Lần chạy thử với bảng thật chỉ ghi số đếm ở đây; bản có chữ nằm ngoài repo, quyền 0600.

## Cổng Codex — một vòng

- `codex-context-round-1.md`: khối ngữ cảnh gửi kèm diff mã (`src`, `migrations`, `deploy`, `scripts`, `bot-plugin`, `tests`, `vitest.config.ts`, `package.json`, so với đầu nhánh B `9a92c42`; 219 942 ký tự cả lời nhắc).
- `codex-round-1.md`: kết quả nguyên văn. Dòng đầu: `VERDICT: CHANGES_REQUIRED`.
- Vòng chạy trên cây `47ead00`. Bản ghi hội thoại của Codex không commit.
- Sau vòng Codex và các sửa, nhánh được đặt lại lên merge của B (`fc1d7b8`). Từ đầu nhánh B mà Codex so (`9a92c42`) tới merge đó, ngoài thư mục bằng chứng của B chỉ có `tests/thread-order-concurrency.test.ts` đổi; cây cuối của PR này dùng `takeOffAbove` ở tệp đó.

| Mức | Chỗ | Finding | Đã làm | Ca kiểm |
|---|---|---|---|---|
| P0 | `migrations/027_work_imports.sql` | Hàm xung đột cho dò mã và nội dung đã nhập ở dự án ngoài quyền xem | Chỉ dòng khoá người gọi đọc được (chính họ nhập, hoặc họ giữ ghế BoM của dự án) mới được so dấu vân tay, nội dung, mã. Dòng khác chỉ trả `STT_IMPORTED` cho cùng STT, như nhau dù nội dung trùng hay khác. Khoá mã và khoá nội dung ở CSDL theo từng người nhập, để lần ghi cũng không dò được | (5), (8), (22) `tests/sheet-import.test.ts` |
| P1 | `migrations/027_work_imports.sql` | RLS của lô cho bot ghi khi chạy thẳng dưới vai runtime | Chính sách ghi đòi thành viên Team Tech, hoặc `work_request_filer` của một dự án trong phạm vi | (23) `tests/sheet-import.test.ts` |
| P1 | `src/server/sheet-import.ts` | `previewDigest` chưa gắn với ánh xạ; tính lại được từ đầu vào | Ghi nhận, sửa tiến (kế hoạch mục 13). Lần ghi vẫn kiểm lại quyền, IBS HI, xung đột và `CODE_EXISTS` theo ánh xạ của chính nó | — |
| P1 | `migrations/rollback/027_work_imports.sql` | Rollback chạy lần hai lỗi ở `DROP TRIGGER` | Không sửa: PostgreSQL 16 coi `DROP TRIGGER IF EXISTS … ON <bảng không có>` là NOTICE; ca (4) của `tests/migrations-rollback.test.ts` chạy rollback hai lần, xanh trên cả hai CSDL | (4) `tests/migrations-rollback.test.ts` |
| P2 | `src/server/csv.ts` | Ngoặc kép giữa một ô không bao trong ngoặc kép được nhận | Nay là `CSV_MALFORMED` | (2) `tests/sheet-import-csv.test.ts` |

Các sửa trên làm sau vòng Codex, nên Codex chưa đọc lại. Cổng test chạy lại trên cây cuối.

Cũng sửa trong đợt này: `tests/thread-order-concurrency.test.ts` (chỉ chạy trên PostgreSQL) gỡ mọi migration trên 023 bằng `takeOffAbove`, như ba bộ ca kiểm gỡ 023 khác.

## Đỏ trước khi sửa theo Codex

- `logs/red-before-codex-fixes.txt`: mã cũ `47ead00` (một worktree nháp) cùng các ca mới (5), (22), (23) và ca CSV: 2 tệp, 4 ca hỏng, 4 dòng `AssertionError`, 0 dòng hết giờ.
- Sau lần đỏ đó: ca (8) đổi kỳ vọng cho người nhập thứ hai, từ «trùng» sang `STT_IMPORTED` (hệ quả đã định của sửa P0, OQ-62 câu 8); ca (22) sửa một lỗi của chính ca kiểm (hai dòng cùng mã trong một tệp).

## Xanh trên cây cuối `c0a1ede`

Chạy một lần sau lần sửa cuối, trên cây `c0a1ede` (commit của PR này chỉ khác ở thư mục bằng chứng này).

| Log | Lệnh | Kết quả |
|---|---|---|
| `logs/typecheck.log` | `npm run typecheck` | thoát 0 |
| `logs/build.log` | `npm run build` | thoát 0 |
| `logs/pytest.log` | `python3 -m pytest tests/test_bot_bridge.py -q` | 82 ca đạt |
| `logs/pglite-coverage.log` | `npx vitest run --coverage` (PGlite) | 83 tệp đạt, 15 bỏ qua (98); **1491 ca đạt, 162 bỏ qua (1653)**; trên danh sách tệp của `vitest.config.ts`: câu lệnh 96,36 %, nhánh 92,02 %, hàm 98,18 %, dòng 97,73 % |
| `logs/native.log` | `npx vitest run` trên PostgreSQL 16 (container cục bộ, CSDL riêng của phiên) | **98 tệp đạt; 1653 ca đạt**, không ca nào bỏ qua |
| `logs/coverage-new-modules.log` | `npx vitest run --coverage` (cả bộ, PGlite), chỉ tính bốn tệp: `--coverage.include=src/server/{sheet-import,csv,intake-pool,intake-trail}.ts`, báo cáo `text` và `json-summary` | 1491 ca đạt như dòng trên. Câu lệnh / nhánh / hàm / dòng: `sheet-import.ts` 96,75 / 92,4 / 100 / 97,27 %; `csv.ts` 100 / 100 / 100 / 100 % (bảng chữ bỏ tệp đủ 100 %, số ở `logs/coverage-new-modules-summary.json`); `intake-pool.ts` 91,13 / 83,17 / 100 / 100 %; `intake-trail.ts` 95,34 / 92,75 / 83,33 / 100 % |

162 ca bỏ qua trên PGlite là các ca chỉ chạy khi có PostgreSQL thật; lần chạy PostgreSQL chạy cả 1653.

Danh sách tệp tính coverage trong `vitest.config.ts` chưa có `src/server/sheet-import.ts`, `src/server/csv.ts` (của PR này) và `src/server/intake-pool.ts`, `src/server/intake-trail.ts` (của B), nên con số chung ở trên không nói gì về chúng. `logs/coverage-new-modules.log` đo riêng bốn tệp đó trên cùng cây, bằng cả bộ test: cả bốn tệp trên 60 %. Thêm bốn tệp vào danh sách là việc sửa tiến.

## Chạy thử với bản xuất 25/11 của bảng thật

- Tệp: bản xuất CSV ngày 25/11/2026 của trang «Đầu việc Tech», Google Sheet «Checklist dau viec cua Tech theo BU_Update 07.11.2026». SHA-256: `c7af427f7b39d58b90180b830462f2354b944fc260a7e2b54778a12292c05cc9`. PM chưa xác nhận đây là bản nguồn để nhập thật (EV-10).
- Lệnh: `npx tsx scripts/sheet-import-dry-run.ts --file <tệp> --source-url <liên kết> --sheet 'Đầu việc Tech' --detail <tệp 0600> --receipt <tệp 0600>` trên cây `c0a1ede`. CSDL là PGlite trong bộ nhớ; tenant, dự án và người nhập là giả; ô người phụ trách để trống. `logs/dry-run.log` là toàn bộ đầu ra của lệnh.
- Số đếm theo nhãn BU của bảng. Không có tổng gộp giữa các nhãn.

| Nhãn BU | Dòng | Hợp lệ | Trùng | Cần đối chiếu | Yêu cầu mới ở lần chạy thứ hai |
|---|---|---|---|---|---|
| LBRC | 23 | 23 | 0 | 0 | 0 |
| IBS HI | 20 | 20 | 0 | 0 | 0 |
| XECA | 8 | 8 | 0 | 0 | 0 |

- Cờ (một dòng có thể mang nhiều cờ; ô để trống không bị đoán):

| Nhãn BU | `OWNER_NOT_MAPPED` | `MISSING_OWNER` | `MULTI_OWNER` | `MISSING_DUE` | `AMBIGUOUS_DUE` | `UNKNOWN_STATUS` | `IBS_NOTE_NOT_STORED` |
|---|---|---|---|---|---|---|---|
| LBRC | 18 | 1 | 4 | 6 | 3 | 8 | — |
| IBS HI | 13 | 0 | 7 | 19 | 0 | 19 | 9 |
| XECA | 8 | 0 | 0 | 2 | 2 | 1 | — |

- `OWNER_NOT_MAPPED` cao vì lần chạy thử không có tài khoản thật để ánh xạ; với bảng thật, người nhập chọn ánh xạ lúc xem trước.
- Lần chạy thứ hai với đúng tệp đó ghi 0 yêu cầu mới ở cả ba nhãn.

Mức: **đã có mã · đã thử trên CSDL thử**. Chưa triển khai, chưa nghiệm thu với team.
