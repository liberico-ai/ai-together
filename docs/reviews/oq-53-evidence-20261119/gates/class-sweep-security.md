VERDICT: READY_FOR_GATE

# Ghế bảo mật quét theo lớp lỗi, trước vòng 2 của cổng Codex · PR OQ-53

Ghế: bảo mật, quét THEO LỚP (không soát lại từng task). Đầu `235c89e`, gốc `80c1ad8`, nhánh `feat/oq-53-subject-verification`. Ba lớp: (1) kiểm-rồi-bên-khác-commit, (2) rò oracle (kể cả kênh chờ khoá và thời gian), (3) hash/độ dài/số bản/vị trí/chữ của nội dung bị che. Không sửa tệp nào của repo; mọi phép đo bằng SQL và script `tsx` đặt ngoài repo (`<scratch>/csec/`, tệp `p1.sql`, `e1.ts` … `e7.ts`, `proto*.sql`), trên PostgreSQL 16.15 trong container thử, CSDL riêng của ghế (023 áp qua harness; đã xoá cuối phiên). Báo cáo không chứa secret, chat ID thật, chuỗi kết nối hay đường dẫn máy.

Tổng: 0 P0 · 0 P1 · 1 P2 · 3 P3.

- Phần dư N22 (việc 1): **chỉ đặc quyền**. Không có phiên không đặc quyền nào (login runtime, web, intake, AI) tạo được «bản của luồng không có số» hay «bản commit sau phép kiểm mà không lấy khoá luồng» (mục 2, phép đo P1, E1). Nhưng đo được hai điều làm tôi không để nó ở dạng «ghi nhận» (CS-S-1): cửa sổ dựng lại được bằng hai kết nối thô, và có đường đóng rẻ, đã chạy thử.
- Lớp (1) trên toàn PR: không còn chỗ lọt cho phiên không đặc quyền; liệt kê 17 chỗ ở mục 3, mỗi chỗ nói cái gì buộc điều kiện tới commit.
- Lớp (2): lệnh xác nhận bị che không bao giờ chờ khoá luồng (đo 19–20 ms khi khoá đang bị giữ 2,5 s); một người đọc không có quyền quyết định thì không đọc bảng tin nào trước khi bị từ chối, nhưng **có chờ khoá tư vấn theo nháp** (CS-S-2).
- Lớp (3): không đường nào đưa hash, chữ hay độ dài của nội dung bị che tới người đọc, ngữ cảnh hay log; nguồn con trỏ của `release_librarian` đúng R10-g/OQ-57.

## 1 · Findings

| Mã | Mức | Lớp | Vị trí | Tóm tắt |
|---|---|---|---|---|
| CS-S-1 | P2 | 1 | `migrations/023_thread_order.sql:279-304`, `:31-34` (N22) | một bản không có số, do phiên bỏ qua trigger cấp số, commit giữa phép kiểm của trigger xác nhận và commit của quyết định: quyết định cũ lọt qua. Đặc quyền. Đóng được rẻ bằng một constraint trigger hoãn ở phía NGƯỜI GHI bản sửa |
| CS-S-2 | P3 | 2 | `src/server/suggestions.ts:273` so với `:288-291` | khoá tư vấn theo nháp lấy TRƯỚC phép kiểm quyền: người đọc không được quyết định chờ sau lệnh của điều phối, mà lệnh ấy có thể chờ khoá luồng tới 5 s |
| CS-S-3 | P3 | 1 | `src/server/db.ts:32`, điều kiện N1 | không có `idle_in_transaction_session_timeout` trong mã: một giao dịch xác nhận hay triage bị treo chặn nhận tin của luồng tới khi nào ai đó giết nó |
| CS-S-4 | P3 | 1 | `src/server/intake.ts:72` (không đổi trong PR) | một tin trả lời đến lúc tin gốc chưa commit thành luồng riêng; tiền đề «luồng đủ» của độ mới có lỗ hổng. Đã đo |

### CS-S-1 [P2, lớp 1] Phần dư N22 còn dựng lại được; đóng bằng người ghi, không bằng người kiểm

