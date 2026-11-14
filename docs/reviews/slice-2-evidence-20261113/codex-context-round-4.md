

## Lát
2 — P1.1 Intake, outbox và Inbox của PM (nhánh `slice-2-intake-outbox`). Brief: `docs/SLICE-BRIEFS.md:87-152`. Kế hoạch: `docs/plans/slice-2-intake-outbox.md`.

## Ghim
- Base: `libetech-ai-os` @ `ce11242bf6f476fe4c653730eca083c0b7c81315` (merge base).
- Head: `a3cb14ec2fc4c7bed459d20803614014d52c4aa2` (commit tài liệu; mã cuối ở `6038014`, các lệnh kiểm chạy tại đó).
- Diff bên dưới là `git diff --merge-base libetech-ai-os` tại head này, **bỏ thư mục `docs/reviews/slice-2-evidence-20261113/`** (log kiểm và biên bản review, không có mã) vì đầu vào vượt giới hạn 1 048 576 ký tự của Codex CLI. Mọi tệp trong repo, kể cả thư mục đó, vẫn đọc được để kiểm ngữ cảnh.

## Bối cảnh đã chốt (căn cứ để chấm, không phải yêu cầu bỏ qua — thấy mục nào là P0/P1 thật thì vẫn báo kèm lý do)
- Phán quyết S1–S14 của phiên lát 2 (không phải quyết định của Chairman): `docs/plans/slice-2-intake-outbox.md`, mục «Phán quyết của phiên lát 2». Các phán quyết theo task: `docs/reviews/slice-2-evidence-20261113/controller-rulings.md`.
- OQ-26…29 Chairman đã quyết ngày 14/11/2026 (`docs/OPEN-QUESTIONS.md`, nguyên văn ở từng mục), mã theo ở commit `8f181af`:
  - OQ-26 (c): chỉ đối soát trên dữ liệu tổng hợp; không có mã nạp sổ ticket thật.
  - OQ-27 (a): nhóm gắn từ hai dự án bị từ chối `INTAKE_PROJECT_AMBIGUOUS`, không lưu gì.
  - OQ-28 (c): lưu trích theo cờ từng nhóm `intake.excerptChats` trong cấu hình vận hành (⊆ `intake.chats`, thiếu = không nhóm nào), không bao giờ lấy từ request. Nhóm không cờ và dự án ánh xạ `IBS_HI` chỉ giữ con trỏ + hash. Nhãn `LIBERICO_BU`/`XECA` không còn quyết định gì.
  - OQ-29 («1 thành viên BOM»): phiếu `access_change` đủ khi một ghế BoM đã đóng băng đồng ý; phiếu đồng ý của Chairman không tính, phiếu từ chối của Chairman đóng phiếu (S13). Phiếu cấp tài khoản lần đầu vẫn Chairman + một BoM.
- OQ-30 Chairman đã quyết ngày 14/11/2026 (`docs/OPEN-QUESTIONS.md`): «(b) Xét lại từng bản sửa» và, cho chữ đã lưu khi cấu hình siết lại, «Ẩn ngay, thiết kế xoá sau». Mã: `content_mode` nằm trên từng dòng `source_event_revisions` (CHECK: bản chỉ con trỏ không mang chữ), tính theo cấu hình hiện tại lúc ghi bản sửa đó, có thể nới hoặc siết; `source_events` không còn cột chế độ. Inbox hiện chữ của một bản sửa chỉ khi bản đó ghi có chữ **và** cấu hình hiện tại vẫn cho phép; siết lại thì ẩn (`hidden`), không xoá, bảng giữ bất biến. Thủ tục xoá/che có người duyệt là việc của lát sau (không phải lỗi thiếu). Thiết kế: phán quyết S15 trong kế hoạch.
- Điểm dừng chờ Chairman (không phải lỗi thiếu): OQ-09 mục (1); SPEC-007 ca (c) UAT thật; nối `send` thật và lịch kéo outbox trong gateway; triển khai d1-ai1; áp 016–018 lên dữ liệu thật; cấp mật khẩu `libetech_intake_svc`, `intake.key`, `INTAKE_DATABASE_URL`; cài plugin; khởi động lại gateway; gửi tin thật; sửa `AGENTS.md`/`CLAUDE.md`.
- ProjectChannel **không** kích hoạt; nguồn hiệu lực vẫn là `chatScopes`. Trần kích thước/loại tệp là đề xuất.
- Mức giao của lát: chỉ «đã có mã». Biên nhận: `docs/DELIVERY-011-intake-outbox-20261113.md`.
- Hoãn có chủ đích (sẽ ghi trong biên nhận): danh sách ứng viên mở giới hạn 50 dòng, chưa phân trang/lọc; `sourceRef` đầy đủ giữ làm locator theo brief; `actor_id` lấy từ GUC ứng dụng (thiết kế); nút Có/Không 40px ở `/approvals` (có từ trước); `redactSecrets` là phòng thủ chiều sâu chỉ cho dự án lưu trích (giới hạn đã biết: NFD, «pw:», «OTP 482913», bộ định danh nhiều từ, thân khoá PGP, che quá tay câu thường); `needs_info→needs_info` (hỏi lại) được chấp nhận; tin trả lời có gọi bot (DOC-16) vẫn có biên nhận riêng cùng mã IN-.
- Có từ trước ở merge base, ngoài phạm vi lát: `src/server/accounts.ts:73` `Promise.all` trên một client transaction; mã nhóm trông như thật ở `scripts/setup-local-verification.ts:18` và `scripts/spec003-native-verify.ts:78` (đã theo dõi ở `docs/reviews/AUDIT-telegram-ids-20261112.md`); tên mẫu trông như thật ở `tests/test_bot_bridge.py` dòng 1–110 (bản gốc đóng băng).
- Kết quả kiểm tại head (sandbox chỉ đọc không chạy được Vitest; số do `scout` chạy): tại mã `6038014`: PostgreSQL thật 16.15 — 41 tệp, 500 test đạt, 0 bỏ qua; PGlite 479 đạt / 21 bỏ qua (ca chỉ chạy native); coverage statements 95.09 · branches 86.79 · functions 96.67 · lines 96.19; typecheck và build xanh; pytest 66 passed, 69 subtests; tiến → lùi → tiến của migration 3/3.

