VERDICT: CHANGES_REQUIRED

- [P0] [migrations/025_intake_pool_links.sql:117](<repo>/migrations/025_intake_pool_links.sql:117) — Hàm `intake_pool_link_count` cho mọi thành viên Tech đếm liên kết của dự án họ không được đọc.
  Kịch bản: Thành viên chỉ có quyền dự án Y biết ID mục pool đã gán cho X → RLS không cho đọc liên kết, nhưng gọi hàm dưới vai `libetech_runtime` vẫn nhận số liên kết của X.
  Căn cứ: OQ-61 B2; `AGENTS.md` về quyền đọc theo dự án và cô lập dữ liệu.

- [P1] [src/components/inbox-pool.tsx:36](<repo>/src/components/inbox-pool.tsx:36) — Nút “Liên kết việc đã có” đi vào nhánh tạo yêu cầu vì `FormData(form)` không chứa giá trị của nút submit.
  Kịch bản: Người dùng nhập mã việc rồi bấm “Liên kết việc đã có” → `mode` rỗng, gửi `file_request` thay vì `link_work`.
  Căn cứ: Kế hoạch GV5-B mục 3.2 và ca T4-18.

- [P1] [migrations/025_intake_pool_links.sql:57](<repo>/migrations/025_intake_pool_links.sql:57) — CHECK của `intake_pool_events.payload` giới hạn tên khóa nhưng không giới hạn giá trị, nên vẫn nhận chữ tự do.
  Kịch bản: Vai runtime với người thao tác hợp lệ chèn payload `{"classification":"nội dung tin"}` → dòng lịch sử được lưu và thành viên roster đọc được, kể cả khi mục sau đó thuộc IBS HI.
  Căn cứ: `AGENTS.md` về dữ liệu IBS HI; kế hoạch GV5-B mục 3.1 yêu cầu pool không giữ chữ.