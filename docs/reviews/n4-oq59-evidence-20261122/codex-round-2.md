VERDICT: CHANGES_REQUIRED

- [P1] deploy/post-restore.sql:103 — Đường phục hồi thủ công có thể trả `post_restore: pass` khi bản lưu trước 023 chưa được đánh số.
  Kịch bản: Nạp bản lưu trước 023 vào lược đồ có 023, bỏ bước áp lại 023 → phép 05 chỉ báo số đếm, các phép sau vẫn có thể đạt → dòng cuối trả `pass` dù các luồng chưa được đánh số. Bộ cài chặn trường hợp này, nhưng đường chạy SQL bằng tay phải dựa vào người vận hành đọc thêm số đếm. Có thể đóng cổng bằng cách truyền **loại bản lưu đã phân loại** vào phép kiểm và bắt buộc số đếm bằng 0 với `pre-023`, thay vì đoán loại từ dữ liệu.
  Căn cứ: RUNBOOK mục 3 bước 6–7 và OQ-59 (b) (1); ca R10 xác nhận đường SQL hiện trả `pass` trước khi áp lại 023.

- [P2] deploy/post-restore.sql:108 — `NOTICE` kết luận sai rằng trạng thái không bản nào có số không thể là nguồn sau 023 có luồng bị giữ.
  Kịch bản: Nguồn đã có 023 nhưng trigger từng bị tắt cho toàn bộ revision, rồi được bật lại trước khi sao lưu → phép kiểm có thể đạt với mọi revision không số, trong khi `NOTICE` hướng người vận hành chẩn đoán là đã bỏ bước 6 của bản lưu trước 023.
  Căn cứ: OQ-59 (b) (1); chính logic phân loại của hai bộ cài dùng loại bản lưu, còn SQL không có thông tin đó.

