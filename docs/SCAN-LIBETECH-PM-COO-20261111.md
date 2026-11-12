# Scan nguồn cho LibeTech PM và điều hành Tech — 11/11/2026

Status: nghiên cứu để mở rộng SPEC-008; phân loại dưới đây là đề xuất, chưa đổi dữ liệu nguồn.
Scope: metadata công việc Tech của Xeca, IBS HI, Liberico; không nhập nội dung nghiệp vụ riêng của khách hàng.

## 1. Phạm vi đã đọc và độ phủ

| Nguồn | Đã kiểm | Giới hạn |
|---|---|---|
| [Đầu việc Tech](https://docs.google.com/spreadsheets/d/1Vr1ykZUtwm5Wvj1oAQRjpzMgleDa6Fhu-WiPv-L61Vc/edit#gid=1963754558) | A1:H80: 45 dòng; XECA 7, LBRC 18, IBS HI 20. Modified nguồn 2026-11-11T04:23:09.206Z. | Một bảng tổng hợp, không phải toàn bộ backlog khách hàng. |
| [Kế hoạch/nhiệm vụ/KPI tháng 11](https://drive.google.com/file/d/1h1ZjHJYpCUrBYfDzHt_6ModrdOyYP5Cu/view) | Bảng vai trò và 36 dòng kế hoạch; có giờ khả dụng tự khai, người dự phòng, đầu ra/tiêu chí, dịch vụ/NCC, trực, Jira. | Nhiều dòng còn Chờ chốt; CK, PLN và STT khác nghĩa; không ghép theo số. Giờ và KPI chưa tự thành định mức được duyệt. |
| [LibeAI Share](https://drive.google.com/drive/folders/1wqVXMUb9vjfrgSstFyZnvZJx5oWZZGss) | Liệt kê 12 mục trực tiếp; đọc các nhánh Kế hoạch, XECA/Module Hàng hóa, IBS HI/HCNS, LBRC/LBROS. | Quét danh mục và đọc có chọn lọc, chưa đọc mọi tệp đệ quy. Bảng Platform có cột tài khoản/key nên không tải lại nguyên bảng. |
| [XECA Kho vận — nghiên cứu khả thi](https://drive.google.com/file/d/1LnoHvl6EHEWWBD_CpQburdYjl9yBXgCc/view) | Phạm vi clone, phụ thuộc Lilog, mobile, quyền dữ liệu, điều kiện bàn giao. | Bản nháp 28/09: chỉ làm căn cứ nhận diện lớp công việc; không dùng ước lượng cũ làm cam kết hiện tại. |
| Xeca Brain/2_curated/architecture-integration-map.md | Tài liệu phân biệt hệ vé và Kho vận; link repo/phiên bản; chủ dữ liệu và tích hợp. | Bản 07/10 dựa tài liệu commit cũ, không đo runtime trong lượt này. |
| [HCNS IBS HI](https://docs.google.com/spreadsheets/d/1eM9ajs9dwur1RBixacMZxR9HsSUQwB8E1JZBioJlT7s/edit) | Danh sách Task A1:P20: HCNS-001 ghi Hoàn thành, ghi chú còn chờ phân quyền ERP. | Ca phân biệt kết thúc một bước và hoàn tất yêu cầu; chưa kết luận lỗi hoặc quyền nào đã được cấp. Chỉ lưu metadata Tech. |
| IBS HI Brain/06_Engineering/_OBJECTIVES.md; YEUCAU_HopCDS_2026-11-10.md; PHANTICH_KienTruc_Bot_Module_AI_OS_2026-11-10.md | Nhu cầu mới về bot, dữ liệu/NAS, thiết bị, HCNS, quy trình liên phòng; có bản đã duyệt và bản dự thảo đang phản biện. | Bản họp v0.3 và thiết kế v1.1 vẫn nhãn dự thảo; các đo đạc ERP là lời báo có nguồn trong Vault, chưa được kiểm lại ở đây. LibeTech chỉ nhận gói yêu cầu phần mềm được chủ IBS HI xác nhận. |
| Liberico Intelligent/1_Memory/governance/SoDoToChuc_CNNV_V260915_15.09.2026_CANONICAL.md | BU7: IT Services & AI Platform; phí dịch vụ nội bộ và khách ngoài; A-cuối P&L là Chairman kiêm CTO; đội Phương Tech, Chu Hoàng Anh, Quân. | File overview tháng 5 nêu bộ ba Phương–Toàn–Quân đã cũ; không dùng thay chỉ đạo BoM hiện hành trong phiên. Không suy quyền tài chính/nhân sự từ vai PM. |
| AI OS src/server/types.ts, service.ts, bridge.ts; bot plugin/intake.py | Mô hình work hiện 5 trạng thái, bắt SHA ở đường bàn giao/nghiệm thu; chưa có đầy đủ product/service/incident/change/discovery lifecycle. Bridge PM ghi chưa có. | Kiểm mã local và biên nhận 0.7.1 đã lưu; không kiểm lại server/gateway trong lượt này. |
| Lịch sử Jira Xeca | Đã đọc CSV 76 Bug và HTML phản biện do Chairman cung cấp; chi tiết §5. Kế hoạch còn dẫn XECA2023-740/741. | CSV cập nhật mới nhất 30/03/2026; không đủ backlog tháng 11. Chairman xác nhận bỏ Jira cho intake mới từ tháng 11, dùng bot nhóm LBRC Xeca. Chưa kiểm cutover runtime. |
| AnythingLLM local | Đã thử API workspace bằng client có sẵn, không lộ khóa. | Không nhận được kết nối workspace; nghiên cứu dựa nguồn trực tiếp nêu trên, không dùng kết quả RAG. |

## 2. Điều nguồn cho thấy

- 16 dòng nguồn Hoàn thành, 16 Đang triển khai, 13 Chưa triển khai. 29 dòng chưa Hoàn thành; 25 dòng trống cột hạn, STT 15 trống người. Đây là số đo trường nguồn, **không phải 25 việc trễ**: việc thường xuyên cần nhịp và đầu ra theo kỳ, việc theo dự án cần deadline.
- STT 17–20 là chức năng điều phối của Hoàng Anh; đếm thành bốn dự án hoặc cộng vào khối lượng sản phẩm sẽ sai.
- STT 6 trộn sửa lỗi với nâng tính năng, báo cáo; STT 11 đã có PO nhưng còn Xuất/Nhập/Tồn; STT 43 tách khỏi LBRC015. Cần quản lý phần việc và phạm vi từng lần bàn giao.
- Xeca STT 33/XECA005 dẫn ticket TK-XECA-202611-001 chờ đóng; XECA006/STT 41 ghi rõ không trùng ticket này. Không gom tất cả việc nâng package thành một case.
- HCNS-001 cho thấy yêu cầu dịch vụ có thể xong bước tạo tài khoản nhưng còn chờ quyền ở hệ khác. Hệ thống phải theo dõi kết quả người dùng cần, cùng từng bước và bên phụ thuộc.
- IBS HI có yêu cầu mới trong Vault/họp ngoài checklist; tài liệu dự thảo không tự thành nhiệm vụ đã giao. Cần Change Scout: phát hiện thay đổi → đề xuất intake kèm diff → người có quyền xác nhận.
- Mandate LibeTech bao gồm dịch vụ và vận hành kinh doanh Tech. SPEC-008 cũ thiếu quản lý dịch vụ, vòng đời sản phẩm, ngân sách/chi phí dự kiến, trực và năng lực đội.
- Bằng chứng phi mã cần phiên bản tài liệu, biên bản, ca dùng thật hoặc cấu hình được nhận diện. Yêu cầu mọi nghiệm thu có Git SHA hiện tại sẽ không hỗ trợ đủ chức năng công ty Tech.

## 3. Phân loại ứng viên toàn bộ 45 dòng

Đây là lớp phân tích chỉ đọc. Sự cố live phải có thời điểm, dịch vụ/môi trường và tác động; tên “fix bug” chưa đủ. Module mới chưa mặc nhiên là sản phẩm độc lập. Owner/status/due gốc giữ ở Sheet.

| STT nguồn | BU | Đầu việc | Luồng đề xuất |
|---|---|---|---|
| 1 | XECA | Triển khai nâng cấp phiên bản Node để vá lỗ hổng bảo mật | Nâng cấp kỹ thuật |
| 2 | XECA | Cập nhật hệ thống theo tài liệu của team XECA, phục vụ vận chuyển hàng phối hợp với nhà xe | Tính năng / tích hợp |
| 3 | XECA | Tích hợp API tra cứu MST FPT & kho dữ liệu MST | Tính năng / tích hợp |
| 4 | XECA | Fix bug liên quan ảnh với cổng thanh toán Jetpay | Lỗi sản phẩm; chưa đủ căn cứ gọi sự cố live |
| 5 | LBRC | Triển khai bot Hermes | Triển khai / vận hành bot; cần tách phạm vi |
| 6 | LBRC | Triển khai App Saleman đi tuyến cho toàn kênh: fix bug, nâng cấp tính năng, báo cáo | Gói hỗn hợp: lỗi + tính năng + báo cáo |
| 7 | LBRC | Nâng cấp App Ship | Nâng cấp app; cần tách kỹ thuật / tính năng |
| 8 | LBRC | Làm tính năng QR theo thông tin đơn hàng | Tính năng |
| 9 | LBRC | Dựng dashboard báo cáo CPM cho kênh MT, BTNET | Tính năng báo cáo |
| 10 | LBRC | Fix lỗi bot Zalo để triển khai Chị BTNET | Lỗi sản phẩm |
| 11 | LBRC | Kết nối với hệ thống mới của VNPOST | Tích hợp nhiều giai đoạn |
| 12 | LBRC | Liên hệ tích hợp MI Invoice để xuất hóa đơn trực tiếp từ BTNET Core | Tích hợp / phụ thuộc đối tác |
| 13 | LBRC | Kiểm soát rủi ro tồn kho theo PO | Tính năng |
| 14 | LBRC | App cho LBROS | Sản phẩm / module mới; làm rõ phạm vi |
| 15 | LBRC | Xây dựng tính năng/báo cáo hỗ trợ số hóa cho bộ phận Điều phối kho vận | Khám phá nhu cầu / tính năng |
| 16 | LBRC | Kế hoạch đặt hàng OEM | Làm rõ phần Tech của kế hoạch nghiệp vụ |
| 17 | IBS HI | Theo dõi tiến độ các việc Sơn phụ trách (phối hợp chuyển đổi số IBS) | Trách nhiệm PM định kỳ |
| 18 | IBS HI | Chủ động đôn đốc các việc chậm và vướng mắc | Trách nhiệm PM định kỳ |
| 19 | IBS HI | Hỗ trợ Sơn giải quyết vấn đề kỹ thuật, phối hợp liên bộ phận | Trách nhiệm phối hợp định kỳ |
| 20 | IBS HI | Tổng hợp tiến độ, rủi ro và đề xuất xử lý cho IBS | Báo cáo điều hành định kỳ |
| 21 | IBS HI | Thu thập yêu cầu nghiệp vụ cho tất cả các bot: nghiệp vụ, đầu mối, dữ liệu đầu vào và đầu ra | Thu thập / xác nhận yêu cầu |
| 22 | IBS HI | Phát hành file hướng dẫn sử dụng bot dành riêng cho nhà máy IBS HI, tham khảo HDSD của các BU khác | Tài liệu / đào tạo sử dụng |
| 23 | IBS HI | Tổng hợp các module đã và đang xây dựng, phục vụ tính giá trị hợp đồng của IPT và IBS HI | Hồ sơ dịch vụ / hợp đồng |
| 24 | IBS HI | Hỗ trợ các bộ phận tương tác với bot, kiểm tra câu trả lời, ghi nhận góp ý và vướng mắc | Hỗ trợ người dùng |
| 25 | IBS HI | Tìm hiểu chức năng liên phòng: cách các bot trao đổi với nhau | Nghiên cứu / thử nghiệm |
| 26 | IBS HI | Tiếp nhận yêu cầu chỉnh sửa hệ thống từ người dùng trong quá trình nhập liệu, chuyển dev xử lý | Hỗ trợ / intake chỉnh sửa |
| 27 | IBS HI | Setup, cấu hình các bot và skill, đảm bảo yêu cầu của người dùng được xử lý thông suốt | Thay đổi cấu hình / skill bot |
| 28 | IBS HI | Rà soát dữ liệu hệ thống ERP, IBS One cùng các bộ phận nghiệp vụ | Đối soát chất lượng dữ liệu |
| 29 | LBRC | Làm tính năng tra cứu MST cho BTNET Core | Tính năng / tích hợp |
| 30 | LBRC | Thêm tính năng chỉ đường cho App Saleman | Tính năng |
| 31 | LBRC | Thêm filter xem theo BĐT tỉnh mới ở các báo cáo trên BT Chain | Tính năng |
| 32 | LBRC | Nâng cấp lịch sử chấm công/viếng thăm App Saleman và báo cáo viếng thăm/chấm công BTNET Core | Tính năng liên hệ thống |
| 33 | XECA | Nâng cấp Fastify, JWT | Nâng cấp kỹ thuật |
| 34 | IBS HI | Trợ lý kế toán — đã có tài liệu yêu cầu chi tiết | Năng lực / module mới cần làm rõ |
| 35 | IBS HI | HCNS: nhân sự, HĐ, sổ LĐ, lương/BH/thuế; web đã tính, chưa lồng lệnh vào-ra; lương/công chưa chuẩn | Năng lực / module mới + lỗi dữ liệu |
| 36 | IBS HI | Sản xuất: nghiệp vụ liên phòng, chuyển xưởng, nhắc/giao việc, báo deadline | Năng lực / module mới |
| 37 | IBS HI | TK/SX/QAQC: OCR đọc bản vẽ; Cường làm trước OCR + index dữ liệu mới + tính token | Năng lực OCR / dữ liệu; chuyên gia nghiệm thu |
| 38 | IBS HI | Thiết bị: danh mục tài sản/TB; điều chuyển, văn bản bàn giao, hiện trạng; form sẵn cho BP | Năng lực / module mới |
| 39 | IBS HI | KTKT nhánh mua: PR và theo dõi nhu cầu; hỏi giá — so sánh — giải trình; HĐ/PO; biên bản giao nhận | Năng lực / module mới |
| 40 | IBS HI | KTKH nhánh a Sâm — chưa: dự toán, bóc tách, chào thầu, khoán; luồng bản vẽ → thiết kế → bóc tách → báo khách → duyệt → băm | Năng lực / module mới |
| 41 | XECA | Upgrade packages theo npm audit | Nâng cấp kỹ thuật |
| 42 | XECA | Lỗi hiển thị tên điểm đón trong khai báo điểm đón theo tuyến/chuyến | Lỗi sản phẩm |
| 43 | LBRC | Cập nhật chỉ tiêu theo BĐT mới trên báo cáo BT Chain | Yêu cầu dịch vụ / cập nhật dữ liệu |
| 44 | IBS HI | Move bot về máy chủ Local IBS HI; chuyển đổi hạ tầng cứng IBS HI | Chuyển hạ tầng |
| 45 | LBRC | In phiếu xuất kho thêm hạn sử dụng, số lô, vị trí | Tính năng |

## 4. Hồ sơ còn phải nối khi triển khai

1. Telegram tin gốc và ledger ticket của từng BU: hiện lượt scan chưa đọc đầy đủ; không báo đã kết nối mọi yêu cầu.
2. Đối soát lịch sử Jira một lần đến mốc chuyển, gồm khoảng trống sau tháng 3 và loại việc ngoài Bug; tuyến intake mới qua bot LBRC Xeca. Giữ các kênh cảnh báo, quyền repo và full SHA của từng ca sửa/nâng cấp; không cần xây connector Jira thường trực.
3. Danh mục product/service đúng chủ, môi trường, nhóm khách, bên nghiệm thu, lịch trực và SLA có hiệu lực.
4. Ánh xạ giờ khả dụng, việc đã cam kết và tải hỗ trợ thực; không dùng 184 giờ tự khai làm công suất chắc chắn.
5. Chủ dịch vụ/khách ký phạm vi, nội dung nào được nhận vào LibeTech, thời điểm cập nhật nguồn. Quyền user đọc Vault không tự cấp quyền tương tự cho bot.
6. Source-of-truth migration theo project; giữ Sheet và các Vault gốc. Các hồ sơ sản xuất/nhân sự/ERP của IBS HI tiếp tục ở hệ IBS HI.

Nguồn local trong bảng là con trỏ đã đọc ngày 11/11. Xeca/IBS HI Brain nằm dưới Google Drive My Drive; Liberico Intelligent tại /Users/huyenleduy/Documents/Claude/Projects/Liberico-Intelligent. Phân tích này không phát hành quy chế mới hoặc xác nhận nghiệm thu thay BoM/khách.


## 5. Bổ sung hồ sơ Xeca và quyết định bỏ Jira

Chairman cung cấp hai tệp ngày 11/11 và xác nhận bỏ Jira từ tháng 11, nhận yêu cầu mới qua bot ở **LBRC Xeca**. Đây là quyết định hướng vận hành; chưa phải biên nhận đã đổi cấu hình trên server. Phạm vi cập nhật SPEC chỉ áp Xeca, giữ dữ liệu và Sheet của team.

| Nguồn trực tiếp | Dấu vết kiểm |
|---|---|
| [CSV Jira](</Users/huyenleduy/Library/CloudStorage/GoogleDrive-leduyhuyen@gmail.com/My Drive/LibeTech/Xeca/Jira Bug Issue XECA 1.3.2025 - 3.4.2026.csv>) | 84.396 bytes; SHA-256 `4445660cf56e87134c7968d457d4dc050e2947d1d30bbf9fa3174636c82ece25`; đọc UTF-8-sig theo vị trí cột để không mất các cột trùng tên |
| [Bản phản biện Xeca](</Users/huyenleduy/Library/CloudStorage/GoogleDrive-leduyhuyen@gmail.com/My Drive/LibeTech/Xeca/xeca_critical_review.html>) | 68.079 bytes; SHA-256 `ff4dcf2ef6e44ffd81b7b254e2dd33e4727cac146c0d26ca46490f8832e5a284`; đọc văn bản, không thực thi script; tài liệu đề 05/04/2026 |

### 5.1 Số đo từ CSV — fact về snapshot, không phải trạng thái hiện tại

- 76 dòng dữ liệu, 76 Issue key duy nhất; tất cả Issue Type = Bug. 72 Closed, 2 In Progress, 2 Backlog.
- Priority: Highest 34, High 13, Medium 7, Low 21, Minor 1. Đây là mức gán trong nguồn cũ, chưa đo lại impact/severity hôm nay.
- 4 dòng thiếu Assignee; 75 dòng thiếu Due Date. Không dùng để chấm trễ hoặc năng suất cá nhân.
- Created: 01/05/2024–30/03/2026; Updated: 06/01/2026–30/03/2026; 72 giá trị Resolved: 09/05/2024–03/03/2026. Chuỗi nguồn theo ngày/tháng/năm, không nêu timezone. Tên tệp “1.3.2025 - 3.4.2026” không trùng khoảng Created thực tế, nên chưa biết chính xác bộ lọc xuất.
- 12 cột Comment với 124 ô có nội dung; 6 cột Attachment với 108 tham chiếu. Các số này là số ô/tham chiếu, không khẳng định 108 tệp duy nhất đã lưu/đọc. Chưa có changelog đầy đủ hoặc nội dung attachment xác minh.
- Bốn phiếu chưa Closed ở snapshot: **XECA2023-602, 540, 657, 579**. Cần nguồn mới xác nhận; không chuyển thẳng thành bốn việc mở tháng 11. Các mã 740/741 trong kế hoạch tháng 11 không có ở tập này.

### 5.2 Các ví dụ làm rõ chức năng PM/điều hành

| Ca nguồn | Điều đọc được | Năng lực hệ thống cần có |
|---|---|---|
| 602 — hosting SEOLOVER | Nguồn báo lỗi lặp; comments trao đổi nhà cung cấp, cấu hình, mua hosting, chuyển WordPress và phối hợp đổi domain. Trạng thái nguồn In Progress | Một yêu cầu cha và nhiều bước/đối tác; incident, problem và change liên kết; có chủ bước tiếp theo, quyết định mua và bằng chứng phục hồi riêng |
| 540 — tìm SĐT thứ hai ở callcenter | Nhãn Bug/Backlog; thảo luận cho thấy còn bất đồng quy tắc nghiệp vụ và trường hợp trùng số | Làm rõ nhu cầu/tiêu chí trước khi coi là bug hoặc enhancement; lưu ai xác nhận quy tắc và phiên bản |
| 604 — cắt vé khác giá | Nguồn mô tả giao diện chặn nhưng API còn cho phép; trạng thái Closed | Ca kiểm cả giao diện và API; không suy fix từ nhãn đóng. Đây là triệu chứng được báo, chưa kiểm runtime hiện tại |
| 598 — notification iOS | Báo iOS lỗi, Android hoạt động; liệt kê thiết bị thử; trạng thái Closed | Ma trận môi trường/phiên bản/thiết bị và tác động; kiểm người dùng nhận thật, không chỉ tín hiệu gửi |
| 587 — vé đã bán bị tự hủy | Có comment Quân dẫn PR Bitbucket 106 đã merge; trạng thái Closed | Bằng chứng repo có nguồn, nối SHA/build/deploy/UAT; không suy merge bằng đã sửa trên máy khách hoặc tự kết luận nguyên nhân race condition |
| 214 — QR thanh toán sau giảm giá | Comment báo đã sửa, reviewer “pass”, sau đó hỏi đưa lên chợ; trạng thái Closed | Tách review, release/store và sử dụng thật; một lời “pass” chưa đủ thẩm quyền/phạm vi cho nghiệm thu toàn yêu cầu |

### 5.3 Cách sử dụng bản HTML

HTML có khuyến nghị về chất lượng, bảo mật, kiến trúc và lộ trình sản phẩm. Các kết luận nguyên nhân từ triệu chứng Jira, số đo code, điểm 3/10, thời gian thực hiện và mốc loyalty thuộc **bản nhận định tháng 4**, chưa được kiểm bằng repo/runtime hiện tại trong lượt này. Không chuyển các mục “làm ngay” của tài liệu thành lệnh thực thi. Chuyển từng phát hiện thành ứng viên có nguồn, phạm vi ảnh hưởng, giả thuyết, cách kiểm, người xác nhận và phương án; chỉ vào roadmap cam kết khi được xác nhận.

**Hệ quả thiết kế:** intake mới qua bot; AI OS giữ vòng công việc/quyết định/nghiệm thu; Jira chỉ đối soát lịch sử một lần và tra cứu mã cũ. Giữ khoảng trống bằng chứng hiển thị rõ. [SPEC-008 §15](SPEC-008-PM-operating-loop-20261111.md#15-xeca-chuyển-tiếp-nhận-từ-jira-sang-bot--v03) quy định bảo toàn nguồn, tuyến bot và ca XI-01…08. Chưa tạo việc, đổi owner/status/hạn, phát tin hoặc áp dữ liệu lịch sử lên production.
