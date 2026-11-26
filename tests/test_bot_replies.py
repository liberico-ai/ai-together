# GIAO VIỆC 5 D: one correct reply per refusal code. The bot says the cause and the next step, never a bare code, never a guess by the model,
# and never a project, BU, group or person. Fakes only: nothing is installed or sent.
import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from test_bot_bridge import DM, FakeResponse, bridge, profile_home, register_with

# Every code a person can meet on a command or on the read tool: the bridge, the identity service, account approval, and the plugin's own checks.
COMMAND_CODES = [
    'BRIDGE_UNCONFIGURED', 'PAYLOAD_TOO_LARGE', 'BRIDGE_AUTH_DENIED', 'BRIDGE_REPLAY', 'RATE_LIMITED', 'INVALID_INPUT', 'INTERNAL_ERROR',
    'TELEGRAM_NOT_LINKED', 'NO_PROJECT_ACCESS', 'UNAUTHENTICATED', 'PAIRING_INVALID', 'IDENTITY_CONFLICT', 'PRIVATE_CHAT_REQUIRED',
    'APPROVER_REQUIRED', 'APPROVAL_NOT_FOUND', 'APPROVERS_NOT_READY', 'APPROVERS_CHANGED', 'APPROVAL_NOT_READY', 'VOTE_LOCKED',
    'APPROVAL_CLOSED', 'IDENTITY_UNAVAILABLE', 'BRIDGE_UNAVAILABLE', 'BRIDGE_RESPONSE_TOO_LARGE', 'BRIDGE_REDIRECT_DENIED',
    'BRIDGE_NOT_CONFIGURED', 'BRIDGE_CONFIG_PERMISSIONS', 'PROFILE_SCOPE_MISMATCH', 'BRIDGE_ROUTE_DENIED', 'INVALID_PAIRING_CODE',
    'USE_CODE_AND_FULL_SHA', 'USE_APPROVAL_ID', 'NO_ARGUMENTS_EXPECTED', 'INVALID_REQUEST', 'BOUND_SESSION_REQUIRED',
    'BOUND_TELEGRAM_REQUIRED', 'CHAT_IDENTITY_MISMATCH', 'APPROVAL_INVALID', 'APPROVAL_SCOPE_UNAVAILABLE', 'APPROVAL_SCOPE_TOO_LONG',
]
SCOPE_REASONS = ['CHAT_SOURCE_INVALID', 'NO_PROJECT_YET', 'NOT_PROJECT_MEMBER', 'CHAT_NOT_MAPPED', 'RECORD_NOT_FOUND']
NEVER_SAID = ['LBRC', 'Xeca', 'IBS', 'Liberico', 'BTNET', 'LibeAI', 'Dragon', 'Chairman']


def reply_for(code, status=0, reason=None):
    # Before the reply table, the bot answered a person with the bare code: that is the fallback, so a missing table fails as a wrong answer.
    return getattr(bridge, 'reply_for', lambda c, s=0, r=None: c)(code, status, reason)


def backend_error(code, status, reason=None):
    error = bridge.BackendError(code, status)
    error.reason = reason
    return error


def sentence(text):
    return text.rsplit(' (mã ', 1)[0]


def status_of(reason):
    return 404 if reason == 'RECORD_NOT_FOUND' else 403


class ReplyTableTests(unittest.TestCase):
    def test_every_command_code_has_its_own_sentence_ending_with_its_code(self):
        replies = {code: reply_for(code) for code in COMMAND_CODES}
        for code, text in replies.items():
            self.assertTrue(text.endswith(f'(mã {code})'), code)
            self.assertFalse(text.startswith('AI OS từ chối'), code)  # the fallback is not a reply for a known code
        self.assertEqual(len({sentence(text) for text in replies.values()}), len(replies))

    def test_scope_denied_says_which_of_the_causes_happened(self):
        texts = [reply_for('SCOPE_DENIED', status_of(reason), reason) for reason in SCOPE_REASONS]
        self.assertEqual(len({sentence(text) for text in texts}), len(SCOPE_REASONS))
        for text in texts:
            self.assertTrue(text.endswith('(mã SCOPE_DENIED)'))
        # a server that sends no reason yet: the status still separates "no such record" from the access causes
        self.assertIn('Không thấy hồ sơ', reply_for('SCOPE_DENIED', 404))
        self.assertIn('hoặc', reply_for('SCOPE_DENIED', 403))
        self.assertNotEqual(sentence(reply_for('SCOPE_DENIED', 403)), sentence(reply_for('SCOPE_DENIED', 404)))

    def test_an_unknown_code_falls_back_with_the_code_and_a_non_code_is_never_echoed(self):
        text = reply_for('SOMETHING_NEW')
        self.assertTrue(text.startswith('AI OS từ chối') and text.endswith('(mã SOMETHING_NEW)'))
        leaked = reply_for(bridge.safe_error(ValueError('secret token: hidden'))['error'])
        self.assertTrue(leaked.endswith('(mã BRIDGE_UNAVAILABLE)'))
        self.assertNotIn('secret', leaked)
        self.assertNotIn('reason secret', reply_for('SCOPE_DENIED', 403, 'reason secret'))

    def test_no_sentence_names_a_project_bu_group_or_person_or_waits_on_the_chairman(self):
        texts = [reply_for(code) for code in COMMAND_CODES]
        texts += [reply_for('SCOPE_DENIED', status_of(reason), reason) for reason in SCOPE_REASONS]
        texts += [reply_for('SCOPE_DENIED', 403), reply_for('SCOPE_DENIED', 404), reply_for('SOMETHING_NEW')]
        for text in texts:
            for word in NEVER_SAID:
                self.assertNotIn(word.lower(), text.lower(), text)