## Vòng 1 (head `2898def`) và cách đã xử lý
Toàn văn: `docs/reviews/slice-2-evidence-20261113/codex-round-1.md`. Bốn finding đều được chấp nhận và sửa ở commit `2e37f17`:
- P1 `017:289` — khi trạng thái không đổi, `attempt_no`, `next_attempt_at`, `lease_token`, `lease_expires_at`, `last_error_code` bị khoá với **mọi** role (kể cả superuser) và version phải giữ nguyên; chỉ `libetech_runtime` «nhận xử lý» được đổi `failure_owner_id`, kèm `version+1`. Nhận lại khi chính mình đang giữ → 409 `OUTBOX_ALREADY_TAKEN`, không ghi gì. Fixture test lùi giờ lease dùng helper chế độ replica chỉ trong test.
- P1 `outbox.ts:91` — `delivered` ⇔ có `telegramMessageId` (refine của schema); CHECK có tên trên `delivery_receipts` và `outbox_messages`.
- P1 `bot-plugin/__init__.py:974` — câu trả lời biên nhận chỉ đóng lô khi `accepted`, `replayed` là số nguyên không âm, mọi khoá bị từ chối nằm trong lô, không lặp, và tổng bằng số biên nhận; sai → `RECEIPT_RESPONSE_INVALID`, không đóng biên nhận nào.
- P2 `outbox.ts:182` — phát lại chỉ tính khi `outcome`, `telegram_message_id`, `error_code` cùng khớp (`IS NOT DISTINCT FROM`); khác → `RECEIPT_CONFLICT` trong danh sách `rejected`.
- Thêm (kiểm tay giao diện UI-6): lỗi mạng hiện câu tiếng Việt, không hiện thông điệp thô; chi tiết thẻ có «Thử lại».
Vòng 2 (head `2e37f17`) xác nhận bốn mục trên đã có trong mã.

## Vòng 2 (head `2e37f17`) và cách đã xử lý
Toàn văn: `docs/reviews/slice-2-evidence-20261113/codex-round-2.md`. Cả hai finding được chấp nhận và sửa ở commit `2eb9437`. Đây là vòng sửa thứ hai, cũng là vòng cuối quy trình cho phép.
- P1 `src/server/bridge-auth.ts:14` — thân yêu cầu nay đọc theo luồng và dừng ngay khi vượt trần: hủy reader, trả 413 `PAYLOAD_TOO_LARGE`, kể cả khi không có `Content-Length`. Cùng loại lỗi ở đường web (`src/server/http.ts` `body()`, trần 16 384 byte) dùng chung helper `readBoundedText` (`src/server/request-body.ts`).
- P1 `bot-plugin/__init__.py:179` — đường tiếp nhận chỉ coi là đã lưu khi `data` là dict có `persisted is True` và `sourceEventId` là chuỗi khác rỗng. Mọi câu trả lời 2xx khác (`data:null`, thiếu `data`, thân không phải JSON, `persisted` không phải `true`) được xếp vào lỗi «đã trả lời» với mã `INTAKE_RESPONSE_INVALID`: tin vào spool hoặc giữ ở đầu spool có đếm lượt, theo luật dead-letter sẵn có. Đường đọc (`/api/bridge`) và đường kéo/biên nhận outbox giữ hành vi cũ.
Vòng 3 (head `2eb9437`) xác nhận hai mục trên đúng.

