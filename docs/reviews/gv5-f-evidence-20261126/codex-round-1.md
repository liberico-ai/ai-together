VERDICT: CHANGES_REQUIRED

- [P0] src/server/reminders.ts:111 — Kiểm tra phạm vi bằng hợp các dự án, không kiểm tra nhóm đích có phục vụ chính dự án của tin nhắc.
  Kịch bản: Dự án A thuộc nhóm A, nhưng `reminder_targets` của A trỏ nhầm tới nhóm B; cả hai nhóm có trong cấu hình intake → plugin chấp nhận và nhóm B nhận tên thành viên của A.
  Căn cứ: Kế hoạch GV5-F §2.1, §2.2; DOC-10, PM-04.

- [P0] src/server/outbox.ts:143 — Khi kéo tin đã xếp hàng, worker không kiểm tra lại đích còn bật, nhóm còn đúng hay dự án còn được phép nhận nhắc.
  Kịch bản: Xếp tin GO LIVE → tắt hoặc đổi nhóm đích, hay chuyển dự án sang IBS HI → trong sáu giờ worker vẫn giao tin tới nhóm cũ nếu nhóm đó còn trong `intake.json`.
  Căn cứ: GV5-F Q-F3; SPEC-009 §75, DOC-11 về kiểm quyền lúc gửi.

- [P1] src/server/reminders.ts:92 — Đổi giờ tạo tin mới nhưng không hủy tin giờ cũ còn `pending`.
  Kịch bản: Tin nhắc 09:00 đã xếp hàng; ghế BoM đổi buổi đó sang 14:00 trước khi gateway kéo → hai tin giờ khác nhau đều được gửi.
  Căn cứ: GV5-F §2.3–2.4: nhắc theo giờ hiện hành của đúng buổi.

- [P1] src/server/outbox.ts:143 — Hạn sáu giờ tính từ lúc xếp hàng, không xét giờ bắt đầu buổi họp.
  Kịch bản: Tin họp 09:00 xếp lúc 07:15, gateway phục hồi lúc 11:00 → tin vẫn được gửi sau khi buổi họp đã bắt đầu.
  Căn cứ: GV5-F §7, Q-GV5F-5: bỏ tin nhắc muộn.

- [P1] deploy/reminder-targets.sql:19 — Cập nhật cấu hình đích không có expected version; lệnh cũ có thể ghi đè quyết định mới.
  Kịch bản: Người vận hành B đổi hoặc tắt đích; người vận hành A chạy lại lệnh chuẩn bị trước đó → cấu hình cũ được bật lại mà không báo xung đột.
  Căn cứ: AGENTS.md: mọi ghi dùng expected version và audit bất biến.

Đây là review tĩnh trong chế độ chỉ đọc; chưa có bằng chứng chạy test hoặc gửi thật. Hai finding P0 chặn merge theo cổng của hạng mục F.

