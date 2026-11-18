# Review theo task · Task 5 — giữ nháp tài liệu khi tài liệu có bản mới hơn bản mới nhất nháp nêu (OQ-46 b; giữ chỗ OQ-53 điểm 2)

- **Loại:** review theo task (đúng yêu cầu + chất lượng), không phải review merge. Khuyến nghị cho Chairman, không phải phê duyệt.
- **Người soát:** agent `liberico-code-reviewer` (mô hình Fable 5.2). Ngày 18/11/2026.
- **Phạm vi:** base `1f4961f`, head `e90485b` (một commit, 5 tệp, +114 −10). Gói diff: `.superpowers/sdd/oq-45-46-ai-drafts/review-1f4961f..e90485b.diff`.
- **Cách soát:** chỉ đọc. Không chạy test, không nối CSDL, không git ghi. Mã ngoài diff được đọc bằng `git show e90485b:<đường dẫn>` và `git grep … e90485b`, không đọc từ đĩa các tệp builder kế tiếp đang sửa.
- **Nhãn:** `#fact` = đọc được từ mã, diff hoặc log đã mở; `#inference` = suy ra từ mã; `#hypothesis` = lời khai chưa thấy bằng chứng.

## Phán quyết tóm tắt

| Câu hỏi | Phán quyết |
|---|---|
| 1. Đúng yêu cầu của brief | **Đạt.** Không thiếu, không thừa, không hiểu sai. |
| 2. Chất lượng | **Needs fixes — chỉ ở ca kiểm.** Mã sản phẩm (`src/server/suggestions.ts`, `src/server/skill-contracts.ts`) đúng theo đọc mã và không cần đổi. Một ca (D2, nửa sau) xanh mà không chứng minh điều tên ca nói. |
| Số finding | Critical 0 · Important 1 · Minor 5 |

## 1. Đúng yêu cầu

### 1.1 Đối chiếu brief → mã

| Yêu cầu của brief | Trạng thái | Căn cứ |
|---|---|---|
| `namedIds(skill, value)` xuất từ `src/server/skill-contracts.ts`, dùng lại `collect`, không đổi gì khác | Đạt `#fact` | `src/server/skill-contracts.ts:120-123`; diff của tệp: +5 dòng, 0 dòng bị xoá. `checkSkillOutput`, `ID_FIELDS`, các schema không nằm trong diff. |
| `DOC_SUBJECT_SQL` đúng chữ của brief | Đạt `#fact` | `src/server/suggestions.ts:106-108` trùng từng ký tự với khối giao diện của brief. |
| `subjectReasons`: lọc bằng `UUID` chữ thường, không hạ chữ hoa; bốn nhánh `newest===0` / `named===0` / `newest>named` / còn lại; nhánh ứng viên trả `[]` | Đạt `#fact` | `src/server/suggestions.ts:114-122`. Chú thích nêu OQ-53 điểm 2 ở `:119`. |
| Gọi trong `decide`, nhánh `confirmed`, trong `if(ctx)`, sau phép kiểm `THREAD_TEXT_HIDDEN`; không đổi gì khác của `decide` | Đạt `#fact` | `src/server/suggestions.ts:290`; diff của `decide` là đúng một dòng thêm. |
| Phép đọc chạy sau khi dòng tài liệu bị khoá | Đạt `#fact` | Khoá ở `:251` (trước khoá lệnh), phép đọc ở `:290` (trong thân khoá lệnh). |
| Ca D1–D5 trong nhóm mới, D6 trong `tests/skill-contracts.test.ts` | Đạt `#fact` | `tests/suggestions.test.ts:452-508`; `tests/skill-contracts.test.ts:449-463`. Tên ca trùng brief. |
| H4, H5, K3 | Đạt `#fact` | Mục 1.3. |
| Đỏ vì `AssertionError` ở D1, D2 (nửa sau), D3 (nửa đầu), D5; D6 đỏ vì thiếu hàm xuất không tính | Đạt `#fact` | `task-5-red.txt`: 4 dòng `AssertionError`, 0 dòng `timed out`; `5 failed | 190 passed | 1 skipped`. D6 là `TypeError: namedIds is not a function`. |
| Không sửa `expect` nào có sẵn của `tests/suggestions.test.ts` ngoài H4 | Đạt `#fact` | Tệp có đúng **một** dòng bị xoá: dòng mặc định của `docDraft` (`:81`). |
| Nhánh ứng viên chưa có (Task 6) | Không tính là thiếu | `:116` trả `[]`. |

