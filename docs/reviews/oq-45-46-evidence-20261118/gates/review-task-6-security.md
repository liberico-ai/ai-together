# Review bảo mật theo task — Task 6 (OQ-46 (b) cho luồng tin; giữ chỗ OQ-53)

- Loại: review theo task, **không** phải review merge. Vai: `liberico-security-reviewer` (chỉ tìm và xếp hạng; không sửa, không phê duyệt).
- Phạm vi: `e90485b..5013f75`, một commit, năm tệp: `src/server/source-text.ts`, `src/server/suggestions.ts`, `tests/slice3-fixtures.ts`, `tests/source-text.test.ts`, `tests/suggestions.test.ts`.
- Cách làm: chỉ đọc. Đọc tệp diff một lần; `#fact` các dòng thêm/bớt của gói review trùng từng dòng với `git diff e90485b 5013f75` (188 dòng, so bằng `cmp`). Mọi dòng mã ngoài diff đọc **từ commit `5013f75`** (`git show`, `git grep <mẫu> 5013f75`). Không chạy test, không nối CSDL, không đọc `.env*`/`.runtime/`, không in dòng lệnh tiến trình. **Mọi số dòng dưới đây là số dòng tại `5013f75`.**
- Nhãn: `#fact` = đọc được ở dòng nêu; `#inference` = suy ra từ các `#fact` (không chạy); lời khai của builder và của phiên chính được ghi là lời khai.
- Không finding nào chạm hệ thống vận hành IBS HI. `IBS_HI` ở đây là nhãn miền của dự án trong LibeTech AI OS (`AGENTS.md:16`).

## Bước 0 — quét bí mật

- `#fact` Tên tệp được theo dõi khớp `.env|secret|credential|token|.pem|.key`: không có. `.superpowers/` bị bỏ qua (`.gitignore:30`).
- `#fact` Các dòng thêm của diff: không chuỗi kết nối, không JWT, không khoá API, không `console.`/`logger.`. Chuỗi số dài duy nhất là một mốc thời gian tổng hợp trong fixture (`tests/source-text.test.ts:205`), cùng giá trị với helper có sẵn ở `:142`. Fixture dùng `randomUUID()` và chuỗi đánh dấu tổng hợp (`T6-MARKER-4417`, `T7-…`, `T8-…`).
- `#fact` Hai log đỏ/xanh và báo cáo của builder không chứa đường dẫn thư mục máy (đếm chuỗi thư mục nhà: 0).
- Kết quả: sạch.

## Phán quyết 1 — đúng yêu cầu: **đạt**

### Đối chiếu brief → mã

| Yêu cầu | Mã | Kết quả |
|---|---|---|
| `ThreadFreshness`, chữ ký `threadFreshness(tx, projectId, candidateId, namedIds)` | `src/server/source-text.ts:95`, `:104` | `#fact` khớp chữ |
| Câu lệnh: CTE `thread` (nối `project_id`, `chat_id`, `thread_key`), `base` = `max(created_at)` của tin được nêu, ba cột đúng/sai | `:109-117` | `#fact` trùng từng mệnh đề với brief |
| `candidateId` không phải uuid chữ thường → ba `false`, không chạy câu lệnh | `:106` | `#fact` khớp; builder kiểm thêm `projectId` (cùng quy ước với `threadHasHiddenText:85`) — nằm trong ý của giao diện, không tính là thừa |
| Mảng mã đã lọc uuid chữ thường trước khi vào `::uuid[]` | `:107` (và `src/server/suggestions.ts:115`) | `#fact` lọc hai lần, cùng biểu thức |
| Không điều kiện `tenant_id` riêng; chú thích nói rõ ranh giới là RLS | `:102` | `#fact` |
| Nhánh ứng viên của `subjectReasons`: `!hasBaseline` → `SUBJECT_BASELINE_MISSING`; ngược lại `SUBJECT_CHANGED` / `SUBJECT_EDIT_UNVERIFIED`; chú thích nêu OQ-53 | `src/server/suggestions.ts:116-122` | `#fact` khớp chữ |
| `suggestions.ts` không viết tên bảng bản sửa, kể cả chú thích | `git grep` tại `5013f75`: hai chuỗi `source_event_revisions`, `text_excerpt` chỉ có ở `src/server/intake.ts` và `src/server/source-text.ts` | `#fact` |
| Vị trí trong `decide`: trong `if(ctx)`, sau `checkSkillOutput` và sau `THREAD_TEXT_HIDDEN` | `src/server/suggestions.ts:291-297` (lời gọi `:296`) | `#fact` không đổi so với Task 5; nhánh mới đi qua cùng lời gọi |
| Helper `nextDbInstant` | `tests/slice3-fixtures.ts:137-143` | `#fact` khớp mô tả |
| Việc thêm: sửa chú thích `latestDomainSql` | `src/server/source-text.ts:17` | `#fact` câu «The one place that reads it.» đã bỏ; tên hàm `intelligence.ai_drafts_pointer_only_guard()` đúng với `migrations/022_ai_drafts_pointer_only_guard.sql:13`, và hàm đó áp cùng luật (`:17-20`) |
| Ca T1–T8 | xem bảng dưới | `#fact` đủ tám ca, tên trùng brief |

