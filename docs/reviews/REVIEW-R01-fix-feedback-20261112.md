# Review PR sửa R-01 — `fix/feedback-resolve-key-binding`

Base `82292339584f5c6937c4d7c7a9ce39d3536619d8` (`libetech-ai-os`). Lời nhắc: `docs/reviews/CODEX-REVIEW-PROMPT.md` + diff `git diff --merge-base <base> <head>`. Codex chạy `codex exec --sandbox read-only`; mã thoát 0 không tự là PASS, verdict đọc từ dòng đầu của tệp kết quả.

## Tầng 2 — Codex, vòng 1 · head `026e69d5d6359fd52e861f5ba1cf8b421fdb5885`

VERDICT: CHANGES_REQUIRED

- [P2] `src/server/feedback.ts:45` — Phép so khớp `project_id` không xử lý được việc dùng lại request key ở dự án khác vì RLS ẩn hành động trước đó.
  Kịch bản: Một manager có quyền ở hai dự án đóng phản hồi A bằng key K, rồi dùng K để đóng phản hồi B ở dự án kia → truy vấn `prior` không thấy A; thao tác B bị rollback bởi khóa UNIQUE và API trả `DUPLICATE_CODE`, thay vì `FEEDBACK_KEY_CONFLICT`. Test mới chỉ kiểm hai phản hồi cùng dự án.
  Căn cứ: R-01 yêu cầu ràng buộc key với đúng đối tượng và toàn bộ request; `migrations/007_team_onboarding_feedback.sql:55,69–73`; `src/server/http.ts:12`.
## Tầng 1 — `liberico-code-reviewer` · head `026e69d`

Verdict: CHANGES. (1) Chặn: dùng lại key ở dự án khác vẫn ra `DUPLICATE_CODE` — trùng finding Codex vòng 1. (2) Gợi ý: hai yêu cầu giống hệt chạy đồng thời, lượt sau nhận `VERSION_CONFLICT` thay vì replay; sửa bằng khoá báo cáo `FOR UPDATE` trước khi tra hành động cũ (#inference, PGlite không chạy được hai transaction song song). (3) Gợi ý: dùng `INSERT … ON CONFLICT (tenant_id,actor_id,request_key) DO NOTHING RETURNING id` theo mẫu E-BE-08 thay cho SELECT-rồi-INSERT có sẵn từ baseline. (4) Nit: `vitest.config.ts` coverage chưa gồm `src/server/feedback.ts` (có từ trước).

## Sửa vòng 1 · head `7ebd35551d58aef8f6a019e9f76c1a92a69140f2`

Bắt vi phạm UNIQUE của đúng lệnh INSERT `feedback_actions` trong `resolve()` và trả `FEEDBACK_KEY_CONFLICT` 409; transaction rollback nên phản hồi thứ hai không đổi. Ca hồi quy mới (quản lý hai dự án, dùng lại key) đỏ với mã `23505` trước khi sửa, xanh sau. `npm run test` 62/62, `npm run typecheck` sạch.

## Tầng 2 — Codex, vòng 2 · head `7ebd355`

VERDICT: PASS

Không có finding. Đây là review tĩnh của diff; tôi không chạy test trong môi trường chỉ đọc.


## Còn lại (không chặn merge, ghi để làm tiếp)

Gợi ý (2) và (3) của tầng 1 chưa làm trong PR này: cả hai đổi thứ tự thao tác của `resolve()` và cần kiểm đồng thời trên PostgreSQL thật. Nit (4) có từ trước PR.
