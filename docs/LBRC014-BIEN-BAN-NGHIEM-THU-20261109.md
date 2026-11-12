# BIÊN BẢN TỔNG HỢP BẰNG CHỨNG VÀ BỔ SUNG NGHIỆM THU — LBRC014

**Tính năng:** Chỉ đường tới điểm bán — App Saleman  
**Ngày lập:** 09/11/2026 · **Bản cập nhật theo dõi phản hồi**  
**Trạng thái hồ sơ — bổ sung sau mốc 15:00:** Đã đọc gói iOS Phương gửi LibeAI lúc 15:02 ngày 09/11/2026: báo cáo từng ca và tám ảnh. Có thêm bằng chứng trực quan U5, U7 và xác nhận rõ đây là kiểm thử Tech, CVKD chưa sử dụng. Còn lệch thông tin SHA/phiên bản, thiếu bằng chứng đích U4/U6 và nghiệm thu người dùng. **Kết luận mới nhất ở mục 12**; mục 11.3 giữ kết quả đúng mốc chốt 15:00. Nguồn: `lbrc014-supplements-20261109/phuong-ios-1502-inspection.json:1`.  
**Người tổng hợp:** Trợ lý kỹ thuật, theo yêu cầu Chairman. Hồ sơ ghi lại đúng phần Quân và Phương đã xác nhận; chưa thay người có trách nhiệm kết luận nghiệm thu.

## 1. Kết luận hiện hành và mốc đối chiếu

Bảng việc đang ghi **“Hoàn thành”**, kèm lời báo **“PhươngHV 7/11: nghiệm thu đạt, đóng.”** Mã chức năng đã được xác minh tại đúng commit và có trong nhánh main quan sát ngày 09/11. Hồ sơ ban đầu thiếu mối nối từ lời nghiệm thu tới bản cài, kết quả test/UAT và xác nhận review. Phần bổ sung đã nhận được ghi ở mục 9: Quân đã định danh bản Android và gửi log build; Phương đã mô tả lần thử iOS, đồng thời xác nhận đây là thử tính năng trước phát hành và nghiệm thu người dùng vẫn chờ. Nguồn bổ sung: `LBRC014-RESPONSES-LIBEAI-20261109.json:1`. Nguồn: `lbrc014-20261109/workbook-current.json:1`, `lbrc014-20261109/commit.json:1`, `lbrc014-20261109/compare.json:1`.

**Cập nhật sau hồ sơ gửi 11:15:** Quân đã gửi UAT trực tiếp trên 1.0.27+29 lúc 11:31; ảnh hiển thị 5b38598 khớp tiền tố full SHA đã đọc lại từ GitHub. Khoảng thiếu chỉ có UAT build 28 đã được bổ sung bằng gói mới. Vẫn cần phân biệt bản thử có cờ DEBUGGABLE với gói release; thiếu log chạy test, cấu hình trình duyệt, ca lỗi/biên, mối nối build iOS và kết luận người nghiệm thu nghiệp vụ. Nguồn: `lbrc014-supplements-20261109/uat-1131-inspection.json:1`, `lbrc014-supplements-20261109/github-and-workbook-20261109T113824.json:1`.

**Biên bản giữ nguyên trạng thái nguồn.** Việc cần làm là hoàn thiện hồ sơ chứng minh bản nào đã được nghiệm thu. Nhận định về khoảng thiếu chỉ áp dụng bộ nguồn đã đối soát sáng 09/11; bằng chứng ở nơi khác có thể được bổ sung bằng liên kết gốc.

## 2. Định danh và phạm vi

