# Review theo task — Task F1 của vòng sửa 1 sau cổng Codex (CX1, CX4), phần CSDL

- **Ngày:** 18/11/2026 · **Vai:** `liberico-database-reviewer`. Đây là **khuyến nghị cho Chairman, không phải phê duyệt**. Không sửa mã, không git ghi, không chạy test, không kết nối CSDL nào, không đọc `.env*` hay `.runtime/`.
- **Phạm vi:** `f5b2a36..cb1d7dc` (một commit). Sáu tệp: `migrations/022_ai_drafts_pointer_only_guard.sql`, `migrations/rollback/022_ai_drafts_pointer_only_guard.sql`, `tests/z4-pointer-guard.test.ts`, `tests/migrations-rollback.test.ts`, `tests/suggestions-concurrency.test.ts`, `tests/z4-schema.test.ts`. Số dòng trong báo cáo là của tệp ở `cb1d7dc`.
- **Đã đọc:** brief của task; báo cáo của builder (coi là lời khai); gói diff (một lần); kế hoạch bản 0.6 (`docs/plans/oq-45-46-ai-drafts.md:239-273`, `:847-1004`, `:1336-1371`); `codex-round-1.md`; `gates/security-gate-codex-fix-plan.md` (không coi kết luận là đúng sẵn); `gates/tier1-database.md`; ba log `codex-fix1-F1-red.txt`, `codex-fix1-F1-green.txt`, `codex-fix1-F1-native-verbose.txt`; `measurements-pg16.txt`, `measurements-pg16-2.txt`. Tệp ngoài diff chỉ mở để kiểm một rủi ro nêu được tên (mục 6). `src/server/suggestions.ts`, `src/server/source-text.ts` và hai tệp test của chúng **không** đọc từ đĩa.
- **Nhãn:** **[mã]** = đọc từ mã ở `cb1d7dc`; **[log]** = đọc từ log bằng chứng; **[suy luận]** = từ hiểu biết về PostgreSQL 16 (tài liệu và mã nguồn bộ quản lý khoá, SPI, RLS), chưa có log nào đo; **[điều phối đo]** = số đo trên PostgreSQL 16.15 và ảnh catalog do phiên điều phối chuyển tới trong lúc review (dùng ở mục 7 và DB-9): log không nằm trong repo, tôi không thấy log và không chạy lại.
- **Bổ sung giữa chừng:** phiên điều phối yêu cầu thêm mục 7 («Lock mechanism: advisory key vs row lock») sau khi các mục 1–6 đã viết. Mục 2.9, bảng finding (DB-9) và mục 5 đã được sửa cho khớp.

## Kết luận

| Câu hỏi | Phán quyết |
|---|---|
| Mã có đúng yêu cầu của task không | **Đúng.** Hai tệp SQL trùng từng byte với hai khối của brief; đủ mọi ca G19–G27, Y1, Y2, RB3; bốn ca đổi kỳ vọng đúng như X-G7, X-G9, X-G12, X-RB1; `tests/z4-schema.test.ts` chỉ đổi một dòng truy vấn, không nới |
| Phần CSDL có làm tốt không | **Tốt.** Không thấy lỗi nào trong SQL của ba hàm, ba trigger và tệp lùi. Hai chiều chờ, trần 5 giây và mã `55P03` đã có log PostgreSQL 16 |
| Finding | P0: 0 · P1: 0 · **P2: 3** · P3: 6. DB-1…DB-8 là sửa ca kiểm hoặc ghi chú, không đòi đổi SQL. **DB-9** (khoá tư vấn không có kiểm quyền) là mục duy nhất về thiết kế |
| Quality Gate 34a–34e, M-01…M-07 | Đạt (M-04, M-05, M-07 không áp dụng); 34a còn một chỗ yếu ở ca kiểm (DB-2) |
| Cơ chế khoá: khoá tư vấn (A, đã commit) hay khoá dòng trên `public.projects` (B) | **Tôi sẽ ship B**, với ba phần bổ sung bắt buộc; nếu vòng sửa không còn chỗ cho một task nữa thì ship A như đã commit. Mục 7. Quyết định thuộc phiên điều phối và Chairman |

DB-1 và DB-2 đều là «ca kiểm khẳng định ít hơn điều tên hoặc chú thích của nó nói», trên đúng kênh mà CX1 vừa đóng. Sửa chúng không chạm SQL; nên làm trong Task F4, trước khi gửi cổng Codex vòng 2, và cần làm dù chọn A hay B.

Dòng `VERDICT` ở cuối là cho commit `cb1d7dc` như nó đang có (thiết kế A). Nếu B được chọn, 022 và các ca ở 7.5 đổi, và F1 cần một lượt review CSDL và bảo mật mới trên mã.

## 1. Đúng yêu cầu của task

### 1.1 Hai tệp SQL

[mã] Cắt hai khối `sql` khỏi `.superpowers/sdd/oq-45-46-ai-drafts/task-F1-brief.md` bằng máy và so với `git show cb1d7dc:<tệp>`: tệp thuận và tệp lùi **trùng từng byte**. Hai khối tương ứng trong kế hoạch bản 0.6 cũng trùng. Tệp trong working tree trùng commit. `migrations/` không có bản sao iCloud. Tệp thuận không có ký tự `CR`; thân ba hàm chỉ gồm ASCII.

### 1.2 Từng ca mới: có khẳng định điều tên ca nói không

| Ca | Dòng | Phán quyết | Ghi chú |
|---|---|---|---|
| G19 | `tests/z4-pointer-guard.test.ts:377` | Có | Sáu kiểu dòng × hai dự án, so `code` và đúng chuỗi `message`; câu trả lời của chính RLS (`own`, `:399-409`) lấy trong giao dịch luôn lùi, có khẳng định `tgenabled='O'` sau đó. Chỉ lấy `own` cho **một** kiểu dòng (DB-3) |
| G20 | `:413` | Có, trừ chữ «change» | Ba lệnh bị từ chối và các ghim catalog đúng. Ý `row_security = off` được ghi rõ là đối chứng. Tên ca nói «cannot … change the functions» nhưng không lệnh nào thử đổi hàm (DB-7) |
| G25 | `:443` | Có, đúng như tên | Tên chỉ hứa policy `INSERT`; chú thích ở `:445` hứa rộng hơn điều ca ghim (DB-1) |
| G26 | `:455` | Có | Sáu hình dạng × hai dự án, `{code,message}` bằng nhau; đối chứng login vận hành với `app.*` hỏng |
| G21 | `:497` | Có, trừ chữ «before it reads the mapping» | Ca khẳng định khoá đang giữ, mức, `objsubid=2`, `objid` bằng `hashtext`; thứ tự «khoá trước câu đọc» do G12 ghim bằng vị trí trong `prosrc` và G23 chứng minh bằng hành vi. Không thành finding |
| G22 | `:526` | Có | Đối chứng, xanh từ đầu như brief ghi |
| G23 | `:539` | Có | Nhánh commit tự chứng: `LTZ01` chỉ có được nếu câu đọc chạy **sau** khi ánh xạ commit, tức lệnh đã chờ. [log] xanh trên PostgreSQL 16, `codex-fix1-F1-native-verbose.txt:225` |
| G24 | `:569` | Có | `'blocked'` chỉ có được khi lệnh ghi ánh xạ chờ; lệnh ghi ánh xạ dự án khác chạy xong trong lúc đó. [log] `:226` |
| G27 | `:596` | Có | `55P03`, thời gian trong `[4000, 9000)`, không dòng ánh xạ nào; khoá mức phiên được mở và khẳng định `true`; cuối ca không còn khoá. [log] `:227`, 5 333 ms |
| Y1 | `tests/suggestions-concurrency.test.ts:150` | Có | `POINTER_ONLY_PROJECT` 422 chỉ có được sau khi chờ rồi đọc lại. [log] `:242` |
| Y2 | `:173` | Có | `55P03`, không phải `AppError`, bảng nháp không đổi, gửi lại đúng phong bì thì lưu được. [log] `:243`, 5 348 ms |
| RB3 | `tests/migrations-rollback.test.ts:477` | Có về hình dạng | «Hình dạng cũ» được dựng bằng cách gỡ tay nên hàm guard còn lại vẫn mang **thân mới** (DB-6) |

### 1.3 Ca đổi kỳ vọng

| Ca | Đối chiếu với X5 | Phán quyết |
|---|---|---|
| G7 `:121` | X-G7 | Đúng: cả hai dự án `42501` và đúng chuỗi của RLS, không `LTZ01`, 0 dòng |
| G9 `:146` | X-G9 | Đúng: `{code,message}` bằng nhau ngoài phạm vi; `LTZ01` trong phạm vi |
| G12 `:186` | X-G12 | Đúng và **chặt hơn** trước: thân của cả ba hàm so với tệp trước và sau khi áp lại hai lần; `proconfig` dùng `toEqual`; thứ tự theo tên; ba bảng. Truy vấn thứ tự dùng `ORDER BY tgname` trên kiểu `name` (so theo byte), trùng cách động cơ sắp trigger |
| RB1 `:396` | X-RB1 | Đúng. `rows0` đổi từ `toEqual` sang `toMatchObject` vì thêm cột `mappings`; phép so sau khi lùi vẫn là `toEqual(rows0)`: không nới |

### 1.4 `tests/z4-schema.test.ts`

[mã] `git diff 83d5e2f cb1d7dc -- tests/z4-schema.test.ts`: đúng một dòng (`:460`), `tgname <> '…'` thành `tgname NOT IN ('ai_drafts_pointer_only_guard','ai_drafts_declared_scope_guard')`. Mọi `expect` giữ, kể cả `toHaveLength(3)`. Đây là đổi hạ tầng đúng như I-1; danh sách trigger đầy đủ do G12 ghim. Bốn ca canh của role AI không bị chạm và [log] xanh trên PostgreSQL 16 (`codex-fix1-F1-native-verbose.txt:176-180`). **Không nới.** Một hệ quả gián tiếp của SQL mới lên ca ở `:146` của tệp này: DB-3.

### 1.5 Lời khai của builder so với thứ đọc được

