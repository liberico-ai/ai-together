VERDICT: CHANGES_REQUIRED

- [P0] deploy/install-d1.sh:21 — Bộ cài chạy `verify-bundle.py` từ bundle mà tài khoản dùng chung có thể sửa, bằng quyền root, trước khi tạo bản chụp riêng.
  Kịch bản: Tệp kiểm bị thay bằng mã độc trước lúc chạy → mã đó thực thi với quyền root; `python3 -I` không kiểm nội dung tệp đang chạy.
  Căn cứ: N4, ranh giới bản chụp chỉ root đọc tại `docs/plans/n4-restore-after-023.md` mục 11.

- [P1] docs/RUNBOOK-RESTORE-AFTER-023.md:53 — Lệnh nạp thủ công không dừng nếu `restore-plan.py --pg-restore-args` lỗi.
  Kịch bản: Python thoát lỗi → `$(…)` thành rỗng → `pg_restore` vẫn chạy, thiếu `--single-transaction`, `--exit-on-error` và `--disable-triggers`, có thể để lại dữ liệu nạp dở.
  Căn cứ: N4 tại `docs/DELIVERY-016-oq-53-subject-order-and-revisions-20261119.md` mục «Điều kiện»; E-INT-04.

- [P2] docs/DELIVERY-017-n4-restore-after-023-20261120.md:51 — Biên nhận còn chỗ giữ chỗ cho typecheck, build và bộ test đầy đủ, không có kết quả hay log tương ứng.
  Kịch bản: Người duyệt đọc «xem bảng đo cuối» nhưng không có bảng đó; 17 ca diễn tập đã ghi log không chứng minh các cổng build và test đầy đủ đạt.
  Căn cứ: `docs/HANDOFF-CLAUDE-CODE-20261111.md` mục 7. Biên nhận đã phân biệt đúng «đã có mã/đã thử phục hồi» với «đã triển khai/đã dùng thật/đã nghiệm thu».

