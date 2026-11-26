# Bằng chứng GIAO VIỆC 5 E và OQ-61 B6 (26/11/2026)

Nhánh `feat/gv5-e-files-link-revoke`, trên `d9a2318` (sau PR 4). Đường dẫn máy trong log đã thay bằng `<repo>`, `<local>`, `<tmp>`; địa chỉ CSDL, nếu có, thành `<db>`. Log chỉ chứa dữ liệu mẫu của bộ test.

## Đỏ trước, xanh sau

| Log | Trên mã nào | Kết quả |
|---|---|---|
| `red-first-e-ts.txt` | trước khi viết E | 3 ca hỏng, 3 dòng `AssertionError`; 1 ca canh xanh (tệp lưu được và tin không tệp không mang lý do) |
| `red-first-e-py.txt` | trước khi viết E | 1 ca hỏng bằng `AssertionError`; 1 ca canh xanh (lý do lạ giữ câu chung) |
| `red-first-b6.txt` | trước khi viết B6 | 13 ca hỏng, 13 dòng `AssertionError` |
| `red-after-codex.txt` | `ec5ad44`, trước khi sửa theo Codex | 4 ca hỏng, 4 dòng `AssertionError` |

Ca cũ phải đổi theo thiết kế mới:
- hai thẻ ứng viên mẫu của test giao diện thêm `links: []`;
- ca của 029 gỡ các migration phía trên trước khi hoàn tác 029, vì 030 nay đứng trên nó;
- ca cô lập pool (6) thêm cột `id` vào danh sách cột mà vai identity đọc ở `intake_work_links`. 030 cấp cột này để hàm đếm bỏ được liên kết đã gỡ. `id` là khoá ngẫu nhiên, không nêu gì.

## Cổng Codex, một vòng (`codex-round-1.md`)

Đầu vào: `codex-context-round-1.md` cùng diff `d9a2318..ec5ad44` của `src`, `migrations`, `bot-plugin`, `tests`. Kết quả: `VERDICT: CHANGES_REQUIRED`, **một P0, một P1, một P2**. Cả ba đã sửa ở `4384524`, sau vòng này, nên Codex chưa đọc lại. Không chạy vòng hai.

| Mức | Chỗ | Finding | Đã làm |
|---|---|---|---|
| P0 | sự kiện `pool.link_revoked` | Mọi thành viên roster đọc được mã liên kết và lý do gỡ, kể cả khi không đọc được liên kết | Sự kiện chỉ ghi dự án và phiên bản. Luật payload đóng của 025 không nới. Mã và lý do chỉ ở dòng gỡ, theo quyền đọc liên kết |
| P1 | chính sách ghi dòng gỡ (030) | Người đã rời Team Tech vẫn ghi được dòng gỡ cho liên kết nhóm chung, nếu ghi thẳng bằng vai runtime | RLS đòi thành viên Team Tech khi liên kết thuộc nhóm chung |
| P2 | `src/server/csv.ts` | Mọi tệp ZIP bị gọi là Excel | Chỉ gọi là Excel khi ZIP có workbook; ZIP khác ra `ZIP_NOT_CSV` |

`pglite-before-codex.txt` là lượt đủ bộ chạy song song với vòng Codex, trên `ec5ad44`: hỏng hai tệp (ca 029 và ca cô lập pool nêu trên). Cả hai đã sửa trong `4384524`.

**Không có lượt đọc độc lập sau cổng.** Tài khoản Claude đã chạm hạn mức chi tiêu hôm trước. Các sửa được kiểm bằng ca đỏ trước và bộ test đầy đủ trên hai CSDL.

## Cổng trên cây cuối `4384524`

| Cổng | Kết quả | Log |
|---|---|---|
| `npm run typecheck` | thoát 0 | `logs/typecheck.log` |
| `npm run build` | thoát 0 | `logs/build.log` |
| `python3 -m pytest tests/` | 176 ca đạt | `logs/pytest.log` |
| PGlite với coverage | 92 tệp đạt, 15 bỏ qua; 1574 ca đạt, 162 bỏ qua. Coverage trên danh sách tệp: câu lệnh 96,12 %, nhánh 91,99 %, hàm 97,84 %, dòng 97,83 % | `logs/pglite-coverage.log` |
| PostgreSQL 16 (container cục bộ, kể cả diễn tập khôi phục N4) | 107 tệp, 1736 ca đạt, không ca nào bỏ qua | `logs/native.log` |

## Chưa chứng minh được

- Các ticket ngày 20/11 (tệp lớn, Excel, hết giờ chờ, quyền thư mục): không có hồ sơ trong repo (EV-05, EV-30, EV-31, EV-32). PR này chỉ sửa phần thấy được trong mã. Không ticket nào được ghi «đã đóng».
- Câu trả lời của bot trên gateway thật: chưa triển khai.
