import { Plus } from 'lucide-react';
import { projectRole } from '../server/types';
import type { Principal } from '../server/types';

/** Who is offered «Tạo công việc»: a Team Tech member (any project) or a manager of at least one project. The service decides again; this only hides a button. */
export const canCreateWork = (p: Principal) => p.techMember === true || p.projectIds.some(id => projectRole(p, id) === 'manager');

export function CreateWorkButton({ principal, onClick }: { principal: Principal; onClick: () => void }) {
  if (!canCreateWork(principal)) return null;
  return <button className="primary" onClick={onClick}><Plus size={17} />Tạo công việc</button>;
}
