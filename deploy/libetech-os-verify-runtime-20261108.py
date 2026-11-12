"""Read-only runtime checks; does not create users, pair Telegram, or send messages."""
import hashlib,json,os,socket,subprocess,time,urllib.request,urllib.error,urllib.parse
from pathlib import Path

BASE=Path('/home/iptech/.local/share/libetech-ai-os')
STAGE=Path('/home/iptech/libetech-ai-os-stage-20261108')
TENANT='b63f99bf-3a85-4a1f-b74a-66b5793871ef'
PROJECT='8f1b6aca-b20f-469a-a92b-cbde731581fc'
OTHER='00000000-0000-4000-8000-000000000001'

def main():
    assert socket.gethostname()=='d1-ai1' and os.getuid()==1000
    os.umask(0o077)
    values=dict(line.split('=',1) for line in (BASE/'config/web.env').read_text().splitlines() if line)
    psql=BASE/'pgroot/usr/lib/postgresql/16/bin/psql'
    def query(sql,role='web',expected_error=False):
        url=urllib.parse.urlparse(values['DATABASE_URL' if role=='web' else 'IDENTITY_DATABASE_URL'])
        env=dict(os.environ,LD_LIBRARY_PATH=str(BASE/'pgroot/usr/lib/x86_64-linux-gnu'),PGPASSWORD=urllib.parse.unquote(url.password))
        result=subprocess.run([str(psql),'-X','-q','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','5547','-U',url.username,'-d','libetech_ai_os','-At'],input=sql,env=env,capture_output=True,text=True)
        if expected_error:
            assert result.returncode and 'permission denied' in result.stderr,'Expected permission denial'
            return 'permission-denied'
        assert result.returncode==0,'SQL verification failed without exposing its credentials'
        return result.stdout.strip()
    checks={}
    for label,tenant,project in [('permitted',TENANT,PROJECT),('emptyProject',TENANT,''),('otherProject',TENANT,OTHER),('otherTenant',OTHER,PROJECT)]:
        sql=f"BEGIN;SET LOCAL ROLE libetech_runtime;SET LOCAL app.tenant_id='{tenant}';SET LOCAL app.project_ids='{project}';SELECT count(*) FROM analytics.reconciliations;ROLLBACK;"
        checks[label]=int(query(sql))
    assert checks==dict(permitted=1,emptyProject=0,otherProject=0,otherTenant=0),'Row isolation failure'
    checks['webCannotReadIdentity']=query('SET ROLE libetech_runtime;SELECT count(*) FROM identity.users;',expected_error=True)
    checks['identityCannotReadBusiness']=query('SET ROLE libetech_identity;SELECT count(*) FROM projects;',role='auth',expected_error=True)
    exact=query(f"BEGIN;SET LOCAL ROLE libetech_runtime;SET LOCAL app.tenant_id='{TENANT}';SET LOCAL app.project_ids='{PROJECT}';SELECT code||'|'||source_sha||'|'||snapshot_hash FROM analytics.reconciliations;ROLLBACK;")
    assert exact=='LBRC014|8d05141576bcd4db8e7ab9f1a6b7a0dd9bd360ab|4f8aaa43dce649ec6ea6224e91120939c0b4a20125688e4f61f26d536db34b48','Real reconciliation drift'
    role_flags=query("SELECT rolname||'|'||rolsuper||'|'||rolbypassrls||'|'||rolcreatedb||'|'||rolcreaterole FROM pg_roles WHERE rolname IN ('libetech_web','libetech_auth') ORDER BY rolname;")
    assert role_flags=='libetech_auth|false|false|false|false\nlibetech_web|false|false|false|false','Privileged runtime role'
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    http={}
    for path,method in [('/api/health','GET'),('/api/auth/me','GET'),('/api/v1/workspace','GET'),('/api/demo/session','POST'),('/api/bridge','POST')]:
        req=urllib.request.Request('http://127.0.0.1:3148'+path,method=method,data=b'{}' if method=='POST' else None,headers={'Content-Type':'application/json'})
        try:response=opener.open(req,timeout=5)
        except urllib.error.HTTPError as error:response=error
        with response:
            body=json.load(response);http[path]={'status':response.status,'code':(body.get('error') or {}).get('code')}
            if path=='/api/health':health=body['data']
    assert http['/api/health']['status']==200 and health['buildDigest']==values['LIBETECH_BUILD_DIGEST']
    assert http['/api/auth/me']['status']==401 and http['/api/v1/workspace']['status']==401
    assert http['/api/demo/session']['status']==403 and http['/api/bridge']['status']==401
    services={}
    for name in ('libetech-os-postgres.service','libetech-ai-os.service'):
        result=subprocess.run(['systemctl','--user','show',name,'-p','ActiveState','-p','SubState','-p','NRestarts'],capture_output=True,text=True,check=True)
        services[name]=dict(line.split('=',1) for line in result.stdout.strip().splitlines())
        assert services[name]['ActiveState']=='active'
    report={'observedAt':time.time(),'host':socket.gethostname(),'health':health,'rowIsolation':checks,'reconciliation':exact,'runtimeRoles':role_flags.splitlines(),'http':http,'services':services,'telegramDeliveryVerified':False,'browserServerLoginVerified':False,'gatewayRestarted':False}
    with (STAGE/'runtime-verification.json').open('x') as out:json.dump(report,out,indent=2)
    print(json.dumps({'runtime':'pass','postgresql':'active','backend':'active','rls':'4/4','roleSeparation':'2/2','httpGuards':'4/4','LBRC014':'exact-sha','telegram':'not-yet-verified'}),flush=True)

if __name__=='__main__':
    try:main()
    except Exception as error:
        print(json.dumps({'verification':'failed','reason':str(error)}),flush=True)
        raise SystemExit(1)
