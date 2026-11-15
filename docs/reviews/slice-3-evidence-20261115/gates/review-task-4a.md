# Lát 3 · Task 4a — review theo task (bảo mật và cơ sở dữ liệu)

Ngày 15/11/2026. Diff được soát: `ed8a0fc..706ae2e` (một commit, `feat(identity): canonical-document approval as a per-type project permission (migration 019)`). Hai reviewer chạy song song, cùng họ mô hình với bên viết (Opus), nên đây là tầng 1, không phải kiểm độc lập; cổng Codex chạy sau trên cả nhánh. Reviewer chỉ đọc, không chạy bộ test; số đo lấy từ log trong thư mục này.

Bản này do phiên lát 3 chép lại từ hai báo cáo: phần phán quyết, finding và ghi chú triển khai giữ đúng nghĩa; phần «đã kiểm và thấy đúng» được rút gọn thành danh sách.

## Kết luận

| Reviewer | Tuân thủ đặc tả | Critical | Important | Minor | Kết luận |
|---|---|---|---|---|---|
| `liberico-security-reviewer` | Đạt (theo brief đã sửa) | 0 | 1 | 3 | Duyệt, kèm một yêu cầu sửa test |
| `liberico-database-reviewer` | Đạt | 0 | 1 (do thiết kế của kế hoạch) | 8 | Duyệt |

Không reviewer nào tìm thấy đường leo quyền, rò dữ liệu hay vượt guard đi qua được tầng dịch vụ. Luật của phiếu đổi quyền (ai đề xuất, ai bỏ phiếu, hàm đếm) không đổi; `src/server/account-approval.ts` và `bot-plugin/` không có thay đổi nào.

## Finding và cách xử lý

| Mã | Mức | Nội dung | Xử lý |
|---|---|---|---|
| S-1 | Important | Ca «tenant khác» của `document_approvers` xanh vì sai lý do: principal của tenant khác không có dự án đang hỏi trong ngữ cảnh, nên điều kiện dự án làm rỗng kết quả; dòng lọc `tenant_id` của hàm chưa được ca nào kiểm | Vòng sửa 1: thêm ca «tenant khác nhưng có mã dự án của tenant này trong ngữ cảnh», kèm đột biến tạm xoá dòng lọc tenant |
| D-1 | Important, do thiết kế | Guard ở `identity.memberships` chứng minh có một dòng phiếu **ghi** là `approved`/`issued` nêu đúng tài khoản, dự án và mã; nó không chứng minh một BoM đã đồng ý. Role `libetech_identity` có quyền chèn dòng phiếu với trạng thái bất kỳ. Guard còn nhận phiếu `approved` đã quá hạn và phiếu `issued` cũ vô thời hạn | Vòng sửa 1: thêm điều kiện hạn (`issued`, hoặc `approved` còn hạn). **Không** thêm điều kiện về phiếu bầu vào guard — phán quyết của phiên lát 3: luật đếm phiếu là luật của dịch vụ, cách hiểu OQ-29 còn chờ Chairman xác nhận, và CSDL không biến nó thành ranh giới chống role danh tính được. Phần đầu tệp migration và biên nhận phải ghi đúng điều CSDL bảo đảm |
| S-2 | Minor | Chưa có ca âm ở tầng DB chạy dưới `libetech_identity` (role thật sự ghi sổ quyền); mọi ca guard chạy bằng login vận hành | Vòng sửa 1: thêm ca dưới `SET LOCAL ROLE libetech_identity` |
| D-M1 | Minor | Hàm đọc `SECURITY DEFINER` đặt `search_path = pg_catalog`; `pg_temp` vẫn được tìm trước cho tên kiểu | Vòng sửa 1: `pg_catalog, pg_temp` |
| D-M5 | Minor | Ca tiến → lùi → tiến chỉ so đủ định nghĩa CHECK, còn trigger và hàm chỉ đếm | Vòng sửa 1: so thêm `pg_get_triggerdef`, `pg_get_functiondef`, chủ và ACL |
| S-3 | Minor | Form sửa quyền tài khoản (`src/components/team-accounts.tsx`) chỉ dựng ba quyền cũ; quản trị sửa trường khác của tài khoản đang giữ mã `doc_approve` thì mã bị gỡ âm thầm (giảm quyền, không phải lỗi bảo mật) | Chuyển sang Task 7b (giao diện) |
| D-M2 | Minor | Tệp lùi 019 kiểm điều kiện trước khi giữ khoá bảng | Hoãn; tệp lùi chỉ chạy trên bản sao |
| D-M3 | Minor | Lỗi của guard không có SQLSTATE riêng (P0001) | Hoãn |
| D-M4 | Minor | `doc_types` của hàm đọc xếp theo chữ cái, `docApprovalTypes()` xếp theo thứ tự chuẩn | Chuyển sang Task 5: không so hai mảng theo vị trí |
| D-M6 | Minor | `IF NOT EXISTS` theo tên: một ràng buộc cùng tên khác định nghĩa (bản nháp từng áp ở đâu đó) sẽ được giữ lại | Vào ghi chú triển khai (kiểm trước khi áp) |
| D-M7 | Minor | Superuser tắt được trigger thường (`session_replication_role`, `DISABLE TRIGGER`); câu «áp cho mọi role, kể cả login vận hành» chỉ đúng với lệnh ghi thường | Ghi trong biên nhận |
| D-M8 | Minor, do thiết kế | Role chạy tự đặt được `app.tenant_id`/`app.project_ids`; hàm đọc khoanh vùng trung thực đúng bằng mức runtime web đặt ngữ cảnh (cùng mô hình tin cậy với `bom_eligible_members`). Lộ tối đa: mã người và loại tài liệu | Ghi trong biên nhận |

