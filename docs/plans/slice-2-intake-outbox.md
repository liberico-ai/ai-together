# Lát 2 · P1.1 — Tiếp nhận Telegram: inbox, outbox, phần còn thiếu SPEC-007 — Kế hoạch triển khai

> **Cho agent thực thi:** làm lần lượt từng task theo `superpowers:subagent-driven-development` (khuyến nghị) hoặc `superpowers:executing-plans`. Các bước dùng ô `- [ ]`. Mỗi task theo nhịp: viết ca kiểm → chạy thấy đỏ đúng lý do → viết mã tối thiểu → chạy xanh. Kế hoạch **không** gồm commit/push/PR, review Codex, biên nhận DELIVERY, cập nhật roadmap — phiên điều phối làm. Builder không commit.

Version 0.1 · 13/11/2026 · Lập bởi agent `planner` · Nhánh `slice-2-intake-outbox`, base `libetech-ai-os` @ `ce11242`.

**Căn cứ mở lát:** ngày 13/11/2026 phiên điều phối hỏi «Anh đã xem biên nhận lát 1 (DELIVERY-010) và cho mở lát 2 chưa?»; Chairman trả lời nguyên văn: «Mở lát 2». DELIVERY-010 «Đạt» ở mức «đã có mã»; OQ-01…25 đã có quyết định; migration hiện tới 015 ⇒ lát này dùng 016–018.

**Mục tiêu:** tin từ nhóm đã cấp quyền được lưu bền trước khi báo nhận (SourceEvent + revision + metadata tệp + ứng viên intake), biên nhận về đúng nhóm qua outbox có trạng thái giao tách riêng, PM xác nhận loại/trùng/dự án trên màn Inbox; hoàn tất hai ca còn thiếu của SPEC-007 (DM tự động có biên nhận giao, phiếu đổi quyền). **Chỉ tới mức «đã có mã».**

**Kiến trúc:** gateway (`bot-plugin`) ký HMAC gọi tuyến riêng dưới `/api/bridge/…` → handler mỏng → `IntakeService`/`OutboxService` chạy trong transaction với role DB riêng `libetech_intake` (chỉ ghi SourceEvent, ứng viên, outbox, biên nhận giao). Outbox ghi cùng transaction với thay đổi nghiệp vụ; gateway kéo theo lease rồi báo biên nhận; AI OS không giữ token Telegram. PM thao tác qua web bằng `scoped()` + `deduplicate` + `expectedVersion`. Quyền nhóm lấy từ `chatScopes`; `project_channels` không được đọc để cấp quyền.

**Công nghệ:** TypeScript, Next.js App Router, PostgreSQL SQL, `pg.Pool`, PGlite (test một kết nối), zod, vitest; Python 3 thư viện chuẩn cho `bot-plugin`. Không thêm dependency.

**Căn cứ:** `docs/SLICE-BRIEFS.md:1-16`, `:87-152` · `docs/DECISION-PACK-OQ-20261112.md` (§2, §3 OQ-09, §5, §6 mục 6) · `docs/ADR-002-project-document-ownership.md` 1.1 · `docs/OPEN-QUESTIONS.md` (OQ-08…13, 20, 23 và mới: OQ-26…29) · `docs/SPEC-007-telegram-account-approval.md` · `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md` và `docs/SPEC-008-PM-operating-loop-20261111.md` theo dòng · `docs/DESIGN-SYSTEM-PM-DOCUMENTS.md` · `docs/DELIVERY-010-project-document-registry-20261112.md`.

**Con trỏ brief đã kiểm lại ngày 13/11 tại `ce11242` — chỗ đã lệch:**
- `src/server/bridge.ts`: mọi dòng lệch +1 do thêm import `APP_VERSION`. Schema operation `:9-15` (brief ghi `:8-14`), chuỗi ký `:17` (`:16`), trần 4096 `:20` (`:19`), nonce `:26` (`:25`), giao phạm vi `:39-40` (`:38-39`). `DECISION-PACK…` §3 ghi `bridge.ts:43`, nay là `:44`.
- `tests/identity.test.ts`: ca cầu nối ở `:71` (brief `:70`); ca chặn nhóm khác ở `:114` (brief `:104`; `:105` nay là ca «pilot scope… no Telegram chat IDs»).
- `tests/onboarding-feedback.test.ts`: tệp có 9 ca (8 ca tài khoản `:28`…`:201` và 1 ca phản hồi `:216`); brief gọi «bảy ca» theo bảy nhóm của `SPEC-007…:45`. Cả 9 phải giữ xanh.
- Còn đúng: `src/app/api/bridge/route.ts:12`, `src/server/identity.ts:182`, `:208`, `src/server/accounts.ts:115`, `src/server/account-approval.ts:79`, `:109`, `src/server/db.ts:33-39`, `src/server/service.ts:57`, `bot-plugin/__init__.py:15`, `:17`, `:106`, `:203`, `:245`, `tests/test_bot_bridge.py:24`, `:47`, `DEPLOY-003-team-access.md:103-104`.
- Brief `:117` dự kiến hai migration; kế hoạch dùng ba (016 intake, 017 outbox, 018 phiếu đổi quyền) vì phiếu đổi quyền chạm schema `identity`, tách để lùi riêng được.

## Global Constraints

Mọi task mặc nhiên phải thoả các dòng dưới.

**Quyền và danh tính**
- Không nhận actor/tenant/dự án/vai từ JSON của request (`AGENTS.md:13`): mọi schema zod `.strict()`; khoá lạ (`tenantId`, `projectId`, `actorId`, `role`…) → 422. Chat/topic/người gửi lấy từ ngữ cảnh gateway đã ký; quyền nhóm lấy từ `chatScopes` (cấu hình vận hành). Tenant lấy từ `LIBETECH_TENANT_ID`.
- **`project_channels` không cấp quyền gì ở lát này** (hai chứng minh OQ-09 chưa đạt): không đọc bảng đó để quyết định nhận tin; không expand, không migrate. Có test khẳng định (Task 4).
- Bot principal giữ chỉ đọc (OQ-08 b). Principal tiếp nhận/giao là principal riêng: khoá HMAC riêng, allowlist chat riêng, role DB riêng `libetech_intake`, login riêng `libetech_intake_svc`. **Không cấp role nào cho `libetech_web`** (tiền lệ OQ-22). Không principal máy nào tạo/gán/đóng việc, duyệt, nghiệm thu, cấp quyền; điều này được chặn ở quyền bảng, không chỉ ở mã.
- Tuyến ký riêng nằm dưới `/api/bridge/…` (OQ-10 b), chuỗi ký chứa **đúng đường dẫn của tuyến**: `${timestamp}\n${nonce}\nPOST\n${path}\n${raw}`; cửa sổ thời gian 60 giây; nonce một lần qua `identity.bridge_nonces` bằng `INSERT … ON CONFLICT DO NOTHING`.
- Lỗi không chứa tên, tiêu đề hay số đếm ngoài quyền; «không tồn tại» và «ngoài phạm vi» trả cùng một câu. Không ghi nội dung tin, mã chat hay tên người vào log.

**Ghi**
- Mỗi lần ghi nằm trong một transaction (`scoped()` cho người, `intakeScoped()` cho principal tiếp nhận, `identity.scope()` cho danh tính); sửa bản ghi có `version` phải kèm `expectedVersion`; sự kiện audit bất biến cùng transaction; ghi thất bại không để lại audit, outbox hay đổi version.
- Idempotency: UNIQUE ở DB + `INSERT … ON CONFLICT DO NOTHING`, cấm SELECT-rồi-INSERT (E-BE-08). Khoá khử trùng SourceEvent: `UNIQUE(tenant_id,source_type,chat_id,message_id)`. Thao tác của PM đi qua `deduplicate` (`src/server/service.ts:57-70`) với dấu vân tay = tên thao tác + mã đối tượng + `expectedVersion` + nội dung đã parse.
- Outbox ghi **cùng transaction** với thay đổi nghiệp vụ (E-INT-06); cấm commit rồi mới ghi outbox. Envelope E-INT-02: `event_id`, `event_type`, `version`, `source`, `tenant_id`, `trace_id`, `correlation_id`, `causation_id`, `timestamp`, `payload`.
- Năm trạng thái tách riêng: received (gateway thấy tin, `observed_at`) · persisted (`ingested_at`) · projected (lát này luôn rỗng, hiện «Chưa chiếu») · delivered (`delivered_at`, chỉ đặt từ biên nhận của gateway) · recipient-acknowledged (`acknowledged_at`). Không chỗ nào hiện «đã gửi» khi mới ghi DB.
- Timeout sau gửi → `uncertain`, **đối soát trước khi gửi lại**; lỗi quyền → `dead` ngay, không thử lại; lỗi mạng thử lại có backoff và trần lượt. Không hứa exactly-once.
- Chuyển trạng thái (ứng viên, outbox) qua hàm chuyển trạng thái, không UPDATE trạng thái tự do (E-INT-05).

**Dữ liệu**
- Bốn trường nguồn E-EXT-01 trên `source_events` và `delivery_receipts`: `source_id`, `source_type`, `ingested_at`, `quality_score` (số nguyên 0–100).
- Tệp chỉ đi locator + hash + loại + kích thước (OQ-10 c); không cột bytes/nội dung tệp; hash của gateway luôn ở mức `gateway_declared`, không hiện như đã kiểm; lưu tệp lỗi → không có biên nhận thành công.
- IBS HI chỉ con trỏ/hash/metadata Tech. Báo cáo, danh sách, xuất không cộng gộp Liberico BU · Xeca · IBS HI: mọi danh sách bắt buộc `projectId`. Mã, migration, seed, fixture không chứa dòng ánh xạ dự án → miền nào cho dự án thật.
- Repo đang **công khai tạm thời**: không bí mật, không `data/`, không build output; không mã nhóm Telegram thật; chat id trong test là tổng hợp kiểu `-1000000000001`. Không chép gì từ plugin priority1.
- AI OS không đọc DB của plugin priority1 (AR-01); mã ticket chỉ là tham chiếu ngoài dạng chữ; AI OS không có cột trạng thái ticket.
- Phân loại intake do người chọn; không gọi mô hình.

**Migration**
- Số 016, 017, 018; tệp trực tiếp trong `migrations/`; bọc `BEGIN; … COMMIT;`; `CREATE … IF NOT EXISTS`; policy/trigger theo cặp `DROP … IF EXISTS` rồi `CREATE`; dòng cuối `INSERT INTO schema_migrations(version) VALUES('01x') ON CONFLICT(version) DO NOTHING;`. Chạy hai lần liên tiếp không lỗi.
- Mỗi bảng: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at`/`updated_at timestamptz NOT NULL DEFAULT now()`, `tenant_id uuid NOT NULL`, `project_id uuid NOT NULL` với `FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id)`. **Ngoại lệ có lý do:** `outbox_messages.project_id` và `delivery_receipts.project_id` được rỗng cho dòng DM duyệt tài khoản (phiếu thuộc tenant, không thuộc dự án nào). Index cho mọi FK và `created_at` cùng tệp. Không `SERIAL`, không `timestamp` thiếu múi giờ, không cột tiền.
- RLS `ENABLE` + `FORCE`; policy có cả `USING` và `WITH CHECK` (mẫu `migrations/011_team_source_catalog.sql:31-38`), viết riêng theo role (`TO libetech_intake`, `TO libetech_runtime`, `TO libetech_identity`); thiếu ngữ cảnh → không dòng nào. Bảng lịch sử gắn trigger `reject_history_mutation()` (`migrations/001_foundation.sql:90-95`).
- Rollback (OQ-20): tệp cùng tên ở `migrations/rollback/`; không `CASCADE`; từ chối chạy sai thứ tự (018 → 017 → 016); không xoá role (role là đối tượng toàn cụm, cụm thử có nhiều DB dùng chung); chỉ chạy qua test trên bản sao.
- Quy tắc nghiệp vụ ở tầng ứng dụng; `CHECK` chỉ cho toàn vẹn và tập nhãn đóng.

**Hạ tầng test**
- Dùng lại `tests/slice1-db.ts` (PGlite + PostgreSQL thật). Container `libetech-slice1-pg` (`127.0.0.1:55471`, dữ liệu tổng hợp) do phiên điều phối bật/tắt. Biến `SLICE1_TEST_DATABASE_URL`, `SLICE1_WEB_DATABASE_URL`, `SLICE1_ADMIN_DATABASE_URL` nằm trong `$SLICE2_ENV_FILE` ngoài repo; không ghi giá trị vào repo/log.
- Ca đồng thời và ca outbox «chết giữa chừng» chạy native: `describe.skipIf(!native)`; biên nhận phải kèm output native.
- Không gửi tin thật, không gọi d1-ai1, không cài/cài lại plugin vào gateway, không khởi động lại gateway, không đổi privacy mode, không đọc lịch sử chat cũ, không nhập Jira, không ghi Sheet, không sửa plugin priority1, không sửa `AGENTS.md`/`CLAUDE.md`.

**Trần kích thước — đề xuất kỹ thuật, CHƯA là chính sách, reviewer kiểm (OQ-10)**

| Trần | Giá trị đề xuất | Lý do |
|---|---|---|
| Thân `POST /api/bridge/intake/events` | 16 384 byte | Tin Telegram tối đa 4 096 đơn vị UTF-16, mỗi đơn vị ≤ 3 byte UTF-8 ⇒ ≤ 12 288 byte chữ; còn ~4 KB cho ngữ cảnh và metadata tệp. Bằng trần thân yêu cầu web đang dùng (`src/server/http.ts:17`). Tin vượt trần (nhiều ký tự phải escape): gateway cắt chữ, đặt `textTruncated=true`, hash vẫn tính trên bản đủ |
| Thân `outbox/pull` | 1 024 byte | Chỉ chứa `limit` |
| Thân `outbox/receipts` | 4 096 byte | Bằng trần cầu nối hiện có (`src/server/bridge.ts:20`); tối đa 10 biên nhận mỗi lần |
| Phản hồi `outbox/pull` | ≤ 10 tin, `payload` mỗi tin ≤ 2 048 byte | Plugin chỉ đọc tối đa 65 536 byte phản hồi (`bot-plugin/__init__.py:85-87`) |
| Tệp đính kèm | 20 971 520 byte (20 MiB) | Giới hạn tải tệp của Bot API đám mây: bot không tải được tệp lớn hơn, nên gateway không thể giữ bytes. Đây là trần kỹ thuật của kênh, **không** lấy từ con số của gói 0.1; reviewer có thể hạ |
| Loại tệp nhận | `image/jpeg`, `image/png`, `image/webp`, `application/pdf`, `text/plain`, `text/csv`, và ba loại OOXML không macro (`…wordprocessingml.document`, `…spreadsheetml.sheet`, `…presentationml.presentation`) | `SPEC-009…:149` «không chạy macro/script», `:184` «ảnh/tệp». Không nhận: định dạng có macro (`.docm`, `.xlsm`, `.doc`, `.xls`), nén, thực thi, HTML/SVG, âm thanh/video/sticker. Tệp ngoài danh sách hoặc quá trần chỉ lưu metadata, trạng thái `unsupported_type`/`too_large`, không có biên nhận thành công cho tệp |

**Hằng số outbox (đề xuất kỹ thuật):** lease 60 giây; backoff `min(30·2^(n−1), 900)` giây; tối đa 6 lượt; quá hạn cảnh báo 10 phút (`SPEC-009…:193`).

## Review Focus

1. **Tin chỉ có tệp, không có chữ; tên tệp có `../`, ký tự điều khiển hoặc dài 300 ký tự** — chờ: vẫn lưu được, tên tệp được làm sạch và cắt, không lỗi 500. Ca ở Task 4.
2. **Tin chứa chuỗi giống khoá/mật khẩu** (`token: …`, `password=…`) — chờ: bản trích lưu đã che phần bí mật, `content_hash` vẫn là của bản gốc do gateway tính. Ca ở Task 4.
3. **Bản sửa tới trước tin gốc, hoặc hai bản sửa tới ngược thứ tự** — chờ: không mất bản nào; «bản mới nhất» xếp theo `edited_at`, không theo thứ tự tới. Ca ở Task 4.
4. **Nhóm bị chuyển sang dự án khác trong `chatScopes` rồi gateway phát lại tin cũ** — chờ: lỗi 409 rõ nghĩa, không 500, không lộ dự án cũ, không sinh dòng thứ hai. Ca ở Task 4.
5. **Gateway báo biên nhận bằng lease đã hết hạn hoặc báo hai kết quả khác nhau cho cùng một lượt gửi** — chờ: từ chối rõ, trạng thái `delivered` không bị lật, không gửi lại khi chưa đối soát. Ca ở Task 6.

## Bản đồ tệp

| Tệp | Trách nhiệm | Task |
|---|---|---|
| `tests/slice2-fixtures.ts` | Chat tổng hợp, principal tiếp nhận, hàm ký, dựng sự kiện mẫu | 1 |
| `tests/rls-catalog.test.ts`, `tests/migrations-rollback.test.ts` | Mở rộng cho 016–018 | 1, 2, 5, 9 |
| `migrations/016_intake_inbox.sql` (+ `rollback/`) | Role tiếp nhận; `source_events`, `source_event_revisions`, `intake_attachments`, `intake_candidates`, `intake_events` | 2 |
| `src/server/bridge-auth.ts`, `src/server/bridge-config.ts` | Kiểm chữ ký dùng chung; đọc cấu hình cầu nối có khối `intake` | 3 |
| `src/server/bridge-io.ts`, `src/app/api/bridge/[...path]/route.ts` | Handler mỏng cho tuyến ký riêng | 3, 4, 6 |
| `src/server/intake.ts` | `IntakeService`: nhận sự kiện, revision, tệp, ứng viên; thao tác của PM | 4, 7 |
| `src/server/intake-rules.ts` | Hàm thuần: khoá sự kiện, thread, điểm chất lượng, che bí mật, luật tệp, chuyển trạng thái ứng viên | 4, 7 |
| `migrations/017_outbox.sql` (+ `rollback/`) | `outbox_messages`, `delivery_receipts` | 5 |
| `src/server/outbox.ts` | `OutboxService`: ghi cùng transaction, lease, biên nhận, đối soát, hàng lỗi | 6 |
| `src/server/ledger-reconcile.ts` | Đối soát inbox ↔ sổ ticket (hàm thuần + đọc inbox) | 8 |
| `migrations/018_access_change_approval.sql` (+ `rollback/`) | Mở rộng phiếu duyệt cho đổi quyền | 9 |
| `src/server/accounts.ts`, `src/server/account-approval.ts` | DM khi có phiếu; phiếu đổi quyền | 9 |
| `src/server/inbox-http.ts`, `src/app/api/inbox/[[...path]]/route.ts` | Handler web cho Inbox | 10 |
| `bot-plugin/__init__.py`, `bot-plugin/plugin.yaml`, `tests/test_bot_bridge.py` | Thu tin, hàng chờ cục bộ, tệp, kéo outbox, thẻ phiếu đổi quyền | 11 |
| `src/app/inbox/{page,loading,error}.tsx`, `src/components/inbox.tsx`, `src/components/inbox-view.ts`, `docs/UI-HANDOFF-2-inbox.md` | Màn Inbox | 12 |
| `src/components/team-accounts.tsx`, `src/components/approvals.tsx` | Trình và bỏ phiếu đổi quyền | 12 |
| `src/server/types.ts`, `vitest.config.ts` | Thêm kiểu mới, thêm tệp vào coverage; không đổi kiểu cũ | 4, 6, 13 |

**Review riêng từng task:** chỉ Task 2, 3, 4, 5, 6, 9, 11 (migration, quyền, cầu nối). Task 1, 7, 8, 10, 12, 13 để tầng 1 toàn nhánh kiểm.

---

### Task 1: Fixture lát 2 và mở rộng hai test hạ tầng — không review riêng

**Tệp:** tạo `tests/slice2-fixtures.ts`; sửa `tests/rls-catalog.test.ts:12` (bỏ chặn trên `<=15`, đổi tên ca thành «migrations from 013 …»), `tests/slice1-db.ts` (chỉ nếu ca dưới chứng minh `reset()` chưa dọn hết).

**Giao diện tạo ra**
```ts
// tests/slice2-fixtures.ts
export const chatSales='-1000000000001';      // chatScopes → [ids.sales]
export const chatTransport='-1000000000002';  // chatScopes → [ids.transport]
export const chatMulti='-1000000000003';      // chatScopes → [ids.sales, sameBuProject]  (OQ-27)
export const chatUnknown='-1000000000009';    // không có trong chatScopes
export const chatNotIntake='-1000000000004';  // có trong chatScopes, không có trong intake.chats
export const botKey:string; export const intakeKey:string;   // sinh ngẫu nhiên lúc nạp module, ≥ 43 ký tự, khác nhau
export const intakePrincipalId='22000000-0000-4000-8000-000000000001';
export const bridgeConfig:BridgeConfig;       // {key:botKey, chatScopes, intake:{key:intakeKey, principalId, chats:[chatSales,chatTransport,chatMulti]}}  — không khai `excerptChats` (sửa 14/11/2026: mặc định không nhóm nào lưu trích; ca cần lưu trích tự dựng cấu hình có cờ)
export function signedRequest(path:string,body:unknown,opts?:{key?:string;timestamp?:string;nonce?:string;signPath?:string}):Request;
export function messageEvent(over?:Partial<IntakeEventInput>):IntakeEventInput; // tin thường ở chatSales, messageId tăng dần, contentHash tính từ text
```
`BridgeConfig` và `IntakeEventInput` là kiểu của Task 3 và 4; ở Task 1 khai tạm bằng `type … = any` có chú thích `// thay ở Task 3/4`, hai task đó thay bằng import thật.

