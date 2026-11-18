# Nháp AI: ai đọc nội dung, che lúc đọc, từ chối nháp IBS HI lúc ghi, giữ nháp đã cũ (OQ-45, OQ-46) · 18/11/2026

PR riêng vào `libetech-ai-os`, viết mã cho bốn quyết định của Chairman ngày 18/11/2026 về OQ-45 và OQ-46. Nhánh `feat/oq-45-46-ai-drafts`, gốc `4f12a3c` (đầu `origin/libetech-ai-os` sau PR #21). Đầu nhánh lúc chạy lượt cuối của cổng: `b29b929`; mã `src/` đổi lần cuối ở `d9b0974`, `migrations/` ở `05a6da0`, `tests/` ở `9b0f83f` (tên một ca); mọi commit sau đó — kể cả commit mang biên nhận này — chỉ thêm hồ sơ. PR: [liberico-ai/ai-together#22](https://github.com/liberico-ai/ai-together/pull/22), vào `libetech-ai-os`, mở ngày 18/11/2026; chưa merge. Kế hoạch: `docs/plans/oq-45-46-ai-drafts.md` bản 0.9. Review và bằng chứng: `docs/reviews/oq-45-46-evidence-20261118/`.

Biên nhận này tả nhánh **sau hai vòng sửa của cổng Codex**: vòng sửa 1 (Task F1, F2, F3, F1b, F1c và F5) và vòng sửa 2 (Task G1 và Task G2). Brief của phiên cho tối đa hai vòng sửa ở cổng: cả hai đã dùng, và vòng 3 là lượt chạy cuối của cổng. Chỗ nào còn chờ một lượt chạy, một lượt soát hay một commit thì mang một nhãn giữ chỗ trong ngoặc kép góc, do phiên chính điền; biên nhận không ước con số nào.

**Z4 chưa bật và không được bật bởi PR này.** Không tuyến HTTP nào đọc nháp; không login, không khoá cho role `libetech_ai`; không mô hình nào được gọi. Dữ liệu thử là dữ liệu tổng hợp.

## Bốn mức — ghi riêng, không gọi mức sau khi mới đạt mức trước

| Mức | Trạng thái | Căn cứ |
|---|---|---|
| **Đã có mã** | **Đạt mức «đã có mã».** Test, typecheck và build xanh ở đầu nhánh trên PGlite và trên PostgreSQL 16 thật; lượt cuối của mọi ghế review tầng 1 là «READY FOR GATE»; cổng Codex vòng 3 `VERDICT: PASS`, không finding; `liberico-reality-checker` `VERDICT: READY` sau khi bảy chỗ sửa chữ của nó được áp. Chưa merge: việc merge chờ Chairman | Bảng «Bằng chứng kiểm» và mục «Review hai tầng» bên dưới; chỉ ghi «đã có mã» khi các cổng nói vậy |
| Đã triển khai | **Chưa.** Không triển khai d1-ai1. Migration 022 chưa áp ở đâu ngoài CSDL thử riêng của PR | Điểm dừng Chairman |
| Đã dùng thật | **Chưa.** Chưa có dòng nháp nào ngoài CSDL thử; không ai gọi `SuggestionService` ngoài test | — |
| Đã nghiệm thu | **Chưa.** | — |

## Căn cứ và quyết định

Lời Chairman ngày 18/11/2026, chép nguyên từ `docs/OPEN-QUESTIONS.md:855`: «OQ-45: 1b, 2b, 3b. OQ-46: b, mốc là bản mới nhất nháp nêu».

Chữ trong «» ở cột giữa của bảng dưới là chữ của mục OQ-45 và OQ-46 (`docs/OPEN-QUESTIONS.md:667-669`, `:684`), không phải lời Chairman.

| Quyết định | Chữ của phương án | Mã |
|---|---|---|
| OQ-45 điểm 1 (b) | «chỉ người có quyền xác nhận nháp đó (vai ghi sổ tài liệu với nháp tài liệu, điều phối dự án với nháp ứng viên)» | `mayDecide`, `present`, `DRAFT_META_SQL` trong `src/server/suggestions.ts` |
| OQ-45 điểm 2 (b) | «lúc đọc dựng lại ngữ cảnh dưới quyền người đọc và che `value` khi nháp trích tin người đó không đọc được chữ hoặc dự án đang chỉ con trỏ, chỉ trả mã và lý do giữ» | `contextFor`, `present` |
| OQ-45 điểm 3 (b) | «từ chối ngay lúc ghi (cần cấp cho role AI quyền đọc hẹp cờ «chỉ con trỏ», hoặc một thiết kế khác)» | `migrations/022_ai_drafts_pointer_only_guard.sql`; `submitDraft` |
| OQ-46 (b), theo mốc Chairman chọn | «Giữ nháp khi **đối tượng của chính nó** đã đổi: tài liệu có bản mới hơn sau lúc nháp được ghi; luồng của ứng viên có tin hoặc bản sửa mới sau lúc đó.» | `subjectReasons` (`src/server/suggestions.ts`), `threadFreshness` (`src/server/source-text.ts`) |

Với điểm 3 Chairman không chọn cách làm. Cách được dùng (do `planner` đề xuất; cổng bảo mật soát trên kế hoạch; đổi ba lần sau cổng Codex vòng 1): bốn trigger `BEFORE INSERT` của migration 022, ba trong đó gọi hàm `SECURITY DEFINER`. Role `libetech_ai` **không được cấp thêm quyền nào** và không gọi thẳng được hàm nào.

**Quyết định phạm vi của Chairman cho finding CX3 của cổng Codex** (18/11/2026; Chairman chọn qua hộp chọn của phiên điều phối, phiên điều phối chuyển lời; câu hỏi và cả ba phương án chép nguyên ở khối cuối tệp, `docs/OPEN-QUESTIONS.md:928`). Chuỗi trả lời, chép nguyên: «B: chặn tạm (Recommended)». Chữ của phương án đó, chép nguyên: «Giữ chỗ fail-closed: không nháp ứng viên nào xác nhận được cho tới khi anh quyết điểm 3 của OQ-53. Nằm trong phạm vi brief; phải đổi kỳ vọng các ca của lát 3 đang xác nhận nháp ứng viên. Z4 đang tắt, chưa có login AI nên hôm nay không có nháp thật nào bị chặn.» Nhãn «(Recommended)» là nhãn của phiên điều phối. Đây là quyết định về phạm vi của PR này; điểm 3 của OQ-53 vẫn mở.

**Bốn câu hỏi mở do PR này ghi** (lời Chairman chưa phủ; không mục nào được tự chọn phương án):

| Câu hỏi | Nội dung | Hành vi trong PR |
|---|---|---|
| **OQ-53** (`docs/OPEN-QUESTIONS.md:872`) điểm 1 | Bản sửa của một tin: nháp chỉ nêu mã tin, không nêu bản, nên mốc Chairman chọn không so được | Giữ chỗ fail-closed, **không phải phương án được chọn**: nháp ứng viên bị giữ (`SUBJECT_EDIT_UNVERIFIED`) khi luồng có một bản sửa được ghi từ mốc trở đi |
| OQ-53 điểm 2 | Nháp không nêu bản nào của tài liệu của nó, hoặc tin nào của luồng của nó: không có mốc | Giữ chỗ fail-closed: bị giữ (`SUBJECT_BASELINE_MISSING`) |
| OQ-53 điểm 3 (`:924`) | Khe theo thứ tự commit của đường nhận tin (finding CX3 của cổng Codex) | Giữ chỗ fail-closed theo quyết định phạm vi của Chairman, **không phải phương án được chọn** của điểm 3: mọi lệnh xác nhận nháp ứng viên bị giữ (`SUBJECT_ORDER_UNVERIFIED`) |
| **OQ-54** (`:884`) | Nội dung nháp đã lưu trước khi dự án thành `IBS_HI` có được nằm lại trong Z4 không | Không viết mã; dòng nằm lại (bảng bất biến), dịch vụ không trả nội dung và không cho xác nhận |
| **OQ-55** (`:899`) | Nháp mang chữ của tin mà không nêu mã tin | Hai giữ chỗ fail-closed, **không phải phương án được chọn**: nháp ứng viên bị che và bị giữ (`THREAD_TEXT_HIDDEN`) khi luồng của nó có chữ đã lưu mà nay không được hiện; **mọi nháp** — tài liệu lẫn ứng viên — bị che và bị giữ (`PROJECT_TEXT_HIDDEN`) khi dự án có chữ như vậy. Giữ chỗ thứ hai rộng hơn chữ của phương án (e) |
| **OQ-56** (`:914`) | Nháp của dự án **chưa có dòng ánh xạ miền** có được lưu và được đọc không | Không viết mã; hành vi cũ giữ nguyên (đọc đúng chữ «dự án `IBS_HI`», cùng luật với chữ của tin theo OQ-28 (c)). Với dữ liệu thật hôm nay mọi dự án đang «Chưa xác nhận», nên guard chưa từ chối dự án nào cho tới khi có dòng ánh xạ |

**Cách hiểu chờ Chairman xác nhận** (không phải lời Chairman; đầy đủ ở kế hoạch, mục «Cách hiểu chờ Chairman xác nhận», C1–C9):

- C1 — «`value`» gồm mọi bản chép và mọi trường do bên ghi chọn (`questions`, `sources`, `confidence`, hai chuỗi phiên bản, hash).
- C2 — che cả khi không chứng minh được là đọc được (mã ngoài ngữ cảnh, đối tượng không còn, giá trị lệch hợp đồng).
- C3 — câu trả lời của lệnh quyết định cũng là một lần đọc; người không có quyền nhận cùng một câu từ chối bất kể hash gửi lên. **Mở rộng sau cổng Codex vòng 2:** một nháp đang bị che với người quyết định được từ chối không cần hash — người đó không được cho thấy hash nào.
- C4 — «từ chối ngay lúc ghi» áp cho mọi lần thử ghi và mọi role ghi, kể cả gửi lại một khoá cũ.
- C5 — với luồng tin, mốc là tin được **ghi** sau cùng trong các tin nháp nêu, theo đồng hồ CSDL, không theo `observedAt` do gateway khai.
- C6 — mốc tính trên mọi trường mã của đầu ra, chỉ mã thuộc chính đối tượng của nháp.
- C7 — «bản mới hơn» tính theo số bản cao nhất, kể cả bản chưa duyệt.
- C8 — vai đọc không có quyền xác nhận **vẫn thấy dòng nháp** (mã dòng, kỹ năng, thời điểm, quyết định). Đây là đọc đúng chữ, **không phải hướng chặt nhất**.
- C9 — «chỉ trả mã và lý do giữ» đọc là mã của chính dòng nháp và các mã lý do; dưới mọi lớp che `sources` là `[]`. **Mở rộng sau cổng Codex vòng 2:** dưới mọi lớp che cũng không trả hash của nội dung (`valueHash`); và trên một nháp bị che, câu giữ của lệnh xác nhận chỉ nêu các mã che, cộng giữ chỗ của điểm 3 OQ-53 với nháp ứng viên.

Ba phần mở rộng đó — một của C3, hai của C9 — có các cách hiểu khác không được chọn ở đây: xem mục «Cần Chairman quyết hoặc xác nhận», điểm 5.

## Đã làm

**Hai điều người đọc phải biết trước mọi điều khác:**

- **Sau PR này không nháp ứng viên nào xác nhận được.** Mọi lệnh xác nhận một nháp ứng viên bị giữ với mã `SUBJECT_ORDER_UNVERIFIED`, cho tới khi điểm 3 của OQ-53 được quyết. Từ chối vẫn làm được. Việc đọc không đổi vì mã này.
- **Mọi nháp của một dự án — nháp tài liệu lẫn nháp ứng viên — bị che lúc đọc và bị giữ lúc xác nhận (`PROJECT_TEXT_HIDDEN`) chừng nào dự án còn chữ của tin đã lưu mà cấu hình nay không cho hiện.** Đó là một giữ chỗ của OQ-55, rộng hơn chữ của phương án (e). Với danh sách nhóm hiện chữ mặc định rỗng, điều này áp cho mọi dự án từng lưu chữ của tin.

**Trước cổng Codex** (các commit tới `83d5e2f`):

- **`submitDraft`** dịch đúng một mã của CSDL, `LTZ01`, thành `POINTER_ONLY_PROJECT` (422, câu cố định, không mã dự án, không chữ của lỗi CSDL). Mọi lỗi CSDL khác đi nguyên như trước.
- **`list` và câu trả lời của `decide`** đi qua một hàm `present`:
  - người không có quyền quyết định nhận dòng với đúng một mã `CONFIRM_AUTHORITY_REQUIRED`; câu lệnh đọc không lấy cột nội dung nào, `sources` là `[]`, `manifestHash` chỉ trả khi bằng hash của manifest hiện hành (so trong SQL);
  - người có quyền: ngữ cảnh được dựng lại dưới quyền của chính họ, một lần cho mỗi kỹ năng và đối tượng; nội dung bị che theo các mã ở bảng «Mã lý do» dưới; dưới mọi lớp che `sources` là `[]`;
  - khi nội dung được trả, mọi trường hiển thị lấy từ giá trị đã qua lược đồ, không lấy từ cột riêng của dòng.
- **`decide`** xét quyền trước tiên trong thân khoá lệnh (trước «đã có quyết định» và trước phép so `valueHash`). Thứ tự khoá không đổi. Từ chối một nháp đang bị giữ vẫn làm được; phát lại một quyết định đã ghi không đổi.
- **`src/server/source-text.ts`** (nơi duy nhất, cùng `src/server/intake.ts`, được nêu bảng bản sửa của tin): `threadHasHiddenText` và `threadFreshness`; chỉ trả giá trị đúng/sai, không chữ, không hash.
- **`src/server/skill-contracts.ts`**: chỉ thêm hàm xuất `namedIds`.
- **Ca kiểm:** tới `83d5e2f` có 83 ca mới và một tệp test mới (`tests/z4-pointer-guard.test.ts`). Ca hiện có bị chạm đúng danh sách của kế hoạch: sáu chỗ đổi hạ tầng (H1–H6) và ba chỗ đổi kỳ vọng vì quyết định (K1, K2, K3).

**Vòng sửa 1, sau cổng Codex vòng 1** (`CHANGES_REQUIRED`, 2 P0, 2 P1; `docs/reviews/oq-45-46-evidence-20261118/codex-round-1.md`):

| Finding | Đã làm | Task · commit |
|---|---|---|
| **CX1** [P0] — trigger tiết lộ nhãn `IBS_HI` của dự án ngoài phạm vi role AI trước khi RLS xét dòng | Một trigger thứ hai, `SECURITY INVOKER`, chạy trước guard: với role chịu RLS, dòng mà policy `ai_insert` sẽ từ chối bị từ chối ở đây bằng chính câu trả lời của policy (`42501`), trước khi ánh xạ nào được đọc. Hai dự án ngoài phạm vi đã khai nhận cùng một câu trả lời | F1 · `cb1d7dc` |
| **CX2** [P0] — nháp tài liệu chép chữ của tin đã ẩn vẫn trả `value` khi không nêu mã tin | Giữ chỗ theo dự án, mã `PROJECT_TEXT_HIDDEN`, cho **cả hai loại nháp** (cổng bảo mật trên thiết kế vòng sửa chỉ ra cùng lớp lỗi ở nháp ứng viên): che lúc đọc, giữ lúc xác nhận. `projectHasHiddenText` trong `src/server/source-text.ts`, một giá trị đúng/sai, đóng khi dự án không nằm trong phạm vi của giao dịch | F2 · `1a423a5` |
| **CX3** [P1] — xác nhận nháp ứng viên không đồng bộ với giao dịch nhận tin sau phép kiểm độ mới | Giữ chỗ theo quyết định phạm vi của Chairman: mọi lệnh xác nhận nháp ứng viên có `SUBJECT_ORDER_UNVERIFIED`. Không trigger, không cột nào thêm vào hai bảng nhận tin; `src/server/intake.ts` không đổi. Phép kiểm «nháp ứng viên không kèm bản đề xuất tài liệu» (`INVALID_INPUT`) dời lên trước bước giữ | F3 · `f434f0a` |
| **CX4** [P1] — phép đọc ánh xạ không đồng bộ với giao dịch đổi miền dự án | Guard và một trigger mới trên `public.project_domain_mappings` khoá **dòng dự án** bằng `FOR NO KEY UPDATE` trước khi đọc hoặc ghi ánh xạ; mỗi lần chờ có trần 5 giây ghim trong hàm (`55P03`). Bản đầu của vòng sửa dùng khoá tư vấn theo dự án (`cb1d7dc`); hai review của vòng sửa chỉ ra khoá đó không có kiểm quyền, và nó được thay bằng khoá dòng | F1 · `cb1d7dc`, rồi F1b · `56d257c` |
| **Finding F1 của lượt quét chạy đua** [P1] — một lệnh xác nhận nháp tài liệu có thể commit sau khi dự án đã thành `IBS_HI`: dịch vụ kiểm ánh xạ, một ánh xạ `IBS_HI` commit, dịch vụ ghi bản đề xuất và dòng quyết định; không gì buộc hai bên lần lượt | Guard phía xác nhận: trigger thứ tư của 022, trên `public.draft_decisions`. Với dòng quyết định `confirmed`, nó khoá dòng dự án, đọc lại ánh xạ và từ chối `IBS_HI` (`LTZ01`); `decide` đổi lần từ chối đó thành `DRAFT_HELD` có `POINTER_ONLY_PROJECT`. Vì sao ở CSDL: role runtime không tự khoá được dòng dự án. Lệnh từ chối không bị chạm. Cùng khoá đó làm cho câu trả lời của `decide` không còn ghép từ hai thời điểm | F5 · `05a6da0` |

Commit của vòng sửa 1, của hồ sơ vòng 2 và của Task G1: `f5b2a36` (kế hoạch bản 0.6, hồ sơ cổng Codex vòng 1) · `cb1d7dc` (F1) · `1a423a5` (F2) · `9da79c6` (log) · `f434f0a` (F3) · `69a9315` (hai review của vòng sửa, tệp đo) · `56d257c` (F1b) · `f7e61f6` (kế hoạch bản 0.7) · `0ec1e1b` (F1c, chỉ ca kiểm) · `408344f` (hai lượt xem lại, các câu catalog đã chạy, log cả bộ ở `56d257c`) · `12570c4` (hai lượt quét theo lớp) · `05a6da0` (F5) · `01d1e91` (kế hoạch bản 0.8) · `d41cb4a` (hai lượt xem lại Task F5; chữ của R34 sửa cho login web) · `ff8164c` (hồ sơ cổng Codex vòng 2) · `ff24901` (G1). Sau đó: `d9b0974` (Task G2) · `9b0f83f` (tên ca V2; hai lượt xem lại của vòng sửa 2) · `a0f489e` (log cả bộ ở `05a6da0`) · `b29b929` (kế hoạch bản 0.9; các dòng trạng thái của OQ-45, OQ-46 và DELIVERY-012) · `a557499` (kết quả cổng Codex vòng 3) · `b8c70df` (log cả bộ ở `9b0f83f`).

**Vòng sửa 2, sau cổng Codex vòng 2** (`CHANGES_REQUIRED`, một P0; `docs/reviews/oq-45-46-evidence-20261118/codex-round-2.md`) — Task G1 (`ff24901`):

- **Dưới mọi lớp che, dòng trả ra không mang hash của nội dung:** `valueHash` rỗng. Trước Task G1 nó chỉ rỗng với người không có quyền quyết định.
- **`decide` không so hash cho người mà nháp đang bị che với họ.** Người đó không được cho thấy hash nào; dù gửi hash đúng, hash sai hay không gửi, câu trả lời như nhau. Lệnh xác nhận nháp đó bị giữ với các mã của nó, như trước; lệnh từ chối nháp đó được ghi **không cần hash**.
- Với người mà nội dung được hiện: như trước; thiếu hash được trả lời như hash sai (`REVISION_CONFLICT`, 409).
- Một lệnh xác nhận không bao giờ đi qua khi thiếu hash đúng: khi không gì giữ nháp, hash được so lần nữa sau bước giữ.
- `valueHash` thành trường tuỳ chọn của lệnh; dòng quyết định vẫn được ghi với hash đã lưu của nháp. **Hợp đồng của `decide` từ lát 3 đổi ở hai điểm:** lệnh không còn buộc phải mang hash, và dòng bị che không còn mang hash. Mỗi `decide` dựng thêm một lần ngữ cảnh. Hôm nay không tuyến nào gọi `decide`.
- Finding của vòng 2 chính là phần dư R3 mà phiên đã giữ lại sau lượt quét oracle (phán quyết 34): phán quyết đó sai với cổng này.

**Cùng vòng sửa 2 — Task G2**, sau lượt xem lại bảo mật của Task G1 (commit và log của nó: ô Task G2 của bảng «Bằng chứng kiểm»). Khi có ít nhất một mã che giữ nháp, câu `DRAFT_HELD` của lệnh xác nhận chỉ nêu các mã che — những mã mà một lần đọc cũng cho thấy trong `maskReasons` — cộng `SUBJECT_ORDER_UNVERIFIED` với nháp ứng viên; các mã khác của cổng, tức các mã tả nội dung, không được nêu. Một lần giữ không có mã che nào nêu mọi mã, như trước. Mọi phép kiểm vẫn chạy; chỉ câu trả lời nêu ít mã hơn. Mã: một hằng `MASK_REASONS` và đúng một chỗ ném `DRAFT_HELD` của nhánh xác nhận trong `src/server/suggestions.ts`. Cái giá: người quyết định một nháp bị che thấy ít mã chẩn đoán hơn cho tới khi nội dung được hiện lại.

**Mã lý do, như đang có.** «Giữ chỗ» nghĩa là fail-closed chờ một câu hỏi mở, không phải phương án được chọn.

| Mã | Che lúc đọc | Giữ lúc xác nhận | Loại |
|---|---|---|---|
| `CONFIRM_AUTHORITY_REQUIRED` | có (người không có quyền quyết định) | lệnh bị từ chối vì quyền, trước mọi lý do giữ | quyết định: OQ-45 điểm 1 (b) |
| `TEXT_NOT_VISIBLE` | có | có | quyết định: OQ-45 điểm 2 (b) |
| `POINTER_ONLY_PROJECT` | có | có | quyết định: OQ-45 điểm 2 (b), điểm 3 (b) |
| `SOURCE_OUT_OF_CONTEXT` | có | có | quyết định: OQ-45 điểm 2 (b), theo cách hiểu C2 |
| `ENTITY_NOT_FOUND` | có | có | như trên |
| `SCHEMA_INVALID` | có | có | như trên |
| `THREAD_TEXT_HIDDEN` | có (nháp ứng viên) | có | **giữ chỗ** — OQ-55 |
| `PROJECT_TEXT_HIDDEN` | có (mọi nháp) | có | **giữ chỗ** — OQ-55 |
| `SUBJECT_CHANGED` | không | có | quyết định: OQ-46 (b) |
| `SUBJECT_EDIT_UNVERIFIED` | không | có (nháp ứng viên) | **giữ chỗ** — OQ-53 điểm 1 |
| `SUBJECT_BASELINE_MISSING` | không | có | **giữ chỗ** — OQ-53 điểm 2 |
| `SUBJECT_ORDER_UNVERIFIED` | không | có (mọi nháp ứng viên) | **giữ chỗ** — OQ-53 điểm 3, theo quyết định phạm vi của Chairman |

Tám mã đầu là toàn bộ kiểu `MaskReason`; bốn mã `SUBJECT_*` chỉ giữ. Năm mã là giữ chỗ. Các mã giữ có từ lát 3 (`MANIFEST_MISMATCH`, `VALUE_HASH_MISMATCH`, các mã của cổng đầu ra) không đổi. Điều bị che lúc đọc luôn bị giữ lúc xác nhận; chiều ngược lại không phải bất biến. Dưới mọi lớp che — cả tám mã `MaskReason` — dòng trả ra không mang nội dung, `sources` là `[]`, và sau Task G1 `valueHash` rỗng. Thứ tự câu trả lời của `decide` sau Task G1: quyền → «đã có quyết định» → `valueHash`, chỉ so cho người mà nội dung được hiện → lỗi của lệnh (`REASON_REQUIRED`; `INVALID_INPUT` cho lệnh xác nhận nháp ứng viên kèm bản đề xuất tài liệu) → các mã giữ → với lệnh xác nhận không bị giữ, `valueHash` được so lần nữa. Sau Task G2, câu giữ của một lệnh xác nhận nêu mọi mã khi không mã che nào giữ nháp; khi có ít nhất một mã che, nó chỉ nêu các mã che, cộng `SUBJECT_ORDER_UNVERIFIED` với nháp ứng viên. Cột «Giữ lúc xác nhận» của bảng trên nói mã nào giữ, không nói mã nào được nêu. Sau Task F5, một lệnh xác nhận còn có thể nhận `DRAFT_HELD` với đúng một mã `POINTER_ONLY_PROJECT` từ guard của bảng quyết định, khi dự án thành `IBS_HI` sau phép kiểm của dịch vụ.

**Migration 022 sau Task F5** (`migrations/022_ai_drafts_pointer_only_guard.sql`; tệp lùi cùng tên trong `migrations/rollback/`). Bốn trigger `BEFORE INSERT … FOR EACH ROW` trên ba bảng, bốn hàm trong schema `intelligence` — một `SECURITY INVOKER`, ba `SECURITY DEFINER` — không `GRANT` nào, không dòng dữ liệu nào ngoài `schema_migrations`:

| Trigger · bảng | Hàm | Việc |
|---|---|---|
| `ai_drafts_declared_scope_guard` · `intelligence.ai_drafts` (chạy trước, theo thứ tự tên) | `SECURITY INVOKER` | Với role chịu RLS trên bảng: dòng không thoả `WITH CHECK` của policy `ai_insert` bị từ chối `42501` với câu của RLS, trước khi ánh xạ nào được đọc. Role không chịu RLS đi tiếp |
| `ai_drafts_pointer_only_guard` · `intelligence.ai_drafts` | `SECURITY DEFINER`, ghim `search_path`, `row_security = off`, `lock_timeout '5s'` | Giao dịch không ở READ COMMITTED → `LTZ02`. Khoá dòng dự án của nháp `FOR NO KEY UPDATE`; không thấy dòng dự án → `23503` (câu trả lời của khoá ngoại; `HINT` nêu tên trigger). Đọc dòng ánh xạ có `mapping_version` cao nhất của đúng tenant và dự án; `IBS_HI` → `LTZ01`. Buộc mọi role ghi, kể cả login vận hành |
| `project_domain_mappings_draft_lock` · `public.project_domain_mappings` | `SECURITY DEFINER`, cùng ba thiết lập | Khoá cùng dòng dự án `FOR NO KEY UPDATE`; không thấy dòng dự án → `23503` |
| `draft_decisions_pointer_only_guard` · `public.draft_decisions` (chạy sau `draft_decisions_guard` của 021, theo thứ tự tên) | `SECURITY DEFINER`, cùng ba thiết lập | Chỉ với dòng quyết định `confirmed`: giao dịch không ở READ COMMITTED → `LTZ02`; khoá dòng dự án `FOR NO KEY UPDATE`; không thấy dòng dự án → `23503`; đọc lại ánh xạ, `IBS_HI` → `LTZ01`. Dòng `rejected` đi qua nguyên vẹn. Hàm của 021 đọc nháp dưới phạm vi của người gọi và chạy trước, nên một quyết định về nháp ngoài phạm vi không tới câu đọc ánh xạ |

Một lệnh chèn nháp và một lệnh ghi ánh xạ của cùng dự án vì vậy lần lượt: guard đọc một ánh xạ đã commit, hoặc lệnh ghi ánh xạ chờ nháp và nháp được lưu trước. Một lệnh xác nhận cũng lần lượt với lệnh ghi ánh xạ và với lệnh chèn nháp của cùng dự án. Một lần chờ quá 5 giây kết thúc bằng `55P03` và lệnh không ghi gì. Mã của CSDL do 022 trả: `LTZ01`, `LTZ02`, `23503`, `55P03`. Khoá là khoá dòng trên `public.projects`: chỉ role ghi được bảng đó tự lấy được nó, và không role nào có tên bắt đầu bằng `libetech` làm được (đo trên PostgreSQL 16.15, `measurements-pg16-rowlock.txt`, phép đo 4: chín role, mỗi role ba mức khoá, đều `42501`).

Tệp 022 đã mang năm thân dưới cùng số bản trong PR này: thân không có `LTZ02` (`564712f`…`5013f75`), thân có `LTZ02` (từ `412c8a4`; là thân ở `83d5e2f`), thân dùng khoá tư vấn (`cb1d7dc`), thân dùng khoá dòng với ba hàm (`56d257c`) và thân hiện hành, có thêm guard phía xác nhận (Task F5, `05a6da0`). Sau cổng Codex vòng 1, tệp được **sửa tại chỗ ba lần** (F1, F1b, F5). Vòng sửa 2 (Task G1) không chạm 022. Nó **chưa từng được áp ở đâu ngoài CSDL thử của PR**. Tệp lùi hiện hành gỡ được mọi thân trước đó.

**Ca kiểm của vòng sửa.** Ca mới và ca hiện có đổi kỳ vọng được liệt kê từng ca ở kế hoạch, mục X5 (`docs/plans/oq-45-46-ai-drafts.md:953`) và 07.6 (`:1602`), theo nguồn: vì cổng (G7, G9, G12, RB1, Q7, M10, P3, Q1, Q2, Q4); vì quyết định phạm vi của Chairman và phán quyết đi kèm (mười hai ca E1–E12); vì Task F1b (G4, G11, G12, G19, G20, G21, G22, G25, G27, Y2, RB3 và helper `answer()`); hạ tầng (ba chỗ). Task F1c siết G20, G21, N1, N2 và thêm ca N7; Task F5 thêm các ca của guard phía xác nhận (kế hoạch, 08.4, `:1747`) và đổi một ca hạ tầng: ca «running 021 again changes nothing» của `tests/z4-schema.test.ts` thêm tên trigger mới vào danh sách loại trừ của câu đếm. Task G1 (`ff24901`) thêm nhóm ca H1–H7 và đổi ba ca hiện có — M1 (một dòng bị che không còn mang hash), F5-X1 (bản ngữ cảnh ép sẵn nay phủ cả hai lần dựng) và ca «the context is built under the confirming person, not a wider principal» (hai lần dựng ngữ cảnh cho một lệnh xác nhận, theo phán quyết của phiên chính). Ca H5 chỉ có nửa nháp ứng viên: qua `decide` không vai nào tới được `READ_ONLY`. Chi tiết: kế hoạch, 09.6, `:1995`, đoạn «Như đã làm». Task G2 thêm ca H8 (ba phần), thêm nhánh hash sai vào H7, và đổi bốn ca hiện có — V2 (mục 4 bỏ `SUBJECT_BASELINE_MISSING`; tên được viết lại), T4 nửa sau, D2 nửa sau và D5: qua dịch vụ thật ba ca sau nay chỉ nêu `SOURCE_OUT_OF_CONTEXT` (cộng giữ chỗ của điểm 3 với nháp ứng viên), và luật mốc được thêm lại trên một cách dựng mà không mã che nào giữ nháp. Chi tiết: kế hoạch, 09.6b, `:2056`. Ca canh «no route imports the suggestion service, and nothing in src builds it with an AI handle» và bốn ca canh role AI của `tests/z4-schema.test.ts` không đổi.

## Không làm trong PR này

Tuyến HTTP đọc nháp · login hay khoá cho `libetech_ai` · gọi mô hình · bật Z4 · giao diện · `bot-plugin/` · plugin priority1 · sửa `AGENTS.md`, `CLAUDE.md` · mã cho OQ-54 và OQ-56 · trigger hay cột trên `source_events`, `source_event_revisions`, và mọi thay đổi ở `src/server/intake.ts` (phương án A của hộp chọn không được chọn) · mã lỗi riêng của dịch vụ cho `55P03` · hai mục P3 về bằng chứng của lượt xem lại Task F5 (Q2, Q4) · câu trả lời riêng cho lệnh thiếu hash (P3-4 của lượt xem lại Task G1) · gộp hai bản của cổng xét nháp (`present` và bước giữ của `decide`) thành một hàm · triển khai d1-ai1.

## Phán quyết của phiên (không phải quyết định của Chairman)

Mỗi dòng một phán quyết. Nguồn: sổ của phiên và kế hoạch (X7, 07.8, 08.2, 09.2–09.4, 09.6b).

Trước cổng Codex:

1. Nhận hai giữ chỗ fail-closed của OQ-53 (điểm 1, điểm 2) thay vì «không viết mã» — theo tiền lệ giữ chỗ của dự án; cái giá nếu sai: một nhánh của `subjectReasons` phải gỡ.
2. Áp mọi mục của cổng bảo mật trên kế hoạch, lượt 1; mục N2 thành OQ-55 kèm giữ chỗ có mã riêng.
3. Mục N4 của lượt 2 theo cách sửa 2: `sources` là `[]` dưới mọi lớp che (C9).
4. Bản sao iCloud « 2» chỉ được gỡ khi nội dung trùng tệp gốc hoặc đã có trong kho đối tượng git; không bao giờ `git add -A`.
5. Task 4a và 4b chung một lượt review bảo mật.
6. Đợt sửa sau review theo task gồm cả việc siết guard: từ chối giao dịch không ở READ COMMITTED (`LTZ02`), sau khi đo đường vòng.
7. T3-M4 không đổi: người không có quyền gọi `decide` vẫn lấy khoá nháp và giữ chỗ khoá lệnh trước khi bị từ chối; cần giới hạn tần suất khi có tuyến.
8. Điểm «dự án chưa ánh xạ miền» thành OQ-56, không viết mã: hướng chặt là một chính sách dữ liệu mới, không phải một giữ chỗ.
9. Khe theo thứ tự commit thành điểm 3 của OQ-53, lúc đó không viết mã (về sau có quyết định phạm vi của Chairman, mục «Căn cứ và quyết định»).
10. Finding F-1 của reviewer mã (cổng xét nháp có hai bản): thêm một ca đi qua mọi mã che; việc gộp thành một hàm để lượt mã của OQ-53 và OQ-55.
11. Commit `bcdb360` mang loại `test` nhưng có ba chạm nhỏ ở `src`: không viết lại lịch sử; ghi ở đây và ở mô tả PR.
12. Việc soát lại đợt sửa 1 gộp vào ba lượt review tầng 1.
13. Ca đỏ một lần của `tests/review-delegations.test.ts` (F-5) xếp là việc ngoài phạm vi, không sửa.
14. Thêm một vòng chỉ sửa ca cho Task 1 (vòng 3 trên 3) để phép so cả thân hàm của G12 có thể sai; các lượt cả bộ chạy lại một lần ở đầu nhánh cuối, sau cổng Codex.

Vòng sửa sau cổng Codex vòng 1:

15. CX1 → một trigger thứ hai `SECURITY INVOKER` trả câu trả lời của RLS trước guard; G7 và G9 đổi kỳ vọng có chủ ý.
16. CX2 → giữ chỗ fail-closed theo dự án với mã riêng; chữ của OQ-55 được cập nhật tại chỗ.
17. CX4 → lúc đầu là khoá tư vấn theo dự án (về sau bị thay, dòng 26).
18. CX3 nằm ngoài phạm vi của brief: một câu hỏi được gửi phiên điều phối với ba phương án; câu trả lời là quyết định phạm vi của Chairman, không phải phán quyết của phiên.
19. Áp mọi mục của cổng bảo mật trên thiết kế vòng sửa; mục N2 theo cách cổng khuyến nghị: `PROJECT_TEXT_HIDDEN` cho cả hai loại nháp, ghi rõ là rộng hơn chữ của phương án (e).
20. Nhận ba chỗ planner làm khác phán quyết ban đầu: điều kiện của trigger phạm vi là đủ ba vế của policy `ai_insert`; phải là hai hàm vì hàm definer không biết người chèn có chịu RLS hay không; phép kiểm `INVALID_INPUT` của nháp ứng viên dời lên trước bước giữ.
21. Trần chờ 5 giây ghim trong hai hàm lấy khoá (`55P03`); `submitDraft` không bắt mã này, lỗi đi thô như mọi lỗi CSDL khác ngoài `LTZ01`.
22. Phép kiểm «đóng khi dự án ngoài phạm vi» áp cho `projectHasHiddenText`, không sửa `threadHasHiddenText`: sau F2, nơi nào gọi hàm theo luồng cũng gọi hàm theo dự án trong cùng giao dịch.
23. Ba chỗ làm khác chữ của cổng bảo mật trên thiết kế, có lý do ghi ở kế hoạch X7: X-M10 không viết lại (điều cần ghim nằm ở W5); tên G22 bỏ chữ «takes no lock» thay vì thêm một phép đọc không thể sai; RB3 gỡ tay bằng `IF EXISTS` để đỏ được vì khẳng định.
24. M4 không đổi; ca đổi vì CX2 là Q7, M10, P3 và — sau mục N2 — Q1, Q2, Q4.
25. R12-i: việc dời `INVALID_INPUT` giữ nguyên; ca R12-i gửi dòng «cặp» không kèm bản đề xuất và là ca thứ mười hai đổi kỳ vọng vì CX3 (E12). Câu của kế hoạch «không ca hiện có nào dựng tổ hợp đó» là sai và đã được đính chính trong kế hoạch.
26. Khoá của CX4 thành khoá dòng: cả hai hàm khoá dòng dự án `FOR NO KEY UPDATE`, lọc theo tenant, đều `SECURITY DEFINER` với `search_path` ghim, `row_security = off`, `lock_timeout '5s'`; dòng dự án không thấy được bị từ chối bằng mã của khoá ngoại, `23503`; khoá tư vấn bị gỡ.
27. Không dùng `FOR SHARE` trong guard như khối SQL của review CSDL: đã đo, các lệnh chèn nháp gối nhau khi đó bỏ đói lệnh ghi ánh xạ không giới hạn. Cái giá của `FOR NO KEY UPDATE` ở cả hai phía: nháp của một dự án được ghi lần lượt.
28. Câu trả lời cho dòng dự án không thấy được bắt chước khoá ngoại thay vì một mã riêng: role chịu RLS không nhận loại câu trả lời mới, và ca có sẵn chờ `/foreign key/` giữ nguyên.
29. Về quy trình: phần đánh giá thiết kế khoá dòng của hai review của vòng sửa được tính là «cổng soát phương pháp trước khi viết mã» cho thay đổi này; cả hai ghế xem lại mã sau builder.
30. Các finding còn lại của hai review: S-3 làm bằng `statement_timeout` của lệnh chờ và timeout của ca, không bằng `Promise.race`; DB-5 không còn khẳng định về `pg_locks`; DB-8 ghi nhận, không đổi; S-5 chỉ ghi chú; cách thứ hai của S-1 (giữ khoá tư vấn và canh `pg_locks`) không dùng.
31. Điều kiện 18 thêm hai ý (giao dịch chèn nháp ngắn; tuyến đầu tiên gọi `submitDraft` đổi `55P03` và `40P01` thành lỗi thử-lại-được của dịch vụ, không kèm `CONTEXT` của CSDL); điều kiện 24 do planner đề xuất được giữ.

Hai lượt quét trước cổng Codex vòng 2, và Task F5:

32. Trước cổng Codex vòng 2, hai reviewer mới quét cả lớp lỗi của bốn finding vòng 1 — một lượt cho chạy đua, một lượt cho oracle và khe che — thay vì chỉ soát các ví dụ đã sửa.
33. Finding F1 của lượt quét chạy đua (P1) được sửa trước cổng Codex vòng 2, thành Task F5: trigger thứ tư của 022 trên `public.draft_decisions`; `decide` đổi `LTZ01` ở lệnh chèn quyết định thành `DRAFT_HELD` có `POINTER_ONLY_PROJECT`; `LTZ02`, `23503`, `55P03`, `40P01` đi thô. Finding F2 của lượt đó và S5 của lượt kia được đóng bằng cùng khoá.
34. S1 của lượt quét oracle — hash của `value` vẫn tới người có quyền quyết định dưới lớp che — lúc đó được giữ lại làm phần dư R3, viết lại đúng cỡ, với lý do: nó có trong bối cảnh gửi cổng vòng 1 và cổng không nêu nó; đóng nó là đổi hợp đồng của `decide` từ lát 3. **Phán quyết này sai với cổng này:** cổng Codex vòng 2 nêu đúng mục đó ở mức P0, và nó được đóng bằng Task G1 (dòng 42).
35. S3 ở lại là phần dư (R35); thêm điều kiện 25 trước khi bật Z4.
36. S4: lúc đó không đổi mã — các mã của một lần giữ được coi là thứ phương án (b) của điểm 2 OQ-45 trả; R15 đếm thiếu và được đính chính. **Về sau được thay:** mã đổi ở Task G2 (dòng 44).
37. Các mục P3 còn lại của hai lượt quét (F3, F4, F6, F7, S6): mỗi mục một dòng ở kế hoạch; hai phần dư mới R38, R39.
38. Các mục về ca của hai lượt xem lại Task F1b (R-1, R-2, R-3, S-7) thành Task F1c; các mục về chữ (R-4, R-5, S-6) được nối vào R34 và điều kiện 18; «mười role» trong tệp đo và trong kế hoạch được sửa thành chín.
39. Task F5, một ca hiện có đổi theo phán quyết: ca «running 021 again changes nothing» của `tests/z4-schema.test.ts` đếm trigger mới như một trigger của 021; tên trigger đó được thêm vào danh sách loại trừ của câu đếm — một dòng, đổi hạ tầng.
40. Hai lượt xem lại mã của Task F5 (cả hai «READY FOR GATE»): Q1 và S-F5-1 — cùng một điều, P2 về chữ — được sửa tại chỗ ở kế hoạch và ở biên nhận này: từ Task F5, login web (role runtime) giữ được khoá dòng dự án qua trigger của bảng quyết định; điều kiện 18 thêm `idle_in_transaction_session_timeout` cho login đó. Q3 thành một câu ở kế hoạch; S-F5-2 và phần về lỗi thô của Q5 đã nằm trong điều kiện 18.
41. Q2 và Q4 của lượt xem lại CSDL (P3, về bằng chứng) **không làm**. Q2: hai ca F5-X1 và Y3 không khẳng định đường nào trả lời — trigger hay phép kiểm của dịch vụ. Q4: bốn ca chỉ chạy trên PostgreSQL thật của Task F5 chưa từng được thấy đỏ trên thân cũ của 022; làm việc đó cần thân cũ của 022 và `decide` cũ trong cây làm việc đúng lúc cổng đang đọc nó.

Sau cổng Codex vòng 2:

42. Finding của vòng 2 → Task G1, vòng sửa 2: dưới mọi lớp che dòng trả ra mang `valueHash` rỗng; `decide` không so hash cho người mà nháp đang bị che với họ — lệnh xác nhận bị giữ như trước, lệnh từ chối được ghi không cần hash (cách hiểu C3); với người mà nội dung được hiện, thiếu hash được trả lời như hash sai; một lệnh xác nhận không bao giờ đi qua khi thiếu hash đúng — hash được so lần nữa sau bước giữ; `valueHash` thành trường tuỳ chọn của lệnh và dòng quyết định vẫn ghi hash đã lưu. Lý do: cổng đọc điểm 2 (b) của OQ-45 là chỉ trả mã và lý do giữ, không gì khác. Cái giá nếu sai: hợp đồng của `decide` từ lát 3 đổi; mỗi `decide` dựng thêm một lần ngữ cảnh.
43. Đính chính về số vòng sửa: chữ của brief là «Tối đa hai vòng sửa ở cổng». Một vòng sửa đã dùng sau vòng 1; còn được một vòng nữa (Task G1 và Task G2), rồi một lượt chạy cuối của cổng, vòng 3. Các dòng trước đây của sổ, của kế hoạch, của biên nhận này và của roadmap gọi vòng 2 là «vòng cuối» là sai và đã được sửa; hai câu commit `12570c4` và `05a6da0` vẫn mang chữ «the last gate round» và không được viết lại. Vòng 3 còn một P0 hoặc P1 thì công việc dừng và được báo là chưa hội tụ.
44. Lượt xem lại bảo mật của Task G1 («READY FOR GATE»; một P2, bốn P3). P2-1 — câu `DRAFT_HELD` của lệnh xác nhận trên một nháp bị che nêu mọi mã của cổng, tức R15 — được đóng trước lượt chạy cuối của cổng, thành Task G2, cùng vòng sửa 2: khi có ít nhất một mã che giữ nháp, câu giữ chỉ nêu các mã che, cộng `SUBJECT_ORDER_UNVERIFIED` với nháp ứng viên; một lần giữ không có mã che nào nêu mọi mã. Lý do: đó là mục còn lại của lớp thứ hai; ba dòng mã; reviewer xếp rủi ro ở cổng là thấp nhưng không bằng không, và lượt chạy kế là lượt cuối. Cái giá nếu sai: người quyết định một nháp bị che thấy ít mã chẩn đoán hơn cho tới khi nội dung được hiện lại; vài ca đổi kỳ vọng. Phán quyết này thay dòng 36.
45. Các mục P3 của lượt đó: P3-3 — nhánh hash sai được thêm vào H7, trong Task G2; P3-2 — một lệnh từ chối tới khi nháp bị che và được ghi sau khi lớp che gỡ thì không mang hash: chấp nhận theo C3, chỉ ghi lại; P3-4 — câu «Nháp đã đổi…» cho một lệnh thiếu hash: chỉ ghi lại, mã và trạng thái đúng; P3-1 thu hẹp nhờ Task G2, còn `SOURCE_OUT_OF_CONTEXT`.
46. Ba ca có nửa sau khẳng định một mã mốc trên một nháp mà một mã che giữ — «the newest revision the draft names is the baseline…» (D2), «an id that is not a lower-case uuid names nothing…» (D5) và ca nháp ứng viên của OQ-53 (2) (T4): qua dịch vụ thật chúng nay chỉ nêu `SOURCE_OUT_OF_CONTEXT`, cộng giữ chỗ với nháp ứng viên; luật mốc được thêm lại trên một cách dựng mà không mã che nào giữ nháp (ngữ cảnh được lái). Ca V2: mục 4 bỏ `SUBJECT_BASELINE_MISSING`; tên thêm « — on a draft that no mask reason holds» (về sau viết lại: dòng 48).
47. Trong Task G1, builder dừng ở ca «the context is built under the confirming person, not a wider principal», vốn chờ một lần dựng ngữ cảnh cho một lệnh xác nhận: phán quyết là chờ hai lần, mỗi lần dưới đúng người đó.
48. Lượt xem lại bảo mật của Task G2 («READY FOR GATE»; hai P3). P3-2 — tên của ca V2 hẹp hơn nội dung, vì ba mục của chính ca kiểm nháp bị che — do phiên chính tự sửa: một tên ca, không khẳng định nào đổi (`9b0f83f`); đó là chỗ duy nhất phiên chính tự sửa một tệp test trong việc này. P3-1 — khi không dựng được ngữ cảnh, câu giữ có thể thiếu `SCHEMA_INVALID` mà `list` hiện cho cùng dòng — chỉ ghi lại.

## Bằng chứng kiểm

Tệp nằm ở `docs/reviews/oq-45-46-evidence-20261118/`; đường dẫn thư mục máy trong log đã được thay bằng `<repo>`, không log nào chứa chuỗi kết nối hay tên CSDL thử. PostgreSQL 16.15 chạy trong container thử chỉ nghe loopback, trên một CSDL riêng của PR.

| Lệnh | Kết quả | Log |
|---|---|---|
| Gốc `4f12a3c`: `npx vitest run` trên PGlite | 65 tệp đạt, 12 bỏ qua; 1 104 ca đạt, 62 bỏ qua | `baseline-pglite.txt` |
| Gốc `4f12a3c`: `npx vitest run` trên PostgreSQL 16 | 77 tệp đạt; 1 166 ca đạt, 0 bỏ qua | `baseline-native.txt` |
| Trước cổng Codex, ở `83d5e2f`: `npm run typecheck` | mã thoát 0 | `head-83d5e2f-typecheck.txt` |
| Ở `83d5e2f`: `npx vitest run` trên PGlite | 66 tệp đạt, 12 bỏ qua; 1 184 ca đạt, 65 bỏ qua (tổng 1 249) | `head-83d5e2f-pglite.txt` |
| Ở `83d5e2f`: `npx vitest run --reporter=verbose` trên PostgreSQL 16 | 78 tệp đạt; 1 249 ca đạt, 0 bỏ qua | `head-83d5e2f-native-verbose.txt` |
| Mã ở `383c394`: `rm -rf .next && npm run build` | mã thoát 0 | `final-build.txt` |
| Mã ở `383c394`: `npx vitest run --coverage` trên PGlite | mọi tệp: câu lệnh 96,36 · nhánh 91,69 · hàm 98,05 · dòng 97,63; `suggestions.ts`: 97,85 · 96,65 · 100 · 100 | `coverage-383c394.txt` |
| Vòng sửa, Task F1 (`cb1d7dc`): PGlite | 12 tệp đạt, 1 bỏ qua; 368 ca đạt, 16 bỏ qua | `codex-fix1-F1-green.txt` |
| Task F1: PostgreSQL 16 | 7 tệp đạt; 239 ca đạt | `codex-fix1-F1-native-verbose.txt` |
| Task F2 (`1a423a5`): PGlite | 4 tệp đạt; 195 ca đạt, 1 bỏ qua | `codex-fix1-F2-green.txt` |
| Task F2: PostgreSQL 16 | 5 tệp đạt; 203 ca đạt | `codex-fix1-F2-native-verbose.txt` |
| Task F3 (`f434f0a`): PGlite | 3 tệp đạt; 151 ca đạt, 1 bỏ qua | `codex-fix1-F3-green.txt` |
| Task F3: PostgreSQL 16 | 5 tệp đạt; 208 ca đạt | `codex-fix1-F3-native-verbose.txt` |
| Task F1b (`56d257c`): PGlite | 10 tệp đạt, 1 bỏ qua; 305 ca đạt, 20 bỏ qua | `codex-fix1-F1b-green.txt` |
| Task F1b: PostgreSQL 16 | cùng 11 tệp đó đạt; 325 ca đạt, 0 bỏ qua | `codex-fix1-F1b-native-verbose.txt` |
| Cả bộ ở `56d257c` (trước F1c và F5) | typecheck mã thoát 0 · PGlite: 66 tệp đạt, 12 bỏ qua; 1 208 ca đạt, 74 bỏ qua · PostgreSQL 16: 78 tệp đạt; 1 282 ca đạt, 0 bỏ qua | `head-56d257c-typecheck.txt`, `head-56d257c-pglite.txt`, `head-56d257c-native-verbose.txt` |
| Task F1c (`0ec1e1b`, chỉ ca kiểm): PGlite | 1 tệp; 25 ca đạt, 9 bỏ qua | `codex-fix1-F1c-green.txt` |
| Task F1c: PostgreSQL 16 | 1 tệp; 34 ca đạt, 0 bỏ qua | `codex-fix1-F1c-native-verbose.txt` |
| Task F5 (`05a6da0`): PGlite | 7 tệp đạt, 1 bỏ qua; 213 ca đạt, 23 bỏ qua | `codex-fix1-F5-green.txt` |
| Task F5: PostgreSQL 16 | cùng 8 tệp đó đạt; 236 ca đạt, 0 bỏ qua; không timeout, không `40P01` | `codex-fix1-F5-native-verbose.txt` |
| Cả bộ ở `05a6da0` (trước Task G1) | typecheck mã thoát 0 · `npx vitest run --coverage` trên PGlite: 66 tệp đạt, 12 bỏ qua; 1 212 ca đạt, 79 bỏ qua (tổng 1 291); mọi tệp: câu lệnh 96,34 · nhánh 91,65 · hàm 98,06 · dòng 97,6; `suggestions.ts`: 97,54 · 95,92 · 100 · 99,4 · PostgreSQL 16: 78 tệp đạt; 1 291 ca đạt, 0 bỏ qua; không timeout, không `40P01` · `rm -rf .next && npm run build` mã thoát 0 | `head-05a6da0-typecheck.txt`, `head-05a6da0-coverage.txt`, `head-05a6da0-native-verbose.txt`, `head-05a6da0-build.txt` |
| Vòng sửa 2, Task G1 (`ff24901`): PGlite | 4 tệp đạt; 196 ca đạt, 1 bỏ qua; typecheck mã thoát 0 | `codex-fix2-G1-green.txt` |
| Task G1: PostgreSQL 16 | 5 tệp đạt; 206 ca đạt, 0 bỏ qua | `codex-fix2-G1-native-verbose.txt` |
| Vòng sửa 2, Task G2 (`d9b0974`): log đỏ, PGlite, PostgreSQL 16, typecheck, ca hiện có đổi | log đỏ trên mã cũ 3 `AssertionError` (H8, V2 ý 4, ca ứng viên của OQ-53 (2)), 0 hết giờ; lượt đỏ thứ hai cho ba khẳng định «mốc» được khôi phục: 3 `AssertionError`; PGlite 4 tệp, 197 ca đạt, 1 bỏ qua; PostgreSQL 16 5 tệp, 207 ca đạt, 0 bỏ qua; typecheck mã thoát 0. Ca hiện có đổi: V2 (ý 4; tên ca, sửa lại lần nữa ở `9b0f83f`) và ba ca «mốc» | `codex-fix2-G2-red.txt`, `codex-fix2-G2-red-2.txt`, `codex-fix2-G2-green.txt`, `codex-fix2-G2-native-verbose.txt` |
| Sau hai vòng sửa, ở đầu nhánh: `npm run typecheck` | mã thoát 0 (chạy lại ở đầu nhánh, sau commit đổi tên ca `9b0f83f`) | `head-9b0f83f-typecheck.txt` |
| Sau hai vòng sửa: `npx vitest run` trên PGlite | 66 tệp đạt, 12 bỏ qua; 1 220 ca đạt, 79 bỏ qua (tổng 1 299); không ca hết giờ. Chạy cùng lượt coverage (`npx vitest run --coverage`), không chạy riêng một lượt không coverage. Lượt này bắt đầu lúc 15:50:45 (dòng `Start at` của log): sau commit `d9b0974` (15:50:23), trước commit `9b0f83f` (15:52:58). `9b0f83f` chỉ đổi tên một ca (một dòng của `tests/suggestions.test.ts`), nên số ca và số phủ là của mã `src/` và `migrations/` ở đầu nhánh; log không chứng minh được tên ca mới đã có trong cây lúc chạy. Lượt PostgreSQL 16 (bắt đầu 16:01:02) mang tên ca mới | `head-9b0f83f-coverage.txt` |
| Sau hai vòng sửa: `npx vitest run --reporter=verbose` trên PostgreSQL 16 | 78 tệp đạt; 1 299 ca đạt, 0 bỏ qua; không ca hết giờ, không dòng `40P01` | `head-9b0f83f-native-verbose.txt` |
| Sau hai vòng sửa: `rm -rf .next && npm run build` | mã thoát 0 | `head-9b0f83f-build.txt` |
| Sau hai vòng sửa: `npx vitest run --coverage` trên PGlite | mọi tệp: câu lệnh 96,35 · nhánh 91,68 · hàm 98,06 · dòng 97,61; `suggestions.ts`: 97,61 · 96,47 · 100 · 99,42 (dòng 346 không được phủ trên PGlite: câu ném lại lỗi của lệnh chèn quyết định, chỉ tới được trên PostgreSQL — ca Y4). Số phủ theo từng tệp ở gốc `4f12a3c` chưa từng được đo, nên không có phép so theo tệp với gốc | `head-9b0f83f-coverage.txt` |
| Từng task trước cổng: log đỏ, xanh PGlite, lượt PostgreSQL 16 | bảng dưới | `task-N-red.txt`, `task-N-green.txt`, `task-N-native.txt` |
| Ba đợt sửa trước cổng | bảng dưới | `fix1a-*`, `fix1b-*`, `fix2-*`, `fix3-*` |
| Đo trên PostgreSQL 16.15 | mục «Đo» dưới | `measurements-pg16.txt`, `measurements-pg16-2.txt`, `measurements-pg16-rowlock.txt` |

Các lượt của từng task (F1, F2, F3, F1b, F1c, F5, G1, G2) chạy một nhóm tệp của task, không phải cả bộ; các lượt cả bộ là dòng ở `56d257c`, dòng ở `05a6da0` và các dòng «Sau hai vòng sửa».

Đỏ trước mã, theo task (đếm trong log đỏ; «hết giờ» là số dòng `timed out`):

| Task | Dòng `AssertionError` | Hết giờ | Ghi chú |
|---|---|---|---|
| 1 — migration 022 | 8 | 0 | bảy ca đỏ vì hành vi (G1, G3, G5, G6, G7, G9, G14) và G8 (câu lỗi không khớp `/permission denied/` vì hàm chưa có) — tám dòng; G11, G12 và ca lùi đỏ vì thiếu hàm hoặc tệp, không có dòng `AssertionError` |
| 2 — `POINTER_ONLY_PROJECT` | 2 | 0 | S1, S2 |
| 3 — ai đọc nội dung | 10 | 0 | L1, L3, L4, L7, L8, L9 và các ca đổi kỳ vọng |
| 4a — xét lại lúc đọc | 8 | 0 | M1–M3, M5–M9; M4 là ca đối chứng, xanh từ đầu |
| 4b — giữ chỗ OQ-55 | 5 | 0 | Q1–Q4, Q9; các ca của `source-text` đỏ vì thiếu hàm xuất, không tính |
| 5 — nháp tài liệu đã cũ | 4 | 0 | D1, D2, D3, D5; D6 đỏ vì thiếu hàm xuất, không tính |
| 6 — nháp ứng viên đã cũ | 3 | 0 | T1, T3, T4; T6–T8 đỏ vì thiếu hàm xuất, không tính |
| Đợt sửa 1a — guard | 2 | 0 | G16 và phần thêm của G12 |
| Đợt sửa 1b, 2, 3 — ca bổ sung | mỗi phép đột biến tạm 1 | 0 | `fix1b-mutations.txt`, `fix2-mutations.txt`, `fix3-mutation.txt` |
| F1 — trigger phạm vi, khoá theo dự án | 9 | 0 | `codex-fix1-F1-red.txt`; năm ca chỉ chạy trên PostgreSQL thật không có log đỏ |
| F2 — `PROJECT_TEXT_HIDDEN` | 12 | 0 | `codex-fix1-F2-red.txt` |
| F3 — `SUBJECT_ORDER_UNVERIFIED` | 10 ở đợt 1 | 0 | `codex-fix1-F3-red-1.txt` (V1, V2, V4, E1, E2, E3, E5, E8, E9, E10); `codex-fix1-F3-red-2.txt` và `-red-2b.txt`: sau khi đổi mã, R12-i và bốn ca E4, E6, E7, E11 đỏ vì lệnh xác nhận nháp ứng viên trả `DRAFT_HELD` có `SUBJECT_ORDER_UNVERIFIED` |
| F1b — khoá dòng | 6 | 0 | `codex-fix1-F1b-red.txt` (chạy trên SQL cũ); các ca chỉ chạy trên PostgreSQL thật không có log đỏ |
| F1c — ca kiểm siết lại | 1 | 0 | `codex-fix1-F1c-red.txt` |
| F5 — guard phía xác nhận | 7 | 0 | `codex-fix1-F5-red.txt` (PGlite: 3 tệp đỏ; 7 ca đỏ, 131 đạt, 12 bỏ qua; theo sổ của phiên: F5-X1, G12, G20, F5-P1, F5-P2, RB1, RB2); bốn ca chỉ chạy trên PostgreSQL thật (F5-P4, F5-P5, Y3, Y4) không có log đỏ — mục Q4 của lượt xem lại, không làm |
| G1 — hash dưới lớp che | 7 | 0 | `codex-fix2-G1-red.txt` (H1–H7) |
| G2 — câu giữ trên một nháp bị che | theo ô Task G2 của bảng trên | — | do phiên chính ghi |

**Đo trên PostgreSQL 16.15** (phiên chính đo trên CSDL thử, dữ liệu tổng hợp):

1. Trước khi siết guard: một giao dịch của role AI mở trước khi ánh xạ `IBS_HI` được commit, chèn nháp sau đó — REPEATABLE READ và SERIALIZABLE: **nháp được lưu**; READ COMMITTED: `LTZ01`. Sau khi siết: cả hai mức đó trả `LTZ02` (ca G16, G17).
2. Bản data-only tạo bằng lệnh của `docs/DEPLOY-002.md:19`: dữ liệu của `intelligence.ai_drafts` đứng thứ 27, của `public.project_domain_mappings` thứ 53 trên 61 bảng.
3. `to_regclass` và `to_regprocedure` trả `NULL` khi schema không còn.
4. `COPY … FROM STDIN` dưới role `libetech_ai`: `0A000`; dưới login vận hành cho một dự án `IBS_HI`: `LTZ01`.
5. Cơ chế khoá dòng (`measurements-pg16-rowlock.txt`; đo trong một schema nháp dựng lại hình dạng, không ghi bảng nào của ứng dụng): bên giữ `FOR NO KEY UPDATE` không chặn lệnh chèn có khoá ngoại tới dòng đó; một hàm chờ khoá xong thì đọc được dòng vừa commit; không có phép từ chối thì một nháp được lưu cho một dự án vừa thành `IBS_HI` mà guard chưa đọc ánh xạ, có phép từ chối thì `23503` sau 1 ms; với `FOR SHARE` trong guard, lệnh ghi ánh xạ bị bỏ đói tới khi trần 14 giây của câu lệnh cắt (`57014`), trong lúc 282 giao dịch chèn nháp đi qua; với `FOR NO KEY UPDATE`, nó được phục vụ sau 418 ms; một giao dịch chèn nháp để mở trả `55P03` sau 5 003 ms cho lệnh chèn nháp kế tiếp và cho lệnh ghi ánh xạ; cả chín role có tên bắt đầu bằng `libetech` nhận `42501` khi tự khoá một dòng của `public.projects`, ở cả ba mức.

Đây là phép đo cơ chế. Hành vi của chính các hàm của 022 do các ca chỉ chạy trên PostgreSQL thật chứng minh: kết quả nằm ở các dòng PostgreSQL 16 của Task F1b, F1c và F5, và ở dòng PostgreSQL 16 «Sau hai vòng sửa» của bảng trên.

## Ca âm → test tự động

| Yêu cầu | Ca |
|---|---|
| Người đọc không có quyền xác nhận không nhận `value` (cả hai loại nháp, từng vai đọc; `viewer`, `bot` vẫn 404) | L1, L2, L3, L4, L6 |
| Người không có quyền không dò được nội dung qua `decide`, kể cả qua hình dạng của lệnh | L8, V5, H5 |
| Một nháp bị che không trả hash của nội dung; `decide` trả lời như nhau cho người mà nháp bị che, dù gửi hash đúng, hash sai hay không gửi; từ chối một nháp bị che không cần hash; với người được cho thấy nội dung hash vẫn bắt buộc; lệnh xác nhận không đi qua khi thiếu hash đúng (cổng Codex vòng 2) | ca của Task G1: H1, H2, H3, H4, H6, H7 (H7 gồm cả nhánh hash sai, thêm ở Task G2) |
| Trên một nháp mà một mã che giữ, câu giữ của lệnh xác nhận chỉ nêu các mã che — và giữ chỗ của điểm 3 với nháp ứng viên — không mã nào tả nội dung (lượt xem lại Task G1, P2-1) | H8 (ba phần); theo kỳ vọng mới: mục 4 của V2, T4 nửa sau, D2 nửa sau, D5 |
| `value` bị che khi người đọc không đọc được chữ của tin (cờ nhóm gỡ, danh sách nhóm mặc định rỗng) | M1 |
| `value` bị che khi dự án chỉ con trỏ (ánh xạ sang `IBS_HI` sau khi nháp đã lưu) | M2, M9 |
| Bản chép của nội dung không thành đường rò thứ hai (`questions`, `sources`, `manifestHash`, chuỗi phiên bản) | L1, L3, L4, L7, M1, M3, M8 |
| Không chứng minh được là đọc được thì che | M3, L9 |
| Điều bị che lúc đọc luôn bị giữ lúc xác nhận | P3 (đi qua mọi mã che), Q3, W2, W8 |
| Ghi nháp cho dự án `IBS_HI` bị từ chối, qua dịch vụ | S1, S2; sau khi chờ một ánh xạ chưa commit: Y1 |
| … và chèn thô dưới role AI, dưới login vận hành, qua `ON CONFLICT`, chèn nhiều dòng, `MERGE` | G1, G3, G5, G6, G14, G18 |
| Role chịu RLS không phân biệt được dự án `IBS_HI` ngoài phạm vi nó khai với dự án khác (CX1) | G7, G9, G19, G26; policy mà trigger soi được ghim: G25 |
| Lệnh chèn nháp và lệnh ghi ánh xạ của một dự án lần lượt; lần chờ có trần (CX4) | G21, G22, G23, G24, G27, Y2; ca mới của Task F1b và F1c: N1–N7 |
| Một lệnh xác nhận không commit được cho dự án vừa thành `IBS_HI` sau phép kiểm của dịch vụ; lệnh từ chối không bị chạm; một quyết định về nháp ngoài phạm vi của người gọi không tới câu đọc ánh xạ (finding F1 của lượt quét chạy đua) | ca của Task F5: F5-P1…F5-P5, F5-X1, Y3, Y4 |
| Dự án chưa ánh xạ và nhãn khác vẫn ghi được (hành vi OQ-56 hỏi) | G2, S3 |
| Giao dịch không ở READ COMMITTED không ghi được nháp | G16, G17 |
| Nháp tài liệu có đối tượng đã đổi bị giữ; không dòng quyết định, không bản tài liệu, khoá lệnh còn tự do | D1, D2, D7; chạy đua: ba ca trong `tests/suggestions-concurrency.test.ts` |
| Nháp ứng viên có luồng đã có tin mới bị giữ | T1, T9, T11, T14 |
| Giữ chỗ OQ-53, điểm 1 và 2 | D3, T3, T4 (nửa đầu), T10, T15. Sau Task G2, D5 và nửa sau của D2 và T4 chỉ nêu `SOURCE_OUT_OF_CONTEXT`: luật mốc của chúng được ghim trên một cách dựng mà không mã che nào giữ nháp — theo ô Task G2 của bảng «Bằng chứng kiểm» |
| Giữ chỗ OQ-53, điểm 3: không nháp ứng viên nào xác nhận được; các phép kiểm khác vẫn chạy, và vẫn nêu mã khi không mã che nào giữ nháp; từ chối và đọc không bị chạm | V1, V2, V3, V4; mười hai ca E1–E12 |
| Giữ chỗ OQ-55 theo luồng | Q1–Q6, Q8–Q11 |
| Giữ chỗ OQ-55 theo dự án, cho cả hai loại nháp (CX2) | U1, U2, U3, W1–W8 |
| Từ chối và phát lại không bị phép giữ mới chặn | D4, T5, W6 |
| Đọc và ghi chéo tenant, chéo dự án bị chặn | L2, M3, G4, G9, S4, T8, T12, Q11, U1 |
| Quality Gate 34a (đọc) · 34b (ghi) · 34c (sửa, xoá) · 34d (không ngữ cảnh) · 34e (không vượt RLS) cho đối tượng mới | G8, G4 · G4, G9, G19 · G10 · G7, G11 · G6, G8, G13, G20 |
| Migration idempotent và có rollback, kể cả từ một thân cũ | G12, RB1, RB2, RB3 |

Mã ca theo kế hoạch; N1–N7 là mã của brief Task F1b và F1c; các ca của Task F5 mang mã của brief đó, viết ở đây với tiền tố «F5-»; H1–H7 là mã của brief Task G1; H8 là mã của brief Task G2.

## Review hai tầng

**Trên kế hoạch (trước khi viết mã).** `liberico-security-reviewer`, hai lượt: `gates/security-gate-plan-round-1.md` (3 mục phải sửa, 7 nên sửa, 10 ca thiếu) và `gates/security-gate-plan-round-2.md` (1 mục phải sửa — N4 —, 2 nên sửa — R8, R9 —, 3 ca thiếu — C11–C13). Kế hoạch sửa theo cả hai.

**Theo task** (sáu lượt; không Critical):

| Task | Reviewer | Tệp | Chất lượng | Important |
|---|---|---|---|---|
| 1, 2 | CSDL | `gates/review-task-1-2-database.md` | Approved | 1 (ghi chú triển khai: phục hồi data-only) |
| 1, 2 | bảo mật | `gates/review-task-1-2-security.md` | Approved | 0 |
| 3 | bảo mật | `gates/review-task-3-security.md` | Approved | 0 |
| 4a, 4b | bảo mật | `gates/review-task-4a-4b-security.md` | Needs fixes (ca kiểm) | 1 |
| 5 | mã | `gates/review-task-5-code.md` | Needs fixes (ca kiểm) | 1 |
| 6 | bảo mật | `gates/review-task-6-security.md` | Needs fixes (ca kiểm) | 1 |

Một vòng sửa cho mỗi task bị nêu (trần ba). Mọi finding được trả lời ở đợt sửa 1 hoặc bằng phần dư.

**Tầng 1 trên cả nhánh, trước cổng Codex** (`4f12a3c..f36e947`): `gates/tier1-code.md`, `gates/tier1-security.md`, `gates/tier1-database.md` — cả ba «READY FOR GATE», không P0, không P1. Đợt sửa 2 (`383c394`) được reviewer mã soát lại riêng (`gates/tier1-recheck-fix2.md`): «READY FOR GATE»; mục còn lại của lượt đó được sửa ở `5c08fda` (chỉ ca kiểm; `fix3-mutation.txt`).

**Tầng 2 — cổng Codex, vòng 1** (`codex exec --sandbox read-only`, gốc `4f12a3c`, đầu `83d5e2f`): `VERDICT: CHANGES_REQUIRED` — 2 P0 (CX1, CX2), 2 P1 (CX3, CX4). Kết quả: `codex-round-1.md`; bối cảnh đã gửi: `codex-context-round-1.md`. Cách xử lý từng finding: bảng ở mục «Đã làm».

**Trong vòng sửa 1:**

- Cổng bảo mật trên thiết kế vòng sửa, trước khi viết mã: `gates/security-gate-codex-fix-plan.md` — «PLAN NEEDS CHANGES» (2 mục phải sửa, 8 nên sửa, 9 ca thiếu); kế hoạch bản 0.6 áp mọi mục.
- Review CSDL của Task F1 (`cb1d7dc`): `gates/review-codex-fix1-F1-database.md` — «READY FOR GATE»; P0 0, P1 0, P2 3, P3 6 (DB-1…DB-9).
- Review bảo mật của F1–F3 (`f5b2a36..f434f0a`): `gates/review-codex-fix1-security.md` — «READY FOR GATE»; P0 0, P1 0, P2 1, P3 4 (S-1…S-5).
- Cả hai review viết rằng họ sẽ ship khoá dòng trên `public.projects` thay cho khoá tư vấn nếu vòng sửa còn chỗ; đó là Task F1b. Từng finding áp ở đâu: bảng ở kế hoạch, mục 07.9 (`docs/plans/oq-45-46-ai-drafts.md:1654`). DB-8 được ghi nhận, không đổi; S-5 chỉ thành ghi chú.
- Hai ghế xem lại mã của Task F1b (`56d257c`): cả hai «READY FOR GATE». CSDL — `gates/review-codex-fix1-F1b-database.md`: P0 0, P1 0, P2 0, P3 5 (R-1…R-5). Bảo mật — `gates/review-codex-fix1-F1b-security.md`: hai P3 (S-6, S-7). Task F1c (`0ec1e1b`) áp các mục về ca — R-1, R-2, R-3 cùng S-7 — và thêm ca N7; các mục về chữ (R-4, R-5, S-6) nằm ở kế hoạch, trong R34 và điều kiện 18.
- Hai lượt quét theo lớp, bởi hai reviewer mới, trên mã ở `56d257c`, trước cổng Codex vòng 2. Lượt quét chạy đua — `gates/sweep-races.md` — kết thúc bằng dòng `SWEEP: P0/P1 FOUND`: một P1 mới, một P2, năm P3. Lượt quét oracle và khe che — `gates/sweep-oracles-masking.md` — kết thúc bằng dòng `SWEEP: NO P0/P1 FOUND`: ba P2, đều là phần dư đã viết, và ba P3. Đã làm: P1 được sửa thành Task F5, và cùng khoá đó đóng P2 của lượt chạy đua và một P3 của lượt oracle; ba P2 của lượt oracle lúc đó ở lại là phần dư — R3 viết lại đúng cỡ (về sau cổng Codex vòng 2 nêu đúng mục này và Task G1 đóng nó); R33 và R34; R35 kèm điều kiện 25; các P3 còn lại thành ghi chú hoặc phần dư (R15 đính chính, R38, R39). Từng finding áp ở đâu: bảng ở kế hoạch, mục 08.8 (`docs/plans/oq-45-46-ai-drafts.md:1904`).
- Hai ghế xem lại mã của Task F5 (`05a6da0`): cả hai «READY FOR GATE», không P0, không P1. CSDL — `gates/review-codex-fix1-F5-database.md`: một P2 (Q1), bốn P3 (Q2…Q5). Bảo mật — `gates/review-codex-fix1-F5-security.md`: một P2 (S-F5-1, cùng điều với Q1), một P3 (S-F5-2). Q1 và S-F5-1: chữ của R34 và điều kiện 18 được sửa (login web giữ được khoá dòng dự án). Q3: một câu ở kế hoạch. S-F5-2 và phần về lỗi thô của Q5: đã nằm trong điều kiện 18. **Q2 và Q4 không làm** (phán quyết 41).

**Tầng 2 — cổng Codex, vòng 2** (gốc `4f12a3c`, đầu `d41cb4a`; mã đổi lần cuối ở `05a6da0`): `VERDICT: CHANGES_REQUIRED` — một P0, ở `src/server/suggestions.ts:106`. Chữ của finding, chép nguyên: «Nháp đã bị che vẫn trả `valueHash`, cho phép suy ra nội dung có ít khả năng; phép so hash ở dòng 278 còn tạo một kênh thử trực tuyến.» Căn cứ cổng nêu: OQ-45 điểm 2 (b). Kết quả: `codex-round-2.md`; bối cảnh đã gửi: `codex-context-round-2.md`. Finding này chính là phần dư R3 (phán quyết 34).

**Vòng sửa 2** — vòng sửa cuối được phép, vì brief cho tối đa hai vòng sửa ở cổng — gồm hai task:

- **Task G1** (`ff24901`): đỏ trên mã cũ 7 `AssertionError` (H1–H7), không timeout; PGlite 4 tệp, 196 ca đạt, 1 bỏ qua; PostgreSQL 16 5 tệp, 206 ca đạt, 0 bỏ qua; typecheck mã thoát 0 (`codex-fix2-G1-red.txt`, `codex-fix2-G1-green.txt`, `codex-fix2-G1-native-verbose.txt`).
- **Lượt xem lại bảo mật của Task G1** — `gates/review-codex-fix2-G1-security.md`: «READY FOR GATE». Finding về hash của cổng vòng 2 được xác nhận là đã đóng, ngoại tuyến lẫn trực tuyến. P0 0, P1 0, P2 1, P3 4. P2-1 là R15: câu `DRAFT_HELD` của lệnh xác nhận trên một nháp bị che nêu mọi mã của cổng. P3-1: người ghi được tài liệu làm đổi được `SOURCE_OUT_OF_CONTEXT` và các mã `SUBJECT_*`. P3-2: một lệnh từ chối tới khi nháp bị che và được ghi sau khi lớp che gỡ thì không mang hash (chấp nhận theo C3). P3-3: H7 thiếu nhánh hash sai. P3-4: lệnh thiếu hash nhận câu «Nháp đã đổi…», gây hiểu lầm vì một nháp không bao giờ đổi (chỉ ghi lại; mã và trạng thái đúng).
- **Task G2** đóng P2-1 và thêm nhánh của P3-3: `d9b0974` — đỏ 3 `AssertionError` rồi xanh trên PGlite (197 đạt / 1 bỏ qua) và PostgreSQL 16 (207 đạt / 0 bỏ qua). Lượt xem lại bảo mật `gates/review-codex-fix2-G2-security.md`: «READY FOR GATE»; P0 0, P1 0, P2 0, P3 2 — khi không dựng được ngữ cảnh, câu giữ có thể thiếu `SCHEMA_INVALID` so với `list` (một tập con; chỉ ghi lại), và tên ca V2 (đã sửa ở `9b0f83f`, chỉ đổi tên ca, do phiên chính sửa).

**Soát biên nhận:** `liberico-reality-checker` — `gates/reality-check-receipt.md`: `VERDICT: READY`. Soát 55 khẳng định với log, mã và lịch sử git: 49 đúng; bảy chỗ phải sửa chữ (sáu ở biên nhận, một ở roadmap; hai mức P2, năm mức P3), không chỗ nào đổi mức giao hay khẳng định về mã — cả bảy đã được áp trước khi biên nhận ghi «đạt». Điều nó không chứng minh được và biên nhận không khẳng định hơn: log không mang mã commit của lượt chạy; sau `83d5e2f` không log nào ghi cây làm việc sạch; việc xoá CSDL thử (cần Docker) nó không kiểm được. Nó chạy lại `npm run typecheck` ở `b8c70df`: mã thoát 0.

**Tầng 2 — cổng Codex, vòng 3** (lượt chạy cuối của cổng; nếu còn một P0 hoặc P1 thì công việc dừng và được báo là chưa hội tụ): `VERDICT: PASS` — «Không có finding.» Gốc `4f12a3c`, đầu `b29b929`; kết quả `codex-round-3.md`, bối cảnh đã gửi `codex-context-round-3.md`; bản ghi đầy đủ của Codex không được commit. Cổng là review tĩnh ở chế độ chỉ đọc: nó không chạy test; số liệu test là của phiên này.

## Ghi chú triển khai (đầu vào cho điểm dừng của Chairman; chưa áp ở đâu)

Các ghi chú triển khai và các câu catalog chỉ đọc để chạy sau khi áp: mục 5 của `gates/review-codex-fix1-F1b-database.md` — mười tám ghi chú và sáu câu A–F, viết cho khoá dòng. **Chúng được viết cho ba hàm và ba trigger: hàm thứ tư và trigger thứ tư của Task F5 không nằm trong các câu đó.** Lượt xem lại CSDL của Task F5 viết lại câu A và câu B cho thân có bốn hàm (mục E của `gates/review-codex-fix1-F5-database.md`); hai câu đó **chưa chạy**. Log chạy: `deploy-queries-pg16.txt` — cả sáu câu chạy được trên PostgreSQL 16.15, trên CSDL thử của PR, ở thân của `56d257c`, tức **trước** Task F5; ba giá trị băm thân hàm trùng giá trị reviewer tính từ tệp; câu F không trả dòng nào. Bản cũ ở mục 4.1 và 4.2 của `gates/review-codex-fix1-F1-database.md` tả khoá tư vấn và không còn dùng. Tóm tắt các điều chắc chắn:

- **Thứ tự:** sau 021; migration trước, mã sau. Áp bằng login migration là **superuser**, như 019–021: ba hàm definer cần chủ hàm ghi được `public.projects` và không bị RLS lọc; chủ hàm không đạt thì câu khoá lỗi, tức đóng. `scripts/migrate.ts` áp mọi migration đang chờ trong một lượt: lần migrate kế tiếp ở bất kỳ đâu cũng áp luôn 022.
- **CSDL đã ghi `'022'` với một thân trước đó** (R37) phải được lùi bằng tệp lùi **hiện hành** rồi áp lại: trình áp và harness bỏ qua bản đã ghi, nên không tự sửa. Hôm nay chỉ CSDL thử của PR ở trong trường hợp đó.
- **Khoá lúc áp:** lần áp đầu giữ `SHARE ROW EXCLUSIVE` trên `intelligence.ai_drafts`, `public.project_domain_mappings` và — sau Task F5 — `public.draft_decisions` tới `COMMIT`; áp lại và lùi giữ `ACCESS EXCLUSIVE` trên các bảng đó, chặn cả lệnh đọc ánh xạ. `lock_timeout` 5 giây. Không viết lại bảng, không dựng chỉ mục. (Mức khoá là suy luận của reviewer CSDL, chưa đo.)
- **Lùi được**, không biến đổi dữ liệu; thứ tự lùi 022 rồi 021 nay là bắt buộc về kỹ thuật: lùi 021 thất bại thành tiếng nếu hàm của 022 còn. Lùi 022 là gỡ mã thực thi điểm 3 (b) và mở lại CX1, CX4 và khe phía xác nhận mà Task F5 đóng: không chạy trên CSDL thật khi chưa có lời Chairman (`AGENTS.md:9`).
- **Phục hồi data-only** chạy với trigger bật, một giao dịch, không `-j`. Dòng dự án phải được nạp trước nháp và ánh xạ (thứ tự đã đo là vậy): guard từ chối `23503` một dòng mà nó không thấy dòng dự án. Theo phép đo 2, nháp được nạp trước ánh xạ nên guard cho mọi dòng nháp qua: guard không phải lưới cho dữ liệu được phục hồi. Phục hồi song song có thể kết thúc bằng `55P03` hoặc `40P01`. Đo lại trên bản dump của CSDL thật trước khi dựa vào thứ tự này.
- **Lệnh ghi ánh xạ có thể thất bại `55P03`:** nghĩa là một giao dịch chèn nháp, ghi ánh xạ hoặc xác nhận của dự án đó đang mở. Trần 5 giây là cho từng lần lấy khoá: tính hết giờ theo 10 giây, không theo 5. Khoá dòng không hiện trong `pg_locks` khi không ai chờ; khi có lệnh đang chờ, hỏi ai chặn nó bằng câu `pg_blocking_pids` ở mục 7.4 của `gates/review-codex-fix1-F1-database.md`. Quy trình xác nhận một dự án là `IBS_HI` phải ghi bước này.
- **Mức cô lập:** login của pipeline và login runtime phải giữ `default_transaction_isolation = read committed`. Login pipeline khác đi thì mọi lệnh ghi nháp bị `LTZ02`.
- **Log máy chủ:** mỗi lần guard từ chối là một dòng `ERROR` — `LTZ01`, `LTZ02`, `42501` do trigger phạm vi ném (có `HINT`), `23503` do guard ném (có `HINT`), `55P03` có `CONTEXT` nêu tên hàm, có thể có `40P01`. Theo mặc định PostgreSQL ghi chữ của câu lệnh bị lỗi; tham số chỉ vào log khi `log_parameter_max_length_on_error` khác 0 hoặc `log_statement` / `log_min_duration_statement` bật.

## Khoảng trống phải biết

Đầy đủ ở kế hoạch: R1–R19 (mục B6, `docs/plans/oq-45-46-ai-drafts.md:217`), R20–R29 (`:791-800`), R30–R32 (`:833-835`), R33–R37 (`:1338-1348`; R34 hiện hành ở `:1431`), R38, R39 (`:1865`); R15 theo chữ hiện hành ở kế hoạch, 09.7, `:2152`. **R3 không còn trong danh sách này:** cổng Codex vòng 2 nêu nó ở mức P0 và Task G1 đóng nó (cùng mục đó). Ở kế hoạch, R4 và R16 mang ghi chú rằng vòng sửa đã thu hẹp chúng; R5 đã được đóng bằng khoá dòng ở phía ghi nháp và bằng Task F5 ở phía xác nhận.

**Trước hết, nói lại hai điều của mục «Đã làm»:**

- **Sau PR này không nháp ứng viên nào xác nhận được.** Mọi lệnh xác nhận một nháp ứng viên bị giữ với `SUBJECT_ORDER_UNVERIFIED` cho tới khi điểm 3 của OQ-53 được quyết; từ chối vẫn làm được; việc đọc không đổi vì mã này.
- **Mọi nháp của một dự án bị che và bị giữ (`PROJECT_TEXT_HIDDEN`) chừng nào dự án còn chữ đã lưu mà nay không được hiện** — một giữ chỗ của OQ-55, rộng hơn phương án (e).

**Các phần dư của vòng sửa, từng mục** (R33–R39, DB-8, R15, và hai mục sau Task G1, G2; danh sách đầy đủ ở kế hoạch):

- **R33 — bit `IBS_HI` nay rộng đúng bằng quyền ghi mà role tự khai.** Điều CX1 đóng là «trigger trả lời trước RLS». Với người giữ role `libetech_ai` có ý xấu, thứ lấy được **không giảm**: role tự khai phạm vi (khoảng trống 7 của lát 3, có từ trước PR), nên một lệnh `set_config` là có lại bit của bất kỳ dự án nào của bất kỳ tenant nào, và giao dịch lùi thì không để lại dòng. Đóng hẳn thuộc thiết kế login AI. Điều kiện của trigger là bản chép tay của policy: trigger phải chặt bằng **giao** của `ai_insert` và `ai_select` (một lệnh chèn có `RETURNING` hoặc `ON CONFLICT` còn bị xét theo `ai_select`). Policy siết thêm mà trigger không đổi thì kênh của CX1 mở lại, im lặng; ca G25 ghim cả hai policy sau Task F1b.
- **R34 (khoá dòng) — ai hoãn được lệnh ghi ánh xạ của một dự án, tức hoãn việc dự án đó thành `IBS_HI`.** Chỉ còn: một giao dịch đã đưa một dòng nháp thật của dự án đó qua cả hai trigger và còn mở (role AI trong phạm vi nó khai, hoặc login vận hành); một giao dịch ghi ánh xạ khác của chính dự án đó; một role ghi được `public.projects` — không role runtime nào. Mỗi lần thử thất bại `55P03` sau 5 giây, thành tiếng; một giao dịch để mở chỉ bị chặn bởi `idle_in_transaction_session_timeout` của login đó, một cấu hình chưa có (điều kiện 18); không có dạng mức phiên. «Hoãn» không gỡ hẳn được: mọi cách đóng CX4 chặt đều buộc lệnh ghi ánh xạ chờ lệnh chèn nháp đang chạy. Cái giá mới: **Đính chính sau hai lượt xem lại Task F5 (mỗi ghế một P2 về chữ: Q1, S-F5-1):** từ Task F5, **login web (role runtime) cũng giữ được khoá dòng dự án**, qua trigger của bảng quyết định: một giao dịch chèn một dòng `confirmed` cho một nháp có thật, có nguồn, giữ khoá tới khi nó kết thúc — kể cả khi lệnh chèn sau cùng thất bại; trong một phiên SQL thô dưới login đó, phạm vi là thứ phiên tự đặt. Trong lúc đó lệnh ghi ánh xạ, lệnh chèn nháp và lệnh xác nhận khác của dự án nhận `55P03` sau 5 giây. Hai login dịch vụ còn lại (`libetech_auth`, `libetech_intake_svc`) không làm được. Hôm nay không khai thác được (Z4 tắt, không có nháp); điều kiện 18 thêm: login web có `idle_in_transaction_session_timeout` trước khi bật Z4.
  1. các lệnh chèn nháp của một dự án chạy lần lượt chừng nào giao dịch của chúng còn mở; một giao dịch để mở trả `55P03` sau 5 giây cho lệnh chèn nháp kế tiếp của dự án đó;
  2. một giao dịch chèn nháp còn mở làm `UPDATE` hoặc `DELETE` dòng dự án đó phải chờ, và không trần nào của 022 phủ lệnh bị chờ; hôm nay không mã nào và không role không-superuser nào ghi `projects`;
  3. giao dịch của role AI đánh dấu một khoá lên một dòng Z1 qua hàm definer — không phải một lần ghi dữ liệu: không cột nào đổi; khoá ngoại của bảng nháp đã làm việc đó ở mức `FOR KEY SHARE` cho mỗi lệnh chèn, điều mới chỉ là mức khoá;
  4. trên PGlite không quan sát được mức khoá: bằng chứng hành vi chỉ có ở PostgreSQL 16;
  5. khó nhìn hơn khi vận hành: chỉ khi có lệnh đang chờ mới hỏi được ai giữ khoá;
  6. sau Task F5, **lệnh xác nhận của một dự án cũng chờ** một giao dịch chèn nháp hoặc ghi ánh xạ còn mở của dự án đó — `55P03` ở trần, đi thô ra khỏi `decide`; người giữ role AI với một giao dịch chèn nháp để mở vì vậy hoãn được cả các lệnh xác nhận của dự án đó;
  7. trần 5 giây là cho từng lần lấy khoá: một lệnh đứng sau một lệnh chờ khác có thể chờ tới gần 10 giây trước khi nhận `55P03` (suy luận của reviewer, chưa đo);
  8. người giữ role AI khai một cặp (tenant, dự án) bất kỳ, thử một lệnh chèn nháp rồi lùi, thì biết qua việc phải chờ hay không rằng một giao dịch của dự án ấy đang mở — xuyên tenant, không để lại dòng nào; không lộ nhãn.
- **DB-8 — hai hàm `SECURITY DEFINER` gắn vào trigger của hai bảng Z1 (`public.project_domain_mappings`, `public.draft_decisions`) nằm trong schema `intelligence`;** 022 có ba hàm definer tất cả. Ghi nhận, không đổi trong PR này. Hệ quả: lùi 021 phụ thuộc cứng vào việc lùi 022 trước; một bản dump chỉ schema `public` không dựng lại được trigger.
- **R35 — giữ chỗ theo dự án của OQ-55.** Gỡ cờ hiện chữ của một nhóm, hoặc dựng dịch vụ với danh sách nhóm rỗng (mặc định), là che và giữ **mọi nháp** của dự án, kể cả nháp không chép chữ nào. Câu đọc quét mọi bản lưu chữ của dự án, một lần cho mỗi lần đọc danh sách của người có quyền và một lần cho mỗi lệnh xác nhận: chưa đo trên dữ liệu lớn. Không phép kiểm nào thấy chữ của tin thuộc **dự án khác**; chữ của tin đang được hiện không bị che. Mã lý do tự nó là một thông tin: nó cho người có quyền quyết định nháp biết một bit về cấu hình của chính dự án của họ.
- **R36 — đường xác nhận nháp ứng viên của lát 3 tạm đóng.** Các mã `SUBJECT_CHANGED`, `SUBJECT_BASELINE_MISSING`, `SUBJECT_EDIT_UNVERIFIED`, `THREAD_TEXT_HIDDEN`, `PROJECT_TEXT_HIDDEN` của nháp ứng viên vẫn được tính và vẫn có ca, nhưng ở lệnh xác nhận luôn đi kèm `SUBJECT_ORDER_UNVERIFIED`. Câu `DRAFT_HELD` của một nháp ứng viên vì vậy luôn có ít nhất một mã, kể cả với nháp không có lỗi nào: mã này là giữ chỗ của hệ thống, không phải lỗi của nháp. Ba tính chất không còn ca nào ghim riêng cho nháp ứng viên — lệnh xác nhận giữ khoá của nó, phát lại một lệnh xác nhận dưới lớp che, phát lại sau khi luồng đổi — và chỉ còn được ghim trên nháp tài liệu. Khe của R6 và R27 vẫn đúng như mô tả về phép kiểm; không lệnh xác nhận nào đi qua nó.
- **R37 — bốn thân cũ của 022:** thân không có `LTZ02`, thân có `LTZ02` (ở `83d5e2f`), thân dùng khoá tư vấn (`cb1d7dc`), thân dùng khoá dòng với ba hàm (`56d257c`). Mọi CSDL đã ghi `'022'` với một thân cũ phải được lùi bằng tệp lùi hiện hành rồi áp lại.
- **R15 — đóng với các mã tả nội dung (Task G2); còn lại là chính các mã che.** Trên một nháp bị che, câu `DRAFT_HELD` của lệnh xác nhận từng nêu toàn bộ tập mã của cổng (`SOURCE_REQUIRED`, `UNSOURCED_CLAIM`, `TOOL_NOT_ALLOWED`, `NOT_APPROVED_REVISION`, `MANIFEST_MISMATCH`, `VALUE_HASH_MISMATCH` và các mã `SUBJECT_*`) — một nắm bit cố định về nội dung đang bị che. Sau Task G2 nó chỉ nêu các mã che — những mã mà một lần đọc cũng cho thấy — cộng `SUBJECT_ORDER_UNVERIFIED` với nháp ứng viên. Điều còn lại: các mã che tự chúng nói một ít về nháp (ví dụ `SOURCE_OUT_OF_CONTEXT`: nháp nêu một mã ngoài ngữ cảnh); tổ hợp của chúng là thứ bên ghi tác động được; và người ghi được tài liệu làm đổi được `SOURCE_OUT_OF_CONTEXT` bằng cách đổi tài liệu nào nằm trong cửa sổ 50 tài liệu của ngữ cảnh, rồi suy ra nháp bị che nêu mã nào. Không lộ chữ, không lộ mã nào ngoài những gì người đó đã thấy trong dự án. Cái giá của Task G2: người quyết định một nháp bị che thấy ít mã chẩn đoán hơn cho tới khi nội dung được hiện lại — một nháp vừa đã cũ vừa bị che chỉ báo mã che.
- **R38** — `list` đọc ở nhiều thời điểm: một câu trả lời có thể trộn dòng hiện nội dung với dòng bị che, và tổng số lệch danh sách; không hiện được thứ đã bị che lúc lời gọi bắt đầu. **R39** — một bản tin lưu chữ, của một nhóm mà dịch vụ gợi ý không bật cờ, có thể commit sau phép kiểm theo dự án của `decide`: lệnh xác nhận khi đó commit trong lúc dự án có chữ không được hiện; chữ đó mới hơn nháp nên không thể nằm trong nháp.
- **Sau Task G1 — từ chối không cần đọc, và hợp đồng của `decide` đổi.** Người có quyền quyết định từ chối được một nháp mà mình không đọc được nội dung, nay không cần cả hash: dòng quyết định ghi ai đã từ chối, không ghi rằng người đó đã đọc. `valueHash` của lệnh là tuỳ chọn và dòng bị che không mang hash: bên gọi nào viết theo hợp đồng của lát 3 phải đổi; hôm nay không tuyến nào gọi `decide`. Mỗi `decide` dựng thêm một lần ngữ cảnh trong thân khoá lệnh — khoá nháp, khoá dòng tài liệu và khoá lệnh được giữ lâu thêm đúng bằng lần dựng đó; chưa đo. Việc bỏ phép so hash cho người mà nháp bị che dựa vào bất biến «bị che thì bị giữ»; phép so thứ hai, sau bước giữ, là lưới cho lệnh xác nhận. Hai mục chỉ ghi lại của lượt xem lại Task G1: một lệnh từ chối tới khi nháp đang bị che và được ghi sau khi lớp che gỡ thì không mang hash, cho một nháp mà lúc ghi người đó đã được xem (P3-2; chấp nhận theo C3); và người được cho thấy nội dung mà không gửi hash nhận câu «Nháp đã đổi. Đọc bản mới trước khi quyết định.», gây hiểu lầm vì một nháp không bao giờ đổi — mã `REVISION_CONFLICT` và trạng thái 409 thì đúng (P3-4).
- **Sau Task G2 — hằng `MASK_REASONS` được liệt kê bằng tay** (do `planner` nêu; lượt xem lại Task G2 đọc hằng này và không nêu điểm này; chưa có phán quyết). Kiểu chỉ kiểm rằng mỗi tên trong hằng là một mã che, không kiểm rằng hằng đủ: thêm một mã che mới mà quên hằng này thì, im lặng, một nháp chỉ bị giữ bởi mã mới lại nêu mọi mã của cổng. Hằng không được xuất, nên không ca nào so được nó với danh sách của mình.

**Đọc nội dung**

1. Cổng đọc xét các **mã nháp khai**, không xét nội dung (R1). Hai giữ chỗ của OQ-55 che thêm theo luồng và theo dự án; chữ của tin thuộc dự án khác mà một nháp chép lại thì không phép kiểm nào thấy (R35).
2. Vai đọc không có quyền xác nhận vẫn thấy dòng nháp: mã dòng, kỹ năng, thời điểm tạo tới mili giây, quyết định đã ghi, số dòng và thứ tự (C8, R15, R24). Phần bên ghi còn chọn được với họ: kỹ năng, một bit «`manifestHash` có khớp không», thời điểm chèn.
3. Sau Task G1, không hash của nội dung nào được trả dưới lớp che, và `decide` không so hash cho người mà nháp bị che (R3 đã đóng). Sau Task G2, thứ còn tới người có quyền quyết định về một nháp bị che là: các mã che — trong `maskReasons`, và trong câu giữ khi họ thử xác nhận; giữ chỗ của điểm 3 OQ-53 với nháp ứng viên; siêu dữ liệu của dòng; quyết định đã ghi; số dòng và thứ tự (R15). `modelVersion` được trả cùng nội dung và không qua cổng nào (R17).
4. Quyền xét theo vai trong phiên, không đọc lại từ CSDL danh tính (R7); đường dựng `Principal` từ phiên chưa được lượt nào soát.
5. Dịch vụ phải được dựng với danh sách nhóm hiện chữ hiện hành; hôm nay danh sách là bản chụp lúc dựng (R9).
6. Người không có quyền gọi `decide` vẫn lấy khoá nháp, kéo `value` vào tiến trình Node và giữ chỗ khoá lệnh trước khi bị từ chối; không lộ gì ra câu trả lời (R25). Với dự án chỉ con trỏ, `value` vẫn vào tiến trình Node rồi mới bị bỏ (R29, OQ-54).

**Ghi nháp và guard**

7. Nội dung nháp lưu trước khi dự án thành `IBS_HI` nằm lại trong bảng (R2, OQ-54). Dự án chưa ánh xạ không bị từ chối (OQ-56).
8. Guard có thể vắng mà dịch vụ không biết: lùi 022, tắt một trong bốn trigger, `session_replication_role = replica`, `pg_restore --disable-triggers`, hoặc một CSDL mang thân cũ (R19, R37). Chỉ trigger phạm vi bị tắt thì CX1 mở lại; chỉ trigger của bảng ánh xạ bị tắt thì CX4 mở lại; chỉ trigger của bảng quyết định bị tắt thì một lệnh xác nhận lại commit được cho dự án vừa thành `IBS_HI`. Cả các đường đó cần superuser hoặc chủ bảng.
9. Lỗi CSDL thô đi qua `submitDraft` — mọi mã trừ `LTZ01`, kể cả `LTZ02`, `55P03`, `40P01`, `23503`; ở bản demo PGlite đối tượng lỗi mang cả tham số, tức nội dung nháp (R31). Khoảng trống 41 của lát 3 (khoá khử trùng đã dùng ở dự án khác) không đổi (R10).
10. Đường nhận tin đọc cùng ánh xạ để chọn chế độ lưu chữ mà không lấy khoá (`src/server/intake.ts:70`; ngoài diff của PR): chữ lưu như vậy bị ẩn lúc đọc.
11. Trigger của bảng ánh xạ chạy trước mọi `WITH CHECK` và với quyền definer: hôm nay chỉ login vận hành ghi ánh xạ; xem điều kiện 24.

**Nháp đã cũ**

12. Mốc là thứ nháp **nêu**, không phải thứ nháp đã đọc (C6). Nháp phải nêu bản mới nhất của tài liệu mới xác nhận được; xác nhận một nháp tài liệu làm mọi nháp đang chờ khác của cùng tài liệu chỉ còn từ chối được (R30). Nháp `release_librarian` không xác nhận được khi tài liệu có bản trình mới hơn bản chuẩn (C7), và luôn bị giữ khi tài liệu có bản nhưng chưa có bản chuẩn (R28).
13. Với nháp ứng viên, các phần dư về mốc của luồng tin (R12, R26, R6, R27) vẫn đúng như mô tả về phép kiểm, nhưng không quyết định gì chừng nào giữ chỗ của điểm 3 còn: không nháp ứng viên nào xác nhận được.
14. `list` không báo nháp đã cũ và không báo giữ chỗ của điểm 3; người xác nhận biết khi lệnh trả `DRAFT_HELD` (R13). Sau Task G2, với một nháp đang bị che, cả `DRAFT_HELD` cũng không báo nháp đã cũ: người xác nhận chỉ biết sau khi lớp che được gỡ.
15. Cổng xét nháp có hai bản trong mã (`present` và bước giữ của `decide`), giữ khớp bằng tay; ca P3 đi qua mọi mã che ghim chiều «bị che thì bị giữ». Sau Task G1, `decide` còn gọi chính `present` để biết nháp có bị che với người gọi không; việc bỏ phép so hash cho người đó dựa vào bất biến trên. Sau Task G2, câu giữ của một nháp bị che chỉ được nêu mã che mà `list` cũng nêu: ca H8 ghim hai tập bằng nhau ở ba cách dựng. Khi không dựng được ngữ cảnh, câu giữ có thể thiếu `SCHEMA_INVALID` mà `list` hiện cho cùng dòng — một tập con, không lộ gì, chỉ lệch chẩn đoán (P3-1 của lượt xem lại Task G2; chỉ ghi lại).

**Kiểm và bằng chứng**

16. Repo không có CI và không có lint: mọi dòng Quality Gate ở đây là `manual` hoặc `advisory`.
17. Các ca cần hai kết nối chỉ chạy trên PostgreSQL thật và bị bỏ qua trên PGlite; mức khoá dòng cũng chỉ quan sát được ở đó.
18. Trong `decide`, đường «nháp ứng viên đi qua bước giữ» là mã không tới được chừng nào giữ chỗ của điểm 3 còn (R36): số nhánh được phủ của `src/server/suggestions.ts` có thể giảm. Con số nằm ở ô phủ «Sau hai vòng sửa» của bảng «Bằng chứng kiểm».
19. Ba chạm nhỏ ở `src` của commit `bcdb360`: nhánh «không có giá trị đã qua lược đồ» của `toView` không tới được từ ngoài nên không ca nào ghim.
20. Chưa có `EXPLAIN` nào cho các câu đọc luồng, câu đọc theo dự án và câu đọc bản tài liệu trên dữ liệu lớn.

## Trước khi thêm tuyến đọc nháp hoặc bật Z4

Ngoài bốn điều kiện ở ghi chú 3 của khối quyết định (`docs/OPEN-QUESTIONS.md:865`): hai mươi lăm điều kiện ở kế hoạch — 1–6 (`docs/plans/oq-45-46-ai-drafts.md:751`), 7–13 (`:802`), 14–17 (`:837`), 18–22 (`:1350`; điều kiện 18 hiện hành ở `:1443`), 23–24 (`:1448`), 25 (`:1877`).

Tóm tắt 1–17: OQ-53 (ba điểm), OQ-54, OQ-55, OQ-56 có quyết định · pipeline từ chối khởi động khi guard vắng, bị tắt hoặc mang thân cũ · tuyến gọi `submitDraft` bọc mọi lỗi CSDL thô · danh sách nhóm hiện chữ hiện hành cho từng yêu cầu · khoảng trống 41 có quyết định · soát đường dựng `Principal` từ phiên · câu catalog sau khi áp 022 · mức cô lập của login pipeline và login runtime · bốn thiết lập log của cụm · đo lại thứ tự nạp trên bản dump thật · giới hạn tần suất `decide`, không log thân câu trả lời · hợp đồng và prompt của pipeline nêu mọi tin của luồng và bản mới nhất của tài liệu · `EXPLAIN` cho các câu đọc mới · `decide` đọc dòng nháp bằng câu lệnh siêu dữ liệu khi người gọi không có quyền.

Tám điều kiện của vòng sửa, nêu đủ:

- **18.** Login của pipeline có `idle_in_transaction_session_timeout`. Pipeline coi `55P03` từ `submitDraft` là thử lại được, và giữ giao dịch chèn nháp ngắn — không mở giao dịch qua một lời gọi mô hình hay một lần chờ mạng, vì nháp của một dự án nay được ghi lần lượt. Pipeline ghi nháp của một dự án mỗi giao dịch (hoặc theo một thứ tự dự án cố định) và coi `40P01` là thử lại được: hai giao dịch chèn nháp cho cùng hai dự án theo thứ tự ngược nhau nay khoá chết. Tuyến đầu tiên gọi `submitDraft`, và tuyến đầu tiên gọi `decide`, đổi `55P03` và `40P01` thành một lỗi thử-lại-được của dịch vụ, không kèm `CONTEXT` của CSDL. Người ghi ánh xạ biết `55P03` nghĩa là một giao dịch chèn nháp, ghi ánh xạ hoặc xác nhận của dự án đó đang mở. **Thêm sau Task F5:** login web (role runtime) cũng có `idle_in_transaction_session_timeout`, có ca kiểm; tuyến đầu tiên gọi `decide` đổi `55P03`, `40P01`, `LTZ02`, `23503` thành lỗi thử-lại-được hoặc lỗi của dịch vụ, không kèm `CONTEXT` của CSDL.
- **19.** Một lần `EXPLAIN` trên PostgreSQL 16 cho `projectHasHiddenText` trên một dự án nhiều tin; thêm chỉ mục nếu cần.
- **20.** Câu catalog sau khi áp đọc thêm: bốn trigger của 022 có mặt, đang bật, đúng kiểu; tên trigger phạm vi đứng trước tên guard và không trigger `BEFORE INSERT` nào khác của bảng nháp sắp trước nó; trên bảng quyết định, `draft_decisions_guard` đứng trước `draft_decisions_pointer_only_guard`; thân, `prosecdef` và `proconfig` của bốn hàm khớp tệp (sáu câu đã chạy mới phủ ba hàm đầu); trên `intelligence.ai_drafts` có đúng một policy áp cho `INSERT` (`ai_insert`) và đúng một policy `SELECT` áp cho `libetech_ai` (`ai_select`), không policy `RESTRICTIVE`, cả hai biểu thức khớp chuỗi ghim ở ca G25.
- **21.** Điểm 3 của OQ-53 có quyết định. Khi đó `SUBJECT_ORDER_UNVERIFIED` được gỡ hoặc thay theo quyết định, và mười hai ca E1–E12 được đưa về kỳ vọng mà quyết định đó kéo theo.
- **22.** Thiết kế login AI: dưới đúng login đó, `row_security_active` trên `intelligence.ai_drafts` phải trả đúng — login không là superuser, không có `BYPASSRLS`, không sở hữu bảng. Nếu trả sai, trigger phạm vi tự bỏ qua và kênh của CX1 mở lại cho mọi dự án.
- **23.** Lát nào thêm một đường ghi lên `public.projects`, hoặc cấp `UPDATE` trên bảng đó cho một role runtime, phải đặt `lock_timeout` cho câu lệnh đó và nêu migration 022 trong kế hoạch của nó: một giao dịch chèn nháp còn mở làm lệnh đó chờ, và một role có `UPDATE` trên `projects` tự lấy được khoá dòng.
- **24.** Trước khi cấp `INSERT` trên `public.project_domain_mappings` cho một role chịu RLS: trigger khoá chạy trước `WITH CHECK` và với quyền definer, nên lệnh của role đó sẽ khoá hoặc chờ dòng dự án của tenant khác, và nhận `23503` hay câu của RLS tuỳ cặp (tenant, dự án) có thật hay không, trước khi RLS xét dòng. Khi đó trigger khoá phải soi phạm vi trước, như trigger phạm vi của bảng nháp.
- **25.** Mỗi lời gọi mô hình chỉ nhận ngữ cảnh của đúng một dự án, dựng bởi dịch vụ; và mỗi nháp được ràng với đúng ngữ cảnh mà dịch vụ đã cấp — ví dụ `submitDraft` chỉ nhận nháp có `inputHash` khớp hash của ngữ cảnh đó. Không phép kiểm phía đọc nào bắt được chữ tự do của dự án khác chép vào một nháp.

## Điểm dừng — không làm, chờ Chairman

Merge PR (phiên điều phối kiểm lại độc lập; chỉ merge khi Chairman nói) · triển khai d1-ai1 · áp 019–022 lên dữ liệu thật · tạo login hay khoá cho `libetech_ai` · nối mô hình · thêm tuyến đọc nháp · bật Z4 · sửa `AGENTS.md`.

## Cần Chairman quyết hoặc xác nhận

1. **OQ-53** — ba điểm. Điểm 1 (bản sửa của tin) và điểm 2 (nháp không nêu mốc) đang có giữ chỗ. **Điểm 3 nay có một giữ chỗ chặn mọi lệnh xác nhận nháp ứng viên**: chừng nào điểm này chưa được quyết, đường xác nhận nháp ứng viên của lát 3 đóng.
2. **OQ-54** — nội dung nháp lưu trước khi dự án thành `IBS_HI`.
3. **OQ-55** — nháp mang chữ của tin mà không nêu mã tin. Hai giữ chỗ đang che và giữ theo luồng và theo dự án; giữ chỗ theo dự án rộng hơn chữ của phương án (e), và mục OQ-55 nêu rằng không phương án nào trong (a)–(e) nói tới nháp ứng viên chép chữ của luồng khác cùng dự án.
4. **OQ-56** — nháp của dự án chưa có dòng ánh xạ miền.
5. **Cách hiểu C1–C9**; trong đó C8 (người không có quyền vẫn thấy dòng nháp) không phải hướng chặt nhất. **Ba phần mở rộng sau cổng Codex vòng 2, cũng chờ xác nhận:** C9 — dưới mọi lớp che không trả cả hash của nội dung; C9 — trên một nháp bị che, «lý do giữ» mà câu giữ của lệnh xác nhận nêu là các mã che, cộng giữ chỗ của điểm 3 OQ-53 (cách hiểu khác, rộng hơn: nêu mọi mã của một lần giữ, như trước Task G2); C3 — một nháp bị che được từ chối không cần hash. Cách hiểu khác, chặt hơn, cho cả ba, không được chọn ở đây: một nháp bị che không quyết định được gì cả — không xác nhận, không từ chối — cho tới khi nội dung của nó được hiện lại cho người quyết định; khi đó nháp của một dự án vừa thành `IBS_HI`, hoặc của một dự án đang có chữ bị ẩn, nằm chờ trong danh sách và không ai gỡ được.
6. Việc bật Z4 vẫn cần đủ các điều kiện ở mục trên và lời Chairman cho chính việc đó.

## Ngoài phạm vi (có từ trước hoặc không thuộc PR; không sửa)

- `tests/review-delegations.test.ts`, ca «F-5 a reader receives other people's rows ordered by delegate id, not by creation; a coordinator keeps newest first» (lát 3, không đổi kể từ `007cded`): đỏ một lần trong một lượt cả bộ trên PGlite ở `f36e947` (`final-pglite-run1-one-flake.txt`). Ca tạo năm dòng liên tiếp rồi chờ thứ tự theo `created_at`; PGlite có độ phân giải mili giây nên hai dòng trùng thời điểm đổi chỗ. Chạy riêng tệp ba lần đều 47/47 đạt; lượt cả bộ chạy lại xanh. Nên sửa ca đó trong một PR riêng.
- Import `MAX_OUTPUT_BYTES` thừa trong `src/server/suggestions.ts` (có từ gốc).
- Repo không có CI và không có lint (có từ gốc).
- `.gitignore` không phủ tên bản sao iCloud dạng `<tên> 2.<đuôi>`.
- Ở gốc đã có sẵn các tệp được theo dõi chứa đường dẫn thư mục nhà của máy (ví dụ `AGENTS.md:3`); PR này không thêm tệp nào như vậy. Reviewer bảo mật của Task 1–2 ghi nhận lịch sử git của nhánh khác có một tệp tên `.env.example`; không được đọc ở lượt nào của PR này.
- `docs/IMPLEMENTATION-ROADMAP.md` từng ghi «brief lát 4 vẫn bắt đầu từ 022»: PR này dùng số 022, nên **lát 4 bắt đầu từ 023** khi PR này được merge (đã ghi vào roadmap).

## Sự cố và môi trường của phiên

- **Bản sao iCloud.** Trong lúc cổng bảo mật lượt 2 chạy, worktree xuất hiện 782 tệp chưa theo dõi tên dạng `<tên> 2.<đuôi>` (`docs` 476, `src` 125, `tests` 78, `migrations` 30, …). Phiên điều phối đo: thư mục worktree đã có từ 16/11 và được dùng lại; các bản « 2» mang thời điểm sửa của 16/11, tức nội dung cũ của worktree trước ở cùng đường dẫn. Phiên này so từng tệp: 767 trùng từng byte với tệp gốc trên đĩa, 15 là bản cũ đã commit (có trong kho đối tượng git), 0 tệp có nội dung nằm ngoài git, 0 tệp không đọc được. Cả 782 được gỡ; không tệp nào ngoài worktree này bị đụng. Từ đó, trước mỗi lượt test, typecheck, build và mỗi commit, phiên đếm lại bản sao; dòng `dupes: untracked=0 next-types=0` chỉ được ghi vào log ở các lượt tới `83d5e2f` (`final-*.txt`, `head-83d5e2f-*.txt`, `coverage-383c394.txt`). Các log sau đó — các lượt của vòng sửa và các lượt cả bộ ở `56d257c`, `05a6da0`, `9b0f83f` — không mang dòng này, nên việc đếm ở các lượt đó không có bằng chứng trong repo. Mọi `git add` nêu đích danh tệp. Hai số gốc khớp sổ bàn giao của Task 7c (77 tệp test), nên lượt gốc không bị bản sao làm lệch.
- **Giới hạn chi tiêu của mô hình.** Lượt đầu của cổng bảo mật trên kế hoạch dừng giữa chừng vì giới hạn chi tiêu; được chạy tiếp sau khi người dùng bảo thử lại. Lượt đó chưa ghi gì trước khi dừng.
- **Một hook của máy chặn một lệnh shell của `planner`** vì chuỗi lệnh chứa chữ của một câu tắt trigger dành cho CSDL PGlite trong bộ nhớ. Câu đó không được chạy lại; chi tiết ở kế hoạch, X7 mục 7.
- **Một lệnh vitest được khởi động ngoài worktree** (Task G1). Script bọc đầu tiên của builder chuyển sang thư mục phía trên worktree và khởi động một lệnh vitest ở đó, một lần. Lệnh ghi log của script thất bại; ở đường dẫn đó không có tệp test nào. Một thư mục cache của vitest dưới `node_modules` của checkout chính có thời điểm sửa đúng phút đó; `git status` của checkout chính sạch; không gì ngoài worktree được dọn hay bị đụng theo cách nào khác. Biên nhận không nói gì hơn về lần chạy đó.
- **CSDL thử.** Container `libetech-slice1-pg` đang dừng lúc phiên bắt đầu. Phiên tạo một CSDL riêng trong đó cho PR này (để migration 022 không dính vào CSDL thử của phiên khác) và một tệp biến môi trường trong thư mục tạm của phiên; không giá trị nào được in hay chép vào repo. Sau mỗi lần 022 đổi thân, CSDL đó được lùi 022 bằng tệp lùi hiện hành rồi áp lại. Cuối phiên: CSDL riêng của PR đã được xoá (`DROP DATABASE`); lúc đó không có kết nối nào khác tới container; các CSDL khác trong container không bị chạm; container được dừng lại (`docker stop`), đúng trạng thái lúc phiên bắt đầu; tệp biến môi trường tạm của phiên đã được xoá.
- Mô hình: `planner` chạy Fable 5.2, không lùi mô hình; `builder` chạy Sonnet; riêng Task F1b, F1c, F5, G1 và G2 do cùng một builder chạy Opus làm (theo sổ của phiên).
