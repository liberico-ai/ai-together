## Lát

Bản phát hành 0.9.0: hợp nhất bản đang chạy (0.8.0, cầu nối 0.3.2) vào `libetech-ai-os`. Đây không phải một lát của roadmap.

## Ngữ cảnh của vòng cổng này (do phiên Claude Code viết, không phải lời Chairman)

- Chỉ đạo của Chairman ngày 22/11/2026 08:10, chép nguyên: «Không cần thử, các dự án đang chạy có thể sửa. Chạy chính là thử nghiệm. Bạn xem lại phương án đi, golive và merge luôn và thử trên thực tế».
- Theo giao việc của Cowork điều phối cùng ngày, cổng chạy **một vòng**. Chỉ finding P0 chặn merge: mất dữ liệu, lộ dữ liệu, hoặc hỏng đường tiếp nhận đang chạy. P1/P2 được ghi vào biên nhận và sửa sau go-live. Vẫn xếp hạng mọi finding theo thang của lời nhắc trên.
- **Diff dưới đây** là bảy commit cherry-pick từ `codex/libetech-pm-release-20261118` (gốc `4f12a3c`; theo `docs/DEPLOY-004-pm-intake-hotfix-20261118.md` đã chạy production từ 18/11/2026), cộng phần nâng phiên bản lên 0.9.0. Diff chỉ gồm `bot-plugin`, `deploy`, `scripts`, `tests`, `package.json` và `package-lock.json`; đọc `docs/` và phần còn lại từ cây làm việc.
- **Điều quan trọng nhất cần kiểm:** bản phát hành này đưa cầu nối 0.3.2 (diff) chạy cùng mã web đã có ở `libetech-ai-os`, trong đó có migration `migrations/022_ai_drafts_pointer_only_guard.sql` và `migrations/023_thread_order.sql`. Hai migration này chưa áp ở production; 0.8.0 dừng ở 021. Hãy kiểm xem tổ hợp đó có làm mất tin hoặc hỏng đường tiếp nhận đang chạy không:
  - `bot-plugin/__init__.py` (hàng đợi, `HOOK_TIMEOUT`, gửi lại, `intake-dead.jsonl`);
  - `src/app/api/bridge/[...path]/` (tuyến `/api/bridge/intake/events`), `src/server/intake.ts`;
  - trigger cấp số và khoá dòng đếm của 023;
  - `docs/RUNBOOK-PRE-023-N1-N3.md` mục 2–3.
- Không có ca kiểm mới nào được viết cho vòng này.
