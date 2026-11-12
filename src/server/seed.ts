import type { Database } from './db';
import { ids, demoProfiles, otherPrincipal } from './identities';
import { projectWorkSummary } from './projector';
import { syncTemplateIndex } from './document-templates';
export const demoSha = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
export async function seed(db: Database) {
  await db.transaction(async tx => {
    if ((await tx.query('SELECT id FROM projects LIMIT 1')).rows.length) return;
    for (const [id, tenant, name, bu] of [
      [ids.sales, ids.tenant, 'Cổng bán hàng mẫu', 'BU Bán hàng mẫu'],
      [ids.transport, ids.tenant, 'Điều phối vận tải mẫu', 'BU Vận tải mẫu'],
      [ids.otherProject, ids.otherTenant, 'Dự án tenant đối chứng', 'Tenant B'],
    ]) await tx.query('INSERT INTO projects(id, tenant_id, name, bu) VALUES($1,$2,$3,$4)', [id, tenant, name, bu]);
    for (const [id, tenant, project, name, repo] of [
      [ids.salesService, ids.tenant, ids.sales, 'Sales Portal', 'demo/sales-portal'],
      [ids.transportService, ids.tenant, ids.transport, 'Transport Console', 'demo/transport-console'],
      [ids.otherService, ids.otherTenant, ids.otherProject, 'Isolated Service', 'demo/isolated'],
    ]) await tx.query('INSERT INTO services(id,tenant_id,project_id,name,owner,repository,environment) VALUES($1,$2,$3,$4,$5,$6,$7)', [id, tenant, project, name, 'Đội kỹ thuật mô phỏng', repo, 'Môi trường mô phỏng']);
    const rows = [
      [ids.pilot, ids.tenant, ids.sales, ids.salesService, 'LT-DEMO-014', 'Bộ lọc địa bàn trên cổng bán hàng', 'review', 'high', -1, true],
      ['13000000-0000-4000-8000-000000000002', ids.tenant, ids.sales, ids.salesService, 'LT-DEMO-015', 'Chuẩn hóa hồ sơ triển khai và rollback', 'doing', 'normal', 3, true],
      ['13000000-0000-4000-8000-000000000003', ids.tenant, ids.sales, ids.salesService, 'LT-DEMO-016', 'Xác nhận tiêu chí nghiệm thu với chủ dự án', 'blocked', 'high', null, false],
      ['13000000-0000-4000-8000-000000000004', ids.tenant, ids.sales, ids.salesService, 'LT-DEMO-017', 'Bổ sung quy trình tiếp nhận sự cố', 'planned', 'normal', 6, false],
      [ids.transportWork, ids.tenant, ids.transport, ids.transportService, 'LT-DEMO-018', 'Bổ sung nhật ký đối soát chuyến', 'doing', 'normal', 4, false],
      [ids.otherWork, ids.otherTenant, ids.otherProject, ids.otherService, 'OTHER-001', 'Không hiển thị ngoài tenant đối chứng', 'planned', 'normal', 7, false],
    ];
    for (const [id, tenant, project, service, code, title, state, priority, offset, hasSpec] of rows) {
      const due = offset === null ? null : new Date(Date.now() + Number(offset) * 86400000).toISOString();
      const sales = project === ids.sales;
      await tx.query(`INSERT INTO work_items(id,tenant_id,project_id,service_id,code,title,state,priority,assignee_id,technical_id,business_id,due_at,criteria,spec_url,source_sha)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, [id,tenant,project,service,code,title,state,priority,
        sales && hasSpec ? demoProfiles.engineer.id : null, sales ? demoProfiles.technical.id : null, sales ? demoProfiles.business.id : null,
        due, hasSpec ? 'Người dùng lọc được theo địa bàn; dữ liệu không vượt phạm vi dự án; kết quả có nguồn và thời điểm.' : '',
        hasSpec ? 'https://example.com/demo/specs/' + code : null, hasSpec ? demoSha : null]);
      await tx.query('INSERT INTO audit_events(tenant_id,project_id,work_id,actor_id,kind,payload) VALUES($1,$2,$3,$4,$5,$6)',
        [tenant,project,id,tenant === ids.tenant ? demoProfiles.manager.id : otherPrincipal.id,'created',JSON.stringify({ synthetic: true, note: 'Khởi tạo dữ liệu mô phỏng, không phải việc thật.' })]);
    }
    await tx.query(`INSERT INTO evidence(tenant_id,project_id,work_id,kind,source_id,source_type,source_sha,revision,quality_score,note,actor_id)
      VALUES($1,$2,$3,'checks',$4,'manual',$5,1,0,$6,$7)`, [ids.tenant,ids.sales,ids.pilot,'https://example.com/demo/checks/014',demoSha,'Bản ghi mô phỏng. Chưa truy GitHub, chưa xác nhận checks thực tế.',demoProfiles.engineer.id]);
    for (const tenant of [ids.tenant, ids.otherTenant]) await syncTemplateIndex(tx, tenant);
    for (const [tenant, project] of [[ids.tenant,ids.sales],[ids.tenant,ids.transport],[ids.otherTenant,ids.otherProject]]) await projectWorkSummary(tx,tenant,project);
  });
}
