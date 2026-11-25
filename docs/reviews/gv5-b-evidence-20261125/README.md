# Bằng chứng GV5-B — tin Telegram thành việc, từng bước; nhóm chung của Team Tech (25/11/2026)

Nhánh `feat/gv5-b-intake-to-work`, một commit trên `d0d3d76` (merge của hạng mục A). Đường dẫn máy trong log đã thay bằng `<repo>`, `<local>`, `<tmp>`. Log không chứa dữ liệu team: chỉ dữ liệu mẫu của bộ test.

## Cổng Codex — một vòng

- `codex-context-round-1.md`: khối ngữ cảnh gửi kèm diff mã (`src`, `migrations`, `deploy`, `scripts`, `bot-plugin`, `tests`, `vitest.config.ts`; 287 134 ký tự cả lời nhắc).
- `codex-round-1.md`: kết quả nguyên văn. Dòng đầu: `VERDICT: CHANGES_REQUIRED`.
- Vòng chạy trên cây `5df283e`. Bản ghi hội thoại của Codex không commit.

| Mức | Chỗ | Finding | Đã làm | Ca kiểm |
|---|---|---|---|---|
| P0 | `migrations/025_intake_pool_links.sql` | `intake_pool_link_count` trả số liên kết của một mục pool trong một dự án cho mọi thành viên roster, kể cả người không đọc được dự án đó | Bỏ hàm. Thay bằng `intake_pool_links_outside(item, project, readable)`: trả một bit, có liên kết nào ngoài các yêu cầu người gọi nêu hay không. Lệnh mở lại nêu các yêu cầu bị từ chối mà chính người gọi đọc được dưới RLS | (11) `tests/intake-pool-isolation.test.ts` |
| P1 | `src/components/inbox-pool.tsx` | Nút «Liên kết việc đã có» gửi `file_request`, vì `new FormData(form)` không mang nút submit | Đọc nút từ `nativeEvent.submitter`, như `feedback.tsx` và `team-accounts.tsx` | (28) `tests/inbox-ui.test.tsx` |
| P1 | `migrations/025_intake_pool_links.sql` | CHECK của `intake_pool_events.payload` giới hạn khoá, không giới hạn giá trị | Giá trị cũng đóng: trạng thái và mã trong danh sách, số, id dự án dạng uuid | (12) `tests/intake-pool-isolation.test.ts` |

Ba sửa trên làm sau vòng Codex, nên Codex chưa đọc lại. Cổng test chạy lại trên cây cuối.

## Đỏ trước khi viết mã

- `logs/red-before-code.txt`: lần chạy đầu của người dựng, ca viết trước mã: 6 tệp, 19 ca hỏng, 16 dòng `AssertionError`.
- `logs/red-before-codex-fixes.txt`: ba ca mới viết trước sửa theo Codex: 3 tệp, 5 ca hỏng, 5 dòng `AssertionError`, 0 dòng hết giờ.
- `logs/green-codex-fixes.txt`: cùng năm tệp sau khi sửa: 80 ca qua, 2 bỏ qua (ca chỉ chạy trên PostgreSQL).

## Sau khi rebase lên A

- Hai ca của `tests/intake-links.test.ts` duyệt mà không có người thực hiện; A trả `ASSIGNEE_REQUIRED`. Hai ca nay chọn người thực hiện. Ca (5) bỏ luật đọc giả lập, chạy trên luật đọc thật của A.
- `fileRequestIn` giữ lần kiểm `work_request_filer(project)` của A trước khi chèn.
- `tests/thread-order-concurrency.test.ts` (chỉ chạy trên PostgreSQL) gỡ 024 rồi mới gỡ 023; với 025 và 026 của B ở trên, lần gỡ 024 bị từ chối và cả 30 ca hỏng ở bước chuẩn bị (lần chạy PostgreSQL đầu trên `9a92c42`: 91 tệp qua, 1 tệp hỏng, một câu lỗi «Roll back the later migrations before 024.»). Nay gỡ 026, 025, 024 theo thứ tự, như ba bộ ca kiểm gỡ 023 khác của B. Các log dưới đây chạy lại sau sửa này.

## Xanh trên cây mã cuối

Cây lúc chạy: `9a92c42` cộng sửa `tests/thread-order-concurrency.test.ts` ở trên, chưa commit (`git status` lúc chạy chỉ có tệp đó). Commit của PR là cây đó cộng thư mục này. `build.log` và `pytest.log` chạy trên `9a92c42` trước sửa ấy; sửa chỉ chạm một tệp test, không vào bản build hay plugin.

| Log | Lệnh | Kết quả |
|---|---|---|
| `logs/typecheck.log` | `npm run typecheck` | exit 0 |
| `logs/build.log` | `npm run build` | exit 0 |
| `logs/pytest.log` | `python3 -m pytest tests/test_bot_bridge.py -q` | 82 qua, 69 subtest qua |
| `logs/pglite-coverage.log` | `npx vitest run --coverage` | 78 tệp qua, 14 bỏ qua; 1434 ca qua, 158 bỏ qua; dòng 96.36 %, nhánh 91.93 % |
| `logs/native.log` | `npx vitest run` trên PostgreSQL 16 | 92 tệp qua; 1592 ca qua |
| `logs/native-before-thread-order-fix.log` | lần đầu trên PostgreSQL, trên `9a92c42` | 91 tệp qua, 1 tệp hỏng (30 ca, ở bước chuẩn bị) — giữ để đối chiếu |

Mức: **đã có mã · đã thử trên CSDL thử**. Chưa triển khai, chưa nghiệm thu với team.
