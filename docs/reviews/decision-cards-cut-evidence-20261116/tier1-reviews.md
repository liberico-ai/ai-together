# Review tầng 1 — PR `fix/decision-cards-cut` · 16/11/2026

Bản ghi này do phiên làm PR lập từ báo cáo của hai reviewer; **không phải nguyên văn**, trừ dòng khuyến nghị đầu mỗi báo cáo. Khuyến nghị của reviewer là khuyến nghị cho Chairman, không phải phê duyệt. Hai reviewer chỉ đọc; không sửa tệp nào trong repo.

Cây được soát: ba tệp nguồn `src/server/bom.ts`, `src/server/decisions.ts`, `src/components/decisions.tsx` ở sha256 `90d13726…7699d` (cả hai reviewer ghi cùng giá trị). Sau review, tệp thứ ba đổi đúng một tên kiểu (`DecisionsPage` → `DecisionsResult`, theo góp ý của reviewer mã); sha256 của ba tệp ở cây cuối là `77b8bf00…9bd0`, ghi trong `mutation.txt`. Phần thay đổi sau review **không có lượt soát riêng**; phiên đọc diff.

## `liberico-security-reviewer`

Dòng đầu: `RECOMMENDATION: CHANGES`. Reviewer ghi rõ lý do duy nhất là một dòng trong một tệp bằng chứng; phần mã qua mọi phép kiểm về quyền.

| Mức | Nơi | Nội dung | Xử lý |
|---|---|---|---|
| P2 | `green-pglite.txt` | Một đường dẫn thư mục máy (có tên tài khoản hệ điều hành) trong tệp sắp vào repo công khai | Đã thay bằng `<repo>` ở mọi tệp bằng chứng; mọi log sinh sau đó được thay ngay lúc ghi |
| P3 | `tests/decisions.test.ts` | Không ca nào ghim việc phép kiểm ghế và ghép Telegram chạy **trước** câu đọc phiếu (reviewer dời câu đọc lên trước: 43/43 ca vẫn xanh) | Thêm ca «the seat and Telegram checks come before any ballot is read…»; phép đột biến M6 chứng minh ca bắt được |
| P3 | `tests/decisions.test.ts` | Ca «không lộ gì» chỉ phủ ba lớp người và khẳng định hai trường | Ca nay so **cả câu trả lời** trước và sau khi thêm 31 phiếu, có thêm người từng giữ ghế. Chưa thêm: ghế của phạm vi đang tắt, ba cách khác `bom_eligible_members` loại một ghế, viewer và bot trong dự án, ca ở tầng HTTP — reviewer đã dò các lớp này và thấy hành vi đúng; còn thiếu chỉ là lưới hồi quy |
| P3 | `DELIVERY-014` | Hai chỗ giữ chỗ chưa điền | Đã điền |

Reviewer trả lời từng điểm được hỏi:
1. **Người không giữ ghế không biết thêm gì.** Cùng một phép dò chạy trên bản sao cây gốc và cây đã sửa (PGlite), ở 0, 1, 32 và 62 phiếu, qua `DecisionService.list` và `handleDecisionsApi`. Điều phối, vai kỹ thuật và vai nghiệp vụ không giữ ghế: thân trả lời HTTP giống hệt nhau ở cả bốn mức; khác biệt duy nhất giữa hai cây là khoá cố định `"reassignmentCardsTruncated":false`. Viewer, bot, người dự án khác, tenant khác: 404 `SCOPE_DENIED` như cũ, bị từ chối trước khi `pending()` được gọi. Ghế mất ghép Telegram, ghế bị khoá, ghế không còn tư cách thành viên, người từng giữ ghế: không thẻ, cờ `false`. Số câu lệnh cho người không giữ ghế bằng nhau ở hai cây; không câu nào chạm bảng phiếu.
2. **Phép kiểm ghế và ghép Telegram không đổi từng dòng**, chạy trước câu đọc phiếu, trong cùng giao dịch có phạm vi.
3. **Với người giữ ghế:** cờ chỉ nói «dự án có hơn 30 phiếu»; dòng thứ 31 bị bỏ ở máy chủ; khoá sắp xếp chỉ gồm trạng thái, hạn, thời điểm tạo và mã phiếu, không có gì về người xem hay người khác.
4. **SQL:** không ghép chuỗi; `LIMIT` là tham số từ một hằng; `state` và `expires_at` là NOT NULL nên khoá sắp xếp không bao giờ NULL; RLS không bị vòng qua (kết luận từ đọc mã, chỉ chạy trên PGlite).
5. **Trang và component:** trang và handler không sửa, chuyển nguyên kết quả; câu hiện ra là hằng `TRUNCATED_COPY`; không chữ nào từ CSDL được vẽ theo cách mới.
6. **`bom.ts` ngoài `pending()`:** khác đúng một dòng `import`; phần từ `command` tới hết tệp trùng sha256 với gốc.
7. **Quét repo công khai:** 429 dòng thêm và các tệp bằng chứng không có email, IP, chuỗi kết nối, token, mã Telegram hay tên thật; một đường dẫn máy (mục P2 trên).
8. **Ca kiểm:** đủ cho các lớp nó nêu; các lớp còn thiếu liệt kê ở bảng trên.

