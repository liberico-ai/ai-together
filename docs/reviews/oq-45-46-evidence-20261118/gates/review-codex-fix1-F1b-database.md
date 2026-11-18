# Soát lại — Task F1b (khoá dòng trên `public.projects` thay khoá tư vấn), phần CSDL

- **Ngày:** 18/11/2026 · **Vai:** `liberico-database-reviewer`. **Khuyến nghị cho Chairman, không phải phê duyệt.** Không sửa mã, không git ghi, không chạy test, không kết nối CSDL nào, không đọc `.env*` hay `.runtime/`.
- **Phạm vi:** chỉ diff `f434f0a..56d257c` của `migrations/` và `tests/`. Báo cáo trước (`gates/review-codex-fix1-F1-database.md`, cho `cb1d7dc`) giữ nguyên; báo cáo này soát phần thay nó. Số dòng là của tệp ở `56d257c`.
- **Phán quyết đã được áp** (của phiên chính, không phải của Chairman): thiết kế B ở mục 7 của báo cáo trước cùng ba phần bổ sung, **trừ mức khoá ở guard: `FOR NO KEY UPDATE` ở cả hai phía**, không phải `FOR SHARE`.
- **Đã đọc:** gói diff (một lần); brief và báo cáo của builder (coi là lời khai); `measurements-pg16-rowlock.txt`; ba log `codex-fix1-F1b-red.txt`, `codex-fix1-F1b-green.txt`, `codex-fix1-F1b-native-verbose.txt`. Tệp ngoài diff chỉ mở để kiểm một rủi ro nêu được tên (mục 7).
- **Nhãn:** **[mã]** = đọc từ mã ở `56d257c`; **[log]** = đọc từ log hoặc tệp đo trong thư mục bằng chứng; **[suy luận]** = từ hiểu biết về PostgreSQL 16 (bộ quản lý khoá, khoá dòng, RLS), chưa có log nào đo.

## Kết luận

| Câu hỏi | Phán quyết |
|---|---|
| A. SQL của hai hàm | **Đúng.** Trùng từng byte với brief. Mức khoá, lọc tenant, phép từ chối, xử lý NULL, thứ tự câu lệnh và các thiết lập definer đều đúng. Không tìm thấy đường nào lưu nháp sau khi ánh xạ `IBS_HI` đã commit, cho mọi lệnh ghi đi qua hai trigger |
| `FOR NO KEY UPDATE` ở phía guard có mang vòng khoá chết hay lần chờ không trần nào không | Một vòng khoá chết **mới** (hai giao dịch chèn nháp cho cùng hai dự án theo thứ tự ngược; bị huỷ bằng `40P01`; dịch vụ không dựng được). Không lần chờ không trần nào do 022 gây ra cho chính nó; trần 5 giây là cho **từng lần lấy khoá** |
| B. DB-1…DB-7 | Cả bảy đã áp trong ca kiểm. Cách builder xử lý kiểu (b) của G19 là **đúng** |
| C. Mười bốn ca được hỏi | Mười ba ca khẳng định điều tên ca nói và đỏ được. G21: ý (i) đỏ được, ý (ii) không (R-1) |
| Finding | P0: 0 · P1: 0 · P2: 0 · **P3: 5**. Không finding nào đòi đổi SQL của hai hàm |
| DB-9 của báo cáo trước | **Đóng** với các role đang có: không role không-superuser nào tự lấy được khoá ([log] phép đo 4; G20). Phần dư mới nhỏ hơn và đã ghi ở chú thích đầu tệp |

## 1. (A) SQL của hai hàm

### 1.1 Trùng brief

[mã] So bằng máy: phần chú thích đầu tệp và khối hai hàm của brief nằm nguyên trong `migrations/022_ai_drafts_pointer_only_guard.sql`. Hàm phạm vi, ba dòng `REVOKE`, ba cặp trigger, `BEGIN`, `SET LOCAL lock_timeout`, dòng `schema_migrations`, `COMMIT` trùng `cb1d7dc`. Tệp lùi chỉ đổi hai dòng chú thích. Không `GRANT`, không còn `pg_advisory`, không ký tự `CR`.

### 1.2 Từng điểm

| Điểm | Phán quyết | Căn cứ |
|---|---|---|
| Mức khoá `FOR NO KEY UPDATE` ở cả hai phía (`:67`, `:94`) | Đúng | Xung đột với chính nó nên nháp và ánh xạ thay phiên; không xung đột với `FOR KEY SHARE` của phép kiểm khoá ngoại nên 33 bảng con khác không bị giữ. [log] N5; phép đo 1, 3. Người chờ phải đi qua hàng đợi của khoá dòng, khác với `FOR SHARE`: [log] phép đo 3 (0,4 giây so với không có trần), N4 |
| Lọc `p.tenant_id = NEW.tenant_id` | Đúng, và cần | Dòng có cặp (tenant, dự án) lệch không thoả điều kiện quét nên **không bị khoá và không chờ**: không có kênh chờ xuyên tenant [suy luận]. N1 (c) ghim vế này (không có vế thì khoá ngoại trả lời, không có `HINT`) |
| Phép từ chối khi không thấy dòng (`:68-74`, `:95-99`) | Đúng | `PERFORM` đặt `FOUND`. Mã `23503`, chữ của khoá ngoại, ba trường `SCHEMA`, `TABLE`, `CONSTRAINT`, một `HINT` nêu tên trigger, **không `DETAIL`** nên không mang mã nào. Hai tên ràng buộc khớp catalog ([log] phép đo 3). Role chịu RLS không nhận câu trả lời nào mới: cặp không có thật vốn đã nhận `23503` từ bảng |
| Xử lý NULL (`:62`, `:90`) | Đúng | Thiếu tenant hoặc dự án thì bỏ qua bước khoá; bảng trả `23502`. [log] G22, G15 xanh hai làn |
| Thứ tự câu lệnh ở guard | Đúng | Mức cô lập → khoá → từ chối khi không thấy → đọc ánh xạ → `LTZ01`. G12 ghim bằng vị trí trong `prosrc`; chuỗi `FOR NO KEY UPDATE` không xuất hiện trong chú thích nào đứng trước câu khoá |
| Hàm khoá thành `SECURITY DEFINER` (`:87`) | Đúng | Cùng `search_path`, `row_security = off`, `lock_timeout = '5s'`; `EXECUTE` đã thu hồi; thân chỉ có một câu khoá theo khoá chính với giá trị của `NEW` làm tham số: không có bề mặt chèn mã. G12, G20 ghim `prosecdef`, `proconfig`; G11 ghim tính đóng |
| Ảnh chụp sau khi chờ | Đúng | Câu khoá là câu lệnh riêng; câu đọc lấy ảnh chụp mới. [log] G23, Y1 xanh trên PostgreSQL 16; phép đo 1 «B waited for A, then read: IBS_HI» |
| Chú thích đầu tệp (`:16-24`) | Đúng, thiếu hai câu | Nêu đúng cái giá (nháp của một dự án chạy lần lượt; `UPDATE` dòng dự án phải chờ). Chưa nêu vòng khoá chết mới (R-4) và trần theo từng lần lấy khoá (R-5) |

