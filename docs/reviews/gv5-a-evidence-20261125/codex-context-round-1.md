## Việc (GIAO VIỆC 5, hạng mục A — không phải lát 1–5)

Thành viên Team Tech tạo việc ở mọi dự án; việc mới chờ một ghế BoM duyệt. Lời Chairman ngày 25/11/2026, chép nguyên (cũng ở cuối `docs/OPEN-QUESTIONS.md`):

- «Tất cả thành viên Team Tech được tạo việc ở tất cả các dự án. Màn hình tạo việc hiển thị đủ danh sách dự án cho thành viên Tech.»
- «Việc mới ghi ở trạng thái chờ BoM xác nhận hoặc phê duyệt. BoM Tech: Chu Hoàng Anh, Quân, Phương.»
- «Giữ luật xác nhận 3/3 khi chia lại nhiệm vụ, kể cả chia việc giữa ba thành viên BoM. Quyết định khác cần BoM duyệt: hiện trạng thái và người đã duyệt theo quy chế hiện có.»
- «Các phản ánh lịch sử có thể chưa được thu nhận đầy đủ. Đối chiếu thêm trực tiếp với Quân, Phương và tin gốc trước khi đánh dấu một lỗi đã đóng.»

Theo giao việc của Cowork điều phối: cổng chạy **một vòng** mỗi PR. Chỉ P0 chặn merge (rò dữ liệu, leo quyền, mất dữ liệu); P1/P2 ghi vào biên nhận và sửa tiến. Vẫn xếp hạng mọi finding theo thang của lời nhắc trên.

Đầu vào là **diff của mã** (`src`, `migrations`, `deploy`, `scripts`, `tests`, `vitest.config.ts`) so với `libetech-ai-os` (`66e0c78`). Đọc `docs/plans/gv5-a-tech-create-approval.md`, OQ-60 và khối 25/11 cuối `docs/OPEN-QUESTIONS.md`, `docs/EVIDENCE-REQUEST-20261125.md` và phần còn lại từ cây làm việc.

## Đã đổi

- `migrations/024_work_requests.sql` (+ `rollback/024`):
  - `identity.tech_roster` (khoá `id uuid`, `UNIQUE (tenant_id,user_id)`; người vận hành ghi; mỗi lần thêm/bớt ghi `identity.events` kèm `db_role`).
  - `work_requests` (Z1; `pending → approved|rejected`, quyết một lần, người quyết khác người lập, `approved ⇔ work_id`). INSERT theo cột (không có cột quyết định, version, thời điểm); `id` có trong danh sách vì bộ nhập bảng (PR sau) chọn id trong cùng transaction, API không nhận id từ JSON.
  - RLS `ENABLE` + `FORCE`, `USING` + `WITH CHECK`. Đọc: người lập, người đã quyết, hoặc ghế BoM của dự án nằm trong phạm vi. Quyết: ghế BoM của dự án trong phạm vi. Người khác nhận cùng 404 như id không tồn tại.
  - `work_request_events` chỉ thêm; một `submitted` và một quyết định mỗi yêu cầu (`UNIQUE (request_id,kind)`); `submitted` chỉ do người lập khi còn `pending`; `approved|rejected` khớp trạng thái và người quyết ghi trên yêu cầu. Đọc đúng nơi đọc được yêu cầu.
  - Trigger: chặn sửa dòng đã quyết, chặn xoá; duyệt phải trỏ tới việc có dòng `audit_events` `created` mang id yêu cầu.
  - Ba hàm `SECURITY DEFINER` chủ `libetech_identity`, `search_path=pg_catalog`, PUBLIC thu hồi: `app_actor_is_tech_member()`, `tech_project_catalog()`, `work_request_seat(project)` (ghế phải có membership, tài khoản hoạt động và đã kích hoạt, liên kết Telegram, và dự án trong phạm vi phiên).
