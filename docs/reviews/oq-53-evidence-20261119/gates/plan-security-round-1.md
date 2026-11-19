VERDICT: READY_TO_BUILD

# Cổng bảo mật, soát kế hoạch OQ-53 bản 0.1, vòng 1

Ghế: bảo mật (chỉ tìm và xếp hạng; không sửa mã, kế hoạch, migration). Đối tượng: `docs/plans/oq-53-subject-verification.md` (0.1, gốc `80c1ad8`, commit `725c5da`), tệp đo `docs/reviews/oq-53-evidence-20261119/measurements-pg16.txt` và hai script đo. Cách soát: đọc lại mã thật ở `80c1ad8` (`migrations/016`, `021`, `022` và tệp lùi 022; `src/server/{suggestions,source-text,skill-contracts,skill-context,intake,intake-scope,db,http}.ts`; `bot-plugin/__init__.py`; các ca canh ở `tests/`), rồi đo riêng trên PostgreSQL 16.15 trong hai schema nháp `secrev_*` (đã bỏ; kiểm sau cùng: 0 schema `secrev_` còn lại). Không áp migration nào, không đổi role/quyền thật, không chạy vitest. Báo cáo không chứa secret, chuỗi kết nối hay đường dẫn máy.

Kết luận một dòng: **không P0, không P1**. Thiết kế đóng đúng khe thứ tự commit và khe kiểm-rồi-commit của cùng luồng, không mở oracle mới trước hoặc dưới RLS, không cấp thêm quyền ngoài ý định. Ba P2 và sáu P3 dưới đây là sửa chữ/điều kiện/ca kiểm; S-1 và S-2 phải vào kế hoạch 0.2 trước khi Task 7 bắt đầu (không chặn Task 1–6).

Số finding: P0 0 · P1 0 · P2 3 · P3 6.

---

## Phép đo của ghế bảo mật (PostgreSQL 16.15, schema nháp, role `libetech_intake` thật)

Mô hình: bảng bản sửa có RLS `FORCE` và hai policy giống `016` (`intake_select`, `intake_insert … WITH CHECK` theo `app.tenant_id`/`app.project_ids`), cấp cột `INSERT` cho `libetech_intake`; hàm trigger `AFTER INSERT … FOR EACH ROW`, `SECURITY DEFINER`, `search_path = pg_catalog, pg_temp`, `row_security = off`, `lock_timeout` rút còn 2 giây; một giao dịch giữ khoá dòng đếm của luồng A bằng một bản đã chèn và để mở. Dòng thông báo `RAISE NOTICE` đầu hàm cho biết trigger có chạy không. Đây là đo cơ chế, không phải SQL của 023.

| # | Lệnh (role intake, phạm vi dự án A, luồng A đang bị giữ) | Kết quả |
|---|---|---|
| m1 | `INSERT … VALUES` hai dòng: một dòng của luồng A (trong phạm vi), một dòng của dự án B | `42501` sau 1 ms; trigger không chạy (0 thông báo) |
| m2 | `INSERT … SELECT` cùng hình dạng, trộn phạm vi | `42501` sau 1 ms; trigger không chạy |
| m3 | chỉ dòng của luồng A (đối chứng) | `55P03` sau 2 006 ms (chờ khoá, đúng thiết kế) |
| m4 | dòng trong phạm vi nhưng `source_event_id` của dự án khác | `23503` sau 0 ms; trigger chạy một lần, tra nguồn không thấy, tự ném `23503` trước khi chạm khoá |
| m5 | chỉ dòng của dự án B | `42501` sau 0 ms; không chờ |
| m6 | như m1 nhưng không ai giữ khoá | `42501`; trigger không chạy; số dòng đếm sau lệnh: 0 |
| m7 | `COPY … FROM STDIN` (psql, role intake) ba dạng: trộn phạm vi khi luồng bị giữ, chỉ dòng trong phạm vi khi luồng bị giữ, trộn phạm vi khi rảnh | cả ba: `COPY FROM not supported with row-level security`, 40–47 ms. COPY FROM không phải đường vào với một role chịu RLS |
| m8 | giao dịch đã chèn bản (lấy khoá luồng) rồi gặp một lỗi câu lệnh (`1/0`) và **chưa** `ROLLBACK`; một writer thứ hai chèn vào cùng luồng | writer thứ hai đi qua ngay (1 ms, không lỗi): khoá bị nhả ngay lúc lỗi, một giao dịch ở trạng thái «aborted» không giữ khoá nào |

