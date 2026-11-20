"""Initial LibeTech pilot installation as iptech; no sudo and no shared gateway restart.

Run only from a verified source bundle on d1-ai1. Installs official Ubuntu package
contents inside a new, private directory. It never invokes dpkg/apt install or
package maintainer scripts and never changes another PostgreSQL instance.
"""
from __future__ import annotations
import argparse,hashlib,hmac,json,os,platform,re,secrets,shutil,socket,stat,subprocess,time
from pathlib import Path

_RESTORE_PLAN=None
def load_restore_plan(manifest=None):
    """The one rule for what an archive is and how it is loaded (deploy/restore-plan.py, N4 of DELIVERY-016); the shell installer and the rehearsal use the same file. It is read ONCE and
    run from the bytes that were read; given the manifest of the verified bundle it must be the file that the manifest lists (it runs only after verify_bundle has passed: see inspect)."""
    global _RESTORE_PLAN
    import types
    path=Path(__file__).with_name('restore-plan.py');data=path.read_bytes()
    if manifest is not None:
        expected=manifest['files'].get('deploy/restore-plan.py')
        if not expected or hashlib.sha256(data).hexdigest()!=expected:raise RuntimeError('deploy/restore-plan.py is not the file that the bundle manifest lists')
    module=types.ModuleType('restore_plan');module.__file__=str(path)
    exec(compile(data,str(path),'exec'),module.__dict__)
    _RESTORE_PLAN=module
    return module

def restore_plan_module():
    return _RESTORE_PLAN or load_restore_plan()

def __getattr__(name):
    # restore_plan and validate_data_only_listing are looked up when something asks for them, not when this file is imported
    if name=='restore_plan':return restore_plan_module()
    if name=='validate_data_only_listing':return restore_plan_module().validate_data_only_listing
    raise AttributeError(name)

SCOPE=json.loads((Path(__file__).parent/'pilot-scope.json').read_text())
TENANT=SCOPE['tenantId']
PROJECT=SCOPE['projectId']
# Telegram group IDs are not kept in the repository (audit 2026-11-12, option c).
PILOT_CHATS_SETTING='LIBETECH_PILOT_CHATS'
# Same shape the bridge accepts for chatScopes keys (src/app/api/bridge/route.ts): no leading zero.
GROUP_CHAT_ID=re.compile(r'-[1-9][0-9]{4,19}')
BASE=Path('/home/iptech/.local/share/libetech-ai-os')
PROFILE=Path('/home/iptech/.hermes/profiles/libetech')
NODE_SOURCE=Path('/home/iptech/.hermes/tools/node-26.12.1-linux-x64')
UNIT_NAMES=('libetech-os-postgres.service','libetech-ai-os.service')

def load_pilot_chats(location):
    """Read the approved and denied group IDs from the server-side file; stop on anything unexpected."""
    if not location:raise RuntimeError(PILOT_CHATS_SETTING+' must name the server-side pilot chat file')
    path=Path(location)
    if path.is_symlink() or not path.is_file():raise RuntimeError('Pilot chat setting must name a regular file')
    if stat.S_IMODE(path.stat().st_mode)&0o077:raise RuntimeError('Pilot chat file must have permission 0600')
    try:data=json.loads(path.read_text())
    except ValueError as exc:raise RuntimeError('Invalid pilot chat file: not JSON') from exc
    if not isinstance(data,dict):raise RuntimeError('Invalid pilot chat file: expected an object')
    internal,denied=data.get('internalChatId'),data.get('deniedChatIds')
    if not isinstance(internal,str) or not GROUP_CHAT_ID.fullmatch(internal):raise RuntimeError('Invalid pilot chat file: internalChatId')
    if not isinstance(denied,list) or not all(isinstance(c,str) and GROUP_CHAT_ID.fullmatch(c) for c in denied):raise RuntimeError('Invalid pilot chat file: deniedChatIds')
    if internal in denied:raise RuntimeError('Invalid pilot chat file: the approved group is also denied')
    return internal,denied

