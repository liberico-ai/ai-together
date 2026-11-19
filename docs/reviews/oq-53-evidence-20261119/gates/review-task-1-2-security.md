VERDICT: CHANGES_REQUIRED

# Ghế bảo mật (tầng 1, soát mã) · PR OQ-53 · Task 1 và Task 2 · migration 023

Ghế: bảo mật, chỉ tìm và xếp hạng (R1/R2); không sửa `src/`, `migrations/`, `tests/`, kế hoạch; không commit. Đối tượng: `migrations/023_thread_order.sql`, `migrations/rollback/023_thread_order.sql`, `tests/thread-order.test.ts`, `tests/thread-order-concurrency.test.ts`, phần đổi của `tests/migrations-rollback.test.ts`, `tests/z4-schema.test.ts`, `tests/z4-pointer-guard.test.ts` (`git diff 80c1ad8`), đầu `4076ba7`. Kế hoạch 0.3 mục 5–9, 13, 16–17 và hai báo cáo cổng kế hoạch (`plan-security-round-1.md`, `plan-database-round-1.md`) là mốc đối chiếu.

Cách làm: đọc SQL thật từng dòng; đo trên PostgreSQL 16.15 native, CSDL riêng của ghế (đã bỏ cuối phiên), với login thật `libetech_web` (không superuser) cho các phép thử quyền và với `SET LOCAL ROLE` cho `libetech_intake`, `libetech_ai`. Không tin log của builder: không dùng tệp nào trong `docs/reviews/oq-53-evidence-20261119/logs/`. Đã chạy lại xanh trên CSDL riêng: `thread-order` (20 ca), `thread-order-concurrency` (13 ca), `rls-catalog`, `z4-schema` (26), `z4-pointer-guard` (40), `migrations-rollback` (10). Đã chạy 26 đột biến (mục cuối). Các kịch bản `probe-N` là tập lệnh node/SQL của ghế trong thư mục tạm, không đưa vào repo. Nhãn: [đo] = ghế đo trong phiên này; [mã] = đọc từ tệp; #inference = chưa kiểm.

Không tìm thấy P0: không rò dữ liệu giữa dự án/tenant/miền, không leo quyền, không thêm role nào quyền ngoài ý định, role AI vẫn không chạm hai bảng mới hay cột mới (AR-03 giữ), không oracle mới trước hoặc dưới RLS. Lý do CHANGES_REQUIRED là một lỗi lớp «kiểm rồi bên khác commit» trong chính tệp lùi (R-S-1, P1), mà cổng Codex của PR #22 không nhận làm phần dư.

Số finding: P0 0 · P1 1 · P2 2 · P3 4.

---

## Findings

| Mã | Mức | Vị trí | Lỗi (một câu) | Chủ |
|---|---|---|---|---|
| R-S-1 | P1 | `migrations/rollback/023_thread_order.sql:20-33` | Tệp lùi kiểm «có dòng quyết định mang vị trí không» rồi mới xin khoá bảng; một lệnh xác nhận đang bay commit giữa hai việc đó thì cột `subject_thread_seq` bị xoá cùng vị trí vừa ghi | Builder |
| R-S-2 | P2 | `migrations/023_thread_order.sql:240-242` và các ca B4, N10 | Dòng lọc `tenant_id`/`project_id` của câu khoá dòng đếm trong trigger quyết định không có ca nào giữ: bỏ nó đi, 0 ca đỏ, và một xác nhận cũ được nhận | Builder |
| R-S-3 | P2 | `migrations/023_thread_order.sql:56-66`, `:161-165` | Hai phép từ chối P6 (cơ chế «cơ học» đóng S-1/L8) là kiểm-rồi-commit: không khoá `intelligence.ai_drafts`, phép (ii) chạy ở đầu giao dịch | Builder |
| R-S-4 | P3 | `tests/thread-order.test.ts:353-361` | Nhánh từ chối P6 (ii) chỉ được «kiểm» bằng chữ của tệp; hành vi kiểm được mà không tạo role nào | Builder |
| R-S-5 | P3 | `migrations/023_thread_order.sql:134-135`, `:214-215`, `:233-234` | Ba tra cứu phòng thủ-chiều-sâu (nguồn tin, nháp, ứng viên) không có ca âm: 3 đột biến sống | Builder |
| R-S-6 | P3 | `migrations/023_thread_order.sql:122-123` | `libetech_runtime` có `SELECT` trên hai bảng mới nên giữ được `ACCESS SHARE` (`LOCK TABLE`) trong một giao dịch mở và chặn mọi DDL kế tiếp (tệp lùi, 024) | Builder, vận hành |
| R-S-7 | P3 | `migrations/023_thread_order.sql:128-129`, `:209-210` | Chủ hai hàm definer là superuser (cùng mẫu 022): bán kính nổ lớn nhất có thể; hôm nay an toàn vì mọi tên đều có tiền tố schema | Chairman duyệt, Builder |

### R-S-1 [P1] Tệp lùi: kiểm trước, khoá sau, nên một lệnh xác nhận đang bay làm mất vị trí đã ghi

Vị trí: `migrations/rollback/023_thread_order.sql:25-30` (khối kiểm `carrying`) rồi `:33` (`DROP TRIGGER`, xin `ACCESS EXCLUSIVE` trên `draft_decisions`), `:43` (`DROP COLUMN`). Không có `LOCK TABLE` nào trước phép kiểm.

Lỗi: câu kiểm `SELECT EXISTS (… WHERE subject_thread_seq IS NOT NULL)` chạy với ảnh chụp của chính nó; một dòng quyết định chưa commit của một giao dịch khác không nằm trong ảnh chụp đó. `DROP TRIGGER` sau đó chờ giao dịch kia (khoá `ROW EXCLUSIVE` của nó), và khi nó commit thì tệp lùi đi tiếp, không kiểm lại, và `DROP COLUMN` xoá vị trí của dòng vừa commit. Đúng lớp «kiểm rồi bên khác commit»; dòng đầu tệp (mục 2) và DB-9 của cổng khẳng định tệp từ chối «sau lần xác nhận đầu tiên», nên cam kết đó bị phá.

