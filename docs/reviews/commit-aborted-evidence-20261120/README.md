# Bằng chứng — `COMMIT` trả `ROLLBACK` không lỗi (DELIVERY-019) · 20/11/2026

Nhật ký đã gỡ đường dẫn máy (`<repo>`, `<scratch>`) ngay khi ghi. Chạy trên PostgreSQL 16 trong container thử, CSDL riêng (`slice1_verify_<số>`) ở địa chỉ vòng lặp, hai login riêng (quản trị và login web hạn chế); mật khẩu và địa chỉ đầy đủ không được ghi lại. Một lượt chạy một lúc, không lượt nào chạy song song với lượt khác.

| Tệp | Là gì |
|---|---|
| `red-before-pglite.txt`, `red-before-native.txt` | Tệp thử **cuối** (`tests/transaction-commit.test.ts`) chạy với **mã cũ** của `src/server/db.ts` và `tests/slice1-db.ts` (lấy từ `libetech-ai-os` tại `a4a3542`). PGlite: 4 đỏ / 3 xanh / 2 bỏ qua; PostgreSQL thật: 5 đỏ / 4 xanh. Mọi ca đỏ là `AssertionError`; 0 «timed out»/«PGlite is closed» |
| `draft-n5-failure.txt` | Phần ca đỏ của **lượt chạy nháp** toàn bộ bộ thử trên PostgreSQL thật, sau khi có bản sửa `db.ts` nhưng **trước khi sửa ca N5**: 1 đỏ / 1465 đạt; ca đỏ là N5 của `thread-order-concurrency.test.ts`, `TransactionNotCommittedError`. Số dòng của `db.ts` trong đó là của cùng mã `db.ts` cuối |
| `final-new-file-native-verbose.txt`, `final-new-file-pglite-verbose.txt` | Tệp mới, từng ca một dòng có tên: PostgreSQL thật 9/9; PGlite 7 đạt + 2 bỏ qua (hai ca cần PostgreSQL thật) |
| `final-suite-native.txt` | Bộ thử đầy đủ, PostgreSQL thật, cả hai login: 84 tệp đạt, 1 bỏ qua, 1466 ca đạt, 17 bỏ qua, 0 đỏ |
| `final-suite-pglite.txt` | Bộ thử đầy đủ, PGlite: 71 tệp đạt, 14 bỏ qua, 1333 ca đạt, 150 bỏ qua, 0 đỏ |
| `final-typecheck.txt`, `final-build.txt` | `tsc --noEmit` (thoát 0) và `next build` (thành công) |
| `final-tree-hashes.txt` | SHA-256 của `src/server/db.ts`, `tests/slice1-db.ts`, `tests/transaction-commit.test.ts`, `tests/thread-order-concurrency.test.ts` **tại lúc chạy** các tệp `final-*`; trùng với nội dung được commit, nên các nhật ký ấy là của cây cuối. Chỉ tài liệu (`docs/`) được viết sau |

Các lượt `red-before-*` và `draft-*` không phải bằng chứng cho cây cuối; chúng chỉ chứng minh thứ tự «đỏ rồi xanh» và chỗ N5 dựa vào việc im lặng huỷ.
