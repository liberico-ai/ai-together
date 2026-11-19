# OQ-45 và OQ-46 · Nháp AI: ai đọc nội dung, che lúc đọc, từ chối nháp IBS HI lúc ghi, giữ nháp đã cũ — Kế hoạch triển khai

> **Cho agent thực thi:** làm lần lượt từng task theo `superpowers:subagent-driven-development` (khuyến nghị) hoặc `superpowers:executing-plans`. Các bước dùng ô `- [ ]`. Mỗi task theo nhịp: viết ca kiểm → chạy thấy đỏ đúng lý do → viết mã tối thiểu → chạy xanh. Builder **không** commit, push hay mở PR: phiên chính commit ở «Điểm commit» cuối mỗi task. Kế hoạch **không** gồm cổng Codex, biên nhận, cập nhật roadmap — phiên chính làm. Builder của một task chỉ cần đọc «Global Constraints» và đúng task của mình.

Version 0.4 · 18/11/2026 · **chỉ hồ sơ**, do phiên chính ghi sau sáu lượt review theo task (`docs/reviews/oq-45-46-evidence-20261118/gates/review-task-*.md`) và bốn phép đo trên PostgreSQL 16.15. Ba thứ đổi so với 0.3: (1) guard của migration 022 nay từ chối giao dịch không ở READ COMMITTED bằng SQLSTATE `LTZ02` — khối SQL của tệp thuận ở Task 1 đã được thay bằng đúng nội dung tệp; (2) một đợt sửa thêm ca kiểm và ba sửa nhỏ trong mã; (3) phần dư R20–R29 và bảy điều kiện thêm «trước khi bật Z4». Tất cả nằm ở mục «Sau các lượt review theo task», gần cuối tệp. Không đổi lời Chairman, không đổi phương án nào của OQ-53, OQ-54, OQ-55. Các task và ca kiểm của bản 0.3 giữ nguyên chữ. **Bổ sung cùng ngày sau ba lượt review tầng 1 trên cả nhánh** (mục «Sau ba lượt review tầng 1 trên cả nhánh», ngay sau mục trên): một câu hỏi mở mới OQ-56 (dự án chưa ánh xạ miền), điểm 3 của OQ-53, đợt sửa 2, phần dư R30–R32 và bốn điều kiện thêm; dòng này sửa tại chỗ nên các số dòng của bản 0.4 mà ba báo cáo tầng 1 trích không xê dịch. **Bản 0.5 (18/11/2026; agent `planner`, mô hình Fable 5.2, không lùi mô hình):** thêm mục «Vòng sửa 1 của cổng Codex (bản 0.5)» gần cuối tệp, ngay trước «Tự soát của planner»: thiết kế và task F1–F4 cho bốn finding của cổng Codex vòng 1, hai giữ chỗ mới (`PROJECT_TEXT_HIDDEN` — OQ-55; `SUBJECT_ORDER_UNVERIFIED` — điểm 3 của OQ-53, theo quyết định phạm vi của Chairman, phương án B), phần dư R33–R37 và bốn điều kiện thêm. Không task nào ở trên bị sửa; mười dòng của bản 0.4 được nối một câu ghi chú ở cuối dòng (dòng này và các dòng `:65`, `:195`, `:222`, `:223`, `:224`, `:234`, `:236`, `:251`, `:256`), nên số dòng của bản 0.4 không xê dịch. **Bản 0.6 (cùng ngày; cùng agent và mô hình):** mục «Vòng sửa 1 của cổng Codex (bản 0.5)» bắt đầu ở `:847` — builder của vòng sửa đọc từ đó — và đã được sửa sau cổng bảo mật trên chính thiết kế vòng sửa (`docs/reviews/oq-45-46-evidence-20261118/gates/security-gate-codex-fix-plan.md`, «PLAN NEEDS CHANGES»): trần chờ 5 giây ghim trong hai hàm lấy khoá của 022; giữ chỗ `PROJECT_TEXT_HIDDEN` áp cho cả nháp tài liệu lẫn nháp ứng viên; các ca C1–C9 của cổng; R33, R34, R35 viết lại; điều kiện 22 mới. Thêm ghi chú «Bản 0.6» ở cuối các dòng `:65`, `:195`, `:222`, `:234`, `:236`, `:251`, `:800`; số dòng trước `:847` không xê dịch. **Bản 0.7 (cùng ngày; cùng agent và mô hình):** sau hai lượt review của vòng sửa 1 (CSDL và bảo mật) và phép đo trên PostgreSQL 16.15, khoá của CX4 đổi từ khoá tư vấn sang khoá dòng `FOR NO KEY UPDATE` trên dòng dự án (Task F1b); ca R12-i là ca thứ mười hai đổi kỳ vọng vì CX3. Mục mới «Đợt sửa sau review của vòng sửa 1 (bản 0.7)» bắt đầu ở `:1383`. Không dòng nào trước mục đó bị chèn hay xoá; chữ bị thay giữ làm lịch sử và được gắn nhãn «Bản 0.7» tại chỗ, ở các dòng `:5`, `:223`, `:791`, `:807`, `:849`, `:853`, `:862`, `:872`, `:901`, `:906`, `:945`, `:955`, `:996`, `:1008`, `:1321`, `:1325`, `:1327`, `:1329`, `:1338`, `:1339`, `:1346`, `:1348`, `:1352`, `:1354`, `:1362`, `:1365`, `:1371`. **Bản 0.8 (cùng ngày; cùng agent và mô hình):** hai lượt quét theo lớp trước vòng cuối của cổng Codex tìm ra một P1 mới ở phía xác nhận; nó được sửa thành Task F5 — trigger thứ tư của 022, trên `public.draft_decisions`. Mục mới «Quét lớp lỗi trước vòng 2 của cổng và Task F5 (bản 0.8)» bắt đầu ở `:1696`. Không dòng nào trước mục đó bị chèn hay xoá; chữ bị thay hoặc được bổ sung mang nhãn «Bản 0.8» tại chỗ, ở các dòng `:5`, `:220`, `:221`, `:223`, `:227`, `:233`, `:849`, `:1329`, `:1330`, `:1346`, `:1348`, `:1385`, `:1432`, `:1436`, `:1439`, `:1445`, `:1449`, `:1460`, `:1557`, `:1624`, `:1635`, `:1667`. **Bản 0.9 (cùng ngày; cùng agent và mô hình):** cổng Codex vòng 2 trả `CHANGES_REQUIRED` với một P0 — chính phần dư R3 — và nó được đóng bằng Task G1, vòng sửa 2. Cùng vòng sửa đó, sau lượt xem lại bảo mật của Task G1, Task G2 đóng phần của R15 về các mã tả nội dung. **Đính chính:** chữ «trước vòng cuối của cổng Codex» trong ghi chú «Bản 0.8» ngay trên là sai — brief cho tối đa hai vòng sửa ở cổng, nên vòng 2 không phải lượt cuối; lượt chạy cuối là vòng 3. Mục mới «Vòng 2 của cổng Codex và vòng sửa 2 (bản 0.9)» bắt đầu ở `:1933`. Không dòng nào trước mục đó bị chèn hay xoá; chữ bị thay hoặc được bổ sung mang nhãn «Bản 0.9» tại chỗ, ở các dòng `:5`, `:71`, `:77`, `:159`, `:221`, `:233`, `:264`, `:490`, `:735`, `:849`, `:853`, `:1325`, `:1706`, `:1728`, `:1730`, `:1863`, `:1867`, `:1868`, `:1883`, `:1885`, `:1893`, `:1894`, `:1917`, `:1920`.

Version 0.3 · 18/11/2026 · do agent `planner` sửa (mô hình Fable 5.2, không lùi mô hình) sau **cổng bảo mật lượt 2** trên bản 0.2 — «PLAN NEEDS CHANGES», `docs/reviews/oq-45-46-evidence-20261118/gates/security-gate-plan-round-2.md`: N1 khép một phần, N2 và N3 khép; một mục phải sửa (N4), hai mục nên sửa (cổng-R8, cổng-R9), ba ca còn thiếu (cổng-C11…C13). Theo phán quyết của phiên chính, áp tất cả. Không đổi lời Chairman. **Bản 0.3 so với 0.2:** (1) **N4, cách sửa 2 của cổng** — `sources` là `[]` dưới **mọi** lớp che; cột `sources` không còn được đọc ở câu lệnh nào (bỏ hằng `SOURCE_IDS_SQL` và tham số `maskedSources` của bản 0.2); khi không che, `sources` vẫn là `value.sources`. Chỗ sửa: cách hiểu C9 mới; C1; P5; B2 (kiểu và bảng trường); R15; Review Focus 1; Task 3 (`DRAFT_SQL`, `DRAFT_META_SQL`, `DraftRow`, `toView`, `present`; ca L9); Task 4a (`present`; ca M1 (i), M3, M8); Task 4b (ca Q1); mục 13 của «Dừng và chỗ chưa chắc». (2) **cổng-R8** — câu «luồng có chữ đang ẩn» dùng `(…) IS NOT TRUE`; mã không phải uuid trả `true` (Task 4b; ca Q5, Q8). (3) **cổng-R9** — ngữ cảnh hỗn hợp ứng viên + tài liệu (R16; `docs/OPEN-QUESTIONS.md:904`). (4) Ba ca: cổng-C11 → M8 (viết lại), cổng-C12 → Q8, cổng-C13 → Q9. (5) Một dòng về bản sao của iCloud ở «Global Constraints». Số và thứ tự task không đổi. **Theo báo cáo lượt 2 (dòng `:14` của tệp đó), nếu N4 được sửa đúng như cổng tả thì cổng không cần soát lại kế hoạch lần nữa; phiên chính quyết việc ghi nhận điều đó. Review bảo mật bắt buộc của Task 3, 4a, 4b kiểm trên mã.**

Version 0.2 · 18/11/2026 · do agent `planner` sửa (mô hình Fable 5.2, không lùi mô hình) sau **cổng bảo mật lượt 1** trên bản 0.1 — «PLAN NEEDS CHANGES», `docs/reviews/oq-45-46-evidence-20261118/gates/security-gate-plan-round-1.md` — và theo phán quyết của phiên chính: áp mọi mục của cổng. Không đổi lời Chairman. **Bản 0.2 so với 0.1:** (1) **N1** — người không có quyền quyết định nhận `sources: []`; dưới lớp che, `sources` chỉ còn mã có trong ngữ cảnh dựng lại; `manifestHash` chỉ trả khi là hash của manifest hiện hành (C1, B1, B2, R15; Task 3, Task 4a; ca L1, L3, L4, M8, K2). (2) **N2** — câu hỏi mở mới **OQ-55** và một giữ chỗ fail-closed cho nháp ứng viên, mã lý do riêng `THREAD_TEXT_HIDDEN`, vừa che lúc đọc vừa giữ lúc xác nhận (C2, P3; **Task 4b mới**; ca Q1–Q7; M4 chỉ còn nói về nháp tài liệu). (3) **N3** — `decide` xét quyền trước mọi phép kiểm khác trong thân khoá lệnh (Task 3; ca L8). (4) Bảy mục nên sửa: H1 và G12 (cổng-R1), K3 viết đủ (cổng-R2), trường hiển thị lấy từ giá trị đã qua lược đồ (cổng-R3; ca L7), `tgenabled` và danh sách «trước khi bật Z4» (cổng-R4), câu chữ của R6 và OQ-53 (cổng-R5), mô tả bit của guard (cổng-R6; ca G13), C8 mới và lý do của H4, H5 (cổng-R7). (5) Mười ca còn thiếu: cổng-C1 → L4, C2 → M8, C3 → Q1, C4 → Q2, C5 → L8, C6 → G13, C7 → G14, C8 → G15, C9 → M9, C10 → T8. (6) Task 4 của bản 0.1 nay là Task 4a; số của Task 1–3 và 5–7 không đổi. Ca lùi 022 đổi nhãn từ R22 sang RB1 để không lẫn với phần dư R15–R19. Trong kế hoạch này, mục của cổng luôn được viết «cổng-R…», «cổng-C…»; «C1–C8» là các cách hiểu, «R1–R19» là phần dư của chính kế hoạch. **Số gốc của cả bộ, do phiên chính đo ở `4f12a3c`:** PGlite 1 104 đạt, 62 bỏ qua; PostgreSQL 16 thật 1 166 đạt, 0 bỏ qua.

Version 0.1 · 18/11/2026 · do agent `planner` lập (mô hình Fable 5.2, không lùi mô hình) cho **một PR riêng** vào `libetech-ai-os`. Base ghim `4f12a3c` (đầu `origin/libetech-ai-os`). Nhánh làm việc `feat/oq-45-46-ai-drafts`. Số gốc planner đo ở `4f12a3c`, PGlite, bảy tệp bị chạm: 141 đạt, 6 bỏ qua — `tests/suggestions.test.ts` 46 đạt 1 bỏ qua · `tests/z4-schema.test.ts` 23 đạt 2 bỏ qua · `tests/migrations-rollback.test.ts` 6 · `tests/skill-contracts.test.ts` 36 · `tests/skill-context.test.ts` 20 · `tests/source-text.test.ts` 10 · `tests/suggestions-concurrency.test.ts` 3 bỏ qua (chỉ chạy native).

**Căn cứ mở PR.** Lời Chairman ngày 18/11/2026, chép nguyên từ `docs/OPEN-QUESTIONS.md:855`: «OQ-45: 1b, 2b, 3b. OQ-46: b, mốc là bản mới nhất nháp nêu».

**Mục tiêu:** viết mã cho bốn quyết định đó, tới mức «đã có mã», trên dữ liệu tổng hợp: (1) nội dung một nháp AI chỉ trả cho người có quyền xác nhận nháp đó; (2) mỗi lần đọc, dịch vụ dựng lại ngữ cảnh dưới quyền người đọc và che nội dung khi nháp trích tin người đó không đọc được chữ hoặc dự án đang chỉ con trỏ; (3) nháp của dự án `IBS_HI` bị từ chối ngay lúc ghi, ở tầng CSDL; (4) lúc xác nhận, nháp bị giữ khi đối tượng của chính nó đã có thứ mới hơn bản mới nhất nháp nêu. **Z4 chưa bật và vẫn chưa bật sau PR này.**

**Kiến trúc:** bốn chỗ đổi, không mô-đun mới. (a) Migration 022 thêm **một** hàm trigger `SECURITY DEFINER` và **một** trigger `BEFORE INSERT` trên `intelligence.ai_drafts`; role `libetech_ai` không được cấp thêm quyền nào. (b) `src/server/suggestions.ts`: mọi `DraftView` rời dịch vụ đi qua một hàm `present` (luật quyền + luật hiển thị); `submitDraft` dịch đúng một SQLSTATE thành một `AppError`; `decide` xét quyền trước mọi phép kiểm khác và bước giữ của nó thêm phép kiểm «đối tượng đã đổi». (c) Ba hàm phụ: `namedIds` (thuần, `src/server/skill-contracts.ts`), `threadHasHiddenText` và `threadFreshness` (`src/server/source-text.ts`, nơi duy nhất ngoài đường nhận tin được nêu bảng bản sửa của tin). (d) Ba giữ chỗ fail-closed có số câu hỏi mở (OQ-53 hai điểm, OQ-55). Không tuyến HTTP, không giao diện.

**Công nghệ:** TypeScript, PostgreSQL SQL, `pg.Pool`, PGlite, zod, vitest. Không thêm dependency. Một migration (022) kèm tệp lùi.

**Căn cứ (đọc cùng kế hoạch):**
- `docs/OPEN-QUESTIONS.md`: OQ-45 (`:661-671`), OQ-46 (`:677-687`), khối quyết định ngày 18/11/2026 (`:855-866`); ba câu hỏi PR này mở: OQ-53 (`:872-882`), OQ-54 (`:884-893`), OQ-55 (`:899-908`); nền: OQ-14, OQ-28, OQ-30.
- `docs/reviews/oq-45-46-evidence-20261118/gates/security-gate-plan-round-1.md` — cổng bảo mật lượt 1 trên bản 0.1, «PLAN NEEDS CHANGES»: N1–N3, cổng-R1…R7, cổng-C1…C10. Tệp đó trích số dòng của bản 0.1.
- `docs/reviews/oq-45-46-evidence-20261118/gates/security-gate-plan-round-2.md` — cổng bảo mật lượt 2 trên bản 0.2, «PLAN NEEDS CHANGES»: N4, cổng-R8, cổng-R9, cổng-C11…C13; N2 và N3 đã khép, N1 khép một phần. Tệp đó trích số dòng của bản 0.2, và nêu 782 tệp bản sao « 2» chưa theo dõi trong worktree (việc gỡ là của phiên chính).
- `docs/DELIVERY-012-review-skills-20261115.md`: khoảng trống 3, 4, 7, 8, 10 (`:141-148`), 41, 42 (`:189-190`); «Câu hỏi mở chưa quyết» (`:215-219`).
- `docs/plans/slice-3-review-skills.md`: Task 8 (`:874-915`), Task 10 (`:975-1006`), Task 12 (`:1046-1095`); phán quyết S11 (`:142`), S15 (`:146`), S24 (`:155`), S53 (`:187`).
- Mã đã đọc tại base: `src/server/suggestions.ts`, `skill-context.ts`, `skill-contracts.ts`, `ai-scope.ts`, `source-text.ts`, `documents.ts`, `document-commands.ts`, `intake.ts`, `db.ts`; `migrations/013`, `016`, `017`, `019`, `021` và `migrations/rollback/021`; `tests/suggestions.test.ts`, `suggestions-concurrency.test.ts`, `z4-schema.test.ts`, `migrations-rollback.test.ts`, `rls-catalog.test.ts`, `fix-wave-db.test.ts`, `source-text.test.ts`, `slice1-db.ts`, `slice2-fixtures.ts`, `slice3-fixtures.ts`.
- `AGENTS.md` · skill `liberico-coding-rules` (Z1–Z4, AR-03, E-AI-04, E-DB-04, E-SEC-02, Quality Gate 34a–e, M-01…M-03).

## Quyết định của Chairman phải áp

Khối dưới đây **chép nguyên** `docs/OPEN-QUESTIONS.md:855-866`. Lời của Chairman là câu trong «…» ở dòng đầu; các dòng đối chiếu trích chữ của mục OQ-45 và OQ-46; bốn ghi chú cuối là của phiên điều phối. Không câu nào trong khối này do `planner` viết lại.

> **Quyết định của Chairman ngày 18/11/2026 về OQ-45 và OQ-46 (Chairman gõ ở phiên điều phối; phiên điều phối chép lời):** «OQ-45: 1b, 2b, 3b. OQ-46: b, mốc là bản mới nhất nháp nêu». Khối này đặt ở cuối tệp để các số dòng đã được trích ở tài liệu khác không xê dịch; nó thuộc về OQ-45 và OQ-46.
> - Chairman không chọn qua hộp chọn: phiên điều phối chưa trình hai mục này thành hộp chọn. Chairman gõ nhãn phương án theo chữ của hai mục. Phần dưới đối chiếu từng nhãn với chữ của mục; chữ trong «» chép từ mục OQ-45 và OQ-46 ở trên, không phải lời Chairman.
> - OQ-45, điểm 1 (ai xem `value`): **(b)** — «chỉ người có quyền xác nhận nháp đó (vai ghi sổ tài liệu với nháp tài liệu, điều phối dự án với nháp ứng viên)».
> - OQ-45, điểm 2 (xét lại lúc đọc): **(b)** — «lúc đọc dựng lại ngữ cảnh dưới quyền người đọc và che `value` khi nháp trích tin người đó không đọc được chữ hoặc dự án đang chỉ con trỏ, chỉ trả mã và lý do giữ».
> - OQ-45, điểm 3 (nháp của dự án `IBS_HI`): **(b)** — «từ chối ngay lúc ghi (cần cấp cho role AI quyền đọc hẹp cờ «chỉ con trỏ», hoặc một thiết kế khác)».
> - OQ-46: **(b)** — «Giữ nháp khi **đối tượng của chính nó** đã đổi: tài liệu có bản mới hơn sau lúc nháp được ghi; luồng của ứng viên có tin hoặc bản sửa mới sau lúc đó. Phải định nghĩa «sau» theo mốc nào (thời điểm ghi, hay bản mới nhất mà nháp nêu).» Mốc Chairman chọn, theo lời Chairman: «mốc là bản mới nhất nháp nêu».
> - Trạng thái mã lúc ghi (`4e0516e`): chưa có mã cho quyết định nào ở trên. Hành vi vẫn là (a) ở cả ba điểm của OQ-45 và trùng (a) của OQ-46. Không tuyến HTTP nào gọi `SuggestionService.list`; ca kiểm «no route imports the suggestion service» vẫn giữ; Z4 chưa bật.
> - Ghi chú của phiên điều phối kèm quyết định (không phải lời Chairman):
>   1. Điểm 3 (b) để ngỏ cách làm: «cần cấp cho role AI quyền đọc hẹp cờ «chỉ con trỏ», hoặc một thiết kế khác». Chairman không chọn cách làm. Planner đề xuất và cổng bảo mật soát kế hoạch trước khi viết mã. Nếu phải đổi quyền của role `libetech_ai` thì cần migration mới (số kế tiếp là 022) kèm tệp rollback.
>   2. Mốc của OQ-46 là bản mới nhất nháp nêu. Phương án (b) nói cả «tài liệu có bản mới hơn» lẫn «luồng của ứng viên có tin hoặc bản sửa mới». Cách áp mốc này cho luồng tin của nháp ứng viên phải được planner viết rõ trong kế hoạch, và ghi thành câu hỏi mở nếu chữ của Chairman không đủ để quyết.
>   3. Hai mục không còn «chưa quyết», nhưng việc bật Z4 **vẫn dừng**. Trước đó cần: mã của các quyết định trên qua đủ cổng; thiết kế và migration cho một login AI (`docs/DELIVERY-012-review-skills-20261115.md`, khoảng trống 7); bảng phân loại dữ liệu → mô hình được Chairman duyệt (OQ-14); và lời Chairman cho chính việc bật Z4.
>   4. Quyết định ở điểm 3 chặt hơn hành vi hiện tại và cùng hướng với `AGENTS.md:16` («IBS HI: pointers, hashes and Tech work metadata only.»). Khối này không sửa `AGENTS.md`.

## Bảng: quyết định → chỗ áp trong kế hoạch

| Quyết định | Chỗ áp | Ca ghim |
|---|---|---|
| OQ-45 điểm 1 (b) — `value` chỉ cho người có quyền xác nhận | Task 3: `mayDecide`, `present`, câu lệnh không lấy cột nội dung, thứ tự kiểm của `decide` | L1–L9 |
| OQ-45 điểm 2 (b) — xét lại lúc đọc, che, «chỉ trả mã và lý do giữ» | Task 4a: `contextFor`, tập lý do hiển thị; `sources` rỗng dưới mọi lớp che | M1–M9 |
| OQ-45 điểm 3 (b) — nháp `IBS_HI` bị từ chối lúc ghi | Task 1 (migration 022), Task 2 (`POINTER_ONLY_PROJECT`) | G1–G15, RB1, S1–S4 |
| OQ-46 (b), mốc «bản mới nhất nháp nêu» — tài liệu | Task 5: `subjectReasons` nhánh tài liệu | D1–D6 |
| OQ-46 (b), mốc «bản mới nhất nháp nêu» — luồng tin («tin mới») | Task 6: `threadFreshness`, `subjectReasons` nhánh ứng viên | T1, T2, T5–T8 |
| Phần lời Chairman chưa phủ | Task 4b (**dừng tại OQ-55**), Task 5 và 6 (**dừng tại OQ-53**): giữ chỗ fail-closed | Q1–Q7; D3, T3, T4 |

## Điểm lời Chairman chưa phủ → câu hỏi mở và hành vi trong PR

| Câu hỏi | Hành vi trong PR | Chỗ đặt | Đổi khi có quyết định |
|---|---|---|---|
| **OQ-53 điểm 1** (`docs/OPEN-QUESTIONS.md:878`) — «bản sửa mới» của một tin: nháp chỉ nêu mã tin, không nêu bản của tin, nên mốc Chairman chọn không so được | **Dừng tại OQ-53. Giữ chỗ fail-closed, không phải phương án được chọn:** nháp ứng viên bị giữ (`SUBJECT_EDIT_UNVERIFIED`) khi luồng có một bản sửa được ghi từ lúc tin mới nhất nháp nêu được ghi trở đi. Cái giá, nêu để Chairman biết: ở luồng mà sự kiện ghi sau cùng là một bản sửa, không nháp nào xác nhận được cho tới khi có tin mới và nháp mới, kể cả khi nháp đã đọc đúng bản sửa ấy. Chọn hướng này thay vì «không viết mã» vì phương án (b) của OQ-46 nêu đích danh «bản sửa mới»: để trống là để một nửa quyết định không có mã | Task 6, ca T3 | Bỏ hoặc thay một nhánh của `subjectReasons`; phương án 1 (b) cần PR hợp đồng riêng |
| **OQ-53 điểm 2** (`:879`) — nháp không nêu bản nào của tài liệu của nó, hoặc không nêu tin nào của luồng của nó: không có mốc | **Dừng tại OQ-53. Giữ chỗ fail-closed:** bị giữ (`SUBJECT_BASELINE_MISSING`) khi tài liệu đã có ít nhất một bản; luồng thì luôn có tin nên luôn bị giữ. Tài liệu chưa có bản nào thì không có gì «mới hơn»: không giữ. Chọn hướng này vì nếu không kiểm, một nháp tránh được cả quyết định OQ-46 chỉ bằng cách không nêu bản | Task 5 ca D3; Task 6 ca T4 | Một nhánh điều kiện |
| **OQ-54** (`:884-893`) — nội dung nháp đã lưu **trước** khi dự án thành `IBS_HI` có được nằm lại trong Z4 không | **Không viết mã; hành vi cũ giữ nguyên:** dòng nằm lại (bảng bất biến); dịch vụ không trả nội dung (điểm 2) và không cho xác nhận (cổng có sẵn). Không chọn hướng chặt hơn vì hướng đó phải phá luật bất biến của bảng bằng một migration và một đường ghi mới — là một thiết kế, không phải một giữ chỗ | — | Theo quyết định |
| **OQ-55** (`:899-908`; từ N2 của cổng) — nháp mang chữ của tin mà không nêu mã tin | **Dừng tại OQ-55. Giữ chỗ fail-closed, không phải phương án được chọn** (phán quyết của phiên chính sau cổng lượt 1): nháp **ứng viên** bị che (`THREAD_TEXT_HIDDEN`), và không xác nhận được, khi luồng của nó có ít nhất một bản của tin đã lưu chữ mà cấu hình hiện tại không cho hiện — xét mọi bản của mọi tin trong luồng, không theo trần 20 tin, không chỉ bản mới nhất. Với nháp **tài liệu**: **không viết mã**, và đó **không phải hướng chặt nhất** — nháp tài liệu có thể mang chữ của tin mà không phép kiểm nào thấy (R16) | Task 4b, ca Q1–Q7 | Một nhánh ở bước che và một nhánh ở bước giữ. **Bản 0.5:** nháp tài liệu nay có giữ chỗ riêng — `PROJECT_TEXT_HIDDEN`, trùng phần nháp tài liệu của (e); Task F2 của mục «Vòng sửa 1 của cổng Codex»; câu «không viết mã» ở cột thứ hai tả bản 0.4. **Bản 0.6:** giữ chỗ `PROJECT_TEXT_HIDDEN` áp cho **cả hai loại nháp** (cổng bảo mật trên thiết kế vòng sửa, mục N2) — rộng hơn chữ của (e) |

## Cách hiểu chờ Chairman xác nhận (không phải lời Chairman; C1–C7 và C9 theo hướng chặt, do chữ của quyết định kéo theo; C8 là đọc đúng chữ và **không** phải hướng chặt nhất)

- **C1 · «`value`» gồm mọi bản chép và mọi trường do bên ghi chọn.** Cột `questions` là bản chép của `value.questions`; `sources` là bản chép của `value.sources` và hợp đồng cho `id` là chuỗi bất kỳ; `confidence` do mô hình viết; `skill_version`, `model_version` là chữ tự do tới 64 ký tự; `manifest_hash` là 32 byte tuỳ ý với một dòng chèn thô. Người **không có quyền quyết định** không nhận trường nào trong số đó: nội dung là `null`, `sources` là `[]`, `valueHash` là `null`, `manifestHash` chỉ được trả khi bằng hash của manifest hiện hành (một hằng của máy chủ). Một mã đúng dạng uuid vẫn là 16 byte do bên ghi chọn: «đúng dạng» không có nghĩa «không mang thông tin» (N1 của cổng). Nếu chỉ rút `value` thì `questions` và `sources` thành đường rò thứ hai — đúng điều OQ-45 nêu ở Phía B. Người có quyền quyết định nhưng bị che cũng nhận `sources: []` (C9).
- **C2 · «nháp trích tin người đó không đọc được chữ» gồm cả trường hợp không chứng minh được là đọc được:** nháp nêu một mã không có trong ngữ cảnh dựng lại cho người đọc (`SOURCE_OUT_OF_CONTEXT`), đối tượng của nháp không còn trong dự án hoặc cặp kỹ năng–đối tượng không dựng được ngữ cảnh (`ENTITY_NOT_FOUND`), giá trị đã lưu không còn khớp hợp đồng nên không liệt kê được mã nó nêu (`SCHEMA_INVALID`). Chữ của quyết định chỉ nêu hai lý do; ba lý do thêm là «không chứng minh được thì che». Nội dung **không khai nguồn** là thứ khó chứng minh nhất: với nháp ứng viên nó được xử lý bằng giữ chỗ của OQ-55 (`THREAD_TEXT_HIDDEN`); với nháp tài liệu không có phép kiểm nào (R16). Các lý do **không** nói về điều người đọc được đọc (manifest cũ, hash lệch, bản chưa chuẩn, xin công cụ; và, với nháp tài liệu, thiếu nguồn và nhận định không nguồn) **không** che.
- **C3 · Câu trả lời của lệnh quyết định cũng là một lần đọc.** `decide` trả `DraftView`; nó đi qua cùng luật: người vừa từ chối một nháp mà mình không đọc được chữ nguồn nhận quyết định đã ghi, không nhận nội dung; người gửi lại lệnh sau khi mất quyền quyết định, hoặc sau khi dự án thành chỉ con trỏ, cũng vậy. Và lệnh quyết định không được làm lộ điều mà `list` đã rút: người không có quyền quyết định nhận cùng một câu từ chối, bất kể `valueHash` gửi lên đúng hay sai và nháp đã có quyết định hay chưa (N3 của cổng). **Bản 0.9 (Task G1, sau cổng Codex vòng 2; vẫn là cách hiểu chờ Chairman xác nhận):** một nháp đang bị che với người quyết định được từ chối **không cần `valueHash`**: người đó không được cho thấy hash nào, nên `decide` không so hash cho họ, dù họ gửi gì. Cách hiểu khác, chặt hơn, không được chọn ở đây: một nháp bị che không quyết định được gì cả — không xác nhận, không từ chối — cho tới khi nội dung của nó được hiện lại (mục «Vòng 2 của cổng Codex và vòng sửa 2 (bản 0.9)», 09.7).
- **C4 · «từ chối ngay lúc ghi» áp cho mọi lần thử ghi và mọi role ghi:** kể cả gửi lại một khoá khử trùng của nháp đã lưu trước khi dự án thành `IBS_HI` (câu trả lời là từ chối, không phải «đã có»), và kể cả login vận hành chèn thô.
- **C5 · Với luồng tin, «bản mới nhất nháp nêu» đọc là tin được ghi sau cùng trong các tin của chính luồng mà nháp nêu;** «tin mới» là tin của luồng mà nháp không nêu, được ghi từ thời điểm đó trở đi. «Được ghi» tính theo đồng hồ CSDL (`source_events.created_at`, cột mặc định `now()` mà role nhận tin không đặt được), không theo `observed_at` do gateway khai: một tin đến muộn từ hàng chờ có `observed_at` cũ vẫn là tin mới của luồng, và một `observed_at` sai về tương lai không được làm tê liệt phép kiểm.
- **C6 · Mốc tính trên mọi trường mã của đầu ra** (bảng `ID_FIELDS`, không chỉ `sources`), chỉ các mã thuộc chính tài liệu hoặc chính luồng của nháp; mã không phải uuid chữ thường không tính là đã nêu. Mốc là thứ nháp **nêu**, không phải thứ nháp đã đọc: đó là hệ quả của mốc Chairman chọn.
- **C7 · «tài liệu có bản mới hơn» tính theo số bản (`revision_no`) cao nhất của tài liệu, kể cả bản chưa được duyệt.** Hệ quả: nháp `release_librarian` (ngữ cảnh chỉ có bản chuẩn) không xác nhận được khi tài liệu đang có một bản trình mới hơn bản chuẩn; và nói chung nháp phải nêu đúng bản mới nhất (hoặc tin mới nhất) thì mới xác nhận được.
- **C8 · Vai đọc S11 không có quyền xác nhận vẫn thấy dòng nháp** (mã dòng, kỹ năng, thời điểm, quyết định đã ghi, và số dòng). Đây là đọc **đúng chữ** của điểm 1 («Ai xem `value`»): quyết định rút nội dung, không rút sự tồn tại của nháp. **Không phải hướng chặt nhất:** hướng chặt hơn là không liệt kê dòng cho họ. Planner không tự chọn hướng đó vì nó rút thêm một thứ quyết định không nói tới. Những gì bên ghi còn chọn được trong phần họ thấy: số dòng, thứ tự, kỹ năng của từng dòng, và việc `manifestHash` có khớp hay không (R15).
- **C9 · «chỉ trả mã và lý do giữ» đọc là: mã của chính dòng nháp (cùng mã dự án và mã đối tượng mà người đọc đã nêu) và các mã lý do; không gồm danh sách nguồn.** Dưới **mọi** lớp che — người không có quyền quyết định, và người có quyền nhưng bị che — `sources` là `[]`. Hướng chặt: danh sách nguồn do bên ghi chọn (tới 100 phần tử, lặp và xếp thứ tự tuỳ ý), và không gì trong PR này dùng nó khi nội dung bị che (N4 của cổng lượt 2; phán quyết của phiên chính). Khi nội dung được trả, `sources` là `value.sources` đã qua lược đồ và qua cổng. Hệ quả: người có quyền quyết định nhìn một nháp bị che chỉ thấy mã lý do, không thấy nháp nêu nguồn nào. **Bản 0.9 (sau cổng Codex vòng 2; vẫn là cách hiểu chờ Chairman xác nhận):** «chỉ trả mã và lý do giữ» nay còn đọc là **không trả hash của nội dung dưới bất kỳ lớp che nào**: `valueHash` rỗng trên mọi dòng bị che, không chỉ với người không có quyền quyết định (Task G1). Và trên một nháp bị che, «lý do giữ» mà câu giữ của lệnh xác nhận nêu là **các mã che** — đúng thứ một lần đọc nêu — cộng giữ chỗ `SUBJECT_ORDER_UNVERIFIED` với nháp ứng viên; các mã khác của cổng không được nêu (Task G2). Cách hiểu khác của câu sau, không được chọn ở đây: nêu mọi mã của một lần giữ, như trước Task G2 (mục «Vòng 2 của cổng Codex và vòng sửa 2 (bản 0.9)», 09.7).

## Phán quyết kỹ thuật của planner (không phải quyết định của Chairman; cổng bảo mật soát)

- **P1 · Điểm 3 làm bằng trigger `BEFORE INSERT` với hàm `SECURITY DEFINER`** (so sánh ở «Thiết kế bảo mật», mục B4). Hàm do login migration (superuser) sở hữu, ghim `search_path = pg_catalog, pg_temp` và `row_security = off`; `EXECUTE` thu hồi khỏi `PUBLIC`, không cấp cho ai. Cổng lượt 1 đồng ý chủ hàm là superuser.
- **P2 · SQLSTATE `LTZ01`** (tiền lệ `LTR01`–`LTR03` của migration 020). Dịch vụ trả `AppError('POINTER_ONLY_PROJECT', 'Dự án này chỉ nhận con trỏ nên nháp AI không được lưu.', 422)`. Mọi lỗi CSDL khác đi qua nguyên như hôm nay.
- **P3 · Bất biến: điều bị che lúc đọc luôn bị giữ lúc xác nhận, với cùng mã.** Lúc đọc dùng lại `checkSkillOutput`, chỉ giữ ba mã về hiển thị (`SCHEMA_INVALID`, `SOURCE_OUT_OF_CONTEXT`, `TEXT_NOT_VISIBLE`), cộng `POINTER_ONLY_PROJECT` và `ENTITY_NOT_FOUND` của dịch vụ: cả năm đã là lý do giữ của `decide`. Mã mới `THREAD_TEXT_HIDDEN` **cũng được thêm vào tập lý do giữ** của `decide` cho nháp ứng viên. Lý do: nếu không thêm, bất biến này chỉ đứng nhờ giữ chỗ của OQ-53 điểm 2 (nháp không nêu tin nào thì bị giữ), mà giữ chỗ đó có thể được quyết khác; và một người không được phép xác nhận thứ mình không được đọc. So với trạng thái sau Task 6, thêm vào không giữ thêm nháp nào: chữ của tin hiện hay ẩn theo nhóm và dự án, nên khi luồng có chữ đang ẩn thì không tin nào của luồng hiện chữ — nháp nêu tin đã bị giữ `TEXT_NOT_VISIBLE`, nháp không nêu tin đã bị giữ `SUBJECT_BASELINE_MISSING`. Cái nó thêm là: bất biến không còn phụ thuộc giữ chỗ của OQ-53. Ca ghim: Q3.
- **P4 · Ngữ cảnh dựng một lần cho mỗi kỹ năng trong một lần gọi** (danh sách lọc theo một đối tượng, nên ngữ cảnh chỉ khác theo kỹ năng: tối đa sáu lần dựng cho tối đa 200 dòng), cộng một câu đọc «luồng có chữ đang ẩn» cho mỗi lần gọi trên nháp ứng viên; không dựng và không đọc gì cho người không có quyền quyết định. Lỗi không phải `SCOPE_DENIED` hay `INVALID_INPUT` thì lan ra: cả lần đọc thất bại, không trả gì.
- **P5 · Ở `list`, với người không có quyền quyết định, câu lệnh đọc không lấy cột nội dung nào, không lấy mã nguồn nào, và so `manifest_hash` với hằng ngay trong SQL:** không gì do bên ghi chọn (ngoài kỹ năng) tới tiến trình Node. Với người có quyền, dịch vụ phải đọc `value` để xét mã nó nêu, rồi bỏ đi nếu che. Cột `sources` không được đọc ở câu lệnh nào: khi không che, `sources` lấy từ `value`; khi che, nó là `[]`. Ở `decide`, dòng nháp được đọc đủ trước khi xét quyền (lệnh cần `value_hash`, và `value` cho bước giữ); câu trả lời được che trong mã.
- **P6 · Mã lý do mới:** lúc đọc `CONFIRM_AUTHORITY_REQUIRED`, `THREAD_TEXT_HIDDEN`; lúc xác nhận `THREAD_TEXT_HIDDEN`, `SUBJECT_CHANGED`, `SUBJECT_BASELINE_MISSING`, `SUBJECT_EDIT_UNVERIFIED`. Ba mã giữ chỗ (`THREAD_TEXT_HIDDEN`, hai mã `SUBJECT_…` sau) tách riêng để phần chờ OQ-53 và OQ-55 đổi được mà không đụng phần Chairman đã quyết.
- **P7 · Khoá:** phép kiểm của nháp tài liệu chạy dưới khoá dòng tài liệu mà `decide` đã lấy (`src/server/suggestions.ts:151`); mọi đường thêm bản của `DocumentService` lấy cùng khoá. Phép kiểm của nháp ứng viên không lấy khoá nào: đường nhận tin không khoá dòng ứng viên, nên một khoá ở đây không xếp hàng được với nó (phần dư R6).
- **P8 · So thời điểm bằng `>=`** cho thứ nháp không nêu: hai dòng trùng thời điểm thì giữ (hướng chặt; PGlite chỉ có độ phân giải mili giây).
- **P9 · `list` không báo «nháp đã cũ».** Chữ của quyết định OQ-46 chỉ nói lúc xác nhận; ngoài phạm vi.
- **P10 · Không mô-đun mới,** nên `vitest.config.ts` (`coverage.include`) không đổi.
- **P11 · Thứ tự task: 1 → 2 → 3 → 4a → 4b → 5 → 6 → 7, nối tiếp.** Task 2–6 đều sửa `src/server/suggestions.ts`: không chạy song song.
- **P12 · Khi nội dung được trả, mọi trường hiển thị lấy từ một nguồn:** giá trị `value` đã qua lược đồ của kỹ năng (`sources`, `questions`, `confidence` là của `value`, không đọc cột riêng — cổng-R3). `skillVersion` chỉ trả khi bằng phiên bản của manifest hiện hành. `modelVersion` là chữ pipeline tự khai, không có tập đóng nào để so (chưa có bảng mô hình được duyệt — OQ-14): chỉ trả khi nội dung được trả, tức cho người đã nhận cả `value`; phần dư R17.

## Bảng: mục cổng bảo mật lượt 1 → chỗ áp

| Mục | Áp ở |
|---|---|
| **N1** — `sources`, `manifestHash` mang bit do bên ghi chọn | C1, B1, B2 (bảng trường), R15; Task 3 (`DRAFT_META_SQL`, `toView`); Task 4a; ca L1, L3, L4, M1, M8; K2. Phần «dưới lớp che» của bản 0.2 (mã có trong ngữ cảnh) được thay ở bản 0.3 bằng `[]` (N4, bảng dưới) |
| **N2** — nháp ứng viên chép chữ của tin mà không nêu mã tin | OQ-55; C2; P3; B3; R1, R16; Task 4b; ca Q1–Q7; M4 thu về nháp tài liệu |
| **N3** — `decide` cho người không có quyền thử `valueHash` | C3; Task 3 (thứ tự trong thân khoá lệnh); ca L8. Đã soát mọi ca hiện có của `decide`: không ca nào đổi kỳ vọng (mục «Ca hiện có bị chạm») |
| cổng-R1 — H1 thu hẹp ca canh | H1 loại đúng một tên; G12 khẳng định danh sách trigger của cả hai bảng |
| cổng-R2 — K3 | K3 viết đủ phép khẳng định, tên mới, lý do thứ tự |
| cổng-R3 — trường lấy từ cột cổng không kiểm | P12, B2; Task 3; ca L7 |
| cổng-R4 — guard vắng mà dịch vụ không biết | G12 (`tgenabled`, `tgtype`); «Giới hạn đã biết», danh sách «trước khi bật Z4» |
| cổng-R5 — R6 mô tả khe hở nhỏ hơn thật | R6 viết lại; OQ-53 Phía B (`docs/OPEN-QUESTIONS.md:876`) |
| cổng-R6 — mô tả bit của guard | B4 «Role AI học được gì»; R4; ca G13 |
| cổng-R7 — hai chỗ phân loại | C8 (thay mục 1 của «Dừng và chỗ chưa chắc»); H4, H5 ghi đúng lý do |
| cổng-C1 … C10 | L4, M8, Q1, Q2, L8, G13, G14, G15, M9, T8 |
| Bổ sung OQ-53, OQ-54; câu hỏi mở mới | `docs/OPEN-QUESTIONS.md:876`, `:890`, `:899-908` |

## Bảng: mục cổng bảo mật lượt 2 → chỗ áp

| Mục | Áp ở |
|---|---|
| **N4** — dưới lớp che, `sources` giữ thứ tự và số lần lặp do bên ghi chọn; con số ở R15 sai | Cách sửa 2 của cổng, theo phán quyết của phiên chính: `sources` là `[]` dưới mọi lớp che. C9, C1, P5, B2, R15; Review Focus 1; Task 3 (không còn `SOURCE_IDS_SQL`; `toView` ba tham số; cột `sources` không được đọc); Task 4a (`present`); ca L9, M1 (i), M3, M8, Q1; mục 13 của «Dừng và chỗ chưa chắc» |
| cổng-R8 — fail-closed khi biểu thức hiển thị không xác định; lối tắt «mã không phải uuid» | Task 4b: câu lệnh dùng `IS NOT TRUE`, lối tắt trả `true`; ca Q5, Q8 |
| cổng-R9 — nháp tài liệu dựng từ chữ của tin là đường có sẵn | R16; `docs/OPEN-QUESTIONS.md:904` |
| cổng-C11 | M8, viết lại: `sources` bằng `[]` dù cột `sources` nêu mã có trong ngữ cảnh, lặp và đảo thứ tự (thay điều khẳng định của cổng-C2 lượt 1) |
| cổng-C12 | Q8 |
| cổng-C13 | Q9 |
| 782 tệp bản sao « 2» trong worktree (cổng nêu, ngoài phạm vi kế hoạch) | «Global Constraints», mục Kiểm; gỡ là việc của phiên chính |

Theo báo cáo lượt 2, nếu N4 được sửa đúng như tả thì cổng không cần lượt 3 trên kế hoạch; phiên chính ghi nhận. Review bảo mật bắt buộc của Task 3, 4a, 4b kiểm trên mã.

## Thiết kế bảo mật (cho cổng soát kế hoạch)

### B1 · Ranh giới tin cậy

- **Không tin:** nội dung do mô hình viết (`value` và mọi bản chép). Một dòng nháp cũng có thể được chèn thô bởi người giữ role `libetech_ai`, không qua `submitDraft` (khoảng trống 7): cột nào của dòng cũng có thể mang giá trị bất kỳ mà CHECK của bảng cho phép. **Kiểu của cột chỉ đóng về dạng, không đóng về thông tin:** một cột uuid là 16 byte, một cột hex 64 là 32 byte do bên ghi chọn. Luật che vì thế không dựa vào kiểu cột. Người không được đọc nội dung chỉ nhận: giá trị do CSDL đặt (mã dòng, thời điểm tạo — role AI không chèn được hai cột này), giá trị chính họ đã nêu trong lệnh đọc (dự án, loại và mã đối tượng), quyết định do người ghi, kỹ năng (sáu giá trị), và `manifestHash` đã so với hằng của máy chủ.
- **Tin:** vai của người đọc trong phiên (đúng nguồn `decide` đang dùng — `projectRole(p, projectId)`); danh sách nhóm hiện chữ `excerptChats` truyền vào lúc dựng dịch vụ (khoảng trống 42: mặc định rỗng ⇒ mọi nháp nêu tin đều bị che); login vận hành và login migration (superuser); nhãn miền của dự án (hiện chỉ login vận hành ghi bảng ánh xạ; không đường nào trong `src` ghi nó).
- **Role `libetech_ai` sau PR:** vẫn chỉ `USAGE` trên schema `intelligence`, `SELECT` và `INSERT` theo cột trên `intelligence.ai_drafts`. Không thêm `GRANT` nào. Bốn ca canh của `tests/z4-schema.test.ts` giữ nguyên chữ và phải xanh: «(4) the AI role cannot write any Z1 or Z2 table», «privilege query: …», «nothing reaches libetech_ai by default: …», «no SECURITY DEFINER function is executable by libetech_ai».

### B2 · Hình dạng `DraftView` bản 0.3 (điểm 1 và 2; N1, N4, cổng-R3)

```ts
export type MaskReason='CONFIRM_AUTHORITY_REQUIRED'|'ENTITY_NOT_FOUND'|'POINTER_ONLY_PROJECT'|'SCHEMA_INVALID'|'SOURCE_OUT_OF_CONTEXT'|'TEXT_NOT_VISIBLE'|'THREAD_TEXT_HIDDEN';
export type DraftView={
  id:string;projectId:string;entityType:'intake_candidate'|'document';entityId:string;skill:SkillName;createdAt:string;
  manifestHash:string|null;        // the hash of the manifest in force for this skill, or null: never a value the writer chose
  maskReasons:MaskReason[];        // sorted; empty exactly when the content is returned
  sources:{id:string}[];           // value.sources when the content is returned; [] under every mask
  value:SkillOutput|null;questions:{field:string;question:string}[]|null;confidence:number|null;   // from the schema-validated value, or null
  skillVersion:string|null;        // the version of the manifest in force when the row carries exactly it and the content is returned, else null
  modelVersion:string|null;        // as stored, only when the content is returned
  valueHash:string|null;           // null only for a reader who may not decide the draft
  decision:{result:'confirmed'|'rejected';decidedBy:string;decidedAt:string;documentRevisionId:string|null}|null};
```

| Trường | Ai chọn giá trị | Không có quyền quyết định | Có quyền, bị che | Có quyền, không che |
|---|---|---|---|---|
| `id`, `createdAt` | CSDL (mặc định) | trả | trả | trả |
| `projectId`, `entityType`, `entityId` | người đọc nêu trong `list`; ở `decide` là của dòng người gọi nêu mã | trả | trả | trả |
| `skill` | bên ghi, sáu giá trị (CHECK) | trả | trả | trả |
| `manifestHash` | bên ghi; chỉ trả khi bằng hằng của máy chủ | hằng hoặc `null`, so **trong SQL** | hằng hoặc `null` | hằng hoặc `null` |
| `sources` | bên ghi | `[]` — cột không được đọc | `[]` — cột không được đọc (N4) | `value.sources` (đã qua lược đồ và qua cổng: mọi mã đều nằm trong ngữ cảnh) |
| `value`, `questions`, `confidence` | bên ghi | `null`, ngay trong SQL | `null` | từ giá trị đã qua lược đồ |
| `skillVersion` | bên ghi | `null`, ngay trong SQL | `null` | phiên bản của manifest hiện hành, hoặc `null` khi dòng mang giá trị khác |
| `modelVersion` | pipeline khai | `null`, ngay trong SQL | `null` | như đã lưu |
| `valueHash` | bên ghi (qua dịch vụ: hash của `value`) | `null`, ngay trong SQL | trả (cần để **từ chối** nháp) | trả. **Bản 0.9 (Task G1):** ô «Có quyền, bị che» nay là `null` dưới mọi lớp che; lệnh từ chối một nháp bị che không cần hash (09.4) |
| `decision` | người quyết định | trả | trả | trả |
| `maskReasons` | dịch vụ | đúng `['CONFIRM_AUTHORITY_REQUIRED']` | các mã hiển thị | `[]` |

Người đọc là `viewer`, `bot`, người ngoài dự án hoặc ngoài tenant: 404, cùng câu như hôm nay (S11; không đổi).

Quyền quyết định là **một** hàm dùng cho cả đọc lẫn quyết định: `mayDecide(role, entityType) = entityType==='document' ? mayWriteDocuments(role) : role==='manager'`. Với nháp tài liệu, mọi vai đọc S11 đều ghi được sổ tài liệu nên đều đọc được nội dung; điểm 1 chỉ thu hẹp thật ở nháp ứng viên. `total` đếm theo đúng bộ lọc như hôm nay và không đổi theo việc che. Người không có quyền nhận đúng một mã lý do, không gây lần dựng ngữ cảnh nào và không gây câu đọc luồng nào.

**`decide` không làm lộ điều `list` đã rút (N3).** Trong thân khoá lệnh, phép xét quyền đứng **đầu**: trước «đã có quyết định» và trước phép so `valueHash`. Người không có quyền nhận `MANAGER_REQUIRED` (nháp ứng viên) hoặc `READ_ONLY` (nháp tài liệu) với mọi `valueHash` và mọi trạng thái của nháp. Thứ tự khoá, hai mã lỗi và hai câu không đổi. Đường phát lại không chạy thân khoá lệnh nên không đổi.

### B3 · Luật che lúc đọc (điểm 2; giữ chỗ OQ-55)

Với người có quyền quyết định, cho từng dòng:

1. `value` không qua `outputFits` hoặc không qua lược đồ của kỹ năng → `SCHEMA_INVALID`;
2. dựng ngữ cảnh bằng `buildSkillContextIn(tx, p, {skill, projectId, documentId | candidateId}, this.excerptChats)` — dưới quyền **người đọc**; ném `SCOPE_DENIED` hoặc `INVALID_INPUT` → `ENTITY_NOT_FOUND`; lỗi khác lan ra;
3. `ctx.pointerOnly` → `POINTER_ONLY_PROJECT`;
4. `checkSkillOutput(manifest, ctx, row.value).reasons`, chỉ giữ `SCHEMA_INVALID`, `SOURCE_OUT_OF_CONTEXT`, `TEXT_NOT_VISIBLE`;
5. **giữ chỗ OQ-55**, chỉ cho nháp ứng viên: luồng của ứng viên có ít nhất một bản của tin với `content_mode='excerpt'` mà cấu hình hiện tại không cho hiện → `THREAD_TEXT_HIDDEN`. Một giá trị đúng/sai tính trong `src/server/source-text.ts` bằng chính biểu thức `textAllowedSql` của luật hiển thị; xét mọi bản của mọi tin của luồng.

Có ít nhất một mã ⇒ che. Áp cho `list` và cho câu trả lời của `decide`. Ánh xạ đổi sang `IBS_HI`, cờ nhóm bị gỡ, tin vượt trần 20 tin của ngữ cảnh, tài liệu vượt trần 50: đều rơi vào các bước trên. Bước 1–4 xét **mã nháp tự khai**; bước 5 không phụ thuộc nháp khai gì. Với nháp tài liệu không có bước nào tương đương bước 5 (OQ-55, R16).

### B4 · Từ chối nháp `IBS_HI` lúc ghi (điểm 3) — so sánh và thiết kế chọn

| Cách | Role AI được cấp gì | Role AI học được gì | Lưới ở CSDL | Vì sao không chọn / chọn |
|---|---|---|---|---|
| (a) hàm `SECURITY DEFINER` trả một bit, `GRANT EXECUTE` cho role AI, dịch vụ gọi trước khi chèn | `EXECUTE` một hàm definer | bit «chỉ con trỏ» của bất kỳ dự án nào nó nêu | không: người giữ role bỏ qua bước gọi; đọc-rồi-ghi (TOCTOU) | Phải nới ca canh «no SECURITY DEFINER function is executable by libetech_ai»; không đóng khoảng trống 10 |
| (c) điều kiện trong `WITH CHECK` của policy `ai_insert` | `EXECUTE` hàm definer (như a), hoặc `SELECT` trên `project_domain_mappings` | như (a), hoặc đọc cả bảng ánh xạ trong phạm vi tự khai | có | Biểu thức policy chạy bằng quyền của role chèn: buộc phải cấp quyền đọc cho role AI; nới ca canh «privilege query» hoặc ca canh definer |
| (d) dịch vụ đọc ánh xạ bằng role runtime rồi mới chèn bằng role AI | không | không (qua dịch vụ) | **không** | TOCTOU giữa hai giao dịch; người giữ role AI chèn thẳng; khoảng trống 10 còn nguyên |
| (e) bảng cờ trong schema `intelligence`, trigger trên bảng ánh xạ ghi sang | `SELECT` một bảng mới | bit của dự án trong phạm vi tự khai | có | Thêm bảng, thêm trigger ghi từ Z1 sang Z4, chép dữ liệu; cùng một bit lộ ra |
| **(b) trigger `BEFORE INSERT` trên `intelligence.ai_drafts`, hàm trigger `SECURITY DEFINER`** | **không gì** | một bit cho mỗi lần thử chèn (dưới đây) | **có, cho mọi role** | **Chọn** |

**Thiết kế chọn (b).** Câu SQL đầy đủ ở Task 1. Hàm `intelligence.ai_drafts_pointer_only_guard()` đọc dòng `project_domain_mappings` có `mapping_version` cao nhất của đúng `(NEW.tenant_id, NEW.project_id)` — cùng luật với `isIbsHiSql` (`src/server/source-text.ts:17-21`), thêm điều kiện tenant vì hàm không chạy dưới RLS — và ném `LTZ01` khi mã miền là `IBS_HI`. Dự án chưa ánh xạ và dự án nhãn khác không bị chặn.

- **Vì sao trigger mà không phải policy:** hàm trigger không cần `EXECUTE` của role chèn (PostgreSQL kiểm `EXECUTE` lúc `CREATE TRIGGER`, không kiểm lúc trigger chạy), nên role AI không được cấp gì và không gọi thẳng được hàm. Ca canh definer giữ nguyên chữ và xanh — **nhưng về thực chất** đây là một hàm definer mà role AI kích hoạt gián tiếp với hai tham số nó tự chọn (`tenant_id`, `project_id` của dòng), và nhận về đúng một bit.
- **Role AI học được gì** (viết lại theo cổng-R6). Với mỗi lần thử chèn một dòng nêu `(tenant, dự án)`: `LTZ01` nghĩa là «dòng ánh xạ mới nhất của dự án đó là `IBS_HI`»; mọi kết quả khác nghĩa là không phải.
  - (a) **Bit này xuyên tenant** với người giữ role biết cả hai uuid: trigger `BEFORE ROW` chạy trước `WITH CHECK` của RLS, nên bit có cả khi dự án nằm ngoài phạm vi role tự khai và cả khi không có ngữ cảnh nào (ca G7, G9 ghim đúng hành vi đó, không giấu). **Bản 0.5 (CX1):** từ vòng sửa 1 của cổng Codex, bit chỉ còn với dự án nằm trong phạm vi role tự khai; G7 và G9 đổi kỳ vọng (mục «Vòng sửa 1 của cổng Codex», X1 và R33). **Bản 0.6:** phạm vi là thứ role tự khai, nên với người giữ role có ý xấu con số của bit không đổi so với R4 (R33).
  - (b) **Thứ mới chỉ là nhãn `IBS_HI`.** Trước PR, người giữ role đã tự đặt được mọi biến `app.*` (`docs/DELIVERY-012-review-skills-20261115.md:145`), tức đã đọc và ghi được Z4 của mọi tenant và đã dò được sự tồn tại của một cặp (tenant, dự án) qua khoá ngoại.
  - (c) **Quyền `INSERT` được kiểm trước khi trigger chạy:** role không có quyền chèn nháp (runtime, intake, identity) nhận `permission denied` và không nhận bit nào (ca G13).
  - Nó **không** liệt kê được dự án (sai tenant thì không có bit), **không** phân biệt được `LIBERICO_BU`, `XECA` và «chưa ánh xạ», không thấy lịch sử ánh xạ, người xác nhận hay nguồn. Pipeline vốn nhận bit này qua trường `pointerOnly` của ngữ cảnh. Chữ của phương án 3 (b) mà Chairman chọn đã nêu trước khả năng này: «cần cấp cho role AI quyền đọc hẹp cờ «chỉ con trỏ», hoặc một thiết kế khác» (chữ của mục OQ-45, không phải lời Chairman).
- **Thứ tự so với RLS, ràng buộc và ON CONFLICT.** Trên PGlite planner đã đo bằng một CSDL trong bộ nhớ dùng xong bỏ, ngoài repo: trigger chạy trước `WITH CHECK`, trước NOT NULL và CHECK của bảng, và trước phép dò trùng của `ON CONFLICT`; một dòng `IBS_HI` trong lệnh chèn nhiều dòng làm cả lệnh bị từ chối. Trên PostgreSQL 16: cổng lượt 1 xác nhận từ tài liệu `CREATE POLICY` rằng `WITH CHECK` được áp sau trigger `BEFORE`; phần «phép dò trùng chạy sau trigger» vẫn là suy luận cho tới lượt native (G5, G7, G9 là các ca xác nhận). Hệ quả: gửi lại một khoá khử trùng đã lưu trước khi dự án thành `IBS_HI` cũng bị từ chối (C4), và với dự án `IBS_HI` câu trả lời không phụ thuộc khoá có tồn tại hay không (không làm nặng thêm khoảng trống 41).
- **Fail-closed.** `row_security = off` ghim trên hàm: nếu chủ hàm là một role mà RLS của bảng ánh xạ lọc được, truy vấn trong hàm **báo lỗi** thay vì lặng lẽ thấy rỗng, và mọi lệnh chèn nháp bị từ chối (ca G11). Hàm không đọc biến `app.*` nào, không có SQL động, đầu vào là hai cột kiểu `uuid`; tên bảng viết đủ schema.
- **Buộc mọi role ghi:** login vận hành chèn thô cũng bị từ chối (ca G6), như `draft_decisions_guard`. Superuser vẫn tắt được trigger hoặc `TRUNCATE` (khoảng trống 40; không đổi). **Guard có thể vắng mà dịch vụ không biết** (cổng-R4): lùi 022 hoặc `DISABLE TRIGGER` mở lại đường ghi và `submitDraft` không phân biệt được. PR này ghim trạng thái đúng bằng ca G12 (`tgenabled='O'`, đúng kiểu trigger); việc pipeline tự kiểm lúc khởi động là điều kiện «trước khi bật Z4» (mục «Giới hạn đã biết»).
- **Câu trả lời của dịch vụ:** `submitDraft` bắt đúng SQLSTATE `LTZ01` và ném `AppError` mã `POINTER_ONLY_PROJECT`, HTTP 422, câu «Dự án này chỉ nhận con trỏ nên nháp AI không được lưu.» — không mã dự án, không chữ của lỗi CSDL. Mã này **phân biệt được** với 404 và với `DRAFT_INVALID`. Chấp nhận được vì: người gọi `submitDraft` là pipeline, tức chính bên giữ role AI và đã thấy SQLSTATE; không tuyến HTTP nào đưa câu trả lời này tới người dùng; pipeline cần biết để thôi gửi lại. Dịch vụ vẫn trả 404 **trước mọi câu lệnh** cho dự án ngoài `ai.projectIds` (ca S4). Mọi lỗi CSDL khác đi nguyên tới pipeline: tuyến nào về sau gọi `submitDraft` phải bọc lỗi (mục «Giới hạn đã biết»).
- **Chủ hàm.** Login migration, là superuser (như 019–021; `docs/DELIVERY-012-review-skills-20261115.md:203`). Cổng lượt 1 đã xét phương án chủ hẹp (`libetech_runtime`, chạy dưới RLS theo phạm vi role AI tự khai) và đồng ý giữ superuser: chủ hẹp không thu hẹp được gì và làm tính đúng của guard phụ thuộc ngầm vào policy của bảng khác.
- **Tệp lùi 022:** gỡ trigger và hàm, xoá dòng `'022'`; không đụng dữ liệu, không `CASCADE`. **Từ chối** khi còn một phiên bản lớn hơn `'022'` trong `schema_migrations`. Tệp lùi 021 từ chối khi `'022'` còn được ghi (đã có sẵn: `version > '021'`), nên thứ tự lùi là 022 rồi 021. Lùi 022 mở lại đường ghi nháp cho dự án `IBS_HI`, tức gỡ mã của một quyết định của Chairman: theo `AGENTS.md:9`, không chạy trên CSDL thật khi chưa có lời Chairman.
- **Sau khi nháp đã lưu mà ánh xạ đổi sang `IBS_HI`:** điểm 2 che lúc đọc (`POINTER_ONLY_PROJECT`), cổng có sẵn giữ lúc xác nhận. Nội dung vẫn nằm trong bảng — OQ-54, phần dư R2.

### B5 · Nháp đã cũ (OQ-46 b) — định nghĩa

«Các mã nháp nêu» = `namedIds(skill, value)`: mọi chuỗi ở mọi đường dẫn của `ID_FIELDS[skill]`, chỉ giữ chuỗi đúng dạng uuid chữ thường.

- **Nháp tài liệu.** `named` = `revision_no` cao nhất trong các mã nháp nêu là bản của **chính tài liệu của nháp** (0 nếu không có); `newest` = `revision_no` cao nhất của tài liệu (0 nếu chưa có bản). `newest = 0` → không giữ. `named = 0 < newest` → `SUBJECT_BASELINE_MISSING` (dừng tại OQ-53 điểm 2). `0 < named < newest` → `SUBJECT_CHANGED`. Đọc dưới khoá dòng tài liệu.
- **Nháp ứng viên.** Luồng = các `source_events` cùng dự án, cùng `chat_id` và `thread_key` với ứng viên (đúng phép nối của `visibleThreadMessages`). `B` = `created_at` lớn nhất trong các tin của luồng mà nháp nêu. Không có `B` → `SUBJECT_BASELINE_MISSING` (OQ-53 điểm 2). Có một tin của luồng mà nháp **không** nêu với `created_at >= B` → `SUBJECT_CHANGED` (theo đúng chữ quyết định, cách đọc C5). Có một bản sửa (`revision_no > 1`) của bất kỳ tin nào của luồng với `created_at >= B` → `SUBJECT_EDIT_UNVERIFIED` (dừng tại OQ-53 điểm 1). Câu lệnh chỉ trả ba giá trị đúng/sai: không chữ, không hash.
- **Vị trí trong `decide`:** trong bước giữ của nhánh `confirmed`, sau `checkSkillOutput` và sau phép kiểm `THREAD_TEXT_HIDDEN`, chỉ khi dựng được ngữ cảnh; các mã cộng vào cùng tập và cùng câu `DRAFT_HELD` (chỉ mã, không id). Vì ném trong thân của khoá lệnh, cả giao dịch lùi: không dòng `draft_decisions`, không bản tài liệu, khoá lệnh còn tự do.
- **Từ chối** một nháp cũ vẫn làm được (nhánh `rejected` không chạy bước giữ). **Phát lại** một quyết định đã ghi không chạy lại bước giữ (khoá lệnh trả kết quả đã lưu), nên không đổi khi đối tượng đi tiếp.
- **Chạy đua.** Tài liệu: lệnh xác nhận và lệnh trình bản tay xếp hàng trên khoá dòng tài liệu; bên đến sau thấy kết quả của bên trước — xác nhận đến sau thì bị giữ (`SUBJECT_CHANGED`), trình tay đến sau thì nhận `REVISION_CONFLICT`. Bước giữ chạy **trước** `proposeRevisionIn`, nên lệnh xác nhận đến sau không bao giờ còn trả `REVISION_CONFLICT` của tài liệu (K3). Luồng tin: không khoá; phần dư R6.

### B6 · Phần dư (phiên chính chép vào biên nhận)

- **R1** · Cổng đọc ở bước 1–4 của B3 xét các **mã nháp khai**, không xét nội dung. Với nháp ứng viên, giữ chỗ của OQ-55 che thêm theo luồng, không phụ thuộc mã. Với nháp tài liệu: xem R16.
- **R2** · Nội dung nháp lưu trước khi dự án thành `IBS_HI` nằm lại trong bảng; role AI vẫn đọc được dòng trong phạm vi tự khai. OQ-54. **Bản 0.8 (quét-F7 của lượt quét chạy đua; chỉ ghi chú):** một giao dịch duy nhất — chỉ login vận hành làm được — chèn nháp cho một dự án rồi ghi ánh xạ `IBS_HI` cho chính dự án đó thì nháp và ánh xạ commit cùng lúc: dự án là `IBS_HI` ngay khi nháp xuất hiện. Thứ tự ngược bị từ chối `LTZ01`. Cùng trường hợp của OQ-54.
- **R3** · `valueHash` của nháp bị che vẫn trả cho người có quyền quyết định (32 byte mỗi dòng). Với nháp gần như không có chữ tự do, hash cho phép thử ngoại tuyến các trường ít giá trị (ví dụ phân loại); với dòng chèn thô nó là 32 byte tuỳ ý. Người không có quyền quyết định không nhận hash, và không thử được qua `decide` (N3). **Bản 0.8 — viết lại đúng cỡ (quét-S1 của lượt quét oracle; chữ đầy đủ ở mục «Quét lớp lỗi trước vòng 2 của cổng và Task F5 (bản 0.8)», 08.5):** dưới mọi lớp che khác `CONFIRM_AUTHORITY_REQUIRED`, `valueHash` vẫn tới người có quyền quyết định; với một nháp gần như không có chữ tự do, nó đủ để dựng lại đúng `value` ngoại tuyến — tức phân loại của AI về một tin mà chữ đang bị ẩn — và `REVISION_CONFLICT` của `decide` là một phép so bằng trực tuyến. Ở lại là phần dư theo phán quyết của phiên chính: đóng nó là đổi hợp đồng của `decide` từ lát 3. **Bản 0.9 — ĐÃ ĐÓNG; không còn là phần dư.** Cổng Codex vòng 2 nêu đúng mục này ở mức P0. Task G1 đóng nó: `valueHash` rỗng dưới mọi lớp che, và `decide` không so hash cho người mà nháp đang bị che với họ (mục «Vòng 2 của cổng Codex và vòng sửa 2 (bản 0.9)», 09.4–09.6). Câu «Ở lại là phần dư» ngay trên hết hiệu lực.
- **R4** · Role AI có một bit «`IBS_HI` hay không» cho mỗi cặp `(tenant, dự án)` nó nêu được, xuyên tenant, không để lại dòng nào khi dò. Thứ mới chỉ là nhãn đó (B4). **Bản 0.5:** xem R33 — sau CX1, bit chỉ còn với dự án nằm trong phạm vi role tự khai. **Bản 0.6:** đúng cỡ hơn — role tự khai phạm vi, nên một lệnh `set_config` là có lại bit của bất kỳ dự án nào của bất kỳ tenant nào; bit rộng đúng bằng quyền ghi tự khai (R33).
- **R5** · Một dòng ánh xạ sang `IBS_HI` được commit trong lúc một lệnh chèn nháp đang chạy: nháp có thể được lưu. Tương đương «ánh xạ đổi ngay sau khi lưu»; điểm 2 và cổng xác nhận xử lý. Không lấy khoá trên dòng dự án trong trigger: khoá đó cho người giữ role AI một cách chặn các lệnh sửa dòng dự án. **Bản 0.5:** xem R34 — sau CX4, guard và lệnh ghi ánh xạ xếp hàng bằng một khoá tư vấn theo dự án (không phải khoá trên dòng dự án). **Bản 0.7:** cơ chế nay là khoá dòng `FOR NO KEY UPDATE` trên chính dòng dự án, ở cả guard lẫn lệnh ghi ánh xạ (mục «Đợt sửa sau review của vòng sửa 1 (bản 0.7)», 07.3). Câu «không lấy khoá trên dòng dự án trong trigger» của R5 và ghi chú «Bản 0.5» ở trên là lịch sử; lo ngại R5 nêu — một giao dịch chèn nháp còn mở chặn các lệnh sửa dòng dự án — nay là một cái giá được ghi ở R34 của bản 0.7 (07.4) và canh bằng điều kiện 23. **Bản 0.8:** «cổng xác nhận xử lý» của R5 lúc đầu không có khoá (quét-F1 của lượt quét chạy đua); Task F5 thêm guard phía xác nhận, khoá cùng dòng dự án lúc ghi dòng quyết định (08.3).
- **R6** · Luồng tin (viết lại theo cổng-R5): `created_at` của một tin là lúc **bắt đầu** giao dịch nhận tin (`migrations/016_intake_inbox.sql:47`, `:65`). Giao dịch đó lấy một khoá tư vấn và có thể phải chờ (`src/server/intake.ts:87`), với trần 10 giây cho mỗi câu lệnh (`src/server/db.ts:32`). Một tin mà giao dịch nhận bắt đầu trước mốc nhưng commit sau khi pipeline đã đọc ngữ cảnh mang thời điểm sớm hơn mốc: **khe hở dài bằng thời gian giao dịch nhận tin còn mở, không phải cỡ mili giây, và tin lọt qua không bao giờ được phát hiện**. Đồng hồ CSDL bị chỉnh lùi cũng vậy. Một tin đến giữa phép kiểm và lúc commit của lệnh xác nhận không được thấy — không khác «tin đến ngay sau khi xác nhận». Đóng hẳn cần một số thứ tự của luồng (migration và đổi đường nhận tin); ngoài phạm vi; đã chép vào OQ-53. **Bản 0.5:** xem R36 — sau CX3 (quyết định phạm vi của Chairman, phương án B) không nháp ứng viên nào xác nhận được, nên không lệnh xác nhận nào đi qua khe này; khe vẫn còn như mô tả về phép kiểm.
- **R7** · Quyền đọc nội dung xét theo vai trong phiên, như `decide`; không đọc lại từ CSDL danh tính trong giao dịch. Cổng lượt 1 chưa soát đường dựng `Principal` từ phiên.
- **R8** · Trần của ngữ cảnh (20 tin, 50 tài liệu, 30 bản) làm che oan và giữ oan nháp nêu nguồn ngoài trần. Phép kiểm `THREAD_TEXT_HIDDEN` không dùng trần.
- **R9** · Dịch vụ phải được dựng với đúng `excerptChats` của đường nhận tin; mặc định rỗng ⇒ mọi nháp nêu tin đều bị che, và mọi nháp ứng viên của luồng có lưu chữ đều bị che (khoảng trống 42). PR này không dựng dịch vụ ở đâu ngoài test. **Bản 0.8 (quét-F4; chỉ ghi chú):** danh sách cờ nhóm là **ảnh chụp lúc dựng đối tượng dịch vụ**: gỡ cờ một nhóm trong lúc một đối tượng cũ còn sống thì lệnh xác nhận và việc hiện nội dung vẫn theo danh sách cũ. Tuyến đầu tiên dựng dịch vụ cho từng yêu cầu bằng danh sách hiện hành (điều kiện 4).
- **R10** · Khoảng trống 41 (khoá khử trùng đã dùng ở dự án khác trả xung đột) không đổi.
- **R11** · `maskReasons` cho người có quyền quyết định biết nháp nêu một nguồn họ không đọc được, hoặc luồng có chữ đang ẩn. Đó là «lý do giữ» mà quyết định cho trả.
- **R12** · Giữ chỗ của OQ-53 giữ oan: nháp ở luồng có bản sửa ghi sau tin mới nhất nháp nêu, và nháp không nêu bản hay tin nào.
- **R13** · `list` không báo nháp đã cũ; người xác nhận biết khi lệnh trả `DRAFT_HELD`.
- **R14** · Số lần dựng ngữ cảnh khác nhau theo quyền của người đọc; khác biệt thời gian chỉ lộ vai của chính người đọc; chưa đo.
- **R15** · Phần bên ghi còn chọn được sau N1 và N4. Với người **không có quyền quyết định**: khoảng 3,6 bit mỗi dòng — kỹ năng (sáu giá trị, khoảng 2,6 bit) và một bit «`manifestHash` có khớp manifest hiện hành không» — cộng số dòng và thứ tự chèn. Với người **có quyền, dưới lớp che**: thêm đúng một thứ, `valueHash` (R3); `sources` là `[]`. (Bản 0.2 trả dưới lớp che các mã của cột `sources` có trong ngữ cảnh và ghi «tối đa 100 bit mỗi dòng». Cổng lượt 2 chỉ ra con số đó sai: cột giữ cả thứ tự và số lần lặp, tức khoảng 664 bit mỗi dòng. Bản 0.3 bỏ hẳn đường đó.) **Bản 0.8 — đính chính (quét-S4; chữ đầy đủ ở 08.5):** câu «thêm đúng một thứ, `valueHash`» đếm thiếu. Trên một nháp đang bị che, câu `DRAFT_HELD` của lệnh xác nhận còn nêu mọi mã của cổng — `SOURCE_REQUIRED`, `UNSOURCED_CLAIM`, `TOOL_NOT_ALLOWED`, `NOT_APPROVED_REVISION`, `MANIFEST_MISMATCH`, `VALUE_HASH_MISMATCH` và các mã `SUBJECT_*` — tức một nắm bit cố định về nội dung đang bị che, cho người có quyền quyết định; người ghi được tài liệu còn làm đổi được một số mã đó. Không đổi mã. **Bản 0.9:** sau Task G1 không hash nào tới người có quyền quyết định dưới lớp che, nên cả câu «thêm đúng một thứ, `valueHash` (R3)» lẫn chữ «ngoài `valueHash`» của bản 0.8 không còn. Sau Task G2, trên một nháp bị che câu giữ của lệnh xác nhận chỉ nêu các mã che, cộng giữ chỗ `SUBJECT_ORDER_UNVERIFIED` với nháp ứng viên: **R15 đóng với các mã tả nội dung**, và câu «Không đổi mã» ngay trên hết hiệu lực. Phần còn lại là chính các mã che (mục «Vòng 2 của cổng Codex và vòng sửa 2 (bản 0.9)», 09.6b, 09.7).
- **R16** · **Nháp tài liệu có thể mang chữ của tin mà không phép kiểm nào thấy:** nó không gắn với luồng nào, nên giữ chỗ của OQ-55 không áp được; chỉ luật «dự án chỉ con trỏ» che được. **Đây là đường có sẵn của một pipeline trung thực, không chỉ của đối thủ** (cổng-R9): bộ dựng ngữ cảnh nhận cùng lúc một ứng viên và một tài liệu cho `ba_elicitation` và `pm_planning` (`src/server/skill-context.ts:23-24`, `:31`, `:48-49`, `:53-66`), nên pipeline có thể ghi một nháp tài liệu từ một ngữ cảnh có chữ của tin; lúc đọc và lúc xác nhận, dịch vụ dựng lại ngữ cảnh chỉ theo tài liệu — nháp nêu mã tin thì bị che và bị giữ, không nêu thì chữ đi qua. PR này không viết mã cho trường hợp đó và đó không phải hướng chặt nhất (OQ-55, phương án (b) và (e)). **Bản 0.5:** xem R35 — sau CX2, nháp tài liệu bị che và bị giữ khi dự án có chữ đã lưu mà nay không được hiện (`PROJECT_TEXT_HIDDEN`, giữ chỗ (e) của OQ-55); câu «PR này không viết mã cho trường hợp đó» tả bản 0.4. **Bản 0.6:** giữ chỗ đó áp cho cả nháp ứng viên (cổng-N2): nháp ứng viên chép chữ đang ẩn của một luồng khác cùng dự án cũng bị che và bị giữ.
- **R17** · `modelVersion` (tới 64 ký tự, pipeline khai) được trả cùng nội dung và không qua cổng kiểm nào: cùng lớp với chữ không khai nguồn trong `value`.
- **R18** · Giữ chỗ của OQ-55 che **mọi** nháp ứng viên của một luồng có chữ đang ẩn, kể cả nháp không chép chữ nào; và không che gì khi luồng chưa từng lưu chữ. **Bản 0.5:** giữ chỗ thứ hai (`PROJECT_TEXT_HIDDEN`) che **mọi** nháp tài liệu của một dự án có chữ đang ẩn, kể cả nháp không chép chữ nào (R35). **Bản 0.6:** và che **mọi** nháp ứng viên của dự án đó, không chỉ nháp tài liệu (R35).
- **R19** · Guard có thể vắng mà dịch vụ không biết (lùi 022, `DISABLE TRIGGER`); `submitDraft` không tự kiểm. Điều kiện «trước khi bật Z4».

## Global Constraints

Mọi task mặc nhiên phải thoả các dòng dưới.

**Cổng trước khi viết mã.** Cổng bảo mật lượt 1 (bản 0.1) và lượt 2 (bản 0.2) đều trả «PLAN NEEDS CHANGES»; bản 0.3 áp mọi mục của cả hai lượt. Theo báo cáo lượt 2, nếu N4 được sửa đúng như cổng tả thì cổng không cần soát lại kế hoạch lần nữa: không task nào bắt đầu trước khi phiên chính ghi nhận điều đó. Review bảo mật bắt buộc của Task 3, 4a, 4b kiểm trên mã. Chỗ nào còn phải sửa thì kế hoạch sửa trước, không sửa trong lúc viết mã.

**Phạm vi và điểm dừng**
- Chỉ tới «đã có mã», trên dữ liệu tổng hợp. Không triển khai, không áp migration lên dữ liệu thật, không tạo login hay khoá cho `libetech_ai`, không gọi mô hình, không bật Z4.
- **Không thêm tuyến HTTP, không sửa gì dưới `src/app`, `src/components`.** Ca «no route imports the suggestion service, and nothing in src builds it with an AI handle» (`tests/suggestions.test.ts`) không được sửa một ký tự.
- Không đổi một byte: `AGENTS.md`, `CLAUDE.md`, `bot-plugin/`, `skills/`, `src/server/skill-context.ts`, `src/server/ai-scope.ts`, `src/server/skills.ts`, `migrations/001`–`021` và `migrations/rollback/013`–`021`. Trong `src/server/skill-contracts.ts` chỉ **thêm** một hàm xuất `namedIds`; `checkSkillOutput`, `ID_FIELDS`, các schema không đổi.
- Đúng một migration: `migrations/022_ai_drafts_pointer_only_guard.sql` và `migrations/rollback/022_ai_drafts_pointer_only_guard.sql`. Thấy cần migration thứ hai: **dừng và báo**.
- Không dependency mới. Fixture chỉ dùng dữ liệu tổng hợp; không bí mật, không mã nhóm Telegram thật, không tên người thật.
- **Dừng tại OQ-53:** hai nhánh `SUBJECT_EDIT_UNVERIFIED` và `SUBJECT_BASELINE_MISSING`. **Dừng tại OQ-55:** nhánh `THREAD_TEXT_HIDDEN`, chỉ cho nháp ứng viên; không viết mã nào tương tự cho nháp tài liệu. Cả ba là giữ chỗ fail-closed, viết đúng như Task 4b, 5, 6 tả; không tự đổi sang phương án khác. **OQ-54:** không viết mã. **Bản 0.5:** thêm hai giữ chỗ, cũng fail-closed và không phải phương án được chọn — `PROJECT_TEXT_HIDDEN` cho nháp tài liệu (OQ-55, phần nháp tài liệu của (e); Task F2; câu «không viết mã nào tương tự cho nháp tài liệu» tả bản 0.4) và `SUBJECT_ORDER_UNVERIFIED` cho nháp ứng viên (điểm 3 của OQ-53; quyết định phạm vi của Chairman, phương án B; Task F3). **Bản 0.6:** `PROJECT_TEXT_HIDDEN` áp cho cả hai loại nháp (cổng-N2).
- Trên máy này `grep` là bí danh của ugrep: dùng `/usr/bin/grep`. Không chạy lệnh in dòng lệnh tiến trình (`ps aux`, `ps -ef`, `pgrep -fl`). Không đọc `.runtime/`, `.env*`.

**Dữ liệu và quyền**
- AI chỉ ghi Z4 (AR-03, E-AI-04). PR này không cấp cho `libetech_ai` quyền nào; không `GRANT` nào trong 022.
- Chữ của tin Telegram chỉ rời CSDL qua `src/server/source-text.ts`. Chuỗi `source_event_revisions` và `text_excerpt` chỉ được xuất hiện trong `src/server/intake.ts` và `src/server/source-text.ts` — **kể cả trong chú thích** (ca quét của `tests/source-text.test.ts` so danh sách tệp). Hai hàm mới đọc bảng bản sửa (`threadHasHiddenText`, `threadFreshness`) nằm trong `source-text.ts` và chỉ trả giá trị đúng/sai; `src/server/suggestions.ts` gọi chúng và không nêu tên bảng. **Bản 0.5:** thêm hàm thứ ba cùng luật, `projectHasHiddenText` (Task F2).
- Người gọi và tenant lấy từ `Principal` / `AiPrincipal`, không từ thân lệnh. Mọi lược đồ lệnh giữ `strictObject`.
- «Không tồn tại» và «ngoài phạm vi» trả cùng một câu, cùng mã, cùng trạng thái (`SCOPE_DENIED`, 404, «Không tìm thấy mục trong phạm vi được cấp.»).
- Câu lỗi chỉ chứa mã lý do: không id, không tên, không chữ của nháp, không chữ của lỗi CSDL. Không ghi nội dung nháp vào log.
- Mọi câu SQL dùng tham số; mọi câu đọc của dịch vụ có `project_id=$n`. Mảng mã truyền cho `::uuid[]` phải đã lọc bằng biểu thức uuid chữ thường (không để lỗi `22P02` thô tới người gọi).
- Mọi `DraftView` rời dịch vụ đi qua `present`; không nơi nào khác dựng `DraftView`.

**Ghi**
- Mọi lần ghi nằm trong một giao dịch; lệnh quyết định giữ nguyên thứ tự khoá: khoá nháp → khoá dòng tài liệu (xác nhận nháp tài liệu) → khoá lệnh. Trong thân khoá lệnh: **xét quyền trước tiên** → đã có quyết định → so `valueHash` → lý do từ chối hoặc bước giữ → ghi. **Bản 0.9 (Task G1):** bước «so `valueHash`» chỉ chạy cho người mà nội dung được hiện; với lệnh xác nhận không bị giữ, hash được so lần nữa sau bước giữ (09.5).
- Migration 022 idempotent (chạy hai lần không đổi gì), có tệp lùi, không chèn dòng dữ liệu nào ngoài `schema_migrations`, không tạo role, không `CASCADE`.

**Kiểm**
- Ca viết trước, chạy thấy đỏ **vì `AssertionError`**. Đỏ vì hết giờ hook hay timeout không tính; đỏ vì thiếu mô-đun, thiếu tệp hay thiếu hàm xuất không tính là bằng chứng hành vi (ca nào thuộc loại này được ghi rõ trong task). Cách soát log đỏ: `/usr/bin/grep -c AssertionError <log>` lớn hơn 0 và `/usr/bin/grep -c 'timed out' <log>` bằng 0.
- Không nới ca nào. «Đổi phần hạ tầng» (cách dựng dữ liệu, truy vấn đếm) và «đổi kỳ vọng vì quyết định» chỉ áp cho đúng các ca liệt kê ở mục «Ca hiện có bị chạm»; ca khác đỏ thì **dừng và báo**.
- Builder chạy trên PGlite: `npx vitest run tests/<tệp>` (không đặt biến CSDL nào). Lượt PostgreSQL 16 thật do phiên chính chạy trên CSDL thử riêng của PR (biến `SLICE1_TEST_DATABASE_URL`, `SLICE1_WEB_DATABASE_URL` do phiên chính đặt). CSDL native giữ migration đã áp: nếu tệp 022 đổi sau khi đã áp, phiên chính chạy tệp lùi 022 rồi để harness áp lại.
- `npm run typecheck` sau mỗi task. Lỗi ở tệp `.next/types/* 2.ts` là bản sao của iCloud, không phải lỗi mã: báo phiên chính, không sửa mã vì nó.
- **Bản sao của iCloud.** Worktree này nằm trong một thư mục được đồng bộ và có thể tự sinh tệp bản sao tên dạng `<tên> 2.<đuôi>`, kể cả trong `migrations/`, `src/`, `tests/`. Bộ nạp migration lấy mọi tệp khớp `^\d+.*\.sql$`, vitest nhặt mọi tệp test, và các ca quét thư mục `src` đếm cả bản sao: còn bản sao thì số ca không so được với số gốc và «đỏ» không còn là bằng chứng hành vi. Builder thấy tệp như vậy thì **không sửa, không xoá, không commit — dừng và báo phiên chính**. Phiên chính gỡ các bản sao trước mỗi lượt chạy, và chỉ `git add` theo đường dẫn nêu đích danh, không bao giờ `git add -A` hay `git add .`.

## Review Focus

Cổng bảo mật soát theo thứ tự này; mỗi dòng có ca ghim.

1. **Một trường nào đó của câu trả lời bị che vẫn mang thứ bên ghi chọn** (`questions`, `sources`, `manifestHash`, `modelVersion`, `skillVersion`, `confidence`, hash) — chờ: người không có quyền không nhận gì ngoài phần kê ở R15; dưới mọi lớp che `sources` là `[]`, kể cả khi cột `sources` nêu mã có trong ngữ cảnh. Ca L1, L3, L4, L7, L9, M1, M3, M8, Q1.
2. **Người không có quyền quyết định học được gì từ `maskReasons`, `total`, thứ tự, và từ `decide`** — chờ: đúng một mã, cùng `total`, cùng thứ tự; `decide` trả cùng một câu với mọi `valueHash`. Ca L1, L5, L8.
3. **Lý do che bị bỏ sót:** mã ngoài ngữ cảnh, nguồn của dự án khác, đối tượng không còn, giá trị lệch hợp đồng, ánh xạ đổi sau khi lưu, cờ nhóm gỡ, `excerptChats` mặc định, **nháp ứng viên không nêu tin ở luồng có chữ đang ẩn**, **bản cũ của tin còn lưu chữ**, **danh sách nhóm không xác định được** — chờ: che. Ca L9, M1–M3, Q1, Q2, Q4, Q8. **Che thừa** (nháp tài liệu với lý do không về hiển thị; nháp tài liệu khi cờ nhóm gỡ) — chờ: không che. Ca M4, Q7.
4. **Điều bị che có còn xác nhận được không** — chờ: không. Ca Q3 và các ca giữ có sẵn.
5. **Ngữ cảnh dựng dưới quyền ai, mấy lần, lỗi lạ đi đâu** — chờ: người đọc; một lần mỗi kỹ năng; lỗi lạ lan ra. Ca M5, M6; ca có sẵn «the context is built under the confirming person, not a wider principal» không sửa.
6. **Guard 022: role AI học được gì, gọi được gì, đọc được gì; thứ tự so với RLS và ràng buộc; nhiều dòng; gửi lại khoá cũ; role không có quyền chèn; login vận hành; chủ hàm sai; trigger bị tắt** — Ca G1–G15.
7. **Lỗi CSDL thô lọt ra từ `submitDraft`** — chờ: chỉ `LTZ01` được dịch; lỗi khác nguyên như cũ. Ca S1, S2; ca có sẵn «the runtime role cannot submit a draft».
8. **Nháp cũ lọt qua:** nêu bản cũ; không nêu bản nào; nêu bản của tài liệu khác; mã chữ hoa; tin mới; bản sửa — Ca D1–D5, T1–T4. **Giữ xong còn rác:** dòng quyết định, bản tài liệu, khoá lệnh — Ca D1, T1.
9. **Từ chối và phát lại không bị phép kiểm mới chặn; phát lại không trả lại nội dung đã bị che** — Ca D4, T5, M9, Q9.
10. **Hai câu đọc bảng bản sửa: phạm vi tenant, dự án; không chữ, không hash** — Ca Q5, Q6, Q8, T6, T7, T8.

## Bản đồ tệp

| Tệp | Task | Việc |
|---|---|---|
| `migrations/022_ai_drafts_pointer_only_guard.sql` | 1 | tạo |
| `migrations/rollback/022_ai_drafts_pointer_only_guard.sql` | 1 | tạo |
| `tests/z4-pointer-guard.test.ts` | 1 | tạo |
| `tests/migrations-rollback.test.ts` | 1 | thêm một ca; sửa một dòng chú thích |
| `tests/z4-schema.test.ts` | 1 | một truy vấn của một ca (hạ tầng) |
| `src/server/suggestions.ts` | 2, 3, 4a, 4b, 5, 6 | sửa |
| `tests/suggestions.test.ts` | 1, 2, 3, 4a, 4b, 5, 6 | thêm ca; ba ca (H2, K1, K2) và hai helper (H4, H6) đổi theo mục dưới |
| `src/server/source-text.ts`, `tests/source-text.test.ts` | 4b, 6 | thêm `threadHasHiddenText` (4b), `threadFreshness` (6) và các ca của chúng |
| `src/server/skill-contracts.ts`, `tests/skill-contracts.test.ts` | 5 | thêm `namedIds` và một ca |
| `tests/suggestions-concurrency.test.ts` | 5 | dữ liệu dựng của ba ca; kỳ vọng của một ca |
| `tests/slice3-fixtures.ts` | 6 | thêm helper `nextDbInstant` |
| `vitest.config.ts` | — | không đổi (không mô-đun mới) |

## Ca hiện có bị chạm

**Đổi phần hạ tầng, không đổi điều khẳng định** (tiền lệ: khoảng trống 21 của `docs/DELIVERY-012-review-skills-20261115.md`)

| # | Tệp · ca | Vì sao | Đổi gì | Task |
|---|---|---|---|---|
| H1 | `tests/z4-schema.test.ts` · «running 021 again changes nothing: one trigger, one function, the same policies and grants» | truy vấn đếm mọi trigger trên hai bảng; 022 thêm một trigger trên `intelligence.ai_drafts`, nên `toHaveLength(3)` thành 4 | thêm vào truy vấn `triggers` điều kiện loại **đúng một tên**: `AND tgname <> 'ai_drafts_pointer_only_guard'`; mọi `expect` giữ nguyên. Ca vì thế vẫn thấy mọi trigger lạ khác trên cả hai bảng (cổng-R1); G12 khẳng định danh sách đầy đủ | 1 |
| H2 | `tests/suggestions.test.ts` · «a draft of an IBS HI project cannot be confirmed» | ca ánh xạ `IBS_HI` rồi mới gửi nháp; sau 022 lệnh gửi bị từ chối | đảo thứ tự dựng: gửi nháp trước, `mapDomain(h,ids.transport,'IBS_HI',1)` sau; tên ca và hai `expect` giữ nguyên | 1 |
| H3 | `tests/migrations-rollback.test.ts` · «rollback 021 refuses while a later migration is applied, …» | vòng «lùi các migration sau 021 trước» nay có 022 thật | chỉ sửa chú thích «(none today)»; không `expect` nào đổi | 1 |
| H4 | `tests/suggestions.test.ts` · helper `docDraft` | nháp mặc định chỉ nêu mã tài liệu; sau Task 5 nháp như vậy bị giữ — **do giữ chỗ của OQ-53 điểm 2, không do quyết định nào** (cổng-R7): nếu OQ-53 điểm 2 được quyết khác thì xét lại thay đổi này | nguồn mặc định thành mã tài liệu cùng mã bản mới nhất của nó nếu có (`[d.record.id, d.record.latest_revision_id].filter(Boolean)`); không ca nào dùng helper phải đổi `expect` | 5 |
| H5 | `tests/suggestions-concurrency.test.ts` · «two confirmations of one draft in parallel …», «a confirmation and a rejection of one draft in parallel …» và hàm `setup` (chỉ native) | như H4: **do giữ chỗ của OQ-53 điểm 2** | thêm `{id:d.record.latest_revision_id}` vào `sources` của đầu ra; `expect` giữ nguyên | 5 |
| H6 | `tests/suggestions.test.ts` · helper `candidate` | Task 4a cần một tin lưu ở chế độ chỉ con trỏ; Task 4b và 6 cần sự kiện gốc để dựng tin trả lời và bản sửa | nhận tuỳ chọn `{excerpt?:boolean}` (mặc định `true`; `false` dựng `IntakeService` với `excerptChats:[]`) và trả thêm `event` (đối tượng đã gửi cho `ingest`); không ca nào đổi | 4a |

**Đổi kỳ vọng vì quyết định** (khác với nới ca)

| # | Tệp · ca | Quyết định | Kỳ vọng mới | Task |
|---|---|---|---|---|
| K1 | `tests/suggestions.test.ts` · «R12-k strict query, deterministic order, a total over the same filter» | OQ-45 điểm 1, 2 (hình dạng trả về) | danh sách khoá của một dòng: `['confidence','createdAt','decision','entityId','entityType','id','manifestHash','maskReasons','modelVersion','projectId','questions','skill','skillVersion','sources','value','valueHash']` | 3 |
| K2 | `tests/suggestions.test.ts` · «replay after a change of role: lost project or viewer is the 404; a manager lowered to engineer gets the recorded view» | OQ-45 điểm 1 (C1, C3) | người bị hạ xuống `engineer` gửi lại lệnh trên nháp ứng viên nhận `{...first, sources:[], value:null, questions:null, confidence:null, skillVersion:null, modelVersion:null, valueHash:null, maskReasons:['CONFIRM_AUTHORITY_REQUIRED']}` (`manifestHash` giữ nguyên vì là hash hiện hành); hai dòng 404 và số dòng quyết định giữ nguyên. Tên ca đổi đuôi thành «… gets the recorded decision without the content» | 3 |
| K3 | `tests/suggestions-concurrency.test.ts` · «a draft confirmation racing a manual revision of the same document: one answers REVISION_CONFLICT, …» (chỉ native) | OQ-46 (b) | Tên mới: «a draft confirmation racing a manual revision of the same document: exactly one succeeds; the manual proposal answers REVISION_CONFLICT when the confirmation won, the confirmation is held as SUBJECT_CHANGED when the manual proposal won; no decision without its revision, no revision a decision does not point to». Phép khẳng định, với `confirmed = c.decision!==undefined` và `proposed = m.record!==undefined`: (i) `[confirmed,proposed].filter(Boolean)` dài **đúng 1** — không bao giờ cả hai thành công; (ii) `confirmed` → `m.code==='REVISION_CONFLICT'`, `draft_decisions` có 1 dòng và `document_revision_id` của nó là `latest_revision_id` của tài liệu; (iii) `proposed` → `c` khớp `{code:'DRAFT_HELD',status:422}`, câu của `c` chứa `SUBJECT_CHANGED`, `draft_decisions` có **0** dòng; (iv) số bản tăng đúng 1, như cũ. Lý do `DRAFT_HELD` đến trước `REVISION_CONFLICT`: bước giữ của `decide` chạy trước `proposeRevisionIn`, nên khi lệnh trình tay thắng, lệnh xác nhận thấy tài liệu có bản mới hơn bản nháp nêu trước khi kịp so phiên bản tài liệu | 5 |

**Thứ tự kiểm mới của `decide` (N3) không đổi kỳ vọng của ca hiện có nào.** Planner đã đọc mọi lời gọi `decide` của `tests/suggestions.test.ts` mà người gọi không phải `pm`: dòng `:310`, `:372`, `:399`, `:403`, `:590`, `:591` là `member` hoặc `reviewer` trên **nháp tài liệu** (có quyền ghi sổ, nên phép xét quyền qua và câu trả lời cũ giữ nguyên); `:413`, `:415` là nháp ứng viên **chưa** có quyết định, gửi đúng hash (trả `MANAGER_REQUIRED` theo cả hai thứ tự); `:523` là đường phát lại (không chạy thân khoá lệnh); `:349`–`:357`, `:408`, `:520`, `:521` bị từ chối 404 trước khoá lệnh. Giữ chỗ `THREAD_TEXT_HIDDEN` ở bước giữ cũng không đổi ca nào: hai ca dựng dịch vụ với danh sách nhóm rỗng cho nháp ứng viên (`:302`, `:484`) dùng phép «chứa `TEXT_NOT_VISIBLE`», và ba ca của tệp concurrency chỉ dùng nháp tài liệu.

**Đã xem, không phải đổi, phải xanh nguyên chữ** (các ca khẳng định quyền của `libetech_ai`, số migration hay tệp lùi): `tests/z4-schema.test.ts` — bốn ca canh nêu ở B1, «the role exists as NOLOGIN, …», «the AI role writes drafts only inside its tenant, project and principal» và «drafts return nothing without RLS context» (không ca nào ánh xạ `IBS_HI`, nên guard trả `NEW` và lỗi vẫn là của RLS), «021 refuses an AI role that has a member, …», «the migration file pins the search_path of its function and creates no login» (nêu đích danh hàm của 021); `tests/review-schema.test.ts` (dòng kiểm quyền của `libetech_ai` trên các bảng review); `tests/migrations-rollback.test.ts` — «every migration from 013 has a rollback file with the same name» (tệp lùi 022 phải **cùng tên** tệp thuận), «forward → rollback → forward leaves source tables untouched», ba ca 018, 019, 020 (vòng «lùi các migration sau» tự lấy 022); `tests/fix-wave-db.test.ts` — «rollback files carry no CASCADE», «forward → rollback highest-first → forward restores an identical catalog»; `tests/outbox-schema.test.ts` — «017 rollback refuses while identity.account_approvals.kind exists, …» (cùng vòng lùi); `tests/rls-catalog.test.ts` và `tests/slice1-harness.test.ts` (022 không tạo bảng).

Không ca nào khác được sửa. Riêng ca «the context is built under the confirming person, not a wider principal» (`toHaveLength(1)`) phải xanh **không sửa** sau Task 4a: `decide` dùng lại ngữ cảnh đã dựng cho câu trả lời.

---

### Task 1: Migration 022 — guard «chỉ con trỏ» trên `intelligence.ai_drafts` (+ tệp lùi) — **review riêng**: `liberico-database-reviewer` và `liberico-security-reviewer`

**Tệp:** tạo `migrations/022_ai_drafts_pointer_only_guard.sql`, `migrations/rollback/022_ai_drafts_pointer_only_guard.sql`, `tests/z4-pointer-guard.test.ts`; sửa `tests/migrations-rollback.test.ts` (ca RB1; H3), `tests/z4-schema.test.ts` (H1), `tests/suggestions.test.ts` (H2).

**Tệp thuận** (đúng mẫu đầu tệp của 021; thân như sau, không thêm lệnh nào khác):

```sql
-- OQ-45 point 3 (b), decided by the Chairman on 18/11/2026: an AI draft of a project whose latest domain mapping is IBS_HI is refused when it is
-- written (AGENTS.md:16). A BEFORE INSERT guard on intelligence.ai_drafts reads the one fact it needs: the mapping row with the highest
-- mapping_version of the row's own tenant and project (the rule of isIbsHiSql in src/server/source-text.ts). Unmapped and other labels decide nothing.
-- The function is SECURITY DEFINER and is a trigger function: libetech_ai is granted nothing, cannot call it, and reads no mapping row. What the AI
-- role can tell from an insert attempt is one bit for the (tenant, project) the row names, whatever context it set: BEFORE ROW triggers fire before
-- the WITH CHECK of row-level security. row_security = off makes the function fail closed: an owner that row-level security would filter gets an
-- error, never an empty read. Apply as the migration login (a superuser), like 019–021. The guard binds every writer, the operational login included.
-- The guard also refuses a write from a transaction that is not READ COMMITTED (LTZ02): only that level reads the latest mapping.
-- Nothing here switches anything on: no login, no password, no key, no membership, no grant, no model. No data rows except schema_migrations.
-- Rollback: migrations/rollback/022_ai_drafts_pointer_only_guard.sql (refuses while a later migration is recorded).
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION intelligence.ai_drafts_pointer_only_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp SET row_security = off AS $$
DECLARE latest text;
BEGIN
  -- The mapping is read under the snapshot of the calling transaction. Only READ COMMITTED gives this statement a fresh one: a REPEATABLE READ or
  -- SERIALIZABLE transaction opened before an IBS_HI mapping was committed would not see it and the draft would be stored (measured on PostgreSQL 16).
  -- Any other isolation level is refused, whatever the project.
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'An AI draft is written in a READ COMMITTED transaction' USING ERRCODE = 'LTZ02';
  END IF;
  SELECT m.domain_code INTO latest FROM public.project_domain_mappings m
   WHERE m.tenant_id = NEW.tenant_id AND m.project_id = NEW.project_id
   ORDER BY m.mapping_version DESC LIMIT 1;
  IF latest = 'IBS_HI' THEN
    RAISE EXCEPTION 'An AI draft is not stored for a pointer-only project' USING ERRCODE = 'LTZ01';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION intelligence.ai_drafts_pointer_only_guard() FROM PUBLIC;

DROP TRIGGER IF EXISTS ai_drafts_pointer_only_guard ON intelligence.ai_drafts;
CREATE TRIGGER ai_drafts_pointer_only_guard BEFORE INSERT ON intelligence.ai_drafts
  FOR EACH ROW EXECUTE FUNCTION intelligence.ai_drafts_pointer_only_guard();

INSERT INTO schema_migrations(version) VALUES('022') ON CONFLICT(version) DO NOTHING;
COMMIT;
```

**Tệp lùi:**

```sql
-- Rollback of 022 only. Throwaway test copy use; never run against production data without Chairman approval.
-- Order: roll back 022 before 021. Refuses while a later migration is recorded. No CASCADE. No data is touched: drafts and decisions stay.
-- Removing the guard re-opens the write of an AI draft for an IBS_HI project (OQ-45 point 3 (b) is then enforced nowhere at write time).
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version > '022') THEN
    RAISE EXCEPTION 'Roll back the later migrations before 022.';
  END IF;
  -- dynamic and guarded, so the file can run again after the trigger, the function, the table or the schema is gone
  IF pg_catalog.to_regclass('intelligence.ai_drafts') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS ai_drafts_pointer_only_guard ON intelligence.ai_drafts';
  END IF;
  IF pg_catalog.to_regprocedure('intelligence.ai_drafts_pointer_only_guard()') IS NOT NULL THEN
    EXECUTE 'DROP FUNCTION intelligence.ai_drafts_pointer_only_guard()';
  END IF;
END $$;
DELETE FROM schema_migrations WHERE version = '022';
COMMIT;
```

Hai khối SQL trên đã được planner chạy trên PGlite trong một CSDL trong bộ nhớ dùng xong bỏ (ngoài repo): thuận hai lần cho cùng một hình dạng; lùi bị chặn khi có `'023'`; lùi lặp lại được, kể cả sau khi 021 đã lùi (schema không còn); `has_function_privilege('libetech_ai', …, 'EXECUTE')` là `false`; trigger guard có `tgenabled='O'`, `tgtype=7`. Chưa chạy trên PostgreSQL 16.

**Ca kiểm viết trước** — `tests/z4-pointer-guard.test.ts`. `beforeEach`: `openHarness`, `reset`, `seedSlice1`, `seedMembers`; `afterEach`: `reset`, `close`. Chép các helper `rows`, `asAi`, `draftVals`, `insertDraft`, `JSONB_COLUMNS`, `asRuntime` từ `tests/z4-schema.test.ts:20-47` (không import từ một tệp test khác); `mapDomain` từ `./slice3-fixtures`; `rolledBack` từ `./slice2-fixtures`. `LTZ='LTZ01'`. Một lệnh chèn bị từ chối được đọc bằng `.then(()=>null, e=>e)` để so cả `code` lẫn `message`.

- [ ] **G1 `the guard refuses a draft for a project whose latest mapping row is IBS_HI: SQLSTATE LTZ01, a message without ids, nothing stored`** — `mapDomain(h,ids.transport,'IBS_HI',1)`; chèn dưới role AI trong phạm vi `[ids.transport]`: lỗi khác `null`; `code` là `LTZ01`; `message` đúng bằng `An AI draft is not stored for a pointer-only project`; `message` không khớp `/[0-9a-f]{8}-[0-9a-f]{4}-/`; số dòng `intelligence.ai_drafts` không đổi.
- [ ] **G2 `an unmapped project, a project under another label and a project whose latest row left IBS_HI still store`** (ca đối chứng; xanh từ đầu) — `ids.sales` chưa ánh xạ: lưu được; ánh xạ `XECA`: lưu được; `ids.transport` ánh xạ `IBS_HI` (1) rồi `LIBERICO_BU` (2): lưu được.
- [ ] **G3 `the highest mapping_version decides, whatever the order the rows were written in`** — `mapDomain(h,ids.sales,'IBS_HI',5)` rồi `mapDomain(h,ids.sales,'XECA',4)`: chèn bị từ chối `LTZ01`.
- [ ] **G4 `the guard reads the mapping of the row's own tenant: a row that names another tenant is answered by row-level security and is not stored`** — `ids.transport` là `IBS_HI`; dòng mang `project_id: ids.transport, tenant_id: ids.otherTenant`: `message` khớp `/row-level security/`, `code` khác `LTZ01`; không dòng nào thêm.
- [ ] **G5 `the guard answers before the conflict check: the dedupe key of a draft stored before the mapping is refused on replay, and one row stays`** — lưu một nháp cho `ids.transport` với khoá `K` khi chưa ánh xạ; ánh xạ `IBS_HI`; chèn lại cùng khoá bằng `INSERT … ON CONFLICT(tenant_id,dedupe_key) DO NOTHING RETURNING id`: `code` là `LTZ01` (không phải «không dòng nào»); `SELECT count(*) … WHERE dedupe_key=K` là 1.
- [ ] **G6 `the pointer-only guard also stops the operational login`** — `insertDraft(h.operator,{project_id:ids.transport})` khi `ids.transport` là `IBS_HI`: `LTZ01`.
- [ ] **G7 `34d without a transaction context nothing is stored: an IBS_HI project is answered by the guard, any other project by row-level security`** — giao dịch chỉ có `SET LOCAL ROLE libetech_ai`: dòng cho `ids.transport` (`IBS_HI`) → `LTZ01`; dòng cho `ids.sales` → `/row-level security/`; số dòng không đổi.
- [ ] **G8 `34a 34e the AI role gains nothing to read or call`** — dưới `asAi`: `SELECT 1 FROM public.project_domain_mappings` → `/permission denied/`; `SELECT intelligence.ai_drafts_pointer_only_guard()` → `/permission denied/`. Từ catalog: ACL của hàm chỉ có chủ hàm (`SELECT a.grantee::regrole::text … aclexplode(p.proacl)` bằng đúng `[chủ hàm]`); truy vấn của ca canh definer (`p.prosecdef AND has_function_privilege('libetech_ai',p.oid,'EXECUTE')`) trả rỗng; `libetech_ai` vẫn `rolsuper=false`, `rolbypassrls=false`, `rolcanlogin=false`, không là thành viên và không có thành viên; `has_table_privilege('libetech_ai','public.project_domain_mappings','SELECT')` là `false`.
- [ ] **G9 `what the AI role can tell apart is one bit, and this test says so: an IBS_HI project outside the declared scope is answered LTZ01, any other project outside it by row-level security`** — `ids.transport` là `IBS_HI`; phạm vi khai `[ids.sales]`: dòng cho `ids.transport` → `LTZ01`; dòng cho `sameBuProject` (chưa ánh xạ, ngoài phạm vi) → `/row-level security/`. Ca này ghim hành vi nêu ở B4; đổi nó phải là việc có chủ ý.
- [ ] **G10 `34c update and delete of a draft stay refused`** — một dòng nháp có sẵn: `UPDATE` và `DELETE` dưới role AI và dưới role runtime → `/permission denied/`; bằng login vận hành → `/Append-only/`.
- [ ] **G11 `fail-closed: when the guard function is owned by a role that row-level security filters, every insert is refused`** — trong `rolledBack`: `ALTER FUNCTION intelligence.ai_drafts_pointer_only_guard() OWNER TO libetech_runtime`; `SET LOCAL ROLE libetech_ai` và ngữ cảnh đủ; `probe` một lệnh chèn cho `ids.sales` (chưa ánh xạ) và một cho `ids.transport` (`IBS_HI`): cả hai khớp `/row-level security policy for table "project_domain_mappings"/` (không cái nào trả `null`). Đỏ trước khi có hàm là lỗi «function does not exist» của `ALTER`: không tính là bằng chứng.
- [ ] **G12 `running 022 again changes nothing: the exact triggers of both tables, one enabled BEFORE INSERT row guard, one function, pinned settings, no grant; the file inserts no data and creates no role`** (cổng-R1, cổng-R4) — hình dạng trước và sau `h.exec(sql)` hai lần bằng nhau. Danh sách trigger không nội bộ của **cả hai bảng** bằng đúng: `intelligence.ai_drafts` → `['ai_drafts_immutable','ai_drafts_pointer_only_guard']`; `public.draft_decisions` → `['draft_decisions_guard','draft_decisions_immutable']`. Trigger guard: `tgenabled='O'`; `tgtype=7` (ROW + BEFORE + INSERT, không UPDATE, DELETE, TRUNCATE, INSTEAD OF); `pg_get_triggerdef` khớp `/BEFORE INSERT/` và `/FOR EACH ROW/`. Hàm: `prosecdef=true`; `proconfig` chứa `search_path=pg_catalog, pg_temp` và `row_security=off`; chủ hàm có `rolsuper OR rolbypassrls`. Chữ của tệp (bỏ chú thích): không khớp `/\bINSERT INTO (?!schema_migrations)/i`, `/\bGRANT\b/i`, `/CREATE\s+ROLE/i`, `/ALTER\s+ROLE/i`, `/\bPASSWORD\b/i`, `/CASCADE/i`; hai dòng cuối là dòng `schema_migrations` của `'022'` và `COMMIT;`.
- [ ] **G13 `the guard gives no answer to a role that may not insert drafts`** (cổng-C6) — `ids.transport` là `IBS_HI`; role runtime (qua `asRuntime`) và, trong một giao dịch `SET LOCAL ROLE libetech_intake`, role nhận tin chèn một dòng cho `ids.transport`: `message` khớp `/permission denied/`, `code` khác `LTZ01`; không dòng nào thêm.
- [ ] **G14 `the guard decides each row of a multi-row insert: one IBS_HI row refuses the whole statement and nothing is stored`** (cổng-C7) — dưới role AI trong phạm vi `[ids.sales, ids.transport]`, một lệnh `INSERT … SELECT … FROM unnest($n::uuid[])` cho hai dự án, `ids.transport` là `IBS_HI`: `code` là `LTZ01`; số dòng không đổi (dòng của `ids.sales` cũng không được lưu). Đối chứng: cùng lệnh với hai dòng đều của `ids.sales` lưu được hai dòng.
- [ ] **G15 `a row without tenant_id or project_id is answered by the table, not by the guard`** (cổng-C8) — `ids.transport` là `IBS_HI`. Dưới role AI: dòng có `tenant_id` là `null`, rồi dòng có `project_id` là `null` → `code` khác `LTZ01` và `message` khớp `/row-level security/` (trigger trả `NEW` vì không tìm thấy ánh xạ; `WITH CHECK` chạy trước NOT NULL). Bằng login vận hành: hai dòng đó → `code` là `23502`. Không dòng nào thêm.
- [ ] **RB1** (`tests/migrations-rollback.test.ts`; bản 0.1 gọi là R22) **`rollback 022 refuses while a later migration is applied, drops the guard trigger and its function, and leaves drafts, decisions and 021 as they were`** — theo đúng mẫu của ca 021 ngay trên nó: lùi mọi migration số lớn hơn 22 trước (hôm nay rỗng); chèn tay `'023'` → tệp lùi bị từ chối khớp `/later|023/i`, hình dạng không đổi, xoá dòng chèn tay; với một dòng nháp và một dòng quyết định có sẵn: chạy tệp lùi → trigger và hàm không còn, không còn dòng `'022'`, hai bảng và số dòng của chúng nguyên, ba trigger và hàm `draft_decisions_guard` của 021 nguyên; trong một giao dịch luôn lùi: một lệnh chèn cho dự án `IBS_HI` nay **lưu được** (ghi rõ điều tệp lùi mở lại); chạy tệp lùi lần nữa không lỗi; thuận hai lần → hình dạng như đầu. `finally`: `ROLLBACK`, áp lại tệp thuận và các migration sau, `reset`, `close`. Chữ của tệp lùi (bỏ chú thích) không khớp `/CASCADE|DROP\s+ROLE|DROP\s+TABLE|DROP\s+SCHEMA/i`. Đỏ trước khi có tệp là lỗi thiếu tệp: không tính.
- [ ] Sửa hạ tầng H1, H2, H3 đúng như bảng «Ca hiện có bị chạm».
- [ ] Chạy đỏ (G1, G3, G5, G6, G7, G8, G9, G14 đỏ vì `AssertionError`; G13 và G15 là đối chứng, xanh từ đầu; G11, G12 và RB1 đỏ vì thiếu hàm hoặc thiếu tệp, không tính là bằng chứng) → viết hai tệp SQL → xanh: `npx vitest run tests/z4-pointer-guard.test.ts tests/z4-schema.test.ts tests/migrations-rollback.test.ts tests/fix-wave-db.test.ts tests/rls-catalog.test.ts tests/slice1-harness.test.ts tests/suggestions.test.ts`. `tests/z4-schema.test.ts` phải giữ đúng 23 đạt 2 bỏ qua; `git diff 4f12a3c -- tests/z4-schema.test.ts` chỉ chạm một dòng truy vấn.
- [ ] Phiên chính lặp lại cả lệnh trên với PostgreSQL 16 thật: G5, G7, G9, G14, G15 là các ca xác nhận thứ tự «trigger trước RLS, trước ràng buộc, trước phép dò trùng» trên động cơ thật.

**Điểm commit** (phiên chính): `feat(db): refuse an AI draft of an IBS HI project at the database, with rollback (migration 022, OQ-45 3b)`.

---

### Task 2: `submitDraft` trả `POINTER_ONLY_PROJECT` — review cùng Task 1

**Tệp:** sửa `src/server/suggestions.ts`, `tests/suggestions.test.ts`.

**Giao diện**
```ts
// src/server/suggestions.ts
/** SQLSTATE raised by the pointer-only guard of migration 022. */
export const POINTER_ONLY_SQLSTATE='LTZ01';
const pointerOnlyRefused=()=>new AppError('POINTER_ONLY_PROJECT','Dự án này chỉ nhận con trỏ nên nháp AI không được lưu.',422);
```
Trong `submitDraft`, bọc **đúng** lời gọi `aiScoped(…)` hiện có: `try { return await aiScoped(…); } catch(e) { if((e as {code?:string})?.code===POINTER_ONLY_SQLSTATE) throw pointerOnlyRefused(); throw e; }`. Không thêm câu đọc ánh xạ nào ở dịch vụ; không đổi thứ tự các phép từ chối trước CSDL. Mọi lỗi khác (kể cả `permission denied`) đi qua nguyên.

**Ca kiểm viết trước** (`tests/suggestions.test.ts`, nhóm mới `Z4 drafts: IBS HI is refused at write (OQ-45 point 3)`)
- [ ] **S1 `a draft for an IBS HI project is refused when it is written: POINTER_ONLY_PROJECT, nothing stored, no database error text`** — `mapDomain(h,ids.transport,'IBS_HI',1)`; `d=await doc(ids.transport)`; `refused(svc().submitDraft(ai, env('document',d.record.id,'technical_writer',out('technical_writer',[d.record.id]),{projectId:ids.transport})),'POINTER_ONLY_PROJECT',422)`; câu đúng bằng «Dự án này chỉ nhận con trỏ nên nháp AI không được lưu.»; câu không chứa `d.record.id`, `ids.transport`, `pointer-only`; `n('intelligence.ai_drafts')` là 0. Lặp lại với một nháp ứng viên (`intake_analyst`): ánh xạ `ids.sales` sang `IBS_HI`, tạo ứng viên bằng `candidate()`, gửi nháp cho ứng viên đó → cùng câu trả lời. Đỏ sau Task 1: lỗi mang mã `LTZ01`, `toMatchObject` thất bại.
- [ ] **S2 `the refusal comes before the replay: an envelope first stored before the mapping is refused afterwards, and one draft stays`** — gửi một phong bì cho `ids.transport` khi chưa ánh xạ (`stored:true`); ánh xạ `IBS_HI`; gửi lại **đúng** phong bì đó → `POINTER_ONLY_PROJECT` (không phải `{stored:false}`); số dòng nháp là 1.
- [ ] **S3 `an unmapped project, a project under another label and a project that left IBS_HI still store`** (đối chứng; xanh từ đầu).
- [ ] **S4 `the pipeline's own project list answers first: an IBS HI project outside ai.projectIds is the not-found answer, before any statement`** (đối chứng) — `svc(handle).submitDraft({...ai,projectIds:[ids.sales]}, phong bì của ids.transport)` → `denied`; tay nắm giả không bị chạm.
- [ ] Ca có sẵn «the runtime role cannot submit a draft» (native) không sửa: lỗi `permission denied` thô vẫn đi qua.
- [ ] Chạy đỏ (S1, S2 đỏ vì `AssertionError`) → sửa → xanh: `npx vitest run tests/suggestions.test.ts`; `npm run typecheck`.

**Điểm commit** (phiên chính): `feat(suggestions): answer POINTER_ONLY_PROJECT when the draft guard refuses a write (OQ-45 3b)`.

---

### Task 3: Nội dung nháp chỉ cho người có quyền quyết định (OQ-45 điểm 1), hình dạng `DraftView` mới, và `decide` xét quyền trước tiên — **review riêng**, bắt buộc `liberico-security-reviewer`

**Tệp:** sửa `src/server/suggestions.ts`, `tests/suggestions.test.ts`.

**Giao diện** — kiểu `MaskReason` và `DraftView` đúng như khối mã ở mục B2 của «Thiết kế bảo mật» (chép nguyên; `THREAD_TEXT_HIDDEN` có trong kiểu từ task này, Task 4b mới dùng). Thêm:

```ts
import type {Role} from './types';
// add `outputFits`, `outputSchemas`, `SKILLS` and `type SkillOutput` to the existing import from './skill-contracts' where missing

/** OQ-45 point 1 (b): the one rule for who may decide a draft, which is also who may read its content. */
const mayDecide=(role:Role,entityType:EntityType)=>entityType==='document'?mayWriteDocuments(role):role==='manager';

const HEAD='d.id,d.project_id,d.entity_type,d.entity_id,d.signal_type,d.created_at';
const DECISION='x.result AS dec_result,x.decided_by AS dec_by,x.created_at AS dec_at,x.document_revision_id AS dec_revision,x.command_key AS dec_key';
const FROM_DRAFTS='FROM intelligence.ai_drafts d LEFT JOIN draft_decisions x ON x.draft_id=d.id';
/** The whole row: for a person who may decide, and for decide itself. The columns `sources`, `questions` and `confidence` are not read by any statement: the value is the one source. */
const DRAFT_SQL=`SELECT ${HEAD},d.manifest_hash,d.skill_version,d.model_version,d.value,d.value_hash,${DECISION} ${FROM_DRAFTS}`;
/** skill → hash of the manifest in force: the one jsonb parameter ($6) of DRAFT_META_SQL. */
const MANIFESTS_IN_FORCE=JSON.stringify(Object.fromEntries(SKILLS.map(s=>[s,skillManifests[s].hash])));
/** For a reader who may not decide: no content column leaves the database, and the manifest hash only when it is the one in force. */
const DRAFT_META_SQL=`SELECT ${HEAD},CASE WHEN d.manifest_hash = ($6::jsonb ->> d.signal_type) THEN d.manifest_hash END AS manifest_hash,
  NULL::text AS skill_version,NULL::text AS model_version,NULL::jsonb AS value,NULL::text AS value_hash,${DECISION} ${FROM_DRAFTS}`;
```
Giữ nguyên chữ «FROM intelligence.ai_drafts d LEFT JOIN» trong câu lệnh và «WHERE d.id=» ở hai nơi `decide` dùng `DRAFT_SQL`: ca có sẵn M12-2 dò câu lệnh theo hai đoạn đó. Biểu thức `$6::jsonb ->> d.signal_type` đã được planner chạy trên PGlite.

- `DraftRow`: bỏ `questions`, `confidence` và `sources` (không câu lệnh nào còn đọc ba cột đó); `manifest_hash`, `skill_version`, `model_version`, `value_hash` thành kiểu có `null`.
- `toView(r:DraftRow, mask:MaskReason[], shown:SkillOutput|null):DraftView`:
  - `manifestHash = r.manifest_hash===skillManifests[r.signal_type].hash ? r.manifest_hash : null` (mọi người đọc);
  - `mask` rỗng (khi đó `shown` khác `null`): `value=shown`, `questions=shown.questions`, `confidence=shown.confidence`, `sources=shown.sources`, `skillVersion = r.skill_version===skillManifests[r.signal_type].version ? r.skill_version : null`, `modelVersion=r.model_version`, `valueHash=r.value_hash`;
  - `mask` không rỗng: năm trường nội dung là `null`; **`sources` là `[]`** (mọi lớp che — N4, C9); `valueHash = mask.includes('CONFIRM_AUTHORITY_REQUIRED') ? null : r.value_hash`. **Bản 0.9 (Task G1):** nay `valueHash = null` với mọi `mask` không rỗng.
- `private async present(tx:Queryable, p:Principal, projectId:string, rows:DraftRow[]):Promise<DraftView[]>` — ở task này, cho từng dòng: `mayDecide(projectRole(p,projectId), r.entity_type)` sai → `toView(r,['CONFIRM_AUTHORITY_REQUIRED'],null)`. Đúng → `parsed = outputFits(r.value) ? outputSchemas[r.signal_type].safeParse(r.value) : null`; `parsed?.success` → `toView(r,[],parsed.data)`; ngược lại → `toView(r,['SCHEMA_INVALID'],null)`. Task 4a và 4b thêm lý do vào đúng hàm này.
- `list`: `content = mayDecide(projectRole(p,own), q.entityType)`. `content` đúng → `DRAFT_SQL` với năm tham số như hôm nay; sai → `DRAFT_META_SQL` với cùng năm tham số cộng tham số thứ sáu `MANIFESTS_IN_FORCE`. Cùng `WHERE`, `ORDER BY`, `LIMIT`, `OFFSET`. Trả `{items: await this.present(tx,p,own,rows), total}`. Câu đếm `total` không đổi.
- `decide` (**N3**): trong thân khoá lệnh, dòng **đầu tiên** là phép xét quyền bằng `mayDecide(projectRole(p,projectId), d.entity_type)` — sai thì ném đúng mã và câu hiện có (`READ_ONLY` 403 với `READ_ONLY_MESSAGE` cho nháp tài liệu; `MANAGER_REQUIRED` 403 «Chỉ điều phối dự án được thực hiện thao tác này.» cho nháp ứng viên). Sau đó mới tới `if(d.dec_result) throw alreadyDecided()` và phép so `valueHash`. Không đổi thứ tự khoá, không đổi gì trước khoá lệnh. Sửa chú thích thứ tự ở đầu hàm cho khớp. Câu trả lời cuối là `(await this.present(tx,p,projectId,[view]))[0]` thay cho `toView(view)`.

**Ca kiểm viết trước** (`tests/suggestions.test.ts`, nhóm mới `Z4 drafts: who reads the content (OQ-45 point 1)`). `MARK` là một chuỗi đánh dấu tổng hợp duy nhất của tệp. Người đọc: `pm` (manager), `member` (engineer), `reviewer` (technical), `approver` (business; nhập từ `./slice3-fixtures`). Lưu ý cho builder: phiên bản của sáu manifest hiện là `0.1.0`, còn helper `rawDraft` ghi `skill_version:'1.0.0'`.

- [ ] **L1 `a candidate draft: only the project manager reads its content; engineer, technical and business get no content, no source id and no hash`** — nháp ứng viên có `MARK` trong `claims[0].value` và trong `questions[0].question`. `pm`: `value` bằng đầu ra đã gửi, `maskReasons` là `[]`, `questions` có `MARK`, `confidence` 70, `sources` bằng `output.sources`, `skillVersion` bằng phiên bản của manifest, `modelVersion` là `'synthetic-model-1'`, `valueHash` bằng `sha(output)`, `manifestHash` bằng hash của manifest. Với từng người `member`, `reviewer`, `approver`: dòng **bằng đúng** `{id, projectId:ids.sales, entityType:'intake_candidate', entityId, skill:'intake_analyst', manifestHash:<hash của manifest hiện hành>, createdAt:<chuỗi>, sources:[], maskReasons:['CONFIRM_AUTHORITY_REQUIRED'], value:null, questions:null, confidence:null, skillVersion:null, modelVersion:null, valueHash:null, decision:null}`; `JSON.stringify` của cả câu trả lời không chứa `MARK` và không chứa mã của tin; `total` là 1.
- [ ] **L2 `a document draft: every role that may write the ledger reads its content; viewer and bot get the not-found answer for both kinds of draft`** (phần đọc được là đối chứng, xanh từ đầu) — bốn vai S11 đều nhận `value` của nháp tài liệu và `maskReasons:[]`; `viewerByGrant` (vai `viewer` ở `ids.sales`) và một principal `bot` có `ids.sales` trong phạm vi → `denied` khi `list` cả nháp tài liệu lẫn nháp ứng viên; `outsider` (tenant khác) và `transportApprover` (dự án khác) → `denied`.
- [ ] **L3 `nothing the writer chose reaches the service for a reader without the authority: no value, question, confidence, version string, hash or source id in any row handed to it`** — dựng dịch vụ trên `recordingDb(h.db)`; `member` đọc danh sách nháp ứng viên của L1: `JSON.stringify(rec.rows())` không chứa `MARK`, không chứa `sha(output)`, không chứa `'synthetic-model-1'`, không chứa mã của tin.
- [ ] **L4 `a reader without the authority gets no bits the writer chose: sources is empty and manifestHash is the current manifest's or null`** (cổng-C1) — một dòng chèn thô cho một ứng viên có thật: cột `sources` gồm 100 mã **đúng dạng uuid** dựng từ dạng hex của một chuỗi đánh dấu (cắt 32 ký tự hex thành khuôn 8-4-4-4-12), và `manifest_hash` là 64 ký tự hex mang cùng chuỗi đánh dấu. `member` đọc qua `recordingDb`: dòng có `sources` bằng `[]` và `manifestHash` là `null`; `JSON.stringify` của câu trả lời **và** của mọi dòng trao cho dịch vụ không chứa mã nào trong 100 mã đó và không chứa chuỗi 64 ký tự hex đó. Một dòng thứ hai mang hash của manifest hiện hành: `manifestHash` bằng hash đó.
- [ ] **L5 `masking changes no row count and no order: the list and the total are the same for every reader`** — ba dòng nháp ứng viên có `created_at` khác nhau: danh sách mã và `total` của `pm` và của `member` bằng nhau.
- [ ] **L6 `one rule for reading and deciding: a role reads the content of a draft exactly when it may decide it`** — với mỗi vai trong bốn vai S11 và mỗi loại nháp (một nháp mới cho mỗi cặp): `maskReasons.length===0` của dòng trong `list` **bằng** «lệnh từ chối không bị trả `READ_ONLY` hay `MANAGER_REQUIRED`».
- [ ] **L7 `when the content is returned every displayed field comes from the validated value: a row whose questions, confidence and sources columns say otherwise shows the value's; skillVersion and manifestHash only when they are the manifest's in force`** (cổng-R3) — một dòng chèn thô cho một tài liệu có thật, `value` là một đầu ra hợp lệ (`confidence:70`, `questions:[]`, `sources` nêu tài liệu), nhưng cột `questions` là `[{field:'x',question:MARK}]`, cột `confidence` là 5, cột `sources` nêu một uuid khác, `skill_version` là `'9.9.9'`, `manifest_hash` là `'d'.repeat(64)`. `pm` đọc: `maskReasons` là `[]`; `questions` bằng `[]`; `confidence` là 70; `sources` bằng `value.sources`; `skillVersion` là `null`; `manifestHash` là `null`; `modelVersion` là chuỗi đã lưu; `JSON.stringify` của câu trả lời không chứa `MARK`.
- [ ] **L8 `decide answers a reader without the authority the same way whatever valueHash is sent and whether or not the draft is decided`** (cổng-C5; N3) — nháp ứng viên; `member` gọi `decide` với hash sai (`'a'.repeat(64)`), với hash đúng, cho cả `confirmed` lẫn `rejected` (có lý do hợp lệ): cả bốn trả `MANAGER_REQUIRED` 403 với cùng câu. Sau khi `pm` đã quyết nháp đó: `member` với hash sai và hash đúng vẫn trả `MANAGER_REQUIRED` 403. `n('document_commands')` trước và sau các lời gọi của `member` bằng nhau. Đỏ hôm nay: hash sai trả `REVISION_CONFLICT`, nháp đã quyết trả `DRAFT_ALREADY_DECIDED`.
- [ ] **L9 `a stored value that does not fit the contract is masked as SCHEMA_INVALID even for a person who may decide`** — dòng chèn thô có `value` là một đầu ra hợp lệ thêm khoá `surprise: MARK`: `pm` nhận `maskReasons:['SCHEMA_INVALID']`, `value:null`, `sources:[]`, và câu trả lời không chứa `MARK`.
- [ ] Sửa kỳ vọng K1 và K2 đúng như bảng «Ca hiện có bị chạm».
- [ ] Chạy đỏ (L1, L3, L4, L7, L8, L9 đỏ vì `AssertionError`) → sửa → xanh: `npx vitest run tests/suggestions.test.ts`; `npm run typecheck`. Ca M12-2 («a stored value that cannot be hashed …») và cả nhóm `Z4 drafts: decide` phải xanh không sửa.

**Điểm commit** (phiên chính): `feat(suggestions): only a person who may decide a draft reads its content, and decide checks the authority first (OQ-45 1b)`.

---

### Task 4a: Xét lại lúc đọc theo mã nháp khai, và che (OQ-45 điểm 2) — **review riêng**, bắt buộc `liberico-security-reviewer`

(Bản 0.1 gọi là Task 4.)

**Tệp:** sửa `src/server/suggestions.ts`, `tests/suggestions.test.ts`.

**Giao diện**
```ts
import type {SkillContext} from './skill-contracts';
/** The hold reasons of the output gate that are about what the reader may read; the others never mask (OQ-45 point 2 (b)). */
const VISIBILITY:ReadonlySet<string>=new Set(['SCHEMA_INVALID','SOURCE_OUT_OF_CONTEXT','TEXT_NOT_VISIBLE']);
/** The context of one draft under this person's rights, or null when the entity is not in the project or the pair cannot be built. Any other error propagates. */
private async contextFor(tx:Queryable,p:Principal,projectId:string,r:{signal_type:SkillName;entity_type:EntityType;entity_id:string}):Promise<SkillContext|null>;
private async present(tx:Queryable,p:Principal,projectId:string,rows:DraftRow[],contexts?:Map<string,SkillContext|null>):Promise<DraftView[]>;
```
- `contextFor` là đúng khối `try { buildSkillContextIn(tx,p,{skill,projectId,documentId|candidateId},this.excerptChats) } catch` đang nằm trong `decide`: `AppError` mã `SCOPE_DENIED` hoặc `INVALID_INPUT` → `null`; lỗi khác ném lại. `decide` gọi `contextFor` thay cho khối đó (hành vi không đổi: `null` → `ENTITY_NOT_FOUND`).
- `present`, cho dòng mà người đọc có quyền quyết định: khoá bộ nhớ đệm là `` `${r.signal_type}:${r.entity_type}:${r.entity_id}` ``; chưa có thì gọi `contextFor` và lưu (kể cả `null`). Lý do, cộng vào `SCHEMA_INVALID` của Task 3: `null` → `ENTITY_NOT_FOUND`; ngược lại `ctx.pointerOnly` → `POINTER_ONLY_PROJECT`, và mọi mã của `checkSkillOutput({name,hash,toolAllowlist}, ctx, r.value).reasons` nằm trong `VISIBILITY`. Kết quả: không lý do → `toView(r,[],parsed.data)`; có lý do → `toView(r,[...lý do].sort(),null)`. Ngữ cảnh chỉ dùng để tính lý do; nó **không** dùng để lọc hay trả mã nguồn nào: dưới mọi lớp che `sources` là `[]` (N4). Dòng mà người đọc không có quyền: như Task 3, **không** gọi `contextFor`.
- `decide`: ngữ cảnh đã dựng ở nhánh `confirmed` được đặt vào một `Map` và truyền cho `present` ở câu trả lời cuối (không dựng lần hai). Nhánh `rejected` và đường phát lại không có sẵn ngữ cảnh: `present` tự dựng. Hệ quả phải biết: lệnh từ chối nay cũng dựng ngữ cảnh (cho câu trả lời); một lỗi lạ ở bước đó làm cả lệnh lùi, không ghi quyết định.
- Sửa helper `candidate` theo H6.

**Ca kiểm viết trước** (`tests/suggestions.test.ts`, nhóm mới `Z4 drafts: the content is re-checked at read time (OQ-45 point 2)`)

- [ ] **M1 `the content is masked when the reader cannot read the text of a message the draft cites`** — (i) tin được nhận khi nhóm **không** bật cờ (`candidate({excerpt:false})`: bản lưu ở chế độ chỉ con trỏ), nháp nêu tin đó và có `MARK` trong `claims`, `questions`; `pm` đọc bằng `svc()`: `maskReasons` bằng đúng `['TEXT_NOT_VISIBLE']`; `value`, `questions`, `confidence`, `skillVersion`, `modelVersion` là `null`; `sources` bằng đúng `[]` (dù tin nằm trong ngữ cảnh như một con trỏ); `valueHash` bằng `sha(output)`; câu trả lời không chứa `MARK` và không chứa mã của tin. (ii) tin được nhận khi nhóm bật cờ, rồi cờ bị gỡ — dịch vụ dựng bằng `svc(h.operator,[])` và bằng `new SuggestionService(h.db)` (danh sách mặc định): `maskReasons` **chứa** `TEXT_NOT_VISIBLE`, `value` là `null`, câu trả lời không chứa `MARK`. (iii) `svc()` với cờ còn: `maskReasons` là `[]` và `value` có `MARK`.
- [ ] **M2 `the content is masked once the project is pointer-only: mapped to IBS_HI after the draft was stored, for a document draft and a candidate draft; the latest row decides`** — một nháp tài liệu và một nháp ứng viên của `ids.sales`; `mapDomain(h,ids.sales,'IBS_HI',1)`: cả hai dòng có `value:null` và `maskReasons` chứa `POINTER_ONLY_PROJECT`; `mapDomain(h,ids.sales,'XECA',2)`: cả hai lại có `maskReasons:[]`.
- [ ] **M3 `what cannot be proven readable is masked: an id outside the rebuilt context, a source of another project, an entity that is gone, a pair the builder refuses`** — bốn dòng chèn thô, đọc bằng `pm`: (i) nháp tài liệu nêu chính tài liệu và một uuid không tồn tại → `['SOURCE_OUT_OF_CONTEXT']`; (ii) nháp tài liệu nêu một tài liệu của `ids.transport` → `['SOURCE_OUT_OF_CONTEXT']`; (iii) nháp tài liệu có `entity_id` ngẫu nhiên, đọc theo đúng mã đó → `['ENTITY_NOT_FOUND']`; (iv) `entity_type:'intake_candidate'` với một ứng viên có thật và `skill:'technical_writer'` → `['ENTITY_NOT_FOUND']`. Cả bốn: `value:null` và `sources` bằng đúng `[]` (ở (i), dù tài liệu nêu trong nháp có trong ngữ cảnh).
- [ ] **M4 `for a document draft a reason that is not about what the reader may read does not mask: an older manifest hash, a value hash that does not describe the value, an unsourced claim, a draft without sources`** — bốn dòng chèn thô **về một tài liệu** (cột `manifest_hash` khác; cột `value_hash` khác; một `claims` có `basis:[]`; `sources:[]`): `maskReasons` là `[]` và `value` được trả. (Các nháp này vẫn bị giữ lúc xác nhận — ca có sẵn. Với nháp ứng viên, nội dung không khai nguồn do Task 4b xử lý.)
- [ ] **M5 `the read context is built under the reader, once per skill, and never for a reader without the authority`** — ba nháp `intake_analyst` của một ứng viên, `pm` đọc: `vi.mocked(buildSkillContextIn).mock.calls` dài 1; đối số thứ hai có `id` của `pm`; đối số thứ ba khớp `{skill:'intake_analyst',projectId:ids.sales,candidateId}`; đối số thứ tư bằng `chats`. Một tài liệu có nháp của hai kỹ năng (`technical_writer`, `ba_elicitation`): 2 lần. `member` đọc danh sách nháp ứng viên: 0 lần.
- [ ] **M6 `an error the service does not understand is not turned into a mask: the read fails and returns nothing`** — `vi.mocked(buildSkillContextIn).mockRejectedValueOnce(boom)` với `boom = new AppError('CONTEXT_TOO_LARGE','x',500)`: `list` ném đúng `boom`.
- [ ] **M7 `decide answers with the same masked view: a rejection by a manager who cannot read the cited text is recorded, and its answer carries no content`** — nháp ứng viên có `MARK`; `decide(svc(h.operator,[]), pm, draftId, {result:'rejected', valueHash, reason:'Không đọc được nguồn'})`: `decision.result` là `rejected`; `maskReasons` chứa `TEXT_NOT_VISIBLE`; `value` là `null`; câu trả lời không chứa `MARK`; `draft_decisions` có 1 dòng.
- [ ] **M8 `under a mask sources is empty whatever the sources column names: ids of the rebuilt context, repeated and reordered, do not come back`** (cổng-C11 theo cách sửa 2; thay điều khẳng định của cổng-C2 lượt 1) — nháp ứng viên chèn thô: `value` nêu một tin có thật của luồng; cột `sources` gồm mã của một tài liệu có thật và mã của tin đó theo thứ tự **ngược** với ngữ cảnh, mã tin **lặp 60 lần**, cùng 30 mã dạng uuid lạ (tổng không quá 100 phần tử). Dịch vụ dựng với danh sách nhóm rỗng trên `recordingDb`; `pm` đọc: `value:null` và `sources` bằng **đúng `[]`**; `JSON.stringify` của câu trả lời không chứa mã tin, mã tài liệu hay mã lạ nào; không dòng nào trao cho dịch vụ chứa một mã lạ (cột `sources` không được đọc). Một dòng chèn thô khác cho một `entity_id` không tồn tại, cột `sources` nêu 50 mã lạ: `sources` là `[]`.
- [ ] **M9 `a replayed decision on a project that became pointer-only answers with the recorded decision and no content`** (cổng-C9) — nháp tài liệu của `ids.sales`; `pm` từ chối với khoá `K`; `mapDomain(h,ids.sales,'IBS_HI',1)`; gửi lại đúng lệnh với `K`: `decision.result` là `rejected` (cùng `decidedAt` với lần đầu), `maskReasons` bằng `['POINTER_ONLY_PROJECT']`, `value` là `null`; `draft_decisions` vẫn 1 dòng.
- [ ] Ca có sẵn «the context is built under the confirming person, not a wider principal» xanh **không sửa**; cả nhóm `Z4 drafts: decide` và `one idempotency claim per decision` xanh không sửa.
- [ ] Chạy đỏ (M1, M2, M3, M7, M8, M9 đỏ vì `AssertionError`) → sửa → xanh: `npx vitest run tests/suggestions.test.ts tests/skill-context.test.ts tests/skill-contracts.test.ts`; `npm run typecheck`.

**Điểm commit** (phiên chính): `feat(suggestions): re-check a draft at read time and mask what the reader cannot read (OQ-45 2b)`.

---

### Task 4b: Giữ chỗ của OQ-55 — nháp ứng viên bị che và bị giữ khi luồng có chữ đã lưu mà nay không được hiện — **review riêng**, bắt buộc `liberico-security-reviewer` (đường đọc bảng bản sửa của tin)

**Dừng tại OQ-55: đây là giữ chỗ fail-closed, không phải phương án được chọn.** Chỉ cho nháp ứng viên. Không viết mã tương tự cho nháp tài liệu.

**Tệp:** sửa `src/server/source-text.ts` (thêm một hàm), `src/server/suggestions.ts`, `tests/source-text.test.ts`, `tests/suggestions.test.ts`.

**Giao diện**
```ts
// src/server/source-text.ts — added
/**
 * True when the thread of one candidate of project $1 (same chat_id and thread_key, as visibleThreadMessages) holds at least one revision, of any
 * message, that stored text which the current configuration does not show: the group is not flagged, or the project's latest mapping is IBS_HI.
 * Every revision of every message of the thread is looked at: no cap, and not only the newest revision of a message.
 * A flag list that cannot be evaluated (a null element and no match) counts as not flagged: the test is IS NOT TRUE, never NOT.
 * One boolean: no text and no hash leave the database. A candidate or project id that is not a lower-case uuid gives true without a statement:
 * closed, because such an id is never a reason to show content.
 */
export async function threadHasHiddenText(tx:Queryable,projectId:string,candidateId:string,excerptChats:readonly string[]):Promise<boolean>;
```
Câu lệnh (tham số `[projectId, candidateId, [...excerptChats]]`; `textAllowedSql` là hàm có sẵn của tệp, tức cùng một luật với mọi chỗ hiển thị chữ):
```ts
`SELECT EXISTS(SELECT 1 FROM intake_candidates c
   JOIN source_events e ON e.project_id=c.project_id AND e.chat_id=c.chat_id AND e.thread_key=c.thread_key
   JOIN source_event_revisions r ON r.source_event_id=e.id
   WHERE c.id=$2::uuid AND c.project_id=$1::uuid AND e.project_id=$1::uuid AND r.project_id=$1::uuid
     AND r.content_mode='excerpt' AND (${textAllowedSql('e','$3')}) IS NOT TRUE) AS hidden`
```
`IS NOT TRUE`, không phải `NOT` (cổng-R8): khi biểu thức hiển thị không xác định — danh sách nhóm có một phần tử `null` và nhóm của luồng không khớp phần tử nào — thì coi là **không** được hiện, cùng hướng với nhánh `ELSE` của luật hiển thị có sẵn (`src/server/source-text.ts:30-32`). Lối tắt «mã không phải uuid» trả `true`, không trả `false`: `present` không tới được nhánh đó (mã lấy từ cột uuid), nhưng một câu trả lời «không che» không được là mặc định. Câu lệnh đã được planner chạy trên PGlite dưới role runtime với tin thật của đường nhận tin, ở cả hai dạng: với `NOT`, danh sách `[null]` trả `false`; với `IS NOT TRUE` trả `true`; các trường hợp khác giống nhau, đúng như bảng ở ca Q5 và Q8.

`src/server/suggestions.ts` (tệp này **không** viết tên bảng bản sửa của tin, kể cả trong chú thích):
- `present`, cho dòng mà người đọc có quyền quyết định và `r.entity_type==='intake_candidate'`: gọi `threadHasHiddenText(tx, projectId, r.entity_id, this.excerptChats)` **một lần cho mỗi đối tượng** trong một lần gọi (bộ nhớ đệm theo `r.entity_id`); đúng → thêm `THREAD_TEXT_HIDDEN` vào tập lý do. Không gọi cho nháp tài liệu, không gọi cho người không có quyền.
- `decide`, nhánh `confirmed`, trong khối `if(ctx)`, sau vòng `checkSkillOutput`: `if(d.entity_type==='intake_candidate' && await threadHasHiddenText(tx,projectId,d.entity_id,this.excerptChats)) reasons.add('THREAD_TEXT_HIDDEN');` (bất biến P3). Chú thích ở cả hai nơi nêu «OQ-55 placeholder».

**Ca kiểm viết trước** (`tests/suggestions.test.ts`, nhóm mới `Z4 drafts: OQ-55 placeholder — a thread with stored text that is no longer shown`; ba ca cuối ở `tests/source-text.test.ts`)

- [ ] **Q1 `dừng tại OQ-55: a candidate draft that names no message is masked once the stored text of its thread is no longer shown`** (cổng-C3) — tin được nhận khi nhóm bật cờ; nháp `intake_analyst` có `MARK` trong `claims[0].value`, `claims[0].basis` là `[]`, `sources` chỉ nêu một tài liệu của dự án. Dịch vụ dựng với danh sách nhóm rỗng, `pm` đọc: `maskReasons` bằng đúng `['THREAD_TEXT_HIDDEN']`; `value` là `null`; `sources` bằng đúng `[]`; câu trả lời không chứa `MARK` và không chứa mã tài liệu. `member` đọc cùng danh sách: đúng `['CONFIRM_AUTHORITY_REQUIRED']`. Dịch vụ dựng với cờ còn (`svc()`), `pm` đọc: `maskReasons` là `[]` và `value` có `MARK`. Đỏ sau Task 4a: `maskReasons` là `[]` khi danh sách nhóm rỗng.
- [ ] **Q2 `dừng tại OQ-55: a thread whose newest revision is pointer-only but an earlier revision stored text still masks its candidate drafts when the group is not flagged`** (cổng-C4) — tin được nhận khi nhóm bật cờ (bản 1 lưu chữ); rồi một bản sửa của chính tin đó được nhận bởi một `IntakeService` dựng với `excerptChats:[]` (bản 2 chỉ con trỏ) — kiểm trước bằng một câu đọc của login vận hành rằng hai bản có `content_mode` là `excerpt` rồi `pointer_only`. Nháp chỉ nêu một tài liệu. Dịch vụ dựng với danh sách nhóm rỗng: `maskReasons` bằng đúng `['THREAD_TEXT_HIDDEN']`. (Ngữ cảnh chỉ thấy bản mới nhất, là con trỏ: phép kiểm phải xét mọi bản.)
- [ ] **Q3 `dừng tại OQ-55: what is masked for that reason cannot be confirmed either`** (P3) — nháp `intake_analyst` sạch chỉ nêu một tài liệu (không `claims`); dịch vụ dựng với danh sách nhóm rỗng; `pm` xác nhận: `DRAFT_HELD` chứa `THREAD_TEXT_HIDDEN`; `zeroDecisions()`; khoá lệnh còn tự do (`n('document_commands')` không đổi). Lệnh **từ chối** cùng nháp đó ghi được quyết định. Thêm một dòng chèn thô có `value` lệch hợp đồng: xác nhận → `DRAFT_HELD` chứa `SCHEMA_INVALID` (mã che còn lại chưa có ca giữ riêng). Đỏ sau Task 4a: lệnh xác nhận nháp sạch thành công. Ca này **không** khẳng định điều gì về trường hợp cờ còn (Task 6 sẽ giữ nháp không nêu tin vì lý do khác).
- [ ] **Q4 `a draft that cites a message of such a thread carries both reasons`** — nháp nêu tin (có `MARK`), cờ nhóm đã gỡ: `maskReasons` bằng đúng `['TEXT_NOT_VISIBLE','THREAD_TEXT_HIDDEN']`.
- [ ] **Q9 `dừng tại OQ-55: a replayed confirmation of a candidate draft answers with the recorded decision and no content once the group's flag is gone`** (cổng-C13) — nháp ứng viên nêu tin của luồng, có `MARK` trong `claims` (căn cứ là tin đó); `pm` xác nhận bằng `svc()` (cờ còn) với khoá `K`; gửi lại **đúng** lệnh đó với `K` qua dịch vụ dựng với danh sách nhóm rỗng: `decision.result` là `confirmed` (cùng `decidedAt` với lần đầu); `maskReasons` chứa `THREAD_TEXT_HIDDEN`; `value` là `null`; `sources` là `[]`; câu trả lời không chứa `MARK`; `draft_decisions` vẫn 1 dòng. Đỏ sau Task 4a: `maskReasons` chưa có `THREAD_TEXT_HIDDEN`.
- [ ] **Q7 `dừng tại OQ-55: a document draft is not touched by the placeholder`** — một nháp tài liệu sạch của dự án có nhóm đã gỡ cờ và có tin lưu chữ: `maskReasons` là `[]`, `value` được trả, và lệnh xác nhận không bị giữ vì `THREAD_TEXT_HIDDEN`. Ghim rằng PR không viết mã cho nháp tài liệu (R16).
- [ ] **Q5** (`tests/source-text.test.ts`) **`threadHasHiddenText: every revision of every message of the thread, the current configuration, the caller's scope`** — tin nhận khi nhóm bật cờ: với danh sách có nhóm → `false`; với danh sách rỗng → `true`. Tin nhận khi nhóm không bật cờ (chỉ con trỏ): danh sách rỗng → `false`. Luồng có bản 1 lưu chữ và bản 2 chỉ con trỏ: danh sách rỗng → `true`; danh sách có nhóm → `false`. Dự án được ánh xạ `IBS_HI` sau khi lưu chữ: danh sách có nhóm → `true`. Ứng viên của `ids.sales` hỏi với `projectId` của `ids.transport` → `false`. Người gọi trong phạm vi của tenant khác (`outsider`) hỏi đúng `projectId` và mã ứng viên của `ids.sales` → `false`. Mã ứng viên `'x'` → `true` (lối tắt đóng), không lỗi `22P02`, không câu lệnh nào được gửi (kiểm bằng một tay nắm giả ném lỗi khi bị gọi). Đỏ trước khi có hàm là lỗi thiếu hàm xuất: không tính.
- [ ] **Q6** (`tests/source-text.test.ts`) **`threadHasHiddenText returns one boolean and no text: the one row handed back holds no excerpt and no content hash`** — gọi qua `recordingDb`: dòng ghi lại có đúng một khoá `hidden`; `JSON.stringify` không chứa chuỗi đánh dấu của tin và không chứa hash nội dung của nó.
- [ ] **Q8** (`tests/source-text.test.ts`) **`threadHasHiddenText is closed when the list of flagged groups cannot be evaluated`** (cổng-C12) — luồng có bản lưu chữ; gọi với danh sách nhóm `[null]` (ép kiểu trong test): `true`; với `[null, <một nhóm khác>]`: `true`; với `[null, <chính nhóm của luồng>]`: `false`. Luồng chỉ có bản chỉ con trỏ, danh sách `[null]`: `false` (không chữ nào được lưu). Đỏ trước khi có hàm là lỗi thiếu hàm xuất: không tính; builder kiểm thêm một lần rằng đổi `IS NOT TRUE` thành `NOT` làm ca này đỏ vì `AssertionError`, rồi đổi lại.
- [ ] Ca quét có sẵn của `tests/source-text.test.ts` (hai danh sách tệp nêu `text_excerpt` và bảng bản sửa) xanh **không sửa**.
- [ ] Chạy đỏ (Q1, Q2, Q3, Q4, Q9 đỏ vì `AssertionError`; Q7 là đối chứng) → sửa → xanh: `npx vitest run tests/suggestions.test.ts tests/source-text.test.ts tests/skill-context.test.ts tests/intake.test.ts`; `npm run typecheck`. Mọi ca M1–M9 của Task 4a xanh **không sửa**.

**Điểm commit** (phiên chính): `feat(suggestions): mask and hold a candidate draft while stored text of its thread is hidden (OQ-55 placeholder)`.

---

### Task 5: Giữ nháp tài liệu khi tài liệu có bản mới hơn bản mới nhất nháp nêu (OQ-46 b) — **review riêng**

**Tệp:** sửa `src/server/skill-contracts.ts` (thêm một hàm), `src/server/suggestions.ts`, `tests/skill-contracts.test.ts`, `tests/suggestions.test.ts`, `tests/suggestions-concurrency.test.ts`.

**Giao diện**
```ts
// src/server/skill-contracts.ts — added next to ID_FIELDS; it reuses the existing `collect`, nothing else changes
/** Every id a value names at every path of ID_FIELDS[skill], once each, in order of first appearance. A value that is not an output names nothing. */
export function namedIds(skill: SkillName, value: unknown): string[];

// src/server/suggestions.ts
const DOC_SUBJECT_SQL=`SELECT coalesce(max(v.revision_no),0)::int AS newest,
  coalesce(max(v.revision_no) FILTER (WHERE v.id = ANY($3::uuid[])),0)::int AS named
  FROM document_revisions v WHERE v.project_id=$1::uuid AND v.document_id=$2::uuid`;
/** OQ-46 (b): the draft's own subject against the newest thing the draft itself names. Codes only. */
async function subjectReasons(tx:Queryable,projectId:string,d:DraftRow):Promise<string[]>;
```
- `subjectReasons`: `named = namedIds(d.signal_type, d.value).filter(x=>UUID.test(x))` (biểu thức `UUID` chữ thường có sẵn trong tệp; **không** hạ chữ hoa). Nhánh `d.entity_type==='document'`: chạy `DOC_SUBJECT_SQL` với `[projectId, d.entity_id, named]`; `newest===0` → `[]`; `named===0` → `['SUBJECT_BASELINE_MISSING']` (giữ chỗ OQ-53 điểm 2; ghi chú thích nêu OQ-53); `newest>named` → `['SUBJECT_CHANGED']`; còn lại `[]`. Nhánh ứng viên ở task này trả `[]` (Task 6).
- Trong `decide`, nhánh `confirmed`, trong khối `if(ctx)`, sau phép kiểm `THREAD_TEXT_HIDDEN`: `for(const r of await subjectReasons(tx,projectId,d)) reasons.add(r);`. Không đổi gì khác của `decide`. Phép đọc chạy sau khi dòng tài liệu đã bị khoá (dòng 151 ở base).

**Ca kiểm viết trước** (`tests/suggestions.test.ts`, nhóm mới `Z4 drafts: a draft whose document moved on is held (OQ-46)`). `claims()` = `n('document_commands')`.

- [ ] **D1 `a document draft is held once the document has a revision newer than the newest one the draft names: no decision, no revision, the key stays free`** — `d=await doc()`; nháp `x` nêu `[d.record.id, d.record.latest_revision_id]`; một bản trình tay `d2=await proposeRev(h,pm,await fresh(d.record.id))`; ghi lại số bản, số khoá lệnh; `held(decide(svc(),pm,x.draftId,body(x.valueHash,{revision:revisionBody(d2)}),key),'SUBJECT_CHANGED')`; câu không chứa `SUBJECT_BASELINE_MISSING`; `zeroDecisions()`; số bản và số khoá lệnh không đổi; rồi một nháp mới nêu bản của `d2` được xác nhận **với cùng `key`**. Đỏ hôm nay: lệnh xác nhận thành công, «expected a refusal».
- [ ] **D2 `the newest revision the draft names is the baseline: naming r1 and r2 is confirmed while r2 is the newest; a revision of another document is not a baseline`** — tài liệu có r1, r2; nháp nêu `[tài liệu, r1, r2]` → xác nhận được. Tài liệu A có r1, r2 và tài liệu B có r1: nháp về A nêu `[A, A.r1, B.r1]` → `DRAFT_HELD` chứa `SUBJECT_CHANGED`.
- [ ] **D3 `dừng tại OQ-53 (2): a document draft that names no revision of its own document is held as SUBJECT_BASELINE_MISSING once the document has a revision; a document with no revision yet is not held for it`** — nháp chỉ nêu `[d.record.id]` trên tài liệu có r1 → `DRAFT_HELD` chứa `SUBJECT_BASELINE_MISSING`, không chứa `SUBJECT_CHANGED`. Tài liệu vừa đăng ký (`registerDoc`, chưa có bản) với nháp chỉ nêu mã tài liệu → xác nhận được với `revisionBody` của chính nó (`basedOnRevisionId:null`), tạo bản số 1.
- [ ] **D4 `a held draft can still be rejected, and a recorded confirmation replays unchanged after the document moves on`** — nháp đã cũ: lệnh từ chối ghi được quyết định `rejected`. Nháp khác được xác nhận với khoá `K`; thêm một bản trình tay; gửi lại đúng lệnh với `K` → bằng câu trả lời đầu; `draft_decisions` của nháp đó vẫn 1 dòng.
- [ ] **D5 `an id that is not a lower-case uuid names nothing: the upper-case id of the newest revision is not a baseline`** — dòng chèn thô nêu `[d.record.id, <mã bản mới nhất viết hoa>]` → `DRAFT_HELD` chứa `SUBJECT_BASELINE_MISSING`.
- [ ] **D6** (`tests/skill-contracts.test.ts`) **`namedIds returns every id at every id-bearing path of the skill, once each, and nothing for a value that is not an output`** — với `doc_reviewer` (hai trường bản), `release_librarian` (bốn đường dẫn), `intake_analyst` (`duplicateOf`) và các đường dẫn chung (`sources`, `claims.*.basis`, `conflicts.*.sourceIds`): tập trả về bằng đúng tập mã đã đặt; một mã lặp chỉ trả một lần; `namedIds('intake_analyst', null)`, `(…, 'x')`, `(…, {sources:'nope'})` → `[]`. Đỏ trước khi có hàm là lỗi thiếu hàm xuất: không tính.
- [ ] Sửa hạ tầng H4, H5 và kỳ vọng K3 đúng như bảng «Ca hiện có bị chạm».
- [ ] Chạy đỏ (D1, D2 phần hai, D3 phần đầu, D5 đỏ vì `AssertionError`) → sửa → xanh: `npx vitest run tests/suggestions.test.ts tests/skill-contracts.test.ts tests/skills-eval.test.ts tests/documents.test.ts tests/document-cases.test.ts`; `npm run typecheck`. Mọi ca có sẵn của `tests/suggestions.test.ts` ngoài H4 phải xanh **không sửa `expect` nào**.
- [ ] Phiên chính chạy `tests/suggestions-concurrency.test.ts` trên PostgreSQL 16 thật (tệp này chỉ chạy native).

**Điểm commit** (phiên chính): `feat(suggestions): hold a document draft once its document has a revision newer than the newest it names (OQ-46 b; OQ-53 placeholder)`.

---

### Task 6: Giữ nháp ứng viên khi luồng đã đi tiếp (OQ-46 b) và giữ chỗ của OQ-53 — **review riêng**, bắt buộc `liberico-security-reviewer` (đường đọc bảng bản sửa của tin)

**Tệp:** sửa `src/server/source-text.ts` (thêm một hàm), `src/server/suggestions.ts`, `tests/source-text.test.ts`, `tests/suggestions.test.ts`, `tests/slice3-fixtures.ts` (thêm helper `nextDbInstant`).

**Giao diện**
```ts
// src/server/source-text.ts — added
export type ThreadFreshness={hasBaseline:boolean;newerMessage:boolean;laterEdit:boolean};
/**
 * For the thread of one candidate of project $1 (same chat_id and thread_key, as visibleThreadMessages) and the ids a draft names:
 * hasBaseline = the draft names at least one message of this thread; the baseline is the latest created_at among those;
 * newerMessage = a message of the thread the draft does not name was recorded at or after the baseline;
 * laterEdit = a later revision (revision_no > 1) of any message of the thread was recorded at or after the baseline.
 * Reads ids and record times only: no text and no hash leave the database. Ids that are not lower-case uuids are ignored.
 */
export async function threadFreshness(tx:Queryable,projectId:string,candidateId:string,namedIds:readonly string[]):Promise<ThreadFreshness>;
```
Câu lệnh (tham số `[projectId, candidateId, <các mã đã lọc uuid chữ thường>]`):
```sql
WITH thread AS (
  SELECT e.id, e.created_at FROM intake_candidates c
  JOIN source_events e ON e.project_id=c.project_id AND e.chat_id=c.chat_id AND e.thread_key=c.thread_key
  WHERE c.id=$2::uuid AND c.project_id=$1::uuid AND e.project_id=$1::uuid),
base AS (SELECT max(t.created_at) AS at FROM thread t WHERE t.id = ANY($3::uuid[]))
SELECT (SELECT b.at IS NOT NULL FROM base b) AS has_baseline,
  EXISTS(SELECT 1 FROM thread t, base b WHERE NOT (t.id = ANY($3::uuid[])) AND t.created_at >= b.at) AS newer_message,
  EXISTS(SELECT 1 FROM source_event_revisions r JOIN thread t ON t.id=r.source_event_id, base b
         WHERE r.project_id=$1::uuid AND r.revision_no>1 AND r.created_at >= b.at) AS later_edit
```
`candidateId` không phải uuid chữ thường → trả `{hasBaseline:false,newerMessage:false,laterEdit:false}` mà không chạy câu lệnh. Câu lệnh không có điều kiện `tenant_id` riêng: phạm vi tenant do RLS của ba bảng giữ (ca T8). Câu lệnh đã được planner chạy trên PGlite dưới role runtime với tin thật của đường nhận tin (tin gốc, tin trả lời, bản sửa), và dưới phạm vi của một tenant khác: kết quả đúng như bảng ở ca T7, T8.

`src/server/suggestions.ts`, nhánh ứng viên của `subjectReasons`: `f = await threadFreshness(tx, projectId, d.entity_id, named)`; `!f.hasBaseline` → `['SUBJECT_BASELINE_MISSING']` (giữ chỗ OQ-53 điểm 2); ngược lại `[...(f.newerMessage?['SUBJECT_CHANGED']:[]), ...(f.laterEdit?['SUBJECT_EDIT_UNVERIFIED']:[])]` (mã thứ hai là giữ chỗ OQ-53 điểm 1; chú thích nêu OQ-53). Tệp `suggestions.ts` **không** viết tên bảng bản sửa của tin, kể cả trong chú thích.

**Dựng dữ liệu trong test** (`tests/suggestions.test.ts`): helper `candidate()` đã trả `event` (H6, Task 4a). Tin trả lời cùng luồng: `messageEvent({text, context:{chatId:chatSales, replyToMessageId:c.event.context.messageId}})`. Bản sửa của một tin: gửi lại `{...c.event, text:<chữ mới>, contentHash:<sha256 của chữ mới>, editedAt:<observedAt + 60 giây>, traceId:randomUUID()}`. Khi một ca cần hai dòng có thời điểm ghi **khác nhau chắc chắn**, gọi `nextDbInstant(h)` giữa hai lần ghi — helper mới, xuất từ `tests/slice3-fixtures.ts`: lặp `SELECT now()::text` (qua `h.operator`) cho tới khi giá trị đổi, mỗi vòng chờ 2 ms (PGlite chỉ có độ phân giải mili giây).

**Ca kiểm viết trước** (`tests/suggestions.test.ts`, nhóm mới `Z4 drafts: a draft whose thread moved on is held (OQ-46)`; mọi ca dùng `svc()` với cờ nhóm còn)

- [ ] **T1 `a candidate draft is held once its thread has a message recorded after the newest message the draft names: no decision, the key stays free; a new draft that names the new message is confirmed`** — nháp nêu tin gốc; một tin trả lời đến; `held(decide(svc(),pm,draftId,body(valueHash),key),'SUBJECT_CHANGED')`; câu không chứa `SUBJECT_EDIT_UNVERIFIED`; `zeroDecisions()`; số khoá lệnh không đổi; nháp mới nêu cả hai tin được xác nhận với cùng `key`. Đỏ hôm nay: «expected a refusal».
- [ ] **T2 `a message the draft does not name, recorded before the newest one it names, does not hold it`** — tin gốc; `nextDbInstant(h)`; tin trả lời; nháp chỉ nêu tin trả lời → xác nhận được.
- [ ] **T3 `dừng tại OQ-53 (1): an edit recorded at or after the newest named message holds the draft as SUBJECT_EDIT_UNVERIFIED, also when the edit was already there when the draft was written; an edit recorded before the newest named message does not`** — (i) nháp nêu tin gốc, rồi tin gốc được sửa → `DRAFT_HELD` chứa `SUBJECT_EDIT_UNVERIFIED`, không chứa `SUBJECT_CHANGED`; (ii) tin gốc, bản sửa của nó, rồi mới ghi nháp nêu tin gốc → vẫn `SUBJECT_EDIT_UNVERIFIED` (ghim cái giá của giữ chỗ); (iii) tin gốc, bản sửa, `nextDbInstant(h)`, tin trả lời, nháp nêu cả hai tin → xác nhận được.
- [ ] **T4 `dừng tại OQ-53 (2): a candidate draft that names no message of its own thread is held as SUBJECT_BASELINE_MISSING`** — nháp `intake_analyst` chỉ nêu một tài liệu của dự án → `DRAFT_HELD` chứa `SUBJECT_BASELINE_MISSING`; nháp nêu tin của một luồng **khác** → chứa `SUBJECT_BASELINE_MISSING` (và `SOURCE_OUT_OF_CONTEXT`).
- [ ] **T5 `a held candidate draft can still be rejected; a recorded confirmation replays unchanged after a new message arrives`**.
- [ ] **T6** (`tests/source-text.test.ts`) **`threadFreshness returns three booleans and no text: the one row handed back holds no excerpt and no content hash`** — gọi qua `recordingDb`: các dòng ghi lại có đúng ba khoá `has_baseline`, `newer_message`, `later_edit`; `JSON.stringify` không chứa chuỗi đánh dấu của tin và không chứa hash nội dung của nó.
- [ ] **T7** (`tests/source-text.test.ts`) **`threadFreshness: baseline, newer message, later edit, another project, malformed ids`** — luồng một tin: nêu tin đó → `{true,false,false}`; không nêu gì → `{false,false,false}`; nêu một uuid lạ → `{false,false,false}`. Gọi `nextDbInstant(h)` rồi nhận một tin trả lời: chỉ nêu tin gốc → `newerMessage:true`; chỉ nêu tin trả lời → `{true,false,false}`; nêu cả hai → `{true,false,false}`. Thêm bản sửa của tin gốc: nêu cả hai → `{true,false,true}`. Ứng viên của `ids.sales` hỏi với `projectId` của `ids.transport` → `hasBaseline:false`. `namedIds` chứa `'x'` và một mã viết hoa → bị bỏ qua, không lỗi `22P02`. Đỏ trước khi có hàm là lỗi thiếu hàm xuất: không tính.
- [ ] **T8** (`tests/source-text.test.ts`) **`threadFreshness reads nothing for a caller scoped to another tenant`** (cổng-C10) — luồng của `ids.sales` có tin gốc và một bản sửa; trong một giao dịch `scoped` của `outsider` (tenant khác), gọi với đúng `projectId` của `ids.sales`, đúng mã ứng viên và mã tin: `{hasBaseline:false,newerMessage:false,laterEdit:false}`. Cùng lời gọi dưới phạm vi của `pm` → `hasBaseline:true`, `laterEdit:true` (đối chứng rằng dữ liệu có thật).
- [ ] Ca quét có sẵn của `tests/source-text.test.ts` (hai danh sách tệp nêu `text_excerpt` và bảng bản sửa) xanh **không sửa**.
- [ ] Chạy đỏ (T1, T3, T4 đỏ vì `AssertionError`) → sửa → xanh: `npx vitest run tests/suggestions.test.ts tests/source-text.test.ts tests/skill-context.test.ts tests/intake.test.ts tests/inbox-service.test.ts`; `npm run typecheck`. Ca Q3 của Task 4b phải xanh không sửa.

**Điểm commit** (phiên chính): `feat(suggestions): hold a candidate draft once its thread moved past the newest message it names (OQ-46 b; OQ-53 placeholders)`.

---

### Task 7: Kiểm toàn bộ — không review riêng

Không sửa mã. Builder chạy và trả số liệu; phiên chính ghi log bằng chứng (thay đường dẫn máy bằng `<repo>` lúc ghi) và chạy lượt native.

- [ ] `npx vitest run` (cả bộ, PGlite): không ca đỏ; số ca đạt bằng 1 104 cộng số ca mới của Task 1–6; số bỏ qua vẫn 62 (kế hoạch không thêm ca `skipIf(!native)` nào).
- [ ] `npm run typecheck`; `npx vitest run --coverage` giữ bốn ngưỡng 60 %, và `src/server/suggestions.ts`, `src/server/source-text.ts`, `src/server/skill-contracts.ts` không tụt so với base (so từng dòng của bảng theo tệp, không so tổng).
- [ ] Canh phạm vi: `git diff --name-only 4f12a3c -- src/app src/components bot-plugin skills AGENTS.md CLAUDE.md src/server/skill-context.ts src/server/ai-scope.ts src/server/skills.ts vitest.config.ts` rỗng; `git diff --name-only 4f12a3c -- migrations` đúng hai tệp 022; `git diff 4f12a3c -- src/server/skill-contracts.ts` chỉ có dòng thêm.
- [ ] Canh ca: `git diff 4f12a3c -- tests/suggestions.test.ts tests/z4-schema.test.ts` không chạm thân của các ca canh nêu ở B1 và ca «no route imports the suggestion service, …»; mọi dòng `expect` bị sửa thuộc đúng K1, K2, K3.
- [ ] `/usr/bin/grep -rn "LTZ01" src migrations` chỉ ra đúng hai nơi (tệp 022 và hằng `POINTER_ONLY_SQLSTATE`). `/usr/bin/grep -rln "source_event_revisions" src` chỉ ra đúng `src/server/intake.ts` và `src/server/source-text.ts`.
- [ ] Phiên chính: cả bộ trên PostgreSQL 16 thật (CSDL thử riêng của PR): 1 166 cộng số ca mới, 0 bỏ qua; gồm `tests/suggestions-concurrency.test.ts` và các ca G5, G7, G9, G14, G15.
- [ ] Phiên chính lập bảng ca âm theo mục «Bảng: yêu cầu → ca» dưới đây và chép mục B6 cùng mục «Giới hạn đã biết» vào biên nhận.

**Điểm commit** (phiên chính): `docs(oq-45-46): full verification logs and the negative-case table`.

---

## Bảng: yêu cầu → ca

| Yêu cầu | Ca |
|---|---|
| Người đọc không có quyền xác nhận không nhận `value` (cả hai loại nháp, từng vai S11; `viewer`, `bot` vẫn 404) | L1, L2, L3, L6 |
| … và không nhận thứ gì do bên ghi chọn qua trường khác | L3, L4 |
| … và không thử được `valueHash` qua `decide` | L8 |
| `value` bị che khi người đọc không đọc được chữ của tin (cờ nhóm gỡ, `excerptChats` rỗng) | M1, Q4 |
| `value` bị che khi dự án chỉ con trỏ (ánh xạ sang `IBS_HI` sau khi nháp đã lưu) | M2, M9 |
| Bản chép của nội dung không thành đường rò thứ hai; `sources` rỗng dưới mọi lớp che | L1, L3, L4, L7, L9, M1, M3, M8, Q1 |
| Nháp ứng viên không khai nguồn ở luồng có chữ đang ẩn (giữ chỗ OQ-55) | Q1, Q2, Q3, Q5, Q8, Q9 |
| Điều bị che thì không xác nhận được | Q3; ca có sẵn «the confirmer's own scope decides: …», «a draft of an IBS HI project cannot be confirmed», «R12-i …» |
| Ghi nháp cho dự án `IBS_HI` bị từ chối, qua dịch vụ | S1, S2 |
| … và chèn thô dưới role AI; dự án chưa ánh xạ và nhãn khác vẫn ghi được | G1, G2, G3, G5, G14, S3 |
| Nháp tài liệu có đối tượng đã đổi bị giữ; không dòng quyết định, không bản tài liệu, khoá lệnh còn tự do | D1, D2 |
| Nháp ứng viên có luồng đã có tin mới bị giữ; như trên | T1 |
| Đọc và ghi chéo tenant, chéo dự án bị chặn | L2, M3 (ii), G4, S4, Q5, T8; ca có sẵn «the AI principal cannot decide a draft; …», «R12-f …», «the AI role writes drafts only inside its tenant, project and principal» |
| Quality Gate 34a (đọc) cho đối tượng mới | G8, G13 |
| 34b (ghi, `WITH CHECK`) | G4, G9, G15; ca có sẵn «the AI role writes drafts only inside …» |
| 34c (xoá, sửa chéo) | G10 |
| 34d (không ngữ cảnh ⇒ fail-closed) | G7, G11 |
| 34e (không `BYPASSRLS`; không đường vòng) | G6, G8; ca có sẵn «the role exists as NOLOGIN, …» |
| Migration idempotent và có rollback (M-02, M-03); trigger đúng kiểu và đang bật | G12, RB1 |

## Dừng và chỗ chưa chắc

1. (Mục 1 của bản 0.1 — vai đọc không có quyền vẫn thấy dòng nháp — nay là cách hiểu **C8**, theo cổng-R7.)
2. **Thứ tự «trigger trước RLS, trước ràng buộc, trước phép dò trùng» trên PostgreSQL 16** mới đo trên PGlite; cổng lượt 1 xác nhận phần «trước `WITH CHECK`» từ tài liệu. G5, G7, G9, G14, G15 chạy native sẽ xác nhận. Nếu native cho thứ tự khác thì các ca đó đỏ: **dừng và báo**, không sửa ca.
3. **Câu chữ của cổng-C8 so với điều đo được.** Cổng ghi: dòng thiếu `tenant_id` hay `project_id` thì «lỗi là lỗi ràng buộc». Đo trên PGlite: dưới role AI câu trả lời là lỗi của RLS (42501), vì `WITH CHECK` chạy trước NOT NULL (đúng thứ tự mà chính cổng nêu ở mục «Đã kiểm»); dưới login vận hành mới là 23502. Ca G15 khẳng định cả hai; ở cả hai, câu trả lời không phải của guard — đúng ý của cổng. Planner áp mục này với câu chữ chính xác hơn, không bỏ.
4. **`valueHash` cho người có quyền quyết định khi nháp bị che** (R3): cần để từ chối. Nếu cổng muốn rút, lệnh từ chối phải thôi đòi `valueHash` — đổi hợp đồng của `decide`, ngoài kế hoạch này. **Bản 0.9:** cổng Codex vòng 2 đòi rút đúng thứ này; Task G1 làm điều câu trên gọi là «ngoài kế hoạch này» — lệnh từ chối một nháp bị che thôi đòi `valueHash` (09.4).
5. **Giữ chỗ OQ-53 điểm 1 giữ oan nhiều** ở các nhóm hay sửa tin ngay sau khi gửi. Z4 chưa bật nên chưa ai chịu cái giá đó; phải có quyết định trước khi bật.
6. **Đồng hồ.** Mốc của luồng tin dùng `created_at` (bắt đầu giao dịch), không dùng thời điểm commit; R6 nêu khe hở với kích thước đúng.
7. **`release_librarian`** gần như không xác nhận được nháp tài liệu khi tài liệu có bản trình chưa duyệt (C7). Đúng chữ quyết định; nêu để Chairman biết.
8. **Quyền theo phiên, không đọc lại từ CSDL danh tính** (R7): giữ đúng cách `decide` đang làm. Cổng lượt 1 chưa soát đường dựng `Principal` từ phiên. Nếu cổng yêu cầu đọc lại thì đó là thay đổi cho cả `decide`.
9. **Số dòng trích từ `src/server/suggestions.ts`** (dòng 151) là ở base `4f12a3c`; sau Task 2–4 đã lệch. Builder định vị theo chữ («FOR UPDATE» trên `document_records`).
10. **Lệnh từ chối nay dựng ngữ cảnh** để che câu trả lời (C3). Nếu cổng thấy không nên để một lệnh thu hẹp phụ thuộc bước đó, lối khác là `decide` luôn trả câu trả lời không có nội dung — đổi hợp đồng của `decide` nhiều hơn mức quyết định đòi; planner không chọn.
11. **Hồ sơ sau khi có mã.** Hai dòng «Chưa có mã cho quyết định này» (`docs/OPEN-QUESTIONS.md:671`, `:687`), dòng `:861` và mục «Câu hỏi mở chưa quyết» của `docs/DELIVERY-012-review-skills-20261115.md:217-218` sẽ cũ sau khi PR merge. Phiên chính ghi trạng thái mới (thêm ở cuối tệp, không chèn giữa); kế hoạch này không giao việc đó cho builder.
12. **Với nháp tài liệu, hành vi của PR ở OQ-55 không phải hướng chặt nhất** (R16). Phán quyết của phiên chính đặt giữ chỗ cho nháp ứng viên; hướng chặt nhất cho nháp tài liệu (che mọi nháp tài liệu của dự án khi dự án có chữ đang ẩn) là phương án (e) của OQ-55 và chưa ai chọn. Nêu để cổng và Chairman biết.
13. **`sources` dưới lớp che — đã khép ở bản 0.3** (N4 của cổng lượt 2; phán quyết của phiên chính): `[]` dưới mọi lớp che, cột `sources` không được đọc. Dưới lớp che, thứ duy nhất do bên ghi chọn còn tới người có quyền quyết định là `valueHash` (R3, R15). Cái giá: người có quyền quyết định nhìn một nháp bị che không còn thấy nháp nêu nguồn nào, chỉ thấy mã lý do (C9).
14. **`modelVersion` không có tập đóng để so** (P12, R17). Nếu cổng muốn chặt hơn trước khi có bảng mô hình được duyệt (OQ-14) thì trường này luôn là `null`; planner không tự rút vì người nhận nó đã nhận cả `value`.

## Giới hạn đã biết (phiên chính chép vào biên nhận)

Mục B6 (R1–R19) nguyên văn, cùng các điểm: Z4 vẫn chưa bật và không tuyến HTTP nào đọc nháp; 022 chưa áp ở đâu ngoài CSDL thử; `AGENTS.md` không sửa (dòng Z4 «not enabled» vẫn đúng).

**Trước khi thêm tuyến đọc nháp hoặc bật Z4** — ngoài bốn điều kiện ở ghi chú 3 của khối quyết định (`docs/OPEN-QUESTIONS.md:865`):

1. OQ-53, OQ-54 và OQ-55 có quyết định.
2. **Pipeline từ chối khởi động khi guard vắng hoặc bị tắt** (cổng-R4): một phép kiểm lúc khởi động, cùng kiểu với `assertRestrictedLogin`, rằng trigger `ai_drafts_pointer_only_guard` tồn tại trên `intelligence.ai_drafts`, `tgenabled='O'`, là `BEFORE INSERT … FOR EACH ROW`, và hàm của nó còn `SECURITY DEFINER` với hai thiết lập đã ghim. PR này chưa có pipeline nên chưa có chỗ đặt phép kiểm đó.
3. **Tuyến nào về sau gọi `submitDraft` phải bọc lỗi CSDL thô**: hôm nay chỉ `LTZ01` được dịch, mọi lỗi khác đi nguyên tới người gọi.
4. Dịch vụ được dựng với đúng danh sách nhóm hiện chữ của đường nhận tin (khoảng trống 42; R9).
5. Khoảng trống 41 (khoá khử trùng đã dùng ở dự án khác) có quyết định.
6. Cổng soát đường dựng `Principal` từ phiên (R7).

## Sau các lượt review theo task (bản 0.4; phán quyết của phiên chính, không phải quyết định của Chairman)

Sáu lượt review theo task, báo cáo ở `docs/reviews/oq-45-46-evidence-20261118/gates/`:

| Task | Reviewer | Tệp báo cáo | Đúng yêu cầu | Chất lượng | Critical · Important · Minor |
|---|---|---|---|---|---|
| 1, 2 | `liberico-database-reviewer` | `review-task-1-2-database.md` | đạt | Approved | 0 · 1 · 6 |
| 1, 2 | `liberico-security-reviewer` | `review-task-1-2-security.md` | đạt | Approved | 0 · 0 · 6 |
| 3 | `liberico-security-reviewer` | `review-task-3-security.md` | đạt | Approved | 0 · 0 · 5 |
| 4a, 4b | `liberico-security-reviewer` | `review-task-4a-4b-security.md` | đạt | Needs fixes (ca kiểm) | 0 · 1 · 6 |
| 5 | `liberico-code-reviewer` | `review-task-5-code.md` | đạt | Needs fixes (ca kiểm) | 0 · 1 · 5 |
| 6 | `liberico-security-reviewer` | `review-task-6-security.md` | đạt | Needs fixes (ca kiểm) | 0 · 1 · 4 |

Bốn mục Important: một là nghĩa vụ ghi chú triển khai (đường phục hồi data-only cho guard xét lại từng dòng nháp), ba là ca kiểm chưa chứng minh điều tên ca nói. Không mục nào đòi đổi một quyết định hay một phương án của câu hỏi mở.

**Đo trên PostgreSQL 16.15** (CSDL thử riêng của PR, dữ liệu tổng hợp; phiên chính đo ngày 18/11/2026 sau khi hai reviewer ghi các điểm này là «suy luận, chưa đo»):

1. Một giao dịch của role AI mở **trước** khi ánh xạ `IBS_HI` được commit và chèn nháp **sau** đó: ở REPEATABLE READ và SERIALIZABLE nháp **được lưu**; ở READ COMMITTED bị từ chối `LTZ01`. Guard của bản 0.3 vì vậy đi vòng được bằng cách giữ một ảnh chụp cũ.
2. Bản data-only tạo bằng lệnh của `docs/DEPLOY-002.md:19`: trong danh sách của `pg_restore --list`, dữ liệu của `intelligence.ai_drafts` đứng thứ 27, của `public.project_domain_mappings` đứng thứ 53 trên 61 bảng. Nháp được nạp trước ánh xạ, nên lúc phục hồi guard không thấy ánh xạ nào và cho mọi dòng qua.
3. `to_regclass` và `to_regprocedure` trả `NULL` khi schema không còn: tệp lùi 022 chạy lại được sau khi 021 đã lùi.
4. `COPY … FROM STDIN` dưới role `libetech_ai`: `0A000` («COPY FROM not supported with row-level security»); dưới login vận hành cho một dự án `IBS_HI`: `LTZ01`.

**Đợt sửa** (một vòng sửa cho Task 1, 3, 4b, 5, 6; trần ba vòng mỗi task):

- **Guard từ chối giao dịch không ở READ COMMITTED** bằng SQLSTATE `LTZ02`, câu «An AI draft is written in a READ COMMITTED transaction», bất kể dự án. Dịch vụ không dịch `LTZ02`: nó nghĩa là login của pipeline cấu hình sai. Ca G16, G17 (hai kết nối, chỉ native). Khối SQL của Task 1 ở trên đã được thay bằng đúng nội dung tệp.
- Ca bổ sung ở tầng CSDL: G18 (`MERGE` bị xét như `INSERT`), RB2 (tệp lùi 022 chạy lại khi schema không còn), G12 ghim thân hàm, G8 so theo oid, RB1 thôi nuốt lỗi.
- Ca bổ sung ở dịch vụ: D2 nửa sau viết lại (bản của tài liệu khác không phải mốc), D7 (mốc nêu ở trường không phải `sources`), D8 (mã sai dạng không thành lỗi CSDL), M10 (người không có quyền và nháp tài liệu không gây câu đọc bảng tin), các kịch bản thêm của Q5 (tin trả lời lưu chữ; luồng dài hơn 20 tin), T9–T14 (đồng hồ ghi chứ không phải `observedAt`; bản sửa của tin không được nêu; trùng thời điểm; điều kiện dự án của chính câu lệnh; mã dự án sai dạng; không trần), hai ca thứ tự trong `tests/suggestions-concurrency.test.ts` (trình tay chờ trước; xác nhận chờ trước), các khẳng định thêm ở L3, L4, L6, S1.
- Ba sửa nhỏ trong mã: `threadHasHiddenText` đóng khi không có dòng trả về; `toView` tự sắp mã và không bao giờ trả nội dung khi không có giá trị đã qua lược đồ; đổi tên một biến trong `subjectReasons`.

**Phần dư bổ sung** (đọc cùng B6; phiên chính chép vào biên nhận):

- **R20** · Phục hồi data-only (đường cài đặt có sẵn: `deploy/install-user.py`, `deploy/install-d1.sh`, `docs/DEPLOY-002.md:19`) chạy với trigger bật. Theo phép đo 2, guard không xét được dòng nháp nào lúc phục hồi vì ánh xạ được nạp sau. Hai hệ quả: lần phục hồi không bị lùi vì một nháp lưu trước khi dự án thành `IBS_HI`; và guard không phải lưới cho dữ liệu được phục hồi. Nếu thứ tự nạp đổi (phiên bản `pg_dump` khác, thêm khoá ngoại giữa hai bảng) thì một nháp như vậy làm lùi cả lần phục hồi; `--disable-triggers` tắt luôn các trigger bất biến và là việc cần người quyết. **Bản 0.7 (DB-4 của review CSDL trên vòng sửa; khoá dòng của Task F1b):** trong phục hồi một giao dịch, guard và trigger của bảng ánh xạ khoá dòng dự án do chính giao dịch đó vừa chèn — không chờ, và không chiếm chỗ nào trong bộ nhớ khoá dùng chung (khác thiết kế khoá tư vấn của bản 0.6). Thứ tự «dự án, nháp, ánh xạ, nháp» trong một giao dịch đã đo trên PostgreSQL 16.15 là không lỗi. Dòng dự án phải được nạp **trước** nháp và ánh xạ: guard nay từ chối `23503` một dòng mà nó không thấy dòng dự án (khoá ngoại vốn cũng buộc thứ tự đó). Phục hồi **song song** (`-j`) có thêm hai kiểu hỏng: một lệnh `COPY` chờ lệnh kia quá 5 giây → `55P03`; hai lệnh chờ vòng → `40P01`; thiếu `--exit-on-error` thì kết quả là một bảng thiếu dữ liệu. Hai đường cài đặt của repo chạy một giao dịch, không `-j`.
- **R21** · Login của pipeline phải giữ `default_transaction_isolation = read committed`. Khác đi thì mọi lệnh ghi nháp bị từ chối `LTZ02` (đóng). Phần dư R5 chỉ còn cửa sổ giữa câu đọc của guard và lúc commit của lệnh chèn.
- **R22** · Sau một lệnh chèn thành công, giao dịch của role AI giữ `AccessShareLock` trên `public.project_domain_mappings` tới khi kết thúc: nó chặn được DDL trên bảng đó, không chặn lệnh ghi dòng.
- **R23** · Mỗi lần guard từ chối là một dòng `ERROR` trong log máy chủ PostgreSQL. Nội dung của nháp bị từ chối (tham số của lệnh chèn) nằm lại trong log nếu `log_parameter_max_length_on_error` khác 0, hoặc `log_statement` / `log_min_duration_statement` ghi kèm tham số. Mặc định của PostgreSQL là không ghi tham số.
- **R24** · Bổ sung cho R15: `createdAt` (tới mili giây) tới cả người không có quyền quyết định, và thời điểm chèn là thứ bên ghi chọn được.
- **R25** · Người không có quyền quyết định gọi `decide` vẫn lấy khoá nháp, kéo `value` vào tiến trình Node và giữ chỗ khoá lệnh trước khi bị từ chối. Không lộ gì ra câu trả lời. Không đổi vì thứ tự trước khoá lệnh là hợp đồng khử trùng của lát 3; cần giới hạn tần suất khi có tuyến.
- **R26** · Ngữ cảnh trao cho pipeline `observedAt` của từng tin, không trao thời điểm ghi. Nháp ứng viên vì vậy chỉ chắc chắn xác nhận được khi nêu **mọi** tin của luồng có trong ngữ cảnh. Luồng dài hơn 20 tin có một tin đến muộn nằm ngoài cửa sổ ngữ cảnh: không nháp nào xác nhận được cho tới khi luồng có tin mới hơn. Tin ghi sau cùng được lưu ở chế độ chỉ con trỏ: nêu thì `TEXT_NOT_VISIBLE`, không nêu thì `SUBJECT_CHANGED`. Cả ba là hướng chặt.
- **R27** · Chính xác hơn cho R6: trần 10 giây là của mỗi câu lệnh, không phải của khe hở; các tin đầu của một luồng đến cùng lúc (album) đảo thứ tự bắt đầu và commit là chuyện thường; bản sửa có cùng khe hở; một tin mà giao dịch nhận đã bắt đầu nhưng chưa commit lúc xác nhận sẽ mang `created_at` sớm hơn `created_at` của quyết định, nên người đọc sổ về sau có thể hiểu nhầm rằng người xác nhận đã có tin đó.
- **R28** · Nháp `release_librarian` trên một tài liệu đã có bản nhưng chưa có bản chuẩn luôn bị giữ `SUBJECT_BASELINE_MISSING` (ngữ cảnh của kỹ năng đó không có bản nào để nêu). Thuộc giữ chỗ của OQ-53 điểm 2.
- **R29** · Bất biến P3 đọc chính xác là «điều bị che lúc đọc luôn bị giữ lúc xác nhận»; mã có thể khác khi không dựng được ngữ cảnh. Với dự án chỉ con trỏ, `value` vẫn vào tiến trình Node rồi mới bị bỏ (cùng OQ-54). Giữ chỗ của OQ-55 xét luồng của chính ứng viên: chữ của một luồng khác cùng dự án mà nháp chép lại không được phép kiểm nào thấy. Tổ hợp các mã che của một dòng là thứ bên ghi tác động được. **Bản 0.6 (vòng sửa 1 của cổng Codex, Task F2; cổng-N2):** câu «chữ của một luồng khác cùng dự án mà nháp chép lại không được phép kiểm nào thấy» tả mã tới `83d5e2f`; từ Task F2, giữ chỗ theo dự án (`PROJECT_TEXT_HIDDEN`) che và giữ cả trường hợp đó, và bất biến P3 đứng cho mã mới (mục «Vòng sửa 1 của cổng Codex», X3).

**Trước khi thêm tuyến đọc nháp hoặc bật Z4 — bổ sung** (đánh số tiếp danh sách ở mục «Giới hạn đã biết»):

7. Ngay sau khi áp 022 ở bất kỳ CSDL nào, chạy câu catalog chỉ đọc ở mục «Ghi chú triển khai cho biên nhận» của `review-task-1-2-database.md`: chủ hàm có `rolsuper` hoặc `rolbypassrls`, ACL chỉ có chủ, `tgenabled='O'`, `tgtype=7`, hai thiết lập đã ghim. `scripts/migrate.ts` áp mọi migration đang chờ trong một lượt, nên lần migrate kế tiếp ở bất kỳ đâu cũng áp luôn 022.
8. Login của pipeline: `default_transaction_isolation = read committed` (R21), kiểm lúc tạo login.
9. Đọc bốn thiết lập log của cụm (R23).
10. Đo lại thứ tự nạp trên một bản dump của CSDL thật và quyết về `--disable-triggers` (R20). **Bản 0.7 (DB-4):** khi đo, ghi cả việc bản dump nạp dự án trước nháp và ánh xạ, và giữ «một giao dịch, không `-j`»: phục hồi song song nay có thể kết thúc bằng `55P03` hoặc `40P01` (R20).
11. Tuyến gọi `decide`: giới hạn tần suất, ánh xạ lỗi lược đồ lệnh, không log thân câu trả lời (R25).
12. Hợp đồng và prompt của pipeline: nêu mọi tin của luồng có trong ngữ cảnh và bản mới nhất của tài liệu (R26, R28).
13. Một lần `EXPLAIN` trên PostgreSQL 16 cho hai câu đọc luồng (`threadHasHiddenText`, `threadFreshness`) trên một luồng dài.

## Sau ba lượt review tầng 1 trên cả nhánh (bổ sung của bản 0.4; phán quyết của phiên chính, không phải quyết định của Chairman)

Ba báo cáo ở `docs/reviews/oq-45-46-evidence-20261118/gates/`: `tier1-code.md`, `tier1-security.md`, `tier1-database.md`. Cả ba kết luận «READY FOR GATE»; không có P0, không có P1. Mọi finding của các review theo task thuộc mã và ca kiểm được phán ADDRESSED; hai mục P3 được phán «khép một phần» (SEC-M6: thân hàm mới ghim theo đoạn; 4ab-N6 ý (c): chú thích) và được làm tiếp ở đợt sửa 2. Phán quyết T3-M4 (không đổi thứ tự trước khoá lệnh) được cả reviewer mã lẫn reviewer bảo mật khuyên giữ.

**Các mục P2 và cách xử lý:**

| Mục | Nội dung | Xử lý |
|---|---|---|
| bảo mật P2-1 | Dự án **chưa ánh xạ miền** được guard cho ghi và không bị che; lời Chairman không phủ, mã theo đúng chữ «dự án `IBS_HI`» và cùng luật với chữ của tin (OQ-28 (c)) | **OQ-56** (`docs/OPEN-QUESTIONS.md:914`). Không viết mã; hành vi cũ giữ nguyên; không tự chọn hướng chặt hơn vì đó là một chính sách dữ liệu mới, không phải một giữ chỗ |
| bảo mật P2-2 | `excerptChats` là bản chụp lúc dựng dịch vụ: một instance sống lâu vẫn trả nội dung sau khi cờ nhóm đã gỡ | Điều kiện 4 của danh sách «trước khi bật Z4» đọc lại như dưới đây. PR này không dựng dịch vụ ở đâu ngoài test |
| bảo mật P2-3 | Khe theo thứ tự commit của đường nhận tin (R6, R27) không nằm trong phương án nào của OQ-53 | Điểm 3 của OQ-53, ghi ở cuối `docs/OPEN-QUESTIONS.md` (ngay sau OQ-56) |
| CSDL N-1 | 022 được sửa tại chỗ dưới cùng số bản; trình áp bỏ qua bản đã ghi; câu catalog của điều kiện 7 không xem thân hàm | Bản 022 có thân cũ (không `LTZ02`) chỉ từng nằm trong CSDL thử riêng của PR này, và đã được lùi rồi áp lại trước lượt kiểm native. Điều kiện 7 đọc lại như dưới đây, với câu catalog mới của `tier1-database.md` mục 6 |
| CSDL N-2 | Nửa READ COMMITTED của G17 không chứng minh điều nó nêu | Đợt sửa 2: nửa đó dùng một dự án chưa có dòng ánh xạ nào lúc giao dịch mở |
| mã F-1 | Cổng xét nháp có hai bản (`present` và bước giữ của `decide`), giữ khớp bằng tay | Đợt sửa 2 thêm một ca đi qua mọi `MaskReason` để ghim «bị che thì bị giữ». Gộp thành một hàm: làm cùng lượt mã của OQ-53 và OQ-55, không trong PR này |

**Đợt sửa 2** (đợt sửa cuối; chỉ ca kiểm, một câu lệnh được viết lại cho đóng, và chú thích): G17 nửa READ COMMITTED; G16 thêm READ UNCOMMITTED và một dự án `IBS_HI`; G12 so cả thân hàm với tệp migration; G18 thêm `MERGE` dưới role AI; `threadFreshness` dùng `IS NOT TRUE` cho phép «không nêu»; T15 (bản sửa trùng thời điểm với mốc); Q10 (`threadHasHiddenText` đóng khi không có dòng trả về); Q11 (điều kiện dự án của chính câu lệnh); một ca đi qua mọi `MaskReason`; S1 dùng danh sách khoá cho phép; ba chú thích.

**Không làm trong PR này** (reviewer mã, P3): hai nhánh không tới được; import thừa có từ gốc; cột `dec_key` đọc về mà không dùng; một kiểu chung cho các mã lý do; mã ca của «Bảng: yêu cầu → ca» không nằm trong tên ca; commit `bcdb360` mang loại `test` nhưng có ba chạm ở `src` (ghi ở mô tả PR).

**Phần dư bổ sung:**

- **R30** · Xác nhận một nháp tài liệu tạo một bản mới của tài liệu, nên mọi nháp đang chờ khác của cùng tài liệu từ đó chỉ còn từ chối được (chúng nêu bản cũ). Đúng chữ của OQ-46 (b).
- **R31** · R23 rộng hơn đã ghi: theo mặc định PostgreSQL ghi **chữ của câu lệnh** bị lỗi vào log máy chủ (`log_min_error_statement`); với lệnh có tham số thì chữ đó chỉ có `$n`, với lệnh chèn thô bằng chữ SQL thì có cả nội dung. Khi login của pipeline cấu hình sai mức cô lập, **mọi** lệnh ghi nháp thành một dòng `ERROR`. Đối tượng lỗi của PGlite 0.5.15 mang cả `params`: lỗi CSDL thô đi qua `submitDraft` (mọi mã trừ `LTZ01`) vì vậy mang nội dung nháp ở bản demo cục bộ.
- **R32** · `scoped` và `aiScoped` mở giao dịch bằng `BEGIN` trần và thừa hưởng mức cô lập mặc định; chỉ `IdentityService.scope` ghim READ COMMITTED. Lập luận chạy đua của `decide` (đọc sau khoá thấy commit của bên kia) dựa vào READ COMMITTED của login runtime; ở REPEATABLE READ câu khoá báo lỗi tuần tự hoá chứ không lọt (suy luận của reviewer, chưa đo).

**Trước khi thêm tuyến đọc nháp hoặc bật Z4 — đọc lại và bổ sung:**

- Điều kiện **4** đọc là: dịch vụ lấy danh sách nhóm hiện chữ **hiện hành cho từng yêu cầu** (hoặc được dựng lại khi cấu hình đổi), không dùng một bản chụp lúc khởi động.
- Điều kiện **7** đọc là: sau khi áp 022 ở bất kỳ CSDL nào, chạy câu catalog của `tier1-database.md` mục 6 — ngoài chủ hàm, ACL, `tgenabled`, `tgtype` và hai thiết lập, nó xem thân hàm có phép kiểm mức cô lập, `LTZ02`, `LTZ01`, và phép kiểm mức cô lập đứng trước câu đọc ánh xạ. Một CSDL đã ghi `'022'` với thân cũ phải lùi 022 rồi áp lại.
- Điều kiện **10** thêm: phiên phục hồi ở READ COMMITTED và không dùng `-j` (phục hồi song song).
- **14.** Login runtime cũng ở READ COMMITTED (R32); cân nhắc ghim mức cô lập trong `scoped` và `aiScoped` như `IdentityService.scope`.
- **15.** `decide` đọc dòng nháp bằng câu lệnh siêu dữ liệu khi người gọi không có quyền quyết định, để `value` không vào tiến trình Node (nửa còn lại của R25).
- **16.** Tuyến gọi `submitDraft` bọc mọi lỗi CSDL thô, kể cả `LTZ02` (R31).
- **17.** OQ-56 có quyết định; điểm 3 của OQ-53 có quyết định.

## Vòng sửa 1 của cổng Codex (bản 0.5)

Do agent `planner` lập ngày 18/11/2026 (mô hình Fable 5.2, không lùi mô hình), theo phán quyết của phiên chính — **không phải quyết định của Chairman**, trừ mục CX3, nơi Chairman có một quyết định về phạm vi của PR (đoạn kế dưới). Lời Chairman về OQ-45 và OQ-46 vẫn là căn cứ của PR và được chép nguyên: «OQ-45: 1b, 2b, 3b. OQ-46: b, mốc là bản mới nhất nháp nêu». Mục này không sửa task nào ở trên; các dòng trước nó giữ nguyên số dòng của bản 0.4 (vài dòng được nối thêm một câu «Bản 0.5» ở cuối dòng). **Bản 0.6 (18/11/2026; cùng agent, cùng mô hình):** mục này đã được sửa sau cổng bảo mật trên chính thiết kế vòng sửa — «PLAN NEEDS CHANGES», `docs/reviews/oq-45-46-evidence-20261118/gates/security-gate-codex-fix-plan.md` — theo phán quyết của phiên chính: áp mọi mục N, R, C của báo cáo đó (bảng X0b). Số dòng **bên trong** mục này vì vậy khác bản 0.5 mà báo cáo cổng trích; số dòng trước mục không đổi. Tiêu đề mục giữ chữ «bản 0.5» để các tài liệu đã gọi tên nó còn tìm được. **Bản 0.7 (18/11/2026; cùng agent, cùng mô hình):** sau khi F1, F2, F3 được commit (`cb1d7dc`, `1a423a5`, `f434f0a`) và hai lượt review của vòng sửa trả về, cơ chế khoá của CX4 đổi sang khoá dòng trên `public.projects` (Task F1b). Phần thay đổi nằm ở mục «Đợt sửa sau review của vòng sửa 1 (bản 0.7)», ngay sau X8. Trong mục này, chữ bị thay được gắn nhãn «Bản 0.7» tại chỗ và giữ làm lịch sử; không dòng nào bị chèn hay xoá. **Bản 0.8:** hai lượt quét theo lớp và Task F5 (guard phía xác nhận) nằm ở mục «Quét lớp lỗi trước vòng 2 của cổng và Task F5 (bản 0.8)», sau mục của bản 0.7. **Bản 0.9:** vòng 2 của cổng và vòng sửa 2 (Task G1 và Task G2) nằm ở mục «Vòng 2 của cổng Codex và vòng sửa 2 (bản 0.9)», sau mục của bản 0.8.

**Quyết định phạm vi của Chairman cho finding CX3** (18/11/2026; Chairman chọn qua hộp chọn của phiên điều phối, phiên điều phối chuyển lời, planner không thấy hộp chọn; khối chép nguyên câu hỏi và cả ba phương án ở `docs/OPEN-QUESTIONS.md:928`). Chuỗi trả lời, chép nguyên: «B: chặn tạm (Recommended)». Chữ của phương án đó, chép nguyên: «Giữ chỗ fail-closed: không nháp ứng viên nào xác nhận được cho tới khi anh quyết điểm 3 của OQ-53. Nằm trong phạm vi brief; phải đổi kỳ vọng các ca của lát 3 đang xác nhận nháp ứng viên. Z4 đang tắt, chưa có login AI nên hôm nay không có nháp thật nào bị chặn.» Nhãn «(Recommended)» là đề xuất của phiên điều phối. Đây là quyết định về phạm vi của PR này; **điểm 3 của OQ-53 vẫn mở**.

**Nguồn.** Cổng Codex vòng 1 trên cả nhánh ở HEAD `83d5e2f` (mã `src/` và `migrations/` ở `383c394`, `tests/` ở `5c08fda`) trả `VERDICT: CHANGES_REQUIRED`: `docs/reviews/oq-45-46-evidence-20261118/codex-round-1.md`; bối cảnh đã gửi: `codex-context-round-1.md` cùng thư mục. Cổng bảo mật trên thiết kế vòng sửa (bản 0.5 của mục này): `docs/reviews/oq-45-46-evidence-20261118/gates/security-gate-codex-fix-plan.md`. Trần là hai vòng sửa. Builder của một task dưới đây đọc «Global Constraints», mục này từ đầu tới hết «X5», và đúng task của mình. Bản 0.7: hai review của vòng sửa 1 — `docs/reviews/oq-45-46-evidence-20261118/gates/review-codex-fix1-F1-database.md` và `docs/reviews/oq-45-46-evidence-20261118/gates/review-codex-fix1-security.md` — cùng phép đo `docs/reviews/oq-45-46-evidence-20261118/measurements-pg16-rowlock.txt`. **Bản 0.9:** «Trần là hai vòng sửa» đúng, và nghĩa là cổng chạy tối đa **ba lượt**: vòng 1, vòng sửa 1, vòng 2, vòng sửa 2 (Task G1 và Task G2), rồi vòng 3 — lượt chạy cuối (09.3).

### X0 · Finding → xử lý

| Finding | Chỗ | Xử lý trong vòng này |
|---|---|---|
| **CX1** [P0] — trigger tiết lộ nhãn `IBS_HI` của dự án ngoài phạm vi role AI trước khi RLS xét dòng chèn (ca G9 ghim đúng điều đó) | `migrations/022_ai_drafts_pointer_only_guard.sql:24` | **Task F1, phần A:** một trigger thứ hai chạy trước, trả câu trả lời của chính policy cho mọi dòng mà policy sẽ từ chối. G7, G9 đổi kỳ vọng |
| **CX2** [P0] — nháp tài liệu chép chữ của tin đã bị ẩn vẫn trả nguyên `value` khi không nêu mã tin (R16, OQ-55) | `src/server/suggestions.ts:209` | **Task F2:** giữ chỗ fail-closed theo **dự án**, mã `PROJECT_TEXT_HIDDEN`, che lúc đọc và giữ lúc xác nhận, cho **cả hai loại nháp** (bản 0.6, cổng-N2: cùng lớp lỗi có ở nháp ứng viên). Rộng hơn chữ của phương án (e) của OQ-55. **Không phải phương án được chọn** |
| **CX3** [P1] — xác nhận nháp ứng viên không đồng bộ với giao dịch nhận tin sau phép kiểm độ mới (R6, R27; điểm 3 của OQ-53) | `src/server/suggestions.ts:300` | **Task F3:** giữ chỗ fail-closed theo **quyết định phạm vi của Chairman, phương án B** — không nháp ứng viên nào xác nhận được, mã `SUBJECT_ORDER_UNVERIFIED`. **Không phải phương án được chọn** của điểm 3 OQ-53; điểm đó vẫn mở. Mười một ca hiện có đổi kỳ vọng (X5) |
| **CX4** [P1] — phép đọc ánh xạ không đồng bộ với giao dịch đổi miền dự án (R5) | `migrations/022_ai_drafts_pointer_only_guard.sql:24` | **Task F1, phần B:** khoá tư vấn theo dự án, chia sẻ ở guard, độc quyền ở lệnh ghi ánh xạ; mỗi lần chờ có trần 5 giây ghim trong hàm (bản 0.6, cổng-N1). **Bản 0.7:** cơ chế khoá nay là khoá dòng `FOR NO KEY UPDATE` trên dòng dự án, ở cả hai phía (**Task F1b**, mục 07.5); chữ «khoá tư vấn … chia sẻ … độc quyền» ở ô này là lịch sử |

Thứ tự: F1 → F2 → F3 → F4, nối tiếp. F2 và F3 cùng sửa `src/server/suggestions.ts` và `tests/suggestions.test.ts`: không chạy song song. F1 gộp CX1 và CX4 vì cả hai sửa cùng tệp migration, cùng tệp lùi, cùng ca G12 và RB1; trong task chúng là hai phần có danh sách ca đỏ riêng.

### X0b · Bảng: mục cổng bảo mật (vòng sửa) → chỗ áp

Mã «cổng-N1» … «cổng-C9» trong mục này chỉ các mục của báo cáo `security-gate-codex-fix-plan.md`, không phải của hai lượt cổng trên kế hoạch gốc.

| Mục của cổng | Chỗ áp |
|---|---|
| **N1** — khoá tư vấn cho role không tin quyền hoãn vô hạn và im lặng lệnh ghi ánh xạ | X2 («Trần chờ»); hai khối SQL của Task F1 (`SET lock_timeout = '5s'` trong định nghĩa hai hàm lấy khoá); X-G12 và G20 (`proconfig`); G27 (cổng-C4) và Y2; R34 viết lại; điều kiện 18. **Bản 0.7:** khoá tư vấn đã bị gỡ (Task F1b); trần 5 giây trong hai hàm giữ nguyên; G27, Y2, R34 và điều kiện 18 viết lại ở 07.4 và 07.5 |
| **N2** — cùng lớp lỗi của CX2 còn ở nháp ứng viên; OQ-55 bỏ sót giới hạn | X3 viết lại; Task F2 (`present` và `decide` xét theo dự án cho cả hai loại nháp); W5 viết lại, W7 (cổng-C7); X-Q1, X-Q2, X-Q4; danh sách 4 và 5 của V2; R35 viết lại, ghi chú ở R29 (`:800`); `docs/OPEN-QUESTIONS.md:904`, `:908` sửa tại chỗ. X-M10: xem X7 mục 8 |
| **R1** — R33 thiếu cỡ, câu «G19 ghim» sai | X1 («Role AI học được gì»), R33 viết lại, G25 (cổng-C1) |
| **R2** — hàm phạm vi: hai `IF` lồng nhau, `HINT` | khối SQL thuận của Task F1; X1; các đoạn phải có ở G12; ý «login vận hành với biến `app.*` hỏng» của G26 |
| **R3** — hai chỗ của X2 viết chưa đúng | X2: «Vòng khoá chết» (thêm một vòng), «Phương án khác đã xét» (viết lại) |
| **R4** — `projectHasHiddenText` mở khi dự án ngoài phạm vi giao dịch | Task F2: vế `NOT EXISTS(SELECT 1 FROM projects …)`; U1 (ba ý đổi thành «đúng»); R35; X7 mục 9 |
| **R5** — bối cảnh gửi cổng Codex vòng 2 | Task F4, bước cuối (năm ý) |
| **R6** — chú thích mã của F3 đọc thành lý do của Chairman | Task F3, khối mã: hai chú thích tách riêng |
| **R7** — điều kiện «trước khi bật Z4» | X6: điều kiện 20 viết lại, điều kiện 22 mới |
| **R8** — dòng phiên bản | `:5`, nối câu «Bản 0.6» trỏ tới `:847` |
| **C1** — ghim độ lệch policy ↔ trigger | G25 |
| **C2** — hình dạng lệnh còn thiếu của CX1 | G26; G19 so cả `code` |
| **C3** — ý khẳng định điều không thể sai | G20 (ghi là đối chứng, so hai dự án), G21 (`locks()` lọc `classid` và CSDL), G22 (đổi tên) |
| **C4** — R34 nói thành ca | G27 (native) |
| **C5** — thứ tự mới của `INVALID_INPUT` | V5 |
| **C6** — W2 | W2 (thêm câu trả lời của lệnh từ chối), W8 |
| **C7** — luồng khác cùng dự án | W7 |
| **C8** — hình dạng trung gian của 022, trong repo | RB3 |
| **C9** — đường dịch vụ sau khi chờ | Y1 (native) |

### X1 · Thiết kế cho CX1 — trigger «phạm vi đã khai»

- **Cơ chế.** Thêm vào 022 một trigger `BEFORE INSERT … FOR EACH ROW` thứ hai trên `intelligence.ai_drafts`, tên `ai_drafts_declared_scope_guard`, hàm `SECURITY INVOKER` ghim `search_path`. Trigger cùng sự kiện chạy theo thứ tự tên, nên nó chạy **trước** `ai_drafts_pointer_only_guard`. Với role đang chịu RLS trên bảng — `pg_catalog.row_security_active(TG_RELID)`, đánh giá dưới quyền người chèn — nếu dòng không thoả điều kiện `WITH CHECK` của policy `ai_insert` (`migrations/021_ai_suggestions_z4.sql:100-103`) thì ném SQLSTATE `42501` với đúng câu của PostgreSQL: `new row violates row-level security policy for table "ai_drafts"`. Hàm definer vì thế không bao giờ đọc ánh xạ cho một dòng mà policy sẽ từ chối.
- **Vì sao phải là hàm thứ hai.** Trong hàm `SECURITY DEFINER`, `current_user` là chủ hàm (superuser), nên `row_security_active` ở đó luôn trả sai: hàm definer không biết người chèn có chịu RLS hay không. Hàm invoker thì biết.
- **Điều kiện là đủ ba vế của policy** (tenant, dự án, `ai_principal_id`), không chỉ hai vế tenant và dự án như phán quyết nêu — xem X7 mục 1. Bất biến thu được: với role chịu RLS, hàm definer chỉ chạy cho dòng mà policy cho qua, tức dòng mà role **ghi được** nếu dự án không phải `IBS_HI`.
- **Hai `IF` lồng nhau, và một `HINT`** (bản 0.6, cổng-R2). `IF` ngoài chỉ hỏi «role này có chịu RLS trên bảng không»; ba vế `app.*` nằm trong `IF` trong. Role không chịu RLS vì vậy **không bao giờ** đánh giá các biểu thức `app.*` — không dựa vào việc `AND` dừng sớm, vốn đúng trong thực tế nhưng không phải bảo đảm của ngôn ngữ: một `app.project_ids` hỏng còn sót trong phiên vận hành không thành `22P02`. Lỗi ném ra mang thêm `HINT` nói đây là trigger của 022 soi policy `ai_insert`, và nếu policy cho qua dòng này thì hai bên đã lệch — sửa trigger, đừng nới RLS. Mã và câu `message` không đổi. `HINT` giống nhau cho mọi dự án; role AI biết thêm tên một trigger, không biết gì về dự án.
- **Role không tắt được phép kiểm.** Nó không dựa vào biến `app.*` nào để quyết có kiểm hay không (các biến đó chỉ là phạm vi đã khai). Sau `SET row_security = off`, PostgreSQL từ chối chính lệnh chèn của role chịu RLS trước mọi trigger, như nhau cho mọi dự án. Role AI không sở hữu bảng nên không tắt được trigger, không đặt được `session_replication_role` (và ở chế độ đó cả hai trigger cùng không chạy — không có trạng thái «trigger phạm vi tắt, hàm definer còn»), và không gọi thẳng được hàm (`EXECUTE` thu hồi khỏi `PUBLIC`; hàm trigger không cần `EXECUTE` của người chèn).
- **Login vận hành** không chịu RLS: trigger mới trả `NEW`, guard cũ vẫn buộc nó (G6 không đổi). Phục hồi dữ liệu chạy bằng superuser: không đổi.
- **Role AI học được gì sau khi sửa — đúng cỡ (bản 0.6, cổng-R1).** Điều CX1 đóng là «trigger trả lời trước RLS»: với dòng ngoài phạm vi nó khai, role nhận cùng một câu trả lời cho dự án `IBS_HI` và dự án khác — cùng mã, cùng câu, cùng một đường mã. Với dòng trong phạm vi nó khai: `LTZ01` hoặc dòng được lưu, như cũ. **Với người giữ role có ý xấu, thứ lấy được không giảm so với R4:** role tự khai phạm vi (khoảng trống 7 của lát 3, có từ trước PR), nên một lệnh `set_config` là có lại bit của bất kỳ dự án nào của bất kỳ tenant nào, và giao dịch lùi thì không để lại dòng. Bit nay rộng **đúng bằng quyền ghi mà role tự khai**. Đủ chữ ở R33.
- **Độ lệch giữa policy và trigger.** Điều kiện của trigger là bản chép tay của `WITH CHECK`. Ca bắt độ lệch là **G25** — ghim chuỗi `WITH CHECK` của `ai_insert`, đúng một policy `INSERT`, không policy `RESTRICTIVE` — không phải G19 (G19 chỉ ghim sáu kiểu dòng của policy hôm nay). Hướng hỏng khi lệch nêu ở R33. **Bản 0.7 (DB-1 của review CSDL):** ghim policy `INSERT` là chưa đủ — trigger phải chặt bằng **giao** của `ai_insert` và `ai_select`; sau Task F1b, G25 ghim cả hai (chữ đầy đủ ở R33).
- **Đã đo trên PGlite** (CSDL trong bộ nhớ, script ngoài repo; PGlite 0.5.15 tự báo là PostgreSQL 18.6, trong khi lượt native của PR là 16.15). Với thân bản 0.6: dòng ngoài phạm vi của dự án `IBS_HI` và của dự án khác nhận `{code, message, hint}` bằng nhau — `42501`, đúng câu của RLS — qua lệnh chèn đơn, `MERGE`, lệnh chèn hai dòng theo cả hai thứ tự, và đúng câu lệnh của `submitDraft` trên một khoá đã có; với `app.project_ids` hoặc `app.tenant_id` không phải uuid, cả hai dự án nhận cùng `22P02`; sau `SET LOCAL row_security = off`, cả hai nhận cùng `42501` với câu «query would be affected by row-level security policy for table "ai_drafts"»; dòng trong phạm vi của dự án `IBS_HI` vẫn nhận `LTZ01`; login vận hành mang `app.project_ids` và `app.tenant_id` hỏng vẫn nhận `LTZ01` cho dự án `IBS_HI` và lưu được nháp cho dự án khác. Với thân bản 0.5 (cùng điều kiện, một `IF`): mười một kiểu dòng bị policy từ chối, câu trùng từng chữ với câu RLS trả khi trigger mới bị tắt, `LTZ02`, `23502`. Chưa đo trên PostgreSQL 16.

### X2 · Thiết kế cho CX4 — khoá tư vấn theo dự án

- **[Bản 0.7 — ĐÃ BỊ THAY. Thiết kế khoá tư vấn của cả mục X2 này (`:906-923`) không còn là thiết kế của PR: Task F1b thay nó bằng khoá dòng trên `public.projects`. Thiết kế hiện hành ở mục «Đợt sửa sau review của vòng sửa 1 (bản 0.7)», 07.3. Các ý dưới đây giữ làm lịch sử.]** **Cơ chế.** Khoá hai số nguyên `(1346653516, hashtext(project_id::text))`. Hằng `1346653516` là `0x50444D4C` («PDML»). Hai khoá tư vấn có sẵn của repo không trùng: `DRAFT_DECISION_LOCK = 0x44524654` cũng ở dạng hai số nhưng khác số đầu (`src/server/suggestions.ts:29`); `src/server/intake.ts:87` dùng dạng một `bigint`, là không gian khoá khác.
  - Trong guard, **sau** phép kiểm mức cô lập và **trước** câu đọc ánh xạ: `PERFORM pg_catalog.pg_advisory_xact_lock_shared(…)`.
  - Một trigger `BEFORE INSERT … FOR EACH ROW` mới trên `public.project_domain_mappings`, hàm `SECURITY INVOKER`: `PERFORM pg_catalog.pg_advisory_xact_lock(…)` — độc quyền.
- **Trần chờ, ghim trong hàm** (bản 0.6, cổng-N1). Cả hai hàm lấy khoá mang `SET lock_timeout = '5s'` **trong định nghĩa**: trần có hiệu lực trong thân hàm, dù phiên gọi đặt gì, và giá trị của phiên được trả lại khi hàm kết thúc (đã đo).
  - *Vì sao 5 giây.* (i) Lần chờ hợp lệ dài bằng một giao dịch chèn một dòng nháp, hoặc một giao dịch ghi ánh xạ: cỡ mili giây; 5 giây lớn hơn ba bậc. (ii) Nhỏ hơn trần 10 giây cho mỗi câu lệnh của mọi kết nối trong pool (`src/server/db.ts:32`), nên câu trả lời là lỗi của khoá, có tên hàm, chứ không phải lỗi hết giờ câu lệnh. (iii) Lớn hơn `deadlock_timeout` mặc định (1 giây), nên một vòng khoá chết thật vẫn được báo là `40P01`. (iv) Cùng giá trị các tệp migration của repo đã dùng cho chính lần chờ khoá của chúng.
  - *Quá trần thì sao.* PostgreSQL huỷ câu lệnh với SQLSTATE **`55P03`** («canceling statement due to lock timeout»), CONTEXT nêu tên hàm. Hướng hỏng là **đóng ở cả hai phía**: lệnh chèn nháp không lưu dòng nào; lệnh ghi ánh xạ không ghi dòng nào và thất bại thành tiếng — không lệnh nào treo.
  - *Mã lỗi tới người gọi.* Lệnh ghi ánh xạ: người vận hành nhận `55P03` thô. `submitDraft` **không bắt** mã này (nó chỉ đổi `LTZ01` thành `POINTER_ONLY_PROJECT`): đối tượng lỗi của trình điều khiển đi nguyên ra với `code` là `55P03` — không phải `AppError` — giao dịch lùi, không nháp nào được lưu, khoá khử trùng còn tự do nên gửi lại đúng phong bì đó về sau vẫn lưu được (ca Y2). Cùng lớp với R31. Không tuyến HTTP nào gọi `submitDraft`; pipeline tương lai phải coi `55P03` là thử lại được (điều kiện 18). Vòng sửa này không thêm mã lỗi mới của dịch vụ.
  - *Điều trần này không sửa được.* Mọi cách đóng CX4 chặt («không nháp nào commit sau ánh xạ») đều buộc lệnh ghi ánh xạ chờ lệnh chèn nháp đang chạy; ai giữ được khoá thì vẫn **hoãn** được, bằng cách làm mọi lần thử thất bại sau 5 giây chừng nào còn giữ. Thứ được sửa là «vô hạn» và «im lặng». Đủ chữ ở R34.
- **Lập luận hai chiều** (READ COMMITTED; guard đã từ chối mọi mức khác bằng `LTZ02`).
  - Lệnh ghi ánh xạ lấy khoá trước: guard chờ. Khoá và câu đọc là **hai câu lệnh riêng** trong một hàm `VOLATILE`; ở READ COMMITTED mỗi câu lệnh của hàm `VOLATILE` lấy ảnh chụp mới lúc nó bắt đầu, nên câu đọc chạy sau khi chờ thấy ánh xạ vừa commit, và nháp bị từ chối `LTZ01`. Gộp khoá và câu đọc vào một câu lệnh thì ảnh chụp có trước lúc chờ và lập luận sai: không gộp.
  - Lệnh chèn nháp lấy khoá trước: lệnh ghi ánh xạ chờ tới khi giao dịch chèn nháp kết thúc. Nháp khi đó được lưu **trước** ánh xạ — đúng trường hợp của OQ-54, không phải lỗ mới.
- **`UPDATE`, `DELETE` trên bảng ánh xạ** bị `project_domain_mappings_immutable` từ chối (`migrations/013_project_registry.sql:97-98`): `INSERT` là đường ghi duy nhất, nên trigger chỉ cần phủ `INSERT`. Role runtime và role AI không có quyền `INSERT` trên bảng đó (`migrations/013_project_registry.sql:101` chỉ cấp `SELECT`); hôm nay chỉ login vận hành ghi ánh xạ.
- **Vòng khoá chết.** Một lệnh chèn nháp và một lệnh ghi ánh xạ của cùng dự án không chờ vòng: bên giữ khoá không cần gì của bên chờ. Hai lệnh chèn nháp dùng khoá chia sẻ, không chờ nhau. Không đường nào của `decide` hay của đường nhận tin lấy khoá này. Có **hai** cách dựng một vòng, cả hai PostgreSQL đều huỷ một bên bằng `40P01`: (i) **một** câu lệnh chèn nháp cho nhiều dự án chạy cùng lúc với **một** giao dịch ghi ánh xạ cho các dự án đó theo thứ tự ngược; (ii) (bản 0.6, cổng-R3) hai phiên cùng chèn nháp cho một dự án — cùng giữ khoá chia sẻ — rồi cùng ghi ánh xạ cho dự án đó **trong chính giao dịch ấy**: mỗi bên chờ khoá chia sẻ của bên kia. Vòng (ii) chỉ phiên ghi được cả hai bảng dựng được, tức login vận hành. `submitDraft` chèn một dòng mỗi giao dịch và không ghi ánh xạ. Phục hồi chạy một giao dịch trên một kết nối (`deploy/install-user.py:161`, `deploy/install-d1.sh:43`) nên không gặp vòng nào.
- **Phục hồi dữ liệu.** Phục hồi data-only chạy với trigger bật: mỗi dòng ánh xạ lấy một khoá, mỗi dòng nháp lấy một khoá chia sẻ, giữ tới hết giao dịch của lệnh `COPY`; số khoá bằng số dự án khác nhau, nhỏ. R20 không đổi.
- **Tệp lùi** gỡ đủ ba trigger và ba hàm, chạy lại được, và gỡ được cả thân cũ của 022. **Idempotent:** áp tệp thuận lên một CSDL đang mang thân cũ cho đúng hình dạng mới; áp lần hai không đổi gì.
- **Năng lực mới cho role không tin (R34; rủi ro lớn nhất của mục này).** Khoá tư vấn không có danh sách quyền: **mọi** role của CSDL, kể cả `libetech_ai`, tự lấy được đúng khoá này, ở dạng mức giao dịch lẫn dạng **mức phiên** (`pg_advisory_lock`, sống qua mọi giao dịch). Ai giữ nó thì hoãn được lệnh ghi ánh xạ của dự án đó — tức **hoãn việc một dự án thành `IBS_HI`** — trong khi chính phiên đó vẫn chèn nháp cho dự án ấy. Trước vòng sửa, role AI không có cách nào chặn lệnh ghi ánh xạ. Vòng sửa đổi một khe vài mili giây (R5) lấy năng lực này; trần 5 giây làm cho nó có giới hạn cho từng lần thử và thất bại thành tiếng, không làm nó biến mất.
- **Phương án khác đã xét, không chọn** (viết lại ở bản 0.6 theo cổng-R3; bản 0.5 loại nó bằng một tiền đề không bắt buộc). Khoá dòng trên `public.projects`: guard lấy `FOR SHARE`, lệnh ghi ánh xạ lấy `FOR NO KEY UPDATE`. Hai mức này xung đột với nhau và **không** xung đột với `FOR KEY SHARE` của khoá ngoại, nên không chặn lệnh chèn của lát nào. *Cái được:* role không tự lấy được khoá, và không có dạng mức phiên — nó chỉ giữ được qua một giao dịch chèn nháp còn mở. *Cái giá:* giao dịch chèn nháp còn mở chặn mọi `UPDATE` dòng dự án (đúng lo ngại cũ của R5), và người ghi ánh xạ cần quyền `UPDATE` trên `projects` hoặc một hàm definer. Một bảng khoá riêng chỉ hàm definer chạm được cũng cho «cái được» đó, nhưng thêm một bảng (đặt trong `intelligence` thì gãy ca canh ở `tests/z4-schema.test.ts:107`). Planner giữ khoá tư vấn theo phán quyết của phiên chính, nay có trần trong hàm; cổng bảo mật không đòi đổi cơ chế khi N1 được áp. Cổng CSDL của vòng sửa cân lại.
- **Đã đo trên PGlite:** hai hàm khoá và `hashtext` có; trong một giao dịch, sau lệnh chèn nháp có đúng một dòng `ShareLock` và sau lệnh ghi ánh xạ có đúng một dòng `ExclusiveLock`, cùng `classid` 1346653516 và cùng `objid`; hết giao dịch thì không còn; ghi ánh xạ `IBS_HI` rồi chèn nháp trong **cùng** giao dịch bị từ chối `LTZ01`; dòng không có `project_id` không gây lỗi ở bước khoá. Bản 0.6: `proconfig` của hai hàm có `lock_timeout=5s`; `lock_timeout` của phiên trở lại giá trị cũ sau lệnh chèn; dưới role AI, một phiên giữ `pg_advisory_lock` mức phiên của một dự án vẫn chèn được nháp cho dự án đó, và role AI đọc được các dòng `pg_locks` của khoá. **Chưa đo được** (PGlite chỉ có một kết nối): hai chiều chờ, và việc `lock_timeout` mức hàm cắt lần chờ khoá tư vấn bằng `55P03` — đó là việc của G23, G24, G27, Y1, Y2 trên PostgreSQL 16.

### X3 · Thiết kế cho CX2 — giữ chỗ theo dự án của OQ-55, cho cả hai loại nháp

**Dừng tại OQ-55. Giữ chỗ fail-closed, không phải phương án được chọn.** Bản 0.5 làm đúng phần nháp tài liệu của phương án (e) (`docs/OPEN-QUESTIONS.md:905`). Bản 0.6 (cổng-N2, phán quyết của phiên chính) áp cùng phép kiểm cho **nháp ứng viên**: giữ chỗ này vì vậy **rộng hơn chữ của (e)**, vốn chỉ nói «mọi nháp tài liệu của một dự án».

- **Vì sao phải mở rộng.** Sau bản 0.5, nháp tài liệu được xét theo dự án còn nháp ứng viên chỉ xét luồng của chính ứng viên. Kịch bản cổng nêu: luồng T1 chỉ lưu con trỏ, luồng T2 cùng dự án có lưu chữ, cờ của nhóm bị gỡ; một nháp `intake_analyst` của ứng viên T1 mang chữ của T2 trong `claims[].value`, phần nguồn chỉ nêu một tài liệu. Không mã tin nào được nêu nên không có `TEXT_NOT_VISIBLE`; T1 chưa từng lưu chữ nên không có `THREAD_TEXT_HIDDEN`; `value` được trả nguyên. Planner đã đo đúng như vậy trên mã hôm nay. Task F3 chặn **xác nhận**, không chặn **đọc**.
- **Một giá trị đúng/sai** tính trong `src/server/source-text.ts`: `projectHasHiddenText(tx, projectId, excerptChats)` — đúng khi dự án có ít nhất một bản, của bất kỳ tin nào, với `content_mode='excerpt'` mà `(textAllowedSql) IS NOT TRUE`. Mọi bản của mọi tin của dự án, không trần.
- **Đóng** (bản 0.6 thêm ý thứ ba, cổng-R4): mã dự án không phải uuid chữ thường → «đúng»; câu lệnh không trả dòng nào → «đúng»; **dự án không nằm trong phạm vi của giao dịch gọi** (dòng `projects` không thấy được: tenant khác, dự án ngoài danh sách, mã không có) → «đúng», bằng vế `NOT EXISTS(SELECT 1 FROM projects p WHERE p.id=$1::uuid) OR …`. Hai nơi gọi hôm nay đều đã thu hẹp phạm vi về đúng dự án (`src/server/suggestions.ts:228`, `:254`), nên vế này chưa đổi kết quả nào; nó giữ cho nhãn «đóng» đúng với một nơi gọi về sau.
- **Mã lý do `PROJECT_TEXT_HIDDEN`**, thêm vào `MaskReason`. `present` gọi hàm **một lần cho mỗi lần gọi**, khi gặp dòng đầu tiên mà người đọc có quyền quyết định, **bất kể loại nháp**; không gọi cho người không có quyền. `decide`, nhánh `confirmed`: thêm cùng mã vào tập lý do giữ cho **mọi** nháp, ngoài `if(ctx)`. Bất biến P3 «bị che thì bị giữ» đứng cho mã mới: cùng hàm, cùng `excerptChats`, cả hai nơi đều ngoài nhánh ngữ cảnh (ca P3 phải có mã này, và kiểu của ca đó không biên dịch nếu thiếu).
- **`THREAD_TEXT_HIDDEN` giữ nguyên**, vẫn tính cho nháp ứng viên. Khi cả hai giữ chỗ còn, nó không bao giờ đứng một mình (luồng có chữ ẩn thì dự án có chữ ẩn). Giữ để mỗi giữ chỗ gỡ được riêng theo quyết định của OQ-55, và để các ca Q của nó còn ghim được.
- **Cái giá (R35), nêu để người quyết OQ-55 biết:** gỡ cờ hiện chữ của **một** nhóm là che và giữ **mọi nháp** của cả dự án — nháp tài liệu lẫn nháp ứng viên, kể cả nháp không liên quan tới tin nào; với danh sách nhóm mặc định rỗng (khoảng trống 42), mọi dự án từng lưu chữ của tin đều có toàn bộ nháp bị che và bị giữ. Từ chối vẫn làm được.
- **Giới hạn còn lại:** chữ của tin thuộc **dự án khác** — không phép kiểm nào thấy; chữ của tin **đang** được hiện — không bị che, và không phải lộ mới: người có quyền quyết định một nháp cũng có vai đọc hộp tin của dự án (`src/server/inbox.ts:30`).
- **Đã đo trên PGlite**, dưới role runtime, với tin thật của đường nhận tin. Câu lệnh của bản 0.6 (có vế `NOT EXISTS`): không tin → sai; tin chỉ con trỏ → sai; chữ lưu, cờ còn → sai; cờ gỡ → đúng; danh sách `[null]` → đúng; `[null, <nhóm>]` → sai; người gọi của tenant khác → **đúng**; người gọi chỉ có dự án khác trong phạm vi → **đúng**; mã dự án không có → **đúng**. Câu lệnh của bản 0.5 (không có vế đó): mười bốn hình dạng, gồm bản cũ lưu chữ và bản mới nhất chỉ con trỏ, chữ của dự án khác, ánh xạ `IBS_HI` rồi về `XECA`. Kịch bản T1/T2 trên mã hôm nay: `maskReasons` rỗng và câu trả lời mang chữ đánh dấu, với danh sách rỗng lẫn danh sách có nhóm.

### X4 · Thiết kế cho CX3 — giữ chỗ theo quyết định phạm vi của Chairman (phương án B)

**Dừng tại điểm 3 của OQ-53. Giữ chỗ fail-closed, không phải phương án được chọn** của điểm đó: Chairman chưa chọn (a), (b) hay (c) (`docs/OPEN-QUESTIONS.md:924`). Phương án (A) của hộp chọn không được chọn: vòng sửa này không thêm trigger hay cột vào `source_events`, `source_event_revisions` và không sửa `src/server/intake.ts`.

- **Cơ chế.** Trong `decide`, nhánh `confirmed`: mọi nháp có `entity_type = 'intake_candidate'` nhận thêm mã `SUBJECT_ORDER_UNVERIFIED` vào **cùng** tập lý do giữ. Lệnh vì thế luôn trả `DRAFT_HELD` (422), không ghi quyết định, và khoá lệnh được trả lại như mọi lần giữ khác. Tên mã do planner đặt theo gợi ý của phiên điều phối; không phải lời Chairman. Mã riêng để gỡ được bằng đúng một dòng khi điểm 3 được quyết.
- **Đặt ngoài `if(ctx)`**, sau mọi phép kiểm khác và ngay trước `if(reasons.size)`: «lệnh xác nhận một nháp ứng viên thì tập lý do không bao giờ rỗng» đọc được trong một dòng, kể cả khi không dựng được ngữ cảnh.
- **Các phép kiểm sẵn có vẫn chạy và vẫn nêu mã:** `MANIFEST_MISMATCH`, `VALUE_HASH_MISMATCH`, `ENTITY_NOT_FOUND`, `POINTER_ONLY_PROJECT`, các mã của cổng đầu ra, `THREAD_TEXT_HIDDEN`, `PROJECT_TEXT_HIDDEN` (của Task F2), `SUBJECT_CHANGED`, `SUBJECT_BASELINE_MISSING`, `SUBJECT_EDIT_UNVERIFIED`. Không mã nào thành mã chết. Ca của chúng khẳng định «câu giữ có chứa mã» nên vẫn ghim được. Ca từng khẳng định «xác nhận được» nay khẳng định «bị giữ với **đúng một** mã `SUBJECT_ORDER_UNVERIFIED`» — tức không phép kiểm nào khác đứng chắn: sức phân biệt của ca cũ được giữ.
- **Một dòng phải dời để khỏi thành mã không tới được:** phép kiểm «nháp ứng viên không kèm bản đề xuất tài liệu» (`INVALID_INPUT`, `src/server/suggestions.ts:307`) hôm nay đứng **sau** bước giữ; với giữ chỗ này nó không bao giờ tới được. Planner dời nó lên đầu nhánh `confirmed`: đó là lỗi của lệnh, trả trước mọi lý do giữ; quyền, «đã quyết» và `valueHash` vẫn được kiểm trước nó. Hệ quả duy nhất: một lệnh xác nhận nháp ứng viên có kèm `revision` mà nháp cũng đang bị giữ thì nay nhận `INVALID_INPUT` thay vì `DRAFT_HELD`; không ca hiện có nào dựng tổ hợp đó. Cách khác, không chọn: để nguyên chỗ và đổi ý cuối của ca R12-e thành `DRAFT_HELD` — khi đó dòng `INVALID_INPUT` thành mã không tới được (X7 mục 4). Ca V5 ghim rằng sau khi dời, nó vẫn đứng **sau** quyền, «đã quyết» và `valueHash` (cổng-C5). **Bản 0.7 — đính chính:** câu «không ca hiện có nào dựng tổ hợp đó» **sai**. Ca R12-i (`tests/suggestions.test.ts:337` ở `83d5e2f`) gửi lệnh xác nhận kèm `revision` cho một dòng «cặp» — một nháp ứng viên đang bị giữ `ENTITY_NOT_FOUND`: planner đã bỏ sót nó khi soát ở bản 0.5. Phán quyết của phiên chính: việc dời `INVALID_INPUT` giữ nguyên; R12-i là ca thứ mười hai đổi kỳ vọng vì CX3 (E12, mục 07.6).
- **Từ chối** một nháp ứng viên không đi qua bước giữ: vẫn làm được. **Nháp tài liệu** không đổi.
- **Lúc đọc không che vì mã này.** `SUBJECT_ORDER_UNVERIFIED` không thuộc `MaskReason`; `present` và `list` không đổi. Điều phối dự án vẫn đọc được nội dung để từ chối. Bất biến P3 là **một chiều** — lý do nào che lúc đọc thì cũng giữ lúc xác nhận (tập lý do che nằm trong tập lý do giữ). Giữ chỗ này chỉ thêm vào tập giữ, không thêm gì vào tập che, nên bất biến còn nguyên. Chiều ngược lại — «bị giữ thì bị che» — chưa bao giờ là bất biến: `SUBJECT_CHANGED`, `SUBJECT_BASELINE_MISSING`, `SUBJECT_EDIT_UNVERIFIED`, `MANIFEST_MISMATCH`, `VALUE_HASH_MISMATCH` và một nhận định không nêu căn cứ đều giữ mà không che (ca M4 ghim điều đó cho nháp tài liệu). Ca P3 không đổi vì mục này: kiểu `Walked` lấy từ `MaskReason` nên không đòi cách dựng cho mã mới, và hai cách dựng dùng nháp ứng viên của nó khẳng định «câu giữ có chứa mã».
- **Phát lại** một quyết định đã ghi không đi qua bước giữ (khoá lệnh trả lời trước thân lệnh — ca K2 dựa đúng vào điều đó): một quyết định `confirmed` của nháp ứng viên đã có trong CSDL — hôm nay chỉ có thể là CSDL thử — vẫn được phát lại.
- **Nó đóng CX3 thế nào.** Finding nói: một tin commit muộn vẫn để nháp ứng viên cũ được xác nhận. Không còn lệnh xác nhận nháp ứng viên nào thành công, nên không còn gì để một tin commit muộn vượt qua. R6 và R27 vẫn đúng như mô tả về `threadFreshness`; không lệnh xác nhận nào dựa được vào chúng nữa.
- **Cái giá (R36):** đường xác nhận nháp ứng viên của lát 3 tạm đóng. Phần «luồng của ứng viên» của quyết định OQ-46 (b) không còn đường nào chạy tới «xác nhận được» cho tới khi điểm 3 được quyết và giữ chỗ được gỡ. Chữ của phương án Chairman chọn nêu sẵn điều này: «Z4 đang tắt, chưa có login AI nên hôm nay không có nháp thật nào bị chặn.»
- **Đã đo trên PGlite** (mã của nhánh như đang có, không sửa `src/`): câu trả lời hôm nay của từng lệnh xác nhận nháp ứng viên mà bảng E1–E11 và ca V2 dựng lại. Bảy lệnh — của E1, E2, hai kiểu của E3, E8, E9, E10 — hôm nay trả `confirmed`; năm ca còn lại (E4, E5, E6, E7, E11) không đo riêng: chúng xác nhận một nháp cùng kiểu và đang xanh trong bộ ca. Tám kiểu dòng của V2 hôm nay trả đúng các danh sách mã ghi ở ca đó, bớt `SUBJECT_ORDER_UNVERIFIED` và — ở ý 4 và 5 — bớt `PROJECT_TEXT_HIDDEN` của Task F2; ba câu trả lời của V5 hôm nay đúng như ca đó ghi; lệnh xác nhận nháp ứng viên có kèm `revision` hôm nay trả `INVALID_INPUT`. Không có SQL mới trong mục này.

### X5 · Ca hiện có bị chạm trong vòng sửa này

Ba bảng, ba nguồn khác nhau: đổi kỳ vọng vì cổng (cổng Codex vòng 1, và mục N2 của cổng bảo mật trên thiết kế vòng sửa); đổi hạ tầng; đổi kỳ vọng vì quyết định phạm vi của Chairman. **Bản 0.7:** thêm một bảng thứ tư — các ca của Task F1 đổi vì Task F1b — và ca E12 (R12-i), ở mục 07.6; ba bảng dưới đây giữ nguyên chữ.

**Đổi kỳ vọng vì cổng** (có chủ ý; khác với nới ca) — bảy dòng đầu vì cổng Codex vòng 1; ba dòng X-Q1, X-Q2, X-Q4 thêm ở bản 0.6 vì cổng-N2, đều theo hướng chặt

| # | Tệp · ca | Finding | Kỳ vọng mới | Task |
|---|---|---|---|---|
| X-G7 | `tests/z4-pointer-guard.test.ts` · «G7 34d without a transaction context nothing is stored: an IBS_HI project is answered by the guard, any other project by row-level security» | CX1 | Dự án `IBS_HI` và dự án khác nhận **cùng** câu trả lời: `code` là `42501`, `message` là `new row violates row-level security policy for table "ai_drafts"`; không cái nào mang `LTZ01`; số dòng 0. Tên mới: «G7 34d without a transaction context nothing is stored and nothing is told: an IBS_HI project and any other project get the same answer, the one row-level security gives» | F1 |
| X-G9 | cùng tệp · «G9 what the AI role can tell apart is one bit, and this test says so: …» | CX1 | Với phạm vi khai `[ids.sales]`: dòng của `ids.transport` (`IBS_HI`) và dòng của `sameBuProject` cho `{code,message}` **bằng nhau**, `code` là `42501`. Với phạm vi khai `[ids.transport]`: dòng của `ids.transport` nhận `LTZ01`. Số dòng 0. Tên mới: «G9 a role bound by row-level security cannot tell an IBS_HI project outside its declared scope from any other: the same SQLSTATE and the same message; inside the declared scope the guard answers LTZ01» | F1 |
| X-G12 | cùng tệp · «G12 running 022 again changes nothing: …» | CX1, CX4 | Danh sách trigger: `intelligence.ai_drafts` → `['ai_drafts_declared_scope_guard','ai_drafts_immutable','ai_drafts_pointer_only_guard']`; `public.draft_decisions` không đổi; **thêm** `public.project_domain_mappings` → `['project_domain_mappings_draft_lock','project_domain_mappings_immutable']`. Ba trigger của 022: `tgenabled='O'`, `tgtype=7`. So thân của **từng** hàm trong ba hàm với tệp, và `prosecdef`, `proconfig` của ba hàm với bảng ở Task F1 (guard có thêm `lock_timeout=5s`). Các khẳng định còn lại giữ | F1 |
| X-RB1 | `tests/migrations-rollback.test.ts` · «rollback 022 refuses while a later migration is applied, drops the guard trigger and its function, …» | CX1, CX4 | 022 nay có ba trigger và ba hàm: trước khi lùi đủ ba và ba; sau khi lùi không còn cái nào; ba trigger của 021 và trigger `project_domain_mappings_immutable` của 013 nguyên; số dòng nháp, quyết định và ánh xạ nguyên. Tên đổi «the guard trigger and its function» thành «the three triggers and three functions of 022» | F1 |
| X-Q7 | `tests/suggestions.test.ts` · «dừng tại OQ-55: a document draft is not touched by the placeholder» | CX2 | Lật lại: nháp tài liệu của dự án có chữ đang ẩn bị che `['PROJECT_TEXT_HIDDEN']` và lệnh xác nhận trả `DRAFT_HELD` có mã đó; với cờ còn thì được trả và xác nhận được. Ca được viết lại thành W1 và W2 của Task F2 | F2 |
| X-M10 | cùng tệp · «M10 a reader without the authority, and any reader of a document draft, causes no read of the message tables» | CX2 | Nửa «người không có quyền» giữ nguyên. Nửa nháp tài liệu: người có quyền đọc gây **đúng một** câu lệnh nêu `source_events` — câu `SELECT EXISTS(… ) AS hidden` — và không câu nào nêu `intake_candidates`. Tên mới: «M10 a reader without the authority causes no read of the message tables; a reader of a document draft causes exactly one, a single boolean for the project» | F2 |
| X-P3 | cùng tệp · «P3 whatever masks a draft at read time holds it at confirmation» | CX2 | Thêm cách dựng cho `PROJECT_TEXT_HIDDEN` (đứng trước `POINTER_ONLY_PROJECT`) và thêm mã đó vào danh sách chữ đã sắp. Phần còn lại giữ | F2 |
| X-Q1 | cùng tệp · «dừng tại OQ-55: a candidate draft that names no message is masked once the stored text of its thread is no longer shown» (`:1165`; khẳng định ở `:1169`) | cổng-N2 | `maskReasons` của `pm` đọc bằng `none()` thành `['PROJECT_TEXT_HIDDEN','THREAD_TEXT_HIDDEN']`. Hai khẳng định kia của ca — `member`: `['CONFIRM_AUTHORITY_REQUIRED']`; `svc()`: `[]` — giữ. Tên giữ | F2 |
| X-Q2 | cùng tệp · «dừng tại OQ-55: a thread whose newest revision is pointer-only but an earlier revision stored text still masks its candidate drafts when the group is not flagged» (`:1178`; `:1185`) | cổng-N2 | `['PROJECT_TEXT_HIDDEN','THREAD_TEXT_HIDDEN']`. Tên giữ | F2 |
| X-Q4 | cùng tệp · «a draft that cites a message of such a thread carries both reasons» (`:1206`; `:1211`) | cổng-N2 | `['PROJECT_TEXT_HIDDEN','TEXT_NOT_VISIBLE','THREAD_TEXT_HIDDEN']`. Tên: «a draft that cites a message of such a thread carries the reason of the cited message and both placeholder reasons» | F2 |

**Đổi phần hạ tầng, không đổi điều khẳng định**

| # | Tệp · ca | Vì sao | Đổi gì | Task |
|---|---|---|---|---|
| I-1 | `tests/z4-schema.test.ts` · «running 021 again changes nothing: …» | 022 nay có hai trigger trên `intelligence.ai_drafts` | điều kiện `tgname <> 'ai_drafts_pointer_only_guard'` thành `tgname NOT IN ('ai_drafts_pointer_only_guard','ai_drafts_declared_scope_guard')`; mọi `expect` giữ (G12 khẳng định danh sách đầy đủ) | F1 |
| I-2 | `tests/z4-pointer-guard.test.ts` · G8 | thêm khẳng định, không đổi cái có sẵn | hai hàm mới không gọi được bởi `libetech_ai` (xem G20) | F1 |
| I-3 | `tests/suggestions.test.ts` · nhóm «Z4 drafts: a draft whose thread moved on is held (OQ-46)» | nhóm ca mới của Task F3 dùng lại bốn helper của nhóm này | bốn hằng `intakeSvc`, `reply`, `edit`, `draftNaming` dời ra phạm vi tệp, không đổi chữ | F3 |

**Đổi kỳ vọng vì quyết định phạm vi của Chairman (phương án B)** — nguồn: khối quyết định ở `docs/OPEN-QUESTIONS.md:928`. Không phải nới ca, và không phải đổi vì cổng Codex. Đây là **mọi** ca hiện có đang xác nhận thành công một nháp ứng viên qua dịch vụ — tìm bằng mã: mọi lời gọi `decide` với `result:'confirmed'` trên một nháp `intake_candidate` trong `tests/`. Có mười một ca, tất cả ở `tests/suggestions.test.ts`; số dòng là của tệp ở `83d5e2f`. «Giữ-đúng-một» là `heldOnly(…,'SUBJECT_ORDER_UNVERIFIED')` (helper của Task F3). Cột cuối nói tính chất mà ca từng kiểm bằng một lệnh xác nhận thành công nay được ghim bằng gì.

| # | Dòng | Ca | Lệnh xác nhận từng kiểm điều gì | Nay đổi thành | Tính chất nay được ghim bằng |
|---|---|---|---|---|---|
| E1 | `:293` (lệnh ở `:307`) | «the confirmer's own scope decides: a draft citing a source the confirmer cannot read, a source of another project, or a message whose text is now hidden is held» | khi chữ được hiện, chính nháp đó không còn bị giữ vì `TEXT_NOT_VISIBLE` | lệnh cuối: giữ-đúng-một; `zeroDecisions()` thay cho «1 quyết định». Tên giữ | chỉ còn ghim «bị giữ», nhưng với đúng một mã: `TEXT_NOT_VISIBLE` đã hết |
| E2 | `:397` (`:420-421`) | «R12-e authority: a document draft needs the document ledger rule, a candidate draft needs the project manager, for both results» | điều phối dự án là người duy nhất đi qua được bước quyền của nháp ứng viên, với cả hai kết quả | `ok` thành giữ-đúng-một (422 `DRAFT_HELD`, không phải 403 `MANAGER_REQUIRED`); số quyết định vẫn bằng `decisions`. Ý `rejected` của `c2` thành `toMatchObject({result:'rejected',documentRevisionId:null})`. Ý `INVALID_INPUT` của `c3` **không đổi** (nhờ dời dòng, X4). Tên giữ | quyền với `confirmed`: người không phải điều phối nhận 403 (không đổi), điều phối đi qua bước quyền tới bước giữ. Hình dạng quyết định của nháp ứng viên (không có bản): chuyển sang lệnh từ chối |
| E3 | `:564` (`:574-575`) | «F12-2 a message cited only in sources, or only through duplicateOf, is held once its text is hidden; with the text shown the same drafts are confirmed» | khi chữ được hiện, hai nháp (nêu tin qua `sources`, qua `duplicateOf`) không còn bị giữ | giữ-đúng-một cho cả hai; số quyết định của nháp đó vẫn 0. Đuôi tên «the same drafts are confirmed» thành «the same drafts are held for the OQ-53 (3) placeholder alone» | chỉ còn ghim «bị giữ» với đúng một mã |
| E4 (K2) | `:604` (`:605`) | «replay after a change of role: lost project or viewer is the 404; a manager lowered to engineer gets the recorded decision without the content» | phát lại một quyết định đã ghi sau khi người gửi mất dự án, thành viewer, hoặc bị hạ xuống `engineer` | quyết định đầu là **lệnh từ chối**: `b={result:'rejected',valueHash:c.valueHash,reason:'Không phù hợp phạm vi'}`, dùng cho cả lệnh đầu và ba lần gửi lại. Mọi khẳng định giữ nguyên chữ. Tên giữ | chuyển sang lệnh từ chối, vẫn trên nháp ứng viên — chỉ nháp ứng viên mới có vai đọc được mà không quyết được |
| E5 | `:658` (`:665`) | «(e) a rejection and a candidate confirmation now claim their key: the same person reusing it for another draft is IDEMPOTENCY_CONFLICT» | lệnh xác nhận nháp ứng viên giữ khoá của nó; khoá đó bị chiếm với nháp khác và với đề xuất tay | dòng `:665` thành hai bước: lệnh xác nhận `c1` với `key2` → giữ-đúng-một và `claims()` vẫn là `base+1` (khoá được trả lại); rồi lệnh **từ chối** `c1` với `key2` → `claims()` là `base+2`. Ba khẳng định `IDEMPOTENCY_CONFLICT` phía sau và «2 quyết định» giữ nguyên chữ. Tên: «(e) a rejection claims its key, for a document draft and for a candidate draft: the same person reusing it for another draft is IDEMPOTENCY_CONFLICT; a held candidate confirmation leaves its key free» | chuyển sang lệnh từ chối. **Không ca nào còn ghim «lệnh xác nhận nháp ứng viên giữ khoá»:** không dựng được khi giữ chỗ còn. Mọi quyết định đi qua một lời gọi giữ khoá duy nhất; với lệnh xác nhận, lời gọi đó được ghim bằng (a), (b), (c) trên nháp tài liệu |
| E6 | `:853` (`:863`) | «L8 decide answers a reader without the authority the same way whatever valueHash is sent and whether or not the draft is decided» | làm cho nháp «đã quyết» để so câu trả lời trước và sau | lệnh ở `:863` thành lệnh từ chối (`reason:'Không phù hợp phạm vi'`). Tên giữ | chuyển sang lệnh từ chối; điều ca khẳng định không đổi |
| E7 (Q9) | `:1215` (`:1220-1221`) | «dừng tại OQ-55: a replayed confirmation of a candidate draft answers with the recorded decision and no content once the group's flag is gone» | phát lại một quyết định đã ghi trả đúng quyết định đó và không trả nội dung khi cờ nhóm đã gỡ | `b={result:'rejected',valueHash:sha(value),reason:'Không đủ căn cứ'}`; `result` là `rejected` ở cả hai lần; các khẳng định khác giữ. Trong tên, «confirmation» thành «rejection» | chuyển sang lệnh từ chối. Phát lại một lệnh **xác nhận** dưới lớp che: ca W6 của Task F2 (nháp tài liệu) |
| E8 (T1) | `:1253` (`:1262-1263`) | «a candidate draft is held once its thread has a message recorded after the newest message the draft names: no decision, the key stays free; a new draft that names the new message is confirmed» | nháp mới nêu tin mới thì không còn bị giữ vì `SUBJECT_CHANGED`; khoá của lệnh bị giữ dùng lại được | lệnh với nháp `y`: giữ-đúng-một; `zeroDecisions()`; `claims()` vẫn là `cmds`; rồi cùng `key` ghi được một lệnh từ chối `y`. Đuôi tên thành «a new draft that names the new message is held for the OQ-53 (3) placeholder alone» | chỉ còn ghim «bị giữ» với đúng một mã (`SUBJECT_CHANGED` đã hết); «khoá còn tự do» nay ghim bằng lệnh từ chối dùng lại khoá |
| E9 (T2) | `:1266` (`:1271-1272`) | «a message the draft does not name, recorded before the newest one it names, does not hold it» | tin không được nêu nhưng ghi trước mốc không gây giữ | giữ-đúng-một. Tên: «a message the draft does not name, recorded before the newest one it names, adds no hold: the draft is held for the OQ-53 (3) placeholder alone» | chỉ còn ghim «bị giữ» với đúng một mã |
| E10 (T3, ý thứ ba) | `:1275` (`:1291`) | «dừng tại OQ-53 (1): an edit recorded at or after the newest named message holds the draft as SUBJECT_EDIT_UNVERIFIED, …; an edit recorded before the newest named message does not» | bản sửa ghi trước mốc không gây `SUBJECT_EDIT_UNVERIFIED` | giữ-đúng-một. Tên giữ | chỉ còn ghim «bị giữ» với đúng một mã |
| E11 (T5) | `:1306` (`:1312-1315`) | «a held candidate draft can still be rejected; a recorded confirmation replays unchanged after a new message arrives» | một quyết định đã ghi được phát lại nguyên vẹn sau khi luồng có tin mới | nửa sau: `b={result:'rejected',valueHash:y.valueHash,reason:'Chưa đủ căn cứ'}`; `first.decision?.result` là `rejected`; lần gửi lại vẫn bằng `first`; vẫn 1 dòng. Trong tên, «a recorded confirmation» thành «a recorded decision» | chuyển sang lệnh từ chối. Phát lại một lệnh **xác nhận** sau khi đối tượng đổi: ca D4 (nháp tài liệu) |

Tóm lại theo ba cách ghim: **chỉ còn ghim «bị giữ», với đúng một mã** — E1, E3, E8, E9, E10 và ý `confirmed` của E2; **chuyển sang lệnh từ chối** — E4, E5, E6, E7, E11; **chuyển sang nháp tài liệu** — không ca nào phải dời, vì ba tính chất chỉ lệnh xác nhận mới có (giữ khoá, phát lại dưới lớp che, phát lại sau khi đối tượng đổi) đã có ca song sinh trên nháp tài liệu: (a)–(c), W6, D4. Ba tính chất đó **không còn ca nào ghim riêng cho nháp ứng viên** cho tới khi giữ chỗ được gỡ (R36). **Bản 0.7:** thêm E12 (R12-i) — ca thứ mười hai đổi kỳ vọng vì CX3, thuộc loại «lệnh bị giữ kèm `revision`», không phải lệnh xác nhận thành công; xem 07.6.

**Đã soát, không đổi, phải xanh nguyên chữ.** `tests/z4-schema.test.ts`: «the AI role writes drafts only inside its tenant, project and principal» (bảy lệnh chèn bị từ chối chờ `/row-level security|permission denied/`: nay do trigger mới trả, cùng câu), «drafts return nothing without RLS context» (chờ `/row-level security/`), bốn ca canh của role AI. `tests/z4-pointer-guard.test.ts`: G1–G6, G10, G11, G13–G18 — G4 và G15 chờ `/row-level security/` và mã khác `LTZ01`, nay do trigger mới trả; G16, G17 chỉ chèn dòng trong phạm vi nên vẫn `LTZ02`. `tests/suggestions.test.ts`: M2 và ca `POINTER_ONLY_PROJECT` của P3 dùng phép «chứa»; M9 chờ đúng `['POINTER_ONLY_PROJECT']` và dự án của nó không có tin nào; M4, M5, M8, L2, L7, L9 đọc nháp tài liệu bằng dịch vụ có cờ nhóm còn. `tests/suggestions-concurrency.test.ts` dựng dịch vụ với danh sách nhóm rỗng cho nháp tài liệu nhưng không nhận tin nào: không đổi — nếu về sau một ca ở tệp đó nhận tin thì nháp tài liệu của nó sẽ bị giữ. `tests/project-registry.test.ts`, `tests/fix-wave-db.test.ts`, `tests/rls-catalog.test.ts`, `tests/outbox-schema.test.ts`, và ca RB2: không đổi.

**Đã soát riêng cho quyết định (B), không đổi.** «P3 whatever masks a draft at read time holds it at confirmation» (`:1037`): hai cách dựng dùng nháp ứng viên chờ `DRAFT_HELD` và «câu giữ có chứa mã» — ca này đổi vì CX2 (X-P3), không đổi vì (B). Q3 (`:1188`): hai lệnh bị giữ chờ «chứa mã», một lệnh từ chối. Hai ý đầu của T3 (`:1278`, `:1283`), T4 (`:1294`), nửa đầu của T1 (`:1257-1258`): `held(…)` kèm `not.toContain('SUBJECT_CHANGED')` hoặc `not.toContain('SUBJECT_EDIT_UNVERIFIED')` — tên mã mới không chứa chuỗi nào trong hai chuỗi đó. M7 (`:976`) và L6 (`:822`) dùng lệnh từ chối; M9 (`:1003`) dùng nháp tài liệu và lệnh từ chối. Các ý `MANAGER_REQUIRED` của R12-e và L8: quyền được kiểm trước bước giữ. Dùng nháp tài liệu, không bị chạm: «the context is built under the confirming person, not a wider principal» (`:310`), «step 6 …» (`:434`), bảy ca của nhóm «a draft whose document moved on is held (OQ-46)» (`:456-527`), F12-1, các ca (a)–(d), (f), (g), và cả năm ca của `tests/suggestions-concurrency.test.ts`. Các dòng `draft_decisions` có `result` là `confirmed` trong `tests/z4-schema.test.ts` và `tests/migrations-rollback.test.ts` được chèn thô, không qua dịch vụ: bất biến của CSDL cho `draft_decisions` không bị chạm.

**Đã soát riêng cho việc mở rộng sang nháp ứng viên (cổng-N2), không đổi.** Mọi khẳng định về `maskReasons` trong `tests/suggestions.test.ts` đã được đối chiếu (`/usr/bin/grep -n "maskReasons"`, số dòng của tệp ở `83d5e2f`). Ngoài ba dòng của X-Q1, X-Q2, X-Q4, các khẳng định bằng-đúng trên một nháp ứng viên đều đọc bằng dịch vụ có cờ nhóm còn, nên dự án không có chữ đang ẩn: L1 (`:743`), L9 (`:874`), M1 ở `:896` (lúc đó dự án mới có một tin lưu con trỏ) và ở `:905`, M2 sau khi dự án về `XECA` (`:918`), M3 (`:932`), Q1 ở `:1174`. Dùng phép «chứa»: M1 (`:901`), M2 (`:913`), M7 (`:979`), P3 (`:1074`), Q9 (`:1224`). Của người không có quyền, người mà câu lệnh theo dự án không bao giờ chạy cho: `:611`, `:750`, `:1172`. M8 (`:992`) chỉ khẳng định `value` và `sources`. Các lệnh xác nhận nháp ứng viên bằng dịch vụ danh sách rỗng — E1 (`:304`), E3 (`:571`), Q3 (`:1192`, `:1202`) — chờ «câu giữ có chứa mã». L3 và L4: phần của `member` không gây câu lệnh theo dự án; phần của `pm` chỉ chờ «có chứa». M9 (`:1009`) chờ đúng `['POINTER_ONLY_PROJECT']` trên một nháp tài liệu của dự án không có tin nào.

---

### Task F1: Migration 022, vòng sửa 1 — trigger phạm vi đã khai (CX1) và khoá theo dự án có trần chờ (CX4) — **review riêng**: `liberico-database-reviewer` và `liberico-security-reviewer`

**Tệp:** thay toàn bộ nội dung `migrations/022_ai_drafts_pointer_only_guard.sql` và `migrations/rollback/022_ai_drafts_pointer_only_guard.sql` bằng hai khối dưới (đúng từng byte; ca G12 so thân hàm với tệp); sửa `tests/z4-pointer-guard.test.ts`, `tests/migrations-rollback.test.ts` (X-RB1, RB3), `tests/z4-schema.test.ts` (I-1), `tests/suggestions-concurrency.test.ts` (Y1, Y2). Không sửa tệp nào dưới `src/`. Khối SQL của Task 1 ở phần trên là nội dung của tệp ở bản 0.4 và nay là lịch sử. **Hai khối dưới là nguồn để chép**; chúng là bản cuối của bản 0.6. **[Bản 0.7: Task F1 đã commit ở `cb1d7dc` đúng như tả dưới đây. Task F1b (mục 07.5) sau đó thay phần chú thích đầu tệp và hai hàm `ai_drafts_pointer_only_guard`, `project_domain_mappings_draft_lock`, đổi bảng `proconfig`, và đổi các ca G4, G11, G12, G19, G20, G21, G22, G25, G27, Y2, RB3 cùng helper `answer()`. Khối SQL thuận, bảng `proconfig` và chữ của các ca đó ở dưới là lịch sử. Hàm phạm vi, các câu lệnh của tệp lùi, G7, G9, G23, G24, G26, Y1, RB1 không đổi.]**

**Tệp thuận sau vòng sửa:**

```sql
-- OQ-45 point 3 (b), decided by the Chairman on 18/11/2026: an AI draft of a project whose latest domain mapping is IBS_HI is refused when it is
-- written (AGENTS.md:16). Three BEFORE INSERT row triggers and no grant:
-- 1. ai_drafts_declared_scope_guard (SECURITY INVOKER; fires first: triggers of one event fire in name order). For a role that row-level security
--    binds on intelligence.ai_drafts, a row that the insert policy ai_insert (021) would refuse is refused here, with the policy's own answer (42501),
--    before any mapping is read: such a role cannot tell an IBS_HI project outside the scope it declared from any other project. The scope is the one
--    the role declared (app.*); what a holder of the role may declare is the business of the AI login design, not of this file.
-- 2. ai_drafts_pointer_only_guard (SECURITY DEFINER, owned by the migration login). It refuses a transaction that is not READ COMMITTED (LTZ02), takes
--    a shared advisory lock on the project, then reads the mapping row with the highest mapping_version of the row's own tenant and project (the rule
--    of isIbsHiSql in src/server/source-text.ts) and refuses IBS_HI (LTZ01). Unmapped and other labels decide nothing. row_security = off makes it fail
--    closed: an owner that row-level security would filter gets an error, never an empty read. It binds every writer, the operational login included.
-- 3. project_domain_mappings_draft_lock on public.project_domain_mappings (SECURITY INVOKER). A mapping insert takes the same advisory lock exclusively,
--    so a draft insert and a mapping insert of one project take turns: the guard reads a mapping that is committed, or the mapping waits for the draft
--    and the draft was stored first. The mapping table is append-only (013): INSERT is its only write. Key: (1346653516, hashtext(project_id::text)).
-- An advisory lock has no access control: any role of the database can take this key. Functions 2 and 3 therefore wait for it under a lock_timeout of
-- their own (5s, set in the function definition, whatever the session says): a wait that long ends in 55P03 and the statement writes nothing.
-- libetech_ai is granted nothing and can call none of the three functions. Apply as the migration login (a superuser), like 019–021.
-- Nothing here switches anything on: no login, no password, no key, no membership, no grant, no model. No data rows except schema_migrations.
-- Rollback: migrations/rollback/022_ai_drafts_pointer_only_guard.sql (refuses while a later migration is recorded).
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION intelligence.ai_drafts_declared_scope_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  -- Judged only for a role that row-level security binds on this table: the operational login is not bound and goes on to the pointer-only guard.
  -- The outer IF stands alone, so a role that is not bound never evaluates the app.* settings below.
  IF pg_catalog.row_security_active(TG_RELID) THEN
    -- The condition is the WITH CHECK of the policy ai_insert (021), word for word, on the new row. The answer is the one the policy itself gives.
    IF (
         NEW.tenant_id = nullif(pg_catalog.current_setting('app.tenant_id', true), '')::uuid
         AND NEW.project_id = ANY(pg_catalog.string_to_array(coalesce(pg_catalog.current_setting('app.project_ids', true), ''), ',')::uuid[])
         AND NEW.ai_principal_id = nullif(pg_catalog.current_setting('app.ai_principal_id', true), '')::uuid
       ) IS NOT TRUE THEN
      RAISE EXCEPTION 'new row violates row-level security policy for table "%"', TG_TABLE_NAME USING ERRCODE = '42501',
        HINT = 'Raised by the trigger ai_drafts_declared_scope_guard (migration 022), which mirrors the WITH CHECK of the policy ai_insert. If the policy would let this row through, the two have drifted apart: correct the trigger; do not relax row-level security.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION intelligence.ai_drafts_declared_scope_guard() FROM PUBLIC;

CREATE OR REPLACE FUNCTION intelligence.ai_drafts_pointer_only_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp SET row_security = off SET lock_timeout = '5s' AS $$
DECLARE latest text;
BEGIN
  -- The mapping is read under the snapshot of the calling transaction. Only READ COMMITTED gives this statement a fresh one: a REPEATABLE READ or
  -- SERIALIZABLE transaction opened before an IBS_HI mapping was committed would not see it and the draft would be stored (measured on PostgreSQL 16).
  -- Any other isolation level is refused, whatever the project.
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'An AI draft is written in a READ COMMITTED transaction' USING ERRCODE = 'LTZ02';
  END IF;
  -- Shared with other draft inserts, exclusive against a mapping insert of the same project (project_domain_mappings_draft_lock). It is a statement of
  -- its own, before the read: the read below then takes its snapshot after the wait and sees a mapping that was committed meanwhile.
  -- The wait is capped by the lock_timeout of this function: past it the insert fails with 55P03 and no draft is stored.
  PERFORM pg_catalog.pg_advisory_xact_lock_shared(1346653516, pg_catalog.hashtext(NEW.project_id::text));
  SELECT m.domain_code INTO latest FROM public.project_domain_mappings m
   WHERE m.tenant_id = NEW.tenant_id AND m.project_id = NEW.project_id
   ORDER BY m.mapping_version DESC LIMIT 1;
  IF latest = 'IBS_HI' THEN
    RAISE EXCEPTION 'An AI draft is not stored for a pointer-only project' USING ERRCODE = 'LTZ01';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION intelligence.ai_drafts_pointer_only_guard() FROM PUBLIC;

CREATE OR REPLACE FUNCTION intelligence.project_domain_mappings_draft_lock() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp SET lock_timeout = '5s' AS $$
BEGIN
  -- Held to the end of the transaction that writes the mapping: a draft insert of this project waits for it, and it waits for draft inserts in flight.
  -- The wait is capped by the lock_timeout of this function: past it the insert fails with 55P03 and no mapping is written. Whoever holds the key
  -- shows in pg_locks (locktype advisory, classid 1346653516).
  PERFORM pg_catalog.pg_advisory_xact_lock(1346653516, pg_catalog.hashtext(NEW.project_id::text));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION intelligence.project_domain_mappings_draft_lock() FROM PUBLIC;

DROP TRIGGER IF EXISTS ai_drafts_declared_scope_guard ON intelligence.ai_drafts;
CREATE TRIGGER ai_drafts_declared_scope_guard BEFORE INSERT ON intelligence.ai_drafts
  FOR EACH ROW EXECUTE FUNCTION intelligence.ai_drafts_declared_scope_guard();
DROP TRIGGER IF EXISTS ai_drafts_pointer_only_guard ON intelligence.ai_drafts;
CREATE TRIGGER ai_drafts_pointer_only_guard BEFORE INSERT ON intelligence.ai_drafts
  FOR EACH ROW EXECUTE FUNCTION intelligence.ai_drafts_pointer_only_guard();
DROP TRIGGER IF EXISTS project_domain_mappings_draft_lock ON public.project_domain_mappings;
CREATE TRIGGER project_domain_mappings_draft_lock BEFORE INSERT ON public.project_domain_mappings
  FOR EACH ROW EXECUTE FUNCTION intelligence.project_domain_mappings_draft_lock();

INSERT INTO schema_migrations(version) VALUES('022') ON CONFLICT(version) DO NOTHING;
COMMIT;
```

**Tệp lùi sau vòng sửa:**

```sql
-- Rollback of 022 only. Throwaway test copy use; never run against production data without Chairman approval.
-- Order: roll back 022 before 021. Refuses while a later migration is recorded. No CASCADE. No data is touched: drafts, decisions and mappings stay.
-- Removing the guards re-opens the write of an AI draft for an IBS_HI project (OQ-45 point 3 (b) is then enforced nowhere at write time).
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$ DECLARE f text; BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version > '022') THEN
    RAISE EXCEPTION 'Roll back the later migrations before 022.';
  END IF;
  -- dynamic and guarded, so the file can run again after a trigger, a function, a table or the schema is gone, and on a database that holds an
  -- earlier body of 022 (one trigger, one function)
  IF pg_catalog.to_regclass('intelligence.ai_drafts') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS ai_drafts_pointer_only_guard ON intelligence.ai_drafts';
    EXECUTE 'DROP TRIGGER IF EXISTS ai_drafts_declared_scope_guard ON intelligence.ai_drafts';
  END IF;
  IF pg_catalog.to_regclass('public.project_domain_mappings') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS project_domain_mappings_draft_lock ON public.project_domain_mappings';
  END IF;
  FOREACH f IN ARRAY ARRAY['intelligence.ai_drafts_pointer_only_guard()', 'intelligence.ai_drafts_declared_scope_guard()', 'intelligence.project_domain_mappings_draft_lock()'] LOOP
    IF pg_catalog.to_regprocedure(f) IS NOT NULL THEN
      EXECUTE 'DROP FUNCTION ' || f;
    END IF;
  END LOOP;
END $$;
DELETE FROM schema_migrations WHERE version = '022';
COMMIT;
```

Hai khối trên đã được planner chạy lại trên PGlite ở bản 0.6, như tệp migration, lên CSDL do các migration của repo dựng (tức đang mang đúng thân của bản 0.4): áp tệp thuận cho hình dạng mới — ba trigger `tgenabled='O'`, `tgtype=7`, ba hàm; áp lần hai không đổi gì; thân của ba hàm trong catalog bằng đúng chữ trong tệp; trong thân guard, phép kiểm mức cô lập đứng trước lệnh khoá, lệnh khoá đứng trước câu đọc ánh xạ; tệp lùi bị chặn khi có `'023'` và không gỡ gì; tệp lùi gỡ sạch (không còn trigger, hàm hay dòng `'022'` nào); tệp lùi chạy lần hai không lỗi; tệp thuận áp lại cho đúng hình dạng cũ; các luật chữ của G12 đúng với tệp mới. PGlite 0.5.15 tự báo là PostgreSQL 18.6; lượt PostgreSQL 16 là của phiên chính. **Tệp lùi của bản 0.4 không gỡ hết thân mới** (để lại trigger phạm vi và trigger khoá): CSDL thử native đã ghi `'022'` phải được lùi bằng tệp lùi **mới** rồi để harness áp lại (R37). Tệp 022 được sửa tại chỗ vì nó chưa từng được áp ở đâu ngoài CSDL thử của PR.

`proconfig` phải có sau khi áp (đã đo), dùng ở G12 và G20:

| Hàm | `prosecdef` | `proconfig`, đúng thứ tự |
|---|---|---|
| `intelligence.ai_drafts_declared_scope_guard` | `false` | `['search_path=pg_catalog, pg_temp']` |
| `intelligence.ai_drafts_pointer_only_guard` | `true` | `['search_path=pg_catalog, pg_temp','row_security=off','lock_timeout=5s']` |
| `intelligence.project_domain_mappings_draft_lock` | `false` | `['search_path=pg_catalog, pg_temp','lock_timeout=5s']` |

**Phần A — CX1. Ca kiểm viết trước** (`tests/z4-pointer-guard.test.ts`). `RLS='new row violates row-level security policy for table "ai_drafts"'`. «Hai dự án» = `ids.transport` (đã ánh xạ `IBS_HI`) và `sameBuProject` (chưa ánh xạ); phạm vi đã khai là `[ids.sales]` trừ khi nói khác.

- [ ] Sửa G7 và G9 đúng như X-G7, X-G9.
- [ ] **G19 `the declared-scope guard answers for every row the insert policy would refuse, with the policy's own words, whether or not the project is IBS_HI`** — sáu kiểu dòng bị policy từ chối, mỗi kiểu chèn một lần cho từng dự án trong hai dự án: (a) dự án của dòng không nằm trong danh sách đã khai; (b) `tenant_id` của dòng là `ids.otherTenant` (phạm vi khai chính dự án đó); (c) `ai_principal_id` của dòng là một uuid khác; (d) không khai `app.ai_principal_id`; (e) khai `app.tenant_id` là `ids.otherTenant`; (f) không khai gì (như G7). Với cả mười hai lệnh: `code` là `42501`, `message` bằng đúng `RLS`, không cái nào là `LTZ01`; số dòng không đổi. Rồi lấy câu trả lời của **chính RLS**, so **cả `code` lẫn `message`** (cổng-C2: helper `probe` chỉ trả `message`, nên không dùng nó ở đây): `const own=await refusal(h.operator.transaction(async tx=>{…}))`, trong giao dịch đó login vận hành tắt riêng trigger `ai_drafts_declared_scope_guard` (lệnh tắt trigger của chủ bảng), chuyển sang role AI với phạm vi `[ids.sales]`, chèn một dòng cho `sameBuProject`, rồi — nếu lệnh chèn không ném — `throw new Error('must not be stored')` để giao dịch **luôn lùi** và trigger không bao giờ ở lại trạng thái tắt. `own` có `code` là `42501` và `message` bằng đúng `RLS`. Đỏ hôm nay: sáu lệnh của dự án `IBS_HI` nhận `LTZ01`.
- [ ] **G20 `the role cannot switch the scope guard off, and cannot call or change the functions of 022`** — dưới `asAi`: `SET LOCAL session_replication_role = replica` → `/permission denied/`; lệnh tắt trigger `ai_drafts_declared_scope_guard` → bị từ chối (`/must be owner|permission denied/`); `SELECT intelligence.ai_drafts_declared_scope_guard()` và `SELECT intelligence.project_domain_mappings_draft_lock()` → `/permission denied/`. Từ catalog, cho hai hàm mới: `prosecdef` và `proconfig` bằng **đúng** bảng ở trên; ACL chỉ có chủ hàm; `has_function_privilege('libetech_ai', oid, 'EXECUTE')` là `false`. Truy vấn của ca canh definer vẫn trả rỗng. **Một ý là đối chứng, ghi rõ trong chú thích của ca** (cổng-C3): sau `SET LOCAL row_security = off`, lệnh chèn ngoài phạm vi cho hai dự án nhận `{code,message}` **bằng nhau** và khác `LTZ01` — PostgreSQL từ chối lệnh của role chịu RLS trước mọi trigger, nên ý này xanh hôm nay và xanh dù có trigger phạm vi hay không (đo trên PGlite: `42501`, «query would be affected by row-level security policy for table "ai_drafts"»). Đỏ hôm nay: hai hàm chưa có nên các ý `/permission denied/` và catalog không khớp. (Planner đã đo mọi ý trừ lệnh tắt trigger dưới role AI.)
- [ ] **G25 `the insert policy that the scope guard mirrors is pinned: one INSERT policy on intelligence.ai_drafts, permissive, for libetech_ai, with this WITH CHECK, and no restrictive policy`** (cổng-C1; ghim, xanh từ đầu) — `SELECT polname, polcmd, polpermissive, (SELECT array_agg(rolname::text ORDER BY 1) FROM pg_roles WHERE oid=ANY(polroles)) roles, pg_get_expr(polwithcheck,polrelid) with_check FROM pg_policy WHERE polrelid='intelligence.ai_drafts'::regclass ORDER BY 1`. Mọi dòng có `polpermissive` là `true`. Các dòng có `polcmd` thuộc `('a','*')` — policy áp cho `INSERT` — là **đúng một** dòng: `{polname:'ai_insert', polcmd:'a', polpermissive:true, roles:['libetech_ai'], with_check:AI_INSERT_CHECK}`. Hằng viết trong tệp test, đo trên PGlite:
  ```ts
  // Changing this constant means changing the scope guard of migration 022 (intelligence.ai_drafts_declared_scope_guard): the trigger mirrors this expression.
  // A stricter policy, or a restrictive one, would let a row past the trigger that row-level security refuses: the definer guard would answer first again.
  const AI_INSERT_CHECK="((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid) AND (project_id = ANY ((string_to_array(COALESCE(current_setting('app.project_ids'::text, true), ''::text), ','::text))::uuid[])) AND (ai_principal_id = (NULLIF(current_setting('app.ai_principal_id'::text, true), ''::text))::uuid))";
  ```
  Nếu PostgreSQL 16 in biểu thức khác PGlite: **dừng và báo**, không nới ca thành «chứa».
- [ ] **G26 `whatever the statement, a row outside the declared scope gets one answer for an IBS_HI project and for any other: MERGE, a multi-row insert in both orders, the statement of submitDraft on a stored key, a setting that is not a uuid`** (cổng-C2) — mỗi hình dạng chạy một lần cho từng dự án trong hai dự án; với từng hình dạng, hai câu trả lời có `{code,message}` **bằng nhau** và `code` khác `LTZ01`; số dòng không đổi:
  1. `MERGE INTO intelligence.ai_drafts d USING (SELECT 1) s ON false WHEN NOT MATCHED THEN INSERT …` dưới role AI (như G18, nhưng ngoài phạm vi) → `42501`, `RLS`;
  2. một lệnh chèn hai dòng: dòng trong phạm vi (`ids.sales`) rồi dòng ngoài phạm vi → `42501`, `RLS`;
  3. cùng lệnh, thứ tự ngược → `42501`, `RLS`;
  4. đúng câu lệnh của `submitDraft` — `INSERT … ON CONFLICT(tenant_id,dedupe_key) DO NOTHING RETURNING id` — với một `dedupe_key` **đã có** của dự án đó (login vận hành chèn trước một nháp cho mỗi dự án; nháp của `ids.transport` chèn trước khi ánh xạ `IBS_HI`) → `42501`, `RLS`, không phải «0 dòng, không lỗi»;
  5. `app.project_ids` khai là `'x'` → cả hai `22P02`;
  6. `app.tenant_id` khai là `'x'` → cả hai `22P02`.
  Đối chứng trong cùng ca (cổng-R2; xanh từ đầu): login vận hành, trong một giao dịch đã `set_config('app.project_ids','x',true)` và `set_config('app.tenant_id','y',true)`, chèn cho `ids.transport` → `LTZ01`, chèn cho `sameBuProject` → được lưu; không cái nào là `22P02`. Đỏ hôm nay vì `AssertionError` ở cả sáu hình dạng: dự án `IBS_HI` nhận `LTZ01`.

**Phần B — CX4. Ca kiểm viết trước.** `NS=1346653516`. `locks(tx)` = `SELECT mode, objid::bigint AS o, objsubid AS s FROM pg_locks WHERE locktype='advisory' AND classid=$1 AND database=(SELECT oid FROM pg_database WHERE datname=current_database()) ORDER BY 1` với tham số `[NS]` (cổng-C3: lọc theo `classid` và CSDL hiện tại), chạy **trong** giao dịch đang giữ khoá, bằng login vận hành.

- [ ] **G21 `the guard takes a shared lock on the project before it reads the mapping, a mapping insert takes the same lock exclusively, and both are gone when the transaction ends`** — giao dịch 1 (login vận hành): chèn một nháp cho `ids.sales` → `locks` trả đúng một dòng `{mode:'ShareLock', s:2}`. Giao dịch 2: chèn một dòng ánh xạ `XECA` cho `ids.sales` → đúng một dòng `{mode:'ExclusiveLock', s:2}` có `o` **bằng** `o` của giao dịch 1; chèn thêm một dòng ánh xạ cho `ids.transport` trong cùng giao dịch → hai dòng, `o` khác nhau. Sau mỗi giao dịch, `locks` ngoài giao dịch trả rỗng. `o` của `ids.sales` bằng `SELECT (hashtext($1)::bigint & 4294967295)` với mã dự án. Đỏ hôm nay: không dòng khoá nào.
- [ ] **G22 `a draft insert in the transaction that wrote an IBS_HI mapping is refused; a row without a project is answered by the table`** (đối chứng, xanh từ đầu) — trong một giao dịch: ghi ánh xạ `IBS_HI` cho `ids.sales` rồi chèn nháp cho `ids.sales` → `LTZ01`. Login vận hành chèn dòng có `project_id` là `null` → `23502`. Tên ca không còn nói «takes no lock» (cổng-C3): sau một lệnh bị từ chối, PostgreSQL đã nhả mọi khoá của giao dịch, nên đọc `pg_locks` lúc đó luôn rỗng dù trigger có lấy khoá hay không — một khẳng định như vậy không thể sai.
- [ ] **G23** (`test.skipIf(!native)`: cần hai kết nối) **`a draft insert waits for an uncommitted mapping of its project and then reads it: refused LTZ01 when the mapping commits IBS_HI, stored when the mapping is rolled back`** — kết nối A (login vận hành, một giao dịch): ghi ánh xạ `IBS_HI` cho `ids.transport`, **chưa** commit; khởi động trên kết nối B `aiInsert({project_id:ids.transport},{projects:[ids.transport]})`; `const state=await Promise.race([draft.then(()=>'settled'),waitForBlocked(h,1).then(()=>'blocked')])`; `expect(state).toBe('blocked')`; A commit. Lệnh của B trả `LTZ01`; số dòng không đổi. Lặp lại với một dự án khác mà A **lùi** giao dịch (ném một lỗi đánh dấu sau `waitForBlocked`): lệnh của B trả `null` và nháp được lưu. Đỏ hôm nay vì `AssertionError`: `state` là `'settled'`.
- [ ] **G24** (`test.skipIf(!native)`) **`a mapping insert waits for an open draft insert of its project: the draft is stored first, the mapping commits after it, and the next draft is refused`** — kết nối B (role AI, một giao dịch): chèn nháp cho `ids.transport` (chưa ánh xạ), giữ giao dịch mở; trên kết nối A khởi động `mapDomain(h,ids.transport,'IBS_HI',1)`; cùng phép `Promise.race` → `'blocked'`; B commit; `await` lệnh ghi ánh xạ. Sau đó: nháp của B có trong bảng; ánh xạ mới nhất là `IBS_HI`; một lệnh chèn nháp mới cho `ids.transport` trả `LTZ01`. Trong lúc B còn mở, một lệnh ghi ánh xạ cho `ids.sales` (dự án khác) **không** chờ. Đỏ hôm nay vì `AssertionError`: `state` là `'settled'`.
- [ ] **G27** (`test.skipIf(!native)`; cổng-C4 — nói thẳng phần dư R34, như G9 từng nói thẳng về bit) **`a session of the AI role that holds the advisory key of a project stalls the mapping of that project, and this test says so: its own draft is still stored, the mapping insert fails with 55P03 inside the cap instead of hanging, and once the key is released the mapping goes through and the next draft is refused`** — kết nối B, trong một `h.operator.transaction` được giữ mở bằng một promise: `SET LOCAL ROLE libetech_ai`, khai phạm vi `[ids.transport]`, `SAVEPOINT held`, `SELECT pg_advisory_lock($1::int, hashtext($2))` với `[NS, ids.transport]` (dạng **mức phiên**). (i) Trên chính B: `insertDraft(tx,{project_id:ids.transport})` không ném lỗi. (ii) Trên kết nối A: `const t0=Date.now(); const e=await refusal(mapDomain(h,ids.transport,'IBS_HI',1))` → `e.code` là `'55P03'`; thời gian trôi nằm trong `[4000, 9000)` mili giây (trần 5 giây của hàm; dưới trần 10 giây của câu lệnh); bảng ánh xạ không có dòng nào của `ids.transport`. (iii) B mở khoá và commit; `mapDomain(h,ids.transport,'IBS_HI',1)` qua; nháp của B có trong bảng; một lệnh chèn nháp mới cho `ids.transport` trả `LTZ01`. **Khoá mức phiên không được quay về pool:** B mở khoá trong `finally` — `ROLLBACK TO SAVEPOINT held` nếu giao dịch đã hỏng, rồi `SELECT pg_advisory_unlock($1::int, hashtext($2))`, khẳng định trả `true`; cuối ca, `SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND classid=$1` là 0. Đỏ hôm nay vì `AssertionError`: lệnh ghi ánh xạ không chờ gì và thành công (`e` là `null`).
- [ ] **Y1** (`tests/suggestions-concurrency.test.ts`, trong nhóm native có sẵn; cổng-C9) **`a submitDraft that waited for an uncommitted IBS_HI mapping of its project answers POINTER_ONLY_PROJECT, not a raw database error`** — kết nối A (login vận hành, một giao dịch): ghi ánh xạ `IBS_HI` cho `ids.transport`, chưa commit; `const sent=svc.submitDraft(ai, <phong bì cho một tài liệu của ids.transport>).then(v=>v,e=>e)`; `Promise.race` như G23 → `'blocked'`; A commit; `await sent` là một `AppError` có `{code:'POINTER_ONLY_PROJECT',status:422}`; `intelligence.ai_drafts` không có dòng nào. Đỏ hôm nay vì `AssertionError`: `state` là `'settled'` (lệnh không chờ và nháp được lưu).
- [ ] **Y2** (cùng tệp, native; cổng-N1) **`a submitDraft that waits past the cap of the guard fails with the database error 55P03 and stores nothing; the same envelope is stored once the key is free`** — kết nối A (login vận hành, một giao dịch giữ mở): `SELECT pg_advisory_xact_lock($1::int, hashtext($2))` với `[1346653516, ids.sales]` (dạng mức giao dịch: tự hết khi A kết thúc). `const t0=Date.now(); const e=await svc.submitDraft(ai, envelope).then(()=>null,x=>x)`: `e` khác `null`; `e.code` là `'55P03'`; `e instanceof AppError` là `false`; thời gian trôi trong `[4000, 9000)`; bảng nháp không đổi. A kết thúc; gửi lại **đúng** `envelope` đó (cùng `dedupeKey`) → `{stored:true}`. Đỏ hôm nay vì `AssertionError`: lệnh không chờ và trả `stored:true` (`e` là `null`).

**Chung cho hai phần**

- [ ] Sửa G12 theo X-G12. Đọc thân của từng hàm từ tệp bằng `[...sql.matchAll(/CREATE OR REPLACE FUNCTION (intelligence\.\w+)\(\)[\s\S]*?AS \$\$([\s\S]*?)\$\$;/g)]`: tên phải là, theo thứ tự, `intelligence.ai_drafts_declared_scope_guard`, `intelligence.ai_drafts_pointer_only_guard`, `intelligence.project_domain_mappings_draft_lock`; với từng hàm, `prosrc` đã `trim` bằng thân trong tệp đã `trim` — so **trước** khi áp lại tệp và **sau** khi áp hai lần. `shape()` thêm trigger của `public.project_domain_mappings` và cả ba hàm. `prosecdef` và `proconfig` của ba hàm bằng **đúng** bảng ở trên (`toEqual`, không còn `toContain`). Thứ tự chạy: các trigger `tgtype=7` của `intelligence.ai_drafts`, sắp theo tên, là `['ai_drafts_declared_scope_guard','ai_drafts_pointer_only_guard']`. Trong `prosrc` của guard: vị trí của `'transaction_isolation'` nhỏ hơn vị trí của `pg_advisory_xact_lock_shared`, nhỏ hơn vị trí của `FROM public.project_domain_mappings`. Trong `prosrc` của hàm phạm vi: vị trí của `row_security_active(TG_RELID) THEN` nhỏ hơn vị trí của `current_setting('app.tenant_id'` (hai `IF` lồng nhau, cổng-R2). Các đoạn phải có: guard — `pg_catalog.pg_advisory_xact_lock_shared(1346653516, pg_catalog.hashtext(NEW.project_id::text))`; hàm phạm vi — `IF pg_catalog.row_security_active(TG_RELID) THEN`, `IS NOT TRUE THEN`, `ERRCODE = '42501'`, `HINT = `, và ba vế `NEW.tenant_id =`, `NEW.project_id = ANY`, `NEW.ai_principal_id =`; hàm khoá — `pg_catalog.pg_advisory_xact_lock(1346653516, pg_catalog.hashtext(NEW.project_id::text))`. Các luật về chữ của tệp (không `GRANT`, không tạo role, không `CASCADE`, hai dòng cuối) giữ nguyên.
- [ ] Sửa RB1 theo X-RB1; sửa I-1.
- [ ] **RB3** (`tests/migrations-rollback.test.ts`; cổng-C8) **`022 over a database that carries only the pointer-only trigger and its function gives the three triggers and three functions; the rollback from that shape leaves nothing of 022`** — dựng như RB1 (gỡ các migration sau 022 trước, áp lại ở `finally`). Ghi `full` = hình dạng đầy đủ (ba trigger, ba hàm, như X-RB1). Gỡ tay bằng bốn lệnh của login vận hành: `DROP TRIGGER IF EXISTS ai_drafts_declared_scope_guard ON intelligence.ai_drafts`, `DROP TRIGGER IF EXISTS project_domain_mappings_draft_lock ON public.project_domain_mappings`, `DROP FUNCTION IF EXISTS intelligence.ai_drafts_declared_scope_guard()`, `DROP FUNCTION IF EXISTS intelligence.project_domain_mappings_draft_lock()`; khẳng định còn đúng một trigger và một hàm của 022. (i) Áp tệp thuận → hình dạng bằng `full`. (ii) Gỡ tay lần nữa, chạy tệp lùi → không còn trigger hay hàm nào của 022, `schema_migrations` không còn `'022'`; số dòng nháp và ánh xạ không đổi. `finally`: áp tệp thuận. Đỏ hôm nay vì `AssertionError`: với hai tệp của bản 0.4, bước (i) cho một trigger, một hàm.
- [ ] Chạy đỏ (phần A: G7, G9, G19, G20, G26 đỏ vì `AssertionError`; G25 là ghim, xanh từ đầu; phần B: G21 đỏ vì `AssertionError`; G22 là đối chứng; G12, RB1, RB3 đỏ vì `AssertionError` ở danh sách trigger; G23, G24, G27, Y1, Y2 chỉ native) → thay hai tệp SQL → xanh: `npx vitest run tests/z4-pointer-guard.test.ts tests/z4-schema.test.ts tests/migrations-rollback.test.ts tests/fix-wave-db.test.ts tests/rls-catalog.test.ts tests/project-registry.test.ts tests/outbox-schema.test.ts tests/suggestions.test.ts tests/suggestions-concurrency.test.ts tests/skill-context.test.ts tests/source-text.test.ts tests/intake.test.ts tests/inbox-service.test.ts`. `tests/z4-schema.test.ts` giữ đúng số ca đạt và bỏ qua như trước task; `git diff 83d5e2f -- tests/z4-schema.test.ts` chỉ chạm một dòng truy vấn.
- [ ] Phiên chính: lùi 022 trên CSDL thử native bằng tệp lùi mới, để harness áp lại, rồi chạy cùng lệnh trên PostgreSQL 16 — G23, G24, G27, Y1, Y2 là năm ca duy nhất chứng minh hai chiều chờ, trần 5 giây và mã `55P03`; G25 xác nhận chuỗi `WITH CHECK` trên PostgreSQL 16; không dòng `40P01` trong log. G27 và Y2 mỗi ca chờ trọn một trần 5 giây: bộ ca native dài thêm khoảng 10 giây.

**Điểm commit** (phiên chính): `fix(db): the draft guard answers only inside the declared scope and takes turns with mapping writes under a lock timeout of its own (Codex gate round 1: CX1, CX4)`.

---

### Task F2: Giữ chỗ theo dự án của OQ-55 — nháp tài liệu **và nháp ứng viên** bị che và bị giữ khi dự án có chữ đã lưu mà nay không được hiện (CX2; cổng-N2) — **review riêng**, bắt buộc `liberico-security-reviewer`

**Dừng tại OQ-55: đây là giữ chỗ fail-closed, không phải phương án được chọn.** Nó rộng hơn chữ của phương án (e), vốn chỉ nói nháp tài liệu (X3).

**Tệp:** sửa `src/server/source-text.ts` (thêm một hàm), `src/server/suggestions.ts`, `tests/source-text.test.ts`, `tests/suggestions.test.ts`.

**Giao diện**
```ts
// src/server/source-text.ts — added next to threadHasHiddenText
/**
 * True when project $1 holds at least one revision, of any message, that stored text which the current configuration does not show: its group is not
 * flagged, or the project's latest mapping is IBS_HI. Every revision of every message of the project is looked at: no cap, and not only the newest revision.
 * A flag list that cannot be evaluated (a null element and no match) counts as not flagged: the test is IS NOT TRUE, never NOT.
 * One boolean: no text and no hash leave the database.
 * Closed: a project id that is not a lower-case uuid, a statement that returns no row, and a project the calling transaction cannot see (another tenant,
 * a project outside its scope, an id that does not exist) all give true.
 * tx must be a transaction already scoped to the tenant and project (scoped): the tenant boundary is row-level security.
 */
export async function projectHasHiddenText(tx:Queryable,projectId:string,excerptChats:readonly string[]):Promise<boolean> {
 if(!UUID_LOWER.test(String(projectId))) return true;
 const row=(await tx.query<{hidden:boolean}>(
  `SELECT (NOT EXISTS(SELECT 1 FROM projects p WHERE p.id=$1::uuid)
     OR EXISTS(SELECT 1 FROM source_events e JOIN source_event_revisions r ON r.source_event_id=e.id
      WHERE e.project_id=$1::uuid AND r.project_id=$1::uuid
        AND r.content_mode='excerpt' AND (${textAllowedSql('e','$2')}) IS NOT TRUE)) AS hidden`,[projectId,[...excerptChats]])).rows[0];
 return row?.hidden!==false;
}
```
`src/server/suggestions.ts` (tệp này vẫn **không** viết tên bảng bản sửa của tin, kể cả trong chú thích):
- `MaskReason` thêm `'PROJECT_TEXT_HIDDEN'`; nhập `projectHasHiddenText` từ `./source-text`.
- `present`: một biến `let hiddenProject:boolean|undefined` cho cả lần gọi. Với **mọi** dòng mà người đọc có quyền quyết định — nháp tài liệu lẫn nháp ứng viên — : `hiddenProject??=await projectHasHiddenText(tx,projectId,this.excerptChats)`; đúng → `reasons.add('PROJECT_TEXT_HIDDEN')`. Đặt ngoài nhánh `if(!ctx)…else`. Không gọi cho người không có quyền (dòng `continue` ở đầu vòng lặp đứng trước). Khối `THREAD_TEXT_HIDDEN` của nháp ứng viên giữ nguyên.
- `decide`, nhánh `confirmed`, sau khối `if(ctx)` và trước `if(reasons.size)`, cho **mọi** nháp: `if(await projectHasHiddenText(tx,projectId,this.excerptChats)) reasons.add('PROJECT_TEXT_HIDDEN');`. Đặt ngoài `if(ctx)` để mã có mặt cả khi không dựng được ngữ cảnh.
- Hai chú thích «a document draft has no equivalent check» sửa thành: giữ chỗ theo dự án của OQ-55 cho mọi nháp, fail-closed tới khi Chairman quyết; rộng hơn phương án (e).

**Ca kiểm viết trước**

`tests/source-text.test.ts`, nhóm mới `projectHasHiddenText`:
- [ ] **U1 `projectHasHiddenText: every revision of every message of the project, the current configuration, and closed outside the caller's scope`** — người gọi có cả hai dự án trong phạm vi trừ khi nói khác. Dự án không có tin → `false`; chỉ có tin lưu ở chế độ con trỏ, danh sách rỗng → `false`; dự án **khác** có chữ đang ẩn → dự án này vẫn `false`, dự án kia `true`; tin lưu chữ, danh sách có nhóm → `false`; danh sách rỗng → `true`; thêm bản sửa chỉ con trỏ cho tin đó, danh sách rỗng → vẫn `true`, danh sách có nhóm → `false`; ánh xạ `IBS_HI`, danh sách có nhóm → `true`; ánh xạ `XECA` bản 2 → `false`. **Đóng ngoài phạm vi (cổng-R4), đều với danh sách có nhóm:** người gọi của tenant khác hỏi đúng mã dự án → `true`; người gọi chỉ có dự án khác trong phạm vi → `true`; một mã dự án không có → `true`. Đỏ trước khi có hàm là lỗi thiếu hàm xuất: không tính.
- [ ] **U2 `projectHasHiddenText returns one boolean and no text: the one row handed back holds no excerpt and no content hash`** — qua `recordingDb`: dòng ghi lại có đúng một khoá `hidden`; không chứa chuỗi đánh dấu của tin, không chứa hash nội dung.
- [ ] **U3 `projectHasHiddenText is closed: a list that cannot be evaluated, a statement that returns no row, a malformed project id`** — danh sách `[null]` → `true`; `[null, <nhóm của tin>]` → `false`; một `tx` giả trả `{rows:[]}` → `true`; mã dự án `'x'` → `true` và không câu lệnh nào được gửi. Builder kiểm thêm, mỗi thứ một lần rồi đổi lại: đổi `IS NOT TRUE` thành `NOT` làm ý đầu đỏ; bỏ vế `NOT EXISTS(… projects …)` làm ba ý «đóng ngoài phạm vi» của U1 đỏ — đều vì `AssertionError`.
- [ ] Ca quét có sẵn (hai danh sách tệp nêu `text_excerpt` và bảng bản sửa) xanh **không sửa**.

`tests/suggestions.test.ts`, nhóm mới `Z4 drafts: OQ-55 placeholder by project — stored text that is no longer shown masks and holds every draft of the project (Codex gate, round 1)`. `MARK` là một chuỗi đánh dấu riêng của nhóm; `none()` là dịch vụ dựng với danh sách nhóm rỗng. «Nháp tài liệu ồn» = `out('technical_writer',[d.record.id,<bản mới nhất>],{result:{sections:[{heading:'h',text:MARK,basis:[d.record.id]}],terms:[]}})` gửi qua `submitDraft`: chữ nằm trong `result`, nháp không nêu mã tin nào — đúng kịch bản của CX2.
- [ ] **W1 `dừng tại OQ-55: a document draft is masked while its project holds stored text that is no longer shown, whatever the draft names`** (thay ca X-Q7) — một tin lưu chữ trong dự án (`candidate()`), một nháp tài liệu ồn. `none()`, `pm` đọc: `maskReasons` bằng đúng `['PROJECT_TEXT_HIDDEN']`; `value` là `null`; `sources` là `[]`; câu trả lời không chứa `MARK`. `svc()` (cờ còn): `maskReasons` là `[]` và `value` có `MARK`. Đỏ hôm nay: `maskReasons` là `[]` với `none()`.
- [ ] **W2 `dừng tại OQ-55: what is masked for that reason cannot be confirmed either; it can still be rejected, and the answer of the rejection carries no content`** — cùng cách dựng: `held(decide(none(),pm,draftId,body(valueHash,{revision})),'PROJECT_TEXT_HIDDEN')`; `zeroDecisions()`; `n('document_commands')` không đổi; số bản của tài liệu không đổi. Lệnh từ chối bằng `none()` ghi được quyết định, và câu trả lời của nó (cổng-C6; bản song sinh của M7): `decision.result` là `rejected`, `maskReasons` chứa `PROJECT_TEXT_HIDDEN`, `value` là `null`, chuỗi JSON không chứa `MARK`. Với `svc()`, một nháp tài liệu ồn khác được xác nhận. Đỏ hôm nay: lệnh xác nhận thành công.
- [ ] **W3 `the project decides, not the thread and not the draft: text stored without being shown masks every draft of that project and no draft of another project`** — tin lưu chữ ở `ids.transport` (nhóm `chatTransport`), không tin nào ở `ids.sales`: nháp tài liệu của `ids.sales` đọc bằng `none()` có `maskReasons:[]`; nháp tài liệu của `ids.transport` đọc bằng `none()` có `['PROJECT_TEXT_HIDDEN']`. Thêm một tin lưu chữ ở `ids.sales`: hai nháp tài liệu khác nhau của `ids.sales` đều bị che.
- [ ] **W4 `a project whose messages stored no text masks nothing`** (đối chứng) — `candidate({excerpt:false})`, một nháp tài liệu **và** một nháp ứng viên của chính luồng đó chỉ nêu một tài liệu, `none()`: cả hai có `maskReasons` là `[]`.
- [ ] **W5 `the project statement runs once for a list read by a person who may decide it, for either kind of draft, and never for a reader without the authority`** (viết lại ở bản 0.6, cổng-N2) — dịch vụ dựng trên một tay nắm ghi lại chữ của câu lệnh (như M10); «câu lệnh theo dự án» là câu có chữ `NOT EXISTS(SELECT 1 FROM projects p`. Ba nháp của một tài liệu, `pm` đọc → **đúng một** câu như vậy. Hai nháp của một ứng viên, `pm` đọc → **đúng một**. `member` đọc danh sách nháp ứng viên đó → **không** câu nào như vậy và không câu nào nêu `source_events`.
- [ ] **W6 `a replayed confirmation of a document draft answers with the recorded decision and no content once the project holds hidden text`** — `pm` xác nhận một nháp tài liệu ồn bằng `svc()` với khoá `K`; gửi lại đúng lệnh bằng `none()`: `decision.result` là `confirmed`, cùng `decidedAt`; `maskReasons` chứa `PROJECT_TEXT_HIDDEN`; `value` là `null`; câu trả lời không chứa `MARK`; `draft_decisions` vẫn 1 dòng. (Dự án phải có một tin lưu chữ từ trước.)
- [ ] **W7 `dừng tại OQ-55: a candidate draft that carries the text of another thread of its project is masked while that text is not shown`** (cổng-C7) — luồng T1: `candidate({excerpt:false})` (chỉ con trỏ); luồng T2: `candidate()` (lưu chữ), cùng `ids.sales`. Một dòng chèn thô cho ứng viên của **T1**: `out('intake_analyst',[d.record.id],{claims:[{field:'classification',value:MARK,basis:[]}]})` — không nêu tin nào. `none()`, `pm` đọc: `maskReasons` bằng đúng `['PROJECT_TEXT_HIDDEN']` (không có `THREAD_TEXT_HIDDEN`: T1 chưa từng lưu chữ); `value` là `null`; câu trả lời không chứa `MARK`. `svc()`: `maskReasons` là `[]` và `value` có `MARK`. Đỏ hôm nay vì `AssertionError` (planner đã đo: `[]` và có `MARK`), và vẫn đỏ nếu chỉ làm phần nháp tài liệu.
- [ ] **W8 `the project reason stands when no context can be built: a document draft that points at no document is held for both`** (cổng-C6) — dự án có một tin lưu chữ; `x=await rawDraft({entityType:'document',entityId:randomUUID()})`; `held(decide(none(),pm,x.id,body(sha(x.value),{revision:revisionBody(await doc())})),'ENTITY_NOT_FOUND','PROJECT_TEXT_HIDDEN')`; `zeroDecisions()`. Ghim «đặt ngoài `if(ctx)`». Đỏ hôm nay vì `AssertionError`: câu giữ chỉ có `ENTITY_NOT_FOUND` (planner đã đo).
- [ ] Sửa X-M10, X-P3, X-Q1, X-Q2, X-Q4 đúng như bảng X5. Cách dựng `PROJECT_TEXT_HIDDEN` của P3: một tin lưu chữ, một nháp tài liệu sạch, dịch vụ `none()`.
- [ ] Chạy đỏ (W1, W2, W3 nửa sau, W6, W7, W8 và ba khẳng định của X-Q1, X-Q2, X-Q4 đỏ vì `AssertionError`; ca P3 không biên dịch trước khi có cách dựng mới: không tính) → sửa → xanh: `npx vitest run tests/suggestions.test.ts tests/source-text.test.ts tests/skill-context.test.ts tests/intake.test.ts`; `npm run typecheck`. Mọi ca L, M, Q, T khác ngoài năm ca nêu ở dòng trên xanh **không sửa** (danh sách đã soát ở X5). Phiên chính chạy thêm `tests/suggestions-concurrency.test.ts` trên native.

**Điểm commit** (phiên chính): `fix(suggestions): mask and hold every draft of a project that holds stored text which is no longer shown (OQ-55 placeholder by project; Codex gate round 1: CX2)`.

---

### Task F3: Giữ chỗ của điểm 3 OQ-53 — không nháp ứng viên nào xác nhận được (CX3; quyết định phạm vi của Chairman, phương án B) — **review riêng**, bắt buộc `liberico-security-reviewer`

**Dừng tại điểm 3 của OQ-53: đây là giữ chỗ fail-closed, không phải phương án được chọn.** Làm **sau** Task F2 (cùng hai tệp).

**Tệp:** sửa `src/server/suggestions.ts`, `tests/suggestions.test.ts`. Không tệp nào khác: không migration, không chạm `src/server/intake.ts`, `src/server/source-text.ts`, hai tệp 022.

**Mã** — `decide`, nhánh `confirmed`; ba chỗ, phần còn lại của nhánh giữ nguyên chữ:
```ts
    if(input.result==='confirmed') {
     // a candidate draft takes no revision body: a fault of the command, answered before any hold
     if(d.entity_type!=='document'&&input.revision) throw new AppError('INVALID_INPUT','Nháp gắn ứng viên không kèm bản đề xuất tài liệu.',422);
     // … unchanged: manifest, value hash, context, output gate, THREAD_TEXT_HIDDEN, subjectReasons, and the PROJECT_TEXT_HIDDEN line of Task F2 …
     // OQ-53 point 3 placeholder, fail-closed. Source: the Chairman's scope decision of 18/11/2026 for this PR, option B (docs/OPEN-QUESTIONS.md, the block
     // at the end). Point 3 stays open; this is not a chosen option of it. Lifting the placeholder is removing the one line below.
     //
     // Technical note of the plan, not the Chairman's words: the freshness check above cannot see a message whose intake transaction began earlier and
     // commits later. Every check above still runs and names its code; a rejection is not held; nothing is masked at read time for this.
     if(d.entity_type==='intake_candidate') reasons.add('SUBJECT_ORDER_UNVERIFIED');
     if(reasons.size) throw new AppError('DRAFT_HELD',`Nháp được giữ lại, chưa xác nhận được: ${[...reasons].sort().join(', ')}.`,422);
     if(d.entity_type==='document') {
      if(!input.revision) throw new AppError('REVISION_REQUIRED','Nháp gắn tài liệu cần kèm nội dung bản đề xuất.',422);
      // the inner proposal runs under the claim held above and claims nothing itself
      revisionId=(await this.documents.proposeRevisionIn(tx,p,d.entity_id,input.revision,key,{draftId:id},requestId,{claimHeld:true})).record.latest_revision_id;
     }
    }
```
Nhánh `else if(input.revision) throw new AppError('INVALID_INPUT',…)` ở cuối khối cũ được **bỏ** (đã dời lên đầu). Dòng mới đứng **ngoài** `if(ctx)`. `MaskReason`, `VISIBILITY`, `present`, `list`, `subjectReasons` không đổi. Trong chú thích thứ tự ở đầu `decide`, bước (5) thêm: «a candidate confirmation is always held (OQ-53 point 3 placeholder)».

Hai chú thích ở dòng giữ chỗ tách riêng (cổng-R6): đoạn đầu nêu **nguồn** — quyết định phạm vi của Chairman; đoạn sau là **ghi chú kỹ thuật của kế hoạch**, không phải lời hay lý do của Chairman. Lời Chairman chỉ gồm chuỗi trả lời và chữ của phương án B (đầu mục này). Builder giữ dòng trống `//` giữa hai đoạn.

**Ca kiểm viết trước** (`tests/suggestions.test.ts`)

Helper mới, đặt ngay sau `held`:
```ts
/** A hold whose list of codes is exactly these: no other check stood in the way. */
const heldOnly=async(promise:Promise<unknown>,...reasons:string[])=>{
 const e=await held(promise,...reasons);
 expect(e.message.slice(e.message.indexOf(': ')+2).replace(/\.$/,'').split(', ')).toEqual([...reasons].sort());
 return e;
};
```
Hạ tầng (I-3): bốn hằng `intakeSvc`, `reply`, `edit`, `draftNaming` của nhóm «Z4 drafts: a draft whose thread moved on is held (OQ-46)» được dời ra phạm vi tệp, ngay trên nhóm đó, không đổi chữ (hằng `claims` ở lại trong nhóm).

Nhóm mới, đặt ngay sau nhóm «a draft whose thread moved on is held (OQ-46)»: `Z4 drafts: OQ-53 point 3 placeholder — no candidate draft is confirmed (the Chairman's scope decision of 18/11/2026, option B)`. `P='SUBJECT_ORDER_UNVERIFIED'`.

- [ ] **V1 `dừng tại OQ-53 (3): a candidate draft that passes every other check is held as SUBJECT_ORDER_UNVERIFIED and nothing else; nothing is written and the key stays free`** — `c=await candDraft()`, `key=k()`, `cmds=await n('document_commands')`: `heldOnly(decide(svc(),pm,c.draftId,body(c.valueHash),key),P)`; `zeroDecisions()`; `n('document_commands')` vẫn là `cmds`; rồi `decide(svc(),pm,c.draftId,{result:'rejected',valueHash:c.valueHash,reason:'Chờ điểm 3 của OQ-53'},key)` trả `decision.result` là `rejected`. Đỏ hôm nay: lệnh xác nhận thành công («expected a refusal»).
- [ ] **V2 `dừng tại OQ-53 (3): every other check still runs and names its code next to the placeholder`** — tám nháp ứng viên, mỗi nháp một lệnh xác nhận của `pm`, khẳng định bằng `heldOnly` danh sách mã **đúng bằng** (planner đã đo danh sách hôm nay của từng kiểu; thêm vào chỉ có mã mới, và `PROJECT_TEXT_HIDDEN` của Task F2 ở ý 4 và 5):
  1. luồng có tin trả lời ghi sau tin nháp nêu (`draftNaming(c,[c.sourceEventId])` rồi `reply`) → `SUBJECT_CHANGED`, `P`;
  2. tin nháp nêu có bản sửa (`draftNaming` rồi `edit`) → `SUBJECT_EDIT_UNVERIFIED`, `P`;
  3. nháp chỉ nêu một tài liệu của dự án (`out('intake_analyst',[d.record.id])` qua `submitDraft`) → `SUBJECT_BASELINE_MISSING`, `P`;
  4. đúng nháp của ý 3, dịch vụ `svc(h.operator,[])` → `PROJECT_TEXT_HIDDEN`, `SUBJECT_BASELINE_MISSING`, `P`, `THREAD_TEXT_HIDDEN`;
  5. nháp nêu tin của luồng (`candDraft()`), dịch vụ `svc(h.operator,[])` → `PROJECT_TEXT_HIDDEN`, `P`, `TEXT_NOT_VISIBLE`, `THREAD_TEXT_HIDDEN`;
  6. dòng chèn thô cho một mã ứng viên không có (`rawDraft({entityType:'intake_candidate',entityId:randomUUID()})`) → `ENTITY_NOT_FOUND`, `P` — mã có mặt cả khi không dựng được ngữ cảnh;
  7. dòng chèn thô nêu tin của luồng, `manifest_hash` là `'d'.repeat(64)` → `MANIFEST_MISMATCH`, `P`;
  8. dòng chèn thô nêu tin của luồng, `value_hash` là `'f'.repeat(64)`, lệnh gửi đúng hash đó → `P`, `VALUE_HASH_MISMATCH`.
  Cuối ca: `zeroDecisions()`. Đỏ hôm nay vì `AssertionError`: cả tám danh sách thiếu `P`.
- [ ] **V3 `dừng tại OQ-53 (3): the placeholder holds a confirmation only — the manager still reads the content of a candidate draft and can reject it, and the code never appears in a list`** (đối chứng, xanh từ đầu) — `c=await candDraft()`: `svc().list(pm,{projectId:ids.sales,entityType:'intake_candidate',entityId:c.candidateId})` trả dòng có `maskReasons:[]` và `value` khác `null`; chuỗi JSON của câu trả lời không chứa `P`; lệnh từ chối trả `rejected`; `draft_decisions` có 1 dòng. Kèm một dòng kiểu, kiểm bởi `npm run typecheck`: `// @ts-expect-error SUBJECT_ORDER_UNVERIFIED holds at confirmation and never masks at read: it is not a MaskReason` rồi `const notAMask:MaskReason='SUBJECT_ORDER_UNVERIFIED';void notAMask;`.
- [ ] **V4 `dừng tại OQ-53 (3): a document draft is not touched, and a candidate confirmation that carries a revision body is INVALID_INPUT before any hold`** — `x=await docDraft()`: lệnh xác nhận với `revisionBody(x.d)` trả `confirmed` (đối chứng). `c=await candDraft()`, `d=await doc()`: lệnh xác nhận `c` kèm `revision:revisionBody(d)` → `refused(…,'INVALID_INPUT',422)` (đối chứng). Một nháp ứng viên **đã cũ** (`draftNaming` rồi `reply`) xác nhận kèm `revision` → `refused(…,'INVALID_INPUT',422)`. Đỏ hôm nay vì `AssertionError` ở ý cuối: hôm nay trả `DRAFT_HELD`.
- [ ] **V5 `the fault of the command is answered after the authority, the decided state and the value hash, never before them`** (cổng-C5; đối chứng, xanh từ đầu — planner đã đo ba câu trả lời hôm nay) — `c=await candDraft()`, `d=await doc()`, `rev=revisionBody(d)`: (i) `member` gửi lệnh xác nhận `c` kèm `revision:rev` → `refused(…,'MANAGER_REQUIRED',403)` — ý bảo mật: giữ tính chất của L8, người không có quyền không học được gì từ hình dạng của lệnh; (ii) `pm` gửi `valueHash` sai (`'a'.repeat(64)`) kèm `revision:rev` → `refused(…,'REVISION_CONFLICT',409)`; (iii) `pm` từ chối `c`, rồi gửi lệnh xác nhận kèm `revision:rev` bằng khoá khác → `refused(…,'DRAFT_ALREADY_DECIDED',409)`. Cả ba phải còn đúng sau khi dời dòng `INVALID_INPUT`.

Sửa mười một ca E1–E11 đúng như bảng thứ ba của X5, **theo hai đợt** để log đỏ nói đúng điều cần nói:

- [ ] Đợt 1 — viết V1–V5 và sửa bảy ca có lệnh xác nhận thành «giữ-đúng-một»: E1, E2, E3, E5, E8, E9, E10. Chạy `npx vitest run tests/suggestions.test.ts`: đỏ vì `AssertionError` ở V1, V2, V4 và ở cả bảy ca vừa sửa («expected a refusal»); V3 và V5 xanh. **Chưa** sửa E4, E6, E7, E11: chúng còn xanh.
- [ ] Sửa `src/server/suggestions.ts`. Chạy lại: V1–V5 và bảy ca của đợt 1 xanh; **đúng bốn ca** E4, E6, E7, E11 nay đỏ, vì lệnh xác nhận nháp ứng viên của chúng trả `DRAFT_HELD` có `SUBJECT_ORDER_UNVERIFIED` — ghi tên bốn ca và câu lỗi vào log. Ca nào khác đỏ: **dừng và báo**, không sửa ca đó.
- [ ] Đợt 2 — sửa E4, E6, E7, E11 sang lệnh từ chối đúng như bảng → xanh: `npx vitest run tests/suggestions.test.ts tests/source-text.test.ts tests/skill-context.test.ts`; `npm run typecheck`.
- [ ] Canh: P3, Q1–Q4, T4, M7, M9, L6, và mọi ca dùng nháp tài liệu xanh **không sửa**; `git diff` của tệp test chỉ chạm V1–V5, `heldOnly`, bốn hằng được dời, và mười một ca E1–E11. Không dòng `expect` nào ngoài mười một ca đó bị đổi.
- [ ] Số liệu phủ của `src/server/suggestions.ts`: nhánh «nháp ứng viên đi qua bước giữ» nay không tới được (R36), nên số nhánh được phủ của tệp có thể giảm một. So **theo dòng của từng tệp** trước và sau, ghi con số; không thêm lối tắt nào vào mã để lấy lại con số đó. Bốn ngưỡng chung không đổi.

**Điểm commit** (phiên chính): `fix(suggestions): hold every confirmation of a candidate draft until point 3 of OQ-53 is decided (the Chairman's scope decision, option B; Codex gate round 1: CX3)`.

---

### Task F4: Kiểm lại cả nhánh sau vòng sửa — không review riêng

Không sửa mã. Builder chạy và trả số liệu; phiên chính ghi log và chạy lượt native.

- [ ] **[Bản 0.7: các con số ở dòng này là kỳ vọng của bản 0.6, trước Task F1b, và không còn dùng. Số ca sau F1b do phiên chính đo sau khi F1b xong; kế hoạch không ước con số nào.]** `npx vitest run` (PGlite): không ca đỏ. Số ca mới: F1 — bảy chạy trên PGlite (G19, G20, G21, G22, G25, G26, RB3), năm chỉ native (G23, G24, G27, Y1, Y2); F2 — mười một (U1–U3, W1–W8), bớt một vì Q7 được viết lại thành W1 và W2; F3 — năm (V1–V5). So với `83d5e2f`: trên PGlite số ca đạt tăng **22** và số bỏ qua tăng **5**; trên PostgreSQL 16 số ca đạt tăng 27 và số bỏ qua không đổi. Lệch thì nêu từng ca.
- [ ] `npm run typecheck`, `npm run build`, `npx vitest run --coverage` (bốn ngưỡng; với `src/server/suggestions.ts` và `src/server/source-text.ts` so theo dòng của từng tệp với `383c394`, và nêu riêng nhánh nói ở Task F3).
- [ ] Canh: `git diff --name-only 83d5e2f -- migrations` đúng hai tệp 022; `git diff --name-only 83d5e2f -- src` đúng `src/server/suggestions.ts` và `src/server/source-text.ts`; `/usr/bin/grep -rln "source_event_revisions" src` đúng `src/server/intake.ts` và `src/server/source-text.ts`; `/usr/bin/grep -c "GRANT" migrations/022_ai_drafts_pointer_only_guard.sql` in ra `0`; ca «no route imports the suggestion service, …» và bốn ca canh của role AI không bị chạm.
- [ ] Phiên chính: cả bộ trên PostgreSQL 16 thật, sau khi lùi 022 bằng tệp lùi mới và để harness áp lại; G17, G23, G24, G25, G27, Y1, Y2 xanh; không dòng `40P01`; không ca nào treo quá trần 5 giây của hai hàm.
- [ ] Phiên chính: cổng Codex vòng 2. Bối cảnh gửi cổng nêu rõ ba loại đổi kỳ vọng của X5 — vì cổng (G7, G9, G12, RB1, Q7, M10, P3, Q1, Q2, Q4), vì quyết định phạm vi của Chairman (E1–E11), và hạ tầng — nêu CX3 là **giữ chỗ**, điểm 3 của OQ-53 còn mở, và nêu thêm, mỗi ý một câu (cổng-R5): **Bản 0.7:** bối cảnh nêu thêm các ca đổi vì Task F1b và ca E12 (mục 07.6); ý 2 và ý 4 dưới đây đã được viết lại tại chỗ. **Bản 0.9:** vòng 2 đã chạy và trả `CHANGES_REQUIRED` với một P0 (`docs/reviews/oq-45-46-evidence-20261118/codex-round-2.md`). Sau Task G1 và Task G2, phiên chính chạy cổng Codex **vòng 3**, lượt chạy cuối; bối cảnh của vòng 3 nêu thêm các ý ở 09.8.
  1. R33 đúng cỡ: bit `IBS_HI` nay rộng đúng bằng quyền ghi mà role tự khai; khoảng trống 7 có từ trước PR và chặn việc bật Z4.
  2. **(Bản 0.7; thay câu của bản 0.6)** R34 đúng cỡ cho khoá dòng: lệnh ghi ánh xạ của một dự án chỉ còn bị hoãn bởi một giao dịch đã đưa một dòng nháp thật của dự án đó qua cả hai trigger và còn mở, hoặc bởi một role ghi được `public.projects` — không role runtime nào; mỗi lần thử thất bại `55P03` sau tối đa 5 giây, thành tiếng. Không còn chiếc khoá mà mọi role tự lấy được, không còn dạng mức phiên, không còn kênh `pg_locks`. Cái giá: các lệnh chèn nháp của một dự án chạy lần lượt khi giao dịch của chúng còn mở, và một giao dịch chèn nháp còn mở làm `UPDATE` hay `DELETE` dòng dự án đó phải chờ. *Câu của bản 0.6, đã bị thay:* «R34 cùng trần của nó: mọi role lấy được khoá tư vấn và hoãn được lệnh ghi ánh xạ; mỗi lần thử thất bại `55P03` sau tối đa 5 giây, ghim trong hai hàm — «hoãn» còn, «vô hạn» và «im lặng» thì không.»
  3. Trạng thái của giữ chỗ theo dự án của OQ-55: áp cho cả nháp tài liệu lẫn nháp ứng viên, rộng hơn chữ của phương án (e); giới hạn còn lại là chữ của tin thuộc dự án khác.
  4. Tệp 022 được sửa tại chỗ vì chưa từng được áp ở đâu ngoài CSDL thử của PR. **Bản 0.7:** tệp 022 đã được sửa tại chỗ **hai lần** trong PR này — ở Task F1 (`cb1d7dc`) và ở Task F1b — và chưa từng được áp ở đâu ngoài CSDL thử của PR; CSDL thử đó được lùi bằng tệp lùi hiện hành rồi áp lại sau mỗi lần sửa (R37). **Bản 0.8:** nay là **ba lần** sau cổng Codex vòng 1 — F1 (`cb1d7dc`), F1b (`56d257c`), F5 — và vẫn chưa từng được áp ở đâu ngoài CSDL thử của PR.
  5. Đường nhận tin đọc cùng ánh xạ để chọn chế độ lưu chữ mà không lấy khoá (`src/server/intake.ts:70`): ngoài diff của PR; chữ lưu như vậy bị ẩn lúc đọc. **Bản 0.8 — bối cảnh nêu thêm:** guard phía xác nhận của Task F5 và finding nó đóng (quét-F1); hai lượt quét theo lớp, dòng cuối của từng báo cáo và điều được làm với từng finding (08.8); R3 và R15 theo chữ đã viết lại; điều kiện 25.

**Điểm commit** (phiên chính): `docs(oq-45-46): verification of the Codex round-1 fix wave`.

---

### X6 · Phần dư mới và điều kiện bổ sung (phiên chính chép vào biên nhận)

- **R33** · (CX1; đọc cùng R4; viết lại ở bản 0.6 theo cổng-R1) Điều CX1 đóng là «trigger trả lời trước RLS»: role chịu RLS không còn nhận `LTZ01` cho một dòng mà policy sẽ từ chối. **Với người giữ role có ý xấu, thứ lấy được không giảm so với R4.** Role tự khai phạm vi (khoảng trống 7 của lát 3, có từ trước PR và chặn việc bật Z4), nên một lệnh `set_config` khai đúng tenant và dự án muốn dò là đủ để nhận lại bit `IBS_HI` của **bất kỳ dự án nào của bất kỳ tenant nào**; giao dịch lùi thì không để lại dòng nào. Bit nay rộng **đúng bằng quyền ghi mà role tự khai**: thứ đổi không phải con số, mà là muốn có bit thì phải khai một phạm vi mà trong đó role cũng ghi được nháp. Đóng hẳn thuộc thiết kế login AI. **Độ lệch policy ↔ trigger:** điều kiện của trigger là bản chép tay của `WITH CHECK` của `ai_insert`. Policy **chặt thêm**, hoặc có thêm một policy `RESTRICTIVE`: dòng qua được trigger mà RLS sẽ từ chối lại tới hàm definer — kênh của CX1 mở lại, **im lặng**. Policy **nới**: trigger từ chối oan bằng câu của RLS (đóng; `HINT` của lỗi nói đó là trigger của 022). Ca bắt độ lệch là **G25** — ghim chuỗi `WITH CHECK`, đúng một policy `INSERT`, không policy `RESTRICTIVE`; **không phải G19**, vốn chỉ ghim sáu kiểu dòng của policy hôm nay (câu của bản 0.5 nói G19 ghim là sai). Một trigger `BEFORE INSERT` thêm về sau với tên sắp trước `ai_drafts_declared_scope_guard` sẽ chạy trước nó: G12 ghim danh sách tên. Login mà dưới nó `row_security_active` trả sai làm trigger phạm vi tự bỏ qua (điều kiện 22). **Bản 0.7 (DB-1 của review CSDL trên vòng sửa):** ghim policy `INSERT` là chưa đủ. Một lệnh chèn có `RETURNING` hoặc `ON CONFLICT` — đúng câu lệnh của `submitDraft` — còn bị PostgreSQL xét theo `USING` của policy `SELECT` của role trên dòng mới, tức `ai_select`. Trigger phạm vi vì vậy phải chặt bằng **giao** của `ai_insert` và `ai_select`. Hôm nay `ai_select` gồm đúng hai vế đầu của `ai_insert`, nên giao đó chính là `ai_insert` và không có gì rò; nhưng một migration siết `ai_select` mà để nguyên `ai_insert` sẽ mở lại kênh của CX1, im lặng, cho lệnh có `RETURNING`. Sau Task F1b, G25 ghim **cả hai**: `WITH CHECK` của `ai_insert` và `USING` của `ai_select`.
- **[Bản 0.7 — ĐÃ BỊ THAY. Mục R34 dưới đây (dòng này và sáu ý con, `:1339-1345`) tả khoá tư vấn của bản 0.6, đã bị Task F1b gỡ. R34 hiện hành ở mục «Đợt sửa sau review của vòng sửa 1 (bản 0.7)», 07.4. Giữ làm lịch sử.]** **R34** · (CX4; đọc lại R5; viết lại ở bản 0.6 theo cổng-N1) Khe «ánh xạ commit trong lúc lệnh chèn nháp đang chạy» được đóng cho mọi lệnh ghi đi qua hai trigger. Đổi lại, vòng sửa trao cho **mọi role của CSDL, kể cả `libetech_ai`** — B1 xếp người giữ role đó vào «không tin» — một năng lực trước đây không có: **hoãn lệnh ghi ánh xạ của một dự án, tức hoãn việc dự án đó thành `IBS_HI`.** Khoá tư vấn không có danh sách quyền.
  - *Giữ bằng gì.* (i) Dạng mức giao dịch: `pg_advisory_xact_lock[_shared](1346653516, hashtext(<mã dự án>))`, hoặc chỉ cần một giao dịch vừa chèn nháp còn mở; hết khi giao dịch hết. (ii) Dạng **mức phiên**: `pg_advisory_lock(…)`; sống qua mọi giao dịch tới khi phiên đóng hoặc tự mở khoá; `idle_in_transaction_session_timeout` không chạm tới nó.
  - *Ai chặn được ai.* Người giữ khoá (chia sẻ hay độc quyền) chặn lệnh ghi ánh xạ của dự án đó. Người giữ khoá độc quyền chặn thêm lệnh chèn nháp của dự án đó từ **phiên khác**. Chính phiên giữ khoá vẫn chèn nháp cho dự án ấy như thường (một backend không xung đột với khoá của chính nó; đã đo trên PGlite). Không chặn `decide`, đường nhận tin, đường đọc.
  - *Trong bao lâu.* Mỗi lần thử bị chặn tối đa **5 giây** — `lock_timeout` ghim trong định nghĩa hai hàm, không phụ thuộc cấu hình của phiên hay của một login chưa tồn tại — rồi thất bại `55P03`, CONTEXT nêu tên hàm: không lệnh nào treo, không dòng nào được ghi. Nhưng **mọi lần thử lại đều thất bại chừng nào khoá còn bị giữ**: «hoãn» không gỡ được, vì mọi cách đóng CX4 chặt đều buộc lệnh ghi ánh xạ chờ lệnh chèn nháp đang chạy; thứ được sửa là «vô hạn» và «im lặng». Trong lúc bị hoãn, nháp của dự án vẫn được lưu — đúng trường hợp OQ-54 đang để ngỏ.
  - *Cách thấy và gỡ.* `pg_locks` có dòng `locktype='advisory'`, `classid=1346653516`, `objsubid=2`, `objid` bằng `hashtext` của mã dự án đọc như số không dấu, kèm `pid`; ngắt backend đó. Với dạng mức phiên cần `idle_session_timeout` hoặc một phép canh `pg_locks` (điều kiện 18).
  - *Kênh phụ mới.* `pg_locks` đọc được bởi mọi role (đã đo dưới role AI), nên **thời điểm** một dự án đang được ghi ánh xạ (`ExclusiveLock`) và đang được chèn nháp (`ShareLock`) lộ cho mọi role biết mã dự án, xuyên tenant. Không lộ nhãn: ánh xạ sang nhãn nào cũng lấy cùng khoá.
  - *Khác.* `55P03`, `57014`, `40P01` đi thô qua `submitDraft` (cùng lớp R31): nháp không được lưu, khoá khử trùng còn tự do. Hai vòng khoá chết của X2: vòng thứ hai chỉ login vận hành dựng được. Ánh xạ ghi khi trigger bị tắt, hoặc bởi một phiên ở `session_replication_role = replica`, không lấy khoá. Hai dự án trùng giá trị băm chỉ xếp hàng thừa. Đường nhận tin đọc cùng ánh xạ để chọn chế độ lưu chữ mà không lấy khoá này (`src/server/intake.ts:70`; ngoài diff của PR): chữ lưu như vậy bị ẩn lúc đọc. Lập luận «ảnh chụp mới sau khi chờ» và việc `lock_timeout` mức hàm cắt lần chờ khoá tư vấn chưa chạy trên PostgreSQL 16: G23, G24, G27, Y1, Y2.
- **R35** · (CX2; viết lại ở bản 0.6 theo cổng-N2) Giữ chỗ theo dự án của OQ-55, cho **cả hai loại nháp**, rộng hơn chữ của phương án (e): gỡ cờ của một nhóm, hoặc dựng dịch vụ với danh sách nhóm rỗng (mặc định; khoảng trống 42), là che và giữ **mọi nháp** của dự án, kể cả nháp không chép chữ nào. `THREAD_TEXT_HIDDEN` vẫn được tính, nhưng khi cả hai giữ chỗ còn thì nó không bao giờ đứng một mình. Câu đọc quét mọi bản lưu chữ của dự án khi không có chữ nào đang ẩn — một lần cho mỗi lần đọc danh sách của người có quyền, một lần cho mỗi lệnh xác nhận: chưa đo trên dữ liệu lớn. **Giới hạn còn lại:** chữ của tin thuộc dự án khác không phép kiểm nào thấy; chữ của tin đang được hiện không bị che (người có quyền quyết định một nháp cũng có vai đọc hộp tin của dự án, `src/server/inbox.ts:30`). `projectHasHiddenText` trả «đúng» khi dự án không nằm trong phạm vi của giao dịch (cổng-R4); `threadHasHiddenText` vẫn trả «sai» trong trường hợp đó, như từ trước PR — sau Task F2, nơi nào gọi nó cũng gọi hàm theo dự án trong cùng phạm vi (X7 mục 9). **Bản 0.7 (S-5 của review bảo mật trên vòng sửa; chỉ ghi chú, không đổi mã):** mã lý do tự nó là một thông tin. `PROJECT_TEXT_HIDDEN` cho một người có quyền quyết định nháp biết **một bit về cấu hình của chính dự án của họ**: dự án có chữ đã lưu mà cấu hình nay không cho hiện (cờ nhóm bị gỡ, hoặc ánh xạ `IBS_HI`). Không lộ chữ, không lộ mã tin, không xuyên dự án; người đó vốn có vai đọc hộp tin của dự án. **Bản 0.8:** quét-S3 của lượt quét oracle nêu lại giới hạn «chữ của dự án khác»: ở lại là phần dư, có điều kiện 25 (08.5). quét-F6 của lượt quét chạy đua — một bản tin lưu chữ commit sau phép kiểm theo dự án của `decide` — là phần dư R39 (08.5).
- **R36** · (CX3; quyết định phạm vi của Chairman, phương án B) Sau PR này **không nháp ứng viên nào xác nhận được**: đường xác nhận nháp ứng viên của lát 3 tạm đóng cho tới khi điểm 3 của OQ-53 được quyết và giữ chỗ được gỡ. Từ chối vẫn làm được; đọc không đổi vì mã này. Các mã `SUBJECT_CHANGED`, `SUBJECT_BASELINE_MISSING`, `SUBJECT_EDIT_UNVERIFIED`, `THREAD_TEXT_HIDDEN`, `PROJECT_TEXT_HIDDEN` của nháp ứng viên vẫn được tính và vẫn có ca, nhưng ở lệnh xác nhận luôn đi kèm `SUBJECT_ORDER_UNVERIFIED`. R6 và R27 vẫn đúng như mô tả về `threadFreshness`; không lệnh xác nhận nào dựa được vào chúng. Ba tính chất không còn ca nào ghim **riêng cho nháp ứng viên**, vì không dựng được: lệnh xác nhận giữ khoá của nó (E5), phát lại một lệnh xác nhận dưới lớp che (E7), phát lại một lệnh xác nhận sau khi luồng đổi (E11); cả ba đi qua đường mã chung và được ghim trên nháp tài liệu. Trong `decide`, đường «nháp ứng viên đi qua bước giữ» là mã không tới được khi giữ chỗ còn. Câu `DRAFT_HELD` của một nháp ứng viên từ nay luôn có ít nhất một mã, kể cả với nháp không có lỗi nào: người đọc câu đó phải biết mã này là giữ chỗ của hệ thống, không phải lỗi của nháp.
- **R37** · Tệp lùi 022 của bản 0.4 không gỡ hết thân mới. Mọi CSDL đã ghi `'022'` (hôm nay chỉ CSDL thử của PR) phải lùi bằng tệp lùi mới rồi áp lại; trình áp bỏ qua bản đã ghi nên không tự làm việc đó. Ai lùi bằng tệp lùi cũ rồi lùi 021 thì lệnh `DROP SCHEMA IF EXISTS intelligence` (`migrations/rollback/021_ai_suggestions_z4.sql:24`) thất bại thành tiếng vì hai hàm mới còn đó. **Bản 0.7:** nay có **hai** thân cũ — thân của bản 0.4 (một trigger, một hàm) và thân dùng khoá tư vấn của `cb1d7dc` (ba trigger, ba hàm). Mọi CSDL đã ghi `'022'` với một trong hai thân đó phải được lùi bằng tệp lùi **hiện hành** rồi áp lại. Ở Task F1b tệp lùi không đổi câu lệnh nào, chỉ đổi một dòng chú thích; nó gỡ được cả ba thân. **Bản 0.8:** nay có **bốn** thân cũ — thêm thân dùng khoá dòng với ba hàm của `56d257c`, vì Task F5 thêm hàm và trigger thứ tư. CSDL nào đã ghi `'022'` với một thân cũ được lùi bằng tệp lùi hiện hành rồi áp lại.

**Trước khi thêm tuyến đọc nháp hoặc bật Z4 — bổ sung** (đánh số tiếp):

- **[Bản 0.7 — ĐÃ BỊ THAY: điều kiện 18 hiện hành ở mục «Đợt sửa sau review của vòng sửa 1 (bản 0.7)», 07.4, cùng hai điều kiện mới 23 và 24. Chữ dưới đây tả khoá tư vấn và giữ làm lịch sử.]** **18.** (viết lại ở bản 0.6) Trần 5 giây của lần chờ khoá đã nằm trong hai hàm và không còn là điều kiện. Còn lại: login của pipeline có `idle_in_transaction_session_timeout` **và** `idle_session_timeout`; có phép canh `pg_locks` cho `classid` 1346653516 (ai giữ, bao lâu) và cách ngắt backend giữ khoá; pipeline coi `55P03` từ `submitDraft` là thử lại được; người ghi ánh xạ biết `55P03` nghĩa là có phiên đang giữ khoá của dự án (R34).
- **19.** Một lần `EXPLAIN` trên PostgreSQL 16 cho `projectHasHiddenText` trên một dự án nhiều tin; thêm chỉ mục nếu cần (R35).
- **20.** (viết lại ở bản 0.6 theo cổng-R7) Câu catalog của điều kiện 7 đọc thêm: ba trigger của 022 có mặt, `tgenabled='O'`, `tgtype=7`; tên trigger phạm vi đứng trước tên guard và không trigger `BEFORE INSERT` nào khác của bảng nháp sắp trước nó; thân và `proconfig` của ba hàm khớp tệp; trên `intelligence.ai_drafts` có đúng một policy áp cho `INSERT` (`ai_insert`), không policy `RESTRICTIVE`, và `with_check` khớp chuỗi ghim ở G25. **Bản 0.7 (DB-1):** câu catalog đọc thêm phía `SELECT`: các policy có `polcmd` thuộc `('r','*')` áp cho `libetech_ai` là đúng một dòng `ai_select`, và `using` của nó khớp chuỗi ghim ở G25 sau Task F1b — trigger phải chặt bằng giao của `ai_insert` và `ai_select`. `prosecdef` và `proconfig` của ba hàm theo bảng ở mục 07.5: hàm khoá của bảng ánh xạ nay là `SECURITY DEFINER`.
- **21.** Điểm 3 của OQ-53 có quyết định. Khi đó `SUBJECT_ORDER_UNVERIFIED` được gỡ hoặc thay theo quyết định, và mười một ca E1–E11 được đưa về kỳ vọng «xác nhận được» (chữ cũ của chúng ở `83d5e2f`) hoặc về kỳ vọng mà quyết định đó kéo theo.
- **22.** (mới ở bản 0.6, cổng-R7) Thiết kế login AI: dưới **đúng login đó**, `row_security_active('intelligence.ai_drafts')` phải trả đúng — login không là superuser, không có `BYPASSRLS`, không sở hữu bảng. Nếu trả sai, trigger phạm vi tự bỏ qua và kênh của CX1 mở lại cho mọi dự án. Kiểm bằng một câu lệnh chạy dưới login đó, trước khi bật.

### X7 · Chỗ planner làm khác phán quyết của phiên chính hoặc khác chữ của cổng, và chỗ chưa chắc

1. **CX1 — điều kiện của trigger là đủ ba vế của policy `ai_insert`,** không chỉ tenant và dự án. Với hai vế, một dòng đúng tenant và dự án đã khai nhưng sai `ai_principal_id` vẫn tới hàm definer, và role vẫn nhận `LTZ01` cho một dòng mà policy đằng nào cũng từ chối. Với ba vế, bất biến gọn hơn: hàm definer chỉ chạy cho dòng policy cho qua. Chặt hơn phán quyết, không nới. Cổng bảo mật nhận là đúng.
2. **CX1 — một hàm thay vì hai là không làm được** (X1): hàm definer không biết người chèn có chịu RLS hay không. Giữ hai hàm như phán quyết.
3. **CX4 — giữ khoá tư vấn như phán quyết.** Phần dư lớn hơn điều phán quyết đầu nêu («role AI giữ khoá chia sẻ»): mọi role tự lấy được cả khoá độc quyền, cả dạng mức phiên (R34). Bản 0.6 thêm trần 5 giây trong hàm (cổng-N1). Phương án khoá dòng trên `projects` nêu lại cho đúng ở X2 để cổng CSDL cân. **Bản 0.7:** khoá tư vấn đã bị thay bằng khoá dòng, chính là «phương án khoá dòng trên `projects`» nêu ở đây (07.2, 07.3); mục này là lịch sử.
4. **CX3 (B) — dời phép kiểm `INVALID_INPUT` của nháp ứng viên lên trước bước giữ** (X4). Phán quyết không nêu dòng này. Không dời thì nó thành mã không tới được và ý cuối của ca R12-e phải đổi; dời thì một tổ hợp (lệnh kèm `revision` trên nháp đang bị giữ) đổi câu trả lời từ `DRAFT_HELD` sang `INVALID_INPUT`. Cổng bảo mật xét: không thành kênh dò; ca V5 ghim thứ tự. Ngoài ra, các ca phiên điều phối nêu để xem lại: K2 **có** dùng nháp ứng viên và chuyển sang lệnh từ chối (E4); T1, T2, T3 (ý thứ ba), T5, Q9 đổi (E8–E11, E7); P3, Q3, M7, M9 **không** đổi vì (B). Thiết kế cho phương án (A) đã bỏ khỏi kế hoạch theo yêu cầu.
5. **CX2 — M4 không đổi** (phán quyết đầu nêu nó như ví dụ có thể đổi): bốn nháp của M4 thuộc một dự án không có tin nào. Ca đổi là Q7, M10, P3, và — sau cổng-N2 — Q1, Q2, Q4.
6. **Chưa chắc:** hai chiều chờ của X2, lập luận ảnh chụp mới của hàm `VOLATILE`, và việc `lock_timeout` mức hàm cắt lần chờ **khoá tư vấn** bằng `55P03` chưa chạy trên động cơ thật — G23, G24, G27, Y1, Y2 là nơi xác nhận. Nếu G23 trả «stored» thay vì `LTZ01` sau khi ánh xạ commit, hoặc G27 / Y2 treo quá trần hay trả mã khác `55P03`: **dừng và báo**, không sửa ca. Hai khoảng thời gian `[4000, 9000)` của G27 và Y2 là ước lượng của planner quanh trần 5 giây. Lệnh tắt trigger dưới role AI (một ý của G20) chưa đo. Thứ tự trigger theo tên đã đo trên PGlite; PostgreSQL 16 so tên theo byte, hai tên đều là chữ thường ASCII. PGlite 0.5.15 tự báo là PostgreSQL 18.6: chuỗi `WITH CHECK` của G25 đo ở đó; PostgreSQL 16 in khác thì dừng và báo. **Bản 0.7:** các điều chưa chắc về khoá tư vấn không còn áp dụng; G27 và Y2 đã đổi hình dạng (07.5); điều chưa chắc của khoá dòng nêu ở 07.8.
7. **Một hook của máy đã chặn một lệnh của planner** trong lúc đo ở bản 0.5: lệnh shell đó chứa chữ của một câu `ALTER TABLE … DISABLE TRIGGER` dành cho CSDL trong bộ nhớ. Planner không chạy lại câu đó, ở bản 0.5 lẫn 0.6; ý tương ứng của G20 vì vậy là suy luận. Các script đo (tệp ngoài repo) áp chữ của tệp thuận và tệp lùi 022 lên CSDL PGlite trong bộ nhớ dùng xong bỏ, đúng phạm vi phiên chính cho phép; không lệnh nào chạm một CSDL có thật.
8. **Cổng-N2 nói «W5 và X-M10 viết lại»; planner viết lại W5 và giữ X-M10 như bản 0.5.** Bằng chứng: ca M10 (`tests/suggestions.test.ts:1019-1029`) có ba ý — `member` đọc nháp ứng viên: không câu nào nêu `source_events` hay `intake_candidates` (người không có quyền không gây câu lệnh theo dự án, trước và sau N2); `pm` đọc nháp **tài liệu**: X-M10 đã đổi thành «đúng một câu»; `pm` đọc nháp ứng viên: «có ít nhất một câu» — vẫn đúng khi thêm một câu. Việc mở rộng sang nháp ứng viên không đổi ý nào của M10; điều cổng muốn ghim (câu lệnh theo dự án nay chạy cả cho nháp ứng viên, đúng một lần) nằm ở W5.
9. **Cổng-R4 áp cho hàm mới, không áp cho `threadHasHiddenText`.** Cổng cho hai cách (thêm vế, hoặc ghi rõ kết quả vô nghĩa ngoài phạm vi) và ghi rằng hàm theo luồng «có cùng tính chất từ trước». Planner thêm vế cho `projectHasHiddenText` và không sửa `threadHasHiddenText` (`src/server/source-text.ts:85-94`): nó là mã đã qua review với ca riêng (Q5, Q6, Q8), và sau Task F2 hai nơi gọi nó (`src/server/suggestions.ts:213`, `:299`) đều gọi cả hàm theo dự án trong cùng giao dịch, nên một câu «sai» ngoài phạm vi của nó không còn quyết định gì. Ghi ở R35.
10. **Cổng-C3 (ii): chọn cách thứ hai cổng cho — bỏ chữ «takes no lock» khỏi tên G22** thay vì thêm một phép đọc `pg_locks`. Sau một lệnh bị từ chối, PostgreSQL đã nhả mọi khoá của giao dịch, và khoá lấy trong một savepoint cũng mất khi lùi về savepoint: phép đọc đó luôn rỗng dù trigger có lấy khoá hay không, tức lại là một khẳng định không thể sai.
11. **Cổng-C8: RB3 gỡ tay bằng `DROP … IF EXISTS`** để ca đỏ được vì `AssertionError` trên hai tệp của bản 0.4 (không có `IF EXISTS` thì bước gỡ tay tự ném lỗi «không tồn tại»). Planner không đo đúng kịch bản gỡ tay; đã đo kịch bản chặt hơn — áp tệp thuận mới lên CSDL mang đúng thân của bản 0.4, và chạy tệp lùi mới từ hình dạng đó.
12. **`submitDraft` không bắt `55P03`** (X2): phán quyết yêu cầu nói rõ nó làm gì với mã này; planner chọn không thêm mã lỗi mới của dịch vụ — lỗi đi thô, cùng lớp R31, có ca Y2 ghim. Nếu phiên chính muốn một `AppError` thử-lại-được thì đó là một dòng trong `submitDraft` và một ý của Y2; planner không tự thêm vì không finding nào đòi. **Bản 0.7:** các chỗ bản 0.7 làm khác chữ của hai reviewer của vòng sửa nêu ở mục 07.8.

### X8 · Tự soát của planner cho bản 0.5 và 0.6

- Lời Chairman về OQ-45 và OQ-46 chép nguyên một lần ở đầu mục. Lời Chairman về phạm vi của CX3 — chuỗi trả lời và chữ của phương án B — chép nguyên ở đầu mục; câu hỏi và hai phương án còn lại chép nguyên trong khối ở `docs/OPEN-QUESTIONS.md:928`. Từng câu trong «» của khối đó đã được so bằng máy với tin của phiên điều phối như phiên của planner nhận được, ở bản 0.5 và lại ở bản 0.6. Planner không thấy hộp chọn. Không lý do nào được thêm thành lời Chairman; chú thích mã của Task F3 tách nguồn khỏi ghi chú kỹ thuật (cổng-R6).
- Không phương án nào của câu hỏi mở được chọn: `PROJECT_TEXT_HIDDEN` (OQ-55; nay rộng hơn chữ của (e), ghi rõ ở X3, R35 và trong mục OQ) và `SUBJECT_ORDER_UNVERIFIED` (điểm 3 của OQ-53) đều được ghi là giữ chỗ ở X0, ở mục thiết kế, ở task và trong `docs/OPEN-QUESTIONS.md`.
- Mỗi finding của cổng Codex có dòng ở X0; mỗi mục N, R, C của cổng bảo mật trên thiết kế vòng sửa có dòng ở X0b; các chỗ planner làm khác chữ của cổng nêu ở X7 mục 8–12, kèm `tệp:dòng` khi dựa vào mã.
- Ca hiện có đổi kỳ vọng được liệt kê từng ca theo ba nguồn: vì cổng (mười ca: bảy vì cổng Codex, ba vì cổng-N2); vì quyết định phạm vi của Chairman (mười một ca, tìm bằng mã, câu trả lời hôm nay đo trên PGlite); hạ tầng (ba chỗ). Các ca đã soát mà không đổi được nêu tên.
- Hai khối SQL của Task F1 được chép bằng máy từ đúng hai tệp planner đã chạy lại trên PGlite ở bản 0.6: thuận hai lần, lùi, lùi lại, bị chặn bởi bản sau, thuận lại, và áp lên thân của bản 0.4.
- Không task nào cấp `EXECUTE` cho `libetech_ai`, thêm `GRANT`, login, tuyến HTTP hay lời gọi mô hình; không migration thứ hai; không task nào chạm `src/server/intake.ts` hay hai bảng nhận tin.
- Chưa làm: mọi lượt trên PostgreSQL 16; review của vòng sửa; số liệu phủ sau Task F3.

## Đợt sửa sau review của vòng sửa 1 (bản 0.7)

Do agent `planner` ghi ngày 18/11/2026 (mô hình Fable 5.2, không lùi mô hình), theo phán quyết của phiên chính — **không phải lời hay quyết định của Chairman**; không điều gì ở đây chọn một phương án của một câu hỏi mở. Lời Chairman không được chép lại ở mục này và không bị đổi ở đâu trong tệp: bốn quyết định nằm ở «Quyết định của Chairman phải áp» (`:30`), quyết định phạm vi và chữ của phương án B nằm ở đầu mục «Vòng sửa 1 của cổng Codex» (`:851`). Mục này là hồ sơ; mã của nó do Task F1b làm theo brief `.superpowers/sdd/oq-45-46-ai-drafts/task-F1b-brief.md`. Ở bản 0.7 không dòng nào trước mục này bị chèn hay xoá: chữ bị thay được gắn nhãn «Bản 0.7» tại chỗ và giữ làm lịch sử (danh sách ở 07.9). **Bản 0.8:** sau mục này có mục «Quét lớp lỗi trước vòng 2 của cổng và Task F5 (bản 0.8)». Task F5 thêm vào 022 một hàm definer và một trigger nữa, nên các câu «ba trigger», «hai hàm definer» của mục này tả `56d257c`.

**Trạng thái lúc ghi.** F1 `cb1d7dc`, F2 `1a423a5`, F3 `f434f0a` đã commit; theo phiên chính, cả ba xanh trên PGlite và trên PostgreSQL 16. Hai lượt review của vòng sửa đều kết luận «READY FOR GATE»: CSDL — `docs/reviews/oq-45-46-evidence-20261118/gates/review-codex-fix1-F1-database.md` (DB-1…DB-9; mục 7 về cơ chế khoá) — và bảo mật — `docs/reviews/oq-45-46-evidence-20261118/gates/review-codex-fix1-security.md` (S-1…S-5; mục D). Trong lúc mục này được viết, builder đang làm Task F1b: planner không đọc, không chạy và không sửa mã của task đó, và không chạy lại SQL nào trên PGlite ở bản 0.7.

### 07.1 · Vì sao cơ chế khoá của CX4 đổi

- **Cùng một điểm yếu, ba nguồn.** Review CSDL (DB-9, P2), review bảo mật (S-1, P2) và một lượt review tự động (nêu trong brief của Task F1b; planner không thấy báo cáo của lượt đó) cùng chỉ vào khoá tư vấn theo dự án của commit `cb1d7dc`: **khoá tư vấn không có kiểm quyền.** Mọi role của CSDL — kể cả ba login dịch vụ đang có — lấy được khoá của bất kỳ dự án nào bằng một câu lệnh, cả ở dạng mức phiên, và làm mọi lệnh ghi ánh xạ của dự án đó thất bại; `pg_locks` cho mọi role thấy khoá. Trước 022 không role không-superuser nào chặn được lệnh ghi ánh xạ. R34 của bản 0.6 đã ghi phần dư này. Cả hai reviewer viết rằng họ sẽ ship **khoá dòng trên `public.projects`** thay cho khoá tư vấn nếu vòng sửa còn chỗ cho một task, một lượt PostgreSQL 16 và một lượt review trên mã; nếu không còn chỗ thì ship khoá tư vấn như đã commit, với phần dư nêu thẳng trong bối cảnh gửi cổng Codex.
- **Phép đo trên PostgreSQL 16.15** (`docs/reviews/oq-45-46-evidence-20261118/measurements-pg16-rowlock.txt`; đo trong một schema nháp dựng lại hình dạng — bảng dự án, bảng ánh xạ, bảng nháp, hai trigger — trên CSDL thử của PR, không ghi bảng nào của ứng dụng). Đây là phép đo **cơ chế**; hành vi của chính SQL của Task F1b do các ca native của task đó chứng minh (07.5).
  - *Quyền.* Dưới `libetech_runtime`, `SELECT … FOR SHARE` và `SELECT … FOR KEY SHARE` trên `public.projects` trả `42501`. Theo catalog sau migration 001–022: trên `public.projects`, quyền cấp cho role không-superuser chỉ là `SELECT` (`libetech_runtime`: cả bảng; `libetech_identity`, `libetech_intake`: theo cột); không hàm nào của schema không-hệ-thống ghi bảng đó; không trigger người dùng nào trên nó; 33 khoá ngoại trỏ tới nó. Trên `public.project_domain_mappings`, quyền cho role không-superuser cũng chỉ là `SELECT`.
  - *Ma trận xung đột.* Bên giữ `FOR NO KEY UPDATE` **không** chặn một lệnh chèn vào bảng có khoá ngoại tới dòng đó (1 ms) và chặn `FOR SHARE`. Bên giữ `FOR SHARE` chặn `FOR NO KEY UPDATE` và một lệnh `UPDATE` thường, không chặn lệnh chèn có khoá ngoại và không chặn một `FOR SHARE` thứ hai. Một hàm PL/pgSQL chờ khoá xong thì, ở câu lệnh kế tiếp, đọc được dòng mà giao dịch kia vừa commit («B waited for A, then read»: `IBS_HI`).
  - *Dòng dự án chưa thấy được* (khe B-1 của review CSDL). Một giao dịch tạo dự án và ghi ánh xạ `IBS_HI` cho nó, chưa commit. Kết nối khác chèn hai dòng nháp trong một câu lệnh — dòng đầu cho dự án đó, dòng sau tính chậm — và giao dịch kia commit trong lúc ấy. Không có phép từ chối: cả hai dòng được lưu (1 510 ms), tức **một nháp được lưu cho một dự án đã là `IBS_HI` trước khi nháp commit, mà guard chưa hề đọc ánh xạ**. Có phép từ chối: `23503` sau 1 ms, không dòng nào được lưu.
  - *Bỏ đói.* Với `FOR SHARE` trong guard, ba kết nối giữ các giao dịch chèn nháp ngắn (150 ms) gối nhau cho một dự án: lệnh ghi ánh xạ **không bao giờ lấy được khoá** và bị trần 14 giây của câu lệnh cắt (`57014`, 14 003 ms); 282 giao dịch chèn nháp đi qua trong lúc đó; trần 5 giây của hàm **không nổ**, vì nó tính cho từng lần lấy khoá và mỗi lần chờ đều ngắn. Bản đầu của phép đo, không có trần câu lệnh, không trả về và phải dừng tay. Với `FOR NO KEY UPDATE` trong guard, cùng lệnh ghi ánh xạ đó lấy được khoá sau 418 ms: người chờ được phục vụ theo thứ tự đến; các giao dịch chèn nháp của dự án khi đó chạy lần lượt (9 giao dịch trong cùng khoảng).
  - *Trần.* Với `FOR NO KEY UPDATE`, khi một giao dịch chèn nháp bị để mở: lệnh chèn nháp thứ hai và lệnh ghi ánh xạ của dự án đó, mỗi lệnh thất bại `55P03` sau 5 003 ms. `lock_timeout` của phiên trở lại giá trị cũ (1 234 ms) sau câu lệnh.
  - *Một giao dịch.* Tạo dự án, chèn nháp cho nó, ghi ánh xạ cho nó, chèn nháp nữa — không lỗi, không chờ, ở cả hai mức khoá.
  - *Tên khoá ngoại* đọc từ catalog: `ai_drafts_project_id_tenant_id_fkey` và `project_domain_mappings_project_id_tenant_id_fkey`, cả hai `(project_id, tenant_id)` tới `public.projects(id, tenant_id)`.

### 07.2 · Phán quyết của phiên chính

1. **Cơ chế.** Cả hai hàm — `intelligence.ai_drafts_pointer_only_guard` và `intelligence.project_domain_mappings_draft_lock` — khoá **dòng dự án** bằng `FOR NO KEY UPDATE`, lọc theo cả `id` lẫn `tenant_id`. Cả hai là `SECURITY DEFINER`, ghim `search_path`, `row_security = off`, `lock_timeout '5s'`. **Khoá tư vấn bị gỡ.** Đây là mẫu repo đã dùng ở `migrations/020_document_review.sql:259-269`.
2. **Dòng dự án không thấy được thì từ chối**, ở cả hai hàm, bằng đúng mã của khoá ngoại: `23503`, kèm các trường SCHEMA, TABLE, CONSTRAINT, và một `HINT` nêu tên trigger.
3. **Không dùng `FOR SHARE` trong guard**, trái với khối SQL ở mục 7.4 của review CSDL: phép đo «bỏ đói» ở 07.1 là lý do. Cùng mức khoá ở cả hai phía để người chờ xếp hàng theo thứ tự đến.
4. **R12-i (Task F3).** Câu của X4 rằng không ca hiện có nào dựng «lệnh xác nhận nháp ứng viên kèm `revision` trên một nháp đang bị giữ» là sai: R12-i dựng đúng tổ hợp đó. Việc dời `INVALID_INPUT` lên trước bước giữ **giữ nguyên**. R12-i nay gửi dòng «cặp» của nó không kèm `revision`; sau S-4, ca còn khẳng định `INVALID_INPUT` cho chính dòng đó khi gửi kèm `revision`, và `heldOnly('ENTITY_NOT_FOUND','SUBJECT_ORDER_UNVERIFIED')` khi không kèm. Đó là ca hiện có thứ mười hai đổi kỳ vọng vì CX3 (E12).
5. Các finding còn lại của hai review (DB-1…DB-8, S-2…S-5) áp như bảng ở 07.9.

### 07.3 · Thiết kế cho CX4, viết lại cho khoá dòng (thay X2 của bản 0.6, `:906-923`)

- **Cơ chế.** Trong guard, **sau** phép kiểm mức cô lập và **trước** câu đọc ánh xạ: `PERFORM 1 FROM public.projects p WHERE p.id = NEW.project_id AND p.tenant_id = NEW.tenant_id FOR NO KEY UPDATE`, rồi `IF NOT FOUND` thì từ chối `23503`. Trigger `BEFORE INSERT … FOR EACH ROW` của `public.project_domain_mappings` chạy đúng câu khoá đó và cùng phép từ chối. Khoá giữ tới hết giao dịch. Dòng thiếu `tenant_id` hoặc `project_id` không khoá gì và do bảng trả lời (`23502`).
- **Vì sao là dòng dự án.** Đó là dòng mà khoá ngoại của cả hai bảng **đã khoá** (`FOR KEY SHARE`) ở mỗi lệnh chèn; ở đây cùng dòng đó được khoá ở mức cao hơn, không cột nào đổi. `FOR NO KEY UPDATE` không chờ, và không bị chờ bởi, lệnh chèn vào bất kỳ bảng nào khác có khoá ngoại tới dự án (đã đo) — nên đường nhận tin, sổ tài liệu và mọi bảng khác có khoá ngoại tới dự án (33 khoá ngoại) không bị chạm.
- **Ai tự lấy được khoá.** Chỉ role ghi được `public.projects`. Không role runtime nào (chỉ `SELECT`; `42501` đã đo dưới `libetech_runtime`). Role AI chỉ giữ được khoá **qua một lệnh chèn nháp thật** đi qua trigger phạm vi và guard, trong giao dịch của chính nó.
- **Hai chiều chờ — còn nguyên** (READ COMMITTED; guard vẫn từ chối mọi mức khác bằng `LTZ02`).
  - Lệnh ghi ánh xạ giữ khoá trước: guard chờ. Câu khoá và câu đọc ánh xạ vẫn là **hai câu lệnh riêng** của một hàm `VOLATILE`, nên câu đọc lấy ảnh chụp sau khi chờ và thấy ánh xạ vừa commit: nháp bị từ chối `LTZ01`. Đã đo cho cơ chế này (07.1); G23 và Y1 chứng minh trên chính hai hàm.
  - Lệnh chèn nháp giữ khoá trước: lệnh ghi ánh xạ chờ tới khi giao dịch chèn nháp kết thúc. Nháp được lưu **trước** ánh xạ — vẫn là trường hợp của OQ-54, không phải lỗ mới.
  - **Mới:** hai lệnh chèn nháp của cùng một dự án không còn chạy song song khi giao dịch của chúng còn mở — lệnh sau chờ lệnh trước. Đó là cái giá của việc xếp hàng công bằng (R34).
- **Khe «dòng dự án chưa thấy được» được đóng bằng phép từ chối.** Một dòng không thấy được thì không khoá được, nên một ánh xạ ghi cùng giao dịch với việc tạo dự án có thể commit mà guard không thấy. Guard vì vậy từ chối dòng nháp mà nó không thấy dòng dự án, và hàm của bảng ánh xạ làm điều đối xứng. Câu trả lời bắt chước khoá ngoại: cặp (tenant, dự án) không có thật vốn đã nhận `23503` từ bảng, nên role chịu RLS không nhận loại câu trả lời nào mới, và ca có sẵn ở `tests/z4-schema.test.ts:265-267` (chờ `/foreign key/`) giữ nguyên.
- **Trần.** `lock_timeout '5s'` ghim trong định nghĩa của cả hai hàm, như bản 0.6: một lần chờ quá 5 giây — vì một giao dịch bị để mở, hay vì hàng đợi phía trước dài — kết thúc bằng `55P03`, lệnh không ghi gì. Trần tính cho **từng lần lấy khoá**: một câu lệnh nhiều dòng chờ nhiều dự án có thể chạm trần 10 giây của câu lệnh trước (`57014`), vẫn là đóng. Vì hai phía cùng mức khoá, trường hợp «mỗi lần chờ đều ngắn mà không bao giờ tới lượt» của `FOR SHARE` không dựng được.
- **Vòng khoá chết.**
  - *Mới:* hai giao dịch, mỗi giao dịch chèn nháp cho hai dự án theo thứ tự ngược nhau (hoặc một bên chèn nháp, một bên ghi ánh xạ, miễn là hai dòng dự án bị khoá theo thứ tự ngược), chờ vòng: PostgreSQL huỷ một bên bằng `40P01`. Với khoá tư vấn chia sẻ, hai lệnh chèn nháp không bao giờ chờ nhau nên vòng này không có. `submitDraft` chèn một dòng mỗi giao dịch, tức khoá đúng một dòng dự án, và không dựng được vòng.
  - *Hết:* vòng (ii) của bản 0.6 — hai phiên cùng chèn nháp cho một dự án rồi cùng ghi ánh xạ cho dự án đó trong chính giao dịch ấy. Nay chúng **xếp hàng**: phiên thứ hai chờ ngay ở lệnh chèn nháp, tới khi phiên đầu kết thúc hoặc hết 5 giây. Một lệnh chèn nháp rồi một lệnh ghi ánh xạ của cùng dự án, ở hai giao dịch, cũng xếp hàng chứ không chờ vòng.
  - Nếu cụm đặt `deadlock_timeout` từ 5 giây trở lên, một vòng thật hiện thành `55P03` thay cho `40P01`: vẫn bị huỷ (review CSDL, mục 2.2).
- **`UPDATE`, `DELETE` trên bảng ánh xạ** vẫn bị `project_domain_mappings_immutable` từ chối: `INSERT` là đường ghi duy nhất, trigger chỉ cần phủ `INSERT`. Hôm nay chỉ login vận hành ghi ánh xạ.
- **Phục hồi dữ liệu.** Phục hồi data-only một giao dịch nạp dự án trước, rồi nháp, rồi ánh xạ (thứ tự đã đo; khoá ngoại vốn buộc dự án đi trước): guard và trigger của bảng ánh xạ khoá dòng do chính giao dịch đó vừa chèn — không chờ, và **không còn chiếm một chỗ trong bộ nhớ khoá dùng chung cho mỗi dự án** (khoá dòng nằm trên chính dòng), nên phần (a) của DB-4 không còn. Thứ tự «dự án, nháp, ánh xạ, nháp» trong một giao dịch đã đo là không lỗi. Phục hồi **song song** (`-j`) vẫn có thể kết thúc bằng `55P03` (một lệnh `COPY` chờ lệnh kia quá 5 giây) hoặc `40P01`; không có `--exit-on-error` thì kết quả là một bảng thiếu dữ liệu. Hai đường cài đặt của repo chạy một giao dịch, không `-j`. R20 và điều kiện 10 có ghi chú tương ứng.
- **Tệp lùi** không đổi câu lệnh nào: cùng ba trigger, ba hàm, cùng tên. Nó gỡ được thân của bản 0.4, thân dùng khoá tư vấn và thân mới. Chỉ một dòng chú thích đổi (07.5). R37 mở rộng.
- **Điều PGlite không cho thấy.** Một kết nối không quan sát được mức khoá dòng, và khoá dòng không hiện trong `pg_locks` khi không ai chờ. Trên PGlite, G21 chỉ khẳng định được hai điều: không còn khoá tư vấn nào của không gian 1346653516, và `xmax` của dòng dự án khác 0 sau lệnh chèn. Hành vi — chờ, thứ tự phục vụ, trần, phép từ chối khi dòng chưa thấy được — chỉ được chứng minh trên PostgreSQL 16: G23, G24, G27, Y1, Y2 và các ca mới N3–N6.

### 07.4 · Phần dư và điều kiện, viết lại cho khoá dòng

- **R34 (bản 0.7; thay R34 của bản 0.6 ở `:1339-1345`; đọc lại R5).** Khe «ánh xạ commit trong lúc lệnh chèn nháp đang chạy» được đóng cho mọi lệnh ghi đi qua hai trigger, và nay cả khi dòng dự án chưa thấy được. Phần dư, đúng cỡ:
  - *Ai hoãn được lệnh ghi ánh xạ của một dự án.* Chỉ còn: (i) một giao dịch **đã đưa một dòng nháp thật của dự án đó qua cả hai trigger** và còn mở — tức role AI trong phạm vi nó khai (phạm vi vẫn do role tự khai: R33), hoặc login vận hành; (ii) một giao dịch ghi ánh xạ khác của chính dự án đó còn mở; (iii) một role ghi được `public.projects` — **không role runtime nào**. Ba login dịch vụ đang có không còn làm được điều này. «Hoãn» vẫn không gỡ hẳn được: mọi cách đóng CX4 chặt đều buộc lệnh ghi ánh xạ chờ lệnh chèn nháp đang chạy. **Bản 0.8 (Task F5):** thêm (iv) một giao dịch đã ghi một dòng quyết định `confirmed` của dự án đó và còn mở — giao dịch xác nhận của dịch vụ, ngắn. **Đính chính sau hai lượt xem lại Task F5 (Q1 của ghế CSDL, S-F5-1 của ghế bảo mật; cả hai P2, chỉ sửa chữ):** từ Task F5, câu «ba login dịch vụ không còn hoãn được» chỉ còn đúng cho `libetech_auth` và `libetech_intake_svc`. **Login web (role runtime) nay giữ được khoá dòng dự án** qua trigger của bảng quyết định: một giao dịch chèn một dòng `confirmed` cho một nháp có thật, có nguồn — kể cả khi lệnh chèn đó sau cùng thất bại — giữ khoá tới khi giao dịch kết thúc. Trong một phiên SQL thô dưới login đó, phạm vi là thứ phiên tự đặt, nên với tới dự án của mọi tenant có một nháp như vậy. Chừng nào giao dịch còn mở: lệnh ghi ánh xạ, lệnh chèn nháp và lệnh xác nhận khác của dự án đó nhận `55P03` sau 5 giây; `UPDATE` hay `DELETE` dòng dự án chờ không trần; và kênh thời gian của S-6 mở cho role runtime. Không tự lấy được bằng một câu `SELECT … FOR …` (vẫn `42501`); dịch vụ chỉ giữ khoá trong đúng một giao dịch xác nhận ngắn. Hôm nay không khai thác được: Z4 tắt, không có nháp nào. Đóng bằng điều kiện 18 (login web có `idle_in_transaction_session_timeout`), không bằng mã.
  - *Trong bao lâu.* Mỗi lần thử thất bại `55P03` sau 5 giây, thành tiếng, CONTEXT nêu tên hàm; không lệnh nào treo. Một giao dịch bị để mở chỉ bị chặn bởi `idle_in_transaction_session_timeout` của login đó — một cấu hình **chưa có**, thuộc điều kiện 18. **Không có dạng mức phiên**: khoá dòng hết khi giao dịch hết. Các giao dịch chèn nháp ngắn gối nhau không bỏ đói được lệnh ghi ánh xạ: người chờ được phục vụ theo thứ tự đến (đã đo cho cơ chế; ca N4 cho chính hai hàm). **Trần là cho từng lần lấy khoá (R-5 của lượt soát lại CSDL, ghi thêm sau bản 0.7):** một lệnh đứng sau một lệnh chờ khác có thể chờ hai lần — một lần để tới lượt, một lần cho giao dịch đang giữ — tức tới gần 10 giây trước khi nhận `55P03` (suy luận của reviewer, chưa đo). Ai đặt hết giờ cho pipeline hay cho lệnh ghi ánh xạ thì tính theo 10 giây, không theo 5.
  - *Thứ đã mất so với bản 0.6.* Chiếc khoá mà mọi role tự lấy được; dạng mức phiên; kênh `pg_locks` cho mọi role thấy lúc nào một dự án đang được ghi ánh xạ hay chèn nháp; va chạm băm 32 bit giữa hai dự án; một chỗ trong bộ nhớ khoá dùng chung cho mỗi dự án của một giao dịch; hằng không gian khoá 1346653516.
  - *Cái giá mới.*
    1. **Các lệnh chèn nháp của một dự án chạy lần lượt** chừng nào giao dịch của chúng còn mở; một giao dịch chèn nháp bị để mở trả `55P03` sau 5 giây cho lệnh chèn nháp kế tiếp của dự án đó (đã đo: 5 003 ms). Người giữ role AI vì vậy hoãn được cả việc ghi nháp của phiên khác vào một dự án trong phạm vi nó khai. `submitDraft` chèn một dòng mỗi giao dịch. **Bản 0.8 (Task F5):** lệnh **xác nhận** của một dự án nay cũng lấy khoá này lúc ghi dòng quyết định: nó chờ một giao dịch chèn nháp hoặc ghi ánh xạ còn mở của dự án đó, và thất bại `55P03` ở trần — lỗi đi thô ra khỏi `decide`. Người giữ role AI với một giao dịch chèn nháp để mở vì vậy hoãn được cả các lệnh xác nhận của dự án đó.
    2. **Một giao dịch chèn nháp còn mở làm `UPDATE` hoặc `DELETE` dòng dự án đó phải chờ, và không trần nào của 022 phủ lệnh bị chờ** — nó là lệnh của bên thứ ba; không tự đặt `lock_timeout` thì nó chờ im lặng. Lệnh ghi ánh xạ còn mở cũng vậy. Hôm nay không mã nào và không role không-superuser nào ghi `projects` (catalog ở 07.1; review CSDL mục 6). Đây đúng là lo ngại R5 từng nêu để không khoá dòng dự án; nay nó là cái giá được nhận, có điều kiện 23 canh.
    3. **Giao dịch của role AI đánh dấu một khoá lên một dòng Z1**, qua hàm definer. Không phải một lần ghi dữ liệu: không cột nào đổi, không bản dòng mới. Khoá ngoại của bảng nháp (`ai_drafts_project_id_tenant_id_fkey`) đã làm đúng việc đó ở mức `FOR KEY SHARE` cho mỗi lệnh chèn; điều mới chỉ là **mức** khoá. Ghi ra để người kiểm độc lập không phải tự suy khi đối chiếu AR-03.
    4. **Một hàm `SECURITY DEFINER` thứ hai**, gắn vào trigger của một bảng Z1 (`public.project_domain_mappings`), nằm trong schema `intelligence` (DB-8). Nó không có tham số, không gọi thẳng được, khoá một dòng theo khoá chính, ghim `search_path`, `row_security = off`, `lock_timeout`, `REVOKE … FROM PUBLIC`. Hệ quả của DB-8 còn nguyên: lùi 021 phụ thuộc cứng vào việc lùi 022 trước; một bản dump chỉ schema `public` không dựng lại được trigger. **Bản 0.8 (Task F5):** nay là **ba** hàm `SECURITY DEFINER` (cùng một hàm `SECURITY INVOKER`) và **bốn** trigger trên ba bảng; hàm definer thứ ba, `draft_decisions_pointer_only_guard`, gắn vào trigger của `public.draft_decisions` — một bảng Z1 nữa — và cũng nằm trong schema `intelligence` (DB-8).
    5. **Trên PGlite không quan sát được mức khoá**: bằng chứng hành vi chỉ có ở PostgreSQL 16 (G23, G24, G27, Y1, Y2, N3–N6).
    6. **Khó nhìn hơn khi vận hành**: không bảng nào liệt kê người đang giữ khoá dòng; chỉ khi có lệnh đang chờ mới hỏi được, bằng `pg_blocking_pids` (câu ở mục 7.4 của review CSDL).
  - *Khác.* `55P03`, `57014`, `40P01` vẫn đi thô qua `submitDraft` (cùng lớp R31). Ánh xạ ghi khi trigger bị tắt, hoặc bởi một phiên ở `session_replication_role = replica`, không lấy khoá. Đường nhận tin đọc cùng ánh xạ mà không lấy khoá (`src/server/intake.ts:70`; ngoài diff của PR): chữ lưu như vậy bị ẩn lúc đọc. Trigger của bảng ánh xạ chạy **trước** mọi `WITH CHECK` và chạy với quyền definer: xem điều kiện 24. **Kênh thời gian còn lại (S-6 của lượt soát lại bảo mật, ghi thêm sau bản 0.7):** người giữ role AI khai được một cặp (tenant, dự án) bất kỳ (R33), thử một lệnh chèn nháp rồi lùi: lệnh đó phải chờ tới `55P03` hay đi qua ngay cho nó biết một giao dịch chèn nháp hoặc ghi ánh xạ của dự án ấy đang mở hay không — xuyên tenant, không để lại dòng nào. Hẹp hơn kênh `pg_locks` của bản 0.6 (phải khai phạm vi và thử ghi, mỗi lần một dự án) và không lộ nhãn; đóng hẳn thuộc thiết kế login AI, cùng R33.
- **Điều kiện 18 (bản 0.7; thay điều kiện 18 của bản 0.6 ở `:1352`).** Trần 5 giây đã nằm trong hai hàm. Còn lại, trước khi bật Z4:
  - login của pipeline có `idle_in_transaction_session_timeout` — một giao dịch chèn nháp bị để mở là thứ duy nhất của pipeline còn giữ được khoá;
  - pipeline coi `55P03` từ `submitDraft` là thử lại được; pipeline giữ giao dịch chèn nháp **ngắn** — không mở giao dịch qua một lời gọi mô hình hay một lần chờ mạng, vì nháp của một dự án nay được ghi lần lượt; tuyến đầu tiên gọi `submitDraft` đổi `55P03` và `40P01` thành một lỗi thử-lại-được của dịch vụ, không kèm `CONTEXT` của CSDL (hai ý sau là bổ sung của phiên chính, theo ghi chú của planner và đoạn «Không phải finding» của review bảo mật); pipeline ghi nháp của **một dự án mỗi giao dịch** (hoặc theo một thứ tự dự án cố định) và coi `40P01` là thử lại được: hai giao dịch chèn nháp cho cùng hai dự án theo thứ tự ngược nhau nay khoá chết (R-4 của lượt soát lại CSDL; `submitDraft` ghi một dòng mỗi giao dịch nên dịch vụ hôm nay không dựng được vòng đó). **Bản 0.8:** tuyến đầu tiên gọi `decide` cũng đổi `55P03` và `40P01` thành một lỗi thử-lại-được của dịch vụ, không kèm `CONTEXT` của CSDL — lệnh xác nhận nay cũng chờ khoá dòng dự án (Task F5).
  - người ghi ánh xạ biết `55P03` nghĩa là **một giao dịch chèn nháp hoặc ghi ánh xạ của dự án đó đang mở**, và tìm nó bằng câu `pg_blocking_pids` ở mục 7.4 của review CSDL.
  - **Bỏ** so với bản 0.6: `idle_session_timeout` và phép canh `pg_locks` cho `classid` 1346653516 — không còn khoá mức phiên, không còn khoá tư vấn.
- **Điều kiện 23 (mới).** Lát nào thêm một đường ghi lên `public.projects`, hoặc cấp `UPDATE` trên bảng đó cho một role runtime, phải đặt `lock_timeout` cho câu lệnh đó và **nêu migration 022 trong kế hoạch của nó**. Hai lý do: một giao dịch chèn nháp còn mở làm lệnh đó chờ; và một role có `UPDATE` trên `projects` tự lấy được khoá dòng, tức lấy lại đúng năng lực mà R34 vừa thu hẹp.
- **Điều kiện 24 (đề xuất của planner, theo mục D của review bảo mật — thiết kế B, điểm 3; phiên chính giữ).** Trước khi cấp `INSERT` trên `public.project_domain_mappings` cho một role chịu RLS: trigger khoá chạy trước `WITH CHECK` và với quyền definer, nên lệnh của role đó sẽ khoá hoặc chờ dòng dự án của tenant khác, và nhận `23503` hay câu của RLS tuỳ cặp (tenant, dự án) có thật hay không, **trước** khi RLS xét dòng — cùng lớp với CX1. Khi đó trigger khoá phải soi phạm vi trước, như trigger phạm vi của bảng nháp. **Bản 0.8:** lượt quét oracle nêu lại đúng điều kiện này (quét-S6).
- **Ghi chú nối tại chỗ ở các mục khác** (chữ đầy đủ nằm ở chính các dòng đó): R33 (`:1338`), bullet «Độ lệch giữa policy và trigger» của X1 (`:901`) và điều kiện 20 (`:1354`) — DB-1: trigger phạm vi phải chặt bằng **giao** của `ai_insert` và `ai_select`, G25 ghim cả hai sau Task F1b; R35 (`:1346`) — S-5; R20 (`:791`) và điều kiện 10 (`:807`) — DB-4; R37 (`:1348`) — hai thân cũ; R5 (`:223`).

### 07.5 · Task F1b — migration 022: khoá của CX4 thành khoá dòng; các finding của hai review trên F1–F3 — **review riêng** trên mã: CSDL và bảo mật

Nguồn để builder làm là brief `.superpowers/sdd/oq-45-46-ai-drafts/task-F1b-brief.md`; phần dưới là bản ghi của kế hoạch. Hai khối SQL được chép **bằng máy** từ brief đó, không gõ lại. Planner không chạy chúng.

**Tệp:** `migrations/022_ai_drafts_pointer_only_guard.sql`; `migrations/rollback/022_ai_drafts_pointer_only_guard.sql` (chỉ một dòng chú thích); `tests/z4-pointer-guard.test.ts`; `tests/suggestions-concurrency.test.ts`; `tests/migrations-rollback.test.ts`; `tests/suggestions.test.ts` (chỉ ca R12-i). `tests/z4-schema.test.ts` chỉ khi một ca ở đó đỏ vì thay đổi này — khi đó dừng và báo trước khi sửa. Không tệp nào dưới `src/`, không migration khác.

**Giữ đúng từng byte** trong tệp thuận: hàm `intelligence.ai_drafts_declared_scope_guard()`, ba dòng `REVOKE`, ba cặp `DROP TRIGGER IF EXISTS` / `CREATE TRIGGER`, `BEGIN;`, `SET LOCAL lock_timeout = '5s';`, dòng `schema_migrations` và `COMMIT;` — tức đúng như khối ở `:1012-1101`. Thay phần chú thích đầu tệp và hai hàm còn lại bằng:

Chú thích đầu tệp (mọi thứ phía trên `BEGIN;`): **[Bản 0.8: Task F5 đổi ba chỗ của chú thích dưới đây — «Three» thành «Four»; «Functions 2 and 3» thành «Functions 2, 3 and 4»; «none of the three functions» thành «none of the four functions» — và chèn mục 4; xem 08.4. Khối dưới là chú thích ở `56d257c`.]**

```sql
-- OQ-45 point 3 (b), decided by the Chairman on 18/11/2026: an AI draft of a project whose latest domain mapping is IBS_HI is refused when it is
-- written (AGENTS.md:16). Three BEFORE INSERT row triggers and no grant:
-- 1. ai_drafts_declared_scope_guard (SECURITY INVOKER; fires first: triggers of one event fire in name order). For a role that row-level security
--    binds on intelligence.ai_drafts, a row that the insert policy ai_insert (021) would refuse is refused here, with the policy's own answer (42501),
--    before any mapping is read: such a role cannot tell an IBS_HI project outside the scope it declared from any other project. The scope is the one
--    the role declared (app.*); what a holder of the role may declare is the business of the AI login design, not of this file.
-- 2. ai_drafts_pointer_only_guard (SECURITY DEFINER, owned by the migration login). It refuses a transaction that is not READ COMMITTED (LTZ02), locks
--    the project row of the draft FOR NO KEY UPDATE, refuses a row whose project row it cannot see (23503, the answer of the foreign key), then reads
--    the mapping row with the highest mapping_version of the row's own tenant and project (the rule of isIbsHiSql in src/server/source-text.ts) and
--    refuses IBS_HI (LTZ01). Unmapped and other labels decide nothing. row_security = off makes it fail closed: an owner that row-level security would
--    filter gets an error, never an empty read. It binds every writer, the operational login included.
-- 3. project_domain_mappings_draft_lock on public.project_domain_mappings (SECURITY DEFINER, same owner, same settings). A mapping insert locks the
--    same project row FOR NO KEY UPDATE and refuses when it cannot see it, so a draft insert and a mapping insert of one project take turns: the guard
--    reads a mapping that is committed, or the mapping waits for the draft and the draft was stored first. The mapping table is append-only (013):
--    INSERT is its only write.
-- The lock is a row lock on public.projects: the row that the foreign keys of both tables already lock (FOR KEY SHARE) on every insert, here at a
-- higher strength; no column changes. Only a role that may write public.projects can take it by itself, and no runtime role may (SELECT only: 001,
-- 010, 016). FOR NO KEY UPDATE does not wait for, and is not waited for by, an insert into any other table that references the project.
-- Both sides take the same strength on purpose: waiters then queue in order of arrival. With FOR SHARE in the guard, draft inserts that keep
-- overlapping starve a mapping insert without any bound (measured on PostgreSQL 16:
-- docs/reviews/oq-45-46-evidence-20261118/measurements-pg16-rowlock.txt). The price: draft inserts of one project run one at a time while their
-- transactions are open, and an open one makes an UPDATE of that project row wait.
-- Functions 2 and 3 wait under a lock_timeout of their own (5s, set in the function definition, whatever the session says): a wait that long ends in
-- 55P03 and the statement writes nothing.
-- libetech_ai is granted nothing and can call none of the three functions. Apply as the migration login (a superuser), like 019–021.
-- Nothing here switches anything on: no login, no password, no key, no membership, no grant, no model. No data rows except schema_migrations.
-- Rollback: migrations/rollback/022_ai_drafts_pointer_only_guard.sql (refuses while a later migration is recorded).
```

Hai hàm:

```sql
CREATE OR REPLACE FUNCTION intelligence.ai_drafts_pointer_only_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp SET row_security = off SET lock_timeout = '5s' AS $$
DECLARE latest text;
BEGIN
  -- The mapping is read under the snapshot of the calling transaction. Only READ COMMITTED gives this statement a fresh one: a REPEATABLE READ or
  -- SERIALIZABLE transaction opened before an IBS_HI mapping was committed would not see it and the draft would be stored (measured on PostgreSQL 16).
  -- Any other isolation level is refused, whatever the project.
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'An AI draft is written in a READ COMMITTED transaction' USING ERRCODE = 'LTZ02';
  END IF;
  -- A row without a tenant or a project is answered by the table (23502).
  IF NEW.tenant_id IS NOT NULL AND NEW.project_id IS NOT NULL THEN
    -- The project row is locked to the end of this transaction, in conflict with the same lock of a mapping insert of the project
    -- (project_domain_mappings_draft_lock) and of another draft insert of the project. It is a statement of its own, before the read: the read below
    -- then takes its snapshot after the wait and sees a mapping that was committed meanwhile. The wait is capped by the lock_timeout of this
    -- function: past it the insert fails with 55P03 and no draft is stored.
    PERFORM 1 FROM public.projects p WHERE p.id = NEW.project_id AND p.tenant_id = NEW.tenant_id FOR NO KEY UPDATE;
    IF NOT FOUND THEN
      -- A project row this statement cannot see cannot be locked, so a mapping written with it could commit unseen: refused, with the answer the
      -- foreign key of the table gives for a pair that does not exist.
      RAISE EXCEPTION 'insert or update on table "%" violates foreign key constraint "ai_drafts_project_id_tenant_id_fkey"', TG_TABLE_NAME
        USING ERRCODE = '23503', SCHEMA = TG_TABLE_SCHEMA, TABLE = TG_TABLE_NAME, CONSTRAINT = 'ai_drafts_project_id_tenant_id_fkey',
        HINT = 'Raised by the trigger ai_drafts_pointer_only_guard (migration 022): no project row of this tenant is visible to this statement.';
    END IF;
  END IF;
  SELECT m.domain_code INTO latest FROM public.project_domain_mappings m
   WHERE m.tenant_id = NEW.tenant_id AND m.project_id = NEW.project_id
   ORDER BY m.mapping_version DESC LIMIT 1;
  IF latest = 'IBS_HI' THEN
    RAISE EXCEPTION 'An AI draft is not stored for a pointer-only project' USING ERRCODE = 'LTZ01';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION intelligence.ai_drafts_pointer_only_guard() FROM PUBLIC;

CREATE OR REPLACE FUNCTION intelligence.project_domain_mappings_draft_lock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp SET row_security = off SET lock_timeout = '5s' AS $$
BEGIN
  -- A row without a tenant or a project is answered by the table (23502).
  IF NEW.tenant_id IS NOT NULL AND NEW.project_id IS NOT NULL THEN
    -- Held to the end of the transaction that writes the mapping: a draft insert of this project waits for it, and it waits for draft inserts in
    -- flight. An insert into any other table that references the project is not held up (FOR KEY SHARE). The wait is capped by the lock_timeout of
    -- this function: past it the insert fails with 55P03 and no mapping is written.
    PERFORM 1 FROM public.projects p WHERE p.id = NEW.project_id AND p.tenant_id = NEW.tenant_id FOR NO KEY UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'insert or update on table "%" violates foreign key constraint "project_domain_mappings_project_id_tenant_id_fkey"', TG_TABLE_NAME
        USING ERRCODE = '23503', SCHEMA = TG_TABLE_SCHEMA, TABLE = TG_TABLE_NAME, CONSTRAINT = 'project_domain_mappings_project_id_tenant_id_fkey',
        HINT = 'Raised by the trigger project_domain_mappings_draft_lock (migration 022): no project row of this tenant is visible to this statement.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION intelligence.project_domain_mappings_draft_lock() FROM PUBLIC;
```

**Tệp lùi:** không câu lệnh nào đổi. Trong chú thích bên trong khối `DO`, hai dòng nói về «earlier body of 022 (one trigger, one function)» thành:

```sql
-- dynamic and guarded, so the file can run again after a trigger, a function, a table or the schema is gone, and on a database that holds any
-- earlier body of 022 (one trigger and one function; or three with an advisory lock)
```

`prosecdef`, `proconfig`, `provolatile` phải có sau khi áp (thay bảng ở `:1138-1142`), dùng ở G12 và G20: **[Bản 0.8: hàm thứ tư, `intelligence.draft_decisions_pointer_only_guard`, có dòng riêng ở 08.4.]**

| Hàm | `prosecdef` | `proconfig`, đúng thứ tự | `provolatile` |
|---|---|---|---|
| `intelligence.ai_drafts_declared_scope_guard` | `false` | `['search_path=pg_catalog, pg_temp']` | `'v'` |
| `intelligence.ai_drafts_pointer_only_guard` | `true` | `['search_path=pg_catalog, pg_temp','row_security=off','lock_timeout=5s']` | `'v'` |
| `intelligence.project_domain_mappings_draft_lock` | `true` | `['search_path=pg_catalog, pg_temp','row_security=off','lock_timeout=5s']` | `'v'` |

**Ca kiểm viết hoặc sửa trước, rồi mới tới SQL.** Thứ tự: sửa và thêm ca → chạy trên PGlite với SQL **cũ**, lưu log đỏ → đổi SQL → xanh trên PGlite. Một ca đỏ phải đỏ vì `AssertionError` (hoặc, với ca ghim một câu trả lời, câu trả lời cũ hiện trong thông báo của khẳng định), không vì timeout, lỗi cú pháp hay thiếu helper. Chữ chính xác của từng ca nằm ở brief; bảng dưới ghi mỗi ca đổi gì và vì đâu. **«N1–N6» ở đây là mã ca mới của Task F1b, không phải mục N1, N2 của cổng bảo mật trên thiết kế (X0b).**

Ca đổi:

| Ca | Tệp | Vì | Đổi gì |
|---|---|---|---|
| G4 | `tests/z4-pointer-guard.test.ts` | DB-2 | Thêm hai dòng **tới được** câu đọc definer với tenant lệch, để vế tenant lại làm ca đỏ được: (a) login vận hành chèn dòng `tenant_id = ids.otherTenant`, `project_id = ids.transport` sau khi `ids.transport` thành `IBS_HI`; (b) role AI khai tenant của mình và khai một dự án của tenant khác đã ánh xạ `IBS_HI` (nếu fixture không có dự án nào của tenant khác thì chỉ làm (a) và nêu trong báo cáo). Cả hai: `23503`, không phải `LTZ01`, không lưu gì |
| G11 | cùng tệp | cơ chế mới; B-6 của review CSDL | Câu lệnh hỏng nay là câu khoá dòng trên `projects`: ghim đúng câu mà động cơ trả khi chủ của guard là `libetech_runtime`, có tên bảng `projects`. Thêm ca song sinh cho hàm khoá của bảng ánh xạ |
| G12 | cùng tệp | cơ chế mới; DB-7 (b) | Bảng ghim của hàm khoá theo bảng ở trên; thêm `provolatile:'v'` cho cả ba hàm. Đoạn phải có: câu `PERFORM … FOR NO KEY UPDATE` đầy đủ, `IF NOT FOUND THEN`, `ERRCODE = '23503'`; thứ tự `'transaction_isolation'` < `FOR NO KEY UPDATE` < `FROM public.project_domain_mappings`; **không thân nào chứa `pg_advisory`**. Chủ của **cả hai** hàm definer là superuser hoặc có `BYPASSRLS`. Phép so cả thân với tệp giữ nguyên |
| G19 | cùng tệp | DB-3 | Phần chạy với trigger phạm vi bị tắt, trong giao dịch luôn lùi, chạy **cả sáu** kiểu dòng — mỗi kiểu do chính policy từ chối — thay vì một kiểu |
| G20 | cùng tệp | cơ chế mới; DB-7 (a) | Bảng ghim như G12. Thêm: dưới role AI, lệnh đổi `lock_timeout` của hàm khoá bị từ chối (`/must be owner/`). Thêm «không role nào tự lấy được khoá»: dưới role AI và dưới role runtime, khoá dòng `projects` bằng `FOR NO KEY UPDATE` và bằng `FOR SHARE` đều bị từ chối `/permission denied/` |
| G21 | cùng tệp | cơ chế mới; B-10 | Viết lại, và yếu đi trên PGlite: trong một giao dịch, sau lệnh chèn nháp và sau lệnh ghi ánh xạ của `ids.sales`: (i) `pg_locks` **không** có khoá tư vấn nào với `classid` 1346653516 — khẳng định đỏ trên SQL cũ; (ii) `xmax` của dòng `ids.sales` trong `public.projects` khác `0`. Tên ca bỏ «shared», «exclusively», «gone when the transaction ends» |
| G22 | cùng tệp | DB-5 | Giữ. Thêm: trong một giao dịch, chèn nháp rồi ghi ánh xạ cho cùng dự án → không lỗi; và thứ tự phục hồi một giao dịch — dự án mới, nháp, ánh xạ, nháp thứ hai → không lỗi |
| G25 | cùng tệp | DB-1 | Ghim thêm phía `SELECT`: policy có `polcmd` thuộc `('r','*')` áp cho `libetech_ai` là đúng một dòng, `ai_select`, và `pg_get_expr(polqual, polrelid)` bằng một hằng viết trong tệp. Sửa chú thích: trigger phải chặt bằng **giao** của `ai_insert` và `ai_select` |
| G27 (native) | cùng tệp | cơ chế mới; S-3 | Viết lại: phiên của role AI không còn tự giữ khoá được. Nay nó chèn một nháp của dự án P và **để giao dịch mở**; lệnh ghi ánh xạ `IBS_HI` của P thất bại `55P03` sau trần, thời gian trong `[4000, 9000)` ms, không dòng ánh xạ nào; giao dịch kia commit thì lệnh ghi ánh xạ qua và nháp mới của P nhận `LTZ01`. Lệnh chờ chạy dưới `SET LOCAL statement_timeout = '8s'` và ca có timeout 20 giây: thiếu trần thì hiện thành `57014` ở khẳng định về mã, không thành timeout của vitest |
| Y2 (native) | `tests/suggestions-concurrency.test.ts` | cơ chế mới; S-3 | Chỉ đổi cách giữ khoá: kết nối vận hành giữ `FOR NO KEY UPDATE` trên dòng dự án trong một giao dịch mở, thay cho khoá tư vấn. Phần còn lại giữ (`55P03`, không phải `AppError`, bảng nháp không đổi, gửi lại đúng phong bì thì lưu được) |
| RB3 | `tests/migrations-rollback.test.ts` | DB-6 | Trong `toOldShape` thêm việc gỡ `lock_timeout` khỏi `proconfig` của guard và khẳng định nó đã mất; bước (i) chứng minh tệp thuận đặt lại |
| `answer()` | `tests/z4-pointer-guard.test.ts` | S-2 | So `code`, `message`, `detail`, `hint`, `where` ở mọi chỗ hai câu từ chối được so với nhau. Nếu một phép so vì vậy đỏ: dừng và báo trường nào khác, không nới lại |
| R12-i (E12) | `tests/suggestions.test.ts` | phán quyết về CX3; S-4 | Dòng «cặp» gửi kèm `revision` → `INVALID_INPUT` 422; gửi không kèm → `heldOnly('ENTITY_NOT_FOUND','SUBJECT_ORDER_UNVERIFIED')`. Hai dòng nháp tài liệu vẫn `held(…,'ENTITY_NOT_FOUND')` |

Ca mới:

| Ca | Làn | Khẳng định |
|---|---|---|
| N1 | PGlite | Nháp cho một cặp (tenant, dự án) không có bị guard từ chối `23503`, không lưu gì — role AI khai một mã dự án ngẫu nhiên; login vận hành với mã ngẫu nhiên; login vận hành với `tenant_id = ids.otherTenant` và `project_id = ids.sales`. `message` chứa `foreign key`; `hint` nêu `ai_drafts_pointer_only_guard` (khẳng định đỏ trên SQL cũ, nơi chính khoá ngoại trả lời) |
| N2 | PGlite | Ánh xạ cho một dự án không có bị từ chối `23503`, `hint` nêu `project_domain_mappings_draft_lock`, không dòng nào được ghi. `lock_timeout` của phiên không đổi sau một lệnh ghi ánh xạ thành công |
| N3 | native | Khe «dòng dự án chưa thấy được»: kết nối A tạo một dự án mới và ghi ánh xạ `IBS_HI` cho nó, chưa commit; kết nối B (role AI) chạy **một** lệnh chèn hai dòng — dòng đầu cho dự án mới, dòng sau có một biểu thức tính chậm. B bị từ chối `23503` **ngay ở dòng đầu** (dưới 1 000 ms), không nháp nào được lưu; sau khi A commit, một nháp mới của dự án đó nhận `LTZ01` |
| N4 | native | Người chờ được phục vụ theo thứ tự đến: một giao dịch chèn nháp của P còn mở; lệnh ghi ánh xạ `IBS_HI` của P chờ; một lệnh chèn nháp thứ ba của P đến sau và chờ. Giao dịch đầu commit: lệnh ghi ánh xạ qua, và nháp thứ ba nhận `LTZ01` — nó không vượt lên trước ánh xạ |
| N5 | native | Điều một giao dịch chèn nháp còn mở giữ lại, nói thành ca: `UPDATE` dòng dự án đó dưới `lock_timeout` 500 ms → `55P03`; `SELECT … FOR KEY SHARE NOWAIT` trên dòng đó — thứ phép kiểm khoá ngoại của bảng khác lấy — qua |
| N6 | native | Phần dư đã gỡ: một kết nối giữ khoá tư vấn cũ ở mức phiên **không** làm chậm lệnh ghi ánh xạ của P (qua, dưới 1 000 ms) và không làm chậm lệnh chèn nháp của dự án khác |

Không đổi: G23, G24, G26, phần còn lại của G19, Y1, RB1, RB2 (trừ khi một chỗ ghim nêu khoá tư vấn hoặc `prosecdef:false` của hàm khoá — khi đó sửa chỗ ghim đó và nêu trong báo cáo). Một ca trong số đó đỏ trên PGlite sau khi đổi SQL: dừng và báo, không sửa ca.

Chỉ chạy được trên PostgreSQL 16, do phiên chính chạy: G23, G24, G27, Y1, Y2, N3, N4, N5, N6. Hai chuỗi builder ghim sau khi đọc trên PGlite — câu lỗi của G11 và `using` của `ai_select` ở G25 — phải được phiên chính đối chiếu trên PostgreSQL 16 (PGlite 0.5.15 tự báo là PostgreSQL 18.6). Lệnh chạy, quy tắc và mẫu báo cáo: theo brief.

**Điểm commit** (phiên chính; chữ đề xuất): `fix(db): the lock of the draft guard is a row lock on the project row, and a draft for a project it cannot see is refused (review of fix round 1: DB-9, S-1)`.

### 07.6 · Bổ sung cho X5 — ca hiện có bị chạm ở bản 0.7

X5 (`:953-1004`) giữ nguyên chữ. Thêm:

- **Bảng thứ tư: ca của Task F1 đổi vì Task F1b** — là bảng «Ca đổi» ở 07.5. Chia theo lý do:
  - *đổi kỳ vọng vì cơ chế khoá mới* (có chủ ý; không phải nới ca): G11, G12, G20, G21, G27, Y2;
  - *chặt thêm vì finding của review, không đổi điều đã khẳng định:* G4 (DB-2), G19 (DB-3), G22 (DB-5), G25 (DB-1), RB3 (DB-6), helper `answer()` (S-2);
  - *yếu đi, và ghi rõ:* G21 trên PGlite không còn khẳng định được mức khoá hay «hết giao dịch thì hết khoá» (B-10); phần đó chuyển sang các ca native.
- **E12 — ca thứ mười hai đổi kỳ vọng vì CX3** (nối vào bảng thứ ba của X5, sau E11 ở `:994`; nguồn: phán quyết của phiên chính về việc dời `INVALID_INPUT`, trong phạm vi quyết định phạm vi của Chairman, phương án B — không phải một quyết định mới của Chairman).

| # | Dòng | Ca | Lệnh từng kiểm điều gì | Nay đổi thành | Tính chất nay được ghim bằng |
|---|---|---|---|---|---|
| E12 | `:337` | «R12-i an entity not in the project, or a pair the builder refuses, is held as ENTITY_NOT_FOUND with codes only» | ba dòng — hai nháp tài liệu trỏ tới một tài liệu không có trong dự án, và một dòng «cặp» (nháp ứng viên mang kỹ năng tài liệu) — đều gửi kèm `revision` và đều bị giữ `ENTITY_NOT_FOUND` | hai nháp tài liệu: không đổi. Dòng «cặp»: gửi kèm `revision` → `INVALID_INPUT` 422 (lỗi của lệnh trả trước mọi lý do giữ); gửi không kèm → `heldOnly('ENTITY_NOT_FOUND','SUBJECT_ORDER_UNVERIFIED')` | `ENTITY_NOT_FOUND` của dòng «cặp» nay ghim bằng danh sách mã bằng-đúng, chặt hơn «chứa»; tổ hợp «cặp + `revision`» có khẳng định riêng (S-4) |

- **Đính chính câu của X4** (`:945`): «không ca hiện có nào dựng tổ hợp đó» là **sai**. R12-i dựng đúng «lệnh xác nhận nháp ứng viên kèm `revision` trên một nháp đang bị giữ». Ở bản 0.5 planner soát các lệnh xác nhận **thành công** của nháp ứng viên (mười một ca E1–E11) và đo riêng một lệnh kèm `revision` trên nháp sạch, nhưng không soát các lệnh **bị giữ** kèm `revision`; R12-i lọt vì dòng «cặp» của nó được dựng bằng `rawDraft` với `entityType` là `intake_candidate`. Câu tóm tắt ở `:996` («mười một ca») đúng cho các lệnh xác nhận thành công; tổng số ca hiện có đổi kỳ vọng vì CX3 là **mười hai**.
- **Đã soát, không đổi vì Task F1b:** `tests/z4-schema.test.ts:265-267` (chờ `/foreign key/` cho một nháp có cặp không tồn tại: nay do guard trả, cùng mã và cùng chữ); ca canh «no SECURITY DEFINER function is executable by libetech_ai» (nay canh hai hàm definer của 022); G7, G9, G26 (hàm phạm vi không bị chạm); các ca của F2 và F3 ngoài R12-i.

### 07.7 · Task F4 sau Task F1b

Task F4 (`:1317-1334`) giữ các bước; ba chỗ của nó được sửa tại chỗ ở bản 0.7:

- **Số ca mong đợi** (`:1321`): các con số của bản 0.6 không còn dùng. **Số ca sau F1b do phiên chính đo sau khi F1b xong; kế hoạch không ước con số nào.**
- **Bối cảnh gửi cổng Codex vòng 2** (`:1325-1330`): ý 2 (R34) viết lại cho khoá dòng; ý 4 nay nói tệp 022 được sửa tại chỗ **hai lần** trong PR này (F1, rồi F1b) và chưa từng được áp ở đâu ngoài CSDL thử của PR; danh sách ca đổi kỳ vọng thêm các ca của 07.6 và E12. Ý 1 (R33) đọc cùng ghi chú DB-1. **Bản 0.8:** nay là ba lần (F1, F1b, F5); các ý thêm ở 08.6.
- Trước lượt PostgreSQL 16: lùi 022 trên CSDL thử bằng tệp lùi **hiện hành** rồi để harness áp lại (R37) — CSDL đó đang mang thân dùng khoá tư vấn. Lượt cả bộ trên PostgreSQL 16 gồm cả sáu tệp mà lượt native của F1 chưa chạy (`project-registry`, `intake`, `inbox-service`, `skill-context`, `source-text`, `rls-catalog`; ⚠️-3 của review CSDL): các ca ghi ánh xạ của chúng nay đi qua một trigger definer.

### 07.8 · Chỗ bản 0.7 làm khác chữ của hai reviewer, điều chưa chắc, và điều phán quyết chưa nêu

Làm khác chữ của reviewer (bổ sung cho X7):

1. **`FOR NO KEY UPDATE` trong guard, không phải `FOR SHARE`** như khối SQL ở mục 7.4 của review CSDL. Review tự ghi khe này là B-2 («không sửa được trong cơ chế khoá dòng», chờ đo). Đã đo (07.1): với `FOR SHARE`, lệnh ghi ánh xạ bị bỏ đói không giới hạn — `57014` sau 14 003 ms trong lúc 282 giao dịch chèn nháp đi qua, trần 5 giây không nổ; với `FOR NO KEY UPDATE` ở cả hai phía, nó được phục vụ sau 418 ms. Cái giá: các lệnh chèn nháp của một dự án chạy lần lượt (R34, cái giá 1).
2. **Câu trả lời cho dòng dự án không thấy được bắt chước khoá ngoại** (`23503`, cùng câu, thêm các trường SCHEMA, TABLE, CONSTRAINT và một `HINT`), không dùng một mã riêng. Review CSDL nêu cả hai cách và để phiên điều phối chọn; khối SQL của review không có ba trường đó. Lý do: role chịu RLS không nhận loại câu trả lời mới; ca ở `tests/z4-schema.test.ts:265-267` giữ nguyên.
3. **S-3:** reviewer đề nghị bọc lệnh chờ trong `Promise.race` với hạn 9 giây; F1b dùng `SET LOCAL statement_timeout = '8s'` cho lệnh chờ và timeout 20 giây cho ca. Cùng mục đích: thiếu trần thì đỏ ở một khẳng định về mã, không phải timeout của vitest.
4. **DB-5:** reviewer đề nghị khẳng định hai dòng `pg_locks` (`ShareLock`, `ExclusiveLock`) — không còn áp dụng vì không còn khoá tư vấn; G22 khẳng định «không lỗi» cho cả hai thứ tự trong một giao dịch.
5. **DB-8: ghi nhận, không đổi.** Hàm khoá vẫn nằm trong schema `intelligence`, và nay là definer. Tên và schema của ba hàm giữ nguyên để tệp lùi không đổi câu lệnh nào. **Bản 0.8:** hàm definer thứ ba, của Task F5, cũng nằm trong schema `intelligence` và gắn vào trigger của `public.draft_decisions`; DB-8 vẫn «ghi nhận, không đổi».
6. **S-1, cách thứ hai** (giữ khoá tư vấn và canh `pg_locks` cho cả ba login): không dùng — cơ chế được thay.

Chưa chắc:

- Phép khoá dòng dưới `libetech_identity` và `libetech_intake` (chỉ có `SELECT` theo cột): lúc planner viết bản 0.7 **chưa được đo trực tiếp**. **Phiên chính đã đo sau đó** (phép đo 4 của `measurements-pg16-rowlock.txt`): cả chín role có tên bắt đầu bằng `libetech` — ba login dịch vụ, `libetech_ai` và các role nhóm — đều nhận `42501` cho `FOR NO KEY UPDATE`, `FOR SHARE` và `FOR KEY SHARE` trên `public.projects`. G20 của F1b ghim role AI và role runtime.
- «Người chờ được phục vụ theo thứ tự đến» được đo trong schema nháp với ba kết nối; với chính hai hàm của 022, đó là việc của ca N4.
- «Một giao dịch bị để mở chỉ bị chặn bởi `idle_in_transaction_session_timeout`» là một điều kiện cho login chưa có, không phải hiện trạng.
- Câu lỗi của G11 và dạng in của `using` của `ai_select` (G25) do builder đọc trên PGlite — một bản PostgreSQL khác bản 16 của lượt native.
- Planner không chạy SQL của F1b; các câu «đã đo» của mục này đều lấy từ tệp đo của phiên chính.

Điều planner thấy phán quyết chưa nêu (để phiên chính quyết; ngoài điều kiện 24 ở 07.4, không điều nào đã được đưa vào task):

- **Review bảo mật, mục D — thiết kế B, điểm 3:** trigger của bảng ánh xạ chạy trước `WITH CHECK`; cần một điều kiện trước khi cấp `INSERT` trên bảng ánh xạ cho role chịu RLS. Planner đã ghi thành điều kiện 24, có gắn nhãn đề xuất.
- **Review bảo mật, đoạn «Không phải finding»:** tuyến đầu tiên gọi `submitDraft` phải đổi `55P03` / `40P01` thành một `AppError` 503 không kèm `CONTEXT`. Điều kiện 18 hiện chỉ nói pipeline coi `55P03` là thử lại được.
- **Pipeline giữ giao dịch chèn nháp ngắn** (không giữ mở qua một lời gọi mô hình): hệ quả trực tiếp của «các lệnh chèn nháp của một dự án chạy lần lượt»; chưa có trong điều kiện nào.
- **Ghi chú triển khai của review CSDL (mục 4.1) và năm câu chỉ đọc (4.2)** là cho biên nhận, và tả khoá tư vấn. Với khoá dòng, theo chính review: ở câu B, dòng của hàm khoá thành `prosecdef = t` với `proconfig` như guard, và hai giá trị `body_md5` phải tính lại; câu E thay bằng câu ở 7.4; mục 8 của bảng 4.1 bỏ ý về khoá tư vấn.
- **Review CSDL, mục 7.6, điểm 4:** câu lỗi thật của G11 trên PostgreSQL 16 khi chủ hàm là `libetech_runtime` chưa có trong tệp đo.

### 07.9 · Tự soát của planner cho bản 0.7

Từng finding của hai review — áp ở đâu, hoặc vì sao không:

| Finding | Mức | Áp ở đâu |
|---|---|---|
| DB-1 | P2 | G25 ghim thêm `ai_select` (Task F1b); ghi chú «giao của `ai_insert` và `ai_select`» ở R33 (`:1338`), X1 (`:901`), điều kiện 20 (`:1354`) |
| DB-2 | P2 | G4 thêm hai dòng tới được câu đọc definer (Task F1b) |
| DB-3 | P3 | G19 chạy cả sáu kiểu dòng dưới giao dịch tắt trigger (Task F1b) |
| DB-4 | P3 | Phần (a) hết cùng khoá tư vấn; phần (b) — phục hồi song song — ở 07.3, R20 (`:791`), điều kiện 10 (`:807`) |
| DB-5 | P3 | G22 thêm «nháp rồi ánh xạ» và thứ tự phục hồi trong một giao dịch (Task F1b); không còn khẳng định về `pg_locks` (07.8 mục 4) |
| DB-6 | P3 | RB3: `toOldShape` gỡ `lock_timeout` khỏi `proconfig` (Task F1b) |
| DB-7 | P3 | (a) G20: role AI không đổi được `lock_timeout` của hàm; (b) `provolatile:'v'` ở G12 (Task F1b) |
| DB-8 | P3 | **Ghi nhận, không đổi** (07.8 mục 5; R34, cái giá 4). **Bản 0.8:** áp cả cho hàm definer thứ ba, của Task F5 |
| DB-9 | P2 | Cơ chế được thay: khoá dòng (07.2, 07.3, Task F1b); R34 viết lại (07.4) |
| S-1 | P2 | Như DB-9 |
| S-2 | P3 | Helper `answer()` so năm trường (Task F1b) |
| S-3 | P3 | G27 và Y2: thiếu trần hiện thành một khẳng định về mã (Task F1b; cách làm khác reviewer, 07.8 mục 3) |
| S-4 | P3 | R12-i: hai khẳng định mới cho dòng «cặp» (Task F1b; E12 ở 07.6) |
| S-5 | P3 | **Chỉ ghi chú**, ở R35 (`:1346`); không đổi mã |

Chữ của các bản trước mà bản 0.7 thay — đều còn nguyên tại chỗ, có nhãn «Bản 0.7»:

| Chỗ | Thứ bị thay | Chữ hiện hành |
|---|---|---|
| X0, dòng CX4 (`:862`); X0b, dòng N1 (`:872`) | «khoá tư vấn theo dự án» | 07.2 |
| X2 (`:906-923`) | cả thiết kế khoá tư vấn: cơ chế, vòng khoá chết, phục hồi, «năng lực mới», «phương án khác đã xét» (phương án đó nay được dùng), «đã đo» | 07.3 |
| X4 (`:945`) | câu «không ca hiện có nào dựng tổ hợp đó» | 07.6 |
| Task F1 (`:1008`): khối SQL thuận (`:1012-1101`), bảng `proconfig` (`:1138-1142`), chữ của G19, G20, G25 (`:1147-1149`), G21, G22, G27, Y2 (`:1167`, `:1168`, `:1171`, `:1173`), RB3 (`:1179`) | chú thích đầu tệp, hai hàm khoá, các ca nêu khoá tư vấn | 07.5 |
| Task F4 (`:1321`, `:1327`, `:1329`) | số ca mong đợi; ý 2 và ý 4 của bối cảnh vòng 2 | 07.7; hai ý được viết lại ngay tại dòng |
| R34 (`:1339-1345`); điều kiện 18 (`:1352`) | phần dư và điều kiện của khoá tư vấn | 07.4 |
| X7, mục 3 và mục 6 (`:1362`, `:1365`); R5 (`:223`) | «giữ khoá tư vấn như phán quyết»; các điều chưa chắc của khoá tư vấn | 07.2, 07.8 |

Điều khác đã soát:

- Lời Chairman: không câu nào được chép lại, sửa hay dời ở bản 0.7; số lần xuất hiện của từng câu trong tệp bằng đúng bản 0.6 (so bằng máy).
- Không dòng nào trước mục này bị chèn hay xoá; các dòng đổi tại chỗ là đúng các dòng liệt kê ở dòng phiên bản (`:5`).
- `docs/OPEN-QUESTIONS.md` không đổi ở bản 0.7: không câu nào ở đó nêu khoá tư vấn của 022 như một sự thật về mã (chỗ duy nhất có chữ «khoá tư vấn», `:876`, nói về khoá của đường nhận tin ở `src/server/intake.ts:87`).
- Hai khối SQL và hai dòng chú thích của tệp lùi ở 07.5 được chép bằng máy từ brief của Task F1b và so lại bằng máy sau khi ghi.
- Không đường dẫn máy, không bí mật trong mục này; mọi đường dẫn là đường dẫn trong repo.
- Chưa làm, và không phải việc của planner: mã và log của Task F1b; lượt PostgreSQL 16; review của F1b; số ca của F4; cổng Codex vòng 2.

## Quét lớp lỗi trước vòng 2 của cổng và Task F5 (bản 0.8)

Do agent `planner` ghi ngày 18/11/2026 (mô hình Fable 5.2, không lùi mô hình), theo phán quyết của phiên chính — **không phải lời hay quyết định của Chairman**; không điều gì ở đây chọn một phương án của một câu hỏi mở. Lời Chairman không được chép lại ở mục này và không bị đổi ở đâu trong tệp. Mục này là hồ sơ; mã của nó do Task F5 làm theo brief `.superpowers/sdd/oq-45-46-ai-drafts/task-F5-brief.md`. Ở bản 0.8 không dòng nào trước mục này bị chèn hay xoá: chữ bị thay hoặc được bổ sung mang nhãn «Bản 0.8» tại chỗ (danh sách ở 08.7).

**Cách gọi tên trong mục này.** «quét-F1» … «quét-F7» là finding của lượt quét chạy đua; «quét-S1» … «quét-S6» là finding của lượt quét oracle và khe che. «Task F5» là một task, không phải finding. «DB-…», «S-1» … «S-7», «R-1» … «R-5» là finding của các review trước. Các ca của Task F5 mang mã của brief; ở đây chúng được viết «F5-P1» … «F5-P5» và «F5-X1» để khỏi lẫn với ca «P3 whatever masks…» có sẵn, với mục X1 của kế hoạch, và với mức P0–P3 của finding.

**Trạng thái lúc ghi** (theo phiên chính; mọi thứ đã commit). F1b `56d257c`. F1c `0ec1e1b` — chỉ ca kiểm, sau hai lượt xem lại mã của F1b: G21 quan sát được khoá trên một kết nối (R-1), N1 và N2 so ba trường schema, table, constraint của câu từ chối với catalog (R-2), G20 đi qua mọi role `libetech%` và khẳng định không role nào được cấp `UPDATE`, `DELETE` hay `TRUNCATE` trên `public.projects` (R-3, S-7), và ca N7 chỉ chạy trên PostgreSQL thật. Hồ sơ: `f7e61f6` (kế hoạch 0.7), `408344f` (hai lượt xem lại, các câu catalog đã chạy, log cả bộ), `12570c4` (hai lượt quét). Hai lượt xem lại đều kết luận «READY FOR GATE»: CSDL — `docs/reviews/oq-45-46-evidence-20261118/gates/review-codex-fix1-F1b-database.md`, năm P3 (R-1…R-5) — và bảo mật — `docs/reviews/oq-45-46-evidence-20261118/gates/review-codex-fix1-F1b-security.md`, hai P3 (S-6, S-7). Ba mục về chữ (R-4, R-5, S-6) đã được phiên chính nối tại chỗ vào R34 và điều kiện 18 của bản 0.7. Cả bộ ở `56d257c`: typecheck mã thoát 0; PGlite 1 208 ca đạt, 74 bỏ qua; PostgreSQL 16 1 282 ca đạt, 0 bỏ qua (`head-56d257c-typecheck.txt`, `head-56d257c-pglite.txt`, `head-56d257c-native-verbose.txt`). Trong lúc mục này được viết, builder đang làm Task F5: planner không đọc, không chạy và không sửa mã của task đó, và không chạy SQL nào.

### 08.1 · Hai lượt quét theo lớp

Trước vòng cuối của cổng Codex, hai reviewer mới — chưa xem nhánh trước đó, chỉ đọc — quét **cả lớp lỗi** của bốn finding vòng 1, không chỉ các ví dụ đã sửa. Mã được quét ở `56d257c`. **[Bản 0.9: chữ «vòng cuối» ở câu trên là sai — brief cho tối đa hai vòng sửa ở cổng; vòng 2 không phải lượt cuối, lượt chạy cuối là vòng 3 (09.3).]**

- **Lượt quét chạy đua** — lớp của CX3 và CX4: «kiểm, rồi người khác commit, rồi mình commit». Báo cáo: `docs/reviews/oq-45-46-evidence-20261118/gates/sweep-races.md`. Dòng cuối, chép nguyên: `SWEEP: P0/P1 FOUND`. Đếm: P0 0 · P1 1 · P2 1 · P3 5.
  - **quét-F1 [P1, mới]** — một lệnh xác nhận nháp **tài liệu** có thể commit sau khi dự án đã thành `IBS_HI`. `decide` đọc `pointerOnly` qua ngữ cảnh nó dựng (chưa phải `IBS_HI`); một giao dịch khác ghi ánh xạ `IBS_HI` và commit, không chờ gì vì `decide` không giữ khoá nào trên dòng dự án; `decide` ghi bản đề xuất và dòng quyết định `confirmed` rồi commit. Điều lúc đọc sẽ che (`POINTER_ONLY_PROJECT`), lệnh xác nhận đã cho qua: bất biến «bị che thì bị giữ» gãy. Cùng hình dạng với CX4 ở phía ghi nháp. R5 (`:223`) từng dựa vào «cổng xác nhận xử lý»; chính cổng đó không có khoá. Áp cả cho nháp ứng viên khi giữ chỗ của điểm 3 OQ-53 được gỡ.
  - **quét-F2 [P2, mới]** — câu trả lời của `decide` được ghép từ hai thời điểm: ngữ cảnh dựng ở bước giữ, và một lần chạy mới của `projectHasHiddenText`. Một ánh xạ commit ở giữa thì câu trả lời có thể mang `value` của một nháp mà dự án vừa thành `IBS_HI`. Người nhận là người có quyền và vừa đọc nội dung đó.
  - **quét-F3 [P3]** — `list` đọc ở nhiều thời điểm (các dòng, tổng số, ngữ cảnh dựng lười): một câu trả lời có thể trộn dòng hiện nội dung với dòng bị che, và tổng số lệch danh sách. Không hiện được thứ đã bị che lúc lời gọi bắt đầu.
  - **quét-F4 [P3]** — danh sách cờ nhóm là ảnh chụp lúc dựng đối tượng dịch vụ (gần R9).
  - **quét-F5 [P3]** — quyền xét theo vai đã nạp từ phiên. Đã ghi: R7.
  - **quét-F6 [P3]** — đường nhận tin, với một danh sách cờ khác, commit một bản tin lưu chữ sau phép kiểm theo dự án của `decide`: lệnh xác nhận commit trong lúc dự án có chữ đã lưu mà không được hiện. Chữ đó mới hơn nháp nên không thể nằm trong nháp.
  - **quét-F7 [P3]** — một giao dịch duy nhất chèn nháp rồi ghi ánh xạ `IBS_HI` cho cùng dự án: cả hai commit cùng lúc. Đã ghi: 07.3 và OQ-54.
  - Lượt quét còn ghi mười tám đường đã soát và thấy đóng, và sáu điều sẽ trở lại khi giữ chỗ của nháp ứng viên được gỡ (08.5, ghi chú cuối).
- **Lượt quét oracle và khe che** — lớp của CX1 và CX2: người không có quyền biết một sự kiện học được nó từ câu trả lời, và đường mà nội dung bị che tới tay người chỉ được nhận mã. Báo cáo: `docs/reviews/oq-45-46-evidence-20261118/gates/sweep-oracles-masking.md`. Dòng cuối, chép nguyên: `SWEEP: NO P0/P1 FOUND`. Ba P2, đều là phần dư đã viết; ba P3.
  - **quét-S1 [P2]** = R3: `valueHash` vẫn tới người có quyền quyết định dưới lớp che. Reviewer ghi rằng một cổng không nhận «phần dư đã ghi» có thể xếp nó P1.
  - **quét-S2 [P2]** = R33, R34: role AI tự khai phạm vi.
  - **quét-S3 [P2]** = R35, OQ-55: chữ của tin thuộc dự án khác chép vào nháp.
  - **quét-S4 [P3, mới một phần]** — câu `DRAFT_HELD` của một lệnh xác nhận trên nháp **đang bị che** nêu toàn bộ tập mã của cổng, không chỉ các mã che; R15 đếm thiếu.
  - **quét-S5 [P3, mới]** — cùng khe với quét-F2, nhìn từ phía câu trả lời.
  - **quét-S6 [P3]** = điều kiện 24.

### 08.2 · Phán quyết của phiên chính

1. **quét-F1 được sửa trước cổng Codex vòng 2, thành Task F5.** Một trigger `BEFORE INSERT` thứ tư của migration 022, `draft_decisions_pointer_only_guard`, trên `public.draft_decisions`; hàm `intelligence.draft_decisions_pointer_only_guard()`, `SECURITY DEFINER`, cùng ba thiết lập ghim của hai hàm definer kia. Chỉ với dòng `confirmed`: `LTZ02` nếu giao dịch không ở READ COMMITTED; khoá dòng dự án `FOR NO KEY UPDATE`; `23503` nếu không thấy dòng dự án; đọc lại ánh xạ; `LTZ01` nếu là `IBS_HI`. Một lệnh từ chối đi qua nguyên vẹn. `decide` đổi `LTZ01` ở lệnh chèn quyết định thành `DRAFT_HELD` có `POINTER_ONLY_PROJECT`; `LTZ02`, `23503`, `55P03`, `40P01` đi thô. Trigger chạy **sau** `draft_decisions_guard` của 021 (thứ tự tên), hàm đọc nháp dưới phạm vi của chính người gọi — nên một quyết định về nháp ngoài phạm vi của người gọi không bao giờ tới câu đọc ánh xạ. **quét-F2 và quét-S5 được đóng bằng cùng khoá đó.**
2. **quét-S1 ở lại là phần dư đã viết, R3 — viết lại cho đúng cỡ.** Lý do ghi lại: R3 có trong bối cảnh gửi cổng vòng 1 và cổng không nêu nó; đóng nó là đổi hợp đồng của `decide` từ lát 3 (người gọi gửi hash mình đã thấy). **Bản 0.9 — phán quyết này sai với cổng này.** Cổng Codex vòng 2 nêu đúng R3 ở mức P0 và không nhận lý do nào trong hai lý do trên; R3 được đóng bằng Task G1 (09.2, 09.4).
3. **quét-S3 ở lại (R35):** chữ của dự án khác chỉ vào được một nháp nếu pipeline đưa cho mô hình ngữ cảnh của dự án khác. Thêm một điều kiện trước khi bật Z4 (điều kiện 25, ở 08.5).
4. **quét-S4: không đổi mã.** Điểm 2 (b) của OQ-45 — phương án Chairman chọn — nói một lần đọc bị che «chỉ trả mã và lý do giữ» (chữ của phương án, `docs/OPEN-QUESTIONS.md:668`, không phải lời Chairman). Các mã của một lần giữ là đúng thứ phương án đó trả. Nhưng R15 đếm thiếu và được đính chính (08.5). **Bản 0.9 — được thay.** Sau lượt xem lại bảo mật của Task G1 (P2-1), phiên chính đổi mã bằng Task G2: trên một nháp bị che, câu giữ của lệnh xác nhận chỉ nêu các mã che, cộng giữ chỗ của điểm 3 OQ-53 với nháp ứng viên (09.6b).
5. **Các mục P3** quét-F3, quét-F4, quét-F6, quét-F7 và quét-S6: mỗi mục một dòng ở đúng chỗ — quét-F4 gần R9; quét-F7 gần OQ-54; quét-S6 là điều kiện 24; quét-F3 và quét-F6 thành hai dòng phần dư mới (R38, R39).

### 08.3 · Thiết kế của Task F5 — guard phía xác nhận

- **Khe.** Như quét-F1: dịch vụ kiểm ánh xạ sớm trong giao dịch xác nhận và không giữ khoá nào trên dòng dự án. Role runtime **không tự khoá được** dòng dự án (chỉ có `SELECT`; đã đo cho chín role `libetech*`, 07.8), nên phép đóng phải nằm ở CSDL, trong một hàm definer, như guard của bảng nháp.
- **Cơ chế.** Trigger đặt ở câu ghi **cuối cùng** của lệnh xác nhận — lệnh chèn dòng quyết định — nên không ánh xạ nào commit chen được vào giữa phép kiểm của guard và lúc commit của lệnh xác nhận. Ánh xạ `IBS_HI` giữ khoá trước: lệnh chèn quyết định chờ, rồi đọc lại ánh xạ ở một câu lệnh riêng (ảnh chụp mới, READ COMMITTED) và bị từ chối `LTZ01`. Lệnh xác nhận giữ khoá trước: lệnh ghi ánh xạ chờ tới khi quyết định commit — quyết định được ghi **trước** khi dự án thành `IBS_HI`, cùng loại với trường hợp của OQ-54.
- **Chỉ dòng `confirmed`.** Một lệnh từ chối không xác nhận gì: nó không lấy khoá, không bị giữ, và không bị ràng mức cô lập.
- **Thứ tự hai trigger của bảng quyết định.** `draft_decisions_guard` (021) sắp trước `draft_decisions_pointer_only_guard` theo tên. Hàm của 021 đọc nháp dưới phạm vi của người gọi và từ chối trước. Nếu thứ tự ngược lại, hàm definer sẽ trả `LTZ01` hay không cho một nháp ngoài phạm vi của người gọi — đúng kênh của CX1. Ca ghim: danh sách trigger `BEFORE INSERT` của `public.draft_decisions`, theo tên, bằng đúng hai tên đó; và ca F5-P3.
- **Dịch vụ.** `decide` bọc đúng một câu lệnh — lệnh chèn dòng quyết định: lỗi mang `LTZ01` ở một lệnh `confirmed` thành `DRAFT_HELD` với đúng một mã, `POINTER_ONLY_PROJECT`; mọi lỗi khác đi nguyên. Giao dịch lùi cả: không dòng quyết định, không bản tài liệu mới, khoá lệnh còn tự do.
- **quét-F2 và quét-S5.** Sau lệnh chèn quyết định, dòng dự án bị giữ tới lúc commit, nên mọi câu lệnh còn lại của giao dịch — kể cả lần `present` dựng câu trả lời — thấy cùng một ánh xạ; còn một ánh xạ đã commit trước lệnh chèn thì làm lệnh chèn thất bại. Câu trả lời của một lệnh từ chối không dùng lại ngữ cảnh nào: `present` tự dựng mới.
- **Thứ tự khoá mới của `decide`:** khoá tư vấn của nháp → dòng tài liệu → khoá lệnh → dòng dự án. Lệnh chèn nháp và lệnh ghi ánh xạ chỉ giữ dòng dự án và không cần gì trong ba khoá đầu: không vòng với đường nào đang có (reviewer của lượt quét đã soát bằng cách đọc mã).
- **Cái giá** (ghi vào R34): một lệnh xác nhận của một dự án nay **chờ** một giao dịch chèn nháp hoặc ghi ánh xạ của dự án đó còn mở, tối đa tới trần rồi thất bại `55P03`, đi thô ra khỏi `decide`; người giữ role AI với một giao dịch chèn nháp để mở vì vậy **hoãn được các lệnh xác nhận** của dự án đó. Chiều ngược lại: một giao dịch xác nhận còn mở làm lệnh chèn nháp và lệnh ghi ánh xạ của dự án đó chờ; giao dịch đó do dịch vụ điều khiển và ngắn.
- **Cả hai loại nháp.** Trigger nằm ở bảng quyết định nên phủ cả nháp ứng viên. Hôm nay lệnh xác nhận nháp ứng viên bị giữ sớm hơn (`SUBJECT_ORDER_UNVERIFIED`) và không tới lệnh chèn; khi giữ chỗ đó được gỡ, guard đã ở sẵn.
- **Sau Task F5, migration 022 có:** bốn trigger `BEFORE INSERT … FOR EACH ROW` trên ba bảng (`intelligence.ai_drafts` hai, `public.project_domain_mappings` một, `public.draft_decisions` một) và bốn hàm trong schema `intelligence` — một `SECURITY INVOKER`, ba `SECURITY DEFINER`. Mã của CSDL: `LTZ01`, `LTZ02`, `23503`, `55P03`. Không `GRANT` nào.
- **Chưa đo.** Lượt quét ghi rằng kịch bản quét-F1 và quét-F2 chưa được đo trên PostgreSQL 16; chúng dựa trên ma trận xung đột đã đo (07.1). Hành vi của guard mới do các ca chỉ chạy trên PostgreSQL thật chứng minh: F5-P4, F5-P5, Y3, Y4.

### 08.4 · Task F5 — một lệnh xác nhận không commit được cho dự án vừa thành chỉ con trỏ sau phép kiểm của nó — **review riêng** trên mã: CSDL và bảo mật

Nguồn để builder làm là brief `.superpowers/sdd/oq-45-46-ai-drafts/task-F5-brief.md`; phần dưới là bản ghi của kế hoạch. Các khối mã được chép **bằng máy** từ brief đó, không gõ lại. Planner không chạy chúng.

**Tệp:** `migrations/022_ai_drafts_pointer_only_guard.sql`; `migrations/rollback/022_ai_drafts_pointer_only_guard.sql`; `src/server/suggestions.ts` (chỉ lệnh chèn dòng quyết định trong `decide`); `tests/z4-pointer-guard.test.ts`; `tests/migrations-rollback.test.ts`; `tests/suggestions.test.ts`; `tests/suggestions-concurrency.test.ts`. `tests/z4-schema.test.ts` hoặc tệp test khác chỉ khi một ca ở đó đỏ vì thay đổi này — khi đó dừng và báo trước khi sửa.

**Tệp thuận.** Mọi thứ không nêu dưới đây giữ đúng từng byte so với `56d257c`.

(a) Trong chú thích đầu tệp: «Three BEFORE INSERT row triggers and no grant:» thành «Four BEFORE INSERT row triggers and no grant:»; «Functions 2 and 3 wait under a lock_timeout of their own» thành «Functions 2, 3 and 4»; «can call none of the three functions» thành «none of the four functions». Sau đoạn của mục 3 (các dòng kết thúc bằng «INSERT is its only write.») chèn đúng:

```sql
-- 4. draft_decisions_pointer_only_guard on public.draft_decisions (SECURITY DEFINER, same owner, same settings). A decision row that confirms a
--    draft is held to the same rule at the moment it is written: the function refuses a transaction that is not READ COMMITTED (LTZ02), locks the
--    project row FOR NO KEY UPDATE, reads the latest mapping and refuses IBS_HI (LTZ01). The service checks the mapping earlier in the same
--    transaction and holds no lock on the project row (the runtime role cannot take one); without this guard a mapping committed between that check
--    and this insert would let the confirmation through. A rejection is not held. It fires after draft_decisions_guard (021; name order), which
--    reads the draft under the caller's own scope: a decision about a draft outside that scope never reaches the mapping read.
```

(b) Sau dòng `REVOKE ALL ON FUNCTION intelligence.project_domain_mappings_draft_lock() FROM PUBLIC;` chèn đúng (khối bắt đầu bằng một dòng trống):

```sql

CREATE OR REPLACE FUNCTION intelligence.draft_decisions_pointer_only_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp SET row_security = off SET lock_timeout = '5s' AS $$
DECLARE latest text;
BEGIN
  -- A rejection confirms nothing and is never held.
  IF NEW.result IS DISTINCT FROM 'confirmed' THEN
    RETURN NEW;
  END IF;
  -- As in ai_drafts_pointer_only_guard: only READ COMMITTED gives the read below a snapshot taken after the lock.
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'A draft is confirmed in a READ COMMITTED transaction' USING ERRCODE = 'LTZ02';
  END IF;
  -- A row without a tenant or a project is answered by the table (23502).
  IF NEW.tenant_id IS NOT NULL AND NEW.project_id IS NOT NULL THEN
    -- Held to the end of the transaction that confirms: a mapping insert of this project waits for it, and it waits for a mapping insert or a draft
    -- insert of this project in flight. The wait is capped by the lock_timeout of this function: past it the insert fails with 55P03 and nothing of
    -- the confirmation is written.
    PERFORM 1 FROM public.projects p WHERE p.id = NEW.project_id AND p.tenant_id = NEW.tenant_id FOR NO KEY UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'insert or update on table "%" violates foreign key constraint "draft_decisions_project_id_tenant_id_fkey"', TG_TABLE_NAME
        USING ERRCODE = '23503', SCHEMA = TG_TABLE_SCHEMA, TABLE = TG_TABLE_NAME, CONSTRAINT = 'draft_decisions_project_id_tenant_id_fkey',
        HINT = 'Raised by the trigger draft_decisions_pointer_only_guard (migration 022): no project row of this tenant is visible to this statement.';
    END IF;
  END IF;
  SELECT m.domain_code INTO latest FROM public.project_domain_mappings m
   WHERE m.tenant_id = NEW.tenant_id AND m.project_id = NEW.project_id
   ORDER BY m.mapping_version DESC LIMIT 1;
  IF latest = 'IBS_HI' THEN
    RAISE EXCEPTION 'A draft of a pointer-only project is not confirmed' USING ERRCODE = 'LTZ01';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION intelligence.draft_decisions_pointer_only_guard() FROM PUBLIC;
```

(c) Sau câu lệnh `CREATE TRIGGER project_domain_mappings_draft_lock …` chèn đúng:

```sql
DROP TRIGGER IF EXISTS draft_decisions_pointer_only_guard ON public.draft_decisions;
CREATE TRIGGER draft_decisions_pointer_only_guard BEFORE INSERT ON public.draft_decisions
  FOR EACH ROW EXECUTE FUNCTION intelligence.draft_decisions_pointer_only_guard();
```

**Tệp lùi.** Trong khối `DO`, sau khối `IF` của `public.project_domain_mappings`, thêm cùng hình dạng cho bảng quyết định:

```sql
  IF pg_catalog.to_regclass('public.draft_decisions') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS draft_decisions_pointer_only_guard ON public.draft_decisions';
  END IF;
```

và thêm `'intelligence.draft_decisions_pointer_only_guard()'` làm phần tử thứ tư của mảng trong vòng `FOREACH`. Hai chỗ chú thích của tệp lùi đổi theo brief: tệp gỡ được thân có một trigger và một hàm, thân có ba dùng khoá tư vấn, và thân có ba dùng khoá dòng; và việc gỡ guard mở lại cả việc xác nhận một nháp mà dự án đã thành `IBS_HI` sau phép kiểm của dịch vụ.

**Dịch vụ** — `src/server/suggestions.ts`, chỉ lệnh chèn dòng quyết định trong `decide`; chữ của câu lệnh và tham số không đổi:

```ts
    let row:{id:string}|undefined;
    try {
     row=(await tx.query<{id:string}>(`INSERT INTO draft_decisions(…same text…) … RETURNING id`,[…same parameters…])).rows[0];
    } catch(e) {
     // migration 022 refuses a confirmation whose project became pointer-only after the check above (a mapping committed in between): the same hold
     if(input.result==='confirmed'&&(e as {code?:string}|null)?.code===POINTER_ONLY_SQLSTATE)
      throw new AppError('DRAFT_HELD','Nháp được giữ lại, chưa xác nhận được: POINTER_ONLY_PROJECT.',422);
     throw e;
    }
    if(!row) throw alreadyDecided();
```

Không gì khác trong `decide`, `present`, `list`, `submitDraft` đổi. Chú thích thứ tự ở đầu `decide`, bước (7), thêm: «the decision row (a confirmation is refused there by migration 022 if the project became pointer-only meanwhile: DRAFT_HELD)».

`prosecdef`, `proconfig`, `provolatile` của hàm mới, dùng ở G12 và G20 (nối vào bảng ở `:1557`):

| Hàm | `prosecdef` | `proconfig`, đúng thứ tự | `provolatile` |
|---|---|---|---|
| `intelligence.draft_decisions_pointer_only_guard` | `true` | `['search_path=pg_catalog, pg_temp','row_security=off','lock_timeout=5s']` | `'v'` |

**Ca kiểm viết trước, rồi mới tới mã.** Đỏ trên mã cũ phải là `AssertionError` (hoặc câu trả lời cũ hiện trong khẳng định), không phải timeout hay thiếu helper. Chữ chính xác của từng ca nằm ở brief.

| Ca (mã của brief) | Tệp · làn | Khẳng định |
|---|---|---|
| G12, G20 — chỗ ghim | `tests/z4-pointer-guard.test.ts` · PGlite | Trigger của 022 nay là bốn, trên ba bảng; hàm là bốn. Hàm mới: bảng ở trên, chủ hàm là superuser hoặc có `BYPASSRLS`, không gọi được bởi `PUBLIC` hay `libetech_ai`, cả thân bằng tệp, thân có đủ câu `PERFORM … FOR NO KEY UPDATE;` và không có `pg_advisory`. Các trigger `BEFORE INSERT` mức dòng của `public.draft_decisions`, theo tên, bằng đúng `['draft_decisions_guard','draft_decisions_pointer_only_guard']`. Tên ca nào còn nói «three» được sửa |
| F5-P1 | cùng tệp · PGlite | Một dòng quyết định `confirmed` của dự án đang là `IBS_HI` bị từ chối `LTZ01` lúc ghi, không dòng nào được lưu; một dòng `rejected` có lý do thì được lưu |
| F5-P2 | cùng tệp · PGlite | Guard chỉ ràng lệnh xác nhận của giao dịch READ COMMITTED: `confirmed` ở REPEATABLE READ → `LTZ02`; `rejected` ở REPEATABLE READ → được lưu. Một dòng `confirmed` có cặp (tenant, dự án) không tồn tại bị từ chối — ghim đúng mã nhận được và trigger nào trả lời (hàm của 021 chạy trước và có thể trả lời trước) |
| F5-P3 | cùng tệp · PGlite | Một quyết định về nháp ngoài phạm vi của người gọi do `draft_decisions_guard` trả lời, dù dự án mang nhãn gì: hai câu từ chối — dự án chưa ánh xạ, dự án `IBS_HI` — bằng nhau ở mọi trường, không cái nào là `LTZ01` |
| F5-P4 | cùng tệp · native | Lệnh chèn quyết định `confirmed` chờ một ánh xạ `IBS_HI` chưa commit của dự án, rồi bị từ chối `LTZ01`; khi ánh xạ bị lùi thì được lưu |
| F5-P5 | cùng tệp · native | Lệnh ghi ánh xạ chờ một lệnh xác nhận còn mở của dự án: quyết định được lưu trước |
| F5-X1 | `tests/suggestions.test.ts` · PGlite | Dựng lại hệ quả của cuộc đua trên một kết nối — ngữ cảnh dịch vụ dựng cho lời gọi đó nói `pointerOnly:false` trong khi CSDL đã có ánh xạ `IBS_HI`: lệnh xác nhận trả `DRAFT_HELD` với danh sách mã bằng đúng `POINTER_ONLY_PROJECT`; không quyết định, không bản tài liệu mới, số dòng khoá lệnh không đổi; cùng khoá đó rồi dùng được cho một lệnh từ chối. Đỏ trên mã cũ: lệnh xác nhận thành công |
| Y3 | `tests/suggestions-concurrency.test.ts` · native | Qua dịch vụ: `decide` chờ ở lệnh chèn quyết định sau một ánh xạ `IBS_HI` chưa commit; ánh xạ commit → `DRAFT_HELD` với đúng `POINTER_ONLY_PROJECT`; không gì được ghi, khoá lệnh còn tự do |
| Y4 | cùng tệp · native | Lệnh xác nhận chờ quá trần thất bại bằng lỗi CSDL `55P03` và không ghi gì; cùng lệnh thành công khi dòng dự án được nhả |
| RB1, RB2, RB3 | `tests/migrations-rollback.test.ts` | Tệp lùi gỡ bốn hàm và trigger của `public.draft_decisions`; áp lại thì có lại; sau khi lùi, bảng quyết định chỉ còn các trigger của 021 |

Ca «whatever masks a draft at read time holds it at confirmation» và mọi ca có sẵn khác giữ nguyên. Một ca ngoài brief đỏ: dừng và báo, không sửa ca. Chỉ chạy được trên PostgreSQL 16, do phiên chính chạy: F5-P4, F5-P5, Y3, Y4. Lệnh chạy, quy tắc và mẫu báo cáo: theo brief.

**Điểm commit** (phiên chính; chữ đề xuất): `fix(db): a confirmation is refused when its project became pointer-only after the service's check (class sweep before the last gate round: F1)`. **[Bản 0.9: chữ «the last gate round» là sai — vòng 2 không phải lượt cuối (09.3). Commit `05a6da0` và commit `12570c4` đã mang chữ đó trong câu commit; lịch sử git không được viết lại, đính chính nằm ở đây.]**

### 08.5 · Phần dư và điều kiện của bản 0.8

- **R3 (bản 0.8; viết lại đúng cỡ theo quét-S1; thay R3 ở `:221`).** Dưới **mọi** lớp che khác `CONFIRM_AUTHORITY_REQUIRED`, người có quyền quyết định vẫn nhận `valueHash` — SHA-256 của dạng chuẩn hoá của `value` — vì lệnh quyết định đòi người gọi gửi lại hash mình đã thấy. Với một nháp gần như không có chữ tự do, hash đó đủ để **dựng lại đúng `value` ngoại tuyến**: với `intake_analyst` có `claims`, `questions`, `conflicts`, `missingFields` rỗng, không gian thử là `classification` (ba giá trị và rỗng) × `duplicateOf` (một mã tin của luồng, thứ người đó thấy qua hộp tin) × `confidence` (101 giá trị) × một tập con nhỏ các mã nguồn; `manifestHash` và `skill` là hằng đã biết. Thứ thu được là **phân loại của AI về một tin mà chữ đang bị ẩn**. `decide` với một `valueHash` thử — có trả `REVISION_CONFLICT` hay không — là một phép so bằng thứ hai, **trực tuyến**. Với nháp có chữ tự do thật thì không khả thi; với dòng chèn thô, hash là 32 byte tuỳ ý. Người không có quyền quyết định không nhận hash và không thử được qua `decide`. **Không đóng trong PR này**: đóng là đổi hợp đồng của `decide` từ lát 3. Hai cách reviewer nêu, để lượt sau cân: trả `valueHash` rỗng dưới mọi lớp che và để dịch vụ tự điền hash của dòng (nháp bất biến; `draft_decisions_guard` tự so lại); hoặc trả một thẻ mờ thay cho hash thô. **Bản 0.9 — ĐÃ ĐÓNG bằng Task G1.** «Không đóng trong PR này» hết hiệu lực: cổng Codex vòng 2 nêu mục này ở mức P0. Cách được làm gần với cách thứ nhất reviewer nêu — `valueHash` rỗng dưới mọi lớp che — nhưng dịch vụ không tự điền hash cho mọi người gọi: nó chỉ bỏ phép so cho người mà nháp đang bị che với họ, vẫn đòi hash của người được cho thấy nội dung, và so lại sau bước giữ với lệnh xác nhận (09.4, 09.5).
- **R15 (bản 0.8; đính chính theo quét-S4; sửa câu «thêm đúng một thứ, `valueHash`» ở `:233`).** Với người có quyền quyết định, trên một nháp đang bị che, thứ lọt ra ngoài `valueHash` còn có **các mã của một lần giữ**. Câu `DRAFT_HELD` của lệnh xác nhận nêu toàn bộ tập mã, không chỉ các mã che: `SOURCE_REQUIRED`, `UNSOURCED_CLAIM`, `TOOL_NOT_ALLOWED`, `NOT_APPROVED_REVISION`, `MANIFEST_MISMATCH`, `VALUE_HASH_MISMATCH`, và các mã về mốc — `SUBJECT_CHANGED`, `SUBJECT_BASELINE_MISSING`, với nháp ứng viên thêm `SUBJECT_EDIT_UNVERIFIED`. Đó là một nắm bit cố định về nội dung đang bị che; lệnh bị giữ lùi hết nên gọi lại bao nhiêu lần cũng được. Thêm một kênh thích ứng: người **ghi được tài liệu** đổi được một phần ngữ cảnh — đẩy một tài liệu ra ngoài cửa sổ của ngữ cảnh, hoặc tạo một bản mới — rồi xem `SOURCE_OUT_OF_CONTEXT` hay các mã `SUBJECT_*` đổi, và suy ra nháp bị che nêu mã nào. Không lộ chữ, không lộ mã nào ngoài những gì người đó đã thấy trong dự án. **Không đổi mã**: các mã của một lần giữ là thứ phương án (b) của điểm 2 trả — «chỉ trả mã và lý do giữ». Phần đếm cho người không có quyền quyết định của R15 không đổi. **Bản 0.9 — đóng với các mã tả nội dung (Task G2).** «Không đổi mã» hết hiệu lực: trên một nháp bị che, câu giữ của lệnh xác nhận nay chỉ nêu các mã che, cộng giữ chỗ `SUBJECT_ORDER_UNVERIFIED` với nháp ứng viên; kênh thích ứng của người ghi được tài liệu thu lại còn `SOURCE_OUT_OF_CONTEXT`. Chữ «ngoài `valueHash`» ở câu đầu cũng không còn: sau Task G1 không hash nào tới người đó dưới lớp che. Chữ hiện hành của R15: 09.7.
- **R34 — cái giá thêm của Task F5** (nối tại chỗ ở `:1432`, `:1436`, `:1439`): lệnh xác nhận của một dự án chờ giao dịch chèn nháp hoặc ghi ánh xạ còn mở của dự án đó (`55P03` ở trần, thô từ `decide`); người giữ role AI với một giao dịch chèn nháp để mở hoãn được các lệnh xác nhận của dự án đó; 022 nay có ba hàm `SECURITY DEFINER` và bốn trigger trên ba bảng. **Đính chính sau hai lượt xem lại Task F5 (Q1 của ghế CSDL, S-F5-1 của ghế bảo mật; cả hai P2, chỉ sửa chữ):** từ Task F5, câu «ba login dịch vụ không còn hoãn được» chỉ còn đúng cho `libetech_auth` và `libetech_intake_svc`. **Login web (role runtime) nay giữ được khoá dòng dự án** qua trigger của bảng quyết định: một giao dịch chèn một dòng `confirmed` cho một nháp có thật, có nguồn — kể cả khi lệnh chèn đó sau cùng thất bại — giữ khoá tới khi giao dịch kết thúc. Trong một phiên SQL thô dưới login đó, phạm vi là thứ phiên tự đặt, nên với tới dự án của mọi tenant có một nháp như vậy. Chừng nào giao dịch còn mở: lệnh ghi ánh xạ, lệnh chèn nháp và lệnh xác nhận khác của dự án đó nhận `55P03` sau 5 giây; `UPDATE` hay `DELETE` dòng dự án chờ không trần; và kênh thời gian của S-6 mở cho role runtime. Không tự lấy được bằng một câu `SELECT … FOR …` (vẫn `42501`); dịch vụ chỉ giữ khoá trong đúng một giao dịch xác nhận ngắn. Hôm nay không khai thác được: Z4 tắt, không có nháp nào. Đóng bằng điều kiện 18 (login web có `idle_in_transaction_session_timeout`), không bằng mã. Thêm (Q5 của ghế CSDL, P3): `decide` giữ khoá dòng dự án trong lúc dựng câu trả lời (`present`, gồm phép quét chữ theo dự án chưa đo — điều kiện 19); thời gian đó ăn vào trần 5 giây của lệnh chèn nháp và lệnh ghi ánh xạ đang chờ cùng dự án. Một dòng quyết định ghi ngoài khoá tư vấn của nháp (chỉ login vận hành làm được) nhận `DRAFT_HELD` thay cho `DRAFT_ALREADY_DECIDED`, vì trigger chạy trước `ON CONFLICT`.
- **R37 — bốn thân cũ** (nối tại chỗ ở `:1348`): thân không có `LTZ02`; thân có `LTZ02` (bản 0.4); thân dùng khoá tư vấn (`cb1d7dc`); thân dùng khoá dòng với ba hàm (`56d257c`). CSDL nào đã ghi `'022'` với một trong bốn thân đó được lùi bằng tệp lùi hiện hành rồi áp lại.
- **R38 (mới; quét-F3).** `list` đọc ở nhiều thời điểm: các dòng, tổng số, và ngữ cảnh dựng lười theo từng khoá. Một ánh xạ hay một nháp mới commit ở giữa thì một câu trả lời có thể trộn dòng hiện nội dung với dòng bị che, và `total` lệch `items`. Không ghi gì, và không hiện được thứ đã bị che lúc lời gọi bắt đầu: bảng ánh xạ chỉ chèn, dòng mới nhất quyết định, câu lệnh sau chỉ thấy thêm commit.
- **R39 (mới; quét-F6).** Phép kiểm theo dự án của `decide` không đồng bộ với đường nhận tin: một bản tin lưu chữ, của một nhóm mà dịch vụ gợi ý không bật cờ, có thể commit sau phép kiểm và trước lúc lệnh xác nhận commit — khi hai tiến trình đọc cấu hình cờ ở hai lúc khác nhau. Lệnh xác nhận khi đó commit trong lúc dự án có chữ đã lưu mà không được hiện. Chữ đó mới hơn nháp nên không thể nằm trong nháp: sai chữ của giữ chỗ OQ-55, không sai mục đích của nó. `threadHasHiddenText` có cùng khe, hôm nay không tới được vì giữ chỗ của điểm 3 OQ-53. Biến thể do ánh xạ `IBS_HI` gây ra là quét-F1, đã đóng bằng Task F5.
- **quét-F4** (một dòng, nối ở R9, `:227`): danh sách cờ nhóm là ảnh chụp lúc dựng đối tượng dịch vụ; tuyến đầu tiên dựng dịch vụ cho từng yêu cầu bằng danh sách hiện hành.
- **quét-F7** (một dòng, nối ở R2, `:220`): nháp và ánh xạ `IBS_HI` của cùng dự án ghi trong một giao dịch commit cùng lúc; trường hợp của OQ-54. **Thêm (Q3 của lượt xem lại Task F5):** tương tự phía xác nhận — login vận hành ghi một dòng `confirmed` rồi một ánh xạ `IBS_HI` của cùng dự án trong một giao dịch thì cả hai commit cùng lúc; thứ tự ngược lại bị từ chối.
- **quét-S6** (một dòng, nối ở điều kiện 24, `:1449`): lượt quét oracle nêu lại đúng điều kiện đó. **Thêm sau hai lượt xem lại Task F5:** từ Task F5 có một trigger definer nằm trên một bảng mà role runtime ghi (`public.draft_decisions`), và nó khoá trước khi `WITH CHECK` của `runtime_insert` chạy; trigger `draft_decisions_guard` của 021 chạy trước nó và chỉ cho qua dòng về một nháp trong phạm vi của người gọi (ca F5-P3 ghim thứ tự tên). Cùng điều kiện 24: ai đổi tên hoặc gỡ trigger của 021 thì phải soát lại.
- **Điều kiện 18 — thêm** (nối tại chỗ ở `:1445`): tuyến đầu tiên gọi `decide` cũng đổi `55P03` và `40P01` thành một lỗi thử-lại-được của dịch vụ, không kèm `CONTEXT` của CSDL. **Thêm sau hai lượt xem lại Task F5:** trước khi bật Z4, **login web (role runtime) cũng có `idle_in_transaction_session_timeout`**, có ca kiểm — từ Task F5 một giao dịch xác nhận bị để mở giữ khoá dòng dự án (R34). `LTZ02` và `23503` từ `decide` cũng đi thô và thuộc cùng điều kiện đổi lỗi.
- **Điều kiện 25 (mới; quét-S3).** Trước khi bật Z4: mỗi lời gọi mô hình chỉ nhận ngữ cảnh của **đúng một** dự án, dựng bởi dịch vụ; và mỗi nháp được ràng với đúng ngữ cảnh mà dịch vụ đã cấp — ví dụ `submitDraft` chỉ nhận nháp có `inputHash` khớp hash của ngữ cảnh đó. Không phép kiểm phía đọc nào bắt được chữ tự do của dự án khác; đây là chỗ duy nhất đóng được quét-S3.
- **Ghi chú cho lúc gỡ giữ chỗ của điểm 3 OQ-53** (mục 3 của lượt quét chạy đua; bổ sung cho điều kiện 21): khi nháp ứng viên xác nhận được trở lại thì trở lại cùng lúc — khe của R6 và R27; khe của `threadHasHiddenText` nêu ở R39; việc `decide` không khoá dòng ứng viên trong khi hộp tin đổi trạng thái ứng viên dưới khoá dòng (xác nhận nháp và đánh dấu trùng hay đóng ứng viên chạy song song mà không thấy nhau); và ba tính chất E5, E7, E11 cần ca riêng cho nháp ứng viên. Guard của Task F5 thì đã phủ nháp ứng viên.

### 08.6 · Task F4 sau Task F5

- **Số ca mong đợi:** do phiên chính đo sau Task F5; kế hoạch không ước con số nào. Các số đã đo ở `56d257c` (trạng thái lúc ghi, đầu mục này) là trước F1c và F5.
- **Bối cảnh gửi cổng Codex vòng 2** (`:1325-1330`; ý 4 và ý 5 có ghi chú «Bản 0.8» tại chỗ) nêu thêm: tệp 022 được sửa tại chỗ **ba lần** sau vòng 1 — F1, F1b, F5 — và chưa từng được áp ở đâu ngoài CSDL thử của PR; guard phía xác nhận và finding nó đóng; hai lượt quét theo lớp, dòng cuối của từng báo cáo, và điều được làm với từng finding (bảng ở 08.8); R3 và R15 theo chữ đã viết lại; điều kiện 25. **Bản 0.9:** vòng 2 đã chạy với bối cảnh này (`docs/reviews/oq-45-46-evidence-20261118/codex-context-round-2.md`). Với vòng 3, R3 không còn nằm trong các phần dư được gửi — nó đã đóng — và R15 được gửi theo chữ của 09.7. Bối cảnh của vòng 3: 09.8.
- Trước lượt PostgreSQL 16: lùi 022 trên CSDL thử bằng tệp lùi hiện hành rồi để harness áp lại (R37) — CSDL đó đang mang thân có ba hàm.
- Sáu câu catalog chỉ đọc của mục 5 của review CSDL trên F1b đã chạy trên CSDL thử ở thân của `56d257c` (`docs/reviews/oq-45-46-evidence-20261118/deploy-queries-pg16.txt`). Chúng được viết cho **ba** hàm và ba trigger: hàm thứ tư và trigger thứ tư của Task F5 **không** nằm trong các câu đó. **Bản 0.9:** lượt xem lại CSDL của Task F5 viết lại câu A và câu B cho thân có bốn hàm (mục E của `docs/reviews/oq-45-46-evidence-20261118/gates/review-codex-fix1-F5-database.md`); hai câu đó **chưa chạy**.

### 08.7 · Chữ của các bản trước mà bản 0.8 thay hoặc bổ sung

Đều còn nguyên tại chỗ, có nhãn «Bản 0.8»:

| Chỗ | Thứ đổi | Chữ hiện hành |
|---|---|---|
| R3 (`:221`) | cỡ của phần dư về `valueHash` | 08.5. **Bản 0.9:** R3 đã đóng (09.7) |
| R15 (`:233`) | câu «thêm đúng một thứ, `valueHash`» | 08.5. **Bản 0.9:** R15 đóng với các mã tả nội dung (09.7) |
| R2 (`:220`), R9 (`:227`), điều kiện 24 (`:1449`), R35 (`:1346`) | một dòng cho quét-F7, quét-F4, quét-S6, quét-F6 và quét-S3 | tại dòng đó; R39 và điều kiện 25 ở 08.5 |
| R34 của bản 0.7 (`:1432`, `:1436`, `:1439`) | ai hoãn được gì; số hàm definer và số trigger; DB-8 | tại dòng đó; 08.3 |
| R37 (`:1348`) | «hai thân cũ» thành bốn | 08.5 |
| Điều kiện 18 của bản 0.7 (`:1445`) | thêm tuyến gọi `decide` | tại dòng đó |
| Task F1b ở 07.5: chú thích đầu tệp (`:1460`) và bảng `proconfig` (`:1557`) | ba chỗ của chú thích đổi, thêm mục 4; thêm hàm thứ tư | 08.4 |
| DB-8 ở 07.8 (`:1635`) và 07.9 (`:1667`) | hàm definer thứ ba cũng nằm trong schema `intelligence` | tại dòng đó |
| Task F4 (`:1329`, `:1330`) và 07.7 (`:1624`) | «sửa tại chỗ hai lần» thành ba; các ý thêm của bối cảnh vòng 2 | 08.6 |
| R5 (`:223`) | câu «cổng xác nhận xử lý» không còn dựa vào một cổng không có khoá | 08.3 |

### 08.8 · Tự soát của planner cho bản 0.8

Từng finding của hai lượt quét — áp ở đâu, hoặc vì sao không:

| Finding | Mức | Áp ở đâu |
|---|---|---|
| quét-F1 | P1 | **Task F5** (08.3, 08.4): trigger thứ tư của 022 trên `public.draft_decisions`; `decide` đổi `LTZ01` thành `DRAFT_HELD` |
| quét-F2 | P2 | Đóng bằng cùng khoá của Task F5 (08.3); không đổi cách `decide` truyền ngữ cảnh cho `present` |
| quét-F3 | P3 | Phần dư mới R38 (08.5); không đổi mã |
| quét-F4 | P3 | Một dòng ở R9 (`:227`); tuyến đầu tiên dựng dịch vụ cho từng yêu cầu (đã là điều kiện 4) |
| quét-F5 | P3 | Đã ghi từ trước: R7; ngoài PR |
| quét-F6 | P3 | Phần dư mới R39 (08.5); một dòng ở R35 (`:1346`); không đổi mã |
| quét-F7 | P3 | Một dòng ở R2 (`:220`); trường hợp của OQ-54; không đổi mã |
| quét-S1 | P2 | **Ở lại là phần dư**: R3 viết lại đúng cỡ (08.5); lý do ở 08.2 mục 2. **Bản 0.9:** cổng Codex vòng 2 nêu đúng mục này ở mức P0; **đóng bằng Task G1**; phán quyết 2 của bản 0.8 sai với cổng này (09.2) |
| quét-S2 | P2 | Phần dư đã viết: R33, R34 và các điều kiện 18, 22; đóng ở thiết kế login AI, không sửa được trong 022 |
| quét-S3 | P2 | **Ở lại là phần dư** (R35); điều kiện mới 25 (08.5) |
| quét-S4 | P3 | Không đổi mã; R15 đính chính (08.5); lý do ở 08.2 mục 4. **Bản 0.9:** được thay — mã đổi ở Task G2 (09.6b) |
| quét-S5 | P3 | Đóng bằng cùng khoá của Task F5 (08.3) |
| quét-S6 | P3 | Đã là điều kiện 24; một dòng tại đó (`:1449`) |

Điều khác đã soát:

- Lời Chairman: không câu nào được chép lại, sửa hay dời ở bản 0.8; số lần xuất hiện của từng câu trong tệp bằng đúng bản 0.7 (so bằng máy). Chữ «chỉ trả mã và lý do giữ» ở 08.2 và 08.5 là chữ của phương án (b) của điểm 2 OQ-45 (`docs/OPEN-QUESTIONS.md:668`), có ở đó nguyên văn; nó không phải lời Chairman.
- Không dòng nào trước mục này bị chèn hay xoá; các dòng đổi tại chỗ là đúng các dòng liệt kê ở dòng phiên bản (`:5`).
- `docs/OPEN-QUESTIONS.md` không đổi ở bản 0.8: không câu nào ở đó nói về guard phía xác nhận hay về số trigger của 022.
- Năm khối mã ở 08.4 được chép bằng máy từ brief của Task F5 và so lại bằng máy sau khi ghi.
- Không đường dẫn máy, không bí mật trong mục này.
- Chưa làm, và không phải việc của planner: mã và log của Task F5; lượt PostgreSQL 16; review của F5; số ca của F4; cổng Codex vòng 2.

## Vòng 2 của cổng Codex và vòng sửa 2 (bản 0.9)

Do agent `planner` ghi ngày 18/11/2026 (mô hình Fable 5.2, không lùi mô hình), theo phán quyết của phiên chính — **không phải lời hay quyết định của Chairman**; không điều gì ở đây chọn một phương án của một câu hỏi mở. Lời Chairman không được chép lại ở mục này và không bị đổi ở đâu trong tệp. Mục này là hồ sơ; mã của nó do Task G1 và Task G2 làm theo hai brief `.superpowers/sdd/oq-45-46-ai-drafts/task-G1-brief.md` và `.superpowers/sdd/oq-45-46-ai-drafts/task-G2-brief.md`. Ở bản 0.9 không dòng nào trước mục này bị chèn hay xoá: chữ bị thay hoặc được bổ sung mang nhãn «Bản 0.9» tại chỗ (danh sách ở 09.8).

**Trạng thái lúc ghi** (theo sổ của phiên chính và các log trong `docs/reviews/oq-45-46-evidence-20261118/`).

- Task F5, `05a6da0`: log đỏ trên PGlite có 7 ca đỏ trong 3 tệp, 7 dòng `AssertionError`, không dòng `timed out` (`codex-fix1-F5-red.txt`); PGlite 7 tệp đạt, 1 bỏ qua, 213 ca đạt, 23 bỏ qua (`codex-fix1-F5-green.txt`); PostgreSQL 16 cùng 8 tệp đó đạt, 236 ca đạt, 0 bỏ qua, không timeout, không `40P01` (`codex-fix1-F5-native-verbose.txt`).
- Một ca hiện có đổi ở Task F5 theo phán quyết của phiên chính: ca «running 021 again changes nothing» của `tests/z4-schema.test.ts` thêm tên trigger mới vào danh sách loại trừ của câu đếm — trigger đó là của 022, không phải của 021. Đây là đổi hạ tầng, cùng kiểu với I-1 của X5.
- Kế hoạch 0.8: `01d1e91`. Hai lượt xem lại mã của Task F5: `d41cb4a` — CSDL `gates/review-codex-fix1-F5-database.md` («READY FOR GATE»; một P2, Q1; bốn P3, Q2…Q5) và bảo mật `gates/review-codex-fix1-F5-security.md` («READY FOR GATE»; một P2, S-F5-1; một P3, S-F5-2). Hồ sơ của vòng 2: `ff8164c`.
- Cả bộ ở `05a6da0`, trước Task G1: typecheck mã thoát 0; PGlite 66 tệp đạt, 12 bỏ qua, 1 212 ca đạt, 79 bỏ qua (tổng 1 291); PostgreSQL 16 78 tệp đạt, 1 291 ca đạt, 0 bỏ qua; build mã thoát 0 (`head-05a6da0-typecheck.txt`, `head-05a6da0-coverage.txt`, `head-05a6da0-native-verbose.txt`, `head-05a6da0-build.txt`; commit `a0f489e`).
- Task G1 được commit trong lúc mục này được ghi: `ff24901`. Phần 09.4 tới 09.6 được viết từ brief và từ `src/server/suggestions.ts` ở `ff8164c`, trước commit đó; sau commit, planner đối chiếu với mã đã commit và với báo cáo của builder, và ghi các điểm «như đã làm» ở cuối 09.6. Planner không chạy gì và không sửa tệp nào của task đó.
- Lượt xem lại bảo mật của Task G1: `gates/review-codex-fix2-G1-security.md`. Task G2 được commit trong lúc mục này được ghi: `d9b0974`. Tên của ca V2 được sửa thêm ở `9b0f83f`, commit cũng đưa hai lượt xem lại của vòng sửa 2 vào repo; lượt xem lại bảo mật của Task G2 là `gates/review-codex-fix2-G2-security.md`. Phần 09.6b được viết từ brief và từ báo cáo của builder, trước commit; các điểm «như đã làm» nằm ở cuối 09.6b.

### 09.1 · Kết quả vòng 2 của cổng Codex

- Tệp kết quả: `docs/reviews/oq-45-46-evidence-20261118/codex-round-2.md`; bối cảnh đã gửi: `docs/reviews/oq-45-46-evidence-20261118/codex-context-round-2.md`. Gốc `4f12a3c`, đầu `d41cb4a` (mã đổi lần cuối ở `05a6da0`).
- Dòng đầu, chép nguyên: `VERDICT: CHANGES_REQUIRED`. **Một finding, [P0]**, ở `src/server/suggestions.ts:106`. Chữ của finding, chép nguyên từ tệp kết quả: «Nháp đã bị che vẫn trả `valueHash`, cho phép suy ra nội dung có ít khả năng; phép so hash ở dòng 278 còn tạo một kênh thử trực tuyến.»
- Kịch bản cổng nêu, chép nguyên: «quản lý dự án không còn được đọc chữ của tin nguồn → `list` che `value` nhưng trả SHA-256 của nó → người đọc thử các giá trị phân loại và độ tin khả dĩ để dựng lại nội dung nháp. Kế hoạch R3 cũng ghi nhận khả năng này.»
- Căn cứ cổng nêu, chép nguyên: «OQ-45 điểm 2(b), `docs/OPEN-QUESTIONS.md:668` — khi che nội dung, chỉ trả mã và lý do giữ.»
- Bốn finding của vòng 1 và các thay đổi của vòng sửa 1 — CX1…CX4, khoá dòng, guard phía xác nhận — không bị nêu lại.

### 09.2 · Vì sao R3 chưa được đóng trước vòng 2, và vì sao phán quyết đó sai với cổng này

- Finding của vòng 2 **chính là R3**. Phần dư này có trong kế hoạch từ bản đầu (`:221`). Lượt quét oracle nêu lại nó là quét-S1, và reviewer của lượt đó ghi rằng một cổng không nhận «phần dư đã ghi» có thể xếp nó P1 (`:1718`).
- Phán quyết 2 của bản 0.8 (`:1728`) giữ nó làm phần dư, viết lại cho đúng cỡ, với hai lý do được ghi: R3 có trong bối cảnh gửi cổng vòng 1 mà cổng không nêu; và đóng nó là đổi hợp đồng của `decide` từ lát 3.
- **Phán quyết đó sai với cổng này.** Cổng không nhận lý do nào trong hai lý do: vòng 2 nêu đúng R3, ở mức P0, và dẫn chính kế hoạch để nói rằng khả năng đó đã được biết. Vòng 1 đã cho thấy cùng điều đó: CX1, CX2 và CX4 đều nằm trên các phần dư đã viết (R4, R16, R5).
- Bài học ghi lại: với cổng này, một phần dư thuộc lớp «nội dung bị che vẫn lọt ra» không được để lại chỉ vì đã được viết ra.

### 09.3 · Đính chính về số vòng sửa

- Chữ của brief, từ phiên đã khởi động phiên chính: «Tối đa hai vòng sửa ở cổng».
- Đã dùng **một** vòng sửa sau vòng 1 (Task F1, F2, F3, F1b, F1c, F5). **Còn được một** vòng sửa nữa — vòng sửa 2, gồm Task G1 và Task G2 — rồi **một lượt chạy cuối** của cổng: vòng 3.
- Vòng 3 là lượt chạy cuối: nếu nó còn một P0 hoặc P1 thì công việc dừng và được báo là chưa hội tụ.
- Mọi chỗ gọi vòng 2 là «vòng cuối», hoặc nói cổng chỉ còn một lượt, là sai. Trong kế hoạch đó là ba chỗ, nay mang nhãn tại chỗ: ghi chú «Bản 0.8» của dòng phiên bản (`:5`), câu mở của 08.1 (`:1706`), và chữ «the last gate round» trong câu commit đề xuất của Task F5 (`:1863`). Câu «Trần là hai vòng sửa» ở `:853` đúng và giữ nguyên.
- Hai commit đã mang chữ «the last gate round» trong câu commit: `12570c4` và `05a6da0`. Lịch sử git không được viết lại; đính chính nằm ở mục này, ở biên nhận và ở roadmap.

### 09.4 · Phán quyết của phiên chính cho vòng sửa 2

1. Dưới **mọi** lớp che, dòng trả ra mang `valueHash: null` — không chỉ dưới `CONFIRM_AUTHORITY_REQUIRED` như trước.
2. `decide` **không so hash** cho người gọi mà nháp đang bị che với họ: dù gửi gì — hash đúng, hash sai, không gửi — câu trả lời như nhau. Một lệnh xác nhận nháp đó bị giữ với các mã của nó, như trước. Một lệnh từ chối nháp đó được ghi **không cần hash** — cách hiểu C3 của kế hoạch (một người được từ chối một nháp mà mình không đọc được nội dung), không đổi về thực chất.
3. Với người gọi mà nội dung được hiện: như trước; thiếu hash được trả lời như hash sai, `REVISION_CONFLICT`.
4. Một lệnh xác nhận **không bao giờ đi qua khi thiếu hash đúng**: khi không gì giữ nháp, hash được so lần nữa sau bước giữ. Tới đó với một hash khác chỉ khi lớp che được gỡ trong lúc lệnh chạy.
5. `valueHash` thành trường tuỳ chọn của lệnh; dòng quyết định vẫn được ghi với hash đã lưu của nháp, không bao giờ với hash của người gọi.

Lý do phiên chính ghi: cổng đọc điểm 2 (b) là «chỉ mã và lý do giữ». Cái giá nếu sai: hợp đồng của `decide` từ lát 3 đổi, và mỗi `decide` dựng thêm một lần ngữ cảnh (09.5). Phán quyết về Task G2, cùng vòng sửa này, nằm ở 09.6b.

### 09.5 · Thiết kế của Task G1

- **Hash người gọi gửi là hash họ đã được cho thấy.** Người mà nháp bị che với họ không được cho thấy hash nào; với họ không có gì để so. Vì vậy không câu `REVISION_CONFLICT` nào phân biệt được một lần đoán đúng với một lần đoán sai, và kênh thử trực tuyến mà cổng nêu mất cùng lúc với kênh ngoại tuyến.
- **Dòng nháp bất biến** (migration 021), nên phép so hash không che chắn một nháp «đã đổi»: nó chỉ chứng rằng người gọi đã được cho thấy nội dung. Với người không được cho thấy, không có gì để chứng.
- **«Bị che với người gọi» được tính như một lần đọc tính:** `decide` gọi `present` trên chính dòng nháp, với một bảng ngữ cảnh **mới**. Ngữ cảnh dùng lại cho câu trả lời vẫn là ngữ cảnh mà nhánh xác nhận dựng, hoặc do câu trả lời tự dựng (lệnh từ chối, lần phát lại): hai việc không dùng chung bảng.
- **Thứ tự của `decide` sau G1:** quyền → «đã có quyết định» → hash, chỉ so khi nội dung được hiện cho người gọi → lỗi của lệnh → các mã giữ → với lệnh xác nhận không bị giữ, hash được so lần nữa. Quyền vẫn đứng đầu, nên người không có quyền quyết định vẫn nhận câu trả lời về quyền dù gửi gì.
- **Vì sao có phép so thứ hai.** Một nháp bị che lúc lệnh tới có thể hết bị che khi lệnh chạy tới bước giữ. Không có phép so thứ hai thì lệnh xác nhận đó đi qua mà chưa hề có hash nào được so. Người gọi khi đó nhận `REVISION_CONFLICT` và đọc lại nháp trước.
- **Bất biến «bị che thì bị giữ» là thứ làm cho việc bỏ phép so an toàn:** một nháp bị che với người gọi thì lệnh xác nhận của họ bị giữ, nên không lệnh xác nhận nào thành công mà không qua một phép so hash.
- **Lệnh từ chối một nháp bị che** ghi một quyết định mà người quyết định không đọc được nội dung. Đó là C3, có từ trước; điều mới chỉ là nó không còn cần hash. Dòng quyết định vẫn mang hash đã lưu, và `draft_decisions_guard` của 021 vẫn tự so hash đó với dòng nháp.
- **Phát lại** một quyết định đã ghi dưới lớp che trả quyết định đó, không nội dung, không hash.
- **Cái giá.**
  1. **Hợp đồng của `decide` từ lát 3 đổi:** `valueHash` của lệnh là tuỳ chọn, và một dòng bị che không còn mang hash. Bên gọi nào lấy hash từ một dòng bị che để gửi lại thì nay không có gì để lấy — và không cần. Hôm nay không tuyến nào gọi `decide`.
  2. **Thêm một lần dựng ngữ cảnh cho mỗi `decide`**, cùng các câu đọc đi kèm (phép kiểm theo dự án, và theo luồng với nháp ứng viên). Lần dựng đó chạy trong thân khoá lệnh: khoá nháp, khoá dòng tài liệu (với lệnh xác nhận nháp tài liệu) và khoá lệnh được giữ lâu thêm đúng bằng nó. Nó chạy trước lệnh chèn quyết định, tức trước khi khoá dòng dự án của Task F5 được lấy, nên không kéo dài thời gian giữ khoá đó.
  3. Khoá lệnh vẫn lấy dấu vân tay của **cả** lệnh đã qua lược đồ: cùng một khoá gửi một lần có hash và một lần không có là hai nội dung khác nhau (`IDEMPOTENCY_CONFLICT`).
- **Chưa đo:** thời gian giữ khoá thêm của mục 2. Planner không chạy gì; không migration nào đổi.

### 09.6 · Task G1 — một nháp bị che không trả hash của nội dung, và `decide` không so hash cho nó — **review riêng**, bắt buộc `liberico-security-reviewer`

Nguồn để builder làm là brief `.superpowers/sdd/oq-45-46-ai-drafts/task-G1-brief.md`; phần dưới là bản ghi của kế hoạch. Hai khối mã được chép **bằng máy** từ brief đó, không gõ lại.

**Tệp:** `src/server/suggestions.ts`, `tests/suggestions.test.ts`. `tests/suggestions-concurrency.test.ts` chỉ khi một ca ở đó không gửi hash hoặc lấy hash từ một dòng bị che. Không migration, không tệp `src` nào khác.

**Mã** — `src/server/suggestions.ts`:

- (a) `DraftView`: chú thích của `valueHash` thành «only when the content is returned; null under every mask».
- (b) `toView`, nhánh trả dòng bị che: `valueHash:null`, bỏ điều kiện về `CONFIRM_AUTHORITY_REQUIRED`. Nhánh trả nội dung không đổi.
- (c) `decideSchema`: `valueHash` thành tuỳ chọn (vẫn là 64 ký tự hex khi có mặt); lược đồ vẫn là đối tượng chặt.
- (d) `decide`, trong thân khoá lệnh, giữa phép kiểm «đã có quyết định» và phép kiểm lý do — thay đúng một dòng so hash bằng:

```ts
    // OQ-45 point 2 (b): a person for whom the draft is masked was shown no hash, so none is compared for them — whatever was sent, the answer below
    // is the same, and a guess cannot be told from a miss. The mask is worked out as a read works it out, on a context of its own: the context kept
    // for the answer is still built where it was (a confirmation) or by the answer itself (a rejection, a replay).
    const maskedForCaller=(await this.present(tx,p,projectId,[d],new Map()))[0].maskReasons.length>0;
    if(!maskedForCaller&&input.valueHash!==d.value_hash) throw new AppError('REVISION_CONFLICT','Nháp đã đổi. Đọc bản mới trước khi quyết định.',409);
```

- (d2) Trong nhánh xác nhận, ngay sau dòng ném `DRAFT_HELD` và trước nhánh của nháp tài liệu, thêm:

```ts
     // nothing holds the draft, so its content is shown to this person now: the hash is compared after all. Reached with another hash only when the
     // draft was masked for them as the command arrived and is not any more — its state changed under the command; they read it again first.
     if(input.valueHash!==d.value_hash) throw new AppError('REVISION_CONFLICT','Nháp đã đổi. Đọc bản mới trước khi quyết định.',409);
```

- (e) Chú thích thứ tự ở đầu `decide`, bước (4): hash của người gọi chỉ được so cho người mà nội dung được hiện.

Chữ của câu `REVISION_CONFLICT` giữ đúng như trong tệp. `present` được gọi với dòng đã lưu và một bảng **mới**; không truyền bảng ngữ cảnh của câu trả lời. Nếu `present` không gọi được ở chỗ đó vì một lý do thấy trong mã: dừng và báo, không sửa cấu trúc `present`.

**Ca kiểm viết trước** (`tests/suggestions.test.ts`; nhóm mới đặt sau nhóm của bất biến P3). Đỏ trên mã cũ phải là `AssertionError`. Chữ chính xác của từng ca nằm ở brief.

| Ca | Khẳng định |
|---|---|
| H1 | Dưới mọi lớp che, dòng của người có quyền quyết định không mang hash: đi qua đúng bảy cách dựng của ca P3 — `ENTITY_NOT_FOUND`, `POINTER_ONLY_PROJECT`, `PROJECT_TEXT_HIDDEN`, `SCHEMA_INVALID`, `SOURCE_OUT_OF_CONTEXT`, `TEXT_NOT_VISIBLE`, `THREAD_TEXT_HIDDEN` — mỗi cách: `value`, `questions`, `confidence` rỗng, `sources` là `[]`, **`valueHash` là `null`**, và chuỗi JSON của cả câu trả lời không chứa hash đã lưu của nháp. Danh sách mã đi qua được so với một mảng viết tay |
| H2 | Với người mà nháp bị che, `decide` trả lời như nhau dù gửi hash đúng, hash sai hay không gửi: một nháp tài liệu và một nháp ứng viên bị che; ba lệnh xác nhận mỗi nháp, mỗi lệnh một khoá; ba câu từ chối bằng nhau ở `code`, `status`, `message` (`DRAFT_HELD`, 422, cùng danh sách mã); không câu nào là `REVISION_CONFLICT`; không quyết định nào được ghi |
| H3 | Một nháp bị che được từ chối khi không gửi hash, và khi gửi hash sai; câu trả lời mang quyết định đã ghi và không nội dung, không hash; mỗi nháp một dòng quyết định, và `draft_value_hash` của dòng đó bằng hash đã lưu của nháp |
| H4 | Với người mà nội dung được hiện, hash vẫn bắt buộc: không gửi hoặc gửi sai → `REVISION_CONFLICT` 409, cho lệnh từ chối của cả hai loại nháp và cho lệnh xác nhận nháp tài liệu có bản đề xuất hợp lệ; gửi đúng → ghi được |
| H5 | Người không có quyền quyết định nhận câu trả lời về quyền dù gửi hash đúng, hash sai hay không gửi (`MANAGER_REQUIRED` với nháp ứng viên, `READ_ONLY` với nháp tài liệu); ca L8 không đổi. Nửa nháp tài liệu không viết được: xem «Như đã làm» |
| H6 | Một quyết định đã ghi được phát lại dưới lớp che mà không mang hash: từ chối khi nội dung còn hiện, rồi gửi lại cùng lệnh cùng khoá khi đã bị che → quyết định đã ghi, `value` và `valueHash` rỗng |
| H7 | Lệnh xác nhận không bao giờ đi qua khi thiếu hash đúng, kể cả khi lớp che được gỡ trong lúc lệnh chạy: ngữ cảnh **đầu tiên** dịch vụ dựng trong lời gọi đó che nháp, các lần dựng sau là thật; không gửi hash → `REVISION_CONFLICT`, không quyết định, không bản tài liệu mới; gửi hash đã lưu → `confirmed`. Nếu bản giả của bộ dựng ngữ cảnh không lái được theo từng lần dựng mà không chạm ca khác: nêu cách nó được dựng và bỏ H7 |

**Ca hiện có.** Ca nào khẳng định một `valueHash` khác rỗng trên một dòng **bị che** của người có quyền quyết định, hoặc lấy hash cho một lệnh từ một dòng bị che, thì đổi theo luật mới — builder liệt kê từng ca trong báo cáo, kèm tên, điều nó từng khẳng định và điều nó khẳng định nay. Đây là «đổi kỳ vọng vì cổng Codex vòng 2». Ca nào gửi hash đã lưu (giữ từ `submitDraft` hoặc từ một dòng không bị che) để quyết định một nháp đang bị che với người gọi thì vẫn chạy như cũ — hash bị bỏ qua: không sửa. Một ca đỏ vì lý do khác: dừng và báo. Danh sách các ca đã đổi nằm ở «Như đã làm» bên dưới, theo báo cáo của builder.

Lệnh chạy, quy tắc và mẫu báo cáo: theo brief. **Điểm commit** (phiên chính; chữ đề xuất): `fix(suggestions): a masked draft gives no value hash, and decide compares none for it (Codex gate round 2)`.

**Như đã làm** (`ff24901`; theo commit đó, theo báo cáo của builder `.superpowers/sdd/oq-45-46-ai-drafts/task-G1-report.md` và theo ba log `codex-fix2-G1-*.txt` trong thư mục bằng chứng; planner đối chiếu sau commit):

- **Mã:** đúng brief, từ (a) tới (e); hai khối ở trên có nguyên văn trong tệp đã commit (so bằng máy). Câu commit là câu đề xuất, với `decide()` thay cho `decide`.
- **Bảy ca H1–H7 đều được viết**, kể cả H7: lần dựng ngữ cảnh đầu tiên của lời gọi được lái bằng một bản giả dùng một lần, và một khối `finally` trả bộ dựng thật về, để một lần lái chưa dùng không rò sang ca sau.
- **H5 chỉ có nửa nháp ứng viên — brief và mã lệch nhau ở đây.** Qua `decide` không tới được `READ_ONLY`: `mayDecide` của nháp tài liệu là quyền ghi sổ tài liệu, mà mọi vai đọc đều có quyền đó (đúng như `:165`); `viewer` và `bot` bị trả lời bằng câu từ chối phạm vi trước phép xét quyền. H5 đi qua hai người đọc không có quyền với nháp ứng viên (vai `engineer` và `technical`): cả hai nhận `MANAGER_REQUIRED` với cả ba dạng hash, cho lệnh xác nhận lẫn lệnh từ chối. Hệ quả cho hồ sơ: chữ «`READ_ONLY` (nháp tài liệu)» ở B2 (`:167`), ở Task 3 (`:493`) và ở dòng H5 của bảng trên tả một nhánh có trong mã mà hôm nay không vai nào tới được.
- **Ba ca hiện có đổi:**
  1. M1 — dòng bị che từng khẳng định `valueHash` bằng hash của nội dung; nay khẳng định `null`. Đổi kỳ vọng vì cổng Codex vòng 2.
  2. F5-X1 — bản ngữ cảnh ép sẵn nay được trao cho **hai** lần dựng (phép tính lớp che và bước giữ). Với một lần, ca vẫn xanh nhưng sai lý do: bước giữ nhận ngữ cảnh thật, dịch vụ tự giữ nháp, và trigger của bảng quyết định không được chạm tới. Các khẳng định của ca không đổi.
  3. «the context is built under the confirming person, not a wider principal» — từng khẳng định một lần dựng ngữ cảnh cho một lệnh xác nhận; nay khẳng định hai lần, mỗi lần dưới đúng người đó và đúng đầu vào đó. Đổi theo phán quyết của phiên chính, sau khi builder dừng ở ca này.
- **Log:** đỏ trên mã cũ 7 dòng `AssertionError`, không dòng `timed out` (1 tệp; 7 ca đỏ, 101 đạt, 1 bỏ qua — `codex-fix2-G1-red.txt`); PGlite 4 tệp đạt, 196 ca đạt, 1 bỏ qua, typecheck mã thoát 0 (`codex-fix2-G1-green.txt`); PostgreSQL 16 5 tệp đạt, 206 ca đạt, 0 bỏ qua (`codex-fix2-G1-native-verbose.txt`).
- **Một sự cố quy trình, theo báo cáo của builder:** lần chạy đỏ đầu tiên được khởi động từ một thư mục phía trên worktree, vì một lỗi đường dẫn trong script bọc. Lần đó không để lại log, và builder không xác định được nó đã chạy tới đâu. Mọi log của task là từ script đã sửa. Planner không kiểm được gì thêm về lần chạy đó.

### 09.6b · Lượt xem lại bảo mật của Task G1, và Task G2 — trên một nháp bị che, câu giữ của lệnh xác nhận chỉ nêu thứ một lần đọc nêu

**Lượt xem lại Task G1.** `docs/reviews/oq-45-46-evidence-20261118/gates/review-codex-fix2-G1-security.md`, do reviewer của lượt quét oracle làm, chỉ đọc, trên diff `05a6da0..ff24901`. Dòng cuối: `VERDICT: READY FOR GATE`. Finding của cổng vòng 2 được xác nhận là đã đóng:

- **ngoại tuyến:** mọi nhánh có lớp che của `toView` trả `valueHash` rỗng, và `toView` là nơi duy nhất dựng `DraftView` — `list`, câu trả lời của `decide` và lần phát lại đều không còn hash dưới lớp che;
- **trực tuyến:** với người mà nháp bị che, phép so hash không chạy; khoá lệnh chỉ so lần gửi này với lần gửi trước của chính người đó; `draft_decisions_guard` chỉ nhận hash đã lưu do dịch vụ điền.

P0 0, P1 0, P2 1, P3 4:

| Finding | Mức | Nội dung |
|---|---|---|
| P2-1 | P2 | Chính là R15: câu `DRAFT_HELD` của lệnh xác nhận trên một nháp bị che nêu **mọi** mã của cổng. Reviewer ghi đó là «khoảng tám bit cố định về nội dung bị che», gọi lại được tuỳ ý vì lệnh bị giữ lùi hết, và là mục duy nhất có thể bị đẩy lên P1 |
| P3-1 | P3 | Người ghi được tài liệu làm đổi được trạng thái của dự án rồi xem `SOURCE_OUT_OF_CONTEXT` trong `maskReasons`, hoặc các mã `SUBJECT_*` trong câu giữ, đổi theo — và biết nháp bị che nêu mã nào. Chỉ lộ mã, không lộ chữ |
| P3-2 | P3 | Một lệnh từ chối tới khi nháp đang bị che, rồi lớp che được gỡ trong lúc lệnh chạy: lệnh vẫn được ghi không cần hash, cho một nháp mà lúc ghi người đó đã được xem |
| P3-3 | P3 | H7 chỉ thử «lớp che gỡ ra, không gửi hash»; chưa có nhánh «lớp che gỡ ra, gửi hash sai» |
| P3-4 | P3 | Người được cho thấy nội dung mà không gửi hash nhận câu «Nháp đã đổi. Đọc bản mới trước khi quyết định.» — gây hiểu lầm, vì một nháp không bao giờ đổi. Mã và trạng thái của câu trả lời thì đúng |

**Phán quyết của phiên chính.**

1. **P2-1 được đóng trước lượt chạy cuối của cổng, thành Task G2**, cùng vòng sửa 2. Khi có ít nhất một mã che giữ nháp, câu `DRAFT_HELD` của lệnh xác nhận chỉ nêu các mã che — thứ một lần đọc cho thấy trong `maskReasons` — cộng `SUBJECT_ORDER_UNVERIFIED` với nháp ứng viên. Một lần giữ không có mã che nào nêu mọi mã, như trước. Lý do được ghi: đây là mục còn lại của lớp thứ hai; ba dòng mã; reviewer xếp rủi ro ở cổng là thấp nhưng không bằng không, và lượt chạy kế là lượt cuối. Cái giá nếu sai: người quyết định một nháp bị che thấy ít mã chẩn đoán hơn cho tới khi nội dung được hiện lại; vài ca đổi kỳ vọng.
2. Phán quyết 1 **thay phán quyết 4 của bản 0.8** (`:1730`, «quét-S4: không đổi mã»).
3. **P3-3:** nhánh hash sai được thêm vào H7, trong Task G2.
4. **P3-2:** chấp nhận theo C3; chỉ ghi lại (09.7).
5. **P3-4:** chỉ ghi lại (09.7); mã và trạng thái của câu trả lời đúng.
6. **P3-1** thu hẹp nhờ Task G2: các mã `SUBJECT_*` không còn được nêu trên một nháp bị che. Còn `SOURCE_OUT_OF_CONTEXT`, một mã che, đổi theo việc tài liệu nào nằm trong cửa sổ 50 tài liệu của ngữ cảnh.

**Thiết kế của Task G2.**

- «Mã che» là tám mã của kiểu `MaskReason`. Một hằng mới, `MASK_REASONS`, liệt kê chúng lúc chạy. `CONFIRM_AUTHORITY_REQUIRED` có trong hằng để khớp kiểu; nó không bao giờ nằm trong tập lý do của bước giữ, vì người không có quyền đã bị trả lời ở phép xét quyền.
- Mọi phép kiểm của bước giữ vẫn chạy như trước; chỉ **câu trả lời** nêu ít mã hơn. Lệnh vẫn bị giữ, không gì được ghi, khoá lệnh còn tự do.
- `SUBJECT_ORDER_UNVERIFIED` vẫn được nêu: nó có mặt với mọi nháp ứng viên nên không nói gì về nội dung.
- Một lần giữ không có mã che nào nghĩa là nội dung đang được hiện cho người gọi: mọi mã được nêu, như trước.
- Lần giữ do trigger của bảng quyết định (Task F5) không đổi: nó vốn chỉ nêu `POINTER_ONLY_PROJECT`.
- Cổng xét nháp vẫn có hai bản trong mã (`present` và bước giữ của `decide`). Ca H8 đọc các mã che của dòng từ `list` rồi so với câu giữ, nên ghim rằng hai bản cho cùng tập mã che ở ba cách dựng của nó. Hai tập không luôn bằng nhau: xem P3-1 của lượt xem lại Task G2, ở «Như đã làm».

**Tệp:** `src/server/suggestions.ts`, `tests/suggestions.test.ts`. Không migration, không tệp `src` nào khác.

**Mã** — `src/server/suggestions.ts`; hai khối chép **bằng máy** từ brief `.superpowers/sdd/oq-45-46-ai-drafts/task-G2-brief.md`:

- (a) Cạnh kiểu `MaskReason`, một tập lúc chạy mà các tên trong đó được kiểm theo kiểu:

```ts
const MASK_REASONS:ReadonlySet<string>=new Set(['CONFIRM_AUTHORITY_REQUIRED','ENTITY_NOT_FOUND','POINTER_ONLY_PROJECT','PROJECT_TEXT_HIDDEN','SCHEMA_INVALID','SOURCE_OUT_OF_CONTEXT','TEXT_NOT_VISIBLE','THREAD_TEXT_HIDDEN'] satisfies MaskReason[]);
```

- (b) Trong `decide`, nhánh xác nhận, thay dòng ném `DRAFT_HELD` bằng:

```ts
     if(reasons.size) {
      // OQ-45 point 2 (b): when a mask reason holds the draft, its content is not shown to this person, and the hold names what a read names — the
      // mask reasons — and the placeholder of OQ-53 point 3, which says nothing about the content. The other codes of the gate describe the content.
      const masked=[...reasons].some(r=>MASK_REASONS.has(r));
      const named=masked?[...reasons].filter(r=>MASK_REASONS.has(r)||r==='SUBJECT_ORDER_UNVERIFIED'):[...reasons];
      throw new AppError('DRAFT_HELD',`Nháp được giữ lại, chưa xác nhận được: ${named.sort().join(', ')}.`,422);
     }
```

- Chú thích của giữ chỗ OQ-53 điểm 3 đổi một câu: «Every check above still runs and names its code» thành «Every check above still runs; when no mask reason holds the draft each names its code».

**Ca** (theo brief và báo cáo của builder `.superpowers/sdd/oq-45-46-ai-drafts/task-G2-report.md`):

| Ca | Khẳng định |
|---|---|
| H8 (mới, ba phần) | (i) Một nháp tài liệu đã cũ: trên dịch vụ có cờ nó bị giữ chỉ với `SUBJECT_CHANGED` (đối chứng). Xác nhận qua một dịch vụ dựng với danh sách cờ rỗng, khi dự án có chữ đã lưu: câu giữ nêu **đúng** các mã che mà `list` của cùng người trên dịch vụ đó nêu cho dòng — đọc từ `list`, không viết tay — và không chứa `SUBJECT_CHANGED`. (ii) Cũng vậy với một nháp ứng viên có luồng đã có tin mới: đúng `maskReasons` của dòng cộng `SUBJECT_ORDER_UNVERIFIED`. (iii) Một dòng tài liệu chèn thô có `manifest_hash` sai và đối tượng không còn: đúng `ENTITY_NOT_FOUND`, không `MANIFEST_MISMATCH`. Đỏ trên mã cũ bằng `AssertionError` |
| H7 thêm một nhánh (P3-3) | Lớp che gỡ trong lúc lệnh chạy và người gọi gửi hash **sai** → `REVISION_CONFLICT` 409; không quyết định, không bản tài liệu mới, không dòng khoá lệnh mới. Nhánh này xanh cả trên mã cũ — phép so sau bước giữ có từ Task G1: là phủ thêm, không phải ca đỏ |

**Ca hiện có đổi** — đều là ca từng khẳng định một mã không phải mã che trên một nháp mà một mã che giữ:

| Ca | Trước | Sau |
|---|---|---|
| V2 «dừng tại OQ-53 (3): every other check still runs and names its code next to the placeholder» | mục 4 đúng bằng `PROJECT_TEXT_HIDDEN`, `SUBJECT_BASELINE_MISSING`, `SUBJECT_ORDER_UNVERIFIED`, `THREAD_TEXT_HIDDEN` | tên đổi hai lần (xem «Như đã làm»); mục 4 đúng bằng `PROJECT_TEXT_HIDDEN`, `SUBJECT_ORDER_UNVERIFIED`, `THREAD_TEXT_HIDDEN`. Mục 5 và 6 không đổi |
| T4 «dừng tại OQ-53 (2): a candidate draft that names no message of its own thread is held as SUBJECT_BASELINE_MISSING», nửa sau (nháp nêu tin của một luồng khác) | chứa `SUBJECT_BASELINE_MISSING` và `SOURCE_OUT_OF_CONTEXT` | đúng bằng `SOURCE_OUT_OF_CONTEXT`, `SUBJECT_ORDER_UNVERIFIED`. Nửa đầu (nháp chỉ nêu một tài liệu của dự án; không bị che) không đổi |
| D2 «the newest revision the draft names is the baseline: … a revision of another document is not a baseline», nửa sau | chứa `SUBJECT_BASELINE_MISSING`; không chứa `SUBJECT_CHANGED` | đúng bằng `SOURCE_OUT_OF_CONTEXT`; không chứa `SUBJECT_CHANGED`, không chứa `SUBJECT_BASELINE_MISSING` |
| D5 «an id that is not a lower-case uuid names nothing: the upper-case id of the newest revision is not a baseline» | chứa `SUBJECT_BASELINE_MISSING` | đúng bằng `SOURCE_OUT_OF_CONTEXT`; không chứa `SUBJECT_BASELINE_MISSING` |

- Ba nháp của T4 (nửa sau), D2 (nửa sau) và D5 đều bị che `SOURCE_OUT_OF_CONTEXT` với người quyết định. Qua dịch vụ thật, luật mốc của chúng — tin của luồng khác, bản của tài liệu khác, mã viết hoa đều không phải mốc — vì vậy không còn nhìn thấy được qua một câu giữ. Luật mốc vì vậy được thêm lại cho cả ba ca trên một cách dựng mà không mã che nào giữ nháp: ngữ cảnh được lái để mã mà nháp nêu nằm trong ngữ cảnh, còn phép xét mốc thì tự đọc CSDL. Một helper của tệp test khẳng định ba điều: với ngữ cảnh được lái, `list` không còn mã che nào; lệnh xác nhận bị giữ bởi đúng các mã của luật mốc; và có đúng hai lần dựng ngữ cảnh, tức cả hai đều được lái.
- D2 và D5 không nằm trong danh sách dự kiến của brief (brief chỉ nêu mục 4 của V2). Theo báo cáo của builder: hai ca đó đỏ ở lượt xanh đầu trên mã mới và được đổi theo cùng quy tắc; kỳ vọng mới của chúng chưa được chạy trên mã cũ.

**Cái giá của Task G2.**

1. Người quyết định một nháp bị che thấy ít mã chẩn đoán hơn cho tới khi nội dung được hiện lại. Ví dụ: một nháp vừa đã cũ vừa bị che chỉ báo mã che; chỉ khi lớp che được gỡ, lệnh xác nhận kế tiếp mới báo `SUBJECT_CHANGED`.
2. Trên một nháp bị che, các luật mốc không còn quan sát được từ ngoài (ba ca ở trên); bằng chứng của chúng dời sang một cách dựng không bị che.
3. Thêm một cách hiểu chờ Chairman: câu thứ hai thêm vào C9 (09.7).

**Như đã làm** (`d9b0974` và `9b0f83f`; theo hai commit đó, bốn log `codex-fix2-G2-*.txt` trong thư mục bằng chứng, và lượt xem lại bảo mật của Task G2 `docs/reviews/oq-45-46-evidence-20261118/gates/review-codex-fix2-G2-security.md`; planner đối chiếu sau commit):

- **Mã:** đúng brief; hai khối ở trên có nguyên văn trong tệp ở `d9b0974` (so bằng máy).
- **Log:** lượt đỏ thứ nhất, trên mã cũ: 3 dòng `AssertionError`, không dòng `timed out` — H8, V2, T4 (`codex-fix2-G2-red.txt`). Lượt đỏ thứ hai cho thấy ba khẳng định về luật mốc vừa thêm lại đỏ được: 3 dòng `AssertionError` — D2, D5, T4 (`codex-fix2-G2-red-2.txt`). PGlite 4 tệp đạt, 197 ca đạt, 1 bỏ qua, typecheck mã thoát 0 (`codex-fix2-G2-green.txt`); PostgreSQL 16 5 tệp đạt, 207 ca đạt, 0 bỏ qua (`codex-fix2-G2-native-verbose.txt`).
- **Tên của ca V2 đổi hai lần.** Ở `d9b0974` nó thêm « — on a draft that no mask reason holds». Lượt xem lại Task G2 chỉ ra tên đó hẹp hơn nội dung: mục 4 (dòng 2), 5 và 6 của chính ca kiểm nháp bị che. Ở `9b0f83f` tên thành «dừng tại OQ-53 (3): every other check still runs; when no mask reason holds the draft each names its code next to the placeholder, and when one does the hold names the mask reasons and the placeholder». Phiên chính tự sửa tên đó; không khẳng định nào đổi.
- **Lượt xem lại bảo mật của Task G2.** Dòng cuối: `VERDICT: READY FOR GATE`; P2-1 được xác nhận là đã đóng; P0 0, P1 0, P2 0, P3 2.
  - P3-1: khi không dựng được ngữ cảnh, câu giữ có thể thiếu `SCHEMA_INVALID` mà `list` hiện cho cùng dòng. Câu giữ vì vậy là một **tập con** của `maskReasons`, không phải lúc nào cũng đúng tập đó. Không lộ gì; chỉ lệch chẩn đoán. Phán quyết của phiên chính: chỉ ghi lại.
  - P3-2: tên của V2 — đã sửa ở `9b0f83f`.
  - Reviewer ghi: sau G1 và G2, không còn mục nào mà một người đọc chặt chữ của phương án 2 (b) xếp P0 hay P1; thứ còn tới người bị che đều ở mức P3 (danh sách ở 09.7).

**Điều planner nêu thêm — lượt xem lại Task G2 đọc hằng này và không nêu điểm này; chưa có phán quyết.** `satisfies MaskReason[]` kiểm rằng mỗi tên trong `MASK_REASONS` là một `MaskReason`; nó **không** kiểm rằng tập đủ. Thêm một mã che mới vào kiểu mà quên hằng này thì, im lặng: một nháp chỉ bị giữ bởi mã mới sẽ lại nêu mọi mã của cổng, và ở một nháp bị giữ bởi một mã che khác thì mã mới bị lọc khỏi câu giữ. Hằng không được xuất, nên không ca nào so được nó với danh sách của mình; ca H1 so các mã che nó đi qua với một mảng viết tay của chính ca. Phiên chính quyết có siết hay chỉ ghi.

### 09.7 · Điều Task G1 và Task G2 đổi trong hồ sơ

- **R3 được đóng; nó không còn là phần dư.** Hai chỗ mang nhãn tại chỗ: R3 ở `:221` và bản viết lại của bản 0.8 ở `:1867`. Phán quyết 2 của bản 0.8 (`:1728`), dòng quét-S1 của bảng tự soát (`:1917`) và mục 4 của phần tự soát bản 0.3 (`:735`) cũng mang nhãn.
- **C9 thêm hai câu** (`:77`). Câu thứ nhất (Task G1): «chỉ trả mã và lý do giữ» nay còn nghĩa là **không trả hash của nội dung dưới bất kỳ lớp che nào**. Câu thứ hai (Task G2): trên một nháp bị che, «lý do giữ» mà câu giữ của lệnh xác nhận nêu là **các mã che**, cộng giữ chỗ của điểm 3 OQ-53 với nháp ứng viên. **C3 thêm một câu** (`:71`): một nháp bị che được từ chối **không cần hash**. Cả ba vẫn là cách hiểu chờ Chairman xác nhận.
- **Hai cách hiểu khác, mà planner không tự chọn.** (i) Chặt hơn: một nháp bị che **không quyết định được gì cả** — không xác nhận, không từ chối — cho tới khi nội dung của nó được hiện lại cho người quyết định. Theo cách đó, nháp của một dự án vừa thành `IBS_HI`, hoặc của một dự án đang có chữ bị ẩn, nằm chờ trong danh sách và không ai gỡ được. (ii) Rộng hơn, cho câu thứ hai của C9: câu giữ nêu mọi mã của một lần giữ, kể cả trên một nháp bị che — hành vi trước Task G2, và là cách đọc của phán quyết 4 của bản 0.8 (`:1730`).
- **R15 — đóng với các mã tả nội dung (Task G2).** Trên một nháp bị che, câu giữ của lệnh xác nhận nay chỉ nêu các mã che — thứ một lần đọc đã nêu trong `maskReasons` — và giữ chỗ `SUBJECT_ORDER_UNVERIFIED` với nháp ứng viên, một mã không nói gì về nội dung. Các mã từng lọt — `SOURCE_REQUIRED`, `UNSOURCED_CLAIM`, `TOOL_NOT_ALLOWED`, `NOT_APPROVED_REVISION`, `MANIFEST_MISMATCH`, `VALUE_HASH_MISMATCH`, `SUBJECT_CHANGED`, `SUBJECT_BASELINE_MISSING`, `SUBJECT_EDIT_UNVERIFIED` — không còn được nêu chừng nào một mã che còn giữ nháp. **Phần còn lại của R15 là chính các mã che.** Chúng là thứ phương án (b) của điểm 2 OQ-45 nêu, nhưng tự chúng nói một ít về nháp (ví dụ `SOURCE_OUT_OF_CONTEXT`: nháp nêu một mã ngoài ngữ cảnh); tổ hợp của chúng là thứ bên ghi tác động được (R29); và người ghi được tài liệu làm đổi được `SOURCE_OUT_OF_CONTEXT` bằng cách đổi tài liệu nào nằm trong cửa sổ 50 tài liệu của ngữ cảnh (phần còn lại của P3-1). Phần đếm cho người không có quyền quyết định của R15 không đổi. R35 (chữ của dự án khác, quét-S3) và điều kiện 25 vẫn như bản 0.8.
- **Điều một nháp bị che vẫn cho người có quyền quyết định**, sau Task G2 (theo mục D của lượt xem lại Task G1): các mã che — trong `maskReasons`, và trong câu giữ (cùng các mã đó, hoặc thiếu `SCHEMA_INVALID` khi không dựng được ngữ cảnh); giữ chỗ `SUBJECT_ORDER_UNVERIFIED` với nháp ứng viên; siêu dữ liệu của dòng (`id`, `projectId`, `entityType`, `entityId`, `skill`, `createdAt`, và `manifestHash` khi nó khớp manifest hiện hành); quyết định đã ghi (kết quả, người, lúc, mã bản tài liệu); `total`, số dòng và thứ tự. Reviewer còn nêu thời gian xử lý theo cỡ của `value`, xếp P3. Không nội dung, không nguồn, không hash.
- **Hai mục chỉ ghi lại** (P3-2 và P3-4 của lượt xem lại Task G1; không đổi mã). (i) Một lệnh từ chối tới khi nháp đang bị che, rồi lớp che được gỡ trong lúc lệnh chạy: lệnh vẫn được ghi không cần hash, cho một nháp mà lúc ghi người đó đã được xem. Chấp nhận theo C3: nháp bất biến, và một lệnh từ chối không ghi gì vào Z1. (ii) Người được cho thấy nội dung mà không gửi hash nhận câu «Nháp đã đổi. Đọc bản mới trước khi quyết định.». Câu đó gây hiểu lầm, vì một nháp không bao giờ đổi; mã `REVISION_CONFLICT` và trạng thái 409 thì đúng.
- **Cái giá.** Của G1: như 09.5 — hợp đồng của `decide` từ lát 3 đổi; thêm một lần dựng ngữ cảnh cho mỗi `decide`. Của G2: như 09.6b — ít mã chẩn đoán hơn trên một nháp bị che; luật mốc của một nháp bị che không quan sát được từ ngoài.
- **`docs/OPEN-QUESTIONS.md:890`** (mục OQ-54, đoạn «Điều kèm theo để Chairman biết») nói người có quyền quyết định vẫn nhận `valueHash` của một nháp thuộc dự án đã thành `IBS_HI`. Với Task G1 câu đó không còn đúng với mã: nó được sửa tại chỗ, không dòng nào xê dịch. Chữ mới dựa vào R29 (các mã che vẫn được trả; `value` vẫn được đọc vào tiến trình của dịch vụ), nên đúng cả sau Task G2.
- **Các finding của hai lượt xem lại Task F5**, để hồ sơ đủ:
  - Q1 và S-F5-1 (cùng một điều: từ Task F5, login web giữ được khoá dòng dự án qua trigger của bảng quyết định) — phiên chính đã sửa chữ tại chỗ ở `:1432`, `:1869`, `:1875`, `:1876`.
  - Q3 — một câu ở `:1874`. S-F5-2 và phần về lỗi thô của Q5 — đã nằm trong điều kiện 18.
  - **Q2 và Q4 (P3, về bằng chứng) chưa làm**, theo phán quyết của phiên chính. Q2: hai ca F5-X1 và Y3 không khẳng định đường nào trả lời — trigger hay phép kiểm của dịch vụ. Q4: bốn ca chỉ chạy trên PostgreSQL thật của Task F5 (F5-P4, F5-P5, Y3, Y4) chưa từng được thấy đỏ trên thân cũ của 022; làm việc đó cần thân cũ của 022 và `decide` cũ trong cây làm việc đúng lúc cổng đang đọc nó.
  - Phần còn lại của Q5, ghi ở đây, không đổi mã: sau lệnh chèn quyết định, `decide` giữ khoá dòng dự án suốt lần `present` dựng câu trả lời — gồm câu quét theo dự án, chưa đo trên dữ liệu lớn (điều kiện 19 đo chính câu đó) — và thời gian đó ăn vào trần 5 giây của lệnh chèn nháp và lệnh ghi ánh xạ đang chờ. Một nhánh hiếm: khi một dòng quyết định đã có mà không qua khoá lệnh (login vận hành chèn thô), lệnh xác nhận cho một dự án `IBS_HI` nhận `DRAFT_HELD` thay vì `DRAFT_ALREADY_DECIDED`, vì trigger chạy trước `ON CONFLICT`.
  - Lượt xem lại CSDL còn viết lại câu catalog A và B cho thân có bốn hàm (mục E của báo cáo đó); hai câu đó chưa chạy (`:1885`).

### 09.8 · Task F4 sau Task G1 và Task G2, và chữ của các bản trước mà bản 0.9 thay

**Số ca.** Mốc đã đo ở `05a6da0`, trước Task G1: tổng 1 291 ca (dòng «Cả bộ» của trạng thái lúc ghi). Commit `ff24901` thêm đúng bảy ca, H1–H7, đều chạy được trên PGlite, và không thêm, bớt hay tách ca nào khác (theo diff của tệp test): phép cộng cho 1 298. Commit `d9b0974` thêm đúng một ca, H8 (theo diff của tệp test; nhánh mới của H7 và phần luật mốc nằm trong các ca đã có; `9b0f83f` chỉ đổi một tên ca): phép cộng cho **1 299** — PGlite 1 220 ca đạt, 79 bỏ qua; PostgreSQL 16 1 299 ca đạt, 0 bỏ qua; số tệp không đổi. Đây là phép cộng của kế hoạch, **không phải số đo**: số đo của cả bộ ở đầu nhánh do phiên chính ghi ở Task F4; lệch thì tìm nguyên nhân, không sửa con số.

**Bối cảnh gửi cổng Codex vòng 3 — lượt chạy cuối — phải nói:**

1. Finding của vòng 2 và điều Task G1 làm: không hash của nội dung dưới bất kỳ lớp che nào; không phép so hash nào cho người mà nháp bị che; lệnh từ chối một nháp bị che không cần hash; lệnh xác nhận không bao giờ đi qua khi thiếu hash đúng.
2. Hợp đồng của `decide` từ lát 3 đã đổi: `valueHash` của lệnh là tuỳ chọn; dòng quyết định vẫn mang hash đã lưu.
3. Hai lượt xem lại bảo mật của vòng sửa 2 (Task G1: một P2, bốn P3; Task G2: hai P3, một đã sửa, một chỉ ghi lại) và điều Task G2 làm: trên một nháp mà một mã che giữ, câu giữ của lệnh xác nhận chỉ nêu các mã che, cộng `SUBJECT_ORDER_UNVERIFIED` với nháp ứng viên; một lần giữ không có mã che nêu mọi mã. R15 đóng với các mã tả nội dung.
4. Điều một nháp bị che vẫn cho người có quyền quyết định: các mã che; giữ chỗ của điểm 3 OQ-53; siêu dữ liệu của dòng; quyết định đã ghi; số dòng và thứ tự (đủ ở 09.7). Đó là thứ phương án (b) của điểm 2 nêu — «chỉ trả mã và lý do giữ» (`docs/OPEN-QUESTIONS.md:668`).
5. Phần còn lại, đúng cỡ: người ghi được tài liệu làm đổi được `SOURCE_OUT_OF_CONTEXT` của một nháp bị che (phần còn lại của P3-1); tổ hợp các mã che là thứ bên ghi tác động được (R29).
6. C3 và C9 được mở rộng — C9 hai câu — là cách hiểu chờ Chairman xác nhận, kèm hai cách hiểu khác không được chọn (09.7).
7. Các ca hiện có đổi. Vì G1: M1, F5-X1 và ca «the context is built under the confirming person, not a wider principal»; nửa nháp tài liệu của H5 không viết được (09.6, «Như đã làm»). Vì G2: V2 (mục 4 và tên), T4 nửa sau, D2 nửa sau, D5, và luật mốc được thêm lại trên một cách dựng không bị che (09.6b).
8. Ba mục chỉ ghi lại: P3-2 và P3-4 của lượt xem lại Task G1 (09.7); P3-1 của lượt xem lại Task G2 — câu giữ là tập con của `maskReasons` khi không dựng được ngữ cảnh (09.6b).
9. Vòng sửa 2 không chạm migration 022; mọi điều của bối cảnh vòng 2 về 022, R33, R34 (kèm chữ sửa về login web), R35 và điều kiện 25 còn nguyên.
10. Hai mục P3 về bằng chứng của lượt xem lại Task F5, Q2 và Q4, chưa làm.
11. Đây là lượt chạy cuối của cổng: còn một P0 hoặc P1 thì công việc dừng và được báo là chưa hội tụ.

**Chữ của các bản trước mà bản 0.9 thay hoặc bổ sung** — đều còn nguyên tại chỗ, có nhãn «Bản 0.9»:

| Chỗ | Thứ đổi | Chữ hiện hành |
|---|---|---|
| R3 (`:221`); R3 của bản 0.8 (`:1867`); dòng R3 của bảng 08.7 (`:1893`) | phần dư về `valueHash` dưới lớp che | **đã đóng** — 09.4, 09.5 |
| Phán quyết 2 của bản 0.8 (`:1728`); dòng quét-S1 (`:1917`); mục 4 của tự soát bản 0.3 (`:735`) | «ở lại là phần dư»; «ngoài kế hoạch này» | 09.2, 09.4 |
| R15 (`:233`); R15 của bản 0.8 (`:1868`); dòng R15 của bảng 08.7 (`:1894`) | các mã tả nội dung không còn được nêu trên một nháp bị che; còn các mã che | 09.6b, 09.7 |
| Phán quyết 4 của bản 0.8 (`:1730`); dòng quét-S4 (`:1920`) | «không đổi mã» | 09.6b |
| C3 (`:71`), C9 (`:77`) | C3 thêm một câu, C9 thêm hai câu | tại dòng đó; 09.7 |
| Bảng trường của B2, dòng `valueHash` (`:159`); luật của `toView` (`:490`) | `valueHash` của một dòng bị che | `null` dưới mọi lớp che — 09.4 |
| Thứ tự trong thân khoá lệnh (`:264`) | bước «so `valueHash`» | 09.5 |
| Dòng phiên bản (`:5`), 08.1 (`:1706`), câu commit đề xuất của F5 (`:1863`) | chữ «vòng cuối» cho vòng 2 | 09.3 |
| Nguồn của mục bản 0.5 (`:853`) | «Trần là hai vòng sửa» — đúng; thêm một câu làm rõ | tại dòng đó |
| Đoạn mở của mục bản 0.5 (`:849`) | trỏ tới mục này | tại dòng đó |
| Task F4 (`:1325`), 08.6 (`:1883`) | «cổng Codex vòng 2» là lượt đã chạy; bối cảnh cho vòng 3 | danh sách ở trên |
| 08.6, các câu catalog (`:1885`) | câu A và B viết lại cho bốn hàm, chưa chạy | tại dòng đó |

Một chỗ không gắn nhãn được vì nằm trong khối mã: chú thích của `valueHash` trong kiểu `DraftView` ở `:145` («null only for a reader who may not decide the draft»). Chữ hiện hành là mục (a) của 09.6.

### 09.9 · Tự soát của planner cho bản 0.9

| Finding | Mức | Áp ở đâu, hoặc vì sao không |
|---|---|---|
| Cổng Codex vòng 2 — một nháp bị che vẫn trả `valueHash`; phép so hash của `decide` là một kênh thử trực tuyến | P0 | **Task G1** (09.4–09.6): `valueHash` rỗng dưới mọi lớp che; không so hash cho người mà nháp bị che; so lại sau bước giữ với lệnh xác nhận. R3 đóng (09.7) |
| Lượt xem lại Task G1, P2-1 — câu giữ trên một nháp bị che nêu mọi mã của cổng (R15) | P2 | **Task G2** (09.6b): câu giữ chỉ nêu các mã che, cộng giữ chỗ của điểm 3 với nháp ứng viên. R15 đóng với các mã tả nội dung (09.7) |
| P3-1 — người ghi được tài liệu làm đổi được mã trên một nháp bị che | P3 | Thu hẹp nhờ Task G2: các mã `SUBJECT_*` không còn được nêu. Phần còn lại, `SOURCE_OUT_OF_CONTEXT`, ghi ở R15 (09.7); không đổi mã |
| P3-2 — lệnh từ chối tới khi nháp bị che, được ghi sau khi lớp che gỡ, không mang hash | P3 | Không đổi mã: chấp nhận theo C3; ghi ở 09.7 |
| P3-3 — H7 thiếu nhánh hash sai | P3 | Thêm vào H7 trong Task G2 (09.6b) |
| P3-4 — câu «Nháp đã đổi…» cho lệnh thiếu hash | P3 | Không đổi mã: mã và trạng thái đúng; ghi ở 09.7 |
| Lượt xem lại Task G2, P3-1 — không dựng được ngữ cảnh thì câu giữ thiếu `SCHEMA_INVALID` so với `list` | P3 | Không đổi mã: tập con, không lộ gì; ghi ở 09.6b |
| Lượt xem lại Task G2, P3-2 — tên của ca V2 hẹp hơn nội dung | P3 | Sửa ở `9b0f83f`: một tên ca, không khẳng định nào đổi |

- Lời Chairman: không câu nào được chép lại, sửa hay dời ở bản 0.9; số lần xuất hiện của từng câu trong tệp bằng đúng bản 0.8 (so bằng máy). Chữ «Tối đa hai vòng sửa ở cổng» là chữ của brief, không phải lời Chairman. Chữ «chỉ trả mã và lý do giữ» là chữ của phương án (b) của điểm 2 OQ-45.
- Ba câu chép từ tệp kết quả của cổng ở 09.1 được chép bằng máy và so lại sau khi ghi. Hai khối mã ở 09.6 được chép bằng máy từ brief của Task G1, so lại sau khi ghi, và so với `src/server/suggestions.ts` ở `ff24901`: cả hai có nguyên văn trong tệp đó. Hai khối mã ở 09.6b được chép bằng máy từ brief của Task G2 và có nguyên văn trong `src/server/suggestions.ts` ở `d9b0974`.
- Không dòng nào trước mục này bị chèn hay xoá; các dòng đổi tại chỗ là đúng các dòng liệt kê ở dòng phiên bản (`:5`).
- Không phương án nào của câu hỏi mở được chọn; ba câu thêm vào C3 và C9 được ghi là cách hiểu chờ Chairman, kèm các cách hiểu khác.
- Không đường dẫn máy, không bí mật trong mục này.
- Điều planner nêu ở cuối 09.6b về hằng `MASK_REASONS` chưa có phán quyết.
- Chưa làm, và không phải việc của planner: số ca của F4 ở đầu nhánh; cổng Codex vòng 3. Q2 và Q4 của lượt xem lại Task F5 chưa làm.

## Tự soát của planner (bản 0.3, 18/11/2026)

- Lời Chairman chép nguyên ở hai chỗ (căn cứ mở PR; khối quyết định, so khớp bằng máy) và không được diễn lại ở chỗ nào khác; mọi chữ trong «» lấy từ mục OQ được ghi là chữ của mục.
- Mọi mục của cổng lượt 1 có dòng trong «Bảng: mục cổng bảo mật lượt 1 → chỗ áp»: N1–N3, cổng-R1…R7, cổng-C1…C10, hai bổ sung và câu hỏi mở mới. Không mục nào bị bỏ; mục cổng-C8 được áp với câu chữ chính xác hơn (mục 3 của «Dừng và chỗ chưa chắc»), và cổng lượt 2 chấp nhận. Mọi mục của lượt 2 (N4, cổng-R8, cổng-R9, cổng-C11…C13) có dòng trong «Bảng: mục cổng bảo mật lượt 2 → chỗ áp».
- Không mục nào của cổng được xử lý bằng một phương án nới: `sources` rỗng, `manifestHash` so với hằng, xét quyền trước tiên, và ba giữ chỗ đều theo hướng chặt; chỗ duy nhất không phải hướng chặt nhất (nháp tài liệu ở OQ-55, và C8) được nêu rõ là như vậy.
- Thứ tự kiểm mới của `decide` và giữ chỗ `THREAD_TEXT_HIDDEN` đã được đối chiếu với từng lời gọi `decide` của `tests/suggestions.test.ts`: không ca hiện có nào đổi kỳ vọng. So với bản 0.1, ca hiện có đổi kỳ vọng thêm duy nhất là K2 (thêm `sources:[]`); K3 được viết đủ, không đổi nghĩa.
- Không task nào thêm tuyến HTTP, login, khoá, `GRANT` cho role AI hay lời gọi mô hình. Bốn ca canh của role AI và ca canh tuyến không bị sửa.
- Đã chạy trên PGlite (CSDL trong bộ nhớ, ngoài repo, không để lại tệp nào trong repo): SQL của migration và tệp lùi; hai câu «đối tượng đã đổi»; câu «luồng có chữ đang ẩn» với bốn hình dạng luồng và hai phạm vi, ở cả dạng `NOT` lẫn `IS NOT TRUE` với danh sách nhóm có phần tử `null`; câu lệnh cho người không có quyền (`manifest_hash` so trong SQL); lệnh chèn nhiều dòng, dòng thiếu `tenant_id`, role không có quyền chèn; `tgenabled` và `tgtype`. Chưa chạy gì trên PostgreSQL 16.
- N4 áp theo cách sửa 2 của cổng: trong kế hoạch không còn chỗ nào trả `sources` khác `[]` dưới lớp che, và không câu lệnh nào đọc cột `sources`. Các tên `SOURCE_IDS_SQL` và `maskedSources` chỉ còn xuất hiện ở chỗ ghi rằng chúng đã bị bỏ.
- Chưa làm: lượt native. Theo báo cáo lượt 2, kế hoạch không cần lượt cổng thứ ba nếu N4 được sửa đúng như tả; phiên chính ghi nhận. Worktree đang có các tệp bản sao « 2»: planner không đụng tới chúng, và các lần chạy thử của planner ở lượt này dùng một CSDL trong bộ nhớ dựng riêng từ các tệp migration không mang đuôi đó.
