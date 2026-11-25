# Kế hoạch GIAO VIỆC 5 · hạng mục A — Team Tech tạo việc, BoM duyệt

Ngày: 25/11/2026 · Nhánh: `feat/gv5-a-tech-create-approval` từ `libetech-ai-os` `66e0c78` · Migration: `024`.
Căn cứ: quyết định Chairman 25/11/2026 (chép nguyên văn ở cuối `docs/OPEN-QUESTIONS.md`), `AGENTS.md`, SPEC-004, `docs/QUY-CHE-DU-THAO-BOM-TECH.md`.

## 1. Vì sao nút «Tạo công việc» không hiện (#fact)

- `src/server/identity.ts` `principal()` gộp vai: một người có vai khác nhau ở các dự án nhận `role='viewer'`.
- `src/components/workspace.tsx:41` chỉ hiện nút khi `principal.role==='manager'`; khung chi tiết việc (dòng 68-81) cũng dùng vai gộp.
- `WorkService.create` (`src/server/service.ts:107`) chỉ cho điều phối của chính dự án đó tạo, và việc tạo ra có hiệu lực ngay, không chờ ai duyệt.
- RLS của bảng việc chỉ cho ghi ở dự án mà người đó có quyền, nên thành viên Tech không có quyền ở dự án thì không ghi được gì.

Hướng sửa: server không đổi nghĩa của `role` gộp (các dịch vụ khác đã kiểm vai theo từng dự án bằng `projectRole`). Giao diện bỏ vai gộp, dùng vai theo dự án. Quyền tạo việc chuyển sang một thực thể Z1 mới là `work_requests`.

## 2. Mô hình

- `identity.tech_roster` là danh sách thành viên Team Tech. Chỉ operator ghi, qua `deploy/tech-roster.sql`. Mỗi lần thêm hoặc bớt đều ghi một dòng `identity.events`.
  - Ở trong danh sách **không** phải là quyền trên dự án. Thành viên chỉ được xem danh mục dự án (id, tên, BU) và gửi yêu cầu tạo việc vào bất kỳ dự án nào.
  - Thành viên không đọc được việc, bằng chứng hay số liệu của dự án mà họ không có quyền.
- `work_requests` (Z1) là một việc mới đã gửi và đang chờ duyệt. Mỗi dòng ghi người tạo, dự án, nội dung, thời điểm, nguồn (`form`, `intake` hoặc `import`; B và C dùng hai nguồn sau) và `request_key`/`request_hash` để chống ghi lặp.
  - Trạng thái: `pending` (chờ BoM duyệt), `approved` hoặc `rejected`.
  - Khi đã quyết định, dòng ghi người quyết, tên, thời điểm và ghi chú, rồi không đổi nữa.
- `work_request_events` là lịch sử chỉ được thêm (`submitted`, `approved`, `rejected`). Mỗi dòng có tác nhân và thời điểm.
- Duyệt một yêu cầu tạo dòng `work_items` trong cùng transaction, do chính người duyệt tạo. Người duyệt là ghế BoM nên có membership của dự án. Dòng `audit_events` kind `created` ghi `requestId`, `requestedBy`, `approvedBy`, `origin`.

## 3. Luật duyệt — cách hiểu tạm, chờ Chairman

Quy chế hiện có (`QUY-CHE-DU-THAO-BOM-TECH.md` Q07) **chưa có luật đã chốt** cho việc duyệt việc mới. Hệ thống áp cách hiểu tạm sau cho tới khi Chairman xác nhận (OQ-60 ở cuối `OPEN-QUESTIONS.md`):

