PLAN NEEDS CHANGES

# Cổng bảo mật trên kế hoạch OQ-45 và OQ-46 — vòng 1

- Ngày: 18/11/2026. Người soát: `liberico-security-reviewer` (chỉ nêu finding; không sửa kế hoạch, không viết mã).
- Thứ được soát: `docs/plans/oq-45-46-ai-drafts.md` bản 0.1 (605 dòng) và hai mục OQ-53, OQ-54 trong phần chưa commit của `docs/OPEN-QUESTIONS.md`. Nhánh `feat/oq-45-46-ai-drafts`, base `4f12a3c`. Chưa có dòng mã nào của PR.
- Cách soát: đọc kế hoạch và mã tại base. Không chạy test, không kết nối CSDL, không đọc `.runtime/` hay `.env*`. Mọi nhận định về hành vi lúc chạy vì thế là đọc mã hoặc suy luận, và được gắn nhãn.
- Nhãn: `#fact` = đọc được từ tệp trong repo hoặc từ tài liệu PostgreSQL 16; `#inference` = suy luận của người soát, chưa có lượt chạy nào xác nhận.
- Kết quả: 3 mục phải sửa, 7 mục nên sửa, 10 ca kiểm còn thiếu, 1 điểm cần thành câu hỏi mở (cùng 2 bổ sung cho OQ-53 và OQ-54).
- Không finding nào chạm hệ thống vận hành của IBS HI; PR chỉ chạm luật xử lý dữ liệu mang nhãn `IBS_HI` trong AI OS. Không gắn cờ an toàn.

Thiết kế guard ở CSDL (migration 022), luật quyền đọc và hai phép kiểm «đối tượng đã đổi» đúng hướng và đúng chữ của bốn quyết định. Kế hoạch chưa đạt ở ba chỗ, đều thuộc vùng (2) «đường thứ hai mang chữ của tin»: hai chỗ là đường vòng qua chính luật che mà PR thêm, một chỗ là kênh phụ ở lệnh quyết định. Cả ba đổi hình dạng `DraftView` hoặc thứ tự kiểm của `decide`, nên phải sửa trong kế hoạch trước khi viết mã.

## Bước 0 — quét bí mật

- `#fact` Không tệp được theo dõi nào có tên khớp `.env`, `secret`, `credential`, `key`, `token`.
- `#fact` `.gitignore` có `.env*` (trừ `.env.example`), `.runtime/`, `*.pem`, `*.key`, `data/`, `.superpowers/`.
- `#fact` Kế hoạch và phần diff của `docs/OPEN-QUESTIONS.md` không khớp mẫu JWT, chuỗi kết nối có mật khẩu hay khối khoá PEM. Không có mã nhóm Telegram, không có tên người.
- Repo đang công khai tạm thời: báo cáo này chỉ dùng đường dẫn tương đối và không chép giá trị nào từ dữ liệu.

## Bảng tổng hợp

| Mức | Chỗ | Lớp lỗi | Căn cứ | Sửa đề xuất | Vai sửa |
|---|---|---|---|---|---|
| P1 | N1 · kế hoạch `:60`, `:86`, `:95-98`, `:389-393` | Kênh ngầm qua trường «kiểu đóng» | `src/server/skill-contracts.ts:50`; `src/server/suggestions.ts:98-99`; `migrations/021_ai_suggestions_z4.sql:41,162` | Người không có quyền: `sources` rỗng; dưới lớp che: chỉ mã có trong ngữ cảnh dựng lại; `manifestHash` chỉ trả khi trùng manifest hiện hành | planner sửa kế hoạch, builder viết |
| P1 | N2 · kế hoạch `:61`, `:158`, `:432`, `:446` | Luật che dựa vào mã nháp tự khai | `src/server/suggestions.ts:84-93`; `src/server/source-text.ts:24-25`; `tests/suggestions.test.ts:112` | Giữ chỗ fail-closed cho nháp ứng viên và ghi câu hỏi mở | planner; Chairman quyết |
| P1 | N3 · kế hoạch `:108`, `:407` | Kênh phụ qua thứ tự mã lỗi | `src/server/suggestions.ts:156-160` | Xét quyền trước `alreadyDecided` và trước phép so `valueHash` | planner, builder |
| P2 | R1–R7 | Ca canh bị thu hẹp, hồ sơ chưa chính xác, trường chưa kiểm | nêu ở từng mục | nêu ở từng mục | planner, phiên chính |