**Ca kiểm viết trước**
- [ ] `tests/slice1-harness.test.ts`, thêm **`reset leaves no row in any table created from 016`** — vòng lặp trên bảng `CREATE TABLE IF NOT EXISTS` của các tệp số ≥ 16; hiện chưa có tệp nào nên ca xanh rỗng, tự siết khi Task 2, 5 thêm bảng. Native.
- [ ] `tests/rls-catalog.test.ts` sau khi bỏ chặn trên vẫn xanh với 013–015.

**Lệnh kiểm:** `npx vitest run tests/slice1-harness.test.ts tests/rls-catalog.test.ts tests/migrations-rollback.test.ts`, lặp lại với `set -a; . "$SLICE2_ENV_FILE"; set +a`.

### Task 2: Migration 016 — role tiếp nhận, inbox, ứng viên (+ tệp lùi) — **review riêng**

**Tệp:** tạo `migrations/016_intake_inbox.sql`, `migrations/rollback/016_intake_inbox.sql`, `tests/intake-schema.test.ts`.

**Role** (mẫu `migrations/003_runtime_roles.sql`): `libetech_intake NOLOGIN NOSUPERUSER NOBYPASSRLS`; `libetech_intake_svc LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`; `GRANT libetech_intake TO libetech_intake_svc`. Không đặt mật khẩu (vận hành cấp khi triển khai). Không `GRANT libetech_intake TO libetech_web`.

**Bảng** (cột chung theo Global Constraints)

| Bảng | Cột riêng | Ràng buộc |
|---|---|---|
| `source_events` (bất biến) | `source_id text NOT NULL`, `source_type text NOT NULL CHECK(source_type='telegram_gateway')`, `ingested_at timestamptz NOT NULL DEFAULT now()`, `quality_score smallint NOT NULL CHECK(quality_score BETWEEN 0 AND 100)`, `chat_id text NOT NULL CHECK(chat_id ~ '^-[1-9][0-9]*$')`, `topic_id text NOT NULL DEFAULT ''`, `message_id text NOT NULL CHECK(message_id ~ '^[1-9][0-9]*$')`, `reply_to_message_id text`, `media_group_id text`, `thread_key text NOT NULL`, `source_actor text NOT NULL`, `source_actor_label text NOT NULL DEFAULT ''`, `observed_at timestamptz NOT NULL`, `locator text NOT NULL DEFAULT ''`, `forwarded boolean NOT NULL`, `addressed boolean NOT NULL`, `spooled boolean NOT NULL DEFAULT false`, `content_mode text NOT NULL CHECK(content_mode IN ('excerpt','pointer_only'))`, `trace_id uuid NOT NULL`, `correlation_id uuid NOT NULL` | `UNIQUE(tenant_id,source_type,chat_id,message_id)`, `UNIQUE(id,tenant_id,project_id)` *(Sửa 14/11/2026, OQ-30 (b): bỏ cột `content_mode` ở bảng này; chế độ nằm ở từng bản sửa.)* |
| `source_event_revisions` (bất biến) | `source_event_id uuid NOT NULL`, `revision_no integer NOT NULL CHECK(revision_no>0)`, `revision_key text NOT NULL CHECK(revision_key ~ '^[a-f0-9]{64}$')`, `edited_at timestamptz`, `content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$')`, `text_excerpt text CHECK(text_excerpt IS NULL OR length(text_excerpt)<=4096)`, `text_truncated boolean NOT NULL DEFAULT false` | FK `(source_event_id,tenant_id,project_id)`; `UNIQUE(source_event_id,revision_key)`, `UNIQUE(source_event_id,revision_no)`, `UNIQUE(id,tenant_id,project_id)` *(Sửa 14/11/2026, OQ-30 (b): thêm `content_mode text NOT NULL CHECK(content_mode IN ('excerpt','pointer_only'))` và `CHECK(content_mode='excerpt' OR text_excerpt IS NULL)`.)* |
| `intake_attachments` (bất biến) | `source_event_id`, `revision_id uuid NOT NULL`, `state text NOT NULL CHECK(state IN ('stored','failed','too_large','unsupported_type'))`, `locator text`, `sha256 text CHECK(sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$')`, `hash_verification text NOT NULL DEFAULT 'gateway_declared' CHECK(hash_verification IN ('gateway_declared','verified'))`, `mime_type text NOT NULL DEFAULT ''`, `size_bytes bigint`, `file_name text NOT NULL DEFAULT ''`, `reason_code text` | FK tới event và revision theo phạm vi; `UNIQUE(revision_id)`; `CHECK(state<>'stored' OR (locator IS NOT NULL AND sha256 IS NOT NULL AND size_bytes BETWEEN 1 AND 20971520))`; `CHECK(state='stored' OR locator IS NULL)` |
| `intake_candidates` | `chat_id text NOT NULL`, `thread_key text NOT NULL`, `root_source_event_id uuid NOT NULL`, `state text NOT NULL DEFAULT 'new' CHECK(state IN ('new','needs_info','confirmed','duplicate','dismissed'))`, `classification text CHECK(classification IS NULL OR classification IN ('incident','request','document'))`, `duplicate_of uuid`, `missing_fields jsonb NOT NULL DEFAULT '[]'`, `note text NOT NULL DEFAULT ''`, `ticket_ref text`, `decided_by uuid`, `version integer NOT NULL DEFAULT 1 CHECK(version>0)` | FK gốc theo phạm vi; `UNIQUE(tenant_id,project_id,chat_id,thread_key)`; `UNIQUE(id,tenant_id,project_id)`; FK `(duplicate_of,tenant_id,project_id)` tự tham chiếu; trigger chặn DELETE |
| `intake_events` (bất biến) | `entity_type text NOT NULL CHECK(entity_type IN ('source_event','intake_candidate','outbox_message'))`, `entity_id uuid NOT NULL`, `actor_id uuid NOT NULL`, `actor_kind text NOT NULL CHECK(actor_kind IN ('user','intake_service'))`, `kind text NOT NULL`, `request_id uuid NOT NULL`, `trace_id uuid NOT NULL`, `payload jsonb NOT NULL` | — |

- Index: mỗi bảng `(tenant_id,project_id,created_at DESC)`; mọi cột FK; `intake_candidates(tenant_id,project_id,state,created_at DESC)`; `intake_events(entity_type,entity_id,created_at)`; `source_events(tenant_id,chat_id,thread_key)`.
- Policy (điều kiện phạm vi = tenant + `project_id = ANY(app.project_ids)`):
  - `TO libetech_intake`: `SELECT` + `INSERT` trên cả năm bảng. `intake_candidates` INSERT thêm cổng `state='new' AND classification IS NULL AND decided_by IS NULL AND duplicate_of IS NULL AND ticket_ref IS NULL`. `intake_attachments` INSERT thêm `hash_verification='gateway_declared'`. `intake_events` INSERT thêm `actor_kind='intake_service'`.
  - `TO libetech_runtime`: `SELECT` cả năm bảng; `UPDATE` trên `intake_candidates` (cả `USING` và `WITH CHECK` phạm vi); `INSERT` trên `intake_events` với `actor_kind='user'`.
- Quyền bảng: `libetech_intake` — `USAGE` schema `public`; `SELECT, INSERT` năm bảng mới; `SELECT(id,tenant_id)` trên `projects`; `SELECT` trên `project_domain_mappings` (đọc nhãn miền để chọn `content_mode`); **không quyền nào** trên `work_items`, `evidence`, `audit_events`, `commands`, `document_*`, `project_profiles`, `project_channels`, schema `identity`, schema `analytics`. `libetech_runtime` — `SELECT` năm bảng; `UPDATE(state,classification,duplicate_of,missing_fields,note,ticket_ref,decided_by,version,updated_at)` trên `intake_candidates`; `INSERT` trên `intake_events`. Không cấp INSERT `source_events`/`source_event_revisions`/`intake_attachments`/`intake_candidates` cho runtime.
- `intake_events` có `request_id` và `trace_id` (E-DB-13) — bảng mới không lặp tồn đọng của `registry_events`.
- Không câu `INSERT` dữ liệu nào ngoài dòng `schema_migrations`.

**Tệp lùi 016:** từ chối nếu `to_regclass('public.outbox_messages') IS NOT NULL` («Roll back 017 before 016»); `DROP TABLE IF EXISTS intake_events, intake_candidates, intake_attachments, source_event_revisions, source_events;` `REVOKE SELECT ON project_domain_mappings FROM libetech_intake; REVOKE SELECT(id,tenant_id) ON projects FROM libetech_intake;` (bọc trong khối kiểm role tồn tại); xoá dòng `'016'`. Không `DROP ROLE`.

**Ca kiểm viết trước** (`tests/intake-schema.test.ts`, cả hai động cơ trừ khi ghi native)
- [ ] `migrations-rollback` hai ca sẵn có tự phủ 016 (vòng lặp theo tệp) — chạy thấy đỏ trước khi có tệp lùi.
- [ ] **`intake tables return nothing without RLS context`** — `SET LOCAL ROLE libetech_intake` rồi `libetech_runtime`, không đặt ngữ cảnh, `SELECT *` năm bảng → 0 dòng (dữ liệu chèn trước bằng `h.operator`).
- [ ] **`intake role cannot touch work, documents, registry or identity`** — dưới `libetech_intake` có ngữ cảnh đúng: `INSERT INTO work_items…`, `UPDATE work_items…`, `INSERT INTO audit_events…`, `INSERT INTO document_records…`, `SELECT * FROM identity.users`, `SELECT * FROM project_channels` đều ném `permission denied`.
- [ ] **`intake role cannot write another project or tenant`** — ngữ cảnh `[ids.sales]`, chèn `source_events` với `project_id=ids.transport` → ném; tenant khác → ném.
- [ ] **`intake role cannot create a decided candidate`** — chèn `intake_candidates` với `state='confirmed'` hoặc `classification='incident'` hoặc `ticket_ref` khác rỗng → ném.
- [ ] **`runtime cannot insert source events, revisions, attachments or candidates`** — `scoped(h.db,pm,…)` bốn câu INSERT đều ném.
- [ ] **`history tables reject update and delete; candidates reject delete`** — `h.operator` UPDATE/DELETE trên `source_events`, `source_event_revisions`, `intake_attachments`, `intake_events` → `Append-only history`; DELETE `intake_candidates` → ném.
- [ ] **`no intake table has a bytes or file content column`** — `information_schema.columns` của năm bảng: không cột kiểu `bytea`, không tên `content`, `body`, `bytes`, `data`.
- [ ] **`a stored attachment needs locator, hash and a size within 20 MiB`** — `state='stored'` thiếu `sha256` → ném; `size_bytes=20971521` → ném; `state='failed'` kèm `locator` → ném.
- [ ] `describe.skipIf(!native)`: **`web login cannot assume the intake role; intake login is unprivileged`** — qua `h.db`: `SET ROLE libetech_intake` ném; `pg_roles` của `libetech_intake_svc`: `rolsuper=false`, `rolbypassrls=false`, `rolinherit=false`, chỉ là thành viên của `libetech_intake`.
- [ ] `tests/rls-catalog.test.ts` xanh với năm bảng mới.

