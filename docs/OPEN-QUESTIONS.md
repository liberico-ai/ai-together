# Câu hỏi mở — LibeTech AI OS, đợt lập trình theo roadmap

Version 0.2 · 12/11/2026 (0.1 lập 11/11/2026) · Lập bởi agent `planner` khi viết [SLICE-BRIEFS](SLICE-BRIEFS.md). Căn cứ: `HANDOFF-CLAUDE-CODE-20261111.md:30` — SPEC mâu thuẫn hoặc thiếu thì ghi vào đây và dừng lát đó, không tự chọn.

Cách đọc: mỗi mục nêu lát bị ảnh hưởng, hai phía mâu thuẫn kèm con trỏ `tệp:dòng` (đường dẫn tính từ gốc repo; tài liệu nằm trong `docs/`), các phương án, và người quyết. Khi có quyết định, ghi ngày, người quyết và nội dung ngay dưới mục; không xoá mục. Con trỏ `ADR-002…:dòng` trong phần «Phía A/B» chỉ bản 1.0 của ADR; bản 1.1 đã đổi số dòng.

**Trạng thái 0.2:** cả 21 mục đã có quyết định hướng ngày 12/11/2026, ghi dưới từng mục; bản tổng hợp ở [DECISION-PACK-OQ-20261112](DECISION-PACK-OQ-20261112.md) bản 0.2. OQ-01, OQ-02, OQ-04 **đã chốt**: Chairman ký ADR-002 1.1 ngày 12/11/2026 («Ký ADR-002 1.1») — tới lúc đó migration 013+ chưa được viết. Mục Chairman nêu tên thắng; mục còn lại theo bảng §4 của `reviews/CODEX-STEP0-P1-READINESS-20261112.md:68-87`.

Lời Chairman 12/11/2026 (nguyên văn):

> «Duyệt hướng của gói OQ ngày 12/11, với các sửa theo phản biện Codex: OQ-03 chọn b; OQ-04 chưa tự ánh xạ LibeTech nội bộ; OQ-05 chọn a cho cổng P1.0; OQ-07 phải chốt quyền nguồn, lưu giữ và thử khôi phục trước pilot; OQ-09 phải chứng minh đường nhận tin và đối soát hai kho; OQ-14 làm c trước, chỉ nối mô hình sau khi duyệt phân loại dữ liệu; OQ-18 soạn SPEC/ADR trước, lập trình sau pilot; OQ-19 chỉ coi health tự khai là thông tin báo cáo; OQ-20 chỉ yêu cầu rollback từ migration 013. Các mục còn lại theo bảng phản biện.
> Sửa ADR-002 v1.1 và brief cho nhất quán rồi trình lại bản chốt. Giữ main của ai-together cho lab, làm và review AI OS trên nhánh libetech-ai-os, phát hành d1-ai1 theo tuyến riêng. Với libe-tech, giữ cây gateway làm bằng chứng, chuyển có chọn lọc phần mã an toàn lên từ origin/main; không push nguyên 30 thay đổi. Các điểm dừng triển khai, migration thật, gateway restart và gửi tin thật giữ nguyên.»

| Mã | Lát | Một dòng | Người quyết | Chốt 12/11 |
|---|---|---|---|---|
| OQ-01 | 1 (kéo theo 2–4) | ADR-002 chưa ký mà lát 1 dựa vào | Chairman | (b), đã ký 12/11 |
| OQ-02 | 1, 2 | ADR-002 không phủ ProjectChannel, SourceEvent, sổ dự án | Chairman | (a), đã ký 12/11 |
| OQ-03 | 1 | Nhãn cũ và footer `0.3.0` không còn ở chỗ handoff chỉ | BoM Tech | (b) |
| OQ-04 | 1, 4, 5 | Trục thực thể Liberico BU · Xeca · IBS HI chưa có trong schema | Chairman | (a) có sửa, đã ký 12/11 |
| OQ-05 | 1 | Cổng P1.0 «bản chuẩn riêng» khi chưa có bản chuẩn, người duyệt, tin gốc Xeca | Chairman | (a) |
| OQ-06 | 1, 3, 4 | Tài liệu gắn vào «việc» nào khi Z1 chưa có work item | BoM Tech | (a) |
| OQ-07 | 1, 3, 4 | Nơi giữ snapshot bản chuẩn, retention, quyền đọc Drive/Git | Chairman + BoM Tech | (a) cho P1.0; kho có cổng |
| OQ-08 | 2, 3 | «Bot chỉ đọc» trong AGENTS/ADR-001 so với intake ghi qua bot | Chairman | (b), lát 2 |
| OQ-09 | 2 | Lưu bền trước ở sổ ticket plugin hay inbox AI OS; plugin nào nhận tin | Chairman | (c) có điều kiện |
| OQ-10 | 2 | Tuyến và giới hạn cho intake/tệp đính kèm qua cầu nối | BoM Tech | (b)+(c), lát 2 |
| OQ-11 | 2, 4, 5 | Ai gửi Telegram cho outbox; chat ID, topic, privacy mode chưa xác minh | BoM Tech + Chairman | (a), lát 2 |
| OQ-12 | 2 | «Phần còn thiếu SPEC-007» gồm những gì | Chairman | (c), tách ba ca |
| OQ-13 | 2–5 | «8 ca SPEC-008» là PM-01…08 hay XI-01…08 | Chairman | (c) |
| OQ-14 | 3 | Z4 chưa bật; sáu kỹ năng chạy ở đâu, mô hình và bộ eval nào | Chairman | (c) trước |
| OQ-15 | 3 | Phần nào của lát 3 là mới so với mã đã có; evidence phi mã có thuộc lát | BoM Tech | (a) |
| OQ-16 | 3, 4 | «Cập nhật phụ thuộc» thuộc P1.2 hay P1.3 | BoM Tech | (c) |
| OQ-17 | 4 | Dashboard nhân sự so với «Score nhân sự để sau» | Chairman | (a) |
| OQ-18 | 5 | Lát 5 chưa có SPEC; incident nằm ở «P1 mở rộng» trong roadmap | Chairman | (a), mã sau pilot |
| OQ-19 | 5 | Nguồn quan sát SHA đang chạy của platform khác; dịch vụ nào trong phạm vi | BoM Tech + Chairman | health = báo cáo |
| OQ-20 | 1–5 | Quy ước tệp rollback migration chưa có; runner chạy mọi tệp `^\d+…sql` | BoM Tech | (a), từ 013 |
| OQ-21 | 1, 3 | Mẫu T0–T6 «cài» vào đâu | BoM Tech | (a) |

---

## OQ-01 — ADR-002 chưa ký mà lát 1 dựa vào

- **Lát:** 1 dừng tại đây trước migration tài liệu; lát 2–4 dùng cùng mô hình chủ dữ liệu.
- **Phía A:** `docs/ADR-002-project-document-ownership.md:3` ghi «Proposed … chưa ký»; `:27` ghi «Decision: chưa ghi … Quyết định chọn nghiên cứu của Chairman không được điền thay approval triển khai».
- **Phía B:** `docs/HANDOFF-CLAUDE-CODE-20261111.md:53` giao lát 1 xây sổ tài liệu; `:96` yêu cầu hỏi nếu tới lúc cần mà chưa ký. `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:18` cũng ghi ADR chưa phải quyết định đã ký.
- **Phương án:** (a) Chairman ký ADR-002 nguyên văn, điền `:27`; (b) ký có sửa, planner cập nhật brief theo bản ký; (c) chưa ký — lát 1 chỉ làm phần không tạo entity mới (sửa nhãn theo OQ-03, test quyền âm trên mã hiện có), không viết migration 013+.
- **Ai quyết:** Chairman.
- **Quyết định 12/11/2026 (Chairman, duyệt hướng):** chọn (b): ký ADR-002 có sửa, bản 1.1 (đã sửa 12/11, vẫn Proposed). Nguồn: Codex §4 `reviews/CODEX-STEP0-P1-READINESS-20261112.md:70`, trùng gói 0.1. Lời duyệt hướng không thay chữ ký; migration 013+ chỉ viết sau khi ký. **Chốt khi ký ADR-002 1.1.** **Đã chốt:** Chairman ký ADR-002 1.1 ngày 12/11/2026 («Ký ADR-002 1.1»).

## OQ-02 — ADR-002 không phủ ProjectChannel, SourceEvent và sổ dự án

- **Lát:** 1 (ProjectChannel, sổ dự án), 2 (SourceEvent, inbox, outbox).
- **Phía A:** `docs/ADR-002-project-document-ownership.md:12` liệt kê AI OS sở hữu DocumentRecord, DocumentRevision, ReviewDecision, Publication, TraceLink — không có ProjectChannel, SourceEvent hay Project mở rộng.
- **Phía B:** `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:135-136` định nghĩa SourceEvent, ProjectChannel; `docs/SPEC-008-PM-operating-loop-20261111.md:53` đòi «ADR về entity và cutover trước migration» theo AR-09; `:137` đặt «Chốt ADR và quyền» làm lát 0. Luật: E-AI-02 (không tạo schema ngoài canonical model khi chưa duyệt).
- **Phương án:** (a) mở rộng ADR-002 trước khi ký để phủ cả ba; (b) ADR-003 riêng cho sổ dự án/kênh/sự kiện nguồn; (c) Chairman xác nhận bằng văn bản rằng các bảng này là mở rộng của `projects` hiện có (`migrations/001_foundation.sql:13`) và không cần ADR mới.
- **Ai quyết:** Chairman.
- **Quyết định 12/11/2026 (Chairman, duyệt hướng):** chọn (a): mở rộng ADR-002 phủ sổ dự án, ProjectChannel, SourceEvent/intake, outbox; quyền chủ SourceEvent/intake chỉ có hiệu lực ở P1.1. Nguồn: Codex §4 `reviews/CODEX-STEP0-P1-READINESS-20261112.md:70` và §5 `:95-97`. **Chốt khi ký ADR-002 1.1.** **Đã chốt:** Chairman ký ADR-002 1.1 ngày 12/11/2026 («Ký ADR-002 1.1»).

## OQ-03 — Nhãn cũ và footer `0.3.0` không còn ở chỗ handoff chỉ

- **Lát:** 1.
- **Phía A:** `docs/HANDOFF-CLAUDE-CODE-20261111.md:98` và `docs/IMPLEMENTATION-ROADMAP.md:44` nói `src/components/workspace.tsx` còn nhãn «Bot LibeTech · Chưa nối nền tảng mới» và footer `0.3.0`.
- **Phía B:** mã hiện tại: `src/components/workspace.tsx:39` đã là «Bot LibeTech / Cầu nối đọc và duyệt Telegram» và «AI OS · 0.7.1»; `:47` footer «LibeTech AI OS · 0.7.1». Chuỗi `0.3.0` còn ở `src/server/bridge.ts:43` (trường `version` của phản hồi cầu nối) và `bot-plugin/__init__.py:15`; `bot-plugin/plugin.yaml` khai `0.2.1`. Số bản bị viết cứng ba nơi: `workspace.tsx:39`, `:47`, `src/app/api/health/route.ts:10`. Roadmap `:44` còn đòi hiện ba trạng thái `đã cấu hình`, `đã kiểm thực tế`, `chưa nối luồng ghi` — chưa có.
- **Phương án:** (a) coi việc sửa nhãn đã xong, lát 1 chỉ thêm ba trạng thái theo roadmap `:44`; (b) thêm việc gom số bản về một nguồn và sửa `bridge.ts:43`; (c) sửa cả `bot-plugin` (đụng plugin ⇒ cài lại bridge ⇒ điểm dừng Chairman).
- **Ai quyết:** BoM Tech (Quân); phương án (c) cần Chairman.
- **Quyết định 12/11/2026 (Chairman, duyệt hướng):** chọn (b): thêm ba trạng thái, gom số bản về một nguồn, sửa `src/server/bridge.ts:43`; không đụng `bot-plugin` (loại (c)). Không gắn «đã kiểm thực tế» chỉ từ biến cấu hình. Nguồn: Chairman nêu tên; lưu ý của Codex §4 `reviews/CODEX-STEP0-P1-READINESS-20261112.md:71`. Làm ở lát 1.

## OQ-04 — Trục thực thể Liberico BU · Xeca · IBS HI chưa có trong schema

- **Lát:** 1 (schema sổ dự án), 4 (dashboard), 5 (báo cáo vận hành).
- **Phía A:** `docs/HANDOFF-CLAUDE-CODE-20261111.md:74` buộc tách dashboard/báo cáo theo ba thực thể; IBS HI là pháp nhân ngoài Liberico. `docs/SPEC-008-PM-operating-loop-20261111.md:228`: «Không dùng tenant_id, organization_id, BU và pháp nhân kế toán lẫn nhau».
- **Phía B:** mã chỉ có một tenant và cột chữ `projects.bu` (`migrations/001_foundation.sql:14`), giá trị đang dùng `XECA`, `LBRC`, `IBS HI` (`migrations/011_team_source_catalog.sql:51`) và `LibeTech` (`migrations/008_platform_workspace.sql:9`); `src/app/portfolio/page.tsx:9` sắp theo `bu`. Không có trường thực thể; `LibeTech` nội bộ thuộc nhóm nào chưa nêu.
- **Phương án:** (a) thêm cột thực thể có ràng buộc trên `projects` và bảng ánh xạ `bu → thực thể` do người có quyền duyệt; (b) giữ `bu`, quy ước ánh xạ trong mã; (c) tách tenant theo pháp nhân (đổi mô hình RLS, cần ADR).
- **Ai quyết:** Chairman (ranh giới pháp nhân); BoM Tech thực hiện.
- **Quyết định 12/11/2026 (Chairman, duyệt hướng):** chọn (a) có sửa: ba nhãn miền báo cáo tách khỏi tenant/BU/pháp nhân; giữ project ID, membership, RLS; không tách tenant. AI không tạo hay đề xuất dòng ánh xạ nào — LibeTech nội bộ không được nêu cả ở dạng gợi ý; dòng ánh xạ do người có quyền tạo/xác nhận, có nguồn; thiếu ánh xạ hiện «Chưa xác nhận», không cộng vào tổng nào. Nguồn: Chairman nêu tên + Codex §4 `reviews/CODEX-STEP0-P1-READINESS-20261112.md:72`. **Chốt khi ký ADR-002 1.1.** **Đã chốt:** Chairman ký ADR-002 1.1 ngày 12/11/2026 («Ký ADR-002 1.1»).

## OQ-05 — Cổng P1.0 «bản nháp và bản chuẩn riêng» khi chưa có bản chuẩn, người duyệt và tin gốc Xeca

- **Lát:** 1.
- **Phía A:** `docs/HANDOFF-CLAUDE-CODE-20261111.md:53` và `docs/IMPLEMENTATION-ROADMAP.md:13`: XECA006 và LBRC014 «có nguồn, bản nháp và bản chuẩn riêng».
- **Phía B:** `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:183` chỉ đòi «có chỉ mục nguồn không trùng»; `:197` ghi người duyệt theo dự án và nơi giữ snapshot chưa xác minh; `docs/DESIGN-SYSTEM-PM-DOCUMENTS.md:37` minh hoạ XECA006 «Bản chuẩn: Chưa có». Tin gốc Xeca chưa đối chiếu: `HANDOFF…:99`, `SPEC-009…:155`, `SPEC-008…:124`.
- **Phương án:** (a) cổng đạt khi hai con trỏ tách riêng trong schema và UI, bản chuẩn được phép rỗng với nhãn «Chưa có»; (b) cổng chỉ đạt khi có ít nhất một revision được người có quyền duyệt cho mỗi ca; (c) LBRC014 đạt theo (a), XECA006 treo tới khi có tin gốc.
- **Ai quyết:** Chairman.
- **Quyết định 12/11/2026 (Chairman, duyệt hướng):** chọn (a) cho cổng P1.0: hai con trỏ độc lập, bản chuẩn được rỗng với nhãn «Chưa có»; P1.0 không tạo bản duyệt thật. Ca Xeca vẫn ghi «chờ tin gốc». Nguồn: Chairman nêu tên; Codex §4 `reviews/CODEX-STEP0-P1-READINESS-20261112.md:73`.

## OQ-06 — Tài liệu gắn vào «việc» nào khi Z1 chưa có work item

- **Lát:** 1 (liên kết), 3 (review gắn việc), 4 (truy bằng chứng).
- **Phía A:** `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:140` TraceLink nối yêu cầu ↔ revision ↔ work ↔ evidence.
- **Phía B:** `docs/DELIVERY-007-team-catalog-20261111.md:10` — 0 Z1 work item; 45 dòng nguồn nằm ở Z2 `analytics.tech_source_tasks` (`migrations/011_team_source_catalog.sql:3`), LBRC014 ở `analytics.reconciliations`. `SPEC-009…:159` ghi chưa cấp mã/việc mới; `SPEC-008…:118` bước (B) chỉ cấp ID bền sau khi PM xác nhận mapping; `docs/SPEC-005-source-exception-slice.md:9` — `source_ref` không phải ID việc.
- **Phương án:** (a) TraceLink trỏ `source_ref` Z2 với nhãn «chưa đối soát»; (b) tạo Z1 work cho XECA006/LBRC014 sau khi Phương xác nhận mapping (thao tác trên dữ liệu thật ⇒ điểm dừng); (c) lát 1 để trống liên kết việc, chỉ lưu mã chữ.
- **Ai quyết:** BoM Tech (Phương xác nhận mapping).
- **Quyết định 12/11/2026 (Chairman, duyệt hướng):** chọn (a): giữ `source_ref` làm tham chiếu nguồn với nhãn «chưa đối soát»; không tạo việc Z1. PM xác nhận ánh xạ khi tới bước cấp ID việc (ngoài đợt này). Nguồn: Codex §4 `reviews/CODEX-STEP0-P1-READINESS-20261112.md:74` (thay đề xuất (b) của gói 0.1).

## OQ-07 — Nơi giữ snapshot bản chuẩn, retention và quyền đọc Drive/Git

- **Lát:** 1, 3, 4.
- **Phía A:** `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:78` — không giữ được bản chuẩn thì trạng thái là «chưa đóng băng được»; `docs/ADR-002-project-document-ownership.md:13` đòi snapshot riêng đúng quyền.
- **Phía B:** `SPEC-009…:197` — chưa xác minh quyền service account Drive/Docs, cơ chế giữ snapshot, retention; `:149` — retention do chủ nguồn quyết trước pilot, kể cả embeddings và backup. Repo không có kho blob hay khoá Drive; `IMPLEMENTATION-ROADMAP.md:77` cấm đưa khoá vào repo. IBS HI: `SPEC-009…:80` chỉ con trỏ/hash/metadata.
- **Phương án:** (a) lát 1 chỉ lưu con trỏ + revision + hash do người đăng ký khai, mọi tài liệu ở `SOURCE_NOT_FROZEN` tới khi có kho; (b) snapshot trong PostgreSQL (bytea, giới hạn kích thước); (c) thư mục riêng trên d1-ai1 ngoài repo, AI OS giữ hash và đường dẫn; (d) adapter đọc Drive/Git bằng tài khoản dịch vụ do vận hành cấp.
- **Ai quyết:** Chairman (retention, quyền nguồn); BoM Tech (kho).
- **Quyết định 12/11/2026 (Chairman, duyệt hướng):** P1.0 chỉ metadata theo (a), thêm mức xác minh để hash tự khai không hiện như đã kiểm. Thiết kế kho snapshot (b) giữ trong ADR-002 nhưng không đóng băng, tải lên hay duyệt bản chuẩn thật trước khi chốt quyền nguồn, chính sách lưu giữ và một lần thử khôi phục đạt — cổng trước pilot. Nguồn: Chairman nêu tên + Codex §4 `reviews/CODEX-STEP0-P1-READINESS-20261112.md:75`.

## OQ-08 — «Bot chỉ đọc» so với intake ghi qua bot

