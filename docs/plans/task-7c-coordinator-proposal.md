# Task 7c + bước 16b · Điều phối dự án trình phiếu cấp quyền duyệt bản chuẩn — Kế hoạch triển khai

> **Cho agent thực thi:** làm lần lượt từng task theo `superpowers:subagent-driven-development` (khuyến nghị) hoặc `superpowers:executing-plans`. Các bước dùng ô `- [ ]`. Mỗi task theo nhịp: viết ca kiểm → chạy thấy đỏ đúng lý do → viết mã tối thiểu → chạy xanh. Builder **không** commit, push hay mở PR: phiên Task 7c commit ở «Điểm commit» cuối mỗi task. Kế hoạch **không** gồm cổng Codex, biên nhận, cập nhật roadmap — phiên làm. Builder của một task chỉ cần đọc «Global Constraints» và đúng task của mình.

Version 0.1 · 16/11/2026 · do agent `planner` lập (mô hình Fable 5.2, không lùi mô hình) cho PR riêng sau lát 3. Base ghim `0560a4f5cbe88096e0d524fb19b2ed79d1081976` (nhánh `libetech-ai-os` sau khi PR #12 của lát 3 và PR #13 merge). Ghi chú của phiên Task 7c, 16/11/2026: kế hoạch được lập khi base còn là `08322d3c5ae214968890e86cfd2f38a16c026e38`; trong lúc lập, PR #13 merge vào `libetech-ai-os` và chỉ sửa chữ ở ba tệp tài liệu (`docs/DELIVERY-012-review-skills-20261115.md`, `docs/IMPLEMENTATION-ROADMAP.md`, `docs/reviews/REVIEW-slice-3-20261115.md`), không đổi mã, migration hay test. Nhánh làm việc chưa có commit nào nên đã fast-forward lên `0560a4f`; mọi lệnh `git diff` trong kế hoạch dùng base mới. Số gốc đo ở `08322d3` (PGlite 973 đạt, 41 bỏ qua; PostgreSQL thật 1.014 đạt) vẫn là số gốc. Nhánh làm việc `task-7c-coordinator-proposal`. Đích PR: `libetech-ai-os`.

**Căn cứ mở PR.** Quyết định của Chairman, chép nguyên từ `docs/OPEN-QUESTIONS.md:484-488` (phiên điều phối chuyển lời; mô tả phương án do phiên điều phối viết, Chairman thấy khi chọn):

> **Quyết định của Chairman ngày 15/11/2026 về nơi làm Task 7c (chọn qua hộp chọn ở phiên điều phối; phiên điều phối chuyển lời):** «Tách PR riêng sau lát 3 (Recommended)». Chairman cũng đã quyết cả ba mục dưới đây cùng ngày; quyết định ghi trong từng mục.
> - Câu hỏi Chairman thấy: «Task 7c — đường để điều phối dự án trình phiếu cấp quyền duyệt bản chuẩn (theo OQ-33 b) — làm ở đâu? Cổng bảo mật trên kế hoạch của task này trả «PLAN NEEDS CHANGES» (3 chỗ phải sửa, đã sửa trong kế hoạch) và nêu các câu hỏi OQ-35…38.»
> - Hai phương án Chairman thấy (nhãn — mô tả):
>   - «Tách PR riêng sau lát 3 (Recommended)» — «PR của lát 3 không có Task 7c; quyền duyệt bản chuẩn vẫn cấp được qua đường có sẵn (quản trị tài khoản trình, một BoM đồng ý, quản trị áp). Task 7c làm thành PR riêng ngay sau đó, có cổng bảo mật và cổng Codex riêng. Quyết định OQ-33 (b) giữ nguyên.»
>   - «Làm trong lát 3» — «Task 7c nằm trong PR của lát 3, viết mã sau khi cổng bảo mật xem lại kế hoạch đã sửa. PR lớn hơn và có thêm mã trong dịch vụ danh tính cho cổng Codex soát.»

**Mục tiêu:** người giữ vai `manager` của một dự án (theo CSDL danh tính) trình được phiếu `access_change` chỉ **thêm** mã `doc_approve:*` của chính dự án đó cho một thành viên của dự án đó, và rút được phiếu của chính mình; quản trị tài khoản huỷ được phiếu do điều phối trình bằng một lệnh riêng, vẫn là người duy nhất áp, và trước khi áp thấy trên `/team` phiếu đang mở, bộ quyền đóng băng và việc người trình còn điều phối dự án hay không; màn Review có khối trình phiếu cho điều phối dự án. **Chỉ tới mức «đã có mã», trên dữ liệu tổng hợp.** Người bỏ phiếu, hàm đếm và hạn 48 giờ là của cơ chế phiếu đổi quyền có sẵn.

**Kiến trúc:** đường của điều phối nằm trọn trong một mô-đun mới `src/server/doc-approval-proposals.ts` (trình, liệt kê, rút), gọi qua một handler mỏng `src/server/doc-approval-http.ts` và một tuyến `/api/team/doc-approvals`. Đường của quản trị tài khoản ở `src/server/accounts.ts` chỉ nhận ba chỗ **thêm**: lệnh `cancel_access_change`, trường `accessChange` trong danh sách tài khoản, và một phép kiểm lúc áp chỉ chạy cho phiếu không do quản trị trình; thân `proposeAccessChange` không sửa một dòng. Mọi lần ghi là một giao dịch `IdentityService.scope` với thứ tự khoá cố định (dòng quản trị → dòng tài khoản theo thứ tự mã → dòng phiếu), một «phiên bản chờ đợi» và một sự kiện bất biến trong `identity.events`. `src/server/account-approval.ts` không đổi một byte: ghế của người trình được loại bằng chính tham số có sẵn của `verifiedApprovalSeats`.

**Công nghệ:** TypeScript, Next.js App Router, PostgreSQL SQL, `pg.Pool`, PGlite (test một kết nối), zod, vitest. Không thêm dependency. **Không migration.** Không sửa mã Python.

**Căn cứ (đọc cùng kế hoạch):**
- `docs/OPEN-QUESTIONS.md`: OQ-33 (`:408-431`), OQ-35 (`:456-478`), quyết định nơi làm Task 7c (`:484-493`), OQ-36 (`:495-511`), OQ-37 (`:513-528`), OQ-38 (`:530-548`); nền: OQ-29 (`:319-336`), OQ-31 (`:356-383`); ba câu hỏi kế hoạch này mở: OQ-47 (`:693`), OQ-48 (`:704`), OQ-49 (`:715`).
- `docs/plans/slice-3-review-skills.md`: mục Task 7c (`:721-833`), bước 16b (`:1248-1255`), phán quyết S54–S60, S63, S66, S68, S75–S85 (`:189-234`). Đó là **đầu vào**; bốn giữ chỗ S57, S78, S82, S83 của nó hết hiệu lực, thay bằng quyết định ở mục dưới.
- `docs/reviews/slice-3-evidence-20261115/gates/security-gate-task-7c-plan.md` — cổng bảo mật trên kế hoạch cũ, «PLAN NEEDS CHANGES».
- `docs/SPEC-007-telegram-account-approval.md:33`, `:40` · `docs/SPEC-009-PM-BA-DOCUMENTS-20261111.md:47`, `:197` · `AGENTS.md` · skill `liberico-coding-rules`.
- Mã đã đọc tại base: `src/server/accounts.ts`, `account-approval.ts`, `access-grants.ts`, `identity.ts`, `outbox.ts`, `bridge.ts`, `review-delegations.ts`, `review-http.ts`, `review-page.ts`; `migrations/002`, `004`, `009`, `017`, `018`, `019`; `src/components/team-accounts.tsx`, `approvals.tsx`, `review.tsx`, `review-view.ts`; `src/app/review/page.tsx`, `src/app/api/team/accounts/route.ts`, `src/app/api/reviews/[[...path]]/route.ts`; `bot-plugin/__init__.py` (chỉ đọc).

## Quyết định của Chairman phải áp

Mỗi khối dưới đây **chép nguyên** từ `docs/OPEN-QUESTIONS.md` (dòng nêu ở đầu khối): dòng quyết định, câu hỏi Chairman thấy, mọi phương án Chairman thấy. Mô tả phương án do phiên điều phối viết; Chairman thấy chúng khi chọn. Trong mỗi khối, lời của Chairman là câu trong «…» ở dòng quyết định; phần còn lại là chữ của hồ sơ do phiên điều phối ghi (khối OQ-38 kèm dòng «Hệ quả của câu trả lời» của hồ sơ). Không câu nào trong mục này do `planner` viết lại.

**OQ-33** (`docs/OPEN-QUESTIONS.md:416-421`):

> - **Quyết định 15/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối; phiên điều phối chuyển lời):** «(b) Thêm đường cho manager». Chairman không chọn phương án được đánh dấu Recommended.
>   - Câu hỏi Chairman thấy: «OQ-33 (lát 3): ai được đề xuất phiếu cấp quyền duyệt bản chuẩn tài liệu? Theo OQ-31 (b), quyền này đi qua phiếu đổi quyền một BoM; trong cơ chế phiếu hiện có, chỉ quản trị tài khoản đề xuất và áp trên /team (ghi chú OQ-29: «Chairman vẫn là người đề xuất trên /team»).»
>   - Ba phương án Chairman thấy (nhãn — mô tả):
>     - «(a) Giữ cơ chế hiện có (Recommended)» — «Chỉ quản trị tài khoản đề xuất và áp trên /team; không thêm mã. Mỗi lần cấp quyền duyệt bản chuẩn đều cần Chairman đề xuất rồi áp, sau khi một BoM đồng ý. Xét lại (b) trước pilot.»
>     - «(b) Thêm đường cho manager» — «Điều phối dự án đề xuất phiếu cho thành viên dự án mình, cùng người bỏ phiếu, cùng hàm đếm, cùng hạn; quản trị tài khoản vẫn là người áp. Cần kế hoạch bổ sung và review bảo mật riêng vì thêm người đề xuất mới trong dịch vụ danh tính.»
>     - «(c) Như (b), bỏ bước áp» — «Như (b), và quyền tự có hiệu lực khi phiếu đủ, không cần bước áp. Đổi luật của cơ chế phiếu đổi quyền đã có từ lát 2.»

**OQ-35** (`docs/OPEN-QUESTIONS.md:465-471`):

> - **Quyết định 15/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối; phiên điều phối chuyển lời):** «(a) Người trình không bỏ phiếu (Recommended)».
>   - Câu hỏi Chairman thấy: «OQ-35 (lát 3): điều phối dự án đang giữ ghế BoM trình phiếu cấp quyền duyệt bản chuẩn (đường mới của OQ-33 b) thì phiếu của chính họ có được tính không? Với mã hiện có, hàm đếm không biết ai là người trình, nên một người vừa trình vừa đồng ý là phiếu đủ (quản trị tài khoản vẫn phải áp).»
>   - Bốn phương án Chairman thấy (nhãn — mô tả):
>     - «(a) Người trình không bỏ phiếu (Recommended)» — «Ghế của người trình bị loại khỏi danh sách người bỏ phiếu đóng băng của phiếu đó, như đang loại người được đổi quyền; cần ít nhất một ghế BoM khác. Không sửa hàm đếm, chỉ đổi cách chọn người bỏ phiếu cho đường của điều phối dự án.»
>     - «(c) Người giữ ghế không trình» — «Người đang giữ ghế duyệt tài khoản không trình phiếu qua đường mới; họ nhờ quản trị tài khoản trình theo đường có sẵn. Không sửa hàm đếm, không sửa cách chọn người bỏ phiếu; đây là hành vi giữ chỗ hiện tại. Nếu các điều phối dự án cũng chính là người giữ ghế BoM thì đường mới gần như không dùng được.»
>     - «(b) Phiếu người trình được tính» — «Phiếu của người trình được tính như mọi ghế BoM, đúng mã hiện có, không sửa gì. Một người vừa trình vừa đồng ý là đủ; quản trị tài khoản vẫn là người áp.»
>     - «(d) Ở lại nhưng không tính» — «Người trình vẫn nằm trong danh sách người bỏ phiếu nhưng phiếu đồng ý của họ không tính. Phải sửa hàm đếm accessChangeTally của lát 2.»

**OQ-36** (`docs/OPEN-QUESTIONS.md:503-509`):

> - **Quyết định 15/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối; phiên điều phối chuyển lời):** «(b) cùng (d) (Recommended)».
>   - Câu hỏi Chairman thấy: «OQ-36: ai được huỷ hoặc rút một phiếu đang mở do điều phối dự án trình? Hiện không ai huỷ được phiếu đổi quyền, và mỗi người chỉ có một phiếu đang mở, nên phiếu của điều phối chặn phiếu của quản trị tài khoản cho cùng người tới 48 giờ. (Phương án (c) của hồ sơ — mọi manager của dự án rút được, planner không khuyến nghị — không có trong bốn lựa chọn; anh gõ vào ô khác nếu muốn.)»
>   - Bốn phương án Chairman thấy (nhãn — mô tả):
>     - «(b) cùng (d) (Recommended)» — «Người trình rút được phiếu của chính mình, kèm căn cứ. Quản trị tài khoản huỷ được phiếu bằng một lệnh riêng, kèm căn cứ, không đổi phiên bản tài khoản và không đụng phiên đăng nhập của thành viên.»
>     - «(a) Không ai, như hiện nay» — «Phiếu chỉ kết thúc bằng phiếu bầu, hạn 48 giờ hoặc khi tài khoản đổi. Quản trị thay phiếu bằng đòn bẩy có sẵn: một lệnh tăng phiên bản tài khoản rồi trình phiếu của mình, chấp nhận việc lệnh đó thu hồi phiên đăng nhập của thành viên.»
>     - «(b) Chỉ người trình rút» — «Người trình rút được phiếu của chính mình, kèm căn cứ. Quản trị tài khoản vẫn chỉ có đòn bẩy có sẵn.»
>     - «(d) Chỉ quản trị huỷ» — «Quản trị tài khoản huỷ được phiếu bằng một lệnh riêng, kèm căn cứ, không đổi phiên bản tài khoản và không đụng phiên của thành viên. Người trình không tự rút được.»

**OQ-37** (`docs/OPEN-QUESTIONS.md:521-526`):

> - **Quyết định 15/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối; phiên điều phối chuyển lời):** «(c) Áp được, phải nêu rõ». Chairman không chọn phương án được đánh dấu Recommended.
>   - Câu hỏi Chairman thấy: «OQ-37: phiếu do điều phối dự án trình có còn áp được không khi người trình mất vai manager, rời dự án hoặc bị khoá trước lúc quản trị tài khoản áp? Lệnh áp hiện chỉ xét người được đổi quyền, không xét người trình.»
>   - Ba phương án Chairman thấy (nhãn — mô tả):
>     - «(b) Không còn áp được (Recommended)» — «Phiếu không còn áp được khi người trình không còn là manager đang hoạt động của dự án đó; phiếu đóng khi việc đó xảy ra. Quản trị tài khoản muốn cấp thì tự trình.»
>     - «(c) Áp được, phải nêu rõ» — «Vẫn áp được, nhưng /team phải nêu rõ người trình không còn điều phối dự án trước khi quản trị áp.»
>     - «(a) Vẫn áp được» — «Vẫn áp được; quản trị tài khoản tự quyết. Đúng mã hiện có.»

**OQ-38** (`docs/OPEN-QUESTIONS.md:539-546`):

> - **Quyết định 15/11/2026 (Chairman, chọn qua hộp chọn ở phiên điều phối; phiên điều phối chuyển lời):** «(c) Được, phiếu nêu rõ (Recommended)».
>   - Câu hỏi Chairman thấy: «OQ-38: điều phối dự án có được trình phiếu cấp quyền duyệt bản chuẩn cho một đồng điều phối của cùng dự án không? Hai đồng điều phối trình cho nhau thì đạt đúng kết quả mà luật cấm tự trình chặn. Chọn (a), (b) hoặc (c) cũng là xác nhận cách hiểu của phiên điều phối: điều phối dự án không tự trình cho chính mình.»
>   - Bốn phương án Chairman thấy (nhãn — mô tả):
>     - «(c) Được, phiếu nêu rõ (Recommended)» — «Được, nhưng phiếu phải nêu rõ cho người bỏ phiếu rằng người được cấp cũng là điều phối của dự án đó. Một ghế BoM và quản trị tài khoản vẫn đứng giữa.»
>     - «(a) Được» — «Được; giữa hai người vẫn còn một ghế BoM bỏ phiếu và quản trị tài khoản áp.»
>     - «(b) Không» — «Người được cấp đang giữ vai manager ở chính dự án đó phải do quản trị tài khoản trình theo đường có sẵn.»
>     - «Cho cả tự trình» — «Bỏ cách hiểu «không tự trình cho mình»: điều phối dự án được trình phiếu cả cho chính mình, nên trình cho đồng điều phối đương nhiên được.»
> - **Hệ quả của câu trả lời, theo đúng câu hỏi Chairman thấy:** câu trả lời này cũng xác nhận điều phối dự án không tự trình cho chính mình. Ghi chú 3 của phiên điều phối kèm OQ-33 vì vậy không còn «chờ xác nhận».

## Ghi chú của phiên điều phối (không phải lời Chairman)

Các dòng dưới là ghi chú của phiên điều phối kèm quyết định; kế hoạch làm theo, nhưng chúng không phải lời Chairman.

- Kèm OQ-33 (`docs/OPEN-QUESTIONS.md:422-428`): đường mới chỉ là phiếu cấp quyền duyệt bản chuẩn cho thành viên dự án mình, không thêm dự án, không nâng vai, không mở quyền báo cáo; giữ người bỏ phiếu, hàm đếm, hạn và bước áp của quản trị tài khoản; quyền không tự có hiệu lực khi phiếu đủ; review bảo mật riêng trước khi viết mã; ca quyền âm tối thiểu (ghi chú 5).
- Kèm OQ-35, ghi chú 1 (`:473`): chỉ đổi cách chọn người bỏ phiếu cho đường của điều phối dự án; `accessChangeTally` không sửa; đường trình của quản trị tài khoản không đổi. Ghi chú 2 (`:474`), chép nguyên:

> Mô tả Chairman chọn ghi «cần ít nhất một ghế BoM khác». Khi loại cả người được đổi quyền lẫn người trình mà không còn ghế BoM nào thì phiếu không mở được; có ca kiểm cho trường hợp đó, và lỗi trả về không lộ ai đang giữ ghế.

- Kèm OQ-35, ghi chú 3 (`:475`): phiếu từ chối của Chairman vẫn đóng một phiếu do điều phối dự án trình và phiếu đồng ý của Chairman vẫn không tính; Chairman chưa nói gì về điểm này; giữ nguyên hàm đếm. **Vẫn chờ Chairman xác nhận** cùng S13 của lát 2 — kế hoạch này không nới, không siết.
- Kèm OQ-36 (`:510`): giữ chỗ S78 đổi theo (b) cùng (d); hai điểm lời Chairman chưa phủ: phiếu bị rút hoặc bị huỷ thì người trình có được trình lại ngay không (khoảng chờ 24 giờ theo cặp là phán quyết của planner) — nay là OQ-47; và phương án (c) không được chọn nên manager khác của dự án không rút được phiếu của người trình.
- Kèm OQ-37 (`:527`): **không chặn** lệnh áp; nêu rõ trên `/team` trước khi quản trị áp.
- Kèm OQ-38 (`:547`): đổi cách khoá hai dòng tài khoản, và cổng bảo mật xem lại.
- Kèm quyết định nơi làm Task 7c (`:489-493`): PR riêng có cổng bảo mật và cổng Codex riêng; trần vòng sửa 3 cho mỗi task theo R5, 2 cho cổng Codex.

## Bảng: quyết định của Chairman → chỗ áp trong kế hoạch

| Quyết định | Điều phải đúng trong mã | Chỗ áp |
|---|---|---|
| OQ-33 (b) | Điều phối dự án trình phiếu cho thành viên dự án mình; cùng người bỏ phiếu, cùng hàm đếm, cùng hạn; quản trị tài khoản vẫn là người áp; quyền không tự hiệu lực | Task 1 (`propose`, bước P0–P17; ca 2–5, 10); Task 3 (ca A1) |
| OQ-35 (a) | Ghế của người trình không nằm trong danh sách người bỏ phiếu đóng băng; cần ít nhất một ghế BoM khác; `accessChangeTally` không sửa | Task 1 (bước P7, P8; ca 6–9); T7C-2, T7C-3 |
| OQ-35, ghi chú 2 của phiên điều phối | Loại cả người trình lẫn người được cấp mà không còn ghế BoM: phiếu không mở, lỗi không lộ ai giữ ghế | Task 1 (ca 8) |
| OQ-36 (b) | Người trình rút được phiếu của chính mình, kèm căn cứ; không ai khác rút được (phương án (c) không được chọn) | Task 2 (`withdraw`; ca W1–W7); Task 4 (nút «Rút phiếu») |
| OQ-36 (d) | Quản trị tài khoản huỷ bằng một lệnh riêng, kèm căn cứ; phiên bản tài khoản và phiên đăng nhập của thành viên không đổi | Task 2 (`cancel_access_change`; ca C1–C6); Task 3 (nút «Huỷ phiếu của điều phối») |
| OQ-37 (c) | Phiếu vẫn áp được khi người trình mất vai; `/team` nêu rõ trước khi quản trị áp; lệnh áp không bị chặn | Task 3 (`list.accessChange.proposerIsCoordinator`; ca A3, U3); T7C-11 |
| OQ-38 (c) | Trình cho đồng điều phối của cùng dự án được; phiếu nêu rõ cho người bỏ phiếu rằng người được cấp cũng là điều phối của dự án đó | Task 1 (bước P8, P12; ca 15); Task 3 (ca U8); Task 4 (ghi chú trong biểu mẫu); T7C-5, T7C-7, T7C-8 |
| OQ-38, hệ quả (`:546`) | Điều phối dự án không tự trình cho chính mình — nay là quyết định | Task 1 (bước P2, P8; ca «in any letter case») |
| Nơi làm Task 7c | PR riêng, cổng bảo mật và cổng Codex riêng | «Cổng trước khi viết mã» trong Global Constraints; Task 5 |

