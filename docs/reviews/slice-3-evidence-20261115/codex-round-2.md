VERDICT: CHANGES_REQUIRED

- [P1] `migrations/020_document_review.sql:314` — Guard cho phép dời con trỏ bản chuẩn trong giao dịch sau khi quyết định đã ghi, không cần expected version hoặc sự kiện audit mới.
  Kịch bản: quyết định chấp thuận đã commit nhưng con trỏ chưa đổi → role runtime đặt `app.person_id` là người duyệt rồi `UPDATE approved_revision_id` ở giao dịch khác → bản chuẩn đổi mà không có `review_events` tương ứng. `tests/review-schema.test.ts:469-471` đang chấp nhận đường này.
  Căn cứ: `AGENTS.md:14` (mọi ghi cần expected version và audit event bất biến).

- [P1] `src/server/decisions.ts:29` — Thẻ 3/3 báo «Đã áp dụng» khi có biên nhận và trạng thái `applied` dù số phiếu đồng ý dưới ba.
  Kịch bản: phiếu có `state='applied'`, một `bom_receipts`, nhưng chỉ hai phiếu đồng ý → `reassignmentState` trả `applied` và thẻ hiển thị đã áp dụng; test hiện chỉ kiểm sự hiện diện của biên nhận.
  Căn cứ: `docs/SLICE-BRIEFS.md:191`, `:202-203` (2/3 chưa áp dụng; trạng thái đủ phiếu và áp dụng phải tách rõ).

- [P2] `skills/release-librarian/eval.json:4` — Ca `conflicting_sources` coi hai tài liệu dành cho hai đối tượng khác nhau là nguồn mâu thuẫn.
  Kịch bản: một hướng dẫn nội bộ và một hướng dẫn khách hàng đều được duyệt → đầu ra nêu đúng hai đối tượng riêng mà không khai `conflicts` bị chấm sai; đầu ra gán mâu thuẫn giả lại đạt.
  Căn cứ: `docs/SLICE-BRIEFS.md:198` (eval phải kiểm nguồn xung đột).

Đây là kiểm tĩnh trên head đã ghim; tôi không chạy Vitest trong sandbox chỉ đọc.

