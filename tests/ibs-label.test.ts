// OQ-62 câu 4 (b): the importer of the Team Tech source snapshot writes no note for an IBS HI row, and the portfolio page says why the IBS HI group shows none.
import {expect,test} from 'vitest';

// Before the shared rule, the importer wrote every note as it stood: that is the fallback, so a missing rule fails as a wrong value.
const rule=async()=>{const m=await import('../src/server/'+'ibs-label').catch(()=>null);
 return {stored:(m?.storedSourceNote??((_bu:string,note:string)=>note)) as (bu:string,note:string)=>string,
  notice:(m?.sourceNoteNotice??(()=>'')) as (bu:string)=>string,ibs:(m?.ibsLabel??(()=>false)) as (v:string|null|undefined)=>boolean};};

test('an IBS HI row is stored without its note; LBRC and XECA rows keep theirs',async()=>{
 const {stored}=await rule();
 for(const bu of ['IBS HI','ibs-hi','I B S','ＩＢＳ ＨＩ']) expect(stored(bu,'chữ nghiệp vụ'),bu).toBe('');
 for(const bu of ['LBRC','XECA','BU Khác']) expect(stored(bu,'ghi chú'),bu).toBe('ghi chú');
});

test('the shared label rule matches the SQL twin work_import_is_ibs_text on empty and odd labels',async()=>{
 const {ibs}=await rule();
 expect([ibs(''),ibs(null),ibs(undefined),ibs('LBRC'),ibs('IBS.HI')]).toEqual([false,false,false,false,true]);
});

test('the portfolio page says why the IBS HI group shows no source note, and says nothing elsewhere',async()=>{
 const {notice}=await rule();
 expect(notice('IBS HI')).toBe('Dòng IBS HI không hiện ghi chú nguồn; xem bảng nguồn.');
 expect(notice('LBRC')).toBe('');
});
