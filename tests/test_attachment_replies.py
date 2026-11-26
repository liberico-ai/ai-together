# GIAO VIỆC 5 E: the attachment-failure receipt says why and what to do. An unknown or missing reason keeps the old general sentence.
import unittest

from test_bot_bridge import bridge

BASE = {'ref': 'IN-0A1B2C3D', 'observedAt': '2026-11-26T01:00:00.000Z'}
GENERAL = 'Đã ghi nhận nội dung, mã IN-0A1B2C3D, nhưng chưa lưu được tệp đính kèm. Vui lòng gửi lại tệp.'
REASONS = ['TOO_LARGE', 'UNSUPPORTED_TYPE', 'DOWNLOAD_UNAVAILABLE', 'STORE_UNAVAILABLE']


def render(**extra):
    return bridge.render('intake.attachment_failed', BASE | extra)


class AttachmentReplyTests(unittest.TestCase):
    def test_each_reason_has_its_own_sentence_with_the_reference_and_a_next_step(self):
        texts = [render(attachmentReason=reason) for reason in REASONS]
        self.assertEqual(len(set(texts)), len(REASONS))
        for text in texts:
            self.assertIn('IN-0A1B2C3D', text)
            self.assertNotEqual(text, GENERAL)
        self.assertIn('20 MB', render(attachmentReason='TOO_LARGE'))
        self.assertIn('PDF', render(attachmentReason='UNSUPPORTED_TYPE'))

    def test_an_unknown_missing_or_non_text_reason_keeps_the_general_sentence(self):
        self.assertEqual(render(), GENERAL)
        for reason in ['SECRET_VALUE', '', None, 7, 'too_large']:
            self.assertEqual(render(attachmentReason=reason), GENERAL, repr(reason))


if __name__ == '__main__':
    unittest.main()
