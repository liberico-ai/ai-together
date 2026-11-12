import manifest from '../../docs/templates/manifest.json';
import type { Queryable } from './db';
import { AppError } from './errors';
import type { DocType } from './types';

export type TemplateEntry = { code: string; version: string; docType: DocType; title: string; path: string; sha256: string };
export const templateManifest: TemplateEntry[] = manifest.templates as TemplateEntry[];

export async function syncTemplateIndex(tx: Queryable, tenantId: string, entries: TemplateEntry[] = templateManifest): Promise<{ inserted: number }> {
  await tx.query("SELECT set_config('app.tenant_id',$1,true)", [tenantId]);
  let inserted = 0;
  for (const e of entries) {
    const got = await tx.query<{ id: string }>(`INSERT INTO document_templates(tenant_id,code,template_version,doc_type,title,path,content_hash)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(tenant_id,code,template_version) DO NOTHING RETURNING id`,
      [tenantId, e.code, e.version, e.docType, e.title, e.path, e.sha256]);
    inserted += got.rows.length;
    const row = (await tx.query<{ content_hash: string }>('SELECT content_hash FROM document_templates WHERE tenant_id=$1 AND code=$2 AND template_version=$3', [tenantId, e.code, e.version])).rows[0];
    if (row.content_hash !== e.sha256) throw new AppError('TEMPLATE_VERSION_REUSED', 'Phiên bản mẫu này đã có nội dung khác; hãy tăng phiên bản.', 409);
  }
  return { inserted };
}
