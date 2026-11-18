# Thứ tự triển khai LibeTech AI OS

**Căn cứ gần nhất 11/11/2026:** [biên nhận 0.7.1](DELIVERY-008-pilot-onboarding-20261111.md) xác nhận gói mở tài khoản pilot sau [0.7.0 catalog](DELIVERY-007-team-catalog-20261111.md). Bảng nguồn được đọc lại trong lượt scan PM/điều hành: 45 dòng (LBRC 18, XECA 7, IBS HI 20). Đây là ảnh nguồn, chưa phải 45 việc Z1 được đối soát/nghiệm thu. Lượt thiết kế này chưa đo lại server/gateway; không suy việc cấp tài khoản đồng nghĩa đã kích hoạt, ghép Telegram và dùng thật.

## Ưu tiên hiện hành — PM/BA và tài liệu trước, Factory sau

Theo chỉ đạo mới nhất ngày 11/11, [SPEC-009](SPEC-009-PM-BA-DOCUMENTS-20261111.md) mở rộng [SPEC-008 v0.4](SPEC-008-PM-operating-loop-20261111.md): nhận trao đổi/yêu cầu từ nhiều nhóm được cấp, làm rõ nhu cầu, viết–review–duyệt–chia sẻ và cập nhật tài liệu liên kết với việc. Jira cũ chỉ tham khảo; không di trú Jira để mở Phase 1. Thiết kế và roadmap đã cập nhật, chưa triển khai năng lực mới trong lượt này.

**Phương án:** Drive/Docs + Git giữ nguồn nội dung; AI OS giữ registry, bản chuẩn được duyệt, quyết định và traceability; bot là cửa nhận và trợ lý PM/BA. Đã so [tám repo](RESEARCH-PM-DOC-REPOS-20261111.md); chưa cài framework hoặc kho mới. [ADR-002](ADR-002-project-document-ownership.md) là đề xuất chủ dữ liệu. [Mẫu T0–T6](PM-DOCUMENT-TEMPLATES.md) và [UI](DESIGN-SYSTEM-PM-DOCUMENTS.md) dùng cho pilot.

| Thứ tự | Đầu ra triển khai | Cổng hoàn tất | Vai trò chịu trách nhiệm đề xuất |
|---|---|---|---|
| P1.0 | Sổ dự án, nhóm và tài liệu; nguồn chính, quyền, revision; mẫu T0–T6 | XECA006 và LBRC014 có nguồn, bản nháp/bản chuẩn riêng; không đổi Sheet; kiểm quyền âm qua search/file/export | PM xác nhận mapping; kỹ thuật xây registry và adapter |
| P1.1 | Gateway intake, inbox và outbox, tự nhận tin mới ở nhóm đã cấp | Tin thường/reply/tệp/topic được lưu trước ACK; retry không tạo trùng; receipt đúng nhóm; nói rõ khoảng thiếu lịch sử | Kỹ thuật/gateway cùng PM và đại diện dự án |
| P1.2 | Sáu kỹ năng PM/BA; review đúng revision; phê duyệt và cập nhật phụ thuộc | Đầu ra có nguồn; nguồn đổi phải đọc lại; tự nghiệm thu bị chặn; chia lại việc 2/3 chưa áp, 3/3 có receipt | Tác giả, reviewer và BoM đúng quyền |
| P1.3 | Chia sẻ bản đã duyệt, tra tài liệu, dashboard dự án/nhân sự theo bằng chứng | Người dùng đi hết một vòng thật; quyền thu hồi chặn queue/cache; dữ liệu thiếu không biến thành điểm thấp | PM/người nhận UAT; vận hành đo delivery |
| P1 mở rộng | Các gói COO về incident, capacity, discovery, dịch vụ/chi phí và score giải trình của SPEC-008 | Chọn theo giá trị/tải thực; không trì hoãn PM/tài liệu vì muốn làm đủ bộ COO. Công thức KPI/lương duyệt riêng | BoM chốt thứ tự sau pilot |
| P2 | Hợp đồng Dev Factory, code/test/release và maintenance; cập nhật docs từ kết quả | Input/output đúng revision/hash; bản chạy được đo; docs/runbook được review; không ngầm cấp quyền deploy | Kỹ thuật và người có quyền triển khai/nhận bàn giao |