- Vị trí: `migrations/023_thread_order.sql:299-304` (phép kiểm «mọi bản của luồng có số» sau khoá), `:31-34` (N22 ghi «nêu, chưa đóng»), `:237-238` (trigger cấp số `CREATE OR REPLACE TRIGGER`, thực thi dạng `tgenabled='O'`).
- Lỗi: trigger xác nhận kiểm ở thời điểm T, quyết định commit ở T + đuôi giao dịch (hai câu lệnh còn lại `UPDATE document_commands`, `SELECT` view, rồi ghi commit: vài ms, 2,3–2,7 ms ở `DELIVERY-016` phần thời gian giữ khoá). Người ghi bản sửa không đi qua trigger cấp số không lấy khoá nào mà bên xác nhận giữ.
- Kịch bản (đã chạy, `e3.ts`, hai kết nối thô): C ghi dòng quyết định với vị trí đúng (qua trigger, giữ khoá dòng đếm), mở giao dịch; W (login vận hành) `SET LOCAL session_replication_role = replica`, chèn một bản sửa, commit; C commit. Kết quả: `{decisions:1, unnumbered:1, head:1, position:1}`, W xong TRƯỚC khi C commit, không bên nào lỗi. Cùng kết quả khi W thay `replica` bằng `ALTER TABLE … DISABLE TRIGGER source_event_revisions_thread_position` rồi bật lại.
- Cách ĐÓNG: mục 2 («Đánh giá cửa sổ còn lại»), phương án B. Tóm lại: thêm vào 023 một `CREATE CONSTRAINT TRIGGER … AFTER INSERT ON public.source_event_revisions DEFERRABLE INITIALLY DEFERRED`, `ENABLE ALWAYS`, hàm `SECURITY DEFINER` (cùng mẫu `search_path` ghim) kiểm «bản vừa chèn có dòng trong `source_revision_positions`» và `LTZ`-mã riêng nếu không; một dòng `DROP` trong tệp lùi; ca catalog (`tgenabled='A'`, `tgdeferrable`); N12 mở rộng. Đo trên bản thử: phiên `replica` và phiên `DISABLE TRIGGER` theo tên không commit được bản không số nữa; chỉ `DISABLE TRIGGER ALL` (chủ bảng, cố ý) còn qua.

### CS-S-2 [P3, lớp 2] Kênh thời gian: người đọc không có quyền quyết định chờ sau lệnh của điều phối

- Vị trí: `src/server/suggestions.ts:268-273` lấy `pg_advisory_xact_lock(DRAFT_DECISION_LOCK, hashtext(id))` rồi `:286-291` mới kiểm `mayDecide`. Chú thích `:287` nói «authority first: a person who may not decide learns nothing from the draft's state»; phép kiểm quyền (`:288-291`) đứng đầu trong lệnh gọi `claimDocumentCommand`, nhưng sau khoá, sau đọc dòng nháp và sau `INSERT INTO document_commands`.
- Lỗi: một người có vai đọc (engineer, technical, business) mà không phải điều phối gọi `decide(… 'confirmed')` trên nháp ứng viên của dự án mình. Nếu lúc đó một điều phối đang xác nhận cùng nháp và đang chờ khoá dòng đếm vì một tin đang nhận (≤ 5 s do 023), người đọc chờ đúng bấy lâu rồi nhận `MANAGER_REQUIRED`.
- Phép đo (`e2.ts`, ca 10 và ca 3): 2 013 ms so với 7 ms khi không có điều phối đang chờ. Thông tin lộ: «có người đang xác nhận nháp này, và luồng của nó có tin đang nhận». Người đọc đã đọc được hộp tin của dự án (như L5), nên P3; nhưng PR này kéo dài thời gian giữ khoá tư vấn từ mili-giây lên tới 5 s, và đó là một lời hứa của OQ-45 điểm 1.
- Cách ĐÓNG: đưa `entity_type` vào câu `located` (`:268`), tính `mayDecide(projectRole(p,projectId),entity_type)` NGAY SAU `READ_ROLES` (`:269`) và ném `READ_ONLY`/`MANAGER_REQUIRED` trước `pg_advisory_xact_lock`; giữ nguyên phép kiểm trong claim (lớp phòng thủ thứ hai). Giá: một người vừa mất vai và gửi lại lệnh cũ bị từ chối trước claim thay vì nhận bản ghi cũ (đúng với «authority first»; ghi vào hợp đồng). Ca mới: N-oracle, một điều phối giữ khoá luồng qua `inFlight`, một engineer gọi `decide` cùng nháp, trả lời không chờ (`waitForBlocked` đếm 1, không phải 2).