**Thừa:** không có mã sản phẩm ngoài brief. Ở ca kiểm, D3 và D5 thêm `zeroDecisions()` — vô hại, cùng hướng với brief.

**Tệp bị chạm:** đúng năm tệp brief nêu (`git diff --name-only 1f4961f e90485b`). `#fact`

### 1.2 Từng ca D1–D6 có khẳng định điều tên ca nói không

| Ca | Kết luận | Lý do |
|---|---|---|
| **D1** `tests/suggestions.test.ts:455-466` | **Có.** | Trước khi có mã, lệnh xác nhận **thành công** («expected a refusal») — nên phép giữ chỉ do phép kiểm mới. Ca khẳng định `SUBJECT_CHANGED`, không có `SUBJECT_BASELINE_MISSING`, 0 quyết định, số bản và số khoá lệnh không đổi; rồi dùng lại **cùng `key`** cho một nháp khác và xác nhận được — nếu khoá còn bị giữ thì câu trả lời sẽ là `IDEMPOTENCY_CONFLICT`. `#fact` |
| **D2 nửa đầu** `:469-472` | **Có.** | Nháp nêu r1 rồi r2 theo thứ tự đó; một cài đặt lấy «bản đầu tiên» hay «bản thấp nhất» sẽ ra `SUBJECT_CHANGED` và ca đỏ. `#inference` |
| **D2 nửa sau** `:473-475` | **Không** — finding **I-1**. | Xanh vì A.r1, không vì B.r1. |
| **D3** `:478-487` | **Có.** | Nửa đầu: trước khi có mã là «expected a refusal»; sau có `SUBJECT_BASELINE_MISSING`, không có `SUBJECT_CHANGED`. Nửa sau: tài liệu chưa có bản được xác nhận và ra đúng bản số 1 — ghim nhánh `newest===0`. `#fact` |
| **D4** `:489-500` | **Có, ở vai ca canh.** | Xanh từ trước khi có mã (báo cáo builder nói rõ). Không rỗng: nếu nhánh `rejected` chạy bước giữ, hoặc bước giữ bị đưa ra ngoài thân khoá lệnh, ca đỏ — vì cách dựng nháp cũ ở đây trùng D1, nơi lệnh xác nhận bị giữ. `toEqual(first)` so cả câu trả lời; `draft_decisions` vẫn 1 dòng. `#inference` |
| **D5** `:502-507` | **Có.** | Hạ chữ hoa rồi so, hoặc bỏ bộ lọc (PostgreSQL nhận uuid chữ hoa), đều làm `named` thành 1 và mất `SUBJECT_BASELINE_MISSING` → ca đỏ. Vế «không bao giờ 22P02» thì không được chạm — **M-3**. `#inference` |
| **D6** `tests/skill-contracts.test.ts:449-463` | **Có.** | `toEqual` có thứ tự ở các đường dẫn chung (ghim «theo thứ tự xuất hiện đầu tiên» và «mỗi mã một lần»); `duplicateOf`; hai trường bản của `doc_reviewer`; bốn đường dẫn của `release_librarian` (mã `rb` lặp hai lần chỉ trả một); ba giá trị không phải đầu ra trả `[]`. `#fact` |

Không ca nào rỗng hay luôn đúng. Một ca (D2 nửa sau) xanh vì lý do khác với điều nó tuyên bố.

### 1.3 H4, H5, K3 và các ca hiện có khác

- **H4 — đổi hạ tầng, đúng như bảng.** `tests/suggestions.test.ts:81`: nguồn mặc định thành `[mã tài liệu, mã bản mới nhất]` có lọc giá trị rỗng. Không `expect` nào khác đổi. `#fact`
- **H5 — đổi hạ tầng, đúng như bảng.** `tests/suggestions-concurrency.test.ts:20` và `:46`: thêm `{id:d.record.latest_revision_id}` vào `sources`. `expect` của hai ca đầu giữ nguyên. `#fact`
- **K3 — đổi kỳ vọng vì quyết định, không nới.** `tests/suggestions-concurrency.test.ts:72-96`. Tên mới trùng bảng K3. Bốn phép khẳng định (i)–(iv) đều có: (i) đúng một bên thành công (`:84`) — **chặt hơn** bản cũ; (ii) xác nhận thắng → `REVISION_CONFLICT` ở lệnh trình tay, 1 quyết định trỏ đúng `latest_revision_id` (`:88-90`) — như cũ; (iii) trình tay thắng → `DRAFT_HELD` 422, câu chứa `SUBJECT_CHANGED`, 0 quyết định (`:92-94`) — đây là chỗ đổi vì OQ-46 (b), thay cho `REVISION_CONFLICT` cũ; (iv) số bản tăng đúng 1 (`:85`). Không phép khẳng định nào bị bỏ mà không có cái thay. `#fact`
- **Ca hiện có khác bị sửa:** không. `tests/skill-contracts.test.ts` chỉ đổi dòng `import` và thêm D6. `#fact`
- **`src/server/skill-contracts.ts` chỉ thêm `namedIds`:** đúng. `#fact`

