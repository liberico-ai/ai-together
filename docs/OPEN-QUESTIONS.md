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
- **Cách hiểu của phiên lát 2, fail-closed; Chairman đã xác nhận ngày 18/11/2026** (lúc viết không phải lời Chairman; phán quyết S13 ở `docs/plans/slice-2-intake-outbox.md`; lời xác nhận ở khối «Xác nhận của Chairman ngày 18/11/2026 về S13 của lát 2», cuối tệp): Chairman vẫn nằm trong danh sách ghế đóng băng như trước. Phiếu đồng ý của Chairman không được tính cho phiếu `access_change`. Phiếu từ chối của Chairman đóng phiếu (`rejected`), vì Chairman là người đề xuất. Không cách hiểu nào trong ba cách trên nói tới phiếu của Chairman.
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
  4. Một điểm lời Chairman chưa phủ mà planner phải xử lý rõ, không tự chọn: người đề xuất đồng thời giữ ghế BoM có được tính phiếu cho chính phiếu mình đề xuất không. Phán quyết S13 của lát 2 (phiếu đồng ý của người đề xuất không tính) vẫn là cách hiểu chờ xác nhận, không phải quyết định. (Cập nhật 18/11/2026: Chairman đã xác nhận S13; xem khối ở cuối tệp.)
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
  3. Điều kèm theo ở trên (phiếu từ chối của Chairman vẫn đóng phiếu do điều phối dự án trình, phiếu đồng ý của Chairman vẫn không tính) đã được phiên điều phối báo Chairman dưới dạng thông tin, không hỏi thành câu riêng. Chairman chưa nói gì về điểm này; giữ nguyên hàm đếm và giữ nó trong danh sách «chờ Chairman xác nhận» cùng S13 của lát 2. **Cập nhật 18/11/2026:** Chairman đã xác nhận cả điểm này lẫn S13; xem khối «Xác nhận của Chairman ngày 18/11/2026 về S13 của lát 2» ở cuối tệp. Hàm đếm không đổi.
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

**Bổ sung 15/11/2026 sau review bảo mật của Task 7d lát 3** (`docs/reviews/slice-3-evidence-20261115/gates/review-task-7d-security.md`, kết luận bảo mật «Approved»; mã ở `b5d6d21`). Hai mục dưới đây là hai câu hỏi «ai xem được gì» mà các quyết định OQ-39 và OQ-41 chưa phủ. Ghi khi **chưa có quyết định**, do phiên lát 3 chép từ báo cáo review. **Không mục nào chặn task nào của lát 3:** mã đã có một hành vi cho từng trường hợp, nêu ở dòng «Hành vi hiện tại»; đó không phải phương án được chọn. **Cập nhật 16/11/2026: Chairman đã quyết cả hai mục — xem dòng «Quyết định» ở từng mục.**

## OQ-43 — Người được chỉ định có thấy nhãn «người chỉ định không còn là điều phối» ở dòng của chính mình không

- **Lát:** 3 (Task 7d đã có mã; Task 15, 16), pilot.
- **Phía A:** quyết định OQ-39 (c) — «Vẫn hiệu lực, nhưng danh sách và giao diện nêu rõ «người chỉ định không còn là điều phối». Chỉ thêm một cột tính trong hàm liệt kê và một dòng chữ trên giao diện.» — không nói nêu rõ cho ai. Quyết định OQ-40 (c) thì nói rõ người thấy: «điều phối thấy dòng đó được đánh dấu «đang ngủ»».
- **Phía B:** quyết định OQ-41 (c) — «Điều phối thấy đủ. Người đọc khác chỉ thấy ai nhận xét loại tài liệu nào, không thấy chữ căn cứ. Người được chỉ định thấy căn cứ của các dòng của chính mình. Phiên lát 3 đang tạm làm theo hướng này.» Nhãn này cho biết tình trạng vai hiện tại của một người khác (người đã chỉ định). Không tài liệu nào nói người được chỉ định có được biết điều đó ở dòng của mình không.
- **Phương án:** (a) chỉ điều phối thấy nhãn, như hiện nay; (b) người được chỉ định cũng thấy nhãn ở các dòng của chính mình.
- **Ai quyết:** BoM Tech; Chairman nếu muốn quyết luôn.
- **Quyết định 16/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối; phiên điều phối chuyển lời):** «(a) Chỉ điều phối thấy (Recommended)».
  - Câu hỏi Chairman thấy: «OQ-43 (lát 3): người được chỉ định làm người nhận xét có thấy nhãn «người chỉ định không còn là điều phối» ở dòng của chính mình không? Quyết định OQ-39 (c) không nói nêu rõ cho ai. Hồ sơ ghi câu này thuộc BoM Tech, Chairman quyết luôn nếu muốn.»
  - Hai phương án Chairman thấy (nhãn — mô tả):
    - «(a) Chỉ điều phối thấy (Recommended)» — «Chỉ điều phối thấy nhãn, như hiện nay. Nhãn cho biết tình trạng vai hiện tại của một người khác. Không sửa gì.»
    - «(b) Đương sự cũng thấy» — «Người được chỉ định cũng thấy nhãn ở các dòng của chính mình. Đổi một dòng ở hàm liệt kê; PR #12 của lát 3 đã mở nên sẽ thêm một commit sửa vào PR.»
- **Ghi chú của phiên điều phối kèm quyết định (không phải lời Chairman):** trường «Ai quyết» của mục này ghi BoM Tech; lần này Chairman tự chốt. Quyết định trùng hành vi hiện có nên không đổi mã, chỉ sửa hồ sơ.
- **Áp vào lát 3:** không đổi mã. Hàm liệt kê của `DelegationService` chỉ trả nhãn này cho điều phối của dự án; cách đọc chặt của phiên lát 3 (phán quyết S86 của kế hoạch) nay là quyết định của Chairman.
- **Hành vi hiện tại:** trùng (a), nay là phương án Chairman chọn. Đổi sang (b) là một dòng ở hàm liệt kê.

## OQ-44 — Ai được xem danh sách người đang giữ quyền duyệt bản chuẩn của dự án

- **Lát:** 3 (Task 7a, 7d đã có mã; Task 15, 16), pilot.
- **Phía A:** hàm liệt kê người nhận xét của dự án trả kèm một khối «người duyệt» (ai đang giữ quyền duyệt bản chuẩn cho loại tài liệu nào, đọc từ `public.document_approvers`), cho mọi người đọc của dự án theo phán quyết S11. Màn Review cần biết có người duyệt hay chưa để hiện «Chờ xác định người duyệt» (`docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:47`).
- **Phía B:** quyết định OQ-41 (c) giới hạn điều người đọc thường thấy về người nhận xét ở mức «ai nhận xét loại tài liệu nào», không nói gì về người duyệt. Không tài liệu nào nói người đọc thường được thấy tên người giữ quyền duyệt, hay chỉ được biết có/chưa có người duyệt cho một loại tài liệu.
- **Phương án:** (a) mọi người đọc của dự án thấy ai duyệt loại tài liệu nào, như hiện nay (cùng mức với «ai nhận xét loại nào» của OQ-41); (b) chỉ điều phối thấy tên; người đọc khác chỉ biết loại tài liệu nào đã có người duyệt.
- **Ai quyết:** BoM Tech; Chairman nếu muốn quyết luôn.
- **Quyết định 16/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối; phiên điều phối chuyển lời):** «(a) Mọi người đọc dự án (Recommended)».
  - Câu hỏi Chairman thấy: «OQ-44 (lát 3): ai được xem danh sách người đang giữ quyền duyệt bản chuẩn của dự án? Quyết định OQ-41 (c) chỉ nói về người nhận xét. Hồ sơ ghi câu này thuộc BoM Tech, Chairman quyết luôn nếu muốn.»
  - Hai phương án Chairman thấy (nhãn — mô tả):
    - «(a) Mọi người đọc dự án (Recommended)» — «Mọi người đọc của dự án thấy ai duyệt loại tài liệu nào, như hiện nay; cùng mức với «ai nhận xét loại nào» của OQ-41. Khối này chỉ gồm mã người và loại tài liệu, không có chữ căn cứ. Không sửa gì.»
    - «(b) Chỉ điều phối thấy tên» — «Chỉ điều phối thấy tên; người đọc khác chỉ biết loại tài liệu nào đã có người duyệt. Thêm một nhánh lọc ở hàm liệt kê; PR #12 của lát 3 đã mở nên sẽ thêm một commit sửa vào PR.»
- **Ghi chú của phiên điều phối kèm quyết định (không phải lời Chairman):** trường «Ai quyết» của mục này ghi BoM Tech; lần này Chairman tự chốt. Quyết định trùng hành vi hiện có nên không đổi mã, chỉ sửa hồ sơ.
- **Áp vào lát 3:** không đổi mã. Hàm liệt kê trả khối «người duyệt» (mã người và loại tài liệu) cho mọi người đọc của dự án.
- **Hành vi hiện tại:** trùng (a), nay là phương án Chairman chọn; khối này chỉ gồm mã người và loại tài liệu, không có chữ căn cứ. Đổi sang (b) là một nhánh lọc ở hàm liệt kê.

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
- **Hành vi hiện tại (không phải phương án được chọn):** (a) ở cả ba điểm. Không tuyến nào gọi `list`; chỉ test gọi. Ca kiểm «no route imports the suggestion service» giữ điều đó cho tới khi có quyết định. **Quyết định 18/11/2026 (Chairman):** (b) ở cả ba điểm; lời Chairman và phần đối chiếu ở khối «Quyết định của Chairman ngày 18/11/2026 về OQ-45 và OQ-46», cuối tệp. Mã cho quyết định này đã được viết trên nhánh `feat/oq-45-46-ai-drafts` (biên nhận `docs/DELIVERY-015-ai-drafts-read-and-stale-20261118.md`, nơi ghi riêng từng mức): chưa merge, chưa triển khai, Z4 chưa bật. Cho tới khi nhánh đó được merge, hành vi ở `libetech-ai-os` vẫn như dòng này tả. Trên nhánh đó ca kiểm canh «no route imports the suggestion service» vẫn giữ: không tuyến nào đọc nháp.

---

