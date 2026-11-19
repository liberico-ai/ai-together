# Review bảo mật theo task — Task 3 (OQ-45 điểm 1b): ai đọc nội dung nháp, hình dạng `DraftView`, `decide` xét quyền trước tiên

- Loại: review theo task, không phải review merge. Vai: reviewer bảo mật, chỉ khuyến nghị (R1/R2): không sửa mã, không git ghi.
- Phạm vi: base `9f721f0`, head `8a14c37` (một commit). Hai tệp đổi: `src/server/suggestions.ts`, `tests/suggestions.test.ts` (`#fact`, `git diff --name-status`).
- Căn cứ: lời Chairman 18/11/2026 «OQ-45: 1b, 2b, 3b. OQ-46: b, mốc là bản mới nhất nháp nêu»; brief `.superpowers/sdd/oq-45-46-ai-drafts/task-3-brief.md`; kế hoạch `docs/plans/oq-45-46-ai-drafts.md` (Global Constraints, B1, B2, C1/C3/C8/C9, R15/R17, Review Focus 1–2, K1/K2); `AGENTS.md`; skill `liberico-coding-rules`.
- Cách làm: đọc tệp diff một lần; mã ngoài diff chỉ mở để kiểm rủi ro nêu tên được (`projectRole`, `mayWriteDocuments`, `READ_ROLES`, `claimDocumentCommand`, `scoped`, lược đồ đầu ra kỹ năng, `recordingDb`, bảng và quyền của migration 021). Số dòng của hai tệp đổi là số dòng **tại commit `8a14c37`** (`git show 8a14c37:<tệp>`).
- Không làm: không chạy test, không nối CSDL, không đọc `.env*`/`.runtime/`, không in dòng lệnh tiến trình. Kết quả chạy (PGlite và PostgreSQL 16) là lời khai của builder và của phiên chính; ở đây chỉ đọc log đỏ/xanh của builder.
- Khai báo: một lệnh `grep` quét cả thư mục `src` đã in ra **một dòng** của `src/server/suggestions.ts` trong working tree (lời gọi `claimDocumentCommand`, nội dung trùng dòng `:200` của commit). Không kết luận nào trong báo cáo dựa vào working tree; các lần đọc sau đều qua `git show`.
- Không finding nào chạm hệ thống vận hành IBS HI. Phần che «dự án chỉ con trỏ» lúc đọc thuộc Task 4a, chưa có trong commit này và không tính là thiếu.

## Bước 0 — quét bí mật (giới hạn trong phạm vi task)

| Việc | Kết quả |
|---|---|
| Tên tệp được theo dõi khớp `.env`/`secret`/`credential`/`token` | Không có (`#fact`, `git ls-files`). |
| Dòng thêm của diff: chuỗi kết nối, JWT, khoá, mật khẩu, chuỗi dài entropy cao | 0 kết quả (`#fact`). Dữ liệu ca kiểm là tổng hợp (`MARK` sinh từ `randomUUID`, uuid mẫu). |
| `.gitignore` thử trên tên thật | `.env`, `.env.local`, `.env.production` đều bị bỏ qua bởi mẫu `.env*`; `.superpowers/` bị bỏ qua (`#fact`, `git check-ignore`). |
| Lịch sử git, độ công khai của repo | Không quét trong review này (ngoài phạm vi một commit). |

## Phán quyết 1 — đúng yêu cầu: ĐẠT

### Đối chiếu brief → mã (`src/server/suggestions.ts`)