**Lệnh kiểm:** `npx vitest run tests/intake-schema.test.ts tests/migrations-rollback.test.ts tests/rls-catalog.test.ts tests/slice1-harness.test.ts`, rồi lặp lại native.

**Con trỏ:** brief `:98`, `:106`, `:117` · ADR-002 «SourceEvent/inbox…», «Principal máy» · `SPEC-009…:135`, `:87`, `:149` · OQ-08, OQ-10, OQ-20.

### Task 3: Chữ ký dùng chung, cấu hình có khối `intake`, tuyến ký riêng — **review riêng**

**Tệp:** tạo `src/server/bridge-auth.ts`, `src/server/bridge-config.ts`, `src/server/bridge-io.ts`, `src/app/api/bridge/[...path]/route.ts`, `tests/bridge-io.test.ts`; sửa `src/server/bridge.ts:17-28` (gọi hàm dùng chung, hành vi không đổi), `src/app/api/bridge/route.ts:10-13` (đọc cấu hình qua `loadBridgeConfig`).

**Giao diện tạo ra**
```ts
// src/server/bridge-auth.ts
export const signingText=(timestamp:string,nonce:string,raw:string,path='/api/bridge')=>string;
export async function verifySigned(request:Request,o:{key:string;path:string;maxBytes:number;identity:IdentityService;throttleBucket:string;throttleLimit:number}):Promise<string>; // trả raw đã xác thực
// src/server/bridge-config.ts
export type BridgeConfig={key:string;chatScopes:ChatScopes;intake?:{key:string;principalId:string;chats:string[];excerptChats?:string[]}};
export function parseBridgeConfig(raw:unknown):BridgeConfig;       // strict; intake.key ≥ 43 ký tự và !== key; intake.chats ⊆ khoá của chatScopes; intake.excerptChats ⊆ intake.chats (OQ-28 (c), sửa 14/11/2026)
export async function loadBridgeConfig():Promise<BridgeConfig|null>; // đọc tệp LIBETECH_BRIDGE_CONFIG; null khi biến rỗng
// src/server/bridge-io.ts
export type IntakePrincipal={id:string;tenantId:string;projectIds:string[]};
export type IoDeps={intakeDb:Database;identity:IdentityService;config:BridgeConfig;tenantId:string};
export const IO_PATHS=['/api/bridge/intake/events','/api/bridge/outbox/pull','/api/bridge/outbox/receipts'] as const;
export async function handleBridgeIo(request:Request,parts:string[],deps:IoDeps):Promise<unknown>;
export async function intakeScoped<T>(db:Database,p:IntakePrincipal,fn:(tx:Queryable)=>Promise<T>):Promise<T>; // SET LOCAL ROLE libetech_intake + set_config như scoped()
```
- `verifySigned`: thứ tự như `handleBridge` hiện có — khoá ≥ 43 (`BRIDGE_UNCONFIGURED` 503) → trần byte (`PAYLOAD_TOO_LARGE` 413) → định dạng header + cửa sổ 60 giây + HMAC `timingSafeEqual` (`BRIDGE_AUTH_DENIED` 401) → nonce `ON CONFLICT DO NOTHING` (`BRIDGE_REPLAY` 409) → `identity.throttle`. `src/server/bridge.ts` tái xuất `signingText` để `tests/identity.test.ts` không phải sửa.
- `handleBridgeIo`: đường dẫn ngoài `IO_PATHS` → `NOT_FOUND` 404 **trước** khi đọc thân; `config.intake` vắng → `INTAKE_UNCONFIGURED` 503; ký bằng `config.intake.key` với đúng `path` của tuyến; trần byte theo bảng Global Constraints; ở Task 3 ba tuyến trả `NOT_IMPLEMENTED` 501 sau khi xác thực (Task 4, 6 thay).
- Route: `export const runtime='nodejs'`; `intakeDb` lấy từ `INTAKE_DATABASE_URL` qua `pooledDatabase(url,true)` giữ trong `globalThis` (mẫu `src/server/identity.ts:216-220`); thiếu biến → `INTAKE_UNCONFIGURED` 503; `LIBETECH_DEMO==='1'` → 503.

**Ca kiểm viết trước** (`tests/bridge-io.test.ts`)
- [ ] **`(1) wrong key, stale timestamp and a reused nonce are rejected on every intake route`** — với từng đường trong `IO_PATHS`: ký bằng khoá ngẫu nhiên → `BRIDGE_AUTH_DENIED`; `timestamp=Date.now()-120000` → `BRIDGE_AUTH_DENIED`; cùng `nonce` hai lần → lần hai `BRIDGE_REPLAY`.
- [ ] **`a signature made for another path is rejected`** — ký với `signPath:'/api/bridge'` gửi tới `/api/bridge/intake/events` → `BRIDGE_AUTH_DENIED`; ký cho `/api/bridge/outbox/pull` gửi tới `/api/bridge/outbox/receipts` → `BRIDGE_AUTH_DENIED`.
- [ ] **`the bot key cannot sign intake routes and the intake key cannot sign /api/bridge`** — `signedRequest(path,body,{key:botKey})` → 401; `handleBridge` với yêu cầu ký bằng `intakeKey` → `BRIDGE_AUTH_DENIED`.
- [ ] **`(7) every intake endpoint lives under /api/bridge/ and answers 401 without a valid signature`** — mọi phần tử `IO_PATHS` bắt đầu bằng `/api/bridge/`; tệp `src/app/api/bridge/[...path]/route.ts` tồn tại và không có tệp `route.ts` nào khác trong `src/app/api` nhập `bridge-io`; yêu cầu không header chữ ký → 401; đường lạ `/api/bridge/intake/unknown` → 404 và không đọc thân. Chú thích trong test: proxy thật chặn `^~ /api/bridge/` là kiểm runtime (`DEPLOY-003-team-access.md:103-104`).
- [ ] **`config rejects an intake key equal to the bot key and intake chats outside chatScopes`** — `parseBridgeConfig` ném cho hai trường hợp; cấu hình cũ không có `intake` vẫn hợp lệ.
- [ ] (sửa 14/11/2026, OQ-28 (c)) **`config rejects excerpt chats outside intake.chats; no excerptChats means none`** — `excerptChats` có nhóm không thuộc `intake.chats` → ném (tuyến trả 503 như cấu hình hỏng); thiếu `excerptChats` → hợp lệ, không nhóm nào được lưu trích.
- [ ] **`oversized bodies are refused before parsing`** — thân 16 385 byte tới `intake/events` → `PAYLOAD_TOO_LARGE`; 4 097 byte tới `outbox/receipts` → `PAYLOAD_TOO_LARGE`.
- [ ] `tests/identity.test.ts` giữ xanh nguyên văn (ca `:71`, `:114`).

**Lệnh kiểm:** `npx vitest run tests/bridge-io.test.ts tests/identity.test.ts`; native lặp lại.

**Con trỏ:** brief `:109-110`, `:137` (1)(7) · OQ-10 (b) · `SPEC-009…:143`, `:145` · `SPEC-008…:116`.

### Task 4: `IntakeService.ingest` — SourceEvent, revision, tệp, ứng viên — **review riêng** · OQ-27 và OQ-28 đã quyết 14/11/2026 (xem `docs/OPEN-QUESTIONS.md`)

**Tệp:** tạo `src/server/intake.ts`, `src/server/intake-rules.ts`, `tests/intake.test.ts`, `tests/intake-concurrency.test.ts`; sửa `src/server/bridge-io.ts` (nối tuyến `intake/events`), `src/server/types.ts` (thêm kiểu), `tests/slice2-fixtures.ts` (thay kiểu tạm).

**Giao diện tạo ra**
```ts
// src/server/intake-rules.ts — hàm thuần, không I/O
export const eventKey=(chatId:string,messageId:string)=>`telegram:${chatId}:${messageId}`;   // khoá sự kiện chung với sổ ticket (không gồm topic)
export function threadKey(i:{messageId:string;mediaGroupId?:string;parentThreadKey?:string}):string; // 'g:<mediaGroupId>' | parentThreadKey | 'm:<messageId>'
export function qualityScore(i:{forwarded:boolean;textTruncated:boolean;attachmentState?:AttachmentState}):number; // 100; −40 forward; −20 cắt chữ; −20 tệp không ở 'stored'; sàn 0
export function redactSecrets(text:string):string;      // thay giá trị sau token|secret|password|passwd|api[_-]?key|bearer (kèm : hoặc = hoặc khoảng trắng) bằng '[đã che]'
export function cleanFileName(name:string):string;      // bỏ phần thư mục, ký tự điều khiển; cắt 200 ký tự
export const ALLOWED_MIME:ReadonlySet<string>; export const MAX_ATTACHMENT_BYTES=20971520;
export function attachmentVerdict(a:{mimeType:string;sizeBytes:number}):'stored'|'too_large'|'unsupported_type';
// src/server/intake.ts
export const intakeEventSchema: z.ZodType<IntakeEventInput>;  // strict
export type IntakeEventInput={context:{telegramId:string;chatId:string;chatType:'group'|'supergroup';profile:'libetech';messageId:string;topicId?:string;replyToMessageId?:string;mediaGroupId?:string};
  observedAt:string;editedAt?:string;addressed:boolean;spooled:boolean;forwarded:boolean;actorLabel?:string;
  text:string;textTruncated:boolean;contentHash:string;traceId:string;
  attachment?:{state:'stored';locator:string;sha256:string;mimeType:string;sizeBytes:number;fileName?:string}|{state:'failed';reasonCode:string;mimeType?:string;sizeBytes?:number;fileName?:string}};
export type IntakeAck={sourceEventId:string;revisionNo:number;candidateRef:string|null;replayed:boolean;persisted:true;receipt:'queued'|'withheld'|'none';reason?:string};
export class IntakeService{constructor(db:Database,tenantId:string,principalId:string,chatScopes:ChatScopes,intake:{chats:string[];excerptChats?:string[]});  // sửa 14/11/2026: nhận cả cờ lưu trích theo nhóm
  ingest(raw:unknown):Promise<IntakeAck>;}
```
- Kiểm quyền (trước mọi câu SQL có nội dung): `chatType` nhóm và `chatId` bắt đầu bằng `-`; `chatId ∈ intakeChats` **và** `chatScopes[chatId]` có đúng **một** dự án. Không thoả → `SCOPE_DENIED` 403, không lưu gì. `chatScopes[chatId]` có từ hai dự án → `INTAKE_PROJECT_AMBIGUOUS` 409, không lưu gì (**OQ-27**: quyết định của Chairman 14/11/2026, phương án (a) «Chỉ nhóm một dự án»).
- `locator` của tin: `https://t.me/c/<chatId bỏ tiền tố -100>/<messageId>` khi `chatId` bắt đầu bằng `-100`, ngược lại rỗng. `locator` của tệp phải khớp `^gw://libetech/attachments/[a-f0-9]{64}$` và đoạn cuối bằng `sha256` → lệch thì `ATTACHMENT_HASH_MISMATCH` 422.
- `content_mode` (sửa 14/11/2026 theo quyết định OQ-28 (c) «Khai theo từng nhóm»): `'excerpt'` (lưu `redactSecrets(text)`) khi và chỉ khi `chatId ∈ intake.excerptChats` của cấu hình vận hành **và** dòng mới nhất của `project_domain_mappings` cho dự án đó không phải `IBS_HI`. Mọi trường hợp khác → `'pointer_only'` (`text_excerpt` rỗng; chỉ hash, locator, metadata). Hai luật này là cách hiểu fail-closed của phiên điều phối, chờ Chairman xác nhận: nhóm không khai cờ chỉ giữ con trỏ; `IBS_HI` luôn chỉ giữ con trỏ (`AGENTS.md:16`). Cờ không bao giờ lấy từ request (schema strict). **Sửa 14/11/2026 theo quyết định OQ-30 (b) «Xét lại từng bản sửa»:** chế độ được tính ở mỗi lần ghi và lưu trên **dòng bản sửa đó** (`source_event_revisions.content_mode`), có thể nới hoặc siết giữa các bản sửa của cùng một tin; `source_events` không còn cột chế độ. Đọc: Inbox hiện chữ của một bản sửa chỉ khi bản đó ghi có chữ **và** cấu hình hiện tại vẫn cho phép («Ẩn ngay, thiết kế xoá sau»); siết lại thì ẩn, không xoá (S15). `LIBERICO_BU`, `XECA` hay chưa ánh xạ không còn quyết định gì. *(Bản trước: chọn theo nhãn miền `LIBERICO_BU`/`XECA`; bỏ theo quyết định.)*
- Một transaction `intakeScoped`: (a) `INSERT source_events … ON CONFLICT(tenant_id,source_type,chat_id,message_id) DO NOTHING RETURNING id`; không có dòng trả về → đọc lại theo khoá; đọc cũng không thấy (dòng thuộc dự án khác, RLS giấu) → `SOURCE_EVENT_CONFLICT` 409. (b) `SELECT pg_advisory_xact_lock(hashtextextended($sourceEventId,0))` rồi `INSERT source_event_revisions … ON CONFLICT(source_event_id,revision_key) DO NOTHING RETURNING id,revision_no` với `revision_no = coalesce(max,0)+1`, `revision_key = sha256(contentHash|editedAt|attachment.sha256)`; không có dòng trả về → `replayed=true`. (c) revision mới có tệp → `INSERT intake_attachments` với `state = attachmentVerdict(…)` khi gateway báo `stored`, hoặc `failed`; tệp không ở `stored` thì `locator`, `sha256` để rỗng. (d) `thread_key`: tra tin cha theo `(chat_id, reply_to_message_id)` lấy `thread_key` của cha. (e) `INSERT intake_candidates … ON CONFLICT(tenant_id,project_id,chat_id,thread_key) DO NOTHING RETURNING id`. (f) `intake_events` kind `source_event.persisted` / `source_event.revised` / `candidate.created`, `request_id` mới, `trace_id` của gateway. (g) gọi `enqueueReceipt` của Task 6 (ở Task 4 để một hàm rỗng `async()=>'none'` nhận qua tham số dựng `IntakeService`; Task 6 thay).
- `candidateRef = 'IN-' + 8 ký tự hex đầu của id, viết hoa`. `source_actor='tg:'+telegramId`. Tin forward: `forwarded=true`, không ghi ai là tác giả hay người duyệt; `quality_score` trừ 40.
- Trả `receipt:'withheld'`, `reason:'ATTACHMENT_NOT_STORED'` khi tệp không ở `stored`; `'none'` khi tin không `addressed` hoặc là bản phát lại/bản sửa.

