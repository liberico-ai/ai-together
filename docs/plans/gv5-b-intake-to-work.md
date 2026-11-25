# Kế hoạch GIAO VIỆC 5 · hạng mục B — Tin Telegram thành việc, từng bước một

Ngày: 25/11/2026 · Nhánh đề xuất: `feat/gv5-b-intake-to-work`, cắt từ nhánh của hạng mục A sau khi A merge · Migration: `025`, `026`.
Căn cứ: yêu cầu Chairman 25/11/2026 cho hạng mục B (bản nguyên văn do phiên điều phối giữ; kế hoạch này chỉ diễn giải), `AGENTS.md` (dòng 16: IBS HI chỉ con trỏ, hash, metadata), `docs/plans/gv5-a-tech-create-approval.md`, `migrations/016`, `017`, `023`, `024`.
Trạng thái: đã xây (mã và ca kiểm có trong nhánh `feat/gv5-b-intake-to-work`; chưa nghiệm thu, chưa triển khai). Mục 12 ghi chỗ khác với kế hoạch ban đầu. Các mục «cách hiểu tạm» ở mục 9 chờ Chairman; lát dừng ở từng mục đó nếu câu trả lời khác.

## 1. Hiện trạng (#fact, đọc mã ở checkout của A)

- Tin nhóm đi: plugin `bot-plugin/__init__.py` (hook intake) → `POST /api/bridge/intake/events` → `IntakeService.ingest` (`src/server/intake.ts:44`). Dự án chỉ lấy từ `chatScopes` của cấu hình bridge; nhóm phải gắn đúng một dự án (`intake.ts:48-51`), nếu không thì không lưu gì.
- Mọi bảng intake (`source_events`, `source_event_revisions`, `intake_attachments`, `intake_candidates`, `intake_events`) có `project_id NOT NULL` và RLS theo `app.project_ids` (`016:44-129`, `:154-229`). Biên nhận nhóm trong `outbox_messages` buộc có `project_id` (`017:64-65`).
- Chữ của tin được lưu ngay lúc nhận khi nhóm nằm trong `excerptChats` và dự án không thuộc IBS_HI (`intake.ts:65-71`). Miền chỉ suy được từ dự án, tức là phải biết dự án trước khi nhận.
- Mã IN = `'IN-'` + 8 ký tự hex đầu của id ứng viên (`intake.ts:38`), không lưu, không có ràng buộc duy nhất.
- Hộp tin (`src/server/inbox.ts`): đọc cần vai `manager|engineer|technical|business` của dự án; thao tác chỉ điều phối (`:30-42`). `link_ticket` chỉ ghi một chuỗi `TK-…` (`:53`). **Chưa có liên kết nào từ ứng viên tới `work_items` hay `work_requests`.**
- `reports.ts` không đọc bảng intake nào: hôm nay không có báo cáo nào gộp «đã nhận» với «đã có việc».
- Dragon Forge: `deploy/pilot-scope.json:13` ghi nhóm này bị loại khỏi pilot; `deploy/install-user.py:63-64` ghi mọi nhóm bị từ chối vào `chatScopes` với phạm vi rỗng; `tests/identity.test.ts` có ca «denies Dragon Forge». Theo repo, Dragon Forge **không** phải nhóm intake: tin từ đó bị `SCOPE_DENIED`, không lưu, không biên nhận. `scripts/setup-local-verification.ts:18` gắn nhóm vào một dự án chỉ ở máy thử. Cấu hình thật trên máy chủ nằm ngoài repo, **chưa kiểm được ở đây** (mục 8, bước 0).

## 2. Chuỗi bước và sự kiện

Mỗi bước là một dòng sự kiện riêng, có tác nhân và thời điểm. Không bước nào được suy ra từ bước khác.

| Bước | Ai | Sự kiện | Nơi ghi |
|---|---|---|---|
| 1. Đã nhận | dịch vụ intake | `source_event.persisted` + `candidate.created` (nhóm gắn dự án) · `pool.received` (nhóm chung) | `intake_events` · `intake_pool_events` |
| 1b. Biên nhận | outbox | dòng `outbox_messages` + `delivery_receipts` | như hôm nay |
| 2. Xác nhận, phân loại | điều phối dự án · thành viên Tech (nhóm chung, kèm chọn dự án) | `candidate.confirmed` (đã có) · `pool.triaged` | như trên |
| 3a. Tạo yêu cầu việc | người lập | `candidate.request_filed` / `pool.request_filed` + `work_request_events.submitted` (A) | cùng một transaction |
| 3b. Liên kết việc đã có | người có quyền ở dự án | `candidate.work_linked` / `pool.work_linked` | cùng transaction với dòng liên kết |
| 4. BoM duyệt | ghế BoM khác người lập | `work_request_events.approved|rejected` + `audit_events.created` (A, không đổi) | A |

