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
if __name__=='__main__':unittest.main()
