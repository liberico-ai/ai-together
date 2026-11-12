# Câu hỏi mở — LibeTech AI OS, đợt lập trình theo roadmap

Version 0.1 · 11/11/2026 · Lập bởi agent `planner` khi viết [SLICE-BRIEFS](SLICE-BRIEFS.md). Căn cứ: `HANDOFF-CLAUDE-CODE-20261111.md:30` — SPEC mâu thuẫn hoặc thiếu thì ghi vào đây và dừng lát đó, không tự chọn.

Cách đọc: mỗi mục nêu lát bị ảnh hưởng, hai phía mâu thuẫn kèm con trỏ `tệp:dòng` (đường dẫn tính từ gốc repo; tài liệu nằm trong `docs/`), các phương án **chưa chọn**, và người quyết. Trạng thái mọi mục: **mở**. Khi có quyết định, ghi ngày, người quyết và nội dung ngay dưới mục; không xoá mục.

| Mã | Lát | Một dòng | Người quyết |
|---|---|---|---|
| OQ-01 | 1 (kéo theo 2–4) | ADR-002 chưa ký mà lát 1 dựa vào | Chairman |
| OQ-02 | 1, 2 | ADR-002 không phủ ProjectChannel, SourceEvent, sổ dự án | Chairman |
| OQ-03 | 1 | Nhãn cũ và footer `0.3.0` không còn ở chỗ handoff chỉ | BoM Tech |
| OQ-04 | 1, 4, 5 | Trục thực thể Liberico BU · Xeca · IBS HI chưa có trong schema | Chairman |
| OQ-05 | 1 | Cổng P1.0 «bản chuẩn riêng» khi chưa có bản chuẩn, người duyệt, tin gốc Xeca | Chairman |
| OQ-06 | 1, 3, 4 | Tài liệu gắn vào «việc» nào khi Z1 chưa có work item | BoM Tech |
| OQ-07 | 1, 3, 4 | Nơi giữ snapshot bản chuẩn, retention, quyền đọc Drive/Git | Chairman + BoM Tech |
| OQ-08 | 2, 3 | «Bot chỉ đọc» trong AGENTS/ADR-001 so với intake ghi qua bot | Chairman |
| OQ-09 | 2 | Lưu bền trước ở sổ ticket plugin hay inbox AI OS; plugin nào nhận tin | Chairman |
| OQ-10 | 2 | Tuyến và giới hạn cho intake/tệp đính kèm qua cầu nối | BoM Tech |
| OQ-11 | 2, 4, 5 | Ai gửi Telegram cho outbox; chat ID, topic, privacy mode chưa xác minh | BoM Tech + Chairman |
| OQ-12 | 2 | «Phần còn thiếu SPEC-007» gồm những gì | Chairman |
| OQ-13 | 2–5 | «8 ca SPEC-008» là PM-01…08 hay XI-01…08 | Chairman |
| OQ-14 | 3 | Z4 chưa bật; sáu kỹ năng chạy ở đâu, mô hình và bộ eval nào | Chairman |
| OQ-15 | 3 | Phần nào của lát 3 là mới so với mã đã có; evidence phi mã có thuộc lát | BoM Tech |
| OQ-16 | 3, 4 | «Cập nhật phụ thuộc» thuộc P1.2 hay P1.3 | BoM Tech |
| OQ-17 | 4 | Dashboard nhân sự so với «Score nhân sự để sau» | Chairman |
| OQ-18 | 5 | Lát 5 chưa có SPEC; incident nằm ở «P1 mở rộng» trong roadmap | Chairman |
| OQ-19 | 5 | Nguồn quan sát SHA đang chạy của platform khác; dịch vụ nào trong phạm vi | BoM Tech + Chairman |
| OQ-20 | 1–5 | Quy ước tệp rollback migration chưa có; runner chạy mọi tệp `^\d+…sql` | BoM Tech |
| OQ-21 | 1, 3 | Mẫu T0–T6 «cài» vào đâu | BoM Tech |

---

## OQ-01 — ADR-002 chưa ký mà lát 1 dựa vào