### CS-S-3 [P3, lớp 1, khả dụng] Giao dịch bị treo giữ khoá luồng; N1 mới là điều kiện triển khai, chưa là mã

- Vị trí: `src/server/db.ts:32` (`new Pool({… statement_timeout: 10000})`, không có `idle_in_transaction_session_timeout`); `docs/DELIVERY-016-…:166` (N1).
- Lỗi: PR biến một giao dịch nhàn rỗi thành thứ chặn nhận tin của luồng (mỗi lần thử `55P03` sau 5 s, N2) và, từ 022, chặn mọi lần ghi nháp AI của dự án (khoá dòng dự án). Giao dịch bị treo không chỉ do SQL thô: một tiến trình Node đứng (vòng lặp sự kiện bị chặn) giữ giao dịch mở mà CSDL không biết.
- Cách ĐÓNG: thêm `idle_in_transaction_session_timeout` (đề xuất 30 000 ms, theo N1) vào cấu hình pool ở `pooledDatabase` cho cả login web và login nhận tin, thay vì (hoặc cùng với) `ALTER ROLE` do vận hành đặt; tên tham số của `node-postgres` ghi #inference, cần kiểm một lần bằng `SHOW` trong ca. Giá: không.

### CS-S-4 [P3, lớp 1, mã không đổi trong PR] Tin trả lời đến lúc tin gốc chưa commit thành luồng riêng

- Vị trí: `src/server/intake.ts:72` (`SELECT thread_key … WHERE message_id = parent`, đọc dưới `READ COMMITTED`: chỉ thấy bản đã commit).
- Phép đo (`e6.ts`): giao dịch của tin gốc P dừng ngay sau `INSERT INTO source_events`; tin R trả lời P được nhận đầy đủ; rồi cho P đi tiếp. Kết quả: `m:1` và `m:2`, hai ứng viên, cả hai `replayed=false`. R thuộc luồng riêng.
- Hệ quả cho PR: «sau số n của luồng không còn bản nào» là về luồng như đã ghi; R không bao giờ làm một nháp về luồng của P bị giữ. Điều kiện cần: một phiên tự động trong nhóm trả lời trong vài chục ms sau tin gốc. Không rò dữ liệu, không leo quyền.
- Cách ĐÓNG (ngoài PR vì `intake.ts` nằm trong danh sách «không làm»): khoá tư vấn theo `(tenant, chat, message_id)` lấy cho chính tin ĐANG LƯU và, với tin trả lời, cho tin gốc TRƯỚC khi đọc `parent`; tin trả lời chờ tin gốc commit rồi thấy luồng của nó. Không có vòng chờ (tin chỉ trả lời tin có trước). Ghi thành OQ mới; trong biên nhận nêu thành giới hạn L-mới của «độ mới».

## 2 · Đánh giá cửa sổ còn lại (N22)

**Kết luận: đặc quyền-only; giống R19 về điều kiện tiên quyết; hẹp hơn R19 ở dạng tĩnh (đã đóng bằng `235c89e`); còn một dạng động; nên đóng thêm, bằng một constraint trigger hoãn ở phía người ghi (phương án B), không bằng kiểm lại ở phía quyết định.**

### 2.1 Phiên không đặc quyền: không có (đo)

| Phép đo | Kết quả |
|---|---|
| P1a: `SET session_replication_role = replica` dưới `libetech_intake`, `libetech_runtime`, `libetech_ai`, `libetech_web` | `permission denied to set parameter` bốn lần; `pg_parameter_acl` rỗng; `has_parameter_privilege(…,'SET')` = f cho cả chín role `libetech_*` |
| P1b: `ALTER TABLE … DISABLE TRIGGER` (theo tên và `ALL`) và `DROP TRIGGER` dưới `libetech_intake` | `must be owner` bốn lần |
| P1c: runtime: `FOR NO KEY UPDATE`, `FOR KEY SHARE`, `FOR SHARE`, `UPDATE`, `INSERT` trên `intake_thread_heads`; `LOCK` ROW SHARE, ROW EXCLUSIVE, SHARE ROW EXCLUSIVE | từ chối cả tám; chỉ `LOCK … ACCESS SHARE` được (R-S-6/d). Intake: `SELECT` hai bảng mới từ chối; `INSERT` vào bảng số từ chối; `LOCK source_event_revisions` ở SHARE ROW EXCLUSIVE và ROW EXCLUSIVE từ chối (chỉ có `INSERT` mức cột) |
| P1d: `EXECUTE` hai hàm definer; `CREATE` trên `public`, `intelligence` | PUBLIC, intake, runtime không có; mọi role ứng dụng không có `CREATE` ở hai schema |
| E1: dưới `libetech_intake`: chèn nhiều dòng một câu; `INSERT … SELECT … ON CONFLICT DO NOTHING` (một dòng gửi lại); savepoint rồi rollback; khối `DO` có `EXCEPTION`; `SET CONSTRAINTS ALL DEFERRED`; `lock_timeout` ngắn do phiên đặt | sau mỗi bước `unnumbered = 0` và số bản = số dòng số (4/4, 6/6, 6/6, 6/6, 7/7, 8/8). `lock_timeout = 50ms` của phiên bị bỏ qua: hàm đặt 5 s riêng (chờ 1 310 ms khi khoá bị giữ 1 500 ms) |

