# TCR — Refactor Module & Task System

Date: 2026-04-09
Tier: 3
Branch: main (chưa commit)

## Đã làm gì
- Refactor toàn bộ hệ thống Module & Task: Module chuyển thành display-only (chỉ hiển thị cấu trúc project, checklist để note), Task thuộc Project trực tiếp thay vì thuộc Module.
- Task có thể link optional tới Module — khi link, tự động thêm checklist item vào Module.
- Thêm field `estimate_days` cho Task, mở quyền tạo Task cho member (không chỉ chairman/admin).
- Tạo trang Workload Overview mới hiển thị workload toàn bộ member hệ thống.
- Đổi "My Modules" thành "My Tasks", cập nhật Dashboard/Analytics dùng task-based metrics.

## Quyết định quan trọng
- **Bỏ status/assignee/priority/deadline/output trên Module** vì Module giờ chỉ là structural component, không phải work item. Task mới là work item chính.
- **Task thuộc Project (bắt buộc), link Module (tuỳ chọn)** — thay vì Task thuộc Module. Lý do: Task là đơn vị công việc gán người, Module là đơn vị tổ chức.
- **Auto-checklist**: Khi tạo Task link tới Module, tự động thêm checklist entry vào Module để track update.
- **Scoring chỉ cho Task** — bỏ module scoring vì module không còn status "done".
- **Workload page accessible cho tất cả** — không giới hạn admin/chairman.
- **Migration có backfill logic** — backfill `project_id` trên tasks từ `modules.project_id` (0 rows affected vì bảng tasks rỗng trên production).

## Files đã thay đổi

### Database & Schema
| File | Zone | Thay đổi |
|------|------|----------|
| `drizzle/migrations/0007_refactor_modules_tasks.sql` | GUARDED | [NEW] Migration: thêm project_id/estimate_days cho tasks, đổi module_id thành optional, bỏ 5 cột trên modules |
| `drizzle/migrations/meta/_journal.json` | GUARDED | Thêm entry migration 0007 |
| `drizzle/schema/modules.ts` | GUARDED | Bỏ assigneeId, status, priority, output, deadline, idx_modules_assignee |
| `drizzle/schema/tasks.ts` | GUARDED | Thêm projectId (NOT NULL FK), estimateDays, moduleId đổi thành optional + ON DELETE SET NULL |
| `drizzle/schema/relations.ts` | GUARDED | Bỏ assignee relation trên modules, thêm project relation trên tasks, thêm tasks relation trên projects |

### Backend (tRPC Routers)
| File | Zone | Thay đổi |
|------|------|----------|
| `src/server/trpc/routers/modules.ts` | FLUID | Đơn giản hóa: bỏ myModules, updateStatus, updateOutput. Chỉ giữ CRUD + updateChecklist |
| `src/server/trpc/routers/tasks.ts` | FLUID | Đổi sang projectId, thêm estimateDays, mở quyền member, auto-checklist khi link module |
| `src/server/trpc/routers/dashboard.ts` | FLUID | Đổi stats từ module-based sang task-based, thêm endpoint getWorkloadOverview |
| `src/server/trpc/routers/reviews.ts` | FLUID | Bỏ module status update, dùng createdBy thay assigneeId cho notifications |
| `src/server/trpc/routers/comments.ts` | FLUID | Dùng createdBy thay assigneeId cho module comment notifications |
| `src/server/trpc/routers/users.ts` | FLUID | Bỏ nullify assigneeId trên modules khi xoá user |
| `src/lib/scoring.ts` | FLUID | Bỏ module scoring (MODULE_EARLY/DONE/LATE, getModuleScoreType) |

### Frontend
| File | Zone | Thay đổi |
|------|------|----------|
| `src/app/(app)/modules/[id]/page.tsx` | FLUID | Bỏ status/assignee/deadline/priority UI, giữ checklist + docs + comments |
| `src/components/modules/module-list.tsx` | FLUID | Đơn giản hóa: chỉ hiển thị title + checklist progress |
| `src/components/modules/create-module-dialog.tsx` | FLUID | Bỏ assignee/deadline/priority fields |
| `src/components/tasks/task-list.tsx` | FLUID | [NEW] Task list component với status/assignee/priority/deadline/estimate |
| `src/components/tasks/create-task-dialog.tsx` | FLUID | [NEW] Dialog tạo task với project members, modules, priority, estimate |
| `src/app/(app)/projects/[id]/page.tsx` | FLUID | Thêm Tasks tab, ProjectProgress dùng tasks thay modules |
| `src/app/(app)/my-tasks/page.tsx` | FLUID | Đổi từ hiển thị modules sang tasks thật |
| `src/app/(app)/workload/page.tsx` | FLUID | [NEW] Workload overview: summary stats, member table, upcoming deadlines |
| `src/app/(app)/dashboard/page.tsx` | FLUID | Đổi myModules → myTasks, stats từ tasks |
| `src/app/(app)/analytics/page.tsx` | FLUID | Đổi module metrics → task metrics |
| `src/components/layout/sidebar.tsx` | FLUID | "My Modules" → "My Tasks", thêm "Workload" nav item |
| `src/components/layout/command-search.tsx` | FLUID | Đổi myModules → myTasks |

### API & Integrations
| File | Zone | Thay đổi |
|------|------|----------|
| `src/app/api/mcp/route.ts` | FLUID | Cập nhật MCP tools: bỏ module status/assignee, task cần projectId, dashboard dùng tasks |
| `src/app/api/cron/deadline-warning/route.ts` | FLUID | Đổi từ module deadlines sang task deadlines |

## Contract thay đổi không?
Có — đây là thay đổi lớn:
- **Module schema**: Bỏ 5 cột (assigneeId, status, priority, output, deadline)
- **Task schema**: Thêm projectId (required), estimateDays. moduleId đổi từ required → optional
- **tRPC API**: Bỏ modules.myModules, modules.updateStatus, modules.updateOutput. Tasks.create đổi input (projectId thay moduleId). Dashboard.getStats trả tasks thay modules.

## Tests
- TypeScript strict check: PASS (0 errors)
- Build: PASS (next build thành công, tất cả routes OK)
- Migration: Đã chạy trên production DB thành công

## Còn dở / Chưa làm
- Task detail page (`/tasks/[id]`) — chưa tạo, hiện link về project page
- MCP server tool `update_module_status` đã bị xoá — cần cập nhật MCP client documentation nếu có
- E2E tests chưa cập nhật cho flow mới

## Phiên sau cần biết
- Module giờ là display-only: không assign, không status, không deadline. Chỉ title + description + checklist + docs + comments.
- Task là work item chính: thuộc Project, gán người, có status/priority/deadline/estimate.
- Workload page mới tại `/workload` — hiển thị cho tất cả users.
- Score events cũ loại `module_done/module_early/module_late` vẫn tồn tại trong DB nhưng không sinh thêm nữa.
