# Kế hoạch GIAO VIỆC 5 · hạng mục E (tệp, tài liệu) và B6 (gỡ liên kết sai)

Ngày 26/11/2026 · nền `libetech-ai-os` @ `d9a2318` (sau PR 4) · PR 5.

- **E:** tệp giao việc 5.
- **B6:** OQ-61 B6 (2), «lệnh thu hồi có sự kiện riêng». Tệp giao việc 7 chuyển B6 sang đợt D–F.

## 1. Hiện trạng (#fact, đọc mã)

1. **Ticket ngày 20/11:** repo này và plugin priority1 không có bản ghi nào của chúng. Sổ ticket priority1 là CSDL sống trên máy chủ, ngoài repo (EV-05, EV-30).
2. **Tệp đính kèm từ Telegram:** giới hạn 20 MB, danh sách loại được nhận (`intake-rules.ts`, plugin). Khi hỏng, câu trả lời chỉ nói «chưa lưu được tệp đính kèm», không nói vì sao (quá lớn, sai loại, tải hỏng, lưu hỏng).
3. **Nhập bảng:** máy chủ báo rõ từng giới hạn (256 KB, 500 dòng, 2000 ký tự). Gửi tệp `.xlsx` thì chỉ nhận câu «không phải UTF-8».
4. **Màn hình nhập:** lệnh gọi không có thời hạn (`src/components/api.ts`). Nếu treo, nút đứng ở «Đang đọc…» mãi.
5. **Tài liệu (ADR-002):** chỉ lưu con trỏ; repo không đọc Drive. «Quyền thư mục» nằm ngoài mã repo này (EV-32).
6. **Liên kết tin–việc** (`intake_work_links`, 025) chỉ thêm: không có quyền UPDATE hay DELETE, có trigger chặn.
   - Liên kết sai không gỡ được.
   - Mục nhóm chung chỉ mở lại được khi mọi liên kết là yêu cầu bị từ chối.

## 2. E — cơ chế

- **Lý do của tệp hỏng:** máy chủ thêm tham số `attachmentReason` vào biên nhận `intake.attachment_failed`. Giá trị là một trong `TOO_LARGE`, `UNSUPPORTED_TYPE`, `DOWNLOAD_UNAVAILABLE`, `STORE_UNAVAILABLE`; lý do khác thì không gửi.
  - Plugin 0.3.5 có một câu cho mỗi lý do, nêu giới hạn 20 MB và loại được nhận.
  - Plugin cũ bỏ qua tham số lạ, nên gửi câu chung như trước.
- **Tệp Excel:** tệp bắt đầu bằng chữ ký ZIP ra mã `XLSX_NOT_SUPPORTED` (422). Câu báo nói cách tải CSV từ Google Sheets.
  - Không thêm thư viện đọc `.xlsx`.
- **Thời hạn của màn hình nhập:** mỗi lệnh nhập chờ tối đa 60 giây, quá thì báo `CLIENT_TIMEOUT`.
  - Câu báo nói rõ lần ghi **có thể đã xong**. Bấm lại thì dùng cùng mã thao tác nên không tạo trùng.

## 3. B6 — gỡ liên kết (Zone Z1)

- **Bảng mới `intake_link_revocations`** (chỉ thêm), migration 030:
  - cột `tenant_id`, `project_id`, `link_id`, `revoked_by`, `revoked_by_name`, `reason_code`;
  - `UNIQUE(tenant_id, link_id)`: một liên kết gỡ một lần;
  - `reason_code` là một trong `wrong_work`, `wrong_message`, `wrong_project`, `mistake`. **Không có chữ tự do**, nên liên kết ở IBS HI không mang thêm chữ nghiệp vụ nào;
  - RLS ENABLE và FORCE. Đọc được khi đọc được liên kết. Ghi chỉ khi người ghi là chính mình, và là **người tạo liên kết** hoặc **một ghế BoM của dự án đó**;
  - runtime chỉ có SELECT và INSERT; trigger chặn UPDATE, DELETE.
- Dòng liên kết gốc không đổi.
- **Hiệu lực:**
  - Liên kết đã gỡ không còn tính trong chuỗi bước. Vẫn hiện với «Đã gỡ», người gỡ, giờ và lý do.
  - Yêu cầu và việc đã tạo giữ nguyên.
  - Mục nhóm chung mở lại được khi mọi liên kết còn hiệu lực là yêu cầu bị từ chối đọc được, hoặc đã gỡ hết và người đó đọc được ít nhất một liên kết đã gỡ. Hàm `intake_pool_links_outside` bỏ qua liên kết đã gỡ.
  - Không nối lại được đúng cặp tin–việc đã gỡ (`LINK_REVOKED`). Muốn nối thì chọn việc đúng.
