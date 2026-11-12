# Biên bản mở cổng Team Tech · 2026-11-10

## Phạm vi giao

- Cổng dùng thật: https://libetech.btnet.vn; đăng ký tại `/register`, quản trị yêu cầu tại `/team`, báo lỗi và góp ý tại `/feedback`.
- Thành viên gửi tên, tên đăng nhập và phạm vi công việc; không gửi mật khẩu trên biểu mẫu đăng ký. Yêu cầu không tự tạo quyền. Quản trị xác minh người và dự án rồi cấp lời mời một lần; người dùng tự đặt mật khẩu và ghép Telegram.
- Dự án `LibeTech AI OS · Nội bộ` dành cho phản hồi về nền tảng, tách khỏi dữ liệu BU. Thành viên được duyệt có thể được cấp quyền chỉ đọc ở đây trước; quyền dự án BU cấp riêng theo roster. Quân và Phương được thêm quyền chỉ đọc nội bộ; chairman là manager. Không có quyền BU mới được cấp qua migration 008.
- Phản hồi có phạm vi dự án, người gửi, nội dung, trạng thái xử lý. Phản hồi không thay trạng thái bảng việc, nghiệm thu hoặc điểm nhân sự.

## Kiểm chứng

- Nguồn web 0.5.0 phát hành tại `/home/iptech/.local/share/libetech-ai-os/releases/0.5.0-21b6a8212622`; build digest `21b6a8212622a456f1556dd349b60549eb3e70e6da08bf59a36d2856f46835f1`.
- Biên nhận cài trên server: `activation/activation-receipt.json` trong release trên. Biên nhận migration 008: `activation/platform-008/receipt.json`. Các biên nhận ghi backup/restore kiểm được, dữ liệu cũ giữ nguyên và PID gateway chung không đổi. Chỉ dịch vụ web LibeTech được nạp lại.
- Ngày 10/11, `GET https://libetech.btnet.vn/api/health` trả HTTP 200, `ready`, version `0.5.0`, đúng build digest, PostgreSQL server, `synthetic=false`, schemas `001`–`008`. `/register` trả HTTP 200.
- Trên phiên chairman: `/team` hiển thị `LibeTech AI OS · Nội bộ` là phạm vi có thể cấp; `/feedback` hiển thị cả phạm vi này và `LBRC · App Saleman`. Chưa có yêu cầu đăng ký hoặc phản hồi mới trên cổng tại thời điểm kiểm.
- Bộ kiểm trước phát hành: 49/49 ca, typecheck và build pass trên bản sao cô lập. Migration 008 áp dụng lặp hai lần trên fixture PGlite, giữ đúng một dự án nội bộ và ba membership định danh, không cấp cho tenant ngoài.
- Kiểm runtime trong biên nhận gồm: trang đăng ký 200; trang quản trị và phản hồi không phiên 401; yêu cầu đăng ký sai dữ liệu 422, sai Origin 403; cầu nối không ký 401. Các ca sai dự án và luồng phê duyệt/feedback đã kiểm tự động, chưa coi là UAT của thành viên mới.

## Hướng dẫn dùng thử

1. Chia sẻ https://libetech.btnet.vn/register cho các thành viên Tech. Mỗi người tự gửi yêu cầu, không gửi mật khẩu hoặc mã ghép Telegram qua nhóm.
2. Chairman hoặc quản trị đã được giao vào `/team`, đối chiếu người với danh sách nhân sự và dự án đang tham gia. Cấp `LibeTech AI OS · Nội bộ` mức chỉ đọc để dùng và báo lỗi. Chỉ cấp quyền BU sau khi xác minh dự án cụ thể. Gửi lời mời một lần qua kênh riêng cho đúng người.
3. Thành viên tự kích hoạt, đăng nhập, ghép Telegram bằng DM, vào `/feedback` chọn đúng phạm vi và ghi bước lặp lại, kết quả mong đợi/thực tế. Không đưa dữ liệu mật hoặc tài liệu BU khác vào phản hồi nội bộ.
4. Người quản lý xử lý phản hồi trong đúng dự án, ghi nguyên nhân và phiên bản sửa. Đối chiếu lại trên cổng thật trước khi kết luận đã khắc phục.

## Việc còn mở

- Chưa có một thành viên mới hoàn tất toàn bộ đăng ký → duyệt → kích hoạt → ghép Telegram → gửi phản hồi thật. Đây là UAT cần Team Tech thực hiện.
- Danh mục dự án hiện mới có `LBRC · App Saleman` và dự án nội bộ. Roster và quyền theo các dự án BTNET, Xeca, IBS HI, Liberico cần đối soát rồi thêm từng dự án; không suy ra quyền từ lời tự khai ở đăng ký.
- Chưa thử lại chặn đọc chéo BU bằng Telegram của một thành viên mới trong đợt 0.5.0. Ca cũ và kiểm mã giữ vai trò bằng chứng lịch sử, không thay UAT mới.
- Chưa có đính kèm hoặc thông báo tự động cho phản hồi. Danh sách phản hồi giới hạn 200 mục mới nhất trong phạm vi.

Bảng việc và dữ liệu team được giữ nguyên; nền tảng không tự ghi đè nguồn vận hành của team.
