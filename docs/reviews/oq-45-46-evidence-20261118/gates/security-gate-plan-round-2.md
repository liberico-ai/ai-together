PLAN NEEDS CHANGES

# Cổng bảo mật trên kế hoạch OQ-45 và OQ-46 — vòng 2

- Ngày: 18/11/2026. Người soát: `liberico-security-reviewer` (chỉ nêu finding; không sửa kế hoạch, không viết mã).
- Thứ được soát: `docs/plans/oq-45-46-ai-drafts.md` bản 0.2 (741 dòng) và phần chưa commit của `docs/OPEN-QUESTIONS.md` (OQ-53 sửa tại chỗ, OQ-54 thêm một dòng, OQ-55 mới). Base `4f12a3c`. Chưa có dòng mã nào của PR.
- Cách soát: đọc kế hoạch và mã tại base. Không chạy test, không kết nối CSDL. Số dòng của kế hoạch trong báo cáo này là của bản 0.2.
- Nhãn: `#fact` = đọc được từ tệp trong repo hoặc từ tài liệu PostgreSQL 16; `#inference` = suy luận, chưa có lượt chạy nào xác nhận.
- Kết quả: N1 khép một phần, N2 khép, N3 khép. Mục mới: 1 phải sửa (N4), 2 nên sửa (R8, R9), 3 ca kiểm còn thiếu (C11–C13), không câu hỏi mở mới (một bổ sung cho OQ-55, nằm trong R9).
- Không finding nào chạm hệ thống vận hành của IBS HI. Không gắn cờ an toàn.

Bản 0.2 áp đủ và đúng mọi mục của lượt 1, trừ một chỗ còn lại của N1. Dưới lớp che, `sources` vẫn giữ **thứ tự và số lần lặp** do bên ghi chọn, nên thứ còn lại không phải «một tập con» và con số «tối đa 100 bit mỗi dòng» ở R15 sai khoảng 6,6 lần. Sửa là một mệnh đề ở Task 4a và một phép khẳng định ở ca M8.

**Về lượt 3.** N4 là thay đổi cơ học và đã được tả đủ ở dưới. Nếu kế hoạch sửa đúng như N4 tả thì cổng không cần soát lại kế hoạch lần nữa: Task 3, 4a, 4b đã có review bảo mật bắt buộc trên mã, và đó là nơi kiểm. Phiên chính quyết việc ghi nhận điều này.

## Bước 0 — quét bí mật

- `#fact` Không tệp được theo dõi nào có tên khớp `.env`, `secret`, `credential`, `key`, `token`.
- `#fact` Bản 0.2 và phần diff của `docs/OPEN-QUESTIONS.md` không có đường dẫn máy, không khớp mẫu JWT, chuỗi kết nối có mật khẩu, khối khoá PEM hay mã nhóm Telegram.

### Ngoài phạm vi kế hoạch, phải xử lý trước khi ai chạy test hay commit: 782 tệp bản sao « 2» chưa theo dõi trong worktree

- `#fact` Đầu lượt 2, `git status --short` có ba dòng (tệp `docs/OPEN-QUESTIONS.md` đã sửa, kế hoạch, thư mục bằng chứng). Cuối lượt 2 có 784 mục chưa theo dõi, trong đó 782 mục mang đuôi « 2» trước phần mở rộng (ví dụ `AGENTS 2.md`, `migrations/003_runtime_roles 2.sql`). Phân bố: `docs/` 478, `src/` 125, `tests/` 78, `migrations/` 30 (21 tệp `.sql` ở thư mục thuận, 9 ở `rollback/`), `skills/` 18, `.claude/` 4, `bot-plugin/` 2.
- Người soát không tạo các tệp này: lượt này chỉ chạy lệnh đọc và ghi đúng một tệp báo cáo. `#inference` Hình dạng tên trùng với bản sao do iCloud sinh; nguyên nhân chưa được kiểm.
- `#fact` Theo tên, không mục nào là bản sao của đường dẫn đang bị `.gitignore` chặn (`data/`, `.runtime/`, `.env*`, `BASELINE.json`, `.superpowers/`); các mục khớp từ khoá nhạy cảm đều là bản sao của tệp đã được theo dõi. Chỉ so tên, không mở tệp nào.
- Hệ quả nếu để nguyên:
  - `git add -A` hoặc `git add .` đưa 782 tệp vào một repo đang công khai.
  - `#fact` Bộ nạp migration lấy mọi tệp khớp `^\d+.*\.sql$` (`src/server/db.ts:11`), nên 21 bản sao sẽ được áp như migration.
  - `#inference` vitest sẽ nhặt 78 bản sao trong `tests/`, và các ca quét thư mục `src` (ca canh tuyến; hai danh sách tệp của `tests/source-text.test.ts`) sẽ thấy 125 bản sao. Số gốc 1 104 và 1 166 của kế hoạch khi đó không so được, và «đỏ» không còn là bằng chứng hành vi.
