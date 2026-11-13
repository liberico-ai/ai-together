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

**Bổ sung 13/11/2026 khi lập kế hoạch lát 2** (`docs/plans/slice-2-intake-outbox.md`, base `ce11242`). Bốn mục dưới đây ghi lúc lập kế hoạch khi **chưa có quyết định**. Phần không bị ảnh hưởng của lát 2 vẫn được lập kế hoạch đầy đủ.

## OQ-26 — Sổ ticket của plugin priority1 tới AI OS bằng đường nào để đối soát

- **Lát:** 2 (chỉ phần nạp sổ ticket thật cho ca đối soát của OQ-09 mục 2; hàm đối soát và test trên dữ liệu tổng hợp vẫn làm), 3–4 (nối ticket ↔ việc).
- **Phía A:** `docs/SPEC-008-PM-operating-loop-20261111.md:75` — «Adapter gửi event ticket mới sang hàng chờ AI OS bằng chữ ký, nonce và idempotency key»; `:116` payload của adapter có `ticket ID`. Không dòng nào nói adapter nằm trong plugin nào và ai viết.
- **Phía B:** `AGENTS.md:5` «The existing priority1 plugin remains independent» và quyết định OQ-09 «không sửa plugin priority1»; `AGENTS.md:13` + AR-01/E-INT-01 cấm AI OS đọc DB của nền khác (sổ ticket là SQLite của plugin đó). Đọc mã nguồn plugin priority1 ngày 13/11 (chỉ mã, không dữ liệu): plugin không có lời gọi nào sang AI OS và không có lệnh xuất sổ ticket. `docs/ADR-002-project-document-ownership.md` «Tích hợp» chỉ cho ba đường REST/queue/ETL có manifest và nói «không cutover trong ADR này».
- **Phương án:** (a) chủ plugin priority1 thêm adapter ký HMAC gửi sự kiện ticket sang một tuyến mới dưới `/api/bridge/…` — phải sửa plugin priority1, cần Chairman nới `AGENTS.md:5`; (b) người vận hành sổ ticket xuất tệp có manifest (mã ticket, chat, message, trạng thái, thời điểm, hash tệp), AI OS nhập bằng ETL chỉ đọc qua `scripts/` — cần chốt ai xuất, định dạng và nơi đặt tệp; (c) lát 2 chỉ dừng ở hàm đối soát trên dữ liệu tổng hợp, đối soát thật làm tay ở đợt runtime bằng hai bản kê do hai bên tự xuất; (d) `bot-plugin` của repo này hỏi sổ ticket qua công cụ sẵn có của priority1 trong gateway — là kiểu tích hợp thứ tư, cần ADR (AR-10).
- **Ai quyết:** Chairman (đụng `AGENTS.md:5` hoặc AR-10); BoM Tech cho định dạng nếu chọn (b).
- **Trạng thái lúc lập kế hoạch:** chưa quyết. Kế hoạch lát 2 (Task 8) viết hàm thuần `reconcileLedger` và hàm đọc phía inbox, kiểm bằng fixture tổng hợp; **không** viết mã đọc SQLite, adapter, tuyến nhận hay script nhập sổ ticket.

## OQ-27 — Tin từ nhóm gắn nhiều dự án thuộc dự án nào trước khi PM xác nhận

- **Lát:** 2 (chỉ nhóm có từ hai dự án trong `chatScopes`; nhóm một dự án vẫn làm đủ), 3–4.
- **Phía A:** `docs/SPEC-008-PM-operating-loop-20261111.md:294` — «Một nhóm có thể nhận nhiều sản phẩm Xeca: bot hỏi đúng sản phẩm/dịch vụ khi chưa rõ, không mặc định tất cả vào dự án đã biết»; `:76` PM xác nhận project; cấu hình `chatScopes` cho phép một nhóm nhiều dự án (`src/app/api/bridge/route.ts:12`).
- **Phía B:** quy ước migration buộc mỗi bảng có `project_id` và RLS theo dự án (`docs/SLICE-BRIEFS.md:10`); `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:87` buộc ghi bền **trước** khi ACK, tức trước khi có ai chọn dự án; `AGENTS.md:16` cấm cộng gộp giữa các miền báo cáo — một nhóm có thể gắn dự án thuộc hai miền. Không tài liệu nào nói SourceEvent chưa rõ dự án thì ai được thấy.
- **Phương án:** (a) chỉ nhận tin từ nhóm gắn đúng một dự án; nhóm nhiều dự án bị từ chối cho tới khi tách cấu hình; (b) cấu hình vận hành khai một «dự án tiếp nhận mặc định» cho mỗi nhóm, PM chuyển ứng viên sang dự án khác của cùng nhóm sau; (c) lưu ở trạng thái chưa gán, chỉ người có quyền trên **mọi** dự án của nhóm mới thấy, PM gán rồi mới vào Inbox dự án — cần bảng không có `project_id` và policy riêng; (d) bot hỏi lại người báo chọn sản phẩm trước khi lưu — trái «ghi bền trước khi ACK».
- **Ai quyết:** Chairman (phạm vi thấy dữ liệu); BoM Tech cho cấu hình nếu chọn (b).
- **Trạng thái lúc lập kế hoạch:** chưa quyết. Kế hoạch lát 2 (Task 4) từ chối nhóm nhiều dự án bằng lỗi `INTAKE_PROJECT_AMBIGUOUS` và không lưu gì — hành vi giữ chỗ fail-closed, không phải phương án được chọn.

