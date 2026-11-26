VERDICT: CHANGES_REQUIRED

- [P0] migrations/029_mask_ibs_hi_source_notes.sql:49 — Trigger đổi miền có thể để ghi chú lộ lại ở Z2 khi khoá đã có một bản ghi giữ với chữ khác.
  Kịch bản: Dự án được xác nhận `IBS_HI` và ghi chú A được giữ → xác nhận lại miền khác, dòng nguồn mang ghi chú B → xác nhận `IBS_HI` lần nữa; `ON CONFLICT DO NOTHING` bỏ qua B, câu `UPDATE` không xoá B, nhưng mapping vẫn được ghi. Vai ứng dụng và projector tiếp tục đọc được B từ `tech_source_tasks`.
  Căn cứ: OQ-62 câu 4(b); AGENTS.md — IBS HI chỉ giữ con trỏ, hash và metadata việc Tech. Kiểm tra trạng thái còn ghi chú ngay trong trigger như migration đã làm ở dòng 59–62.

- [P1] bot-plugin/__init__.py:1579 — Công cụ đọc chép nguyên `reason` từ phản hồi máy chủ vào kết quả cho mô hình, dù `reason` chưa được giới hạn vào năm giá trị đã định.
  Kịch bản: Phản hồi lỗi mang `reason: "SECRET_API_KEY"` → `BackendError` chấp nhận chuỗi này và `libetech_os_read` đưa nó vào JSON; mô hình có thể nhìn thấy và gửi lại.
  Căn cứ: GIAO VIỆC 5 D — câu báo lỗi không được chép chuỗi tự do hoặc bí mật từ máy chủ; `docs/plans/gv5-d-bot-replies.md` §2.2.