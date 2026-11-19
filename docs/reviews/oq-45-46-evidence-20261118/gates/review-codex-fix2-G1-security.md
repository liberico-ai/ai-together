# Review bảo mật của Task G1 (vòng sửa 2 của cổng Codex) và lượt quét hẹp cùng lớp

- Phạm vi: diff `05a6da0..ff24901` (`src/server/suggestions.ts`, `tests/suggestions.test.ts`), tệp `src/server/suggestions.ts` hiện hành đọc đủ (có cả F5), nhóm ca H1–H7 và ba ca đã đổi (M1, X1, «the context is built under the confirming person, not a wider principal»), brief và báo cáo của builder.
- Người soát: reviewer độc lập, chỉ đọc. Không chạy vitest, không chạm CSDL. Bằng chứng chạy (đỏ 7 `AssertionError` trên mã cũ; PGlite 196 qua / 1 bỏ qua; PostgreSQL 16 206 qua; typecheck 0) là của phiên chính, không chạy lại.
- Quyết định được hiện thực (chép nguyên): «OQ-45: 1b, 2b, 3b. OQ-46: b, mốc là bản mới nhất nháp nêu». Chữ của phương án 2 (b) mà quyết định chọn (`docs/OPEN-QUESTIONS.md:668`, chữ của mục OQ-45, không phải lời Chairman): «… che `value` khi nháp trích tin người đó không đọc được chữ hoặc dự án đang chỉ con trỏ, chỉ trả mã và lý do giữ.»
- Phát hiện của cổng (vòng 2): nháp bị che vẫn trả `valueHash`, từ đó đoán được ngoại tuyến một `value` ít giá trị; phép so hash trong `decide` là phép thử trực tuyến. Đây là S1 của `sweep-oracles-masking.md` (phần dư R3).

## A. Phát hiện đã đóng chưa

**Ngoại tuyến — đóng.**

- `toView` (`src/server/suggestions.ts:105-106`): mọi nhánh có lớp che trả `valueHash:null`. `toView` là nơi duy nhất dựng `DraftView` (`present`, `:194-223`). Vậy `list`, câu trả lời thành công của `decide` (`:347`), phát lại (cùng `:345-347`) đều không còn hash dưới lớp che. H1 ghim đủ bảy mã che, và ghim rằng JSON của câu trả lời không chứa hash đã lưu.
- Câu lỗi: `REVISION_CONFLICT`, `DRAFT_HELD`, `REASON_REQUIRED`, `READ_ONLY`, `MANAGER_REQUIRED`, `DRAFT_ALREADY_DECIDED` là câu hằng hoặc ghép từ tập mã đóng. `VALUE_HASH_MISMATCH` (`:301`) so giá trị đã lưu với hash đã lưu, không dùng gì của người gọi, và không mang hash.
- Không mô-đun nào khác của `src` đọc `draft_decisions` hay `value_hash`. Phản hồi idempotent đã lưu chỉ có `{decisionId}` (`:342`).

**Trực tuyến — đóng.** Với người mà nháp bị che (cùng ngữ cảnh ở cả lúc lệnh tới lẫn ở bước giữ):

- `REVISION_CONFLICT` của `:282` không chạy. Lệnh xác nhận luôn dừng ở `DRAFT_HELD` (`:320`), vì mọi mã che đều là mã giữ: `SCHEMA_INVALID`, `SOURCE_OUT_OF_CONTEXT` và `TEXT_NOT_VISIBLE` đến từ `checkSkillOutput` (`:307`, lấy đủ tập); `POINTER_ONLY_PROJECT` (`:306`); `ENTITY_NOT_FOUND` (`:304`); `THREAD_TEXT_HIDDEN` (`:309`, hoặc `ENTITY_NOT_FOUND` khi không có ngữ cảnh); `PROJECT_TEXT_HIDDEN` (`:313`). Vì vậy phép so lần hai (`:323`) không bao giờ tới được. Lệnh từ chối được ghi, dù hash gửi kèm là gì. H2 và H3 ghim cả hai nhánh.
- Dấu vân lệnh idempotent (`:271`) băm **đầu vào của chính người gọi**, kèm hash họ đoán, và khoá lệnh theo (tenant, người, khoá) (`document-commands.ts:13-22`). Vì thế `IDEMPOTENCY_CONFLICT` chỉ so lần gửi này với lần gửi trước của chính người đó, không bao giờ với hash đã lưu.
- `draft_decisions_guard` (`migrations/021_ai_suggestions_z4.sql:133-135`) so `NEW.draft_value_hash` với dòng nháp. Dịch vụ luôn điền `d.value_hash` (`:334`), nên không giá trị nào của người gọi tới được phép so đó.
- Thời gian: lệnh tới bị che hay không thì vẫn chạy cùng các câu lệnh. Không có nhánh nào phụ thuộc vào việc hash gửi kèm có trúng hay không.

