# OQ-45 và OQ-46 · Nháp AI: ai đọc nội dung, che lúc đọc, từ chối nháp IBS HI lúc ghi, giữ nháp đã cũ — Kế hoạch triển khai

> **Cho agent thực thi:** làm lần lượt từng task theo `superpowers:subagent-driven-development` (khuyến nghị) hoặc `superpowers:executing-plans`. Các bước dùng ô `- [ ]`. Mỗi task theo nhịp: viết ca kiểm → chạy thấy đỏ đúng lý do → viết mã tối thiểu → chạy xanh. Builder **không** commit, push hay mở PR: phiên chính commit ở «Điểm commit» cuối mỗi task. Kế hoạch **không** gồm cổng Codex, biên nhận, cập nhật roadmap — phiên chính làm. Builder của một task chỉ cần đọc «Global Constraints» và đúng task của mình.

Version 0.4 · 18/11/2026 · **chỉ hồ sơ**, do phiên chính ghi sau sáu lượt review theo task (`docs/reviews/oq-45-46-evidence-20261118/gates/review-task-*.md`) và bốn phép đo trên PostgreSQL 16.15. Ba thứ đổi so với 0.3: (1) guard của migration 022 nay từ chối giao dịch không ở READ COMMITTED bằng SQLSTATE `LTZ02` — khối SQL của tệp thuận ở Task 1 đã được thay bằng đúng nội dung tệp; (2) một đợt sửa thêm ca kiểm và ba sửa nhỏ trong mã; (3) phần dư R20–R29 và bảy điều kiện thêm «trước khi bật Z4». Tất cả nằm ở mục «Sau các lượt review theo task», gần cuối tệp. Không đổi lời Chairman, không đổi phương án nào của OQ-53, OQ-54, OQ-55, không thêm câu hỏi mở. Các task và ca kiểm của bản 0.3 giữ nguyên chữ.

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
| **OQ-55** (`:899-908`; từ N2 của cổng) — nháp mang chữ của tin mà không nêu mã tin | **Dừng tại OQ-55. Giữ chỗ fail-closed, không phải phương án được chọn** (phán quyết của phiên chính sau cổng lượt 1): nháp **ứng viên** bị che (`THREAD_TEXT_HIDDEN`), và không xác nhận được, khi luồng của nó có ít nhất một bản của tin đã lưu chữ mà cấu hình hiện tại không cho hiện — xét mọi bản của mọi tin trong luồng, không theo trần 20 tin, không chỉ bản mới nhất. Với nháp **tài liệu**: **không viết mã**, và đó **không phải hướng chặt nhất** — nháp tài liệu có thể mang chữ của tin mà không phép kiểm nào thấy (R16) | Task 4b, ca Q1–Q7 | Một nhánh ở bước che và một nhánh ở bước giữ |

## Cách hiểu chờ Chairman xác nhận (không phải lời Chairman; C1–C7 và C9 theo hướng chặt, do chữ của quyết định kéo theo; C8 là đọc đúng chữ và **không** phải hướng chặt nhất)

