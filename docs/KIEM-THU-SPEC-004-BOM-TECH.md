---
title: "Bộ ca nghiệm thu SPEC-004 — BoM Tech"
status: draft
authority_domain: BU-platform
as_of: 2026-11-10
---

# Bộ ca nghiệm thu SPEC-004 — BoM Tech

Đây là bộ ca giao cho triển khai và nghiệm thu. Mỗi ca có dữ liệu đầu vào, thao tác và kết quả để đối chiếu. Ca trên hệ thống thật cần quyền dự án và sự tham gia của từng người. [Đặc tả](SPEC-004-bom-tech-phan-cong.md) · [Quy chế dự thảo](QUY-CHE-DU-THAO-BOM-TECH.md).

## Dữ liệu kiểm

- **Bộ tổng hợp trên PostgreSQL riêng.** Tenant T có dự án A và B. Tenant U có dự án C. A có một việc đang làm, người thực hiện P và người nghiệm thu khác P. Ba ghế BoM A1, A2, A3 có tài khoản riêng. A1 và A2 có thể nhận việc. Thêm tài khoản thường, người ngoài phạm vi, bot và một ghế đã hết hiệu lực.
- **Ca đối chiếu thật.** STT 5 Hermes là việc đang triển khai và đang ghi Quân, Phương. Tạo kịch bản *diễn tập* chuyển một phần bàn giao từ Quân sang Phương trên bản sao dữ liệu đã đối soát, có quyền cùng dự án. Bản nguồn giữ nguyên hai tên. BoM chỉ dùng đề xuất thật sau khi xem rõ thay đổi và tự xác nhận. [Bảng việc, dòng STT 5](https://docs.google.com/spreadsheets/d/1Vr1ykZUtwm5Wvj1oAQRjpzMgleDa6Fhu-WiPv-L61Vc/edit#gid=1963754558&range=A6:H6).
- **Hồi quy thật LBRC014.** Dùng SHA `8d05141576bcd4db8e7ab9f1a6b7a0dd9bd360ab`. Biên nhận 10/11 ghi Quân, Phương đọc đúng SHA trong LibeAI và cả hai bị từ chối trong Libe – Xeca. [Biên nhận nền](/Users/huyenleduy/.codex/visualizations/2026/11/08/01a1b963-1ef3-7200-9afc-eb61d28c4805/LibeTech-Team-Tech-readback-20261110.json:6).

## Các ca bắt buộc

| Ca | Thao tác | Đạt khi |
|---|---|---|
| T01 · Danh sách | Đối soát danh sách chính thức, kế hoạch tháng và các tên phụ trách/phối hợp. Thử một bí danh chưa chắc. | Mỗi người có trạng thái rõ. Tên chưa chắc nằm trong hàng chờ. Người phối hợp từ BU khác giữ tư cách riêng. |
| T02 · Mời và ghép | Tạo một lời mời đúng dự án, người nhận kích hoạt, đăng nhập, gửi mã ghép qua tin nhắn riêng với bot. | Đúng một tài khoản và một liên kết hợp lệ, dự án khớp, lưu mốc từng bước và chỉ dùng định danh đã xác minh. |
| T03 · Mã và thu hồi | Dùng lại lời mời đã dùng, thử mã hết hạn, thử ghép từ nhóm và thử lại sau khi thu hồi quyền. | Từng yêu cầu bị từ chối theo lý do phù hợp. Phiên và quyền bot sau thu hồi tuân chính sách, không phát sinh liên kết mới. |
| T04 · Quyền BoM | Tài khoản thường, người ngoài dự án, bot và ghế hết hiệu lực thử tạo hoặc biểu quyết trên cùng hồ sơ. | Từ chối từng ca. BoM có thể thao tác đúng việc trong phạm vi. Nội dung hồ sơ ngoài phạm vi được bảo vệ. |
| T05 · Giao lần đầu | Dùng bản sao STT 15 đang trống chủ. Tạo đề xuất cho một người đủ phạm vi ở chế độ thử. | Trạng thái trước vẫn trống tới khi đủ 3/3. Người được giao nhận đúng đầu ra. Cấu hình giao thật đi theo Q02 khi Quy chế đã chốt. |
| T06 · Hai xác nhận | A1 gửi đề xuất chuyển việc cho A2. A1, A2 xác nhận. | Gửi đề xuất không tự sinh phiếu. Sau hai phiếu, phân công và version vẫn nguyên, giao diện báo 2/3. |
| T07 · Ba xác nhận | A3 xác nhận cùng phiên bản sau T06. | Một phân công hiệu lực và một biên nhận có đúng ba ghế. Người nhận, lý do, đầu ra, hạn và trước–sau khớp đề xuất. |
| T08 · Từ chối | Sau khi có một hoặc hai đồng ý, người còn lại từ chối. | Phiếu kết thúc có lý do. Phân công hiện hành giữ nguyên. |
| T09 · Sửa đề xuất | A3 yêu cầu sửa. Người đề xuất đổi người nhận, hạn hoặc phần trách nhiệm rồi gửi lại. | Phiếu mới về 0/3 và liên kết bản cũ. Yêu cầu xác nhận vào phiên bản cũ bị từ chối. |
| T10 · Hủy, hết hạn | Hủy phiếu chưa áp dụng hoặc để qua thời hạn ghi trên phiếu, rồi thử biểu quyết. | Chặn biểu quyết và giữ người phụ trách cũ. Phiếu đã áp dụng dùng phiếu phân công mới khi cần đổi lại. |
| T11 · Gửi lặp | Lặp lại cùng thao tác bằng cùng khóa và gửi phiếu khác từ cùng một ghế cho phiên bản đó. | Lần thử lại cùng khóa trả kết quả nhất quán. Một ghế chỉ được tính một lựa chọn cuối. |
| T12 · Hai yêu cầu đồng thời | Gửi hai xác nhận cuối đồng thời, thử hai đề xuất dựa trên cùng version công việc. | Chỉ một lần áp dụng cho cùng phiên bản. Đề xuất cạnh tranh dùng version cũ phải đối soát. |
| T13 · Lỗi giữa giao dịch | Mô phỏng lỗi khi ghi biên nhận hoặc cập nhật phần việc thứ hai của đề xuất chia việc. | Cả phân công, biên nhận và sự kiện thay đổi trong giao dịch quay lui. Có thể thử lại an toàn. |
| T14 · Nguồn thay đổi | Sau 2/3, đổi giá trị mẫu trong nguồn thử, quyền người nhận hoặc người giữ ghế. | Phiếu chuyển cần đối soát hoặc trình lại. Lá phiếu cuối không áp nội dung cũ. |
| T15 · Đường ghi cũ | Thử đổi người qua giao diện cũ, API revise và luồng nhập hàng loạt trên việc thuộc pilot. | Đổi phân công đi qua phiếu BoM. Chỉnh sửa hợp lệ không liên quan đến phân công giữ hành vi phù hợp. |
| T16 · Chia phần việc | Chia việc A thành hai phần có đầu ra và chủ rõ. Thử một phần trống chủ và một người ngoài phạm vi. | Phiếu hợp lệ áp cả hai phần cùng lúc. Phiếu thiếu chủ hoặc sai phạm vi bị giữ hoặc từ chối theo lý do. |
| T17 · Tách nghiệm thu | Một người làm được phân lại việc rồi thử tự nghiệm thu đầu ra cũ. Thử đúng người nghiệm thu, sai SHA, sai phiên bản và thiếu bằng chứng. | Các ca xung đột bị từ chối, kể cả người từng thực hiện. Ca đúng tạo đúng một sự kiện cho từng lớp. Giữ lịch sử. |
| T18 · Đóng nguồn | Nguồn đánh dấu hoàn thành hoặc ticket đóng, nhưng thiếu xác nhận người dùng. | Hiển thị trạng thái nguồn và kết quả nghiệm thu riêng. Dữ liệu chấm điểm phản ánh phần thiếu. |
| T19 · Tách BU và tenant | Đọc danh sách, chi tiết, truy cập trực tiếp, export và thử thông báo từ B/C hoặc ghế chưa có phạm vi. | Không lộ nội dung, tiêu đề, mã việc hay tổng số của phạm vi khác. Kết nối PostgreSQL tái sử dụng vẫn tách đúng. |
| T20 · Telegram thật | Từng người mới dùng đúng Telegram đã ghép đọc một hồ sơ được cấp và thử cùng yêu cầu trong nhóm ngoài phạm vi. | Đúng tài khoản, đúng nhóm, đúng mã và phiên bản nguồn. Nhóm ngoài phạm vi bị từ chối mà không kèm hồ sơ. |
| T21 · LBRC014 | Đọc lại hồ sơ qua cổng và dùng lượt thử LibeAI/Libe – Xeca theo phạm vi được cấp. | Kỳ vọng SHA, chứng cứ, trạng thái nguồn, nghiệm thu và tách BU khớp mốc gốc tại `/Users/huyenleduy/.codex/visualizations/2026/11/08/01a1b963-1ef3-7200-9afc-eb61d28c4805/LibeTech-Team-Tech-readback-20261110.json:6` và `/Users/huyenleduy/.codex/visualizations/2026/11/08/01a1b963-1ef3-7200-9afc-eb61d28c4805/LibeTech-SPEC004-source-20261110.json:16`. |
| T22 · Khôi phục | Sao lưu dữ liệu thử, diễn tập nâng và quay bản, rồi kiểm hồ sơ đang chờ và biên nhận đã áp dụng. | Giữ được lịch sử, danh tính, trạng thái phiếu, số lần áp dụng, quyền và các kiểm hồi quy. Có hướng khôi phục được người vận hành xác nhận. |

## Cách ghi kết quả

Chạy baseline `npm test` và `npm run typecheck` trong thư mục LibeTech AI OS. Khi triển khai, bổ sung bộ ca SPEC-004 vào bộ test hiện có và chạy riêng nhánh PostgreSQL bản thử với hai tenant, kết nối đồng thời và kiểm RLS. Trên web, kiểm màn hình 0/3 đến 3/3, từ chối, lỗi phiên và hai dự án. Kết quả Telegram lấy từ lượt gửi thật và phản hồi đúng nhóm.

Mỗi kết quả ghi mã ca, thời điểm giờ Việt Nam, bản build/digest, môi trường, fixture hoặc tham chiếu nguồn, kỳ vọng, quan sát và trạng thái Đạt/Không đạt/Chưa chạy. Chốt kết quả sau khi người kiểm xác nhận. Lưu bản đọc bảng trước–sau cho lát pilot; ghi riêng dữ liệu thử và sự kiện thật. Trạng thái của 22 ca trong tài liệu này là **chờ triển khai và chạy**.
