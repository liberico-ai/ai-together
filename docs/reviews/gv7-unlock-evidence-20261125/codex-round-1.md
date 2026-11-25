VERDICT: CHANGES_REQUIRED

- [P0] migrations/rollback/028_unlock_092.sql:33 — Rollback xoá cả dòng nguồn có tiền tố `work_request:` đã tồn tại trước migration 028.
  Kịch bản: người vận hành đã ghi một `bom_sources` với tiền tố đó, chưa có phiếu 3/3 → rollback vượt qua các điều kiện từ chối rồi xoá dòng nguồn.
  Căn cứ: `migrations/006_bom_allocations.sql` không dành riêng tiền tố này; yêu cầu rollback không làm mất lịch sử.

- [P1] src/components/work-import.tsx:60 — Luồng nhập trên web không gửi `fileName`, nên lô nhập thực tế luôn thiếu tên tệp mới được yêu cầu lưu.
  Kịch bản: PM chọn tệp và hoàn tất nhập trên web → `work_import_batches.file_name` là `NULL`.
  Căn cứ: OQ-62 câu 6; GIAO VIỆC 7 M8.

- [P1] src/server/work-requests.ts:109 — BoM Tech chỉ có trong `identity.tech_bom`, không có trong roster hay membership, đăng nhập và thấy danh mục nhưng không gửi được yêu cầu.
  Kịch bản: tài khoản BoM Tech hợp lệ chưa được thêm vào roster → `submit` trả `WORK_REQUEST_DENIED`; chính sách `work_request_filer` cũng chỉ nhận roster hoặc manager.
  Căn cứ: GIAO VIỆC 7 M6; định nghĩa Team Tech “roster hay BoM Tech” của M2.

- [P1] src/server/sheet-import.ts:333 — Kiểm tra gọi lại lô nhập bỏ qua `fileName`, dù tên tệp đã trở thành dữ liệu của lệnh ghi.
  Kịch bản: gửi lại cùng `requestKey`, digest và ánh xạ nhưng đổi `fileName` → nhận biên nhận cũ thay vì `IDEMPOTENCY_CONFLICT`.
  Căn cứ: E-BE-08; OQ-62 câu 6.