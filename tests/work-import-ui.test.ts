import {expect,test} from 'vitest';
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
