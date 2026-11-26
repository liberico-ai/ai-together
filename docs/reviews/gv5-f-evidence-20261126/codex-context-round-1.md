
## Việc (GIAO VIỆC 5, hạng mục F)

- **Đề:** phiên chạy lịch đọc dữ liệu nền tảng đúng quyền dự án; trạng thái GO LIVE theo từng thành viên (đã gửi yêu cầu / có việc / có bằng chứng), nêu tên người thiếu bằng chứng; đổi giờ họp BoM lấy từ tin xác nhận kèm nguồn (mã IN), áp đúng một buổi hoặc cả lịch, không rõ thì hỏi; nhắc tới đúng nhóm, có cách kiểm.
- **Kế hoạch đã duyệt:** `docs/plans/gv5-f-reminders.md` (§6 đề xuất, §7 duyệt 26/11 và bổ sung). Câu tạm: Q-GV5F-1…5 cuối `docs/OPEN-QUESTIONS.md`.

**Cổng:** chạy một vòng. Chỉ P0 chặn merge (rò dữ liệu, leo quyền, mất dữ liệu); P1 và P2 ghi vào biên nhận và sửa tiến. Vẫn xếp hạng mọi finding theo thang của lời nhắc trên.

**Đầu vào:** diff so với `ce27e9f` (0.9.3), gồm `src`, `migrations`, `bot-plugin`, `scripts`, `deploy`, `tests`.

## Đã đổi

- Migration 031 và rollback: vai `libetech_reminder` và login `libetech_reminder_svc`; `reminder_targets` (chỉ người vận hành ghi); cột `outbox_messages.reminder_target_id`, CHECK và trigger buộc đích (nhóm, chủ đề, loại, dự án được phép: miền đã xác nhận, không IBS HI); `meeting_series`, `meeting_changes` (chỉ thêm; ghi bởi ghế BoM dự án hoặc BoM Tech), `reminder_config_events`; Z2 `analytics.golive_member_status`; các hàm DEFINER `reminder_project_allowed`, `meeting_source`, `meeting_changes_guard`, `reminder_config_record`, `tech_roster_members`.
- `src/server/reminders.ts` (bộ hẹn giờ, vai `libetech_reminder`), `meetings.ts` + `meeting-times.ts` (ghi và tính giờ họp, trang `/meetings`), `golive-status.ts` (bộ chiếu, login vận hành); `outbox.ts` bỏ tin nhắc quá 6 giờ; `db.ts` thêm vai mới vào kiểm login.
- Plugin 0.3.6: ba mẫu tin nhắc, kiểm tham số theo dạng.
- `deploy/`: hai SQL vận hành, hai cặp service/timer (tắt).

## Điều muốn được soát kỹ

1. Có đường nào để một vai ứng dụng đưa tin tự gửi tới nhóm chưa cấu hình, nhóm của dự án khác, hay dự án IBS HI / chưa xác nhận miền (RLS, cột được cấp, CHECK, trigger, hàm DEFINER)? Vai `libetech_reminder` đọc hay ghi được gì ngoài ý định?
2. Có đường nào để người không giữ ghế BoM của dự án (và không phải BoM Tech) đọc lịch hay ghi đổi giờ, hoặc dùng mã IN để dò tin của dự án khác?
3. Tin nhắc có thể lộ tiêu đề việc, chữ của tin, mã nhóm, hay tên của dự án khác không? Tham số có phá được mẫu tin ở plugin không?
4. Bộ hẹn giờ: gửi lặp, gửi sai giờ, gửi giờ họp sai sau đổi một buổi / định kỳ / chưa rõ; chiếu Z2 cũ.
5. Rollback 031 có xoá lịch sử ở trạng thái nào không?