| Yêu cầu của brief | Mã | Kết luận |
|---|---|---|
| `MaskReason`, `DraftView` chép nguyên B2 | `:36-46` | Trùng từng chữ với `docs/plans/oq-45-46-ai-drafts.md:134-144` (`#fact`). |
| `mayDecide` một luật cho đọc và quyết định | `:77`; dùng ở `:150`, `:164`, `:202` | Đúng. Không còn nơi nào xét quyền bằng biểu thức khác (`#fact`). |
| `HEAD`, `DECISION`, `FROM_DRAFTS`, `DRAFT_SQL`, `MANIFESTS_IN_FORCE`, `DRAFT_META_SQL` | `:79-88` | Đúng chữ của brief. Giữ «FROM intelligence.ai_drafts d LEFT JOIN» và «WHERE d.id=» (`:192`, `:249`). |
| `DraftRow` bỏ `questions`/`confidence`/`sources`; bốn cột thành kiểu có `null` | `:73-75` | Đúng. Không câu lệnh đọc nào của `list`/`decide` còn lấy ba cột đó (`#fact`). |
| `toView(r, mask, shown)` | `:91-100` | Đúng từng nhánh: `manifestHash` so với hằng cho mọi người đọc; không che thì mọi trường nội dung lấy từ `shown`; che thì năm trường `null`, `sources: []`, `valueHash` chỉ `null` khi có `CONFIRM_AUTHORITY_REQUIRED`. |
| `present` | `:148-154` | Đúng: xét quyền **trước**, trả ngay một mã; có quyền mới tới `outputFits` rồi lược đồ; lệch thì `SCHEMA_INVALID`. |
| `list` chọn câu lệnh theo `mayDecide`, cùng `WHERE`/`ORDER BY`/`LIMIT`/`OFFSET`, `total` không đổi | `:164-168` | Đúng. |
| `decide`: xét quyền là dòng đầu thân khoá lệnh, đúng hai mã và hai câu; rồi «đã có quyết định», rồi `valueHash`; không đổi gì trước khoá lệnh; chú thích thứ tự sửa; trả qua `present` | `:175`, `:200-207`, `:251` | Đúng. Phần trước khoá lệnh (`:179-199`) không đổi một dòng (`#fact`, diff). |
| Mọi `DraftView` rời dịch vụ qua `present`; không nơi nào khác dựng | `toView` chỉ được gọi ở `:150`, `:152` | Đúng. Ngoài tệp này không mô-đun nào trong `src` dùng `DraftView` hay `SuggestionService` (`#fact`). |

Thiếu: không. Thừa: không (tham số `_tx` chưa dùng là theo chữ ký của brief, Task 4a/4b dùng). Hiểu sai: không.

### Từng ca kiểm có khẳng định đúng điều tên ca nói không (`tests/suggestions.test.ts`)

| Ca | Dòng | Nhận xét | Kết luận |
|---|---|---|---|
| L1 | `:653-667` | `pm`: đủ mười phép khẳng định trên dòng có nội dung. Ba vai còn lại: `toEqual` **đúng cả đối tượng** (không phải «chứa»), `total` 1. Hai phép «không chứa» có nghĩa: `MARK` và mã tin đều có thật trong dòng đã lưu, chính phần `pm` của ca chứng minh điều đó. | Thật |
| L2 | `:669-680` | Bốn vai đọc được nháp tài liệu; `viewerByGrant`, hai principal `bot`, `outsider`, `transportApprover` nhận 404 cho cả hai loại nháp. Lưu ý: phép từ chối ở đây là của lớp dịch vụ (trước mọi câu SQL); RLS của bảng được ghim ở `tests/z4-schema.test.ts`, không ở ca này. | Thật |
| L3 | `:682-687` | Quét mọi dòng CSDL trao cho dịch vụ. Log đỏ cho thấy bộ ghi có bắt được dòng nháp và ca đỏ đúng ở `MARK` (`#fact`, `task-3-red.txt`). Xem finding M1: tên ca nói «confidence» nhưng không phép nào xét. | Thật, còn mỏng một chỗ |
| L4 | `:689-702` | 100 mã đúng dạng uuid và 64 ký tự hex đều nằm thật trong cột (`sources`, `manifest_hash`) của dòng chèn thô; xét cả câu trả lời lẫn dòng trao cho dịch vụ; có dòng đối chứng mang hash hiện hành. `toMatchObject({sources:[]})` buộc mảng rỗng. | Thật |
| L5 | `:704-712` | Ba `created_at` khác nhau, thứ tự kỳ vọng viết tường minh, `total` và danh sách mã của hai vai bằng nhau. Xanh từ đầu (đối chứng), đúng như brief. | Thật |
| L6 | `:714-723` | Tám cặp vai × loại, mỗi cặp một nháp mới. Xem finding M2: phép tương đương vẫn đúng khi lệnh thất bại vì lý do không phải quyền. | Thật, còn mỏng một chỗ |
| L7 | `:725-734` | Cột `questions`/`confidence`/`sources`/`skill_version`/`manifest_hash` cố ý lệch với `value`; ca khẳng định từng trường lấy từ `value`, hai trường phiên bản là `null`. `MARK` nằm thật trong cột `questions`. | Thật |
| L8 | `:736-750` | Hash sai và đúng × `confirmed` và `rejected`, trước và sau khi `pm` quyết; cùng mã, cùng trạng thái, cùng câu; số dòng `document_commands` không đổi; `draft_decisions` đúng 1. Đỏ trước khi sửa vì `REVISION_CONFLICT` (`#fact`, log đỏ). | Thật |
| L9 | `:752-759` | Khoá lạ `surprise: MARK` nằm thật trong `value`; `pm` nhận `SCHEMA_INVALID`, `value: null`, `sources: []`, câu trả lời không có `MARK`. | Thật |
| K1 | `:637` | Danh sách khoá thêm đúng `maskReasons`, trùng bảng K1 của kế hoạch. | Đúng bảng |
| K2 | `:517-527` | `toEqual` cả đối tượng; hai dòng 404 và số dòng quyết định giữ nguyên; principal bị hạ vẫn mang `role: 'manager'` ở cấp ngoài, nên ca cũng ghim rằng luật đọc theo vai **của dự án**. | Đúng bảng |