- **C1 · «`value`» gồm mọi bản chép và mọi trường do bên ghi chọn.** Cột `questions` là bản chép của `value.questions`; `sources` là bản chép của `value.sources` và hợp đồng cho `id` là chuỗi bất kỳ; `confidence` do mô hình viết; `skill_version`, `model_version` là chữ tự do tới 64 ký tự; `manifest_hash` là 32 byte tuỳ ý với một dòng chèn thô. Người **không có quyền quyết định** không nhận trường nào trong số đó: nội dung là `null`, `sources` là `[]`, `valueHash` là `null`, `manifestHash` chỉ được trả khi bằng hash của manifest hiện hành (một hằng của máy chủ). Một mã đúng dạng uuid vẫn là 16 byte do bên ghi chọn: «đúng dạng» không có nghĩa «không mang thông tin» (N1 của cổng). Nếu chỉ rút `value` thì `questions` và `sources` thành đường rò thứ hai — đúng điều OQ-45 nêu ở Phía B. Người có quyền quyết định nhưng bị che cũng nhận `sources: []` (C9).
- **C2 · «nháp trích tin người đó không đọc được chữ» gồm cả trường hợp không chứng minh được là đọc được:** nháp nêu một mã không có trong ngữ cảnh dựng lại cho người đọc (`SOURCE_OUT_OF_CONTEXT`), đối tượng của nháp không còn trong dự án hoặc cặp kỹ năng–đối tượng không dựng được ngữ cảnh (`ENTITY_NOT_FOUND`), giá trị đã lưu không còn khớp hợp đồng nên không liệt kê được mã nó nêu (`SCHEMA_INVALID`). Chữ của quyết định chỉ nêu hai lý do; ba lý do thêm là «không chứng minh được thì che». Nội dung **không khai nguồn** là thứ khó chứng minh nhất: với nháp ứng viên nó được xử lý bằng giữ chỗ của OQ-55 (`THREAD_TEXT_HIDDEN`); với nháp tài liệu không có phép kiểm nào (R16). Các lý do **không** nói về điều người đọc được đọc (manifest cũ, hash lệch, bản chưa chuẩn, xin công cụ; và, với nháp tài liệu, thiếu nguồn và nhận định không nguồn) **không** che.
- **C3 · Câu trả lời của lệnh quyết định cũng là một lần đọc.** `decide` trả `DraftView`; nó đi qua cùng luật: người vừa từ chối một nháp mà mình không đọc được chữ nguồn nhận quyết định đã ghi, không nhận nội dung; người gửi lại lệnh sau khi mất quyền quyết định, hoặc sau khi dự án thành chỉ con trỏ, cũng vậy. Và lệnh quyết định không được làm lộ điều mà `list` đã rút: người không có quyền quyết định nhận cùng một câu từ chối, bất kể `valueHash` gửi lên đúng hay sai và nháp đã có quyết định hay chưa (N3 của cổng).
- **C4 · «từ chối ngay lúc ghi» áp cho mọi lần thử ghi và mọi role ghi:** kể cả gửi lại một khoá khử trùng của nháp đã lưu trước khi dự án thành `IBS_HI` (câu trả lời là từ chối, không phải «đã có»), và kể cả login vận hành chèn thô.
- **C5 · Với luồng tin, «bản mới nhất nháp nêu» đọc là tin được ghi sau cùng trong các tin của chính luồng mà nháp nêu;** «tin mới» là tin của luồng mà nháp không nêu, được ghi từ thời điểm đó trở đi. «Được ghi» tính theo đồng hồ CSDL (`source_events.created_at`, cột mặc định `now()` mà role nhận tin không đặt được), không theo `observed_at` do gateway khai: một tin đến muộn từ hàng chờ có `observed_at` cũ vẫn là tin mới của luồng, và một `observed_at` sai về tương lai không được làm tê liệt phép kiểm.
- **C6 · Mốc tính trên mọi trường mã của đầu ra** (bảng `ID_FIELDS`, không chỉ `sources`), chỉ các mã thuộc chính tài liệu hoặc chính luồng của nháp; mã không phải uuid chữ thường không tính là đã nêu. Mốc là thứ nháp **nêu**, không phải thứ nháp đã đọc: đó là hệ quả của mốc Chairman chọn.
- **C7 · «tài liệu có bản mới hơn» tính theo số bản (`revision_no`) cao nhất của tài liệu, kể cả bản chưa được duyệt.** Hệ quả: nháp `release_librarian` (ngữ cảnh chỉ có bản chuẩn) không xác nhận được khi tài liệu đang có một bản trình mới hơn bản chuẩn; và nói chung nháp phải nêu đúng bản mới nhất (hoặc tin mới nhất) thì mới xác nhận được.
- **C8 · Vai đọc S11 không có quyền xác nhận vẫn thấy dòng nháp** (mã dòng, kỹ năng, thời điểm, quyết định đã ghi, và số dòng). Đây là đọc **đúng chữ** của điểm 1 («Ai xem `value`»): quyết định rút nội dung, không rút sự tồn tại của nháp. **Không phải hướng chặt nhất:** hướng chặt hơn là không liệt kê dòng cho họ. Planner không tự chọn hướng đó vì nó rút thêm một thứ quyết định không nói tới. Những gì bên ghi còn chọn được trong phần họ thấy: số dòng, thứ tự, kỹ năng của từng dòng, và việc `manifestHash` có khớp hay không (R15).
- **C9 · «chỉ trả mã và lý do giữ» đọc là: mã của chính dòng nháp (cùng mã dự án và mã đối tượng mà người đọc đã nêu) và các mã lý do; không gồm danh sách nguồn.** Dưới **mọi** lớp che — người không có quyền quyết định, và người có quyền nhưng bị che — `sources` là `[]`. Hướng chặt: danh sách nguồn do bên ghi chọn (tới 100 phần tử, lặp và xếp thứ tự tuỳ ý), và không gì trong PR này dùng nó khi nội dung bị che (N4 của cổng lượt 2; phán quyết của phiên chính). Khi nội dung được trả, `sources` là `value.sources` đã qua lược đồ và qua cổng. Hệ quả: người có quyền quyết định nhìn một nháp bị che chỉ thấy mã lý do, không thấy nháp nêu nguồn nào.

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
| `valueHash` | bên ghi (qua dịch vụ: hash của `value`) | `null`, ngay trong SQL | trả (cần để **từ chối** nháp) | trả |
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
  - (a) **Bit này xuyên tenant** với người giữ role biết cả hai uuid: trigger `BEFORE ROW` chạy trước `WITH CHECK` của RLS, nên bit có cả khi dự án nằm ngoài phạm vi role tự khai và cả khi không có ngữ cảnh nào (ca G7, G9 ghim đúng hành vi đó, không giấu).
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
- **R2** · Nội dung nháp lưu trước khi dự án thành `IBS_HI` nằm lại trong bảng; role AI vẫn đọc được dòng trong phạm vi tự khai. OQ-54.
- **R3** · `valueHash` của nháp bị che vẫn trả cho người có quyền quyết định (32 byte mỗi dòng). Với nháp gần như không có chữ tự do, hash cho phép thử ngoại tuyến các trường ít giá trị (ví dụ phân loại); với dòng chèn thô nó là 32 byte tuỳ ý. Người không có quyền quyết định không nhận hash, và không thử được qua `decide` (N3).
- **R4** · Role AI có một bit «`IBS_HI` hay không» cho mỗi cặp `(tenant, dự án)` nó nêu được, xuyên tenant, không để lại dòng nào khi dò. Thứ mới chỉ là nhãn đó (B4).
- **R5** · Một dòng ánh xạ sang `IBS_HI` được commit trong lúc một lệnh chèn nháp đang chạy: nháp có thể được lưu. Tương đương «ánh xạ đổi ngay sau khi lưu»; điểm 2 và cổng xác nhận xử lý. Không lấy khoá trên dòng dự án trong trigger: khoá đó cho người giữ role AI một cách chặn các lệnh sửa dòng dự án.
- **R6** · Luồng tin (viết lại theo cổng-R5): `created_at` của một tin là lúc **bắt đầu** giao dịch nhận tin (`migrations/016_intake_inbox.sql:47`, `:65`). Giao dịch đó lấy một khoá tư vấn và có thể phải chờ (`src/server/intake.ts:87`), với trần 10 giây cho mỗi câu lệnh (`src/server/db.ts:32`). Một tin mà giao dịch nhận bắt đầu trước mốc nhưng commit sau khi pipeline đã đọc ngữ cảnh mang thời điểm sớm hơn mốc: **khe hở dài bằng thời gian giao dịch nhận tin còn mở, không phải cỡ mili giây, và tin lọt qua không bao giờ được phát hiện**. Đồng hồ CSDL bị chỉnh lùi cũng vậy. Một tin đến giữa phép kiểm và lúc commit của lệnh xác nhận không được thấy — không khác «tin đến ngay sau khi xác nhận». Đóng hẳn cần một số thứ tự của luồng (migration và đổi đường nhận tin); ngoài phạm vi; đã chép vào OQ-53.
- **R7** · Quyền đọc nội dung xét theo vai trong phiên, như `decide`; không đọc lại từ CSDL danh tính trong giao dịch. Cổng lượt 1 chưa soát đường dựng `Principal` từ phiên.
- **R8** · Trần của ngữ cảnh (20 tin, 50 tài liệu, 30 bản) làm che oan và giữ oan nháp nêu nguồn ngoài trần. Phép kiểm `THREAD_TEXT_HIDDEN` không dùng trần.
- **R9** · Dịch vụ phải được dựng với đúng `excerptChats` của đường nhận tin; mặc định rỗng ⇒ mọi nháp nêu tin đều bị che, và mọi nháp ứng viên của luồng có lưu chữ đều bị che (khoảng trống 42). PR này không dựng dịch vụ ở đâu ngoài test.
- **R10** · Khoảng trống 41 (khoá khử trùng đã dùng ở dự án khác trả xung đột) không đổi.
- **R11** · `maskReasons` cho người có quyền quyết định biết nháp nêu một nguồn họ không đọc được, hoặc luồng có chữ đang ẩn. Đó là «lý do giữ» mà quyết định cho trả.
- **R12** · Giữ chỗ của OQ-53 giữ oan: nháp ở luồng có bản sửa ghi sau tin mới nhất nháp nêu, và nháp không nêu bản hay tin nào.
- **R13** · `list` không báo nháp đã cũ; người xác nhận biết khi lệnh trả `DRAFT_HELD`.
- **R14** · Số lần dựng ngữ cảnh khác nhau theo quyền của người đọc; khác biệt thời gian chỉ lộ vai của chính người đọc; chưa đo.
- **R15** · Phần bên ghi còn chọn được sau N1 và N4. Với người **không có quyền quyết định**: khoảng 3,6 bit mỗi dòng — kỹ năng (sáu giá trị, khoảng 2,6 bit) và một bit «`manifestHash` có khớp manifest hiện hành không» — cộng số dòng và thứ tự chèn. Với người **có quyền, dưới lớp che**: thêm đúng một thứ, `valueHash` (R3); `sources` là `[]`. (Bản 0.2 trả dưới lớp che các mã của cột `sources` có trong ngữ cảnh và ghi «tối đa 100 bit mỗi dòng». Cổng lượt 2 chỉ ra con số đó sai: cột giữ cả thứ tự và số lần lặp, tức khoảng 664 bit mỗi dòng. Bản 0.3 bỏ hẳn đường đó.)
- **R16** · **Nháp tài liệu có thể mang chữ của tin mà không phép kiểm nào thấy:** nó không gắn với luồng nào, nên giữ chỗ của OQ-55 không áp được; chỉ luật «dự án chỉ con trỏ» che được. **Đây là đường có sẵn của một pipeline trung thực, không chỉ của đối thủ** (cổng-R9): bộ dựng ngữ cảnh nhận cùng lúc một ứng viên và một tài liệu cho `ba_elicitation` và `pm_planning` (`src/server/skill-context.ts:23-24`, `:31`, `:48-49`, `:53-66`), nên pipeline có thể ghi một nháp tài liệu từ một ngữ cảnh có chữ của tin; lúc đọc và lúc xác nhận, dịch vụ dựng lại ngữ cảnh chỉ theo tài liệu — nháp nêu mã tin thì bị che và bị giữ, không nêu thì chữ đi qua. PR này không viết mã cho trường hợp đó và đó không phải hướng chặt nhất (OQ-55, phương án (b) và (e)).
- **R17** · `modelVersion` (tới 64 ký tự, pipeline khai) được trả cùng nội dung và không qua cổng kiểm nào: cùng lớp với chữ không khai nguồn trong `value`.
- **R18** · Giữ chỗ của OQ-55 che **mọi** nháp ứng viên của một luồng có chữ đang ẩn, kể cả nháp không chép chữ nào; và không che gì khi luồng chưa từng lưu chữ.
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
- **Dừng tại OQ-53:** hai nhánh `SUBJECT_EDIT_UNVERIFIED` và `SUBJECT_BASELINE_MISSING`. **Dừng tại OQ-55:** nhánh `THREAD_TEXT_HIDDEN`, chỉ cho nháp ứng viên; không viết mã nào tương tự cho nháp tài liệu. Cả ba là giữ chỗ fail-closed, viết đúng như Task 4b, 5, 6 tả; không tự đổi sang phương án khác. **OQ-54:** không viết mã.
- Trên máy này `grep` là bí danh của ugrep: dùng `/usr/bin/grep`. Không chạy lệnh in dòng lệnh tiến trình (`ps aux`, `ps -ef`, `pgrep -fl`). Không đọc `.runtime/`, `.env*`.

