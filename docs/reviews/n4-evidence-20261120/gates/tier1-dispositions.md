# Review tầng 1 trên mã của N4 — từng finding và cách xử lý

Ba ghế (agent `liberico-security-reviewer` quét theo lớp, `liberico-code-reviewer`, `liberico-database-reviewer`) soát `83db855` + `1671f75`. Không P0. «Đóng» = mã và ca đã sửa ở `97a05e0` hoặc sau đó; «ghi» = không sửa, ghi ở `DELIVERY-017` mục «Còn mở». Hai cổng trên **kế hoạch** (trước khi mã vào repo): `docs/plans/n4-restore-after-023.md` mục 11. Báo cáo gốc của agent không được lưu thành tệp; bảng này là bản ghi.

## Bảo mật (1 P1, 6 P2, 7 P3)

| Mức | Finding | Xử lý |
|---|---|---|
| P1 | `install-d1.sh`: tệp chạy bằng root/postgres đọc lại từ `$bundle` sau nhiều phút; `python3` không `-I` | **Đóng, ba lượt.** Lượt 1 chuyển sang bản chép dưới `/opt` và kiểm lại ở đó; kiểm tra tự động của máy chỉ ra đó là bộ kiểm tự kiểm (bản dựng của một tài khoản khác ghi vào cùng cây). Lượt 2: **một bản chụp** bundle vào thư mục chỉ root vào được; bản chụp được kiểm và mọi thứ chạy bằng root/postgres đọc từ đó. Lượt 3 (cổng Codex vòng 1, P0 cùng loại: `verify-bundle.py` vẫn chạy từ bundle trước khi chép): **không chạy gì từ bundle trước khi chép**; bộ kiểm nằm trong chính script (digest tính lại, hash từng tệp, không symlink, không tệp ngoài manifest ở `deploy/` và `migrations/`, bốn tệp phục hồi có trong manifest) và `LIBETECH_BUNDLE_TREE_SHA256` tuỳ chọn; ca U6d, U6h chạy bộ kiểm trên cây thật; `python3 -I` cho mọi lệnh trừ `provision-server.py` (cần PyYAML; chạy từ bản chụp). Ca U6d, U6e |
| P2 | `migrations/*.sql` chạy mọi tệp glob, kể cả tệp manifest không liệt kê | **Đóng.** Tập migration áp phải đúng bằng tập manifest liệt kê (`check_manifest`, `require_restore_files(…, bundle)`). Ca U9 |
| P2 | `restore-plan.py` bị `exec` lúc import, trước `verify_bundle` | **Đóng.** Nạp lười từ bytes đọc một lần, sau `verify_bundle`, và phải là tệp manifest liệt kê. Ca U9 |
| P2 | «đọc MỘT lần» sai: `archiveHash` lấy từ lần đọc thứ hai; biên nhận ghi trước `hold_archive`; bản chép không bị xoá | **Đóng.** `hold_archive` chạy trước mọi biên nhận; biên nhận ghi băm đã kiểm; bản chép xoá khi lần phục hồi qua (và khi sai băm); runbook nêu giới hạn của bản chép cùng tài khoản. Ca U7 |
| P2 | fail-open: `--tables ""` cho danh sách rỗng, kiểm phủ bảng đậu vô điều kiện | **Đóng.** Danh sách rỗng hoặc thiếu `public.projects` ⇒ từ chối; bash gán từng giá trị vào biến riêng và kiểm. Ca U10, U6f |
| P2 | fail-open: `pg_restore $(python3 …)` chạy không cờ nếu python lỗi | **Đóng.** `restore_args=$(…)` riêng, đủ năm cờ mới nạp, `read -ra`. Ca U6f |
| P2 | lời lỗi của `pg_restore` và của 023 không lọc ở `install-d1.sh`; runbook nói «chỉ in mã» | **Đóng.** `2> "$work/restore.err"` (root-only, không in); `psql` 023 thêm `terse`; runbook sửa chữ: bash không in lời lỗi, Python chỉ in mã. Ca U6c, U6g |
| P3 | `pre-restore` chạy `quiet` nên `PRE-RESTORE-02` không hiện | **Đóng.** `run_pre_restore` trích mã. Ca U8 |
| P3 | thông điệp quy mọi lỗi áp lại 023 cho ba lý do | **Đóng.** «một trong các lý do… và có thể dừng vì lý do khác», kèm mã thoát |
| P3 | `RESET` quay về mặc định của DB/role | **Đóng.** `SET libetech.post_restore_done = 'off'`; cổng thứ hai từ catalog |
| P3 | một chuỗi mười ba chữ số trong ca Python có dạng chat ID siêu nhóm thật | **Đóng.** Dùng dạng ngắn `-10012345` của repo |
| P3 | `expect(r.err)` in nguyên stderr; `.vitest/` chưa ignore | **Đóng.** `errLines()`/`first()`; `.gitignore` |
| P3 | bản chép của bash nằm ở `/tmp` | **Đóng.** `/root/.libetech-restore.*`, xoá sau khi qua |
| P3 | tài liệu dẫn `DELIVERY-017`/thư mục bằng chứng chưa có; số bước runbook sai; header «một khoá» | **Đóng.** Có trong PR; runbook và header sửa |