- Việc cần làm (phiên chính hoặc Chairman, không phải builder): xác định nguồn sinh, gỡ các bản sao, rồi đo lại `git status` trước Task 1. Mẫu `.gitignore` hiện tại không chặn tên dạng `* 2.*`.

---

## 1. Các mục của lượt 1 đã khép chưa

### N1–N3

| Mục | Trạng thái | Chỗ áp trong bản 0.2 | Nhận xét |
|---|---|---|---|
| **N1** — `sources`, `manifestHash` mang bit do bên ghi chọn | **Khép một phần** | C1 `:64`; B1 `:109`; B2 `:113-141`; `DRAFT_META_SQL` `:458-459`; `toView` `:464-467`; Task 4a `:506`; ca L1 `:474`, L3 `:476`, L4 `:477`, M8 `:519`; K2 `:303` | Phần người không có quyền: khép. `sources` là `[]` ngay trong SQL, `manifest_hash` so với hằng ngay trong SQL, không cột nội dung nào tới tiến trình Node. Phần dưới lớp che: còn N4. |
| **N2** — nháp ứng viên chép chữ của tin mà không nêu mã tin | **Khép** | OQ-55 (`docs/OPEN-QUESTIONS.md:899-908`); C2 `:65`; P3 `:77`; B3 bước 5 `:157`; Task 4b `:528-571`; ca Q1–Q7; M4 thu về nháp tài liệu `:515` | Câu hỏi mở đã ghi. Giữ chỗ xét mọi bản của mọi tin của luồng, không theo trần 20 tin, đúng như lượt 1 yêu cầu. Còn một điểm nhỏ về logic ba trị ở câu SQL: R8. |
| **N3** — `decide` cho người không có quyền thử `valueHash` | **Khép** | B2 `:147`; Global Constraints `:244`; Task 3 `:470`; ca L8 `:481`; đối chiếu ca hiện có `:306` | Phép xét quyền là dòng đầu của thân khoá lệnh. `#fact` Trước khoá lệnh không có phép so nào phụ thuộc nội dung nháp (`src/server/suggestions.ts:134-155`). `#inference` Danh sách lời gọi ở `:306` khớp với các ca đã đọc ở lượt 1; không ca hiện có nào đổi kỳ vọng. |

### cổng-R1 … R7

Cả bảy đã vào đúng chỗ, đúng nội dung:

- **R1** — H1 loại đúng một tên (`:291`); G12 khẳng định danh sách trigger đầy đủ của cả hai bảng (`:394`).
- **R2** — K3 viết đủ bốn phép khẳng định, có «đúng một bên thành công», tên mới, và lý do thứ tự (`:304`).
- **R3** — P12 (`:86`), `toView` (`:466`), ca L7 (`:480`): `questions`, `confidence`, `sources` lấy từ giá trị đã qua lược đồ; `skillVersion` chỉ khi trùng manifest hiện hành.
- **R4** — G12 có `tgenabled='O'` và `tgtype=7` (`:394`); điều kiện «pipeline từ chối khởi động» nằm trong danh sách trước khi bật Z4 (`:727`). `#fact` `tgtype=7` là ROW + BEFORE + INSERT.
- **R5** — R6 viết lại với kích thước đúng (`:204`); OQ-53 Phía B có đoạn bổ sung (`docs/OPEN-QUESTIONS.md:876`).
- **R6** — B4 mục (a), (b), (c) (`:174-178`); R4 (`:202`); ca G13 (`:395`).
- **R7** — C8 mới (`:71`), ghi rõ không phải hướng chặt nhất; H4, H5 ghi đúng lý do là giữ chỗ của OQ-53 (`:294-295`).

### cổng-C1 … C10