Biên nhận IN chỉ chứng minh bước 1. Hàm thuần `intakeTrail()` dựng trạng thái hiển thị từ các dòng trên và trả `waitingOn`:
«người phân loại (Team Tech)», «điều phối dự án», «ghế BoM của dự án», «dự án chưa có ghế BoM» hoặc rỗng. Chỉ có bước 1 thì nhãn là «Đã nhận — chưa tạo việc».

## 3. Nhóm chung (Dragon Forge) = nhóm pool

### 3.1 Đánh giá phương án «pool không lưu chữ» — nhận, có bổ sung

Nhận phương án phiên điều phối đề xuất. Ba lý do:
1. Miền chỉ biết ở bước 2, nên mọi cách lưu chữ ở bước 1 đều có lúc giữ chữ IBS HI. Cách «lưu rồi xoá khi gán IBS HI» trái tính bất biến của bản ghi nguồn và vẫn để chữ nằm trong bản sao lưu.
2. Người đọc pool là thành viên Tech, đã ở trong nhóm; con trỏ đủ để họ mở tin trong Telegram.
3. Tiêu đề và tiêu chí việc do người phân loại tự gõ là metadata công việc Tech, đúng mức `AGENTS.md:16` cho phép ở dự án IBS HI.

Hai bổ sung bắt buộc, nếu thiếu thì phương án **không** đạt:
- **Chặn từ plugin.** Hôm nay plugin gửi chữ lên máy chủ, ghi chữ vào spool khi mất kết nối và tải tệp đính kèm về kho của gateway. Với nhóm pool, plugin phải bỏ chữ, tên tệp, nhãn người gửi và **không tải tệp** trước khi spool hay gửi. Máy chủ vẫn bỏ lần nữa (hai lớp).
- **Bảng riêng, không có cột chữ.** Không nới `project_id` của năm bảng 016: làm vậy vô hiệu các khoá ngoại ghép ba cột và phải viết lại RLS cùng thứ tự luồng của 023. Bảng pool mới không có cột nào chứa chữ, tên tệp hay nhãn; ca kiểm đọc danh mục cột để giữ điều đó.

Không thấy phương án nào đổi ranh giới BU: **không có mục DỪNG về kiến trúc**. Có một điều kiện trước khi bật ở mục 8 (bước 0) nằm ngoài repo.

### 3.2 Luật của pool

- Tin vào pool khi: nhóm nằm trong `intake.poolChats`; người gửi đã liên kết Telegram, đang hoạt động và thuộc `identity.tech_roster`; tin gọi bot (lệnh `/…`, nhắc tên bot, hoặc trả lời bot — cờ `addressed` sẵn có). Thiếu một điều → không lưu gì, không trả lời (như nhóm bị từ chối hôm nay). *Cách hiểu tạm B1.*
- Một tin = một mục pool. Mã IN dùng cùng công thức với id mục pool. Sửa tin chỉ đổi hash, tăng số lần sửa, ghi `pool.revised`.
- Mục pool không có dự án cho tới bước 2; giao diện ghi «chưa gán dự án». Dự án không bao giờ suy từ nhóm: `poolChats` không được trùng `intake.chats`, và mã pool không đọc `chatScopes`.
- Xem pool: thành viên Tech (roster). Người có quyền dự án nhưng ngoài roster không thấy pool.
- Phân loại: mọi thành viên Tech chọn dự án + loại, rồi **trong cùng transaction** hoặc lập yêu cầu việc, hoặc liên kết việc đã có. Mục pool nhận đúng một dự án, ghi một lần.
  - Lập yêu cầu: theo luật A (`work_requests`, `origin='intake'`, `source_ref` = mã IN + id nội bộ (uuid) của mục pool, chờ ghế BoM khác người lập).
  - Liên kết việc đã có: cần quyền khác `viewer` ở dự án đó hoặc ghế BoM của dự án đó.
- Sau khi gán: thành viên Tech thấy mục «đã gán» và tên dự án (họ đã thấy danh mục dự án theo A). Nội dung yêu cầu, quyết định BoM và việc chỉ hiện cho người lập và người có quyền ở dự án. *Cách hiểu tạm B2.*
- Bỏ qua mục pool: chọn một mã lý do (`not_work`, `duplicate`, `wrong_group`), không có ô chữ tự do. Mở lại được khi chưa gán.
- Gán nhầm dự án: mở lại chỉ khi mọi yêu cầu của mục đã bị từ chối và không có liên kết việc; ghi `pool.reopened`.

