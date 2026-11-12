---
title: SPEC-008 — PM và điều hành công ty Tech qua Bot và AI OS
version: 0.4
status: proposed-for-implementation; no production change
as_of: 2026-11-11 Asia/Ho_Chi_Minh
owner_domain: LibeTech BU7
---

# SPEC-008 — PM và điều hành công ty Tech qua Bot và AI OS

**Mở rộng 11/11/2026:** chức năng PM và điều hành toàn công ty Tech ở §9–§14; bốn luồng sự cố, nâng cấp, tính năng và sản phẩm mới; cùng dịch vụ, nguồn lực và hiệu quả đội. Căn cứ [scan nguồn ba nhóm khách hàng](SCAN-LIBETECH-PM-COO-20261111.md). Phần mở rộng ưu tiên khi khác chuỗi task chung của v0.1.

**Điều chỉnh v0.3 theo Chairman 11/11:** từ tháng 11, bỏ Jira khỏi luồng tiếp nhận mới của Xeca; nhận qua bot tại nhóm **LBRC Xeca**. §15 định nghĩa chuyển nguồn và ca nghiệm thu từ hai tệp được cung cấp. Jira còn vai trò lịch sử/đối soát một lần. Quyết định nghiệp vụ này chưa chứng minh gateway đã chuyển tuyến.

**Điều chỉnh v0.4 theo Chairman 11/11:** ưu tiên PM/BA và quản lý tài liệu, tiếp nhận nhiều nhóm được cấp quyền; giai đoạn 2 mới nối Dev Factory. [SPEC-009](SPEC-009-PM-BA-DOCUMENTS-20261111.md) là đặc tả mở rộng hiện hành cho thứ tự này. Jira cũ chỉ là nguồn tham khảo; đối soát đầy đủ Jira không là điều kiện mở intake hoặc hoàn tất Phase 1. Các bước lưu trữ/chuyển nguồn ở §15.3 và ca XI-02…06 giữ để dùng nếu có quyết định đối soát lịch sử riêng. Không sửa dữ liệu team hoặc coi thiết kế là năng lực đang chạy.

## 0. Mục tiêu, phạm vi và điều đã kiểm

Team Tech cần cập nhật kế hoạch lớn, mốc dự án, đầu việc, hành động, yêu cầu khách hàng, người chịu trách nhiệm, tiến độ và bằng chứng trong một vòng điều hành có thể truy lại. Bot nhận và nhắc trong đúng nhóm; AI OS giữ hồ sơ, quyền, quyết định và dashboard. Dev Factory là nguồn bằng chứng kỹ thuật ở phase 2, không là chủ quyết định nghiệp vụ. SPEC này là **thiết kế**, chưa xác nhận các luồng mới đã chạy.