**Trạng thái P1.0 ngày 12/11/2026:** **đã có mã** trên nhánh `slice-1-doc-ownership` (mã ở `a319e10`), biên nhận [DELIVERY-010](DELIVERY-010-project-document-registry-20261112.md), review [REVIEW-slice-1](reviews/REVIEW-slice-1-20261112.md) — Codex vòng 3 PASS; PR liberico-ai/ai-together#6, merge vào `libetech-ai-os` ngày 12/11/2026 (`9873f4a`). Chưa triển khai, chưa dùng thật, chưa nghiệm thu; migration 013–015 chưa áp DB thật. Ca Xeca «chờ tin gốc». OQ-25 (host nguồn được phép) đã chốt ngày 13/11/2026: (a) allowlist cố định trong mã, mã chặn host ở `src/server/source-hosts.ts`. Mở các tuyến tài liệu ra proxy công khai vẫn là điểm dừng triển khai. Lát 2 (P1.1) chỉ mở sau khi biên nhận lát 1 được Chairman xem.

**Trạng thái P1.1 ngày 14/11/2026:** **đã có mã** — đạt cổng Codex ở vòng 5 (PASS, không finding).

- Nhánh `slice-2-intake-outbox`, mã ở `001d387`, PR liberico-ai/ai-together#10, merge vào `libetech-ai-os` ngày 14/11/2026 (`eb85364`). Chưa triển khai, chưa dùng thật, chưa nghiệm thu; migration 016–018 chưa áp DB thật. Biên nhận: [DELIVERY-011](DELIVERY-011-intake-outbox-20261113.md). Review: [REVIEW-slice-2](reviews/REVIEW-slice-2-20261113.md).
- Test, typecheck và build xanh ở `001d387`: native 506/0 bỏ qua, PGlite 485/21 bỏ qua, pytest 66.
- Chairman đã quyết OQ-26…30 ngày 14/11/2026; mã đã theo OQ-27, OQ-28 (cờ lưu trích theo nhóm), OQ-29 (phiếu đổi quyền đủ khi một BoM đồng ý) và OQ-30 (chế độ theo từng bản sửa, Inbox ẩn theo cấu hình hiện tại).
- Bốn vòng sửa theo Codex; vòng 3 và vòng 4 có quyết định riêng. `liberico-reality-checker` đã kiểm biên nhận trước khi ghi «đạt».
- Chưa triển khai, chưa dùng thật, chưa nghiệm thu. Migration 016–018 chưa áp lên DB thật. ProjectChannel chưa kích hoạt, vì OQ-09 mục (1) chưa chứng minh.
- Việc để lại cho lát sau: thủ tục xoá hoặc che chữ đã lưu có người duyệt (OQ-30 kèm); tách luật hiển thị nội dung thành mô-đun dùng chung trước khi lát 3 thêm chỗ đọc `source_event_revisions`; công cụ nạp lại tệp dead-letter của plugin.
- Chờ Chairman: xác nhận các cách hiểu kèm OQ-28/OQ-29; S5; DOC-16; gợi ý «cùng nội dung» cho tin không hiện chữ. S13 đã được Chairman xác nhận ngày 18/11/2026 (`docs/OPEN-QUESTIONS.md`, khối «Xác nhận của Chairman ngày 18/11/2026 về S13 của lát 2» ở cuối tệp).

**Trạng thái P1.2 ngày 16/11/2026:** **đã có mã** — Codex vòng 4: PASS, không có finding.

