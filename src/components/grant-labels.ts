import type { ProjectGrant, ReportPermission } from '@/server/types';

// Vietnamese names for project roles and report permissions; one map for the team screen and the ballots.
export const ROLE_LABELS: Record<ProjectGrant['role'], string> = { viewer: 'Chỉ đọc', engineer: 'Thực hiện', manager: 'Điều phối',
  technical: 'Nghiệm thu kỹ thuật', business: 'Nghiệm thu nghiệp vụ' };
export const PERMISSION_LABELS: Record<ReportPermission, string> = { people_read: 'Xem điểm nhân sự', quality_review: 'Đánh giá phản hồi', report_approve: 'Chốt kết quả' };
/** An unknown code is shown as itself rather than guessed. */
export const roleLabel = (role: string): string => (ROLE_LABELS as Record<string, string>)[role] ?? role;
export const permissionLabel = (permission: string): string => (PERMISSION_LABELS as Record<string, string>)[permission] ?? permission;