### 1.3 Có đường nào lưu nháp cho dự án mà ánh xạ `IBS_HI` đã commit trước không

Không tìm thấy, với mọi lệnh ghi đi qua hai trigger ở READ COMMITTED. Đã xét:

| Kịch bản | Kết quả |
|---|---|
| Ánh xạ giữ khoá trước | Nháp chờ, rồi đọc ánh xạ đã commit: `LTZ01`. [log] G23, Y1 |
| Nháp giữ khoá trước | Ánh xạ chờ tới khi giao dịch nháp kết thúc: nháp được lưu **trước**. [log] G24, G27 |
| Dòng dự án chưa commit lúc guard chạy (khe B-1) | Từ chối ngay ở dòng đó. [log] N3, 320 ms; phép đo 3: tắt phép từ chối thì một nháp được lưu, bật thì `23503` sau 1 ms |
| Dòng dự án chưa commit lúc hàm khoá của ánh xạ chạy | Cùng nhánh `NOT FOUND`: từ chối [mã]. N2 đi nhánh này với dự án không có; chưa có ca với dự án «chưa commit bởi phiên khác» |
| Dự án và ánh xạ tạo trong cùng giao dịch, rồi nháp trong chính giao dịch đó | Thấy dòng của chính mình, khoá được, đọc được ánh xạ của chính mình. [log] G22 |
| Dòng nháp trong giao dịch con rồi lùi | Dòng mất cùng lúc với khoá [suy luận] |
| Ánh xạ thất bại sau khi đã giữ khoá (trùng `mapping_version`) | Giao dịch ánh xạ lùi; nháp đang chờ đi tiếp và không thấy ánh xạ nào: đúng |
| Dòng dự án đang bị `UPDATE` bởi phiên khác | Câu khoá chờ rồi khoá bản mới nhất, hoặc `55P03` sau trần [suy luận] |

Còn nguyên như trước, ngoài tầm của hai trigger: ánh xạ ghi khi trigger bị tắt, dưới `session_replication_role = replica`, hoặc qua `pg_restore --disable-triggers`; dữ liệu có sẵn (OQ-54).

### 1.4 `FOR NO KEY UPDATE` ở phía guard: vòng khoá chết và lần chờ

**Vòng khoá chết.**

| Vòng | Có không | Ghi chú |
|---|---|---|
| Hai phiên cùng chèn nháp rồi cùng ghi ánh xạ cho một dự án (vòng (ii) của X2 dưới khoá tư vấn) | **Hết** | Phiên thứ hai chờ ngay ở lệnh chèn nháp: xếp hàng, không vòng [suy luận] |
| Giao dịch đã giữ `KEY SHARE` trên dòng dự án (từ một lệnh chèn bảng con trước đó) rồi xin `NO KEY UPDATE` | Không | `KEY SHARE` không chặn `NO KEY UPDATE`: không có vòng nâng mức như với `FOR SHARE`. Đây là lý do `migrations/020_document_review.sql:261-262` chọn cùng mức khoá |
| Phép kiểm khoá ngoại của cùng lệnh chèn | Không | Giao dịch đã giữ khoá mạnh hơn trên dòng đó |
| **Hai giao dịch cùng chèn nháp cho hai dự án theo thứ tự ngược** (một lệnh nhiều dòng, hoặc nhiều lệnh trong một giao dịch) | **Mới** | Trước đây hai lệnh chèn nháp không chờ nhau. PostgreSQL huỷ một bên bằng `40P01` sau `deadlock_timeout`. [mã] Dịch vụ chèn một dòng mỗi giao dịch (`src/server/suggestions.ts:157`) nên không dựng được; phục hồi chạy một kết nối. [log] Không dòng `40P01` trong lượt native. Chưa ghi ở đâu: R-4 |
| Một giao dịch vừa chèn nháp vừa ghi ánh xạ cho nhiều dự án, ngược thứ tự với giao dịch khác | Như dòng trên | Chỉ phiên ghi được cả hai bảng |
| Với việc áp lại hoặc lùi 022 | Không | Thứ tự khoá bảng vẫn là `intelligence.ai_drafts` rồi `public.project_domain_mappings`; 022 không khoá `public.projects` lúc áp |

**Lần chờ.**

