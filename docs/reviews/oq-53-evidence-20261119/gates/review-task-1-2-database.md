VERDICT: CHANGES_REQUIRED

# Review CSDL (tầng 1, soát mã) · OQ-53 Task 1 và Task 2 · migration 023

Đối tượng: nhánh `feat/oq-53-subject-verification`, đầu `4076ba7` (gốc `80c1ad8`): `migrations/023_thread_order.sql`, `migrations/rollback/023_thread_order.sql`, `tests/thread-order.test.ts`, `tests/thread-order-concurrency.test.ts`, phần đổi của `tests/migrations-rollback.test.ts`, `tests/z4-schema.test.ts`, `tests/z4-pointer-guard.test.ts`. Ghế: review CSDL, độc lập, khuyến nghị (R1/R2). Ngày 19/11/2026.

| Mức | Số finding |
|---|---|
| P0 | 0 |
| P1 | 1 (R-DB-1) |
| P2 | 4 (R-DB-2 … R-DB-5) |
| P3 | 5 (R-DB-6 … R-DB-10) |

Một câu: thiết kế và SQL đúng ở những chỗ hai cổng kế hoạch đã dò (số theo thứ tự commit, so-và-ghi `FOR NO KEY UPDATE`, RLS trước trigger, tệp lùi, chạy lại hai lần), không tìm thấy P0. Một P1 thuộc đúng lớp «kiểm rồi bên khác commit» mà cổng Codex không nhận «phần dư đã ghi»: phép kiểm login AI của 023 chạy ở bước 1, **trước** chỗ migration chờ writer đang bay, nên một login kết nối trong lúc chờ lọt qua (đã dựng lại bằng phép đo, mục R-DB-1). Sửa rẻ (đổi thứ tự trong tệp). Bốn P2 là một lỗi idempotent thật (trần đếm cả bản đã có số), hai chỗ ca kiểm không thể đỏ trước đột biến thật, và một con số thời gian lệch với kế hoạch.

## 0 · Cách làm và giới hạn