**Bổ sung 15/11/2026 sau lượt quét lớp lỗi của reviewer mã tầng 1** (`docs/reviews/slice-3-evidence-20261115/gates/tier1-code.md`, mục «Class sweep before the gate's last run», điểm C1-1; mã ở `c363992`). Ghi khi **chưa có quyết định**, do phiên lát 3 chép từ báo cáo review. **Không chặn task nào của lát 3** (không tuyến HTTP nào cho nháp, Z4 chưa bật, không mô hình nào chạy). Cùng với OQ-45, mục này **chặn việc bật Z4**.

## OQ-46 — Nháp AI dựng trên đầu vào đã cũ có được xác nhận không

- **Lát:** sau lát 3 (trước khi bật Z4); mã liên quan ở Task 12.
- **Phía A:** lúc xác nhận, dịch vụ dựng lại ngữ cảnh dưới quyền người xác nhận và chạy cổng kiểm đầu ra: nháp bị giữ khi nguồn nó nêu không còn trong ngữ cảnh, chữ của tin đã bị ẩn, manifest đã đổi, hash giá trị lệch, hay dự án chỉ con trỏ. Với nháp tài liệu, người xác nhận còn phải gửi `expectedVersion` của tài liệu, nên **người** không thao tác trên bản cũ. Mỗi nháp lưu `input_hash` do pipeline khai, nhưng không tài liệu nào định nghĩa nó băm cái gì, và dịch vụ không so nó với gì.
- **Phía B:** mục tiêu của lát (`docs/SLICE-BRIEFS.md:157`): «nguồn đổi giữa chừng thì trả xung đột». Một nháp `doc_reviewer` phân tích bản r3; có người trình bản r4; nháp vẫn xác nhận được, vì các bản cũ vẫn nằm trong ngữ cảnh. Một nháp phân tích tin vẫn xác nhận được sau khi luồng có thêm tin đính chính. SPEC không nói nháp «cũ» nghĩa là gì và ai chịu trách nhiệm nhận ra điều đó.
- **Phương án:**
  - (a) Không kiểm thêm, như hiện nay: người xác nhận tự chịu trách nhiệm; giao diện sau này nêu rõ nháp dựng lúc nào và trên bản nào.
  - (b) Giữ nháp khi **đối tượng của chính nó** đã đổi: tài liệu có bản mới hơn sau lúc nháp được ghi; luồng của ứng viên có tin hoặc bản sửa mới sau lúc đó. Phải định nghĩa «sau» theo mốc nào (thời điểm ghi, hay bản mới nhất mà nháp nêu).
  - (c) Giữ nháp khi **ngữ cảnh dựng lại không còn y hệt**: định nghĩa `input_hash` là hash của toàn bộ ngữ cảnh và so lúc xác nhận. Chặt nhất; hệ quả là mọi thay đổi trong dự án (kể cả đăng ký một tài liệu không liên quan) làm mọi nháp đang chờ của dự án hết hiệu lực.
- **Ai quyết:** BoM Tech; Chairman nếu muốn quyết luôn (cùng lúc với OQ-14 và OQ-45).
- **Hành vi hiện tại (không phải phương án được chọn):** trùng (a). `input_hash` được lưu và, từ vòng sửa cuối của lát 3, được so khi cùng một khoá khử trùng gửi lại; nó chưa được so lúc xác nhận. **Quyết định 18/11/2026 (Chairman):** (b), mốc là bản mới nhất nháp nêu; lời Chairman ở khối «Quyết định của Chairman ngày 18/11/2026 về OQ-45 và OQ-46», cuối tệp. Mã cho quyết định này đã được viết trên nhánh `feat/oq-45-46-ai-drafts` (biên nhận `docs/DELIVERY-015-ai-drafts-read-and-stale-20261118.md`, nơi ghi riêng từng mức): chưa merge, chưa triển khai, Z4 chưa bật. Cho tới khi nhánh đó được merge, hành vi ở `libetech-ai-os` vẫn như dòng này tả. Trên nhánh đó, phần «luồng của ứng viên» của quyết định còn chịu một giữ chỗ: mọi lệnh xác nhận nháp ứng viên bị giữ cho tới khi điểm 3 của OQ-53 được quyết. **Cập nhật 19/11/2026:** Chairman đã quyết điểm 3 ((b), làm trong một PR riêng) và nói giữ hành vi chặt tới khi PR đó merge; giữ chỗ này vì thế ở lại cho tới lúc đó (khối «Quyết định của Chairman ngày 19/11/2026 về OQ-53 đến OQ-56», cuối tệp).

## OQ-47 — Phiếu 3/3 vừa đóng có giữ chỗ trên màn Quyết định không

- **Lát:** sau lát 3; nêu ra khi sửa mục 44 của `docs/DELIVERY-012-review-skills-20261115.md` (PR #14, nhánh `fix/decision-cards-cut`, biên nhận `docs/DELIVERY-014-decision-cards-cut-20261116.md`). Phiên làm PR coi mục này không chặn PR đó (PR chỉ đưa phiếu còn bỏ phiếu được lên trước trần, theo đề bài; thứ tự của phiếu đã đóng giữ nguyên như trước, theo thời điểm tạo). **Cổng Codex vòng 1 của PR #14 (16/11/2026) nêu đúng tình huống này thành finding P2, dòng đầu `VERDICT: CHANGES_REQUIRED`**, căn cứ dòng «Bỏ phiếu thành công: thẻ chuyển trạng thái» của bàn giao giao diện; phiên không tự chọn phương án và dừng ở đó.
- **Phía A (mã lúc nêu câu hỏi, head `9ec08fd`):** màn Quyết định hiện tối đa 30 thẻ 3/3. Từ PR nói trên, phiếu còn bỏ phiếu được (lưu `pending`, chưa quá hạn) đứng trước; các phiếu còn lại theo sau, mới tạo trước (`src/server/bom.ts`, hàm `pending`). Nhờ vậy người giữ ghế bỏ phiếu được cho một phiếu cũ mà trước đây web không hiện.
- **Phía B:** phản hồi duy nhất sau khi bỏ phiếu là thẻ được đọc lại (`docs/UI-HANDOFF-3-decisions.md`, mục «Kiểm tay»: «Bỏ phiếu thành công: thẻ chuyển trạng thái; sau 3/3 thẻ đọc «Đã áp dụng · biên nhận …»»). Một phiếu cũ vừa đóng (lá «Từ chối», «Yêu cầu sửa», hoặc lá «Đồng ý» thứ ba) trở về chỗ của nó theo thời điểm tạo; nếu dự án có đủ phiếu mới hơn để lấp các chỗ còn lại, thẻ rời danh sách ngay ở lần đọc lại. Người vừa bỏ phiếu chỉ thấy câu «Danh sách dài hơn phần đang hiện.», không thấy kết quả của phiếu mình. Reviewer mã tầng 1 dựng lại được tình huống này bằng chính dịch vụ của repo (một phiếu còn mở cũ hơn 31 phiếu đã đóng). SPEC không nêu thứ tự của danh sách thẻ, cũng không nêu phiếu vừa đóng có được ưu tiên hay không (`docs/SPEC-008-PM-operating-loop-20261111.md:218`, `docs/DESIGN-SYSTEM-PM-DOCUMENTS.md:68-72` chỉ nêu nội dung một thẻ).
- **Phương án:**
  - (a) Giữ như hiện nay: phiếu đã đóng xếp theo thời điểm tạo; thẻ vừa đóng có thể rời danh sách; câu «đã cắt» là dấu hiệu duy nhất. Biên nhận và phân công vẫn được ghi đúng; người dùng xem kết quả ở hồ sơ BoM của đầu việc.
  - (b) Xếp phiếu đã đóng theo thời điểm đóng (`finished_at`), mới đóng trước: thẻ vừa đóng luôn đứng ngay sau các phiếu còn bỏ phiếu được. Đổi thứ tự của mọi phiếu đã đóng; phiếu quá hạn chưa ai đóng không có `finished_at` nên phải định chỗ riêng.
  - (c) Giữ thứ tự, thêm một dòng xác nhận tại chỗ khi phiếu đã ghi mà thẻ không còn trong danh sách (câu chữ do người có thẩm quyền đặt).
  - (d) Bỏ trần: phân trang danh sách thẻ 3/3, hoặc tách «đang chờ» và «đã đóng» thành hai danh sách. Việc lớn hơn; gần với hàng chờ của `docs/SPEC-004-bom-tech-phan-cong.md` P1-01.
- **Ai quyết:** BoM Tech; Chairman nếu muốn quyết luôn.
- **Hành vi trước quyết định (không phải phương án được chọn):** trùng (a). Tình huống chỉ xảy ra khi số phiếu không còn bỏ phiếu được và mới hơn phiếu đó đủ lấp các chỗ còn lại của 30 (ví dụ một phiếu còn mở duy nhất cùng 30 phiếu đã đóng mới hơn).
- **Quyết định của Chairman ngày 16/11/2026: phương án (b).** Lần này Chairman tự chốt. Chọn qua hộp chọn ở phiên điều phối, sau Codex vòng 1 của PR #14; phiên điều phối chuyển lời, chép nguyên dưới đây.
  - Câu hỏi Chairman thấy: «OQ-47 (PR #14, thẻ 3/3): Codex nêu một finding P2 — một phiếu cũ vừa đóng (do lá «Từ chối» hoặc lá «Đồng ý» thứ ba) trở về chỗ theo thời điểm tạo và có thể rời danh sách 30 thẻ ngay lần tải lại, nên người vừa bỏ phiếu không thấy kết quả. Phiếu đã đóng trên màn Quyết định xếp thế nào?»
  - Phương án Chairman thấy (nhãn — mô tả):
    - «(b) Xếp theo lúc đóng (Recommended)» — «Xếp phiếu đã đóng theo thời điểm đóng, mới đóng trước: thẻ vừa đóng luôn đứng ngay sau các phiếu còn bỏ phiếu được. Đổi thứ tự của mọi phiếu đã đóng; phiếu quá hạn chưa ai đóng phải định chỗ riêng. Một vòng sửa và một lượt Codex nữa.»
    - «(a) Giữ như hiện nay» — «Phiếu đã đóng xếp theo thời điểm tạo; thẻ vừa đóng có thể rời danh sách, câu «đã cắt» là dấu hiệu duy nhất. Biên nhận và phân công vẫn ghi đúng; người dùng xem kết quả ở hồ sơ BoM của đầu việc. Finding P2 của Codex để mở.»
    - «(c) Thêm dòng xác nhận» — «Giữ thứ tự, thêm một dòng xác nhận tại chỗ khi phiếu đã ghi mà thẻ không còn trong danh sách. Câu chữ do người có thẩm quyền đặt.»
    - «(d) Bỏ trần, phân trang» — «Phân trang danh sách thẻ 3/3, hoặc tách «đang chờ» và «đã đóng» thành hai danh sách. Việc lớn hơn phạm vi PR nhỏ này.»
  - Chairman trả lời: «(b) Xếp theo lúc đóng (Recommended)».
  - Cùng ngày, ở hộp bước tiếp của phiên làm PR #14, câu hỏi «Mục P2 của Codex (OQ-47): sửa để thẻ vừa đóng còn hiện, hay giữ nguyên?» với hai nút «Sửa theo (b)» và «Giữ nguyên» nhận câu trả lời «Sửa theo (b)». Trong tin báo cáo ngay trên hộp đó, phiên đã viết: «Phương án (b) của OQ-47, mà nút «Sửa theo (b)» nhắc tới, là xếp phiếu đã đóng theo thời điểm đóng: một mệnh đề `ORDER BY` trong `pending()` và một lượt chạy cổng nữa. Đây là ước lượng của tôi, chưa làm.» Hai câu trả lời trùng nhau.
  - Phiên hiểu đây là lời cho **một** vòng sửa đúng theo phương án (b) như viết ở trên và **một** lượt chạy cổng Codex thêm.
  - **Phần Chairman không quyết, là phán quyết của phiên (không phải quyết định của Chairman):** chỗ của phiếu quá hạn mà chưa ai đóng (không có `finished_at`); mô tả Chairman chọn chỉ nói nó «phải định chỗ riêng». Phiên xếp nó theo `expires_at`, xen giữa các phiếu đã đóng theo thời gian: sau nhóm còn bỏ phiếu được, phiếu đã đóng xếp theo lúc đóng, phiếu quá hạn chưa đóng theo lúc quá hạn, mới nhất trước. Hệ quả: một phiếu quá hạn sau lúc một thẻ khác đóng sẽ đứng trên thẻ đó; một phiếu được đóng sau khi quá hạn xếp theo lúc đóng. Nếu sai: một nhánh của `CASE` trong `ORDER BY` của `src/server/bom.ts`, hàm `pending`. Chi tiết và các hệ quả khác: `docs/DELIVERY-014-decision-cards-cut-20261116.md`, phán quyết 2 và 3.
  - Còn lại sau khi sửa: trần vẫn 30. Khi dự án có từ 30 phiếu còn bỏ phiếu được trở lên thì không phiếu đã đóng nào hiện, kể cả phiếu vừa đóng; câu «đã cắt» có hiện.

---

**Bổ sung 16/11/2026 khi lập kế hoạch PR riêng «Task 7c + bước 16b»** (`docs/plans/task-7c-coordinator-proposal.md`, bản 0.1 rồi bản 0.2, base `0560a4f`; bản 0.1 lập khi base còn là `08322d3`, hai base chỉ khác nhau ở ba tệp tài liệu của PR #13). Số bắt đầu từ OQ-48 vì OQ-47 thuộc PR #14 (câu hỏi «Phiếu 3/3 vừa đóng có giữ chỗ trên màn Quyết định không»). Năm mục dưới đây là các điểm «ai được làm gì» và «ai xem được gì» mà các quyết định OQ-33, OQ-35, OQ-36, OQ-37 và OQ-38 chưa phủ, do agent `planner` lập. OQ-48, OQ-49 và OQ-50 ghi lúc lập bản 0.1, khi chưa có quyết định; Chairman đã quyết cả ba ngày 16/11/2026, quyết định ghi trong từng mục. OQ-51 và OQ-52 ghi lúc lập bản 0.2, từ hai câu hỏi QB và QC của cổng bảo mật lượt 1 (`docs/reviews/task-7c-evidence-20261116/gates/security-gate-plan-round-1.md:117-118`), và **chưa có quyết định**. Tệp cổng đó soát bản 0.1 nên dùng số cũ: OQ-47, OQ-48, OQ-49 của nó nay là OQ-48, OQ-49, OQ-50. **Không mục nào chặn PR:** hai mục còn mở có hành vi nêu ở dòng «Trạng thái lúc lập kế hoạch»; đó không phải phương án được chọn.

**Bổ sung thứ hai 16/11/2026, sau khi nhánh rebase lên `679ff6c`** (ghi của phiên Task 7c, không phải lời Chairman): Chairman đã quyết OQ-51, OQ-52 và cách tính giờ của khoảng chờ ở OQ-48 (điểm A của phiên Task 7c) cùng ngày, qua hộp chọn ở phiên điều phối; câu hỏi, mọi phương án Chairman thấy và câu trả lời chép nguyên ở cuối từng mục. Ba câu trả lời trùng hành vi kế hoạch đã có, nên kế hoạch bản 0.4 chỉ đổi hồ sơ. Đoạn trên («chưa có quyết định», «hai mục còn mở») là trạng thái lúc lập bản 0.2, giữ nguyên.

## OQ-48 — Phiếu do điều phối dự án trình bị rút hoặc bị huỷ: người trình có được trình lại ngay cho cùng người không

- **Lát:** PR riêng «Task 7c + bước 16b» sau lát 3 (Task 1 và Task 2 của `docs/plans/task-7c-coordinator-proposal.md`), pilot.
- **Phía A:** quyết định OQ-36 (b) cùng (d) (`docs/OPEN-QUESTIONS.md:503-506`) — «Người trình rút được phiếu của chính mình, kèm căn cứ. Quản trị tài khoản huỷ được phiếu bằng một lệnh riêng, kèm căn cứ, không đổi phiên bản tài khoản và không đụng phiên đăng nhập của thành viên.» Lý do planner nêu cho việc rút (`docs/OPEN-QUESTIONS.md:502`, không phải quyết định): người trình sửa được lỗi của chính mình — trình nhầm người hoặc nhầm loại — mà không chờ 48 giờ. Rút xong mà chưa trình lại được cho cùng người thì lỗi «nhầm loại tài liệu» chưa sửa được ngay.
- **Phía B:** cổng bảo mật trên kế hoạch cũ, mục M2 (`docs/reviews/slice-3-evidence-20261115/gates/security-gate-task-7c-plan.md:29`): phiếu vừa đóng thì người trình mở lại được ngay, nên một điều phối bất cẩn hoặc có ý xấu giữ được việc đổi quyền của một thành viên luôn ở thế tranh chấp; mục S6 (`:49`) đề nghị một khoảng chờ theo cặp (người trình, người được cấp). Phán quyết S78 của kế hoạch lát 3 (`docs/plans/slice-3-review-skills.md:221`) đặt «mỗi cặp một phiếu trong 24 giờ, trừ khi phiếu trước đã được áp»; ghi chú của phiên điều phối kèm OQ-36 (`docs/OPEN-QUESTIONS.md:510`) nêu rõ đó là phán quyết của planner, không phải quyết định. Không tài liệu nào nói: tự rút xong có được trình lại ngay không; bị quản trị tài khoản huỷ thì có phải chờ không; khoảng chờ có áp cho phiếu bị BoM từ chối hoặc hết hạn không.
- **Phương án:** (a) giữ khoảng chờ 24 giờ theo cặp cho mọi phiếu chưa được áp — bị rút, bị huỷ, bị từ chối hay hết hạn; (b) tự rút thì trình lại được ngay (vẫn chịu trần 10 lần trình mỗi giờ của mỗi người trình); bị quản trị tài khoản huỷ hoặc bị từ chối thì chờ 24 giờ; (c) bỏ khoảng chờ theo cặp sau cả rút lẫn huỷ, chỉ còn trần 10 lần mỗi giờ; (d) sau khi bị quản trị tài khoản huỷ, người trình không trình lại được cho người đó tới khi quản trị tài khoản cho phép — cần thêm chỗ lưu, ngoài phạm vi PR này.
- **Điều kèm theo để Chairman biết:** khoảng chờ tính từ lúc **mở** phiếu trước, không từ lúc rút hay huỷ. Trong lúc chờ, quản trị tài khoản vẫn trình được cho người đó theo đường có sẵn. Khoảng chờ sau khi phiếu bị BoM từ chối hoặc hết hạn là chặn lạm dụng do planner đặt theo mục S6 của cổng bảo mật; Chairman quyết luôn phần đó nếu muốn.
- **Ai quyết:** Chairman.
- **Khuyến nghị của planner (không phải quyết định):** (b) — rút là người trình tự sửa lỗi của mình, chờ 24 giờ làm mất đúng lợi ích của quyết định OQ-36 (b); còn huỷ là lời «không» của người có thẩm quyền, nên giữ khoảng chờ.
- **Quyết định 16/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối; phiên điều phối chuyển lời):** «(b) Tự rút thì trình lại ngay (Recommended)».
  - Câu hỏi Chairman thấy: «OQ-48 (Task 7c): phiếu do điều phối dự án trình bị rút hoặc bị huỷ thì người trình có được trình lại ngay cho cùng người không? Kế hoạch đang giữ chỗ theo (a). Khoảng chờ tính từ lúc mở phiếu trước; trong lúc chờ, quản trị tài khoản vẫn trình được theo đường có sẵn.»
  - Bốn phương án Chairman thấy (nhãn — mô tả):
    - «(b) Tự rút thì trình lại ngay (Recommended)» — «Tự rút thì trình lại được ngay, vẫn chịu trần 10 lần trình mỗi giờ của mỗi người trình. Bị quản trị tài khoản huỷ hoặc bị từ chối thì chờ 24 giờ.»
    - «(a) Chờ 24 giờ mọi trường hợp» — «Giữ khoảng chờ 24 giờ theo cặp (người trình, người được cấp) cho mọi phiếu chưa được áp: bị rút, bị huỷ, bị từ chối hay hết hạn.»
    - «(c) Bỏ khoảng chờ theo cặp» — «Bỏ khoảng chờ theo cặp sau cả rút lẫn huỷ; chỉ còn trần 10 lần trình mỗi giờ.»
    - «(d) Huỷ rồi thì chờ cho phép» — «Sau khi bị quản trị tài khoản huỷ, người trình không trình lại được cho người đó tới khi quản trị tài khoản cho phép. Cần thêm chỗ lưu, ngoài phạm vi PR này.»
- **Ghi chú của phiên điều phối kèm quyết định (không phải lời Chairman; chép nguyên, giữ số thứ tự trong tin của phiên điều phối ngày 16/11/2026):**
  - 1. OQ-48 (b) thay giữ chỗ (a): tự rút thì không tính khoảng chờ theo cặp; bị quản trị tài khoản huỷ hoặc bị từ chối thì chờ 24 giờ; trần 10 lần trình mỗi giờ giữ nguyên. Mô tả Chairman chọn không nói tới phiếu **hết hạn**: giữ khoảng chờ 24 giờ cho trường hợp đó như giữ chỗ hiện có, ghi là phán quyết của phiên.
  - 4. Hai chỗ kế hoạch đổi so với bản cổng bảo mật đang xem (OQ-48 và OQ-50): cho cổng xem lại đúng hai phần đó trước khi `builder` viết mã của chúng.
  - 5. Câu hỏi mới sau này đánh số từ OQ-51.
- **Cách hiểu của phiên Task 7c, fail-closed — Chairman đã quyết đúng như vậy ngày 16/11/2026, xem khối «Quyết định thứ hai 16/11/2026» ở cuối mục này** (không phải lời Chairman; điểm A của phiên Task 7c, chép nguyên): **OQ-48 (b), khoảng chờ 24 giờ tính từ lúc nào.** Câu hỏi Chairman thấy mô tả giữ chỗ lúc đó («Khoảng chờ tính từ lúc mở phiếu trước»); mô tả phương án (b) Chairman chọn chỉ ghi «Bị quản trị tài khoản huỷ hoặc bị từ chối thì chờ 24 giờ», không nói từ lúc nào. Cổng bảo mật lượt 1 (mục N1, phần 1) chỉ ra: tính từ lúc **mở** thì một phiếu bị huỷ hoặc bị từ chối sau giờ thứ 24 của nó cho người trình mở lại ngay, tức câu «thì chờ 24 giờ» không còn nghĩa trong đúng các trường hợp đó. **Cách hiểu của phiên Task 7c, fail-closed, chờ Chairman xác nhận:** 24 giờ tính từ lúc phiếu trước **đóng** (lúc bị huỷ, bị từ chối, hoặc hết hạn). Ghi cách hiểu này dưới OQ-48 đúng nhãn «chờ Chairman xác nhận»; không mở số OQ mới cho nó.
- **Phán quyết của phiên Task 7c** (không phải lời Chairman; điểm B và C của phiên Task 7c, chép nguyên):
  - B. **Phần 2 của N1 (sau khi quản trị huỷ thì từ chối cặp đó «cho tới khi OQ có quyết định») hết hiệu lực:** nay đã có quyết định (b) — bị quản trị huỷ thì chờ 24 giờ. Không còn chặn vô thời hạn; không cần đọc sự kiện để chặn vĩnh viễn. Vẫn cần phân biệt «tự rút» (không chờ) với «bị huỷ / bị từ chối / hết hạn» (chờ 24 giờ từ lúc đóng): cả rút lẫn huỷ đều để trạng thái `expired`, nên phải đọc sự kiện `access_change_withdrawn` (hoặc cách tương đương) để nhận ra phiếu tự rút.
  - C. **Phiếu hết hạn tự nhiên, và phiếu đóng vì phiên bản tài khoản đổi:** mô tả Chairman chọn không nói tới. Phán quyết của phiên (theo ghi chú 1 của phiên điều phối): giữ khoảng chờ 24 giờ từ lúc đóng, như bị từ chối. **Bổ sung của phiên Task 7c ngày 16/11/2026, sau cổng bảo mật lượt 2 (mục R11) — lời của phiên, không thuộc phần chép nguyên ở trên; kế hoạch bản 0.3, T7C-19:** với phiếu chết vì phiên bản tài khoản đổi, «lúc đóng» chỉ có khi phiếu đã được đánh dấu. Một phiếu còn `pending` hoặc `approved` mà đã chết vì tài khoản của người được cấp đổi, và chưa ai đánh dấu, chặn cặp (người trình, người được cấp) đó tới 24 giờ sau hạn của phiếu, tức có thể tới 72 giờ kể từ lúc phiếu mở — chặt hơn «24 giờ từ lúc đóng». Phiếu đó được đánh dấu khi một ghế bỏ phiếu trên nó, hoặc khi quản trị tài khoản hay một điều phối khác trình cho người đó; từ lúc ấy 24 giờ tính từ lúc đánh dấu. Người trình không rút được phiếu đó (cổng lượt 2, mục N3). Phiên chọn nêu rõ trần này thay vì đổi thứ tự hai bước trong lệnh trình. Đường trình của quản trị tài khoản không bị ảnh hưởng. Câu `RATE_LIMITED` của khoảng chờ theo cặp được viết lại để đúng cả trong trường hợp này.
    - **Ghi thêm ngày 16/11/2026 (lời của phiên Task 7c, không phải lời Chairman):** mô tả phương án Chairman chọn ở khối «Quyết định thứ hai 16/11/2026» (cuối mục này) nêu trường hợp tới 72 giờ của điểm C: «Trường hợp chặt hơn: phiếu chết vì tài khoản người được cấp đổi mà chưa ai đánh dấu thì chặn cặp đó tới 24 giờ sau hạn, có thể tới 72 giờ kể từ lúc mở.» Cùng mô tả đó ghi phiếu hết hạn là phán quyết của phiên: «(phiếu hết hạn cũng chờ 24 giờ — phán quyết của phiên)». Ghi chú này không đổi nhãn của điểm C.
- **Áp vào PR «Task 7c + bước 16b» (kế hoạch bản 0.2):** phiếu trước của cặp (người trình, người được cấp) do chính người trình **rút** không tính khoảng chờ theo cặp; trần 10 lần trình mỗi giờ của mỗi người trình giữ nguyên. Phiếu trước bị quản trị tài khoản **huỷ** hoặc bị **từ chối** làm đường của điều phối trả `RATE_LIMITED` cho cặp đó trong 24 giờ. Phiếu tự rút được nhận ra bằng sự kiện `access_change_withdrawn` mang mã phiếu. Đường trình của quản trị tài khoản không bị ảnh hưởng. Phương án (d) không được chọn, nên không có việc chặn tới khi quản trị cho phép. Cổng bảo mật lượt 1 (`docs/reviews/task-7c-evidence-20261116/gates/security-gate-plan-round-1.md:20-38`, mục N1, và `:116`, mục QA; tệp đó gọi mục này là OQ-47) nêu câu hỏi «khoảng chờ tính từ lúc mở hay lúc đóng»: lời Chairman không nói điểm đó; cách hiểu của phiên Task 7c ghi ở dòng trên, đúng nhãn chờ xác nhận.
- **Trạng thái lúc lập kế hoạch (trước quyết định; kế hoạch bản 0.1):** chưa quyết. Kế hoạch đặt **hành vi giữ chỗ fail-closed, không phải phương án được chọn**: trùng (a) — người trình không mở được phiếu mới cho cùng người trong 24 giờ kể từ lúc mở phiếu trước, trừ khi phiếu trước đã được áp; câu trả lời là `RATE_LIMITED`. Phần bị chặn: chỉ việc trình lại của đúng cặp đó; trình cho người khác và đường của quản trị tài khoản không bị ảnh hưởng. Đổi sang (b) hoặc (c) là một điều kiện trong câu đọc khoảng chờ (đọc thêm sự kiện rút, huỷ) và các ca kiểm tương ứng.
- **Quyết định thứ hai 16/11/2026, cách tính giờ của khoảng chờ (Chairman, chọn qua hộp chọn ở phiên điều phối, sau khi nhánh rebase lên `679ff6c`; phiên điều phối chuyển lời):** «Từ lúc phiếu đóng (Recommended)».
  - Câu hỏi Chairman thấy: «OQ-48 (Task 7c): anh đã chọn (b) — phiếu của điều phối dự án bị quản trị tài khoản huỷ hoặc bị BoM từ chối thì người trình chờ 24 giờ mới trình lại cho cùng người. 24 giờ đó tính từ lúc nào? Câu hỏi lúc trước ghi «tính từ lúc mở phiếu trước»; phiên Task 7c đang tạm tính từ lúc đóng.»
  - Hai phương án Chairman thấy (nhãn — mô tả):
    - «Từ lúc phiếu đóng (Recommended)» — «Tính từ lúc phiếu bị huỷ, bị từ chối hoặc hết hạn (phiếu hết hạn cũng chờ 24 giờ — phán quyết của phiên). Trường hợp chặt hơn: phiếu chết vì tài khoản người được cấp đổi mà chưa ai đánh dấu thì chặn cặp đó tới 24 giờ sau hạn, có thể tới 72 giờ kể từ lúc mở.»
    - «Từ lúc mở phiếu trước» — «Đúng chữ câu hỏi lúc trước. Hệ quả: phiếu bị huỷ hoặc bị từ chối sau giờ thứ 24 của nó thì người trình mở lại được ngay, nên «chờ 24 giờ» không còn tác dụng trong trường hợp đó.»
- **Ghi chú của phiên điều phối kèm quyết định thứ hai (không phải lời Chairman; chép nguyên, giữ số thứ tự trong tin thứ hai của phiên điều phối ngày 16/11/2026; ghi chú 2 của tin đó chép ở mục OQ-51):**
  - 1. Ba câu trả lời trùng hành vi kế hoạch đang có, nên không có mã nào phải đổi. Việc còn lại là hồ sơ: dưới OQ-48 đổi nhãn «chờ Chairman xác nhận» của điểm A thành quyết định, và ghi rằng mô tả phương án Chairman chọn có nêu trường hợp tới 72 giờ của điểm C; dưới OQ-51 và OQ-52 thêm dòng quyết định, chép nguyên như trên; đổi các chữ «giữ chỗ» liên quan trong kế hoạch và biên nhận thành «quyết định».
  - 3. Hồ sơ commit trước lượt chạy cổng Codex của Task 7c, để cổng xem đúng các dòng quyết định.
  - 4. Câu hỏi mới sau này đánh số từ OQ-53.
- **Áp vào PR «Task 7c + bước 16b» (kế hoạch bản 0.4, chỉ hồ sơ):** không đổi hành vi, mã lỗi, câu chữ, ca kiểm hay ranh giới task. Khoảng chờ 24 giờ tính từ lúc phiếu trước đóng — ở bản 0.2 và 0.3 là cách hiểu A của phiên, chờ xác nhận — nay là quyết định của Chairman. Phiếu hết hạn và phiếu chết vì tài khoản đổi vẫn theo điểm C; mô tả phương án Chairman chọn nêu cả hai trường hợp (dòng «Ghi thêm ngày 16/11/2026» dưới điểm C). Các dòng «Cách hiểu», «Phán quyết», «Áp vào PR (kế hoạch bản 0.2)» ở trên giữ nguyên làm hồ sơ.

## OQ-49 — Lệnh huỷ phiếu của quản trị tài khoản áp cho những phiếu đổi quyền nào

- **Lát:** PR riêng «Task 7c + bước 16b» sau lát 3 (Task 2 và Task 3 của `docs/plans/task-7c-coordinator-proposal.md`), pilot.
- **Phía A:** quyết định OQ-36 (d) (`docs/OPEN-QUESTIONS.md:503-506`) — «Quản trị tài khoản huỷ được phiếu bằng một lệnh riêng, kèm căn cứ, không đổi phiên bản tài khoản và không đụng phiên đăng nhập của thành viên.» Câu hỏi Chairman trả lời (`docs/OPEN-QUESTIONS.md:504`) nói về «một phiếu đang mở do điều phối dự án trình».
- **Phía B:** cơ chế phiếu đổi quyền của lát 2, nơi không ai huỷ được một phiếu: phiếu do quản trị tài khoản trình chỉ kết thúc bằng phiếu bầu, hạn 48 giờ, hoặc khi phiên bản tài khoản đổi (`src/server/accounts.ts:262-268`, `src/server/account-approval.ts:176-189`); ghi chú của phiên điều phối kèm OQ-31 (`docs/OPEN-QUESTIONS.md:380`) — dùng lại cơ chế đó và các luật của nó như đang có. Giới hạn của PR này: hành vi đường trình và đường áp của quản trị tài khoản với phiếu do quản trị trình không đổi. Không tài liệu nào nói lệnh huỷ mới có áp cho phiếu do chính quản trị tài khoản trình không.
- **Phương án:** (a) chỉ phiếu đổi quyền do điều phối dự án trình; phiếu do quản trị tài khoản trình giữ nguyên cách đóng như hôm nay; (b) mọi phiếu đổi quyền đang mở, kể cả phiếu do chính quản trị tài khoản trình — quản trị rút lại được đề xuất của mình mà không phải thu hồi phiên của thành viên.
- **Điều kèm theo để Chairman biết:** phiếu đăng ký thành viên không thuộc câu hỏi này; nó đã có lệnh từ chối riêng (`src/server/accounts.ts:104-112`).
- **Ai quyết:** Chairman.
- **Khuyến nghị của planner (không phải quyết định):** (a) cho PR này, đúng phạm vi câu hỏi Chairman đã trả lời; xét (b) trước pilot, vì đòn bẩy hiện có của quản trị tài khoản với phiếu của chính mình vẫn buộc thành viên đăng nhập lại.
- **Quyết định 16/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối; phiên điều phối chuyển lời):** «(a) Chỉ phiếu của điều phối (Recommended)».
  - Câu hỏi Chairman thấy: «OQ-49 (Task 7c): lệnh huỷ phiếu của quản trị tài khoản (anh đã cho ở OQ-36 d) áp cho những phiếu đổi quyền nào? Câu hỏi OQ-36 anh trả lời nói về phiếu do điều phối dự án trình. Phiếu đăng ký thành viên không thuộc câu này.»
  - Hai phương án Chairman thấy (nhãn — mô tả):
    - «(a) Chỉ phiếu của điều phối (Recommended)» — «Chỉ phiếu đổi quyền do điều phối dự án trình; phiếu do quản trị tài khoản trình giữ nguyên cách đóng như hôm nay. Đúng phạm vi câu hỏi anh đã trả lời; xét (b) trước pilot.»
    - «(b) Mọi phiếu đổi quyền» — «Mọi phiếu đổi quyền đang mở, kể cả phiếu do chính quản trị tài khoản trình: quản trị rút lại được đề xuất của mình mà không phải thu hồi phiên đăng nhập của thành viên.»
- **Ghi chú của phiên điều phối kèm quyết định (không phải lời Chairman; chép nguyên, giữ số thứ tự trong tin của phiên điều phối ngày 16/11/2026):**
  - 2. OQ-49 (a) trùng giữ chỗ hiện có; không đổi gì.
- **Phán quyết của phiên Task 7c** (không phải lời Chairman; điểm F của phiên Task 7c, chép nguyên): **OQ-49 (a)** trùng giữ chỗ: mục OQ-49 chỉ thêm dòng quyết định; mã `BALLOT_CANCEL_NOT_ALLOWED` nay là quyết định, không còn là giữ chỗ.
- **Áp vào PR «Task 7c + bước 16b» (kế hoạch bản 0.2):** không đổi hành vi so với giữ chỗ của bản 0.1. Lệnh huỷ từ chối phiếu mà người trình là quản trị tài khoản (`BALLOT_CANCEL_NOT_ALLOWED`); `/team` chỉ hiện nút huỷ ở phiếu do điều phối dự án trình. Mã lỗi và điều kiện hiện nút nay là hệ quả của quyết định, không còn là giữ chỗ.
- **Trạng thái lúc lập kế hoạch (trước quyết định; kế hoạch bản 0.1):** chưa quyết. Kế hoạch đặt **hành vi giữ chỗ fail-closed, không phải phương án được chọn**: trùng (a) — lệnh huỷ từ chối phiếu mà người trình là quản trị tài khoản (`BALLOT_CANCEL_NOT_ALLOWED`); `/team` chỉ hiện nút huỷ ở phiếu do điều phối dự án trình. Đổi sang (b) là bỏ một phép kiểm ở lệnh huỷ và một điều kiện hiện nút.

## OQ-50 — Người trình không còn là điều phối của dự án có còn rút được, và còn xem được, phiếu mình đã trình không

- **Lát:** PR riêng «Task 7c + bước 16b» sau lát 3 (Task 1 phần danh sách, Task 2 phần rút của `docs/plans/task-7c-coordinator-proposal.md`), pilot.
- **Phía A:** quyết định OQ-36 (b) (`docs/OPEN-QUESTIONS.md:503-506`) — «Người trình rút được phiếu của chính mình, kèm căn cứ.» Câu này không kèm điều kiện về vai. Rút chỉ thu hẹp: nó đóng một đề xuất mở rộng quyền. Quyết định OQ-37 (c) (`docs/OPEN-QUESTIONS.md:521-525`) cho phiếu vẫn áp được sau khi người trình mất vai, nên phiếu của một người đã mất vai vẫn đang mở và người đó có thể muốn rút.
- **Phía B:** quyết định OQ-33 (b) (`docs/OPEN-QUESTIONS.md:416-420`) mở đường này cho «Điều phối dự án», tức thẩm quyền đi theo vai; cổng bảo mật trên kế hoạch cũ, mục M3 (`docs/reviews/slice-3-evidence-20261115/gates/security-gate-task-7c-plan.md:32-38`) và ca T14 (`:83`): người đã bị hạ vai ở một dự án không còn liệt kê được phiếu mình đã trình cho dự án đó. Không tài liệu nào nói một người không còn điều phối dự án có được ghi một lệnh — dù là lệnh thu hẹp — lên phiếu của dự án đó không.
- **Phương án:** (a) rút được chừng nào tài khoản còn hoạt động, không xét vai hiện tại (đọc đúng chữ quyết định OQ-36 b); (b) chỉ rút được khi vẫn là điều phối đang hoạt động của đúng dự án; mất vai thì quản trị tài khoản huỷ bằng lệnh riêng; (c) rút được khi vẫn là thành viên của dự án, vai nào cũng được. Kèm cho cả ba: người đó có còn xem được danh sách phiếu đang mở mình đã trình không.
- **Điều kèm theo để Chairman biết:** tài khoản bị khoá không còn phiên đăng nhập (`src/server/accounts.ts:220-222`, `src/server/identity.ts:45`) nên không gọi được lệnh nào, theo phương án nào cũng vậy.
- **Ai quyết:** Chairman; BoM Tech nếu Chairman giao.
- **Khuyến nghị của planner (không phải quyết định):** (a) — đúng chữ quyết định, rút chỉ thu hẹp, và bớt một việc phải nhờ quản trị tài khoản; kèm theo đó người trình xem được các phiếu đang mở của chính mình.
- **Quyết định 16/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối; phiên điều phối chuyển lời):** «(c) Còn là thành viên dự án (Recommended)». Phương án Recommended ở câu này là khuyến nghị của phiên điều phối, khác khuyến nghị (a) của planner; mô tả đã nêu rõ điều đó cho Chairman.
  - Câu hỏi Chairman thấy: «OQ-50 (Task 7c): người trình không còn là điều phối của dự án có còn rút được, và còn xem được, phiếu mình đã trình không? Kế hoạch đang giữ chỗ theo (b). Tài khoản bị khoá thì không gọi được lệnh nào, theo phương án nào cũng vậy.»
  - Ba phương án Chairman thấy (nhãn — mô tả):
    - «(c) Còn là thành viên dự án (Recommended)» — «Rút và xem được khi vẫn là thành viên của dự án, vai nào cũng được; đã rời dự án thì quản trị tài khoản huỷ bằng lệnh riêng. Planner của Task 7c khuyến nghị (a); phiên điều phối nghiêng về (c) vì người đã rời dự án không nên còn đọc dữ liệu của dự án đó.»
    - «(a) Còn tài khoản là rút được» — «Rút được chừng nào tài khoản còn hoạt động, không xét vai hiện tại; người trình xem được các phiếu đang mở của chính mình. Đọc đúng chữ quyết định OQ-36 (b); rút chỉ thu hẹp quyền.»
    - «(b) Chỉ khi còn là điều phối» — «Chỉ rút và xem được khi vẫn là điều phối đang hoạt động của đúng dự án; mất vai thì quản trị tài khoản huỷ bằng lệnh riêng.»
- **Ghi chú của phiên điều phối kèm quyết định (không phải lời Chairman; chép nguyên, giữ số thứ tự trong tin của phiên điều phối ngày 16/11/2026):**
  - 3. OQ-50 (c) thay giữ chỗ (b): điều kiện rút và xem là «đang là thành viên đang hoạt động của dự án đó, vai nào cũng được», đọc từ CSDL trong cùng giao dịch. Ca quyền âm cần có: người đã bị gỡ khỏi dự án không rút và không liệt kê được phiếu mình đã trình; người bị hạ vai nhưng còn trong dự án thì rút và xem được; người đó vẫn **không** trình được phiếu mới (trình vẫn đòi vai `manager`). Mô tả không nói `viewer` có tính là «thành viên» không: nếu kế hoạch cần phân biệt thì đọc theo đúng chữ «vai nào cũng được» và ghi lại.
  - 4. Hai chỗ kế hoạch đổi so với bản cổng bảo mật đang xem (OQ-48 và OQ-50): cho cổng xem lại đúng hai phần đó trước khi `builder` viết mã của chúng.
- **Cách đọc và phán quyết của phiên Task 7c** (không phải lời Chairman; điểm D và E của phiên Task 7c, chép nguyên):
  - D. **OQ-50 (c), `viewer`:** đọc đúng chữ «vai nào cũng được» — người trình đã bị hạ xuống `viewer` nhưng còn là thành viên đang hoạt động của dự án vẫn rút và xem được phiếu mình đã trình. Ghi lại là cách đọc theo chữ.
  - E. **OQ-50 (c) và OQ-51 (giữ chỗ «chỉ rút khi còn `pending`»):** hai điều kiện cộng lại — còn là thành viên đang hoạt động của dự án **và** phiếu còn `pending`.
- **Áp vào PR «Task 7c + bước 16b» (kế hoạch bản 0.2):** lệnh rút và danh sách «phiếu đã trình» chỉ đòi người gọi là thành viên đang hoạt động, đã kích hoạt của đúng dự án, vai nào cũng được, đọc từ CSDL danh tính trong cùng giao dịch; người đã bị gỡ khỏi dự án nhận cùng câu 404 như với một dự án không tồn tại, và phiếu của họ do quản trị tài khoản huỷ bằng lệnh riêng. **Trình** phiếu mới vẫn đòi vai `manager`. Màn Review cho người đã mất vai `manager` nhưng còn trong dự án thấy danh sách phiếu mình đã trình và nút rút, không có biểu mẫu trình. Điều kiện này cộng với giữ chỗ của OQ-51 (chỉ rút khi phiếu còn `pending`).
- **Trạng thái lúc lập kế hoạch (trước quyết định; kế hoạch bản 0.1):** chưa quyết. Kế hoạch đặt **hành vi giữ chỗ fail-closed, không phải phương án được chọn**: trùng (b) — người trình không còn là điều phối đang hoạt động của dự án bị từ chối khi rút và khi xem danh sách (`MANAGER_REQUIRED`). Phiếu không bị kẹt: quản trị tài khoản huỷ được bằng lệnh riêng, và `/team` nêu rõ người trình không còn điều phối dự án (OQ-37 c). Giữ chỗ này từ chối một lệnh thu hẹp; nêu ra để Chairman biết cái giá. Đổi sang (a) là bỏ một phép kiểm ở lệnh rút và ở danh sách.

## OQ-51 — Phiếu do điều phối dự án trình đã có một ghế BoM đồng ý nhưng chưa được áp: người trình có rút được, và quản trị tài khoản có huỷ được, không

- **Lát:** PR riêng «Task 7c + bước 16b» sau lát 3 (Task 2 và Task 4 của `docs/plans/task-7c-coordinator-proposal.md`), pilot.
- **Phía A:** quyết định OQ-36 (b) cùng (d) (`docs/OPEN-QUESTIONS.md:503-506`) — «Người trình rút được phiếu của chính mình, kèm căn cứ. Quản trị tài khoản huỷ được phiếu bằng một lệnh riêng, kèm căn cứ, không đổi phiên bản tài khoản và không đụng phiên đăng nhập của thành viên.» Câu hỏi Chairman trả lời (`docs/OPEN-QUESTIONS.md:504`) nói về «một phiếu đang mở» và nêu lý do: mỗi người chỉ có một phiếu đang mở, nên phiếu của điều phối chặn phiếu của quản trị tài khoản cho cùng người tới 48 giờ. Trong dữ liệu, «đang mở» là trạng thái `pending` hoặc `approved` (`migrations/018_access_change_approval.sql:31-33`): một phiếu đã có ghế BoM đồng ý mà chưa áp vẫn chiếm chỗ như vậy.
- **Phía B:** cổng bảo mật lượt 1, mục QB (`docs/reviews/task-7c-evidence-20261116/gates/security-gate-plan-round-1.md:117`): đọc «phiếu đang mở» theo chỉ mục đó là có lý nhưng không nằm trong lời Chairman, và nó cho một điều phối dự án xoá bỏ sự đồng ý mà một ghế BoM đã ghi. Quyết định OQ-29 (`docs/OPEN-QUESTIONS.md:326`) đặt sự đồng ý của một thành viên BoM là điều làm phiếu đổi quyền đủ. Không tài liệu nào nói: sau khi một ghế BoM đã đồng ý, người trình còn rút được phiếu không; quản trị tài khoản có huỷ được một phiếu đã đủ mà chưa áp không.
- **Phương án:** (a) người trình rút được cả phiếu `pending` lẫn phiếu đã `approved` mà chưa áp; quản trị tài khoản huỷ được cả hai; (b) người trình chỉ rút được khi phiếu còn `pending`; quản trị tài khoản huỷ được cả hai; (c) cả rút lẫn huỷ chỉ áp cho phiếu còn `pending`; phiếu đã `approved` chỉ còn ba lối ra có sẵn: quản trị áp, để hết hạn 48 giờ, hoặc một lệnh tăng phiên bản tài khoản; (d) như (b), và ghế BoM đã đồng ý được báo khi phiếu bị huỷ — cần thông báo, thuộc lát 4.
- **Điều kèm theo để Chairman biết:** trong giữ chỗ dưới đây, phần «quản trị tài khoản huỷ được cả phiếu đã `approved`» là **phán quyết kỹ thuật của phiên Task 7c**, không phải hướng chặt nhất. Lý do của phiên: quản trị tài khoản vốn đã đóng được mọi phiếu đang mở, kể cả phiếu đã đủ, bằng một lệnh tăng phiên bản tài khoản (`src/server/accounts.ts:262-265`); và câu hỏi Chairman trả lời ở OQ-36 nói về phiếu đang mở chặn phiếu của quản trị tài khoản — một phiếu đã `approved` mà chưa áp vẫn chặn đúng như thế. Nếu Chairman chọn (c) thì lệnh huỷ bỏ nhánh `approved`.
- **Ai quyết:** Chairman.
- **Khuyến nghị của planner (không phải quyết định):** (b) — sau khi một ghế BoM đã đồng ý, việc dừng phiếu nên thuộc về người áp, không thuộc về người trình; quản trị tài khoản không được thêm khả năng nào so với đòn bẩy có sẵn.
- **Trạng thái lúc lập kế hoạch:** chưa quyết. Kế hoạch bản 0.2 đặt **hành vi giữ chỗ fail-closed, không phải phương án được chọn**: trùng (b) — lệnh rút của người trình bị từ chối khi phiếu đã `approved` (`BALLOT_ALREADY_APPROVED`, câu «Phiếu đã đủ xác nhận, không còn rút được ở đây. Nhờ quản trị tài khoản huỷ nếu cần.»); lệnh huỷ của quản trị tài khoản áp cho cả `pending` lẫn `approved` (phán quyết kỹ thuật nêu trên). Điều kiện này cộng với quyết định OQ-50 (c): người rút phải còn là thành viên đang hoạt động của dự án **và** phiếu còn `pending`. Đổi sang (a) là bỏ một phép kiểm ở lệnh rút và hiện lại nút rút ở phiếu đã đủ; đổi sang (c) là thêm một điều kiện ở lệnh huỷ.
- **Quyết định 16/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối, sau khi nhánh rebase lên `679ff6c`; phiên điều phối chuyển lời):** «(b) Rút khi chưa ai đồng ý (Recommended)».
  - Câu hỏi Chairman thấy: «OQ-51 (Task 7c): phiếu đổi quyền do điều phối dự án trình đã có một ghế BoM đồng ý nhưng quản trị tài khoản chưa áp. Người trình còn rút được không, quản trị tài khoản còn huỷ được không? Phiếu như vậy vẫn chặn phiếu của quản trị cho cùng người tới 48 giờ.»
  - Bốn phương án Chairman thấy (nhãn — mô tả):
    - «(b) Rút khi chưa ai đồng ý (Recommended)» — «Người trình rút được khi phiếu còn chờ; đã có ghế BoM đồng ý thì không rút được. Quản trị huỷ được cả hai (kế hoạch đang làm vậy). Quản trị vốn đã đóng được phiếu đó bằng cách đổi phiên bản tài khoản, nhưng cách đó bắt thành viên đăng nhập lại.»
    - «(c) Đã đồng ý thì không ai huỷ» — «Rút và huỷ chỉ áp cho phiếu còn chờ. Phiếu đã có ghế BoM đồng ý chỉ kết thúc khi quản trị áp, hết hạn 48 giờ, hoặc quản trị đổi phiên bản tài khoản (thành viên phải đăng nhập lại).»
    - «(a) Rút và huỷ cả hai» — «Người trình rút được cả phiếu đã có ghế BoM đồng ý mà chưa áp; quản trị huỷ được cả hai. Điều phối dự án xoá được sự đồng ý mà một ghế BoM đã ghi.»
    - «(d) Như (b), báo ghế BoM» — «Như (b), thêm thông báo cho ghế BoM đã đồng ý khi phiếu bị huỷ. Thông báo thuộc lát 4, nên phần báo làm sau, ngoài PR này.»