**Dữ liệu và quyền**
- AI chỉ ghi Z4 (AR-03, E-AI-04). PR này không cấp cho `libetech_ai` quyền nào; không `GRANT` nào trong 022.
- Chữ của tin Telegram chỉ rời CSDL qua `src/server/source-text.ts`. Chuỗi `source_event_revisions` và `text_excerpt` chỉ được xuất hiện trong `src/server/intake.ts` và `src/server/source-text.ts` — **kể cả trong chú thích** (ca quét của `tests/source-text.test.ts` so danh sách tệp). Hai hàm mới đọc bảng bản sửa (`threadHasHiddenText`, `threadFreshness`) nằm trong `source-text.ts` và chỉ trả giá trị đúng/sai; `src/server/suggestions.ts` gọi chúng và không nêu tên bảng.
- Người gọi và tenant lấy từ `Principal` / `AiPrincipal`, không từ thân lệnh. Mọi lược đồ lệnh giữ `strictObject`.
- «Không tồn tại» và «ngoài phạm vi» trả cùng một câu, cùng mã, cùng trạng thái (`SCOPE_DENIED`, 404, «Không tìm thấy mục trong phạm vi được cấp.»).
- Câu lỗi chỉ chứa mã lý do: không id, không tên, không chữ của nháp, không chữ của lỗi CSDL. Không ghi nội dung nháp vào log.
- Mọi câu SQL dùng tham số; mọi câu đọc của dịch vụ có `project_id=$n`. Mảng mã truyền cho `::uuid[]` phải đã lọc bằng biểu thức uuid chữ thường (không để lỗi `22P02` thô tới người gọi).
- Mọi `DraftView` rời dịch vụ đi qua `present`; không nơi nào khác dựng `DraftView`.