Kịch bản [đo, probe-1]: nháp ứng viên có vị trí đọc 1. Phiên C (`libetech_runtime`, phạm vi dự án) ghi dòng `confirmed` kèm `subject_thread_seq = 1`, chưa commit. Phiên R chạy nguyên văn tệp lùi. Sau 1,5 giây C commit. Kết quả: R chạy xong trong 1 525 ms, không lỗi; `pg_attribute` không còn cột `subject_thread_seq`; `023` không còn trong `schema_migrations`; dòng quyết định `confirmed` của nháp ứng viên còn đó và sau khi áp lại 023 nó mang `subject_thread_seq` rỗng, tức một lệnh xác nhận ứng viên không vị trí, thứ mà trigger đảm bảo không tồn tại. Hậu quả: mất siêu dữ liệu của một quyết định (bảng bất biến, không sửa được lại), bất biến «mọi xác nhận ứng viên đều mang số» vỡ im lặng, và hai bên (S-6 của cổng, chú thích cột) không còn đúng với dòng đó.

Điều kiện kích hoạt: người vận hành chạy tệp lùi trong lúc một lệnh xác nhận đang bay. Đầu tệp đã dặn «chỉ lùi khi đường ghi AI đã đóng», nhưng lệnh xác nhận là đường của người (role runtime), không phải đường AI; lời dặn không phủ nó. Đầu tệp (mục 2) và DB-9 tuyên bố từ chối, nên đó là một cam kết bị phá chứ không phải một giới hạn đã nêu.

Cách sửa (đã thử trong thư mục tạm, không đụng repo): thêm vào đầu khối `DO`, trước mọi phép kiểm, một lệnh khoá bảng có canh `to_regclass`:

```
IF pg_catalog.to_regclass('public.draft_decisions') IS NOT NULL THEN
  EXECUTE 'LOCK TABLE public.draft_decisions IN ACCESS EXCLUSIVE MODE';
END IF;
```

Cùng kịch bản với bản sửa [đo, probe-1b]: R chờ C, C commit, R thấy dòng và dừng với `P0001 Roll back stops: a decision of a person carries the position of its thread`; cột và bản ghi `023` còn nguyên. `lock_timeout = 5s` của tệp giữ nguyên: nếu C không commit trong 5 giây thì tệp lùi hỏng sạch bằng `55P03`. Ca cần thêm (native, hai kết nối; mẫu N8): giữ một lệnh xác nhận mở, chạy tệp lùi với `waitForBlocked`, commit, rồi khẳng định tệp lùi từ chối và `column`, `023` còn đó. Đột biến `m12` (bỏ nhánh từ chối) hiện đã đỏ ở RB-023, nhưng ca đó là tuần tự nên không thấy khe này.

### R-S-2 [P2] Dòng lọc phạm vi của câu khoá dòng đếm không có ca nào giữ

Vị trí: `migrations/023_thread_order.sql:240-242` (`WHERE h.tenant_id = NEW.tenant_id AND h.project_id = NEW.project_id AND h.chat_id = c.chat_id AND h.thread_key = c.thread_key FOR NO KEY UPDATE`); ca liên quan `tests/thread-order.test.ts:533-572` (B4), `tests/thread-order-concurrency.test.ts:331-361` (N10).

Lỗi: hàm chạy với `row_security = off` bằng quyền superuser, nên chỗ duy nhất giữ ranh giới dự án/tenant của phép so-và-khoá là các vị từ tay này. Bỏ `h.project_id = NEW.project_id` (đột biến m6) hoặc `h.tenant_id = NEW.tenant_id` (m6b): cả hai file thread-order và thread-order-concurrency vẫn xanh nguyên (20/20 và 13/13), 0 ca đỏ [đo, chạy lại trong bản sao cô lập của HEAD sau khi gỡ phần dư của m21]. Ca B4 có dạng «chung chat và khoá luồng ở hai dự án» nhưng nó chỉ kiểm tầng tra ứng viên (`:234`): ứng viên của dự án khác không thấy được nên dừng ở `LTZ03` trước khi chạm dòng đếm.