- **Ghi chú của phiên điều phối kèm quyết định (không phải lời Chairman; chép nguyên, giữ số thứ tự trong tin thứ hai của phiên điều phối ngày 16/11/2026; ghi chú 1, 3 và 4 của tin đó chép ở mục OQ-48, dưới quyết định thứ hai):**
  - 2. Ở OQ-51 (b), phần «quản trị huỷ được cả phiếu đã approved» nay nằm trong mô tả phương án Chairman chọn, nên không còn là phán quyết kỹ thuật riêng của phiên.
- **Áp vào PR «Task 7c + bước 16b» (kế hoạch bản 0.4, chỉ hồ sơ):** không đổi hành vi, mã lỗi, câu chữ, ca kiểm hay ranh giới task. Hành vi ở dòng «Trạng thái lúc lập kế hoạch» trên — ở bản 0.2 và 0.3 là giữ chỗ fail-closed, «không phải phương án được chọn» — nay là quyết định của Chairman, phương án (b): lệnh rút của người trình bị từ chối khi phiếu đã `approved` (`BALLOT_ALREADY_APPROVED`); lệnh huỷ của quản trị tài khoản áp cho cả `pending` lẫn `approved`. Theo ghi chú 2 của phiên điều phối, phần huỷ phiếu đã `approved` không còn là phán quyết kỹ thuật riêng của phiên như dòng «Điều kèm theo» ghi. Điều kiện cộng với quyết định OQ-50 (c) giữ nguyên: người rút phải còn là thành viên đang hoạt động của dự án **và** phiếu còn `pending`. Dòng «Điều kèm theo» và dòng «Trạng thái lúc lập kế hoạch» giữ nguyên làm hồ sơ.

## OQ-52 — Người trình có được thấy phiếu mình trình đang chờ hay đã có một ghế BoM đồng ý không

- **Lát:** PR riêng «Task 7c + bước 16b» sau lát 3 (Task 1 phần danh sách, Task 2 phần rút, Task 4 của `docs/plans/task-7c-coordinator-proposal.md`), pilot.
- **Phía A:** danh sách «phiếu đã trình» trả cho người trình trạng thái của từng phiếu (`pending` hoặc `approved`), và màn Review hiện bằng chữ «Đang chờ một thành viên BoM» hoặc «Đã đủ phiếu, chờ quản trị tài khoản áp». Người trình cần biết việc mình trình đang ở đâu. Quyết định OQ-50 (c) cho người trình «xem được» phiếu mình đã trình khi còn là thành viên dự án, nhưng không nói xem tới mức nào.
- **Phía B:** cổng bảo mật lượt 1, mục QC (`docs/reviews/task-7c-evidence-20261116/gates/security-gate-plan-round-1.md:118`): giai đoạn bỏ phiếu của phiếu («đã có một ghế BoM đồng ý») là một dữ kiện «ai thấy gì» mà các quyết định chưa phủ. Trong cơ chế phiếu của lát 2, người đề xuất là quản trị tài khoản, người vốn thấy tiến độ phiếu trên `/team`; với người đề xuất mới là điều phối dự án, chưa tài liệu nào nói họ được biết một ghế BoM đã đồng ý hay chưa (danh sách không nêu ghế nào).
- **Phương án:** (a) người trình thấy giai đoạn `pending` hay `approved` của phiếu mình trình; (b) không thấy: danh sách chỉ ghi phiếu «đang mở», và lệnh rút không được làm lộ giai đoạn.
- **Điều kèm theo để Chairman biết:** hành vi trong PR là (a), và đó **không phải hướng chặt nhất**. Lý do phiên Task 7c giữ (a): dưới giữ chỗ của OQ-51 (người trình chỉ rút được khi phiếu còn `pending`), một lần rút bị từ chối đằng nào cũng cho người trình biết phiếu đã đủ; muốn giấu giai đoạn thì hoặc câu từ chối phải nói sai, hoặc phải nới OQ-51 cho rút cả phiếu đã `approved`. Cái giá đổi sang (b): danh sách bỏ trường trạng thái, màn Review chỉ còn một nhãn, và OQ-51 phải quyết theo (a), hoặc lệnh rút trả một câu từ chối không nêu lý do.
- **Ai quyết:** Chairman; BoM Tech nếu Chairman giao.
- **Khuyến nghị của planner (không phải quyết định):** (a) — người trình biết giai đoạn thì biết lúc nào cần nhắc quản trị tài khoản áp; danh sách không nêu ghế nào đã đồng ý.
- **Trạng thái lúc lập kế hoạch:** chưa quyết. Hành vi trong kế hoạch bản 0.2 trùng (a): người trình thấy giai đoạn của phiếu mình trình. Đây **không phải phương án được chọn và không phải giữ chỗ chặt nhất**; lý do và cái giá đổi hướng nêu ở dòng «Điều kèm theo».
- **Quyết định 16/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối, sau khi nhánh rebase lên `679ff6c`; phiên điều phối chuyển lời):** «(a) Thấy giai đoạn (Recommended)».
  - Câu hỏi Chairman thấy: «OQ-52 (Task 7c): người trình (điều phối dự án) có được thấy phiếu mình trình đang chờ hay đã có một ghế BoM đồng ý không? Danh sách không nêu ghế nào đã đồng ý.»
  - Hai phương án Chairman thấy (nhãn — mô tả):
    - «(a) Thấy giai đoạn (Recommended)» — «Màn Review ghi «Đang chờ một thành viên BoM» hoặc «Đã đủ phiếu, chờ quản trị tài khoản áp»; người trình biết lúc nào cần nhắc quản trị áp. Kế hoạch đang làm vậy.»
    - «(b) Chỉ ghi «đang mở»» — «Không lộ giai đoạn. Kéo theo: OQ-51 phải chọn (a), hoặc lệnh rút bị từ chối mà không nêu lý do — vì nếu không, một lần rút bị từ chối đã cho biết phiếu đủ.»
- **Ghi chú của phiên điều phối kèm quyết định** (dòng này do phiên Task 7c ghi, không phải lời Chairman, không phải chép nguyên): tin thứ hai của phiên điều phối ngày 16/11/2026 không có ghi chú riêng cho OQ-52; ghi chú 1 của tin đó (chép nguyên ở mục OQ-48, dưới quyết định thứ hai) nói chung cho cả ba câu.
- **Áp vào PR «Task 7c + bước 16b» (kế hoạch bản 0.4, chỉ hồ sơ):** không đổi hành vi, mã lỗi, câu chữ, ca kiểm hay ranh giới task. Hành vi ở dòng «Trạng thái lúc lập kế hoạch» trên — người trình thấy giai đoạn `pending` hay `approved` của phiếu mình trình, trước đây ghi là «không phải phương án được chọn» — nay là quyết định của Chairman, phương án (a). Màn Review giữ hai nhãn «Đang chờ một thành viên BoM» và «Đã đủ phiếu, chờ quản trị tài khoản áp»; danh sách vẫn không nêu ghế nào đã đồng ý. Dòng «Điều kèm theo» và dòng «Trạng thái lúc lập kế hoạch» giữ nguyên làm hồ sơ.

**Xác nhận của Chairman ngày 18/11/2026 về S13 của lát 2 (Chairman gõ ở phiên điều phối, rồi chọn qua hộp chọn; phiên điều phối chép lời):** Chairman gõ «áp». Hỏi lại phạm vi, Chairman chọn «Cả hai đường (Recommended)». Khối này đặt ở cuối tệp để các số dòng đã được trích ở tài liệu khác không xê dịch; nó thuộc về OQ-29 và ghi chú 3 kèm OQ-35.
- Chairman gõ «áp» sau tin của phiên điều phối ngày 17/11/2026, tin đó có câu: «Vẫn chờ anh quyết: S13 của lát 2 có áp cho phiếu do điều phối trình không; OQ-45 và OQ-46 (đang chặn việc bật Z4); thay `OBSIDIAN_API_TOKEN`.»
- Câu hỏi Chairman thấy ở hộp chọn: «Anh vừa gõ «áp». Tôi hiểu là: luật S13 áp cho phiếu cấp quyền duyệt do điều phối dự án trình, tức ghế Chairman bấm «Từ chối» thì phiếu đóng, bấm «Đồng ý» thì không tính. Mã đã chạy đúng như vậy, không phải sửa. Lời «áp» này có xác nhận luôn S13 cho phiếu đổi quyền do quản trị tài khoản trình (lát 2, kèm OQ-29) không?»
- Ba phương án Chairman thấy (nhãn — mô tả):
  - «Cả hai đường (Recommended)» — «S13 được xác nhận cho cả phiếu do quản trị tài khoản trình lẫn phiếu do điều phối dự án trình. Hồ sơ gỡ S13 khỏi danh sách «chờ Chairman xác nhận» của lát 2 và của Task 7c. Ba cách hiểu khác kèm OQ-29 vẫn chờ.»
  - «Chỉ đường điều phối» — «Hồ sơ chỉ ghi xác nhận cho phiếu do điều phối dự án trình. S13 cho phiếu do quản trị tài khoản trình vẫn nằm trong danh sách chờ xác nhận của lát 2.»
  - «Tôi hiểu sai «áp»» — ««áp» không nói về S13. Tôi không ghi gì vào hồ sơ và chờ anh nói rõ ý.»
- Hệ quả: S13 không còn là cách hiểu chờ xác nhận. Với mọi phiếu `access_change`, do quản trị tài khoản trình hay do điều phối dự án trình (OQ-33 (b), OQ-35): lá «Đồng ý» của ghế Chairman không tính, lá «Từ chối» của ghế đó đóng phiếu. Mã không đổi: `accessChangeTally` ở `src/server/account-approval.ts`; ca kiểm ở `tests/access-change.test.ts` và `tests/doc-approval-proposal.test.ts`.
- Ghi chú của phiên điều phối kèm xác nhận (không phải lời Chairman):
  1. Câu hỏi tả S13 bằng hai luật về lá phiếu. Câu đầu của S13 («Chairman vẫn nằm trong danh sách ghế đóng băng như trước», nên vẫn cần ghế Chairman đã ghép Telegram để mở phiếu) không được nêu thành chữ trong câu hỏi. Nó là điều kiện để ghế Chairman bỏ được phiếu, và mã không đổi.
  2. Lý do S13 nêu cho luật («vì Chairman là người đề xuất») không đúng với phiếu do điều phối dự án trình (điều kèm theo ở OQ-35). Xác nhận trên là cho luật, không phải cho lý do.
  3. **Vẫn chờ Chairman xác nhận:** ba cách hiểu của phiên điều phối kèm OQ-29 (người được đổi quyền không bỏ phiếu cho chính mình; hạn 48 giờ; một BoM từ chối mà còn BoM khác chưa bỏ phiếu thì phiếu vẫn chờ) và hai cách hiểu kèm OQ-28.
  4. Xác nhận này không nói gì về triển khai hay dùng thật. Nhãn quyền `doc_approve:*` trong plugin và các điểm dừng khác giữ nguyên.

**Quyết định của Chairman ngày 18/11/2026 về OQ-45 và OQ-46 (Chairman gõ ở phiên điều phối; phiên điều phối chép lời):** «OQ-45: 1b, 2b, 3b. OQ-46: b, mốc là bản mới nhất nháp nêu». Khối này đặt ở cuối tệp để các số dòng đã được trích ở tài liệu khác không xê dịch; nó thuộc về OQ-45 và OQ-46.
- Chairman không chọn qua hộp chọn: phiên điều phối chưa trình hai mục này thành hộp chọn. Chairman gõ nhãn phương án theo chữ của hai mục. Phần dưới đối chiếu từng nhãn với chữ của mục; chữ trong «» chép từ mục OQ-45 và OQ-46 ở trên, không phải lời Chairman.
- OQ-45, điểm 1 (ai xem `value`): **(b)** — «chỉ người có quyền xác nhận nháp đó (vai ghi sổ tài liệu với nháp tài liệu, điều phối dự án với nháp ứng viên)».
- OQ-45, điểm 2 (xét lại lúc đọc): **(b)** — «lúc đọc dựng lại ngữ cảnh dưới quyền người đọc và che `value` khi nháp trích tin người đó không đọc được chữ hoặc dự án đang chỉ con trỏ, chỉ trả mã và lý do giữ».
- OQ-45, điểm 3 (nháp của dự án `IBS_HI`): **(b)** — «từ chối ngay lúc ghi (cần cấp cho role AI quyền đọc hẹp cờ «chỉ con trỏ», hoặc một thiết kế khác)».
- OQ-46: **(b)** — «Giữ nháp khi **đối tượng của chính nó** đã đổi: tài liệu có bản mới hơn sau lúc nháp được ghi; luồng của ứng viên có tin hoặc bản sửa mới sau lúc đó. Phải định nghĩa «sau» theo mốc nào (thời điểm ghi, hay bản mới nhất mà nháp nêu).» Mốc Chairman chọn, theo lời Chairman: «mốc là bản mới nhất nháp nêu».
- Trạng thái mã lúc ghi (`4e0516e`): chưa có mã cho quyết định nào ở trên. Hành vi vẫn là (a) ở cả ba điểm của OQ-45 và trùng (a) của OQ-46. Không tuyến HTTP nào gọi `SuggestionService.list`; ca kiểm «no route imports the suggestion service» vẫn giữ; Z4 chưa bật.
- Ghi chú của phiên điều phối kèm quyết định (không phải lời Chairman):
  1. Điểm 3 (b) để ngỏ cách làm: «cần cấp cho role AI quyền đọc hẹp cờ «chỉ con trỏ», hoặc một thiết kế khác». Chairman không chọn cách làm. Planner đề xuất và cổng bảo mật soát kế hoạch trước khi viết mã. Nếu phải đổi quyền của role `libetech_ai` thì cần migration mới (số kế tiếp là 022) kèm tệp rollback.
  2. Mốc của OQ-46 là bản mới nhất nháp nêu. Phương án (b) nói cả «tài liệu có bản mới hơn» lẫn «luồng của ứng viên có tin hoặc bản sửa mới». Cách áp mốc này cho luồng tin của nháp ứng viên phải được planner viết rõ trong kế hoạch, và ghi thành câu hỏi mở nếu chữ của Chairman không đủ để quyết.
  3. Hai mục không còn «chưa quyết», nhưng việc bật Z4 **vẫn dừng**. Trước đó cần: mã của các quyết định trên qua đủ cổng; thiết kế và migration cho một login AI (`docs/DELIVERY-012-review-skills-20261115.md`, khoảng trống 7); bảng phân loại dữ liệu → mô hình được Chairman duyệt (OQ-14); và lời Chairman cho chính việc bật Z4.
  4. Quyết định ở điểm 3 chặt hơn hành vi hiện tại và cùng hướng với `AGENTS.md:16` («IBS HI: pointers, hashes and Tech work metadata only.»). Khối này không sửa `AGENTS.md`.

---

**Bổ sung 18/11/2026 khi lập kế hoạch cho PR mã của OQ-45 và OQ-46** (`docs/plans/oq-45-46-ai-drafts.md`, bản 0.1; base `4f12a3c`). Do agent `planner` ghi khi **chưa có quyết định**; khối này đặt ở cuối tệp để các số dòng đã được trích ở tài liệu khác không xê dịch. Hai mục dưới đây nêu các điểm mà lời Chairman ngày 18/11/2026 («OQ-45: 1b, 2b, 3b. OQ-46: b, mốc là bản mới nhất nháp nêu», `docs/OPEN-QUESTIONS.md:855`) chưa phủ. **Không mục nào chặn task của PR đó:** kế hoạch đặt hành vi giữ chỗ theo hướng chặt cho OQ-53 và không viết mã cho OQ-54. Cùng các điều kiện ở ghi chú 3 của khối quyết định ngày 18/11/2026 (`docs/OPEN-QUESTIONS.md:865`), hai mục này **cần có quyết định trước khi bật Z4**.

## OQ-53 — Mốc «bản mới nhất nháp nêu» áp thế nào khi nháp không nêu thứ làm mốc: bản sửa của tin, và nháp không nêu bản hay tin nào của đối tượng của nó