## OQ-28 — Có lưu trích nội dung tin Telegram cho dự án chưa ánh xạ miền báo cáo không

- **Lát:** 2 (chỉ việc lưu chữ của tin cho dự án chưa có dòng ánh xạ miền; con trỏ, hash, metadata vẫn lưu), 3–4.
- **Phía A:** `AGENTS.md:16` và `docs/SPEC-008-PM-operating-loop-20261111.md:106` — IBS HI chỉ lưu con trỏ, hash, metadata việc Tech; `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:70` cho phép lưu «tin cần thiết hoặc trích được phép».
- **Phía B:** quyết định OQ-04 — dự án chưa có dòng ánh xạ hiện «Chưa xác nhận»; AI không ánh xạ dự án nào; lát 1 chưa có đường ghi ánh xạ (`migrations/013_project_registry.sql` không cấp INSERT). Vậy hiện mọi dự án thật đều «Chưa xác nhận», và không tài liệu nào nói tin của dự án chưa xác nhận miền thì được lưu chữ hay chỉ con trỏ.
- **Phương án:** (a) chưa ánh xạ thì coi như IBS HI: chỉ con trỏ + hash + metadata, PM mở tin gốc trong Telegram — an toàn nhưng Inbox không có chữ cho tới khi có ánh xạ; (b) chỉ `IBS_HI` mới bị giới hạn, chưa ánh xạ vẫn lưu trích; (c) cấu hình vận hành khai theo từng nhóm có được lưu trích hay không, độc lập với nhãn miền. Kèm: ai và ở lát nào làm đường ghi dòng ánh xạ.
- **Ai quyết:** Chairman (chính sách dữ liệu giữa các pháp nhân).
- **Trạng thái lúc lập kế hoạch:** chưa quyết. Kế hoạch lát 2 (Task 4) lưu trích cho dự án ánh xạ `LIBERICO_BU`/`XECA`, chỉ con trỏ + hash cho `IBS_HI` và cho dự án chưa ánh xạ (giữ chỗ fail-closed); test chỉ dùng dòng ánh xạ của dự án tổng hợp.

## OQ-29 — Quy tắc đủ phiếu, hạn và ghế cho phiếu đổi quyền của thành viên đã có

- **Lát:** 2 (ca (b) của SPEC-007; mã vẫn làm).
- **Phía A:** `docs/SPEC-007-telegram-account-approval.md:33` — mở rộng quyền sau kích hoạt «is blocked until the separate access-change ballot is implemented»; `:40` — «A follow-up ballot for changes to an existing member is required». Quyết định OQ-12 (c) giao làm phiếu đổi quyền ở P1.1.
- **Phía B:** SPEC-007 chỉ định nghĩa quy tắc cho phiếu cấp tài khoản lần đầu (`:3`, `:32`: Chairman + một BoM, ghế đóng băng, hạn 48 giờ theo `migrations/009_telegram_account_approval.sql`). Không dòng nào nói phiếu đổi quyền dùng cùng quy tắc, có cần chủ dự án được thêm vào đồng ý, hay người được đổi quyền (nếu đang giữ ghế BoM) có được bỏ phiếu cho chính mình.
- **Phương án:** (a) dùng lại nguyên quy tắc phiếu lần đầu (Chairman + ít nhất một BoM, 48 giờ), người được đổi quyền không bỏ phiếu cho mình; (b) như (a) và thêm xác nhận của PM/chủ dự án được thêm vào; (c) chỉ Chairman duyệt với thay đổi nhỏ (thêm quyền báo cáo), phiếu đủ cho thêm dự án hoặc nâng vai.
- **Ai quyết:** Chairman.
- **Trạng thái lúc lập kế hoạch:** chưa quyết. Kế hoạch lát 2 (Task 9) dùng lại hàm đếm phiếu hiện có, không đặt quy tắc mới, và loại ghế của chính người được đổi quyền khỏi danh sách bỏ phiếu. Cần xác nhận trước khi dùng cho người thật; đổi quy tắc sau chỉ chạm hàm đếm phiếu.