- **Lát:** 1 dừng tại đây trước migration tài liệu; lát 2–4 dùng cùng mô hình chủ dữ liệu.
- **Phía A:** `docs/ADR-002-project-document-ownership.md:3` ghi «Proposed … chưa ký»; `:27` ghi «Decision: chưa ghi … Quyết định chọn nghiên cứu của Chairman không được điền thay approval triển khai».
- **Phía B:** `docs/HANDOFF-CLAUDE-CODE-20261111.md:53` giao lát 1 xây sổ tài liệu; `:96` yêu cầu hỏi nếu tới lúc cần mà chưa ký. `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:18` cũng ghi ADR chưa phải quyết định đã ký.
- **Phương án:** (a) Chairman ký ADR-002 nguyên văn, điền `:27`; (b) ký có sửa, planner cập nhật brief theo bản ký; (c) chưa ký — lát 1 chỉ làm phần không tạo entity mới (sửa nhãn theo OQ-03, test quyền âm trên mã hiện có), không viết migration 013+.
- **Ai quyết:** Chairman.

## OQ-02 — ADR-002 không phủ ProjectChannel, SourceEvent và sổ dự án

- **Lát:** 1 (ProjectChannel, sổ dự án), 2 (SourceEvent, inbox, outbox).
- **Phía A:** `docs/ADR-002-project-document-ownership.md:12` liệt kê AI OS sở hữu DocumentRecord, DocumentRevision, ReviewDecision, Publication, TraceLink — không có ProjectChannel, SourceEvent hay Project mở rộng.
- **Phía B:** `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:135-136` định nghĩa SourceEvent, ProjectChannel; `docs/SPEC-008-PM-operating-loop-20261111.md:53` đòi «ADR về entity và cutover trước migration» theo AR-09; `:137` đặt «Chốt ADR và quyền» làm lát 0. Luật: E-AI-02 (không tạo schema ngoài canonical model khi chưa duyệt).
- **Phương án:** (a) mở rộng ADR-002 trước khi ký để phủ cả ba; (b) ADR-003 riêng cho sổ dự án/kênh/sự kiện nguồn; (c) Chairman xác nhận bằng văn bản rằng các bảng này là mở rộng của `projects` hiện có (`migrations/001_foundation.sql:13`) và không cần ADR mới.
- **Ai quyết:** Chairman.

## OQ-03 — Nhãn cũ và footer `0.3.0` không còn ở chỗ handoff chỉ

- **Lát:** 1.
- **Phía A:** `docs/HANDOFF-CLAUDE-CODE-20261111.md:98` và `docs/IMPLEMENTATION-ROADMAP.md:44` nói `src/components/workspace.tsx` còn nhãn «Bot LibeTech · Chưa nối nền tảng mới» và footer `0.3.0`.
- **Phía B:** mã hiện tại: `src/components/workspace.tsx:39` đã là «Bot LibeTech / Cầu nối đọc và duyệt Telegram» và «AI OS · 0.7.1»; `:47` footer «LibeTech AI OS · 0.7.1». Chuỗi `0.3.0` còn ở `src/server/bridge.ts:43` (trường `version` của phản hồi cầu nối) và `bot-plugin/__init__.py:15`; `bot-plugin/plugin.yaml` khai `0.2.1`. Số bản bị viết cứng ba nơi: `workspace.tsx:39`, `:47`, `src/app/api/health/route.ts:10`. Roadmap `:44` còn đòi hiện ba trạng thái `đã cấu hình`, `đã kiểm thực tế`, `chưa nối luồng ghi` — chưa có.
- **Phương án:** (a) coi việc sửa nhãn đã xong, lát 1 chỉ thêm ba trạng thái theo roadmap `:44`; (b) thêm việc gom số bản về một nguồn và sửa `bridge.ts:43`; (c) sửa cả `bot-plugin` (đụng plugin ⇒ cài lại bridge ⇒ điểm dừng Chairman).
- **Ai quyết:** BoM Tech (Quân); phương án (c) cần Chairman.

## OQ-04 — Trục thực thể Liberico BU · Xeca · IBS HI chưa có trong schema

