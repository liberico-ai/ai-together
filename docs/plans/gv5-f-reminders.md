# Kế hoạch GIAO VIỆC 5 · hạng mục F — Lịch nhắc có ngữ cảnh

Ngày 26/11/2026 · nền `libetech-ai-os` @ `ce27e9f` (0.9.3) · PR 6. **Chờ duyệt trước khi viết mã** (§6).

## 1. Hiện trạng (#fact, đọc mã)

1. **Không có lịch nhắc nào trong repo này.** Bộ hẹn giờ duy nhất là `deploy/libetech-ai-os-outbox.timer`, chạy hàng đi mỗi phút. Plugin priority1 có hai cron của Hermes đọc sổ ticket riêng. Phiên chạy lịch «không đọc được lịch sử nhóm» (ca (f)) chưa xác định được (EV-08).
2. **Hàng đi chỉ trả lời tin đã nhận.**
   - CHECK (017, 026) đòi tin vào nhóm phải có dự án và tin nguồn (hoặc mục nhóm chung).
   - Trigger `outbox_messages_bind_target` buộc nhóm, chủ đề và tin trả lời trùng với tin nguồn.
   - Vì vậy hôm nay ứng dụng **không thể** tự gửi một tin mới vào bất kỳ nhóm nào. Đây là một rào an toàn.
3. **Bot API không đọc được lịch sử nhóm.** Nền tảng chỉ có tin đã lưu: `source_events` và bản sửa (trích đoạn hoặc con trỏ), ứng viên `IN-…`. Tin nhóm chung chỉ giữ con trỏ.
4. Chưa có gì mô hình lịch họp.
5. Dữ liệu cho GO LIVE: roster Team Tech, yêu cầu việc, việc, bằng chứng.

## 2. Thiết kế

### 2.1 Mở đường tự gửi mà vẫn giữ rào

- Bảng `reminder_targets` (dự án, loại nhắc, nhóm, chủ đề, bật/tắt), **chỉ người vận hành ghi** bằng `deploy/reminder-targets.sql`. Không vai ứng dụng nào ghi được. Id nhóm không vào repo.
- Hàng đi thêm một dạng tin: `reminder.*`, có `reminder_target_id`, không có tin nguồn.
  - Trigger buộc nhóm và chủ đề **trùng một đích đang bật** cùng loại, cùng dự án. Ứng dụng không tự đặt được đích mới.
  - Lớp thứ hai: plugin vốn từ chối nhóm không có trong `intake.json`.
- Chưa có đích thì **không gửi gì**. Bộ hẹn giờ giao kèm ở trạng thái **tắt**.

### 2.2 Đối chiếu GO LIVE (Z2)

- Bảng Z2 `analytics.golive_member_status` theo (dự án, thành viên Team Tech): đã gửi yêu cầu chưa; số việc đang mở; số việc chưa có bằng chứng.
- Một projector có tên, chạy bằng login vận hành (theo OQ-22), ghi bảng này. Tin nhắc chỉ đọc Z2 (AR-07).
- **Mỗi đích là một dự án.** Không cộng gộp dự án hay miền.
- Tin chỉ nêu **tên** người chưa gửi việc, hoặc có việc chưa có bằng chứng. Không nêu tiêu đề hay nội dung việc.
- Đích thuộc dự án IBS HI, hoặc dự án chưa xác nhận miền, thì **bị từ chối** ở bản đầu (Q-F3).

### 2.3 Lịch họp BoM (Z1)

- `meeting_series`: dự án, thứ trong tuần, giờ theo `Asia/Ho_Chi_Minh`, bật/tắt.
- `meeting_changes`, chỉ thêm:
  - loại `one_off` (ghi rõ buổi ngày nào) hoặc `recurring` hoặc `unclear`;
  - giờ mới;
  - nguồn là mã `IN-…` của một tin **đã lưu** trong chính dự án đó;
  - người ghi và thời điểm.