- **Lát:** PR mã của OQ-45 và OQ-46 (Task 5 và Task 6 của `docs/plans/oq-45-46-ai-drafts.md`); trước khi bật Z4.
- **Phía A:** quyết định OQ-46 (b) (`docs/OPEN-QUESTIONS.md:860`; chữ của phương án ở `:684`): giữ nháp khi «tài liệu có bản mới hơn» hoặc «luồng của ứng viên có tin hoặc bản sửa mới»; mốc, theo lời Chairman, là «bản mới nhất nháp nêu». Ghi chú 2 của phiên điều phối (`docs/OPEN-QUESTIONS.md:864`) đã lường trước: cách áp mốc này cho luồng tin phải được viết rõ, và ghi thành câu hỏi mở nếu chữ của Chairman không đủ để quyết.
- **Phía B:** hợp đồng đầu ra của kỹ năng chỉ cho nháp nêu **mã** (`src/server/skill-contracts.ts:95-109`, bảng `ID_FIELDS`). Với tài liệu, mã có thể là mã của một **bản** (`document_revision`), nên mốc tính được: bản có số cao nhất trong các bản nháp nêu thuộc chính tài liệu đó. Với luồng tin, nháp chỉ nêu mã **tin** (`source_event`); không trường nào nêu bản sửa hay hash của tin. Ngữ cảnh đưa cho kỹ năng có hash của bản mới nhất của từng tin (`src/server/skill-contracts.ts:12`), nhưng đầu ra không chép lại. Vì vậy: (1) «tin mới» áp được theo mốc (tin được ghi sau tin mới nhất nháp nêu), còn «bản sửa mới» của một tin thì nháp không nêu bản nào để so; (2) một nháp có thể không nêu bản nào của chính tài liệu của nó (ví dụ `technical_writer` chỉ nêu mã tài liệu), hoặc không nêu tin nào của chính luồng của nó: khi đó không có mốc. Lời Chairman không nói về hai trường hợp này. Cột `input_hash` của nháp do pipeline khai và không tài liệu nào định nghĩa nó băm gì (`docs/OPEN-QUESTIONS.md:680`), nên không dùng làm mốc được. **Khe hở của mọi mốc tính bằng thời điểm ghi** (bổ sung sau cổng bảo mật lượt 1 trên kế hoạch, mục R5): thời điểm ghi của một tin là lúc **bắt đầu** giao dịch nhận tin (`migrations/016_intake_inbox.sql:47`, `:65`); giao dịch đó lấy một khoá tư vấn và có thể phải chờ (`src/server/intake.ts:87`), với trần 10 giây cho mỗi câu lệnh (`src/server/db.ts:32`). Một tin mà giao dịch nhận bắt đầu trước mốc nhưng commit sau khi pipeline đã đọc ngữ cảnh sẽ mang thời điểm sớm hơn mốc và **không bao giờ** bị phép kiểm phát hiện. Khe hở dài bằng thời gian giao dịch nhận tin còn mở, không phải cỡ mili giây; đóng hẳn cần một số thứ tự của luồng (một migration và đổi đường nhận tin). Điều này cần được cân cùng phương án 1 (b). **Bổ sung sau review bảo mật của Task 6** (`docs/reviews/oq-45-46-evidence-20261118/gates/review-task-6-security.md`, mục M3, M4): (i) trần 10 giây nêu trên là của **mỗi câu lệnh**, không phải của khe hở — `src` không đặt trần nào cho cả giao dịch nhận tin; các tin đầu của một luồng đến cùng lúc (album) đảo thứ tự bắt đầu và commit là chuyện thường, không cần sự cố; bản sửa của tin có cùng khe hở; (ii) ngữ cảnh trao cho pipeline `observedAt` của từng tin, không trao thời điểm ghi (`src/server/skill-contracts.ts:12`), nên pipeline không biết tin nào được ghi sau cùng: với mốc tính theo thời điểm ghi, một nháp chỉ chắc chắn xác nhận được khi nêu **mọi** tin của luồng có trong ngữ cảnh; (iii) ở luồng dài hơn 20 tin có một tin đến muộn nằm ngoài cửa sổ ngữ cảnh, không nháp nào xác nhận được cho tới khi luồng có tin mới hơn (nêu tin đó thì nằm ngoài ngữ cảnh, không nêu thì luồng đã đổi).
- **Phương án** (hai điểm, quyết riêng từng điểm):
  1. Bản sửa của tin: (a) giữ nháp khi luồng có một bản sửa được ghi từ lúc tin mới nhất nháp nêu được ghi trở đi — dùng đúng mốc Chairman chọn; hệ quả: ở luồng mà sự kiện ghi sau cùng là một bản sửa, không nháp nào xác nhận được cho tới khi luồng có tin mới và có nháp mới nêu tin đó, kể cả khi nháp đã đọc đúng bản sửa ấy; (b) mở rộng hợp đồng đầu ra để nháp nêu hash (hoặc số bản) của từng tin nó trích, lúc xác nhận so với bản mới nhất của tin — chính xác, không giữ oan; phải đổi hợp đồng, prompt, manifest và bộ eval của các kỹ năng nhận tin; (c) riêng cho bản sửa, dùng thời điểm ghi nháp làm mốc — là mốc Chairman đã không chọn, và bỏ sót bản sửa đến giữa lúc pipeline đọc ngữ cảnh và lúc nháp được ghi; (d) không phát hiện bản sửa.
  2. Nháp không nêu bản nào của tài liệu của nó, hoặc không nêu tin nào của luồng của nó: (a) không có mốc thì không xác nhận được: giữ nháp khi tài liệu đã có ít nhất một bản (luồng thì luôn có ít nhất một tin) — pipeline buộc phải nêu bản hay tin nó đã đọc; (b) dùng thời điểm ghi nháp làm mốc thay — là mốc Chairman đã không chọn; (c) không kiểm cho các nháp đó — một nháp tránh được phép kiểm «đối tượng đã đổi» chỉ bằng cách không nêu bản nào. **Hệ quả của (a) cần biết khi quyết** (review mã của Task 5, `docs/reviews/oq-45-46-evidence-20261118/gates/review-task-5-code.md`): nháp `release_librarian` trên một tài liệu đã có bản nhưng chưa có bản chuẩn luôn bị giữ, vì ngữ cảnh của kỹ năng đó chỉ có bản chuẩn nên không có bản nào để nêu.