- Y1, Y2 có trong commit và xanh trên PostgreSQL 16; ba chỗ chỉ chạy trên PGlite ở lượt đầu (so `own` của G19, hai lệnh tắt trigger của G20, RB3) đã chạy cả hai làn: khớp phần «Bổ sung» của báo cáo.
- [log] Log đỏ: 9 `AssertionError`, 0 `timed out`, đúng chín ca brief nêu. G20 đỏ vì hàm chưa có: loại đỏ này được brief ghi rõ.
- [log] Lượt PostgreSQL 16: 7 tệp, 239 ca đạt, 0 bỏ qua, không dòng `40P01`. Lượt này chạy 7 trong 13 tệp của lệnh ở brief (⚠️-3).
- Năm ca chỉ native (G23, G24, G27, Y1, Y2) không có log đỏ; cả năm tự chứng theo hướng cần: không ca nào xanh được trên SQL cũ.

## 2. CSDL

### 2.1 Ba hàm, ba trigger

| Hàm | Quyền chạy | Ghim trong định nghĩa | Nhận xét |
|---|---|---|---|
| `intelligence.ai_drafts_declared_scope_guard()` `:22-39` | `SECURITY INVOKER` | `search_path` | Đúng phải là invoker: `row_security_active` xét người chèn. Không ghim `row_security` là đúng (hàm đó không báo lỗi khi `row_security = off`). Không lấy khoá nên không cần `lock_timeout` |
| `intelligence.ai_drafts_pointer_only_guard()` `:42-63` | `SECURITY DEFINER`, chủ là login migration | `search_path`, `row_security = off`, `lock_timeout = '5s'` | Definer duy nhất, đúng chỗ: role AI không đọc được ánh xạ. `row_security = off` giữ tính đóng (G11). Trần 5 giây phủ cả lần chờ `ACCESS SHARE` trên bảng ánh xạ |
| `intelligence.project_domain_mappings_draft_lock()` `:66-74` | `SECURITY INVOKER` | `search_path`, `lock_timeout = '5s'` | Invoker là đủ: thân hàm chỉ gọi hàm của `pg_catalog`. Trigger chạy được với người ghi không có `EXECUTE` và không có `USAGE` trên schema [suy luận; cùng cơ chế với G1, nơi role AI kích hàm definer nó không gọi được] |

`REVOKE ALL … FROM PUBLIC` cho cả ba; không `GRANT`. Mọi tên hàm và bảng viết đủ schema; `pg_temp` đứng cuối.

**Thứ tự chạy.** [suy luận] Động cơ nạp trigger qua chỉ mục `(tgrelid, tgname)` nên chạy theo tên, so theo byte. `ai_drafts_declared_scope_guard` < `ai_drafts_pointer_only_guard`; `ai_drafts_immutable` nằm giữa nhưng là trigger `UPDATE`/`DELETE`. [log] G7, G9, G19 xanh trên PostgreSQL 16: dòng ngoài phạm vi của dự án `IBS_HI` nhận `42501` chứ không phải `LTZ01`, tức trigger phạm vi chạy trước.

### 2.2 `lock_timeout` mức hàm và `55P03`

- [suy luận] `lock_timeout` áp cho mọi lần chờ khoá nặng, khoá tư vấn cũng đi qua cùng đường chờ; giá trị được đọc lúc bắt đầu chờ, nên giá trị ghim trên hàm có hiệu lực trong thân hàm và được trả lại khi hàm kết thúc, kể cả khi lỗi.
- [log] Xác nhận trên PostgreSQL 16: G27 (lệnh ghi ánh xạ qua phiên không đặt `lock_timeout`) và Y2 (`submitDraft`) đều kết thúc bằng `55P03` sau 5,3 giây, dưới trần 10 giây của câu lệnh.
- Trần tính **cho từng lần lấy khoá**. Một câu lệnh nhiều dòng chờ hai dự án có thể chạm trần 10 giây của câu lệnh trước (`57014`): vẫn đóng.
- Nếu cụm đặt `deadlock_timeout` từ 5 giây trở lên, một vòng khoá chết thật sẽ hiện thành `55P03` thay cho `40P01` [suy luận]: vẫn bị huỷ.

### 2.3 Khoá tư vấn

- **Không gian khoá.** `1346653516` = `0x50444D4C`, vừa `int4`. [mã] Ba khoá tư vấn khác của repo không trùng: `src/server/suggestions.ts:256` dạng hai số với số đầu `0x44524654`; `src/server/intake.ts:87` và `scripts/migrate.ts:7` dạng một `bigint` (`objsubid = 1`), khác hẳn dạng hai số (`objsubid = 2`).
- **`hashtext`.** Hai trigger tính cùng một biểu thức trong cùng CSDL nên luôn khớp nhau; giá trị chỉ sống trong bộ nhớ khoá, đổi phiên bản lớn không ảnh hưởng. `project_id` rỗng: hàm khoá là `STRICT`, không lấy khoá, bảng trả `23502` (G22).
- **Va chạm.** Băm 32 bit: hai dự án trùng giá trị chỉ xếp hàng thừa, không sai kết quả. Xác suất có một cặp trùng: khoảng 0,01 % với 1 000 dự án, khoảng 1 % với 10 000.
- **Số khoá.** Một khoá cho mỗi **dự án khác nhau** trong giao dịch, không phải mỗi dòng (lấy lại khoá đang giữ không tốn thêm chỗ trong bộ nhớ dùng chung). Hệ quả cho phục hồi và nhập hàng loạt: DB-4.
- **Xếp hàng.** [suy luận] Một lệnh ghi ánh xạ đang chờ khoá độc quyền làm các lệnh chèn nháp **mới** của dự án đó xếp sau nó tới khi nó được khoá hoặc hết trần 5 giây. Không sai dữ liệu; là độ trễ có trần.

### 2.4 Lập luận ảnh chụp ở READ COMMITTED

- [suy luận] `PERFORM` là biểu thức đơn của PL/pgSQL: lấy ảnh chụp trước khi chờ rồi bỏ. Câu `SELECT … INTO` đi qua SPI của hàm `VOLATILE` và lấy ảnh chụp mới sau khi chờ. Lúc commit, giao dịch được đánh dấu xong trong danh sách tiến trình **trước** khi nhả khoá, nên bên chờ thức dậy thì ảnh chụp mới đã thấy ánh xạ.
- [log] G23 (`:225`) và Y1 (`:242`): lệnh chờ ánh xạ chưa commit rồi nhận `LTZ01` / `POINTER_ONLY_PROJECT`. G24 (`:226`): lệnh ghi ánh xạ chờ lệnh chèn nháp còn mở. Hai chiều của X2 đứng trên PostgreSQL 16.
- Lập luận dựa vào hàm guard là `VOLATILE`. Thuộc tính này chưa được ghim ở làn PGlite (DB-7).
- Với mọi cặp (giao dịch chèn nháp D, giao dịch ghi ánh xạ M) của một dự án đi qua hai trigger: hoặc M giữ khoá trước và D đọc trạng thái sau M, hoặc D giữ khoá trước và M commit sau D. Không tìm thấy khe thứ ba. Giao dịch con lùi thì nhả khoá cùng lúc với việc bỏ dòng, nên không tạo khe.

### 2.5 Vòng khoá chết

Hai vòng X2 nêu là đúng và cả hai bị huỷ bằng `40P01`. Đã xét thêm và **không** thấy vòng: (i) lệnh ghi ánh xạ và lệnh chèn nháp chỉ giữ `KEY SHARE` trên dòng dự án, không xung đột nhau; (ii) áp lại hoặc lùi 022 lấy khoá bảng theo thứ tự `intelligence.ai_drafts` rồi `public.project_domain_mappings`, cùng thứ tự với đường của guard; (iii) `decide` và đường nhận tin không lấy khoá này. [log] Không dòng `40P01` trong lượt native.

### 2.6 Trigger phạm vi so với RLS

- [mã] Điều kiện ở `migrations/022_ai_drafts_pointer_only_guard.sql:29-33` trùng nghĩa với `WITH CHECK` của `ai_insert` (`migrations/021_ai_suggestions_z4.sql:100-103`), kể cả cách xử lý NULL (`IS NOT TRUE`). Hai `IF` lồng nhau: role không chịu RLS không đánh giá `app.*`.
- Với dòng ngoài phạm vi, hàm ném lỗi trước khi lấy khoá hay đọc ánh xạ: không có kênh thời gian giữa dự án `IBS_HI` và dự án khác. Lỗi của trigger khác lỗi gốc của RLS ở `HINT` và `CONTEXT`, giống nhau cho mọi dự án.
- **Hướng hỏng khi lệch, và ca bắt:**

| Kiểu lệch | Hướng hỏng | Ca bắt |
|---|---|---|
| `ai_insert` chặt thêm | Kênh CX1 mở lại, im lặng | G25 (chuỗi ghim) |
| Thêm policy `RESTRICTIVE`, lệnh nào cũng vậy | Như trên | G25 (`:451`) |
| Thêm policy `INSERT` hoặc `ALL` | Trigger từ chối oan (đóng) | G25 (`:452`) |
| `ai_insert` nới hoặc bị gỡ | Trigger từ chối oan, hoặc chỉ còn bit trong phạm vi | G25 |
| **`ai_select` chặt thêm** | **Kênh CX1 mở lại cho lệnh có `RETURNING` hoặc `ON CONFLICT`, im lặng** | **Không ca nào (DB-1)** |
| `row_security_active` trả sai dưới login AI | Trigger tự bỏ qua | Điều kiện 22 của kế hoạch; câu D ở mục 4 |

### 2.7 Phục hồi, `scripts/migrate.ts`, CSDL mang thân cũ