- Một ghế BoM của chính dự án đó duyệt hoặc từ chối. Người duyệt phải **khác người tạo**; BoM không tự duyệt việc mình tạo.
- Ghế được tính khi đủ cả năm điều: `bom_scopes.enabled`, nằm trong `seat_ids`, có membership của dự án, tài khoản đang hoạt động và đã kích hoạt, đã liên kết Telegram. Đây cũng là điều kiện để bỏ phiếu 3/3 (`bom.ts`). `decide()` khoá dòng yêu cầu (`FOR UPDATE`), rồi đọc dòng `bom_scopes` (`FOR SHARE`) và `bom_eligible_members(..., true)` (khoá users, memberships, telegram_links như phiếu 3/3). Mọi kiểm tra sau đó dùng các dòng đã khoá, nên đổi ghế phải chờ quyết định này xong. Ghế bị gỡ trước khi khoá nhận `403 BOM_SEAT_REQUIRED` (hoặc `404` nếu đã gỡ trước cả câu đọc đầu).
- Màn hình hiện người duyệt và thời điểm duyệt.
- Dự án chưa có ghế BoM bật thì yêu cầu nằm ở trạng thái chờ. Người tạo có quyền ở dự án thấy «Dự án chưa có ghế BoM — chưa ai duyệt được»; người tạo không có quyền ở dự án chỉ thấy «Yêu cầu chờ ghế BoM của dự án.»
- **Ai thấy yêu cầu** (RLS, không chỉ dịch vụ): người tạo, người đã quyết và ghế BoM của dự án. Thành viên dự án không phải ghế nhận cùng một câu `404 NOT_FOUND` cho mã có thật và mã không có, nên không dò được sự tồn tại. Lịch sử (`work_request_events`) đọc được ở đúng nơi đọc được yêu cầu.

Người thực hiện và hai người nghiệm thu:
- Người tạo chỉ thấy thành viên của các dự án mà mình có quyền (thư mục của server; bản mô phỏng làm đúng như vậy). Thành viên Team Tech không có quyền ở dự án thì thường gửi **không kèm người nào**; nêu một người ngoài tầm nhìn → `INVALID_ASSIGNMENT`.
- Khi duyệt, ghế **chỉ điền các chỗ còn trống** (người thực hiện, nghiệm thu kỹ thuật, nghiệm thu nghiệp vụ). Thay người mà người tạo đã đề xuất → `PROPOSAL_FIXED` 422; muốn đổi thì từ chối để người tạo gửi lại.
- Cuối cùng phải có người thực hiện: không có → `ASSIGNEE_REQUIRED` 422 (phiếu 3/3 chỉ chia lại việc đã có người thực hiện, `bom.ts:60`).
- Ghế không giao việc cho chính mình → `SELF_ASSIGNMENT` 403. Giao cho một ghế BoM khác của dự án → `BOM_ASSIGNEE_HELD` 422, theo lời Chairman 25/11 «Giữ luật xác nhận 3/3 … kể cả chia việc giữa ba thành viên BoM» (OQ-60 (e), chờ xác nhận).
- Người thực hiện khác hai người nghiệm thu (`SELF_ACCEPTANCE`); cả ba phải có đúng vai (engineer, technical, business) ở dự án, đọc từ các dòng đã khoá (`INVALID_ASSIGNMENT`).
- Sự kiện duyệt ghi người cuối cùng và `filledBySeat`; audit `created` ghi `sourceRef` và `filledBySeat`.

Điều kiện đăng nhập: một thành viên trong danh sách Team Tech vẫn cần **ít nhất một membership** ở một dự án thì mới đăng nhập được (`identity.ts`, `NO_PROJECT_ACCESS`). Ở trong danh sách không thay cho membership.

Luật 3/3 không đổi, và không bị đi vòng qua bước duyệt:
- `bom_guard_assignment` vẫn chặn mọi thay đổi người thực hiện của việc đã có, nếu thay đổi đó không có biên nhận 3/3.
- Duyệt một yêu cầu tạo việc mới là **giao lần đầu**, như `WorkService.create` vẫn cho điều phối làm trước đây; nay chặt hơn vì cần một ghế BoM khác người tạo.
- Mọi lần đổi người thực hiện sau đó vẫn cần 3/3:
  - `bom_guard_assignment` chặn câu ghi thẳng vào DB;
  - lệnh `revise` trả `BOM_REQUIRED` khi scope bật.
- Phương án «duyệt mà không có người thực hiện, giao qua 3/3» đã cân nhắc và **bị loại**: việc mới sẽ không có đường nào để có người nhận. Áp 3/3 cho giao lần đầu là Q02 của quy chế dự thảo, mới ở mức đề xuất (OQ-60 (c)).
- Giới hạn có sẵn, không do A sinh ra: việc không đến từ bộ nhập nguồn thì không có dòng `bom_sources`, nên phiếu 3/3 chia lại việc đó dừng ở `SOURCE_RECONCILE`. Ghi ở OQ-60 (d).

