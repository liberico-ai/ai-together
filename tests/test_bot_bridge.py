import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest

spec=importlib.util.spec_from_file_location('bridge',Path(__file__).parents[1]/'bot-plugin/__init__.py')
bridge=importlib.util.module_from_spec(spec);spec.loader.exec_module(bridge)

class BridgeTests(unittest.TestCase):
    def context(self,**overrides):
        return dict(platform='telegram',profile='libetech',user_id='123',chat_id='123',chat_type='private',message_id='456')|overrides
    def test_valid_private_identity(self):
        self.assertEqual(bridge.validated_context(self.context())['telegramId'],'123')
    def test_missing_and_other_profile_fail_closed(self):
        for values in [dict(user_id=''),dict(profile='xeca'),dict(platform='local'),dict(message_id='')]:
            with self.assertRaises(ValueError):bridge.validated_context(self.context(**values))
    def test_dm_cannot_claim_other_actor(self):
        with self.assertRaises(ValueError):bridge.validated_context(self.context(chat_id='999'))
    def test_group_cannot_be_disguised_as_private(self):
        with self.assertRaises(ValueError):bridge.validated_context(self.context(chat_id='-100',chat_type='private'))
    def test_source_context_and_spoofed_tool_identity(self):
        source=SimpleNamespace(**self.context());self.assertEqual(bridge.command_context(source)['telegramId'],'123')
        with self.assertRaises(ValueError):bridge.read_request({'code':'LBRC014','source_sha':'a'*40,'telegramId':'999'},bridge.command_context(source))
    def test_exact_sha_and_no_write_operations(self):
        for params in [{'code':'LBRC014','source_sha':'a'*7},{'operation':'accept'},{'code':'LBRC014','source_sha':'a'*40,'role':'manager'}]:
            with self.assertRaises(ValueError):bridge.read_request(params,{})
    def test_wrong_home_denied_before_reading_credentials(self):
        with self.assertRaisesRegex(ValueError, "PROFILE_SCOPE_MISMATCH"):
            bridge.call_backend(Path('/tmp/not-libetech'), {})
    def test_probe_registration_is_side_effect_free(self):
        import sys
        from unittest.mock import patch
        registered=[]
        ctx=SimpleNamespace(register_tool=lambda **kw:registered.append(('tool',kw)),register_command=lambda name,**kw:registered.append((name,kw)))
        with patch.dict(sys.modules, {'hermes_constants':SimpleNamespace(get_hermes_home=lambda:Path('/tmp/hermes-probe'))}):
            bridge.register(ctx)
        self.assertEqual(len(registered),7)
        source=SimpleNamespace(**self.context())
        check=next(kwargs['handler'] for name,kwargs in registered if name=='libetech-check')
        self.assertEqual(check('LBRC014 '+'a'*40,source=source),'PROFILE_SCOPE_MISMATCH')
        pending=next(kwargs['handler'] for name,kwargs in registered if name=='libetech-access-pending')
        self.assertEqual(pending('',source=source),'PROFILE_SCOPE_MISMATCH')
        group=SimpleNamespace(**self.context(chat_id='-1001',chat_type='group'))
        self.assertEqual(pending('',source=group),'PRIVATE_CHAT_REQUIRED')
        approve=next(kwargs['handler'] for name,kwargs in registered if name=='libetech-access-approve')
        self.assertEqual(approve('not-an-id',source=source),'USE_APPROVAL_ID')
    def test_short_review_asks_yes_no_without_exposing_ids_or_bypassing_dm(self):
        import sys
        from unittest.mock import patch
        first='00000000-0000-4000-8000-000000000001'
        second='00000000-0000-4000-8000-000000000002'
        rows=[{'id':first,'name':'Nguyễn Mạnh Thắng','username':'thangnm',
               'reason':'Đã đối chiếu Team Tech',
               'grants':[{'projectId':'1'}],
               'grant_details':[{'name':'LibeTech AI OS · Nội bộ','role':'viewer','reportPermissions':[]}]},
              {'id':second,'name':'Hoàng Thị Yến Linh','username':'linhht',
               'reason':'Đã đối chiếu Team Tech',
               'grants':[{'projectId':'2'}],
               'grant_details':[{'name':'LBRC · App Saleman','role':'engineer',
                                 'reportPermissions':['people_read']}]}]
        registered=[];questions=[];requests=[];answers=iter(['yes','no'])
        ctx=SimpleNamespace(register_tool=lambda **kw:registered.append(('tool',kw)),
                            register_command=lambda name,**kw:registered.append((name,kw)),
                            ask_choice=lambda question,choices:(questions.append((question,choices)),next(answers))[1])
        with patch.dict(sys.modules,{'hermes_constants':SimpleNamespace(get_hermes_home=lambda:Path('/tmp/hermes-probe'))}):
            bridge.register(ctx)
        review=next(kwargs['handler'] for name,kwargs in registered if name=='duyet')
        def backend(_home,payload):
            requests.append(payload)
            return rows if payload['operation']=='account_approval_pending' else {'state':'pending'}
        with patch.object(bridge,'call_backend',side_effect=backend):
            source=SimpleNamespace(**self.context())
            self.assertIn('Thắng: YES',review('',source=source))
            self.assertEqual([(r['approvalId'],r['choice']) for r in requests[1:]],
                             [(first,'agree'),(second,'reject')])
            self.assertEqual(len(questions),2)
            self.assertIn('LibeTech AI OS · Nội bộ (Chỉ đọc)',questions[0][0])
            self.assertIn('Xem điểm nhân sự',questions[1][0])
            self.assertNotIn(first,questions[0][0])
            self.assertEqual([choice['value'] for choice in questions[0][1]],['yes','no'])
            requests.clear()
            group=SimpleNamespace(**self.context(chat_id='-1001',chat_type='group'))
            self.assertEqual(review('',source=group),'PRIVATE_CHAT_REQUIRED')
            self.assertEqual(requests,[])
    def test_short_review_cancel_and_unknown_scope_never_vote(self):
        import sys
        from unittest.mock import patch
        row={'id':'00000000-0000-4000-8000-000000000001','name':'Thắng','username':'thangnm',
             'reason':'Đã đối chiếu Team Tech',
             'grants':[{'projectId':'1'}],
             'grant_details':[{'name':'LibeTech nội bộ','role':'viewer','reportPermissions':[]}]}
        registered=[];requests=[]
        ctx=SimpleNamespace(register_tool=lambda **kw:registered.append(('tool',kw)),
                            register_command=lambda name,**kw:registered.append((name,kw)),
                            ask_choice=lambda _question,_choices:None)
        with patch.dict(sys.modules,{'hermes_constants':SimpleNamespace(get_hermes_home=lambda:Path('/tmp/hermes-probe'))}):
            bridge.register(ctx)
        review=next(kwargs['handler'] for name,kwargs in registered if name=='duyet')
        def backend(_home,payload):
            requests.append(payload)
            return [row]
        with patch.object(bridge,'call_backend',side_effect=backend):
            self.assertIn('Đã dừng',review('',source=SimpleNamespace(**self.context())))
            self.assertEqual([r['operation'] for r in requests],['account_approval_pending'])
            row['grant_details'][0]['role']='unknown'
            requests.clear()
            self.assertEqual(review('',source=SimpleNamespace(**self.context())),'APPROVAL_SCOPE_UNAVAILABLE')
            self.assertEqual([r['operation'] for r in requests],['account_approval_pending'])
    def test_error_does_not_echo_secrets(self):
        self.assertEqual(bridge.safe_error(ValueError('secret token: hidden'))['error'],'BRIDGE_UNAVAILABLE')

# ---- Slice 2 · Task 11: separately keyed intake/delivery adapter. Fakes only: nothing is installed or sent. ----
import fcntl,hashlib,hmac,json,os,re,stat,sys,tempfile,time,urllib.error
from contextlib import contextmanager
from datetime import datetime,timedelta,timezone
from unittest.mock import Mock,patch

GROUP='-1000000000001'
SENDER='900000001'
INTAKE_KEY='synthetic-intake-key-'+'i'*40
BOT_KEY='synthetic-bot-key-'+'b'*40
OUTBOX_A,OUTBOX_B,OUTBOX_C=('00000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-00000000000b','00000000-0000-4000-8000-00000000000c')
LEASE_A,LEASE_B,LEASE_C=('10000000-0000-4000-8000-00000000000a','10000000-0000-4000-8000-00000000000b','10000000-0000-4000-8000-00000000000c')
NIL='00000000-0000-0000-0000-000000000000'
ISO=r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'
DM=dict(platform='telegram',profile='libetech',user_id='123',chat_id='123',chat_type='private',message_id='456')
RECEIVED='Đã ghi nhận, mã IN-0A1B2C3D. PM sẽ xác nhận loại và dự án; đây chưa phải việc đã giao.'
DM_CARD='Có phiếu Tech chờ anh/chị xác nhận. Gõ /duyet trong chat riêng này.'
# The runtime intake.json of a gateway whose hook is switched on for the one synthetic group.
HOOK_ON=dict(hookEnabled=True,chats=[GROUP])

@contextmanager
def profile_home(intake=True,bot=True,**intake_fields):
    with tempfile.TemporaryDirectory() as tmp:
        home=Path(tmp).resolve()
        runtime=home/'runtime/libetech-ai-os';runtime.mkdir(parents=True)
        for name,content,wanted in (('intake.json',{'key':INTAKE_KEY}|intake_fields,intake),('bridge.json',{'key':BOT_KEY},bot)):
            if wanted:
                (runtime/name).write_text(json.dumps(content));os.chmod(runtime/name,0o600)
        with patch.object(bridge,'EXPECTED_HOME',home):
            yield home

def spool_lines(home):
    path=home/'runtime/libetech-ai-os/intake-spool.jsonl'
    return [json.loads(line) for line in path.read_text().split('\n') if line] if path.exists() else []

def dead_lines(home):
    path=home/'runtime/libetech-ai-os/intake-dead.jsonl'
    return [json.loads(line) for line in path.read_text().split('\n') if line] if path.exists() else []

def fitted(number,text='Nhờ kiểm tra báo cáo tuần',**fields):
    return bridge.fit_event(take(tg_event(text,source=dict(message_id=str(number)),**fields)))

def hook_of(home):
    _,hooks=register_with(home,register_hook=True)
    (_,hook),=hooks
    return hook

def tg_event(text='Nhờ kiểm tra báo cáo tuần',source=None,**fields):
    values=dict(platform=SimpleNamespace(value='telegram'),profile='libetech',user_id=SENDER,chat_id=GROUP,chat_type='supergroup',message_id='41')
    values.update(source or {})
    return SimpleNamespace(source=SimpleNamespace(**values),text=text,**fields)

def take(event):
    # The hook always passes the gateway allowlist from intake.json; a direct call must name it too (T11).
    return bridge.intake_event(event,chats=[GROUP])

def encoded(payload):
    return json.dumps(payload,ensure_ascii=False,separators=(',',':')).encode()

