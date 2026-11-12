# Brief năm lát lập trình — LibeTech AI OS

Version 0.2 · 12/11/2026 (0.1 lập 11/11) · Lập bởi agent `planner` theo `HANDOFF-CLAUDE-CODE-20261111.md:44`. Lệnh `/slice <số>` chỉ đọc brief của lát đó và các đoạn được trỏ tới; không nạp nguyên SPEC-008/009. Con trỏ ghi `tệp:dòng`; tài liệu nằm trong `docs/`, mã tính từ gốc repo. Số dòng kiểm bằng `grep -n`/`sed -n` ngày 11/11 và 12/11; tệp đổi thì kiểm lại trước khi dùng. Cả 21 câu hỏi mở đã có quyết định hướng ngày 12/11/2026 — xem [DECISION-PACK-OQ-20261112](DECISION-PACK-OQ-20261112.md) bản 0.2 và [OPEN-QUESTIONS](OPEN-QUESTIONS.md) 0.2. Brief này đã áp các quyết định đó; chỗ còn ghi «dừng» là điểm dừng thật. Gặp điều SPEC không nói mà chưa có mã OQ thì ghi OQ mới và dừng đúng phần bị ảnh hưởng, không tự chọn.

## Quy ước chung cho cả năm lát

- **Thứ tự:** 1 → 4; không mở lát sau khi lát trước chưa có biên nhận đạt (`HANDOFF…:63`). Lát 5 ở đợt này chỉ là hai bản nháp hồ sơ, lập trình sau pilot (OQ-18). Ngoài phạm vi: P2 Dev Factory, gói điều hành mở rộng SPEC-008 và Score nhân sự (`HANDOFF…:60-61`).
- **Nhánh:** làm và review trên `libetech-ai-os`; `main` của ai-together giữ cho lab; phát hành d1-ai1 theo tuyến riêng, mỗi đợt một lần duyệt (Chairman 12/11).
- **Kiến trúc:** handler mỏng → domain service → repository có phạm vi (`AGENTS.md:9`); mọi ghi nằm trong `scoped()` (`src/server/db.ts:33-39`), có `expectedVersion`, khoá chống lặp qua `deduplicate` (`src/server/service.ts:57`) với đầu vào băm gồm đủ thao tác + định danh đối tượng + `expectedVersion` (R-01) và sự kiện audit bất biến. Không nhận actor/tenant từ thân yêu cầu (`AGENTS.md:13`). Phản hồi theo `success`/`failure` (`src/server/http.ts:7-8`).
- **Migration:** đánh số tiếp từ 013 theo thứ tự merge (số trong brief là dự kiến); UUID PK, `timestamptz`, `tenant_id` + `project_id`, khoá ngoại theo phạm vi, index FK + `created_at` cùng tệp, RLS `ENABLE` + `FORCE` với cả `USING` và `WITH CHECK` theo mẫu `migrations/011_team_source_catalog.sql:31-38`; bọc `BEGIN…COMMIT`, `IF NOT EXISTS`, ghi `schema_migrations`. Rollback bắt buộc từ 013: tệp cùng số ở `migrations/rollback/` — runner chỉ đọc tên tệp trực tiếp trong `migrations/` (`scripts/migrate.ts:12`, `src/server/db.ts:11`) — thử tiến → lùi → tiến trên bản sao; không viết bù cho 001–012 (OQ-20). Bảng lịch sử gắn trigger chặn sửa/xoá như `migrations/001_foundation.sql:92-95`.
- **Tách miền báo cáo:** mọi danh sách, tổng hợp, export, thông báo tách Liberico BU · Xeca · IBS HI, không cộng gộp (`HANDOFF…:74`). Ba nhãn là nhãn miền báo cáo, không phải tenant, BU hay pháp nhân; giữ nguyên project ID, membership, RLS. Dòng ánh xạ dự án → nhãn do người có quyền tạo hoặc xác nhận kèm nguồn; mã, migration, seed và fixture **không** chứa dòng ánh xạ nào cho dự án thật, kể cả LibeTech nội bộ. Dự án chưa ánh xạ hiện «Chưa xác nhận», không vào tổng nào (OQ-04, `ADR-002…:32`). IBS HI chỉ lưu con trỏ, hash, metadata việc Tech (`SPEC-009…:80`, `SPEC-008…:106`).
- **Giao diện:** mỗi màn mới đủ bốn trạng thái rỗng / lỗi / đang tải / không có quyền theo `DESIGN-SYSTEM-PM-DOCUMENTS.md:90-99`; «không có dữ liệu» khác «bị chặn»; màn 360px không cuộn ngang, vùng nhấn 44×44 (`DESIGN…:23`, `:103`); breakpoint hiện có 700/950/1200px (`src/app/globals.css:7-9`). Đặc tả bàn giao sáu mục (bố cục, token, props, trạng thái, breakpoint, edge case) viết tay vào `docs/UI-HANDOFF-<lát>-<màn>.md` (`HANDOFF…:90`).
- **Điểm dừng chờ Chairman (mọi lát):** triển khai lên d1-ai1; áp migration trên dữ liệu thật; khởi động lại gateway chung; gửi tin vào nhóm hoặc DM thật; sửa `AGENTS.md`/ký ADR. **Cấm:** tự nghiệm thu, tự cấp quyền, sửa bảng việc của Phương, đọc/ghi DB nền khác, tính điểm KPI/lương (`HANDOFF…:69-76`).
- **Đạt khi chung:** `npm run test`, `npm run typecheck`, `npm run build` xanh kèm output; `tests/test_bot_bridge.py` xanh nếu chạm bot; biên nhận ghi riêng bốn mức đã có mã · đã triển khai · đã dùng thật · đã nghiệm thu; qua hai tầng phản biện (`HANDOFF…:80-85`, `:138-147`).

---

## Lát 1 · P1.0 — Sổ dự án, kênh nhóm, sổ tài liệu, mẫu T0–T6

**Mục tiêu.** AI OS có sổ dự án mở rộng, ánh xạ nhóm/topic Telegram → dự án, và sổ tài liệu trong đó mỗi tài liệu có đúng một nguồn chính, chuỗi revision bất biến có hash, và hai con trỏ tách riêng «bản đang soạn» / «bản chuẩn đã duyệt». Bộ mẫu T0–T6 được đăng ký có version. Hai ca XECA006 và LBRC014 được lập chỉ mục mà không sửa Sheet, không đổi trạng thái nguồn.

**Cổng của lát:** migration 013+ chỉ được viết sau khi ADR-002 1.1 được ký — **đã đạt**: Chairman ký ADR-002 1.1 ngày 12/11/2026 («Ký ADR-002 1.1»), Adoption record ở cuối `ADR-002-project-document-ownership.md`; OQ-01, OQ-02, OQ-04 đã chốt. Áp migration lên dữ liệu thật vẫn là điểm dừng. Làm được trước khi ký, vì không tạo entity mới: việc 7 (nhãn và số bản), việc 9 (sửa R-01), test quyền âm trên mã hiện có, tệp mẫu T0–T6, đặc tả giao diện.

**Giới hạn lần đầu** (`ADR-002…:26`): chỉ con trỏ, version/hash kèm mức xác minh, bản nháp, chỉ mục tìm kiếm có quyền. Không snapshot, không duyệt thật, không cấp ID việc, không đổi quyền nhóm, không sửa Sheet.