- **Ai quyết:** Chairman; BoM Tech nếu Chairman giao. **Đã quyết 19/11/2026 (Chairman):** điểm 1 (b), điểm 2 (a), điểm 3 (b), làm thành một PR riêng; lời Chairman chép nguyên và phần ánh xạ ở khối «Quyết định của Chairman ngày 19/11/2026 về OQ-53 đến OQ-56», cuối tệp. Mã của PR #22 không đổi vì quyết định này. **Mã của PR riêng (19/11/2026):** nhánh `feat/oq-53-subject-verification`, biên nhận `docs/DELIVERY-016-oq-53-subject-order-and-revisions-20261119.md`; cổng Codex vòng 2 `PASS`; đã merge (PR #24, 19/11/2026 23:34); Chairman xác nhận C1–C11 và các điều kiện sau merge ở khối cuối tệp.
- **Khuyến nghị của planner (không phải quyết định):** điểm 1: (b), làm thành một PR riêng vì đổi hợp đồng và manifest của kỹ năng, giữ (a) cho tới lúc đó; điểm 2: (a).
- **Hành vi hiện tại (không phải phương án được chọn):** ở base `4f12a3c` không có phép kiểm nào (trùng 1 (d) và 2 (c)). Kế hoạch `docs/plans/oq-45-46-ai-drafts.md` đặt **giữ chỗ fail-closed, không phải phương án được chọn**: trùng 1 (a) (mã lý do `SUBJECT_EDIT_UNVERIFIED`) và 2 (a) (mã lý do `SUBJECT_BASELINE_MISSING`) — trong các phương án nêu trên, đó là hướng giữ lại nhiều nháp nhất. Từ chối một nháp đang bị giữ vẫn làm được. Đổi sang phương án khác là đổi một nhánh điều kiện ở bước giữ của lệnh xác nhận; riêng 1 (b) cần thêm một PR về hợp đồng. **Bổ sung theo kế hoạch bản 0.5:** từ vòng sửa 1 của cổng Codex, điểm 3 (đoạn bổ sung ở `docs/OPEN-QUESTIONS.md:924`) có thêm một giữ chỗ: mọi lệnh xác nhận nháp ứng viên bị giữ. Hai mã trên, với nháp **ứng viên**, vì thế vẫn được tính nhưng luôn đi kèm `SUBJECT_ORDER_UNVERIFIED`; với nháp tài liệu không có gì đổi. **Cập nhật 19/11/2026:** 2 (a) nay là phương án Chairman chọn, nên `SUBJECT_BASELINE_MISSING` không còn là giữ chỗ (ánh xạ của phiên điều phối); 1 (a) và giữ chỗ của điểm 3 vẫn không phải phương án được chọn và ở lại cho tới khi PR riêng của OQ-53 merge (khối cuối tệp). **Cập nhật 19/11/2026 (PR riêng của OQ-53, đã merge: PR #24):** mã của PR đó gỡ `SUBJECT_EDIT_UNVERIFIED` và `SUBJECT_ORDER_UNVERIFIED` (số bản của tin, số thứ tự theo luồng do CSDL cấp, migration 023); hành vi chặt nói ở đây là hành vi của mã trước PR #24; mã đã merge nhưng migration 023 chưa áp ở đâu ngoài CSDL thử và Z4 chưa bật.

## OQ-54 — Nội dung nháp AI đã lưu trước khi dự án được ánh xạ sang IBS HI có được nằm lại trong Z4 không

- **Lát:** sau PR mã của OQ-45 và OQ-46; trước khi bật Z4. Không task nào của PR đó phụ thuộc mục này.
- **Phía A:** quyết định OQ-45 điểm 3 (b) (`docs/OPEN-QUESTIONS.md:859`): nháp của dự án `IBS_HI` bị «từ chối ngay lúc ghi»; điểm 2 (b) (`docs/OPEN-QUESTIONS.md:858`): lúc đọc, `value` bị che khi «dự án đang chỉ con trỏ». Với hai quyết định đó, một nháp được ghi **trước** khi dự án được ánh xạ sang `IBS_HI` vẫn nằm trong `intelligence.ai_drafts` với đủ nội dung: dịch vụ không trả nội dung và không cho xác nhận, nhưng dòng thì bất biến — không role nào sửa hay xoá được (`migrations/021_ai_suggestions_z4.sql:151-152`) — và role AI vẫn đọc được dòng trong phạm vi nó tự khai (`migrations/021_ai_suggestions_z4.sql:95-97`; `docs/DELIVERY-012-review-skills-20261115.md:145`).
- **Phía B:** `AGENTS.md:16`: «IBS HI: pointers, hashes and Tech work metadata only.» Phương án 3 (c) của OQ-45 («chỉ lưu mã và hash, không lưu nội dung», `docs/OPEN-QUESTIONS.md:669`) không được chọn, và nó nói về lúc ghi, không nói về dòng đã có. Không tài liệu nào nói nội dung đã lưu của một dự án về sau thành `IBS_HI` được giữ, phải xoá, hay phải che ở tầng CSDL. Chữ của tin Telegram có cùng tình huống và đã có luật: chữ đã lưu thì «ẩn» lúc đọc, không xoá (quyết định OQ-30 (b); `src/server/source-text.ts:7-10`).
- **Phương án:** (a) giữ dòng như cũ; nội dung không rời CSDL qua dịch vụ, đúng mẫu «ẩn lúc đọc» của tin Telegram; (b) thêm một lệnh có kiểm soát để xoá trắng nội dung (`value`, `questions`) của nháp thuộc dự án đang `IBS_HI`, giữ mã và hash — phải nới luật bất biến của bảng bằng một migration và một đường ghi mới có người chịu trách nhiệm; (c) chặn việc ánh xạ một dự án sang `IBS_HI` khi dự án còn nháp AI có nội dung — đổi luật của sổ dự án.
- **Điều kèm theo để Chairman biết** (bổ sung sau cổng bảo mật lượt 1 trên kế hoạch; **sửa tại chỗ ngày 18/11/2026 sau cổng Codex vòng 2 của PR mã**): bản trước của mục này ghi rằng người có quyền quyết định vẫn nhận `valueHash` của một nháp đã lưu trước khi dự án thành `IBS_HI`, vì lệnh từ chối cần nó, và rằng hash đó cho phép thử ngoại tuyến các giá trị ít khả năng (ví dụ phân loại và độ tin của một nháp gần như không có chữ tự do). Với Task G1 của PR đó (kế hoạch `docs/plans/oq-45-46-ai-drafts.md`, mục «Vòng 2 của cổng Codex và vòng sửa 2 (bản 0.9)») điều đó không còn đúng với mã: dưới mọi lớp che — gồm lớp che của dự án chỉ con trỏ — dịch vụ không trả hash của nội dung, và lệnh từ chối một nháp bị che không cần hash. Hai điều còn đúng, cả hai ghi ở R29 của kế hoạch: các mã che của dòng vẫn được trả, và tổ hợp các mã đó là thứ bên ghi tác động được; và dịch vụ vẫn đọc `value` vào tiến trình của nó rồi mới bỏ. Phương án (a) vì thế vẫn không có nghĩa «không gì về nội dung rời CSDL».
- **Ai quyết:** Chairman (chạm `AGENTS.md:16`). **Đã quyết 19/11/2026 (Chairman):** (b), làm cùng thiết kế login AI; lời Chairman chép nguyên ở khối «Quyết định của Chairman ngày 19/11/2026 về OQ-53 đến OQ-56», cuối tệp. Chưa có mã cho (b); hành vi vẫn trùng (a) cho tới lúc đó.
- **Khuyến nghị của planner (không phải quyết định):** (a) cho tới khi có thiết kế login AI (khoảng trống 7 của `docs/DELIVERY-012-review-skills-20261115.md`); xét (b) cùng thiết kế đó.
- **Hành vi hiện tại (không phải phương án được chọn):** trùng (a), ở base và sau PR mã của OQ-45 và OQ-46: PR đó không thêm mã nào cho điểm này. Z4 chưa bật nên chưa có dòng nháp nào ngoài CSDL thử.

---

**Bổ sung 18/11/2026 sau cổng bảo mật lượt 1 trên kế hoạch của PR mã OQ-45 và OQ-46** (`docs/reviews/oq-45-46-evidence-20261118/gates/security-gate-plan-round-1.md`, mục N2; kế hoạch bản 0.2). Do agent `planner` ghi khi **chưa có quyết định**, theo yêu cầu của cổng và phán quyết của phiên chính. **Không chặn task nào của PR đó:** kế hoạch đặt một giữ chỗ theo hướng chặt cho nháp ứng viên. Mục này **cần có quyết định trước khi thêm tuyến đọc nháp và trước khi bật Z4**.

## OQ-55 — Nháp AI mang chữ của tin mà không nêu mã tin: nháp ứng viên có bị che khi luồng của nó có chữ đã lưu mà nay không được hiện không, và nháp tài liệu thì sao

- **Lát:** PR mã của OQ-45 và OQ-46 (Task 4b của `docs/plans/oq-45-46-ai-drafts.md`); trước khi thêm tuyến đọc nháp hoặc bật Z4.
- **Phía A:** quyết định OQ-45 điểm 2 (b) (`docs/OPEN-QUESTIONS.md:858`): che `value` «khi nháp trích tin người đó không đọc được chữ hoặc dự án đang chỉ con trỏ». Mã chỉ biết nháp «trích» tin nào qua các mã nháp **tự khai** (`src/server/skill-contracts.ts:95-109`; cổng kiểm đầu ra ở `:143-174`). Lệnh ghi nháp chỉ kiểm lược đồ, kích thước và hash manifest (`src/server/suggestions.ts:84-93`): nháp không có nguồn, hoặc có nhận định không nêu căn cứ, vẫn được lưu (ca «DOC-05 an AI output without sources stays a draft and never reaches Z1», `tests/suggestions.test.ts:112`). Đọc theo đúng chữ, một nháp chép chữ của tin mà không nêu mã tin thì không «trích» tin nào và không bị che.
- **Phía B:** Phía B của OQ-45 (`docs/OPEN-QUESTIONS.md:665`): «Nội dung nháp là một đường thứ hai mang chữ của tin: nó vẫn đọc được sau khi cờ nhóm bị gỡ, sau khi dự án chuyển sang `IBS_HI`, và với người đọc không được xem tin gốc.» Chữ của tin hiện hay ẩn theo nhóm và theo ánh xạ dự án, không theo từng người (`src/server/source-text.ts:24-25`); ngữ cảnh của nháp ứng viên chính là các tin của luồng (`src/server/skill-context.ts:53-59`). Tình huống cổng bảo mật nêu: nhóm đang bật cờ hiện chữ; pipeline ghi một nháp có nhận định chép chữ của tin, phần nguồn chỉ nêu một tài liệu; sau đó cờ của nhóm bị gỡ; điều phối dự án đọc nháp và nhận đủ nội dung. Không cần đối thủ: một mô hình trung thực trích nhiều tin mà chỉ nêu một phần cũng rơi vào đây. Lời Chairman không nói nội dung không khai nguồn được xử lý thế nào.
- **Giới hạn không phép kiểm nào theo luồng sửa được (nêu để Chairman biết):** nháp **tài liệu** không gắn với luồng tin nào. Nếu pipeline đưa chữ của tin vào một nháp tài liệu mà không nêu mã tin, dịch vụ không biết phải xét luồng nào: không phép kiểm theo mã hay theo luồng nào thấy được. Hôm nay chỉ luật «dự án chỉ con trỏ» che được nháp đó (che mọi nháp của dự án, không phụ thuộc mã). **Đường này có sẵn với một pipeline trung thực, không chỉ với đối thủ** (bổ sung sau cổng bảo mật lượt 2 trên kế hoạch, mục R9): bộ dựng ngữ cảnh nhận cùng lúc một ứng viên và một tài liệu cho `ba_elicitation` và `pm_planning` (`src/server/skill-context.ts:23-24`, `:31`, `:48-49`, `:53-66`), nên ngữ cảnh khi đó có cả chữ của tin lẫn các bản của tài liệu, và pipeline có thể ghi một nháp **tài liệu** từ đó. Lúc đọc và lúc xác nhận, dịch vụ dựng lại ngữ cảnh chỉ theo tài liệu: nháp nêu mã tin thì bị che và bị giữ, không nêu thì chữ đi qua. Điều này cần được cân khi xét phương án (b) và (e). **Bổ sung theo kế hoạch bản 0.5 và 0.6 (vòng sửa 1 của cổng Codex trên PR đó, finding CX2; cổng bảo mật trên thiết kế vòng sửa, mục N2):** câu «Hôm nay chỉ luật «dự án chỉ con trỏ» che được nháp đó» tả mã tới `83d5e2f`. Từ Task F2 của vòng sửa, PR đặt thêm một giữ chỗ **theo dự án, cho cả hai loại nháp** (mã `PROJECT_TEXT_HIDDEN`, xem dòng «Hành vi hiện tại»): nháp tài liệu **và nháp ứng viên** của một dự án đang có chữ đã lưu mà cấu hình không cho hiện thì bị che và bị giữ, dù nháp nêu mã gì và dù chữ đó thuộc luồng nào của dự án. Giới hạn còn lại sau giữ chỗ đó, với cả hai loại nháp: chữ của tin thuộc **dự án khác** — không phép kiểm nào thấy; chữ của tin **đang** được hiện — không bị che, và không phải lộ mới vì người có quyền quyết định một nháp cũng có vai đọc hộp tin của dự án (`src/server/inbox.ts:30`).
- **Phương án:** (a) nháp ứng viên bị che khi luồng của nó có ít nhất một bản của tin đã lưu chữ mà cấu hình hiện tại không cho hiện, dù nháp có nêu tin đó hay không, và nháp đang bị che như vậy không xác nhận được; với nháp tài liệu chấp nhận giới hạn nêu trên; (b) như (a), thêm luật ở phía pipeline để chữ của tin không vào nháp tài liệu (ví dụ nháp tài liệu chỉ được dựng từ ngữ cảnh không có tin) — thuộc thiết kế pipeline, trước khi bật Z4; (c) chỉ che theo mã nháp tự khai (đọc đúng chữ quyết định): nháp không nêu tin không bị che; (d) che mọi nháp không có nguồn hoặc có nhận định không nêu căn cứ, cho cả hai loại nháp — che cả những nháp không liên quan tới tin, và vẫn không thấy chữ chép kèm một căn cứ khác; (e) như (a), và che mọi nháp tài liệu của một dự án khi dự án đó có bất kỳ chữ của tin đã lưu nào đang không được hiện — chặt nhất, không cần pipeline; hệ quả: gỡ cờ một nhóm là che mọi nháp tài liệu của cả dự án.
- **Ai quyết:** Chairman (chạm luật hiển thị chữ của tin — OQ-28, OQ-30 — và `AGENTS.md:16`). **Đã quyết 19/11/2026 (Chairman):** (b) làm đích; giữ hành vi `PROJECT_TEXT_HIDDEN` hiện tại tới khi có thiết kế pipeline; lời Chairman chép nguyên ở khối «Quyết định của Chairman ngày 19/11/2026 về OQ-53 đến OQ-56», cuối tệp. Mã của PR #22 không đổi vì quyết định này.
- **Khuyến nghị của planner (không phải quyết định):** (a) ngay trong PR này; (b) khi thiết kế pipeline.
- **Hành vi hiện tại (không phải phương án được chọn):** ở base `4f12a3c` mọi vai đọc nhận nội dung của mọi nháp (rộng hơn cả (c)). Kế hoạch `docs/plans/oq-45-46-ai-drafts.md` bản 0.2 đặt **giữ chỗ fail-closed, không phải phương án được chọn**: trùng (a), mã lý do `THREAD_TEXT_HIDDEN`, theo phán quyết của phiên chính sau cổng bảo mật lượt 1. Với nháp tài liệu, tới `83d5e2f` PR đó không viết mã nào, và đó không phải hướng chặt nhất. **Từ vòng sửa 1 của cổng Codex (kế hoạch bản 0.6, Task F2; finding CX2 [P0]; cổng bảo mật trên thiết kế vòng sửa, mục N2), theo phán quyết của phiên chính:** PR đặt một **giữ chỗ fail-closed thứ hai, cũng không phải phương án được chọn**: **mọi nháp — nháp tài liệu và nháp ứng viên —** bị che lúc đọc và bị giữ lúc xác nhận khi **dự án** của nó có ít nhất một bản của tin đã lưu chữ mà cấu hình hiện tại không cho hiện (mã lý do `PROJECT_TEXT_HIDDEN`); `THREAD_TEXT_HIDDEN` vẫn được tính cho nháp ứng viên; từ chối vẫn làm được. Giữ chỗ này **rộng hơn chữ của (e)**: (e) chỉ nói «mọi nháp tài liệu của một dự án», còn với nháp ứng viên thì (e) xét luồng của chính ứng viên, như (a). Theo đúng chữ của (e), một nháp ứng viên chép chữ đang ẩn của **luồng khác cùng dự án** vẫn được trả; không phương án nào trong (a)–(e) nói tới trường hợp đó, nên nếu chọn (e) cần nói rõ có gồm nháp ứng viên theo dự án hay không. Cái giá của giữ chỗ: gỡ cờ một nhóm — hoặc để danh sách nhóm mặc định rỗng — là che và giữ **mọi nháp** của cả dự án. Giới hạn còn lại: chữ của tin thuộc dự án khác — không phép kiểm nào thấy; chữ của tin đang được hiện — không bị che. Đổi sang phương án khác là đổi một nhánh ở bước che và một nhánh ở bước giữ, cho từng giữ chỗ.

---

**Bổ sung 18/11/2026 sau review bảo mật tầng 1 trên cả nhánh của PR mã OQ-45 và OQ-46** (`docs/reviews/oq-45-46-evidence-20261118/gates/tier1-security.md`, mục P2-1 và P2-3). Do phiên của PR ghi khi **chưa có quyết định**; đặt ở cuối tệp để các số dòng đã được trích ở tài liệu khác không xê dịch. **Không mục nào chặn PR đó:** mã không đổi vì hai mục này. Cả hai **cần có quyết định trước khi bật Z4**.

## OQ-56 — Nháp AI của dự án chưa có dòng ánh xạ miền báo cáo có được lưu và được đọc không

- **Lát:** sau PR mã của OQ-45 và OQ-46; trước khi bật Z4. Không task nào của PR đó phụ thuộc mục này.
- **Phía A:** quyết định OQ-45 điểm 3 (b) (`docs/OPEN-QUESTIONS.md:859`) nói về nháp của dự án `IBS_HI`; điểm 2 (b) (`docs/OPEN-QUESTIONS.md:858`) nói «dự án đang chỉ con trỏ». Mã đọc đúng chữ: guard của migration 022 chỉ từ chối khi dòng ánh xạ có `mapping_version` cao nhất của dự án là `IBS_HI` (`migrations/022_ai_drafts_pointer_only_guard.sql`), và dịch vụ coi một dự án là «chỉ con trỏ» theo cùng luật (`src/server/source-text.ts:17-21`). Một dự án **chưa có dòng ánh xạ nào** vì vậy nhận nháp AI, và nội dung nháp được trả cho người có quyền xác nhận. Chữ của tin Telegram theo cùng luật: quyết định OQ-28 (c) (`docs/OPEN-QUESTIONS.md:309`) cho lưu trích theo cờ của từng nhóm, «độc lập với nhãn miền».
- **Phía B:** `AGENTS.md:16`: dự án chưa ánh xạ hiện «Chưa xác nhận», tức chưa ai xác nhận nó không phải của IBS HI. Hệ quả đã ghi ở OQ-28 (`docs/OPEN-QUESTIONS.md:315`): chưa có đường ghi `project_domain_mappings`, nên ở dữ liệu thật **mọi** dự án đang «Chưa xác nhận». Khi đó guard không từ chối dự án nào, kể cả một dự án về sau được xác nhận là của IBS HI; nội dung nháp đã lưu của dự án đó nằm lại trong Z4 (OQ-54). Lời Chairman ngày 18/11/2026 không nói về dự án chưa ánh xạ. Với chữ của tin còn có cờ theo nhóm do người vận hành khai (OQ-28 (c)); với nháp AI không có cờ nào tương đương — chỉ có việc ngữ cảnh trao cho kỹ năng không mang chữ của tin đang ẩn.
- **Phương án:** (a) như hiện nay: chỉ dự án có dòng ánh xạ mới nhất là `IBS_HI` mới bị từ chối lúc ghi và bị che lúc đọc; dự án chưa ánh xạ được ghi và được đọc như dự án của Liberico BU hay Xeca; (b) với nháp AI, dự án chưa ánh xạ được coi như chỉ con trỏ: từ chối lúc ghi, che lúc đọc, giữ lúc xác nhận, cho tới khi có dòng ánh xạ không phải `IBS_HI` — hệ quả: với dữ liệu thật hôm nay không dự án nào nhận nháp AI cho tới khi có đường ghi ánh xạ; (c) một cờ vận hành theo dự án (hoặc dùng lại cờ theo nhóm của OQ-28 (c)) cho phép ghi nháp AI khi dự án chưa ánh xạ.
- **Ai quyết:** Chairman (chạm `AGENTS.md:16` và chính sách dữ liệu giữa các pháp nhân). **Đã quyết 19/11/2026 (Chairman):** (b); thời điểm làm, Chairman chọn qua hộp chọn của phiên điều phối: cùng thiết kế login AI; lời và hộp chọn chép nguyên ở khối «Quyết định của Chairman ngày 19/11/2026 về OQ-53 đến OQ-56», cuối tệp. Mã của PR #22 vẫn ở (a) cho tới lúc đó.
- **Khuyến nghị của phiên PR (không phải quyết định):** quyết cùng lúc với phần «Kèm» còn mở của OQ-28 (ai và ở lát nào làm đường ghi dòng ánh xạ); nếu Z4 được bật trước khi có đường ghi ánh xạ thì (b).
- **Hành vi hiện tại (không phải phương án được chọn):** trùng (a), ở base `4f12a3c` và sau PR mã của OQ-45 và OQ-46: PR đó không thêm mã nào cho điểm này và không tự chọn (b). Ca G2 (`tests/z4-pointer-guard.test.ts`) và S3 (`tests/suggestions.test.ts`) ghim hành vi đó. Z4 chưa bật nên chưa có dòng nháp nào ngoài CSDL thử.

**Bổ sung cho OQ-53 — điểm 3: khe theo thứ tự commit của đường nhận tin** (cùng báo cáo, mục P2-3). Hai điểm của OQ-53 hỏi về thứ nháp nêu. Còn một khe không nằm trong phương án nào của chúng: mốc của luồng tin tính theo thời điểm **bắt đầu** giao dịch nhận tin (đoạn «Khe hở của mọi mốc tính bằng thời điểm ghi» ở `docs/OPEN-QUESTIONS.md:876`), nên một tin hoặc bản sửa mà giao dịch nhận bắt đầu trước mốc nhưng commit sau khi pipeline đọc ngữ cảnh sẽ không bao giờ làm nháp bị giữ. Phương án: (a) chấp nhận như phần dư; (b) một số thứ tự theo luồng do CSDL cấp lúc ghi, đọc được sau commit — cần migration và đổi đường nhận tin; (c) phép kiểm lấy một khoá xếp hàng với đường nhận tin — hôm nay đường nhận tin không khoá dòng ứng viên nên cũng phải đổi nó. **Ai quyết:** Chairman, hoặc BoM Tech nếu Chairman giao, cùng lúc với hai điểm kia. **Hành vi hiện tại (không phải phương án được chọn):** ở base `4f12a3c` và trên nhánh của PR mã OQ-45 và OQ-46 tới `83d5e2f`: trùng (a), không có mã nào cho điểm này. **Từ vòng sửa 1 của cổng Codex trên PR đó (kế hoạch `docs/plans/oq-45-46-ai-drafts.md` bản 0.5, Task F3; finding CX3 [P1]):** theo quyết định **phạm vi** của Chairman ngày 18/11/2026 cho PR đó (khối chép nguyên ở cuối tệp, `docs/OPEN-QUESTIONS.md:928`), PR đặt một **giữ chỗ fail-closed, không phải phương án được chọn**, không trùng (a), (b) hay (c): lệnh xác nhận **mọi** nháp ứng viên bị giữ (mã lý do `SUBJECT_ORDER_UNVERIFIED`, nêu cùng các mã khác trong câu `DRAFT_HELD`); từ chối vẫn làm được; lúc đọc không che thêm gì; nháp tài liệu không đổi. **Điểm 3 vẫn mở:** Chairman chưa chọn (a), (b) hay (c). Gỡ giữ chỗ là bỏ một dòng ở bước giữ của lệnh xác nhận. **Quyết định 19/11/2026 (Chairman):** (b), trong PR riêng của OQ-53; câu «Điểm 3 vẫn mở» ở trên tả ngày 18/11/2026. Giữ chỗ `SUBJECT_ORDER_UNVERIFIED` ở lại cho tới khi PR riêng đó merge (khối «Quyết định của Chairman ngày 19/11/2026 về OQ-53 đến OQ-56», cuối tệp).

---

**Quyết định phạm vi của Chairman ngày 18/11/2026 cho PR mã của OQ-45 và OQ-46, về điểm 3 của OQ-53 (Chairman chọn qua hộp chọn của phiên điều phối; phiên điều phối chuyển lời; agent `planner` chép từ tin của phiên điều phối và không thấy hộp chọn):** «B: chặn tạm (Recommended)». Khối này đặt ở cuối tệp để các số dòng đã được trích ở tài liệu khác không xê dịch; nó thuộc về điểm 3 của OQ-53 (`docs/OPEN-QUESTIONS.md:924`). **Đây là quyết định về phạm vi của một PR. Điểm 3 của OQ-53 vẫn mở.** (Câu «vẫn mở» tả ngày 18/11/2026; ngày 19/11/2026 Chairman đã quyết điểm 3: (b), xem khối cuối tệp.)
- Câu hỏi đã hiện trong hộp chọn, chép nguyên: «PR mã OQ-45/OQ-46: cổng Codex vòng 1 còn một mục P1 ngoài phạm vi brief (khe thứ tự commit của đường nhận tin, điểm 3 của OQ-53: một tin commit muộn vẫn để nháp ứng viên cũ được xác nhận). Anh chọn cách nào cho PR này?»
- Ba phương án đã hiện, chép nguyên — nhãn, rồi chữ của phương án:
  - «B: chặn tạm (Recommended)» — «Giữ chỗ fail-closed: không nháp ứng viên nào xác nhận được cho tới khi anh quyết điểm 3 của OQ-53. Nằm trong phạm vi brief; phải đổi kỳ vọng các ca của lát 3 đang xác nhận nháp ứng viên. Z4 đang tắt, chưa có login AI nên hôm nay không có nháp thật nào bị chặn.»
  - «A: mở rộng phạm vi» — «Migration 022 thêm trigger trên hai bảng nhận tin của lát 2 (source_events, source_event_revisions): khoá theo luồng và ghi thời điểm lúc chèn; lệnh xác nhận lấy cùng khoá. Đóng cả hai khe, nhưng đổi hành vi ghi của hai bảng đã merge (created_at thành lúc chèn thay vì lúc bắt đầu giao dịch) và thực chất là chọn cách làm cho điểm 3 của OQ-53.»
  - «C: để nguyên, dừng» — «Giữ khe này như phần dư đã ghi. Phiên việc báo cổng Codex chưa hội tụ ở đúng mục này và dừng theo brief; PR chưa đạt điều kiện «không còn P0/P1» nên chờ anh phán tiếp.»
- Chuỗi trả lời của Chairman, chép nguyên: «B: chặn tạm (Recommended)».
- Trạng thái mã lúc ghi (`83d5e2f`): chưa có mã cho quyết định này; ở điểm 3 hành vi vẫn trùng (a) của điểm đó. Kế hoạch `docs/plans/oq-45-46-ai-drafts.md` bản 0.5 (Task F3 của vòng sửa 1 của cổng Codex) đặt giữ chỗ: lệnh xác nhận một nháp ứng viên luôn trả `DRAFT_HELD` có mã `SUBJECT_ORDER_UNVERIFIED` — tên mã do planner đặt, không phải lời Chairman; từ chối vẫn làm được; lúc đọc không che thêm gì; nháp tài liệu không đổi. Mười một ca của `tests/suggestions.test.ts` đang xác nhận thành công một nháp ứng viên đổi kỳ vọng vì quyết định này (bảng E1–E11 của kế hoạch). Không tuyến HTTP nào nhập `SuggestionService` (ca «no route imports the suggestion service» vẫn giữ); Z4 chưa bật.
- Ghi chú của phiên điều phối kèm quyết định (không phải lời Chairman):
  1. Đây là quyết định phạm vi cho PR này. Điểm 3 của OQ-53 vẫn mở: Chairman chưa chọn (a), (b) hay (c). Giữ chỗ mới ghi như các giữ chỗ khác của PR: «giữ chỗ fail-closed, không phải phương án được chọn».
  2. Phương án (A) không được chọn: không thêm trigger hay cột vào `source_events`, `source_event_revisions`; không sửa `src/server/intake.ts`.
  3. Nhãn «(Recommended)» là đề xuất của phiên điều phối. Lý do nêu với Chairman chỉ có trong chữ của phương án ở trên; không ghi thêm lý do nào khác thành lời Chairman.
  4. Trần hai vòng sửa của cổng Codex vẫn giữ.

---

**Quyết định của Chairman ngày 19/11/2026 về OQ-53 đến OQ-56 (Chairman dán lời vào phiên điều phối, rồi chọn qua hộp chọn của phiên điều phối cho thời điểm làm OQ-56 (b); phiên điều phối chuyển lời; phiên của PR #22 chép từ tin của phiên điều phối và không thấy lời gốc lẫn hộp chọn).** Khối này đặt ở cuối tệp để các số dòng đã được trích ở tài liệu khác không xê dịch; nó thuộc về OQ-53 (`docs/OPEN-QUESTIONS.md:872`, điểm 3 ở `:924`), OQ-54 (`:884`), OQ-55 (`:899`) và OQ-56 (`:914`). **Mã của PR #22 (nhánh `feat/oq-45-46-ai-drafts`) không đổi vì các quyết định này**; commit mang khối này chỉ đổi hồ sơ.

Lời Chairman, chép nguyên, không lược — bốn dòng; phiên điều phối chuyển cả bốn trong một cặp «»:

```text
OQ-53: điểm 1 (b), điểm 2 (a), điểm 3 (b) — làm thành một PR riêng, giữ hành vi chặt tới khi PR đó merge; sửa ngữ cảnh release_librarian trong cùng PR.
OQ-54: (b), làm cùng thiết kế login AI.
OQ-55: (b) làm đích; giữ hành vi PROJECT_TEXT_HIDDEN hiện tại tới khi có thiết kế pipeline.
OQ-56: (b).
```

- Lời trên không nói OQ-56 (b) làm lúc nào. Phiên điều phối hỏi lại Chairman qua hộp chọn. Câu hỏi đã hiện, chép nguyên: «OQ-56 (b): với nháp AI, dự án chưa có dòng ánh xạ miền báo cáo được coi như chỉ con trỏ (từ chối lúc ghi, che lúc đọc, giữ lúc xác nhận). Mã của PR #22 đang ở (a) và ca G2/S3 ghim hành vi đó. Làm (b) vào lúc nào?»
- Ba phương án đã hiện, chép nguyên — nhãn, rồi chữ của phương án:
  - «Cùng login AI (Recommended)» — «PR #22 giữ nguyên (a) và đi tiếp; (b) làm cùng thiết kế login AI, cùng chỗ với OQ-54 (b). Role AI chưa có login và Z4 đang tắt nên chưa nháp thật nào được ghi trong lúc đó. PR #22 đã qua cổng Codex vòng 3 nên không phải mở lại.»
  - «PR riêng nhỏ sau PR #22» — «Một PR riêng với migration 023 nới guard cho dự án chưa ánh xạ, đi trước login AI. Gỡ khoảng hở (a) sớm hơn nhưng thêm một PR và một vòng cổng riêng.»
  - «Ngay trong PR #22» — «Sửa migration 022, dịch vụ và hai ca G2/S3 trong chính PR #22. PR đổi mã sau khi đã qua cổng Codex và hai vòng sửa của cổng đã dùng hết, nên cổng phải chạy lại.»
- Chuỗi trả lời của Chairman, chép nguyên: «Cùng login AI (Recommended)».
- Chữ của các phương án Chairman nêu nhãn, chép từ các mục ở trên (không phải lời Chairman):
  - OQ-53, điểm 1 **(b)** (`:878`) — «mở rộng hợp đồng đầu ra để nháp nêu hash (hoặc số bản) của từng tin nó trích, lúc xác nhận so với bản mới nhất của tin — chính xác, không giữ oan; phải đổi hợp đồng, prompt, manifest và bộ eval của các kỹ năng nhận tin».
  - OQ-53, điểm 2 **(a)** (`:879`) — «không có mốc thì không xác nhận được: giữ nháp khi tài liệu đã có ít nhất một bản (luồng thì luôn có ít nhất một tin) — pipeline buộc phải nêu bản hay tin nó đã đọc».
  - OQ-53, điểm 3 **(b)** (`:924`) — «một số thứ tự theo luồng do CSDL cấp lúc ghi, đọc được sau commit — cần migration và đổi đường nhận tin».
  - OQ-54 **(b)** (`:889`) — «thêm một lệnh có kiểm soát để xoá trắng nội dung (`value`, `questions`) của nháp thuộc dự án đang `IBS_HI`, giữ mã và hash — phải nới luật bất biến của bảng bằng một migration và một đường ghi mới có người chịu trách nhiệm».
  - OQ-55 **(b)** (`:905`) — «như (a), thêm luật ở phía pipeline để chữ của tin không vào nháp tài liệu (ví dụ nháp tài liệu chỉ được dựng từ ngữ cảnh không có tin) — thuộc thiết kế pipeline, trước khi bật Z4». Phương án (a) mà (b) dẫn lại — «nháp ứng viên bị che khi luồng của nó có ít nhất một bản của tin đã lưu chữ mà cấu hình hiện tại không cho hiện, dù nháp có nêu tin đó hay không, và nháp đang bị che như vậy không xác nhận được; với nháp tài liệu chấp nhận giới hạn nêu trên».
  - OQ-56 **(b)** (`:919`) — «với nháp AI, dự án chưa ánh xạ được coi như chỉ con trỏ: từ chối lúc ghi, che lúc đọc, giữ lúc xác nhận, cho tới khi có dòng ánh xạ không phải `IBS_HI` — hệ quả: với dữ liệu thật hôm nay không dự án nào nhận nháp AI cho tới khi có đường ghi ánh xạ».
- Ánh xạ của phiên điều phối (không phải lời Chairman; chép từ tin của phiên điều phối):
  1. **OQ-53 điểm 1 (b)** = chữ của phương án 1 (b) ở `:878`: nháp nêu hash hoặc số bản của từng tin nó trích; lúc xác nhận so với bản mới nhất. **Điểm 2 (a)** = chữ ở `:879`: không có mốc thì không xác nhận được; `SUBJECT_BASELINE_MISSING` từ nay là hành vi đã quyết, không còn là giữ chỗ. **Điểm 3 (b)** = chữ ở `:924`: một số thứ tự theo luồng do CSDL cấp lúc ghi, đọc được sau commit, cần migration và đổi đường nhận tin. Ba điểm làm thành **một PR riêng**, không phải PR #22.
  2. «Giữ hành vi chặt tới khi PR đó merge» = hai giữ chỗ `SUBJECT_EDIT_UNVERIFIED` và `SUBJECT_ORDER_UNVERIFIED` ở lại nguyên trong PR #22 và sau khi PR #22 merge, cho tới khi PR riêng của OQ-53 merge.
  3. «Sửa ngữ cảnh release_librarian trong cùng PR»: phiên điều phối đọc «cùng PR» là PR riêng của OQ-53, không phải PR #22. Đây là cách đọc của phiên điều phối; hệ quả cần sửa là nháp `release_librarian` trên tài liệu có bản nhưng chưa có bản chuẩn luôn bị giữ (`:879`).
  4. **OQ-54 (b)** = chữ ở `:889`: một lệnh có kiểm soát xoá trắng nội dung của nháp thuộc dự án đang `IBS_HI`, cần migration nới luật bất biến. Làm cùng thiết kế login AI; **không có mã nào trong PR #22**; hành vi hiện tại giữ (a).
  5. **OQ-55 (b)** = chữ ở `:905`: như (a), thêm luật phía pipeline để chữ của tin không vào nháp tài liệu; (b) là đích. `PROJECT_TEXT_HIDDEN` hiện tại ở lại nguyên cho tới khi có thiết kế pipeline; không đổi mã trong PR #22.
  6. **OQ-56 (b)** = chữ ở `:919`: dự án chưa ánh xạ coi như chỉ con trỏ cho nháp AI. Theo hộp chọn: làm cùng thiết kế login AI. Trong PR #22 mã vẫn ở (a), ca G2 và S3 giữ nguyên.
  7. Về thiết kế điểm 3 (b) cho PR riêng, ghi để người lập kế hoạch sau này cân (#inference, chưa kiểm): một số cấp bằng `nextval` được cấp lúc gọi, không phải lúc commit, nên hai giao dịch cùng luồng vẫn có thể commit ngược thứ tự và khe hở còn. «Đọc được sau commit» chỉ đóng khe nếu việc cấp số được xếp hàng theo luồng tới lúc commit (ví dụ một dòng đếm theo luồng bị khoá, hoặc khoá tư vấn theo luồng lấy trước khi cấp số). Quyết định của Chairman không chọn cách làm.
  8. Nhãn «(Recommended)» là đề xuất của phiên điều phối. Lý do nêu với Chairman chỉ có trong chữ của phương án ở trên; không ghi thêm lý do nào khác thành lời Chairman.
- Trạng thái mã lúc ghi (nhánh `feat/oq-45-46-ai-drafts`, PR #22, đầu `2ffa8bb`; mã `src/` đổi lần cuối ở `d9b0974`, `migrations/` ở `05a6da0`, `tests/` ở `9b0f83f`). Chưa có mã mới cho quyết định nào ở trên; điểm 2 (a) của OQ-53 là điểm duy nhất mà mã của PR #22 đã trùng:
  - OQ-53 điểm 1: mã trùng 1 (a) (`SUBJECT_EDIT_UNVERIFIED`), không phải phương án được chọn; ở lại cho tới khi PR riêng merge.
  - OQ-53 điểm 2: `SUBJECT_BASELINE_MISSING` trùng 2 (a). Hệ quả ghi ở `:879` — nháp `release_librarian` trên tài liệu đã có bản nhưng chưa có bản chuẩn luôn bị giữ — còn nguyên cho tới PR riêng.
  - OQ-53 điểm 3: `SUBJECT_ORDER_UNVERIFIED` không trùng (a), (b) hay (c); ở lại cho tới khi PR riêng merge. Cho tới lúc đó **không nháp ứng viên nào xác nhận được**; từ chối vẫn làm được.
  - OQ-54: không có mã; hành vi trùng (a).
  - OQ-55: `THREAD_TEXT_HIDDEN` (trùng (a)) và `PROJECT_TEXT_HIDDEN` (rộng hơn mọi phương án, `:908`) ở lại nguyên; chưa có pipeline nên chưa có luật phía pipeline nào.
  - OQ-56: không có mã; hành vi trùng (a); ca G2 (`tests/z4-pointer-guard.test.ts`) và S3 (`tests/suggestions.test.ts`) ghim (a).
  - Không tuyến HTTP nào nhập `SuggestionService`; Z4 chưa bật; migration 022 chưa áp ở đâu ngoài CSDL thử của PR #22 (đã xoá).
- Ghi chú của phiên PR #22 (không phải lời Chairman, không phải ánh xạ của phiên điều phối):
  1. Các câu «chưa có quyết định», «không phải phương án được chọn», «Chairman chưa chọn» và «Điểm 3 vẫn mở» ở các mục và các khối phía trên tả ngày chúng được ghi (18/11/2026) và không được viết lại. Con trỏ tại chỗ tới khối này, không thêm dòng: dòng «Ai quyết» của bốn mục, dòng «Hành vi hiện tại» của OQ-53, đoạn điểm 3 (`:924`), khối quyết định phạm vi (`:928`) và dòng «Hành vi hiện tại» của OQ-46 (`:687`).
  2. Theo ánh xạ 1, `SUBJECT_BASELINE_MISSING` không còn là giữ chỗ. Bốn mã còn là giữ chỗ fail-closed, không phải phương án được chọn, cho tới khi PR hoặc thiết kế mang phương án được chọn xong: `SUBJECT_EDIT_UNVERIFIED`, `SUBJECT_ORDER_UNVERIFIED`, `THREAD_TEXT_HIDDEN`, `PROJECT_TEXT_HIDDEN`.
  3. `THREAD_TEXT_HIDDEN`: hành vi của nó trùng phương án (a) của OQ-55, và chữ của (b) mở đầu bằng «như (a)». Lời Chairman và ánh xạ của phiên điều phối không nói riêng về mã này; phiên PR giữ nhãn giữ chỗ cho nó.
  4. Một điểm lời Chairman cho OQ-55 chưa phủ, **để thiết kế pipeline nêu lại, khối này không chọn gì**: mục OQ-55 đã ghi (`:908`) rằng không phương án nào trong (a)–(e) nói tới nháp ứng viên chép chữ đang ẩn của **luồng khác cùng dự án**. Hôm nay `PROJECT_TEXT_HIDDEN` che trường hợp đó. Khi thiết kế pipeline thay giữ chỗ này bằng (b), trường hợp đó cần một lời quyết, hoặc một câu hỏi mở mới.
  5. Về ví dụ «khoá tư vấn theo luồng» ở ánh xạ 7: ở PR #22, review CSDL (mục DB-9) và review bảo mật (mục S-1) cùng nêu rằng khoá tư vấn không có kiểm quyền — mọi role của CSDL lấy được khoá của bất kỳ dự án nào — và migration 022 vì vậy đã đổi sang khoá dòng (kế hoạch `docs/plans/oq-45-46-ai-drafts.md`, mục «07.1 · Vì sao cơ chế khoá của CX4 đổi»; số đo của khoá dòng ở `docs/reviews/oq-45-46-evidence-20261118/measurements-pg16-rowlock.txt`). Người lập kế hoạch của PR riêng cần cân điều này.
  6. Chưa bắt đầu: PR riêng của OQ-53 (theo phiên điều phối, nó dựa vào mã giữ chỗ và migration 022 của PR #22 nên đợi PR #22 merge) và thiết kế login AI. Bốn mục đã có quyết định, nhưng mã cho chúng chưa có: việc bật Z4 **vẫn dừng**, với đủ các điều kiện ở ghi chú 3 của khối ngày 18/11/2026 (`:865`). Các điểm dừng không đổi: không merge khi chưa có lời Chairman, không áp migration lên dữ liệu thật, không bật Z4.

---

**Bổ sung 19/11/2026 khi lập kế hoạch cho PR riêng của OQ-53** (`docs/plans/oq-53-subject-verification.md`, bản 0.1; gốc `80c1ad8`). Do agent `planner` ghi khi **chưa có quyết định**; khối này nối cuối tệp để các số dòng đã được trích ở tài liệu khác không xê dịch. Mục dưới đây thuộc câu «sửa ngữ cảnh release_librarian trong cùng PR» của lời Chairman ngày 19/11/2026 (`docs/OPEN-QUESTIONS.md:949`). **Nó chặn đúng một task của PR đó** (Task 8); bảy task còn lại không phụ thuộc. Theo lời Chairman việc sửa nằm trong cùng PR, nên PR chưa xong khi mục này chưa có lời.

## OQ-57 — Ngữ cảnh `release_librarian` được sửa thế nào để nháp của nó có thứ để nêu, khi luật R10-g của lát 3 chỉ trao bản chuẩn

- **Lát:** PR riêng của OQ-53 (Task 8 của `docs/plans/oq-53-subject-verification.md`: «dừng tại OQ-57»); trước khi bật Z4.
- **Phía A:** lời Chairman ngày 19/11/2026: «sửa ngữ cảnh release_librarian trong cùng PR» (`docs/OPEN-QUESTIONS.md:949`). Hệ quả cần sửa, theo ánh xạ 3 của phiên điều phối (`:971`) và mục OQ-53 (`:879`): với điểm 2 (a), nháp `release_librarian` trên một tài liệu đã có bản nhưng chưa có bản chuẩn luôn bị giữ `SUBJECT_BASELINE_MISSING`, vì ngữ cảnh của kỹ năng đó không có bản nào để nêu. Cùng gốc: theo cách hiểu C7 của PR #22 (`docs/plans/oq-45-46-ai-drafts.md:75`), «tài liệu có bản mới hơn» tính cả bản chưa duyệt, nên nháp của kỹ năng này cũng không xác nhận được khi tài liệu có một bản trình mới hơn bản chuẩn — bản mà ngữ cảnh không trao.
- **Phía B:** luật R10-g của lát 3: ngữ cảnh của `release_librarian` chỉ có bản chuẩn — dòng khai ở `src/server/skill-context.ts:27` («revisions: only the approved one (R10-g)»), câu lệnh ở `:76-86`, ca «R10-g: the release librarian gets only the approved revision; none when nothing is approved» (`tests/skill-context.test.ts:283`), kế hoạch lát 3 (`docs/plans/slice-3-review-skills.md:992`: «(chỉ bản chuẩn)»). Gốc của luật là hàng Release librarian của SPEC-009 (`docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:104`): đầu vào «Revision được duyệt, bằng chứng, audience»; điều kiện kiểm «Không công bố draft/internal». Mọi cách cho nháp «một bản để nêu» trên tài liệu chưa có bản chuẩn đều đưa vào ngữ cảnh một bản chưa duyệt, hoặc đổi luật mốc cho riêng kỹ năng này. Lời Chairman không nói cách nào. Điều đã có sẵn trong ngữ cảnh hôm nay: nguồn `document` của mọi kỹ năng mang `latestRevisionId` — mã của bản mới nhất, kể cả khi chưa duyệt (`src/server/skill-context.ts:72`); nháp không nêu được mã đó vì nó không phải một nguồn (`SOURCE_OUT_OF_CONTEXT`).
- **Phương án** (hai điểm, quyết riêng từng điểm):
  1. Thứ nháp `release_librarian` được nêu: (a) ngữ cảnh thêm **một nguồn chỉ-con-trỏ** cho bản mới nhất của tài liệu khi bản đó không phải bản chuẩn — mã, mã tài liệu, số bản; không tóm tắt, không danh sách «có/thiếu», không hash nguồn; nội dung vẫn chỉ của bản chuẩn. R10-g khi đó đọc là «chỉ **nội dung** của bản chuẩn». `NOT_APPROVED_REVISION` không đổi: `index[].revisionId` và `approvedRevisionId` vẫn phải là bản chuẩn; (b) không thêm nguồn nào; với riêng kỹ năng này mốc là **con trỏ bản chuẩn**: nháp bị giữ khi bản chuẩn của tài liệu khác bản nháp nêu, và trên tài liệu chưa có bản chuẩn thì nháp không bị giữ vì thiếu mốc. R10-g giữ nguyên chữ; nhưng đây là đổi luật mốc chứ không đổi ngữ cảnh, và nó nới điểm 2 (a) của OQ-53 cho một kỹ năng; (c) trao cho kỹ năng này mọi bản như `doc_reviewer` — bỏ R10-g, trái hàng Release librarian của SPEC-009; (d) để nguyên — trái lời Chairman.
  2. Một bản **chưa duyệt** mới hơn bản chuẩn có làm nháp `release_librarian` «đã cũ» không: (a) có, như mọi kỹ năng (C7): nháp phải nêu cả bản mới nhất (với 1 (a): nêu con trỏ của nó), và một bản được trình **sau** khi nháp viết xong giữ nháp `SUBJECT_CHANGED` dù bản chuẩn không đổi; (b) không: với kỹ năng này chỉ việc con trỏ bản chuẩn đổi mới giữ nháp — đổi cách hiểu C7 và chữ «tài liệu có bản mới hơn» của OQ-46 (b) cho một kỹ năng. Phương án 1 (b) kéo theo 2 (b); 1 (a) và 1 (c) đi được với cả hai.
- **Ai quyết:** Chairman (chạm lời ngày 19/11/2026, luật R10-g và hàng Release librarian của SPEC-009); BoM Tech nếu Chairman giao. **Đã quyết 19/11/2026 (Chairman):** điểm 1 (a), điểm 2 (a); chuỗi trả lời của Chairman chép nguyên ở khối «Quyết định của Chairman ngày 19/11/2026 về OQ-57», cuối tệp. Task 8 được làm trong cùng PR.
- **Khuyến nghị của planner (không phải quyết định):** điểm 1: (a); điểm 2: (a). Lý do: (a) đúng chữ «sửa ngữ cảnh», không trao nội dung chưa duyệt, không đặt luật mốc riêng cho một kỹ năng, và điều nó thêm vào ngữ cảnh (mã của bản mới nhất) đã có trong nguồn `document`.
- **Hành vi hiện tại (không phải phương án được chọn):** ở `80c1ad8` (sau PR #22): trùng 1 (d) và 2 (a) — nháp `release_librarian` luôn bị giữ `SUBJECT_BASELINE_MISSING` khi tài liệu có bản mà chưa có bản chuẩn (R28 của PR #22), và bị giữ `SUBJECT_CHANGED` khi tài liệu có bản mới hơn bản chuẩn. Kế hoạch `docs/plans/oq-53-subject-verification.md` bản 0.1 viết sẵn Task 8 cho 1 (a) và 2 (a) và **không làm** task đó khi chưa có lời Chairman; bảy task còn lại của kế hoạch không đổi vì mục này. Z4 chưa bật nên chưa có dòng nháp nào ngoài CSDL thử. **Cập nhật 19/11/2026:** câu «không làm task đó khi chưa có lời Chairman» tả bản 0.1 của kế hoạch; Chairman đã quyết cả hai điểm cùng ngày và Task 8 được làm theo 1 (a) và 2 (a). Mã vẫn chưa có tới lúc Task 8 được viết; hành vi ở `80c1ad8` vẫn như câu trên cho tới khi PR riêng của OQ-53 merge.

---

**Quyết định của Chairman ngày 19/11/2026 về OQ-57 (Chairman chọn qua hộp chọn của phiên điều phối; phiên điều phối chuyển lời; phiên của PR riêng của OQ-53 chép từ tin của phiên điều phối và không thấy hộp chọn).** Khối này nối cuối tệp để các số dòng đã được trích ở tài liệu khác không xê dịch; nó thuộc về OQ-57 (`docs/OPEN-QUESTIONS.md:997`) và về câu «sửa ngữ cảnh release_librarian trong cùng PR» của lời Chairman ngày 19/11/2026 (`:949`).
- Câu hỏi 1 đã hiện, chép nguyên: «OQ-57 điểm 1: anh dặn «sửa ngữ cảnh release_librarian trong cùng PR» nhưng chưa nói cách. Luật R10-g chỉ trao cho kỹ năng này bản chuẩn, nên trên tài liệu có bản mà chưa có bản chuẩn nháp của nó không có bản nào để nêu và luôn bị giữ. Sửa thế nào?»
- Ba phương án đã hiện, chép nguyên — nhãn, rồi chữ của phương án:
  - «Thêm con trỏ (Recommended)» — «Ngữ cảnh thêm một nguồn chỉ-con-trỏ cho bản mới nhất chưa duyệt: mã, mã tài liệu, số bản; không nội dung, không tóm tắt, không hash. Nội dung vẫn chỉ của bản chuẩn; R10-g đọc là «chỉ nội dung của bản chuẩn». Đúng chữ «sửa ngữ cảnh», không đặt luật mốc riêng cho một kỹ năng.»
  - «Mốc là bản chuẩn» — «Không thêm nguồn nào; với kỹ năng này mốc là con trỏ bản chuẩn, nên trên tài liệu chưa có bản chuẩn nháp không bị giữ vì thiếu mốc. Là đổi luật mốc chứ không đổi ngữ cảnh, nới điểm 2 (a) của OQ-53 cho một kỹ năng, và kéo theo «Không» ở điểm 2.»
  - «Trao mọi bản» — «Trao cho kỹ năng này mọi bản như doc_reviewer, tức bỏ R10-g. Trái hàng Release librarian của SPEC-009 («Không công bố draft/internal») và đưa nội dung bản chưa duyệt vào ngữ cảnh.»
- Chuỗi trả lời của Chairman cho câu 1, chép nguyên: «Thêm con trỏ (Recommended)»
- Câu hỏi 2 đã hiện, chép nguyên: «OQ-57 điểm 2: một bản chưa duyệt mới hơn bản chuẩn có làm nháp release_librarian «đã cũ» (bị giữ, mã SUBJECT_CHANGED) không?»
- Hai phương án đã hiện, chép nguyên — nhãn, rồi chữ của phương án:
  - «Có, như mọi kỹ năng (Recommended)» — «Nháp phải nêu cả bản mới nhất (với con trỏ ở điểm 1); một bản được trình sau khi nháp viết xong giữ nháp dù bản chuẩn không đổi. Giữ cách hiểu C7 của PR #22 và chữ «tài liệu có bản mới hơn» của OQ-46 (b).»
  - «Không» — «Chỉ khi con trỏ bản chuẩn đổi mới giữ nháp. Đổi chữ «tài liệu có bản mới hơn» của OQ-46 (b) cho riêng kỹ năng này; bắt buộc nếu điểm 1 chọn «Mốc là bản chuẩn».»
- Chuỗi trả lời của Chairman cho câu 2, chép nguyên: «Có, như mọi kỹ năng (Recommended)»
- Ánh xạ của phiên điều phối (không phải lời Chairman; chép từ tin của phiên điều phối):
  1. Điểm 1 = phương án 1 (a) ở `docs/OPEN-QUESTIONS.md:1003`; điểm 2 = phương án 2 (a) ở `:1004`. Hai điểm trùng khuyến nghị của planner.
  2. Các nhãn «(Recommended)» là đề xuất của phiên điều phối (ứng với khuyến nghị của planner); lý do nêu với Chairman chỉ có trong chữ của phương án ở trên; không ghi thêm lý do nào khác thành lời Chairman.
  3. Task 8 làm theo 1 (a) và 2 (a) trong cùng PR; bỏ trạng thái «dừng tại OQ-57». R10-g từ nay đọc là «chỉ nội dung của bản chuẩn» (chữ của phương án); `NOT_APPROVED_REVISION` không đổi: `index[].revisionId` và `approvedRevisionId` vẫn phải là bản chuẩn (chữ ở `:1003`). Các chỗ trích R10-g (`src/server/skill-context.ts:27`, câu lệnh `:76-86`, ca `tests/skill-context.test.ts:283`, `docs/plans/slice-3-review-skills.md:992`) cần được đối chiếu; chữ ở tài liệu của lát trước chỉ sửa tại chỗ không thêm dòng, hoặc ghi chú ở khối quyết định. Không sửa SPEC-009.
  4. Quyết định này chạm luật R10-g của lát 3, nên cổng bảo mật tầng 1 phải xem riêng điều này: nguồn chỉ-con-trỏ không được mang nội dung, tóm tắt, danh sách «có/thiếu» hay hash nguồn của bản chưa duyệt; ca âm phải ghim điều đó.
- Ghi chú của phiên PR (không phải lời Chairman, không phải ánh xạ của phiên điều phối): trạng thái «dừng tại OQ-57» của Task 8 trong `docs/plans/oq-53-subject-verification.md` (bản 0.2) nay hết hiệu lực; kế hoạch được cập nhật lên bản 0.3 cho Task 8 trước khi builder viết nó. Các câu của mục OQ-57 tả ngày 19/11/2026 trước khi có quyết định (ví dụ «Nó chặn đúng một task của PR đó», và «chưa có quyết định» ở đoạn mở đầu) không được viết lại. Z4 vẫn chưa bật; không merge khi chưa có lời Chairman; không áp migration lên dữ liệu thật.

---

**Bổ sung 19/11/2026 khi quét theo lớp lỗi trước vòng 2 của cổng Codex trên PR riêng của OQ-53** (`docs/reviews/oq-53-evidence-20261119/gates/class-sweep-security.md`, mục CS-S-4). Do phiên PR ghi khi **chưa có quyết định**; đặt ở cuối tệp để các số dòng đã được trích ở tài liệu khác không xê dịch. **Không chặn PR đó:** mã `src/server/intake.ts` không đổi trong PR (nằm trong danh sách «không làm»). Mục này **cần có quyết định trước khi bật Z4**.

## OQ-58 — Tin trả lời đến lúc tin gốc chưa commit có thuộc luồng của tin gốc không

- **Lát:** PR riêng của OQ-53 (điểm 3 (b), số thứ tự theo luồng); trước khi bật Z4. Không task nào của PR đó phụ thuộc mục này.
- **Phía A:** quyết định OQ-46 (b) và OQ-53 điểm 3 (b): một nháp ứng viên bị giữ khi **luồng** của ứng viên có tin hoặc bản sửa mới sau mốc nháp nêu; số thứ tự theo luồng do CSDL cấp (migration 023) đóng khe «giao dịch nhận bắt đầu trước, commit sau» **trong một luồng**. Luồng của một tin được suy ra lúc nhận: tin trả lời lấy `thread_key` của tin gốc nếu đọc được tin gốc, không thì tự lập luồng riêng (`src/server/intake.ts:72`, `src/server/intake-rules.ts` hàm `threadKey`).
- **Phía B:** đường nhận tin đọc tin gốc dưới `READ COMMITTED` nên chỉ thấy tin gốc **đã commit**. Đã đo (CS-S-4, một giao dịch nhận tin gốc P dừng ngay sau khi chèn tin; tin trả lời R được nhận đầy đủ; rồi P đi tiếp): hai luồng `m:<P>` và `m:<R>`, hai ứng viên khác nhau, cả hai `replayed = false`. R không bao giờ làm một nháp về luồng của P bị giữ, dù về nghĩa R trả lời P. Điều kiện cần: tin trả lời đến trong vài chục mili giây sau tin gốc (một phiên tự động trong nhóm, hàng đợi gateway gửi lại sau lỗi). Không rò dữ liệu, không leo quyền; có từ lát 2 và không đổi vì PR này. Lời Chairman ngày 19/11/2026 («điểm 3 (b)») nói về số thứ tự theo luồng, không nói luồng được lập thế nào.
- **Phương án:** (a) chấp nhận: «luồng» là luồng như đã lập lúc nhận; ghi thành giới hạn của «độ mới»; (b) trong `intake.ts`, khoá tư vấn theo `(tenant, chat, message_id)` cho tin đang lưu và cho tin gốc **trước** khi đọc tin gốc: tin trả lời chờ tin gốc commit rồi thấy luồng của nó (không có vòng chờ: tin chỉ trả lời tin có trước) — đổi đường nhận tin đang chạy thật; (c) gộp luồng về sau (khi tin gốc tới, nối luồng của tin trả lời vào luồng của nó): đổi mô hình luồng và số đã cấp; (d) giữ tin trả lời có tin gốc chưa thấy ở trạng thái chờ cho tới khi tin gốc có mặt — đổi hợp đồng với gateway.
- **Ai quyết:** Chairman; BoM Tech nếu Chairman giao (chạm đường nhận tin của lát 2). **Đã quyết 19/11/2026 (Chairman, lời do người dùng dán vào phiên PR #24): (a)** — chép nguyên ở khối cuối tệp.
- **Khuyến nghị của phiên PR (không phải quyết định):** (a) cho PR này; xét (b) khi thiết kế pipeline hoặc khi có số đo tần suất trên dữ liệu thật.
- **Hành vi hiện tại (không phải phương án được chọn):** trùng (a), ở `80c1ad8` và ở nhánh của PR riêng của OQ-53 (mã `intake.ts` không đổi). Z4 chưa bật nên chưa có nháp nào bị ảnh hưởng. **Cập nhật 19/11/2026:** (a) nay là phương án đã chọn, không còn là hành vi chưa quyết; `intake.ts` không đổi.

---

**Quyết định của Chairman ngày 19/11/2026 sau khi PR #24 merge (lời do người dùng dán vào phiên của PR #24 và được ghi như quyết định của Chairman theo người dùng; phiên PR không thấy lời gốc, và phiên điều phối nói rõ nó không xác nhận được nội dung dán).** Khối này nối cuối tệp để các số dòng đã được trích ở tài liệu khác không xê dịch; nó thuộc về PR riêng của OQ-53 (PR #24; biên nhận `docs/DELIVERY-016-oq-53-subject-order-and-revisions-20261119.md`), OQ-53 (`docs/OPEN-QUESTIONS.md:872`), OQ-57 (`:997`) và OQ-58 (`:1034`).

Lời trên, chép nguyên, không lược — bốn dòng:

```text
PR #24 đã merge (23:34). Xác nhận C1–C11.
N6: đồng ý — điều kiện chặn trước khi bật Z4.
023: áp cùng 022 trong một đợt riêng sau N1–N4; làm N4 (bộ cài phục hồi) trước; N2 kiểm trên gateway thật cùng Quân. N15 trước khi bật Z4.
OQ-58: (a). R10-g: thêm ghi chú trỏ sang nghĩa mới, không sửa tại chỗ.
```

- Ánh xạ của phiên PR (không phải lời Chairman; kiểm bằng `gh` và các tệp của PR):
  1. **PR #24 đã merge:** `gh pr view 24` cho trạng thái `MERGED`, merge commit `b978163`, `mergedAt` 2026-11-19T16:34:55Z (23:34 giờ Việt Nam). Cổng Codex của PR đó: vòng 1 `CHANGES_REQUIRED` (một P1, đã sửa), vòng 2 `PASS`.
  2. **«Xác nhận C1–C11»** = các cách hiểu C1–C8, C10, C11 ở `docs/DELIVERY-016-oq-53-subject-order-and-revisions-20261119.md`, mục «Cách hiểu chờ Chairman xác nhận» (C9 đã quyết ở khối OQ-57): số bản `revision_no` thay hash (C1); «từng tin nó trích» là mọi tin của luồng có mã ở bất kỳ trường mã nào (C2); «bản mới nhất» theo `LATEST_REVISION_ORDER` (C3); điểm 3 (b) gồm cả phía xác nhận (C4); đổi đường nhận tin ở tầng CSDL, `intake.ts` không đổi (C5); `SUBJECT_EDIT_UNVERIFIED` biến mất, bản sửa đến sau thành `SUBJECT_CHANGED` (C6); giữ oan được chấp nhận (C7); nhãn hợp đồng `SkillContext/v2`, version `0.2.0` (C8); đánh số bản cũ theo `created_at, revision_no, id` khi áp 023 (C10); nháp `release_librarian` đã nêu con trỏ cũ bị che `SOURCE_OUT_OF_CONTEXT` thay vì `SUBJECT_CHANGED` (C11).
  3. **N6 «điều kiện chặn trước khi bật Z4»** = mã của pipeline, không phải mô hình, ghi `messageRevisions` từ chính ngữ cảnh nó đã đưa, đè lên giá trị mô hình trả về, trước `submitDraft`; không bật Z4 khi chưa có (biên nhận DELIVERY-016, điều kiện N6).
  4. **«023: áp cùng 022 trong một đợt riêng sau N1–N4»** = một đợt triển khai riêng (không thuộc PR #24, không phải phép áp lên dữ liệu thật hôm nay; chưa có lệnh áp nào): migration 022 (PR #22) và 023 (PR #24) được áp cùng nhau lên CSDL thật sau khi N1–N4 xong. Thứ tự Chairman nêu: **N4 trước** — chỉnh bộ cài phục hồi dữ liệu (`deploy/install-user.py:161`, `deploy/install-d1.sh:43`, `docs/DEPLOY-002.md:19`: nạp `pg_restore --data-only` không `--disable-triggers` hỏng sau 023 — đã đo; `--disable-triggers` đặt trigger cấp số từ `A` về `O`); **N2 kiểm trên gateway chạy thật cùng Quân** (người nêu tên trong lời Chairman; việc của người, phiên PR không làm): một lần `55P03` của đường nhận tin là một lần thử lại hay một tin mất; N1 (`idle_in_transaction_session_timeout` ≤ 30 giây cho login nhận tin và login web, kiểm bằng `SHOW`), N3 (đếm bản trước khi áp, trần 250 000, đo trên bản sao dữ liệu thật; migration trước, mã sau). **N5** (không có nháp ứng viên chưa quyết định lúc áp) do chính 023 kiểm. Kế hoạch triển khai của đợt đó vẫn phải có bản sao lưu đã thử phục hồi, cách rollback, danh sách bot bị ảnh hưởng, và tránh 08:30 ngày làm việc và 16:00 thứ Sáu (điểm dừng của quy trình lát).
  5. **N15 «trước khi bật Z4»** = quy trình sửa luồng bị giữ mãi khi có một bản không có số (trigger bị tắt, phục hồi) và quy tắc cho phiên bảo trì cố ý ghi bản không số (khoá `FOR UPDATE` dòng đếm của luồng trước): có người chịu trách nhiệm và đã được viết ra trước khi bật Z4.
  6. **OQ-58 (a)** = chấp nhận: «luồng» là luồng như đã lập lúc nhận; một tin trả lời đến lúc tin gốc chưa commit thành luồng riêng và không làm nháp của luồng tin gốc bị giữ; ghi thành giới hạn của «độ mới»; `src/server/intake.ts` không đổi.
  7. **R10-g «thêm ghi chú trỏ sang nghĩa mới, không sửa tại chỗ»** = một ghi chú nối cuối `docs/plans/slice-3-review-skills.md` và `docs/DELIVERY-012-review-skills-20261115.md` (nơi chữ «chỉ bản chuẩn» của lát 3 nằm: `slice-3-review-skills.md:992` và các dòng cùng nghĩa, `DELIVERY-012…:247`), trỏ tới nghĩa mới «chỉ **nội dung** của bản chuẩn» (OQ-57, khối quyết định cuối tệp này); chữ cũ không sửa. Các hồ sơ bằng chứng của lát 3 (`docs/reviews/slice-3-evidence-20261115/`) và SPEC-009 không đụng.
  8. Các điểm dừng không đổi: không bật Z4; không áp migration lên dữ liệu thật; không triển khai d1-ai1; không khởi động lại gateway chung; không gửi tin vào nhóm thật; không merge PR docs này khi chưa có lời Chairman.
- Việc còn lại sau quyết định này, ghi để phiên sau không phải đoán: (i) **N4** là một việc riêng chạm `deploy/` và cần thử phục hồi — đề xuất một phiên riêng, không nằm trong PR docs này; (ii) PR #25 (ghi trạng thái merge của #22, #23, #24) đang mở: `docs/DELIVERY-016-…` mục «Cần Chairman quyết hoặc xác nhận» và dòng «Chờ Chairman» của khối roadmap của PR này sẽ cũ sau khối này, và được cập nhật SAU khi PR #25 merge, từ đầu mới, để khỏi xung đột; (iii) N1, N2, N3, N6, N15 còn là điều kiện, chưa phải việc đã làm.

---

**Bổ sung 20/11/2026 khi lập kế hoạch N4** (`docs/plans/n4-restore-after-023.md`, mục 8). Do phiên làm N4 ghi khi **chưa có quyết định**; đặt ở cuối tệp để các số dòng đã được trích ở tài liệu khác không xê dịch. **Không chặn N4:** N4 làm xong phần mã và quy tắc, và dừng đúng ở điểm bên dưới. Mục này **cần có quyết định trước khi bật Z4** (lời Chairman 19/11/2026: «N15 trước khi bật Z4»).

## OQ-59 — Ai gỡ, và bằng cách nào, một luồng đã bị giữ vì có bản không có số; và hai bản lưu mà bộ cài phục hồi dừng lại

- **Lát:** N4 (bộ cài phục hồi; `docs/DELIVERY-017-n4-restore-after-023-20261120.md`); điều kiện N15 của `docs/DELIVERY-016-oq-53-subject-order-and-revisions-20261119.md`; trước khi bật Z4.
- **Phía A:** một bản của `source_event_revisions` không có dòng ở `source_revision_positions` (trigger cấp số bị tắt, một loader tự viết chạy `session_replication_role = replica` trước 023, một phiên bảo trì ghi thô) làm **cả luồng bị giữ**: luật 4 của dịch vụ coi luồng có bản thiếu số là đã đổi, và trigger xác nhận của 023 từ chối `LTZ03` mọi lần xác nhận nháp ứng viên của luồng đó. 023 không tự gỡ. N4 viết **quy tắc** cho phiên bảo trì (khoá `FOR UPDATE` dòng đếm của luồng trước, giữ tới commit) và **câu chẩn đoán** (đếm bản không số theo dự án; không in `chat_id` hay `thread_key`), và bước kiểm sau phục hồi `deploy/post-restore.sql` dừng với mã `POST-RESTORE-05` thay vì giấu hay tự đánh số.
- **Phía B:** hôm nay cách gỡ duy nhất là áp lại `migrations/023_thread_order.sql` (bước 8 đánh số bản chưa có số theo `created_at, revision_no, id`); chính 023 từ chối khi còn nháp ứng viên chưa có quyết định của người, khi có login thành viên `libetech_ai` đang kết nối, hoặc khi hơn 250 000 bản chưa số. Chưa có người nào được giao chịu trách nhiệm việc đó, và chưa có lời nào của Chairman về việc có chấp nhận một kịch bản đánh số riêng.
- **Câu (a) — gỡ luồng bị giữ.** Phương án: (1) người vận hành áp lại 023 trong một cửa sổ bảo trì, mỗi lần có Chairman duyệt, không viết thêm gì; (2) một kịch bản riêng chỉ đánh số các bản thiếu số (phần bước 8 của 023, dưới khoá dòng đếm), có một vai trò được nêu tên duyệt từng lần chạy, qua review CSDL và bảo mật vì nó ghi bằng quyền superuser vào hai bảng mà không role nào ghi; (3) không gỡ: ứng viên của luồng đó chỉ còn bị từ chối, không bao giờ xác nhận được. Kèm: ai chịu trách nhiệm (vai trò, không tên người), và ghi vết ở đâu.
- **Câu (b) — bản lưu sau 023 mà nguồn đã có bản không số.** Phương án: (1) phục hồi nguyên trạng: dịch vụ chạy, luồng vẫn bị giữ như ở nguồn, và gỡ theo câu (a); (2) dừng tới khi câu (a) có quy trình. Hành vi tạm của N4 là (2): `POST-RESTORE-05`, bộ cài dừng trước khi bật dịch vụ. Nghĩa là một sự cố mất máy chủ khi đang có luồng bị giữ chưa phục hồi được bằng bộ cài; đường duy nhất là phục hồi tay theo runbook rồi gỡ theo (a).
- **Câu (c) — bản lưu trước 023 có nháp ứng viên chưa có quyết định.** Bản như vậy chỉ phục hồi được vào CSDL có 023 sau khi áp lại 023, mà 023 từ chối khi còn nháp như thế: dừng. Phương án: (1) chấp nhận: quyết định nháp **ở nguồn** rồi dump lại; nếu nguồn đã mất thì chỉ phục hồi được vào lược đồ 022 (bộ kiểm `post-restore.sql` chạy được ở đó) và áp 023 sau khi nháp được quyết định; (2) một đường khác có người duyệt (ví dụ loại nháp ứng viên chưa quyết định khỏi bản lưu khi nạp). Z4 chưa bật nên hôm nay chưa có nháp nào; câu này chỉ có nghĩa từ khi bật Z4.
- **Ai quyết:** Chairman; BoM Tech nếu Chairman giao. **Đã quyết 22/11/2026 (Chairman, lời do người dùng dán vào phiên điều phối): (a) (1) tới khi bật Z4, (2) trước khi bật Z4; (b) (1); (c) (1)** — chép nguyên ở khối cuối tệp. Vai trò chịu trách nhiệm và nơi ghi vết của câu (a) chưa có lời.
- **Khuyến nghị của phiên PR:** không có: ba câu đều đổi ai được ghi vào dữ liệu của luồng bằng quyền cao, hoặc đổi cái gì một bản lưu được phép là.
- **Hành vi hiện tại (không phải phương án được chọn):** (a) không có quy trình, chỉ có quy tắc và chẩn đoán; (b) dừng; (c) dừng. Z4 chưa bật, 022 và 023 chưa áp ở đâu ngoài CSDL thử. **Cập nhật 22/11/2026:** (b) «dừng» nay **khác** phương án đã chọn (1) — mã N4 chưa đổi (`deploy/post-restore.sql:91` vẫn dừng ở `POST-RESTORE-05`); (c) «dừng» trùng phương án (1); (a) (2) chưa có mã. **Cập nhật 23/11/2026:** PR [liberico-ai/ai-together#39](https://github.com/liberico-ai/ai-together/pull/39) đã merge (`d41dda2`, 22/11/2026 22:51 UTC): mã N4 **đã đổi** theo (b) (1). Với bản lưu sau 023, `deploy/post-restore.sql` đếm bản không số theo dự án (`held_by_project`) thay vì dừng ở `POST-RESTORE-05`, và hai bộ cài đi tiếp và bật dịch vụ; tệp đòi nói loại bản lưu (`SET libetech.archive_kind`); với bản lưu trước 023 bước 05 vẫn dừng. Câu «(b) dừng» và «mã N4 chưa đổi» ở trên tả mã trước PR #39. Mức: có mã, đã thử trên CSDL thử; chưa triển khai, chưa dùng thật, chưa nghiệm thu; điều kiện N4 vẫn chưa đóng (hai bộ cài chưa chạy được đầu-cuối từ cây này). (a) (2) vẫn chưa có mã; (c) (1) không đổi mã. Biên nhận: `docs/DELIVERY-021-n4-oq59-b1-held-threads-20261122.md`.

---

**Quyết định của Chairman ngày 22/11/2026** (lời do người dùng dán vào phiên điều phối; tin chỉ có đoạn dán, và được ghi như quyết định của Chairman theo người dùng — phiên điều phối không xác nhận được người viết). Khối này nối cuối tệp để các số dòng đã được trích ở tài liệu khác không xê dịch. Nó thuộc về các điều kiện trước 023 (`docs/RUNBOOK-PRE-023-N1-N3.md`, `docs/DELIVERY-018-pre-023-n1-n3-20261120.md`), OQ-59 (`:1072`) và các mục chờ xác nhận của lát 2–3.

Lời trên, chép nguyên, không lược — năm dòng:

```text
Cho phép: đếm trên CSDL phục vụ, lập bản sao dữ liệu thật để đo 023; ngưỡng giữ khoá < 500 ms. N2 chạy cùng Quân tuần này.
OQ-59: (a) (1) tới khi bật Z4, (2) trước khi bật Z4; (b) (1); (c) (1).
Các xác nhận nhỏ của lát 2–3 (OQ-28/29, S5, DOC-16, S11, S15, S32–S34, S51, AGENTS.md, doc_approve:*, kiểm UI): giao Phương và Quân.
Tạo PR riêng cho thay đổi hermes.libetech.vn đang nằm chưa commit ở thư mục chính.
Không mở PR tính năng mới trước đợt triển khai 022 + 023.
```

- Ánh xạ của phiên điều phối (không phải lời Chairman; các «cách hiểu» chờ xác nhận):
  1. **Phép đếm và phép đo 023.** «Đếm trên CSDL phục vụ» = chạy `deploy/pre-023-check.sql` (chỉ đọc; cần login superuser, mã `PRE-023-01`) trên CSDL đang phục vụ — `docs/RUNBOOK-PRE-023-N1-N3.md` mục 3.1. «Lập bản sao dữ liệu thật để đo 023» = mục 3.2 của runbook đó: bản lưu trước 023 theo `docs/RUNBOOK-RESTORE-AFTER-023.md` mục 2, diễn tập vào một CSDL **mới** theo mục 5, áp các migration còn thiếu trừ 023, rồi áp và đo 023. Đây là phép đọc và phép lập bản sao; **không** phải phép áp 022 hay 023 lên CSDL phục vụ. Lời không nêu ai chạy (phiên điều phối không vào được d1-ai1; tuyến vận hành ở đó là Codex qua terminal của Hermes), bản sao đặt ở đâu và xoá khi nào. Cách hiểu, fail-closed: bản sao nằm cùng phía với CSDL phục vụ, không về máy cá nhân, không vào repo (repo công khai), và bị xoá sau khi đo.
  2. **«Ngưỡng giữ khoá < 500 ms».** Cách hiểu: thời gian 023 giữ khoá trên bản sao (từ khoá đầu tới commit, runbook mục 3.2 (b)) phải dưới 500 ms; không đạt thì đợt 022 + 023 chờ lời mới. Vì `\timing` của `psql` không in tổng của giao dịch, con số đem so là `time` của cả lần áp (gồm cả kết nối). Nó không nhỏ hơn thời gian giữ khoá, nên dùng nó là phía an toàn. Ngưỡng này chặt hơn mốc «dưới 2 giây — gateway không thấy gì» của runbook.
  3. **N2 «tuần này».** Lời ngày 22/11/2026 là Chủ nhật, nên không đổi thành ngày cụ thể: «tuần này» có thể là tuần đang kết thúc hoặc tuần sau. N2 là việc của người: Quân là người vận hành gateway theo lời ngày 19/11/2026, quy trình ở runbook mục 2.
  4. **OQ-59.** (a) (1), tới khi bật Z4: người vận hành áp lại 023 trong cửa sổ bảo trì, mỗi lần có Chairman duyệt, không viết thêm mã. (a) (2), trước khi bật Z4: kịch bản riêng chỉ đánh số các bản thiếu số (phần bước 8 của 023, dưới khoá dòng đếm), mỗi lần chạy có một vai trò được nêu tên duyệt, qua review CSDL và bảo mật. Phần «Kèm» của câu (a) — vai trò chịu trách nhiệm và nơi ghi vết — chưa có lời. (b) (1): phục hồi nguyên trạng — dịch vụ chạy, luồng vẫn bị giữ như ở nguồn, gỡ theo (a). Mã N4 hiện làm (2): `deploy/post-restore.sql:91` dừng ở `POST-RESTORE-05` trước khi bật dịch vụ, và `docs/RUNBOOK-RESTORE-AFTER-023.md:92` ghi «dừng». Muốn khớp lời này phải đổi mã N4 và runbook; **chưa làm**, chưa giao phiên nào. (c) (1): chấp nhận — quyết định nháp ở nguồn rồi dump lại; nguồn đã mất thì chỉ phục hồi vào lược đồ 022, rồi áp 023 sau khi nháp được quyết định. Trùng hành vi hiện tại (dừng); không đổi mã. Z4 chưa bật nên hôm nay chưa có nháp nào. **Cập nhật 23/11/2026:** câu «Mã N4 hiện làm (2)» và «chưa làm, chưa giao phiên nào» tả ngày 22/11/2026 và không còn đúng: PR [liberico-ai/ai-together#39](https://github.com/liberico-ai/ai-together/pull/39) đã đổi mã N4 và runbook theo (b) (1) và đã merge (`d41dda2`); chi tiết ở dòng «Hành vi hiện tại» của OQ-59 (`:1082`). Cách hiểu ở điểm 7 (đổi mã N4 là việc của N4, không phải tính năng) chưa có xác nhận riêng của Chairman; PR được giao, mở và merge theo lời người dùng. (a) (2) vẫn chưa có mã.
  5. **Các xác nhận nhỏ của lát 2–3 giao Phương và Quân.** Các mục trong ngoặc trước đây ghi «chờ Chairman xác nhận» nay chờ Phương và Quân. Lời không nói ai làm mục nào, hay cần cả hai cùng xác nhận. Các dòng tại chỗ (ví dụ OQ-28, OQ-29) không sửa; khối này là nơi ghi việc chuyển. «AGENTS.md» là các chỉnh sửa đề xuất cho tệp đó; sửa `AGENTS.md` vẫn qua PR có Chairman duyệt trước merge. «doc_approve:*» = nhãn quyền `doc_approve:*` trong plugin priority1 trước khi dùng thật; «kiểm UI» = kiểm tay giao diện ở 360 px và 1280 px với người thật (cả hai ở `docs/IMPLEMENTATION-ROADMAP.md:50`; xem thêm `docs/DELIVERY-013-coordinator-proposal-20261116.md:136`).
  6. **PR riêng cho hermes.libetech.vn:** PR [liberico-ai/ai-together#34](https://github.com/liberico-ai/ai-together/pull/34) vào `libetech-ai-os`, đầu `46c4828`, mở 22/11/2026. **Cập nhật 22/11/2026: đã merge** (merge `a60e8a1`, 01:49 UTC, cùng đợt với PR phát hành 0.9.0 [#35](https://github.com/liberico-ai/ai-together/pull/35); xem `docs/DELIVERY-020-release-0.9.0-20261122.md`). Plugin `dashboard-plugin` không nằm trong gói phát hành, cài qua Hermes Git admission. **Chưa triển khai.**
  7. **«Không mở PR tính năng mới trước đợt triển khai 022 + 023».** Cách hiểu: PR thêm tính năng chờ tới sau đợt. PR ghi hồ sơ, PR #34 (theo lời trên) và phần còn lại của các điều kiện trước đợt (N1–N4) không phải PR tính năng. Thuộc diện chờ: kịch bản OQ-59 (a) (2) (chỉ cần trước khi bật Z4) và mã của OQ-54 (b), OQ-55 (b), OQ-56 (b). Việc đổi mã N4 theo OQ-59 (b) (1) được hiểu là việc của N4 (điều kiện trước đợt), không phải tính năng; cách hiểu này chờ xác nhận trước khi giao.
  8. Điểm dừng không đổi: không áp migration lên CSDL phục vụ; không triển khai d1-ai1; không khởi động lại gateway chung; không gửi tin vào nhóm thật; không bật Z4; không merge PR khi chưa có lời Chairman.

---

**Quyết định của Chairman ngày 25/11/2026** (lời do người dùng dán vào phiên điều phối trong «GIAO VIỆC 5 bản 3»; phiên điều phối không xác nhận được người viết). Khối này nối cuối tệp để các số dòng đã được trích ở tài liệu khác không xê dịch. Nó thuộc về GIAO VIỆC 5 (hạng mục A–F; biên nhận của GIAO VIỆC 5 chưa có trong cây).

Lời trên, chép nguyên, không lược — bốn dòng:

```text
- Tất cả thành viên Team Tech được tạo việc ở tất cả các dự án. Màn hình tạo việc hiển thị đủ danh sách dự án cho thành viên Tech.
- Việc mới ghi ở trạng thái chờ BoM xác nhận hoặc phê duyệt. BoM Tech: Chu Hoàng Anh, Quân, Phương.
- Giữ luật xác nhận 3/3 khi chia lại nhiệm vụ, kể cả chia việc giữa ba thành viên BoM. Quyết định khác cần BoM duyệt: hiện trạng thái và người đã duyệt theo quy chế hiện có.
- Các phản ánh lịch sử có thể chưa được thu nhận đầy đủ. Đối chiếu thêm trực tiếp với Quân, Phương và tin gốc trước khi đánh dấu một lỗi đã đóng.
```

Cùng đề còn ghi «Dragon Forge = nhóm Telegram chung của cả Team Tech (Chairman 25/11)», kèm hệ quả thiết kế do phiên điều phối viết, không phải lời nguyên văn của Chairman. Đề ghi lại lời Chairman ngày 22/11/2026 08:10: «golive và merge luôn».

Ánh xạ của phiên PR (không phải lời Chairman; các «cách hiểu» chờ xác nhận):

1. **«Tất cả thành viên Team Tech được tạo việc ở tất cả các dự án».**
   - Danh sách Team Tech là bảng `identity.tech_roster` (migration 024). Chỉ operator ghi, bằng `deploy/tech-roster.sql`, và mỗi lần thêm hoặc bớt đều có dòng `identity.events`.
   - Ở trong danh sách không phải là quyền trên dự án. Người đó thấy danh mục dự án (tên, BU) và gửi được yêu cầu tạo việc vào mọi dự án. Họ không đọc được việc của dự án mà họ không có quyền.
   - Người trong danh sách là dữ liệu ngoài repo (repo công khai). Đề ghi «Team Tech» mà không nêu danh sách; danh sách gần nhất trong hồ sơ là bản ngày 11/11/2026 (`docs/DELIVERY-008-pilot-onboarding-20261111.md`).
2. **«Việc mới ghi ở trạng thái chờ BoM».**
   - Mọi việc mới (gửi từ biểu mẫu, từ tin nhắn ở hạng mục B, từ bảng nguồn ở hạng mục C) là một dòng `work_requests` ở trạng thái chờ.
   - Đường tạo việc trực tiếp cũ (`POST /api/v1/work`) trả `410 WORK_REQUEST_REQUIRED`.
   - Ba ghế BoM Tech của một dự án là `bom_scopes.seat_ids` của dự án đó. Operator ghi bằng `deploy/bom-seats.sql`; tên người là dữ liệu ngoài repo.
   - Một ghế chỉ được tính khi người đó có membership của dự án, tài khoản đang hoạt động và đã liên kết Telegram. Theo hồ sơ 11/11/2026, một trong ba người chưa có membership ở dự án `LBRC · App Saleman` và chưa có bằng chứng kích hoạt hay liên kết. Cấp membership đi qua luồng duyệt quyền hiện có.
   - Bật `bom_scopes` cho một dự án cũng bật chốt 3/3 khi đổi người thực hiện ở dự án đó. Repo không thấy được CSDL phục vụ nên không biết dự án nào đã bật.
3. **«Giữ luật xác nhận 3/3 khi chia lại nhiệm vụ, kể cả chia việc giữa ba thành viên BoM».**
   - Không nới. Duyệt một việc mới là giao lần đầu (Q02, mới ở mức đề xuất): việc mang người thực hiện đã đề xuất, và người duyệt phải là một ghế BoM khác người tạo. Mọi lần đổi người thực hiện sau đó vẫn cần biên nhận 3/3 (`docs/plans/gv5-a-tech-create-approval.md` mục 3).
   - **«Quyết định khác cần BoM duyệt … theo quy chế hiện có»:** quy chế hiện có (`docs/QUY-CHE-DU-THAO-BOM-TECH.md`) chưa có luật đã chốt cho việc duyệt việc mới. Hệ thống áp cách hiểu tạm ở OQ-60 dưới đây cho tới khi có lời.
4. **«Đối chiếu … trước khi đánh dấu một lỗi đã đóng».** Không ca nào trong biên nhận của GIAO VIỆC 5 (`docs/DELIVERY-022-gv5-golive-tech-work-20261125.md`) được ghi «đã đóng». Mỗi ca mang trạng thái «chưa đối chiếu với người báo» cho tới khi người báo xác nhận trên tin gốc. Yêu cầu bằng chứng ở `docs/EVIDENCE-REQUEST-20261125.md`.
5. **Lời 22/11/2026 «Không mở PR tính năng mới trước đợt triển khai 022 + 023».**
   - Đề ngày 25/11/2026 ghi hiện trạng «Server 0.9.0, schema 001–023, gateway 20/20 bot». Phiên PR hiểu đợt 022 + 023 đã chạy và mở các PR A–F theo đề đó.
   - Repo chưa có hồ sơ triển khai nào của đợt này: bản ghi gần nhất là `docs/DELIVERY-020-release-0.9.0-20261122.md`, không có `DEPLOY-005`. Các dòng «022 và 023 chưa áp» trong tài liệu chưa sửa, vì chưa có bằng chứng triển khai. Yêu cầu bằng chứng ở `docs/EVIDENCE-REQUEST-20261125.md`.

## OQ-60 — Ai duyệt một việc mới, và việc đó có người thực hiện ngay khi duyệt không

- **Lát:** GIAO VIỆC 5 hạng mục A (`docs/plans/gv5-a-tech-create-approval.md`); áp chung cho việc từ biểu mẫu, từ tin nhắn (B) và từ bảng nguồn (C).
- **Căn cứ:** lời Chairman 25/11/2026 ở khối trên: «Việc mới ghi ở trạng thái chờ BoM xác nhận hoặc phê duyệt» và «Quyết định khác cần BoM duyệt: hiện trạng thái và người đã duyệt theo quy chế hiện có». Q07 của quy chế dự thảo mới ở mức đề xuất; Q02 (giao lần đầu) cũng mới ở mức đề xuất.
- **Câu (a) — bao nhiêu ghế duyệt.** Phương án:
  (1) một ghế BoM của dự án, khác người tạo;
  (2) hai ghế khác người tạo;
  (3) 3/3 như khi chia lại nhiệm vụ.
- **Câu (b) — dự án chưa bật ghế BoM.** Phương án:
  (1) việc nằm chờ, không ai duyệt được;
  (2) điều phối của dự án duyệt thay, khác người tạo.
- **Câu (c) — người thực hiện lúc duyệt.** Phương án:
  (1) việc mới không có người thực hiện, giao lần đầu qua phiếu 3/3. Hôm nay phiếu 3/3 chỉ chia lại việc đã có người thực hiện (`src/server/bom.ts:60`), nên muốn chọn phương án này thì phải làm thêm phần giao lần đầu qua 3/3 (Q02);
  (2) ghế BoM điền các chỗ người tạo để trống ngay khi duyệt (người thực hiện, hai người nghiệm thu), và không bao giờ thay người mà người tạo đã đề xuất; muốn đổi thì từ chối để người tạo gửi lại. Người tạo không có quyền ở dự án thì không thấy thành viên dự án, nên thường gửi không kèm người nào. Đây là giao lần đầu; mọi lần đổi sau đó cần 3/3. Việc không có người thực hiện thì không được duyệt (`ASSIGNEE_REQUIRED`), vì phiếu 3/3 không cấp được người đầu tiên.
- **Câu (d) — chia lại việc không đến từ bộ nhập nguồn.** Phiếu 3/3 cần một dòng `bom_sources` còn hiệu lực (`src/server/bom.ts:45-46`, `:161-162`). Hôm nay chỉ operator ghi bảng đó. Việc tạo từ yêu cầu, như việc tạo trực tiếp trước đây, không có dòng nào, nên phiếu chia lại dừng ở `SOURCE_RECONCILE`. Phương án:
  (1) khi duyệt, ghi một dòng nguồn trỏ về chính yêu cầu (bất biến), kèm hash;
  (2) operator ghi theo từng việc;
  (3) giữ như hiện nay.
- **Câu (e) — giao việc mới cho một thành viên BoM.** Lời Chairman 25/11: «Giữ luật xác nhận 3/3 khi chia lại nhiệm vụ, kể cả chia việc giữa ba thành viên BoM». Một ghế duyệt việc mới mà chọn một trong ba ghế BoM (kể cả chính mình) làm người thực hiện là chia việc giữa ba thành viên BoM. Phương án:
  (1) từ chối cho tới khi có phiếu 3/3 giao lần đầu (hành vi giữ nguyên luật): `SELF_ASSIGNMENT` khi ghế tự giao cho mình, `BOM_ASSIGNEE_HELD` khi giao cho ghế khác;
  (2) một ghế duyệt là đủ, kể cả khi người thực hiện là một ghế BoM.
- **Ai quyết:** Chairman; BoM Tech nếu Chairman giao.
- **Hành vi tạm (đang có trong mã của PR A; không phải phương án được chọn):** (a) (1), (b) (1), (c) (2), (d) (3), (e) (1).
  - Chọn (c) (1) thì việc mới không có đường nào để có người nhận. Vì vậy (c) dùng cách giao lần đầu có sẵn của `WorkService.create`, với điều kiện chặt hơn: cần một ghế BoM khác người tạo.
  - Người tạo không bao giờ tự duyệt việc của mình: dịch vụ và CHECK của CSDL chặn; trigger kiểm ghế BoM của người quyết.
  - Luật ghế (một ghế BoM của dự án, khác người tạo) và luật không tự duyệt nằm trong CHECK và trigger của CSDL (migration 024). Chọn (a) (2), (a) (3) hoặc (b) (2) thì phải có migration mới; không chỉ sửa mã dịch vụ.
  - **Cách hiểu chờ xác nhận:** câu «Quyết định khác cần BoM duyệt: hiện trạng thái và người đã duyệt theo quy chế hiện có» được áp cho việc duyệt việc mới mà thôi (trạng thái, người duyệt, thời điểm hiện trên màn hình). Hệ thống không áp nó cho quyết định nào khác.
  - Điều kiện để một thành viên Team Tech đăng nhập được: ít nhất một membership ở một dự án (`identity.ts`, `NO_PROJECT_ACCESS`). Ở trong danh sách Team Tech không thay cho membership.
  - Màn hình hiện trạng thái, người duyệt và thời điểm duyệt.
- **Đã quyết 25/11/2026:** xem khối «GIAO VIỆC 7» cuối tệp.

## OQ-61 — Nhóm chung Dragon Forge: tin nào vào hàng phân loại, ai thấy gì, và một tin nối được bao nhiêu việc

- **Lát:** GIAO VIỆC 5 hạng mục B (`docs/plans/gv5-b-intake-to-work.md`).
- **Căn cứ:** lời Chairman 25/11/2026: «Dragon Forge = nhóm Telegram chung của cả Team Tech» — không gắn với dự án nào, dự án chọn ở bước phân loại, chưa chọn thì «chưa gán dự án»; mọi thành viên Tech gửi được vào intake từ Dragon Forge; quyền đọc theo quyền từng dự án; IBS HI chỉ con trỏ, hash và metadata công việc Tech (`AGENTS.md`). Repo hôm nay loại nhóm này khỏi pilot (`deploy/pilot-scope.json`), tin từ đó bị `SCOPE_DENIED` và không lưu.
- **Đã có trong mã của PR B, không cần hỏi:** mục của nhóm chung không lưu chữ, tên tệp, nhãn người gửi; plugin bỏ các thứ đó trước khi gửi và không tải tệp; máy chủ bỏ lần nữa. Bot API của Telegram không đọc được lịch sử nhóm, nên mọi «xem lại» chỉ đọc dữ liệu đã lưu.
- **B1 — tin nào vào hàng phân loại.** (1) chỉ tin gọi bot (lệnh, nhắc tên bot, trả lời bot); (2) mọi tin của thành viên Tech trong nhóm.
- **B2 — sau khi gán dự án, ai thấy tên dự án.** (1) mọi thành viên Tech thấy tên dự án của mục; nội dung yêu cầu, quyết định và việc chỉ người có quyền ở dự án thấy; (2) chỉ người có quyền ở dự án thấy cả tên dự án.
- **B3 — ở nhóm gắn dự án, ai lập yêu cầu việc từ một tin đã xác nhận.** (1) như hạng mục A: thành viên Team Tech, hoặc điều phối của dự án đó; (2) mọi người có vai đọc được tin đó (rộng hơn hạng mục A: thêm kỹ sư, người nghiệm thu kỹ thuật và nghiệp vụ của dự án); (3) chỉ điều phối của dự án.
- **B4 — một tin nối được mấy việc.** (1) nhiều việc trong cùng một dự án; một mục của nhóm chung chỉ thuộc một dự án; (2) một tin một việc.
- **B5 — số đếm theo miền.** (1) PR B không có báo cáo số đếm (cần bảng Z2 và projector có tên, AR-07 — lát riêng); (2) thêm ngay trong PR B.
- **B6 — gỡ một liên kết sai.** (1) chưa có lệnh gỡ, liên kết chỉ thêm; (2) lệnh thu hồi có sự kiện riêng.
- **Ai quyết:** Chairman.
- **Hành vi tạm (đang có trong mã của PR B; không phải phương án được chọn):** B1 (1), B2 (1), B3 (1), B4 (1), B5 (1), B6 (1).
- **Điều kiện trước khi bật, ngoài repo (người vận hành, EV-12 và EV-13 của `docs/EVIDENCE-REQUEST-20261125.md`):** kiểm gateway có tự lưu chữ của nhóm chung ở nơi khác (nhật ký phiên, bộ nhớ của agent) không. Có lưu thì dừng và báo Chairman.
- **Đã quyết 25/11/2026:** xem khối «GIAO VIỆC 7» cuối tệp.

## OQ-62 — Nhập bảng việc của PM: khoá chống lặp, người nhập, dòng IBS HI, ngày hai nghĩa

- **Lát:** GIAO VIỆC 5 hạng mục C (`docs/plans/gv5-c-sheet-import.md`).
- **Căn cứ:** lời Chairman 25/11/2026 cho hạng mục C (xem trước bắt buộc; giữ mã, tham chiếu nguồn, trạng thái, hạn, bằng chứng như đã viết; ô trống gắn cờ, không đoán; nhập lại không ghi lặp theo mã việc + tham chiếu nguồn; chờ BoM duyệt nếu chưa có luật khác); `AGENTS.md`: «IBS HI: pointers, hashes and Tech work metadata only».
- **Câu 1 — khoá chống lặp.** Lời Chairman là «mã việc + tham chiếu nguồn». Mã dùng STT + mã việc + hash nội dung, cùng phạm vi bảng và trang; số dòng lưu trong tham chiếu nhưng không làm khoá, vì chèn một dòng lên trên làm mọi dòng dưới đổi số. (1) giữ như vậy; (2) dùng đúng số dòng.
- **Câu 2 — ai được nhập.** Hành vi tạm: thành viên Team Tech, hoặc điều phối của dự án đích, theo luật tạo việc của hạng mục A (`work_request_filer`). Dòng của một dự án mà người nhập không được tạo việc thì ra «cần đối chiếu» với mã `NOT_A_FILER`; các dòng khác vẫn nhập. (1) giữ; (2) chỉ điều phối.
- **Câu 3 — dòng bảng ghi «Hoàn thành» hoặc «Tạm dừng».** Hành vi tạm: vẫn vào hàng chờ BoM như mọi dòng; trạng thái nguồn chỉ là nhãn, không phải nghiệm thu. (1) giữ; (2) chỉ liệt kê, không tạo yêu cầu.
- **Câu 4 — dòng IBS HI.** Tiền lệ: migration 011 và `scripts/import-team-tech-catalog.ts` (bản 0.7.0, `DELIVERY-007`) lưu tiêu đề, người phụ trách, người phối hợp, trạng thái, hạn **và ghi chú** của dòng IBS HI ở bảng Z2 `analytics.tech_source_tasks`; `docs/DOI-SOAT-TEAM-TECH-20261110.md` dòng 68–74 liệt kê công khai các dòng IBS HI với tiêu đề, người, trạng thái. Cách chặt nhất (chỉ con trỏ, hash, mã, nhãn) khác tiền lệ đó.
  (1) giữ tiêu đề, người phụ trách, người phối hợp, trạng thái, hạn như đã viết; **không** lưu ghi chú và chữ bằng chứng (hành vi tạm, đang có trong mã của PR C);
  (2) chỉ con trỏ, hash, mã việc, nhãn BU, nhãn trạng thái. Cái giá: 20 yêu cầu IBS HI (số dòng nhãn IBS HI ở bản xuất 25/11) tới ghế BoM với tiêu đề do máy sinh, không ai đọc được nếu không mở bảng nguồn, và ghế BoM cần quyền xem bảng do PM cấp.
  Kèm theo: các dòng Z2 hiện có của 011 đang giữ chữ ghi chú của dòng IBS HI — (a) giữ, (b) che, (c) xoá theo quy trình có biên bản.
- **Câu 5 — ngày dạng dd/mm đọc được hai thứ tự.** Hành vi tạm: để trống và gắn cờ, như luật hiện có. (1) giữ; (2) đọc theo ngày/tháng của bảng.
- **Câu 6 — bản nguồn.** Bảng Google Sheet «Checklist dau viec cua Tech theo BU_Update 07.11.2026», trang «Đầu việc Tech», hay workbook .xlsx ở đường dẫn của brief (bản 02/11, là bảng KPI). PM xác nhận (EV-10), kèm: STT có được đánh lại giữa các lần cập nhật không.
- **Câu 7 — mã việc lấy từ đâu.** Hành vi tạm: chỉ từ tiêu đề, cho mọi dòng; dòng IBS HI không bao giờ đọc ghi chú.
  - Cái giá, đếm trên bản xuất 25/11, theo nhãn BU:
    - không dòng nào có mã trong tiêu đề;
    - dòng có mã chỉ trong ghi chú: LBRC 8, IBS HI 9, XECA 3.
  - Vì vậy mọi việc duyệt từ lần nhập này mang mã hệ thống `WR-…`, trừ khi ghế BoM gõ mã lúc duyệt.
  - Phương án: (1) giữ; (2) chỉ tiêu đề cho IBS HI, tiêu đề rồi tới ghi chú cho LBRC và XECA.
- **Câu 8 — trả lời xung đột khi nhập.** Hàm `work_import_key_conflicts` (SECURITY DEFINER) chỉ trả một lớp theo vị trí dòng; không trả ai đã nhập, dự án hay nội dung. Sửa theo cổng Codex vòng 1 (P0: bản trước so mã và nội dung với mọi dòng của nguồn, nên dò được mã và nội dung đã nhập ở dự án ngoài quyền xem):
  - với dòng khoá người gọi đọc được (chính họ nhập, hoặc họ giữ ghế BoM của dự án đó): đủ bốn lớp `DUPLICATE`, `CONTENT_UNDER_OTHER_STT`, `SOURCE_CHANGED`, `CODE_UNDER_OTHER_ROW`;
  - với dòng khoá khác: chỉ `STT_IMPORTED` khi cùng STT, như nhau dù nội dung trùng hay khác; mã và nội dung không được so;
  - khoá mã và khoá nội dung ở CSDL tính theo từng người nhập, khoá STT theo nguồn và trang: lần ghi cũng không dò được gì hơn.
  Điều lộ ra còn lại: «STT này của nguồn này đã được nhập». Cái giá: hai người cùng nhập một bảng không ghi lặp theo STT; nhưng nếu STT bị đánh lại giữa hai lần nhập của hai người không xem được dòng của nhau, cùng nội dung có thể thành hai yêu cầu chờ duyệt.
  Phương án: (1) như trên (hành vi tạm); (2) so mọi dòng của nguồn, như bản trước (lộ mã và nội dung đã nhập cho người không xem được dự án); (3) khoá STT cũng theo từng người nhập (không lộ gì; hai người nhập cùng bảng sẽ ghi lặp).
- **Câu 9 — `AGENTS.md`.** Hai bảng nhập (`work_import_batches`, `work_import_rows`) là Z1, nhưng dòng Z1 của `AGENTS.md` chưa nêu chúng; các bảng của 024–026 cũng vậy. Phiên PR không sửa `AGENTS.md`. (1) Chairman sửa dòng Z1; (2) giữ nguyên, kế hoạch của từng hạng mục ghi zone.
- **Ai quyết:** Chairman (câu 1–5, 7–9); PM xác nhận câu 6.
- **Hành vi tạm (đang có trong mã của PR C; không phải phương án được chọn):** 1 (1), 2 (1), 3 (1), 4 (1) và Z2 (a), 5 (1), 7 (1), 8 (1). Việc sinh ra từ dòng nhập, khi duyệt, mang người phụ trách đã được người nhập xác nhận ánh xạ (giao lần đầu, như OQ-60 (c) (2)); đổi người sau đó cần 3/3 và vướng OQ-60 (d).
- **Đã quyết 25/11/2026:** xem khối «GIAO VIỆC 7» cuối tệp.

## Quyết định 25/11/2026 — GIAO VIỆC 7, bản 0.9.2 «mở khoá» (OQ-60, OQ-61, OQ-62)

- **Lời Chairman 25/11/2026 17:48, nguyên văn:** «Mục tiêu là cả team dùng được sau go live, nên em tự ra quyết định. Đừng Go live xong không làm được gì. lỗi có thể sửa . Đừng khoá chặt , team Tech cũng cần học và trải nghiệm»
- **Ai quyết:** các lựa chọn dưới đây là quyết định của phiên điều phối (Cowork) theo uỷ quyền Chairman 25/11/2026 17:48; Chairman có thể đổi. Phiên PR làm theo đề GIAO VIỆC 7, không tự chọn. Kế hoạch: `docs/plans/gv7-unlock-092.md`.
- **OQ-60:**
  - (a) (1): một ghế duyệt, khác người tạo. Giữ CHECK của CSDL «người duyệt khác người tạo» và luật «người thực hiện khác người nghiệm thu».
  - (b): một trong ba BoM Tech, khác người tạo, duyệt được ở mọi dự án, kể cả dự án chưa có ghế. Ba BoM Tech là dữ liệu ngoài repo, người vận hành ghi bằng `deploy/tech-bom.sql`. Duyệt trên web không cần liên kết Telegram, với BoM Tech cũng như với ghế của dự án.
  - (c): lúc duyệt, ghế điền chỗ trống và được đổi người đã đề xuất. Hệ thống lưu người đề xuất, người chốt và ai đổi.
  - (d) (1): khi duyệt, ghi một dòng nguồn bất biến trỏ về yêu cầu, kèm hash, để phiếu 3/3 chạy được. Việc đã duyệt dưới 0.9.1 được migration 028 điền bù. Luật 3/3 không đổi.
  - (e) (2): một ghế duyệt là đủ, kể cả khi người thực hiện là một ghế BoM, kể cả chính người duyệt.
  - Thêm:
    - mọi thành viên Team Tech nhận việc được ở mọi dự án mà không cần vai `engineer`, và làm mọi thao tác của người thực hiện trên việc của mình. Mỗi lần cấp có dấu vết: ai giao, từ yêu cầu hay phiếu nào;
    - thành viên Team Tech chưa có membership vẫn đăng nhập, thấy danh mục dự án, gửi và xem yêu cầu của mình;
    - duyệt được nhiều yêu cầu, hoặc cả một lô nhập, trong một lượt.
- **OQ-61:** B1–B5 chọn (1), đúng hành vi tạm của PR B. B6 sang đợt D–F.
- **OQ-62:**
  - Câu 1, 2, 3, 5, 8: (1).
  - Câu 4: (1). Che ghi chú IBS HI ở Z2 (phương án (b)) làm ở đợt sau.
  - Câu 6: PM chọn bản nguồn ở bước xem trước. Lô nhập ghi tên tệp, hash và thời điểm. EV-10 đóng bằng lô đầu tiên.
  - Câu 7: (2). Mã việc lấy từ tiêu đề, rồi từ ghi chú, cho dòng LBRC và XECA. Dòng IBS HI chỉ đọc tiêu đề.
  - Câu 9: (2). Không sửa `AGENTS.md`, mỗi kế hoạch ghi zone. Một PR nháp sửa dòng Z1 được chuẩn bị riêng và không merge.
  - Cờ `LIBETECH_WORK_IMPORT` do người triển khai bật khi triển khai.
- **Câu mới, không chặn bản 0.9.2:**
  - **Q-GV7-1. Ghế đổi người đề xuất lúc duyệt, và luật 3/3 «kể cả chia việc giữa ba thành viên BoM».**
    - Lời Chairman buổi sáng 25/11 (khối đầu của mục 25/11 ở trên): «Giữ luật xác nhận 3/3 khi chia lại nhiệm vụ, kể cả chia việc giữa ba thành viên BoM».
    - Ở 0.9.2, một ghế lúc duyệt được đổi người đã đề xuất sang chính mình hoặc sang một ghế BoM khác. Với dòng nhập, bảng của PM có thể đã ghi người phụ trách, nên đổi người lúc duyệt gần với «chia lại».
    - Đề GIAO VIỆC 7 coi lần đổi này là giao lần đầu. Hệ thống làm theo: một ghế là đủ, sự kiện duyệt và audit giữ cả người đề xuất lẫn người chốt.
    - Phương án:
      - (1) giữ như 0.9.2;
      - (2) điền chỗ trống là giao lần đầu, còn đổi người đã đề xuất thì cần phiếu 3/3.
  - **Q-GV7-2. Quyền đọc của người nhận việc ngoài membership.**
    - Dòng cấp quyền chỉ thêm, không xoá: đó là lịch sử ai giao việc gì cho ai.
    - Lúc đăng nhập, một dòng chỉ mở dự án khi người đó còn giữ việc: là người thực hiện, hoặc nhận một phần trong phiếu 3/3 đã áp gần nhất. Việc chia lại cho người khác thì dự án đóng lại với họ; dòng cấp quyền vẫn còn.
    - Người được cấp đọc cả dự án với vai `viewer`, không chỉ việc của mình. Ra khỏi danh sách Team Tech hoặc BoM Tech thì mất quyền.
    - Quyền này không đi theo membership: người bị gỡ membership mà vẫn giữ việc và vẫn trong Team Tech thì vẫn đọc được dự án đó.
    - Không ai tự mở dự án cho mình. BoM Tech không có membership ở một dự án thì không tự nhận việc mình duyệt ở đó (mã `SELF_GRANT`); họ giao cho một thành viên Team Tech khác. Cơ sở dữ liệu cũng từ chối dòng cấp quyền cho chính người cấp.
    - Phương án:
      - (1) giữ;
      - (2) chỉ đọc việc của mình;
      - (3) thêm sự kiện riêng khi dự án đóng lại với người đó.
  - **Q-GV7-3. Duyệt hàng loạt chỉ điền chỗ trống.**
    - Duyệt nhiều yêu cầu một lượt không đổi người đã đề xuất. Muốn đổi người thì duyệt từng yêu cầu.
    - Phương án: (1) giữ; (2) cho đổi người cả ở lượt duyệt nhiều yêu cầu.
  - **Q-GV7-4. Phạm vi của BoM Tech.**
    - BoM Tech thấy và duyệt yêu cầu của mọi dự án trong tenant, kể cả IBS HI, chỉ ở luồng yêu cầu (danh sách, duyệt).
    - Phạm vi của họ không nới ra cả tenant. Khi duyệt một yêu cầu, giao dịch đó mở đúng một dự án của yêu cầu, để đọc hệ thống, ghế và người của dự án rồi ghi việc vào đó.
    - Màn hình duyệt chỉ liệt kê dự án đang có yêu cầu chờ họ. Họ không đọc việc, tài liệu hay báo cáo của dự án mà họ không có membership.
    - Gắn tin nhắn vào việc có sẵn vẫn theo luật cũ (thành viên không phải viewer, hoặc ghế của dự án); là BoM Tech không thêm quyền gì ở đó.
    - Số tổng ở danh sách yêu cầu đếm đúng những yêu cầu người đó đọc được; với BoM Tech là yêu cầu của mọi dự án. Giữ nguyên.
    - Báo cáo vẫn không gộp các miền với nhau. Câu báo lỗi không nêu tên dự án.
    - Phương án: (1) giữ; (2) cho BoM Tech đọc cả việc của mọi dự án.
  - **Q-GV7-5. Ghi chú vận hành sau hai lượt soát (trước cổng Codex).**
    - Dòng nguồn của việc duyệt dưới 0.9.1 được bổ sung khi chạy 028. Việc nào đã có dòng nguồn khác (của bộ nhập) thì giữ dòng đó, không thêm; phiếu 3/3 đọc dòng sẵn có.
    - Kịch bản `deploy/tech-bom.sql` nhận từ 0 đến 3 BoM Tech: ít hơn ba khi chưa chọn đủ người, danh sách rỗng để gỡ hết. Mỗi thay đổi vẫn ghi một sự kiện.
    - Duyệt cả lô gọi lại với cùng mã thao tác thì nhận lại đúng kết quả cũ của từng dòng, kể cả khi hệ thống hoặc người của dự án đã đổi giữa hai lần gọi.
    - Phương án: (1) giữ.
  - **Q-GV7-6. Sửa sau cổng Codex (một vòng, 25/11/2026).**
    - Tiền tố `work_request:` của `bom_sources` từ 028 thuộc về hệ thống. Nếu trước 028 người vận hành đã ghi một dòng nguồn mang tiền tố này mà không yêu cầu đã duyệt nào sinh ra nó, 028 dừng trước khi ghi gì và nói cách làm: đổi tên dòng đó sang tiền tố khác. Hoàn tác 028 chỉ xoá những dòng nó sinh lại được từ yêu cầu đã duyệt; còn dòng nào khác mang tiền tố thì hoàn tác dừng, dòng đó giữ nguyên.
    - BoM Tech tính là thành viên Team Tech khi gửi yêu cầu, dù có trong roster hay không.
    - Phân loại tin (luồng B) vẫn cần có tên trong roster như 0.9.1.
    - Nhập bảng: người ngoài roster vào được màn hình nhập chỉ khi là điều phối của một dự án, như 0.9.1.
      - Nếu người đó cũng là BoM Tech, dòng nhập vào dự án khác được ghi thành yêu cầu chờ duyệt, như khi họ gửi yêu cầu ở biểu mẫu. Trước bản sửa này các dòng đó nhận `NOT_A_FILER`.
      - Người duyệt vẫn phải khác người tạo.
    - Muốn một BoM Tech ngoài roster phân loại tin, hay nhập bảng mà không là điều phối dự án nào, thì người vận hành thêm người đó vào roster (`deploy/tech-roster.sql`).
    - Màn hình nhập gửi tên tệp đã chọn, sau khi bỏ dấu đường dẫn và ký tự điều khiển, tối đa 255 ký tự. Gọi lại cùng mã thao tác mà khác tên tệp là `IDEMPOTENCY_CONFLICT`.
    - Phương án: (1) giữ; (2) cho BoM Tech ngoài roster phân loại tin và nhập bảng.

## GV-5 D–F (26/11/2026) — cách hiểu tạm, chờ phiên điều phối

Phiên PR ghi cách hiểu tạm dưới đây để không bị chặn. Đây không phải phương án được chọn.

- **Q-GV5D-1. Tin gọi bot bị từ chối lúc tiếp nhận** (chưa ghép Telegram, không trong roster, nhóm chưa ghi sổ) vẫn không có câu trả lời của bot trong nhóm.
  - Muốn trả lời thì cần một đường gửi mới, không gắn tin đã lưu, và bot sẽ nói trong nhóm về người chưa được ghi sổ.
  - Người đó biết nguyên nhân khi hỏi bot hoặc gõ `/libetech_check`.
  - Phương án: (1) giữ; (2) thêm câu từ chối trong nhóm. Tạm: (1).
- **Q-GV5D-2. Cách che ghi chú IBS HI ở Z2** (OQ-62 câu 4 (b)): chuyển chữ sang bảng chỉ người vận hành đọc (`analytics.tech_source_notes_held`, migration 029), để trống cột ở bảng nguồn.
  - Xác nhận một dự án thành `IBS_HI`, hoặc người vận hành đổi nhãn BU thành IBS HI, thì ghi chú của dự án đó cũng được chuyển. Mỗi bản chữ khác nhau của một dòng được giữ riêng.
  - Đổi miền khỏi `IBS_HI` về sau **không** tự trả chữ về.
  - Phương án: (1) giữ; (2) quyền theo cột kèm hàm đọc. Tạm: (1).
- **Q-GV5E-1. Ai được gỡ một liên kết sai** (OQ-61 B6 (2)): người tạo liên kết, hoặc một ghế BoM của dự án. Cả hai phải đọc được liên kết đó. Ở nhóm chung còn cần là thành viên Team Tech.
  - Lý do gỡ chọn trong bốn mã cố định, không có chữ tự do.
  - Phương án: (1) giữ; (2) thêm điều phối dự án.
- **Q-GV5E-2. Không nối lại đúng cặp đã gỡ.** Khoá duy nhất của 025 giữ nguyên. Muốn nối lại đúng cặp thì phải đổi khoá đó.
  - Phương án: (1) giữ; (2) cho nối lại.

## GV-5 F (26/11/2026) — lịch nhắc: cách hiểu tạm

Chairman duyệt viết mã F với đề xuất Q-F1…Q-F4 của `docs/plans/gv5-f-reminders.md` («Yes, build F», 26/11/2026). Các điểm dưới đây phát sinh khi viết mã. Phiên PR ghi cách hiểu tạm để không bị chặn.

- **Q-GV5F-1. Bộ chiếu GO LIVE chạy theo lịch bằng login vận hành** (OQ-22). Muốn có số mới mỗi sáng thì unit `libetech-ai-os-golive-status` giữ login vận hành trên d1-ai1.
  - Unit được giao ở trạng thái tắt. Bật lên là thêm một việc chạy theo lịch có quyền cao nhất.
  - Phương án: (1) bật unit này khi Chairman đồng ý; (2) người vận hành chạy tay mỗi sáng trước khung 08:30–11:30; (3) tạo một login chỉ thuộc `libetech_projector`. Vai này còn ghi bảng điểm bằng chứng, nên cần tách quyền trước.
  - Tạm: chưa bật; chờ lời Chairman.
- **Q-GV5F-2. Chỉ đổi giờ.** Dời buổi họp sang ngày khác chưa ghi được trên web. Đổi thứ của cả lịch thì người vận hành sửa bằng `deploy/meeting-series.sql`.
  - Phương án: (1) giữ; (2) thêm «dời sang ngày». Tạm: (1).
- **Q-GV5F-3. Không có lịch nghỉ lễ.** Nhắc GO LIVE chạy từ thứ Hai đến thứ Sáu, kể cả ngày lễ. Muốn nghỉ thì tắt đích.
  - Phương án: (1) giữ; (2) thêm bảng ngày nghỉ. Tạm: (1).
- **Q-GV5F-4. Cách tính trạng thái GO LIVE.**
  - «Đã gửi yêu cầu» là đã gửi ít nhất một yêu cầu việc trong dự án đó, bất kỳ lúc nào, bất kỳ kết quả.
  - «Chưa có bằng chứng» là việc đang mở, giao cho người đó, chưa có bằng chứng nào ở bản sửa hiện tại.
  - Không ai thiếu thì không gửi tin; lượt chạy ghi `nothing_missing`.
  - Phương án: (1) giữ; (2) chỉ tính yêu cầu từ ngày GO LIVE, hoặc gửi cả tin «đủ». Tạm: (1).
- **Q-GV5F-5. Tin nhắc quá hạn hay đã cũ.** Tin chưa gửi được sau 6 giờ, trạng thái GO LIVE của ngày khác hay đã xếp hàng quá 60 phút, hoặc buổi họp đã bắt đầu, bị bỏ với `REMINDER_EXPIRED` thay vì gửi muộn. Tin họp tới lượt gửi ngoài khung 07:00–21:00 bị bỏ với `REMINDER_OUTSIDE_HOURS`. Tin đã bỏ mà vẫn còn đến hạn thì lượt chạy sau xếp lại, tối đa ba lần (`gave_up`). Giờ họp đã đổi, lịch đang chờ trả lời hay câu hỏi đã được trả lời thì bỏ với `REMINDER_SUPERSEDED`.
  - GO LIVE chỉ xếp hàng trong 3 giờ kể từ giờ của đích; lỡ khung thì ghi `window_passed`.
  - Tin họp chỉ xếp hàng từ 07:00 đến 21:00.
  - Phương án: (1) giữ; (2) đổi các mốc này. Tạm: (1).
- **Q-GV5F-6. Nhóm chung Team Tech nhận tin nhắc không.** Sau cổng Codex (P0), tin nhắc chỉ đi tới nhóm phục vụ đúng một dự án, là dự án của đích. Nhóm chung (Dragon Forge) bị từ chối, vì tin nêu tên dự án và tên người.
  - Biên nhận ở nhóm chung hiện nay cố ý không nêu tên dự án.
  - Phương án: (1) giữ; (2) cho nhóm chung nhận tin nhắc của dự án miền Liberico BU, do Chairman chốt. Tạm: (1).
- **Q-GV5F-7. Danh sách của một dự án gồm những ai.** Tin GO LIVE của dự án A xét **mọi** thành viên roster Team Tech, đúng kế hoạch §2.2. Vì thế nhóm của A có thể thấy tên người chưa gửi yêu cầu cho A dù người đó không làm A, kể cả người chỉ làm ở BU khác. Số đếm việc chỉ tính trong A.
  - Phương án: (1) giữ, vì GO LIVE là đợt chung của cả Team Tech; (2) chỉ xét người có membership hay việc được giao trong dự án; (3) người vận hành khai danh sách người theo dõi cho mỗi đích.
  - Tạm: (1). Chưa đích nào được bật, nên chưa tin nào được gửi.

---

## V1 — Kiểm trước khi cài (`deploy/preflight.py`, 0.9.8, 28/11/2026)

Các điểm phải suy đoán do thiếu tệp/mã ngoài repo trong lát V1 (GIAO VIỆC 11). Ghi nối cuối tệp để giữ nguyên số dòng các mục trước.

- **OQ-63 — Danh sách thư mục quét plugin và thứ tự thắng của Hermes trên d1-ai1.**
  - Repo chỉ nêu ba đường dẫn liên quan plugin Hermes: `/home/iptech/.hermes/profiles/libetech/plugins` (`install-d1.sh`, `BRIDGE-INSTALL-20261108.log`), `/home/iptech/.hermes/plugins` (suy từ `dashboard-plugin`), và `/home/iptech/.hermes/hermes-agent/plugins` (`TELEGRAM-CHECK-20261108T220013.json`). Mã nguồn trình nạp plugin của Hermes không nằm trong repo này nên chưa kiểm chứng được danh sách quét đầy đủ và luật ưu tiên chính xác giữa các thư mục.
  - Hành vi tạm trong `deploy/preflight.py`: quét mặc định 3 thư mục trên (cho phép truyền `--plugin-scan-dir` tường minh theo thứ tự), **chặn mọi bản trùng `name`** (fail-closed bất kể thứ tự thắng), và báo bản thắng theo `last-wins` sau khi sắp tên (khớp hiện trạng D: bản sao lưu `.bak`/cũ đè `libetech-ai-os-bridge` 0.3.6; hỗ trợ `--precedence first-wins`).
  - Cần xác nhận (Codex trên d1-ai1): danh sách đầy đủ thư mục Hermes quét và luật nạp (`last-wins` hay `first-wins`) để ghim chính xác.
- **OQ-64 — Lược đồ và vị trí tệp `release.env` trên d1-ai1 (và thiếu `RUNBOOK-097` trong repo).**
  - Giao việc 11 nêu đọc `RUNBOOK-097` và kiểm `release.env` khớp gói (digest/version). Kiểm thực tế cây `543ba01`: `docs/RUNBOOK-097` **không tồn tại** (chỉ có `RUNBOOK-091`–`RUNBOOK-095`; `0.9.6`/`0.9.7` có hồ sơ ở `docs/reviews/*-evidence-20261127/`), và chuỗi `release.env` chưa xuất hiện ở tệp nào trong repo (repo chỉ có `web.env` mang `LIBETECH_BUILD_DIGEST`).
  - Hành vi tạm trong `deploy/preflight.py`: ở `--mode upgrade`, bắt buộc truyền `--release-env` (hoặc `LIBETECH_RELEASE_ENV`) chứa cặp digest (`LIBETECH_BUILD_DIGEST` hoặc `LIBETECH_BUNDLE_TREE_SHA256`) và phiên bản (`LIBETECH_RELEASE_VERSION` hoặc `RELEASE_VERSION`), tuỳ chọn `LIBETECH_PLUGIN_VERSION`, `LIBETECH_ARCHIVE_SHA256`, `SOURCE_SHA`; chỉ đọc khoá allowlist, chặn symlink và tệp world-writable. Ở `--mode install` (`install-d1.sh`), dùng `--expected-digest` khi chưa có `release.env` và kiểm thêm `release.env` nếu biến `LIBETECH_RELEASE_ENV` được đặt.
  - Cần xác nhận (Cowork / Codex): tên khoá thật và đường dẫn chuẩn của `release.env` đang dùng trên d1-ai1 (nếu đã có từ `DEPLOY-006/007/008` ngoài repo).
- **OQ-65 — Chế độ unit đang chạy trên d1-ai1 (`systemd --user` dưới `iptech` so với system unit dưới `libetech-os`).**
  - `deploy/install-d1.sh` cài system unit `User=libetech-os` vào `/etc/systemd/system/`, còn `deploy/install-user.py`, `deploy/libetech-ai-os-outbox.service`, `reminders.service`, `golive-status.service` nhắm tuyến `systemd --user` dưới `iptech` (và finding P0 về unit outbox ở `DELIVERY-020` chưa có xác nhận trong repo).
  - Hành vi tạm trong `deploy/preflight.py`: kiểm đồng thời `/etc/systemd/system` và `/home/iptech/.config/systemd/user` (gồm drop-in `*.service.d/*.conf`), chặn system unit thiếu `User=` hoặc chạy `root`/`0`, chặn user unit khai `User=`/`Group=`, và chặn trùng cùng tên unit ở hai phạm vi.
  - Cần xác nhận (Codex trên d1-ai1): danh sách unit và phạm vi (`system` hay `user`) đang chạy thực tế trên d1-ai1.