Toàn vẹn lịch sử (CSDL): sự kiện `submitted` chỉ do chính người tạo ghi, khi yêu cầu còn chờ; `approved`/`rejected` chỉ khớp trạng thái và người quyết của yêu cầu; mỗi yêu cầu một sự kiện mỗi loại (chỉ mục duy nhất). Quyền INSERT của runtime trên `work_requests` theo cột, không gồm cột quyết định. Một yêu cầu chỉ chuyển sang `approved` khi có dòng audit `created` mang đúng `requestId` của nó và `work_id` đó.

Phản hồi không trả dòng thô (E-SEC-01): `publicRequest()` bỏ `tenant_id`, `request_key`, `request_hash`, và `decided_by` khi người đọc không phải ghế của dự án hay người quyết; giữ `decider_name`, `decided_at`.

## 4. Thay đổi

| Tệp | Thay đổi |
|---|---|
| `migrations/024_work_requests.sql` + `rollback/024_work_requests.sql` | Bảng, RLS (`ENABLE`+`FORCE`, `USING`+`WITH CHECK`), bốn hàm SECURITY DEFINER (`app_actor_is_tech_member`, `tech_project_catalog`, `work_request_seat`, `work_request_filer`), trigger chặn sửa/xoá. Rollback từ chối khi đã có dòng |
| `src/server/work-requests.ts` (mới) | `WorkRequestService`: `catalog`, `submit`, `list`, `decide` (khoá rồi kiểm từ các dòng đã khoá); `publicRequest`. Mọi transaction đặt `app.person_id` (theo `inbox.ts run()`) |
| `src/server/service.ts` | Bỏ `WorkService.create` và `createSchema`; export `approvers`; thư mục mô phỏng chỉ trả người của các dự án người gọi có quyền (giống thư mục của server) |
| `src/server/http.ts` | `GET work-requests`, `GET work-requests/catalog`, `POST work-requests`, `POST work-requests/:id/decision`. `POST work` trả `410 WORK_REQUEST_REQUIRED` |
| `src/server/identity.ts`, `types.ts` | `Principal.techMember` (chỉ để hiển thị; server kiểm lại trong DB) |
| `src/components/workspace.tsx`, `create-work-button.tsx` | Dùng vai theo dự án; hiện nút (`canCreateWork`) cho `techMember` hoặc điều phối ở ít nhất một dự án; form gửi yêu cầu (danh mục dự án đầy đủ cho Tech, không có ô hệ thống/SHA) |
| `src/app/work-requests/page.tsx`, `src/components/work-requests.tsx` (mới) | Danh sách «Việc chờ BoM duyệt»: trạng thái, người tạo, thời điểm, người duyệt và thời điểm duyệt, việc đã tạo; tên người đề xuất, hạn, đường dẫn spec; nút duyệt/từ chối cho ghế BoM khác người tạo, kèm ô chọn cho từng chỗ trống |
| `deploy/tech-roster.sql`, `deploy/bom-seats.sql` | Script cho operator: biến psql, idempotent, có ghi lại. **Không chứa id thật**; danh sách người là dữ liệu ngoài repo |
| `tests/work-requests.test.ts` (+ sửa `foundation`, `inbox-service`) | Mục 5 |

## 5. Ca kiểm (viết trước)