### Phạm vi làm
1. Sổ dự án: mở rộng `projects` (`migrations/001_foundation.sql:13`) bằng bảng phụ, không sửa cột cũ — owner BU, PM, Vault pointer, repo, trạng thái. Yêu cầu: `SPEC-008…:59` (hàng Project), `SPEC-009…:84`.
2. ProjectChannel: chat_id/topic, allowlist BU/dự án, mode, enabled_from, approver, policy_version — `SPEC-009…:136`, `:84-85`. Ở lát này mỗi dòng chỉ ở trạng thái **đề xuất/chưa kích hoạt** và không cấp quyền nào; cấu hình `chatScopes` của gateway (`src/app/api/bridge/route.ts:12`, `src/server/bridge.ts:38-39`) vẫn là nguồn hiệu lực (OQ-11, `ADR-002…:33`). Nhóm mới mặc định chưa cấp (`SPEC-009…:28`).
3. DocumentRecord + DocumentRevision: trường ở `SPEC-009…:137-138`; quy tắc chủ dữ liệu `SPEC-009…:68-76`, `ADR-002…:30-31`, `:37`; hai con trỏ độc lập, bản chuẩn được rỗng (`SPEC-009…:73`, OQ-05); bản Approved còn hiệu lực khi Draft kế tiếp đang sửa `SPEC-009…:121`. Mỗi hash mang **mức xác minh** (`tự khai` / `đã kiểm`); lát này chỉ sinh `tự khai` và giao diện không hiện nó như đã kiểm. Mọi tài liệu ở `SOURCE_NOT_FROZEN`, không hiện «đã duyệt» (`SPEC-009…:78`, OQ-07). Metadata hồ sơ theo `PM-DOCUMENT-TEMPLATES.md:9-21`.
4. API (tên logic ở `SPEC-009…:143`): đăng ký tài liệu, đề xuất revision, đọc danh sách theo dự án, tìm trong sổ (tên, loại, mã — chưa tìm nội dung; đọc qua bản chiếu Z2 ở việc 8), mở liên kết nguồn, xuất danh sách. Mã lỗi theo `SPEC-009…:147`; lỗi không lộ tên/số đếm ngoài quyền.
5. Mẫu T0–T6: `PM-DOCUMENT-TEMPLATES.md:23`–`:129`. Mỗi mẫu là một tệp có version và hash trong repo; AI OS giữ chỉ mục mẫu (mã, version, hash). Không cài skill vào bot (OQ-21). Vị trí thư mục do builder ghi trong kế hoạch, reviewer kiểm; đề xuất `docs/templates/`.
6. Chỉ mục hai ca: XECA006 theo `SPEC-009…:155-159`, `PM-DOCUMENT-TEMPLATES.md:133-138`; LBRC014 theo `SPEC-009…:163-167`, `PM-DOCUMENT-TEMPLATES.md:140-146` (giữ ba SHA, giữ phần đã đủ và phần còn thiếu). Liên kết tới dòng nguồn giữ `source_ref` Z2 với nhãn «chưa đối soát»; `source_ref` không phải ID việc (`SPEC-005-source-exception-slice.md:9`, OQ-06).
7. Nhãn và số bản (OQ-03 chọn b): hiện ba trạng thái `đã cấu hình` / `đã kiểm thực tế` / `chưa nối luồng ghi` (`IMPLEMENTATION-ROADMAP.md:44`); không gắn «đã kiểm thực tế» chỉ vì có biến cấu hình. Gom số bản về một nguồn (`package.json:3`) thay chỗ viết cứng ở `src/components/workspace.tsx:39`, `:47`, `src/app/api/health/route.ts:10`; sửa `src/server/bridge.ts:43`. Kiểm trước rằng bot không so trường `version` của cầu nối. Không đụng `bot-plugin`.
8. Bản chiếu tìm kiếm (R-02): projector có tên ghi chỉ mục metadata tài liệu ở Z2, có `tenant_id` + `project_id` (`SPEC-009…:75`, `:131`; mẫu `src/server/projector.ts:3`). Chi tiết nghiệp vụ đọc qua domain service; tìm và xuất danh sách đọc bản chiếu. Kiểm quyền **trước truy vấn và trước khi trả**; không lộ tên hay số đếm ngoài phạm vi. Projector chạy lại không tạo bản sao; ghi thời điểm chiếu để hiện độ mới; nguồn mất không làm mất lịch sử.
9. Sửa R-01 — thay đổi nhỏ riêng, không cần migration: `resolve()` ở `src/server/feedback.ts:46-52` phải so cả đối tượng, thao tác và nội dung có nghĩa của yêu cầu; cùng khoá cho phản hồi khác trả `FEEDBACK_KEY_CONFLICT`. Giữ transaction và RLS. **Không sao chép cách replay này** cho thao tác tài liệu: dấu vân tay = thao tác + mã tài liệu + revision + `expectedVersion`.

### Không làm
Không nhận tin Telegram, không kích hoạt ánh xạ nhóm (lát 2); không review/duyệt revision (lát 3); không công bố, không tìm nội dung (lát 4); không adapter ghi vào Drive/Git; không snapshot, không đóng băng hay tải bản chuẩn (cổng trước pilot, OQ-07); không tạo Z1 work item cho dòng nguồn (OQ-06); không tạo dòng ánh xạ miền báo cáo cho dự án thật (OQ-04); không cài mẫu vào bot; không nhập thêm dữ liệu thật.

### Mã hiện có sẽ chạm hoặc mở rộng
- `src/server/types.ts:10` (Project) — thêm kiểu mới, không đổi kiểu cũ.
- `src/server/team-catalog.ts:11` và `migrations/011_team_source_catalog.sql:3` — nguồn Z2 của 45 dòng; chỉ đọc.
- `src/server/http.ts:19` — router `/api/v1`; thêm nhánh hoặc route riêng theo mẫu `src/app/api/team/feedback/route.ts`.
- `src/server/feedback.ts:23` (`create`) — mẫu service ghi có phạm vi dự án + request key. `resolve()` ở `:46-52` cùng tệp **không** dùng làm mẫu (R-01).
- `src/components/workspace.tsx:12` (tabs), `:39` (sidebar, liên kết Team Tech), `:47` (footer); `src/app/portfolio/page.tsx:9` (thứ tự BU).
- Tệp mới dự kiến: `src/server/projects-registry.ts`, `src/server/documents.ts`, `src/server/document-projector.ts`, `migrations/rollback/`, `src/app/documents/page.tsx`, `src/components/documents.tsx`, `tests/documents.test.ts`.

### Migration dự kiến
- `013_project_registry.sql` — hồ sơ dự án mở rộng, `project_channels` (trạng thái đề xuất), ba nhãn miền báo cáo và bảng ánh xạ dự án → nhãn **rỗng** (người xác nhận, nguồn, version, audit).
- `014_document_registry.sql` — `document_records`, `document_revisions` (bất biến, có mức xác minh hash), chỉ mục mẫu; ràng buộc: một `canonical_uri` cho mỗi record, `approved_revision_id` được rỗng và chỉ trỏ revision cùng record.
- `015_document_index_z2.sql` — bảng chỉ mục metadata ở schema `analytics`, có `project_id`; policy ghi riêng cho projector, đọc cho runtime (mẫu `migrations/005_evidence_dashboards.sql:43-44`, `:49-50`).
- Mỗi tệp có tệp lùi cùng số trong `migrations/rollback/`.

