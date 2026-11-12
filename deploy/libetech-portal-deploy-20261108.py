"""Bounded portal rollout. No DB restore, gateway restart or existing bot changes."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import yaml

BASE = Path('/home/iptech/.local/share/libetech-ai-os')
ROOT = Path('/home/iptech/.hermes')
STAGE = Path('/home/iptech/libetech-ai-os-stage-20261108')
RECEIPT = STAGE/'portal-rollout-20261108'
PLUGIN = 'libetech-ai-os-web'
COMMIT = '57ca1e8ae40771df77316b3da60d27ce2212cad4'
DIGEST = 'dcc6d1247dfb0677a8271268340d2a9a0576afaec8e899ff1fd9a1bec70f8c68'
os.umask(0o077)
assert socket.gethostname() == 'd1-ai1' and os.getuid() == 1000

def run(args):
    return subprocess.check_output(args, text=True).strip()
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def gateway():
    state = json.loads((ROOT/'gateway_state.json').read_text())
    os.kill(state['pid'],0)
    return {'pid':state['pid'], 'state':state['gateway_state'], 'updatedAt':state['updated_at'],
            'telegram':{k:v['state'] for k,v in state['platforms'].items() if k.endswith('telegram')}}
def protected_files():
    paths = list((ROOT/'profiles').glob('*/config.yaml'))
    for plugin in ['libetech-priority1','libetech-ai-os-bridge']:
        paths.extend(p for p in (ROOT/'profiles/libetech/plugins'/plugin).rglob('*')
                     if p.is_file() and '.git' not in p.parts and '__pycache__' not in p.parts and p.suffix != '.pyc')
    paths += [BASE/'state/bridge.json', ROOT/'profiles/libetech/runtime/libetech-ai-os/bridge.json']
    return {str(p):sha(p) for p in paths}
def request(path, body=None, origin=None):
    headers = {'Host':'hermes.btnet.vn'}
    if origin: headers['Origin'] = origin
    if body is not None: headers['Content-Type'] = 'application/json'
    req=urllib.request.Request('http://127.0.0.1:3148'+path, data=body, headers=headers)
    try:
        with urllib.request.urlopen(req,timeout=8) as r: return r.status,json.load(r)
    except urllib.error.HTTPError as e:
        return e.code,json.load(e)
def write_new(name, data):
    with (RECEIPT/name).open('x') as f: json.dump(data,f,indent=2)
def counts():
    env = os.environ.copy()
    env['LD_LIBRARY_PATH']=str(BASE/'pgroot/usr/lib/x86_64-linux-gnu')
    args=[str(BASE/'pgroot/usr/lib/postgresql/16/bin/psql'),'-X','-h',str(BASE/'socket'),'-p','5547','-U','iptech','-d','libetech_ai_os','-Atc',
          "SELECT json_build_object('users',(SELECT count(*) FROM identity.users),'telegramLinks',(SELECT count(*) FROM identity.telegram_links),'workItems',(SELECT count(*) FROM work_items),'reconciliations',(SELECT count(*) FROM analytics.reconciliations))"]
    return json.loads(subprocess.check_output(args,env=env,text=True))

if sys.argv[1:] == ['prepare']:
    status,data=request('/api/health')
    assert status==200 and data['data']['buildDigest']==DIGEST
    assert run(['systemctl','--user','is-active','libetech-ai-os.service'])=='active'
    assert not (ROOT/'plugins'/PLUGIN).exists()
    assert sha(STAGE/'libetech-portal-git-20261108.tar.gz')=='d7ac605aabd86f28a504ba7c5bc9b2e4234fd4063a5c9508bb821a7f32beed46'
    RECEIPT.mkdir(mode=0o700)
    shutil.copy2(ROOT/'config.yaml', RECEIPT/'config-before.yaml')
    shutil.copy2(BASE/'config/web.env', RECEIPT/'web-before.env')
    for p in [RECEIPT/'config-before.yaml', RECEIPT/'web-before.env']: p.chmod(0o600)
    write_new('before.json',{'gateway':gateway(),'protectedHashes':protected_files(),'counts':counts(),'webEnvHash':sha(BASE/'config/web.env')})
    print('PORTAL_PREPARED: protected backups and baseline recorded; no runtime change')
elif sys.argv[1:] == ['finish']:
    before=json.loads((RECEIPT/'before.json').read_text())
    assert not (RECEIPT/'after.json').exists()
    target=ROOT/'plugins'/PLUGIN
    assert run(['git','-C',str(target),'rev-parse','HEAD'])==COMMIT
    assert not run(['git','-C',str(target),'status','--porcelain','--untracked-files=no'])
    old=yaml.safe_load((RECEIPT/'config-before.yaml').read_text())
    new=yaml.safe_load((ROOT/'config.yaml').read_text())
    enabled=new.get('plugins',{}).get('enabled',[])
    assert PLUGIN in enabled
    new['plugins']['enabled']=[x for x in enabled if x!=PLUGIN]
    assert old==new, 'Unexpected default-profile configuration change; stop for reconciliation'
    assert before['protectedHashes']==protected_files(), 'Preserved files drifted; stop, do not overwrite'
    assert before['gateway']['pid']==gateway()['pid']
    envfile=BASE/'config/web.env'
    assert sha(envfile)==before['webEnvHash'], 'Web environment drifted; stop, do not overwrite'
    original=envfile.read_text()
    lines=original.splitlines()
    assert sum(x.startswith('LIBETECH_ORIGIN=') for x in lines)==1
    assert sum(x.startswith('LIBETECH_LOCAL_AUTH=') for x in lines)==1
    updated='\n'.join('LIBETECH_ORIGIN=https://hermes.btnet.vn' if x.startswith('LIBETECH_ORIGIN=') else
                      'LIBETECH_LOCAL_AUTH=0' if x.startswith('LIBETECH_LOCAL_AUTH=') else x for x in lines)+'\n'
    envfile.write_text(updated); envfile.chmod(0o600)
    try:
        subprocess.run(['systemctl','--user','restart','libetech-ai-os.service'],check=True)
        for attempt in range(15):
            try:
                status,health=request('/api/health')
                if status==200: break
            except OSError: pass
            time.sleep(1)
        assert status==200 and health['data']['buildDigest']==DIGEST
        checks={}
        for name,path,body,origin,expected in [
            ('anonymousIdentity','/api/auth/me',None,None,401),
            ('anonymousWorkspace','/api/v1/workspace',None,None,401),
            ('correctOriginStillNeedsLogin','/api/auth/telegram-code',b'{}','https://hermes.btnet.vn',401),
            ('wrongOriginDenied','/api/auth/telegram-code',b'{}','https://other.example',403),
            ('unsignedBridgeDenied','/api/bridge',b'{}',None,401)]:
            code,data=request(path,body,origin)
            assert code==expected,(name,code)
            checks[name]={'status':code,'error':data.get('error',{}).get('code')}
        current=gateway()
        assert current['pid']==before['gateway']['pid']
        assert before['protectedHashes']==protected_files()
        after_counts=counts()
        assert after_counts==before['counts']
        report={'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'portalCommit':COMMIT,
                'origin':'https://hermes.btnet.vn','localAuth':False,'backendHealth':health['data'],
                'httpChecks':checks,'gateway':current,'gatewayRestarted':False,'protectedFilesUnchanged':True,
                'defaultConfigOnlyAddedPortal':True,'beforeCounts':before['counts'],'afterCounts':after_counts,
                'webLoginVerified':False,'telegramPairVerified':False,'liveGroupTestsVerified':False}
        write_new('after.json',report)
        print(json.dumps({'portal':'0.1.0 installed','httpChecks':len(checks),'counts':after_counts,'protectedFilesUnchanged':True,
                          'gatewayPid':current['pid'],'telegramConnected':sum(v=='connected' for v in current['telegram'].values()),
                          'telegramTotal':len(current['telegram']),'webLoginVerified':False}))
    except Exception:
        envfile.write_text(original); envfile.chmod(0o600)
        subprocess.run(['systemctl','--user','restart','libetech-ai-os.service'],check=True)
        print('WEB_ORIGIN_ROLLED_BACK; no database or gateway changes')
        raise
else:
    raise SystemExit('Use prepare or finish')