- **Lát:** 2, 3.
- **Phía A:** `AGENTS.md:13` «Bot principal is read-only»; `docs/ADR-001-foundation.md:10`; `docs/SPEC-002-identity-postgres.md:11` «The bridge cannot create, accept or close work».
- **Phía B:** `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:143` `POST /api/intake-events` cho gateway đã ký; `docs/SPEC-008-PM-operating-loop-20261111.md:75` — bridge được tạo «ứng viên intake hẹp»; `:296` service principal ghi ứng viên. (Phiếu duyệt tài khoản qua cầu nối đã ghi vào schema identity: `src/server/bridge.ts:32`.)
- **Phương án:** (a) Chairman cho sửa `AGENTS.md:13`: bot được ghi đúng hai loại bản ghi (sự kiện nguồn, ứng viên intake), vẫn cấm ghi work/nghiệm thu; (b) giữ bot chỉ đọc, intake đi bằng principal dịch vụ riêng khác principal bot; (c) lát 2 chỉ làm phía web.
- **Ai quyết:** Chairman (R10: AI không tự sửa AGENTS.md).
- **Quyết định 12/11/2026 (Chairman, duyệt hướng):** chọn (b): bot giữ chỉ đọc; principal tiếp nhận hẹp riêng, làm ở P1.1; sửa `AGENTS.md` là đề xuất có chủ đích do Chairman thực hiện, không sửa ngầm. Nguồn: Codex §4 `reviews/CODEX-STEP0-P1-READINESS-20261112.md:76`, trùng gói 0.1.

## OQ-09 — Lưu bền trước ở đâu, và plugin nào nhận tin

- **Lát:** 2.
- **Phía A:** `docs/SPEC-008-PM-operating-loop-20261111.md:74-75` — bot mở ticket trong sổ ticket (SQLite của plugin priority1) rồi adapter gửi sang AI OS; `:292` «Sổ ticket hiện hữu tiếp tục giữ tiếp nhận cho đến khi ADR chuyển chủ dữ liệu … Không tạo hai nguồn cùng sửa trạng thái một ticket».
- **Phía B:** `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:53-56` (sơ đồ gateway → inbox AI OS) và `:87` «Ghi bền nguồn trước khi ACK»; `:18` chỉ cho SPEC-009 ưu tiên khi khác §13/15 của SPEC-008, không nói tới §3. `AGENTS.md:5` «priority1 plugin remains independent», trong khi `HANDOFF…:14` liệt kê plugin đó là đối tượng; `bot-plugin/plugin.yaml` tự mô tả «Independent of libetech-priority1».
- **Phương án:** (a) sổ ticket priority1 lưu trước, AI OS nhận qua adapter; (b) inbox AI OS lưu trước, không qua sổ ticket; (c) ghi cả hai với một khoá sự kiện chung, sổ ticket là chủ trạng thái ticket. Kèm câu hỏi: tin nhóm do `bot-plugin` của repo này hay plugin priority1 bắt.
- **Ai quyết:** Chairman (đổi chủ dữ liệu tiếp nhận ⇒ ADR theo AR-09).
- **Quyết định 12/11/2026 (Chairman, duyệt hướng):** hướng (c), sổ ticket hiện hữu tiếp tục là chủ trạng thái ticket. Thiết kế inbox chỉ có hiệu lực sau hai mục nghiệm thu của P1.1: (1) chứng minh đường nhận thật đưa được tin nhóm tới `bot-plugin` của repo này song song với priority1; (2) ca đối soát inbox ↔ sổ ticket đạt. Không đạt thì dừng và trình lại; không sửa plugin priority1. Nguồn: Chairman nêu tên + Codex §4 `reviews/CODEX-STEP0-P1-READINESS-20261112.md:77`.

## OQ-10 — Tuyến và giới hạn cho intake, tệp đính kèm

- **Lát:** 2.
- **Phía A:** `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:145` — endpoint tiếp nhận chỉ trên listener nội bộ hoặc namespace bridge bị proxy chặn; `:149` — tệp đính kèm lưu private, «giới hạn kích thước/loại» nhưng không nêu con số.
- **Phía B:** `src/server/bridge.ts:19` giới hạn thân yêu cầu 4096 byte; `:16` chuỗi ký cố định đường `/api/bridge`; `:8` ngữ cảnh không có topic, reply-to, edit_date; `docs/DEPLOY-003-team-access.md:103-104` proxy chặn `/api/bridge`.
- **Phương án:** (a) thêm operation `intake_event` vào `/api/bridge` và nâng trần kích thước; (b) route mới dưới `/api/bridge/…` có chuỗi ký riêng; (c) tệp không đi qua cầu nối — gateway lưu tệp, AI OS chỉ nhận locator + hash. Cần chốt trần kích thước và loại tệp.
- **Ai quyết:** BoM Tech (Quân).
- **Quyết định 12/11/2026 (Chairman, duyệt hướng):** chọn (b)+(c): tuyến ký riêng trong vùng bị proxy chặn; tệp chỉ đi locator + hash. Làm ở P1.1. Trần kích thước và loại tệp là đề xuất kỹ thuật của kế hoạch lát 2, reviewer kiểm — chưa là chính sách. Nguồn: Codex §4 `reviews/CODEX-STEP0-P1-READINESS-20261112.md:78`, trùng gói 0.1.

## OQ-11 — Ai gửi Telegram cho outbox; chat ID, topic, privacy mode

- **Lát:** 2, 4, 5.
- **Phía A:** `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:125` «Published cần delivery receipt»; `:147` trạng thái uncertain phải đối soát receipt trước khi gửi lại.
- **Phía B:** AI OS không giữ token Telegram (`IMPLEMENTATION-ROADMAP.md:77`); gateway chung khoảng 20 bot (`HANDOFF…:76`). `SPEC-009…:85` — đổi privacy mode ảnh hưởng nhiều nhóm; `:197` chat ID/topic chưa xác minh; `SPEC-008…:294` tên «LBRC Xeca» chưa khớp chat ID. Ánh xạ nhóm hiện là tệp cấu hình (`src/app/api/bridge/route.ts:12`), chưa là bảng.
- **Phương án:** (a) gateway kéo outbox qua cầu nối đã ký rồi báo receipt; (b) AI OS gọi một endpoint cục bộ của gateway; (c) lát 2 chỉ dừng ở outbox + receipt giả lập, gửi thật là đợt sau. Kèm: nguồn sự thật của ánh xạ nhóm là tệp cấu hình hay bảng ProjectChannel; có đổi privacy mode hay không.
- **Ai quyết:** BoM Tech (cơ chế); Chairman (privacy mode, gửi thật).
- **Quyết định 12/11/2026 (Chairman, duyệt hướng):** chọn (a): gateway kéo outbox và báo biên nhận, làm ở P1.1. P1.0 chỉ lưu ánh xạ nhóm ở trạng thái đề xuất/chưa kích hoạt; cấu hình gateway giữ hiệu lực. Không đổi privacy mode; gửi thật vẫn là điểm dừng. Nguồn: Codex §4 `reviews/CODEX-STEP0-P1-READINESS-20261112.md:78`, trùng gói 0.1.

## OQ-12 — «Phần còn thiếu SPEC-007» gồm những gì

- **Lát:** 2.
- **Phía A:** `docs/HANDOFF-CLAUDE-CODE-20261111.md:54` — «bot tự gửi tin riêng mời duyệt tài khoản, nút Yes/No trên Telegram».
- **Phía B:** lệnh `/duyet` Yes/No đã có trong nguồn (`bot-plugin/__init__.py:203`, `:245`; test `tests/test_bot_bridge.py:47`) nhưng chưa triển khai (`docs/SPEC-007-telegram-account-approval.md:13`); thứ thật sự chưa viết là DM tự động có biên nhận giao. `SPEC-007…:33`, `:40` còn nêu phiếu đổi quyền cho thành viên đã có (access-change ballot) chưa làm; `docs/DELIVERY-007-team-catalog-20261111.md:23` cũng chờ luồng đó. Cổng nghiệm thu thật ở `SPEC-007…:46` chưa chạy.
- **Phương án:** (a) chỉ DM tự động + biên nhận, dùng `/duyet` sẵn có; (b) thêm phiếu đổi quyền; (c) thêm cả ca thật hai người bỏ phiếu trên runtime (cần Chairman cho gửi tin và khởi động lại gateway).
- **Ai quyết:** Chairman.
- **Quyết định 12/11/2026 (Chairman, duyệt hướng):** chọn (c), tách thành ba ca riêng ở P1.1: DM tự động có biên nhận · phiếu đổi quyền · UAT thật hai người bỏ phiếu. Có mã Yes/No trong nguồn không đồng nghĩa đã chạy; UAT thật là điểm dừng. Nguồn: Codex §4 `reviews/CODEX-STEP0-P1-READINESS-20261112.md:79`, trùng gói 0.1.

## OQ-13 — «8 ca SPEC-008» là bộ nào

- **Lát:** 2–5.
- **Phía A:** `docs/HANDOFF-CLAUDE-CODE-20261111.md:27` «8 ca trong SPEC-008».
- **Phía B:** SPEC-008 có hai bộ tám ca: PM-01…08 (`docs/SPEC-008-PM-operating-loop-20261111.md:124-131`) và XI-01…08 (`:321-328`). `IMPLEMENTATION-ROADMAP.md:22` nói XI-02…06 không bắt buộc cho Phase 1; `SPEC-008…:330` nói XI-01/07/08 cần ca thật trên runtime.
- **Phương án:** (a) PM-01…08; (b) XI-01…08; (c) PM-01…08 cộng XI-01/07/08. Brief hiện liệt kê cả hai bộ kèm nhãn, chưa coi bộ nào là bắt buộc.
- **Ai quyết:** Chairman.
- **Quyết định 12/11/2026 (Chairman, duyệt hướng):** chọn (c): PM-01…08 là bộ PM; XI-01/07/08 là ca tiếp nhận thật; XI-02…06 hoãn, không nhập Jira để qua P1.0. Brief ghi mã ca theo từng lát. Nguồn: Codex §4 `reviews/CODEX-STEP0-P1-READINESS-20261112.md:80`, trùng gói 0.1.

## OQ-14 — Z4 chưa bật; sáu kỹ năng chạy ở đâu

- **Lát:** 3.
- **Phía A:** `AGENTS.md:11` «Z4: future AI suggestions; not enabled».
- **Phía B:** `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:40`, `:76` — bản nháp AI ở Z4; `:97-104` sáu kỹ năng; `:106` mỗi kỹ năng cần manifest, tool allowlist, eval set. Không tài liệu nào nêu kỹ năng chạy trong profile Hermes của bot hay trong AI OS, dùng mô hình nào, dữ liệu BU nào được gửi cho mô hình (R6: dữ liệu nhạy cảm chỉ Sovereign).
- **Phương án:** (a) kỹ năng là skill của profile bot, AI OS chỉ nhận nháp vào bảng Z4 qua cầu nối; (b) AI OS gọi mô hình trực tiếp; (c) lát 3 chỉ dựng bảng Z4, hợp đồng vào/ra và bộ eval với đầu ra giả lập, chưa nối mô hình. Kèm: cho sửa `AGENTS.md:11`.
- **Ai quyết:** Chairman.
- **Quyết định 12/11/2026 (Chairman, duyệt hướng):** làm (c) trước: lát 3 dựng bảng Z4, hợp đồng vào/ra, manifest và eval với đầu ra giả lập. Không gọi mô hình, không cấp khoá pipeline AI, Z4 chưa bật cho tới khi Chairman duyệt bảng phân loại dữ liệu → mô hình; nơi chạy kỹ năng chốt cùng bảng đó. Nguồn: Chairman nêu tên; Codex §4 `reviews/CODEX-STEP0-P1-READINESS-20261112.md:81`.

## OQ-15 — Phần nào của lát 3 là mới; evidence phi mã có thuộc lát

- **Lát:** 3.
- **Phía A:** `docs/HANDOFF-CLAUDE-CODE-20261111.md:55` giao «chia lại việc cần BoM Tech 3/3 có biên nhận; tách ba sự kiện».
- **Phía B:** cả hai đã có mã và test: 3/3 ở `src/server/bom.ts:101`, `tests/spec004.test.ts:66`, `:91`; ba sự kiện ở `src/server/service.ts:145-162`, `tests/foundation.test.ts:83`. Phần chưa có: nghiệm thu đầu ra không phải mã — `migrations/001_foundation.sql:41` buộc `source_sha` 40 hex, `service.ts:17-18` cũng vậy, trong khi `SPEC-008…:230` và `SPEC-009…:115` nói không ép Git SHA cho tài liệu; gói này là COO-06 (`SPEC-008…:269`), còn `HANDOFF…:61` chỉ loại ba gói khác.
- **Phương án:** (a) lát 3 giữ nguyên hai phần đã có, chỉ thêm test hồi quy và áp cho vòng tài liệu; (b) thêm evidence phi mã (migration mở rộng bảng `evidence`); (c) thêm bot nhắc phiếu 3/3 theo `SPEC-009…:43`.
- **Ai quyết:** BoM Tech; (b) cần Chairman vì đổi điều kiện nghiệm thu.
- **Quyết định 12/11/2026 (Chairman, duyệt hướng):** chọn (a): giữ và kiểm hồi quy 3/3 cùng ba sự kiện đã có; không mở rộng điều kiện nghiệm thu sang evidence phi mã, không migration bảng `evidence`. Nguồn: Codex §4 `reviews/CODEX-STEP0-P1-READINESS-20261112.md:82` (thay đề xuất (b)+(c) của gói 0.1).

## OQ-16 — «Cập nhật phụ thuộc» thuộc P1.2 hay P1.3

- **Lát:** 3, 4.
- **Phía A:** `docs/IMPLEMENTATION-ROADMAP.md:15` đặt «phê duyệt và cập nhật phụ thuộc» ở P1.2.
- **Phía B:** `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:186` đặt «cập nhật phụ thuộc» ở P1.3; `HANDOFF…:55-56` không nêu ở lát nào. Hành vi mô tả tại `SPEC-009…:127`.
- **Phương án:** (a) lát 3; (b) lát 4; (c) lát 3 đánh dấu phụ thuộc cần xem lại, lát 4 thông báo.
- **Ai quyết:** BoM Tech.
- **Quyết định 12/11/2026 (Chairman, duyệt hướng):** chọn (c): P1.2 lưu liên kết và đánh dấu cần xem lại; P1.3 truy ảnh hưởng và thông báo. Không phải quyết định quyền mới. Nguồn: Codex §4 `reviews/CODEX-STEP0-P1-READINESS-20261112.md:83`, trùng gói 0.1.

## OQ-17 — Dashboard nhân sự so với «Score nhân sự để sau»

- **Lát:** 4.
- **Phía A:** `docs/HANDOFF-CLAUDE-CODE-20261111.md:56` — dashboard nhân sự truy được về bằng chứng, «dữ liệu thiếu không biến thành điểm thấp».
- **Phía B:** `HANDOFF…:61` Score nhân sự chỉ làm khi BoM chọn sau pilot; `:72` cấm tính điểm dùng cho KPI/lương. Mã đã có điểm K1–K4 nháp: `src/server/evidence-scores.ts:82`, `src/server/reports.ts:36`, màn `src/components/reports.tsx:12`; đặc tả `docs/SPEC-003-team-access-evidence-dashboards.md:93`.
- **Phương án:** (a) dashboard nhân sự chỉ hiện việc, tài liệu, review và độ phủ bằng chứng, không hiện điểm; (b) giữ điểm nháp SPEC-003 có nhãn «nháp, không dùng KPI/lương»; (c) không đụng dashboard nhân sự trong lát 4.
- **Ai quyết:** Chairman.
- **Quyết định 12/11/2026 (Chairman, duyệt hướng):** chọn (a): P1.3 hiện công việc và độ phủ bằng chứng; không thêm điểm chính thức hay KPI/lương; không xoá chức năng điểm nháp cũ. Nguồn: Codex §4 `reviews/CODEX-STEP0-P1-READINESS-20261112.md:84`, trùng gói 0.1.

## OQ-18 — Lát 5 chưa có SPEC; incident nằm ở «P1 mở rộng»

- **Lát:** 5 dừng tại đây.
- **Phía A:** `docs/HANDOFF-CLAUDE-CODE-20261111.md:57` giao sự cố, CR, release, SHA, bảo trì, runbook, sổ backup.
- **Phía B:** `docs/IMPLEMENTATION-ROADMAP.md:17` xếp incident vào «P1 mở rộng», BoM chốt thứ tự sau pilot; `:52` chỉ có một dòng mô tả. Không có hợp đồng dữ liệu, API, mã ca; nguồn gần nhất là `SPEC-008…:191-192`, `:198`, `:228`, COO-03 `:266`, COO-07 `:270`. `SPEC-008…:53` đòi ADR cho entity mới.
- **Phương án:** (a) viết SPEC-010 (kèm mã ca OPS-xx) và ADR trước khi lập trình; (b) lập trình theo SPEC-008 §9.2/§11.1 với bộ ca do brief đề xuất, Chairman duyệt bộ ca; (c) hoãn lát 5 tới sau pilot theo roadmap `:17`.
- **Ai quyết:** Chairman.
- **Quyết định 12/11/2026 (Chairman, duyệt hướng):** soạn SPEC-010 và ADR-003 trước; lập trình lát 5 sau pilot và sau khi hai tệp được duyệt. Lát 5 của đợt này chỉ là hai bản nháp. Nguồn: Chairman nêu tên; Codex §4 `reviews/CODEX-STEP0-P1-READINESS-20261112.md:85`.

## OQ-19 — Nguồn quan sát SHA đang chạy; dịch vụ nào trong phạm vi

- **Lát:** 5.
- **Phía A:** `HANDOFF…:57` «quan sát SHA đang chạy (mong muốn so với thực tế)»; bảng `services` đã có `desired_sha`, `observed_sha`, `observed_at` (`migrations/001_foundation.sql:20`), hiển thị ở `src/components/workspace.tsx:51`.
- **Phía B:** `HANDOFF…:71` và AR-01 cấm đọc DB nền khác; hiện chỉ AI OS tự khai SHA của chính nó (`src/app/api/health/route.ts:10`). Không tài liệu nào nêu ai báo `observed_sha` của BTNET, Xeca, Lilog…, qua đường nào, dịch vụ nào thuộc phạm vi; lịch trực phải được duyệt sẵn (`SPEC-008…:220`).
- **Phương án:** (a) chỉ quan sát AI OS và bot trong đợt này; (b) người vận hành nhập tay kèm bằng chứng; (c) AI OS gọi endpoint health công khai của từng platform (REST, cần danh sách được duyệt); (d) platform tự đẩy sự kiện deploy có chữ ký.
- **Ai quyết:** BoM Tech (Quân) đề xuất danh sách; Chairman duyệt phạm vi.
- **Quyết định 12/11/2026 (Chairman, duyệt hướng):** health tự khai, kể cả `/api/health` của AI OS, chỉ là thông tin báo cáo, không là bằng chứng sự thật đã quan sát. Nguồn quan sát độc lập và danh sách dịch vụ chốt trong SPEC-010. Nguồn: Chairman nêu tên; Codex §4 `reviews/CODEX-STEP0-P1-READINESS-20261112.md:85`.

## OQ-20 — Quy ước tệp rollback migration

- **Lát:** 1–5.
- **Phía A:** E-DB-04 và Quality Gate M-03 đòi migration idempotent **và** có rollback.
- **Phía B:** `migrations/001`–`012` không có tệp rollback. `scripts/migrate.ts:12` và `src/server/db.ts:11` chạy mọi tệp khớp `^\d+.*\.sql` trong `migrations/` — tệp rollback đặt cùng thư mục, tên bắt đầu bằng số, sẽ bị chạy như migration tiến.
- **Phương án:** (a) thư mục con `migrations/rollback/` (runner không đọc đệ quy); (b) `scripts/rollback/`; (c) cùng thư mục, tên không bắt đầu bằng số (`down_013_….sql`). Kèm: có viết bù rollback cho 001–012 hay không.
- **Ai quyết:** BoM Tech (Quân).
- **Quyết định 12/11/2026 (Chairman, duyệt hướng):** chọn (a): tệp rollback ở `migrations/rollback/` (runner không quét), bắt buộc từ migration 013, thử trên bản sao; không viết bù cho 001–012. Nguồn: Chairman nêu tên; Codex §4 `reviews/CODEX-STEP0-P1-READINESS-20261112.md:86`.

