import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chmod,mkdir,mkdtemp,readdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Client} from 'pg';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {assertIsolated,native} from './slice1-db';

// V1 preflight end-to-end against real PostgreSQL 16 (native PostgreSQL only).
// Uses either local `psql` on PATH or a tiny wrapper invoking `docker exec -i <SLICE1_PG_CONTAINER> psql`
// (same convention as tests/restore-rehearsal.test.ts).
const CONTAINER=process.env.SLICE1_PG_CONTAINER;
const PREFLIGHT=path.join(process.cwd(),'deploy/preflight.py');

type Run={code:number;stdout:string;stderr:string};

function exec(cmd:string,args:string[],env:Record<string,string>):Promise<Run>{
  return new Promise(resolve=>execFile(cmd,args,{encoding:'utf8',timeout:30000,env:env as NodeJS.ProcessEnv},
    (error,stdout,stderr)=>resolve({code:error?(typeof error.code==='number'?error.code:1):0,stdout,stderr})));
}

async function resolvePsqlBin(workDir:string,pgUser:string):Promise<string|null>{
  const check=await exec('which',['psql'],{PATH:process.env.PATH??'/usr/bin:/bin'});
  if(check.code===0&&check.stdout.trim()) return check.stdout.trim();
  if(!CONTAINER) return null;
  const shim=path.join(workDir,'docker-psql');
  const script=`#!/usr/bin/env bash
set -euo pipefail
args=(-i)
for k in PGDATABASE PGOPTIONS PGUSER PGPASSWORD PGCONNECT_TIMEOUT; do
  if [[ -n "\${!k:-}" ]]; then args+=(-e "\$k=\${!k}"); fi
done
# Connect via local socket inside container as the superuser that owns test DBs
exec docker exec "\${args[@]}" ${JSON.stringify(CONTAINER)} psql -U ${JSON.stringify(pgUser)} "$@"
`;
  await writeFile(shim,script,'utf8');
  await chmod(shim,0o700);
  return shim;
}

async function buildBundleFromRepoMigrations(root:string,maxVersion='003'):Promise<{version:string;treeSha256:string}>{
  const version='0.9.8';
  const pluginVersion='0.3.6';
  const files:Record<string,Buffer>={
    'package.json':Buffer.from(JSON.stringify({name:'libetech-ai-os',version})),
    'bot-plugin/plugin.yaml':Buffer.from(`name: libetech-ai-os-bridge\nversion: "${pluginVersion}"\nprovides_tools:\n  - libetech_os_read\n`),
    'bot-plugin/__init__.py':Buffer.from(`VERSION = "${pluginVersion}"\n`),
    'deploy/libetech-ai-os.service':Buffer.from('[Unit]\nDescription=Test\n[Service]\nUser=libetech-os\nGroup=libetech-os\nExecStart=/bin/true\n'),
    'deploy/pre-restore.sql':Buffer.from('-- pre\n'),
    'deploy/post-restore.sql':Buffer.from('-- post\n'),
    'deploy/restore-plan.py':Buffer.from('# plan\n'),
    'deploy/preflight.py':await readFile(PREFLIGHT),
  };
  const migDir=path.join(process.cwd(),'migrations');
  const rbDir=path.join(migDir,'rollback');
  for(const name of (await readdir(migDir)).filter(f=>/^\d+.*\.sql$/.test(f)).sort()){
    if(name.slice(0,3)>maxVersion) continue;
    files[`migrations/${name}`]=await readFile(path.join(migDir,name));
    if(Number(name.slice(0,3))>=13){
      files[`migrations/rollback/${name}`]=await readFile(path.join(rbDir,name));
    }
  }
  const hashes:Record<string,string>={};
  for(const rel of Object.keys(files).sort()){
    const target=path.join(root,rel);
    await mkdir(path.dirname(target),{recursive:true});
    await writeFile(target,files[rel]);
    hashes[rel]=createHash('sha256').update(files[rel]).digest('hex');
  }
  const canonical='{'+Object.keys(hashes).sort().map(k=>`${JSON.stringify(k)}:${JSON.stringify(hashes[k])}`).join(',')+'}';
  const treeSha256=createHash('sha256').update(canonical).digest('hex');
  await writeFile(
    path.join(root,'deploy/BUNDLE-MANIFEST.json'),
    JSON.stringify({version,createdAt:'2026-11-28T00:00:00Z',kind:'source-tree-digest-not-git-commit',treeSha256,files:hashes},null,2)+'\n',
  );
  return {version,treeSha256};
}

