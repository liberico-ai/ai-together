import {expect,test} from 'vitest';
import * as ui from '../src/components/work-import';
import {labelProblem,ownerProjects} from '../src/components/work-import';
import type {ImportPreview} from '../src/server/sheet-import';

// Pure helpers of the import screen (no rendering): which BU labels get no project selector, and which projects an owner choice may name.
test('(20) a blank or over-100-character BU label has no selector, only its reason',()=>{
  expect(labelProblem('')).toMatch(/trống/);
  expect(labelProblem('   ')).toMatch(/trống/);
  expect(labelProblem('x'.repeat(101))).toMatch(/100/);
  expect(labelProblem('x'.repeat(100))).toBe('');
  expect(labelProblem('LBRC')).toBe('');
});
test('(20) an owner may be confirmed only for the target project of the label of that owner\'s own rows',()=>{
  const row=(buLabel:string,owner:string)=>({row:2,stt:'1',buLabel,title:'x',code:null,owner,collaborators:'',status:'',due:'',result:'valid' as const,reasons:[],flags:[]});
  const pre={rows:[row('LBRC','Người A'),row('XECA','Người B'),row('XECA','Người A')]} as unknown as ImportPreview;
  expect(ownerProjects(pre,{LBRC:'p-lbrc',XECA:'p-xeca'},'Người A').sort()).toEqual(['p-lbrc','p-xeca']);
  expect(ownerProjects(pre,{LBRC:'p-lbrc',XECA:'p-xeca'},'Người B')).toEqual(['p-xeca']);
  // an unselected label has no target: nothing to confirm
  expect(ownerProjects(pre,{LBRC:'p-lbrc'},'Người B')).toEqual([]);
});

// Codex round 1 (25/11/2026): the screen sends the name of the chosen file with the file (OQ-62 câu 6), so a batch written on the web carries it.
// A name the server would refuse (a path, a control character, over 255) is cleaned here rather than sent as is; a name with nothing left is left out.
test('M8 câu 6: the request body of the import screen carries the bare name of the chosen file',()=>{
  type Envelope=(name:string,bytes:Uint8Array,sourceUrl:string,sheet:string)=>Record<string,unknown>;
  const importEnvelope=(ui as Record<string,unknown>).importEnvelope as Envelope|undefined;
  expect(typeof importEnvelope).toBe('function');
  const bytes=new TextEncoder().encode('STT,BU\n1,LBRC\n');
  const url='https://docs.google.com/spreadsheets/d/thu';
  expect(importEnvelope!('Đầu việc Tech - 25-11.csv',bytes,url,'Đầu việc Tech'))
    .toEqual({fileBase64:Buffer.from(bytes).toString('base64'),sourceUrl:url,sheet:'Đầu việc Tech',fileName:'Đầu việc Tech - 25-11.csv'});
  expect(importEnvelope!('a/b\\c\u0007.csv',bytes,url,'s').fileName).toBe('abc.csv');
  const long=String(importEnvelope!('ệ'.repeat(300)+'.csv',bytes,url,'s').fileName);
  expect(long.length).toBeLessThanOrEqual(255);expect(long.length).toBeGreaterThan(0);
  expect(importEnvelope!('  ',bytes,url,'s')).not.toHaveProperty('fileName');
});