### Ca kiểm chuyển thành test tự động
| Mã | Con trỏ | Nội dung test ở lát này |
|---|---|---|
| DOC-01 | `SPEC-009…:191`, `:84` | Nhóm chưa mapping: không đọc được danh mục, không sinh bản ghi |
| DOC-07 | `SPEC-009…:191`, `:73` | Đề xuất revision mới không đổi con trỏ bản chuẩn |
| DOC-10 (tìm, mở tệp, xuất) | `SPEC-009…:191`, `:91` | Chéo dự án/BU bị chặn ở danh sách, tìm, mở nguồn, export; lỗi không lộ tên |
| DOC-13 | `SPEC-009…:191`, `:159` | XECA006 và XECA005 là hai chỉ mục riêng, không gộp |
| DOC-14 | `SPEC-009…:191`, `:167` | LBRC014 giữ cả revision cũ và revision bổ sung iOS, cả phần đủ và phần thiếu |
| DOC-18 | `SPEC-009…:191`, `:127` | Nguồn mất/xoá: lịch sử còn, trạng thái stale/unknown, không tự xoá |
| PM-08 (phần sổ) | `SPEC-008…:131` | Sau khi lập chỉ mục, hash/số dòng nguồn Z2 không đổi |
| R-01 | `reviews/CODEX-STEP0-P1-READINESS-20261112.md:12-19` | Cùng khoá + cùng yêu cầu → replay; cùng khoá + phản hồi khác → `FEEDBACK_KEY_CONFLICT`; cùng khoá + tài liệu/revision khác → xung đột |
| R-02 | `reviews/CODEX-STEP0-P1-READINESS-20261112.md:21-27` | Tìm qua bản chiếu: cùng BU khác dự án bị chặn; thu hồi membership rồi tìm/xuất bị chặn; chạy lại projector không tạo bản sao; nguồn mất vẫn còn lịch sử |

Ca quyền âm bắt buộc — theo **cả tenant lẫn dự án**: (1) người dự án Xeca không thấy tên, preview, tệp của LBRC014 (`DESIGN…:109`); (2) không có ngữ cảnh RLS → không trả dòng nào trên mọi bảng mới, kể cả bảng Z2 (mở rộng `tests/foundation.test.ts:33`, `:39`); (3) INSERT gán `project_id` dự án khác hoặc tenant khác bị từ chối (`tests/foundation.test.ts:56`); (4) bot không ghi được sổ tài liệu (`tests/foundation.test.ts:59`); (5) gửi lại cùng khoá không tạo record trùng, **cùng khoá cho đối tượng khác bị từ chối** (`tests/foundation.test.ts:133`); (6) ghi với `expectedVersion` cũ bị từ chối, không có audit hay đổi version (`tests/foundation.test.ts:116`, `:123`); (7) không record nào nhận nội dung snapshot; IBS HI chỉ con trỏ/hash/metadata; (8) dòng ProjectChannel ở trạng thái đề xuất không cho đọc danh mục; (9) dự án chưa ánh xạ miền hiện «Chưa xác nhận» và không vào tổng nào.

**XECA005/XECA006:** tin gốc chưa đối chiếu (`HANDOFF…:99`, `SPEC-008…:124`). Test chạy trên dữ liệu tổng hợp được phép xanh; biên nhận **không** ghi ca Xeca «đạt» khi chưa có tin gốc — ghi «chờ tin gốc». Cổng «bản chuẩn riêng» đạt khi hai con trỏ tách riêng và bản chuẩn rỗng hiện «Chưa có»; lát này không tạo bản duyệt thật (OQ-05).

### Giao diện
Màn mới: **Tài liệu dự án** (danh sách + chi tiết) theo `DESIGN…:29-44`; thành phần DocumentRecord `DESIGN…:56-60` và SourceAvailability `DESIGN…:82-86`; token `DESIGN…:13-21`. «Chưa có bản chuẩn» là nhãn trung tính (`DESIGN…:60`). Sáu trạng thái nguồn (fresh, stale, unavailable, denied, not-configured, partially-received) hiển thị riêng. Viết `docs/UI-HANDOFF-1-documents.md`.

### Phụ thuộc
Bước 0 của handoff (git, nhánh `libetech-ai-os`, `DELIVERY-009`) xong (`HANDOFF…:32-47`). ADR-002 1.1 được ký trước migration 013+. Quyết định đã áp: OQ-03 (b), OQ-04, OQ-05 (a), OQ-06 (a), OQ-07, OQ-11 (phần đề xuất), OQ-20, OQ-21 (a).

### Đạt khi
- Bộ nhận bàn giao (`reviews/CODEX-STEP0-P1-READINESS-20261112.md:108`): DOC-01/07/10/13/14/18, PM-08 phần sổ, hai hàng R-01/R-02 và chín ca quyền âm có test tự động xanh. Mọi ca chạm DB chạy trên **cả PGlite và PostgreSQL thử** trước rollout (`SPEC-002…:23`).
- Ba tệp migration và projector chạy hai lần liên tiếp không lỗi, không sinh dòng trùng; mỗi tệp lùi chạy tiến → lùi → tiến được trên bản sao; số dòng `analytics.tech_source_tasks` và `work_items` trước/sau không đổi.
- Màn Tài liệu hiện đủ bốn trạng thái ở 360px và ≥1200px; có `docs/UI-HANDOFF-1-documents.md`.
- LBRC014 có một record với ≥2 revision và hai con trỏ tách riêng; XECA006 có record riêng với danh sách trường «Chưa có»; biên nhận ghi rõ ca Xeca chờ tin gốc. Không dự án thật nào có dòng ánh xạ miền do mã tạo.
- Review ghim base/head và lưu cùng output; thiếu output hoặc verdict không hợp lệ thì không qua cổng (`reviews/CODEX-STEP0-P1-READINESS-20261112.md:109`).
- Biên nhận `DELIVERY-010` ghi mức «đã có mã»; ba mức còn lại để trống tới khi Chairman duyệt triển khai.

---

## Lát 2 · P1.1 — Tiếp nhận Telegram: inbox, outbox, phần còn thiếu SPEC-007

**Mục tiêu.** Tin từ nhóm đã cấp quyền (tin thường, tin trả lời, tệp, topic) được **lưu bền trước khi báo nhận**; tin sửa tạo phiên bản, tin gửi lại không tạo bản ghi thứ hai; biên nhận trả về đúng nhóm qua outbox có trạng thái giao. Hoàn tất phần còn thiếu của luồng duyệt tài khoản SPEC-007.

**Cổng hiệu lực (OQ-09, `ADR-002…:22`):** sổ ticket của plugin priority1 vẫn là chủ trạng thái ticket. Thiết kế inbox chỉ có hiệu lực sau hai mục nghiệm thu của lát này: (1) chứng minh trên đường nhận thật rằng tin nhóm tới được `bot-plugin` của repo này song song với priority1; (2) ca đối soát inbox ↔ sổ ticket đạt. Mục (1) cần runtime ⇒ điểm dừng chờ Chairman; không đạt thì dừng lát và trình lại, **không sửa plugin priority1** (`AGENTS.md:5`). Mã, test và tệp migration trên dữ liệu tổng hợp làm được trước.

**Quyết định đã áp:** OQ-08 (b) bot giữ chỉ đọc, principal tiếp nhận/giao riêng · OQ-10 (b)+(c) tuyến ký riêng dưới `/api/bridge/…`, tệp chỉ đi locator + hash · OQ-11 (a) gateway kéo outbox rồi báo biên nhận, AI OS không giữ token · OQ-12 (c) tách ba ca · OQ-13 (c).

