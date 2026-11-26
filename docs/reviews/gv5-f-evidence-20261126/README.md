# Bằng chứng GIAO VIỆC 5 F: lịch nhắc có ngữ cảnh (26/11/2026)

Nhánh `feat/gv5-f-reminders`, trên `ce27e9f` (0.9.3). Đường dẫn máy trong log đã thay bằng `<repo>`, `<local>`, `<tmp>`; địa chỉ CSDL thành `<db>`; mã nhóm thử thành `<test-chat>`. Log chỉ chứa dữ liệu mẫu của bộ test.

## Đỏ trước, xanh sau

| Log | Trên mã nào | Kết quả |
|---|---|---|
| `red-first-core.txt` | trước 031, bộ chiếu, lịch họp, bộ hẹn giờ (chỉ có module rỗng) | 27 ca hỏng, mỗi ca một `AssertionError` |
| `red-first-web.txt` | trước trang «Lịch họp BoM» và hai đường API | 5 ca hỏng bằng `AssertionError` |
| `red-first-scheduler.txt` | trước bộ hẹn giờ, hạn 6 giờ, SQL vận hành, kiểm login | 12 ca hỏng bằng `AssertionError` |
| `red-first-intake-scope.txt` | trước hàm phạm vi intake dùng chung | 1 ca hỏng bằng `AssertionError` |
| `red-first-braces.txt` | trước khi lọc ngoặc nhọn khỏi tên | 1 ca hỏng bằng `AssertionError` |
| `red-first-plugin.txt` | trước plugin 0.3.6 | 5 ca mẫu tin hỏng (36 dòng `AssertionError` tính cả subtest) |
| `red-broken-operate.txt` | hai ca thêm sau mã: đếm trạng thái, và một đích hỏng không chặn đích khác. Chạy trên mã **cố ý làm hỏng**, rồi khôi phục | 2 ca hỏng bằng `AssertionError` |
| `red-after-codex.txt` | `8ac403e`, trước khi sửa theo Codex | 9 ca hỏng, 9 dòng `AssertionError` |
| `red-first-review-ts.txt`, `red-first-review-py.txt` | `ea12c96`, trước khi sửa theo lượt đọc độc lập | 6 ca TypeScript và 1 ca Python hỏng bằng `AssertionError` |

Ca cũ phải đổi theo thiết kế mới: ca hoàn tác 030 (`tests/link-revoke.test.ts`) gỡ các migration phía trên trước, vì 031 nay đứng trên nó.

## Cổng Codex, một vòng (`codex-round-1.md`)

Đầu vào: `codex-context-round-1.md` cùng diff `ce27e9f..8ac403e` của `src`, `migrations`, `bot-plugin`, `scripts`, `deploy`, `tests`, `vitest.config.ts`. Kết quả: `VERDICT: CHANGES_REQUIRED`, **hai P0, ba P1**. Cả năm đã sửa ở `ea12c96`, mỗi cái có ca đỏ trước. Codex chưa đọc lại; không chạy vòng hai.

| Mức | Finding | Đã làm |
|---|---|---|
| P0 | Nhóm đích không bị buộc phục vụ đúng dự án của tin | Nhóm phải phục vụ đúng một dự án, là dự án của đích; không đọc được cấu hình thì không xếp tin. Nhóm chung bị từ chối (Q-GV5F-6) |
| P0 | Lúc gateway kéo, không kiểm lại đích, nhóm, quyền của dự án | `public.reminder_delivery_facts` và `deliveryBlock`: kiểm lại tất cả lúc kéo; không đạt thì không giao, ghi `REMINDER_…` |
| P1 | Đổi giờ không huỷ tin giờ cũ còn chờ | Lúc kéo, giờ phải còn đúng (`REMINDER_SUPERSEDED`) |
| P1 | Hạn 6 giờ không xét giờ bắt đầu buổi họp | Buổi đã bắt đầu thì `REMINDER_EXPIRED` |
| P1 | SQL vận hành không đòi phiên bản đã đọc | `expected_version`; `reminder_targets` có `version` |

## Lượt đọc độc lập sau cổng

Một agent kiểm bảo mật, chỉ đọc (không chạy test, không chạm CSDL), đọc `ce27e9f..ea12c96`. **Không có P0.** Đã sửa, mỗi điểm có ca đỏ trước:
- cách ghim đường tìm tên của các hàm `SECURITY DEFINER` mới;
- tin bị bỏ không bao giờ được xếp lại, gồm câu hỏi đổi giờ;
- nhật ký cấu hình thiếu `request_id`, `trace_id` (E-DB-13);
- giờ gửi 07:00–21:00 và tuổi của trạng thái GO LIVE không được kiểm lúc gửi;
- đổi giờ gốc rồi đổi lại không gửi đính chính;
- gateway cho tin nhắc đi vào nhóm chung hay tin riêng.

Câu thiết kế nó nêu, danh sách GO LIVE gồm cả roster chứ không chỉ người của dự án, ghi thành Q-GV5F-7. Chưa đổi, vì kế hoạch đã duyệt nói vậy.

## Cổng trên cây cuối

| Cổng | Kết quả | Log |
|---|---|---|
| `npm run typecheck` | thoát 0 | `logs/typecheck.txt` |
| `npm run build` (có trang `/meetings`) | thoát 0 | `logs/build.txt` |
| `python3 -m pytest tests/` | 182 ca đạt, 210 subtest | `logs/pytest.txt` |
| PGlite với coverage | 97 tệp đạt, 15 bỏ qua; 1622 ca đạt, 162 bỏ qua. Câu lệnh 96,23 %, nhánh 91,88 %, hàm 97,7 %, dòng 97,92 %. Module mới (câu lệnh / nhánh): `reminders.ts` 97,91 / 88,23; `meetings.ts` 98,66 / 88,23; `meeting-times.ts` 97,22 / 100; `golive-status.ts` 100 / 100 | `logs/pglite-coverage.txt` |
| PostgreSQL 16 (container cục bộ) | 112 tệp, 1784 ca đạt, không ca nào bỏ qua | `logs/native.txt` |
| Hai tệp SQL bằng `psql` thật, rồi hai script, trên CSDL thử riêng | Xem dưới | `logs/scripts-end-to-end.txt` |

Lượt end-to-end:
- `psql` chạy `reminder-targets.sql` và `meeting-series.sql`, đọc mã nhóm qua `\getenv`; không in mã.
- Sai `expected_version` thì thoát 3 («division by zero», là cách các tệp này từ chối).
- Bộ chiếu: 1 dự án, 2 thành viên.
- Bộ hẹn giờ không có cấu hình thì không xếp gì và thoát 1 (`intake_scope_unchecked`).
- Có cấu hình thì xếp đúng 1 tin GO LIVE; chạy lại không xếp thêm; `--status` đếm 1 tin chờ.
- Login web bị từ chối.
- Giờ GO LIVE của lượt này được đặt vài phút trước giờ chạy, vì lúc chạy đã sau 21:00.

## Chưa chứng minh được

- Chưa triển khai: chưa tin nhắc nào được gửi tới Telegram.
- Câu thật của bot trên gateway, và việc tin tới đúng nhóm, cần EV-36.
- Ca (e) đổi giờ họp và ca (f) phiên nhắc theo lịch: cần EV-07, EV-08. Không ca nào được ghi «đã đóng».