class CommandReplyTests(unittest.TestCase):
    def setUp(self):
        registered, _ = register_with(bridge.EXPECTED_HOME, ask_choice=lambda _q, _c: 'yes')
        self.handlers = {name: kwargs['handler'] for name, kwargs in registered}
        self.tool = next(kwargs for name, kwargs in registered if name == 'tool')

    def answer(self, command, arguments, error, source=DM):
        def refuse(*_args, **_kwargs):
            raise error
        with patch.object(bridge, 'call_backend', side_effect=refuse):
            return self.handlers[command](arguments, source=SimpleNamespace(**source))

    def test_commands_answer_with_the_cause_and_the_next_step(self):
        check = self.answer('libetech-check', 'LBRC014 ' + 'a' * 40, backend_error('TELEGRAM_NOT_LINKED', 403))
        self.assertEqual(check, reply_for('TELEGRAM_NOT_LINKED', 403))
        self.assertIn('/libetech_link', check)
        link = self.answer('libetech-link', 'A' * 43, backend_error('PAIRING_INVALID', 403))
        self.assertEqual(link, reply_for('PAIRING_INVALID', 403))
        check = self.answer('libetech-check', 'LBRC014 ' + 'a' * 40, backend_error('SCOPE_DENIED', 403, 'CHAT_NOT_MAPPED'))
        self.assertEqual(check, reply_for('SCOPE_DENIED', 403, 'CHAT_NOT_MAPPED'))
        pending = self.answer('libetech-access-pending', '', backend_error('APPROVER_REQUIRED', 403))
        self.assertEqual(pending, reply_for('APPROVER_REQUIRED', 403))
        review = self.answer('duyet', '', backend_error('APPROVERS_CHANGED', 409))
        self.assertEqual(review, reply_for('APPROVERS_CHANGED', 409))

    def test_the_read_tool_hands_the_model_the_sentence_to_relay_and_nothing_to_guess_from(self):
        class Var:
            def __init__(self, value):
                self.value = value

            def get(self):
                return self.value
        values = {'PLATFORM': 'telegram', 'PROFILE': 'libetech', 'USER_ID': '123', 'CHAT_ID': '123', 'CHAT_TYPE': 'private',
                  'MESSAGE_ID': '456', 'ID': 'session-1', 'KEY': 'session-key'}
        session = SimpleNamespace(_UNSET=object(), _VAR_MAP={'HERMES_SESSION_' + k: Var(v) for k, v in values.items()})

        def refuse(*_args, **_kwargs):
            raise backend_error('SCOPE_DENIED', 403, 'NOT_PROJECT_MEMBER')
        with patch.dict('sys.modules', {'gateway': SimpleNamespace(session_context=session)}), patch.object(bridge, 'call_backend', side_effect=refuse):
            out = json.loads(self.handlers['tool']({'code': 'LBRC014', 'source_sha': 'a' * 40}))
        self.assertEqual((out['ok'], out['error'], out.get('reason')), (False, 'SCOPE_DENIED', 'NOT_PROJECT_MEMBER'))
        self.assertEqual(out['reply'], reply_for('SCOPE_DENIED', 403, 'NOT_PROJECT_MEMBER'))
        self.assertIn('nguyên văn', out['instruction'])
        description = self.tool['schema']['description']
        self.assertNotIn('chat/project scope', description)
        self.assertIn('reply', description)


class BackendReasonTests(unittest.TestCase):
    def refused(self, payload, status):
        class Opener:
            def open(self, _request, timeout):
                response = FakeResponse(json.dumps(payload).encode())
                response.status = status
                return response
        with profile_home() as home, patch.object(bridge.urllib.request, 'build_opener', return_value=Opener()):
            try:
                bridge.call_backend(home, {'operation': 'x'})
            except bridge.BackendError as error:
                return error
        self.fail('no refusal')

    def test_the_backend_error_keeps_a_wellformed_reason_only(self):
        ok = self.refused({'data': None, 'error': {'code': 'SCOPE_DENIED', 'reason': 'CHAT_NOT_MAPPED'}}, 403)
        self.assertEqual((str(ok), ok.status, getattr(ok, 'reason', None)), ('SCOPE_DENIED', 403, 'CHAT_NOT_MAPPED'))
        for reason in ['secret token: x', 12, None, 'A' * 41, '']:
            bad = self.refused({'data': None, 'error': {'code': 'SCOPE_DENIED', 'reason': reason}}, 403)
            self.assertIsNone(getattr(bad, 'reason', 'missing'), repr(reason))


if __name__ == '__main__':
    unittest.main()