Thiếu: không. Thừa: không. Hiểu sai: không. Ba nhánh giữ chỗ được viết đúng như kế hoạch tả, không tự đổi sang phương án khác của OQ-53.

### Từng ca có khẳng định điều tên ca nói không

| Ca | Dòng | Nhận xét |
|---|---|---|
| T1 | `tests/suggestions.test.ts:1122-1133` | `#fact` Khẳng định đủ bốn điều tên ca nói: `DRAFT_HELD` chứa `SUBJECT_CHANGED`, không chứa `SUBJECT_EDIT_UNVERIFIED`; không dòng quyết định; số dòng `document_commands` không đổi; nháp mới nêu cả hai tin được xác nhận **với cùng khoá** (vân tay của khoá gồm mã nháp, nên nếu khoá còn bị giữ thì lần hai là `IDEMPOTENCY_CONFLICT`). `#inference` Không phụ thuộc đồng hồ: tin trả lời ghi sau, và phép so là `>=` |
| T2 | `:1135-1142` | `#fact` Có `nextDbInstant` giữa tin gốc và tin trả lời; nháp chỉ nêu tin trả lời → xác nhận. Không rỗng: nếu giữ oan thì đỏ |
| T3 | `:1144-1161` | `#fact` Ba phần (i), (ii), (iii) đúng như tên ca; (i) và (ii) còn khẳng định **không** có `SUBJECT_CHANGED`; (iii) có `nextDbInstant` giữa bản sửa và tin trả lời. `#fact` Ba ứng viên là ba luồng riêng (mỗi tin không phải tin trả lời có `thread_key` riêng: `src/server/intake-rules.ts:5-9`) |
| T4 | `:1163-1173` | `#fact` Hai kịch bản: chỉ nêu tài liệu; nêu tin của luồng khác (thêm `SOURCE_OUT_OF_CONTEXT`). Mã `SUBJECT_BASELINE_MISSING` chỉ sinh ở đúng nhánh mới, nên phép `toContain` không luôn-đúng. Kịch bản hai đồng thời ghim phép nối theo `thread_key` |
| T5 | `:1175-1186` | `#fact` Từ chối nháp đang bị giữ → `rejected`; phát lại sau khi có tin mới → `toEqual(first)` và đúng một dòng quyết định. Xanh từ trước khi có mã (builder khai; đúng với nhánh `rejected` và đường phát lại không chạy bước giữ): là ca chống hồi quy, không phải bằng chứng đỏ→xanh |
| T6 | `tests/source-text.test.ts:207-217` | `#fact` Đúng một dòng có khoá `has_baseline`, đúng ba khoá; toàn bộ dòng được trao không chứa chuỗi đánh dấu và không chứa hash. Phép «không chứa hash» **không rỗng**: fixture đặt `contentHash` = sha256 của chữ (`tests/slice2-fixtures.ts:45`), tin được nhận ở chế độ lưu chữ |
| T7 | `:219-236` | `#fact` Đủ mọi dòng brief liệt kê, có đối chứng dương trong cùng ca. Dòng `:232` ghim cả hai: `'x'` lọt qua sẽ là `22P02`, mã chữ hoa lọt qua sẽ khớp tin gốc và cho `hasBaseline:true`. Hai chỗ yếu: xem M1 (b), (c) |
| T8 | `:238-243` | `#fact` Cùng dự án, cùng mã, phạm vi tenant khác → ba `false`; đối chứng dương ở dòng kế (`hasBaseline:true`, `laterEdit:true`) |

