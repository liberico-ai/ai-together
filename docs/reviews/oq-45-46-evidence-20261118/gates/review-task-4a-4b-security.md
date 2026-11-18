# Review bảo mật theo task — Task 4a và Task 4b (OQ-45 điểm 2 (b); giữ chỗ OQ-55)

- Loại: review theo task, **không** phải review merge. Vai: `liberico-security-reviewer` (chỉ tìm và xếp hạng; không sửa, không phê duyệt).
- Phạm vi: `8a14c37..1f4961f` — `edc82bf` (Task 4a), `1f4961f` (Task 4b). Bốn tệp: `src/server/source-text.ts`, `src/server/suggestions.ts`, `tests/source-text.test.ts`, `tests/suggestions.test.ts`.
- Cách làm: chỉ đọc. Đọc tệp diff một lần; mọi dòng mã ngoài diff đọc **từ commit `1f4961f`** (`git show`, `git grep <mẫu> 1f4961f`), không đọc working tree của `src/server/suggestions.ts`, `src/server/skill-contracts.ts` và các tệp test. Không chạy test, không nối CSDL, không đọc `.env*`/`.runtime/`. **Mọi số dòng dưới đây là số dòng tại `1f4961f`.**
- Nhãn: `#fact` = đọc được ở dòng nêu; `#inference` = suy ra từ các `#fact`; lời khai của builder và của phiên chính được ghi là lời khai.
- Không finding nào chạm hệ thống vận hành IBS HI. Nhãn `IBS_HI` ở đây là nhãn miền của dự án trong LibeTech AI OS (`AGENTS.md:16`).

## Bước 0 — quét bí mật

- `#fact` Tên tệp được theo dõi tại `1f4961f` khớp `.env|secret|credential|key|token`: không có. `.gitignore:4` (`.runtime/`), `:7` (`.env*`), `:30` (`.superpowers/`).
- `#fact` Các dòng thêm của diff: không chuỗi kết nối, không JWT, không chuỗi entropy cao dài, không khoá API; không dòng `console.`/`logger.` nào. Fixture dùng `randomUUID()` và các chuỗi đánh dấu tổng hợp (`zq-read-…`, `zq-thread-…`, `Q5-…`).
- `#fact` Bốn log đỏ/xanh của builder không chứa đường dẫn thư mục máy (đếm chuỗi thư mục nhà: 0 ở cả bốn) và nằm dưới `.superpowers/` (bị bỏ qua).
- Kết quả: sạch.

## Phán quyết 1 — đúng yêu cầu: **đạt**

### Đối chiếu brief → mã

| Yêu cầu | Mã | Kết quả |
|---|---|---|
| 4a · `VISIBILITY` đúng ba mã | `src/server/suggestions.ts:81` | `#fact` khớp chữ |
| 4a · `contextFor`: `SCOPE_DENIED`/`INVALID_INPUT` → `null`, lỗi khác ném lại; `decide` gọi nó, `null` → `ENTITY_NOT_FOUND` | `:152-159`, `:264-266` | `#fact` khớp; hành vi của `decide` không đổi |
| 4a · `present`: khoá đệm `skill:entityType:entityId`, lưu cả `null`; `SCHEMA_INVALID` + `ENTITY_NOT_FOUND` / `POINTER_ONLY_PROJECT` + phần `VISIBILITY` của cổng; không lý do → `toView(r,[],parsed.data)`, có lý do → `toView(r,[…].sort(),null)` | `:166-191` | `#fact` khớp |
| 4a · người không có quyền: không `contextFor` | `:170` (`continue` trước mọi việc khác) | `#fact` khớp |
| 4a · `decide` đặt ngữ cảnh của nhánh `confirmed` vào `Map` và trao cho `present`; từ chối và phát lại để `present` tự dựng | `:238`, `:264-265`, `:289` | `#fact` khớp; ca có sẵn `tests/suggestions.test.ts:309-315` (`toHaveLength(1)`) không nằm trong diff |
| 4a · H6: `candidate({excerpt?})`, trả thêm `event` | `tests/suggestions.test.ts:65-71` | `#fact` khớp |
| 4b · `threadHasHiddenText`: chữ ký, câu lệnh, `IS NOT TRUE`, lối tắt trả `true` | `src/server/source-text.ts:75-93` | `#fact` câu lệnh trùng từng mệnh đề với brief |
| 4b · `suggestions.ts` không nêu tên bảng bản sửa, kể cả chú thích | `git grep` tại `1f4961f`: hai chuỗi chỉ có ở `src/server/intake.ts` và `src/server/source-text.ts` | `#fact` |
| 4b · `present`: một lần mỗi đối tượng, chỉ nháp ứng viên, chỉ người có quyền | `:168`, `:184-187` (sau `:170`) | `#fact` khớp |
| 4b · `decide`: trong `if(ctx)`, sau vòng `checkSkillOutput` | `:267-272` | `#fact` khớp |
| 4b · chú thích «OQ-55 placeholder» ở cả hai nơi | `:183`, `:270` | `#fact` |
| 4b · không viết mã tương tự cho nháp tài liệu | không có nhánh nào cho `document`; ca Q7 ghim | `#fact` |

