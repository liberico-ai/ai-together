import { z } from 'zod';
import { scoped, type Database, type Queryable } from './db';
import { AppError, invariant } from './errors';
import { deduplicate } from './service';
import { projectRole } from './types';
import type { Principal, Project, ProjectChannel, ProjectProfile, ProjectRegistry } from './types';

export const REPORTING_DOMAINS = ['LIBERICO_BU', 'XECA', 'IBS_HI'] as const;
export type ReportingDomain = typeof REPORTING_DOMAINS[number];
const LABELS: Record<ReportingDomain, string> = { LIBERICO_BU: 'Liberico BU', XECA: 'Xeca', IBS_HI: 'IBS HI' };
export function reportingDomainLabel(code: ReportingDomain | null): string { return code ? LABELS[code] : 'Chưa xác nhận'; }

const httpsUrl = z.string().url().max(1000).refine(v => { try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } }, 'Dùng URL HTTPS không chứa thông tin đăng nhập.');
const profileSchema = z.object({
  expectedVersion: z.number().int().min(0), objective: z.string().max(2000), ownerBu: z.string().max(120), pmLabel: z.string().max(120),
  vaultPointer: z.string().max(500).nullable(), repoUrl: httpsUrl.nullable(), status: z.enum(['proposed', 'active', 'paused', 'closed']),
}).strict();
const channelSchema = z.object({
  expectedVersion: z.number().int().min(1), chatId: z.string().regex(/^-[1-9][0-9]{0,18}$/), topicId: z.string().regex(/^(?:[0-9]{1,10})?$/), mode: z.enum(['command_reply', 'active']), policyVersion: z.string().min(1).max(40),
}).strict();

const iso = (v: unknown) => new Date(v as string).toISOString();
type ProfileRow = ProjectProfile & { id: string };
type ChannelRow = Omit<ProjectChannel, 'created_at' | 'enabled_from'> & { created_at: unknown; enabled_from: unknown };
const toProfile = (r: ProfileRow): ProjectProfile => ({ project_id: r.project_id, objective: r.objective, owner_bu: r.owner_bu, pm_label: r.pm_label, vault_pointer: r.vault_pointer, repo_url: r.repo_url, status: r.status, version: r.version, updated_at: iso(r.updated_at) });
const toChannel = (r: ChannelRow): ProjectChannel => ({ id: r.id, project_id: r.project_id, chat_id: r.chat_id, topic_id: r.topic_id, mode: r.mode, state: r.state, policy_version: r.policy_version, enabled_from: r.enabled_from == null ? null : iso(r.enabled_from), approver_id: r.approver_id ?? null, created_at: iso(r.created_at) });
type Status = ProjectProfile['status'];
const NEXT: Record<Status, Status[]> = { proposed: ['active'], active: ['paused', 'closed'], paused: ['active', 'closed'], closed: [] };
export function nextProjectStatus(current: Status | null, requested: Status): Status {
  if (current === null) invariant(requested === 'proposed', 'PROJECT_STATUS_CONFLICT', 'Hồ sơ mới phải bắt đầu ở trạng thái đề xuất.', 409);
  else invariant(current === requested || NEXT[current].includes(requested), 'PROJECT_STATUS_CONFLICT', 'Không thể chuyển trạng thái dự án theo cách này.', 409);
  return requested;
}
const denied = () => new AppError('SCOPE_DENIED', 'Không tìm thấy dự án trong phạm vi được cấp.', 404);