def chat_scopes(chats):
    internal,denied=chats
    return {internal:[PROJECT],**{chat:[] for chat in denied}}

def check_recipient(chats,profile:Path=PROFILE):
    """The approved group must equal the live Hermes home_channel before any grant is written."""
    import yaml
    try:
        live=yaml.safe_load((profile/'config.yaml').read_text())
        channel=str(live['platforms']['telegram']['home_channel']['chat_id'])
    except (OSError,yaml.YAMLError,KeyError,TypeError):
        # Parser errors quote the offending line, which holds the chat ID; drop the cause on purpose.
        raise RuntimeError('Cannot read home_channel from the Hermes profile config; inspect it on the server') from None
    if channel!=chats[0]:raise RuntimeError('LibeAI recipient drift; reconcile before installing')

def exclusive(path:Path,value:str):
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as out:out.write(value)

def clean_env():
    allowed=('HOME','USER','LOGNAME','LANG','LC_ALL','XDG_RUNTIME_DIR','DBUS_SESSION_BUS_ADDRESS')
    env={k:os.environ[k] for k in allowed if k in os.environ}
    env['PATH']='/usr/bin:/bin';env['NEXT_TELEMETRY_DISABLED']='1'
    return env

def run(args,*,env=None,cwd=None,stdin=None,quiet=False):
    result=subprocess.run([str(a) for a in args],env=env or clean_env(),cwd=cwd,input=stdin,text=True,capture_output=quiet,check=False)
    if result.returncode:
        # SQL can include generated credentials; never include stdin or captured stderr.
        raise RuntimeError(f'{Path(str(args[0])).name} failed with exit {result.returncode}')
    return result.stdout if quiet else None