## Vòng 3 (head `2eb9437`) và cách đã xử lý
Toàn văn: `docs/reviews/slice-2-evidence-20261113/codex-round-3.md`; phân tích của planner: `codex-round-3-analysis.md` cùng thư mục. Người dùng duyệt vòng sửa thứ ba ngày 14/11/2026; cả bốn finding được chấp nhận và sửa theo **lớp lỗi** ở commit `9643b7f` và `82d30c6`:
- P0 `bot-plugin/__init__.py:583` và P0 `:448` — một luật cho mọi đường của plugin: **không đường nào xoá tin tiếp nhận**; tin kết thúc ở backend (có `IntakeAck` hợp lệ), trong spool, hoặc trong tệp dead-letter. Các lớp lỗi (`_failure_kind`):
  - *network* (không có câu trả lời): giữ thứ tự, thử lại, không đếm.
  - *answered* (404, 408, 429, 5xx, `INTAKE_RESPONSE_INVALID`, và lỗi cục bộ bất ngờ khi gửi): dòng đầu ở lại, đếm lượt, dead-letter sau 5 lượt.
  - *channel* (401; redirect `BRIDGE_REDIRECT_DENIED`; lỗi cấu hình cục bộ `PROFILE_SCOPE_MISMATCH`, `BRIDGE_ROUTE_DENIED`): dừng phát lại, giữ nguyên các dòng, thứ tự và số lượt; tin mới vào spool; log mã cố định (`INTAKE_AUTH_DENIED` cho 401).
  - *refused* (mã đã trả lời khác, không thử lại được: 403, 409, 413, 422…): dead-letter ngay kèm mã của máy chủ, ở cả đường trực tiếp và phát lại.
  - *disabled* (thiếu tệp khoá): giữ nguyên như trước.
  - `SPOOL_BUSY`/`SPOOL_FULL` → dead-letter không cần khoá spool (một lần `os.write` với `O_APPEND`). `SPOOL_BUSY` trong `_commit` không làm hỏng `submit_event`.
  - Hook lỗi trước `submit_event` → dead-letter một bản ghi chỉ có con trỏ (mã nhóm, mã tin, mã topic, tên lớp lỗi; không có nội dung).
  - Tệp dead-letter có trần 64 MiB (review bảo mật tự động của commit `9643b7f`). Ở trần: tin trực tiếp → log `INTAKE_LOST DEAD_FULL`; trong `_commit`, dòng cần dead-letter **ở lại spool** và phát lại dừng (`INTAKE_DEAD_FULL`). Ghi dead-letter thất bại → `INTAKE_LOST`.
  - Hai phán quyết L240, L241 bị thay bởi R3-1…R3-9 (`docs/reviews/slice-2-evidence-20261113/controller-rulings.md`).
- P1 `src/server/intake.ts:80` — xử lý theo quyết định OQ-30 (b) nêu ở trên (commit `1054222`): chế độ thuộc về bản sửa, nên không còn lệch giữa cột của sự kiện và chữ của bản sửa.
- P1 `src/server/intake.ts:28` — khoá xếp «bản mới nhất» thành `r.edited_at DESC NULLS LAST, r.revision_no DESC`, không còn đọc `e.observed_at`.
Giới hạn đã biết sau vòng này (ghi trong biên nhận, không phải lỗi thiếu — thấy mục nào thật sự là P0/P1 thì vẫn báo kèm lý do):
- Tệp dead-letter chưa có công cụ nạp lại; người vận hành đọc tệp. Bản ghi chỉ-con-trỏ không phát lại được.
- Kênh bị từ chối mãi (401, redirect, lỗi cấu hình) thì spool đầy (1000 dòng), tin mới sang dead-letter tới trần 64 MiB; sau đó tin mới mất và có log `INTAKE_LOST DEAD_FULL`. Đây là chỗ mất duy nhất còn lại, có giới hạn và có log.
- Kiểm trần ở đường trực tiếp không giữ khoá: tranh chấp có thể vượt trần một dòng hoặc một lô commit. Ghi thiếu (đĩa đầy) để lại nửa dòng trong tệp.
- Sau lỗi fsync/rename, một tin có thể nằm ở cả spool và dead-letter (nhập tay lại có thể tạo bản trùng thật).
- Spool không đọc được thì mọi tin mới sang dead-letter dù backend đang chạy.
- Lỗi bên trong `intake_event` sau bước allowlist không để lại bản ghi con trỏ (cần một sự kiện gateway mà đọc thuộc tính ném lỗi).
- Chữ đã lưu trước khi cấu hình siết vẫn nằm trong bảng bất biến (bị ẩn, chưa có thủ tục xoá/che — việc của lát sau theo quyết định).
- Gợi ý «cùng nội dung» giữa hai ứng viên cùng dự án so hash trong SQL: người điều phối có thể suy ra tin không hiện chữ trùng với tin đang hiện chữ (có từ trước; ghi để Chairman quyết).
- Luật hiển thị (chế độ của bản sửa VÀ cấu hình hiện tại) đang nằm riêng trong `src/server/inbox.ts`; lát 3–4 thêm chỗ đọc mới phải dùng chung luật này.
- CSDL đã chạy bản 016 cũ trên nhánh này (chỉ có ở máy phát triển) phải lùi 018 → 017 → 016 rồi chạy lại; 016 chưa áp ở đâu thật.

Đây là **vòng cuối**. Kiểm lại rằng bốn mục đã xử lý đúng, và rà diff toàn nhánh tìm P0/P1 mới. Commit `8f181af` (quyết định OQ-27/28/29) chưa từng qua vòng nào, cần được rà như mã mới.