Không mục nào khai thác được hôm nay: không tuyến HTTP nào gọi `SuggestionService`, Z4 chưa bật, role `libetech_ai` không có login (`#fact`: ca «no route imports the suggestion service, …» ở `tests/suggestions.test.ts:641`; `migrations/021_ai_suggestions_z4.sql:13`). Mức P1 là mức của lỗi khi có tuyến đọc nháp.

---

## Phải sửa trước khi viết mã

### N1 — `sources` và `manifestHash` mang bit do bên ghi chọn tới người không được đọc nội dung

**Chỗ trong kế hoạch.** C1 (`:60`): «`sources` luôn chỉ còn các mã đúng dạng uuid». B1 (`:86`): «luật che dựa vào kiểu đóng ở CSDL». B2 (`:95-98`): các trường «luôn có». `SOURCE_IDS_SQL` (`:389-393`). Review Focus 1 (`:210`): chờ «không». Ca L1 (`:411`), L4 (`:414`), M1 (`:443`) ghim `sources:[{id:…}]` cho người bị che.

**Căn cứ.**
- `#fact` Hợp đồng đầu ra cho `sources` là tối đa 100 phần tử `{id: <chuỗi bất kỳ>}` (`src/server/skill-contracts.ts:33,50`).
- `#fact` `submitDraft` lưu nguyên `output.sources` vào cột `sources` (`src/server/suggestions.ts:98-99`). Không bước nào ở lúc ghi kiểm rằng mã tồn tại: `checkSkillOutput` không chạy trong `submitDraft` (`:84-93`).
- `#fact` Cột `manifest_hash` chỉ có CHECK về dạng (`migrations/021_ai_suggestions_z4.sql:41`) và nằm trong danh sách cột role AI được chèn (`:162`). Qua dịch vụ thì giá trị do dịch vụ đặt (`src/server/suggestions.ts:98`); chèn thô thì do người giữ role chọn.
- `#fact` Phép lọc của kế hoạch chỉ kiểm dạng uuid chữ thường. Một chuỗi dạng uuid là 16 byte tuỳ ý.

**Kịch bản.** Người tấn công là mô hình viết nháp thù địch (bị điều khiển bằng chữ trong một tin hoặc trong tiêu đề, tóm tắt của một tài liệu mà mọi vai S11 ghi được), hoặc người giữ role `libetech_ai`. Nó mã hoá nội dung thành hex rồi đặt vào `sources[].id`: 100 mã × 16 byte = 1 600 byte mỗi nháp, qua đúng đường `submitDraft`. Người đọc là `engineer`, `technical` hoặc `business` gọi `list` cho nháp ứng viên: nhận `value:null` nhưng nhận đủ `sources`. Một lần gọi trả tối đa 200 dòng, tức 320 000 byte. Người có quyền quyết định bị che ở điểm 2 (cờ nhóm đã gỡ, dự án đã thành `IBS_HI`) cũng nhận đủ `sources`. Với chèn thô, `manifestHash` thêm 32 byte mỗi dòng cho mọi người đọc.

`#inference` Cần hai điều kiện: bên ghi thù địch và người đọc biết giải mã. Người đọc có thể tự tạo điều kiện thứ nhất bằng cách viết chữ điều khiển vào một tài liệu của dự án. Chưa có mô hình nào chạy nên chưa đo được mô hình có làm theo không.

**Vì sao là «phải sửa».** Đây là đường vòng qua cả điểm 1 (b) lẫn điểm 2 (b), dưới đúng đối thủ mà B1 tự nêu («cột nào của dòng cũng có thể mang giá trị bất kỳ mà CHECK của bảng cho phép»). Chữ của quyết định điểm 2 là «chỉ trả mã và lý do giữ»; không câu nào đòi trả danh sách nguồn. Sửa thì đổi hình dạng câu trả lời và kỳ vọng của L1, L4, M1, K1, K2.

