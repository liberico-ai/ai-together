# GIAO VIỆC 5 F: three fixed reminder sentences. Every parameter is checked by shape; a name list that could mention someone or run a command is refused.
import unittest

from test_bot_bridge import bridge

GOLIVE = {'project': 'Cổng bán hàng mẫu', 'date': '2026-11-24', 'noRequest': 'Nguyễn An, Trần Bình', 'noEvidence': 'Lê Chi (2 việc)'}
MEETING = {'project': 'Cổng bán hàng mẫu', 'date': '2026-11-26', 'time': '14:00', 'source': 'IN-0A1B2C3D'}
QUESTION = {'project': 'Cổng bán hàng mẫu', 'source': 'IN-0A1B2C3D', 'date': '2026-11-26'}


def render(template, params):
    try:
        return bridge.render(template, params)
    except ValueError as error:
        return 'refused: ' + str(error)


class ReminderTemplateTests(unittest.TestCase):
    def test_golive_status_names_who_has_not_filed_and_who_lacks_evidence(self):
        self.assertEqual(render('reminder.golive_status', GOLIVE),
                         'Nhắc GO LIVE — Cổng bán hàng mẫu, ngày 24/11/2026.\n'
                         'Chưa gửi yêu cầu việc: Nguyễn An, Trần Bình.\n'
                         'Có việc đang mở chưa có bằng chứng: Lê Chi (2 việc).')
        self.assertEqual(render('reminder.golive_status', GOLIVE | {'noRequest': ''}).split('\n')[1], 'Chưa gửi yêu cầu việc: không có.')
        self.assertEqual(render('reminder.golive_status', GOLIVE | {'noEvidence': ''}).split('\n')[2],
                         'Có việc đang mở chưa có bằng chứng: không có.')

    def test_meeting_reminder_says_the_time_and_its_source(self):
        self.assertEqual(render('reminder.bom_meeting', MEETING),
                         'Nhắc họp BoM — Cổng bán hàng mẫu: ngày 26/11/2026 lúc 14:00 (giờ Việt Nam). Nguồn giờ họp: tin IN-0A1B2C3D.')
        self.assertTrue(render('reminder.bom_meeting', MEETING | {'source': 'base'}).endswith('Nguồn giờ họp: lịch gốc.'))

    def test_the_question_names_the_source_and_both_choices_and_says_reminders_pause(self):
        self.assertEqual(render('reminder.bom_meeting_question', QUESTION),
                         'Họp BoM — Cổng bán hàng mẫu: tin IN-0A1B2C3D báo đổi giờ nhưng chưa rõ áp cho buổi ngày 26/11/2026 hay cho cả lịch định kỳ. '
                         'Lịch này tạm ngừng nhắc đến khi một ghế BoM ghi lại trên web, mục «Lịch họp BoM».')

    def test_bad_or_unsafe_parameters_are_refused(self):
        cases = [('reminder.golive_status', GOLIVE | bad) for bad in (
            {'noRequest': '@someone'}, {'noRequest': 'a\nb'}, {'noEvidence': '/approve'}, {'noEvidence': 'x' * 901},
            {'project': ''}, {'project': '<b>x</b>'}, {'noRequest': 'a {date}'}, {'project': 'x\u200b'}, {'date': '24/11/2026'}, {'date': '2026-13-40'}, {'noRequest': None})]
        cases += [('reminder.bom_meeting', MEETING | bad) for bad in ({'time': '25:00'}, {'time': '9:00'}, {'source': 'IN-xyz'}, {'source': ''})]
        cases += [('reminder.bom_meeting_question', {'project': 'X', 'source': 'base', 'date': '2026-11-26'})]
        for template, params in cases:
            with self.subTest(template=template, params=params):
                self.assertEqual(render(template, params), 'refused: TEMPLATE_PARAMS_INVALID')

    def test_the_plugin_version_moved_with_the_new_messages(self):
        self.assertEqual(bridge.VERSION, '0.3.6')


if __name__ == '__main__':
    unittest.main()
