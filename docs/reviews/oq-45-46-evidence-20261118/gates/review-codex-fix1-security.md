# Review bảo mật — vòng sửa 1 của cổng Codex (Task F1, F2, F3), PR mã OQ-45 và OQ-46

- Nhánh `feat/oq-45-46-ai-drafts`, BASE `f5b2a36`, HEAD `f434f0a` (4 commit: `cb1d7dc`, `1a423a5`, `9da79c6`, `f434f0a`).
- Gói soát: `.superpowers/sdd/oq-45-46-ai-drafts/review-fix1-F1-F3-f5b2a36..f434f0a.diff`; đọc thêm tệp hiện hành `migrations/022_ai_drafts_pointer_only_guard.sql`, `migrations/rollback/022_ai_drafts_pointer_only_guard.sql`, `migrations/021_ai_suggestions_z4.sql:88-113`, `migrations/016_intake_inbox.sql:153-177`, `src/server/suggestions.ts`, `src/server/source-text.ts`.
- Chế độ: chỉ đọc. Không chạy vitest, không chạm Docker hay CSDL nào. Số liệu đo trên PostgreSQL 16 là của phiên chính (nêu ở câu giao việc), không phải của người soát.
- Lời Chairman chỉ được trích bằng đúng các chuỗi: «OQ-45: 1b, 2b, 3b. OQ-46: b, mốc là bản mới nhất nháp nêu» và, cho quyết định phạm vi, «B: chặn tạm (Recommended)» cùng chữ của phương án B «Giữ chỗ fail-closed: không nháp ứng viên nào xác nhận được cho tới khi anh quyết điểm 3 của OQ-53. Nằm trong phạm vi brief; phải đổi kỳ vọng các ca của lát 3 đang xác nhận nháp ứng viên. Z4 đang tắt, chưa có login AI nên hôm nay không có nháp thật nào bị chặn.» «(Recommended)» là nhãn của phiên điều phối.

## Kết luận

| Finding Codex | Trạng thái | Căn cứ ngắn |
|---|---|---|
| **CX1** [P0] nhãn `IBS_HI` lộ trước RLS | **Đóng** | `#fact` `migrations/022_ai_drafts_pointer_only_guard.sql:22-39`: trigger phạm vi (invoker, chạy trước theo tên) từ chối bằng `42501` + câu của RLS mọi dòng mà `ai_insert` sẽ từ chối, trước khi hàm definer đọc ánh xạ hay lấy khoá. Ca G7, G9, G19, G26 so `{code,message}` của dự án `IBS_HI` và dự án khác. Phần dư trong phạm vi tự khai là R33 (thuộc thiết kế login AI), đã nêu đúng cỡ |
| **CX2** [P0] nháp mang chữ của tin đã ẩn | **Đóng** cho chữ cùng dự án, **cả hai loại nháp** | `#fact` `src/server/suggestions.ts:212-214` (đọc) và `:308-309` (xác nhận) gọi `projectHasHiddenText` cho mọi nháp, ngoài nhánh ngữ cảnh. N2 của cổng thiết kế được áp theo (a); W7 ghim đúng kịch bản của N2. Giới hạn còn lại (chữ của dự án khác, chữ đang hiện) nêu ở R35 và OQ-55 |
| **CX3** [P1] xác nhận nháp ứng viên không đồng bộ với đường nhận tin | **Đóng** bằng giữ chỗ (không phải phương án được chọn của điểm 3 OQ-53) | `#fact` `src/server/suggestions.ts:315`: mọi lệnh xác nhận nháp ứng viên có `SUBJECT_ORDER_UNVERIFIED`, đứng ngoài `if(ctx)`, ngay trước `if(reasons.size)` |
| **CX4** [P1] đọc ánh xạ không đồng bộ với lệnh đổi miền | **Đóng** cho mọi lệnh ghi qua hai trigger | `#fact` `:55` (khoá chia sẻ, câu lệnh riêng, trước câu đọc) và `:72` (khoá độc quyền trong trigger ánh xạ); G23, G24 đo trên PG16 theo lời phiên chính. Cái giá là S-1 (P2) — xem mục D |

| Mức | Số |
|---|---|
| P0 | 0 |
| P1 | 0 |
| P2 | 1 |
| P3 | 4 |

Không thấy đường mới nào làm lộ nhãn, chữ hay mã ngoài phạm vi; không thấy thứ gì được bật.

