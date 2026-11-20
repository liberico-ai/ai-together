# N4 — bằng chứng (20/11/2026)

Biên nhận: `docs/DELIVERY-017-n4-restore-after-023-20261120.md`. Mọi log đã thay đường dẫn máy bằng `<repo>`, `<home>`, `<scratch>`, bỏ cảnh báo của Node và mã màu; không log nào mang đường dẫn máy, chat ID, tên người dùng hay secret (quét trước khi commit). Không có transcript thô của Codex ở đây (xem `codex-*.md`).

## Môi trường của các lần đo

PostgreSQL 16.15 (image `postgres:16`) trong một container thử, cổng loopback; công cụ `pg_dump`, `pg_restore`, `psql` là của container (`docker exec -i`, ổ cắm cục bộ, không mật khẩu). Một login superuser tạm của phiên đo, một CSDL riêng mỗi nguồn và mỗi đích (tên khớp `slice1_verify_<số>`, chỉ các tên đó bị xoá cuối ca). Biến cần để chạy lại: `SLICE1_TEST_DATABASE_URL` (login superuser, CSDL nguồn), `SLICE1_WEB_DATABASE_URL` (login `libetech_web`, cùng CSDL; cho bộ test đầy đủ) và `SLICE1_PG_CONTAINER` (tên container). Không có biến nào được ghi vào repo hay vào log.

```bash
SLICE1_TEST_DATABASE_URL=… SLICE1_PG_CONTAINER=… npx vitest run tests/restore-rehearsal.test.ts --reporter=verbose
```

## Nguồn gốc của log

Các log `red-*` và `first-run-*` là của các bản test **cũ hơn** bản cuối (ít ca hơn): chúng ghi trạng thái lúc đó, không phải bản cuối. Các log `green-*`, `mutation-run`, `python-unittest` và `vitest-*` được lập lại ở lượt đo cuối; đầu mỗi log nằm `# head=<commit>` và băm (16 ký tự đầu của SHA-256) của năm tệp dưới thử lúc chạy. **Các SHA commit trong log và trong `codex-context-round-N.md` là của các commit làm việc trước khi chúng được gộp thành hai commit để PR sạch; chúng không còn tồn tại.** Băm của các tệp mới là thứ buộc log vào nội dung cuối (đã đối chiếu với cây của PR).

## Log

| Tệp | Cho thấy |
|---|---|
| `logs/red-1-rehearsal-before-the-new-files.txt` | **Đỏ của N4.** Ca diễn tập khi chưa có tệp mới: R1, R2, R2b, R3 (mô tả lệnh CŨ) đạt, và mười ca đỏ bằng `AssertionError` (0 lần hết giờ) vì quy trình mới chưa có. Dòng `R2 old command`: `COPY failed for table "draft_decisions": ERROR:  The thread of the candidate moved on`; `R2b`: `duplicate key value violates unique constraint` |
| `logs/first-run-post-restore-with-the-file.txt` | Lần chạy đầu của `tests/post-restore.test.ts` khi `deploy/post-restore.sql` đã có: 12 đạt, 4 đỏ bằng khẳng định (P5b, P9, P12, P14); các ca và tệp sau đó được sửa |
| `logs/red-2-installer-unit-before-the-code.txt` | Ca Python của hai bộ cài khi chưa có `restore_data`, `run_post_restore`, bước shell: lỗi thiếu hàm (không phải khẳng định) |
| `logs/red-3-post-restore-before-the-file.txt` | Mười sáu ca `post-restore` khi chưa có tệp: `ENOENT` (chưa phải lý do đúng; kế hoạch §6 đã ghi) |
| `logs/green-rehearsal-pg16-verbose.txt` | **Xanh.** 17 ca diễn tập với công cụ thật, cuối cùng. Các dòng `console.info` mang lời lỗi thật: `R2`, `R2b` (lệnh cũ, bản lưu sau 023), `R9` (lệnh cũ, bản lưu trước 023 có tài liệu: `fk_document_records_latest_revision`), `R4` (câu trả lời của `post-restore.sql`: `"numbering_trigger_was" : "O"` → `pass`), `R4b` (`PRE-RESTORE-02`), `R8` (`POST-RESTORE-05` giữ nguyên trạng thái trigger), `R12` (023 từ chối khi còn nháp ứng viên chưa quyết định) |
| `logs/green-post-restore-pg16.txt`, `logs/green-post-restore-pglite.txt` | 24 ca (native) và 23 + 1 bỏ qua (PGlite, ca khoá cần native) của `tests/post-restore.test.ts` |
| `logs/mutation-run.txt` | 17 đột biến của `deploy/post-restore.sql` và các ca đỏ của từng đột biến; một đột biến («probe-leaves-replica-mode») không làm ca nào đỏ vì là lớp phòng thủ thứ hai, kết hợp với đột biến bỏ lớp thứ nhất thì đỏ |
| `logs/python-unittest.txt` | 70 ca Python của hai bộ cài |
| `logs/typecheck.txt`, `logs/build.txt`, `logs/vitest-pglite-full.txt`, `logs/vitest-native-full.txt` | kiểm toàn bộ ở cây sạch `dfdd68c`: typecheck, build, bộ test đầy đủ PGlite (1 311 đạt, 136 bỏ qua) và PostgreSQL 16.15 (1 447 đạt, 0 bỏ qua). Trong `typecheck.txt`: lần đầu lỗi vì bản sao iCloud của một tệp sinh ra, đã xoá rồi chạy lại |

## Cổng

`gates/tier1-dispositions.md` ghi từng finding của ba review tầng 1 trên mã và cách xử lý (hai cổng trên kế hoạch: `docs/plans/n4-restore-after-023.md` mục 11); `codex-context-round-N.md` và `codex-round-N.md` là lời nhắc kèm và kết quả của cổng Codex (chỉ tệp `--output-last-message`; không commit transcript): vòng 1 `CHANGES_REQUIRED` (P0, P1, P2), vòng 2 `PASS`.
