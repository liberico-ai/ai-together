import {readFile,readdir,stat,writeFile,rm,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {expect,test} from 'vitest';

// Next renders a route file without 'use client' as a Server Component. React refuses a function prop on a Client
// Component there ("Event handlers cannot be passed to Client Component props"): the route answers 500 while build,
// typecheck and markup tests (renderToStaticMarkup, outside the RSC boundary) all pass. This scan reads the source the
// way that boundary does: for every server file under src/app, every JSX element of a component imported from a
// 'use client' module, and every attribute of it whose value is a function (inline, or a function of the same file).
const root=process.cwd();
const walk=async(d:string):Promise<string[]>=>(await Promise.all((await readdir(d)).map(async f=>{
  const p=path.join(d,f);return (await stat(p)).isDirectory()?walk(p):[p];}))).flat();
const isClient=(src:string)=>/^\s*(?:\/\/[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(src);
const isFile=async(p:string)=>stat(p).then(s=>s.isFile(),()=>false);
async function resolveImport(from:string,spec:string):Promise<string|null> {
  const base=spec.startsWith('@/')?path.join(root,'src',spec.slice(2)):spec.startsWith('.')||path.isAbsolute(spec)?path.resolve(path.dirname(from),spec):null;
  if(!base) return null;
  for(const ext of ['','.tsx','.ts','/index.tsx','/index.ts']) if(await isFile(base+ext)) return base+ext;
  return null;
}
/** Attributes of a JSX opening tag starting at `at` (just after the tag name), up to the closing '>' at brace depth 0. */
function tagAttributes(src:string,at:number):string {
  let depth=0,i=at;
  for(;i<src.length;i++){
    const ch=src[i];
    if(ch==='{') depth++;
    else if(ch==='}') depth--;
    else if(ch==='>'&&depth===0) break;
  }
  return src.slice(at,i);
}
async function functionPropsToClientComponents(file:string,label=path.relative(root,file)):Promise<string[]> {
  const src=await readFile(file,'utf8');
  if(isClient(src)) return [];
  const clientNames=new Set<string>();
  for(const m of src.matchAll(/import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*['"]([^'"]+)['"]/g)){
    const target=await resolveImport(file,m[3]);
    if(!target||!isClient(await readFile(target,'utf8'))) continue;
    if(m[1]) clientNames.add(m[1]);
    for(const part of (m[2]??'').split(',')){
      const name=part.trim().split(/\s+as\s+/).pop()?.trim();
      if(name&&!/^type\s/.test(part.trim())) clientNames.add(name);
    }
  }
  const localFunctions=new Set([...src.matchAll(/function\s+(\w+)\s*\(/g)].map(m=>m[1]).concat(
    [...src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^()]*\)|\w+)\s*=>/g)].map(m=>m[1])));
  const found:string[]=[];
  for(const name of clientNames){
    for(const m of src.matchAll(new RegExp(`<${name}\\b`,'g'))){
      const attrs=tagAttributes(src,m.index+m[0].length);
      for(const a of attrs.matchAll(/(\w+)=\{\s*((?:async\s+)?(?:function\b|\([^()]*\)\s*=>|\w+\s*=>)|\w+\s*\})/g)){
        const value=a[2].replace(/\s*\}$/,'');
        if(/=>|^(?:async\s+)?function\b/.test(value)||localFunctions.has(value)) found.push(`${label}: <${name} ${a[1]}=…>`);
      }
    }
  }
  return found;
}

test('I-1 no server file under src/app passes a function prop to a Client Component',async()=>{
  const files=(await walk(path.join(root,'src/app'))).filter(f=>f.endsWith('.tsx'));
  expect(files.some(f=>f.endsWith(path.join('inbox','loading.tsx')))).toBe(true);
  expect((await Promise.all(files.map(f=>functionPropsToClientComponents(f)))).flat()).toEqual([]);
});

test('the scan flags an inline handler and a local function on a client component, and ignores client files',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'rsc-scan-'));
  const sample=path.join(dir,'sample.tsx');
  const inbox=path.join(root,'src/components/inbox');
  try {
    await writeFile(sample,`import { InboxBody } from '${inbox}';\nconst go = async () => {};\n`
      +`export default function X(){return <><InboxBody state="loading" onCommand={async () => {}} /><InboxBody onRetry={go} items={[]} /></>;}\n`);
    expect(await functionPropsToClientComponents(sample,'sample')).toEqual(['sample: <InboxBody onCommand=…>','sample: <InboxBody onRetry=…>']);
    await writeFile(sample,`'use client';\nimport { InboxBody } from '${inbox}';\nexport default function X(){return <InboxBody onCommand={async () => {}} />;}\n`);
    expect(await functionPropsToClientComponents(sample,'sample')).toEqual([]);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