## A. Từng finding Codex — đóng tới đâu, có mở gì mới không

### CX1

- **Thứ tự trigger.** `#fact` G12 ghim tên và `tgtype=7` của hai trigger `BEFORE INSERT` của bảng nháp, theo thứ tự `ai_drafts_declared_scope_guard` < `ai_drafts_pointer_only_guard`; `ai_drafts_immutable` là trigger `UPDATE`/`DELETE`. `#inference` (tài liệu `CREATE TRIGGER`) trigger cùng sự kiện chạy theo thứ tự tên.
- **Các dạng lệnh.** `MERGE … WHEN NOT MATCHED THEN INSERT`, chèn nhiều dòng (cả hai thứ tự), đúng câu lệnh của `submitDraft` (`ON CONFLICT(tenant_id,dedupe_key) DO NOTHING RETURNING id`) trên một khoá đã có, `app.*` không phải uuid: G26 so câu trả lời của hai dự án, bằng nhau. `#inference` `COPY FROM` bị từ chối với role chịu RLS trước khi trigger chạy; `INSERT … ON CONFLICT DO UPDATE` cần quyền `UPDATE` mà role AI không có. Trigger theo dòng chạy trước kiểm tra chỉ mục duy nhất, nên lỗi trùng khoá của tenant khác không tới được trước trigger phạm vi.
- **Role mà RLS không ràng.** Trigger phạm vi tự bỏ qua khi `row_security_active` sai (superuser, `BYPASSRLS`, chủ bảng không `FORCE`). Hôm nay đó chỉ là login vận hành; G26 phần «control» ghim rằng `app.*` hỏng trong phiên vận hành không quyết điều gì. Điều kiện 22 đặt đúng chỗ cho login AI tương lai.
- **`RETURNING`.** `#fact` `migrations/021_ai_suggestions_z4.sql:95-97`: `ai_select` hôm nay **lỏng hơn** `ai_insert` (hai vế, không có vế `ai_principal_id`), nên dòng qua được trigger phạm vi cũng qua được kiểm `SELECT` mà `RETURNING` áp lên dòng mới. G25 không ghim `ai_select` — trùng DB-1 của review CSDL; tôi đồng ý với mức P2 của DB-1 và không nêu lại.
- **Kênh mới?** Câu trả lời của trigger khác lỗi RLS gốc ở `HINT` và `CONTEXT`, nhưng hai dự án cùng nhận câu của trigger, nên không phân biệt được dự án. Ngoài phạm vi đã khai không có lần chờ khoá nào (khoá nằm trong hàm definer, sau trigger phạm vi), nên không có kênh thời gian. Không thấy kênh mới.

### CX2

- `#fact` `src/server/source-text.ts:186-194`: một giá trị đúng/sai; đóng khi mã dự án sai dạng, khi câu lệnh không trả dòng, và khi dự án không thấy được trong phạm vi giao dịch (vế `NOT EXISTS(SELECT 1 FROM projects …)` — R4 của cổng thiết kế đã áp). U1, U3 ghim.
- `#fact` RLS của `source_events` và `source_event_revisions` cho runtime chỉ theo tenant và dự án (`migrations/016_intake_inbox.sql:161-177`), không theo người: không có trường hợp người đọc không thấy một bản chữ đang ẩn của chính dự án mình rồi được trả nội dung.
- Thứ tự đọc trong `present`: người không có quyền quyết định rẽ ra trước (`:199`), không chạy câu theo dự án (W5 ghim). Người có quyền: câu chạy một lần cho mỗi danh sách (`??=`).
- `THREAD_TEXT_HIDDEN` nay là tập con thật của `PROJECT_TEXT_HIDDEN` (cùng `textAllowedSql`, câu luồng hẹp hơn): không có trường hợp luồng che mà dự án không che.
- **Kênh mới?** `PROJECT_TEXT_HIDDEN` cho người có quyền quyết định nháp tài liệu biết một bit về dự án của chính họ: dự án có chữ đã lưu mà cấu hình nay không cho hiện. Không lộ chữ, không lộ mã tin, không xuyên dự án. Chấp nhận được; xem S-5.

### CX3

