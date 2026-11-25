# Runbook GIAO VIỆC 5 B — nhóm chung (pool) cho người vận hành

Chỉ giá trị giữ chỗ. Không ghi id nhóm thật, id người hay khoá vào tệp này hay vào biên bản. Chưa có bước nào dưới đây được chạy; mỗi bước cần lời của Chairman cho lần đó.

0. **Kiểm trước khi bật, ngoài repo.** Đọc cấu hình bridge thật: nhóm chung hiện có ở `chatScopes` không, phạm vi gì. Xác nhận gateway không tự lưu chữ của nhóm chung ở nơi khác (nhật ký phiên, bộ nhớ của agent). Nếu có lưu thì dừng và báo Chairman.
1. Áp `025`, `026` theo quy trình migration hiện hành. Mỗi migration có sẵn rollback ở `migrations/rollback/`; rollback từ chối khi đã có dòng dữ liệu.
2. Roster Team Tech và liên kết Telegram của từng người: theo `deploy/tech-roster.sql`. Người gửi ở nhóm chung phải có liên kết Telegram, đang hoạt động và thuộc roster.
3. Tệp `LIBETECH_BRIDGE_CONFIG` trên máy chủ: thêm `intake.poolChats: ["<ID_NHOM_CHUNG>"]`. Không thêm id đó vào `intake.chats` hay `intake.excerptChats` (cấu hình bị từ chối nạp, máy chủ trả 503). Không đổi `chatScopes` của nhóm đó.
4. Tệp `runtime/libetech-ai-os/intake.json` của plugin: `hookEnabled: true`; thêm `<ID_NHOM_CHUNG>` vào khoá mới `poolChats` **và không** vào `chats` (hai danh sách không được giao nhau; cấu hình giao nhau bị từ chối, khoá lạ vẫn bị từ chối). Plugin tự tạo khoá hash `pool-hash.key` (32 byte ngẫu nhiên, chế độ 0600) trong thư mục `runtime/libetech-ai-os/` ở lần dùng đầu; không cần bước nào của người vận hành, không cần sao lưu. Mất khoá chỉ làm lần sửa kế tiếp của mỗi tin trông như một lần sửa mới.
5. Cài bản plugin mới. Khởi động lại gateway chỉ khi có lời Chairman cho lần đó.
6. Tắt: bỏ id khỏi `poolChats` ở cả hai tệp (id không bao giờ ở `chats`, nên bỏ khỏi `poolChats` là tắt hẳn: nhóm không thể thành nhóm lưu chữ); mục đã nhận vẫn còn.

Kiểm chỉ đọc sau khi bật (người vận hành chạy, không ghi id vào biên bản): không cột chữ nào của `intake_pool_items`, `intake_pool_events`, `intake_work_links` chứa chữ của tin vừa gửi; lặp lại sau khi gán mục vào một dự án thuộc miền IBS HI.
