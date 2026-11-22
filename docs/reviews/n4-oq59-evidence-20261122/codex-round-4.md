VERDICT: CHANGES_REQUIRED

- [P2] `deploy/post-restore.sql:61` — Phép kiểm mặc định khớp chuỗi con, nên có thể từ chối cả một mặc định **khác** `libetech.archive_kind`.
  Kịch bản: Role chạy tệp có `ALTER ROLE … SET libetech.archive_kind_hint = 'post-023'` và người chạy truyền đúng `archive_kind` bằng `-c` → vẫn nhận `POST-RESTORE-01` và phục hồi dừng.
  Căn cứ: `POST-RESTORE-01`; `docs/RUNBOOK-RESTORE-AFTER-023.md:88` chỉ yêu cầu từ chối mặc định của chính khoá loại bản lưu.

Về câu hỏi miền báo cáo: biên nhận phục hồi có chứa số liệu vận hành, nhưng `revisions` và `threads` toàn CSDL đã có từ N4; diff này không tạo phép cộng đó. Nếu áp `AGENTS.md:16` cho cả biên nhận phục hồi, đây là việc tồn tại trước PR cần quyết định và sửa riêng, không phải P1 mới của diff. `foreign_keys` là số ràng buộc lược đồ, không phải tổng dữ liệu của các miền.

Không thấy cách xác thực người chạy tay đã gõ đúng loại **thực** của bản lưu chỉ từ `current_setting` và dữ liệu đích, khi giữ nguyên `restore-plan.py`. Giới hạn này đã được ghi rõ; các log cung cấp bằng chứng diễn tập trên CSDL thử, chưa phải triển khai hay nghiệm thu.