- **Lát:** 1 (schema sổ dự án), 4 (dashboard), 5 (báo cáo vận hành).
- **Phía A:** `docs/HANDOFF-CLAUDE-CODE-20261111.md:74` buộc tách dashboard/báo cáo theo ba thực thể; IBS HI là pháp nhân ngoài Liberico. `docs/SPEC-008-PM-operating-loop-20261111.md:228`: «Không dùng tenant_id, organization_id, BU và pháp nhân kế toán lẫn nhau».
- **Phía B:** mã chỉ có một tenant và cột chữ `projects.bu` (`migrations/001_foundation.sql:14`), giá trị đang dùng `XECA`, `LBRC`, `IBS HI` (`migrations/011_team_source_catalog.sql:51`) và `LibeTech` (`migrations/008_platform_workspace.sql:9`); `src/app/portfolio/page.tsx:9` sắp theo `bu`. Không có trường thực thể; `LibeTech` nội bộ thuộc nhóm nào chưa nêu.
- **Phương án:** (a) thêm cột thực thể có ràng buộc trên `projects` và bảng ánh xạ `bu → thực thể` do người có quyền duyệt; (b) giữ `bu`, quy ước ánh xạ trong mã; (c) tách tenant theo pháp nhân (đổi mô hình RLS, cần ADR).
- **Ai quyết:** Chairman (ranh giới pháp nhân); BoM Tech thực hiện.

## OQ-05 — Cổng P1.0 «bản nháp và bản chuẩn riêng» khi chưa có bản chuẩn, người duyệt và tin gốc Xeca

- **Lát:** 1.
- **Phía A:** `docs/HANDOFF-CLAUDE-CODE-20261111.md:53` và `docs/IMPLEMENTATION-ROADMAP.md:13`: XECA006 và LBRC014 «có nguồn, bản nháp và bản chuẩn riêng».
- **Phía B:** `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:183` chỉ đòi «có chỉ mục nguồn không trùng»; `:197` ghi người duyệt theo dự án và nơi giữ snapshot chưa xác minh; `docs/DESIGN-SYSTEM-PM-DOCUMENTS.md:37` minh hoạ XECA006 «Bản chuẩn: Chưa có». Tin gốc Xeca chưa đối chiếu: `HANDOFF…:99`, `SPEC-009…:155`, `SPEC-008…:124`.
- **Phương án:** (a) cổng đạt khi hai con trỏ tách riêng trong schema và UI, bản chuẩn được phép rỗng với nhãn «Chưa có»; (b) cổng chỉ đạt khi có ít nhất một revision được người có quyền duyệt cho mỗi ca; (c) LBRC014 đạt theo (a), XECA006 treo tới khi có tin gốc.
- **Ai quyết:** Chairman.

## OQ-06 — Tài liệu gắn vào «việc» nào khi Z1 chưa có work item

- **Lát:** 1 (liên kết), 3 (review gắn việc), 4 (truy bằng chứng).
- **Phía A:** `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:140` TraceLink nối yêu cầu ↔ revision ↔ work ↔ evidence.
- **Phía B:** `docs/DELIVERY-007-team-catalog-20261111.md:10` — 0 Z1 work item; 45 dòng nguồn nằm ở Z2 `analytics.tech_source_tasks` (`migrations/011_team_source_catalog.sql:3`), LBRC014 ở `analytics.reconciliations`. `SPEC-009…:159` ghi chưa cấp mã/việc mới; `SPEC-008…:118` bước (B) chỉ cấp ID bền sau khi PM xác nhận mapping; `docs/SPEC-005-source-exception-slice.md:9` — `source_ref` không phải ID việc.
- **Phương án:** (a) TraceLink trỏ `source_ref` Z2 với nhãn «chưa đối soát»; (b) tạo Z1 work cho XECA006/LBRC014 sau khi Phương xác nhận mapping (thao tác trên dữ liệu thật ⇒ điểm dừng); (c) lát 1 để trống liên kết việc, chỉ lưu mã chữ.
- **Ai quyết:** BoM Tech (Phương xác nhận mapping).

## OQ-07 — Nơi giữ snapshot bản chuẩn, retention và quyền đọc Drive/Git