- **Phục hồi data-only** (`deploy/install-d1.sh:43`, `deploy/install-user.py:161`: một giao dịch, một kết nối, không `-j`). Thứ tự đã đo là nháp trước ánh xạ (`measurements-pg16.txt`): mỗi dòng nháp lấy khoá chia sẻ, rồi mỗi dòng ánh xạ lấy khoá độc quyền **trên chính các khoá phiên đó đang giữ chia sẻ**. [suy luận] Một backend không xung đột với khoá của chính nó nên lần phục hồi đi qua; chưa có ca hay log nào đi đúng đường «nháp rồi ánh xạ trong một giao dịch» (DB-5). Role phục hồi là superuser nên trigger phạm vi tự bỏ qua. Kết quả về nội dung không đổi so với R20: guard không thấy ánh xạ nào và cho mọi dòng nháp qua.
- **`scripts/migrate.ts`.** Không đổi cách chạy. Lần áp đầu cần quyền tạo trigger trên `public.project_domain_mappings` (login migration là superuser). Trình áp và harness native bỏ qua bản đã ghi (`scripts/migrate.ts:14`, `tests/slice1-db.ts:35`).
- **CSDL đã ghi `'022'` với thân cũ (R37).** Trình áp không tự sửa: CSDL đó giữ một trigger, một hàm, tức CX1 và CX4 còn nguyên, không lỗi nào báo. [mã] Chạy tay tệp thuận là đủ để ra hình dạng mới (`CREATE OR REPLACE` thay cả thân lẫn `proconfig` [suy luận; planner đo ngoài repo trên PGlite]); tệp lùi mới gỡ được cả hình dạng cũ vì gỡ theo tên có canh. [log] Phiên chính đã đi đường «lùi bằng tệp mới rồi áp lại» trên PostgreSQL 16. Thứ phát hiện được thân cũ là câu A và B ở mục 4.

### 2.8 Idempotent, tệp lùi, khoá lúc áp

- **Idempotent.** `CREATE OR REPLACE` × 3, `DROP TRIGGER IF EXISTS` rồi `CREATE TRIGGER` × 3 trong một giao dịch, `ON CONFLICT DO NOTHING`. [log] G12 áp hai lần, hình dạng không đổi, trên cả hai làn. Áp lại còn bật lại một trigger đã bị tắt tay: đúng hướng.
- **Tệp lùi** `:6-24`: chặn khi có bản sau; gỡ trigger trước, hàm sau; canh bằng `to_regclass` / `to_regprocedure`; chuỗi `EXECUTE` là hằng; không `CASCADE`; không chạm dữ liệu. [log] RB1, RB3 và ca «chạy lại sau khi schema đã mất» xanh trên PostgreSQL 16 (`:234-236`).
- **Khoá lúc áp** [suy luận]. Lần đầu: `SHARE ROW EXCLUSIVE` trên `intelligence.ai_drafts` **và nay cả `public.project_domain_mappings`** — chặn lệnh ghi, không chặn lệnh đọc. Áp lại và lùi: `ACCESS EXCLUSIVE` trên cả hai bảng tới `COMMIT` — chặn cả lệnh đọc ánh xạ (đường nhận tin, mọi phép `isIbsHiSql`, chính guard). `lock_timeout` 5 giây. Không viết lại bảng, không dựng chỉ mục.

### 2.9 Cân lại cơ chế khoá (X2 đề nghị cổng CSDL cân)

Xem **mục 7**. Bản đầu của mục này nghiêng về giữ khoá tư vấn; tôi đã rút kết luận đó vì nó dựa trên một tiền đề sai với hệ thống này (7.7). Phương án thứ ba X2 nêu — một bảng khoá riêng chỉ hàm definer chạm được — vẫn không đáng chọn: thêm một bảng và dữ liệu phải phục hồi theo thứ tự, vượt ràng buộc «đúng một migration, không bảng mới», trong khi dòng dự án đã là đối tượng khoá tự nhiên.

### 2.10 Quality Gate

| Mục | Kết quả | Căn cứ |
|---|---|---|
| 34a đọc | Đạt, bằng chứng hành vi yếu đi | Role AI không đọc được ánh xạ (G8) và không phân biệt được dự án ngoài phạm vi (G7, G9, G19, G26). Điều kiện tenant của câu đọc definer nay chỉ còn ghim bằng chữ (DB-2) |
| 34b ghi | Đạt | G19 (b), (e); G26. Lớp trả lời nay là trigger, policy chỉ còn một kiểu dòng được thử riêng (DB-3) |
| 34c xoá, sửa | Đạt | G10, không đổi |
| 34d không ngữ cảnh | Đạt | G7; G19 (f) |
| 34e bypass | Đạt | G20, G8, G6, G11 |
| M-01 | Đạt | 022 nối 021; sửa tại chỗ dưới cùng số bản (R37, ⚠️-1) |
| M-02 | Đạt | G12 |
| M-03 | Đạt | RB1, RB3, ca chạy lại |
| M-04, M-05, M-07 | Không áp dụng | Không cột, không bảng, không đổi tên |
| M-06 | Đạt | Không viết lại bảng; khoá ngắn có trần |
| E-DB-04, E-SEC-02, AR-03 | Đạt | Idempotent và có tệp lùi; ngữ cảnh đọc bằng `current_setting(…, true)`; role AI không được cấp gì, không ghi Z1/Z2 |

## 3. Finding

| # | Mức | Tệp:dòng | Kịch bản | Sửa thế nào |
|---|---|---|---|---|
| DB-1 | **P2** | `tests/z4-pointer-guard.test.ts:445`, `:452` (G25) · `migrations/022_ai_drafts_pointer_only_guard.sql:28-33` · `migrations/021_ai_suggestions_z4.sql:95-97`, `:161` · `docs/plans/oq-45-46-ai-drafts.md:1338`, `:1354` | [mã + suy luận] Với lệnh chèn có `RETURNING` hoặc `ON CONFLICT(…)` — đúng câu lệnh của `submitDraft` và của helper `insertDraft` — PostgreSQL áp thêm `USING` của mọi policy `SELECT` của role lên **dòng mới**, cùng câu lỗi `42501`. Policy đó là `ai_select`. Hôm nay nó gồm đúng hai vế đầu của `ai_insert`, nên dòng qua trigger thì qua cả hai: **không rò hôm nay**. Một migration sau siết `ai_select` mà để nguyên `ai_insert`: dòng qua trigger tới hàm definer, dự án `IBS_HI` nhận `LTZ01`, dự án khác nhận `42501` từ `ai_select` — kênh CX1 mở lại, im lặng. G25 chỉ lọc `polcmd` thuộc `('a','*')`; không ca nào ghim `USING` của `ai_select`. Chú thích `:445`, R33 và điều kiện 20 đều nói như thể ghim policy `INSERT` là đủ | Chỉ sửa ca và chữ. (a) G25 ghim thêm: các policy có `polcmd` thuộc `('r','*')` áp cho `libetech_ai` là đúng một dòng `ai_select`, và `pg_get_expr(polqual, polrelid)` bằng một hằng viết trong tệp. (b) Sửa chú thích `:445`, R33 và điều kiện 20: trigger phải chặt bằng **giao** của `ai_insert` và `ai_select`. (c) Dùng câu C ở mục 4 |
| DB-2 | **P2** | `tests/z4-pointer-guard.test.ts:94-100` (G4) · `migrations/022_ai_drafts_pointer_only_guard.sql:30`, `:57` · `docs/plans/oq-45-46-ai-drafts.md:998` | [mã] G4 mang tên «the guard reads the mapping of the row's own tenant». Trước vòng sửa nó đỏ nếu bỏ vế `m.tenant_id = NEW.tenant_id` khỏi câu đọc definer. Nay dòng của nó (tenant của dòng khác tenant đã khai) bị **trigger phạm vi** từ chối trước, hàm definer không chạy: bỏ vế tenant thì G4 vẫn xanh. X5 ghi G4 «không đổi, nay do trigger mới trả» nhưng không ghi rằng ca mất điều nó đứng ra chứng minh. Vế tenant chỉ còn ghim bằng chữ ở G12. Đây là câu đọc duy nhất chạy ngoài RLS, và là căn cứ 34a của báo cáo tầng 1 | Chỉ sửa ca. Thêm vào G4 một dòng **tới được** hàm definer với tenant lệch: (a) login vận hành chèn dòng `tenant_id = ids.otherTenant`, `project_id = ids.transport` (đã ánh xạ `IBS_HI`) → chờ `23503`, không phải `LTZ01`; (b) role AI khai tenant của mình và khai luôn một dự án của tenant khác đã ánh xạ `IBS_HI` → chờ `23503`, không phải `LTZ01`. Ý (b) là hình dạng dò chéo tenant thật |
| DB-3 | P3 | `tests/z4-schema.test.ts:146-159` · `tests/z4-pointer-guard.test.ts:399-409` | [mã] Bảy lệnh bị từ chối của ca «the AI role writes drafts only inside its tenant, project and principal» nay do trigger của 022 trả; `WITH CHECK` thật của `ai_insert` không còn được chạm. Thay policy bằng `WITH CHECK (true)` thì ca đó vẫn xanh. Vẫn có ca bắt (G25 bằng chữ; `own` của G19 bằng hành vi), nhưng `own` chỉ thử một kiểu dòng: vế tenant và vế `ai_principal_id` của policy thật không còn ca hành vi nào | Trong G19, chạy cả sáu kiểu dòng dưới giao dịch tắt trigger và luôn lùi, không chỉ một kiểu |
| DB-4 | P3 | `migrations/022_ai_drafts_pointer_only_guard.sql:55`, `:72` · `docs/plans/oq-45-46-ai-drafts.md:919`, `:791`, `:807` | [suy luận] (a) Phục hồi một giao dịch, hoặc nhập ánh xạ hàng loạt, giữ một khoá cho mỗi dự án khác nhau tới hết giao dịch. Bộ nhớ khoá dùng chung mặc định khoảng 6 400 chỗ (`max_locks_per_transaction` × số kết nối): vài nghìn dự án trong một giao dịch có thể kết thúc bằng «out of shared memory», lần phục hồi lùi. Trước vòng sửa đường này không lấy khoá tư vấn nào. (b) Phục hồi song song (`-j`) nay có thêm hai kiểu hỏng: lệnh `COPY` nháp chờ lệnh `COPY` ánh xạ quá 5 giây → `55P03`; hai lệnh `COPY` chờ vòng → `40P01`. Không có `--exit-on-error` thì kết quả là một bảng thiếu dữ liệu. X2 chỉ ghi «số khoá … nhỏ» | Thêm hai câu vào X2 «Phục hồi dữ liệu», R20 và điều kiện 10. Hai đường cài đặt của repo không dùng `-j`: không sửa mã |
| DB-5 | P3 | `tests/z4-pointer-guard.test.ts:526-536` (G22) | [mã] G22 thử «ánh xạ rồi nháp» trong một giao dịch. Chiều ngược — «nháp rồi ánh xạ», tức khoá chia sẻ rồi khoá độc quyền trên cùng một khoá của cùng phiên — là đúng đường của phục hồi một giao dịch với thứ tự nạp đã đo, và chưa có ca hay log nào đi qua | Thêm vào G22 (chạy được trên PGlite): trong một giao dịch, chèn nháp cho `ids.sales` rồi ghi ánh xạ `XECA` cho `ids.sales` → không lỗi; `locks(tx)` có một dòng `ShareLock` và một dòng `ExclusiveLock` cùng `objid` |
| DB-6 | P3 | `tests/migrations-rollback.test.ts:493-498`, `:510-512` (RB3) | [mã] `toOldShape` gỡ hai trigger và hai hàm; hàm guard còn lại mang thân và `proconfig` **mới**. Bước (i) vì vậy chứng minh «tệp thuận tạo lại thứ thiếu», không chứng minh «tệp thuận thay thân cũ và thêm `lock_timeout` vào `proconfig`». Đường R37 «chạy tay tệp thuận lên thân cũ» chỉ được đo ngoài repo, trên PGlite | Trong `toOldShape` thêm `ALTER FUNCTION intelligence.ai_drafts_pointer_only_guard() RESET lock_timeout`, khẳng định `proconfig` đã mất mục đó, rồi để bước (i) chứng minh nó trở lại |
| DB-7 | P3 | `tests/z4-pointer-guard.test.ts:413-441` (G20), `:223-227` (G12) | [mã] Hai thuộc tính mà lập luận dựa vào chưa có khẳng định: (a) tên G20 nói role «cannot … change the functions» nhưng không lệnh nào thử; trần của N1 nằm trong `proconfig`, nên «role không sửa được `proconfig`» đáng có một lệnh bị từ chối. (b) `provolatile` của guard không được ghim; đánh dấu hàm thành `STABLE` làm câu đọc dùng ảnh chụp cũ, G23 bắt được trên native nhưng làn PGlite thì không | (a) Dưới `asAi`: `ALTER FUNCTION intelligence.project_domain_mappings_draft_lock() SET lock_timeout = 0` → `/must be owner/`. (b) Thêm `provolatile: 'v'` vào bảng `PINS` của G12 |
| DB-8 | P3 | `migrations/022_ai_drafts_pointer_only_guard.sql:66`, `:84-85` · `migrations/rollback/021_ai_suggestions_z4.sql:24` | [mã] Trigger của một bảng Z1 (`public.project_domain_mappings`) gọi hàm nằm trong schema của Z4 (`intelligence`). Không vi phạm AR-03 (hàm không ghi gì, role AI không được cấp gì). Hệ quả: lùi 021 phụ thuộc cứng vào việc lùi 022 bằng tệp mới (R37 đã ghi); một bản dump chỉ schema `public` không dựng lại được trigger | Không sửa trong PR này. Ghi vào biên nhận; nếu 022 còn bị chạm ở vòng sửa 2 thì cân việc đặt hàm khoá trong `public` |
| DB-9 | **P2** | `migrations/022_ai_drafts_pointer_only_guard.sql:14-15`, `:55`, `:72` · `docs/plans/oq-45-46-ai-drafts.md:1339-1345` (R34), `:1352` | [mã + điều phối đo] Khoá tư vấn không có kiểm quyền. Ba login dịch vụ đang có (`libetech_web`, `libetech_auth`, `libetech_intake_svc`) và mọi role về sau đều lấy được khoá của bất kỳ dự án nào bằng một câu lệnh, kể cả dạng mức phiên: lệnh ghi ánh xạ của dự án đó thất bại `55P03` ở mọi lần thử chừng nào khoá còn bị giữ, tức việc một dự án thành `IBS_HI` bị hoãn. Trước 022 không role không-superuser nào chặn được lệnh ghi ánh xạ. Không đọc, không ghi được dữ liệu nào; mỗi lần thử có trần và thành tiếng; người giữ khoá hiện trong `pg_locks`. Vì vậy là P2 hôm nay; thành P1 vào ngày có một login cho role mà kế hoạch xếp vào «không tin» | Thay cơ chế bằng khoá dòng trên `public.projects` (thiết kế B, mục 7.4): khi đó không role không-superuser nào hôm nay chặn được. Hoặc giữ A và nhận phần dư như R34 và điều kiện 18 đang ghi. Tôi chọn cách thứ nhất (7.1) |

