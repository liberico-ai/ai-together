# Bàn giao thiết kế PM/BA và quản lý tài liệu

Ngày 11/11/2026 · Kết quả nghiên cứu/thiết kế, không phải biên nhận nâng cấp runtime.

## Hồ sơ dùng để triển khai

- [System Design Word, 7 trang](LibeTech-System-Design-PM-Documents-20261111.docx): tổng quan, thành phần, luồng, dữ liệu, phương án và roadmap.
- [Sơ đồ thành phần](LibeTech-PM-Documents-Architecture.png).
- [SPEC-009](SPEC-009-PM-BA-DOCUMENTS-20261111.md): đặc tả đầy đủ, sáu kỹ năng PM/BA, hợp đồng dữ liệu, quyền và 18 ca nghiệm thu.
- [So sánh tám repo](RESEARCH-PM-DOC-REPOS-20261111.md): khả năng kế thừa, license, độ mới, giới hạn và chi phí vận hành định tính.
- [Mẫu T0–T6](PM-DOCUMENT-TEMPLATES.md): chỉ mục, intake, yêu cầu, thiết kế, kế hoạch/quyết định, nghiệm thu và bàn giao.
- [Thiết kế UI](DESIGN-SYSTEM-PM-DOCUMENTS.md): tokens và sáu thành phần, trạng thái lỗi/thiếu/quyền/phiên bản, tiếp cận và mobile.
- [ADR-002 đề xuất](ADR-002-project-document-ownership.md): chủ nội dung, bản chuẩn và trách nhiệm AI OS.
- [Roadmap hiện hành](IMPLEMENTATION-ROADMAP.md) và [SPEC-008 v0.4](SPEC-008-PM-operating-loop-20261111.md): ưu tiên PM/tài liệu, Jira chỉ tham khảo, Factory giai đoạn 2.

## Phần đã kiểm

1. Đối chiếu mã local AI OS, AiTogether cũ và bot; đọc các SPEC/DOC-CONTRACT liên quan. Phân biệt cơ chế có trong mã và năng lực đã vận hành; chưa đo lại gateway/server.
2. Đọc lại Sheet 45 dòng, modified nguồn `2026-11-11T04:23:09.206Z`. Chọn XECA006 hiện hành, giữ riêng XECA005. Đối chiếu hồ sơ LBRC014 đến phần bổ sung iOS §12 ngày 09/11, không dùng kết luận cũ lúc 15:00 thay kết quả 15:02.
3. Nghiên cứu README, tài liệu chính thức, license và metadata của tám repo; chưa cài hoặc benchmark. API Docmost được ghi Enterprise; BookStack trỏ canonical sang Codeberg; arc42 có điều kiện CC BY-SA; ghi đúng các giới hạn này trong nghiên cứu.
4. Word được tạo từ bản sao retained System Design; đã render và xem cả bảy trang. Giữ một section, trang Letter, margins, style, numbering, grids và header; đổi đúng nội dung, diagram, footer tổ chức, footnote và hyperlink hồ sơ kèm. Reference gốc giữ SHA256 `13504f6c221a42c1726460a9e865e563355539ff97d702d6c9b2267b4b261d76`.
5. Đã kiểm liên kết tương đối của các Markdown trong ngữ cảnh repo, độ dài SHA, nội dung diff hai tài liệu cập nhật và các phần giữ nguyên của DOCX. Không còn placeholder nội dung của template. Field inventory không có trường cần refresh. Một footnote id0 được giữ và render đúng; bộ audit mặc định chỉ đếm id dương nên báo 0 defined, đã kiểm trực tiếp XML và trang render. Heading3 và các style trực tiếp theo đúng template, không tự đổi sang hệ định dạng khác.

## Ca thực: đủ và thiếu

**XECA006:** có nguồn hiện trạng, mã bền, người phụ trách/phối hợp, hạn và lời khai UAT trong notes. Chưa đọc tin gốc, repo, audit report hoặc build của việc này trong lượt nghiên cứu. Đã thiết kế cách nhận tài liệu, làm rõ thay đổi và review; chưa chạy bot trên ca này.

**LBRC014:** có gói kỹ thuật và bổ sung iOS tám ảnh/báo cáo của Phương; phân biệt kiểm thử Tech với nghiệm thu CVKD. Chưa đủ mối nối build thực thử–release, đích U4/U6 và xác nhận nghiệp vụ. Không yêu cầu gửi lại phần đã nhận hoặc đổi trạng thái Hoàn thành của Sheet.

## Ranh giới bàn giao

Chỉ thay tài liệu thiết kế/roadmap trong repo local. Không đổi code, migration, DB, Sheet, nguồn Drive, lịch nhắc, cấu hình gateway, tài khoản hoặc trạng thái việc; không cài repo/skill, gửi tin hay push GitHub. DOC-01…18 là ca được đặc tả, chưa phải test đã chạy. ADR chưa ký và sáu kỹ năng chưa được nạp lên bot.

Điểm bắt đầu triển khai là P1.0: đối soát danh mục tài liệu/quyền cho hai ca, xây registry và hai con trỏ nháp/đã duyệt. PM/quản trị xác minh mapping và reviewer; người vận hành xác minh quyền nguồn/snapshot/tuyến nội bộ. Giữ các gói COO dài hạn trong backlog, không để chúng chặn việc team viết và chia sẻ tài liệu.