### 3.3 Biên nhận cho tin pool

Không hoãn: Chairman yêu cầu IN kèm biên nhận. `026` cho phép dòng outbox nhóm **không có dự án** khi và chỉ khi có `pool_item_id` và template là `intake.pool_received`. Plugin thêm mẫu: «Đã nhận, mã {ref}. Chưa gán dự án. Đây chưa phải việc đã tạo.» Tham số chỉ có `ref` và `observedAt`; không tên dự án, không chữ của tin. Trạng thái gửi hiện trên mục pool («đã gửi biên nhận» / «chưa gửi được»). Xử lý lại biên nhận pool hỏng (take/requeue/abandon) ngoài phạm vi B.

## 4. Nhóm gắn dự án (như LibeAI)

Luồng nhận, chế độ chữ và sáu lệnh hiện có không đổi. Thêm hai lệnh trên ứng viên ở trạng thái `confirmed`:
- `file_request`: người có vai đọc được ứng viên (`readable()`) lập yêu cầu việc theo luật A, `origin='intake'`. *Cách hiểu tạm B3.* Form để trống; máy chủ không chép chữ của tin vào yêu cầu.
- `link_work`: cần quyền khác `viewer` hoặc ghế BoM ở dự án; việc phải thuộc cùng dự án với ứng viên.
Cả hai kiểm `expectedVersion`, tăng `version` của ứng viên, không đổi `state`, ghi một dòng `intake_events`. `link_ticket` (chuỗi `TK-…`) giữ nguyên.

## 5. Migration

### `025_intake_pool_links.sql` (+ `rollback/025_…`; rollback từ chối khi có dòng)

- `intake_pool_items` (Z1, cấp tenant): `id`, `tenant_id`, `created_at`, `updated_at`, bốn trường nguồn (`source_id`, `source_type='telegram_gateway'`, `ingested_at`, `quality_score`), `chat_id`, `topic_id`, `message_id`, `reply_to_message_id`, `locator`, `sender_id` (FK `identity.users`), `observed_at`, `edited_at`, `content_hash`, `revision_count`, `forwarded`, `attachment_mime`, `attachment_size`, `state` (`unassigned|assigned|dismissed`), `classification`, `dismiss_code`, `project_id` (NULL, FK `projects`), `triaged_by`, `triaged_at`, `version`, `trace_id`, `correlation_id`.
  - `UNIQUE(tenant_id,source_type,chat_id,message_id)`; `CHECK((state='assigned')=(project_id IS NOT NULL))`; index trên FK và `created_at`.
  - Trigger chặn: xoá; đổi `project_id` khi đã có; `version` không tăng đúng một; `triaged_by` khác `app.person_id`.
- `intake_pool_events`: chỉ thêm (`reject_history_mutation`); `kind` ∈ `pool.received|revised|triaged|request_filed|work_linked|dismissed|reopened`; `actor_id`, `actor_kind`, `request_id`, `trace_id`, `payload` ≤ 2048 byte (chỉ id, trạng thái, phiên bản).
- `intake_work_links` (Z1, theo dự án, chỉ thêm): `tenant_id`, `project_id`, đúng một trong `candidate_id` / `pool_item_id`, đúng một trong `work_request_id` / `work_id`, `created_by`, `created_by_name`, `created_at`, `updated_at`; hai cột sinh `source_key`, `target_key`.
  - `UNIQUE(tenant_id,source_key,target_key)` — liên kết lại là `ON CONFLICT DO NOTHING`; `UNIQUE(work_request_id)` — một yêu cầu chỉ sinh từ một nguồn. Khoá ngoại ghép `(id,tenant_id,project_id)` tới ứng viên, yêu cầu, việc.
- RLS `ENABLE` + `FORCE`, mọi policy có `USING` và `WITH CHECK` nơi có ghi:
  - Pool (`items`, `events`), vai `libetech_runtime`: đọc và ghi khi cùng tenant **và** `app_actor_is_tech_member()`; sự kiện phải có `actor_id = app.person_id`. Vai `libetech_intake`: chèn và cập nhật cột hash/số lần sửa trong tenant. Không có ngữ cảnh → 0 dòng.
  - Liên kết, `libetech_runtime`: đọc khi cùng tenant và (dự án ∈ `app.project_ids` hoặc `created_by = app.person_id`); chèn khi `created_by = app.person_id` và (đích là yêu cầu do chính người đó lập, hoặc `intake_link_allowed(project_id)`).