- **Lát:** 1, 3, 4.
- **Phía A:** `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:78` — không giữ được bản chuẩn thì trạng thái là «chưa đóng băng được»; `docs/ADR-002-project-document-ownership.md:13` đòi snapshot riêng đúng quyền.
- **Phía B:** `SPEC-009…:197` — chưa xác minh quyền service account Drive/Docs, cơ chế giữ snapshot, retention; `:149` — retention do chủ nguồn quyết trước pilot, kể cả embeddings và backup. Repo không có kho blob hay khoá Drive; `IMPLEMENTATION-ROADMAP.md:77` cấm đưa khoá vào repo. IBS HI: `SPEC-009…:80` chỉ con trỏ/hash/metadata.
- **Phương án:** (a) lát 1 chỉ lưu con trỏ + revision + hash do người đăng ký khai, mọi tài liệu ở `SOURCE_NOT_FROZEN` tới khi có kho; (b) snapshot trong PostgreSQL (bytea, giới hạn kích thước); (c) thư mục riêng trên d1-ai1 ngoài repo, AI OS giữ hash và đường dẫn; (d) adapter đọc Drive/Git bằng tài khoản dịch vụ do vận hành cấp.
- **Ai quyết:** Chairman (retention, quyền nguồn); BoM Tech (kho).

## OQ-08 — «Bot chỉ đọc» so với intake ghi qua bot

- **Lát:** 2, 3.
- **Phía A:** `AGENTS.md:13` «Bot principal is read-only»; `docs/ADR-001-foundation.md:10`; `docs/SPEC-002-identity-postgres.md:11` «The bridge cannot create, accept or close work».
- **Phía B:** `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:143` `POST /api/intake-events` cho gateway đã ký; `docs/SPEC-008-PM-operating-loop-20261111.md:75` — bridge được tạo «ứng viên intake hẹp»; `:296` service principal ghi ứng viên. (Phiếu duyệt tài khoản qua cầu nối đã ghi vào schema identity: `src/server/bridge.ts:32`.)
- **Phương án:** (a) Chairman cho sửa `AGENTS.md:13`: bot được ghi đúng hai loại bản ghi (sự kiện nguồn, ứng viên intake), vẫn cấm ghi work/nghiệm thu; (b) giữ bot chỉ đọc, intake đi bằng principal dịch vụ riêng khác principal bot; (c) lát 2 chỉ làm phía web.
- **Ai quyết:** Chairman (R10: AI không tự sửa AGENTS.md).

## OQ-09 — Lưu bền trước ở đâu, và plugin nào nhận tin

- **Lát:** 2.
- **Phía A:** `docs/SPEC-008-PM-operating-loop-20261111.md:74-75` — bot mở ticket trong sổ ticket (SQLite của plugin priority1) rồi adapter gửi sang AI OS; `:292` «Sổ ticket hiện hữu tiếp tục giữ tiếp nhận cho đến khi ADR chuyển chủ dữ liệu … Không tạo hai nguồn cùng sửa trạng thái một ticket».
- **Phía B:** `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:53-56` (sơ đồ gateway → inbox AI OS) và `:87` «Ghi bền nguồn trước khi ACK»; `:18` chỉ cho SPEC-009 ưu tiên khi khác §13/15 của SPEC-008, không nói tới §3. `AGENTS.md:5` «priority1 plugin remains independent», trong khi `HANDOFF…:14` liệt kê plugin đó là đối tượng; `bot-plugin/plugin.yaml` tự mô tả «Independent of libetech-priority1».
- **Phương án:** (a) sổ ticket priority1 lưu trước, AI OS nhận qua adapter; (b) inbox AI OS lưu trước, không qua sổ ticket; (c) ghi cả hai với một khoá sự kiện chung, sổ ticket là chủ trạng thái ticket. Kèm câu hỏi: tin nhóm do `bot-plugin` của repo này hay plugin priority1 bắt.
- **Ai quyết:** Chairman (đổi chủ dữ liệu tiếp nhận ⇒ ADR theo AR-09).

## OQ-10 — Tuyến và giới hạn cho intake, tệp đính kèm

