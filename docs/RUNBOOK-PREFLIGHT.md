# Runbook — kiểm trước khi cài và nâng bản (`deploy/preflight.py`)

Version 1.0 · 28/11/2026 · gói 0.9.8 (lát V1) · tham chiếu: `deploy/preflight.py`, `deploy/install-d1.sh`, `docs/RUNBOOK-095-20261127.md`, `docs/RUNBOOK-RESTORE-AFTER-023.md`

**Trạng thái:** đã có mã và bộ ca kiểm; **chưa chạy trên d1-ai1**. Phiên làm mã không vào máy chủ, không chạm d1-ai1, không gửi tin Telegram. Người vận hành (Codex) chạy lệnh này trên d1-ai1 khi có lời Chairman cho từng đợt cài hoặc nâng bản.

Runbook này quy định bước kiểm bắt buộc **trước mọi lần cài mới hoặc nâng bản** trên d1-ai1, và quy tắc kiểm bắt buộc **sau mỗi lần nâng plugin**.

## 0 · Vì sao phải có bước này

- **Sự cố thực tế 27–28/11/2026:** một bản sao lưu plugin `0.3.2` nằm trong thư mục Hermes quét plugin, cùng `name: libetech-ai-os-bridge`, đã đè lên bản `0.3.6` đang cài. Kết quả: bot chạy mã cũ dù tệp trên đĩa của bản `0.3.6` khớp SHA-256 và `/api/health` vẫn báo `ready`.
- **Rủi ro unit và gói:** cài nhầm unit `--user` (như `libetech-ai-os-outbox.service` không có `User=`) vào `/etc/systemd/system/` sẽ khiến unit chạy bằng `root` trên tệp thuộc `iptech` (`DELIVERY-020`, finding P0); `release.env` lệch gói hoặc `schema_migrations` có khe hở/đi trước gói sẽ làm đợt nâng sai bản.
- Không in token, mật khẩu, khoá, `.env` chứa bí mật hay mã nhóm Telegram vào log, PR hay kênh chung.

## 1 · Năm phép kiểm của `deploy/preflight.py`

Kịch bản chỉ dùng thư viện chuẩn Python và chạy bằng `python3 -I` (chế độ cô lập, không nạp mô-đun từ thư mục làm việc). Kết quả là một khối JSON trên stdout; mã thoát `0` chỉ khi `"ok": true`, khác `0` ⇒ **dừng, không cài và không nâng tiếp**.

