# SPEC-006 · Team Tech đăng ký và báo lỗi theo dự án

Status: 0.5.0 deployed on 2026-11-10; isolated tests and live route/health checks passed. Human onboarding and cross-BU UAT for newly registered members remain open. See [delivery record](DELIVERY-005-team-open-20261110.md).

## Người dùng và luồng

1. Thành viên vào `/register`, gửi tên, tên đăng nhập và dự án/mảng đang tham gia. Trang không nhận mật khẩu hoặc token. Hệ thống trả cùng một thông báo nếu tên đã có hoặc yêu cầu đang chờ, tránh lộ danh sách tài khoản.
2. Quản trị tài khoản thấy các yêu cầu chờ tại `/team`, đối chiếu danh tính với roster/team, cấp từng dự án/vai hoặc từ chối, ghi lý do. Một yêu cầu được duyệt tạo tài khoản chưa kích hoạt và liên kết mời dùng một lần trong 24 giờ. Người quản trị gửi riêng cho đúng người.
3. Thành viên tự chọn mật khẩu (ít nhất 12 ký tự), đăng nhập và ghép Telegram bằng mã riêng 5 phút trong DM. Mọi quyền đọc web/bot tiếp tục dựa trên membership và nhóm, không dựa vào nội dung người đăng ký tự khai.
4. Thành viên đăng nhập vào `/feedback`, chọn dự án đã được giao, gửi lỗi hoặc góp ý với bước lặp lại, kết quả mong đợi/thực tế. Người gửi và người quản lý dự án thấy phản hồi. Người quản lý chuyển `new → reviewing → closed`, ghi lý do và version; hành động lặp lại theo request key không nhân đôi.

## Ranh giới dữ liệu

- Hai bảng mới thêm bằng migration 007, không sửa/migrate dữ liệu lịch sử. `identity.registration_requests` thuộc identity role; `feedback_reports` và `feedback_actions` có tenant/project RLS. Tài khoản mới không có membership trước khi quản trị duyệt.
- Kết quả đăng ký, báo lỗi và trạng thái xử lý không là nghiệm thu công việc, KPI hay quyết định BoM. Phản hồi không chứa mật khẩu, key hoặc tài liệu nhạy cảm của BU khác.
- Vai quản trị tài khoản hiện là ID quản trị đã cấu hình. Vai quản lý dự án xử lý phản hồi trong dự án của mình; không được cấp quyền quản trị tài khoản tự động.
- Hai endpoint ghi kiểm Origin và giới hạn tải; đăng ký có giới hạn theo tên/global, feedback dùng phiên đăng nhập, project scope, request key và expected version.

## Ca nghiệm thu và mở dùng thử Team Tech

- Người chưa đăng nhập gửi đăng ký; không nhận quyền dự án, phiên hay mã Telegram. Tên đã tồn tại không bị tiết lộ.
- Quản trị duyệt đúng dự án; sai dự án và người ngoài quyền bị chặn. Lời mời chỉ dùng một lần. Người được duyệt đăng nhập và ghép Telegram thật.
- Thành viên báo lỗi ở dự án được cấp; người khác không thấy. Người quản lý cùng dự án thấy, ghi lý do và chuyển trạng thái; gửi lại/stale version không nhân đôi.
- Đã kiểm `GET /api/health`: version 0.5.0, schema `001`–`008`, PostgreSQL server, không synthetic; UI `/register`, `/team`, `/feedback` hiện đúng phạm vi. Ca sai BU có trong bộ kiểm tự động; thử bằng thành viên mới trên cổng thật vẫn chờ.
- Đã mở cổng yêu cầu đăng ký toàn Team Tech. Chủ tài khoản xác minh từng người rồi cấp `LibeTech AI OS · Nội bộ` để báo lỗi; quyền dự án BU chỉ cấp sau khi đối chiếu roster. Chưa có thành viên mới hoàn tất đăng ký/ghép Telegram để nghiệm thu đường người dùng thật. Tách kiểm thử local khỏi UAT thật; giữ đường quay lại bản 0.4.0 và backup DB.

Migration 008 tạo dự án nội bộ riêng để toàn Team Tech có nơi báo lỗi sau khi được duyệt, và chỉ thêm membership cho ba tài khoản đã kích hoạt: chairman (manager), Quân và Phương (viewer). Các dự án BU khác, bảng việc và bằng chứng hiện có không bị sửa.

## Giới hạn gói đầu

Danh sách phản hồi chỉ hiển thị 200 bản mới nhất trong phạm vi. Chưa có đính kèm, thông báo tự động hoặc liên kết ticket/PR; việc đó vào luồng triage sau khi Team Tech dùng thử. Quản trị hiện chuyển lời mời qua kênh riêng và xác minh người nhận. Chưa dùng việc báo lỗi như căn cứ chấm điểm.