- **Trần 5 giây là cho từng lần lấy khoá** [suy luận]. Người đứng đầu hàng chờ một lần (giao dịch đang giữ): `55P03` sau 5,0 giây ([log] G27 5 346 ms, Y2 5 352 ms, phép đo 3). Người đứng sau một người chờ khác lấy khoá **hai lần** — chỗ trong hàng, rồi giao dịch của người đứng ngay trước — nên có thể chờ tới gần 10 giây trước khi được phục vụ hoặc nhận `55P03`. Trần 10 giây mỗi câu lệnh của pool dịch vụ có thể trả `57014` trước. Có trần; chỉ không phải đúng 5 giây như chữ trong chú thích (R-5).
- **Thứ tự đến trước, phục vụ trước là hành vi thường gặp, không phải bảo đảm tuyệt đối** [suy luận]: một lệnh đến đúng khoảnh khắc dòng vừa được nhả, trước khi người đứng đầu hàng kịp đánh dấu, có thể chen trước; người đứng đầu vẫn giữ chỗ đầu hàng. Muốn bỏ đói bằng cách này phải trúng một khe cỡ micro giây ở mọi lượt. [log] Phép đo 3 và N4 cho thấy hành vi thường gặp.
- **Thứ một giao dịch chèn nháp còn mở giữ lại:** lệnh chèn nháp khác của dự án đó và lệnh ghi ánh xạ của dự án đó (cả hai `55P03` trong trần); mọi `UPDATE` hay `DELETE` của dòng dự án đó — lệnh của bên thứ ba, **không trần nào của 022 phủ** ([log] N5: `55P03` chỉ vì ca tự đặt `lock_timeout`). [mã + log] Không mã nào và không role không-superuser nào ghi `projects`, nên người chờ không trần chỉ có thể là một phiên superuser không đặt `lock_timeout`.
- **Không bị giữ:** lệnh chèn vào 33 bảng khác trỏ tới dự án; `decide`; đường nhận tin; mọi lệnh đọc.
- **Điều `FOR NO KEY UPDATE` trả lại so với `FOR SHARE`:** một giao dịch chèn nháp còn mở chặn được **nháp của phiên khác** cho dự án đó. Có trần, thành tiếng, chỉ chạm tính sẵn sàng của Z4. Cùng loại với phần dư đã nêu ở chú thích đầu tệp.

## 2. (B) Finding DB-1…DB-7 của báo cáo trước

| # | Đã áp chưa | Ghi chú |
|---|---|---|
| DB-1 | Có, trong ca | G25 `:513-529` ghim thêm phía `SELECT`: đúng một policy `ai_select` áp cho `libetech_ai`, `USING` bằng hằng. [log] Chuỗi khớp trên PostgreSQL 16 (G25 xanh ở làn native). Chú thích đã sửa thành «giao của `ai_insert` và `ai_select`». Phần chữ của kế hoạch (R33, điều kiện 20) nằm ngoài diff này |
| DB-2 | Có | G4 `:112-130` thêm (a) và (b), cả hai `23503`, không `LTZ01`. Một sắc thái: sau F1b có **hai** vế tenant (ở câu khoá và ở câu đọc ánh xạ); bỏ riêng một vế thì (a), (b) vẫn xanh, bỏ cả hai mới đỏ. Tính chất cần giữ — dò chéo tenant không bao giờ nhận `LTZ01` — vì vậy có ca hành vi và có hai lớp. Vế ở câu khoá còn được N1 (c) ghim riêng; vế ở câu đọc nay là lớp dự phòng, ghim bằng chữ ở G12. Không thành finding |
| DB-3 | Có, và tốt hơn điều tôi đề nghị | G19 `:447-470` chạy cả sáu kiểu dòng với trigger phạm vi tắt, và khẳng định `hint` **không có**: phân biệt được câu trả lời của policy với câu của trigger (có `HINT`) và của guard (`23503`) |
| DB-4 | (a) hết hiệu lực; (b) ngoài diff | Khoá dòng không chiếm bộ nhớ khoá dùng chung. Ý «không dùng `-j`» còn nguyên: mục 5.1 |
| DB-5 | Có | G22 `:599-611`: nháp rồi ánh xạ trong một giao dịch; và thứ tự phục hồi một giao dịch với dòng dự án mới |
| DB-6 | Có | RB3: `toOldShape` gỡ `lock_timeout` khỏi `proconfig` và khẳng định đã gỡ; bước (i) chứng minh tệp thuận đặt lại |
| DB-7 | Có | (a) G20 `:481`: role AI đổi `proconfig` của hàm khoá → `/must be owner/`. (b) `provolatile:'v'` cho cả ba hàm ở G12 |

**Kiểu (b) của G19 — cách builder làm là đúng.** `WITH CHECK` chạy sau trigger `BEFORE`. Khi trigger phạm vi tắt, dòng có cặp (tenant, dự án) không tồn tại bị guard trả `23503` trước khi policy được xét, nên không thử được policy. Với cặp có thật (`otherTenant`, `otherProject`) và phạm vi khai `[otherProject]` dưới tenant của role: guard thấy dòng dự án, dự án chưa ánh xạ, dòng tới policy; vế dự án và vế `ai_principal_id` đều thoả, **chỉ vế tenant từ chối**. Đó đúng là điều DB-3 muốn thử, và sát nhãn của kiểu (b) hơn cả cách dựng cũ. Hệ quả phụ vô hại: trong giao dịch luôn lùi đó, guard khoá chớp nhoáng dòng dự án của tenant kia. Một giới hạn còn lại, không do builder: helper `insertDraft` có `RETURNING`, nên ở các kiểu (a), (b), (e), (f) câu từ chối có thể đến từ `ai_select` thay cho `ai_insert`; chỉ (c) và (d) tách riêng được `ai_insert`. G25 ghim chữ của cả hai nên tôi không nêu thành finding.