- **Ai ghi:** một ghế BoM của dự án hoặc một BoM Tech, qua biểu mẫu web. Bot và AI **không** đọc chữ tin rồi tự đổi lịch (AR-03).
- `unclear`: lịch đó **ngừng nhắc**, và gửi một lần câu hỏi vào đích: «Đổi giờ theo IN-…: chỉ buổi ngày … hay cả lịch định kỳ?». Trả lời bằng một thay đổi mới trỏ về thay đổi đó.
- `one_off` chỉ áp cho đúng buổi đã ghi. `recurring` áp từ buổi kế tiếp.
- Mỗi tin nhắc ghi nguồn: mã `IN-…` của thay đổi mới nhất, hoặc «lịch gốc».

### 2.4 Bộ hẹn giờ

- `scripts/send-reminders.ts` chạy bằng một vai mới chỉ được thêm dòng `reminder.*` vào hàng đi. Có kèm unit systemd, để tắt.
- Chống gửi lặp: `dedupe_key = reminder:<loại>:<đích>:<ngày>`, UNIQUE và `ON CONFLICT DO NOTHING`.
- Log chỉ in số đếm.

### 2.5 Plugin 0.3.6

- Ba mẫu tin `reminder.golive_status`, `reminder.bom_meeting`, `reminder.bom_meeting_question`, với tham số có kiểm dạng và độ dài.
- Plugin đổi nên phải khởi động lại gateway: ngoài giờ, có lời Chairman, rồi kiểm 20/20 bot.

### 2.6 Cách kiểm tin tới đúng nhóm

Đếm hàng đi theo loại và trạng thái; biên nhận gửi của gateway; người nhận xác nhận trong nhóm.

## 3. Migration

`031_reminders.sql` và rollback: bốn bảng, một cột và dạng tin mới của hàng đi, vai hẹn giờ, trigger buộc đích. Hoàn tác từ chối khi đã có tin nhắc hay thay đổi lịch.

## 4. Task và ca kiểm (viết trước, đỏ bằng lỗi khẳng định)

1. **Buộc đích.** Ứng dụng không tạo được tin nhắc tới nhóm chưa cấu hình, đích đã tắt, đích khác loại hay khác dự án. Không vai ứng dụng nào ghi `reminder_targets`.
2. **GO LIVE.**
   - Projector đúng với từng người.
   - Tin của đích dự án A không có dòng nào của dự án B.
   - Đích IBS HI hay chưa xác nhận miền bị từ chối.
   - Tin không có tiêu đề việc.
3. **Lịch họp.**
   - `unclear` thì không nhắc và hỏi đúng một lần.
   - `one_off` không đổi buổi sau; `recurring` đổi từ buổi kế tiếp.
   - Nguồn phải là tin đã lưu của đúng dự án.
   - Người ngoài quyền không ghi được.
4. **Bộ hẹn giờ.** Chạy hai lần không gửi lặp; không có đích thì không gửi.
5. **Plugin.** Mẫu đúng nguyên văn; tham số lạ bị từ chối.
6. Migration và hoàn tác.

## 5. Cỡ việc và phần để sau

- Cỡ tương đương PR A của GIAO VIỆC 5.
- Để sau: nhắc hạn từng việc; đổi hai cron priority1 (ngoài repo).

## 6. Cần duyệt trước khi viết mã

- **Q-F1. Mở đường tự gửi** như §2.1 (đích chỉ người vận hành ghi, CSDL buộc đích).
  Đề xuất: **mở**.
- **Q-F2. Danh sách người còn thiếu bằng chứng gửi đi đâu.**
  - (1) Nhóm được cấu hình, đúng như đề «tin nhắc phải tới đúng nhóm».
  - (2) Chỉ gửi riêng cho BoM Tech.
  - Đề xuất: **(1)**, chỉ nêu tên, không nêu việc.
- **Q-F3. Đích thuộc IBS HI.** Đề xuất: **từ chối ở bản đầu**.
- **Q-F4. Giờ nhắc.**
  - Đề xuất: GO LIVE 08:30 các ngày làm việc; họp BoM nhắc trước một ngày.
  - Cấu hình được trên đích.
