VERDICT: READY_FOR_GATE

# Review bảo mật tầng 1 — mã dịch vụ của Task 3–8 (OQ-53, OQ-57)

Ghế: bảo mật, tầng 1, chỉ soát MÃ DỊCH VỤ. Phạm vi: `git diff 80c1ad8..26ba304 -- src skills tests` (loại `migrations/`, `docs/`). Nhánh `feat/oq-53-subject-verification`, đầu `26ba304`, gốc `80c1ad8`. Kế hoạch bản 0.3. Migration 023 đã qua hai vòng riêng; tôi không soát lại, chỉ kiểm giả định mà mã dịch vụ dựa vào (mục «Giả định về 023»). Mọi đường dẫn trong báo cáo viết `<repo>`; không có secret, chuỗi kết nối hay chat ID.

Tổng: 0 P0 · 0 P1 · 0 P2 · 5 P3. Không finding nào đổi thiết kế đã chọn. Điều đáng chú ý nhất: (a) `messageRevisions` hôm nay là lời khai của mô hình và điều kiện N6 chỉ là chữ trong kế hoạch (SV-S-1, kèm đánh giá cảnh báo tự động ở mục riêng); (b) nháp `release_librarian` cũ bị che bằng `SOURCE_OUT_OF_CONTEXT` chứ không được giữ bằng `SUBJECT_CHANGED` khi có bản mới hơn một bản chưa duyệt mà nháp đã nêu (SV-S-2).

## 0 · Bằng chứng đã đo (#fact)

Môi trường: PGlite của repo (PostgreSQL 18.6 theo kế hoạch) và PostgreSQL native (container thử, CSDL riêng `slice1_verify_5311193`, không đụng CSDL `slice1_*` nào khác; sẽ `DROP` cuối phiên). Mỗi lần chạy vitest từng tệp.

| Phép đo | Kết quả |
|---|---|
| PGlite: `source-text` 39, `suggestions` 119 + 1 bỏ qua, `skill-context` 22, `skill-contracts` 42, `skills-manifest` 19, `skills-eval` 44 | tất cả xanh |
| Native: `thread-order-concurrency` 24, `suggestions` 120, `source-text` 39, `skill-context` 22, `suggestions-concurrency` 9 | tất cả xanh |
| `tsc --noEmit` trên bản sao `git archive 26ba304` | sạch, 0 dòng |
| `grep -rn "SUBJECT_ORDER_UNVERIFIED\|SUBJECT_EDIT_UNVERIFIED" src tests skills` | 0 dòng |
| Ca canh «no route imports the suggestion service, and nothing in src builds it with an AI handle» (`tests/suggestions.test.ts:1328`) | thân ca giống hệt ở `80c1ad8` và `26ba304` (cùng md5 của khối chữ) — không bị sửa |
| `git diff --name-status 80c1ad8..26ba304 -- migrations deploy scripts bot-plugin dashboard-plugin src/app package.json package-lock.json` | chỉ `A migrations/023_thread_order.sql`, `A migrations/rollback/023_thread_order.sql`; `bot-plugin/` và `src/server/ai-scope.ts` không đổi; không tuyến mới; 023 không có `CREATE ROLE`/`ALTER ROLE`/`LOGIN`/`PASSWORD`/`GRANT … TO libetech_ai` |
| Tệp `src` đổi | đúng năm tệp: `skill-context.ts`, `skill-contracts.ts`, `skills.ts` (một kiểu), `source-text.ts`, `suggestions.ts`; không thêm dòng log nào (`console.`, logger: 0) |

Đột biến trên bản sao ngoài repo (không sửa worktree). «Chết» = ít nhất một ca đỏ.