**`nextDbInstant` có bảo đảm điều nó nói không.** `#inference` Có, trên cả hai máy CSDL, với hai điều kiện đều đúng ở mọi chỗ gọi: (1) các lần ghi «trước» đã commit xong trước khi gọi (mọi chỗ gọi đều `await`); (2) đồng hồ máy chủ CSDL không lùi. Lập luận: `now()` là lúc bắt đầu giao dịch; dòng ghi trước có `created_at` ≤ giá trị `start` mà helper đọc; helper chỉ trả về khi đọc được một giá trị khác `start`, tức lớn hơn; giao dịch bắt đầu sau đó có `now()` ≥ giá trị ấy. Trên PGlite (mili giây) vòng lặp chờ thật; trên PostgreSQL thật (micro giây) lần đọc thứ hai đã khác. Helper không giả định tốc độ máy. Không ca nào trong T1–T8 dựa vào «hai dòng **cùng** thời điểm» hay «đủ nhanh»: ca nào cần thứ tự chặt đều gọi helper, ca còn lại dựa vào `>=` nên xanh ở mọi độ phân giải.

### Ca hiện có bị sửa hay nới

`#fact` Không. Tám dòng bị bớt của diff là: bốn dòng `import` được mở rộng, một dòng chú thích `latestDomainSql`, một dòng `import` ở `suggestions.ts`, một dòng chú thích và dòng `return []` của nhánh ứng viên cũ. Hai ca quét (`tests/source-text.test.ts:130-137`) không đổi.

## Phán quyết 2 — an toàn và chất lượng: mã an toàn; **một Important ở ca kiểm**, bốn Minor

### Điều review Task 4a/4b yêu cầu kiểm lại ở Task 5/6

`#fact` tại `5013f75`: nhánh không có quyền vẫn đứng đầu `present` (`src/server/suggestions.ts:194`); `toView` chỉ được gọi ở `:194` và `:212`; `THREAD_TEXT_HIDDEN` còn ở bước che (`:208-211`) và bước giữ (`:295`); không câu lệnh nào đọc cột `sources`; các ca M1–M9, Q1–Q9 không nằm trong diff.

### Câu SQL của `threadFreshness` (`src/server/source-text.ts:109-117`)