**Sửa thế nào.**
1. Người đọc không có quyền quyết định: `sources` là `[]`, ngay trong câu SQL (cùng chỗ với `NO_CONTENT`).
2. Người có quyền quyết định nhưng bị che: `sources` chỉ giữ mã có trong `ctx.sources` của ngữ cảnh dựng lại; `[]` khi không dựng được ngữ cảnh. Mã có trong ngữ cảnh là mã người đó vốn thấy được như con trỏ, và tập đó không do bên ghi chọn.
3. `manifestHash`: trả khi bằng `skillManifests[skill].hash`, ngược lại `null` (hoặc bỏ hẳn khỏi phần «luôn có»).
4. Sửa câu chữ của C1 và B1: «kiểu đóng» là đóng về dạng, không đóng về thông tin. Ghi vào B6 phần còn lại sau khi sửa: `valueHash` (32 byte mỗi dòng, chỉ tới người có quyền quyết định, cần để từ chối), thứ tự và số dòng.

### N2 — Nháp ứng viên chép chữ của tin mà không nêu mã tin thì không bị che, và điều đó không được ghi thành câu hỏi mở

**Chỗ trong kế hoạch.** C2 (`:61`): các lý do «thiếu nguồn, nhận định không nguồn» không che. R1 (`:158`): planner không tự thêm hướng chặt. `VISIBILITY` (`:432`). Ca M4 (`:446`) ghim «an unsourced claim, a draft without sources» là **không che**.

**Căn cứ.**
- `#fact` `submitDraft` chỉ kiểm lược đồ, kích thước và hash manifest (`src/server/suggestions.ts:84-93`). Nháp không có nguồn, hoặc có nhận định không nêu căn cứ, vẫn được lưu; ca có sẵn «DOC-05 an AI output without sources stays a draft and never reaches Z1» (`tests/suggestions.test.ts:112`) ghim điều đó.
- `#fact` Chữ của tin hiện hay ẩn theo nhóm và theo ánh xạ dự án, không theo từng người (`src/server/source-text.ts:24-25`). Gỡ cờ một nhóm thì mọi tin có lưu chữ của nhóm đó ẩn cùng lúc.
- `#fact` Ngữ cảnh của nháp ứng viên chính là các tin của luồng (`src/server/skill-context.ts:53-59`).

**Kịch bản.** Nhóm đang bật cờ hiện chữ. Pipeline dựng ngữ cảnh của một ứng viên (có chữ của tin) và ghi một nháp `intake_analyst` có `claims[0].value` chép chữ của tin, `sources` chỉ nêu một tài liệu, `basis` rỗng. Sau đó người vận hành gỡ cờ của nhóm. Điều phối dự án gọi `list`: `checkSkillOutput` trả `UNSOURCED_CLAIM` (không thuộc `VISIBILITY`), không mã nào về hiển thị, nên `maskReasons` là `[]` và `value` được trả đủ. Chữ của tin rời CSDL sau khi cờ đã gỡ: đúng tình huống «Phía B» của OQ-45 (`docs/OPEN-QUESTIONS.md:665`).

`#inference` Mô hình trung thực cũng rơi vào đây khi trích nhiều tin mà chỉ nêu một phần; không cần đối thủ.

**Vì sao là «phải sửa».**
- Không nhất quán với chính C2. C2 che khi «không chứng minh được là đọc được» (ba mã thêm ngoài chữ của quyết định), nhưng nội dung không khai nguồn là thứ khó chứng minh nhất lại không che.
- Với nháp ứng viên, đối tượng của nháp là luồng tin. Đọc «nháp trích tin» theo mã tự khai là đọc theo hướng lỏng ở một điểm chữ của Chairman không quyết, và kế hoạch chỉ ghi nó là phần dư R1, không ghi thành câu hỏi mở. Kế hoạch đã có mẫu xử lý đúng cho loại điểm này (OQ-53: dừng, giữ chỗ fail-closed, ghi câu hỏi).

**Sửa thế nào.**
1. Ghi một câu hỏi mở mới (planner đánh số): nháp ứng viên có bị che khi luồng của nó có chữ đã lưu mà người đọc hiện không đọc được, dù nháp không nêu tin đó không. Nêu cả giới hạn không sửa được: nháp tài liệu có thể mang chữ của tin mà không phép kiểm nào thấy.
2. Trong PR, đặt giữ chỗ fail-closed: nháp ứng viên bị che (mã `TEXT_NOT_VISIBLE` hoặc một mã riêng để đổi được sau quyết định) khi luồng có ít nhất một bản của tin lưu chữ mà cấu hình hiện tại không cho hiện. Tính bằng một giá trị đúng/sai trong `src/server/source-text.ts` (nơi duy nhất được nêu bảng bản sửa), không dựa vào trần 20 tin của ngữ cảnh và không dựa vào bản mới nhất của từng tin: một tin có bản mới nhất chỉ con trỏ vẫn có thể có bản cũ lưu chữ.
3. Sửa M4: giữ cho nháp tài liệu; với nháp ứng viên thêm ca C3, C4 dưới đây.
4. Nếu phiên chính không muốn đặt giữ chỗ ở bước 2 thì cần lời Chairman cho việc đó, không phải lựa chọn của planner; bước 1 vẫn bắt buộc.