## B. Bản sửa có mở ra gì không

- **Quyền vẫn đứng đầu.** `present` của `:281` chỉ chạy sau `mayDecide` (`:273`) và sau «đã quyết» (`:277`). Người không có quyền nhận đúng một câu, bất kể hash là gì (ca H5). Phép kiểm này không dựng ngữ cảnh nào cho họ.
- **Không có xác nhận nào đi qua mà thiếu hash đúng.** Mọi đường tới `proposeRevisionIn` và tới `INSERT` của một lệnh xác nhận đều qua `:323`. Ba tình huống:
  - Lớp che **gỡ ra** giữa lúc lệnh tới và bước giữ: so ở `:323` (ca H7, nhánh không có hash).
  - Lớp che **phủ xuống** giữa chừng: hash đã được so ở `:282`, rồi bước giữ chặn lệnh.
  - Ánh xạ đổi sang `IBS_HI` sau bước giữ: F5 chặn ở trigger của `draft_decisions`.
  Hai instance dịch vụ có danh sách nhóm khác nhau: mỗi lệnh tính lớp che theo danh sách của instance nhận lệnh, và `:323` vẫn đòi hash đúng trước khi ghi một xác nhận.
- **Lệnh từ chối.** Người có quyền mà nháp bị che với họ thì từ chối được mà không cần hash. Trước bản sửa họ cũng từ chối được, vì đã nhận hash trong `list`. Năng lực mới chỉ là «không phải gửi hash», và nó nằm dưới cách đọc C3 đang chờ Chairman. Không ai ngoài người có quyền quyết định làm được việc này. Một trường hợp biên chưa có ca: lệnh tới khi nháp bị che, rồi lớp che gỡ ra trước khi ghi. Khi đó một lệnh từ chối không kèm hash vẫn được ghi cho một nháp mà lúc ghi người đó đã được xem (P3-2).
- **Phát lại.** Không đổi: khoá lệnh trả `{decisionId}` và câu trả lời đọc lại qua `present`. Dưới lớp che câu trả lời không có hash (ca H6). Một lệnh đã ghi trước bản sửa (luôn có `valueHash`) vẫn phát lại với đúng thân đó.
- **Người không có quyền, người khác dự án, AI.** Đường đi không đổi: 404 trước mọi câu lệnh có ý nghĩa, rồi tới câu của bước quyền.

## C. Các ca

| Ca | Ghim đúng điều tên ca nói? | Đỏ được không |
|---|---|---|
| H1 | Có: đủ bảy mã che (so với mảng chữ), `valueHash:null`, và hash đã lưu không có trong JSON | Có: mã cũ trả hash (đỏ ở `ENTITY_NOT_FOUND`) |
| H2 | Có: hash đúng, hash sai, không hash → cùng mã, trạng thái và câu; không có `REVISION_CONFLICT`; không quyết định nào được ghi | Có: hash sai → `REVISION_CONFLICT` trên mã cũ |
| H3 | Có: từ chối không hash và hash sai đều được ghi; câu trả lời không nội dung, không hash; dòng quyết định mang hash đã lưu | Có (lỗi `ZodError` không có `decision`) |
| H4 | Có: khi nội dung được hiện, thiếu hash hoặc hash sai → `REVISION_CONFLICT` ở từ chối và ở xác nhận nháp tài liệu | Có |
| H5 | Có, nhưng chỉ cho nháp ứng viên (`READ_ONLY` không tới được qua `decide`, có giải thích); một câu duy nhất cho 3 dạng hash × 2 kết quả, và câu đó là `MANAGER_REQUIRED` | Có. Nó cũng đỏ nếu ai dời phép so hash lên trước bước quyền |
| H6 | Có: phát lại dưới lớp che, cùng `decision`, không hash, một dòng quyết định | Có |
| H7 | Có, cho nhánh **không hash**: lớp che gỡ ra giữa chừng → `REVISION_CONFLICT`, không quyết định, không bản mới; đối chứng với hash đúng → `confirmed`. Khối `finally` dọn bộ điều khiển mock | Có. Chưa có nhánh **hash sai** (P3-3) |
| M1 | Có: `valueHash:null` thay cho `sha(a.output)` | Có |
| X1 | Có: hai lần dựng ngữ cảnh đều nhận ngữ cảnh trước ánh xạ, nên phép kiểm vẫn tới trigger F5. Báo cáo của builder chỉ ra đúng chỗ ca này từng xanh vì lý do sai | Có |
| «context … under the confirming person» | Có: hai lần dựng, lần nào cũng dưới đúng người và đúng đầu vào | Có |