## OQ-21 — Mẫu T0–T6 «cài» vào đâu

- **Lát:** 1, 3.
- **Phía A:** `HANDOFF…:53` đưa «mẫu T0–T6» vào lát 1.
- **Phía B:** `docs/PM-DOCUMENT-TEMPLATES.md:3` «chưa cài vào bot»; `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:117` chỉ nói bộ mẫu «điền được», không nêu nơi lưu, cách đánh version, ai được sửa.
- **Phương án:** (a) tệp mẫu có version trong repo + bảng đăng ký mẫu (mã, version, hash) trong AI OS; (b) mẫu nằm trong skill của bot; (c) cả hai, AI OS là nơi giữ version chuẩn.
- **Ai quyết:** BoM Tech (Phương).
- **Quyết định 12/11/2026 (Chairman, duyệt hướng):** chọn (a): tệp mẫu T0–T6 có version và hash trong repo, AI OS giữ chỉ mục mẫu; không cài skill bot ở P1.0. Builder ghi vị trí thư mục và test trong kế hoạch. Nguồn: Codex §4 `reviews/CODEX-STEP0-P1-READINESS-20261112.md:87` (thay đề xuất (c) của gói 0.1).

---

**Bổ sung 12/11/2026 khi lập kế hoạch lát 1** (`docs/plans/slice-1-doc-ownership.md`, base `208d37b`). Ba mục dưới đây ghi lúc lập kế hoạch khi **chưa có quyết định**; câu «cả 21 mục đã có quyết định» ở đầu tệp chỉ nói về OQ-01…OQ-21. **Cả ba đã được Chairman chốt ngày 12/11/2026** (dòng «Quyết định» dưới từng mục).

## OQ-22 — Ai chạy projector chỉ mục tài liệu Z2 lúc vận hành, bằng role nào

- **Lát:** 1 (chỉ phần nối projector vào đường chạy của web; bảng, hàm projector, tìm/xuất và test vẫn làm), 4 (mở rộng chỉ mục sang tìm nội dung).
- **Phía A:** `docs/SLICE-BRIEFS.md:51` — bảng chỉ mục ở schema `analytics` có «policy ghi riêng cho projector, đọc cho runtime», mẫu `migrations/005_evidence_dashboards.sql:43-44`, `:49-50` (policy `TO libetech_projector`). Role này chỉ được nhận trong `src/server/evidence-projector.ts:59`, chạy từ `scripts/project-evidence.ts` bằng login vận hành (`MIGRATION_DATABASE_URL`).
- **Phía B:** `docs/SLICE-BRIEFS.md:34` lấy mẫu `src/server/projector.ts:3` — projector chạy **trong** transaction của yêu cầu web bằng role `libetech_runtime` (`migrations/001_foundation.sql:89` cấp INSERT/UPDATE cho runtime). Login web `libetech_web` chỉ là thành viên của `libetech_runtime` (`migrations/003_runtime_roles.sql:11`), không nhận được `libetech_projector`. `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:193` đề xuất «bản chiếu cập nhật trong 5 phút» nhưng chưa ai chốt. Hệ quả: theo phía A, người dùng đăng ký tài liệu qua web xong thì chỉ mục tìm kiếm chưa có dòng mới cho tới khi có ai đó chạy projector.
- **Phương án:** (a) tiến trình web gọi projector ngay sau khi commit, bằng một role projector cấp cho `libetech_web` — phải thêm quyền cho login runtime; kèm câu hỏi dùng lại `libetech_projector` (đang có quyền ghi `analytics.evidence_runs`) hay tạo role hẹp riêng cho chỉ mục tài liệu; (b) chỉ login vận hành chạy projector theo lịch hoặc bằng tay (`scripts/`), giao diện hiện thời điểm chiếu — cần thêm job trên máy chủ, là điểm dừng triển khai; (c) cho `libetech_runtime` ghi chỉ mục trong cùng transaction như `projectWorkSummary` — trái câu «policy ghi riêng cho projector».
- **Ai quyết:** BoM Tech (Quân) cho cơ chế; Chairman nếu phương án đổi quyền của login runtime hoặc thêm job trên d1-ai1.
- **Quyết định 12/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối):** «(b) Login vận hành (Recommended)». Projector chỉ mục tài liệu Z2 chỉ chạy bằng login vận hành, theo lịch hoặc bằng tay qua `scripts/`; giao diện hiện thời điểm chiếu; không cấp role nào cho `libetech_web`. Job trên d1-ai1 thuộc điểm dừng triển khai, lát 1 không dựng. Trường «Ai quyết» ghi BoM Tech, lần này Chairman tự chốt.
- **Trạng thái lúc lập kế hoạch (trước quyết định):** chưa quyết. Kế hoạch lát 1 viết bảng và policy theo con trỏ phía A (role `libetech_projector`), hàm projector gọi được bằng login vận hành, test gọi projector tường minh; **không** nối vào đường chạy web, **không** cấp role nào cho `libetech_web`.

## OQ-23 — Bằng chứng nào cho nhãn «đã kiểm thực tế» của cầu nối bot

- **Lát:** 1 (chỉ điều kiện bật nhãn «đã kiểm thực tế»; hai nhãn còn lại và việc gom số bản vẫn làm).
- **Phía A:** `docs/IMPLEMENTATION-ROADMAP.md:44` và quyết định OQ-03 (b) đòi hiện ba trạng thái `đã cấu hình` / `đã kiểm thực tế` / `chưa nối luồng ghi`; `docs/reviews/CODEX-STEP0-P1-READINESS-20261112.md:71` — không gắn «đã kiểm thực tế» chỉ từ biến cấu hình.
- **Phía B:** nguồn duy nhất tiến trình web đang có là biến `LIBETECH_BRIDGE_CONFIG` (`src/app/api/health/route.ts:10`, giá trị `configured-not-runtime-verified`). Dấu vết lần gọi cầu nối đã ký nằm ở `identity.bridge_nonces` (`src/server/bridge.ts:25`), thuộc schema danh tính mà login web không đọc được và dòng có hạn 2 phút. Quyết định OQ-19 coi health tự khai là «thông tin báo cáo», không phải sự thật đã quan sát. Không tài liệu nào nói bằng chứng nào, mới tới mức nào, do ai ghi thì được gọi «đã kiểm thực tế».
- **Phương án:** (a) lát 1 chỉ dựng mô hình ba trạng thái; nhãn «đã kiểm thực tế» chưa bao giờ bật cho tới khi có nguồn quan sát độc lập (gộp vào SPEC-010 của OQ-19); (b) bật khi AI OS đã nhận một lần gọi cầu nối có chữ ký hợp lệ trong N giờ gần nhất — cần ghi mốc thời gian vào một bảng mới hoặc đọc qua dịch vụ danh tính, và cần chốt N; (c) bật theo một biên nhận kiểm do người vận hành ghi có thời điểm và người ghi.
- **Ai quyết:** BoM Tech (Quân); Chairman nếu chọn (c) vì là lời khẳng định vận hành.
- **Quyết định 12/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối):** «(a) Chưa bật (Recommended)». Lát 1 chỉ dựng mô hình ba trạng thái; nhãn «đã kiểm thực tế» không bao giờ bật cho tới khi có nguồn quan sát độc lập (gộp vào SPEC-010). Trường «Ai quyết» ghi BoM Tech, lần này Chairman tự chốt.
- **Trạng thái lúc lập kế hoạch (trước quyết định):** chưa quyết. Kế hoạch lát 1 để hàm cung cấp mốc kiểm trả «chưa có» (nhãn không bật) và có test khẳng định biến cấu hình không bao giờ sinh nhãn này.

## OQ-24 — Cùng mã thao tác dùng lại ở dự án khác cho thao tác tài liệu

- **Lát:** 1 (chỉ ca «cùng khoá, tài liệu ở dự án khác»; các ca cùng dự án vẫn làm).
- **Phía A:** `docs/SLICE-BRIEFS.md:67` ca (5) «cùng khoá cho đối tượng khác bị từ chối» và hàng R-01 `:64` «cùng khoá + tài liệu/revision khác → xung đột». Với phản hồi, khoá duy nhất theo `(tenant_id,actor_id,request_key)` (`migrations/007_team_onboarding_feedback.sql:55`) nên dùng lại ở dự án khác bị từ chối — đúng yêu cầu của Codex vòng 1 (`docs/reviews/REVIEW-R01-fix-feedback-20261112.md:9-11`).
- **Phía B:** brief buộc thao tác tài liệu đi qua `deduplicate` (`src/server/service.ts:57-70`), mà bảng `commands` khoá theo `(tenant_id,project_id,actor_id,command_key)` (`migrations/001_foundation.sql:57`). Cùng người, cùng khoá, tài liệu ở **dự án khác** là một dòng `commands` khác: thao tác thứ hai được áp dụng, không báo xung đột. `WorkService` chạy như vậy từ bản 001; `tests/foundation.test.ts:133-140` chỉ kiểm cùng một việc.
- **Phương án:** (a) giữ phạm vi khoá theo dự án như `commands` hiện có, ghi rõ trong đặc tả API và có test khẳng định; (b) từ chối dùng lại khoá khác dự án cho thao tác tài liệu — cần ràng buộc duy nhất mới không chứa `project_id` (bảng riêng cho lệnh tài liệu, hoặc sửa bảng `commands` cũ, đụng `WorkService`); (c) như (b) cho mọi thao tác, kể cả việc.
- **Ai quyết:** BoM Tech (Quân).
- **Quyết định 12/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối):** «(b) Từ chối, chỉ tài liệu (Recommended)». Thêm ràng buộc UNIQUE không chứa `project_id` cho lệnh tài liệu, đặt ở bảng riêng, không đụng `WorkService` hay bảng `commands` cũ. Theo cách sửa R-01: nếu RLS giấu dòng cũ thì xung đột phải trả mã 409, không phải lỗi chung. Viết test cho ca dùng lại khoá ở dự án khác. Trường «Ai quyết» ghi BoM Tech, lần này Chairman tự chốt.
- **Trạng thái lúc lập kế hoạch (trước quyết định):** chưa quyết. Kế hoạch lát 1 dùng `deduplicate` nguyên trạng, kiểm đủ các ca cùng dự án, và **không** viết test khẳng định hành vi chéo dự án theo hướng nào.

## OQ-25 — Danh sách host được phép cho liên kết nguồn tài liệu

- **Lát:** 1 (chỉ phần chặn host; phần còn lại của biện pháp chống liên kết giả đã làm), 2–4 (mọi nơi mở nguồn).
- **Phía A:** review bảo mật tầng 1 ngày 12/11/2026 (`liberico-security-reviewer`, mục M-1, mức Medium): liên kết nguồn chỉ cần `https:` và không chứa thông tin đăng nhập, nên một thành viên có quyền ghi có thể đăng ký liên kết «Drive» giả trỏ tới trang lừa đảo; đề nghị allowlist host theo `source_type`, kiểm lại khi mở.
- **Phía B:** ADR-002 1.1 «Nội dung quyết định» chỉ nói nội dung nằm ở nguồn hiện có (Drive/Docs, Git, Vault), không liệt kê host; `docs/SLICE-BRIEFS.md:29-31` không nêu danh sách host; repo có Vault dạng đường dẫn, chưa có host https chuẩn.
- **Đã làm ở lát 1 (không cần quyết):** giao diện hiện host trước khi mở và chỉ mở khi người dùng bấm liên kết; từ chối liên kết mang tham số dạng khoá/chữ ký (token, signature…); DB chỉ nhận `https://`; `openSource` kiểm lại mỗi lần.
- **Phương án:** (a) allowlist cố định trong mã: `drive` → `docs.google.com`, `drive.google.com`; `git` → `github.com`; `vault` → chưa nhận https (giữ con trỏ đường dẫn ở hồ sơ dự án); (b) allowlist cấu hình theo môi trường do vận hành cấp, mặc định rỗng = chặn hết; (c) không chặn host, chỉ cảnh báo trên giao diện khi host lạ.
- **Ai quyết:** Chairman (chính sách nguồn), BoM Tech (danh sách cụ thể).
- **Quyết định 13/11/2026 (Chairman, chọn ở phiên điều phối):** «(a) Allowlist cố định». Chặn host theo `source_type`, danh sách ghi cố định trong mã đúng như phương án (a): `drive` → `docs.google.com`, `drive.google.com`; `git` → `github.com`; `vault` chưa nhận https. Đổi danh sách phải qua PR và review. Chỗ kiểm và test do builder ghi khi làm phần chặn host. Câu trả lời không nói tới việc giới hạn `github.com` theo tổ chức; nếu làm, việc đó thuộc phần danh sách cụ thể của BoM Tech.
- **Trạng thái trước quyết định:** chưa quyết. Phải chốt trước khi đưa `/documents` và `/api/documents` ra proxy công khai (điểm dừng triển khai).
- **Trạng thái sau quyết định:** đã có mã chặn host (`src/server/source-hosts.ts`, test `tests/source-host-allowlist.test.ts`). Host được kiểm khi đăng ký và lại ở mỗi lần `openSource`; khớp đúng tên host, không nhận tên miền con, không nhận cổng riêng. Liên kết `url` trong revision chỉ hiện dạng chữ, không mở được, nên không bị giới hạn host. Đưa `/documents` và `/api/documents` ra proxy công khai vẫn là điểm dừng triển khai.

---

**Bổ sung 13/11/2026 khi lập kế hoạch lát 2** (`docs/plans/slice-2-intake-outbox.md`, base `ce11242`). Bốn mục dưới đây ghi lúc lập kế hoạch khi **chưa có quyết định**. Phần không bị ảnh hưởng của lát 2 vẫn được lập kế hoạch đầy đủ. Chairman đã quyết cả bốn mục ngày 14/11/2026; quyết định ghi ở từng mục.

## OQ-26 — Sổ ticket của plugin priority1 tới AI OS bằng đường nào để đối soát

- **Lát:** 2 (chỉ phần nạp sổ ticket thật cho ca đối soát của OQ-09 mục 2; hàm đối soát và test trên dữ liệu tổng hợp vẫn làm), 3–4 (nối ticket ↔ việc).
- **Phía A:** `docs/SPEC-008-PM-operating-loop-20261111.md:75` — «Adapter gửi event ticket mới sang hàng chờ AI OS bằng chữ ký, nonce và idempotency key»; `:116` payload của adapter có `ticket ID`. Không dòng nào nói adapter nằm trong plugin nào và ai viết.
- **Phía B:** `AGENTS.md:5` «The existing priority1 plugin remains independent» và quyết định OQ-09 «không sửa plugin priority1»; `AGENTS.md:13` + AR-01/E-INT-01 cấm AI OS đọc DB của nền khác (sổ ticket là SQLite của plugin đó). Đọc mã nguồn plugin priority1 ngày 13/11 (chỉ mã, không dữ liệu): plugin không có lời gọi nào sang AI OS và không có lệnh xuất sổ ticket. `docs/ADR-002-project-document-ownership.md` «Tích hợp» chỉ cho ba đường REST/queue/ETL có manifest và nói «không cutover trong ADR này».
- **Phương án:** (a) chủ plugin priority1 thêm adapter ký HMAC gửi sự kiện ticket sang một tuyến mới dưới `/api/bridge/…` — phải sửa plugin priority1, cần Chairman nới `AGENTS.md:5`; (b) người vận hành sổ ticket xuất tệp có manifest (mã ticket, chat, message, trạng thái, thời điểm, hash tệp), AI OS nhập bằng ETL chỉ đọc qua `scripts/` — cần chốt ai xuất, định dạng và nơi đặt tệp; (c) lát 2 chỉ dừng ở hàm đối soát trên dữ liệu tổng hợp, đối soát thật làm tay ở đợt runtime bằng hai bản kê do hai bên tự xuất; (d) `bot-plugin` của repo này hỏi sổ ticket qua công cụ sẵn có của priority1 trong gateway — là kiểu tích hợp thứ tư, cần ADR (AR-10).
- **Ai quyết:** Chairman (đụng `AGENTS.md:5` hoặc AR-10); BoM Tech cho định dạng nếu chọn (b).
- **Quyết định 14/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối):** «(c) Chỉ đối soát tổng hợp (Recommended)». Mô tả phương án Chairman thấy khi chọn: «Lát 2 làm hàm đối soát và test trên dữ liệu tổng hợp. Đối soát thật làm tay ở đợt runtime bằng hai bản kê hai bên tự xuất. Không sửa priority1, không thêm kiểu tích hợp.»
- **Áp vào lát 2:** Task 8 giữ nguyên. Không viết mã nạp sổ ticket thật. Đối soát thật là việc làm tay ở đợt runtime và là điểm dừng chờ Chairman.
- **Trạng thái lúc lập kế hoạch (trước quyết định):** chưa quyết. Kế hoạch lát 2 (Task 8) viết hàm thuần `reconcileLedger` và hàm đọc phía inbox, kiểm bằng fixture tổng hợp; **không** viết mã đọc SQLite, adapter, tuyến nhận hay script nhập sổ ticket.

## OQ-27 — Tin từ nhóm gắn nhiều dự án thuộc dự án nào trước khi PM xác nhận

- **Lát:** 2 (chỉ nhóm có từ hai dự án trong `chatScopes`; nhóm một dự án vẫn làm đủ), 3–4.
- **Phía A:** `docs/SPEC-008-PM-operating-loop-20261111.md:294` — «Một nhóm có thể nhận nhiều sản phẩm Xeca: bot hỏi đúng sản phẩm/dịch vụ khi chưa rõ, không mặc định tất cả vào dự án đã biết»; `:76` PM xác nhận project; cấu hình `chatScopes` cho phép một nhóm nhiều dự án (`src/app/api/bridge/route.ts:12`).
- **Phía B:** quy ước migration buộc mỗi bảng có `project_id` và RLS theo dự án (`docs/SLICE-BRIEFS.md:10`); `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:87` buộc ghi bền **trước** khi ACK, tức trước khi có ai chọn dự án; `AGENTS.md:16` cấm cộng gộp giữa các miền báo cáo — một nhóm có thể gắn dự án thuộc hai miền. Không tài liệu nào nói SourceEvent chưa rõ dự án thì ai được thấy.
- **Phương án:** (a) chỉ nhận tin từ nhóm gắn đúng một dự án; nhóm nhiều dự án bị từ chối cho tới khi tách cấu hình; (b) cấu hình vận hành khai một «dự án tiếp nhận mặc định» cho mỗi nhóm, PM chuyển ứng viên sang dự án khác của cùng nhóm sau; (c) lưu ở trạng thái chưa gán, chỉ người có quyền trên **mọi** dự án của nhóm mới thấy, PM gán rồi mới vào Inbox dự án — cần bảng không có `project_id` và policy riêng; (d) bot hỏi lại người báo chọn sản phẩm trước khi lưu — trái «ghi bền trước khi ACK».
- **Ai quyết:** Chairman (phạm vi thấy dữ liệu); BoM Tech cho cấu hình nếu chọn (b).
- **Quyết định 14/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối):** «(a) Chỉ nhóm một dự án (Recommended)». Mô tả phương án Chairman thấy khi chọn: «Nhóm gắn từ hai dự án bị từ chối (INTAKE_PROJECT_AMBIGUOUS), không lưu gì, cho tới khi tách cấu hình. Đây cũng là hành vi giữ chỗ phiên lát 2 đang làm.»
- **Áp vào lát 2:** lỗi `INTAKE_PROJECT_AMBIGUOUS` nay là hành vi theo quyết định, không còn là giữ chỗ. Tên test và chữ trong kế hoạch sửa theo.
- **Trạng thái sau quyết định:** mã giữ nguyên hành vi (`src/server/intake.ts:48`), chú thích và tên test ghi là quyết định (`8f181af`).
- **Trạng thái lúc lập kế hoạch (trước quyết định):** chưa quyết. Kế hoạch lát 2 (Task 4) từ chối nhóm nhiều dự án bằng lỗi `INTAKE_PROJECT_AMBIGUOUS` và không lưu gì — hành vi giữ chỗ fail-closed, không phải phương án được chọn.