## Đã kiểm và thấy đúng (rút gọn)

- Quản trị tự cấp cho mình: bị chặn trước mọi nhánh (`accounts.ts`, kiểm `cmd.userId !== p.id`); có ca khẳng định không dòng phiếu nào được tạo.
- Chỉ Chairman đồng ý: phiếu vẫn `pending`, `access` bị từ chối (`accessChangeTally` đòi ít nhất một BoM).
- Người được cấp tự bỏ phiếu: ghế của họ không nằm trong danh sách ghế đóng băng; có ca.
- Dùng lại phiếu cũ qua dịch vụ: `access` chỉ nhận phiếu `approved` còn hạn và đúng phiên bản tài khoản, rồi chuyển sang `issued`.
- Phiếu cho dự án, loại hoặc người khác; chỉ một trong hai mã; dời dòng sang dự án hoặc người khác: đều bị guard từ chối, có ca.
- Biến thể chữ hoa/thường, mã lạ: CHECK giá trị chính xác từ chối.
- Phiếu đăng ký lần đầu mang mã: bị từ chối `DOC_APPROVAL_NEEDS_ACCESS_CHANGE` trước mọi lệnh ghi; bước hoàn tất đăng ký cũng bị guard chặn.
- Role chạy vẫn không đọc, không ghi được `identity.memberships` (bốn lệnh đều `permission denied`); chỉ `libetech_runtime` chạy được `document_approvers`.
- Hàm đọc không có ngữ cảnh trả rỗng; chỉ trả mã người và loại tài liệu; loại tài khoản bị khoá, chưa kích hoạt và vai `viewer`.
- Gỡ CHECK cũ chỉ khớp ràng buộc nhắc tới `report_permissions`; tập giá trị mới chứa tập cũ nên không dòng hiện có nào vi phạm.
- Migration chạy hai lần không lỗi; trạng thái áp dở được xử lý; cả tệp là một transaction.
- Tệp lùi: kiểm thứ tự, từ chối khi còn membership hoặc phiếu mang mã, khôi phục đúng CHECK ba giá trị dưới tên cũ, không `CASCADE`, không xoá role.
- Sửa `tests/outbox-schema.test.ts` chỉ ở phần dựng và dọn; không đổi điều khẳng định nào.
- Không bí mật, token, chuỗi kết nối hay mã Telegram thật trong diff; fixture tổng hợp.

## Ghi chú triển khai cho migration 019 (cho điểm dừng áp lên dữ liệu thật — chưa áp ở đâu)

