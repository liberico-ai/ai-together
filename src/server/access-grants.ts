import type { ProjectGrant } from './types';

// Pure rule, shared by the server (AccountService) and the team screen, so the two cannot drift (code review m-2).
/**
 * A grant change widens access unless every grant after it is a pure reduction of a grant held before:
 * same project, same role or down to viewer, and no report permission that was not held. Removing grants never widens.
 * A widening needs an approved ballot; a reduction is applied directly.
 */
export function widensAccess(before: ProjectGrant[], after: ProjectGrant[]): boolean {
  return !after.every(next => {
    const prior = before.find(grant => grant.projectId === next.projectId);
    return prior !== undefined && (next.role === prior.role || next.role === 'viewer')
      && next.reportPermissions.every(permission => prior.reportPermissions.includes(permission));
  });
}

// Right to approve a document's canonical revision, per document type (OQ-31 b). Carried by the same report_permissions list as the other
// permissions and granted only through an access-change ballot. The list must stay equal to DOC_TYPES in documents.ts and to migration 019.
export const DOC_APPROVAL_TYPES=['project_index','change_brief','requirements','design','plan','verification','guide','other'] as const;
export type DocApprovalType=typeof DOC_APPROVAL_TYPES[number];
export const DOC_APPROVAL_PREFIX='doc_approve:';
export const docApprovalCode=(t:DocApprovalType)=>`doc_approve:${t}` as const;
/** The document types a permission list lets its holder approve: prefix removed, in the order of DOC_APPROVAL_TYPES; unknown codes are dropped. */
export function docApprovalTypes(permissions:readonly string[]):DocApprovalType[] {
  return DOC_APPROVAL_TYPES.filter(type=>permissions.includes(docApprovalCode(type)));
}

/**
 * Task 7c: `after` differs from `before` only by ADDING doc_approve:* codes to exactly ONE project entry that already exists: same set of
 * projects, same role in every entry, every other permission unchanged. Permissions compare as sets, so a repeated code makes no difference
 * (T7C-26). `added` follows the order of DOC_APPROVAL_TYPES and is never empty. Any other change, including a repeated project entry, is null.
 */
export function docApprovalDelta(before:ProjectGrant[],after:ProjectGrant[]):{projectId:string;added:DocApprovalType[]}|null {
  if(before.length!==after.length||new Set(before.map(g=>g.projectId)).size!==before.length||new Set(after.map(g=>g.projectId)).size!==after.length) return null;
  const docCodes=new Set<string>(DOC_APPROVAL_TYPES.map(docApprovalCode));
  let found:{projectId:string;added:DocApprovalType[]}|null=null;
  for(const next of after) {
    const prior=before.find(g=>g.projectId===next.projectId);
    if(!prior||prior.role!==next.role) return null;
    const priorSet=new Set<string>(prior.reportPermissions),nextSet=new Set<string>(next.reportPermissions);
    const other=(set:Set<string>)=>[...set].filter(code=>!docCodes.has(code)).sort();
    if(JSON.stringify(other(priorSet))!==JSON.stringify(other(nextSet))) return null;
    if(DOC_APPROVAL_TYPES.some(type=>priorSet.has(docApprovalCode(type))&&!nextSet.has(docApprovalCode(type)))) return null;
    const added=DOC_APPROVAL_TYPES.filter(type=>nextSet.has(docApprovalCode(type))&&!priorSet.has(docApprovalCode(type)));
    if(!added.length) continue;
    if(found) return null;
    found={projectId:next.projectId,added};
  }
  return found;
}