| Mã | Đột biến | Kết quả |
|---|---|---|
| M1 | nguồn con trỏ trả `source_hash` thật | chết (ca «the release librarian gets the content of the approved revision only…») |
| M2 | nguồn con trỏ trả `hash_verification` đã lưu | chết (cùng ca) |
| M3 | `hide` chỉ theo `pointerOnly` (bản chưa duyệt lộ tóm tắt) | chết, 2 ca |
| M4b | danh sách `present` của bản chưa duyệt không che | chết (cùng ca) |
| M5 | bỏ nhánh «bản mới nhất» khỏi `WHERE` | chết, 3 ca |
| M6 | `threadFreshness` bỏ so `head !== baseline` | chết, 6 ca |
| M7 | `has_baseline` bỏ vế «tin được nêu mà không có cặp» | chết, 3 ca (T7′, T18, T19) |
| M8 | bỏ `not_latest` | chết, 2 ca (L1 và T17) |
| M9 | bỏ `unnumbered` | chết, 1 ca (T16) |
| M10c | bỏ `h.project_id=$1` ở dòng đếm | chết (T12′) |
| M10a, M10b, M10d | bỏ `project_id=$1` ở `latest`, ở `source_revision_positions`, ở `e.project_id` của `thread` | **sống sót — tương đương theo khoá ngoại tổ hợp** (`source_event_revisions(source_event_id,tenant_id,project_id) → source_events` ở `migrations/016_intake_inbox.sql:75`; `source_revision_positions(revision_id,source_event_id,tenant_id,project_id) → source_event_revisions` ở `migrations/023_thread_order.sql:127`; `e.project_id` đã bằng `c.project_id` qua điều kiện nối). Không phải lỗ hổng, chỉ là đai thừa |
| G1 | bỏ `kind:'source_event'` của đường `messageRevisions.*.id` | chết (D2) |
| G2 | bỏ đường `messageRevisions.*.id` của `pm_planning` | chết, 3 ca |
| S1 | `decide` không trao `known` cho `present` | chết (K4) |
| S2 | bỏ nhánh bắt `LTZ03` | chết (K3) |
| S3 | hold nêu cả mã không-che khi bị che | chết, 6 ca (H8, …) |

Thăm dò riêng (mã probe ở bản sao ngoài repo, đã xoá khỏi bản sao):

- **SV1** (PGlite): nháp `release_librarian` nêu bản chuẩn (số 1) và con trỏ bản mới nhất (số 2); sau đó có bản 3. Đọc: `maskReasons = ['SOURCE_OUT_OF_CONTEXT']`, `value = null`. Xác nhận: `DRAFT_HELD … SOURCE_OUT_OF_CONTEXT`. Không có `SUBJECT_CHANGED`.
- **SV2** (PGlite): nháp của `intake_analyst` nêu `{id, revisionNo: 2}` cho một tin mà ngữ cảnh lúc đó hiện số 1; rồi tin được sửa thành bản 2. Xác nhận: **thành công** (`confirmed`).
- **SV3** (native, hai kết nối): một giao dịch nhận tin giữ dòng đếm của luồng (đã chèn bản sửa, chưa commit); lệnh xác nhận của người điều phối **bị che** (dịch vụ không hiện chữ của nhóm) trả `DRAFT_HELD: PROJECT_TEXT_HIDDEN, TEXT_NOT_VISIBLE, THREAD_TEXT_HIDDEN` sau 18 ms, không chờ khoá; 0 quyết định.

Một lần lệch kỷ luật của tôi, nêu cho đủ: một lần chạy PGlite thăm dò (mọi ca bị bỏ qua trừ hai ca của tôi, không đặt biến môi trường CSDL) tôi đã chạy khi `pgrep` còn 4 tiến trình của ghế khác; không đụng CSDL dùng chung nào. Các lần chạy còn lại đều chờ về 0.

## 1 · Giả định về 023 mà mã dịch vụ dựa vào (chỉ kiểm, không soát lại)

| Giả định của mã | Nơi | Kiểm |
|---|---|---|
| Cột `subject_thread_seq` bigint, dịch vụ trao chuỗi số; trigger so lại dưới khoá `FOR NO KEY UPDATE`, lệch → `LTZ03` với một câu cố định | `suggestions.ts:360-362`, `migrations/023_thread_order.sql:248-286` | đọc thân hàm; N7, N8, N12, N13 xanh native |
| Danh tính luồng của ứng viên bất biến | `threadFreshness` đọc `c.chat_id`, `c.thread_key`, trigger đọc lại cùng cột | role runtime chỉ `UPDATE(state,classification,duplicate_of,missing_fields,note,ticket_ref,decided_by,version,updated_at)` (`016_intake_inbox.sql:258`): không đổi được `chat_id`/`thread_key` |
| Bản nháp bất biến | lập luận của P13/L9 | `ai_drafts_immutable` (`021_ai_suggestions_z4.sql:151-152`) |
| Chỉ lệnh xác nhận đã qua mọi lý do giữ mới tới `INSERT` | thứ tự mã | `suggestions.ts:338-344` ném trước `:360` khi `reasons.size>0` (SV3 đo) |

## 2 · Findings