function readable(p: Principal, projectId: string) {
  invariant(p?.role !== 'bot', 'READ_ONLY', 'Vai này không được dùng sổ dự án.', 403);
  invariant(p.projectIds.includes(projectId), 'SCOPE_DENIED', 'Không tìm thấy dự án trong phạm vi được cấp.', 404);
}
function manager(p: Principal, projectId: string) {
  readable(p, projectId);
  invariant(projectRole(p, projectId) === 'manager', 'MANAGER_REQUIRED', 'Chỉ điều phối dự án được thực hiện thao tác này.', 403);
}
async function event(tx: Queryable, p: Principal, projectId: string, type: 'project_profile' | 'project_channel', entityId: string, kind: string, key: string, payload: unknown) {
  await tx.query('INSERT INTO registry_events(tenant_id,project_id,entity_type,entity_id,actor_id,kind,command_key,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [p.tenantId, projectId, type, entityId, p.id, kind, key, JSON.stringify(payload)]);
}

export class ProjectRegistryService {
  constructor(private db: Database) {}
  async registry(p: Principal, projectId: string): Promise<ProjectRegistry> {
    readable(p, projectId);
    return scoped(this.db, { ...p, projectIds: [projectId] }, async tx => {
      const project = (await tx.query<Project>('SELECT id,name,bu FROM projects WHERE id=$1', [projectId])).rows[0];
      if (!project) throw denied();
      const profile = (await tx.query<ProfileRow>('SELECT * FROM project_profiles WHERE project_id=$1', [projectId])).rows[0];
      const channels = (await tx.query<ChannelRow>('SELECT * FROM project_channels WHERE project_id=$1 ORDER BY created_at DESC, id LIMIT 200', [projectId])).rows;
      const map = (await tx.query<{ domain_code: ReportingDomain }>('SELECT domain_code FROM project_domain_mappings WHERE project_id=$1 ORDER BY mapping_version DESC LIMIT 1', [projectId])).rows[0];
      const code = map?.domain_code ?? null;
      return { project, profile: profile ? toProfile(profile) : null, channels: channels.map(toChannel), domain: { code, label: reportingDomainLabel(code), countsTowardTotals: code !== null } };
    });
  }
  async saveProfile(p: Principal, projectId: string, raw: unknown, key: string): Promise<ProjectProfile> {
    manager(p, projectId);
    const input = profileSchema.parse(raw);
    return scoped(this.db, { ...p, projectIds: [projectId] }, tx => deduplicate(tx, p, projectId, key, { op: 'project.save_profile', projectId, ...input }, async () => {
      if (input.expectedVersion === 0) nextProjectStatus(null, input.status);
      else {
        const cur = (await tx.query<{ status: Status; version: number }>('SELECT status,version FROM project_profiles WHERE tenant_id=$1 AND project_id=$2 FOR UPDATE', [p.tenantId, projectId])).rows[0];
        invariant(cur && cur.version === input.expectedVersion, 'REVISION_CONFLICT', 'Hồ sơ dự án đã thay đổi; tải lại rồi lưu lại.', 409);
        nextProjectStatus(cur.status, input.status);
      }
      const v = [p.tenantId, projectId, input.objective, input.ownerBu, input.pmLabel, input.vaultPointer, input.repoUrl, input.status, p.id];
      const row = input.expectedVersion === 0
        ? (await tx.query<ProfileRow>(`INSERT INTO project_profiles(tenant_id,project_id,objective,owner_bu,pm_label,vault_pointer,repo_url,status,updated_by)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(tenant_id,project_id) DO NOTHING RETURNING *`, v)).rows[0]
        : (await tx.query<ProfileRow>(`UPDATE project_profiles SET objective=$3,owner_bu=$4,pm_label=$5,vault_pointer=$6,repo_url=$7,status=$8,updated_by=$9,version=version+1,updated_at=now()
            WHERE tenant_id=$1 AND project_id=$2 AND version=$10 RETURNING *`, [...v, input.expectedVersion])).rows[0];
      invariant(row, 'REVISION_CONFLICT', 'Hồ sơ dự án đã thay đổi; tải lại rồi lưu lại.', 409);
      await event(tx, p, projectId, 'project_profile', row.id, 'profile_saved', key, { ...input, versionBefore: input.expectedVersion, versionAfter: row.version });
      return toProfile(row);
    }));
  }
  async proposeChannel(p: Principal, projectId: string, raw: unknown, key: string): Promise<ProjectChannel> {
    manager(p, projectId);
    const input = channelSchema.parse(raw);
    return scoped(this.db, { ...p, projectIds: [projectId] }, tx => deduplicate(tx, p, projectId, key, { op: 'project.propose_channel', projectId, ...input }, async () => {
      // The registry is one aggregate: the profile version guards every channel proposal.
      const cur = (await tx.query<{ version: number }>('SELECT version FROM project_profiles WHERE tenant_id=$1 AND project_id=$2 FOR UPDATE', [p.tenantId, projectId])).rows[0];
      invariant(cur, 'PROFILE_REQUIRED', 'Cần lập hồ sơ dự án trước khi đề xuất kênh.', 409);
      invariant(cur.version === input.expectedVersion, 'REVISION_CONFLICT', 'Hồ sơ dự án đã thay đổi; tải lại rồi đề xuất lại.', 409);
      const { expectedVersion, ...channel } = input;
      const row = (await tx.query<ChannelRow>(`INSERT INTO project_channels(tenant_id,project_id,chat_id,topic_id,mode,policy_version,proposed_by)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(tenant_id,project_id,chat_id,topic_id) DO NOTHING RETURNING *`,
        [p.tenantId, projectId, channel.chatId, channel.topicId, channel.mode, channel.policyVersion, p.id])).rows[0];
      invariant(row, 'CHANNEL_ALREADY_PROPOSED', 'Kênh này đã được đề xuất cho dự án.', 409);
      const bumped = (await tx.query<{ version: number }>('UPDATE project_profiles SET version=version+1,updated_by=$3,updated_at=now() WHERE tenant_id=$1 AND project_id=$2 AND version=$4 RETURNING version', [p.tenantId, projectId, p.id, expectedVersion])).rows[0];
      invariant(bumped, 'REVISION_CONFLICT', 'Hồ sơ dự án đã thay đổi; tải lại rồi đề xuất lại.', 409);
      await event(tx, p, projectId, 'project_channel', row.id, 'channel_proposed', key, { ...input, versionBefore: expectedVersion, versionAfter: bumped.version });
      return toChannel(row);
    }));
  }
}