Hệ quả: (1) hàng đợi AFTER ROW chỉ chạy sau khi mọi dòng của lệnh qua `WITH CHECK`, nên một dòng ngoài phạm vi trong cùng lệnh làm cả lệnh hỏng trước khi trigger nào chạy: kỳ vọng của kế hoạch (§19, câu hỏi 3: «dòng trong phạm vi được chèn và khoá trước khi dòng ngoài phạm vi làm cả lệnh thất bại») sai theo hướng an toàn hơn (S-4). (2) Kênh «role ngoài phạm vi chờ khoá của luồng nó không được ghi» không có trên `INSERT`, `INSERT … SELECT`, `COPY`. (3) Muốn giữ khoá luồng, người giữ phải có một câu lệnh thành công và để giao dịch mở; một lệnh chèn quyết định bị `LTZ03` không giữ gì (S-4).

---

## Findings

### S-1 [P2] Lùi rồi áp lại 023 có thể đánh số bản theo `created_at` rồi nhận một nháp từ ngữ cảnh đọc trước đó (L8, P5, P6, tệp lùi)

Vị trí: kế hoạch §5 P5–P6, §7 bước 8 và đoạn tệp lùi, §17 L8, §19 câu hỏi cho cổng bảo mật số 2.

Lỗi: số của dòng cũ khi áp lại là `row_number()` theo `created_at, revision_no, id` (P5). `created_at` là `now()` lúc bắt đầu giao dịch (`migrations/016_intake_inbox.sql:65`), không phải thứ tự commit, nên số đó có thể ngược thứ tự commit. P6 chỉ từ chối khi **đã có** nháp ứng viên chưa quyết định; nó không thấy một lần chạy pipeline đang dở.

Kịch bản (cần: Chairman duyệt lùi 023 trên một CSDL đang có Z4 bật; tệp lùi vẫn qua vì chưa có quyết định mang vị trí): sau khi lùi, giao dịch X bắt đầu lúc t1 và giao dịch Y bắt đầu lúc t2 > t1 nhận tin vào cùng một luồng. Y commit trước; pipeline dựng ngữ cảnh, thấy Y, không thấy X; X commit sau đó (sau lần đọc ngữ cảnh) và 023 được áp lại: X có `created_at` sớm hơn nên nhận số nhỏ, Y nhận số lớn hơn, `last_seq` bằng số của Y. Pipeline ghi nháp (sau khi áp lại) nêu (Y, bản 1): mốc bằng số của Y bằng `last_seq`, nháp «còn mới» dù X là tin đến sau lần đọc ngữ cảnh. Một nháp cũ xác nhận được: đúng lớp «kiểm rồi bên khác commit». Số của X nhỏ hơn số của Y chỉ vì thứ tự `created_at`, không phải thứ tự commit.

Mức P2 vì: lùi cần duyệt riêng của Chairman (tệp lùi 022 và dòng đầu tệp lùi 023 đã ghi «không chạy trên dữ liệu thật khi chưa có lời Chairman»); Z4 chưa bật; cửa sổ cần một lần chạy pipeline vắt qua cả hai migration; và PR #22 đã qua cổng Codex với các phần dư cùng loại «guard vắng sau lùi/tắt trigger» (`docs/DELIVERY-015-ai-drafts-read-and-stale-20261118.md:410`, R19, R37). Tôi không coi đó là bằng chứng cổng sẽ nhận lại mục này: kế hoạch hỏi thẳng cổng, nên đóng nó bằng cơ chế rẻ, không bằng chữ.

Cách sửa ở mức kế hoạch:
1. Không dùng phương án «cột đánh số lúc nào so với `created_at` của nháp» (P6, cách khác): `created_at` của nháp là lúc ghi, không phải lúc đọc ngữ cảnh, nên nó không đóng được kịch bản trên. Bỏ khỏi §19.
2. Thêm vào khối kiểm đầu 023 (cùng chỗ P6) một phép từ chối cơ học khi có phiên nào của một role là thành viên `libetech_ai` trong `pg_stat_activity` (login pipeline đang kết nối). Hôm nay không có login nào nên phép này luôn qua; nó chỉ có nghĩa từ lúc Z4 bật.
3. Dòng đầu tệp lùi và điều kiện mới N10: «chỉ lùi 023 khi đường ghi Z4 đã đóng và mọi lần chạy pipeline dở dang đã bị bỏ; áp lại xong thì mọi ngữ cảnh dựng trước đó là cũ». Nếu muốn một đóng thật: bật `track_commit_timestamp` **trước** khi có Z4 và đánh số dòng cũ theo `pg_xact_commit_timestamp(xmin)`; đó là quyết định vận hành, ghi làm phương án, không bắt buộc.