- **Lát:** 2.
- **Phía A:** `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:145` — endpoint tiếp nhận chỉ trên listener nội bộ hoặc namespace bridge bị proxy chặn; `:149` — tệp đính kèm lưu private, «giới hạn kích thước/loại» nhưng không nêu con số.
- **Phía B:** `src/server/bridge.ts:19` giới hạn thân yêu cầu 4096 byte; `:16` chuỗi ký cố định đường `/api/bridge`; `:8` ngữ cảnh không có topic, reply-to, edit_date; `docs/DEPLOY-003-team-access.md:103-104` proxy chặn `/api/bridge`.
- **Phương án:** (a) thêm operation `intake_event` vào `/api/bridge` và nâng trần kích thước; (b) route mới dưới `/api/bridge/…` có chuỗi ký riêng; (c) tệp không đi qua cầu nối — gateway lưu tệp, AI OS chỉ nhận locator + hash. Cần chốt trần kích thước và loại tệp.
- **Ai quyết:** BoM Tech (Quân).

## OQ-11 — Ai gửi Telegram cho outbox; chat ID, topic, privacy mode

- **Lát:** 2, 4, 5.
- **Phía A:** `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:125` «Published cần delivery receipt»; `:147` trạng thái uncertain phải đối soát receipt trước khi gửi lại.
- **Phía B:** AI OS không giữ token Telegram (`IMPLEMENTATION-ROADMAP.md:77`); gateway chung khoảng 20 bot (`HANDOFF…:76`). `SPEC-009…:85` — đổi privacy mode ảnh hưởng nhiều nhóm; `:197` chat ID/topic chưa xác minh; `SPEC-008…:294` tên «LBRC Xeca» chưa khớp chat ID. Ánh xạ nhóm hiện là tệp cấu hình (`src/app/api/bridge/route.ts:12`), chưa là bảng.
- **Phương án:** (a) gateway kéo outbox qua cầu nối đã ký rồi báo receipt; (b) AI OS gọi một endpoint cục bộ của gateway; (c) lát 2 chỉ dừng ở outbox + receipt giả lập, gửi thật là đợt sau. Kèm: nguồn sự thật của ánh xạ nhóm là tệp cấu hình hay bảng ProjectChannel; có đổi privacy mode hay không.
- **Ai quyết:** BoM Tech (cơ chế); Chairman (privacy mode, gửi thật).

## OQ-12 — «Phần còn thiếu SPEC-007» gồm những gì

- **Lát:** 2.
- **Phía A:** `docs/HANDOFF-CLAUDE-CODE-20261111.md:54` — «bot tự gửi tin riêng mời duyệt tài khoản, nút Yes/No trên Telegram».
- **Phía B:** lệnh `/duyet` Yes/No đã có trong nguồn (`bot-plugin/__init__.py:203`, `:245`; test `tests/test_bot_bridge.py:47`) nhưng chưa triển khai (`docs/SPEC-007-telegram-account-approval.md:13`); thứ thật sự chưa viết là DM tự động có biên nhận giao. `SPEC-007…:33`, `:40` còn nêu phiếu đổi quyền cho thành viên đã có (access-change ballot) chưa làm; `docs/DELIVERY-007-team-catalog-20261111.md:23` cũng chờ luồng đó. Cổng nghiệm thu thật ở `SPEC-007…:46` chưa chạy.
- **Phương án:** (a) chỉ DM tự động + biên nhận, dùng `/duyet` sẵn có; (b) thêm phiếu đổi quyền; (c) thêm cả ca thật hai người bỏ phiếu trên runtime (cần Chairman cho gửi tin và khởi động lại gateway).
- **Ai quyết:** Chairman.

## OQ-13 — «8 ca SPEC-008» là bộ nào

- **Lát:** 2–5.
- **Phía A:** `docs/HANDOFF-CLAUDE-CODE-20261111.md:27` «8 ca trong SPEC-008».
- **Phía B:** SPEC-008 có hai bộ tám ca: PM-01…08 (`docs/SPEC-008-PM-operating-loop-20261111.md:124-131`) và XI-01…08 (`:321-328`). `IMPLEMENTATION-ROADMAP.md:22` nói XI-02…06 không bắt buộc cho Phase 1; `SPEC-008…:330` nói XI-01/07/08 cần ca thật trên runtime.
- **Phương án:** (a) PM-01…08; (b) XI-01…08; (c) PM-01…08 cộng XI-01/07/08. Brief hiện liệt kê cả hai bộ kèm nhãn, chưa coi bộ nào là bắt buộc.
- **Ai quyết:** Chairman.

