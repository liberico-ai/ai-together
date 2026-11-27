# Bằng chứng: runner migration hiện đúng lỗi của tệp hỏng (0.9.6) — 27/11/2026

Nhánh `fix/migrate-runner-error-surface`, trên `36baa8e`. Đường dẫn máy trong log đã thay bằng `<repo>`, `<home>`, `<tmp>`, `<path>`; địa chỉ CSDL thành `<db>`. Cổng, đột biến và tập dượt chạy trên mã của commit `69005f5`; sau commit đó chỉ thêm thư mục bằng chứng này.

## Lỗi

- Tệp có `BEGIN;` riêng mà hỏng thì kết nối còn ở giao dịch đã huỷ. `finally` gửi `pg_advisory_unlock` trên đó. Lỗi `25P02` thay mất lỗi của migration, và `client.release()`, `pool.end()` không chạy. Tên tệp không được in ở đâu.
- Cùng loại, thấy khi viết ca: máy chủ đóng phiên thì Node dừng vì sự kiện `error` không người nghe, và chỉ in `Connection terminated unexpectedly`.
- Không áp gì từ tệp hỏng, cả trước và sau bản sửa. Lỗi nằm ở thứ người vận hành đọc được.

## Sửa (`scripts/migrate.ts`)

1. Chỉ unlock ở đường thành công. Đường hỏng không gửi gì thêm: đóng kết nối là PostgreSQL huỷ giao dịch và nhả khoá.
2. Tệp hỏng được nêu bằng dòng `{"event":"migration_failed","file":…}` trên stderr, rồi lỗi gốc đi ra nguyên vẹn.
3. Client có listener `error`, in `{"event":"migration_connection_error",…}` (finding P1 của Codex).

Đường thành công không đổi: mỗi tệp một dòng `migration_applied`.

## Ca kiểm (`tests/migrate-runner.test.ts`)

Chạy runner thật thành tiến trình (`node --import tsx scripts/migrate.ts`), mỗi ca một CSDL trống và một thư mục `migrations/` giả. Chỉ chạy trên PostgreSQL thật: PGlite không phục vụ kết nối `pg`.

| Ca | Kiểm |
|---|---|
| đường thành công | mỗi tệp một dòng `migration_applied`; chạy lại không áp gì |
| từ chối trong `BEGIN` của tệp · từ chối ở tệp không `BEGIN` · máy chủ đóng phiên · kết nối đứt không lời | mã thoát 1; có câu lỗi thật và dòng `migration_failed` nêu tệp; không áp gì của tệp đó và tệp sau; sửa tệp rồi chạy lại thì áp đúng phần còn thiếu |

## Đỏ trước, xanh sau

| Log | Trên mã nào | Kết quả |
|---|---|---|
| `logs/red-first.txt` | runner của `36baa8e`, bản đầu của ca (4 ca) | 3 ca hỏng bằng lỗi khẳng định; ca thành công đạt |
| `logs/red-dropped-connection.txt` | runner của `790a89f` (cây Codex đọc), thêm ca đứt không lời | 1 ca hỏng bằng lỗi khẳng định; 4 ca đạt |

Hai log không có ca nào hết giờ.

## Đột biến trên mã cuối (`logs/mutations.txt`)

Mỗi lượt đổi một chỗ trong runner rồi trả lại. Không lượt nào có ca hết giờ.

| Đột biến | Số ca đỏ |
|---|---|
| runner của `36baa8e` | 4/5 |
| bỏ dòng `migration_failed` | 4/5 |
| bỏ listener `error` | 1/5 |
| thêm `ROLLBACK` vào `finally` | 1/5 (ca máy chủ đóng phiên) |
| nuốt lỗi và dừng vòng lặp | 1/5 (ca tệp không `BEGIN`: thoát 0) |

Thêm `ROLLBACK` trước khi đóng là cách sửa dễ nghĩ tới nhất. Nó vẫn che lỗi thật khi kết nối đã chết.

## Tập dượt trên migration thật (`logs/runner-rehearsal.txt`)

CSDL tạm trong container thử, tạo rồi xoá. Script điều khiển không nằm trong repo; log là phần in ra của nó.

- CSDL trống: runner mới áp 32 tệp, in 32 dòng `migration_applied`; chạy lại không in gì.
- CSDL ở 031, thêm một hàm quyền cao chưa ghim: runner của `36baa8e` chỉ in `25P02`. Runner mới in `migration_failed` nêu `032_definer_search_path.sql`, rồi đủ câu của 032 và tên hàm. Sổ giữ ở 031, không còn khoá advisory. Gỡ hàm rồi chạy lại thì áp đúng 032.