- **Phạm vi dự án.** `#fact` Ba mệnh đề `c.project_id=$1`, `e.project_id=$1`, `r.project_id=$1`; tham số hoá toàn bộ.
- **Phạm vi tenant.** `#fact` Do RLS: cả ba bảng `ENABLE` + `FORCE` (`migrations/016_intake_inbox.sql:141-148`); policy `runtime_select` so `tenant_id` và `project_id` với ngữ cảnh giao dịch (`:161-164`, `:174-177`, `:202-205`); ngữ cảnh đặt bằng `set_config(…, true)` sau `SET LOCAL ROLE libetech_runtime` (`src/server/db.ts:49-56`), tức theo giao dịch, không rò qua pool. `decide` còn thu phạm vi về đúng dự án của nháp trước khi đọc (`src/server/suggestions.ts:250`). Thiếu ngữ cảnh → policy cho `NULL` → không dòng nào → `hasBaseline:false` → giữ. Ca T8 ghim chiều tenant.
- **Logic ba trị khi không có mốc.** `#fact` `base` là một phép gộp không `GROUP BY` nên luôn đúng một dòng; không tin nào được nêu → `at` là `NULL` → `has_baseline` là `false` (không phải `NULL`), hai `EXISTS` cho `false` vì `>= NULL` không bao giờ đúng. Dịch vụ xét `hasBaseline` **trước** (`src/server/suggestions.ts:119`), nên hai `false` ấy không bao giờ được đọc thành «luồng không đổi». Mảng rỗng đã lọc không chứa `NULL`, nên `NOT (id = ANY(…))` không rơi vào `NULL`.
- **`>=`.** `#fact` Cả hai phép so đều `>=` (P8). Tin của chính mốc không tự giữ mình vì đã bị loại bằng «không được nêu»; bản 1 của tin không tính vì `revision_no>1`. So sánh diễn ra hoàn toàn trong CSDL giữa hai cột `timestamptz`: không vòng qua `Date` của Node, không mất phần micro giây.
- **Tin của luồng khác, dự án khác.** `#fact` Mã không thuộc luồng không khớp dòng nào của `thread`: không làm mốc, không bị coi là tin mới. Câu lệnh không tra mã lạ ở đâu ngoài luồng, nên **không** thành phép dò «mã này có tồn tại không» với mã của dự án hay tenant khác.
- **Một câu lệnh, một ảnh chụp.** `#inference` Mốc và hai phép so nằm trong cùng một câu lệnh nên không có khe giữa «tính mốc» và «so với mốc». Câu này là lần đọc cuối trước lệnh ghi quyết định: tin commit giữa lúc dựng ngữ cảnh và lúc này vẫn bị thấy.
- **Thứ trả về.** `#fact` Ba giá trị đúng/sai (T6). Không chữ, không hash, không mã, không thời điểm.
- **Dòng thiếu.** `#fact` `row?.…===true` (`:118`): thiếu dòng cho `hasBaseline:false`, tức giữ. Đúng hướng mà N1 của review 4a/4b yêu cầu cho hàm này.

### Một nháp có lọt qua phép giữ không

| Kịch bản | Kết quả theo mã | Căn cứ |
|---|---|---|
| Nêu tin cũ và tin mới nhất | Không giữ — đúng mốc Chairman chọn (thứ nháp **nêu**, C6) | `#fact` `:113` |
| Nêu tin mới nhất, bỏ một tin ở giữa ghi trước mốc | Không giữ — đúng định nghĩa B5; T2 ghim | `#fact` `:115` |
| Nêu mã sai dạng, mã chữ hoa | Không tính là đã nêu → `SUBJECT_BASELINE_MISSING` nếu không còn mã nào | `#fact` `:107`; T7 `:232` |
| Nêu tin của luồng khác, của dự án khác | Không làm mốc → `SUBJECT_BASELINE_MISSING` (kèm `SOURCE_OUT_OF_CONTEXT`) | T4 |
| Không nêu gì; giá trị lệch hợp đồng | `namedIds` cho `[]` → `SUBJECT_BASELINE_MISSING` (kèm `SOURCE_REQUIRED` / `SCHEMA_INVALID`) | `#fact` `src/server/skill-contracts.ts:121-123` |
| Bản sửa ghi trước mốc | Không giữ; T3 (iii) ghim | `#fact` `:117` |
| Bản sửa ghi từ mốc trở đi, của **bất kỳ** tin nào của luồng | Giữ `SUBJECT_EDIT_UNVERIFIED` | `#fact` `:116-117` không lọc theo tin được nêu. **Chưa có ca ghim cho tin không được nêu: I1 (b)** |
| Tin đến muộn có `observed_at` cũ | Giữ: phép so dùng `created_at`, cột mặc định `now()` mà role nhận tin không đặt được (quyền chèn theo cột không gồm `created_at`: `migrations/016_intake_inbox.sql:250-251`), và hai bảng bất biến (`:234-237`) | `#fact`. **Chưa có ca ghim: I1 (a)** |
| `observed_at` sai về tương lai | Không ảnh hưởng: cột đó không được đọc | `#fact` `:110` |
| Gateway gửi lại đúng một bản đã có | Không sinh bản mới (`ON CONFLICT … DO NOTHING`), không giữ | `#fact` `src/server/intake.ts:89-93` |
| Bản đến sau của cùng tin với khoá bản khác (sửa chữ, đổi tệp, bản gốc đến sau bản sửa) | Bản số > 1 → giữ; hướng chặt | `#fact` `src/server/intake.ts:61`, `:91` |
| Đối tượng không phải tài liệu, không phải ứng viên (nếu sau này có) | Rơi vào nhánh ứng viên → không tìm thấy luồng → giữ | `#fact` `src/server/suggestions.ts:116` |
| Ứng viên bị đổi `chat_id` / `thread_key` sau khi có nháp | Không làm được: role runtime không có quyền sửa hai cột đó | `#fact` `migrations/016_intake_inbox.sql:258` |