- CSDL riêng của phiên `slice1_verify_5311191` (PostgreSQL 16.15, container thử của phiên), đã `DROP` cuối phiên (kiểm lại: 0 CSDL tên đó). Không áp migration nào lên CSDL khác, không tạo hay đổi role, mật khẩu, quyền. Probe thủ công dùng hàm trợ giúp trong schema nháp `dbrev2_` (mất theo CSDL).
- Đã chạy, tất cả xanh ở cả PGlite (PostgreSQL 18.6) và native (16.15): `tests/thread-order.test.ts` (PGlite 19 qua + 1 bỏ; native 20 qua), `tests/thread-order-concurrency.test.ts` (native 13 qua), `tests/migrations-rollback.test.ts` (10/10 cả hai), `tests/z4-schema.test.ts` (PGlite 24 + 2 bỏ; native 26), `tests/z4-pointer-guard.test.ts` (PGlite 29 + 11 bỏ; native 40), `tests/rls-catalog.test.ts`, `tests/intake-schema.test.ts`. Không dùng log của builder.
- Nhãn: **[đo]** = tôi đo ở phiên này; **[mã]** = đọc từ tệp; **#inference** = chưa kiểm.
- Máy dùng chung, tải khoảng 4–5 trong lúc đo: số thời gian là cỡ độ lớn, không phải số chuẩn.
- Ghi chú vận hành: `pgrep -f vitest` tự khớp dòng lệnh của chính shell chứa chữ «vitest» (báo 3 khi không có tiến trình nào); tôi kiểm lại bằng mẫu `[v]itest` trong một lệnh không chứa chữ đó: 0 tiến trình. Không kill gì.
- Đột biến: áp vào `migrations/023_thread_order.sql` rồi khôi phục từ `git show HEAD:…`; cuối phiên `git status` sạch (0 tệp đổi) trừ chính tệp báo cáo này.
- Không phủ (#inference): SERIALIZABLE (ngoài `40001` đã được ca N6 chạm), `pg_restore` data-only, pooler ở session mode, số liệu dữ liệu thật, gateway chạy thật.

## 1 · Finding

| Mã | Mức | Vị trí | Tóm tắt |
|---|---|---|---|
| R-DB-1 | P1 | `023_thread_order.sql:57-66` so với `:75`, `:89-90`, `:154` | Phép kiểm login AI (P6 (ii)) chạy trước chỗ migration chờ writer đang bay: một login kết nối trong lúc chờ lọt qua |
| R-DB-2 | P2 | `023_thread_order.sql:155-160` | Trần P12 đếm **mọi** bản, không phải bản chưa có số: chạy lại 023 trên bảng trên trần bị từ chối dù không còn gì để đánh số; chính đường sửa «áp lại để bật lại trigger» bị chặn |
| R-DB-3 | P2 | `tests/thread-order.test.ts:533-572` (B4), `:209-258` (A6), `023_thread_order.sql:75`, `:240-242` | Đột biến «tra dòng đếm không lọc `project_id`» và «bỏ khoá ngoại của bảng dòng đếm» sống sót; có kịch bản dữ liệu cho thấy lệnh xác nhận hợp lệ bị từ chối |
| R-DB-4 | P2 | `tests/thread-order.test.ts:353-359` (A8 (iii)) | Nhánh từ chối P6 (ii) không có ca hành vi; đột biến «vô hiệu nhánh» sống sót. Có cách kiểm hành vi mà không cần tạo login AI |
| R-DB-5 | P2 | `023_thread_order.sql:155-160` (trần mặc định 500 000), kế hoạch P12 | Lần đánh số 500 000 bản đo 6,7 s (dạng thực tế) và 10,2 s (dạng xấu nhất), không phải ≈ 5,5 s; ở dạng xấu nhất chạm trần `statement_timeout` 10 s của pool |
| R-DB-6 | P3 | `tests/thread-order-concurrency.test.ts` (N7–N11, N17) | Đột biến `FOR NO KEY UPDATE` → `FOR SHARE` (khe bỏ đói của đo 7) sống sót: không ca nào đỏ |
| R-DB-7 | P3 | `023_thread_order.sql:152-153`, `:189`, `:254`; kế hoạch W8 | Mô tả cửa sổ khoá không khớp `pg_locks`; chạy lại có `ACCESS EXCLUSIVE` trên bảng bản sửa; `ANALYZE` đứng sau bước giữ `ACCESS EXCLUSIVE`; câu trả lời cho ý (c) của DB-2 |
| R-DB-8 | P3 | `tests/thread-order-concurrency.test.ts:113,122-123,168,357` | Ca dựa vào đồng hồ (dưới 100 ms; 4 000–9 000 ms): trái mục 10 của kế hoạch, dễ chập chờn khi máy tải |
| R-DB-9 | P3 | `023_thread_order.sql:136-138`; `tests/thread-order.test.ts:377-395` (A9) | Nhánh `23503` của trigger không với tới được và không có ca; ý 4 của S-5 chỉ được đáp bằng lời của khoá ngoại |
| R-DB-10 | P3 | `023_thread_order.sql:169-186`, `:244` | Mục nhỏ: thứ tự số của dòng cũ có thể đảo `revision_no` của cùng tin; `WHERE h.last_seq < EXCLUDED.last_seq` không bao giờ đúng; `where` của `LTZ03` khác nhau theo nguyên nhân; mỗi chu kỳ lùi–áp để lại một cột đã drop |

### R-DB-1 · [P1] Phép kiểm login AI chạy trước lúc chờ writer đang bay (S-1, P6 (ii), L8)

- **Vị trí:** `migrations/023_thread_order.sql:57-66` (khối kiểm bước 1), `:75` và `:89-90` (khoá ngoại, lấy `SHARE ROW EXCLUSIVE` trên `projects` và `source_event_revisions`), `:154` (`LOCK TABLE`).
- **Lỗi:** P6 (ii) nhìn `pg_stat_activity` một lần, ở bước 1. Câu đầu tiên của tệp phải **chờ** một giao dịch nhận tin đang bay là `CREATE TABLE … FOREIGN KEY … REFERENCES source_event_revisions` ở bước 3 (và `projects` ở bước 2), không phải `LOCK TABLE` ở bước 8 như kế hoạch và chú thích đầu tệp mô tả (xem R-DB-7). Thời gian chờ đó, tới `lock_timeout` 5 s, chấm dứt đúng lúc giao dịch đang bay X commit. Một login thuộc `libetech_ai` kết nối **trong** lúc chờ, đọc ngữ cảnh (không thấy X), rồi X commit và 023 đánh số: X (có `created_at` sớm hơn Y đã nằm trong ngữ cảnh) nhận số nhỏ hơn Y; nháp ghi sau đó nêu Y, mốc bằng `last_seq`, trông còn mới dù X chưa được thấy. Đây đúng kịch bản của S-1, mà phép kiểm ở bước 1 không còn thấy.
- **Dựng lại [đo]:** không có login AI, nên dùng vai thay thế: sao chép tệp, đổi duy nhất chuỗi `'libetech_ai'` trong dòng `pg_has_role` của bước 1 thành `'libetech_runtime'`; login `libetech_web` (không superuser, thành viên `libetech_runtime`) đóng vai pipeline. (a) Đối chứng: `libetech_web` kết nối **trước** khi tệp chạy → tệp từ chối với câu cố định «Migration 023 refuses to run while a login that can act as libetech_ai is connected…», `schema_migrations` không có `023`: nhánh từ chối đúng. (b) Một giao dịch nhận tin thô giữ khoá bảng bản sửa; tệp bắt đầu, qua bước 1, bị chặn (1 phiên chờ khoá); `libetech_web` kết nối; giao dịch kia commit; **tệp áp thành công** với `libetech_web` đang kết nối (`schema_migrations` có `023`).
- **Mức:** P1 theo thang vì đây là lớp «kiểm rồi bên khác commit» (kế hoạch L8 liệt kê phép kiểm này là một trong bốn thứ đóng L8). Điều kiện cần để thành thật: có login AI (hôm nay không có), 023 áp trên dữ liệu đã có bản (áp lần đầu trên dữ liệu thật, hoặc áp lại sau lùi), và một giao dịch nhận tin đang bay lúc áp. Sửa rẻ nên không nên mang vào cổng Codex.
- **Sửa:** lấy khoá bảng ngay sau khối kiểm superuser, rồi kiểm login AI **dưới khoá**. Dưới `SHARE ROW EXCLUSIVE` không bản mới nào commit được; một ngữ cảnh đọc từ lúc đó thấy đủ mọi bản mà lần đánh số sẽ gán số, nên không còn khe. Phần dư còn lại là lần chạy đã đọc ngữ cảnh rồi **ngắt kết nối** (N10, đã ghi).
  ```sql
  BEGIN;
  SET LOCAL lock_timeout = '5s';
  -- bước 1: chỉ kiểm superuser
  LOCK TABLE public.source_event_revisions IN SHARE ROW EXCLUSIVE MODE;   -- chuyển từ bước 8 lên đây
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_stat_activity a JOIN pg_catalog.pg_roles r ON r.oid = a.usesysid
                WHERE a.pid <> pg_catalog.pg_backend_pid() AND a.datname = pg_catalog.current_database() AND NOT r.rolsuper
                  AND pg_catalog.pg_has_role(r.oid, 'libetech_ai', 'MEMBER')) THEN
      RAISE EXCEPTION '…' ;   -- cùng câu cố định
    END IF;
  END $$;
  ```
  Phép kiểm P6 (i) và trần (hiện ở bước 8) đã nằm dưới khoá; giữ nguyên.

### R-DB-2 · [P2] Trần P12 đếm cả bản đã có số: chạy lại 023 bị từ chối (E-DB-04, M-02)

- **Vị trí:** `migrations/023_thread_order.sql:157` (`SELECT count(*) INTO total FROM public.source_event_revisions`), so với chú thích `:43-45` (trần là của «lần đánh số»).
- **Lỗi:** chi phí của bước 8 tỉ lệ với số bản **chưa có số**; trần lại đếm mọi bản. Lần chạy lại (không còn bản nào để đánh số) trên bảng quá trần bị từ chối với câu «Ask for a plan in batches».
- **Kịch bản [đo]:** áp 023, tạo 4 bản (trigger tự đánh số: 4 bản, 4 số), áp lại tệp với `SET libetech.thread_order_max_rows = '3'` → `ERROR: Migration 023 stops: public.source_event_revisions holds more rows than …`; `schema_migrations` vẫn có `023`. Ở trần mặc định 500 000 thì bảng thật vượt trần là chuyện thời gian. Hệ quả vận hành: «áp lại 023» là đường sửa mà chính tệp và kế hoạch chỉ ra khi trigger bị tắt hoặc mất (`W9`, `L7`, `N12`; ca A7b dựa vào đúng điều đó), và M-02 đòi chạy lại không đổi gì. Trên bảng quá trần đường đó bị chặn bằng một lời chỉ dẫn sai (không có gì để chia lô).
- **Sửa:**
  ```sql
  SELECT count(*) INTO total FROM public.source_event_revisions r
   WHERE NOT EXISTS (SELECT 1 FROM public.source_revision_positions p WHERE p.revision_id = r.id);
  ```
  Thêm ca: trần thấp hơn số bản **đã có số** nhưng không còn bản nào chưa có số → áp được. Ca A8 (i) giữ nguyên (nó đã dựng bản chưa có số).

### R-DB-3 · [P2] Đột biến «dòng đếm không lọc dự án» sống sót, và kịch bản dữ liệu phân biệt được nó (E-TEST-01)

- **Vị trí:** `migrations/023_thread_order.sql:240-242` (`WHERE h.tenant_id = NEW.tenant_id AND h.project_id = NEW.project_id AND …`); `tests/thread-order.test.ts:560-571` (kịch bản «cùng chat và thread key ở hai dự án» của B4 chỉ có dòng đếm ở **một** dự án, nên chỉ thử bộ lọc dự án của dòng ứng viên `:233-234`).
- **Đo [đo, PGlite, 20 ca của `thread-order.test.ts`]:** bốn đột biến sống sót (19 qua, 1 bỏ, 0 đỏ): bỏ `h.project_id` khỏi câu tra dòng đếm (`:241`), bỏ `h.tenant_id` (`:241`), bỏ `x.tenant_id` của ứng viên (`:234`), và bỏ khoá ngoại `FOREIGN KEY(project_id,tenant_id) REFERENCES public.projects` của `intake_thread_heads` (`:75`; A6 chụp `constraints` nhưng chỉ so lần áp thứ nhất với lần thứ hai, không so với giá trị mong đợi). Các đột biến khác đỏ đúng (xem mục 4). Hai đột biến tenant là **tương đương** về kết quả (`project_id` đã xác định tenant qua khoá ngoại `(project_id, tenant_id) → projects(id, tenant_id)` và bộ lọc dự án còn đó): vô hại, chỉ là vị từ thừa. Đột biến `h.project_id` và đột biến khoá ngoại thì **không** tương đương.
- **Kịch bản [đo]:** hai dự án cùng tenant, cùng `chat_id` và `thread_key` (một chat được ánh xạ lại sang dự án khác); dự án 1 có dòng đếm 1 (lưu trước), dự án 2 có dòng đếm 5. Lệnh xác nhận **hợp lệ** ở dự án 2 mang vị trí 5: bản gốc lưu được (`subject_thread_seq = 5`); bản đột biến nhận `The thread of the candidate moved on` (`LTZ03`), vì `SELECT … INTO … FOR NO KEY UPDATE` lấy dòng đếm của dự án 1 (khoá nhầm dòng của dự án khác, so nhầm số). Đây vừa là từ chối oan vừa là khoá dòng ngoài phạm vi.
- **Sửa (ca):** trong B4, thêm một luồng cùng khoá ở dự án thứ hai **có** dòng đếm (qua `IntakeService` hoặc `rawRevision` + trigger), rồi (a) xác nhận ở dự án 2 với vị trí của dự án 2 → lưu; (b) với vị trí của dự án 1 → `LTZ03`; (c) biến thể tenant khác (`ids.otherTenant`) cho đủ 34a–34e ở phía quyết định; (d) ở A6, khẳng định tập ràng buộc của hai bảng mới (khoá ngoại, `UNIQUE`, `CHECK`) bằng giá trị mong đợi chứ không chỉ bằng nhau giữa hai lần áp. Không cần đổi SQL.

### R-DB-4 · [P2] Nhánh từ chối P6 (ii) không có ca hành vi, mà làm được (S-1, N14)

- **Vị trí:** `tests/thread-order.test.ts:353-359` (chỉ khẳng định chữ có mặt trong tệp và «0 login thành viên»); kế hoạch N14, mục 0 hàng S-1 («không làm được»).
- **Lỗi:** đột biến `IF false AND EXISTS (SELECT 1 FROM pg_catalog.pg_stat_activity …)` ở `:61` **sống sót** [đo, PGlite: 19 qua, 0 đỏ]: A8 (iii) bản chữ vẫn qua (các chuỗi vẫn có trong tệp). Ca native «phiên superuser đang mở thì vẫn chạy» (`:362-375`) khẳng định đúng điều mà bản đột biến làm hiển nhiên đúng, nên cũng qua (suy từ cấu trúc ca, không chạy native). Nghĩa là bản mà phép kiểm bị tắt hoàn toàn vẫn xanh.
- **Cách kiểm hành vi mà không tạo login AI [đo]:** đổi một chuỗi trong **bản sao** của tệp (`'libetech_ai'` → `'libetech_runtime'`, đúng một lần xuất hiện trong lệnh `pg_has_role`) và dùng login `libetech_web` có sẵn của harness native (không superuser, thành viên `libetech_runtime`): phiên `libetech_web` đang mở → tệp từ chối bằng câu cố định, không bảng nào được tạo; đóng phiên → áp được. Tôi đã chạy đúng cặp đó (xem R-DB-1, đối chứng). Cách này kiểm đúng điều kiện SQL (`pg_stat_activity` nối `pg_roles`, `NOT rolsuper`, `pg_has_role … 'MEMBER'`, `datname`, loại `pg_backend_pid()`) bằng một phiên không superuser thật, không cần role hay login mới. Phần chưa chứng minh được vẫn là N14 (login AI thật), nhưng nhánh có thể đỏ.
- **Sửa:** thêm ca native theo cách trên (kèm bản chữ hiện có). Ghi trong kế hoạch rằng «không có ca hành vi» chỉ còn đúng cho tên role `libetech_ai`, không cho điều kiện SQL.

### R-DB-5 · [P2] Thời gian lần đánh số ở trần mặc định (P12, N3)

- **Vị trí:** `023_thread_order.sql:155-160`; kế hoạch P12 (≈ 5,5 s ở 500 000 bản, «khoảng 900 000 bản thì chạm `statement_timeout` 10 giây»), `src/server/db.ts:32` (`statement_timeout: 10000`).
- **Đo [đo, SQL thật, 500 000 bản chưa có số, PostgreSQL 16.15, tải ≈ 5]:** câu đánh số (`WITH numbered … INSERT … ON CONFLICT`) 6,65 s khi có 70 000 luồng (trung bình ≈ 7 bản mỗi luồng); 10,16 s khi mỗi bản một luồng (500 000 dòng đếm, dạng xấu nhất). Cả tệp: 6,8 s và 10,4 s. Kích thước bảng số sau lần đầu: 152 MB. Số của cổng (0,52 s cho 60 000 bản) ngoại suy tuyến tính ra ≈ 4,3 s: lệch 1,5–2,4 lần.
- **Hệ quả:** trong toàn bộ thời gian đó mọi lệnh chèn bản sửa chờ khoá; ở dạng xấu nhất chạm trần 10 s của pool (`57014`) ngay ở mức trần 500 000, không phải ở 900 000. Gateway tự hết giờ sau 2 s (đã ghi ở W4: tin vào hàng đợi, không mất). Bảng `projects` cũng bị `SHARE ROW EXCLUSIVE` suốt thời gian đó (R-DB-7).
- **Sửa:** hạ trần mặc định (đề xuất 250 000, ≈ 3–5 s ở số đo trên) hoặc ghi vào N3 rằng trần là cỡ độ lớn phải đo lại trên phần cứng đích bằng `\timing` của chính tệp trên bản sao; vẫn giữ thiết lập nâng-có-chủ-ý. Số liệu nào cũng là của máy dùng chung: đây là lý do cần N3 đo trên bản sao thật, không phải lý do bỏ trần.

### R-DB-6 · [P3] `FOR SHARE` không làm ca nào đỏ

- **Đo [đo, native, `thread-order-concurrency.test.ts`]:** đột biến `FOR NO KEY UPDATE` → `FOR KEY SHARE` làm đỏ N7, N8, N11, N17; → không khoá làm đỏ cùng bốn ca (đều là `AssertionError: the statement was expected to wait …`, không phải hết giờ). Đột biến → `FOR SHARE`: **13/13 qua**. `FOR SHARE` đóng cả hai chiều của một lệnh xác nhận đơn lẻ nhưng cho phép hai lệnh xác nhận gối nhau cùng giữ, bỏ đói lệnh nhận tin (đo 7 của planner: `57014` sau 9 s). Chú thích đầu tệp (`:19-21`) nêu đúng lý do chọn `FOR NO KEY UPDATE`, mà không ca nào giữ lý do đó.
- **Sửa (ca native):** hai lệnh xác nhận (hai nháp của cùng một ứng viên, cùng vị trí đúng) của cùng một luồng **thay phiên nhau**: lệnh thứ hai chờ (`waitBlockedBy`) tới khi lệnh thứ nhất commit; với `FOR SHARE` nó không chờ.

### R-DB-7 · [P3] Cửa sổ khoá thật khác với mô tả; trả lời cho ý (c) của DB-2

- **Mô tả vs đo [đo, `pg_locks` sau từng bước, giao dịch bị `ROLLBACK`]:**
  - Lần áp đầu: `SHARE ROW EXCLUSIVE` trên `projects` từ bước 2 và trên `source_event_revisions` từ bước 3 (các khoá ngoại), giữ tới commit; không phải từ bước 8 (`:152-153` và W8). `projects` bị khoá chế độ này nghĩa là `INSERT`/`UPDATE`/`DELETE` trên `projects` chờ suốt lần áp (khoá dòng `FOR KEY SHARE` và `FOR NO KEY UPDATE` của khoá ngoại và của 022 không xung đột): ít đường ghi `projects` nên nhẹ, nhưng không có trong W8.
  - Lần áp lại: `DROP TRIGGER IF EXISTS source_event_revisions_thread_position …` (`:189`) lấy **`ACCESS EXCLUSIVE`** trên bảng bản sửa từ bước 9 tới commit (lần áp đầu không: trigger chưa có nên không bị khoá mạnh). Lệnh **đọc** bảng bản sửa (hộp tin, ngữ cảnh) chờ trong khoảng đó. Cùng lý do với `DROP TRIGGER IF EXISTS` trên `draft_decisions` nhưng ở đó bước 10 đã giữ `ACCESS EXCLUSIVE` rồi.
  - `ANALYZE` (`:254`) đứng **sau** bước 10–11 trong khi `ACCESS EXCLUSIVE` trên `draft_decisions` đang giữ (105 ms ở 500 000 bản): trái ý đoạn chú thích `:193-195`.
- **Sửa:** `CREATE OR REPLACE TRIGGER` (PostgreSQL 14 trở lên; cả hai engine của repo) thay cho cặp `DROP … IF EXISTS` + `CREATE TRIGGER` ở bước 9 (lấy `SHARE ROW EXCLUSIVE`); chuyển `ANALYZE` lên trước bước 10; sửa chú thích `:152-153` và W8.
- **Ý (c) của DB-2** (tạo chỉ mục duy nhất thứ hai và khoá ngoại sau khi đánh số): **không nên áp.** Mọi ràng buộc thêm sau vẫn cần `SHARE ROW EXCLUSIVE` trên bảng bản sửa (khoá ngoại tới nó) trong **cùng** giao dịch của tệp, nên cửa sổ chèn bị chặn không ngắn đi; chỉ thêm một bước. Số đo ở R-DB-5 là của hình dạng thật (đủ khoá ngoại và chỉ mục).

### R-DB-8 · [P3] Ca dựa vào đồng hồ

- `tests/thread-order-concurrency.test.ts:168`, `:357` (`toBeLessThan(100)` ms cho ba lệnh liên tiếp), `:113`, `:122-123` (≥ 4 000 ms và < 9 000 ms quanh `lock_timeout` 5 s). Mục 10 của kế hoạch: «thứ tự ghi trong ca do ca tự đặt, không dựa vào đồng hồ». Các ca này đỏ đúng khi lỗi thật (một lần chờ khoá là ≥ 5 000 ms), nhưng ngưỡng 100 ms chập chờn khi máy tải (tải đo được 4–5).
- **Sửa:** đo bằng điều kiện thay cho đồng hồ, ví dụ khẳng định lệnh đã **settled** trong lúc giao dịch giữ khoá còn mở (đã là cách của `inFlight`), và bỏ ngưỡng 100 ms hoặc nâng lên một phần của `lock_timeout` (ví dụ 2 000 ms: vẫn nhỏ hơn 5 000 ms của khoá).

### R-DB-9 · [P3] Nhánh `23503` của trigger đếm là mã chết, và ý 4 của S-5 chỉ được đáp một phần

- `023_thread_order.sql:134-138`: hàm trigger đếm tự ném `23503` «The source event of a revision is not visible». Trigger khoá ngoại (`RI_ConstraintTrigger_*`) sắp tên trước `source_event_revisions_thread_position` nên luôn từ chối trước; A9 (`:377-395`) khẳng định đúng lời và mã của **khoá ngoại**, không phải của nhánh này (chú thích `:377-379` đã nói vậy). Hậu quả: câu cố định của hàm không có ca nào, ý 4 của S-5 («chữ cố định, không mã, không số» cho nhánh của trigger) không được kiểm.
- **Sửa:** hoặc một ca tắt riêng trigger khoá ngoại (`ALTER TABLE … DISABLE TRIGGER` dưới login vận hành, mẫu B7) để nhánh chạy thật và khẳng định lời; hoặc bỏ nhánh và ghi rằng khoá ngoại là phép kiểm. Giữ tình trạng hiện nay thì phải ghi «mã phòng thủ, không ca».

### R-DB-10 · [P3] Mục nhỏ

1. **Số của dòng cũ có thể đảo `revision_no` của cùng một tin** (`:171`: `ORDER BY r.created_at, r.revision_no, r.id`): ca A7 (`tests/thread-order.test.ts:260-290`) khẳng định đúng điều đó (bản 2 nhận số 1, bản 1 nhận số 2). Vô hại cho mọi luật của kế hoạch (luật 2 so `revision_no` theo `LATEST_REVISION_ORDER`, luật 3 chỉ dùng `max`), nhưng không đọc thứ tự `thread_seq` của dòng cũ như thứ tự sửa của một tin.
2. **`WHERE h.last_seq < EXCLUDED.last_seq`** (`:186`) không bao giờ sai: số gán là `coalesce(last_seq, 0) + rn`, luôn lớn hơn `last_seq`. Đột biến bỏ vế đó là tương đương; bảo vệ phòng thủ, không ca.
3. **`where` của `LTZ03`** khác nhau theo nguyên nhân (số dòng `RAISE` trong `CONTEXT`: thiếu vị trí, không thấy ứng viên, dòng đếm lệch). Chữ `message`, `detail`, `hint` giống nhau (B3 khẳng định điều đó), nên «một câu cố định cho mọi nguyên nhân» đúng cho ba trường đó; `where` phân biệt được các nguyên nhân với người nhận lỗi thô. Trong phạm vi người gọi nên không lộ gì ngoài phạm vi; `src/server/http.ts` không chuyển tiếp chữ của CSDL. Ghi trong chú thích nếu muốn giữ lời «không nói gì».
4. **Mỗi chu kỳ lùi–áp để lại một cột đã drop** trên `draft_decisions` (ba chu kỳ: `attnum` 15, 16, 17, 18 đã drop, 19 đang dùng; `attacl` của các cột đã drop rỗng nhờ `REVOKE` tường minh của tệp lùi, `pg_shdepend` không giữ dòng cho chúng). Giới hạn 1 600 cột không phải mối lo; chỉ ghi nhận.

## 2 · Đối chiếu với hai báo cáo cổng kế hoạch

| Mã | Đã vào mã/ca ở đâu | Ghi chú |
|---|---|---|
| DB-1 (idempotent trigger, policy, chỉ mục) | `023:78-79`, `:94-95`, `:111`, `:115`, `:189`, `:249` (gỡ-nếu-có rồi tạo); `:100-103`, `CREATE INDEX IF NOT EXISTS`; ca A6, B5 áp lần hai, `shape()` bằng nhau | Có. Xem R-DB-7 về mức khoá của `DROP TRIGGER IF EXISTS` khi chạy lại; R-DB-2 về trần khi chạy lại |
| DB-2 (cửa sổ khoá, trần, `ANALYZE`, bước 10–11 ở cuối) | Trần `:155-160`; bước 10–11 ở `:193-251`; `ANALYZE` `:254`; ý (c) không áp | Một phần. Trần đếm sai tập (R-DB-2) và thấp hơn số đo (R-DB-5); `ANALYZE` đứng sau (R-DB-7); mô tả khoá lệch (R-DB-7). Ý (c): trả lời không nên áp (R-DB-7) |
| DB-3 (ngoại lệ E-DB-12) | `023:33-34`, nguyên câu của P11 | Có |
| DB-4 (N1, N2) | Không có SQL; điều kiện vận hành ở kế hoạch (N1 còn mở) | Không thuộc hai task này |
| DB-5 (`P0001` của nháp ngoài phạm vi) | B4 `thread-order.test.ts:539-546`: `P0001`, đúng lời, `where` chứa `draft_decisions_guard` và không chứa guard của 023; N10 `{P0001, P0001, 42501}` | Có |
| DB-6 (cạnh phân loại ứng viên) | N17 (`concurrency:394-416`), N11 (`:363-392`) | Có; xanh và đỏ đúng với `FOR KEY SHARE`, không khoá. Không phân biệt được `FOR SHARE` (R-DB-6) |
| DB-7 (không dùng `xmax`) | A2 so `updated_at` của dòng đếm và số dòng; N16 dùng `FOR NO KEY UPDATE NOWAIT` từ kết nối thứ hai, kèm đối chứng | Có |
| DB-8 (PGlite là 18.6) | Cả hai engine chạy; số ca ghi ở mục 0 | Có |
| DB-9 (chỉ còn forward-fix; lùi–áp đảo thứ tự) | Tệp lùi `:1-16` (bốn điều), từ chối khi mang vị trí `:25-30`, header 023 `:30-32`, `:51-52` | Có; RB-023 `migrations-rollback.test.ts` kiểm từ chối, lùi sạch, áp lại hai lần |
| DB-10 (catalog; chữ lỗi cố định) | A3 `:149-162` (ACL từ catalog, `has_*_privilege`, `rolbypassrls`); A6 `:209-258`; B3; A9 | Có, trừ nhánh `23503` của hàm (R-DB-9) |
| S-1 (lùi–áp lại, kiểm login AI) | P6 (ii) `:61-65`; chú thích `:36-42`; tệp lùi, điều 3 | **Chưa đủ**: lọt khi login kết nối trong lúc chờ (R-DB-1); không ca hành vi (R-DB-4) |
| S-2, S-3, S-7 | Không thuộc Task 1–2 (đầu ra kỹ năng, `present`, `release_librarian`) | Không soát ở đây |
| S-4 (hai câu sai) | Chữ của kế hoạch; A5 và N5 có hai dạng hai dòng (`INSERT … VALUES`, `INSERT … SELECT`) | Có |
| S-5 ý 1 (SELECT thuần của mọi role khác) | A3 `:141-144`: `OTHER_ROLES` và `libetech_web` (native) bị `permission denied` | Có |
| S-5 ý 2 (gửi lại không khoá, ca native) | N16 (`concurrency:200-233`) | Có |
| S-5 ý 3 (hai dòng trộn phạm vi) | A5, N5 | Có |
| S-5 ý 4 (lời của `23503`) | A9 | Một phần: lời của khoá ngoại; nhánh của hàm không có ca (R-DB-9) |
| S-5 ý 5 (B4 đúng mã, đúng lời) | B4 `:533-572` | Có; còn thiếu kịch bản hai dự án có dòng đếm (R-DB-3) |
| S-5 ý 6 (đột biến hai dạng `FOR KEY SHARE`, bỏ khoá) | Thuộc Task 9; tôi đã chạy cả hai: đỏ đúng | `FOR SHARE` còn sống (R-DB-6) |
| S-5 ý 7 (guard của 021/022 trên nháp ứng viên) | B6; z4-schema ca mới; z4-pointer-guard P6 | Có; ca «a confirmation can only attach a revision…» (xem mục 3) giữ nguyên ý |
| S-6 (cột không là bằng chứng; `tgenabled='O'`) | Câu ở `023:25-27` và `:196-197` (COMMENT của cột); A6, B5 khẳng định `tgenabled='O'` và `col_description` chứa câu đó | Có |
| S-8, S-9 | Chữ ở kế hoạch | Không thuộc SQL |

## 3 · Câu hỏi riêng của yêu cầu

- **(1) Idempotent và rollback.** Áp hai lần: A6 và B5 bằng nhau từng hàng catalog; tôi chạy lại trên 500 000 bản đã có số: `md5` của `(id, last_seq, updated_at)` của mọi dòng đếm không đổi [đo]. Lùi–áp lại ba chu kỳ liên tiếp: sạch [đo]. Lùi khi có quyết định mang vị trí: từ chối trước khi gỡ gì (ca «1b» của RB-023). Trạng thái sau lùi: không bảng, hàm, trigger, cột, ràng buộc, quyền; `source_events`, bản, nháp, quyết định còn nguyên; tệp lùi của 022 từ chối khi `023` còn được ghi (`ERROR: Roll back the later migrations before 022.`) [đo]. Lỗi: R-DB-2 (chạy lại bị trần), cột đã drop mỗi chu kỳ (R-DB-10).
- **(2) Hàm `SECURITY DEFINER`.** `search_path = pg_catalog, pg_temp`, `row_security = off`, `lock_timeout = '5s'` (catalog, A6/B5); mọi đối tượng có tiền tố schema (đọc cả hai thân hàm: không tên trần); `REVOKE ALL … FROM PUBLIC`, không `GRANT EXECUTE` (aclexplode); chủ hàm là superuser (bước 1; A8 (ii) đỏ khi không); lời `RAISE` cố định, không id, không số (B3, A9); đột biến `search_path = pg_catalog, public, pg_temp` làm A6 đỏ [đo]. Không đường vòng tìm thấy.
- **(3) Thứ tự, mức khoá, deadlock, cô lập.** Ghi nhận như hai cổng; ba ca chạm trigger (N7, N8, N17) đỏ đúng với đột biến `FOR KEY SHARE` và không khoá; `FOR SHARE` sống sót (R-DB-6). `LTZ02` ngoài READ COMMITTED: B6 (guard 022 trước), B7 (guard 023 một mình khi 022 tắt). Hàng (nhiều dòng một lệnh, `ON CONFLICT DO NOTHING` không chạy trigger): A2, N16.
- **(4) Khối đánh số dòng cũ.** Đúng trên 500 000 bản: so với truy vấn độc lập `row_number() OVER (PARTITION BY tenant, project, chat, thread ORDER BY created_at, revision_no, id)` — 500 000/500 000 khớp, 0 lệch; mọi dòng đếm bằng `max(thread_seq)` và bằng số bản của luồng (70 000 luồng, 0 sai); 0 bản không số [đo]. Cực biên: hai bản cùng `created_at` và `revision_no` (A7: `id` quyết định, đỏ khi bỏ `r.id`), luồng đã có dòng đếm và có bản chưa số (A7b), chạy lại (không đổi). Lỗi: R-DB-2, R-DB-5, R-DB-10.1. Từ chối P6 (i) tình cờ thấy lại khi tôi áp một bản đột biến lên CSDL còn một nháp chưa quyết định: đúng lời cố định [đo].
- **(5) RLS, quyền cột, chỉ mục.** Một policy `SELECT` cho `libetech_runtime` mỗi bảng, `ENABLE`+`FORCE`; chỉ `libetech_runtime` có `SELECT` (A3 từ catalog); `GRANT INSERT(subject_thread_seq)` duy nhất (B5); chỉ mục E-DB-08 và khoá ngoại có chỉ mục dẫn đầu; ràng buộc `draft_decisions_thread_seq_only_confirmed` đỏ đúng (B2; đột biến `>= 0` đỏ).
- **(6) Trigger quyết định, mọi nhánh.** confirmed/rejected × document/candidate × có/không vị trí × ứng viên thật/giả/khác dự án: B1–B4, B6 phủ; thiếu: hai dự án cùng khoá có dòng đếm (R-DB-3).
- **(7) Ca kiểm.** Ca chỉ khẳng định rỗng: không có ca nào chỉ có «0 dòng» làm khẳng định duy nhất (mọi ca «0 dòng» có đối chứng dương: A3 có `toBeGreaterThan(0)` trong phạm vi; B1 lưu được vị trí đúng; N5 có `positionsBefore+2`). Ca không thể đỏ: R-DB-3, R-DB-4, R-DB-6. Phụ thuộc đồng hồ: R-DB-8; A7b dùng `created_at` do ca đặt (tương lai cố định), A7 dùng `created_at` cố định: không phụ thuộc đồng hồ. Ca hiện có builder đổi: `tests/z4-schema.test.ts` ca «a confirmation can only attach a revision of the very document the draft is about»: các khẳng định `ATTACH` (nháp ứng viên với bản của tài liệu A, nháp tài liệu với bản của B, mã ngẫu nhiên) **không đổi**; chỉ dòng cuối («một nháp ứng viên được xác nhận không kèm bản») chuyển sang ứng viên thật với vị trí đúng, mà trigger mới buộc. Ý của ca (nháp ứng viên không nhận bản và xác nhận được khi không kèm) còn nguyên. Một ca mới cùng tệp («the guards of 021 still fire …, before the guard of 023») giữ guard của 021 trên nháp ứng viên thật. `tests/z4-pointer-guard.test.ts`: danh sách trigger của `draft_decisions` thêm đúng `draft_decisions_subject_order_guard` (BEFORE 021, 022 giữ nguyên); ca P6 mới giữ LTZ02 và LTZ01 trên ứng viên thật; mặc định `entity_type` của `draftVals` sang `'document'` đúng như P10 mô tả, cả G12, P4, P5 chạy xanh (PGlite và native) và các ca cũ gọi helper với `entity_type` rõ ràng không đổi.
- **(8) «Không đổi».** `git diff 80c1ad8 HEAD -- src` = 0 dòng (`src/server/intake.ts` không đổi). `023` không `ALTER` `source_events` hay `source_event_revisions`; chỉ thêm `source_event_revisions_thread_position` lên bảng bản sửa (A6, `tgtype = 5`, `tgenabled = 'O'`); `source_events` không trigger mới. Cột bảng quyết định: đúng một cột `subject_thread_seq`, đúng một `GRANT INSERT` cột.

## 4 · Điều tôi đã thử mà không phá được

- Số của dòng cũ: so với truy vấn độc lập trên 500 000 bản và hai hình dạng luồng (70 000 và 500 000 luồng): khớp tuyệt đối; chạy lại không đổi byte nào của dòng đếm.
- Lùi–áp ba chu kỳ liên tiếp; lùi sau khi 022 bị từ chối đúng thứ tự; không còn ACL ở cột đã drop.
- Đột biến bị bắt đúng [đo]: `ORDER BY` bỏ `r.id` (A7 đỏ); ràng buộc `>= 0` thay `> 0` (B2 đỏ); nhánh nháp ứng viên không còn xét `result` (B2 đỏ); `search_path` thêm `public` (A6 đỏ); `GRANT SELECT` thừa cho `libetech_intake` (A3 đỏ); `FOR KEY SHARE` và không khoá (N7, N8, N11, N17 đỏ bằng `AssertionError`, không hết giờ).
- Tổng cộng 13 đột biến đã chạy (PGlite cho 10, native cho 3 đột biến khoá); 7 đỏ đúng, 6 sống sót (bốn ở R-DB-3, một ở R-DB-4, một ở R-DB-6). Tệp được khôi phục sau mỗi lần; `git status` không còn thay đổi nào ngoài tệp báo cáo này.
- Nhánh từ chối P6 (ii): đối chứng với vai thay thế từ chối đúng (R-DB-1 (a)).
- P6 (i): từ chối đúng lời cố định khi có nháp ứng viên chưa quyết định và bản chưa có số.
- Vai và quyền: không role `libetech_*` nào lấy được khoá dòng đếm hay gọi hàm (A4 qua cả hai engine); `libetech_web` không `SET ROLE` không đọc được hai bảng.
- Thứ tự guard: lời của guard 021 và 022 vẫn nhận trước guard 023 trên nháp ứng viên thật (B6, z4-schema, z4-pointer-guard).
- Hash của nội dung bị che: 023 không lưu hash nào; hai bảng mới chỉ có siêu dữ liệu (`chat_id`, `thread_key`, số) mà `libetech_runtime` đã đọc được từ `source_events` cùng phạm vi.
- Rò oracle trước hoặc dưới RLS: ngoài phạm vi trả lời tức thì (A5, N5, N10: `42501` hoặc `P0001`); nháp tham chiếu ứng viên của dự án khác không chờ và không khoá (B4, tra ứng viên theo dự án của quyết định); không có đường chờ khoá mà người ngoài phạm vi chạm được.

## 5 · Lời nhắn cho phiên chính

Phải sửa trước cổng Codex: R-DB-1 (đổi thứ tự trong tệp; hai ca kèm R-DB-4). Nên sửa cùng đợt: R-DB-2 (một dòng SQL), R-DB-3 (một ca), R-DB-5 (trần). R-DB-6 đến R-DB-10 có thể gộp sau mà không đổi hành vi.

## 6 · Xem lại đợt sửa 2b (`00228a4`)

VERDICT: READY_FOR_GATE

Finding mới: 0 P0 · 0 P1 · 0 P2 · 2 P3 (R-DB-11, R-DB-12). Finding cũ chưa đóng: không có (R-DB-1 … R-DB-10 đều đã đóng; R-DB-7 đóng kèm một chỗ chữ sai, ghi ở R-DB-12). Hai P3 mới có thể gộp vào cổng hoặc ghi lại; không cái nào đổi hành vi của đường nhận tin hay xác nhận.

Đối tượng: `git diff 4076ba7 00228a4 -- migrations tests` (hai tệp migration, ba tệp ca kiểm). Cách làm: bản xuất `git archive 00228a4` đặt ngoài repo, `node_modules` nối vào; mọi đột biến và mọi lần chạy vitest ở đó, không đụng worktree; CSDL riêng `slice1_verify_5311191` tạo lại và đã `DROP` (0 CSDL còn lại). Trước mỗi lần chạy tôi đếm tiến trình bằng `pgrep -f '[v]itest'` trong một lệnh không chứa chữ đó và chờ về 0 (có lúc ghế khác đang chạy, tôi chờ; giữa các đột biến trong một lô tôi không đếm lại). Không tạo hay đổi role; không in chuỗi kết nối.

Đã chạy, xanh: `thread-order` PGlite 22 qua + 5 bỏ, native 27 qua (4 lần liên tiếp: một lần đầu và ba lần lặp, không chập chờn); `thread-order-concurrency` native 17 qua (4 lần); `migrations-rollback` 10/10 cả hai engine; `z4-schema` (PGlite 24 + 2 bỏ, native 26), `z4-pointer-guard` (PGlite 29 + 11 bỏ, native 40), `rls-catalog`, `intake-schema` native.

### 6.1 · Từng finding cũ

| Mã | Đóng? | Bằng chứng của tôi |
|---|---|---|
| R-DB-1 (khoá trước phép kiểm login AI) | Đóng | Tệp đã có `LOCK TABLE` hai bảng ngay sau phép kiểm superuser, phép kiểm login nằm sau (`023:87-88`, rồi `:90`). Dựng lại đúng probe vai thay thế của lần trước trên tệp mới: login `libetech_web` kết nối **trong** lúc tệp chờ giao dịch nhận tin đang bay → tệp từ chối với câu cố định, `schema_migrations` không có `023` (trước: áp thành công) [đo]. Đối chứng (kết nối trước khi chạy) vẫn từ chối. Ca A11 đỏ khi tôi đưa hai `LOCK` về sau phép kiểm (`AssertionError`, native) và xanh trên tệp đúng; ca chữ A8 (iii) khẳng định thứ tự và đúng một `LOCK TABLE public.source_event_revisions` |
| R-DB-2 (trần đếm bản chưa số) | Đóng | `023:186`: đếm `NOT EXISTS (… source_revision_positions …)`. Áp lại với trần mặc định trên 300 000 bản đã có số: chạy 0,37 s, `023` được ghi [đo]; 300 000 bản chưa số với trần mặc định: từ chối sau 0,08 s, không bảng nào; nâng trần: 4,46 s. Đột biến «đếm mọi bản» làm A8 (i) đỏ |
| R-DB-3 (đột biến lọc dự án, khoá ngoại) | Đóng | B8 (ba phạm vi: hai dự án, hai tenant, cùng khoá) đỏ với đột biến bỏ `h.project_id`; N20 (native) cũng đỏ (lệnh xác nhận hợp lệ bị `LTZ03`, lỗi thật, không phải hết giờ); A6 liệt kê 10 ràng buộc với giá trị mong đợi, đỏ khi bỏ khoá ngoại `intake_thread_heads → projects`; đột biến bỏ `x.project_id` của ứng viên làm B4 đỏ. Hai đột biến tenant (`h.tenant_id`, `x.tenant_id`) vẫn tương đương về kết quả (đã nêu ở mục 1): không cần ca |
| R-DB-4 (không ca hành vi cho P6 (ii)) | Đóng | A10 (native) dùng cách thay vai như tôi đề xuất, kiểm cả hai chiều (phiên superuser, kể cả `SET LOCAL ROLE libetech_runtime`, không bị đếm; phiên `libetech_web` bị đếm). Đột biến `IF false AND EXISTS …` làm A10 đỏ (`AssertionError`). Còn lại đúng như N14: tên thật `libetech_ai` chưa có login để thử |
| R-DB-5 (trần và thời gian) | Đóng | Trần mặc định 250 000 (`023:185`), chữ ghi 6,65 s / 10,16 s đúng số của tôi, N3 giữ «đo trên bản sao». Đo tệp mới ở 300 000 bản: 4,46 s (cùng hình dạng 70 000 luồng); ở 250 000 ngoại suy ≈ 3,7 s, dưới trần 10 s của pool; hình dạng xấu nhất ở 250 000 ≈ 5 s (#inference, theo tỉ lệ của số đo 500 000) |
| R-DB-6 (`FOR SHARE`) | Đóng | N19b (đã tắt guard 022) đỏ với đột biến `FOR SHARE` (lệnh xác nhận thứ hai không chờ: `AssertionError: expected 'settled' to be 'blocked'`); N19 (guard 022 bật) không đỏ với đột biến đó, đúng như ghi trong ca (khoá dòng dự án của 022 đã xếp hàng chúng). Cả hai xanh trên tệp đúng, 4 lần. Thứ tự chờ của N19b (lệnh nhận tin đến trước, lệnh xác nhận thứ hai bị từ chối) dựa vào xếp hàng khoá theo thứ tự đến của PostgreSQL; không chập chờn trong 4 lần, tôi không thử dưới tải nặng (#inference) |
| R-DB-7 (`CREATE OR REPLACE TRIGGER`; `pg_locks`) | Đóng, một chỗ chữ sai (R-DB-12) | `pg_locks` sau từng bước (giao dịch bị `ROLLBACK`): **lần đầu** — `SHARE ROW EXCLUSIVE` trên `source_event_revisions` và `ai_drafts` từ bước 1, trên `projects` từ bước 2, `ACCESS EXCLUSIVE` trên `draft_decisions` từ bước 10: đúng chữ của chú thích. **Lần hai** — hai bảng đầu vẫn chỉ `SHARE ROW EXCLUSIVE`, không `ACCESS EXCLUSIVE` nào trên bảng bản sửa (trước: có từ bước 9); `ANALYZE` (bước 9, `SHARE UPDATE EXCLUSIVE` trên hai bảng mới) đứng trước `ACCESS EXCLUSIVE` của `draft_decisions` (bước 10). A12 đỏ với đột biến «`DROP TRIGGER` + `CREATE TRIGGER`» (native). Đột biến đặt trần 500 000, hay mức khoá yếu hơn (`ACCESS SHARE` cho `ai_drafts`, `SHARE` cho bảng bản sửa), hay đưa hai `LOCK` về sau phép kiểm: A8 (iii) đỏ. Tôi không chạy riêng đột biến «`ANALYZE` xuống sau bước 10»; vị trí của nó được `pg_locks` ở trên xác nhận và A8 (iii) khẳng định thứ tự bằng chữ |
| R-DB-8 (đồng hồ) | Đóng | N4, N5, N10 không còn đọc `Date.now()`; N5 và N10 khẳng định mã (`42501`, `P0001`) và `pg_stat_activity` không có phiên chờ khoá. Một bản đột biến «trigger `BEFORE`» sẽ chờ 5 s rồi `55P03`, đỏ bằng mã chứ không bằng ngưỡng (suy luận; tôi không chạy đột biến đó). Không thấy chập chờn trong 4 lần |
| R-DB-9 (nhánh `23503` chết) | Đóng | A9b tắt trigger khoá ngoại trong một giao dịch rồi bật lại đúng trigger cần thử: nhánh chạy thật, `23503`, đúng câu, `where` chứa tên hàm, không id, không số; giao dịch lùi, không trigger nào còn tắt. Xanh cả hai engine |
| R-DB-10 (mục nhỏ) | Đóng | (1)–(4) và hai điều khác nằm ở chú thích đầu tệp, mục «Also to know» a–e. `WHERE h.last_seq < EXCLUDED.last_seq` đã bỏ; lập luận «số gán luôn lớn hơn số cũ» đúng: số = `coalesce(last_seq,0)+rn` trong cùng ảnh chụp, đường ghi bản bị khoá |
| R-S-1 của ghế bảo mật (tệp lùi khoá `draft_decisions`) | Đóng, kèm R-DB-11 | N18 (native) đỏ khi bỏ `LOCK` (`AssertionError`), xanh khi có; ca chữ trong `migrations-rollback` khẳng định `LOCK` đứng trước câu đọc vị trí |

### 6.2 · Tìm lỗi mới do đợt sửa

Hỏi: khoá thêm lên `intelligence.ai_drafts` có tạo vòng chờ hay chạm đường khác không; thứ tự khoá của migration so với đường nhận tin, xác nhận, ghi ánh xạ; ca mới có đỏ giả hay không thể đỏ không.

- **Khoá `ai_drafts` (SRE, bước 1): không tìm thấy vòng chờ.** Thứ tự khoá của tệp là `source_event_revisions` → `ai_drafts` → `projects` (bước 2) → … → `draft_decisions` (bước 10). Các đường khác: nhận tin giữ `ROW EXCLUSIVE` trên bảng bản sửa rồi trên hai bảng mới, không bao giờ chạm `ai_drafts`, `draft_decisions` hay ghi `projects`; nháp AI giữ `ROW EXCLUSIVE` trên `ai_drafts` rồi chỉ lấy khoá dòng `projects` (`ROW SHARE`, không xung đột với `SHARE ROW EXCLUSIVE`); xác nhận đọc bản (`ACCESS SHARE`, không xung đột với SRE) rồi ghi `draft_decisions`: đi cùng chiều với tệp (một lệnh xác nhận đã giữ `ROW EXCLUSIVE` còn được vượt hàng đợi của `ACCESS EXCLUSIVE` của bước 10 theo luật hàng đợi khoá của PostgreSQL: lập luận, tôi không dựng riêng); ghi ánh xạ chỉ lấy khoá dòng `projects`. Mọi lần chờ của tệp đều có `lock_timeout` 5 s: tệ nhất là `55P03` sạch. Việc đặt `ai_drafts` trước `projects` là đúng chiều (một lệnh ghi nháp đang bay giữ `ai_drafts` rồi cần dòng `projects`, tệp chưa giữ `projects` lúc chờ `ai_drafts`). Tác dụng phụ: lệnh ghi nháp mới chờ trong suốt lần áp (cố ý, A13), lệnh đọc `ai_drafts` thì không.
- **Ca mới đỏ giả hay không thể đỏ?** Đã thử mỗi ca bằng một đột biến làm đúng điều nó khẳng định: A10, A11, A12, A13, N18, N19b, N20, B8, A6 (ràng buộc), A8 (i), A8 (iii) (thứ tự, trần, mức khoá) đều đỏ đúng với đột biến tương ứng, bằng `AssertionError` hoặc lỗi thật của CSDL (N20: lệnh xác nhận hợp lệ bị `LTZ03`), không bằng hết giờ; riêng A12 đỏ kèm một lần chờ hết `lock_timeout` (đúng bản chất ca: tệp phải chờ nếu còn `DROP TRIGGER`). Chưa đột biến, chỉ xanh: A9b, B9, và các chỗ N4, N5, N10 đã bỏ đồng hồ. Xanh 4 lần liên tiếp. Còn lại ghi nhận: A10, A11 và ý `libetech_web` của A3 giả định `SLICE1_WEB_DATABASE_URL` được đặt (không đặt thì `h.db` là login superuser và A10, A11 đỏ giả); mục 10 của kế hoạch đã đòi cả hai biến, nên không coi là finding.

### R-DB-11 · [P3] Tệp lùi khoá `draft_decisions` trước `source_event_revisions`: ngược chiều với một lệnh xác nhận, và chữ chú thích («chờ tới `lock_timeout`») chưa đủ

- **Vị trí:** `migrations/rollback/023_thread_order.sql:29` (khoá `ACCESS EXCLUSIVE` trên `draft_decisions` ở câu đầu tiên), rồi `:53` (`DROP TRIGGER … ON public.source_event_revisions`, `ACCESS EXCLUSIVE` trên bảng bản sửa) ở nửa sau.
- **Lỗi:** `decide` đọc bảng bản sửa (`threadHasHiddenText`, `projectHasHiddenText`: `ACCESS SHARE`, giữ tới commit) **rồi** ghi quyết định. Tệp lùi đi chiều ngược: `draft_decisions` trước, bản sửa sau.
- **Kịch bản [đo, native, tệp lùi nguyên văn]:** một giao dịch xác nhận (vai runtime) đã `SELECT count(*)` bảng bản sửa; tệp lùi chạy, lấy `ACCESS EXCLUSIVE` trên `draft_decisions`, rồi chờ bảng bản sửa; giao dịch xác nhận ghi quyết định, chờ `draft_decisions`: vòng chờ. Kết quả: `40P01 deadlock detected` cho lệnh xác nhận (nạn nhân), tệp lùi chạy xong và gỡ `023`. Không mất dữ liệu (quyết định không được ghi) và dịch vụ nhận `40P01` thô (điều kiện N8). **Cùng kết quả với tệp lùi trước đợt sửa** (đo trên bản `4076ba7`): đợt sửa không gây ra, chỉ dời khoá `draft_decisions` lên đầu; nhưng chú thích mới («the wait ends at lock_timeout with 55P03 and nothing changes») không nêu khả năng này.
- **Mức:** P3: tệp lùi chỉ chạy khi đường ghi Z4 đã đóng (đầu tệp, điều 3), tức không có lệnh xác nhận nào đang bay; hậu quả là một lỗi thô cho một lệnh, không mất gì.
- **Sửa [đã thử trên bản sao ngoài repo]:** lấy `source_event_revisions` trước, rồi `draft_decisions` (cùng chiều với lệnh xác nhận và với tệp áp tới):
  ```sql
  IF pg_catalog.to_regclass('public.source_event_revisions') IS NOT NULL THEN
    EXECUTE 'LOCK TABLE public.source_event_revisions IN ACCESS EXCLUSIVE MODE';
  END IF;
  IF pg_catalog.to_regclass('public.draft_decisions') IS NOT NULL THEN
    EXECUTE 'LOCK TABLE public.draft_decisions IN ACCESS EXCLUSIVE MODE';
  END IF;
  ```
  Với thứ tự này cùng kịch bản cho: lệnh xác nhận **được lưu**, tệp lùi **từ chối** vì quyết định mang vị trí (đúng nghĩa R-S-1: không mất vị trí). N18 vẫn đỏ khi bỏ khoá `draft_decisions`; thêm một ca chữ cho thứ tự hai khoá.

### R-DB-12 · [P3] Chú thích «lần hai không xin khoá mạnh hơn» chưa đúng với hai bảng mới

- **Vị trí:** `migrations/023_thread_order.sql:35-41` (đoạn «Lock window»; câu «A second run asks for the same locks and for no stronger one» ở `:40-41`).
- **Đo [đo, `pg_locks`, lần áp thứ hai]:** đúng cho `source_event_revisions` và `ai_drafts` (chỉ `SHARE ROW EXCLUSIVE`) và cho `draft_decisions` (`ACCESS EXCLUSIVE`, như lần đầu); **không** đúng cho `intake_thread_heads` và `source_revision_positions`: `ACCESS EXCLUSIVE` từ bước 2 và 3 (`DROP TRIGGER IF EXISTS`, `DROP POLICY IF EXISTS`, `ALTER TABLE … ENABLE/FORCE ROW LEVEL SECURITY`) tới commit. Hệ quả: một lệnh đọc hai bảng đó (`threadFreshness` của Task 5, vai runtime) chờ suốt lần áp lại; lệnh nhận tin không bị thêm gì (đã chờ ở khoá bảng bản sửa).
- **Mức:** P3: chữ, và cửa sổ ngắn (không có gì để đánh số ở lần hai), A12 đặt tên đúng phạm vi («a reader of the revision table»).
- **Sửa:** sửa câu cho đúng («… for no stronger one on the revision table and the draft table; the two new tables are locked ACCESS EXCLUSIVE by the steps that drop and create their triggers and policies»), hoặc bọc các bước 2–6 trong kiểm catalog để lần hai không chạm hai bảng đó.

### 6.3 · Đã thử mà không phá được (đợt này)

- Hai khoá bảng mới ở bước 1 trên cả hai chiều chờ (giao dịch nhận tin đang bay; nháp AI đang ghi): tệp chờ, rồi kiểm sau khi chúng commit (A11, A13); không vòng chờ trong thứ tự `source_event_revisions` → `ai_drafts` → `projects` → `draft_decisions` so với nhận tin, ghi nháp, xác nhận, ghi ánh xạ.
- Trần trên dữ liệu đã đánh số: không còn chặn lần áp lại (0,37 s ở 300 000 bản).
- Đánh số dòng cũ không đổi (không đụng thân CTE); việc bỏ `WHERE h.last_seq < EXCLUDED.last_seq` an toàn theo lập luận trên (số gán luôn lớn hơn số cũ; đường ghi `intake_thread_heads` bị khoá).
- Các đột biến sống sót lần trước (`h.project_id`, khoá ngoại của `intake_thread_heads`, `IF false AND`, `FOR SHARE`) nay đều bị bắt (xem 6.1); đột biến bỏ `x.project_id` của ứng viên cũng bị bắt (B4). Tôi không chạy lại các đột biến đã bị bắt lần trước (`ORDER BY` bỏ `r.id`, `>= 0`, `search_path`, `GRANT` thừa, không khoá và `FOR KEY SHARE` của trigger quyết định): các ca đó không đổi trong đợt sửa này.
