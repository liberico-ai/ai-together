# Kịch bản nghiệm thu GIAO VIỆC 5 — tài khoản thật (0.9.1)

Version 1.0 · 25/11/2026 · bản 0.9.1 (merge `c3c9c4a`) · biên nhận: `docs/DELIVERY-022-gv5-golive-tech-work-20261125.md` · runbook: `docs/RUNBOOK-091-20261125.md`

**Ai chạy:** Codex, trên d1-ai1 sau khi triển khai, cùng người thật. Phiên PR soạn, không chạy.

**Người tham gia, nêu bằng vai.** Ai giữ vai nào nằm ngoài repo; phiên điều phối giữ bảng đó.
- `BoM-1`, `BoM-2`, `BoM-3`: ba thành viên BoM Tech. Mỗi người là ghế BoM của các dự án dùng để thử.
- `PM`: người giữ bảng danh sách việc của team. Cũng là một trong ba người BoM.
- `Tech-1`: một thành viên Team Tech không giữ ghế BoM.
- Người báo ca (a), (b), (c): người đã báo lỗi đó.

**Quy ước biên bản:**
- Mỗi ca ghi: thời điểm, tài khoản (vai), kết quả nhìn thấy, mã lỗi nếu có, và đạt / không đạt.
- Không ghi id, chat id, tên đăng nhập, email hay chữ của tin vào repo.
- Ảnh chụp và tin gốc lưu ngoài repo, biên bản chỉ trỏ tới.
- Một ca lỗi cũ chỉ được ghi «đã đóng» khi người báo xác nhận trên tin gốc (lời Chairman 25/11/2026).

**Trước khi bắt đầu:**
- Tài khoản của bốn người đang hoạt động, đã kích hoạt, đã liên kết Telegram (EV-09).
- `Tech-1` có trong roster Team Tech.
- Ba ghế BoM đã ghi cho mỗi dự án thử.

## 1 · Tech tạo việc ở nhiều dự án; BoM duyệt; không ai tự duyệt việc mình tạo

1. `Tech-1` mở «Tạo việc». Danh sách hiện mọi dự án của tenant, kể cả dự án `Tech-1` không có quyền.
2. `Tech-1` tạo hai việc ở hai dự án khác nhau, một dự án không có quyền. Cả hai hiện «Chờ BoM duyệt»; chưa có việc nào ở danh sách việc.
3. `BoM-1` mở «Việc chờ BoM duyệt», thấy cả hai, duyệt một việc với người thực hiện không phải ghế BoM.
   - Việc xuất hiện với mã, người duyệt, thời điểm duyệt.
4. `BoM-1` tạo một việc rồi tự duyệt: bị từ chối (`SELF_APPROVAL`). `BoM-2` duyệt được.
5. Một tài khoản chỉ có vai viewer ở một dự án, không trong roster, thử tạo việc: bị từ chối, `WORK_REQUEST_DENIED`.

## 2 · Chia lại việc cần đủ 3/3

1. Trên việc vừa duyệt ở kịch bản 1, `BoM-1` đổi người thực hiện ngay trên trang việc: bị từ chối `BOM_REQUIRED` («Dùng phiếu BoM 3/3 để đổi người thực hiện.»), người thực hiện không đổi.
2. Cũng việc đó, mở phiếu 3/3: trang `/bom` không liệt kê nó, và lệnh gửi phiếu trả `SOURCE_RECONCILE`. Lý do: phiếu 3/3 cần một dòng `bom_sources` còn hiệu lực, mà việc sinh từ yêu cầu không có (OQ-60 (d) (3), cách hiểu tạm). Ghi kết quả này vào biên bản là **vướng chờ Chairman**, không phải bước không đạt.
3. Trên một việc đã có dòng `bom_sources` còn hiệu lực (trang `/bom` liệt kê nó): `BoM-1` gửi phiếu đổi người thực hiện. Ba ghế lần lượt chọn đồng ý. Sau phiếu đồng ý thứ hai, người thực hiện vẫn chưa đổi; sau phiếu thứ ba mới đổi, và phiếu có biên nhận.
4. Lặp lại bước 3 với người thực hiện mới là một trong ba ghế BoM: vẫn cần đủ ba phiếu đồng ý.
5. Duyệt một việc mới mà người thực hiện là một ghế BoM: bị giữ lại (`SELF_ASSIGNMENT` khi ghế tự giao cho mình, `BOM_ASSIGNEE_HELD` khi giao cho ghế khác). Đây là cách hiểu tạm OQ-60 (e) (1).

