"""Initial LibeTech pilot installation as iptech; no sudo and no shared gateway restart.

Run only from a verified source bundle on d1-ai1. Installs official Ubuntu package
contents inside a new, private directory. It never invokes dpkg/apt install or
package maintainer scripts and never changes another PostgreSQL instance.
"""
from __future__ import annotations
import argparse,hashlib,json,os,platform,re,secrets,shutil,socket,stat,subprocess,time
from pathlib import Path

SCOPE=json.loads((Path(__file__).parent/'pilot-scope.json').read_text())
TENANT=SCOPE['tenantId']
PROJECT=SCOPE['projectId']
# Telegram group IDs are not kept in the repository (audit 2026-11-12, option c).
PILOT_CHATS_SETTING='LIBETECH_PILOT_CHATS'
GROUP_CHAT_ID=re.compile(r'-[0-9]{5,20}')
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
    live=yaml.safe_load((profile/'config.yaml').read_text())
    if str(live['platforms']['telegram']['home_channel']['chat_id'])!=chats[0]:raise RuntimeError('LibeAI recipient drift; reconcile before installing')

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
    return verify_bundle(bundle)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('archive',type=Path);parser.add_argument('--inspect-only',action='store_true');parser.add_argument('--resume-empty-db',action='store_true');args=parser.parse_args()
    bundle=Path(__file__).resolve().parents[1];dump=args.archive.resolve()
    chats=load_pilot_chats(os.environ.get(PILOT_CHATS_SETTING))
    if args.resume_empty_db:resume_empty_database(bundle,dump,chats);return
    manifest=inspect(bundle,dump,chats)
    if args.inspect_only:
        print(json.dumps({'preflight':'pass','sourceDigest':manifest['treeSha256'],'mode':'iptech-user-services','sudoRequired':False}));return
    os.umask(0o077);BASE.mkdir(mode=0o700)
    for d in ('config','logs','packages','pgroot','pgdata','socket','state'): (BASE/d).mkdir(mode=0o700)
    exclusive(BASE/'installation.json',json.dumps({'sourceDigest':manifest['treeSha256'],'archiveHash':hashlib.sha256(dump.read_bytes()).hexdigest(),'mode':'user-services','startedAt':time.time(),'sharedGatewayRestarted':False}))
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


def validate_data_only_listing(listing):
    import re
    for line in listing.splitlines():
        if not line or line.startswith(';'):continue
        match=re.match(r'^\d+;\s+\d+\s+\d+\s+(.*)$',line)
        if not match or not match.group(1).startswith(('TABLE DATA ','SEQUENCE SET ')):
            raise RuntimeError('Archive must be created with pg_dump --data-only; full dumps have unsafe data order for pre-existing foreign keys')
        if 'TABLE DATA public schema_migrations ' in line:raise RuntimeError('Archive must exclude schema_migrations data')

def pg_environment():
    env=clean_env();env['LD_LIBRARY_PATH']=str(BASE/'pgroot/usr/lib/x86_64-linux-gnu')
    return env

def finish_install(manifest,dump,chats):
    units=Path('/home/iptech/.config/systemd/user')
    pgbin=BASE/'pgroot/usr/lib/postgresql/16/bin';pgenv=pg_environment()
    sql=[pgbin/'psql','-X','-q','-v','ON_ERROR_STOP=1','-h',BASE/'socket','-p','5547','-U','iptech']
    listing=run([pgbin/'pg_restore','--list',dump],env=pgenv,quiet=True)
    validate_data_only_listing(listing)
    run([pgbin/'pg_restore','--exit-on-error','--single-transaction','--data-only','--no-owner','-h',BASE/'socket','-p','5547','-U','iptech','-d','libetech_ai_os',dump],env=pgenv,quiet=True)
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
    receipt={'installedAt':time.time(),'host':socket.gethostname(),'mode':'iptech-user-services','health':health,'chatScopes':chat_scopes(chats),'gatewayRestarted':False,'botPluginInstalled':False,'telegramVerified':False,'linuxUserIsolation':'shared-iptech; database roles remain separated'}
    exclusive(BASE/'runtime-receipt.json',json.dumps(receipt,indent=2));print(json.dumps({'status':'ready','version':'0.2.0','sourceDigest':manifest['treeSha256'],'botPluginInstalled':False}))

def resume_empty_database(bundle,dump,chats):
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
    validate_data_only_listing(run([pgbin/'pg_restore','--list',dump],env=env,quiet=True))
    (BASE/'app').rename(BASE/'app-before-data-restore-fix')
    shutil.copytree(bundle,BASE/'app',symlinks=False)
    exclusive(BASE/'recovery.json',json.dumps({'previousSourceDigest':old['treeSha256'],'newSourceDigest':new['treeSha256'],'allTargetDataTablesEmpty':True,'preservedPreviousSource':True,'archiveHash':hashlib.sha256(dump.read_bytes()).hexdigest()}))
    finish_install(new,dump,chats)

if __name__=='__main__':
    try:main()
    except Exception as exc:
        print(json.dumps({'status':'stopped','reason':str(exc),'rollback':'Preserve partial files and data. Stop only new LibeTech services after inspecting their state. Do not delete or rerun with force.'}),flush=True)
        raise SystemExit(1)
