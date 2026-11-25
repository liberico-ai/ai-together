## Việc (GIAO VIỆC 5, hạng mục B — không phải lát 1–5)

Tin Telegram đi từng bước tới việc: nhận (mã IN, biên nhận) → phân loại → lập yêu cầu việc hoặc nối với việc có sẵn → ghế BoM duyệt (luật của hạng mục A, đã merge ở `d0d3d76`). Mục tiêu, lời Chairman ngày 25/11/2026, chép nguyên: «Hoàn thiện GO LIVE để toàn bộ Team Tech tạo và cập nhật được công việc thật, gồm cả các vấn đề đã ghi nhận trong LibeAI và Dragon Forge. Phương đưa được danh sách việc của cả team từ bảng hiện có lên nền tảng.»

Dragon Forge, theo giao việc: nhóm Telegram chung của cả Team Tech; không gắn với dự án nào; dự án chọn ở bước phân loại, chưa chọn thì «chưa gán dự án»; mọi thành viên Tech gửi được vào intake; quyền đọc theo quyền từng dự án; IBS HI chỉ con trỏ, hash và metadata công việc Tech (`AGENTS.md`).

Theo giao việc của Cowork điều phối: cổng chạy **một vòng** mỗi PR. Chỉ P0 chặn merge (rò dữ liệu, leo quyền, mất dữ liệu); P1/P2 ghi vào biên nhận và sửa tiến. Vẫn xếp hạng mọi finding theo thang của lời nhắc trên.

Đầu vào là **diff của mã** (`src`, `migrations`, `deploy`, `scripts`, `bot-plugin`, `tests`, `vitest.config.ts`) so với `libetech-ai-os` (`d0d3d76`, đã có hạng mục A). Đọc `docs/plans/gv5-b-intake-to-work.md` (mục 3, 5, 9, 12), OQ-61 cuối `docs/OPEN-QUESTIONS.md`, `docs/RUNBOOK-GV5-B-POOL.md`, `docs/EVIDENCE-REQUEST-20261125.md` và phần còn lại từ cây làm việc.

## Đã đổi

- `migrations/025_intake_pool_links.sql` (+ `rollback/025`, từ chối khi bảng có dòng):
  - `intake_pool_items` (Z1, cấp tenant, `project_id` NULL tới khi phân loại): bốn trường nguồn, toạ độ tin, `content_hash` (HMAC do plugin tính), số lần sửa, loại và kích thước tệp, `state` `unassigned|assigned|dismissed`. **Không có cột chữ, tên tệp hay nhãn người gửi.** Trigger chặn xoá, đổi dự án khi đã có, `version` không tăng đúng một, `triaged_by` khác `app.person_id`.
  - `intake_pool_events` chỉ thêm, payload khoá snake_case giới hạn bằng CHECK, có `seq`.
  - `intake_work_links` (Z1, theo dự án, chỉ thêm): nguồn là ứng viên hoặc mục pool, đích là yêu cầu hoặc việc; `UNIQUE(tenant_id,source_key,target_key)` + `ON CONFLICT DO NOTHING`; `UNIQUE(work_request_id)`; khoá ngoại ghép `(id,tenant_id,project_id)`.
  - RLS `ENABLE` + `FORCE`, `USING` + `WITH CHECK`. Pool: chỉ thành viên roster Tech (`app_actor_is_tech_member()`); vai `libetech_intake` chèn và cập nhật hash. Liên kết: đọc khi dự án trong phạm vi hoặc chính người tạo; policy đọc hỏi `work_requests` dưới quyền người gọi.
  - Hàm `SECURITY DEFINER` mới, chủ `libetech_identity`, `search_path=pg_catalog`, PUBLIC thu hồi: `intake_pool_sender(telegram_id)`, `intake_link_allowed(project)`, `tech_roster_names()`, `intake_pool_link_count(item, project)`.
