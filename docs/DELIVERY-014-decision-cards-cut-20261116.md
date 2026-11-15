# Thẻ 3/3 trên màn Quyết định: phiếu còn bỏ phiếu được đứng trước trần, có câu báo «đã cắt» · 16/11/2026

Sửa mục 44 của `docs/DELIVERY-012-review-skills-20261115.md` (reviewer mã tầng 1 xếp P2 khi quét lỗi cùng lớp trước Codex vòng 4 của lát 3). Nhánh `fix/decision-cards-cut`, PR [#14](https://github.com/liberico-ai/ai-together/pull/14) vào `libetech-ai-os`. Gốc: `libetech-ai-os` tại `0560a4f5cbe88096e0d524fb19b2ed79d1081976` (việc bắt đầu trên `08322d3`; PR #13 merge giữa chừng chỉ đổi ba tệp tài liệu, nhánh được đưa lên gốc mới khi chưa có commit nào).

## Bốn mức — ghi riêng, không gọi mức sau khi mới đạt mức trước

| Mức | Trạng thái | Căn cứ |
|---|---|---|
| **Đã có mã** | **Mã ở `1be10f5`**, PR [#14](https://github.com/liberico-ai/ai-together/pull/14), **chưa merge**. Test trên hai động cơ, coverage, typecheck và build xanh với mã thoát 0 ở đúng mã đó; sáu ca mới đỏ trên mã gốc và xanh sau khi sửa. Review tầng 1: `liberico-code-reviewer` khuyến nghị READY, không P0–P2; `liberico-security-reviewer` nêu một P2 về tệp bằng chứng (đã sửa) và không thấy thay đổi nào về quyền. **Cổng Codex: chưa chạy ở commit này; kết quả được ghi bằng commit tài liệu kế tiếp.** | Bảng «Bằng chứng kiểm» bên dưới |
| Đã triển khai | **Chưa.** Không triển khai d1-ai1; PR này không có migration | Điểm dừng Chairman |
| Đã dùng thật | **Chưa.** Chỉ chạy trên dữ liệu tổng hợp; chưa người giữ ghế nào dùng màn Quyết định trên dữ liệu thật | — |
| Đã nghiệm thu | **Chưa.** Chưa có chữ ký nghiệm thu | — |

Mức «đã có mã» chỉ nói mã khớp test trên dữ liệu tổng hợp. Ba mức dưới đều **chưa**.

## Căn cứ

- Đề bài do phiên điều phối giao ngày 16/11/2026: sửa mục P2 mà biên nhận lát 3 ghi nhận nhưng chưa sửa, thành một PR nhỏ vào `libetech-ai-os`; thêm ba mô-đun vào danh sách coverage. **Không có quyết định mới nào của Chairman trong PR này.**
- Mục được sửa: `docs/DELIVERY-012-review-skills-20261115.md`, «Khoảng trống phải biết», mục 44. Bốn mục P3 cùng đợt (45–48) **không thuộc PR này và không sửa**.
- Mẫu cách sửa: `src/server/review-delegations.ts`, hàm `list` (quyết «còn hiệu lực» trong SQL trước giới hạn dòng) và `src/server/list-cut.ts` (cờ «đã cắt»).
- **Làm rõ đề bài của phiên điều phối (không phải quyết định của Chairman):** đề ghi «không đụng `src/server/bom.ts`», nhưng giới hạn 30 phiếu nằm trong chính hàm chỉ đọc `BomService.pending()` của tệp đó (thêm ở lát 3, `f24fb43`). Phiên này dừng và hỏi; phiên điều phối trả lời: được sửa riêng `pending()` và kiểu trả về của nó, không đổi `read`, `command`, `assertSeat`, `members`, `card` hay câu ghi nào; phép kiểm ghế và ghép Telegram trong `pending()` giữ nguyên từng dòng; các test 3/3 và thẻ quyết định có sẵn giữ xanh, không sửa kỳ vọng. Phương án viết hàm đọc mới ngoài `bom.ts` bị loại vì đặt luật «ai xem được phiếu» ở hai nơi.

## Đã làm

| Việc | Kết quả | Tệp |
|---|---|---|
| Phiếu còn bỏ phiếu được không bị phiếu đã đóng chiếm chỗ | Câu đọc của `pending()` xếp phiếu «còn bỏ phiếu được» lên trước, mới tạo trước; sau đó các phiếu còn lại, mới tạo trước. Việc xếp nằm trong SQL, trước giới hạn dòng. Trần vẫn là 30 | `src/server/bom.ts` (chỉ `pending()` và một dòng `import`) |
| Câu báo «đã cắt» | `pending()` lấy 31 dòng, trả 30 và một cờ; `DecisionService.list` và `GET /api/decisions` trả thêm `reassignmentCardsTruncated`. Màn Quyết định hiện đúng một câu «Danh sách dài hơn phần đang hiện.» khi một trong hai cờ bật (`reviewCardsTruncated`, `reassignmentCardsTruncated`) | `src/server/decisions.ts`, `src/components/decisions.tsx` |
| Người không giữ ghế | Vẫn không nhận thẻ 3/3 nào; cờ mới luôn là `false` với họ và với ghế chưa ghép Telegram, nên không lộ dự án có bao nhiêu phiếu | `src/server/decisions.ts` |
| Coverage | Thêm `src/server/text-safety.ts`, `src/server/list-cut.ts`, `src/server/review-page.ts` vào `include`; ngưỡng 60 giữ nguyên | `vitest.config.ts` |
| Hồ sơ | Mục 44 của `DELIVERY-012` ghi «đã sửa»; bàn giao giao diện ghi thứ tự và cờ mới; câu hỏi mở OQ-47 và một dòng ở roadmap | `docs/DELIVERY-012-review-skills-20261115.md`, `docs/UI-HANDOFF-3-decisions.md`, `docs/OPEN-QUESTIONS.md`, `docs/IMPLEMENTATION-ROADMAP.md` |

Không đổi: quyền ai xem được phiếu nào, luật 3/3 và máy trạng thái của nó, `read` và `command` của `BomService`, mọi migration, `bot-plugin/`, `AGENTS.md`, `CLAUDE.md`. Tuyến `src/app/api/decisions/route.ts` và trang `src/app/decisions/page.tsx` không sửa: cả hai chuyển nguyên kết quả của dịch vụ.

Ba dòng test có sẵn bị chạm, không dòng nào đổi điều khẳng định: hai dòng ở `tests/decisions.test.ts` đổi cách lấy kết quả của `pending()` (`.cards`, vì kiểu trả về đổi); tên một ca ở `tests/decisions-ui.test.tsx` bỏ chữ «only» (câu «đã cắt» nay hiện cho cả hai loại thẻ).

## Phán quyết của phiên (không phải quyết định của Chairman)

1. **«Còn mở» nghĩa là còn hiệu lực để bỏ phiếu:** phiếu lưu `pending` **và** chưa quá `expires_at`. Đây là hai điều kiện về trạng thái và hạn mà lệnh bỏ phiếu áp (`src/server/bom.ts`, trong `command`: `proposal.state==='pending'`, rồi `expires_at<=clock_timestamp()` thì đóng thành `expired`), và là nghĩa «thẻ còn hiệu lực» của `docs/SPEC-008-PM-operating-loop-20261111.md:218` («Mỗi lựa chọn gắn actor, phiếu, revision và hạn hiệu lực»). Lệnh bỏ phiếu còn một phép kiểm thứ ba mà thứ tự này không xét — xem khoảng trống 4. SPEC không nêu thứ tự của danh sách thẻ; thứ tự «phiếu mở trước» là yêu cầu của đề bài. Nếu sai: một mệnh đề `ORDER BY`.
2. **Phiếu đã quá hạn mà chưa ai đóng** (vẫn lưu `pending`, vì hệ thống chỉ đóng phiếu quá hạn khi có lệnh chạm tới nó) **không** được đưa lên trước: nó giữ chỗ theo thời điểm tạo, xen giữa các phiếu đã đóng, như trước PR này. Lý do: nếu coi nó là «mở», các phiếu quá hạn tích tụ dần sẽ đẩy mọi phiếu đã đóng ra khỏi 30 chỗ. Có ca kiểm ghim đúng vị trí của nó và hai phép đột biến (M2, M7) chứng minh ca bắt được. Phiên điều phối đã đọc cách hiểu 1 và 2 trước khi mã được viết và không thấy điểm nào đổi quyền xem hay luật bỏ phiếu. Nếu sai: cùng mệnh đề `ORDER BY` đó.
3. **Một câu cho cả hai cờ.** Màn hình không nói danh sách nào bị cắt (thẻ review hay thẻ 3/3). Nếu sai: thêm một câu thứ hai.
4. **Kiểu trả về của `pending()` đổi** từ mảng sang `{cards, truncated}`. Chỉ `src/server/decisions.ts` gọi hàm này. Nếu sai: không gì ngoài hai dòng test.
5. **Không tự quyết việc giữ thẻ vừa đóng trên màn hình:** ghi thành OQ-47, không chặn PR, vì thứ tự của phiếu đã đóng không đổi so với trước. Nếu sai (tức lẽ ra phải dừng): PR chờ quyết định OQ-47 trước khi merge.
6. **Thứ tự việc hồ sơ:** PR được mở trước lượt chạy cổng Codex để số PR có trong hồ sơ tại head mà cổng xem; kết quả cổng được ghi bằng một commit chỉ có tài liệu sau đó.

## Bằng chứng kiểm

Mọi số dưới đây là của cây ở `1be10f5` (hai commit mã; các commit sau chỉ thêm tài liệu). Tệp nằm ở `docs/reviews/decision-cards-cut-evidence-20261116/`; đường dẫn thư mục máy trong log được thay bằng `<repo>`.

| Lệnh | Kết quả | Tệp |
|---|---|---|
| `npm run test` (PGlite) | 58 tệp đạt, 10 bỏ qua; **979 ca đạt, 41 bỏ qua** (gốc: 973 đạt, 41 bỏ qua; thêm 6 ca) | `green-pglite.txt` |
| `npm run test` trên PostgreSQL thật (container thử, dữ liệu tổng hợp) | 68 tệp đạt; **1 020 ca đạt, 0 bỏ qua** (gốc: 1 014; thêm 6 ca) | `green-native.txt` |
| `npx vitest run --coverage` (PGlite) | statements 96,06 · branches 90,91 · functions 97,73 · lines 97,27; ngưỡng 60 giữ. `text-safety.ts`, `list-cut.ts`, `review-page.ts` đều 100% ở cả bốn số; `decisions.ts` 100%; `bom.ts` 98,41 · 95,18 · 100 · 98,13 | `coverage-pglite.txt` |
| `npm run typecheck` | mã thoát 0 | `typecheck.txt` |
| `npm run build` | mã thoát 0 | `build.txt` |
| Đỏ trước: tệp test cuối trên ba tệp nguồn của gốc | 6 ca đỏ (5 ca dịch vụ, 1 ca màn hình) | `red.txt` |
| Đột biến trên cây xanh | M1–M7 đều bị ít nhất một ca bắt; sau mỗi phép, ba tệp nguồn được khôi phục và đối chiếu sha256; lượt kiểm chứng cuối 46/46 | `mutation.txt` |
| Review tầng 1 | `liberico-code-reviewer`: READY. `liberico-security-reviewer`: CHANGES vì một dòng trong tệp bằng chứng, đã sửa | `tier1-reviews.md` |
| Cổng Codex (`codex exec --sandbox read-only`, base `0560a4f`) | Chưa chạy ở commit này; kết quả được ghi bằng commit tài liệu kế tiếp | `codex-context-round-1.md`, `codex-round-1.md` |

Không chạy: `pytest` (PR không đụng `bot-plugin/` hay tệp Python nào); kiểm tay bằng trình duyệt; kế hoạch truy vấn. Repo không có CI: mọi cổng ở đây là lượt chạy trên máy của phiên, không phải kiểm tra tự động trên PR.

## Khoảng trống phải biết

1. **Thẻ vừa đóng có thể rời danh sách ngay** (reviewer mã tầng 1 dựng lại được). Một phiếu cũ còn bỏ phiếu được nay hiện ở đầu danh sách; khi nó đóng (lá «Từ chối», «Yêu cầu sửa», hoặc lá «Đồng ý» thứ ba) nó trở về chỗ theo thời điểm tạo, và nếu số phiếu mới hơn không còn bỏ phiếu được đủ lấp các chỗ còn lại của 30 thì lần đọc lại không còn thẻ đó. Người vừa bỏ phiếu chỉ thấy câu «đã cắt», không thấy kết quả phiếu của mình; biên nhận và phân công vẫn được ghi. Ví dụ: một phiếu còn mở duy nhất, cũ hơn 30 phiếu đã đóng. Trước PR này phiếu đó không hiện trên web chút nào. Xem OQ-47.
2. **Trần vẫn là 30, chưa phân trang.** Dự án có hơn 30 phiếu còn bỏ phiếu được thì các phiếu cũ nhất trong số đó (cũng là các phiếu sắp hết hạn nhất) không hiện, và không phiếu đã đóng nào hiện. Câu «đã cắt» có hiện.
3. **Thứ tự trên màn hình đổi** với mọi dự án có phiếu còn bỏ phiếu được cũ hơn một phiếu khác không còn bỏ phiếu được: phiếu còn bỏ phiếu được nay đứng trên. Chưa kiểm bằng trình duyệt (thẻ 3/3 cần người giữ ghế đã ghép Telegram, chế độ mô phỏng không có); chỉ có test dịch vụ và test dựng tĩnh.
4. **Nhóm trên rộng hơn «bỏ phiếu được thật».** Lệnh bỏ phiếu đóng một phiếu thành `reconcile` khi phạm vi BoM, ghế, phiên bản đầu việc, nguồn hoặc phân công đề xuất đã đổi, trước khi ghi lá phiếu. Các phiếu đó vẫn lưu `pending` cho tới khi có người bấm, nên đứng ở nhóm trên và có nút; lá phiếu đầu tiên đóng chúng. Điều chắc chắn: mọi phiếu bỏ phiếu được đều ở nhóm trên; chiều ngược lại thì không.
5. **Hai đồng hồ.** Thứ tự dùng đồng hồ CSDL (`clock_timestamp()`), lý do «Phiếu đã hết hạn.» trên thẻ dùng đồng hồ ứng dụng (có từ lát 3, `DELIVERY-012` mục 17). Quanh đúng thời điểm hết hạn, một phiếu có thể đứng ở nhóm trên mà thẻ đã ghi hết hạn, hoặc ngược lại. Lệnh bỏ phiếu vẫn quyết theo đồng hồ CSDL.
6. **Phiếu quá hạn chưa đóng** vẫn lưu `pending`; nhãn trạng thái trên thẻ vẫn đọc «Chưa đủ phiếu (n/3)» kèm câu «Phiếu đã hết hạn.» với người giữ ghế đã chốt — có từ trước, không sửa ở đây.
7. **Câu «đã cắt» không nói danh sách nào** và không nói còn bao nhiêu. Dòng «n thẻ» đếm chung cả hai loại.
8. **Có từ trước, PR này không đổi (reviewer bảo mật tầng 1 nêu):** `pending()` không đọc cờ `enabled` của phạm vi BoM, nên ghế của một phạm vi đang tắt vẫn thấy phiếu của dự án — ở cây gốc là 30 phiếu mới nhất, nay là 30 phiếu theo thứ tự mới kèm cờ. Nếu luật mong muốn là «phạm vi tắt thì không hiện phiếu» thì cả hai cây đều chưa làm; cần một quyết định riêng.
9. **Có từ trước, đề cấm đụng:** `BomService.read()` lấy 30 phiếu mới nhất của một đầu việc, kể cả đã đóng, không có cờ «đã cắt». Nửa thẻ review của màn Quyết định lấy 200 tài liệu cập nhật gần nhất, kể cả đã có quyết định; phần này có cờ, và màn Review có phân trang.
10. **Không có chỉ mục riêng** cho câu đọc này (`bom_proposals` chỉ có chỉ mục theo `work_id`); như trước PR này, câu đọc lọc theo dự án rồi sắp xếp. Chưa xem kế hoạch truy vấn; không thêm migration theo giới hạn của đề.
11. **Lưới hồi quy còn thiếu** (hành vi đã được reviewer bảo mật dò và thấy đúng): không ca nào ở tầng HTTP đọc thân trả lời của `GET /api/decisions` cho người không giữ ghế khi dự án có hơn 30 phiếu (`tests/review-http.test.ts` còn cách trần phiên của kho phiên mô phỏng một phiên); không ca cho viewer và bot nằm trong dự án, cho ghế bị khoá hoặc mất tư cách thành viên; phép phân định `id DESC` khi hai phiếu trùng thời điểm tạo chưa có ca nào ghim (trước PR cũng chưa).
12. **Bằng chứng «đỏ trước»:** `red.txt` là lượt chạy tệp test **cuối** trên ba tệp nguồn của gốc, dựng lại sau khi review tầng 1 làm ca kiểm đổi. Lượt đỏ đầu tiên (năm ca, trước khi có mã) chạy lúc chưa sửa `src/`; log đó đã bị thay bằng bản dựng lại. Ca thứ sáu («phép kiểm ghế chạy trước câu đọc phiếu») là ca canh giữ một tính chất không đổi: ở gốc nó đỏ chỉ vì kiểu trả về của `pending()`; bằng chứng của nó là phép đột biến M6.
13. Ba mô-đun mới vào coverage đều nhỏ và đạt 100%; số coverage chung gần như không đổi. `text-safety.ts` không có tệp test riêng, nó được phủ qua test của hợp đồng kỹ năng và của review. Trình báo cáo dạng bảng không in các tệp đạt 100%, nên ba tệp không có dòng trong `coverage-pglite.txt`; số của chúng đọc từ `coverage/coverage-summary.json` lúc chạy (tệp đó không vào repo).
14. Phần sửa sau review tầng 1 (hai ca kiểm, một tên kiểu, lời văn hồ sơ) không có lượt soát riêng của reviewer tầng 1; phiên đọc diff, rồi cổng Codex xem toàn bộ.
15. Bốn mục 45–48 của `DELIVERY-012` còn nguyên.

## Điểm dừng — không làm, chờ Chairman

Merge PR này · triển khai d1-ai1 · kiểm tay thẻ 3/3 bằng trình duyệt với người giữ ghế thật · quyết OQ-47.

## Câu hỏi mở

- **OQ-47** (`docs/OPEN-QUESTIONS.md`) — phiếu 3/3 vừa đóng có giữ chỗ trên màn Quyết định không. **Không chặn PR này**; hành vi hiện tại trùng phương án (a) của mục đó, không phải phương án được chọn.
- Chưa thành câu hỏi mở, cần quyết nếu muốn đổi: phạm vi BoM đang tắt có được hiện phiếu không (khoảng trống 8).
