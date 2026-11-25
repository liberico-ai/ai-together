import {describe,expect,test} from 'vitest';
import {intakeTrail,type TrailInput,type TrailRequest} from '../src/server/intake-trail';

// GIAO VIỆC 5 B, T6: the pure trail of a message, from the rows the viewer may read. Each step is shown from its own row, none inferred from another.
const base:TrailInput={kind:'candidate',receivedAt:'2026-11-25T01:00:00.000Z',candidateState:'confirmed',projectName:'Cổng bán hàng mẫu',triagedAt:null,triagedBy:null,requests:[],workLinks:[],hiddenLinks:0,seatOpen:true};
const req=(over:Partial<TrailRequest>={}):TrailRequest=>({id:'r1',state:'pending',filedAt:'2026-11-25T02:00:00.000Z',filedBy:'Người lập',decidedBy:null,decidedAt:null,workCode:null,...over});
const pool=(over:Partial<TrailInput>={}):TrailInput=>({...base,kind:'pool',candidateState:undefined,poolState:'unassigned',projectName:null,...over});

describe('intakeTrail',()=>{
  test('(24) nothing readable: neutral copy that neither claims nor denies work, and no label claims work was made or given',()=>{
    const t=intakeTrail(base);
    expect(t.label).toBe('Đã nhận — chưa thấy yêu cầu hay việc nào trong phạm vi của bạn');
    expect(t.steps.find(s=>s.key==='request')!.label).toBe('Chưa thấy yêu cầu hay liên kết việc nào trong phạm vi của bạn');
    expect(t.steps.map(s=>s.key+':'+s.state)).toEqual(['received:done','triaged:done','request:waiting','decision:skipped']);
    for(const x of [t,intakeTrail({...base,candidateState:'new'}),intakeTrail(pool()),intakeTrail(base),intakeTrail({...base,requests:[req()]})]){
      expect(x.label).not.toMatch(/đã tạo|đã giao/i);
      for(const s of x.steps) expect(s.label).not.toMatch(/đã tạo|đã giao/i);
    }
    expect(intakeTrail({...base,candidateState:'new'}).waitingOn).toBe('điều phối dự án');
    expect(intakeTrail({...base,candidateState:'dismissed'}).waitingOn).toBe('');
  });

  test('(25) a pending request waits for a BoM seat; no enabled seat says so; a rejection names who and when; an approval gives the work code, who and when',()=>{
    expect(intakeTrail({...base,requests:[req()]})).toMatchObject({label:'Đã lập yêu cầu — chờ BoM duyệt',waitingOn:'ghế BoM của dự án'});
    expect(intakeTrail({...base,requests:[req()],seatOpen:null}).waitingOn).toBe('Yêu cầu chờ ghế BoM của dự án.');
    expect(intakeTrail({...base,requests:[req()],seatOpen:false})).toMatchObject({waitingOn:'dự án chưa có ghế BoM'});
    const rejected=intakeTrail({...base,requests:[req({state:'rejected',decidedBy:'Ghế BoM thử',decidedAt:'2026-11-25T03:00:00.000Z'})]});
    expect(rejected).toMatchObject({label:'Bị từ chối',waitingOn:''});
    expect(rejected.steps.find(s=>s.key==='decision')).toMatchObject({state:'done',actor:'Ghế BoM thử',at:'2026-11-25T03:00:00.000Z'});
    const approved=intakeTrail({...base,requests:[req({state:'approved',decidedBy:'Ghế BoM thử',decidedAt:'2026-11-25T03:00:00.000Z',workCode:'WR-1A2B3C4D'})]});
    expect(approved).toMatchObject({label:'Đã duyệt — việc WR-1A2B3C4D',waitingOn:''});
    expect(approved.steps.find(s=>s.key==='decision')).toMatchObject({state:'done',actor:'Ghế BoM thử',at:'2026-11-25T03:00:00.000Z'});
    // a pending request outranks a rejected one (it is the one that waits); an approval outranks a rejection
    expect(intakeTrail({...base,requests:[req({id:'a',state:'rejected',decidedBy:'x',decidedAt:'2026-11-25T03:00:00.000Z'}),req({id:'b'})]}).label).toBe('Đã lập yêu cầu — chờ BoM duyệt');
    expect(intakeTrail({...base,requests:[req({id:'a',state:'rejected',decidedBy:'x',decidedAt:'2026-11-25T03:00:00.000Z'}),req({id:'b',state:'approved',workCode:'W-9',decidedBy:'y',decidedAt:'2026-11-25T04:00:00.000Z'})]}).label).toBe('Đã duyệt — việc W-9');
    // a link to existing work
    expect(intakeTrail({...base,workLinks:[{workCode:'LT-DEMO-014',at:'2026-11-25T02:30:00.000Z'}]})).toMatchObject({label:'Đã liên kết việc LT-DEMO-014',waitingOn:''});
  });

  test('(26) a pool item not yet assigned waits for the triager; an assigned one shows the project but, when its requests are not readable, none of their content',()=>{
    const t=intakeTrail(pool());
    expect(t).toMatchObject({label:'Đã nhận — chưa gán dự án',waitingOn:'người phân loại (Team Tech)'});
    expect(t.steps.map(s=>s.key+':'+s.state)).toEqual(['received:done','triaged:waiting','request:skipped','decision:skipped']);
    const hidden=intakeTrail(pool({poolState:'assigned',projectName:'Cổng bán hàng mẫu',triagedAt:'2026-11-25T02:00:00.000Z',triagedBy:'Người phân loại',hiddenLinks:1}));
    expect(hidden.label).toBe('Đã gán dự án Cổng bán hàng mẫu');
    expect(hidden.waitingOn).toBe('Yêu cầu chờ ghế BoM của dự án.');
    expect(hidden.steps.find(s=>s.key==='triaged')).toMatchObject({state:'done',actor:'Người phân loại'});
    expect(hidden.steps.find(s=>s.key==='request')).toMatchObject({state:'done'});
    expect(JSON.stringify(hidden)).not.toContain('WR-');
    expect(intakeTrail(pool({poolState:'dismissed',triagedAt:'2026-11-25T02:00:00.000Z',triagedBy:'Người phân loại'}))).toMatchObject({label:'Đã bỏ qua',waitingOn:''});
  });
});