**Ca kiểm viết trước** (`tests/intake.test.ts`, cả hai động cơ; `svc` dựng bằng `h.operator` vì `IntakeService` tự `SET LOCAL ROLE libetech_intake`)
- [ ] **`DOC-01 a message from an unmapped group is refused and nothing is stored`** — `chatUnknown`, `chatNotIntake`, và `chatSales` khi `chatScopes[chatSales]=[]` → `SCOPE_DENIED`; `count(*)` của năm bảng = 0. Tên test mang hậu tố «(mức mã; nhóm thật là kiểm runtime)».
- [ ] **`intake authority comes from chatScopes, never from project_channels`** — `h.operator` chèn thẳng một dòng `project_channels` `state='active'` cho `chatUnknown` → `ingest` vẫn `SCOPE_DENIED`; `chatSales` không có dòng `project_channels` nào → nhận.
- [ ] **`DOC-02 plain text, a reply, a file and a topic message all land in one inbox`** — bốn sự kiện ở `chatSales` (thường; `replyToMessageId` trỏ tin đầu; có `attachment` `stored` `application/pdf`; `topicId='7'`) → 4 `source_events` cùng `project_id=ids.sales`; tin trả lời dùng chung `thread_key` và không sinh ứng viên thứ hai; tổng 3 ứng viên.
- [ ] **`DOC-03 resending the same update keeps one record; an edit adds a revision; a forward is not an author`** — gửi lại nguyên sự kiện → `replayed=true`, 1 event, 1 revision; gửi `editedAt` + `contentHash` mới → `revisionNo=2`, vẫn 1 event, 1 ứng viên; sự kiện `forwarded=true` → `forwarded` lưu `true`, `quality_score=60`, ứng viên `decided_by` rỗng.
- [ ] **`an album keeps every part under one candidate`** — ba sự kiện cùng `mediaGroupId`, message id khác nhau → 3 event, 3 attachment, 1 ứng viên; một phần `failed` → `ingest` của phần đó trả `receipt:'withheld'`.
- [ ] **`DOC-04 a failed, oversized or unsupported file never yields a success receipt`** — `attachment.state='failed'`; `stored` với `sizeBytes=20971521`; `stored` với `mimeType='application/zip'` → cả ba: event được lưu, attachment mang `failed`/`too_large`/`unsupported_type`, `locator` rỗng, `receipt:'withheld'`.
- [ ] **`a locator whose hash segment differs from sha256 is rejected`** → `ATTACHMENT_HASH_MISMATCH`, không lưu gì.
- [ ] **`(2) a body that declares tenant, project, actor or role is rejected`** — thêm lần lượt `tenantId`, `projectId`, `actorId`, `role`, `context.projectId` → lỗi zod (422 ở handler), không lưu gì.
- [ ] **`(4) a resent message creates no second candidate`** — cùng sự kiện ba lần → 1 `intake_candidates`, 1 `candidate.created` trong `intake_events`.
- [ ] **`DOC-16 an edit or a reply never asks the reporter to re-enter the request`** — sau tin gốc + bản sửa + tin trả lời: một ứng viên, `candidateRef` không đổi qua ba lần gọi.
- [ ] **`OQ-27 a group mapped to several projects is refused with INTAKE_PROJECT_AMBIGUOUS and stores nothing`** — `chatMulti`.
- [ ] (sửa 14/11/2026, OQ-28 (c)) Thay ca «unmapped or IBS HI» bằng bốn ca, chỉ dùng mã nhóm tổng hợp: **`OQ-28 a flagged group with an unmapped project stores the excerpt`**; **`OQ-28 an unflagged group keeps pointer and hash only even for a XECA project`**; **`OQ-28 an IBS HI project keeps pointer and hash only even in a flagged group`**; **`OQ-28 a flag in the request body is never honoured`** (thân có `contentMode`/`excerpt` ở gốc hoặc trong `context` → bị schema từ chối, không lưu gì; nhóm không cờ vẫn chỉ con trỏ). Mỗi ca kiểm `content_mode`, `text_excerpt` và `content_hash`.
- [ ] Review Focus 1: **`a file-only message and hostile file names are stored safely`** — `text=''` + tệp; `fileName='../../etc/passwd'`, tên có `\u0000`, tên 300 ký tự → lưu được, `file_name` không chứa `/`, ký tự điều khiển, dài ≤ 200.
- [ ] Review Focus 2: **`credential-like text is stored redacted while the hash stays the gateway's`** — `text='token: abc123SECRET'` (nhóm có cờ lưu trích; sửa 14/11/2026) → `text_excerpt` không chứa `abc123SECRET`, `content_hash` bằng giá trị gửi vào.
- [ ] Review Focus 3: **`an edit that arrives before the original, and edits out of order, are all kept`** — gửi bản `editedAt=T2` trước, bản không `editedAt` sau, rồi `editedAt=T1` → 3 revision; hàm đọc «bản mới nhất» (Task 7) trả bản `T2`.
- [ ] Review Focus 4: **`replaying a message after its group moved to another project is SOURCE_EVENT_CONFLICT`** — lưu ở `ids.sales`, dựng `IntakeService` mới với `chatScopes[chatSales]=[ids.transport]`, gửi lại → `{code:'SOURCE_EVENT_CONFLICT',status:409}`, vẫn 1 event.
- [ ] **`a failed ingest leaves no row at all`** — ép lỗi ở bước ứng viên (mock `enqueueReceipt` ném) → 0 event, 0 revision, 0 `intake_events`.
- [ ] `tests/intake-concurrency.test.ts`, `describe.skipIf(!native)`: **`two identical requests in parallel store exactly one source event`** — `h.operator.transaction` giữ `LOCK TABLE source_events IN SHARE ROW EXCLUSIVE MODE`; khởi động `Promise.allSettled([svc.ingest(e),svc.ingest(e)])`; `waitForBlocked(h,2)`; nhả khoá. Mong đợi: cả hai `fulfilled`, cùng `sourceEventId`, đúng một `replayed:false`; `count(*) source_events=1`, `source_event_revisions=1`, `intake_candidates=1`.
- [ ] native: **`two different edits in parallel get revision numbers 2 and 3`** — không lượt nào lỗi trùng `revision_no`.

**Lệnh kiểm:** `npx vitest run tests/intake.test.ts tests/bridge-io.test.ts`; native: thêm `tests/intake-concurrency.test.ts`, lưu output.

**Con trỏ:** brief `:98-101`, `:103`, `:106`, `:121-128`, `:137` (2)(4) · `SPEC-009…:70`, `:84`, `:86-88`, `:149` · `SPEC-008…:73`, `:75`, `:296` · `AGENTS.md:16` · OQ-27, OQ-28.

### Task 5: Migration 017 — outbox và biên nhận giao (+ tệp lùi) — **review riêng**

**Tệp:** tạo `migrations/017_outbox.sql`, `migrations/rollback/017_outbox.sql`, `tests/outbox-schema.test.ts`.

| Bảng | Cột riêng | Ràng buộc |
|---|---|---|
| `outbox_messages` | `project_id uuid` (được rỗng), `event_id uuid NOT NULL`, `event_type text NOT NULL`, `event_version text NOT NULL DEFAULT 'v1'`, `source text NOT NULL DEFAULT 'libetech-ai-os'`, `trace_id uuid NOT NULL`, `correlation_id uuid NOT NULL`, `causation_id uuid`, `occurred_at timestamptz NOT NULL DEFAULT now()`, `audience text NOT NULL CHECK(audience IN ('group','dm'))`, `target_chat_id text NOT NULL`, `target_topic_id text NOT NULL DEFAULT ''`, `reply_to_message_id text`, `recipient_user_id uuid`, `template text NOT NULL CHECK(template IN ('intake.received','intake.recovered','intake.attachment_failed','account_approval.pending'))`, `payload jsonb NOT NULL DEFAULT '{}' CHECK(length(payload::text)<=2048)`, `dedupe_key text NOT NULL`, `state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','leased','delivered','uncertain','dead','abandoned'))`, `attempt_no integer NOT NULL DEFAULT 0`, `next_attempt_at timestamptz NOT NULL DEFAULT now()`, `lease_token uuid`, `lease_expires_at timestamptz`, `delivered_at timestamptz`, `telegram_message_id text`, `acknowledged_at timestamptz`, `last_error_code text`, `failure_owner_id uuid`, `source_event_id uuid`, `candidate_id uuid`, `version integer NOT NULL DEFAULT 1` | `UNIQUE(event_id)`, `UNIQUE(tenant_id,dedupe_key)`, `UNIQUE(id,tenant_id)`; `CHECK((audience='group' AND project_id IS NOT NULL AND recipient_user_id IS NULL) OR (audience='dm' AND project_id IS NULL AND recipient_user_id IS NOT NULL AND source_event_id IS NULL AND candidate_id IS NULL))`; `CHECK(state<>'delivered' OR delivered_at IS NOT NULL)`; FK `(project_id,tenant_id)→projects`, `(source_event_id,tenant_id,project_id)→source_events`, `(candidate_id,tenant_id,project_id)→intake_candidates`, `(recipient_user_id,tenant_id)→identity.users`; trigger chặn DELETE |
| `delivery_receipts` (bất biến) | `project_id uuid` (được rỗng), `outbox_id uuid NOT NULL`, `attempt_no integer NOT NULL CHECK(attempt_no>0)`, `phase text NOT NULL CHECK(phase IN ('send','reconcile'))`, `outcome text NOT NULL CHECK(outcome IN ('delivered','failed_retryable','failed_permanent','uncertain','not_sent'))`, `telegram_message_id text`, `error_code text`, `reported_at timestamptz NOT NULL`, `source_id text NOT NULL`, `source_type text NOT NULL CHECK(source_type='telegram_gateway')`, `ingested_at timestamptz NOT NULL DEFAULT now()`, `quality_score smallint NOT NULL CHECK(quality_score BETWEEN 0 AND 100)` | FK `(outbox_id,tenant_id)→outbox_messages(id,tenant_id)`; `UNIQUE(outbox_id,attempt_no,phase)` |

- Index: `outbox_messages(tenant_id,state,next_attempt_at)`, `(tenant_id,project_id,created_at DESC)`, mọi FK, `created_at`; `delivery_receipts(outbox_id,created_at)`, `(tenant_id,project_id,created_at DESC)`.
- Policy `outbox_messages`: `TO libetech_intake` — SELECT/INSERT/UPDATE với điều kiện `tenant AND (project_id = ANY(app.project_ids) OR (project_id IS NULL AND audience='dm'))`; INSERT thêm cổng `state='pending' AND attempt_no=0 AND delivered_at IS NULL AND acknowledged_at IS NULL AND audience='group'`. `TO libetech_runtime` — SELECT/UPDATE dòng dự án trong phạm vi; INSERT không cấp. `TO libetech_identity` — SELECT/INSERT/UPDATE chỉ dòng `project_id IS NULL AND audience='dm'` cùng tenant; INSERT cùng cổng trạng thái đầu.
- Policy `delivery_receipts`: `TO libetech_intake` SELECT/INSERT (cùng điều kiện hai nhánh); `TO libetech_runtime` SELECT dòng dự án; `TO libetech_identity` SELECT dòng DM.
- Quyền cột: `libetech_intake` — `SELECT`, `INSERT` (trừ các cột trạng thái giao: để mặc định), `UPDATE(state,attempt_no,next_attempt_at,lease_token,lease_expires_at,delivered_at,telegram_message_id,last_error_code,version,updated_at)` trên `outbox_messages`; `SELECT, INSERT` trên `delivery_receipts`. `libetech_runtime` — `SELECT` hai bảng; `UPDATE(state,next_attempt_at,attempt_no,failure_owner_id,last_error_code,version,updated_at)` trên `outbox_messages`. `libetech_identity` — `SELECT`, `INSERT(tenant_id,event_id,event_type,trace_id,correlation_id,causation_id,audience,target_chat_id,recipient_user_id,template,payload,dedupe_key)`, `UPDATE(acknowledged_at,updated_at)` trên `outbox_messages`; `SELECT` trên `delivery_receipts`; `USAGE` schema `public` nếu chưa có.

**Tệp lùi 017:** từ chối nếu cột `identity.account_approvals.kind` còn tồn tại («Roll back 018 before 017»); `DROP TABLE IF EXISTS delivery_receipts, outbox_messages;` xoá dòng `'017'`.

**Ca kiểm viết trước** (`tests/outbox-schema.test.ts`)
- [ ] `migrations-rollback` và `rls-catalog` phủ 017.
- [ ] **`outbox tables return nothing without RLS context`** — ba role, không ngữ cảnh → 0 dòng.
- [ ] **`(3) the Xeca scope cannot read LBRC or IBS HI receipts and outbox rows`** — dòng nhóm của `ids.sales`; `scoped(h.db,viewer(ids.transport),…)` và `intakeScoped` với `projectIds=[ids.transport]` → 0 dòng ở cả `outbox_messages` và `delivery_receipts`; `outsider` → 0 dòng.
- [ ] **`runtime and identity cannot insert a group outbox row; intake cannot insert a DM row`** — ba câu INSERT đều ném.
- [ ] **`no role can insert an outbox row that is already delivered or acknowledged`** — `state='delivered'` / `delivered_at=now()` / `acknowledged_at=now()` → ném cho cả intake và identity.
- [ ] **`runtime cannot mark a message delivered`** — `scoped(pm)` `UPDATE outbox_messages SET delivered_at=now()` → `permission denied`.
- [ ] **`a DM row has no project and a group row has one`** — vi phạm CHECK hình dạng → ném.
- [ ] **`delivery receipts are append-only and unique per attempt and phase`** — UPDATE/DELETE ném; chèn trùng `(outbox_id,attempt_no,phase)` ném 23505.

**Lệnh kiểm:** `npx vitest run tests/outbox-schema.test.ts tests/migrations-rollback.test.ts tests/rls-catalog.test.ts`, rồi native.

**Con trỏ:** brief `:102`, `:118` · ADR-002 «Outbox và biên nhận giao» · `SPEC-008…:116` · `SPEC-009…:125`, `:147` · E-INT-02, E-INT-06, E-EXT-01.

### Task 6: `OutboxService` — ghi cùng transaction, lease, biên nhận, đối soát, hàng lỗi — **review riêng**

**Tệp:** tạo `src/server/outbox.ts`, `tests/outbox.test.ts`, `tests/outbox-crash.test.ts`; sửa `src/server/intake.ts` (gọi `enqueueReceipt` thật trong transaction của `ingest`), `src/server/bridge-io.ts` (nối hai tuyến outbox), `src/server/types.ts`.

**Giao diện tạo ra**
```ts
export type OutboxState='pending'|'leased'|'delivered'|'uncertain'|'dead'|'abandoned';
export type OutboxSignal='lease'|'delivered'|'failed_retryable'|'failed_permanent'|'uncertain'|'lease_expired'|'reconciled_delivered'|'reconciled_not_sent'|'requeue'|'abandon';
export function outboxTransition(state:OutboxState,signal:OutboxSignal,attemptNo:number):OutboxState; // ném AppError('OUTBOX_TRANSITION_INVALID',…,409) nếu không hợp lệ
export const MAX_ATTEMPTS=6, LEASE_SECONDS=60, OVERDUE_SECONDS=600;
export const backoffSeconds=(attemptNo:number)=>Math.min(30*2**(attemptNo-1),900);
export type Envelope={event_id:string;event_type:string;version:'v1';source:'libetech-ai-os';timestamp:string;tenant_id:string;trace_id:string;correlation_id:string;causation_id:string|null;payload:{template:string;params:Record<string,string>}};
export type Delivery={outboxId:string;attemptNo:number;leaseToken:string;audience:'group'|'dm';chatId:string;topicId:string;replyToMessageId:string|null;envelope:Envelope};
export async function enqueueReceipt(tx:Queryable,i:{tenantId:string;projectId:string;sourceEventId:string;candidateId:string|null;chatId:string;topicId:string;replyToMessageId:string;template:'intake.received'|'intake.recovered'|'intake.attachment_failed';params:Record<string,string>;traceId:string;correlationId:string}):Promise<'queued'|'none'>; // dedupe_key = template+':'+sourceEventId; ON CONFLICT(tenant_id,dedupe_key) DO NOTHING
export async function enqueueDm(tx:Queryable,i:{tenantId:string;recipientUserId:string;telegramId:string;template:'account_approval.pending';dedupeKey:string;params:Record<string,string>;traceId:string;correlationId:string;causationId:string|null}):Promise<void>;
export class OutboxService{constructor(intakeDb:Database,identity:IdentityService,p:IntakePrincipal);
  pull(raw:unknown):Promise<{deliveries:Delivery[];reconcile:{outboxId:string;attemptNo:number}[]}>;   // raw: {limit:1..10}.strict()
  report(raw:unknown):Promise<{accepted:number;replayed:number}>;}                                       // raw: {receipts:[{outboxId,attemptNo,leaseToken,phase,outcome,telegramMessageId?,errorCode?,reportedAt}]}.strict(), ≤10
```
- Bảng chuyển: `pending→leased` (lease) · `leased→delivered` · `leased→pending` (failed_retryable, `attemptNo<MAX_ATTEMPTS`) hoặc `→dead` (đủ lượt) · `leased→dead` (failed_permanent) · `leased→uncertain` (uncertain hoặc lease_expired) · `uncertain→delivered` (reconciled_delivered) · `uncertain→pending` (reconciled_not_sent) · `dead→pending` (requeue, `attempt_no` về 0) · `dead|uncertain→abandoned` (abandon). `delivered`, `abandoned` là cuối.
- `ingest` chọn mẫu: `spooled` → `intake.recovered`; tệp không `stored` → `intake.attachment_failed`; ngược lại `intake.received`. Chỉ ghi outbox cho sự kiện **mới** và `addressed=true` (bản phát lại, bản sửa, tin không gọi bot: không biên nhận). `params` chỉ gồm `ref` (candidateRef) và `observedAt`; không chứa nội dung tin.
- `pull` trong một transaction `intakeScoped` (phạm vi = hợp các dự án của `intake.chats`): (1) `UPDATE … SET state='uncertain' WHERE state='leased' AND lease_expires_at<now()`; (2) nhận lô bằng `UPDATE … WHERE id IN (SELECT id … WHERE state='pending' AND next_attempt_at<=now() ORDER BY created_at LIMIT $1 FOR UPDATE SKIP LOCKED) RETURNING …` đặt `leased`, `attempt_no+1`, `lease_token`, `lease_expires_at`; (3) với dòng DM: kiểm `identity.telegram_links` còn cặp `(recipient_user_id, target_chat_id)` qua `identity.scope`; mất liên kết → `dead`, `last_error_code='RECIPIENT_UNLINKED'`, không trả; (4) `reconcile` = dòng `uncertain` (tối đa 10). Mỗi đổi trạng thái ghi `intake_events` (dòng dự án) kind `outbox.leased`/`outbox.uncertain`/`outbox.dead`.
- `report`: mỗi biên nhận — `INSERT delivery_receipts … ON CONFLICT(outbox_id,attempt_no,phase) DO NOTHING RETURNING id`; không có dòng trả về → so `outcome` với dòng cũ: giống → `replayed`, khác → `RECEIPT_CONFLICT` 409. Biên nhận `phase='send'` phải khớp `lease_token` và `attempt_no` hiện tại của dòng đang `leased` → sai thì `LEASE_INVALID` 409 (dòng đã `uncertain` do hết lease chỉ nhận `phase='reconcile'`). Áp `outboxTransition`; `delivered` đặt `delivered_at=reportedAt`, `telegram_message_id`; `failed_retryable` đặt `next_attempt_at=now()+backoffSeconds(attemptNo)`. `quality_score` của biên nhận: 100 cho `phase='send'`, 60 cho `phase='reconcile'`.
- Không hàm nào của AI OS gọi Telegram; không đọc biến môi trường chứa token.

