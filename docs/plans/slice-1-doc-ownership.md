# Lát 1 · P1.0 — Sổ dự án, kênh nhóm đề xuất, sổ tài liệu, mẫu T0–T6 — Kế hoạch triển khai

> **Cho agent thực thi:** làm lần lượt từng task theo `superpowers:subagent-driven-development` (khuyến nghị) hoặc `superpowers:executing-plans`. Các bước dùng ô `- [ ]`. Mỗi task theo nhịp: viết ca kiểm → chạy thấy đỏ đúng lý do → viết mã tối thiểu → chạy xanh. Kế hoạch **không** gồm commit/push/PR, review Codex, biên nhận `DELIVERY-010`, cập nhật roadmap — phiên điều phối làm.

Version 0.1 · 12/11/2026 · Lập bởi agent `planner` · Nhánh `slice-1-doc-ownership`, base `libetech-ai-os` @ `208d37b`.

**Mục tiêu:** AI OS có sổ dự án mở rộng, ánh xạ nhóm Telegram → dự án ở trạng thái đề xuất, sổ tài liệu (một nguồn chính, revision bất biến có hash kèm mức xác minh, hai con trỏ «bản đang soạn» / «bản chuẩn» tách riêng), chỉ mục mẫu T0–T6, chỉ mục tìm kiếm Z2 có quyền, màn Tài liệu dự án; kèm hai việc còn lại của R-01 và việc nhãn/số bản (OQ-03 b).

**Kiến trúc:** handler mỏng → domain service → truy vấn trong `scoped()` (`src/server/db.ts:33-39`). Ghi Z1 qua `deduplicate` (`src/server/service.ts:57-70`) + `expectedVersion` + sự kiện audit bất biến. Tìm/xuất đọc bảng chiếu `analytics.document_index` do projector có tên ghi. Migration 013–015, mỗi tệp có tệp lùi cùng số ở `migrations/rollback/`.

**Công nghệ:** TypeScript, Next.js App Router, PostgreSQL SQL, `pg.Pool`, PGlite (test một kết nối), zod, vitest. Không thêm dependency.

**Căn cứ:** `docs/SLICE-BRIEFS.md:1-86` · `docs/DECISION-PACK-OQ-20261112.md` (bảng chốt, §3, §4) · `docs/ADR-002-project-document-ownership.md` 1.1 (Accepted) · `docs/OPEN-QUESTIONS.md` (OQ-03…07, 11, 20, 21 và mới: OQ-22, 23, 24) · `docs/reviews/CODEX-STEP0-P1-READINESS-20261112.md` (R-01 `:12-19`, R-02 `:21-27`, bộ nhận bàn giao `:108`) · `docs/reviews/REVIEW-R01-fix-feedback-20261112.md` («Còn lại») · `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md` theo dòng · `docs/PM-DOCUMENT-TEMPLATES.md` · `docs/DESIGN-SYSTEM-PM-DOCUMENTS.md`.

**Con trỏ brief đã kiểm lại ngày 12/11 tại `208d37b`:** mọi con trỏ mã của brief lát 1 còn đúng, trừ `src/server/feedback.ts:46-52` — sau PR #2 `resolve()` là `:41-75` (tra hành động cũ `:46-54`, khoá report `:55-57`, INSERT hành động `:65-72`); `create()` vẫn `:23-40`.

## Global Constraints

Mọi task mặc nhiên phải thoả các dòng dưới.

**Migration**
- Số 013, 014, 015; tệp trực tiếp trong `migrations/`; bọc `BEGIN; … COMMIT;`; mọi `CREATE` có `IF NOT EXISTS`; policy/trigger tạo theo cặp `DROP … IF EXISTS` rồi `CREATE`; dòng cuối trước `COMMIT`: `INSERT INTO schema_migrations(version) VALUES('01x') ON CONFLICT(version) DO NOTHING;`. Chạy hai lần liên tiếp không lỗi, không sinh dòng trùng.
- Mỗi bảng: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at`/`updated_at timestamptz NOT NULL DEFAULT now()`, `tenant_id uuid NOT NULL`, `project_id uuid NOT NULL` (trừ `document_templates`: chỉ tenant), khoá ngoại theo phạm vi `FOREIGN KEY(project_id,tenant_id) REFERENCES projects(id,tenant_id)`; index cho mọi FK và `created_at` **cùng tệp**. Không cột tiền, không `SERIAL`, không `timestamp` thiếu múi giờ.
- RLS: `ENABLE` + `FORCE ROW LEVEL SECURITY`; policy có **cả `USING` và `WITH CHECK`** theo mẫu `migrations/011_team_source_catalog.sql:31-38`; ngữ cảnh đọc bằng `current_setting('app.tenant_id',true)` / `current_setting('app.project_ids',true)`, thiếu ngữ cảnh → không dòng nào (fail-closed). Ngữ cảnh chỉ đặt bằng `set_config(...,true)` trong transaction (`src/server/db.ts:37`).
- Bảng lịch sử gắn trigger `reject_history_mutation()` (`migrations/001_foundation.sql:90-95`) chặn UPDATE/DELETE.
- Rollback (OQ-20): tệp cùng tên ở `migrations/rollback/` (runner không quét: `scripts/migrate.ts:12`, `src/server/db.ts:11`); `BEGIN…COMMIT`, `IF EXISTS`, xoá dòng `schema_migrations` của chính nó; **không** viết bù cho 001–012; chỉ chạy trên bản sao qua test, không bao giờ trên DB thật.
- Không sửa cột/bảng cũ (`projects`, `commands`, `audit_events`…). Quy tắc nghiệp vụ ở tầng ứng dụng; `CHECK` chỉ cho toàn vẹn dữ liệu và tập nhãn đóng.

**Ghi và quyền**
- Không nhận actor/tenant từ thân yêu cầu (`AGENTS.md:13`): mọi schema zod `.strict()`, định danh lấy từ `Principal` của phiên.
- Bot principal chỉ đọc; ở lát này bot không đọc, không ghi sổ tài liệu và sổ dự án.
- Mọi ghi: một transaction trong `scoped()`, `expectedVersion`, sự kiện audit bất biến trong cùng transaction; ghi thất bại không để lại audit hay đổi version.
- Chống lặp: UNIQUE ở DB + `INSERT … ON CONFLICT … DO NOTHING`, cấm SELECT-rồi-INSERT (E-BE-08). Thao tác tài liệu/sổ dự án đi qua `deduplicate` với dấu vân tay = tên thao tác + mã đối tượng + revision + `expectedVersion` + nội dung đã parse. **Không** sao chép cách replay của `FeedbackService.resolve()`.
- Lỗi theo `SPEC-009…:147`: `SCOPE_DENIED`, `REVISION_CONFLICT`, `SOURCE_UNAVAILABLE`, `SOURCE_NOT_FROZEN`. Lỗi không chứa tên, tiêu đề hay số đếm ngoài quyền; «không tồn tại» và «ngoài phạm vi» trả cùng một câu.
- Danh sách có `LIMIT` (mặc định 50, trần 200) và `total` trong phạm vi được cấp.

**Dữ liệu**
- Mã, migration, seed, fixture **không** chứa dòng ánh xạ miền báo cáo cho dự án thật, kể cả LibeTech nội bộ (OQ-04). Fixture chỉ ánh xạ dự án tổng hợp của `src/server/identities.ts`.
- Ba nhãn `LIBERICO_BU` · `XECA` · `IBS_HI` là nhãn miền báo cáo, không phải tenant/BU/pháp nhân; thiếu ánh xạ hiện «Chưa xác nhận», không vào tổng nào.
- IBS HI (và mọi dự án ở lát này): chỉ con trỏ, hash, metadata. Không cột nội dung, không snapshot; `snapshot_ref` luôn rỗng.
- Hash chỉ ở mức `self_declared` («tự khai»); giao diện không hiện như đã kiểm. Mọi tài liệu ở `SOURCE_NOT_FROZEN`; không chỗ nào hiện «đã duyệt». `approved_revision_id` luôn rỗng → «Chưa có»; không tạo bản duyệt thật (OQ-05 a).
- Liên kết dòng nguồn giữ `source_ref` Z2 với nhãn «chưa đối soát»; không tạo Z1 work item (OQ-06). Không sửa Sheet, không đổi `analytics.tech_source_tasks`.
- `project_channels` chỉ ở `proposed`, không cấp quyền; `chatScopes` của gateway vẫn là nguồn hiệu lực (OQ-11).
- Test chỉ dùng dữ liệu tổng hợp. Ca XECA005/006 được phép xanh trên dữ liệu tổng hợp; biên nhận ghi «chờ tin gốc», không ghi «đạt».

**Hạ tầng test**
- Mọi ca chạm DB chạy trên **cả** PGlite và PostgreSQL thật qua `tests/slice1-db.ts` (Task 1). PGlite chỉ có một kết nối nên **không** chạy được ca đồng thời: các ca đó `describe.skipIf(!native)` và biên nhận phải kèm output chạy native.
- PostgreSQL thật: container `libetech-slice1-pg`, `postgres:16`, chỉ nghe `127.0.0.1:55471`. Biến môi trường: `SLICE1_TEST_DATABASE_URL` (login quản trị), `SLICE1_WEB_DATABASE_URL` (login `libetech_web`), `SLICE1_ADMIN_DATABASE_URL` (chỉ cho script chuẩn bị). Giá trị và mật khẩu nằm trong tệp env ngoài repo của phiên điều phối (`$SLICE1_ENV_FILE`); **không** ghi vào repo, log hay biên nhận.
- Không gọi d1-ai1, không dùng `DATABASE_URL`/`MIGRATION_DATABASE_URL` thật, không đụng `bot-plugin/`, không sửa `AGENTS.md`.

## Review Focus

1. **URI nguồn dị dạng hoặc trùng trá hình** — `http://`, có `user:pass@`, khoảng trắng đầu/cuối, cùng URI đăng ký hai lần: người dùng chờ lỗi rõ, không sinh hai record. Ca ở Task 9.
2. **Chuỗi tìm chứa `%`, `_`, `\`, tiếng Việt có dấu, hoa/thường** — chờ khớp theo nghĩa đen, không thành ký tự đại diện, không lỗi 500. Ca ở Task 12.
3. **Ô CSV bắt đầu bằng `=`, `+`, `-`, `@`, có dấu phẩy/ngoặc kép/xuống dòng** — chờ tệp mở bằng bảng tính không chạy công thức và không lệch cột. Ca ở Task 12.
4. **Chỉ mục Z2 cũ hơn Z1** (vừa thêm revision, projector chưa chạy) — chờ danh sách ghi rõ thời điểm chiếu, không hiện số revision sai như dữ liệu mới. Ca ở Task 11 và Task 15.
5. **Hai người cùng đề xuất revision trên cùng version** — chờ đúng một revision mới, người kia nhận `REVISION_CONFLICT`, không mất số revision. Ca ở Task 10 (native).

## Bản đồ tệp

| Tệp | Trách nhiệm | Task |
|---|---|---|
| `tests/slice1-db.ts`, `tests/slice1-fixtures.ts` | Mở PGlite hoặc PostgreSQL thật có guard; principal và dữ liệu tổng hợp | 1 |
| `scripts/slice1-native-prepare.ts` | Tạo DB cô lập `slice1_verify_<n>` trên `127.0.0.1:55471` | 1 |
| `src/server/feedback.ts` | Hai việc còn lại của R-01 | 2, 3 |
| `src/server/version.ts`, `src/server/integration-status.ts` | Một nguồn số bản; ba trạng thái cầu nối | 4, 5 |
| `docs/templates/T0…T6-*.md`, `docs/templates/manifest.json` | Mẫu có version + hash | 6 |
| `migrations/013_project_registry.sql` (+ `rollback/`) | Hồ sơ dự án, kênh đề xuất, ánh xạ miền rỗng, sổ sự kiện | 7 |
| `src/server/projects-registry.ts` | Service sổ dự án | 8 |
| `migrations/014_document_registry.sql` (+ `rollback/`), `src/server/document-templates.ts` | Record, revision, chỉ mục mẫu | 9 |
| `src/server/documents.ts` | Đăng ký, đề xuất revision, chi tiết, mở nguồn | 9, 10, 13 |
| `migrations/015_document_index_z2.sql` (+ `rollback/`), `src/server/document-projector.ts` | Bảng chiếu Z2 và projector | 11 |
| `src/server/document-index.ts` | Danh sách, tìm, xuất từ Z2 | 12 |
| `src/server/documents-http.ts`, `src/app/api/documents/[[...path]]/route.ts`, `src/app/api/projects/[...path]/route.ts` | Handler mỏng | 14 |
| `src/app/documents/{page,loading,error}.tsx`, `src/components/documents.tsx`, `src/components/documents-view.ts`, `docs/UI-HANDOFF-1-documents.md` | Màn Tài liệu dự án | 15 |
| `src/server/types.ts` | Thêm kiểu mới, không đổi kiểu cũ | 8, 9, 11 |

---

### Task 1: Hạ tầng test hai động cơ (PGlite và PostgreSQL thật)

**Mục tiêu:** một điểm mở DB dùng chung cho cả lát, có guard chống trỏ nhầm DB, tự áp migration còn thiếu, có lối chạy SQL thô (cho tệp lùi) và công cụ chờ khoá (cho ca đồng thời).

**Tệp:** tạo `tests/slice1-db.ts`, `tests/slice1-fixtures.ts`, `tests/slice1-harness.test.ts`, `scripts/slice1-native-prepare.ts`.

**Giao diện tạo ra**
```ts
// tests/slice1-db.ts
export type Harness={operator:Database; db:Database; native:boolean; exec(sql:string):Promise<void>; reset():Promise<void>; close():Promise<void>};
export const native:boolean;                       // Boolean(process.env.SLICE1_TEST_DATABASE_URL)
export function assertIsolated(testUrl:string,webUrl?:string):void;
export async function openHarness():Promise<Harness>;
export async function waitForBlocked(h:Harness,count:number,timeoutMs=5000):Promise<void>;
// tests/slice1-fixtures.ts
export const sameBuProject='11000000-0000-4000-8000-000000000003';
export const pm:Principal;       // demoProfiles.manager + grants manager ở ids.sales, ids.transport
export const member:Principal;   // demoProfiles.engineer + grant engineer ở ids.sales
export const viewer:Principal;   // demoProfiles.customer (viewer ở ids.transport)
export const bot:Principal;      // demoProfiles.bot
export const outsider:Principal; // otherPrincipal (tenant khác)
export async function seedSlice1(h:Harness):Promise<void>;
```
- `assertIsolated`: ném `Error('Use an isolated loopback slice-1 database.')` nếu hostname ≠ `127.0.0.1`, port ≠ `55471`, hoặc tên DB không khớp `/^slice1_verify(?:_[0-9]+)?$/`; ném `Error('Web must use the same isolated test database.')` nếu `webUrl` khác host hoặc pathname (mẫu `tests/spec004.test.ts:31-37`).
- `openHarness`: đặt `process.env.LIBETECH_DEMO='1'`. Native: `operator=pooledDatabase(SLICE1_TEST_DATABASE_URL)`, `db=SLICE1_WEB_DATABASE_URL?pooledDatabase(web,true):operator`; áp mọi tệp `^\d+.*\.sql$` trong `migrations/` chưa có trong `schema_migrations` (cùng thuật toán `scripts/migrate.ts:8-17`). PGlite: tự `PGlite.create()`, `exec` lần lượt các tệp migration, bọc thành `Database` như `src/server/db.ts:12`; `db===operator`. `exec(sql)`: PGlite dùng `pg.exec`, native dùng `operator.query(sql)` không tham số (nhiều câu lệnh).
- `reset()` (native): `TRUNCATE projects, identity.users, identity.memberships, identity.telegram_links, analytics.reconciliations, analytics.tech_source_imports CASCADE` rồi, nếu bảng tồn tại (`to_regclass`), `TRUNCATE document_templates`. PGlite: không làm gì (mỗi test một instance).
- `waitForBlocked`: lặp 50 ms câu `SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'` tới khi `n>=count`, quá hạn thì ném lỗi.
- `seedSlice1`: gọi `seed(h.operator)` (`src/server/seed.ts:5`), thêm dự án `sameBuProject` (`'Dự án cùng BU mẫu'`, `bu='BU Bán hàng mẫu'`, tenant `ids.tenant`), thêm `identity.users` cho `pm`, `member` (mẫu `tests/feedback-idempotency.test.ts:19-20`, `password_hash='fixture-only'`).
- `scripts/slice1-native-prepare.ts`: đọc `SLICE1_ADMIN_DATABASE_URL`; `assert` hostname `127.0.0.1`, port `55471`; `CREATE DATABASE slice1_verify_<epoch giây>`; in đúng một dòng `{"database":"slice1_verify_…"}`; không in URL hay mật khẩu (mẫu `scripts/native-verification.ts:10-14`).

