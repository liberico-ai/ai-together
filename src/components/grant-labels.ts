import type { ProjectGrant, ReportPermission } from '@/server/types';
import { DOC_APPROVAL_PREFIX, DOC_APPROVAL_TYPES } from '../server/access-grants';
import { TYPE_NAMES } from './documents-view';

// Vietnamese names for project roles and report permissions; one map for the team screen and the ballots.
export const ROLE_LABELS: Record<ProjectGrant['role'], string> = { viewer: 'Chỉ đọc', engineer: 'Thực hiện', manager: 'Điều phối',
  technical: 'Nghiệm thu kỹ thuật', business: 'Nghiệm thu nghiệp vụ' };
export const PERMISSION_LABELS: Record<ReportPermission, string> = { people_read: 'Xem điểm nhân sự', quality_review: 'Đánh giá phản hồi', report_approve: 'Chốt kết quả' };
/** An unknown code is shown as itself rather than guessed. */
export const roleLabel = (role: string): string => (ROLE_LABELS as Record<string, string>)[role] ?? role;
/** 'doc_approve:<type>' of one of the eight types reads 'Duyệt bản chuẩn: ' + the document type's name (TYPE_NAMES, the one table of those names). */
export const permissionLabel = (permission: string): string => {
  const type = (DOC_APPROVAL_TYPES as readonly string[]).find(t => permission === DOC_APPROVAL_PREFIX + t);
  return type ? 'Duyệt bản chuẩn: ' + TYPE_NAMES[type] : (PERMISSION_LABELS as Record<string, string>)[permission] ?? permission;
};