**Ca kiểm viết trước** (`tests/outbox.test.ts`, cả hai động cơ)
- [ ] **`outboxTransition accepts the listed moves and rejects the rest`** — bảng dữ liệu: mọi cặp hợp lệ ở trên; `delivered+lease`, `pending+delivered`, `uncertain+lease`, `abandoned+requeue` → ném.
- [ ] **`an addressed new message queues exactly one receipt in the same transaction`** — sau `ingest`: 1 dòng `outbox_messages` `state='pending'`, `template='intake.received'`, `target_chat_id=chatSales`, `reply_to_message_id` = message id của tin, `causation_id` rỗng, `correlation_id` = của event; envelope có đủ 10 trường E-INT-02.
- [ ] **`PM-07 a persisted message is not shown as sent`** — trước khi có biên nhận: `delivered_at IS NULL`; `IntakeService` trả `receipt:'queued'` (không có chữ `delivered`/`sent`); sau `pull` vẫn `delivered_at IS NULL`; chỉ sau `report(delivered)` mới có `delivered_at`; `acknowledged_at` vẫn rỗng.
- [ ] **`PM-03 a replayed message and a replayed pull never duplicate a receipt`** — `ingest` cùng sự kiện ba lần → 1 dòng outbox; `pull` hai lần liền → lần hai `deliveries=[]`; `report` cùng biên nhận hai lần → `{accepted:0,replayed:1}` ở lần hai, 1 dòng `delivery_receipts`.
- [ ] **`DOC-12 a spooled message stored after recovery gets one recovery receipt and no duplicate`** — `messageEvent({spooled:true})` gửi hai lần → 1 event, 1 outbox `template='intake.recovered'`.
- [ ] **`DOC-04 a failed attachment queues attachment_failed, never intake.received`**.
- [ ] **`a timeout after send becomes uncertain and is reconciled before any resend`** — `pull` → `report(uncertain)` → `pull` kế tiếp: `deliveries=[]`, `reconcile` chứa dòng đó; `report({phase:'reconcile',outcome:'delivered'})` → `delivered`; nhánh khác `outcome:'not_sent'` → `pending` và `pull` sau trả lại với `attemptNo=2`.
- [ ] **`a permission failure is dead at once and is never leased again`** — `report(failed_permanent, errorCode:'BOT_FORBIDDEN')` → `state='dead'`; ba lần `pull` sau đều rỗng.
- [ ] **`network failures back off and stop at six attempts`** — lặp `pull`/`report(failed_retryable)` (test dời `next_attempt_at` về quá khứ bằng `h.operator`) → `next_attempt_at` tăng theo `backoffSeconds`; sau lượt 6 → `dead`.
- [ ] Review Focus 5: **`a receipt with an expired or foreign lease, or a second different outcome, is refused`** — `leaseToken` sai → `LEASE_INVALID`; ép `lease_expires_at` về quá khứ, `pull` (→ `uncertain`), rồi `report(phase:'send',delivered)` bằng lease cũ → `LEASE_INVALID`, `state` vẫn `uncertain`; sau khi `delivered`, `report` cùng lượt với `failed_permanent` → `RECEIPT_CONFLICT`, `state` vẫn `delivered`.
- [ ] **`(3) a pull scoped to Xeca projects never returns LBRC or IBS HI messages`** — `OutboxService` với `projectIds=[ids.transport]` không trả dòng của `ids.sales`.
- [ ] **`a DM to a recipient who unlinked Telegram is dead with RECIPIENT_UNLINKED and is not returned`**.
- [ ] **`routes: outbox/pull and outbox/receipts work through handleBridgeIo with the intake key only`** — khứ hồi qua `signedRequest`.
- [ ] `tests/outbox-crash.test.ts`, `describe.skipIf(!native)`: **`a rolled-back business transaction leaves no outbox row`** — `ingest` với bước cuối bị ép ném → 0 event, 0 outbox; và `identity.scope` tạo phiếu rồi ném (Task 9 thêm nhánh này) → 0 dòng DM.
- [ ] native: **`a process that dies between write and send still delivers exactly once after restart`** — `ingest` xong, đóng hẳn `Database` (mô phỏng tiến trình chết trước khi có ai kéo); mở kết nối mới, `pull` → đúng 1 delivery; `report(delivered)`; `pull` nữa → rỗng; 1 dòng `delivery_receipts`.
- [ ] native: **`two pulls in parallel never lease the same message`** — 5 dòng pending, hai `pull({limit:5})` song song → hợp hai lô đủ 5 id, không id nào trùng.
- [ ] native: **`a gateway that dies after leasing leaves the message uncertain, not resent`** — `pull`, ép hết lease, `pull` → `deliveries=[]`, dòng nằm trong `reconcile`.

**Lệnh kiểm:** `npx vitest run tests/outbox.test.ts tests/intake.test.ts tests/bridge-io.test.ts`; native thêm `tests/outbox-crash.test.ts`, lưu output.

**Con trỏ:** brief `:102`, `:127-129`, `:147-148` · OQ-11 (a) · `SPEC-009…:125`, `:147` · `SPEC-008…:116`, `:126`, `:130`.

### Task 7: Thao tác của PM trên ứng viên và hàng lỗi — không review riêng

**Tệp:** sửa `src/server/intake.ts` (thêm phần đọc/thao tác), `src/server/intake-rules.ts` (chuyển trạng thái ứng viên); tạo `tests/inbox-service.test.ts`.

**Giao diện tạo ra**
```ts
export type CandidateState='new'|'needs_info'|'confirmed'|'duplicate'|'dismissed';
export type CandidateAction='confirm'|'need_info'|'mark_duplicate'|'dismiss'|'reopen'|'link_ticket';
export function candidateTransition(state:CandidateState,action:CandidateAction):CandidateState; // link_ticket giữ nguyên trạng thái
export type IntakeStatus={receivedAt:string;persistedAt:string;projectedAt:null;deliveredAt:string|null;acknowledgedAt:string|null;outboxState:OutboxState|null};
export type CandidateCard={candidateId:string;ref:string;projectId:string;projectLabel:string;sourceRef:string;receivedAt:string;classification:'incident'|'request'|'document'|null;state:CandidateState;missingFields:string[];duplicateCandidates:{candidateId:string;ref:string;reason:string}[];contentMode:'excerpt'|'pointer_only';excerpt:string|null;forwarded:boolean;attachments:{state:string;mimeType:string;sizeBytes:number|null;fileName:string}[];ticketRef:string|null;status:IntakeStatus;version:number};
export type SourceAvailabilityRow={chatId:string;topicId:string;state:'not-configured'|'partially-received';coverageStart:string|null;coverageGaps:{from:string;to:string}[];label:string};
export class InboxService{constructor(db:Database);
  list(p:Principal,raw:unknown):Promise<{items:CandidateCard[];total:number}>;      // {projectId,state?,limit=50≤200,offset=0}.strict(); projectId bắt buộc
  detail(p:Principal,candidateId:string):Promise<{card:CandidateCard;revisions:…;events:…;deliveries:…}>;
  command(p:Principal,candidateId:string,raw:unknown,key:string):Promise<CandidateCard>;
  sources(p:Principal,projectId:string):Promise<SourceAvailabilityRow[]>;
  failures(p:Principal,projectId:string):Promise<{outboxId:string;state:'dead'|'uncertain'|'pending';template:string;lastErrorCode:string|null;ownerId:string|null;overdue:boolean;version:number}[]>;
  failureCommand(p:Principal,outboxId:string,raw:unknown,key:string):Promise<void>;} // {kind:'take'|'requeue'|'abandon',expectedVersion,reason}
```
- Quyền: đọc Inbox cần vai dự án ∈ {manager, engineer, technical, business}; `viewer`, `bot`, ngoài dự án → `SCOPE_DENIED` 404 cùng một câu. Thao tác (`command`, `failureCommand`) chỉ `manager` của dự án. Chuyển: `new→needs_info|confirmed|duplicate|dismissed`; `needs_info→new|confirmed|duplicate|dismissed`; `confirmed|duplicate|dismissed→new` (reopen).
- `command`: `{kind:'confirm',expectedVersion,classification,note?}` · `{kind:'need_info',expectedVersion,missingFields:string[1..10]}` · `{kind:'mark_duplicate',expectedVersion,duplicateOf:uuid,reason}` (đích cùng dự án, khác chính nó, không ở `duplicate`) · `{kind:'dismiss',expectedVersion,reason}` · `{kind:'reopen',expectedVersion,reason}` · `{kind:'link_ticket',expectedVersion,ticketRef}` (`^TK-[A-Z0-9]{1,12}-\d{6}-\d{3,5}$`, lưu như tham chiếu ngoài). Chạy trong `scoped(db,{...p,projectIds:[projectId]})` + `deduplicate`; `UPDATE … WHERE id=$1 AND version=$2`; 0 dòng → `REVISION_CONFLICT` 409; ghi `intake_events` `actor_kind='user'`. Không thao tác nào tạo `work_items`.
- `duplicateCandidates` (gợi ý, không tự gộp): ứng viên khác cùng dự án có `content_hash` bản mới nhất trùng, lý do `'cùng nội dung'`.
- `sources`: mỗi dòng `project_channels` của dự án (mọi trạng thái — chỉ để hiển thị, không cấp quyền) → không có `source_events` nào từ chat/topic đó: `not-configured`, nhãn **«Chưa xác minh khả năng nhận tin»**; có: `partially-received`, `coverageStart=min(observed_at)`, `coverageGaps` = các sự kiện `spooled` (`observed_at`→`ingested_at`), nhãn «Nhận từ <mốc>; không có lịch sử trước mốc này». Không bao giờ trả nhãn «Đã kết nối đầy đủ».
- `failures`: dòng `dead`, `uncertain`, và `pending` quá `OVERDUE_SECONDS` chưa giao (`overdue=true`). `failureCommand`: `take` đặt `failure_owner_id=p.id`; `requeue`/`abandon` qua `outboxTransition`; đều kèm `expectedVersion` và `intake_events`.

**Ca kiểm viết trước** (`tests/inbox-service.test.ts`)
- [ ] **`list requires a project and returns only that project's candidates`** — thiếu `projectId` → lỗi zod; `pm` với `ids.sales` không thấy ứng viên của `ids.transport`; `total` chỉ đếm trong dự án.
- [ ] **`(3) viewer, bot, another project's member and another tenant cannot list, read or act`** — bốn principal × (`list`, `detail`, `command`, `failures`) → cùng `{code:'SCOPE_DENIED',status:404}`, thông điệp giống hệt nhau.
- [ ] **`(5) no intake or bot path creates, assigns, closes or accepts work`** — sau chuỗi `ingest` + `confirm`: `count(*) work_items` không đổi; `new WorkService(db).create(bot,…)` và `.command(bot,…)` ném; `InboxService.command(bot,…)` ném; `candidateTransition` không có hành động nào tên `create_work`/`assign`/`accept`.
- [ ] **`confirm stores the human classification with an audit event; a stale version changes nothing`** — `confirm` v1 → `state='confirmed'`, `classification='incident'`, `version=2`, 1 `intake_events` kind `candidate.confirmed`; lặp với `expectedVersion:1` và khoá mới → `REVISION_CONFLICT`, không thêm event, version vẫn 2; cùng khoá cùng thân → phát lại kết quả cũ; cùng khoá khác thân → `IDEMPOTENCY_CONFLICT`.
- [ ] **`mark_duplicate needs a visible target in the same project and merges nothing by itself`** — đích ở dự án khác → `SCOPE_DENIED`; chính nó → 422; hợp lệ → `state='duplicate'`, hai ứng viên vẫn tồn tại.
- [ ] **`PM-07 reopening keeps history and earlier delivery receipts`** — sau `dismiss` rồi `reopen`: `intake_events` giữ đủ chuỗi theo thứ tự; `delivery_receipts` và `delivered_at` cũ còn nguyên; không có dòng outbox mới.
- [ ] **`link_ticket stores an external reference only`** — `ticketRef='TK-XECA-202611-001'` lưu được; chuỗi sai mẫu → 422; `information_schema`: không bảng nào của 016–017 có cột tên chứa `ticket_status`/`ticket_state`.
- [ ] **`a group with no received message shows Chưa xác minh khả năng nhận tin`** — đề xuất kênh qua `ProjectRegistryService.proposeChannel` cho `chatSales`, chưa có tin → `not-configured` + nhãn; sau một `ingest` → `partially-received`, `coverageStart` = `observedAt`; một sự kiện `spooled` → 1 phần tử trong `coverageGaps`; không nhãn nào chứa «đầy đủ».
- [ ] **`failures lists dead, uncertain and overdue messages; requeue and abandon need a manager and a fresh version`**.
- [ ] **`the newest revision is chosen by edited_at`** (nối Review Focus 3).

**Lệnh kiểm:** `npx vitest run tests/inbox-service.test.ts`; native lặp lại.

**Con trỏ:** brief `:103`, `:130`, `:137` (3)(5), `:140` · `SPEC-008…:75-76`, `:130` · `SPEC-009…:86` · `DESIGN…:48-54`, `:82-86`.

### Task 8: Đối soát inbox ↔ sổ ticket (OQ-09 mục 2) — không review riêng · **dừng tại OQ-26** phần nạp sổ ticket thật

**Tệp:** tạo `src/server/ledger-reconcile.ts`, `tests/ledger-reconcile.test.ts`.

**Giao diện tạo ra**
```ts
export type LedgerTicketRow={ticketId:string;chatId:string;messageId:string;threadId:string;status:string;createdAt:string};
export type InboxRow={sourceEventId:string;chatId:string;messageId:string;candidateId:string|null;ticketRef:string|null};
export type ReconcileReport={matched:{eventKey:string;sourceEventId:string;candidateId:string|null;ticketId:string;linked:boolean}[];
  onlyInInbox:{eventKey:string;sourceEventId:string}[];onlyInLedger:{eventKey:string;ticketId:string}[];
  conflicts:{eventKey:string;kind:'two_tickets_one_message'|'ticket_ref_mismatch';ticketIds:string[];ticketRef:string|null}[]};
export function reconcileLedger(inbox:InboxRow[],ledger:LedgerTicketRow[]):ReconcileReport;   // thuần, không I/O
export async function inboxRows(db:Database,p:Principal,projectId:string,window:{from:string;to:string}):Promise<InboxRow[]>; // chỉ đọc, trong scoped()
```
- Khoá chung = `eventKey(chatId,messageId)` của Task 4 (`telegram:<chat>:<message>`, không gồm topic). Mã nguồn plugin priority1 (chỉ đọc mã ngày 13/11) lưu `chat_id`, `thread_id`, `message_id` trên `tickets` và khử trùng sự kiện theo profile + nền tảng + chat + message, không dùng topic; không giữ `update_id` hay `edit_date` riêng. Kế hoạch **không** chép mã hay dữ liệu nào từ plugin đó.
- `LedgerTicketRow[]` ở lát này **chỉ** đến từ fixture tổng hợp trong test. Không viết mã đọc SQLite của priority1, không viết adapter, không thêm tuyến nhận sổ ticket: đường đưa sổ ticket thật tới AI OS chưa được SPEC hay quyết định nào chỉ ra (**OQ-26**).
- Hai hàm không ghi gì: không tạo ứng viên, không gắn `ticket_ref`, không đổi trạng thái. PM gắn `ticket_ref` bằng `link_ticket` (Task 7).