- Hàm `SECURITY DEFINER` mới, chủ `libetech_identity`, `search_path=pg_catalog`, thu hồi `PUBLIC`:
  - `intake_pool_sender(telegram_id text) → uuid`: id người đã liên kết Telegram, đang hoạt động, thuộc roster của tenant hiện tại; ngược lại NULL. `EXECUTE` cho `libetech_intake`.
  - `intake_link_allowed(target_project uuid) → boolean`: tác nhân có membership ở dự án với `project_role <> 'viewer'` và tài khoản hoạt động, hoặc `work_request_seat(target_project)`. `EXECUTE` cho `libetech_runtime`.
  - `tech_roster_names() → (id, name)`: tên thành viên roster, chỉ cho thành viên Tech, để hiện người gửi và người phân loại. Bên xây dựng kiểm hàm tên sẵn có trước; có thì không thêm.
  - Dùng lại của A: `app_actor_is_tech_member()`, `tech_project_catalog()`, `work_request_seat()`.
- Cấp quyền theo cột; không cấp `DELETE` cho vai nào.

### `026_outbox_pool_receipt.sql` (+ rollback; từ chối khi có dòng biên nhận pool)

- `outbox_messages`: thêm `pool_item_id` (FK) + index; thêm template `intake.pool_received`; thay CHECK đối tượng nhận: nhóm có dự án và không có `pool_item_id` (như cũ), **hoặc** nhóm không dự án, có `pool_item_id`, đúng template pool. Ràng buộc mới thêm `NOT VALID` rồi `VALIDATE` (M-06).
- Policy `intake_*` của `outbox_messages`, `delivery_receipts`: thêm nhánh «không dự án và có `pool_item_id`». Policy đọc mới cho `libetech_runtime`: dòng pool, chỉ thành viên Tech.

## 6. Tệp đã chạm (khớp với mã)

| Tệp | Thay đổi |
|---|---|
| `migrations/025_…`, `026_…` + `rollback/` | Mục 5 |
| `src/server/bridge-config.ts` | Khoá `intake.poolChats`; từ chối cấu hình khi nhóm pool trùng `intake.chats` hoặc `excerptChats`, hoặc có dự án trong `chatScopes` |
| `src/server/intake-scope.ts` | `intakePoolScoped` (tenant, không dự án) |
| `src/server/intake.ts` | Nhánh pool trước nhánh `chatScopes`: không đưa `text`, `actorLabel`, `fileName` vào SQL; chỉ lưu loại tệp khi đúng dạng mime; `ON CONFLICT DO NOTHING`; `pool.received`/`pool.revised` (sửa tin chỉ khi giờ sửa mới hơn và hash khác); biên nhận pool |
| `src/server/intake-pool.ts` (mới) | `PoolService`: `list` (kèm số tin chưa gán dự án, không có tổng), `detail`, `command` (`file_request`, `link_work`, `dismiss`, `reopen`); khoá dòng mục pool suốt lệnh; không dùng bảng `commands` |
| `src/server/intake-trail.ts` (mới) | `intakeTrail()` thuần, dùng chung cho pool và ứng viên; lời trung tính khi không đọc được yêu cầu |
| `src/server/inbox.ts` | Lệnh `file_request` (Team Tech hoặc điều phối dự án, theo luật của A) và `link_work` trên ứng viên đã xác nhận; cả hai cần quyền đọc ứng viên; thẻ ứng viên thêm `trail` |
| `src/server/work-requests.ts` | `fileRequestIn()` dùng chung cho form, pool và ứng viên (`origin`, `source_ref` do bên gọi đặt, không từ JSON) |
| `src/server/outbox.ts`, `bridge-io.ts` | `enqueuePoolReceipt`; kéo outbox chạy được khi chỉ có nhóm pool |
| `src/server/inbox-http.ts` | `GET inbox/pool`, `GET inbox/pool/:id`, `POST inbox/pool/:id/commands`; bot → `READ_ONLY` |
| `bot-plugin/__init__.py` | Khoá `poolChats` (không giao với `chats`); nhóm pool: chỉ tin gọi bot, bỏ chữ/tên tệp/nhãn, không tải tệp, hash là HMAC với khoá do plugin tự tạo (`pool-hash.key`); mẫu `intake.pool_received` |
| `src/components/inbox.tsx`, `inbox-work.tsx`, `inbox-trail.tsx`, `inbox-pool.tsx`, `src/app/inbox/pool/page.tsx`, `work-requests.tsx`, `workspace.tsx` | Dải bước, «đang chờ ai», «chưa gán dự án», form phân loại; yêu cầu hiện «Từ tin IN-…»; liên kết «Tin nhóm chung» trong thanh bên chỉ cho thành viên roster |
| `docs/RUNBOOK-GV5-B-POOL.md` (mới) | Mục 8 |
| `tests/intake-pool.test.ts`, `intake-links.test.ts`, `intake-trail.test.ts`, `intake-pool-isolation.test.ts`, `pool-fixtures.ts` (mới); sửa `migrations-rollback`, `outbox-schema`, `post-restore`, `pre-023-check`, `thread-order`, `inbox-http`, `inbox-ui`, `test_bot_bridge.py` | Mục 7 |