### Phạm vi làm
1. SourceEvent + inbox: trường ở `SPEC-009…:135`, `:87` (bốn trường nguồn bắt buộc E-EXT-01, message_id, edit_date, chat/topic, actor nguồn, hash, correlation). Khoá khử trùng ở DB bằng UNIQUE + `ON CONFLICT DO NOTHING` (E-BE-08), không «kiểm rồi ghi».
2. Phân quyền: chat/topic lấy từ gateway, không nhận từ nội dung (`SPEC-009…:70`, `SPEC-008…:73`); nhóm UNKNOWN không sinh việc có cam kết (`SPEC-009…:84`); người báo ngoài team gửi intake được nhưng không có quyền tạo/duyệt (`SPEC-009…:88`, `SPEC-008…:296`).
3. Tin sửa → revision; album giữ đủ phần; forward không cho quyền tác giả/người duyệt (`SPEC-009…:87`). Mốc bắt đầu thu nhận và khoảng thiếu lịch sử hiển thị rõ (`SPEC-009…:86`).
4. Tệp đính kèm: gateway giữ bytes ở nơi private, AI OS nhận locator + hash + loại + kích thước (OQ-10); kiểm hash, lưu lỗi thì không báo thành công (`SPEC-009…:149`, `:27`).
5. Outbox: ghi cùng giao dịch với thay đổi nghiệp vụ (E-INT-06, `SPEC-008…:116`); năm trạng thái received / persisted / projected / delivered / recipient-acknowledged tách riêng; timeout sau gửi → uncertain, đối soát trước khi gửi lại (`SPEC-009…:147`); lỗi quyền không thử lại vô hạn. Envelope sự kiện theo E-INT-02. Gateway kéo outbox qua cầu nối đã ký và báo biên nhận (OQ-11).
6. Ứng viên intake cho PM: **principal tiếp nhận riêng** (không phải bot — bot giữ chỉ đọc, OQ-08) chỉ tạo ứng viên hẹp, không tạo/gán/chốt việc (`SPEC-008…:75`); màn Inbox cho PM xác nhận loại, trùng, dự án (`SPEC-008…:76`).
7. SPEC-007 — ba ca tách riêng (OQ-12): (a) DM tự động khi có phiếu mới, có biên nhận giao (`SPEC-007…:13`, `:41`), thẻ Yes/No dùng lệnh `/duyet` đã có trong nguồn (`bot-plugin/__init__.py:203`, `:245`); (b) phiếu đổi quyền cho thành viên đã có (`SPEC-007…:33`, `:40`); (c) UAT thật hai người bỏ phiếu (`SPEC-007…:46`) — điểm dừng, không tính vào mức «đã có mã». Có mã trong nguồn không đồng nghĩa đã chạy.
8. Kích hoạt ProjectChannel: chuyển nguồn hiệu lực từ `chatScopes` sang bảng theo expand → migrate → contract, chỉ sau khi hai chứng minh đạt (`ADR-002…:33`).
9. Principal tiếp nhận/giao: khoá và allowlist riêng, chỉ ghi SourceEvent, ứng viên intake, biên nhận giao (`ADR-002…:36`). Trần thân sự kiện và tệp, danh sách loại tệp do kế hoạch lát đề xuất, reviewer kiểm; con số 32 KB / 20 MB của gói 0.1 chưa được duyệt.

### Không làm
Không đổi privacy mode của bot; không đọc lịch sử chat cũ; không nhập CSV Jira (XI-02…06); không tự ghi Sheet (`SPEC-008…:118`); không kỹ năng AI phân loại (lát 3) — phân loại ở lát này do người chọn; không gửi tin thật.

### Mã hiện có sẽ chạm hoặc mở rộng
- `src/server/bridge.ts:8-14` (schema operation), `:16` (chuỗi ký), `:19` (trần 4096 byte), `:25` (nonce chống phát lại), `:38-39` (giao phạm vi người ∩ nhóm).
- `src/app/api/bridge/route.ts:12` (cấu hình khoá + `chatScopes`); proxy chặn `/api/bridge` ở `DEPLOY-003-team-access.md:103-104` — endpoint mới phải nằm trong vùng bị chặn (`SPEC-009…:145`).
- `src/server/identity.ts:208` (`telegramPrincipal`), `:182` (`pair`).
- `src/server/accounts.ts:115` (nơi tạo phiếu duyệt — điểm phát sự kiện DM); `src/server/account-approval.ts:79`, `:109`.
- `bot-plugin/__init__.py:15` (VERSION), `:17` (ENDPOINT), `:106` (thẻ câu hỏi); `tests/test_bot_bridge.py:24` (test «không có thao tác ghi» — giữ nguyên cho bot đọc; principal tiếp nhận có test riêng (OQ-08)).
- Tệp mới dự kiến: `src/server/intake.ts`, `src/server/outbox.ts`, `src/app/inbox/page.tsx`, `src/components/inbox.tsx`, `tests/intake.test.ts`, `tests/outbox.test.ts`.

### Migration dự kiến
- `016_intake_inbox.sql` — `source_events` (bất biến), `source_event_revisions`, `intake_candidates`, `intake_attachments` (locator + hash, không bytes).
- `017_outbox.sql` — `outbox_messages`, `delivery_receipts` (bất biến), hàng lỗi có chủ xử lý. Mỗi tệp có tệp lùi trong `migrations/rollback/`.

### Ca kiểm chuyển thành test tự động
| Mã | Con trỏ | Nội dung test |
|---|---|---|
| DOC-01 (runtime) | `SPEC-009…:191` | Tin từ nhóm chưa mapping bị từ chối, không lưu nội dung nghiệp vụ |
| DOC-02 | `SPEC-009…:191`, `:184` | Tin thường, reply, tệp, topic đều vào một inbox |
| DOC-03 | `SPEC-009…:191`, `:87` | Gửi lại cùng update → một bản ghi; sửa → revision; forward không thành tác giả |
| DOC-04 | `SPEC-009…:191`, `:149` | Lưu tệp lỗi → không có biên nhận thành công |
| DOC-12 | `SPEC-009…:191` | Mất kết nối, khôi phục, phát lại → không trùng, có biên nhận phục hồi |
| DOC-16 | `SPEC-009…:191`, `:88` | Người dùng không phải nhập lại cùng yêu cầu |
| PM-03 | `SPEC-008…:126` | Cùng tin/forward/sync hai lần → một intake; outbox replay không nhân đôi |
| PM-07 | `SPEC-008…:130` | Không báo «đã gửi» khi mới ghi DB; mở lại giữ lịch sử |
| PM-01 (phần đọc) | `SPEC-008…:124` | **Không coi đạt** khi chưa đọc được tin gốc và ticket Xeca |
| XI-01, XI-07 | `SPEC-008…:321`, `:327` | Ca tiếp nhận thật trên runtime (OQ-13) — tính ở mức «đã dùng thật», không ở mức «đã có mã» |
| Đối soát hai kho | OQ-09 | Một tin vừa có ticket vừa có SourceEvent: nối bằng khoá sự kiện chung, không sinh ứng viên trùng, AI OS không đổi trạng thái ticket; lệch giữa hai kho được liệt kê, không tự sửa |
| SPEC-007 | `SPEC-007…:45` | Bảy ca hiện có giữ xanh (`tests/onboarding-feedback.test.ts:180`) + DM có biên nhận |

Ca quyền âm bắt buộc: (1) chữ ký sai, quá hạn, nonce lặp bị từ chối (`tests/identity.test.ts:70`); (2) thân yêu cầu tự khai tenant/dự án/actor bị bỏ qua hoặc từ chối; (3) nhóm Xeca không đọc được biên nhận hay ứng viên của LBRC/IBS HI (`tests/identity.test.ts:104`); (4) tin gửi lại không tạo ứng viên/việc trùng; (5) bot không tạo, gán, chốt, nghiệm thu được việc; (6) phiếu duyệt tài khoản bấm trong nhóm, bấm lại, bấm thẻ cũ không ghi phiếu (`tests/test_bot_bridge.py:47`); (7) từ Internet, mọi endpoint tiếp nhận trả 404/401.

