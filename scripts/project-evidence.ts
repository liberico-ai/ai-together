import { readFile,stat } from 'node:fs/promises';
import { pooledDatabase } from '../src/server/db';
import { projectEvidence } from '../src/server/evidence-projector';

const path=process.argv[2];
const databaseUrl=process.env.MIGRATION_DATABASE_URL;
if(!path||!databaseUrl) throw new Error('Use a prepared evidence export and the protected operator database URL.');
if((await stat(path)).size>8*1024*1024) throw new Error('Evidence export exceeds 8 MB.');
const db=pooledDatabase(databaseUrl);
try {
  const input:unknown=JSON.parse(await readFile(path,'utf8'));
  const result=await projectEvidence(db,input,{reviewRunId:process.argv[3]});
  console.log(JSON.stringify({status:'projected',...result}));
} finally {await db.close();}