`#inference` Dưới giả định mà mốc của Chairman kéo theo — pipeline nêu tin mới nhất nó đã đọc — mọi tin và mọi bản sửa commit sau lúc đọc đều có thời điểm ghi ≥ mốc, trừ khe R6. Không tìm thấy đường lọt nào khác ngoài R6. Bên ghi không trung thực (nêu tin nó không đọc) nằm ngoài mô hình: bên đó luôn ghi được một nháp mới.

### Chạy đua với đường nhận tin — R6 tả có đúng kích thước không

`#fact` Phép kiểm không lấy khoá (P7). Đường nhận tin không khoá dòng ứng viên: nó chèn `ON CONFLICT … DO NOTHING` rồi đọc lại (`src/server/intake.ts:113-118`); khoá tư vấn ở `:87` là theo **từng tin**, không theo luồng. Một khoá ở phía xác nhận vì vậy không xếp hàng được với nó: P7 đúng.

`#inference` R6 tả **đúng loại và đúng cỡ**: thời điểm ghi là lúc bắt đầu giao dịch nhận tin, khe hở dài bằng thời gian giao dịch đó còn mở, tin lọt qua không bao giờ bị phát hiện; tin commit giữa phép kiểm và lúc commit của lệnh xác nhận tương đương «đến ngay sau khi xác nhận». Bốn chỗ nên viết rõ hơn (M4): trần 10 giây là của **mỗi câu lệnh**, không phải của khe hở; album làm đảo thứ tự bắt đầu/commit là chuyện thường, không cần sự cố; bản sửa có cùng khe hở; và dấu vết kiểm toán.

### Từ chối, phát lại, câu `DRAFT_HELD`, mã lý do mới

- `#fact` Nhánh `rejected` không chạy bước giữ (`src/server/suggestions.ts:272-275`, bước giữ nằm trong `if(input.result==='confirmed')` ở `:277`). Phát lại trả kết quả đã lưu của khoá lệnh, không chạy lại thân. T5 ghim cả hai.
- `#fact` Ném trong thân của khoá lệnh → cả giao dịch lùi: không dòng quyết định, khoá còn tự do (T1).
- `#fact` Câu `DRAFT_HELD` ghép từ tập mã hằng, đã sắp xếp (`:298`); helper `held` khẳng định không có dạng uuid trong câu (`tests/suggestions.test.ts:107`).
- `#inference` Mã mới không cho người gọi biết điều họ không được biết. Tới được bước giữ là đã qua phép xét quyền (`:265-268`, đứng đầu thân khoá lệnh): với nháp ứng viên đó là điều phối của chính dự án. Ba mã chỉ nói về luồng của ứng viên trong dự án đó (có tin mới, có bản sửa, nháp không nêu tin của luồng) — những điều hộp thư của dự án đã cho họ thấy. Người điều phối không chọn được các mã nháp nêu (chỉ role AI ghi nháp), và role AI không gọi `decide`: không ai dùng được phép giữ làm phép dò.
- `#fact` `list` không gọi `threadFreshness` (P9); người không có quyền quyết định không gây câu đọc này.

## Findings

Không có Critical. Một Important. Bốn Minor.