### Giao diện
Màn mới: **Inbox** — thẻ IntakeCard theo `DESIGN…:48-54` (ba biến thể incident / request / document), danh sách dự án chỉ gồm dự án được phép. Trạng thái nguồn «Chưa xác minh khả năng nhận tin» cho nhóm vừa thêm (`DESIGN…:86`). Thẻ Telegram theo `DESIGN…:74`: callback chỉ chứa ID mờ. Viết `docs/UI-HANDOFF-2-inbox.md`.

### Phụ thuộc
Lát 1 đạt (ProjectChannel, sổ dự án). `AGENTS.md:5`, `:11`, `:13` do Chairman sửa khi hai chứng minh đạt (lời văn ở gói quyết định §5). Quyết định đã áp: OQ-02, OQ-08, OQ-09, OQ-10, OQ-11, OQ-12, OQ-13, OQ-20.

### Đạt khi
- Các ca DOC-01/02/03/04/12/16, PM-03, PM-07 và bảy ca quyền âm xanh; test Python cầu nối xanh.
- Test đồng thời: hai yêu cầu cùng khoá chạy song song → đúng một dòng `source_events`.
- Test outbox: giao dịch nghiệp vụ rollback → không còn dòng outbox; tiến trình «chết» giữa ghi và gửi → tin vẫn được gửi một lần sau khi chạy lại.
- SLO thử (`SPEC-009…:193`) được đo trên dữ liệu tổng hợp và ghi vào biên nhận dưới dạng số đo, không phải cam kết.
- Hai mục nghiệm thu OQ-09 có bằng chứng riêng: biên bản đường nhận thật (sau khi Chairman duyệt đợt runtime) và output ca đối soát hai kho. Thiếu một trong hai thì lát chỉ đạt mức «đã có mã» và ProjectChannel chưa được kích hoạt.
- Biên nhận ghi rõ: chưa gửi tin thật, chưa cài plugin, chưa khởi động lại gateway; PM-01 «chờ tin gốc»; UAT SPEC-007 chưa chạy.

---

## Lát 3 · P1.2 — Sáu kỹ năng PM/BA, review đúng revision, 3/3, ba sự kiện tách riêng

**Mục tiêu.** Vòng tài liệu chạy được từ nháp tới bản chuẩn: AI soạn nháp có nguồn ở Z4, người có quyền review và duyệt **đúng revision/hash đã xem**; nguồn đổi giữa chừng thì trả xung đột. Chia lại việc chỉ có hiệu lực khi BoM Tech đủ 3/3 và có đúng một biên nhận. Ba sự kiện đóng ticket · chấp nhận kỹ thuật · nghiệm thu nghiệp vụ luôn tách riêng; người làm không tự nghiệm thu.

**Quyết định đã áp:** OQ-14 làm (c) trước — bảng Z4, hợp đồng vào/ra, manifest, eval với đầu ra giả lập; **không gọi mô hình, không cấp khoá pipeline AI, Z4 chưa bật** tới khi Chairman duyệt bảng phân loại dữ liệu → mô hình (`ADR-002…:23`, `:36`). OQ-15 (a) — giữ và kiểm hồi quy 3/3 cùng ba sự kiện; không evidence phi mã, không đụng bảng `evidence`. OQ-16 (c) — lát này lưu liên kết và đánh dấu cần xem lại. OQ-07 — chưa có snapshot thật nên thao tác duyệt revision chỉ kiểm trên dữ liệu tổng hợp.

### Phạm vi làm
1. Sáu kỹ năng — Intake analyst, BA elicitation, PM planning, Technical writer, Doc reviewer, Release librarian: đầu vào/ra và phép kiểm ở `SPEC-009…:97-104`; manifest mỗi kỹ năng ở `SPEC-009…:106`; hồ sơ tối thiểu theo loại việc `SPEC-009…:108-115`. Nội dung tệp và tin là dữ liệu không tin cậy, không cấp được quyền tool.
2. Bảng Z4 cho bản nháp và gợi ý (dựng và kiểm với đầu ra giả lập; chưa bật): AI chỉ ghi Z4; người xác nhận rồi domain service mới ghi Z1 (`SPEC-009…:40`, `:76`, `ADR-002…:39`; AR-03, E-AI-04).
3. Review + duyệt: ReviewDecision ở `SPEC-009…:139`; luồng `SPEC-009…:123`; duyệt gắn revision/hash, không suy từ «đã đọc» (`SPEC-009…:42`); thiếu người duyệt hiện «Chờ xác định người duyệt» (`SPEC-009…:47`); lỗi `REVISION_CONFLICT`, `APPROVER_NOT_AUTHORIZED`, `SOURCE_NOT_FROZEN` (`SPEC-009…:147`). Tác giả không duyệt bản của mình (`SPEC-009…:35`).
4. 3/3: giữ nguyên máy trạng thái hiện có, chỉ thêm test hồi quy (OQ-15). Quy tắc gốc `SPEC-004-bom-tech-phan-cong.md:31-33`, `:47`; sự cố không bị chặn bởi 3/3 (`SPEC-008…:220`). Bot nhắc người thiếu phiếu (`SPEC-009…:43`) không làm đợt này.
5. Ba sự kiện: quy tắc `SPEC-001-foundation.md:12-13`, `SPEC-008…:69` (không ánh xạ tự động trạng thái ticket → việc), bốn kết luận tách ở `PM-DOCUMENT-TEMPLATES.md:113`. Review tài liệu không nới điều kiện nghiệm thu sản phẩm; evidence không phải mã (`SPEC-008…:230`) **không làm** (OQ-15).
6. Liên kết phụ thuộc: lưu liên kết giữa yêu cầu, revision và tài liệu phụ thuộc; khi nguồn đổi thì đánh dấu «cần xem lại» (`SPEC-009…:127`, OQ-16). Thông báo thuộc lát 4.
7. Thẻ quyết định trên web; trên Telegram «yes» chỉ có hiệu lực khi trả lời đúng thẻ còn hiệu lực (`SPEC-008…:218`).

### Không làm
Không công bố ra nhóm (lát 4); không gọi mô hình, không cài skill vào bot; không evidence phi mã; không bot nhắc phiếu; không duyệt bản chuẩn thật; không tính điểm; không để AI tự xác nhận, tự giao người, tự hứa hạn; không cài framework ngoài (`SPEC-009…:95`); không ghi vào Drive/Git của team.

### Mã hiện có sẽ chạm hoặc mở rộng
- `src/server/service.ts:15-21` (lược đồ lệnh), `:145-159` (hai bước nghiệm thu, `SELF_ACCEPTANCE` ở `:151`), `:160-162` (đóng ticket không đổi nghiệm thu), `:163-173` (`revise`, chặn đổi người ngoài 3/3 ở `:165-167`).
- `src/server/bom.ts:101` (lệnh), `:170-178` (áp dụng ở phiếu thứ ba + biên nhận); `migrations/006_bom_allocations.sql:24`, `:41`, `:50`.
- `migrations/001_foundation.sql:37-41` (bảng `evidence`, `source_sha` bắt buộc) — **không đụng** (OQ-15).
- `src/components/bom-workspace.tsx`, `src/components/approvals.tsx` — mẫu thẻ phiếu.
- Tệp mới dự kiến: `src/server/document-review.ts`, `src/server/suggestions.ts` (Z4), `skills/` (sáu manifest + eval), `src/components/review.tsx`, `tests/document-review.test.ts`, `tests/skills-eval.test.ts`.