Hậu quả thật của đột biến [đo, probe-8b]: dự án A (id nhỏ hơn) có dòng đếm 1; dự án B có dòng đếm 3, một ứng viên và một nháp; dịch vụ đọc vị trí 1 của B trước khi hai tin nữa đến. Với câu tra bỏ `project_id`, lệnh xác nhận vị trí 1 của B được **lưu** (`STORED`), vì câu chọn hàng của A trước; với mã thật nó bị `LTZ03`. Tức đây là đúng lỗ CX3 (xác nhận một nháp đã cũ) mà cả PR sinh ra để đóng, hiện chỉ được giữ bằng một dòng không có ca. Hình dạng «một (chat_id, thread_key) ở hai dự án» có thật trên đường mã: `src/server/intake.ts:72` tra `thread_key` của tin cha không theo dự án, còn `:52` lấy dự án theo cấu hình chat hiện hành; sau một lần đổi dự án của nhóm, một tin trả lời tin cũ nhận khoá luồng của dự án cũ trong dự án mới (#inference về vận hành: đổi cấu hình chat; đường mã là [mã]). Ngoài lỗ đúng-sai còn kênh khoá: câu tra bỏ lọc có thể khoá, và chờ, dòng đếm của dự án khác (`row_security = off`; `SELECT … INTO` lấy hàng đầu tiên theo thứ tự quét), tức một lần chờ chéo phạm vi. Mã thật không có kênh đó [đo, probe-4: 1 ms, không chờ, kể cả khi luồng cùng khoá của dự án khác đang bị giữ].

Quy tắc: E-TEST-01 là MUST và đòi cô lập có ca cho mọi truy vấn đa tenant; ở đây phép lọc tay thay cho RLS nên mỗi vị từ là một ranh giới.

Cách sửa: thêm vào B4 (hoặc ca mới), cả hai engine: dự án A có luồng (chat, khoá K) với dòng đếm 1, dự án B cùng (chat, K) với ứng viên, nháp và dòng đếm 3; lệnh xác nhận ở B với vị trí 1 phải ra `LTZ03`, và ngược lại (B vị trí đúng, A dòng đếm khác) phải lưu được. Cho tenant: một ca tương tự với hai tenant cùng (chat, K) (khoá ngoại cho phép, `source_events` duy nhất theo tenant). Native, mẫu N10: giữ luồng cùng (chat, K) của dự án A, lệnh xác nhận ở B hoàn tất dưới 100 ms. Hai đột biến m6, m6b phải đỏ.

### R-S-3 [P2] Hai phép từ chối P6 là kiểm-rồi-commit

Vị trí: `:61-65` (P6 (ii), đầu giao dịch, trước `LOCK TABLE` ở `:154` có thể chờ tới 5 giây) và `:161-165` (P6 (i)); không có `LOCK TABLE` nào lên `intelligence.ai_drafts`.

Lỗi: kế hoạch gọi P6 là «cơ chế cơ học» đóng S-1 và L8; cả hai phép là kiểm tại một thời điểm, rồi giao dịch còn chạy tới commit (bước 2–12, có thể tới vài giây dưới trần 500 000 bản). Một nháp ứng viên chưa quyết định do role AI ghi, hoặc một phiên của login thành viên `libetech_ai` bắt đầu, sau thời điểm kiểm và trước commit, không bị thấy. Kế hoạch và đầu tệp chỉ nêu khe «một lần chạy đã ngắt kết nối» (N10), không nêu cửa sổ này.

Mức: P2 vì hậu quả bị hai điều khác chặn: hôm nay không login nào là thành viên `libetech_ai` (`pg_auth_members` trên CSDL riêng; `tests/thread-order.test.ts:358` đếm 0) và Z4 chưa bật; và mọi nháp cũ nhận `MANIFEST_MISMATCH` khi hợp đồng đổi (C8, Task 3–4, ngoài phạm vi review này). Tức an toàn vì thứ tự triển khai và nhãn manifest, không vì P6 (ghi nhận, giống nhận xét DB-9 của cổng CSDL cho khe L8).

Cách sửa (rẻ, Z4 tắt nên không ai bị chặn): trước các phép kiểm, `LOCK TABLE intelligence.ai_drafts IN SHARE ROW EXCLUSIVE MODE` (nháp mới phải chờ tới commit rồi bị các guard mới của chính nó xét); đặt lại phép (ii) ngay trước `INSERT INTO schema_migrations`, sau mọi khoá; ghi vào đầu tệp phần còn lại không đóng được (một login kết nối sau phép kiểm cuối) làm N10.

### R-S-4 [P3] Nhánh từ chối P6 (ii) kiểm được bằng hành vi mà không tạo role nào

Vị trí: `tests/thread-order.test.ts:353-361` (khẳng định trên chữ của tệp), và ghi chú «không viết được ca» ở `:358`, N14 của kế hoạch.

Đo [probe-6]: vị từ nguyên văn của bước 1, thay `libetech_ai` bằng `libetech_runtime` (một role có login thành viên sẵn: `libetech_web`), cho: chỉ phiên superuser (kể cả `SET ROLE libetech_runtime`) → `false`; một login `libetech_web` đang kết nối → `true`; login đó đang trong giao dịch sau `SET LOCAL ROLE libetech_runtime` → `true` (`pg_stat_activity` chỉ hiện `libetech_web`); login thoát → `false`. Vậy một ca native có thể thay chuỗi `'libetech_ai'` bằng `'libetech_runtime'` trong khối kiểm của tệp (một phép thay trên chữ, nhánh từ chối vẫn là nhánh thật) và giữ một phiên `h.db` (login web) mở khi chạy tệp: kỳ vọng từ chối bằng lời cố định. Không tạo role cluster-wide nào, không đổi quyền thật. Đột biến m8 (bỏ `NOT r.rolsuper`) hiện đã đỏ nhờ ca native «other superuser sessions open»; xoá hẳn phép kiểm (ii) khỏi tệp thì ca native vẫn xanh (nó khẳng định tệp chạy được) và chỉ ca chữ đỏ (#inference, đột biến này không chạy riêng).

### R-S-5 [P3] Ba tra cứu phòng thủ không có ca âm

Đột biến sống [đo]: m23 (tra ứng viên bỏ `tenant_id`, `:234`), m24 (tra nguồn tin của bản sửa bỏ cả `tenant_id`, `project_id`, `:134-135`), m25 (tra nháp của guard mới bỏ `project_id`, `:214-215`). Cả ba là thừa theo thứ tự hôm nay (khoá ngoại trả lời trước; guard của 021 chạy `BEFORE` và dừng trước; khoá ngoại `(project_id, tenant_id)` buộc cặp), tệp ghi rõ «defence in depth». Chúng chỉ có nghĩa khi một lớp kia vắng; B7 đã tắt guard 022 để thử đúng kiểu này nhưng không có ca tắt 021. Nếu giữ chữ «phòng thủ» trong tệp thì nên có một ca B7 tương tự: tắt `draft_decisions_guard` trong một giao dịch rồi chạy lại hai dạng chéo dự án của B4. Không chặn merge.

### R-S-6 [P3] Giữ khoá bảng bằng `LOCK TABLE ... ACCESS SHARE`

`libetech_runtime` có `SELECT` nên `LOCK TABLE public.intake_thread_heads IN ACCESS SHARE MODE` thành công [đo, probe-2]; giữ nó trong một giao dịch mở chặn mọi `ACCESS EXCLUSIVE` lên bảng (`DROP TABLE` của tệp lùi, `ALTER` của migration sau) tới hết `lock_timeout` 5 giây. Mọi bảng có `SELECT` cho runtime đều thế, không phải đặc thù của 023, và các mức từ `ROW EXCLUSIVE` lên bị từ chối [đo]. Ghi lại cạnh điều kiện N1 (`idle_in_transaction_session_timeout` của login web) và vào cảnh báo triển khai/lùi: nên kiểm `pg_locks` trước khi áp hoặc lùi.

### R-S-7 [P3] Chủ hàm là superuser

Hai hàm do login migration (superuser) sở hữu và `SET row_security = off`: mọi tên bảng đều có tiền tố schema, hàm và toán tử đều ở `pg_catalog` hoặc qua OID, `pg_temp` ở cuối. Đã thử bóng tên: bảng tạm `pg_temp.intake_thread_heads`, `pg_temp.intake_candidates`, toán tử `pg_temp.<>`, `search_path = pg_temp, public` của phiên: hàm vẫn dùng bảng thật [đo, probe-3]. Hôm nay đúng; chỉ ghi rằng lần sửa tay sau này bỏ một tiền tố là một lỗ thực thi mã bằng quyền superuser. Phương án giảm bán kính (một role chủ NOLOGIN có `BYPASSRLS` và quyền hẹp) là quyết định kiến trúc ngoài PR này; 022 đã chọn cùng mẫu. Có thể thêm một ca catalog khẳng định thân hàm không chứa tên bảng không tiền tố.

---

## Đối chiếu với hai báo cáo cổng kế hoạch

| Mã | Đã vào mã/ca ở đâu | Còn thiếu |
|---|---|---|
| S-1 (P6 (ii), bỏ cột «lúc đánh số», N10) | Khối kiểm `023:61-65` (loại superuser, loại phiên chính nó, `pg_has_role(...,'MEMBER')` nên bắt cả login NOINHERIT); đầu tệp lùi `:13-16` nêu điều kiện vận hành; ca `A8 (iii)` chữ + ca native phiên superuser mở. Vị từ đã đo hành vi [probe-6] | Khe kiểm-rồi-commit của chính P6 (R-S-3); khe tệp lùi (R-S-1); ca hành vi (R-S-4) |
| S-2 (mã pipeline ghi `messageRevisions`) | Không thuộc Task 1–2 | Task 4 |
| S-3 (phần đuôi `decide`) | Không thuộc Task 1–2 | Task 7 |
| S-4 (chữ về khoá; trigger không chạy khi một dòng vi phạm RLS) | Đầu `023:8-11` đúng với phép đo; A5 và N5 có hai dạng hai dòng (`VALUES`, `INSERT … SELECT`). Đã đo lại: 42501 sau 0–1 ms, trigger không chạy, dòng trong phạm vi cũng không được khoá [probe-4] | — |
| S-5 ý 1 (SELECT thuần của mọi role) | A3: mọi `libetech_*` + login web native; đột biến m1 (cấp thừa `SELECT` cho intake) đỏ ở A3 | — |
| S-5 ý 2 (gửi lại không khoá) | N16 (kết nối thứ hai `NOWAIT`) | Câu «`FOR UPDATE` thừa ở trigger làm N16 đỏ» sai về logic: trigger không bao giờ chạy cho bản gửi lại, nên đột biến m20 sống. Nó cũng không có hệ quả (không ai giữ `KEY SHARE` trên dòng đếm), tức tương đương; chỉ chỉnh chữ |
| S-5 ý 3 (hai dòng trộn phạm vi) | A5 ba dạng, N5 ba dạng, kèm thời gian dưới 100 ms | — |
| S-5 ý 4 (lời `23503`) | A9. Nhánh `NOT FOUND` của trigger không với tới được (khoá ngoại trả lời trước, test ghi rõ); lời của khoá ngoại không mang id vì role không có `SELECT` đủ cột dưới RLS (`Key is not present in table "source_events".`) [probe-7] | — |
| S-5 ý 5 (B4 đúng mã đúng lời) | B4: `P0001` đúng lời và `where` có `draft_decisions_guard`, không có tên guard mới; dạng `decided_by`: `42501`. Đã đo lại [probe-4, probe-7] | — |
| S-5 ý 6 (hai dạng đột biến khoá) | Đo lại: `FOR KEY SHARE` (m19) đỏ N7, N8, N11, N17. Bỏ khoá hẳn: tương đương về hành vi với m19 (#inference, không chạy riêng) | — |
| S-5 ý 7 (B6/P10: mỗi guard của 021, 022 vẫn có ca trên nháp ứng viên) | B6 (021 ba nhánh; 022 `LTZ02`, `LTZ01`), ca P6 của pointer-guard, ca mới của z4-schema. Đã kiểm hai ca z4 đã đổi: ý còn nguyên (ca «attach a revision» giữ nhánh ứng viên bằng `candidate` rõ ràng ở `z4-schema.test.ts:236-237`; chỉ ca «xác nhận không kèm bản sửa» chuyển sang ứng viên thật kèm vị trí); G12 chỉ thêm tên trigger vào danh sách loại trừ | — |
| S-6 (câu «không bằng chứng» ở đầu tệp và comment cột; `tgenabled='O'`) | `023:25-27`, `:196-197`; A6 và B5 khẳng định `tgenabled='O'`, `col_description` mang đúng câu | — |
| S-7, S-8, S-9 | Không thuộc Task 1–2 | Task 8, vận hành |
| DB-1 (idempotent) | `DROP TRIGGER/POLICY IF EXISTS` trước `CREATE`; `CREATE INDEX IF NOT EXISTS`; ràng buộc trong khối `DO`; A6, B5 áp lần hai. Tự áp tệp nhiều lần trên CSDL riêng: sạch | — |
| DB-2 (trần, `ACCESS EXCLUSIVE`, `ANALYZE`) | Cap `:156-160` (m17 đỏ); bước 10–11 cuối tệp `:193-251`; `ANALYZE` `:254`. Chặn P6 (i) kiểm bằng đột biến m16 (đỏ ở A7) | Ý (c) không áp, đúng như kế hoạch |
| DB-3 (ngoại lệ E-DB-12) | `023:33-34` | — |
| DB-5 (mã của role ngoài phạm vi) | B4, N10 đúng `P0001`/`42501` | — |
| DB-6 (cạnh phân loại) | N17; không `40P01` ở N11 và N17 | — |
| DB-7 (A2 bỏ `xmax`) | A2 so `updated_at` và `last_seq`; N16 | — |
| DB-9 (lùi: chỉ còn đường tiến) | Đầu tệp lùi `:7-12`; RB-023 kiểm nhánh từ chối trong một giao dịch | Khe tranh chấp (R-S-1) |
| DB-10 (catalog, chữ lỗi) | A3, A6, B5 catalog; chữ cố định `LTZ03` | — |

Điều «không đổi» (g): đã đo bằng catalog đủ phạm vi `public`, `intelligence`, `identity`, `analytics`, bật và tắt 023 trên CSDL riêng: quyền bảng và cột, chính sách, ràng buộc, chỉ mục, hàm, role, thành viên đều **giống nhau** ngoài hai bảng mới, hai hàm, hai trigger, cột `subject_thread_seq` (cùng ràng buộc và quyền `INSERT` cột của runtime). `source_events`, `intake_candidates`, `intake_attachments`, `intake_events` không có trigger mới; `source_event_revisions` có đúng một (`source_event_revisions_thread_position`, `AFTER INSERT`, loại 5); `draft_decisions` có đúng một (`draft_decisions_subject_order_guard`, loại 5) cạnh ba trigger cũ. `libetech_intake` không thêm quyền nào. `src/` không đổi dòng nào (`git diff 80c1ad8 --stat` không có tệp `src/`). Không role nào được cấp `UPDATE` hay `DELETE` trên `draft_decisions`.

## Ba lớp mà cổng Codex không nhận «phần dư đã ghi»

1. Kiểm-rồi-bên-khác-commit: R-S-1 (P1, tệp lùi) và R-S-3 (P2, hai phép P6). Phép so-và-ghi chính của PR (trigger quyết định, khoá `FOR NO KEY UPDATE`, đọc lại sau chờ ở READ COMMITTED) không có khe: đo lại 3 thứ tự (nhận tin đang bay rồi commit, rồi rollback, xác nhận trước) và đột biến m19 làm 4 ca native đỏ.
2. Oracle trước/dưới RLS, kể cả thời gian: không tìm thấy [probe-4]. Mười ba phép thử trong và ngoài phạm vi, kể cả dạng chung `(chat_id, thread_key)` ở hai dự án: ngoài phạm vi 0–2 ms, ca đối chứng trong phạm vi chờ trọn 5 004 ms rồi `55P03`.
3. Hash của nội dung bị che: 023 không thêm cột nào mang hash hay chữ. Hai bảng mới chỉ có id, chat_id, thread_key, số. Không có.

## Điều tôi đã thử mà không phá được

- Gọi trực tiếp, sao chép bằng `CREATE TRIGGER`, `ALTER FUNCTION`/`OWNER`/`SET search_path`, `CREATE OR REPLACE`, `DISABLE TRIGGER`, `SET session_replication_role`, `SET ROLE`/`SET SESSION AUTHORIZATION` tới login vận hành, role AI, role intake: bị từ chối ở cả ba role `libetech_runtime`, `libetech_intake`, `libetech_ai` và, với login thật `libetech_web`, ở mọi bước (`permission denied` hoặc `must be owner`) [probe-2, probe-2b]. Không role nào có `EXECUTE`, `CREATE` trên `public`, hay quyền ghi trên hai bảng; `COPY ... TO` file bị từ chối.
- Bóng tên qua `pg_temp` (bảng, toán tử) khi phiên đặt `search_path = pg_temp, public`: hàm không dùng chúng [probe-3].
- Khoá và thời gian: `SELECT ... FOR KEY SHARE|SHARE|NO KEY UPDATE|UPDATE`, `LOCK TABLE` mức ghi, `TRUNCATE`, `COPY`: bị từ chối với mọi role. `LOCK TABLE ... ACCESS SHARE` được cho runtime (R-S-6). Chèn bản sửa của dự án khác (một dòng, hai dòng `VALUES`, `INSERT … SELECT`), chèn quyết định cho nháp của dự án khác, cho nháp của dự án mình nêu ứng viên dự án khác, `decided_by` khác, phạm vi tenant khác: tất cả trả lời dưới 3 ms trong lúc luồng liên quan đang bị giữ; đối chứng trong phạm vi chờ 5 004 ms rồi `55P03` [probe-4].
- Lời lỗi: `LTZ03`, `23514`, `P0001`, `23503` không mang id, số hay dữ liệu hàng (`message`, `detail`, `hint`) [probe-7]. Một điểm ghi lại, không phải finding: `55P03` từ trong hàm trả `where` kèm văn bản câu SQL, tên bảng đếm và ctid cho người chờ trong phạm vi (không dữ liệu); tuyến HTTP đã che (`src/server/http.ts`), và N8 của kế hoạch giữ yêu cầu bọc `55P03`.
- Đối chiếu quyền: ma trận `has_table/column/function_privilege` cho mọi `libetech_*` (chỉ runtime có `SELECT` hai bảng và `SELECT`, `INSERT(cột)` trên cột mới), ACL cột `draft_decisions` (mười hai cột có `INSERT` cho runtime, không có `UPDATE`), `pg_default_acl` rỗng, `public` không `CREATE` cho `libetech_*` [đo].
- Login web thật: không `SET ROLE` tới role AI, intake hay vận hành; không đọc được hai bảng khi không `SET ROLE libetech_runtime`; khi đã `SET ROLE`, 0 dòng không phạm vi, 1 dòng đúng phạm vi, 0 dòng phạm vi dự án khác [probe-2b].
- Tệp lùi: không `CASCADE`, `DROP ROLE`, `DROP SCHEMA`; từ chối khi còn bản ghi sau (RB-023); chạy lại hai lần sạch; sau lùi, áp lại số lại các bản cũ và P6 (i) từ chối khi còn nháp ứng viên chưa quyết định [đo]. Riêng khe tranh chấp thì phá được (R-S-1).
- Hai trần P12 và P6 (i) và việc từ chối khi không phải superuser: có nhánh hành vi và đều đỏ khi bỏ (m11, m16, m17).
- Số `thread_seq` và `last_seq`: không có sequence toàn cục nào nên không rò khối lượng giữa tenant; khoá duy nhất `(tenant, project, chat, thread, seq)` biến mọi lần hạ `last_seq` bằng tay thành lỗi to thay vì số trùng.
- Rò bí mật trong các tệp đổi (repo công khai tạm thời): quét theo mẫu khoá, chuỗi kết nối, đường dẫn máy, tên máy; không có. Chỉ có `127.0.0.1:55471` và tên CSDL thử trong `measurements-pg16.txt` và `probe-*.cjs` (loopback, không phải bí mật).

## Đột biến đã chạy (CSDL riêng, PostgreSQL 16.15 native)

Đỏ nghĩa là có ít nhất một khẳng định (`AssertionError` hoặc lỗi lời cố định), không phải hết giờ của hook; khi hết giờ là hệ quả phụ tôi ghi chú.

| Đột biến | Kết quả |
|---|---|
| m1 cấp `SELECT` thừa cho `libetech_intake` | đỏ A3 |
| m2 bỏ `REVOKE ... FROM PUBLIC` của hàm guard | đỏ B5 |
| m3 `search_path` của guard thành `public, pg_temp` | đỏ B5 |
| m4 bỏ `row_security = off` của guard | đỏ B5 |
| m5 tra ứng viên bỏ `tenant_id` và `project_id` | đỏ B4 |
| m6 khoá dòng đếm bỏ `project_id` | **sống**; hậu quả đo ở R-S-2 |
| m6b khoá dòng đếm bỏ `tenant_id` | **sống** |
| m7 chính sách của bảng số bỏ vị từ dự án | đỏ A3, A6 |
| m8 phép P6 (ii) bỏ `NOT r.rolsuper` | đỏ A8 (iii) hai ca |
| m9 guard bỏ kiểm cô lập READ COMMITTED | đỏ B7 |
| m10 guard coi mọi nháp là không phải ứng viên | đỏ B1, B3, B6, B7 |
| m11 bỏ kiểm superuser | đỏ A8 (ii) |
| m12 tệp lùi bỏ nhánh từ chối khi có vị trí | đỏ RB-023 |
| m13 đánh số dòng cũ bỏ `last_seq` hiện có | đỏ A7b |
| m14 so `<` thay `<>` | đỏ B1, B3 |
| m15 hàm bản sửa bỏ `lock_timeout` | đỏ A6 |
| m16 bỏ P6 (i) | đỏ A7 |
| m17 bỏ trần P12 | đỏ A8 (i) |
| m18 bỏ `FORCE` RLS bảng đếm | đỏ A6 |
| m19 khoá phía quyết định `FOR KEY SHARE` | đỏ N7, N8, N11, N17 |
| m20 thêm `FOR UPDATE` thừa trong trigger bản sửa | sống; tương đương hành vi (S-5 ý 2) |
| m21 thêm trigger `BEFORE` khoá dòng đếm trước RLS | đỏ N5 (hết giờ), kèm N4, N16 hệ quả phụ |
| m22 guard quyết định chuyển `BEFORE` | đỏ N10 (`55P03` thay `42501`) và B2, B3, B5 |
| m23 tra ứng viên bỏ `tenant_id` | sống (R-S-5) |
| m24 tra nguồn tin của bản sửa bỏ lọc | sống (R-S-5; không với tới được) |
| m25 tra nháp của guard bỏ `project_id` | sống (R-S-5) |

Lưu ý quy trình cho người nhận báo cáo: ghế CSDL chạy song song **trong cùng worktree** và cũng đột biến `migrations/023_thread_order.sql` tại chỗ (tôi thấy một bản đã đổi, không phải của tôi, lúc 12:23). Để hai ghế không giẫm nhau, từ m21 tôi chạy mọi đột biến trong một bản sao `git archive HEAD` ngoài repo (có nối `node_modules`); các đột biến m1–m20 chạy trước đó trong worktree, mỗi lần khôi phục từ `git show HEAD` và kiểm `git status`. Các đột biến sống m6, m6b, m23, m24, m25 đã chạy lại trong bản sao cô lập sau khi tôi gỡ phần dư của m21 (trigger `zz_lockfirst` còn lại trong CSDL riêng làm ca A7, A8 (i), N4, N5, N16 đỏ giả ở lần chạy đầu trong bản sao; lần đó bị loại, và với m22 tôi chỉ kể các ca đỏ thật là N10, B2, B3, B5). Cuối phiên `git status` của worktree chỉ còn tệp báo cáo của ghế CSDL (chưa theo dõi) và tệp này; `git diff` sạch.

## Ba sửa có đòn bẩy cao nhất

1. R-S-1: thêm `LOCK TABLE public.draft_decisions IN ACCESS EXCLUSIVE MODE` (canh `to_regclass`) vào đầu khối `DO` của tệp lùi, trước phép kiểm vị trí; thêm một ca native hai kết nối (xác nhận đang bay, tệp lùi, commit, tệp lùi từ chối). Một dòng mã, đã thử.
2. R-S-2: một ca (cả hai engine) cho `(chat_id, thread_key)` chung hai dự án, và một ca tenant, làm m6, m6b đỏ; thêm ca native không chờ chéo dự án. Đây là ranh giới cô lập của phép so-và-ghi, đang chỉ được giữ bằng một dòng không có ca.
3. R-S-3 cùng R-S-4: khoá `intelligence.ai_drafts` trước hai phép P6 và đặt lại phép (ii) cuối giao dịch; thay ca chữ của A8 (iii) bằng ca hành vi thay tên role (đã đo hành vi khớp thiết kế).

---

## Xem lại đợt sửa 2b (`00228a4`)

VERDICT: READY_FOR_GATE

Số finding mới: P0 0 · P1 0 · P2 0 · P3 3 (R-S-8, R-S-9, R-S-10). Không finding cũ nào còn mở ở mức P1 hoặc P2; R-S-3 đóng cho phép (i) và để lại một phần dư nhỏ của phép (ii) thành R-S-8.

Cách làm: `git diff 4076ba7 00228a4 -- migrations tests` đọc từng dòng. Mọi đột biến và mọi lần chạy vitest trong một bản `git archive 00228a4` ngoài repo, trên CSDL riêng của ghế (tạo lại, đã `DROP` cuối phiên), `pgrep -f '[v]itest'` bằng 0 và `uptime` trước mỗi lần chạy; một builder chạy vitest song song trong worktree nên có lúc phải chờ. Worktree không bị ghế này sửa (các tệp `M` và `??` trong đó là việc của builder cho Task 3).

Chạy lại xanh, native PostgreSQL 16.15: `thread-order` 27, `thread-order-concurrency` 17, `migrations-rollback` 10, `rls-catalog` 1, `z4-schema` 26, `z4-pointer-guard` 40. PGlite 18 (không dùng CSDL): `thread-order` 22 (5 bỏ qua, chỉ native), `migrations-rollback` 10, `z4-schema` 24, `z4-pointer-guard` 29. `CREATE OR REPLACE TRIGGER`, `LOCK TABLE` chạy được trên cả hai engine.

### Từng finding cũ

| Mã | Kết luận | Bằng chứng |
|---|---|---|
| R-S-1 (tệp lùi kiểm trước, khoá sau) | Đóng, đúng | Tệp lùi `LOCK TABLE public.draft_decisions IN ACCESS EXCLUSIVE MODE` (canh `to_regclass`) trước phép kiểm vị trí, sau phép kiểm bản ghi sau. Chạy lại đúng kịch bản của probe-1 với tệp mới [đo]: lệnh xác nhận đang bay, tệp lùi chờ 1,5 giây, rồi dừng bằng `P0001 Roll back stops: a decision of a person carries the position of its thread`; cột, trigger, bản ghi `023` và vị trí còn nguyên. Ca N18 (`thread-order-concurrency.test.ts:437`) và ca tĩnh trong RB-023: đột biến r1 (bỏ khoá) làm cả hai đỏ ([đo]; N18: `the rollback was expected to refuse`) |
| R-S-2 (ranh giới phạm vi của câu khoá dòng đếm) | Đóng, đúng | Đột biến m6 (bỏ `project_id` khỏi câu khoá) nay đỏ ở B8 (`9702 with the number of 9701: expected null not to be null`) và N20 (`The thread of the candidate moved on`). Ca B8 (`thread-order.test.ts:861`) dựng cùng `(chat_id, thread_key)` ở ba phạm vi (hai dự án cùng tenant, một dự án tenant khác), thử mọi cặp số của phạm vi khác (phải `LTZ03`) rồi số của chính nó (phải lưu); N20 (`:517`) giữ khoá dòng đếm của dự án mình trong giao dịch mở và khẳng định dòng của dự án kia còn tự do (`NOWAIT`) |
| R-S-3 (hai phép P6 kiểm-rồi-commit) | Đóng cho (i); (ii) còn phần dư nhỏ (R-S-8) | `LOCK TABLE intelligence.ai_drafts IN SHARE ROW EXCLUSIVE MODE` ở `023:88`, sau khoá bảng bản sửa `:87`, trước mọi phép kiểm; P6 (i) và (ii) chạy dưới hai khoá. A13 (`:918`): nháp đang ghi được chờ rồi thấy, tệp dừng `no person has decided`. Đột biến s1 (bỏ khoá `ai_drafts`) đỏ A13 và ca thứ tự của A8 (iii); s2 (phép kiểm trước khoá) đỏ A8 (iii) và A11 |
| R-S-4 (ca hành vi cho nhánh từ chối P6 (ii)) | Đóng, đúng | A10 và A11 thay đúng một lần `'libetech_ai'` bằng `'libetech_runtime'` trong vị từ (ca đếm vị từ chỉ có một lần trong tệp) và dùng login web thật (`h.db`). Khớp đo của ghế (probe-6): phiên superuser, kể cả sau `SET ROLE`, không bị đếm; phiên login web thì bị. Đột biến s3 (đếm cả superuser) đỏ A8 (iii) hai ca, A10, A11, A12, A13; s4 (xoá phép kiểm) đỏ A10 và A11 |
| R-S-5 (ba tra cứu phòng thủ) | Đóng, đúng | A9b tắt mọi trigger của bảng bản sửa trong một giao dịch sẽ lùi rồi bật lại đúng trigger cần thử; B9 tắt mọi trigger của bảng quyết định tương tự. m24 và m24b (bỏ vị từ của tra nguồn tin) đỏ A9b; m25 (bỏ `project_id` của tra nháp) đỏ B9; m5 (bỏ `project_id` của tra ứng viên) đỏ B4 |
| R-S-6 (`LOCK TABLE ... ACCESS SHARE`) | Đóng bằng tài liệu | Ghi chú d ở đầu `023:68`, nêu `pg_locks` và N1. Đúng với đo của ghế; không có mã để đổi |
| R-S-7 (chủ hàm là superuser) | Đóng bằng tài liệu | Ghi chú e ở đầu tệp. Ca catalog «không tên bảng không tiền tố» là tuỳ chọn, không làm: chấp nhận |

Ba đột biến chỉ-lọc-tenant sống (m6b: câu khoá dòng đếm bỏ `tenant_id`; m23: tra ứng viên bỏ `tenant_id`; m25b: tra nháp bỏ `tenant_id`) là **tương đương**; lập luận của builder đúng và đã kiểm lại: `projects.id` là khoá chính (`migrations/001_foundation.sql:14`) và cả ba bảng (`intake_thread_heads`, `intake_candidates`, `draft_decisions`) có khoá ngoại ghép `(project_id, tenant_id)` tới `projects(id, tenant_id)` [catalog đo]; thử chèn một hàng mang tenant khác tenant của dự án thì khoá ngoại từ chối (`23503`) cho cả bảng đếm và bảng ứng viên, bảng quyết định thì guard của 021 dừng trước. Nên `tenant_id = NEW.tenant_id` được hàm ý bởi `project_id = NEW.project_id`; một ca không dựng được phản ví dụ. Sự tương đương còn dựa vào các khoá ngoại ấy, và A6 nay khẳng định khoá ngoại của hai bảng mới (ca `defs`), còn của hai bảng cũ do 016 và 021 giữ. Các đột biến chỉ-lọc-dự-án (m6, m5, m24b, m25) đều đã đỏ.

### Lỗi bảo mật mới do đợt sửa

Hai khoá mới của migration không mở kênh dữ liệu nào. `SHARE ROW EXCLUSIVE` xung đột với `ROW EXCLUSIVE` (chèn), `SHARE UPDATE EXCLUSIVE`, `SHARE` và mạnh hơn; không xung đột với `ACCESS SHARE` (đọc) hay `ROW SHARE` (khoá dòng của khoá ngoại), nên người đọc và các khoá ngoại của lệnh xác nhận không chờ. Chỉ `libetech_ai` (quyền `INSERT` trên `ai_drafts`) và `libetech_intake` (trên bản sửa) giữ được một khoá xung đột; `libetech_runtime` chỉ lấy được `ACCESS SHARE` [đo trước đó, probe-2]. Khoá giữ bởi migration, không bởi role nào có phạm vi; người chờ (một lệnh ghi nháp của role AI) chỉ biết rằng bảng đang bị khoá, không biết gì của phạm vi khác; `pg_locks` vốn đọc được với mọi role.

Đo [probe-9, PostgreSQL 16.15]:

| Tình huống | Kết quả |
|---|---|
| Không ai giữ | áp xong 304 ms |
| Một nháp của role AI đang ghi (giữ `ROW EXCLUSIVE` trên `ai_drafts`) | migration chờ tới khi nháp commit rồi áp xong (2,7 giây); trong lúc chờ, một lệnh chèn bản sửa của role intake chờ rồi `55P03` (trần 1,5 giây đặt ở phía thử) |
| Một lệnh chèn bản sửa đang ghi | tương tự |
| Giao dịch thô ghi `ai_drafts` rồi ghi bản sửa (thứ tự ngược thứ tự của tệp) | `40P01`: **migration** là bên bị chọn, giao dịch thô đi tiếp; fail-closed, không để lại gì. Không mã nào của dịch vụ ghi hai bảng đó trong một giao dịch |

Không tìm thấy kênh mới nào về dữ liệu hay phạm vi. Ba P3 dưới đây:

**R-S-8 [P3] Phép kiểm login AI nằm ở đầu giao dịch, không ở cuối.** Vị trí: `023:90-93` (phép (ii) ngay sau hai khoá); đầu tệp `:50-52` nêu những gì phép kiểm không thấy nhưng bỏ sót khoảng giữa lúc kiểm và lúc commit. Một login thành viên `libetech_ai` kết nối sau phép kiểm và trước commit đọc ngữ cảnh khi các bản chưa có số (đọc không bị khoá), rồi ghi nháp sau commit (lệnh ghi bị khoá `ai_drafts` giữ lại tới lúc đó): đúng loại nháp mà P6 (ii) sinh ra để chặn. Khoá `ai_drafts` đã đóng phép (i) (nháp đang ghi) nhưng không đóng được việc đọc. Mức P3: không login nào như vậy hôm nay, Z4 tắt, và nháp như thế nhận `MANIFEST_MISMATCH` khi hợp đồng đổi (C8). Sửa rẻ: đặt lại phép (ii) ngay trước `INSERT INTO schema_migrations` (`:285`), vẫn dưới hai khoá (cửa sổ co từ vài giây xuống mili giây; ca A8 (iii) đang ghim thứ tự, cần đổi theo), và thêm một câu vào đầu tệp. Đây là điều tôi đề xuất ở R-S-3 mà builder chưa làm.

**R-S-9 [P3] Ca dùng `DISABLE TRIGGER` dạng đã commit không có lưới an toàn.** Vị trí: `tests/thread-order-concurrency.test.ts:468-513` (`turns(true)` của N19b, câu tắt ở `:470`, bật lại trong `finally`) và, từ đợt trước, `tests/thread-order.test.ts:317` (A7b). Cần dạng đã commit vì các kết nối khác phải thấy guard 022 tắt. Ca chết giữa chừng (SIGKILL, mất điện) để guard tắt trong CSDL. Đo [mô phỏng trong bản sao: một ca tắt guard của 022 bằng câu đã commit rồi tự `SIGKILL`]: guard ở lại `D`; vòng chạy kế tiếp của `thread-order` đỏ 4 ca (B5, B6, B7, B9: lớn tiếng), `thread-order-concurrency` đỏ N11 và tự bật lại guard ở N19b, `z4-schema` xanh 26 ca (không phụ thuộc guard), `z4-pointer-guard` đỏ G12 rồi G12 áp lại 022 và các ca sau xanh. Tức không im lặng yếu đi, và tự lành sau một vòng, nhưng có một cửa sổ đỏ giả. Rủi ro cho CSDL thật: không. Harness chỉ chấp nhận `127.0.0.1:55471` với tên `slice1_verify` hoặc `slice1_verify_<số>` (`tests/slice1-db.ts:11-13`, gọi trước mọi câu lệnh); cổng 55471 chỉ ánh xạ tới container thử `libetech-slice1-pg` (cổng 5432 trong container, nghe 127.0.0.1); PostgreSQL của bản cài thật nghe cổng khác (5547, `deploy/install-user.py:125`). `reset()` vốn đã `TRUNCATE ... CASCADE` trên cùng đích, nên phòng vệ cùng một hàng rào. Sửa rẻ: một `afterEach` (và `beforeEach`) trong khối `describe` chạy câu bật lại guard 022 và trigger bản sửa một cách idempotent, hoặc khẳng định mọi trigger của bảng là `O` trước khi bắt đầu. Ca A9b và B9 (tắt trong giao dịch sẽ lùi) không có vấn đề này: máy chủ huỷ giao dịch khi kết nối chết.

**R-S-10 [P3] Thứ tự hai khoá làm đường nhận tin chờ vô ích.** `023:87-88`: bản sửa trước, `ai_drafts` sau. Khi một nháp AI đang ghi, migration giữ khoá bản sửa trong lúc chờ khoá `ai_drafts`, nên đường nhận tin (đường thật của sản phẩm) bị chặn tới 5 giây thêm [đo ở bảng trên]. Đổi thứ tự (`ai_drafts` trước, bản sửa sau) giữ nhận tin chảy trong khi chờ nháp AI (Z4 hiếm khi có nháp), không đổi khả năng bế tắc (cả hai thứ tự đều có một thứ tự ngược của giao dịch thô). Cần sửa ca thứ tự của A8 (iii). Không chặn.

### Hai điều ghế được hỏi riêng

- `CREATE OR REPLACE TRIGGER` [đo]: lần chạy thứ hai đưa trigger đã `DISABLE`, `ENABLE REPLICA` hay `ENABLE ALWAYS` về `O`; thay luôn một trigger cùng tên của người khác (loại `BEFORE`, hàm khác) bằng trigger của 023; không đổi OID hay thứ tự bắn (theo tên). Cần PostgreSQL 14 trở lên; bản cài thật đòi 16 (`deploy/install-d1.sh:23`), PGlite của repo là 18. Hệ quả duy nhất đáng ghi: trigger cố ý đặt `ENABLE ALWAYS` (để bắn khi `session_replication_role = replica`) bị đưa về `O` bởi lần chạy lại; khớp ý định của A7b và W9, không phải lỗi. Trigger của bảng quyết định vẫn `DROP` rồi `CREATE` (khoá `ACCESS EXCLUSIVE` đã giữ từ bước 10) và cũng về `O`.
- Cả hai chỗ còn lại của phần sửa: bỏ `WHERE h.last_seq < EXCLUDED.last_seq` ở câu cập nhật dòng đếm là an toàn (số viết ra luôn lớn hơn `last_seq` cũ, vì chúng bắt đầu sau nó và bảng bản sửa bị khoá nên không dòng đếm nào đổi giữa lúc đọc và lúc ghi; một dòng đếm bị hạ bằng tay vẫn bị khoá duy nhất `(…, thread_seq)` biến thành lỗi to). Trần đếm các bản chưa có số (mặc định 250 000) và đột biến s6 (đếm mọi bản) đỏ A8 (i).

### Đột biến đã chạy trong đợt này (15, bản sao của `00228a4`, CSDL riêng)

r1 (tệp lùi bỏ khoá): đỏ N18, RB-023. s1 (bỏ khoá `ai_drafts`): đỏ A13, A8 (iii). s2 (kiểm trước khoá): đỏ A8 (iii), A11. s3 (đếm superuser): đỏ A8 (iii) ×2, A10, A11, A12, A13. s4 (xoá phép kiểm login): đỏ A10, A11. s5 (`DROP`+`CREATE` thay `OR REPLACE`): đỏ A8 (iii), A12. s6 (trần đếm mọi bản): đỏ A8 (i). m6: đỏ B8, N20 (đợt trước sống). m6b, m23, m25b: sống, tương đương. m5: đỏ B4. m24, m24b: đỏ A9b. m25: đỏ B9.
