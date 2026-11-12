"""Read-only deployment readback; never sends Telegram messages or changes gateway state."""
import datetime,hashlib,json,os,socket,subprocess,time
from pathlib import Path
import yaml
STAGE=Path('/home/iptech/libetech-ai-os-stage-20261108')
PROFILE=Path('/home/iptech/.hermes/profiles/libetech')
EXPECTED={'__init__.py':'a706a3a9bdd83270c9d0f89f28f521d24294306b72f35d892f3abc1243321756','core.py':'ea1982d36876a0cd82d1ffe61175fae6a82b44476d572a5f98d9891513f73e65','plugin.yaml':'b63fdd69ddaa5f51b551235517ec66e5bce206baa6da1f303b00d6285476205d','registry.json':'0161a700981fab986bcccec989c80d569c62546c132d9b3d3f8d60fbf1b14dc7'}
assert socket.gethostname()=='d1-ai1' and os.getuid()==1000
os.umask(0o077)
priority={name:hashlib.sha256((PROFILE/'plugins/libetech-priority1'/name).read_bytes()).hexdigest() for name in EXPECTED}
target=PROFILE/'plugins/libetech-ai-os-bridge'
manifest=yaml.safe_load((target/'plugin.yaml').read_text())
sha=subprocess.check_output(['git','-C',str(target),'rev-parse','HEAD'],text=True).strip()
hashes={name:hashlib.sha256((target/name).read_bytes()).hexdigest() for name in ('__init__.py','plugin.yaml')}
before=yaml.safe_load((STAGE/'config-before-git-bridge.yaml').read_text());after=yaml.safe_load((PROFILE/'config.yaml').read_text())
was=before.get('plugins',{}).get('enabled',[]);now=after.get('plugins',{}).get('enabled',[])
after['plugins']['enabled']=[name for name in now if name!='libetech-ai-os-bridge']
equivalent=before==after
state=json.loads(Path('/home/iptech/.hermes/gateway_state.json').read_text())
os.kill(state['pid'],0)
age=(datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(state['updated_at'])).total_seconds()
connections={key:entry['state'] for key,entry in state['platforms'].items() if key.endswith('telegram')}
back=json.loads(Path('/home/iptech/.local/share/libetech-ai-os/state/bridge.json').read_text())
adapter=json.loads((PROFILE/'runtime/libetech-ai-os/bridge.json').read_text())
key_match=back['key']==adapter['key']
assert manifest['version']=='0.2.1' and sha=='73687919346aad9f6064094455047462513aceec'
assert hashes=={'__init__.py':'7fc13eecdf2dcb0f4aaf36dd7efcf576da816427e329f3c59fc1030a0fd7bf2c','plugin.yaml':'969ef1b11930c57d646a12e4cee7c54d34bfb2b1a295d5b7b91389f62cf99c59'}
assert key_match and 'libetech-ai-os-bridge' in now
report={'observedAt':time.time(),'host':socket.gethostname(),'bridge':{'version':manifest['version'],'commit':sha,'hashes':hashes,'enabled':True,'keyMatchesBackend':key_match},'priority1':{'hashes':priority,'matchesPriorReceipt':priority==EXPECTED},'configPreservedExceptNewEnabledPlugin':equivalent,'gateway':{'pid':state['pid'],'state':state['gateway_state'],'updatedAt':state['updated_at'],'snapshotAgeSeconds':age,'telegram':connections},'gatewayRestarted':False,'telegramMessageVerified':False}
with (STAGE/'postinstall-readback.json').open('x') as out:json.dump(report,out,indent=2)
print(json.dumps({'bridge':'0.2.1 enabled; hashes match','priority1Unchanged':priority==EXPECTED,'configPreserved':equivalent,'telegramConnected':sum(v=='connected' for v in connections.values()),'telegramTotal':len(connections),'snapshotAgeSeconds':round(age,1),'gatewayPid':state['pid']}))