### Migration dự kiến
- `018_document_review.sql` — `review_decisions` (bất biến), `review_comments`, uỷ quyền người duyệt theo dự án, liên kết phụ thuộc và cờ «cần xem lại».
- `019_ai_suggestions_z4.sql` — schema/bảng Z4 `ai_drafts` (nguồn, confidence, phần cần hỏi, hash manifest kỹ năng); runtime nghiệp vụ chỉ đọc; role pipeline AI chỉ có quyền ghi Z4 và chưa được cấp khoá.
- Mỗi tệp có tệp lùi trong `migrations/rollback/`. Không có migration cho bảng `evidence`.

### Ca kiểm chuyển thành test tự động
| Mã | Con trỏ | Nội dung test |
|---|---|---|
| DOC-05 | `SPEC-009…:191`, `:99` | Đầu ra AI thiếu nguồn bị giữ ở nháp, không vào Z1 |
| DOC-06 | `SPEC-009…:191`, `:123` | Nguồn đổi khi đang review → `REVISION_CONFLICT`, phiếu không áp vào bản mới |
| DOC-08 | `SPEC-009…:191`, `:35` | Tự nghiệm thu và phiếu sai quyền bị từ chối |
| DOC-09 | `SPEC-009…:191`, `:43` | 2/3 chưa áp dụng; 3/3 áp đúng một lần, một biên nhận |
| DOC-15 | `SPEC-009…:191`, `:106` | Nội dung tệp chứa lệnh không đổi được policy hay quyền tool |
| PM-05 | `SPEC-008…:128` | 2/3, 3/3, từ chối, nguồn đổi; mọi đường ghi tắt bị chặn |
| PM-06 | `SPEC-008…:129` | Chấp nhận kỹ thuật và nghiệp vụ tách người, phiên bản, thời điểm; đóng ticket không thay nghiệm thu |
| PM-02 | `SPEC-008…:125` | Ca Xeca thật — không coi đạt khi chưa có tin gốc/chủ dự án xác nhận |
| T06, T07, T15, T17, T18 | `KIEM-THU-SPEC-004-BOM-TECH.md:27-28`, `:36`, `:38-39` | Hồi quy: phải giữ xanh (`tests/spec004.test.ts:66`, `:91`, `:132`) |
| A04–A06 | `SPEC-001-foundation.md:25-27` | Hồi quy: `tests/foundation.test.ts:83`, `:89` |
| Eval kỹ năng | `SPEC-009…:106` | Năm ca: bịa khi thiếu thông tin, injection, nguồn xung đột, quyền bị thu hồi, cùng tên khác BU |

Ca quyền âm bắt buộc: (1) tác giả duyệt revision của mình → từ chối; (2) người làm tự nghiệm thu, kể cả sau khi được chia lại việc → từ chối (`KIEM-THU…:38`); (3) phiếu cũ áp lên revision mới → từ chối; (4) principal AI ghi Z1/Z2 → từ chối ở tầng DB; (5) người duyệt của dự án A duyệt tài liệu dự án B/BU khác → không tìm thấy, không lộ tên (`tests/spec004.test.ts:119`); (6) gửi lại lệnh duyệt cùng khoá → một quyết định; (7) kỹ năng chỉ nhận ngữ cảnh đúng quyền — bản ghi IBS HI không lọt vào ngữ cảnh dự án Xeca.

### Giao diện
Màn mới: **Review** (RevisionDiff `DESIGN…:62-66`: hai cột trên desktop, tuần tự trên mobile, banner «nguồn đã đổi» + nút Đọc bản mới) và **Quyết định** (DecisionCard `DESIGN…:68-72`: «đủ phiếu» và «đã áp dụng» là hai trạng thái; nêu lý do không đủ quyền). Trạng thái Conflict theo `DESIGN…:98`. Viết `docs/UI-HANDOFF-3-review.md` và `docs/UI-HANDOFF-3-decisions.md`.

### Phụ thuộc
Lát 1 (revision, con trỏ bản chuẩn) và lát 2 (inbox làm đầu vào Intake analyst). Quyết định đã áp: OQ-06, OQ-07, OQ-13, OQ-14, OQ-15, OQ-16, OQ-20, OQ-21.

### Đạt khi
- DOC-05/06/08/09/15, PM-05, PM-06 và bảy ca quyền âm xanh; toàn bộ test SPEC-001/004 hiện có vẫn xanh, không sửa kỳ vọng.
- Test đồng thời: hai phiếu thứ ba gửi cùng lúc → đúng một dòng `bom_receipts`; hai lệnh duyệt cùng revision → một `review_decisions`.
- Mỗi kỹ năng có manifest (tên, version, hash, tool allowlist, phạm vi dữ liệu, owner) và bộ eval năm ca chạy được không cần mạng; kết quả eval ghi trong biên nhận.
- Truy vấn kiểm: principal AI không có quyền INSERT/UPDATE trên bảng Z1/Z2 nào.
- Biên nhận ghi rõ: **chưa nối mô hình, Z4 chưa bật**, eval chạy với đầu ra giả lập; thao tác duyệt chỉ chạy trên dữ liệu tổng hợp; PM-02 «chờ tin gốc». `AGENTS.md:11` (dòng Z4) do Chairman sửa sau lát này.

---

## Lát 4 · P1.3 — Chia sẻ bản đã duyệt, tra tài liệu, dashboard truy về bằng chứng

**Mục tiêu.** Bản chuẩn đã duyệt được công bố tới đúng nhóm, đúng revision, có biên nhận giao; người dùng tra được tài liệu trong phạm vi của mình; dashboard dự án và nhân sự mở được từ mỗi con số về đúng bằng chứng. **Thu hồi quyền chặn cả tin đang chờ gửi lẫn dữ liệu đã lưu đệm.** Dữ liệu thiếu hiện là «thiếu căn cứ», không thành điểm thấp.

**Quyết định đã áp:** OQ-17 (a) — dashboard nhân sự không có điểm chính thức; không xoá và không mở rộng chức năng điểm nháp cũ. OQ-16 (c) — truy ảnh hưởng và thông báo phụ thuộc làm ở lát này. OQ-04 — tổng hợp theo nhãn miền báo cáo, dự án «Chưa xác nhận» đứng riêng. **Còn dừng:** gửi thật (OQ-11); lập chỉ mục nội dung và công bố bản chuẩn thật chờ cổng trước pilot của OQ-07 (quyền nguồn, lưu giữ, thử khôi phục) — trước đó chỉ chạy trên dữ liệu tổng hợp.

### Phạm vi làm
1. Publication: trường ở `SPEC-009…:141`; chỉ công bố revision đã duyệt; «Published» cần biên nhận giao, khác «người nhận đã xác nhận» (`SPEC-009…:125`); gửi liên kết yêu cầu đăng nhập, không tạo link công khai; bản trích cho khách qua `redaction_ref`. Không báo đã giao khi mới xếp hàng (`SPEC-009…:104`).
2. Kiểm quyền ba lần: trước truy xuất, trước trả lời, **lúc gửi** (`SPEC-009…:75`). Thu hồi membership chặn cache, đoạn trích tìm kiếm, export, tin đang chờ, link tải (`SPEC-009…:91`).
3. Tra tài liệu: mở rộng chỉ mục metadata Z2 của lát 1 sang nội dung, do projector có tên ghi, giữ ACL tới từng đoạn (`SPEC-009…:149`); không dựng chỉ mục thứ hai; tìm không truy vấn Z1 (AR-07, E-DB-10); kết quả ngoài quyền không lộ tên hay số đếm.
4. TraceLink: `SPEC-009…:140`; chuỗi yêu cầu → tài liệu → việc → bằng chứng → nghiệm thu.
5. Dashboard dự án: cột riêng cho trạng thái nguồn, trạng thái AI OS, nghiệm thu (`SPEC-008…:110`, `SPEC-003…:92`); drill-down khớp số tổng (`SPEC-003…:94`). Dashboard nhân sự chỉ hiện việc, tài liệu, review và độ phủ bằng chứng, không điểm (OQ-17); trạng thái thiếu dữ liệu theo `SPEC-003…:84`. Upload không làm tăng điểm.
6. Phụ thuộc khi yêu cầu đổi (`SPEC-009…:127`): từ cờ «cần xem lại» của lát 3, truy ra tài liệu và việc bị ảnh hưởng, xếp thông báo vào outbox (OQ-16); gửi thật là điểm dừng.
7. Tách ba nhãn miền báo cáo ở mọi tổng hợp và export; dự án chưa ánh xạ hiện «Chưa xác nhận», không cộng vào nhãn nào (OQ-04).