Ngoài PR này, reviewer nêu để biết (không phải finding của PR): `pending()` **không đọc cờ `enabled`** của phạm vi BoM, ở cây gốc cũng như cây đã sửa, nên ghế của một phạm vi đang tắt vẫn thấy phiếu; và 18 tệp có sẵn trong repo chứa đường dẫn thư mục máy.

Reviewer không kiểm: PostgreSQL thật, kế hoạch truy vấn, trình duyệt, cả bộ test, đường phiên thật (phép dò dùng kho phiên mô phỏng), thời gian trả lời.

## `liberico-code-reviewer`

Dòng đầu: `RECOMMENDATION: READY`. Không P0, P1, P2. Reviewer ghi khuyến nghị phủ phần mã lúc soát; hồ sơ và bằng chứng lúc đó chưa xong.

| Mức | Nơi | Nội dung | Xử lý |
|---|---|---|---|
| P3 | `DELIVERY-014`, khoảng trống 1 | Nêu sai điều kiện: thẻ vừa đóng rời danh sách không chỉ khi có hơn 30 phiếu còn bỏ phiếu được, mà ngay trong tình huống PR nhắm tới (một phiếu còn mở cũ hơn 31 phiếu đã đóng: bỏ lá «Từ chối» hoặc lá «Đồng ý» thứ ba xong, tải lại thì thẻ không còn) | Sửa lời khoảng trống 1; ghi thành câu hỏi mở OQ-47 (không chặn PR). Giữ thẻ vừa bỏ phiếu trên màn là một luật hiển thị, không thuộc PR này |
| P3 | `tests/decisions.test.ts` | Ca về phiếu quá hạn không ghim luật «một nhóm, mới trước»: thứ tự ba tầng (mở, đã đóng, quá hạn sau cùng) vẫn qua | Ca đặt phiếu quá hạn vào giữa các phiếu đã đóng và khẳng định đúng vị trí; phép đột biến M7 chứng minh |
| P3 | Tệp bằng chứng | `red.txt` và `mutation.txt` có trước lần sửa ca kiểm; biên nhận còn ghi gốc cũ và chỗ giữ chỗ | Dựng lại cả hai trên tệp test cuối; biên nhận sửa theo |
| P3 | `DELIVERY-014`, phán quyết 1 | «Đúng hai điều kiện lệnh bỏ phiếu áp» nói quá: lệnh còn đóng phiếu thành `reconcile` (phạm vi, ghế, phiên bản việc, nguồn hoặc phân công đã đổi) trước khi ghi lá phiếu; các phiếu đó vẫn lưu `pending`, đứng nhóm trên và có nút | Sửa lời; ghi thành khoảng trống |
| Góp ý | Nhiều nơi | Tên ca W9 còn chữ «only»; tên kiểu trùng tên component trang; chú thích hàm `copies`; phép phân định `id DESC` khi trùng thời điểm tạo chưa có ca nào ghim (trước PR cũng chưa) | Ba mục đầu đã sửa; mục cuối ghi nhận |

Reviewer xác nhận bốn giới hạn bằng diff: (1) trong `bom.ts` chỉ `pending()` đổi — cắt `pending()` và dòng `import` mới ra thì hai bản trùng sha256; (2) bảy dòng của phép kiểm ghế và ghép Telegram trùng sha256 với gốc; (3) không đổi luật xem, luật 3/3, migration, `bot-plugin/`, `AGENTS.md`, `CLAUDE.md`; (4) hai dòng test có sẵn chỉ đổi cách lấy kết quả (`.cards`), không đổi điều khẳng định.

Reviewer trả lời các câu hỏi: khoá sắp xếp không bao giờ NULL, thứ tự toàn phần, đồng hồ được tính một lần cho mỗi dòng; phiếu đã đóng không thể chiếm chỗ phiếu còn bỏ phiếu được; cờ đúng ở 0, 1, 30, 31 phiếu và không thể bật với người không nhận thẻ 3/3; `BomService.pending` chỉ có một nơi gọi; không test nào khẳng định hình dạng đầy đủ của câu trả lời HTTP. Reviewer chạy thêm tám phép đột biến trên bản sao: sáu bị bắt, hai lọt (thứ tự ba tầng — nay bị M7 bắt; phép phân định `id`).

Quét cùng lớp, chỉ để biết: `BomService.read()` lấy 30 phiếu mới nhất của một đầu việc, kể cả đã đóng, không có cờ (có từ trước; đề cấm đụng); nửa thẻ review lấy 200 tài liệu cập nhật gần nhất kể cả đã quyết, có cờ và màn Review có phân trang; không có chỉ mục theo dự án trên `bom_proposals`.

Reviewer không kiểm: PostgreSQL thật, cả bộ test và coverage, build, trình duyệt, kế hoạch truy vấn ở khối lượng lớn.