## OQ-28 — Có lưu trích nội dung tin Telegram cho dự án chưa ánh xạ miền báo cáo không

- **Lát:** 2 (chỉ việc lưu chữ của tin cho dự án chưa có dòng ánh xạ miền; con trỏ, hash, metadata vẫn lưu), 3–4.
- **Phía A:** `AGENTS.md:16` và `docs/SPEC-008-PM-operating-loop-20261111.md:106` — IBS HI chỉ lưu con trỏ, hash, metadata việc Tech; `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:70` cho phép lưu «tin cần thiết hoặc trích được phép».
- **Phía B:** quyết định OQ-04 — dự án chưa có dòng ánh xạ hiện «Chưa xác nhận»; AI không ánh xạ dự án nào; lát 1 chưa có đường ghi ánh xạ (`migrations/013_project_registry.sql` không cấp INSERT). Vậy hiện mọi dự án thật đều «Chưa xác nhận», và không tài liệu nào nói tin của dự án chưa xác nhận miền thì được lưu chữ hay chỉ con trỏ.
- **Phương án:** (a) chưa ánh xạ thì coi như IBS HI: chỉ con trỏ + hash + metadata, PM mở tin gốc trong Telegram — an toàn nhưng Inbox không có chữ cho tới khi có ánh xạ; (b) chỉ `IBS_HI` mới bị giới hạn, chưa ánh xạ vẫn lưu trích; (c) cấu hình vận hành khai theo từng nhóm có được lưu trích hay không, độc lập với nhãn miền. Kèm: ai và ở lát nào làm đường ghi dòng ánh xạ.
- **Ai quyết:** Chairman (chính sách dữ liệu giữa các pháp nhân).
- **Quyết định 14/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối):** «(c) Khai theo từng nhóm». Mô tả phương án Chairman thấy khi chọn: «Cấu hình vận hành khai từng nhóm có được lưu trích hay không, độc lập với nhãn miền.» Phần «Kèm: ai và ở lát nào làm đường ghi dòng ánh xạ» chưa có câu trả lời.
- **Áp vào lát 2:** bỏ cách chọn `content_mode` theo dòng `project_domain_mappings` (`LIBERICO_BU`/`XECA` → lưu trích). Thay bằng một cờ trong cấu hình vận hành, khai theo từng nhóm, đặt cùng chỗ với `chatScopes` và danh sách nhóm tiếp nhận. Cờ không bao giờ lấy từ request.
- **Cách hiểu của phiên điều phối, chờ Chairman xác nhận** (không phải lời Chairman):
  1. Nhóm không khai cờ chỉ giữ con trỏ + hash (fail-closed).
  2. Dự án ánh xạ `IBS_HI` luôn chỉ giữ con trỏ + hash, kể cả khi nhóm có cờ (`AGENTS.md:16` vẫn hiệu lực).
- **Điểm dừng:** giá trị cờ cho nhóm thật là điểm dừng triển khai. Fixture chỉ dùng mã nhóm tổng hợp.
- **Hệ quả cần Chairman biết (phiên lát 2 ghi, 14/11/2026):** luật 2 chỉ có tác dụng khi dự án đã có dòng ánh xạ `IBS_HI`. Chưa có đường ghi `project_domain_mappings` (xem phương án «Kèm» ở trên, chưa có câu trả lời), nên ở dữ liệu thật mọi dự án đang «Chưa xác nhận» và chỉ cờ của nhóm quyết định. Khi khai cờ cho nhóm thật, không được khai cho nhóm nào của IBS HI. (Luật tạm «không khai cho nhóm đã có sự kiện `pointer_only`» ghi cùng ngày đã hết hiệu lực sau quyết định OQ-30 (b).)
- **Trạng thái sau quyết định:** đã có mã ở `8f181af`: cờ `intake.excerptChats` (⊆ `intake.chats`, thiếu = không nhóm nào) ở `src/server/bridge-config.ts`; chọn chế độ ở `src/server/intake.ts:63-67`; bốn test OQ-28 ở `tests/intake.test.ts`, test cấu hình ở `tests/bridge-limits.test.ts` và `tests/bridge-io.test.ts`. Fixture không khai cờ.
- **Trạng thái lúc lập kế hoạch (trước quyết định):** chưa quyết. Kế hoạch lát 2 (Task 4) lưu trích cho dự án ánh xạ `LIBERICO_BU`/`XECA`, chỉ con trỏ + hash cho `IBS_HI` và cho dự án chưa ánh xạ (giữ chỗ fail-closed); test chỉ dùng dòng ánh xạ của dự án tổng hợp.

## OQ-29 — Quy tắc đủ phiếu, hạn và ghế cho phiếu đổi quyền của thành viên đã có

- **Lát:** 2 (ca (b) của SPEC-007; mã vẫn làm).
- **Phía A:** `docs/SPEC-007-telegram-account-approval.md:33` — mở rộng quyền sau kích hoạt «is blocked until the separate access-change ballot is implemented»; `:40` — «A follow-up ballot for changes to an existing member is required». Quyết định OQ-12 (c) giao làm phiếu đổi quyền ở P1.1.
- **Phía B:** SPEC-007 chỉ định nghĩa quy tắc cho phiếu cấp tài khoản lần đầu (`:3`, `:32`: Chairman + một BoM, ghế đóng băng, hạn 48 giờ theo `migrations/009_telegram_account_approval.sql`). Không dòng nào nói phiếu đổi quyền dùng cùng quy tắc, có cần chủ dự án được thêm vào đồng ý, hay người được đổi quyền (nếu đang giữ ghế BoM) có được bỏ phiếu cho chính mình.
- **Phương án:** (a) dùng lại nguyên quy tắc phiếu lần đầu (Chairman + ít nhất một BoM, 48 giờ), người được đổi quyền không bỏ phiếu cho mình; (b) như (a) và thêm xác nhận của PM/chủ dự án được thêm vào; (c) chỉ Chairman duyệt với thay đổi nhỏ (thêm quyền báo cáo), phiếu đủ cho thêm dự án hoặc nâng vai.
- **Ai quyết:** Chairman.
- **Quyết định 14/11/2026 (Chairman, ở hộp chọn của phiên điều phối):** Chairman không chọn phương án nào trong hộp mà tự gõ câu trả lời: «1 thành viên BOM». Ba phương án Chairman thấy và không chọn: (a) Chairman + ít nhất một BoM, hạn 48 giờ, người được đổi quyền không tự bỏ phiếu; (b) như (a), thêm xác nhận của PM/chủ dự án; (c) phân theo mức thay đổi.
- **Áp vào lát 2:** phiếu `access_change` đủ khi có ít nhất một thành viên BoM trong danh sách ghế đã đóng băng đồng ý. Không cần phiếu của Chairman. Chairman vẫn là người đề xuất trên `/team`. Luật đếm nằm trong hàm đếm riêng của `access_change`; hàm đếm của phiếu cấp tài khoản lần đầu không đổi (vẫn Chairman + một BoM).
- **Cách hiểu của phiên điều phối, fail-closed, chờ Chairman xác nhận** (không phải lời Chairman):
  1. Người được đổi quyền không bỏ phiếu cho chính mình.
  2. Hạn 48 giờ giữ như phiếu lần đầu.
  3. Một BoM từ chối mà còn BoM khác chưa bỏ phiếu thì phiếu vẫn chờ. Mọi BoM đã đóng băng đều từ chối thì phiếu đóng.
- **Cách hiểu của phiên lát 2, fail-closed, chờ Chairman xác nhận** (không phải lời Chairman; phán quyết S13 ở `docs/plans/slice-2-intake-outbox.md`): Chairman vẫn nằm trong danh sách ghế đóng băng như trước. Phiếu đồng ý của Chairman không được tính cho phiếu `access_change`. Phiếu từ chối của Chairman đóng phiếu (`rejected`), vì Chairman là người đề xuất. Không cách hiểu nào trong ba cách trên nói tới phiếu của Chairman.
- **Trạng thái sau quyết định:** đã có mã ở `8f181af`: hàm đếm riêng `accessChangeTally` (`src/server/account-approval.ts`), `tally` của phiếu lần đầu không đổi; câu trên `/team` và `/approvals` cho phiếu đổi quyền không còn nhắc Chairman; test ở `tests/access-change.test.ts`. Cần Chairman xác nhận các cách hiểu trên trước khi dùng cho người thật.
- **Trạng thái lúc lập kế hoạch (trước quyết định):** chưa quyết. Kế hoạch lát 2 (Task 9) dùng lại hàm đếm phiếu hiện có, không đặt quy tắc mới, và loại ghế của chính người được đổi quyền khỏi danh sách bỏ phiếu. Cần xác nhận trước khi dùng cho người thật; đổi quy tắc sau chỉ chạm hàm đếm phiếu.

**Bổ sung 14/11/2026 sau vòng 3 của Codex cho lát 2** (`docs/reviews/slice-2-evidence-20261113/codex-round-3.md`, head `2eb9437`). Mục dưới đây ghi khi **chưa có quyết định**, chờ Chairman. Chairman đã quyết ngày 14/11/2026; quyết định ghi trong mục.

## OQ-30 — Chế độ nội dung của một SourceEvent khi ánh xạ miền của dự án đổi sau lần ghi đầu

- **Lát:** 2 (chỉ việc lưu chữ cho bản sửa của tin đã ghi trước khi ánh xạ đổi, và việc hiện chữ đã lưu sau khi ánh xạ đổi; tin mới sau khi ánh xạ đổi không bị ảnh hưởng), 3–4 (kỹ năng và báo cáo đọc `source_event_revisions`).
- **Phía A:** `docs/plans/slice-2-intake-outbox.md:242` — mỗi lần `ingest` «đọc dòng mới nhất của `project_domain_mappings`» để chọn `content_mode`, tức quyết định theo từng lần ghi; OQ-28 phương án (a) nói Inbox không có chữ «cho tới khi có ánh xạ», hiểu là có ánh xạ rồi thì được lưu trích. Mã theo đúng dòng này: `src/server/intake.ts:62-63` tính chế độ theo ánh xạ hiện tại, `:80` dùng nó cho bản sửa.
- **Phía B:** `docs/plans/slice-2-intake-outbox.md:146` và `migrations/016_intake_inbox.sql:56` — `content_mode` là cột của `source_events` **bất biến**, ghi một lần ở lần thấy đầu; phán quyết S10 (`docs/plans/slice-2-intake-outbox.md:651`) — chữ không được ghi vào bảng nào khi `content_mode='pointer_only'`; `AGENTS.md:16` — IBS HI chỉ con trỏ, hash, metadata. Màn Inbox quyết định hiện chữ theo cột của sự kiện (`src/server/inbox.ts:80`, `:133`), không theo ánh xạ hiện tại. Hệ quả ở head: tin ghi lúc dự án chưa ánh xạ hoặc `IBS_HI`, sau đó dự án được ánh xạ `XECA`/`LIBERICO_BU`, bản sửa của tin đó được lưu chữ trong khi sự kiện vẫn ghi `pointer_only` (Codex vòng 3, P1). Chiều ngược lại cũng không có luật: tin đã lưu trích lúc dự án là `XECA`, sau đó ánh xạ sửa thành `IBS_HI` — chữ đã lưu vẫn nằm trong bảng bất biến và Inbox vẫn hiện vì sự kiện ghi `excerpt`. Không tài liệu nào nói quyết định đầu tiên ràng buộc mọi bản sửa hay được xét lại.
- **Phương án:** (a) chế độ cố định theo SourceEvent ở lần thấy đầu: sự kiện `pointer_only` không bao giờ nhận chữ ở bản sửa sau, kể cả khi dự án đã được ánh xạ; chữ chỉ có cho tin mới — đơn giản, khớp cột bất biến, đổi lại PM không thấy chữ của tin cũ được sửa; (b) xét lại theo từng bản sửa với ánh xạ hiện tại, chế độ chuyển về cột của `source_event_revisions`, Inbox hiện theo từng bản — cần sửa schema 016 (chưa phát hành) và mọi chỗ đọc; (c) lấy mức chặt hơn của hai phía: chỉ lưu chữ khi sự kiện ghi `excerpt` **và** ánh xạ hiện tại cho phép; không bao giờ nới sau lần đầu, có thể siết. Kèm cho cả ba: khi ánh xạ đổi sang `IBS_HI`, chữ đã lưu trước đó (1) giữ và vẫn hiện, (2) giữ nhưng Inbox ẩn theo ánh xạ hiện tại, hay (3) phải có thủ tục xoá/che có người duyệt — bảng đang bất biến nên (3) cần thiết kế riêng.
- **Ai quyết:** Chairman (chính sách dữ liệu giữa các pháp nhân, cùng người quyết OQ-28).
- **Bổ sung 14/11/2026 sau quyết định OQ-28 (c):** đầu vào của việc chọn chế độ đổi từ nhãn miền sang cờ theo nhóm (cộng luật `IBS_HI` luôn chỉ con trỏ). Câu hỏi vẫn y nguyên, chỉ thêm một đường: cờ của nhóm bật hoặc tắt sau lần ghi đầu cũng làm chế độ của bản sửa khác chế độ của sự kiện. Mã ở `src/server/intake.ts:80` vẫn dùng chế độ tính ở từng lần ghi; finding P1 thứ ba của Codex vòng 3 chưa sửa, chờ Chairman quyết vòng sửa. Review task ngày 14/11 ghi thêm: trước thay đổi này, đổi chế độ sau lần ghi đầu cần một lần chèn ánh xạ bằng quyền chủ bảng (role chạy chỉ có `SELECT` trên `project_domain_mappings`); nay chỉ cần người vận hành thêm nhóm vào `excerptChats`. Vì vậy, cho tới khi OQ-30 được quyết: **không khai cờ cho nhóm đã có sự kiện `pointer_only`** (gộp vào điểm dừng khai cờ cho nhóm thật của OQ-28).
- **Quyết định 14/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối):** «(b) Xét lại từng bản sửa». Mô tả phương án Chairman thấy khi chọn: «Chế độ ghi theo từng bản sửa với cấu hình hiện tại, có thể nới. Phải sửa schema 016 (chưa phát hành) và mọi chỗ đọc.»
- **Quyết định kèm, cùng ngày — chữ đã lưu khi cấu hình siết lại:** «Ẩn ngay, thiết kế xoá sau (Recommended)». Mô tả phương án Chairman thấy khi chọn: «Giữ trong bảng bất biến nhưng Inbox ẩn theo cấu hình hiện tại. Thủ tục xoá hoặc che có người duyệt thiết kế ở lát sau.»
- **Áp vào lát 2 (phiên điều phối chuyển lời):** `content_mode` chuyển xuống từng dòng `source_event_revisions`, xét theo cấu hình hiện tại lúc ghi bản sửa đó. Cấu hình hiện tại gồm cờ lưu trích theo nhóm của OQ-28 (c) và luật `IBS_HI` luôn chỉ con trỏ (`AGENTS.md:16`). Sửa schema 016 và mọi chỗ đọc; 016 chưa phát hành nên sửa trực tiếp, tệp lùi theo kịp. Không chỗ nào được dùng cột ở `source_events` để quyết hiện chữ. Inbox hiện chữ của một bản sửa chỉ khi bản đó ghi có chữ **và** cấu hình hiện tại vẫn cho phép; siết lại thì ẩn, không xoá, bảng giữ bất biến. Thủ tục xoá/che có người duyệt là việc của lát sau.
- **Hệ quả với ghi chú trước đó:** luật vận hành tạm «không khai cờ cho nhóm đã có sự kiện `pointer_only`» (ghi ngày 14/11 khi OQ-30 còn mở) hết hiệu lực: theo (b), bản sửa sau khi bật cờ được lưu chữ là hành vi đã quyết. Luật «không khai cờ cho nhóm của IBS HI» ở OQ-28 vẫn giữ.
- **Trạng thái trước quyết định (14/11/2026):** chưa quyết, **chờ Chairman**. Mã ở head `2eb9437` đang chạy theo Phía A cho việc ghi và Phía B cho việc hiện. Bản phân tích vòng 3 đề xuất, nếu Chairman cho sửa vòng 3, đặt hành vi giữ chỗ fail-closed là phương án (c) — không phải phương án được chọn — và chưa đụng tới chữ đã lưu. Không mã nào được sửa trước quyết định của Chairman về vòng sửa.

---

**Bổ sung 15/11/2026 khi lập kế hoạch lát 3** (`docs/plans/slice-3-review-skills.md`, base `ec3b5e7`). Hai mục dưới đây ghi lúc lập kế hoạch khi **chưa có quyết định**, chờ Chairman. Chairman đã quyết cả hai ngày 15/11/2026; quyết định ghi trong từng mục. Phần không bị ảnh hưởng của lát 3 vẫn được lập kế hoạch đầy đủ; bảng ở đầu tệp chỉ liệt kê OQ-01…OQ-21 nên không thêm dòng.

## OQ-31 — Ai được chỉ định người review và người duyệt tài liệu theo dự án

- **Lát:** 3 (chỉ đường ghi dòng uỷ quyền; bảng, việc đọc, việc kiểm quyền lúc duyệt và test bằng dòng tổng hợp vẫn làm), 4 (người được quyền công bố).
- **Phía A:** `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:35` — «người review/duyệt tài liệu cụ thể phải có delegation theo dự án»; `:123` — «PM chọn tác giả/reviewer theo dự án»; `:42` — duyệt bản chuẩn do «Chủ nội dung/BU/tech reviewer theo loại»; `:139` — ReviewDecision có `actor/delegation`; `:197` — người duyệt theo từng dự án chưa xác minh, «có chủ trách nhiệm triển khai là PM/quản trị dự án»; `docs/SLICE-BRIEFS.md:181` — migration có «uỷ quyền người duyệt theo dự án».
- **Phía B:** `docs/SLICE-BRIEFS.md:13` cấm «tự cấp quyền»; `docs/SPEC-007-telegram-account-approval.md:33` và `:40` cùng quyết định OQ-29 — mở rộng quyền của thành viên đã có phải qua phiếu đổi quyền (một BoM); `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:35` — «Tác giả không tự nghiệm thu đầu ra mình làm»; `:47` — «không tự dồn mọi việc về Chairman». Không tài liệu nào nói: ai được ghi dòng uỷ quyền; người chỉ định có được chỉ định chính mình; quyền duyệt tài liệu có phải là «mở rộng quyền» theo SPEC-007 hay không; ai chỉ định người **duyệt bản chuẩn** (khác người chỉ nhận xét). Tiền lệ trong repo: dòng ánh xạ miền do người có quyền tạo, role chạy không có INSERT (`migrations/013_project_registry.sql:101-106`).
- **Phương án:** (a) điều phối dự án (vai `manager`) chỉ định người nhận xét và người duyệt trong số thành viên dự án, kèm căn cứ; không qua phiếu; (b) như (a) cho người nhận xét (nhận xét, yêu cầu sửa), còn quyền **duyệt bản chuẩn** đi qua phiếu đổi quyền một BoM như OQ-29; (c) lát 3 không có đường ghi trên web: dòng uỷ quyền do login vận hành ghi theo quyết định của người có thẩm quyền, kèm căn cứ (như dòng ánh xạ miền); giao diện hiện «Chờ xác định người duyệt» tới khi có dòng; đường ghi chốt trước pilot; (d) chỉ Chairman chỉ định. Kèm cho cả bốn: người chỉ định có được chỉ định chính mình không; uỷ quyền có giới hạn theo loại tài liệu không.
- **Ai quyết:** Chairman (quyền duyệt bản chuẩn); BoM Tech cho phần người nhận xét nếu chọn (a) hoặc (b).
- **Khuyến nghị của planner (không phải quyết định):** (c) cho lát 3. Lát này chỉ chạy trên dữ liệu tổng hợp và chưa duyệt bản chuẩn thật (OQ-07), nên chưa cần đường ghi; không mở đường nào có thể thành tự cấp quyền trước khi Chairman chốt. Nếu phải có đường ghi ngay thì (b), vì quyền duyệt bản chuẩn là mở rộng quyền theo nghĩa của SPEC-007.
- **Quyết định 15/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối; phiên điều phối chuyển lời):** «(b) Manager + phiếu BoM». Chairman không chọn phương án được đánh dấu Recommended.
  - Câu hỏi Chairman thấy: «OQ-31 (lát 3): ai được ghi dòng uỷ quyền «người review / người duyệt tài liệu» theo dự án? SPEC-009 đòi uỷ quyền theo dự án nhưng không nói ai được cấp, còn brief cấm tự cấp quyền.»
  - Bốn phương án Chairman thấy (nhãn — mô tả):
    - «(c) Chưa mở đường ghi (Recommended)» — «Lát 3 không có đường ghi trên web. Dòng uỷ quyền do login vận hành ghi theo quyết định của người có thẩm quyền, kèm căn cứ; màn hình hiện «Chờ xác định người duyệt» tới khi có dòng. Đường ghi chốt trước pilot. Lát 3 chỉ test bằng dòng tổng hợp.»
    - «(b) Manager + phiếu BoM» — «Điều phối dự án (vai manager) chỉ định người nhận xét. Quyền duyệt bản chuẩn đi qua phiếu đổi quyền một BoM như OQ-29. Phát sinh thêm migration 021 và task trong lát 3.»
    - «(a) Manager chỉ định cả hai» — «Điều phối dự án chỉ định cả người nhận xét và người duyệt bản chuẩn trong số thành viên dự án, kèm căn cứ, không qua phiếu. Phát sinh thêm migration 021.»
    - «(d) Chỉ Chairman chỉ định» — «Mọi dòng uỷ quyền do Chairman chỉ định. SPEC-009 dòng 47 ghi «không tự dồn mọi việc về Chairman». Phát sinh thêm migration 021.»
