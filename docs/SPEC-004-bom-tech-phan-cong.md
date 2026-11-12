---
title: "SPEC-004 — BoM Tech, phân công và xác nhận 3/3"
status: draft
authority_domain: BU-platform
as_of: 2026-11-10
---

# SPEC-004 — BoM Tech, phân công và xác nhận 3/3

## 1. Mục tiêu và căn cứ

Chu Hoàng Anh, Quân và Phương Tech là ba thành viên BoM điều hành Team Tech. Mỗi người có thể đề xuất phân công hoặc phân bổ lại phần việc, kể cả giữa ba thành viên BoM. Quyết định phân công có hiệu lực trong AI OS khi đủ ba người xác nhận cùng phiên bản. Quy chế dự thảo tách quyền điều phối, xác nhận đầu việc và nghiệm thu.

Phạm vi đề bài đã được Chairman chốt trong phiên ngày 10/11/2026. Danh mục quyết định khác cần 3/3, cách xử lý vắng mặt và thẩm quyền nhân sự nằm trong [dự thảo Quy chế](QUY-CHE-DU-THAO-BOM-TECH.md). [Đối soát thành viên và 44 đầu việc](DOI-SOAT-TEAM-TECH-20261110.md) là đầu vào xác nhận danh sách và phạm vi.