| Căn cứ kiểm ngày 11/11 | Ý nghĩa và giới hạn |
|---|---|
| [Bảng Đầu việc Tech](https://docs.google.com/spreadsheets/d/1Vr1ykZUtwm5Wvj1oAQRjpzMgleDa6Fhu-WiPv-L61Vc/edit#gid=1963754558), modified 04:23:09 UTC; đọc trực tiếp các hàng XECA | Bảng Phương gửi là **hiện trạng nguồn**, không phải toàn bộ kế hoạch/mốc hoặc sổ nghiệm thu. Ảnh nhập [DELIVERY-007](DELIVERY-007-team-catalog-20261111.md) có 45 hàng: LBRC 18, XECA 7, IBS HI 20; 17 tên platform không phải 17 dự án. Đến biên nhận triển khai, chưa có Z1 work item. |
| [Bot priority1](../../libe-tech/hermes-libetech-priority1/plugin/__init__.py), [sổ ticket](../../libe-tech/hermes-libetech-priority1/plugin/intake.py) | Bot có đọc bảng, mở/cập nhật/list ticket, GitHub read, history và đường ghi Sheet nội bộ khi được yêu cầu rõ. Mở ticket không giao việc hay duyệt cam kết; SQLite ticket chưa liên kết work item. Trạng thái ĐÓNG của ticket không chứng minh nghiệm thu. |
| [Bridge](../src/server/bridge.ts), [BoM](../src/server/bom.ts), [work service](../src/server/service.ts) | Bridge hiện cho ghép Telegram, đọc đối soát theo quyền và duyệt tài khoản; chưa nhận lệnh tạo việc PM. Work service có bằng chứng, hai lớp nghiệm thu và tách đóng ticket. BoM đã có phiếu 3/3 cho việc Z1, nhưng chưa có việc thật để chạy ca PM mới. |
| [DELIVERY-008](DELIVERY-008-pilot-onboarding-20261111.md) | Web 0.7.1 và danh tính thí điểm được triển khai; tài khoản mới được tạo không chứng minh mọi người đã kích hoạt/ghép Telegram. |
| [PM research](../../libe-tech/hermes-libetech-priority1/PM-CAPABILITY-RESEARCH-20261106.md), [SPEC-003](SPEC-003-team-access-evidence-dashboards.md), [SPEC-004](SPEC-004-bom-tech-phan-cong.md), [SPEC-005](SPEC-005-source-exception-slice.md) | Kế thừa đối soát nguồn, điểm theo bằng chứng, dashboard, BoM 3/3 và quyền nghiệm thu. Những kết luận từ ảnh 06–10/11 phải đọc lại bảng trước khi dùng. |
| Xeca Brain, mục canonical_pm_workspace trong CLAUDE.md; nghiên cứu URD Xeca ở PM research §3C | Xeca Brain là nguồn chiến lược/định hướng; workspace PM do Toàn quản là nguồn phạm vi và vận hành Xeca. Tài liệu URD là ứng viên yêu cầu, chưa tự trở thành phạm vi hoặc cam kết của LibeTech. Chỉ lưu con trỏ, phiên bản, hash và phần trích được phép theo dự án. |

**Ranh giới chứng cứ.** Tin nhắn khách, ticket, một hàng Sheet, commit, checks, release, UAT, biên nhận triển khai và xác nhận người dùng là các sự kiện khác nhau. Bất kỳ dashboard hoặc bot trả lời nào phải nêu rõ nguồn, thời điểm quan sát, người xác nhận, trạng thái quyền và phần chưa biết. Không dùng cột Hoàn thành để tự tính nghiệm thu/KPI/lương.

## 1. Kiến trúc và nguồn sự thật đề xuất

~~~mermaid
flowchart LR
  C[Nhóm khách theo BU<br/>LBRC Xeca — tên cần khớp chat ID] --> B[Bot AiTogether<br/>nhận tin, biên nhận, hỏi thiếu]
  B --> T[Sổ ticket hiện có<br/>nguồn tiếp nhận]
  T --> A[Adapter có chữ ký<br/>quyền + chống lặp]
  A --> Q[AI OS: hàng chờ PM<br/>ứng viên, đối soát]
  S[Bảng Đầu việc Tech<br/>hiện trạng của Phương] --> R[Snapshot chỉ đọc + ngoại lệ]
  V[Vault dự án đúng quyền<br/>phạm vi + tài liệu] --> R
  R --> Q
  Q --> H[Người có quyền xác nhận<br/>chủ dự án / BoM / BU]
  H --> Z[AI OS Z1<br/>Project → Plan → Milestone → Task → Action]
  Z --> E[Bằng chứng + nghiệm thu<br/>2 lớp và khách]
  E --> D[Z2 dashboard dự án / nhân sự]
  Z --> N[Outbox thông báo<br/>đúng người, đúng nhóm]
  N --> B
  F[GitHub / Dev Factory phase 2] -. bằng chứng đúng SHA .-> E
  I[AI cảnh báo và gợi ý Z4] -. cần người quyết .-> H
~~~

**Sở hữu dữ liệu.** Trong giai đoạn chưa chuyển nguồn, Google Sheet tiếp tục là nguồn của các ô hiện trạng do team cập nhật; sổ ticket của bot là nguồn gốc tiếp nhận; Vault dự án là nguồn tài liệu theo chủ sở hữu; GitHub/Factory là nguồn kỹ thuật; AI OS là chủ mới của hồ sơ kế hoạch, quyết định, ánh xạ và bằng chứng đã xác minh. AI OS không truy vấn DB của nền khác. Adapter dùng REST có chữ ký hoặc queue theo ADR; không lấy dữ liệu bằng câu lệnh vào DB bên ngoài. Thiết kế thêm Project/Plan/Milestone canonical và thay đổi quyền sở hữu work cần **ADR về entity và cutover** trước migration, theo AR-09 và bộ Liberico coding rules.

## 2. Mô hình việc và định danh

| Cấp | Ý nghĩa / tối thiểu phải có | Ai xác nhận / quy tắc |
|---|---|---|
| Project | Mục tiêu, BU/tenant, owner BU, PM, thành viên, phạm vi dữ liệu, Vault pointer, repo và kênh Telegram được cấp | Chủ dự án/BU xác nhận danh mục, không suy 17 tên platform thành project. Một project có thể liên quan nhiều platform. |
| Plan / phase | Kết quả kỳ, ranh giới phạm vi, baseline, ngày hiệu lực, phiên bản, người duyệt và lý do đổi | PM soạn; chủ dự án/BU xác nhận phần cam kết. Baseline mới không sửa ngược baseline cũ. |
| Milestone | Kết quả cần bàn giao, ngày mục tiêu, điều kiện đạt, phụ thuộc, người nghiệm thu, trạng thái | Chủ dự án/BU chốt cam kết; thay ngày lưu trước/sau, nguồn và tác động. |
| Task | Một đầu ra có chủ trì, tiêu chí, hạn nếu đã chốt, trạng thái, quan hệ plan/milestone, ticket/source links | Chủ trì nhận việc; mọi đổi/chia lại người qua BoM 3/3 theo SPEC-004. Task chưa đủ đầu vào có trạng thái Chờ làm rõ. |
| Action | Bước nhỏ, người làm, hạn hành động, phụ thuộc, kết quả; có thể phát sinh từ họp hoặc task | Người được giao cập nhật; action không tự trở thành cam kết khách hay hoàn thành task mẹ. |
| Intake / ticket | Điều khách báo, nhóm/tin gốc, người gửi, BU, mức ưu tiên dự kiến, câu hỏi còn thiếu, biên nhận, lịch sử | Bot có thể mở ticket đúng scope; PM/triage xác nhận loại, độ ưu tiên, trùng, liên kết project. Ticket ID và Task ID sống riêng. |
| Evidence / acceptance | URL/con trỏ, loại, full SHA hoặc phiên bản tài liệu, môi trường, ca thử, người tạo, người kiểm, thời điểm; hai lớp kỹ thuật/nghiệp vụ và xác nhận khách khi có | Người làm không tự nghiệm thu. Người nghiệm thu được giao theo project/work; ticket ĐÓNG là một sự kiện khác. |

Mọi bản ghi Z1 có UUID bền, tenant_id, project_id, version, created_at/updated_at dạng timestamptz và event bất biến. Mã dễ đọc như XECA005 là alias **chỉ sau khi đối soát**. STT, số hàng Sheet, mã CK, ticket TK và ID Telegram là source locator, không làm primary key. Một ticket có thể liên quan nhiều task; một task có thể gom nhiều ticket sau khi PM xác nhận, có bảng liên kết kèm loại quan hệ và biên nhận. Lưu source_id, source_type, ingested_at, quality_score cùng source_url, source_modified_at, snapshot_hash, source_row và người xác nhận ánh xạ. Giữ raw source ở nguồn, AI OS chỉ lưu metadata/trích dẫn đúng quyền.

Trạng thái task đề xuất: Draft → Chờ đầu vào → Đã chốt phạm vi → Đang làm → Chờ kiểm kỹ thuật → Chờ nghiệm thu nghiệp vụ → Hoàn tất; nhánh Tạm dừng/Hủy/Trùng có lý do và người quyết. Trạng thái ticket tiếp tục là vòng giao tiếp với người báo. **Không ánh xạ tự động** MỚI→task Draft, CHỜ NGHIỆM THU→task đã kiểm, hoặc ĐÓNG→task Hoàn tất; chỉ tạo liên kết/sự kiện qua giao dịch có quyền.

## 3. Luồng yêu cầu từ nhóm LBRC Xeca

1. Bot nhận tin trong nhóm được cấu hình Xeca, lấy sender/chat/thread/message từ gateway, không tin tên hoặc BU do nội dung tin tự khai. Bot phân loại sơ bộ sự cố, yêu cầu tính năng, hỏi đáp hoặc thông tin chưa đủ; phát biên nhận ngắn vào đúng thread. Nếu không phải yêu cầu hành động, chỉ trả lời, không tạo ticket. Tin lặp cùng nguồn không tạo ticket thứ hai.
2. Với yêu cầu hành động, bot mở ticket trong ledger theo BU của lane, giữ nguyên lời khách, thời điểm, link tin và mức ưu tiên **đề xuất**. Biên nhận nêu mã ticket, người/nhóm tiếp nhận, bước tiếp theo và mốc phản hồi theo chính sách ticket; **không hứa hạn hoàn thành sản phẩm**. Không tự ghi Sheet từ lane khách.
3. Adapter gửi event ticket mới sang hàng chờ AI OS bằng chữ ký, nonce và idempotency key; quyền của bridge chỉ được tạo **ứng viên intake** hẹp, không được tạo/gán/chốt task. Nếu AI OS chưa sẵn sàng, ticket vẫn tồn tại, outbox thử lại, bot báo đã tiếp nhận trong sổ và đánh dấu chưa đồng bộ nền.
4. PM dự án xem ứng viên cùng các ticket/Sheet/Vault pointers đã được cấp. Hệ thống gợi ý trùng hoặc liên kết công việc; PM xác nhận project, loại, phạm vi và phần thiếu. Nếu là yêu cầu sản phẩm, chủ dự án/BU xác nhận phạm vi, tiêu chí và cam kết trước khi tạo plan/milestone/task có hiệu lực. Nếu chỉ là bug nhỏ đã có work, PM gắn vào task hiện hữu; không nhân đôi.
5. Sau chốt phạm vi, BoM xác nhận 3/3 khi giao/chia lại chủ trì theo SPEC-004. Người nhận việc xác nhận đã nhận. Việc chuyển giữa ba thành viên BoM cũng qua 3/3. Nếu ba ghế chưa đủ điều kiện hoặc nguồn đổi, phiếu đứng ở Chờ đối soát; không có đường ghi tắt qua bot/API/import.
6. Thành viên cập nhật tiến độ và bằng chứng qua web có phiên hoặc tin nhắn bot gắn đúng mã, đúng project, đúng danh tính đã ghép. Bot có thể ghi **nháp cập nhật** và hỏi lại người gửi; việc thay baseline, người, hạn cam kết hoặc trạng thái nghiệm thu cần thao tác xác nhận đúng quyền trong AI OS. Mọi cập nhật giữ sự kiện gốc và source fingerprint.
7. Khi bàn giao, hệ thống yêu cầu tiêu chí, phiên bản, môi trường, ca thử và bằng chứng. Người nghiệm thu kỹ thuật độc lập xác nhận đúng revision/SHA; người nghiệp vụ hoặc đại diện chủ dự án xác nhận kết quả sử dụng. Nếu cam kết với khách, đầu mối Xeca có quyền xác nhận riêng hoặc phản hồi còn lỗi. Ghi từng cửa riêng.
8. PM trả lời người báo trong thread gốc theo nội dung được phép, ghi delivery receipt và phản hồi của khách. Chỉ đóng ticket theo quyền/chính sách ticket; đóng ticket không tự đóng task hoặc milestone. Nếu khách mở lại, liên kết ticket mới/sự kiện mở lại với hồ sơ cũ, không xóa nghiệm thu lịch sử.

| Sự kiện | Bot làm | Người xác nhận | AI OS ghi | Thông báo |
|---|---|---|---|---|
| Tin Xeca có yêu cầu hành động | Nhận, khử lặp, mở ticket, biên nhận | Chưa có cam kết | Candidate intake + nguồn tin khi bridge hoạt động | Cùng thread khách; PM Xeca nội bộ |
| Thiếu phạm vi/tiêu chí | Hỏi đúng câu thiếu, nêu chờ ai | PM/owner dự án xác nhận câu trả lời | Các bản trả lời và trạng thái Chờ đầu vào | Người báo và người chờ quyết |
| Gắn vào kế hoạch/mốc | Gợi ý mapping có nguồn | Chủ dự án/BU duyệt phần cam kết; PM chốt thao tác | Plan/milestone/task + phiên bản baseline + source links | Người nhận, bên phụ thuộc, đầu mối khách theo phạm vi |
| Phân/chia lại việc | Chỉ dẫn vào phiếu, nhắc người còn thiếu | Chu Hoàng Anh + Quân + Phương, 3/3 | Phiếu, 3 vote, receipt áp dụng hoặc ngoại lệ | Ba ghế và người nhận sau khi áp dụng |
| Tiến độ/bằng chứng | Nhận nháp hoặc link, nhắc thiếu | Người làm xác nhận nội dung; reviewer kiểm bằng chứng | Event tiến độ, evidence versioned | PM, reviewer; khách chỉ nhận phần đã công bố |
| Chấp nhận kỹ thuật | Tóm tắt checks/release đúng SHA | Người nghiệm thu kỹ thuật độc lập | Technical acceptance + revision | PM, người làm |
| Nghiệm thu nghiệp vụ/khách | Tổng hợp ca UAT còn thiếu | Người nghiệm thu nghiệp vụ/đầu mối khách đúng ủy quyền | Business/customer acceptance riêng | Người báo, PM, milestone owner |
| Đóng ticket / báo cáo tuần | Soạn trả lời và ngoại lệ theo scope | Người có quyền đóng ticket; PM duyệt báo cáo có cam kết | Ticket close link + delivery receipts; Z2 projection | Đúng thread/nhóm; không phát lộ BU khác |

## 4. Quyền và ma trận quyết định

| Quyết định / thao tác | Quyền tối thiểu | Tự động hóa |
|---|---|---|
| Tiếp nhận, khử lặp kỹ thuật, nhắc thiếu trường, phân loại gợi ý | Bot trong chat được cấu hình; project mapping từ server | Tự động, nhưng chỉ trạng thái candidate/Z4 khi chưa người xác nhận. |
| Xác định trùng, gắn ticket vào project/task; cập nhật tiến độ thường ngày | PM được cấp project; người thực hiện chỉ việc mình | PM hoặc người làm xác nhận; có expected version/audit. |
| Cam kết phạm vi, milestone, hạn với khách hoặc đổi baseline | Chủ dự án/BU được ủy quyền; PM chuẩn bị | Chỉ có hiệu lực sau xác nhận; bot không tự hứa. |
| Giao/chia lại chủ trì, kể cả giữa BoM | Ba ghế BoM đúng project và đã xác minh | 3/3 cùng phiên bản theo SPEC-004; không suy ra quyền từ chức danh trong chat. |
| Chấp nhận kỹ thuật | Người nghiệm thu kỹ thuật được giao, độc lập người làm | Đúng evidence/revision/SHA; AI chỉ đề nghị. |
| Nghiệm thu nghiệp vụ và khách | Người nghiệp vụ/đại diện khách theo ủy quyền dự án | Xác nhận tách biệt; không suy từ UAT tự báo hay ticket ĐÓNG. |
| Duyệt tài khoản mới | Chairman + 1/3 BoM theo SPEC-007 | Khác hẳn ngưỡng 3/3 giao việc. |
| Điểm/KPI/lương | Người quản lý có quyền, công thức và kỳ được duyệt riêng | Không tự áp dụng từ ticket, Sheet hoặc chat thiếu bằng chứng. |

Phân quyền lấy giao của **danh tính Telegram đã ghép ∩ quyền project của người ∩ scope chat ∩ quyền thao tác**. Web/API, bot, dashboard, export, tệp bằng chứng và thông báo dùng cùng chính sách; không lộ ID/tiêu đề/số lượng ngoài BU. Nội dung IBS HI riêng chỉ lưu pointer/hash/metadata công việc Tech đã được cho phép; không cache tài liệu nội bộ của IBS HI vào LibeTech. Xeca Vault không được xem là tài liệu công bố cho mọi nhóm Xeca chỉ vì có link.

## 5. Bảng điều hành và cảnh báo PM

Màn hình Project hiển thị cây plan→milestone→task/action, ticket chưa ánh xạ, thay đổi kỳ này, phụ thuộc, bằng chứng, tiến độ nguồn Sheet, trạng thái AI OS và người/phiên bản nghiệm thu **ở các cột riêng**. Màn hình cá nhân hiển thị việc được giao, quyết định cần mình làm, nguồn và phần điểm nháp theo SPEC-003; mỗi số tổng hợp drill-down được tới bản ghi trong quyền. Dashboard không lấy tiến độ của một nguồn cũ để ghi đè nguồn mới; hiển thị tuổi dữ liệu và ngoại lệ.

Bot PM nhắc các ngoại lệ có bước tiếp theo, nguồn và người xử lý: ticket chưa triage; yêu cầu thiếu người quyết/phạm vi/tiêu chí; việc thiếu hạn hoặc owner; mốc có phụ thuộc chưa xong; nguồn Sheet và AI OS lệch; UAT tự báo chưa có nghiệm thu; checks/release không khớp full SHA; phiếu BoM thiếu vote; ticket đã đóng nhưng khách chưa phản hồi; việc có dấu hiệu tập trung vào một người. Cảnh báo tải chỉ là tín hiệu, cần ước lượng công sức và lịch sẵn có mới kết luận quá tải. Hạn ticket, hạn action, hạn task và hạn milestone tách đồng hồ, không tự thay thế nhau. Báo cáo tuần hiện có của bot chủ yếu dựa sổ ticket; mở rộng thành báo cáo PM sau khi Z1/source mapping và delivery receipt được kiểm, theo lịch/nhóm đã chốt riêng.

## 6. Hợp đồng tích hợp và chuyển nguồn

Adapter có chữ ký HMAC, timestamp/nonce, service principal riêng, giới hạn operation, project scope từ server, event_id/source_event_id và idempotency key. Payload tối thiểu: actor Telegram đã xác minh, chat/thread/message ID, BU và project mapping, ticket ID, source metadata, bản nội dung đã lọc, correlation ID. Không nhận actor/tenant/quyền từ body. Transaction ghi event và outbox; gửi Telegram sau commit; retry không nhân đôi. Ghi trạng thái received, persisted, projected, delivered, recipient-acknowledged riêng. Khi thất bại, hàng lỗi có chủ xử lý và đường replay an toàn.

**Bước chuyển nguồn:** (A) nhập snapshot chỉ đọc, đối soát 45 hàng và ticket với chủ dữ liệu; (B) cấp ID bền sau khi Phương/PM xác nhận mapping, chạy AI OS ở chế độ song song và so lệch mỗi ngày; (C) pilot một dự án Xeca + LBRC014 với quyền thật, phiếu 3/3 và nghiệm thu; (D) chỉ chuyển nguồn cập nhật từng project khi có biên bản chủ nguồn, mapping, thời điểm cắt, backup/restore và rollback. Trong A–C, giữ Sheet Phương không đổi. Dù bot có công cụ ghi Sheet nội bộ, luồng mới không tự gọi nó để tránh hai đường ghi. Dữ liệu lịch sử/nguồn không xóa hoặc viết lại. Nếu nguồn đổi trong lúc phiếu đang chờ, giữ phiếu ở Chờ đối soát và mở bản mới.

## 7. Ca kiểm chứng bắt buộc

| Mã | Ca thật / ca âm | Đạt khi |
|---|---|---|
| PM-01 | **Xeca thật:** bảng ngày 11/11, hàng 34/STT 33 mã XECA005 “Nâng cấp Fastify, JWT”, ghi Hoàn thành; ghi chú dẫn TK-XECA-202611-001 “chờ anh Huyến đóng”. Đọc ticket và tin gốc trong Libe – Xeca bằng quyền đã cấp trước khi chạy. | Một ticket và một việc được nối bằng biên nhận xác nhận; vẫn hiện riêng “Hoàn thành” của Sheet, trạng thái ticket thực tế và nghiệm thu chưa có nếu thiếu. Không tự tạo lại task hay tự đóng ticket. **Tin gốc, actor, thời điểm và nội dung ticket hiện chưa được xác minh trong SPEC này**; nếu không đọc được, ca UAT chưa đạt. |
| PM-02 | Xeca STT 2/hàng 3: nguồn mới ghi Hoàn thành, Quân báo đã làm xong/đang UAT rồi “xong rồi”; đối chiếu URD và chủ dự án. | Giữ lời báo, phạm vi URD được chủ dự án xác nhận riêng, hai lớp nghiệm thu không tự bật. |
| PM-03 | Khách gửi lại cùng tin hoặc forward tin ngoài nhóm; cùng ticket sync hai lần. | Một intake; forward không tạo authority; outbox replay không nhân đôi. |
| PM-04 | Người Xeca yêu cầu xem LBRC/IBS HI hoặc GitHub repo ngoài scope, thử web/API/export/notification. | Từ chối mà không lộ bản ghi, ID, số lượng hay tệp. Quân/Phương vẫn chỉ thấy project được cấp. |
| PM-05 | Đề xuất đổi người trên task pilot; 2/3 rồi 3/3, từ chối và nguồn đổi đồng thời. | 2/3 không đổi phân công; 3/3 đúng phiên bản có một receipt; từ chối/nguồn đổi buộc trình lại, mọi đường ghi tắt bị chặn. |
| PM-06 | Bằng chứng GitHub đúng full SHA nhưng thiếu UAT/đầu mối khách; sau đó đủ UAT. | Technical acceptance và business/customer acceptance tách người, phiên bản và thời điểm; người làm không tự duyệt. Đóng ticket không thay acceptance. |
| PM-07 | Bot/AI OS mất kết nối hoặc nhóm nhận sai cấu hình; mở lại ticket sau khi đóng. | Ticket vẫn có nguồn, sync đánh dấu lỗi/retry; không báo đã gửi nếu chỉ ghi DB; mở lại giữ lịch sử và biên nhận giao cũ. |
| PM-08 | Đối soát trước/sau pilot với bảng Phương và 45 hàng nhập. | Hash/modified time và dữ liệu team giữ nguyên; dashboard chỉ thay khi event hợp lệ; điểm/KPI/lương không phát sinh từ nguồn chưa nghiệm thu. |

## 8. Thứ tự triển khai và cổng nghiệm thu

| Lát | Phạm vi | Cổng đạt |
|---|---|---|
| 0 — Chốt ADR và quyền | ADR canonical Project/Plan/Milestone/Task, chủ nguồn, quyền Xeca/BoM/người nghiệm thu, mapping Sheet/ticket/Vault và chính sách dữ liệu | Có người có thẩm quyền ký phạm vi, danh mục dự án thực, ma trận quyền; không suy quyền từ nhóm chat. |
| 1 — Đối soát và intake | Adapter ticket→AI OS candidate, stable source link, ngoại lệ, dashboard intake, biên nhận khách và nội bộ | PM-01 phần đọc, PM-03/04/07; Sheet không đổi; thử bằng người thật đúng nhóm. |
| 2 — Kế hoạch và việc | Project→plan→milestone→task/action Z1; baseline, cập nhật tiến độ, BoM 3/3, quyết định cam kết | PM-02/05/08; một việc Xeca thật đi từ candidate đến người nhận, đúng project và phiên bản. |
| 3 — Bằng chứng và đóng vòng | GitHub đúng SHA, UAT, hai lớp nghiệm thu, phản hồi khách, outbox, dashboard và cảnh báo PM | PM-06; dashboard dự án/nhân sự drill-down cùng dữ liệu; biên nhận Telegram đúng nhóm; chưa dùng điểm cho lương. |
| 4 — Dev Factory phase 2 | Hợp đồng gói việc, PR/check/build/release/deploy observed/rollback và maintenance | Một việc được duyệt đi hết đường Factory; bằng chứng kỹ thuật đúng bản chạy và người nghiệm thu, không tự triển khai hay giao dịch. |

**Tiêu chí dừng:** Không chốt pilot nếu thiếu tin gốc/ticket Xeca, owner dự án, quyền nghiệm thu, ánh xạ nguồn hoặc không chứng minh được chặn chéo BU. Không dùng số lượng ticket, tin nhắn hay commit làm điểm nhân sự khi chưa có chính sách chấm điểm được duyệt. Mọi triển khai server/gateway là thay đổi riêng, cần biên nhận phiên bản đang chạy và kiểm các bot lân cận.

## 9. Mở rộng v0.2 — chức năng PM và điều hành công ty Tech

**Yêu cầu Chairman 11/11:** Xeca, IBS HI và Liberico đều có sự cố, nâng cấp, tính năng mới và sản phẩm mới; hệ thống phải thực hiện chức năng PM và hỗ trợ điều hành toàn công ty Tech. Bản v0.2 EXTENDS v0.1: giữ intake, bằng chứng, quyền, BoM và nguồn; mở rộng cách phân loại, mô hình sản phẩm/dịch vụ, nguồn lực, trách nhiệm và báo cáo điều hành. Bản v0.2 ưu tiên khi các quy trình dưới đây khác chuỗi task chung ở §2–§3. **Chỉ định nghĩa năng lực hệ thống; không bổ nhiệm AI vào chức danh hoặc chuyển quyền quyết định của tổ chức.**

Căn cứ mới: [Scan nguồn, phân loại 45 dòng và giới hạn](SCAN-LIBETECH-PM-COO-20261111.md). Mục tiêu cuối: một yêu cầu ở bất kỳ BU nào đều có nơi tiếp nhận, người chịu trách nhiệm, loại xử lý, phần cam kết, tiến độ, bằng chứng kết thúc và chi phí/nguồn lực có thể đối soát; Ban điều hành nhìn được sự cố nào đang ảnh hưởng dịch vụ và quyết định nào đang chặn bàn giao.

### 9.1 Chức năng, nhiệm vụ và sản phẩm đầu ra của hệ thống

| Chức năng | Hệ thống cần làm | Đầu ra thường trực | Người quyết / nhận kết quả |
|---|---|---|---|
| Quản lý nhu cầu khách hàng | Thu nhận từ nhóm, form, họp, Vault được cấp; Xeca nhận mới qua bot LBRC Xeca, Jira chỉ đối soát lịch sử; hỏi thông tin thiếu, tìm trùng, phân loại và theo dõi phản hồi | Một inbox theo khách/product/service; mọi yêu cầu có receipt, nguồn và next action | PM/đầu mối project xác nhận phân loại, khách xác nhận nhu cầu |
| Quản lý danh mục sản phẩm | Nối yêu cầu vào sản phẩm hiện có hoặc hồ sơ ý tưởng; nêu vấn đề người dùng, giá trị, phạm vi, khách hàng, phụ thuộc và phương án tái sử dụng | Product card, roadmap có phiên bản, hồ sơ go/no-go | Chủ sản phẩm/BU và người duyệt đầu tư trong thẩm quyền |
| PM / điều phối giao hàng | Lập nháp plan/milestone/task/action, phụ thuộc, tiêu chí, baseline; cập nhật, so lệch và dự báo có căn cứ | Kế hoạch theo đầu ra; danh sách blocker/decision; gói bàn giao | Phương điều phối chung; PM dự án và BoM theo phạm vi |
| Điều hành dịch vụ | Nhận diện incident, điều phối người trực, theo dõi giảm tác động/khôi phục, tách lỗi gốc và sửa phòng ngừa | Service health theo nguồn, incident timeline, problem record, review sau sự cố | Quân/đầu mối trực có ủy quyền; chủ dịch vụ xác nhận khôi phục |
| Quản lý nâng cấp và bảo trì | Gắn thay đổi vào dịch vụ/môi trường, đánh giá ảnh hưởng, lịch bảo trì, kiểm thử, rollback, quan sát sau triển khai | Change/release record, sổ môi trường, lịch gia hạn và bảo trì | Tech lead và người duyệt thay đổi; gateway chung theo phê duyệt từng lần |
| Quản lý nguồn lực | So yêu cầu với năng lực, giờ khả dụng đã xác nhận, việc cam kết, trực, dự phòng; đề xuất thứ tự và phân bổ | Tải dự kiến/đã dùng, khoảng trống năng lực, phiếu tái phân công | Ba thành viên BoM với ngưỡng 3/3 khi chia lại việc |
| Quản lý chất lượng và tri thức | Nhắc đặc tả/ADR, ca kiểm, tài liệu dùng/vận hành, bàn giao hỗ trợ; đối chiếu evidence đúng bản | Gói nghiệm thu, bằng chứng thiếu, knowledge/runbook có owner/version | Reviewer kỹ thuật, người nghiệp vụ và khách đúng ủy quyền |
| Quản lý dịch vụ thương mại | Nối việc vào phạm vi dịch vụ/hợp đồng, việc phát sinh ngoài phạm vi, chi phí hạ tầng/NCC, hạn gia hạn và hồ sơ thanh toán | Dự toán/chi phí đã đối soát, phần ngoài phạm vi, hồ sơ đề nghị duyệt | Phương chuẩn bị; Chairman/chủ hợp đồng/TCKT quyết theo quyền |
| Quản lý hiệu quả đội | Thu đóng góp, hỗ trợ, review và kết quả; giải thích điểm theo kỳ/chính sách, cho phép giải trình | Dashboard nhân sự, độ phủ bằng chứng, báo cáo nháp KPI | Người rà soát/chốt theo SPEC-003; HCNS/TCKT cho quy trình lương |
| Điều hành và cải tiến | Tóm tắt ngoại lệ, đề xuất phương án và tác động, theo dõi quyết định đến kết quả; tìm lỗi lặp để cải tiến | Trang quyết định của BoM/Chairman; báo cáo tuần; backlog cải tiến | BoM Tech và Chairman trong phạm vi thẩm quyền |

Một hành vi AI hữu ích phải đóng được vòng: **phát hiện → nguồn → đề xuất cụ thể → người nhận → quyết định → thực hiện → kiểm kết quả**. Báo cáo nhiều lần cùng một việc mà không có người/bước tiếp theo không được coi là năng lực điều hành.

### 9.2 Bốn luồng chính và hai luồng hỗ trợ

~~~mermaid
flowchart TD
  N[Xeca · IBS HI · Liberico<br/>Nhóm chat / web / họp / nguồn được cấp] --> I[Inbox có nguồn và người tiếp nhận]
  I --> A[Sự cố / lỗi<br/>Khôi phục và sửa nguyên nhân]
  I --> B[Nâng cấp<br/>Kiểm tương thích và bản quay lui]
  I --> C[Tính năng<br/>Phạm vi, xây, UAT]
  I --> D[Sản phẩm mới<br/>Khám phá, quyết định, pilot]
  I --> E[Hỗ trợ / việc định kỳ<br/>Kết quả dịch vụ theo kỳ]
  A --> O[Điều hành Tech<br/>Ưu tiên · nguồn lực · quyết định · bằng chứng]
  B --> O
  C --> O
  D --> O
  E --> O
  O --> H[BoM Tech / chủ sản phẩm / khách<br/>Xác nhận trong thẩm quyền]
  H --> R[Kết quả đo được và phản hồi người dùng]
  R --> K[Dashboard công ty · dự án · nhân sự]
  R --> I
~~~

| Luồng | Quy trình riêng | Dữ liệu/bằng chứng bắt buộc | Ví dụ từ nguồn |
|---|---|---|---|
| Sự cố / lỗi | Tiếp nhận → xác nhận tác động → nhận xử lý → giảm tác động → khôi phục → kiểm lại → đóng incident; nguyên nhân gốc và sửa lâu dài sang problem/change liên kết | Service, môi trường, thời điểm bắt đầu, triệu chứng/tái hiện, phạm vi ảnh hưởng, người trực, mốc phản hồi/khôi phục, kết quả đo. Bug chưa ảnh hưởng live giữ loại defect | Xeca lỗi ảnh Jetpay/STT 4, điểm đón/STT 42 là ứng viên defect; phải hỏi tác động trước khi gọi sự cố live |
| Nâng cấp kỹ thuật | Lý do/rủi ro → khảo sát tương thích → kế hoạch change → duyệt cửa sổ/bản quay lui → thử → triển khai được phép → đo sau triển khai | Dependency/runtime/config trước–sau, môi trường, tests, backup/rollback, observed version, các dịch vụ chịu ảnh hưởng | Node/STT 1, Fastify/JWT/XECA005, package/XECA006; IBS HI chuyển hạ tầng/STT 44 |
| Tính năng mới | Vấn đề/nhu cầu → xác nhận scope/tiêu chí → ưu tiên → xây/thử → người dùng nghiệm thu → phát hành → theo dõi sử dụng | Người dùng, use case, baseline, trường hợp âm, phiên bản bàn giao, UAT, kết quả sau dùng | LBRC014; phiếu xuất kho thêm hạn/lô/vị trí/STT 45; API MST Xeca/STT 3 |
| Sản phẩm / module mới | Khám phá nhu cầu → đánh giá tái sử dụng/mua/xây → phương án/chi phí dự kiến → go/no-go → MVP/pilot → quyết mở rộng → bàn giao chủ dịch vụ | Product owner, mục tiêu/khách dùng, phạm vi MVP, nguồn dữ liệu/chủ quyền, giả thuyết giá trị, nguồn lực, tiêu chí dừng/thành công, người hỗ trợ sau ra mắt | App LBROS/STT 14; nhóm năng lực IBSHI-CHU-01…07 là ứng viên module, chưa tự coi bảy sản phẩm được duyệt; Xeca Kho vận cần đối soát phạm vi mới |
| Yêu cầu dịch vụ | Nhận → làm rõ → duyệt thao tác nếu cần → thực hiện → người dùng kiểm → đóng | Checklist kết quả, quyền cấp/sửa dữ liệu, phần chờ bên khác; không ép có SHA | HCNS-001 thêm dự án/đang chờ quyền ERP; cập nhật chỉ tiêu BT Chain/STT 43; hướng dẫn/hỗ trợ bot |
| Nhiệm vụ định kỳ / khám phá | Theo nhịp hoặc timebox → kết quả kỳ → rà soát → kỳ kế tiếp hoặc quyết tiếp/dừng | Nhịp, người nhận báo cáo, đầu ra, bằng chứng, giới hạn công sức; không tự mở vô hạn | STT 17–20 PM IBS HI; STT 24/26 hỗ trợ; STT 25 nghiên cứu bot liên phòng |

Incident có ba đồng hồ riêng: thời gian đến xác nhận/nhận xử lý, thời gian đến khôi phục, thời gian đến xử lý nguyên nhân gốc. Hạn ticket hiện có chỉ là chính sách tiếp nhận hiện hữu; không tự tái sử dụng làm SLA dịch vụ hoặc cam kết sản phẩm. Tất cả thời hạn/lịch làm việc có phiên bản, ngày hiệu lực, khoảng tạm dừng và lý do.

### 9.3 Tình huống mẫu xuyên ba nhóm khách hàng

- **Xeca:** một tin “không thấy tên điểm đón” tạo defect candidate đúng sản phẩm/môi trường. Nếu xác nhận người dùng đang bị chặn sử dụng, liên kết incident và gọi người trực trong ma trận đã duyệt. Sau khôi phục, sửa lâu dài và hồi quy có task riêng; ticket khách đóng sau vòng phản hồi đúng người. “Nâng Fastify” và “package audit” vẫn hai thay đổi riêng theo phạm vi XECA005/XECA006.
- **IBS HI:** yêu cầu từ họp “bot Thiết bị nhắc bảo trì” đi vào discovery/module backlog; tài liệu dự thảo giữ nhãn chưa chốt. Hoàng Anh phối hợp chủ bộ phận để xác nhận dữ liệu/đầu ra, Tech ước lượng và lập pilot. Các lệnh sản xuất, bản vẽ/BOM, nhân sự hoặc giao dịch ERP thuộc hệ IBS HI; LibeTech quản lý việc xây/sửa/dịch vụ phần mềm. Nghiệm thu chuyên ngành có chuyên gia IBS HI.
- **Liberico:** “in phiếu xuất kho thêm hạn dùng, số lô, vị trí” là feature có chủ nghiệp vụ, repo/service xác định và ca đối chiếu dữ liệu thực. “Cập nhật chỉ tiêu BĐT” là service/data request liên kết tính năng BT Chain đã giao, không tính lại như một feature đã hoàn thành trước đó. App LBROS là hồ sơ sản phẩm/ứng dụng với mục tiêu và lộ trình riêng.

## 10. Phân công chức năng người và hệ thống

| Chủ thể | Phạm vi theo chỉ đạo hiện hành | Hệ thống hỗ trợ | Giới hạn |
|---|---|---|---|
| Chairman | Định hướng, ưu tiên liên khách hàng, đầu tư/ngoại lệ trong quyền; A-cuối LibeTech theo V260915 khi CTO còn trống | Hàng quyết định có phương án, tác động, evidence và người chịu trách nhiệm | Không buộc Chairman duyệt mọi cập nhật tiến độ hoặc mọi câu trả lời |
| Phương Tech | PM chung, điều phối/vận hành; trực tiếp dự án Liberico | Inbox cam kết, portfolio, kế hoạch, vendor/gia hạn, tài liệu bàn giao, báo cáo | Khác danh tính CFO Phương; điều phối không tự tạo quyền tài chính hay nghiệm thu mọi project |
| Quân | Tech/code/hạ tầng/maintenance; BTNET, Xeca, IBS HI 1 | Bản đồ service/env/repo, change/release, trực/dự phòng, quality gate | Quyền triển khai và quyền nghiệm thu cấp theo việc; người làm không tự nghiệm thu |
| Chu Hoàng Anh | IBS HI, chuyển đổi số thành viên BTNET, MRO; phối hợp nền tảng BTNET | Discovery, đối soát nhu cầu/đầu mối, kế hoạch liên phòng, nghiệm thu nghiệp vụ được ủy quyền | Vai này không cho phép đọc toàn bộ dữ liệu IBS HI hoặc thay chuyên gia phê duyệt |
| Team Tech | Thực hiện/review/hỗ trợ trong project được cấp | Nhận việc, cập nhật một lần qua web hoặc bot, bàn giao, phản hồi blocker | Một người có thể nhiều nhiệm vụ; quyền thao tác theo project/work thay cho chỉ một nhãn vai |
| Chủ sản phẩm / khách | Xác nhận nhu cầu, ưu tiên trong phạm vi mình, kết quả sử dụng | Phiếu làm rõ và nghiệm thu đơn giản, lịch sử cam kết | Không giao lại người nội bộ Tech hay xem các BU khác |
| AI PM/điều hành | Theo dõi toàn vòng theo phạm vi dữ liệu được cấp; nhắc, đề xuất, tổng hợp và kiểm thiếu | Z4 suggestions và lệnh nghiệp vụ có người xác nhận | Không tự quyết nhân sự, ngân sách, cam kết khách, nghiệm thu hoặc lương |

**Xác nhận cần gọn.** Web và Telegram dùng thẻ nêu đúng quyết định, bản trước–sau, phạm vi và nút Có/Không; thêm Yêu cầu sửa nếu cần. Mỗi lựa chọn gắn actor, phiếu, revision và hạn hiệu lực. Tin “yes” chỉ có hiệu lực khi reply đúng thẻ còn hiệu lực, quyền còn đúng; “yes” chung trong nhóm không tự duyệt nhiều phiếu. Tiến độ do người được giao chủ động gửi rõ mã việc được ghi bằng domain service và trả biên nhận; phần AI tự suy từ cuộc trao đổi giữ ở nháp Z4.

**3/3 và sự cố:** mọi chia lại người/đầu ra qua BoM 3/3 như đã chốt. Lịch trực, người dự phòng và phạm vi xử lý cần được duyệt sẵn; khi có incident, hệ thống gọi đúng người trong lịch không tạo một lần tái phân công. Nếu cần ngoài lịch/quyền, chuyển đúng người có thẩm quyền quyết và ghi ngoại lệ; không tạo lá phiếu giả hoặc âm thầm giảm quorum. Cách giao việc mới trong hạn mức ủy quyền phải được ghi vào Quy chế; khi chưa có ủy quyền, giữ đề xuất chờ BoM. §3 bước 5 không được diễn giải thành chặn tiếp nhận/nhận diện sự cố cho tới đủ 3/3.

## 11. Nâng cấp dữ liệu và công cụ

### 11.1 Mô hình bổ sung

Client/BU → Product → Service/môi trường là danh mục dài hạn. Initiative/project → plan/milestone → work/action là phần thay đổi có thời hạn. Demand/ticket liên kết hai trục; incident gắn service; change gắn release/env; discovery gắn product candidate. Một product có nhiều project/releases, một project có thể tác động nhiều service: dùng bảng liên kết có scope, không ép service thuộc duy nhất một dự án ngắn hạn như foundation hiện tại.

Thêm bản ghi có phiên bản: service owner, trực/dự phòng, SLA và lịch; impact/severity có người xác nhận; problem/root cause; release/deployment desired/observed; dependency/blocker/decision; capacity/estimate/actual effort; service agreement/vendor renewal và cost reference. Dữ liệu tài chính gốc ở hệ chủ sở hữu, AI OS chỉ nhận bản chiếu được phép, ghi phân bổ/đề xuất có người duyệt. Không dùng tenant_id, organization_id, BU và pháp nhân kế toán lẫn nhau.

Evidence hỗ trợ union có kiểu: code(full SHA/repo), config(manifest hash/environment), document(revision/hash), data(snapshot/query contract/time), service restoration(monitor/ca kiểm), training(participant/ca dùng thật), customer confirmation(authority/version). Chính sách nghiệm thu theo loại đầu ra; chỉ code bắt Git SHA. Link tài liệu do người gửi khai và evidence đã fetch/đối chiếu hiển thị khác nhau.

### 11.2 Năng lực hiện có cần kế thừa, sửa và thêm

| Phần | Mã/cơ sở hiện có | Thay đổi cần làm |
|---|---|---|
| Tài khoản, ghép Telegram, scope | identity.ts, accounts.ts, bridge.ts, RLS | Giữ danh tính; thêm capability theo thao tác/work và quyền xem portfolio giới hạn. Bot PM ghi phải qua operation riêng, không mở generic write |
| Nguồn bảng | team-catalog.ts, source-snapshot.ts, migrations 011 | Nguồn có watermark, refresh receipt, mapping bền, so diff; không sửa trường source_status |
| Tiếp nhận | priority1 plugin/intake.py; feedback.ts | Phân loại bốn luồng + hỗ trợ/định kỳ; ticket event adapter, links, duplicate review; phân biệt reporter/receiver/assignee/acceptor |
| Work/nghiệm thu | service.ts: planned/doing/review/blocked/done; evidence bắt sourceSha | Workflow theo loại và evidence phi mã; migrate có phiên bản, giữ lịch sử và ca LBRC014 |
| Phân công BoM | bom.ts / migration 006 | Tái dùng 3/3; roster trực và ủy quyền giao mới không làm vòng qua tái phân công |
| Product/service/plan | types.ts có Project/Service mức foundation | Bổ sung danh mục dài hạn, initiative/milestone, quan hệ nhiều project–service, incident/change/discovery |
| Báo cáo/score | reports.ts, evidence-projector.ts, evidence-scores.ts | Thêm dashboard điều hành và dịch vụ; score theo loại đóng góp, công thức/kỳ được duyệt, không cộng số tin/commit máy móc |
| Thông báo | Cron ticket hiện hữu; bridge đọc/duyệt tài khoản | Outbox theo event, delivery receipt, retry và quyền người nhận; chứng minh gửi thật trước khi gọi luồng hoạt động |
| Vault / lịch sử Jira / Factory | Pointers nghiên cứu; CSV Jira do Chairman cung cấp; GitHub reader; Factory chưa nối trong nền | Vault/Factory dùng adapter được cấp. Jira đối soát snapshot một lần theo §15, không xây connector Jira liên tục cho yêu cầu Xeca mới; giữ mã gốc và liên kết, không tự tái tạo task |

### 11.3 Công cụ nghiệp vụ đề xuất

Bot cần các thao tác hẹp: intake nhận/tra cứu; tra product/service/việc; gửi update của người làm; nộp evidence; lập nháp plan; đề nghị quyết định; biểu quyết đúng phiếu; đọc ngoại lệ; trả lời tiến độ cho khách. Bộ deterministic adapter thực hiện vận chuyển sự kiện và kiểm quyền; AI ghi phân tích/gợi ý Z4. Domain service của AI OS áp lệnh người xác nhận vào Z1. Không cho model tự chọn tenant/actor hoặc tự gọi DB.

Change Scout so revision và nội dung **được cấp** từ Sheet/Vault và sự kiện bot, lưu source event + diff; snapshot Jira chỉ tham gia đợt đối soát lịch sử có phiên bản theo §15; nhãn approved/draft/superseded được giữ. Scout chỉ tạo ứng viên gắn source, không tự giao việc từ mọi dòng trong biên bản. Nội dung được thay thế không xóa bằng chứng cũ. Khi không có quyền hoặc nguồn mất, hiện thiếu nguồn, không thay bằng suy đoán.

## 12. Dashboard và nhịp điều hành

Trang điều hành công ty có năm góc nhìn: (1) dịch vụ/sự cố đang ảnh hưởng khách; (2) cam kết/milestone sắp đến và thiếu đầu vào; (3) quyết định cần BoM/Chairman/khách; (4) năng lực đội, lịch trực và công việc phát sinh; (5) phạm vi dịch vụ, chi phí/renewal và hồ sơ thương mại còn thiếu. Drill-down từ đây sang dashboard project và nhân sự đã có. Người xem chỉ được tổng hợp phần phạm vi của mình; vai BoM không mặc nhiên đọc lương/cost riêng của mọi người.

Lịch nhắc hạn 08:30 ngày làm việc và báo cáo thứ Sáu 16:00 ở LibeAI là đầu vào cấu hình đã chốt trước. Gói mới mở rộng nội dung theo nguồn đủ điều kiện, không tự tạo thêm lịch hay nhóm. Cảnh báo incident tức thời là cấu hình theo service/on-call được người có quyền duyệt trước khi bật. Báo cáo có: điều đã thay đổi, ảnh hưởng khách, việc cần ai quyết, bước tiếp theo và nguồn; dữ liệu chưa đủ hiện rõ.

Đo ban đầu: tỷ lệ intake có nguồn/owner/next action, thời gian triage, lead time theo từng loại, số lần mở lại, thời gian khôi phục, tỷ lệ bàn giao có đúng evidence, tuổi blocker, độ lệch baseline và độ phủ cập nhật. Mỗi chỉ số có mẫu số, phạm vi thời gian và quy tắc thiếu dữ liệu. Chưa đủ lịch sử thì hiển thị thiếu căn cứ; không áp mục tiêu phần trăm hoặc quy đổi lương từ các con số này.

## 13. Backlog mở rộng và nghiệm thu

| ID / thứ tự | Gói năng lực | Ca thật dùng kiểm | Điều kiện đạt |
|---|---|---|---|
| COO-01 / P0 | Taxonomy, danh mục product/service/client, phân loại source chỉ đọc | 45 dòng Sheet + 36 dòng kế hoạch | Mỗi dòng có nguồn, loại đề xuất/đã xác nhận, work vs nhiệm vụ định kỳ, mapping không dùng STT làm ID |
| COO-02 / P0 | Inbox hợp nhất và nguồn thay đổi | Xeca TK-XECA-202611-001; IBS yêu cầu sau họp; LBRC STT 45 | Đúng người/nhóm/source; replay không trùng; nhãn draft không thành đã duyệt; quyền chéo BU bị chặn |
| COO-03 / P0 | Vòng incident/support + lịch trực | Xeca lỗi điểm đón; HCNS-001 | Tách bug và incident; có bên đang chờ; gọi đúng người trực; khôi phục khác đóng việc nguyên nhân gốc |
| COO-04 / P0 | Project/plan/milestone và capacity | VNPOST nhiều phase; IBS STT 17–21; Xeca Kho vận | Một baseline có chủ, tiêu chí, phụ thuộc; nhiệm vụ định kỳ không đếm như project; không tự ghép các giai đoạn |
| COO-05 / P0 | Quyền theo việc và 3/3 | STT 5 + một việc Xeca được chốt | 2/3 giữ phân công; 3/3 một receipt; self-acceptance, vote cũ, API/import đi tắt bị chặn |
| COO-06 / P0 | Evidence phi mã và nghiệm thu | HDSD IBS/STT 22; HCNS-001; LBRC014 đúng SHA | Tài liệu/dịch vụ nghiệm thu bằng loại evidence đúng; LBRC014 giữ full SHA; không làm yếu kiểm code |
| COO-07 / P1 | Change/release/maintenance | XECA005 và XECA006; IBS chuyển hạ tầng | Không gộp hai scope; có before/after, rollback, kết quả quan sát và nhóm dịch vụ chịu ảnh hưởng |
| COO-08 / P1 | Product discovery / go-no-go | App LBROS; năng lực bot Thiết bị IBS HI; Xeca Kho vận | Scope/MVP/owner/tiêu chí/cost-capacity được chốt; đề xuất dừng có lý do; chưa duyệt không vào cam kết delivery |
| COO-09 / P1 | Dashboard điều hành + delivery outbox | Cùng hồ sơ Xeca/IBS/LBRC của COO-02 | Tổng và chi tiết khớp cùng quyền; gửi đúng nhóm, có receipt, không báo đã gửi khi chỉ ghi DB |
| COO-10 / P1 | Dịch vụ, vendor, gia hạn, chi phí | Dòng kế hoạch PLN-T11-029/030 | Phạm vi/hạn/owner có nguồn; ngoài scope có change request; draft cost không thành tiền phải trả |
| COO-11 / P1 | Score và giải trình theo đóng góp | LBRC014 + một support + một tài liệu | Không thưởng kép một đầu ra; không phạt vì nguồn chưa nhận; self-review bị chặn, chính sách/kỳ có phiên bản |
| COO-12 / Phase 2 | Dev Factory và quan sát vận hành | Một work đã đủ quyền và tiêu chí | Gói giao việc → PR/check/build → release/deploy được duyệt → đúng bản chạy → bàn giao support; artifact/receipt kiểm được |

Thứ tự phụ thuộc: COO-01 → COO-02 → COO-03/04/05/06 → COO-07/08/09 → COO-10/11 → COO-12. Có thể chuẩn bị tài liệu các gói sau sớm, nhưng không tuyên chúng đã hoạt động trước khi đạt ca thật. Lần thử đầu phải có cả Xeca, IBS HI và Liberico; việc đơn lẻ LBRC014 không đủ nghiệm thu vai điều hành công ty.

## 14. Điều kiện áp dụng và phần chưa xác minh

Lượt này đã đọc nguồn và nâng cấp thiết kế; chưa đổi mã, migration, quyền thực tế, lịch hoặc gateway. Khi triển khai, cập nhật ADR-001/AGENTS theo entity owner, domain boundaries và các loại evidence mới; versioned migrations, backup/restore và source reconciliation. Mỗi gói có build ID, test âm quyền, biên nhận runtime và người nhận UAT riêng.

Connector Jira trước đó không đọc được; lượt bổ sung đã đọc CSV 76 Bug và báo cáo HTML do Chairman cung cấp (§15). Đây là lịch sử đến tháng 3/2026, chưa phải backlog hiện tại; chưa có nguồn đầy đủ cho khoảng trống sau đó. Bỏ Jira cho intake mới từ tháng 11 là chỉ đạo đã nhận, chưa kiểm cutover kỹ thuật. Chưa lấy toàn bộ tin Telegram/ledger thật của ba BU. Các tài liệu Xeca kỹ thuật tháng 9–10 và IBS HI dự thảo có thể đã được team cập nhật ngoài những nguồn đã đọc; trước khi chuyển thành cam kết phải đọc lại phiên bản và xác nhận người giữ nguồn. Bản thiết kế không kết luận toàn bộ yêu cầu của ba BU đã được nhập vào hệ thống.


## 15. Xeca chuyển tiếp nhận từ Jira sang bot — v0.3

### 15.1 Quyết định, kênh và cách sử dụng

Chairman xác nhận ngày 11/11/2026: “bỏ Jira từ tháng 11, nhận yêu cầu từ nhóm LBRC Xeca qua bot”. Áp dụng cho tiếp nhận Xeca; không tự áp quyết định đóng Jira cho hệ khác. Người báo gửi nội dung tự nhiên, ảnh/tài liệu hoặc reply thẻ việc, có thể gọi @bot; không phải mở tài khoản Jira hay nhớ lệnh dài. Khi triển khai phải kiểm chế độ nhận tin của bot, topic và quyền đọc thực tế; không hứa đọc được mọi tin lịch sử hoặc mọi tin không nhắc bot.

Luồng đích: **LBRC Xeca → bot nhận và trả biên nhận → inbox AI OS → PM làm rõ/đối soát → việc, kế hoạch hoặc sự cố theo loại → giao việc đúng quyền → cập nhật/bằng chứng → nghiệm thu → trả kết quả về đúng tin gốc**. Bot và nền dùng liên kết chung ticket/work, người dùng không nhập lại hai lần. Sổ ticket hiện hữu tiếp tục giữ tiếp nhận cho đến khi ADR chuyển chủ dữ liệu được áp; AI OS giữ ứng viên và công việc đã xác nhận. Không tạo hai nguồn cùng sửa trạng thái một ticket.

Tên “LBRC Xeca” theo lời Chairman chưa được đối chiếu với chat ID trên gateway trong lượt này. Không tự coi bằng tên cũ “Libe – Xeca”. Registry cần chat ID/topic, BU, product/project được phép, bot, người tiếp nhận, chính sách hiển thị và biên nhận kiểm tin thật. Một nhóm có thể nhận nhiều sản phẩm Xeca: bot hỏi đúng sản phẩm/dịch vụ khi chưa rõ, không mặc định tất cả vào dự án đã biết. Nội dung tin không được thay scope được cấp từ server.

Người báo bên khách có thể gửi intake trong nhóm được cấp mà chưa có tài khoản Team Tech; lưu Telegram sender từ gateway như danh tính nguồn. Service principal chỉ ghi ứng viên hẹp. Giao việc, cập nhật Z1 có hiệu lực, duyệt và nghiệm thu vẫn đòi danh tính đã xác minh và quyền thao tác. Không biến quyền báo lỗi thành quyền phân công/xem dữ liệu nội bộ.

Bot hỏi theo nhu cầu từng bước: hệ thống/sản phẩm, đang xảy ra hay yêu cầu mới, tác động, kết quả mong muốn, cách tái hiện và bằng chứng. Không bắt đủ biểu mẫu mới nhận một sự cố đang gây gián đoạn. Tóm tắt lại bằng thẻ **Đúng / Cần sửa**; quyết định thuộc thẩm quyền dùng **Có / Không** gắn đúng phiếu và phiên bản. Thiếu phạm vi thì chờ làm rõ; không tự hứa deadline. PM có thể tách một yêu cầu thành nhiều bước nhưng phải giữ liên kết với người báo ban đầu.

### 15.2 Hai nguồn lịch sử và giới hạn

[Scan §5](SCAN-LIBETECH-PM-COO-20261111.md#5-bổ-sung-hồ-sơ-xeca-và-quyết-định-bỏ-jira) ghi đường dẫn, SHA-256 và phép đếm. CSV có 76 mã duy nhất, tất cả loại Bug: 72 Closed, 2 In Progress, 2 Backlog. Created trải từ 01/05/2024 đến 30/03/2026; Updated từ 06/01 đến 30/03/2026, không nêu timezone. Tên tệp không đủ làm hợp đồng độ phủ. Không gọi 4 phiếu là backlog còn mở hôm nay; không suy 72 Closed thành đã nghiệm thu. CSV này không phủ đầy đủ nhu cầu tính năng/sản phẩm hoặc các yêu cầu từ tháng 4 đến thời điểm chuyển tháng 11. Kế hoạch đã đọc còn dẫn XECA2023-740/741 ngoài 76 mã này.

HTML đề ngày 05/04/2026 là báo cáo phản biện được cung cấp. Phân loại/điểm kiến trúc, giả thuyết nguyên nhân, giải pháp và thời lượng trong đó giữ dưới dạng nhận định có nguồn, cần kiểm repo/runtime hiện tại trước khi thành việc được duyệt. Không chạy script HTML hoặc áp lệnh/migration được mô tả trong báo cáo. Không chuyển điểm kiến trúc thành score nhân sự.

### 15.3 Đối soát một lần, bảo toàn lịch sử

1. Lập manifest snapshot riêng: hash tệp, thời điểm nhận, phạm vi được xuất, bộ lọc và timezone nếu chủ nguồn xác nhận. Đọc CSV theo vị trí cột để giữ đủ **12 cột Comment, 6 cột Attachment** có tên lặp; đã đếm 124 ô comment và 108 tham chiếu attachment, chưa xác minh nội dung tệp đính kèm.
2. Giữ Issue key/id, nội dung gốc, trạng thái/priority nguồn, người tạo/báo/được giao, các mốc thời gian, từng comment/attachment/link và vị trí cột. Lưu alias nguồn riêng; đối soát user trước khi gắn tài khoản hiện tại. Replay cùng snapshot/key không tạo thêm hồ sơ; snapshot mới tạo phiên bản, không ghi đè lịch sử. Không dùng nhãn Highest cũ như mức sự cố hiện tại.
3. Đưa bốn mã 602, 540, 657, 579 vào **hàng đối soát lịch sử**. PM xác nhận đã xử lý, vẫn còn, trùng việc hiện tại hay hết nhu cầu, kèm nguồn mới. 72 Closed ở vùng tra cứu lịch sử; chỉ mở việc mới khi có yêu cầu/tái phát được xác nhận và liên kết mã cũ. Không tự giao người theo Assignee cũ.
4. Nếu thực hiện một đợt đối soát lịch sử riêng, trước khi tuyên bố đợt đó hoàn tất, bổ sung bản xuất đến mốc chuyển hoặc bảng đối soát được chủ nguồn ký nhận, gồm các loại việc khác ngoài Bug và những mã đang được tham chiếu trong kế hoạch. CSV hiện có không phải bản sao lưu Jira đầy đủ: thiếu changelog chuyển trạng thái, lịch sử hạn/quyền và nội dung attachment thực. Ghi rõ phần không lấy được; không tính SLA/lương từ lịch sử thiếu này.
5. Liên kết nhiều–nhiều giữa mã Jira cũ ↔ ticket Telegram ↔ việc AI OS, có loại quan hệ và người xác nhận. STT Sheet/alias không làm khóa. Giữ riêng phạm vi XECA005/TK-XECA-202611-001 và XECA006 như nguồn hiện tại; không gộp chỉ vì cùng nâng package.
6. Ghi thời điểm **thực tế** kích hoạt tuyến mới, snapshot cuối và phạm vi còn thiếu trong receipt cutover. Không tự gán `2026-11-01` là thời điểm gateway hoạt động. Nếu cần nhập bổ sung cuối kỳ, ghi batch đối soát riêng; không duy trì hai inbox mới song song vô thời hạn. Việc ngừng tạo mới/đóng dịch vụ Jira và lưu attachment phải có bước vận hành riêng, không suy từ việc đã sửa SPEC.

Chỉ ingest phần nguồn đúng project, ẩn số điện thoại/khách hàng khỏi dashboard chung; mã hóa/phân quyền hồ sơ theo chính sách hiện có. URL hoặc nội dung attachment là dữ liệu không tin cậy: fetch theo allowlist có quyền, giới hạn loại/kích thước, kiểm hash; không tự tải mọi URL trong CSV. Nguồn gốc chỉ đọc, Sheet của team giữ nguyên. Đợt này chưa import dữ liệu vào server.

### 15.4 Ca mẫu và nghiệm thu thay Jira

| ID | Nguồn/ca | Hành vi phải đạt |
|---|---|---|
| XI-01 | Một yêu cầu mới thực trong LBRC Xeca | Tin tự nhiên → một ticket, một candidate có source ID → PM xác nhận → work theo đúng loại; không cần Jira. Bot gửi receipt về đúng nhóm/topic; ghi nhận người dùng đọc/đồng ý riêng với gửi thành công |
| XI-02 | XECA2023-602, lỗi hosting lặp lại | Replay cô lập từ lịch sử: tách incident/đối tác/đề xuất chuyển hosting và các bước cấu hình, mua, chuyển, DNS; giữ nguồn comment; không tự giao người hoặc duyệt mua. Khôi phục dịch vụ khác hoàn tất thay đổi dài hạn |
| XI-03 | XECA2023-540, tìm theo SĐT thứ hai | Nhãn Bug nguồn giữ nguyên; PM ghi tranh luận expected behavior, chốt quy tắc tìm trùng số và tiêu chí trước khi phân loại lại/commit sửa. Ẩn dữ liệu nhận diện khách |
| XI-04 | XECA2023-604 và XECA2023-598 | Bộ ca hồi quy lịch sử: 604 kiểm API lẫn giao diện theo quy tắc giá; 598 kiểm iOS/Android, phiên bản và thiết bị. Closed cũ không chứng minh bản đang chạy đã qua kiểm này |
| XI-05 | XECA2023-587 / XECA2023-214 | PR đã merge hoặc comment “pass” là từng bằng chứng nguồn; phải nối đúng revision, build/release, môi trường, ca kiểm và người có quyền. Giữ con trỏ Bitbucket cũ, không tự đổi thành GitHub. Không dựng lại SHA thiếu bằng suy đoán |
| XI-06 | Nhập lại CSV và nguồn thiếu | 76 mã, 124 ô comment, 108 tham chiếu attachment bảo toàn; replay không thêm bản trùng; 4 phiếu chỉ vào hàng đối soát; trạng thái và người của Sheet không đổi |
| XI-07 | Lỗi kết nối, tin sửa/gửi trùng và khởi động lại | Ticket đã ghi vẫn còn; retry sang AI OS không nhân đôi; edit lưu version; bot phân biệt đã nhận với đã đồng bộ; lỗi có hàng xử lý và receipt phục hồi |
| XI-08 | Quyền / đóng vòng | Nhóm Xeca không xem LBRC014 hoặc IBS HI; member không tự nghiệm thu; chia lại việc 2/3 chưa áp, 3/3 áp đúng một lần; trả kết quả trong phạm vi khách rồi ghi xác nhận/ý kiến riêng |

XI-02…06 dùng dữ liệu lịch sử cô lập, không phát lại thông báo cũ vào nhóm và không mở lại việc thật. XI-01/07/08 cần ca thử được định danh trên runtime mới để nghiệm thu triển khai. Dashboard tách intake mới, lịch sử Jira, việc đã cam kết và yêu cầu chưa đối soát; không cộng lịch sử vào KPI tháng 11. Lộ trình hiện hành theo SPEC-009 ưu tiên PM/BA, tài liệu và intake nhiều nhóm; đối soát Jira lịch sử là tùy chọn riêng, không đặt Jira connector hoặc hoàn thiện lịch sử làm điều kiện triển khai.