1. Thành viên Tech không có quyền ở dự án X vẫn thấy X trong danh mục và gửi được yêu cầu vào X. Người ngoài danh sách thấy danh mục rỗng.
2. Viewer không trong danh sách gửi yêu cầu → `WORK_REQUEST_DENIED` 403. Bot → `READ_ONLY` 403. Điều phối của dự án gửi được.
3. Body có `tenantId`, `requesterId` hoặc `state` → bị từ chối (schema strict). Người đề xuất ngoài tầm nhìn của người tạo → `INVALID_ASSIGNMENT`.
4. Gửi lại cùng `requestKey` và cùng nội dung → trả về đúng dòng cũ (`replayed`). Cùng key, nội dung khác → `IDEMPOTENCY_CONFLICT` 409.
5. Người tạo và các ghế BoM của dự án thấy yêu cầu. Thành viên khác của dự án không phải ghế BoM thì không thấy trong danh sách.
6. Ghế BoM khác người tạo duyệt, điền người thực hiện và hai người nghiệm thu → có `work_items`; audit `created` ghi người tạo, người duyệt, `sourceRef`, `filledBySeat`; sự kiện `approved` ghi người cuối cùng.
6b. Không có người thực hiện → `ASSIGNEE_REQUIRED`; ghế giao cho chính mình → `SELF_ASSIGNMENT`; giao cho ghế khác → `BOM_ASSIGNEE_HELD`; thay người đã đề xuất → `PROPOSAL_FIXED`; sai vai → `INVALID_ASSIGNMENT`; trùng người nghiệm thu → `SELF_ACCEPTANCE`. Không ca nào ghi việc.
7. Người tạo là ghế BoM tự duyệt → `SELF_APPROVAL` 403. Người tạo không phải ghế → `404` như mã không có. Ghi thẳng vào DB cũng bị CHECK hoặc trigger chặn.
8. Điều phối không phải ghế BoM, ghế chưa liên kết Telegram, scope chưa bật, hoặc dự án chưa có scope → `404 NOT_FOUND` (RLS ẩn dòng); ghế bị gỡ trong lúc chờ khoá → `BOM_SEAT_REQUIRED` 403 (native).
9. Sai `expectedVersion` → `VERSION_CONFLICT` 409. Yêu cầu đã quyết → `REQUEST_DECIDED` 409. Mã việc đã có → `CODE_TAKEN` 409, yêu cầu vẫn chờ.
10. Hai ghế duyệt song song → một bên thắng, chỉ có một việc (native harness). Kết nối thứ hai đổi `bom_scopes` phải chờ quyết định commit (native).
11. RLS: không có ngữ cảnh → 0 dòng. Chèn với `requester_id` của người khác → bị chặn. Tenant khác → 0 dòng (đọc và UPDATE). `work_request_seat()` cho dự án của tenant khác → false. Thành viên không phải ghế không đọc được yêu cầu lẫn lịch sử.
11b. Chèn thẳng vào bảng: chỉ có quyền xem dự án (bot, viewer, engineer, người nghiệm thu) → bị chặn, `work_request_filer()` → false. Điều phối của dự án và thành viên Team Tech chèn được. Tài khoản điều phối bị khoá → bị chặn. Phiên tự nhận vai điều phối mà bảng tài khoản không có → `WORK_REQUEST_DENIED`. (Sửa sau vòng cổng Codex 1, P0.)
12. Việc vừa duyệt mang người thực hiện đã đề xuất. Đổi người thực hiện sau đó mà không có biên nhận 3/3 → bị `bom_guard_assignment` chặn; `revise` đổi người thực hiện → `BOM_REQUIRED`.
13. Lịch sử không giả được: người tạo ghi sự kiện `approved` của chính mình bị chặn; sự kiện `submitted` thứ hai bị chặn; UPDATE trỏ phê duyệt vào việc không liên quan bị trigger chặn; INSERT có cột quyết định bị từ chối quyền.
13b. Phản hồi không có `tenant_id`, `request_key`, `request_hash`; `decided_by` chỉ cho ghế hoặc người quyết.
13c. Thành viên không phải ghế nhận cùng `{code,status,message}` cho mã có thật và mã ngẫu nhiên.
14. `POST /api/v1/work` → 410; các đường HTTP của yêu cầu trả đúng dạng.
15. Rollback 024 từ chối khi có dòng; áp 024 hai lần không lỗi.
16. Script operator: `tech-roster.sql` và `bom-seats.sql` ghi `db_role`; `bom-seats.sql` ghi `old_seat_ids`/`seat_ids` và từ chối khi dự án còn việc chưa xong mà không có người thực hiện (trừ khi `-v allow_unassigned=1`).
17. Giao diện: nút «Tạo công việc» hiện cho điều phối một dự án + xem dự án khác, và cho `techMember`; ẩn với viewer. Thẻ yêu cầu hiện người đề xuất, hạn, spec; ô chọn cho chỗ trống lọc theo vai.

## 6. Ngoài phạm vi A

- Tin nhắn thành việc (B), nhập bảng (C), câu trả lời của bot (D).
- Cấp ghế cho ba người BoM Tech và đưa người vào danh sách Tech: operator làm theo runbook, dữ liệu ngoài repo.
- Ghế BoM cần membership của dự án. Membership được cấp qua luồng duyệt quyền hiện có (`access-change`), không qua script này.
