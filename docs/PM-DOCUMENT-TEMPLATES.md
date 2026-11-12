# Bộ mẫu tài liệu PM/BA LibeTech

Version 0.1 · 11/11/2026 · Thiết kế để pilot, chưa cài vào bot. Đi cùng [SPEC-009](SPEC-009-PM-BA-DOCUMENTS-20261111.md). Mẫu được soạn riêng cho LibeTech; các repo nghiên cứu chỉ là nguồn tham khảo cấu trúc.

## Cách dùng

PM chọn mục cần dùng theo loại việc, có thể gộp trong một hồ sơ. Team tiếp tục viết trên Drive/Docs hoặc Git theo chủ nguồn. AI soạn nháp có nguồn; tác giả xác nhận; reviewer duyệt đúng phiên bản. Trường thiếu ghi **Chưa có**, không để AI điền bằng suy đoán. Mục không áp dụng ghi N/A kèm lý do. Không yêu cầu mọi bug có đủ bảy tệp.

Metadata chung cho mỗi hồ sơ:

| Trường | Giá trị điền |
|---|---|
| Mã tài liệu / dự án / BU | Chưa có — ID được cấp sau đối soát |
| Loại / tiêu đề | Chưa có |
| Tác giả / chủ nội dung / reviewer có quyền | Chưa có; ghi căn cứ giao quyền |
| Nguồn chính / revision nguồn | Chưa có; một nguồn để soạn |
| Bản nháp / bản chuẩn đã duyệt | Chưa có; giữ hai con trỏ riêng |
| Phạm vi xem / nhóm được nhận | Chưa có; không suy từ tên nhóm |
| Yêu cầu / việc / quyết định liên quan | Chưa có; mã bền, không dùng STT làm ID |
| Thời điểm nguồn / kiểm gần nhất / hạn review | Chưa có; ghi múi giờ |
| Nguồn dẫn và giới hạn đã đọc | Chưa có; phân biệt fact, suy luận, câu hỏi |

## T0 — Chỉ mục dự án và trách nhiệm

**Mục tiêu người dùng/sản phẩm:** …  
**Phạm vi trong / ngoài dự án:** …  
**Sponsor / PM / tech owner / người nghiệm thu nghiệp vụ:** …  
**Thành viên và quyền:** ai được xem, soạn, review, duyệt, công bố; căn cứ giao quyền, thời hạn.  
**Nhóm nhận yêu cầu:** chat/topic đã xác minh, loại tin bot thực nhận, mốc bắt đầu, khoảng thiếu.  
**Kho nguồn:** Drive/Vault/repo và chủ quản; không nhập token vào hồ sơ.

| Tài liệu / việc | ID | Bản chuẩn | Nguồn chính | Chủ nội dung | Review tiếp | Vấn đề |
|---|---|---|---|---|---|---|
| … | … | Chưa duyệt | … | … | … | … |

**Mốc dự án:** kết quả cần đạt, bằng chứng, phụ thuộc, người quyết định.  
**Nhịp cập nhật:** lịch được dự án xác nhận; không tự tạo lịch gửi mới.  
**Cổng sẵn sàng:** nguồn truy được đúng quyền; mỗi tài liệu có owner; bản chuẩn truy lại được; missing hiển thị rõ.

## T1 — Ghi nhận yêu cầu / change brief

**Người báo và kênh gốc:** …  
**Nguyên văn/trích đoạn được phép + locator:** …  
**Loại:** sự cố / bug / nâng cấp / tính năng / sản phẩm / tài liệu-hỗ trợ.  
**Vấn đề hiện tại:** ai gặp, ở bước nào, ảnh hưởng gì, tần suất; thông tin nào mới là khai báo.  
**Kết quả mong muốn:** …  
**Bằng chứng:** tệp/link, thời điểm, đã đọc hay chỉ nhận.  
**Độ khẩn / thời hạn:** người báo đề xuất; ai được xác nhận mức ưu tiên và cam kết.  
**Đối soát trùng:** ứng viên giống/khác, căn cứ, người xác nhận.  
**Điều chưa biết:** tối đa ba câu hỏi cần trả lời trước bước tiếp theo.  
**Bước tiếp / người nhận / thời điểm cập nhật:** chưa giao thì ghi đề xuất.

Với sự cố, thêm **dịch vụ bị ảnh hưởng, bắt đầu quan sát, cách khôi phục, người trực, lần cập nhật tới**. Hồ sơ dài không chặn hành động khôi phục đã được cấp quyền.

## T2 — Yêu cầu nghiệp vụ / user story