## 3 · Tin thật đi hết luồng B

1. `BoM-1` gửi một tin gọi bot ở Dragon Forge.
   - Nhóm nhận «Đã nhận, mã IN-…», không có tên dự án.
2. `Tech-1` mở trang pool, thấy mục đó «chưa gán dự án», không có chữ của tin.
   - Chọn một dự án, lập yêu cầu. Trang «Việc chờ BoM duyệt» có dòng «Từ tin IN-…».
3. Một ghế BoM khác người lập duyệt. Mục pool hiện mã việc, người duyệt, thời điểm.
4. Một thành viên gửi tin tại LibeAI. Tin thành ứng viên như trước; ứng viên đã xác nhận lập được yêu cầu, ghế BoM duyệt.
5. Lặp bước 1–3 với một dự án thuộc miền IBS HI. Người vận hành chạy truy vấn chỉ đọc: không cột nào giữ chữ của tin.

## 4 · Ca lỗi cũ: bot trả đúng nguyên nhân

Hạng mục D. Chạy khi D đã triển khai. Ca (a) `unauthorized` và ca (b) `SCOPE_DENIED`: người báo lặp lại đúng thao tác cũ; câu trả lời của bot nêu đúng nguyên nhân. Đối chiếu với tin gốc (EV-03, EV-04).

## 5 · Tệp thật của team

Hạng mục E. Chạy khi E đã triển khai. Tệp lớn, Excel, hết giờ chờ, quyền thư mục, với tệp do team cung cấp (EV-05).

## 6 · Lịch nhắc

Hạng mục F. Chạy khi F đã triển khai. Lịch nhắc GO LIVE và lịch BoM tới đúng nhóm, đúng nội dung, có nguồn (EV-07, EV-08).

## 7 · PM nhập bảng

1. Chỉ sau khi `PM` xác nhận bản nguồn (EV-10). Người vận hành bật `LIBETECH_WORK_IMPORT=1`.
2. `PM` tải bản xuất CSV của trang nguồn lên «Nhập bảng việc», xem trước.
   - Ghi số dòng theo từng nhãn BU và số dòng cần đối chiếu theo mã lý do. Không cộng gộp các miền.
3. `PM` ghi. Số yêu cầu ghi được khớp số dòng hợp lệ của bước xem trước; mỗi yêu cầu «Chờ BoM duyệt».
4. `PM` nhập lại đúng tệp đó: 0 dòng mới.
5. `Tech-1` (không giữ ghế BoM của các dự án đích) nhập đúng tệp đó: 0 dòng mới; các dòng ra «cần đối soát» `STT_IMPORTED`, không nói mã hay nội dung của dòng đã nhập (OQ-62 câu 8).
6. Dòng IBS HI chỉ mang con trỏ, hash và dữ liệu công việc Tech: người vận hành chạy truy vấn chỉ đọc, không cột nào giữ chữ «Ghi chú» của dòng IBS HI.

## Biên bản

Một dòng cho mỗi bước đã chạy. Lưu biên bản ngoài repo nếu có chữ của tin hay tên người; repo chỉ nhận số đếm, mã lỗi và trạng thái.

| Kịch bản · bước | Thời điểm | Vai | Kết quả nhìn thấy | Mã lỗi | Đạt / không đạt | Bằng chứng (ngoài repo) |
|---|---|---|---|---|---|---|
| | | | | | | |