## Mã (0 P1, 7 P2, P3)

| Mức | Finding | Xử lý |
|---|---|---|
| P2 | băm bản lưu chỉ kiểm trong `finish_install` (sau apt/initdb/migrate); `--inspect-only` không băm | **Đóng.** `archive_digest` trước `--inspect-only` và trước khi tạo gì; `hold_archive` là cổng cuối |
| P2 | `archiveHash` từ lần đọc thứ hai | **Đóng** (như trên) |
| P2 | `state/archive.dump` không bao giờ bị xoá | **Đóng** (như trên) |
| P2 | `PRE-RESTORE-nn` không bao giờ hiện | **Đóng** (như trên) |
| P2 | `--resume-empty-db` là đường chết; ca u9 ghim chuỗi như thể còn sống | **Ghi + sửa nhẹ.** N4 không thêm kiểm manifest vào đường ấy; chỉ giữ `hold_archive` và băm của người vận hành. Đường chết có từ trước, ghi ở «Còn mở» 1 |
| P2 | `install-d1.sh`: `$(python3 …)` trong đối số không bị `set -e` bắt | **Đóng** (như trên) |
| P2 | `install-d1.sh`: lời lỗi không lọc | **Đóng** (như trên) |
| P3 | `thread_order == 'checked'` không được đòi; câu trả lời không vào biên nhận | **Đóng.** `restore_data` đòi và trả về; `runtime-receipt.json` mang `restore`; bash đòi cả hai khoá |
| P3 | `O_EXCL` trước khi mở nguồn | **Đóng.** Mở nguồn trước; xoá bản chép khi lỗi. Ca U7 |
| P3 | `relkind 'p'` trong `TABLES_SQL` (bảng phân vùng) | **Đóng.** `relkind = 'r'` (các lá) |
| P3 | thiếu ca lỗi của mock `run` (pre-restore hỏng, `pg_restore` hỏng, bọc thông điệp 023) | **Đóng.** U3b |
| P3 | P7b khẳng định trigger khoá ngoại mà không ca nào để chúng ở `D` | **Đóng.** P7c (`DISABLE TRIGGER ALL` rồi không bật) |
| P3 | `-98`/`-99` chỉ kiểm bằng văn bản; P4 không phân biệt được với rollback của harness | **Đóng một phần.** P10c (khoá do phiên khác giữ ⇒ `-98`, native); R8 chạy bằng `psql` thật (autocommit) và xác nhận trigger vẫn `O` sau lỗi |
| P3 | R2 chỉ kiểm một bảng rỗng sau nạp lỗi; R13 phụ thuộc R10 và sửa `before.db`; ca skip im lặng khi thiếu container | **Đóng** R2 (mọi bảng), R13 (độc lập, oracle riêng). Skip khi thiếu container ghi ở biên nhận |
| P3 | `ALTER … ENABLE ALWAYS TRIGGER` là DDL ngoài migration | **Ghi.** Ngoại lệ có chủ ý trong header của `post-restore.sql` |

## CSDL (0 P1, 2 P2, 8 P3)

| Mức | Finding | Xử lý |
|---|---|---|
| P2 | khoá/deadlock trong lần ghi thử báo `POST-RESTORE-10` thay vì `-98` | **Đóng.** Nhánh `55P03`/`40P01` trong khối thử. Ca P10c (native) |
| P2 | trong một giao dịch (`psql -1`, pool) `ANALYZE` chạy sau dòng pass dưới `lock_timeout` 1 s và có thể rollback bản sửa | **Đóng.** Khối trả lại `search_path` và `lock_timeout`; `ANALYZE` trước câu trả lời; runbook cấm `psql -1`/`-c` |
| P3 | header «không khoá khi chỉ đọc» chưa đúng (ACCESS SHARE tới hết khối; deadlock với lần áp thứ hai của 023) | **Đóng.** Header và runbook: không chạy cùng 023 |
| P3 | RAISE «chưa được cấp số tiếp theo» thành `failed (SQLSTATE P0001)` | **Đóng.** `RAISE;` khi thông điệp là của mình |
| P3 | `TABLES_SQL` với bảng phân vùng; `--tables ""`; tên bảng có dấu cách | **Đóng** hai mục đầu; dấu cách: ghi (từ chối nhầm, an toàn) |
| P3 | bản lưu sau 023 bị cắt cả hai bảng số và không quyết định nào mang vị trí không phân biệt được với bản trước 023 | **Ghi.** Runbook mục 2 và biên nhận «Còn mở» 4 |
| P3 | `fingerprint` loại `subject_thread_seq` ở mọi bảng nên không so vị trí | **Đóng.** `jsonb_strip_nulls`: một giá trị bị đặt về NULL là một khác biệt |
| P3 | ca `post-restore` một dự án một chat | **Đóng.** P17 (hai tenant × hai dự án cùng chat và luồng); đột biến bỏ phạm vi dự án của phép 06 chỉ P17 bắt được |