- Log đỏ: 10 `AssertionError`, 0 `timed out`, 0 `TypeError`; 10 ca đỏ là K1, K2, L1–L4, L6–L9 (`#fact`). Log xanh PGlite: 59 đạt, 1 bỏ qua (`#fact`).
- Ca hiện có khác bị sửa hay nới: **không**. Commit chỉ bỏ bốn dòng của tệp test: dòng import, tên K2, kỳ vọng K2, kỳ vọng K1 (`#fact`, `git diff`). Ca «no route imports the suggestion service…», M12-2 và nhóm `Z4 drafts: decide` không đổi một ký tự.

## Phán quyết 2 — an toàn và chất lượng: đạt, không có finding Critical hay Important

### 2.1 Vai đọc không có quyền quyết định học được gì

**Qua `list`** (nháp ứng viên; `engineer`, `technical`, `business`):

| Thứ | Nguồn | Nhận xét |
|---|---|---|
| `id`, `createdAt` | CSDL đặt | Role AI không có quyền `INSERT` trên `id`, `created_at` (`#fact`, `migrations/021_ai_suggestions_z4.sql:162-163`). Nhưng xem M3: thời điểm chèn do bên ghi chọn. |
| `projectId`, `entityType`, `entityId` | chính người đọc nêu | Câu lệnh lọc đúng ba giá trị đó (`:165`). |
| `skill` | bên ghi, sáu giá trị | CHECK của bảng (`#fact`, `021:39`). Phần dư R15. |
| `manifestHash` | hằng của máy chủ hoặc `null` | So trong SQL (`:87`), so lại bằng `===` trong mã (`:94`). Cột có CHECK hex thường 64 ký tự và phép `=` trên `text` là so byte (`#inference`: collation mặc định của CSDL là tất định). Còn đúng một bit «khớp hay không» (R15). |
| `maskReasons` | dịch vụ | Đúng một mã. `present` trả trước khi đọc `value`, nên người này **không** nhận bit «giá trị có khớp lược đồ không» (`:150`). |
| `decision` | người quyết định | Kết quả, người, thời điểm, mã bản tài liệu. Lý do từ chối (chữ tự do) **không** được đọc ở câu lệnh nào (`#fact`, `:80`). |
| `total`, thứ tự, số dòng | như người có quyền | Cùng câu đếm, cùng `ORDER BY` (`:165-167`); L5 ghim. |
| Thời gian trả lời | — | `DRAFT_META_SQL` không đụng cột `value`, nên thời gian không phụ thuộc cỡ nội dung (`#inference`). Khác biệt giữa hai nhánh chỉ lộ vai của chính người đọc (R14). |