**Bối cảnh và mục tiêu:** …  
**Luồng hiện tại → thay đổi mong muốn:** …  
**Người sử dụng / quyền / dữ liệu:** …  
**Trong phạm vi / ngoài phạm vi:** …

| Mã yêu cầu | Câu chuyện / quy tắc | Nguồn đã xác nhận | Tiêu chí quan sát được | Người nghiệm thu |
|---|---|---|---|---|
| REQ-… | Khi …, người dùng … cần … để … | … | Cho trước …; khi …; thì … | … |

**Ngoại lệ:** dữ liệu rỗng/sai, quyền thiếu, mất kết nối, thao tác lặp.  
**Yêu cầu phi chức năng:** chỉ ghi chỉ tiêu có căn cứ; giá trị đề xuất phải gắn nhãn đề xuất.  
**Phụ thuộc và giả định:** mỗi giả định có người xác minh.  
**Tác động thay đổi:** task/test/hướng dẫn/khách nào bị ảnh hưởng.  
**Quyết định chốt:** actor, revision, phạm vi và ngoại lệ; không dùng lời “OK” không rõ đối tượng.

## T3 — Thiết kế phần thay đổi / quyết định kỹ thuật

**Baseline:** repo/thành phần, commit đã đọc, tài liệu hiện hành.  
**Thay đổi dự kiến:** sơ đồ trước–sau, interface, dữ liệu, quyền, giới hạn.  
**Các phương án:** lợi ích, chi phí vận hành, rủi ro, lý do chọn; ADR riêng chỉ khi thực sự đổi quyết định kiến trúc.  
**Ma trận tương thích:** phiên bản trước/sau, web/mobile/server, bên phụ thuộc.  
**Kiểm thử:** test nào chứng minh yêu cầu nào; ca lỗi và quyền.  
**Triển khai/rollback:** người có quyền, điều kiện bắt đầu/dừng, backup/restore nếu có dữ liệu.  
**Tài liệu phải cập nhật:** API, HDSD, runbook; N/A có lý do.  
**Điểm cần review chuyên môn:** …

Với nâng package: lưu báo cáo trước/sau, lệnh + công cụ/version tạo báo cáo, lockfile/commit, breaking changes, kiểm hồi quy, finding đã xử lý và finding chấp nhận tồn tại có người phê duyệt. Không coi số cảnh báo bằng 0 là đủ chứng minh mọi chức năng chạy đúng.

## T4 — Kế hoạch, milestone và sổ quyết định

**Kết quả kỳ này:** …  
**Capacity đã xác nhận / phụ thuộc / việc trực:** …

| Work ID | Đầu ra / tiêu chí | Người làm | Reviewer / người nhận | Ước lượng | Hạn đã cam kết | Phụ thuộc |
|---|---|---|---|---|---|---|
| … | … | Chưa giao | … | Đề xuất | Chưa chốt | … |

| Milestone | Điều kiện kết thúc | Bằng chứng cần có | Người quyết định | Ngày đề xuất / chốt |
|---|---|---|---|---|
| … | … | … | … | … |

| Decision ID | Câu hỏi / phương án | Người có quyền / ngưỡng | Revision đề nghị | Kết quả / receipt áp dụng |
|---|---|---|---|---|
| … | … | … | … | Chờ quyết định |

**Cập nhật tuần:** hoàn thành theo khai báo; phần được xác minh; blocker; bước tiếp; thay đổi phạm vi/hạn. Tái phân công cần phiếu BoM 3/3 cùng revision; phiếu 2/3 không đổi người. Cập nhật tiến độ thông thường do người có quyền ghi, không bắt ba người duyệt mỗi câu.

## T5 — Kiểm chứng và nghiệm thu

**Revision yêu cầu được kiểm:** …  
**Bản thực thử:** source commit, artifact/hash/build/version, môi trường, thiết bị/OS, thời điểm và người thử. Tài liệu thuần nghiệp vụ ghi revision/hash, không ép code SHA.

| TC / REQ | Bước thực hiện / dữ liệu | Kỳ vọng | Quan sát | Bằng chứng định danh | Kết quả / giới hạn |
|---|---|---|---|---|---|
| … | … | … | Chưa thử | … | Chưa đủ |