Không thêm phụ thuộc. Không thêm báo cáo: B chỉ đọc Z1 theo từng mục, có phân trang. Số đếm theo miền cần bảng Z2 và projector có tên (AR-07) — lát riêng (*B5*).

## 7. Task và ca kiểm (viết ca trước, thấy đỏ bằng lỗi khẳng định rồi mới viết mã)

**T1 — 025 và RLS.** Lệnh: `npx vitest run tests/intake-pool-isolation.test.ts tests/rls-catalog.test.ts tests/migrations-rollback.test.ts`
1. Danh mục cột của `intake_pool_items` và `intake_pool_events` không có cột chữ, tên tệp, nhãn người gửi.
2. Không ngữ cảnh → 0 dòng ở cả ba bảng. Tenant khác → 0 dòng; chèn với tenant khác → bị chặn.
3. Người ngoài roster, kể cả điều phối của một dự án, đọc pool → 0 dòng; gọi lệnh → `SCOPE_DENIED`.
4. Thành viên của dự án Y không thấy liên kết và yêu cầu của mục pool đã gán cho dự án X.
5. Chèn liên kết với `created_by` của người khác → bị chặn. Xoá, sửa liên kết hoặc sự kiện → bị chặn. Đổi `project_id` đã gán → bị chặn.
6. Vai runtime không có `BYPASSRLS`; ba hàm mới thuộc `libetech_identity` và không cấp cho `PUBLIC`.
7. Áp 025 hai lần không lỗi; rollback từ chối khi có dòng.

**T2 — Nhận tin pool.** Lệnh: `npx vitest run tests/intake-pool.test.ts tests/bridge-io.test.ts`
8. Tin pool mang chuỗi canary trong chữ, tên tệp, nhãn → sau khi nhận, quét mọi cột kiểu chữ và jsonb của mọi bảng: không thấy canary. Lặp lại sau khi gán vào dự án có miền IBS_HI.
9. Người gửi chưa liên kết, ngoài roster, hoặc tin không gọi bot → không dòng nào, không biên nhận.
10. Gửi lại cùng tin → một mục, `replayed`; sửa tin → `revision_count` tăng, `pool.revised`, không có mục thứ hai. Hai lần gửi song song → một mục (native harness).
11. Nhóm pool có mặt trong `chatScopes` với một dự án → mục pool vẫn không có dự án. Cấu hình có nhóm vừa ở `poolChats` vừa ở `intake.chats` → từ chối nạp, trả 503.
12. Nhóm gắn dự án: các ca hiện có của `intake.test.ts` không đổi kết quả.

**T3 — 026 và biên nhận pool.** Lệnh: `npx vitest run tests/outbox-schema.test.ts tests/outbox.test.ts tests/intake-pool.test.ts`
13. Tin pool mới → một dòng outbox không dự án, template pool; tham số chỉ `ref`, `observedAt`. Gửi lại → không dòng thứ hai.
14. Dòng nhóm không dự án và không `pool_item_id` → CHECK chặn. Kéo outbox khi chỉ cấu hình nhóm pool vẫn trả dòng pool và không trả dòng của dự án ngoài phạm vi.

**T4 — Phân loại pool.** Lệnh: `npx vitest run tests/intake-pool.test.ts tests/intake-links.test.ts`
15. Thành viên Tech không có quyền ở X lập yêu cầu vào X → `work_requests` `pending`, `origin='intake'`, `source_ref` có mã IN; hai sự kiện `pool.triaged`, `pool.request_filed`; mục pool mang X.
16. Body có `origin`, `tenantId`, `requesterId`, `senderId` → schema từ chối. Bot → `READ_ONLY` 403.
17. Cùng khoá, cùng nội dung → trả kết quả cũ, vẫn một yêu cầu và một liên kết. Sai `expectedVersion` → `REVISION_CONFLICT` 409.
18. Liên kết việc đã có: `viewer` ở X → `LINK_DENIED` 403; Tech không có quyền ở X → 403; `engineer` ở X hoặc ghế BoM của X → được. Việc thuộc dự án khác với dự án đã chọn → `SCOPE_DENIED`.
19. Liên kết lại cùng cặp nguồn–việc → không dòng mới, không sự kiện mới. Hai người liên kết song song → một dòng (native harness).
20. Bỏ qua chỉ nhận ba mã lý do; mở lại mục đã gán khi còn yêu cầu chờ duyệt → `POOL_ASSIGNED` 409.