- **Lệnh:** `revoke_link {expectedVersion, linkId, reasonCode}` ở cả hai đường: mục nhóm chung và ứng viên của dự án.
  - Gọi lần hai không ghi thêm gì.
  - Sai quyền thì `REVOKE_DENIED`, kèm câu báo nói nhờ ai.
  - Lệch phiên bản thì `REVISION_CONFLICT`.
- **Sự kiện:** `pool.link_revoked` (mở rộng CHECK của `intake_pool_events`) hoặc `candidate.link_revoked`. Payload gồm mã liên kết, lý do và phiên bản trước, sau.
- **Giao diện:** mỗi liên kết còn hiệu lực mà người xem gỡ được có nút «Gỡ liên kết» kèm chọn lý do. Thẻ ứng viên có thêm danh sách liên kết.
- **Hoàn tác 030:** từ chối khi còn dòng gỡ hoặc sự kiện `pool.link_revoked` (đó là lịch sử), hoặc khi có migration lớn hơn 030.

## 4. Task và ca kiểm (viết trước, thấy đỏ bằng lỗi khẳng định)

- **T1** `tests/attachment-reason.test.ts`: tệp quá lớn, sai loại, plugin báo tải hỏng hay lưu hỏng → biên nhận mang đúng `attachmentReason`. Lý do lạ → không có tham số.
- **T2** `tests/test_attachment_replies.py`:
  - mỗi lý do ra một câu riêng, có «20 MB» ở câu quá lớn;
  - tham số lạ hoặc thiếu → câu chung như cũ.
- **T3** `tests/import-limits.test.ts`:
  - byte chữ ký ZIP → `XLSX_NOT_SUPPORTED`, câu có «CSV»;
  - `api()` quá thời hạn → `ApiError` mã `CLIENT_TIMEOUT`, câu nói «có thể đã ghi xong».
- **T4** `tests/link-revoke.test.ts`:
  - người tạo gỡ được; ghế BoM của dự án gỡ được;
  - thành viên Tech khác bị `REVOKE_DENIED`;
  - gọi hai lần → một dòng gỡ và một sự kiện;
  - phiên bản cũ → `REVISION_CONFLICT`, không ghi gì;
  - nối lại cùng cặp → `LINK_REVOKED`;
  - chuỗi bước không còn «Đã liên kết» sau khi gỡ; thẻ hiện người gỡ và lý do;
  - gỡ liên kết duy nhất → mở lại được mục;
  - ứng viên: lệnh gỡ ghi `candidate.link_revoked`, đúng một lần với cùng khoá;
  - RLS: runtime không UPDATE, không DELETE; ghi dòng gỡ thay người khác bị từ chối;
  - **IBS HI:** gỡ liên kết ở dự án IBS HI không lưu chữ nào; câu báo lỗi không nêu tên dự án.
- **T5** (cùng tệp T4): 030 áp hai lần được; hoàn tác từ chối khi còn dòng gỡ; hoàn tác sạch trả lại hàm và CHECK cũ; chạy lần hai không lỗi.
- **T6** `tests/link-revoke-ui.test.tsx`: nút gỡ chỉ hiện khi `canRevoke`; liên kết đã gỡ hiện «Đã gỡ».

## 5. Runbook (phần thêm)

- Migration 030 áp bằng login migration.
- **Plugin đổi (0.3.4 → 0.3.5):** gộp chung với lần khởi động lại gateway của PR 4. Chỉ ngoài giờ, có lời Chairman, sau đó kiểm 20/20 bot.
- Web mới chạy được với plugin cũ.

## 6. Cách hiểu tạm (`docs/OPEN-QUESTIONS.md`)

- **Q-GV5E-1.** Ai được gỡ: người tạo liên kết hoặc ghế BoM của dự án. Phương án khác: thêm điều phối dự án.
- **Q-GV5E-2.** Không nối lại đúng cặp đã gỡ. Phương án khác: cho nối lại, cần đổi khoá duy nhất của 025.

## 7. Nghiệm thu (thêm vào kịch bản 5)

- Một thành viên gửi lần lượt tệp quá 20 MB và tệp loại không nhận ở nhóm được ghi nhận, gọi bot. Câu trả lời nói đúng lý do.
- PM nhập nhầm tệp `.xlsx` → câu báo có cách tải CSV.
- `Tech-1` nối một tin vào sai việc rồi tự gỡ. Chuỗi bước cập nhật; việc và yêu cầu không đổi.

## 8. Ngoài phạm vi

F (lịch nhắc) ở PR 6. Không đọc Drive. Không thêm thư viện. Không đổi quyền đọc ngoài lệnh gỡ.