## OQ-14 — Z4 chưa bật; sáu kỹ năng chạy ở đâu

- **Lát:** 3.
- **Phía A:** `AGENTS.md:11` «Z4: future AI suggestions; not enabled».
- **Phía B:** `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:40`, `:76` — bản nháp AI ở Z4; `:97-104` sáu kỹ năng; `:106` mỗi kỹ năng cần manifest, tool allowlist, eval set. Không tài liệu nào nêu kỹ năng chạy trong profile Hermes của bot hay trong AI OS, dùng mô hình nào, dữ liệu BU nào được gửi cho mô hình (R6: dữ liệu nhạy cảm chỉ Sovereign).
- **Phương án:** (a) kỹ năng là skill của profile bot, AI OS chỉ nhận nháp vào bảng Z4 qua cầu nối; (b) AI OS gọi mô hình trực tiếp; (c) lát 3 chỉ dựng bảng Z4, hợp đồng vào/ra và bộ eval với đầu ra giả lập, chưa nối mô hình. Kèm: cho sửa `AGENTS.md:11`.
- **Ai quyết:** Chairman.

## OQ-15 — Phần nào của lát 3 là mới; evidence phi mã có thuộc lát

- **Lát:** 3.
- **Phía A:** `docs/HANDOFF-CLAUDE-CODE-20261111.md:55` giao «chia lại việc cần BoM Tech 3/3 có biên nhận; tách ba sự kiện».
- **Phía B:** cả hai đã có mã và test: 3/3 ở `src/server/bom.ts:101`, `tests/spec004.test.ts:66`, `:91`; ba sự kiện ở `src/server/service.ts:145-162`, `tests/foundation.test.ts:83`. Phần chưa có: nghiệm thu đầu ra không phải mã — `migrations/001_foundation.sql:41` buộc `source_sha` 40 hex, `service.ts:17-18` cũng vậy, trong khi `SPEC-008…:230` và `SPEC-009…:115` nói không ép Git SHA cho tài liệu; gói này là COO-06 (`SPEC-008…:269`), còn `HANDOFF…:61` chỉ loại ba gói khác.
- **Phương án:** (a) lát 3 giữ nguyên hai phần đã có, chỉ thêm test hồi quy và áp cho vòng tài liệu; (b) thêm evidence phi mã (migration mở rộng bảng `evidence`); (c) thêm bot nhắc phiếu 3/3 theo `SPEC-009…:43`.
- **Ai quyết:** BoM Tech; (b) cần Chairman vì đổi điều kiện nghiệm thu.

## OQ-16 — «Cập nhật phụ thuộc» thuộc P1.2 hay P1.3

- **Lát:** 3, 4.
- **Phía A:** `docs/IMPLEMENTATION-ROADMAP.md:15` đặt «phê duyệt và cập nhật phụ thuộc» ở P1.2.
- **Phía B:** `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:186` đặt «cập nhật phụ thuộc» ở P1.3; `HANDOFF…:55-56` không nêu ở lát nào. Hành vi mô tả tại `SPEC-009…:127`.
- **Phương án:** (a) lát 3; (b) lát 4; (c) lát 3 đánh dấu phụ thuộc cần xem lại, lát 4 thông báo.
- **Ai quyết:** BoM Tech.

## OQ-17 — Dashboard nhân sự so với «Score nhân sự để sau»

- **Lát:** 4.
- **Phía A:** `docs/HANDOFF-CLAUDE-CODE-20261111.md:56` — dashboard nhân sự truy được về bằng chứng, «dữ liệu thiếu không biến thành điểm thấp».
- **Phía B:** `HANDOFF…:61` Score nhân sự chỉ làm khi BoM chọn sau pilot; `:72` cấm tính điểm dùng cho KPI/lương. Mã đã có điểm K1–K4 nháp: `src/server/evidence-scores.ts:82`, `src/server/reports.ts:36`, màn `src/components/reports.tsx:12`; đặc tả `docs/SPEC-003-team-access-evidence-dashboards.md:93`.
- **Phương án:** (a) dashboard nhân sự chỉ hiện việc, tài liệu, review và độ phủ bằng chứng, không hiện điểm; (b) giữ điểm nháp SPEC-003 có nhãn «nháp, không dùng KPI/lương»; (c) không đụng dashboard nhân sự trong lát 4.
- **Ai quyết:** Chairman.

