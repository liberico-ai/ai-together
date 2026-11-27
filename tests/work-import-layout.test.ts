import {readFile} from 'node:fs/promises';
import {expect,it} from 'vitest';

// The preview and the receipt of «Nhập bảng việc» are sections of the shared .doc-card, which lays its children out in a row from 950 px up, and in one row without
// wrapping from 1200 px: on a wide screen their tables and the commit button left the card. They stack at every width. This reads the source only; where things really
// land was measured in a browser at 1440 and 390 px (docs/reviews/import-layout-split-evidence-20261127/).
const [css,screen]=await Promise.all([readFile('src/app/globals.css','utf8'),readFile('src/components/work-import.tsx','utf8')]);

/** The style sheet without its @media blocks: what applies at every width. */
function everyWidth(sheet:string){
  let out='',at=0;
  for(let start=sheet.indexOf('@media',at);start>=0;start=sheet.indexOf('@media',at)){
    out+=sheet.slice(at,start);
    let depth=0,i=sheet.indexOf('{',start);
    for(;i<sheet.length;i++){if(sheet[i]==='{') depth++;else if(sheet[i]==='}'&&--depth===0) break;}
    at=i+1;
  }
  return out+sheet.slice(at);
}
/** The declarations of the rule written with exactly this selector, outside every @media block. */
const declarations=(selector:string)=>everyWidth(css).split('}').map(part=>part.split('{')).find(([head])=>head.replace(/\/\*[\s\S]*?\*\//g,'').trim()===selector)?.[1]?.split(';')??[];

it('marks the preview and the receipt, and no other part of the screen, as stacked results',()=>{
  expect(screen.match(/<section className="doc-card work-import-result">/g)??[]).toHaveLength(2);
  expect(screen).not.toContain('<section className="doc-card">');
});

it('stacks a result at every width, with a two-class selector that beats the one-class .doc-card row rules of the wide screens, and keeps its button its own width',()=>{
  // the rows this has to beat are still there
  expect(css).toMatch(/@media\(min-width:950px\)\{\.doc-card\{flex-direction:row/);
  expect(declarations('.doc-card.work-import-result')).toEqual(expect.arrayContaining(['flex-direction:column','align-items:stretch','overflow-wrap:break-word']));
  // not «anywhere»: that also lets a table narrow its columns until single words break («LBRC» over three lines at 390 px)
  expect(declarations('.doc-card.work-import-result')).not.toContain('overflow-wrap:anywhere');
  expect(declarations('.work-import-result>.doc-action')).toEqual(['align-self:flex-start']);
});