| # | Mức | Vị trí | Lớp | Kịch bản | Sửa thế nào | Vai thực hiện |
|---|---|---|---|---|---|---|
| I1 | Important | `tests/source-text.test.ts:219-236`, `tests/suggestions.test.ts:1122-1161`; mã được ghim: `src/server/source-text.ts:110`, `:115-117` | hai đường «nháp cũ lọt qua» không có ca ghim | **(a) Đồng hồ nào (C5).** Kế hoạch nói «được ghi» tính theo `created_at`, không theo `observed_at`: «một tin đến muộn từ hàng chờ có `observed_at` cũ vẫn là tin mới của luồng». `#fact` Mọi fixture đặt `observedAt` tăng theo thứ tự tạo (`tests/slice2-fixtures.ts:44`), nên trong cả T1–T8 thứ tự theo hai đồng hồ trùng nhau. `#inference` Một lần sửa cho phép so **tin** dùng `observed_at` (giữ `created_at` cho bản sửa) — ví dụ khi ai đó «căn» thứ tự với `visibleThreadMessages`, hàm mà chú thích ở `:97` tự dẫn chiếu — để **toàn bộ** ca xanh, và khi đó một tin tồn trong hàng chờ (đúng trường hợp `spooled`) không còn giữ nháp. **(b) Bản sửa của tin nào.** B5 nói «bản sửa của bất kỳ tin nào của luồng». `#fact` Ở T3, T7, T8 tin bị sửa luôn là tin được nêu. `#inference` Một lần sửa thu `later_edit` về «tin được nêu» để toàn bộ ca xanh; khi đó: tin gốc, tin trả lời, nháp chỉ nêu tin trả lời, rồi tin gốc bị sửa → nháp dựng trên chữ cũ được xác nhận. Mã hôm nay đúng ở cả hai điểm; thứ thiếu là bằng chứng giữ nó đúng. Thiếu sót nằm ở danh sách kịch bản của brief, không phải builder làm lệch brief | Chỉ đổi tệp test, không đổi `src`. (a) Thêm một ca ở nhóm `threadFreshness`: tin gốc; `nextDbInstant`; một tin trả lời có `observedAt` **sớm hơn** tin gốc một giờ (ghi đè `observedAt` của `messageEvent`) → nêu tin gốc: `newerMessage:true`; nêu tin trả lời: `{true,false,false}`. (b) Thêm một dòng sau `:230`: `ask(ids.sales,r.id,[rp])` → `{hasBaseline:true,newerMessage:false,laterEdit:true}`. Nên thử một lần đột biến cho mỗi điểm và ghi vào báo cáo | Builder |
| M1 | Minor | `src/server/source-text.ts:106`, `:112`, `:115`, `:117`; `tests/source-text.test.ts:231`, `:233-235` | ca kiểm thiếu (bốn phép sửa sai vẫn để mọi ca xanh) | `#inference` (a) **Trùng thời điểm (P8):** đổi `>=` thành `>` không làm ca nào đỏ một cách chắc chắn — không ca nào có hai dòng cùng `created_at`. (b) **Điều kiện dự án của chính câu lệnh:** dòng `:231` hỏi dưới phạm vi chỉ có dự án kia, nên RLS đã trả rỗng; bỏ `c.project_id=$1`/`e.project_id=$1` vẫn xanh. (c) **`projectId` sai dạng:** lối tắt ở `:106` chỉ được thử với `candidateId`. (d) **Không trần:** mọi luồng trong T1–T8 có tối đa hai tin; thêm trần «20 tin mới nhất theo `observed_at`» vào `thread` vẫn xanh, và khi đó tin đến muộn nằm ngoài cửa sổ không còn giữ nháp | (a) Một ca chèn hai dòng `source_events` cùng luồng trong **một** giao dịch của login vận hành (cùng `now()`), nêu một dòng → `newerMessage:true`. (b) `ask(ids.transport,r.id,[r.sourceEventId],{...pm,projectIds:[ids.sales,ids.transport]})` → ba `false`. (c) `threadFreshness(trap,'x',r.id,[])` → ba `false`. (d) Một ca luồng dài hơn 20 tin, rồi nhận một tin đến muộn có `observedAt` cũ hơn mọi tin; nêu **mọi tin trừ tin đến muộn** → `newerMessage:true` (nếu chỉ nêu tin gốc thì các tin trả lời đã đủ làm phép so đúng, ca không ghim được gì) | Builder |
| M2 | Minor | `src/server/source-text.ts:96-103` | chú thích thiếu tiền điều kiện (N1 (b) của review 4a/4b, «áp cùng quy ước cho `threadFreshness`») | `#fact` Mã sai dạng, ứng viên không thấy được và «không có mốc» cùng cho ba `false`. Đọc riêng `newerMessage:false`, `laterEdit:false` thì giống «luồng không đổi». Nơi gọi duy nhất xét `hasBaseline` trước nên hôm nay đúng; chú thích không nói điều đó, cũng không nói `tx` phải là giao dịch đã đặt phạm vi dưới role runtime (với một handle bỏ qua RLS, câu lệnh không còn ranh giới tenant) | Thêm hai câu: «`hasBaseline:false` cũng là câu trả lời cho mã sai dạng và ứng viên không thấy được; khi đó hai trường còn lại không có nghĩa và nơi gọi phải giữ nháp» và «`tx` phải là giao dịch đã đặt phạm vi (`scoped`)». Không đổi hành vi | Builder |
| M3 | Minor | `docs/plans/oq-45-46-ai-drafts.md` mục R8, R12; `docs/OPEN-QUESTIONS.md` mục OQ-53 | phần dư ghi thiếu: giữ oan do hai đồng hồ và trần ngữ cảnh | `#inference` (i) Ngữ cảnh trao cho pipeline `observedAt` của từng tin, không trao thời điểm ghi (`src/server/skill-contracts.ts:12`); pipeline vì vậy **không biết** tin nào được ghi sau cùng. Nháp chỉ chắc chắn xác nhận được khi nêu **mọi** tin của luồng có trong ngữ cảnh (ví dụ ba ảnh của một album; hay một tin cũ đến muộn). (ii) Luồng dài hơn 20 tin có một tin đến muộn nằm ngoài cửa sổ ngữ cảnh (cửa sổ xếp theo `observed_at`: `src/server/source-text.ts:70`): nháp không nêu nó thì `SUBJECT_CHANGED`, nêu nó thì `SOURCE_OUT_OF_CONTEXT`; không nháp nào xác nhận được cho tới khi luồng có tin mới hơn. (iii) Tin ghi sau cùng được lưu ở chế độ chỉ con trỏ: nêu thì `TEXT_NOT_VISIBLE`, không nêu thì `SUBJECT_CHANGED`. Cả ba là hướng chặt, không phải lỗ hổng; R12 chỉ kể hai kiểu giữ oan của giữ chỗ OQ-53, R8 chỉ kể «nêu nguồn ngoài trần» | Planner thêm ba dòng vào phần dư và vào biên nhận; ghi vào điều kiện của hợp đồng/prompt pipeline sau này: «nêu mọi tin của luồng có trong ngữ cảnh». Không đổi mã ở PR này (`skill-context.ts` không được đổi) | Planner |
| M4 | Minor | `docs/plans/oq-45-46-ai-drafts.md` mục R6; `docs/OPEN-QUESTIONS.md` mục OQ-53 (đoạn «Khe hở của mọi mốc tính bằng thời điểm ghi») | chữ của phần dư cần chính xác hơn | `#fact` (i) Trần 10 giây là của mỗi câu lệnh (`src/server/db.ts:32`); giao dịch nhận tin có ít nhất tám câu lệnh và ba chỗ có thể chờ (`src/server/intake.ts:76-80`, `:87`, `:113-115`); `src` không đặt trần nào cho cả giao dịch. `#inference` Khe hở vì vậy không có trần 10 giây. (ii) Các tin đầu của một luồng đến cùng lúc (album) chờ nhau ở lệnh chèn ứng viên; giao dịch bắt đầu trước có thể commit sau — đảo thứ tự là chuyện thường của album, không cần sự cố. (iii) Bản sửa có cùng khe hở (`migrations/016_intake_inbox.sql:65`; hàng chờ ở `src/server/intake.ts:87`). (iv) Tin mà giao dịch nhận đã bắt đầu nhưng chưa commit lúc xác nhận sẽ mang `created_at` **sớm hơn** `created_at` của quyết định: người đọc sổ sau này có thể hiểu nhầm là người xác nhận đã có tin đó | Planner sửa chữ R6 và đoạn tương ứng của OQ-53; chép (iv) vào biên nhận | Planner |

