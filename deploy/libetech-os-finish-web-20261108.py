"""Finish only the observed post-build installation; never restore data or rotate secrets."""
import hashlib
import json
import os
from pathlib import Path
import socket
import stat
import subprocess
import time
import urllib.request

BASE=Path('/home/iptech/.local/share/libetech-ai-os')
PROFILE=Path('/home/iptech/.hermes/profiles/libetech')
DIGEST='dcc6d1247dfb0677a8271268340d2a9a0576afaec8e899ff1fd9a1bec70f8c68'
SHA='8d05141576bcd4db8e7ab9f1a6b7a0dd9bd360ab'
PROJECT='8f1b6aca-b20f-469a-a92b-cbde731581fc'

def require(condition, message):
    if not condition: raise RuntimeError(message)

def exclusive(path, value):
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as out: out.write(value)

def run(args, env=None):
    result=subprocess.run([str(x) for x in args],env=env,capture_output=True,text=True)
    require(result.returncode==0,Path(str(args[0])).name+' failed; inspect bounded service log')
    return result.stdout.strip()

def main():
    require(socket.gethostname()=='d1-ai1' and os.getuid()==1000,'Wrong host or user')
    os.umask(0o077)
    app=BASE/'app'
    manifest=json.loads((app/'deploy/BUNDLE-MANIFEST.json').read_text())
    require(manifest['treeSha256']==DIGEST,'Wrong source candidate')
    require(hashlib.sha256(json.dumps(manifest['files'],sort_keys=True,separators=(',',':')).encode()).hexdigest()==DIGEST,'Manifest invalid')
    for name,expected in manifest['files'].items():
        path=app/name
        require(path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(app.resolve()),'Invalid source path')
        require(hashlib.sha256(path.read_bytes()).hexdigest()==expected,'Source drift: '+name)
    require((app/'.next/BUILD_ID').is_file(),'Production build missing')
    for name in ('config/web.env','state/bridge.json'):
        path=BASE/name
        require(path.is_file() and not path.is_symlink() and stat.S_IMODE(path.stat().st_mode)==0o600,'Protected config unavailable')
    bridge=json.loads((BASE/'state/bridge.json').read_text())
    require(len(bridge.get('key',''))>=43,'Bridge secret missing')
    require(bridge['chatScopes']=={'-5298399184':[PROJECT],'-1002308580311':[]},'Chat scope drift')
    config=dict(line.split('=',1) for line in (BASE/'config/web.env').read_text().splitlines() if line)
    require(config.get('LIBETECH_BUILD_DIGEST')==DIGEST and config.get('LIBETECH_DEMO')=='0','Runtime config drift')
    env=dict(os.environ,LD_LIBRARY_PATH=str(BASE/'pgroot/usr/lib/x86_64-linux-gnu'))
    query="SELECT json_build_object('migrations',(SELECT count(*) FROM schema_migrations),'users',(SELECT count(*) FROM identity.users),'activated',(SELECT count(*) FROM identity.users WHERE password_hash IS NOT NULL),'projects',(SELECT count(*) FROM projects),'reconciliations',(SELECT count(*) FROM analytics.reconciliations),'workItems',(SELECT count(*) FROM work_items),'sourceSha',(SELECT source_sha FROM analytics.reconciliations WHERE code='LBRC014'))"
    psql=[BASE/'pgroot/usr/lib/postgresql/16/bin/psql','-X','-q','-v','ON_ERROR_STOP=1','-h',BASE/'socket','-p','5547','-U','iptech','-d','libetech_ai_os','-Atc']
    counts=json.loads(run(psql+[query],env))
    require(counts==dict(migrations=3,users=1,activated=1,projects=1,reconciliations=1,workItems=0,sourceSha=SHA),'Unexpected database state; no changes made')
    unit=Path('/home/iptech/.config/systemd/user/libetech-ai-os.service')
    state=PROFILE/'runtime/libetech-ai-os'
    for path in (unit,state,BASE/'runtime-receipt.json'):
        require(not path.exists() and not path.is_symlink(),'Target exists; reconcile before retry')
    with socket.socket() as listener: listener.bind(('127.0.0.1',3148))
    content=f'''[Unit]\nDescription=LibeTech AI OS private backend 0.2.0\nRequires=libetech-os-postgres.service\nAfter=libetech-os-postgres.service\n[Service]\nType=simple\nWorkingDirectory={BASE}/app\nEnvironmentFile={BASE}/config/web.env\nExecStart={BASE}/node/bin/node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3148\nRestart=on-failure\nRestartSec=5\nNoNewPrivileges=true\nUMask=0077\nMemoryMax=1G\n[Install]\nWantedBy=default.target\n'''
    exclusive(unit,content)
    run(['systemctl','--user','daemon-reload'])
    run(['systemctl','--user','enable','--now','libetech-ai-os.service'])
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    health=None
    for attempt in range(20):
        try:
            with opener.open('http://127.0.0.1:3148/api/health',timeout=2) as response:
                health=json.load(response)['data']
            if health.get('status')=='ready': break
        except (OSError,ValueError,KeyError): pass
        time.sleep(0.5)
    require(health is not None and health.get('status')=='ready','Service readiness failed')
    require(health['version']=='0.2.0' and health['buildDigest']==DIGEST and health['storage']=='postgresql-server' and not health['synthetic'],'Runtime identity mismatch')
    state.mkdir(mode=0o700)
    exclusive(state/'bridge.json',json.dumps({'key':bridge['key']}))
    receipt={'installedAt':time.time(),'host':socket.gethostname(),'mode':'iptech-user-services','health':health,'data':counts,'chatScopes':bridge['chatScopes'],'gatewayRestarted':False,'botPluginInstalled':False,'telegramVerified':False,'linuxUserIsolation':'shared-iptech; database roles remain separated','completion':'Narrow post-build resume; no data restore or credential rotation'}
    exclusive(BASE/'runtime-receipt.json',json.dumps(receipt,indent=2))
    print(json.dumps({'status':'ready','version':health['version'],'sourceDigest':DIGEST,'activatedUsers':counts['activated'],'LBRC014':SHA,'gatewayRestarted':False}),flush=True)

if __name__=='__main__':
    try: main()
    except Exception as error:
        print(json.dumps({'status':'stopped','reason':str(error),'retry':'Reconcile existing state; do not rerun blindly.'}),flush=True)
        raise SystemExit(1)