## 3. (C) Từng ca

| Ca | Dòng | Khẳng định điều tên nói | Đỏ được không | Ghi chú |
|---|---|---|---|---|
| G11 | `:202` | Có | Có | Ghim nguyên câu `query would be affected by row-level security policy for table "projects"` cho cả guard lẫn hàm khoá. [suy luận] Bỏ `row_security = off` thì câu thành «permission denied»; bỏ `SECURITY DEFINER` ở hàm khoá thì ánh xạ được ghi. [log] Đỏ trên SQL cũ; xanh trên PostgreSQL 16 với cùng câu |
| G12 | `:226` | Có | Có | Ghim `prosecdef`, `proconfig`, `provolatile` của ba hàm; chủ của **cả hai** hàm definer; nguyên dòng khoá; thứ tự; không `pg_advisory`; thân khớp tệp trước và sau khi áp lại. [log] Đỏ trên SQL cũ |
| G20 | `:475` | Có, trừ chữ «no runtime role» | Có | Thử hai role (AI, runtime) với hai mức khoá; mười role chỉ được đo ngoài repo (R-3). Các lệnh quyền mới xanh cả trên SQL cũ vì chúng thử quyền của 001/010/016: đúng là đối chứng |
| G21 | `:575` | Một nửa | (i) có; **(ii) không** | (ii) `xmax` khác 0 đúng cả khi guard không khoá gì, vì phép kiểm khoá ngoại cũng khoá dòng đó. (i) chỉ canh việc khoá tư vấn quay lại. Builder đã nói rõ. R-1 |
| G22 | `:588` | Có | Có | Hai phần thêm khẳng định «không lỗi»: một lần tự chờ hay một phép từ chối nhầm với dòng do chính giao dịch chèn đều làm ca đỏ. Tên ca chưa nhắc hai phần thêm |
| G27 | `:709` | Có | Có | `55P03`, 4–9 giây, không dòng ánh xạ; rồi ánh xạ qua, nháp kế bị `LTZ01`. Thiếu trần thì hiện `57014` ở khẳng định về mã, không thành hết giờ của vitest. [log] 5 346 ms |
| N1 | `:614` | Có | Có | Ba hình dạng; khẳng định `hint` là thứ phân biệt guard với khoá ngoại. [log] Đỏ trên SQL cũ. Không so ba trường `schema`, `table`, `constraint` (R-2) |
| N2 | `:631` | Có | Có | `23503` có `hint` của hàm khoá; `lock_timeout` của phiên giữ nguyên `1234ms` sau một lệnh ghi ánh xạ |
| N3 | `:735` | Có | Có | Lệnh hai dòng, dòng sau tính chậm bằng truy vấn con tương quan nên được tính theo từng dòng; `23503` ở dòng đầu, dưới 1 giây, không dòng nào lưu; sau commit là `LTZ01`. Thiếu phép từ chối thì hai dòng được lưu. [log] 320 ms |
| N4 | `:777` | Có | Có | Ánh xạ và nháp đến sau cùng được thấy đang chờ; ánh xạ qua, nháp đến sau nhận `LTZ01`. [suy luận] Với `FOR SHARE` ở guard, nháp đến sau không chờ và ca hỏng ở `waitForBlocked` (một `Error`, không phải `AssertionError`). [log] 409 ms |
| N5 | `:799` | Có | Có | `UPDATE` dòng dự án `55P03` dưới `lock_timeout` 500 ms; `FOR KEY SHARE NOWAIT` qua. Guard không khoá thì `UPDATE` qua và ca đỏ. [log] 857 ms |
| N6 | `:820` | Có | Nửa đầu có | Lệnh ghi ánh xạ của đúng dự án đó qua dưới 1 giây dù có phiên giữ khoá tư vấn cũ mức phiên: đỏ dưới thân cũ. Nửa «nháp của dự án khác» đúng dưới cả hai thân: là đối chứng |
| Y2 | `tests/suggestions-concurrency.test.ts:176` | Có | Có | Chỉ đổi cách giữ khoá. Hết giờ 20 giây; thiếu trần thì pool trả `57014`. [log] 5 352 ms |
| RB3 | `tests/migrations-rollback.test.ts:477` | Có | Có | Xem DB-6 |

Bằng chứng chạy: [log] đỏ trên SQL cũ — 6 `AssertionError`, 0 `timed out`, đúng G11, G12, G20, G21, N1, N2. Xanh PGlite — 11 tệp, 305 đạt, 20 bỏ qua, typecheck 0. PostgreSQL 16 — 11 tệp, **325 đạt, 0 bỏ qua**, không `40P01`, không `57014`, không hết giờ; gồm cả sáu tệp mà lượt F1 chưa chạy native.

## 4. Finding