**Qua `decide`** — thứ tự câu trả lời một người không có quyền có thể nhận, và nó phụ thuộc gì:

| Thứ tự | Câu trả lời | Phụ thuộc |
|---|---|---|
| 1 | 404 `SCOPE_DENIED` (`:179-187`) | phạm vi và vai đọc của người gọi; sự tồn tại của dòng trong dự án họ đọc được (đã thấy qua `list`, C8) |
| 2 | lỗi lược đồ lệnh (`:194`) | chỉ thân lệnh người gọi gửi; lược đồ là hằng |
| 3 | `IDEMPOTENCY_CONFLICT` (`src/server/document-commands.ts:13-23`) | chỉ các khoá lệnh **của chính người gọi** (khoá duy nhất theo tenant, người, khoá) |
| 4 | `MANAGER_REQUIRED` 403 (`:202-205`) | vai của người gọi và loại nháp |

Không bước nào trong bốn bước đọc `dec_result`, `value_hash` hay `value` để rẽ nhánh (`#fact`). Vậy với mọi `valueHash` và mọi trạng thái của nháp, câu trả lời như nhau: N3 khép trên mã. Thân khoá lệnh ném lỗi thì cả giao dịch lùi, khoá lệnh không còn (L8 ghim bằng số dòng `document_commands`).

- **Đường phát lại của khoá lệnh.** Phát lại không chạy thân nên không qua phép xét quyền; điều đó đúng thiết kế và an toàn vì: (a) muốn có dòng khoá trùng dấu vân tay `{op:'draft.decide', draftId, …}` thì chính người đó phải từng quyết định thành công nháp ấy; (b) không gì được ghi; (c) câu trả lời đi qua `present` với vai **hiện tại**, nên người đã mất quyền nhận quyết định đã ghi và không nhận nội dung (K2). Mọi nơi gọi `claimDocumentCommand` khác đều gắn một `op` riêng (`#fact`, bảy nơi gọi trong `src/server`), nên không dựng được dấu vân tay trùng từ một lệnh khác (`#inference`; chưa mở từng lược đồ của các nơi đó). Kể cả khi dựng được: đường phát lại chỉ trả 404 (nháp chưa có quyết định) hoặc dòng đã che (nháp đã có quyết định) — đúng thứ `list` đã cho thấy, và không ghi gì.
- **Nhánh `READ_ONLY` cho nháp tài liệu** hiện không tới được: cổng `READ_ROLES` ở `:187` chỉ cho bốn vai, và cả bốn đều qua `mayWriteDocuments` (`#fact`, `src/server/document-review.ts:23`, `src/server/documents.ts:84`). Giữ nhánh là phòng thủ đúng; không ca nào chạy được tới nó.
- **`viewer`, `bot`, ngoài dự án, ngoài tenant:** 404 trước mọi câu lệnh ở `list` (`:157-160`) và trước khoá ở `decide` (`:179-187`); không đổi.

### 2.2 Nội dung do bên ghi chọn còn đường nào tới tiến trình Node hoặc tới câu trả lời

- **`list`, người không có quyền:** cột tới Node là `HEAD`, `manifest_hash` đã qua `CASE`, năm hằng `NULL`, và phần quyết định. Không cột nội dung, không mã nguồn, không hash (`#fact`, `:87-88`; L3, L4 ghim trên dòng thật). Tham số của câu lệnh đều do người đọc nêu, cộng một hằng của máy chủ.
- **`decide`, người không có quyền:** dòng nháp **được đọc đủ** vào Node ở `:192` trước phép xét quyền (kế hoạch nêu rõ ở P5). Giữa `:192` và `:205` không lỗi nào mang dữ liệu của dòng: lỗi lược đồ chỉ phản chiếu thân lệnh, dấu vân tay khoá lệnh không chứa trường nào của nháp, hai câu 403 là hằng (`#fact`). Xem M4.
- **Log:** không lời gọi ghi log nào trong `suggestions.ts`, `db.ts`, `errors.ts`, `document-commands.ts`, `skill-contracts.ts` (`#fact`). Thông điệp lỗi của dịch vụ chỉ có mã và câu hằng.