def verify_bundle(bundle:Path):
    manifest=json.loads((bundle/'deploy/BUNDLE-MANIFEST.json').read_text())
    hashes=manifest['files']
    computed=hashlib.sha256(json.dumps(hashes,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    if computed!=manifest['treeSha256']:raise RuntimeError('Manifest tree digest mismatch')
    for name,expected in hashes.items():
        path=bundle/name
        if path.is_symlink() or not path.resolve().is_relative_to(bundle.resolve()) or not path.is_file():raise RuntimeError('Invalid bundle path')
        if hashlib.sha256(path.read_bytes()).hexdigest()!=expected:raise RuntimeError('Bundle content mismatch: '+name)
    return manifest

def inspect(bundle:Path,dump:Path,chats):
    if socket.gethostname()!='d1-ai1' or os.getuid()!=1000 or platform.machine()!='x86_64':raise RuntimeError('Expected iptech on d1-ai1 x86_64')
    if not dump.is_file() or dump.is_symlink():raise RuntimeError('Pilot archive must be a regular file')
    if stat.S_IMODE(dump.stat().st_mode)&0o077:raise RuntimeError('Pilot archive must have permission 0600')
    forbidden=[BASE,PROFILE/'plugins/libetech-ai-os-bridge',PROFILE/'runtime/libetech-ai-os']
    forbidden += [Path('/home/iptech/.config/systemd/user')/n for n in UNIT_NAMES]
    if any(p.exists() or p.is_symlink() for p in forbidden):raise RuntimeError('Target already exists; inspect it, do not overwrite or force')
    if not (NODE_SOURCE/'bin/node').is_file():raise RuntimeError('Verified Node distribution missing')
    for port in (3148,5547):
        with socket.socket() as s:s.bind(('127.0.0.1',port))
    if shutil.disk_usage(BASE.parent).free<4*1024**3:raise RuntimeError('Less than 4 GiB free')
    if run(['loginctl','show-user','iptech','-p','Linger','--value'],quiet=True).strip()!='yes':raise RuntimeError('User service persistence unavailable')
    if run(['systemctl','--user','is-system-running'],quiet=True).strip()!='running':raise RuntimeError('User service manager unavailable')
    check_recipient(chats)
    manifest=verify_bundle(bundle);require_restore_files(manifest,bundle);load_restore_plan(manifest)
    return manifest

def main():
    parser=argparse.ArgumentParser();parser.add_argument('archive',type=Path);parser.add_argument('--inspect-only',action='store_true');parser.add_argument('--resume-empty-db',action='store_true');args=parser.parse_args()
    bundle=Path(__file__).resolve().parents[1];dump=args.archive.resolve()
    chats=load_pilot_chats(os.environ.get(PILOT_CHATS_SETTING))
    expected=expected_archive_hash()  # N4: stop before anything is created when the hash recorded at dump time is missing
    if args.resume_empty_db:resume_empty_database(bundle,dump,chats,expected);return
    manifest=inspect(bundle,dump,chats)
    if archive_digest(dump)!=expected:raise RuntimeError('The archive does not match '+ARCHIVE_SHA_SETTING+'; nothing was created')
    if args.inspect_only:
        print(json.dumps({'preflight':'pass','sourceDigest':manifest['treeSha256'],'mode':'iptech-user-services','sudoRequired':False}));return
    os.umask(0o077);BASE.mkdir(mode=0o700)
    for d in ('config','logs','packages','pgroot','pgdata','socket','state'): (BASE/d).mkdir(mode=0o700)
    dump=hold_archive(dump,expected)
    exclusive(BASE/'installation.json',json.dumps({'sourceDigest':manifest['treeSha256'],'archiveHash':expected,'mode':'user-services','startedAt':time.time(),'sharedGatewayRestarted':False}))
    shutil.copytree(bundle,BASE/'app',symlinks=False)
    shutil.copytree(NODE_SOURCE,BASE/'node',symlinks=True)
    print('Downloading verified Ubuntu package contents into private directory.',flush=True)
    run(['apt-get','download','postgresql-16','postgresql-client-16','libpq5','libicu74','libldap2'],cwd=BASE/'packages')
    packages={}
    for package in sorted((BASE/'packages').glob('*.deb')):
        packages[package.name]=hashlib.sha256(package.read_bytes()).hexdigest()
        run(['dpkg-deb','--extract',package,BASE/'pgroot'])
    exclusive(BASE/'package-hashes.json',json.dumps(packages,indent=2))
    pgbin=BASE/'pgroot/usr/lib/postgresql/16/bin';pgenv=clean_env()
    pgenv['LD_LIBRARY_PATH']=str(BASE/'pgroot/usr/lib/x86_64-linux-gnu')
    for binary in ('postgres','initdb','psql','pg_restore'):
        linked=run(['ldd',pgbin/binary],env=pgenv,quiet=True)
        if 'not found' in linked:raise RuntimeError('PostgreSQL shared library missing; inspect ldd before continuing')
        run([pgbin/binary,'--version'],env=pgenv)
    run([pgbin/'initdb','-D',BASE/'pgdata','-U','iptech','--auth-local=peer','--auth-host=scram-sha-256','--encoding=UTF8','--locale=C.UTF-8','--data-checksums','-L',BASE/'pgroot/usr/share/postgresql/16'],env=pgenv)
    with (BASE/'pgdata/postgresql.conf').open('a') as f:
        f.write(f"\nlisten_addresses = '127.0.0.1'\nport = 5547\nunix_socket_directories = '{BASE}/socket'\npassword_encryption = 'scram-sha-256'\nshared_buffers = '128MB'\nmax_connections = 30\njit = off\n")
    units=Path('/home/iptech/.config/systemd/user');units.mkdir(parents=True,exist_ok=True)
    pgunit=f'''[Unit]\nDescription=LibeTech AI OS private PostgreSQL 16\n[Service]\nType=simple\nEnvironment=LD_LIBRARY_PATH={pgenv['LD_LIBRARY_PATH']}\nExecStart={pgbin}/postgres -D {BASE}/pgdata\nRestart=on-failure\nRestartSec=5\nTimeoutStopSec=90\nKillSignal=SIGINT\nNoNewPrivileges=true\nUMask=0077\nMemoryMax=1G\n[Install]\nWantedBy=default.target\n'''
    exclusive(units/UNIT_NAMES[0],pgunit)
    run(['systemctl','--user','daemon-reload']);run(['systemctl','--user','enable','--now',UNIT_NAMES[0]])
    for attempt in range(30):
        ready=subprocess.run([str(pgbin/'pg_isready'),'-h',str(BASE/'socket'),'-p','5547'],env=pgenv,capture_output=True)
        if ready.returncode==0:break
        time.sleep(1)
    else:raise RuntimeError('New PostgreSQL service did not become ready')
    sql=[pgbin/'psql','-X','-q','-v','ON_ERROR_STOP=1','-h',BASE/'socket','-p','5547','-U','iptech']
    run(sql+['-d','postgres'],env=pgenv,stdin='CREATE DATABASE libetech_ai_os;\n',quiet=True)
    for migration in sorted((BASE/'app/migrations').glob('*.sql')):
        run(sql+['-d','libetech_ai_os'],env=pgenv,stdin=migration.read_text(),quiet=True)
    finish_install(manifest,dump,chats)


def pg_environment():
    env=clean_env();env['LD_LIBRARY_PATH']=str(BASE/'pgroot/usr/lib/x86_64-linux-gnu')
    return env

ARCHIVE_SHA_SETTING='LIBETECH_ARCHIVE_SHA256'
RESTORE_FILES=('deploy/pre-restore.sql','deploy/post-restore.sql','deploy/restore-plan.py','migrations/023_thread_order.sql')

def expected_archive_hash():
    """The SHA-256 that was recorded when the archive was made, from the operator (an environment variable, like LIBETECH_PILOT_CHATS), never from beside the archive:
    a file that has been changed can be given the hash of the change. It is integrity, not identity. The value is never printed."""
    value=os.environ.get(ARCHIVE_SHA_SETTING,'').strip().lower()
    if not re.fullmatch(r'[0-9a-f]{64}',value):raise RuntimeError(ARCHIVE_SHA_SETTING+' must be the SHA-256 (64 hex digits) recorded when the archive was made')
    return value

def archive_digest(path:Path)->str:
    digest=hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda:source.read(1<<20),b''):digest.update(chunk)
    return digest.hexdigest()

def hold_archive(dump:Path,expected:str)->Path:
    """The original is read to be hashed and copied (main() has hashed it once, before anything is created; this reads it again, hashing the bytes that it keeps); every later step (listing, classification, load) reads the copy.
    The original lies where the account that the gateway shares can write it, and the load runs with the rights of a superuser. In this mode the copy is owned by that same account
    (the shell installer's is root's): it fixes what was hashed, not who can change it afterwards. A copy that does not match is removed; one that matched is removed when the restore passed."""
    held=BASE/'state/archive.dump'
    digest=hashlib.sha256()
    with dump.open('rb') as source:
        out=os.fdopen(os.open(held,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'wb')
        try:
            with out:
                for chunk in iter(lambda:source.read(1<<20),b''):
                    digest.update(chunk);out.write(chunk)
        except BaseException:
            held.unlink(missing_ok=True);raise
    if not hmac.compare_digest(digest.hexdigest(),expected):
        held.unlink(missing_ok=True)
        raise RuntimeError('The archive does not match '+ARCHIVE_SHA_SETTING+'; it was not loaded')
    return held

def require_restore_files(manifest,bundle:Path|None=None):
    """verify_bundle checks the files that the manifest lists and no others: a file that runs with the rights of a superuser must be one of them (a release packaged since N4 lists them),
    and with the bundle given, the migrations that will be applied are exactly the listed ones."""
    for name in RESTORE_FILES:
        if name not in manifest['files']:raise RuntimeError('Bundle manifest does not list '+name+'; package the release again')
    if bundle is not None:
        listed={n for n in manifest['files'] if re.fullmatch(r'migrations/[^/]+\.sql',n)}  # the migrations that are applied: the files of that directory, not of migrations/rollback
        present={'migrations/'+p.name for p in (bundle/'migrations').glob('*.sql')}
        if present!=listed:raise RuntimeError('The migrations of the bundle are not the ones that the manifest lists; package the release again')

POST_RESTORE_CODE=re.compile(r'POST-RESTORE-[0-9]{2}')

def run_post_restore(sql,env,text):
    """deploy/post-restore.sql, run as the installing superuser. Passed only when psql exits 0 AND its last line is the JSON answer {"post_restore": "pass", ...}.
    Of what psql says, only the codes POST-RESTORE-nn are shown: a PostgreSQL message can quote a row, and this log is read in a public repository."""
    result=subprocess.run([str(a) for a in [*sql,'-v','VERBOSITY=terse','-v','SHOW_CONTEXT=never','-At','-d','libetech_ai_os']],env=env,input=text,text=True,capture_output=True,check=False)
    answer=None
    lines=result.stdout.strip().splitlines()
    if lines:
        try:answer=json.loads(lines[-1])
        except ValueError:answer=None
    if result.returncode or not isinstance(answer,dict) or answer.get('post_restore')!='pass':
        codes=sorted(set(POST_RESTORE_CODE.findall(result.stderr)))
        raise RuntimeError('Post-restore check failed'+(' ('+', '.join(codes)+'; see docs/RUNBOOK-RESTORE-AFTER-023.md)' if codes else '; no code was reported: inspect the new database, not this log'))
    return answer

PRE_RESTORE_CODE=re.compile(r'PRE-RESTORE-[0-9]{2}')

def run_pre_restore(sql,env,text):
    """deploy/pre-restore.sql: the target holds no rows. Only its codes are shown, as for run_post_restore."""
    result=subprocess.run([str(a) for a in [*sql,'-v','VERBOSITY=terse','-v','SHOW_CONTEXT=never','-d','libetech_ai_os']],env=env,input=text,text=True,capture_output=True,check=False)
    if result.returncode:
        codes=sorted(set(PRE_RESTORE_CODE.findall(result.stderr)))
        raise RuntimeError('Pre-restore check failed'+(' ('+', '.join(codes)+'; see docs/RUNBOOK-RESTORE-AFTER-023.md)' if codes else '; no code was reported: inspect the new database, not this log'))

def restore_data(pgbin,pgenv,dump,sql):
    """N4 of DELIVERY-016. Classify the archive and check that it covers the tables of the target (a refused one loads nothing), check that the target holds no rows, load the archive with
    the arguments of deploy/restore-plan.py (one transaction, triggers off), number it again by applying migration 023 once more when it comes from before 023 (and carries no position that
    such a numbering would unsay), and run the check that ends every restore. All of it before a password is made or a service started. Returns the answer of the check."""
    plan=restore_plan_module()
    psql=lambda query:run(sql+['-At','-d','libetech_ai_os','-c',query],env=pgenv,quiet=True)
    listing=run([pgbin/'pg_restore','--list',dump],env=pgenv,quiet=True)
    kind=plan.classify_archive(listing,psql(plan.TABLES_SQL).split())
    run_pre_restore(sql,pgenv,(BASE/'app/deploy/pre-restore.sql').read_text())
    run([pgbin/'pg_restore',*plan.PG_RESTORE_ARGS,'-h',BASE/'socket','-p','5547','-U','iptech','-d','libetech_ai_os',dump],env=pgenv,quiet=True)
    if plan.numbers_after_load(kind):
        if psql(plan.PRE_023_POSITIONS_SQL).strip()!='0':
            raise RuntimeError('The archive was classified as from before 023 and yet carries thread positions, or they could not be counted: its number tables were cut out at dump time, and applying 023 again would unsay them. Do not go on with this archive')
        try:run(sql+['-d','libetech_ai_os'],env=pgenv,stdin=(BASE/'app/migrations/023_thread_order.sql').read_text(),quiet=True)
        except RuntimeError as exc:
            raise RuntimeError('Applying migration 023 again after the load stopped ('+str(exc)+'); 023 refuses some archives (a draft of an intake candidate that nobody decided, a connected AI login, more than 250000 revisions without a number) and can stop for other reasons; see docs/RUNBOOK-RESTORE-AFTER-023.md and OQ-59') from None
    answer=run_post_restore(sql,pgenv,(BASE/'app/deploy/post-restore.sql').read_text())
    if answer.get('thread_order')!='checked':raise RuntimeError('The post-restore check ran without the checks of migration 023')
    return answer

def finish_install(manifest,dump,chats):
    units=Path('/home/iptech/.config/systemd/user')
    pgbin=BASE/'pgroot/usr/lib/postgresql/16/bin';pgenv=pg_environment()
    sql=[pgbin/'psql','-X','-q','-v','ON_ERROR_STOP=1','-h',BASE/'socket','-p','5547','-U','iptech']
    restored=restore_data(pgbin,pgenv,dump,sql)
    dump.unlink()  # the second copy of the pilot data is not kept after a restore that passed
    web,auth,key=(secrets.token_urlsafe(32) for _ in range(3))
    run(sql+['-d','libetech_ai_os'],env=pgenv,stdin=f"ALTER ROLE libetech_web PASSWORD '{web}';\nALTER ROLE libetech_auth PASSWORD '{auth}';\n",quiet=True)
    exclusive(BASE/'state/bridge.json',json.dumps({'key':key,'chatScopes':chat_scopes(chats)}))
    values={'LIBETECH_DEMO':'0','DATABASE_URL':f'postgresql://libetech_web:{web}@127.0.0.1:5547/libetech_ai_os','IDENTITY_DATABASE_URL':f'postgresql://libetech_auth:{auth}@127.0.0.1:5547/libetech_ai_os','LIBETECH_TENANT_ID':TENANT,'LIBETECH_ORIGIN':'http://127.0.0.1:3150','LIBETECH_LOCAL_AUTH':'1','LIBETECH_BRIDGE_CONFIG':str(BASE/'state/bridge.json'),'NODE_ENV':'production','NEXT_TELEMETRY_DISABLED':'1','LIBETECH_BUILD_DIGEST':manifest['treeSha256']}
    exclusive(BASE/'config/web.env',''.join(f'{k}={v}\n' for k,v in values.items()))
    nodeenv=clean_env();nodeenv['PATH']=str(BASE/'node/bin')+':/usr/bin:/bin'
    print('Building the verified AI OS source.',flush=True)
    run([BASE/'node/bin/npm','ci','--ignore-scripts'],env=nodeenv,cwd=BASE/'app')
    run([BASE/'node/bin/npm','run','build'],env=nodeenv,cwd=BASE/'app')
    webunit=f'''[Unit]\nDescription=LibeTech AI OS private backend 0.2.0\nRequires={UNIT_NAMES[0]}\nAfter={UNIT_NAMES[0]}\n[Service]\nType=simple\nWorkingDirectory={BASE}/app\nEnvironmentFile={BASE}/config/web.env\nExecStart={BASE}/node/bin/node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3148\nRestart=on-failure\nRestartSec=5\nNoNewPrivileges=true\nUMask=0077\nMemoryMax=1G\n[Install]\nWantedBy=default.target\n'''
    exclusive(units/UNIT_NAMES[1],webunit)
    run(['systemctl','--user','daemon-reload']);run(['systemctl','--user','enable','--now',UNIT_NAMES[1]])
    health=None
    for attempt in range(30):
        response=subprocess.run(['curl','--fail','--silent','--max-time','3','http://127.0.0.1:3148/api/health'],env=clean_env(),capture_output=True,text=True)
        if response.returncode==0:
            health=json.loads(response.stdout)['data']
            if health.get('status')=='ready':break
        time.sleep(1)
    else:raise RuntimeError('AI OS readiness failed; inspect only the new service logs')
    if health.get('buildDigest')!=manifest['treeSha256']:raise RuntimeError('Runtime source digest mismatch')
    plugin_state=PROFILE/'runtime/libetech-ai-os';plugin_state.mkdir(mode=0o700)
    exclusive(plugin_state/'bridge.json',json.dumps({'key':key}))
    receipt={'installedAt':time.time(),'host':socket.gethostname(),'mode':'iptech-user-services','health':health,'chatScopes':chat_scopes(chats),'gatewayRestarted':False,'restore':restored,'botPluginInstalled':False,'telegramVerified':False,'linuxUserIsolation':'shared-iptech; database roles remain separated'}
    exclusive(BASE/'runtime-receipt.json',json.dumps(receipt,indent=2));print(json.dumps({'status':'ready','version':'0.2.0','sourceDigest':manifest['treeSha256'],'botPluginInstalled':False}))

def resume_empty_database(bundle,dump,chats,expected):
    # Narrow recovery for the observed first attempt. Never a force reinstall.
    import re
    if socket.gethostname()!='d1-ai1' or os.getuid()!=1000:raise RuntimeError('Wrong recovery host or principal')
    check_recipient(chats)
    if not dump.is_file() or dump.is_symlink() or stat.S_IMODE(dump.stat().st_mode)&0o077:raise RuntimeError('Expected protected regular data archive')
    prior=json.loads((BASE/'installation.json').read_text())
    if prior['sourceDigest']!='2a5bd497e07ca89dd12b5fe63e04d4974927ac43bacf5a39a93ff57ad94fac51':raise RuntimeError('Recovery is only for the recorded first attempt')
    old=verify_bundle(BASE/'app');new=verify_bundle(bundle)
    if old['treeSha256']!=prior['sourceDigest']:raise RuntimeError('Installed source disagrees with receipt')
    protected=lambda files:{name:sha for name,sha in files.items() if not name.startswith(('deploy/','docs/','tests/'))}
    if protected(old['files'])!=protected(new['files']):raise RuntimeError('Recovery must preserve application, migration and bot source bytes')
    forbidden=[BASE/'config/web.env',BASE/'state/bridge.json',BASE/'runtime-receipt.json',PROFILE/'runtime/libetech-ai-os',PROFILE/'plugins/libetech-ai-os-bridge',Path('/home/iptech/.config/systemd/user/libetech-ai-os.service'),BASE/'app-before-data-restore-fix']
    if any(p.exists() or p.is_symlink() for p in forbidden):raise RuntimeError('Later installation state exists; stop recovery')
    pgbin=BASE/'pgroot/usr/lib/postgresql/16/bin';env=pg_environment()
    sql=[pgbin/'psql','-X','-q','-v','ON_ERROR_STOP=1','-h',BASE/'socket','-p','5547','-U','iptech','-d','libetech_ai_os','-Atc']
    if run(sql+["SELECT string_agg(version,',' ORDER BY version) FROM schema_migrations"],env=env,quiet=True).strip()!='001,002,003':raise RuntimeError('Unexpected target schema')
    tables=run(sql+["SELECT schemaname||'.'||tablename FROM pg_tables WHERE schemaname IN ('public','identity','analytics') AND tablename<>'schema_migrations'"],env=env,quiet=True).splitlines()
    for table in tables:
        if not re.fullmatch(r'[a-z_]+\.[a-z_]+',table):raise RuntimeError('Unexpected relation name')
        if run(sql+['SELECT count(*) FROM '+table],env=env,quiet=True).strip()!='0':raise RuntimeError('Target contains data; recovery will not overwrite it')
    dump=hold_archive(dump,expected)  # N4: read once; the listing, the load and the receipt all rest on this copy
    validate_data_only_listing(run([pgbin/'pg_restore','--list',dump],env=env,quiet=True))
    (BASE/'app').rename(BASE/'app-before-data-restore-fix')
    shutil.copytree(bundle,BASE/'app',symlinks=False)
    load_restore_plan(new)
    exclusive(BASE/'recovery.json',json.dumps({'previousSourceDigest':old['treeSha256'],'newSourceDigest':new['treeSha256'],'allTargetDataTablesEmpty':True,'preservedPreviousSource':True,'archiveHash':expected}))
    finish_install(new,dump,chats)

if __name__=='__main__':
    try:main()
    except Exception as exc:
        print(json.dumps({'status':'stopped','reason':str(exc),'rollback':'Preserve partial files and data. Stop only new LibeTech services after inspecting their state. Do not delete or rerun with force.'}),flush=True)
        raise SystemExit(1)