| # | Mức | Tệp:dòng | Kịch bản | Sửa thế nào |
|---|---|---|---|---|
| R-1 | P3 | `tests/z4-pointer-guard.test.ts:575-586` (G21) | [mã] Ý (ii) không đỏ được vì bất kỳ thay đổi nào của 022: phép kiểm khoá ngoại của bảng nháp và bảng ánh xạ cũng đặt `xmax` trên dòng dự án. Ý (i) chỉ canh việc khoá tư vấn quay lại. Tên ca nói «each lock the row of their project». Ở làn PGlite, việc guard khoá dòng vì vậy chỉ còn ghim bằng chữ (G12); hành vi có ở làn native (G24, G27, N4, N5) | Chỉ sửa ca. Một kết nối **quan sát được** việc guard khoá trước phép kiểm khoá ngoại: chạy một lệnh chèn hai dòng mà dòng sau lấy `xmax` của dòng dự án vào một cột chữ (truy vấn con tương quan như N3). Phép kiểm khoá ngoại chỉ chạy ở cuối câu lệnh, nên giá trị đọc được khác `0` khi và chỉ khi guard đã khoá ở dòng đầu. Hoặc đổi tên ca cho đúng điều nó khẳng định |
| R-2 | P3 | `migrations/022_ai_drafts_pointer_only_guard.sql:71-72`, `:96-97` · `tests/z4-pointer-guard.test.ts:614-629`, `:631-638` | [mã] Hai tên ràng buộc viết cứng trong hàm. N1, N2 so `code`, chữ «foreign key» và `hint`; không ca nào so ba trường `schema`, `table`, `constraint` của lỗi, cũng không ca nào so tên viết cứng với tên thật trong catalog. Đổi tên khoá ngoại về sau, hoặc gõ sai một ký tự, thì phép từ chối nêu một ràng buộc không có và mọi ca vẫn xanh | Trong N1 và N2: đọc `conname` của khoá ngoại trỏ tới `public.projects` từ `pg_constraint` và khẳng định `e.constraint`, `e.table`, `e.schema` bằng đúng giá trị catalog |
| R-3 | P3 | `tests/z4-pointer-guard.test.ts:475`, `:483-487` (G20) | [mã] Tên ca nói «no runtime role takes the row lock … by itself»; ca thử hai role. Cấp `UPDATE`, `DELETE` hay `TRUNCATE` trên `projects` cho một role khác về sau mở lại đúng DB-9 mà không ca nào đỏ. Mười role mới chỉ được đo một lần, ngoài repo | Thêm một khẳng định catalog (câu F ở 5.2 trả rỗng), hoặc lặp qua mọi role `libetech%` như phép đo 4 |
| R-4 | P3 | `migrations/022_ai_drafts_pointer_only_guard.sql:21-22` | [suy luận] Vòng khoá chết mới ở 1.4 (hai giao dịch chèn nháp cho cùng hai dự án theo thứ tự ngược → `40P01`) chưa được nêu ở chú thích đầu tệp, và đường tranh chấp bình thường «nháp thứ hai chờ nháp thứ nhất rồi được lưu» chưa có ca nào | Một câu trong chú thích đầu tệp hoặc trong phần dư của kế hoạch; thêm vào điều kiện cho pipeline: một dự án mỗi giao dịch, hoặc thứ tự dự án cố định, và coi `40P01` là thử lại được. Ca native là tuỳ chọn |
| R-5 | P3 | `migrations/022_ai_drafts_pointer_only_guard.sql:23-24`, `:65-66`, `:92-93` | [suy luận] Chú thích viết «a wait that long ends in 55P03». Trần là cho từng lần lấy khoá: người đứng sau một người chờ khác có thể chờ tới gần 10 giây (1.4). Người viết pipeline hoặc người ghi ánh xạ đọc chú thích sẽ đặt hết giờ của mình sát 5 giây | Sửa chữ trong ghi chú triển khai (mục 12 của 5.1); không đổi SQL. Nếu 022 còn bị chạm thì sửa cả chú thích |

## 5. (D) Ghi chú triển khai và câu chỉ đọc cho biên nhận — bản cho khoá dòng

Thay hẳn mục 4.1 và 4.2 của báo cáo trước.

### 5.1 Ghi chú triển khai

