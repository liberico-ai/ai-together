VERDICT: CHANGES_REQUIRED

- [P0] src/server/suggestions.ts:106 — Nháp đã bị che vẫn trả `valueHash`, cho phép suy ra nội dung có ít khả năng; phép so hash ở dòng 278 còn tạo một kênh thử trực tuyến.
  Kịch bản: quản lý dự án không còn được đọc chữ của tin nguồn → `list` che `value` nhưng trả SHA-256 của nó → người đọc thử các giá trị phân loại và độ tin khả dĩ để dựng lại nội dung nháp. Kế hoạch R3 cũng ghi nhận khả năng này.
  Căn cứ: OQ-45 điểm 2(b), `docs/OPEN-QUESTIONS.md:668` — khi che nội dung, chỉ trả mã và lý do giữ.