- **Quyết định 15/11/2026 cho phần kèm (Chairman, cùng hộp chọn):** «Giữ cả hai (Recommended)».
  - Câu hỏi Chairman thấy: «OQ-31, phần kèm: dòng uỷ quyền người review/duyệt tài liệu chịu ràng buộc nào? Kế hoạch lát 3 đang giữ chỗ cả hai ràng buộc theo hướng chặt (fail-closed), chưa có lời anh.»
  - Bốn phương án Chairman thấy (nhãn — mô tả):
    - «Giữ cả hai (Recommended)» — «Người chỉ định không được chỉ định chính mình, và mỗi uỷ quyền phải nêu rõ loại tài liệu được review hoặc duyệt.»
    - «Chỉ cấm tự chỉ định» — «Người chỉ định không được chỉ định chính mình; uỷ quyền áp cho mọi loại tài liệu của dự án.»
    - «Chỉ giới hạn theo loại» — «Uỷ quyền phải nêu loại tài liệu; người chỉ định được chỉ định chính mình.»
    - «Không ràng buộc» — «Được tự chỉ định, và uỷ quyền áp cho mọi loại tài liệu của dự án.»
- **Ghi chú của phiên điều phối kèm quyết định (không phải lời Chairman):**
  1. Các mô tả phương án ở trên do phiên điều phối viết lại từ `docs/OPEN-QUESTIONS.md` tại `753970e` và báo cáo của phiên lát 3. Câu «Phát sinh thêm migration 021 và task trong lát 3» là lời nêu hệ quả, không phải yêu cầu về hình dạng: số migration và cách chia task do planner quyết và ghi là phán quyết của phiên lát 3.
  2. OQ-31 (b) mở Task 7. `planner` bổ sung kế hoạch trước khi viết mã cho task này: vai `manager` của dự án chỉ định người nhận xét trên web; quyền duyệt bản chuẩn đi qua phiếu đổi quyền một BoM như OQ-29; hai ràng buộc ở phần kèm nay là quyết định, không còn là giữ chỗ. Dùng lại cơ chế phiếu đổi quyền đã có của lát 2 (`accessChangeTally` trong `src/server/account-approval.ts`, migration 018) và các luật của nó như đang có; không đặt luật bỏ phiếu mới. Các cách hiểu của OQ-29 và phán quyết S13 của lát 2 vẫn ở trạng thái «chờ Chairman xác nhận», không nới. Chỗ nào lời Chairman không phủ (ví dụ ai đề xuất phiếu cấp quyền duyệt bản chuẩn, phiếu đó gắn với loại tài liệu ra sao, thu hồi uỷ quyền) thì không tự chọn: ghi OQ mới và chỉ dừng đúng task đó.
  3. Task 7 đụng quyền nên phải qua `liberico-security-reviewer` ở tầng 1, có ca quyền âm cho: tự chỉ định mình, `manager` của dự án A chỉ định ở dự án B, người nhận xét dùng quyền nhận xét để duyệt bản chuẩn, và dòng uỷ quyền thiếu loại tài liệu.
- **Áp vào lát 3:** Task 7 không còn dừng tại OQ-31; hai ràng buộc ở Task 4 («người được chỉ định khác người chỉ định», uỷ quyền phải nêu rõ loại tài liệu) là quyết định của Chairman. Hình dạng kỹ thuật (bảng, số migration, cách nối phiếu) là phán quyết của phiên lát 3 ghi trong `docs/plans/slice-3-review-skills.md`.
- **Trạng thái lúc lập kế hoạch (trước quyết định):** chưa quyết. Kế hoạch lát 3 (Task 4) tạo bảng `review_delegations`, role chạy chỉ có SELECT; có ràng buộc giữ chỗ fail-closed «người được chỉ định khác người chỉ định» và uỷ quyền phải nêu rõ loại tài liệu — đây là hành vi giữ chỗ, không phải phương án được chọn. Test tạo dòng uỷ quyền tổng hợp bằng login vận hành. Task 7 (đường ghi) **dừng tại OQ-31**.

## OQ-32 — «Yes» trên Telegram cho thẻ quyết định đi đường nào khi bot principal chỉ đọc

- **Lát:** 3 (chỉ phần Telegram của thẻ quyết định; thẻ trên web và luật «đúng thẻ còn hiệu lực» ở tầng dịch vụ vẫn làm), 4 (thẻ công bố).
- **Phía A:** `docs/SLICE-BRIEFS.md:168` — «trên Telegram «yes» chỉ có hiệu lực khi trả lời đúng thẻ còn hiệu lực»; `docs/SPEC-008-PM-operating-loop-20261111.md:218` — web và Telegram dùng thẻ, «Tin “yes” chỉ có hiệu lực khi reply đúng thẻ còn hiệu lực, quyền còn đúng»; `docs/DESIGN-SYSTEM-PM-DOCUMENTS.md:74` — thẻ Telegram, «Callback chỉ chứa ID mờ; server xác minh actor/chat/policy/revision»; `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:143` — «Bot relay dùng HMAC/timestamp/nonce và principal server-side».
- **Phía B:** `AGENTS.md:13` «Bot principal is read-only» và quyết định OQ-08 (b); `docs/ADR-002-project-document-ownership.md:36` — «Không principal nào tạo/gán/đóng việc, duyệt, nghiệm thu hay cấp quyền»; `docs/SPEC-002-identity-postgres.md:11` — «The bridge cannot create, accept or close work»; `docs/SPEC-004-bom-tech-phan-cong.md:34` — «Trong pilot, người dùng xác nhận quyết định trên web đã xác thực.» và «Quyền xác nhận của con người lấy từ phiên web.»; `docs/SLICE-BRIEFS.md:171` — lát 3 không công bố ra nhóm, không bot nhắc phiếu. Mã hiện có: phiếu duyệt tài khoản đã đi qua cầu nối ký bằng khoá bot và ghi phiếu dưới danh tính người đã ghép (`src/server/bridge.ts:13`, `:26-27`), nhưng đó là lệnh `/duyet` trong chat riêng, không phải trả lời một thẻ; tập mẫu tin của outbox là tập đóng, chưa có mẫu thẻ quyết định (`migrations/017_outbox.sql:48`); nối `send` thật, cài plugin và khởi động lại gateway đều là điểm dừng (`docs/DELIVERY-011-intake-outbox-20261113.md:258`). Không tài liệu nào nói: lát 3 có gửi thẻ quyết định ra Telegram không; câu trả lời đi bằng khoá bot, khoá riêng hay chỉ qua web; loại quyết định nào được nhận «yes» qua chat.
- **Phương án:** (a) thêm lệnh vào `/api/bridge` ký bằng khoá bot (như `account_approval_vote`): server tra thẻ từ mã mờ, lấy người từ Telegram ID đã ghép, ghi quyết định dưới danh tính người đó — mở rộng những gì một yêu cầu ký bằng khoá bot gây ra được, cần Chairman xác nhận là không trái `AGENTS.md:13`; kèm gửi thẻ qua outbox (thêm mẫu vào tập đóng của 017 bằng migration mới) và sửa `bot-plugin`; (b) tuyến ký riêng dưới `/api/bridge/decisions/…` với khoá riêng, bot giữ chỉ đọc (cùng kiểu với principal tiếp nhận của OQ-08 b); cũng phải gửi thẻ và sửa `bot-plugin`; (c) lát 3 chỉ làm thẻ trên web và luật ở tầng dịch vụ — mỗi lệnh quyết định nêu đúng một thẻ (mã thẻ, revision/hash, phiên bản), thẻ hết hiệu lực trả xung đột, không có lệnh nào nhận một chữ «yes» trống; không gửi thẻ ra Telegram, không sửa plugin; nối Telegram ở đợt runtime cùng `send` thật; (d) Telegram chỉ đưa liên kết mở thẻ trên web (theo SPEC-004 P0-08), không nhận «yes» qua chat cho thẻ review và thẻ 3/3.
- **Ai quyết:** Chairman (ranh giới bot chỉ đọc, gửi tin thật).
- **Khuyến nghị của planner (không phải quyết định):** (c). Lát 2 chưa triển khai, `send` thật chưa nối, plugin vừa qua năm vòng Codex; luật đã được ép ở tầng dịch vụ nên nối (a), (b) hoặc (d) sau chỉ thêm một tuyến mỏng. Với thẻ 3/3, SPEC-004 đã nói xác nhận lấy từ phiên web.
- **Quyết định 15/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối; phiên điều phối chuyển lời):** «(c) Chỉ thẻ trên web (Recommended)».
  - Câu hỏi Chairman thấy: «OQ-32 (lát 3): chữ «yes» trên Telegram cho thẻ quyết định (review, 3/3) đi đường nào, khi AGENTS.md ghi bot principal chỉ đọc và đường gửi tin thật chưa nối?»
  - Bốn phương án Chairman thấy (nhãn — mô tả):
    - «(c) Chỉ thẻ trên web (Recommended)» — «Lát 3 làm thẻ trên web và ép luật «đúng thẻ còn hiệu lực» ở tầng dịch vụ: mỗi lệnh nêu đúng một thẻ, thẻ hết hiệu lực trả xung đột, không lệnh nào nhận một chữ «yes» trống. Không gửi thẻ ra Telegram, không sửa plugin. Nối Telegram ở đợt runtime cùng việc gửi tin thật.»
    - «(d) Telegram chỉ đưa liên kết» — «Telegram chỉ gửi liên kết mở thẻ trên web (theo SPEC-004 P0-08); không nhận «yes» qua chat cho thẻ review và thẻ 3/3. Phát sinh migration 021.»
    - «(b) Tuyến riêng, khoá riêng» — «Tuyến ký riêng dưới /api/bridge/decisions với khoá riêng; bot giữ chỉ đọc, cùng kiểu principal tiếp nhận của OQ-08. Phải gửi thẻ qua outbox, sửa bot-plugin, thêm migration 021, kế hoạch bổ sung và review bảo mật riêng.»
    - «(a) Lệnh mới, khoá bot» — «Thêm lệnh vào /api/bridge ký bằng khoá bot, như lệnh bỏ phiếu duyệt tài khoản; server ghi quyết định dưới danh tính người đã ghép. Mở rộng việc một yêu cầu ký khoá bot làm được, cần anh xác nhận không trái AGENTS.md dòng 13. Phải sửa bot-plugin, thêm migration 021 và review bảo mật riêng.»
- **Ghi chú của phiên điều phối kèm quyết định (không phải lời Chairman):** các mô tả phương án ở trên do phiên điều phối viết lại từ `docs/OPEN-QUESTIONS.md` tại `753970e` và báo cáo của phiên lát 3. OQ-32 (c): Task 14 không làm trong lát 3; Task 13 giữ như kế hoạch. Biên nhận `DELIVERY-012` ghi rõ phần Telegram của mục 7 trong brief chưa làm và dời sang đợt runtime.
- **Áp vào lát 3:** Task 14 không làm. Không thêm lệnh cầu nối, mẫu outbox hay sửa `bot-plugin`. Luật «đúng thẻ còn hiệu lực» ép ở tầng dịch vụ trong Task 13.
- **Trạng thái lúc lập kế hoạch (trước quyết định):** chưa quyết. Kế hoạch lát 3 (Task 13) làm thẻ trên web và luật ở tầng dịch vụ; **không** thêm lệnh cầu nối, mẫu outbox hay sửa `bot-plugin`. Task 14 (phần Telegram) **dừng tại OQ-32**.

---

**Bổ sung 15/11/2026 khi áp quyết định OQ-31 và OQ-32 vào kế hoạch lát 3** (`docs/plans/slice-3-review-skills.md` bản 0.3, base `ec3b5e7`). Hai mục dưới đây là chỗ lời Chairman ở OQ-31 không phủ; ghi khi **chưa có quyết định**. Chairman đã quyết cả hai ngày 15/11/2026; quyết định ghi trong từng mục. Mỗi mục chỉ chặn đúng một bước; phần còn lại của Task 7a và 7b vẫn làm.

## OQ-33 — Ai đề xuất phiếu cấp quyền duyệt bản chuẩn

- **Lát:** 3 (chỉ bước «mở đường đề xuất cho điều phối dự án» của Task 7b; mọi phần khác của Task 4a và 7b dùng đường có sẵn và vẫn làm), pilot.
- **Phía A:** quyết định OQ-31 (b) — «Quyền duyệt bản chuẩn đi qua phiếu đổi quyền một BoM như OQ-29.»; ghi chú của phiên điều phối kèm quyết định (`docs/OPEN-QUESTIONS.md:380`) — dùng lại cơ chế phiếu đổi quyền đã có và các luật của nó như đang có, không đặt luật bỏ phiếu mới. Trong cơ chế đó chỉ quản trị tài khoản đề xuất và áp: `src/server/accounts.ts:47-53` (mọi lệnh tài khoản đòi người gọi là quản trị tài khoản), `:253-277` (đề xuất phiếu đổi quyền), `:196-214` (áp bộ quyền đã được duyệt); OQ-29 «Áp vào lát 2» — «Chairman vẫn là người đề xuất trên `/team`».
- **Phía B:** `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:47` — «không tự dồn mọi việc về Chairman»; `:197` — người duyệt theo từng dự án «có chủ trách nhiệm triển khai là PM/quản trị dự án»; quyết định OQ-31 (b) cho điều phối dự án chỉ định người nhận xét. Không tài liệu nào nói: điều phối dự án có được đề xuất phiếu cấp quyền duyệt bản chuẩn cho thành viên dự án mình không; ai áp quyền sau khi phiếu đủ; quyền có tự hiệu lực khi phiếu đủ hay vẫn cần một bước áp.
- **Phương án:** (a) giữ đúng cơ chế hiện có: chỉ quản trị tài khoản đề xuất và áp trên `/team`; không thêm mã; (b) thêm một đường cho điều phối dự án đề xuất phiếu cho thành viên dự án mình (cùng người bỏ phiếu, cùng hàm đếm, cùng hạn), quản trị tài khoản vẫn là người áp; cần kế hoạch bổ sung và review bảo mật riêng vì là người đề xuất mới trong dịch vụ danh tính; (c) như (b) và quyền tự có hiệu lực khi phiếu đủ, không cần bước áp — đổi luật của cơ chế phiếu, trái ghi chú «không đặt luật bỏ phiếu mới» nếu Chairman không nói rõ.
- **Ai quyết:** Chairman.
- **Khuyến nghị của planner (không phải quyết định):** (a) cho lát 3 — không thêm thẩm quyền mới khi mọi thứ còn chạy trên dữ liệu tổng hợp và chưa duyệt bản chuẩn thật (OQ-07); xét (b) trước pilot, vì theo (a) mỗi lần cấp quyền duyệt bản chuẩn đều cần Chairman đề xuất rồi áp.
- **Quyết định 15/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối; phiên điều phối chuyển lời):** «(b) Thêm đường cho manager». Chairman không chọn phương án được đánh dấu Recommended.
  - Câu hỏi Chairman thấy: «OQ-33 (lát 3): ai được đề xuất phiếu cấp quyền duyệt bản chuẩn tài liệu? Theo OQ-31 (b), quyền này đi qua phiếu đổi quyền một BoM; trong cơ chế phiếu hiện có, chỉ quản trị tài khoản đề xuất và áp trên /team (ghi chú OQ-29: «Chairman vẫn là người đề xuất trên /team»).»
  - Ba phương án Chairman thấy (nhãn — mô tả):
    - «(a) Giữ cơ chế hiện có (Recommended)» — «Chỉ quản trị tài khoản đề xuất và áp trên /team; không thêm mã. Mỗi lần cấp quyền duyệt bản chuẩn đều cần Chairman đề xuất rồi áp, sau khi một BoM đồng ý. Xét lại (b) trước pilot.»
    - «(b) Thêm đường cho manager» — «Điều phối dự án đề xuất phiếu cho thành viên dự án mình, cùng người bỏ phiếu, cùng hàm đếm, cùng hạn; quản trị tài khoản vẫn là người áp. Cần kế hoạch bổ sung và review bảo mật riêng vì thêm người đề xuất mới trong dịch vụ danh tính.»
    - «(c) Như (b), bỏ bước áp» — «Như (b), và quyền tự có hiệu lực khi phiếu đủ, không cần bước áp. Đổi luật của cơ chế phiếu đổi quyền đã có từ lát 2.»
- **Ghi chú của phiên điều phối kèm quyết định (không phải lời Chairman):**
  1. OQ-33 (b) mở bước «đường đề xuất cho điều phối dự án» của Task 7b. Theo đúng mô tả Chairman chọn, bước này cần **kế hoạch bổ sung** và **review bảo mật riêng** trước khi viết mã. Giữ nguyên người bỏ phiếu, hàm đếm, hạn và bước áp của quản trị tài khoản; phương án (c) không được chọn nên quyền không tự có hiệu lực khi phiếu đủ.
  2. Phạm vi của đường mới, theo câu hỏi Chairman trả lời, là phiếu cấp **quyền duyệt bản chuẩn** cho **thành viên dự án mình**. Nó không phải đường để điều phối dự án đề xuất thêm dự án, nâng vai hay mở quyền báo cáo; nếu planner thấy cần rộng hơn thì đó là câu hỏi mới.
  3. Cách hiểu của phiên điều phối, fail-closed, chờ Chairman xác nhận: phần kèm của OQ-31 Chairman đã chốt ghi «Người chỉ định không được chỉ định chính mình, và mỗi uỷ quyền phải nêu rõ loại tài liệu được review hoặc duyệt», tức phủ cả duyệt. Vì vậy điều phối dự án không đề xuất được phiếu cấp quyền duyệt bản chuẩn cho chính mình.
  4. Một điểm lời Chairman chưa phủ mà planner phải xử lý rõ, không tự chọn: người đề xuất đồng thời giữ ghế BoM có được tính phiếu cho chính phiếu mình đề xuất không. Phán quyết S13 của lát 2 (phiếu đồng ý của người đề xuất không tính) vẫn là cách hiểu chờ xác nhận, không phải quyết định.
  5. Review bảo mật của bước này cần ca quyền âm tối thiểu cho: điều phối dự án A đề xuất cho thành viên dự án B; đề xuất cho người không phải thành viên; đề xuất kèm mở rộng quyền khác ngoài `doc_approve:*`; tự đề xuất cho mình; và gửi lại cùng khoá không tạo phiếu thứ hai.
  6. Số migration và cách chia task vẫn là phán quyết của phiên lát 3. Trần vòng sửa giữ nguyên: 3 cho mỗi task theo R5, 2 cho cổng Codex.