| Mục | Kiểm gì | Khi nào đỏ (dừng) |
|---|---|---|
| **(a) Plugin trùng tên trong mọi thư mục Hermes quét** | Quét mặc định `<profile>/plugins` (`/home/iptech/.hermes/profiles/libetech/plugins`), `~/.hermes/plugins`, `~/.hermes/hermes-agent/plugins` (hoặc danh sách `--plugin-scan-dir` chỉ định rõ), gồm cả thư mục lồng và symlink (có chặn vòng lặp). Đọc `plugin.yaml` và `VERSION` trong `__init__.py`. | Có từ 2 bản trở lên cùng `name` (`PREFLIGHT-PLUGIN-DUPLICATE`) — báo rõ danh sách bản và **bản nào sẽ thắng** (mặc định `last-wins` theo thứ tự sắp tên, hỗ trợ `--precedence first-wins`; OQ-63); `plugin.yaml` hỏng/thiếu `name` (`PREFLIGHT-PLUGIN-MANIFEST-INVALID`); `plugin.yaml` lệch `VERSION` trong `__init__.py` (`PREFLIGHT-PLUGIN-VERSION-MISMATCH`); ở `--mode install`, plugin cầu nối đã tồn tại dưới bất kỳ tên thư mục nào (`PREFLIGHT-PLUGIN-ALREADY-EXISTS`). |
| **(b) `release.env` khớp gói (digest và version)** | Tính lại `treeSha256` từ `deploy/BUNDLE-MANIFEST.json`, so với `package.json` (`version`), kiểm hash mọi tệp liệt kê trong gói và không có tệp lạ/symlink/bytecode, kiểm `bot-plugin/plugin.yaml` khớp `bot-plugin/__init__.py`. Đối chiếu `release.env` (chỉ đọc khoá allowlist không bí mật). | Tệp gói lệch hash hoặc phiên bản (`PREFLIGHT-BUNDLE-INVALID`, `PREFLIGHT-BUNDLE-VERSION-MISMATCH`); `release.env` vắng/symlink/world-writable/sai cú pháp (`PREFLIGHT-RELEASE-ENV-*`); digest (`LIBETECH_BUILD_DIGEST` / `LIBETECH_BUNDLE_TREE_SHA256`) lệch `treeSha256` (`PREFLIGHT-RELEASE-DIGEST-MISMATCH`); phiên bản (`LIBETECH_RELEASE_VERSION` / `RELEASE_VERSION`) lệch `package.json` (`PREFLIGHT-RELEASE-VERSION-MISMATCH`); `LIBETECH_PLUGIN_VERSION` (nếu có) lệch plugin của gói (`PREFLIGHT-RELEASE-PLUGIN-VERSION-MISMATCH`); `--archive` (nếu có) lệch `LIBETECH_ARCHIVE_SHA256` (`PREFLIGHT-ARCHIVE-SHA-MISMATCH`). |
| **(c) Sổ migration (`schema_migrations`)** | Kiểm tập `migrations/*.sql` của gói (không trùng số, liên tục từ `001`, mọi migration từ `013` có tệp đối ứng trong `migrations/rollback/`). Ở chế độ nâng bản, đọc chỉ-đọc (`BEGIN READ ONLY` + `default_transaction_read_only=on`) bảng `public.schema_migrations` qua `psql` (mật khẩu chỉ đi qua biến môi trường, không lên dòng lệnh `argv`). | Gói thiếu rollback từ `013`, trùng số hoặc khuyết số (`PREFLIGHT-MIGRATION-*`); thiếu cấu hình kết nối CSDL khi nâng bản (`PREFLIGHT-LEDGER-DB-REQUIRED`); thiếu bảng `schema_migrations` (`PREFLIGHT-LEDGER-TABLE-MISSING`); CSDL có phiên bản đi trước gói (`PREFLIGHT-LEDGER-UNKNOWN-APPLIED`); CSDL khuyết phiên bản ở giữa (`PREFLIGHT-LEDGER-GAP`); mốc cao nhất khác `--expected-schema-max` (`PREFLIGHT-LEDGER-UNEXPECTED-STATE`). |
| **(d) Unit chạy bằng user nào** | Đọc mọi `libetech-*.service` (kèm thư mục drop-in `*.service.d/*.conf` theo thứ tự chữ cái) trong `/etc/systemd/system` và `/home/iptech/.config/systemd/user` (và mẫu `deploy/libetech-ai-os.service` ở chế độ cài mới). Báo rõ phạm vi (`system` / `user`) và `effective_user` của từng unit. | Bất kỳ system unit nào thiếu `User=` hoặc chạy bằng `root`/`0`, kể cả do drop-in ghi đè (`PREFLIGHT-UNIT-RUNS-AS-ROOT`); unit `--user` khai `User=`/`Group=` (`PREFLIGHT-USER-UNIT-INVALID-DIRECTIVE`); cùng tên unit tồn tại ở cả system lẫn user (`PREFLIGHT-UNIT-DUPLICATE-SCOPE`); user thực tế khác `--expected-web-user` hoặc `--expected-unit-user` (`PREFLIGHT-UNIT-USER-MISMATCH`). |
| **(e) Thư mục sao lưu nằm ngoài đường quét** | Chuẩn hoá đường dẫn thật (`realpath`, đi qua symlink) của mọi `--backup-dir` so với mọi thư mục Hermes quét; đồng thời quét các thư mục Hermes tìm dấu vết sao lưu (`*.bak*`, `*backup*`, `*.old*`, `*.orig*`, `*.prev*`, `*.disabled*`, `*.tar.gz`, `*.zip`, `*~`). | `--backup-dir` nằm trong hoặc trùng đường quét (`PREFLIGHT-BACKUP-INSIDE-SCAN-DIR`); `--backup-dir` bao trùm đường quét (`PREFLIGHT-BACKUP-CONTAINS-SCAN-DIR`); thiếu `--backup-dir` ở chế độ nâng bản (`PREFLIGHT-BACKUP-DIR-MISSING`); có tệp/thư mục dạng sao lưu nằm ngay trong đường quét Hermes (`PREFLIGHT-BACKUP-ARTIFACT-IN-SCAN-DIR`). |

## 2 · Quy ước tệp `release.env` (không chứa bí mật)

Tệp `release.env` đặt cạnh cấu hình bản cài (quyền `0600` hoặc `0640`, không symlink, không world-writable), chỉ chứa metadata của bản phát hành đích (chi tiết chờ xác nhận: `OQ-64` trong `docs/OPEN-QUESTIONS.md`):

```dotenv
LIBETECH_RELEASE_VERSION=0.9.8
LIBETECH_BUILD_DIGEST=<64 chữ số hex thường = treeSha256 của gói>
LIBETECH_PLUGIN_VERSION=0.3.6
```