**Ghi**
- Mọi lần ghi nằm trong một giao dịch; lệnh quyết định giữ nguyên thứ tự khoá: khoá nháp → khoá dòng tài liệu (xác nhận nháp tài liệu) → khoá lệnh. Trong thân khoá lệnh: **xét quyền trước tiên** → đã có quyết định → so `valueHash` → lý do từ chối hoặc bước giữ → ghi.
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
  - `mask` không rỗng: năm trường nội dung là `null`; **`sources` là `[]`** (mọi lớp che — N4, C9); `valueHash = mask.includes('CONFIRM_AUTHORITY_REQUIRED') ? null : r.value_hash`.
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
4. **`valueHash` cho người có quyền quyết định khi nháp bị che** (R3): cần để từ chối. Nếu cổng muốn rút, lệnh từ chối phải thôi đòi `valueHash` — đổi hợp đồng của `decide`, ngoài kế hoạch này.
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

- **R20** · Phục hồi data-only (đường cài đặt có sẵn: `deploy/install-user.py`, `deploy/install-d1.sh`, `docs/DEPLOY-002.md:19`) chạy với trigger bật. Theo phép đo 2, guard không xét được dòng nháp nào lúc phục hồi vì ánh xạ được nạp sau. Hai hệ quả: lần phục hồi không bị lùi vì một nháp lưu trước khi dự án thành `IBS_HI`; và guard không phải lưới cho dữ liệu được phục hồi. Nếu thứ tự nạp đổi (phiên bản `pg_dump` khác, thêm khoá ngoại giữa hai bảng) thì một nháp như vậy làm lùi cả lần phục hồi; `--disable-triggers` tắt luôn các trigger bất biến và là việc cần người quyết.
- **R21** · Login của pipeline phải giữ `default_transaction_isolation = read committed`. Khác đi thì mọi lệnh ghi nháp bị từ chối `LTZ02` (đóng). Phần dư R5 chỉ còn cửa sổ giữa câu đọc của guard và lúc commit của lệnh chèn.
- **R22** · Sau một lệnh chèn thành công, giao dịch của role AI giữ `AccessShareLock` trên `public.project_domain_mappings` tới khi kết thúc: nó chặn được DDL trên bảng đó, không chặn lệnh ghi dòng.
- **R23** · Mỗi lần guard từ chối là một dòng `ERROR` trong log máy chủ PostgreSQL. Nội dung của nháp bị từ chối (tham số của lệnh chèn) nằm lại trong log nếu `log_parameter_max_length_on_error` khác 0, hoặc `log_statement` / `log_min_duration_statement` ghi kèm tham số. Mặc định của PostgreSQL là không ghi tham số.
- **R24** · Bổ sung cho R15: `createdAt` (tới mili giây) tới cả người không có quyền quyết định, và thời điểm chèn là thứ bên ghi chọn được.
- **R25** · Người không có quyền quyết định gọi `decide` vẫn lấy khoá nháp, kéo `value` vào tiến trình Node và giữ chỗ khoá lệnh trước khi bị từ chối. Không lộ gì ra câu trả lời. Không đổi vì thứ tự trước khoá lệnh là hợp đồng khử trùng của lát 3; cần giới hạn tần suất khi có tuyến.
- **R26** · Ngữ cảnh trao cho pipeline `observedAt` của từng tin, không trao thời điểm ghi. Nháp ứng viên vì vậy chỉ chắc chắn xác nhận được khi nêu **mọi** tin của luồng có trong ngữ cảnh. Luồng dài hơn 20 tin có một tin đến muộn nằm ngoài cửa sổ ngữ cảnh: không nháp nào xác nhận được cho tới khi luồng có tin mới hơn. Tin ghi sau cùng được lưu ở chế độ chỉ con trỏ: nêu thì `TEXT_NOT_VISIBLE`, không nêu thì `SUBJECT_CHANGED`. Cả ba là hướng chặt.
- **R27** · Chính xác hơn cho R6: trần 10 giây là của mỗi câu lệnh, không phải của khe hở; các tin đầu của một luồng đến cùng lúc (album) đảo thứ tự bắt đầu và commit là chuyện thường; bản sửa có cùng khe hở; một tin mà giao dịch nhận đã bắt đầu nhưng chưa commit lúc xác nhận sẽ mang `created_at` sớm hơn `created_at` của quyết định, nên người đọc sổ về sau có thể hiểu nhầm rằng người xác nhận đã có tin đó.
- **R28** · Nháp `release_librarian` trên một tài liệu đã có bản nhưng chưa có bản chuẩn luôn bị giữ `SUBJECT_BASELINE_MISSING` (ngữ cảnh của kỹ năng đó không có bản nào để nêu). Thuộc giữ chỗ của OQ-53 điểm 2.
- **R29** · Bất biến P3 đọc chính xác là «điều bị che lúc đọc luôn bị giữ lúc xác nhận»; mã có thể khác khi không dựng được ngữ cảnh. Với dự án chỉ con trỏ, `value` vẫn vào tiến trình Node rồi mới bị bỏ (cùng OQ-54). Giữ chỗ của OQ-55 xét luồng của chính ứng viên: chữ của một luồng khác cùng dự án mà nháp chép lại không được phép kiểm nào thấy. Tổ hợp các mã che của một dòng là thứ bên ghi tác động được.

