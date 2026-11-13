"""Initial credentials for the isolated server. Never print credentials or accept them in argv.

`--preflight` only validates the server-side pilot chat file against the live home_channel;
install-d1.sh runs it before creating anything, so a missing or wrong file stops the install early.
"""
import importlib.util
import json
import os
from pathlib import Path
import pwd
import secrets
import subprocess
import sys

assert os.geteuid() == 0 and os.uname().nodename == 'd1-ai1'
state=Path('/var/lib/libetech-ai-os'); config=Path('/etc/libetech-ai-os')
scope=json.loads((Path(__file__).parent/'pilot-scope.json').read_text())
# Group IDs come from the server-side file, validated by the same loader as the user installer.
spec=importlib.util.spec_from_file_location('user_installer',Path(__file__).parent/'install-user.py')
installer=importlib.util.module_from_spec(spec);spec.loader.exec_module(installer)
internal_chat,denied_chats=installer.load_pilot_chats(os.environ.get(installer.PILOT_CHATS_SETTING))
installer.check_recipient((internal_chat,denied_chats))
if sys.argv[1:]==['--preflight']:
    print(json.dumps({'pilotChats':'valid','recipientMatchesHomeChannel':True}));raise SystemExit(0)
assert state.is_dir() and config.is_dir() and not (config/'web.env').exists()
web,auth,key=(secrets.token_urlsafe(32) for _ in range(3))
sql=f"ALTER ROLE libetech_web PASSWORD '{web}';\nALTER ROLE libetech_auth PASSWORD '{auth}';\n"
result=subprocess.run(['runuser','-u','postgres','--','psql','-X','-q','-v','ON_ERROR_STOP=1','-p','5547','-d','libetech_ai_os'],input=sql,text=True,capture_output=True)
if result.returncode: raise RuntimeError('Credential provisioning failed; no secret output retained.')
def save(path,data,owner=None):
    fd=os.open(path,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    with os.fdopen(fd,'w') as f:f.write(data)
    if owner:
        user=pwd.getpwnam(owner);os.chown(path,user.pw_uid,user.pw_gid)
save(state/'bridge.json',json.dumps({'key':key,'chatScopes':{internal_chat:[scope['projectId']],**{chat:[] for chat in denied_chats}}}),'libetech-os')
plugin_state=Path('/home/iptech/.hermes/profiles/libetech/runtime/libetech-ai-os')
plugin_state.mkdir(mode=0o700,exist_ok=False)
user=pwd.getpwnam('iptech');os.chown(plugin_state,user.pw_uid,user.pw_gid)
save(plugin_state/'bridge.json',json.dumps({'key':key}),'iptech')
values={'LIBETECH_DEMO':'0','DATABASE_URL':f'postgresql://libetech_web:{web}@127.0.0.1:5547/libetech_ai_os','IDENTITY_DATABASE_URL':f'postgresql://libetech_auth:{auth}@127.0.0.1:5547/libetech_ai_os','LIBETECH_TENANT_ID':'b63f99bf-3a85-4a1f-b74a-66b5793871ef','LIBETECH_ORIGIN':'http://127.0.0.1:3150','LIBETECH_LOCAL_AUTH':'1','LIBETECH_BRIDGE_CONFIG':str(state/'bridge.json'),'NODE_ENV':'production','LIBETECH_BUILD_DIGEST':json.loads(Path('/opt/libetech-ai-os/app/deploy/BUNDLE-MANIFEST.json').read_text())['treeSha256']}
save(config/'web.env',''.join(f'{k}={v}\n' for k,v in values.items()))
print(json.dumps({'credentials':'written-to-protected-files','webOrigin':'http://127.0.0.1:3150','databasePort':5547,'bridge':'internal LBRC pilot only; Xeca denied'}))