Thiếu: không. Thừa: không (hai phép khẳng định thêm so với brief — `tests/source-text.test.ts:168` cho mã dự án sai dạng, `tests/suggestions.test.ts:986` buộc dòng đọc được đúng là dòng đã chèn — đều nằm trong chữ của giao diện). Hiểu sai: không. Phép kiểm «nháp đã cũ» (Task 5, 6) chưa có và không tính là thiếu.

### Từng ca có khẳng định điều tên ca nói không

| Ca | Dòng | Nhận xét |
|---|---|---|
| M1 | `tests/suggestions.test.ts:777-790` | `#fact` (i) `toMatchObject` với mảng nên `maskReasons` và `sources` là so **bằng đúng**; hai phép «không chứa» dò `MARK` và mã tin — cả hai xuất hiện được nếu không che (đối chứng dương ở `:788-789`). (ii) dùng «chứa» đúng như brief. Đạt |
| M2 | `:792-804` | `#fact` «chứa `POINTER_ONLY_PROJECT`» + `value` null cho cả hai loại nháp; sau dòng ánh xạ bản 2 thì `maskReasons` bằng đúng `[]` và `value` khác null. Đạt |
| M3 | `:806-818` | `#fact` bốn trường hợp, `toEqual([lý do])` bằng đúng, `sources` bằng đúng `[]`. Đạt |
| M4 | `:820-830` | `#fact` bốn dòng, `[]` bằng đúng và `value` khác null. Là ca đối chứng (xanh từ trước, như brief nói). Đạt |
| M5 | `:832-851` | `#fact` 1 lần / 2 lần / 0 lần; đối số 2 là `pm`, đối số 3 và 4 so được. Đạt cho «ngữ cảnh»; **không** ghim «không câu đọc luồng» (Minor N2) |
| M6 | `:853-858` | `#fact` `rejects.toBe(boom)` — đúng đối tượng lỗi. Đạt |
| M7 | `:860-866` | `#fact` quyết định ghi được, «chứa `TEXT_NOT_VISIBLE`», `value` null, không `MARK`, 1 dòng quyết định. Đạt (đúng chữ brief; không xét `sources` — `toView` bảo đảm) |
| M8 | `:868-885` | `#fact` `sources` bằng đúng `[]`; câu trả lời không chứa mã tin, mã tài liệu, 30 mã lạ; các dòng trao cho dịch vụ không chứa mã lạ nào (cột `sources` không được đọc — `:87`). Mã tin và mã tài liệu xuất hiện được nếu trả `value` hoặc đọc cột. Đạt |
| M9 | `:887-895` | `#fact` cùng `decidedAt`, `toEqual(['POINTER_ONLY_PROJECT'])`, `value` null, 1 dòng. Đạt |
| Q1 | `:976-987` | `#fact` bằng đúng `['THREAD_TEXT_HIDDEN']`; `member` bằng đúng `['CONFIRM_AUTHORITY_REQUIRED']`; đối chứng dương với cờ còn. Đạt |
| Q2 | `:989-997` | `#fact` kiểm trước hai bản là `excerpt` rồi `pointer_only`; bằng đúng `['THREAD_TEXT_HIDDEN']`. Đạt cho «bản cũ của cùng một tin» |
| Q3 | `:999-1015` | `#fact` giữ với `THREAD_TEXT_HIDDEN`, 0 quyết định, số khoá lệnh không đổi; từ chối ghi được; dòng lệch hợp đồng bị giữ `SCHEMA_INVALID`. Đạt |
| Q4 | `:1017-1024` | `#fact` bằng đúng hai mã, đã sắp. Đạt |
| Q9 | `:1026-1039` | `#fact` cùng `decidedAt`, «chứa `THREAD_TEXT_HIDDEN`», `value` null, `sources` `[]`, không `MARK`, 1 dòng. Đạt |
| Q7 | `:1041-1048` | `#fact` nháp tài liệu: `[]`, `value` khác null, xác nhận thành công với danh sách nhóm rỗng. Đạt (đối chứng; ghim R16) |
| Q5 | `tests/source-text.test.ts:144-169` | `#fact` cấu hình hiện tại, bản cũ/mới của **một** tin, `IBS_HI`, dự án khác, tenant khác, mã sai dạng không gửi câu lệnh. **Không** có luồng nào nhiều hơn một tin: nửa «every message of the thread» của tên ca không được khẳng định (Important I1). Phần phạm vi thiếu đối chứng dương trong cùng ca (Minor N3) |
| Q6 | `:171-181` | `#fact` đúng một dòng có khoá `hidden`, khoá duy nhất; không chuỗi đánh dấu, không hash nội dung. Đạt |
| Q8 | `:183-191` | `#fact` `[null]` → `true`; `[null, nhóm khác]` → `true`; `[null, đúng nhóm]` → `false`; luồng chỉ con trỏ → `false`. Đạt. Phép đột biến `NOT` là lời khai của builder (⚠️ 1) |

