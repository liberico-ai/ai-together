# Bàn giao giao diện — «Inbox» và phiếu đổi quyền (lát 2)

Nguồn: `docs/DESIGN-SYSTEM-PM-DOCUMENTS.md`, `docs/UI-HANDOFF-1-documents.md` (cùng token, cùng lớp `.doc-*`). Mã: `src/app/inbox/{page,loading,error}.tsx`, `src/components/inbox.tsx`, `src/components/inbox-view.ts`, lớp `.inbox-*` cuối `src/app/globals.css`. Kèm hai sửa: `src/components/approvals.tsx` (loại phiếu, quyền hiện tại → quyền đề nghị) và `src/components/team-accounts.tsx` («Trình phiếu đổi quyền»).
Vai: đọc Inbox gồm `manager`, `engineer`, `technical`, `business`; chỉ `manager` thao tác. Đây là giữ chỗ theo S5, còn là câu hỏi mở cho Chairman; giao diện chỉ phản ánh `canAct` do trang server tính, không tự quyết.

## 1. Bố cục
Từ trên xuống: «← Về không gian làm việc» → tiêu đề «<Dự án> / Inbox» + liên kết «Tài liệu dự án» → vùng thông báo `role="status"` (sau thao tác thành công) → «Nguồn tin» (mỗi nhóm một dòng) → «Tin đã tiếp nhận» (skeleton / lỗi / từ chối / rỗng / danh sách thẻ, dòng «n / tổng tin») → «Tin gửi cần xử lý» (outbox `dead`, `uncertain`, `pending` quá hạn; chỉ đọc).
Không có `?projectId=` và nhiều dự án: chỉ danh sách liên kết chọn dự án (chỉ dự án được phép và có vai đọc). Một dự án: chuyển thẳng. Dự án ngoài quyền: một khối từ chối, không có phần nào khác.
Thẻ tin (`IntakeCard`), từ trên xuống: mã `IN-xxxx` + nhãn loại + nhãn trạng thái (+ «Tin chuyển tiếp») → «Tin gốc: <sourceRef>» → nội dung (hoặc khối chỉ-con-trỏ) → tệp đính kèm → vòng đời bốn dòng (Nhận lúc · Ghi lúc · Chiếu · Gửi) → «Có thể trùng» → khối theo loại → vùng hành động (hoặc lý do không có nút) → «Xem chi tiết» (`<details>`, tải khi mở).
Biến thể thẻ theo loại do người chọn:
- **incident**: «Ảnh hưởng / khôi phục» (ô ghi chú khi còn mở và có quyền; ngược lại trỏ sang «Xem chi tiết» → lịch sử thao tác, nơi `note` được hiện).
- **request**: «Cần làm rõ» liệt kê `missingFields`; ô «Thông tin còn thiếu» (mỗi dòng một mục) khi tin mới và có quyền.
- **document**: «Đăng ký nguồn» + liên kết sang `/documents?projectId=<id>`.
- **chưa phân loại**: ba nút «Sự cố», «Yêu cầu», «Tài liệu» do người bấm; không có gợi ý và không gọi mô hình.

## 2. Token
Dùng nguyên token của lát 1 (xem `UI-HANDOFF-1-documents.md` mục 2): `--navy` nút chính, `--ink` chữ, `--line` viền, `--bg` nền khối con trỏ, `--teal` chỉ vòng focus, #5d6b64 nhãn phụ 12px, #4f5c55 trên #eef1ee nhãn trung tính, #9b2c2c lỗi. Không thêm màu. Khoảng cách 4/8/12/16/24/32; chữ thân 14px.
Lớp thêm: `.inbox-section .inbox-plain .inbox-source .inbox-card .inbox-head .inbox-badges .inbox-badge .inbox-text .inbox-pointer .inbox-life .inbox-variant .inbox-textarea .inbox-actions .inbox-choices .inbox-secondary .inbox-readonly .inbox-more .inbox-summary .inbox-hash .inbox-detail`. Nút và trang dùng lại `.doc-action .doc-page .doc-state .doc-skeleton .doc-notice .doc-problem .doc-field`.
Tín hiệu không chỉ bằng màu: mỗi trạng thái đều có chữ (nhãn loại, nhãn trạng thái, nhãn gửi).

