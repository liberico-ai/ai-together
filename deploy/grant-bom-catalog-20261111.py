"""One-time, additive read-only Team Tech catalog grants for verified BoM accounts.

Default mode is read-only preflight. --apply requires a separate operator decision.
The script does not approve registration requests or create an account for Chu.
"""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import uuid
import urllib.request

BASE=Path('/home/iptech/.local/share/libetech-ai-os')
PG=BASE/'pgroot/usr/lib/postgresql/16/bin'
RELEASE=BASE/'releases/0.7.0-aa829ca642f4'
TENANT_FILE=BASE/'config/web.env'
EXPECTED_BUILD='aa829ca642f4f696bcd57538996a9d950006739b65d90975d700aee0879c3b88'
PROJECTS=(('IBS HI','IBS HI · Team Tech'),('LBRC','LBRC · Team Tech'),('XECA','XECA · Team Tech'))
USERS=(('quan','bom_quan'),('phuong','bom_phuong'))
ENV={**os.environ,'LD_LIBRARY_PATH':str(BASE/'pgroot/usr/lib/x86_64-linux-gnu')}

def require(condition,message):
    if not condition:raise RuntimeError(message)

def sql(statement):
    return subprocess.check_output([str(PG/'psql'),'-X','-w','-v','ON_ERROR_STOP=1','-h',str(BASE/'socket'),'-p','5547',
        '-U','iptech','-d','libetech_ai_os','-At','-c',statement],env=ENV,text=True,timeout=45).strip()