| # | Mục | Nội dung |
|---|---|---|
| 1 | Thứ tự áp | Sau 021; migration trước, mã sau. Trình áp bỏ qua bản đã ghi: CSDL nào đã ghi `'022'` với một thân cũ hơn (một trigger; hoặc ba trigger với khoá tư vấn) phải lùi bằng tệp lùi hiện tại rồi áp lại, hoặc chạy tay tệp thuận. Câu B phát hiện thân cũ |
| 2 | Ai áp | Login migration, superuser. Nó là chủ của hai hàm definer; chủ hàm phải không bị RLS lọc **và** có quyền ghi trên `public.projects`, nếu không mọi lệnh chèn nháp và mọi lệnh ghi ánh xạ đều bị từ chối (đóng) |
| 3 | Khoá lúc áp | Lần đầu: `SHARE ROW EXCLUSIVE` trên `intelligence.ai_drafts` và `public.project_domain_mappings` (chặn ghi, không chặn đọc). Áp lại và lùi: `ACCESS EXCLUSIVE` trên hai bảng đó tới `COMMIT`. Không khoá `public.projects`. `lock_timeout` 5 giây [suy luận] |
| 4 | Lùi | Gỡ ba trigger và ba hàm của mọi thân từng có; mở lại OQ-45 3(b), CX1 và CX4. Thứ tự 022 rồi 021. Không chạy trên CSDL thật khi chưa có lời Chairman |
| 5 | Dữ liệu có sẵn | 022 không rà dòng cũ (OQ-54) |
| 6 | Guard vắng mà không ai biết | Tắt riêng trigger phạm vi (CX1 mở lại); tắt trigger của bảng ánh xạ (CX4 mở lại); `session_replication_role = replica`; `pg_restore --disable-triggers`; thân cũ; chủ hàm bị đổi |
| 7 | Phục hồi data-only | Dự án nạp trước (khoá ngoại vốn buộc vậy), rồi nháp, rồi ánh xạ; trong một giao dịch không tự chờ ([log] G22, phép đo 3). Phiên phục hồi ở READ COMMITTED. Không dùng `-j`: lệnh `COPY` nháp và lệnh `COPY` ánh xạ sẽ chờ nhau (`55P03`) hoặc chờ vòng (`40P01`) |
| 8 | Mức cô lập | Mọi lệnh chèn nháp ở READ COMMITTED, nếu không là `LTZ02`. Không đổi |
| 9 | Ai tự lấy được khoá | Chỉ role có `UPDATE`, `DELETE` hoặc `TRUNCATE` trên `public.projects`: hôm nay không role không-superuser nào (câu F). **Cấp một trong ba quyền đó cho bất kỳ role nào là mở lại DB-9**: phải soát lại 022 |
| 10 | Thứ một giao dịch chèn nháp còn mở giữ lại | Nháp khác và ánh xạ của **dự án đó**: `55P03`. `UPDATE` và `DELETE` của dòng dự án đó: chờ theo `lock_timeout` của chính phiên đang chờ — phiên superuser không đặt thì chờ không trần. Không giữ lại: lệnh chèn vào các bảng khác trỏ tới dự án, `decide`, nhận tin, đọc |
| 11 | Lệnh ghi ánh xạ thất bại `55P03` | Có giao dịch đang giữ dòng dự án: chạy câu E, xử lý phiên đó, thử lại. Ghi bước này vào quy trình xác nhận một dự án là `IBS_HI` |
| 12 | Trần chờ | 5 giây cho **từng lần lấy khoá**; đứng sau một người chờ khác thì tới gần 10 giây. Trần 10 giây của pool dịch vụ có thể trả `57014` trước. Đặt hết giờ phía gọi trên 10 giây |
| 13 | Pipeline (khi có) | Giao dịch chèn nháp ngắn: không gọi mô hình, không chờ gì trong giao dịch. Một dự án mỗi giao dịch, hoặc thứ tự dự án cố định. Coi `55P03` và `40P01` là thử lại được |
| 14 | Login AI (khi có) | Có `idle_in_transaction_session_timeout`. Không còn dạng khoá mức phiên nên `idle_session_timeout` không còn cần cho việc này. Dưới chính login đó câu D trả đúng |
| 15 | Log máy chủ | Dòng `ERROR` mới: `55P03` với `CONTEXT` nêu tên hàm; `23503` do trigger ném, có `HINT`, **không** `DETAIL` (lỗi của chính khoá ngoại thì có `DETAIL` mang giá trị khoá); `42501` do trigger phạm vi, có `HINT`; có thể có `40P01`. Phạm vi của R23 (tham số trong log) không đổi |
| 16 | Chi phí | Mỗi dòng nháp và mỗi dòng ánh xạ: một lần dò khoá chính và một lần khoá dòng trên `projects`; phép kiểm khoá ngoại của cùng lệnh không ghi thêm [suy luận]. Nháp của một dự án chạy lần lượt trong lúc giao dịch còn mở |
| 17 | Vùng dữ liệu | Giao dịch của role AI đặt một khoá dòng lên một dòng Z1 qua hàm definer. Không cột nào đổi, không bản dòng mới, role không được cấp gì: không phải lần ghi Z1 theo nghĩa của AR-03. Khoá ngoại của 021 đã làm việc này ở mức thấp hơn. Ghi rõ để người kiểm độc lập không phải tự suy |
| 18 | Điều kiện cho lát về sau | Lát nào thêm đường `UPDATE projects` cho dịch vụ phải đặt `lock_timeout` cho câu lệnh đó, nêu 022 trong kế hoạch, và soát lại mục 9 |

### 5.2 Các câu chỉ đọc

**Trạng thái của cả sáu câu: «chưa chạy».** Tôi viết chúng bằng cách đọc tệp và không kết nối CSDL nào. Chạy một lần trên CSDL thử trước khi chép vào biên nhận. Chỗ nào giá trị mong đợi đã có log đỡ thì ghi rõ.

**A — trigger và thứ tự chạy** (chưa chạy; chờ 5 dòng):

```sql
SELECT n.nspname || '.' || c.relname AS tbl, t.tgname, t.tgenabled, t.tgtype,
       pn.nspname || '.' || p.proname AS fn
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

Thứ tự dòng là thứ tự chạy (`tgname` kiểu `name` sắp theo byte): trong các dòng `tgtype = 7` của bảng nháp, trigger phạm vi phải đứng trước guard. [log] Ba tên, `O` và 7 của ba trigger 022 khớp G12 trên PostgreSQL 16. Giá trị 27 và schema của hai dòng `…_immutable` là [suy luận].

**B — ba hàm** (chưa chạy; chờ 3 dòng):

```sql
SELECT pn.nspname || '.' || p.proname AS fn, p.prosecdef, p.provolatile, p.proconfig,
       md5(p.prosrc) AS body_md5,
       p.proacl IS NOT NULL
         AND (SELECT bool_and(a.grantee = p.proowner) FROM aclexplode(p.proacl) a) AS acl_owner_only,
       has_function_privilege('libetech_ai', p.oid, 'EXECUTE') AS ai_can_execute,
       r.rolsuper AS owner_is_superuser,
       r.rolsuper OR r.rolbypassrls AS owner_exempt_from_rls,
       has_any_column_privilege(p.proowner, 'public.projects', 'UPDATE') AS owner_can_lock_projects,
       position('FOR NO KEY UPDATE' in p.prosrc) > 0 AS locks_project_row,
       position('IF NOT FOUND THEN' in p.prosrc) > 0 AS refuses_unseen_project,
       position('pg_advisory' in p.prosrc) = 0 AS no_advisory_lock
  FROM pg_proc p
  JOIN pg_namespace pn ON pn.oid = p.pronamespace
  JOIN pg_roles r ON r.oid = p.proowner
 WHERE pn.nspname = 'intelligence'
   AND p.proname IN ('ai_drafts_declared_scope_guard', 'ai_drafts_pointer_only_guard', 'project_domain_mappings_draft_lock')
 ORDER BY 1;
