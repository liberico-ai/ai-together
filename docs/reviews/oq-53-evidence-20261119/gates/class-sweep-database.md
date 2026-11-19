VERDICT: CHANGES_REQUIRED

# Quét theo lớp lỗi (CSDL) trước vòng 2 của cổng Codex · OQ-53

Đối tượng: nhánh `feat/oq-53-subject-verification`, đầu `235c89e` (gốc `80c1ad8`): `migrations/023_thread_order.sql`, `migrations/rollback/023_thread_order.sql`, các truy vấn đổi ở `src/server/source-text.ts`, `src/server/suggestions.ts`, `src/server/skill-context.ts`, và các ca N22, N23 của `tests/thread-order-concurrency.test.ts`. Ghế: review CSDL, quét theo lớp, ghế mới, độc lập; khuyến nghị (R1/R2). Ngày 19/11/2026. Lớp quét: (1) kiểm rồi bên khác commit; (2) thứ tự khoá, deadlock, bỏ đói, kết quả cũ; (3) oracle và thời gian.

| Mức | Số finding |
|---|---|
| P0 | 0 |
| P1 | 1 (CS-DB-1) |
| P2 | 1 (CS-DB-2) |
| P3 | 3 (CS-DB-3, CS-DB-4, CS-DB-5) |

Một câu: N22 **không đóng được bằng một cơ chế mà người ghi bản không số không né được** nếu không khoá cả bảng bản sửa (đo: đóng kín, nhưng một phiên raw của role runtime chặn nhận tin của mọi dự án) — nhưng hai thứ gần như không tốn (`ENABLE ALWAYS` trên trigger cấp số, và phép kiểm «trigger cấp số còn bật» trong trigger xác nhận) đóng đúng kịch bản mà cổng Codex nêu (`session_replication_role = replica`, trigger bị tắt/vắng đã commit), và phần còn lại thu về một việc duy nhất: chủ bảng tự chạy DDL lên chính trigger cấp số trong cùng giao dịch với lệnh ghi, cùng ranh giới tin cậy với R19/R37 của PR #22. Vì N22 là đúng lớp mà cổng không nhận «phần dư đã ghi», nên tôi coi phần đóng rẻ ấy là điều kiện trước vòng 2 (CS-DB-1, P1). Quét lớp ở phần còn lại của PR không tìm thêm lỗ «kiểm rồi bên khác commit» nào ở tầng CSDL; tìm thấy một đường phục hồi đã hỏng thật (CS-DB-2) và một thứ tự khoá đảo ở đường áp lại 023 mà dịch vụ chạy đúng chỉ nhờ thứ tự đọc có sẵn (CS-DB-3).

## 0 · Cách làm và giới hạn

