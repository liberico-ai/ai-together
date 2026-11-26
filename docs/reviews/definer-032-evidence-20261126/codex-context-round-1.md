
## Việc: cứng hoá hàm `SECURITY DEFINER` (migration 032, bản 0.9.5)

Mọi hàm `SECURITY DEFINER` của các schema ứng dụng phải ghim `pg_temp` ở **cuối** `search_path`, như 031 đã làm cho hàm của nó. 032 đặt lại cho 17 hàm tạo trước 031, chỉ đổi `search_path`, rồi dừng (không đổi gì) nếu còn hàm nào chưa ghim.

**Cổng:** chạy một vòng. Chỉ P0 chặn merge (rò dữ liệu, leo quyền, mất dữ liệu); P1 và P2 ghi lại. Vẫn xếp hạng mọi finding theo thang của lời nhắc trên.

**Đầu vào:** diff so với `21af53f`, gồm `migrations`, `tests`, `package.json`.

## Điều muốn được soát kỹ

1. Còn hàm quyền cao nào (kể cả hàm trigger, hàm trong schema khác) không được ghim, hoặc bị đổi sai chữ ký?
2. Đổi `search_path` có làm thân hàm nào giải tên khác đi (tên không chỉ rõ schema, kiểu, toán tử, hàm), hay làm mất `row_security=off`, chủ sở hữu, quyền gọi?
3. Câu canh ở cuối 032 có thể chặn sai (hàm của extension, schema khác) hay để lọt?
4. Rollback 032 có đúng trạng thái trước đó không, và chạy hai lần có an toàn không?