Log đỏ: `#fact` 4a — 8 dòng `AssertionError`, 0 `timed out`; 4b — 5 dòng `AssertionError` (Q1, Q2, Q3, Q4, Q9), 0 `timed out`; bốn ca của `tests/source-text.test.ts` đỏ vì thiếu hàm xuất, builder ghi rõ là không tính.

### Ca hiện có bị sửa hay nới

`#fact` Trong `tests/suggestions.test.ts` chỉ có: một dòng `import {AppError}`, helper `candidate` (H6), hai nhóm ca mới. Trong `tests/source-text.test.ts` chỉ có: ba tên thêm vào hai dòng `import`, một nhóm ca mới; ca quét «only source-text.ts reads revision text» nằm trong diff dưới dạng dòng ngữ cảnh, không đổi. Không ca hiện có nào đổi kỳ vọng. Không gì ngoài H6.

## Phán quyết 2 — an toàn và chất lượng: mã an toàn; **một Important ở ca kiểm**, sáu Minor

### Hai điều review Task 3 yêu cầu kiểm lại

1. `#fact` Trong `present`, nhánh «không có quyền quyết định» là câu lệnh đầu tiên của vòng lặp (`src/server/suggestions.ts:170`) và `continue` trước phép kiểm lược đồ (`:172`), lần dựng ngữ cảnh (`:175`) và câu đọc luồng (`:185`). Người đó nhận đúng một mã. Ở `list`, họ còn đi câu lệnh `DRAFT_META_SQL` (`:202`) nên không cột nội dung nào tới Node.
2. `#fact` `toView` của tệp này chỉ được gọi ở `:170` và `:188`, cả hai trong `present` (`git grep toView 1f4961f -- src/`; hai `toView` khác là hàm cùng tên của tệp khác). `#inference` Nhánh «mặt nạ rỗng mà không có nội dung» mà review Task 3 nêu (M5) không tới được: `reasons.size===0` kéo theo `parsed.success` vì `:173`.

### Chữ của tin còn đường nào tới người không được đọc