| Trường | Ghi nhận |
|---|---|
| Mã việc | LBRC014 |
| Dòng nguồn | [Đầu việc Tech, A31:H31, STT 30](https://docs.google.com/spreadsheets/d/1Vr1ykZUtwm5Wvj1oAQRjpzMgleDa6Fhu-WiPv-L61Vc/edit#gid=1963754558&range=A31:H31) |
| Người phụ trách / phối hợp theo bảng | QuânTV / PhươngHV |
| Hạn theo bảng | 06/11/2026 |
| Trạng thái theo bảng | Hoàn thành |
| Ghi chú nguồn | LBRC014. Spec SPEC-chi-duong-diem-ban.md. Quân 6/11: chờ nghiệm thu. PhươngHV 7/11: nghiệm thu đạt, đóng. |
| Phạm vi tính năng | Nút Chỉ đường trên tab Hôm nay, danh sách Khách hàng và Chi tiết KH; chọn đích theo tọa độ/địa chỉ và xử lý thiếu dữ liệu hoặc lỗi mở bản đồ. |
| Phạm vi ngoài tính năng theo spec | Giữ hành vi màn bản đồ tuyến; không đổi backend/API và không thêm dependency. |

Nguồn: `lbrc014-20261109/workbook-current.json:1`, `lbrc014-20261109/spec-main.txt:11`. Phạm vi này chỉ dành cho LBRC014, không nghiệm thu các thay đổi khác cùng nằm trong bản app.

| Mốc mã nguồn đã xác minh | Giá trị |
|---|---|
| Commit chức năng | [`8d05141576bcd4db8e7ab9f1a6b7a0dd9bd360ab`](https://github.com/liberico-ai/btnet-saleman/commit/8d05141576bcd4db8e7ab9f1a6b7a0dd9bd360ab) |
| Commit thêm đặc tả | [`07348b551ca5101815c0d05bd9bff302832dad71`](https://github.com/liberico-ai/btnet-saleman/commit/07348b551ca5101815c0d05bd9bff302832dad71) |
| Main quan sát sáng 09/11 | `5b38598de8bca1b258be7ee4b7086a993810478a`; chứa commit chức năng trên |
| Phiên bản khai trong mã main | `1.0.27+29` — chưa xác định đây có phải bản được nghiệm thu ngày 07/11. Nguồn: `lbrc014-20261109/version-main.txt:19`. |
| **Bản cài thực tế được nghiệm thu / full SHA build** | **Quân khai bản Android 1.0.27+29 tại SHA 5b38598de8bca1b258be7ee4b7086a993810478a; metadata gói khớp. Bản iOS Phương đã thử chưa nối được full SHA/số build.** Nguồn: `lbrc014-supplements-20261109/android-bundle-inspection.json:1`, `LBRC014-RESPONSES-LIBEAI-20261109.json:1`. |

Nguồn: `lbrc014-20261109/commit.json:1`, `lbrc014-20261109/spec-origin.json:1`, `lbrc014-20261109/compare.json:1`, `lbrc014-20261109/version-main.txt:19`.

## 3. Bằng chứng nền đã gom trước lần gửi 10:15

| Mã | Bằng chứng trong hồ sơ | Kết quả đã xác minh | Giới hạn |
|---|---|---|---|
| E01 | [Dòng việc và metadata](lbrc014-20261109/workbook-current.json); [phạm vi cột/tab đã kiểm](lbrc014-20261109/workbook-extended-scope.json) | Có lời báo PhươngHV nghiệm thu và đóng ngày 07/11; dòng việc đọc lại sáng 09/11 giữ nội dung này. | Chưa gắn SHA/bản cài, kết quả từng ca hoặc biên bản nghiệm thu trong dòng nguồn. |
| E02 | [Commit chức năng](lbrc014-20261109/commit.json); [quan hệ với main](lbrc014-20261109/compare.json); [mã tại ba màn hình](lbrc014-20261109/current-code-excerpts.json) | Mã chức năng có thật, nằm trong main; ba màn hình còn dùng nút chỉ đường. | Chưa xác minh mã đó đang chạy trên thiết bị nghiệm thu. |
| E03 | [Đặc tả tại bản main đã đọc](lbrc014-20261109/spec-main.txt) | Đã mô tả phạm vi, hành vi, tình huống biên và yêu cầu UAT thiết bị. | Dòng 3 và mục 8 vẫn ghi Draft/chờ Arch Lead review; spec được viết sau code. |
| E04 | [Mã test](lbrc014-20261109/test-main.txt); [checks](lbrc014-20261109/checks.json); [Actions](lbrc014-20261109/actions.json); [statuses](lbrc014-20261109/statuses.json) | Có 9 ca unit/widget trong mã. GitHub trả 0 check runs, 0 workflow runs và 0 status contexts tại SHA chức năng. | Chưa có log chạy đạt gắn SHA trong nguồn đã đọc. Test widget dùng hàm mở bản đồ giả lập. |
| E05 | [Version khai báo](lbrc014-20261109/version-main.txt); [releases](lbrc014-20261109/releases.json); [deployments](lbrc014-20261109/deployments.json) | Main khai `1.0.27+29`; API releases/deployments trả danh sách rỗng. | Chưa có chứng cứ phát hành ở GitHub/Store/TestFlight trong bộ nguồn ban đầu. Gói Android được team gửi sau đó đã đọc ở E07. |
| E06 | [Quan sát Telegram](TELEGRAM-GROUP-VERIFICATION-20261109T0922.json); [biên nhận server](TELEGRAM-IDENTITY-VERIFICATION-20261109T022314Z.json) | LibeAI đọc được hồ sơ đúng SHA; Libe – Xeca bị chặn. | Chỉ chứng minh đường đọc và phân quyền của bot. Hồ sơ bot là snapshot, không phải bằng chứng UAT App Saleman. |

Chi tiết và giới hạn từng nguồn: [báo cáo đối soát](LBRC014-ACCEPTANCE-GAP-20261109.md). Danh sách hash của bằng chứng GitHub/Sheets: [MANIFEST](lbrc014-20261109/MANIFEST.json). Các tệp bằng chứng gốc được giữ nguyên.

## 4. Phần Quân cần bổ sung

Quân đã gửi version/build/full SHA, gói Android, log build và UAT build 28 ở đợt đầu. Lúc 11:19 Quân giải thích không đổi kiến trúc; lúc 11:31 gửi gói UAT mới trên 1.0.27+29. Mục 9 giữ lịch sử trước 11:00; mục 10 là đối chiếu bổ sung hiện hành. Chưa có hạn hoàn thiện được cam kết. Nguồn: `LBRC014-RESPONSES-LIBEAI-20261109.json:1`, `LBRC014-RESPONSES-LIBEAI-20261109T1200.json:1`.

| Mã | Quân bổ sung | Thế nào là đủ | Liên kết / ngày dự kiến |
|---|---|---|---|
| Q1 | **Bản đã bàn giao và đã cài để nghiệm thu** | Full SHA build; version/build number của Android/iOS; gói cài hoặc mã build Store/TestFlight; nơi và ngày phát hành. Kèm ảnh thông tin phiên bản trên thiết bị đã dùng để nghiệm thu. Nối được bản này tới commit chức năng E02. Với gói cài trực tiếp, ghi thêm SHA-256 của gói. | Đã nhận gói Android và UAT mới định danh 1.0.27+29 [5b38598]. Còn mối nối bản thử DEBUGGABLE với gói release, nguồn phát hành/ngày bàn giao và build iOS. Xem E07–E08 và E16, mục 10. Nguồn nội bộ đã đọc: `lbrc014-supplements-20261109/uat-1131-inspection.json:1`. |
| Q2 | **Kết quả kiểm thử và build** | Log chạy các test liên quan, phân tích/build theo quy trình team; ghi đúng SHA, công cụ/môi trường, ngày và kết quả. Log chạy tại máy hoặc CI đều dùng được nếu truy được nguồn. Ca lỗi/bỏ qua phải nêu rõ. | Đã nhận log `bundleRelease` báo thành công, short SHA khớp lời Quân. Chưa có log chạy test, ngày/môi trường đầy đủ và liên kết đầu ra bằng hash. Xem E08, mục 9. |
| Q3 | **Bằng chứng review đặc tả và mã** | Làm rõ yêu cầu review áp dụng: nếu có review, dẫn người/role, spec/commit, ngày và kết luận; nếu miễn, dẫn căn cứ và người có thẩm quyền chấp thuận phạm vi miễn. Giữ riêng review kiến trúc và review mã. | Quân nhắc lại lúc 11:19: không đổi kiến trúc, chỉ thêm nút. Đã có lý do về phạm vi; còn cách xử lý yêu cầu review spec/code ở §8 của spec Draft và nguồn xác nhận phù hợp. Không tự đặt thêm yêu cầu thay đổi kiến trúc. Xem E13–E14. |
| Q4 | **Bộ bằng chứng UAT kỹ thuật** | Điền ma trận ở mục 6: bản cài, thiết bị/OS, ca thử, kết quả, người thử, ảnh/video/log. Dùng dữ liệu thử hoặc che thông tin khách hàng không cần thiết. | Đã nhận UAT mới 1.0.27+29 [5b38598] cho ba màn và ca địa chỉ → Maps; không còn chỉ có UAT build 28. Còn đích mong đợi để đối chiếu, Android dùng trình duyệt, U5–U7, thiết bị/OS, tính tương đương gói release và build iOS. Xem E16. Nguồn nội bộ đã đọc: `lbrc014-supplements-20261109/uat-1131-inspection.json:1`. |

Nếu kết quả đã có từ ngày 07/11, dẫn lại đúng nguồn gốc. Nếu chạy bổ sung sau ngày lập biên bản, ghi ngày thực tế của lần chạy; giữ riêng kết quả cũ và kết quả bổ sung.

## 5. Phần Phương cần bổ sung

| Mã | Phương xác nhận | Nội dung cần ghi | Liên kết / ngày dự kiến |
|---|---|---|---|
| P1 | **Lời nghiệm thu ngày 07/11 áp dụng cho bản nào** | Đối chiếu với Q1; ghi bản cài/full SHA hoặc thông tin đủ truy ra bản cài, thiết bị đã dùng, phạm vi tính năng đã xem và nguồn xác nhận gốc. Nếu chưa xác định được bản cũ, ghi rõ để chốt phạm vi kiểm bổ sung. | Phương báo iPhone 16 prm, iOS 26.5.2, bản 1.0.27 cài trực tiếp, thử ngày 06/11; viện dẫn tin xác nhận 08:15 ngày 07/11. Đã truy được tin gốc 08:15 ngày 07/11 trong Trợ Lý Platform. Lúc 11:23 Phương xác nhận bản thử iOS cùng phiên bản Store; còn số build/full SHA hoặc mã bản phát hành để kiểm mối nối và phạm vi nghiệm thu người dùng. Nguồn: `LBRC014-RESPONSES-LIBEAI-20261109.json:1`, `LBRC014-RESPONSES-LIBEAI-20261109T1200.json:1`. |
| P2 | **Kết quả sử dụng thực tế và phạm vi đại diện nghiệm thu** | Ai thử/ai sử dụng; các màn và tiêu chí đã đạt; bằng chứng tương ứng; vai trò của người xác nhận đối với dự án. Trường hợp Phương chỉ điều phối, nêu người được giao nghiệm thu và nguồn giao quyền. | Đã làm rõ: Phương là người thử tính năng trước release trên thiết bị của mình; nghiệm thu người dùng vẫn chờ. Cần người đại diện nghiệm thu, phạm vi và kết quả sử dụng thực tế. |
| P3 | **Kết luận sau khi đối chiếu hồ sơ** | Xác nhận mục 7, ghi ngoại lệ còn mở, mức ảnh hưởng, người xử lý và hạn được thống nhất. Các tiêu chí chưa có bằng chứng giữ trạng thái chờ xác nhận. | Phương chưa xác nhận nghiệm thu người dùng; cần kết luận của người có trách nhiệm, ngoại lệ và lịch hoàn thiện được thống nhất. |

Phần P1–P3 không suy ra quyền nghiệm thu từ riêng cột “Phối hợp”; mục đích là ghi nhận đúng người và phạm vi xác nhận thực tế.

## 6. Phiếu UAT để đính kèm kết quả

**Bản iOS Phương báo đã thử:** 1.0.27; số build chưa có · **Full SHA build iOS:** Chưa có Nguồn: `lbrc014-supplements-20261109/phuong-p1-1033.txt:1`.
**Người thử:** Phương · **Thiết bị/OS do Phương khai:** Iphone 16 prm / iOS 26.5.2 · **Ngày thử do Phương khai:** 06/11/2026 Nguồn: `lbrc014-supplements-20261109/phuong-p1-1033.txt:1`.
**Bản Android UAT mới lúc 11:31:** 1.0.27+29, app hiển thị SHA 5b38598; dumpsys có cờ DEBUGGABLE. Gói 1.0.26+28 trước đó giữ làm lịch sử. Nguồn: `lbrc014-supplements-20261109/uat-1131-inspection.json:1`.  
**Người xác nhận nghiệp vụ:** Chưa có; Phương nói phần người dùng đang chờ · **Nguồn bằng chứng:** LibeAI, Phương 10:33 và 10:42 ngày 09/11; `LBRC014-RESPONSES-LIBEAI-20261109.json:1`.

Trong các ô kết quả ghi `Đạt / Lỗi / Chưa kiểm / Không áp dụng có lý do`, cùng mã bằng chứng. Phương đã báo thử tính năng trên iOS và gửi ảnh giao diện. Ghi nhận này hỗ trợ phần đã xem, chưa đủ để điền “Đạt” cho từng đường xử lý hoặc gắn đúng SHA. Các ca còn lại chờ bằng chứng; không mặc định đạt. Ma trận tổng hợp từ spec nội bộ, mục 2–8: `lbrc014-20261109/spec-main.txt:11`.

| Ca | Tiêu chí quan sát | Android + Google Maps | Android dùng trình duyệt | iOS |
|---|---|---|---|---|
| U1 | Tab Hôm nay: nút Chỉ đường hiện và mở đúng đích của điểm bán. | Có ảnh giao diện → Maps trong E16 (1.0.27+29); đủ chứng minh nút hiện và mở Maps, còn dữ liệu đích mong đợi và mối nối gói release. | Chờ bổ sung | Phương báo đã xem; có ảnh nút chỉ đường. Chờ kết quả mở đúng đích theo ca và gắn build/SHA. Nguồn nội bộ đã đọc: `lbrc014-supplements-20261109/uat-1131-inspection.json:1`. |
| U2 | Danh sách Khách hàng: nút hiện và mở đúng đích; vẫn dùng được khi có tọa độ local nhưng địa chỉ màn trống. | Có ảnh giao diện → Maps trong E16 (1.0.27+29); đủ chứng minh nút hiện và mở Maps, còn dữ liệu đích mong đợi và mối nối gói release. | Chờ bổ sung | Phương báo đã xem; có ảnh nút chỉ đường. Chờ kết quả mở đúng đích theo ca và gắn build/SHA. Nguồn nội bộ đã đọc: `lbrc014-supplements-20261109/uat-1131-inspection.json:1`. |
| U3 | Chi tiết KH: nút ở vị trí theo spec, mở đúng đích. | Có ảnh giao diện → Maps trong E16 (1.0.27+29); đủ chứng minh nút hiện và mở Maps, còn dữ liệu đích mong đợi và mối nối gói release. | Chờ bổ sung | Phương báo đã xem; có ảnh nút chỉ đường. Chờ kết quả mở đúng đích theo ca và gắn build/SHA. Nguồn nội bộ đã đọc: `lbrc014-supplements-20261109/uat-1131-inspection.json:1`. |
| U4 | Ưu tiên tọa độ; thiếu tọa độ/0,0 thì dùng địa chỉ màn, rồi địa chỉ local. Kiểm cả đích hiển thị thực tế khi tìm bằng chữ. | Có ảnh địa chỉ → Maps trong E16 (1.0.27+29); chưa chứng minh toàn bộ thứ tự fallback và vị trí chính xác của điểm bán. | Chờ bổ sung | Chờ bổ sung Nguồn nội bộ đã đọc: `lbrc014-supplements-20261109/uat-1131-inspection.json:1`. |
| U5 | Thiếu cả tọa độ và địa chỉ: giữ nguyên màn app, hiện thông báo thiếu thông tin. | Chờ bổ sung | Chờ bổ sung | Chờ bổ sung |
| U6 | Điểm chưa đồng bộ hoặc đọc local lỗi: dùng dữ liệu màn nếu có; xử lý thiếu dữ liệu theo spec. | Chờ bổ sung | Chờ bổ sung | Chờ bổ sung |
| U7 | Lỗi mở app/trình duyệt bản đồ: hiển thị thông báo lỗi, app tiếp tục hoạt động. | Chờ bổ sung | Chờ bổ sung | Chờ bổ sung |

Cấu hình Android dùng trình duyệt tương ứng ca thiết bị chưa cài Google Maps trong spec nội bộ: `lbrc014-20261109/spec-main.txt:82`. Các ca đã có bằng chứng phù hợp có thể dẫn lại. Người review và người nghiệm thu thống nhất ca cần bổ sung; ghi lý do cho ca không áp dụng. Việc đọc dữ liệu local và việc ứng dụng bản đồ tìm tuyến khi offline phải được ghi nhận riêng.

## 7. Phần xác nhận — để người có trách nhiệm hoàn tất

### 7.1. Quân xác nhận gói bàn giao

- Quân khai bản Android **1.0.27+29**, SHA **5b38598de8bca1b258be7ee4b7086a993810478a**; đã nhận và đối chiếu metadata gói. Nguồn: `lbrc014-supplements-20261109/android-bundle-inspection.json:1`. Bản iOS nghiệm thu còn chờ nối nguồn.
- Build Q2: đã có log báo thành công; test execution và xử lý review Q3 còn chờ. UAT Q4 đã bổ sung ảnh Android + Maps và metadata build 29 lúc 11:31, còn các phần nêu tại E16. Nguồn bổ sung: `lbrc014-supplements-20261109/uat-1131-inspection.json:1`. Nguồn: `lbrc014-supplements-20261109/build-log-inspection.json:1`, `LBRC014-RESPONSES-LIBEAI-20261109.json:1`.
- Vấn đề còn mở và ảnh hưởng tới LBRC014: **Chưa điền**.
- Người cung cấp: tài khoản **Quan LibeAi**, LibeAI ngày 09/11/2026; các mốc 10:29–11:31 trong hai bản ghi phản hồi. Nguồn bổ sung: `LBRC014-RESPONSES-LIBEAI-20261109T1200.json:1`. Chỉ ghi nhận phạm vi các tin đã gửi, không thay chữ ký nghiệm thu.

### 7.2. Người review kỹ thuật xác nhận

- Họ tên / vai trò / phạm vi review: **Chưa điền**.
- Spec và commit đã review / nguồn kết quả: **Chưa điền**.
- Kết luận, ngoại lệ và ngày xác nhận thực tế: **Chưa xác nhận**.

### 7.3. Phương hoặc người được giao nghiệm thu xác nhận

- **Phương xác nhận vai trò người test trước release**; chưa xác nhận đại diện nghiệm thu người dùng. Nguồn: `LBRC014-RESPONSES-LIBEAI-20261109.json:1`, tin 10:42.
- Phương báo đã thử iOS 1.0.27 trên ba màn và gửi ảnh; chưa có full SHA/số build, kết quả từng ca và nghiệm thu người dùng. Nguồn: `lbrc014-supplements-20261109/phuong-p1-1033.txt:1`.
- Bằng chứng thử đã nhận: ảnh ba màn trong LibeAI lúc 10:33 và lời Phương; cần bổ sung kết quả từng ca; tin gốc 07/11 đã được truy tại E12. Xem mục 9.
- Kết luận lựa chọn: **Chưa xác nhận** — Đạt / Đạt có điều kiện / Chưa đạt / Chưa đủ bằng chứng.
- Ngoại lệ, người xử lý, hạn được thống nhất: **Chưa điền**.
- Phương báo ngày thử 06/11, viện dẫn tin xác nhận tính năng 08:15 ngày 07/11; bổ sung hồ sơ ngày 09/11. Chưa xác lập ngày nghiệm thu người dùng. Nguồn: `lbrc014-supplements-20261109/phuong-p1-1033.txt:1`.

Việc hoàn thiện hồ sơ cần nối được **tiêu chí → mã/build → bản cài → kết quả thử → người xác nhận**. Quyết định nghiệm thu thuộc người có trách nhiệm; trợ lý chỉ đối soát mức đầy đủ của bằng chứng. Lời báo nghiệm thu ngày 07/11 được giữ nguyên bên cạnh xác nhận bổ sung.

## 8. Bảo toàn nguồn và cách sử dụng hồ sơ

Biên bản được lập từ bộ bằng chứng đã đối soát sáng 09/11 và lưu riêng trong tài liệu LibeTech AI OS. Bảng việc, ghi chú của team, code GitHub, ticket và dữ liệu/snapshot của bot được giữ nguyên trong công việc lập biên bản này. Bản lập đầu và gói bằng chứng đã gửi vào LibeAI lúc 10:15 ngày 09/11; bản lập đầu được giữ nguyên trong gói đã gửi. Nguồn: `LBRC014-DELIVERY-LIBEAI-20261109T1015.json:1`. Bản cập nhật đến 11:00 cùng phụ lục đã gửi vào LibeAI lúc 11:15. Nguồn: `LBRC014-DELIVERY-LIBEAI-20261109T1115.json:1`. Phần theo dõi sau 11:15 trong bản hiện hành chưa gửi lại vào nhóm.

Bổ sung tài liệu bằng liên kết hoặc phụ lục có ngày/người cung cấp; giữ nguyên bằng chứng gốc. Nếu bản được nghiệm thu khác mốc mã đã ghi ở mục 2, đối chiếu phần thay đổi có ảnh hưởng đến LBRC014 rồi ghi kết quả; không tự thay mốc nghiệm thu bằng main mới nhất.


## 9. Theo dõi phản hồi đến 11:00 ngày 09/11/2026

**Đã kết thúc theo dõi đến 11:00.** Kiểm lại đúng nhóm lúc 11:00:57: phản hồi bổ sung cuối vẫn là gói UAT Quân gửi lúc 10:45. Đối chiếu nguồn cũ sau mốc theo dõi được tách riêng ở E12–E13. Bảng việc giữ nguyên “Hoàn thành”. Nguồn: [bản ghi phản hồi LibeAI](LBRC014-RESPONSES-LIBEAI-20261109.json).

| Mốc | Phản hồi/bằng chứng | Kết quả đối chiếu |
|---|---|---|
| 10:15 | Hồ sơ đã gửi vào LibeAI. | Gửi thành công, chưa phải nghiệm thu của người nhận. |
| 10:24 | Quân: “Em đang lấy thông tin ạ”. | Tiếp nhận/tập hợp thông tin. |
| 10:29 | Quân khai version 1.0.27, build 29, full SHA 5b38598de8bca1b258be7ee4b7086a993810478a. | SHA trùng commit GitHub đã đọc; commit chức năng LBRC014 là tổ tiên. Nguồn: `LBRC014-RESPONSES-LIBEAI-20261109.json:1`. |
| 10:30 | Quân gửi `saleman-29.aab`. | Đã tải, kiểm mã băm và metadata; package `vn.btnet.saleman`, version `1.0.27`, build `29`. Nguồn: `lbrc014-supplements-20261109/android-bundle-inspection.json:1`. |
| 10:31 | Quân gửi `build.log`. | Log báo `bundleRelease` thành công; short SHA `5b38598` và version khớp. Chưa chứa kết quả chạy test. |
| 10:32 | Quân: “Em gửi ạ. UAT kỹ thuật em đang lấy nốt ạ.” | UAT kỹ thuật đang được tập hợp, chưa coi đã đủ. |
| 10:33 | Phương gửi ảnh ba màn, báo thử iOS 1.0.27 trên Iphone 16 prm / iOS 26.5.2 ngày 06/11; viện dẫn tin xác nhận 08:15 ngày 07/11. | Có thông tin người thử, thiết bị, phạm vi và ảnh giao diện; chưa nối được full SHA/số build iOS. Tin xác nhận gốc đã được truy thêm tại E12. Nguồn: `lbrc014-supplements-20261109/phuong-p1-1033.txt:1`. |
| 10:42 | Phương nói đây là test tính năng trước release; nghiệm thu người dùng đang chờ. | Đã làm rõ ranh giới kết quả thử kỹ thuật và nghiệm thu nghiệp vụ. Giữ nguyên bảng việc, ghi nhận khác biệt phạm vi với lời “nghiệm thu đạt, đóng”. |
| 10:45 | Quân gửi `LBRC014-UAT-20261109.zip`, nói đây là build 28 trước khi tăng version. | Ảnh/log định danh Android 1.0.26+28, short SHA 751327b. Có bằng chứng mở Maps cho U1–U4; cần phân biệt bản thử và bản bàn giao. Xem E11 và đối chiếu GitHub bên dưới. Nguồn: `lbrc014-supplements-20261109/uat-inspection.json:1`. |

### 9.1. Bằng chứng bổ sung và mức đủ

| Mã | Nguồn | Phần đã xác minh | Còn thiếu/giới hạn |
|---|---|---|---|
| E07 | `saleman-29.aab`; [kết quả kiểm gói](lbrc014-supplements-20261109/android-bundle-inspection.json) | Định danh được gói Android, version/build khớp Quân khai; kiểm CRC archive đạt. SHA-256: `85de5da99e82c4b7e5f2f45c692b5023dcb741cc47bca1837d5d87ae6d9d019a`. | Full SHA nguồn do Quân cung cấp, được log hỗ trợ. Metadata VCS trong gói ghi `NO_SUPPORTED_VCS_FOUND`; chưa phải bằng chứng độc lập về checkout. Gói Android không định danh bản iOS Phương thử. |
| E08 | [Log build gốc](lbrc014-supplements-20261109/quan-build-1031.log); [đối chiếu](lbrc014-supplements-20261109/build-log-inspection.json) | Có đầu ra build thành công cho version 1.0.27+29, short SHA khớp nguồn GitHub. Hash log: `177bf6c33c403a7d6938c48bbdec23a0267d42cff39fb4f2ad68a62f6f33aa7a`. | Log do team cung cấp, không phải lần build độc lập. Chưa ghi ngày build, môi trường đầy đủ, hash gói đầu ra hoặc kết quả chạy test. |
| E09 | [Lời Phương lúc 10:33](lbrc014-supplements-20261109/phuong-p1-1033.txt), ảnh trong LibeAI; [bản ghi phản hồi](LBRC014-RESPONSES-LIBEAI-20261109.json) | Xác định phần Phương đã báo thử: thiết bị iOS của mình, ba màn, có nút chỉ đường và ảnh giao diện. | Ảnh đã xem trực tiếp trong Telegram, chưa lưu ảnh gốc riêng. Chưa có số build/full SHA, ảnh thông tin phiên bản, kết quả từng ca/đích bản đồ, hai cấu hình Android. |
| E10 | Lời Phương 10:42 trong bản ghi phản hồi | Phương tự xác nhận là người test trước release; nghiệm thu người dùng còn chờ. | Cần xác định người đại diện nghiệm thu nghiệp vụ và kết luận của người đó. |
| E11 | [Gói UAT Quân gửi](lbrc014-supplements-20261109/LBRC014-UAT-20261109.zip); [kết quả kiểm](lbrc014-supplements-20261109/uat-inspection.json); [so sánh GitHub](lbrc014-supplements-20261109/uat-build-to-delivered-build.json) | Đã xem 12 ảnh, đọc metadata ứng dụng; 13 hash tệp trong danh sách Quân gửi đều khớp. App hiển thị `1.0.26 [751327b]`; dumpsys ghi versionCode 28. Ảnh cho thấy nút ở ba màn, mở Google Maps, và ca tìm bằng địa chỉ. | Hỗ trợ một phần U1–U4; chưa đủ chứng minh toàn bộ dữ liệu đích mong đợi, thứ tự fallback hoặc U5–U7. Chưa có cấu hình Android dùng trình duyệt, định danh thiết bị/OS và bản iOS. Hash chứng minh toàn vẹn tệp nhận, không thay xác nhận thực hiện kiểm thử. |
| E12 | [Tin gốc và phản hồi bot](lbrc014-supplements-20261109/original-confirmation-and-review-scope.json) | Đã tìm đúng tin Phương lúc 08:15 ngày 07/11 yêu cầu đóng LBRC014 sau lời “nghiệm thu đạt”; bot báo ghi Hoàn thành lúc 08:17. | Tin gốc chưa gắn bản cài, SHA, ca thử hoặc người dùng đại diện. Phương làm rõ ngày 09/11 đây là test trước release. |
| E13 | [Lời Quân về review ngày 05/11](lbrc014-supplements-20261109/original-confirmation-and-review-scope.json) | Quân đã nói “việc này không thay đổi arch. Không phải review”; bot ghi nhận lời này. | Đây là lời về phạm vi/miễn review, chưa là kết quả review. Cần xác định căn cứ và thẩm quyền miễn hoặc hoàn tất review phù hợp; không tự áp thêm cổng Arch hay tự coi miễn đã được duyệt. |

### 9.2. Các điểm phải nối rõ trước khi kết luận nghiệm thu đúng bản

- **Bản iOS đã thử và bản Android vừa gửi:** Phương báo thử ngày 06/11, viện dẫn tin xác nhận 07/11 lúc 08:15; commit tăng version mà Quân vừa nêu có thời gian GitHub 07/11 lúc 08:23:32 Việt Nam. Tin xác nhận gốc đã truy được ở E12; vẫn cần dẫn đúng bản iOS/SHA đã cài. Chưa suy ra hai bản là một, cũng chưa kết luận lời báo sai từ riêng các mốc thời gian. Nguồn: `lbrc014-20261109/main.json:9`, `lbrc014-supplements-20261109/phuong-p1-1033.txt:1`.
- **Bản Android trong UAT và bản Android bàn giao:** ảnh UAT hiển thị `751327b`, khớp commit `751327b853b50ed7b06f87c747198a4a731b0ac6`. So sánh tới `5b38598de8bca1b258be7ee4b7086a993810478a` có 5 commit / 22 tệp thay đổi, gồm phần sửa khách hàng, lịch sử và check-in; toàn bộ khoảng này không chỉ tăng phiên bản. Các tệp trực tiếp của LBRC014 (nút chỉ đường, hàm mở bản đồ, ba màn tích hợp và test tương ứng) giữ nguyên trong so sánh. Đây là căn cứ để người review xem xét dùng lại phần UAT phù hợp, chưa tự động biến kết quả build 28 thành nghiệm thu build 29. Cần xác nhận phạm vi ảnh hưởng hoặc kiểm lại trên bản bàn giao. Nguồn: `lbrc014-supplements-20261109/uat-inspection.json:1`, `lbrc014-supplements-20261109/uat-build-to-delivered-build.json:1`.
- **Phạm vi “nghiệm thu”:** bảng việc ghi “nghiệm thu đạt, đóng”, trong khi Phương xác nhận phần đã làm là test trước release và người dùng còn chờ. Hồ sơ giữ song song hai nguồn và ghi rõ phạm vi khác nhau. Việc chỉnh trạng thái nguồn, nếu cần, thuộc người quản lý bảng; công việc này không chỉnh bảng. Nguồn: `lbrc014-20261109/workbook-current.json:1`, `LBRC014-RESPONSES-LIBEAI-20261109.json:1`.

### 9.3. Phần cần bổ sung tiếp

**Quân:** định danh bản iOS đã cài cho Phương và quan hệ với SHA chức năng; nguồn/ngày bàn giao; log chạy test đúng bản; làm rõ căn cứ miễn review đã báo ngày 05/11 hoặc cung cấp review spec/code của người có trách nhiệm; hoàn tất UAT kỹ thuật gồm Android dùng trình duyệt, ca lỗi/biên và thông tin người thử/ngày/thiết bị/OS; chốt phạm vi dùng lại kết quả build 28 cho build 29 hoặc kiểm bổ sung trên bản bàn giao. Có thể dẫn lại bằng chứng đã có, ghi ngày thực tế. Nguồn: `lbrc014-supplements-20261109/uat-inspection.json:1; lbrc014-supplements-20261109/original-confirmation-and-review-scope.json:1`.

**Phương:** tin xác nhận gốc 08:15 ngày 07/11 đã được tìm thấy; còn thông tin build trên thiết bị và nối đúng bản iOS; bổ sung kết quả từng ca đã thử; nêu người/đơn vị đại diện nghiệm thu người dùng, kết quả và ngoại lệ khi có. Hiện chưa có thời hạn hoàn thiện được hai bên cam kết trong các tin đã đọc.

**Kết luận tại mốc kết thúc:** phần định danh gói Android, đầu ra build và ảnh UAT Android đã có bằng chứng cụ thể; phần thử iOS đã có người thử và phạm vi được báo rõ. Hồ sơ nghiệm thu nghiệp vụ chưa đủ, và Phương xác nhận phần đó đang chờ. Giữ nguyên trạng thái bảng việc cùng toàn bộ dữ liệu của team.

**Kiểm lại nguồn khi chốt:** dòng A31:H31 vẫn “Hoàn thành”, giữ ghi chú “PhươngHV 7/11: nghiệm thu đạt, đóng.” Nguồn: `lbrc014-supplements-20261109/workbook-close-read.json:1`. Đây là kết quả kiểm lúc chốt đợt 11:00. Bản chốt đó đã gửi vào nhóm lúc 11:15; đợt theo dõi sau đó xem mục 10. Nguồn: `LBRC014-DELIVERY-LIBEAI-20261109T1115.json:1`.


## 10. Theo dõi bổ sung sau hồ sơ gửi 11:15 — đến 12:00

**Phạm vi:** đọc phản hồi của Quân, Phương; kiểm gói bổ sung và đối chiếu đúng SHA; cập nhật hồ sơ. Không đổi trạng thái bảng việc, ghi chú, ticket hay dữ liệu team. Mốc chốt và lịch kiểm được ghi trong `LBRC014-RESPONSES-LIBEAI-20261109T1200.json:1`.

**Mốc chốt:** kiểm lại đúng nhóm LibeAI lúc 12:00:45; phản hồi cuối vẫn là gói UAT của Quân lúc 11:31. Chưa có phản hồi bổ sung sau đó trong nhóm đã đọc. Đọc lại A31:H31 lúc chốt vẫn Hoàn thành, ghi chú gốc giữ nguyên. Nguồn: `LBRC014-RESPONSES-LIBEAI-20261109T1200.json:1`.

### 10.1. Phản hồi mới đã nhận

| Mã | Người / mốc | Nội dung và mức xác minh |
|---|---|---|
| E14 | Quân, tin đã sửa lúc 11:19 | Báo đã nối UAT build 28 với build 29, bản iOS đã cài; giải thích chỉ thêm nút, không đổi kiến trúc nên không có thay đổi Arch cần review. Ghi nhận ý kiến của người thực hiện. Tin chưa kèm định danh build iOS hoặc kết quả review spec/code. Nguồn nội bộ đã đọc: `LBRC014-RESPONSES-LIBEAI-20261109T1200.json:1`. |
| E15 | Phương, 11:23 | Xác nhận bản iOS đã thử cùng phiên bản phát hành trên Store, không có thay đổi khác. Đã rõ lời xác nhận về quan hệ phiên bản; chưa có mã build/SHA hay nguồn Store để đối chiếu. Lời này không thay lời 10:42 rằng nghiệm thu người dùng đang chờ. Nguồn nội bộ đã đọc: `LBRC014-RESPONSES-LIBEAI-20261109T1200.json:1`. |
| E16 | Quân, 11:31 | Gửi `LBRC014-UAT-1.0.27-20261109.zip`, nói gửi lại đúng bản 0.27. Đã đọc 10 ảnh và dumpsys; kiểm 11 hash đều khớp. Ảnh menu ghi 1.0.27 [5b38598], dumpsys ghi versionCode 29, lastUpdateTime 09/11 11:26:01 và cờ DEBUGGABLE. Nguồn nội bộ đã đọc: `lbrc014-supplements-20261109/uat-1131-inspection.json:1`. |
| E17 | GitHub / bảng việc, đọc lại 11:38 | Full SHA 5b38598de8bca1b258be7ee4b7086a993810478a khớp tiền tố ảnh. Có 0 check runs, 0 workflow runs, 0 status contexts tại SHA này. Dòng A31:H31 vẫn Hoàn thành và giữ ghi chú ngày 07/11. Không thực hiện ghi nguồn. Nguồn nội bộ đã đọc: `lbrc014-supplements-20261109/github-and-workbook-20261109T113824.json:1`. |

Nguồn lời nói: `LBRC014-RESPONSES-LIBEAI-20261109T1200.json:1`. Nguồn gói: `lbrc014-supplements-20261109/uat-1131-inspection.json:1`; ZIP gốc tại [gói UAT 11:31](lbrc014-supplements-20261109/LBRC014-UAT-1.0.27-20261109.zip). Nguồn E17: `lbrc014-supplements-20261109/github-and-workbook-20261109T113824.json:1`. SHA-256 ZIP: `b4b95a2ddd100c7d9144439013bd270840b0a1ce9e8b8dd883afdf1134231614`, 2.659.987 byte. Hash chứng minh tính toàn vẹn tệp, không thay xác nhận nghiệm thu.

### 10.2. Phần đã đủ bằng chứng và phần chưa đủ

| Hạng mục | Đã đủ để ghi nhận | Còn thiếu để kết luận nghiệm thu |
|---|---|---|
| Định danh UAT Android | Có phiên bản 1.0.27, build 29 và mã hiển thị 5b38598 khớp nguồn đã đọc; đã bổ sung trực tiếp cho thiếu UAT đúng phiên bản. | Bản cài UAT có cờ DEBUGGABLE; chưa có hash gói đã cài hoặc bằng chứng tương đương với AAB release đã giao. Cùng version/SHA hiển thị chưa chứng minh cùng gói nhị phân. Nguồn nội bộ đã đọc: `lbrc014-supplements-20261109/uat-1131-inspection.json:1`. |
| U1–U3 Android + Maps | Ảnh ba màn có nút chỉ đường và ảnh Maps sau đó. | Dữ liệu đích mong đợi/đối chiếu tọa độ hoặc địa chỉ theo từng ca, thiết bị/OS và kết luận người thử. Nguồn nội bộ đã đọc: `lbrc014-supplements-20261109/uat-1131-inspection.json:1`. |
| U4 Android + Maps | Có ca địa chỉ khách ở Cao Xá, Lâm Thao, Phú Thọ → Maps cùng tên khu vực. | Chưa chứng minh toàn bộ thứ tự ưu tiên tọa độ/địa chỉ, 0,0, địa chỉ local và độ chính xác tới điểm bán. Nguồn nội bộ đã đọc: `lbrc014-supplements-20261109/uat-1131-inspection.json:1`. |
| Cấu hình và ca biên | Bộ ảnh mới tăng bằng chứng cho bản 1.0.27. | Android không có Maps dùng trình duyệt; U5 thiếu dữ liệu, U6 lỗi/thiếu local, U7 lỗi mở bản đồ; log test thực chạy. Nguồn nội bộ đã đọc: `lbrc014-supplements-20261109/uat-1131-inspection.json:1`. |
| iOS | Có người thử, thiết bị/OS do Phương khai, ảnh ba màn; đã có lời xác nhận cùng phiên bản Store. | Số build/full SHA hoặc mã build Store đủ truy nguồn; kết quả từng ca và nối đúng bản cài ngày thử. Nguồn nội bộ đã đọc: `LBRC014-RESPONSES-LIBEAI-20261109T1200.json:1`. |
| Review | Quân đã nêu lý do không cần review thay đổi kiến trúc. | Cần làm rõ cách áp dụng yêu cầu review spec/code ghi tại §8 của spec Draft. Không tự yêu cầu ADR hay một lần review kiến trúc mới chỉ vì thiếu hồ sơ. Nguồn nội bộ đã đọc: `LBRC014-RESPONSES-LIBEAI-20261109T1200.json:1`. |
| Nghiệm thu nghiệp vụ | Đã có lời xác nhận gốc 07/11; Phương làm rõ vai trò thử trước phát hành lúc 10:42. | Người đại diện nghiệm thu, phạm vi giao quyền, kết luận sử dụng thực tế, ngoại lệ và hạn xử lý. Bản phát hành trên Store không tự chứng minh người dùng đã nghiệm thu. Nguồn nội bộ đã đọc: `LBRC014-RESPONSES-LIBEAI-20261109T1200.json:1`. |

Các mức trên dựa trên E14–E17 và ma trận spec đã đọc: `lbrc014-supplements-20261109/uat-1131-inspection.json:1`, `lbrc014-20261109/spec-main.txt:26`, `LBRC014-RESPONSES-LIBEAI-20261109T1200.json:1`. 0 check/workflow/status không đồng nghĩa test thất bại; chỉ chưa có bằng chứng chạy test ở các nguồn đó.

### 10.3. Phần đề nghị bổ sung tiếp, theo người

**Quân:** giữ gói UAT 11:31 làm bằng chứng bổ sung đúng phiên bản; cung cấp mối nối bản thử với gói release hoặc kết quả kiểm trên bản release. Bổ sung dữ liệu đích mong đợi, các ca trình duyệt/lỗi/thiếu dữ liệu, thiết bị/OS và log test liên quan. Với iOS, cung cấp build/SHA hoặc mã build Store để Phương đối chiếu. Với review, ghi rõ phần nào không áp dụng và cách xử lý dòng chờ review spec/code đang có. Có thể dẫn bằng chứng sẵn có; không yêu cầu làm lại ca đã đủ trong phạm vi được người nghiệm thu chấp thuận.

**Phương:** đã bổ sung xác nhận quan hệ phiên bản iOS; còn đối chiếu thông tin bản cài trên thiết bị, kết quả từng ca và xác định người/đơn vị nghiệm thu người dùng, phạm vi và kết luận. Không yêu cầu gửi lại tin xác nhận gốc 07/11. Chưa có hạn hoàn thiện được cam kết trong các tin đã đọc.

**Kết luận hồ sơ:** bằng chứng kỹ thuật đã tiến thêm ở phần UAT Android đúng phiên bản. Chưa đủ để kết luận nghiệm thu người dùng hoặc coi mọi tiêu chí đã đạt. Bảng việc và ghi chú của team được giữ nguyên. Nguồn: `lbrc014-supplements-20261109/uat-1131-inspection.json:1`, `LBRC014-RESPONSES-LIBEAI-20261109T1200.json:1`.

## 11. Theo dõi sau hồ sơ gửi 12:12

**Trạng thái:** đang theo dõi; đến 15:00 ngày 09/11/2026 theo mốc Chairman đã chọn. Các lần đọc đến 12:34 chưa thấy phản hồi hoặc tệp mới của Quân, Phương sau hồ sơ 12:12. Lần kiểm 12:40 và 13:01 bị gián đoạn do máy Mac khóa. Sau khi Chairman mở máy, đã đọc bù lúc 13:06: lịch sử nhóm còn hiển thị vẫn kết thúc ở hồ sơ 12:12, không có phản hồi mới. Đây là đối chiếu hồi cứu lịch sử còn hiển thị, không phải quan sát liên tục trong khoảng máy khóa. Nguồn: `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`.

**Gửi / xem / nghiệm thu:** biên bản chốt 12:00 và gói bằng chứng đã được gửi đúng LibeAI lúc 12:12; lần đọc 12:26 hiển thị Seen. Dấu đã xem không xác định người đọc, không phải lời xác nhận của Quân hay Phương và không thay kết luận nghiệm thu. Nguồn: `LBRC014-DELIVERY-LIBEAI-20261109T1212.json:1`, `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`.

**Đã đủ để ghi nhận:** định danh UAT Android 1.0.27+29 [5b38598], ảnh ba màn có nút chỉ đường và mở Maps, ca địa chỉ → Maps; các tệp UAT đã kiểm tính toàn vẹn. Lời Phương xác nhận bản thử iOS cùng phiên bản Store được giữ đúng mức lời người thử cung cấp. Mức chứng minh chi tiết và giới hạn từng ca nằm ở mục 10.2; chưa có bằng chứng mới làm thay đổi các mức đó. Nguồn: `lbrc014-supplements-20261109/uat-1131-inspection.json:1`, `LBRC014-RESPONSES-LIBEAI-20261109T1200.json:1`, `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`.

**Quân còn bổ sung:** mối nối bản UAT có cờ debug với gói release; log test và các ca trình duyệt/lỗi/thiếu dữ liệu; đích mong đợi và thiết bị/OS; thông tin build iOS; cách xử lý yêu cầu review spec/code. Không yêu cầu lại các bằng chứng đã nhận, không tự đặt thêm cổng review kiến trúc. Chi tiết Q1–Q4 ở mục 4 và phạm vi đã được Quân giải thích tại mục 10. Nguồn: `lbrc014-supplements-20261109/uat-1131-inspection.json:1`, `LBRC014-RESPONSES-LIBEAI-20261109T1200.json:1`.

**Phương còn bổ sung:** đối chiếu đúng bản iOS đã cài, kết quả từng ca; người đại diện và phạm vi nghiệm thu người dùng, kết luận và ngoại lệ/hạn xử lý. Không yêu cầu gửi lại tin gốc 07/11. Chi tiết P1–P3 ở mục 5. Nguồn: `LBRC014-RESPONSES-LIBEAI-20261109T1200.json:1`.

**Trạng thái nguồn:** lần đọc lại A31:H31 lúc 12:26 vẫn “Hoàn thành”, ghi chú gốc giữ nguyên. Lượt theo dõi này chỉ đọc bảng; không gửi tin nhắc hoặc cập nhật nguồn. Chưa đủ hồ sơ kết luận nghiệm thu người dùng. Nguồn: `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`.

### 11.1. Cập nhật hiện hành sau phản hồi 13:23 và 13:32

Phần này bổ sung kết quả mới, thay nhận định “chưa có phản hồi” tại mốc đọc trước đó; giữ nguyên toàn bộ lịch sử phía trên. Theo dõi tiếp đến 15:00. Nguồn: `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`.

| Mã | Bổ sung mới | Mức xác minh và phần còn thiếu |
|---|---|---|
| E18 | Quân 13:23 báo test chạy lại lúc 12:20 trên SHA 5b38598: 9/9 tính năng, 806/806 toàn app, analyze sạch; Flutter 3.41.6, máy dev. | Đã nhận lời báo. Tin nhắc `LBRC014-BO-SUNG-1300-20261109.zip`, hash rút gọn `f4227838…e186cb7`; chưa thấy tệp đính kèm qua nội dung nhóm và tìm tên gói, nên chưa kiểm log hoặc full hash. Nguồn: `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`. |
| E19 | Quân khai Pixel 3 / Android 12 / Maps 26.44 / Chrome 157; UAT debug dùng dữ liệu dev. Báo U1–U4 khớp đích và không có Maps mở Chrome đạt. | Đã rõ thiết bị/OS và lời người thực hiện, không tiếp tục coi đây là thông tin chưa được cung cấp. Chờ ảnh/log để kiểm. U4 Maps bỏ “Khu 3”, chỉ tới thôn/xã; U5/U6 chưa chạy máy thật; U7 gián đoạn. Nguồn: `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`. |
| E20 | Quân 13:32 khai Android/iOS phát hành 1.0.27+29/SHA 5b38598; Android 07/11, iOS 08/11 02:59; Phương thử trước tăng version. | Đã có lời khai build iOS phát hành; còn nguồn build/Store và định danh bản thực cài ngày thử. Log build cũ đúng có chuỗi tăng version → short SHA → bundleRelease thành công, nhưng không phải log build iOS hay chứng minh bản thử đã cài. Nguồn: `lbrc014-supplements-20261109/quan-build-1031.log:1`, `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`. |
| E21 | Đọc GitHub tại full SHA 8d05141576bcd4db8e7ab9f1a6b7a0dd9bd360ab và 5b38598de8bca1b258be7ee4b7086a993810478a. | Đã xác minh `directions_button.dart` và `map_launcher.dart` cùng blob SHA/nội dung; không có nhánh debug/release trực tiếp trong hai tệp này. Màn route thêm nút lịch sử; toàn app không giống hệt. Mã còn đọc local và gọi app ngoài, nên không suy dữ liệu, môi trường và gói cài tương đương hoàn toàn. Nguồn: `lbrc014-supplements-20261109/github-feature-compare-20261109T1337.json:1`. |
| E22 | Quân xác nhận spec/code chưa review, spec viết sau code, merge không qua PR; đề nghị review bổ sung. | Đây là xác nhận thiếu review từ người làm, không còn chỉ là không tìm thấy hồ sơ. Còn kết quả người được giao review; đề nghị chưa phải đã review hoặc đã được miễn. Giữ riêng giải thích không đổi kiến trúc, không tự thêm cổng review kiến trúc. Nguồn: `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`. |

**Đã đủ để ghi nhận:** các bằng chứng Android trước 12:00 vẫn có giá trị trong phạm vi đã kiểm; log build tăng version và build thành công; nay kiểm thêm được hai tệp xử lý chỉ đường giữ nguyên theo full SHA. Lời Quân về thiết bị/OS, nguồn test và trình tự phát hành đã được bổ sung. Các số test mới và ca trình duyệt vẫn ở mức người thực hiện báo cho tới khi đọc nguồn. Nguồn: `lbrc014-supplements-20261109/uat-1131-inspection.json:1`, `lbrc014-supplements-20261109/quan-build-1031.log:1`, `lbrc014-supplements-20261109/github-feature-compare-20261109T1337.json:1`, `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`.

**Quân còn bổ sung:** gửi tệp ZIP đã nhắc hoặc nguồn log/ảnh tương đương và full hash; log test đúng SHA, nguồn đối chiếu đích/ca trình duyệt; hoàn tất U7, thống nhất kiểm U5/U6 trên máy hoặc căn cứ dùng test thay thế; nguồn Store/build và mối nối gói iOS đã thử; kết quả review spec/code. Giới hạn U4 thôn/xã phải được người nghiệm thu xem xét như ngoại lệ, không tự đánh dấu đủ chính xác tới điểm bán. Không yêu cầu gửi lại những bằng chứng đã đủ. Nguồn: `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`.

**Phương còn bổ sung:** đối chiếu bản thực cài ngày thử với giải thích mới của Quân là thử trước tăng version; ghi kết quả từng ca và phạm vi chấp nhận dùng lại; xác định người đại diện/người dùng nghiệm thu, kết luận, ngoại lệ và hạn xử lý. Chưa thấy Phương bổ sung sau 12:12 trong nhóm đã đọc. Không yêu cầu lại tin xác nhận gốc 07/11. Nguồn: `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`.

**Kết luận hiện hành:** hồ sơ đã rõ hơn về bản phát hành, môi trường thử và thiếu review; chưa đủ để kết luận nghiệm thu người dùng. Giữ nguyên trạng thái bảng việc, ghi chú và dữ liệu team. Các mục Q1–Q4/P1–P3 và bảng UAT phía trên phải đọc cùng phần bổ sung này; trường “chờ thông tin thiết bị/build” ở mốc cũ nay chuyển thành “đã có lời khai, chờ nguồn kiểm”. Nguồn: `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`.

### 11.2. Bổ sung ảnh U7 của Quân lúc 13:37

**E23 — đã nhận và kiểm ảnh:** Quân báo đã tắt Google Maps và Chrome, bấm chỉ đường; ảnh 640×1280 cho thấy màn “Hôm nay” và thông báo “Không mở được ứng dụng bản đồ”. Đã lưu JPEG gốc, kiểm mã băm và xem trực tiếp. Ca U7 chuyển từ “gián đoạn/chưa có bằng chứng” sang “người thử báo đạt, có ảnh thông báo lỗi đúng nội dung”. Không yêu cầu Quân gửi lại ảnh này. Nguồn: `lbrc014-supplements-20261109/quan-u7-20261109T1337.jpg`, `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`.

**Giới hạn:** ảnh tĩnh hỗ trợ xác nhận thông báo, chưa tự chứng minh cách vô hiệu hai ứng dụng, khả năng thao tác tiếp hoặc định danh gói cài; phần “vẫn hoạt động bình thường” là lời người thực hiện. Các khoảng trống về log test, U5/U6, bản iOS đã thử, review và nghiệm thu người dùng tại mục 11.1 còn mở. Nguồn: `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`.

### 11.3. Kết luận chốt 15:00 ngày 09/11/2026

**Quan sát:** sau hồ sơ gửi 12:12, có ba phản hồi của Quân lúc 13:23, 13:32, 13:37. Đến lần đọc cuối 15:00, chưa thấy phản hồi mới của Phương hoặc tệp `LBRC014-BO-SUNG-1300-20261109.zip`; gói này mới được nhắc bằng tên/hash rút gọn trong tin 13:23. Các khoảng máy khóa đã được đọc bù qua lịch sử còn hiển thị, không phải quan sát liên tục trong khoảng khóa. Lượt theo dõi này không gửi tin vào nhóm. Nguồn: `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`.

#### Đã đủ để ghi nhận

- **Android:** bằng chứng UAT 1.0.27+29 [5b38598], ảnh ba màn và mở Maps, kiểm tính toàn vẹn tệp; log build cũ có chuỗi tăng version, commit và AAB thành công. Giới hạn tại mục 10.2 vẫn áp dụng, chưa đồng nhất bản UAT debug/dev với gói release/prod. Nguồn: `lbrc014-supplements-20261109/uat-1131-inspection.json:1`, `lbrc014-supplements-20261109/quan-build-1031.log:1`.
- **Mã chức năng:** `directions_button.dart` và `map_launcher.dart` giống nhau tại full SHA chức năng `8d05141576bcd4db8e7ab9f1a6b7a0dd9bd360ab` và full SHA phát hành `5b38598de8bca1b258be7ee4b7086a993810478a`. Đây là căn cứ xem xét dùng lại kết quả thử trong phạm vi hai tệp, chưa chứng minh cả app/môi trường/gói iOS đã cài tương đương. Nguồn: `lbrc014-supplements-20261109/github-feature-compare-20261109T1337.json:1`.
- **U7:** ảnh gửi 13:37 hiển thị “Không mở được ứng dụng bản đồ”; đã xem và lưu JPEG gốc 74.225 byte, SHA256 `d8ea1c7ebe72f857c1902e3e215ed5416191c05edff282ef0e004652f8ab0a8c`. Người thử báo đã tắt Maps/Chrome và app vẫn hoạt động. Không tiếp tục yêu cầu “hoàn tất U7” như mốc 13:23; ảnh hỗ trợ thông báo lỗi, các thao tác và khả năng dùng tiếp là lời người thử. Nguồn: `lbrc014-supplements-20261109/quan-u7-20261109T1337.jpg`, `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`.
- **Thông tin người thực hiện:** đã nhận thiết bị/OS, môi trường dev, test local và trình tự thử trước tăng version. Quân xác nhận spec/code chưa review. Những thông tin này đã được cung cấp, không yêu cầu báo lại; phần thiếu là nguồn đối chiếu hoặc kết quả xử lý. Nguồn: `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`.

#### Quân còn bổ sung

| Nội dung | Bổ sung tối thiểu |
|---|---|
| Test và ca trình duyệt | Gói ZIP đã nhắc hoặc log/ảnh tương đương, gắn với đúng SHA, để kiểm lời báo 9/9 test tính năng, 806/806 toàn app, analyze và Android không có Maps. Trong phạm vi tin nội bộ LibeAI đã đọc, số test mới là lời báo của người thực hiện; chưa có log tương ứng để kiểm. Nguồn nội bộ đã đọc: `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`. |
| Đích và ca biên | Nguồn đối chiếu đích U1–U4; U4 mới tới thôn/xã cần ghi mức chính xác được chấp nhận. U5/U6 chưa thử máy thật theo Quân: bổ sung thử hoặc căn cứ người nghiệm thu chấp nhận test thay thế; không tự kết luận các ca thất bại. |
| Bản thử/phát hành | Nguồn build/Store iOS và mối nối với bản Phương thực cài trước tăng version; mối nối UAT debug/dev với release/prod hoặc phạm vi dùng lại được người nghiệm thu chấp nhận. |
| Review | Kết quả review spec/code bổ sung bởi người được giao hoặc quyết định ngoại lệ có trách nhiệm. Không tự thêm cổng review kiến trúc; đề nghị review chưa phải review đã xong. |

Nguồn cho các mục còn thiếu: `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`, `lbrc014-supplements-20261109/github-feature-compare-20261109T1337.json:1`, `lbrc014-20261109/spec-main.txt:26`.

#### Phương còn bổ sung

1. Đối chiếu bản iOS thực cài ngày thử với giải thích “thử trước tăng version” của Quân; kết quả từng ca, phạm vi chấp nhận dùng lại cho bản phát hành hoặc kiểm lại phần cần thiết.
2. Người đại diện/người dùng nghiệm thu, phạm vi trách nhiệm và kết luận sử dụng thực tế; ngoại lệ (độ chính xác U4, phạm vi ca biên nếu chấp nhận), người xử lý và hạn hoàn thiện.

Không yêu cầu lại tin xác nhận gốc 07/11. Lời Phương lúc 10:42 về thử trước phát hành và nghiệm thu người dùng còn chờ chưa có phản hồi mới sau 12:12 thay thế. Nguồn: `LBRC014-RESPONSES-LIBEAI-20261109.json:1`, `LBRC014-RESPONSES-LIBEAI-20261109T1200.json:1`, `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`.

**Bảng việc:** lần đọc `'Đầu việc Tech'!A31:H31` lúc 14:57:14 vẫn “Hoàn thành”, ghi chú “LBRC014. Spec SPEC-chi-duong-diem-ban.md. Quân 6/11: chờ nghiệm thu. PhươngHV 7/11: nghiệm thu đạt, đóng.” Chỉ đọc, giữ nguyên dữ liệu và cập nhật của team. **Kết luận hồ sơ: chưa đủ bằng chứng nghiệm thu người dùng**; không phủ nhận phần kỹ thuật đã chứng minh và không tự thay quyết định team. Nguồn: `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`.

#### Lưu dòng trạng thái cũ để bảo toàn lịch sử

Dưới đây là nguyên văn dòng trạng thái mốc 13:06, được chuyển từ đầu tài liệu khi cập nhật kết luận 15:00. Nội dung cũ khác giữ nguyên. Nguồn: `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`.

**Trạng thái hồ sơ:** Đang theo dõi tiếp sau hồ sơ gửi LibeAI lúc 12:12 ngày 09/11/2026. Đã mở lại máy và đọc bù lúc 13:06: tin cuối vẫn là hồ sơ 12:12, chưa có phản hồi hoặc bằng chứng bổ sung; tin hồ sơ có dấu đã xem, chưa có xác nhận nghiệm thu. Khoảng máy khóa từ lần kiểm 12:40 đến khi mở lại đã được đối chiếu với lịch sử còn hiển thị. Kết luận kỹ thuật tại mục 10 giữ nguyên; nhật ký lượt theo dõi hiện hành ở mục 11. Nguồn: `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`.  

## 12. Phương bổ sung gói iOS lúc 15:02 — kiểm tra theo yêu cầu Chairman

**E24 — nguồn mới:** Phương AiTec gửi `Bo sung doi chieu IOs.zip` vào LibeAI lúc 15:02, trả lời hồ sơ 12:12: “Em gửi bổ sung kết quả đổi chiếu trên IOs kèm ảnh minh chứng các usecase ạ”. Đây là sự kiện sau mốc chốt 15:00, không sửa hồi tố kết quả theo dõi trước đó. Đã đối chiếu tên/trạng thái Downloaded trên Telegram với gói local, đọc báo cáo và xem đủ tám ảnh. ZIP 2.363.653 byte, CRC hợp lệ, SHA256 `0cb7ade1b20b2e1f8f91c324a7a76f2c9773a53e22f76a6a7a889e307ef75d41`; có một báo cáo Markdown và tám PNG, không có log chạy test trong phần nội dung của gói này. Nguồn nội bộ đã đọc: `lbrc014-supplements-20261109/phuong-ios-1502-inspection.json:1`.

### 12.1. Điều Phương đã xác nhận

Báo cáo ghi Phương thử U1–U6, U7 theo Quân; thiết bị iPhone 16 Pro Max Pro/iOS 26 (giữ đúng cách ghi nguồn), môi trường lab, tài khoản linhht, bản `main@751327b`, app 1.0.27. Kết luận của người lập là **7/7 đạt, 0 lỗi, 0 chưa kiểm**. Tiêu đề và nội dung nói rõ **kiểm thử của Tech, chưa phải người dùng; CVKD chưa sử dụng**. Như vậy đã có bảng kết quả từng ca và xác nhận phạm vi thử; không tiếp tục ghi “Phương chưa cung cấp kết quả từng ca”. Nguồn: `lbrc014-supplements-20261109/phuong-ios-1502/bao-cao.md:1`.

### 12.2. Đối chiếu ảnh và bản kiểm

| Hạng mục | Đã kiểm được | Giới hạn còn lại |
|---|---|---|
| U1–U3 | Có nút chỉ đường ở Hôm nay, danh sách khách và chi tiết khách. | Số 17 điểm/22–23 thẻ và mở đúng đích là lời người thử; ảnh chỉ thể hiện các phần đang hiển thị. Nguồn nội bộ: `lbrc014-supplements-20261109/phuong-ios-1502-inspection.json:1`. |
| U4 | Phương báo ưu tiên tọa độ, dùng địa chỉ khi thiếu tọa độ. | Trong gói mới chưa có ảnh/log đích hoặc dữ liệu đầu vào để kiểm thứ tự này; ô bằng chứng U4 trong báo cáo để trống. Nguồn nội bộ: `lbrc014-supplements-20261109/phuong-ios-1502/bao-cao.md:1`, `lbrc014-supplements-20261109/phuong-ios-1502-inspection.json:1`. |
| U5 | Ảnh `U5_bam_chi_duong.png` có mã KH012183 và thông báo “Điểm bán chưa có tọa độ hoặc địa chỉ để chỉ đường”. | Đây là bằng chứng trực quan mới cho ca thiếu dữ liệu. Trạng thái tọa độ trong dữ liệu local và cách chuẩn bị ca là lời người thử. Ảnh mang tên tìm KH012183 chỉ là danh sách chưa lọc; dùng ảnh bấm nút làm bằng chứng chính. Nguồn nội bộ: `lbrc014-supplements-20261109/phuong-ios-1502-inspection.json:1`. |
| U6 | Có ảnh đúng thẻ 10166490KA với địa chỉ và nút chỉ đường. | Trong ảnh mới chưa thấy đích Maps hoặc dấu vết xóa dòng local. Phương báo fallback địa chỉ thành công; ca thiếu dòng local khác ca lỗi truy vấn dữ liệu, không coi là đã phủ mọi nhánh lỗi. Nguồn nội bộ: `lbrc014-supplements-20261109/phuong-ios-1502-inspection.json:1`. |
| U7 | Có ảnh thông báo “Không mở được ứng dụng bản đồ”. | Báo cáo quy kết quả cho Quân; ảnh chưa định danh thiết bị/build riêng của ca. Không coi đây là bảy ca iOS đều do Phương trực tiếp thử và được đối chiếu độc lập. Nguồn nội bộ: `lbrc014-supplements-20261109/phuong-ios-1502/bao-cao.md:1`, `lbrc014-supplements-20261109/phuong-ios-1502-inspection.json:1`. |
| SHA / phiên bản | Báo cáo đã nêu short SHA 751327b và app 1.0.27. | Đối chiếu GitHub đã lưu tại full SHA `751327b853b50ed7b06f87c747198a4a731b0ac6` cho thấy `pubspec.yaml` 1.0.26+28, sau đó đổi thành 1.0.27+29 ở `5b38598de8bca1b258be7ee4b7086a993810478a`. Cần thông tin gói thực cài hoặc giải thích ghi đè phiên bản lúc build; không tự kết luận lần thử vô hiệu chỉ từ chênh lệch này. Nguồn nội bộ: `lbrc014-supplements-20261109/uat-build-to-delivered-build.json:1`, `lbrc014-supplements-20261109/phuong-ios-1502-inspection.json:1`. |

**Cách ghi kết quả:** “Phương báo 7/7 đạt; đã xem báo cáo và tám ảnh, xác minh được phần giao diện/thông báo nêu trên.” Chưa chuyển thành “đã kiểm chứng độc lập đủ 7/7” hoặc “người dùng đã nghiệm thu”. Nguồn nội bộ: `lbrc014-supplements-20261109/phuong-ios-1502-inspection.json:1`.

### 12.3. Phần còn cần bổ sung sau khi nhận gói mới

- **Phương phối hợp Quân:** chốt đúng bản thực cài (version/build/SHA, môi trường), giải thích cặp 751327b/1.0.27; bổ sung bằng chứng đích U4/U6, xác định nguồn và thiết bị của U7. Không yêu cầu gửi lại tám ảnh hoặc bảng kết quả vừa nhận. Nguồn: `lbrc014-supplements-20261109/phuong-ios-1502-inspection.json:1`.
- **Quân:** log test đúng SHA, ca trình duyệt Android và mối nối bản thử/phát hành; kết quả review spec/code còn mở như mục 11.3. Gói iOS mới không chứa các log đó. Nguồn nội bộ: `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`, `lbrc014-supplements-20261109/phuong-ios-1502-inspection.json:1`.
- **Nghiệm thu người dùng:** cần người dùng/đại diện có trách nhiệm thử, nêu phiên bản và phạm vi, kết luận, ngoại lệ/người xử lý/hạn. Báo cáo mới xác nhận CVKD chưa dùng nên phần này còn mở, không chỉ là thiếu ảnh minh chứng. Nguồn: `lbrc014-supplements-20261109/phuong-ios-1502/bao-cao.md:1`.

**Ghi chú truy nguồn ca thử:** phần đầu nói không tạo/sửa dữ liệu, nhưng U5 mô tả xóa tọa độ/địa chỉ trên web và U6 gán điểm rồi xóa dòng local. Nên làm rõ đây là bước chuẩn bị dữ liệu lab do ai làm; không suy ra dữ liệu sản xuất đã bị đổi. Nguồn nội bộ: `lbrc014-supplements-20261109/phuong-ios-1502/bao-cao.md:1`.

**Bảng việc và bảo toàn:** đọc lại A31:H31 lúc 15:19:49 vẫn “Hoàn thành”, ghi chú gốc giữ nguyên. Lượt kiểm này chỉ đọc nguồn, không gửi tin nhóm và không thay dữ liệu team. Gói nguồn, sổ chốt 15:00 và các phần lịch sử của biên bản được giữ. Nguồn: `lbrc014-supplements-20261109/phuong-ios-1502-inspection.json:1`.

### 12.4. Dòng trạng thái trước cập nhật — giữ nguyên để tra lịch sử

**Trạng thái hồ sơ — chốt 15:00 ngày 09/11/2026:** Đã kết thúc lượt theo dõi sau hồ sơ gửi 12:12. Quân bổ sung lúc 13:23, 13:32 và 13:37; chưa thấy Phương phản hồi thêm. Đã kiểm thêm hai tệp xử lý chỉ đường tại đúng full SHA và ảnh U7. Số test mới, ca trình duyệt và thông tin bản iOS phát hành còn chờ nguồn kiểm. Chưa đủ hồ sơ nghiệm thu người dùng. **Kết luận và việc còn thiếu mới nhất ở mục 11.3**; các mục trước giữ lịch sử theo mốc. Nguồn: `LBRC014-RESPONSES-LIBEAI-20261109T1500.json:1`, `lbrc014-supplements-20261109/github-feature-compare-20261109T1337.json:1`.  