- `src/server/work-requests.ts`:
  - `catalog`, `submit` (idempotent theo `request_key` + `request_hash`, `ON CONFLICT DO NOTHING`), `list`.
  - `decide`: khoá dòng yêu cầu trước (`FOR UPDATE`), rồi kiểm từ dòng đã khoá: `SELF_APPROVAL`; `bom_scopes FOR SHARE`; `bom_eligible_members(project, [người quyết, người được giao…], true)` khoá users/memberships/Telegram như phiếu 3/3. Thay ghế giữa chừng phải chờ quyết định xong.
  - Duyệt tạo `work_items` trong cùng transaction và ghi `audit_events` `created`. Ghế chỉ điền chỗ người lập để trống (`PROPOSAL_FIXED` nếu thay người đã đề xuất); không có người thực hiện thì không duyệt (`ASSIGNEE_REQUIRED`); ghế không tự giao cho mình (`SELF_ASSIGNMENT`); giao việc mới cho một trong ba ghế của dự án bị giữ chờ Chairman (`BOM_ASSIGNEE_HELD`, OQ-60 (e)); vai từng người kiểm từ dòng đã khoá (`INVALID_ASSIGNMENT`).
  - `publicRequest()` / `publicPage()`: không trả `tenant_id`, `request_key`, `request_hash`; `decided_by` chỉ cho ghế của dự án hoặc người đã quyết.
- `POST /api/v1/work` trả 410 `WORK_REQUEST_REQUIRED` (bỏ `WorkService.create`); bốn tuyến `work-requests`. Bot: `READ_ONLY`.
- `identity.ts` thêm cờ `techMember` (chỉ để hiện nút); nút tạo việc theo vai từng dự án (`create-work-button.tsx`). Danh bạ chế độ demo nay giống máy chủ: chỉ người của dự án mà người gọi có quyền.
- Trang «Việc chờ BoM duyệt»: tên người đề xuất hoặc «Chưa giao», hạn, tài liệu; ghế chọn người cho chỗ trống khi duyệt.
- `deploy/tech-roster.sql`, `deploy/bom-seats.sql` cho người vận hành, không có id thật. `bom-seats.sql` đếm việc chưa xong chưa có người thực hiện và dừng nếu > 0, trừ khi truyền `-v allow_unassigned=1`; ghi `old_seat_ids`, `seat_ids`, `db_role`.

## Quyết định cố ý (nói nếu bạn thấy sai)

- **Giao lần đầu khi duyệt (OQ-60 (c) (2), tạm):** ghế BoM điền chỗ trống, không thay người đã đề xuất. Đổi người sau đó vẫn qua `bom_guard_assignment` 3/3; PR này không đụng `bom.ts` và trigger đó. Lý do không chọn «duyệt không người thực hiện»: phiếu 3/3 chỉ chia lại việc đã có người (`src/server/bom.ts:60`), nên việc sẽ không có đường nào để có người.
- **Giao việc mới cho thành viên BoM (OQ-60 (e) (1), tạm):** từ chối, vì lời Chairman «kể cả chia việc giữa ba thành viên BoM». Đây là hành vi không nới luật; giá phải trả là việc của chính ba ghế chờ Chairman.
- **Dự án chưa bật ghế BoM (OQ-60 (b) (1), tạm):** yêu cầu nằm chờ; giao diện ghi rõ.
- **Chia lại việc tạo từ yêu cầu** dừng ở `SOURCE_RECONCILE` vì không có dòng `bom_sources` (OQ-60 (d) (3), tạm) — giữ như việc tạo trực tiếp trước đây.
- Danh mục dự án (`tech_project_catalog()`) trả tên và mã dự án cho thành viên Tech, kể cả dự án họ không có quyền đọc — đúng câu «hiển thị đủ danh sách dự án». Nó không trả việc, người hay ghế.
- Người lập không phải ghế nhận 404 khi gọi quyết định (RLS ẩn dòng với quyền quyết), không phải 403; họ vẫn đọc được yêu cầu của mình.

## Hãy soi kỹ

Leo quyền qua ba hàm `SECURITY DEFINER`; người lập tự duyệt bằng bất kỳ đường nào; ghế bị gỡ giữa lần đọc và khoá; hai ghế duyệt song song; trả lời khác nhau giữa «có nhưng ngoài phạm vi» và «không có»; danh tính lấy từ JSON; bot ghi được; lịch sử giả được ghi trực tiếp; đường nào làm luật 3/3 lỏng đi (kể cả giao lần đầu cho ghế BoM); dữ liệu thô ra trình duyệt; biên nhận hoặc tài liệu gọi mức «đã triển khai/đã nghiệm thu».
