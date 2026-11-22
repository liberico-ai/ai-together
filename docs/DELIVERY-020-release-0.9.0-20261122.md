# DELIVERY-020 — Bản phát hành 0.9.0: hợp nhất bản đang chạy vào `libetech-ai-os`

Ngày 22/11/2026 · nhánh `release/ai-os-0.9.0` → `libetech-ai-os` · phiên Claude Code điều phối

## Căn cứ

- Chỉ đạo của Chairman ngày 22/11/2026 08:10, chép nguyên: «Không cần thử, các dự án đang chạy có thể sửa. Chạy chính là thử nghiệm. Bạn xem lại phương án đi, golive và merge luôn và thử trên thực tế».
- Giao việc 2 của Cowork điều phối (bản sửa 08:15, 22/11/2026), do người dùng dán vào phiên này. Giao việc gồm:
  - cherry-pick bảy commit của `codex/libetech-pm-release-20261118`;
  - web 0.9.0, cầu nối giữ 0.3.2;
  - chạy bộ kiểm có sẵn, không viết ca mới;
  - một vòng Codex, chỉ P0 chặn merge;
  - merge PR này rồi PR #34;
  - đóng gói từ commit đã merge.
- Phiên này không thấy lời gốc của Chairman; lời trên được ghi theo đoạn dán.

## Commit

Gốc chung của hai nhánh là `4f12a3c`. Từ gốc đó, nhánh release sửa 9 tệp và `libetech-ai-os` không sửa tệp nào trong 9 tệp ấy (đã đếm: 0 tệp chung).

| Commit gốc (nhánh release) | Commit trên nhánh này | Nội dung |
|---|---|---|
| `4a72924` | `bc32017` | chuẩn bị PM 0.8.0, cầu nối 0.3.0 |
| `a49d316` | `7567afe` | nối đường tiếp nhận của gateway và outbox Telegram định kỳ (`deploy/libetech-ai-os-outbox.service`, `.timer`) |
| `069d506` | `c2bfff5` | đóng gói mẫu PM và manifest kỹ năng |
| `18026a9` | `073a1cf` | lấy lại người gửi Telegram từ sự kiện thô |
| `77bcc08` | `e19f226` | giữ mention Telegram cho biên nhận tiếp nhận |
| `8cc81ec` + `56ac38a` | `7c73767` | hồ sơ hotfix và nghiệm thu thật (`docs/DEPLOY-004-pm-intake-hotfix-20261118.md`) |
| — | `eb1da6f` | web 0.9.0 (`package.json`, `package-lock.json`); ghi 0.8.0 và 0.9.0 vào roadmap |

- **Lệch duy nhất so với giao việc:** hai commit docs cuối được gộp làm một, vì `8cc81ec` mang một chat id Telegram thật mà `56ac38a` đã xoá; gộp lại thì chữ đó không vào lịch sử `libetech-ai-os`.
- Cả 9 tệp sau `7c73767` trùng từng blob với đầu nhánh release `56ac38a`. Năm commit mã giữ dòng `(cherry picked from commit …)`.

## Bộ kiểm (chạy ở `eb1da6f`; các commit sau chỉ thêm tệp trong `docs/`)

Tóm tắt có số liệu ở `docs/reviews/release-0.9.0-evidence/checks-summary.txt`; log thô không commit.