- **Áp vào lát 3:** bước «mở đường đề xuất cho điều phối dự án» của Task 7b không còn dừng tại OQ-33; nó được lập kế hoạch bổ sung và qua review bảo mật riêng trước khi có mã.
- **Cập nhật 15/11/2026 (sau các quyết định ở cuối tệp):** Chairman quyết đường trình mới (Task 7c) làm thành **PR riêng sau lát 3** — «Tách PR riêng sau lát 3 (Recommended)»; quyết định OQ-33 (b) giữ nguyên. Cách hiểu ở ghi chú 3 phía trên (điều phối dự án không tự trình cho chính mình) đã được Chairman xác nhận qua câu trả lời OQ-38, không còn «chờ xác nhận». Các quyết định cho PR riêng: OQ-35 (a), OQ-36 (b) cùng (d), OQ-37 (c), OQ-38 (c).
- **Trạng thái lúc lập kế hoạch (trước quyết định):** chưa quyết. Kế hoạch lát 3 bản 0.3 dùng đường có sẵn (quản trị tài khoản đề xuất và áp), không đổi nó; đây là hệ quả của yêu cầu «dùng lại như đang có», không phải phương án được chọn. Bước «mở đường đề xuất cho điều phối dự án» của Task 7b **dừng tại OQ-33**.

## OQ-34 — Ai thu hồi uỷ quyền nhận xét do điều phối dự án chỉ định

- **Lát:** 3 (chỉ bước thu hồi của Task 7a, tuyến thu hồi ở Task 15 và nút thu hồi ở Task 16; chỉ định, đọc và kiểm quyền vẫn làm).
- **Phía A:** quyết định OQ-31 (b) — «Điều phối dự án (vai manager) chỉ định người nhận xét.»; phần kèm chỉ nói ràng buộc lúc chỉ định (không tự chỉ định, phải nêu loại tài liệu). Không câu nào nói tới thu hồi.
- **Phía B:** `docs/SPEC-007-telegram-account-approval.md:33` — giảm quyền không cần phiếu, nhưng đó là sổ quyền tài khoản do quản trị tài khoản thao tác, không phải dòng uỷ quyền nhận xét; `docs/SLICE-BRIEFS.md:13` cấm tự cấp quyền (thu hồi không cấp quyền cho ai). Trong kế hoạch lát 3, một người nhận xét ghi được «yêu cầu sửa», và một bản chỉ có một quyết định (phán quyết S3), nên một uỷ quyền đặt nhầm giữ tác dụng tới khi bị thu hồi. Không tài liệu nào nói: ai thu hồi (người đã chỉ định, mọi điều phối của dự án, chính người được chỉ định, hay quản trị tài khoản); có cần căn cứ không; có làm ở lát 3 không.
- **Phương án:** (a) mọi người giữ vai `manager` của chính dự án đó thu hồi được, kèm căn cứ, hiệu lực ngay; quyết định và nhận xét đã ghi giữ nguyên; (b) chỉ người đã chỉ định thu hồi được (quản trị tài khoản thay khi người đó không còn vai); (c) như (a) và chính người được chỉ định cũng tự thôi được; (d) lát 3 không có thu hồi trên web: login vận hành thu hồi theo quyết định của người có thẩm quyền, đường thu hồi chốt trước pilot.
- **Ai quyết:** BoM Tech (theo dòng «Ai quyết» của OQ-31: BoM Tech cho phần người nhận xét); Chairman nếu muốn quyết luôn.
- **Khuyến nghị của planner (không phải quyết định):** (a) — thu hồi chỉ làm giảm quyền, và người có quyền chỉ định ở một dự án là người gần việc nhất để rút lại; kèm căn cứ để có dấu vết.
- **Quyết định 15/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối; phiên điều phối chuyển lời):** «(a) Mọi manager dự án (Recommended)». Trường «Ai quyết» ghi BoM Tech; lần này Chairman tự chốt.
  - Câu hỏi Chairman thấy: «OQ-34 (lát 3): ai được thu hồi uỷ quyền nhận xét mà điều phối dự án đã chỉ định? Quyết định OQ-31 chỉ nói lúc chỉ định, chưa nói thu hồi. Hồ sơ ghi câu này thuộc BoM Tech, Chairman quyết luôn nếu muốn; anh chọn phương án nào?»
  - Bốn phương án Chairman thấy (nhãn — mô tả):
    - «(a) Mọi manager dự án (Recommended)» — «Mọi người giữ vai manager của chính dự án đó thu hồi được, kèm căn cứ, hiệu lực ngay; quyết định và nhận xét đã ghi giữ nguyên.»
    - «(b) Chỉ người đã chỉ định» — «Chỉ người đã chỉ định thu hồi được; quản trị tài khoản thay khi người đó không còn vai.»
    - «(c) Như (a), thêm tự thôi» — «Như (a), và chính người được chỉ định cũng tự thôi được.»
    - «(d) Chưa thu hồi trên web» — «Lát 3 không có thu hồi trên web: login vận hành thu hồi theo quyết định của người có thẩm quyền; đường thu hồi chốt trước pilot. Trong lúc đó, đổi loại tài liệu của một người nhận xét cũng phải qua login vận hành.»
- **Ghi chú của phiên điều phối kèm quyết định (không phải lời Chairman):** OQ-34 (a): bước thu hồi của Task 7a, tuyến ở Task 15 và nút ở Task 16 không còn dừng. Thu hồi kèm căn cứ, hiệu lực ngay ở lệnh kế tiếp, quyết định và nhận xét đã ghi không đổi.
- **Áp vào lát 3:** làm bước thu hồi ở Task 7a, tuyến thu hồi ở Task 15 và nút thu hồi ở Task 16.
- **Trạng thái lúc lập kế hoạch (trước quyết định):** chưa quyết. Kế hoạch lát 3 bản 0.3 giữ chỗ fail-closed: role chạy không có quyền sửa dòng `review_delegations` (Task 4b), dịch vụ không có lệnh thu hồi (Task 7a), không có tuyến và nút thu hồi (Task 15, 16); test thu hồi bằng login vận hành. Hệ quả trong lúc chờ: trên web chưa đổi được loại tài liệu của một người nhận xét (đổi = thu hồi rồi chỉ định lại). Việc bớt **quyền duyệt bản chuẩn** không thuộc câu hỏi này: nó theo luật giảm quyền có sẵn của lát 2 (quản trị tài khoản lưu thẳng, không phiếu).

---

**Bổ sung 15/11/2026 khi áp quyết định OQ-33 và OQ-34 vào kế hoạch lát 3** (`docs/plans/slice-3-review-skills.md` bản 0.4, base `ec3b5e7`). Mục dưới đây là chỗ lời Chairman ở OQ-33 không phủ; ghi khi **chưa có quyết định**. Chairman đã quyết ngày 15/11/2026; quyết định ghi trong mục. Nó chỉ chặn đúng một phần của Task 7c; phần còn lại của Task 7c vẫn làm.

## OQ-35 — Người đề xuất phiếu cấp quyền duyệt bản chuẩn đồng thời giữ ghế BoM: phiếu của họ có được tính cho chính phiếu mình đề xuất không

- **Lát:** 3 (chỉ phần «điều phối dự án đang giữ ghế duyệt tài khoản trình phiếu» của Task 7c; mọi phần khác của Task 7c vẫn làm), pilot.
- **Phía A:** quyết định OQ-33 (b) — «Điều phối dự án đề xuất phiếu cho thành viên dự án mình, cùng người bỏ phiếu, cùng hàm đếm, cùng hạn; quản trị tài khoản vẫn là người áp. Cần kế hoạch bổ sung và review bảo mật riêng vì thêm người đề xuất mới trong dịch vụ danh tính.» Trong mã hiện có (`src/server/account-approval.ts:30-41`, `:77-89`; `src/server/accounts.ts`, hàm `proposeAccessChange`), người bỏ phiếu của một phiếu đổi quyền là mọi ghế đã ghép Telegram trừ người được đổi quyền, và hàm đếm `accessChangeTally` chỉ phân biệt ghế Chairman với ghế BoM, không biết ai là người đề xuất. Giữ đúng «cùng người bỏ phiếu, cùng hàm đếm» thì một điều phối dự án đang giữ ghế BoM trình phiếu rồi tự đồng ý là phiếu đủ (quản trị tài khoản vẫn phải áp).
- **Phía B:** OQ-29, cách hiểu của phiên lát 2 đang chờ Chairman xác nhận (`docs/OPEN-QUESTIONS.md:332`) — «Chairman vẫn nằm trong danh sách ghế đóng băng như trước. Phiếu đồng ý của Chairman không được tính cho phiếu `access_change`. Phiếu từ chối của Chairman đóng phiếu (`rejected`), vì Chairman là người đề xuất.»; OQ-29, cách hiểu của phiên điều phối đang chờ Chairman xác nhận (`:329`) — «Người được đổi quyền không bỏ phiếu cho chính mình.»; phần kèm của OQ-31, phương án Chairman chọn — «Người chỉ định không được chỉ định chính mình, và mỗi uỷ quyền phải nêu rõ loại tài liệu được review hoặc duyệt.»; ghi chú 4 của phiên điều phối kèm OQ-33 (`:426`) — «Một điểm lời Chairman chưa phủ mà planner phải xử lý rõ, không tự chọn: người đề xuất đồng thời giữ ghế BoM có được tính phiếu cho chính phiếu mình đề xuất không. Phán quyết S13 của lát 2 (phiếu đồng ý của người đề xuất không tính) vẫn là cách hiểu chờ xác nhận, không phải quyết định.» Không tài liệu nào nói: người đề xuất không phải Chairman mà đang giữ ghế BoM thì phiếu đồng ý của họ có được tính không; nếu không tính thì họ còn nằm trong danh sách người bỏ phiếu hay bị loại như người được đổi quyền; còn lại bao nhiêu ghế BoM thì phiếu mới mở được.
- **Phương án:** (a) người đề xuất không bỏ phiếu cho phiếu mình trình: ghế của họ bị loại khỏi danh sách người bỏ phiếu đóng băng của phiếu đó, như đang loại người được đổi quyền; cần ít nhất một ghế BoM khác; không sửa hàm đếm, chỉ đổi cách chọn người bỏ phiếu cho đường của điều phối dự án; (b) phiếu của người đề xuất được tính như mọi ghế BoM — đúng mã hiện có, không sửa gì; một người vừa trình vừa đồng ý là đủ, quản trị tài khoản vẫn là người áp; (c) người đang giữ ghế duyệt tài khoản không trình phiếu qua đường của điều phối dự án, họ nhờ quản trị tài khoản trình theo đường có sẵn; không sửa hàm đếm, không sửa cách chọn người bỏ phiếu; (d) người đề xuất vẫn nằm trong danh sách người bỏ phiếu nhưng phiếu đồng ý của họ không tính — phải sửa `accessChangeTally`, trái ghi chú «không đặt luật bỏ phiếu mới» (`:380`) nếu Chairman không nói rõ.
- **Điều kèm theo để Chairman biết (không phải câu hỏi riêng):** theo «cùng hàm đếm», phiếu từ chối của Chairman vẫn đóng một phiếu do điều phối dự án trình, và phiếu đồng ý của Chairman vẫn không tính. Cách hiểu của phiên lát 2 nêu lý do cho luật đó là Chairman là người đề xuất (câu trích ở Phía B); với đường mới Chairman không còn là người đề xuất. Kế hoạch giữ nguyên hàm đếm.
- **Ai quyết:** Chairman.
- **Khuyến nghị của planner (không phải quyết định):** (a) — cùng hướng với các cách hiểu đang chờ xác nhận ở OQ-29 (người có phần trong phiếu không bỏ phiếu cho phiếu đó), không đụng hàm đếm, và không khoá điều phối dự án đang giữ ghế BoM khỏi đường mới.
- **Quyết định 15/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối; phiên điều phối chuyển lời):** «(a) Người trình không bỏ phiếu (Recommended)».
  - Câu hỏi Chairman thấy: «OQ-35 (lát 3): điều phối dự án đang giữ ghế BoM trình phiếu cấp quyền duyệt bản chuẩn (đường mới của OQ-33 b) thì phiếu của chính họ có được tính không? Với mã hiện có, hàm đếm không biết ai là người trình, nên một người vừa trình vừa đồng ý là phiếu đủ (quản trị tài khoản vẫn phải áp).»
  - Bốn phương án Chairman thấy (nhãn — mô tả):
    - «(a) Người trình không bỏ phiếu (Recommended)» — «Ghế của người trình bị loại khỏi danh sách người bỏ phiếu đóng băng của phiếu đó, như đang loại người được đổi quyền; cần ít nhất một ghế BoM khác. Không sửa hàm đếm, chỉ đổi cách chọn người bỏ phiếu cho đường của điều phối dự án.»
    - «(c) Người giữ ghế không trình» — «Người đang giữ ghế duyệt tài khoản không trình phiếu qua đường mới; họ nhờ quản trị tài khoản trình theo đường có sẵn. Không sửa hàm đếm, không sửa cách chọn người bỏ phiếu; đây là hành vi giữ chỗ hiện tại. Nếu các điều phối dự án cũng chính là người giữ ghế BoM thì đường mới gần như không dùng được.»
    - «(b) Phiếu người trình được tính» — «Phiếu của người trình được tính như mọi ghế BoM, đúng mã hiện có, không sửa gì. Một người vừa trình vừa đồng ý là đủ; quản trị tài khoản vẫn là người áp.»
    - «(d) Ở lại nhưng không tính» — «Người trình vẫn nằm trong danh sách người bỏ phiếu nhưng phiếu đồng ý của họ không tính. Phải sửa hàm đếm accessChangeTally của lát 2.»
- **Ghi chú của phiên điều phối kèm quyết định (không phải lời Chairman):**
  1. Hành vi giữ chỗ `PROPOSER_SEAT_HELD` (trùng phương án (c)) được thay bằng phương án (a): chỉ đổi cách chọn người bỏ phiếu cho đường của điều phối dự án; `accessChangeTally` không sửa; đường trình của quản trị tài khoản không đổi.
  2. Mô tả Chairman chọn ghi «cần ít nhất một ghế BoM khác». Khi loại cả người được đổi quyền lẫn người trình mà không còn ghế BoM nào thì phiếu không mở được; có ca kiểm cho trường hợp đó, và lỗi trả về không lộ ai đang giữ ghế.
  3. Điều kèm theo ở trên (phiếu từ chối của Chairman vẫn đóng phiếu do điều phối dự án trình, phiếu đồng ý của Chairman vẫn không tính) đã được phiên điều phối báo Chairman dưới dạng thông tin, không hỏi thành câu riêng. Chairman chưa nói gì về điểm này; giữ nguyên hàm đếm và giữ nó trong danh sách «chờ Chairman xác nhận» cùng S13 của lát 2.
  4. Hai ghi chú từ review CSDL của migration 019 (một chiều kể từ phiếu đầu tiên mang mã quyền duyệt; khoá độc quyền `identity.memberships` lúc áp) phải nằm trong biên nhận `DELIVERY-012`, mục điều kiện cho điểm dừng áp migration thật.
- **Áp vào lát 3:** Task 7c vẫn dừng cả task tới khi OQ-36, OQ-37 và OQ-38 có quyết định (phán quyết S66 của kế hoạch); khi đó bước giữ chỗ `PROPOSER_SEAT_HELD` của Task 7c được thay bằng cách chọn người bỏ phiếu theo phương án (a), rồi qua cổng bảo mật lần nữa trước khi viết mã.
- **Trạng thái lúc lập kế hoạch:** chưa quyết. Kế hoạch lát 3 bản 0.4 đặt **hành vi giữ chỗ fail-closed, không phải phương án được chọn** (phán quyết S57 của kế hoạch): người trình đang giữ một ghế trong `identity.account_approval_seats` bị từ chối khi trình qua đường mới (`PROPOSER_SEAT_HELD`); không sửa `accessChangeTally`, không sửa cách chọn người bỏ phiếu. Giữ chỗ này trùng hành vi của phương án (c) và chặt hơn (a), (b), (d). Phần bị chặn: chỉ việc trình phiếu của điều phối dự án đang giữ ghế duyệt tài khoản; họ vẫn nhờ quản trị tài khoản trình theo đường có sẵn. Khi có câu trả lời, chỉ một bước của `proposeDocApproval` và một ca kiểm đổi.

---

**Bổ sung 15/11/2026 sau cổng bảo mật trên kế hoạch Task 7c của lát 3** (`docs/reviews/slice-3-evidence-20261115/gates/security-gate-task-7c-plan.md`, kết luận «PLAN NEEDS CHANGES»; `docs/plans/slice-3-review-skills.md` bản 0.5, base `ec3b5e7`). Ba mục dưới đây là ba câu hỏi cổng bảo mật nêu là không thuộc quyền phiên (mục Q2, Q3, Q4 của tệp cổng; Q1 là OQ-35). Ghi khi **chưa có quyết định**. Phán quyết của phiên lát 3 (không phải quyết định của Chairman): Task 7c dừng cả task tới khi OQ-35, OQ-36, OQ-37 và OQ-38 có quyết định; kế hoạch của 7c vẫn viết đủ theo các hành vi giữ chỗ nêu trong từng mục.

**Quyết định của Chairman ngày 15/11/2026 về nơi làm Task 7c (chọn qua hộp chọn ở phiên điều phối; phiên điều phối chuyển lời):** «Tách PR riêng sau lát 3 (Recommended)». Chairman cũng đã quyết cả ba mục dưới đây cùng ngày; quyết định ghi trong từng mục.
- Câu hỏi Chairman thấy: «Task 7c — đường để điều phối dự án trình phiếu cấp quyền duyệt bản chuẩn (theo OQ-33 b) — làm ở đâu? Cổng bảo mật trên kế hoạch của task này trả «PLAN NEEDS CHANGES» (3 chỗ phải sửa, đã sửa trong kế hoạch) và nêu các câu hỏi OQ-35…38.»
- Hai phương án Chairman thấy (nhãn — mô tả):
  - «Tách PR riêng sau lát 3 (Recommended)» — «PR của lát 3 không có Task 7c; quyền duyệt bản chuẩn vẫn cấp được qua đường có sẵn (quản trị tài khoản trình, một BoM đồng ý, quản trị áp). Task 7c làm thành PR riêng ngay sau đó, có cổng bảo mật và cổng Codex riêng. Quyết định OQ-33 (b) giữ nguyên.»
  - «Làm trong lát 3» — «Task 7c nằm trong PR của lát 3, viết mã sau khi cổng bảo mật xem lại kế hoạch đã sửa. PR lớn hơn và có thêm mã trong dịch vụ danh tính cho cổng Codex soát.»
- Ghi chú của phiên điều phối kèm quyết định (không phải lời Chairman):
  1. Lát 3 bỏ Task 7c và bước 16b (biểu mẫu trình phiếu của điều phối dự án) khỏi phạm vi PR của lát. Không viết mã nào của đường trình mới trong lát 3. Kế hoạch lên bản mới ghi rõ điều này; phần kế hoạch Task 7c, báo cáo cổng bảo mật và năm quyết định OQ-33, OQ-35…38 giữ trong repo làm đầu vào cho PR riêng.
  2. Phiên lát 3 không tự mở PR riêng cho Task 7c. Mô tả Chairman chọn ghi «ngay sau đó»; ai làm và cắt nhánh từ đâu, phiên điều phối sẽ hỏi Chairman khi PR của lát 3 đã mở. Lý do: Task 7c dựa trên migration 019 của lát 3, và merge PR của lát 3 là điểm dừng chờ Chairman.
  3. Biên nhận `DELIVERY-012` ghi rõ: đường để điều phối dự án trình phiếu chưa có trong PR này; quyền duyệt bản chuẩn cấp qua đường có sẵn (quản trị tài khoản trình, một BoM đồng ý, quản trị áp); liệt kê các quyết định đã có cho PR riêng.
  4. Trần vòng sửa giữ nguyên: 3 cho mỗi task theo R5, 2 cho cổng Codex.

## OQ-36 — Ai được huỷ hoặc rút một phiếu đang mở do điều phối dự án trình, và quản trị tài khoản thay phiếu đó bằng cách nào

