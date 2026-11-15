import {randomUUID} from 'node:crypto';
import {afterEach,beforeEach,expect,test} from 'vitest';
import {openHarness,type Harness} from './slice1-db';
import {seedSlice1} from './slice1-fixtures';
import {frozenRevision,proposeRev,recordingDb,registerDoc,reviewer,seedBom} from './slice3-fixtures';
import {BomService} from '../src/server/bom';
import {scoped} from '../src/server/db';
import {ids} from '../src/server/identities';

let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);});
afterEach(async()=>{await h.reset();await h.close();});

test('seedBom builds an enabled three-seat scope and a first proposal reaches pending',async()=>{
  const s=await seedBom(h);
  expect(s.roster).toHaveLength(3);
  const scope=(await h.operator.query<{seat_ids:string[];enabled:boolean}>('SELECT seat_ids,enabled FROM bom_scopes WHERE project_id=$1',[ids.sales])).rows[0];
  expect(scope.enabled).toBe(true);
  expect([...scope.seat_ids].sort()).toEqual(s.roster.map(p=>p.id).sort());
  const bom=new BomService(h.db);
  const sent=await bom.command(s.roster[1],{action:'propose',workId:s.workId,expectedVersion:1,allocation:s.selection,reason:'Phân công mô phỏng trong bản thử'},randomUUID());
  expect(sent.proposal.state).toBe('pending');
  expect(sent.votes).toEqual([]);
});

test('recordingDb records rows from query and from transaction',async()=>{
  const rec=recordingDb(h.db);
  await rec.db.query('SELECT $1::text AS marker',['direct-row']);
  await rec.db.transaction(async tx=>{await tx.query('SELECT $1::text AS marker',['transaction-row']);});
  expect(rec.rows()).toEqual([{marker:'direct-row'},{marker:'transaction-row'}]);
});

test('frozenRevision creates a verified, snapshotted revision and advances the document',async()=>{
  const doc=await registerDoc(h,reviewer);
  const frozen=await frozenRevision(h,doc.record.id,reviewer.id);
  const read=await scoped(h.operator,reviewer,async tx=>({
    rev:(await tx.query<{id:string;snapshot_ref:string|null;hash_verification:string;source_hash:string|null}>('SELECT id,snapshot_ref,hash_verification,source_hash FROM document_revisions WHERE id=$1',[frozen.revisionId])).rows[0],
    rec:(await tx.query<{latest_revision_id:string;version:number}>('SELECT latest_revision_id,version FROM document_records WHERE id=$1',[doc.record.id])).rows[0]}));
  expect(read.rev.id).toBe(frozen.revisionId);
  expect(read.rev.snapshot_ref).toMatch(/^synthetic:\/\/snapshot\//);
  expect(read.rev.hash_verification).toBe('verified');
  expect(read.rev.source_hash).toBe(frozen.hash);
  expect(read.rec.latest_revision_id).toBe(frozen.revisionId);
  expect(read.rec.version).toBe(frozen.version);
  expect(frozen.version).toBe(doc.record.version+1);
  // proposeRev builds on the document it is handed
  const next=await proposeRev(h,reviewer,{...doc,record:{...doc.record,version:frozen.version,latest_revision_id:frozen.revisionId}});
  expect(next.revisions).toHaveLength(2);
});