- Không lệnh xác nhận nháp ứng viên nào còn tới bước ghi. Phát lại chỉ trả quyết định đã có. Đường chèn thẳng `draft_decisions` bằng role runtime vượt mọi bước giữ của dịch vụ — có từ trước, không đổi bởi vòng này (đã nêu ở cổng thiết kế).
- Bốn câu chú thích ở `src/server/suggestions.ts:310-314` tách lời quy cho quyết định phạm vi khỏi ghi chú kỹ thuật (R6 của cổng thiết kế đã áp). Không chỗ nào trong mã gọi giữ chỗ là phương án đã chọn.

### CX4

- Đóng cho mọi lệnh ghi đi qua hai trigger (lập luận ảnh chụp mới sau khi chờ, đo bởi G23 trên PG16 theo lời phiên chính).
- Lỗ còn lại không do diff mở: `session_replication_role = replica` và tắt trigger (chỉ superuser/chủ bảng); đường nhận tin đọc ánh xạ không lấy khoá (`src/server/intake.ts:70`, R34 «Khác»).
- **Cái mới mà fix mở ra:** S-1.

## B. F2 và F3 — fail-closed và thứ tự câu trả lời

- **`present`.** Mọi nhánh của người có quyền: `SCHEMA_INVALID` → ngữ cảnh (null ⇒ `ENTITY_NOT_FOUND`) → `PROJECT_TEXT_HIDDEN` (ngoài nhánh ngữ cảnh) → `THREAD_TEXT_HIDDEN`. Nội dung chỉ trả khi tập lý do rỗng **và** giá trị qua schema (`:220`). Lỗi của câu lệnh đi nguyên lên (đọc thất bại, không trả nội dung). `SUBJECT_ORDER_UNVERIFIED` không phải `MaskReason` (ca `@ts-expect-error`), đúng: giữ chỗ chỉ giữ lúc xác nhận, theo chữ của phương án B.
- **`decide`.** `PROJECT_TEXT_HIDDEN` (`:309`) và `SUBJECT_ORDER_UNVERIFIED` (`:315`) đều ngoài `if(ctx)`; W8 và ca 6 của «every other check still runs» ghim trường hợp không dựng được ngữ cảnh.
- **Thứ tự câu trả lời** (`:273-316`): quyền → «đã quyết» → `valueHash` → lỗi của lệnh (`REASON_REQUIRED` cho từ chối; `INVALID_INPUT` cho xác nhận nháp ứng viên kèm `revision`) → các mã giữ. Đúng V4, V5. Ca «the fault of the command is answered after …» (`tests/suggestions.test.ts:1521`) ghim ba bậc đầu cho đúng tổ hợp «nháp ứng viên + `revision`» (C5 của cổng thiết kế). `decideSchema.parse` đứng trước mọi bước này, như từ trước PR; nó không phụ thuộc trạng thái nháp nên không thành kênh dò.
- **Phán quyết về R12-i — đồng ý.** `INVALID_INPUT` chỉ phụ thuộc `d.entity_type`, thứ đã có ở phần đầu của mọi `DraftView` mà người có quyền nhận; nó đứng sau quyền, nên người không có quyền không học được gì từ hình dạng lệnh. Bỏ `revision` khỏi lệnh của dòng «cặp» là cách duy nhất để ca vẫn khẳng định đúng điều tên ca nói (`ENTITY_NOT_FOUND`). Phần mất đi: không ca nào còn ghim «dòng cặp + `revision`» → `INVALID_INPUT`, và ca dùng `held` (chứa) chứ không `heldOnly` — S-4.

## C. Ca kiểm khẳng định ít hơn tên của nó

- G27 (ii) và ca «waits past the cap» của `tests/suggestions-concurrency.test.ts:173` — S-3.
- `answer()` (`tests/z4-pointer-guard.test.ts:53`) chỉ so `code` và `message` — S-2.
- R12-i — S-4.
- Không thấy ca nào trong F1–F3 không thể đỏ: các ca đổi kỳ vọng sang `heldOnly(…,'SUBJECT_ORDER_UNVERIFIED')` đều chặt hơn bản cũ (danh sách mã bằng đúng); W1, W7 ghim cả chiều «cờ còn thì trả» nên không xanh bằng cách che mọi thứ; G20 phần `row_security = off` được ghi rõ là đối chứng.

## Finding

