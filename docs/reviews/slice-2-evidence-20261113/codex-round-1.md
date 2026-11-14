VERDICT: CHANGES_REQUIRED

- [P1] `migrations/017_outbox.sql:289` — Vai `libetech_intake` có thể sửa lease khi trạng thái không đổi mà không tăng version hoặc tạo audit event.
  Kịch bản: Một dòng `leased` bị cập nhật `lease_token` trực tiếp → biên nhận từ gateway mang token cũ bị từ chối, trong khi thay đổi không có trong `outbox_state_events`.
  Căn cứ: `AGENTS.md:14` yêu cầu expected version và audit bất biến cho mọi ghi; `migrations/017_outbox.sql:418` cấp quyền sửa lease.

- [P1] `src/server/outbox.ts:91` — Biên nhận `delivered` không bắt buộc có `telegramMessageId`.
  Kịch bản: Yêu cầu đã ký báo `outcome:'delivered'` nhưng bỏ `telegramMessageId` → `report` đặt `delivered_at` và trạng thái `delivered` dù không có mã tin Telegram để đối soát.
  Căn cứ: `docs/SLICE-BRIEFS.md:100` yêu cầu tách trạng thái giao và đối soát biên nhận; `src/server/outbox.ts:193`.

- [P1] `bot-plugin/__init__.py:974` — Gateway đóng biên nhận chỉ dựa vào danh sách `rejected`, không kiểm số biên nhận được máy chủ chấp nhận hoặc nhận lại.
  Kịch bản: POST một biên nhận nhận HTTP 200 với `{accepted:0,replayed:0,rejected:[]}` → journal ghi `reported` và không gửi lại dù máy chủ chưa ghi biên nhận.
  Căn cứ: `docs/SLICE-BRIEFS.md:100` yêu cầu gateway báo biên nhận giao; `bot-plugin/__init__.py:978-985`.

- [P2] `src/server/outbox.ts:182` — Kiểm phát lại chỉ so `outcome`, bỏ qua mã tin Telegram khác nhau cho cùng lượt gửi.
  Kịch bản: Đã ghi `delivered` với message ID `501`, sau đó nhận `delivered` với ID `502` cho cùng lượt → trả `replayed`, không báo mâu thuẫn chứng cứ giao.
  Căn cứ: `AGENTS.md:14` yêu cầu audit bất biến; `docs/SLICE-BRIEFS.md:100` yêu cầu biên nhận giao có thể đối soát.