## ⚠️ Không kiểm được từ diff — phiên chính nên kiểm

1. ⚠️ **Lượt PostgreSQL 16 là lời khai.** Tôi không chạy lại. Log xanh trong thư mục task là lượt PGlite (196 đạt, 2 bỏ qua); con số 201 đạt, 0 bỏ qua trên PostgreSQL thật là lời phiên chính. Nên giữ log của lượt đó trong thư mục bằng chứng, có tên ba ca T6–T8 (RLS dưới role runtime thật là thứ T8 dựa vào).
2. ⚠️ **Các phép đột biến ở I1 và M1 là suy luận, chưa chạy.** Khi builder thêm ca, nên chạy mỗi đột biến một lần và ghi kết quả đỏ vào báo cáo.
3. ⚠️ **I1 và N1–N3 của review Task 4a/4b chưa có trong `5013f75`.** `#fact` Ca Q5 (`tests/source-text.test.ts:144-160`) và dòng `row?.hidden===true` (`src/server/source-text.ts:92`) còn nguyên; `tests/source-text.test.ts` không đổi giữa `1f4961f` và `e90485b`. Nếu vòng sửa đó đã được xếp lịch thì gộp I1/M1/M2 ở đây vào cùng vòng.
4. ⚠️ **Kế hoạch thực thi trên luồng dài chưa đo.** CTE `thread` được dùng ba lần; chỉ mục cần dùng có sẵn (`migrations/016_intake_inbox.sql:122`, `:126`); trần 10 giây mỗi câu lệnh làm lỗi lan ra — đóng. Nên có một lần `EXPLAIN` trên PG16 trước khi bật Z4 (việc của review CSDL).
5. ⚠️ **Kích thước thật của khe R6 phụ thuộc cấu hình triển khai** của login nhận tin (trần giao dịch, `idle_in_transaction_session_timeout` ở phía máy chủ): không có trong repo.
6. ⚠️ **Vai lấy từ phiên** (R7) và **`excerptChats` chụp lúc dựng dịch vụ** (R9): không đổi ở task này, vẫn chưa kiểm được vì chưa tuyến nào dựng dịch vụ (`git grep` tại `5013f75`: không nơi nào trong `src` dựng `SuggestionService`).
7. ⚠️ **Tài liệu sẽ lệch sau commit này:** `docs/OPEN-QUESTIONS.md` mục OQ-46 và khối quyết định còn ghi «chưa có mã cho quyết định này». Thuộc task tài liệu/biên nhận, không thuộc Task 6.
8. ⚠️ **Chưa kiểm:** `npm run typecheck` (lời khai: thoát 0), lint, ngưỡng coverage. `#inference` Hàm mới thêm vài nhánh không tới được (`row?.`) và một nhánh chưa có ca (`projectId` sai dạng, M1 (c)): nên xem dòng của `source-text.ts` trong bảng coverage.
9. Bản sao iCloud: `#fact` lúc soát không có tệp tên dạng `<tên> 2.<đuôi>` dưới `src`, `tests`, `migrations`, `docs/reviews`. Chỉ đúng tại thời điểm đó.

## Ba việc đòn bẩy cao nhất

1. I1 — hai kịch bản: tin đến muộn có `observedAt` cũ, và bản sửa của tin không được nêu. Chỉ đổi tệp test.
2. M1 (b), (c) cùng M2 — hai dòng khẳng định và hai câu chú thích; gộp vào cùng vòng với các mục còn mở của review 4a/4b.
3. M3 — ghi vào phần dư và vào điều kiện của hợp đồng pipeline: nháp phải nêu mọi tin của luồng có trong ngữ cảnh, nếu không sẽ bị giữ oan một cách khó hiểu khi Z4 chạy thật.

Task quality: Needs fixes
