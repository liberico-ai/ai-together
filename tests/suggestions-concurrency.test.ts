import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {createHash,randomUUID} from 'node:crypto';
import {native,openHarness,waitForBlocked,type Harness} from './slice1-db';
import {pm,seedSlice1} from './slice1-fixtures';
import {aiPrincipal,proposeRev,registerDoc,seedMembers} from './slice3-fixtures';
import {ids} from '../src/server/identities';
import {canonicalJson,skillManifests} from '../src/server/skills';
import {SuggestionService} from '../src/server/suggestions';
import {DocumentService} from '../src/server/documents';

describe.skipIf(!native)('draft decision concurrency (native PostgreSQL)',()=>{
  let h:Harness;
  beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);await seedMembers(h);});
  afterEach(async()=>{await h.reset();await h.close();});
  const n=async(t:string)=>Number((await h.operator.query<{n:string}>(`SELECT count(*) n FROM ${t}`)).rows[0].n);

  test('two confirmations of one draft in parallel leave one decision and one revision',async()=>{
    const svc=new SuggestionService(h.db,h.operator,[]);
    const d=await proposeRev(h,pm,await registerDoc(h,pm));
    // the latest revision is named because of the OQ-53 (2) placeholder; revisit when OQ-53 is decided
    const output={skill:'technical_writer',manifestHash:skillManifests.technical_writer.hash,sources:[{id:d.record.id},{id:d.record.latest_revision_id}],claims:[],questions:[],conflicts:[],confidence:70,toolRequests:[],result:{sections:[],terms:[]}};
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

  async function setup(){
    const svc=new SuggestionService(h.db,h.operator,[]);
    const d=await proposeRev(h,pm,await registerDoc(h,pm));
    // the latest revision is named because of the OQ-53 (2) placeholder; revisit when OQ-53 is decided
    const output={skill:'technical_writer',manifestHash:skillManifests.technical_writer.hash,sources:[{id:d.record.id},{id:d.record.latest_revision_id}],claims:[],questions:[],conflicts:[],confidence:70,toolRequests:[],result:{sections:[],terms:[]}};
    const {draftId}=await svc.submitDraft({id:aiPrincipal.id,tenantId:ids.tenant,projectIds:[ids.sales]},{skill:'technical_writer',projectId:ids.sales,entityType:'document',entityId:d.record.id,output,
      inputHash:'c'.repeat(64),modelVersion:'synthetic-model',dedupeKey:'dk-'+randomUUID(),traceId:randomUUID()});
    const valueHash=createHash('sha256').update(canonicalJson(output)).digest('hex');
    const revision={expectedVersion:d.record.version,basedOnRevisionId:d.record.latest_revision_id,sourceRevision:null,sourceHash:null,sourceModifiedAt:null,changes:{summary:'Thay đổi đồng thời',present:[],missing:[]},sourceRefs:[]};
    return {svc,d,draftId,valueHash,revision};
  }

  test('a confirmation and a rejection of one draft in parallel leave one decision; the loser answers DRAFT_ALREADY_DECIDED and no revision is orphaned',async()=>{
    const {svc,d,draftId,valueHash,revision}=await setup();
    const revisions=await n('document_revisions');
    let confirm!:Promise<unknown>,reject!:Promise<unknown>;
    await h.operator.transaction(async tx=>{
      await tx.query('SELECT id FROM document_records WHERE id=$1 FOR UPDATE',[d.record.id]);
      // the confirmation takes the draft lock first and waits on the document row; the rejection then waits on the draft lock
      confirm=svc.decide(pm,draftId,{result:'confirmed',valueHash,revision},'conc-key-0011',randomUUID()).then(v=>v,e=>e);
      await waitForBlocked(h,1);
      reject=svc.decide(pm,draftId,{result:'rejected',valueHash,reason:'Từ chối song song'},'conc-key-0012',randomUUID()).then(v=>v,e=>e);
      await waitForBlocked(h,2);
    });
    const [c,r]=[await confirm,await reject] as [{decision?:{result:string}},{code?:string}];
    expect(c.decision?.result).toBe('confirmed');
    expect(r).toMatchObject({code:'DRAFT_ALREADY_DECIDED'});
    expect(await n('draft_decisions')).toBe(1);expect(await n('document_revisions')).toBe(revisions+1);
  });

  test('a draft confirmation racing a manual revision of the same document: exactly one succeeds; the manual proposal answers REVISION_CONFLICT when the confirmation won, the confirmation is held as SUBJECT_CHANGED when the manual proposal won; no decision without its revision, no revision a decision does not point to',async()=>{
    const {svc,d,draftId,valueHash,revision}=await setup();
    const revisions=await n('document_revisions');
    let confirm!:Promise<unknown>,manual!:Promise<unknown>;
    await h.operator.transaction(async tx=>{
      await tx.query('SELECT id FROM document_records WHERE id=$1 FOR UPDATE',[d.record.id]);
      confirm=svc.decide(pm,draftId,{result:'confirmed',valueHash,revision},'conc-key-0021',randomUUID()).then(v=>v,e=>e);
      manual=new DocumentService(h.db).proposeRevision(pm,d.record.id,revision,'conc-key-0022').then(v=>v,e=>e);
      await waitForBlocked(h,2);
    });
    const [c,m]=[await confirm,await manual] as [{decision?:unknown;code?:string;message?:string;status?:number},{record?:unknown;code?:string}];
    const confirmed=c.decision!==undefined,proposed=m.record!==undefined;
    expect([confirmed,proposed].filter(Boolean)).toHaveLength(1);
    expect(await n('document_revisions')).toBe(revisions+1);
    const latest=(await h.operator.query<{latest_revision_id:string}>('SELECT latest_revision_id FROM document_records WHERE id=$1',[d.record.id])).rows[0].latest_revision_id;
    const dec=(await h.operator.query<{document_revision_id:string}>('SELECT document_revision_id FROM draft_decisions')).rows;
    if(confirmed) {
      expect(m.code).toBe('REVISION_CONFLICT');
      expect(dec).toHaveLength(1);expect(dec[0].document_revision_id).toBe(latest);
    } else {
      expect(c).toMatchObject({code:'DRAFT_HELD',status:422});
      expect(c.message).toContain('SUBJECT_CHANGED');
      expect(dec).toHaveLength(0);
    }
  });

  // The two cases below are ordered: the lock queue on the document row decides who goes first, so each outcome is certain, not a race.
  // They run on native PostgreSQL only (waitForBlocked reads pg_stat_activity).
  test('the manual proposal waits first: it wins, and the confirmation that waited behind it reads the new revision and is held as SUBJECT_CHANGED',async()=>{
    const {svc,d,draftId,valueHash,revision}=await setup();
    const revisions=await n('document_revisions');
    let manual!:Promise<unknown>,confirm!:Promise<unknown>;
    await h.operator.transaction(async tx=>{
      await tx.query('SELECT id FROM document_records WHERE id=$1 FOR UPDATE',[d.record.id]);
      manual=new DocumentService(h.db).proposeRevision(pm,d.record.id,revision,'conc-key-0031').then(v=>v,e=>e);
      await waitForBlocked(h,1);
      confirm=svc.decide(pm,draftId,{result:'confirmed',valueHash,revision},'conc-key-0032',randomUUID()).then(v=>v,e=>e);
      await waitForBlocked(h,2);
    });
    const [m,c]=[await manual,await confirm] as [{record?:unknown;code?:string},{code?:string;message?:string;status?:number}];
    expect(m.record).toBeDefined();
    expect(c).toMatchObject({code:'DRAFT_HELD',status:422});
    expect(c.message).toContain('SUBJECT_CHANGED');
    expect(await n('draft_decisions')).toBe(0);
    expect(await n('document_revisions')).toBe(revisions+1);
  });

  test('the confirmation waits first: it wins, and the manual proposal behind it answers REVISION_CONFLICT',async()=>{
    const {svc,d,draftId,valueHash,revision}=await setup();
    const revisions=await n('document_revisions');
    let manual!:Promise<unknown>,confirm!:Promise<unknown>;
    await h.operator.transaction(async tx=>{
      await tx.query('SELECT id FROM document_records WHERE id=$1 FOR UPDATE',[d.record.id]);
      confirm=svc.decide(pm,draftId,{result:'confirmed',valueHash,revision},'conc-key-0041',randomUUID()).then(v=>v,e=>e);
      await waitForBlocked(h,1);
      manual=new DocumentService(h.db).proposeRevision(pm,d.record.id,revision,'conc-key-0042').then(v=>v,e=>e);
      await waitForBlocked(h,2);
    });
    const [c,m]=[await confirm,await manual] as [{decision?:{result:string}},{code?:string}];
    expect(c.decision?.result).toBe('confirmed');
    expect(m.code).toBe('REVISION_CONFLICT');
    const latest=(await h.operator.query<{latest_revision_id:string}>('SELECT latest_revision_id FROM document_records WHERE id=$1',[d.record.id])).rows[0].latest_revision_id;
    const dec=(await h.operator.query<{document_revision_id:string}>('SELECT document_revision_id FROM draft_decisions')).rows;
    expect(dec).toHaveLength(1);expect(dec[0].document_revision_id).toBe(latest);
    expect(await n('document_revisions')).toBe(revisions+1);
  });
});
