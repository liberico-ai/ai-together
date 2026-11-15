VERDICT: CHANGES_REQUIRED

- [P2] `src/server/bom.ts:117` — Phiếu vừa đóng có thể biến mất ngay sau khi bỏ phiếu thành công, khiến người bỏ phiếu không thấy kết quả.
  Kịch bản: Một phiếu còn mở cũ hơn 30 phiếu đã đóng được đưa lên đầu danh sách; người giữ ghế bỏ lá “Từ chối” → lần đọc lại xếp phiếu đó ra ngoài 30 chỗ, màn hình chỉ báo danh sách bị cắt. OQ-47 đã ghi nhận tình huống này nhưng chưa có phương án được chọn.
  Căn cứ: `docs/UI-HANDOFF-3-decisions.md:101` yêu cầu thẻ chuyển trạng thái sau khi bỏ phiếu thành công.

- [P3] `docs/IMPLEMENTATION-ROADMAP.md:40` — Roadmap vẫn liệt kê cờ “đã cắt” cho thẻ 3/3 là việc để lại, dù PR này đã thêm cờ đó.
  Kịch bản: Người lập lát tiếp theo đọc roadmap → lên kế hoạch làm lại phần đã có mã.
  Căn cứ: `docs/DELIVERY-014-decision-cards-cut-20261116.md`, mục “Đã làm”.