`#inference` Giữ chỗ này gần như không giữ oan thêm: ở luồng có chữ đang ẩn, nháp muốn xác nhận được phải nêu tin mới nhất (Task 6), mà nêu tin không hiện chữ thì đã bị giữ và bị che.

### N3 — `decide` cho người không có quyền xác nhận kiểm thử `valueHash`

**Chỗ trong kế hoạch.** B2 (`:108`): người không có quyền nhận «chỉ mã đó», `valueHash` là `null`. C1 (`:60`): «người khác không dùng nó vào việc gì». Task 3 (`:407`): `decide` «giữ nguyên hai mã lỗi», không đổi thứ tự kiểm.

**Căn cứ.** `#fact` Trong thân khoá lệnh, thứ tự hiện tại là: đã có quyết định (409 `DRAFT_ALREADY_DECIDED`) → so `valueHash` (409 `REVISION_CONFLICT`) → xét quyền (403 `MANAGER_REQUIRED` hoặc `READ_ONLY`) (`src/server/suggestions.ts:156-160`). Lỗi nào cũng làm khoá lệnh lùi, nên cùng một khoá dùng lại được.

**Kịch bản.** `engineer` gọi `decide` trên một nháp ứng viên với một `valueHash` tự tính từ một giá trị đoán. Sai thì nhận `REVISION_CONFLICT`; đúng thì nhận `MANAGER_REQUIRED`. Với nháp ít chữ tự do (mặc định của `intake_analyst`: phân loại 4 giá trị, độ tin 0–100, các mảng rỗng, mã nguồn là mã tin người đó xem được ở hộp thư đến), vài trăm lần gọi là biết đủ nội dung. Đây là thứ PR rút khỏi `list` rồi để lại ở `decide`.

**Sửa thế nào.** Đưa phép xét quyền (`mayDecide`) lên đầu thân khoá lệnh, trước `alreadyDecided` và trước phép so `valueHash`. Không đổi thứ tự khoá, không đổi hai mã lỗi và hai câu. Đường phát lại không chạy thân khoá lệnh nên K2 không đổi. `#inference` Các ca có sẵn đã đọc («R12-e …», «(f) another person …», «R12-g …») không đổi kỳ vọng vì người gọi trong các ca đó hoặc có quyền, hoặc gửi đúng hash. Thêm ca C5.

---

## Nên sửa