| Mã | Mức | Vị trí | Lớp | Tóm tắt |
|---|---|---|---|---|
| SV-S-1 | P3 | `src/server/suggestions.ts:124-131`; `skill-contracts.ts:52-65`, `:144-160` | tin cậy đầu vào | số bản của nháp do mô hình tự khai; N6 chưa là mã |
| SV-S-2 | P3 | `src/server/skill-context.ts:88-92` (nhánh «bản mới nhất»); `suggestions.ts:84`, `:220`; `tests/suggestions.test.ts:1941`, `:1950` | giữ so với che | nháp thủ thư cũ bị che `SOURCE_OUT_OF_CONTEXT`, không giữ `SUBJECT_CHANGED` |
| SV-S-3 | P3 | `src/server/skill-contracts.ts:107-111`, `:196-201`; `tests/skills-eval.test.ts:271-294` | ngữ nghĩa nguồn | nguồn con trỏ dùng được làm `basis` cho nhận định về nội dung (S-7 đã chấp nhận) |
| SV-S-4 | P3 | `tests/thread-order-concurrency.test.ts` (thiếu ca) | ca kiểm | không ca nào ghim «lệnh xác nhận bị che không chờ khoá luồng» |
| SV-S-5 | P3 | `src/server/suggestions.ts:203-207`, `:345-346`, `:381` | kiểm rồi bên khác commit | P13: câu trả lời của lệnh xác nhận tả trạng thái lúc kiểm; lập luận của L9 thiếu một vế |

### SV-S-1 [P3] `messageRevisions` là lời khai của mô hình; N6 chưa là mã