## 4. Ghi chú triển khai cho biên nhận

### 4.1 Điều đổi so với `gates/tier1-database.md` mục 6

| # | Mục | Thay đổi |
|---|---|---|
| 1 | Thứ tự áp | CSDL đã ghi `'022'` trước `cb1d7dc` mang hình dạng cũ: lùi bằng tệp lùi **mới** rồi áp lại, hoặc chạy tay tệp thuận. Tệp lùi của bản 0.4 không còn dùng được |
| 2 | Câu catalog sau khi áp | **Thay hẳn** bằng bốn câu A–D dưới đây |
| 3 | Khoá lúc áp | Thêm `public.project_domain_mappings`. Lần đầu: `SHARE ROW EXCLUSIVE` trên hai bảng. Áp lại và lùi: `ACCESS EXCLUSIVE` trên hai bảng, chặn cả lệnh đọc ánh xạ |
| 4 | `lock_timeout` nổ dưới `scripts/migrate.ts` | Không đổi |
| 5 | Lùi | Lùi 022 nay mở lại cả CX1 và CX4, không chỉ OQ-45 3(b). Thứ tự «022 rồi 021» nay là bắt buộc về kỹ thuật: lùi 021 thất bại thành tiếng nếu hàm của 022 còn |
| 6 | Dữ liệu có sẵn | Không đổi |
| 7 | Guard vắng mà không ai biết | Thêm ba dạng: **chỉ** trigger phạm vi bị tắt (CX1 mở lại, guard còn); trigger khoá của bảng ánh xạ bị tắt (CX4 mở lại); ánh xạ ghi dưới `session_replication_role = replica` không lấy khoá |
| 8 | Phục hồi data-only | Thêm: một khoá tư vấn cho mỗi dự án, giữ tới hết giao dịch; «không dùng `-j`» nay vì cả `55P03` và `40P01` (DB-4) |
| 9 | Mức cô lập của login pipeline | Không đổi |
| 10 | Log máy chủ | Thêm dòng `ERROR` mới: `55P03` có `CONTEXT` nêu tên hàm; `42501` do trigger ném, kèm `HINT`; có thể có `40P01` |
| 11 | Chi phí | Thêm một lần lấy khoá tư vấn cho mỗi dòng nháp và mỗi dòng ánh xạ; một biểu thức cho mỗi dòng của role chịu RLS |
| 12–13 | Login runtime; `EXPLAIN` | Không đổi |
| 14 | **Mới** — lệnh ghi ánh xạ có thể thất bại | `55P03` nghĩa là có phiên đang giữ khoá của dự án: chạy câu E, xử lý phiên đó, thử lại. Quy trình xác nhận một dự án là `IBS_HI` phải ghi bước này |
| 15 | **Mới** — pipeline | Coi `55P03` từ `submitDraft` là thử lại được (điều kiện 18) |
| 16 | **Mới** — login AI | Có `idle_in_transaction_session_timeout` **và** `idle_session_timeout`; câu D trả đúng dưới chính login đó (điều kiện 22) |

### 4.2 Các câu chỉ đọc

Cả năm câu tôi viết từ việc đọc tệp, **chưa chạy**: chạy một lần trên CSDL thử trước khi chép vào biên nhận. Chúng tả thiết kế A như đã commit. Nếu B được chọn: ở câu B, dòng của hàm khoá thành `prosecdef = t` với `proconfig` giống dòng guard, và hai giá trị `body_md5` của guard và hàm khoá phải tính lại; câu E thay bằng câu ở 7.4; mục 8 của bảng 4.1 bỏ ý về khoá tư vấn; A, C, D giữ nguyên.

**A — trigger của hai bảng** (chờ 5 dòng):

```sql
SELECT n.nspname || '.' || c.relname AS tbl, t.tgname, t.tgenabled, t.tgtype,
       pn.nspname || '.' || p.proname AS fn, pg_get_triggerdef(t.oid) AS def
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = t.tgfoid
  JOIN pg_namespace pn ON pn.oid = p.pronamespace
 WHERE NOT t.tgisinternal
   AND t.tgrelid IN ('intelligence.ai_drafts'::regclass, 'public.project_domain_mappings'::regclass)
 ORDER BY 1, t.tgname;
```

| `tbl` | `tgname` | `tgenabled` | `tgtype` | `fn` |
|---|---|---|---|---|
| `intelligence.ai_drafts` | `ai_drafts_declared_scope_guard` | `O` | 7 | `intelligence.ai_drafts_declared_scope_guard` |
| `intelligence.ai_drafts` | `ai_drafts_immutable` | `O` | 27 | `public.reject_history_mutation` |
| `intelligence.ai_drafts` | `ai_drafts_pointer_only_guard` | `O` | 7 | `intelligence.ai_drafts_pointer_only_guard` |
| `public.project_domain_mappings` | `project_domain_mappings_draft_lock` | `O` | 7 | `intelligence.project_domain_mappings_draft_lock` |
| `public.project_domain_mappings` | `project_domain_mappings_immutable` | `O` | 27 | `public.reject_history_mutation` |

`def` của ba dòng 022 có dạng `CREATE TRIGGER <tên> BEFORE INSERT ON <bảng> FOR EACH ROW EXECUTE FUNCTION intelligence.<tên>()`. Thứ tự dòng là thứ tự chạy: trong các dòng của `intelligence.ai_drafts` có `tgtype & 7 = 7`, dòng đầu phải là `ai_drafts_declared_scope_guard`. Thêm một dòng là có trigger lạ; thiếu dòng 1 hoặc dòng 4 là CSDL mang hình dạng cũ. Giá trị 27 và schema `public` của hai dòng `…_immutable` là [suy luận].

**B — ba hàm** (chờ 3 dòng):