- **`list`** — `#fact` nội dung chỉ rời `present` qua `toView(r,[],parsed.data)` khi tập lý do rỗng (`:188`); mọi trường hợp khác `value`, `questions`, `confidence`, `skillVersion`, `modelVersion` là `null`, `sources` là `[]` (`:102-103`). `total` đếm theo đúng bộ lọc, không theo việc che (`:204`). Thứ tự dòng do SQL (`:202`), thứ tự mã do `.sort()` (`:188`).
- **Câu trả lời của `decide`** — `#fact` xác nhận, từ chối và phát lại đều kết thúc ở `present` (`:289`); không nơi nào khác dựng `DraftView`. Phát lại không chạy thân khoá lệnh (`src/server/document-commands.ts:19-23`) nên `contexts` rỗng và `present` dựng lại dưới cấu hình hiện tại (M9, Q9).
- **Mã lý do và lỗi** — `#fact` câu `DRAFT_HELD` chỉ nối các mã (`:273`); không id, không chữ. `#inference` Tổ hợp mã che cho người có quyền biết «nháp nêu nguồn tôi không đọc được» hoặc «luồng có chữ đang ẩn» — đúng phần «lý do giữ» mà quyết định cho trả (R11); người đó đã thấy `display_mode` của tin qua hộp nhận tin.
- **Số lần dựng ngữ cảnh** — `#fact` 0 lần cho người không có quyền; tối đa một lần mỗi kỹ năng cho người có quyền (`:174-175`). `#inference` Khác biệt chỉ lộ vai của chính người đọc (R14).

### Ngữ cảnh dựng dưới quyền ai

`#fact` `contextFor` trao đúng `p` của người gọi và `tx` của giao dịch đang chạy (`:154`). `tx` chạy dưới role `libetech_runtime` với RLS (`src/server/db.ts:52`), phạm vi dự án đã thu về một dự án (`list`: `:200`; `decide`: `:226`). Ca M5 đọc đối số thứ hai là `pm`; ca có sẵn `tests/suggestions.test.ts:309-315` đọc cho `decide`.

### Bộ nhớ đệm

`#fact` `contexts` mặc định là `new Map()` tạo ở mỗi lần gọi (`:166`), hoặc `Map` cục bộ của một lần `decide` (`:238`); `hiddenThread` cục bộ của một lần `present` (`:168`). Không biến mức mô-đun nào giữ ngữ cảnh. Khoá gồm kỹ năng, loại và mã đối tượng; kỹ năng là sáu giá trị do CHECK của bảng (`migrations/021_ai_suggestions_z4.sql:39`), không chứa dấu `:`. `#inference` Không có đường trả ngữ cảnh của đối tượng khác, của người khác hay của lần gọi khác. `hiddenThread` chỉ khoá theo mã đối tượng nhưng chỉ dòng `intake_candidate` dùng nó (`:184`).

Ghi nhận, không phải finding: ở đường xác nhận, câu trả lời dùng lại ngữ cảnh dựng **trước** khi ghi; một dòng ánh xạ `IBS_HI` được commit trong khe đó (cỡ một giao dịch) không được câu trả lời của chính lệnh ấy thấy. Tương đương «ánh xạ đổi ngay sau khi đọc» (cùng lớp với R5). Lần đọc kế tiếp che.

### Lỗi lạ có biến thành «không che» không

`#fact` `contextFor` chỉ đổi hai mã thành `null` (`:156`), và `null` → `ENTITY_NOT_FOUND` (che). `threadHasHiddenText` không có `try/catch`; `present` không bắt gì. Lỗi nào khác đều lan ra và cả lần đọc thất bại (M6). `#fact` `CONTEXT_TOO_LARGE` là lỗi có thật của bộ dựng (`src/server/skill-context.ts:90`) nhưng `#inference` không tới được ở đường này: một lần dựng chỉ có ứng viên (≤ 20 + 50 nguồn) hoặc chỉ tài liệu (≤ 50 + 30). Một chỗ còn mặc định về phía «không che» ở nhánh không tới được: Minor N1.

### Câu SQL mới (`src/server/source-text.ts:86-91`)