### 2.3 Người có quyền nhận gì khi giá trị lưu lệch hợp đồng

`maskReasons: ['SCHEMA_INVALID']`, năm trường nội dung `null`, `sources: []`, `valueHash` như đã lưu (cần để từ chối; phần dư R3), `manifestHash` là hằng hoặc `null`. Lược đồ chặt ở **mọi tầng** (`strictObject`, không `transform`, không `default`), nên khoá lạ ở bất kỳ độ sâu nào đều bị che, và giá trị qua lược đồ không khác giá trị đã lưu (`#fact`, `src/server/skill-contracts.ts:37-58`). `outputFits` bắt lỗi của `JSON.stringify` và trả «không khớp» (`src/server/skill-contracts.ts:62-66`): giá trị quá cỡ hoặc lồng quá sâu rơi vào `SCHEMA_INVALID`, không ném. Bất biến P3 đứng cho mã này: giá trị bị che `SCHEMA_INVALID` lúc đọc thì `checkSkillOutput` giữ lúc xác nhận với cùng mã (`#fact`, `src/server/skill-contracts.ts:145-147`).

### 2.4 `manifestHash`, `skillVersion`, `modelVersion`

- `manifestHash`: không bao giờ là giá trị bên ghi chọn, cho mọi người đọc (`:94`).
- `skillVersion`: chỉ khi trùng phiên bản manifest hiện hành và nội dung được trả (`:97`); L7 ghim cả hai chiều cùng L1.
- `modelVersion`: như đã lưu, chỉ kèm nội dung (`:97`). Cột chỉ có CHECK độ dài 1–64 (`#fact`, `021:42`), nên dòng chèn thô có thể mang ký tự điều khiển. Đây là phần dư R17 đã ghi, cùng lớp với chữ trong `value`; lớp hiển thị về sau phải thoát ký tự.

### 2.5 Tương tác với đường có sẵn

- `decide` cho nháp đã quyết, người có quyền: vẫn `DRAFT_ALREADY_DECIDED` rồi mới tới `valueHash`; thứ tự tương đối của hai phép đó không đổi.
- Luật đọc dùng `projectRole(p, projectId)`, đúng nguồn `decide` dùng; không tin trường nào của thân lệnh (`AGENTS.md`: không nhận danh tính từ JSON; `listSchema` và `decideSchema` vẫn là `strictObject`).
- AR-03 / E-AI-04: commit không thêm đường ghi nào; nền tảng chỉ đọc Z4.
- E-SEC-01: câu trả lời là `DraftView`, không phải dòng CSDL thô.

## Findings

Không có Critical. Không có Important. Năm Minor.

