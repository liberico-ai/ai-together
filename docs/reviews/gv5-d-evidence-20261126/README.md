# Bằng chứng GIAO VIỆC 5 D — bot nói đúng nguyên nhân; che ghi chú IBS HI ở Z2 (26/11/2026)

Nhánh `feat/gv5-d-bot-replies`, trên `8d1e7a4` (bản 0.9.2). Đường dẫn máy trong log đã thay bằng `<repo>`, `<local>`, `<tmp>`; địa chỉ CSDL, nếu có, thành `<db>`. Log chỉ chứa dữ liệu mẫu của bộ test.

## Đỏ trước, xanh sau

- `logs/red-first-ts.txt`: bốn tệp ca mới chạy trên mã `8d1e7a4` (một worktree nháp): `bridge-replies`, `bridge-reply-coverage`, `tech-source-mask`, `ibs-label`. **16 ca hỏng, 16 dòng `AssertionError`.**
- `logs/red-first-py.txt`: `tests/test_bot_replies.py` trên mã đó: 6 ca hỏng, đều là `AssertionError`; 1 ca xanh. Ca xanh là ca canh «không câu nào nêu tên dự án hay BU», vì câu trả mã trơ cũ cũng không nêu.
- `logs/pglite-first-run.txt`: lượt đủ bộ đầu tiên sau khi viết mã, có 5 ca hỏng, ba nguyên nhân. Đã sửa cả ba trước khi commit:
  - bảng giữ chưa có policy (ca danh mục RLS). Thêm policy từ chối mọi dòng;
  - `AppError` luôn mang trường `reason` rỗng (ba ca Z4 so khoá của lỗi). Chỉ gắn trường khi có giá trị;
  - ca G12 liệt kê đúng các trigger của `project_domain_mappings`. Thêm trigger của 029 vào danh sách, như đã làm khi 023 thêm trigger.
- Các ca cũ đòi bot trả mã trơ (11 chỗ trong `tests/test_bot_bridge.py`) được đổi sang đúng câu của bảng cho cùng mã.

## Cổng Codex, một vòng (`codex-round-1.md`)

Đầu vào: `codex-context-round-1.md` cùng diff `8d1e7a4..2af52b5` của `src`, `migrations`, `scripts`, `bot-plugin`, `tests`, `vitest.config.ts`, `package.json`. Kết quả: `VERDICT: CHANGES_REQUIRED`, **một P0 và một P1**. Cả hai đã sửa ở `57dcb9c`, sau vòng này, nên Codex chưa đọc lại. Không chạy vòng hai.

| Mức | Chỗ | Finding | Đã làm | Ca kiểm đỏ trước |
|---|---|---|---|---|
| P0 | trigger đổi miền của 029 | Xác nhận `IBS_HI` lần nữa, sau khi đổi miền và sửa ghi chú, để chữ mới còn đọc được ở Z2 (khoá đã giữ chữ cũ) | Bảng giữ giữ mỗi bản chữ khác nhau của một dòng (UNIQUE theo md5 của chữ). Hàm chuyển để trống dòng, rồi từ chối nếu còn sót. Hoàn tác từ chối khi một dòng có hai bản. Codex gợi ý từ chối lần xác nhận; không làm vậy, vì dự án sẽ ở lại trạng thái chưa xác nhận, chữ vẫn đọc được và các rào IBS HI khác không bật | `a project confirmed IBS HI again…` (`red-after-codex-ts.txt`) |
| P1 | công cụ đọc của plugin | `reason` bất kỳ dạng chữ hoa từ máy chủ tới được mô hình | Chỉ nhận năm giá trị có câu trả lời | `…never passes on an unknown reason`, `…keeps a wellformed reason only` (`red-after-codex-py.txt`) |

Sửa thêm trong cùng commit, không do Codex nêu: người vận hành đổi nhãn BU của dự án thành IBS HI thì ghi chú cũ cũng được giữ (trigger `AFTER UPDATE OF bu`). App không có lệnh đổi nhãn. Ca `renaming a project to an IBS HI label…` đỏ trước.

- `red-after-codex-ts.txt`: 4 ca hỏng trên `2af52b5`. Ba ca hỏng bằng `AssertionError`. Ca thứ tư (hoàn tác cuối tệp) hỏng bằng lỗi CSDL, vì hai ca trước đã dừng giữa chừng và chưa dọn dòng.

**Không có lượt đọc độc lập sau cổng lần này.** Lý do: tài khoản Claude vừa chạm hạn mức chi tiêu. Phần sửa sau cổng được kiểm bằng ca đỏ trước và bộ test đầy đủ trên cả hai CSDL.

## Cổng trên cây cuối `57dcb9c`

| Cổng | Kết quả | Log |
|---|---|---|
| `npm run typecheck` | thoát 0 | `logs/typecheck.log` |
| `npm run build` | thoát 0 | `logs/build.log` |
| `python3 -m pytest tests/` | 174 ca đạt | `logs/pytest.log` |
| PGlite với coverage | 88 tệp đạt, 15 bỏ qua; 1555 ca đạt, 162 bỏ qua. Coverage trên danh sách tệp: câu lệnh 96,17 %, nhánh 92,02 %, hàm 97,82 %, dòng 97,8 % | `logs/pglite-coverage.log` |
| PostgreSQL 16 (container cục bộ, kể cả diễn tập khôi phục N4) | 103 tệp, 1717 ca đạt, không ca nào bỏ qua | `logs/native.log` |

Một lần build đầu trên worktree này hỏng vì `node_modules` là liên kết tượng trưng, Turbopack không đi theo. Worktree được cấp bản sao riêng (lockfile chỉ khác số bản), rồi build lại.

## Chưa chứng minh được

- Nguyên nhân thật của ca (a) `unauthorized`: chữ đó không có trong mã (EV-03, EV-16).
- Ca (b) rơi vào trường hợp nào trong bốn nguyên nhân (EV-04, EV-17).
- Câu trả lời của bot trên gateway thật: chưa triển khai. Không ca lỗi nào được ghi «đã đóng».