**Ca kiểm viết trước**
- [ ] **`OQ-09 a message with both a ticket and a SourceEvent is joined by the shared event key`** — inbox có `(chatSales,'101')`, sổ có ticket `TK-TEST-202611-001` cùng chat/message, `threadId='1'` (khác topic của inbox) → 1 phần tử `matched`, `linked=false`.
- [ ] **`reconciliation creates no candidate and changes no row`** — chụp `count(*)` và `md5(string_agg(id::text||version::text,',' ORDER BY id))` của `intake_candidates`, `count(*)` của `source_events`, `outbox_messages`, `intake_events` trước và sau `inboxRows` + `reconcileLedger` → không đổi.
- [ ] **`AI OS holds no ticket state to change`** — đầu ra `ReconcileReport` không có trường `status`; `status` của sổ chỉ đi vào, không đi ra; không cột DB nào giữ trạng thái ticket (dùng lại khẳng định `information_schema` của Task 7).
- [ ] **`differences are listed, never repaired`** — inbox có `'102'` không ticket → `onlyInInbox`; sổ có ticket cho `'103'` không có event → `onlyInLedger`; hai ticket cùng `'104'` → `conflicts` `two_tickets_one_message`; ứng viên có `ticketRef='TK-TEST-202611-009'` trong khi sổ ghi `…-004` → `ticket_ref_mismatch`; sau lệnh, các ứng viên giữ nguyên `ticket_ref`.
- [ ] **`a matched and already linked pair is reported as linked`** — sau `link_ticket` đúng mã → `linked=true`.
- [ ] **`rows outside the caller's project are never read`** — `inboxRows(pm,ids.sales,…)` không chứa event của `ids.transport`; `viewer` của dự án khác → `SCOPE_DENIED`.

**Lệnh kiểm:** `npx vitest run tests/ledger-reconcile.test.ts`; native lặp lại. Output là bằng chứng mục (2) của OQ-09 **trên dữ liệu tổng hợp**; mục (1) là điểm dừng runtime.

**Con trỏ:** brief `:91`, `:133` · OQ-09 · `SPEC-008…:74-75`, `:292` · ADR-002 «Consequences» · `AGENTS.md:5`, `:13` · OQ-26.

### Task 9: Migration 018 + SPEC-007 ca (a) DM có biên nhận, ca (b) phiếu đổi quyền — **review riêng** · quy tắc bỏ phiếu theo quyết định **OQ-29** ngày 14/11/2026

**Tệp:** tạo `migrations/018_access_change_approval.sql`, `migrations/rollback/018_access_change_approval.sql`, `tests/account-approval-dm.test.ts`, `tests/access-change.test.ts`; sửa `src/server/accounts.ts` (`:107-126`, `:187-194`), `src/server/account-approval.ts` (`:22-33`, `:84-107`, `:115-145`), `tests/outbox-crash.test.ts` (nhánh DM).

**Migration 018** (expand, chỉ thêm và nới): trên `identity.account_approvals` — `ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'registration' CHECK(kind IN ('registration','access_change'))`, `subject_user_id uuid`, `subject_account_version integer`, `previous_grants jsonb`; `ALTER COLUMN registration_id DROP NOT NULL`; ràng buộc hình dạng (tạo có kiểm tồn tại): `(kind='registration' AND registration_id IS NOT NULL AND subject_user_id IS NULL) OR (kind='access_change' AND registration_id IS NULL AND subject_user_id IS NOT NULL AND subject_account_version IS NOT NULL AND previous_grants IS NOT NULL)`; FK `(subject_user_id,tenant_id)→identity.users`; index `(subject_user_id)`; unique partial `(tenant_id,subject_user_id) WHERE kind='access_change' AND state IN ('pending','approved')`; không cần cấp thêm quyền: `libetech_identity` đã có INSERT cả bảng và `UPDATE(state,updated_at)` (`migrations/009_telegram_account_approval.sql:67-69`). Không seed, không đổi dòng cũ. **Tệp lùi:** từ chối nếu còn dòng `kind='access_change'`; bỏ index, ràng buộc, bốn cột; `SET NOT NULL` lại `registration_id`; xoá dòng `'018'`.

**Giao diện tạo ra / đổi**
```ts
// account-approval.ts
export async function notifyVoters(tx:Queryable,identity:IdentityService,approvalId:string,voters:{user_id:string;telegram_id:string}[],traceId:string):Promise<void>; // enqueueDm mỗi người, dedupeKey='account_approval.pending:'+approvalId+':'+user_id, params={} (không tên, không quyền, không mã phiếu)
// accounts.ts — commandSchema thêm:
//   {kind:'propose_access_change',userId,expectedVersion,grants,reason}.strict()
// pendingForPrincipal trả thêm: kind, previous_grant_details (cùng dạng grant_details); name/username lấy từ registration (đăng ký) hoặc identity.users (đổi quyền)
```
- Ca (a): trong `registrationDecision` nhánh `approve_registration`, sau khi chèn voters (`accounts.ts:119-121`) gọi `notifyVoters` **trong cùng transaction** `identity.scope`. `verifiedApprovalSeats` đã trả `telegram_id` (`account-approval.ts:22-33`).
- Xác nhận của người nhận: trong `voteForPrincipal`, khi ghi phiếu mới, `UPDATE outbox_messages SET acknowledged_at=now() WHERE dedupe_key=$1 AND acknowledged_at IS NULL` cho đúng người bỏ phiếu. Biên nhận giao (`delivered_at`) chỉ đến từ gateway (Task 6); bấm phiếu **không** làm tin thành «đã giao».
- Ca (b) `propose_access_change`: điều kiện — tài khoản đích đang hoạt động và đã kích hoạt; `expectedVersion` khớp; `grants` trong phạm vi quản trị; `!reducesAccess(before,grants)` (nếu chỉ giảm quyền → `ACCESS_CHANGE_NOT_NEEDED` 409, dùng `access` như cũ); chưa có phiếu đổi quyền còn hiệu lực. Ghế: `verifiedApprovalSeats` **bỏ ghế của chính người được đổi quyền**; sau khi bỏ không còn Chairman + ít nhất một BoM → `APPROVERS_NOT_READY`. Chèn phiếu `kind='access_change'` với `previous_grants=before`, `subject_account_version=user.version`; chèn voters; `notifyVoters`; `identity.events` kind `access_change_proposed`. **Không** đổi `memberships`, không đổi `account_version`.
- `access` khi mở rộng quyền (`accounts.ts:191-192`): tìm phiếu `access_change` `state='approved'` của đúng người, `grants` bằng đúng `cmd.grants` (so sau khi sắp theo `projectId` và sắp `reportPermissions`), `subject_account_version===user.version`; qua `approvalReady`; có → `setGrants`, phiếu → `issued`, audit kèm `approvalId`. Không có → `TELEGRAM_APPROVAL_REQUIRED` như hiện nay. Giảm quyền giữ nguyên đường cũ, không cần phiếu.
- Bỏ phiếu: `voteForPrincipal` với phiếu `access_change` — nếu `account_version` của người được đổi quyền khác `subject_account_version` → đặt phiếu `expired`, trả `APPROVAL_CLOSED` 409 (thẻ cũ không ghi phiếu). Quy tắc đủ phiếu (sửa 14/11/2026 theo quyết định OQ-29 «1 thành viên BOM»): hàm đếm riêng cho `access_change` — `approved` khi ít nhất một ghế BoM đã đóng băng đồng ý, không cần phiếu Chairman; `rejected` khi mọi ghế BoM đã đóng băng đều từ chối, hoặc Chairman từ chối (S13); còn lại `pending`. Hạn 48 giờ như phiếu lần đầu. `tally` của phiếu cấp tài khoản lần đầu không đổi (Chairman + một BoM). `approvalReady` và `voteForPrincipal` chọn hàm đếm theo `kind`. *(Bản trước: dùng lại nguyên `tally`; bỏ theo quyết định.)*
- `pendingForPrincipal` (`account-approval.ts:101`) đổi `JOIN identity.registration_requests` thành `LEFT JOIN`, thêm `LEFT JOIN identity.users` cho người được đổi quyền; `approvalReady` và `activate` (`src/server/identity.ts:108-117`) chỉ nhận phiếu `kind='registration'` cho lời mời — phiếu đổi quyền không bao giờ mở được lời mời.

**Ca kiểm viết trước**
- [ ] `tests/onboarding-feedback.test.ts` — 9 ca hiện có giữ xanh nguyên văn (chạy trước và sau).
- [ ] `tests/account-approval-dm.test.ts`: **`a new ballot queues one DM per frozen voter in the same transaction`** — sau `approve_registration` với 4 ghế: 4 dòng `outbox_messages` `audience='dm'`, `project_id IS NULL`, `template='account_approval.pending'`, `target_chat_id` = Telegram ID của từng ghế, `payload` không chứa tên người đăng ký, tên dự án hay mã phiếu.
- [ ] **`a proposal that fails leaves no DM row`** — ép lỗi sau `notifyVoters` (ghế trùng) → 0 dòng DM, 0 phiếu.
- [ ] **`the DM has a delivery receipt of its own, separate from the vote`** — `OutboxService.pull` trả 4 delivery `audience:'dm'`; `report(delivered)` cho một dòng → `delivered_at` có, `acknowledged_at` rỗng; người đó bỏ phiếu → `acknowledged_at` có; người chưa được giao mà bỏ phiếu qua web → `acknowledged_at` có, `delivered_at` vẫn rỗng.
- [ ] **`proposing the same registration twice never queues a second DM`** — phiếu hết hạn rồi trình lại tạo phiếu mới (mã khác) → DM mới theo `dedupe_key` mới; gọi lại cùng phiếu → không thêm.
- [ ] **`(6) a ballot tapped in a group, tapped again, or tapped on an old card records no vote`** — `vote(…,'-1000000000001','group',…)` → `PRIVATE_CHAT_REQUIRED`, 0 phiếu; bỏ lại cùng lựa chọn → `replayed:true`, vẫn 1 phiếu; lựa chọn khác → `VOTE_LOCKED`; phiếu đã `approved`/hết hạn → `APPROVAL_CLOSED`, không thêm phiếu.
- [ ] `tests/access-change.test.ts`: **`expanding access without an approved ballot is still refused`** — `access` thêm dự án → `TELEGRAM_APPROVAL_REQUIRED`.
- [ ] (sửa 14/11/2026, OQ-29) **`an access-change ballot freezes grants and applies once one BoM agrees`** — `propose_access_change` → phiếu `pending`, `memberships` không đổi; một BoM đồng ý (không có phiếu Chairman) → `approved`; `access` với đúng `grants` → áp, phiếu `issued`, `account_version` tăng 1, phiên cũ bị thu hồi.
- [ ] (sửa 14/11/2026, OQ-29) **`Chairman agreement alone does not approve an access change`**; **`one BoM rejection keeps it pending while another BoM can still vote; every BoM rejecting closes it`**; **`Chairman rejection closes it`** (S13); **`the first-registration ballot still needs Chairman and one BoM`** (bảy ca SPEC-007 của `tests/onboarding-feedback.test.ts` giữ xanh).
- [ ] **`grants that differ from the frozen ballot are refused`** — `access` với thêm một quyền báo cáo so với phiếu → `TELEGRAM_APPROVAL_REQUIRED`, `memberships` không đổi.
- [ ] **`an account change after the proposal invalidates the ballot`** — `disable` rồi `enable` (version đổi) → bỏ phiếu → `APPROVAL_CLOSED`, phiếu `expired`; `access` → `TELEGRAM_APPROVAL_REQUIRED`.
- [ ] **`the subject never votes on their own access change`** — người được đổi quyền đang giữ ghế `bom_quan` → không nằm trong voters; nếu đó là BoM duy nhất → `APPROVERS_NOT_READY`.
- [ ] **`reducing access still needs no ballot`**; **`a reduce-only proposal is ACCESS_CHANGE_NOT_NEEDED`**; **`an access-change ballot can never back an invitation`** — gắn mã phiếu đổi quyền đã `approved` vào một lời mời bằng `h.operator` rồi `activate` → `TELEGRAM_APPROVAL_REQUIRED`.
- [ ] **`pending shows both kinds with frozen current and proposed grants; another tenant's project name stays hidden`**.
- [ ] `migrations-rollback` phủ 018; thêm ca **`rollback 018 refuses while an access-change ballot exists`**.
- [ ] `tests/outbox-crash.test.ts` (native) nhánh DM ở Task 6 chuyển xanh.

**Lệnh kiểm:** `npx vitest run tests/onboarding-feedback.test.ts tests/account-approval-dm.test.ts tests/access-change.test.ts tests/migrations-rollback.test.ts tests/identity.test.ts`; native lặp lại.

**Con trỏ:** brief `:104`, `:134`, `:137` (6) · OQ-12 (c) · `SPEC-007…:13`, `:33`, `:40`, `:41`, `:45` · OQ-29.

### Task 10: Handler web cho Inbox và lệnh đổi quyền — không review riêng

**Tệp:** tạo `src/server/inbox-http.ts`, `src/app/api/inbox/[[...path]]/route.ts`, `tests/inbox-http.test.ts`. `src/app/api/team/accounts/route.ts` không đổi (lệnh mới đi qua `AccountService.command`).

**Giao diện tạo ra:** `export async function handleInboxApi(request:Request,parts:string[],db:Database):Promise<Response>` — mẫu `src/server/documents-http.ts:22-51`: principal từ phiên, `checkOrigin` cho mọi method khác GET, `Idempotency-Key` từ header, `success`/`failure`.

| Method · đường | Gọi |
|---|---|
| `GET /api/inbox?projectId=…&state=…&limit=…&offset=…` | `InboxService.list` |
| `GET /api/inbox/sources?projectId=…` | `sources` |
| `GET /api/inbox/failures?projectId=…` | `failures` |
| `POST /api/inbox/failures/:outboxId/commands` | `failureCommand` |
| `GET /api/inbox/:candidateId` | `detail` |
| `POST /api/inbox/:candidateId/commands` | `command` |

**Ca kiểm viết trước** (`tests/inbox-http.test.ts`)
- [ ] **`inbox routes need a session, an exact origin and an idempotency key for writes`** — không cookie → 401; POST sai origin → 403; POST thiếu `Idempotency-Key` → 400 `IDEMPOTENCY_REQUIRED`.
- [ ] **`a body that names tenant, actor or project is rejected with INVALID_INPUT`** — `{kind:'confirm',expectedVersion:1,classification:'incident',tenantId:…}` → 422.
- [ ] **`round trip: list → detail → confirm → list shows the new state`**.
- [ ] **`unknown path, unknown candidate and a candidate outside scope answer the same 404`** — ba thân phản hồi giống hệt nhau trừ `requestId`.
- [ ] **`web routes expose no intake endpoint`** — `POST /api/inbox/events`, `POST /api/inbox/outbox/pull` → 404; không tệp nào dưới `src/app/api/inbox` nhập `bridge-io`.

**Lệnh kiểm:** `npx vitest run tests/inbox-http.test.ts tests/documents-http.test.ts`.

**Con trỏ:** brief `:9`, `:103` · `SPEC-009…:143`, `:145`.

### Task 11: `bot-plugin` — thu tin, hàng chờ cục bộ, tệp, kéo outbox, thẻ phiếu đổi quyền — **review riêng**

**Tệp:** sửa `bot-plugin/__init__.py`, `bot-plugin/plugin.yaml`, `tests/test_bot_bridge.py` (chỉ **thêm** ca; 11 ca hiện có giữ nguyên văn, kể cả `test_exact_sha_and_no_write_operations` và phép đếm `len(registered)==7`). Không cài plugin vào gateway. Không nhập, không sửa plugin priority1.