| # | Mức | Vị trí | Lớp | Kịch bản | Sửa thế nào | Vai xử lý |
|---|---|---|---|---|---|---|
| M1 | Minor | `tests/suggestions.test.ts:682-687`, `:689-702` | ca kiểm mỏng hơn tên ca | L3 và L4 chỉ dò bốn chuỗi cụ thể trong các dòng trao cho dịch vụ. Tên L3 nói «confidence» nhưng không phép nào xét. Nếu một task sau thêm vào `HEAD` một cột bên ghi chọn mà không mang các chuỗi đó (`confidence`, `dedupe_key`, `trace_id`, `input_hash`, `skill_version` thô), L3/L4 vẫn xanh trong khi câu của P5 «không gì do bên ghi chọn (ngoài kỹ năng) tới Node» đã sai. Cũng chưa có đối chứng dương: nếu `recordingDb` thôi ghi dòng thì hai ca xanh rỗng. | Thêm vào L3: (a) đối chứng dương — có đúng một dòng ghi được mang `id` của nháp; (b) danh sách khoá **cho phép** của dòng đó bằng đúng tập cột của `DRAFT_META_SQL`, và `value`, `value_hash`, `skill_version`, `model_version` là `null`. Làm ở Task 4a, lúc builder đang ở tệp này. | Builder; phiên chính duyệt |
| M2 | Minor | `tests/suggestions.test.ts:719-721` | ca kiểm mỏng (mức brief) | L6 so «không che» với «không bị từ chối vì quyền». Một lệnh thất bại vì lý do khác (ví dụ `REVISION_CONFLICT`) ở vai đang đọc được nội dung vẫn làm ca xanh, nên chữ «exactly when it may decide» chưa được ghim trọn. Builder viết đúng chữ brief; chỗ mỏng nằm ở brief. | Thêm một phép: khi `maskReasons` rỗng thì lệnh từ chối phải thành công (`e===null`); khi bị che thì mã lỗi đúng là `MANAGER_REQUIRED`. | Builder (Task 4a hoặc lượt sửa) |
| M3 | Minor | `src/server/suggestions.ts:79`, `:93`; `docs/plans/oq-45-46-ai-drafts.md:127`, `:231` | phần dư ghi thiếu (mức kế hoạch) | B1 xếp `createdAt` vào «giá trị do CSDL đặt», và R15 tính khoảng 3,6 bit mỗi dòng cộng số dòng và thứ tự. Đúng là role AI không chèn được cột, nhưng **thời điểm** chèn do người giữ role chọn, và `createdAt` trả tới mili giây cho người không có quyền. Người giữ role AI điều chỉnh lúc chèn thì mỗi dòng mang thêm cỡ 10 bit (phần mili giây trong một giây), nhiều hơn nếu chịu chờ lâu hơn (`#inference`; chưa đo). Mô hình bị tiêm lệnh không dùng được kênh này; chỉ người giữ role. Không phải lỗi của builder: mã đúng B2. | Hai hướng, phiên chính chọn: (a) giữ mã, sửa chữ của R15 và B1 trước khi chép vào biên nhận để con số không thấp hơn thật; (b) với người không có quyền, làm tròn `createdAt` (ví dụ tới phút) — đổi hình dạng trả về, cần quyết định. | Planner / phiên chính; Chairman nếu chọn (b) |
| M4 | Minor | `src/server/suggestions.ts:191-205` | gia cố (mức kế hoạch; **không** để builder tự sửa trong task này) | Người không có quyền gọi `decide` vẫn: lấy khoá tư vấn của nháp (`:191`), kéo cả dòng kể cả `value` vào Node (`:192`), chèn một dòng khoá lệnh (`:200`), rồi mới bị từ chối và lùi. Không lộ gì ra câu trả lời. Hệ quả còn lại: nội dung nằm trong bộ nhớ tiến trình cho một người không được đọc (P5 đã nêu), và một vai đọc có thể làm các lệnh quyết định của người điều phối phải xếp hàng sau khoá bằng cách gọi lặp. | Vai lấy từ phiên và `entity_type` của một bảng bất biến, nên phép xét quyền có thể đứng ngay sau `:187` với một câu đọc chỉ lấy `entity_type`, trước khoá và trước `DRAFT_SQL`; câu trả lời cho người gọi không đổi, chỉ đổi vị trí so với lỗi lược đồ lệnh. Việc này trái dòng «không đổi gì trước khoá lệnh» của brief, nên cần planner sửa kế hoạch trước; nếu không sửa thì ghi thành phần dư, kèm điều kiện giới hạn tần suất khi có tuyến HTTP. | Planner quyết; Builder làm sau |
| M5 | Minor | `src/server/suggestions.ts:96-99` | bất biến chưa được mã ép | Chú thích của kiểu nói `maskReasons` «sorted; empty exactly when the content is returned». `toView` không ép điều nào: gọi với `mask` rỗng và `shown` là `null` cho ra dòng `maskReasons: []` không nội dung và **có** `valueHash`; gọi với nhiều mã thì thứ tự là của nơi gọi. Hôm nay không tới được và là fail-closed; Task 4a/4b sẽ thêm mã vào đúng hàm gọi nó. | Trong `toView`: sắp `mask` tại chỗ dựng, và ném lỗi bất biến khi `mask` rỗng mà `shown` là `null` (hoặc đổi chữ ký thành hợp có nhãn để trình biên dịch ép). | Builder (Task 4a) |

