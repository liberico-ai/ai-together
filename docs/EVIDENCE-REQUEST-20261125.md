# Yêu cầu bằng chứng — GIAO VIỆC 5 (25/11/2026)

Phiên PR (Claude Code) không đọc được Telegram, máy chủ d1-ai1 hay sổ ticket của plugin priority1. Phiên điều phối chuyển từng mục dưới đây cho Codex (thread 01a1b963) hoặc người được nêu.

Quy ước cho mọi câu trả lời:
- **Không** dán token, khoá, nội dung `.env`, mã nhóm Telegram, tên đăng nhập, email hay số điện thoại.
- Một nhóm nêu bằng tên hiển thị (LibeAI, Libe – Xeca, Dragon Forge). Một người nêu bằng vai hoặc tên gọi đã có trong hồ sơ.
- Nội dung tin gốc nằm ngoài repo (repo công khai). Câu trả lời ghi thời điểm, nhóm, người gửi (vai), mã IN nếu có, mã lỗi đúng như hiện ra, và đường dẫn tới bản lưu ngoài repo.
- Trạng thái của mỗi ca chỉ đổi khỏi «chưa đối chiếu với người báo» khi người báo xác nhận trên tin gốc (lời Chairman 25/11/2026).

| Mã | Ca / việc | Cần gì | Đọc ở đâu | Ai |
|---|---|---|---|---|
| EV-01 | Bản đang chạy | Phiên bản web và bridge; danh sách `schema_migrations` (có 022 và 023 chưa); số bot gateway đang chạy; `count(*)` của `work_items`, `work_requests` (sau khi cài) | d1-ai1: manifest bản cài trên đĩa, `systemctl status` của các unit, `psql` chỉ đọc. `/api/health` là lời tự báo, không phải bằng chứng | Codex |
| EV-02 | Dragon Forge có ghi sổ không | Có hay không, cho từng nơi: nhóm có trong `chats` của `intake.json` (gateway); có trong `chatScopes`, `intake.chats`, `excerptChats` của `bridge.json` (server); số dòng `source_events` của nhóm. Chỉ trả có/không và số đếm, không in mã nhóm | d1-ai1: hai tệp cấu hình; `psql` đếm theo nhóm | Codex |
| EV-03 | Ca (a): một thành viên BoM nhận `unauthorized`, bot giải thích sai | Thời điểm và nhóm; lệnh hay tin đã gửi; câu trả lời của bot đúng nguyên văn; dòng log của bridge cùng thời điểm (mã lỗi, mã HTTP, đường dẫn API); trạng thái tài khoản (đang hoạt động, đã liên kết Telegram, dự án có membership). Chuỗi `unauthorized` không có trong mã của repo này: cần biết nó đến từ đâu (plugin priority1, Hermes hay gateway) | Telegram (người báo); journal của gateway và web trên d1-ai1 | Codex + người báo |
| EV-04 | Ca (b): một thành viên BoM nhận `SCOPE_DENIED` | Như EV-03, và cho biết đó là nhóm nào. Hồ sơ duy nhất trong repo là phép thử ngày 10/11 ở Libe – Xeca, nơi từ chối là đúng thiết kế | Như EV-03 | Codex + người báo |
| EV-05 | Ca (c): các ticket ngày 20/11 (tệp lớn, Excel, hết giờ chờ, quyền thư mục) | Mã ticket trong sổ của plugin priority1; với mỗi ticket: loại tệp, kích thước, thời điểm, câu trả lời của bot, dòng log. «Quyền thư mục» là thư mục nào (Drive, máy chủ hay repo) | Sổ ticket priority1; journal gateway; người báo | Codex + người báo |
| EV-06 | Ca (d): PMTEST ngày 24/11 05:31, IN-F8FA8D30 | Ứng viên có mã đó có trong `intake_candidates` không; trạng thái outbox (`delivered`?); có sự kiện phân loại nào không. Thiết kế hiện nay: IN không tạo việc (`src/server/inbox.ts:16`). Cần xác nhận ca này đúng như thế, không có lỗi khác | `psql` chỉ đọc trên d1-ai1 | Codex |
| EV-07 | Ca (e): đổi giờ họp BoM đã xác nhận trong LibeAI | Thời điểm tin xác nhận; ai xác nhận; đổi **một buổi** hay **cả lịch lặp**, đúng như lời trong tin; tin đó có thành ứng viên intake không (mã IN) | Telegram LibeAI; `psql` (`source_events`, `intake_candidates`) | Codex + người báo |
| EV-08 | Ca (f): phiên nhắc theo lịch không đọc được lịch sử nhóm | Phiên nào (cron của priority1 hay của Hermes), giờ chạy, kết quả hay lỗi. Telegram Bot API không có lệnh đọc lại lịch sử nhóm; nhắc việc chỉ đọc được dữ liệu đã lưu trên nền tảng | Cấu hình cron trên d1-ai1; log lần chạy | Codex |
| EV-09 | Tài khoản dùng để nghiệm thu | Với ba người BoM Tech và một thành viên Tech: tài khoản đang hoạt động, đã kích hoạt, đã liên kết Telegram; danh sách dự án có membership và vai ở từng dự án. Đây là đầu vào cho `deploy/tech-roster.sql` và `deploy/bom-seats.sql`. Dữ liệu ngoài repo | Trang quản trị tài khoản; `psql` chỉ đọc | Codex |
| EV-10 | Bản nguồn danh sách việc | Bản nào là nguồn để nhập: (1) Google Sheet «Checklist dau viec cua Tech theo BU_Update 07.11.2026», trang «Đầu việc Tech», sửa lần cuối 25/11/2026 10:02 (+07); hay (2) tệp `LibeTech_NhiemVu_KeHoach_KPI_2026-11.xlsx` sửa lần cuối 02/11/2026 13:31 (+07), là bảng kế hoạch/KPI. Trạng thái hiện tại: «chờ PM xác nhận bản nguồn» | PM | PM |
| EV-11 | P0 còn mở từ `docs/DELIVERY-020-release-0.9.0-20261122.md:58-66` | Unit outbox chạy dạng user unit hay system unit | `systemctl` / `systemctl --user` trên d1-ai1 | Codex |

Các mục của hạng mục B–F được bổ sung vào bảng này khi mỗi PR mở.
