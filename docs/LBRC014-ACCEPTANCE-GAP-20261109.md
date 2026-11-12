# LBRC014 — Đối soát nguồn hiện tại và bằng chứng nghiệm thu

Thời điểm đối soát: sáng 09/11/2026, giờ Việt Nam; thời điểm từng lần đọc ghi trong biên nhận. Phạm vi: GitHub `liberico-ai/btnet-saleman`, bảng Google Sheets đang dùng và hồ sơ đối soát đã lưu. Chỉ đọc; không đổi bảng việc, code, quyền, trạng thái nghiệm thu hoặc dữ liệu AI OS. #fact

## Kết luận

**Bảng vận hành báo “Hoàn thành / nghiệm thu đạt, đóng”; mã chức năng có thật và đã nằm trong `main`. Tuy nhiên bộ nguồn đã đọc chưa đủ nối lời nghiệm thu đó với đúng bản cài, kết quả UAT và xác nhận review.** Giữ nguyên trạng thái của team; ghi riêng đánh giá “cần bổ sung bằng chứng nghiệm thu đúng phiên bản”. #fact/#inference

Nguồn trực tiếp: [dòng LBRC014 trên Sheets](https://docs.google.com/spreadsheets/d/1Vr1ykZUtwm5Wvj1oAQRjpzMgleDa6Fhu-WiPv-L61Vc/edit#gid=1963754558&range=A31:H31), [commit chức năng](https://github.com/liberico-ai/btnet-saleman/commit/8d05141576bcd4db8e7ab9f1a6b7a0dd9bd360ab), [đặc tả tại SHA main đã đọc](https://github.com/liberico-ai/btnet-saleman/blob/5b38598de8bca1b258be7ee4b7086a993810478a/docs/dms-plan/SPEC-chi-duong-diem-ban.md). Biên nhận lưu tại `lbrc014-20261109/MANIFEST.json:1`.

## Những gì đã đối soát được

| Nguồn | Quan sát hiện tại | Ý nghĩa và giới hạn |
|---|---|---|
| Sheets — `Đầu việc Tech!A31:H31`, STT 30 | Đầu việc “Thêm tính năng chỉ đường cho App Saleman”; phụ trách QuânTV; phối hợp PhươngHV; hạn 06/11; trạng thái Hoàn thành. Ghi chú: “LBRC014. Spec SPEC-chi-duong-diem-ban.md. Quân 6/11: chờ nghiệm thu. PhươngHV 7/11: nghiệm thu đạt, đóng.” | Có lời báo nghiệm thu từ nguồn vận hành. Dòng này chưa ghi SHA/bản cài, tiêu chí, kết quả từng ca hoặc đường dẫn biên bản. Nguồn: `lbrc014-20261109/workbook-current.json:1`. #fact |
| Độ mới bảng | Bản Google Sheets có thời điểm sửa toàn tệp 09/11 lúc 09:18:16; lần đọc lại dòng LBRC014 lúc 09:39 vẫn trả nội dung trên. Không có comment được API trả về; không có note/hyperlink ở các ô được đọc. | Thời điểm sửa tệp không xác định ai sửa hoặc khi nào sửa riêng dòng LBRC014. Bản Excel nguồn cũ có ID khác, không dùng làm hiện trạng. Nguồn: `lbrc014-20261109/workbook-current.json:1`. #fact |
| Commit triển khai | `8d05141576bcd4db8e7ab9f1a6b7a0dd9bd360ab`, ngày 05/11; thay đổi ba màn hình, dịch vụ bản đồ, widget chỉ đường và tệp test. | Đọc được mã cụ thể cho chức năng. Nguồn: `lbrc014-20261109/commit.json:1`. #fact |
| Main hiện tại | `5b38598de8bca1b258be7ee4b7086a993810478a`; compare xác nhận commit triển khai là tổ tiên, main đi trước 11 commit. `pubspec.yaml` khai `1.0.27+29`. | Phiên bản trong nguồn không chứng minh bản đã phát hành hoặc đang cài trên thiết bị. Nguồn: `lbrc014-20261109/main.json:1`, `lbrc014-20261109/compare.json:1`, `lbrc014-20261109/version-main.txt:19`. #fact |
| Tính năng trên mã hiện tại | Ba màn Hôm nay, Khách hàng, Chi tiết KH vẫn gọi `DirectionsButton`. Widget và tệp test có blob hash trùng commit triển khai. | Mã không bị mất qua các cập nhật sau; chưa phải thử trên app thật. Nguồn: `lbrc014-20261109/current-code-excerpts.json:1`, `lbrc014-20261109/directions-main.json:1`, `lbrc014-20261109/test-main.json:1`. #fact |
| Đặc tả | Được thêm ngày 06/11 tại `07348b551ca5101815c0d05bd9bff302832dad71`, sau code; bản hiện tại vẫn ghi Draft, chờ Arch Lead review. | Chưa tìm thấy xác nhận hoàn tất review cho đặc tả/mã này trong các nguồn đã đọc. Nguồn: `lbrc014-20261109/spec-main.txt:3`, `lbrc014-20261109/spec-main.txt:80`, `lbrc014-20261109/history-spec.json:1`. #fact/#inference |
| Test/CI | Có 9 ca unit/widget trong tệp test, sử dụng hàm tra dữ liệu và mở bản đồ giả lập. SHA triển khai có 0 check runs, 0 workflow runs, 0 status contexts; combined status là pending. SHA main cũng có 0 check runs/workflow runs. | Có mã test; chưa có bằng chứng chạy đạt ở hai SHA này từ GitHub. `pending` với 0 context không chứng minh đang có job chờ. Nguồn: `lbrc014-20261109/test-main.txt:8`, `lbrc014-20261109/checks.json:1`, `lbrc014-20261109/actions.json:1`, `lbrc014-20261109/statuses.json:1`, `lbrc014-20261109/checks-head.json:1`, `lbrc014-20261109/actions-head.json:1`. #fact |
| Review và phát hành | API trả danh sách rỗng cho PR liên kết commit, comment ở commit triển khai/spec, releases, tags và deployments. | Chưa có chứng cứ tương ứng ở các kênh GitHub đã hỏi. Không suy ra team chưa review, chưa cài app hoặc chưa UAT ở kênh khác. Nguồn: `lbrc014-20261109/prs.json:1`, `lbrc014-20261109/implementation-comments.json:1`, `lbrc014-20261109/spec-comments.json:1`, `lbrc014-20261109/releases.json:1`, `lbrc014-20261109/tags.json:1`, `lbrc014-20261109/deployments.json:1`. #fact |

Đã kiểm thêm các cột I:Z tại hàng tiêu đề và dòng LBRC014: API trả trống. Tab phụ Sheet1 được tìm mã LBRC014 trong toàn vùng A1:Z1000 và trả 0 kết quả. Nguồn: `lbrc014-20261109/workbook-extended-scope.json:1`. #fact

Các tài liệu REVIEW_APP, REVIEW_SUMMARY, E2E_PILOT_CHECKLIST và INTEGRATION_NOTES hiện có nói về đợt DMS tháng 6, không tạo bằng chứng nghiệm thu riêng cho thay đổi LBRC014 tháng 11. Nguồn: `lbrc014-20261109/review-app.txt:3`, `lbrc014-20261109/review-summary.txt:1`, `lbrc014-20261109/e2e.txt:1`, `lbrc014-20261109/integration.txt:1`. #fact/#inference

## Năm phần bằng chứng cần bổ sung

Đây là yêu cầu đối soát hồ sơ, không phải kết luận việc chưa được làm. Các đầu mối dưới đây là đề xuất dựa trên bảng hiện tại, không phải giao việc hay cấp quyền mới. #inference

| Thứ tự | Khoảng thiếu | Bằng chứng tối thiểu để đóng khoảng thiếu | Đầu mối đề xuất |
|---|---|---|---|
| 1 | **Review đặc tả và mã** | Xác nhận của người có vai trò Arch/Tech Lead, dẫn bản spec và commit được review, kết quả, ngày, ngoại lệ. Có thể là review commit hoặc biên bản liên kết. Spec hiện tại tự yêu cầu review trước merge. | QuânTV cung cấp hồ sơ; người có vai trò review xác nhận. |
| 2 | **Kết quả kiểm thử trên đúng mã** | Log/báo cáo chạy unit/widget và các kiểm tra build liên quan, ghi full SHA, môi trường/công cụ, thời điểm, exit code/kết quả. Nếu chưa dùng CI, biên nhận chạy có thể thay cho GitHub check nhưng phải truy được về đúng mã. | QuânTV hoặc người thực hiện kiểm thử. |
| 3 | **Bản bàn giao và bản đang cài** | Một bản kê nối full SHA build → version/build number → gói APK/AAB/IPA hoặc mã build Store/TestFlight → nơi phát hành. Kèm bằng chứng phiên bản trên thiết bị nghiệm thu. Chốt rõ bản được nghiệm thu ngày 07/11; không tự gán đó là main mới nhất. | QuânTV/đầu mối phát hành, đối chiếu với PhươngHV. |
| 4 | **UAT thiết bị thật theo spec** | Kết quả trên Android với Google Maps, Android chỉ có trình duyệt và iOS, theo đặc tả nội bộ `lbrc014-20261109/spec-main.txt:82`; ghi bản cài, thiết bị/OS, người thử, ngày, đạt/lỗi, bằng chứng ảnh/video/log phù hợp. Bao phủ ba màn và các nhánh dữ liệu quan trọng ở bảng dưới. | Người kiểm thử và người đại diện sử dụng sản phẩm. |
| 5 | **Xác nhận nghiệm thu có thể truy ngược** | Xác nhận PhươngHV đã nghiệm thu **bản nào**, theo tiêu chí nào, kết quả gì, ngoại lệ gì; dẫn bộ bằng chứng ở trên. Xác định vai trò/phạm vi đại diện nghiệm thu nếu cần đối soát quyền. Bảng hiện chỉ ghi PhươngHV ở cột Phối hợp và lời báo nghiệm thu trong Ghi chú. | PhươngHV/người được giao nghiệm thu dự án. |

Nguồn của tiêu chí review và thiết bị: `lbrc014-20261109/spec-main.txt:80`. Các trường bản cài/SHA/biên nhận được đề xuất để nối bằng chứng đang rời nhau, không tự áp quy trình mới cho team. #fact/#inference

## Các ca UAT cụ thể cần có kết quả

| Phạm vi | Điều cần nhìn thấy trên bản cài đã định danh |
|---|---|
| Màn hình | Nút Chỉ đường ở tab Hôm nay, danh sách Khách hàng và Chi tiết KH; bấm tới đúng điểm bán. |
| Có tọa độ | Ưu tiên tọa độ đã đồng bộ, dù có địa chỉ chữ; kiểm đích hiển thị thực tế. |
| Thiếu tọa độ hoặc 0,0 | Dùng địa chỉ của màn; nếu màn trống thì dùng địa chỉ local. Không mặc định kết quả tìm theo chữ luôn chính xác tới cửa hàng. |
| Thiếu cả hai | Không mở bản đồ; thông báo thiếu thông tin. |
| Lỗi/mất dữ liệu local | Điểm chưa đồng bộ hoặc đọc local lỗi: dùng thông tin màn nếu có, không crash; thiếu dữ liệu thì thông báo. |
| Không mở được bản đồ | Hiện thông báo lỗi; không crash. |
| Nền tảng | Ba cấu hình trong spec: Android có Maps, Android không Maps, iOS. Ghi rõ giới hạn khi offline; đọc dữ liệu local không đồng nghĩa ứng dụng bản đồ tìm tuyến được khi mất mạng. |

Đối chiếu tiêu chí: `lbrc014-20261109/spec-main.txt:11`, `lbrc014-20261109/spec-main.txt:23`, `lbrc014-20261109/spec-main.txt:34`, `lbrc014-20261109/spec-main.txt:56`, `lbrc014-20261109/spec-main.txt:82`. Đây là checklist cần kết quả, không phải ca đã chạy trong lần đọc này. #fact/#inference

## Cách chốt gọn hồ sơ

Đề xuất gom vào **một biên bản LBRC014**: (1) bản được nghiệm thu và full SHA; (2) spec/review; (3) test/build; (4) UAT thiết bị; (5) người nghiệm thu, phạm vi, ngày và ngoại lệ. Dẫn về dòng việc hiện tại thay vì đổi trạng thái nguồn. Nếu bằng chứng đã có ở chat hoặc kho phát hành, liên kết lại đúng nguồn; chỉ thử bổ sung các ca còn thiếu. #inference

Bản đọc qua bot lúc 09:22 đã chứng minh quyền truy cập và chặn chéo BU; nó trả snapshot nhập ngày 08/11, không phải lần gọi GitHub mới. Lần đối soát này dùng phiên GitHub đã xác thực trên máy và Google Sheets connector; không cập nhật snapshot/DB của bot. Nguồn: `TELEGRAM-GROUP-VERIFICATION-20261109T0922.json:1`, `LBRC014-RECONCILIATION-20261108.json:7`. #fact

Giới hạn: chưa đọc Store/TestFlight, chưa mở app trên thiết bị, chưa liên hệ team hoặc lấy xác nhận mới; không chạy lại test/CI. Không coi danh sách rỗng trên GitHub là bằng chứng toàn bộ tổ chức không có hồ sơ ở nơi khác. Không sửa hoặc mở lại LBRC014. #fact