def main():
    apply=sys.argv[1:]==['--apply']
    require(not sys.argv[1:] or apply,'usage: grant-bom-catalog-20261111.py [--apply]')
    require(socket.gethostname()=='d1-ai1' and os.getuid()==BASE.stat().st_uid and os.geteuid()!=0,'wrong host or owner')
    health=json.load(urllib.request.urlopen('http://127.0.0.1:3148/api/health',timeout=5))['data']
    require(health['version']=='0.7.0' and health['buildDigest']==EXPECTED_BUILD and health['schema'][-1]=='011','unexpected web release')
    values=dict(line.split('=',1) for line in TENANT_FILE.read_text().splitlines() if '=' in line and not line.startswith('#'))
    tenant=str(uuid.UUID(values['LIBETECH_TENANT_ID']))
    preview=json.loads(sql(f"""SELECT json_build_object(
      'people',(SELECT json_agg(json_build_object('username',u.username,'name',u.name,'seat',s.seat,
       'active',u.active,'activated',u.password_hash IS NOT NULL,
       'linked',EXISTS(SELECT 1 FROM identity.telegram_links l WHERE l.tenant_id=u.tenant_id AND l.user_id=u.id)))
       FROM identity.users u LEFT JOIN identity.account_approval_seats s ON s.tenant_id=u.tenant_id AND s.user_id=u.id
       WHERE u.tenant_id='{tenant}' AND u.username IN ('quan','phuong','chu')),
      'projects',(SELECT json_agg(json_build_object('bu',p.bu,'name',p.name)) FROM projects p
       WHERE p.tenant_id='{tenant}' AND p.name IN ('IBS HI · Team Tech','LBRC · Team Tech','XECA · Team Tech')),
      'existing',(SELECT count(*) FROM identity.memberships m JOIN identity.users u ON u.id=m.user_id AND u.tenant_id=m.tenant_id
       JOIN projects p ON p.id=m.project_id AND p.tenant_id=m.tenant_id
       WHERE u.tenant_id='{tenant}' AND u.username IN ('quan','phuong')
       AND p.name IN ('IBS HI · Team Tech','LBRC · Team Tech','XECA · Team Tech')))"""))
    people={item['username']:item for item in preview['people'] or []}
    require(set(people).issuperset({'quan','phuong'}),'verified BoM account missing')
    for user,seat in USERS:
        row=people[user]
        require(row['seat']==seat and row['active'] and row['activated'] and row['linked'],user+' not verified for BoM')
    projects={(p['bu'],p['name']) for p in preview['projects'] or []}
    require(projects==set(PROJECTS),'catalog project scope changed')
    require(preview['existing']==0,'catalog grants already exist; inspect before retry')
    if not apply:
        print(json.dumps({'status':'ready','users':['quan','phuong'],'newProjects':[name for _,name in PROJECTS],
          'role':'viewer','reportPermissions':[],'newGrants':6,'chu':'no verified account; no grant'},ensure_ascii=False))
        return
    receipt=RELEASE/'activation'/('bom-catalog-grant-'+dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    receipt.mkdir(mode=0o700)
    dump=receipt/'before-grant.dump'
    subprocess.run([str(PG/'pg_dump'),'-Fc','-w','-h',str(BASE/'socket'),'-p','5547','-U','iptech','-d','libetech_ai_os','-f',str(dump)],env=ENV,check=True,timeout=90)
    digest=hashlib.sha256(dump.read_bytes()).hexdigest()
    statement=f"""BEGIN;
      DO $$ DECLARE found_people integer; found_projects integer; existing integer; BEGIN
       SELECT count(*) INTO found_people FROM identity.users u
        JOIN identity.account_approval_seats s ON s.tenant_id=u.tenant_id AND s.user_id=u.id
        JOIN identity.telegram_links l ON l.tenant_id=u.tenant_id AND l.user_id=u.id
        WHERE u.tenant_id='{tenant}' AND u.active AND u.password_hash IS NOT NULL
        AND ((u.username='quan' AND s.seat='bom_quan') OR (u.username='phuong' AND s.seat='bom_phuong'));
       IF found_people<>2 THEN RAISE EXCEPTION 'BoM identity changed'; END IF;
       SELECT count(*) INTO found_projects FROM projects p WHERE p.tenant_id='{tenant}'
        AND ((p.bu='IBS HI' AND p.name='IBS HI · Team Tech') OR
             (p.bu='LBRC' AND p.name='LBRC · Team Tech') OR
             (p.bu='XECA' AND p.name='XECA · Team Tech'));
       IF found_projects<>3 THEN RAISE EXCEPTION 'catalog projects changed'; END IF;
       SELECT count(*) INTO existing FROM identity.memberships m JOIN identity.users u ON u.id=m.user_id
        JOIN projects p ON p.id=m.project_id WHERE u.tenant_id='{tenant}' AND u.username IN ('quan','phuong')
        AND p.name IN ('IBS HI · Team Tech','LBRC · Team Tech','XECA · Team Tech');
       IF existing<>0 THEN RAISE EXCEPTION 'catalog grants changed'; END IF;
      END $$;
      WITH added AS (
       INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role,report_permissions)
       SELECT u.tenant_id,u.id,p.id,'viewer',ARRAY[]::text[]
       FROM identity.users u JOIN projects p ON p.tenant_id=u.tenant_id
       WHERE u.tenant_id='{tenant}' AND u.username IN ('quan','phuong')
        AND ((p.bu='IBS HI' AND p.name='IBS HI · Team Tech') OR
             (p.bu='LBRC' AND p.name='LBRC · Team Tech') OR
             (p.bu='XECA' AND p.name='XECA · Team Tech'))
       RETURNING tenant_id,user_id,project_id
      )
      INSERT INTO identity.events(tenant_id,user_id,actor_id,kind,detail)
       SELECT a.tenant_id,a.user_id,c.id,'bom_catalog_read_granted',
        jsonb_build_object('projectId',a.project_id,'role','viewer','reportPermissions',jsonb_build_array(),
        'basis','Chairman: Cấp cho BOM, 2026-11-11','operation','additive-source-catalog-only')
       FROM added a JOIN identity.users c ON c.tenant_id=a.tenant_id AND c.username='chairman';
      COMMIT;"""
    sql(statement)
    after=json.loads(sql(f"""SELECT json_build_object(
      'grants',(SELECT count(*) FROM identity.memberships m JOIN identity.users u ON u.id=m.user_id
       JOIN projects p ON p.id=m.project_id WHERE u.tenant_id='{tenant}' AND u.username IN ('quan','phuong')
       AND p.name IN ('IBS HI · Team Tech','LBRC · Team Tech','XECA · Team Tech')
       AND m.project_role='viewer' AND m.report_permissions='{{}}'::text[]),
      'events',(SELECT count(*) FROM identity.events e WHERE e.tenant_id='{tenant}' AND e.kind='bom_catalog_read_granted'))"""))
    require(after['grants']==6,'grant verification failed')
    result={'status':'applied','scope':'3 source catalog projects','users':['quan','phuong'],'role':'viewer',
      'newGrants':after['grants'],'auditEvents':after['events'],'dumpSha256':digest,
      'at':dt.datetime.now(dt.timezone.utc).isoformat()}
    (receipt/'grant-receipt.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps(result,ensure_ascii=False))

if __name__=='__main__':
    try:main()
    except Exception as error:
        print('BOM_CATALOG_GRANT_STOPPED '+type(error).__name__+': '+str(error)[:200],file=sys.stderr)
        sys.exit(1)