## OQ-18 — Lát 5 chưa có SPEC; incident nằm ở «P1 mở rộng»

- **Lát:** 5 dừng tại đây.
- **Phía A:** `docs/HANDOFF-CLAUDE-CODE-20261111.md:57` giao sự cố, CR, release, SHA, bảo trì, runbook, sổ backup.
- **Phía B:** `docs/IMPLEMENTATION-ROADMAP.md:17` xếp incident vào «P1 mở rộng», BoM chốt thứ tự sau pilot; `:52` chỉ có một dòng mô tả. Không có hợp đồng dữ liệu, API, mã ca; nguồn gần nhất là `SPEC-008…:191-192`, `:198`, `:228`, COO-03 `:266`, COO-07 `:270`. `SPEC-008…:53` đòi ADR cho entity mới.
- **Phương án:** (a) viết SPEC-010 (kèm mã ca OPS-xx) và ADR trước khi lập trình; (b) lập trình theo SPEC-008 §9.2/§11.1 với bộ ca do brief đề xuất, Chairman duyệt bộ ca; (c) hoãn lát 5 tới sau pilot theo roadmap `:17`.
- **Ai quyết:** Chairman.

## OQ-19 — Nguồn quan sát SHA đang chạy; dịch vụ nào trong phạm vi

- **Lát:** 5.
- **Phía A:** `HANDOFF…:57` «quan sát SHA đang chạy (mong muốn so với thực tế)»; bảng `services` đã có `desired_sha`, `observed_sha`, `observed_at` (`migrations/001_foundation.sql:20`), hiển thị ở `src/components/workspace.tsx:51`.
- **Phía B:** `HANDOFF…:71` và AR-01 cấm đọc DB nền khác; hiện chỉ AI OS tự khai SHA của chính nó (`src/app/api/health/route.ts:10`). Không tài liệu nào nêu ai báo `observed_sha` của BTNET, Xeca, Lilog…, qua đường nào, dịch vụ nào thuộc phạm vi; lịch trực phải được duyệt sẵn (`SPEC-008…:220`).
- **Phương án:** (a) chỉ quan sát AI OS và bot trong đợt này; (b) người vận hành nhập tay kèm bằng chứng; (c) AI OS gọi endpoint health công khai của từng platform (REST, cần danh sách được duyệt); (d) platform tự đẩy sự kiện deploy có chữ ký.
- **Ai quyết:** BoM Tech (Quân) đề xuất danh sách; Chairman duyệt phạm vi.

## OQ-20 — Quy ước tệp rollback migration

- **Lát:** 1–5.
- **Phía A:** E-DB-04 và Quality Gate M-03 đòi migration idempotent **và** có rollback.
- **Phía B:** `migrations/001`–`012` không có tệp rollback. `scripts/migrate.ts:12` và `src/server/db.ts:11` chạy mọi tệp khớp `^\d+.*\.sql` trong `migrations/` — tệp rollback đặt cùng thư mục, tên bắt đầu bằng số, sẽ bị chạy như migration tiến.
- **Phương án:** (a) thư mục con `migrations/rollback/` (runner không đọc đệ quy); (b) `scripts/rollback/`; (c) cùng thư mục, tên không bắt đầu bằng số (`down_013_….sql`). Kèm: có viết bù rollback cho 001–012 hay không.
- **Ai quyết:** BoM Tech (Quân).

## OQ-21 — Mẫu T0–T6 «cài» vào đâu

- **Lát:** 1, 3.
- **Phía A:** `HANDOFF…:53` đưa «mẫu T0–T6» vào lát 1.
- **Phía B:** `docs/PM-DOCUMENT-TEMPLATES.md:3` «chưa cài vào bot»; `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:117` chỉ nói bộ mẫu «điền được», không nêu nơi lưu, cách đánh version, ai được sửa.
- **Phương án:** (a) tệp mẫu có version trong repo + bảng đăng ký mẫu (mã, version, hash) trong AI OS; (b) mẫu nằm trong skill của bot; (c) cả hai, AI OS là nơi giữ version chuẩn.
- **Ai quyết:** BoM Tech (Phương).
