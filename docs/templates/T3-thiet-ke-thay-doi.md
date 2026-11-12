---
code: T3
version: 0.1.0
doc_type: design
source: docs/PM-DOCUMENT-TEMPLATES.md:72-83
---

Metadata chung:

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
