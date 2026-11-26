// GIAO VIỆC 5 E: an Excel file is named as such with the way to export CSV, and the import screen never waits forever; when it gives up it says the write may have happened.
import {afterEach,expect,test,vi} from 'vitest';
import {readSheetCsv} from '../src/server/csv';
import {api} from '../src/components/api';

afterEach(()=>{vi.unstubAllGlobals();});

test('an .xlsx upload is refused as Excel, with the way to export CSV',()=>{
 const xlsx=new Uint8Array([0x50,0x4b,0x03,0x04,0x14,0x00,0x06,0x00,0x08,0x00,0xff,0xfe,0x00]);
 let refused:{code?:string;message?:string;status?:number}={};
 try{readSheetCsv(xlsx);}catch(error){refused=error as typeof refused;}
 expect(refused.code).toBe('XLSX_NOT_SUPPORTED');
 expect(refused.status).toBe(422);
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
