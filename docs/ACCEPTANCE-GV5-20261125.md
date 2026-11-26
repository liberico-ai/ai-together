# Kịch bản nghiệm thu GIAO VIỆC 5 và 7 — tài khoản thật (0.9.4)

Version 1.3 · 26/11/2026 · bản 0.9.4 (merge `ad500f5`) · biên nhận: `docs/DELIVERY-025-gv5-f-release-094-20261126.md` (F), `docs/DELIVERY-024-gv5-d-e-release-093-20261126.md` (D, E, B6), `docs/DELIVERY-023-gv7-unlock-092-20261125.md` · runbook: `docs/RUNBOOK-094-20261126.md`

Bản 1.3 viết kịch bản 6 theo F đã merge.

Bản 1.2 viết lại kịch bản 4 và 5 theo D và E đã merge, và thêm kịch bản 13 (gỡ liên kết, OQ-61 B6).

Bản 1.0 viết cho 0.9.1 (merge `c3c9c4a`, `docs/DELIVERY-022-gv5-golive-tech-work-20261125.md`). Bản 1.1 sửa kịch bản 2 theo luật của 0.9.2 và thêm các kịch bản 8–12 (GIAO VIỆC 7).

**Ai chạy:** Codex, trên d1-ai1 sau khi triển khai, cùng người thật. Phiên PR soạn, không chạy.

**Người tham gia, nêu bằng vai.** Ai giữ vai nào nằm ngoài repo; phiên điều phối giữ bảng đó.
- `BoM-1`, `BoM-2`, `BoM-3`: ba thành viên BoM Tech. Mỗi người là ghế BoM của các dự án dùng để thử.
- `PM`: người giữ bảng danh sách việc của team. Cũng là một trong ba người BoM.
- `Tech-1`: một thành viên Team Tech không giữ ghế BoM. `Tech-1` có một người dự phòng, cũng trong roster.
- `Tech-2`: một thành viên roster chưa có membership ở dự án nào (kịch bản 12).
- `Tech-M`, `Tech-V`: hai thành viên roster, vai `manager` và vai `technical` hoặc `viewer` ở một dự án thử (kịch bản 8).
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
2. Cũng việc đó: trang `/bom` của một ghế liệt kê nó, vì khi duyệt, 0.9.2 ghi dòng nguồn `work_request:<id>` (M4). Bản 1.0 ghi ở bước này `SOURCE_RECONCILE`; với 0.9.2, gặp `SOURCE_RECONCILE` ở đây là **không đạt**. Chia lại việc này theo kịch bản 11.
3. Trên một việc đã có dòng `bom_sources` còn hiệu lực (trang `/bom` liệt kê nó): `BoM-1` gửi phiếu đổi người thực hiện. Ba ghế lần lượt chọn đồng ý. Sau phiếu đồng ý thứ hai, người thực hiện vẫn chưa đổi; sau phiếu thứ ba mới đổi, và phiếu có biên nhận.
4. Lặp lại bước 3 với người thực hiện mới là một trong ba ghế BoM: vẫn cần đủ ba phiếu đồng ý.
5. Duyệt một việc mới mà người thực hiện là một ghế BoM: duyệt được, kể cả khi ghế tự nhận việc (M1, 0.9.2). Chi tiết ở kịch bản 9. Bản 1.0 ghi ở bước này `SELF_ASSIGNMENT` / `BOM_ASSIGNEE_HELD`; hai mã đó đã bỏ.

## 3 · Tin thật đi hết luồng B

1. `BoM-1` gửi một tin gọi bot ở Dragon Forge.
   - Nhóm nhận «Đã nhận, mã IN-…», không có tên dự án.
2. `Tech-1` mở trang pool, thấy mục đó «chưa gán dự án», không có chữ của tin.
   - Chọn một dự án, lập yêu cầu. Trang «Việc chờ BoM duyệt» có dòng «Từ tin IN-…».
3. Một ghế BoM khác người lập duyệt. Mục pool hiện mã việc, người duyệt, thời điểm.
4. Một thành viên gửi tin tại LibeAI. Tin thành ứng viên như trước; ứng viên đã xác nhận lập được yêu cầu, ghế BoM duyệt.
5. Lặp bước 1–3 với một dự án thuộc miền IBS HI. Người vận hành chạy truy vấn chỉ đọc: không cột nào giữ chữ của tin.

## 4 · Ca lỗi cũ: bot trả đúng nguyên nhân (D, 0.9.3)

