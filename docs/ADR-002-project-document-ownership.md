# ADR 002 Chủ dữ liệu sổ dự án, tiếp nhận, tài liệu dự án và bản chuẩn đã duyệt

Version: 1.1 · 12/11/2026. Status: **Accepted** (Chairman ký 12/11/2026, xem Adoption record). Authority: Chairman. Scope: LibeTech AI OS Phase 1 (lát 1–4), extends ADR-001, SPEC-008 §3/§6 và SPEC-009. Đây là hồ sơ quyết định chuẩn bị cho triển khai, không yêu cầu quyết lại công việc nghiên cứu đã duyệt.

Changelog:
- 1.0 → 1.1 — thêm sổ dự án, ProjectChannel, SourceEvent/inbox, ứng viên intake, outbox/biên nhận giao, kho snapshot, principal máy và bảng một-chủ theo AR-09 (đóng khoảng trống OQ-02).
- 1.1 sửa 12/11 theo duyệt hướng và phản biện Codex — thêm mục hiệu lực theo giai đoạn; nhãn miền báo cáo thay trục ánh xạ từ `bu`; kho snapshot và principal pipeline AI chuyển thành thiết kế có cổng; quyền chủ SourceEvent/intake chỉ có hiệu lực ở P1.1. Căn cứ: `DECISION-PACK-OQ-20261112.md` bản 0.2, `reviews/CODEX-STEP0-P1-READINESS-20261112.md:95-97`. Entity vận hành của lát 5 thuộc ADR-003, không thuộc ADR này.

## Context

Tài liệu team nằm trong Drive/Docs, Vault và repo. AI OS hiện có liên kết spec/evidence nhưng chưa có vòng tài liệu đầy đủ. Cần hỗ trợ bot soạn/cập nhật và ghi nhận người xác nhận mà vẫn giữ một chủ nội dung, quyền từng dự án và dữ liệu hiện hữu. Quy định AR-03/05/06/09 áp dụng; hệ thống không đọc DB nền khác.

Bản 1.0 chỉ nêu năm entity tài liệu. SPEC-009 `:135-136` còn định nghĩa SourceEvent và ProjectChannel; SPEC-008 `:53`, `:137` đòi ADR về entity và chủ nguồn trước migration; handoff `:74` buộc tách báo cáo theo Liberico BU · Xeca · IBS HI trong khi schema chỉ có một tenant và cột chữ `projects.bu`. `AGENTS.md:13` giữ bot chỉ đọc, còn tiếp nhận từ nhóm cần một đường ghi hẹp.

## Decision proposed

### Hiệu lực theo giai đoạn

| Giai đoạn | Có hiệu lực khi ADR được ký | Chưa có hiệu lực |
|---|---|---|
| P1.0 | Hồ sơ dự án mở rộng; nhãn miền báo cáo; ánh xạ kênh ở trạng thái «đề xuất»; DocumentRecord/Revision metadata; chỉ mục mẫu; chỉ mục tìm kiếm Z2 | Mọi thứ ở các hàng dưới |
| P1.1 | Quyền chủ SourceEvent/inbox, ứng viên intake, outbox, biên nhận giao; ProjectChannel thành nguồn hiệu lực; principal tiếp nhận | Chỉ sau hai chứng minh: tin nhóm thật tới được `bot-plugin` của repo này song song với priority1, và ca đối soát inbox ↔ sổ ticket đạt |
| P1.2–P1.3 | ReviewDecision, TraceLink, Publication | Bảng Z4 và principal pipeline AI: không hoạt động tới khi Chairman duyệt bảng phân loại dữ liệu → mô hình |
| Trước pilot | — | Kho snapshot: không đóng băng, tải lên hay duyệt bản chuẩn thật tới khi chốt quyền nguồn, chính sách lưu giữ và một lần thử khôi phục đạt |

**Giới hạn lần đầu (P1.0):** chỉ đăng ký con trỏ, version/hash kèm mức xác minh, bản nháp và chỉ mục tìm kiếm có quyền. Bản chuẩn có thể chưa tồn tại. Không tự tạo snapshot, đổi quyền chia sẻ nguồn, cấp ID việc, sửa Sheet hay áp quyền nhóm mới. Không chuyển trạng thái ticket. Áp migration lên dữ liệu thật là lần triển khai riêng, có duyệt riêng.

### Nội dung quyết định

