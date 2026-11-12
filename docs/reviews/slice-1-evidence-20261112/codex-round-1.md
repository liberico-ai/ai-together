VERDICT: CHANGES_REQUIRED

- [P1] `src/app/documents/page.tsx:13` — trang tài liệu không mở được trong chế độ demo cục bộ.
  Kịch bản: `LIBETECH_DEMO=1` và người dùng đã có phiên demo → `identityService()` từ chối chế độ demo → trang chuyển về `/login`.
  Căn cứ: `AGENTS.md` (danh tính demo); `docs/UI-HANDOFF-1-documents.md:73`.

- [P1] `src/components/documents-view.ts:32-35` — nhãn chỉ mục cũ không thể bật khi Z1 có revision mới.
  Kịch bản: projector chiếu r2, sau đó Z1 nhận r3 nhưng projector chưa chạy lại → giao diện vẫn so `projected_at` với `record_updated_at` của chính dòng r2 trong Z2 và hiện «Chiếu lúc …», không báo chỉ mục cũ.
  Căn cứ: `docs/plans/slice-1-doc-ownership.md` Task 11, Review Focus 4; `docs/SLICE-BRIEFS.md:34`.

- [P1] `src/server/documents.ts:118` — mất dòng nguồn chỉ đổi `present` trong kết quả chi tiết, không làm trạng thái nguồn trên danh sách thành stale/unknown.
  Kịch bản: dòng `analytics.tech_source_tasks` liên kết bị xoá → `document_records.source_state` và bản chiếu giữ trạng thái cũ; màn danh sách không hiển thị `present:false`.
  Căn cứ: DOC-18, `docs/SLICE-BRIEFS.md:65-67`; test tại `tests/document-cases.test.ts:83-91` chỉ kiểm lịch sử và `present`.

- [P1] `src/server/projects-registry.ts:84-92` — lệnh đề xuất kênh không nhận hoặc kiểm `expectedVersion` dù tạo bản ghi có `version`.
  Kịch bản: hai yêu cầu đề xuất kênh từ cùng trạng thái dự án với hai khoá khác nhau → một yêu cầu được ghi mà không chứng minh người gửi đã đọc version dự kiến; chỉ ràng buộc trùng chat/topic xử lý va chạm.
  Căn cứ: `AGENTS.md` («Every write … expected version»); `docs/plans/slice-1-doc-ownership.md` Global Constraints.

- [P2] `src/server/document-index.ts:14-20` — API bắt buộc `projectId`, trái giao diện tìm trên toàn bộ dự án được cấp trong kế hoạch đã chốt.
  Kịch bản: người dùng được cấp hai dự án gọi `/api/documents/search?q=...` không truyền `projectId` → 422 thay vì tìm trong hai dự án theo quyền; test hiện còn khẳng định lỗi này.
  Căn cứ: `docs/plans/slice-1-doc-ownership.md:451-459` (Task 12, `projectId` tuỳ chọn).

Đây là đánh giá tĩnh trên diff ghim; tôi không chạy test hoặc áp migration trong phiên chỉ đọc.