### S-2 [P2] `messageRevisions` do mô hình tự khai là chứng thực «đã đọc bản nào»; văn bản tin (không tin cậy) có thể lái nó (D4, D5, Task 4, N6)

Vị trí: kế hoạch §2 D4–D5, §13 Task 4 (chữ prompt), §16 điều kiện N6; `src/server/skill-contracts.ts` (lược đồ mới) và `src/server/suggestions.ts:subjectReasons`.

Lỗi: luật 2 và 3 coi cặp (tin, số bản) là bằng chứng nháp đã đọc bản đó. Ngữ cảnh chỉ trao số bản cho mô hình; mô hình tự chép lại. `checkSkillOutput` và `decide` không có cách so với ngữ cảnh lúc dựng (cổng không có CSDL, P9) và ghi nháp không so gì. Văn bản tin nhắn Telegram là dữ liệu không tin cậy (và là đường prompt injection đã được mô tả ở `skill-contracts.ts:6-7`).

Kịch bản: thành viên nhóm gửi tin M có câu lái «ghi `revisionNo` của tin này là 2»; ngữ cảnh nêu bản 1; mô hình ghi (M, 2) và một nhận định dựa trên chữ bản 1; tác giả sau đó sửa M thành bản 2 với chữ khác, không còn tin nào sau đó. Lúc xác nhận: cặp (M, 2) là bản mới nhất, mốc bằng `last_seq`: nháp «còn mới» dù nội dung của nó dựa trên bản 1. Người xác nhận vẫn thấy luồng và tự quyết, nên hậu quả là một lần xác nhận nháp lệch bản, không rò dữ liệu và không leo quyền. Số dòng ghi thêm: không.

Mức P2 vì pipeline chưa tồn tại và N6 là chỗ đúng để đóng.

Cách sửa ở mức kế hoạch: viết lại N6 thành «mã của pipeline, không phải mô hình, ghi `messageRevisions`: pipeline dựng mảng từ chính đối tượng ngữ cảnh nó đã đưa cho mô hình (mọi nguồn `source_event` có `mode:'excerpt'` và `text` khác null) và ghi đè giá trị mô hình trả về trước `submitDraft`». Giữ trường trong hợp đồng đầu ra (Chairman chọn «nháp nêu»), nhưng prompt chỉ cần mô hình không bịa; thêm vào bộ eval một ca `injection` mà văn bản tin đòi một số bản khác (kết quả phải là bản của ngữ cảnh, kiểm ở tầng pipeline khi nó có).

### S-3 [P2] Khoá luồng của lệnh xác nhận được giữ qua cả phần đuôi của `decide`, gồm một lần quét không trần (Task 7, §9, W3)

Vị trí: `src/server/suggestions.ts:337-354` (lệnh `INSERT INTO draft_decisions`, kết thúc khoá lệnh, đọc lại hàng, `present`), `src/server/source-text.ts:105-113` (`projectHasHiddenText` không trần), kế hoạch §9 «Khoá luồng luôn là khoá **cuối cùng** … lấy trong một giao dịch».

Lỗi: «cuối cùng» đúng cho thứ tự lấy khoá, không cho thời gian giữ. Trigger lấy khoá dòng đếm ở lệnh `INSERT`; từ đó tới `COMMIT` giao dịch còn chạy `present(...)` (dựng lại ngữ cảnh, `projectHasHiddenText` quét mọi bản của dự án, `threadHasHiddenText`). Mọi giao dịch nhận tin của luồng đó chờ hết phần đuôi, trần 5 giây rồi `55P03`.

Hậu quả: không mất tin. `bot-plugin/__init__.py:48-52` và `:206-210` xếp 5xx vào lớp «answered» (xếp lại hàng đợi, tính tối đa 5 lần, 24 giờ), còn không-có-câu-trả-lời (hết `HOOK_TIMEOUT = 2` giây, ngắn hơn trần 5 giây của khoá) vào lớp «network» (giữ thứ tự, không tính); lệnh gửi lại là `replayed:true`. Nhưng một dự án lớn làm phần đuôi dài đủ để gateway spool từng tin của luồng đang được xác nhận: một giảm chất lượng dịch vụ mới trên đường nhận tin đang chạy thật.