- **Nội dung tài liệu** tiếp tục do nguồn hiện có sở hữu. Mỗi DocumentRecord chỉ định đúng một canonical_uri/content_owner; không đồng bộ ghi hai chiều giữa Drive và Git cho cùng một tài liệu.
- **Quản trị tài liệu:** AI OS sở hữu DocumentRecord, DocumentRevision metadata, ReviewDecision, Publication và TraceLink trong Z1 theo từng lát; không giành quyền sở hữu nội dung nghiệp vụ của các BU. Liên kết tới dòng nguồn giữ `source_ref` với nhãn «chưa đối soát»; `source_ref` không phải ID việc.
- **Sổ dự án và nhãn miền báo cáo:** AI OS sở hữu hồ sơ dự án mở rộng; giữ nguyên project ID, membership và RLS; không tách tenant. Ba nhãn Liberico BU · Xeca · IBS HI là nhãn phân nhóm dữ liệu, không phải `tenant_id`, `organization_id` hay `entity_code` và không khẳng định tư cách pháp nhân. Dòng ánh xạ dự án → nhãn do người có quyền tạo hoặc xác nhận, có nguồn và audit; AI không tạo hay đề xuất dòng nào. Thiếu ánh xạ hiện «Chưa xác nhận», không sinh quyền, không vào tổng nào. Không cộng gộp giữa ba nhãn.
- **ProjectChannel:** AI OS sở hữu ánh xạ chat/topic → dự án, chế độ nhận, người duyệt, policy_version. Ở P1.0 mỗi dòng chỉ là đề xuất và không cấp quyền; cấu hình gateway `chatScopes` vẫn là nguồn hiệu lực. Nhóm mới mặc định chưa cấp. Việc chuyển nguồn hiệu lực sang bảng diễn ra ở P1.1 theo expand → migrate → contract.
- **SourceEvent/inbox và ứng viên intake (P1.1):** AI OS sở hữu; ghi bền trước khi ACK, đủ bốn trường nguồn (AR-05), khử trùng bằng khoá sự kiện có UNIQUE. **Ticket và trạng thái ticket** vẫn do sổ ticket của plugin priority1 sở hữu; AI OS chỉ giữ mã ticket như tham chiếu ngoài và không sửa ticket. Không cutover trong ADR này.
- **Outbox và biên nhận giao (P1.1):** AI OS sở hữu; outbox ghi cùng transaction với thay đổi Z1 (E-INT-06). Gateway giữ token và thực hiện gửi, kéo outbox qua cầu nối đã ký rồi báo biên nhận; «đã ghi» khác «đã giao» khác «người nhận đã xác nhận».
- **Principal máy:** (1) bot đọc, giữ chỉ đọc; (2) dịch vụ tiếp nhận/giao, từ P1.1, chỉ ghi SourceEvent, ứng viên intake, biên nhận giao; (3) pipeline AI, chỉ ghi nháp Z4, **chưa cấp khoá** tới khi có bảng phân loại được duyệt. Không principal nào tạo/gán/đóng việc, duyệt, nghiệm thu hay cấp quyền. Actor và tenant không lấy từ thân yêu cầu.
- **Bản chuẩn và hash:** hai con trỏ «bản đang soạn» và «bản chuẩn» độc lập; bản chuẩn được phép rỗng. Mỗi hash mang mức xác minh; hash do người đăng ký khai không được hiện như đã kiểm. Chưa giữ được snapshot thì trạng thái là `SOURCE_NOT_FROZEN`.
- **Kho snapshot (thiết kế, có cổng):** PostgreSQL của AI OS, bảng riêng, bất biến, có trần kích thước, hash do server tính, cùng RLS và backup; phục vụ bằng chứng, không làm nơi soạn. Nguồn IBS HI chỉ lưu con trỏ/hash/metadata Tech, không cache nội dung.
- **Vùng dữ liệu:** người có quyền xác nhận; domain service áp thay đổi Z1. Projector có tên tạo bản chiếu Z2 cho dashboard/search; kiểm quyền trước truy vấn và trước khi trả. AI chỉ soạn ở Z4 khi Z4 được bật.
- **Tích hợp:** web, bot và adapter dùng cùng domain policy qua REST/queue; import lịch sử là ETL có manifest. Không query chéo DB. Giai đoạn 1 không phụ thuộc Factory.

### Một chủ cho mỗi entity (AR-09)