| Ca lượt 1 | Ca trong bản 0.2 | Đúng điều khẳng định |
|---|---|---|
| C1 | L4 (`:477`) | Đúng. Xét cả câu trả lời lẫn các dòng trao cho dịch vụ. |
| C2 | M8 (`:519`) | Đúng với điều lượt 1 nêu; cần thêm thứ tự và lặp (N4, C11). |
| C3 | Q1 (`:561`) | Đúng; có cả đối chứng khi cờ còn và người không có quyền. |
| C4 | Q2 (`:562`) | Đúng; có bước kiểm trước rằng hai bản là `excerpt` rồi `pointer_only`. |
| C5 | L8 (`:481`) | Đúng; phủ cả hai kết quả, hash đúng và sai, nháp đã có quyết định, và số khoá lệnh. |
| C6 | G13 (`:395`) | Đúng; thêm cả role nhận tin. |
| C7 | G14 (`:396`) | Đúng; có đối chứng hai dòng lưu được. |
| C8 | G15 (`:397`) | Đúng hơn chữ của lượt 1 — xem dưới. |
| C9 | M9 (`:520`) | Đúng. |
| C10 | T8 (`:655`), và Q5 cho hàm mới (`:566`) | Đúng; có đối chứng dưới phạm vi của `pm`. |

### Hai chỗ planner áp khác chữ của lượt 1

**cổng-C8 → G15: planner đúng, cổng chấp nhận.** Lượt 1 viết «lỗi là lỗi ràng buộc» cho dòng thiếu `tenant_id` hoặc `project_id`. Câu đó chỉ đúng với role vượt RLS.
- `#fact` Tài liệu `CREATE POLICY` của PostgreSQL 16: biểu thức `WITH CHECK` được áp trước mọi ràng buộc khác.
- `#fact` Policy `ai_insert` so `tenant_id` và `project_id` với ngữ cảnh (`migrations/021_ai_suggestions_z4.sql:100-103`); phép so với `NULL` không cho «đúng».
- `#inference` Vì vậy dưới role AI dòng thiếu một trong hai cột nhận lỗi RLS (42501) trước khi NOT NULL được xét; chỉ login vận hành (vượt RLS) nhận 23502. G15 khẳng định cả hai, và ở cả hai câu trả lời không phải của guard. Đó là điều lượt 1 muốn ghim. Lượt native xác nhận.

**R15 — cổng không yêu cầu `sources` là `[]` dưới lớp che, với điều kiện N4 được sửa.**
- Chữ của quyết định điểm 2 là «chỉ trả mã và lý do giữ»: trả mã nguồn cho người có quyền quyết định nằm trong chữ đó.
- Người nhận là người có quyền cao nhất với nháp đó. Qua đường `submitDraft`, mô hình không chọn được bit của `valueHash` (dịch vụ tự băm, `src/server/suggestions.ts:93`), nên tập con mã là kênh duy nhất mô hình điều khiển được dưới lớp che.
- Sau khi sửa N4, kênh đó là tối đa một bit cho mỗi nguồn của ngữ cảnh, tức tối đa 100 bit (12,5 byte) mỗi dòng. Chấp nhận như phần dư R15.
- `[]` vẫn là hướng chặt hơn và cũng được chấp nhận. Không gì trong PR này dùng `sources` dưới lớp che; nếu phiên chính không nêu được nơi dùng thì chọn `[]` là gọn nhất và N4 tự hết.

---

## Phải sửa trước khi viết mã

### N4 — dưới lớp che, `sources` giữ thứ tự và số lần lặp do bên ghi chọn; con số ở R15 sai

**Chỗ trong kế hoạch.** Task 4a (`:506`): «`maskedSources` = các phần tử của `r.sources` có `id` nằm trong `ctx.sources`, **giữ thứ tự**». B2 (`:135`). `SOURCE_IDS_SQL` (`:447-449`) giữ thứ tự của cột và không bỏ phần tử lặp. R15 (`:213`) và mục 13 của «Dừng và chỗ chưa chắc» (`:717`): «tập con … tối đa 100 bit mỗi dòng».

**Căn cứ.**
- `#fact` Hợp đồng đầu ra cho `sources` tới 100 phần tử và không đòi các mã khác nhau (`src/server/skill-contracts.ts:33,50`). CHECK của cột chỉ ràng độ dài mảng (`migrations/021_ai_suggestions_z4.sql:48-49`).
- `#fact` Ngữ cảnh có tối đa 100 nguồn (`src/server/skill-context.ts:18,90`).