**Ca kiểm viết trước** (`tests/slice1-harness.test.ts`)
- [ ] `assertIsolated rejects non-loopback host, wrong port and unexpected database name` — ba URL `postgresql://u@10.0.0.5:55471/slice1_verify`, `…@127.0.0.1:5432/slice1_verify`, `…@127.0.0.1:55471/libetech` đều ném; `…@127.0.0.1:55471/slice1_verify_17` không ném; web khác pathname ném.
- [ ] `harness applies every forward migration and seeds synthetic projects` — sau `openHarness()` + `seedSlice1`: `SELECT version FROM schema_migrations` chứa `'012'`; `projects` có 4 dòng.
- [ ] `describe.skipIf(!native)('native')`: `runtime login is not superuser and cannot bypass RLS` — qua `h.db`: `rolsuper=false`, `rolbypassrls=false`; `h.db.transaction` chỉ `SET LOCAL ROLE libetech_runtime` rồi `SELECT * FROM work_items` → 0 dòng.

**Lệnh kiểm**
- [ ] `npx vitest run tests/slice1-harness.test.ts` → xanh, khối `native` báo skipped.
- [ ] `set -a; . "$SLICE1_ENV_FILE"; set +a; npx vitest run tests/slice1-harness.test.ts` → xanh, không skipped. Lưu output (đã che URL) cho biên nhận.

**Con trỏ:** brief `:78` · `SPEC-002-identity-postgres.md:23` · mẫu `tests/spec004.test.ts:30-64`.

### Task 2: R-01 (a) — `resolve()` khoá dòng report trước khi tra hành động cũ

**Mục tiêu:** hai yêu cầu giống hệt chạy song song cho ra một lần áp dụng và một lần replay, không còn `VERSION_CONFLICT` giả.

