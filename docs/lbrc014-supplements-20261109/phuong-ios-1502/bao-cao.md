## A. Kết quả sử dụng thực tế — Nút Chỉ đường (kiểm thử của tech, chưa phải của người dùng)

- **Người thử (kiểm thử):** Phương (U1–U6); Quân (U7). Kiểm trên iOS (iPhone 16 Pro Max Pro, iOS 26).
- **Bản kiểm:** `main` @ `751327b`, App 1.0.27, lab `https://btnet-core.lab.liberico.com.vn/api/v1`.
- **Tài khoản:** `linhht` (lab). Chỉ đăng nhập, đồng bộ và bấm nút Chỉ đường, không tạo hay sửa dữ liệu.
- **Người sử dụng thật:** [chưa có — CVKD chưa dùng].

### Bảng kết quả tổng hợp

| Ca | Nội dung | Kết quả | Người kiểm | Bằng chứng |
|---|---|---|---|---|
| U1 | Tab Hôm nay: nút Chỉ đường ở thẻ điểm bán | **Đạt** | Phương | `U1_hom_nay.png`, log |
| U2 | Danh sách KH: nút ở thẻ | **Đạt** | Phương | `U2_danh_sach_kh.png` |
| U3 | Chi tiết KH: nút trên thanh tiêu đề | **Đạt** | Phương | `U3_chi_tiet_kh.png`|
| U4 | Ưu tiên toạ độ | **Đạt** | Phương | |
| U5 | Thiếu cả toạ độ lẫn địa chỉ | **Đạt** | Phương | `U5_tim_KH012183.png`, `U5_bam_chi_duong.png`
| U6 | Chưa đồng bộ / dữ liệu local | **Đạt** | Phương | `U6_tim_10166490KA.png`, `U6_bam_khi_chua_dong_bo.png`,|
| U7 | Lỗi mở bản đồ | **Đạt** | Quân đã test | Theo kết quả của Quân |

**Tổng: 7/7 đạt, 0 lỗi, 0 chưa kiểm.**

### Chi tiết từng ca

- **U1:** 3 nút hiện ngay, cuộn hết tuyến thấy đủ 17 nút. Cả 17 điểm có trên máy.
- **U2:** 22–23 thẻ có đủ nút, kể cả thẻ không có dòng địa chỉ.
- **U3:** nút nằm trước nút Sửa. Khách không có địa chỉ chữ vẫn ra đích bằng toạ độ lấy từ máy.
- **U4:** điểm có toạ độ cho đích `lat,lng` (ở Hôm nay, danh sách, chi tiết). Điểm chỉ có địa chỉ cho đích là địa chỉ chữ.
- **U5:** khách KH012183 (đã xoá toạ độ và địa chỉ trên web) có lat/lng và địa chỉ rỗng trên máy. Bấm không mở bản đồ, hiện "Điểm bán chưa có toạ độ hoặc địa chỉ để chỉ đường".
- **U6:** điểm 10166490KA vừa gán thêm cho `linhht`. Sau khi xoá dòng local của đúng điểm này rồi bấm lại, app dùng địa chỉ trên màn hình, vẫn ra đích bằng địa chỉ, không báo lỗi.
- **U7:** do Quân kiểm, ghi nhận đạt.