**Kịch bản.** Bên ghi đặt vào `sources` một dãy tới 100 phần tử, mỗi phần tử là một mã bất kỳ trong ngữ cảnh, lặp tuỳ ý, theo thứ tự tuỳ ý. Phép lọc «có trong ngữ cảnh» giữ nguyên cả dãy. Thứ người đọc nhận là một **dãy**, không phải một tập con: 100 × log2(100) ≈ 664 bit, tức khoảng 83 byte mỗi dòng, và 200 dòng mỗi lần gọi `list`. R15 ghi 100 bit (12,5 byte).

`#inference` Người nhận chỉ là người có quyền quyết định, và cần một bên ghi thù địch cùng một người đọc biết giải mã. Mức rủi ro thấp. Lý do xếp vào «phải sửa»: đây là phần còn lại của đúng lỗi N1, con số sai sẽ đi vào biên nhận và tới Chairman, và sửa chỉ là một mệnh đề.

**Sửa thế nào** (chọn một):
1. `maskedSources` = các mã **khác nhau** của cột `sources` có trong `ctx.sources`, trả theo **thứ tự của `ctx.sources`** (thứ tự do dịch vụ tính), không theo thứ tự của cột. Sửa cùng lúc: Task 4a `:506`, B2 `:135`, chú thích của `SOURCE_IDS_SQL` `:446`, R15 `:213`, mục 13 `:717`. R15 khi đó đúng: tối đa một bit cho mỗi nguồn của ngữ cảnh. Thêm phép khẳng định vào M8 theo ca C11.
2. Hoặc `sources` là `[]` dưới mọi lớp che. Khi đó bỏ `SOURCE_IDS_SQL` khỏi `DRAFT_SQL`, sửa kỳ vọng `sources` của M1 (i), M3 (i), M8, Q1, và R15 chỉ còn `valueHash`.

Nhân tiện sửa R15 cho đủ ở phần người không có quyền: mỗi dòng mang khoảng 3,6 bit do bên ghi chọn (kỹ năng: sáu giá trị; một bit «`manifestHash` có khớp không»), cộng số dòng và thứ tự chèn.

---

## Nên sửa

- **R8 · Câu «luồng có chữ đang ẩn» nên fail-closed khi biểu thức hiển thị không xác định** (kế hoạch `:547-551`). Câu lệnh dùng `NOT (textAllowedSql)`. `#fact` `textAllowedSql` là `chat_id = ANY($3::text[]) AND NOT …` (`src/server/source-text.ts:24-25`). `#inference` Nếu mảng nhóm có một phần tử `NULL` và nhóm không khớp phần tử nào, `= ANY` cho `NULL`, `NOT NULL` vẫn là `NULL`, dòng không được tính và hàm trả «không có chữ đang ẩn»: không che. Ở cùng tình huống, luật hiển thị có sẵn rơi về «ẩn» vì dùng `CASE WHEN … THEN … ELSE` (`src/server/source-text.ts:30-32`). `#fact` Cấu hình bridge chỉ nhận chuỗi mã nhóm (`src/server/bridge-config.ts:10`), nên việc này chỉ xảy ra khi một nơi dựng dịch vụ truyền sai; chưa có nơi nào dựng dịch vụ ngoài test. Viết `(…) IS NOT TRUE` thay cho `NOT (…)`. Cùng mục: lối tắt «mã không phải uuid thì trả `false`» (`:541`) là câu trả lời không che; `present` không tới được nhánh đó vì mã lấy từ cột uuid, nhưng nên trả `true` hoặc ghi rõ trong chú thích rằng `false` ở đây không được dùng như một lần cho qua.
- **R9 · OQ-55 nên nêu rằng nháp tài liệu dựng từ chữ của tin là đường có sẵn, không chỉ là đường của đối thủ** (`docs/OPEN-QUESTIONS.md:904`; kế hoạch R16 `:214`). `#fact` Bộ dựng ngữ cảnh nhận cùng lúc một ứng viên và một tài liệu cho `ba_elicitation` và `pm_planning` (`src/server/skill-context.ts:22-24,31,48-49,53-66`): ngữ cảnh khi đó có cả chữ của tin lẫn các bản của tài liệu. Một pipeline trung thực có thể ghi một nháp **tài liệu** từ ngữ cảnh đó. Lúc đọc và lúc xác nhận, dịch vụ dựng lại ngữ cảnh chỉ theo tài liệu: nêu mã tin thì bị che và bị giữ, không nêu thì chữ đi qua. Thêm một câu vào đoạn «Giới hạn» của OQ-55 và vào R16; điều này làm phương án (b) và (e) nặng ký hơn khi Chairman cân.