def journal_lines(home):
    return [json.loads(line) for line in (home/'runtime/libetech-ai-os/send-journal.jsonl').read_text().splitlines()]

class FakeResponse:
    status=200
    def __init__(self,body):self.body=body
    def read(self,size):return self.body[:size]
    def __enter__(self):return self
    def __exit__(self,*args):return False

class FakeOpener:
    def __init__(self):self.requests=[]
    def open(self,request,timeout):
        self.requests.append(request)
        return FakeResponse(b'{"data":{"ok":true},"error":null}')

def delivery(outbox_id,lease,attempt=1,template='intake.received',params=None,audience='group',chat=GROUP,topic='',reply='41'):
    return {'outboxId':outbox_id,'attemptNo':attempt,'leaseToken':lease,'audience':audience,'chatId':chat,'topicId':topic,'replyToMessageId':reply,
            'envelope':{'event_id':'30000000-0000-4000-8000-000000000001','event_type':template,'version':'v1','source':'libetech-ai-os',
                        'timestamp':'2026-11-14T01:00:00.000Z','tenant_id':'40000000-0000-4000-8000-000000000001',
                        'trace_id':'30000000-0000-4000-8000-000000000002','correlation_id':'30000000-0000-4000-8000-000000000003','causation_id':None,
                        'payload':{'template':template,'params':{'ref':'IN-0A1B2C3D','observedAt':'2026-11-14T01:00:00.000Z'} if params is None else params}}}

class FakeBackend:
    """Stands in for call_backend on the intake key: answers pulls in turn and records every receipt batch."""
    def __init__(self,pulls=(),report=None):
        self.pulls=list(pulls);self.reports=[];self.calls=[]
        self.report=report or (lambda receipts:{'accepted':len(receipts),'replayed':0,'rejected':[]})
    def __call__(self,_home,payload,*,path='/api/bridge',key_file='bridge.json'):
        self.calls.append((path,key_file,payload))
        if key_file!='intake.json':raise AssertionError('outbox must use the intake key')
        if path==bridge.PULL_PATH:return self.pulls.pop(0) if self.pulls else {'deliveries':[],'reconcile':[]}
        if path==bridge.RECEIPT_PATH:
            self.reports.append(payload['receipts'])
            return self.report(payload['receipts'])
        raise AssertionError(path)

def raising(error):
    def fail(*_args,**_kwargs):raise error
    return fail

def access_row(**overrides):
    row={'id':'00000000-0000-4000-8000-0000000000c1','kind':'access_change','name':'Người  mẫu Hai','username':'nguoimau2',
         'reason':'Bổ sung việc nghiệm thu','project_interest':None,'state':'pending','agreed':0,
         'grants':[{'projectId':'50000000-0000-4000-8000-000000000001','role':'engineer','reportPermissions':['people_read']},
                   {'projectId':'50000000-0000-4000-8000-000000000002','role':'viewer','reportPermissions':[]}],
         'grant_details':[{'name':'Dự án mẫu A','role':'engineer','reportPermissions':['people_read']},
                          {'name':'Dự án mẫu B','role':'viewer','reportPermissions':[]}],
         'previous_grant_details':[{'name':'Dự án mẫu A','role':'viewer','reportPermissions':[]}]}
    return row|overrides

def register_with(home,**extra):
    registered=[];hooks=[]
    ctx=SimpleNamespace(register_tool=lambda **kw:registered.append(('tool',kw)),
                        register_command=lambda name,**kw:registered.append((name,kw)),**extra)
    if 'register_hook' in extra:ctx.register_hook=lambda name,callback:hooks.append((name,callback))
    with patch.dict(sys.modules,{'hermes_constants':SimpleNamespace(get_hermes_home=lambda:home)}):
        bridge.register(ctx)
    return registered,hooks