```sql
SELECT pn.nspname || '.' || p.proname AS fn, p.prosecdef, p.provolatile, p.proconfig,
       md5(p.prosrc) AS body_md5,
       p.proacl IS NOT NULL
         AND (SELECT bool_and(a.grantee = p.proowner) FROM aclexplode(p.proacl) a) AS acl_owner_only,
       has_function_privilege('libetech_ai', p.oid, 'EXECUTE') AS ai_can_execute,
       r.rolsuper OR r.rolbypassrls AS owner_exempt_from_rls
  FROM pg_proc p
  JOIN pg_namespace pn ON pn.oid = p.pronamespace
  JOIN pg_roles r ON r.oid = p.proowner
 WHERE pn.nspname = 'intelligence'
   AND p.proname IN ('ai_drafts_declared_scope_guard', 'ai_drafts_pointer_only_guard', 'project_domain_mappings_draft_lock')
 ORDER BY 1;
```

| `fn` | `prosecdef` | `provolatile` | `proconfig` | `body_md5` |
|---|---|---|---|---|
| `…ai_drafts_declared_scope_guard` | `f` | `v` | `{"search_path=pg_catalog, pg_temp"}` | `2626b21558df13074c59fae2da13bff1` |
| `…ai_drafts_pointer_only_guard` | `t` | `v` | `{"search_path=pg_catalog, pg_temp",row_security=off,lock_timeout=5s}` | `4dd766aa33513f5fe952266c279713c7` |
| `…project_domain_mappings_draft_lock` | `f` | `v` | `{"search_path=pg_catalog, pg_temp",lock_timeout=5s}` | `f4a3c330b21fcc552462413e46660a4d` |

Cả ba dòng: `acl_owner_only` đúng, `ai_can_execute` sai. Dòng guard: `owner_exempt_from_rls` phải đúng. Ba giá trị `body_md5` tôi tính từ tệp ở `cb1d7dc`: MD5 của đoạn nằm giữa `AS $$` và `$$;` của từng hàm, không cắt khoảng trắng, xuống dòng kiểu `LF`. Tệp đổi thì tính lại; lệch nghĩa là thân trong CSDL không phải thân của tệp.

**C — policy của bảng nháp** (chờ 3 dòng, rồi 1 dòng):

```sql
SELECT pol.polname, pol.polcmd, pol.polpermissive,
       (SELECT array_agg(r.rolname::text ORDER BY 1) FROM pg_roles r WHERE r.oid = ANY(pol.polroles)) AS roles,
       pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
       pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check
  FROM pg_policy pol
 WHERE pol.polrelid = 'intelligence.ai_drafts'::regclass
 ORDER BY 1;
SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = 'intelligence.ai_drafts'::regclass;
```

- `ai_insert` · `a` · `t` · `{libetech_ai}` · `using_expr` rỗng · `with_check` bằng đúng hằng `AI_INSERT_CHECK` ở `tests/z4-pointer-guard.test.ts:446` ([log] chuỗi này khớp trên PostgreSQL 16: G25 xanh).
- `ai_select` · `r` · `t` · `{libetech_ai}` · `with_check` rỗng · `using_expr` là **hai vế đầu** của chuỗi trên: `((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid) AND (project_id = ANY ((string_to_array(COALESCE(current_setting('app.project_ids'::text, true), ''::text), ','::text))::uuid[])))`. Dạng in này là [suy luận]; chạy một lần rồi chép chuỗi thật. Vế nào ở đây mà không có trong `ai_insert` là độ lệch của DB-1.
- `runtime_select` · `r` · `t` · `{libetech_runtime}`.
- Không dòng nào có `polpermissive` sai; không dòng thứ tư. Câu thứ hai: `t`, `t`.

**D — dưới chính login AI, lúc tạo login** (điều kiện 22; cùng hai câu về mức cô lập mặc định ở `gates/tier1-database.md` mục 6, không đổi):

```sql
SELECT current_user, row_security_active('intelligence.ai_drafts') AS bound;   -- chờ: bound = t
```

**E — vận hành: ai đang giữ khoá của 022**

```sql
SELECT l.pid, l.mode, l.granted, l.objid, a.usename, a.state, a.xact_start,
       now() - a.state_change AS in_state_for
  FROM pg_locks l
  LEFT JOIN pg_stat_activity a ON a.pid = l.pid
 WHERE l.locktype = 'advisory' AND l.classid = 1346653516 AND l.objsubid = 2
   AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
 ORDER BY l.granted DESC, a.xact_start;
-- objid của một dự án: SELECT hashtext('<mã dự án, chữ thường>')::bigint & 4294967295;
```

Lúc yên: không dòng nào. Dòng có `granted = t` mà phiên ở trạng thái `idle` là khoá mức phiên; `idle in transaction` là giao dịch bị bỏ quên.

## 5. ⚠️ Điều không kiểm được từ diff

| # | Điều chưa kiểm | Ai kiểm, bằng gì |
|---|---|---|
| ⚠️-1 | Câu «022 chưa từng được áp ở đâu ngoài CSDL thử của PR» — căn cứ để sửa tại chỗ dưới cùng số bản | Câu A và B trên từng CSDL |
| ⚠️-2 | Trạng thái thật của CSDL thử sau lượt native (thân, chủ hàm, ACL), và phiên bản máy chủ của lượt đó: log chỉ có dòng tiêu đề ghi PostgreSQL 16 | Chạy A–C trên CSDL thử, ghi `SELECT version()` |
| ⚠️-3 | Lượt PostgreSQL 16 chạy 7 trong 13 tệp của lệnh ở brief. Sáu tệp còn lại — `project-registry`, `intake`, `inbox-service`, `skill-context`, `source-text`, `rls-catalog` — có ca ghi ánh xạ, nay qua trigger khoá, và chỉ có log PGlite | Task F4, lượt cả bộ trên native |
| ⚠️-4 | Log xanh PGlite chỉ có tổng số; tên từng ca chỉ có ở log native. Năm ca chỉ native không có log đỏ (tự chứng, mục 1.5) | Không cần thêm nếu F4 xanh |
| ⚠️-5 | Các hành vi động cơ ghi [suy luận]: PostgreSQL áp `USING` của `ai_select` lên dòng mới của lệnh có `RETURNING` (gốc của DB-1); một phiên lấy khoá độc quyền trên khoá nó đang giữ chia sẻ (đường phục hồi); «out of shared memory» khi quá nhiều dự án; hai kiểu hỏng của phục hồi song song; mức khoá bảng lúc áp, áp lại, lùi; `CREATE OR REPLACE` đè thân cũ và `proconfig` cũ; xếp hàng sau một lệnh đang chờ khoá độc quyền | DB-1 (a), DB-5, DB-6 đo được ba mục đầu và mục thứ sáu; phần còn lại đo một lần ở làn native nếu cần |
| ⚠️-6 | Năm câu A–E, ba giá trị `body_md5`, và dạng in của `using_expr` của `ai_select` | Chạy một lần trên CSDL thử |
| ⚠️-7 | Thứ tự nạp và số dự án của một bản dump thật; cấu hình `max_locks_per_transaction`, `deadlock_timeout` của cụm thật | Điều kiện 10 |
| ⚠️-8 | R34 dưới tải thật: bao lâu một lệnh ghi ánh xạ bị hoãn bởi các lệnh chèn nháp hợp lệ nối đuôi nhau | Khi có pipeline; điều kiện 18 |
| ⚠️-9 | `src/server/suggestions.ts` không đọc: việc `submitDraft` để `55P03` đi thô chỉ biết qua Y2 trong log | Review mã của task tương ứng |
| ⚠️-10 | Mọi số đo và ảnh catalog gắn nhãn [điều phối đo] ở mục 7: tôi không thấy log. Phán quyết ở 7.1 dựa vào chúng, nhất là hai điều «không role không-superuser nào có quyền ghi trên `public.projects`» và «`FOR SHARE` dưới `libetech_runtime` trả `42501`» | Đưa log đo vào thư mục bằng chứng nếu chọn B |
| ⚠️-11 | Các hành vi của thiết kế B ghi [suy luận] ở 7.3: lệnh khoá chia sẻ đi trước một lệnh `NO KEY UPDATE` đang chờ (B-2); phép kiểm khoá ngoại không ghi thêm khi giao dịch đã giữ khoá mạnh hơn (B-4); không thêm multixact (B-5); thứ tự «lỗi RLS trước lỗi quyền» ở G11; tên ràng buộc khoá ngoại của bảng ánh xạ | Sáu phép đo ở 7.6 |
| ⚠️-12 | Các câu SQL ở 7.4 tôi viết bằng cách đọc, chưa chạy ở đâu, kể cả PGlite | Planner chạy trên PGlite như đã làm với bản 0.6; phiên chính đo trên PostgreSQL 16 |

## 6. Thứ đã mở ngoài diff

