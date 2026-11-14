

## Lát
2 — P1.1 Intake, outbox và Inbox của PM (nhánh `slice-2-intake-outbox`). Brief: `docs/SLICE-BRIEFS.md:87-152`. Kế hoạch: `docs/plans/slice-2-intake-outbox.md`.

## Ghim
- Base: `libetech-ai-os` @ `ce11242bf6f476fe4c653730eca083c0b7c81315` (merge base).
- Head: `2898def52fa0045e967f783c427fb57d603bae3b`.
- Diff bên dưới là `git diff --merge-base libetech-ai-os` tại head này. Tệp trong repo đọc được để kiểm ngữ cảnh.

## Bối cảnh đã chốt (căn cứ để chấm, không phải yêu cầu bỏ qua — thấy mục nào là P0/P1 thật thì vẫn báo kèm lý do)
- Phán quyết S1–S12 của phiên điều phối: `docs/plans/slice-2-intake-outbox.md:638-653`. Các phán quyết theo task nằm trong kế hoạch và trong sổ theo dõi (ngoài git).
- OQ-26, OQ-27, OQ-28, OQ-29 (`docs/OPEN-QUESTIONS.md`) chờ Chairman. Mã đang chạy theo hành vi giữ chỗ ghi ở `docs/plans/slice-2-intake-outbox.md:618-623`: nhóm nhiều dự án bị từ chối `INTAKE_PROJECT_AMBIGUOUS`; dự án chưa ánh xạ miền và `IBS_HI` chỉ giữ con trỏ + hash; phiếu đổi quyền dùng lại quy tắc phiếu cấp tài khoản.
- Điểm dừng chờ Chairman (không phải lỗi thiếu): OQ-09 mục (1); SPEC-007 ca (c) UAT thật; nối `send` thật và lịch kéo outbox trong gateway; triển khai d1-ai1; áp 016–018 lên dữ liệu thật; cấp mật khẩu `libetech_intake_svc`, `intake.key`, `INTAKE_DATABASE_URL`; cài plugin; khởi động lại gateway; gửi tin thật; sửa `AGENTS.md`/`CLAUDE.md`.
- ProjectChannel **không** kích hoạt; nguồn hiệu lực vẫn là `chatScopes`. Trần kích thước/loại tệp là đề xuất.
- Mức giao của lát: chỉ «đã có mã». Biên nhận `docs/DELIVERY-011-*` chưa viết.
- Hoãn có chủ đích (sẽ ghi trong biên nhận): danh sách ứng viên mở giới hạn 50 dòng, chưa phân trang/lọc; `sourceRef` đầy đủ giữ làm locator theo brief; `actor_id` lấy từ GUC ứng dụng (thiết kế); nút Có/Không 40px ở `/approvals` (có từ trước); `redactSecrets` là phòng thủ chiều sâu chỉ cho dự án lưu trích (giới hạn đã biết: NFD, «pw:», «OTP 482913», bộ định danh nhiều từ, thân khoá PGP, che quá tay câu thường); `needs_info→needs_info` (hỏi lại) được chấp nhận; tin trả lời có gọi bot (DOC-16) vẫn có biên nhận riêng cùng mã IN-.
- Có từ trước ở merge base, ngoài phạm vi lát: `src/server/accounts.ts:73` `Promise.all` trên một client transaction; mã nhóm trông như thật ở `scripts/setup-local-verification.ts:18` và `scripts/spec003-native-verify.ts:78` (đã theo dõi ở `docs/reviews/AUDIT-telegram-ids-20261112.md`); tên mẫu trông như thật ở `tests/test_bot_bridge.py` dòng 1–110 (bản gốc đóng băng).
- Kết quả kiểm tại head (sandbox chỉ đọc không chạy được Vitest): PostgreSQL thật 454 passed / 0 skipped; PGlite 433 passed / 21 skipped (ca chỉ chạy native); coverage statements 94.93 · branches 86.46 · functions 96.52 · lines 96.09; typecheck và build xanh; pytest 45 passed.