## 3. Props thành phần
```ts
Inbox({projects:{id;name}[]; projectId:string|null; initial:{items:CandidateCard[];total:number}|null; sources:SourceAvailabilityRow[]; failures:FailureRow[]; denied:boolean; canAct:boolean})  // 'use client'
InboxBody({state:'loading'|'denied'|'error'|'empty'|'ready'; items; total; error:string|null; projectLabel; canAct; onRetry?:()=>void; onCommand:(c:CandidateCard,cmd:unknown)=>Promise<void>})
IntakeCard({card:CandidateCard; canAct:boolean; onCommand:(cmd:unknown)=>Promise<void>})   // onCommand nhận lệnh đã có expectedVersion
SourceList({sources}) · FailureList({failures}) · GatewayHash({hash:string|null})
// inbox-view.ts (hàm thuần): statusLabel, failureLabel, variantOf, primaryAction, inboxState, commandErrorMessage, formatTime, sizeLabel, chatTail
ApprovalItem({item:Pending; busy:boolean; onVote:(id,'agree'|'reject')=>void|Promise<void>})   // approvals.tsx
AccessActions({expands:boolean; busy:boolean}) · expandsAccess(before,after)                      // team-accounts.tsx
```
Gọi API chỉ qua `src/components/api.ts`: `GET /api/inbox?projectId=`, `POST /api/inbox/<id>/commands` (có `Idempotency-Key`, đúng origin, như `documents.tsx`), `GET /api/inbox/<id>` khi mở «Xem chi tiết». Mọi phản hồi mang `meta.requestId`; mục không tồn tại, thiếu hoặc ngoài phạm vi trả cùng một 404 `SCOPE_DENIED`.
`primaryAction`: tin `new`/`needs_info` đã phân loại → «Xác nhận yêu cầu»; riêng `request` ở `new` → «Bổ sung thông tin» (ghi `need_info`), kèm nút phụ «Xác nhận đủ thông tin». Chưa phân loại: không nút chính. Bỏ qua, đánh dấu trùng, mở lại luôn cần «Căn cứ». Lưu ý: gửi lại một lệnh đã chạy trả về thẻ HIỆN TẠI chứ không phải thẻ của lần chạy đầu; màn hình tải lại danh sách sau mỗi lệnh nên không dựa vào thân phản hồi. Lệnh xử lý outbox (`failureCommand`) thành công không có khoá `data`.

## 4. Trạng thái
Màn (ưu tiên loading > denied > error > empty > ready):
- loading: skeleton, `aria-busy="true"`, không có số 0 giả.
- denied: «Anh/chị chưa có quyền xem Inbox của dự án này»; không tên dự án, không số đếm, không nhóm, không tin.
- error: `role="alert"`, câu lỗi + «Thử lại».
- empty: «Chưa có tin nào được tiếp nhận cho dự án này» (khác hẳn câu từ chối).
- ready: danh sách thẻ + «n / tổng tin».
Thẻ:
- Không phải điều phối: không nút nào, hiện «Chỉ điều phối dự án được thao tác. Vai hiện tại của anh/chị chỉ xem Inbox.»
- Lỗi lệnh: `role="alert"` trong thẻ, giữ nguyên chữ đang nhập. Xung đột version (`REVISION_CONFLICT` 409): «Mục này vừa được người khác cập nhật. Tải lại để xem bản mới.» kèm nút «Tải lại danh sách» ở đầu trang; không tự tải lại để khỏi xoá lựa chọn.
- Thành công: `role="status"` «Đã ghi thao tác cho <mã>. Chưa tạo, giao hay đóng việc nào.»; danh sách tải lại, thẻ dựng lại theo `version` mới.
Vòng đời (năm trạng thái tách riêng; không dòng nào đọc «đã gửi» trước `deliveredAt`):
`Nhận lúc` (gateway thấy) · `Ghi lúc` (đã lưu) · `Chiếu`: luôn «Chưa chiếu» · `Gửi`:
| outbox | `deliveredAt` | Nhãn |
|---|---|---|
| không có / `pending` | rỗng | Đã ghi, chưa gửi |
| `leased` | rỗng | Đang gửi |
| `delivered` | có | Đã gửi tới nhóm (+ « · người nhận đã xác nhận» khi có `acknowledgedAt`) |
| `uncertain` | rỗng | Chưa rõ đã gửi hay chưa — đang đối soát |
| `dead`, `abandoned` | rỗng | Không gửi được |
`delivered` mà thiếu `deliveredAt`, hoặc có `acknowledgedAt` mà thiếu `deliveredAt`, vẫn đọc «Đã ghi, chưa gửi».
Nguồn tin: nhóm mới → «Chưa xác minh khả năng nhận tin»; nhóm đã có tin → «Nhận từ <mốc>; không có lịch sử trước mốc này» + số khoảng ghi chậm. Không bao giờ có chữ «Đã kết nối đầy đủ». Chỉ hiện 4 ký tự cuối mã nhóm.
Hash: chỉ ở «Xem chi tiết», luôn kèm «do gateway khai, chưa kiểm»; không biểu tượng đã kiểm. Dự án `pointer_only` không có hash để hiện (API trả `null`): «Không có hash để hiển thị».
Tin chỉ con trỏ: «Chỉ giữ con trỏ và hash. Mở tin gốc trong Telegram» + `sourceRef`; không bao giờ hiện chữ, kể cả khi dữ liệu lỡ có.
Phiếu duyệt (`/approvals`): «Phiếu đổi quyền» hiện tên và tài khoản, «Quyền hiện tại: …» rồi «→ Quyền đề nghị: …» (không có quyền cũ → «chưa có quyền nào»); «Phiếu đăng ký thành viên» giữ «Người đăng ký đề nghị». Phiếu đã đóng (`APPROVAL_CLOSED`): hiện lỗi rồi tải lại danh sách.
Tài khoản (`/team`): sau khi sửa quyền, nếu có dự án mở rộng (không phải chỉ giảm) thì hiện «Trình phiếu đổi quyền» thay «Lưu quyền»; kèm «Áp quyền đã được duyệt» (cùng lệnh `access` cũ, máy chủ vẫn từ chối nếu chưa có phiếu đã duyệt). Chỉ giảm quyền: giữ «Lưu quyền». Lý do từ chối của máy chủ (`ACCESS_CHANGE_NOT_NEEDED`, `APPROVERS_NOT_READY`, `ACCOUNT_INACTIVE`, `APPROVAL_PENDING`) hiện nguyên văn trong `role="alert"`.