**T5 — Ứng viên của nhóm gắn dự án.** Lệnh: `npx vitest run tests/inbox-service.test.ts tests/inbox-http.test.ts tests/intake-links.test.ts`
21. Ứng viên chưa `confirmed` → `file_request` và `link_work` trả `CANDIDATE_NOT_CONFIRMED` 409.
22. `file_request` tạo yêu cầu chờ duyệt; máy chủ không chép chữ của tin vào tiêu đề hay tiêu chí, kể cả khi nhóm ở chế độ có chữ.
23. `link_work` bởi `viewer` → 403; liên kết lại → không đổi gì; trạng thái ứng viên giữ nguyên, phiên bản tăng một.

**T6 — Dải bước.** Lệnh: `npx vitest run tests/intake-trail.test.ts tests/inbox-ui.test.tsx`
24. Chỉ có biên nhận IN → «Đã nhận — chưa tạo việc»; không có nhãn nào chứa «đã tạo» hay «đã giao».
25. Yêu cầu chờ duyệt → «chờ ghế BoM của dự án»; dự án không có ghế bật → «dự án chưa có ghế BoM»; bị từ chối → hiện người từ chối và thời điểm; đã duyệt → mã việc, người duyệt, thời điểm.
26. Mục pool chưa gán → «chưa gán dự án», chờ «người phân loại (Team Tech)». Thành viên Tech không có quyền ở dự án đã gán thấy tên dự án, không thấy tiêu đề yêu cầu.
27. `reports.ts` không đổi đầu ra; không màn hình nào cộng số của hai dự án khác miền hay cộng «đã nhận» vào «đã có việc».

**T7 — Plugin.** Lệnh: bộ kiểm Python sẵn có của plugin (bên xây dựng xác nhận tên lệnh ở checkout).
28. Nhóm pool: payload gửi đi và tệp spool không có chữ, tên tệp, nhãn; không có lần tải tệp nào; tin không gọi bot không được gửi.
29. Mẫu `intake.pool_received` chỉ nhận `ref`, `observedAt`; khoá lạ trong `intake.json` vẫn bị từ chối.

**T8 — Cổng chung.** `npm run typecheck && npm run lint && npx vitest run` trên PGlite và trên PostgreSQL thật; mỗi tệp kiểm mới chạy 8 lần liên tiếp.

## 8. Runbook cho người vận hành (chỉ giá trị giữ chỗ)

0. **Kiểm trước khi bật, ngoài repo.** Đọc cấu hình bridge thật: nhóm chung hiện có ở `chatScopes` không, phạm vi gì. Xác nhận gateway không tự lưu chữ của nhóm chung ở nơi khác (nhật ký phiên, bộ nhớ của agent). Nếu có lưu → dừng, báo Chairman.
1. Áp `025`, `026` theo quy trình migration hiện hành; có sẵn rollback.
2. Roster Team Tech và liên kết Telegram: theo `deploy/tech-roster.sql` của A.
3. Tệp `LIBETECH_BRIDGE_CONFIG` trên máy chủ: thêm `intake.poolChats: ["<DRAGON_FORGE_CHAT_ID>"]`. **Không** thêm id đó vào `intake.chats` hay `intake.excerptChats`. Không đổi `chatScopes["<DRAGON_FORGE_CHAT_ID>"]`.
4. Tệp `runtime/libetech-ai-os/intake.json` của plugin: `hookEnabled: true`; thêm `<DRAGON_FORGE_CHAT_ID>` vào khoá mới `poolChats` và KHÔNG vào `chats` (hai danh sách không giao nhau).
5. Cài bản plugin mới; khởi động lại gateway chỉ khi có lời Chairman cho lần đó.
6. Tắt: bỏ id khỏi `poolChats` ở cả hai tệp (id không bao giờ ở `chats`, nên không thể thành nhóm lưu chữ); mục đã nhận vẫn còn.

## 9. Cách hiểu tạm — chờ Chairman (ghi ở `docs/OPEN-QUESTIONS.md` OQ-61)

