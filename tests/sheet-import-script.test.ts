import {expect,test} from 'vitest';
import {execFile} from 'node:child_process';
import {mkdtemp,readFile,stat,writeFile,access} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {promisify} from 'node:util';

// scripts/sheet-import-dry-run.ts: in-memory only. Fake CSV, outputs in a fresh temp directory.
const run=promisify(execFile);
const tsx=path.join(process.cwd(),'node_modules/.bin/tsx');
const script=path.join(process.cwd(),'scripts/sheet-import-dry-run.ts');
const CSV='STT,BU,Đầu việc,Người phụ trách,Phối hợp,Trạng thái,Hạn,Ghi chú\n1,LBRC,Việc giả một TEST7001,Người A,,Đang làm,25/11/2026,ghi-chú-giả\n2,XECA,Việc giả hai TEST7002,,,Chưa làm,,\n3,IBS HI,Việc giả ba TEST7003,Người C,,Hoàn thành,05/11/2026,ghi-chú-ibs-giả\n4,ZZZ,Việc nhãn lạ,Người E,,Tạm dừng,2026-12-01,\n5,IBS HI - Tekla,Việc nhãn IBS có đuôi,Người F,,Đang làm,25/11/2026,ghi-chú-tekla-giả\n';
const url='https://docs.google.com/spreadsheets/d/TESTSHEETKEY0001/edit?gid=1';

test('(19) the dry run refuses outputs inside the repository and writes nothing there',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'gv5c-script-'));
  const file=path.join(dir,'fake.csv');await writeFile(file,CSV);
  const inside=path.join(process.cwd(),'docs','dry-run-should-not-exist.json');
  for(const [detail,receipt] of [[inside,path.join(dir,'r.json')],[path.join(dir,'d.json'),inside]]){
    await expect(run(tsx,[script,'--file',file,'--source-url',url,'--detail',detail,'--receipt',receipt],{cwd:process.cwd()})).rejects.toMatchObject({code:1});
  }
  await expect(access(inside)).rejects.toBeTruthy();
});

test('(1)(19) the dry run: counts per BU label only (no reporting-domain counts, no row count on stdout), reasons per label, second run writes nothing, files are 0600',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'gv5c-script-'));
  const file=path.join(dir,'fake.csv');await writeFile(file,CSV);
  const detail=path.join(dir,'detail.json'),receipt=path.join(dir,'receipt.json');
  const out=await run(tsx,[script,'--file',file,'--source-url',url,'--detail',detail,'--receipt',receipt],{cwd:process.cwd()});
  expect(JSON.parse(out.stdout.trim().split('\n').pop()!)).toEqual({ok:true,groups:5});
  const r=JSON.parse(await readFile(receipt,'utf8'));
  expect(Object.keys(r)).not.toContain('countsByReportingDomain');
  expect(r.countsByBuLabel.map((g:{label:string})=>g.label)).toEqual(['LBRC','XECA','IBS HI','ZZZ','IBS HI - Tekla']);
  expect(r.reasonsByBuLabel.ZZZ).toEqual({UNMAPPED_BU:1});
  expect(Object.values(r.secondRunNewRequestsByBuLabel).every(n=>n===0)).toBe(true);
  expect(JSON.stringify(r)).not.toMatch(/ghi-chú|Việc giả/);
  const d=JSON.parse(await readFile(detail,'utf8'));
  expect(JSON.stringify(d)).not.toMatch(/ghi-chú/);
  // redaction follows the service's own flag: an IBS HI label, a label that only contains «ibs», and a row with no target project carry no title, owner or collaborators
  for(const label of ['IBS HI','IBS HI - Tekla','ZZZ']){
    const row=d.rows.find((x:{buLabel:string})=>x.buLabel===label);
    expect(row,label).not.toHaveProperty('title');expect(row,label).not.toHaveProperty('owner');expect(row,label).not.toHaveProperty('collaborators');
  }
  expect(d.rows.find((x:{buLabel:string})=>x.buLabel==='LBRC')).toHaveProperty('title');
  for(const f of [detail,receipt]) expect((await stat(f)).mode&0o777).toBe(0o600);
},120000);