## 2. Chất lượng

### 2.1 Tính đúng của `subjectReasons` và `DOC_SUBJECT_SQL`

| Ranh giới | Hành vi theo đọc mã | Nhãn |
|---|---|---|
| Tài liệu chưa có bản | Câu lệnh gộp không `GROUP BY` luôn trả một dòng; `newest=0` → `[]`. | `#fact`; ghim bởi D3 nửa sau |
| Nháp nêu bản của tài liệu khác | Cả hai phép gộp chạy trên `WHERE v.project_id=$1 AND v.document_id=$2`, nên mã của tài liệu khác không bao giờ khớp `FILTER`. **Mã đúng; không ca nào ghim (I-1).** | `#fact` về mã |
| Mã chữ hoa / sai dạng | Lọc bằng `UUID` chữ thường (`:30`, không cờ `i`) trước khi tới `::uuid[]`; không hạ chữ hoa. | `#fact`; D5 ghim vế chữ hoa |
| Mảng rỗng | `named=[]` → `ANY('{}')` sai với mọi dòng → `FILTER` rỗng → `coalesce(…,0)`. Ca có sẵn «DOC-05» (`tests/suggestions.test.ts:114`, `sources: []`) đi qua `decide` với mảng rỗng, nên đường này được chạy trên cả hai máy CSDL. | `#fact` về mã; `#inference` về ca |
| Giá trị lưu lệch hợp đồng | `collect` chỉ nhận chuỗi, chỉ đi vào mảng và đối tượng thường; `null`, chuỗi, số, mảng sai chỗ đều cho `[]`, không ném. Kích thước bị chặn bởi CHECK `octet_length(value::text) <= 49152` (`migrations/021_ai_suggestions_z4.sql:44`), nên mảng tham số có trần. Nháp như vậy đã bị giữ `SCHEMA_INVALID`; thêm mã `SUBJECT_…` không hại. | `#fact` |
| `doc_reviewer` | Hai trường bản nằm trong `ID_FIELDS`, nên được tính làm mốc dù không nằm trong `sources`. Chỉ ghim ở mức hàm thuần — **M-2**. | `#fact` về mã |
| `release_librarian` | Ngữ cảnh chỉ có bản chuẩn (`src/server/skill-context.ts`, `onlyApproved`). Tài liệu có bản trình mới hơn bản chuẩn → `SUBJECT_CHANGED` (hệ quả C7 đã nêu). Tài liệu có bản nhưng chưa có bản chuẩn → ngữ cảnh không có bản nào để nêu → luôn `SUBJECT_BASELINE_MISSING`. Vế sau là hệ quả của giữ chỗ OQ-53 (2) cộng C7; C7 không nêu đích danh — nên cho Chairman biết khi quyết OQ-53. Không ca nào ở mức `decide`. | `#inference` |
| `named > newest` | Không xảy ra: `named` là tập con của các bản của chính tài liệu. `revision_no` có `CHECK(revision_no > 0)` nên `named=0` chỉ có nghĩa «không nêu bản nào». | `#fact` (`migrations/014_document_registry.sql:33`) |

Kiểu trả về: `::int` cho cả hai cột nên là số ở cả `pg` và PGlite; so `===0` an toàn. `#inference`

### 2.2 Vị trí trong `decide`, khoá và chạy đua

