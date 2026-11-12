import type { Principal } from './types';
export const ids = {
  tenant: '10000000-0000-4000-8000-000000000001', otherTenant: '20000000-0000-4000-8000-000000000001',
  sales: '11000000-0000-4000-8000-000000000001', transport: '11000000-0000-4000-8000-000000000002', otherProject: '21000000-0000-4000-8000-000000000001',
  salesService: '12000000-0000-4000-8000-000000000001', transportService: '12000000-0000-4000-8000-000000000002', otherService: '22000000-0000-4000-8000-000000000001',
  pilot: '13000000-0000-4000-8000-000000000001', transportWork: '13000000-0000-4000-8000-000000000005', otherWork: '23000000-0000-4000-8000-000000000001',
};
const person = (suffix: number) => '14000000-0000-4000-8000-' + String(suffix).padStart(12, '0');
export const demoProfiles: Record<string, Principal> = {
  manager: { id: person(1), tenantId: ids.tenant, projectIds: [ids.sales, ids.transport], name: 'Điều phối LibeTech', role: 'manager' },
  engineer: { id: person(2), tenantId: ids.tenant, projectIds: [ids.sales], name: 'Người thực hiện', role: 'engineer' },
  technical: { id: person(3), tenantId: ids.tenant, projectIds: [ids.sales], name: 'Người duyệt kỹ thuật', role: 'technical' },
  business: { id: person(4), tenantId: ids.tenant, projectIds: [ids.sales], name: 'Người nghiệm thu nghiệp vụ', role: 'business' },
  customer: { id: person(5), tenantId: ids.tenant, projectIds: [ids.transport], name: 'Khách dự án Vận tải mẫu', role: 'viewer' },
  bot: { id: person(6), tenantId: ids.tenant, projectIds: [ids.transport], name: 'Bot dự án Vận tải mẫu', role: 'bot' },
};
export const otherPrincipal: Principal = { id: '24000000-0000-4000-8000-000000000001', tenantId: ids.otherTenant, projectIds: [ids.otherProject], name: 'Tenant đối chứng', role: 'manager' };
export function personName(id: string | null) { return Object.values(demoProfiles).find(p => p.id === id)?.name ?? (id ? 'Người được giao' : 'Chưa giao'); }
