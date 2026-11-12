---
description: Chạy trọn một lát roadmap (1–5) từ brief tới PR, dừng ở câu hỏi mở hoặc điểm cần Chairman duyệt
argument-hint: <số lát 1-5>
---

# /slice $ARGUMENTS

Căn cứ: `docs/HANDOFF-CLAUDE-CODE-20261111.md` mục 5–8 và 10. Lát cần chạy: **$ARGUMENTS**.
Một lát một phiên. Trạng thái nằm trong tệp (`docs/plans/`, biên nhận, `docs/OPEN-QUESTIONS.md`), không nằm trong hội thoại.

## Điều kiện vào
1. `$ARGUMENTS` là số 1–5. Lát khác (P2 Dev Factory, gói điều hành mở rộng SPEC-008, Score nhân sự) → dừng, báo ngoài phạm vi.
2. Lát trước (nếu có) đã có biên nhận `docs/DELIVERY-0xx-*.md` ghi đạt. Chưa có → dừng.
3. `git status` sạch, đang ở nhánh `libetech-ai-os` đã cập nhật. Tạo nhánh `slice-$ARGUMENTS-<tên ngắn>` từ đó.
4. Không có mục trong `docs/OPEN-QUESTIONS.md` ghi «dừng» cho lát này mà chưa có quyết định. Có → dừng, trình câu hỏi.

## Chuỗi cố định
1. **Brief.** Đọc đúng mục lát $ARGUMENTS trong `docs/SLICE-BRIEFS.md`; chỉ mở đoạn SPEC mà brief trỏ tới. Không nạp nguyên văn SPEC-008/SPEC-009.
2. **Kế hoạch.** Giao agent `planner` chạy `superpowers:writing-plans`, lưu `docs/plans/slice-$ARGUMENTS-<tên>.md`. Mâu thuẫn SPEC → planner ghi OQ và lát dừng.
3. **Viết.** `superpowers:test-driven-development` + `superpowers:subagent-driven-development`: mỗi task một agent `builder`; ca kiểm viết trước, mã sau. Tìm mã và chạy test giao `scout`.
4. **Kiểm.** `superpowers:verification-before-completion`: `scout` chạy `npm run test`, `npm run typecheck`, `npm run build` (và `python3 -m pytest tests/test_bot_bridge.py` nếu chạm bot); ghi output vào biên nhận.
5. **Reviewer nội bộ (tầng 1)** — chỉ gọi cái liên quan:
   - `liberico-code-reviewer`: mọi PR.
   - `liberico-database-reviewer`: có migration hoặc đổi truy vấn.
   - `liberico-security-reviewer`: đụng quyền, phiên đăng nhập, cầu nối bot.
   - `liberico-reality-checker`: trước khi biên nhận ghi «đạt».
6. **Cổng Codex (tầng 2, bắt buộc trước merge).** Commit các thay đổi trên nhánh lát (chưa push) rồi chạy:
   ```bash
   { cat docs/reviews/CODEX-REVIEW-PROMPT.md; printf '\n\n## Lát\n%s\n\n## Diff so với libetech-ai-os\n' "$ARGUMENTS"; git diff --merge-base libetech-ai-os; } \
     | codex exec --sandbox read-only -C "$PWD" --output-last-message docs/reviews/REVIEW-slice-$ARGUMENTS.md -
   ```
   Finding P0/P1 → sửa, chạy lại bước 4 và cổng. **Tối đa hai vòng sửa**; chưa hội tụ thì giao `planner` phân tích một lần, vẫn chưa xong thì dừng và hỏi Chairman. Codex chỉ review, không sửa.
7. **Giao.** `/commit-commands:commit-push-pr` tạo PR vào `libetech-ai-os` (không vào `main`). Viết biên nhận `docs/DELIVERY-0xx-<tên>-<ngày>.md`; cập nhật `docs/IMPLEMENTATION-ROADMAP.md`; màn hình mới có đặc tả bàn giao sáu mục (bố cục, token, props, trạng thái, breakpoint, edge case) trong `docs/`. Lát 1: ghi số token theo công đoạn vào biên nhận để chỉnh mục 10.2. Báo Chairman năm dòng: làm gì, bằng chứng, còn thiếu gì, cần quyết gì.

## Đạt khi (mỗi lát)
- test, typecheck, build xanh, output nằm trong biên nhận.
- Ca DOC-xx / ca SPEC-008 của lát thành test tự động và đạt; có ca quyền âm (đọc chéo dự án/BU bị chặn, không tự nghiệm thu, tin gửi lại không tạo trùng).
- Giao diện có trạng thái rỗng, lỗi, đang tải, không có quyền; dùng được trên điện thoại.
- Biên nhận ghi riêng bốn mức: đã có mã · đã triển khai · đã dùng thật · đã nghiệm thu.
- Không còn finding P0/P1 của Codex chưa xử lý.

## Dừng và chờ Chairman — không tự làm
Triển khai lên d1-ai1 · áp migration trên dữ liệu thật · khởi động lại gateway chung (~20 bot) · gửi tin vào nhóm thật · merge vào `main` hoặc đổi nhánh mặc định · commit dữ liệu team. Kế hoạch trình duyệt triển khai phải có bản sao lưu đã thử phục hồi, cách rollback, danh sách bot bị ảnh hưởng, và tránh 08:30 ngày làm việc và 16:00 thứ Sáu.
