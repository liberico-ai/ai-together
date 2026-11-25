## Việc (GIAO VIỆC 7, bản 0.9.2 «mở khoá»)

Lời Chairman 25/11/2026 17:48, chép nguyên: «Mục tiêu là cả team dùng được sau go live, nên em tự ra quyết định. Đừng Go live xong không làm được gì. lỗi có thể sửa . Đừng khoá chặt , team Tech cũng cần học và trải nghiệm»

Phiên điều phối (Cowork) đã quyết OQ-60, OQ-61 và OQ-62 theo uỷ quyền đó; Chairman có thể đổi. Quyết định nằm ở khối «GIAO VIỆC 7» cuối `docs/OPEN-QUESTIONS.md`. Kế hoạch: `docs/plans/gv7-unlock-092.md`.

**Cổng:** chạy một vòng. Chỉ P0 chặn merge (rò dữ liệu, leo quyền, mất dữ liệu); P1 và P2 ghi vào biên nhận và sửa tiến. Vẫn xếp hạng mọi finding theo thang của lời nhắc trên.

**Đầu vào:** diff của mã so với `532fa41` (merge của bản 0.9.1 cộng tài liệu), gồm `src`, `migrations`, `deploy`, `tests`, `vitest.config.ts`, `package.json`.

## Đã đổi

- **M1:** bỏ `SELF_ASSIGNMENT` và `BOM_ASSIGNEE_HELD`. Một ghế BoM nhận được việc mới, kể cả chính người duyệt. Vẫn giữ CHECK `decided_by <> requester_id` (024) và luật người thực hiện khác người nghiệm thu.
- **M2:** người thực hiện hợp lệ là `engineer` của dự án, hoặc thành viên Team Tech (roster hay BoM Tech, đang hoạt động, đã kích hoạt; `tech_performers_among`, DEFINER).
  - Người được giao chưa có membership → một dòng `work_access_grants`: chỉ thêm. Trigger guard đòi `granted_by = app.person_id`, người nhận khác người cấp, người nhận là thành viên Team Tech, và dòng chỉ vào quyết định đã giao việc đó trong **chính giao dịch này** (`decided_at`/`created_at` = `now()`).
  - Người duyệt không có membership mà tự nhận việc mình duyệt → `SELF_GRANT` (403).
  - `principal()` thêm các dự án đó với vai `viewer`, chỉ khi người đó còn trong Team Tech **và còn giữ việc** (người thực hiện, hoặc người nhận phần trong phiếu 3/3 đã áp gần nhất). Vai `libetech_identity` được đọc vài cột của `work_items`, `bom_receipts`, `bom_proposals`, chỉ ở việc có dòng cấp quyền.
  - Mở phiên bản mới (`revise`) giao cho thành viên Team Tech chưa có membership cũng ghi dòng cấp quyền (đặt `app.person_id` trước khi ghi).
  - `WorkService.command` cho một `viewer` là người được giao, và còn trong Team Tech theo CSDL, chuyển trạng thái và nộp bằng chứng.
  - Người ngoài roster: luật vai cũ.
- **M3:** bỏ `PROPOSAL_FIXED`. Ghế điền chỗ trống và đổi được người đã đề xuất. Sự kiện `approved` và audit `created` lưu `proposed`, `final`, `filledBySeat`, `changedBySeat`.
- **M4:** khi duyệt, ghi một dòng `bom_sources` `work_request:<id>` kèm `request_hash`, `valid_until='infinity'`.
  - Trigger: dòng đó phải khớp một yêu cầu đã duyệt của đúng việc, và không sửa hay xoá được. Nhận dạng bằng `starts_with(source_ref,'work_request:')` (không dùng `LIKE`: `_` là ký tự đại diện). Runtime, hay bất kỳ vai nào có quyền của runtime mà không `SET ROLE` (`pg_has_role(...,'USAGE')`, trừ superuser), không ghi dòng nguồn nào khác.
  - Migration điền bù cho việc đã duyệt dưới 0.9.1. Luật 3/3 không đổi.
- **M5:** bảng `identity.tech_bom` giữ tối đa ba người mỗi tenant, chỉ người vận hành ghi (`deploy/tech-bom.sql`). Mỗi thay đổi ghi `identity.events`.
  - `work_request_seat()` viết lại: BoM Tech (mọi dự án của tenant), hoặc ghế BoM của dự án (`work_request_project_seat`, có membership, dự án trong `app.project_ids`, đang hoạt động, đã kích hoạt). Không còn đòi Telegram.
  - Chính sách `request_read`/`request_decide` của `work_requests` chỉ hỏi `work_request_seat()`; BoM Tech đọc và duyệt yêu cầu mọi dự án qua chính sách, **không** nới `app.project_ids`.
  - Khi BoM Tech duyệt một yêu cầu, chỉ giao dịch đó thêm đúng dự án của yêu cầu vào `app.project_ids` (`decidingIn`). `context()` chỉ mở dự án đang có yêu cầu chờ người đó.
  - `intake_link_allowed()` giữ luật 025 (thành viên không phải viewer, hoặc ghế); là BoM Tech không thêm quyền gắn tin.
  - `deploy/tech-bom.sql` nhận 0–3 người.
  - Phiếu 3/3 giữ điều kiện ghế cũ, có Telegram.