- **R1 · H1 thu hẹp một ca canh** (kế hoạch `:242`). `#fact` Ca «running 021 again changes nothing: one trigger, one function, …» đếm mọi trigger trên hai bảng và đòi đúng 3 (`tests/z4-schema.test.ts:456-470`). Thêm `tgname IN (ba tên)` thì ca không còn thấy một trigger lạ thêm trên `public.draft_decisions`; G12 chỉ khẳng định danh sách đúng của `intelligence.ai_drafts`. Đổi thành loại đúng một tên mới (`tgname <> 'ai_drafts_pointer_only_guard'`), hoặc để G12 khẳng định danh sách đúng của cả hai bảng.
- **R2 · K3 phải viết ra phép khẳng định chính xác** (kế hoạch `:255`). `#fact` Ca hiện đòi đúng một `REVISION_CONFLICT` và gắn số dòng quyết định với `c.code==='REVISION_CONFLICT'` (`tests/suggestions-concurrency.test.ts`, ca thứ ba). Kỳ vọng mới phải là: đúng một bên thành công; nếu lệnh trình tay thắng thì lệnh xác nhận trả `DRAFT_HELD` có `SUBJECT_CHANGED` và không dòng quyết định nào; không bao giờ cả hai thành công. Đổi tên ca cho khớp. Ghi lý do `DRAFT_HELD` đến trước `REVISION_CONFLICT`: bước giữ chạy trước `proposeRevisionIn`.
- **R3 · Trường hiển thị lấy từ cột mà cổng không kiểm** (kế hoạch `:404`). `#fact` Luật che xét `value`; `questions`, `confidence`, `skill_version`, `model_version` được trả từ cột riêng, mà CHECK của bảng chỉ ràng kiểu và kích thước (`migrations/021_ai_suggestions_z4.sql:40-53`). Dòng chèn thô có thể để cột `questions` khác `value.questions`, với phần tử không đúng hình dạng. Khi không che: trả `questions` và `confidence` từ giá trị đã qua lược đồ, hoặc che `SCHEMA_INVALID` khi cột lệch giá trị; `skillVersion` chỉ trả khi bằng phiên bản của manifest hiện hành.
- **R4 · Guard có thể vắng mà dịch vụ không biết** (kế hoạch `:143`, `:343`). Lùi 022 hoặc `DISABLE TRIGGER` mở lại đường ghi; `submitDraft` không phân biệt được. G12 thêm `tgenabled='O'` và kiểu trigger đúng `BEFORE INSERT … FOR EACH ROW`. Thêm vào danh sách «trước khi bật Z4»: pipeline từ chối khởi động khi trigger guard vắng hoặc bị tắt.
- **R5 · R6 mô tả khe hở nhỏ hơn thật** (kế hoạch `:163`). `#fact` `created_at` là `now()`, tức lúc bắt đầu giao dịch nhận tin (`migrations/016_intake_inbox.sql:47,65`); giao dịch đó lấy khoá tư vấn và có thể chờ (`src/server/intake.ts:87`); trần mỗi câu lệnh là 10 giây (`src/server/db.ts:32`). Khe hở dài bằng thời gian giao dịch nhận tin mở, không phải «cỡ mili giây», và tin lọt qua thì không bao giờ được phát hiện. Sửa câu chữ của R6 và chép vào OQ-53.
- **R6 · Mô tả bit của guard chưa đủ** (kế hoạch `:137`, `:161`). Thêm ba điều: (a) bit là xuyên tenant với người giữ role biết cả hai uuid; (b) `#fact` trước PR người giữ role đã tự khai được phạm vi (`docs/DELIVERY-012-review-skills-20261115.md:145`) nên đã đọc, ghi Z4 của mọi tenant và dò được sự tồn tại của cặp (tenant, dự án) qua khoá ngoại; thứ mới chỉ là nhãn `IBS_HI`; (c) quyền `INSERT` được kiểm trước khi trigger chạy, nên role không có quyền chèn không nhận bit nào (ca C6).
- **R7 · Hai chỗ phân loại chưa đúng tên** (kế hoạch `:245-246`, `:582`). (a) Mục 1 của «Dừng và chỗ chưa chắc» (người không có quyền vẫn thấy dòng nháp và siêu dữ liệu) là một cách hiểu chữ của quyết định: đưa vào «Cách hiểu chờ Chairman xác nhận» thành một mục C. (b) H4, H5 đổi dữ liệu dựng vì giữ chỗ của OQ-53 điểm 2, không vì quyết định nào: ghi rõ, để khi OQ-53 được quyết khác thì biết phải xét lại.

---

## Ca kiểm còn thiếu