## Quan sát không thành finding

- `x.command_key AS dec_key` (`:75`, `:80`) được cả hai câu lệnh đọc nhưng không nơi nào dùng. Có từ trước, brief chép nguyên. Khoá lệnh của người quyết định vì thế tới Node cho mọi người đọc, không ra câu trả lời. Gỡ khi tiện.
- `DRAFT_META_SQL` trả `d.manifest_hash` ở nhánh `THEN` thay vì chính hằng. Với phép `=` so byte thì hai thứ là một, và `:94` so lại bằng `===`. Không cần sửa.
- Global Constraints viết «mọi câu đọc của dịch vụ có `project_id=$n`». Ba câu đọc có sẵn của `decide` (`:186`, `:192`, `:249`) lọc theo `d.id` và dựa vào phạm vi RLS đã thu hẹp ở `:189`. Không thuộc thay đổi của task này (brief buộc giữ «WHERE d.id=»); nêu để review cuối của PR xét chữ của ràng buộc.
- Tại riêng commit này, nháp của dự án đã thành `IBS_HI` sau khi lưu vẫn trả nội dung cho người có quyền quyết định; lớp che đó là Task 4a. PR không nên được tách hay phát hành ở điểm giữa Task 3 và Task 4a.

## Mục cảnh báo — không kiểm được từ diff, phiên chính nên kiểm

1. **Lượt PostgreSQL 16 thật cho L1–L9.** Biểu thức `$6::jsonb ->> d.signal_type` và các `NULL::kiểu` chỉ được builder chạy trên PGlite. Phiên chính đã khai lượt native (144 đạt, 0 bỏ qua): giữ log đó làm bằng chứng, đếm `timed out` bằng 0.
2. **Con số của R15 và chữ của B1 về `createdAt`** (M3): quyết trước khi chép phần dư vào biên nhận.
3. **R7 — `Principal` dựng từ phiên.** Luật đọc tin vai trong phiên; một người vừa bị hạ vai vẫn đọc nội dung tới khi phiên được dựng lại. Đường dựng `Principal` nằm ngoài diff và chưa cổng nào soát: kiểm trước khi bật Z4.
4. **M4 cần phán quyết của planner** (xét quyền trước khoá, hay ghi phần dư).
5. **Review Task 4a/4b phải kiểm lại** hai điều commit này dựa vào: trong `present`, nhánh «không có quyền» vẫn trả **trước** mọi phép kiểm lược đồ, mọi lần dựng ngữ cảnh và mọi câu đọc luồng (đúng một mã, không lộ bit nào về giá trị); và `toView` vẫn chỉ được gọi từ `present`.
6. **Khi có tuyến HTTP gọi dịch vụ này** (chưa có): ánh xạ lỗi lược đồ và lỗi CSDL thô, giới hạn tần suất cho `decide`, không ghi thân câu trả lời vào log. Thuộc danh sách «trước khi bật Z4».
7. **Log bằng chứng.** `task-3-red.txt` và `task-3-green.txt` in đường dẫn thư mục máy ở dòng tiêu đề của vitest. Thư mục `.superpowers/` đang bị bỏ qua nên chưa lộ; nếu chép log vào `docs/reviews/…` thì thay đường dẫn bằng `<repo>` lúc ghi.
8. Chưa kiểm: ngưỡng coverage, lint, và working tree của builder kế tiếp (hai tệp này đang được sửa cho Task 4a).

## Ba việc đáng làm nhất

1. M1 — cho L3 một danh sách khoá cho phép và một đối chứng dương, trước khi Task 4a/4b đụng tiếp vào hai câu lệnh đọc.
2. M3 — sửa chữ của R15/B1 (hoặc làm tròn `createdAt`) trước khi phần dư vào biên nhận.
3. M5 — để `toView` tự ép bất biến «che ⇔ không nội dung» và tự sắp mã, trước khi `present` có nhiều hơn hai lý do.

Task quality: Approved