- **Tham số** — `#fact` ba tham số, không nối chuỗi từ dữ liệu; `$2::uuid` và `$1::uuid` đã qua biểu thức uuid chữ thường (`:85`), nên không có `22P02` thô.
- **Phạm vi dự án** — `#fact` `c.project_id`, `e.project_id`, `r.project_id` đều `=$1`. `r.project_id` luôn bằng `e.project_id` do khoá ngoại ba cột (`migrations/016_intake_inbox.sql:75`), nên mệnh đề thêm không loại bản nào.
- **Phạm vi tenant** — `#fact` câu lệnh không nêu `tenant_id`; ba bảng bật và ép RLS theo tenant và danh sách dự án của giao dịch (`migrations/016_intake_inbox.sql:141-148`, `:162-164`, `:175-177`, `:203-205`), và mọi lời gọi từ dịch vụ đi qua `scoped`. Ca Q5 hỏi từ tenant khác → `false`. `#inference` Đủ, với điều kiện hàm chỉ được gọi trên `tx` của `scoped` (đúng ở hai nơi gọi).
- **Logic ba trị** — `#fact` `chat_id` và `thread_key` là `NOT NULL` ở cả hai bảng (`:50`, `:52`, `:99`), nên phép nối luồng không rơi vào `NULL`. `isIbsHiSql` bọc `coalesce`, không bao giờ `NULL` (`src/server/source-text.ts:21`). Chỗ duy nhất ra `NULL` là `chat_id = ANY($3)` khi danh sách có phần tử `null` và không khớp; `IS NOT TRUE` đưa nó về «có chữ đang ẩn» (Q8). Danh sách rỗng → `false` → ẩn.
- **Mọi bản của mọi tin, không trần** — `#fact` nối thẳng bảng bản sửa theo `source_event_id`, không `LATERAL … LIMIT 1`, không `LIMIT`. Đúng. Nhưng không ca nào ghim nửa «mọi tin, không trần» (Important I1).
- **Thứ trả về** — `#fact` một cột `hidden` kiểu đúng/sai; Q6 ghim.
- **Bảng ánh xạ** — `#fact` RLS của `project_domain_mappings` chỉ theo tenant và dự án, không theo vai (`migrations/013_project_registry.sql:74-76`), nên mọi người đọc trong phạm vi đều thấy nhãn `IBS_HI` như nhau; không vai nào bị «mù» nhãn rồi được trả nội dung.

### Bất biến «điều bị che lúc đọc luôn bị giữ lúc xác nhận» (P3)

`#fact` Đối chiếu từng mã che của `present` với bước giữ của `decide` (`:253-273`):

| Mã che lúc đọc | Nguồn lúc đọc | Lúc xác nhận |
|---|---|---|
| `SCHEMA_INVALID` | `outputFits` + lược đồ (`:172-173`) | `checkSkillOutput` mở đầu bằng đúng hai phép đó (`src/server/skill-contracts.ts:144-147`; `outputFits` là `measure(...).fits`, `:80`) → giữ, nếu có ngữ cảnh; không có ngữ cảnh → giữ `ENTITY_NOT_FOUND` |
| `ENTITY_NOT_FOUND` | `contextFor` → `null` (`:177`) | cùng hàm, cùng đối số (`:264-266`) |
| `POINTER_ONLY_PROJECT` | `ctx.pointerOnly` (`:179`) | `:268` |
| `SOURCE_OUT_OF_CONTEXT`, `TEXT_NOT_VISIBLE` | `checkSkillOutput` lọc qua `VISIBILITY` (`:181`) | cùng lời gọi, không lọc (`:269`) |
| `THREAD_TEXT_HIDDEN` | `:184-187` | `:271`, trong `if(ctx)`; không có ngữ cảnh → giữ `ENTITY_NOT_FOUND` |

`#inference` Bất biến đứng: không có đầu vào nào bị che lúc đọc mà qua được bước giữ dưới cùng cấu hình. Sáu mã đều có ca giữ: `tests/suggestions.test.ts:295`, `:298`, `:303`, `:322`, `:341`, `:485`, `:1003`, `:1013`. Chữ «với cùng mã» của P3 lệch ở một góc (Minor N4).

### Ánh xạ sang `IBS_HI` hoặc gỡ cờ sau khi nháp đã lưu

- `#fact` `IBS_HI`: `pointer_only` đọc lại ở mỗi lần dựng ngữ cảnh (`src/server/skill-context.ts:43`); che vô điều kiện cho cả hai loại nháp (`:179`), giữ lúc xác nhận (`:268`), phát lại cũng che (M9). Với nháp ứng viên, câu đọc luồng cũng trả `true` khi luồng có chữ (Q5).
- `#fact` Gỡ cờ, nháp ứng viên: nêu tin → `TEXT_NOT_VISIBLE`; không nêu tin mà luồng có chữ đã lưu → `THREAD_TEXT_HIDDEN` (Q1), kể cả khi bản mới nhất chỉ là con trỏ (Q2); `excerptChats` mặc định rỗng → che (M1 (ii)).
- `#inference` Chữ của tin hiện hay ẩn theo nhóm và dự án, và một luồng chỉ thuộc một nhóm, nên «luồng có chữ đang ẩn» ⇔ «luồng từng lưu chữ» ∧ («nhóm không có cờ» ∨ «dự án `IBS_HI`»). Với một pipeline trung thực, ngữ cảnh của nháp ứng viên chỉ có tin của chính luồng (`src/server/skill-context.ts:53-59`), nên giữ chỗ phủ đúng nguồn chữ mà nháp ứng viên có thể mang.