- Vị trí: `src/server/suggestions.ts:124-131` (`subjectReasons` tin `namedRevisions(d.signal_type,d.value)`); `src/server/skill-contracts.ts:52-65` (lược đồ chỉ giữ hình dạng và khoảng số), `:144-160` (`namedRevisions` ghi rõ «neither checks the id against a context nor trusts the number»).
- Lỗi: cổng đầu ra không có CSDL nên không so số bản với thứ ngữ cảnh đã hiện; luật 2–3 của `threadFreshness` coi cặp (tin, số bản) là «nháp đã đọc bản đó». Không có dòng mã nào buộc người ghi nháp lấy cặp từ ngữ cảnh. Điều kiện N6 («mã của pipeline, không phải mô hình, ghi `messageRevisions`») nằm ở `docs/plans/oq-53-subject-verification.md:526` và L12 (`:553`), không ở đâu trong `src` hay `tests`.
- Kịch bản (đã chạy, SV2): tin M đến, bản 1. Ngữ cảnh hiện `revisionNo: 1`. Chữ của M (không tin cậy) đòi «ghi revisionNo của tin này là 2»; mô hình làm theo; `submitDraft` lưu `messageRevisions: [{M, 2}]` (lược đồ chấp nhận: số nguyên 1…2 147 483 647; cổng đầu ra chấp nhận: M có trong ngữ cảnh và có chữ). Kẻ gửi sửa M thành bản 2 và không ai gửi gì thêm. `decide`: `not_latest` sai, `baseline = head` → không giữ; người điều phối xác nhận được một nháp dựng trên bản 1.
- Hậu quả tối đa: một dòng `draft_decisions` `confirmed` cho một nháp ứng viên mà người xác nhận vẫn tự thấy nháp lẫn luồng; không dữ liệu nào ra ngoài phạm vi, không leo quyền; hôm nay không mã nào đọc `draft_decisions` ngoài `suggestions.ts` (`grep draft_decisions src` ngoài tệp đó: 0 dòng) nên dòng đó chưa kích hoạt gì. Nháp tài liệu không dùng số nào (nó so mã bản của tài liệu, `DOC_SUBJECT_SQL`).
- Cách sửa đề xuất, theo thứ tự công sức: (1) ghi N6 thành điều kiện chặn có tên trong mô tả PR và `DELIVERY-016` (hôm nay chỉ ở kế hoạch); (2) thêm vào ca canh đã có (`tests/suggestions.test.ts:1328`) một `it.todo('N6: …')` hoặc một dòng chú thích ghim, để ai bật Z4 phải chạm đúng chỗ đó; (3) khi viết pipeline: đổi `submitDraft` để người gọi tin cậy trao danh sách tin của ngữ cảnh và **dịch vụ** ghi `messageRevisions`, bỏ giá trị của mô hình — khi đó SV2 thành ca đỏ cần có; kèm ràng nháp với ngữ cảnh bằng `inputHash` (điều kiện 25 của PR #22). (1) và (2) làm được trong PR này; (3) là việc của PR pipeline.

### SV-S-2 [P3] Nháp thủ thư cũ bị che thay vì bị giữ `SUBJECT_CHANGED`

- Vị trí: `skill-context.ts:88-92` chỉ trao bản chuẩn và bản mới nhất; `suggestions.ts:84`, `:220` coi `SOURCE_OUT_OF_CONTEXT` là lý do che.
- Lỗi: ngữ cảnh thủ thư chỉ chứa **một** con trỏ, của bản mới nhất. Nháp nêu con trỏ của bản N (chưa duyệt) thì khi bản N+1 được trình, mã của bản N rời ngữ cảnh. Cổng đầu ra thấy một mã ngoài ngữ cảnh (`SOURCE_OUT_OF_CONTEXT`, thuộc `VISIBILITY`) nên đọc bị che (`value: null`) và lệnh xác nhận trả đúng mã che đó; mã `SUBJECT_CHANGED` bị lọc khỏi lời giữ vì «đang bị che» (`suggestions.ts:341-343`).
- Kịch bản (đã chạy, SV1): hai bản, bản 1 chuẩn, bản 2 chưa duyệt; nháp nêu cả hai; có bản 3; đọc → bị che `SOURCE_OUT_OF_CONTEXT`; xác nhận → `DRAFT_HELD … SOURCE_OUT_OF_CONTEXT`.
- Đánh giá: an toàn (vẫn giữ; không lộ gì; từ chối vẫn làm được vì `maskedForCaller` bỏ so hash). Khác ý của quyết định 2 (a) («một bản được trình sau khi nháp viết xong giữ nháp»): nháp vẫn bị giữ nhưng không đọc được và không nêu là «đã cũ»; khác `doc_reviewer` (ngữ cảnh có mọi bản tới 30 bản nên nháp cũ đọc được và nhận `SUBJECT_CHANGED`). Chỉ ca «approved là bản mới nhất» được ghim (`tests/suggestions.test.ts:1950`); ca này không có ca nào.
- Cách sửa đề xuất: thêm một ca ghim hành vi thật (nháp nêu con trỏ cũ, có bản mới hơn: bị giữ, nêu rõ mã nào) và một câu trong `DELIVERY-016` rằng một nháp thủ thư đã nêu con trỏ cũ đọc ra «bị che» chứ không «đã cũ». Không cần đổi ngữ cảnh.

### SV-S-3 [P3] Nguồn con trỏ làm `basis` cho nhận định nội dung

- Vị trí: `skill-contracts.ts:107-111` (`claims.*.basis` là đường `supports:true`, chỉ buộc mã nằm trong ngữ cảnh và trong `sources`), `:196-201`; ca `tests/skills-eval.test.ts:271-294` tự ghi rằng đầu ra nêu nội dung với `basis:[mã con trỏ]` được cổng chấp nhận (`{ pass: true, reasons: [] }`).
- Đánh giá: đúng như S-7 của cổng kế hoạch. Mô hình không có nội dung nào của bản đó nên một nhận định về nội dung là bịa, không phải rò; người duyệt thấy nó. Điểm cổng kế hoạch chưa nêu: nhận định «tài liệu có bản mới chưa duyệt» có sẵn cơ sở ở nguồn `document` (`latestRevisionId` khác `approvedRevisionId`, `skill-context.ts:72`), nên con trỏ chỉ cần vào `sources`, không cần vào `basis`/`sourceIds`. Nếu chủ sở hữu muốn cấm cơ học: loại nguồn `document_revision` không tóm tắt, không danh sách khỏi các đường `supports:true` (cùng kiểu «excerpt không chữ không chống đỡ nhận định», F9-3). Không bắt buộc; tôi nhắc lại điều kiện của cổng kế hoạch là «không thêm luật cấm».

### SV-S-4 [P3] Thiếu ca ghim «lệnh xác nhận bị che không chờ khoá luồng»

- Vị trí: `tests/thread-order-concurrency.test.ts` (N7–N15 chỉ có người xác nhận không bị che).
- Điều đang đúng nhờ cấu trúc mã: `INSERT` chỉ tới khi `reasons` rỗng (`suggestions.ts:338-344`), nên một người điều phối mà nháp bị che không bao giờ tới trigger và không chờ khoá luồng (SV3: 18 ms). Không ca nào ghim điều đó; một lần sắp xếp lại `decide` đưa `INSERT` lên trước phép kiểm sẽ không làm ca nào đỏ, và sẽ mở kênh thời gian «có tin đang bay trong luồng» cho người đọc không có quyền xem nội dung. Kênh ấy nằm trong phạm vi (L5), nên đây là ghim cấu trúc, không phải sửa lỗ.
- Cách sửa: một ca native mười lăm dòng, theo N13: giao dịch thô chèn một bản sửa và để mở; `confirm(draft,key,new SuggestionService(h.db,h.operator,[]))` phải trả `DRAFT_HELD` nêu đúng các mã che **trước** khi giao dịch kia commit, và `draft_decisions` còn 0 dòng. (Mã thăm dò SV3 là đúng ca này.)

### SV-S-5 [P3] P13: câu trả lời của lệnh xác nhận tả trạng thái lúc kiểm — ghi nốt vế thứ hai của lập luận

- Vị trí: `suggestions.ts:203-207` (`known`), `:345-346`, `:381`.
- Sự thật: trước P13 phần đuôi quét lại hai phép kiểm chữ bị ẩn sau lệnh ghi; nay dùng kết quả lúc kiểm. Với lớp «kiểm rồi bên khác commit» của cổng Codex, cửa sổ của **câu trả lời** rộng ra từ «sau lệnh ghi» thành «từ phép kiểm».
- Vì sao không lộ thêm gì (#fact + suy luận kiểm được): (i) nháp bất biến (`ai_drafts_immutable`), nên nội dung trả về là hàm của các tin đã commit trước khi nháp được ghi; một tin có chữ bị ẩn commit **sau** phép kiểm cũng sau nháp, không thể nằm trong nháp — đây là lập luận của L9 (`docs/plans/oq-53-subject-verification.md:550`); (ii) đường còn lại làm trạng thái «ẩn chữ» đổi giữa phép kiểm và câu trả lời là nhãn IBS_HI đổi: `pointerOnly` đổi **trước** lệnh ghi thì guard của 022 từ chối (`LTZ01`, `X1` trong `tests/suggestions.test.ts`), **sau** lệnh ghi thì ghi nhãn chờ khoá dòng dự án mà lệnh xác nhận giữ tới commit (kế hoạch mục 9). Kế hoạch L9 chỉ nêu (i); vế (ii) đã đúng trong mã nhưng chưa được viết ra.
- Cách sửa: thêm vế (ii) vào L9 và vào `DELIVERY-016` để cổng không phải suy ra.

## 3 · Trả lời riêng về R10-g (Task 8)

Điều Chairman quyết 19/11/2026 (OQ-57 điểm 1 (a), 2 (a)): nguồn chỉ-con-trỏ cho bản mới nhất chưa duyệt (mã, mã tài liệu, số bản), không nội dung, tóm tắt, danh sách có/thiếu hay hash nguồn.

**1. Câu SQL (`src/server/skill-context.ts:79-93`) che nội dung ngay trong SQL, cho mọi đường?** Có. Cột trả về chỉ là `v.id`, `v.revision_no` và bốn biểu thức `CASE`; `summary`, `present`, `missing` bị cắt bởi `m.hide`, `source_hash` và `hash_verification` bị cắt bởi `m.pointer`. Nội dung thật của bản chưa duyệt không rời Postgres.

| Đường | Kết quả đọc từ câu lệnh | Chứng cứ |
|---|---|---|
| thủ thư, dự án thường, có bản chuẩn khác bản mới nhất | hai dòng: bản mới nhất = con trỏ (`NULL`, `[]`, `[]`, `NULL`, `self_declared`); bản chuẩn = đủ nội dung | `tests/skill-context.test.ts:391-452` (ba bản, bản 2 chuẩn) |
| thủ thư, bản chuẩn trùng bản mới nhất | một dòng, đủ nội dung (`pointer` sai) | cùng ca, đoạn «revision 3 is both the newest and the approved one» |
| thủ thư, chưa có bản chuẩn | một dòng, bản mới nhất, con trỏ (`v.id IS DISTINCT FROM NULL` đúng; chỉ bản mới nhất qua `WHERE`) | cùng ca, đoạn «nothing approved» |
| thủ thư, dự án IBS HI (`pointerOnly`) | mọi dòng `hide`; bản chuẩn không tóm tắt/danh sách nhưng vẫn có `source_hash` và `hash_verification` đã lưu (như mọi kỹ năng ở dự án đó — mức con trỏ); con trỏ vẫn cắt cả hash | cùng ca, đoạn `IBS_HI` (`rec4`) |
| thủ thư, tài liệu khác của dự án | không có dòng nào (`d.id=$2`) | cùng ca, đoạn «ANOTHER document» (`rec5`, mã 7 và 8 vắng) |
| nhiều tài liệu | câu lệnh chỉ nối bản của đúng `documentId`; nguồn `document` của các tài liệu còn lại chỉ có mã, loại, tiêu đề (hoặc `null`), `latestRevisionId`, `approvedRevisionId` — không đổi so với `80c1ad8` | đọc `skill-context.ts:68-72` |
| năm kỹ năng khác | `$4` là `false` nên `pointer` sai, `hide` bằng `$3`: **không đổi** so với trước | `skill-context.test.ts` các ca cũ xanh |

**2. Có đường nào đưa `summary`/`present`/`missing`/`source_hash`/`hash_verification` thật của bản chưa duyệt vào ngữ cảnh, `JSON.stringify`, log, `recordingDb`, hoặc nguồn `document`?** Không tìm thấy. Ca L1 khẳng định cả ba nơi: `JSON.stringify(context)` và `JSON.stringify(rec.rows())` — các dòng mà `recordingDb` thấy trả từ CSDL, tức đúng thứ tiến trình nhận — không chứa dấu đánh dấu nào (`absent`, `skill-context.test.ts:408-411`), và có **đối chứng dương** (`rec2.rows()` chứa dấu của bản chuẩn: `:425`) nên «vắng» không phải «không ghi được gì». Nguồn `document` không có trường nội dung và không đổi. Không dòng log nào được thêm. Đột biến M1–M5 đều làm ca đỏ.

**3. Oracle?** Sự tồn tại và mã của bản mới nhất đã có sẵn ở `document.latestRevisionId`. Điều mới là `revisionNo` của nó, mà sổ tài liệu (`DocumentService.detail`) đã trao cho mọi thành viên không-bot của dự án; người dựng ngữ cảnh phải có quyền đọc (`READ_ROLES`, `skill-context.ts:45`). `hashVerification` là hằng nên không lộ bit «đã được xác minh». **Dùng làm `basis` cho nhận định nội dung?** Được, như SV-S-3: là bịa, không phải rò; đúng kế hoạch (S-7).

## 4 · Đánh giá cảnh báo tự động về số bản do nháp tự nêu

Công cụ rà soát đã cảnh báo «trusting draft-stated revision numbers» quanh `suggestions.ts:119`.

- **Cảnh báo có đúng?** Đúng về sự thật: `subjectReasons` tin `namedRevisions(d.value)` và lược đồ không so số với ngữ cảnh. Đây chính là L12 (`docs/plans/oq-53-subject-verification.md:553`), không phải lỗi mới.
- **Khai thác được qua mã thật?** Qua *mã dịch vụ*: có, nếu có người ghi nháp để giá trị của mô hình đứng (SV2: nháp nêu số 2 khi ngữ cảnh hiện 1, rồi tin được sửa đúng thành bản 2 → xác nhận thành công). Qua *hệ thống chạy hôm nay*: không — không có đường ghi nháp nào: `submitDraft` không ai gọi, ca canh `:1328` không đổi, `libetech_ai` không có login (023 không tạo, `AGENTS.md` và `bot-plugin/` không đổi). Điều kiện cần: (1) có pipeline, (2) pipeline không ghi đè, (3) kẻ gửi tin sửa đúng số đã đoán và không ai gửi tin sau đó. Kết quả tối đa như SV-S-1: một dòng quyết định cho một nháp cũ, trước mặt người điều phối.
- **Đủ điều kiện N6 chưa?** N6 đúng về nội dung (pipeline ghi `messageRevisions` từ chính ngữ cảnh đã đưa mô hình, ghi đè giá trị của mô hình). Nhưng hôm nay nó là chữ trong kế hoạch: không ca nào, không dòng mã nào buộc nó, và D4/D5 của `tests/skills-eval.test.ts` chỉ cung cấp dữ liệu cho ca của pipeline sau này. Với PR này (không có pipeline) điều đó chấp nhận được nếu N6 được ghi như điều kiện chặn khi bật Z4; đề xuất ba bước ở SV-S-1. Khi bật Z4 mà N6 chưa thành mã: P1.

## 5 · Trả lời các điểm soi đặc biệt còn lại

**(3) `decide` / CX3.** So-và-ghi: dịch vụ trao `position` của lần kiểm (`subjectReasons` → `subjectPosition` → `$12::bigint`, `suggestions.ts:333`, `:358-362`); trigger so lại dưới khoá. Mọi thứ tự giữa nhận tin và xác nhận đã được chạy native: tin đang bay → xác nhận chờ rồi `SUBJECT_CHANGED` (N7, N13); xác nhận giữ khoá trước → nhận tin chờ (N8, N14); tin tới giữa phép kiểm và lệnh ghi → `LTZ03` → `DRAFT_HELD: SUBJECT_CHANGED` (K3, cả hai engine); khe commit ngược (N12). Lời giữ của `LTZ03`: một câu cố định, `AppError` không có `cause`, khoá chỉ `['code','status']` (K3). Lỗi khác của `INSERT` (55P03, 40P01, 40001, 57014) vẫn đi thô như 022 (N15 ghim; điều kiện N8 của kế hoạch giao tuyến đầu tiên bọc) — không đổi mức.

`present` nhận hai kết quả đã tính: dùng cho đúng nháp đang xác nhận (`rows=[view]` cùng `id`, `hiddenThread` khoá theo `entity_id` của chính nó), chỉ nhánh xác nhận trao tham số (`known` khai ở `:285`, gán ở `:346` sau khi `reasons` rỗng), lần phát lại và `list` không trao. Không có đường cho một lần ĐỌC dưới lớp che sai: lớp che của người gọi vẫn dựng lại từ ngữ cảnh dựng dưới quyền họ và `maskedForCaller` (`:296`) chạy trước, không dùng `known`. Phần cửa sổ rộng ra: SV-S-5.

Người không có quyền hay nháp bị che học được gì: không gì. Không quyền → 403 hoặc 404 trước mọi phép đọc luồng. Có quyền nhưng nháp bị che → mọi lý do giữ (mask hay không) đều ném trước `INSERT`; lời giữ chỉ nêu mã che (`:341-343`; S3 đo); `subjectReasons` có chạy nhưng chỉ đọc, không khoá, và kết quả không đi vào câu trả lời; không tới trigger nên không chờ khoá (SV3). Câu trả lời không chứa độ mới, số bản, vị trí hay mã tin: `position` không rời `decide` (`SubjectCheck.position` chỉ vào `$12`).

**(4) `threadFreshness`** (`source-text.ts:134-168`): một câu lệnh, một ảnh chụp (đọc `thread`, `latest`, `stated`, `positions`, `head` trong cùng một `SELECT`); trả boolean, `baseline` và `head` dạng chữ số; mã dự án hay ứng viên sai dạng không tới CSDL (T13′); cặp sai dạng hoặc số ngoài 1…2 147 483 647 bị bỏ trước khi gửi (T19, kèm `Queryable` bẫy); `changed` đóng mọi thứ câu lệnh không nói rõ (`!== false`, `=== null`); không chữ, không hash (T6′); hai bảng mới chỉ nêu ở `source-text.ts` (ca canh `tests/source-text.test.ts:157`, xanh). Ranh giới tenant là RLS, ghi rõ trong chú thích (như T8 trước đây); điều kiện dự án có mặt ở dòng đếm (đột biến M10c chết) và dư ở các nơi khác nhờ khoá ngoại tổ hợp.

**(5) Gỡ hai giữ chỗ.** Điều kiện giữ còn lại của một lệnh xác nhận nháp ứng viên (mọi điều kiện đều ném trước `INSERT`, trừ ba mã CSDL):

| Điều kiện | Nơi |
|---|---|
| `MANIFEST_MISMATCH` (nhãn hàng và `outputs.manifestHash`), `VALUE_HASH_MISMATCH` | `suggestions.ts:312-319`; `skill-contracts.ts:193` |
| `ENTITY_NOT_FOUND`, `POINTER_ONLY_PROJECT` | `:322-324`; guard 022 `LTZ01` ở lệnh ghi |
| cổng đầu ra: `SCHEMA_INVALID`, `SOURCE_REQUIRED`, `SOURCE_OUT_OF_CONTEXT`, `UNSOURCED_CLAIM`, `TOOL_NOT_ALLOWED`, `TEXT_NOT_VISIBLE`, `NOT_APPROVED_REVISION` | `:325`; `skill-contracts.ts:185-216` (kể cả mọi mã trong `messageRevisions`) |
| `THREAD_TEXT_HIDDEN`, `PROJECT_TEXT_HIDDEN` | `:327-330`, `:336-337` (không yếu đi; `MASK_REASONS` không đổi; lời giữ khi bị che bỏ đúng một mã, `SUBJECT_ORDER_UNVERIFIED`) |
| `SUBJECT_BASELINE_MISSING`, `SUBJECT_CHANGED` | `:331-333`; `source-text.ts:167` |
| `REVISION_CONFLICT` (hash) | `:349` — nay tới được với nháp ứng viên (trước kia luôn bị giữ chỗ chặn); cùng nhánh với nháp tài liệu |
| CSDL: `LTZ01`, `LTZ02`, `LTZ03` | `:363-373` |

Hai thứ mà hai giữ chỗ từng chặn: `SUBJECT_EDIT_UNVERIFIED` (bản sửa ghi từ mốc trở đi) nay là luật 2–3 (`not_latest`, `head !== baseline`) cộng luật 4; `SUBJECT_ORDER_UNVERIFIED` (tin đang bay) là trigger so-và-ghi. Một nháp cũ qua được cả hai chỉ khi **khai sai số bản** (SV-S-1) hoặc khi hai điều kiện đã ghi ở L1, L2 chiều ngược lại (giữ oan, không cho qua). Phép thử bằng mã thật cho bảng ca biên mục 8 của kế hoạch: hàng 1–4 → `T7′ (row 1)`, `(rows 2,3,4)`; hàng 5–7 → `(rows 5,7)` và T18; hàng 8 → `(row 8)`; hàng 9–10 → `(row 9)` và N12, N7; hàng 11 → N8, N14; hàng 12–13 → L1/L2 (`T7′ row 12`, `T14′`); luồng đổi giữa chừng → K3, N12; nháp tài liệu nêu mã tin và mã tin của luồng khác → T17, T4, `SOURCE_OUT_OF_CONTEXT` (ca sẵn có); toàn bộ xanh trên PGlite và native.

**(6) Ca kiểm.** Ca khẳng định điều nó tuyên bố (đã gây đột biến): L1 (bốn bản đồ + đối chứng dương), K3, K4, T6′–T19, D1–D3, H8, J1–J2, ca NOT_APPROVED_REVISION. Ca đã đổi kỳ vọng còn ghim điều cần ghim: E1 giữ nhánh «chữ bị ẩn → `TEXT_NOT_VISIBLE`», E3 giữ nhánh ẩn rồi mới xác nhận, H8 (ii) giữ cả lời giữ có tên mã lẫn lời giữ chỉ nêu mã che và `not.toContain('SUBJECT_CHANGED')`, T4 giữ cả hai nhánh, K4 có hai đối chứng (từ chối, phát lại). Ca chỉ khẳng định rỗng: không thấy ca nào không có đối chứng dương. Thiếu ca: SV-S-2 và SV-S-4. Ca canh `:1328` không bị sửa (md5 khớp).

**(7)** Không tuyến mới; không login hay khoá cho `libetech_ai`; `bot-plugin/` và `src/server/ai-scope.ts` không đổi (mục 0).

## 6 · Điều tôi đã thử mà không phá được

- Cho một người điều phối bị che học luồng qua mã giữ, thời gian hay độ chờ khoá: lời giữ chỉ mã che; không tới trigger; 18 ms khi luồng đang bị giữ (SV3).
- Làm lệnh xác nhận qua mặt `known` để trả nội dung dưới lớp che sai: `known` chỉ gán khi `reasons` rỗng, chỉ truyền cho đúng nháp; nháp bất biến; nhãn IBS_HI đã bị guard 022 và khoá dòng dự án chặn (SV-S-5).
- Nguồn con trỏ mang nội dung hay hash: năm đột biến SQL; `recordingDb` đối chứng dương.
- Số bản sai kiểu (0, âm, lẻ, chuỗi, 2 147 483 648, `NaN`, `Infinity`, mảng), id chữ hoa, id của tài liệu hoặc luồng khác, cặp lặp, cùng tin hai số: lược đồ, `namedRevisions` và `threadFreshness` loại hoặc giữ (D1–D3, T17, T19); id chữ hoa vào `SOURCE_OUT_OF_CONTEXT`.
- Bản sửa muộn có `edited_at` cũ hơn, tin ngoài cửa sổ 20 tin, bản không có số (trigger bị tắt), tin đang bay, bản sửa đang bay: giữ (L1, L2, T16, N12, N13), không có đường cho qua.
- Gỡ giữ chỗ làm yếu `MASK_REASONS`, `THREAD_TEXT_HIDDEN`, `PROJECT_TEXT_HIDDEN`: đột biến S3 chết sáu ca; đọc mã `:338-344` không thấy mã che nào bị bỏ.
- `LTZ03` lộ chữ CSDL: câu cố định; không `cause`; khoá lỗi chỉ `code`, `status`.

## 7 · Ba việc đòn bẩy cao nhất

1. Ghi N6 thành điều kiện chặn có tên (PR, `DELIVERY-016`) và ghim vào ca canh `:1328` một `it.todo`; khi viết pipeline, để dịch vụ chứ không mô hình ghi `messageRevisions` (SV-S-1).
2. Thêm hai ca còn thiếu: nháp thủ thư cũ (SV-S-2) và lệnh xác nhận bị che không chờ khoá luồng (SV-S-4, mã thăm dò có sẵn trong báo cáo này).
3. Viết nốt vế thứ hai của L9 (nhãn IBS_HI) vào kế hoạch và biên nhận để lớp «kiểm rồi bên khác commit» của câu trả lời không phải suy ra (SV-S-5).