Chạy sau khi web 0.9.3 và plugin 0.3.5 đã chạy. Mỗi người ghi: lệnh hay tin đã gửi, nhóm (tên hiển thị), câu bot trả **nguyên văn**, mã trong ngoặc.

1. `BoM-1` lặp lại ca (a) `unauthorized`, `BoM-2` lặp lại ca (b) `SCOPE_DENIED`. Câu bot trả phải khớp một dòng của `docs/BOT-GROUPS-20261126.md` §3. Người vận hành đối chiếu nguyên nhân thật (ghép Telegram, membership, cấu hình nhóm; EV-16, EV-17). Ca chỉ được đối chiếu khi người báo xác nhận trên tin gốc.
2. Một tài khoản chưa ghép Telegram gõ `/libetech_check` → câu «chưa ghép», kèm cách ghép bằng `/libetech_link`.
3. `Tech-1` hỏi ở nhóm chung Team Tech → câu «nhóm không gắn dự án».
4. `Tech-1` hỏi một hồ sơ không có → câu «không thấy hồ sơ».
5. Người chỉ thuộc dự án IBS HI hỏi ở nhóm gắn dự án Liberico → câu «không thuộc dự án của nhóm»; câu trả lời không có tên dự án nào.
6. Trang «Dự án và việc Team Tech»: nhóm IBS HI không hiện ghi chú nguồn và có câu giải thích. LBRC và XECA vẫn hiện ghi chú.

## 5 · Tệp thật của team (E, 0.9.3)

1. Một thành viên gửi ở nhóm được ghi nhận, gọi bot, lần lượt một tệp quá 20 MB và một tệp loại không nhận. Câu trả lời nói đúng lý do và việc làm tiếp.
2. `PM` chọn nhầm tệp `.xlsx` ở trang nhập → câu báo nói đó là Excel và cách tải CSV.
3. Với ticket ngày 20/11: lặp lại với tệp thật hoặc tệp mẫu cùng loại, cùng kích thước (EV-05, EV-30, EV-31). «Quyền thư mục» cần EV-32. Không ghi ticket nào «đã đóng» nếu người báo chưa xác nhận.

## 6 · Lịch nhắc (F, 0.9.4)

Chạy khi 0.9.4 và plugin 0.3.6 đã chạy, và Chairman đã cho bật một đích ở một nhóm dùng để thử (runbook §5). Mỗi bước ghi giờ, nhóm (tên hiển thị), và tin nhận được **nguyên văn**.

1. **Ai ghi được lịch.** `PM` (một ghế BoM của dự án thử) và một BoM Tech mở «Lịch họp BoM» và thấy lịch. `Tech-1` mở thì không thấy lịch nào.
2. **Đổi một buổi.** Gửi tin xác nhận đổi giờ trong nhóm của dự án, gọi bot, lấy mã IN. `PM` ghi «Chỉ một buổi» kèm mã đó. Trang hiện buổi tới theo giờ mới, buổi sau giữ giờ gốc.
3. **Đổi cả lịch.** Ghi «Cả lịch định kỳ» với một mã IN khác. Các buổi từ buổi kế tiếp theo giờ mới.
4. **Không rõ.** Ghi «Chưa rõ áp cho buổi nào». Nhóm nhận đúng một câu hỏi nêu mã IN. Lịch đó ngừng nhắc tới khi trả lời trên web.
5. **Mã sai.** Dùng mã IN của một dự án khác: trang báo không tìm thấy tin trong dự án.
6. **Tin nhắc họp.** Trước buổi một ngày, trong khung giờ, nhóm đích nhận một tin nêu ngày, giờ và nguồn (lịch gốc hoặc mã IN). Chạy lại lượt hẹn giờ thì không có tin thứ hai.
7. **Đổi giờ sau khi đã nhắc.** Đổi giờ buổi đó: lượt sau gửi một tin mới với giờ mới.
8. **Trạng thái GO LIVE.** Buổi sáng ngày làm việc, nhóm đích nhận danh sách tên người chưa gửi yêu cầu và người có việc chưa có bằng chứng.
   - Đối chiếu với trang việc của dự án: đúng từng người.
   - Tin không có tiêu đề hay mã việc.
