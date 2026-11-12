import { z } from 'zod';
import { pooledDatabase } from '../src/server/db';
import { syncTemplateIndex } from '../src/server/document-templates';

// Operator login only. Run against a test database or an approved server copy; prints only the tenant and the inserted count.
const databaseUrl = process.env.MIGRATION_DATABASE_URL;
if (!databaseUrl) throw new Error('Set MIGRATION_DATABASE_URL to the protected operator database URL.');
const parsed = z.string().uuid().safeParse(process.argv[2]);
if (!parsed.success) throw new Error('Use <tenantId> as a UUID.');
const tenantId = parsed.data;

const db = pooledDatabase(databaseUrl);
try {
  const { inserted } = await db.transaction(tx => syncTemplateIndex(tx, tenantId));
  console.log(JSON.stringify({ tenantId, inserted }));
} finally { await db.close(); }