| # | Mức | Chỗ | Kịch bản | Sửa |
|---|---|---|---|---|
| S-1 | **P2** | `migrations/022_ai_drafts_pointer_only_guard.sql:55`, `:72`, `:14-15` · `docs/plans/oq-45-46-ai-drafts.md` R34 | `#fact` Khoá tư vấn không có danh sách quyền. `#inference` Bất kỳ login nào của hệ thống — `libetech_web`, `libetech_auth`, `libetech_intake_svc`, và login AI tương lai — chạy `pg_advisory_lock(1346653516, hashtext('<mã dự án>'))` ở mức phiên (G27 đo dạng này dưới role AI) thì mọi lần ghi ánh xạ `IBS_HI` của dự án đó thất bại `55P03` sau 5 giây, chừng nào phiên còn sống. Trong lúc ấy CSDL chưa ghi dự án là `IBS_HI`, nên nháp có nội dung vẫn được lưu **và vẫn được trả lúc đọc** (phép kiểm lúc đọc cũng chưa thấy ánh xạ). Thêm: `pg_locks` cho mọi role thấy thời điểm một dự án đang được ghi ánh xạ / chèn nháp, xuyên tenant (không lộ nhãn). Cần chạy được SQL dưới một login của hệ thống: hôm nay không có đường nào từ ngoài; trần 5 giây biến «treo im lặng» thành «thất bại có tên». | Thiết kế B ở mục D. Nếu giữ A: bối cảnh vòng 2 của Codex nêu thẳng R34 kèm câu «mọi login của hệ thống, kể cả login web», và điều kiện 18 thêm phép canh `pg_locks` cho cả ba login hiện có, không chỉ login pipeline |
| S-2 | P3 | `tests/z4-pointer-guard.test.ts:53` (`answer`), dùng ở G9, G20, G26 | Ca ghim «hai dự án nhận cùng câu trả lời» chỉ so `code` và `message`. Một thay đổi về sau đưa dữ liệu theo dự án vào `DETAIL`, `HINT` hay `CONTEXT` của lỗi (ví dụ một `RAISE … DETAIL` nêu mã dự án) sẽ không làm ca nào đỏ. | So thêm `detail`, `hint`, `where` (các trường lỗi mà driver trả) trong `answer` |
| S-3 | P3 | `tests/z4-pointer-guard.test.ts:625` (G27 ii) · `tests/suggestions-concurrency.test.ts:189` | Tên ca nói «fails with 55P03 inside the cap instead of hanging». Nếu ai bỏ `SET lock_timeout` khỏi định nghĩa hàm, lệnh chờ trên kết nối vận hành của harness có thể treo tới timeout của vitest — đỏ bằng timeout, không bằng `AssertionError` (luật bằng chứng đỏ của workspace). `proconfig` được G12 ghim tĩnh nên lỗ hổng không lọt, nhưng ca động không tự nói được lý do. | Bọc lệnh chờ trong `Promise.race` với một hạn 9 giây trả giá trị nhận diện, rồi `expect` trên giá trị đó |
| S-4 | P3 | `tests/suggestions.test.ts:344-352` (R12-i) | Sau phán quyết, không ca nào ghim dòng «cặp» (ứng viên + kỹ năng tài liệu) gửi kèm `revision` → `INVALID_INPUT`; và `held` chỉ kiểm «chứa», nên một thay đổi làm dòng cặp mất `SUBJECT_ORDER_UNVERIFIED` vẫn xanh. | Thêm `refused(decide(… pair … {revision}),'INVALID_INPUT',422)` và đổi dòng cặp sang `heldOnly(…,'ENTITY_NOT_FOUND','SUBJECT_ORDER_UNVERIFIED')` |
| S-5 | P3 | `src/server/suggestions.ts:213-214` · R35 | Một bit mới cho người có quyền quyết định nháp tài liệu: dự án của họ có chữ đã lưu mà cấu hình nay không cho hiện (cờ nhóm bị gỡ, hoặc ánh xạ `IBS_HI`). Cùng dự án, người đó có vai đọc hộp tin; không lộ chữ hay mã. | Không cần sửa mã. Một câu trong R35: mã lý do tự nó là thông tin cấu hình của dự án |

Không phải finding, nêu để vòng 2 khỏi hỏi: `55P03`/`40P01` đi thô qua `submitDraft` (R34 «Khác», điều kiện 18) — hôm nay không có tuyến nào; tuyến đầu tiên phải ánh xạ chúng thành `AppError` 503 không kèm `CONTEXT`.

## D. Cơ chế khoá của CX4 — A hay B