## Cổng Codex, một vòng (`codex-round-1.md`)

Đầu vào: `docs/reviews/CODEX-REVIEW-PROMPT.md`, `codex-context-round-1.md` và diff `36baa8e..790a89f` của `scripts`, `tests`, `package.json`, `package-lock.json`. Kết quả: `VERDICT: PASS`, **không có P0**; hai P1, một P2. Không chạy vòng hai. **Codex chưa đọc hai commit viết sau lượt soát** (`bb252e0`, `69005f5`).

| Mức | Finding | Đã làm |
|---|---|---|
| P1 | Client đang giữ không có listener `error`; kết nối đứt thì Node có thể dừng trước khi nêu tệp | Đúng: `pg` phát `error` trên client trước khi từ chối câu đang chạy. Có ca đỏ trước, sửa ở `bb252e0`. Trường hợp đứt **giữa hai tệp** không có ca riêng |
| P1 | Đứt sau khi PostgreSQL đã commit mà runner chưa nhận trả lời thì `migration_failed` báo sai | **Không đổi mã.** Lúc đứt, phía client không biết được kết quả. Cả 32 tệp ghi dòng sổ trong chính giao dịch duy nhất của tệp (`logs/ledger-in-transaction.txt`), nên thay đổi và dòng sổ cùng có hoặc cùng không; lần chạy sau đọc sổ và bỏ qua phiên bản đã ghi. `migration_failed` nghĩa là runner không nhận được báo thành công. Không có ca cho tình huống này |
| P2 | Ca runner bị bỏ qua khi không đặt `SLICE1_TEST_DATABASE_URL` | **Giữ.** PGlite không phục vụ kết nối `pg`; như các nhóm ca chỉ chạy native khác. Cổng native chạy chúng |

## Lượt native đầu hỏng vì chính ca mới (`logs/native-first-run.txt`)

Trên `bb252e0`, 1799 ca đều đạt nhưng tệp mới bị tính hỏng ở `afterAll`. Lúc đó một checkpoint đang chạy (tổng 184,7 s, riêng sync 10,3 s). `DROP DATABASE` phải chờ checkpoint và quá `statement_timeout` 10 s của `pooledDatabase`. 5 CSDL tạm còn lại đã được xoá. Sửa ở `69005f5` (chỉ ca kiểm): tạo và xoá bằng client thường, hook dọn 180 s. Sau đó chạy lại toàn bộ cổng từ đầu.

## Cổng trên cây cuối (`69005f5`)

| Cổng | Kết quả | Log |
|---|---|---|
| `npm run typecheck` (`tsc --noEmit`) | thoát 0 | `logs/typecheck.txt` |
| `npm run build` | thoát 0 | `logs/build.txt` |
| `python3 -m pytest tests/` | 182 ca đạt, 210 subtest | `logs/pytest.txt` |
| PGlite với coverage | 98 tệp đạt, 16 bỏ qua; 1632 ca đạt, 167 bỏ qua; câu lệnh 96,23 %, nhánh 91,88 % | `logs/pglite-coverage.txt` |
| PostgreSQL 16 (container cục bộ) | 114 tệp, 1799 ca đạt, không ca nào bỏ qua | `logs/native.txt` |

So với 0.9.5: thêm một tệp và 5 ca chỉ chạy native. `scripts/` không nằm trong danh sách đo coverage.

## Phiên bản

Web 0.9.6, vì gói 0.9.5 đã đóng. Gói 0.9.5 vẫn mang runner cũ, nên `docs/RUNBOOK-095-20261127.md` §4 vẫn đúng cho gói đó. Không có migration mới; plugin không đổi. Chưa đóng gói 0.9.6.

## Chưa chứng minh được

- **Chưa triển khai.** Chưa chạy trên máy chủ.
- «Đứt không lời» được dựng bằng một cầu chuyển tiếp trên máy thử, không phải đứt mạng thật.
- Chưa thử qua pooler. Khoá advisory theo phiên vốn cần kết nối thẳng.
- Runner nay in đủ lỗi của PostgreSQL, như `psql`, kể cả `detail` và `where`. Hai mục này có thể chứa giá trị của một dòng dữ liệu: đừng dán nguyên văn vào nơi công khai.