- **Lát:** 3 (Task 7c, đang dừng cả task), pilot.
- **Phía A:** quyết định OQ-33 (b) — «Điều phối dự án đề xuất phiếu cho thành viên dự án mình, cùng người bỏ phiếu, cùng hàm đếm, cùng hạn; quản trị tài khoản vẫn là người áp. Cần kế hoạch bổ sung và review bảo mật riêng vì thêm người đề xuất mới trong dịch vụ danh tính.» Trong cơ chế phiếu đang có, không ai huỷ hay rút được một phiếu đổi quyền: phiếu đang mở chỉ kết thúc khi bị từ chối, hết hạn 48 giờ, hoặc khi phiên bản tài khoản của người được đổi quyền đổi (`src/server/accounts.ts:263-265`, `src/server/account-approval.ts:176-189`). Mỗi người chỉ có một phiếu đổi quyền đang mở (`migrations/018_access_change_approval.sql:31-33`, `src/server/accounts.ts:266-268`).
- **Phía B:** cổng bảo mật, mục M2 (`docs/reviews/slice-3-evidence-20261115/gates/security-gate-task-7c-plan.md:24-30`) và Q2 (`:60`): một phiếu đang mở của điều phối dự án chặn phiếu của quản trị tài khoản cho cùng người; đòn bẩy duy nhất của quản trị hôm nay là chạy một lệnh tài khoản làm tăng phiên bản rồi trình lại — lệnh đó còn thu hồi phiên đăng nhập của thành viên (`src/server/accounts.ts:220-222`), và với lệnh `access` hoặc `disable` còn huỷ mã ghép Telegram chưa dùng (`:228-230`). Quyết định OQ-34 (a) cho mọi `manager` của dự án thu hồi uỷ quyền nhận xét — «Mọi người giữ vai manager của chính dự án đó thu hồi được, kèm căn cứ, hiệu lực ngay; quyết định và nhận xét đã ghi giữ nguyên.» — nhưng đó là dòng uỷ quyền nhận xét, không phải phiếu đổi quyền. Không tài liệu nào nói: ai được huỷ hoặc rút một phiếu đổi quyền đang mở; quản trị tài khoản có được huỷ phiếu do người khác trình mà không đụng tới phiên của thành viên không; phiếu bị huỷ thì người trình có được trình lại ngay không.
- **Phương án:** (a) không ai, như hiện nay: phiếu chỉ kết thúc bằng phiếu bầu, hạn 48 giờ hoặc khi tài khoản đổi; quản trị tài khoản thay phiếu bằng đòn bẩy có sẵn (một lệnh tăng phiên bản tài khoản, rồi trình phiếu của mình), chấp nhận tác dụng phụ lên phiên của thành viên; (b) người trình rút được phiếu của chính mình, kèm căn cứ; (c) mọi `manager` của dự án đó rút được phiếu do một điều phối của dự án trình, kèm căn cứ; (d) quản trị tài khoản huỷ được phiếu bằng một lệnh riêng, kèm căn cứ, không đổi phiên bản tài khoản và không đụng phiên của thành viên; (e) tổ hợp, ví dụ (b) cùng (d).
- **Ai quyết:** Chairman.
- **Khuyến nghị của planner (không phải quyết định):** (b) cùng (d) — người trình sửa được lỗi của chính mình (trình nhầm người hoặc nhầm loại) mà không chờ 48 giờ, và quản trị tài khoản có một lệnh sạch thay cho việc thu hồi phiên của thành viên chỉ để đóng một phiếu. Không khuyến nghị (c): một điều phối rút phiếu của điều phối khác dễ thành tranh chấp trong dự án.
- **Quyết định 15/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối; phiên điều phối chuyển lời):** «(b) cùng (d) (Recommended)».
  - Câu hỏi Chairman thấy: «OQ-36: ai được huỷ hoặc rút một phiếu đang mở do điều phối dự án trình? Hiện không ai huỷ được phiếu đổi quyền, và mỗi người chỉ có một phiếu đang mở, nên phiếu của điều phối chặn phiếu của quản trị tài khoản cho cùng người tới 48 giờ. (Phương án (c) của hồ sơ — mọi manager của dự án rút được, planner không khuyến nghị — không có trong bốn lựa chọn; anh gõ vào ô khác nếu muốn.)»
  - Bốn phương án Chairman thấy (nhãn — mô tả):
    - «(b) cùng (d) (Recommended)» — «Người trình rút được phiếu của chính mình, kèm căn cứ. Quản trị tài khoản huỷ được phiếu bằng một lệnh riêng, kèm căn cứ, không đổi phiên bản tài khoản và không đụng phiên đăng nhập của thành viên.»
    - «(a) Không ai, như hiện nay» — «Phiếu chỉ kết thúc bằng phiếu bầu, hạn 48 giờ hoặc khi tài khoản đổi. Quản trị thay phiếu bằng đòn bẩy có sẵn: một lệnh tăng phiên bản tài khoản rồi trình phiếu của mình, chấp nhận việc lệnh đó thu hồi phiên đăng nhập của thành viên.»
    - «(b) Chỉ người trình rút» — «Người trình rút được phiếu của chính mình, kèm căn cứ. Quản trị tài khoản vẫn chỉ có đòn bẩy có sẵn.»
    - «(d) Chỉ quản trị huỷ» — «Quản trị tài khoản huỷ được phiếu bằng một lệnh riêng, kèm căn cứ, không đổi phiên bản tài khoản và không đụng phiên của thành viên. Người trình không tự rút được.»
- **Ghi chú của phiên điều phối kèm quyết định (không phải lời Chairman):** khi viết kế hoạch cho PR riêng của Task 7c, giữ chỗ S78 đổi theo OQ-36 (b) cùng (d). Hai điểm lời Chairman chưa phủ, để dành cho kế hoạch của PR riêng, không tự chọn: phiếu bị rút hoặc bị huỷ thì người trình có được trình lại ngay không (chặn 24 giờ theo cặp là phán quyết của planner, không phải quyết định); và phương án (c) của OQ-36 không được chọn nên manager khác của dự án không rút được phiếu của người trình.
- **Trạng thái lúc lập kế hoạch:** chưa quyết. Kế hoạch lát 3 bản 0.5 đặt **hành vi giữ chỗ fail-closed, không phải phương án được chọn** (phán quyết S78 của kế hoạch): không thêm lệnh huỷ hay rút nào — trùng phương án (a); quản trị tài khoản thay phiếu bằng đòn bẩy có sẵn, có ca kiểm; thêm một chặn lạm dụng do planner đặt để đòn bẩy đó không bị vô hiệu: mỗi cặp (người trình, người được cấp) chỉ mở được một phiếu trong 24 giờ, trừ khi phiếu trước đã được áp. Planner coi đòn bẩy có sẵn không phải quyền mới (nó đã áp cho mọi phiếu đổi quyền, bất kể ai trình); lệnh huỷ riêng ở phương án (d) là quyền mới nên không tự thêm.

## OQ-37 — Phiếu do điều phối dự án trình có còn áp được không khi người trình mất vai `manager` hoặc bị khoá trước lúc quản trị tài khoản áp

- **Lát:** 3 (Task 7c, đang dừng cả task), pilot.
- **Phía A:** quyết định OQ-33 (b) — «Điều phối dự án đề xuất phiếu cho thành viên dự án mình, cùng người bỏ phiếu, cùng hàm đếm, cùng hạn; quản trị tài khoản vẫn là người áp. Cần kế hoạch bổ sung và review bảo mật riêng vì thêm người đề xuất mới trong dịch vụ danh tính.» Lệnh áp đang có (`src/server/accounts.ts:207-217`) chỉ xét người được đổi quyền: phiên bản tài khoản, bộ quyền đóng băng và phiếu đủ; nó không xét người trình. Giữ nguyên như vậy thì phiếu vẫn áp được dù người trình đã mất vai.
- **Phía B:** quyết định OQ-31 (b) gắn thẩm quyền với vai — «Điều phối dự án (vai manager) chỉ định người nhận xét. Quyền duyệt bản chuẩn đi qua phiếu đổi quyền một BoM như OQ-29. Phát sinh thêm migration 021 và task trong lát 3.»; cổng bảo mật, mục M3 (`docs/reviews/slice-3-evidence-20261115/gates/security-gate-task-7c-plan.md:32-38`) và Q3 (`:61`): một người không còn điều phối dự án vẫn có một phiếu đang mở, và quản trị tài khoản có thể áp nó từ `/team` mà không nhận ra người trình đã mất vai. Không tài liệu nào nói: thẩm quyền trình phiếu chỉ cần có lúc trình, hay phải còn tới lúc áp; phiếu của người đã mất vai tự đóng hay chỉ cần hiện rõ cho quản trị.
- **Phương án:** (a) vẫn áp được; quản trị tài khoản tự quyết (đúng mã hiện có); (b) phiếu không còn áp được khi người trình không còn là `manager` đang hoạt động của dự án đó (bị hạ vai, rời dự án, bị khoá); phiếu đóng khi việc đó xảy ra, quản trị muốn cấp thì tự trình; (c) vẫn áp được, nhưng `/team` phải nêu rõ người trình không còn điều phối dự án trước khi quản trị áp.
- **Ai quyết:** Chairman.
- **Khuyến nghị của planner (không phải quyết định):** (b) — một người thường bị hạ vai hoặc bị khoá vì có vấn đề; đề xuất còn treo của họ không nên đi tiếp chỉ nhờ quản trị không để ý. Trình lại chỉ tốn một lần quản trị trình và một phiếu BoM.
- **Quyết định 15/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối; phiên điều phối chuyển lời):** «(c) Áp được, phải nêu rõ». Chairman không chọn phương án được đánh dấu Recommended.
  - Câu hỏi Chairman thấy: «OQ-37: phiếu do điều phối dự án trình có còn áp được không khi người trình mất vai manager, rời dự án hoặc bị khoá trước lúc quản trị tài khoản áp? Lệnh áp hiện chỉ xét người được đổi quyền, không xét người trình.»
  - Ba phương án Chairman thấy (nhãn — mô tả):
    - «(b) Không còn áp được (Recommended)» — «Phiếu không còn áp được khi người trình không còn là manager đang hoạt động của dự án đó; phiếu đóng khi việc đó xảy ra. Quản trị tài khoản muốn cấp thì tự trình.»
    - «(c) Áp được, phải nêu rõ» — «Vẫn áp được, nhưng /team phải nêu rõ người trình không còn điều phối dự án trước khi quản trị áp.»
    - «(a) Vẫn áp được» — «Vẫn áp được; quản trị tài khoản tự quyết. Đúng mã hiện có.»
- **Ghi chú của phiên điều phối kèm quyết định (không phải lời Chairman):** khi viết kế hoạch cho PR riêng của Task 7c, giữ chỗ S82 đổi theo OQ-37 (c), tức **không chặn** lệnh áp mà nêu rõ trên `/team` trước khi quản trị áp.
- **Trạng thái lúc lập kế hoạch:** chưa quyết. Kế hoạch lát 3 bản 0.5 đặt **hành vi giữ chỗ fail-closed, không phải phương án được chọn** (phán quyết S82 của kế hoạch): lúc quản trị tài khoản áp, người trình phải vẫn là `manager` đang hoạt động, đã kích hoạt của đúng dự án; không thì phiếu không áp được và `/team` nêu rõ. Giữ chỗ không đóng phiếu và không chặn được việc bỏ phiếu (đường bỏ phiếu ở `src/server/account-approval.ts` không được sửa). Giữ chỗ này chặt hơn (a) và (c), và gần phương án (b) nhưng không ghi gì vào phiếu.

## OQ-38 — Điều phối dự án có được trình phiếu cấp quyền duyệt bản chuẩn cho một đồng điều phối của cùng dự án không

- **Lát:** 3 (Task 7c, đang dừng cả task), pilot.
- **Phía A:** quyết định OQ-33 (b) — «Điều phối dự án đề xuất phiếu cho thành viên dự án mình, cùng người bỏ phiếu, cùng hàm đếm, cùng hạn; quản trị tài khoản vẫn là người áp. Cần kế hoạch bổ sung và review bảo mật riêng vì thêm người đề xuất mới trong dịch vụ danh tính.» Một đồng điều phối là thành viên của dự án. Ở phần người nhận xét, kế hoạch cho một điều phối chỉ định một điều phối khác của cùng dự án làm người nhận xét; phần kèm của OQ-31 Chairman chọn chỉ cấm tự chỉ định — «Người chỉ định không được chỉ định chính mình, và mỗi uỷ quyền phải nêu rõ loại tài liệu được review hoặc duyệt.»
- **Phía B:** ghi chú 3 của phiên điều phối kèm OQ-33 (`docs/OPEN-QUESTIONS.md:425`), **tự nó còn chờ Chairman xác nhận** — «Cách hiểu của phiên điều phối, fail-closed, chờ Chairman xác nhận: phần kèm của OQ-31 Chairman đã chốt ghi «Người chỉ định không được chỉ định chính mình, và mỗi uỷ quyền phải nêu rõ loại tài liệu được review hoặc duyệt», tức phủ cả duyệt. Vì vậy điều phối dự án không đề xuất được phiếu cấp quyền duyệt bản chuẩn cho chính mình.»; cổng bảo mật, mục Q4 (`docs/reviews/slice-3-evidence-20261115/gates/security-gate-task-7c-plan.md:62`): hai đồng điều phối trình cho nhau thì đạt đúng kết quả mà luật cấm tự trình chặn với một người. Không tài liệu nào nói người được cấp có được là một điều phối của chính dự án đó không.
- **Phương án:** (a) được; giữa hai người vẫn còn một ghế BoM bỏ phiếu và quản trị tài khoản áp; (b) không: người được cấp đang giữ vai `manager` ở chính dự án đó phải do quản trị tài khoản trình theo đường có sẵn; (c) được, nhưng phiếu phải nêu rõ cho người bỏ phiếu rằng người được cấp cũng là điều phối của dự án đó.
- **Điều kèm theo để Chairman biết:** câu hỏi này chỉ có nghĩa nếu cách hiểu «không tự trình cho mình» (ghi chú 3 nêu trên) được xác nhận. Nếu Chairman cho điều phối dự án tự trình cho mình thì trình cho đồng điều phối đương nhiên được.
- **Ai quyết:** Chairman.
- **Khuyến nghị của planner (không phải quyết định):** (c) — ở nhóm nhỏ, điều phối thường cũng là người đủ hiểu để duyệt bản chuẩn; hai chốt của người (một ghế BoM, quản trị tài khoản) vẫn đứng giữa, miễn là người bỏ phiếu thấy rõ quan hệ đó.
- **Quyết định 15/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối; phiên điều phối chuyển lời):** «(c) Được, phiếu nêu rõ (Recommended)».
  - Câu hỏi Chairman thấy: «OQ-38: điều phối dự án có được trình phiếu cấp quyền duyệt bản chuẩn cho một đồng điều phối của cùng dự án không? Hai đồng điều phối trình cho nhau thì đạt đúng kết quả mà luật cấm tự trình chặn. Chọn (a), (b) hoặc (c) cũng là xác nhận cách hiểu của phiên điều phối: điều phối dự án không tự trình cho chính mình.»
  - Bốn phương án Chairman thấy (nhãn — mô tả):
    - «(c) Được, phiếu nêu rõ (Recommended)» — «Được, nhưng phiếu phải nêu rõ cho người bỏ phiếu rằng người được cấp cũng là điều phối của dự án đó. Một ghế BoM và quản trị tài khoản vẫn đứng giữa.»
    - «(a) Được» — «Được; giữa hai người vẫn còn một ghế BoM bỏ phiếu và quản trị tài khoản áp.»
    - «(b) Không» — «Người được cấp đang giữ vai manager ở chính dự án đó phải do quản trị tài khoản trình theo đường có sẵn.»
    - «Cho cả tự trình» — «Bỏ cách hiểu «không tự trình cho mình»: điều phối dự án được trình phiếu cả cho chính mình, nên trình cho đồng điều phối đương nhiên được.»
- **Hệ quả của câu trả lời, theo đúng câu hỏi Chairman thấy:** câu trả lời này cũng xác nhận điều phối dự án không tự trình cho chính mình. Ghi chú 3 của phiên điều phối kèm OQ-33 vì vậy không còn «chờ xác nhận».
- **Ghi chú của phiên điều phối kèm quyết định (không phải lời Chairman):** khi viết kế hoạch cho PR riêng của Task 7c, giữ chỗ S83 đổi theo OQ-38 (c), kèm việc đổi cách khoá hai dòng tài khoản mà kế hoạch đã nêu, và cổng bảo mật xem lại.
- **Trạng thái lúc lập kế hoạch:** chưa quyết. Kế hoạch lát 3 bản 0.5 đặt **hành vi giữ chỗ fail-closed, không phải phương án được chọn** (phán quyết S83 của kế hoạch): người được cấp có vai `manager` ở chính dự án đó bị từ chối trên đường của điều phối — trùng phương án (b); quản trị tài khoản trình theo đường có sẵn thì được. Nếu phương án (a) hoặc (c) được chọn, cách khoá hai dòng tài khoản của Task 7c phải đổi (khoá theo thứ tự mã), nên cổng bảo mật phải xem lại phần đó.

---

**Bổ sung 15/11/2026 sau review bảo mật của Task 7a lát 3** (`docs/reviews/slice-3-evidence-20261115/gates/review-task-7a-security.md`, kết luận «Approved», mục «Questions that are not the session's to decide»; mã ở `828158a`). Bốn mục dưới đây là bốn câu hỏi «ai được làm gì» mà lời Chairman ở OQ-31 và OQ-34 chưa phủ. Ghi khi **chưa có quyết định**, do phiên lát 3 chép từ báo cáo review. Chairman đã quyết cả bốn ngày 15/11/2026; quyết định ghi trong từng mục. **Không mục nào chặn task nào của lát 3:** mã đã có một hành vi cho từng trường hợp (nêu ở dòng «Hành vi hiện tại»); đó là hệ quả của cách kế hoạch và lược đồ được viết, không phải phương án được chọn. Đổi theo quyết định sau này là việc nhỏ, nêu ở từng mục.

## OQ-39 — Uỷ quyền nhận xét có còn hiệu lực khi người đã chỉ định mất vai `manager` của dự án không

- **Lát:** 3 (Task 7a, đã có mã), pilot.
- **Phía A:** quyết định OQ-31 (b) — «Điều phối dự án (vai manager) chỉ định người nhận xét. Quyền duyệt bản chuẩn đi qua phiếu đổi quyền một BoM như OQ-29. Phát sinh thêm migration 021 và task trong lát 3.»; quyết định OQ-34 (a) — «Mọi người giữ vai manager của chính dự án đó thu hồi được, kèm căn cứ, hiệu lực ngay; quyết định và nhận xét đã ghi giữ nguyên.» Theo đó thẩm quyền được xét lúc chỉ định, và muốn chấm dứt thì một điều phối thu hồi.
- **Phía B:** quyết định OQ-37 (c) cho một trường hợp gần giống ở phiếu cấp quyền duyệt — «Vẫn áp được, nhưng /team phải nêu rõ người trình không còn điều phối dự án trước khi quản trị áp.» — nhưng đó là phiếu, không phải uỷ quyền nhận xét. Không tài liệu nào nói: uỷ quyền do một người không còn là điều phối chỉ định thì tiếp tục, tự hết, hay phải hiện rõ.
- **Phương án:** (a) vẫn hiệu lực tới khi một điều phối thu hồi, như hiện nay; (b) tự hết khi người chỉ định không còn là `manager` của dự án đó; (c) vẫn hiệu lực nhưng danh sách và giao diện nêu rõ «người chỉ định không còn là điều phối».
- **Ai quyết:** BoM Tech (phần người nhận xét, theo dòng «Ai quyết» của OQ-31); Chairman nếu muốn quyết luôn.
- **Quyết định 15/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối; phiên điều phối chuyển lời):** «(c) Hiệu lực, nêu rõ (Recommended)». Trường «Ai quyết» ghi BoM Tech; lần này Chairman tự chốt.
  - Câu hỏi Chairman thấy: «OQ-39 (lát 3): uỷ quyền nhận xét tài liệu có còn hiệu lực không khi người đã chỉ định mất vai manager của dự án? Hồ sơ ghi câu này thuộc BoM Tech, Chairman quyết luôn nếu muốn.»
  - Ba phương án Chairman thấy (nhãn — mô tả):
    - «(c) Hiệu lực, nêu rõ (Recommended)» — «Vẫn hiệu lực, nhưng danh sách và giao diện nêu rõ «người chỉ định không còn là điều phối». Chỉ thêm một cột tính trong hàm liệt kê và một dòng chữ trên giao diện.»
    - «(a) Hiệu lực tới khi thu hồi» — «Vẫn hiệu lực tới khi một điều phối thu hồi, như hiện nay. Không sửa gì.»
    - «(b) Tự hết» — «Tự hết khi người chỉ định không còn là manager của dự án đó. Cần thêm điều kiện ở dịch vụ và ở guard đọc uỷ quyền.»