**Trước khi thêm tuyến đọc nháp hoặc bật Z4 — bổ sung** (đánh số tiếp danh sách ở mục «Giới hạn đã biết»):

7. Ngay sau khi áp 022 ở bất kỳ CSDL nào, chạy câu catalog chỉ đọc ở mục «Ghi chú triển khai cho biên nhận» của `review-task-1-2-database.md`: chủ hàm có `rolsuper` hoặc `rolbypassrls`, ACL chỉ có chủ, `tgenabled='O'`, `tgtype=7`, hai thiết lập đã ghim. `scripts/migrate.ts` áp mọi migration đang chờ trong một lượt, nên lần migrate kế tiếp ở bất kỳ đâu cũng áp luôn 022.
8. Login của pipeline: `default_transaction_isolation = read committed` (R21), kiểm lúc tạo login.
9. Đọc bốn thiết lập log của cụm (R23).
10. Đo lại thứ tự nạp trên một bản dump của CSDL thật và quyết về `--disable-triggers` (R20).
11. Tuyến gọi `decide`: giới hạn tần suất, ánh xạ lỗi lược đồ lệnh, không log thân câu trả lời (R25).
12. Hợp đồng và prompt của pipeline: nêu mọi tin của luồng có trong ngữ cảnh và bản mới nhất của tài liệu (R26, R28).
13. Một lần `EXPLAIN` trên PostgreSQL 16 cho hai câu đọc luồng (`threadHasHiddenText`, `threadFreshness`) trên một luồng dài.

