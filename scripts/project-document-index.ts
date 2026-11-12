import { pooledDatabase } from '../src/server/db';
import { projectDocumentIndex } from '../src/server/document-projector';

const [tenantId, projectId] = process.argv.slice(2);
const databaseUrl = process.env.MIGRATION_DATABASE_URL;
if (!tenantId || !projectId || !databaseUrl) throw new Error('Use <tenantId> <projectId> and the protected operator database URL.');
const db = pooledDatabase(databaseUrl);
try {
  console.log(JSON.stringify({ status: 'projected', ...(await projectDocumentIndex(db, tenantId, projectId)) }));
} finally { await db.close(); }