| Rủi ro nêu tên | Thứ đã kiểm | Kết quả |
|---|---|---|
| Policy khác của bảng nháp cũng được áp lên dòng mới | `migrations/021_ai_suggestions_z4.sql:88-106`, `:159-162` | `ai_select` áp cho `libetech_ai`, role có `SELECT` cả bảng → DB-1 |
| `ai_select` hoặc `provolatile` đã được ghim ở ca nào chưa | tìm `ai_select`, `polqual`, `provolatile` trong `tests/` | Không ca nào |
| Ca hiện có mất khả năng đỏ vì trigger mới chạy trước | G4 `tests/z4-pointer-guard.test.ts:94-100`; G15 `:289-299`; `tests/z4-schema.test.ts:146-159`; `src/server/identities.ts:3-4`; `tests/slice1-fixtures.ts:6` | DB-2, DB-3. G15 không thay được G4: dòng thiếu tenant của nó dùng dự án chưa ánh xạ |
| Khoá tư vấn trùng không gian khoá khác | tìm `pg_advisory`, `pg_try_advisory` trong `src`, `scripts`, `deploy`, `migrations` | Không trùng (mục 2.3) |
| Mã ngoài test ghi bảng ánh xạ, nay qua trigger khoá | tìm `INSERT INTO project_domain_mappings` trong `src`, `scripts`, `deploy`, `migrations`, `bot-plugin`; `src/server/intake.ts:70`, `src/server/projects-registry.ts:58` | Không nơi nào ghi; hai nơi chỉ đọc |
| Đường phục hồi chạy song song hoặc tắt trigger | `deploy/install-d1.sh:43`, `deploy/install-user.py:140-161`, `docs/DEPLOY-002.md:19` | Một giao dịch, data-only, không `-j`, không tắt trigger |
| Trần 5 giây so với trần câu lệnh và `lock_timeout` của phiên | `src/server/db.ts:32`, `:41-46`; tìm `lock_timeout`, `statement_timeout` trong `src`, `scripts`, `deploy` | Trần câu lệnh 10 giây; phiên không đặt `lock_timeout` |
| Trình áp và harness bỏ qua tệp đã sửa | `scripts/migrate.ts:12-17`, `tests/slice1-db.ts:29-37` | Có (R37) |
| `waitForBlocked` đếm nhầm phiên của tệp test khác | `tests/slice1-db.ts:58-66`, `vitest.config.ts` | `fileParallelism:false`: không nhầm |
| Ai ghi được bảng ánh xạ | `migrations/013_project_registry.sql:26-35`, `:71-80`, `:97-101`; `migrations/016_intake_inbox.sql:256` | Chỉ có quyền `SELECT` cho runtime và intake; hôm nay chỉ login vận hành ghi |
| Thứ tự nạp và hành vi `to_regprocedure` khi thiếu schema | `measurements-pg16.txt`, `measurements-pg16-2.txt` | Nháp 27, ánh xạ 53 trên 61; trả NULL, không lỗi |
| Khối SQL lệch tệp; bản sao iCloud | so bằng máy brief, kế hoạch, commit, working tree; đếm tệp tên có ` 2` trong `migrations/` | Trùng từng byte; 0 bản sao |
| (mục 7) Mã nào ghi hoặc khoá dòng của `public.projects` | tìm `UPDATE projects`, `DELETE FROM projects`, `INSERT INTO projects`, `FOR … UPDATE`, `FOR … SHARE` trong `src`, `scripts`, `deploy`, `migrations` (hai tệp đang sửa: đếm từ commit, không đọc) ; `migrations/001_foundation.sql:13-16` | Không nơi nào ghi hay khoá dòng `projects`. Bảng có `UNIQUE(id, tenant_id)` |
| (mục 7) Repo đã có mẫu «trigger khoá dòng cha» chưa | `migrations/020_document_review.sql:259-269`; `migrations/006_bom_allocations.sql:96`, `:102` | Có: `review_decisions_guard` đọc dòng tài liệu `FOR NO KEY UPDATE` và từ chối khi không thấy dòng. 022 là nơi đầu tiên đặt khoá tư vấn trong một trigger |
| (mục 7) Ca nào chờ câu trả lời của khoá ngoại cho một nháp | tìm `23503`, `foreign key` trong `tests/` (từ commit) | `tests/z4-schema.test.ts:265-267` chờ `/foreign key/` cho một nháp có cặp (tenant, dự án) không tồn tại |
| (mục 7) G11 dựa vào thông báo nào | `tests/z4-pointer-guard.test.ts:171-184` | Chờ đúng tên bảng `project_domain_mappings` trong câu lỗi RLS |

## 7. Lock mechanism: advisory key vs row lock

Mục này trả lời yêu cầu bổ sung của phiên điều phối. Hai thiết kế:

- **A (đã commit):** guard lấy `pg_advisory_xact_lock_shared(1346653516, hashtext(project_id::text))`; trigger `BEFORE INSERT` của `public.project_domain_mappings` (`SECURITY INVOKER`) lấy khoá độc quyền cùng khoá; cả hai dưới `lock_timeout '5s'` ghim trên hàm.
- **B (ứng viên):** không khoá tư vấn. Guard definer chạy `PERFORM 1 FROM public.projects p WHERE p.id = NEW.project_id FOR SHARE` trước khi đọc ánh xạ; trigger của bảng ánh xạ thành `SECURITY DEFINER` (cùng `search_path`, `row_security = off`, `lock_timeout '5s'`) và chạy câu đó với `FOR NO KEY UPDATE`. Không bảng mới, không `GRANT`.

### 7.1 Tôi sẽ ship thiết kế nào

**B, với ba phần bổ sung bắt buộc ở 7.4.** B như được tả chưa kín bằng A (B-1). Lý do chọn:

1. **Quyền lấy khoá đi theo quyền ghi.** Ở A, khoá là một con số ai cũng gọi được. Ở B, chỉ hai loại giao dịch giữ được khoá: giao dịch vừa đưa một dòng nháp thật qua trigger phạm vi và guard, và giao dịch ghi ánh xạ. [điều phối đo] `FOR SHARE` và `FOR KEY SHARE` trên `public.projects` dưới `libetech_runtime` trả `42501`; không role không-superuser nào có quyền ghi trên bảng đó.
2. **Với các login đang có, DB-9 biến mất chứ không chỉ được ghi lại.**

   | Ai hoãn được lệnh ghi ánh xạ | A | B |
   |---|---|---|
   | `libetech_web`, `libetech_auth`, `libetech_intake_svc` | Có: một câu lệnh, dự án nào cũng được, cả dạng mức phiên | Không: không lấy được khoá dòng, không có quyền chèn nháp |
   | `libetech_ai` (chưa có login) | Có: một câu lệnh, không cần khai phạm vi, không cần chèn gì | Chỉ bằng một lệnh chèn nháp hợp lệ trong phạm vi nó khai (phạm vi vẫn do role tự khai, R33): một giao dịch còn mở, hoặc các giao dịch ngắn gối nhau (B-2) |
   | Superuser | Có | Có |

3. **B bỏ luôn năm khuyết điểm phụ của A:** dạng mức phiên, kênh `pg_locks` xuyên tenant, chỗ trong bộ nhớ khoá dùng chung, va chạm băm, hằng không gian tên.
4. **B là mẫu repo đã dùng.** [mã] `migrations/020_document_review.sql:259-269` khoá dòng cha trong một trigger guard và từ chối khi không thấy dòng. A là nơi đầu tiên đặt khoá tư vấn trong một trigger.
5. **B không thêm lần ghi nào lên dòng dự án.** [mã] Khoá ngoại của bảng nháp (`migrations/021_ai_suggestions_z4.sql:57`) đã khoá `KEY SHARE` đúng dòng đó cho mỗi lệnh chèn nháp; B nâng mức khoá của cùng lần ghi ấy lên `SHARE` [suy luận, B-4].
6. **Tệp lùi không đổi câu lệnh nào:** tên ba trigger và ba hàm giữ nguyên.

**Khi nào tôi ship A thay vì B:** khi vòng sửa này không còn chỗ cho một task builder, hai review theo task và một lượt PostgreSQL 16. A đúng, đã đo đủ hai chiều (G23, G24, G27, Y1, Y2), và khuyết điểm của nó là P2 chừng nào Z4 còn tắt. Đổi từ A sang B về sau chỉ là thay thân hai hàm trong một migration mới; cái đắt là một vòng PR có cổng, không phải kỹ thuật. Điều tôi không khuyên là ship B **như được tả**, thiếu 7.4.

### 7.2 Thiết kế A — khuyết điểm

| # | Khuyết điểm | Mức | Căn cứ |
|---|---|---|---|
| A-1 | **Khoá không có kiểm quyền** (DB-9). Mọi role lấy được khoá của mọi dự án của mọi tenant bằng một câu lệnh, không cần phạm vi, không cần chèn gì. Trước 022 không role không-superuser nào chặn được lệnh ghi ánh xạ | **P2** hôm nay; P1 khi có login cho role không tin | [mã] `:14-15`; [điều phối đo] ba login dịch vụ; [log] G27 |
| A-2 | Cùng gốc với A-1: (a) dạng **mức phiên** sống qua mọi giao dịch, `idle_in_transaction_session_timeout` không chạm tới; (b) người giữ khoá **độc quyền** còn chặn lệnh chèn nháp của phiên khác | tính trong A-1 | R34; [log] G27, Y2 |
| A-3 | `pg_locks` cho mọi role thấy **lúc nào** một dự án đang được ghi ánh xạ hay chèn nháp, xuyên tenant. Không lộ nhãn | P3 | R34 |
| A-4 | Mỗi dự án khác nhau trong một giao dịch chiếm một chỗ trong bộ nhớ khoá dùng chung tới hết giao dịch (phục hồi, nhập hàng loạt) | P3 | DB-4 |
| A-5 | `hashtext` 32 bit: hai dự án trùng giá trị, có thể khác tenant, xếp hàng thừa. Không sai kết quả | P3 | mục 2.3 |
| A-6 | Hằng `1346653516` thêm một không gian khoá tư vấn nữa vào bốn chỗ repo đã dùng khoá tư vấn; không có sổ đăng ký, chỉ có chú thích | P3 | mục 2.3 |
| A-7 | Mẫu mới: khoá tư vấn trong trigger. Người đọc 022 phải biết hai trigger ở hai bảng dùng chung một con số | P3 | [mã] |

**Điểm mạnh của A, B phải làm thêm mới có:** (i) kín cả khi dòng dự án chưa nhìn thấy được — khoá không phụ thuộc dòng nào; (ii) xếp hàng công bằng — một lệnh ghi ánh xạ đang chờ đứng trước mọi lệnh chèn nháp đến sau [suy luận]; (iii) không chạm dòng Z1 nào và không ảnh hưởng lệnh `UPDATE` nào; (iv) khoá, mức và khoá số đều thấy được trong `pg_locks`, kể cả trên PGlite; (v) đã có mã, đã qua cổng bảo mật, đã đo trên PostgreSQL 16.

Trả lời thẳng câu 1: thuộc tính «role nào cũng lấy được khoá» là **P2** cho hệ thống này hôm nay. Nó chỉ chạm tính sẵn sàng của một lệnh quản trị do superuser chạy tay; muốn dùng nó phải chạy được SQL tuỳ ý dưới một trong ba login dịch vụ, mà kẻ làm được vậy với `libetech_web` đã có thứ nặng hơn nhiều; mỗi lần thử có trần, thành tiếng, thấy được người giữ. Nó không phải P3 vì đây là năng lực mới do chính 022 trao, trên đúng lệnh bật «chỉ con trỏ» của `AGENTS.md:16`, và không điều kiện vận hành nào ngăn được nó — điều kiện 18 chỉ giúp thấy và ngắt. Va chạm băm, không gian tên và phục hồi đều là P3.

### 7.3 Thiết kế B — khuyết điểm