## 5. Breakpoint
- 360 (<700): một cột; nút full-width; vòng đời một cột; không cuộn ngang.
- ≥700: vòng đời hai cột; đầu thẻ nằm ngang.
- ≥950: vòng đời bốn cột.
- ≥1200: như 950 (thẻ vẫn một khối dọc để vùng hành động không bị ép hẹp). Không phần tử nào rộng cố định >328px; SHA, mã, URL dùng `overflow-wrap:anywhere`; mọi nút và liên kết hành động ≥44×44.

## 6. Edge case
- Tin chỉ có tệp: «Tin không có chữ (chỉ có tệp).»; mỗi tệp một dòng (tên, loại, dung lượng, trạng thái: đã ghi con trỏ / quá lớn / loại không nhận).
- Tin forward: nhãn «Tin chuyển tiếp».
- Album thiếu phần: màn chỉ hiện các tệp mà `attachments` của thẻ có; không suy đoán phần chưa tới. Thiếu kích thước hiện «Chưa rõ dung lượng». Gộp ứng viên theo album do máy chủ quyết (`threadKey`), màn không gộp.
- Nội dung chỉ con trỏ: xem mục 4.
- Nhóm chưa có tin: «Chưa xác minh khả năng nhận tin»; danh sách tin rỗng hiện câu rỗng, không phải câu từ chối.
- Outbox `uncertain`: «Chưa rõ đã gửi hay chưa — đang đối soát» (chưa thao tác gửi lại); `dead`: «Không gửi được» kèm mã lỗi; `pending` quá 10 phút: «Đã ghi, chưa gửi — quá hạn 10 phút».
- Ứng viên trùng: hiện mã đối tượng (`ref`) và căn cứ (`reason`); «Đánh dấu trùng» chỉ cho các ứng viên đó, cần «Căn cứ».
- Chữ dài không dấu cách (URL, SHA, mã): `overflow-wrap:anywhere`.
- Dự án chưa ánh xạ miền: màn này không phân miền, không cộng gộp.

## Kiểm tay (phiên điều phối chạy và chụp vào `docs/screenshots/`)
Builder không chạy kiểm tay. Mọi ô dưới để «chưa chạy» cho tới khi phiên điều phối điền kết quả.
| Trạng thái | 360×740 | 1280×800 |
|---|---|---|
| Có tin (đủ ba loại + chưa phân loại) | chưa chạy | chưa chạy |
| Rỗng | chưa chạy | chưa chạy |
| Không quyền (`projectId` ngoài danh sách) | chưa chạy | chưa chạy |
| Lỗi (ngắt API rồi bấm Thử lại) | chưa chạy | chưa chạy |
| Đang tải (giảm tốc mạng) | chưa chạy | chưa chạy |
| Tin chỉ con trỏ | chưa chạy | chưa chạy |
| Xung đột version (hai tab cùng thao tác) | chưa chạy | chưa chạy |
| Người không phải điều phối (không nút, có lý do) | chưa chạy | chưa chạy |
| Nhóm mới và nhóm đã có tin | chưa chạy | chưa chạy |
| `/approvals` phiếu đổi quyền | chưa chạy | chưa chạy |
| `/team` mở rộng quyền so với chỉ giảm | chưa chạy | chưa chạy |
| 360px không cuộn ngang; Tab đi đúng thứ tự đọc | chưa chạy | không áp dụng |

## Việc chưa làm
- Đo contrast thực tế (nhãn phụ 12px, nhãn trung tính).
- Kiểm zoom 200%.
- Kiểm screen reader (`role=list`, `role=alert`, `role=status`, `aria-busy`, `<details>`).
- DM gửi cho người bỏ phiếu bị lỗi: lát này không có bề mặt vận hành (`failures()` chỉ liệt kê dòng gửi vào nhóm). Cần quyết định bề mặt ở lát sau.
- Nút xử lý outbox trên web (`take`, `requeue`, `abandon`): API có, màn mới chỉ đọc.
- Liên kết ticket (`link_ticket`), bộ lọc theo trạng thái, phân trang (mặc định 50 tin, chưa có nút «Xem thêm»).
- Vai đọc Inbox (S5) chờ Chairman.
- Ảnh chụp.
