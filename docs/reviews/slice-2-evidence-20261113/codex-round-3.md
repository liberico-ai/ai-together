VERDICT: CHANGES_REQUIRED

Hai sửa vòng 2 đã xử lý đúng theo mã và ca kiểm đã đọc: thân yêu cầu vượt trần bị chặn khi đọc luồng; phản hồi intake thiếu ACK hợp lệ không còn được coi là đã lưu. Các finding dưới đây là mới.

- [P0] bot-plugin/__init__.py:448 — Hết thời gian chờ khóa spool làm mất tin đang tiếp nhận.
  Kịch bản: Backend mất kết nối, tiến trình khác giữ khóa quá 1 giây → `SPOOL_BUSY`; hook chỉ ghi log rồi trả về, tin không được lưu ở backend hoặc spool. `tests/test_bot_bridge.py:1052-1072` xác nhận kết quả này.
  Căn cứ: `docs/SLICE-BRIEFS.md:89`, DOC-12 và điều kiện đạt tại `:145-148` yêu cầu tiếp nhận bền và phục hồi sau mất kết nối.

- [P0] bot-plugin/__init__.py:583 — Phản hồi 401 khi khóa hai phía lệch làm xóa các tin đã nằm trong spool mà không đưa vào dead-letter.
  Kịch bản: Spool có tin chờ, khóa gateway chưa khớp khóa server → lần phát lại nhận 401; `drain` xóa tin khỏi spool, chỉ ghi mã lỗi. Tin mới gặp cùng lỗi cũng không được lưu.
  Căn cứ: `docs/SLICE-BRIEFS.md:89,128` yêu cầu lưu bền và phát lại không mất tin.

- [P1] src/server/intake.ts:80 — Bản sửa có thể lưu chữ cho SourceEvent đã được tạo ở chế độ `pointer_only`.
  Kịch bản: Tin được nhận khi dự án chưa ánh xạ hoặc thuộc `IBS_HI`, sau đó có mapping phiên bản mới sang `XECA`; bản sửa cùng message ID dùng mapping mới để ghi `text_excerpt`, dù SourceEvent gốc vẫn là `pointer_only`.
  Căn cứ: `AGENTS.md:16`; OQ-28 và `docs/plans/slice-2-intake-outbox.md:619` yêu cầu trường hợp chưa ánh xạ và IBS HI chỉ giữ con trỏ, hash, metadata.

- [P1] src/server/intake.ts:28 — Thứ tự bản sửa dùng `observed_at` của bản sửa đầu tiên để xếp bản gốc, nên có thể chọn bản gốc thay cho bản sửa mới nhất.
  Kịch bản: Bản sửa `editedAt=12:00` tới trước và được gateway quan sát lúc 12:05; bản gốc tới sau → `coalesce(edited_at, e.observed_at)` xếp bản gốc ở 12:05 trên bản sửa 12:00, khiến Inbox hiện nội dung cũ.
  Căn cứ: `docs/plans/slice-2-intake-outbox.md:80,262` yêu cầu bản mới nhất theo `edited_at`, kể cả khi bản sửa tới trước tin gốc.

