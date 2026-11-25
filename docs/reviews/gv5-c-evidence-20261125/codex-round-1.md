VERDICT: CHANGES_REQUIRED

- [P0] migrations/027_work_imports.sql:101 — Hàm xung đột cho phép dò mã việc và nội dung đã nhập ở dự án ngoài quyền xem, vượt quá tiết lộ “con trỏ đã được nhập” được khai báo.
  Kịch bản: Người quản lý dự án A gửi bản xem trước với nguồn bảng đã biết, STT mới và mã việc đoán trước → `CODE_UNDER_OTHER_ROW` xác nhận mã đó có trong dòng của dự án B; thử nội dung đoán trước có thể nhận `CONTENT_UNDER_OTHER_STT`.
  Căn cứ: AGENTS.md về cô lập dự án; OQ-62 câu 8 và kế hoạch mục 13 chỉ khai báo tiết lộ trạng thái của con trỏ.

- [P1] src/server/sheet-import.ts:321 — `previewDigest` không gắn với ánh xạ dự án và người, nên API chấp nhận ghi một ánh xạ khác với ánh xạ đã xem trước.
  Kịch bản: Xem trước nhãn LBRC vào dự án A, rồi dùng cùng digest để ghi vào dự án B → lệnh ghi qua kiểm tra digest dù cờ, xung đột mã và miền báo cáo của B chưa được xem trước. Digest cũng là SHA-256 tính được từ dữ liệu đầu vào, không phải bằng chứng server đã phát hành bản xem trước.
  Căn cứ: yêu cầu “xem trước bắt buộc”; kế hoạch mục 13, “Xem trước nhận ánh xạ”.

- [P1] migrations/027_work_imports.sql:161 — RLS của `work_import_batches` cho phép bot principal chèn lô nếu chạy dưới vai `libetech_runtime`; tầng dịch vụ từ chối bot nhưng chính sách bảng không từ chối.
  Kịch bản: Transaction runtime có `app.person_id` của bot và tenant đúng → `INSERT work_import_batches` với `importer_id` của bot vượt qua `WITH CHECK`, tạo biên nhận giả.
  Căn cứ: AGENTS.md “Bot principal is read-only”; yêu cầu kiểm quyền ở RLS.

- [P1] migrations/rollback/027_work_imports.sql:20 — Rollback lần hai lỗi vì `DROP TRIGGER … ON work_import_rows` vẫn cần bảng tồn tại sau khi rollback lần đầu đã xoá bảng.
  Kịch bản: Chạy rollback 027 trên bản thử sạch, rồi chạy lại như `tests/migrations-rollback.test.ts` yêu cầu → PostgreSQL báo không có relation `work_import_rows`.
  Căn cứ: kế hoạch mục 13 về rollback; handoff mục 7 yêu cầu test xanh.

- [P2] src/server/csv.ts:31 — Bộ đọc chấp nhận dấu ngoặc kép nằm giữa ô không được trích dẫn, trái với hợp đồng CSV RFC 4180.
  Kịch bản: Ô `Việc "sai" dạng` không được bao trong dấu ngoặc kép → parser nhận và có thể đưa vào bản xem trước thay vì báo `CSV_MALFORMED`.
  Căn cứ: hợp đồng bộ đọc CSV trong hạng mục C.