**Giao diện tạo ra**
```python
INTAKE_PATH = "/api/bridge/intake/events"; PULL_PATH = "/api/bridge/outbox/pull"; RECEIPT_PATH = "/api/bridge/outbox/receipts"
MAX_EVENT_BYTES = 16384; MAX_ATTACHMENT_BYTES = 20971520; ALLOWED_MIME = frozenset({...})   # đúng bảng Global Constraints
def call_backend(home, payload, *, path="/api/bridge", key_file="bridge.json"): ...   # chuỗi ký dùng đúng path; ENDPOINT gốc + path
def intake_event(event) -> dict | None      # None khi không phải tin nhóm Telegram của profile libetech, tin của bot, hoặc route bị từ chối
def fit_event(payload) -> dict              # cắt text tới khi JSON ≤ MAX_EVENT_BYTES, đặt textTruncated; contentHash tính trước khi cắt
def store_attachment(home, raw, download) -> dict   # {'state':'stored',locator,sha256,mimeType,sizeBytes,fileName} | {'state':'failed','reasonCode':...}
class Spool:  # home/runtime/libetech-ai-os/intake-spool.jsonl, quyền 0600, tối đa 1000 dòng
    def put(self, payload): ...; def drain(self, send) -> int: ...
def submit_event(home, payload, spool) -> dict     # gọi INTAKE_PATH; lỗi mạng/5xx → spool.put, trả {'ok': False, 'spooled': True}
class SendJournal:  # home/runtime/libetech-ai-os/send-journal.jsonl, 0600: 'sending' trước khi gửi, 'sent' + message id sau khi gửi
def render(template, params) -> str         # bốn mẫu; mẫu lạ → ValueError('TEMPLATE_UNKNOWN')
def drain_outbox(home, send, journal, *, limit=10) -> dict   # pull → mỗi delivery: journal 'sending' → send(chat_id, topic_id, reply_to, text) → journal 'sent' → báo biên nhận; xử lý danh sách reconcile theo journal
def approval_question(row) -> str           # thêm nhánh kind == 'access_change'
```
- Khoá của principal tiếp nhận nằm ở tệp riêng `runtime/libetech-ai-os/intake.json` (0600, không symlink), khác `bridge.json` của bot. Công cụ `libetech_os_read` và mọi lệnh hiện có chỉ dùng `bridge.json`.
- `intake_event` lấy chat/người gửi/message/topic/reply/media group/edit date/forward **từ đối tượng sự kiện của gateway**, không từ nội dung tin; `addressed` = tin là lệnh, nhắc tên bot hoặc trả lời bot; `chat_type` chỉ `group`/`supergroup`; `message_id`, `user_id` phải khớp mẫu số dương như `validated_context` (`bot-plugin/__init__.py:25-35`).
- `store_attachment`: quá `MAX_ATTACHMENT_BYTES` hoặc ngoài `ALLOWED_MIME` → không tải, trả `failed` với `reasonCode` `TOO_LARGE`/`UNSUPPORTED_TYPE`; tải lỗi hoặc `download is None` → `failed` `DOWNLOAD_UNAVAILABLE`; thành công → ghi `runtime/libetech-ai-os/attachments/<sha256>` (0600), `locator='gw://libetech/attachments/<sha256>'`. Không mở, không phân tích nội dung tệp.
- `drain_outbox` phân loại lỗi gửi: bot bị chặn/không còn trong nhóm/chat không tồn tại → `failed_permanent`; timeout sau khi đã gọi gửi → `uncertain`; lỗi kết nối trước khi gửi → `failed_retryable`. Danh sách `reconcile`: journal có `sent` → báo `phase='reconcile'`, `delivered` kèm message id; có `sending` mà không `sent` → **không** báo (giữ `uncertain` cho người xử lý); không có dòng nào → `not_sent`.
- Mẫu chữ: `intake.received` «Đã ghi nhận, mã {ref}. PM sẽ xác nhận loại và dự án; đây chưa phải việc đã giao.» · `intake.recovered` «Kết nối đã khôi phục. Tin lúc {observedAt} đã được ghi nhận, mã {ref}.» · `intake.attachment_failed` «Đã ghi nhận nội dung, mã {ref}, nhưng chưa lưu được tệp đính kèm. Vui lòng gửi lại tệp.» · `account_approval.pending` «Có phiếu Tech chờ anh/chị xác nhận. Gõ /duyet trong chat riêng này.» Không mẫu nào hứa hạn hoàn thành; thẻ DM không chứa mã phiếu (`DESIGN…:74`).
- `approval_question` với `kind='access_change'`: «Đổi quyền cho {person} ({username})?\nQuyền hiện tại: …\nQuyền sau khi đổi: …\nCăn cứ: {reason}\nChọn Yes hoặc No.»; `kind` lạ → `APPROVAL_INVALID`; thiếu `previous_grant_details` → `APPROVAL_SCOPE_UNAVAILABLE`.
- `register(ctx)`: chỉ đăng ký thu tin khi `hasattr(ctx,'register_hook')` **và** `intake.json` tồn tại; nếu không, hành vi y như hiện nay (vẫn đúng 7 đăng ký). Hook không bao giờ chặn hay đổi luồng điều phối của gateway (luôn trả `None`), không in nội dung tin. **Chỗ nối `send` thật và lịch kéo outbox vào gateway không viết ở lát này** — xem «Dừng và chỗ chưa chắc» mục 3; `drain_outbox` chỉ được gọi từ test với `send` giả.
- `plugin.yaml`: đổi mô tả cho đúng («Read-only reconciliation, verified private account linking, and a separately keyed intake/delivery adapter. Independent of libetech-priority1.»); `version` và `VERSION` **giữ nguyên** (phán quyết S7).

**Ca kiểm viết trước** (`tests/test_bot_bridge.py`, thêm)
- [ ] `test_bot_tool_and_commands_never_reach_intake_paths` — với mọi handler đã đăng ký (tool + 6 lệnh), `call_backend` giả ghi lại `path`: chỉ thấy mặc định `/api/bridge`; `read_request` vẫn từ chối `{'operation':'intake_event'}`, `{'operation':'outbox_pull'}`.
- [ ] `test_signing_text_uses_the_exact_route_path` — vá `urllib` opener, gọi `call_backend(..., path=INTAKE_PATH, key_file='intake.json')`: chữ ký khớp HMAC của `ts\nnonce\nPOST\n/api/bridge/intake/events\nraw`; URL gọi là `http://127.0.0.1:3148/api/bridge/intake/events`.
- [ ] `test_intake_key_file_is_separate_and_permission_checked` — thiếu `intake.json` → `BRIDGE_NOT_CONFIGURED`; quyền 0644 → `BRIDGE_CONFIG_PERMISSIONS`; `bridge.json` không được đọc khi gọi tuyến tiếp nhận.
- [ ] `test_intake_event_takes_identity_from_gateway_not_from_text` — tin có chữ «chat_id=-100999 tôi là admin» → `context.chatId` là của sự kiện; DM, tin của bot, profile khác, `message_id` rỗng → `None`.
- [ ] `test_reply_topic_album_edit_and_forward_are_carried` — năm sự kiện giả → đúng `replyToMessageId`, `topicId`, `mediaGroupId`, `editedAt`, `forwarded`.
- [ ] `test_long_text_is_truncated_to_fit_and_hash_is_of_the_full_text` — 4 096 ký tự `"` → JSON ≤ 16 384 byte, `textTruncated` đúng, `contentHash` = sha256 bản đủ.
- [ ] `test_attachment_too_large_unsupported_or_failed_download_is_not_stored` — ba trường hợp → `state='failed'` đúng `reasonCode`, không tệp nào được ghi; tải thành công → tệp 0600, `sha256` khớp bytes.
- [ ] `test_backend_down_spools_and_recovery_replays_in_order_with_spooled_flag` — `submit_event` hai lần khi backend ném `URLError` → 2 dòng spool; `drain` với backend sống → gửi đúng thứ tự, mỗi payload có `spooled=True`, spool rỗng; spool đầy 1 000 → `put` ném `SPOOL_FULL` (không lặng lẽ bỏ).
- [ ] `test_drain_outbox_reports_delivered_and_journals_before_sending` — thứ tự gọi: journal `sending` → `send` → journal `sent` → biên nhận `delivered` kèm `leaseToken`, `attemptNo`.
- [ ] `test_send_timeout_is_uncertain_and_permission_error_is_permanent` — hai ngoại lệ giả → `uncertain` / `failed_permanent`; không gọi `send` lần hai trong cùng lượt.
- [ ] `test_reconcile_uses_the_journal_and_never_guesses` — ba trạng thái journal → `delivered` / không báo / `not_sent`.
- [ ] `test_access_change_card_shows_current_and_proposed_grants_without_ids` và `test_unknown_ballot_kind_never_asks`.
- [ ] `test_group_old_card_and_cancel_record_no_vote` — `/duyet` trong nhóm → `PRIVATE_CHAT_REQUIRED`, không gọi backend; backend trả `APPROVAL_CLOSED` khi bấm thẻ cũ → trả mã lỗi, không ghi `recorded`; `ask_choice` trả `None` → dừng, không gọi `account_approval_vote`.
- [ ] `test_registration_without_hook_support_or_intake_key_stays_at_seven` và `test_hook_returns_none_and_never_raises`.

**Lệnh kiểm:** `python3 -m pytest tests/test_bot_bridge.py -q` → 11 ca cũ + ca mới đều đạt.

**Con trỏ:** brief `:101`, `:102`, `:104`, `:105-106`, `:112`, `:137` (5)(6), `:140` · OQ-08, OQ-10, OQ-11 · `SPEC-009…:27`, `:87`, `:147`, `:149` · `AGENTS.md:5`.

### Task 12: Màn Inbox, giao diện phiếu đổi quyền và đặc tả bàn giao — không review riêng

**Tệp:** tạo `src/app/inbox/page.tsx`, `src/app/inbox/loading.tsx`, `src/app/inbox/error.tsx`, `src/components/inbox.tsx`, `src/components/inbox-view.ts`, `tests/inbox-ui.test.tsx`, `docs/UI-HANDOFF-2-inbox.md`; sửa `src/components/workspace.tsx` (thêm liên kết «Inbox» cạnh liên kết Tài liệu), `src/components/team-accounts.tsx` (`:121` — khi mở rộng quyền hiện nút «Trình phiếu đổi quyền»), `src/components/approvals.tsx` (hiện loại phiếu và quyền hiện tại → quyền mới), `src/app/globals.css` (chỉ thêm lớp cho màn mới, dùng token sẵn có).

**Giao diện tạo ra**
```ts
// src/components/inbox-view.ts — hàm thuần cho test markup
export const statusLabel=(s:IntakeStatus)=>string;  // 'Đã ghi, chưa gửi' | 'Đang gửi' | 'Đã gửi tới nhóm' | 'Chưa rõ đã gửi hay chưa — đang đối soát' | 'Không gửi được' ; kèm ' · người nhận đã xác nhận' khi có acknowledgedAt
export const variantOf=(c:CandidateCard)=>'incident'|'request'|'document'|'unclassified';
export const primaryAction=(c:CandidateCard,canAct:boolean)=>'Xác nhận yêu cầu'|'Bổ sung thông tin'|null;
// src/components/inbox.tsx
export function Inbox(props:{projects:{id:string;name:string}[];projectId:string|null;initial:{items:CandidateCard[];total:number}|null;sources:SourceAvailabilityRow[];failures:FailureRow[];denied:boolean;canAct:boolean}):JSX.Element;
export function IntakeCard(props:{card:CandidateCard;canAct:boolean;onCommand:(cmd:unknown)=>Promise<void>}):JSX.Element;
```
- `page.tsx` theo mẫu `src/app/documents/page.tsx`: `pagePrincipal()`; `projectId` từ query; dự án ngoài quyền → `<Inbox denied …>` không tên, không số đếm; danh sách dự án chỉ gồm dự án được phép và có vai đọc Inbox; một dự án thì tự chuyển hướng.
- IntakeCard ba biến thể (`DESIGN…:48-54`): incident hiện «Ảnh hưởng / khôi phục» từ `note`; request hiện «Cần làm rõ» từ `missingFields`; document hiện «Đăng ký nguồn» kèm liên kết sang `/documents?projectId=…`. Chưa phân loại: ba nút chọn loại — **người chọn**, không có gợi ý tự động. Gộp trùng phải hiện đối tượng (`ref`) và căn cứ (`reason`).
- (Sửa 14/11/2026, OQ-30 (b)) Chế độ hiển thị tính theo từng bản sửa: `excerpt` (hiện chữ) · `hidden` (bản sửa có chữ nhưng cấu hình hiện tại không còn cho phép: hiện «Nội dung đang ẩn theo cấu hình hiện tại. Mở tin gốc trong Telegram» + `sourceRef`) · `pointer_only`.
- `content_mode='pointer_only'`: không hiện nội dung; hiện «Chỉ giữ con trỏ và hash. Mở tin gốc trong Telegram» + `sourceRef`. Hash tệp hiện kèm chữ «do gateway khai», không biểu tượng đã kiểm.
- Bốn trạng thái: rỗng («Chưa có tin nào được tiếp nhận cho dự án này», khác hẳn câu bị chặn) · lỗi (`role="alert"`, nút thử lại, giữ lựa chọn đang nhập) · đang tải (`aria-busy`, skeleton, không hiện số 0 giả) · không có quyền («Anh/chị chưa có quyền xem Inbox của dự án này», không lộ tên). Xung đột version: «Mục này vừa được người khác cập nhật. Tải lại để xem bản mới.»
- 360px không cuộn ngang; SHA, mã, URL `overflow-wrap:anywhere`; mọi nút và liên kết hành động ≥ 44×44; thành công báo qua vùng `role="status"`; không dùng màu làm tín hiệu duy nhất.
- `docs/UI-HANDOFF-2-inbox.md` đủ sáu mục theo khuôn `docs/UI-HANDOFF-1-documents.md`: 1 Bố cục · 2 Token · 3 Props thành phần · 4 Trạng thái · 5 Breakpoint (700/950/1200) · 6 Edge case (tin chỉ có tệp; tin forward; album thiếu phần; nội dung chỉ con trỏ; nhóm chưa có tin; outbox `uncertain`/`dead`; ứng viên trùng; chữ dài không dấu cách), kèm mục «Kiểm tay» và «Việc chưa làm» (đo contrast, zoom 200%, screen reader).

**Ca kiểm viết trước** (`tests/inbox-ui.test.tsx`, render tĩnh như `tests/documents-ui.test.tsx`)
- [ ] **`renders the four states: empty, error, loading and denied, with different wording for empty and denied`**.
- [ ] **`IntakeCard renders incident, request and document variants and an unclassified card with three human choices`**.
- [ ] **`the project picker lists only permitted projects and the denied view leaks no name or count`**.
- [ ] **`a new group shows Chưa xác minh khả năng nhận tin and never Đã kết nối đầy đủ`**.
- [ ] **`PM-07 a persisted but undelivered receipt reads Đã ghi, chưa gửi`** — và `statusLabel` cho sáu trạng thái outbox; không nhãn nào chứa «Đã gửi» khi `deliveredAt` rỗng.
- [ ] **`pointer-only cards show no message text`**; **`gateway-declared hashes are never shown as verified`**.
- [ ] **`a viewer of the card without manager role sees no action button, with the reason`**.
- [ ] **`approvals show the ballot kind and current → proposed grants`**; **`team accounts offer Trình phiếu đổi quyền only when access expands`**.

**Lệnh kiểm:** `npx vitest run tests/inbox-ui.test.tsx tests/documents-ui.test.tsx`; `npm run build` có `/inbox` và `/api/inbox/[[...path]]`, `/api/bridge/[...path]`. Kiểm tay 360×740 và 1280×800 do phiên điều phối làm (R2 của lát 1).

**Con trỏ:** brief `:13`, `:139-140` · `DESIGN…:13-23`, `:48-54`, `:74`, `:82-99`, `:103` · `HANDOFF…:90`.

### Task 13: Số đo SLO thử và kiểm toàn bộ — không review riêng

**Tệp:** tạo `tests/intake-slo.test.ts`; sửa `vitest.config.ts` (thêm `src/server/intake.ts`, `intake-rules.ts`, `outbox.ts`, `bridge-auth.ts`, `bridge-config.ts`, `bridge-io.ts`, `ledger-reconcile.ts`, `account-approval.ts`, `inbox-http.ts` vào `coverage.include`).

