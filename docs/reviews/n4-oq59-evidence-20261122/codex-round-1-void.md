VERDICT: CHANGES_REQUIRED

- [P1] deploy/post-restore.sql:103 — Cây làm việc có lệnh `RAISE EXCEPTION POST-RESTORE-05` không xuất hiện trong diff được cung cấp, nên bản có revision không số vẫn bị từ chối.
  Kịch bản: Phục hồi bản lưu sau 023 với một revision không số → lệnh ném lỗi trước `NOTICE` và dòng JSON `pass`; cả hai bộ cài dừng, không bật dịch vụ. Ca P4 và R8 cũng không thể đạt với mã hiện tại.
  Căn cứ: OQ-59 (b) (1); `docs/RUNBOOK-RESTORE-AFTER-023.md` mục 3 bước 7 và mục 7.

