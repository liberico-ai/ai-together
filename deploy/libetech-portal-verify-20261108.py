"""Read only account/nonce metadata and bounded gateway delivery logs. No messages."""
import datetime,hashlib,json,os,re,socket,subprocess
from pathlib import Path
BASE=Path('/home/iptech/.local/share/libetech-ai-os')
ROOT=Path('/home/iptech/.hermes')
STAGE=Path('/home/iptech/libetech-ai-os-stage-20261108/portal-rollout-20261108')
assert socket.gethostname()=='d1-ai1' and os.getuid()==1000
os.umask(0o077)
env=os.environ.copy();env['LD_LIBRARY_PATH']=str(BASE/'pgroot/usr/lib/x86_64-linux-gnu')
def query(sql):
    args=[str(BASE/'pgroot/usr/lib/postgresql/16/bin/psql'),'-X','-h',str(BASE/'socket'),'-p','5547','-U','iptech','-d','libetech_ai_os','-Atc',sql]
    return json.loads(subprocess.check_output(args,env=env,text=True))
identity=query("""SELECT json_build_object(
 'links',(SELECT coalesce(json_agg(json_build_object('username',u.username,'linkedAt',l.created_at)), '[]'::json) FROM identity.telegram_links l JOIN identity.users u ON u.id=l.user_id),
 'events',(SELECT coalesce(json_agg(x),'[]'::json) FROM (SELECT kind,created_at FROM identity.events ORDER BY created_at DESC LIMIT 12)x),
 'bridgeRequests',(SELECT coalesce(json_agg(x),'[]'::json) FROM (SELECT created_at FROM identity.bridge_nonces ORDER BY created_at DESC LIMIT 10)x),
 'workItems',(SELECT count(*) FROM work_items),
 'reconciliations',(SELECT coalesce(json_agg(json_build_object('code',code,'sourceSha',source_sha,'snapshotHash',snapshot_hash)), '[]'::json) FROM analytics.reconciliations WHERE code='LBRC014')
)""")
state=json.loads((ROOT/'gateway_state.json').read_text())
connections={k:v['state'] for k,v in state['platforms'].items() if k.endswith('telegram')}
logs=[]
for line in (ROOT/'profiles/libetech/logs/gateway.log').read_text(errors='replace').splitlines():
    if line.startswith('2026-11-08 15:') and ('Sending' in line or 'Unknown command' in line):
        # Pairing input/secret is never included; only outbound size/destination and parser errors.
        if '/libetech_link' in line: continue
        logs.append(line)
before=json.loads((STAGE/'before.json').read_text())
unchanged=all(Path(p).is_file() and hashlib.sha256(Path(p).read_bytes()).hexdigest()==h for p,h in before['protectedHashes'].items())
stamp=datetime.datetime.now(datetime.timezone.utc)
report={'observedAt':stamp.isoformat(),'identityMetadata':identity,'gateway':{'pid':state['pid'],'updatedAt':state['updated_at'],'telegram':connections},'protectedFilesUnchanged':unchanged,'boundedProfileDeliveryLogs':logs[-15:],
 'limitations':'Gateway log sizes and nonce timestamps require correlation with the user-visible command result. These alone do not prove response content or BU denial.'}
name='verification-'+stamp.strftime('%Y%m%dT%H%M%SZ')+'.json'
with (STAGE/name).open('x') as f:json.dump(report,f,indent=2)
print(json.dumps({'receipt':name,'links':identity['links'],'recentEvents':identity['events'][:4],'recentBridgeRequests':identity['bridgeRequests'][:4],'workItems':identity['workItems'],'protectedFilesUnchanged':unchanged,'telegramConnected':sum(v=='connected' for v in connections.values()),'telegramTotal':len(connections)}))
