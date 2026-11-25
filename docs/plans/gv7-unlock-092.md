# Kế hoạch GIAO VIỆC 7 — bản 0.9.2 «MỞ KHOÁ»

Nguồn: tệp giao việc 7 (25/11/2026 18:10, SHA-256 `9a12d727…3f80`). Các quyết định OQ-60/61/62 là **quyết định của phiên điều phối (Cowork) theo uỷ quyền Chairman 25/11/2026 17:48; Chairman có thể đổi** (ghi ở `docs/OPEN-QUESTIONS.md`).
Nền: `libetech-ai-os` @ `532fa41`. Migration mới: `028_unlock_092.sql` + `rollback/028_unlock_092.sql`. Plugin giữ 0.3.3.

Zone theo M8 câu 9 (2): `AGENTS.md` không sửa; mỗi hạng mục dưới đây ghi zone của dữ liệu nó ghi.

## Cơ chế từng mục

| Mục | Kết quả | Cơ chế | Zone ghi |
|---|---|---|---|
| M1 | Ghế BoM nhận việc mới, kể cả người duyệt tự nhận | Bỏ `SELF_ASSIGNMENT`, `BOM_ASSIGNEE_HELD` ở `work-requests.ts`. Giữ CHECK `decided_by<>requester_id` (024) và `SELF_ACCEPTANCE` | Z1 (`work_items`, `work_requests`) |
| M2 | Thành viên roster làm người thực hiện ở mọi dự án, làm được mọi thao tác của người thực hiện | Người thực hiện hợp lệ = `engineer` của dự án **hoặc** thành viên roster còn hiệu lực (`tech_roster_among`, DEFINER). Người roster chưa có membership ở dự án được cấp một dòng `work_access_grants` (Z1, chỉ thêm, có `granted_by` + nguồn: yêu cầu / phiếu 3/3 / mở phiên bản). `principal()` cộng dự án của các dòng này vào phạm vi với vai `viewer`. `WorkService.command` cho người thực hiện là thành viên roster (DB hỏi lại `app_actor_is_tech_member()`) chuyển trạng thái và nộp bằng chứng dù vai ở dự án là gì. Người ngoài roster: luật vai cũ | Z1 (`work_access_grants`) |
| M3 | Lúc duyệt đổi được người đã đề xuất | Bỏ `PROPOSAL_FIXED`. Sự kiện `approved` và audit `created` lưu `proposed`, `final`, `filledBySeat`, `changedBySeat`; người đổi = `actor_id` của sự kiện | Z1 (`work_request_events`, `audit_events`) |
| M4 | Việc duyệt từ yêu cầu chia lại được bằng phiếu 3/3 | Khi duyệt: một dòng `bom_sources` `source_ref='work_request:<id>'`, `fingerprint=request_hash`, `valid_until='infinity'`. Trigger: dòng nguồn từ yêu cầu phải khớp một yêu cầu đã duyệt và không sửa/xoá được. Migration điền bù cho việc đã duyệt dưới 0.9.1. Luật 3/3 (bom.ts, `bom_guard_assignment`) không đổi | Z1 (`bom_sources`) |
| M5 | Không yêu cầu nào chờ vô hạn | Bảng `identity.tech_bom` (tối đa 3 người mỗi tenant, chỉ người vận hành ghi qua `deploy/tech-bom.sql`, mỗi thay đổi ghi `identity.events`). `work_request_seat()` viết lại: BoM Tech (mọi dự án của tenant) **hoặc** ghế BoM của dự án có membership còn hiệu lực; **không** đòi liên kết Telegram. Phiên của BoM Tech trong luồng yêu cầu việc được mở phạm vi tới mọi dự án của tenant (`tech_bom_projects()`). Phiếu 3/3 giữ nguyên điều kiện ghế (có Telegram) | Z1 (identity) |
| M6 | Thành viên roster chưa có membership đăng nhập được | `principal()` không chặn `NO_PROJECT_ACCESS` khi là thành viên roster. Luồng yêu cầu việc chạy được với phạm vi rỗng (fail-closed: RLS không thấy gì ngoài yêu cầu của chính mình). Trang chủ chuyển về `/work-requests` khi chưa có dự án | — |
| M7 | Duyệt nhiều yêu cầu một lượt | `WorkRequestService.decideMany`: danh sách id (tối đa 200) hoặc một lô nhập; mỗi yêu cầu một giao dịch, một sự kiện, một người duyệt; dòng lỗi trả mã và câu báo riêng, không chặn dòng khác; chống ghi lặp theo khoá con suy từ khoá lượt | Z1 |
| M8 | OQ-62 | Câu 7 (2): mã việc từ tiêu đề, rồi ghi chú cho dòng LBRC/XECA; dòng IBS HI (hoặc chưa có đích) chỉ đọc tiêu đề. Câu 6: lô nhập ghi thêm tên tệp (`file_name`), cùng hash và thời điểm đã có. Người phụ trách ở bảng nhập được ánh xạ tới thành viên roster (M2). Cờ `LIBETECH_WORK_IMPORT` giữ nguyên; người triển khai bật khi triển khai | Z1 (`work_import_batches`) |
| M9 | OQ-61 B1–B5 giữ | Không đổi mã | — |
| M10 | Câu báo lỗi nói việc tiếp theo | Sửa câu ở luồng tạo, duyệt, nhập; không câu nào «chờ Chairman quyết»; không lộ tên dự án hay dữ liệu BU khác | — |

## Ranh giới giữ nguyên
- 3/3 khi chia lại; người tạo không tự duyệt (CHECK + trigger); người thực hiện khác người nghiệm thu.
- Người ngoài roster không thấy thêm gì: quyền cấp kèm chỉ cho thành viên roster, trigger kiểm lại.
- IBS HI: không đọc ghi chú; test riêng cho M2 và M5 ở dự án IBS HI.
- Không sửa `AGENTS.md` (PR nháp riêng cho dòng Z1, không merge).

## Test (đỏ trước, xanh sau)
`tests/unlock-092.test.ts`: một nhóm cho mỗi mục M1–M7, M10, và nhóm IBS HI. `tests/sheet-import.test.ts`: M8 câu 7 và câu 6. Các ca cũ khẳng định khoá cũ (`SELF_ASSIGNMENT`, `BOM_ASSIGNEE_HELD`, `PROPOSAL_FIXED`, ghế mất Telegram) được sửa theo luật mới.
