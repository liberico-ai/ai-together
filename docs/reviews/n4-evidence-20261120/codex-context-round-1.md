## Việc (không phải lát 1–5)

N4 của `docs/DELIVERY-016-oq-53-subject-order-and-revisions-20261119.md` mục «Điều kiện» (kèm N12 một nửa, N15 phần quy tắc, phần dư L7/L12): sửa quy trình và bộ cài phục hồi dữ liệu để một bản lưu lấy **sau** migration 023 phục hồi được. PR riêng vào `libetech-ai-os`, không vào `main`. Không triển khai d1-ai1, không áp migration lên dữ liệu thật, không bật Z4. Mọi PR cần Chairman duyệt merge.

Đầu vào cổng này là **diff của mã và tài liệu vận hành** (`deploy/`, `tests/`, `docs/RUNBOOK-RESTORE-AFTER-023.md`, `docs/DEPLOY-002.md`, `.gitignore`) so với `origin/libetech-ai-os`, vì cả nhánh vượt giới hạn đầu vào của CLI. Hãy đọc từ cây làm việc: `docs/plans/n4-restore-after-023.md` (kế hoạch; mục 11: điều hai cổng trên kế hoạch đã đổi), `docs/DELIVERY-017-n4-restore-after-023-20261120.md` (biên nhận), `docs/reviews/n4-evidence-20261120/` (log đã quét đường dẫn và `gates/tier1-dispositions.md`), `migrations/023_thread_order.sql` (header và bước 7–11), `docs/reviews/oq-53-evidence-20261119/gates/class-sweep-database.md` mục CS-DB-2 và CS-DB-8. Không có `psql`, `pg_dump` hay container trong môi trường của bạn: các số đo đã nằm ở log.

## Điều đã đo (PostgreSQL 16.15, `pg_dump`/`pg_restore`/`psql` thật)

1. Lệnh nạp cũ của hai bộ cài (`pg_restore --data-only --single-transaction`, không `--disable-triggers`) lỗi với bản lưu sau 023 (`The thread of the candidate moved on` ở `COPY draft_decisions`; `duplicate key value` ở `COPY intake_thread_heads`) và, độc lập 023, với **mọi bản lưu có tài liệu** (`fk_document_records_latest_revision`): hai khoá ngoại không hoãn được trỏ vào nhau.
2. `--disable-triggers` nạp được nhưng đưa trigger cấp số của 023 từ `A` về `O`; 023 chấp nhận cả hai nên đường `session_replication_role = replica` mở lại không dấu hiệu nào. Vì thế có `deploy/post-restore.sql`.
3. `--disable-triggers` tắt cả mười một trigger `BEFORE INSERT` (không chỉ của 023). Chấp nhận có ghi: biên giới là kênh chuyển tệp + SHA-256; `post-restore.sql` kiểm lại khoá ngoại và các bất biến của 023, không kiểm lại bất biến của guard 019/021/022.

## Đã đóng, không ghi phần dư (các lớp mà cổng ở PR trước đã không nhận phần dư)

- **Lộ dữ liệu qua đầu ra/log:** `deploy/post-restore.sql` và `deploy/pre-restore.sql` chỉ nêu mã cố định + số đếm, đổi lỗi của PostgreSQL thành `-98`/`-99` kèm SQLSTATE; `psql -v VERBOSITY=terse -v SHOW_CONTEXT=never`; `install-user.py` chỉ in các mã; `install-d1.sh` đưa lời lỗi của `pg_restore` vào một tệp chỉ root đọc và không in; log và biên nhận đã quét đường dẫn máy, chat ID, tên người dùng.
- **Kiểm-rồi-dùng:** bản lưu được đọc một lần, từ bản chép riêng đã kiểm băm (`LIBETECH_ARCHIVE_SHA256` từ người vận hành); `install-d1.sh` chụp bundle một lần vào thư mục chỉ root vào được, kiểm bản chụp với digest của lần kiểm đầu, và mọi thứ chạy bằng root/postgres đọc từ đó; `install-user.py` nạp `restore-plan.py` sau `verify_bundle`, từ bytes mà manifest liệt kê.
- **Fail-open của `$(…)`:** mỗi giá trị đọc vào biến riêng và kiểm (danh sách bảng, cờ nạp); danh sách bảng rỗng ⇒ từ chối; mã thoát 0 mà không có dòng JSON `pass` + `thread_order: checked` là thất bại.
- **Tệp chạy với quyền cao nằm ngoài manifest:** hai bộ cài từ chối nếu bốn tệp phục hồi không nằm trong manifest hoặc nếu tập migration áp không đúng bằng tập manifest liệt kê.

## Chấp nhận có ghi (nói nếu bạn thấy cách ghi chưa đúng)

Hai bộ cài **không chạy được đầu-cuối từ cây này** (`deploy/BUNDLE-MANIFEST.json` là của 0.2.0, đã đo; `verify-bundle.py` đã báo `Bundle mismatch` trước PR) nên bước của chúng được ghim bằng ca đơn vị/thứ tự, và đường được diễn tập thật là runbook với công cụ thật (`tests/restore-rehearsal.test.ts`, 17 ca). Phần còn lại ở `docs/DELIVERY-017-n4-restore-after-023-20261120.md` mục «Còn mở và phần dư» và `docs/OPEN-QUESTIONS.md` OQ-59 (cuối tệp; chờ Chairman).

## Hãy soi kỹ

Đúng/sai thật của `deploy/post-restore.sql` (khối `DO` nguyên tử, cờ hoàn thành, lần ghi thử hoàn tác, phép 04–09), của `deploy/restore-plan.py` và hai bộ cài; ca test có THỰC SỰ kiểm điều chúng tuyên bố không; biên nhận có gọi mức «đã triển khai/đã dùng thật/đã nghiệm thu» khi bằng chứng chỉ tới «đã có mã» và «đã thử phục hồi trên CSDL thử» không.