- **C1 `a reader without the authority gets no bits the writer chose: sources is empty and manifestHash is the current manifest's or null`** — dòng chèn thô có 100 mã dạng uuid mang một chuỗi đánh dấu mã hoá hex và `manifest_hash` mang chuỗi đó; `member` đọc: câu trả lời và mọi dòng trao cho dịch vụ không chứa dạng mã hoá nào. (N1)
- **C2 `under a mask a person who may decide gets only the source ids that are in the rebuilt context`** — nháp nêu một tin có thật và 50 mã dạng uuid lạ, cờ nhóm đã gỡ; `pm` đọc: `sources` chỉ có mã tin có thật. Không dựng được ngữ cảnh: `[]`. (N1)
- **C3 `a candidate draft that names no message is masked once the stored text of its thread is no longer shown`** — nháp có chuỗi đánh dấu trong `claims`, `sources` chỉ nêu một tài liệu; dịch vụ dựng với danh sách nhóm rỗng: `value:null`, câu trả lời không chứa chuỗi đánh dấu; với cờ còn: `value` được trả. (N2)
- **C4 `a thread whose newest revision is pointer-only but an earlier revision stored text still masks its candidate drafts when the group is not flagged`** — ghim rằng phép kiểm xét mọi bản, không chỉ bản mới nhất. (N2)
- **C5 `decide answers a reader without the authority the same way whatever valueHash is sent and whether or not the draft is decided`** — `member` trên nháp ứng viên: hash sai, hash đúng, nháp đã có quyết định đều trả `MANAGER_REQUIRED` 403; không dòng khoá lệnh nào thêm. (N3)
- **C6 `the guard gives no answer to a role that may not insert drafts`** — role runtime chèn nháp cho dự án `IBS_HI`: `permission denied`, mã khác `LTZ01`. (R6)
- **C7 `the guard decides each row of a multi-row insert: one IBS_HI row refuses the whole statement and nothing is stored`** — `INSERT … SELECT` hai dòng, một dòng của dự án `IBS_HI`.
- **C8 `a row without tenant_id or project_id is answered by the table, not by the guard`** — trigger chạy trước NOT NULL: lỗi là lỗi ràng buộc, mã khác `LTZ01`, không dòng nào thêm.
- **C9 `a replayed decision on a project that became pointer-only answers with the recorded decision and no content`** — từ chối một nháp, ánh xạ `IBS_HI`, gửi lại đúng lệnh: quyết định đã ghi, `maskReasons` có `POINTER_ONLY_PROJECT`, `value:null`. (C3 của kế hoạch nhân với điểm 2, trên đường phát lại.)
- **C10 `threadFreshness reads nothing for a caller scoped to another tenant`** — câu lệnh không có điều kiện `tenant_id` và dựa vào RLS; T7 mới có ca «dự án khác».

---

## Điểm cần thành câu hỏi mở cho Chairman

1. **Mới (từ N2).** Nội dung nháp không khai nguồn: nháp ứng viên có bị che khi luồng của nó có chữ đã lưu mà người đọc hiện không đọc được không; và việc chấp nhận rằng nháp tài liệu có thể mang chữ của tin mà không phép kiểm nào thấy. Hành vi trong PR nên là giữ chỗ fail-closed, ghi rõ không phải phương án được chọn.
2. **Bổ sung cho OQ-53.** Phần «Phía B» nên nêu khe hở của mốc thời gian đúng kích thước (R5), vì nó ảnh hưởng tới việc cân phương án 1 (b) với một số thứ tự của luồng.
3. **Bổ sung cho OQ-54.** `#fact` theo kế hoạch `:109`, `:160`: người có quyền quyết định vẫn nhận `valueHash` của nháp đã lưu trước khi dự án thành `IBS_HI`. Hash đó cho phép thử ngoại tuyến các giá trị ít khả năng. Chairman cần biết điều này khi quyết OQ-54.

Hai mục OQ-53 và OQ-54 như đã viết: chữ trong «» khớp các mục gốc đã đối chiếu (`docs/OPEN-QUESTIONS.md:667-669`, `:684`); hành vi hiện tại không bị trình như phương án được chọn; khuyến nghị được ghi là của planner. Không thấy vấn đề ngoài hai bổ sung trên.

---

## Theo từng vùng: ai học được gì, làm được gì sau PR

**(1) Role AI và hàm `SECURITY DEFINER`.**
- Người giữ role `libetech_ai`: thêm một bit «dòng ánh xạ mới nhất là `IBS_HI`» cho mỗi cặp (tenant, dự án) nó nêu được; không đọc, không gọi, không được cấp gì. Mất khả năng ghi nháp cho dự án `IBS_HI`. Ca G1–G9. Chấp nhận được, với phần mô tả bổ sung ở R6.
- Login vận hành: bị guard chặn như mọi role; vẫn tắt được trigger (khoảng trống 40, không đổi). Ca G6.
- Tenant khác, thành viên dự án khác: không có đường nào tới hàm. Ca G4, G8.

**(2) Nội dung nháp và luật che.**
- Vai đọc không có quyền xác nhận: mất `value`, `questions`, `confidence`, hai chuỗi phiên bản, `valueHash`. Còn lại ba đường: N1, N3, và siêu dữ liệu của dòng (R7).
- Người có quyền xác nhận nhưng không đọc được chữ: nội dung bị che khi nháp nêu tin đang ẩn hoặc dự án chỉ con trỏ. Còn lại: N1 (dưới lớp che) và N2 (nháp không nêu tin).
- Mô hình thù địch: N1, N2.

