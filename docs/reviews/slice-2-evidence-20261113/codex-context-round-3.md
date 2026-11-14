

## Lát
2 — P1.1 Intake, outbox và Inbox của PM (nhánh `slice-2-intake-outbox`). Brief: `docs/SLICE-BRIEFS.md:87-152`. Kế hoạch: `docs/plans/slice-2-intake-outbox.md`.

## Ghim
- Base: `libetech-ai-os` @ `ce11242bf6f476fe4c653730eca083c0b7c81315` (merge base).
- Head: `2eb94375fb0e857561110a011b6395ba39f20072`.
- Diff bên dưới là `git diff --merge-base libetech-ai-os` tại head này. Tệp trong repo đọc được để kiểm ngữ cảnh.

## Bối cảnh đã chốt (căn cứ để chấm, không phải yêu cầu bỏ qua — thấy mục nào là P0/P1 thật thì vẫn báo kèm lý do)
- Phán quyết S1–S12 của phiên điều phối: `docs/plans/slice-2-intake-outbox.md:638-653`. Các phán quyết theo task nằm trong kế hoạch và trong sổ theo dõi (ngoài git).
- OQ-26, OQ-27, OQ-28, OQ-29 (`docs/OPEN-QUESTIONS.md`) chờ Chairman. Mã đang chạy theo hành vi giữ chỗ ghi ở `docs/plans/slice-2-intake-outbox.md:618-623`: nhóm nhiều dự án bị từ chối `INTAKE_PROJECT_AMBIGUOUS`; dự án chưa ánh xạ miền và `IBS_HI` chỉ giữ con trỏ + hash; phiếu đổi quyền dùng lại quy tắc phiếu cấp tài khoản.
- Điểm dừng chờ Chairman (không phải lỗi thiếu): OQ-09 mục (1); SPEC-007 ca (c) UAT thật; nối `send` thật và lịch kéo outbox trong gateway; triển khai d1-ai1; áp 016–018 lên dữ liệu thật; cấp mật khẩu `libetech_intake_svc`, `intake.key`, `INTAKE_DATABASE_URL`; cài plugin; khởi động lại gateway; gửi tin thật; sửa `AGENTS.md`/`CLAUDE.md`.
- ProjectChannel **không** kích hoạt; nguồn hiệu lực vẫn là `chatScopes`. Trần kích thước/loại tệp là đề xuất.
- Mức giao của lát: chỉ «đã có mã». Biên nhận `docs/DELIVERY-011-*` chưa viết.
- Hoãn có chủ đích (sẽ ghi trong biên nhận): danh sách ứng viên mở giới hạn 50 dòng, chưa phân trang/lọc; `sourceRef` đầy đủ giữ làm locator theo brief; `actor_id` lấy từ GUC ứng dụng (thiết kế); nút Có/Không 40px ở `/approvals` (có từ trước); `redactSecrets` là phòng thủ chiều sâu chỉ cho dự án lưu trích (giới hạn đã biết: NFD, «pw:», «OTP 482913», bộ định danh nhiều từ, thân khoá PGP, che quá tay câu thường); `needs_info→needs_info` (hỏi lại) được chấp nhận; tin trả lời có gọi bot (DOC-16) vẫn có biên nhận riêng cùng mã IN-.
- Có từ trước ở merge base, ngoài phạm vi lát: `src/server/accounts.ts:73` `Promise.all` trên một client transaction; mã nhóm trông như thật ở `scripts/setup-local-verification.ts:18` và `scripts/spec003-native-verify.ts:78` (đã theo dõi ở `docs/reviews/AUDIT-telegram-ids-20261112.md`); tên mẫu trông như thật ở `tests/test_bot_bridge.py` dòng 1–110 (bản gốc đóng băng).
- Kết quả kiểm tại head (sandbox chỉ đọc không chạy được Vitest; số của builder, phiên điều phối sẽ chạy lại): PostgreSQL thật 472 passed / 0 skipped; PGlite 451 passed / 21 skipped (ca chỉ chạy native); coverage statements 94.99 · branches 86.55 · functions 96.55 · lines 96.13; typecheck và build xanh; pytest 55 passed, 27 subtests.

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
Kiểm lại rằng hai mục đã xử lý đúng, và rà diff toàn nhánh tìm P0/P1 mới.