### Nháp tài liệu (không có phép kiểm luồng) được ghi nhận trung thực chưa

`#fact` Có, ở ba nơi: `docs/plans/oq-45-46-ai-drafts.md` mục R16 («không phải hướng chặt nhất», nêu cả đường của pipeline trung thực qua `ba_elicitation`/`pm_planning`); `docs/OPEN-QUESTIONS.md:904` và `:908`; ca Q7 ghim rằng PR không viết mã cho trường hợp đó. `#fact` Mã không giả vờ che: không có nhánh nào cho `document`. Chưa có: dòng tương ứng trong biên nhận giao hàng (chưa tới task đó — ⚠️ 6), và hai điểm dư nhỏ chưa viết ra (Minor N6).

## Findings

Không có Critical. Một Important. Sáu Minor.

| # | Mức | Vị trí | Lớp | Kịch bản | Sửa thế nào | Vai thực hiện |
|---|---|---|---|---|---|---|
| I1 | Important | `tests/source-text.test.ts:144-160`; `tests/suggestions.test.ts:976-997`; mã được ghim: `src/server/source-text.ts:87-91` | thuộc tính bảo mật cốt lõi không có ca ghim | Tên Q5 nói «every revision of every message of the thread»; kế hoạch nói «xét mọi bản của mọi tin trong luồng, không theo trần 20 tin». `#fact` Mọi luồng trong Q1–Q9 chỉ có **một** tin (tin gốc), có một hoặc hai bản. `#inference` Hai phép sửa sai sau đây để **toàn bộ** ca xanh: (a) nối `e.id=c.root_source_event_id` — đúng phép nối của `latestRevisionCte` cách đó 50 dòng (`src/server/source-text.ts:38`), nên là lỗi chép dễ xảy ra; (b) thêm trần «20 tin mới nhất» như `visibleThreadMessages`. Khi đó chữ đã lưu ở một tin trả lời, hoặc ở tin cũ ngoài trần, không còn làm `THREAD_TEXT_HIDDEN` bật, và nháp không nêu tin sẽ được trả nguyên nội dung sau khi gỡ cờ — đúng tình huống OQ-55 sinh ra để chặn. Mã hôm nay đúng; thứ thiếu là bằng chứng giữ nó đúng, trong khi Task 6 sắp thêm một hàm cùng kiểu vào cùng tệp. Thiếu sót nằm ở danh sách kịch bản của brief, không phải builder làm lệch brief | Thêm vào Q5 hai kịch bản, không đổi `src`: (1) tin gốc nhận ở chế độ chỉ con trỏ, một tin **trả lời** (`context.replyToMessageId` là mã tin gốc) nhận khi nhóm bật cờ → danh sách rỗng `true`, danh sách có nhóm `false`; (2) tin cũ nhất lưu chữ, sau đó ≥ 21 tin trả lời chỉ con trỏ → danh sách rỗng `true`. Nên thêm một ca ở mức dịch vụ cho (1): nháp không nêu tin → bằng đúng `['THREAD_TEXT_HIDDEN']`. Kiểm bằng đột biến: đổi phép nối sang tin gốc phải làm (1) đỏ vì `AssertionError` | Builder; phiên chính duyệt |
| N1 | Minor | `src/server/source-text.ts:92`; chú thích `:76-83` | gia cố fail-closed | (a) `return row?.hidden===true`: thiếu dòng, hoặc giá trị không phải `true`, cho ra `false` = «không che». Nhánh này không tới được với `SELECT EXISTS`, nhưng brief nói «một câu trả lời "không che" không được là mặc định». (b) Ứng viên không thuộc dự án hoặc bị RLS ẩn cho `false` (Q5 khẳng định): tự nó là mặc định mở; an toàn hôm nay vì cả hai nơi gọi đã có `ENTITY_NOT_FOUND` (`src/server/suggestions.ts:177`, `:266-271`). Chú thích của hàm không nêu tiền điều kiện đó | (a) `return row?.hidden!==false;`. (b) Thêm một câu vào chú thích: «ứng viên không thấy được cho `false`; nơi gọi phải tự che khi không dựng được ngữ cảnh». Áp cùng quy ước cho `threadFreshness` của Task 6 | Builder |
| N2 | Minor | `tests/suggestions.test.ts:832-851` (M5), `:1041-1048` (Q7) | ca kiểm thiếu so với kế hoạch | Kế hoạch (B2) nói người không có quyền «không gây câu đọc luồng nào», brief 4b nói «không gọi cho nháp tài liệu». M5 chỉ đếm lần dựng ngữ cảnh; Q1 và Q7 chỉ xét kết quả. Một lần sửa đưa câu đọc luồng lên trước dòng xét quyền vẫn để mọi ca xanh | Một ca dùng `recordingDb`: `member` đọc danh sách nháp ứng viên, và `pm` đọc danh sách nháp tài liệu → không dòng nào được trao có khoá `hidden` | Builder |
| N3 | Minor | `tests/source-text.test.ts:162-169` | ca kiểm thiếu đối chứng | Hai phép `false` (hỏi bằng dự án khác; hỏi từ tenant khác) không có đối chứng dương trong cùng ca: nếu ứng viên dựng ra không có chữ đang ẩn thì cả hai vẫn `false`. Hiện chỉ neo bằng phép tương tự ở ca trước | Thêm một dòng đầu ca: `expect(await ask(ids.sales,a.id,[])).toBe(true)` | Builder |
| N4 | Minor | `src/server/suggestions.ts:173`, `:177`, `:184-187` so với `:266-272`; `docs/plans/oq-45-46-ai-drafts.md` mục P3 | chữ của bất biến (mức kế hoạch; **không** để builder tự sửa) | P3 viết «bị giữ lúc xác nhận, với cùng mã». Khi không dựng được ngữ cảnh, lúc đọc có thể trả `ENTITY_NOT_FOUND` kèm `SCHEMA_INVALID` hoặc `THREAD_TEXT_HIDDEN`, còn lúc xác nhận chỉ nêu `ENTITY_NOT_FOUND` (hai phép kia nằm trong `if(ctx)`). Nháp vẫn bị giữ; không có hệ quả bảo mật | Planner chọn một: sửa chữ P3 thành «luôn bị giữ; cùng mã khi dựng được ngữ cảnh», hoặc đưa hai phép kiểm ra ngoài `if(ctx)` ở một task sau | Planner; phiên chính duyệt |
| N5 | Minor | `src/server/suggestions.ts:87`, `:202`, `:229`, `:287` | gia cố (mức kế hoạch; liên quan `AGENTS.md:16` và OQ-54) | Với dự án đang chỉ con trỏ, lớp che là vô điều kiện, nhưng `value` vẫn được kéo từ CSDL vào tiến trình Node rồi mới bị bỏ (P5 chấp nhận điều này cho mọi lớp che vì cần xét mã nháp nêu; với `POINTER_ONLY_PROJECT` thì không cần xét). Không gì rời dịch vụ và không gì ghi log; đây là bề mặt thừa, không phải đường rò | Khi xét OQ-54: cho câu lệnh đọc trả `NULL` thay `value` ngay trong SQL khi dự án đang `IBS_HI` (cùng mẫu với `DRAFT_META_SQL`), và che `POINTER_ONLY_PROJECT` mà không cần `value` | Planner; Chairman quyết cùng OQ-54 |
| N6 | Minor | `docs/plans/oq-45-46-ai-drafts.md` mục R1, R15, R18; `src/server/suggestions.ts:183` | phần dư ghi thiếu | (a) Phép kiểm luồng chỉ xét **luồng của chính ứng viên**: một bên ghi không trung thực chép chữ của luồng khác trong cùng dự án vào nháp của ứng viên này thì không phép nào thấy (pipeline trung thực không có chữ đó trong ngữ cảnh). R1 và R18 kéo theo điều này nhưng không viết ra. (b) R15 nói dưới lớp che người có quyền nhận thêm «đúng một thứ, `valueHash`»; thật ra việc ba mã `SCHEMA_INVALID`, `SOURCE_OUT_OF_CONTEXT`, `TEXT_NOT_VISIBLE` có bật hay không cũng do bên ghi chọn (vài bit mỗi dòng, nhỏ so với hash). (c) Chú thích tại nơi che không nói nháp tài liệu không có phép kiểm tương đương | Thêm hai câu vào phần dư và vào biên nhận; thêm «document drafts have no equivalent check (R16, OQ-55)» vào chú thích ở `:183` | Planner (tài liệu); Builder (chú thích) |