- **B1.** Pool chỉ nhận tin gọi bot. Phương án khác: nhận mọi tin của nhóm chung (nhiều mục không phải việc).
- **B2.** Mọi thành viên Tech thấy tên dự án mà một mục pool đã gán. Phương án khác: chỉ người có quyền ở dự án đó thấy.
- **B3.** Ở nhóm gắn dự án, người lập yêu cầu từ ứng viên phải đọc được ứng viên và được tạo việc theo luật của A (thành viên Team Tech, hoặc điều phối của dự án). Phương án khác: mọi người có vai đọc ứng viên; hoặc chỉ điều phối.
- **B4.** Một tin có thể liên kết nhiều việc trong cùng một dự án; mục pool chỉ thuộc một dự án. Phương án khác: một tin một việc.
- **B5.** B không có báo cáo số đếm theo miền. Phương án khác: thêm bảng Z2 và projector trong B.
- **B6.** Gỡ một liên kết sai chưa có lệnh; liên kết chỉ được thêm. Phương án khác: lệnh thu hồi có sự kiện riêng.

## 10. Ca kiểm nghiệm thu (người vận hành chạy trên máy chủ, tài khoản thật, không ghi id vào biên bản)

1. Thành viên Tech gửi tin gọi bot ở nhóm chung → nhóm nhận trả lời «Đã nhận, mã IN-… Chưa gán dự án…», không có tên dự án.
2. Tài khoản Tech mở trang pool → thấy mục đó: thời điểm, người gửi, «chưa gán dự án», «chờ người phân loại». Không có chữ của tin, không tên tệp.
3. Tài khoản ngoài roster (có quyền ở một dự án) mở trang pool → không thấy gì.
4. Truy vấn chỉ đọc do người vận hành chạy: không cột nào của bảng pool chứa chữ của tin vừa gửi.
5. Tài khoản Tech chọn một dự án, lập yêu cầu → trang «Việc chờ BoM duyệt» có dòng «Từ tin IN-…»; mục pool hiện «chờ ghế BoM của dự án»; **chưa** có việc.
6. Ghế BoM khác người lập duyệt → mục pool hiện mã việc, người duyệt, thời điểm. Người lập tự duyệt → bị từ chối.
7. Liên kết một mục pool khác vào việc đã có bằng tài khoản `viewer` → bị từ chối; bằng tài khoản có quyền → được; bấm lại → không có dòng thứ hai.
8. Lặp bước 1–5 với một dự án thuộc miền IBS HI → chạy lại truy vấn bước 4, vẫn không có chữ của tin.
9. Tin ở nhóm gắn dự án vẫn nhận như trước; ứng viên đã xác nhận lập được yêu cầu và liên kết được việc.
10. Thành viên của dự án khác miền không thấy yêu cầu, việc hay liên kết của bước 5–8.

Đóng lát không phải nghiệm thu: bên xây dựng không tự ký các ca trên.

## 11. Ngoài phạm vi B

Nhập bảng (C); câu trả lời của bot và lệnh đọc ở nhóm chung (D); xử lý lại biên nhận pool hỏng; báo cáo Z2; sửa tính duy nhất của mã IN 8 ký tự (liên kết dùng id đầy đủ, mã IN chỉ để hiển thị); bật Z4.

## 12. Chênh lệch khi xây (bên xây dựng ghi, 25/11/2026)