Cách sửa ở mức kế hoạch: (a) `decide` đã tính `projectHasHiddenText` ở dòng 314 và `threadHasHiddenText` ở dòng 310; truyền hai kết quả đó vào `present` thay vì quét lại (cùng giao dịch, cùng trạng thái đã khoá); (b) mở rộng N7 (`EXPLAIN`) sang **phần đuôi** của `decide` trên một dự án nhiều bản, và đo thời gian giữ khoá từ lệnh `INSERT` tới `COMMIT`; (c) nếu phần đuôi vẫn lớn: ghi trần mục tiêu (ví dụ dưới 500 ms) làm điều kiện triển khai.

### S-4 [P3] Hai câu của kế hoạch về khoá không khớp phép đo (§19 Q3; L4)

- §19 câu hỏi 3: «dòng trong phạm vi được chèn và khoá trước khi dòng ngoài phạm vi làm cả lệnh thất bại» là không đúng: m1, m2, m6 cho thấy trigger không chạy khi một dòng của lệnh vi phạm `WITH CHECK`. Sửa chữ; ca A5 nên có biến thể hai dòng (xem S-5).
- L4 và R34 của PR #22 («giữ khoá tới khi nó kết thúc — kể cả khi lệnh chèn sau cùng thất bại»): m8 cho thấy một lỗi câu lệnh nhả khoá ngay (giao dịch aborted không giữ khoá). Người giữ khoá luồng cần một lệnh chèn quyết định **thành công** (số vị trí đúng) rồi để giao dịch mở. Điều này chỉ thu hẹp L4; điều kiện 18 (idle timeout của login web) vẫn đúng và vẫn cần.

### S-5 [P3] Ca kiểm: chỗ còn khẳng định yếu hoặc thiếu (câu hỏi h)