- **Sau khoá dòng tài liệu, trong khoá lệnh, trước khi ghi gì.** Khoá `:251` → khoá lệnh `:257` → xét quyền `:259` → đã quyết `:263` → so hash `:264` → bước giữ `:271-292` (phép kiểm mới ở `:290`) → ghi `:296`, `:299`. Thứ tự của «Global Constraints» giữ nguyên. `#fact`
- **`ctx` khác rỗng kéo theo dòng tài liệu đã bị khoá thật.** Bộ dựng ngữ cảnh ném `SCOPE_DENIED` khi tài liệu không thuộc dự án, nên `subjectReasons` không bao giờ chạy cho một tài liệu mà câu khoá ở `:251` không khớp dòng nào. `#fact`
- **Mọi đường thêm bản lấy cùng khoá.** Trong `src` chỉ có **một** câu `INSERT INTO document_revisions`: `src/server/documents.ts:169`, sau `SELECT … FOR UPDATE` trên đúng dòng `document_records` ở `:156`. Không migration nào chèn bản. `register` tạo tài liệu chưa có bản. `#fact` (`git grep` tại `e90485b`)
- **Chạy đua với lệnh trình tay.** `scoped` mở giao dịch bằng `BEGIN` trần, tức mức cô lập mặc định. Ở READ COMMITTED, câu lệnh ở `:290` lấy ảnh chụp mới sau khi khoá được nhả, nên thấy bản bên kia vừa commit → `SUBJECT_CHANGED`. Nếu CSDL bị đặt REPEATABLE READ, câu khoá ở `:251` sẽ báo lỗi tuần tự hoá thay vì lặng lẽ đọc ảnh cũ: không có đường «lọt». `#inference`
- **Phép đọc mới không lấy khoá nào:** thứ tự khoá và nguy cơ khoá chéo không đổi. `#fact`

### 2.3 Từ chối, phát lại, câu lỗi, xử lý lỗi

- **Từ chối không bị chặn:** nhánh `rejected` không vào khối `confirmed`. `#fact`; D4 nửa đầu.
- **Phát lại không bị chặn:** `claimDocumentCommand` trả kết quả đã lưu mà không chạy thân (`src/server/document-commands.ts`, nhánh `!created`). `#fact`; D4 nửa sau.
- **Câu lỗi chỉ chứa mã:** vẫn là một câu duy nhất ở `:292`, ghép các mã đã sắp xếp. Helper `held` kiểm câu không chứa chuỗi dạng uuid. `#fact`
- **Ai thấy mã mới:** chỉ người đã qua phép xét quyền ở `:259`. Hai mã chỉ nói «tài liệu có bản» / «có bản mới hơn» — điều người ghi sổ tài liệu vốn đọc được. `#inference`
- **Xử lý lỗi:** không `catch` mới; lỗi CSDL lan ra và giao dịch lùi (E-BE-02). `#fact`
- **Không lỗi `22P02` thô:** tham số 1 và 2 là uuid do CSDL trả; tham số 3 đã lọc. `#fact`

### 2.4 Phạm vi dữ liệu, chỉ mục

- Câu lệnh có `project_id=$1`, chạy trong giao dịch `scoped` dưới role runtime; `document_revisions` có RLS theo tenant và dự án bằng biến đặt theo giao dịch (`migrations/014_document_registry.sql:119-121`). `decide` đã thu `app.project_ids` về đúng dự án của nháp trước đó (`:244`). `#fact`
- Chỉ mục: `UNIQUE(document_id, revision_no)` phục vụ phép lọc theo tài liệu; số dòng quét bằng số bản của một tài liệu. Không cần chỉ mục mới, không migration. `#fact`
- Vùng dữ liệu: đọc Z1 để quyết một lệnh ghi Z1 của chính nền tảng; không phải truy vấn báo cáo (AR-07, E-DB-10 không áp). AI không ghi gì (AR-03). `#fact`

### 2.5 Trùng lặp, đặt tên, chú thích, kích thước tệp

- Không trùng lặp mới: `namedIds` dùng lại `collect` và `ID_FIELDS`; `subjectReasons` dùng lại `UUID`.
- Chú thích khớp mã ở mọi điểm đã đọc (`:109-113`, `:119`, JSDoc của `decide` ở `:227-232` vẫn đúng). Hai ghi chú nhỏ ở M-4.
- `src/server/suggestions.ts` 311 dòng, một trách nhiệm (dịch vụ nháp AI); thêm 17 dòng không làm lệch. Task 6 sẽ thêm vào cùng hàm — chấp nhận được.

## Findings