**Tách bốn kết luận:** nhận được tệp; kiểm kỹ thuật; người dùng nghiệm thu; ticket đóng. Ghi từng người, phạm vi và thời điểm.  
**Còn thiếu / lỗi mở:** mức ảnh hưởng, ai bổ sung, bản nào kiểm lại.  
**Chấp nhận có điều kiện:** quyền chấp nhận, điều kiện, hạn xử lý; không giấu ngoại lệ.  
**Receipt quyết định:** revision/hash được duyệt và chữ ký/sự kiện xác nhận đã kiểm; tác giả không tự nghiệm thu.

## T6 — Hướng dẫn, bàn giao và cập nhật tài liệu

**Đối tượng sử dụng / quyền cần có:** …  
**Khi nào dùng và điều kiện đầu vào:** …  
**Các bước:** hành động → kết quả nhìn thấy → cách xử lý khi sai.  
**Ví dụ thực:** dữ liệu đã ẩn thông tin không được chia sẻ.  
**Giới hạn / vấn đề đã biết:** …  
**Vận hành:** người hỗ trợ, điểm quan sát, ngưỡng báo, rollback/khôi phục được phép.  
**Hồ sơ bàn giao:** source, artifact/release, cấu hình không chứa secret, quyền và người nhận.  
**Lịch sử thay đổi:** revision trước/sau, lý do, mục sửa, tài liệu phụ thuộc.  
**Review và công bố:** ai xem đúng bản; nhóm/audience; link có quyền; delivery receipt; xác nhận của người nhận nếu cần.  
**Review lại:** người giữ nguồn, ngày hoặc trigger thay đổi; nguồn mất/quyền thu hồi được báo thế nào.

## Hai ví dụ điền từ nguồn thật, không phải nghiệm thu mới

### XECA006 — nâng package theo npm audit

- T0/T1: STT41 là vị trí nguồn; mã được dùng XECA006. Sheet hiện tại: Quân TV phụ trách, Thắng NM phối hợp, đang triển khai, hạn 21/11/2026. Nguồn notes có khai báo “đang UAT” ngày 07/11, chưa đọc message gốc trong lượt này.
- T2/T3 cần bổ sung: repo/phạm vi package, báo cáo trước–sau, commit/lockfile, ảnh hưởng tương thích, acceptance và rollback. Không tự chọn repo chỉ dựa chữ Xeca.
- T4/T5: giữ riêng với XECA005 và TK-XECA-202611-001. PM xác nhận yêu cầu/kế hoạch; người thử nộp bản thực thử và kết quả; ghi chưa đủ khi thiếu.
- T6: ghi bản đã duyệt vào chỉ mục, chia sẻ đúng nhóm đã mapping. Lượt này chưa có receipt công bố hoặc phép thử runtime.

### LBRC014 — đối soát tài liệu và bằng chứng

- T0: mã LBRC014; feature SHA `8d05141576bcd4db8e7ab9f1a6b7a0dd9bd360ab`. Sheet ghi hoàn thành; giữ nguyên.
- T5 có hồ sơ kỹ thuật, gói Android và bổ sung iOS của Phương lúc 15:02 ngày 09/11 gồm báo cáo + tám ảnh. Báo cáo nêu 7/7, là kiểm thử Tech; CVKD chưa dùng thử theo chính báo cáo. Không yêu cầu gửi lại đủ tám ảnh.
- Cần làm rõ: report `main@751327b` khai 1.0.27 trong khi snapshot nguồn của commit đó ghi 1.0.26+28; build 1.0.27+29 ở commit `5b38598de8bca1b258be7ee4b7086a993810478a`. Giải thích override/build pipeline nếu có; nối bản cài thật với artifact và feature SHA, không kết luận ảnh sai chỉ từ lệch metadata.
- Phần còn thiếu: minh chứng trực tiếp các nhánh U4/U6, cách chuẩn bị dữ liệu U5 (đã có ảnh cảnh báo), nguồn kiểm U7 và người dùng nghiệp vụ xác nhận; review và bằng chứng test phải chỉ đúng bản. Xem [biên bản §12](LBRC014-BIEN-BAN-NGHIEM-THU-20261109.md).
- T6 công bố bản cập nhật phải giữ đồng thời phần đã có và phần còn thiếu. Không dùng tài liệu mới để tự đổi status team hoặc điểm nhân sự.

Nguồn: [Sheet](https://docs.google.com/spreadsheets/d/1Vr1ykZUtwm5Wvj1oAQRjpzMgleDa6Fhu-WiPv-L61Vc/edit) đọc 11/11/2026; [hồ sơ LBRC014](LBRC014-BIEN-BAN-NGHIEM-THU-20261109.md) và báo cáo iOS lưu trong `lbrc014-supplements-20261109/phuong-ios-1502/bao-cao.md`.
