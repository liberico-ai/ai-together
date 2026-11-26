VERDICT: CHANGES_REQUIRED

- [P0] src/server/intake-pool.ts:250 — Sự kiện gỡ công bố `link_id` và `reason_code` cho cả thành viên Team Tech không có quyền đọc liên kết.
  Kịch bản: Một thành viên Tech không thuộc dự án không thấy liên kết trên thẻ, nhưng gọi chi tiết mục nhóm chung vẫn nhận payload `pool.link_revoked`; policy của `intake_pool_events` cho toàn Team Tech đọc.
  Căn cứ: Q-GV5E-1 yêu cầu quyền đọc liên kết; quy tắc cô lập dự án trong AGENTS.md; `migrations/025_intake_pool_links.sql:177–179`.

- [P1] migrations/030_intake_link_revocations.sql:34 — Policy INSERT không kiểm tra tư cách Team Tech đối với liên kết của nhóm chung.
  Kịch bản: Người tạo liên kết bị rút khỏi Team Tech vẫn có thể ghi dòng thu hồi bằng vai `libetech_runtime` và ngữ cảnh của mình; service có chặn, nhưng RLS không giữ cùng điều kiện.
  Căn cứ: Q-GV5E-1: ở nhóm chung, người gỡ còn phải là thành viên Team Tech.

- [P2] src/server/csv.ts:63 — Chữ ký ZIP bị kết luận là `.xlsx` dù không xác minh định dạng workbook.
  Kịch bản: Tệp ZIP thường được chọn hoặc đổi tên thành `.csv` → màn hình khẳng định đó là tệp Excel và hướng dẫn xuất CSV sai nguyên nhân.
  Căn cứ: GIAO VIỆC 5 E yêu cầu báo rõ lỗi tệp cho người dùng.