| # | Mức | Tệp:dòng | Sai gì | Bằng chứng | Sửa thế nào |
|---|---|---|---|---|---|
| **I-1** | Important | `tests/suggestions.test.ts:473-475` (tên ca ở `:468`) | Nửa sau của D2 không chứng minh «a revision of another document is not a baseline». | Xem dưới. | Xem dưới. Chỉ sửa ca; mã sản phẩm giữ nguyên. |
| **M-1** | Minor | `tests/suggestions-concurrency.test.ts:78-95` | K3 phóng hai lệnh cùng lúc rồi rẽ nhánh theo bên thắng: mỗi lượt chỉ chạy **một** nhánh và không ghi nhánh nào đã chạy. Nhánh (iii) là bằng chứng native duy nhất cho «đọc sau khoá thấy commit của bên kia». | `#fact` về hình dạng ca (kế hoạch K3 định nghĩa đúng như vậy — builder làm đúng). Thứ tự chặn thật: `#hypothesis`. | Tách thành hai ca có dàn thứ tự như ca thứ hai cùng tệp (`waitForBlocked(h,1)` rồi `waitForBlocked(h,2)`): một ca cho trình tay vào hàng trước, một ca cho xác nhận vào hàng trước. Tối thiểu: ghi nhánh đã chạy ở từng lượt vào biên nhận. |
| **M-2** | Minor | `tests/suggestions.test.ts:455-507`; `src/server/suggestions.ts:115` | C6 («mốc tính trên mọi trường mã, không chỉ `sources`») chỉ được ghim ở mức hàm thuần (D6). Ở mức `decide`, cả D1–D5 dùng `technical_writer` và chỉ nêu mã qua `sources.*.id`; tệp không có ca `doc_reviewer` hay `release_librarian` nào đi qua `decide`. Thay `namedIds(…)` ở `:115` bằng phép đọc riêng `sources` thì D1–D5 vẫn xanh. | `#fact` (`git grep` tại `e90485b`: không có `doc_reviewer`/`release_librarian` trong `tests/suggestions.test.ts`); hướng hỏng là giữ oan, không phải lọt. | Một ca: nháp `doc_reviewer` nêu mã tài liệu ở `sources` và bản mới nhất **chỉ** ở `result.candidateRevisionId` → xác nhận được; cùng nháp nêu bản cũ ở đó → `SUBJECT_CHANGED`. |
| **M-3** | Minor | `tests/suggestions.test.ts:502-506`; `src/server/suggestions.ts:111` | Chú thích cam kết «never raises 22P02», và «Global Constraints» cấm lỗi `22P02` thô, nhưng không ca nào đưa một mã **sai dạng** qua `decide` của nháp tài liệu. D5 chỉ dùng chữ hoa — thứ PostgreSQL vẫn nhận. | `#fact` (mọi nháp tài liệu trong tệp nêu uuid hợp lệ hoặc chữ hoa). | Thêm một chuỗi tổng hợp sai dạng vào danh sách nguồn của D5; kỳ vọng giữ nguyên (`DRAFT_HELD`, không phải lỗi CSDL). |
| **M-4** | Minor | `src/server/suggestions.ts:107`, `:112`, `:115`, `:120` | (a) `named` mang hai nghĩa cạnh nhau: mảng mã ở TypeScript (`:115`) và số bản cao nhất được nêu ở SQL (`:107`, `:120`) — `r.named===0` dễ đọc nhầm thành «không nêu mã nào». (b) «The candidate branch is Task 6» trỏ số task của kế hoạch, sẽ cũ ngay khi Task 6 xong. | `#fact`. Tên do brief đặt — builder làm đúng brief. | Đổi bí danh SQL (ví dụ `named_no`) khi Task 6 sửa hàm; bỏ câu trỏ số task ở cùng lần đó. |
| **M-5** | Minor | `tests/suggestions.test.ts:81`; `tests/suggestions-concurrency.test.ts:20`, `:46` | Kế hoạch (H4, H5) ghi mặc định mới tồn tại **do giữ chỗ OQ-53 điểm 2, không do quyết định nào**, và «nếu OQ-53 điểm 2 được quyết khác thì xét lại». Tại chỗ không có dòng nào nói vậy; chỉ thông điệp commit nói. | `#fact`. | Một dòng chú thích nêu OQ-53 (2) ở helper `docDraft` và ở `setup`. |

### I-1 — chi tiết

