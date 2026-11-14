VERDICT: CHANGES_REQUIRED

- [P1] src/server/intake.ts:51 — Intake đếm số phần tử cấu hình thay vì số dự án khác nhau, nên từ chối nhầm nhóm chỉ thuộc một dự án.
  Kịch bản: `chatScopes[chatId] = [A, A]` được `parseBridgeConfig` chấp nhận → tin từ nhóm đó nhận `INTAKE_PROJECT_AMBIGUOUS` (409), không vào Inbox và bị plugin chuyển sang dead-letter.
  Căn cứ: OQ-27 (`docs/OPEN-QUESTIONS.md:292,297`) chỉ yêu cầu từ chối nhóm gắn **từ hai dự án**.

Bốn finding vòng 3 đã được xử lý trong mã. Đây là kiểm tra chỉ đọc; tôi không chạy lại test.