- `migrations/026_outbox_pool_receipt.sql` (+ rollback): `outbox_messages.pool_item_id`, template `intake.pool_received`; dòng outbox nhóm không dự án chỉ khi có `pool_item_id` và đúng template; CHECK thêm `NOT VALID` rồi `VALIDATE`.
- `src/server/intake.ts`, `bridge-config.ts`: nhóm trong `intake.poolChats` đi đường pool; `poolChats` không được giao với `chats`/`excerptChats`, và nhóm pool có dự án trong `chatScopes` thì cấu hình bị từ chối nạp. Máy chủ bỏ chữ, nhãn, tên tệp, locator, sha256 của tệp trước SQL. Người gửi phải thuộc roster, đã liên kết Telegram, đang hoạt động; tin phải gọi bot.
- `src/server/intake-pool.ts`: đọc pool và các lệnh `triage`+`file_request`, `triage`+`link_work`, `dismiss` (mã lý do, không chữ tự do), `reopen` (chỉ khi mọi yêu cầu đã bị từ chối và không có liên kết việc; một câu 409 cho mọi trường hợp khác). Mục pool khoá `FOR UPDATE` suốt lệnh.
- `src/server/inbox.ts`: hai lệnh mới trên ứng viên `confirmed` của nhóm gắn dự án: `file_request`, `link_work`; cả hai cần đọc được ứng viên.
- `src/server/work-requests.ts`: phần lập yêu cầu tách ra `fileRequestIn(tx, p, input, {origin, sourceRef, authorization})` để dùng chung cho form và intake; vẫn kiểm `work_request_filer(project)` của A trước khi chèn. `source_ref` của intake = mã IN + uuid nội bộ của mục pool hoặc ứng viên, không có id nào của Telegram.
- `src/server/intake-trail.ts`: hàm thuần dựng dải bước và «đang chờ ai» từ các dòng sự kiện; lời trung tính khi người đọc không thấy yêu cầu.
- `src/server/intake-scope.ts`: `intakePoolScoped` — vai `libetech_intake`, phạm vi cấp tenant, `app.project_ids` rỗng.
- `src/server/outbox.ts`, `bridge-io.ts`: `enqueuePoolReceipt` ghi dòng nhóm không dự án gắn mục pool, params chỉ `ref` và `observedAt`, `ON CONFLICT DO NOTHING` theo `dedupe_key`; dịch vụ outbox dùng phạm vi cấp tenant khi có `poolChats` và danh sách dự án của principal intake rỗng.
- `bot-plugin/__init__.py` (0.3.3): với nhóm pool, bỏ chữ, tên tệp, nhãn người gửi và không tải tệp **trước** khi ghi spool hay gửi; hash là HMAC-SHA256 dưới khoá cục bộ `pool-hash.key` (0600, tự tạo); mẫu biên nhận pool.
- Giao diện: `/inbox/pool`, nút «Tin nhóm chung» cho thành viên Tech, form lập yêu cầu và nối việc trên thẻ ứng viên, «Từ tin IN-…» trên trang yêu cầu.

## Quyết định cố ý (nói nếu bạn thấy sai)

- Cách hiểu tạm OQ-61: B1 (1) chỉ tin gọi bot vào pool; B2 (1) mọi thành viên Tech thấy tên dự án của mục đã gán, nội dung yêu cầu/quyết định/việc chỉ người có quyền dự án thấy; B3 (1) lập yêu cầu theo luật A; B4 (1) nhiều việc trong cùng một dự án; B5 (1) không có báo cáo số đếm (cần Z2 + projector, AR-07); B6 (1) liên kết chỉ thêm, chưa có lệnh gỡ.
- Không nới `project_id NOT NULL` của năm bảng intake 016: bảng pool riêng.
- Lệnh pool không dùng bảng `commands` (bảng đó cần dự án): idempotency của `file_request` là `requestKey` (UNIQUE của A), của `link_work` là UNIQUE của liên kết sau khi khoá mục pool.
- Chưa có CHECK trên dạng `work_requests.source_ref`: B không sửa bảng của A.
- `dismiss`/`reopen` gọi lại sau khi đã thành công trả 409, không phát lại kết quả cũ.
- Mở lại mục đã gán xoá `project_id`; lịch sử liên kết và sự kiện vẫn còn.
- Kích hoạt Dragon Forge là bước vận hành ngoài repo, chờ EV-12/EV-13.

## Hãy soi kỹ

Chữ của tin, tên tệp hay nhãn người gửi lọt vào bất kỳ cột, payload, spool, log hay biên nhận nào của nhóm pool (nhất là trước khi biết miền, và khi gán vào dự án IBS HI); id của Telegram (chat, message, topic, user) lọt vào `work_requests`, sự kiện của yêu cầu hay audit; người ngoài roster đọc hoặc ra lệnh trên pool; dự án suy ra từ nhóm; leo quyền qua bốn hàm `SECURITY DEFINER` mới hoặc dùng chúng làm oracle (có/không, đếm); nối việc của dự án khác hoặc tenant khác; đường intake lập yêu cầu bỏ qua `work_request_filer`; người lập tự duyệt qua đường intake; mở lại làm lộ quyết định BoM mà người gọi không đọc được; hai lệnh song song trên cùng mục; dòng outbox không dự án bị người khác đọc; gộp số liệu giữa Liberico BU · Xeca · IBS HI; rollback 025/026 làm mất dữ liệu; biên nhận hoặc tài liệu gọi mức «đã triển khai/đã nghiệm thu».
