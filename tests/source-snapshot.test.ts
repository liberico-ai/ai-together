import { expect,test } from 'vitest';
import { inspectSourceSnapshot } from '../src/server/source-snapshot';

const header=['STT','BU','Đầu việc','Người phụ trách','Phối hợp','Trạng thái','Hạn','Ghi chú'];
const base={source_id:'synthetic-sheet',source_type:'google_sheet',source_url:'https://docs.google.com/spreadsheets/d/synthetic/edit',
  ingested_at:'2026-11-10T09:00:00Z',quality_score:0.5,quality_basis:'Synthetic fixture; not approved',
  sheet:'Đầu việc Tech',range:'A1:H5',source_modified_at:null,
  values:[header,['1','XECA','Thử ghép vận tải','Quân','Toàn','Đang triển khai','','UAT'],
    ['2','LBRC','Thử Hermes','','Phương','Hoàn thành','11/09/2026','Chưa nghiệm thu']]};

test('reports source exceptions without turning source done into acceptance',()=>{
  const result=inspectSourceSnapshot(base);
  expect(result.counts).toEqual({rows:2,source_done:1,source_open:1,exceptions:3});
  expect(result.exceptions.map(e=>e.code)).toEqual(['MISSING_DUE','MISSING_OWNER','AMBIGUOUS_DUE']);
  expect(result.rows[1].source_ref).toBe('synthetic-sheet/Đầu việc Tech!A3:H3');
  expect(result.note).toContain('not technical or business acceptance');
});

test('detects a changed or removed source row but does not infer a task identity',()=>{
  const next={...base,values:[header,['1','XECA','Thử ghép vận tải','Phương','Toàn','Đang triển khai','11/11/2026','UAT']]};
  const report=inspectSourceSnapshot(next,base);
  expect(report.exceptions.map(e=>e.code)).toContain('SOURCE_CHANGED');
  expect(report.exceptions.map(e=>e.code)).toContain('SOURCE_REMOVED');
  expect(report.rows[0].source_ref).toContain('A2:H2');
});

test('rejects another source and malformed or duplicate input',()=>{
  expect(()=>inspectSourceSnapshot(base,{...base,source_id:'other'})).toThrow('SOURCE_ID_MISMATCH');
  expect(()=>inspectSourceSnapshot({...base,values:[['Wrong'],...base.values.slice(1)]})).toThrow('SOURCE_HEADER_MISMATCH');
  const duplicate={...base,values:[...base.values,['2','LBRC','Another','','','Đang triển khai','','']]};
  expect(inspectSourceSnapshot(duplicate).exceptions.some(e=>e.code==='DUPLICATE_STT')).toBe(true);
});

test('keeps a US month/day date as a format conflict instead of falsely invalidating it',()=>{
  const source={...base,values:[header,['43','LBRC','Thử hạn','','','Đang triển khai','11/15/2026','']]};
  expect(inspectSourceSnapshot(source).exceptions.map(e=>e.code)).toContain('DATE_FORMAT_CONFLICT');
  const invalid={...base,values:[header,['43','LBRC','Thử hạn','','','Đang triển khai','31/02/2026','']]};
  expect(inspectSourceSnapshot(invalid).exceptions.map(e=>e.code)).toContain('INVALID_DUE');
});

test('accepts Sheets date-only cells exported as midnight timestamps',()=>{
  const source={...base,values:[header,['45','LBRC','Phiếu xuất kho','Quân','','Chưa triển khai','2026-11-17 00:00:00','']]};
  expect(inspectSourceSnapshot(source).exceptions.map(e=>e.code)).not.toContain('INVALID_DUE');
});