**(3) «IBS HI: chỉ con trỏ».** Ghi mới bị chặn ở CSDL; đọc bị che; xác nhận bị giữ (có sẵn). Còn lại: nội dung đã lưu trước khi ánh xạ (OQ-54) và dự án chưa ánh xạ không bị chặn — cùng luật với đường nhận tin (`src/server/source-text.ts:20-21`), không phải lựa chọn mới của kế hoạch.

**(4) Cổng giữ nháp lúc xác nhận.** Không vai nào được thêm khả năng. Nháp nêu bản cũ, không nêu bản nào, hoặc có tin mới thì bị giữ; từ chối và phát lại không bị chặn. Phần dư: R5.

---

## Đã kiểm, không thấy vấn đề

**Thân hàm guard và migration 022** (kế hoạch `:269-302`)
- `#fact` `search_path = pg_catalog, pg_temp`; bảng viết đủ schema; không SQL động; đầu vào là hai cột `uuid` của `NEW`; câu lỗi cố định, không mã.
- `#fact` `REVOKE … FROM PUBLIC` nằm cùng giao dịch với `CREATE OR REPLACE`, không có khoảng hở; không `GRANT` nào.
- `#fact` `row_security = off`: với chủ là superuser thì không có tác dụng; với chủ bị RLS lọc thì truy vấn báo lỗi, vì bảng ánh xạ có `FORCE ROW LEVEL SECURITY` (`migrations/013_project_registry.sql:71-72`). Ca G11 ghim đúng hướng đó.
- **Chủ hàm.** Đồng ý với lựa chọn của planner (superuser, tức login migration). Phương án chủ hẹp chạy dưới phạm vi role AI tự khai nên không thu hẹp được gì, và làm tính đúng của guard phụ thuộc ngầm vào policy của bảng khác. Giữ khẳng định của G12 về chủ hàm.
- `#fact` Không đường nào trong `src` ghi bảng ánh xạ; role runtime chỉ có `SELECT` (`migrations/013_project_registry.sql:101`). Nhãn mà guard tin hiện chỉ do login vận hành ghi.
- `#fact` SQLSTATE `LTZ01` theo tiền lệ `LTR01`–`LTR03` (`migrations/020_document_review.sql:223,247,282`).

**Thứ tự trigger so với RLS, CHECK và `ON CONFLICT` trên PostgreSQL 16**
- `#fact` Tài liệu `CREATE POLICY` của PostgreSQL 16: biểu thức `WITH CHECK` được áp sau khi trigger `BEFORE` chạy, trước mọi thay đổi dữ liệu và trước các ràng buộc khác; `INSERT … ON CONFLICT` vẫn kiểm `WITH CHECK` cho mọi dòng đề xuất. Khớp với điều kế hoạch nêu ở `:138`.
- `#inference` Phép dò trùng của `ON CONFLICT` chạy sau trigger và sau `WITH CHECK`, nên C4 và ca G5 đúng trên động cơ thật. Chưa có lượt native; G7, G9, G5 là các ca xác nhận. Nếu native cho thứ tự khác thì dừng, đúng như kế hoạch `:583`.

**Tệp lùi** (kế hoạch `:306-326`)
- `#fact` Từ chối khi còn phiên bản lớn hơn; không `CASCADE`; không đụng dữ liệu; chạy lại được. Tệp lùi 021 đã từ chối khi `'022'` còn được ghi (`migrations/rollback/021_ai_suggestions_z4.sql:10`).
- `#inference` Nếu dòng `'022'` bị xoá tay mà hàm còn, tệp lùi 021 dừng ở `DROP SCHEMA` (không `CASCADE`): an toàn.

**Lỗi CSDL thô từ `submitDraft`**
- Chỉ `LTZ01` được dịch; lỗi khác đi nguyên như hôm nay, tới pipeline là bên đã nêu các giá trị trong lỗi. Chấp nhận được khi không có tuyến HTTP. Tuyến nào về sau gọi `submitDraft` phải bọc lỗi: ghi vào biên nhận.