Cả hai đóng CX4 theo cùng một cách: đọc ánh xạ sau một lần chờ ở câu lệnh riêng, ở READ COMMITTED; lệnh ghi ánh xạ chờ lệnh chèn nháp đang chạy. Ở cả hai, **người ghi nháp vẫn hoãn được lệnh ghi ánh xạ bằng một giao dịch còn mở** — đó là cái giá của việc đóng chặt, không gỡ được. Khác nhau ở chỗ **ai khác** có được năng lực đó.

### Thiết kế A (đã commit, `cb1d7dc`) — khiếm khuyết

1. **Không có quyền truy cập.** Mọi role, mọi login của CSDL lấy được khoá, kể cả ở mức phiên, không cần ghi dòng nào (S-1). Trần 5 giây chỉ đổi «treo» thành «thất bại»; mọi lần thử lại đều thất bại chừng nào khoá còn bị giữ.
2. **Dạng mức phiên** sống ngoài giao dịch: `idle_in_transaction_session_timeout` không chạm tới; cần thêm `idle_session_timeout` hoặc phép canh `pg_locks` cho **mọi** login.
3. **Kênh phụ `pg_locks`**: thời điểm ghi ánh xạ / chèn nháp của một dự án lộ cho mọi role biết mã dự án, xuyên tenant. `pg_try_advisory_lock` cho cùng bit đó mà không cần đọc `pg_locks`.
4. **Bảng khoá dùng chung**: mỗi dự án trong một giao dịch ghi ánh xạ hàng loạt hay phục hồi tốn một chỗ (DB-4 (a) của review CSDL).
5. Vòng khoá chết R3 (b) — như B.
6. Điểm mạnh: đã xây, đã đo trên PG16 (G21, G23, G24, G27, Y1, Y2), không đụng bảng `projects`, không thêm hàm definer, nhất quán với cách repo đã dùng khoá tư vấn (`src/server/suggestions.ts:260`, `src/server/intake.ts:87`).

### Thiết kế B (khoá dòng `projects`, chưa xây) — khiếm khuyết

1. **Giao dịch chèn nháp còn mở chặn `UPDATE` dòng dự án** (phản đối của review CSDL, 2.9). Đúng về cơ chế, nhưng theo catalog do phiên chính đo: không role không-superuser nào có `UPDATE` trên `public.projects`, không hàm nào ghi bảng đó, không trigger người dùng nào trên đó. Tức là hôm nay **không có `UPDATE` nào của dịch vụ** để bị chặn; người bị chặn chỉ có thể là login vận hành hay migration, vốn tự đặt `lock_timeout` được (`deploy/pilot-onboard-20261111.py:147` đã làm vậy). Pool của dịch vụ đặt `statement_timeout: 10000` (`src/server/db.ts:32`). Tôi không đồng ý với câu «mặt tấn công rộng hơn» ở 2.9: tập người chặn được thu từ «mọi role» về «role ghi được nháp», và tập nạn nhân là một lệnh mà hôm nay chỉ superuser chạy.
2. **Thêm một hàm `SECURITY DEFINER` gắn vào bảng Z1** `public.project_domain_mappings` (cùng điểm DB-8 về schema của hàm). Phải ghim `search_path`, `row_security = off`, `lock_timeout`, `REVOKE … FROM PUBLIC`, và thân chỉ có một câu `PERFORM`.
3. **Trigger `BEFORE` chạy trước `WITH CHECK`** trên bảng ánh xạ: nếu sau này một role chịu RLS được quyền chèn ánh xạ (AGENTS.md nói dòng ánh xạ do người có thẩm quyền tạo — rất có thể qua ứng dụng), lệnh của nó sẽ khoá / chờ dòng dự án của tenant khác trước khi RLS từ chối — đúng lớp lỗi của CX1, ở dạng thời gian. Hôm nay không role nào như vậy (chỉ `SELECT`). Ở A lỗ này cũng có và còn rộng hơn (khoá tư vấn và `pg_locks` không cần quyền gì). Ở cả hai: điều kiện mới «trước khi cấp `INSERT` trên bảng ánh xạ cho role chịu RLS, trigger khoá phải soi phạm vi trước, như trigger phạm vi của 022».
4. Vòng khoá chết R3 (b) giữ nguyên. MultiXact tăng theo số nháp chèn đồng thời trên một dự án (khoá ngoại vốn đã tạo `FOR KEY SHARE`) — không đáng kể ở lưu lượng nháp.
5. Khoá dòng không hiện trong `pg_locks` trừ khi có người chờ: chẩn đoán đi qua `pg_blocking_pids()` của người chờ; điều kiện 18 phải viết lại.
6. Phải viết lại G21, G27, phần khoá của G12/G20 và hai ca chờ của `tests/suggestions-concurrency.test.ts`, rồi chạy lại trên PG16 — trước vòng Codex cuối.
7. Điểm mạnh: role không tự lấy được khoá (đã đo: `FOR SHARE`/`FOR KEY SHARE` dưới `libetech_runtime` → `42501`; `FOR KEY SHARE` của khoá ngoại không xung đột với `FOR NO KEY UPDATE` hay `FOR SHARE`, nên không chặn lệnh chèn con của lát nào); không có dạng mức phiên (khoá dòng hết khi giao dịch hết, `idle_in_transaction_session_timeout` chạm tới); không có kênh `pg_locks` xuyên tenant; không tốn bảng khoá dùng chung; không bảng mới, không grant.

