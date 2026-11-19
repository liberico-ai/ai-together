VERDICT: CHANGES_REQUIRED

- [P0] migrations/022_ai_drafts_pointer_only_guard.sql:24 — Trigger tiết lộ nhãn `IBS_HI` của dự án ngoài phạm vi role AI trước khi RLS xét dòng chèn.
  Kịch bản: role AI thử chèn nháp với tenant và dự án ngoài phạm vi → nhận `LTZ01` nếu dự án là `IBS_HI`, còn dự án khác nhận lỗi RLS; ca G9 tại `tests/z4-pointer-guard.test.ts:131` xác nhận sự khác biệt này.
  Căn cứ: AGENTS.md:9 (cô lập tenant/dự án); ưu tiên 1 và định nghĩa P0 của lời nhắc review.

- [P0] src/server/suggestions.ts:209 — Nháp tài liệu chép chữ của tin đã bị ẩn vẫn có thể trả nguyên `value` khi không nêu mã tin.
  Kịch bản: một nháp `technical_writer` đưa chữ của tin vào `result.sections[].text`, chỉ nêu mã tài liệu hợp lệ; sau khi cờ hiện chữ của nhóm bị gỡ, người có quyền xác nhận nháp tài liệu đọc được chữ ấy vì phép kiểm chỉ xét mã được nêu và `THREAD_TEXT_HIDDEN` chỉ áp cho nháp ứng viên.
  Căn cứ: OQ-45 điểm 2(b), `docs/OPEN-QUESTIONS.md:668`; đường hở được mô tả tại OQ-55, `:904`.

- [P1] src/server/suggestions.ts:300 — Xác nhận nháp ứng viên không đồng bộ với giao dịch nhận tin mới sau phép kiểm độ mới.
  Kịch bản: `threadFreshness` trả “chưa có tin mới”; giao dịch nhận tin commit trước khi giao dịch xác nhận ghi quyết định → nháp cũ vẫn được xác nhận.
  Căn cứ: OQ-46(b), `docs/OPEN-QUESTIONS.md:684`; kế hoạch ghi nhận khe theo thứ tự commit tại R6/R27.

- [P1] migrations/022_ai_drafts_pointer_only_guard.sql:24 — Phép đọc ánh xạ không đồng bộ với giao dịch đổi miền dự án.
  Kịch bản: trigger đọc miền cũ; giao dịch khác commit ánh xạ `IBS_HI`; giao dịch chèn nháp mới commit sau đó → CSDL lưu nháp có nội dung cho dự án lúc ấy đã là `IBS_HI`.
  Căn cứ: OQ-45 điểm 3(b), `docs/OPEN-QUESTIONS.md:669`; AGENTS.md:16.

Đây là đánh giá mã ở chế độ chỉ đọc, không phải xác nhận có lộ dữ liệu hoặc triển khai trên môi trường thật.

