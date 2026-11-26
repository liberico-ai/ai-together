// GIAO VIỆC 5 E: an Excel file is named as such with the way to export CSV, and the import screen never waits forever; when it gives up it says the write may have happened.
import {afterEach,expect,test,vi} from 'vitest';
import {readSheetCsv} from '../src/server/csv';
import {api} from '../src/components/api';

afterEach(()=>{vi.unstubAllGlobals();});

// a ZIP local header, then the given entry names as the central directory holds them: uncompressed text
const zip=(...entries:string[])=>new Uint8Array([0x50,0x4b,0x03,0x04,0x14,0x00,0x06,0x00,0x08,0x00,0xff,0xfe,0x00,...new TextEncoder().encode(entries.join('|'))]);
const refusalOf=(bytes:Uint8Array)=>{try{readSheetCsv(bytes);return {} as {code?:string;message?:string;status?:number};}catch(error){return error as {code?:string;message?:string;status?:number};}};

test('an .xlsx upload is refused as Excel, with the way to export CSV',()=>{
 const refused=refusalOf(zip('[Content_Types].xml','xl/workbook.xml'));
 expect(refused.code).toBe('XLSX_NOT_SUPPORTED');
 expect(refused.status).toBe(422);
 expect(refused.message).toContain('.csv');
});

test('another ZIP file is not called Excel (Codex gate, P2)',()=>{
 const refused=refusalOf(zip('anh/chup.png'));
 expect(refused.code).toBe('ZIP_NOT_CSV');
 expect(refused.status).toBe(422);
 expect(refused.message).not.toContain('Excel (.xlsx), chưa');
 expect(refused.message).toContain('.csv');
});

test('a call that outlives its time limit fails as CLIENT_TIMEOUT and says the write may be done',async()=>{
 // a server that answers after 300 ms; it honours the abort signal when one is given
 vi.stubGlobal('fetch',(_path:string,init:{signal?:AbortSignal})=>new Promise((resolve,reject)=>{
  const t=setTimeout(()=>resolve(new Response(JSON.stringify({data:'late',error:null}),{status:200})),300);
  init.signal?.addEventListener('abort',()=>{clearTimeout(t);reject(init.signal!.reason);});
 }));
 const call=(api as (path:string,body?:unknown,method?:string,options?:{timeoutMs:number})=>Promise<unknown>)('/api/v1/work-imports',{a:1},undefined,{timeoutMs:30});
 await expect(call).rejects.toMatchObject({code:'CLIENT_TIMEOUT'});
 await expect(call).rejects.toThrow(/có thể đã ghi xong/);
});