- **Ghi chú của phiên điều phối kèm quyết định (không phải lời Chairman):** OQ-39 (c) chỉ thêm chỉ báo, không đổi việc uỷ quyền có hiệu lực hay không: nhãn «người chỉ định không còn là điều phối» phải có ở hàm liệt kê và ở màn Review, có ca kiểm.
- **Áp vào lát 3:** thêm chỉ báo vào hàm liệt kê của `DelegationService` và một dòng chữ ở màn Review; không đổi luật hiệu lực.
- **Hành vi hiện tại (không phải phương án được chọn):** trùng (a). Đổi sang (c) chỉ thêm một cột tính trong hàm liệt kê và một dòng chữ trên giao diện; đổi sang (b) cần thêm điều kiện ở chỗ dịch vụ và guard đọc uỷ quyền.

## OQ-40 — Uỷ quyền nhận xét của một người mất vai đọc, rời dự án hoặc bị khoá rồi quay lại

- **Lát:** 3 (Task 4b, 5, 7a, đã có mã), pilot.
- **Phía A:** quyết định OQ-34 (a) chỉ nêu một đường chấm dứt uỷ quyền là thu hồi bởi điều phối. Lược đồ và dịch vụ vì vậy không tự đóng dòng uỷ quyền khi người được chỉ định mất vai: dòng vẫn «còn hiệu lực» trong bảng, nhưng không dùng được chừng nào người đó không còn là thành viên đang hoạt động có vai đọc (guard của `review_decisions` ở `migrations/020_document_review.sql`; `src/server/document-review.ts`, hàm đọc thẩm quyền).
- **Phía B:** `docs/SLICE-BRIEFS.md:13` cấm «tự cấp quyền»; khi người đó được thêm lại vào dự án với vai đọc, uỷ quyền cũ cùng các loại tài liệu cũ có hiệu lực lại mà không điều phối nào làm gì — một quyền quay lại không qua bước chỉ định mới. Không tài liệu nào nói uỷ quyền «ngủ» rồi tự sống lại, hay coi như đã hết.
- **Phương án:** (a) ngủ rồi tự có hiệu lực lại với loại tài liệu cũ, như hiện nay; (b) coi như đã hết: quay lại thì phải được chỉ định mới; (c) vẫn ngủ, nhưng điều phối thấy dòng đó được đánh dấu «đang ngủ» để thu hồi nếu muốn.
- **Ai quyết:** BoM Tech; Chairman nếu muốn quyết luôn.
- **Quyết định 15/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối; phiên điều phối chuyển lời):** «(c) Ngủ, có đánh dấu (Recommended)». Trường «Ai quyết» ghi BoM Tech; lần này Chairman tự chốt.
  - Câu hỏi Chairman thấy: «OQ-40 (lát 3): người nhận xét mất vai đọc, rời dự án hoặc bị khoá rồi quay lại thì uỷ quyền nhận xét cũ thế nào? Trong lúc vắng, uỷ quyền không cho làm gì. Hồ sơ ghi câu này thuộc BoM Tech, Chairman quyết luôn nếu muốn.»
  - Ba phương án Chairman thấy (nhãn — mô tả):
    - «(c) Ngủ, có đánh dấu (Recommended)» — «Vẫn ngủ như hiện nay (quay lại thì có hiệu lực lại), nhưng điều phối thấy dòng đó được đánh dấu «đang ngủ» để thu hồi nếu muốn. Chỉ thêm một chỉ báo trong hàm liệt kê.»
    - «(a) Ngủ rồi tự hiệu lực lại» — «Ngủ rồi tự có hiệu lực lại với loại tài liệu cũ, như hiện nay. Danh sách vẫn hiện dòng đó là còn hiệu lực.»
    - «(b) Coi như đã hết» — «Quay lại thì phải được chỉ định mới. Cần migration đóng dòng khi mất vai, hoặc một bước thu hồi trong lệnh đổi quyền của dịch vụ tài khoản.»
- **Ghi chú của phiên điều phối kèm quyết định (không phải lời Chairman):** OQ-40 (c) chỉ thêm chỉ báo, không đổi việc uỷ quyền có hiệu lực hay không: nhãn «đang ngủ» phải có ở hàm liệt kê và ở màn Review, có ca kiểm.
- **Áp vào lát 3:** thêm chỉ báo «đang ngủ» vào hàm liệt kê của `DelegationService` và ở màn Review; không đổi luật hiệu lực.
- **Hành vi hiện tại (không phải phương án được chọn):** trùng (a). Trong lúc ngủ, uỷ quyền không cho làm gì (đã có ca kiểm); danh sách vẫn hiện nó là còn hiệu lực. Đổi sang (c) chỉ thêm một chỉ báo trong hàm liệt kê; đổi sang (b) cần migration (đóng dòng khi mất vai) hoặc một bước thu hồi trong lệnh đổi quyền của dịch vụ tài khoản.

## OQ-41 — Ai được xem danh sách người nhận xét, căn cứ chỉ định và căn cứ thu hồi

- **Lát:** 3 (Task 7a đã có mã; Task 15, 16 sẽ đưa lên tuyến và màn hình), pilot.
- **Phía A:** phán quyết S11 của kế hoạch lát 3 (tự nó còn chờ Chairman xác nhận) — vai đọc Review và Quyết định là `manager`, `engineer`, `technical`, `business`; chặn `viewer` và `bot`. Theo đó mọi người đọc của dự án xem được ai nhận xét loại tài liệu nào, kèm chữ căn cứ.
- **Phía B:** căn cứ chỉ định và nhất là căn cứ thu hồi là chữ tự do do điều phối viết, có thể nói về công việc của một người; `AGENTS.md` và luật chung đòi lỗi và danh sách không lộ quá điều người xem cần. Quyết định OQ-34 (a) đòi thu hồi «kèm căn cứ» nhưng không nói ai đọc được căn cứ đó. Không tài liệu nào nói người đọc không phải điều phối có được thấy chữ căn cứ không.
- **Phương án:** (a) mọi người đọc của dự án thấy đủ, như hiện nay; (b) điều phối thấy đủ, người đọc khác chỉ thấy ai nhận xét loại nào, không thấy chữ căn cứ; (c) như (b), và người được chỉ định thấy căn cứ của các dòng của chính mình.
- **Ai quyết:** BoM Tech; Chairman nếu muốn quyết luôn.
- **Quyết định 15/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối; phiên điều phối chuyển lời):** «(c) Điều phối và đương sự (Recommended)». Trường «Ai quyết» ghi BoM Tech; lần này Chairman tự chốt.
  - Câu hỏi Chairman thấy: «OQ-41 (lát 3): ai được xem danh sách người nhận xét, căn cứ chỉ định và căn cứ thu hồi (chữ tự do do điều phối viết)? Hồ sơ ghi câu này thuộc BoM Tech, Chairman quyết luôn nếu muốn.»
  - Ba phương án Chairman thấy (nhãn — mô tả):
    - «(c) Điều phối và đương sự (Recommended)» — «Điều phối thấy đủ. Người đọc khác chỉ thấy ai nhận xét loại tài liệu nào, không thấy chữ căn cứ. Người được chỉ định thấy căn cứ của các dòng của chính mình. Phiên lát 3 đang tạm làm theo hướng này.»
    - «(b) Chỉ điều phối thấy căn cứ» — «Điều phối thấy đủ; người đọc khác chỉ thấy ai nhận xét loại nào, không thấy chữ căn cứ, kể cả người được chỉ định.»
    - «(a) Mọi người đọc thấy đủ» — «Mọi người đọc của dự án (manager, engineer, technical, business) thấy đủ, gồm cả chữ căn cứ.»
- **Ghi chú của phiên điều phối kèm quyết định (không phải lời Chairman):** OQ-41 (c): hạn chế phải ép ở **tầng dịch vụ**, không chỉ ở tuyến và màn hình; hiện tầng dịch vụ còn trả đủ cho mọi người đọc. Có ca quyền âm: người đọc không phải điều phối không nhận được chữ căn cứ của dòng của người khác, kể cả căn cứ thu hồi.
- **Áp vào lát 3:** hàm liệt kê của `DelegationService` chỉ trả chữ căn cứ cho điều phối của dự án và cho người được chỉ định với dòng của chính mình; phán quyết tạm của phiên lát 3 ở dòng dưới nay là quyết định của Chairman và được ép ở tầng dịch vụ.
- **Hành vi hiện tại (không phải phương án được chọn):** trùng (a) ở tầng dịch vụ; chưa có tuyến hay màn hình nào hiện nó. Đổi sang (b) hoặc (c) là bỏ hai trường khỏi kết quả trả cho người không phải điều phối. **Phán quyết của phiên lát 3 (không phải quyết định của Chairman) cho Task 15 và 16 trong lúc chờ:** tuyến và màn hình chỉ đưa chữ căn cứ cho điều phối của dự án và cho chính người được chỉ định với dòng của mình — hướng chặt, trùng (c); khi có quyết định (a) thì nới lại.

## OQ-42 — Một người có hai tài khoản: điều phối chỉ định tài khoản thứ hai của chính mình

- **Lát:** ngoài lát 3 (dịch vụ tài khoản); nêu vì nó chạm luật «không tự chỉ định» của OQ-31.
- **Phía A:** phần kèm của OQ-31 — «Người chỉ định không được chỉ định chính mình, và mỗi uỷ quyền phải nêu rõ loại tài liệu được review hoặc duyệt.» Lát 3 ép luật này theo mã tài khoản (dịch vụ, CHECK và trigger).
- **Phía B:** dịch vụ không biết hai tài khoản thuộc cùng một người; `docs/SPEC-007-telegram-account-approval.md` quy định cấp tài khoản qua phiếu Chairman + một BoM nhưng không nêu luật «một người một tài khoản». Không tài liệu nào nói ai bảo đảm một người chỉ có một tài khoản.
- **Phương án:** (a) coi «một người một tài khoản» là luật của việc cấp tài khoản, do quản trị tài khoản và người bỏ phiếu bảo đảm khi duyệt; không thêm mã; (b) thêm một phép kiểm kỹ thuật ở dịch vụ tài khoản (ví dụ một Telegram ID chỉ ghép một tài khoản đang hoạt động); (c) không coi là rủi ro cần xử lý ở giai đoạn này.
- **Ai quyết:** Chairman.
- **Quyết định 15/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối; phiên điều phối chuyển lời):** «(a) Luật cấp tài khoản (Recommended)».
  - Câu hỏi Chairman thấy: «OQ-42 (ngoài lát 3): một người có hai tài khoản thì điều phối chỉ định được tài khoản thứ hai của chính mình, vì luật «không tự chỉ định» chỉ kiểm theo tài khoản. Ai bảo đảm «một người một tài khoản»?»
  - Ba phương án Chairman thấy (nhãn — mô tả):
    - «(a) Luật cấp tài khoản (Recommended)» — «Là luật của việc cấp tài khoản, do quản trị tài khoản và người bỏ phiếu bảo đảm khi duyệt. Không thêm mã.»
    - «(b) Thêm phép kiểm kỹ thuật» — «Thêm một phép kiểm ở dịch vụ tài khoản, ví dụ một Telegram ID chỉ ghép một tài khoản đang hoạt động. Việc này nằm ngoài lát 3, cần kế hoạch riêng.»
    - «(c) Chưa coi là rủi ro» — «Không coi là rủi ro cần xử lý ở giai đoạn này.»
- **Ghi chú của phiên điều phối kèm quyết định (không phải lời Chairman):** OQ-42 (a): lát 3 không thêm mã. Biên nhận `DELIVERY-012` ghi điểm này vào mục giới hạn đã biết: luật không tự chỉ định chỉ chắc trong phạm vi một tài khoản.
- **Hành vi hiện tại (không phải phương án được chọn):** lát 3 không thêm gì về việc này; luật không tự chỉ định chỉ chắc trong phạm vi một tài khoản.

---

**Bổ sung 15/11/2026 sau review bảo mật của Task 7d lát 3** (`docs/reviews/slice-3-evidence-20261115/gates/review-task-7d-security.md`, kết luận bảo mật «Approved»; mã ở `b5d6d21`). Hai mục dưới đây là hai câu hỏi «ai xem được gì» mà các quyết định OQ-39 và OQ-41 chưa phủ. Ghi khi **chưa có quyết định**, do phiên lát 3 chép từ báo cáo review. **Không mục nào chặn task nào của lát 3:** mã đã có một hành vi cho từng trường hợp, nêu ở dòng «Hành vi hiện tại»; đó không phải phương án được chọn.

## OQ-43 — Người được chỉ định có thấy nhãn «người chỉ định không còn là điều phối» ở dòng của chính mình không

- **Lát:** 3 (Task 7d đã có mã; Task 15, 16), pilot.
- **Phía A:** quyết định OQ-39 (c) — «Vẫn hiệu lực, nhưng danh sách và giao diện nêu rõ «người chỉ định không còn là điều phối». Chỉ thêm một cột tính trong hàm liệt kê và một dòng chữ trên giao diện.» — không nói nêu rõ cho ai. Quyết định OQ-40 (c) thì nói rõ người thấy: «điều phối thấy dòng đó được đánh dấu «đang ngủ»».
- **Phía B:** quyết định OQ-41 (c) — «Điều phối thấy đủ. Người đọc khác chỉ thấy ai nhận xét loại tài liệu nào, không thấy chữ căn cứ. Người được chỉ định thấy căn cứ của các dòng của chính mình. Phiên lát 3 đang tạm làm theo hướng này.» Nhãn này cho biết tình trạng vai hiện tại của một người khác (người đã chỉ định). Không tài liệu nào nói người được chỉ định có được biết điều đó ở dòng của mình không.
- **Phương án:** (a) chỉ điều phối thấy nhãn, như hiện nay; (b) người được chỉ định cũng thấy nhãn ở các dòng của chính mình.
- **Ai quyết:** BoM Tech; Chairman nếu muốn quyết luôn.
- **Hành vi hiện tại (không phải phương án được chọn):** trùng (a) — cách đọc chặt của phiên lát 3 (phán quyết S86 của kế hoạch). Đổi sang (b) là một dòng ở hàm liệt kê.

## OQ-44 — Ai được xem danh sách người đang giữ quyền duyệt bản chuẩn của dự án

- **Lát:** 3 (Task 7a, 7d đã có mã; Task 15, 16), pilot.
- **Phía A:** hàm liệt kê người nhận xét của dự án trả kèm một khối «người duyệt» (ai đang giữ quyền duyệt bản chuẩn cho loại tài liệu nào, đọc từ `public.document_approvers`), cho mọi người đọc của dự án theo phán quyết S11. Màn Review cần biết có người duyệt hay chưa để hiện «Chờ xác định người duyệt» (`docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:47`).
- **Phía B:** quyết định OQ-41 (c) giới hạn điều người đọc thường thấy về người nhận xét ở mức «ai nhận xét loại tài liệu nào», không nói gì về người duyệt. Không tài liệu nào nói người đọc thường được thấy tên người giữ quyền duyệt, hay chỉ được biết có/chưa có người duyệt cho một loại tài liệu.
- **Phương án:** (a) mọi người đọc của dự án thấy ai duyệt loại tài liệu nào, như hiện nay (cùng mức với «ai nhận xét loại nào» của OQ-41); (b) chỉ điều phối thấy tên; người đọc khác chỉ biết loại tài liệu nào đã có người duyệt.
- **Ai quyết:** BoM Tech; Chairman nếu muốn quyết luôn.
- **Hành vi hiện tại (không phải phương án được chọn):** trùng (a); khối này chỉ gồm mã người và loại tài liệu, không có chữ căn cứ. Đổi sang (b) là một nhánh lọc ở hàm liệt kê.

---

**Bổ sung 15/11/2026 sau review bảo mật của Task 10 và Task 12 lát 3** (`docs/reviews/slice-3-evidence-20261115/gates/review-task-10-12-security.md`, mục I12-3; mã ở `b69d50a`). Ghi khi **chưa có quyết định**, do phiên lát 3 chép từ báo cáo review. **Không chặn task nào của lát 3:** lát này không có tuyến HTTP nào cho nháp Z4 (phán quyết S24 của kế hoạch), Z4 chưa bật, không có login nào cho role AI. Mục này **chặn việc thêm tuyến đọc nháp và việc bật Z4**.

## OQ-45 — Ai được đọc nội dung một nháp AI, và nháp của dự án IBS HI có được lưu không

- **Lát:** sau lát 3 (trước khi thêm tuyến đọc nháp hoặc bật Z4); mã liên quan ở Task 12.
- **Phía A:** `SuggestionService.list` trả nội dung nháp (`value`, do mô hình viết, có thể chép lại chữ của tin) cho mọi vai đọc của dự án theo phán quyết S11. `submitDraft` lưu nháp của mọi dự án, kể cả dự án ánh xạ `IBS_HI`, vì role AI không có quyền đọc bảng ánh xạ. Lúc xác nhận thì luật chặt đã có: nháp trích tin mà người xác nhận không đọc được chữ, hoặc của dự án `IBS_HI`, bị giữ lại (`DRAFT_HELD`).
- **Phía B:** quyết định OQ-30 (b) và Task 1 của lát 3 đặt luật: chữ của tin Telegram chỉ rời CSDL qua `src/server/source-text.ts`, theo cờ nhóm và ánh xạ dự án **tại lúc đọc**. `AGENTS.md:16`: «IBS HI: pointers, hashes and Tech work metadata only.» Nội dung nháp là một đường thứ hai mang chữ của tin: nó vẫn đọc được sau khi cờ nhóm bị gỡ, sau khi dự án chuyển sang `IBS_HI`, và với người đọc không được xem tin gốc. Không tài liệu nào nói người đọc thường được xem nội dung nháp, hay nháp của dự án `IBS_HI` được lưu.
- **Phương án** (ba điểm, quyết riêng từng điểm):
  1. Ai xem `value`: (a) mọi vai đọc của dự án, như hiện nay; (b) chỉ người có quyền xác nhận nháp đó (vai ghi sổ tài liệu với nháp tài liệu, điều phối dự án với nháp ứng viên).
  2. Xét lại lúc đọc: (a) không xét, như hiện nay; (b) lúc đọc dựng lại ngữ cảnh dưới quyền người đọc và che `value` khi nháp trích tin người đó không đọc được chữ hoặc dự án đang chỉ con trỏ, chỉ trả mã và lý do giữ.
  3. Nháp của dự án `IBS_HI`: (a) vẫn lưu, chỉ chặn lúc xác nhận, như hiện nay; (b) từ chối ngay lúc ghi (cần cấp cho role AI quyền đọc hẹp cờ «chỉ con trỏ», hoặc một thiết kế khác); (c) chỉ lưu mã và hash, không lưu nội dung.
- **Ai quyết:** Chairman (điểm 3 chạm `AGENTS.md:16`); BoM Tech cho điểm 1 và 2 nếu Chairman giao.
- **Hành vi hiện tại (không phải phương án được chọn):** (a) ở cả ba điểm. Không tuyến nào gọi `list`; chỉ test gọi. Ca kiểm «no route imports the suggestion service» giữ điều đó cho tới khi có quyết định.
