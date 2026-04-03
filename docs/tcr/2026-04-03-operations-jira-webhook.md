# TCR — Phân hệ Vận Hành (Jira Operations)
Date: 2026-04-03
Tier: 2
Agent: Antigravity

## Đã làm gì
Theo yêu cầu sửa đổi kiến trúc, quy trình tiếp nhận Issue từ Jira đã được tách riêng khỏi các Dự án Phát triển (Projects). Một hệ thống độc lập mang tên **"Vận hành"** đã được xây dựng từ Backend, Database cho đến giao diện người dùng.

1. **Thiết lập Database Schema độc lập**:
Tạo một bảng lưu trữ hoàn toàn mới mang tên `operations` để thu nhận tickets, cùng với kiểu Enum `operation_status`. Đã cập nhật thư viện `id-gen.ts` cấp phép cho prefix `OP` để sinh mã ID (VD: `OP-001`).
2. **Cập nhật Webhook Endpoint**:
Trực tiếp parse payload từ sự kiện (`issue_created` và `issue_updated` qua Jira Webhook) và Insert vào bảng `operations` thay vì nhồi nhét dưới dạng task cục bộ trong các Module như định hướng cũ.
3. **Triển khai UI System**:
Thêm mới Menu Bar Sidebar `Vận hành` (dùng icon LifeBuoy).
Đã setup page `/operations` dưới dạng **Bảng dữ liệu truyền thống (Data Table)** của Shadcn UI theo đúng yêu cầu, có đi kèm hiển thị người xử lý (Assignee), trạng thái huy hiệu (Status Badge), Jira Issue Key.

## Files đã thay đổi
| File | Zone | Thay đổi |
|------|------|---------|
| `drizzle/schema/operations.ts` | FLUID | [NEW] Database Schema riêng biệt cho ticket vận hành. |
| `drizzle/schema/index.ts` | FLUID | Export bảng operations. |
| `src/server/trpc/routers/operations.ts` | FLUID | [NEW] tRPC router đảm nhiệm CRUD ticket (Query bảng DB). |
| `src/server/trpc/routers/index.ts` | FLUID | Tích hợp router vận hành vào hệ App Router chung. |
| `src/lib/id-gen.ts` | FLUID | Thêm mapper "OP: operations" hỗ trợ sinh key tự động. |
| `src/app/api/jira-webhook/route.ts` | FLUID | Hook lại luồng xử lý payload của Webhook. Chèn vào `operations`. |
| `src/components/layout/sidebar.tsx` | FLUID | Thêm link menu điều hướng Vận hành trên thanh điều hướng. |
| `src/app/(app)/operations/page.tsx` | FLUID | [NEW] Màn hình Frontend dưới dạng Data Table lấy dữ liệu từ tRPC. |

## Quyết định quan trọng
- Do module này hoạt động song song với **Projects** (Phát triển), các bản ghi `operations` không còn map với `ProjectId`. Thay vào đó, nó đại diện cho các task vận hành diện rộng trên hệ thống. 

## Xác minh tự động
- [x] Linter ELSint đã xác thực toàn bộ các files Typescript `route.ts`, `page.tsx` và `operations.ts` ở mức 0 Errors, 0 Warnings!

> **Warning** 
> Chạy migration script DB (`npx drizzle-kit push` tại máy Local) để đồng bộ DB Table mới `operations`.