| Entity | Chủ duy nhất | Zone | Từ |
|---|---|---|---|
| Nội dung tài liệu | Nguồn hiện có theo `content_owner` (Drive/Docs, Git, Vault) | ngoài AI OS | hiện tại |
| Ticket, trạng thái ticket | Sổ ticket plugin priority1 | ngoài AI OS | hiện tại |
| Bảng việc của team (Sheet) | Team/PM giữ bảng | ngoài AI OS | hiện tại |
| Token Telegram, thao tác gửi, bytes tệp đính kèm, `chatScopes` | Gateway | ngoài AI OS | hiện tại |
| Hồ sơ dự án, nhãn miền báo cáo, ánh xạ dự án → nhãn | AI OS | Z1 | P1.0 |
| ProjectChannel (đề xuất ở P1.0, hiệu lực ở P1.1) | AI OS | Z1 | P1.0 |
| DocumentRecord, DocumentRevision metadata, chỉ mục mẫu T0–T6 | AI OS | Z1 | P1.0 |
| Chỉ mục metadata tài liệu, bản tổng hợp dashboard | AI OS, do projector có tên ghi | Z2 | P1.0 |
| SourceEvent/inbox, ứng viên intake, outbox, biên nhận giao | AI OS | Z1 | P1.1, sau hai chứng minh |
| ReviewDecision, TraceLink, Publication | AI OS | Z1 | P1.2–P1.3 |
| Nháp và gợi ý AI | AI OS giữ bảng; chỉ pipeline AI ghi | Z4 | sau khi duyệt phân loại |
| Snapshot bản chuẩn | AI OS | Z1 | sau cổng trước pilot |

Các entity trên là entity nội bộ của AI OS, không phải canonical entity dùng chung toàn hệ; nền khác muốn dùng phải có ADR riêng.

## Consequences

Giữ công cụ soạn hiện tại, giảm nhập lại và có bằng chứng phiên bản. Trong P1.0 mọi tài liệu ở `SOURCE_NOT_FROZEN` và mọi hash ở mức tự khai, nên chưa có bản chuẩn được đóng băng thật. Sổ ticket và inbox cùng thấy một tin, nên việc nối ticket ↔ ứng viên do PM xác nhận và phải có ca đối soát. Nếu hai plugin không cùng nhận được một tin thì phần P1.1 của ADR này phải trình lại; không sửa plugin priority1. `AGENTS.md:5`, `:9`, `:11`, `:13` cần Chairman sửa theo từng mốc (lời văn ở gói quyết định §5; AI không tự sửa). Migration từ 013 có tệp rollback ở `migrations/rollback/`, thử trên bản sao; cần backup/restore và acceptance tests DOC-01…18 trước rollout. Không thay trạng thái work khi chỉ đăng ký hoặc duyệt tài liệu.

## Alternatives

Kho tự host BookStack/Docmost: có UI cộng tác sẵn nhưng thêm danh tính/DB/backup và license ở một số tính năng. Docs-only Git/Docusaurus: thuận lợi cho dev, chưa thuận cho reviewer nghiệp vụ và quyết định trong chat. Xây editor mới trong AI OS: thêm phần realtime/editing lớn; chưa đủ lý do trong Phase 1.

Cho phần 1.1: ADR-003 riêng cho sổ dự án/kênh/sự kiện — tách hai lần ký cho cùng một lát. Nới bot thành principal ghi — trái `AGENTS.md:13`. Tách tenant theo miền — đổi mô hình RLS, ngoài phạm vi Phase 1. AI ánh xạ sẵn dự án vào nhãn miền — không có nguồn xác nhận, dễ cộng sai tổng. Đóng băng snapshot ngay ở P1.0 — chưa có quyền nguồn, chính sách lưu giữ và thử khôi phục.

## Adoption record

- **Decision:** Accepted — bản 1.1 nguyên văn như tại commit `779dcc9ac928a141f500427badff525eeefad9ef` (sha256 nội dung trước khi ghi mục này `4fc570220813475b634ddde0f9a1f19270b55c238b91afd3e49ad396b426967d`), PR liberico-ai/ai-together#3.
- **Người quyết:** Chairman. **Lời ký nguyên văn:** «Ký ADR-002 1.1» — ngày 12/11/2026, trong phiên Claude Code, trả lời câu hỏi «Anh ký ADR-002 bản 1.1 không?».
- **Ngày hiệu lực:** 12/11/2026.
- **Phạm vi chữ ký:** nội dung ADR này. Chữ ký **không** bao gồm: merge PR vào `libetech-ai-os`, sửa `AGENTS.md` (đề xuất ở `DECISION-PACK-OQ-20261112.md` §5, cần duyệt riêng theo R10), áp migration lên dữ liệu thật, triển khai d1-ai1, khởi động lại gateway hay gửi tin thật. Phần SourceEvent/inbox, principal tiếp nhận và outbox vẫn chỉ có hiệu lực sau hai chứng minh OQ-09; kho snapshot vẫn sau cổng trước pilot OQ-07; principal pipeline AI vẫn chờ bảng phân loại OQ-14.
- **Migration/cutover receipt:** chưa có. Migration 013+ được phép viết từ ngày hiệu lực; áp lên dữ liệu thật là lần duyệt riêng.
- Lịch sử: quyết định chọn nghiên cứu, lời «Làm đủ luôn» và lời duyệt hướng gói OQ ngày 12/11/2026 không được dùng thay chữ ký; chữ ký là lời trên.