| Thành phần | Căn cứ hiện tại và việc cần thiết kế |
|---|---|
| Cổng và định danh | Bản đọc ngày 10/11 ghi hai tài khoản đã ghép và chỉ một phạm vi App Saleman. Xem [biên nhận nền](/Users/huyenleduy/.codex/visualizations/2026/11/08/01a1b963-1ef3-7200-9afc-eb61d28c4805/LibeTech-Team-Tech-readback-20261110.json:4). Tái sử dụng lời mời, phiên, liên kết Telegram và giới hạn quyền theo dự án của [SPEC-003](SPEC-003-team-access-evidence-dashboards.md). |
| Phân công | Nhánh `revise` hiện tại đổi người phụ trách cùng SHA, tiêu chí và phiên bản nghiệm thu sau kiểm vai Điều phối. Phạm vi quản trị BoM cần cổng xác nhận riêng, kể cả lối ghi cũ. Caller và nhánh ghi tại `../src/server/service.ts:115` và `../src/server/service.ts:155`, API tại `../src/app/api/v1/[...path]/route.ts:1`. |
| Nghiệm thu | Hai bước hiện kiểm người được giao, vai, phiên bản, SHA và loại bằng chứng. Giữ các điều kiện này khi thêm quyền nghiệm thu cụ thể theo việc. Logic tại `../src/server/service.ts:141`, được gọi qua `../src/server/service.ts:115`. |
| Nguồn | Bảng Đầu việc Tech là nguồn hiện hành của dữ liệu gốc. AI OS quản lý quyết định và phần giao việc nội bộ trong phạm vi pilot. Hai thông tin được hiển thị riêng, cùng mốc đọc nguồn. [Bảng việc](https://docs.google.com/spreadsheets/d/1Vr1ykZUtwm5Wvj1oAQRjpzMgleDa6Fhu-WiPv-L61Vc/edit#gid=1963754558). |

## 2. Yêu cầu nghiệp vụ

| Mã | Yêu cầu |
|---|---|
| P0-01 · Danh sách | BoM đối soát toàn bộ nhân sự tham gia Team Tech theo sơ đồ, kế hoạch tháng và bảng việc. Mỗi người có một hồ sơ với chức năng, phạm vi dự án, mã việc, trạng thái mời/kích hoạt/ghép Telegram và người xác nhận. Danh tính chưa chắc vào hàng chờ. Đầu mối BU và đơn vị sử dụng giữ tư cách riêng. |
| P0-02 · Mời và xác minh | Cấp quyền dự án tối thiểu trước khi tạo lời mời. Dùng lời mời một lần, chuyển riêng, để thành viên tự đặt mật khẩu. Người dùng tạo mã và ghép trong tin nhắn riêng với bot. Kiểm bằng tài khoản thật ở dự án được giao và một ca ngoài phạm vi. Dùng lại các thời hạn và cơ chế thu hồi hiện hữu tại `../src/server/accounts.ts:68` và `../src/server/identity.ts:118`. |
| P0-03 · Vai BoM | Gán đúng ba định danh đã kiểm vào ba ghế BoM có phiên bản và hiệu lực. Tư cách BoM tách khỏi `project_role`, quản trị tài khoản, quyền nhân sự và quyền tại BU khác. Mỗi ghế chỉ thấy hồ sơ quyết định thuộc phạm vi đã duyệt. Khi cần BoM đồng quyết việc thuộc BU khác, dùng phần thông tin điều phối được phép hoặc dừng để xin xác nhận phạm vi. |
| P0-04 · Đề xuất giao việc | Một thành viên BoM đề xuất đổi chủ trì, đổi phần trách nhiệm, chia hoặc gộp phần việc. Luồng giao mới từ hàng chờ được thử theo Q02, bật cho dữ liệu thật sau khi Quy chế chốt. Mỗi lần gửi bao một việc mẹ và các phần việc của nó trong cùng dự án. Phiếu gồm mã/nguồn, người và vai trước–sau, đầu ra, tiêu chí, hạn, lý do, mối phụ thuộc, người nghiệm thu hoặc trạng thái chờ xác nhận. Mỗi đầu ra có một người chủ trì. Các phần có đầu ra rõ và có người chịu trách nhiệm. |
| P0-05 · Xác nhận | Người đề xuất và hai thành viên còn lại thực hiện thao tác xác nhận riêng. Mỗi người chọn Đồng ý, Từ chối hoặc Yêu cầu sửa trên cùng phiên bản. Tại 0–2/3, giữ phân công hiệu lực trước đó. Từ chối hoặc yêu cầu sửa kết thúc vòng xác nhận hiện hành. Nếu trình lại, dùng phiên bản mới với ba xác nhận mới. |
| P0-06 · Áp dụng | Lá phiếu đồng ý thứ ba áp dụng nội dung đã xem trong một giao dịch. Kiểm lại ghế, quyền, phiên bản việc, điều kiện nguồn và người nhận. Lưu phân công trước–sau, ba xác nhận và biên nhận bất biến. Phát thông báo sau khi giao dịch thành công, chống gửi lặp theo biên nhận. |
| P0-07 · Nghiệm thu | BoM xác nhận phạm vi, đầu ra và người nghiệm thu theo nhiệm vụ. Thành viên BoM chỉ nghiệm thu khi có ủy quyền cụ thể và đủ phạm vi dự án. Nghiệm thu kỹ thuật và nghiệp vụ là hai sự kiện riêng. Dùng SHA và phiên bản cho đầu ra mã nguồn, dùng phiên bản tài liệu hoặc gói bằng chứng được định danh cho việc phi mã. Người đã thực hiện phần được nghiệm thu phải tách khỏi vai trò nghiệm thu phần đó, kể cả sau đổi phân công. Giữ nguyên chứng cứ lịch sử. Với đầu ra cần đơn vị sử dụng chấp nhận, lưu xác nhận của đúng đầu mối. |
| P0-08 · Nguồn và bot | Hiển thị cạnh nhau trạng thái nguồn, phân công AI OS và nghiệm thu. Gắn tài liệu nguồn, loại nguồn, mốc đọc, chất lượng và mã việc đã xác nhận. Dùng lại cổng đọc Telegram cho phạm vi đã duyệt. Trong pilot, người dùng xác nhận quyết định trên web đã xác thực. Thiết kế cho phép bot nhắc hoặc đưa liên kết phiếu trong phạm vi người nhận. Quyền xác nhận của con người lấy từ phiên web. Điểm xuất phát là ranh giới đọc trong `../src/server/bridge.ts:30`, caller `../src/app/api/bridge/route.ts:7`, và phiên web tại `../src/server/auth-http.ts:5`. |
| P1-01 · Hàng chờ | Lọc theo việc chưa có người, tên cần đối soát, phiếu đang chờ, hết hạn, nguồn thay đổi hoặc người nhận chưa đủ quyền. Một bảng tổng hợp BoM chỉ hiện metadata đã được cấp. Hiển thị lỗi và bước cần xử lý cho từng trường hợp. |

## 3. Luồng quyết định và hợp đồng triển khai

**Tạo → Gửi → Đang chờ 0/3…2/3 → Áp dụng 3/3.** Nhánh kết thúc khác gồm Từ chối, Cần sửa, Hủy, Hết hạn và Cần đối soát. Các nhánh này lưu lịch sử. Giao diện hiển thị phân công đang hiệu lực, bản đề xuất trước–sau và tiến độ xác nhận. Hành động của BoM xuất phát từ phiên xác thực. Dấu đọc, trả lời trong nhóm và thao tác gửi đề xuất có ý nghĩa riêng với thao tác xác nhận.

Một phiên bản đã gửi đóng băng nội dung, ảnh chụp ba ghế, tập người nhận và phiên bản việc làm căn cứ. Mỗi ghế có một lựa chọn cuối cho phiên bản đó. Khi người đề xuất muốn thay đổi lựa chọn đã gửi, mở phiên bản mới có lịch sử liên kết. Người xác nhận cũng có thể là người nhận trong ca phân công nội bộ. Quy tắc này chỉ áp cho phân công công việc và tách khỏi thẩm quyền nghiệm thu hay quyết định về lợi ích cá nhân.

**Giao dịch và dữ liệu.** Đề xuất lưu trong Z1 của AI OS. Dùng định danh UUID, `tenant_id`, `project_id`, thời gian `timestamptz`, khóa ngoại theo phạm vi và nhật ký bất biến. Có thực thể ghế BoM hiệu lực, phiên bản đề xuất, lựa chọn theo phiên bản–ghế và biên nhận áp dụng. Các phần việc cần tham chiếu cùng việc mẹ. Dùng khóa duy nhất cho một lựa chọn mỗi ghế và một biên nhận mỗi phiên bản, cùng khóa chống lặp của từng lệnh. Phân vai giữ theo dự án và bổ sung quyền thao tác hẹp theo việc. Người Điều phối có thể nhận việc nếu có quyền thực hiện rõ ràng tại dự án. Việc nghiệm thu dựa trên ủy quyền theo đầu ra và người độc lập. Quyền báo cáo hiện có giữ tách biệt.

Tái sử dụng giao dịch có RLS, đọc/khóa bản ghi và kiểm phiên bản từ nền hiện tại. Luồng chốt khóa đề xuất rồi việc theo thứ tự cố định, kiểm lại trạng thái và các ràng buộc. Nếu hai phiếu cùng đến, chỉ giao dịch đầu thỏa điều kiện có biên nhận. Phiếu còn lại trả trạng thái đã áp dụng hoặc cần đối soát. Lỗi ghi ở bất kỳ bước nào làm giao dịch quay lui. Nếu có nhiều phiếu cùng dựa trên một phiên bản việc, sau khi một phiếu áp dụng các phiếu còn lại phải dựa lại trên phiên bản mới. Cơ sở tái sử dụng nằm tại `../src/server/db.ts:29` và `../src/server/service.ts:57`, caller tại `../src/server/service.ts:115`.

Chặn ghi thay người hoặc phần trách nhiệm qua màn hình sửa hồ sơ, API `revise`, nhập hàng loạt và các đường ghi cũ đối với việc thuộc pilot. Luồng 3/3 là điểm áp dụng duy nhất của thay đổi phân công đó. Khi chỉ đổi người, tăng version ghi giao dịch và giữ nguyên SHA, revision đầu ra, trạng thái nguồn và lịch sử nghiệm thu. Nếu người nhận trùng người nghiệm thu hoặc điều kiện bàn giao đã thay đổi, đưa phiếu về đối soát. Việc đã hoàn thành dùng quy trình mở phiên bản riêng khi cần sửa đầu ra. Kiểm nhánh ghi hiện hành tại `../src/server/service.ts:155`, caller tại `../src/server/service.ts:115`.

**Đối chiếu nguồn.** Khóa tham chiếu nguồn cùng BU, mã hoặc vị trí dòng đã đối soát. Kiểm lại các trường liên quan trước lần xác nhận cuối. Nếu nguồn khác bản đã xem hoặc chưa đọc được theo quy trình đã chốt, giữ phiếu chờ đối soát. Bảng nguồn và AI OS là hai hệ riêng. Biên nhận ghi mốc đối chiếu và phần việc áp dụng trong AI OS. Nếu nguồn thay đổi sau mốc đó, tạo ngoại lệ cho BoM, giữ cả hai lịch sử. Phạm vi thiết kế gồm đọc bảng và giữ metadata Tech IBS HI đã duyệt. Căn cứ nguồn tại `/Users/huyenleduy/.codex/visualizations/2026/11/08/01a1b963-1ef3-7200-9afc-eb61d28c4805/LibeTech-SPEC004-source-20261110.json:6` và ranh giới IBS HI tại `/Users/huyenleduy/Documents/GitHub/libe-tech/hermes-libetech-priority1/PM-DESIGN-REVIEW-20261107.md:58`.

**Ranh giới kỹ thuật.** REST cho thao tác có người dùng xác thực. RLS theo tenant và dự án ở cả đọc, ghi, danh sách, export và thống kê. Cấm nội dung, ID, tiêu đề và số đếm của hồ sơ ngoài quyền xuất hiện trong lỗi hoặc thông báo. Khóa bí mật và mã kích hoạt nằm ngoài biên nhận. Migration bổ sung có phiên bản, diễn tập sao lưu và phục hồi. Bật tính năng theo dự án. Khi quay phiên bản, giữ lịch sử và ngừng nhận phiếu mới trước khi đổi dịch vụ. Quy tắc áp dụng gồm AR-03, AR-05, AR-06, AR-09, E-DB-04, E-DB-07, E-DB-13, E-SEC-02, E-TEST-01 và E-TEST-04.

## 4. Thứ tự giao và mốc đạt

| Lát | Phạm vi | Điều kiện hoàn thành |
|---|---|---|
| A · Thành viên và dự án | Chốt danh sách Team Tech, mở đúng dự án, mời và xác minh theo người. | Mỗi người trong danh sách đã chốt có trạng thái tài khoản rõ và có ca kiểm đúng/ngoài phạm vi. Các trường hợp chờ tên hoặc phạm vi có người xử lý. |
| B · Phân công 3/3 | Phiếu có phiên bản, ba ghế, kiểm xung đột, biên nhận, API và UI. | Toàn bộ ca P0 trong [bộ ca nghiệm thu](KIEM-THU-SPEC-004-BOM-TECH.md) đạt trên PostgreSQL thử. Ca đồng thời chứng minh một lần áp dụng. |
| C · Pilot một việc thật | Dùng STT 5 đang triển khai để mô phỏng giao lại giữa hai thành viên BoM với phạm vi dự án và đầu ra được xác nhận. Dùng LBRC014 kiểm giữ nguyên hồ sơ. | Đối chiếu màn hình và biên nhận, người phụ trách nguồn giữ nguyên trong đợt thử, SHA LBRC014 và kết quả tách BU khớp. Chỉ người có thẩm quyền xác nhận kết quả nghiệp vụ. |

**Quyết định trước khi mở pilot:** BoM chốt danh sách và phần việc. Chủ dữ liệu duyệt phạm vi dự án và mức metadata cho ba ghế. Chairman chốt các điều khoản Quy chế còn đề xuất và cách xử lý ghế khuyết. Lấy STT 5 làm dữ liệu đầu vào cho diễn tập; việc áp dụng phân công thật cần ba xác nhận trên một đề xuất riêng.