**Sai gì.** Ca dựng A có r1, r2 và B có r1; nháp về A nêu `[A, A.r1, B.r1]`; khẳng định câu giữ chứa `SUBJECT_CHANGED`. Kết quả đó có được **chỉ nhờ A.r1** (bản số 1 < bản mới nhất số 2). B.r1 cũng là bản số 1, nên dù câu lệnh **có** tính bản của tài liệu khác làm mốc, `named` vẫn là 1 và ca vẫn xanh. `#inference` (đọc `DOC_SUBJECT_SQL` và cách dựng ca; chưa chạy đột biến).

Thêm nữa, nháp này đã bị giữ từ trước khi có mã: bản của tài liệu khác không nằm trong ngữ cảnh (bộ dựng chỉ lấy bản của chính tài liệu), nên `SOURCE_OUT_OF_CONTEXT` có sẵn. Log đỏ xác nhận: lỗi của D2 là «expected 'Nháp được giữ lại…' to contain 'SUBJECT_CHANGED'», không phải «expected a refusal». `#fact`

**Vì sao quan trọng.** Mục 8 của «Review Focus» kê «nêu bản của tài liệu khác» là một đường nháp cũ lọt qua và giao D1–D5 ghim nó; đây là ca duy nhất mang tên đó. Điều kiện `v.document_id=$2` của phép gộp `named` vì vậy **không có ca nào canh**. Đây cũng là ca âm tính gần nhất với phép kiểm cách ly (Quality Gate 34a) của câu lệnh đa tenant mới. Task 6 và quyết định OQ-53 sắp sửa lại đúng hàm này.

**Mức rủi ro thật hôm nay — thấp.** Mã hiện tại đúng. Và với mọi kỹ năng, bản của tài liệu khác không vào ngữ cảnh nên nháp như vậy vẫn bị giữ bởi `SOURCE_OUT_OF_CONTEXT`: không có đường xác nhận sai nào đang mở. Thứ thiếu là bằng chứng, không phải hành vi. `#inference`

**Lỗi này có từ brief**, không phải builder làm sai brief: brief viết đúng hình dạng «A có r1, r2 và B có r1».

**Sửa thế nào** (chỉ ca kiểm, là làm chặt chứ không nới):
- Cách gọn nhất: A chỉ có r1, B có ít nhất một bản; nháp về A nêu `[A, B.<bản>]` → kỳ vọng `DRAFT_HELD` chứa `SUBJECT_BASELINE_MISSING`. Cài đặt tính nhầm bản của B sẽ ra `named ≥ newest` và mất mã → ca đỏ.
- Hoặc giữ kỳ vọng `SUBJECT_CHANGED` của brief: cho B thêm r2 và nêu `[A, A.r1, B.r2]`.
- Nên thêm một biến thể **khác dự án** (tài liệu của dự án thứ hai trong fixture) cho đủ nghĩa 34a.

Phiên chính quyết sửa ngay hay gộp vào Task 6 (builder Task 6 đang sửa cùng tệp).

## Đã xét, không thành finding

- **Nhánh mở `newest===0`.** Nếu phép đọc không thấy bản nào thì không giữ. Dưới một ngữ cảnh RLS thiếu, nhánh này sẽ mở; nhưng không tới được: không có ngữ cảnh thì `decide` đã trả 404 ở bước định vị nháp (`:241-242`). `#inference`
- **`named` được tính trước khi biết loại đối tượng** (`:115` trước `:116`): thừa một phép tính cho nháp ứng viên ở commit này; Task 6 dùng nó.
- **`subjectReasons` nhận `projectId` riêng dù dòng nháp có `project_id`:** cùng kiểu với `contextFor` và `threadHasHiddenText`.
- **Kiểu `Promise<string[]>` thay vì một kiểu hợp:** theo đúng giao diện của brief; tập lý do của `decide` vốn là `Set<string>`.
- **Số ca:** PGlite 195 đạt + 1 bỏ qua trong 5 tệp (`task-5-green.txt`); cộng 3 ca của tệp concurrency và ca native đang bỏ qua thì ra 199, khớp con số phiên chính nêu. `#inference`
- **Thông điệp commit:** đúng dạng `<type>(<scope>): <mô tả>`; nêu rõ đây là giữ chỗ fail-closed, không phải phương án được chọn; không tệp nào ngoài năm tệp.

## 3. ⚠️ Không kiểm được từ diff