- **M6:** thành viên Team Tech chưa có membership đăng nhập được, vào `/work-requests`, thấy danh mục dự án, gửi và xem yêu cầu của mình.
- **M7:** `decideMany`: danh sách id (tối đa 200) hoặc `batchId` (yêu cầu còn chờ, cộng yêu cầu chính người gọi đã quyết, để gọi lại trả đúng kết quả cũ).
  - Mỗi yêu cầu một giao dịch, một sự kiện, một người duyệt. Dòng lỗi trả mã và câu báo riêng.
  - Khoá con là `sha256(khoá lượt + ':' + id)`; băm chống lặp chỉ gồm những gì client gửi, không gồm hệ thống hay người đọc từ CSDL.
  - Người nêu cho cả lượt chỉ điền chỗ trống.
- **M8:**
  - Mã việc lấy từ tiêu đề, rồi từ ghi chú cho dòng không phải `titleOnly` (IBS HI theo nhãn hoặc theo đích, chưa có đích, hoặc người nhập không được tạo việc ở đích); cờ `CODE_FROM_NOTE`.
  - `work_import_batches.file_name`.
  - Ô người phụ trách ánh xạ được tới thành viên Team Tech (`tech_performers_named`).
- **M10:** câu từ chối nói bước tiếp theo.
- **Rollback 028:** từ chối khi có migration sau, có dòng `tech_bom`, có dòng cấp quyền, có lô mang tên tệp, hoặc có phiếu dựa vào nguồn của yêu cầu. Khôi phục thân hàm và chính sách của 024, thân `intake_link_allowed` của 025; gỡ chính sách đọc của vai sign-in trước khi xoá bảng cấp quyền.

## Quyết định cố ý (nói nếu bạn thấy sai)

- Dòng cấp quyền không xoá (lịch sử). Nó mở dự án với vai `viewer` khi người đó còn trong Team Tech và còn giữ việc; không theo membership (Q-GV7-2).
- Ghế đổi người đề xuất lúc duyệt được coi là giao lần đầu, không cần 3/3 (Q-GV7-1, theo đề GIAO VIỆC 7).
- BoM Tech chỉ thấy mọi dự án ở luồng yêu cầu, không thấy việc hay tài liệu (Q-GV7-4).
- Duyệt hàng loạt chỉ điền chỗ trống (Q-GV7-3).

## Hãy soi kỹ

- Leo quyền qua `work_access_grants`: tự cấp cho mình hay cho người khác; người ngoài roster được cấp; giả `granted_by`.
- Viewer làm thao tác của người thực hiện trên việc không phải của mình.
- BoM Tech đọc được việc, hệ thống, audit, tài liệu hay số liệu của dự án mà họ không có membership (ngoài đúng giao dịch duyệt). Câu báo lỗi nêu tên dự án.
- Chữ ghi chú của dòng IBS HI lọt vào mã việc, cờ hay băm.
- Lách luật 3/3 qua M3 hay M4: sửa hay xoá dòng nguồn; ghi dòng nguồn cho việc khác.
- Lách luật người duyệt khác người tạo, hay người thực hiện khác người nghiệm thu.
- `decideMany`: ghi lặp, trộn khoá giữa các yêu cầu, một dòng lỗi làm hỏng dòng khác.
- Rollback 028 làm mất lịch sử.

## Sửa trước cổng (hai lượt soát nội bộ + một lượt review tự động)

Đã sửa, mỗi mục có ca kiểm đỏ trước trên mã cũ (`6e3de00`) rồi xanh: không nới phạm vi BoM Tech ra cả tenant; chặn tự cấp quyền (dịch vụ + trigger); dòng cấp quyền chỉ trong giao dịch của quyết định; ghi dòng cấp quyền khi `revise`; quyền chỉ tính khi còn giữ việc; `starts_with` thay `LIKE`; kiểm vai bằng `pg_has_role`; gọi lại duyệt cả lô; băm chống lặp chỉ từ dữ liệu client; `tech-bom.sql` nhận 0–3. Giữ nguyên: số tổng của danh sách yêu cầu (đếm đúng những gì người đó đọc được).

**Head:** `1518c3a4d17054f52ad401d7cf24ea7300a036d2` (nhánh `feat/gv7-unlock-092`, PR liberico-ai/ai-together#45).
