import {describe,expect,test} from 'vitest';
import {createHash} from 'node:crypto';
import {decodeUtf8Strict,parseCsv,readSheetCsv,SHEET_LIMITS} from '../src/server/csv';
import {inspectSourceSnapshot} from '../src/server/source-snapshot';
import {cellsFingerprint} from '../src/server/source-snapshot';

// Fake rows only: made-up codes such as TEST001, made-up names.
const HEAD='STT,BU,Đầu việc,Người phụ trách,Phối hợp,Trạng thái,Hạn,Ghi chú';
const bytes=(s:string)=>new TextEncoder().encode(s);
const csv=(...lines:string[])=>bytes([HEAD,...lines].join('\n')+'\n');
const code=async(fn:()=>unknown)=>{try{fn();}catch(e){return {code:(e as {code?:string}).code,status:(e as {status?:number}).status};}return null;};

describe('parseCsv (RFC 4180)',()=>{
  test('(1) a cell with a comma, a doubled quote and a line break reads as written; the row number counts records, not physical lines',()=>{
    const recs=parseCsv('a,b\n1,"x, y"\n2,"say ""hi"""\n3,"two\nlines"\n4,z\n');
    expect(recs).toEqual([['a','b'],['1','x, y'],['2','say "hi"'],['3','two\nlines'],['4','z']]);
    const sheet=readSheetCsv(csv('1,LBRC,"Việc TEST001\nhai dòng",Người A,,Đang làm,25/11/2026,','2,XECA,Việc khác,Người B,,Chưa làm,,'));
    expect(sheet.rows.map(r=>r.row)).toEqual([2,3]);
    expect(sheet.rows[0].cells[2]).toBe('Việc TEST001\nhai dòng');
  });
  test('CRLF and CR line ends, a missing final newline and short rows are read; a blank record is not a row',()=>{
    expect(parseCsv('a,b\r\n1,2\r\n3,4')).toEqual([['a','b'],['1','2'],['3','4']]);
    expect(parseCsv('a\r1\r')).toEqual([['a'],['1']]);
    const sheet=readSheetCsv(bytes(HEAD+'\r\n\r\n1,LBRC,Việc ngắn TEST002\r\n,,,,,,,\r\n2,XECA,Việc hai,Người B\r\n'));
    expect(sheet.rows.map(r=>r.row)).toEqual([3,5]);
    expect(sheet.rows[0].cells).toEqual(['1','LBRC','Việc ngắn TEST002','','','','','']);
  });
  test('(2) an unclosed quote, and text after a closing quote, are CSV_MALFORMED',async()=>{
    expect(await code(()=>parseCsv('a,"b\n1,2\n'))).toEqual({code:'CSV_MALFORMED',status:422});
    expect(await code(()=>parseCsv('a,"b"x,c\n'))).toEqual({code:'CSV_MALFORMED',status:422});
  });
  test('(2) a quote inside a cell that is not quoted is CSV_MALFORMED (RFC 4180; Codex P2, gate round 1); a quoted cell keeps its "" as one quote',async()=>{
    expect(await code(()=>parseCsv('a,Việc "sai" dạng,c\n'))).toEqual({code:'CSV_MALFORMED',status:422});
    expect(await code(()=>parseCsv('a,b"\n'))).toEqual({code:'CSV_MALFORMED',status:422});
    expect(parseCsv('a,"Việc ""đúng"" dạng",c\n')).toEqual([['a','Việc "đúng" dạng','c']]);
  });
});

