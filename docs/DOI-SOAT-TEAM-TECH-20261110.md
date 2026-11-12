---
title: "Đối soát Team Tech và bảng việc 10/11/2026"
status: draft
authority_domain: BU-platform
as_of: 2026-11-10
---

# Đối soát Team Tech và bảng việc 10/11/2026

Bản đọc `Đầu việc Tech!A1:I65` sáng 10/11/2026 cho thấy **44 dòng**, trong đó **17 đang triển khai, 12 chưa triển khai, 15 hoàn thành**. Khoảng `A66:A120` trả trống. Trong 29 dòng chưa hoàn thành, 25 dòng để trống hạn. Bảng dưới giữ nguyên người phụ trách, người phối hợp, trạng thái và chuỗi hạn đọc từ nguồn. Tên việc được rút gọn để tra cứu. Các nhánh IBS HI nhạy cảm dùng tên kỹ thuật hoặc mã tham chiếu. [Bảng việc nguồn](https://docs.google.com/spreadsheets/d/1Vr1ykZUtwm5Wvj1oAQRjpzMgleDa6Fhu-WiPv-L61Vc/edit#gid=1963754558).

## Phạm vi điều hành và danh mục dự án

Căn cứ phân công BoM là chỉ đạo trực tiếp của Chairman ngày 10/11/2026 trong phiên Codex LibeTech, tin mở đầu “Hiện nay có rất nhiều dự án theo list PHương gửi”. Bảng thành viên bên dưới phản ánh chỉ đạo này. Các dòng STT tiếp tục phản ánh phân công ở bảng việc. Khi chia lại việc, dùng phiếu BoM 3/3 theo SPEC-004. Quyền trên cổng xét riêng theo dự án và phạm vi dữ liệu. [SPEC-004](SPEC-004-bom-tech-phan-cong.md).

Checklist Phương gửi trong LibeAI là bản 29/10 theo BU. Bản đang dùng có 44 **đầu việc** gồm LBRC 17, Xeca 7 và IBS HI 20, qua lượt đọc `Đầu việc Tech!A1:H65` ngày 10/11. Tệp `Tong hop Platform.xlsx` trong LibeAI Share bổ sung tên nền tảng, ví dụ BTNET Core, BT Chain, LBROS, App Thành viên và các nền tảng IBS HI. Mốc kiểm quyền trên cổng dùng App Saleman làm pilot. [Checklist Phương gửi](https://docs.google.com/spreadsheets/d/1mJ6ToV2a9N9_Dixkbhwco8rx54hlxONB/edit) · [Bảng việc đang dùng](https://docs.google.com/spreadsheets/d/1Vr1ykZUtwm5Wvj1oAQRjpzMgleDa6Fhu-WiPv-L61Vc/edit#gid=1963754558) · [Biên nhận quyền ngày 10/11](/Users/huyenleduy/.codex/visualizations/2026/11/08/01a1b963-1ef3-7200-9afc-eb61d28c4805/LibeTech-Team-Tech-readback-20261110.json:4).

Khi lập danh mục trên AI OS, mỗi dự án cần ghi BU, tên chuẩn, nền tảng hoặc repo liên quan, vai trò từng người, STT tham chiếu và phạm vi dữ liệu. Ví dụ STT 12 là tích hợp MI Invoice với BTNET Core, còn STT 43 là thay đổi báo cáo BT Chain. Ánh xạ chương trình số hóa thành viên BTNET với App Thành viên, cũng như ánh xạ IBS HI 1 với các tên nền tảng IBS HI trong tệp tổng hợp, vẫn cần đối chiếu trước khi cấp quyền. Phạm vi MRO theo phân công của Chairman và cần mã dự án cùng đầu mối dữ liệu khi đưa lên cổng.

## Danh sách đối soát thành viên

Sơ đồ V260915 ghi đội BU7 gồm Phương Tech, Chu Hoàng Anh và Quân. Kế hoạch tháng 11 còn ghi ThắngNM, LinhHT, Sơn và Cường theo đầu việc. Phạm vi thành viên dự án và phạm vi phê duyệt của BoM được xét riêng. [Sơ đồ V260915](</Users/huyenleduy/Documents/Claude/Projects/Liberico-Intelligent/1_Memory/governance/SoDoToChuc_CNNV_V260915_15.09.2026_CANONICAL.md:57>) · [Kế hoạch tháng 11, tab XAC_NHAN](</Users/huyenleduy/Library/CloudStorage/GoogleDrive-leduyhuyen@gmail.com/My Drive/LibeTech/LibeAI Share /Kế hoạch, nhiệm vụ/LibeTech_NhiemVu_KeHoach_KPI_2026-11.xlsx>) · [Danh bạ đối chiếu](/Users/huyenleduy/Documents/GitHub/libe-tech/hermes-libetech-priority1/plugin/registry.json:210).

| Người | Chức năng và đầu ra | STT còn mở theo nguồn | Tài khoản và việc cần chốt |
|---|---|---|---|
| **Chu Hoàng Anh** · Hoàng Anh / Chu Hoang | Ghế BoM. Phụ trách dự án IBS HI, chuyển đổi số cho thành viên BTNET và nền tảng kinh doanh MRO. Phối hợp triển khai nền tảng cho dự án BTNET. | Phụ trách 17–20, 34–40, 44. Tên “a Chu” xuất hiện ở phần phối hợp 22–23. Đối chiếu thêm mã dự án cho MRO và chương trình thành viên BTNET. | Đề xuất `hoanganh`. Xác định quyền điều phối và phần thông tin được xem theo từng dự án, gồm phạm vi Tech IBS HI. Với STT 44, xác nhận chủ thực hiện, phạm vi được làm, hạn và phần đang HOLD. |
| **Quân** · QuânTV | Ghế BoM. Phụ trách kỹ thuật, mã nguồn, hạ tầng và bảo trì. Nắm mã nguồn BTNET, Xeca và IBS HI 1. | Phụ trách 2, 41. Đồng phụ trách 5, 11. Phối hợp 36–37, 44. | `quan` đã ghép và kiểm trong LBRC · App Saleman (`/Users/huyenleduy/.codex/visualizations/2026/11/08/01a1b963-1ef3-7200-9afc-eb61d28c4805/LibeTech-Team-Tech-readback-20261110.json:5`). Xác định quyền thực hiện, repo và môi trường theo từng dự án. |
| **Phương Tech** · PhươngHV / Phương AiTec | Ghế BoM. Quản lý dự án chung, điều phối và vận hành. Trực tiếp phụ trách dự án Liberico. Theo dõi sản phẩm, nhà cung cấp và bàn giao trong phạm vi được giao. | Đồng phụ trách 5, 11. Phụ trách 12. Tên “Phương” tại 14 khớp vai trò trong kế hoạch CK-14, cần xác nhận ánh xạ trước khi nhập. Phối hợp 22, 44. | `phuong` đã ghép và kiểm trong LBRC · App Saleman (`/Users/huyenleduy/.codex/visualizations/2026/11/08/01a1b963-1ef3-7200-9afc-eb61d28c4805/LibeTech-Team-Tech-readback-20261110.json:5`). Tách quyền điều phối tiến độ chung khỏi quyền đọc nội dung và nghiệm thu từng dự án. |
| **ThắngNM** | Tích hợp API và kiểm thử Xeca. Bàn giao phiên bản API, ca hồi quy và lỗi còn mở. | Phụ trách 3, phối hợp 41. STT 4, 33, 42 thuộc lịch sử hoàn thành. | Đề xuất `thangnm`, vai Thực hiện trong dự án tích hợp Xeca được duyệt. Kế hoạch cũ ghi CK-32…36; đối soát theo nội dung trước khi ghép. |
| **LinhHT** | Công cụ và báo cáo vận hành LBRC, đối chiếu đầu ra với đầu mối nghiệp vụ. | Phụ trách 16. STT 7–9, 13 đã hoàn thành. | Đề xuất `linhht` trong dự án OEM. STT 43 ghi “Linh”, chờ xác minh danh tính và phạm vi BT Chain. |
| **Sơn IBS HI** | Thu thập yêu cầu, hỗ trợ người dùng bot và điều phối tiếp nhận lỗi theo phạm vi IBS HI. | Phụ trách 21, đồng phụ trách 22, 24–28. Phối hợp 17–20, 34–36, 38–40. | Theo dõi như đầu mối IBS HI cho tới khi BoM và chủ dự án xác nhận hình thức tham gia và phạm vi. |
| **Cường** | Cấu hình và hỗ trợ bot, tài liệu và rà soát dữ liệu IBS HI theo phạm vi được giao. | Đồng phụ trách 22, 24–28. Phối hợp 34–40. | Theo dõi như đầu mối IBS HI. Phạm vi tài khoản và dữ liệu cần chủ dự án duyệt. |
| **Chairman** | Quản trị tài khoản và thẩm quyền tổ chức theo phân cấp. | Đầu mối các quyết định vượt phạm vi BoM Tech. | Tách phiên quản trị khỏi ba ghế xác nhận. |

Cột phối hợp ghi Toàn, Hưng và các đầu mối nghiệp vụ theo việc. Ví dụ dòng vận chuyển Xeca tại `/Users/huyenleduy/.codex/visualizations/2026/11/08/01a1b963-1ef3-7200-9afc-eb61d28c4805/LibeTech-SPEC004-source-20261110.json:10`. Danh sách Team Tech cuối cùng do BoM đối soát và người có thẩm quyền xác nhận. Ai có nhiệm vụ nhưng chưa có danh tính chuẩn được giữ trong hàng chờ, gồm biến thể “Linh” ở STT 31 và 43.

## Hàng chờ BoM trước khi phân công

| Việc | Nội dung cần chốt |
|---|---|
| STT 15 · Số hóa Điều phối kho vận | Chưa ghi người phụ trách. Làm rõ đầu ra, phạm vi dự án và người nhận trước khi trình giao việc. |
| STT 43 · Chỉ tiêu BT Chain | Xác minh “Linh” có phải LinhHT hoặc người khác. Nguồn ghi hạn 15/11 trong ghi chú. Giữ STT 43 riêng với LBRC015 đã hoàn thành. |
| STT 5 và 11 · Hermes và VNPOST | Cần BoM xác nhận người chủ trì, phần phối hợp, ca kiểm, hạn và tỷ lệ phân bổ nếu có. Căn cứ nguồn tại `/Users/huyenleduy/.codex/visualizations/2026/11/08/01a1b963-1ef3-7200-9afc-eb61d28c4805/LibeTech-SPEC004-source-20261110.json:12` và `/Users/huyenleduy/.codex/visualizations/2026/11/08/01a1b963-1ef3-7200-9afc-eb61d28c4805/LibeTech-SPEC004-source-20261110.json:13`. |
| STT 21 · Hồ sơ yêu cầu bot IBS HI | Sơn là người phụ trách theo bảng. Chu điều phối việc đôn đốc và báo vướng. Xác nhận mốc mới và đầu ra từng bộ phận theo phạm vi được phép. |
| STT 44 · Chuyển bot về máy chủ nội bộ | Nguồn ghi Chu là đầu mối, Quân/Phương phối hợp và HOLD TCKT (`/Users/huyenleduy/.codex/visualizations/2026/11/08/01a1b963-1ef3-7200-9afc-eb61d28c4805/LibeTech-SPEC004-source-20261110.json:19`). Chốt người thực hiện theo hạng mục và phạm vi được làm trước khi giao lại. |
| Các dòng chưa có hạn | Thống nhất mốc với người nhận và bên nghiệm thu. Hiển thị “chưa có hạn” cho tới khi có xác nhận nguồn hoặc quyết định hiệu lực. |

## Chỉ mục 44 dòng

| STT · vị trí khi đọc | BU | Đầu việc / mã nguồn | Phụ trách nguồn | Phối hợp nguồn | Trạng thái nguồn | Hạn nguồn |
|---|---|---|---|---|---|---|
| 1 · A2:H2 | XECA | Nâng Node Xeca | QuânTV | — | Hoàn thành | 04/11/2026 |
| 2 · A3:H3 | XECA | Vận chuyển hàng phối hợp nhà xe | QuânTV | Toàn, Hưng (Team XECA) | Đang triển khai | 11/11/2026 |
| 3 · A4:H4 | XECA | API MST FPT và kho dữ liệu MST | ThắngNM | Hưng | Đang triển khai | — |
| 4 · A5:H5 | XECA | Lỗi ảnh Jetpay | ThắngNM | Hưng | Hoàn thành | — |
| 5 · A6:H6 | LBRC | Triển khai bot Hermes | QuânTV, PhươngHV | Các bộ phận | Đang triển khai | — |
| 6 · A7:H7 | LBRC | Triển khai App Saleman đi tuyến | PhươngHV | Sale, Care | Hoàn thành | 04/11/2026 |
| 7 · A8:H8 | LBRC | Nâng cấp App Ship | LinhHT | ĐPKV | Hoàn thành | 04/11/2026 |
| 8 · A9:H9 | LBRC | QR thông tin đơn hàng | LinhHT | TCKT, Care | Hoàn thành | 31/10/2026 |
| 9 · A10:H10 | LBRC | Dashboard CPM cho MT và BTNET | LinhHT, PhươngHV, QuânTV | Care | Hoàn thành | 19/11/2026 |
| 10 · A11:H11 | LBRC | Bot Zalo Chị BTNET | PhươngHV, QuânTV | MKT, Care | Hoàn thành | 31/10/2026 |
| 11 · A12:H12 | LBRC | Kết nối VNPOST | QuânTV, PhươngHV | VNPOST | Đang triển khai | — |
| 12 · A13:H13 | LBRC | Kết nối MI Invoice từ BTNET Core | PhươngHV | MISA | Đang triển khai | — |
| 13 · A14:H14 | LBRC | Kiểm soát rủi ro tồn kho theo PO | LinhHT | Sourcing | Hoàn thành | 31/10/2026 |
| 14 · A15:H15 | LBRC | App LBROS | Phương | — | Đang triển khai | — |
| 15 · A16:H16 | LBRC | Tính năng và báo cáo cho Điều phối kho vận | Chưa ghi | — | Chưa triển khai | — |
| 16 · A17:H17 | LBRC | Kế hoạch đặt hàng OEM | LinhHT | — | Chưa triển khai | — |
| 17 · A18:H18 | IBS HI | Theo dõi tiến độ phần Sơn phụ trách | Hoàng Anh | Sơn | Đang triển khai | — |
| 18 · A19:H19 | IBS HI | Đôn đốc việc chậm và vướng mắc | Hoàng Anh | Sơn | Đang triển khai | — |
| 19 · A20:H20 | IBS HI | Hỗ trợ kỹ thuật và phối hợp liên bộ phận | Hoàng Anh | Sơn | Đang triển khai | — |
| 20 · A21:H21 | IBS HI | Tổng hợp tiến độ, rủi ro và đề xuất | Hoàng Anh | Sơn | Đang triển khai | — |
| 21 · A22:H22 | IBS HI | Thu thập yêu cầu nghiệp vụ bot | Sơn | Trưởng các bộ phận | Đang triển khai | — |
| 22 · A23:H23 | IBS HI | Hướng dẫn sử dụng bot | Sơn, Cường | PhươngHV, a Chu | Chưa triển khai | — |
| 23 · A24:H24 | IBS HI | Đối soát danh mục module | Sơn, Cường | PhươngHV, a Chu | Hoàn thành | — |
| 24 · A25:H25 | IBS HI | Hỗ trợ người dùng bot và ghi nhận góp ý | Sơn, Cường | Các bộ phận | Đang triển khai | — |
| 25 · A26:H26 | IBS HI | Khảo sát trao đổi bot liên phòng | Sơn, Cường | — | Chưa triển khai | — |
| 26 · A27:H27 | IBS HI | Tiếp nhận yêu cầu sửa và chuyển dev | Sơn, Cường | Các bộ phận | Đang triển khai | — |
| 27 · A28:H28 | IBS HI | Cấu hình bot và skill | Sơn, Cường | — | Đang triển khai | — |
| 28 · A29:H29 | IBS HI | Rà soát dữ liệu ERP/IBS One | Sơn, Cường | Các bộ phận | Đang triển khai | — |
| 29 · A30:H30 | LBRC | Tra cứu MST BTNET Core · LBRC013 | QuânTV | PhươngHV | Hoàn thành | 2026-11-12 |
| 30 · A31:H31 | LBRC | Chỉ đường App Saleman · LBRC014 | QuânTV | PhươngHV | Hoàn thành | 2026-11-06 |
| 31 · A32:H32 | LBRC | Bộ lọc BĐT tỉnh mới trên BT Chain · LBRC015 | QuânTV | Linh | Hoàn thành | 2026-11-10 |
| 32 · A33:H33 | LBRC | Lịch sử chấm công, viếng thăm và báo cáo · LBRC016 | QuânTV | PhươngHV | Hoàn thành | 2026-11-11 |
| 33 · A34:H34 | XECA | Nâng Fastify và JWT · XECA005 | QuânTV | ThắngNM | Hoàn thành | 2026-11-14 |
| 34 · A35:H35 | IBS HI | Nhánh Tech IBSHI-CHU-01 | Chu Hoang | Sơn, Cường | Chưa triển khai | — |
| 35 · A36:H36 | IBS HI | Nhánh Tech IBSHI-CHU-02 | Chu Hoang | Sơn, Cường | Chưa triển khai | — |
| 36 · A37:H37 | IBS HI | Nhánh Tech IBSHI-CHU-03 | Chu Hoang | QuânTV, Sơn, Cường | Chưa triển khai | — |
| 37 · A38:H38 | IBS HI | Nhánh Tech IBSHI-CHU-04 | Chu Hoang | Cường, QuânTV | Chưa triển khai | — |
| 38 · A39:H39 | IBS HI | Nhánh Tech IBSHI-CHU-05 | Chu Hoang | Sơn, Cường | Chưa triển khai | — |
| 39 · A40:H40 | IBS HI | Nhánh Tech IBSHI-CHU-06 | Chu Hoang | Sơn, Cường | Chưa triển khai | — |
| 40 · A41:H41 | IBS HI | Nhánh Tech IBSHI-CHU-07 | Chu Hoang | Sơn, Cường | Chưa triển khai | — |
| 41 · A42:H42 | XECA | Nâng các gói phụ thuộc Xeca · XECA006 | QuânTV | ThắngNM | Đang triển khai | 21/11/2026 |
| 42 · A43:H43 | XECA | Tên điểm đón khi khai báo tuyến/chuyến | QuânTV | ThắngNM | Hoàn thành | 11/09/2026 |
| 43 · A44:H44 | LBRC | Chỉ tiêu BĐT mới trên BT Chain | Linh | — | Đang triển khai | 11/15/2026 |
| 44 · A45:H45 | IBS HI | Chuyển bot về máy chủ nội bộ IBS HI · IBSHI-HL-01 | Chu Hoang | QuânTV, PhươngHV | Chưa triển khai | 13/11/2026 |

Hạn giữ theo chuỗi nguồn. Với dạng dễ nhầm ngày/tháng, dùng ghi chú và hỏi chủ việc trước khi chuẩn hóa. Mã trong cột ghi chú là tham chiếu đã quan sát. Khi chưa có mã bền, dùng STT và vị trí kèm tiêu đề, BU, mốc đọc; việc chuyển thành hồ sơ AI OS cần BoM xác nhận ánh xạ. [Quy trình phân công và nghiệm thu](SPEC-004-bom-tech-phan-cong.md).