class IntakeAdapterTests(unittest.TestCase):
    def test_bot_tool_and_commands_never_reach_intake_paths(self):
        approval='00000000-0000-4000-8000-000000000001'
        row={'id':approval,'kind':'registration','name':'Người mẫu','username':'nguoimau','reason':'Đã đối chiếu Team Tech',
             'grants':[{'projectId':'1'}],'grant_details':[{'name':'Dự án mẫu A','role':'viewer','reportPermissions':[]}],
             'previous_grant_details':None}
        seen=[]
        def backend(_home,payload,*,path='/api/bridge',key_file='bridge.json'):
            seen.append((path,key_file,payload['operation']))
            return [row] if payload['operation']=='account_approval_pending' else {'state':'pending'}
        class Var:
            def __init__(self,value):self.value=value
            def get(self):return self.value
        values={'PLATFORM':'telegram','PROFILE':'libetech','USER_ID':'123','CHAT_ID':'123','CHAT_TYPE':'private','MESSAGE_ID':'456','ID':'session-1','KEY':'session-key'}
        session=SimpleNamespace(_UNSET=object(),_VAR_MAP={'HERMES_SESSION_'+name:Var(value) for name,value in values.items()})
        registered,_=register_with(Path('/tmp/hermes-probe'),ask_choice=lambda _question,_choices:'yes')
        handlers={name:kwargs['handler'] for name,kwargs in registered}
        self.assertEqual(len(handlers),7)
        source=SimpleNamespace(**DM)
        with patch.dict(sys.modules,{'gateway':SimpleNamespace(session_context=session)}),patch.object(bridge,'call_backend',side_effect=backend):
            self.assertTrue(json.loads(handlers['tool']({'code':'LBRC014','source_sha':'a'*40}))['ok'])
            self.assertIn('Đã xác minh',handlers['libetech-link']('A'*43,source=source))
            self.assertTrue(json.loads(handlers['libetech-check']('LBRC014 '+'a'*40,source=source))['ok'])
            self.assertTrue(json.loads(handlers['libetech-access-pending']('',source=source))['ok'])
            self.assertTrue(json.loads(handlers['libetech-access-approve'](approval,source=source))['ok'])
            self.assertTrue(json.loads(handlers['libetech-access-reject'](approval,source=source))['ok'])
            self.assertIn('YES',handlers['duyet']('',source=source))
        self.assertEqual({(path,key) for path,key,_ in seen},{('/api/bridge','bridge.json')})
        self.assertEqual({operation for _,_,operation in seen},{'reconciliation','pair','account_approval_pending','account_approval_vote'})
        for params in [{'operation':'intake_event'},{'operation':'outbox_pull'},{'operation':'outbox_report'},
                       {'code':'LBRC014','source_sha':'a'*40,'operation':'intake_event'}]:
            with self.assertRaisesRegex(ValueError,'^INVALID_REQUEST$'):bridge.read_request(params,{})

    def test_signing_text_uses_the_exact_route_path(self):
        self.assertEqual((bridge.INTAKE_PATH,bridge.PULL_PATH,bridge.RECEIPT_PATH),
                         ('/api/bridge/intake/events','/api/bridge/outbox/pull','/api/bridge/outbox/receipts'))
        with profile_home() as home:
            opener=FakeOpener()
            with patch.object(bridge.urllib.request,'build_opener',return_value=opener):
                self.assertEqual(bridge.call_backend(home,{'text':'tin'},path=bridge.INTAKE_PATH,key_file='intake.json'),{'ok':True})
                bridge.call_backend(home,{'limit':1},path=bridge.PULL_PATH,key_file='intake.json')
                bridge.call_backend(home,{'receipts':[]},path=bridge.RECEIPT_PATH,key_file='intake.json')
                bridge.call_backend(home,{'operation':'reconciliation'})
        expected=[('/api/bridge/intake/events',INTAKE_KEY),('/api/bridge/outbox/pull',INTAKE_KEY),
                  ('/api/bridge/outbox/receipts',INTAKE_KEY),('/api/bridge',BOT_KEY)]
        self.assertEqual(len(opener.requests),4)
        for request,(path,key) in zip(opener.requests,expected):
            timestamp=request.get_header('X-libetech-timestamp');nonce=request.get_header('X-libetech-nonce')
            self.assertRegex(timestamp,r'^\d{13}$');self.assertRegex(nonce,r'^[A-Za-z0-9_-]{20,80}$')
            text=f'{timestamp}\n{nonce}\nPOST\n{path}\n'.encode()+request.data
            self.assertEqual(request.get_header('X-libetech-signature'),hmac.new(key.encode(),text,hashlib.sha256).hexdigest())
            self.assertEqual(request.full_url,'http://127.0.0.1:3148'+path)
            self.assertEqual(request.get_method(),'POST')

    def test_intake_key_file_is_separate_and_permission_checked(self):
        with profile_home(intake=False) as home,patch.object(bridge.urllib.request,'build_opener') as build:
            with self.assertRaisesRegex(ValueError,'^BRIDGE_NOT_CONFIGURED$'):
                bridge.call_backend(home,{},path=bridge.INTAKE_PATH,key_file='intake.json')
            build.assert_not_called()
        with profile_home() as home,patch.object(bridge.urllib.request,'build_opener') as build:
            os.chmod(home/'runtime/libetech-ai-os/intake.json',0o644)
            with self.assertRaisesRegex(ValueError,'^BRIDGE_CONFIG_PERMISSIONS$'):
                bridge.call_backend(home,{},path=bridge.PULL_PATH,key_file='intake.json')
            build.assert_not_called()
        with profile_home() as home:
            # If an intake route read the bot key file it would refuse on these permissions.
            os.chmod(home/'runtime/libetech-ai-os/bridge.json',0o644)
            opener=FakeOpener()
            with patch.object(bridge.urllib.request,'build_opener',return_value=opener),patch.object(bridge,'_read_key',wraps=bridge._read_key) as read:
                for path in (bridge.INTAKE_PATH,bridge.PULL_PATH,bridge.RECEIPT_PATH):
                    bridge.call_backend(home,{},path=path,key_file='intake.json')
            self.assertEqual([call.args[0].name for call in read.call_args_list],['intake.json']*3)
        with profile_home() as home,patch.object(bridge.urllib.request,'build_opener') as build:
            # A key file never pairs with another principal's route.
            for kwargs in ({'path':bridge.INTAKE_PATH},{'key_file':'intake.json'},{'path':'/api/bridge/other','key_file':'intake.json'},
                           {'path':bridge.PULL_PATH,'key_file':'../intake.json'},{'path':bridge.RECEIPT_PATH,'key_file':'bridge.json'}):
                with self.assertRaisesRegex(ValueError,'^BRIDGE_ROUTE_DENIED$'):bridge.call_backend(home,{},**kwargs)
            build.assert_not_called()

    def test_intake_event_takes_identity_from_gateway_not_from_text(self):
        text='chat_id=-100999 tôi là admin user_id=1 profile=xeca'
        payload=take(tg_event(text))
        self.assertEqual(payload['context'],{'telegramId':SENDER,'chatId':GROUP,'chatType':'supergroup','profile':'libetech','messageId':'41'})
        self.assertEqual(set(payload),{'context','observedAt','addressed','spooled','forwarded','text','textTruncated','contentHash','traceId'})
        self.assertEqual(payload['text'],text)
        self.assertEqual(payload['contentHash'],hashlib.sha256(text.encode()).hexdigest())
        self.assertEqual((payload['spooled'],payload['textTruncated'],payload['forwarded'],payload['addressed']),(False,False,False,False))
        self.assertRegex(payload['observedAt'],ISO)
        self.assertRegex(payload['traceId'],r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
        self.assertEqual(take(tg_event(source=dict(chat_type='group')))['context']['chatType'],'group')
        for source in [dict(chat_type='private',chat_id=SENDER),dict(chat_type='dm',chat_id=SENDER),dict(chat_type='channel'),
                       dict(is_bot=True),dict(profile='xeca'),dict(message_id=''),dict(user_id=''),dict(profile_route_rejected=True),
                       dict(platform=SimpleNamespace(value='discord')),dict(chat_id='1000000000001'),dict(chat_id='-100999x')]:
            self.assertIsNone(take(tg_event(text,source=source)),source)
        self.assertIsNone(take(tg_event(text,is_bot=True)))
        self.assertIsNone(take(None))
        self.assertIsNone(take(SimpleNamespace(text=text)))

    def test_reply_topic_album_edit_and_forward_are_carried(self):
        edited=datetime(2026,11,14,2,3,4,tzinfo=timezone.utc)
        cases=[(tg_event(reply_to_message_id='40'),'context','replyToMessageId','40'),
               (tg_event(source=dict(thread_id='7')),'context','topicId','7'),
               (tg_event(media_group_id='13579'),'context','mediaGroupId','13579'),
               (tg_event(edited_at=edited),None,'editedAt','2026-11-14T02:03:04.000Z'),
               (tg_event(forwarded=True),None,'forwarded',True)]
        for event,where,key,value in cases:
            payload=take(event)
            self.assertEqual((payload['context'] if where else payload)[key],value)
            self.assertEqual(payload['context']['messageId'],'41')
        self.assertEqual(take(tg_event(edited_at=int(edited.timestamp())))['editedAt'],'2026-11-14T02:03:04.000Z')
        self.assertEqual(take(tg_event(reply_to_message_id=40,source=dict(thread_id=7)))['context'] | {},
                         {'telegramId':SENDER,'chatId':GROUP,'chatType':'supergroup','profile':'libetech','messageId':'41','topicId':'7','replyToMessageId':'40'})
        plain=take(tg_event())
        for key in ('replyToMessageId','topicId','mediaGroupId'):self.assertNotIn(key,plain['context'])
        self.assertNotIn('editedAt',plain);self.assertFalse(plain['forwarded'])
        # An aware ISO string is a time too; Telegram's own `date` is an epoch int.
        for stamp in ('2026-11-14T02:03:04Z','2026-11-14T09:03:04+07:00','2026-11-14T02:03:04.000+00:00'):
            self.assertEqual(take(tg_event(edited_at=stamp))['editedAt'],'2026-11-14T02:03:04.000Z')
        for stamp in (int(edited.timestamp()),edited,'2026-11-14T02:03:04Z'):
            self.assertEqual(take(tg_event(timestamp=stamp))['observedAt'],'2026-11-14T02:03:04.000Z')

    def test_malformed_optional_metadata_is_dropped_and_the_message_still_recorded(self):
        # Never guessed and never fatal: the field is left out, its name is logged as a fixed code, the message is kept.
        cases=[(dict(reply_to_message_id='abc'),'replyToMessageId'),(dict(reply_to_message_id='0'),'replyToMessageId'),
               (dict(reply_to_message_id=True),'replyToMessageId'),(dict(media_group_id='x'*65),'mediaGroupId'),
               (dict(source=dict(thread_id='-7')),'topicId'),(dict(edited_at=datetime(2026,1,1)),'editedAt'),
               (dict(edited_at='yesterday'),'editedAt'),(dict(edited_at='2026-11-14T02:03:04'),'editedAt'),
               (dict(edited_at=True),'editedAt'),(dict(edited_at=float('inf')),'editedAt'),(dict(edited_at=10**15),'editedAt')]
        for fields,key in cases:
            with self.assertLogs(bridge.LOG.name,level='DEBUG') as logs:
                payload=take(tg_event(**fields))
            self.assertEqual(payload['context']['messageId'],'41',fields)
            self.assertNotIn(key,payload['context']);self.assertNotIn(key,payload)
            self.assertEqual(logs.output,[f'WARNING:{bridge.LOG.name}:libetech intake: INTAKE_FIELD_DROPPED {key}'],fields)
        # A naive edit time is not replaced by "now": the field is simply absent.
        self.assertNotIn('editedAt',take(tg_event(edited_at=datetime(2026,11,14,2,3,4))))
        # observedAt is required by the intake schema, so an unusable gateway time falls back to the time seen here.
        before=datetime.now(timezone.utc).replace(microsecond=0)
        with self.assertLogs(bridge.LOG.name,level='DEBUG') as logs:
            payload=take(tg_event(timestamp=datetime(2026,1,1)))
        self.assertGreaterEqual(datetime.fromisoformat(payload['observedAt'].replace('Z','+00:00')),before)
        self.assertEqual(logs.output,[f'WARNING:{bridge.LOG.name}:libetech intake: INTAKE_FIELD_DROPPED observedAt'])
        # Identity stays required: a missing or invalid chat, message or sender is still not a message.
        for source in [dict(chat_id=''),dict(chat_id='abc'),dict(message_id='0'),dict(user_id='x'),dict(user_id=None)]:
            self.assertIsNone(take(tg_event(source=source)),source)

    def test_addressed_means_command_mention_or_reply_to_bot(self):
        self.assertFalse(take(tg_event('Báo cáo tuần đã gửi'))['addressed'])
        for event in [tg_event('/baocao tuần này'),tg_event('  /start'),tg_event('xem giúp',mentions_bot=True),tg_event('ok',reply_to_bot=True)]:
            self.assertTrue(take(event)['addressed'])
        # Only an explicit True from the gateway counts; text that merely contains a slash does not.
        self.assertFalse(take(tg_event('a/b',mentions_bot='yes',reply_to_bot=1))['addressed'])

    def test_long_text_is_truncated_to_fit_and_hash_is_of_the_full_text(self):
        quotes='"'*4096
        original=take(tg_event(quotes))
        payload=bridge.fit_event(original)
        self.assertLessEqual(len(encoded(payload)),bridge.MAX_EVENT_BYTES)
        self.assertEqual(bridge.MAX_EVENT_BYTES,16384)
        # 4 096 quotes escape to 8 192 bytes: it fits, so nothing is cut.
        self.assertEqual((payload['text'],payload['textTruncated']),(quotes,False))
        self.assertEqual(payload['contentHash'],hashlib.sha256(quotes.encode()).hexdigest())
        self.assertEqual(original['text'],quotes)
        # Characters that escape to six bytes each do not fit: cut to the longest prefix that does.
        control='\x01'*4096
        cut=bridge.fit_event(take(tg_event(control)))
        self.assertTrue(cut['textTruncated'])
        self.assertLessEqual(len(encoded(cut)),bridge.MAX_EVENT_BYTES)
        self.assertTrue(control.startswith(cut['text']) and len(cut['text'])<4096)
        self.assertGreater(len(encoded(cut|{'text':control[:len(cut['text'])+1]})),bridge.MAX_EVENT_BYTES)
        self.assertEqual(cut['contentHash'],hashlib.sha256(control.encode()).hexdigest())
        # The server counts 4 096 UTF-16 units, not code points.
        emoji='😀'*4096
        short=bridge.fit_event(take(tg_event(emoji)))
        self.assertTrue(short['textTruncated'])
        self.assertEqual(len(short['text'].encode('utf-16-le'))//2,4096)
        self.assertEqual(short['contentHash'],hashlib.sha256(emoji.encode()).hexdigest())

    def test_attachment_too_large_unsupported_or_failed_download_is_not_stored(self):
        self.assertEqual(bridge.MAX_ATTACHMENT_BYTES,20971520)
        self.assertEqual(bridge.ALLOWED_MIME,frozenset({'image/jpeg','image/png','image/webp','application/pdf','text/plain','text/csv',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation'}))
        allowed_keys={'state','reasonCode','mimeType','sizeBytes','fileName'}
        with profile_home() as home:
            folder=home/'runtime/libetech-ai-os/attachments'
            download=Mock(return_value=b'never')
            cases=[({'mime_type':'application/pdf','file_size':bridge.MAX_ATTACHMENT_BYTES+1,'file_name':'bao-cao.pdf'},download,'TOO_LARGE'),
                   ({'mime_type':'application/vnd.ms-excel.sheet.macroEnabled.12','file_size':10,'file_name':'bang.xlsm'},download,'UNSUPPORTED_TYPE'),
                   ({'mime_type':'image/svg+xml','file_size':10},download,'UNSUPPORTED_TYPE'),
                   ({'mime_type':'application/pdf','file_size':10},raising(OSError('network down')),'DOWNLOAD_UNAVAILABLE'),
                   ({'mime_type':'application/pdf','file_size':10},None,'DOWNLOAD_UNAVAILABLE'),
                   ({'mime_type':'text/plain'},lambda:b'x'*(bridge.MAX_ATTACHMENT_BYTES+1),'TOO_LARGE'),
                   ({'mime_type':'text/plain'},lambda:'not bytes','DOWNLOAD_UNAVAILABLE')]
            for raw,fetch,reason in cases:
                result=bridge.store_attachment(home,raw,fetch)
                self.assertEqual((result['state'],result['reasonCode']),('failed',reason),raw)
                self.assertLessEqual(set(result),allowed_keys)
            download.assert_not_called()
            self.assertFalse(folder.exists() and any(folder.iterdir()))
            data=b'%PDF-1.4 synthetic test file'
            digest=hashlib.sha256(data).hexdigest()
            stored=bridge.store_attachment(home,{'mime_type':'Application/PDF','file_size':len(data),'file_name':'../../etc/bao-cao.pdf'},lambda:data)
            self.assertEqual(stored,{'state':'stored','locator':'gw://libetech/attachments/'+digest,'sha256':digest,
                                     'mimeType':'application/pdf','sizeBytes':len(data),'fileName':'bao-cao.pdf'})
            self.assertEqual((folder/digest).read_bytes(),data)
            self.assertEqual(stat.S_IMODE((folder/digest).stat().st_mode),0o600)
            self.assertEqual([path.name for path in folder.iterdir()],[digest])
            # Sec M4: bidi and other Unicode format characters never reach the name shown to a PM
            for raw_name,clean in [('bao\u202ecod.exe.pdf','baocod.exe.pdf'),('\u200bbao\u2066-cao\u2069.pdf\ufeff','bao-cao.pdf'),
                                   ('ho\u00ader\u061c.pdf','hoer.pdf'),('bi\u00ean-ba\u0309n.pdf','bi\u00ean-ba\u0309n.pdf')]:
                self.assertEqual(bridge._file_name(raw_name),clean,raw_name)

    def test_backend_down_spools_and_recovery_replays_in_order_with_spooled_flag(self):
        def event(number,text):return bridge.fit_event(take(tg_event(text,source=dict(message_id=number))))
        with profile_home() as home:
            spool=bridge.Spool(home)
            path=home/'runtime/libetech-ai-os/intake-spool.jsonl'
            with patch.object(bridge,'call_backend',side_effect=urllib.error.URLError('down')):
                self.assertEqual(bridge.submit_event(home,event('51','tin một'),spool),{'ok':False,'spooled':True})
                self.assertEqual(bridge.submit_event(home,event('52','tin hai'),spool),{'ok':False,'spooled':True})
            self.assertEqual(len(path.read_text().splitlines()),2)
            self.assertEqual(stat.S_IMODE(path.stat().st_mode),0o600)
            sent=[]
            self.assertEqual(spool.drain(sent.append),2)
            self.assertEqual([payload['context']['messageId'] for payload in sent],['51','52'])
            self.assertTrue(all(payload['spooled'] is True for payload in sent))
            self.assertEqual(path.read_text(),'')
            # A refusal about the message itself is not spooled: retrying could never succeed.
            with patch.object(bridge,'call_backend',side_effect=bridge.BackendError('SCOPE_DENIED',403)):
                self.assertEqual(bridge.submit_event(home,event('50','tin ngoài phạm vi'),spool),{'ok':False,'error':'SCOPE_DENIED'})
            self.assertEqual(path.read_text(),'')
            # A 5xx is spooled; the next live submit replays the spool first, then sends the new message.
            with patch.object(bridge,'call_backend',side_effect=bridge.BackendError('INTAKE_UNCONFIGURED',503)):
                self.assertEqual(bridge.submit_event(home,event('53','tin ba'),spool),{'ok':False,'spooled':True})
            posted=[]
            def live(_home,payload,**kwargs):
                posted.append((kwargs,payload));return {'persisted':True}
            with patch.object(bridge,'call_backend',side_effect=live):
                self.assertEqual(bridge.submit_event(home,event('54','tin bốn'),spool),{'ok':True,'data':{'persisted':True}})
            self.assertEqual([(payload['context']['messageId'],payload['spooled']) for _,payload in posted],[('53',True),('54',False)])
            self.assertEqual({(kwargs['path'],kwargs['key_file']) for kwargs,_ in posted},{(bridge.INTAKE_PATH,'intake.json')})
            # A drain stops at the first transient failure and keeps the rest in order.
            spool.put(event('55','tin năm'));spool.put(event('56','tin sáu'))
            replayed=[]
            def flaky(payload):
                if replayed:raise urllib.error.URLError('down again')
                replayed.append(payload)
            self.assertEqual(spool.drain(flaky),1)
            self.assertEqual([line['event']['context']['messageId'] for line in spool_lines(home)],['56'])
            # Each line carries its first spooled time and the number of answers so far, around the event itself.
            (line,)=spool_lines(home)
            self.assertEqual((set(line),line['attempts']),({'firstSpooledAt','attempts','event'},0))
            self.assertRegex(line['firstSpooledAt'],ISO)
            # A full spool refuses loudly; nothing is dropped silently.
            line=json.dumps({'firstSpooledAt':bridge._now(),'attempts':0,'event':event('57','tin bảy')},ensure_ascii=False)
            path.write_text((line+'\n')*1000)
            with self.assertRaisesRegex(ValueError,'^SPOOL_FULL$'):spool.put(event('58','tin tám'))
            with patch.object(bridge,'call_backend',side_effect=urllib.error.URLError('down')):
                with self.assertRaisesRegex(ValueError,'^SPOOL_FULL$'):bridge.submit_event(home,event('59','tin chín'),spool)
            self.assertEqual(len(path.read_text().splitlines()),1000)

    def test_spool_and_journal_keep_unicode_line_separators_inside_one_line(self):
        # JSON leaves U+2028, U+2029 and U+0085 unescaped; splitting on them would cut one event into two broken lines.
        text='dòng một dòng hai dòng ba\u0085hết'
        with profile_home() as home:
            spool=bridge.Spool(home)
            spool.put(bridge.fit_event(take(tg_event(text))))
            self.assertEqual(spool.pending(),1)
            sent=[]
            self.assertEqual(spool.drain(sent.append),1)
            self.assertEqual(sent[0]['text'],text)
            journal=bridge.SendJournal(home)
            journal.sending(OUTBOX_A,1,LEASE_A)
            journal.queued({'outboxId':OUTBOX_A,'attemptNo':1,'leaseToken':LEASE_A,'phase':'send','outcome':'uncertain',
                            'errorCode':'SEND_TIMEOUT','reportedAt':'2026-11-14T01:00:00.000Z','note':text})
            view=bridge.SendJournal(home).view()
            self.assertFalse(view.damaged)
            self.assertEqual(view.pending()[0]['note'],text)

    def test_an_event_always_answered_500_is_dead_lettered_and_intake_continues(self):
        # Regression (gate 4, I-1): one event the backend always answers with 500 stopped all intake for good.
        self.assertEqual((bridge.SPOOL_MAX_ATTEMPTS,bridge.SPOOL_MAX_AGE),(5,timedelta(hours=24)))
        with profile_home() as home:
            spool=bridge.Spool(home)
            calls=[];delivered=[]
            def backend(_home,payload,**kwargs):
                calls.append(payload['context']['messageId'])
                if payload['context']['messageId']=='61':raise bridge.BackendError('INTERNAL_ERROR',500)
                delivered.append((payload['context']['messageId'],payload['spooled']));return {'persisted':True}
            with patch.object(bridge,'call_backend',side_effect=backend),self.assertLogs(bridge.LOG.name,level='DEBUG') as logs:
                # A is answered 500 live (attempt 1) and on each of the next three replays; B, C and D wait behind it.
                for number in (61,62,63,64):
                    self.assertEqual(bridge.submit_event(home,fitted(number,'tin A' if number==61 else 'tin khác'),spool),{'ok':False,'spooled':True})
                    self.assertEqual(spool_lines(home)[0]['attempts'],number-60)
                self.assertEqual(delivered,[])
                # The fifth answer moves A to the dead-letter file, and the drain continues with B, C, D and then E live.
                self.assertTrue(bridge.submit_event(home,fitted(65),spool)['ok'])
            self.assertEqual(calls,['61']*5+['62','63','64','65'])
            self.assertEqual(delivered,[('62',True),('63',True),('64',True),('65',False)])
            self.assertEqual(spool_lines(home),[])
            (dead,)=dead_lines(home)
            self.assertEqual((dead['reason'],dead['attempts'],dead['event']['context']['messageId'],dead['event']['text']),('INTAKE_RETRY_LIMIT',5,'61','tin A'))
            self.assertRegex(dead['deadAt'],ISO);self.assertRegex(dead['firstSpooledAt'],ISO)
            self.assertEqual(stat.S_IMODE((home/'runtime/libetech-ai-os/intake-dead.jsonl').stat().st_mode),0o600)
            self.assertIn(f'WARNING:{bridge.LOG.name}:libetech intake spool: INTAKE_DEAD_LETTER INTAKE_RETRY_LIMIT',logs.output)
            for record in logs.output:self.assertNotIn('tin A',record)

    def test_network_errors_keep_the_head_and_an_old_answered_line_is_dead_lettered(self):
        with profile_home() as home:
            spool=bridge.Spool(home)
            spool.put(fitted(71));spool.put(fitted(72))
            # No answer is not an answer: order is kept and nothing is counted, however often it happens.
            for error in [urllib.error.URLError('down'),bridge.BackendError('BRIDGE_UNAVAILABLE',0),ConnectionRefusedError(),TimeoutError()]*3:
                self.assertEqual(spool.drain(raising(error)),0)
            self.assertEqual([(line['event']['context']['messageId'],line['attempts']) for line in spool_lines(home)],[('71',0),('72',0)])
            # Lines older than 24 h still wait while the backend is unreachable...
            old=(datetime.now(timezone.utc)-timedelta(hours=25)).isoformat(timespec='milliseconds').replace('+00:00','Z')
            lines=spool_lines(home);lines[0]['firstSpooledAt']=old
            path=home/'runtime/libetech-ai-os/intake-spool.jsonl'
            path.write_text(''.join(json.dumps(line,ensure_ascii=False)+'\n' for line in lines))
            self.assertEqual(spool.drain(raising(urllib.error.URLError('down'))),0)
            self.assertEqual(dead_lines(home),[])
            # ...but once the backend answers one with a retryable status, it leaves the head at once.
            sent=[]
            def answer(payload):
                if payload['context']['messageId']=='71':raise bridge.BackendError('RATE_LIMITED',429)
                sent.append(payload['context']['messageId'])
            with self.assertLogs(bridge.LOG.name,level='DEBUG') as logs:
                self.assertEqual(spool.drain(answer),1)
            self.assertEqual(sent,['72'])
            self.assertEqual([(line['reason'],line['attempts']) for line in dead_lines(home)],[('INTAKE_TOO_OLD',1)])
            self.assertIn(f'WARNING:{bridge.LOG.name}:libetech intake spool: INTAKE_DEAD_LETTER INTAKE_TOO_OLD',logs.output)
            # An unreadable line is moved aside too, and the drain goes on.
            path.write_text('{"broken\n'+json.dumps({'firstSpooledAt':bridge._now(),'attempts':0,'event':fitted(73)})+'\n')
            os.chmod(path,0o600)
            sent.clear()
            with self.assertLogs(bridge.LOG.name,level='DEBUG'):
                self.assertEqual(spool.drain(answer),1)
            self.assertEqual(sent,['73'])
            self.assertEqual([(line['reason'],line.get('line')) for line in dead_lines(home)][1:],[('SPOOL_LINE_UNREADABLE','{"broken')])

    def test_nul_is_removed_from_the_sent_text_and_the_hash_is_of_the_original(self):
        original='mở\x00đầu\x00'
        payload=bridge.fit_event(take(tg_event(original)))
        self.assertEqual((payload['text'],payload['textTruncated']),('mởđầu',False))
        self.assertEqual(payload['contentHash'],hashlib.sha256(original.encode()).hexdigest())
        cut=bridge.fit_event(take(tg_event('\x00'+'\x01'*4096)))
        self.assertTrue(cut['textTruncated']);self.assertNotIn('\x00',cut['text'])
        self.assertLessEqual(len(encoded(cut)),bridge.MAX_EVENT_BYTES)

    def test_retry_classes_401_and_403_drop_and_408_429_404_5xx_spool(self):
        with profile_home() as home:
            spool=bridge.Spool(home)
            path=home/'runtime/libetech-ai-os/intake-spool.jsonl'
            for code,status in [('BRIDGE_AUTH_DENIED',401),('UNAUTHENTICATED',401),('SCOPE_DENIED',403),('INVALID_INPUT',422)]:
                with patch.object(bridge,'call_backend',side_effect=bridge.BackendError(code,status)):
                    self.assertEqual(bridge.submit_event(home,fitted(81),spool),{'ok':False,'error':code})
                self.assertEqual(spool.pending(),0)
            for status in (408,429,404,500,503):
                path.unlink(missing_ok=True)
                with patch.object(bridge,'call_backend',side_effect=bridge.BackendError('RATE_LIMITED',status)):
                    self.assertEqual(bridge.submit_event(home,fitted(82),spool),{'ok':False,'spooled':True},status)
                self.assertEqual([line['attempts'] for line in spool_lines(home)],[1],status)
            # A spooled line refused with 401 is dropped with its code, not retried and not dead-lettered.
            path.unlink();spool.put(fitted(83));spool.put(fitted(84))
            with self.assertLogs(bridge.LOG.name,level='DEBUG') as logs:
                self.assertEqual(spool.drain(raising(bridge.BackendError('BRIDGE_AUTH_DENIED',401))),0)
            self.assertEqual((spool_lines(home),dead_lines(home)),([],[]))
            self.assertEqual(logs.output,[f'WARNING:{bridge.LOG.name}:libetech intake spool dropped one event: BRIDGE_AUTH_DENIED']*2)
            # A missing intake key is not a reason to spool the message.
            os.unlink(home/'runtime/libetech-ai-os/intake.json')
            self.assertEqual(bridge.submit_event(home,fitted(85),spool),{'ok':False,'error':'BRIDGE_NOT_CONFIGURED'})
            self.assertEqual(spool.pending(),0)

    def test_templates_render_verbatim_and_unknown_is_refused(self):
        params={'ref':'IN-0A1B2C3D','observedAt':'2026-11-14T01:02:03.000Z'}
        texts=[bridge.render('intake.received',params),bridge.render('intake.recovered',params),
               bridge.render('intake.attachment_failed',params),
               bridge.render('account_approval.pending',{'approvalId':'00000000-0000-4000-8000-000000000001'})]
        self.assertEqual(texts,[RECEIVED,
            'Kết nối đã khôi phục. Tin lúc 2026-11-14T01:02:03.000Z đã được ghi nhận, mã IN-0A1B2C3D.',
            'Đã ghi nhận nội dung, mã IN-0A1B2C3D, nhưng chưa lưu được tệp đính kèm. Vui lòng gửi lại tệp.',
            DM_CARD])
        for text in texts:
            self.assertNotIn('hạn',text);self.assertNotIn('hoàn thành',text)
            self.assertIsNone(re.search(r'[0-9a-f]{8}-[0-9a-f]{4}',text))
        for template in ['intake.done','',None,['intake.received']]:
            with self.assertRaisesRegex(ValueError,'^TEMPLATE_UNKNOWN$'):bridge.render(template,params)
        for bad in [{},None,{'ref':'{observedAt}'},{'ref':'IN-0a1b2c3d'},{'ref':'IN-0A1B2C3D','observedAt':'hôm qua'}]:
            with self.assertRaisesRegex(ValueError,'^TEMPLATE_PARAMS_INVALID$'):bridge.render('intake.recovered',bad)

    def test_drain_outbox_reports_delivered_and_journals_before_sending(self):
        with profile_home(chats=[GROUP]) as home:
            journal=bridge.SendJournal(home)
            path=home/'runtime/libetech-ai-os/send-journal.jsonl'
            order=[]
            def states():return [json.loads(line)['state'] for line in path.read_text().splitlines()]
            def send(chat,topic,reply,text):
                order.append(('send',states()))
                self.assertEqual((chat,topic,reply,text),(GROUP,'7','41',RECEIVED))
                return 9001
            def report(receipts):
                order.append(('report',states()))
                return {'accepted':len(receipts),'replayed':0,'rejected':[]}
            backend=FakeBackend([{'deliveries':[delivery(OUTBOX_A,LEASE_A,attempt=2,topic='7')],'reconcile':[]}],report=report)
            with patch.object(bridge,'call_backend',side_effect=backend):
                summary=bridge.drain_outbox(home,send,journal)
            self.assertEqual(order,[('send',['sending']),('report',['sending','sent','receipt'])])
            self.assertEqual(backend.calls[0][:3],(bridge.PULL_PATH,'intake.json',{'limit':10}))
            (receipt,),=backend.reports
            self.assertRegex(receipt.pop('reportedAt'),ISO)
            self.assertEqual(receipt,{'outboxId':OUTBOX_A,'attemptNo':2,'leaseToken':LEASE_A,'phase':'send','outcome':'delivered','telegramMessageId':'9001'})
            self.assertEqual([line['state'] for line in journal_lines(home)],['sending','sent','receipt','reported'])
            self.assertEqual(journal_lines(home)[0]['leaseToken'],LEASE_A)
            self.assertEqual(stat.S_IMODE(path.stat().st_mode),0o600)
            self.assertTrue(summary['ok']);self.assertEqual((summary['delivered'],summary['reported'],summary['pending']),(1,1,0))
            # A DM card goes to the private chat with no topic or reply, and carries no ballot id.
            sent=[]
            dm=delivery(OUTBOX_B,LEASE_B,template='account_approval.pending',params={},audience='dm',chat=SENDER,topic='',reply=None)
            with patch.object(bridge,'call_backend',side_effect=FakeBackend([{'deliveries':[dm],'reconcile':[]}])):
                bridge.drain_outbox(home,lambda *args:(sent.append(args),9002)[1],journal,limit=1)
            self.assertEqual(sent,[(SENDER,None,None,DM_CARD)])
            for limit in (0,11,True,'5'):
                with self.assertRaisesRegex(ValueError,'^INVALID_LIMIT$'):bridge.drain_outbox(home,Mock(),journal,limit=limit)

    def test_drain_refuses_a_group_target_outside_the_gateway_allowlist(self):
        # Sec M5, defence in depth: a group target comes from the backend; one outside intake.json "chats" is never sent.
        other='-1000000000002'
        with profile_home(chats=[GROUP]) as home:
            journal=bridge.SendJournal(home)
            sent=[]
            backend=FakeBackend([{'deliveries':[delivery(OUTBOX_A,LEASE_A),delivery(OUTBOX_B,LEASE_B,chat=other),
                                                 delivery(OUTBOX_C,LEASE_C,template='account_approval.pending',params={},audience='dm',chat=SENDER,topic='',reply=None)],
                                  'reconcile':[]}])
            with patch.object(bridge,'call_backend',side_effect=backend):
                summary=bridge.drain_outbox(home,lambda *args:(sent.append(args[0]),9003)[1],journal)
            self.assertEqual(sent,[GROUP,SENDER])
            self.assertEqual([(r['outboxId'],r['outcome'],r.get('errorCode')) for r in backend.reports[0]],
                             [(OUTBOX_A,'delivered',None),(OUTBOX_B,'failed_permanent','TARGET_NOT_ALLOWED'),(OUTBOX_C,'delivered',None)])
            self.assertNotIn(('sending',OUTBOX_B),{(line['state'],line['outboxId']) for line in journal_lines(home)})
            self.assertEqual((summary['delivered'],summary['failed']),(2,1))
        # No "chats" in intake.json: no group target at all.
        with profile_home() as home:
            never=Mock()
            backend=FakeBackend([{'deliveries':[delivery(OUTBOX_A,LEASE_A)],'reconcile':[]}])
            with patch.object(bridge,'call_backend',side_effect=backend):
                bridge.drain_outbox(home,never,bridge.SendJournal(home))
            never.assert_not_called()
            self.assertEqual([(r['outcome'],r['errorCode']) for r in backend.reports[0]],[('failed_permanent','TARGET_NOT_ALLOWED')])

    def test_send_timeout_is_uncertain_and_permission_error_is_permanent(self):
        with profile_home(chats=[GROUP]) as home:
            journal=bridge.SendJournal(home)
            failures=iter([TimeoutError(),PermissionError('bot was blocked by the user '+GROUP),ConnectionRefusedError()])
            calls=[]
            def send(chat,topic,reply,text):
                calls.append(chat);raise next(failures)
            backend=FakeBackend([{'deliveries':[delivery(OUTBOX_A,LEASE_A),delivery(OUTBOX_B,LEASE_B),delivery(OUTBOX_C,LEASE_C)],'reconcile':[]}])
            with patch.object(bridge,'call_backend',side_effect=backend):
                summary=bridge.drain_outbox(home,send,journal)
                self.assertEqual(len(calls),3)
                self.assertEqual([(r['outboxId'],r['phase'],r['outcome'],r.get('errorCode')) for r in backend.reports[0]],
                                 [(OUTBOX_A,'send','uncertain','SEND_TIMEOUT'),(OUTBOX_B,'send','failed_permanent','SEND_FORBIDDEN'),
                                  (OUTBOX_C,'send','failed_retryable','SEND_UNREACHABLE')])
                self.assertTrue(all('telegramMessageId' not in r for r in backend.reports[0]))
                self.assertEqual((summary['uncertain'],summary['failed']),(1,2))
                # A second pass that leases nothing sends nothing again.
                bridge.drain_outbox(home,send,journal)
                self.assertEqual(len(calls),3)
            stored=(home/'runtime/libetech-ai-os/send-journal.jsonl').read_text()
            self.assertNotIn('blocked',stored);self.assertNotIn(GROUP,stored)
            rejected=FakeBackend([{'deliveries':[delivery(OUTBOX_A,LEASE_A,attempt=2)],'reconcile':[]}])
            with patch.object(bridge,'call_backend',side_effect=rejected):
                bridge.drain_outbox(home,raising(bridge.SendRejected('BOT_REMOVED')),journal)
            self.assertEqual([(r['outcome'],r['errorCode']) for r in rejected.reports[0]],[('failed_permanent','BOT_REMOVED')])
            # Nothing reaches send when the template is unknown: a permanent failure without a 'sending' line.
            unknown=FakeBackend([{'deliveries':[delivery(OUTBOX_B,LEASE_B,attempt=2,template='intake.done')],'reconcile':[]}])
            never=Mock()
            with patch.object(bridge,'call_backend',side_effect=unknown):
                bridge.drain_outbox(home,never,journal)
            never.assert_not_called()
            self.assertEqual([(r['outcome'],r['errorCode']) for r in unknown.reports[0]],[('failed_permanent','TEMPLATE_UNKNOWN')])
            self.assertNotIn(('sending',OUTBOX_B,2),{(line['state'],line['outboxId'],line['attemptNo']) for line in journal_lines(home)})

    def test_reconcile_uses_the_journal_and_never_guesses(self):
        with profile_home() as home:
            journal=bridge.SendJournal(home)
            journal.sending(OUTBOX_A,3,LEASE_A);journal.sent(OUTBOX_A,3,'777')
            journal.sending(OUTBOX_B,1,LEASE_B)
            backend=FakeBackend([{'deliveries':[],'reconcile':[{'outboxId':OUTBOX_A,'attemptNo':3},{'outboxId':OUTBOX_B,'attemptNo':1},
                                                               {'outboxId':OUTBOX_C,'attemptNo':2}]}])
            send=Mock()
            with patch.object(bridge,'call_backend',side_effect=backend):
                summary=bridge.drain_outbox(home,send,journal)
            send.assert_not_called()
            self.assertEqual([(r['outboxId'],r['attemptNo'],r['leaseToken'],r['phase'],r['outcome'],r.get('telegramMessageId')) for r in backend.reports[0]],
                             [(OUTBOX_A,3,LEASE_A,'reconcile','delivered','777'),(OUTBOX_C,2,NIL,'reconcile','not_sent',None)])
            self.assertEqual((summary['reconciled'],summary['held']),(2,1))
        with profile_home() as home:
            # A damaged journal can hide a 'sending' line, so it never claims "not sent".
            path=home/'runtime/libetech-ai-os/send-journal.jsonl'
            path.write_text('{"state":"sending","outbo\n');os.chmod(path,0o600)
            backend=FakeBackend([{'deliveries':[],'reconcile':[{'outboxId':OUTBOX_C,'attemptNo':2}]}])
            with patch.object(bridge,'call_backend',side_effect=backend):
                summary=bridge.drain_outbox(home,Mock(),bridge.SendJournal(home))
            self.assertEqual(backend.reports,[]);self.assertEqual(summary['held'],1)

    def test_rejected_receipts_are_not_resubmitted(self):
        with profile_home(chats=[GROUP]) as home:
            journal=bridge.SendJournal(home)
            # Pass 1: the receipt is lost in transit, so it stays pending in the journal.
            lost=FakeBackend([{'deliveries':[delivery(OUTBOX_A,LEASE_A)],'reconcile':[]}],report=raising(urllib.error.URLError('down')))
            with patch.object(bridge,'call_backend',side_effect=lost):
                self.assertEqual(bridge.drain_outbox(home,lambda *args:501,journal)['pending'],1)
            # Pass 2: it is resubmitted once and the server rejects it.
            refuse=lambda code:lambda receipts:{'accepted':0,'replayed':0,'rejected':[{'outboxId':r['outboxId'],'attemptNo':r['attemptNo'],'code':code} for r in receipts]}
            second=FakeBackend(report=refuse('LEASE_INVALID'))
            with patch.object(bridge,'call_backend',side_effect=second):
                summary=bridge.drain_outbox(home,Mock(),journal)
            self.assertEqual([(r['outboxId'],r['phase'],r['outcome']) for r in second.reports[0]],[(OUTBOX_A,'send','delivered')])
            self.assertEqual(second.reports[0][0],lost.reports[0][0])
            self.assertEqual((summary['rejected'],summary['pending']),(1,0))
            # Pass 3: nothing pending is resubmitted; the reconcile phase is a new receipt, and its refusal is final too.
            third=FakeBackend([{'deliveries':[],'reconcile':[{'outboxId':OUTBOX_A,'attemptNo':1}]}],report=refuse('RECEIPT_CONFLICT'))
            with patch.object(bridge,'call_backend',side_effect=third):
                bridge.drain_outbox(home,Mock(),journal)
            self.assertEqual([(r['phase'],r['outcome'],r['telegramMessageId']) for batch in third.reports for r in batch],[('reconcile','delivered','501')])
            # Pass 4: the same reconcile request again is not answered twice.
            fourth=FakeBackend([{'deliveries':[],'reconcile':[{'outboxId':OUTBOX_A,'attemptNo':1}]}])
            with patch.object(bridge,'call_backend',side_effect=fourth):
                summary=bridge.drain_outbox(home,Mock(),journal)
            self.assertEqual(fourth.reports,[]);self.assertEqual(summary['pending'],0)
            self.assertEqual([(line['phase'],line['code']) for line in journal_lines(home) if line['state']=='rejected'],
                             [('send','LEASE_INVALID'),('reconcile','RECEIPT_CONFLICT')])
            # A batch refused as a whole is split, and only the bad receipt is journaled as rejected.
            def strict(receipts):
                if len(receipts)>1 or receipts[0]['outboxId']==OUTBOX_C:raise bridge.BackendError('INVALID_INPUT',422)
                return {'accepted':1,'replayed':0,'rejected':[]}
            batch=FakeBackend([{'deliveries':[delivery(OUTBOX_B,LEASE_B),delivery(OUTBOX_C,LEASE_C)],'reconcile':[]}],report=strict)
            with patch.object(bridge,'call_backend',side_effect=batch):
                bridge.drain_outbox(home,lambda *args:502,journal)
            closed={(line['outboxId'],line['state'],line.get('code')) for line in journal_lines(home) if line['state'] in ('reported','rejected')}
            self.assertIn((OUTBOX_B,'reported',None),closed);self.assertIn((OUTBOX_C,'rejected','INVALID_INPUT'),closed)
            after=FakeBackend()
            with patch.object(bridge,'call_backend',side_effect=after):
                bridge.drain_outbox(home,Mock(),journal)
            self.assertEqual(after.reports,[])

    def test_access_change_card_shows_current_and_proposed_grants_without_ids(self):
        row=access_row()
        question=bridge.approval_question(row)
        self.assertEqual(question,'Đổi quyền cho Người mẫu Hai (nguoimau2)?\n'
                                  'Quyền hiện tại: Dự án mẫu A (Chỉ đọc)\n'
                                  'Quyền sau khi đổi: Dự án mẫu A (Thực hiện) + Xem điểm nhân sự; Dự án mẫu B (Chỉ đọc)\n'
                                  'Căn cứ: Bổ sung việc nghiệm thu\nChọn Yes hoặc No.')
        for hidden in [row['id'],'50000000-0000-4000-8000-000000000001','50000000']:self.assertNotIn(hidden,question)
        self.assertTrue(bridge.approval_question(access_row(id='00000000-0000-4000-8000-0000000000c2',kind='registration',previous_grant_details=None)).startswith('Cấp tài khoản cho'))
        questions=[];requests=[]
        registered,_=register_with(Path('/tmp/hermes-probe'),ask_choice=lambda question,choices:(questions.append(question),'yes')[1])
        review=next(kwargs['handler'] for name,kwargs in registered if name=='duyet')
        def backend(_home,payload):
            requests.append(payload)
            return [row] if payload['operation']=='account_approval_pending' else {'state':'pending'}
        with patch.object(bridge,'call_backend',side_effect=backend):
            self.assertIn('YES',review('',source=SimpleNamespace(**DM)))
        self.assertEqual(questions,[question])
        self.assertEqual([(r['operation'],r.get('approvalId'),r.get('choice')) for r in requests],
                         [('account_approval_pending',None,None),('account_approval_vote',row['id'],'agree')])

    def test_review_copy_names_what_was_not_applied_for_each_ballot_kind(self):
        # code m-9: an access-change vote is never answered with "no invitation was issued"; the empty list is kind-neutral.
        registration=access_row(id='00000000-0000-4000-8000-0000000000c2',kind='registration',previous_grant_details=None,name='Người mẫu Ba')
        cases=[([],'Không có phiếu cần xác nhận.'),
               ([access_row()],'. Chưa tự áp quyền mới.'),
               ([registration],'. Chưa tự cấp lời mời.'),
               ([access_row(),registration],'. Chưa tự áp quyền mới hay cấp lời mời nào.')]
        for rows,ending in cases:
            registered,_=register_with(Path('/tmp/hermes-probe'),ask_choice=lambda question,choices:'yes')
            review=next(kwargs['handler'] for name,kwargs in registered if name=='duyet')
            def backend(_home,payload,rows=rows):
                return rows if payload['operation']=='account_approval_pending' else {'state':'pending'}
            with patch.object(bridge,'call_backend',side_effect=backend):
                answer=review('',source=SimpleNamespace(**DM))
            self.assertTrue(answer.endswith(ending),(answer,ending))
            if any(row.get('kind')=='access_change' for row in rows) and len(rows)==1:
                self.assertNotIn('lời mời',answer)

    def test_unknown_ballot_kind_never_asks(self):
        for kind in ['role_swap','','ACCESS_CHANGE',None,['access_change']]:
            with self.assertRaisesRegex(ValueError,'^APPROVAL_INVALID$'):bridge.approval_question(access_row(kind=kind))
        # A registration card never carries a previous grant set; a row that does is inconsistent.
        with self.assertRaisesRegex(ValueError,'^APPROVAL_INVALID$'):bridge.approval_question(access_row(kind='registration'))
        missing=access_row();del missing['previous_grant_details']
        for row in [missing,access_row(previous_grant_details=None),access_row(previous_grant_details=[]),
                    access_row(previous_grant_details=[{'name':'Dự án mẫu A','role':'owner','reportPermissions':[]}]),
                    access_row(grant_details=access_row()['grant_details'][:1])]:
            with self.assertRaisesRegex(ValueError,'^APPROVAL_SCOPE_UNAVAILABLE$'):bridge.approval_question(row)
        for row,code in [(access_row(kind='role_swap'),'APPROVAL_INVALID'),(access_row(previous_grant_details=None),'APPROVAL_SCOPE_UNAVAILABLE')]:
            asked=[];requests=[]
            registered,_=register_with(Path('/tmp/hermes-probe'),ask_choice=lambda question,choices:(asked.append(question),'yes')[1])
            review=next(kwargs['handler'] for name,kwargs in registered if name=='duyet')
            with patch.object(bridge,'call_backend',side_effect=lambda _home,payload:(requests.append(payload),[row])[1]):
                self.assertEqual(review('',source=SimpleNamespace(**DM)),code)
            self.assertEqual(asked,[])
            self.assertEqual([r['operation'] for r in requests],['account_approval_pending'])

    def test_group_old_card_and_cancel_record_no_vote(self):
        row=access_row()
        def review_with(answer):
            registered,_=register_with(Path('/tmp/hermes-probe'),ask_choice=lambda _question,_choices:answer)
            return next(kwargs['handler'] for name,kwargs in registered if name=='duyet')
        requests=[]
        with patch.object(bridge,'call_backend',side_effect=lambda _home,payload:(requests.append(payload),[row])[1]):
            self.assertEqual(review_with('yes')('',source=SimpleNamespace(**DM|dict(chat_id=GROUP,chat_type='group'))),'PRIVATE_CHAT_REQUIRED')
            self.assertEqual(requests,[])
        def closed(_home,payload):
            requests.append(payload)
            if payload['operation']=='account_approval_vote':raise ValueError('APPROVAL_CLOSED')
            return [row]
        with patch.object(bridge,'call_backend',side_effect=closed):
            result=review_with('yes')('',source=SimpleNamespace(**DM))
        self.assertEqual(result,'APPROVAL_CLOSED');self.assertNotIn('Đã ghi',result)
        requests.clear()
        with patch.object(bridge,'call_backend',side_effect=lambda _home,payload:(requests.append(payload),[row])[1]):
            self.assertIn('Đã dừng',review_with(None)('',source=SimpleNamespace(**DM)))
        self.assertEqual([r['operation'] for r in requests],['account_approval_pending'])

    def test_registration_without_hook_support_or_intake_key_stays_at_seven(self):
        with profile_home(intake=False) as home:
            registered,hooks=register_with(home,register_hook=True)
            self.assertEqual((len(registered),hooks),(7,[]))
        # The key file alone is not enough: the hook is a deliberate step, "hookEnabled": true in intake.json.
        with profile_home() as home:
            registered,hooks=register_with(home,register_hook=True)
            self.assertEqual((len(registered),hooks),(7,[]))
        for fields,logged in [(dict(hookEnabled=False,chats=[GROUP]),[]),(dict(hookEnabled='true',chats=[GROUP]),['INTAKE_CONFIG_INVALID']),
                              (dict(hookEnabled=1),['INTAKE_CONFIG_INVALID']),(dict(hookEnable=True),['INTAKE_CONFIG_INVALID'])]:
            with profile_home(**fields) as home,self.assertLogs(bridge.LOG.name,level='DEBUG') as logs:
                bridge.LOG.debug('probe')
                registered,hooks=register_with(home,register_hook=True)
            self.assertEqual((len(registered),hooks),(7,[]),fields)
            self.assertEqual([record.split(': ')[-1] for record in logs.output[1:]],logged,fields)
        with profile_home(**HOOK_ON) as home:
            registered,hooks=register_with(home)
            self.assertEqual((len(registered),hooks),(7,[]))
            registered,hooks=register_with(home,register_hook=True)
            self.assertEqual(len(registered),7)
            self.assertEqual([name for name,_ in hooks],[bridge.INTAKE_HOOK])
        registered,hooks=register_with(Path('/tmp/hermes-probe'),register_hook=True)
        self.assertEqual((len(registered),hooks),(7,[]))

    def test_hook_returns_none_and_never_raises(self):
        text='Nhờ Người mẫu Ba xem lỗi đăng nhập'
        with profile_home(**HOOK_ON) as home:
            hook=hook_of(home)
            event=tg_event(text,source=dict(user_name='Người mẫu Ba'))
            with self.assertLogs(bridge.LOG.name,level='DEBUG') as logs,patch.object(bridge,'submit_event',side_effect=RuntimeError(text+' '+GROUP)):
                self.assertIsNone(hook(event=event))
                self.assertIsNone(hook(event))
            for record in logs.output:
                for hidden in (text,GROUP,SENDER,'Người mẫu Ba'):self.assertNotIn(hidden,record)
            posted=[]
            def live(_home,payload,**kwargs):
                posted.append((kwargs,payload));return {'persisted':True}
            backend=Mock(side_effect=live)
            with patch.object(bridge,'call_backend',backend):
                for args,kwargs in [((),{}),((None,),{}),((object(),),{}),((),{'event':object(),'gateway':object()}),((),{'event':tg_event(source=dict(chat_type='private',chat_id=SENDER))})]:
                    self.assertIsNone(hook(*args,**kwargs))
                backend.assert_not_called()
                # A malformed optional field no longer loses the message: it is posted without that field.
                with self.assertLogs(bridge.LOG.name,level='DEBUG') as logs:
                    self.assertIsNone(hook(event=tg_event(edited_at='yesterday')))
                self.assertTrue(any('INTAKE_FIELD_DROPPED editedAt' in record for record in logs.output))
                self.assertNotIn('editedAt',posted.pop()[1])
                attached=tg_event(text,attachment={'mime_type':'application/pdf','file_size':10,'file_name':'bao-cao.pdf'},download_attachment=None)
                self.assertIsNone(hook(event=tg_event(text)))
                self.assertIsNone(hook(event=attached))
                # `home` is positional-only in the hook, so a gateway keyword with that name cannot collide with it.
                self.assertIsNone(hook(event=tg_event(text,source=dict(message_id='42')),home='/elsewhere',profile_home='/elsewhere'))
            self.assertEqual([(kwargs['path'],kwargs['key_file']) for kwargs,_ in posted],[(bridge.INTAKE_PATH,'intake.json')]*3)
            self.assertEqual(posted[0][1]['context']['chatId'],GROUP)
            self.assertNotIn('attachment',posted[0][1])
            self.assertEqual({key:posted[1][1]['attachment'][key] for key in ('state','reasonCode')},{'state':'failed','reasonCode':'DOWNLOAD_UNAVAILABLE'})
            self.assertEqual(posted[2][1]['context']['messageId'],'42')
            with patch.object(bridge,'call_backend',side_effect=urllib.error.URLError('down')),self.assertLogs(bridge.LOG.name,level='DEBUG'):
                self.assertIsNone(hook(event=tg_event(text,source=dict(message_id='77'))))
            self.assertEqual(len((home/'runtime/libetech-ai-os/intake-spool.jsonl').read_text().splitlines()),1)

    def test_hook_does_nothing_when_intake_json_is_missing_malformed_or_switched_off(self):
        with profile_home(**HOOK_ON) as home:
            hook=hook_of(home)
            runtime=home/'runtime/libetech-ai-os';key=runtime/'intake.json'
            backend=Mock(return_value={'persisted':True})
            cases=[(None,'BRIDGE_NOT_CONFIGURED'),('not json','BRIDGE_NOT_CONFIGURED'),('[]','BRIDGE_NOT_CONFIGURED'),
                   (json.dumps({'hookEnabled':True,'chats':[GROUP]}),'BRIDGE_NOT_CONFIGURED'),
                   (json.dumps({'key':'short','hookEnabled':True,'chats':[GROUP]}),'BRIDGE_NOT_CONFIGURED'),
                   (json.dumps({'key':INTAKE_KEY,'hookEnabled':True,'chats':[int(GROUP)]}),'INTAKE_CONFIG_INVALID'),
                   (json.dumps({'key':INTAKE_KEY,'hookEnabled':True,'chats':GROUP}),'INTAKE_CONFIG_INVALID'),
                   (json.dumps({'key':INTAKE_KEY,'hookEnabled':'yes','chats':[GROUP]}),'INTAKE_CONFIG_INVALID')]
            for content,code in cases:
                key.unlink(missing_ok=True)
                if content is not None:
                    key.write_text(content);os.chmod(key,0o600)
                with patch.object(bridge,'call_backend',backend),self.assertLogs(bridge.LOG.name,level='DEBUG') as logs:
                    self.assertIsNone(hook(event=tg_event()))
                self.assertEqual(logs.output,[f'WARNING:{bridge.LOG.name}:libetech intake: {code}'],content)
                backend.assert_not_called()
                self.assertFalse((runtime/'intake-spool.jsonl').exists(),content)
            # Unsafe permissions are refused before the key is read.
            key.write_text(json.dumps({'key':INTAKE_KEY}|HOOK_ON));os.chmod(key,0o644)
            with patch.object(bridge,'call_backend',backend),self.assertLogs(bridge.LOG.name,level='DEBUG') as logs:
                self.assertIsNone(hook(event=tg_event()))
            self.assertEqual(logs.output,[f'WARNING:{bridge.LOG.name}:libetech intake: BRIDGE_CONFIG_PERMISSIONS'])
            # The signed call refuses a malformed key file as unconfigured too, before any network use.
            key.write_text('not json');os.chmod(key,0o600)
            with patch.object(bridge.urllib.request,'build_opener') as build:
                with self.assertRaisesRegex(ValueError,'^BRIDGE_NOT_CONFIGURED$'):
                    bridge.call_backend(home,{},path=bridge.INTAKE_PATH,key_file='intake.json')
                build.assert_not_called()
            # Switched off after registration: read on each call, so nothing happens and nothing is logged.
            key.write_text(json.dumps({'key':INTAKE_KEY,'hookEnabled':False,'chats':[GROUP]}));os.chmod(key,0o600)
            with patch.object(bridge,'call_backend',backend):
                self.assertIsNone(hook(event=tg_event()))
            backend.assert_not_called()
            self.assertFalse((runtime/'intake-spool.jsonl').exists())

    def test_a_chat_outside_the_intake_allowlist_is_never_downloaded_spooled_or_posted(self):
        other='-1000000000002'
        with profile_home(**HOOK_ON) as home:
            hook=hook_of(home)
            runtime=home/'runtime/libetech-ai-os'
            bridge.Spool(home).put(fitted(91))
            before=(runtime/'intake-spool.jsonl').read_bytes()
            download=Mock(return_value=b'%PDF-1.4 synthetic')
            backend=Mock(return_value={'persisted':True})
            attached=dict(attachment={'mime_type':'application/pdf','file_size':18,'file_name':'a.pdf'},download_attachment=download)
            with patch.object(bridge,'call_backend',backend):
                self.assertIsNone(hook(event=tg_event(source=dict(chat_id=other),**attached)))
                self.assertIsNone(hook(event=tg_event(source=dict(chat_id=other))))
            download.assert_not_called();backend.assert_not_called()
            self.assertEqual((runtime/'intake-spool.jsonl').read_bytes(),before)
            self.assertFalse((runtime/'attachments').exists())
            self.assertIsNone(bridge.intake_event(tg_event(source=dict(chat_id=other)),chats=[GROUP]))
            self.assertEqual(bridge.intake_event(tg_event(),chats=[GROUP])['context']['chatId'],GROUP)
        # Without a "chats" list no chat is taken at all: the gateway side fails closed.
        with profile_home(hookEnabled=True) as home:
            hook=hook_of(home)
            backend=Mock(return_value={'persisted':True})
            with patch.object(bridge,'call_backend',backend):
                self.assertIsNone(hook(event=tg_event()))
            backend.assert_not_called()
            self.assertFalse((home/'runtime/libetech-ai-os/intake-spool.jsonl').exists())
            self.assertIsNone(bridge.intake_event(tg_event(),chats=[]))

    def test_intake_event_without_an_allowlist_fails_closed(self):
        # T11: no chats argument (or None) means no allowlist was read, so nothing is taken; it is never permissive.
        self.assertIsNone(bridge.intake_event(tg_event()))
        self.assertIsNone(bridge.intake_event(tg_event(),chats=None))
        self.assertIsNone(bridge.intake_event(tg_event(),None))
        self.assertIsNone(bridge.intake_event(tg_event(),chats=frozenset()))
        self.assertEqual(bridge.intake_event(tg_event(),chats=frozenset([GROUP]))['context']['chatId'],GROUP)

    def test_plugin_commands_and_empty_messages_never_reach_intake(self):
        code='Q'*43
        with profile_home(**HOOK_ON) as home:
            hook=hook_of(home)
            backend=Mock(return_value={'persisted':True});download=Mock(return_value=b'%PDF-1.4 synthetic')
            commands=['/libetech-link '+code,'  /LIBETECH-LINK@libetech_bot '+code,'/libetech_link\n'+code,'/libetech-check LBRC014 '+'a'*40,
                      '/libetech-access-approve '+code,'/libetech','/duyet','/duyet@libetech_bot','/Duyet '+code]
            with patch.object(bridge,'call_backend',backend),self.assertLogs(bridge.LOG.name,level='DEBUG') as logs:
                bridge.LOG.debug('probe')
                for text in commands:
                    self.assertIsNone(take(tg_event(text)),text)
                    self.assertIsNone(hook(event=tg_event(text,attachment={'mime_type':'application/pdf','file_size':18},download_attachment=download)))
                for text in ['','   \n\t',None,123]:
                    self.assertIsNone(take(tg_event(text)),text)
                    self.assertIsNone(hook(event=tg_event(text)))
            backend.assert_not_called();download.assert_not_called()
            self.assertFalse((home/'runtime/libetech-ai-os/intake-spool.jsonl').exists())
            for record in logs.output:self.assertNotIn(code,record)
            # A file without a caption is still a message; text that only looks like our commands is not ours.
            self.assertEqual(take(tg_event('',attachment={'mime_type':'application/pdf'}))['text'],'')
            for text in ['/duyetlai','/libetechx','xem /libetech-link giúp','/start']:
                self.assertIsNotNone(take(tg_event(text)),text)

    def test_hook_work_is_bounded_per_call(self):
        self.assertEqual((bridge.HOOK_TIMEOUT,bridge.HOOK_REPLAYS),(2,5))
        with profile_home(**HOOK_ON) as home:
            hook=hook_of(home)
            spool=bridge.Spool(home)
            for number in range(100,120):spool.put(fitted(number))
            calls=[];per_hook=[]
            def live(_home,payload,**kwargs):
                calls.append((kwargs['timeout'],payload['context']['messageId'],payload['spooled']));return {'persisted':True}
            with patch.object(bridge,'call_backend',side_effect=live):
                for number in range(200,205):
                    count=len(calls)
                    self.assertIsNone(hook(event=tg_event(source=dict(message_id=str(number)))))
                    per_hook.append(len(calls)-count)
            # A 20-line spool: five replays per message, the new one queued behind them, until it is empty.
            self.assertEqual(per_hook,[5,5,5,5,5])
            self.assertTrue(all(count<=6 for count in per_hook))
            self.assertEqual({timeout for timeout,_,_ in calls},{2})
            self.assertEqual([number for _,number,_ in calls],[str(n) for n in range(100,120)]+[str(n) for n in range(200,205)])
            self.assertEqual([spooled for _,number,spooled in calls if number=='204'],[False])
            self.assertEqual(spool.pending(),0)
            # Through the real signed call: a hook POST waits 2 s, any other call keeps 5 s.
            class Recorder(FakeOpener):
                def open(self,request,timeout):
                    self.requests.append(timeout);return FakeResponse(b'{"data":{"persisted":true},"error":null}')
            opener=Recorder()
            with patch.object(bridge.urllib.request,'build_opener',return_value=opener):
                self.assertIsNone(hook(event=tg_event(source=dict(message_id='300'))))
                bridge.call_backend(home,{'limit':1},path=bridge.PULL_PATH,key_file='intake.json')
            self.assertEqual(opener.requests,[2,5])

    def test_a_busy_spool_lock_is_given_up_quickly_with_spool_busy(self):
        self.assertEqual(bridge.SPOOL_LOCK_SECONDS,1.0)
        with profile_home(**HOOK_ON) as home:
            hook=hook_of(home)
            spool=bridge.Spool(home)
            descriptor=os.open(home/'runtime/libetech-ai-os/intake-spool.lock',os.O_RDWR|os.O_CREAT,0o600)
            try:
                fcntl.flock(descriptor,fcntl.LOCK_EX)
                started=time.monotonic()
                with self.assertRaisesRegex(ValueError,'^SPOOL_BUSY$'):spool.put(fitted(95))
                self.assertLess(time.monotonic()-started,2)
                with patch.object(bridge,'call_backend',side_effect=urllib.error.URLError('down')),self.assertLogs(bridge.LOG.name,level='DEBUG') as logs:
                    started=time.monotonic()
                    self.assertIsNone(hook(event=tg_event(source=dict(message_id='96'))))
                    elapsed=time.monotonic()-started
                self.assertTrue(0.5<elapsed<2,elapsed)
                self.assertEqual(logs.output,[f'WARNING:{bridge.LOG.name}:libetech intake: SPOOL_BUSY'])
            finally:
                os.close(descriptor)
            # The message was lost (a documented limit); the lock is usable again once released.
            self.assertEqual(spool.pending(),0)
            spool.put(fitted(97))
            self.assertEqual(spool.pending(),1)

    def test_an_existing_attachment_folder_must_be_owner_only_and_a_racing_create_is_fine(self):
        data=b'%PDF-1.4 synthetic test file'
        raw={'mime_type':'application/pdf','file_size':len(data)}
        with profile_home() as home:
            folder=home/'runtime/libetech-ai-os/attachments'
            folder.mkdir(mode=0o700);os.chmod(folder,0o755)
            self.assertEqual(bridge.store_attachment(home,raw,lambda:data)['reasonCode'],'STORE_UNAVAILABLE')
            self.assertEqual(list(folder.iterdir()),[])
            os.chmod(folder,0o700)
            self.assertEqual(bridge.store_attachment(home,raw,lambda:data)['state'],'stored')
        with profile_home() as home:
            # Another hook creates the folder between our look and our mkdir: still stored, not STORE_UNAVAILABLE.
            folder=home/'runtime/libetech-ai-os/attachments'
            real=os.mkdir
            def racing(path,mode=0o777,*args,**kwargs):
                if Path(path)==folder and not folder.exists():real(path,0o700)
                return real(path,mode,*args,**kwargs)
            with patch('os.mkdir',racing):
                self.assertEqual(bridge.store_attachment(home,raw,lambda:data)['state'],'stored')
        with profile_home() as home:
            (home/'runtime/libetech-ai-os/attachments').write_text('not a folder')
            self.assertEqual(bridge.store_attachment(home,raw,lambda:data)['reasonCode'],'STORE_UNAVAILABLE')

class ReceiptAnswerTests(unittest.TestCase):
    """Codex P1: a 2xx receipt answer closes receipts only when its counts account for every receipt of the batch."""
    def drain(self,home,journal,answer,deliveries=()):
        backend=FakeBackend([{'deliveries':list(deliveries),'reconcile':[]}],report=answer)
        with patch.object(bridge,'call_backend',side_effect=backend):
            summary=bridge.drain_outbox(home,lambda *args:601,journal)
        return summary,backend

    def closed(self,home):
        return [(line['outboxId'],line['state'],line.get('code')) for line in journal_lines(home) if line['state'] in ('reported','rejected')]

    def assert_invalid_and_pending(self,answer,deliveries):
        with profile_home(chats=[GROUP]) as home:
            journal=bridge.SendJournal(home)
            summary,backend=self.drain(home,journal,answer,deliveries)
            self.assertEqual(len(backend.reports),1)
            self.assertFalse(summary['ok']);self.assertEqual(summary['error'],'RECEIPT_RESPONSE_INVALID')
            self.assertEqual((summary['reported'],summary['rejected'],summary['pending']),(0,0,len(deliveries)))
            self.assertEqual(self.closed(home),[])
            # the next pass resubmits the same receipts and closes them once the answer adds up
            summary,backend=self.drain(home,journal,lambda receipts:{'accepted':len(receipts),'replayed':0,'rejected':[]})
            self.assertEqual([r['outboxId'] for r in backend.reports[0]],[d['outboxId'] for d in deliveries])
            self.assertTrue(summary['ok']);self.assertEqual((summary['reported'],summary['pending']),(len(deliveries),0))

    def test_an_answer_that_accepts_nothing_closes_nothing(self):
        self.assert_invalid_and_pending(lambda receipts:{'accepted':0,'replayed':0,'rejected':[]},[delivery(OUTBOX_A,LEASE_A)])

    def test_a_refusal_naming_a_receipt_outside_the_batch_is_invalid(self):
        outside={'outboxId':OUTBOX_C,'attemptNo':1,'code':'LEASE_INVALID'}
        self.assert_invalid_and_pending(lambda receipts:{'accepted':0,'replayed':0,'rejected':[outside]},[delivery(OUTBOX_A,LEASE_A)])
        wrong_attempt={'outboxId':OUTBOX_A,'attemptNo':2,'code':'LEASE_INVALID'}
        self.assert_invalid_and_pending(lambda receipts:{'accepted':0,'replayed':0,'rejected':[wrong_attempt]},[delivery(OUTBOX_A,LEASE_A)])

    def test_the_same_refusal_twice_does_not_stand_for_two_receipts(self):
        twice={'outboxId':OUTBOX_A,'attemptNo':1,'code':'LEASE_INVALID'}
        self.assert_invalid_and_pending(lambda receipts:{'accepted':0,'replayed':0,'rejected':[twice,twice]},
                                        [delivery(OUTBOX_A,LEASE_A),delivery(OUTBOX_B,LEASE_B)])

    def test_counts_must_be_non_negative_integers_and_add_up(self):
        for accepted,replayed in ((True,0),(0,True),(-1,2),('1',0),(1.0,0),(None,1),(2,0),(1,1)):
            with self.subTest(accepted=accepted,replayed=replayed):
                self.assert_invalid_and_pending(lambda receipts,a=accepted,r=replayed:{'accepted':a,'replayed':r,'rejected':[]},[delivery(OUTBOX_A,LEASE_A)])
        self.assert_invalid_and_pending(lambda receipts:{'replayed':0,'rejected':[]},[delivery(OUTBOX_A,LEASE_A)])

    def test_counts_that_add_up_close_the_batch_as_before(self):
        with profile_home(chats=[GROUP]) as home:
            journal=bridge.SendJournal(home)
            summary,_=self.drain(home,journal,lambda receipts:{'accepted':0,'replayed':1,'rejected':[]},[delivery(OUTBOX_A,LEASE_A)])
            self.assertTrue(summary['ok']);self.assertEqual((summary['reported'],summary['rejected'],summary['pending']),(1,0,0))
            self.assertEqual(self.closed(home),[(OUTBOX_A,'reported',None)])
        with profile_home(chats=[GROUP]) as home:
            journal=bridge.SendJournal(home)
            refuse_b=lambda receipts:{'accepted':1,'replayed':0,'rejected':[{'outboxId':OUTBOX_B,'attemptNo':1,'code':'RECEIPT_CONFLICT'}]}
            summary,_=self.drain(home,journal,refuse_b,[delivery(OUTBOX_A,LEASE_A),delivery(OUTBOX_B,LEASE_B)])
            self.assertTrue(summary['ok']);self.assertEqual((summary['reported'],summary['rejected'],summary['pending']),(1,1,0))
            self.assertEqual(self.closed(home),[(OUTBOX_A,'reported',None),(OUTBOX_B,'rejected','RECEIPT_CONFLICT')])

if __name__=='__main__':unittest.main()
