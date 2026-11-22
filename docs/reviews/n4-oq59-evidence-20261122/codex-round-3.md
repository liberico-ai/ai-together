VERDICT: CHANGES_REQUIRED

- [P1] `deploy/post-restore.sql:112` — Dòng trả lời cộng `unnumbered_revisions` và `held_threads` của mọi dự án, không tách miền báo cáo.
  Kịch bản: Một dự án Xeca và một dự án Liberico BU cùng có bản không số → biên nhận trả một tổng chung; ca P4b còn khẳng định cách cộng này.
  Căn cứ: `AGENTS.md:16`; `docs/SLICE-BRIEFS.md:11`.

- [P2] `deploy/install-user.py:242` — Thông báo gọi mọi luồng được đếm là “stay held”, dù phép đếm gồm cả luồng chưa có ứng viên để bị chặn.
  Kịch bản: Bản không số thuộc luồng chưa có ứng viên → bộ cài báo luồng đó bị giữ, trong khi runbook xác định `held_threads` chỉ là cận trên.
  Căn cứ: `docs/RUNBOOK-RESTORE-AFTER-023.md:68`.

- [P2] `deploy/post-restore.sql:57` — Phép kiểm mặc định quét mọi role, nên mặc định của một role không tham gia phiên phục hồi cũng làm bước kiểm dừng.
  Kịch bản: Một role khác có `ALTER ROLE … SET libetech.archive_kind`; superuser truyền đúng loại bằng `-c` → vẫn nhận `POST-RESTORE-01`, dịch vụ không được bật dù mặc định ấy không tác động đến phiên này.
  Căn cứ: `POST-RESTORE-01`; `docs/RUNBOOK-RESTORE-AFTER-023.md:88`.

