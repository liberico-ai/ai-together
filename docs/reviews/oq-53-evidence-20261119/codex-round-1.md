VERDICT: CHANGES_REQUIRED

- [P1] migrations/023_thread_order.sql:279 — Trigger xác nhận chỉ so `last_seq`, nên có thể chấp nhận nháp đã cũ nếu một bản sửa thiếu số được ghi sau phép kiểm độ mới.
  Kịch bản: `threadFreshness` đọc luồng còn mới → một phiên phục hồi ghi bản sửa với `session_replication_role=replica`, khiến trigger đánh số không chạy và `last_seq` không đổi → quyết định `confirmed` vượt qua phép so tại dòng 282.
  Căn cứ: `docs/plans/oq-53-subject-verification.md:67` (D5 yêu cầu không có bản nào trong luồng thiếu số). Ca T16 chỉ kiểm bản thiếu số đã tồn tại trước phép đọc.