`COPY … FROM` chạy trigger hàng theo tài liệu PostgreSQL; không đo riêng (#inference).

Điều kiện đặc quyền, cho đủ: (i) superuser, hoặc chủ bảng (tệp 023 đòi login áp là superuser; mọi role ứng dụng không phải chủ bảng, đã đo); (ii) `SET session_replication_role`: superuser hoặc `GRANT SET ON PARAMETER` (không cấp cho ai); (iii) `pg_restore --disable-triggers` (superuser, ra `DISABLE TRIGGER ALL`).

### 2.2 Giống R19 không, và cổng Codex ở PR #22 đã đi qua loại này không

- R19 («guard có thể vắng mà dịch vụ không biết: lùi, tắt trigger, `session_replication_role = replica`, `pg_restore --disable-triggers`») nằm ở `docs/DELIVERY-015-ai-drafts-read-and-stale-20261118.md:410` như phần dư đã ghi và là điều kiện «trước khi bật Z4»; `docs/reviews/oq-45-46-evidence-20261118/codex-round-3.md` mở bằng `VERDICT: PASS` và không có finding. Điều kiện tiên quyết của N22 giống R19 từng chữ.
- Khác ở hai điểm. (a) Dạng tĩnh (bản không số đã nằm đó trước phép kiểm) là finding P1 của vòng 1 và đã đóng bằng `235c89e` (trigger nay từ chối); R19 thì chưa từng được đóng. (b) Còn lại dạng động: người ghi không số phải commit trong đúng đuôi giao dịch quyết định (vài ms). Hẹp hơn R19.
- Nhưng KHÔNG nên coi là «cổng sẽ nhận». Chính finding của vòng 1 là kịch bản đặc quyền («phiên phục hồi với `session_replication_role=replica`»), xếp P1, vì kế hoạch (D5) hứa «không bản nào trong luồng thiếu số». Dạng động của đúng kịch bản ấy là bước kế tiếp mà một người đọc cùng kiểu sẽ thấy. Bài học của PR #22 (lớp «kiểm-rồi-bên-khác-commit» không nhận phần dư đã ghi) áp ở đây.

### 2.3 Các cách đóng, đã thử

| Cách | Đo | Đóng được | Giá |
|---|---|---|---|
| **B. Constraint trigger hoãn trên bảng bản sửa**, kiểm «bản này có dòng số», `ENABLE ALWAYS` (`e3b.ts`, `proto.sql`) | phiên `replica`: W lỗi `LTZ04` lúc commit, `unnumbered=0`; `DISABLE` theo tên: W lỗi (55006 vì còn sự kiện hoãn khi bật lại cùng giao dịch; nếu không bật lại thì lỗi ở kiểm lúc commit, #inference), `unnumbered=0`; `DISABLE TRIGGER ALL`: vẫn qua (`unnumbered=1`) | mọi đường «bản không số commit được» trừ `DISABLE TRIGGER ALL` do chủ bảng; đóng cả dạng tĩnh lẫn dạng động; dung nạp một lần nạp lại nhất quán (bản và số cùng giao dịch, #inference) | một hàm definer, một trigger, một dòng trong tệp lùi, ca catalog, N12; không đo được chênh lệch thời gian: 20 000 bản trong một giao dịch 9 887 ms có và 9 871 ms không (lần hai 9 581 và 9 767); nạp lại phải `--single-transaction` (bộ cài đã vậy: `deploy/install-user.py:161`); hàng đợi sự kiện hoãn tốn bộ nhớ ở lần nạp hàng triệu dòng (#inference) |
| A. `ENABLE ALWAYS` trên trigger cấp số (`e3.ts`) | phiên `replica`: W chờ khoá, được đánh số, commit sau C: `{decisions:1, unnumbered:0, head:2, position:1}`; `DISABLE` theo tên: vẫn qua | chỉ đường `replica` | một dòng; phải đặt LẠI sau bước 9 (đo: `CREATE OR REPLACE TRIGGER` đưa `tgenabled` từ `A` về `O`); năm chỗ test dùng `replica` để dựng bản không số (`tests/suggestions.test.ts:1746,1941`, `tests/skill-context.test.ts:59`, `tests/thread-order-concurrency.test.ts:780`, `tests/thread-order.test.ts:1023`) phải đổi sang `DISABLE TRIGGER`; nạp lại dump nhất quán kiểu `replica` sẽ va `UNIQUE(revision_id)`. Không áp cho trigger của bảng quyết định: nạp lại quyết định cũ sẽ chạy phép so và bị `LTZ03` |
| C. Kiểm lại trong constraint trigger hoãn trên bảng QUYẾT ĐỊNH (ý của yêu cầu) (`e3c.ts`, `proto2.sql`) | W commit trước khi C bắt đầu commit: C bị `LTZ03`, `decisions=0`; W commit trong đuôi commit (đồ thế: một trigger hoãn đứng sau ngủ 1 s): C commit, `decisions=1, unnumbered=1` | **không**: dời cửa sổ từ «đuôi giao dịch» tới «đoạn giữa lần kiểm cuối và bản ghi commit» (ở thực tế là lần xả WAL) | — |
| D. Lệnh xác nhận giữ `LOCK TABLE source_event_revisions IN SHARE ROW EXCLUSIVE MODE` | không đo | mọi đường (`INSERT` luôn xin ROW EXCLUSIVE, kể cả khi trigger bị bỏ qua) | mọi nhận tin của mọi tenant chờ mọi lệnh xác nhận; cộng L4 (role runtime giữ được khoá bằng một dòng quyết định hợp lệ) thành chặn nhận tin toàn hệ thống từ một phiên điều phối (#inference). Loại |
| E. Số là cột của dòng bản sửa, giá trị mặc định là hàm cấp số | không đo | không còn trigger để tắt | `ALTER` một bảng nóng và viết lại 023. Không rẻ |

### 2.4 Khuyến nghị

Làm B trước cổng: nó đóng thật (người ghi không số không commit được), rẻ, và biến N22 từ «cửa sổ có ca ghim» thành «cần chủ bảng tắt cả hai trigger cố ý», là mức mà R19 đã được nhận. Nếu muốn chỉ một dòng: A cho trigger cấp số, kèm bốn hệ quả ở bảng trên. Dù chọn gì: (i) sửa N12 thành `tgenabled='A'` cho trigger đã đổi và nêu `DISABLE TRIGGER ALL` là phần dư; (ii) cập nhật chữ L7, L12 và đầu 023 (dòng `:31-34`) cho khớp; (iii) giữ N22 trong test nhưng đổi thành ca «không còn commit được». Trong mọi trường hợp, không đóng bằng kiểm lại ở phía quyết định (phương án C).

## 3 · Lớp (1): mọi chỗ «đọc/kiểm X rồi ghi giả định X còn đúng»

| # | Chỗ | X | Cái gì buộc X tới commit | Còn lọt? |
|---|---|---|---|---|
| 1 | `suggestions.ts:268-271` (`located`, `READ_ROLES`) | vai của người gọi | không (vai lấy từ `Principal` trong bộ nhớ) | có từ trước PR; không do CSDL ràng |
| 2 | `:273` | hai lệnh trên cùng một nháp | khoá tư vấn theo nháp | chỉ ràng hai lệnh `decide`, không ràng nhận tin: đúng ý |
| 3 | `:296` (`present`: bị che hay không) so với `:320-344` (dựng lại) | «nháp bị che cho người gọi» (bỏ so hash) | không | cửa sổ chỉ cho `REVISION_CONFLICT` (`:349`); đoán hash 256 bit không khả thi |
| 4 | `:320-325` ngữ cảnh và `checkSkillOutput`; `:328` `threadHasHiddenText` | tin nào hiện, chữ nào cho thấy | cùng luồng: số bản (`LTZ03`); cấu hình cờ nhóm: bộ nhớ tiến trình; nhãn `IBS_HI`: khoá dòng dự án của 022 ở lúc `INSERT` | tin có chữ ẩn ở luồng khác của dự án đến sau (L9): không ràng; không đổi nội dung nháp có trước nó |
| 5 | `:331` `subjectReasons` (`source-text.ts:135-168`) | luồng không đổi từ lúc đọc | khoá dòng đếm và phép so số, phép «mọi bản có số» (023 `:289-304`) | N22 (CS-S-1), đặc quyền |
| 6 | `:336` `projectHasHiddenText` | dự án không có chữ ẩn | nhãn: khoá 022; luồng khác: không ràng (L9) | như 4 |
| 7 | `:349` so `valueHash` | nháp không đổi | `ai_drafts_immutable` (021) | không |
| 8 | `:353` đề xuất bản tài liệu | dòng tài liệu | `FOR UPDATE` ở `:278` (và chỉ một nơi trong `src` ghi `document_revisions`: `documents.ts:169`) | không |
| 9 | `:360` `INSERT` quyết định | mọi điều trên | BEFORE: 021 (phạm vi), 022 (khoá dòng dự án, nhãn); AFTER: 023 | N22 |
| 10 | `:378-381` đọc lại và `present(…, known)` | trả lời mô tả trạng thái lúc kiểm (P13, L14) | sau lệnh ghi chỉ còn hai câu: `UPDATE document_commands`, `SELECT` view (đo `e5.ts`: không câu nào chạm bảng tin hay hai bảng số) | không; lập luận L14 đúng (nháp bất biến, nhãn bị khoá dòng dự án) |
| 11 | `skill-context.ts` (ngữ cảnh dựng ở `:185`, dùng lại ở `:283`, `:321`, `:381`) | ngữ cảnh là ảnh chụp trước lệnh ghi | như 4 | không |
| 12 | `intake.ts:72` đọc `parent` | tin gốc đã có luồng | không (READ COMMITTED chỉ thấy bản commit) | **có**: CS-S-4 |
| 13 | `intake.ts:70-71` đọc nhãn ánh xạ để chọn `content_mode` | dự án không phải `IBS_HI` | không | có từ PR #22 (R39 cùng họ); không do PR này |
| 14 | `intake.ts:87-90` số bản `max+1` | không ai khác sửa tin này | khoá tư vấn theo id tin | không |
| 15 | 023 bước 1, 8, 12 (kiểm login AI, nháp chưa quyết, trần số dòng) | các bảng không đổi dưới khoá | `LOCK … SHARE ROW EXCLUSIVE` hai bảng, lần kiểm login thứ hai sau `pg_stat_clear_snapshot()` | N10: một lần chạy pipeline đã đọc ngữ cảnh rồi ngắt kết nối; một login kết nối sau lần kiểm thứ hai chỉ thấy trạng thái cũ và không ghi nháp được (khoá `ai_drafts`) |
| 16 | tệp lùi | còn/không dòng quyết định mang vị trí | `ACCESS EXCLUSIVE` hai bảng trước phép kiểm (R-S-1 đã sửa), N18 | không |
| 17 | triage (`inbox.ts`) giữ dòng ứng viên | — | N17: tin vào luồng chờ triage, xác nhận chờ tin; không vòng | không |

Thứ tự khoá (đọc mã, có ca N11, N17, N19): quyết định: tư vấn(nháp), [dòng tài liệu], claim, dòng dự án (022 BEFORE), dòng đếm (023 AFTER). Nhận tin: tư vấn(tin), dòng đếm (trigger), rồi `FOR KEY SHARE` các dòng cha. `FOR KEY SHARE` của nhận tin không xung đột với `FOR NO KEY UPDATE` của 022: không có vòng chờ giữa hai đường. Ghi nháp AI và chèn ánh xạ chỉ lấy dòng dự án.

## 4 · Lớp (2): oracle, kể cả kênh chờ khoá và thời gian

Ma trận (`e2.ts`; khoá dòng đếm của luồng bị một giao dịch thô giữ 2 500 ms):

| Người gọi / ca | Thời gian | Trả lời |
|---|---|---|
| điều phối, nháp không bị che, xác nhận | 2 510 ms | xác nhận (chờ khoá, L5: người này đọc được hộp tin) |
| điều phối, từ chối | 20 ms | `rejected` (không chờ: N9) |
| engineer (vai đọc), xác nhận | 7 ms | `MANAGER_REQUIRED` (0 câu chạm bảng tin, đo `e7.ts`) |
| người ngoài phạm vi, xác nhận | 4 ms | `SCOPE_DENIED` 404, cùng chữ với «không có» |
| điều phối, nhóm hết cờ (bị che) | 20 ms | `DRAFT_HELD`, chỉ mã che (`PROJECT_TEXT_HIDDEN`, `TEXT_NOT_VISIBLE`, `THREAD_TEXT_HIDDEN`), không `SUBJECT_*` |
| điều phối, dự án `IBS_HI` (bị che) | 19 ms | `DRAFT_HELD`, chỉ mã che, không `SUBJECT_*` |
| điều phối, hash sai | 12 ms | `REVISION_CONFLICT` (trước lệnh ghi) |
| điều phối, nháp không nêu tin (`SUBJECT_BASELINE_MISSING`) | 18 ms | `DRAFT_HELD` |
| `list`: engineer / điều phối | 5 ms / 10 ms | không chờ |
| engineer xác nhận CÙNG nháp khi điều phối đang chờ khoá luồng | **2 013 ms** | `MANAGER_REQUIRED` (CS-S-2) |

Trả lời câu hỏi riêng. Lệnh xác nhận bị che **không bao giờ chờ khoá luồng**: nó ném `DRAFT_HELD` ở `suggestions.ts:338-344` trước lệnh ghi; `e7.ts` đếm 21 câu cho điều phối bị che (5 câu chạm bảng tin, 0 `INSERT` quyết định) và một khoá tư vấn. Nó **có đọc bảng tin** (năm câu: ngữ cảnh, hai câu chữ-ẩn, độ mới, chữ-ẩn dự án) trước khi bị giữ, vì quyền quyết định của họ đã qua; các câu này là đọc thuần, không chờ khoá. Người **không có quyền quyết định** thì không đọc bảng tin nào trước khi bị từ chối (8 câu, 0 chạm bảng tin) nhưng đã lấy khoá tư vấn và đã chèn một dòng claim (rollback) trước phép kiểm quyền: CS-S-2.

Các oracle khác đã soi và không còn: (a) mã lỗi trigger. `LTZ03` một câu cố định cho mọi nguyên nhân; dòng `CONTEXT` của PostgreSQL đổi theo nguyên nhân nhưng lớp HTTP không chuyển văn bản CSDL (`src/server/http.ts:9-15`: lỗi không phải `AppError` thành `INTERNAL_ERROR` 500, log chỉ có tên kiểu lỗi); N8 vẫn là điều kiện cho tuyến đầu tiên. (b) role ngoài phạm vi: 42501/P0001 trước mọi khoá (A5, B4, B8, N10, N20, N21 đã có; tôi đọc lại thứ tự trigger: BEFORE 021, 022, WITH CHECK, rồi AFTER 023). (c) người chờ ở phía nhận tin: gateway tin cậy, không có kênh tới người ngoài; một thành viên nhóm chỉ thấy biên nhận chậm vài ms (#inference, không đo). (d) `LTZ03` đến sau khi nháp vừa bị che giữa hai phép: chỉ dựng được bằng cuộc đua, người gọi là điều phối đọc được luồng.

## 5 · Lớp (3): hash, độ dài, số bản, vị trí, chữ của nội dung bị che

- `threadFreshness` (`source-text.ts:135-168`) trả ba boolean và hai số dạng chuỗi (`baseline`, `head`): không chữ, không hash. `position` đi vào `INSERT … subject_thread_seq`, không vào `DraftView`, không vào lỗi, không vào log (`grep -n 'console\.\|logger'` ở `suggestions.ts`, `source-text.ts`, `skill-context.ts`, `skill-contracts.ts`, `document-commands.ts`: 0 dòng).
- `visibleThreadMessages` trả `revision_no` cho mọi chế độ hiển thị (`source-text.ts:63-75`; `skill-context.ts:58`). Số bản không phải chữ; Chairman đã chọn «số bản, không hash» (C1). Với dự án `IBS_HI` (chỉ con trỏ) nó đưa cho mô hình số lần một tin bị sửa: siêu dữ liệu, cùng hạng với `observedAt`. Nếu sau này coi số lần sửa của tin `IBS_HI` là nội dung, chỉ cần một cột trong một câu (`skill-context.ts:58`).
- Nguồn con trỏ của `release_librarian`: mọi trường nội dung bị cắt trong câu lệnh (`skill-context.ts:78-93`: `CASE WHEN m.hide … m.pointer`); `WHERE` và `ORDER BY` chỉ dùng `id`, `revision_no`, `approved_revision_id`. `tests/skill-context.test.ts` chạy native trên CSDL riêng: 23 đạt, gồm hai ca R10-g/con trỏ khẳng định chuỗi đánh dấu và hash của bản chưa duyệt không có trong `JSON.stringify(context)` lẫn trong các dòng đã được trao cho dịch vụ (tôi đọc câu lệnh và chạy lại tệp; không viết ca mới).
- Lệnh `DRAFT_HELD` khi bị che chỉ nêu mã che (đo ở mục 4, ca bốn và năm). Không `SUBJECT_*` đi cùng mã che.
- `EXPLAIN` trong hồ sơ bằng chứng (`logs/codex-fix1-explain.txt`, 200 dòng): ID tổng hợp, 0 chuỗi hash 64 ký tự, 0 chữ `text_excerpt`.
- Hồ sơ công khai: quét `git diff 80c1ad8..235c89e` (374 tệp) tìm đường dẫn máy, chat ID khác bản mẫu `-100000000000x`, mật khẩu, chuỗi kết nối, token: 0 dòng khớp (hai dòng «xoxb-» là mẫu của ca che bí mật).
- `messageRevisions`: lời khai của mô hình (SV-S-1/N6, đã có). Một điểm bổ sung: `skill-contracts.ts:204` (`notShown`) bắt mọi id trong mọi trường, kể cả `messageRevisions`, nên nháp nêu một tin hiện chữ bị ẩn bị `TEXT_NOT_VISIBLE` (mã che), không phải `SUBJECT_*`: số bản của tin bị che không đi ra qua đường này.

## 6 · Đã thử mà không phá được

1. Mọi đường không đặc quyền tới «bản không số» (mục 2.1, P1a–d, E1: tám dạng câu lệnh, bốn role).
2. Lệnh xác nhận bị che chờ khoá luồng (E2, ca năm và sáu; E7).
3. Người không có quyền quyết định đọc bảng tin trước khi bị từ chối (E7: 0).
4. Lệnh xác nhận đọc bảng tin sau lệnh ghi (E5: hai câu, không chạm bảng tin).
5. `SET CONSTRAINTS ALL DEFERRED` làm trì hoãn trigger cấp số (không: nó không phải constraint trigger; vẫn đánh số, E1).
6. `lock_timeout` ngắn của phiên rút ngắn khoá của trigger (không: hàm đặt 5 s; đo 50 ms của phiên chờ 1 310 ms).
7. Vòng chờ giữa nhận tin, triage, ánh xạ và xác nhận (đọc thứ tự khoá, mục 3; không dựng được vòng; ca N11, N17, N19 đã xanh: chạy lại `tests/thread-order-concurrency.test.ts` native, 27 đạt).
8. Role runtime lấy khoá dòng đếm không qua dòng quyết định hợp lệ (P1c).
9. Rò qua tên hàm/`search_path` trong hai hàm definer: mọi tên bảng có tiền tố schema, `search_path = pg_catalog, pg_temp`; toán tử không tìm trong `pg_temp` (#inference theo tài liệu PostgreSQL).
10. Gửi lại tin (`ON CONFLICT DO NOTHING`) lấy khoá hay đốt số (không: N16; E1 ca `INSERT … SELECT … ON CONFLICT` đúng 2 bản mới trong 3 dòng).

## 7 · Ba việc đòn bẩy cao nhất

1. **CS-S-1, phương án B** trước khi vào cổng: đưa N22 từ «cửa sổ ghi nhận» về «cần chủ bảng tắt cả hai trigger», rẻ và đã đo.
2. **CS-S-2**: kiểm quyền trước khoá tư vấn (một câu `located` mở rộng và một dòng ném), để lời hứa «người không được quyết định không học được gì từ trạng thái nháp» đúng cả với thời gian.
3. **CS-S-3 và CS-S-4**: `idle_in_transaction_session_timeout` ở pool (một dòng) và một mục OQ cho khoá tin gốc ở `intake.ts` (ngoài PR); ghi cả hai vào biên nhận thay cho «điều kiện N1» chỉ bằng chữ.
