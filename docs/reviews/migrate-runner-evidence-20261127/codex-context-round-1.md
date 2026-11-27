## Việc: runner migration che lỗi thật (bản 0.9.6)

`scripts/migrate.ts` là runner người vận hành chạy tay khi nâng bản. Trước bản này: tệp migration có `BEGIN;` riêng mà hỏng thì khối `finally` gửi `pg_advisory_unlock` trên kết nối đang ở giao dịch đã huỷ; lỗi `25P02` thay mất lỗi của migration, `client.release()` và `pool.end()` không chạy. Yêu cầu: người vận hành thấy lỗi thật và tên tệp hỏng; mã thoát khác 0; không áp gì của tệp hỏng; đường thành công vẫn in một dòng `migration_applied` cho mỗi tệp. Sửa nhỏ nhất.

Đây không phải một lát: không có brief trong `docs/SLICE-BRIEFS.md`. Không có migration mới.

**Cổng:** chạy một vòng. Chỉ P0 chặn merge (rò dữ liệu, leo quyền, mất dữ liệu); P1 và P2 ghi lại. Vẫn xếp hạng mọi finding theo thang của lời nhắc trên.

**Đầu vào:** diff so với `36baa8e`, gồm `scripts`, `tests`, `package.json`, `package-lock.json`.

## Điều muốn được soát kỹ

1. Còn đường nào mà lỗi thật vẫn bị thay thế hoặc mất không: hỏng ở câu lấy khoá hay câu đọc sổ, kết nối chết giữa hai tệp, `pool.end()` hỏng, sự kiện `error` không người nghe, kết quả phụ thuộc thứ tự thời gian?
2. Đường hỏng không còn gọi unlock: khoá advisory có thể bị giữ lại, hoặc phần của tệp hỏng có thể được commit không?
3. Đường thành công có đổi hành vi không? Các script nạp runner bằng `import` (`scripts/native-verification.ts`, `scripts/setup-local-verification.ts`, `scripts/spec003-native-prepare.ts`) và `scripts/native-spec004-fixture.mjs` có bị ảnh hưởng không?
4. Từ bản này lỗi của PostgreSQL ra tới đầu ra của runner (kể cả `detail`, `where`). Có đường nào đưa chuỗi kết nối, mật khẩu hay dữ liệu cá nhân ra một chỗ được lưu lại không?
5. `tests/migrate-runner.test.ts` có thật kiểm điều nó nói không (có thể xanh khi runner sai)? Nó có an toàn trên máy chủ CSDL thử dùng chung không (chỉ tạo và xoá CSDL của chính nó)?
