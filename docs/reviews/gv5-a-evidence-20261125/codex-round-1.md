VERDICT: CHANGES_REQUIRED

- [P0] `migrations/024_work_requests.sql:156` — RLS cho phép bot và viewer có quyền xem dự án chèn yêu cầu trực tiếp dưới `libetech_runtime`.
  Kịch bản: phiên DB đặt `app.person_id` là bot và `app.project_ids` chứa dự án → `request_file` chấp nhận `INSERT` dù API trả `READ_ONLY`.
  Căn cứ: `AGENTS.md` — bot chỉ đọc; yêu cầu kiểm quyền ở repository và RLS.

- [P1] `migrations/024_work_requests.sql:189` — Trigger cho phép ghế BoM từ chối yêu cầu mà không ghi sự kiện quyết định bất biến.
  Kịch bản: ghế BoM chạy `UPDATE` trực tiếp với `state='rejected'`, người quyết và `version=2` → yêu cầu thành đã từ chối nhưng không có dòng `work_request_events`.
  Căn cứ: `AGENTS.md` — mọi ghi có audit event bất biến; kế hoạch GV5-A mục 2 và 3.

- [P1] `migrations/rollback/024_work_requests.sql:20` — Rollback chạy lần hai lỗi vì `DROP TRIGGER IF EXISTS … ON work_requests` vẫn yêu cầu bảng tồn tại.
  Kịch bản: rollback lần đầu xóa bảng; lần hai dừng ở dòng 20 trước `COMMIT`, trái với ca test đã viết.
  Căn cứ: `tests/migrations-rollback.test.ts` — ca rollback 024 chạy lặp; handoff mục 7 yêu cầu test xanh.

- [P1] `deploy/bom-seats.sql:25` — Script không kiểm tra dự án thuộc `tenant_id` được truyền vào.
  Kịch bản: operator nhập tenant A và project của tenant B bằng tài khoản `BYPASSRLS` → script cập nhật ghế của B và ghi sự kiện dưới B thay vì từ chối bộ tham số sai.
  Căn cứ: `AGENTS.md` — cô lập tenant; quy tắc E-DB về phạm vi ghi.