## ⚠️ Không kiểm được từ diff — phiên chính nên kiểm

1. ⚠️ **Lượt PostgreSQL 16 và phép đột biến của Q8 là lời khai.** Tôi không chạy lại 128/209 ca; log xanh trong thư mục task là lượt PGlite (124 và 157 ca đạt, 1 bỏ qua). Phép đổi `IS NOT TRUE` thành `NOT` làm Q8 đỏ chỉ có trong báo cáo của builder, không có log. Nên: giữ log PG16 trong biên nhận; chạy lại đột biến đó một lần cùng lúc sửa I1.
2. ⚠️ **`excerptChats` được chụp lúc dựng dịch vụ** (`src/server/suggestions.ts:108`). Chưa tuyến nào dựng dịch vụ nên không kiểm được: danh sách của dịch vụ có đúng là danh sách của đường nhận tin không, và một lần gỡ cờ có tới được instance đang sống không (R9, khoảng trống 42). Một instance sống lâu giữ danh sách cũ sẽ tiếp tục trả nội dung sau khi cờ đã gỡ. Điều kiện trước khi thêm tuyến đọc nháp.
3. ⚠️ **Vai lấy từ phiên** (`projectRole(p,…)`, R7): hạ vai chỉ có hiệu lực khi `Principal` được dựng lại. Đường dựng `Principal` từ phiên chưa được soát ở lượt nào.
4. ⚠️ **Kế hoạch thực thi của câu đọc luồng trên luồng dài** chưa đo. `#fact` Chỉ mục cần dùng có sẵn (`migrations/016_intake_inbox.sql:122`, `:126`) và trần 10 giây mỗi câu lệnh (`src/server/db.ts:32`) làm lỗi lan ra — đóng. Nên chạy `EXPLAIN` một lần trên PG16 trước khi bật.
5. ⚠️ **Working tree của builder kế tiếp.** `git status` cho thấy `tests/suggestions.test.ts`, `tests/source-text.test.ts`, `tests/slice3-fixtures.ts` đang bị sửa; tôi chỉ soát trạng thái commit `1f4961f`. Review Task 5/6 phải kiểm lại: nhánh không có quyền vẫn đứng đầu `present`; `toView` vẫn chỉ gọi từ `present`; phép `THREAD_TEXT_HIDDEN` còn nguyên ở cả bước che và bước giữ; không câu lệnh nào bắt đầu đọc cột `sources`; ca M1–M9, Q1–Q9 không bị sửa.
6. ⚠️ **R16 phải vào biên nhận giao hàng** và vào danh sách «trước khi thêm tuyến đọc nháp / trước khi bật Z4», cùng OQ-55 còn mở. Hai commit này chưa có biên nhận.
7. ⚠️ **Chưa kiểm:** `npm run typecheck` (lời khai: exit 0), lint, ngưỡng coverage.
8. Bản sao iCloud: `#fact` tại lúc soát không có tệp tên dạng `<tên> 2.<đuôi>` dưới `src`, `tests`, `migrations`, `docs/reviews`. Chỉ đúng tại thời điểm đó.

## Ba việc đòn bẩy cao nhất

1. I1 — thêm hai kịch bản «tin trả lời» và «ngoài trần 20 tin» vào Q5, kèm một lần đột biến phép nối. Chỉ đổi tệp test.
2. N1 — `row?.hidden!==false` và một câu tiền điều kiện trong chú thích, trước khi Task 6 thêm hàm thứ hai cùng kiểu.
3. ⚠️ 2 — ghi thành điều kiện bắt buộc của tuyến đọc nháp: dịch vụ nhận danh sách nhóm hiện hành ở mỗi yêu cầu, không giữ bản chụp.

Task quality: Needs fixes