Có thể kèm `SOURCE_SHA=<40 hex>` hoặc `LIBETECH_ARCHIVE_SHA256=<64 hex>`. **Tuyệt đối không đặt** `DATABASE_URL`, mật khẩu, token Telegram, khoá cầu nối hay mã nhóm trong `release.env`. Kịch bản `preflight.py` chỉ đọc các khoá nằm trong danh sách allowlist ở trên và không bao giờ in giá trị bí mật hay dòng gốc khi báo lỗi.

## 3 · Cách chạy trước khi nâng bản trên d1-ai1

1. Giải nén gói phát hành vào thư mục mới và kiểm độc lập SHA-256 của tệp nén (`shasum -a 256`) cùng `python3 deploy/verify-bundle.py <thư mục gói>`.
2. Đặt thư mục sao lưu **ngoài mọi thư mục Hermes** (khuyến nghị: `/home/iptech/.local/share/libetech-ai-os/backups` ở tuyến user `iptech`, hoặc `/var/lib/libetech-ai-os/backups` ở tuyến root `libetech-os`).
3. Chạy kiểm trước khi nâng bản (thay đường dẫn và mốc `--expected-schema-max` theo đúng đợt):

```bash
PREFLIGHT_DATABASE_URL="$MIGRATION_DATABASE_URL" \
python3 -I <thư mục gói>/deploy/preflight.py \
  --mode upgrade \
  --bundle <thư mục gói> \
  --release-env /home/iptech/.local/share/libetech-ai-os/config/release.env \
  --backup-dir /home/iptech/.local/share/libetech-ai-os/backups \
  --expected-web-user iptech \
  --expected-schema-max 032
```

- Nếu có thêm thư mục Hermes quét ngoài 3 đường mặc định, truyền đủ từng thư mục bằng `--plugin-scan-dir <đường dẫn>` theo đúng thứ tự quét.
- Nếu kết quả trả `"ok": false` (mã thoát `1`): **dừng ngay**, xử lý đúng mã lỗi (ví dụ di chuyển bản sao lưu plugin ra khỏi đường quét Hermes sang `--backup-dir`), rồi chạy lại tới khi `"ok": true` (mã thoát `0`).

## 4 · Tự động chạy trong `deploy/install-d1.sh` (cài mới)

`deploy/install-d1.sh` tự chạy `python3 -I "$snap/deploy/preflight.py"` từ bản chụp chỉ-root `$snap` ngay sau khi kiểm chữ ký cây gói `check_bundle "$snap"` và **trước mọi thay đổi hệ thống** (`apt-get`, `useradd`, `install -d`, `pg_createcluster`, `pg_restore`). Nếu `preflight.py` trả khác `0`, bộ cài dừng ngay và không tạo bất kỳ tệp hay CSDL nào.

- Nếu người vận hành có tệp `release.env`, truyền `LIBETECH_RELEASE_ENV=<đường dẫn>` qua `sudo`; nếu thay đường sao lưu mặc định (`/var/lib/libetech-ai-os/backups`), truyền `LIBETECH_BACKUP_DIR=<đường dẫn>`.

## 5 · Bắt buộc sau mỗi lần nâng plugin: thử một lệnh Telegram thật

> **QUY TẮC BẮT BUỘC — `/api/health` và SHA-256 tệp trên đĩa KHÔNG ĐỦ.**

Một tệp plugin trên đĩa khớp SHA-256 và `/api/health` trả `ready` **không chứng minh** gateway đang nạp đúng phiên bản plugin mới trong bộ nhớ (bản sao trùng tên ở đường quét khác hoặc lỗi nạp nóng có thể giữ bản cũ chạy ngầm, đúng như sự cố 27–28/11/2026).

Sau **mỗi lần nâng plugin và khởi động lại gateway** (ngoài giờ, khi có lời Chairman), người vận hành **bắt buộc** phải thực hiện đủ 3 bước sau trước khi kết luận nâng plugin đạt:

1. **Chạy lại kiểm plugin** (xác nhận không còn bản trùng tên hay tệp sao lưu sót trong đường quét Hermes).
2. **Kiểm tra gateway đủ hồ sơ kết nối** (`20/20` bot, không có traceback mới của plugin).
3. **Thử tối thiểu một lệnh Telegram thật** bằng tài khoản đã liên kết trong phạm vi được duyệt (ví dụ `/libetech_check` ở tin riêng hoặc nhóm thử được phép; không gửi vào nhóm sản xuất ngoài phạm vi duyệt), ghi lại thời điểm, hành vi/mẫu trả lời đặc trưng của phiên bản mới (để phân biệt được với bản cũ) và đối chiếu dấu vết tương ứng phía AI OS. Chỉ khi lệnh Telegram thật xác nhận đúng hành vi phiên bản mới mới được ghi đã kiểm sau nâng plugin.