| Lệnh | Kết quả |
|---|---|
| `npm ci` | thoát 0 |
| `npm run typecheck` | thoát 0 |
| `npm run build` | thoát 0 |
| `npm run test` (vitest 5.1.0) | 71 tệp đạt, 14 tệp bỏ qua (85); **1333 ca đạt, 150 ca bỏ qua (1483)**; 558 giây |
| `python3 -m pytest -q tests/test_bot_bridge.py` | 76 đạt, 69 subtest đạt |
| `python3 -m pytest -q tests/test_install_user.py` | 70 đạt, 55 subtest đạt |
| `dashboard-plugin`: `python3 -m unittest discover -s tests` | 14 ca, OK (bản không có PR #34) |

**150 ca bỏ qua không chạy.** Chúng bị chặn bởi `skipIf(!native)` và cần một PostgreSQL thật qua biến môi trường (`SLICE1_TEST_DATABASE_URL`); biến này không đặt ở lần chạy này. Theo chỉ đạo «Không cần thử», không dựng môi trường thử. Phần còn lại chạy trên PGlite. Đây là thiếu sót của bằng chứng, không phải kết quả đạt của các ca đó.

Không viết ca kiểm mới.

## Cổng Codex — một vòng

Chạy một vòng, ngày 22/11/2026, `codex exec --sandbox read-only`. Đầu vào: lời nhắc chuẩn, khối ngữ cảnh `docs/reviews/release-0.9.0-gate-context.md`, và phần diff mã (`bot-plugin`, `deploy`, `scripts`, `tests`, `package.json`, `package-lock.json`; 36 837 ký tự cả đầu vào). Phần còn lại Codex đọc từ cây làm việc. Transcript không commit. Kết quả: `docs/reviews/REVIEW-release-0.9.0.md`.

**Dòng đầu của kết quả: `VERDICT: CHANGES_REQUIRED`** — một P0 và một P1. Không phải «đạt».

1. **[P0] `deploy/libetech-ai-os-outbox.service:9`** — unit chạy Python trong profile gateway do `iptech` quản lý mà không khai `User=`; cài làm system service thì chạy bằng root. Kịch bản của Codex: `iptech` hoặc plugin bị chiếm → sửa `__init__.py` → timer chạy mã đã sửa bằng root.
   - **Kiểm của phiên này (chỉ đọc mã):**
     - unit không có `User=`/`Group=`; có `NoNewPrivileges=yes`, `PrivateTmp=yes`, `ProtectSystem=full`;
     - không tệp nào trong repo cài unit này (chỉ timer nhắc tới nó);
     - `deploy/install-d1.sh` cài unit hệ thống (unit web, vào `/etc/systemd/system`) và không cài unit này;
     - `deploy/install-user.py` cài unit `systemd --user` dưới `iptech`, không sudo, và chính unit web của nó tên `libetech-ai-os.service` — unit outbox có `After=libetech-ai-os.service`, khớp tuyến này;
     - `docs/DEPLOY-004-pm-intake-hotfix-20261118.md` đặt bản chạy dưới `/home/iptech/.local/share/libetech-ai-os/releases`, bố cục của tuyến user.
   - **Kết luận: không xác nhận được.** P0 chỉ đúng nếu unit outbox đang chạy trên d1-ai1 là unit hệ thống. Chế độ cài của unit đang chạy không được ghi trong repo, và phiên này không vào được d1-ai1. Nếu là unit `--user` dưới `iptech` thì không có root và `User=` không cần (thêm `User=` vào unit user có thể làm nó hỏng; chưa kiểm).
   - **Việc cho Codex trước khi thay unit đang chạy:** xác nhận unit outbox là unit user hay unit hệ thống. Nếu unit hệ thống: thêm `User=iptech`, `Group=iptech`, và kiểm chủ sở hữu các tệp mà lần chạy bằng root đã tạo trong profile (tệp do root tạo có thể làm gateway không ghi được). Nếu unit user: đóng là không áp dụng, và thêm một dòng chú thích vào unit cho biết nó dành cho `systemd --user`.
2. **[P1] `bot-plugin/__init__.py:883`** — hàng đợi tin tiếp nhận chỉ được gửi lại khi có tin mới; timer outbox không xả nó.
   - **Kiểm: đúng.** `submit_event` (`:846`) là đường duy nhất xả `intake-spool.jsonl` và chỉ được gọi từ móc của gateway cho mỗi tin (`:955`); `outbox_worker_main` (`:1383`) chỉ xả outbox. Một tin vào hàng đợi lúc 023 giữ khoá quá `HOOK_TIMEOUT` (2 giây) nằm đó tới khi có tin kế tiếp.
   - Có từ trước, trong mã 0.8.0 đang chạy; bản này không làm nó tệ hơn. Chạm đúng việc N2 kiểm khi áp 023. Sửa (cho timer cũng xả hàng đợi) sau go-live.

**Phán quyết của người dùng ở phiên điều phối, ngày 22/11/2026** (chọn qua hộp chọn; chép nguyên nhãn đã chọn, không phải lời Chairman):

- Cho P0: «Merge, record P0 as unconfirmed (Recommended)».
- Cho P1: «Record, fix after go-live (Recommended)».

Giao việc nói chỉ P0 chặn merge; P0 này được cho đi tiếp vì không xác nhận được ở chế độ cài đang chạy, và việc kiểm đó giao Codex ở bước go-live.

## Bản này thêm gì so với 0.8.0 đang chạy — Codex cần biết trước go-live

- **Mã đã merge vào `libetech-ai-os` sau `4f12a3c`:** PR #22 tới #32, gồm 16 tệp mã ở `src/server`, `migrations` và `deploy`.
  - `src/server/db.ts` có N1 (#31) và `transaction()` ném lỗi khi `COMMIT` trả `ROLLBACK` (#32). Hai thay đổi này áp cho mọi lần ghi.
  - Các tệp kỹ năng và nháp AI (#22, #24) chỉ chạy khi bật Z4; Z4 vẫn chưa bật.
  - Bộ cài phục hồi N4 (#28).
- **Migration 022 và 023** (0.8.0 dừng ở 021). 023 tự từ chối, không ghi gì, trong các trường hợp sau:
  - login áp không phải superuser;
  - có login hành động như `libetech_ai` đang kết nối;
  - quá trần số bản chưa có số (mặc định 250 000);
  - có nháp AI của ứng viên tiếp nhận chưa ai quyết trong khi còn bản chưa số.
- Trước khi áp, chạy `deploy/pre-023-check.sql`. Câu này chỉ đọc, và Chairman đã cho phép đếm trên CSDL phục vụ ngày 22/11/2026.
- Theo chỉ đạo «Không cần thử», thời gian giữ khoá của 023 **chưa được đo** (ngưỡng Chairman nêu cùng ngày: < 500 ms). Khi 023 chạy, gateway có thể chờ và gửi lại tin, theo `docs/RUNBOOK-PRE-023-N1-N3.md` mục 3.2.
- **N1:** giao dịch bỏ nhàn tự kết thúc sau 30 giây ở mọi pool (PR #31). Có hiệu lực khi web mới chạy.
- **Rollback:** có tệp ngược cho 022 và 023 trong `migrations/rollback/`. Runner không quét thư mục đó, và theo `AGENTS.md` không chạy rollback trên CSDL thật khi chưa có Chairman duyệt.
- **Chưa đóng, không chặn theo chỉ đạo trên:**
  - N2 (gateway thật khi luồng bị chặn);
  - N4: hai bộ cài chưa chạy được đầu-cuối từ cây này; OQ-59 (b) (1) chưa có mã;
  - kế hoạch triển khai có bản sao lưu đã thử phục hồi.
- **Dashboard plugin** (`hermes.libetech.vn`, PR #34) **không nằm trong gói**: `scripts/package-release.py` không đóng `dashboard-plugin/`. Plugin cài qua Hermes Git admission, ghim commit.
- **Gói không chứa `data/`.** Gói được dựng từ một cây sạch, nên không có dữ liệu team (thư mục đó bị gitignore).

## Bốn mức

- **Đã có mã:** có — nhánh này, merge vào `libetech-ai-os` theo mục «Sau merge».
- **Đã triển khai:** phần 0.8.0 có, theo `DEPLOY-004` (Codex ghi). Bản 0.9.0 chưa; Codex làm.
- **Đã dùng thật:** phần 0.8.0 có một lần nghiệm thu tiếp nhận thật (`PMTEST-084`, `DEPLOY-004`). Phần thêm của 0.9.0 (PR #22–#32, trong đó có 022, 023 và N1) chưa.
- **Đã nghiệm thu:** chưa.

## Sau merge

Điền sau merge bằng một PR docs bổ sung: commit đã merge, đường dẫn gói, băm gói. Chúng không thể nằm trong chính PR này vì gói dựng từ commit đã merge.