Ca sẽ kiểm đúng điều kế hoạch tuyên bố: N5 và N10 (RLS trả lời trước khi giao dịch kia commit, thất bại nếu trigger là `BEFORE`, đúng đột biến m1); N7 và N8 (đóng cả hai chiều; thất bại với `FOR KEY SHARE` theo đo 4); N12 (dựng lại đúng khe commit ngược và đỏ với luật theo thời điểm của PR #22); N11 (không `40P01`); K3 (lỗi của CSDL không lọt chữ); T16 (trigger tắt); J1 (i) và (iii).

Ca còn yếu hoặc thiếu:
1. **A3** liệt kê `INSERT/UPDATE/DELETE` bị từ chối cho runtime, intake, ai; **thiếu `SELECT` thuần** của `libetech_intake`, `libetech_ai`, `libetech_identity`, `libetech_auth`, `libetech_projector`, `libetech_outbox_audit`, `libetech_intake_svc` và `libetech_web` (không `SET ROLE`) trên hai bảng mới. A4 chỉ phủ `SELECT … FOR`. Một `GRANT SELECT` thừa cho `libetech_intake` sẽ không làm ca nào đỏ.
2. **A2** chứng minh «gửi lại không lấy khoá» bằng `xmax = 0`, trên PGlite chỉ khẳng định được điều đó; không có ca native «lúc luồng đang bị giữ, gửi lại một bản đã có trả về ngay» (đo 3c: 0 ms). Thêm N-ca. Đột biến m1 vẫn bị A2 bắt qua `last_seq`, nhưng một `FOR UPDATE` thừa ở trigger thì không.
3. **A5** chỉ có dạng một dòng. Thêm dạng hai dòng (`VALUES` và `INSERT … SELECT`) trộn phạm vi khi luồng bị giữ: kỳ vọng `42501` dưới 100 ms, hai bảng mới không đổi (m1, m2).
4. **B3** chỉ kiểm lời của `LTZ03`. Thêm kiểm `message`, `detail`, `hint` của lỗi `23503` của trigger nhận tin: không mã, không số (`where` của lỗi PL/pgSQL là tên hàm và số dòng, không dữ liệu).
5. **B4**: «`code` khác `LTZ03`» yếu; khẳng định đúng `code` và đúng lời của `draft_decisions_guard` (nó chạy `BEFORE`, trước trigger mới).
6. Đột biến **m2** của Task 9 («bỏ `FOR NO KEY UPDATE`») nên có hai dạng: bỏ khoá, và thay bằng `FOR KEY SHARE`. Đo 4 cho thấy `FOR KEY SHARE` không đóng chiều nào; N7/N8 phải đỏ với cả hai.
7. **P10** (đổi mặc định `entity_type` của `draftVals` sang `'document'`) có thể làm một số ca guard của 021/022 chỉ còn chạm nhánh tài liệu. Giữ ít nhất một ca mỗi guard trên nháp **ứng viên** (`entity_type:'intake_candidate'` có ứng viên thật và vị trí đúng, qua một helper), để thứ tự `BEFORE` (021, 022) rồi `AFTER` (023) vẫn được chạy trên đúng loại nháp; ca ATTACH ở `tests/z4-schema.test.ts:225-226` đã nêu `entity_type` rõ ràng nên không đổi.

### S-6 [P3] `subject_thread_seq` không phải bằng chứng rằng luật của dịch vụ đã chạy (câu hỏi (b); L6, L7)

Một phiên SQL thô dưới login web (qua `SET ROLE libetech_runtime`, phạm vi tự khai) đọc được `last_seq` của luồng trong phạm vi nó khai (policy `runtime_select` giống 016) và chèn một dòng `confirmed` kèm số đó, bỏ qua cổng đầu ra, che, mốc và quyền theo vai của dịch vụ. Đây **không phải rò**: không dữ liệu nào đi ra ngoài phạm vi, không quyền nào mới, và nó chặt hơn hôm nay (một dòng `confirmed` thô hôm nay không cần số nào). Đây đúng là mức tin cậy RLS đã ghi ở R34 và điều kiện 18 của PR #22 (phạm vi là thứ phiên tự khai). Kế hoạch nên thêm hai câu, không thêm cơ chế: (i) ghi vào comment đầu 023 và vào cột (`COMMENT ON COLUMN`) rằng `subject_thread_seq IS NOT NULL` chỉ chứng minh «không ai nhận tin vào luồng giữa lúc đọc số và lúc ghi», không chứng minh nháp đã qua phép kiểm; các OQ-54, OQ-55, OQ-56 và mọi đường đọc về sau không được suy ra điều gì khác từ cột này; (ii) Task 9 giữ câu catalog đếm hai trigger và hai hàm (đã có) và thêm: kiểm `tgenabled='O'` cho cả hai ở lúc khởi động hoặc ở lệnh kiểm triển khai (L7; cùng loại R19).

`LTZ03` gộp nhiều nguyên nhân (cũ, vắng số, không tìm thấy ứng viên); dịch vụ dịch hết thành `SUBJECT_CHANGED`. Chấp nhận (fail-closed, không lộ).

### S-7 [P3] Task 8 nếu OQ-57 chọn 1 (a): hai điểm cần ghi trước khi viết (câu hỏi g)

Nguồn chỉ-con-trỏ của bản chưa duyệt thêm đúng `revisionNo` của bản mới nhất; `id` và `documentId` đã lộ qua nguồn `document` (`src/server/skill-context.ts:72`: `latestRevisionId`). Không lộ chữ, danh sách hay hash nguồn **với điều kiện** che ngay ở SQL (như `pointerOnly`, `skill-context.ts:79-81`): ca L1 đã đòi chuỗi đánh dấu không có trong `recordingDb`, giữ. Hai điều kế hoạch cần thêm:
1. `hashVerification` «như đã lưu» cho nguồn con trỏ cặp với `sourceHash: null` là một bit siêu dữ liệu mâu thuẫn (một giá trị `verified` không có hash). Đặt hằng (`self_declared`) cho nguồn con trỏ.
2. Không thêm luật cấm lấy nguồn con trỏ làm `basis` (trả lời câu hỏi 6 của kế hoạch): nhận định «tài liệu có bản mới chưa duyệt» là chính lý do thêm nguồn này và cần chính mã đó làm cơ sở. Không có cách cơ học phân biệt nhận định về sự tồn tại và nhận định về nội dung; ghi một ca eval (nhận định nêu nội dung của bản con trỏ) cho người duyệt đọc, không cho cổng bắt.

### S-8 [P3] U1 và điều kiện N2 trả lời được từ mã, không cần chờ

`bot-plugin/__init__.py:48-52`, `:188-210`, `:57-62`: gateway xếp 5xx và 404/408/429 vào hàng đợi, tính tối đa 5 lần trả lời hoặc 24 giờ; không có câu trả lời (kể cả hết `HOOK_TIMEOUT = 2` giây, ngắn hơn trần khoá 5 giây của trigger) thì giữ thứ tự và không tính. `/api/bridge` trả `500 INTERNAL_ERROR` cho `55P03` (`src/server/http.ts:13-14`), nên một `55P03` là một tin được thử lại, không phải một tin mất. Điều kiện N2 đổi thành «đã kiểm ở mã (nêu tệp:dòng); còn phải kiểm trên gateway chạy thật» vì dòng 64 của chính tệp đó ghi «Not verified against the running gateway».

### S-9 [P3] Chữ đúng cho L9 (R39) và câu hỏi (f)

R39 là một bản lưu chữ của nhóm không bật cờ commit sau phép kiểm theo dự án của `decide`. Nó thuộc lớp «kiểm rồi bên khác commit» về hình thức nhưng không về hậu quả: chữ đó mới hơn nháp nên không thể nằm trong nháp (`docs/DELIVERY-015-ai-drafts-read-and-stale-20261118.md:394`); cổng Codex vòng 3 đã đi qua với nó trong danh sách ghi nhận (`codex-context-round-3.md`, mục «Đã ghi nhận»). Với **cùng luồng**, từ PR này nó đóng bằng `LTZ03` (chỉ khác lý do được nêu: `SUBJECT_CHANGED` thay vì `PROJECT_TEXT_HIDDEN`). Tôi không đề nghị mở rộng phạm vi sang `PROJECT_TEXT_HIDDEN`: một khoá theo dự án gắn mọi luồng của dự án vào nhau và dựng lại khe bỏ đói của đo 7. Giữ L9 làm phần dư, nhưng sửa chữ: bỏ «nêu để cổng phán, không tự coi là đã được nhận» thành một câu về hậu quả (không ảnh hưởng độ mới của nháp) và dẫn precedent vòng 3.

---

## Trả lời cho bảy câu hỏi của kế hoạch (mục 19, phần bảo mật)

1. **Ranh giới «trigger đóng cuộc đua, dịch vụ giữ luật» (L6)?** Có, nhận. Lý do: trigger chỉ khẳng định điều CSDL biết chắc (số đếm theo thứ tự commit không đổi từ lúc dịch vụ đọc tới lúc ghi), và luật «mốc» phụ thuộc `ID_FIELDS`, `LATEST_REVISION_ORDER`, ngữ cảnh: chép sang PL/pgSQL tạo hai bản của một luật. Phiên SQL thô dưới login web trao được số hiện hành không phải rò: cần `SELECT` trên bảng đếm và `INSERT` trên bảng quyết định, cả hai trong phạm vi tự khai của RLS; không dữ liệu ra ngoài phạm vi; chặt hơn hôm nay. Chỉ cần ghi rõ cột không phải bằng chứng (S-6).
2. **L8 và L9 có thuộc lớp cổng Codex không nhận?** L9: không (S-9): hậu quả không chạm độ mới của nháp, đã có precedent vòng 3; cùng luồng đã đóng; không mở rộng sang `PROJECT_TEXT_HIDDEN`. L8: gần lớp đó, nên không giữ như phần dư bằng chữ. Cột «đánh số lúc nào» so với `created_at` của nháp **không** đóng được (nó là lúc ghi nháp, không phải lúc đọc ngữ cảnh); đóng bằng phép từ chối cơ học khi có phiên của role thành viên `libetech_ai` và một điều kiện vận hành (S-1, P2).
3. **Trigger `AFTER` thay `BEFORE`: còn đường nào để role ngoài phạm vi chạm khoá luồng?** Không tìm thấy. Đã thử và đo: `SELECT … FOR` ở bốn mức (planner, đo 5a: `42501`); gọi hàm (hàm trigger không gọi được trực tiếp; planner đo 5b: `42501`); chèn bản ngoài phạm vi, một dòng (m5: `42501`, 0 ms); `INSERT … VALUES` và `INSERT … SELECT` nhiều dòng trộn phạm vi (m1, m2, m6: `42501` sau 1 ms, trigger không chạy, không khoá); `COPY FROM` (m7: không được hỗ trợ với RLS); chèn bản trong phạm vi nhưng nguồn của dự án khác (m4: `23503`, không chạm khoá); chèn quyết định ngoài phạm vi (planner, đo 5e: `42501`, và `draft_decisions_guard` chạy `BEFORE` theo tên trước cả khoá dự án của 022). Chữ trong kế hoạch về dòng «được khoá trước» cần sửa (S-4).
4. **`messageRevisions` trong `SKILL_IDS` (P8): trường mã nào bị bỏ sót; số bản có thành kênh tới người không có quyền không?** Trường mã mới chỉ là `messageRevisions.*.id`, và bảng đã phủ nó với `kind:'source_event'`, `supports:false` (đường vào `notShown`, `SOURCE_OUT_OF_CONTEXT`, `TEXT_NOT_VISIBLE` có sẵn); ca canh «a clean output holds no context id at a path that is not listed» là phép kiểm của bảng. Trong pointer-only (`ctx.pointerOnly`), mục nào trong `messageRevisions` cũng chạm `notShown` (văn bản `null`): đóng, và nằm ngoài `result` nên `onlyEmptyLeaves` không phải chặn. Kênh tới người đọc không có quyền: không. `DraftView` trả `value` chỉ khi không lớp che nào giữ nháp và chỉ cho người có quyền quyết định (`suggestions.ts:104-107`, `:200`); `DECISION` không chọn `subject_thread_seq` (`suggestions.ts:85`); số bản là siêu dữ liệu mà người đó đọc được trong hộp tin. Số bản của tin bị ẩn/chỉ-con-trỏ đi tới **pipeline** trong ngữ cảnh: siêu dữ liệu, được phép theo `AGENTS.md:16`. Điều cần thêm không phải bảng mà là ai viết trường (S-2).
5. **C2 chặt hơn (từ chối lúc ghi)? L11 cho nêu tin không hiện chữ?** Không và không. Từ chối lúc ghi cần đọc luồng thật bằng role AI: cho `libetech_ai` quyền đọc Z1, trái tinh thần AR-03 và `docs/plans` của PR #22 (role AI chỉ ghi Z4); phép kiểm lúc xác nhận đã chặt đủ (fail-closed). Cho `messageRevisions` nêu tin không hiện chữ là ngoại lệ của luật `TEXT_NOT_VISIBLE`, biến trường thành đường nêu mã tin bị che; giữ giữ-oan L11 (nó tự hết khi có tin mới).
6. **Task 8 (OQ-57 1 (a)): nguồn con trỏ có lộ gì ngoài `latestRevisionId`; có cần cấm làm `basis`?** Ngoài `latestRevisionId`: chỉ `revisionNo` (và bit `hashVerification`, nên đặt hằng); không chữ, không danh sách, không hash nếu che ở SQL. Không cần cấm làm `basis` (S-7). Phương án này chấp nhận được về bảo mật.
7. **L5, kênh thời gian trong phạm vi?** Chấp nhận. Người quyết định đọc được hộp tin của dự án; role nhận tin chỉ chờ trên luồng nó được ghi. Ngoài phạm vi không có chờ: m1–m6 cùng đo 5d, 5e của planner. Một người dùng bị che (`maskedForCaller`) không bao giờ tới lệnh `INSERT` (`suggestions.ts:321-326` ném trước), nên không có kênh chờ cho họ.

---

## Câu hỏi (a)–(i) của ghế, từng điểm

(a) **Khoá dòng đếm theo luồng.** Ai lấy được: role nhận tin bằng một bản thật vào luồng nó được ghi; role runtime bằng một dòng `confirmed` hợp lệ cho nháp ứng viên có thật trong phạm vi nó khai (L4, cần thành công và giữ mở: S-4); không role nào bằng `SELECT … FOR`. Chờ/lộ: ngoài phạm vi không có (m1–m7). `COPY`: không hỗ trợ dưới RLS. Trong phạm vi: có chờ, chấp nhận (L5).

(b) **Ranh giới «trigger đóng cuộc đua, dịch vụ giữ luật».** Nhận (câu 1, S-6). Đã dò từng thứ tự: lệnh nhận tin đang bay rồi commit (so lệch → `LTZ03`); đang bay rồi rollback (so bằng → được); xác nhận trước (nhận tin chờ rồi nhận số kế tiếp, quyết định đã commit với số cũ). `last_seq` chỉ tăng khi commit nên `cur = position` ⇒ không commit nào chen vào. Một lệnh nhận tin chưa tới lệnh chèn bản chưa làm gì nhìn thấy được trước commit.

(c) **Hợp đồng `messageRevisions` và `SKILL_IDS`.** Đủ về trường mã (câu 4); điểm yếu nằm ở người viết (S-2).

(d) **Hàm `SECURITY DEFINER`.** `search_path = pg_catalog, pg_temp` với `pg_temp` đứng cuối, mọi đối tượng có tiền tố schema, `row_security = off`, `lock_timeout` ghim trong định nghĩa (đo 2h của planner: `55P03` sau 5 005 ms, `lock_timeout` của phiên trở lại), `REVOKE ALL … FROM PUBLIC` và không `GRANT EXECUTE`; hàm trigger không gọi trực tiếp được; không role nào có `TRIGGER` hay `EXECUTE` để tạo trigger khác dùng nó. Chủ hàm: P2 buộc 023 kiểm là superuser (tốt hơn 022 vốn không kiểm; nên có một ca đỏ cho nhánh từ chối). Không đường vòng tìm thấy. Lời `RAISE` của trigger nhận tin cần tĩnh, không id (S-5, ý 4).

(e) **Tệp lùi và áp lại.** Tệp lùi đúng mẫu 022 (không `CASCADE`, canh `to_regclass`, từ chối khi còn bản ghi sau hoặc còn dòng mang vị trí). Khe mở lại ở áp lại: S-1.

(f) **L9.** Không thuộc lớp (S-9).

(g) **Task 8.** S-7.

(h) **Ca kiểm.** S-5.

(i) **Các điều kế hoạch tuyên bố «không đổi».** Đã kiểm: `src/server/intake.ts` không cần đổi dòng nào (một lệnh `INSERT … ON CONFLICT DO NOTHING` một dòng; lần gửi lại không kích hoạt trigger; m1–m3 và đo 3a/3c), nhưng **hành vi** của `ingest` đổi (W3, W4, hàng đợi theo luồng, `55P03`): chữ «không đổi» chỉ đúng cho mã; role `libetech_intake` không thêm quyền nào (hàm definer ghi hai bảng, role không có `GRANT` trên chúng; `016:262-275` không đổi); `source_events` không trigger mới; hai ca canh `tests/source-text.test.ts:130` và `tests/skill-context.test.ts:360` còn đúng vì `source_revision_positions` không chứa chuỗi `source_event_revisions` và `skill-context.ts` chỉ chép `revisionNo` qua `visibleThreadMessages`; `libetech_runtime` thêm `SELECT` trên hai bảng và `INSERT(subject_thread_seq)`, kế hoạch đã nêu (§7 bước 5, 6, 10).

---

## Điều tôi đã thử mà không phá được

- Chèn nhiều dòng trộn phạm vi bằng `VALUES` và `INSERT … SELECT` khi luồng trong phạm vi đang bị giữ: lệnh hỏng ngay bằng RLS, trigger không chạy, không khoá (m1, m2, m6).
- `COPY FROM` dưới role chịu RLS: bị từ chối chung (m7).
- Bản trong phạm vi nhưng nguồn là tin của dự án khác: `23503`, không chạm khoá (m4).
- Giữ khoá luồng bằng một giao dịch đã lỗi: khoá nhả ngay (m8).
- Thứ tự khoá nhận tin, xác nhận, ghi ánh xạ, phân loại ứng viên: trên đường dịch vụ nhận tin giữ khoá tư vấn theo tin (`intake.ts:87`) rồi khoá luồng, không có `UPDATE projects` hay khoá mạnh hơn `KEY SHARE` nào sau đó; `inbox.ts:159,163` khoá `intake_candidates` (nhận tin không khoá hàng ứng viên: `ON CONFLICT DO NOTHING` và `SELECT` thường); xác nhận giữ `NO KEY UPDATE` trên dự án rồi khoá luồng. Không dựng được vòng chờ trên đường dịch vụ (khớp đo 4d, 8 của planner).
- Ba thứ tự giữa lệnh nhận tin và lệnh xác nhận (đang bay rồi commit, đang bay rồi rollback, xác nhận trước): luôn lệnh xác nhận bị từ chối hoặc nhận tin chờ; không có đường nào cho một bản commit sau phép đọc số mà vẫn để lệnh ghi đi qua.
- Một người bị che (`maskedForCaller` hoặc có lý do che): không tới lệnh `INSERT`, không chờ khoá luồng; `subject_thread_seq` không có trong cột nào `DraftView` trả.
- Hash của nội dung bị che: câu lệnh mới của `threadFreshness` chỉ trả đúng/sai và hai số dạng chữ; `visible_hash` không hề được chọn; `revisionNo` không suy từ nội dung.
- Một quyết định `rejected` mang vị trí, `confirmed` của nháp tài liệu mang vị trí: bị ràng buộc/`LTZ03` theo mô tả ở §7 bước 10–11.
- Mức `FOR NO KEY UPDATE` ở trigger quyết định: cùng mức với khoá mà `ON CONFLICT … DO UPDATE` của dòng đếm lấy (cột không thuộc khoá), nên hai chiều xếp hàng theo thứ tự đến; `FOR KEY SHARE` không đóng chiều nào (đo 4 của planner).
- Tệp lùi: không `CASCADE`, không `DROP ROLE`/`DROP SCHEMA`; từ chối trước khi mất vị trí đã ghi.