9. **Đúng nhóm.** Chỉ nhóm đích nhận tin; nhóm chung Team Tech và tin riêng không nhận gì. `send-reminders.ts --status` đếm đúng số tin `delivered` (EV-36).
10. **Tắt.** Tắt đích: không còn tin nào nữa; tin còn chờ chuyển sang `dead`, mã `REMINDER_TARGET_CHANGED`.

Ca (e) và (f) chỉ được đối chiếu khi người báo xác nhận trên tin gốc (EV-07, EV-08).

## 7 · PM nhập bảng

1. Chỉ sau khi `PM` xác nhận bản nguồn (EV-10). Người vận hành bật `LIBETECH_WORK_IMPORT=1`.
2. `PM` tải bản xuất CSV của trang nguồn lên «Nhập bảng việc», xem trước.
   - Ghi số dòng theo từng nhãn BU và số dòng cần đối chiếu theo mã lý do. Không cộng gộp các miền.
3. `PM` ghi. Số yêu cầu ghi được khớp số dòng hợp lệ của bước xem trước; mỗi yêu cầu «Chờ BoM duyệt».
4. `PM` nhập lại đúng tệp đó: 0 dòng mới.
5. `Tech-1` (không giữ ghế BoM của các dự án đích) nhập đúng tệp đó: 0 dòng mới; các dòng ra «cần đối soát» `STT_IMPORTED`, không nói mã hay nội dung của dòng đã nhập (OQ-62 câu 8).
6. Dòng IBS HI chỉ mang con trỏ, hash và dữ liệu công việc Tech: người vận hành chạy truy vấn chỉ đọc, không cột nào giữ chữ «Ghi chú» của dòng IBS HI.

## 8 · Ba vai cùng làm người thực hiện (M2, 0.9.2)

**Người tham gia,** đều có trong roster Team Tech, mỗi người một việc ở cùng một dự án thử:
- `Tech-M`: vai `manager` của dự án;
- `Tech-V`: vai `technical` hoặc `viewer` của dự án;
- `BoM-2`: một ghế BoM của dự án.

**Các bước:**
1. Mỗi người gửi một yêu cầu, ghi chính mình là người thực hiện. `BoM-1` duyệt cả ba.
   - Với người chưa có membership ở dự án, mỗi lần duyệt ghi một dòng cấp quyền. Người vận hành đếm số dòng đó bằng truy vấn chỉ đọc (chỉ ghi số).
2. Mỗi người tự làm trên việc của mình:
   - chuyển sang «Đang làm»;
   - nộp bằng chứng đúng SHA;
   - chuyển sang «Chờ nghiệm thu».

   Không ai cần vai `engineer`.
3. `Tech-V` (vai `viewer`) thử chuyển trạng thái việc của `Tech-M`: bị từ chối (`READ_ONLY` hoặc `NOT_ASSIGNED`).
4. Một tài khoản ngoài roster, chỉ có vai `viewer` ở dự án, thử nhận việc: lúc duyệt bị từ chối `INVALID_ASSIGNMENT`.
   - Câu báo nói «Chọn người khác» và không nêu tên dự án nào khác.

## 9 · Ghế BoM nhận việc, kể cả người duyệt tự nhận (M1, M3)

1. `Tech-1` gửi một yêu cầu và đề xuất chính mình làm người thực hiện.
2. `BoM-1` duyệt và đổi người thực hiện sang chính `BoM-1`. Duyệt được.
   - Trang việc hiện `BoM-1` là người thực hiện.
   - Sự kiện duyệt ghi người đề xuất (`Tech-1`), người chốt (`BoM-1`) và ai đổi (`BoM-1`). Người vận hành đọc bằng truy vấn chỉ đọc; biên bản chỉ ghi vai.
3. `BoM-2` gửi một yêu cầu, ghi `BoM-3` là người thực hiện. `BoM-1` duyệt: được.
4. `BoM-1` tạo một yêu cầu rồi tự duyệt: vẫn bị từ chối (`SELF_APPROVAL`). Câu báo nói nhờ một BoM Tech hoặc ghế BoM khác.
5. Người thực hiện trùng người nghiệm thu: vẫn bị từ chối (`SELF_ACCEPTANCE`).

## 10 · Duyệt cả lô nhập (M7)

1. Sau kịch bản 7, `BoM-1` mở «Việc chờ BoM duyệt» và chọn «Duyệt cả lô nhập (N yêu cầu)».
   - Dự án có nhiều dịch vụ thì chọn dịch vụ cho từng dự án.
