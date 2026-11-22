VERDICT: CHANGES_REQUIRED

- [P0] deploy/libetech-ai-os-outbox.service:9 — Unit chạy mã Python trong profile gateway do `iptech` quản lý nhưng không khai `User=`, nên khi cài làm system service mã đó chạy với quyền root.
  Kịch bản: tài khoản `iptech` hoặc plugin gateway bị chiếm quyền → sửa `__init__.py` → timer thực thi mã đã sửa với quyền root.
  Căn cứ: AGENTS.md mục cô lập triển khai; `deploy/install-d1.sh:136` cài plugin dưới tài khoản `iptech`; `deploy/libetech-ai-os.service:7` khai rõ tài khoản chạy cho web.

- [P1] bot-plugin/__init__.py:883 — Hàng đợi intake chỉ được gửi lại khi có sự kiện mới; timer outbox không xả hàng đợi này.
  Kịch bản: migration 023 giữ khoá quá `HOOK_TIMEOUT` 2 giây → tin cuối cùng vào `intake-spool.jsonl` → không có tin tiếp theo thì tin không tới cơ sở dữ liệu dù migration đã xong.
  Căn cứ: `docs/SLICE-BRIEFS.md:89,128` (DOC-12); `docs/RUNBOOK-PRE-023-N1-N3.md:30-54` (N2).

