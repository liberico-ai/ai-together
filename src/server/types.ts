export type Role = 'manager' | 'engineer' | 'technical' | 'business' | 'viewer' | 'bot';
export type ReportPermission = 'people_read' | 'quality_review' | 'report_approve';
export type ProjectGrant = { projectId:string; role:Exclude<Role,'bot'>; reportPermissions:ReportPermission[] };
export type Principal = { id: string; tenantId: string; projectIds: string[]; name: string; role: Role; grants?:ProjectGrant[]; accountAdmin?:boolean };
export function projectRole(p:Principal,projectId:string):Role {
  if(p.role==='bot') return 'bot';
  if(!p.projectIds.includes(projectId)) return 'viewer';
  return p.grants ? p.grants.find(g=>g.projectId===projectId)?.role ?? 'viewer' : p.role;
}
export type Project = { id: string; name: string; bu: string };
export type Service = { id: string; project_id: string; name: string; owner: string; repository: string; environment: string; observed_sha: string | null; observed_at: string | null; desired_sha: string | null };
export type State = 'planned' | 'doing' | 'review' | 'blocked' | 'done';
export type Work = { id: string; tenant_id: string; project_id: string; service_id: string; code: string; title: string; state: State; priority: 'high' | 'normal'; assignee_id: string | null; technical_id: string | null; business_id: string | null; due_at: string | null; criteria: string; spec_url: string | null; source_sha: string | null; version: number; revision: number; created_at: string; updated_at: string };
export type Evidence = { id: string; work_id: string; kind: string; source_id: string; source_type: string; source_sha: string; revision: number; ingested_at: string; quality_score: number; note: string; actor_id: string };
export type AuditEvent = { id: string; work_id: string; actor_id: string; kind: string; payload: Record<string, unknown>; created_at: string };
export type Acceptance = { technical: boolean; business: boolean };
export type WorkDetail = { work: Work; evidence: Evidence[]; events: AuditEvent[]; acceptance: Acceptance };
export type Summary = { total: number; doing: number; review: number; done: number; blocked: number; missing_owner: number; missing_due: number; overdue: number; missing_spec: number };
export type Overview = { summary: Summary; asOf: string | null; source: 'Z2'; synthetic: boolean };
export type Reconciliation = {code:string;source_sha:string;source_id:string;source_type:string;ingested_at:string;quality_score:string;result:Record<string,unknown>};
export type WorkspaceData = { people:Principal[]; reconciliations:Reconciliation[]; projects: Project[]; services: Service[]; work: Work[]; overview: Overview };
export type ProjectProfile = { project_id: string; objective: string; owner_bu: string; pm_label: string; vault_pointer: string | null; repo_url: string | null; status: 'proposed' | 'active' | 'paused' | 'closed'; version: number; updated_at: string };
export type ProjectChannel = { id: string; project_id: string; chat_id: string; topic_id: string; mode: 'command_reply' | 'active'; state: 'proposed'; policy_version: string; enabled_from: null; approver_id: null; created_at: string };
export type ProjectRegistry = { project: Project; profile: ProjectProfile | null; channels: ProjectChannel[]; domain: { code: 'LIBERICO_BU' | 'XECA' | 'IBS_HI' | null; label: string; countsTowardTotals: boolean } };
