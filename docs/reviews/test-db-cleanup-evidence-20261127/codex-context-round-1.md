## Việc: CSDL thử `slice1_verify_<ms><nn>` bị bỏ lại trong container PostgreSQL thử dùng chung

Đây không phải một lát: không có brief trong `docs/SLICE-BRIEFS.md`. Chỉ đổi mã kiểm trong `tests/`; không đổi `src`, `migrations`, plugin, phiên bản.

**Nguyên nhân đã đo:** `tests/restore-rehearsal.test.ts` xoá CSDL tạm qua `pooledDatabase` (`statement_timeout` 10 s, `src/server/db.ts`) rồi `.catch(()=>{})`. `DROP DATABASE` chờ checkpoint; nhật ký máy chủ thử có 12 lệnh `DROP DATABASE` loại này bị huỷ vì quá 10 s. 11 CSDL còn lại trong container đều mang `datconnlimit = -2` (xoá nửa chừng).

**Yêu cầu:** checkpoint chậm không còn để lại CSDL; lượt xoá hỏng phải thấy được. Container dùng chung nhiều phiên: mã kiểm chỉ được xoá CSDL do chính nó tạo.

**Cổng:** chạy một vòng. Vẫn xếp hạng mọi finding theo thang của lời nhắc trên.

**Đầu vào:** diff `36baa8e..e21dd10` (toàn bộ thay đổi mã). Được đọc thêm tệp trong cây làm việc.

**Điều đã biết, nói trước:** ba ca ở `tests/test-databases.test.ts` chỉ chạy trên PostgreSQL thật. Không ca nào trong repo bắt được việc bỏ `client.on('error')`: đường đó chỉ chạy khi socket đứt mà máy chủ không gửi gì, cần một cầu chuyển tiếp, mà `create()` chỉ nhận cổng 55471. Phiên đo riêng bằng một script: bỏ listener thì `uncaughtException`, có listener thì chỉ câu đang chạy bị từ chối. Ca đầu dựng «DROP lâu hơn 10 s» bằng khoá `COMMENT ON DATABASE`, không phải bằng checkpoint thật.

## Điều muốn được soát kỹ

1. Còn đường nào một CSDL do lượt kiểm tạo vẫn ở lại mà lượt chạy không đỏ: `create()`, ca hết giờ khi đang tạo, `beforeAll` hỏng, thứ tự trong `afterAll`, hạn của hook?
2. Có đường nào mã này xoá một CSDL không do nó tạo trên máy chủ dùng chung (kể cả `WITH (FORCE)`, và `pg_terminate_backend` trong ca thứ hai)?
3. Có đường nào một lượt xoá hỏng vẫn không thấy được?
4. Ba ca có thật kiểm điều chúng nói không (có thể xanh khi mã dọn sai, hay đỏ giả khi máy chậm)? Chúng có tự dọn khi hỏng không?
5. Thông báo lỗi hay đầu ra mới có đưa chuỗi kết nối, mật khẩu hay dữ liệu thật ra chỗ được lưu lại không?