```

| `fn` | `prosecdef` | `provolatile` | `proconfig` | `locks_project_row` · `refuses_unseen_project` · `no_advisory_lock` |
|---|---|---|---|---|
| `…ai_drafts_declared_scope_guard` | `f` | `v` | `{"search_path=pg_catalog, pg_temp"}` | `f` · `f` · `t` |
| `…ai_drafts_pointer_only_guard` | `t` | `v` | `{"search_path=pg_catalog, pg_temp",row_security=off,lock_timeout=5s}` | `t` · `t` · `t` |
| `…project_domain_mappings_draft_lock` | `t` | `v` | cùng ba mục như dòng trên | `t` · `t` · `t` |

Cả ba dòng: `acl_owner_only` đúng, `ai_can_execute` sai. Hai hàm definer: `owner_is_superuser`, `owner_exempt_from_rls`, `owner_can_lock_projects` đều đúng. [log] `prosecdef`, `proconfig`, `provolatile` khớp G12 trên PostgreSQL 16. Thân cũ lộ ra ở `prosecdef = f` của hàm khoá, hoặc `no_advisory_lock = f`, hoặc thiếu dòng.

`body_md5` — **người vận hành tự tính và so**: với từng hàm, lấy MD5 của đoạn nằm giữa `AS $$` và `$$;` trong tệp đang áp, không cắt khoảng trắng, xuống dòng kiểu `LF`; giá trị đó phải bằng cột `body_md5`. Để đối chiếu, giá trị tôi tính **từ tệp ở `56d257c`**, không từ CSDL nào: hàm phạm vi `2626b21558df13074c59fae2da13bff1` (không đổi so với `cb1d7dc`), guard `a9927617ae7830df3ab9841e39e54df8`, hàm khoá `3451f68d8e052be10e81f535fc52687c`.

**C — hai policy mà G25 ghim** (chưa chạy; chờ 3 dòng, rồi 1 dòng):

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

- `ai_insert` · `a` · `t` · `{libetech_ai}` · `using_expr` rỗng · `with_check` bằng đúng hằng `AI_INSERT_CHECK` của G25.
- `ai_select` · `r` · `t` · `{libetech_ai}` · `with_check` rỗng · `using_expr` bằng đúng hằng `AI_SELECT_USING` ở `tests/z4-pointer-guard.test.ts:518`.
- `runtime_select` · `r` · `t` · `{libetech_runtime}`.
- Không dòng nào `polpermissive` sai; không dòng thứ tư. Câu thứ hai: `t`, `t`.
- [log] Cả hai chuỗi đã khớp trên PostgreSQL 16 (G25 xanh ở làn native). Vế nào có ở `ai_select` mà không có ở `ai_insert` là độ lệch làm kênh CX1 mở lại.

**D — dưới chính login AI, lúc tạo login** (chưa chạy; login chưa tồn tại):

```sql
SELECT current_user,
       row_security_active('intelligence.ai_drafts') AS bound,                                   -- chờ: t
       has_any_column_privilege(current_user, 'public.projects', 'UPDATE') AS can_lock_projects; -- chờ: f
SHOW default_transaction_isolation;                                                              -- chờ: read committed
SHOW idle_in_transaction_session_timeout;                                                        -- chờ: khác 0
```

**E — ai đang chặn một lệnh ghi ánh xạ hoặc chèn nháp** (chưa chạy; chạy bằng superuser). Câu này cố ý không in chữ của câu lệnh: một lệnh chèn nháp có thể mang nội dung nháp.

```sql
SELECT w.pid AS waiting_pid, w.usename AS waiting_user, w.wait_event, now() - w.query_start AS waiting_for,
       b.pid AS blocker_pid, b.usename AS blocker_user, b.state AS blocker_state,
       b.xact_start AS blocker_xact_start, now() - b.state_change AS blocker_in_state_for
  FROM pg_stat_activity w
  JOIN LATERAL unnest(pg_blocking_pids(w.pid)) AS x(pid) ON true
  JOIN pg_stat_activity b ON b.pid = x.pid
 WHERE w.datname = current_database()
   AND w.wait_event_type = 'Lock' AND w.wait_event IN ('transactionid', 'tuple')
 ORDER BY w.query_start;
```

Lúc yên: không dòng nào. `blocker_state = 'idle in transaction'` là một giao dịch bị bỏ quên: đó là phiên cần kết thúc. `wait_event = 'tuple'` là người đứng sau một người chờ khác. Khoá dòng không hiện trong `pg_locks` khi không ai chờ, nên không có câu nào liệt kê người giữ lúc yên.

**F — role nào tự lấy được khoá, và role nào ghi được hai bảng** (chưa chạy):

```sql
SELECT r.rolname,
       has_any_column_privilege(r.oid, 'public.projects', 'UPDATE') AS can_update,
       has_table_privilege(r.oid, 'public.projects', 'DELETE') AS can_delete,
       has_table_privilege(r.oid, 'public.projects', 'TRUNCATE') AS can_truncate,
       pg_has_role(r.oid, c.relowner, 'USAGE') AS acts_as_owner
  FROM pg_roles r CROSS JOIN pg_class c
 WHERE c.oid = 'public.projects'::regclass AND NOT r.rolsuper AND r.rolname !~ '^pg_'
   AND (has_any_column_privilege(r.oid, 'public.projects', 'UPDATE') OR has_table_privilege(r.oid, 'public.projects', 'DELETE')
        OR has_table_privilege(r.oid, 'public.projects', 'TRUNCATE') OR pg_has_role(r.oid, c.relowner, 'USAGE'));
