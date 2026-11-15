import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {native,openHarness,waitForBlocked,type Harness} from './slice1-db';
import {pm,seedSlice1} from './slice1-fixtures';
import {seedBom} from './slice3-fixtures';
import {BomService} from '../src/server/bom';
import {WorkService} from '../src/server/service';

type S=Awaited<ReturnType<typeof seedBom>>;
type Card=Awaited<ReturnType<BomService['command']>>;

describe.skipIf(!native)('BoM 3/3 concurrency (native PostgreSQL)',()=>{
  let h:Harness;
  beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);});
  afterEach(async()=>{await h.reset();await h.close();});

  const n=async(sql:string)=>Number((await h.operator.query<{n:string}>(`SELECT count(*) n FROM ${sql}`)).rows[0].n);
  const propose=(bom:BomService,s:S,allocation=s.selection)=>
    bom.command(pm,{action:'propose',workId:s.workId,expectedVersion:1,allocation,reason:'Phân công mô phỏng trong bản thử'},randomUUID());
  const agree=(bom:BomService,id:string,p:S['roster'][number],requestKey=randomUUID())=>
    bom.command(p,{action:'vote',proposalId:id,choice:'agree',note:'Xác nhận bằng phiên thử nghiệm'},requestKey);
  /** The operational login holds a row lock; every call parks on it, then all are released together. */
  const race=async(lock:string,params:unknown[],calls:()=>Promise<Card>[],blocked:number)=>{
    let all!:Promise<PromiseSettledResult<Card>[]>;
    await h.operator.transaction(async tx=>{
      await tx.query(lock,params);
      all=Promise.allSettled(calls());
      await waitForBlocked(h,blocked);
    });
    return all;
  };

  test('two third votes at the same time create exactly one bom_receipts row',async()=>{
    const s=await seedBom(h);
    const bom=new BomService(h.db),work=new WorkService(h.db);
    const {proposal:{id}}=await propose(bom,s);
    await agree(bom,id,s.roster[0]);await agree(bom,id,s.roster[1]);
    const res=await race('SELECT id FROM bom_proposals WHERE id=$1 FOR UPDATE',[id],
      ()=>[agree(bom,id,s.roster[2],randomUUID()),agree(bom,id,s.roster[2],randomUUID())],2);
    expect(res.map(r=>r.status)).toEqual(['fulfilled','fulfilled']);
    const cards=res.map(r=>(r as PromiseFulfilledResult<Card>).value);
    expect(cards.map(c=>c.proposal.state)).toEqual(['applied','applied']);
    expect(await n('bom_receipts')).toBe(1);
    expect(await n("audit_events WHERE kind='bom_allocation_applied'")).toBe(1);
    expect(await n('bom_votes')).toBe(3);
    expect((await work.detail(pm,s.workId)).work).toMatchObject({assignee_id:pm.id,version:2});
  });

  test('two competing proposals reaching their third vote together yield one receipt and one reconcile',async()=>{
    const s=await seedBom(h);
    const bom=new BomService(h.db),work=new WorkService(h.db);
    const proposals=[(await propose(bom,s)).proposal.id,(await propose(bom,s,{...s.selection,lead_id:s.roster[2].id})).proposal.id];
    for(const id of proposals){await agree(bom,id,s.roster[0]);await agree(bom,id,s.roster[1]);}
    // both third votes pass their own proposal row and park on the shared work row
    const res=await race('SELECT id FROM work_items WHERE id=$1 FOR UPDATE',[s.workId],
      ()=>proposals.map(id=>agree(bom,id,s.roster[2])),2);
    expect(res.map(r=>r.status)).toEqual(['fulfilled','fulfilled']);
    const cards=res.map(r=>(r as PromiseFulfilledResult<Card>).value);
    expect(cards.map(c=>c.proposal.state).sort()).toEqual(['applied','reconcile']);
    expect(cards.filter(c=>c.receipt)).toHaveLength(1);
    expect(await n('bom_receipts')).toBe(1);
    expect(await n("audit_events WHERE kind='bom_allocation_applied'")).toBe(1);
    expect(await n("bom_proposals WHERE state='reconcile'")).toBe(1);
    expect((await work.detail(pm,s.workId)).work.version).toBe(2);
  });
});