---

## Ca kiểm còn thiếu

- **C11 `under a mask the source ids are a set in the service's order: a repeated id is returned once and the writer's order is not kept`** — dòng chèn thô có cột `sources` nêu hai mã của ngữ cảnh theo thứ tự ngược với ngữ cảnh, một trong hai lặp 60 lần; dịch vụ dựng với danh sách nhóm rỗng; `pm` đọc: `sources` có đúng hai phần tử, theo thứ tự của ngữ cảnh. Thêm vào M8 hoặc thành ca riêng. (N4, cách sửa 1. Với cách sửa 2 thì ca này là: `sources` bằng `[]`.)
- **C12 `threadHasHiddenText is closed when the list of flagged groups cannot be evaluated`** (`tests/source-text.test.ts`) — luồng có bản lưu chữ; gọi với danh sách nhóm có một phần tử `null`: `true`. (R8)
- **C13 `dừng tại OQ-55: a replayed confirmation of a candidate draft answers with the recorded decision and no content once the group's flag is gone`** — `pm` xác nhận một nháp ứng viên có chuỗi đánh dấu khi cờ còn, với khoá `K`; gửi lại đúng lệnh qua dịch vụ dựng với danh sách nhóm rỗng: `decision.result` là `confirmed`, `maskReasons` chứa `THREAD_TEXT_HIDDEN`, `value` là `null`, câu trả lời không chứa chuỗi đánh dấu; `draft_decisions` vẫn 1 dòng. (M9 ghim đường phát lại cho nháp tài liệu và dự án chỉ con trỏ; chưa có ca cho giữ chỗ mới trên đường phát lại.)

---

## 2. Phần mới của bản 0.2

**Task 4b — giữ chỗ OQ-55, mã `THREAD_TEXT_HIDDEN`.**
- Câu SQL (`:547-551`): có `project_id=$1` trên cả ba bảng; dùng lại `textAllowedSql`, tức một luật với mọi chỗ hiển thị chữ; trả đúng một giá trị đúng/sai. `#fact` Role runtime có `SELECT` và policy theo tenant, dự án trên ba bảng (`migrations/016_intake_inbox.sql:161-165,174-178,202-203,257`). Không thấy vấn đề ngoài R8.
- Đưa mã này vào tập lý do giữ của `decide` (`:557`, P3 `:77`): đúng hướng. Bất biến «điều bị che thì không xác nhận được» không còn dựa vào giữ chỗ của OQ-53.
- `#inference` Lập luận «không giữ thêm nháp nào so với sau Task 6» đúng: khi luồng có chữ đang ẩn thì nhóm không được hiện chữ, nên mọi tin của luồng mà nháp nêu đều không hiện chữ (`src/server/skill-contracts.ts:162`), còn nháp không nêu tin nào thì đã bị giữ vì thiếu mốc.
- Người không có quyền quyết định không gây câu đọc nào (`:556`): đúng.
- Tên bảng bản sửa chỉ nằm trong `src/server/source-text.ts`; Task 7 có lệnh canh (`:671`).

**Hình dạng `DraftView` bản 0.2** (`:113-141`).
- Người không có quyền: chỉ nhận giá trị do CSDL đặt, giá trị chính họ nêu, quyết định do người ghi, kỹ năng, và `manifestHash` đã so với hằng. `#fact` Role AI không chèn được `id` và `created_at` (`migrations/021_ai_suggestions_z4.sql:162`). Đúng.
- `manifestHash` so trong SQL bằng tham số jsonb (`:456-459`) và so lại trong `toView` (`:465`): hai lớp, không thấy vấn đề.
- `questions`, `confidence`, `sources` từ giá trị đã qua lược đồ; `skillVersion` chỉ khi trùng manifest: đúng với cổng-R3.
- `modelVersion` trả như đã lưu, chỉ cùng nội dung (R17): chấp nhận. Người nhận đã nhận cả `value`; cột bị ràng 64 ký tự. Tuyến nào về sau hiển thị trường này phải coi nó là chữ không tin.
- Có quyền, bị che: `valueHash` trả (cần để từ chối), `sources` theo ngữ cảnh — xem N4.

**`mayDecide` lên đầu thân khoá lệnh** (`:470`). Không đổi thứ tự khoá. Đường phát lại không chạy thân khoá lệnh nên K2 giữ nghĩa. Không thấy vấn đề.

