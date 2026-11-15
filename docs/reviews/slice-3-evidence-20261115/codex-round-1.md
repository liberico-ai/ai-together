VERDICT: CHANGES_REQUIRED

- [P1] `src/server/document-dependencies.ts:22` — Lệnh tạo liên kết không nhận revision hoặc expectedVersion mà tự gắn vào bản mới nhất lúc ghi.
  Kịch bản: điều phối xem bản r1, r2 được đề xuất trước khi lệnh tới máy chủ → liên kết được ghi cho r2 mà không báo xung đột.
  Căn cứ: `AGENTS.md:14`; `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:140`.

- [P1] `src/server/suggestions.ts:145` — Gửi lại quyết định nháp cùng khoá chỉ so người, khoá và kết quả, nên nội dung lệnh khác vẫn được trả là đã thành công.
  Kịch bản: sau khi xác nhận một nháp, gửi lại cùng khoá và `result` nhưng đổi `valueHash` hoặc `revision` → nhận quyết định cũ thay vì lỗi xung đột.
  Căn cứ: `docs/plans/slice-3-review-skills.md:105` (dấu vân tay khoá lặp phải gồm nội dung lệnh).

- [P2] `src/server/document-review.ts:252` — API vẫn ghi `addressed` hoặc `resolved` vào luồng đã có dòng `resolved`, dù dữ liệu chi tiết đánh dấu luồng đó không còn thao tác được.
  Kịch bản: reviewer xác nhận đã xử lý, rồi gửi POST trực tiếp thêm một xác nhận cho cùng `parentId` → có thêm dòng và sự kiện; giao diện đã ẩn cả hai thao tác.
  Căn cứ: `src/server/document-review.ts:191-196`; `tests/document-review.test.ts:603-607`.

Đây là kiểm tĩnh trên head ghim; tôi không chạy test hoặc sửa mã trong sandbox chỉ đọc.