**Chạy đua và khoá**
- `#fact` Chỉ một nơi trong `src` chèn bản tài liệu (`src/server/documents.ts:169`), dưới `FOR UPDATE` của dòng tài liệu (`:156`). `decide` lấy cùng khoá trước khoá lệnh (`src/server/suggestions.ts:151`). Phép kiểm của nháp tài liệu vì thế xếp hàng đúng với lệnh trình tay.
- `#inference` Dưới READ COMMITTED, câu đọc `document_revisions` sau khi chờ khoá thấy bản đã commit của bên thắng.
- Luồng tin không khoá: chấp nhận như phần dư, với câu chữ sửa theo R5. Xác nhận nháp ứng viên chỉ ghi một dòng quyết định, không ghi Z1 khác.
- Ánh xạ đổi trong lúc chèn (R5 của kế hoạch): tương đương đổi ngay sau khi lưu; che lúc đọc và giữ lúc xác nhận xử lý.

**Kênh phụ ở `list`**
- `total` và thứ tự không đổi theo việc che. Người không có quyền nhận đúng một mã lý do và không gây lần dựng ngữ cảnh nào. Khác biệt thời gian chỉ lộ vai của chính người đọc.
- `#fact` Mọi lý do che đều là lý do giữ lúc xác nhận (`src/server/suggestions.ts:182-186`): nháp đang bị che không xác nhận được.
- Lỗi lạ khi dựng ngữ cảnh làm cả lần đọc thất bại, không biến thành «không che»: đúng hướng.

**Hai câu SQL «đối tượng đã đổi»** (kế hoạch `:468-470`, `:512-521`)
- Có `project_id=$1`; mảng mã đã lọc dạng uuid trước khi ép kiểu; chỉ trả số và giá trị đúng/sai.
- `#fact` Role runtime có `SELECT` cả bảng trên `source_events` và bảng bản sửa (`migrations/016_intake_inbox.sql:257`) và policy theo tenant, dự án (`:161-165`, `:174-178`).
- Không có mốc thì ba phép so đều rỗng và `has_baseline` sai: giữ, đúng hướng chặt.

**Các cách hiểu C1–C7 và hai giữ chỗ của OQ-53**
- C3, C4, C5, C7: hướng chặt, không vượt chữ theo cách làm lỏng điều gì.
- C6: mốc là thứ nháp **nêu**, không phải thứ nháp đã đọc. Đó là hệ quả của mốc Chairman chọn, không phải lựa chọn của planner.
- C1: đúng hướng, trừ N1. C2: đúng hướng, trừ N2.
- Hai giữ chỗ `SUBJECT_EDIT_UNVERIFIED` và `SUBJECT_BASELINE_MISSING`: đúng là hướng giữ nhiều nháp nhất trong các phương án của OQ-53; được ghi là giữ chỗ, không phải phương án được chọn.

**Ca hiện có bị đổi**
- H2, H3, H6, K1, K2: không nới. K2 chặt hơn trước.
- H1: thu hẹp nhẹ (R1). K3: cần viết rõ (R2). H4, H5: không nới, nhưng cần ghi đúng lý do (R7).

**Chưa kiểm được**
- Mọi hành vi lúc chạy, trên PGlite lẫn PostgreSQL 16: không chạy gì.
- Mô hình có làm theo chữ điều khiển để mã hoá vào `sources` không: chưa có mô hình nào chạy.
- R7 của kế hoạch (vai lấy từ phiên): chưa đọc đường dựng `Principal` từ phiên, nên chưa biết vai trong phiên cũ tới mức nào sau khi bị hạ.

---

## Ba chỗ sửa có tác dụng lớn nhất

1. **N1** — ngừng trả `sources` cho người không có quyền, lọc theo ngữ cảnh dưới lớp che, và ràng `manifestHash`. Đóng đường vòng qua cả điểm 1 lẫn điểm 2.
2. **N2** — giữ chỗ fail-closed cho nháp ứng viên ở luồng có chữ đang ẩn, kèm câu hỏi mở. Đóng trường hợp gỡ cờ nhóm mà nháp cũ vẫn mang chữ.
3. **N3** — xét quyền trước phép so `valueHash` trong `decide`. Một dòng mã và một ca kiểm.

Sau khi kế hoạch sửa ba mục trên, cổng cần soát lại các mục B2, B3, Task 3, Task 4 và các ca L1, L4, M1, M4, K1, K2.