### Không làm
Không Score/KPI/lương, không điểm chính thức; không xoá chức năng điểm nháp K1–K4 có sẵn (`src/components/reports.tsx:12`); không dashboard điều hành năm góc nhìn (`SPEC-008…:254`, thuộc gói mở rộng); không thêm lịch cron hay nhóm nhận mới (`SPEC-009…:89`, `SPEC-008…:256`); không gửi tệp đính kèm nội bộ qua Telegram làm mặc định; không tìm kiếm xuyên dự án cho người không có quyền.

### Mã hiện có sẽ chạm hoặc mở rộng
- `src/server/reports.ts:36` (đọc, kiểm `people_read` ở `:38`), `:59` (lệnh rà soát/chốt); `src/server/evidence-scores.ts:82`; `src/server/evidence-projector.ts:15`; `src/server/projector.ts:3`.
- `migrations/005_evidence_dashboards.sql:7`, `:17`, `:24` (bảng run, people, report_actions và policy riêng cho projector).
- `src/components/reports.tsx:12` (nhãn trạng thái thiếu bằng chứng), `src/app/reports/page.tsx`, `src/app/portfolio/page.tsx:9`.
- Outbox của lát 2 (`src/server/outbox.ts`) — thêm bước kiểm quyền lúc gửi.
- Tệp mới dự kiến: `src/server/publications.ts`, `src/server/search-projector.ts`, `src/server/trace.ts`, `src/components/traceability.tsx`, `tests/publications.test.ts`, `tests/search.test.ts`.

### Migration dự kiến
- `020_publications_trace.sql` — `publications`, `publication_audiences`, `trace_links`.
- `021_search_projection.sql` — mở rộng chỉ mục Z2 của lát 1 (tệp 015) sang đoạn nội dung, ACL theo đoạn; policy ghi riêng cho projector, đọc cho runtime. Mỗi tệp có tệp lùi trong `migrations/rollback/`.

### Ca kiểm chuyển thành test tự động
| Mã | Con trỏ | Nội dung test |
|---|---|---|
| DOC-10 (đủ) | `SPEC-009…:191`, `:91` | Chéo BU bị chặn ở tìm, export, blob, **thông báo** |
| DOC-11 | `SPEC-009…:191`, `:186` | Thu hồi quyền khi tin đang chờ → không gửi; biên nhận ghi lý do |
| DOC-17 | `SPEC-009…:191` | Upload/đăng ký tài liệu không làm tăng điểm hay tiến độ |
| DOC-07 (hồi quy) | `SPEC-009…:191` | Công bố luôn lấy bản chuẩn, không lấy nháp mới nhất |
| PM-04 | `SPEC-008…:127` | Người Xeca thử web/API/export/thông báo với LBRC/IBS HI → từ chối, không lộ ID, số lượng, tệp |
| PM-08 | `SPEC-008…:131` | Trước/sau: nguồn không đổi; điểm không phát sinh từ nguồn chưa nghiệm thu |
| E03, E04 | `SPEC-003…:115-116` | Hai dashboard cùng ID và nguồn cho LBRC014; mất nguồn/chưa có mẫu/chưa cấp quyền hiện đúng |
| A03 | `SPEC-003…:112` | Đổi ID người xem/dự án ở URL/API, drill-down, export → không đọc được ngoài quyền |
| XI-08 | `SPEC-008…:328` | Ca thật trên runtime (OQ-13) — tính ở mức «đã dùng thật» |

Ca quyền âm bắt buộc: (1) **thu hồi quyền chặn hàng chờ**: xếp hàng → thu hồi → worker chạy → không gửi, trạng thái `SCOPE_DENIED`; (2) **thu hồi quyền chặn cache**: kết quả tìm, đoạn trích, link tải, export đã cấp trước đó đều bị từ chối ở lần gọi kế tiếp, không trả bản lưu đệm; (3) nhóm khách đọc chéo dự án/BU qua tìm kiếm, export, thông báo → chặn; (4) công bố revision chưa duyệt hoặc nháp → từ chối; (5) người không có quyền công bố → từ chối; (6) gửi lại lệnh công bố cùng khoá → một publication, một tin; (7) dữ liệu thiếu → trạng thái «thiếu căn cứ», không ra số 0 (`tests/spec003.test.ts:82`); (8) tổng hợp không cộng gộp ba nhãn miền, dự án «Chưa xác nhận» không vào tổng nào; bản ghi IBS HI chỉ có con trỏ/hash/metadata trong chỉ mục tìm kiếm.

### Giao diện
Màn mới: **Công bố** (thẻ DecisionCard biến thể publication, `DESIGN…:72`), **Tra tài liệu**, TraceabilityPanel (`DESIGN…:76-80`: không gộp thành một huy hiệu PASS; LBRC014 hiện «Hoàn thành» của nguồn cạnh «Còn thiếu bằng chứng nghiệm thu»). Ba phân biệt phải nhìn được ngay: khai báo/đã kiểm, đang soạn/bản chuẩn, đã gửi/đã xác nhận (`DESIGN…:9`). Viết `docs/UI-HANDOFF-4-publication.md`, `-4-search.md`, `-4-traceability.md`.

### Phụ thuộc
Lát 1 (sổ, chỉ mục Z2), lát 2 (outbox, biên nhận), lát 3 (review, cờ cần xem lại). Quyết định đã áp: OQ-04, OQ-06, OQ-07, OQ-11, OQ-13, OQ-16, OQ-17, OQ-20.

### Đạt khi
- DOC-10/11/17, PM-04, PM-08, E03, E04, A03 và tám ca quyền âm xanh.
- Test thu hồi: sau khi gỡ membership, **không** còn đường nào (tìm, đoạn trích, tải, export, hàng chờ) trả dữ liệu của dự án đó — mỗi đường một assertion riêng.
- Với mỗi ô tổng hợp của dashboard dự án, test so số tổng với số dòng drill-down cùng bộ lọc và cùng quyền.
- Truy vấn tìm kiếm và dashboard chỉ đọc schema `analytics` (kiểm bằng test hoặc rà truy vấn trong biên nhận).
- «Người dùng đi hết một vòng thật» (`IMPLEMENTATION-ROADMAP.md:16`) **không** thuộc mức «đã có mã»: biên nhận để trống mức «đã dùng thật» cho tới khi Chairman duyệt triển khai và có người thật chạy.

---

## Lát 5 · Vận hành platform — đợt này chỉ soạn SPEC-010 và ADR-003

**Mục tiêu của đợt.** Có hai bản nháp để Chairman duyệt: `docs/SPEC-010-platform-operations.md` (kèm mã ca OPS-xx) và `docs/ADR-003-platform-operations-ownership.md`. **Không migration, không mã, không test mới.** Lập trình lát 5 diễn ra sau pilot và sau khi hai tệp được duyệt (OQ-18, Chairman 12/11). Khi đó planner viết lại brief này theo SPEC-010.