## Tự soát của planner (bản 0.3, 18/11/2026)

- Lời Chairman chép nguyên ở hai chỗ (căn cứ mở PR; khối quyết định, so khớp bằng máy) và không được diễn lại ở chỗ nào khác; mọi chữ trong «» lấy từ mục OQ được ghi là chữ của mục.
- Mọi mục của cổng lượt 1 có dòng trong «Bảng: mục cổng bảo mật lượt 1 → chỗ áp»: N1–N3, cổng-R1…R7, cổng-C1…C10, hai bổ sung và câu hỏi mở mới. Không mục nào bị bỏ; mục cổng-C8 được áp với câu chữ chính xác hơn (mục 3 của «Dừng và chỗ chưa chắc»), và cổng lượt 2 chấp nhận. Mọi mục của lượt 2 (N4, cổng-R8, cổng-R9, cổng-C11…C13) có dòng trong «Bảng: mục cổng bảo mật lượt 2 → chỗ áp».
- Không mục nào của cổng được xử lý bằng một phương án nới: `sources` rỗng, `manifestHash` so với hằng, xét quyền trước tiên, và ba giữ chỗ đều theo hướng chặt; chỗ duy nhất không phải hướng chặt nhất (nháp tài liệu ở OQ-55, và C8) được nêu rõ là như vậy.
- Thứ tự kiểm mới của `decide` và giữ chỗ `THREAD_TEXT_HIDDEN` đã được đối chiếu với từng lời gọi `decide` của `tests/suggestions.test.ts`: không ca hiện có nào đổi kỳ vọng. So với bản 0.1, ca hiện có đổi kỳ vọng thêm duy nhất là K2 (thêm `sources:[]`); K3 được viết đủ, không đổi nghĩa.
- Không task nào thêm tuyến HTTP, login, khoá, `GRANT` cho role AI hay lời gọi mô hình. Bốn ca canh của role AI và ca canh tuyến không bị sửa.
- Đã chạy trên PGlite (CSDL trong bộ nhớ, ngoài repo, không để lại tệp nào trong repo): SQL của migration và tệp lùi; hai câu «đối tượng đã đổi»; câu «luồng có chữ đang ẩn» với bốn hình dạng luồng và hai phạm vi, ở cả dạng `NOT` lẫn `IS NOT TRUE` với danh sách nhóm có phần tử `null`; câu lệnh cho người không có quyền (`manifest_hash` so trong SQL); lệnh chèn nhiều dòng, dòng thiếu `tenant_id`, role không có quyền chèn; `tgenabled` và `tgtype`. Chưa chạy gì trên PostgreSQL 16.
- N4 áp theo cách sửa 2 của cổng: trong kế hoạch không còn chỗ nào trả `sources` khác `[]` dưới lớp che, và không câu lệnh nào đọc cột `sources`. Các tên `SOURCE_IDS_SQL` và `maskedSources` chỉ còn xuất hiện ở chỗ ghi rằng chúng đã bị bỏ.
- Chưa làm: lượt native. Theo báo cáo lượt 2, kế hoạch không cần lượt cổng thứ ba nếu N4 được sửa đúng như tả; phiên chính ghi nhận. Worktree đang có các tệp bản sao « 2»: planner không đụng tới chúng, và các lần chạy thử của planner ở lượt này dùng một CSDL trong bộ nhớ dựng riêng từ các tệp migration không mang đuôi đó.
