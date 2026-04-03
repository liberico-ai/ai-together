# Kế hoạch Xây dựng Hệ Khung "Vận hành" (Operations Ticketing)

Xin lỗi vì tôi đã hiểu nhầm ý của bạn. Bạn muốn cấu trúc ứng dụng rõ ràng:
- **Projects & Modules (hiện tại):** Dành riêng cho quy trình Phát triển (Development).
- **Vận hành (mới):** Là một phân hệ (feature) ngang hàng hoàn toàn mới trên thanh Sidebar. Chức năng chính là tiếp nhận và xử lý các vấn đề từ Jira (Customer Support, Operations, Maintenance).

Dưới đây là bản thiết kế sửa đổi để chúng ta thiết lập toàn bộ phân hệ này:

## Các Đề Xuất Thay Đổi (Proposed Changes)

Dựa trên thiết kế mới, chúng ta sẽ xem "Vận hành" (Operations) như một hệ dữ liệu riêng biệt không liên quan đến bảng `tasks` hay `projects` của khối Phát triển.

### 1. Database Schema (Tạo bảng độc lập)
#### [NEW] `drizzle/schema/operations.ts`
Tạo bảng chứa danh sách ticket vận hành.
- `id`: Định dạng `OP-001`.
- `jiraIssueKey`: (VD `LBR-123`) liên kết ID gốc của Jira.
- `title`, `description`: Tiêu đề và mô tả.
- `status`: Trạng thái (VD: `open`, `in_progress`, `resolved`, `closed`).
- `priority`: Mức độ ưu tiên.
- `assigneeId`: Tham chiếu tới bảng `users`, ánh xạ từ `userJiraMap` đã làm lúc trước.

### 2. Sửa lại Backend Webhook
#### [MODIFY] `src/app/api/jira-webhook/route.ts`
Hủy bỏ logic tự tìm Project và tạo Module Development như trước.
Thay vào đó, webhook ngay lập tức bóc tách dữ liệu và chèn trực tiếp 1 bản ghi vào bảng `operations`.

### 3. Frontend & Phân hệ UI mới
#### [MODIFY] `src/components/layout/sidebar.tsx`
Thêm mục menu mới "Vận hành" lên thanh Sidebar điều hướng (sau "Projects").

#### [NEW] `src/app/(app)/operations/page.tsx`
Tạo màn hình lưới (Data Table hoặc Kanban tùy ý) liệt kê toàn bộ các Operations issues vừa đồng bộ từ Jira sang để team Vận hành có thể nhìn thấy, xem chi tiết và assign.

## Điểm Cần Phê Duyệt (User Review Required)

> [!IMPORTANT]
> **View của màn Vận hành:**
> Ở màn hình `/operations`, bạn muốn hiển thị danh sách các Issues Vận hành dưới dạng **Bảng dữ liệu (Data Table)** truyền thống hay hiển thị dạng **Cột trạng thái (Kanban Board)** giống như tính năng Modules của bạn?

> [!NOTE]
> Tôi sẽ rollback lại (hoặc xóa logic) việc add `jiraProjectKey` vào `projects.ts` ở bước trước và chuyển toàn bộ focus sang hệ `operations` mới này. Bảng `userJiraMap` thì vẫn sẽ giữ lại để ánh xạ User.

Nếu kiến trúc trên đã đúng ý bạn (một App Module Vận Hành tách biệt), vui lòng phê duyệt để tôi tiến hành sửa code và xây màn hình!
