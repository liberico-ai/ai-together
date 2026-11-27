import {execFile} from 'node:child_process';
import {mkdir,mkdtemp,realpath,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {promisify} from 'node:util';
import {afterAll,beforeAll,expect,it} from 'vitest';

// Agent worktrees live under .claude/worktrees/, each with its own copy of tests/. A run from the repository root must not collect them (it then runs every copy, against
// the same test database), and a run from inside such a worktree must still collect its own tests. The real CLI with the repository's config; `list` runs no test.
const execute=promisify(execFile);
const CLI=path.resolve('node_modules/vitest/vitest.mjs'),CONFIG=path.resolve('vitest.config.ts');

let tree='';
const nested=()=>path.join(tree,'.claude','worktrees','other');
beforeAll(async()=>{
  // the real path: on macOS the temporary directory is reached through a link, and vitest names files relative to where they really are
  tree=await realpath(await mkdtemp(path.join(tmpdir(),'test-scope-')));
  for(const [directory,name] of [[tree,'kept'],[nested(),'nested']]){
    await mkdir(path.join(directory,'tests'),{recursive:true});
    await writeFile(path.join(directory,'tests',name+'.test.ts'),"import {it} from 'vitest';\nit('is only listed',()=>{});\n");
  }
});
afterAll(async()=>{if(tree) await rm(tree,{recursive:true,force:true});});

async function collected(root:string){
  // the child starts as a fresh command, without the variables of the vitest run it is called from
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('VITEST'))) as NodeJS.ProcessEnv;
  const {stdout}=await execute(process.execPath,[CLI,'list','--filesOnly','--config',CONFIG,'--root',root],{cwd:root,env,encoding:'utf8',timeout:60000});
  return stdout.split('\n').filter(line=>line.endsWith('.test.ts')).sort();
}

it('does not collect the tests of a worktree nested under .claude/ when run from the repository root',async()=>{
  expect(await collected(tree)).toEqual(['tests/kept.test.ts']);
},90000);

it('still collects its own tests when run from inside such a worktree',async()=>{
  expect(await collected(nested())).toEqual(['tests/nested.test.ts']);
},90000);