## Điểm lời Chairman chưa phủ → câu hỏi mở và hành vi giữ chỗ

Ba hành vi dưới đây là **giữ chỗ fail-closed, không phải phương án được chọn**. Không mục nào chặn PR. Ba câu hỏi đã được `planner` ghi vào `docs/OPEN-QUESTIONS.md:693-724`; builder không sửa tệp đó.

| Câu hỏi | Giữ chỗ trong kế hoạch | Chỗ đặt | Đổi khi có quyết định |
|---|---|---|---|
| **OQ-47** — phiếu bị rút hoặc bị huỷ thì người trình có được trình lại ngay cho cùng người không | Giữ khoảng chờ 24 giờ theo cặp (người trình, người được cấp), tính từ lúc mở phiếu trước, cho mọi phiếu chưa được áp; `RATE_LIMITED` | Task 1 (bước P14; ca 27); Task 2 (ca W8, C2) | Một điều kiện trong câu đọc khoảng chờ; các ca kiểm tương ứng; một câu gợi ý trên màn Review |
| **OQ-48** — lệnh huỷ của quản trị tài khoản áp cho phiếu nào | Chỉ phiếu đổi quyền mà người trình không phải quản trị tài khoản; phiếu do quản trị trình bị từ chối `BALLOT_CANCEL_NOT_ALLOWED` | Task 2 (ca C4); Task 3 (nút chỉ hiện ở phiếu của điều phối) | Bỏ một phép kiểm và một điều kiện hiện nút |
| **OQ-49** — người trình không còn điều phối dự án có còn rút được, còn xem được phiếu mình đã trình không | Không: `MANAGER_REQUIRED` khi rút và khi liệt kê; quản trị tài khoản huỷ bằng lệnh riêng | Task 1 (`listOwn`; ca HTTP T14); Task 2 (ca W4) | Bỏ một phép kiểm ở lệnh rút và ở danh sách |

## Global Constraints

Mọi task mặc nhiên phải thoả các dòng dưới.

**Cổng trước khi viết mã.** `liberico-security-reviewer` soát kế hoạch này (mục «Review Focus», T7C-2, T7C-3, T7C-5, T7C-6, T7C-11 và ba giữ chỗ OQ-47…49) và phiên ghi kết quả thành một tệp mới trong `docs/reviews/task-7c-evidence-20261116/gates/`. Builder chỉ bắt đầu Task 1 khi không còn mục phải sửa.

**Phạm vi và điểm dừng**
- Chỉ tới «đã có mã», trên dữ liệu tổng hợp. Không triển khai d1-ai1, không áp migration lên dữ liệu thật, không khởi động lại gateway, không gửi tin thật, không gọi mô hình.
- **Không migration.** `git diff --name-only 0560a4f -- migrations` phải rỗng. Nếu thấy không làm được khi thiếu migration: **dừng và báo**, không tự thêm (số kế tiếp là 022, phải idempotent, có tệp lùi `migrations/rollback/022_*.sql`, qua review CSDL, và lát 4 phải dời số).
- Không đổi một byte: `src/server/account-approval.ts`, `bot-plugin/`, `AGENTS.md`, `CLAUDE.md`. Nếu thấy không tránh được việc sửa `account-approval.ts`: **dừng và báo**.
- Đường của quản trị tài khoản không đổi hành vi: thân `proposeAccessChange` (`src/server/accounts.ts`) không sửa một dòng; lệnh `access` với phiếu do quản trị trình giữ nguyên từng mã lỗi, từng câu, từng khoá của sự kiện `account_access`. Giữ xanh, **không sửa kỳ vọng**: `tests/access-change.test.ts`, `tests/account-approval-dm.test.ts`, `tests/onboarding-feedback.test.ts`, `tests/doc-approver-grant.test.ts`, `tests/doc-approver-flow.test.ts`, `tests/identity.test.ts`, `tests/spec003.test.ts`, `tests/review-ui.test.tsx`, `tests/review-page.test.ts`, `tests/review-http.test.ts`, `tests/rsc-boundary.test.ts`, `tests/test_bot_bridge.py`. Vào `tests/doc-approver-ui.test.tsx` chỉ **thêm** ca.
- Không dependency mới, không mẫu outbox mới, không lệnh cầu nối mới.
- Fixture chỉ dùng dữ liệu tổng hợp (uuid cố định hoặc `randomUUID()`, tên kiểu «Điều phối mẫu»); không bí mật, không mã nhóm Telegram thật, không tên người thật.
- Trên máy này `grep` là bí danh của ugrep: dùng `/usr/bin/grep`. Không chạy lệnh in dòng lệnh tiến trình (`ps aux`, `ps -ef`, `pgrep -fl`). Không đọc `.runtime/`, `.env*`.

**Quyền và danh tính**
- Bot principal chỉ đọc: mọi phương thức mới từ chối `p.role==='bot'`. **Không** từ chối theo `p.role==='viewer'`: principal nhiều dự án mang vai tổng hợp `viewer` (`src/server/identity.ts`, hàm `principal`); vai theo dự án đọc từ CSDL.
- Người gọi và tenant lấy từ phiên. Mọi lược đồ lệnh là zod `.strict()`; khoá lạ (`proposerId`, `tenantId`, `grants`, `role`, `reportPermissions`, `projectIds`, `state`…) → `ZodError` (422 qua HTTP).
- Vai và tư cách (đang hoạt động, đã kích hoạt, là `manager` của đúng dự án, là thành viên) đọc từ CSDL danh tính **trong giao dịch ghi**, không tin `p.grants`, `p.projectIds` hay `p.role` của phiên.
- **Mã định danh:** mọi `uuid` trong lược đồ và trong đường dẫn hạ về chữ thường lúc parse (`z.uuid().transform(s=>s.toLowerCase())`); mọi phép so «có phải chính người gọi», «có phải quản trị tài khoản», «có phải đúng dự án» dùng giá trị đã chuẩn hoá, và so lại bằng mã do CSDL trả về sau khi nạp dòng. `identity.adminId` cũng hạ về chữ thường trước khi so.
- «Không tồn tại» và «ngoài phạm vi» trả cùng một câu, cùng mã, cùng trạng thái. Câu trả lời và lỗi của đường điều phối không chứa: quyền của tài khoản ở dự án khác, tên đăng nhập, phiên bản tài khoản, tên hay số ghế duyệt tài khoản. Không ghi căn cứ, tên người hay quyền vào log.
- Chỉ quản trị tài khoản áp quyền và chỉ qua lệnh `access` có sẵn. Không tệp nào của PR này ghi `identity.memberships`.

**Ghi**
- Mỗi lần ghi nằm trong **một** giao dịch `IdentityService.scope`; thất bại không để lại phiếu, người bỏ phiếu, tin riêng hay sự kiện (riêng bộ đếm tần suất `identity.throttle` commit trong giao dịch riêng, có chủ ý).
- «Phiên bản chờ đợi» của từng lệnh (T7C-10): trình = `expectedTypes`; rút = `expectedState`; huỷ = `expectedVersion` của tài khoản cùng `approvalId`.
- Chống ghi lặp bằng ràng buộc CSDL, không bằng đọc-rồi-ghi (E-BE-08): chỉ mục duy nhất `account_approval_active_access_change` (`migrations/018_access_change_approval.sql`) cùng khoá dòng người được cấp. Bước so «gửi lại» chỉ định hình câu trả lời.
- Mỗi lần ghi có một sự kiện bất biến trong `identity.events` cùng giao dịch: `access_change_proposed` (có sẵn; đường điều phối thêm `via:'project_manager'`), `access_change_withdrawn`, `access_change_cancelled` (hai loại mới; cột `kind` không có CHECK — `migrations/002_identity.sql`).
- Tin riêng cho người bỏ phiếu ghi cùng giao dịch bằng `notifyVoters` không đổi (cùng mẫu `account_approval.pending`, `params` rỗng). Không commit rồi mới xếp hàng.
- Trạng thái của phiếu chỉ đổi bằng `UPDATE identity.account_approvals SET state=…,updated_at=now()` (role `libetech_identity` chỉ có `UPDATE(state,updated_at)`); phiếu bị rút hoặc bị huỷ mang trạng thái `expired` (T7C-6).

**Thứ tự khoá (T7C-5) — mọi lệnh ghi của PR này lấy khoá đúng thứ tự này, không bao giờ ngược**
1. Dòng `identity.users` của **quản trị tài khoản**: lệnh của quản trị lấy `FOR UPDATE` (có sẵn, hàm `operator`); lệnh ghi của điều phối (`propose`, `withdraw`) lấy `FOR KEY SHARE`, là khoá **đầu tiên** của giao dịch.
2. Các dòng `identity.users` khác, theo thứ tự mã tăng dần: `propose` khoá hai dòng {người trình, người được cấp} bằng **một** câu `SELECT … FROM identity.users WHERE id=ANY($1::uuid[]) ORDER BY id FOR NO KEY UPDATE`; `withdraw` khoá dòng người trình bằng `FOR SHARE`.
3. Dòng `identity.account_approvals` của phiếu: `FOR UPDATE`.
4. Các câu chèn (phiếu, người bỏ phiếu, outbox) sau cùng.

Một lần đọc không khoá được phép đứng trước bước 1 để từ chối sớm.

**Bảng mã lỗi và câu chữ (dùng đúng từng ký tự; câu là chữ NFC)**

| Mã | HTTP | Câu | Dùng ở |
|---|---|---|---|
| `SCOPE_DENIED` | 404 | «Không tìm thấy mục trong phạm vi được cấp.» | mọi «không tồn tại / ngoài phạm vi» của đường điều phối, kể cả đường dẫn và phương thức lạ |
| `MANAGER_REQUIRED` | 403 | «Chỉ điều phối dự án được thực hiện thao tác này.» | người gọi là thành viên dự án nhưng không phải `manager` theo CSDL; giữ chỗ OQ-49 |
| `DOC_APPROVAL_PROPOSAL_INVALID` | 422 | (SELF) «Không tự trình phiếu cấp quyền duyệt cho chính mình.» | người được cấp là chính người trình |
| `DOC_APPROVAL_PROPOSAL_INVALID` | 422 | (ADMIN) «Quản trị tài khoản trình phiếu ở trang Quản trị tài khoản.» | người gọi là quản trị tài khoản |
| `DOC_APPROVAL_PROPOSAL_INVALID` | 422 | (INELIGIBLE) «Người được đề xuất phải là thành viên đang hoạt động của dự án.» | mọi lý do thuộc về người được cấp — một câu duy nhất |
| `APPROVERS_NOT_READY` | 409 | «Chưa đủ người bỏ phiếu khi không tính người trình. Nhờ quản trị tài khoản kiểm tra danh sách người duyệt hoặc trình thay.» | danh sách ghế không hợp lệ khi loại ghế của người trình — không phụ thuộc người được cấp |
| `VERSION_CONFLICT` | 409 | «Quyền duyệt của người này đã đổi. Tải lại trước khi trình.» | `expectedTypes` lệch |
| `VERSION_CONFLICT` | 409 | «Phiếu đã đổi trạng thái. Tải lại trước khi rút.» | `expectedState` lệch |
| `ACCESS_CHANGE_NOT_NEEDED` | 409 | «Người này đã giữ quyền duyệt các loại tài liệu đã chọn.» | không còn loại nào để thêm |
| `APPROVAL_PENDING` | 409 | «Người này đang có một phiếu đổi quyền chưa xong.» | người được cấp đang có phiếu mở khác; lỗi `23505` của chỉ mục duy nhất |
| `RATE_LIMITED` | 429 | «Thử lại sau ít phút.» (câu có sẵn của `IdentityService.throttle`) | quá 10 lần trình trong một giờ |
| `RATE_LIMITED` | 429 | «Anh/chị đã trình một phiếu cho người này trong 24 giờ qua. Thử lại sau, hoặc nhờ quản trị tài khoản trình.» | giữ chỗ OQ-47 |
| `APPROVAL_CLOSED` | 409 | «Phiếu đã kết thúc hoặc hết hạn.» (câu có sẵn) | rút hoặc huỷ một phiếu không còn mở |
| `APPROVAL_NOT_FOUND` | 404 | «Không tìm thấy phiếu duyệt.» (câu có sẵn) | lệnh huỷ của quản trị: phiếu không có, khác loại, hoặc của tài khoản khác |
| `BALLOT_CANCEL_NOT_ALLOWED` | 403 | «Lệnh huỷ chỉ áp cho phiếu do điều phối dự án trình.» | giữ chỗ OQ-48 |
| `TELEGRAM_APPROVAL_REQUIRED` | 409 | «Mở rộng quyền cần phiếu duyệt Telegram mới.» (câu có sẵn) | lúc áp: phiếu của điều phối mà rộng hơn `doc_approve:*` |

**Chữ tự do**
- Căn cứ (trình, rút) là một dòng: từ chối mọi ký tự điều khiển `[\u0000-\u001F\u007F-\u009F]` và mọi chuỗi PostgreSQL không lưu được (`storable` của `src/server/text-safety.ts`); đếm bằng điểm mã (`Array.from(s).length`) sau khi bỏ dấu cách đầu cuối. Căn cứ trình: 5–300. Căn cứ rút: 5–500. Lý do của lệnh huỷ dùng lược đồ `reason` có sẵn của `accounts.ts` (5–500).
- Căn cứ đóng băng của phiếu do máy chủ dựng (T7C-7): `«<tên> (điều phối dự án) trình: <căn cứ>»`, hoặc khi người được cấp cũng là `manager` của dự án đó: `«<tên> (điều phối dự án) trình; người được cấp cũng là điều phối của dự án đó: <căn cứ>»`. `<tên>` đọc từ CSDL, thay mọi ký tự điều khiển bằng dấu cách, cắt còn 100 điểm mã đầu. Phần cố định dài đúng 26 và 73 điểm mã; chuỗi dài nhất 100 + 73 + 300 = 473 ≤ 500 của cột `reason`.
- Mọi chữ do người viết (căn cứ, tên) hiển thị như chữ React, trong `<bdi dir="auto">`; không `dangerouslySetInnerHTML`.

**Hạ tầng test**
- Dùng `tests/slice1-db.ts` (`openHarness`, `native`, `waitForBlocked`), `tests/slice1-fixtures.ts`, `tests/slice3-fixtures.ts` (`seedMembers`, `beforeStatement`, `frozenRevision`, `registerDoc`), `tests/account-approval-fixture.ts` (`provisionApprovers`). Fixture riêng của PR này: `tests/doc-approval-fixtures.ts` (Task 1 tạo). Thư mục `tests/support/` không tồn tại.
- Ca chạy trên cả PGlite và PostgreSQL thật; ca tranh chấp nằm trong `describe.skipIf(!native)` và dựng thứ tự bằng `beforeStatement` cùng `waitForBlocked`, không bằng `sleep`. Không ca tranh chấp nào được nhận lỗi SQLSTATE `40P01`.
- Biến của PostgreSQL thật nạp bằng `set -a; . "$TASK7C_ENV_FILE"; set +a`; không ghi đường dẫn hay giá trị vào repo hay log.
- `IdentityService` trong test dựng bằng `new IdentityService(h.operator, ids.tenant, adminId)`; vai dự án trong fixture đặt `project_role` **tường minh**.
- Mỗi task lưu log đỏ rồi log xanh (đã che URL) vào `docs/reviews/task-7c-evidence-20261116/task-N-{red,green}.txt`.
- Con trỏ `tệp:dòng` chụp tại base và sẽ lệch: định vị theo **tên ký hiệu** nêu cạnh con trỏ.
- Ca hồi quy trên mã có sẵn xanh ngay từ đầu; để chứng minh ca có răng, builder làm **phép đột biến tạm** nêu ở task, thấy đỏ, sửa lại, và `git diff --stat` của tệp bị đột biến trở về như trước.
- `vitest.config.ts` có **một** dòng `coverage.include` dùng chung: chỉ thêm đúng hai tệp nêu ở Task 1 vào cuối mảng, không sắp lại, không xuống dòng.

**Giao diện**
- Giao diện không tự tính quyền: nút và khối theo dữ liệu dịch vụ trả; mọi từ chối đến từ dịch vụ.
- Bốn trạng thái bắt buộc có chữ riêng: rỗng, lỗi, đang tải, không có quyền (khối trình phiếu có thêm trạng thái `admin`). Thành công báo ở vùng `role="status"`, lỗi ở `role="alert"`; nội dung đang nhập được giữ qua mọi lỗi.
- 360 px không cuộn ngang; nút và liên kết hành động ≥ 44×44 px; tín hiệu không chỉ bằng màu. Khối mới của màn Review chỉ dùng các lớp `review-*`, `doc-*` có sẵn trong `src/app/globals.css`; không thêm màu, không `style` nội tuyến, không chiều rộng cố định.
- Trang máy chủ không truyền hàm xuống thành phần client (`tests/rsc-boundary.test.ts`).

**Quy trình**
- Trần vòng sửa builder ↔ reviewer của mỗi task là **3** (R5); cổng Codex tối đa **hai** vòng sửa.
- Task 1, 2, 3 bắt buộc `liberico-security-reviewer` sau khi có mã; Task 4 review mã và giao diện; Task 5 không review riêng.

## Phán quyết của phiên Task 7c (không phải quyết định của Chairman)

Lựa chọn kỹ thuật do kế hoạch đặt, để reviewer kiểm. Không mục nào thay quyết định của Chairman. Mỗi mục: chọn gì — vì sao — sai thì tốn gì.

