# ADR 002 Chủ dữ liệu tài liệu dự án và bản chuẩn đã duyệt

Status: Proposed, 11/11/2026. Authority: Chairman; chưa ký. Scope: LibeTech AI OS Phase 1, extends ADR-001 và SPEC-009. Đây là hồ sơ quyết định chuẩn bị cho triển khai, không yêu cầu quyết lại công việc nghiên cứu đã duyệt.

## Context

Tài liệu team nằm trong Drive/Docs, Vault và repo. AI OS hiện có liên kết spec/evidence nhưng chưa có vòng tài liệu đầy đủ. Cần hỗ trợ bot soạn/cập nhật và ghi nhận người xác nhận mà vẫn giữ một chủ nội dung, quyền từng dự án và dữ liệu hiện hữu. Quy định AR-03/05/06/09 áp dụng; hệ thống không đọc DB nền khác.

## Decision proposed

- Nội dung tài liệu hiện có tiếp tục do nguồn hiện có sở hữu. Mỗi DocumentRecord chỉ định đúng một canonical_uri/content_owner; không đồng bộ ghi hai chiều giữa Drive và Git cho cùng một tài liệu.
- AI OS sở hữu DocumentRecord, DocumentRevision metadata, ReviewDecision, Publication và TraceLink trong Z1; đây là quản trị tài liệu, không giành quyền sở hữu nội dung nghiệp vụ của các BU.
- Bản chuẩn được duyệt trỏ revision/hash bất biến có snapshot riêng đúng quyền. Snapshot phục vụ bằng chứng, không làm nơi soạn thay nguồn chính. Vault IBS HI chỉ lưu con trỏ/hash/metadata Tech theo phạm vi đã cho phép; không tự cache nội dung riêng.
- AI soạn và phân tích ở Z4. Người có quyền xác nhận; domain service áp thay đổi Z1. ETL tạo projection Z2 cho dashboard/search, kiểm quyền khi truy xuất và trả kết quả.
- Web, bot và adapter dùng cùng domain policy qua REST/queue; import lịch sử là ETL có manifest. Không query chéo DB. Giai đoạn 1 không phụ thuộc Factory; giai đoạn 2 chỉ nhận package/callback có chữ ký.

## Consequences

Giữ công cụ soạn hiện tại, giảm nhập lại và có bằng chứng phiên bản. Phát sinh chi phí snapshot/quyền nguồn/outbox, xử lý revoked access và review conflict. Cần migration versioned, backup/restore, chính sách retention và acceptance tests DOC-01…18 trước rollout. Không thay trạng thái work khi chỉ upload hoặc approve tài liệu.

## Alternatives

Kho tự host BookStack/Docmost: có UI cộng tác sẵn nhưng thêm danh tính/DB/backup và license ở một số tính năng. Docs-only Git/Docusaurus: thuận lợi cho dev, chưa thuận cho reviewer nghiệp vụ và quyết định trong chat. Xây editor mới trong AI OS: thêm phần realtime/editing lớn; chưa đủ lý do trong Phase 1.

## Adoption record

Decision: chưa ghi. Người quyết: chưa ký. Ngày hiệu lực: chưa có. Migration/cutover receipt: chưa có. Quyết định chọn nghiên cứu của Chairman không được điền thay approval triển khai của ADR này.