2. Kết quả hiện từng dòng.
   - Mỗi yêu cầu được duyệt có sự kiện riêng và người duyệt là `BoM-1`.
   - Dòng lỗi ghi mã và câu báo riêng, ví dụ `SELF_APPROVAL` cho yêu cầu do `BoM-1` tạo (trường hợp PM là `BoM-1`) hoặc `ASSIGNEE_REQUIRED`. Dòng lỗi không chặn các dòng khác.
3. Với các dòng lỗi vì người duyệt là người tạo, `BoM-2` duyệt cả lô lần nữa. Lượt này chỉ lấy các yêu cầu còn chờ, nên chỉ các dòng đó được duyệt; yêu cầu đã duyệt không ghi gì mới.
4. Ghi số đếm theo nhãn BU: đã duyệt, lỗi theo mã. Không cộng gộp các miền.

## 11 · Chia lại 3/3 trên việc tạo sau 0.9.2 (M4)

1. Lấy một việc duyệt từ yêu cầu sau khi triển khai 0.9.2, ở một dự án có đủ ba ghế đã liên kết Telegram.
   - Trang `/bom` của một ghế liệt kê việc đó: nó có dòng nguồn của yêu cầu.
2. Trên trang `/bom`, `BoM-1` gửi phiếu đổi người thực hiện sang `Tech-1`. Phiếu được nhận, không bị từ chối `SOURCE_RECONCILE`. Sau hai phiếu đồng ý, người thực hiện chưa đổi. Sau phiếu thứ ba thì đổi, và phiếu có biên nhận.
3. Lặp lại với người thực hiện mới là một trong ba ghế BoM: vẫn cần đủ ba phiếu.
4. Lặp lại bước 1–2 với một việc đã duyệt dưới 0.9.1. Migration 028 đã điền bù dòng nguồn cho việc đó, nên trang `/bom` cũng liệt kê nó và phiếu cũng được nhận.
5. `BoM-1` đổi người thực hiện thẳng trên trang việc: vẫn bị từ chối `BOM_REQUIRED`.

## 12 · BoM Tech duyệt ở dự án chưa có ghế; Tech chưa có membership đăng nhập (M5, M6)

1. Một yêu cầu ở dự án chưa ghi ghế BoM. Trang hiện «Dự án chưa có ghế BoM — một BoM Tech sẽ duyệt.» Một BoM Tech khác người tạo duyệt được, không cần liên kết Telegram.
2. Lặp lại bước 1 với một dự án thuộc miền IBS HI. Người vận hành chạy truy vấn chỉ đọc: chỉ có con trỏ, hash và dữ liệu công việc Tech.
3. `Tech-2`, thành viên roster chưa có membership nào, đăng nhập.
   - Vào thẳng «Việc chờ BoM duyệt» và thấy danh mục dự án.
   - Gửi một yêu cầu, rồi thấy yêu cầu của mình.
   - Không thấy việc của dự án nào.
4. Một tài khoản ngoài roster, chưa có membership, đăng nhập: bị từ chối `NO_PROJECT_ACCESS`. Câu báo nói nhờ người quản trị thêm vào dự án hoặc vào Team Tech.

## 13 · Gỡ một liên kết sai (OQ-61 B6, 0.9.3)

1. `Tech-1` nối một tin của nhóm chung vào một việc sai, rồi tự gỡ với lý do «Sai việc». Thẻ hiện «Đã gỡ bởi …»; chuỗi bước không còn «Đã liên kết»; việc và yêu cầu không đổi.
2. `Tech-1` nối lại đúng cặp vừa gỡ → bị từ chối `LINK_REVOKED`. Nối sang việc đúng → được.
3. Một thành viên Team Tech khác, không tạo liên kết và không giữ ghế BoM của dự án, thử gỡ một liên kết còn hiệu lực → `REVOKE_DENIED`, kèm câu nói nhờ ai.
4. Gỡ liên kết duy nhất của một mục chọn nhầm dự án, rồi «Mở lại» → mục về «chưa gán dự án».

## Biên bản

Một dòng cho mỗi bước đã chạy. Lưu biên bản ngoài repo nếu có chữ của tin hay tên người; repo chỉ nhận số đếm, mã lỗi và trạng thái.

| Kịch bản · bước | Thời điểm | Vai | Kết quả nhìn thấy | Mã lỗi | Đạt / không đạt | Bằng chứng (ngoài repo) |
|---|---|---|---|---|---|---|
| | | | | | | |