describe('decodeUtf8Strict and readSheetCsv',()=>{
  test('(2) bytes that are not UTF-8 are NOT_UTF8 with the instruction; a BOM is dropped; a good file hashes its raw bytes',async()=>{
    const bad=new Uint8Array([...bytes(HEAD+'\n1,LBRC,'),0xff,0xfe,...bytes(',,,,,,\n')]);
    expect(await code(()=>readSheetCsv(bad))).toEqual({code:'NOT_UTF8',status:422});
    try{decodeUtf8Strict(bad);}catch(e){expect((e as Error).message).toContain('không lưu qua Excel');}
    const body=csv('1,LBRC,Việc TEST003 đủ dài,Người A,,Đang làm,,');
    const withBom=new Uint8Array([0xef,0xbb,0xbf,...body]);
    const sheet=readSheetCsv(withBom);
    expect(sheet.rows).toHaveLength(1);
    expect(sheet.fileHash).toBe(createHash('sha256').update(withBom).digest('hex'));
    expect(decodeUtf8Strict(withBom).startsWith('STT')).toBe(true);
  });
  test('(3) a wrong header, a ninth column with text, a missing column: SOURCE_HEADER_MISMATCH; an empty ninth column is fine',async()=>{
    expect(await code(()=>readSheetCsv(bytes('STT,BU,Đầu việc,Phụ trách,Phối hợp,Trạng thái,Hạn,Ghi chú\n1,LBRC,x\n')))).toEqual({code:'SOURCE_HEADER_MISMATCH',status:422});
    expect(await code(()=>readSheetCsv(bytes('STT,BU,Đầu việc,Người phụ trách,Phối hợp,Trạng thái,Hạn\n1,LBRC,x\n')))).toEqual({code:'SOURCE_HEADER_MISMATCH',status:422});
    expect(await code(()=>readSheetCsv(bytes(HEAD+',Cột lạ\n1,LBRC,Việc TEST004,,,,,,x\n')))).toEqual({code:'SOURCE_HEADER_MISMATCH',status:422});
    expect(await code(()=>readSheetCsv(csv('1,LBRC,Việc TEST004,A,,Đang làm,,,tràn cột')))).toEqual({code:'SOURCE_HEADER_MISMATCH',status:422});
    expect(readSheetCsv(bytes(HEAD+',\n1,LBRC,Việc TEST004,A,,Đang làm,,,\n')).rows).toHaveLength(1);
    expect(await code(()=>readSheetCsv(bytes('')))).toEqual({code:'SOURCE_HEADER_MISMATCH',status:422});
  });
  test('(3) limits: more than 500 data rows, a cell over 2000 characters, a file over 256 KB',async()=>{
    const many=(n:number)=>csv(...Array.from({length:n},(_,i)=>`${i+1},LBRC,Việc số ${i+1},,,,,`));
    expect(readSheetCsv(many(SHEET_LIMITS.dataRows)).rows).toHaveLength(500);
    expect(await code(()=>readSheetCsv(many(SHEET_LIMITS.dataRows+1)))).toEqual({code:'TOO_MANY_ROWS',status:422});
    expect(await code(()=>readSheetCsv(csv('1,LBRC,'+'x'.repeat(SHEET_LIMITS.cellChars+1)+',,,,,')))).toEqual({code:'CELL_TOO_LONG',status:422});
    expect(readSheetCsv(csv('1,LBRC,'+'x'.repeat(SHEET_LIMITS.cellChars)+',,,,,')).rows).toHaveLength(1);
    expect(await code(()=>readSheetCsv(new Uint8Array(SHEET_LIMITS.fileBytes+1)))).toEqual({code:'FILE_TOO_LARGE',status:413});
  });
  test('(4) the eight-cell fingerprint of a row equals the one inspectSourceSnapshot computes for the same row',()=>{
    const cells=['7','LBRC','Việc TEST005 kiểm vân tay','Người A','Người B','Đang làm','2026-11-30','Ghi chú thử'];
    const sheet=readSheetCsv(csv(cells.map(c=>c.includes(',')?`"${c}"`:c).join(',')));
    const report=inspectSourceSnapshot({source_id:'fake-source',source_type:'google_sheet',source_url:'https://docs.google.com/spreadsheets/d/fakefakefake/edit',
      ingested_at:'2026-11-25T00:00:00+07:00',quality_score:0.5,quality_basis:'synthetic test rows',sheet:'Đầu việc Tech',range:'A1:H2',source_modified_at:null,
      values:[HEAD.split(','),cells]});
    expect(report.rows[0].fingerprint).toBe(cellsFingerprint(sheet.rows[0].cells));
    expect(report.rows[0].fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });
});
