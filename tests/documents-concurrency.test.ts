import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {native,openHarness,waitForBlocked,type Harness} from './slice1-db';
import {pm,seedSlice1} from './slice1-fixtures';
import {ids} from '../src/server/identities';
import {DocumentService} from '../src/server/documents';
import {syncTemplateIndex} from '../src/server/document-templates';
import type {DocumentDetail} from '../src/server/types';

describe.skipIf(!native)('document revision concurrency (native PostgreSQL)',()=>{
  let h:Harness;
  beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);});
  afterEach(async()=>{await h.reset();await h.close();});
  const input=()=>({expectedVersion:1,basedOnRevisionId:null,sourceRevision:null,sourceHash:null,sourceModifiedAt:null,
    changes:{summary:'Tóm tắt thay đổi đồng thời',present:[],missing:[]},sourceRefs:[]});
  const setup=async()=>{
    await h.operator.transaction(tx=>syncTemplateIndex(tx,ids.tenant));
    const svc=new DocumentService(h.db);
    const d=await svc.register(pm,{projectId:ids.sales,refCode:'',docType:'design',title:'Tài liệu đồng thời',sourceType:'drive',canonicalUri:'https://example.com/docs/c',
      ownerLabel:'',reviewDueAt:null,metadata:{missingFields:[]},sourceLinks:[]},'doc-key-0001');
    return {svc,id:d.record.id};
  };
  const n=async(sql:string)=>Number((await h.operator.query<{n:string}>(`SELECT count(*) n FROM ${sql}`)).rows[0].n);
  const race=async(id:string,calls:()=>Promise<DocumentDetail>[])=>{
    let both!:Promise<PromiseSettledResult<DocumentDetail>[]>;
    await h.operator.transaction(async tx=>{
      await tx.query('SELECT id FROM document_records WHERE id=$1 FOR UPDATE',[id]);
      both=Promise.allSettled(calls());
      await waitForBlocked(h,2);
    });
    return both;
  };

  test('two concurrent proposals on one version yield one revision and one REVISION_CONFLICT',async()=>{
    const {svc,id}=await setup();
    const res=await race(id,()=>[svc.proposeRevision(pm,id,input(),'conc-key-0001'),svc.proposeRevision(pm,id,input(),'conc-key-0002')]);
    expect(res.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    const bad=res.filter(r=>r.status==='rejected') as PromiseRejectedResult[];
    expect(bad).toHaveLength(1);expect(bad[0].reason).toMatchObject({code:'REVISION_CONFLICT',status:409});
    expect((await h.operator.query<{revision_no:number}>('SELECT revision_no FROM document_revisions')).rows.map(r=>r.revision_no)).toEqual([1]);
    expect((await h.operator.query<{version:number}>('SELECT version FROM document_records WHERE id=$1',[id])).rows[0].version).toBe(2);
    expect(await n("registry_events WHERE kind='revision_proposed'")).toBe(1);
  });

  test('two identical concurrent proposals with one key apply once and replay once',async()=>{
    const {svc,id}=await setup();
    const res=await race(id,()=>[svc.proposeRevision(pm,id,input(),'conc-key-0003'),svc.proposeRevision(pm,id,input(),'conc-key-0003')]);
    expect(res.map(r=>r.status)).toEqual(['fulfilled','fulfilled']);
    const v=res.map(r=>(r as PromiseFulfilledResult<DocumentDetail>).value);
    expect(v[0].record.latest_revision_id).toBe(v[1].record.latest_revision_id);
    expect(await n('document_revisions')).toBe(1);
    expect(await n("registry_events WHERE kind='revision_proposed'")).toBe(1);
  });
});
