# Bot LibeTech — nhóm → dự án được phép → ai làm gì

Ngày 26/11/2026 · theo mã `libetech-ai-os` (0.9.3). Cấu hình thật nằm trên máy chủ, trong tệp 0600 ngoài repo. Id nhóm không ghi ở đây.

## 1. Nhóm và đường đi

| Nhóm | Khoá cấu hình | Dự án được phép | Gửi tin vào tiếp nhận | Hỏi bot đọc hồ sơ | Bot làm gì |
|---|---|---|---|---|---|
| LibeAI (nhóm nội bộ) | `chatScopes` → dự án pilot LBRC; `intake.chats` | đúng một dự án LBRC; nhóm gắn hai dự án trở lên thì tiếp nhận từ chối `INTAKE_PROJECT_AMBIGUOUS` | tin của nhóm thành ứng viên của dự án đó | người đã ghép Telegram, **là thành viên** dự án của nhóm. Người khác: câu «không thuộc dự án của nhóm» | chỉ đọc; biên nhận `IN-…` cho tin gọi bot |
| Dragon Forge (nhóm chung Team Tech) | `intake.poolChats`; không có trong `chats`, `excerptChats` hay `chatScopes` | **không gắn dự án; dự án được chọn ở bước phân loại** | thành viên roster Team Tech đã ghép Telegram, tin gọi bot; không giữ chữ, tên tệp hay nhãn người gửi | không đọc hồ sơ ở đây: câu «nhóm không gắn dự án» | chỉ đọc; biên nhận «Đã nhận, mã IN-…», không nêu dự án |
| Libe – Xeca | `chatScopes` → không dự án | không | không (không lưu gì) | câu «nhóm không gắn dự án» | chỉ đọc; không trả nội dung |
| Nhóm khác | không có | không | không (không lưu gì) | câu «nhóm không gắn dự án» | đóng |
| Tin nhắn riêng với bot | — | mọi dự án của chính người hỏi | — | thành viên đã ghép Telegram. Chưa có dự án: câu «chưa thuộc dự án nào» | lệnh `/libetech_link`, `/libetech_check`, `/duyet` |

- Dragon Forge chỉ bật sau EV-12 và EV-13 (`docs/RUNBOOK-GV5-B-POOL.md`).
- «Thành viên dự án» là membership. Từ 0.9.2, thành viên Team Tech được giao việc ở dự án họ không thuộc thì đọc dự án đó ở vai viewer, theo `work_access_grants`.

## 2. Ai làm gì sau khi tin được nhận

| Việc | Ai làm được |
|---|---|
| Phân loại tin của nhóm chung và chọn dự án | thành viên roster Team Tech |
| Lập yêu cầu việc từ tin đã xác nhận | thành viên Team Tech (gồm BoM Tech), hoặc điều phối của dự án đích |
| Duyệt yêu cầu | một BoM Tech hoặc ghế BoM của dự án, **khác người tạo** |
| Đổi người thực hiện sau duyệt | phiếu 3/3 của dự án |
| Đọc hồ sơ qua bot | chỉ đọc; bot không tạo, không duyệt, không đổi gì |

## 2b. Tin bot tự gửi (0.9.4, hạng mục F)

- Đây là loại tin duy nhất không trả lời một tin nào. Nó chỉ đi tới nhóm mà **người vận hành** khai trong `reminder_targets` (`deploy/reminder-targets.sql`), và cơ sở dữ liệu buộc đúng nhóm, đúng chủ đề, đúng loại tin của đích đó.
- Nhóm đích phải phục vụ **đúng một dự án**, là dự án của đích, theo `chatScopes` trên máy chủ. Nhóm của dự án khác, nhóm gắn hai dự án và nhóm chung không gắn dự án (Dragon Forge) đều bị từ chối, để tên người không ra ngoài dự án (Q-GV5F-6).
- Dự án của đích phải được một nhóm `intake.chats` phục vụ, và nhóm đích nằm trong `chats` của `intake.json` ở gateway. Gateway từ chối tin nhắc tới `poolChats` hay tin riêng. Bộ hẹn giờ không đọc được cấu hình máy chủ thì không xếp tin nào.
- Lúc gateway kéo tin, máy chủ kiểm lại toàn bộ: đích còn bật và đúng nhóm, dự án còn được phép, nhóm còn đúng dự án, giờ và buổi họp còn như tin nói, buổi chưa bắt đầu. Tin không đạt thì không gửi, ghi mã lý do (`REMINDER_…`).
- Ba loại tin:
  - trạng thái GO LIVE: chỉ tên người chưa gửi yêu cầu hoặc có việc chưa có bằng chứng;
  - nhắc họp BoM: ngày, giờ và nguồn (lịch gốc hoặc mã IN);
  - câu hỏi khi một lần đổi giờ chưa rõ phạm vi.
- Không tin nào nêu tiêu đề việc, chữ của tin hay mã nhóm. Dự án IBS HI, hoặc chưa xác nhận miền, không nhận tin nhắc.
- Đổi giờ họp chỉ ghi trên trang «Lịch họp BoM», bởi ghế BoM của dự án hoặc BoM Tech, kèm mã IN của tin xác nhận. Bot không đọc chữ tin để đổi lịch.

## 3. Bot trả lời khi bị từ chối

Bảng đầy đủ là `REPLIES` và `SCOPE_REPLIES` trong `bot-plugin/__init__.py` (plugin 0.3.4). Mỗi câu nêu nguyên nhân, việc làm tiếp, và mã trong ngoặc. Không câu nào nêu tên dự án, BU, nhóm hay người.

| Nguyên nhân | Mã (reason) | Việc làm tiếp mà bot nói |
|---|---|---|
| Chưa ghép Telegram | `TELEGRAM_NOT_LINKED` | tạo mã trong AI OS rồi gửi `/libetech_link <mã>` ở tin riêng |
| Chưa có dự án, không trong Team Tech | `NO_PROJECT_ACCESS` | nhờ quản trị thêm vào dự án hoặc Team Tech |
| Team Tech chưa thuộc dự án nào, hỏi ở tin riêng | `SCOPE_DENIED` (`NO_PROJECT_YET`) | nhờ quản trị thêm vào dự án |
| Không thuộc dự án của nhóm | `SCOPE_DENIED` (`NOT_PROJECT_MEMBER`) | nhờ quản trị thêm vào, hoặc hỏi ở tin riêng |
| Nhóm không gắn dự án (không ghi sổ để đọc) | `SCOPE_DENIED` (`CHAT_NOT_MAPPED`) | hỏi ở tin riêng hoặc nhóm đã gắn dự án |
| Không thấy hồ sơ đúng SHA | `SCOPE_DENIED` 404 (`RECORD_NOT_FOUND`) | kiểm lại mã việc và SHA |
| Thiếu quyền duyệt tài khoản | `APPROVER_REQUIRED` | nhờ quản trị kiểm tra nếu cho là sai |
| Lỗi cấu hình cầu nối (không phải quyền của người hỏi) | `BRIDGE_AUTH_DENIED`, `BRIDGE_UNCONFIGURED`, `BRIDGE_NOT_CONFIGURED` | báo người vận hành |