### Tôi sẽ ship gì cho PR này

**B**, nếu phiên chính dựng được nó trong vòng này và nó qua lại một lượt soát bảo mật ngắn trên diff (hai câu SQL, một hàm đổi sang definer, các ca nêu ở khiếm khuyết 6) trước khi gửi Codex. Lý do: S-1 là chỗ duy nhất của vòng sửa trao cho bên không tin một năng lực **mới** trên đúng lệnh bật «chỉ con trỏ» (`AGENTS.md:16`), và trần 5 giây không lấy lại năng lực đó; B thu năng lực về đúng mức không gỡ được (người ghi nháp, trong giao dịch của chính nó) mà không thêm bảng hay grant, và các hành vi nó dựa vào đã được đo trên PG16.15. Phản đối chính đối với B nhắm vào một `UPDATE` mà hôm nay dịch vụ không có. **Nếu không kịp** dựng B, chạy lại PG16 và soát lại trước vòng cuối, ship A: lỗi của B do vội (nhất là một hàm definer mới trên bảng Z1) đáng sợ hơn một phần dư đã nêu đúng cỡ; khi đó bối cảnh vòng 2 phải nêu S-1 thẳng như ở cột «Sửa», và tôi đoán cổng chấm nó P2, không chắc — một phần dư «mọi role chặn được việc bật chỉ con trỏ» là loại Codex vòng 1 đã không chấp nhận chỉ vì nó đã được ghi.

## E. Bí mật, đường dẫn máy, chat id, thứ được bật

- `#fact` Diff không có `GRANT`, `CREATE ROLE`, `ALTER ROLE`, mật khẩu, khoá, tuyến HTTP mới (`src/app` không đổi), lời gọi mô hình, hay membership. Thay đổi `src` chỉ ở `src/server/source-text.ts` và `src/server/suggestions.ts`.
- `#fact` Chat id trong ca là hằng tổng hợp (`tests/slice2-fixtures.ts:13-14`). Không thấy đường dẫn máy cục bộ hay chuỗi kết nối trong diff và trong các tệp bằng chứng đã commit dưới `docs/reviews/oq-45-46-evidence-20261118/` của khoảng BASE..HEAD (grep, không mở từng tệp).
- `libetech_ai` vẫn NOLOGIN, không member, không quyền gọi hàm nào của 022 (G8, G20).

## Không kiểm được từ diff

- Mọi hành vi PostgreSQL 16 (thứ tự trigger, ảnh chụp sau khi chờ, `lock_timeout` mức hàm với khoá tư vấn, `row_security_active`, các phép đo của thiết kế B) — từ tài liệu, mã nguồn, và lời phiên chính về các lượt đo; người soát không chạy.
- Các lượt xanh/đỏ ghi trong `docs/reviews/oq-45-46-evidence-20261118/codex-fix1-F{1,2,3}-*.txt`: chỉ đối chiếu là có tệp; không đọc từng dòng.
- `FOR SHARE` dưới `libetech_identity` và `libetech_intake` (quyền `SELECT` mức cột): `#inference` cũng `42501` vì thiếu `UPDATE`; chưa đo — cần đo nếu chọn B.
- `EXPLAIN` của `projectHasHiddenText` trên dữ liệu lớn (điều kiện 19).
- Kiểu kiểm `@ts-expect-error` chỉ có tác dụng khi `tsc` bao cả `tests/`; phiên chính báo typecheck exit 0, chưa đối chiếu `tsconfig`.

VERDICT: READY FOR GATE