- Nhánh `slice-3-review-skills`, mã ở `007cded`, PR [#12](https://github.com/liberico-ai/ai-together/pull/12), merge vào `libetech-ai-os` ngày 16/11/2026 (`08322d3`). Chưa triển khai, chưa dùng thật, chưa nghiệm thu; migration 019–021 chưa áp DB thật; **chưa nối mô hình, Z4 chưa bật**, eval chạy với đầu ra giả lập; thao tác duyệt chỉ chạy trên dữ liệu tổng hợp; PM-02 «chờ tin gốc». Biên nhận: [DELIVERY-012](DELIVERY-012-review-skills-20261115.md). Review: [REVIEW-slice-3](reviews/REVIEW-slice-3-20261115.md).
- Test, coverage, typecheck và build xanh ở `007cded`: native 1014/0 bỏ qua, PGlite 973/41 bỏ qua, pytest 67, coverage dòng 97,39.
- Chairman đã quyết OQ-31…OQ-42 ngày 15/11/2026. Theo các quyết định đó: người nhận xét do điều phối dự án chỉ định và thu hồi; quyền duyệt bản chuẩn đi qua phiếu đổi quyền một BoM; **đường để điều phối dự án trình phiếu (Task 7c, OQ-33 b) tách PR riêng sau lát 3** — nay đã có mã, xem khối Task 7c bên dưới; phần Telegram của thẻ quyết định không làm (OQ-32 c).
- Bốn vòng Codex, ba vòng sửa: vòng 3 dừng ở CHANGES_REQUIRED với một finding P2 khi hai vòng sửa của quy trình đã hết; vòng sửa thứ ba và lượt chạy thứ tư làm theo lời Chairman («Sửa P2, chạy lại»). Review tầng 1 theo task và toàn nhánh. Số migration của lát là 019–021: **brief lát 4 phải dời sang 022 trở đi**.
- Chairman đã quyết ngày 16/11/2026: OQ-43 (a) và OQ-44 (a), trùng hành vi của mã; với mục P2 của Codex vòng 3: «Sửa P2, chạy lại» — đã sửa ở `ccbe70c` và `007cded`, Codex vòng 4 PASS.
- Chairman đã quyết ngày 16/11/2026: OQ-47 (b) — phiếu 3/3 đã đóng xếp theo lúc đóng, nên thẻ vừa đóng giữ chỗ trên màn Quyết định; sửa trong PR #14 sau finding P2 của Codex vòng 1 của PR đó.
- Chờ Chairman: xác nhận các cách hiểu S11, S15, S32–S34, S51; sửa `AGENTS.md` (dòng Z4, schema `intelligence`, thư mục `skills/`); cân nhắc đổi một token của máy trạm đã lọt vào đầu ra công cụ của một subagent (không vào repo). OQ-45 và OQ-46 đã được Chairman quyết ngày 18/11/2026 (`docs/OPEN-QUESTIONS.md`, khối «Quyết định của Chairman ngày 18/11/2026 về OQ-45 và OQ-46» ở cuối tệp); mã của hai quyết định chưa có và phải có trước khi bật Z4. *(Cập nhật 18/11/2026: mã đã được viết trên nhánh `feat/oq-45-46-ai-drafts`, chưa merge — xem khối trạng thái của PR đó bên dưới.)*
- Việc để lại cho lát sau: PR riêng cho Task 7c và biểu mẫu của nó (đã có mã, PR #16 merge vào `libetech-ai-os` ngày 16/11/2026 (`1237ae4`) — khối Task 7c bên dưới); gỡ cờ «cần xem lại» và thông báo (lát 4); nhãn quyền `doc_approve:*` trong plugin trước khi dùng thật; phân trang các danh sách có trần; bốn mục lân cận của lượt quét (biên nhận lát 3, mục 45–48; mục 44 — thẻ 3/3 đứng sau trần và thiếu cờ «đã cắt» — đã sửa ở PR #14, merge vào `libetech-ai-os` ngày 16/11/2026 (`679ff6c`), xem `docs/DELIVERY-014-decision-cards-cut-20261116.md`); thiết kế login cho role AI trước khi bật Z4.

**Trạng thái Task 7c + bước 16b ngày 16/11/2026:** **đã có mã** — Codex vòng 2: PASS, không có finding.

- Nhánh `task-7c-coordinator-proposal`, mã ở `4f7e000`, PR [#16](https://github.com/liberico-ai/ai-together/pull/16), merge vào `libetech-ai-os` ngày 16/11/2026 (`1237ae4`) sau khi Chairman duyệt: «Merge PR #16». Chưa triển khai, chưa dùng thật, chưa nghiệm thu; chỉ chạy trên dữ liệu tổng hợp. Biên nhận: [DELIVERY-013](DELIVERY-013-coordinator-proposal-20261116.md). Review: [REVIEW-task-7c](reviews/REVIEW-task-7c-20261116.md).
- Điều phối dự án trình phiếu chỉ thêm `doc_approve:*` của dự án mình cho một thành viên; người trình rút phiếu của mình; quản trị tài khoản huỷ phiếu của điều phối; `/team` nêu rõ người trình còn điều phối hay không trước khi áp; khối trình phiếu ở màn Review.
- Test, typecheck và build xanh ở `4f7e000`: native 1166/0 bỏ qua, PGlite 1104/62 bỏ qua; pytest 67 ở Task 5 (PR không đụng tệp Python). Hai vòng Codex, một vòng sửa.
- **Không migration:** brief lát 4 vẫn bắt đầu từ **022**. *(Câu này đúng lúc Task 7c được merge. Cập nhật 18/11/2026: PR mã của OQ-45 và OQ-46 dùng số 022 — `migrations/022_ai_drafts_pointer_only_guard.sql` — nên khi PR đó được merge, **lát 4 bắt đầu từ 023**; xem khối trạng thái của PR đó bên dưới.)*
- Chairman đã quyết OQ-48…52 ngày 16/11/2026 (cùng quyết định thứ hai về cách tính giờ của OQ-48: «Từ lúc phiếu đóng (Recommended)»); mã theo đúng các quyết định đó.
- Chờ Chairman: nhãn quyền `doc_approve:*` trong plugin trước khi dùng thật; kiểm tay giao diện ở 360 px và 1280 px với người thật. S13 của lát 2 áp cho phiếu do điều phối trình: Chairman đã xác nhận ngày 18/11/2026 (`docs/OPEN-QUESTIONS.md`, khối «Xác nhận của Chairman ngày 18/11/2026 về S13 của lát 2» ở cuối tệp).
- Việc để lại: biểu mẫu đăng ký trên `/team` (Enter bấm nút đầu tiên — có từ trước, nên sửa trước go-live); ca `rolbypassrls=false` cho `libetech_identity`; khoá chết khi quản trị vừa huỷ vừa bỏ phiếu ghế `chairman` trên cùng phiếu (cùng lớp với đường áp có sẵn); đồng hồ `now()` có từ merge base ở đường áp và hàm đếm phiếu; mặc định `expires_at` của migration 009 cho cả hai đường trình.

**Trạng thái PR mã OQ-45 và OQ-46 (nháp AI: ai đọc nội dung, che lúc đọc, từ chối nháp IBS HI lúc ghi, giữ nháp đã cũ) ngày 18/11/2026:** **đạt mức «đã có mã»** (test, typecheck, build xanh ở đầu nhánh trên PGlite và PostgreSQL 16; cổng Codex vòng 3 `VERDICT: PASS`; `liberico-reality-checker` `VERDICT: READY`). Chưa merge, chưa triển khai, chưa dùng thật, chưa nghiệm thu.

- Nhánh `feat/oq-45-46-ai-drafts`, gốc `4f12a3c`. Đầu nhánh lúc chạy lượt cuối của cổng: `b29b929` (mã `src/` đổi lần cuối ở `d9b0974`, `migrations/` ở `05a6da0`, `tests/` ở `9b0f83f`; commit sau đó chỉ thêm hồ sơ). PR: chưa mở lúc commit này; đường dẫn được ghi ở commit hồ sơ ngay sau khi mở. Chưa merge. Biên nhận: [DELIVERY-015](DELIVERY-015-ai-drafts-read-and-stale-20261118.md). Kế hoạch: [plans/oq-45-46-ai-drafts](plans/oq-45-46-ai-drafts.md), bản 0.9. Review và bằng chứng: `docs/reviews/oq-45-46-evidence-20261118/`.
- Là gì: mã cho bốn quyết định của Chairman ngày 18/11/2026 về OQ-45 và OQ-46 — chỉ người có quyền quyết định một nháp đọc được nội dung của nó; nội dung được xét lại và che lúc đọc; nháp của dự án `IBS_HI` bị từ chối lúc ghi (migration 022: bốn trigger, không cấp quyền nào cho `libetech_ai`); nháp có đối tượng đã đổi bị giữ lúc xác nhận.
- Bốn mức, ghi riêng: **đã có mã** — theo dòng trạng thái ở trên, chỉ khi các cổng nói vậy; **chưa triển khai** (022 chưa áp ở đâu ngoài CSDL thử của PR); **chưa dùng thật** (Z4 chưa bật, không tuyến nào đọc nháp, không login cho `libetech_ai`, không mô hình nào được gọi; chỉ chạy trên dữ liệu tổng hợp); **chưa nghiệm thu**.
- Cổng Codex: vòng 1 `CHANGES_REQUIRED` (2 P0, 2 P1), rồi vòng sửa 1. Vòng 2 `CHANGES_REQUIRED` (một P0: một nháp bị che vẫn trả hash của nội dung), rồi vòng sửa 2 — vòng sửa cuối được phép, vì brief cho tối đa hai vòng sửa ở cổng. Vòng 3, lượt chạy cuối của cổng: `VERDICT: PASS`, không finding (`docs/reviews/oq-45-46-evidence-20261118/codex-round-3.md`).
- **Hai điều phải biết.** Sau PR này **không nháp ứng viên nào xác nhận được**: mọi lệnh xác nhận nháp ứng viên bị giữ cho tới khi điểm 3 của OQ-53 được quyết — một giữ chỗ, theo quyết định phạm vi của Chairman cho PR này; từ chối vẫn làm được. Và mọi nháp của một dự án bị che và bị giữ chừng nào dự án còn chữ của tin đã lưu mà nay không được hiện — một giữ chỗ của OQ-55.
- **Migration:** PR dùng số **022**. Khi PR được merge, **lát 4 bắt đầu từ 023**.
- Câu hỏi mở do PR ghi, chưa quyết: OQ-53 (ba điểm), OQ-54, OQ-55, OQ-56 (`docs/OPEN-QUESTIONS.md`, cuối tệp). Năm mã lý do của PR là giữ chỗ fail-closed chờ các câu hỏi đó, không phải phương án được chọn.
- Chờ Chairman: quyết OQ-53, OQ-54, OQ-55, OQ-56; xác nhận các cách hiểu C1–C9 nêu ở biên nhận; merge PR; mọi việc triển khai; và việc bật Z4 — còn cần thiết kế login cho role AI, bảng phân loại dữ liệu → mô hình (OQ-14) và lời Chairman cho chính việc bật.
- Việc để lại: bốn điều kiện ở ghi chú 3 của khối quyết định (`docs/OPEN-QUESTIONS.md:865`) và hai mươi lăm điều kiện «trước khi thêm tuyến đọc nháp hoặc bật Z4» của kế hoạch, biên nhận dẫn lại ở mục cùng tên; gộp hai bản của cổng xét nháp thành một hàm; ca F-5 của `tests/review-delegations.test.ts` thỉnh thoảng đỏ trên PGlite (có từ trước; nên sửa ở một PR riêng).

Ca Xeca: **XECA006/STT41** nâng package theo npm audit, hạn 21/11, Quân phụ trách và Thắng phối hợp theo Sheet đọc 11/11. Giữ riêng XECA005/TK-XECA-202611-001; repo/audit report/bản thực thử cần bổ sung. Ca LBRC014 dùng hồ sơ cập nhật §12 ngày 09/11, gồm báo cáo iOS và tám ảnh của Phương; còn mối nối build và nghiệm thu nghiệp vụ. Không yêu cầu lại phần đã có, không mở lại hoặc đổi trạng thái nguồn.

Trước pilot nhóm mở rộng, xác minh chat/topic→project, privacy mode và tin thực nhận; xác minh quyền nguồn Drive/Git, nơi giữ snapshot đã duyệt, reviewer được giao quyền. DOC-01…18 trong SPEC-009 là bộ ca thiết kế chưa chạy. XI-02…06 của SPEC-008 chỉ dùng khi có đợt đối soát Jira riêng, không bắt buộc cho Phase 1 này. Lịch giao được BoM chốt sau xác nhận khả dụng; không tự biến thứ tự thành ngày cam kết.

Mỗi lát phải ghi riêng: đã có mã, đã triển khai, đã dùng thật và được nghiệm thu. Các mục foundation phía dưới là lịch sử và căn cứ kế thừa; P1.0–P1.3/P2 ở trên là thứ tự hiện hành cho phạm vi mới.

Mission: AI OS cho hoạt động, vận hành và quản trị LibeTech; kết nối Dev Factory trong tương lai để phát triển, triển khai, bảo trì, vận hành hệ thống. PM là một phần của mission. Cổng Team Tech, báo lỗi, sổ bằng chứng và hai dashboard đã có các lát triển khai; trạng thái chạy và điều kiện dùng thật phải kiểm riêng. Xem [SPEC-003](SPEC-003-team-access-evidence-dashboards.md) và [biên bản 0.5.0](DELIVERY-005-team-open-20261110.md).

Phase 1A khởi đầu bằng [SPEC-005 — bảng ngoại lệ nguồn chỉ đọc](SPEC-005-source-exception-slice.md): kiểm snapshot Sheets có nguồn, giữ giá trị gốc, báo thiếu hạn/người, ngày mơ hồ và dòng đổi/xóa. Đây là công cụ đối soát trước bước ghép mã việc, danh mục mọi dự án và cấp quyền; chưa nhập nguồn vào Z1 hoặc tự tính KPI.

Gói 0.5.0 theo [SPEC-006](SPEC-006-team-registration-feedback.md) mở yêu cầu đăng ký cho toàn Team Tech và phản hồi lỗi/góp ý theo dự án. Quản trị xác minh danh tính và cấp lời mời, người dùng tự đặt mật khẩu/ghép Telegram; phản hồi có người gửi, người xử lý và lịch sử trạng thái. Gói này đã chạy 0.5.0 và migrations 007–008 trên PostgreSQL server, mở đăng ký và báo lỗi nội bộ. Đang ở giai đoạn dùng thử có kiểm soát: từng người cần được duyệt, đặt mật khẩu và ghép Telegram; quyền BU cấp theo dự án sau đối soát roster. Xem [biên bản triển khai](DELIVERY-005-team-open-20261110.md).

Chính sách tài khoản theo [SPEC-007](SPEC-007-telegram-account-approval.md): cấp lần đầu cần Chairman và ít nhất một trong ba BoM; các lần đăng nhập sau không duyệt lại. [Biên nhận 0.7.1](DELIVERY-008-pilot-onboarding-20261111.md) ghi ngoại lệ một lần cho các đăng ký pilot ngày 11/11 và giữ chính sách cho người đến sau. Luồng tài khoản này tách khỏi quorum 3/3 tái phân công công việc; Telegram Yes/No cần kiểm biên nhận triển khai riêng.

## Trạng thái kế hoạch tại 10/11/2026

| Hạng mục | Trạng thái có bằng chứng | Việc tiếp theo |
|---|---|---|
| Cổng Team Tech và phản hồi | Web 0.5.0, PostgreSQL migrations 001–008; đăng ký, quản trị quyền và báo lỗi nội bộ đã mở. | Một thành viên mới đi hết đăng ký → duyệt → kích hoạt → ghép Telegram → gửi lỗi; kiểm phạm vi của chính người đó. |
| Dự án và bảng việc | Nền mới có `LBRC · App Saleman` và `LibeTech AI OS · Nội bộ`. Đợt 0.5.0 không nhập hoặc sửa bảng việc team; lần đọc DB ngày 09/11 có 0 work items, không dùng số đó làm số liệu hiện tại. | Đối soát roster và danh mục dự án từ nguồn team, lập mapping nguồn/owner/ID, kiểm ngoại lệ; chỉ chuyển nguồn sự thật sau quyết định riêng. |
| Bot AiTogether ↔ AI OS | Cầu nối riêng đã trả hồ sơ LBRC014 đúng SHA trong LibeAI và chặn Libe – Xeca ngày 09/11. Nó chỉ ghép Telegram và đọc bản đối soát đã lưu; cổng health hiện ghi `configured-not-runtime-verified`. | Thử lại với một thành viên mới; mở đặc tả tra việc và gửi báo lỗi qua bot, có định danh, quyền dự án, idempotency và biên nhận. Không cho bot ghi trực tiếp bảng nguồn. |
| Bằng chứng, điểm và dashboard | Có code, ca kiểm và màn hình theo SPEC-003; dữ liệu vận hành thật chưa được nhập đủ để dùng làm KPI/lương. | Đối soát từng nguồn, công thức và người duyệt; nghiệm thu dashboard trên dữ liệu người dùng thật trước khi sử dụng để đánh giá. |
| Dev Factory và vận hành dịch vụ | Chưa có kết nối Factory trong health; gói này vẫn ở lộ trình. | Chốt hợp đồng sự kiện, nguồn bằng chứng, quyền triển khai và quan sát đúng bản sau khi Phase 1 ổn định. |

Lưu ý giao diện: nhãn tĩnh `Bot LibeTech · Chưa nối nền tảng mới` và footer `0.3.0` trong `src/components/workspace.tsx` chưa mô tả đúng cầu nối chỉ đọc và bản web 0.5.0. Sửa nhãn ở bản UI kế tiếp, đồng thời thể hiện rõ trạng thái `đã cấu hình`, `đã kiểm thực tế`, và `chưa nối luồng ghi`.

| Lát | Phần làm | Điều kiện hoàn tất |
|---|---|---|
| 0 — Foundation local | Web, backend, dữ liệu bền, phân quyền, work/evidence/acceptance, Z2, audit | Code + build + kiểm âm quyền/quy trình + trình duyệt; dữ liệu tổng hợp |
| 1 — Nền dùng thật | SPEC-003 mục 1–2. Cổng Team Tech bằng username/password, lời mời và kích hoạt, quyền theo dự án, ghép Telegram và thu hồi phiên. PostgreSQL server, migration, backup/restore, staging. | Nghiệm thu A01–A03 trên cổng riêng và PostgreSQL. Diễn tập khôi phục. `SPEC-003-team-access-evidence-dashboards.md:110`, `SPEC-002-identity-postgres.md:24`. |
| 2A — Tích hợp nguồn và bot | SPEC-003 mục 3A. Nối mã việc, bảng việc, ticket, phản hồi bot, GitHub đúng SHA và tài liệu nguồn. Đối soát LBRC014. Tiếp tục Vault pointers, báo cáo và delivery outbox theo phạm vi đã duyệt. | Phân quyền theo BU và dự án, xử lý lặp theo khóa sự kiện, biên nhận gửi đúng nhóm. Bản đối soát giữ trạng thái nguồn và phân biệt bàn giao, nghiệm thu kỹ thuật, nghiệm thu nghiệp vụ. |
| 2B — Đo theo bằng chứng | SPEC-003 mục 3B–3C. Điểm thành phần có công thức theo kỳ, dashboard dự án và dashboard nhân sự, quy trình rà soát kết quả. | Hai dashboard truy cùng bằng chứng và giải thích được cách tính. Chạy bộ ca giả lập, đối soát LBRC014 và kiểm quyền chi tiết trước khi dùng dữ liệu cá nhân. Công thức chính thức, người xem và mục đích sử dụng được phê duyệt riêng. |
| 3 — Vận hành dịch vụ | Incident, change request, release, deployment observation, maintenance, backup registry, runbook | Desired/observed SHA; quyền phê duyệt; test rollback/khôi phục; thông báo đúng nhóm |
| 4 — Dev Factory | Hợp đồng giao việc, package/bằng chứng, callbacks signed, idempotent reconciliation | Một gói việc thật đi từ yêu cầu đã duyệt → build → nghiệm thu → triển khai được duyệt → quan sát đúng bản |
| 5 — AI hỗ trợ | Đề xuất PM, rủi ro, phân tích phụ thuộc, năng lực đội | AI ghi Z4; nguồn/căn cứ/freshness; người có quyền phê duyệt; không tự đổi nghiệp vụ/KPI/lương |

Foundation tập trung vào nghiệp vụ LibeTech. Khi nối thông báo thật, dùng lịch và nhóm trong phạm vi đã xác nhận, rồi kiểm cấu hình và biên nhận giao. Nguồn đối chiếu lịch tuần tại `../../libe-tech/hermes-libetech-priority1/WEEKLY-AUTO-VERIFICATION-20261106.md:3`. Orchestration Hệ A nằm ngoài phạm vi foundation.

## Kế thừa từ AiTogether

- Kế thừa mô hình dự án, công việc, tài liệu, activity log, kỳ báo cáo và các nhóm điểm của AiTogether. [Bảng đối chiếu mã cũ](SPEC-003-team-access-evidence-dashboards.md#đối-chiếu-aitogether-cũ).
- Bộ tính mới dựa trên sự kiện theo kỳ, người được xác minh và bằng chứng gắn với việc. Dashboard dự án tổng hợp tiến độ và đóng góp trong phạm vi dự án. Dashboard nhân sự chỉ hiển thị kết quả được cấp quyền, công thức và nguồn.
- Thiết kế lại danh tính, membership và quy trình trạng thái theo quyền dự án của AI OS. Đối chiếu ranh giới tích hợp tại `ADR-001-foundation.md:6`.
- Chưa có đủ bằng chứng instance lab đã dừng hoặc dữ liệu mất. Không nhập DB cũ, không tuyên bố bản mới thay thế instance cũ đang dùng.
- Giữ repo/team/bot hiện có độc lập. Khi chuyển nguồn sự thật phải có mapping, reconciliation, chủ dữ liệu và rollback.

## Thứ tự giao gói SPEC-003

1. Dựng đường vào và thử cơ chế phiên trên môi trường cô lập. Chốt lối vào, TLS và ranh giới với Hermes trước khi mở cho Team Tech.
2. Hoàn thành vòng đời tài khoản, quyền theo dự án và ghép Telegram/GitHub. Duyệt danh sách và quyền trước khi mời thành viên thật.
3. Song song với 1–2, chuẩn bị đối soát LBRC014 bằng hồ sơ đã lưu và bộ ca tổng hợp. Sau khi kiểm quyền, mở dashboard dự án rồi dashboard nhân sự. Theo dõi độ phủ nguồn trước khi trình chốt công thức. Bảng việc của team tiếp tục là nguồn vận hành trong gói này.

## Cổng đưa vào dùng thật

1. Chốt tên repo/owner và ADR production; review tree/history trước push theo yêu cầu D1 đang có.
2. Đăng nhập username/password và membership thật, quyền theo dự án, vòng đời lời mời và phiên. Tách demo, giới hạn lần thử đăng nhập, cấu hình TLS và CSP nonce.
3. Trên PostgreSQL, kiểm các vai migration/runtime/projector, RLS theo giao dịch, truy vấn có tham số, index và phân trang. Điều kiện gốc tại `SPEC-002-identity-postgres.md:23`.
4. Secret quản lý bên vận hành; không đưa GitHub App key/Telegram token vào repo, chat, fixture hoặc log.
5. Backup/restore diễn tập, audit retention/export, quan sát lỗi/correlation, migration/rollback runbook.
6. Chạy kiểm phạm vi tenant, dự án, thao tác, export và thông báo. Tách kết quả PGlite, PostgreSQL và Telegram theo từng môi trường. `SPEC-002-identity-postgres.md:24`.
7. Đối soát LBRC014 với đúng SHA và nguồn. Kiểm thử quyền bằng danh tính thật sau khi cấp quyền được duyệt. Người được giao xác nhận kết quả UAT của tính năng mới.
8. Chạy thử hai dashboard trên dữ liệu tổng hợp và bản đối soát có nguồn. Tách ký duyệt tính năng, ký duyệt công thức điểm và chấp thuận mục đích KPI/lương.

## Các hạng mục mở rộng sau foundation

- Sổ tài sản, trực vận hành, lịch sử SLA dịch vụ, xử lý sự cố và CMDB.
- Năng lực đội, nguồn lực, chi phí, hợp đồng, phụ thuộc và ủy quyền phê duyệt.
- Mở rộng bộ gửi thông báo, thử lại và hàng lỗi, thêm nguồn, công cụ triển khai và kho bí mật.
- SSO/MFA nếu tổ chức chọn, kiểm thử xâm nhập độc lập và kiểm thử tải.

Các hạng mục này được giao theo lát và có điều kiện nghiệm thu riêng.