- CSDL riêng `slice1_verify_5311198` (PostgreSQL 16.15, container thử của phiên), migration 001–023 áp bằng harness của repo một lần (`tests/thread-order.test.ts` 31/31), rồi probe bằng node + `pg` và `psql`. Mọi DDL thử nghiệm (trigger hoãn, `ENABLE ALWAYS`, khoá bảng, khoá ngoại hoãn, biến thể hàm guard) chạy **chỉ trong CSDL này**, từ các tệp SQL trong `<scratch>/cs8/`, và được trả về nguyên trạng sau mỗi thử (kiểm lại trước lần chạy test cuối: trigger của hai bảng đều `tgenabled='O'`, hàm guard là bản của `235c89e`, không khoá ngoại thử, không trigger `zz_*`); lần cuối, để chạy bốn tệp test trên bản vá, tôi áp bản 023 **đã vá** (bản sao ngoài repo) lên chính CSDL này. Không áp migration lên CSDL khác, không tạo hay đổi role, mật khẩu, quyền. CSDL được `DROP` ở cuối (kiểm lại: không còn).
- Sửa migration/tệp chỉ trên bản sao `git archive 235c89e` đặt ngoài repo (`<scratch>/cs8/copy/`, `node_modules` là liên kết tới worktree); `git status` của worktree: chỉ có tệp báo cáo này và tệp của ghế bảo mật.
- Nhãn: **[đo]** = tôi đo ở phiên này; **[mã]** = đọc từ tệp, có `tệp:dòng`; **#inference** = chưa kiểm.
- Máy dùng chung, tải 0,9–1,5; số thời gian là cỡ độ lớn. Mỗi lần chạy vitest tôi chờ `pgrep -f '[v]itest' | wc -l` = 0 (một lần bị ghế bảo mật chiếm chỗ lâu; hàng chờ của tôi bị huỷ rồi chạy lại khi trống). Các thử bằng node (máy dò 20 s, quét cửa sổ) không phải vitest và chạy trên CSDL riêng của tôi, có lúc song song với vitest của ghế kia trên CSDL của họ: số thời gian chịu ảnh hưởng, kết luận «0 `40P01`, 0 xác nhận cũ» thì không.
- Không phủ (#inference): SERIALIZABLE ngoài `LTZ02`/`40001` đã có ca; pooler ở chế độ transaction; dữ liệu thật; gateway chạy thật; PGlite (PostgreSQL 18.6) cho các thử khoá (chỉ native).

## 1 · Finding

| Mã | Mức | Lớp | Vị trí | Tóm tắt |
|---|---|---|---|---|
| CS-DB-1 | P1 | 1 | `023_thread_order.sql:31-34`, `:237-238`, `:299-304`; `tests/thread-order-concurrency.test.ts:779-783`, `:820-835` (N22) | Cửa sổ N22 còn mở cho đúng kịch bản của vòng 1: phiên `session_replication_role = replica` ghi bản không số giữa phép kiểm của trigger xác nhận và commit của quyết định. Đóng rẻ được: `ENABLE ALWAYS` + phép kiểm catalog |
| CS-DB-2 | P2 | 1, 2 | `deploy/install-d1.sh:43`; `023_thread_order.sql:258-310`; plan mục 16 N4 | Phục hồi data-only (cờ của bộ cài) một CSDL có quyết định xác nhận ứng viên **hỏng** (đo; N4 từ #inference thành #fact); `--disable-triggers` chạy được nhưng hạ `ENABLE ALWAYS` về `O` |
| CS-DB-3 | P3 | 2 | `023_thread_order.sql:105-106`, `:125`, `:244`; `:289-291` | Áp lại 023 giữ khoá `heads` (bước 2) trước khoá `draft_decisions` (bước 10); một lệnh xác nhận raw không đọc `heads` trước thì deadlock `40P01` (đo, 3/3); dịch vụ (`decide`) không dính vì luôn đọc `heads` trước |
| CS-DB-4 | P3 | 2 | `023_thread_order.sql:258-260`, `:299-304` | Sau lần thực thi thứ 5 trong một backend, plan của phép kiểm bản thiếu số chuyển sang plan chung: +20–25 % thời gian giữ khoá dòng đếm (đo); một thuộc tính hàm sửa được |
| CS-DB-5 | P3 | 3 | `023_thread_order.sql:149-170` (hai bảng mới) | `EXPLAIN (ANALYZE)` dưới role runtime cho `Rows Removed by Filter` = số dòng ngoài phạm vi của hai bảng mới (đo). Không mới về loại (mọi bảng RLS của repo như vậy); ghi để biên nhận không nói «không có kênh» |

### CS-DB-1 · P1 · Lớp 1 · N22: bản không số commit sau phép kiểm của trigger và trước commit của quyết định

**Vị trí.** Chú thích đầu 023 `:31-34` (giới hạn đã ghi); `:237-238` (trigger cấp số tạo ở trạng thái `O`, origin); `:299-304` (phép kiểm bản thiếu số, một câu lệnh, ảnh chụp lấy lúc câu bắt đầu); `tests/thread-order-concurrency.test.ts:779-783` (`writeWithoutNumber`: `SET LOCAL session_replication_role = replica`), `:820-835` (N22: ca ghim giới hạn là «giới hạn, không phải bảo đảm»).

**Lỗi.** Trigger xác nhận khoá dòng đếm rồi so và quét bản thiếu số, nhưng người ghi bản không số **không lấy khoá nào mà lệnh xác nhận giữ**: trigger cấp số, cái duy nhất lấy dòng đếm, là cái nó bỏ qua. Nên một bản không số có thể commit giữa phép quét và commit của quyết định, và quyết định `confirmed` vẫn được lưu với một luồng đã có bản mới.

**Kịch bản (dựng lại, [đo]).** Phiên A (role runtime): `INSERT` quyết định xác nhận với đúng vị trí → trigger qua; A để mở giao dịch. Phiên B: `BEGIN; SET LOCAL session_replication_role = replica; INSERT` một bản sửa vào tin gốc của luồng; `COMMIT`: **1,8 ms, không chờ**. A commit. Kết quả: 1 quyết định `confirmed`, 1 bản của luồng không có số. Đây đúng kịch bản của vòng 1; bản vá `235c89e` đóng dạng bền của nó (bản không số có từ trước), không đóng dạng đua.

**Ai ghi được bản không số** [đo]: không role ứng dụng nào. Cả chín role `libetech_*` có `has_parameter_privilege(…, 'session_replication_role', 'SET') = false` (`SET` thật: `permission denied to set parameter "session_replication_role"`), không role nào có `CREATE` trên schema `public`, không có `BYPASSRLS`; chủ cả hai bảng là login migration (superuser). Vậy người ghi là superuser, chủ bảng, hoặc ai được `GRANT SET ON PARAMETER`: phiên phục hồi, phiên áp bản sao logic, DBA.

**Độ rộng của cửa sổ** [đo, quét 12 lần mỗi mốc, thời gian của bản không số lệch so với lúc `INSERT` quyết định được gửi; «hỏng» = quyết định commit và bản không số đã commit trước khi lệnh `COMMIT` của quyết định được gửi]: với phần đuôi 2,5 ms sau lệnh ghi (số của review dịch vụ: 2,3–2,7 ms, `review-service-database.md` mục 0): hỏng ở mọi mốc từ +0,25 ms tới +2,5 ms (12/12 mỗi mốc), hết ở +2,75 ms. Tức cửa sổ ≈ 0,1 → 2,6 ms. Không có phần đuôi: ≈ 0,15 ms. Phép quét nằm trong cửa sổ (0,05 ms ở luồng 30 tin, 0,47 ms ở 3 000 tin trong CSDL nhỏ; 1,5–3,3 ms trong CSDL 150 luồng nhiễu; số của builder ở 63 000 tin: cả hàm 3,7–4,0 ms, `logs/codex-fix1-explain.txt`).

**Cách ĐÓNG** (hai thay đổi nhỏ, một ghi chú vận hành; mỗi thứ đã đo trên PostgreSQL 16.15):

1. **`ENABLE ALWAYS` trên trigger cấp số**, đặt ngay sau `CREATE OR REPLACE TRIGGER` của bước 9 (lệnh `CREATE OR REPLACE` đặt lại trạng thái về `O`: đo; nên `ENABLE ALWAYS` phải đứng sau nó):
   ```sql
   ALTER TABLE public.source_event_revisions ENABLE ALWAYS TRIGGER source_event_revisions_thread_position;
   ```
   Đo: với `ALWAYS`, phiên `replica` của B **bị trigger cấp số chạy**, lấy khoá dòng đếm và **chờ lệnh xác nhận** (406 ms cho tới khi A commit), rồi nhận số 4 và commit **sau** quyết định; luồng có 0 bản không số, `last_seq` = 4. Không tốn thêm câu lệnh nào ở đường nhận tin. Đóng đường `replica` hoàn toàn (không còn cửa sổ: bản có số giữ khoá tới commit).
2. **Phép kiểm catalog trong trigger xác nhận**, thêm vào sau phép quét, trước `RETURN NULL` (`:305`):
   ```sql
   IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger g WHERE g.tgrelid = 'public.source_event_revisions'::pg_catalog.regclass
                   AND g.tgname = 'source_event_revisions_thread_position' AND g.tgenabled IN ('O','A') AND NOT g.tgisinternal) THEN
     RAISE EXCEPTION 'The thread of the candidate moved on' USING ERRCODE = 'LTZ03';
   END IF;
   ```
   Đo: lệnh xác nhận **bị từ chối `LTZ03`** khi trigger cấp số đã bị `DISABLE TRIGGER` theo tên, `DISABLE TRIGGER ALL` (trạng thái mà `pg_restore --disable-triggers` để lại), hoặc đã bị bỏ; **qua** khi `O` hoặc `A`. Chi phí 0,004 ms. Không đổi câu trả lời (cùng mã, cùng câu cố định). Đóng phần «tắt/vắng đã commit»: trong thời gian trigger tắt, không lệnh xác nhận nào đi qua, nên bản không số ghi trong thời gian ấy không còn cửa sổ nào để chen.
3. **Quy tắc cho phiên bảo trì cố ý ghi bản không số** (ghi vào đầu 023 và điều kiện N15): lấy trước `SELECT 1 FROM public.intake_thread_heads WHERE … FOR UPDATE` của luồng nó sắp ghi và giữ tới commit. Đo cả hai thứ tự: lệnh xác nhận giữ trước → phiên bảo trì chờ (300 ms đã chờ), ghi bản **sau** quyết định; phiên bảo trì giữ trước và đã ghi → lệnh xác nhận chờ rồi bị `LTZ03` (đúng mẫu của N23). Đóng kín cho phiên làm theo quy tắc.

**Phần còn lại sau ba thứ trên, nói thẳng.** Một phiên của chủ bảng/superuser, trong **một giao dịch**, tự chạy `ALTER TABLE … DISABLE TRIGGER` (hoặc `DROP TRIGGER`, hoặc `CREATE OR REPLACE FUNCTION` đổi thân hàm cấp số), ghi bản không số, bật lại, commit, và việc commit rơi vào khe giữa phép kiểm của lệnh xác nhận và commit của nó, **mà không lấy khoá dòng đếm** (quy tắc 3). Đó không còn là «một phiên bỏ qua trigger» (phục hồi, replica) mà là DDL tường minh lên chính cơ chế, và cùng bàn tay đó tắt được cả trigger quyết định. Cùng loại với R19/R37 của PR #22 (`docs/DELIVERY-015-ai-drafts-read-and-stale-20261118.md:410`: «tắt trigger, `session_replication_role = replica`, `pg_restore --disable-triggers` … cần superuser hoặc chủ bảng»), nằm trong danh sách «Đã ghi nhận» (kế hoạch R1–R39) của ngữ cảnh gửi cổng, `docs/reviews/oq-45-46-evidence-20261118/codex-context-round-3.md:35`, mà cổng Codex vòng 3 của PR #22 trả `PASS` (`codex-round-3.md:1`). Đề nghị biên nhận nêu đúng phần này (một câu), không nêu «bản không số commit trong khe» chung chung. Phép kiểm trigger bật dùng `tgenabled` đọc ở ảnh chụp của câu lệnh; DDL tắt trigger chưa commit thì không thấy: đó chính là phần còn lại này.

**Ảnh hưởng của bản vá lên test** [đo: bản sao `git archive 235c89e` ngoài repo, 023 đã vá hai chỗ trên, CSDL ở đúng trạng thái đã vá (`tgenabled='A'`, hàm guard mới) trước khi chạy; native 16.15]:

| Tệp | Kết quả | Ca đỏ và vì sao |
|---|---|---|
| `tests/thread-order.test.ts` | 29/31 | A6 (`:263`, mong `tgenabled:'O'`) và A7b (`:344`, mong `'O'` sau lần áp lại): đổi kỳ vọng thành `'A'`. Móc `restoreGuards` (`:32-33`) coi mọi `tgenabled <> 'O'` là «đã bị tắt» và `ENABLE TRIGGER` (đặt về `O`) ở đầu và cuối **mỗi** ca: phải đổi thành `NOT IN ('O','A')`, nếu không cả tệp chạy với trigger `O` |
| `tests/thread-order-concurrency.test.ts` | 25/27 | N23 (10,4 s) và N22 (5,3 s): cả hai dựng bản không số bằng `writeWithoutNumber` (`:779-783`, `replica`); với `ALWAYS` phiên đó bị trigger cấp số chờ khoá dòng đếm của lệnh xác nhận đang mở (chính hành vi mong muốn). Viết lại bằng `DISABLE TRIGGER` trong cùng giao dịch cho N23; N22 đổi thành ca ghim phần còn lại (DDL trong cùng giao dịch) cùng một ca mới «phiên `replica` bị chờ rồi được đánh số» |
| `tests/source-text.test.ts` | 41/41 | không ca đỏ |
| `tests/skill-context.test.ts` | 23/23 | không ca đỏ |
| `tests/suggestions.test.ts` | 122/122 | không ca đỏ (các ca dựng bản không số bằng `replica`, `:1746`, `:1941`, vẫn xanh; #inference, chưa kiểm cơ chế: bản nay có số nên luồng bị giữ bằng luật 3 (`last_seq` đổi), không bằng luật 4, tức các ca ấy không còn kiểm luật 4; nên chuyển chúng sang `DISABLE TRIGGER` để luật 4 còn ca đỏ-xanh) |

Tổng: 4 ca phải sửa kỳ vọng hoặc cách dựng, một móc, và ba ca nên đổi cách dựng để giữ độ phủ luật 4. Không chạy: `tests/migrations-rollback.test.ts`, `tests/z4-schema.test.ts`, `tests/z4-pointer-guard.test.ts`, `tests/rls-catalog.test.ts` (#inference: không đụng `tgenabled`).

### CS-DB-2 · P2 · Lớp 1, 2 · Phục hồi data-only hỏng vì trigger xác nhận chạy lại trên dòng lịch sử

**Vị trí.** `deploy/install-d1.sh:43`: `pg_restore --exit-on-error --single-transaction --data-only --no-owner`. `023_thread_order.sql:258-310` (trigger `AFTER INSERT` so với trạng thái **hiện tại**). Điều kiện N4 (`docs/plans/oq-53-subject-verification.md`, mục 16) viết «#inference, chưa ai chạy».

**Lỗi và kịch bản [đo].** Dump `-Fc --data-only` của tám bảng (dự án, tin, bản, bảng số, dòng đếm, ứng viên, nháp, quyết định) từ một CSDL có một quyết định xác nhận ứng viên mà luồng sau đó đã đi tiếp; xoá bảng; nạp lại **với cờ của bộ cài**: `pg_restore: error: COPY failed for table "draft_decisions": ERROR: The thread of the candidate moved on` (`where`: `draft_decisions_subject_order_guard() line 27`: ứng viên chưa được nạp, hoặc vị trí lệch). Giao dịch đơn nên rollback sạch, nhưng bộ cài thất bại. Trigger so sánh với trạng thái hiện tại nên không chạy lại được trên dòng lịch sử; với thứ tự nạp khác (ứng viên trước quyết định) dữ liệu này vẫn lệch ở dòng 35 của hàm vì vị trí 3 còn `last_seq` 4 (#inference, không dựng). Ba lần lặp (có và không có khoá ngoại thử): cùng kết quả.
Với `--disable-triggers`: nạp xong, 4 bản / 4 số / 1 dòng đếm, 0 bản không số. Nhưng pg_restore đặt lại bằng `ENABLE TRIGGER ALL`, nên **`tgenabled` quay về `O`** dù trước đó là `A` (đo: `A` → `O`); sau phục hồi đường `replica` của CS-DB-1 mở lại âm thầm.

**Cách ĐÓNG.** (1) Bộ cài dùng `--disable-triggers` (nó chạy bằng superuser) và, ngay sau lần nạp, chạy lại câu `ENABLE ALWAYS` của bước 9 (hoặc áp lại 023, đã đo là chạy lại được); (2) ca kiểm native «diễn tập phục hồi»: `pg_dump`/`pg_restore` với đúng cờ của bộ cài trên dữ liệu có một quyết định xác nhận mà luồng đã đi tiếp, rồi câu catalog khẳng định `tgenabled='A'`; (3) cập nhật N4 từ «#inference» sang «#fact: hỏng; cần `--disable-triggers`». Việc này không chặn vòng 2 vì không có dữ liệu hậu-023 để phục hồi hôm nay, nhưng chặn lần áp 023 đầu tiên lên dữ liệu mà bộ cài sẽ phải khôi phục (R-05, kế hoạch hoàn tác).

### CS-DB-3 · P3 · Lớp 2 · Áp lại 023 đảo thứ tự khoá so với lệnh xác nhận raw

**Vị trí.** `023_thread_order.sql:125` (bước 2, `DROP TRIGGER IF EXISTS … ON public.intake_thread_heads`: `ACCESS EXCLUSIVE` lên bảng dòng đếm, giữ tới commit ở lần áp lại), `:244` (bước 10: `ACCESS EXCLUSIVE` lên `draft_decisions`); trigger xác nhận `:289-291` (`ROW SHARE` lên `intake_thread_heads`, **sau** khi `INSERT` đã giữ `ROW EXCLUSIVE` lên `draft_decisions`).

**Lỗi và kịch bản [đo].** Lần áp lại lấy `heads` (bước 2) rồi `draft_decisions` (bước 10); một lệnh xác nhận lấy `draft_decisions` rồi `heads`. Nếu lệnh xác nhận bắt đầu `INSERT` trong khe giữa hai bước và chưa từng chạm `heads` trong giao dịch của nó: vòng chờ. Dựng bằng một giao dịch đọc `heads` giữ lần áp lại chờ ở bước 2 (khoá `SHARE ROW EXCLUSIVE` bảng bản sửa đã lấy ở bước 1): lệnh xác nhận raw bị `40P01 deadlock detected` sau 1,02 s, lần áp lại xong sau 1,44 s; 3/3 lần. Với **dịch vụ**: `decide` luôn chạy `threadFreshness` (đọc `heads` và `source_revision_positions`) trước lệnh ghi, nên đã giữ `ACCESS SHARE` lên `heads` và vào hàng trước lệnh chờ của migration: dựng cùng kịch bản với giao dịch đã đọc hai bảng đó thì lệnh xác nhận xong sau 11–12 ms, lần áp lại chờ rồi xong, **không deadlock** (2/2). Chú thích đầu 023 (`:55-56`: «no path of the service writes both, so no order of the two can deadlock with the service (a raw transaction that takes them the other way round can: the file is then the victim and changes nothing)») đúng cho dịch vụ, nhưng chỉ vì lý do tình cờ này, và nửa sau **sai ở đây**: nạn nhân là bên chờ lâu hơn (lệnh xác nhận raw, chờ từ lúc lần áp lại giữ `heads`), không phải tệp; tệp vẫn áp được. Cùng mức tin cậy R34 của PR #22 (một phiên raw của role runtime). (Tệp lùi nói đúng điều này: `rollback:32-33`.)
**Cách ĐÓNG.** Thêm vào bước 1, sau hai `LOCK TABLE` hiện có: `LOCK TABLE public.draft_decisions IN SHARE ROW EXCLUSIVE MODE;` (cùng thứ tự với tệp lùi: bản sửa → nháp → quyết định). Đo: cùng kịch bản raw, lệnh xác nhận chờ lần áp lại (lệnh `INSERT` chờ ở đầu câu, chưa giữ khoá nào của riêng nó) rồi **thành công** (426 ms), lần áp lại thành công, không `40P01`. Giá: từ bước 1 trở đi `INSERT` vào `draft_decisions` chờ (đọc thì không), thay vì chỉ từ bước 10; một lần áp lại kéo dài 50 ms ở CSDL nhỏ. Hoặc chấp nhận và ghi vào chú thích đầu: «một phiên raw có thể là nạn nhân `40P01` khi trùng với lần áp lại».

### CS-DB-4 · P3 · Lớp 2 · Plan chung làm tăng thời gian giữ khoá dòng đếm

**Vị trí.** `023_thread_order.sql:258-260` (thuộc tính hàm), `:299-304` (phép quét).

**Lỗi [đo].** Câu `EXISTS (… NOT EXISTS …)` trong hàm plpgsql dùng plan riêng cho 5 lần thực thi đầu của mỗi backend, rồi plan chung nếu «không tệ hơn». Trên luồng 3 000 tin giữa 150 luồng nhiễu: 2,7 → 3,3 ms và 3,3 → 3,7 ms (hai lần chạy), tức **+20–25 %** từ lần thứ 6; ba lần đo khác nhau của cùng một câu: 1,5 → 3,2 ms. Đo cả lệnh `INSERT` xác nhận trong một backend: 2,1 → 3,7–4,3 ms (lần 1–5 so với 6–14). Số 3,7–4,0 ms của builder (`logs/codex-fix1-explain.txt`) là của plan riêng. Backend của pool sống lâu, nên về lâu dài đây là số thật của thời gian giữ khoá dòng đếm (chặn nhận tin của luồng), tăng theo độ dài luồng.
**Cách ĐÓNG.** `SET plan_cache_mode = force_custom_plan` thêm vào danh sách `SET` của hàm (một thuộc tính; không đổi hành vi). Đo: giữ 2,57–2,79 ms qua cả 14 lần. Tuỳ chọn: giữ số của N11 ở mức đúng với plan chung.

### CS-DB-5 · P3 · Lớp 3 · `EXPLAIN (ANALYZE)` cho số dòng ngoài phạm vi (không mới về loại)

**Vị trí.** Hai bảng mới, chính sách `runtime_select` (`:158-165`).

**Kịch bản [đo].** `SET LOCAL ROLE libetech_runtime` với phạm vi một dự án, `EXPLAIN (ANALYZE, TIMING OFF) SELECT thread_seq FROM source_revision_positions`: `Rows Removed by Filter: 3` trên bảng 19 dòng, 16 dòng của dự án (thấy được): người gọi suy ra số bản (và, ở `intake_thread_heads`, số luồng) của **mọi dự án và tenant khác**. Đây là tính chất của RLS trong PostgreSQL cho mọi bảng bật RLS (kể cả `source_events` và `source_event_revisions` có từ 016), không do PR này; hai bảng mới chỉ thêm hai bảng nữa. Không đóng được ở mức bảng. Tôi **không** đề nghị sửa trong PR này; đề nghị biên nhận không viết «không có kênh đếm».

## 2 · N22: các cách đóng đã thử

Mọi số đo trên PostgreSQL 16.15, CSDL riêng. «Đóng» = không còn cửa sổ nào cho kiểu người ghi nêu ở cột 2; «thu hẹp» = còn.

| Cách | Đóng hay thu hẹp | Ảnh hưởng đường nhận tin đang chạy | Ảnh hưởng migration 023 / tệp lùi / `schema_migrations` | Chi phí đo được | Khuyến nghị |
|---|---|---|---|---|---|
| **R-A** `ENABLE ALWAYS` trên trigger cấp số | **Đóng** đường `session_replication_role = replica` (kịch bản của vòng 1). Không đóng `DISABLE TRIGGER` | không đổi: không thêm câu lệnh; phiên replica nay lấy khoá dòng đếm như mọi người ghi bản (chờ 406 ms lệnh xác nhận ở thử nghiệm) | thêm một dòng ở bước 9, **sau** `CREATE OR REPLACE TRIGGER` (đo: lệnh này đặt lại `A` → `O`); idempotent; tệp lùi không đổi (bỏ trigger); `schema_migrations` không đổi. `pg_restore --disable-triggers` hạ `A` → `O` (CS-DB-2) | 0 ở thời gian chạy; test (đo): 4 ca đỏ (A6, A7b, N22, N23) + móc `restoreGuards`; `source-text` 41/41, `skill-context` 23/23, `suggestions` 122/122 vẫn xanh | **LÀM** |
| **R-B** phép kiểm catalog (`tgenabled IN ('O','A')`) trong trigger xác nhận | **Đóng** trigger tắt/vắng **đã commit** (`DISABLE` theo tên, `DISABLE TRIGGER ALL`, `DROP`). Không đóng DDL cùng giao dịch | không đổi (chỉ lệnh xác nhận) | thêm 4 dòng vào thân hàm; tệp lùi không đổi (bỏ cả hàm); idempotent | 0,004 ms mỗi lệnh xác nhận | **LÀM** |
| **R-C** quy tắc: phiên bảo trì khoá `FOR UPDATE` dòng đếm của luồng trước khi ghi | **Đóng** cho phiên làm theo, cả hai thứ tự (đo) | không đổi | tài liệu (đầu 023, N15) + một ca kiểm; không đổi tệp SQL | 0 | **LÀM** (chữ) |
| **R-D** khoá ngoại hoãn `source_event_revisions(id)` → `source_revision_positions(revision_id)` `DEFERRABLE INITIALLY DEFERRED` | **Đóng** thêm: `DISABLE` theo tên và `DROP` trigger trong cùng giao dịch (commit bị `23503`); `DISABLE` + `INSERT` + `ENABLE` cùng giao dịch thành **không thể** (`55006` pending trigger events). **Không** đóng `replica` (không có R-A) và `DISABLE TRIGGER ALL` (khoá ngoại là trigger origin) | không đổi: chèn+commit 0,82 ms so với 0,81 ms; `ON CONFLICT DO NOTHING` gửi lại: không đổi (đo) | khoá ngoại vòng giữa hai bảng; **tệp lùi phải `DROP CONSTRAINT` trước `DROP TABLE`** (đo: `2BP01` nếu không); `TRUNCATE` bảng số một mình thành lỗi (`0A000`; trước đó được); `TRUNCATE projects … CASCADE` của harness: vẫn được (đo); phục hồi: không đổi so với không khoá ngoại | ≈ 0 | tuỳ chọn (một lớp nữa; không cần nếu làm R-A, R-B, R-C) |
| **R-E** `CONSTRAINT TRIGGER … DEFERRABLE INITIALLY DEFERRED` trên `draft_decisions` kiểm lại lúc COMMIT | **Thu hẹp**, không đóng. Đo bằng tạm dừng chèn vào hàm (0,4 s): bản không số commit trong lúc hàm ngủ, lệnh xác nhận commit được (lệnh COMMIT 412 ms, quyết định 1, bản không số có). Cửa sổ thật = câu quét + commit: ảnh chụp của câu lấy lúc câu bắt đầu | người ghi bản không số **không** bị chờ (nó không lấy khoá nào) | **lỗi `LTZ03` ném ở `COMMIT`**: `src/server/db.ts:44` (`await client.query('COMMIT')`) ném lỗi thô, `decide` không bắt được (cái `catch` ở `suggestions.ts:363-373` chỉ bao `INSERT`): cần đổi `db.ts`/`decide`; tệp lùi phải bỏ trigger | cửa sổ 2,6 ms → ≈ 0,3–0,8 ms ở CSDL nhỏ; ở quy mô 63 000 tin phép quét ≈ 4 ms chiếm ưu thế (cửa sổ ≈ 6,5 → ≈ 4,3 ms) vì ảnh chụp lấy lúc câu quét **bắt đầu** | **KHÔNG** |
| **R-F** `LOCK TABLE source_event_revisions IN SHARE ROW EXCLUSIVE MODE` lấy **trước** dòng đếm trong trigger xác nhận | **Đóng kín** (mọi cách ghi bản, cả `replica`): đo, phiên replica chờ tới khi lệnh xác nhận commit (308 ms), rồi ghi sau quyết định | **chặn nhận tin của mọi dự án và tenant** trong khi bất kỳ lệnh xác nhận nào còn mở: đo, một phiên raw của role runtime đã ghi một quyết định hợp lệ và để mở làm `INSERT` bản sửa của **dự án khác** nhận `55P03` sau 2 002 ms (nó lẫn trong L4 nhưng ở mức bảng, qua tenant). Hàng đợi khoá: một lệnh xác nhận chờ một giao dịch nhận tin chậm làm nhận tin **không liên quan** đứng sau nó (sau 1,6 s vẫn chờ, dù thứ nó chờ không xung đột với nó). Tải ổn định: p50 1,2 ms không đổi ở 20 và 50 lệnh xác nhận/giây (p99 1,6–1,7 ms; một đỉnh 61,8 ms ở 20/s) | không đổi nhưng cùng khoá với 023 (SHARE ROW EXCLUSIVE) nên chúng tự xếp hàng | đắt ở độ sẵn sàng, không ở thông lượng | **KHÔNG** |
| **R-G** `ROW EXCLUSIVE` (thay vì SHARE ROW EXCLUSIVE) trên bảng bản sửa lấy trong trigger xác nhận | **#inference** + một thử: xung đột với mọi DDL cần ≥ SHARE (đóng cả DDL cùng giao dịch), tương thích với nhận tin | không chặn nhận tin | **đảo thứ tự khoá với 023 và tệp lùi** (bản sửa → quyết định): lệnh xác nhận đã giữ `ROW EXCLUSIVE` lên `draft_decisions` rồi xin bản sửa: deadlock với lần áp lại; chưa dựng ca nâng khoá (`ACCESS SHARE` → `ROW EXCLUSIVE`) với tệp lùi (**#inference**: có vòng) | — | **KHÔNG** (nếu muốn: lấy khoá này làm khoá đầu tiên của `decide`, tức đổi dịch vụ) |
| **R-H** thêm cột `NOT NULL` số luồng vào `source_event_revisions` | **Đóng** mọi đường không tự điền số (CHECK/NOT NULL không bị trigger bị tắt bỏ qua) | cần trigger `BEFORE INSERT`: đốt một số cho bản `ON CONFLICT DO NOTHING` bỏ qua và chạy trước `WITH CHECK` (lý do kế hoạch D2 bỏ phương án này; **#inference**, không dựng lại) | đổi bảng của lát 2; `ADD COLUMN` rồi `NOT NULL` cần điền số trước | — | **KHÔNG** (thiết kế khác) |
| **R-I** SERIALIZABLE / SSI | **#inference**: không giúp, một cạnh rw-antidependency chưa tạo cấu trúc nguy hiểm; và `LTZ02` cấm mức này | — | — | — | không thử |

**Khuyến nghị.** Làm R-A + R-B + R-C trước vòng 2; viết phần còn lại đúng như ở CS-DB-1; không làm R-E/R-F/R-G/R-H. Lý do để cổng Codex nhận phần còn lại: (1) người ghi phải là superuser/chủ bảng và phải tự DDL lên trigger cấp số trong cùng giao dịch mà không lấy khoá dòng đếm, tức là phần cơ chế mà cùng người ấy tắt được cả guard xác nhận; (2) hai đường mà vòng 1 thực sự nêu (replica, tắt đã commit) đóng kín và có ca đỏ-xanh; (3) cái giá của việc đóng kín phần cuối (R-F) là một phiên raw của role runtime chặn nhận tin của mọi tenant, tồi hơn phần dư.

## 3 · Quét lớp «kiểm rồi bên khác commit» trên toàn PR (tầng CSDL)

Cột «giữ tới commit bằng» là cái làm điều kiện còn đúng khi commit; «chỉ đúng ở READ COMMITTED» ghi chỗ nào dựa vào mức cô lập và ai chặn mức khác.

| # | Câu lệnh / hàm | Điều kiện được kiểm | Giữ tới commit bằng | Mức cô lập | Kết luận |
|---|---|---|---|---|---|
| 1 | trigger cấp số `023:175-196` | tin của bản nằm trong dự án (đọc `source_events` không khoá) | dòng tin bất biến (`016:235` chặn UPDATE/DELETE); khoá dòng đếm qua `ON CONFLICT DO UPDATE` giữ tới commit | RC chờ; RR: `40001` (N6); không cần `LTZ02` vì chỉ ghi | đúng |
| 2 | trigger xác nhận, tra nháp `023:263-267` | nháp tồn tại và cùng dự án | nháp bất biến (`021`) | — | đúng |
| 3 | tra ứng viên `023:282-286` | ứng viên của nháp, cùng dự án | `chat_id`, `thread_key` không nằm trong danh sách cột `UPDATE` của role runtime (`016:258`), nên bất biến với role ứng dụng | — | đúng |
| 4 | khoá dòng đếm + so `last_seq` `023:289-294` | `last_seq` bằng số dịch vụ đã đọc | khoá `FOR NO KEY UPDATE` tới commit: người ghi bản **có số** chờ | `LTZ02` ở `:276-278` buộc RC trước khi đọc; chỉ RC cho câu khoá đọc lại sau chờ (N7) | đúng |
| 5 | phép quét bản thiếu số `023:299-304` | không bản nào của luồng thiếu số | **không gì giữ** cho người ghi bản **không số** | RC (câu mới sau chờ, N23) | **CS-DB-1** |
| 6 | `threadFreshness` `source-text.ts:135-168` | luật 1–4 trong một ảnh chụp | luật 3, 4 được trigger xác nhận kiểm lại dưới khoá; luật 2 (bản mới nhất của tin) chỉ đổi khi có bản **mới** của tin, mà bản mới có số làm `last_seq` đổi | một câu một ảnh chụp, không phụ thuộc mức cô lập vì trigger kiểm lại và đòi RC | đúng, trừ cửa sổ của dòng 5 |
| 7 | `decide`, lệnh `INSERT` `suggestions.ts:360-373` | `ON CONFLICT(draft_id) DO NOTHING`, `LTZ03` → `DRAFT_HELD` | khoá tư vấn theo nháp (`:273`), unique `draft_id`; `claim` cùng giao dịch | RC (mặc định của `scoped`; 022 và 023 đòi) | đúng; `LTZ03` chỉ bắt quanh `INSERT`, lỗi ở `COMMIT` sẽ thô (không có trigger hoãn nên không xảy ra) |
| 8 | nháp tài liệu `DOC_SUBJECT_SQL` `suggestions.ts:112-114`, `:132-136` | bản mới nhất so với bản nháp nêu | `document_records FOR UPDATE` (`:278`) tới commit | RC | đúng (có từ PR #22) |
| 9 | `visibleThreadMessages`, `skill-context.ts` (câu bản của tài liệu cho `release_librarian`) | chỉ đọc để dựng ngữ cảnh | không có lệnh ghi dựa vào chúng ngoài các phép kiểm trên | — | không có kiểm-rồi-ghi |
| 10 | `threadHasHiddenText`/`projectHasHiddenText` | không bản nào bị che | **L9/R39 đã ghi nhận** ở PR #22 vòng 3 (cùng luồng: đóng bởi `LTZ03`) | RC | không mới |
| 11 | 023 bước 1 và 12 (login AI) | không login `libetech_ai` kết nối | `SHARE ROW EXCLUSIVE` lên hai bảng, kiểm hai lần dưới khoá | RC | đúng (hai ghế đã soát) |
| 12 | tệp lùi: kiểm «còn quyết định mang vị trí» (`rollback:40-45`) | `ACCESS EXCLUSIVE` bản sửa rồi quyết định **trước** khi kiểm (`rollback:35`, `:38`) | khoá tới commit | RC | đúng (N18, N18b) |

**Thứ tự khoá (xác nhận lại).** Nhận tin: `KEY SHARE` dự án → khoá tư vấn theo tin → dòng đếm → các lệnh chèn sau; xác nhận: khoá tư vấn theo nháp → dòng khoá lệnh → dự án `NO KEY UPDATE` (022) → dòng đếm → quét; không đường nào giữ dòng đếm rồi chờ thứ nó đã giữ. Cái tôi đo thêm:

- **Máy dò ngẫu nhiên 20 giây** [đo]: 2 luồng nhận tin (sửa tin có sẵn và trả lời tạo tin mới, có khoá tư vấn theo tin như dịch vụ), 2 luồng xác nhận (vị trí đọc ngay trước), 1 luồng từ chối, 1 luồng phân loại (`FOR UPDATE` rồi `UPDATE` ứng viên), trên 3 luồng của một dự án, qua đúng các role (`libetech_intake`, `libetech_runtime`): 3 377 nhận tin, 742 xác nhận được ghi, 660 bị `LTZ03`, 4 912 từ chối, 3 684 phân loại; **0 lần `40P01`, 0 lần `55P03`, 0 lỗi khác**; máy dò «xác nhận cũ» (một quyết định commit dù bản mang số vị trí + 1 đã được báo commit trước khi lệnh `COMMIT` của quyết định được gửi): **0**; bất biến sau chạy: 0 bản không số, dòng đếm bằng số dòng của bảng số và bằng số lớn nhất ở mọi luồng.
- **Áp lại 023 với một lệnh xác nhận và một lần nhận tin của cùng luồng đang bay** [đo]: lệnh xác nhận giữ 2 s: lần áp lại chờ và xong 2,04 s; nhận tin được số kế tiếp sau quyết định; không deadlock. Giữ 7 s: nhận tin nhận `55P03` (hàm, 5 s) như thiết kế; trạng thái cuối nhất quán, một quyết định, trigger `O`. (Ca «áp lại vừa trùng lệnh xác nhận raw»: CS-DB-3.)
- **Thứ tự khoá thật sự bị đảo ở một chỗ ngoài dịch vụ**: CS-DB-3.
- **Bỏ đói**: không quan sát được. Trong 20 s, 1 402 lần thử xác nhận (742 ghi được, 660 `LTZ03`) chen vào 3 377 lần nhận tin của cùng ba luồng, 0 lần `55P03` (trần chờ 5 s). Cơ chế (#inference, như đo 7 của kế hoạch): `FOR NO KEY UPDATE` tự xung đột với chính nó và với lệnh tăng dòng đếm nên hai bên luân phiên; xác nhận cùng dự án xếp hàng ở dòng dự án của 022 trước khi tới dòng đếm (N19b là ca khi 022 tắt). Mỗi lệnh xác nhận giữ khoá dòng đếm ≈ 2,6 ms ở luồng 3 000 tin (CS-DB-4).

## 4 · Quét lớp oracle và thời gian (tầng CSDL)

Một phiên raw của role `libetech_runtime` hoặc `libetech_intake`, qua `SET LOCAL ROLE` và `app.*` như `scoped()` [đo]:

| Ca | Mã / `where` quan sát được | Ghi chú |
|---|---|---|
| lệnh xác nhận, vị trí sai (luồng đi tiếp) | `LTZ03`, «The thread of the candidate moved on», `detail` và `hint` rỗng, `where`: `…guard() line 35` | cùng câu cho mọi nguyên nhân |
| vị trí `NULL` | `LTZ03`, `line 22` | |
| bản không số trong luồng, vị trí đúng | `LTZ03`, `line 45` | |
| ứng viên của nháp không tồn tại | `LTZ03`, `line 27` | |
| nháp **ngoài phạm vi khai** | `P0001` «A decision names a draft of its own project», `draft_decisions_guard() line 9` | không chờ khoá, không lộ id |
| dự án khai đúng nhưng nháp thuộc dự án khác | cùng `P0001`, cùng `line 9` | **không phân biệt** với dòng trên: không oracle về nháp của dự án khác |
| role nhận tin, bản dự án A cho tin của dự án B (khoá ngoại) | `23503`, `detail`: «Key is not present in table "source_events".» (không có giá trị khoá) | như tin không tồn tại |
| role nhận tin khai dự án A, ghi bản của dự án B | `42501` (RLS), trước trigger | |

`where` khác nhau theo nguyên nhân (đã biết, chú thích c. của 023); mọi nguyên nhân ở trên đều là thuộc tính của **ứng viên và luồng trong phạm vi của chính người gọi** (ứng viên có đọc được qua `SELECT` dưới RLS), nên không lộ gì ngoài phạm vi. Hai điều tôi không tìm thấy nguyên nhân để phân biệt từ ngoài phạm vi: có hay không một nháp/ứng viên ở dự án khác; số bản của luồng ở dự án khác (số chỉ đọc được qua `SELECT` có RLS, cộng kênh đếm CS-DB-5). Thời gian chờ khoá: không có chờ ngoài phạm vi (N5, N10, N21 đã có; tôi không dựng lại, ngoài việc `P0001` ở dòng trên trả ngay). Đo thêm: không thiết lập nào của role ứng dụng cho phép `SET session_replication_role`, `CREATE` trên `public`, hoặc `BYPASSRLS` (mục CS-DB-1).

## 5 · Đã thử mà không phá được

- Phiên `replica` ghi bản vào luồng của một lệnh xác nhận đang mở: bị chặn bởi R-A (chờ 406 ms) — nhưng **chưa có trong PR**, đó là CS-DB-1.
- Trigger cấp số với khoá ngoại hoãn thử: bản đúng đường (có số) commit bình thường; gửi lại `ON CONFLICT DO NOTHING` không đổi.
- `TRUNCATE projects … CASCADE` (đường `h.reset()` của harness) với hai bảng mới và với khoá ngoại thử: chạy.
- Phục hồi `--disable-triggers` của dump hậu-023: dữ liệu nhất quán, 0 bản không số.
- Hai/ba kết nối: máy dò 20 s (mục 3), áp lại với lệnh xác nhận + nhận tin trong bay, các thứ tự N7/N8/N19 không thay đổi khi thêm phép quét (không có khoá mới).
- Mức cô lập: trigger xác nhận đòi RC (`LTZ02`) trước khi đọc; phép quét chạy sau lệnh khoá nên cũng RC; trigger cấp số không cần (chỉ ghi; RR cho `40001`, N6).
- Thông số của khoá `lock_timeout` của hàm (5 s): đo lại bằng ca giữ 7 s (nhận tin `55P03` sau 5 s, không ghi gì).
- Khoá chéo dự án, tenant: dòng đếm khoá theo (tenant, dự án, `chat_id`, `thread_key`); phép quét lọc cùng bốn cột (B8, N20 đã có).

## 6 · Việc cần làm trước vòng 2 (gói gọn)

1. CS-DB-1: R-A, R-B (hai đoạn SQL ở trên) + quy tắc R-C vào chú thích đầu 023 và điều kiện N15; đổi kỳ vọng A6, A7b; chuyển các ca dựng «bản không số» sang `DISABLE TRIGGER`; viết lại N22 cho đúng phần còn lại; sửa dòng L7/W9 của kế hoạch và biên nhận (đừng viết «đóng» cho cả L7).
2. CS-DB-2: sửa N4 thành #fact; bộ cài `--disable-triggers` + khẳng định `tgenabled='A'` sau lần nạp (không chặn vòng 2).
3. CS-DB-3, CS-DB-4: P3, một dòng mỗi cái (khoá `draft_decisions` ở bước 1 hoặc ghi giới hạn; `force_custom_plan`).
4. CS-DB-5: ghi vào biên nhận, không sửa.
