# Thẻ 3/3 trên màn Quyết định: phiếu còn bỏ phiếu được đứng trước trần, phiếu vừa đóng giữ chỗ, có câu báo «đã cắt» · 16/11/2026

Sửa mục 44 của `docs/DELIVERY-012-review-skills-20261115.md` (reviewer mã tầng 1 xếp P2 khi quét lỗi cùng lớp trước Codex vòng 4 của lát 3). Nhánh `fix/decision-cards-cut`, PR [#14](https://github.com/liberico-ai/ai-together/pull/14) vào `libetech-ai-os`. Gốc: `libetech-ai-os` tại `0560a4f5cbe88096e0d524fb19b2ed79d1081976` (việc bắt đầu trên `08322d3`; PR #13 merge giữa chừng chỉ đổi ba tệp tài liệu, nhánh được đưa lên gốc mới khi chưa có commit nào).

## Bốn mức — ghi riêng, không gọi mức sau khi mới đạt mức trước

| Mức | Trạng thái | Căn cứ |
|---|---|---|
| **Đã có mã** | **Mã ở `fba0134`**, PR [#14](https://github.com/liberico-ai/ai-together/pull/14), **merge vào `libetech-ai-os` ngày 16/11/2026 (`679ff6c`, «Merge pull request #14»)**, head lúc merge `24897ba`. Test trên hai động cơ, coverage, typecheck và build xanh với mã thoát 0 ở đúng mã đó; mười ca mới đỏ trên mã gốc và xanh sau khi sửa. Review tầng 1: xem bảng bằng chứng. **Cổng Codex:** vòng 1 `VERDICT: CHANGES_REQUIRED` (một P2, một P3; không P0/P1); Chairman chọn phương án (b) của OQ-47; một vòng sửa; **vòng 2 (base `0560a4f`, head `3f5a947`): dòng đầu là `VERDICT: PASS`**, kèm một góp ý P3 về tệp bằng chứng, đã sửa ở commit ghi kết quả cổng (commit đó chỉ có tài liệu và log; cổng chưa xem nó) | Bảng «Bằng chứng kiểm» bên dưới |
| Đã triển khai | **Chưa.** Không triển khai d1-ai1; PR này không có migration | Điểm dừng Chairman |
| Đã dùng thật | **Chưa.** Chỉ chạy trên dữ liệu tổng hợp; chưa người giữ ghế nào dùng màn Quyết định trên dữ liệu thật | — |
| Đã nghiệm thu | **Chưa.** Chưa có chữ ký nghiệm thu | — |

Mức «đã có mã» chỉ nói mã khớp test trên dữ liệu tổng hợp. Ba mức dưới đều **chưa**.

## Căn cứ và quyết định

- Đề bài do phiên điều phối giao ngày 16/11/2026: sửa mục P2 mà biên nhận lát 3 ghi nhận nhưng chưa sửa, thành một PR nhỏ vào `libetech-ai-os`; thêm ba mô-đun vào danh sách coverage.
- Mục được sửa: `docs/DELIVERY-012-review-skills-20261115.md`, «Khoảng trống phải biết», mục 44. Bốn mục P3 cùng đợt (45–48) **không thuộc PR này và không sửa**.
- Mẫu cách sửa: `src/server/review-delegations.ts`, hàm `list` (quyết «còn hiệu lực» trong SQL trước giới hạn dòng) và `src/server/list-cut.ts` (cờ «đã cắt»).
- **Làm rõ đề bài của phiên điều phối (không phải quyết định của Chairman):** đề ghi «không đụng `src/server/bom.ts`», nhưng giới hạn 30 phiếu nằm trong chính hàm chỉ đọc `BomService.pending()` của tệp đó (thêm ở lát 3, `f24fb43`). Phiên này dừng và hỏi; phiên điều phối trả lời: được sửa riêng `pending()` và kiểu trả về của nó, không đổi `read`, `command`, `assertSeat`, `members`, `card` hay câu ghi nào; phép kiểm ghế và ghép Telegram trong `pending()` giữ nguyên từng dòng; các test 3/3 và thẻ quyết định có sẵn giữ xanh, không sửa kỳ vọng. Phương án viết hàm đọc mới ngoài `bom.ts` bị loại vì đặt luật «ai xem được phiếu» ở hai nơi.
- **Quyết định của Chairman ngày 16/11/2026 về OQ-47 (finding P2 của Codex vòng 1): phương án (b).** Chọn qua hộp chọn ở phiên điều phối. Câu hỏi Chairman thấy: «OQ-47 (PR #14, thẻ 3/3): Codex nêu một finding P2 — một phiếu cũ vừa đóng (do lá «Từ chối» hoặc lá «Đồng ý» thứ ba) trở về chỗ theo thời điểm tạo và có thể rời danh sách 30 thẻ ngay lần tải lại, nên người vừa bỏ phiếu không thấy kết quả. Phiếu đã đóng trên màn Quyết định xếp thế nào?» Chairman trả lời: «(b) Xếp theo lúc đóng (Recommended)», mô tả của phương án đó: «Xếp phiếu đã đóng theo thời điểm đóng, mới đóng trước: thẻ vừa đóng luôn đứng ngay sau các phiếu còn bỏ phiếu được. Đổi thứ tự của mọi phiếu đã đóng; phiếu quá hạn chưa ai đóng phải định chỗ riêng. Một vòng sửa và một lượt Codex nữa.» Đủ bốn phương án Chairman thấy, cùng câu trả lời «Sửa theo (b)» nhận ở hộp bước tiếp của phiên làm PR, chép nguyên ở `docs/OPEN-QUESTIONS.md`, mục OQ-47. Đây là vòng sửa 1 trên tối đa 2 của cổng Codex cho PR này (ghi chú của phiên điều phối, không phải lời Chairman).

## Đã làm

| Việc | Kết quả | Tệp |
|---|---|---|
| Phiếu còn bỏ phiếu được không bị phiếu đã đóng chiếm chỗ | Câu đọc của `pending()` xếp phiếu «còn bỏ phiếu được» lên trước, mới tạo trước. Việc xếp nằm trong SQL, trước giới hạn dòng. Trần vẫn là 30 | `src/server/bom.ts` (chỉ `pending()` và một dòng `import`) |
| Phiếu vừa đóng giữ chỗ (OQ-47 b) | Sau nhóm còn bỏ phiếu được, các phiếu xếp mới nhất trước theo **lúc đóng** (`finished_at`); phiếu quá hạn mà chưa ai đóng không có lúc đóng nên lấy lúc quá hạn (`expires_at`). Phiếu vừa đóng vì thế đứng ngay sau các phiếu còn bỏ phiếu được, khi số phiếu đó dưới 30. Một phiếu được đóng sau khi đã quá hạn xếp theo lúc đóng | `src/server/bom.ts` (cùng câu đọc đó) |
| Câu báo «đã cắt» | `pending()` lấy 31 dòng, trả 30 và một cờ; `DecisionService.list` và `GET /api/decisions` trả thêm `reassignmentCardsTruncated`. Màn Quyết định hiện đúng một câu «Danh sách dài hơn phần đang hiện.» khi một trong hai cờ bật (`reviewCardsTruncated`, `reassignmentCardsTruncated`) | `src/server/decisions.ts`, `src/components/decisions.tsx` |
| Người không giữ ghế | Vẫn không nhận thẻ 3/3 nào; cờ mới luôn là `false` với họ và với ghế chưa ghép Telegram, nên không lộ dự án có bao nhiêu phiếu | `src/server/decisions.ts` |
| Coverage | Thêm `src/server/text-safety.ts`, `src/server/list-cut.ts`, `src/server/review-page.ts` vào `include`; ngưỡng 60 giữ nguyên | `vitest.config.ts` |
| Hồ sơ | Mục 44 của `DELIVERY-012` ghi «đã sửa»; bàn giao giao diện ghi thứ tự và cờ mới; OQ-47 cùng quyết định của Chairman; hai dòng roadmap | `docs/DELIVERY-012-review-skills-20261115.md`, `docs/UI-HANDOFF-3-decisions.md`, `docs/OPEN-QUESTIONS.md`, `docs/IMPLEMENTATION-ROADMAP.md` |

Không đổi: quyền ai xem được phiếu nào, luật 3/3 và máy trạng thái của nó, `read` và `command` của `BomService`, mọi migration, `bot-plugin/`, `AGENTS.md`, `CLAUDE.md`. Tuyến `src/app/api/decisions/route.ts` và trang `src/app/decisions/page.tsx` không sửa: cả hai chuyển nguyên kết quả của dịch vụ.

Ba dòng test có sẵn (có ở gốc) bị chạm, không dòng nào đổi điều khẳng định: hai dòng ở `tests/decisions.test.ts` đổi cách lấy kết quả của `pending()` (`.cards`, vì kiểu trả về đổi); tên một ca ở `tests/decisions-ui.test.tsx` bỏ chữ «only» (câu «đã cắt» nay hiện cho cả hai loại thẻ). Riêng các ca do chính PR này thêm: vòng sửa OQ-47 viết lại một ca với điều khẳng định khác (chỗ của phiếu quá hạn chưa đóng, theo luật mới) và đổi hàm dựng dữ liệu `copies()` (bản sao đã đóng nay đóng 30 giây sau khi tạo).

## Phán quyết của phiên (không phải quyết định của Chairman)

1. **«Còn mở» nghĩa là còn hiệu lực để bỏ phiếu:** phiếu lưu `pending` **và** chưa quá `expires_at`. Đây là hai điều kiện về trạng thái và hạn mà lệnh bỏ phiếu áp (`src/server/bom.ts`, trong `command`: `proposal.state==='pending'`, rồi `expires_at<=clock_timestamp()` thì đóng thành `expired`), và là nghĩa «thẻ còn hiệu lực» của `docs/SPEC-008-PM-operating-loop-20261111.md:218` («Mỗi lựa chọn gắn actor, phiếu, revision và hạn hiệu lực»). Lệnh bỏ phiếu còn một phép kiểm thứ ba mà thứ tự này không xét — xem khoảng trống 3. SPEC không nêu thứ tự của danh sách thẻ; thứ tự «phiếu mở trước» là yêu cầu của đề bài. Phiên điều phối đã đọc cách hiểu này trước khi mã được viết và không thấy điểm nào đổi quyền xem hay luật bỏ phiếu. Nếu sai: một mệnh đề `ORDER BY`.
2. **Chỗ của phiếu đã quá hạn mà chưa ai đóng.** Phiếu đó vẫn lưu `pending` (hệ thống chỉ đóng phiếu quá hạn khi có lệnh chạm tới nó) và không có `finished_at`. Chairman quyết thứ tự của phiếu **đã đóng**; mô tả phương án Chairman chọn chỉ nói loại phiếu này «phải định chỗ riêng». Phiên xếp nó theo `expires_at`, xen giữa các phiếu đã đóng: nhóm dưới là một dòng thời gian của các lần phiếu hết hiệu lực. Nó không được đưa lên nhóm trên, vì khi đó các phiếu quá hạn tích tụ dần sẽ đẩy mọi phiếu đã đóng ra khỏi 30 chỗ; nó cũng không bị dồn xuống cuối, vì khi đó một phiếu vừa quá hạn sẽ là thứ đầu tiên bị cắt. Hệ quả phải biết: một phiếu quá hạn **sau** lúc một thẻ khác đóng sẽ đứng trên thẻ đó, mỗi phiếu một chỗ (reviewer mã tầng 1 nêu: chữ «luôn» trong mô tả của phương án (b) không đúng tuyệt đối với cách xếp này); và một lá phiếu gửi muộn cho phiếu đã quá hạn đóng nó thành `expired`, từ đó nó xếp theo lúc đóng, tức lên đầu nhóm dưới, một lần cho mỗi phiếu. Trước vòng sửa theo OQ-47, phiên xếp loại phiếu này theo thời điểm tạo; cách đó không còn nghĩa khi phiếu đã đóng xếp theo lúc đóng. Có ca kiểm ghim đúng vị trí và ba phép đột biến (M2, M7, M9). Nếu sai: một nhánh của `CASE` trong `ORDER BY`.
3. **Dòng đã đóng mà thiếu `finished_at`** (lược đồ cho phép; role chạy ứng dụng không ghi ra được dòng như vậy, vì hàm đóng phiếu luôn ghi cột đó) lùi về thời điểm tạo, để nó không đứng trên một thẻ thật sự vừa đóng. Reviewer mã tầng 1 đề xuất khoá này. Nếu sai: một đối số của `COALESCE`.
4. **Một đồng hồ cho cả câu đọc:** hai khoá sắp xếp dùng `now()` (thời điểm bắt đầu giao dịch đọc). Câu đọc ở vòng cổng 1 gọi `clock_timestamp()` một lần; thứ tự mới cần giá trị đó ở hai khoá, và hai lần gọi có thể cho một phiếu vừa «còn mở» ở khoá thứ nhất vừa «hết hiệu lực» ở khoá thứ hai. `now()` cũ hơn đồng hồ bốn câu lệnh của cùng giao dịch (không câu nào giữ khoá dòng); phiên ước lượng là vài mili giây, chưa đo. Hệ quả: một phiếu quá hạn trong khoảng đó còn được xếp như còn mở trong một lượt đọc; lệnh bỏ phiếu vẫn quyết theo `clock_timestamp()`. Reviewer nêu `statement_timestamp()` cho giá trị mới hơn; phiên giữ `now()` theo khuyến nghị của reviewer. Nếu sai: đổi tên một hàm.
5. **Một câu cho cả hai cờ.** Màn hình không nói danh sách nào bị cắt (thẻ review hay thẻ 3/3). Nếu sai: thêm một câu thứ hai.
6. **Kiểu trả về của `pending()` đổi** từ mảng sang `{cards, truncated}`. Chỉ `src/server/decisions.ts` gọi hàm này. Nếu sai: không gì ngoài hai dòng test.
7. **Trước quyết định của Chairman, phiên không tự chọn luật cho phiếu vừa đóng:** ghi thành OQ-47 và coi là không chặn PR; cổng Codex vòng 1 nêu thành P2; phiên dừng, báo, và chỉ sửa sau lời «Sửa theo (b)».
8. **Thứ tự việc hồ sơ:** PR được mở trước lượt chạy cổng để số PR có trong hồ sơ tại head mà cổng xem; kết quả mỗi vòng cổng được ghi bằng một commit chỉ có tài liệu sau đó.

## Bằng chứng kiểm

Mọi số dưới đây là của cây ở `fba0134` (commit mã cuối; các commit sau chỉ thêm tài liệu). Tệp nằm ở `docs/reviews/decision-cards-cut-evidence-20261116/`; đường dẫn thư mục máy trong log được thay bằng `<repo>`.

| Lệnh | Kết quả | Tệp |
|---|---|---|
| `npm run test` (PGlite) | 58 tệp đạt, 10 bỏ qua; **983 ca đạt, 41 bỏ qua** (gốc: 973 đạt, 41 bỏ qua; thêm 10 ca) | `green-pglite.txt` |
| `npm run test` trên PostgreSQL thật (container thử, dữ liệu tổng hợp) | 68 tệp đạt; **1 024 ca đạt, 0 bỏ qua** (gốc: 1 014; thêm 10 ca) | `green-native.txt` |
| `npx vitest run --coverage` (PGlite) | statements 96,06 · branches 90,91 · functions 97,73 · lines 97,27; ngưỡng 60 giữ. `text-safety.ts`, `list-cut.ts`, `review-page.ts` đều 100% ở cả bốn số; `decisions.ts` 100%; `bom.ts` 98,41 · 95,18 · 100 · 98,13 | `coverage-pglite.txt` |
| `npm run typecheck` | mã thoát 0 | `typecheck.txt` |
| `npm run build` | mã thoát 0 | `build.txt` |
| Đỏ trước: tệp test cuối trên ba tệp nguồn của gốc | 10 ca đỏ (9 ca dịch vụ, 1 ca màn hình), **cả 10 đỏ vì điều khẳng định sai, không ca nào hết giờ**. Đây là lượt chạy lại sau Codex vòng 2; lượt trước đó có một ca dừng vì hết giờ và đã bị thay | `red.txt` |
| Đỏ trước của vòng sửa OQ-47 (b), phần 1: hai ca mới trên nguồn của vòng cổng 1 | 2 ca đỏ, 4 ca xanh | `fix1-red.txt` |
| Đỏ trước của vòng sửa, phần 2 (sau lượt soát riêng): ca «dòng đã đóng thiếu lúc đóng» trên nguồn ở `058e341` | 1 ca đỏ, 8 ca xanh. Hai ca thêm cùng lúc canh giữ hành vi `058e341` đã có (xếp theo lúc đóng kèm hai khoá phân định; phiếu đóng sau khi quá hạn): không đỏ, bằng chứng là M8, M10, M12, M13 | `fix1-red-2.txt` |
| Đột biến trên cây xanh | M1–M13 đều bị bắt bởi ít nhất một ca **đỏ vì điều khẳng định sai**; không phép nào có ca hết giờ (tệp ghi hai số đó cho từng phép). Sau mỗi phép, ba tệp nguồn được khôi phục và đối chiếu sha256; lượt kiểm chứng cuối 50/50. Đây là lượt chạy lại sau Codex vòng 2 | `mutation.txt` |
| Review tầng 1, toàn PR (trước cổng vòng 1) | `liberico-code-reviewer`: READY, không P0–P2. `liberico-security-reviewer`: CHANGES vì một dòng trong tệp bằng chứng, đã sửa; không thấy thay đổi nào về quyền | `tier1-reviews.md` |
| Review tầng 1, riêng vòng sửa OQ-47 (b) | `liberico-code-reviewer` soát commit `058e341`: READY, không P0/P1, không P2 trong mã; một P2 về hồ sơ (hồ sơ phải vào trước lượt chạy cổng — đã làm) và năm mục P3 trở xuống, đều đã xử lý ở `fba0134` hoặc ghi vào biên nhận này. **`fba0134` không có lượt soát tầng 1 riêng** | `tier1-reviews.md` |
| Cổng Codex vòng 1 (base `0560a4f`, head `9ec08fd`, diff đầy đủ 85 673 ký tự) | **`VERDICT: CHANGES_REQUIRED`**. [P2] `src/server/bom.ts:117` — phiếu vừa đóng có thể biến mất ngay sau khi bỏ phiếu thành công (căn cứ `docs/UI-HANDOFF-3-decisions.md:101`): sửa ở vòng sửa này theo quyết định OQ-47 (b). [P3] `docs/IMPLEMENTATION-ROADMAP.md:40`: đã sửa ở `575e786` | `codex-context-round-1.md`, `codex-round-1.md` |
| Cổng Codex vòng 2 (base `0560a4f`, head `3f5a947`, diff đầy đủ 129 777 ký tự) | **`VERDICT: PASS`**. Một mục [P3] `docs/DELIVERY-014…:61`: trong `red.txt`, ca ranh giới 30/31 dừng ở bước dựng dữ liệu vì hết giờ (máy đang tải cao lúc chạy) rồi báo PGlite đã đóng, nên chưa kiểm được điều khẳng định của ca đó trên mã gốc. Đã chạy lại: xem hai dòng «Đỏ trước» và «Đột biến» ở trên | `codex-context-round-2.md`, `codex-round-2.md` |

Không chạy: `pytest` (PR không đụng `bot-plugin/` hay tệp Python nào); kiểm tay bằng trình duyệt; kế hoạch truy vấn. Repo không có CI: mọi cổng ở đây là lượt chạy trên máy của phiên, không phải kiểm tra tự động trên PR. Bản ghi đầy đủ của Codex không vào repo; chỉ tệp kết quả và khối bối cảnh.

## Khoảng trống phải biết

1. **Trần vẫn là 30, chưa phân trang.** Dự án có từ 30 phiếu còn bỏ phiếu được trở lên thì các phiếu cũ nhất trong số đó (cũng là các phiếu sắp hết hạn nhất) không hiện, và không phiếu đã đóng nào hiện — kể cả phiếu người xem vừa bỏ lá cuối. Câu «đã cắt» có hiện. Quyết định OQ-47 (b) không phủ trường hợp này.
2. **Thứ tự trên màn hình đổi hai lần so với trước PR:** phiếu còn bỏ phiếu được đứng trên; các phiếu đã đóng xếp theo lúc đóng thay vì lúc tạo (một phiếu tạo lâu mà vừa đóng nay đứng trên một phiếu tạo sau mà đóng trước). Chưa kiểm bằng trình duyệt (thẻ 3/3 cần người giữ ghế đã ghép Telegram, chế độ mô phỏng không có); chỉ có test dịch vụ và test dựng tĩnh.
3. **Nhóm trên rộng hơn «bỏ phiếu được thật».** Lệnh bỏ phiếu đóng một phiếu thành `reconcile` khi phạm vi BoM, ghế, phiên bản đầu việc, nguồn hoặc phân công đề xuất đã đổi, trước khi ghi lá phiếu. Các phiếu đó vẫn lưu `pending` cho tới khi có người bấm, nên đứng ở nhóm trên và có nút; lá phiếu đầu tiên đóng chúng. Điều chắc chắn: mọi phiếu bỏ phiếu được đều ở nhóm trên; chiều ngược lại thì không.
4. **Ba đồng hồ.** Thứ tự dùng thời điểm bắt đầu giao dịch đọc (`now()`); lý do «Phiếu đã hết hạn.» trên thẻ dùng đồng hồ ứng dụng (có từ lát 3, `DELIVERY-012` mục 17); lệnh bỏ phiếu quyết theo `clock_timestamp()` của CSDL. Quanh đúng thời điểm hết hạn, một phiếu có thể đứng ở nhóm trên mà thẻ đã ghi hết hạn, hoặc ngược lại.
5. **Dòng không nhất quán:** một phiếu đã đóng mà `finished_at` rỗng được xếp theo thời điểm tạo (phán quyết 3). Chỉ ảnh hưởng thứ tự. Sửa tận gốc là một ràng buộc ở CSDL buộc «đã đóng thì có lúc đóng», thuộc một migration sau, ngoài PR này.
6. **Phiếu quá hạn chưa đóng** vẫn lưu `pending`; nhãn trạng thái trên thẻ vẫn đọc «Chưa đủ phiếu (n/3)» kèm câu «Phiếu đã hết hạn.» với người giữ ghế đã chốt — có từ trước, không sửa ở đây.
7. **Câu «đã cắt» không nói danh sách nào** và không nói còn bao nhiêu. Dòng «n thẻ» đếm chung cả hai loại.
8. **Có từ trước, PR này không đổi (reviewer bảo mật tầng 1 nêu):** `pending()` không đọc cờ `enabled` của phạm vi BoM, nên ghế của một phạm vi đang tắt vẫn thấy phiếu của dự án. Nếu luật mong muốn là «phạm vi tắt thì không hiện phiếu» thì cả cây gốc lẫn cây này đều chưa làm; cần một quyết định riêng.
9. **Có từ trước, đề cấm đụng:** `BomService.read()` lấy 30 phiếu mới nhất của một đầu việc, kể cả đã đóng, không có cờ «đã cắt». Nửa thẻ review của màn Quyết định lấy 200 tài liệu cập nhật gần nhất, kể cả đã có quyết định; phần này có cờ, và màn Review có phân trang.
10. **Không có chỉ mục riêng** cho câu đọc này (`bom_proposals` chỉ có chỉ mục theo `work_id`); như trước PR này, câu đọc lọc theo dự án rồi sắp xếp. Chưa xem kế hoạch truy vấn; không thêm migration theo giới hạn của đề.
11. **Lưới hồi quy còn thiếu** (hành vi đã được reviewer bảo mật dò ở vòng đầu và thấy đúng): không ca nào ở tầng HTTP đọc thân trả lời của `GET /api/decisions` cho người không giữ ghế khi dự án có hơn 30 phiếu (`tests/review-http.test.ts` còn cách trần phiên của kho phiên mô phỏng một phiên); không ca cho viewer và bot nằm trong dự án, cho ghế bị khoá hoặc mất tư cách thành viên. Ca «phiếu vừa đóng giữ chỗ» đi đường lá «Từ chối»; đường lá «Đồng ý» thứ ba (áp dụng, có biên nhận) dùng cùng hàm đóng phiếu và không có ca riêng cho thứ tự.
12. **Bằng chứng «đỏ trước»:** `red.txt` là lượt chạy tệp test **cuối** trên ba tệp nguồn của gốc, dựng lại sau mỗi lần ca kiểm đổi; log của lượt đỏ đầu tiên (năm ca, trước khi có mã) đã bị thay bằng bản dựng lại. Ba ca canh giữ tính chất mà mã ngay trước đó đã có, nên không có lượt «đỏ trước» riêng trên mã đó: «phép kiểm ghế chạy trước câu đọc phiếu» (ở gốc nó đỏ chỉ vì kiểu trả về của `pending()`; bằng chứng là M6), «xếp theo lúc đóng kèm hai khoá phân định» (M8, M12, M13) và «phiếu đóng sau khi quá hạn» (M10). `fix1-red.txt` được ghi trước khi ba ca của phần 2 tồn tại. **Một lượt bằng chứng đã hỏng vì máy tải cao và được chạy lại:** ở bản `red.txt` và `mutation.txt` mà cổng Codex vòng 2 đọc, một ca của `red.txt` và vài ca ở hai phép đột biến M1, M2 «đỏ» vì bước dựng dữ liệu hết giờ 30 giây chứ không vì điều khẳng định sai (Codex nêu mục của `red.txt`; phiên soát log thô và thấy thêm M1, M2). Hai tệp đó đã được thay bằng lượt chạy lại; `mutation.txt` nay ghi cho từng phép số ca đỏ vì điều khẳng định và số lần hết giờ. Các lượt chạy cả bộ (xanh) không có ca nào hết giờ.
13. Ba mô-đun mới vào coverage đều nhỏ và đạt 100%. `text-safety.ts` không có tệp test riêng, nó được phủ qua test của hợp đồng kỹ năng và của review. Trình báo cáo dạng bảng không in các tệp đạt 100%, nên ba tệp không có dòng trong `coverage-pglite.txt`; số của chúng đọc từ `coverage/coverage-summary.json` lúc chạy (tệp đó không vào repo).
14. Reviewer bảo mật tầng 1 chỉ soát cây trước vòng sửa OQ-47. Vòng sửa đó chỉ đổi thứ tự trong cùng tập dòng đã được phép xem (reviewer mã xác nhận ở `058e341`: cùng mệnh đề `WHERE`, cùng `LIMIT`, phép kiểm ghế không đổi). Commit `fba0134` (khoá sắp xếp ba nhánh, ba ca kiểm, lời chú thích) được làm sau lượt soát riêng và không có lượt soát tầng 1 nào nữa; phiên đọc diff, cổng Codex vòng 2 xem toàn bộ.
15. Bốn mục 45–48 của `DELIVERY-012` còn nguyên.

## Kiểm lại của phiên điều phối và merge

Phiên điều phối kiểm lại độc lập tại head `24897ba` ngày 16/11/2026, trong một worktree riêng, trước khi trình Chairman merge:

- `npx vitest run` trên PostgreSQL 16 thật: 68 tệp, 1024 test đạt, 0 bỏ qua. Trên PGlite: 58 tệp đạt và 10 bỏ qua, 983 test đạt và 41 bỏ qua (ca chỉ chạy native).
- `python3 -m pytest tests/test_bot_bridge.py -q`: 67 đạt, 69 subtest đạt (PR không đụng tệp Python; chạy để chắc cây vẫn xanh). `npm run typecheck` và `rm -rf .next && npm run build`: mã thoát 0.
- Kiểm tĩnh: sau `fba0134` chỉ có commit tài liệu; dòng đầu `codex-round-2.md` là `VERDICT: PASS`; quét 959 dòng có nội dung mà PR thêm (1 200 dòng tính cả dòng trống) không thấy khoá, token, chuỗi kết nối, đường dẫn thư mục máy hay mã nhóm Telegram thật; PR không đụng `AGENTS.md`, `CLAUDE.md`, `.env`, `data/`, `package.json`, `bot-plugin/`, `migrations/`.
- Không làm: không chạy coverage, không kiểm tay giao diện, không chạy lại Codex, không soát tầng 1 cho `fba0134` (khoảng trống 14 vẫn đúng).

PR #14 merge vào `libetech-ai-os` ngày 16/11/2026 (`679ff6c`, hai commit cha là `0560a4f` và `24897ba`) sau khi Chairman duyệt: «Merge PR #14». Cây sau merge trùng cây ở head `24897ba`; `main` không đổi (`d23e516`); không có lượt GitHub Actions mới. Đây là kết quả kiểm mã và việc merge; không nói gì về triển khai, dùng thật hay nghiệm thu.

## Điểm dừng — không làm, chờ Chairman

Triển khai d1-ai1 · kiểm tay thẻ 3/3 bằng trình duyệt với người giữ ghế thật. (Merge PR này đã làm ngày 16/11/2026 theo lời Chairman «Merge PR #14»; xem «Kiểm lại của phiên điều phối và merge».)

## Câu hỏi mở

- **OQ-47** — đã có quyết định của Chairman ngày 16/11/2026: phương án (b); xem «Căn cứ và quyết định». Phần phiên tự phán (chỗ của phiếu quá hạn chưa đóng) nêu ở phán quyết 2.
- Chưa thành câu hỏi mở, cần quyết nếu muốn đổi: phạm vi BoM đang tắt có được hiện phiếu không (khoảng trống 8); khi có từ 30 phiếu còn bỏ phiếu được trở lên, phiếu vừa đóng có cần chỗ riêng không (khoảng trống 1).