SELECT r.rolname,
       has_table_privilege(r.oid, 'public.project_domain_mappings', 'INSERT') AS writes_mappings,
       has_any_column_privilege(r.oid, 'intelligence.ai_drafts', 'INSERT') AS writes_drafts
  FROM pg_roles r
 WHERE NOT r.rolsuper AND r.rolname !~ '^pg_'
   AND (has_table_privilege(r.oid, 'public.project_domain_mappings', 'INSERT')
        OR has_any_column_privilege(r.oid, 'intelligence.ai_drafts', 'INSERT'));
```

Câu thứ nhất chờ **không dòng nào**. [log] Phép đo 4: cả mười role `libetech%` nhận `42501` ở cả ba mức khoá. Câu thứ hai chờ đúng một dòng: `libetech_ai` · `f` · `t`. Một dòng lạ ở câu thứ nhất là DB-9 mở lại; một dòng lạ ở câu thứ hai là thêm một bên giữ được dòng dự án qua lệnh chèn.

## 6. ⚠️ Điều không kiểm được

| # | Điều chưa kiểm | Ai kiểm, bằng gì |
|---|---|---|
| ⚠️-1 | Log native không có dòng tiêu đề: phiên bản máy chủ, và việc 022 đã được lùi rồi áp lại trên CSDL thử trước lượt chạy, tôi chỉ biết qua lời phiên chính. G12 xanh ở làn native là bằng chứng gián tiếp rằng thân trong CSDL là thân mới | Chạy câu B trên CSDL thử, ghi `SELECT version()` |
| ⚠️-2 | Phép đo 1 và 3 chạy trên một schema thử mô phỏng hình dạng, không trên hai hàm thật. Hành vi của hai hàm thật có ở G23, G24, G27, N3–N6, Y1, Y2 | Không cần thêm |
| ⚠️-3 | Các hành vi ghi [suy luận]: trần theo từng lần lấy khoá và mức «gần 10 giây»; khe chen hàng; vòng khoá chết mới và việc nó kết thúc bằng `40P01`; dòng lệch tenant không chờ; phép kiểm khoá ngoại không ghi thêm; mức khoá bảng lúc áp | R-4 có thể thành một ca native; phần còn lại đo một lần nếu cần |
| ⚠️-4 | Kế hoạch (`docs/plans/oq-45-46-ai-drafts.md`: X2, R33, R34, R37, điều kiện 18, 20, X5) nằm ngoài diff này: tôi không soát nó đã theo kịp khoá dòng chưa | Phiên chính; Task F4 |
| ⚠️-5 | Câu «022 chưa từng được áp ở đâu ngoài CSDL thử», căn cứ để sửa tại chỗ lần thứ ba dưới cùng số bản | Câu A và B trên từng CSDL |
| ⚠️-6 | Sáu câu ở 5.2 và ba giá trị `body_md5`: chưa chạy | Chạy một lần trên CSDL thử |
| ⚠️-7 | `CREATE OR REPLACE` lật `prosecdef` của một hàm đang có từ sai sang đúng: RB3 gỡ hẳn hàm khoá rồi tạo lại, nên đường «thân khoá tư vấn → tệp thuận» không có ca trong repo. Ngữ nghĩa của động cơ rõ ràng | Mục 1 của 5.1 (lùi rồi áp lại) tránh hẳn đường này |
| ⚠️-8 | Tải thật: một pipeline chèn nhiều nháp cho một dự án, nay chạy lần lượt; bao lâu một lệnh ghi ánh xạ phải chờ | Khi có pipeline |
| ⚠️-9 | `tests/suggestions.test.ts` (ca R12-i) và thân `submitDraft`: ngoài ghế CSDL, tôi không soát | Review mã và bảo mật |

## 7. Thứ đã mở ngoài diff

| Rủi ro nêu tên | Thứ đã kiểm | Kết quả |
|---|---|---|
| Tệp SQL lệch brief; phần «giữ nguyên» bị chạm | so bằng máy với brief và với `cb1d7dc` | Trùng; phần giữ nguyên không đổi |
| Role nào có quyền ghi trên `public.projects` | `migrations/001_foundation.sql:86`, `migrations/016_intake_inbox.sql:255`; tìm lệnh cấp quyền theo cả schema và quyền mặc định trong `migrations/`; phép đo 4 | Chỉ `SELECT`; không lệnh cấp theo schema; mười role đều `42501` |
| Mã nào khác khoá dòng `projects` hoặc ghi nó | tìm `UPDATE projects`, `FOR … UPDATE`, `FOR … SHARE` trong `src`, `scripts`, `deploy`, `migrations`; `migrations/006_bom_allocations.sql:90-102`; `migrations/020_document_review.sql:259-269` | Không nơi nào chạm `projects`: 006 khoá bảng định danh, 020 khoá dòng tài liệu |
| Dịch vụ chèn nhiều nháp trong một giao dịch (vòng khoá chết mới) | tìm `INSERT INTO intelligence.ai_drafts` trong `src` | Một nơi, `src/server/suggestions.ts:157`, một dòng |
| Mã dịch vụ dựa vào `23503`, trường `constraint`, `55P03` | tìm ba chuỗi đó trong `src` | Không; chỉ `LTZ01` được dịch (`src/server/suggestions.ts:25`) |
| Ca hiện có chờ chữ của khoá ngoại | `tests/z4-schema.test.ts:265-267` | Chờ `/foreign key/`; [log] xanh hai làn |
| `rolledBack` có nuốt `AssertionError` không | `tests/slice2-fixtures.ts:80-92` | Không: chỉ lỗi đánh dấu của chính nó được bỏ qua |
| Cột của bảng nháp cho phép NULL ở tenant, dự án | `migrations/021_ai_suggestions_z4.sql:33-36` | Cả hai `NOT NULL` |
| Giá trị đo và số ca | ba log F1b; `measurements-pg16-rowlock.txt` | Như mục 3 |

VERDICT: READY FOR GATE
