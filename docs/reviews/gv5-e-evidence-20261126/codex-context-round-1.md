
## Việc (GIAO VIỆC 5, hạng mục E, kèm OQ-61 B6 (2))

- **E, nguyên văn đề:** «Sửa phần sửa được trong mã; giới hạn kích thước và timeout phải báo rõ cho người dùng, không im lặng thất bại.»
- **B6 (2):** «lệnh thu hồi có sự kiện riêng» cho một liên kết tin–việc sai. Lịch sử giữ nguyên.
- **Kế hoạch:** `docs/plans/gv5-e-files-and-link-revoke.md`. Câu tạm: Q-GV5E-1, Q-GV5E-2 (cuối `docs/OPEN-QUESTIONS.md`).

**Cổng:** chạy một vòng. Chỉ P0 chặn merge (rò dữ liệu, leo quyền, mất dữ liệu); P1 và P2 ghi vào biên nhận và sửa tiến. Vẫn xếp hạng mọi finding theo thang của lời nhắc trên.

**Đầu vào:** diff so với `d9a2318` (sau PR 4), gồm `src`, `migrations`, `bot-plugin`, `tests`.

## Đã đổi

- Biên nhận tệp hỏng thêm tham số `attachmentReason` (bốn mã cố định). Plugin 0.3.5 chọn câu theo mã. Tệp ZIP gửi vào ô nhập CSV ra `XLSX_NOT_SUPPORTED`. Lệnh nhập bỏ chờ sau 60 giây (`CLIENT_TIMEOUT`).
- Migration 030 và rollback: `intake_link_revocations` (RLS bật và ép; chỉ thêm; UNIQUE theo liên kết; ghi chỉ trong tên mình, bởi người tạo liên kết hoặc ghế BoM của dự án); payload đóng của `intake_pool_events` thêm `link_id`, `reason_code`; `intake_pool_links_outside` bỏ liên kết đã gỡ.
- `revoke_link` ở mục nhóm chung và ở ứng viên; liên kết đã gỡ không tính trong chuỗi bước; mở lại mục được; không nối lại đúng cặp.

## Điều muốn được soát kỹ

1. Có đường nào để người không được phép gỡ, hoặc gỡ liên kết của dự án mình không đọc được (RLS, hàm DEFINER, chính sách)?
2. Luật mở lại mục có làm lộ cho thành viên Tech biết quyết định của BoM, hay mở được mục còn việc đang giữ?
3. Hai lệnh gỡ hay gỡ và nối cùng lúc: có ghi đôi, mất sự kiện hay lệch phiên bản?
4. Rollback 030 có xoá lịch sử ở trạng thái nào không?