**Mục tiêu của lát khi được mở.** LibeTech theo dõi được vận hành các dịch vụ mình phụ trách: sự cố có ba đồng hồ riêng, change request và release gắn dịch vụ/môi trường có phương án quay lui, bản mong muốn so với bản đang chạy, lịch bảo trì, runbook có chủ và phiên bản, sổ backup kèm kết quả thử phục hồi; thông báo tới đúng nhóm.

### Phạm vi làm (đợt này — hồ sơ)
1. SPEC-010 — sự cố: luồng `SPEC-008…:191`; ba đồng hồ nhận xử lý / khôi phục / nguyên nhân gốc `SPEC-008…:198`; defect chưa ảnh hưởng live không tự thành sự cố; khôi phục khác đóng việc nguyên nhân gốc (`SPEC-008…:266`). Gọi người trong lịch trực đã duyệt không tạo tái phân công và không chờ 3/3 (`SPEC-008…:220`). Hồ sơ tối thiểu `SPEC-009…:110`, mẫu T1 phần sự cố `PM-DOCUMENT-TEMPLATES.md:53`.
2. SPEC-010 — change request và release: luồng `SPEC-008…:192`, chức năng `SPEC-008…:159`; trước/sau, tương thích, backup/rollback, kết quả quan sát, nhóm dịch vụ chịu ảnh hưởng (`SPEC-008…:270`); XECA005 và XECA006 là hai phạm vi riêng. Mẫu T3 `PM-DOCUMENT-TEMPLATES.md:72-83`.
3. SPEC-010 — hai mức thông tin về bản đang chạy (OQ-19): **báo cáo** là điều dịch vụ tự khai, kể cả `/api/health` của AI OS (`src/app/api/health/route.ts:10` lấy digest và SHA từ biến môi trường); **quan sát** là kết quả kiểm độc lập có bằng chứng, ví dụ băm tệp đang chạy đối chiếu manifest (`reviews/CODEX-STEP0-P1-READINESS-20261112.md:60`). Chỉ mức quan sát mới được hiện là sự thật; thiếu thì hiện «chưa xác minh». SPEC nêu danh sách dịch vụ trong phạm vi, ai được ghi quan sát, qua đường nào; không đọc DB hay log nền khác (AR-01). Rà nhãn «Có quan sát» hiện có ở `src/components/workspace.tsx:51` và ai đang ghi `observed_sha` (`migrations/001_foundation.sql:20`).
4. SPEC-010 — bảo trì, runbook, sổ backup: `IMPLEMENTATION-ROADMAP.md:52`; runbook có owner/version (`SPEC-008…:161`), mẫu T6 `PM-DOCUMENT-TEMPLATES.md:118-129`; mỗi dòng backup ghi lần thử phục hồi gần nhất và kết quả.
5. ADR-003 — một chủ cho từng entity vận hành (AR-09): incident, change request, release, bản ghi quan sát, lịch bảo trì, runbook, sổ backup; quan hệ dự án–dịch vụ nhiều–nhiều (`SPEC-008…:226`); thông báo đi outbox của lát 2, cảnh báo tức thời chỉ theo cấu hình on-call đã duyệt (`SPEC-008…:256`). Trạng thái Proposed; planner không ký.

### Không làm
Không viết mã, migration, test hay giao diện cho lát 5 trong đợt này. Khi lát được mở vẫn không làm: tải công việc/capacity, khám phá sản phẩm, chi phí dịch vụ/vendor (`HANDOFF…:61`); Dev Factory; tự triển khai, tự rollback, tự khởi động lại dịch vụ; đọc DB hay log của platform khác (AR-01); dùng hạn ticket làm SLA dịch vụ (`SPEC-008…:198`); dashboard điều hành năm góc nhìn.

### Mã hiện có để SPEC-010 đối chiếu (chỉ đọc)
- `migrations/001_foundation.sql:17-20` (bảng `services`, cột `desired_sha`, `observed_sha`, `observed_at`); `src/server/types.ts:11`.
- `src/components/workspace.tsx:51` (ServiceCard: «Chưa xác minh» / «Quan sát đã cũ» / «Có quan sát»), `:53` (FactoryView).
- `src/server/evidence-scores.ts:15` — thang `reported` / `observed` / `verified` đã có, dùng làm tiền lệ cho hai mức ở việc 3.
- `src/server/service.ts:160-162` (đóng ticket là sự kiện riêng) — mẫu cho «đóng sự cố ≠ xong nguyên nhân gốc».
- `deploy/` và `docs/DEPLOY-003-team-access.md` — nguồn nội dung runbook đầu tiên; không sửa.

### Ca kiểm đề xuất đưa vào SPEC-010
Mã OPS-xx chưa có hiệu lực cho tới khi SPEC-010 được duyệt.

| Mã đề xuất | Căn cứ | Nội dung |
|---|---|---|
| OPS-01 | `SPEC-008…:266` | Defect không tự thành incident; cần người xác nhận tác động |
| OPS-02 | `SPEC-008…:198` | Ba đồng hồ ghi riêng; đóng incident không đóng việc nguyên nhân gốc |
| OPS-03 | `SPEC-008…:220` | Gọi người trực không tạo phiếu tái phân công, không cần 3/3 |
| OPS-04 | `SPEC-008…:270` | CR thiếu phương án rollback không chuyển được sang «được duyệt» |
| OPS-05 | `IMPLEMENTATION-ROADMAP.md:52` | Mong muốn ≠ quan sát hiện «lệch»; quan sát cũ hiện «đã cũ»; không có quan sát hiện «chưa xác minh» |
| OPS-06 | `IMPLEMENTATION-ROADMAP.md:52` | Backup không có lần thử phục hồi đạt thì không hiện «sẵn sàng» |
| OPS-07 | `SPEC-008…:130` (PM-07) | Thông báo sự cố sai cấu hình nhóm → không gửi, vào hàng lỗi |
| OPS-08 | OQ-19 | Health tự khai chỉ sinh bản ghi mức «báo cáo»; không bao giờ làm thẻ dịch vụ hiện «đúng bản» |

Ca quyền âm đề xuất: người dự án Xeca không thấy sự cố, CR, runbook của LBRC/IBS HI, kể cả số đếm; người thực hiện CR không tự duyệt và không tự xác nhận khôi phục; bot không tạo/duyệt CR, không ghi quan sát; nguồn quan sát do thân yêu cầu tự khai bị từ chối; gửi lại cùng sự kiện deploy sinh một dòng; thông báo tới nhóm không có quyền dự án không được gửi; IBS HI chỉ con trỏ/hash/metadata, tổng hợp tách ba nhãn miền.

### Phụ thuộc
Soạn hồ sơ không phụ thuộc lát nào và không chặn lát 1–4. Lập trình phụ thuộc: pilot xong; SPEC-010 và ADR-003 được duyệt; lát 2 (outbox, kênh nhóm), lát 3 (thẻ quyết định), lát 4 (công bố, thu hồi quyền). Quyết định đã áp: OQ-18, OQ-19, OQ-13 (XI-02…06 hoãn), OQ-20.

### Đạt khi (đợt này)
- Có hai tệp nháp nêu trên, trạng thái Proposed, mỗi yêu cầu có con trỏ về SPEC-008/009 hoặc quyết định OQ; chỗ thiếu căn cứ ghi thành OQ mới, không tự chọn.
- SPEC-010 tách rõ «báo cáo» và «quan sát», có danh sách dịch vụ đề xuất để BoM Tech và Chairman duyệt, và bộ ca OPS-xx kèm ca quyền âm.
- ADR-003 có bảng một-chủ theo AR-09 và phần Adoption record để trống.
- Không có thay đổi nào trong `src/`, `migrations/`, `tests/`, `deploy/`.