## Phát hiện

| # | Mức | Vị trí | Kịch bản | Sửa nhỏ nhất |
|---|---|---|---|---|
| P2-1 | **P2** | `src/server/suggestions.ts:307`, `:310`, `:320` | Nháp tài liệu bị che `['PROJECT_TEXT_HIDDEN']`. Người có quyền gửi lệnh xác nhận → `DRAFT_HELD` liệt kê **mọi** mã của cổng: `SOURCE_REQUIRED`, `UNSOURCED_CLAIM`, `TOOL_NOT_ALLOWED`, `NOT_APPROVED_REVISION`, `MANIFEST_MISMATCH`, `VALUE_HASH_MISMATCH`, `SUBJECT_CHANGED`/`SUBJECT_BASELINE_MISSING`. Đó là khoảng tám bit cố định về nội dung bị che. Lệnh lùi hết nên gọi lại được tuỳ ý. Theo chữ của 2 (b) thì được phép («mã và lý do giữ»), nhưng đây là phần còn lại lớn nhất suy ra từ `value` (S4 của lượt quét trước; R15 bản 0.8) | Khi tập mã có ít nhất một mã che (`SCHEMA_INVALID`, `SOURCE_OUT_OF_CONTEXT`, `TEXT_NOT_VISIBLE`, `POINTER_ONLY_PROJECT`, `ENTITY_NOT_FOUND`, `PROJECT_TEXT_HIDDEN`, `THREAD_TEXT_HIDDEN`): `DRAFT_HELD` chỉ nêu các mã che đó, cộng `SUBJECT_ORDER_UNVERIFIED`. Khoảng ba dòng ở `:320`, cộng một ca. Kiểm trước rằng không ca nào đòi mã khác trên một nháp bị che |
| P3-1 | P3 | `src/server/skill-context.ts:68-71`; `src/server/suggestions.ts:210`, `:310` | Người ghi được tài liệu đổi trạng thái dự án: thêm tài liệu có `ref_code` xếp trước để đẩy một tài liệu ra ngoài cửa sổ 50, hoặc thêm bản mới. Rồi họ xem `SOURCE_OUT_OF_CONTEXT` trong `maskReasons`, hoặc `SUBJECT_*` trong `DRAFT_HELD`, đổi theo. Từ đó biết nháp bị che nêu mã nào. Chỉ lộ mã, không lộ chữ; các mã đó họ vốn thấy trong dự án | Ghi thành phần dư (cùng R11/R15). Sửa P2-1 bỏ được nửa `DRAFT_HELD` của kênh này |
| P3-2 | P3 | `:281-287` | Lệnh từ chối tới khi nháp bị che (cờ nhóm tạm gỡ), rồi trong lúc lệnh chạy lớp che gỡ ra. Lệnh vẫn được ghi mà không cần hash, cho một nháp mà ở thời điểm ghi người đó đã được xem. Hệ quả nghiệp vụ nhỏ: nháp bất biến, và từ chối không ghi gì vào Z1 | Chấp nhận theo C3; hoặc với `rejected` cũng so lại ở cuối như `:323`, nếu lúc ghi lớp che đã gỡ. Đó chỉ là thứ tự của hai phép kiểm |
| P3-3 | P3 | `tests/suggestions.test.ts` (H7) | H7 chỉ thử «lớp che gỡ ra + **không** hash». Chưa có «lớp che gỡ ra + hash **sai**», cũng chưa có «lớp che phủ xuống giữa chừng» | Thêm một vòng lặp với `'a'.repeat(64)` trong H7 |
| P3-4 | P3 | `:282`, `:323` | Người được xem nội dung mà quên gửi hash nhận câu «Nháp đã đổi. Đọc bản mới trước khi quyết định.», trong khi nháp bất biến và thực ra không đổi | Một câu riêng cho trường hợp thiếu hash, hoặc giữ nguyên và ghi chú |