describe.skipIf(!native)('V1 deploy/preflight.py against PostgreSQL 16',()=>{
  let admin:Client,baseUrl:URL,workDir:string,psqlBin:string|null=null,serial=0;
  const databases:string[]=[];

  beforeAll(async()=>{
    const raw=process.env.SLICE1_TEST_DATABASE_URL!;
    assertIsolated(raw);
    baseUrl=new URL(raw);
    admin=new Client({connectionString:raw});
    await admin.connect();
    workDir=await mkdtemp(path.join(tmpdir(),'preflight-pg16-'));
    psqlBin=await resolvePsqlBin(workDir,decodeURIComponent(baseUrl.username||'postgres'));
  });

  afterAll(async()=>{
    if(workDir) await rm(workDir,{recursive:true,force:true});
    for(const name of databases) await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin?.end();
  },180000);

  async function createDb(appliedVersions:string[]):Promise<{name:string;url:string}>{
    const name=`slice1_verify_${Date.now()}${String(++serial).padStart(2,'0')}`;
    const u=new URL(baseUrl.toString());
    u.pathname='/'+name;
    assertIsolated(u.toString());
    await admin.query(`CREATE DATABASE "${name}"`);
    databases.push(name);
    if(appliedVersions.length>0){
      const c=new Client({connectionString:u.toString()});
      await c.connect();
      try{
        await c.query('CREATE TABLE public.schema_migrations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), version text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())');
        for(const v of appliedVersions) await c.query('INSERT INTO public.schema_migrations(version) VALUES ($1)',[v]);
      } finally {await c.end();}
    }
    return {name,url:u.toString()};
  }

  it('duplicate plugin is RED and moving it outside scan dir turns GREEN against real PG16 ledger',async()=>{
    expect(psqlBin,'psql or SLICE1_PG_CONTAINER is required on PG16').toBeTruthy();
    const applied31=Array.from({length:31},(_,i)=>String(i+1).padStart(3,'0'));
    const db=await createDb(applied31);
    const caseDir=await mkdtemp(path.join(workDir,'case-'));
    const bundleDir=path.join(caseDir,'bundle');
    const scanDir=path.join(caseDir,'hermes/profiles/libetech/plugins');
    const backupDir=path.join(caseDir,'backups');
    const sysUnits=path.join(caseDir,'etc/systemd/system');
    const usrUnits=path.join(caseDir,'home/iptech/.config/systemd/user');
    await Promise.all([bundleDir,scanDir,backupDir,sysUnits,usrUnits].map(d=>mkdir(d,{recursive:true})));

    const {version,treeSha256}=await buildBundleFromRepoMigrations(bundleDir,'032');
    const relEnv=path.join(caseDir,'release.env');
    await writeFile(relEnv,`LIBETECH_BUILD_DIGEST=${treeSha256}\nLIBETECH_RELEASE_VERSION=${version}\nLIBETECH_PLUGIN_VERSION=0.3.6\n`,{mode:0o600});
    await writeFile(path.join(usrUnits,'libetech-ai-os.service'),'[Service]\nExecStart=/bin/true\n');

    await mkdir(path.join(scanDir,'libetech-ai-os-bridge'),{recursive:true});
    await writeFile(path.join(scanDir,'libetech-ai-os-bridge/plugin.yaml'),'name: libetech-ai-os-bridge\nversion: "0.3.6"\n');
    await writeFile(path.join(scanDir,'libetech-ai-os-bridge/__init__.py'),'VERSION = "0.3.6"\n');
    // Duplicate 0.3.2 backup copy inside scan dir
    const dup=path.join(scanDir,'libetech-ai-os-bridge.bak-0.3.2');
    await mkdir(dup,{recursive:true});
    await writeFile(path.join(dup,'plugin.yaml'),'name: libetech-ai-os-bridge\nversion: "0.3.2"\n');
    await writeFile(path.join(dup,'__init__.py'),'VERSION = "0.3.2"\n');

    const args=[
      '-I',PREFLIGHT,'--mode','upgrade','--bundle',bundleDir,
      '--plugin-scan-dir',scanDir,'--release-env',relEnv,'--backup-dir',backupDir,
      '--system-unit-dir',sysUnits,'--user-unit-dir',usrUnits,'--user-unit-owner','iptech','--expected-web-user','iptech',
      '--psql-bin',psqlBin!,'--expected-schema-max','031',
    ];
    const env={PATH:process.env.PATH??'/usr/bin:/bin',HOME:process.env.HOME??'/tmp',PREFLIGHT_DATABASE_URL:db.url};

    const red=await exec('python3',args,env);
    expect(red.code,red.stderr).toBe(1);
    const redJson=JSON.parse(red.stdout);
    expect(redJson.ok).toBe(false);
    expect(redJson.errors.map((e:{code:string})=>e.code)).toContain('PREFLIGHT-PLUGIN-DUPLICATE');
    expect(redJson.checks.plugins.duplicates[0].winner.version).toBe('0.3.2');

    // Move backup copy outside scan dir -> GREEN
    await rename(dup,path.join(backupDir,'libetech-ai-os-bridge.bak-0.3.2'));
    const green=await exec('python3',args,env);
    expect(green.code,green.stdout+green.stderr).toBe(0);
    const greenJson=JSON.parse(green.stdout);
    expect(greenJson.ok).toBe(true);
    expect(greenJson.checks.migration_ledger.applied).toEqual(applied31);
    expect(greenJson.checks.migration_ledger.pending).toEqual(['032']);
  });

  it('rejects real PG16 schema_migrations gap and unknown ahead version',async()=>{
    expect(psqlBin,'psql or SLICE1_PG_CONTAINER is required on PG16').toBeTruthy();
    const gapDb=await createDb(['001','003']);
    const aheadDb=await createDb(['001','002','003','099']);
    const caseDir=await mkdtemp(path.join(workDir,'ledger-'));
    const bundleDir=path.join(caseDir,'bundle');
    const scanDir=path.join(caseDir,'plugins');
    const backupDir=path.join(caseDir,'backups');
    const sysUnits=path.join(caseDir,'sys');
    const usrUnits=path.join(caseDir,'usr');
    await Promise.all([bundleDir,scanDir,backupDir,sysUnits,usrUnits].map(d=>mkdir(d,{recursive:true})));

    const {version,treeSha256}=await buildBundleFromRepoMigrations(bundleDir,'003');
    const relEnv=path.join(caseDir,'release.env');
    await writeFile(relEnv,`LIBETECH_BUILD_DIGEST=${treeSha256}\nLIBETECH_RELEASE_VERSION=${version}\n`,{mode:0o600});
    await writeFile(path.join(usrUnits,'libetech-ai-os.service'),'[Service]\nExecStart=/bin/true\n');

    const baseArgs=[
      '-I',PREFLIGHT,'--mode','upgrade','--bundle',bundleDir,
      '--plugin-scan-dir',scanDir,'--release-env',relEnv,'--backup-dir',backupDir,
      '--system-unit-dir',sysUnits,'--user-unit-dir',usrUnits,'--user-unit-owner','iptech','--expected-web-user','iptech',
      '--psql-bin',psqlBin!,
    ];
    const baseEnv={PATH:process.env.PATH??'/usr/bin:/bin',HOME:process.env.HOME??'/tmp'};

    const gapRes=await exec('python3',baseArgs,{...baseEnv,PREFLIGHT_DATABASE_URL:gapDb.url});
    expect(gapRes.code).toBe(1);
    expect(JSON.parse(gapRes.stdout).errors.map((e:{code:string})=>e.code)).toContain('PREFLIGHT-LEDGER-GAP');

    const aheadRes=await exec('python3',baseArgs,{...baseEnv,PREFLIGHT_DATABASE_URL:aheadDb.url});
    expect(aheadRes.code).toBe(1);
    expect(JSON.parse(aheadRes.stdout).errors.map((e:{code:string})=>e.code)).toContain('PREFLIGHT-LEDGER-UNKNOWN-APPLIED');
  });
});
