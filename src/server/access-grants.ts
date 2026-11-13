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