Không có P0 hay P1.

## D. Lượt quét hẹp: điều người bị che vẫn nhận hoặc học được về nội dung bị che

| Thứ còn tới tay | Nguồn | 2 (b) «chỉ trả mã và lý do giữ» có phủ không | Mức theo người đọc chặt |
|---|---|---|---|
| `maskReasons` | `toView` `:101` | Có, đúng chữ «mã» | P3. Cho biết nháp nêu một nguồn ngoài ngữ cảnh hay một tin bị ẩn (R11) |
| Tập mã đầy đủ trong `DRAFT_HELD` khi xác nhận | `:320` | Theo chữ thì có («lý do giữ»). Theo tinh thần thì phần mã **không phải mã che** là thông tin về nội dung | **P2** (P2-1). Rủi ro bị xếp P1 thấp: chính cơ sở cổng dẫn ra cho phép «lý do giữ». Cách sửa nhỏ nhất ở bảng trên |
| Kênh thích ứng qua trạng thái dự án | `maskReasons`, `SUBJECT_*` | Có (đều là mã) | P3 (P3-1) |
| `manifestHash` | `:101` | Đây là siêu dữ liệu của dòng (cột bên ghi chọn), chỉ trả khi trùng manifest đang hiệu lực, vốn công khai. Bit «có khớp» trùng với mã `MANIFEST_MISMATCH` | P3 |
| `skill`, `entityType`, `entityId`, `createdAt`, `id`, `projectId` | `:100` | Không phải nội dung. Là con trỏ và siêu dữ liệu; người đọc vốn thấy đối tượng | P3 (R15, R24) |
| `decision` (kết quả, người, lúc, `documentRevisionId`) | `:102` | Không phải nội dung nháp. `documentRevisionId` trỏ tới bản Z1 do chính người xác nhận viết, đọc theo luật tài liệu | P3 |
| `total`, số dòng, thứ tự | `:236` | Không phải nội dung | P3 |
| Thời gian xử lý theo cỡ `value` (`outputFits`, `safeParse`, `sha256` ở `:296`) | `:201`, `:296` | Ngoài chữ. Cỡ tối đa 32 KiB, chênh vài micro giây, chìm dưới nhiễu của câu lệnh CSDL | P3 |
| `valueHash`, phép so hash, `IDEMPOTENCY_CONFLICT`, `draft_decisions_guard` | — | Đã đóng (mục A) | — |

Không mục nào mà theo người soát một người đọc chặt sẽ xếp P0. Mục duy nhất có thể bị đẩy lên P1 là P2-1. Muốn bỏ hẳn rủi ro đó trước lượt cổng cuối thì sửa nhỏ nhất là: khi nháp bị che với người gọi, `DRAFT_HELD` của lệnh xác nhận chỉ nêu các mã che, cộng `SUBJECT_ORDER_UNVERIFIED`.

## Chưa kiểm được

- Không chạy ca nào. Kết quả xanh và đỏ lấy từ log của phiên chính và của builder.
- Chưa kiểm bằng phép chạy rằng hai lần dựng ngữ cảnh trong cùng lệnh (`:281` và `:302`) luôn cho cùng lớp che khi không có ghi đồng thời. Lập luận dựa trên việc cả hai gọi cùng `contextFor` dưới cùng người, trong một giao dịch READ COMMITTED.
- Chưa có tuyến HTTP: chưa biết lỗi `ZodError` của lệnh thiếu trường sẽ được bọc ra sao.
- Báo cáo của builder (`.superpowers/…/task-G1-report.md:98`) có một đường dẫn tuyệt đối của máy. Tệp đó không nằm trong phạm vi review này; nếu nó vào repository công khai thì cần xoá đường dẫn đó trước.

VERDICT: READY FOR GATE