| # | Điều chưa kiểm | Phiên chính nên kiểm |
|---|---|---|
| ⚠️1 | Lượt PostgreSQL 16 (199 ca đạt, 0 bỏ qua; `suggestions-concurrency` ba lượt) và `npm run typecheck` thoát 0: reviewer **không thấy log**. Chỉ thấy `task-5-red.txt` và `task-5-green.txt` (PGlite). Với reviewer đây là `#hypothesis`. | Lưu log native và log typecheck (đã che đường dẫn máy) vào thư mục bằng chứng trước cổng kế tiếp. H5 và K3 chỉ có bằng chứng ở log đó. |
| ⚠️2 | K3: ở ba lượt native, nhánh nào đã chạy. Nếu cả ba lượt cùng một nhánh thì nhánh kia chưa từng được quan sát. | Xem M-1: tách hai ca có dàn thứ tự, hoặc ghi nhánh của từng lượt. |
| ⚠️3 | I-1 là suy luận từ đọc mã. | Chạy một đột biến tạm, không commit: cho phép gộp `named` bỏ điều kiện tài liệu rồi chạy nhóm D. Nếu D1–D5 vẫn xanh thì I-1 được xác nhận. |
| ⚠️4 | Độ phủ: không log nào của task đo. Ngưỡng ≥ 60% logic miền, ≥ 40% API và việc CI có chặn hay không chưa được kiểm ở task này. | Đo ở mức PR; khi so, đối chiếu từng dòng theo tệp. |
| ⚠️5 | Mức cô lập giao dịch mặc định của CSDL đích. `scoped` không ghim READ COMMITTED; lập luận chạy đua ở 2.2 dựa vào mặc định của PostgreSQL. | Ghi nhận trong danh sách «trước khi bật Z4»; không cần đổi mã ở task này. |
| ⚠️6 | Review đọc mã tại `e90485b`. Builder Task 6 đang sửa `src/server/suggestions.ts` và các tệp test trong working tree. | Mọi số dòng trong báo cáo là của `e90485b`. |

## Đối chiếu Quality Gate (các dòng áp cho diff này)

| Dòng | Kết quả |
|---|---|
| 02 lỗi không bị nuốt (E-BE-02) | Đạt |
| 06 xét quyền tại cửa vào (E-BE-06) | Đạt — phép kiểm mới nằm sau phép xét quyền |
| 12 đổi lược đồ qua migration (E-DB-04) | Không áp — không đổi lược đồ |
| 16 chỉ mục cho mẫu truy vấn mới (E-DB-08) | Đạt — dùng `UNIQUE(document_id, revision_no)` có sẵn |
| 17 báo cáo không đọc Z1 (E-DB-10) | Không áp — không phải truy vấn báo cáo |
| 26 nhiều lần ghi trong một giao dịch (E-INT-04) | Đạt — không đổi |
| 31 không lộ dữ liệu thô (E-SEC-01) | Đạt — chỉ mã lý do |
| 34a cách ly, chiều đọc (E-TEST-01) | **Chưa đủ bằng chứng** cho câu lệnh mới — I-1 |
| 35 kiểm logic miền (E-TEST-02) | Có ca; độ phủ chưa đo — ⚠️4 |
| 45 AI chỉ ghi Z4 (E-AI-04) | Đạt — không đổi |
| Tiêu đề và mô tả commit | Đạt |

## Kết

Mã của Task 5 làm đúng brief và đúng định nghĩa B5: bốn nhánh của `subjectReasons` khớp chữ, câu lệnh lọc đúng tài liệu và dự án, phép đọc chạy dưới khoá dòng tài liệu mà mọi đường thêm bản cũng lấy, trước mọi lần ghi; từ chối và phát lại không đi qua nó; câu lỗi chỉ có mã. H4 và H5 là đổi hạ tầng; K3 là đổi kỳ vọng vì quyết định và không nới. Chỗ phải sửa là bằng chứng: nửa sau của D2 xanh nhờ bản cũ của chính tài liệu, nên điều kiện «bản của tài liệu khác không làm mốc» chưa có ca nào canh — một lỗi có từ brief, sửa bằng vài dòng ở ca kiểm. Năm mục Minor không chặn. Lượt native và typecheck là lời khai reviewer chưa thấy log.

**Đúng yêu cầu: Đạt.**

**Task quality: Needs fixes** (chỉ ca kiểm — I-1; mã sản phẩm không cần đổi).