**Ca mới.**
- L4, L7, L8, L9: điều khẳng định đủ chặt; L4 và L3 xét cả các dòng trao cho dịch vụ, không chỉ câu trả lời.
- M8: cần bổ sung theo C11. M9: đúng.
- Q1–Q7: đúng. Q3 ghim bất biến P3 và khoá lệnh còn tự do. Q7 ghim trung thực rằng nháp tài liệu không được xử lý.
- G13–G15, T8: đúng.
- M1 (ii), M2, M7 dùng phép «chứa» để Task 4b không buộc sửa lại: chấp nhận được, vì các ca đó vẫn khẳng định `value` là `null` và câu trả lời không chứa chuỗi đánh dấu; Q4 ghim tập mã chính xác.

**Ca hiện có đổi kỳ vọng.**
- K1: thêm khoá `maskReasons`; số khoá khớp `DraftView` (16 khoá). K2: chặt hơn (thêm `sources:[]`). K3: viết đủ, không nới.
- H1: không còn thu hẹp. H2, H3: như lượt 1. H4, H5: ghi đúng lý do. H6: chỉ thêm tuỳ chọn và trường trả về.
- `#inference` Hai ca có sẵn có thể bị phép giữ mới chạm vẫn giữ kỳ vọng: «F12-2 …» (`tests/suggestions.test.ts:477`) nêu tin của chính luồng qua `duplicateOf`, mà `namedIds` tính mọi trường mã nên có mốc; «DOC-05 …» (`:112`) đọc một nháp tài liệu không nguồn bằng `pm` và chờ `sources:[]`, khớp với `value.sources`.

---

## 3. OQ-55 như đã viết

- **Hai phía:** nêu đúng. Phía A là đọc đúng chữ của quyết định cùng căn cứ mã; Phía B chép nguyên Phía B của OQ-45 và tả tình huống của cổng, có ghi «không cần đối thủ».
- **Hành vi giữ chỗ:** không được trình như phương án được chọn. Cả mục OQ-55, bảng ở kế hoạch `:60`, Task 4b `:530` và Global Constraints `:231` đều ghi «giữ chỗ fail-closed, không phải phương án được chọn», và ghi rằng đó là phán quyết của phiên chính.
- **Nháp tài liệu:** được ghi rõ là không viết mã và **không phải hướng chặt nhất**; hướng chặt nhất có tên (phương án (e)). Cần bổ sung theo R9.
- **Phương án:** năm phương án, có cả đọc đúng chữ (c) và chặt nhất (e); khuyến nghị được ghi là của planner.
- **Điểm tự chọn theo hướng nới mà không ghi:** không thấy. Ba chỗ bản 0.2 không theo hướng chặt nhất đều được nêu đích danh: C8 (người không có quyền vẫn thấy dòng nháp), nháp tài liệu ở OQ-55, và `sources` dưới lớp che (R15, sẽ đúng số sau N4). `modelVersion` (R17) được nêu ở mục 14 của «Dừng và chỗ chưa chắc».

OQ-53 và OQ-54: hai đoạn bổ sung khớp điều lượt 1 yêu cầu (`docs/OPEN-QUESTIONS.md:876`, `:890`).

---

## Chưa kiểm được

- Mọi hành vi lúc chạy, trên PGlite lẫn PostgreSQL 16. Các ca G5, G7, G9, G14, G15 trên động cơ thật là nơi xác nhận thứ tự trigger, RLS, ràng buộc và phép dò trùng.
- Đường dựng `Principal` từ phiên (R7 của kế hoạch): vẫn chưa soát; kế hoạch đã đưa vào danh sách trước khi thêm tuyến đọc nháp (`:731`).
- Mô hình có làm theo chữ điều khiển để mã hoá vào `sources` không: chưa có mô hình nào chạy.

## Chỗ sửa có tác dụng lớn nhất

1. **N4** — trả tập mã không lặp theo thứ tự của ngữ cảnh (hoặc `[]`), và sửa con số ở R15.
2. **R8** — `IS NOT TRUE` trong câu «luồng có chữ đang ẩn», để giữ chỗ mới không tắt lặng lẽ khi cấu hình sai.
3. **R9** — một câu trong OQ-55 về ngữ cảnh hỗn hợp, để Chairman cân phương án (b) và (e) trên dữ kiện đủ.