**Ca kiểm**
- [ ] `tests/intake-slo.test.ts`, `describe.skipIf(!native)`: **`SLO probe on synthetic data (a measurement, not a commitment)`** — 200 sự kiện tổng hợp qua `ingest`; một vòng `pull` → `report(delivered)` giả lập; in **một** dòng JSON `{"slo_probe":{"events":200,"persist_ms_p50":…,"persist_ms_p95":…,"persist_to_receipt_queued_ms_p95":…,"persist_to_delivered_simulated_ms_p95":…,"projection":"not_measured: no intake projection in slice 2","overdue_listed_after_s":600}}`; chỉ khẳng định lỏng: p95 từ lưu tới có dòng outbox < 30 000 ms; dòng `pending` bị dời `created_at` về 11 phút trước xuất hiện trong `failures` với `overdue=true`. Không khẳng định gì về runtime thật.
- [ ] `npm run test` (PGlite) — 0 ca đỏ; ghi số ca bỏ qua (chỉ các khối native).
- [ ] `set -a; . "$SLICE2_ENV_FILE"; set +a; npx vitest run --reporter=verbose` — 0 ca bỏ qua; lưu log đã che URL.
- [ ] `npx vitest run --coverage` — ngưỡng 60 đạt với danh sách tệp mới.
- [ ] Xoá `.next/types/* 2.ts` nếu có, rồi `npm run typecheck`.
- [ ] `rm -rf .next && npm run build`.
- [ ] `python3 -m pytest tests/test_bot_bridge.py -q`.
- [ ] `git grep -nE -- '-100[0-9]{7,}' -- src tests migrations bot-plugin scripts` chỉ ra chat id tổng hợp `-100000000000x`; `git grep -n "priority1" -- src bot-plugin/__init__.py migrations` không có dòng nhập mã; `git status --short` không có `data/`, `.next/`, tệp env.

**Bảng ca → test (để phiên điều phối chép vào biên nhận)**

| Ca | Test | Ghi chú mức |
|---|---|---|
| DOC-01 | `intake` «DOC-01 …», «intake authority comes from chatScopes…» | Mức mã; nhóm thật chưa mapping là kiểm runtime |
| DOC-02, 03, 04, 16 | `intake` các ca cùng tên; `test_bot_bridge` các ca reply/topic/album/tệp | Mức mã |
| DOC-12 | `outbox` «DOC-12 …»; `test_backend_down_spools_and_recovery_replays…`; `outbox-crash` (native) | Mức mã |
| PM-03 | `intake` «(4) …», `outbox` «PM-03 …» | Mức mã |
| PM-07 | `outbox` «PM-07 …», `inbox-service` «PM-07 reopening…», `inbox-ui` «PM-07 …» | Mức mã |
| Đối soát hai kho | `ledger-reconcile` sáu ca | Mục (2) OQ-09 trên dữ liệu tổng hợp; nạp sổ thật dừng ở OQ-26 |
| SPEC-007 | 9 ca cũ + `account-approval-dm` + `access-change` | Ca (c) UAT thật: **không** tính |
| Quyền âm (1)–(7) | (1)(7) `bridge-io`; (2) `intake`, `inbox-http`; (3) `outbox-schema`, `outbox`, `inbox-service`; (4) `intake`; (5) `inbox-service`, `intake-schema`, `test_bot_bridge`; (6) `account-approval-dm`, `test_bot_bridge` | (7) phần proxy thật là runtime |
| PM-01 (phần đọc) | không có test | **Không coi đạt**: chưa đọc được tin gốc và ticket Xeca |
| XI-01, XI-07 | không có test | Ca thật trên runtime, tính ở mức «đã dùng thật» |
| SLO thử | `intake-slo` (native) | Số đo trên dữ liệu tổng hợp, không phải cam kết |

---

## Dừng và chỗ chưa chắc

**Điểm dừng của lát (không làm, chờ Chairman):**
1. **OQ-09 mục (1)** — chứng minh trên đường nhận thật rằng tin nhóm tới được `bot-plugin` của repo này song song với priority1. Cần cài plugin, khởi động lại gateway và một tin thật ⇒ ngoài mức «đã có mã». Chưa đạt thì **ProjectChannel không được kích hoạt** và bốn dòng `AGENTS.md` ở gói quyết định §5 chưa áp.
2. **SPEC-007 ca (c)** — UAT thật hai người bỏ phiếu. Không tính vào «đã có mã».
3. **Nối `send` thật và lịch kéo outbox trong gateway.** Repo này không có tài liệu API của gateway cho việc gửi chủ động hay hẹn giờ; các điểm nối thấy được khi đọc mã plugin priority1 (`register_hook`, `register_platform_handler`) chưa được xác minh cho plugin thứ hai. Task 11 viết phần thuần và kiểm bằng `send` giả; chỗ nối thật làm cùng đợt runtime của mục 1.
4. Triển khai d1-ai1; áp 016–018 lên dữ liệu thật; cấp mật khẩu cho login `libetech_intake_svc`, cấp `intake.key`, đặt `INTAKE_DATABASE_URL`; sửa proxy; cài plugin; gửi tin vào nhóm hoặc DM thật; đổi privacy mode; sửa `AGENTS.md`.
5. **Mục 8 của brief (kích hoạt ProjectChannel): không làm, không expand.** Nguồn hiệu lực vẫn là `chatScopes`; có test khẳng định (Task 4).

**Dừng theo câu hỏi mở mới (phần còn lại vẫn làm đủ):**
*Chairman đã quyết OQ-26…29 ngày 14/11/2026 (`docs/OPEN-QUESTIONS.md`). Bốn dòng dưới thay bốn dòng giữ chỗ lúc lập kế hoạch.*
- **OQ-26** — quyết định (c) «Chỉ đối soát tổng hợp». Task 8 giữ nguyên. Không viết mã nạp sổ ticket thật. Đối soát thật làm tay ở đợt runtime bằng hai bản kê hai bên tự xuất; đó là điểm dừng.
- **OQ-27** — quyết định (a) «Chỉ nhóm một dự án». Nhóm gắn từ hai dự án bị từ chối `INTAKE_PROJECT_AMBIGUOUS`, không lưu gì, cho tới khi tách cấu hình.
- **OQ-28** — quyết định (c) «Khai theo từng nhóm». Cờ `intake.excerptChats` trong cấu hình vận hành; nhóm không cờ và dự án `IBS_HI` chỉ giữ con trỏ + hash (cách hiểu chờ xác nhận). Giá trị cờ cho nhóm thật là điểm dừng triển khai.
- **OQ-29** — Chairman tự gõ «1 thành viên BOM». Phiếu đổi quyền đủ khi một BoM đã đóng băng đồng ý, không cần phiếu Chairman; ba cách hiểu fail-closed của phiên điều phối và S13 chờ xác nhận trước khi dùng cho người thật.

**Chỗ chưa chắc, cần phiên điều phối hoặc reviewer quyết:**
1. **Trần kích thước và danh sách loại tệp** (bảng ở Global Constraints) là đề xuất kỹ thuật, chưa là chính sách.
2. **Login DB thứ ba** `libetech_intake_svc` và biến `INTAKE_DATABASE_URL`: chọn để không đổi quyền của `libetech_web` (tiền lệ OQ-22). Hệ quả: thêm một thông tin đăng nhập phải cấp khi triển khai. Test không cần biến môi trường mới (dùng `h.operator` rồi `SET LOCAL ROLE`).
3. **`quality_score` thang 0–100 số nguyên** theo E-EXT-01, trong khi các bảng cũ dùng `numeric(3,2)` 0–1 (`migrations/001…:42`, `014…:35`). Công thức điểm ở Task 4 chưa được khai trong `AGENTS.md` (E-EXT-01 đòi khai; sửa `AGENTS.md` là điểm dừng).
4. **Trạng thái «projected» luôn rỗng** ở lát này: chưa có bản chiếu Z2 cho intake (báo cáo thuộc lát 4). SLO «bản chiếu trong 5 phút» vì vậy không đo được; Task 13 ghi rõ.
5. **Ai được đọc Inbox:** kế hoạch chặn `viewer` (thường là khách) và `bot`; chỉ `manager` thao tác. SPEC không nêu vai đọc.
6. **Biên nhận chỉ gửi cho tin gọi bot** (`addressed`), tin khác vẫn lưu nhưng không trả lời, để tránh trả lời mọi tin trong nhóm. Chế độ nhận của nhóm (`command_reply`/`active`) nằm ở ProjectChannel, chưa có hiệu lực.
7. **Xác nhận của người nhận** chỉ có cho DM duyệt tài khoản (người nhận bỏ phiếu). Biên nhận nhóm chưa có cơ chế xác nhận; cột luôn rỗng.
8. **Số bản plugin:** OQ-03 để lệch `0.3.0`/`0.2.1` là tồn đọng; lát này đã sửa plugin nên đề xuất đặt cả hai `0.4.0`. Nếu không muốn đổi số bản trước đợt cài, giữ nguyên và chỉ sửa mô tả.
9. **Migration 018 nới `registration_id` thành được rỗng** trên bảng `identity.account_approvals` đã có dữ liệu thật ở d1-ai1 (hai phiếu chưa bỏ, `SPEC-007…:3`). Thay đổi chỉ thêm và nới, mã cũ vẫn chạy; phương án khác là ba bảng riêng cho phiếu đổi quyền (không đụng bảng cũ, đổi lại phải nhân đôi mã bỏ phiếu).
10. **Khoá lặp cho thao tác của PM** dùng `deduplicate` theo dự án (như việc), không theo cách OQ-24 (b) vốn chỉ áp cho tài liệu.
11. **Cảnh báo outbox quá 10 phút** chỉ hiện trong hàng lỗi của Inbox; chưa gửi cảnh báo cho người vận hành (gửi thật là điểm dừng).
12. **Chữ của tin vẫn đi qua yêu cầu** tới AI OS cả khi dự án ở chế độ chỉ con trỏ; AI OS bỏ trước khi ghi và không log. Gateway không biết nhãn miền nên không tự bỏ được.
13. Chưa có đường ghi `project_domain_mappings` (lát 1 không cấp INSERT). Cho tới khi có, mọi dự án thật ở «Chưa xác nhận» ⇒ theo giữ chỗ OQ-28 mọi tin thật chỉ giữ con trỏ. *(Sửa 14/11/2026: sau quyết định OQ-28 (c), việc lưu trích theo cờ của nhóm, không theo ánh xạ; ánh xạ chỉ còn dùng để chặn `IBS_HI`.)*
14. `SPEC-008…:116` nói «bản nội dung đã lọc» nhưng không nêu luật lọc; `redactSecrets` ở Task 4 là mức tối thiểu do kế hoạch đề xuất.

## Phán quyết của phiên lát 2, 13/11/2026 (không phải quyết định của Chairman)

Các mục dưới trả lời phần «Chỗ chưa chắc» ở trên. Không mục nào thay quyết định của Chairman. OQ-26…29 được Chairman quyết ngày 14/11/2026 (`docs/OPEN-QUESTIONS.md`); các phán quyết S1–S15 và các cách hiểu kèm quyết định vẫn được trình trong báo cáo cuối lát. OQ-30 được quyết cùng ngày.

- **S1 · Login thứ ba** (chỗ chưa chắc 2): chấp nhận `libetech_intake_svc` + `INTAKE_DATABASE_URL`. Lý do: không cấp role nào cho `libetech_web` (tiền lệ OQ-22). Cấp mật khẩu, đặt biến và tệp `intake.json` là điểm dừng triển khai.
- **S2 · Migration 018** (chỗ chưa chắc 9): chấp nhận mở rộng `identity.account_approvals` theo kiểu expand (thêm cột, nới `registration_id`) để dùng lại một hàm đếm phiếu. `liberico-database-reviewer` kiểm riêng phần này. Tệp lùi từ chối khi còn dòng `access_change`.
- **S3 · `quality_score`** (chỗ chưa chắc 3): bảng mới dùng `smallint` 0–100 theo E-EXT-01. Công thức là hợp đồng dữ liệu của lát này: `source_events` theo `qualityScore` ở Task 4; `delivery_receipts` 100 cho `send`, 60 cho `reconcile` (Task 6). Biên nhận chép lại công thức. Không sửa `AGENTS.md` (R10).
- **S4 · «projected»** (chỗ chưa chắc 4): luôn rỗng; số đo SLO ghi `not_measured`.
- **S5 · Vai đọc Inbox** (chỗ chưa chắc 5): giữ theo kế hoạch như hành vi giữ chỗ. Đọc: `manager`, `engineer`, `technical`, `business`. Chặn `viewer` và `bot`. Thao tác: chỉ `manager`. Trình Chairman trong báo cáo.
- **S6 · Biên nhận chỉ cho tin gọi bot** (chỗ chưa chắc 6): chấp nhận.
- **S7 · Số bản plugin** (chỗ chưa chắc 8): **giữ nguyên** `VERSION = "0.3.0"` và `plugin.yaml` `version: "0.2.1"`, theo quyết định OQ-03 (b) («giữ nguyên»). Chỉ sửa mô tả `plugin.yaml` cho đúng hành vi mới. Đặt số bản mới thuộc đợt cài plugin (điểm dừng); biên nhận ghi rõ là mã plugin đổi nhưng số bản chưa đổi. Task 11 bỏ phần «`version` và `VERSION` cùng đặt `0.4.0`».
- **S8 · Mã plugin priority1**: không chép mã hay mã nhóm nào. Việc plugin đó có một mã nhóm thật viết cứng nằm ngoài repo này; biên nhận ghi ở mục ngoài phạm vi.
- **S9 · Khoá lặp thao tác PM** (chỗ chưa chắc 10): chấp nhận `deduplicate` theo dự án.
- **S10 · Chữ đi qua yêu cầu khi chỉ con trỏ** (chỗ chưa chắc 12): chấp nhận. Task 4 thêm ca khẳng định chữ không được ghi vào bảng nào và không xuất hiện trong log khi `content_mode='pointer_only'`. *(Sửa 14/11/2026: sau OQ-30 (b) bất biến này tính theo từng bản sửa và được DB ép bằng CHECK.)*
- **S11 · Review riêng**: gộp thành bốn lượt thay vì bảy — sau Task 4 (016 + cầu nối + ingest), sau Task 6 (017 + outbox), sau Task 9 (018 + SPEC-007), sau Task 11 (plugin). Tầng 1 toàn nhánh vẫn là lưới chính (bài học token lát 1).
- **S12 · Builder không commit**: phiên điều phối commit sau mỗi lượt review.
- **S13 · Phiếu của Chairman trên phiếu đổi quyền** (thêm 14/11/2026, sau quyết định OQ-29): Chairman vẫn nằm trong danh sách ghế đóng băng như trước (`validSeats` không đổi, nên vẫn cần Chairman đã ghép Telegram để mở phiếu). Phiếu đồng ý của Chairman không được tính; phiếu từ chối của Chairman đóng phiếu, vì Chairman là người đề xuất. Lý do: quyết định chỉ nói phiếu đủ khi có một BoM, không nói phiếu Chairman làm gì; đọc theo hướng chặt. Nếu sai: Chairman muốn từ chối mà không đóng được, hoặc muốn bỏ Chairman khỏi danh sách nhận DM; cả hai chỉ sửa hàm đếm hoặc chỗ chèn voters.
- **S15 · Thiết kế cho OQ-30 (b)** (thêm 14/11/2026, sau quyết định OQ-30): `content_mode` chuyển xuống `source_event_revisions`, kèm CHECK «bản chỉ con trỏ không mang chữ»; **bỏ** cột ở `source_events` để không chỗ nào dùng nhầm. Inbox tính chế độ hiển thị theo từng bản sửa từ dòng bản sửa và cấu hình hiện tại: `excerpt` · `hidden` · `pointer_only`. Danh sách cờ lấy từ cấu hình vận hành qua `currentExcerptChats()`; cấu hình thiếu hoặc hỏng = không nhóm nào (ẩn hết). Trạng thái `hidden` có câu riêng trên giao diện, vì chữ vẫn còn trong bảng chứ không phải chưa từng lưu. Lý do: quyết định nêu «sửa schema 016 và mọi chỗ đọc» và «Inbox ẩn theo cấu hình hiện tại». Nếu sai: sửa kiểu hợp và một nhánh giao diện; thủ tục xoá/che có người duyệt là việc của lát sau.
- **S14 · Hình dạng cờ lưu trích** (thêm 14/11/2026, sau quyết định OQ-28): `intake.excerptChats`, một danh sách mã nhóm ⊆ `intake.chats`, thêm vào cấu hình cũ mà không đổi trường nào đã có. Lý do: cùng chỗ với `chatScopes` và `intake.chats` như phiên điều phối yêu cầu; thiếu trường = không nhóm nào. Nếu sai: đổi thành bảng theo nhóm chỉ chạm `bridge-config.ts` và chỗ dựng `IntakeService`.