| # | Khuyết điểm | Mức | Sửa được không |
|---|---|---|---|
| B-1 | **Dòng dự án chưa nhìn thấy được thì không có gì để khoá.** Một giao dịch tạo dự án rồi ghi ánh xạ `IBS_HI` cho nó, chưa commit. Lệnh chèn nháp cho dự án đó: câu `FOR SHARE` không thấy dòng, không chờ, không khoá; câu đọc ánh xạ không thấy gì; guard cho qua. Nếu giao dịch kia commit trước phép kiểm khoá ngoại của lệnh chèn — phép kiểm chạy ở **cuối câu lệnh**, nên một lệnh chèn nhiều dòng có dòng sau tính chậm kéo dài được khe này — nháp được lưu sau khi ánh xạ `IBS_HI` đã commit mà guard chưa hề đọc nó. Đây là đúng lớp lỗi CX4. Cần biết mã dự án trước khi dự án commit, nên hẹp; A không có khe này. Phía ghi ánh xạ có khe đối xứng, chỉ superuser dựng được | **P1 nếu ship B như được tả** | Có, và bắt buộc: không thấy dòng thì từ chối, ở cả hai hàm (7.4) |
| B-2 | **Lệnh ghi ánh xạ có thể bị bỏ đói.** [suy luận] PostgreSQL cho một lệnh khoá `SHARE` mới nhập vào nhóm đang giữ `SHARE` mà không xếp sau một lệnh `NO KEY UPDATE` đang chờ. Hai kết nối chèn nháp gối nhau liên tục cho một dự án giữ cho dòng luôn có người khoá: lệnh ghi ánh xạ thất bại `55P03` ở mọi lần thử, bằng các giao dịch **ngắn và trông bình thường**; `idle_in_transaction_session_timeout` không bắt được. Ở A cách này không hiệu quả (hàng đợi công bằng), nhưng A có cách rẻ hơn | P2 khi có login AI; không ai dựng được hôm nay | Không sửa được trong cơ chế khoá dòng. Ghi phần dư; đo (7.6). Giao dịch lùi thì không để lại dòng nào, nên về dấu vết B không hơn A |
| B-3 | **Giao dịch chèn nháp còn mở chặn mọi `UPDATE` và `DELETE` của dòng dự án đó**, và lệnh bị chặn là của bên thứ ba nên không có trần nào của 022 phủ: không đặt `lock_timeout` thì nó treo im lặng. Lệnh ghi ánh xạ cũng giữ `NO KEY UPDATE` trên dòng dự án tới hết giao dịch. [mã + điều phối đo] Hôm nay không mã nào và không role không-superuser nào ghi `projects`, nên người bị chặn chỉ có thể là superuser | P3 hôm nay; P2 từ ngày một lát cấp `UPDATE` trên `projects` cho dịch vụ | Ghi thành điều kiện: lát nào thêm đường `UPDATE projects` phải đặt `lock_timeout` cho câu lệnh đó và nêu 022 trong kế hoạch. Cùng điều kiện đó giữ cho điểm 1 của 7.1 còn đúng: role nào được cấp `UPDATE` trên `projects` thì cũng tự lấy được khoá dòng |
| B-4 | **Giao dịch của role AI đánh dấu khoá lên một dòng Z1**, qua hàm definer. Đây không phải lần ghi dữ liệu: không cột nào đổi, không bản dòng mới. Khoá ngoại của 021 đã làm đúng việc này ở mức `KEY SHARE` cho mỗi lệnh chèn nháp, nên nếu coi đây là vi phạm AR-03 thì khoá ngoại cũng vậy. Điều mới chỉ là **mức** khoá (B-3). [suy luận] Phép kiểm khoá ngoại của cùng lệnh chèn thấy giao dịch đã giữ khoá mạnh hơn và không ghi thêm | P3 (hồ sơ) | Ghi rõ trong chú thích đầu tệp và trong biên nhận, để người kiểm độc lập không phải tự suy |
| B-5 | Multixact. [suy luận] Không tăng so với hôm nay: multixact sinh ra khi hai giao dịch cùng khoá một dòng, điều các phép kiểm khoá ngoại của 33 bảng con đã gây ra; một giao dịch tự nâng mức khoá của mình không tạo multixact | Không phải khuyết điểm | — |
| B-6 | **Thêm một hàm `SECURITY DEFINER`**, có quyền khoá dòng mức ghi trên `projects`. Không gọi thẳng được, không tham số, khoá một dòng theo khoá chính | P3 | Cần ca fail-closed riêng như G11, và giữ nó trong ca canh definer |
| B-7 | Dòng có cặp (tenant, dự án) lệch: nếu chỉ lọc theo `p.id` như được tả, một dòng nháp sai tenant khoá chớp nhoáng dòng dự án của tenant khác trước khi khoá ngoại từ chối | P3 | Thêm `AND p.tenant_id = NEW.tenant_id` (7.4) |
| B-8 | Phục hồi data-only. [log] Dự án nạp trước tiên (vị trí 1 trên 61), nháp 27, ánh xạ 53; khoá ngoại vốn đã buộc dự án đi trước. Trong một giao dịch: khoá `SHARE` rồi `NO KEY UPDATE` trên dòng do chính giao dịch chèn, không chiếm bộ nhớ khoá. Phục hồi song song vẫn có `55P03` và `40P01` như A | Không phải khuyết điểm; tốt hơn A ở A-4 | — |
| B-9 | Vòng khoá chết với phép kiểm khoá ngoại của cùng lệnh chèn: không có — lệnh đã giữ khoá mạnh hơn trước khi phép kiểm chạy. Hai vòng của X2 còn nguyên và vẫn bị huỷ bằng `40P01` [suy luận]. Chú thích ở `migrations/020_document_review.sql:261-262` nêu đúng vòng «hai bên cùng giữ khoá chia sẻ rồi cùng nâng»: ở đây chỉ phiên vừa chèn nháp vừa ghi ánh xạ dựng được | Như A | — |
| B-10 | **Bằng chứng ở làn PGlite yếu đi.** Khoá dòng không hiện trong `pg_locks` khi không ai chờ; mức khoá không đọc được nếu thiếu tiện ích mở rộng. G21 chỉ còn khẳng định được «dòng dự án đang có người khoá» qua `xmax`; «hết giao dịch thì hết khoá» không khẳng định được trên một kết nối. Chứng minh hành vi chỉ còn ở làn native | P3 | Ghim chữ ở G12; hành vi ở G23, G24, Y1 và các ca mới |
| B-11 | **Vận hành khó nhìn hơn.** Không có bảng nào liệt kê người đang giữ khoá dòng; chỉ khi có lệnh đang chờ mới hỏi được `pg_blocking_pids` | P3 | Câu ở 7.4 |
| B-12 | Câu trả lời khi không thấy dòng phải khớp một ca hiện có: `tests/z4-schema.test.ts:265-267` chờ `/foreign key/`. Nếu guard trả câu riêng thì ca đó đổi | P3 | Trả đúng mã và chữ của khoá ngoại (7.4), hoặc đổi ca đó và ghi vào X5 |
| B-13 | Làm lại một task đã xanh, trong vòng sửa có trần: 022, tám ca, kế hoạch (X2, R34, điều kiện 18), hai review, một lượt native | rủi ro tiến độ | — |
| — | PGlite: `FOR SHARE` và `FOR NO KEY UPDATE` trong PL/pgSQL chạy được trên một kết nối; bản demo chạy bằng superuser và không chèn nháp. Ngoài B-10 tôi không thấy gì riêng của PGlite [suy luận] | — | Planner chạy thử như bản 0.6 |

### 7.4 Nếu chọn B: câu lệnh của 022 và của tệp lùi

Ba phần bổ sung so với B như được tả: **(1)** lọc thêm `p.tenant_id = NEW.tenant_id` (B-7); **(2)** không thấy dòng thì từ chối, ở guard (B-1); **(3)** cũng vậy ở hàm của bảng ánh xạ (B-1). Hàm phạm vi, ba câu `REVOKE`, ba cặp `DROP TRIGGER IF EXISTS` / `CREATE TRIGGER`, dòng `schema_migrations`, `BEGIN` / `SET LOCAL lock_timeout` / `COMMIT` **giữ nguyên**. Chú thích đầu tệp viết lại ở mục 2, mục 3 và đoạn «An advisory lock has no access control». Hai hàm thay bằng:

```sql
CREATE OR REPLACE FUNCTION intelligence.ai_drafts_pointer_only_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp SET row_security = off SET lock_timeout = '5s' AS $$
DECLARE latest text;
BEGIN
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'An AI draft is written in a READ COMMITTED transaction' USING ERRCODE = 'LTZ02';
  END IF;
  -- A row without a tenant or a project is answered by the table (23502).
  IF NEW.tenant_id IS NOT NULL AND NEW.project_id IS NOT NULL THEN
    -- The project row is locked FOR SHARE to the end of this transaction: shared with other draft inserts, in conflict with the FOR NO KEY UPDATE
    -- that a mapping insert takes (project_domain_mappings_draft_lock). It is a statement of its own, before the read: the read below takes its
    -- snapshot after the wait. The lock is the one the foreign key of this table already takes on that row, at a higher strength; no column changes.
    PERFORM 1 FROM public.projects p WHERE p.id = NEW.project_id AND p.tenant_id = NEW.tenant_id FOR SHARE;
    IF NOT FOUND THEN
      -- A project row this statement cannot see cannot be locked, so a mapping written with it could commit unseen: refused, with the answer of the
      -- foreign key of the table.
      RAISE EXCEPTION 'insert or update on table "%" violates foreign key constraint "ai_drafts_project_id_tenant_id_fkey"', TG_TABLE_NAME
        USING ERRCODE = '23503', HINT = 'Raised by the trigger ai_drafts_pointer_only_guard (migration 022): no project row of this tenant is visible to this statement.';
    END IF;
  END IF;
  SELECT m.domain_code INTO latest FROM public.project_domain_mappings m
   WHERE m.tenant_id = NEW.tenant_id AND m.project_id = NEW.project_id
   ORDER BY m.mapping_version DESC LIMIT 1;
  IF latest = 'IBS_HI' THEN
    RAISE EXCEPTION 'An AI draft is not stored for a pointer-only project' USING ERRCODE = 'LTZ01';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION intelligence.project_domain_mappings_draft_lock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp SET row_security = off SET lock_timeout = '5s' AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL AND NEW.project_id IS NOT NULL THEN
    -- Held to the end of the transaction that writes the mapping: a draft insert of this project waits for it, and it waits for draft inserts in
    -- flight. It does not wait for, and is not waited for by, an insert into any other table that references the project (FOR KEY SHARE).
    PERFORM 1 FROM public.projects p WHERE p.id = NEW.project_id AND p.tenant_id = NEW.tenant_id FOR NO KEY UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'insert or update on table "%" violates foreign key constraint "project_domain_mappings_project_id_tenant_id_fkey"', TG_TABLE_NAME
        USING ERRCODE = '23503', HINT = 'Raised by the trigger project_domain_mappings_draft_lock (migration 022): no project row of this tenant is visible to this statement.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
```

