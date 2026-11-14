VERDICT: CHANGES_REQUIRED

- [P1] src/server/bridge-auth.ts:14 — Tuyến bridge đọc toàn bộ thân yêu cầu trước khi kiểm chữ ký và giới hạn 16 KB.
  Kịch bản: Yêu cầu không có `Content-Length` gửi luồng dữ liệu rất lớn, không có chữ ký hợp lệ → máy chủ đệm toàn bộ thân rồi mới trả 413, gây rủi ro cạn bộ nhớ.
  Căn cứ: `docs/plans/slice-2-intake-outbox.md:67`, giới hạn thân yêu cầu và kiểm HMAC của lát 2.

- [P1] bot-plugin/__init__.py:179 — Phản hồi 2xx không có biên nhận tiếp nhận hợp lệ vẫn có thể làm gateway bỏ tin.
  Kịch bản: Backend hoặc proxy trả 200 với `{"data":null}` khi tin chưa được lưu → `submit_event` coi là thành công và không đưa tin vào spool; trả 200 với `{}` thì `KeyError` bị phân loại là lỗi cuối và cũng không spool.
  Căn cứ: `docs/SLICE-BRIEFS.md:89`, yêu cầu lưu bền tin trước khi báo nhận; `bot-plugin/__init__.py:187-193,623-629`.

Bốn finding vòng 1 đã có sửa trong mã. Tôi chỉ kiểm mã ở head đã ghim; không chạy lại test trong sandbox chỉ đọc.

