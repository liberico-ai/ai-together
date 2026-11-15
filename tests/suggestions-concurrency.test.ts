import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {createHash,randomUUID} from 'node:crypto';
import {native,openHarness,waitForBlocked,type Harness} from './slice1-db';
import {pm,seedSlice1} from './slice1-fixtures';
import {aiPrincipal,proposeRev,registerDoc,seedMembers} from './slice3-fixtures';
import {ids} from '../src/server/identities';
import {canonicalJson,skillManifests} from '../src/server/skills';
import {SuggestionService} from '../src/server/suggestions';

describe.skipIf(!native)('draft decision concurrency (native PostgreSQL)',()=>{
  let h:Harness;
  beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);});
  afterEach(async()=>{await h.reset();await h.close();});
  const n=async(t:string)=>Number((await h.operator.query<{n:string}>(`SELECT count(*) n FROM ${t}`)).rows[0].n);

  test('two confirmations of one draft in parallel leave one decision and one revision',async()=>{
    const svc=new SuggestionService(h.db,h.operator,[]);
    const d=await proposeRev(h,pm,await registerDoc(h,pm));
    const output={skill:'technical_writer',manifestHash:skillManifests.technical_writer.hash,sources:[{id:d.record.id}],claims:[],questions:[],conflicts:[],confidence:70,toolRequests:[],result:{sections:[],terms:[]}};
    const {draftId}=await svc.submitDraft({id:aiPrincipal.id,tenantId:ids.tenant,projectIds:[ids.sales]},{skill:'technical_writer',projectId:ids.sales,entityType:'document',entityId:d.record.id,output,
      inputHash:'c'.repeat(64),modelVersion:'synthetic-model',dedupeKey:'dk-'+randomUUID(),traceId:randomUUID()});
    const valueHash=createHash('sha256').update(canonicalJson(output)).digest('hex');
    const revisions=await n('document_revisions');
    const b=(kk:string)=>({result:'confirmed',valueHash,revision:{expectedVersion:d.record.version,basedOnRevisionId:d.record.latest_revision_id,sourceRevision:null,sourceHash:null,sourceModifiedAt:null,
      changes:{summary:`Thay đổi từ nháp ${kk}`,present:[],missing:[]},sourceRefs:[]}});
    let both!:Promise<PromiseSettledResult<unknown>[]>;
    // the document row is held, so both confirmations are in flight when it is released
    await h.operator.transaction(async tx=>{
      await tx.query('SELECT id FROM document_records WHERE id=$1 FOR UPDATE',[d.record.id]);
      both=Promise.allSettled([svc.decide(pm,draftId,b('một'),'conc-key-0001',randomUUID()),svc.decide(pm,draftId,b('hai'),'conc-key-0002',randomUUID())]);
      await waitForBlocked(h,2);
    });
    const res=await both;
    expect(res.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    const bad=res.filter(r=>r.status==='rejected') as PromiseRejectedResult[];
    expect(bad[0].reason).toMatchObject({code:'DRAFT_ALREADY_DECIDED',status:409});
    expect(await n('draft_decisions')).toBe(1);
    expect(await n('document_revisions')).toBe(revisions+1);
  });
});