Ghi chú cho hai khối trên:

- Tên ràng buộc của bảng nháp lấy từ [điều phối đo]; tên của bảng ánh xạ là tên mặc định theo quy tắc đặt tên của PostgreSQL [suy luận]: đọc tên thật từ catalog trước khi chép.
- Trả mã và chữ của khoá ngoại là để ca ở `tests/z4-schema.test.ts:265-267` giữ nguyên, và để role chịu RLS không nhận câu trả lời nào mới: cặp (tenant, dự án) không có thật vốn đã nhận `23503` từ bảng. Cách khác: một mã riêng (ví dụ `LTZ03`) với câu riêng như 020 đã làm, và đổi ca đó. Phiên điều phối chọn.
- `PERFORM … FOR SHARE` đặt `FOUND`. Hàm definer cần chủ hàm có quyền ghi trên `projects` và không bị RLS lọc: login migration là superuser. Chủ hàm không đạt thì câu khoá lỗi, tức đóng.
- Thứ tự trong guard giữ như A: mức cô lập → khoá → đọc ánh xạ.

**Tệp lùi: không đổi câu lệnh nào.** Cùng ba trigger, cùng ba hàm, cùng chữ ký; nó cũng gỡ được thân của A và thân của bản 0.4. Chỉ nên thêm vào dòng chú thích thứ hai rằng tệp gỡ được mọi thân từng có của 022. R37 mở rộng: CSDL đã ghi `'022'` với thân A phải được áp lại.

Câu vận hành thay cho câu E của mục 4.2 (chỉ đọc; chưa chạy):

```sql
-- Khi một lệnh ghi ánh xạ hoặc chèn nháp đang chờ: ai chặn nó
SELECT w.pid AS waiting, w.query_start, b.pid AS blocker, b.usename, b.state, b.xact_start,
       now() - b.state_change AS in_state_for
  FROM pg_stat_activity w
  JOIN LATERAL unnest(pg_blocking_pids(w.pid)) AS x(pid) ON true
  JOIN pg_stat_activity b ON b.pid = x.pid
 WHERE w.wait_event_type = 'Lock' AND w.datname = current_database();
```

### 7.5 Nếu chọn B: ca nào phải đổi

| Ca | Đổi gì |
|---|---|
| G19, G25, G26 | **Không đổi.** Hàm phạm vi không bị chạm |
| G20 | Đổi bảng ghim của hàm khoá: `prosecdef` đúng, `proconfig` thêm `row_security=off`. Thêm hai lệnh bị từ chối: dưới role AI và dưới role runtime, `SELECT 1 FROM public.projects … FOR SHARE` → `/permission denied/` — đây là ca nói thẳng rằng không role nào tự lấy được khoá |
| G21 | **Viết lại, và yếu đi** (B-10). Bỏ `NS`, `locks()`, `keyOf`. Trong giao dịch, sau lệnh chèn nháp và sau lệnh ghi ánh xạ: `xmax` của dòng dự án khác 0 và bằng mã giao dịch hiện tại. Bỏ khỏi tên các chữ «shared», «exclusively», «gone when the transaction ends» |
| G22 | **Không đổi** (giữ `NO KEY UPDATE` rồi xin `SHARE` trong cùng giao dịch; dòng thiếu dự án vẫn do bảng trả). Ý của DB-5 vẫn nên thêm |
| G23, G24 | **Không đổi.** Chỉ đổi thứ được chờ; `waitForBlocked` đếm `wait_event_type='Lock'` nên vẫn đúng |
| G27 | **Viết lại.** Phiên của role AI không còn tự giữ khoá được. Hình dạng mới: phiên đó giữ **một giao dịch còn mở sau một lệnh chèn nháp**; lệnh ghi ánh xạ thất bại `55P03` trong trần; giao dịch kết thúc thì lệnh ghi ánh xạ qua và nháp kế tiếp bị từ chối `LTZ01`. Không còn khoá mức phiên để dọn |
| Y1 | **Không đổi** |
| Y2 | Đổi cách giữ: kết nối A giữ `SELECT 1 FROM public.projects WHERE id = $1 FOR NO KEY UPDATE` trong một giao dịch mở. Phần còn lại giữ |
| RB1, RB2, RB3 | **Không đổi**: so hình dạng tương đối, tên không đổi. Đề nghị của DB-6 vẫn áp dụng |
| G11 (ngoài danh sách của yêu cầu, nhưng **phải đổi**) | Câu lỗi nay tới từ câu khoá dòng dự án, không từ câu đọc ánh xạ: biểu thức ở `:181` đổi tên bảng thành `projects` [suy luận về việc lỗi RLS đến trước lỗi quyền; đo ở 7.6]. Thêm ca song sinh cho hàm khoá: đổi chủ hàm thành một role bị RLS lọc → mọi lệnh ghi ánh xạ bị từ chối |
| G12 | Bảng `PINS` của hàm khoá như G20. Các đoạn phải có: guard — câu `FOR SHARE` đầy đủ, `IF NOT FOUND THEN`, `ERRCODE = '23503'`; hàm khoá — câu `FOR NO KEY UPDATE` đầy đủ. Thứ tự: `'transaction_isolation'` < `FOR SHARE` < `FROM public.project_domain_mappings`. Khẳng định chủ hàm là superuser hoặc `BYPASSRLS` cho **cả hai** hàm definer |
| `tests/z4-schema.test.ts` | Không đổi nếu chọn chữ của khoá ngoại (B-12). Ca «no SECURITY DEFINER function is executable by libetech_ai» giữ và nay canh hai hàm |
| DB-2 của báo cáo này | Hai hình dạng đề nghị vẫn đúng; `23503` nay do guard trả |
| **Ca mới** | **N1** — nháp cho một cặp (tenant, dự án) không có: `23503`, không lưu, cho cả role AI trong phạm vi đã khai lẫn login vận hành. **N2** — ánh xạ cho dự án không có: `23503`. **N3** (native) — ca của B-1. Kết nối A tạo dự án và ghi ánh xạ `IBS_HI` trong một giao dịch chưa commit. Kết nối B chạy **một lệnh chèn hai dòng**: dòng đầu là nháp cho dự án đó, dòng sau có một biểu thức tính chậm (ví dụ `pg_sleep`) để câu lệnh còn chạy trong lúc A commit. Chờ: lệnh của B bị từ chối `23503` **ngay ở dòng đầu**, trước khi kịp ngủ, không dòng nào được lưu; sau khi A commit, một nháp mới cho dự án đó bị từ chối `LTZ01`. Trên B như được tả, ca này phải đỏ vì `AssertionError`: cả hai dòng được lưu. (Một lệnh chèn một dòng không đủ: phép kiểm khoá ngoại của bảng sẽ từ chối nó dù guard có sai.) **N4** (native) — phần dư B-2 nói thành ca, như G27 đã làm với R34. **N5** (native) — phần dư B-3: trong lúc một giao dịch chèn nháp còn mở, `UPDATE projects` của dự án đó dưới `SET LOCAL lock_timeout` trả `55P03`, còn lệnh chèn vào một bảng con khác thì qua ngay |

Kế hoạch cũng đổi: X2 (cơ chế, trần, vòng khoá chết, phục hồi), R34 viết lại theo B-2 và B-3, điều kiện 18 (bỏ `idle_session_timeout` và phép canh `pg_locks`; giữ `idle_in_transaction_session_timeout`; thêm điều kiện của B-3), bảng `proconfig` của Task F1, X5 (G11, G21, G27, Y2).

### 7.6 Nếu chọn B: điều phải đo trên PostgreSQL 16 trước khi commit

[điều phối đo] đã phủ: ma trận xung đột của ba mức khoá, `55P03` ở trần, ảnh chụp mới sau khi chờ ở `FOR SHARE`, và `42501` cho role runtime. Còn thiếu:

1. B-1: ca N3, trước và sau khi thêm phép từ chối.
2. B-2: hai kết nối chèn nháp gối nhau, một lệnh ghi ánh xạ chờ — nó có được khoá trong 5 giây không. Kết quả nào cũng ghi vào R34.
3. Đường phục hồi: trong một giao dịch, chèn dự án, chèn nháp cho nó, rồi ghi ánh xạ cho nó — không lỗi, không chờ.
4. G11 dưới B: câu lỗi thật khi chủ hàm là `libetech_runtime`.
5. Tên thật của ràng buộc khoá ngoại trên `public.project_domain_mappings`.
6. `lock_timeout` của phiên trở lại giá trị cũ sau một lệnh ghi ánh xạ (hàm khoá nay là definer).

### 7.7 Điều tôi đã sửa so với bản đầu của mục 2.9

Bản đầu viết rằng khoá dòng trên `public.projects` có «mặt tấn công rộng hơn» vì một giao dịch chèn nháp còn mở chặn mọi `UPDATE` dòng dự án của dịch vụ. Tiền đề đó sai với hệ thống này: [mã] không mã nào trong `src`, `scripts`, `deploy`, `migrations` ghi `projects`; [điều phối đo] không role không-superuser nào có quyền ghi trên bảng đó. Điều còn lại của lập luận ấy là B-3: một phần dư cho tương lai, không phải một lý do loại. Tôi cũng đã bỏ sót ở bản đầu rằng repo có sẵn mẫu này ở 020, và rằng khoá ngoại đã khoá đúng dòng đó cho mỗi lệnh chèn nháp.

VERDICT: READY FOR GATE
