# Brainstorm: Dashboard Active Projects (Option B)

## Overview
Dựa trên sự lựa chọn Phương án B ("Operations Command Center" tinh gọn), chúng ta sẽ thêm một danh sách trực quan vào Dashboard nhằm theo dõi nhanh tiến độ của các dự án đang ở trạng thái "Active" (In Progress, In Review).

## API & Backend (Trpc)
1. **Endpoint mới:** Tạo `trpc.dashboard.getActiveProjects` trong `routers/dashboard.ts` để lấy danh sách dự án.
2. **Logic Fetching:** Lấy các projects có `status === "in_progress" | "in_review"` mà User tham gia (vai trò Manager hoặc Member).
3. **Tính toán Tiến độ (Progress):**
   - Đếm số lượng Modules của dự án đó: `totalModules`.
   - Đếm số lượng Modules đã xong: `doneModules`.
   - Trả về phần trăm tiến độ `progressPct = (doneModules / totalModules) * 100`.

## Giao diện (UI) components
1. **Vị trí hiển thị:** Trong `src/app/(app)/dashboard/page.tsx`, chia lại layout phần dưới thành cấu trúc `grid grid-cols-1 lg:grid-cols-2 gap-6`. Một bên là "Active Projects", bên kia là "My Modules" hoặc đặt Active Projects phía trên tuỳ vào độ trọn vẹn màn hình.
2. **Thiết kế Component `ActiveProjectsList`**:
   - Sử dụng Card của Shadcn UI, viền tinh tế.
   - Header: "Active Projects" kèm icon (ví dụ: `Activity` hoặc `Target`).
   - Body: Danh sách cuộn dạng List.
3. **Mỗi Item trong danh sách:**
   - **Tên dự án** in đậm + Status badge (In Progress / Needs Changes).
   - Bên phải hiển thị **Phần trăm Progress**, kèm Deadline.
   - Bên dưới một thanh Line progress hẹp siêu mượt (vd gradient từ màu Info -> Success).
   - Hover state có viền sáng nhẹ kiểu Glassmorphism.

## Luồng công việc (Workflow)
1. Cập nhật TRPC Router => Test API.
2. Viết UI component => Render Dummy Data.
3. Tích hợp API và hoàn thiện Dashboard.

Vui lòng xem qua thiết kế này. Khi bạn chốt, tôi sẽ lên kế hoạch (Implementation Plan) và bắt đầu code.