- **T7C-1 · Đường của điều phối là mô-đun riêng; không tách hàm từ thân `proposeAccessChange`** (thay S55 phần «tách đoạn tạo phiếu thành một hàm riêng»). `src/server/doc-approval-proposals.ts` tự chèn phiếu, người bỏ phiếu, tin riêng và sự kiện bằng khoảng mười dòng SQL cùng hình với đường quản trị. Vì sao: giới hạn «đường trình của quản trị không đổi» được giữ bằng cách không chạm thân hàm đó; diff của `accounts.ts` chỉ còn phần thêm. Hai đường được ghim bằng ca «the ballot row equals an admin ballot…» và ca so tin riêng (Task 1). Sai thì tốn: nếu sau này đường quản trị đổi cách chèn, ca tương đương đỏ và phải sửa hai nơi; gộp lại thành một hàm chung là một lần tái cấu trúc nhỏ.
- **T7C-2 · Cách loại ghế của người trình (OQ-35 a) mà không sửa `account-approval.ts`.** Gọi `verifiedApprovalSeats(tx, identity, <mã người trình>)` — tham số loại trừ có sẵn — rồi lọc tại chỗ ghế của người được cấp; danh sách còn lại phải có ghế `chairman` và ít nhất một ghế khác. Đã kiểm trên mã (`src/server/account-approval.ts`, `validSeats`, `frozenVoters`, `approvalReady`, `voteForPrincipal`, `pendingForPrincipal`): (1) ghế `chairman` hợp lệ luôn là tài khoản quản trị, mà người trình và người được cấp đều không phải quản trị (từ chối ở P2), nên hai lần loại chỉ bỏ ghế BoM; (2) danh sách đóng băng còn 2–3 dòng, có `chairman` đúng quản trị và ít nhất một BoM, nên qua `validSeats`; (3) `frozenVoters` chỉ đòi mỗi dòng đóng băng **vẫn** là một ghế hiện có và không phải người được đổi quyền — nó không đòi mọi ghế hiện có đều nằm trong danh sách, nên thiếu ghế của người trình vẫn qua, lúc bỏ phiếu và lúc áp; (4) người trình đang giữ ghế mở `/approvals` không thấy phiếu (câu đọc nối theo `account_approval_voters`) và bỏ phiếu thì nhận `APPROVER_REQUIRED`; (5) `accessChangeTally` cần ít nhất một ghế BoM trong danh sách (danh sách BoM rỗng sẽ thành «mọi BoM từ chối») — P8 bảo đảm. Sai thì tốn: nếu cổng bảo mật thấy một đường qua `frozenVoters` bị chặn, đó là điểm dừng (không sửa `account-approval.ts`).
- **T7C-3 · Hai câu trả lời khi thiếu người bỏ phiếu, để không lộ ai giữ ghế** (thay S81 sau OQ-35 a). (i) Danh sách ghế không hợp lệ khi **chỉ** loại ghế của người trình → `APPROVERS_NOT_READY` với câu riêng của đường điều phối; phép kiểm này đứng **trước** mọi phép kiểm về người được cấp, nên câu trả lời y hệt cho mọi người được cấp, kể cả mã không tồn tại. (ii) Danh sách hợp lệ ở (i) nhưng không còn ghế BoM sau khi loại thêm ghế của người được cấp → đúng câu INELIGIBLE chung. Vì sao: trường hợp (i) chỉ nói về chính người trình và tình trạng chung của danh sách ghế — tình trạng chung vốn đã lộ với mọi tài khoản đăng nhập qua `GET /api/team/approvals` (`pendingForPrincipal` ném `APPROVERS_NOT_READY` trước khi xét ghế của người gọi, `src/server/account-approval.ts:125-126`); trường hợp (ii) phụ thuộc người được cấp nên phải lẫn vào câu chung. Phần dư được chấp nhận: một người trình đang giữ ghế BoM biết được «không ghế BoM nào khác sẵn sàng» (không biết của ai). Sai thì tốn: gộp (i) vào câu INELIGIBLE là đổi một dòng và một ca.
- **T7C-4 · Quản trị tài khoản không dùng đường của điều phối.** Người gọi là quản trị tài khoản bị từ chối trước mọi khoá, kèm câu chỉ sang trang Quản trị tài khoản. Vì sao: loại ghế của người trình thì mất ghế `chairman` và `validSeats` không bao giờ qua, mà `account-approval.ts` không được sửa; quản trị không mất gì vì đường có sẵn trình được đúng thay đổi đó. Cùng lý do: quản trị gọi `listOwn` nhận danh sách rỗng, gọi `withdraw` nhận 404, và màn Review hiện cho quản trị một câu chỉ sang `/team` thay cho biểu mẫu (trạng thái `admin` ở Task 4) — quản trị tài khoản thường cũng là điều phối của dự án, nên trường hợp này gặp hằng ngày. Đây là hệ quả kỹ thuật, không phải luật quyền mới. Sai thì tốn: không có phương án khác trong giới hạn của PR.
- **T7C-5 · Thứ tự khoá, và vì sao phải khoá dòng quản trị trước** (thay S77; M3, S2 của cổng; đổi theo OQ-38 c). Thứ tự ở Global Constraints. Phân tích (#inference từ ngữ nghĩa khoá dòng của PostgreSQL và từ mã; chưa chạy — các ca native của Task 1 và 2 là bằng chứng): (a) Lệnh của quản trị giữ `FOR UPDATE` trên dòng của chính quản trị (`operator`) rồi mới khoá `FOR UPDATE` dòng tài khoản đích. (b) Chèn một dòng `account_approval_voters` cho ghế `chairman` làm khoá ngoại lấy `FOR KEY SHARE` trên **dòng quản trị** (`migrations/009_telegram_account_approval.sql`, khoá ngoại `user_id`), và `FOR KEY SHARE` chỉ xung đột với `FOR UPDATE`. Kế hoạch cũ ghi «đường này không bao giờ khoá dòng của quản trị» — sai ở điểm này: một lệnh của quản trị trên người trình hoặc người được cấp, chạy cùng lúc với một lệnh trình đã khoá hai dòng đó, tạo vòng khoá (quản trị giữ dòng mình, chờ dòng đích; lệnh trình giữ dòng đích, chờ `KEY SHARE` trên dòng quản trị). Lấy `FOR KEY SHARE` trên dòng quản trị làm khoá đầu tiên xếp mọi lệnh ghi của điều phối sau hoặc trước trọn một lệnh của quản trị, nên không còn vòng; nó cũng làm một lệnh hạ vai, gỡ hay khoá người trình luôn xếp hàng với lệnh trình (M3). (c) Hai đồng điều phối trình cho nhau cùng lúc (OQ-38 c) khoá cùng hai dòng: một câu `ORDER BY id` lấy khoá theo cùng thứ tự ở cả hai giao dịch, nên giao dịch sau chờ, không vòng. (d) Dùng `FOR NO KEY UPDATE` chứ không `FOR UPDATE` trên hai dòng đó: nó vẫn loại trừ `FOR UPDATE` của đường quản trị và một lệnh trình khác cho cùng người, nhưng không xung đột với `FOR KEY SHARE` mà một lệnh trình khác lấy khi chèn người bỏ phiếu — nếu dùng `FOR UPDATE`, hai điều phối đang giữ ghế BoM trình cùng lúc sẽ khoá chéo nhau. (e) `withdraw`: dòng quản trị (`KEY SHARE`) → dòng người trình (`FOR SHARE`) → dòng phiếu (`FOR UPDATE`); cùng chiều với lệnh áp và huỷ của quản trị (dòng quản trị → dòng tài khoản → dòng phiếu). (f) Phần dư có sẵn từ lát 2, PR này không sửa: quản trị bỏ phiếu ghế `chairman` ở một tab trong lúc chính mình chạy một lệnh tài khoản trên cùng phiếu ở tab khác có thể khoá chéo (đường bỏ phiếu khoá phiếu trước rồi mới chạm dòng người bỏ phiếu). Sai thì tốn: một lỗi `40P01` thành 500 cho một trong hai người gọi, gửi lại thì qua; ca native bắt được.
- **T7C-6 · Phiếu bị rút hoặc bị huỷ mang trạng thái `expired`; lý do nằm ở sự kiện; không migration.** CHECK của cột `state` chỉ có `pending|approved|rejected|expired|issued` và role chỉ sửa được `state`, `updated_at`. Chọn `expired` chứ không `rejected`: `rejected` là kết quả bỏ phiếu, `expired` đã là «đóng mà không do phiếu bầu» (hết hạn, tài khoản đổi) và sự kiện `access_change_expired` có sẵn cũng mang lý do. Căn cứ, người làm và trạng thái trước nằm trong `identity.events` (`access_change_withdrawn`, `access_change_cancelled`), bảng chỉ thêm. Không màn nào của PR này hiện lịch sử phiếu đã đóng, nên trạng thái sẵn có đủ cho giao diện và ca kiểm; guard của migration 019 chỉ nhận `approved` còn hạn hoặc `issued`, nên phiếu đã rút hay huỷ không bao giờ mở được mã quyền. Sai thì tốn: muốn trạng thái riêng (`withdrawn`, `cancelled`) thì cần migration 022 nới CHECK kèm tệp lùi và review CSDL; mã chỉ đổi một hằng.
- **T7C-7 · Ngân sách cột `reason` (5–500).** Phần cố định 26 điểm mã (thường) và 73 (đồng điều phối); tên cắt còn 100 điểm mã (cột `identity.users.name` không có giới hạn ở CSDL, chỉ lược đồ ứng dụng giới hạn 100); căn cứ người trình nhập hạ từ 360 của kế hoạch cũ xuống **300** cho cả hai trường hợp, để biểu mẫu chỉ có một giới hạn; dài nhất 473. Đếm bằng điểm mã vì CHECK dùng `length()` của PostgreSQL. Sai thì tốn: đổi hai hằng và một ca biên.
- **T7C-8 · Câu của OQ-38 (c) nằm trong căn cứ đóng băng, nên tới người bỏ phiếu mà không sửa `account-approval.ts`.** `pendingForPrincipal` trả `reason`; `/approvals` in «Căn cứ: {item.reason}» (`src/components/approvals.tsx:30`); đường bot trả nguyên kết quả đó (`src/server/bridge.ts`, thao tác `account_approval_pending`) và plugin in «Căn cứ: …» (`bot-plugin/__init__.py:1243-1251`). Hôm nay plugin không dựng thẻ cho phiếu có mã `doc_approve:*` (`bot-plugin/__init__.py:1213-1216`, ghim bởi ca pytest `test_a_ballot_with_a_document_approval_code_is_never_asked_by_the_current_plugin`), nên người bỏ phiếu đọc các phiếu này trên `/approvals`; khi plugin học nhãn ở đợt runtime, câu đó đi theo `reason`. Thẻ còn hiện vai của người được cấp ở từng dự án («Điều phối»). Sai thì tốn: muốn một dòng nhấn riêng trên thẻ thì phải thêm trường vào câu đọc phiếu chờ — tức sửa `account-approval.ts`, ngoài giới hạn.
- **T7C-9 · «Phiếu đang mở»** = trạng thái `pending` hoặc `approved` và còn hạn (`expires_at > now()`) — đúng tập của chỉ mục duy nhất mà OQ-36 trỏ tới (`migrations/018_access_change_approval.sql:31-33`). Rút và huỷ áp cho cả phiếu đã đủ phiếu mà chưa áp. Sai thì tốn: giới hạn về `pending` là một điều kiện.
- **T7C-10 · «Phiên bản chờ đợi» và gửi lại.** Trình: `expectedTypes` (điều phối không đọc được phiên bản tài khoản, nên so trên đúng dữ liệu họ thấy); gửi lại cùng nội dung khi phiếu còn mở trả lại phiếu đó với `replayed:true`, không ghi gì (S68, S75 giữ). Rút: `expectedState` — nếu một ghế BoM vừa đồng ý, người trình được báo trước khi rút. Huỷ: `expectedVersion` của tài khoản cùng `approvalId`. Rút hoặc huỷ lần hai trên phiếu đã đóng trả `APPROVAL_CLOSED` và không ghi gì; tuyến không nhận `Idempotency-Key` (lược đồ `identity` không có bảng khoá lệnh — S58). Sai thì tốn: thêm cột khoá lệnh là một migration.
- **T7C-11 · OQ-37 (c) theo nghĩa không chặn.** Lệnh `access` không xét vai hiện tại của người trình; nó chỉ thêm phép kiểm S1 của cổng (phiếu của điều phối phải là thuần `doc_approve:*`). «Nêu rõ trước khi áp» thực hiện bằng: `list` trả `proposerIsCoordinator` đọc lúc tải; `/team` in câu ngay trên nút áp; sự kiện `account_access` ghi `proposerNoLongerCoordinator:true` khi áp trong tình trạng đó. Phần dư đã biết: một tab `/team` mở từ trước khi người trình mất vai không có câu đó cho tới lần tải lại (chỉ quản trị đổi được vai, nên người bấm cũng là người vừa đổi). Phương án chặt hơn, **không làm** vì ghi chú của phiên điều phối ghi «không chặn»: lệnh áp đòi một trường xác nhận đã thấy câu đó. Sai thì tốn: thêm một trường tuỳ chọn và một nhánh.
- **T7C-12 · Tuyến đi qua một handler test được** (thay S69). `handleDocApprovalApi(request, parts, identity)` theo mẫu `src/server/review-http.ts`; tệp tuyến chỉ chuyển tiếp. Vì sao: tuyến `/api/team/*` có sẵn gọi `identityService()` toàn cục nên không ca nào đi qua được; đường mới cần ca 401/403/404/422 qua HTTP. Sai thì tốn: không.
- **T7C-13 · Khối trình phiếu là thành phần riêng.** `src/components/doc-approval-proposals.tsx` và `doc-approval-view.ts`; `ReviewersPanelView` chỉ thêm một thuộc tính tuỳ chọn `approvalNote`, `ReviewQueue` thêm một thuộc tính tuỳ chọn `proposals`. Không có `proposals` thì màn y như trước, nên `tests/review-ui.test.tsx` xanh mà không sửa — kể cả ca «the reviewers panel has no control that touches document approval» (kế hoạch cũ định thay ca này; nay không cần). Sai thì tốn: không.
- **T7C-14 · Chặn lạm dụng.** Giữ trần 10 lần trình mỗi giờ mỗi người trình (S63; lần thất bại sau bước P3 vẫn bị đếm). Khoảng chờ 24 giờ theo cặp là giữ chỗ của OQ-47. Sai thì tốn: đổi hai con số.
- **T7C-15 · `/team` hiện phiếu đang mở của mọi tài khoản**, kể cả phiếu do quản trị trình (thông tin và nút «Áp đúng bộ quyền đã được duyệt» — S60 giữ); nút huỷ và câu về người trình chỉ có ở phiếu của điều phối. Máy chủ không đổi gì với phiếu của quản trị. Sai thì tốn: ẩn khối với phiếu của quản trị là một điều kiện.
- **T7C-16 · Tin riêng đã xếp không bị thu lại khi phiếu bị rút hoặc huỷ.** Role `libetech_identity` chỉ sửa được `acknowledged_at` của outbox (`migrations/017_outbox.sql:438`); người bỏ phiếu mở `/approvals` thì không còn phiếu, bấm trên thẻ cũ thì nhận `APPROVAL_CLOSED` và màn tự tải lại (có sẵn). Giống phiếu hết hạn hôm nay. Ghi vào giới hạn đã biết của biên nhận. Sai thì tốn: muốn thu lại tin thì phải cấp cho role danh tính quyền sửa trạng thái outbox — một migration.
- **T7C-17 · Đặc tả giao diện là tệp mới** `docs/UI-HANDOFF-3-doc-approval.md` (đủ sáu mục, phủ khối ở màn Review và khối phiếu ở `/team`); `docs/UI-HANDOFF-3-review.md` chỉ sửa ba chỗ trỏ sang. Vì sao: tệp cũ đã dày và khối mới có trạng thái, lỗi và tuyến riêng. Sai thì tốn: gộp lại là việc chép.
- **T7C-18 · Người trình không được báo khi phiếu bị quản trị huỷ**: phiếu chỉ rời danh sách đang mở; căn cứ huỷ nằm ở sự kiện, không màn nào hiện. Thông báo thuộc lát 4. Nếu sau này muốn hiện căn cứ huỷ cho người trình thì đó là một câu hỏi «ai xem được gì» mới. Sai thì tốn: một danh sách phiếu đã đóng đọc từ `identity.events`, sau khi có quyết định đó.

**Vẫn chờ Chairman xác nhận, kế hoạch không đổi:** S13 của lát 2 áp cho phiếu do điều phối trình (phiếu từ chối của Chairman đóng phiếu; phiếu đồng ý của Chairman không tính) — ghi chú 3 kèm OQ-35.

## Review Focus

Các lớp đầu vào và lỗi dễ cắn người dùng nhất; mỗi dòng có ca ghim ở task sở hữu mã. Cổng bảo mật soát theo đúng thứ tự này.

1. **Lệnh của quản trị chạy đúng lúc một lệnh của điều phối** (hạ vai, khoá người trình; đổi quyền người được cấp; áp phiếu đúng lúc người trình rút) — chờ: hai lệnh xếp hàng, không lỗi `40P01`, không phiếu nào tạo sau khi lệnh hạ vai đã commit, đúng một bên thắng khi rút đua với áp. Ca: Task 1 nhóm tranh chấp (đột biến: bỏ câu `FOR KEY SHARE` phải làm ca đỏ); Task 2 nhóm tranh chấp.
2. **Người trình hoặc người được cấp đang giữ ghế BoM** — chờ: ghế người trình không bỏ phiếu được; thiếu ghế thì không mở phiếu; câu trả lời không cho biết ai giữ ghế. Ca: Task 1 ca 6–9.
3. **Một phiếu mang `proposer_id` của điều phối nhưng rộng hơn `doc_approve:*`** (lỗi ở đường trình sau này) — chờ: không áp được dù đã đủ phiếu. Ca: Task 3 ca A2.
4. **Rút và huỷ bởi người không được phép, hoặc trên phiếu không thuộc đường này** (điều phối khác của dự án, người được cấp, người ngoài, quản trị dùng lệnh rút; người thường dùng lệnh huỷ; phiếu đăng ký; phiếu do quản trị trình) — chờ: cùng một câu 404 hoặc `ACCOUNT_ADMIN_REQUIRED`, không ghi gì; huỷ không đổi phiên bản tài khoản, không thu hồi phiên, không huỷ mã ghép. Ca: Task 2 ca W3, C1, C3, C4.
5. **Căn cứ và tên dựng dòng giả hoặc làm hỏng câu lệnh** (xuống dòng, U+0000, surrogate lẻ, chữ giả «(quản trị tài khoản) trình:», tên 150 ký tự, tên có ký tự điều khiển, chuỗi 300 ký tự không dấu cách) — chờ: 422 cho ký tự cấm; tiền tố luôn là tên từ CSDL; không lỗi CSDL thô; màn 360 px không cuộn ngang. Ca: Task 1 ca 21–22; Task 4 ca P5, P10.
6. **Người trình mất vai giữa chừng** — lúc trình (không để lại phiếu), lúc rút (giữ chỗ OQ-49), lúc quản trị áp (vẫn áp được, `/team` nêu rõ). Ca: Task 1 ca 17 và nhóm tranh chấp; Task 2 ca W4; Task 3 ca A3, U3.
7. **Hai tab và gửi lại** — trình hai lần cùng nội dung (một phiếu); rút hai lần (một sự kiện); rút đúng lúc một ghế BoM đồng ý (`VERSION_CONFLICT`, phiếu bầu không mất); người bỏ phiếu bấm trên thẻ của phiếu vừa rút (`APPROVAL_CLOSED`). Ca: Task 1 «resending…», «two identical proposals at once…»; Task 2 ca W1, W5, W6 và nhóm tranh chấp.
8. **Mã viết HOA** ở `userId`, `projectId`, `approvalId` — chờ: cùng kết quả như viết thường, không lách được luật «không tự trình», không 500. Ca: Task 1 «in any letter case», «ids in upper case…»; Task 2 ca W7.

## Bản đồ tệp

| Tệp | Trách nhiệm | Task |
|---|---|---|
| `src/server/access-grants.ts` | Thêm hàm thuần `docApprovalDelta` | 1 |
| `src/server/identity.ts` | Thêm `IdentityService.activeProjectRole` (đọc vai dự án hiệu lực của một tài khoản đang hoạt động, đã kích hoạt) | 1 |
| `src/server/doc-approval-proposals.ts` (mới) | Đường của điều phối: `propose`, `listOwn` (Task 1); `withdraw` (Task 2). Không ghi `identity.memberships` | 1, 2 |
| `src/server/doc-approval-http.ts` (mới) | Handler mỏng cho `/api/team/doc-approvals` | 1, 2 |
| `src/app/api/team/doc-approvals/[[...path]]/route.ts` (mới) | Chuyển tiếp mọi phương thức tới handler | 1 |
| `src/server/accounts.ts` | Task 1: thêm chữ `export` cho `grantsSchema`, `sameGrants`. Task 2: lệnh `cancel_access_change`. Task 3: `list` thêm `accessChange`; `access` thêm phép kiểm cho phiếu của điều phối. Thân `proposeAccessChange` không đổi | 1, 2, 3 |
| `vitest.config.ts` | Thêm hai tệp mới vào dòng `coverage.include` | 1 |
| `tests/doc-approval-fixtures.ts` (mới) | Thế giới tổng hợp dùng chung: quản trị, ghế, điều phối, đồng điều phối, điều phối giữ ghế, thành viên | 1 |
| `tests/doc-approval-proposal.test.ts`, `-concurrency.test.ts`, `-http.test.ts` (mới) | Trình và liệt kê: dịch vụ, tranh chấp (native), HTTP | 1, 2 (thêm ca HTTP) |
| `tests/doc-approval-withdraw.test.ts`, `-withdraw-concurrency.test.ts` (mới) | Rút và huỷ: dịch vụ, tranh chấp (native) | 2 |
| `tests/doc-approval-apply.test.ts` (mới) | Lúc áp, danh sách của quản trị, ca đầu-cuối | 3 |
| `src/components/team-accounts.tsx` | Khối phiếu đang mở, nút áp đúng bộ đóng băng, nút huỷ, câu OQ-37 | 3 |
| `src/components/approvals.tsx` | Chỉ thêm chữ `export` cho `grantText` | 3 |
| `tests/doc-approver-ui.test.tsx` | Chỉ thêm ca cho `/team` và thẻ `/approvals` | 3 |
| `src/components/doc-approval-view.ts`, `doc-approval-proposals.tsx` (mới) | Hàm thuần và khối «Trình phiếu cấp quyền duyệt bản chuẩn» | 4 |
| `src/components/review.tsx`, `review-view.ts` | `ReviewQueue` nhận `proposals`; `ReviewersPanelView` nhận `approvalNote`; một hằng câu mới | 4 |
| `src/server/review-page.ts`, `src/app/review/page.tsx` | `loadOwnProposals`; trang gọi `listOwn` khi người xem là điều phối | 4 |
| `tests/doc-approval-ui.test.tsx` (mới) | Ca của khối trình phiếu | 4 |
| `docs/UI-HANDOFF-3-doc-approval.md` (mới), `docs/UI-HANDOFF-3-review.md` | Đặc tả bàn giao sáu mục; ba chỗ trỏ | 4 |

## Bảng: mục cổng bảo mật (M1–M3, S1–S10, T1–T15) → chỗ áp

Tệp cổng: `docs/reviews/slice-3-evidence-20261115/gates/security-gate-task-7c-plan.md`.

| Mục | Nội dung | Chỗ áp ở kế hoạch này |
|---|---|---|
| M1 | Lách «không tự trình» bằng mã viết hoa | Global Constraints «Mã định danh»; Task 1 bước P0, P2, P8; ca «in any letter case», «ids in upper case…» |
| M2 | Không có cách đóng phiếu của điều phối | **Đổi theo quyết định OQ-36 (b) cùng (d):** Task 2 (rút, huỷ). Đòn bẩy tăng phiên bản của lát 2 vẫn còn và có ca hồi quy (C6) |
| M3 | Thẩm quyền của người trình đọc mà không khoá | Task 1 bước P4–P6 (dòng quản trị `KEY SHARE`, rồi hai dòng theo thứ tự mã); T7C-5; ca tranh chấp T3 |
| S1 | Phòng vệ lúc áp cho phiếu của điều phối | Task 3 (`access`: `docApprovalDelta` khác null); ca A2 |
| S2 | Người được cấp là quản trị: từ chối trước khi khoá; `adminId` chưa cấu hình | Task 1 bước P2; ca «the admin as subject is refused without touching a lock»; T7C-5 nêu thêm vòng khoá qua khoá ngoại mà cổng chưa thấy |
| S3 | `23505` → `APPROVAL_PENDING` | Task 1 bước P16; ca «a unique-index conflict…» |
| S4 | Căn cứ từ chối ký tự điều khiển, U+0000 | Global Constraints «Chữ tự do»; Task 1 ca 21; Task 2 ca W7 |
| S5 | `before`, `after` qua `grantsSchema` trước khi đóng băng | Task 1 bước P8, P11; ca 18 |
| S6 | Chặn lạm dụng ngoài 10 lần mỗi giờ | Task 1 bước P3, P14 (khoảng chờ theo cặp — **giữ chỗ OQ-47**) |
| S7 | Lộ ghế qua `APPROVERS_NOT_READY` | **Đổi do OQ-35 (a):** T7C-3; Task 1 bước P7, P8; ca 7–9 |
| S8 | `APPROVAL_PENDING` cho biết người đó có phiếu khác | Phần dư được chấp nhận, ghi ở Task 1 «Phần dư»; câu trả lời không nêu nội dung |
| S9 | Danh sách ẩn phiếu đã chết; thứ tự; trần 50 | Task 1 `listOwn`; ca 29 |
| S10 | Không trả dòng tài khoản | Task 1: mô-đun mới chỉ trả `DocApprovalProposal`; ca 19 |
| T1 | Mã viết hoa | Task 1 ca «in any letter case», «ids in upper case…» |
| T2 | Người trình bị khoá hoặc chưa kích hoạt | Task 1 ca 13 |
| T3 | Hạ vai đua với trình; đổi quyền người được cấp đua với trình | Task 1 nhóm tranh chấp (ba ca đầu) |
| T4 | Người được cấp là quản trị, không vòng khoá | Task 1 nhóm tranh chấp |
| T5 | Xung đột chỉ mục duy nhất | Task 1 nhóm tranh chấp |
| T6 | Quản trị thay phiếu của điều phối | **Đổi theo OQ-36 (d):** Task 2 ca C2 (huỷ rồi trình); đòn bẩy cũ ở C6 |
| T7 | Phiếu đóng băng ở phiên bản cũ là phiếu chết | Task 3 ca A4 |
| T8 | Phiếu của điều phối rộng hơn `doc_approve:*` | Task 3 ca A2 |
| T9 | Căn cứ dựng dòng giả | Task 1 ca 21 |
| T10 | Bộ quyền của người được cấp không qua lược đồ | Task 1 ca 18 |
| T11 | Biên đầu vào | Task 1 ca 20, 22 (giới hạn nay là 300 và 473) |
| T12 | Người được cấp giữ ghế | Task 1 ca 9 (và ca 8 cho trường hợp cả hai) |
| T13 | Thất bại không để lại gì, liệt kê từng nhánh | Task 1 ca 28; Task 2 trong W3–W7, C3–C5 |
| T14 | `GET` với dự án không điều phối; người đã bị hạ vai | Task 1 nhóm HTTP |
| T15 | Tin riêng giống đường quản trị | Task 1 ca 4 |
| Q1–Q4 | Bốn câu hỏi không thuộc quyền phiên | Đã có quyết định: OQ-35 (a), OQ-36 (b) cùng (d), OQ-37 (c), OQ-38 (c) — bảng ở trên |

---

### Task 1: Đường trình của điều phối dự án — hàm thuần, dịch vụ, handler, tuyến — **review riêng**, bắt buộc `liberico-security-reviewer`

**Tệp**
- Tạo: `src/server/doc-approval-proposals.ts`, `src/server/doc-approval-http.ts`, `src/app/api/team/doc-approvals/[[...path]]/route.ts`, `tests/doc-approval-fixtures.ts`, `tests/doc-approval-proposal.test.ts`, `tests/doc-approval-proposal-concurrency.test.ts`, `tests/doc-approval-proposal-http.test.ts`.
- Sửa: `src/server/access-grants.ts` (thêm một hàm), `src/server/identity.ts` (thêm một phương thức), `src/server/accounts.ts` (**chỉ** thêm chữ `export` trước `const grantsSchema` và trước `function sameGrants`), `vitest.config.ts` (thêm `'src/server/doc-approval-proposals.ts','src/server/doc-approval-http.ts'` vào cuối mảng `coverage.include`).

**Giao diện tạo ra (task sau dùng đúng các tên này)**
```ts
// src/server/access-grants.ts — hàm thuần
/** {projectId, added} khi `after` chỉ khác `before` ở việc THÊM mã doc_approve:* vào đúng MỘT mục dự án đã có: cùng tập dự án, cùng vai ở mọi mục,
 *  mọi quyền khác y nguyên (so như tập). `added` theo thứ tự DOC_APPROVAL_TYPES, không rỗng. Mọi trường hợp khác: null. */
export function docApprovalDelta(before:ProjectGrant[],after:ProjectGrant[]):{projectId:string;added:DocApprovalType[]}|null;

// src/server/identity.ts — class IdentityService
/** Vai hiệu lực (vai dự án trước, không có thì vai tài khoản) của một tài khoản đang hoạt động, đã kích hoạt trong một dự án;
 *  null khi tài khoản không có, bị khoá, chưa kích hoạt hoặc không là thành viên. Đọc thường, không khoá. */
async activeProjectRole(tx:Queryable,userId:string,projectId:string):Promise<ProjectGrant['role']|null>;

// src/server/doc-approval-proposals.ts
export type DocApprovalProposal={approvalId:string;projectId:string;userId:string;addedTypes:DocApprovalType[];state:'pending'|'approved';expiresAt:string;replayed:boolean};
/** Phần cố định của căn cứ đóng băng: 26 điểm mã (false) hoặc 73 (true). */
export const reasonPrefix=(name:string,subjectIsCoordinator:boolean):string;
export class DocApprovalProposalService {
  constructor(identity:IdentityService,notify?:typeof notifyVoters);   // notify thay được chỉ để test, như AccountService
  /** Lệnh strict: {projectId:uuid, userId:uuid, docTypes:DocApprovalType[] (1..8, không lặp), expectedTypes:DocApprovalType[] (0..8, không lặp), reason:5..300}. */
  propose(p:Principal,input:unknown):Promise<DocApprovalProposal>;
  /** Lệnh strict: {projectId:uuid}. Phiếu đang mở do CHÍNH người gọi trình cho dự án đó. */
  listOwn(p:Principal,input:unknown):Promise<DocApprovalProposal[]>;
}

// src/server/doc-approval-http.ts — `parts` là phần đường dẫn sau /api/team/doc-approvals
export async function handleDocApprovalApi(request:Request,parts:string[],identity:()=>IdentityService):Promise<Response>;
```
`reasonPrefix(name,false)` trả `` `${tên đã làm sạch} (điều phối dự án) trình: ` ``; `reasonPrefix(name,true)` trả `` `${tên đã làm sạch} (điều phối dự án) trình; người được cấp cũng là điều phối của dự án đó: ` ``. «Làm sạch» = thay mọi ký tự `[\u0000-\u001F\u007F-\u009F]` bằng dấu cách rồi lấy 100 điểm mã đầu.

**`propose` — thứ tự kiểm (mã lỗi và câu ở bảng của Global Constraints)**
- P0. Parse strict; `projectId`, `userId` hạ về chữ thường; `reason` theo luật «Chữ tự do» (5–300).
- P1. `p.tenantId` khác tenant của dịch vụ, hoặc `p.role==='bot'` → `SCOPE_DENIED`.
- P2. Từ chối không cần CSDL, **trước mọi khoá**: `identity.adminId` chưa cấu hình → INELIGIBLE; người gọi là quản trị tài khoản → ADMIN; `userId` là mã quản trị → INELIGIBLE; `userId` là mã người gọi → SELF.
- P3. `identity.throttle('doc-approval-proposal:'+p.id,10,3600)` → `RATE_LIMITED`. Hàm này commit riêng trước giao dịch chính, nên lần thất bại ở các bước sau **vẫn bị đếm** — có chủ ý.
- P4. Mở giao dịch `identity.scope`. Đọc trước **không khoá** `activeProjectRole(tx,p.id,projectId)`: null → `SCOPE_DENIED`; khác `manager` → `MANAGER_REQUIRED` (người không phải điều phối không khoá được dòng tài khoản của ai). Rồi `SELECT id FROM identity.users WHERE id=$1 FOR KEY SHARE` với mã quản trị; không có dòng → INELIGIBLE.
- P5. Một câu khoá hai dòng: `SELECT id,name,active,password_hash IS NOT NULL AS activated,account_version AS version FROM identity.users WHERE id=ANY($1::uuid[]) ORDER BY id FOR NO KEY UPDATE` với `[p.id,userId]`. Dòng người trình không có, bị khoá hoặc chưa kích hoạt → `SCOPE_DENIED`.
- P6. Kiểm lại **dưới khoá**: `activeProjectRole(tx,<mã người trình từ CSDL>,projectId)` — null → `SCOPE_DENIED`; khác `manager` → `MANAGER_REQUIRED`.
- P7. Ghế khi không tính người trình: `seats=await verifiedApprovalSeats(tx,identity,<mã người trình>)`; bắt đúng `AppError` mã `APPROVERS_NOT_READY` và ném lại `APPROVERS_NOT_READY` với câu của đường điều phối (T7C-3 i). Bước này đứng trước mọi phép kiểm về người được cấp.
- P8. Người được cấp — **một câu INELIGIBLE** cho mọi trường hợp: không có dòng (mã lạ, tenant khác); bị khoá; chưa kích hoạt; `before=await identity.grants(tx,<mã>)` không có mục của dự án này; vai ở dự án này là `viewer`; có mục dự án nằm ngoài tập dự án của quản trị tài khoản (`identity.grants(tx,adminId)`); `before` không qua `grantsSchema`; `voters=seats.filter(s=>s.user_id!==<mã người được cấp>)` không còn ghế `chairman` hoặc không còn ghế nào khác (T7C-3 ii). So lại bằng mã CSDL: dòng người được cấp trùng dòng người trình → SELF. Vai ở dự án này là `manager` thì **được** (OQ-38 c): đặt `subjectIsCoordinator=true`.
- P9. `held=docApprovalTypes(<quyền của mục dự án này>)` phải bằng `expectedTypes` như một tập; lệch → `VERSION_CONFLICT` (câu «…trước khi trình»).
- P10. `added` = các loại của `docTypes` chưa có trong `held`, theo thứ tự `DOC_APPROVAL_TYPES`; rỗng → `ACCESS_CHANGE_NOT_NEEDED`.
- P11. `after` = `before` với đúng mục của dự án này được thêm `added.map(docApprovalCode)`; mọi thứ khác chép nguyên. Khẳng định trước khi ghi: `after` qua `grantsSchema`; `docApprovalDelta(before,after)` bằng đúng `{projectId,added}`; `widensAccess(before,after)` đúng. Sai một điều → ném `Error` nội bộ, không ghi gì.
- P12. `reason=reasonPrefix(<tên người trình từ CSDL>,subjectIsCoordinator)+<căn cứ đã bỏ dấu cách đầu cuối>`.
- P13. Phiếu đang mở và còn sống của người được cấp (một lần đọc): `kind='access_change'`, `state IN ('pending','approved')`, `expires_at>now()`, `subject_account_version` bằng phiên bản vừa khoá. Nếu có: `proposer_id` là người trình **và** `sameGrants(grants,after)` **và** `sameGrants(previous_grants,before)` **và** `reason` bằng đúng chuỗi P12 → trả phiếu đó với `replayed:true`, **không ghi gì**; mọi trường hợp khác → `APPROVAL_PENDING`.
- P14. **Giữ chỗ OQ-47:** người trình đã mở một phiếu `access_change` cho người này với `created_at>now()-interval '24 hours'` và `state<>'issued'` → `RATE_LIMITED` (câu 24 giờ).
- P15. Đóng phiếu chết của người được cấp, như đường quản trị: `UPDATE … SET state='expired',updated_at=now() WHERE kind='access_change' AND subject_user_id=$1 AND state IN ('pending','approved') AND (expires_at<=now() OR subject_account_version<>$2) RETURNING id`.
- P16. Chèn phiếu: cột `tenant_id, kind='access_change', subject_user_id, subject_account_version, previous_grants, proposer_id=<người trình>, grants, reason` (hạn và trạng thái lấy từ default của bảng); lỗi `23505` trên câu này → `APPROVAL_PENDING`. Chèn một dòng `account_approval_voters` cho mỗi phần tử của `voters`. `await this.notify(tx,identity,<mã phiếu>,voters,traceId)`. Chèn sự kiện `identity.events(tenant_id,user_id=<người được cấp>,actor_id=<người trình>,kind='access_change_proposed',detail)` với `detail={approvalId,accountVersion,before,after,reason,traceId,via:'project_manager',projectId,addedTypes,subjectIsCoordinator,…(có phiếu vừa đóng thì expiredApprovalIds)}`.
- P17. Trả `DocApprovalProposal` (`state:'pending'`, `replayed:false`). Không trả bộ quyền, tên đăng nhập, phiên bản tài khoản hay mã dự án khác.

**`listOwn`**: P1; người gọi là quản trị tài khoản → trả `[]`, không đọc gì (T7C-4: đường này không có phiếu nào của quản trị); trong giao dịch, `activeProjectRole(tx,p.id,projectId)` — null → `SCOPE_DENIED`, khác `manager` → `MANAGER_REQUIRED` (giữ chỗ OQ-49: người đã mất vai không xem được). Đọc các phiếu `kind='access_change'`, `proposer_id=p.id`, `state IN ('pending','approved')`, `expires_at>now()`, nối `identity.users` để `subject_account_version=account_version`, xếp `created_at, id`, tối đa 200 dòng; giữ dòng mà `docApprovalDelta(previous_grants,grants)?.projectId` bằng dự án hỏi; trả tối đa 50. Không khoá.

**Handler và tuyến** (mẫu `src/server/review-http.ts`): `authenticatedPrincipal(request)` trước (401); phương thức khác `GET`/`HEAD` thì `checkOrigin(request)` (403); `identity()` gọi **trong** `try` để `IDENTITY_UNAVAILABLE` thành câu trả lời 503. `GET` (và `HEAD`, coi như `GET`) + `parts=[]` → `listOwn` với đối tượng dựng từ **mọi** tham số truy vấn (tham số lạ → 422); `POST` + `parts=[]` → `propose(await body(request))`; mọi đường dẫn và phương thức khác → `SCOPE_DENIED` 404. Mọi câu trả lời có `Cache-Control: no-store`. Không đọc `Idempotency-Key`. Tệp tuyến: `runtime='nodejs'`, `dynamic='force-dynamic'`, xuất `GET, POST, PUT, PATCH, DELETE` cùng một hàm gọi `handleDocApprovalApi(request,(await ctx.params).path??[],identityService)`.

**Phần dư được chấp nhận:** `APPROVAL_PENDING` cho người trình biết tài khoản đó đang có một phiếu đổi quyền khác (có thể về một dự án họ không thấy), không cho biết nội dung (S8 của cổng). T7C-3 nêu phần dư về ghế.

**Fixture `tests/doc-approval-fixtures.ts`** (dựng một lần cho cả PR; mọi vai dự án tường minh)
```ts
export type World={h:Harness;identity:IdentityService;accounts:AccountService;ballots:AccountApprovalService;proposals:DocApprovalProposalService;
  admin:Principal;                                    // mã ngẫu nhiên; manager của ids.sales và ids.transport; ghế chairman
  approvers:{seat:string;id:string;telegram:string}[]; // provisionApprovers(h.operator,identity,admin.id,ids.sales): [chairman,bom_chu,bom_quan,bom_phuong]; ba ghế BoM là viewer của ids.sales
  coordinator:Principal;      // manager của ids.sales, viewer của ids.transport; không giữ ghế; principal mang role:'viewer' (vai tổng hợp của hai dự án khác vai), grants đúng từng dự án
  coManager:Principal;        // manager của ids.sales; không giữ ghế
  seatCoordinator:Principal;  // chính tài khoản ghế bom_chu, được đặt project_role='manager' ở ids.sales
  subject:Principal;          // `member` của tests/slice1-fixtures (engineer của ids.sales), có dòng trong identity.users nhờ seedMembers
  outsider:Principal};        // `transportApprover` của tests/slice3-fixtures (technical của ids.transport)
// Thành viên khác của ids.sales có sẵn nhờ seedMembers: `reviewer` (technical), `approver` (business) của tests/slice3-fixtures.
export async function openWorld():Promise<World>;   // openHarness → reset → seedSlice1 → seedMembers → dựng các dòng trên
export const BASIS='Cần người duyệt bản thiết kế của dự án';
export const propose:(w:World,p:Principal,over?:Record<string,unknown>)=>Promise<DocApprovalProposal>;   // mặc định {projectId:ids.sales,userId:w.subject.id,docTypes:['design'],expectedTypes:[],reason:BASIS}
export const say:(w:World,seat:number,approvalId:string,choice?:'agree'|'reject')=>Promise<unknown>;      // ballots.vote bằng telegram của approvers[seat]
export const rows:<T=Record<string,unknown>>(w:World,sql:string,params?:unknown[])=>Promise<T[]>;
export const snapshot:(w:World)=>Promise<{approvals:number;voters:number;outbox:number;events:number}>;   // đếm identity.account_approvals, identity.account_approval_voters, outbox_messages, identity.events
export const refusal:(run:Promise<unknown>)=>Promise<{code?:string;status?:number;message?:string}>;
```

- [ ] **Bước 1 — viết fixture và ca kiểm (đỏ).** `tests/doc-approval-proposal.test.ts`:
  1. **`docApprovalDelta accepts only added doc_approve codes on one existing project`** — bảng ca: thêm một hoặc nhiều mã ở một dự án → `{projectId, added}` đúng thứ tự `DOC_APPROVAL_TYPES`; thêm ở hai dự án, thêm dự án, bớt dự án, đổi vai, thêm quyền báo cáo, bớt một mã, không đổi gì, thêm mã ở một dự án đồng thời bớt quyền báo cáo → đều `null`; thứ tự mục và thứ tự quyền khác nhau không làm đổi kết quả.
  2. **`a project manager proposes document approval for a member of the own project, and the ballot is an ordinary access-change ballot`** — một dòng `account_approvals`: `kind='access_change'`, `proposer_id` là `coordinator`, `state='pending'`, hạn cách `created_at` đúng 48 giờ; `docApprovalDelta(previous_grants,grants)` trả `{projectId:ids.sales,added:['design']}`; `identity.memberships` và `account_version` của người được cấp không đổi; kết quả trả đúng `{approvalId,projectId,userId,addedTypes:['design'],state:'pending',expiresAt,replayed:false}` và không có khoá nào khác.
  3. **`the ballot row equals an admin ballot for the same change in every column but id, proposer, reason and time`** — tạo phiếu của điều phối, ghi lại dòng và các dòng người bỏ phiếu, đóng nó bằng login vận hành (`state='expired'`), rồi quản trị `propose_access_change` đúng bộ quyền đó: `kind, subject_user_id, subject_account_version, previous_grants, grants, state`, khoảng `expires_at − created_at` bằng nhau; tập `(seat,user_id)` của người bỏ phiếu bằng nhau (điều phối không giữ ghế).
  4. **`the direct message for a coordinator ballot equals the admin path's`** (T15) — với từng người bỏ phiếu của hai phiếu ở ca 3: dòng `outbox_messages` có cùng `template='account_approval.pending'`, `payload` bằng `{params:{}}`, `audience='dm'`, cùng `recipient_user_id`, `target_chat_id`; `dedupe_key` đúng `account_approval.pending:<mã phiếu>:<mã người>`; `payload::text` không chứa tên, quyền hay mã phiếu.
  5. **`same tally, same deadline: one BoM agreeing approves, the Chairman alone does not, the Chairman's rejection closes`** — ba phiếu cho ba thành viên khác nhau của `ids.sales` (`member`, `reviewer`, `approver` của fixture lát 3): chỉ Chairman đồng ý → vẫn `pending`; một ghế BoM đồng ý → `approved`; Chairman từ chối → `rejected`; phiếu có `expires_at` bị lùi về quá khứ không bỏ được nữa (`APPROVAL_CLOSED`).
  6. **`OQ-35 a proposer who holds a BoM seat is not a voter of the own ballot and cannot vote on it`** — `seatCoordinator` trình: người bỏ phiếu đóng băng đúng là ghế `chairman`, `bom_quan`, `bom_phuong`; `ballots.pendingForPrincipal(seatCoordinator)` không có phiếu đó; `ballots.voteForPrincipal(seatCoordinator,id,'agree')` → `APPROVER_REQUIRED`, 0 dòng phiếu bầu; `bom_quan` đồng ý → `approved`; quản trị `access` đúng bộ đóng băng → áp được, phiếu `issued` (chứng minh `frozenVoters` và `approvalReady` nhận danh sách thiếu ghế người trình).
  7. **`OQ-35 when the proposer is the only BoM seat able to vote, no ballot opens and the answer is the same for every subject`** — login vận hành xoá `identity.telegram_links` của `bom_quan`, `bom_phuong`; `seatCoordinator` trình cho `subject`, cho `outsider`, cho một uuid không tồn tại: cả ba trả đúng `{code:'APPROVERS_NOT_READY',status:409,message:<câu của đường điều phối>}` (so sâu ba kết quả với nhau); `snapshot` không đổi.
  8. **`OQ-35 when removing the proposer's and the subject's seats leaves no BoM seat, no ballot opens and the answer does not tell who holds a seat`** — xoá liên kết Telegram của `bom_phuong`; đặt tài khoản ghế `bom_quan` thành `engineer` của `ids.sales`; `seatCoordinator` trình cho tài khoản đó → kết quả **bằng sâu** kết quả khi trình cho `outsider` (INELIGIBLE, 422); `snapshot` không đổi; chuỗi câu trả lời không chứa «ghế», «BoM», «Telegram».
  9. **`a subject who holds the only other BoM seat gets the same answer as any ineligible member`** (T12) — `coordinator` (không giữ ghế) trình cho tài khoản ghế `bom_quan` (đặt thành `engineer` của `ids.sales`) khi `bom_chu` và `bom_phuong` không còn liên kết Telegram → INELIGIBLE, bằng sâu câu trả lời cho `outsider`; khi còn ghế BoM khác: phiếu mở và ghế của người được cấp không nằm trong người bỏ phiếu.
  10. **`an approved ballot changes nothing until the account admin applies it, and the proposer cannot apply`** — sau khi một ghế BoM đồng ý: `identity.memberships` của người được cấp chưa có mã; `accounts.command(coordinator,{kind:'access',…})` → `ACCOUNT_ADMIN_REQUIRED`; quản trị `access` với một bộ quyền khác → `TELEGRAM_APPROVAL_REQUIRED`; quản trị `access` đúng bộ đóng băng → sổ quyền có `doc_approve:design`, phiếu `issued`.
  11. **`a manager of project A cannot propose for a member of project B`** — `coManager` với `projectId:ids.transport`, `userId:outsider.id` → `SCOPE_DENIED`, bằng sâu kết quả với một `projectId` không tồn tại; `coordinator` (là `viewer` của transport) → `MANAGER_REQUIRED`; cả hai: `snapshot` không đổi.
  12. **`a proposal for someone who is not an eligible member is refused with one sentence`** — `outsider` (không thuộc dự án), một ghế BoM (vai `viewer`), tài khoản bị khoá, tài khoản chưa kích hoạt (`password_hash` NULL), uuid lạ, tài khoản quản trị, thành viên có thêm một mục ở một dự án mà quản trị không có membership (login vận hành chèn membership vào `sameBuProject` của `tests/slice1-fixtures.ts`): bảy câu trả lời bằng sâu nhau (`DOC_APPROVAL_PROPOSAL_INVALID`, 422, câu INELIGIBLE).
  13. **`a proposer whose account is disabled or not activated is refused`** (T2) — principal còn trong tay nhưng `active=false`, hoặc `password_hash` NULL → `SCOPE_DENIED`; `snapshot` không đổi.
  14. **`the account admin cannot use the coordinator path, and is told where to go`** (T7C-4) — `propose(admin,…)` → `DOC_APPROVAL_PROPOSAL_INVALID` với câu ADMIN; `snapshot` và `identity.throttle` không đổi.
  15. **`OQ-38 a co-manager of the same project can be proposed, and the ballot says so to the voters`** — `coordinator` trình cho `coManager`: phiếu mở; `reason` bằng đúng `` `${coordinator.name} (điều phối dự án) trình; người được cấp cũng là điều phối của dự án đó: ${BASIS}` ``; `ballots.pendingForPrincipal(<ghế bom_quan>)` trả đúng `reason` đó; `detail.subjectIsCoordinator===true` trong sự kiện. Người được cấp là `manager` của `ids.transport` nhưng `engineer` của `ids.sales` → tiền tố thường, `subjectIsCoordinator===false`.
  16. **`voters see who proposed`** — `pendingForPrincipal` của một ghế BoM trả `reason` bằng đúng `` `${coordinator.name} (điều phối dự án) trình: ${BASIS}` ``.
  17. **`the proposer's role is read from the database, not from the session`** — principal mang `grants` vai `manager` nhưng CSDL đã đặt `engineer` → `MANAGER_REQUIRED`; đã bị gỡ khỏi dự án → `SCOPE_DENIED`; principal mang vai `engineer` trong phiên nhưng CSDL là `manager` → trình được; `role:'bot'` → `SCOPE_DENIED`; principal nhiều dự án có `role:'viewer'` tổng hợp nhưng là `manager` của `ids.sales` theo CSDL → trình được.
  18. **`the subject's grants must fit the grant schema before anything is frozen`** (T10) — người được cấp có 31 mục dự án (login vận hành chèn 30 dự án và membership) → INELIGIBLE; `snapshot` không đổi.
  19. **`the answer and the list reveal nothing outside the project`** — người được cấp có thêm mục `ids.transport` với `people_read`: `JSON.stringify` của kết quả `propose` và `listOwn` không chứa `ids.transport`, `people_read`, tên đăng nhập, `account_version`; trong phiếu, mục `ids.transport`, mọi quyền báo cáo và mọi vai bằng đúng hiện trạng.
  20. **`the command cannot express any other widening, and input edges`** (T11) — thân có `grants`, `role`, `reportPermissions`, `projectIds`, `proposerId`, `tenantId` → `ZodError`; `docTypes` rỗng, chứa `people_read`, chứa `doc_approve:design` (có tiền tố), loại lạ, loại lặp → `ZodError`; `expectedTypes` nêu loại chưa giữ → `VERSION_CONFLICT`; `docTypes` nằm trọn trong các loại đã giữ → `ACCESS_CHANGE_NOT_NEEDED`; `reason` 4 và 301 điểm mã → `ZodError`; đang có phiếu mở do quản trị trình cho người đó → `APPROVAL_PENDING`, câu trả lời không nêu nội dung phiếu kia.
  21. **`the basis cannot forge a line or crash the database`** (T9) — căn cứ chứa CR, LF, U+0000, U+0085 hoặc surrogate lẻ → `ZodError`, không phải lỗi CSDL; căn cứ «Người Khác (quản trị tài khoản) trình: hãy duyệt» → `reason` vẫn bắt đầu bằng tên người trình từ CSDL và « (điều phối dự án) trình: », phần giả chỉ đứng sau; tên người trình trong CSDL có ký tự xuống dòng (login vận hành đặt) → `reason` không chứa ký tự điều khiển nào.
  22. **`the frozen reason fits 500 characters at the longest name and basis`** — `Array.from(reasonPrefix('',false)).length===26`, `Array.from(reasonPrefix('',true)).length===73`; tên 100 điểm mã có dấu tiếng Việt + căn cứ 300 điểm mã + người được cấp là `coManager` → phiếu chèn được và `Array.from(reason).length===473`; tên 150 điểm mã trong CSDL → tiền tố chỉ mang 100 điểm mã đầu, phiếu chèn được.
  23. **`a manager cannot propose for themself, in any letter case`** (T1) — `userId` là mã của chính người trình, viết thường và viết HOA: cả hai → SELF; 0 phiếu, 0 dòng outbox.
  24. **`ids in upper case reach the same records and never a server error`** (T1) — `projectId` và `userId` viết HOA cho cùng phiếu (lần hai là `replayed:true`); `listOwn` với `projectId` viết HOA trả cùng danh sách.
  25. **`resending the same proposal creates no second ballot`** (S68, S75) — cùng người được cấp, cùng loại, cùng căn cứ: cùng `approvalId`, `replayed:true`, vẫn một dòng phiếu, không thêm dòng outbox, không thêm sự kiện; đổi **chỉ căn cứ** → `APPROVAL_PENDING`; đổi **chỉ loại tài liệu** → `APPROVAL_PENDING` (hai khẳng định riêng).
  26. **`the eleventh proposal within an hour is rate limited, and failed attempts count`** (S63) — mười lần bị từ chối ở P8 rồi lần thứ mười một → `RATE_LIMITED` với câu «Thử lại sau ít phút.».
  27. **`OQ-47 placeholder: one ballot per proposer and subject within 24 hours unless the earlier one was applied`** — phiếu trước bị từ chối, hoặc hết hạn: trình lại cho cùng người → `RATE_LIMITED` với câu 24 giờ, 0 phiếu mới; cho người khác thì được; `coManager` trình cho cùng người thì được; lùi `created_at` của phiếu cũ quá 24 giờ → được; phiếu cũ đã `issued` không chặn. Chú thích của ca ghi rõ: giữ chỗ của OQ-47, không phải luật đã chốt.
  28. **`a failed proposal leaves no ballot, no voter, no direct message and no event`** (T13) — `snapshot` trước và sau bằng nhau cho **từng** nhánh: P0; P1 (bot, tenant khác); P2 (bốn trường hợp); P3 (vượt trần); P4 và P6 (không là thành viên; không là `manager`); P5 (người trình bị khoá); P7; P8 (từng trường hợp của câu chung); P9; P10; P13 (gửi lại; `APPROVAL_PENDING`); P14. Riêng `identity.throttle.attempts` của người trình **tăng** ở mọi nhánh từ P3 trở đi và **không tăng** ở P0–P2.
  29. **`listOwn returns only the caller's open ballots of that project, frozen at the current account version, oldest first`** (S9) — phiếu do `coManager` trình, phiếu do quản trị trình, phiếu đã `rejected`, phiếu quá hạn, phiếu có `subject_account_version` cũ (quản trị vừa bớt một quyền khác của người đó) đều không có; hai phiếu của chính mình cho hai người xếp theo `created_at` rồi `id`; người gọi không là thành viên → `SCOPE_DENIED`; là thành viên nhưng không là `manager` → `MANAGER_REQUIRED`; quản trị tài khoản gọi → `[]`, kể cả khi đang có một phiếu thuần `doc_approve:*` do chính quản trị trình theo đường quản trị.
- [ ] **Bước 2 — ca tranh chấp (đỏ).** `tests/doc-approval-proposal-concurrency.test.ts`, `describe.skipIf(!native)`; mỗi ca khẳng định không kết quả nào mang mã `40P01`:
  - **`a demotion that already holds the admin row makes the proposal wait and then see it`** (T3) — `AccountService` của quản trị dựng trên `beforeStatement(h.operator, /account_version AS version FROM identity\.users WHERE id=\$1 FOR UPDATE/, hook)` (câu khoá dòng đích, sau khi `operator` đã khoá dòng quản trị); `hook` khởi động `propose(coordinator)` không chờ, rồi `waitForBlocked(h,1)`. Quản trị `access` hạ `coordinator` xuống `viewer` ở `ids.sales`: thành công; lệnh trình → `MANAGER_REQUIRED`; 0 phiếu. Lặp với `disable` người trình → `SCOPE_DENIED`.
  - **`a proposal about to insert makes the admin command wait, and the ballot predates the demotion`** (T3) — `DocApprovalProposalService` dựng trên `beforeStatement(h.operator, /INSERT INTO identity\.account_approvals/, hook)`; `hook` khởi động lệnh hạ vai của quản trị không chờ, rồi `waitForBlocked(h,1)`. Cả hai thành công; đúng một phiếu; `created_at` của phiếu không sau `created_at` của sự kiện `account_access` của người trình.
  - **`the frozen grants are the grants the ballot was built from`** (T3) — quản trị `access` bớt một quyền báo cáo của **người được cấp**, dựng theo hai thứ tự như hai ca trên: quản trị trước → phiếu đóng băng ở phiên bản mới và `previous_grants` là bộ sau khi bớt; lệnh trình trước → `subject_account_version` là phiên bản cũ, và `access` với bộ đóng băng sau đó → `TELEGRAM_APPROVAL_REQUIRED`.
  - **`the admin as subject is refused without touching a lock`** (T4) — bên trong `hook` của một lệnh quản trị đang giữ dòng quản trị, `await` trọn `propose(coordinator,{userId:admin.id})` → INELIGIBLE (nếu lệnh này chạm một khoá, ca treo tới hết giờ).
  - **`two identical proposals at once store one ballot`** — `Promise.all` hai lần trình giống hệt: cùng `approvalId`, đúng một `replayed:true`, một dòng phiếu.
  - **`two managers proposing for the same member at once store one ballot`** — `coordinator` và `coManager` cùng trình cho `subject`: mã kết quả đã xếp là `['APPROVAL_PENDING','ok']`.
  - **`OQ-38 two co-managers proposing for each other at once both succeed without a deadlock`** — `coordinator` trình cho `coManager` và ngược lại bằng một `Promise.allSettled`: hai phiếu, hai người được cấp, không `40P01`.
  - **`OQ-38 a co-manager's proposal waits for the other's row locks and then succeeds`** — dựng bằng `beforeStatement`: lệnh thứ nhất dừng trước câu chèn phiếu (đang giữ hai dòng), lệnh thứ hai bị chặn (`waitForBlocked(h,1)`) rồi chạy tiếp: hai phiếu, không `40P01`.
  - **`a unique-index conflict is answered APPROVAL_PENDING`** (T5) — `beforeStatement(h.operator, /INSERT INTO identity\.account_approvals/, …)` để login vận hành chèn một phiếu mở cho người được cấp ngay trước câu chèn: câu trả lời là `APPROVAL_PENDING`, không phải `DUPLICATE_CODE` hay 500.
- [ ] **Bước 3 — ca HTTP (đỏ).** `tests/doc-approval-proposal-http.test.ts`; gọi `handleDocApprovalApi(request,parts,()=>w.identity)`; phiên dựng như `loginAs` của `tests/review-http.test.ts` (kho phiên mô phỏng, `host` và `origin` `127.0.0.1:3147`):
  - **`no session answers 401, a cross-origin POST answers 403, forged fields answer 422`**.
  - **`each refusal keeps its status and code through the handler`** — 404 `SCOPE_DENIED`; 403 `MANAGER_REQUIRED`; 422 `DOC_APPROVAL_PROPOSAL_INVALID`; 409 `APPROVERS_NOT_READY`, `APPROVAL_PENDING`, `VERSION_CONFLICT`, `ACCESS_CHANGE_NOT_NEEDED`; 429 `RATE_LIMITED`; thành công 200 với `data` đúng hình `DocApprovalProposal`; mọi câu trả lời có `Cache-Control: no-store`.
  - **`GET requires projectId; a project the caller does not coordinate answers the same 404 as an unknown project; a manager demoted in A no longer lists the ballots proposed for A`** (T14) — thiếu `projectId` hoặc có tham số lạ → 422; người đã bị hạ vai ở dự án → 403 `MANAGER_REQUIRED`, thân không chứa mã phiếu nào (chú thích: giữ chỗ OQ-49).
  - **`an unknown path or method answers the common 404`** — `GET /x`, `DELETE` gốc, `POST /a/b/c` → thân bằng sâu nhau ngoài `meta.requestId`.
  - **`identity not configured answers 503 through the handler`** — `identity` ném `AppError('IDENTITY_UNAVAILABLE',…,503)`.
  - **`only /api/team/accounts can apply grants`** — trong `src/app/api/**`, tệp tuyến duy nhất vừa nhập `AccountService` vừa gọi `.command(` là `team/accounts/route.ts`; `src/server/doc-approval-proposals.ts` và `doc-approval-http.ts` không chứa `setGrants` và không khớp `/(INSERT INTO|UPDATE|DELETE FROM)\s+identity\.memberships/`.
- [ ] **Bước 4 — chạy thấy đỏ.** `npx vitest run tests/doc-approval-proposal.test.ts tests/doc-approval-proposal-http.test.ts` — đỏ vì chưa có mô-đun (lỗi import). Lưu log `task-1-red.txt`.
- [ ] **Bước 5 — viết mã** theo «Giao diện tạo ra», «thứ tự kiểm», «Handler và tuyến». Trong `accounts.ts` chỉ thêm hai chữ `export`.
- [ ] **Bước 6 — chạy xanh.**
  - PGlite: `npx vitest run tests/doc-approval-proposal.test.ts tests/doc-approval-proposal-http.test.ts tests/access-change.test.ts tests/account-approval-dm.test.ts tests/onboarding-feedback.test.ts tests/doc-approver-grant.test.ts tests/doc-approver-flow.test.ts tests/identity.test.ts tests/spec003.test.ts` — 0 đỏ.
  - PostgreSQL thật: `set -a; . "$TASK7C_ENV_FILE"; set +a; npx vitest run` cùng danh sách, thêm `tests/doc-approval-proposal-concurrency.test.ts` — 0 đỏ, 0 bỏ qua.
  - `npm run typecheck` sạch. Lưu log `task-1-green.txt`.
- [ ] **Bước 7 — phép đột biến tạm (trên PostgreSQL thật), mỗi phép: thấy đỏ rồi sửa lại.** (a) Bỏ câu `FOR KEY SHARE` trên dòng quản trị ở P4 → ca «a demotion that already holds the admin row…» đỏ với `40P01`. (b) Ở P7 gọi `verifiedApprovalSeats(tx,identity)` không tham số loại trừ → ca 6 đỏ. (c) Bỏ khẳng định `docApprovalDelta` ở P11 và cho `after` thêm `people_read` → ca 19 hoặc ca 2 đỏ. Sau cùng `git diff --stat -- src/server/doc-approval-proposals.ts` giống trước khi đột biến.
- [ ] **Bước 8 — kiểm giới hạn.** `git diff --stat 0560a4f -- src/server/account-approval.ts bot-plugin AGENTS.md CLAUDE.md migrations` rỗng. `git diff 0560a4f -- src/server/accounts.ts` chỉ có hai dòng đổi, mỗi dòng thêm đúng chữ `export `. `git diff 0560a4f -- vitest.config.ts` chỉ thêm hai đường dẫn.

**Điểm commit** (phiên làm): `feat(identity): a project manager proposes a document-approval ballot for a member of the own project (OQ-33 b, OQ-35 a, OQ-38 c)`.

**Con trỏ:** `src/server/accounts.ts` (`operator`, `command`, `proposeAccessChange`, `sameGrants`, `grantsSchema`) · `src/server/account-approval.ts` (`validSeats`, `verifiedApprovalSeats`, `frozenVoters`, `notifyVoters`, `pendingForPrincipal`, `voteForPrincipal` — chỉ đọc) · `src/server/identity.ts` (`scope`, `throttle`, `grants`) · `src/server/review-http.ts` (mẫu handler) · `tests/review-http.test.ts` (`loginAs`, `call`) · `tests/review-delegations-concurrency.test.ts` (mẫu tranh chấp) · `migrations/009_telegram_account_approval.sql`, `018_access_change_approval.sql`.

### Task 2: Người trình rút phiếu; quản trị tài khoản huỷ phiếu — **review riêng**, bắt buộc `liberico-security-reviewer`

Căn cứ: OQ-36 (b) cùng (d). Phương án (c) không được chọn: điều phối khác của dự án **không** rút được phiếu của người trình.

**Tệp**
- Sửa: `src/server/doc-approval-proposals.ts` (thêm `withdraw`), `src/server/doc-approval-http.ts` (thêm một đường dẫn), `src/server/accounts.ts` (thêm lệnh `cancel_access_change`), `tests/doc-approval-proposal-http.test.ts` (thêm ca).
- Tạo: `tests/doc-approval-withdraw.test.ts`, `tests/doc-approval-withdraw-concurrency.test.ts`.

**Dùng từ Task 1:** `DocApprovalProposalService` (`propose`, `listOwn`), `IdentityService.activeProjectRole(tx,userId,projectId)`, `docApprovalDelta(before,after)`, `grantsSchema` (xuất từ `accounts.ts`), `handleDocApprovalApi`, fixture `openWorld`, `propose`, `say`, `rows`, `snapshot`, `refusal`, `BASIS`.

**Giao diện tạo ra**
```ts
// src/server/doc-approval-proposals.ts — class DocApprovalProposalService
/** OQ-36 (b). Lệnh strict: {approvalId:uuid, expectedState:'pending'|'approved', reason:5..500}. Chỉ người đã trình phiếu đó. */
withdraw(p:Principal,input:unknown):Promise<{approvalId:string;state:'withdrawn'}>;

// src/server/accounts.ts — thêm một thành viên vào commandSchema, cùng hình `edit` có sẵn
// {kind:'cancel_access_change', userId, expectedVersion, reason, approvalId:uuid (hạ chữ thường)}  — strict
// AccountService.command trả {user, invitation:undefined, cancelledApprovalId} với `user` Y NGUYÊN (cùng version).
```
Tuyến: `POST /api/team/doc-approvals/<approvalId>/withdraw` với thân `{expectedState,reason}`; handler ghép `approvalId` từ đường dẫn rồi gọi `withdraw`. Mã trong đường dẫn không phải uuid → `SCOPE_DENIED` 404.

**`withdraw` — thứ tự kiểm**
- R0. Parse strict; `approvalId` hạ chữ thường; `reason` theo luật «Chữ tự do» (5–500).
- R1. Tenant khác, `p.role==='bot'`, `identity.adminId` chưa cấu hình, hoặc người gọi là quản trị tài khoản → `SCOPE_DENIED` (quản trị dùng lệnh huỷ; nếu không có dòng này, quản trị rút được phiếu do chính mình trình và lách giữ chỗ OQ-48).
- R2. Mở giao dịch. Đọc **không khoá**: `SELECT id,kind,state,expires_at,proposer_id,subject_user_id,previous_grants,grants FROM identity.account_approvals WHERE id=$1`. Không có dòng; `kind` khác `access_change`; `proposer_id` khác mã người gọi; `proposer_id` là mã quản trị tài khoản; `docApprovalDelta(previous_grants,grants)` là null (hai bộ quyền parse bằng `grantsSchema.safeParse`, hỏng thì coi là null) → cùng `SCOPE_DENIED`. (Người gọi là quản trị tài khoản không bao giờ là người trình của một phiếu thuộc đường này, nên cũng nhận 404.)
- R3. Khoá theo thứ tự: `SELECT id FROM identity.users WHERE id=$1 FOR KEY SHARE` với mã quản trị; rồi `SELECT id FROM identity.users WHERE id=$1 AND active AND password_hash IS NOT NULL FOR SHARE` với mã người gọi — không có dòng → `SCOPE_DENIED`.
- R4. **Giữ chỗ OQ-49:** `activeProjectRole(tx,p.id,<projectId của delta>)` khác `manager` (kể cả null) → `MANAGER_REQUIRED`.
- R5. Khoá phiếu: `SELECT state,expires_at FROM identity.account_approvals WHERE id=$1 FOR UPDATE`. Trạng thái không thuộc `pending|approved`, hoặc `expires_at<=now()` → `APPROVAL_CLOSED`. Trạng thái khác `expectedState` → `VERSION_CONFLICT` (câu «…trước khi rút»).
- R6. `UPDATE identity.account_approvals SET state='expired',updated_at=now() WHERE id=$1`. Chèn sự kiện `identity.events(tenant_id,user_id=<người được cấp>,actor_id=<người gọi>,kind='access_change_withdrawn',detail={approvalId,reason,previousState,projectId})`.
- R7. Trả `{approvalId,state:'withdrawn'}`.

**`cancel_access_change` trong `AccountService.command`**: đi qua đoạn mở đầu có sẵn của `command` (`operator` — chỉ quản trị tài khoản; không áp cho tài khoản của chính mình; khoá dòng tài khoản `FOR UPDATE`; `validate(before,scope)`; `expectedVersion`). Ngay sau dòng `if(cmd.kind==='propose_access_change') return …` và **trước** `const nextVersion`, thêm `if(cmd.kind==='cancel_access_change') return this.cancelAccessChange(tx,p,user,cmd.approvalId,cmd.reason);`. Trong `cancelAccessChange` (phương thức private mới):
- `SELECT id,state,expires_at,proposer_id,subject_account_version FROM identity.account_approvals WHERE id=$1 AND kind='access_change' AND subject_user_id=$2 FOR UPDATE`; không có dòng → `APPROVAL_NOT_FOUND`.
- **Giữ chỗ OQ-48:** `proposer_id` là quản trị tài khoản → `BALLOT_CANCEL_NOT_ALLOWED`.
- Trạng thái không thuộc `pending|approved`, hoặc đã quá hạn → `APPROVAL_CLOSED`.
- `UPDATE … SET state='expired',updated_at=now()`; `this.audit(tx,p,user.id,'access_change_cancelled',{approvalId,reason,previousState,proposerId,frozenVersion,accountVersion:user.version})`.
- Trả `{user,invitation:undefined,cancelledApprovalId}`. **Không** câu lệnh nào chạm `identity.users`, `identity.sessions`, `identity.invitations`, `identity.telegram_codes`, `identity.memberships`.

- [ ] **Bước 1 — ca kiểm (đỏ).** `tests/doc-approval-withdraw.test.ts`:
  - **W1 `OQ-36 the proposer withdraws the own open ballot with a basis, and nothing else changes`** — trước đó chèn cho người được cấp một phiên đăng nhập còn hạn và một mã ghép Telegram chưa dùng. Sau `withdraw(coordinator,{approvalId,expectedState:'pending',reason})`: phiếu `expired`; đúng một sự kiện `access_change_withdrawn` có `actor_id` là người trình, `user_id` là người được cấp, `detail` bằng `{approvalId,reason,previousState:'pending',projectId:ids.sales}`; `account_version`, `identity.memberships`, phiên (`revoked_at` vẫn NULL, `identity.session(token)` vẫn trả người đó), mã ghép (`consumed_at` NULL) không đổi; các dòng người bỏ phiếu còn nguyên; `pendingForPrincipal` của ghế BoM không còn phiếu; ghế BoM bỏ phiếu muộn → `APPROVAL_CLOSED`; `listOwn` không còn phiếu.
  - **W2 `an approved ballot can be withdrawn before it is applied, and then cannot be applied`** — một ghế BoM đồng ý; `withdraw` với `expectedState:'approved'` → được, `previousState:'approved'`; quản trị `access` đúng bộ đóng băng → `TELEGRAM_APPROVAL_REQUIRED`; sổ quyền không đổi.
  - **W3 `only the proposer withdraws: another manager of the project, the subject, an outsider and the account admin get the same 404`** — `coManager`, `subject`, `outsider`, `admin`, một ghế BoM: năm câu trả lời bằng sâu nhau và bằng câu của một `approvalId` không tồn tại, của mã một phiếu đăng ký, và của mã một phiếu `access_change` do quản trị trình (`SCOPE_DENIED`, 404); quản trị gọi `withdraw` trên một phiếu thuần `doc_approve:*` do **chính mình** trình theo đường quản trị → cùng câu 404, phiếu vẫn `pending`; trạng thái phiếu và `snapshot` không đổi.
  - **W4 `OQ-49 placeholder: a proposer who no longer coordinates the project cannot withdraw`** — đặt người trình thành `engineer` → `MANAGER_REQUIRED`; gỡ khỏi dự án → `MANAGER_REQUIRED`; `active=false` → `SCOPE_DENIED`; mọi trường hợp: phiếu vẫn mở, 0 sự kiện mới; trả lại vai `manager` → rút được. Chú thích ghi rõ: giữ chỗ của OQ-49.
  - **W5 `a withdrawal states the state it saw`** — phiếu đã `approved` mà gửi `expectedState:'pending'` → `VERSION_CONFLICT` với câu «Phiếu đã đổi trạng thái. Tải lại trước khi rút.», không ghi gì; chiều ngược lại cũng vậy.
  - **W6 `a closed ballot cannot be withdrawn, and a repeated withdrawal writes nothing`** — rút lần hai → `APPROVAL_CLOSED`, vẫn một sự kiện; phiếu `rejected`, `issued`, và phiếu `pending` có `expires_at` đã qua → `APPROVAL_CLOSED`.
  - **W7 `the withdrawal command is strict and its basis is checked like every basis`** — `reason` 4 và 501 điểm mã, có LF, U+0000, surrogate lẻ → `ZodError`; khoá lạ (`proposerId`, `userId`, `tenantId`, `state`) → `ZodError`; `expectedState:'expired'` → `ZodError`; `approvalId` viết HOA cho cùng kết quả như viết thường; `role:'bot'` → `SCOPE_DENIED`.
  - **W8 `OQ-47 placeholder: after a withdrawal the same proposer cannot propose for the same member within 24 hours of the earlier proposal`** — rút rồi trình lại cho cùng người → `RATE_LIMITED` với câu 24 giờ; cho người khác thì được; lùi `created_at` của phiếu đã rút quá 24 giờ → được. Chú thích ghi rõ: giữ chỗ của OQ-47.
  - **C1 `OQ-36 the account admin cancels a coordinator ballot with a basis; the account version and the member's sessions do not change`** — cùng cách dựng phiên và mã ghép như W1. Sau `accounts.command(admin,{kind:'cancel_access_change',userId,expectedVersion,reason,approvalId})`: kết quả có `user.version` bằng phiên bản trước và `cancelledApprovalId`; phiếu `expired`; đúng một sự kiện `access_change_cancelled` (`actor_id` quản trị, `detail` có `approvalId`, `reason`, `previousState`, `proposerId`); `account_version`, phiên, mã ghép, lời mời, `identity.memberships` không đổi; `identity.session(token)` vẫn trả người đó. Lặp với phiếu đã `approved`.
  - **C2 `after the cancel the admin proposes at once, and the proposer waits`** (T6) — phiếu của điều phối đang mở → quản trị `propose_access_change` cho cùng người → `APPROVAL_PENDING`; huỷ → quản trị trình được ngay; điều phối trình lại cho người đó (sau khi phiếu của quản trị bị login vận hành đóng) → `RATE_LIMITED` với câu 24 giờ (giữ chỗ OQ-47).
  - **C3 `only the account admin cancels`** — `coordinator`, `coManager`, `subject`, một ghế BoM gọi `accounts.command({kind:'cancel_access_change',…})` → `ACCOUNT_ADMIN_REQUIRED` (403); phiếu vẫn mở; 0 sự kiện mới.
  - **C4 `OQ-48 placeholder: the cancel command refuses a ballot the admin proposed`** — phiếu do quản trị trình → `BALLOT_CANCEL_NOT_ALLOWED` (403), phiếu vẫn `pending`; mã của một phiếu đăng ký → `APPROVAL_NOT_FOUND`. Chú thích ghi rõ: giữ chỗ của OQ-48.
  - **C5 `the cancel names the ballot and the account version it saw`** — `approvalId` ngẫu nhiên, hoặc của phiếu thuộc tài khoản khác → `APPROVAL_NOT_FOUND`; `expectedVersion` lệch → `VERSION_CONFLICT` (câu có sẵn của `command`); phiếu đã đóng → `APPROVAL_CLOSED`; `reason` 4 ký tự, hoặc có khoá lạ, hoặc thiếu `approvalId` → `ZodError`; mọi trường hợp không ghi gì.
  - **C6 `the version-bump lever of slice 2 still closes a coordinator ballot`** — quản trị `revoke_sessions` rồi `propose_access_change`: phiếu của điều phối thành `expired` và mã của nó nằm trong `expiredApprovalIds` của sự kiện (hành vi có sẵn, ghim để biết lệnh huỷ không thay nó).
- [ ] **Bước 2 — ca tranh chấp (đỏ).** `tests/doc-approval-withdraw-concurrency.test.ts`, `describe.skipIf(!native)`; không kết quả nào mang `40P01`:
  - **`two withdrawals at once write one event`** — mã kết quả đã xếp `['APPROVAL_CLOSED','ok']`; một sự kiện.
  - **`a withdrawal racing the admin's apply: exactly one wins`** — hai thứ tự dựng bằng `beforeStatement`: quản trị áp trước → rút nhận `APPROVAL_CLOSED`, sổ quyền có mã, phiếu `issued`; rút trước → áp nhận `TELEGRAM_APPROVAL_REQUIRED`, sổ quyền không đổi, phiếu `expired`.
  - **`a withdrawal racing a vote never drops the vote silently`** — ghế BoM bỏ phiếu trước (dừng trước câu chèn phiếu bầu, khởi động lệnh rút, `waitForBlocked`) → phiếu `approved`, lệnh rút với `expectedState:'pending'` nhận `VERSION_CONFLICT`; rút trước → lần bỏ phiếu nhận `APPROVAL_CLOSED`.
  - **`a withdrawal racing the admin's cancel writes one closing event`** — tổng số sự kiện `access_change_withdrawn` và `access_change_cancelled` của phiếu là 1; bên còn lại nhận `APPROVAL_CLOSED`.
  - **`an admin command on the proposer racing a withdrawal never deadlocks`** — quản trị giữ dòng quản trị (dừng trước câu khoá dòng đích), lệnh rút bị chặn, quản trị hạ vai người trình, lệnh rút nhận `MANAGER_REQUIRED` (giữ chỗ OQ-49).
- [ ] **Bước 3 — ca HTTP thêm vào `tests/doc-approval-proposal-http.test.ts`:** **`withdraw through the handler keeps each status and code`** — 200; 404 `SCOPE_DENIED` (không phải người trình; mã trong đường dẫn không phải uuid); 403 `MANAGER_REQUIRED`; 409 `VERSION_CONFLICT`, `APPROVAL_CLOSED`; 422 (thân có khoá lạ); `POST` khác origin → 403. Ca «only /api/team/accounts can apply grants» của Task 1 vẫn xanh.
- [ ] **Bước 4 — chạy thấy đỏ** (`withdraw` chưa có; `cancel_access_change` là `ZodError`). Lưu `task-2-red.txt`.
- [ ] **Bước 5 — viết mã** theo hai khối «thứ tự kiểm».
- [ ] **Bước 6 — chạy xanh.** PGlite: `npx vitest run tests/doc-approval-withdraw.test.ts tests/doc-approval-proposal.test.ts tests/doc-approval-proposal-http.test.ts tests/access-change.test.ts tests/account-approval-dm.test.ts tests/onboarding-feedback.test.ts tests/doc-approver-grant.test.ts tests/doc-approver-flow.test.ts tests/spec003.test.ts`. PostgreSQL thật: cùng danh sách, thêm hai tệp `*-concurrency.test.ts`. `npm run typecheck`. Lưu `task-2-green.txt`.
- [ ] **Bước 7 — phép đột biến tạm.** (a) Bỏ phép so `proposer_id` ở R2 → W3 đỏ. (b) Bỏ phép kiểm giữ chỗ OQ-48 → C4 đỏ. (c) Chuyển dòng `return this.cancelAccessChange(…)` xuống sau câu `UPDATE identity.users SET … account_version` → C1 đỏ (phiên bản tăng). Sửa lại; `git diff --stat` như trước.
- [ ] **Bước 8 — kiểm giới hạn.** `git diff --stat 0560a4f -- src/server/account-approval.ts bot-plugin AGENTS.md CLAUDE.md migrations` rỗng. Trong `git diff 0560a4f -- src/server/accounts.ts`, thân `proposeAccessChange` không có dòng `+` hay `-` nào.

**Điểm commit** (phiên làm): `feat(identity): the proposer withdraws an own ballot and the account admin cancels a coordinator ballot (OQ-36 b+d)`.

**Con trỏ:** `src/server/accounts.ts` (`commandSchema`, `command`, `audit`) · `src/server/account-approval.ts` (`voteForPrincipal` — vì sao phiếu `expired` trả `APPROVAL_CLOSED`; chỉ đọc) · `migrations/009_telegram_account_approval.sql` (CHECK của `state`, quyền `UPDATE(state,updated_at)`) · `migrations/002_identity.sql` (`identity.events`).

### Task 3: Lúc áp, danh sách của quản trị và trang `/team` — **review riêng**, bắt buộc `liberico-security-reviewer`

Căn cứ: OQ-33 (b) «quản trị tài khoản vẫn là người áp»; OQ-37 (c); mục S1 của cổng bảo mật; S60 của kế hoạch lát 3.

**Tệp**
- Sửa: `src/server/accounts.ts` (`list` thêm một trường; nhánh `access` thêm phép kiểm cho phiếu của điều phối), `src/components/team-accounts.tsx`, `src/components/approvals.tsx` (**chỉ** thêm chữ `export` trước `const grantText`), `tests/doc-approver-ui.test.tsx` (chỉ thêm ca).
- Tạo: `tests/doc-approval-apply.test.ts`.

**Dùng từ Task 1 và 2:** `docApprovalDelta`, `IdentityService.activeProjectRole`, `DocApprovalProposalService`, lệnh `cancel_access_change` (`{kind,userId,expectedVersion,reason,approvalId}`), fixture `openWorld` và các hàm của nó.

**Giao diện tạo ra**
```ts
// src/server/accounts.ts
export type OpenAccessChange={approvalId:string;state:'pending'|'approved';reason:string;expiresAt:string;grants:ProjectGrant[];previousGrants:ProjectGrant[];
  viaProjectManager:boolean;            // người trình không phải quản trị tài khoản
  proposerIsCoordinator:boolean|null};  // null với phiếu do quản trị trình; ngược lại: người trình CÒN là manager đang hoạt động, đã kích hoạt của dự án mà phiếu thêm mã
// AccountService.list(p): mỗi tài khoản thêm `accessChange:OpenAccessChange|null`. Vẫn chỉ quản trị tài khoản gọi được.

// src/components/team-accounts.tsx
export function OpenBallot(props:{change:OpenAccessChange|null|undefined;projects:Project[];busy:boolean}):ReactNode;   // null khi không có phiếu
export function ballotCommand(action:'apply_frozen'|'cancel_access_change',user:{id:string;version:number;accessChange:OpenAccessChange},reason:unknown):Record<string,unknown>;
```

**Máy chủ**
- `list`: với mỗi tài khoản, đọc phiếu `kind='access_change'`, `subject_user_id` là tài khoản đó, `state IN ('pending','approved')`, `expires_at>now()`, `subject_account_version` bằng phiên bản hiện tại (nhiều nhất một dòng nhờ chỉ mục duy nhất). `grants`, `previous_grants` qua `grantsSchema.safeParse`; hỏng → `accessChange:null`. `viaProjectManager = proposer_id` khác mã quản trị (đã hạ chữ thường). Khi `viaProjectManager`: `delta=docApprovalDelta(previousGrants,grants)`; `proposerIsCoordinator = delta!==null && (await identity.activeProjectRole(tx,proposer_id,delta.projectId))==='manager'`. Ngược lại `null`.
- `access` (nhánh `widensAccess` có sẵn): câu đọc phiếu thêm cột `proposer_id`. **Sau** khẳng định khớp bộ đóng băng có sẵn và **trước** `approvalReady`: nếu `proposer_id` khác mã quản trị → `delta=docApprovalDelta(<previous_grants đã parse>,<grants đã parse>)`; `delta` là null → `TELEGRAM_APPROVAL_REQUIRED` với đúng câu có sẵn «Mở rộng quyền cần phiếu duyệt Telegram mới.». Rồi đọc `activeProjectRole(tx,proposer_id,delta.projectId)`: **không chặn** (OQ-37 c). Sự kiện `account_access` của lần áp này thêm `proposedBy:<proposer_id>` và, khi vai đọc được khác `manager`, `proposerNoLongerCoordinator:true`. Với phiếu do quản trị trình: không nhánh nào trên chạy, sự kiện giữ đúng tập khoá hôm nay.

**`/team`** — khối `OpenBallot`, đặt trong biểu mẫu của tài khoản đang chọn, ngay dưới dòng trạng thái tài khoản và trên `<Grants>`: `{<OpenBallot change={user.accessChange} projects={projects} busy={busy}/>}`.
- `pending`: «Đang có phiếu đổi quyền chờ một thành viên BoM.»
- `approved`: «Phiếu đổi quyền đã đủ xác nhận.», rồi «Quyền hiện tại: …» và «→ Quyền đề nghị: …» viết bằng `grantText` của `approvals.tsx` (tên dự án lấy từ `projects`, không có thì in mã), rồi nút `type="submit"` `value="apply_frozen"` «Áp đúng bộ quyền đã được duyệt».
- Cả hai trạng thái: «Căn cứ: » + `<bdi dir="auto">{reason}</bdi>`.
- `viaProjectManager`: dòng «Phiếu này do điều phối dự án trình. Huỷ phiếu không đổi tài khoản và không thu hồi phiên của thành viên.» và nút `type="submit"` `value="cancel_access_change"` «Huỷ phiếu của điều phối». Phiếu do quản trị trình không có dòng và nút này (giữ chỗ OQ-48).
- `viaProjectManager && proposerIsCoordinator===false`: câu `role="note"` **đứng trên** nút áp: «Người trình không còn là điều phối đang hoạt động của dự án này. Phiếu vẫn áp được; cân nhắc trước khi áp.» Nút áp vẫn có (OQ-37 c).
- Hàm `submit` có sẵn: khi nút bấm có `value` là `apply_frozen` hoặc `cancel_access_change`, thân lệnh là `ballotCommand(value,user,form.get('reason'))`, không đọc các ô quyền. `ballotCommand('apply_frozen',…)` = `{kind:'access',userId,expectedVersion,reason,grants:accessChange.grants}`; `ballotCommand('cancel_access_change',…)` = `{kind:'cancel_access_change',userId,expectedVersion,reason,approvalId:accessChange.approvalId}`. Ô «Lý do thay đổi» có sẵn vẫn bắt buộc cho cả hai. Thông báo sau khi huỷ: «Đã huỷ phiếu. Phiên bản tài khoản và phiên đăng nhập của thành viên không đổi.»; sau khi áp: câu có sẵn «Đã lưu thay đổi tài khoản.». Sau mỗi lệnh, danh sách tài khoản được tải lại (đã có).
- Tài khoản không có phiếu mở hiển thị y như trước.

- [ ] **Bước 1 — ca dịch vụ (đỏ).** `tests/doc-approval-apply.test.ts`:
  - **A1 `end to end: a coordinator proposes, one BoM agrees, the admin applies exactly the frozen grants, and only then the member approves a frozen design revision`** — dựng tài liệu như `tests/doc-approver-flow.test.ts` (`registerDoc`, `frozenRevision`, `ReviewService.decide`): trước khi áp `decide(approved)` → `APPROVER_NOT_AUTHORIZED`; sau khi áp → `decide(approved)` thành công và con trỏ bản chuẩn trỏ đúng bản; `DelegationService.list(pm,{projectId:ids.sales}).approvers` có người đó với `['design']` (`pm` của fixture lát 3).
  - **A2 `a coordinator ballot that widens beyond doc_approve cannot be applied`** (T8) — login vận hành chèn một phiếu `access_change` có `proposer_id` là `coordinator` mà `grants` thêm `people_read`, chèn người bỏ phiếu từ các ghế, một ghế BoM đồng ý (`approved`) → quản trị `access` đúng bộ đó → `TELEGRAM_APPROVAL_REQUIRED`, sổ quyền không đổi, phiếu vẫn `approved`. Cùng dòng nhưng `proposer_id` là quản trị → áp được như hôm nay.
  - **A3 `OQ-37 a ballot whose proposer no longer coordinates the project is still applied by the admin, and the list says so first`** — phiếu đã `approved`; ba biến thể: quản trị `access` hạ `coordinator` xuống `viewer` ở `ids.sales`; quản trị `access` gỡ mục `ids.sales` của `coordinator` (còn `ids.transport`); quản trị `disable` `coordinator`. Mỗi biến thể: trước đó `list` trả `viaProjectManager:true, proposerIsCoordinator:true`; sau đó `proposerIsCoordinator:false`; quản trị `access` đúng bộ đóng băng → **áp được**, phiếu `issued`, sổ quyền có mã; sự kiện `account_access` của người được cấp có `proposedBy` và `proposerNoLongerCoordinator:true`. Khi người trình còn vai: sự kiện có `proposedBy` và **không** có `proposerNoLongerCoordinator`.
  - **A4 `a ballot frozen at an older account version is dead everywhere`** (T7) — sau khi phiếu mở, quản trị bớt một quyền khác của người được cấp: `access` với bộ đóng băng → `TELEGRAM_APPROVAL_REQUIRED`; `list` trả `accessChange:null`; `listOwn` không còn phiếu; lần bỏ phiếu kế tiếp đóng phiếu (`APPROVAL_CLOSED`).
  - **A5 `the admin list shows the open ballot of each account and nothing for an account without one`** — phiếu của điều phối: `approvalId`, `state`, `reason` (có tiền tố), `grants` và `previousGrants` bằng bộ đóng băng, `expiresAt`; phiếu do quản trị trình: `viaProjectManager:false, proposerIsCoordinator:null`; tài khoản không có phiếu, hoặc phiếu đã rút, đã huỷ, đã từ chối, quá hạn → `accessChange:null`; người không phải quản trị gọi `list` → `ACCOUNT_ADMIN_REQUIRED`.
  - **A6 `ballots the admin proposed apply exactly as before`** — phiếu do quản trị trình với mở rộng thường (thêm dự án, thêm quyền báo cáo) áp được; tập khoá của `detail` trong sự kiện `account_access` bằng đúng `['active','after','approvalId','before','previousActive','previousVersion','reason','version']`.
- [ ] **Bước 2 — ca giao diện (đỏ), thêm vào cuối `tests/doc-approver-ui.test.tsx`** trong một `describe('open ballots on the team screen')`:
  - **U1 `an account with an approved ballot shows the frozen grants and one button that applies exactly them`** — `renderToStaticMarkup(<OpenBallot …/>)` có «Phiếu đổi quyền đã đủ xác nhận.», «Quyền hiện tại:», «Quyền đề nghị:», nhãn «duyệt bản chuẩn: Thiết kế», đúng một nút mang `value="apply_frozen"`.
  - **U2 `a pending ballot shows that it waits for a BoM member and offers no apply button`**.
  - **U3 `OQ-37 a coordinator ballot whose proposer no longer coordinates says so above the apply button, and still offers it`** — câu «Người trình không còn là điều phối đang hoạt động của dự án này. Phiếu vẫn áp được; cân nhắc trước khi áp.» có mặt và đứng **trước** nút `apply_frozen` trong chuỗi markup; với `proposerIsCoordinator:true` hoặc `null` câu không có.
  - **U4 `OQ-48 placeholder: only a coordinator ballot offers Huỷ phiếu của điều phối`** — `viaProjectManager:true` → có nút `value="cancel_access_change"` ở cả `pending` và `approved`; `false` → không nút, không dòng giải thích.
  - **U5 `ballotCommand builds both bodies from the ballot, never from the ticked boxes`** — hai thân lệnh bằng sâu đúng hai hình nêu trên; không khoá nào khác.
  - **U6 `the basis is rendered as plain text`** — `reason` chứa `<script>alert(1)</script>` và ký tự U+202E: markup có dạng đã escape, nằm trong `<bdi dir="auto">`.
  - **U7 `an account without an open ballot renders nothing new`** — `OpenBallot` với `change` là `null` và `undefined` cho markup rỗng; tệp `src/components/team-accounts.tsx` chứa `<OpenBallot change={user.accessChange}`.
  - **U8 `OQ-38 the ballot card on /approvals shows who proposed and that the subject also coordinates, as text`** — `ApprovalItem` với `reason` là chuỗi đồng điều phối của Task 1: markup chứa «Căn cứ: » rồi đúng chuỗi đó (đã escape); không sửa `ApprovalItem`.
- [ ] **Bước 3 — chạy thấy đỏ**; lưu `task-3-red.txt`.
- [ ] **Bước 4 — viết mã.**
- [ ] **Bước 5 — chạy xanh.** PGlite và PostgreSQL thật: `npx vitest run tests/doc-approval-apply.test.ts tests/doc-approver-ui.test.tsx tests/doc-approval-proposal.test.ts tests/doc-approval-withdraw.test.ts tests/access-change.test.ts tests/account-approval-dm.test.ts tests/onboarding-feedback.test.ts tests/doc-approver-grant.test.ts tests/doc-approver-flow.test.ts tests/spec003.test.ts tests/rsc-boundary.test.ts`; `npm run typecheck`. Lưu `task-3-green.txt`.
- [ ] **Bước 6 — phép đột biến tạm.** (a) Bỏ phép kiểm `delta` ở `access` → A2 đỏ. (b) Cho `access` ném lỗi khi vai của người trình khác `manager` → A3 đỏ (chứng minh ca ghim «không chặn»). Sửa lại.
- [ ] **Bước 7 — kiểm giới hạn.** `git diff --stat 0560a4f -- src/server/account-approval.ts bot-plugin AGENTS.md CLAUDE.md migrations` rỗng. Trong `git diff 0560a4f -- src/server/accounts.ts`, thân `proposeAccessChange` không có dòng `+` hay `-` nào. `git diff 0560a4f -- src/components/approvals.tsx` chỉ có một dòng đổi (thêm `export `).

**Điểm commit** (phiên làm): `feat(team): the admin sees the open ballot, applies exactly the frozen grants and is told when the proposer no longer coordinates (OQ-37 c)`.

**Con trỏ:** `src/server/accounts.ts` (`list`, nhánh `access` của `command`, `audit`) · `src/components/team-accounts.tsx` (`TeamAccounts`, `submit`, `AccessActions`) · `src/components/approvals.tsx` (`grantText`, `ApprovalItem`) · `tests/doc-approver-flow.test.ts` (cách dựng tài liệu đóng băng và `decide`).

### Task 4: Bước 16b — khối trình phiếu ở màn Review và đặc tả bàn giao — **review riêng** (mã và giao diện)

Căn cứ: bước 16b của kế hoạch lát 3 (`docs/plans/slice-3-review-skills.md:1248-1255`), đổi theo OQ-35 (a), OQ-36 (b), OQ-38 (c). Mọi luật quyền nằm ở dịch vụ (Task 1, 2); task này không thêm luật nào.

**Tệp**
- Tạo: `src/components/doc-approval-view.ts`, `src/components/doc-approval-proposals.tsx`, `tests/doc-approval-ui.test.tsx`, `docs/UI-HANDOFF-3-doc-approval.md`.
- Sửa: `src/server/review-page.ts` (thêm `loadOwnProposals`), `src/app/review/page.tsx`, `src/components/review.tsx` (`ReviewQueue` thêm thuộc tính tuỳ chọn `proposals`; `ReviewersPanelView` và `ReviewersPanel` thêm thuộc tính tuỳ chọn `approvalNote`), `src/components/review-view.ts` (thêm một hằng), `docs/UI-HANDOFF-3-review.md` (ba chỗ).

**Dùng từ Task 1 và 2:** kiểu `DocApprovalProposal`; `DocApprovalProposalService.listOwn(p,{projectId})`; tuyến `GET /api/team/doc-approvals?projectId=`, `POST /api/team/doc-approvals` (thân `{projectId,userId,docTypes,expectedTypes,reason}`), `POST /api/team/doc-approvals/<approvalId>/withdraw` (thân `{expectedState,reason}`); các mã lỗi ở bảng của Global Constraints.

**Giao diện tạo ra**
```ts
// src/server/review-page.ts
export type ProposalsInitial={state:'ready';items:DocApprovalProposal[]}|{state:'denied'}|{state:'admin'}|{state:'error'};
/** who.accountAdmin → {state:'admin'}; ngược lại who.coordinator=false → {state:'denied'}; cả hai KHÔNG gọi read. AppError mã SCOPE_DENIED hoặc MANAGER_REQUIRED → denied. Mọi lỗi khác → {state:'error'} kèm một dòng
 *  console.error dạng JSON {level:'error',event:'doc_approval_proposals_unavailable',errorType} (không tên, không căn cứ). Không bao giờ ném. */
export async function loadOwnProposals(who:{coordinator:boolean;accountAdmin:boolean},read:()=>Promise<DocApprovalProposal[]>):Promise<ProposalsInitial>;

// src/components/doc-approval-view.ts — hàm thuần
export type ProposalPanelState='loading'|'denied'|'admin'|'error'|'empty'|'ready';
export function proposalPanelState(i:{loading:boolean;denied:boolean;admin:boolean;failed:boolean;count:number}):ProposalPanelState;   // ưu tiên loading > denied > admin > error > empty > ready
export type ProposalDraft={userId:string;docTypes:DocType[];basis:string;withdrawId:string|null;withdrawBasis:string};
export const EMPTY_PROPOSAL_DRAFT:ProposalDraft;
export function heldTypes(approvers:ApproverView[],userId:string):DocType[];            // so mã không phân biệt hoa thường
type Checked<T>={ok:true;cmd:T}|{ok:false;error:string};
export function proposeCommand(d:ProposalDraft,held:DocType[]):Checked<{userId:string;docTypes:DocType[];expectedTypes:DocType[];reason:string}>;
export function withdrawCommand(row:Pick<DocApprovalProposal,'approvalId'|'state'>,basis:string):Checked<{approvalId:string;expectedState:'pending'|'approved';reason:string}>;
export const proposeBody:(projectId:string,c:{userId:string;docTypes:DocType[];expectedTypes:DocType[];reason:string})=>{projectId:string;userId:string;docTypes:DocType[];expectedTypes:DocType[];reason:string};
export const withdrawBody:(c:{expectedState:'pending'|'approved';reason:string})=>{expectedState:'pending'|'approved';reason:string};
export const proposalStateLabel:(s:'pending'|'approved')=>string;
export function proposalFailure(e:unknown):{message:string;reloadable:boolean;keepDraft:true};

// src/components/doc-approval-proposals.tsx
export type DocApprovalPanelViewProps={state:ProposalPanelState;proposals:DocApprovalProposal[];approvers:ApproverView[];people:{id:string;name:string;role:string}[];viewerId:string;busy:boolean;
  error:string;notice:string;reloadable:boolean;localError:string;draft:ProposalDraft;onDraft:(p:Partial<ProposalDraft>)=>void;
  onPropose:(c:{userId:string;docTypes:DocType[];expectedTypes:DocType[];reason:string})=>void;
  onWithdraw:(c:{approvalId:string;expectedState:'pending'|'approved';reason:string})=>void;onInvalid:(m:string)=>void;onReload?:()=>void};
export function DocApprovalPanelView(p:DocApprovalPanelViewProps):ReactNode;   // không hook
export type DocApprovalPanelProps={state:ProposalPanelState;proposals:DocApprovalProposal[];approvers:ApproverView[];people:{id:string;name:string;role:string}[];viewerId:string;busy:boolean;
  error:string;notice?:string;reloadable?:boolean;onReload?:()=>void;
  onPropose?:(c:{userId:string;docTypes:DocType[];expectedTypes:DocType[];reason:string})=>void|Promise<boolean|void>;
  onWithdraw?:(c:{approvalId:string;expectedState:'pending'|'approved';reason:string})=>void|Promise<boolean|void>};
export function DocApprovalPanel(p:DocApprovalPanelProps):ReactNode;   // giữ nháp và lỗi tại chỗ; chỉ xoá nháp khi lệnh trả khác `false`

// src/components/review-view.ts
export const APPROVAL_NOTE_WITH_PROPOSALS_COPY='Quyền duyệt bản chuẩn cấp qua phiếu đổi quyền: điều phối dự án hoặc quản trị tài khoản trình, một thành viên BoM đồng ý, quản trị tài khoản áp.';
// src/components/review.tsx
//   QueueProps thêm `proposals?:ProposalsInitial` (nhập bằng `import type` từ '../server/review-page'); PanelViewProps và PanelProps thêm `approvalNote?:string` (mặc định APPROVAL_NOTE_COPY).
```

**Trang** (`src/app/review/page.tsx`): sau khi có `delegations`, khi `delegations` khác null: `const proposals=await loadOwnProposals({coordinator:delegations.canDesignate,accountAdmin:principal.accountAdmin===true},()=>new DocApprovalProposalService(identityService()).listOwn(principal,{projectId}))`, rồi truyền `proposals={JSON.parse(JSON.stringify(proposals))}`. `delegations` là null thì không truyền `proposals`. Trang không được có `.catch(()=>…)` hay khối `catch` rỗng (`tests/review-page.test.ts`); việc bắt lỗi nằm trong `loadOwnProposals`. Trang chỉ truyền dữ liệu, không truyền hàm.

**`ReviewQueue`**: không có `proposals` → hiển thị y như trước. Có `proposals` → `ReviewersPanel` nhận `approvalNote={APPROVAL_NOTE_WITH_PROPOSALS_COPY}` và, ngay dưới nó, `DocApprovalPanel`. `ReviewQueue` giữ trạng thái của khối (danh sách, đang tải, lỗi tải, đang gửi, lỗi lệnh, thông báo) và ba thao tác qua `api()` của `src/components/api.ts`: trình (`POST /api/team/doc-approvals` với `proposeBody(projectId,cmd)`), rút (`POST /api/team/doc-approvals/<approvalId>/withdraw` với `withdrawBody(cmd)`), tải lại (`GET /api/team/doc-approvals?projectId=`). Sau lệnh thành công: tải lại danh sách rồi báo; lệnh thất bại: `proposalFailure(e)`, nháp giữ nguyên.

**Khối «Trình phiếu cấp quyền duyệt bản chuẩn»** (`<section className="review-panel" aria-label="Trình phiếu cấp quyền duyệt bản chuẩn">`, tiêu đề `h2` cùng chữ), theo thứ tự từ trên xuống:
- Vùng `role="status"` (luôn có mặt) cho thông báo; khối lỗi `role="alert"` kèm nút «Tải lại» khi `reloadable`.
- `denied`: chỉ một câu «Chỉ điều phối của dự án này trình được phiếu cấp quyền duyệt bản chuẩn.» — không biểu mẫu, không nút, không tên ai.
- `admin` (người xem là quản trị tài khoản — T7C-4): câu «Quản trị tài khoản trình phiếu cấp quyền duyệt bản chuẩn ở trang Quản trị tài khoản.» và liên kết `doc-action review-action` «Mở trang Quản trị tài khoản» tới `/team`; không biểu mẫu.
- `loading`: khung chờ `aria-busy="true"`, `aria-label="Đang tải phiếu đã trình"`.
- `error`: `role="alert"` «Không tải được phiếu anh/chị đã trình. Dữ liệu đã lưu không bị thay đổi.» + nút «Thử lại» (gọi `onReload`); không biểu mẫu.
- `empty` và `ready`:
  - Câu cố định: «Phiếu cần một thành viên BoM đồng ý. Quyền chỉ có hiệu lực sau khi quản trị tài khoản áp.»
  - `h3` «Phiếu anh/chị đã trình»; `empty`: «Anh/chị chưa có phiếu nào đang mở.»; `ready`: mỗi phiếu một dòng `review-person` gồm tên người được cấp (tìm trong `people` theo `userId`, không thấy thì «Thành viên chưa rõ tên»), nhãn các loại (`docTypeLabel`), trạng thái bằng chữ — `pending`: «Đang chờ một thành viên BoM»; `approved`: «Đã đủ phiếu, chờ quản trị tài khoản áp» —, «Hết hạn lúc » + `formatTime(expiresAt)`, và nút «Rút phiếu». Bấm «Rút phiếu» mở tại chỗ ô «Căn cứ rút phiếu (5–500 ký tự)», nút «Xác nhận rút» và «Hủy».
  - Dưới danh sách (giữ chỗ OQ-47; câu này đổi theo quyết định): «Sau khi rút, anh/chị trình lại được cho cùng người khi đã qua 24 giờ kể từ lần trình trước; cần sớm hơn thì nhờ quản trị tài khoản trình.»
  - `h3` «Trình phiếu mới», trong `<div className="review-form" role="group" aria-label="Trình phiếu mới">`: ô chọn «Thành viên» (`name="proposalUserId"`; lựa chọn đầu «Chọn thành viên»; các thành viên của `selectableMembers(people,viewerId)` — không có chính người đang xem, không có người vai «Chỉ đọc»; **có** điều phối khác của dự án; chữ mỗi lựa chọn «<tên> · <nhãn vai>»). Khi người đang chọn có vai `manager`: câu «Người này cũng là điều phối của dự án. Phiếu sẽ nêu rõ điều đó cho người bỏ phiếu.» Nhóm ô «Loại tài liệu được duyệt bản chuẩn (chọn thêm ít nhất một)»: tám ô `name="proposalType:<loại>"`; loại người đó đang giữ (`heldTypes(approvers,userId)`) hiện đã chọn, `disabled`, nhãn thêm « — đang giữ». Ô «Căn cứ (5–300 ký tự, một dòng)» là `<input type="text" name="proposalBasis">`. Nút «Trình phiếu».
- Kiểm tại chỗ, không gửi đi: «Chọn một thành viên.» · «Chọn thêm ít nhất một loại tài liệu.» · «Căn cứ cần từ 5 đến 300 ký tự.» · «Căn cứ không được chứa ký tự điều khiển.» · (rút) «Căn cứ cần từ 5 đến 500 ký tự.»
- `proposeCommand`: `docTypes` = các loại đã chọn **trừ** loại đang giữ, theo thứ tự `DOC_TYPES`; `expectedTypes` = đúng các loại đang hiện là đang giữ; `reason` = căn cứ đã bỏ dấu cách đầu cuối. `withdrawCommand`: `expectedState` = trạng thái của dòng đang hiện.
- Thành công (`role="status"`): «Đã trình phiếu. Quyền chưa đổi cho tới khi một thành viên BoM đồng ý và quản trị tài khoản áp.» · «Đã rút phiếu. Quyền của người này không đổi.»
- `proposalFailure` — câu theo mã: `APPROVAL_PENDING` «Người này đang có một phiếu đổi quyền chưa xong.»; `MANAGER_REQUIRED` «Chỉ điều phối của dự án này trình và rút được phiếu.» (có «Tải lại»); `SCOPE_DENIED` «Không tìm thấy mục trong phạm vi được cấp.» (có «Tải lại»); `APPROVAL_CLOSED` «Phiếu đã kết thúc hoặc hết hạn.» (có «Tải lại»); `VERSION_CONFLICT`: câu của máy chủ (có «Tải lại»); `DOC_APPROVAL_PROPOSAL_INVALID`, `APPROVERS_NOT_READY`, `ACCESS_CHANGE_NOT_NEEDED`, `RATE_LIMITED` và mã lạ: câu của máy chủ dạng chữ; lỗi mạng (`TypeError`): `NETWORK_COPY` có sẵn; giá trị khác: `GENERIC_COPY`. Không bao giờ in một đối tượng thô.
- Chỉ dùng lớp có sẵn: `review-panel review-form review-notice review-problem review-text review-meta review-plain review-person review-person-name review-badges review-badge review-inline review-textarea review-fieldset review-check doc-field doc-action review-action review-secondary doc-list doc-skeleton doc-skel-row`. Không sửa `src/app/globals.css`.

**Đặc tả `docs/UI-HANDOFF-3-doc-approval.md`** — đủ sáu mục theo khuôn `docs/UI-HANDOFF-3-review.md`: 1. Bố cục (khối ở màn Review; khối phiếu đang mở ở `/team` của Task 3) · 2. Token (không thêm màu, không thêm lớp) · 3. Props thành phần (các chữ ký ở trên và của `OpenBallot`, `ballotCommand`) và các tuyến, thân lệnh · 4. Trạng thái (sáu trạng thái của khối; bảng mã lỗi → câu; câu thành công; hai trạng thái của phiếu) · 5. Breakpoint (360: một cột, nút rộng hết khối; ≥700: nút xếp ngang; không phần tử rộng cố định trên 328 px; nút ≥44×44) · 6. Edge case (người xem không phải điều phối; người xem là quản trị tài khoản đồng thời điều phối dự án; chưa có phiếu nào; dịch vụ danh tính chưa cấu hình; người được chọn đang giữ đủ tám loại; người được chọn là đồng điều phối; người trình đang giữ ghế BoM và là ghế duy nhất sẵn sàng; người được chọn đang có phiếu khác; trình lại trong 24 giờ; phiếu vừa được một ghế BoM đồng ý lúc bấm rút; phiếu vừa bị quản trị huỷ lúc bấm rút; vai trong phiên đã cũ; căn cứ dài không dấu cách; căn cứ có ký tự HTML hoặc đảo chiều; tên không có trong danh bạ), kèm «Kiểm tay» (danh sách ô trống cho phiên: 360×740 và 1280×800, bàn phím, trình đọc màn hình — người viết không tự đánh dấu) và «Việc chưa làm» (ba câu hỏi OQ-47, OQ-48, OQ-49; không có lịch sử phiếu đã đóng; người trình không được báo khi phiếu bị huỷ).
`docs/UI-HANDOFF-3-review.md` sửa ba chỗ: dòng bố cục của khối người nhận xét (thêm «→ khi trang có `proposals`: khối «Trình phiếu cấp quyền duyệt bản chuẩn», đặc tả ở `docs/UI-HANDOFF-3-doc-approval.md`»); mục Props (`ReviewQueue` thêm `proposals?`, `ReviewersPanelView` thêm `approvalNote?`; câu «Trang không gọi dịch vụ danh tính nào khác.» thành «Trang gọi thêm `DocApprovalProposalService.listOwn` khi người xem là điều phối của dự án.»); mục «Việc chưa làm» (bỏ gạch đầu dòng về bước 16b, thay bằng con trỏ sang tệp mới).

- [ ] **Bước 1 — ca kiểm (đỏ).** `tests/doc-approval-ui.test.tsx` (dựng tĩnh và lái thành phần không hook như `drivePanel` của `tests/review-ui.test.tsx`; mọi mã và tên là tổng hợp):
  - **P1 `renders six states with different wording: loading, denied, admin, error, empty and ready`** — câu của `denied`, `admin`, `error`, `empty` khác nhau từng đôi; `loading` có `aria-busy="true"` và không có số 0 giả; `admin` có đúng một liên kết tới `/team`, không `<select`, không `<input`, không nút.
  - **P2 `the denied state has no form, no button and names nobody`** — không `<select`, không `<input`, `buttonsOf` rỗng, không chứa tên nào của `people`.
  - **P3 `OQ-33 the form offers members who read in the project, never the viewer and never a read-only member; a co-manager is offered and flagged`** — danh sách lựa chọn không có `viewerId` (kể cả viết HOA) và người vai `viewer`; có một người vai `manager` khác; chọn người đó thì hiện câu «Người này cũng là điều phối của dự án. Phiếu sẽ nêu rõ điều đó cho người bỏ phiếu.»; chọn một `engineer` thì không.
  - **P4 `types already held are shown ticked and locked, go to expectedTypes and never to docTypes; a proposal needs one new type`** — `approvers` cho người được chọn `['design']`: ô `design` `checked` và `disabled`, nhãn có « — đang giữ»; bấm «Trình phiếu» khi chưa chọn thêm → không gọi `onPropose`, lỗi «Chọn thêm ít nhất một loại tài liệu.»; chọn thêm `plan` → `onPropose` nhận đúng `{userId,docTypes:['plan'],expectedTypes:['design'],reason}`.
  - **P5 `the basis is 5 to 300 characters on one line`** — ô căn cứ là `input type="text"`; 4 điểm mã, 301 điểm mã, chuỗi có `\n` → không gọi `onPropose`, đúng câu lỗi; 300 điểm mã có dấu tiếng Việt → gửi được; dấu cách đầu cuối bị bỏ trong `reason`.
  - **P6 `the request bodies carry only the fields the service takes`** — khoá của `proposeBody` đúng `['docTypes','expectedTypes','projectId','reason','userId']`; của `withdrawBody` đúng `['expectedState','reason']`; không khoá nào là người thực hiện, tenant, quyền hay vai.
  - **P7 `open ballots show one of two states in words and a Rút phiếu button; a withdrawal needs a basis and sends the state it saw`** — hai phiếu `pending` và `approved`: hai câu trạng thái đúng chữ; «Rút phiếu» mở ô căn cứ; căn cứ 4 ký tự → không gọi `onWithdraw`, lỗi «Căn cứ cần từ 5 đến 500 ký tự.»; hợp lệ → `onWithdraw` nhận `{approvalId,expectedState:'approved',reason}` của đúng dòng đó; «Hủy» đóng ô.
  - **P8 `each refusal has its sentence, the draft survives every error, and a reload is offered where the list is stale`** — `proposalFailure` cho từng mã ở mục trên: câu và `reloadable` đúng; `ApiError` mã lạ → câu của máy chủ dạng chuỗi; `TypeError` → `NETWORK_COPY`; một đối tượng thường → `GENERIC_COPY`; dựng khối với `error` và nháp đang gõ → căn cứ đang gõ vẫn nằm trong markup.
  - **P9 `no control in the panel grants anything by itself`** — `buttonsOf` của trạng thái `ready` chỉ gồm «Trình phiếu» và «Rút phiếu» (cùng «Xác nhận rút», «Hủy» khi ô rút mở); không nút nào mang chữ «Lưu», «Cấp», «Áp», «Chấp thuận»; không phần tử nào có `value` bắt đầu bằng `doc_approve:`; câu «Phiếu cần một thành viên BoM đồng ý. Quyền chỉ có hiệu lực sau khi quản trị tài khoản áp.» có mặt.
  - **P10 `text written by people is rendered as text inside bdi`** — tên người chứa `<b>` và căn cứ đang gõ chứa `<script>`: markup có dạng đã escape; tên nằm trong phần tử có `dir="auto"`.
  - **P11 `the queue screen shows the panel only when it is handed proposals, and nothing else changes without them`** — `ReviewQueue` không có `proposals`: markup không chứa «Trình phiếu» và chứa nguyên câu `APPROVAL_NOTE_COPY`; có `proposals={{state:'ready',items:[]}}`: có khối, câu ghi chú là `APPROVAL_NOTE_WITH_PROPOSALS_COPY`; có `proposals={{state:'denied'}}`: có câu của `denied`, không biểu mẫu trình phiếu; có `proposals={{state:'admin'}}`: có câu của `admin` và liên kết `/team`, không biểu mẫu.
  - **P12 `loadOwnProposals: the account admin and a non-coordinator are answered without a read; a scope or manager refusal is denied; any other failure is the error state, never a throw`** — `read` là hàm đếm số lần gọi; `{coordinator:true,accountAdmin:true}` → `{state:'admin'}`, 0 lần gọi; `{coordinator:false,accountAdmin:false}` → `{state:'denied'}`, 0 lần gọi; `AppError('SCOPE_DENIED',…,404)` và `AppError('MANAGER_REQUIRED',…,403)` → `{state:'denied'}`; `AppError('IDENTITY_UNAVAILABLE',…,503)`, `new Error('connection terminated')`, `'text'` → `{state:'error'}`; thành công → `{state:'ready',items}`.
  - **P13 `the panel uses existing review classes only`** — đọc `src/components/doc-approval-proposals.tsx`: mọi token trong các `className="…"` thuộc danh sách lớp nêu ở mục trên; tệp không chứa `style=` và không chứa `dangerouslySetInnerHTML`; `git diff --stat 0560a4f -- src/app/globals.css` rỗng (khẳng định ở bước kiểm giới hạn).
  - **P14 `the review page hands the panel data only`** — tệp `src/app/review/page.tsx` chứa `loadOwnProposals(` và `listOwn(`; không chứa `.catch(`; `tests/rsc-boundary.test.ts` xanh.
- [ ] **Bước 2 — chạy thấy đỏ**; lưu `task-4-red.txt`.
- [ ] **Bước 3 — viết mã và hai tệp đặc tả.**
- [ ] **Bước 4 — chạy xanh.** `npx vitest run tests/doc-approval-ui.test.tsx tests/review-ui.test.tsx tests/review-page.test.ts tests/rsc-boundary.test.ts tests/doc-approver-ui.test.tsx tests/inbox-ui.test.tsx tests/documents-ui.test.tsx`; `npm run typecheck`; `rm -rf .next && npm run build` — danh sách tuyến có `/review` và `/api/team/doc-approvals/[[...path]]`. Lưu `task-4-green.txt`.
- [ ] **Bước 5 — kiểm giới hạn.** `git diff --stat 0560a4f -- tests/review-ui.test.tsx tests/review-page.test.ts src/app/globals.css` rỗng (ba tệp này không đổi). Kiểm tay 360×740 và 1280×800 do phiên làm theo mục «Kiểm tay» của đặc tả; builder không tự đánh dấu.

**Điểm commit** (phiên làm): `feat(review): the coordinator's proposal panel on the Review screen, with its handoff spec (step 16b)`.

**Con trỏ:** `src/components/review.tsx` (`ReviewersPanelView`, `ReviewersPanel`, `ReviewQueue`) · `src/components/review-view.ts` (`selectableMembers`, `sameId`, `docTypeLabel`, `DOC_TYPES`, `describeError`, `NETWORK_COPY`, `GENERIC_COPY`, `APPROVAL_NOTE_COPY`) · `src/components/inbox-view.ts` (`formatTime`) · `src/components/grant-labels.ts` (`roleLabel`) · `src/server/review-page.ts` · `tests/review-ui.test.tsx` (`hosts`, `textOf`, `buttonsOf`, `drivePanel` — chép cách lái, không sửa tệp đó) · `docs/UI-HANDOFF-3-review.md` · `docs/DESIGN-SYSTEM-PM-DOCUMENTS.md:23`, `:62-66`, `:90-103`.

### Task 5: Kiểm toàn bộ — không review riêng

**Tệp:** không tệp mã nào. Builder ghi các log vào `docs/reviews/task-7c-evidence-20261116/`.

Số gốc tại `08322d3`: PGlite 973 đạt + 41 bỏ qua; PostgreSQL thật 1.014 đạt.

- [ ] `npm run test` (PGlite) — 0 đỏ; số đạt ≥ 973; số bỏ qua = 41 + số ca nằm trong hai tệp `*-concurrency.test.ts` mới (ghi con số vào log). Lưu `task-5-pglite.txt`.
- [ ] `set -a; . "$TASK7C_ENV_FILE"; set +a; npx vitest run --reporter=verbose` — 0 đỏ, 0 bỏ qua; số đạt = số đạt cộng số bỏ qua của lần chạy PGlite; không dòng nào chứa `40P01`. Lưu log đã che URL vào `task-5-native.txt`.
- [ ] `npx vitest run --coverage` — ngưỡng 60 đạt với hai tệp mới trong danh sách.
- [ ] `python3 -m pytest tests/test_bot_bridge.py -q` — xanh (mã plugin không đổi).
- [ ] Xoá `.next/types/* 2.ts` nếu có, rồi `npm run typecheck`. `rm -rf .next && npm run build` — có `/api/team/doc-approvals/[[...path]]`, `/review`, `/team`, `/approvals`.
- [ ] `git diff --stat 0560a4f -- src/server/account-approval.ts bot-plugin AGENTS.md CLAUDE.md` rỗng.
- [ ] `git diff --name-only 0560a4f -- migrations` không ra dòng nào (không migration; lát 4 vẫn bắt đầu từ 022, không phải dời số).
- [ ] `git diff --stat 0560a4f -- tests/access-change.test.ts tests/account-approval-dm.test.ts tests/onboarding-feedback.test.ts tests/doc-approver-grant.test.ts tests/doc-approver-flow.test.ts tests/identity.test.ts tests/spec003.test.ts tests/review-ui.test.tsx tests/review-page.test.ts tests/review-http.test.ts tests/rsc-boundary.test.ts tests/test_bot_bridge.py tests/foundation.test.ts tests/spec004.test.ts` rỗng. `git diff 0560a4f -- tests/doc-approver-ui.test.tsx | /usr/bin/grep -c '^-[^-]'` in `0` (chỉ thêm dòng).
- [ ] Thân `proposeAccessChange` không đổi: `git diff 0560a4f -- src/server/accounts.ts` không có dòng `+`/`-` nào nằm giữa dòng `private async proposeAccessChange(` và dấu `}` đóng của nó.
- [ ] Không tệp nào ngoài đường quản trị ghi sổ quyền: `/usr/bin/grep -rnE "(INSERT INTO|UPDATE|DELETE FROM) +identity\.memberships" src` chỉ ra các dòng của `src/server/accounts.ts`.
- [ ] Rò mã nhóm trên phần mã và test PR thêm (không quét `docs/`, nơi chính lệnh này được chép): `git diff 0560a4f -- src tests | /usr/bin/grep -E '^\+' | /usr/bin/grep -E -- '-100[0-9]{7,}' | /usr/bin/grep -vE -- '-100000000000[0-9]([^0-9]|$)'` không ra dòng nào; `git status --short` không có `data/`, `.next/`, tệp env.
- [ ] Bảng dưới được chép vào biên nhận; mỗi hàng phải trỏ tới một ca **đang xanh trên cả hai nền** (ca native ghi «PostgreSQL thật»).

**Bảng ca quyền âm tối thiểu → test**

| Ca | Test | Mức |
|---|---|---|
| Điều phối dự án A trình cho thành viên dự án B | `doc-approval-proposal` «a manager of project A cannot propose for a member of project B»; `doc-approval-proposal-http` «each refusal keeps its status…» | Dịch vụ, HTTP |
| Trình cho người không phải thành viên | `doc-approval-proposal` «a proposal for someone who is not an eligible member is refused with one sentence» | Dịch vụ |
| Trình kèm mở rộng quyền khác ngoài `doc_approve:*` | `doc-approval-proposal` «the command cannot express any other widening, and input edges», «the answer and the list reveal nothing outside the project»; `doc-approval-apply` A2 | Dịch vụ; phòng vệ lúc áp |
| Tự trình cho mình, kể cả mã viết hoa (M1) | `doc-approval-proposal` «a manager cannot propose for themself, in any letter case» | Dịch vụ |
| Gửi lại cùng nội dung không tạo phiếu thứ hai | `doc-approval-proposal` «resending the same proposal creates no second ballot»; `-concurrency` «two identical proposals at once store one ballot» | Dịch vụ; PostgreSQL thật |
| Loại cả người trình lẫn người được cấp mà không còn ghế BoM; lỗi không lộ ai giữ ghế | `doc-approval-proposal` «OQ-35 when removing the proposer's and the subject's seats leaves no BoM seat…», «…the only BoM seat able to vote…», «a subject who holds the only other BoM seat…» | Dịch vụ |
| Người không phải người trình rút phiếu (điều phối khác của dự án, người được cấp, người ngoài dự án) | `doc-approval-withdraw` W3; `doc-approval-proposal-http` «withdraw through the handler…» | Dịch vụ, HTTP |
| Người trình bị hạ vai giữa lúc trình (M3) | `doc-approval-proposal-concurrency` hai ca đầu | PostgreSQL thật |
| Quản trị huỷ: phiên bản tài khoản và phiên đăng nhập của thành viên không đổi | `doc-approval-withdraw` C1 | Dịch vụ |
| Người không phải quản trị gọi lệnh huỷ | `doc-approval-withdraw` C3 | Dịch vụ |
| Người trình mất vai rồi quản trị vẫn áp được, và `/team` có câu nêu rõ (OQ-37 c) | `doc-approval-apply` A3; `doc-approver-ui` U3 | Dịch vụ, giao diện |
| Ghế của người trình không bỏ phiếu cho phiếu mình trình (OQ-35 a) | `doc-approval-proposal` ca 6 | Dịch vụ |
| Phiếu nêu rõ người được cấp cũng là điều phối (OQ-38 c) | `doc-approval-proposal` ca 15; `doc-approver-ui` U8; `doc-approval-ui` P3 | Dịch vụ, giao diện |
| Giữ chỗ OQ-47, OQ-48, OQ-49 | `doc-approval-proposal` ca 27; `doc-approval-withdraw` W8, C2, C4, W4 | **Giữ chỗ fail-closed**, không phải luật đã chốt |
| Tranh chấp không vòng khoá | hai tệp `*-concurrency` | PostgreSQL thật, dữ liệu tổng hợp |

**Điểm commit** (phiên làm): `docs(task-7c): full verification logs and the negative-case table`.

---

## Dừng và chỗ chưa chắc

**Không bước nào «dừng tại OQ-xx».** OQ-47, OQ-48, OQ-49 đều có giữ chỗ fail-closed và không chặn PR.

**Điểm dừng cho builder** (dừng và báo, không tự xử lý): cần sửa `src/server/account-approval.ts`; cần migration; một ca của lát 2 hoặc lát 3 phải sửa kỳ vọng mới xanh; một ca tranh chấp nhận `40P01` mà thứ tự khoá đã đúng như kế hoạch.

**Chỗ chưa chắc — phiên và cổng bảo mật cân:**
1. **Phân tích vòng khoá (T7C-5) là suy luận từ ngữ nghĩa PostgreSQL và từ mã, chưa chạy.** Đặc biệt câu «khoá ngoại của `account_approval_voters` lấy `FOR KEY SHARE` trên dòng quản trị, xung đột với `FOR UPDATE` của `operator`». Phép đột biến (a) ở bước 7 của Task 1 là phép thử: nếu bỏ câu `FOR KEY SHARE` mà ca vẫn xanh thì phân tích sai ở đâu đó và phải xem lại trước khi đi tiếp.
2. **Câu trả lời riêng cho «thiếu người bỏ phiếu khi không tính người trình» (T7C-3 i)** cho một người trình đang giữ ghế BoM biết «không ghế BoM nào khác sẵn sàng». Planner coi đây là hình dạng lỗi, không phải câu hỏi quyền; nếu cổng thấy khác thì gộp vào câu INELIGIBLE (một dòng, một ca).
3. **Quản trị tài khoản bị từ chối trên đường của điều phối (T7C-4)** được xếp là hệ quả kỹ thuật, không mở OQ. Nếu phiên coi đây là câu hỏi quyền thì cần OQ-50; hành vi giữ chỗ không đổi.
4. **«Phiếu đang mở» gồm cả phiếu đã đủ phiếu mà chưa áp (T7C-9):** người trình rút được phiếu sau khi một ghế BoM đã đồng ý. Planner đọc theo chỉ mục mà OQ-36 trỏ; nếu Chairman muốn giới hạn về phiếu chưa ai bỏ phiếu thì là một điều kiện.
5. **OQ-37 (c) không chặn (T7C-11):** tab `/team` cũ không có câu nêu rõ cho tới lần tải lại. Phương án «đòi xác nhận đã thấy» đã nêu, không làm.
6. **Giữ chỗ OQ-49 từ chối một lệnh thu hẹp.** Planner chọn theo nguyên tắc «không có vai thì không ghi»; lăng kính ngược lại (để một đề xuất mở rộng quyền còn mở là kém chặt hơn) cũng có lý — nêu trong OQ-49.
7. **Khoảng chờ 24 giờ (giữ chỗ OQ-47) làm quyền rút kém hữu ích** cho đúng trường hợp «trình nhầm loại cho đúng người»; màn Review có một câu báo trước.
8. **Tin riêng không bị thu lại khi phiếu bị rút hoặc huỷ (T7C-16)**, và **người trình không được báo khi phiếu bị huỷ (T7C-18).** Không sửa được trong giới hạn của PR; ghi vào giới hạn đã biết.
9. **Câu của OQ-38 (c) nằm trong dòng «Căn cứ» in nhạt** của thẻ `/approvals` (T7C-8). Muốn nhấn mạnh hơn thì phải sửa câu đọc phiếu chờ trong `account-approval.ts`.
10. **`tests/doc-approval-proposal.test.ts` có 29 ca;** khoảng chờ 24 giờ theo cặp (giữ chỗ OQ-47) làm một ca không mở được hai phiếu liên tiếp cho cùng cặp: ca nào cần thì dùng thành viên khác, hoặc lùi `created_at` bằng login vận hành như ca 27.
11. **Hai câu `RATE_LIMITED` khác nhau dùng chung một mã;** giao diện in câu của máy chủ nên người dùng vẫn phân biệt được. Câu của trần mỗi giờ là câu có sẵn «Thử lại sau ít phút.», không sát với cửa sổ một giờ; không sửa vì hàm `throttle` dùng chung.

## Tự soát của planner (16/11/2026)

- **Phủ căn cứ:** năm quyết định và quyết định tách PR đều có hàng trong bảng «quyết định → chỗ áp»; M1–M3, S1–S10, T1–T15 đều có hàng; mười một ca quyền âm tối thiểu của phiên đều có hàng ở Task 5.
- **Tên và kiểu nhất quán giữa các task:** `docApprovalDelta`, `activeProjectRole`, `DocApprovalProposalService.{propose,listOwn,withdraw}`, `DocApprovalProposal`, `handleDocApprovalApi`, `cancel_access_change`, `OpenAccessChange`, `OpenBallot`, `ballotCommand`, `ProposalsInitial`, `loadOwnProposals`.
- **Không viết mã sản phẩm:** kế hoạch nêu chữ ký, thứ tự kiểm, câu SQL khoá (vì thứ tự khoá là quyết định), mã lỗi và câu chữ; thân hàm do builder viết.