**Kiểm trước, chỉ đọc, trên máy chủ thật:**
- `SELECT max(version) FROM schema_migrations` phải là `018`.
- `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='identity.memberships'::regclass AND contype='c'`: chỉ có `memberships_project_role_check` và `memberships_report_permissions_check` (ba giá trị); chưa có `memberships_grant_permissions_check`.
- Chưa có trigger `memberships_doc_approve_guard`, chưa có hàm `public.document_approvers` và `identity.memberships_doc_approve_guard`.
- Có role `libetech_identity` và `libetech_runtime`.
- Login chạy migration sở hữu `identity.memberships` (hoặc là superuser), có CREATE trên schema `identity` và `public`, và được phép `ALTER FUNCTION … OWNER TO libetech_identity`.
- Không có transaction dài chạm `identity.*`.
- Đếm `identity.memberships` để ghi biên nhận (thời gian kiểm CHECK tỉ lệ với số dòng).
- Xác định login vận hành trên máy chủ thật có phải superuser không. Guard đọc `identity.account_approvals` dưới FORCE RLS bằng quyền người gọi: login không phải superuser và không có `app.tenant_id` sẽ bị từ chối (chặn mặc định).

**Khoá:** `ADD CONSTRAINT … CHECK` giữ ACCESS EXCLUSIVE trên `identity.memberships` tới COMMIT. Trong lúc chờ (tối đa 5 giây theo `lock_timeout`) và lúc giữ khoá, mọi lần đăng nhập, kiểm phiên và đọc quyền xếp hàng phía sau. Chọn khung giờ vắng. Hết giờ chờ thì cả tệp bị huỷ, không áp dở; chạy lại được. Không khoá `identity.account_approvals`.

**Kiểm sau khi áp:** `pg_get_triggerdef` nêu đủ bốn cột; `has_function_privilege('libetech_intake','public.document_approvers(uuid)','EXECUTE')` là false; chủ hàm là `libetech_identity`.

**Điều kiện lùi:** không còn migration sau được ghi; không membership và **không phiếu ở bất kỳ trạng thái nào** (`grants` hoặc `previous_grants`) mang mã `doc_approve:`. Role ứng dụng không xoá được phiếu. Vì vậy sau lần đầu tiên có người đề xuất một phiếu nêu mã này, tệp lùi bị chặn vĩnh viễn trừ khi sửa tay dữ liệu, điều các luật hiện hành cấm: **trên thực tế 019 thành một chiều kể từ phiếu đầu tiên.** Chairman cần biết điều này ở điểm dừng áp migration. Tệp lùi chỉ chạy trên bản sao và chỉ khi Chairman duyệt.

## Vòng sửa 1/3 (15/11/2026)

Sửa S-1, D-1 (phần điều kiện hạn và lời ở đầu tệp migration), S-2, D-M1, D-M5; chỉ chạm `migrations/019_document_approver_grant.sql`, `tests/doc-approver-grant.test.ts`, `tests/migrations-rollback.test.ts`.

- **S-1, điều học được:** xoá riêng dòng lọc `tenant_id` của `document_approvers` thì ca mới **vẫn xanh**, vì hàm chạy dưới `libetech_identity` và FORCE RLS trên `identity.memberships`, `identity.users` đã lọc theo `app.tenant_id`. Dòng lọc đó là lớp chặn thứ hai. Ca mới (tenant khác, có mã dự án của tenant này trong ngữ cảnh → rỗng) kiểm đúng tính chất cô lập tenant; để ghim riêng dòng lọc, builder tạm đổi chủ hàm sang superuser (RLS không còn tác dụng) rồi xoá dòng → ca đỏ; sau đó khôi phục migration và so lại bằng nhau. Log: `task-04a-fix1-mutation.txt`.
- **D-1:** guard chỉ nhận phiếu `issued`, hoặc `approved` còn hạn; có ca «an approved ballot past its expiry does not admit the code». Không thêm điều kiện về phiếu bầu. Phần đầu tệp migration ghi đúng điều CSDL bảo đảm.
- **S-2:** ca dưới `SET LOCAL ROLE libetech_identity` chỉ chạy native (PGlite bỏ qua).
- **D-M5:** ca rollback 019 so thêm định nghĩa trigger, định nghĩa hai hàm, chủ và ACL của hàm đọc sau tiến → lùi → tiến.

Số đo sau vòng sửa (log `task-04a-fix1-*.txt`): PGlite cả bộ 524 đạt, 25 bỏ qua; PostgreSQL 16 thật trên CSDL thử mới, cả bộ 549 đạt, 0 bỏ qua; typecheck sạch; `src/server/account-approval.ts` và `bot-plugin/` không đổi. Lần chạy «native» đầu tiên của builder không nạp tệp biến nên thực chất là PGlite; đã chạy lại và ghi đè log.