**Tệp:** sửa `src/server/feedback.ts:45-58`; tạo `tests/feedback-concurrency.test.ts`; giữ nguyên `tests/feedback-idempotency.test.ts` (5 ca hồi quy PR #2 phải tiếp tục xanh).

**Ca kiểm viết trước**
- [ ] `tests/feedback-concurrency.test.ts`, `describe.skipIf(!native)`: **`resolve: two identical concurrent requests apply once and replay once`**. Dựng: `openHarness`, `seedSlice1`, `service=new FeedbackService(h.db)`, tạo report `a` trong `ids.sales` bằng `pm`. `k=randomUUID()`, `cmd={projectId:ids.sales,reportId:a,requestKey:k,expectedVersion:1,state:'closed',reason:'Concurrent resolution'}`. Trong `h.operator.transaction`: `SELECT id FROM feedback_reports WHERE id=$1 FOR UPDATE`; khởi động `const both=Promise.allSettled([service.resolve(pm,cmd),service.resolve(pm,cmd)])` (không await); `await waitForBlocked(h,2)`; kết thúc transaction để nhả khoá; `await both`. Mong đợi: cả hai `fulfilled`; hai kết quả cùng `id`; đúng một `{replayed:false}` và một `{replayed:true}`; `feedback_reports` của `a` là `{state:'closed',version:2}`; `count(*) feedback_actions = 1`.
- [ ] `tests/feedback-idempotency.test.ts`, thêm: **`resolve: a used key sent for an unknown report is SCOPE_DENIED and changes nothing`** — sau khi đóng `a` bằng `k`, gọi `resolve(p,cmd(randomUUID(),k))` → `{code:'SCOPE_DENIED',status:404}`; `actions()` vẫn 1. (Ghim thứ tự lỗi mới do khoá trước; trước khi sửa ca này trả `FEEDBACK_KEY_CONFLICT`.)
- [ ] Chạy native thấy ca đầu đỏ với `VERSION_CONFLICT` ở lượt thứ hai (hai lượt cùng qua bước tra hành động cũ khi chưa có khoá).

**Mã cần viết:** trong transaction của `resolve()`, chuyển câu `SELECT state,version FROM feedback_reports WHERE id=$1 AND project_id=$2 FOR UPDATE` và `invariant(report,'SCOPE_DENIED',…,404)` lên **trước** câu tra `feedback_actions`. Các kiểm version/chuyển trạng thái giữ sau nhánh replay. Không đổi chữ ký, mã lỗi, transaction hay RLS.

**Lệnh kiểm**
- [ ] `npx vitest run tests/feedback-idempotency.test.ts tests/onboarding-feedback.test.ts` → xanh (6 + ca cũ).
- [ ] Native: `npx vitest run tests/feedback-concurrency.test.ts` → xanh; lưu output.

**Con trỏ:** `reviews/REVIEW-R01-fix-feedback-20261112.md:16` gợi ý (2), `:29` · brief `:35`.

### Task 3: R-01 (b) — thay SELECT-rồi-INSERT bằng `INSERT … ON CONFLICT DO NOTHING RETURNING id`

**Mục tiêu:** khoá yêu cầu được nhận nguyên tử theo E-BE-08; hành vi quan sát được giữ nguyên.

**Tệp:** sửa `src/server/feedback.ts` (thân `resolve()` sau bước khoá của Task 2); thêm ca vào `tests/feedback-concurrency.test.ts`.

**Ca kiểm viết trước** (đều native, `skipIf(!native)`)
- [ ] **`resolve: one key raced across two reports applies once and conflicts once`** — report `a`, `b` cùng `ids.sales`; `k` chung; lệnh `ca` cho `a`, `cb` cho `b` (cùng `expectedVersion:1`, `state:'closed'`, cùng `reason`). Giữ `FOR UPDATE` cả hai dòng trong `h.operator.transaction`, khởi động `Promise.allSettled([resolve(pm,ca),resolve(pm,cb)])`, `waitForBlocked(h,2)`, nhả. Mong đợi: đúng một `fulfilled` `{replayed:false}`; đúng một `rejected` `{code:'FEEDBACK_KEY_CONFLICT',status:409}`; report thắng `{state:'closed',version:2}`, report thua `{state:'new',version:1}`; `feedback_actions` có 1 dòng. Ghi chú trong test: ca này có thể **đã xanh trước khi sửa** nhờ nhánh bắt `23505` ở `feedback.ts:68-72` — đây là ca giữ hành vi, biên nhận ghi đúng như vậy.
- [ ] **`resolve: one key reused in another project conflicts although RLS hides the prior action (native)`** — lặp lại ca `tests/feedback-idempotency.test.ts:43-50` trên `h.db` native (principal hai grant manager `ids.sales` + `ids.transport`): lần hai → `FEEDBACK_KEY_CONFLICT` 409, report ở `ids.transport` không đổi, 1 hành động.

**Mã cần viết:** sau khi khoá report: `INSERT INTO feedback_actions(…) VALUES(…) ON CONFLICT (tenant_id,actor_id,request_key) DO NOTHING RETURNING id`.
- Không có dòng trả về → `SELECT id,project_id,report_id,prior_version,next_state,reason FROM feedback_actions WHERE tenant_id=$1 AND actor_id=$2 AND request_key=$3` (theo RLS): thấy và trùng đủ năm trường → `{id,replayed:true}`; thấy mà lệch, **hoặc không thấy** (dòng cũ ở dự án RLS che) → `FEEDBACK_KEY_CONFLICT` 409.
- Có dòng trả về → kiểm `VERSION_CONFLICT`, `FEEDBACK_STATE_CONFLICT` như cũ (ném lỗi thì transaction lùi, dòng hành động biến mất), rồi `UPDATE feedback_reports`, trả `{id,replayed:false}`.
- Bỏ nhánh `.catch` mã `23505` nếu cả hai ca chéo dự án (PGlite `:43-50` và native) xanh mà không cần nó; nếu PostgreSQL vẫn ném `23505` cho dòng bị RLS che thì giữ nhánh đó và ghi vào biên nhận. Planner chưa chạy thử được điểm này.

**Ghi nhận về `create()` (`feedback.ts:23-40`) — không sửa:** đã dùng `INSERT … ON CONFLICT DO NOTHING RETURNING id` rồi mới tra lại, nên không có lỗ SELECT-rồi-INSERT; dùng lại khoá ở dự án khác ra `FEEDBACK_KEY_CONFLICT` vì dòng cũ bị RLS che. Brief không giao việc trên `create()`; chỉ ghi vào biên nhận.

**Lệnh kiểm**
- [ ] `npx vitest run tests/feedback-idempotency.test.ts tests/onboarding-feedback.test.ts` → xanh.
- [ ] Native: `npx vitest run tests/feedback-concurrency.test.ts tests/feedback-idempotency.test.ts` → xanh; lưu output.

**Con trỏ:** `reviews/REVIEW-R01-fix-feedback-20261112.md:16` gợi ý (3) · E-BE-08.

### Task 4: Một nguồn số bản (OQ-03 b, phần số bản)

**Mục tiêu:** số bản chỉ còn một nguồn là `package.json:3`; cầu nối, health và giao diện đọc từ đó.

**Kiểm trước (đã làm 12/11, builder làm lại):** `grep -n "version" bot-plugin/__init__.py tests/test_bot_bridge.py` — bot chỉ gắn hằng `VERSION` của chính nó vào `bridgeVersion` (`bot-plugin/__init__.py:97`, `:150`, `:173`), không đọc hay so trường `version` trong phản hồi cầu nối. Nếu kết quả khác, dừng task và báo điều phối. Không sửa `bot-plugin/`.

**Tệp:** tạo `src/server/version.ts`, `tests/version-status.test.ts`; sửa `src/server/bridge.ts:43`, `src/app/api/health/route.ts:10`, `src/components/workspace.tsx:25`, `:39`, `:47`, `src/app/page.tsx` (truyền prop), `tests/identity.test.ts:73`.

**Giao diện:** `export const APP_VERSION:string` (đọc `version` từ `package.json` bằng import JSON; `tsconfig.json` đã bật `resolveJsonModule`). `Workspace` nhận thêm prop `version:string` từ `src/app/page.tsx` — component client **không** import `package.json`.

**Ca kiểm viết trước**
- [ ] `APP_VERSION equals package.json version` — so với `JSON.parse(readFileSync('package.json','utf8')).version`.
- [ ] `no hard-coded release number remains in bridge, health and workspace` — đọc ba tệp nguồn, khẳng định không chứa `'0.7.1'` và không chứa `'0.3.0'`.
- [ ] `tests/identity.test.ts:73`: thêm `version:APP_VERSION` vào `toMatchObject`.

**Mã cần viết:** `bridge.ts:43` trả `version:APP_VERSION`; health trả `version:APP_VERSION`; `workspace.tsx` hiện `AI OS · {version}` và `LibeTech AI OS · {version}`. Không đổi giá trị `0.7.1` trong `package.json` (`deploy/pilot-onboard-20261111.py:112` đang so đúng chuỗi này; tăng số bản là việc của đợt phát hành).

**Lệnh kiểm:** `npx vitest run tests/version-status.test.ts tests/identity.test.ts && npx tsc --noEmit`; `python3 -m pytest tests/test_bot_bridge.py -q` vẫn xanh (không chạm bot, chạy để chứng minh).

**Con trỏ:** brief `:33` · gói quyết định §3 OQ-03 · §6 mục 1.

### Task 5: Ba trạng thái cầu nối (OQ-03 b, phần nhãn) — **dừng tại OQ-23** phần nguồn «đã kiểm thực tế»

**Mục tiêu:** giao diện và health phân biệt ba trạng thái của cầu nối bot; biến cấu hình không bao giờ tự sinh nhãn «đã kiểm thực tế».

**Tệp:** tạo `src/server/integration-status.ts`; sửa `src/app/api/health/route.ts:10`, `src/components/workspace.tsx:39` (khối `bot-status`), `src/app/page.tsx`; thêm ca vào `tests/version-status.test.ts`.

**Giao diện**
```ts
export type BridgeConnection='not-configured'|'configured'|'verified';
export type BridgeStatus={connection:BridgeConnection; writeFlow:'not-connected'; verifiedAt:string|null};
export function bridgeStatus(input:{configured:boolean; verifiedAt:string|null}):BridgeStatus;
export function bridgeLabels(s:BridgeStatus):string[];
export async function bridgeVerifiedAt():Promise<string|null>;   // lát 1: luôn null — OQ-23
```
Nhãn nguyên văn: `'chưa cấu hình'`, `'đã cấu hình'`, `'đã kiểm thực tế'`, `'chưa nối luồng ghi'`.

**Ca kiểm viết trước**
- [ ] `configuration alone never yields the verified label` — `bridgeLabels(bridgeStatus({configured:true,verifiedAt:null}))` bằng `['đã cấu hình','chưa nối luồng ghi']`.
- [ ] `missing configuration shows not-configured and no write flow` — `{configured:false,verifiedAt:null}` → `['chưa cấu hình','chưa nối luồng ghi']`; `{configured:false,verifiedAt:'2026-11-12T00:00:00Z'}` → vẫn `connection:'not-configured'`.
- [ ] `a recorded verification shows all three labels` — `{configured:true,verifiedAt:'2026-11-12T00:00:00Z'}` → `['đã cấu hình','đã kiểm thực tế','chưa nối luồng ghi']`.
- [ ] `slice 1 has no verification source` — `await bridgeVerifiedAt()` là `null` dù `process.env.LIBETECH_BRIDGE_CONFIG` được đặt.

**Mã cần viết:** health giữ nguyên hai giá trị máy của `integrations.bot` (`'configured-not-runtime-verified'` / `'not-configured'`) và thêm trường `integrations.botWriteFlow:'not-connected'` (chỉ thêm, không phá hợp đồng). `page.tsx` tính `bridgeStatus({configured:Boolean(process.env.LIBETECH_BRIDGE_CONFIG),verifiedAt:await bridgeVerifiedAt()})` và truyền prop `bridge:BridgeStatus` cho `Workspace`; khối `bot-status` hiện các nhãn của `bridgeLabels` thay dòng chữ tĩnh, mỗi nhãn là chữ, không chỉ màu.

**Dừng tại OQ-23:** không viết nguồn nào cho `verifiedAt` (không đọc `identity.bridge_nonces`, không thêm bảng, không thêm biến môi trường). Khi OQ-23 có quyết định, chỉ thay thân `bridgeVerifiedAt()`.

**Lệnh kiểm:** `npx vitest run tests/version-status.test.ts && npx tsc --noEmit`.

**Con trỏ:** `IMPLEMENTATION-ROADMAP.md:44` · brief `:33` · `reviews/CODEX-STEP0-P1-READINESS-20261112.md:71`.

### Task 6: Tệp mẫu T0–T6 có version và hash

**Mục tiêu:** bảy mẫu thành bảy tệp có mã, version và hash kiểm được bằng test; không cài vào bot (OQ-21 a).

**Vị trí (đề xuất của brief `:31`, reviewer kiểm):** `docs/templates/`.

**Tệp:** tạo `docs/templates/T0-chi-muc-du-an.md`, `T1-ghi-nhan-yeu-cau.md`, `T2-yeu-cau-nghiep-vu.md`, `T3-thiet-ke-thay-doi.md`, `T4-ke-hoach-quyet-dinh.md`, `T5-kiem-chung-nghiem-thu.md`, `T6-huong-dan-ban-giao.md`, `docs/templates/manifest.json`, `tests/document-templates.test.ts`.

**Nội dung mỗi tệp mẫu:** front matter `code`, `version: 0.1.0`, `doc_type`, `source: docs/PM-DOCUMENT-TEMPLATES.md:<đầu>-<cuối>`; tiếp theo bảng metadata chung chép từ `PM-DOCUMENT-TEMPLATES.md:11-21`; rồi nguyên văn mục tương ứng: T0 `:23-38`, T1 `:40-53`, T2 `:55-70`, T3 `:72-83`, T4 `:85-102`, T5 `:104-116`, T6 `:118-129`. Không chép hai ví dụ `:131-148` (đó là dữ liệu ca, không phải mẫu).

**`manifest.json`:** `{"schema":1,"templates":[{"code":"T0","version":"0.1.0","docType":"project_index","title":"Chỉ mục dự án và trách nhiệm","path":"docs/templates/T0-chi-muc-du-an.md","sha256":"<64 hex>"}, …]}`; `docType` lần lượt: `project_index`, `change_brief`, `requirements`, `design`, `plan`, `verification`, `guide`. `sha256` = băm SHA-256 của đúng bytes tệp.

**Ca kiểm viết trước**
- [ ] `manifest lists exactly T0..T6 once each with semver versions` — 7 mục, mã `T0`…`T6` không trùng, `version` khớp `/^\d+\.\d+\.\d+$/`.
- [ ] `every manifest hash equals the sha256 of the file bytes` — tính lại từng tệp, so `sha256`. Sửa tệp mà không cập nhật manifest thì ca đỏ.
- [ ] `every template carries its code, version and the nine metadata rows` — front matter khớp manifest; thân có đủ 9 hàng của bảng `:13-21` (kiểm bằng nhãn cột đầu).
- [ ] `templates contain no credential or real chat identifier` — không khớp `/-100\d{6,}/` và không khớp `/(token|password|secret)\s*[:=]\s*\S+/i`.

**Lệnh kiểm:** `npx vitest run tests/document-templates.test.ts`.

**Con trỏ:** OQ-21 (a) · brief `:31` · `SPEC-009…:117`.

### Task 7: Migration 013 — sổ dự án, kênh đề xuất, ánh xạ miền rỗng, sổ sự kiện (+ tệp lùi)

**Tệp:** tạo `migrations/013_project_registry.sql`, `migrations/rollback/013_project_registry.sql`, `tests/migrations-rollback.test.ts`, `tests/project-registry.test.ts` (phần schema).

**Bảng** (cột chung theo Global Constraints, không lặp lại ở đây)

| Bảng | Cột riêng | Ràng buộc |
|---|---|---|
| `project_profiles` | `objective text NOT NULL DEFAULT ''`, `owner_bu text NOT NULL DEFAULT ''`, `pm_label text NOT NULL DEFAULT ''`, `vault_pointer text`, `repo_url text`, `status text NOT NULL DEFAULT 'proposed'`, `version integer NOT NULL DEFAULT 1 CHECK(version>0)`, `updated_by uuid NOT NULL` | `UNIQUE(tenant_id,project_id)` |
| `project_channels` | `chat_id text NOT NULL CHECK(chat_id ~ '^-[1-9][0-9]*$')`, `topic_id text NOT NULL DEFAULT ''`, `mode text NOT NULL CHECK(mode IN ('command_reply','active'))`, `state text NOT NULL DEFAULT 'proposed' CHECK(state IN ('proposed','active','disabled'))`, `enabled_from timestamptz`, `approver_id uuid`, `policy_version text NOT NULL`, `proposed_by uuid NOT NULL`, `version integer NOT NULL DEFAULT 1` | `UNIQUE(tenant_id,project_id,chat_id,topic_id)` |
| `project_domain_mappings` | `domain_code text NOT NULL CHECK(domain_code IN ('LIBERICO_BU','XECA','IBS_HI'))`, `confirmed_by uuid NOT NULL`, `source text NOT NULL CHECK(length(source)>=5)`, `mapping_version integer NOT NULL CHECK(mapping_version>0)` | `UNIQUE(tenant_id,project_id,mapping_version)`; chỉ thêm, có trigger lịch sử |
| `registry_events` | `entity_type text NOT NULL CHECK(entity_type IN ('project_profile','project_channel','domain_mapping','document','document_revision'))`, `entity_id uuid NOT NULL`, `actor_id uuid NOT NULL`, `kind text NOT NULL`, `command_key text NOT NULL`, `payload jsonb NOT NULL` | chỉ thêm, có trigger lịch sử |

- Index: mỗi bảng `(tenant_id,project_id,created_at DESC)`; `registry_events(entity_type,entity_id,created_at)`.
- Policy trên cả bốn bảng: `scope_select` (`FOR SELECT`, `USING` phạm vi), `scope_insert` (`FOR INSERT`, `WITH CHECK` phạm vi), và với `project_profiles` thêm `scope_update` (`FOR UPDATE`, cả `USING` và `WITH CHECK` phạm vi). Riêng `project_channels.scope_insert` thêm điều kiện cổng P1.0: `state='proposed' AND approver_id IS NULL AND enabled_from IS NULL`.
- Quyền `libetech_runtime`: `SELECT` cả bốn; `INSERT` trên `project_profiles`, `project_channels`, `registry_events`; `UPDATE(objective,owner_bu,pm_label,vault_pointer,repo_url,status,version,updated_by,updated_at)` trên `project_profiles`. **Không** cấp UPDATE trên `project_channels`, **không** cấp INSERT trên `project_domain_mappings` (lát 1 chưa có đường ghi ánh xạ — xem «Chỗ chưa chắc»).
- **Không** có câu `INSERT` dữ liệu nào ngoài dòng `schema_migrations`.
- `registry_events` không có `request_id`/`trace_id` (E-DB-13): bám theo `audit_events` hiện có, `command_key` là mối nối về yêu cầu; ghi là tồn đọng chung của repo trong biên nhận.

**Tệp lùi 013:** `DROP TABLE IF EXISTS registry_events, project_domain_mappings, project_channels, project_profiles;` + `DELETE FROM schema_migrations WHERE version='013';`. Không xoá role hay hàm dùng chung.

**Ca kiểm viết trước**
- [ ] `tests/migrations-rollback.test.ts` — **`every migration from 013 has a rollback file with the same name`**: liệt kê `migrations/` các tệp số ≥ 013, mỗi tệp phải có tệp cùng tên trong `migrations/rollback/`; và `migrations/rollback/` không có tệp nào số < 013.
- [ ] **`forward → rollback → forward leaves source tables untouched`**: `openHarness`, `seedSlice1`, thêm 2 dòng tổng hợp vào `analytics.tech_source_tasks`; ghi `count(*)` + `md5(string_agg(fingerprint,',' ORDER BY source_row))` của `analytics.tech_source_tasks` và `count(*)` của `work_items`. Lùi lần lượt các tệp từ số lớn về 013 bằng `h.exec`; khẳng định `to_regclass` của từng bảng mới là `NULL` và `schema_migrations` không còn các số đó. Tiến lại theo thứ tự tăng bằng `h.exec`, rồi chạy tiến **lần hai**; khẳng định bảng tồn tại, mỗi version có đúng 1 dòng trong `schema_migrations`, hai số đo nguồn không đổi. Ca viết theo vòng lặp trên danh sách tệp để Task 9 và 11 không phải sửa.
- [ ] `tests/project-registry.test.ts` — **`new registry tables return nothing without RLS context`**: trong `h.db.transaction` chỉ `SET LOCAL ROLE libetech_runtime`, `SELECT *` từng bảng trong bốn bảng → 0 dòng (dữ liệu chèn trước bằng `h.operator`).
- [ ] **`runtime cannot insert a registry row for another project or tenant`**: `scoped(h.db,viewer,…)` chèn `registry_events` với `project_id=ids.sales` → ném; `scoped(h.db,outsider,…)` chèn với `tenant_id=ids.tenant` → ném.
- [ ] **`runtime cannot create an active channel or a domain mapping`**: `scoped(h.db,pm,…)` chèn `project_channels` với `state='active'` → ném; với `approver_id` khác rỗng → ném; chèn `project_domain_mappings` → ném (không có quyền).
- [ ] **`history tables reject update and delete`**: `h.operator` `UPDATE`/`DELETE` trên `registry_events`, `project_domain_mappings` → ném `Append-only history`.
- [ ] **`migration 013 ships no domain mapping row`**: sau migrate + seed, `count(*) project_domain_mappings = 0`.

**Lệnh kiểm:** `npx vitest run tests/migrations-rollback.test.ts tests/project-registry.test.ts`, rồi lặp lại với env native.

**Con trỏ:** brief `:27-28`, `:49`, `:52`, `:67` ca (2)(3)(8)(9) · ADR-002 «Sổ dự án và nhãn miền báo cáo», «ProjectChannel» · `SPEC-008…:59` · `SPEC-009…:136`.

### Task 8: Service sổ dự án (`ProjectRegistryService`)

**Mục tiêu:** đọc/ghi hồ sơ dự án và đề xuất kênh nhóm qua domain service có quyền, version, chống lặp và audit; kênh đề xuất không cấp quyền nào; dự án chưa ánh xạ miền hiện «Chưa xác nhận».

**Tệp:** tạo `src/server/projects-registry.ts`; sửa `src/server/types.ts` (thêm kiểu); thêm ca vào `tests/project-registry.test.ts`.

**Giao diện**
```ts
export const REPORTING_DOMAINS=['LIBERICO_BU','XECA','IBS_HI'] as const;
export type ReportingDomain=typeof REPORTING_DOMAINS[number];
export function reportingDomainLabel(code:ReportingDomain|null):string;   // null → 'Chưa xác nhận'; 'Liberico BU' | 'Xeca' | 'IBS HI'
export type ProjectProfile={project_id:string;objective:string;owner_bu:string;pm_label:string;vault_pointer:string|null;repo_url:string|null;status:'proposed'|'active'|'paused'|'closed';version:number;updated_at:string};
export type ProjectChannel={id:string;project_id:string;chat_id:string;topic_id:string;mode:'command_reply'|'active';state:'proposed';policy_version:string;enabled_from:null;approver_id:null;created_at:string};
export type ProjectRegistry={project:Project;profile:ProjectProfile|null;channels:ProjectChannel[];domain:{code:ReportingDomain|null;label:string;countsTowardTotals:boolean}};
export class ProjectRegistryService { constructor(db:Database);
  registry(p:Principal,projectId:string):Promise<ProjectRegistry>;
  saveProfile(p:Principal,projectId:string,raw:unknown,key:string):Promise<ProjectProfile>;
  proposeChannel(p:Principal,projectId:string,raw:unknown,key:string):Promise<ProjectChannel>; }
```
- `saveProfile` input (strict): `{expectedVersion:int≥0, objective≤2000, ownerBu≤120, pmLabel≤120, vaultPointer:string≤500|null, repoUrl:https URL không chứa thông tin đăng nhập|null, status}`. `expectedVersion:0` nghĩa là chưa có hồ sơ: `INSERT … ON CONFLICT(tenant_id,project_id) DO NOTHING RETURNING *`, không có dòng → `REVISION_CONFLICT` 409. Ngược lại `UPDATE … WHERE version=$expected RETURNING *`, 0 dòng → `REVISION_CONFLICT`.
- `proposeChannel` input (strict): `{chatId khớp /^-[1-9][0-9]*$/, topicId:''|chuỗi số, mode, policyVersion 1..40}`; chèn bằng `ON CONFLICT(tenant_id,project_id,chat_id,topic_id) DO NOTHING RETURNING *`, không có dòng → `CHANNEL_ALREADY_PROPOSED` 409.
- Quyền: `projectRole(p,projectId)==='manager'`, nếu không → `MANAGER_REQUIRED` 403; bot → `READ_ONLY` 403; dự án ngoài `p.projectIds` → `SCOPE_DENIED` 404 câu chung. Đọc `registry`: thành viên dự án không phải bot.
- Mỗi ghi: `scoped(db,{...p,projectIds:[projectId]},tx=>deduplicate(tx,p,projectId,key,{op:'project.save_profile'|'project.propose_channel',projectId,...input},action))`, trong `action` chèn một dòng `registry_events` (`kind`: `profile_saved` / `channel_proposed`, `command_key=key`, `payload` = input + version trước/sau).
- `domain`: dòng `project_domain_mappings` có `mapping_version` lớn nhất; không có → `{code:null,label:'Chưa xác nhận',countsTowardTotals:false}`.

**Ca kiểm viết trước**
- [ ] `saveProfile creates then updates with expectedVersion and writes one event each` — `pm` tạo (`expectedVersion:0`) → version 1; cập nhật (`expectedVersion:1`) → version 2; `registry_events` có đúng 2 dòng `project_profile`.
- [ ] `stale expectedVersion is REVISION_CONFLICT with no event and no version change` — gửi `expectedVersion:1` khi đang là 2 → `{code:'REVISION_CONFLICT',status:409}`; số dòng sự kiện và `version` giữ nguyên.
- [ ] `same key and same request replays; same key with different content is IDEMPOTENCY_CONFLICT` — lặp `saveProfile` cùng `key` → kết quả bằng lần đầu, vẫn 1 sự kiện; cùng `key`, đổi `objective` → `IDEMPOTENCY_CONFLICT`.
- [ ] `non-manager, viewer, bot and outsider cannot write` — `member` → `MANAGER_REQUIRED`; `viewer` trên `ids.transport` → `MANAGER_REQUIRED`; `bot` → `READ_ONLY`; `outsider` với `ids.sales` → `SCOPE_DENIED`; thông điệp không chứa `'Cổng bán hàng mẫu'`.
- [ ] `identity fields in the body are rejected` — input kèm `tenantId` hoặc `actorId` → ném `ZodError`.
- [ ] `a proposed channel grants nothing` — `proposeChannel(pm,ids.sales,{chatId:'-1009990001',topicId:'',mode:'command_reply',policyVersion:'p1.0'},key)` trả `state:'proposed'`, `approver_id:null`, `enabled_from:null`; rồi gọi `handleBridge` với yêu cầu `reconciliation` đã ký từ `chatId:'-1009990001'` và `chatScopes={}` (dựng như `tests/identity.test.ts` quanh `:73`) → `{code:'SCOPE_DENIED'}`. Đây là DOC-01 nửa «không đọc được danh mục» và ca quyền âm (8).
- [ ] `an unmapped chat creates no record` (DOC-01 nửa sau) — đếm dòng của mọi bảng mới trước và sau lời gọi cầu nối bị từ chối ở ca trên → không đổi.
- [ ] `unmapped project shows Chưa xác nhận and counts toward no total` — `registry(pm,ids.sales).domain` bằng `{code:null,label:'Chưa xác nhận',countsTowardTotals:false}`; sau khi `h.operator` chèn một dòng ánh xạ **tổng hợp** (`ids.transport` → `'XECA'`, `source:'fixture tổng hợp'`), `registry(pm,ids.transport).domain.label` là `'Xeca'` còn `ids.sales` vẫn «Chưa xác nhận».

**Lệnh kiểm:** `npx vitest run tests/project-registry.test.ts` (PGlite và native), `npx tsc --noEmit`.

**Con trỏ:** brief `:27-28`, `:67` ca (4)(5)(6)(8)(9), DOC-01 `:57` · `SPEC-009…:84`, `:28`.

### Task 9: Migration 014 + chỉ mục mẫu + đăng ký tài liệu (+ tệp lùi)

**Mục tiêu:** có bảng record/revision/chỉ mục mẫu với cổng P1.0 ở tầng DB, và thao tác đăng ký tài liệu: mỗi tài liệu đúng một nguồn chính, bản chuẩn rỗng, `SOURCE_NOT_FROZEN`.

**Tệp:** tạo `migrations/014_document_registry.sql`, `migrations/rollback/014_document_registry.sql`, `src/server/document-templates.ts`, `src/server/documents.ts`, `tests/documents.test.ts`; sửa `src/server/types.ts`, `src/server/seed.ts` (gọi đồng bộ chỉ mục mẫu cho hai tenant tổng hợp).

**Bảng**

| Bảng | Cột riêng | Ràng buộc |
|---|---|---|
| `document_templates` (chỉ `tenant_id`, không `project_id`) | `code text NOT NULL`, `template_version text NOT NULL`, `doc_type text NOT NULL`, `title text NOT NULL`, `path text NOT NULL`, `content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$')` | `UNIQUE(tenant_id,code,template_version)`, `UNIQUE(id,tenant_id)`; chỉ thêm, trigger lịch sử |
| `document_records` | `ref_code text NOT NULL DEFAULT ''`, `doc_type text NOT NULL`, `title text NOT NULL`, `template_id uuid`, `source_type text NOT NULL CHECK(source_type IN ('drive','git','vault'))`, `canonical_uri text NOT NULL`, `owner_label text NOT NULL DEFAULT ''`, `classification text NOT NULL DEFAULT 'unclassified'`, `metadata jsonb NOT NULL DEFAULT '{}'`, `source_links jsonb NOT NULL DEFAULT '[]'`, `source_state text NOT NULL DEFAULT 'not-configured' CHECK(source_state IN ('fresh','stale','unavailable','denied','not-configured','partially-received'))`, `source_checked_at timestamptz`, `review_due_at timestamptz`, `freeze_state text NOT NULL DEFAULT 'SOURCE_NOT_FROZEN'`, `latest_revision_id uuid`, `approved_revision_id uuid`, `registered_by uuid NOT NULL`, `version integer NOT NULL DEFAULT 1 CHECK(version>0)` | `UNIQUE(id,tenant_id,project_id)`, `UNIQUE(tenant_id,project_id,canonical_uri)`; FK `(template_id,tenant_id)` → `document_templates(id,tenant_id)`; trigger chặn **DELETE** |
| `document_revisions` | `document_id uuid NOT NULL`, `revision_no integer NOT NULL CHECK(revision_no>0)`, `based_on_revision_id uuid`, `source_id text NOT NULL`, `source_type text NOT NULL`, `ingested_at timestamptz NOT NULL DEFAULT now()`, `quality_score numeric(3,2) NOT NULL DEFAULT 0 CHECK(quality_score BETWEEN 0 AND 1)`, `source_revision text`, `source_hash text CHECK(source_hash IS NULL OR source_hash ~ '^[a-f0-9]{64}$')`, `hash_verification text NOT NULL DEFAULT 'self_declared' CHECK(hash_verification IN ('self_declared','verified'))`, `source_modified_at timestamptz`, `snapshot_ref text`, `changes jsonb NOT NULL DEFAULT '{}'`, `source_refs jsonb NOT NULL DEFAULT '[]'`, `proposed_by uuid NOT NULL` | `UNIQUE(id,document_id)`, `UNIQUE(document_id,revision_no)`, `UNIQUE(id,tenant_id,project_id)`; FK `(document_id,tenant_id,project_id)` → `document_records`; FK `(based_on_revision_id,document_id)` → `document_revisions(id,document_id)`; bất biến (trigger lịch sử) |

- Sau khi có hai bảng, thêm hai khoá ngoại trên `document_records` (bọc `DO $$` kiểm `pg_constraint` để chạy lại được): `(latest_revision_id,id)` và `(approved_revision_id,id)` → `document_revisions(id,document_id)` — con trỏ chỉ trỏ được revision **cùng record**; `approved_revision_id` được rỗng.
- Bốn trường nguồn AR-05 nằm trên revision: `source_id` (= `canonical_uri` lúc đề xuất), `source_type`, `ingested_at`, `quality_score` (thang 0–1 theo quy ước repo ở `migrations/001_foundation.sql:42`; `0` = tự khai, chưa kiểm).
- Index: `document_records(tenant_id,project_id,created_at DESC)`, `(template_id)`, `(latest_revision_id)`, `(approved_revision_id)`; `document_revisions(document_id,tenant_id,project_id,created_at)`, `(based_on_revision_id)`; `document_templates(tenant_id,created_at)`.
- Policy: `document_templates` — một policy theo tenant, có `USING` và `WITH CHECK` (`tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid`). `document_records` — `scope_select`, `scope_insert` (thêm `approved_revision_id IS NULL AND freeze_state='SOURCE_NOT_FROZEN'`), `scope_update` (`USING` + `WITH CHECK` phạm vi). `document_revisions` — `scope_select`, `scope_insert` với `WITH CHECK` phạm vi **và** `hash_verification='self_declared' AND snapshot_ref IS NULL` (cổng P1.0/OQ-07 ở tầng DB).
- Quyền `libetech_runtime`: `SELECT` cả ba; `INSERT` trên `document_records`, `document_revisions`; `UPDATE(latest_revision_id,version,updated_at)` trên `document_records` — **không** có `approved_revision_id`, `freeze_state`, `source_state`.
- Tệp lùi 014: `DROP TABLE IF EXISTS document_revisions, document_records, document_templates CASCADE;` + xoá dòng `schema_migrations` `'014'`.

**Giao diện**
```ts
// src/server/document-templates.ts
export type TemplateEntry={code:string;version:string;docType:DocType;title:string;path:string;sha256:string};
export const templateManifest:TemplateEntry[];        // import tĩnh docs/templates/manifest.json, không đọc tệp lúc chạy
export async function syncTemplateIndex(tx:Queryable,tenantId:string,entries?:TemplateEntry[]):Promise<{inserted:number}>;
// src/server/types.ts
export type DocType='project_index'|'change_brief'|'requirements'|'design'|'plan'|'verification'|'guide'|'other';
export type SourceType='drive'|'git'|'vault';
export type SourceState='fresh'|'stale'|'unavailable'|'denied'|'not-configured'|'partially-received';
export type SourceLink={kind:'z2_source_ref';value:string;label:'chưa đối soát';present?:boolean};
export type DocumentRecord={id:string;project_id:string;ref_code:string;doc_type:DocType;title:string;source_type:SourceType;canonical_uri:string;owner_label:string;classification:'unclassified';metadata:DocumentMetadata;source_links:SourceLink[];source_state:SourceState;source_checked_at:string|null;review_due_at:string|null;freeze_state:'SOURCE_NOT_FROZEN';latest_revision_id:string|null;approved_revision_id:string|null;version:number;created_at:string;updated_at:string};
export type DocumentMetadata={author?:string;reviewer?:string;authorityNote?:string;audienceNote?:string;readingLimits?:string;missingFields:string[]};
export type RegistryEvent={id:string;entity_type:string;entity_id:string;actor_id:string;kind:string;payload:Record<string,unknown>;created_at:string};
export type DocumentDetail={record:DocumentRecord;revisions:DocumentRevision[];events:RegistryEvent[]};   // khai báo luôn kiểu DocumentRevision và SourceRef theo chữ ký ghi ở Task 10
// src/server/documents.ts
export class DocumentService { constructor(db:Database);
  register(p:Principal,raw:unknown,key:string):Promise<DocumentDetail>;
  detail(p:Principal,documentId:string):Promise<DocumentDetail>; }
```
- `syncTemplateIndex`: đặt `set_config('app.tenant_id',tenantId,true)`; mỗi mục `INSERT … ON CONFLICT(tenant_id,code,template_version) DO NOTHING`; sau đó nếu dòng đang có khác `content_hash` → `AppError('TEMPLATE_VERSION_REUSED',…,409)`.
- `register` input (strict): `{projectId:uuid, refCode:''|/^[A-Z0-9][A-Z0-9-]{1,39}$/, docType:DocType, title 5..200, templateCode?:'T0'…'T6', sourceType:SourceType, canonicalUri, ownerLabel≤120, reviewDueAt:ISO datetime|null, metadata:{author?,reviewer?,authorityNote?,audienceNote?,readingLimits? (mỗi trường ≤500), missingFields:string[]≤20 phần tử ≤120 ký tự}, sourceLinks:{kind:'z2_source_ref',value 3..300}[]≤10}`. `canonicalUri`: cắt khoảng trắng, phải là URL `https:` không có `username`/`password`, lưu `new URL(v).href`. `classification` không nhận từ input (luôn `'unclassified'`, bảng phân loại chưa duyệt — OQ-14). `templateCode` → dòng `document_templates` của tenant có `created_at` mới nhất cho mã đó; không có → `TEMPLATE_UNKNOWN` 422.
- Quyền `register`: `p.role!=='bot'`, dự án trong `p.projectIds`, `projectRole(p,projectId)` không phải `viewer`/`bot`; sai → bot/viewer `READ_ONLY` 403, ngoài phạm vi `SCOPE_DENIED` 404 câu chung `'Không tìm thấy tài liệu trong phạm vi được cấp.'`.
- Thân: `scoped(db,{...p,projectIds:[projectId]},tx=>deduplicate(tx,p,projectId,key,{op:'document.register',...input},async()=>{ INSERT … ON CONFLICT(tenant_id,project_id,canonical_uri) DO NOTHING RETURNING *; không có dòng → AppError('DOCUMENT_ALREADY_REGISTERED','Nguồn này đã có trong sổ của dự án.',409); chèn registry_events(kind:'document_registered'); trả detail }))`.
- `detail`: bot → `READ_ONLY`; `scoped` rồi đọc record, revisions (tăng theo `revision_no`), events; không thấy → `SCOPE_DENIED` 404 câu chung. Mỗi `source_links[]` được gắn `present` bằng cách tra `analytics.tech_source_tasks.source_ref` trong phạm vi.

**Ca kiểm viết trước** (`tests/documents.test.ts`, chạy PGlite và native)
- [ ] `register creates one record with an empty approved pointer and SOURCE_NOT_FROZEN` — `pm` đăng ký `{projectId:ids.sales,refCode:'DOC-DEMO-1',docType:'design',title:'Tài liệu tổng hợp số một',templateCode:'T3',sourceType:'drive',canonicalUri:'https://example.com/docs/demo-1',ownerLabel:'',reviewDueAt:null,metadata:{missingFields:[]},sourceLinks:[]}` → `record.version=1`, `latest_revision_id=null`, `approved_revision_id=null`, `freeze_state='SOURCE_NOT_FROZEN'`, `classification='unclassified'`, `revisions=[]`, đúng 1 sự kiện `document_registered`.
- [ ] `same key and same request replays; no second record` — gọi lại cùng `key` → cùng `record.id`; `count(*) document_records=1`, 1 sự kiện.
- [ ] `same key for a different document in the same project is IDEMPOTENCY_CONFLICT` — cùng `key`, `canonicalUri` khác → `{code:'IDEMPOTENCY_CONFLICT',status:409}`; vẫn 1 record. (Ca chéo dự án: **dừng tại OQ-24**, không viết.)
- [ ] `the same source cannot be registered twice in a project` — `key` mới, cùng `canonicalUri` → `DOCUMENT_ALREADY_REGISTERED` 409; cùng URI ở `ids.transport` (dự án khác) → thành công, lỗi/đáp không nhắc tới record của `ids.sales`.
- [ ] `malformed source pointers are rejected` (Review Focus 1) — `http://example.com/a`, `https://user:pw@example.com/a`, `'not a url'` → ném `ZodError`; `'  https://example.com/docs/x  '` → lưu `https://example.com/docs/x`.
- [ ] `identity, approval and snapshot fields in the body are rejected` — thêm lần lượt `tenantId`, `actorId`, `approvedRevisionId`, `classification`, `snapshotRef` → `ZodError`.
- [ ] `bot, viewer and outsider cannot register` — `bot` → `READ_ONLY`; `viewer` (`ids.transport`) → `READ_ONLY`; `outsider` với `projectId:ids.sales` → `SCOPE_DENIED`; `member` với `projectId:ids.transport` → `SCOPE_DENIED`; thông điệp không chứa tiêu đề hay tên dự án. Ca quyền âm (4).
- [ ] `document tables return nothing without RLS context` và `runtime cannot insert for another project or tenant` — như Task 7, cho `document_records`, `document_revisions`, `document_templates`. Ca (2)(3).
- [ ] `runtime cannot set the approved pointer, a verified hash or a snapshot` — trong `scoped(h.db,pm,…)`: `UPDATE document_records SET approved_revision_id=…` → ném (không có quyền cột); `INSERT document_revisions` với `hash_verification='verified'` → ném; với `snapshot_ref='x'` → ném. Ca (7).
- [ ] `no document table has a content column` — truy `information_schema.columns` của ba bảng: không cột kiểu `bytea`; không cột tên `content`, `body`, `snapshot`.
- [ ] `template index holds T0..T6 with the manifest hashes and refuses a reused version` — sau `syncTemplateIndex` trong `h.operator.transaction`: 7 dòng khớp `templateManifest`; gọi lần hai `inserted:0`; gọi với `T0` cùng version nhưng `sha256` khác → `TEMPLATE_VERSION_REUSED`.
- [ ] `tests/migrations-rollback.test.ts` tự phủ 014 (không sửa ca).

**Lệnh kiểm:** `npx vitest run tests/documents.test.ts tests/migrations-rollback.test.ts tests/foundation.test.ts` (PGlite và native), `npx tsc --noEmit`.

**Con trỏ:** brief `:29-31`, `:50`, `:67` · `SPEC-009…:137-138`, `:68-80`, `:147` · `PM-DOCUMENT-TEMPLATES.md:9-21` · ADR-002 «Bản chuẩn và hash».

### Task 10: Đề xuất revision — bất biến, hai con trỏ tách riêng (DOC-07)

**Mục tiêu:** mỗi đề xuất tạo một revision bất biến có hash mức tự khai và chỉ dời con trỏ «bản đang soạn»; con trỏ «bản chuẩn» không bao giờ bị thao tác này chạm tới.

**Tệp:** sửa `src/server/documents.ts`, `src/server/types.ts`; thêm ca vào `tests/documents.test.ts`; tạo `tests/documents-concurrency.test.ts`.

**Giao diện**
```ts
export type SourceRef={kind:'git_sha'|'url'|'z2_source_ref';label:string;value:string};
export type DocumentRevision={id:string;document_id:string;revision_no:number;based_on_revision_id:string|null;source_revision:string|null;source_hash:string|null;hash_verification:'self_declared';source_modified_at:string|null;snapshot_ref:null;changes:{summary:string;present:string[];missing:string[]};source_refs:SourceRef[];proposed_by:string;created_at:string};
// DocumentService
proposeRevision(p:Principal,documentId:string,raw:unknown,key:string):Promise<DocumentDetail>;
```
- Input (strict): `{expectedVersion:int>0, basedOnRevisionId:uuid|null, sourceRevision:string≤200|null, sourceHash:/^[a-f0-9]{64}$/|null, sourceModifiedAt:ISO datetime|null, changes:{summary 5..2000, present:string[]≤30, missing:string[]≤30 (phần tử ≤200)}, sourceRefs:SourceRef[]≤20 (label 1..80; kind 'git_sha' thì value khớp /^[a-f0-9]{40}$/; 'url' thì https không thông tin đăng nhập)}`.
- Thân: `scoped(db,p,…)`: `SELECT * FROM document_records WHERE id=$1 FOR UPDATE` (không thấy → `SCOPE_DENIED` 404); kiểm quyền như `register` theo `record.project_id`; `deduplicate(tx,p,record.project_id,key,{op:'document.propose_revision',documentId,basedOnRevisionId,expectedVersion,...input},action)`. Trong `action`: `record.version===expectedVersion` và `basedOnRevisionId===record.latest_revision_id`, sai → `REVISION_CONFLICT` 409 `'Tài liệu đã đổi. Đọc bản mới trước khi gửi lại.'`; `revision_no` = (max hiện có) + 1; chèn revision với `hash_verification='self_declared'`, `source_id=record.canonical_uri`, `source_type=record.source_type`, `quality_score=0`; `UPDATE document_records SET latest_revision_id=$new,version=version+1,updated_at=now()` — **không** chạm `approved_revision_id`; chèn `registry_events(kind:'revision_proposed', payload:{revisionNo,basedOnRevisionId,expectedVersion,sourceHash,hashVerification:'self_declared'})`.

**Ca kiểm viết trước**
- [ ] `proposing a revision moves only the draft pointer` (DOC-07) — sau `register`, đề xuất r1 (`expectedVersion:1,basedOnRevisionId:null`) → `latest_revision_id=r1`, `approved_revision_id=null`, `version=2`. `h.operator` đặt `approved_revision_id=r1` (mô phỏng bản duyệt của lát 3, **chỉ trong test**). Đề xuất r2 (`expectedVersion:2,basedOnRevisionId:r1`) → `latest_revision_id=r2`, `approved_revision_id` **vẫn r1**, `version=3`.
- [ ] `revisions are immutable and numbered without gaps` — `revisions.map(r=>r.revision_no)` là `[1,2]`; `h.operator` `UPDATE document_revisions …` và `DELETE …` → ném `Append-only history`; `DELETE FROM document_records` → ném.
- [ ] `every stored hash is self-declared and no snapshot exists` — `SELECT DISTINCT hash_verification` → `['self_declared']`; `count(*) WHERE snapshot_ref IS NOT NULL = 0`.
- [ ] `stale expectedVersion or stale base is REVISION_CONFLICT with no revision, event or version change` — `expectedVersion:1` khi đang 3 → 409; `basedOnRevisionId:r1` khi latest là r2 → 409; đếm revision, sự kiện, `version` trước/sau bằng nhau. Ca (6).
- [ ] `same key and same request replays; same key with another revision or document conflicts` — lặp nguyên lệnh r2 cùng `key` → trả detail như lần đầu, vẫn 2 revision; cùng `key` với `changes.summary` khác → `IDEMPOTENCY_CONFLICT`; cùng `key` cho tài liệu khác **cùng dự án** → `IDEMPOTENCY_CONFLICT`, tài liệu kia không đổi. Hàng R-01 của brief `:64`; ca (5).
- [ ] `the approved pointer cannot point at another document's revision` — `h.operator` đặt `approved_revision_id` của record A bằng revision của record B → ném vi phạm khoá ngoại.
- [ ] `bot and viewer cannot propose; fields outside the schema are rejected` — `READ_ONLY`; thêm `hashVerification:'verified'` hoặc `status:'approved'` → `ZodError`.
- [ ] `tests/documents-concurrency.test.ts`, `describe.skipIf(!native)` (Review Focus 5): **`two concurrent proposals on one version yield one revision and one REVISION_CONFLICT`** — giữ `FOR UPDATE` dòng record trong `h.operator.transaction`, khởi động hai `proposeRevision(pm,doc,sameInput,key khác nhau)`, `waitForBlocked(h,2)`, nhả. Mong đợi: 1 `fulfilled`, 1 `rejected` `{code:'REVISION_CONFLICT'}`; `revision_no` chỉ có `[1]`; `version=2`; 1 sự kiện `revision_proposed`.
- [ ] Cùng tệp: **`two identical concurrent proposals with one key apply once and replay once`** — hai lời gọi cùng `key`, cùng input → cả hai `fulfilled`, cùng `latest_revision_id`; 1 revision, 1 sự kiện.

**Lệnh kiểm:** `npx vitest run tests/documents.test.ts` (PGlite và native); native thêm `tests/documents-concurrency.test.ts`; `npx tsc --noEmit`.

**Con trỏ:** brief `:29`, `:58`, `:64`, `:67` ca (5)(6) · `SPEC-009…:73`, `:121`, `:138` · gói quyết định §4 R-01.

### Task 11: Migration 015 + projector chỉ mục Z2 (R-02) (+ tệp lùi) — **dừng tại OQ-22** phần nối vào đường chạy web

**Mục tiêu:** có bảng chiếu metadata tài liệu ở Z2 do projector có tên ghi, chạy lại không sinh bản sao, giữ lịch sử khi nguồn mất, ghi thời điểm chiếu.

**Tệp:** tạo `migrations/015_document_index_z2.sql`, `migrations/rollback/015_document_index_z2.sql`, `src/server/document-projector.ts`, `scripts/project-document-index.ts`, `tests/document-index.test.ts`; sửa `src/server/types.ts`.

**Bảng `analytics.document_index`:** `document_id uuid NOT NULL`, `ref_code text NOT NULL`, `doc_type text NOT NULL`, `title text NOT NULL`, `owner_label text NOT NULL`, `source_type text NOT NULL`, `latest_revision_no integer`, `approved_revision_no integer`, `hash_verification text`, `source_state text NOT NULL`, `freeze_state text NOT NULL`, `missing_count integer NOT NULL DEFAULT 0`, `review_due_at timestamptz`, `record_version integer NOT NULL`, `record_updated_at timestamptz NOT NULL`, `projected_at timestamptz NOT NULL`; `UNIQUE(tenant_id,project_id,document_id)`; FK `(project_id,tenant_id)` → `projects`, FK `(document_id,tenant_id,project_id)` → `document_records`; index `(tenant_id,project_id,created_at DESC)`, `(tenant_id,project_id,ref_code)`, `(document_id)`. **Không** có cột `canonical_uri` (mở nguồn luôn đi qua domain service).
- RLS `ENABLE` + `FORCE`. Policy theo mẫu `migrations/005_evidence_dashboards.sql:43-46`, `:49-53`: `index_projection` `FOR ALL TO libetech_projector` có `USING` và `WITH CHECK` phạm vi; `index_read` `FOR SELECT TO libetech_runtime USING` phạm vi.
- Quyền: `libetech_runtime` chỉ `SELECT`; `libetech_projector` `SELECT, INSERT, UPDATE` trên bảng chỉ mục và `SELECT` trên `document_records`, `document_revisions` (policy `scope_select` của 014 không giới hạn role nên áp luôn cho projector). **Không** có câu `GRANT … TO libetech_web`.
- Tệp lùi 015: `DROP TABLE IF EXISTS analytics.document_index;` + thu hồi `SELECT` của `libetech_projector` trên hai bảng tài liệu (bọc kiểm `to_regclass`) + xoá dòng `'015'`. Không xoá role `libetech_projector` (có từ 005).

**Giao diện**
```ts
// src/server/types.ts
export type DocumentIndexRow={document_id:string;project_id:string;ref_code:string;doc_type:DocType;title:string;owner_label:string;source_type:SourceType;latest_revision_no:number|null;approved_revision_no:number|null;hash_verification:'self_declared'|'verified'|null;source_state:SourceState;freeze_state:'SOURCE_NOT_FROZEN';missing_count:number;review_due_at:string|null;record_updated_at:string;projected_at:string};
// src/server/document-projector.ts — Z1 → Z2, có tên, chạy bằng login vận hành
export async function projectDocumentIndex(db:Database,tenantId:string,projectId:string):Promise<{rows:number;projectedAt:string}>;
```
- Thân: `db.transaction` → `SET LOCAL ROLE libetech_projector` → `set_config('app.tenant_id',…,true)`, `set_config('app.project_ids',projectId,true)` → một câu `INSERT INTO analytics.document_index(…) SELECT … FROM document_records r LEFT JOIN document_revisions l ON l.id=r.latest_revision_id LEFT JOIN document_revisions a ON a.id=r.approved_revision_id WHERE r.tenant_id=$1 AND r.project_id=$2 ON CONFLICT(tenant_id,project_id,document_id) DO UPDATE SET …, projected_at=now(), updated_at=now()` (mẫu `src/server/projector.ts:3-15`, `src/server/evidence-projector.ts:59-60`). `missing_count = jsonb_array_length(metadata->'missingFields') + jsonb_array_length(l.changes->'missing')` (coalesce về 0). Projector **không xoá** dòng nào.
- `scripts/project-document-index.ts`: đọc `MIGRATION_DATABASE_URL`, tham số `<tenantId> <projectId>`, gọi hàm trên, in JSON kết quả (mẫu `scripts/project-evidence.ts`). Chỉ là công cụ vận hành; **không** chạy lên DB thật trong lát này.

**Dừng tại OQ-22:** `DocumentService` không gọi projector; không route nào gọi projector; không cấp role cho `libetech_web`. Hệ quả ghi rõ trong biên nhận: trên một bản triển khai, tài liệu vừa đăng ký chỉ hiện trong tìm kiếm sau khi projector được chạy. Mọi test gọi `projectDocumentIndex(h.operator,…)` tường minh.

**Ca kiểm viết trước** (`tests/document-index.test.ts`, PGlite và native)
- [ ] `projector writes one index row per record and is idempotent` — 2 record ở `ids.sales` (một có 2 revision, một chưa có revision); chạy projector hai lần → `rows:2` cả hai lần; `count(*)=2`; dòng có revision: `latest_revision_no=2`, `approved_revision_no=null`, `hash_verification='self_declared'`; dòng kia: `latest_revision_no=null`. (R-02: chạy lại không tạo bản sao.)
- [ ] `projector records when it ran` — `projected_at` của lần hai ≥ lần một; `record_version` bằng `document_records.version`.
- [ ] `index is stale, not wrong, until the projector runs again` (Review Focus 4) — sau khi thêm revision 3 mà chưa chạy projector: dòng chỉ mục còn `latest_revision_no=2` và `record_updated_at` < `document_records.updated_at`; chạy lại → `3`.
- [ ] `the index returns nothing without RLS context and cannot be written by runtime` — `SET LOCAL ROLE libetech_runtime` không ngữ cảnh → 0 dòng; `scoped(h.db,pm,…)` `INSERT`/`UPDATE`/`DELETE` trên `analytics.document_index` → ném. Ca (2) cho bảng Z2.
- [ ] `projector is confined to the project it was given` — chạy cho `ids.sales` không tạo dòng nào của `ids.transport` hay tenant khác.
- [ ] `a lost source keeps its history` (DOC-18, R-02) — `h.operator` đặt `source_state='unavailable'`, `source_checked_at=now()` cho một record (mô phỏng adapter của lát sau); chạy projector → dòng chỉ mục còn đó với `source_state='unavailable'`; `count(*)` của `document_records`, `document_revisions`, `registry_events` không đổi; `detail()` vẫn trả đủ revision.
- [ ] `tests/migrations-rollback.test.ts` tự phủ 015; thêm khẳng định `analytics.tech_source_tasks` và `work_items` không đổi đã có sẵn.
- [ ] `describe.skipIf(!native)`: `the web login cannot assume the projector role` — `projectDocumentIndex(h.db,…)` (login `libetech_web`) ném lỗi quyền; ghi kết quả này vào OQ-22 như bằng chứng.

**Lệnh kiểm:** `npx vitest run tests/document-index.test.ts tests/migrations-rollback.test.ts` (PGlite và native), `npx tsc --noEmit`.

**Con trỏ:** brief `:34`, `:51`, `:62`, `:65`, `:79` · `SPEC-009…:75`, `:127`, `:131` · gói quyết định §4 R-02 · OQ-22.

### Task 12: Danh sách, tìm và xuất từ bản chiếu Z2 (DOC-10)

**Mục tiêu:** danh sách, tìm (tên, loại, mã) và xuất CSV chỉ đọc bảng chiếu Z2, kiểm quyền trước truy vấn và trước khi trả, không lộ tên hay số đếm ngoài phạm vi.

**Tệp:** tạo `src/server/document-index.ts`; thêm ca vào `tests/document-index.test.ts`.

**Giao diện**
```ts
export type DocumentIndexPage={rows:DocumentIndexRow[];total:number;projectedAt:string|null;source:'Z2'};
export async function findDocuments(db:Database,p:Principal,raw:unknown):Promise<DocumentIndexPage>;
export async function exportDocumentsCsv(db:Database,p:Principal,projectId:string):Promise<string>;
```
- `findDocuments` input (strict): `{projectId?:uuid, q?:string 1..100, docType?:DocType, limit?:1..200 (mặc định 50), offset?:≥0 (mặc định 0)}`.
- Kiểm quyền **trước truy vấn**: bot → `READ_ONLY`; `projectId` có mà không thuộc `p.projectIds` → `SCOPE_DENIED` 404 câu chung, **không** chạy câu SQL nào. Phạm vi truy vấn: `projectId` nếu có, ngược lại toàn bộ `p.projectIds`; chạy trong `scoped(db,{...p,projectIds:phạm vi},…)`.
- Truy vấn: `q` so `ILIKE '%'||$q||'%' ESCAPE '\'` trên `title`, `ref_code`, `doc_type`, sau khi thoát `\`, `%`, `_` trong `q`; sắp `record_updated_at DESC, document_id`. `total` đếm cùng điều kiện, cùng phạm vi. `projectedAt` = `min(projected_at)` của phạm vi (null nếu chưa chiếu).
- Kiểm **trước khi trả**: bỏ mọi dòng có `project_id` ngoài phạm vi; nếu có dòng bị bỏ thì ném `AppError('SCOPE_DENIED',câu chung,404)` (không trả một phần).
- `exportDocumentsCsv`: cùng kiểm quyền; tối đa 5000 dòng; dòng đầu `ma,loai,tieu_de,chu_noi_dung,nguon,ban_dang_soan,ban_chuan,muc_hash,trang_thai_nguon,dong_bang,thoi_diem_chieu`; `ban_dang_soan` = `r<n>` hoặc `Chưa có`; `ban_chuan` = `r<n>` hoặc `Chưa có`; `muc_hash` = `tự khai` / `đã kiểm` / rỗng; `dong_bang` = `SOURCE_NOT_FROZEN`. Mỗi ô bọc ngoặc kép, nhân đôi `"`; ô bắt đầu bằng `=`, `+`, `-`, `@`, tab hoặc CR thì thêm `'` phía trước.

**Ca kiểm viết trước**
- [ ] `list by project returns only that project's index rows with total and projectedAt` — `pm`, `projectId:ids.sales` → đúng các record của `ids.sales`; `source:'Z2'`; `total` khớp.
- [ ] `search matches title, type and code case-insensitively and treats wildcards literally` (Review Focus 2) — record tiêu đề `'Nâng package theo npm audit'`, `ref_code:'XECA006'`, và một record tiêu đề `'Báo cáo 100% hoàn_thành'`: `q:'nâng PACKAGE'` → 1 dòng; `q:'xeca006'` → 1; `q:'design'` khớp theo `doc_type`; `q:'%'` → chỉ record có ký tự `%`; `q:'_'` → chỉ record có `_`; `q:'\\'` → 0 dòng, không lỗi.
- [ ] `cross-project and cross-tenant reads are denied before any query` (DOC-10) — `member` (chỉ `ids.sales`) gọi với `projectId:ids.transport` và với `projectId:sameBuProject` (cùng BU, khác dự án — R-02) → `SCOPE_DENIED`; `outsider` với `ids.sales` → `SCOPE_DENIED`; thông điệp không chứa tiêu đề, `ref_code`, tên dự án hay chữ số đếm. `viewer` (`ids.transport`) không `projectId` → chỉ thấy dòng của `ids.transport`, không thấy `'LBRC014'` đăng ký ở `ids.sales` (ca (1)).
- [ ] `a principal recomputed after membership removal can no longer list, search or export` (R-02) — `before={...member}` thấy 1 dòng; `after={...member,projectIds:[sameBuProject],grants:[{projectId:sameBuProject,role:'engineer',reportPermissions:[]}]}` (như phiên được dựng lại sau khi gỡ membership `ids.sales`): `findDocuments(after,{projectId:ids.sales})` và `exportDocumentsCsv(after,ids.sales)` → `SCOPE_DENIED`; `findDocuments(after,{})` → 0 dòng, `total:0`.
- [ ] `bot cannot read the document index` — `READ_ONLY`.
- [ ] `limit is capped at 200 and unknown fields are rejected` — `limit:201` → `ZodError`; thêm `tenantId` → `ZodError`.
- [ ] `export has the fixed header, shows Chưa có for an empty approved pointer and neutralises formulas` (Review Focus 3) — record tiêu đề `'=HYPERLINK("http://x","y")'` và `'Tài liệu, có "ngoặc"\nxuống dòng'`: dòng đầu đúng chuỗi tiêu đề cột; ô tiêu đề thứ nhất bắt đầu bằng `"'=`; ô thứ hai giữ dấu phẩy và xuống dòng trong ngoặc kép, `"` thành `""`; cột `ban_chuan` là `Chưa có`; cột `muc_hash` là `tự khai`; không ô nào là `đã duyệt`.
- [ ] `export is denied across projects` — `member` xuất `ids.transport` → `SCOPE_DENIED`.

**Lệnh kiểm:** `npx vitest run tests/document-index.test.ts` (PGlite và native), `npx tsc --noEmit`.

**Con trỏ:** brief `:30`, `:34`, `:59`, `:65`, `:67` ca (1) · `SPEC-009…:75`, `:91`, `:147` · `DESIGN…:109`.

### Task 13: Mở liên kết nguồn và chỉ mục hai ca (DOC-13, DOC-14, PM-08)

**Mục tiêu:** mở nguồn có kiểm quyền lại mỗi lần; chứng minh trên dữ liệu tổng hợp rằng XECA006/XECA005 và LBRC014 lập chỉ mục được đúng yêu cầu mà không đổi nguồn Z2.

**Tệp:** sửa `src/server/documents.ts` (thêm `openSource`); tạo `tests/document-cases.test.ts`, `tests/slice1-cases.ts` (dữ liệu ca).

**Giao diện**
```ts
// DocumentService
openSource(p:Principal,documentId:string):Promise<{uri:string;sourceType:SourceType;sourceState:SourceState;title:string}>;
```
- Kiểm quyền lại ở mỗi lần gọi (như `detail`); `source_state` là `unavailable` hoặc `denied` → `AppError('SOURCE_UNAVAILABLE','Nguồn hiện không mở được. Lịch sử trong sổ vẫn còn.',409)`, không trả `uri`.

**`tests/slice1-cases.ts`** — dữ liệu ca **trong dự án tổng hợp**, giá trị chép từ hồ sơ đã có trong repo, không gọi nguồn ngoài:
- `xeca006`: `{refCode:'XECA006',docType:'design',templateCode:'T3',title:'Nâng package theo npm audit',sourceType:'drive',canonicalUri:'https://example.com/synthetic/xeca006-change-brief',metadata:{missingFields:['repo/phạm vi package','báo cáo trước–sau','commit/lockfile','ảnh hưởng tương thích','acceptance','rollback','bản thực thử']},sourceLinks:[{kind:'z2_source_ref',value:'Đầu việc Tech!A42:H42'}],ownerLabel:'',reviewDueAt:null}` (`PM-DOCUMENT-TEMPLATES.md:135-137`, `DESIGN…:35-38`).
- `xeca005`: `{refCode:'XECA005',docType:'design',title:'Nâng cấp Fastify, JWT',canonicalUri:'https://example.com/synthetic/xeca005-change-brief',sourceType:'drive',ownerLabel:'',reviewDueAt:null,metadata:{missingFields:[]},sourceLinks:[{kind:'z2_source_ref',value:'Đầu việc Tech!A34:H34'}]}` (`SPEC-008…:124`).
- `lbrc014`: `{refCode:'LBRC014',docType:'verification',templateCode:'T5',title:'LBRC014 — hồ sơ kiểm chứng và bằng chứng',canonicalUri:'https://example.com/synthetic/lbrc014-evidence',sourceType:'drive',ownerLabel:'',reviewDueAt:null,metadata:{missingFields:[]},sourceLinks:[]}`; `lbrc014R1` (`sourceHash:null`, `sourceModifiedAt:null`): `sourceRevision:'8d05141576bcd4db8e7ab9f1a6b7a0dd9bd360ab'`, `sourceRefs:[{kind:'git_sha',label:'mốc chức năng',value:'8d05141576bcd4db8e7ab9f1a6b7a0dd9bd360ab'},{kind:'git_sha',label:'mốc bàn giao Android 1.0.27+29',value:'5b38598de8bca1b258be7ee4b7086a993810478a'}]`, `changes:{summary:'Hồ sơ kỹ thuật và gói Android',present:['hồ sơ kỹ thuật','gói Android'],missing:['bổ sung iOS','U4','U6','nguồn kiểm U7','người dùng nghiệp vụ xác nhận']}`; `lbrc014R2` (`sourceHash:null`, `sourceModifiedAt:null`): `sourceRevision:'751327b853b50ed7b06f87c747198a4a731b0ac6'`, `sourceRefs:[{kind:'git_sha',label:'báo cáo iOS main@751327b',value:'751327b853b50ed7b06f87c747198a4a731b0ac6'}]`, `changes:{summary:'Bổ sung iOS 15:02 ngày 09/11: báo cáo và tám ảnh',present:['báo cáo iOS','tám ảnh','U5','U7'],missing:['U4','U6','mối nối build 1.0.27','người dùng nghiệp vụ xác nhận']}` (`PM-DOCUMENT-TEMPLATES.md:142-145`, `SPEC-009…:163-167`).
- Hai dòng nguồn tổng hợp trong `analytics.tech_source_tasks` (do `h.operator` chèn) với `source_ref` `'Đầu việc Tech!A42:H42'`, `'Đầu việc Tech!A34:H34'`, `source_status` `'Đang triển khai'` / `'Hoàn thành'`.

**Ca kiểm viết trước** (PGlite và native). Tên ca Xeca mang hậu tố `(synthetic — chờ tin gốc)`.
- [ ] `DOC-13 XECA006 and XECA005 are two separate index entries (synthetic — chờ tin gốc)` — đăng ký cả hai ở `ids.transport`, chạy projector: 2 `document_id` khác nhau, 2 `ref_code` khác nhau, `canonical_uri` khác nhau; `findDocuments(pm,{projectId:ids.transport,q:'XECA006'})` → đúng 1 dòng.
- [ ] `XECA006 lists its missing fields as Chưa có and has no approved baseline (synthetic — chờ tin gốc)` — `detail.record.metadata.missingFields` có 7 mục như trên; `approved_revision_id=null`; dòng chỉ mục `missing_count=7`, `approved_revision_no=null`.
- [ ] `DOC-14 LBRC014 keeps the earlier revision and the iOS supplement, with what is present and what is missing` — đăng ký ở `ids.sales`, đề xuất R1 rồi R2: `revisions.length=2`; R1 không bị sửa (so sâu với lần đọc trước khi có R2); tập hợp `source_refs.value` của hai revision chứa đủ **ba** SHA; R2 có `changes.present` chứa `'báo cáo iOS'` và `changes.missing` chứa `'U4'`, `'U6'`; `latest_revision_id=R2.id`, `approved_revision_id=null` — hai con trỏ tách riêng, bản chuẩn «Chưa có».
- [ ] `source links keep the Z2 source_ref labelled chưa đối soát and create no work item` — `detail.record.source_links[0]` bằng `{kind:'z2_source_ref',value:'Đầu việc Tech!A42:H42',label:'chưa đối soát',present:true}`; `count(*) work_items` trước/sau bằng nhau.
- [ ] `PM-08 indexing leaves the Z2 source rows unchanged` — `count(*)` và `md5(string_agg(fingerprint||source_status,',' ORDER BY source_row))` của `analytics.tech_source_tasks` trước khi đăng ký và sau khi chạy projector bằng nhau; `source_status` của dòng LBRC vẫn `'Hoàn thành'`.
- [ ] `DOC-18 a vanished source row leaves the record and its history` — `h.operator` xoá dòng `tech_source_tasks` có `source_ref='Đầu việc Tech!A42:H42'`: `detail` vẫn trả record + revisions; liên kết thành `present:false`; không record nào bị xoá.
- [ ] `openSource re-checks scope on every call and never leaks across projects` (DOC-10 «mở tệp») — `pm` mở tài liệu LBRC014 → `uri` đúng; `viewer` (chỉ `ids.transport`) và `outsider` mở cùng `documentId` → `SCOPE_DENIED` 404, thông điệp không chứa `'LBRC014'`; `bot` → `READ_ONLY`; sau khi `h.operator` đặt `source_state='unavailable'` → `pm` nhận `SOURCE_UNAVAILABLE` và `detail` vẫn đủ lịch sử.
- [ ] `no reporting-domain row exists after indexing both cases` — `count(*) project_domain_mappings=0`.

**Lệnh kiểm:** `npx vitest run tests/document-cases.test.ts` (PGlite và native).

**Con trỏ:** brief `:32`, `:60-63`, `:69`, `:81` · OQ-05 (a), OQ-06 (a) · `SPEC-005-source-exception-slice.md:9` · `HANDOFF-CLAUDE-CODE-20261111.md:99`.

### Task 14: Handler HTTP mỏng

**Mục tiêu:** đưa các thao tác ra web qua handler chỉ làm ba việc: lấy principal từ phiên, gọi service, bọc `success`/`failure`.

**Tệp:** tạo `src/server/documents-http.ts`, `src/app/api/documents/[[...path]]/route.ts`, `src/app/api/projects/[...path]/route.ts`, `tests/documents-http.test.ts`.

**Giao diện:** `export async function handleDocumentsApi(request:Request,parts:string[],db:Database):Promise<Response>` — `parts[0]` là `'documents'` hoặc `'projects'`; hai tệp route chỉ ghép `parts` rồi gọi hàm này (mẫu `src/app/api/v1/[...path]/route.ts`). Principal chỉ lấy bằng `authenticatedPrincipal(request)`; POST/PUT gọi `checkOrigin(request)`; thân đọc bằng `body()` (`src/server/http.ts:16-18`); khoá lấy từ header `idempotency-key`; đáp bằng `success`/`failure`.

| Tên logic (`SPEC-009…:143`) | Tuyến | Gọi |
|---|---|---|
| đăng ký tài liệu | `POST /api/documents/register` | `DocumentService.register` → 201 |
| đề xuất revision | `POST /api/documents/:id/revision-proposals` | `proposeRevision` |
| danh sách theo dự án | `GET /api/documents?projectId=` | `findDocuments` |
| tìm trong sổ | `GET /api/documents/search?q=&projectId=&docType=&limit=&offset=` | `findDocuments` |
| xuất danh sách | `GET /api/documents/export?projectId=` | `exportDocumentsCsv` → `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="tai-lieu.csv"`, `Cache-Control: no-store` |
| chi tiết | `GET /api/documents/:id` | `detail` |
| mở liên kết nguồn | `GET /api/documents/:id/source` | `openSource` (trả JSON, không redirect) |
| sổ dự án | `GET /api/projects/:id/registry` · `PUT /api/projects/:id/profile` · `POST /api/projects/:id/channels` | `ProjectRegistryService` |

Tuyến khác → `NOT_FOUND` 404. Các tuyến này thuộc lớp **web** (không phải bridge); cập nhật allowlist proxy (`SPEC-009…:145`) là việc triển khai — điểm dừng, không làm ở lát này.

**Ca kiểm viết trước** (dựng `Request` như `tests/foundation.test.ts:16`, phiên demo loopback)
- [ ] `register → propose → list → search → export → source round trip over HTTP` — manager: 201, rồi 200 cho từng bước (chạy `projectDocumentIndex` giữa chừng); đáp có dạng `{data,error:null,meta:{requestId}}`.
- [ ] `a body carrying tenantId or actorId is INVALID_INPUT` — 422, không dòng nào được tạo.
- [ ] `a write without Idempotency-Key is IDEMPOTENCY_REQUIRED` — 400.
- [ ] `a request without a session is 401 and a foreign Origin is rejected` — không cookie → 401; `origin:'https://evil.example'` → bị từ chối, không ghi.
- [ ] `bot and viewer sessions get 403; another project's document id gets 404 with the generic message` — thân lỗi không chứa tiêu đề.
- [ ] `the same document URI registered twice returns DOCUMENT_ALREADY_REGISTERED, not DUPLICATE_CODE` — 409 đúng mã.
- [ ] `export responds with text/csv and no-store`.

**Lệnh kiểm:** `npx vitest run tests/documents-http.test.ts`, `npx tsc --noEmit`.

**Con trỏ:** brief `:9`, `:30`, `:43` · `SPEC-009…:143-147` · `AGENTS.md:9`, `:13`.

### Task 15: Màn «Tài liệu dự án» và đặc tả bàn giao giao diện

**Mục tiêu:** màn danh sách tài liệu theo dự án, đủ bốn trạng thái màn và sáu trạng thái nguồn, dùng được ở 360px và ≥1200px, kèm đặc tả bàn giao sáu mục.

**Tệp:** tạo `src/app/documents/page.tsx`, `src/app/documents/loading.tsx`, `src/app/documents/error.tsx`, `src/components/documents.tsx`, `src/components/documents-view.ts`, `tests/documents-ui.test.tsx`, `docs/UI-HANDOFF-1-documents.md`; sửa `src/app/globals.css` (chỉ thêm lớp tiền tố `.doc-`), `src/components/workspace.tsx:39` (thêm liên kết `<a href="/documents">Tài liệu dự án</a>` vào `team-links`).

**Giao diện**
```ts
// src/components/documents-view.ts — thuần, không React, không fetch
export type PageState='loading'|'error'|'denied'|'empty'|'ready';
export function pageState(input:{loading:boolean;error:string|null;denied:boolean;rows:number}):PageState;   // ưu tiên: loading > denied > error > empty > ready
export const SOURCE_STATE_VIEW:Record<SourceState,{label:string;nextStep:string;tone:'neutral'|'warn'|'error'}>;
export function approvedLabel(revisionNo:number|null):string;        // null → 'Chưa có'
export function draftLabel(revisionNo:number|null,missing:number):string; // null → 'Chưa có'; 'r2 · Cần bổ sung' khi missing>0; 'r2' khi 0
export function hashLabel(v:'self_declared'|'verified'|null):string;  // 'Hash tự khai — chưa kiểm' | 'Hash đã kiểm' | 'Chưa có hash'
export function freshnessLabel(projectedAt:string|null,recordUpdatedAt:string):string; // null → 'Chưa chiếu'; cũ hơn → 'Chưa kiểm mới · chiếu lúc …'; ngược lại 'Chiếu lúc …'
// src/components/documents.tsx
export function DocumentCard(props:{row:DocumentIndexRow;projectLabel:string;canOpen:boolean}):JSX.Element;
export function SourceAvailability(props:{state:SourceState;lastSuccessAt:string|null}):JSX.Element;
export function DocumentsBody(props:{state:PageState;rows:DocumentIndexRow[];projectedAt:string|null;canRegister:boolean;error:string|null;projectLabel:string}):JSX.Element;
export function Documents(props:{projects:{id:string;name:string}[];projectId:string|null;initial:DocumentIndexPage|null;denied:boolean;canRegister:boolean;templates:{code:string;title:string}[]}):JSX.Element; // 'use client'
```
- Nhãn sáu trạng thái nguồn (`DESIGN…:82-86`), nguyên văn: `fresh` «Nguồn vừa kiểm»; `stale` «Nguồn chưa kiểm mới»; `unavailable` «Nguồn không mở được»; `denied` «Không đủ quyền xem nguồn»; `not-configured` «Chưa cấu hình kiểm nguồn»; `partially-received` «Mới nhận một phần». Trạng thái `denied` không hiện metadata nguồn.
- Bốn trạng thái màn (`DESIGN…:90-99`): `loading` — skeleton trong vùng dữ liệu, `aria-busy="true"`, giữ tiêu đề, không hiện số 0; `empty` — «Chưa có tài liệu đã đăng ký», nút «Đăng ký tài liệu» chỉ khi `canRegister`, nếu không thì dòng lý do «Cần quyền thành viên dự án để đăng ký»; `error` — `role="alert"`, câu lỗi + nút «Thử lại», giữ bộ lọc; `denied` — «Tài khoản chưa được cấp dự án này», **không** hiện tên dự án, số đếm hay ô tìm. «Không có dữ liệu» và «bị chặn» là hai khối chữ khác nhau.
- Thẻ tài liệu theo `DESIGN…:35-39`: tiêu đề, `ref_code`, chủ nội dung (rỗng → «Chưa có»), `freshnessLabel`, dòng «Bản chuẩn: Chưa có» là **nhãn trung tính** (lớp `.doc-tag-neutral`, không dùng màu teal/xanh), «Bản đang soạn: r2 · Cần bổ sung», `hashLabel`, `SourceAvailability`, một hành động chính «Mở nguồn» (gọi `GET /api/documents/:id/source` rồi mở `uri` bằng `target="_blank" rel="noreferrer"`). Không chuỗi «đã duyệt», «đã kiểm» nào xuất hiện ở lát này trừ `hashLabel('verified')` (không dữ liệu nào tới được nhánh đó).
- `page.tsx`: lấy phiên như `src/app/feedback/page.tsx:9-12` (không có phiên → `/login`); đọc `?projectId=`; không thuộc `principal.projectIds` → `denied`; ngược lại `findDocuments`. Gọi API ở client qua `src/components/api.ts`, không fetch trong JSX.
- CSS: chỉ thêm lớp `.doc-*`; token sẵn có (`--navy`, `--teal`, `--ink`, `--muted`, `--line`, `--bg`, `--amber`, `--radius`), khoảng cách theo thang 4/8/12/16/24/32, chữ thân ≥14px, nhãn phụ ≥12px; nút và liên kết hành động `min-height:44px; min-width:44px`; ở `max-width:700px` thẻ một cột, bộ lọc xếp dọc, SHA/URL `overflow-wrap:anywhere`; không phần tử nào có chiều rộng cố định > 328px; ở `min-width:1200px` danh sách dạng bảng hàng (`DocumentCard` biến thể row) với cột cố định. Breakpoint dùng lại 700/950/1200 (`src/app/globals.css:7-9`).

**Ca kiểm viết trước** (`tests/documents-ui.test.tsx`, dùng `renderToStaticMarkup` của `react-dom/server` — không thêm dependency)
- [ ] `pageState ranks loading, denied, error, empty, ready` — năm đầu vào → năm kết quả theo thứ tự ưu tiên trên.
- [ ] `each of the four non-ready states renders its own copy` — `DocumentsBody` với từng trạng thái: `loading` có `aria-busy="true"` và không có `>0<`; `empty` có «Chưa có tài liệu đã đăng ký»; `error` có `role="alert"` và «Thử lại»; `denied` có «Tài khoản chưa được cấp dự án này» và **không** chứa `projectLabel`.
- [ ] `empty and denied are different text` — hai markup khác nhau và không chứa câu của nhau.
- [ ] `all six source states render distinct labels` — sáu `SourceAvailability` cho sáu markup đôi một khác nhau, mỗi cái chứa đúng nhãn ở trên.
- [ ] `an empty approved pointer renders the neutral Chưa có tag` — `DocumentCard` với `approved_revision_no:null` chứa `Bản chuẩn: ` + `Chưa có` trong phần tử có lớp `doc-tag-neutral`; markup không chứa «đã duyệt».
- [ ] `a self-declared hash is never shown as verified` — chứa «Hash tự khai — chưa kiểm», không chứa «Hash đã kiểm».
- [ ] `a stale projection is labelled` — `freshnessLabel('2026-11-12T01:00:00Z','2026-11-12T02:00:00Z')` bắt đầu bằng «Chưa kiểm mới».
- [ ] `long hashes and URLs do not force a fixed width` — đọc `src/app/globals.css`: mọi khai báo `width:`/`min-width:` trong các luật `.doc-` có giá trị px ≤ 328 hoặc là `%`/`auto`/`44px`.

**Kiểm tay (ghi vào `docs/UI-HANDOFF-1-documents.md`, kèm ảnh trong `docs/screenshots/`):** chạy bản local có đăng nhập (`scripts/setup-local-verification.ts` — đọc trước khi dùng) và chụp ở 360×740 và 1280×800 cho: danh sách có dữ liệu, rỗng, không quyền, lỗi (ngắt API), đang tải (giảm tốc mạng). Ở 360px trang không cuộn ngang. Repo không có công cụ test trình duyệt; không thêm Playwright khi chưa được duyệt.

**`docs/UI-HANDOFF-1-documents.md` — đủ sáu mục:** (1) Bố cục — vùng, thứ tự đọc, biến thể card/row/detail header; (2) Token — bảng token dùng và giá trị, lớp `.doc-*`; (3) Props thành phần — `DocumentCard`, `SourceAvailability`, `DocumentsBody`, `Documents` đúng chữ ký trên; (4) Trạng thái — bốn trạng thái màn, sáu trạng thái nguồn, nhãn «Chưa có», «tự khai», «chưa đối soát», «Chưa xác nhận»; (5) Breakpoint — 360, 700, 950, 1200 và thay đổi ở mỗi mốc; (6) Edge case — tiêu đề dài, SHA 40/64 ký tự, URL dài, 0 và 200 dòng, chỉ mục cũ hơn Z1, nguồn mất, dự án chưa ánh xạ miền. Cuối tệp: danh sách việc chưa làm (đo contrast, zoom 200%, screen reader — `DESIGN…:107`).

**Lệnh kiểm:** `npx vitest run tests/documents-ui.test.tsx`, `npx tsc --noEmit`, `npm run build`.

**Con trỏ:** brief `:12`, `:71-72`, `:80` · `DESIGN-SYSTEM-PM-DOCUMENTS.md:13-23`, `:29-44`, `:56-60`, `:82-86`, `:90-103` · `HANDOFF-CLAUDE-CODE-20261111.md:90`.

### Task 16: Kiểm toàn bộ

**Mục tiêu:** một lần chạy đầy đủ trên cả hai động cơ, có output cho phiên điều phối lập biên nhận.

**Tệp:** sửa `vitest.config.ts` (thêm vào `coverage.include`: `src/server/feedback.ts`, `src/server/documents.ts`, `src/server/document-index.ts`, `src/server/document-projector.ts`, `src/server/projects-registry.ts`, `src/server/integration-status.ts`; giữ ngưỡng 60).

- [ ] `npx vitest run` — toàn bộ xanh trên PGlite; ghi số tệp/số ca; các khối native báo skipped.
- [ ] `set -a; . "$SLICE1_ENV_FILE"; set +a; npx vitest run tests/slice1-harness.test.ts tests/feedback-idempotency.test.ts tests/feedback-concurrency.test.ts tests/migrations-rollback.test.ts tests/project-registry.test.ts tests/documents.test.ts tests/documents-concurrency.test.ts tests/document-index.test.ts tests/document-cases.test.ts` — xanh, **không** ca nào skipped; lưu output đã che URL.
- [ ] `npx vitest run --coverage` — bốn ngưỡng ≥ 60.
- [ ] `npx tsc --noEmit` — không lỗi.
- [ ] `npm run build` — thành công.
- [ ] `python3 -m pytest tests/test_bot_bridge.py -q` — xanh (không chạm bot; chạy để chứng minh).
- [ ] `git status --short` — không tệp nào trong `bot-plugin/`, `deploy/`, `AGENTS.md`, `migrations/0{01..12}_*`; `git grep -n "project_domain_mappings" -- migrations src scripts` không có câu `INSERT INTO project_domain_mappings` nào (dòng chèn duy nhất nằm trong `tests/`, cho dự án tổng hợp).
- [ ] `git grep -n "55471\|SLICE1_" -- . ':!docs/plans' ':!tests' ':!scripts/slice1-native-prepare.ts'` — không kết quả; không tệp nào chứa mật khẩu.
- [ ] Đối chiếu «Đạt khi» của brief `:77-83`, lập bảng ca ↔ tệp test cho phiên điều phối: DOC-01 (Task 8), DOC-07 (10), DOC-10 (12, 13, 14), DOC-13/14 (13), DOC-18 (11, 13), PM-08 (7, 13), R-01 (2, 3, 10), R-02 (11, 12), chín ca quyền âm (7–13). Ghi rõ: ca Xeca «chờ tin gốc»; phần dừng tại OQ-22, OQ-23, OQ-24.

---

## Phần dừng và chỗ chưa chắc

**Dừng (không tự chọn):**
- **OQ-22** — nối projector vào đường chạy web và role của nó (Task 11). Bảng, projector, tìm/xuất, test vẫn đủ.
- **OQ-23** — nguồn bằng chứng cho nhãn «đã kiểm thực tế» (Task 5). Mô hình ba trạng thái và số bản vẫn đủ.
- **OQ-24** — dùng lại mã thao tác ở dự án khác cho thao tác tài liệu (Task 9, 10). Các ca cùng dự án vẫn đủ.

**Chưa chắc — reviewer kiểm:**
1. `registry_events` là bảng audit mới vì `audit_events.work_id` bắt buộc (`migrations/001_foundation.sql:48`) và brief cấm sửa cột cũ; ADR-002 không nêu tên bảng này trong bảng AR-09 (coi là phần của metadata quản trị do AI OS giữ).
2. `document_revisions` không có cột `status` dù `SPEC-009…:138` liệt kê: revision bất biến nên trạng thái suy từ hai con trỏ của record; lát 3 thêm ReviewDecision.
3. Ba nhãn miền là `CHECK` trên bảng ánh xạ, không phải bảng riêng. Lát 1 **không** có đường ghi ánh xạ (ai là «người có quyền» chưa định; brief giao lát 1 phần schema) — nếu cần đường ghi ở lát 1 thì phải có quyết định.
4. `source_state` chỉ được lưu và hiển thị; lát 1 không có ai ghi (chưa có adapter). DOC-18 kiểm bằng cách login vận hành đặt trạng thái trong test và bằng việc dòng nguồn Z2 biến mất.
5. `classification` cố định `'unclassified'`; `project_profiles.status` nhận bốn giá trị do planner đặt (`proposed/active/paused/closed`) — SPEC không liệt kê.
6. `canonical_uri` chỉ nhận URL `https`; con trỏ Vault dạng đường dẫn chưa được hỗ trợ cho tài liệu (hồ sơ dự án có `vault_pointer` dạng chữ). Trùng nguồn so theo `href` nguyên văn, phần `#…` khác nhau được coi là hai nguồn.
7. `quality_score` dùng thang 0–1 theo repo, không phải 0–100 của E-EXT-01.
8. Task 3: hành vi `ON CONFLICT DO NOTHING` khi dòng trùng bị RLS che chưa được chạy thử (hook chặn lệnh thử có DDL); ca native quyết định giữ hay bỏ nhánh bắt `23505`.
9. Task 2 đổi thứ tự lỗi: khoá đã dùng + report không tồn tại nay trả `SCOPE_DENIED` thay vì `FEEDBACK_KEY_CONFLICT`.
10. Không có test tự động theo viewport; 360px/≥1200px kiểm bằng ảnh chụp tay và một ca đọc CSS.
11. Dùng lại role `libetech_projector` (đang có quyền ghi `analytics.evidence_runs`) theo con trỏ brief; OQ-22 có thể đổi sang role hẹp riêng.
12. Bot không được đọc sổ tài liệu ở lát 1 (không có thao tác cầu nối nào được giao); DOC-01 kiểm qua thao tác `reconciliation` sẵn có.

---

## Bổ sung sau quyết định của Chairman ngày 12/11/2026 (phiên điều phối ghi)

- **OQ-22** «(b) Login vận hành (Recommended)» — trùng phần đã làm ở Task 11: projector chỉ chạy bằng login vận hành qua `scripts/project-document-index.ts`; giao diện hiện thời điểm chiếu; không cấp role cho `libetech_web`; job trên d1-ai1 là điểm dừng triển khai. Hết «dừng».
- **OQ-23** «(a) Chưa bật (Recommended)» — trùng phần đã làm ở Task 5: `bridgeVerifiedAt()` luôn `null`. Hết «dừng».
- **OQ-24** «(b) Từ chối, chỉ tài liệu (Recommended)» — việc mới, Task 17.

### Task 17: OQ-24 (b) — khoá lệnh tài liệu duy nhất theo người, không theo dự án

**Mục tiêu:** cùng một mã thao tác của cùng một người không được dùng cho thao tác tài liệu ở dự án khác; xung đột trả 409, kể cả khi RLS giấu dòng cũ. Không đụng `WorkService`, bảng `commands`, hay sổ dự án (`ProjectRegistryService` vẫn dùng `deduplicate`).

**Tệp:** sửa `migrations/014_document_registry.sql`, `migrations/rollback/014_document_registry.sql`, `src/server/documents.ts`, `tests/documents.test.ts`, `tests/documents-concurrency.test.ts`.

**Bảng `document_commands`** (trong 014, chưa áp lên DB thật nào): `id uuid PK DEFAULT gen_random_uuid()`, `tenant_id uuid NOT NULL`, `project_id uuid NOT NULL`, `actor_id uuid NOT NULL`, `command_key text NOT NULL`, `request_hash text NOT NULL`, `response jsonb`, `created_at`/`updated_at timestamptz NOT NULL DEFAULT now()`; FK `(project_id,tenant_id)` → `projects(id,tenant_id)`; **`UNIQUE(tenant_id,actor_id,command_key)`** (không có `project_id`); index `(tenant_id,project_id,created_at DESC)`; RLS `ENABLE` + `FORCE`, `scope_select`, `scope_insert`, `scope_update` (USING + WITH CHECK theo mẫu 013); quyền `libetech_runtime`: `SELECT`, `INSERT`, `UPDATE(response,updated_at)`. Tệp lùi 014 xoá cả bảng này.

**Mã:** hàm riêng trong `documents.ts` (ví dụ `claimDocumentCommand(tx,p,projectId,key,input,action)`): kiểm khoá như `deduplicate` (`IDEMPOTENCY_REQUIRED` 400); `INSERT … ON CONFLICT (tenant_id,actor_id,command_key) DO NOTHING RETURNING id`; không có dòng → `SELECT request_hash,response FROM document_commands WHERE tenant_id=$1 AND actor_id=$2 AND command_key=$3` (theo RLS): thấy và cùng hash → trả `response` (replay); khác hash **hoặc không thấy** (dòng cũ ở dự án RLS che) → `AppError('IDEMPOTENCY_CONFLICT','Mã thao tác đã được dùng với nội dung khác.',409)`; lỗi `23505` nếu có cũng đổi thành mã 409 này. `register` và `proposeRevision` chuyển sang hàm này; dấu vân tay giữ nguyên.

**Ca kiểm viết trước** (PGlite và native):
- `same key reused to register in another project is IDEMPOTENCY_CONFLICT and creates nothing there` — `pm` đăng ký ở `ids.sales` bằng `k`, rồi đăng ký tài liệu khác ở `ids.transport` bằng `k` → 409; `ids.transport` không có record mới.
- `same key reused for a revision in another project is IDEMPOTENCY_CONFLICT` — `k` dùng cho đăng ký ở `ids.sales`, rồi `proposeRevision` một tài liệu ở `ids.transport` bằng `k` → 409, không revision mới, version không đổi.
- `document operations no longer write to the shared commands table` — `count(*) commands` trước/sau đăng ký + đề xuất bằng nhau.
- `document_commands returns nothing without RLS context and rejects another project or tenant` — như các bảng khác.
- Native (`describe.skipIf(!native)`): `one key raced across two projects applies once and conflicts once`.
- Các ca cũ (cùng khoá cùng yêu cầu → replay; cùng khoá khác tài liệu cùng dự án → `IDEMPOTENCY_CONFLICT`) giữ xanh.
