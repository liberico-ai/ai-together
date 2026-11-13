import {afterEach,beforeEach,describe,expect,test} from 'vitest';
import {ZodError} from 'zod';
import {openHarness,type Harness} from './slice1-db';
import {pm,seedSlice1} from './slice1-fixtures';
import {ids} from '../src/server/identities';
import {DocumentService} from '../src/server/documents';
import {SOURCE_HOSTS,sourceHostProblem} from '../src/server/source-hosts';
import type {SourceType} from '../src/server/types';

/** OQ-25 (a), Chairman 13/11/2026: «(a) Allowlist cố định». */
describe('source host allowlist (unit)',()=>{
  test('the list is exactly the option (a) list and cannot be changed at runtime',()=>{
    expect(SOURCE_HOSTS).toEqual({drive:['docs.google.com','drive.google.com'],git:['github.com'],vault:[]});
    expect(()=>{(SOURCE_HOSTS.git as string[]).push('evil.test');}).toThrow();
    expect(()=>{(SOURCE_HOSTS as Record<string,readonly string[]>).vault=['evil.test'];}).toThrow();
  });
  test('allowed hosts pass, including a normalised upper-case host and the explicit default port',()=>{
    for(const [t,u] of [['drive','https://docs.google.com/document/d/abc/edit'],['drive','https://drive.google.com/file/d/x/view'],
      ['git','https://github.com/liberico-ai/ai-together'],['git','https://GitHub.com/liberico-ai/ai-together'],['git','https://github.com:443/a/b']] as [SourceType,string][])
      expect(sourceHostProblem(t,u),u).toBeNull();
  });
  test('other hosts, subdomains, look-alikes, cross-type hosts and non-default ports are refused',()=>{
    const drive=['https://example.com/x','https://google.com/x','https://evil.docs.google.com/x','https://docs.google.com.evil.test/x',
      'https://docs.google.com./x','https://github.com/a/b','https://docs.google.com:8443/x'];
    const git=['https://gist.github.com/x','https://raw.githubusercontent.com/a/b','https://github.com.evil.test/a','https://www.github.com/a',
      'https://gіthub.com/a','https://docs.google.com/document/d/abc','https://github.com:8443/a'];
    for(const u of drive) expect(sourceHostProblem('drive',u),u).toMatch(/docs\.google\.com/);
    for(const u of git) expect(sourceHostProblem('git',u),u).toMatch(/github\.com/);
  });
  test('vault never accepts an https link, and an unknown type is refused',()=>{
    for(const u of ['https://docs.google.com/x','https://github.com/a/b','https://vault.example/x']) expect(sourceHostProblem('vault',u),u).toMatch(/Vault/);
    for(const t of ['other','constructor','__proto__','toString']) expect(sourceHostProblem(t as SourceType,'https://github.com/a/b'),t).not.toBeNull();
  });
  test('an unparsable value is refused, not thrown',()=>{
    for(const v of ['not a url','',undefined as unknown as string]) expect(sourceHostProblem('git',v)).not.toBeNull();
  });
});

let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);});
afterEach(async()=>{await h.reset();await h.close();});

const svc=()=>new DocumentService(h.db);
const base=(over:Record<string,unknown>={})=>({projectId:ids.sales,refCode:'',docType:'design',title:'Tài liệu kiểm host nguồn',sourceType:'drive',
  canonicalUri:'https://docs.google.com/document/d/host-1/edit',ownerLabel:'',reviewDueAt:null,metadata:{missingFields:[]},sourceLinks:[],...over});
const revBody=(over:Record<string,unknown>={})=>({expectedVersion:1,basedOnRevisionId:null,sourceRevision:null,sourceHash:null,sourceModifiedAt:null,
  changes:{summary:'Tóm tắt thay đổi tổng hợp',present:['Mục A'],missing:[]},sourceRefs:[],...over});
const key=(()=>{let n=0;return ()=>'host-key-'+String(++n).padStart(6,'0');})();
const count=async(t:string)=>(await h.operator.query<{n:number}>(`SELECT count(*)::int n FROM ${t}`)).rows[0].n;

describe('source host allowlist (service)',()=>{
  test('registration refuses a host outside the list for its source type and writes nothing',async()=>{
    for(const [t,u] of [['drive','https://example.com/docs/x'],['drive','https://github.com/a/b'],['git','https://docs.google.com/document/d/x'],
      ['git','https://gitlab.com/a/b'],['vault','https://docs.google.com/document/d/x']] as [SourceType,string][]){
      const e=await svc().register(pm,base({sourceType:t,canonicalUri:u}),key()).catch(x=>x);
      expect(e,t+' '+u).toBeInstanceOf(ZodError);
      expect((e as ZodError).issues.map(i=>i.message).join(' '),u).toMatch(t==='vault'?/Vault/:t==='git'?/github\.com/:/docs\.google\.com/);
    }
    expect(await count('document_records')).toBe(0);
    expect(await count('document_commands')).toBe(0);
  });
  test('registration accepts Drive and GitHub links and openSource returns their host',async()=>{
    const d=await svc().register(pm,base(),key());
    expect(await svc().openSource(pm,d.record.id)).toMatchObject({host:'docs.google.com',sourceType:'drive'});
    const g=await svc().register(pm,base({sourceType:'git',canonicalUri:'https://github.com/liberico-ai/ai-together/blob/x/README.md'}),key());
    expect(await svc().openSource(pm,g.record.id)).toMatchObject({host:'github.com',sourceType:'git'});
  });
  test('openSource re-checks the host on every open and does not echo the stored link',async()=>{
    const d=await svc().register(pm,base(),key());
    for(const [col,val] of [['canonical_uri','https://phish.example/login'],['canonical_uri','https://docs.google.com:8443/document/d/host-1'],['source_type','vault'],['source_type','git']]){
      await h.operator.query('UPDATE document_records SET canonical_uri=$1, source_type=$2 WHERE id=$3',
        [col==='canonical_uri'?val:'https://docs.google.com/document/d/host-1/edit',col==='source_type'?val:'drive',d.record.id]);
      const e=await svc().openSource(pm,d.record.id).catch(x=>x);
      expect(e,col+'='+val).toMatchObject({code:'SOURCE_UNAVAILABLE',status:409});
      expect(JSON.stringify(e),val).not.toContain('phish.example');
      expect(JSON.stringify(e),val).not.toContain('host-1');
    }
  });
  test('url source refs on a revision are text references and are not limited by the allowlist',async()=>{
    const d=await svc().register(pm,base(),key());
    const r=await svc().proposeRevision(pm,d.record.id,revBody({sourceRefs:[{kind:'url',label:'Đặc tả',value:'https://example.com/spec'}]}),key());
    expect(r.revisions[0].source_refs[0].value).toBe('https://example.com/spec');
  });
});
