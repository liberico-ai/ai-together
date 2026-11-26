# DELIVERY-024 — GIAO VIỆC 5 D, E, OQ-61 B6, che Z2: bản 0.9.3

Ngày 26/11/2026 · nhánh nền `libetech-ai-os` · phiên Claude Code của GIAO VIỆC 5.

## Mức của từng mục

Hai mức đầu có bằng chứng ở hai thư mục `docs/reviews/gv5-d-evidence-20261126/` và `docs/reviews/gv5-e-evidence-20261126/`. Hai mức sau chỉ được điền khi có bằng chứng từ d1-ai1 và biên bản nghiệm thu. Phiên này không vào máy chủ.

| Mục | Đã có mã | Đã thử trên CSDL thử | Đã triển khai | Đã nghiệm thu với team |
|---|---|---|---|---|
| D — bot nói đúng nguyên nhân; bảng nhóm → quyền | có, PR #48 | có: PGlite và PostgreSQL 16 cục bộ; test plugin | chưa | chưa |
| Che ghi chú IBS HI ở Z2 (OQ-62 câu 4 (b)) | có, PR #48, migration 029 | có | chưa | chưa |
| E — lỗi tệp đính kèm, tệp Excel, hết giờ chờ | có, PR #49 (phần thấy được trong mã) | có | chưa | chưa |
| OQ-61 B6 (2) — gỡ liên kết sai | có, PR #49, migration 030 | có | chưa | chưa |
| F — lịch nhắc có ngữ cảnh | **chưa**. Kế hoạch chờ duyệt (xem «Vướng») | chưa | chưa | chưa |

Không ca lỗi nào được ghi «đã đóng».

## PR, merge, cổng Codex

| PR | Merge | Cổng Codex (một vòng mỗi PR) |
|---|---|---|
| [liberico-ai/ai-together#48](https://github.com/liberico-ai/ai-together/pull/48) (D, che Z2) | `d9a2318` | `CHANGES_REQUIRED`: 1 P0, 1 P1. Đã sửa cả hai, có ca đỏ trước |
| [liberico-ai/ai-together#49](https://github.com/liberico-ai/ai-together/pull/49) (E, B6) | `cf1f2ca` | `CHANGES_REQUIRED`: 1 P0, 1 P1, 1 P2. Đã sửa cả ba, có ca đỏ trước |

- Cả hai merge bằng `--match-head-commit`. Mỗi merge có hai cha, cây của merge bằng cây của head. `main` vẫn ở `d23e516`; nhánh mặc định vẫn là `main`.
- Codex không đọc lại các sửa sau cổng, và không có lượt đọc độc lập lần này, vì tài khoản Claude đã chạm hạn mức chi tiêu. Kế hoạch từng PR cũng do phiên viết mã lập, không qua planner riêng, cùng lý do.

## Cổng test trên cây cuối

| Cổng | PR 4 (`57dcb9c`) | PR 5 (`4384524`) |
|---|---|---|
| typecheck, build | thoát 0 | thoát 0 |
| pytest | 174 đạt | 176 đạt |
| PGlite với coverage | 1555 đạt, 162 bỏ qua | 1574 đạt, 162 bỏ qua; câu lệnh 96,12 %, nhánh 91,99 % |
| PostgreSQL 16 | 1717/1717 | 1736/1736, không bỏ qua |

## Nhóm → dự án → quyền

`docs/BOT-GROUPS-20261126.md`. Nhóm chung Team Tech không gắn dự án; dự án được chọn ở bước phân loại.

## Các ca lỗi

| Ca | Nguyên nhân thấy trong mã | Đã sửa gì | Đối chiếu với người báo |
|---|---|---|---|
| (a) `unauthorized`, bot giải thích sai | Chữ đó không có trong mã (#hypothesis: lớp chặn của gateway Hermes, hoặc mô hình diễn lại lỗi 401). Bot trả mã trơ và để mô hình tự giải thích | Mỗi mã một câu cố định; công cụ đọc yêu cầu gửi nguyên văn | chưa (EV-03, EV-16) |
| (b) `SCOPE_DENIED` | Một mã cho bốn nguyên nhân, nên không biết ca thuộc trường hợp nào | `reason` phân biệt bốn trường hợp; bot nói đúng | chưa (EV-04, EV-17) |
| (c) ticket 20/11 (tệp lớn, Excel, hết giờ chờ, quyền thư mục) | Không có hồ sơ trong repo | Lý do tệp hỏng, tệp Excel, hết giờ chờ ở màn hình nhập. «Quyền thư mục» nằm ngoài mã repo | chưa (EV-05, EV-30–32). Còn lỗi: chưa biết, vì thiếu hồ sơ |
| (e), (f) lịch họp và nhắc theo lịch | — | chưa (F) | chưa (EV-07, EV-08) |

## Câu mới (không chặn)

Cuối `docs/OPEN-QUESTIONS.md`:
- Q-GV5D-1: tin bị từ chối lúc tiếp nhận vẫn không có câu trả lời trong nhóm;
- Q-GV5D-2: cách che ghi chú IBS HI;
- Q-GV5E-1: ai được gỡ liên kết;
- Q-GV5E-2: không nối lại đúng cặp đã gỡ.

## Bản 0.9.3

- Tệp: `~/Documents/libetech-releases/libetech-ai-os-0.9.3-20261126.tar.gz`, đóng gói từ merge `cf1f2ca` trong một worktree sạch bằng `scripts/package-release.py`. 404 tệp, gồm migration 029, 030 kèm rollback và plugin **0.3.5**.
- SHA-256 của tệp: `673a6fb600ce4790feab7c0ff5f2b8009feb6b4f1c650fef4e29377febcf0a5f` (tệp `.sha256` nằm cạnh; `shasum -a 256 -c` báo OK).
- `treeSha256`: `ed28629005d6e45896bdb9218ba0139b936365698c3470ac6e9c6949103f9664`. `deploy/verify-bundle.py` báo `Bundle verified` trên bản giải nén.
- Runbook: `docs/RUNBOOK-093-20261126.md`. **Plugin đổi, nên phải khởi động lại gateway chung**: ngoài giờ, có lời Chairman, rồi kiểm 20/20 bot.
- Kịch bản nghiệm thu: `docs/ACCEPTANCE-GV5-20261125.md` bản 1.2 (kịch bản 4, 5, 13).

## Vướng

- **F chưa viết mã.** Hàng đi hiện nay chỉ trả lời tin đã nhận: CSDL buộc mỗi tin vào nhóm phải gắn một tin nguồn. Nhắc theo lịch cần bot tự gửi vào nhóm, gồm tên người còn thiếu bằng chứng, tức là mở một đường gửi mới. Kế hoạch ở `docs/plans/gv5-f-reminders.md` (nhánh `feat/gv5-f-reminders`), chờ duyệt trước khi viết mã.
- Bằng chứng từ máy chủ và người báo: EV-03, EV-04, EV-05, EV-16, EV-17, EV-30, EV-31, EV-32.
- Hồ sơ triển khai 022/023 và 0.9.1, 0.9.2 chưa có trong repo.