- **Sửa theo chỉ đạo của phiên điều phối.** `work_requests.source_ref` của nguồn intake = mã IN + uuid nội bộ của mục pool hoặc ứng viên (ví dụ `IN-1A2B3C4D · <uuid>`). Không có chat id, message id, topic id, `source_id` hay locator nào của Telegram đi vào yêu cầu, sự kiện của yêu cầu hay audit (ca 15 kiểm điều này). Mục 9 giữ nguyên (cách hiểu tạm B1–B6 là điều đã xây).
- **IBS HI.** Dòng pool không lưu chữ, tên tệp hay nhãn người gửi cho bất kỳ miền nào; plugin bỏ chúng cho nhóm pool trước khi ghi spool hay gửi và không tải tệp; máy chủ bỏ lần nữa (không đưa `text`, `actorLabel`, `fileName`, `locator`, `sha256` của tệp vào SQL; chỉ giữ loại tệp và kích thước). Ca 8 quét mọi cột text/jsonb của mọi bảng, trước và sau khi gán vào dự án IBS_HI.
- **Hàm thứ tư.** `intake_pool_links_outside(item, project, readable)` (SECURITY DEFINER, chủ `libetech_identity`): trả **một bit** — mục pool có liên kết nào trong dự án ngoài các yêu cầu người gọi nêu hay không; không trả con số. Lệnh mở lại đọc các yêu cầu bị từ chối mà chính người gọi đọc được (dưới RLS của người đó), đưa danh sách ấy vào hàm, và chỉ mở khi không có liên kết nào nằm ngoài; một câu 409 `POOL_ASSIGNED`: «Không mở lại được mục này.» cho mọi trường hợp khác, dù BoM đã quyết định gì. Vai identity chỉ có `SELECT (tenant_id,pool_item_id,project_id,work_request_id)` trên `intake_work_links` và không có gì trên `work_requests`. Bản đầu là `intake_pool_link_count(item, project)`, trả số liên kết cho mọi thành viên roster kể cả người không đọc được dự án; cổng Codex của PR B xếp P0, đã thay. Hàm tên sẵn có không có, nên `tech_roster_names()` vẫn được thêm.
- **Payload sự kiện pool dùng khoá snake_case** (`state_before`, `project_id`, …), CHECK giới hạn tập khoá **và giá trị** (trạng thái và mã trong danh sách, số, id dự án dạng uuid; theo cổng Codex của PR B); sự kiện của ứng viên giữ khoá camelCase như `intake_events` hiện có.
- **`file_request` ở nhóm gắn dự án theo luật của A (thành viên Team Tech hoặc điều phối dự án; kỹ sư/kỹ thuật/nghiệp vụ nhận 403 `WORK_REQUEST_DENIED`); cả hai lệnh cần quyền đọc ứng viên. `link_work` ở nhóm gắn dự án cũng cần quyền đọc ứng viên** (`readable`), rồi mới tới quyền liên kết (khác viewer hoặc ghế BoM), vì lệnh trả về thẻ ứng viên (có thể có đoạn chữ). Người chỉ có ghế BoM với vai viewer bị từ chối như người ngoài dự án.
- **Idempotency.** Lệnh pool không dùng bảng `commands` (cần dự án, mà mục pool chưa có): `file_request` dùng `requestKey` (UNIQUE của `work_requests`), `link_work` dùng UNIQUE của `intake_work_links` sau khi khoá dòng mục pool; mục pool bị khoá `FOR UPDATE` suốt lệnh.
- **Mở lại mục đã gán** xoá `project_id` (trigger chỉ chặn đổi sang dự án khác khi đã có); lịch sử liên kết và sự kiện vẫn còn.
- **Giao diện.** Trang `/inbox/pool` có form tạo yêu cầu và nút bỏ qua/mở lại; ô «liên kết việc đã có» nhận mã nội bộ của việc (chưa có bộ chọn việc). Dải bước và «đang chờ ai» có ở thẻ ứng viên và thẻ pool; yêu cầu hiện «Từ tin IN-…».
- **Ngoài phạm vi, chưa làm:** xử lý lại biên nhận pool hỏng; báo cáo Z2 theo miền (B5); gỡ liên kết sai (B6).
- **Sau đợt sửa của hai bản rà soát (25/11/2026).** Sửa tin đã gán hoặc đã bỏ qua là một lần sửa, không phải lỗi (`intake_update` chỉ kiểm tenant). Nhóm pool chỉ nằm ở `poolChats`, không ở `chats`: tắt bằng cách bỏ khỏi `poolChats`. Hash của tin pool là HMAC-SHA256 dưới khoá cục bộ của plugin; máy chủ chỉ so bằng nhau. Dải bước của mục pool chỉ lấy liên kết của dự án hiện tại. Chính sách đọc `intake_work_links` hỏi `work_requests` dưới quyền của chính người gọi, nên theo bất kỳ tập người đọc nào của A. Nhóm pool có dự án trong `chatScopes` bị từ chối nạp. Payload sự kiện pool không có id yêu cầu hay id việc. Sự kiện pool có khoá thứ tự `seq`. Lời trung tính khi không đọc được yêu cầu: «Yêu cầu chờ ghế BoM của dự án.» và «Chưa thấy yêu cầu hay liên kết việc nào trong phạm vi của bạn». Thẻ ứng viên đã xác nhận có hai nút «Lập yêu cầu việc» (form: tiêu đề tự gõ, ưu tiên, hạn, tiêu chí, liên kết đặc tả, người đề xuất lấy từ danh bạ của chính người đọc) và «Nối với việc có sẵn» (chọn trong việc của dự án của tin mà người đọc đã đọc được, dữ liệu trang đã có); hai nút gọi lệnh `file_request` và `link_work` có sẵn, máy chủ quyết định lại và trả mã như API (403 `WORK_REQUEST_DENIED`, 403 `LINK_DENIED`, …); không có đọc API mới.
- **Đã biết, chưa sửa.** (1) Ràng buộc CHECK trên `work_requests.source_ref` (dạng `IN-XXXXXXXX · uuid`) bị hoãn: B không sửa bảng của A (migration 024); ràng buộc này vào một migration sau. (2) Lệnh `dismiss` và `reopen` gọi lại sau khi đã thành công trả 409 (không phát lại kết quả cũ).
