"""One-time Chairman-authorized pilot onboarding on d1-ai1.

Read-only by default. --apply snapshots the database, processes only the eight
frozen registrations and stores seven private activation links in a 0600 file.
It never records a BoM vote or changes the future web approval flow.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
from zoneinfo import ZoneInfo

BASE = Path('/home/iptech/.local/share/libetech-ai-os')
PG = BASE/'pgroot/usr/lib/postgresql/16/bin'
ENV = {**os.environ, 'LD_LIBRARY_PATH': str(BASE/'pgroot/usr/lib/x86_64-linux-gnu')}
BATCH = 'pilot-20261111'
ORIGIN = 'https://libetech.btnet.vn'
PEOPLE = {
    'cuongld': ('Lê Duy Cường', ('IBS HI · Team Tech',)),
    'thangnm': ('Nguyễn Mạnh Thắng', ('XECA · Team Tech',)),
    'hoanba': ('Bùi Anh Hoàn', ('LibeTech AI OS · Nội bộ',)),
    'linhht': ('Hoàng Thị Yến Linh', ('LBRC · Team Tech',)),
    'sontt': ('Tạ Thanh Sơn', ('IBS HI · Team Tech',)),
    'hungduyle': ('Hung Duy Le', ('IBS HI · Team Tech',)),
    'chu': ('Chu Hoang Anh', ('IBS HI · Team Tech', 'LBRC · Team Tech', 'XECA · Team Tech')),
}
NAMES = {**{key: value[0] for key, value in PEOPLE.items()}, 'quantv': 'Trần Văn Quân'}


def require(ok: bool, message: str) -> None:
    if not ok:
        raise RuntimeError(message)


def literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def sql(statement: str) -> str:
    result = subprocess.run([str(PG/'psql'), '-X', '-w', '-v', 'ON_ERROR_STOP=1',
        '-h', str(BASE/'socket'), '-p', '5547', '-U', 'iptech', '-d', 'libetech_ai_os',
        '-At', '-c', statement], env=ENV, text=True, capture_output=True, timeout=60)
    require(result.returncode == 0, 'database statement failed; no SQL or tokens logged')
    return result.stdout.strip()


def snapshot(tenant: str) -> dict:
    return json.loads(sql(f"""SELECT json_build_object(
      'registrations',(SELECT COALESCE(json_agg(json_build_object(
       'username',username,'name',name,'state',state) ORDER BY username),'[]'::json)
       FROM identity.registration_requests WHERE tenant_id={literal(tenant)}),
      'users',(SELECT COALESCE(json_agg(json_build_object('username',u.username,'id',u.id,
       'active',u.active,'activated',u.password_hash IS NOT NULL,
       'linked',EXISTS(SELECT 1 FROM identity.telegram_links l WHERE l.user_id=u.id),
       'seat',(SELECT seat FROM identity.account_approval_seats s WHERE s.user_id=u.id))),'[]'::json)
       FROM identity.users u WHERE u.tenant_id={literal(tenant)}),
      'projects',(SELECT COALESCE(json_agg(name),'[]'::json) FROM projects
       WHERE tenant_id={literal(tenant)} AND name IN
        ('IBS HI · Team Tech','LBRC · Team Tech','XECA · Team Tech','LibeTech AI OS · Nội bộ')),
      'ballots',(SELECT COALESCE(json_agg(json_build_object('username',r.username,'state',a.state,
       'votes',(SELECT count(*) FROM identity.account_approval_votes v WHERE v.approval_id=a.id))),'[]'::json)
       FROM identity.account_approvals a JOIN identity.registration_requests r ON r.id=a.registration_id
       WHERE a.tenant_id={literal(tenant)} AND a.state IN ('pending','approved')),
      'exceptions',(SELECT count(*) FROM identity.pilot_onboarding_exceptions
       WHERE tenant_id={literal(tenant)}),
      'memberships',(SELECT count(*) FROM identity.memberships WHERE tenant_id={literal(tenant)}),
      'workItems',(SELECT count(*) FROM work_items WHERE tenant_id={literal(tenant)}),
      'sourceTasks',(SELECT count(*) FROM analytics.tech_source_tasks WHERE tenant_id={literal(tenant)}),
      'platforms',(SELECT count(*) FROM analytics.tech_platform_catalog WHERE tenant_id={literal(tenant)}))"""))


def check(state: dict, applied: bool = False) -> None:
    regs = {r['username']: r for r in state['registrations']}
    require(set(regs) == set(NAMES), 'registration cohort drifted')
    require(all(regs[key]['name'] == name for key, name in NAMES.items()), 'registration identity changed')
    require(all(regs[key]['state'] == ('approved' if applied else 'pending') for key in NAMES),
            'registration state drifted')
    users = {u['username']: u for u in state['users']}
    require({'chairman', 'quan', 'phuong'} <= set(users), 'existing accounts missing')
    require(users['chairman']['active'] and users['chairman']['activated'], 'Chairman unavailable')
    require(users['quan']['active'] and users['quan']['activated'] and users['quan']['linked']
            and users['quan']['seat'] == 'bom_quan', 'existing Quân identity not verified')
    require('quantv' not in users, 'duplicate Quân account exists')
    require((set(PEOPLE) <= set(users)) if applied else not(set(PEOPLE) & set(users)),
            'new user account drifted')
    require(set(state['projects']) == {name for _, projects in PEOPLE.values() for name in projects},
            'project catalog drifted')
    if not applied:
        require(state['exceptions'] == 0, 'pilot exception already exists')
        require(sorted((b['username'], b['state'], b['votes']) for b in state['ballots']) ==
                [('linhht', 'pending', 0), ('thangnm', 'pending', 0)], 'existing ballot changed')
    require(state['workItems'] == 0 and state['sourceTasks'] == 45 and state['platforms'] == 17,
            'protected team source changed; reconcile first')


def main() -> None:
    apply = sys.argv[1:] == ['--apply']
    require(not sys.argv[1:] or apply, 'usage: pilot-onboard-20261111.py [--apply]')
    require(socket.gethostname() == 'd1-ai1' and os.geteuid() != 0
            and os.getuid() == BASE.stat().st_uid, 'wrong host or operator')
    tenant = dict(line.split('=', 1) for line in (BASE/'config/web.env').read_text().splitlines()
                  if '=' in line and not line.startswith('#'))['LIBETECH_TENANT_ID']
    import urllib.request
    health = json.load(urllib.request.urlopen('http://127.0.0.1:3148/api/health', timeout=5))['data']
    require(health['version'] == '0.7.1' and health['schema'][-1] == '012',
            'unexpected web release')
    if apply:
        require(dt.datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).date() == dt.date(2026, 11, 11),
                'pilot batch only authorized on 11 November 2026')
    state = snapshot(tenant)
    check(state)
    if not apply:
        print(json.dumps({'status': 'ready', 'registrations': 8, 'existingQuân': 'quan',
          'newAccounts': sorted(PEOPLE), 'grants': sum(len(p) for _, p in PEOPLE.values()),
          'ballotsSuperseded': 2, 'votesFabricated': 0, 'futureApprovals': 'unchanged'}, ensure_ascii=False))
        return

    os.umask(0o077)
    release = next(iter(sorted((BASE/'releases').glob('0.7.1-*'))), None)
    require(release is not None and release.is_dir(), '0.7.1 release missing')
    receipt = release/'activation'/('pilot-onboarding-'+dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    receipt.mkdir(mode=0o700)
    dump = receipt/'before-onboarding.dump'
    result = subprocess.run([str(PG/'pg_dump'), '-Fc', '-w', '-h', str(BASE/'socket'), '-p', '5547',
      '-U', 'iptech', '-d', 'libetech_ai_os', '-f', str(dump)], env=ENV, capture_output=True, timeout=90)
    require(result.returncode == 0, 'database backup failed')
    dump_hash = hashlib.sha256(dump.read_bytes()).hexdigest()
    tokens = {name: secrets.token_urlsafe(32) for name in PEOPLE}
    invite_file = receipt/'invitation-links.json'
    invite_file.write_text(json.dumps({name: ORIGIN+'/activate#'+token for name, token in tokens.items()},
      ensure_ascii=False, indent=2)+'\n')
    invite_file.chmod(0o600)
    users_sql = ','.join(f'({literal(name)},{literal(PEOPLE[name][0])})' for name in PEOPLE)
    grants_sql = ','.join(f'({literal(name)},{literal(project)})'
      for name, (_, projects) in PEOPLE.items() for project in projects)
    token_sql = ','.join(f'({literal(name)},{literal(hashlib.sha256(token.encode()).hexdigest())})'
      for name, token in tokens.items())
    cohort_sql = ','.join(literal(name) for name in PEOPLE)
    statement = f"""BEGIN;
      SET LOCAL lock_timeout='5s';
      DO $$ BEGIN
       IF (SELECT count(*) FROM identity.registration_requests WHERE tenant_id={literal(tenant)}
         AND state='pending' AND username IN ({cohort_sql},'quantv'))<>8
       OR (SELECT count(*) FROM identity.users WHERE tenant_id={literal(tenant)}
         AND username IN ({cohort_sql},'quantv'))<>0
       OR (SELECT count(*) FROM identity.account_approvals a JOIN identity.registration_requests r
         ON r.id=a.registration_id WHERE a.tenant_id={literal(tenant)} AND a.state='pending'
         AND r.username IN ('thangnm','linhht')
         AND NOT EXISTS(SELECT 1 FROM identity.account_approval_votes v WHERE v.approval_id=a.id))<>2
       THEN RAISE EXCEPTION 'pilot cohort changed'; END IF;
      END $$;
      UPDATE identity.account_approvals a SET state='expired',updated_at=now()
       FROM identity.registration_requests r WHERE r.id=a.registration_id
       AND a.tenant_id={literal(tenant)} AND a.state='pending' AND r.username IN ('thangnm','linhht');
      WITH names(username,name) AS (VALUES {users_sql})
       INSERT INTO identity.users(tenant_id,username,name,role)
       SELECT {literal(tenant)}::uuid,n.username,n.name,'viewer' FROM names n;
      WITH grants(username,project_name) AS (VALUES {grants_sql})
       INSERT INTO identity.memberships(tenant_id,user_id,project_id,project_role,report_permissions)
       SELECT {literal(tenant)}::uuid,u.id,p.id,'viewer',ARRAY[]::text[]
       FROM grants g JOIN identity.users u ON u.username=g.username AND u.tenant_id={literal(tenant)}
        JOIN projects p ON p.name=g.project_name AND p.tenant_id=u.tenant_id;
      WITH tokens(username,token_hash) AS (VALUES {token_sql})
       INSERT INTO identity.invitations(tenant_id,user_id,issuer_id,account_version,token_hash,expires_at)
       SELECT {literal(tenant)}::uuid,u.id,c.id,u.account_version,t.token_hash,now()+interval '24 hours'
       FROM tokens t JOIN identity.users u ON u.username=t.username AND u.tenant_id={literal(tenant)}
        JOIN identity.users c ON c.tenant_id=u.tenant_id AND c.username='chairman';
      UPDATE identity.registration_requests r SET state='approved',reviewed_by=c.id,
       reviewed_at=now(),user_id=u.id,updated_at=now()
       FROM identity.users u JOIN identity.users c ON c.tenant_id=u.tenant_id AND c.username='chairman'
       WHERE r.tenant_id={literal(tenant)} AND r.username IN ({cohort_sql})
        AND u.tenant_id=r.tenant_id AND u.username=r.username;
      INSERT INTO identity.pilot_onboarding_exceptions
       (tenant_id,registration_id,user_id,invitation_id,authorized_by,batch_key,reason,expires_at)
       SELECT r.tenant_id,r.id,u.id,i.id,c.id,{literal(BATCH)},
        'Chairman approved frozen pilot registrations on 11 November 2026',i.expires_at
       FROM identity.registration_requests r JOIN identity.users u ON u.id=r.user_id
        JOIN identity.invitations i ON i.user_id=u.id AND i.tenant_id=u.tenant_id
        JOIN identity.users c ON c.tenant_id=u.tenant_id AND c.username='chairman'
       WHERE r.tenant_id={literal(tenant)} AND r.username IN ({cohort_sql});
      UPDATE identity.registration_requests r SET state='approved',reviewed_by=c.id,
       reviewed_at=now(),user_id=q.id,updated_at=now()
       FROM identity.users q JOIN identity.users c ON c.tenant_id=q.tenant_id AND c.username='chairman'
       WHERE r.tenant_id={literal(tenant)} AND r.username='quantv'
        AND q.tenant_id=r.tenant_id AND q.username='quan';
      INSERT INTO identity.account_approval_seats(tenant_id,seat,user_id)
       SELECT tenant_id,'bom_chu',id FROM identity.users WHERE tenant_id={literal(tenant)} AND username='chu';
      INSERT INTO identity.events(tenant_id,user_id,actor_id,kind,detail)
       SELECT u.tenant_id,u.id,c.id,'pilot_registration_approved',
        jsonb_build_object('registrationId',r.id,'batchKey',{literal(BATCH)},'authority','Chairman',
        'normalApprovalFlowPreserved',true,'voteRecorded',false)
       FROM identity.registration_requests r JOIN identity.users u ON u.id=r.user_id
        JOIN identity.users c ON c.tenant_id=u.tenant_id AND c.username='chairman'
       WHERE r.tenant_id={literal(tenant)} AND r.username IN ({cohort_sql});
      INSERT INTO identity.events(tenant_id,user_id,actor_id,kind,detail)
       SELECT q.tenant_id,q.id,c.id,'registration_duplicate_linked',
        jsonb_build_object('registrationId',r.id,'submittedUsername','quantv',
        'canonicalUsername','quan','authority','Chairman')
       FROM identity.registration_requests r JOIN identity.users q ON q.tenant_id=r.tenant_id AND q.username='quan'
        JOIN identity.users c ON c.tenant_id=r.tenant_id AND c.username='chairman'
       WHERE r.tenant_id={literal(tenant)} AND r.username='quantv';
      COMMIT;"""
    sql(statement)
    after = snapshot(tenant)
    check(after, applied=True)
    require(after['exceptions'] == 7 and after['memberships'] == state['memberships']+9
            and len(after['users']) == len(state['users'])+7, 'post-onboarding verification failed')
    require(after['workItems'] == state['workItems'] and after['sourceTasks'] == state['sourceTasks']
            and after['platforms'] == state['platforms'], 'protected data changed')
    report = {'status':'applied','registrationsApproved':8,'newAccounts':7,'duplicateLinked':'quantv -> quan',
      'viewerGrants':9,'pilotExceptions':7,'votesFabricated':0,'futureApprovals':'unchanged',
      'invitationLinksFile':str(invite_file),'invitationExpiresInHours':24,
      'backupSha256':dump_hash,'at':dt.datetime.now(dt.timezone.utc).isoformat()}
    (receipt/'pilot-onboarding-receipt.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print('PILOT_ONBOARDING_STOPPED '+type(exc).__name__+': '+str(exc)[:180], file=sys.stderr)
        raise SystemExit(1)
