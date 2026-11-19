# Review tầng 1 — cả nhánh, phần CSDL (trước khi mở PR)

- **Ngày:** 18/11/2026 · **Vai:** `liberico-database-reviewer`. Đây là **khuyến nghị cho Chairman, không phải phê duyệt**; không sửa mã, không git ghi.
- **Phạm vi:** nhánh `feat/oq-45-46-ai-drafts`, `4f12a3c..f36e947` (commit cuối đổi mã hoặc test: `bcdb360`). Một migration (`migrations/022_ai_drafts_pointer_only_guard.sql`, đã đổi ở `412c8a4`), tệp lùi của nó, ba câu truy vấn mới của dịch vụ và câu `DRAFT_META_SQL`.
- **Căn cứ của PR** — lời Chairman ngày 18/11/2026, chép nguyên: «OQ-45: 1b, 2b, 3b. OQ-46: b, mốc là bản mới nhất nháp nêu».
- **Đã đọc:** tệp bối cảnh tầng 1; gói diff mã của cả nhánh (một lần); kế hoạch bản 0.4 (B4, B5, B6, «Sau các lượt review theo task»); báo cáo CSDL theo task (`review-task-1-2-database.md`, viết cho `9f721f0`); `measurements-pg16.txt`, `fix1a-native-verbose.txt`, `fix1a-red.txt`, `fix1a-green.txt`, `fix1b-green.txt`, `fix1b-native.txt`, `fix1b-mutations.txt`. Tệp ngoài diff chỉ mở để kiểm một rủi ro nêu được tên (bảng ở cuối).
- **Không làm:** không chạy test, không kết nối CSDL nào, không đọc `.env*` hay `.runtime/`. Ba nhãn dùng dưới đây: **[mã]** = đọc từ mã ở `f36e947`; **[log]** = đọc từ log bằng chứng; **[suy luận]** = từ hiểu biết về PostgreSQL 16, chưa có log nào đo.

## Kết luận

| Câu hỏi | Phán quyết |
|---|---|
| Finding CSDL của lượt review theo task | 10 trên 10 **ADDRESSED** |
| Migration 022 bản hiện tại và tệp lùi | Đúng. Phép kiểm mức cô lập đóng được đường đi vòng đã đo; fail-closed ở mọi nhánh tôi xét |
| Ba câu truy vấn mới, `DRAFT_META_SQL` | Đúng phạm vi tenant và dự án; chỉ mục có sẵn đủ; không câu nào là truy vấn phân tích trên Z1 (AR-07 đạt) |
| Quality Gate 34a–34e, M-01…M-07 | Đạt (M-04, M-05, M-07 không áp dụng) |
| Finding mới | P0: 0 · P1: 0 · **P2: 2** · P3: 4. Không finding nào đòi đổi SQL của migration |

Hai mục P2 là một chỗ hở của phép kiểm sau khi áp (hồ sơ) và một ca kiểm có nửa sau không chứng minh điều nó đứng ra chứng minh. Cả hai nên sửa trước khi mở PR; không mục nào là lỗi của guard.

## 1. Finding của lượt review theo task

| Id | Phán quyết | Căn cứ |
|---|---|---|
| DB-I-1 — phục hồi data-only xét lại từng nháp; thứ tự nạp chưa đo | **ADDRESSED** (đúng cách đã đề nghị: đo và ghi, không đổi SQL) | [log] `measurements-pg16.txt:17-23`: dữ liệu `intelligence.ai_drafts` đứng thứ 27, `public.project_domain_mappings` thứ 53 trên 61. Kế hoạch `docs/plans/oq-45-46-ai-drafts.md:778` (phép đo 2), `:791` (R20), `:807` (điều kiện 10). Bổ sung của lượt này: finding N-6 |
| DB-M-6 / SEC-M1 — guard đọc dưới ảnh chụp của giao dịch gọi | **ADDRESSED** | [mã] `migrations/022_ai_drafts_pointer_only_guard.sql:18-23`; ca G16 `tests/z4-pointer-guard.test.ts:246`, G17 `:275`. [log] trước sửa: `measurements-pg16.txt:8-9` («STORED»); G16 đỏ trước sửa `fix1a-red.txt:28-29`; xanh trên PostgreSQL 16 `fix1a-native-verbose.txt:212-213`. Kế hoạch `:784`, `:792` (R21), `:805`. Chỗ còn yếu của G17: finding N-2 |
| DB-M-1 — G8 so tên role dạng in | **ADDRESSED** | [mã] `tests/z4-pointer-guard.test.ts:121-122` so `a.grantee = p.proowner` theo oid, đòi đúng `[{is_owner:true}]`. `proacl` NULL cho mảng rỗng, quyền của `PUBLIC` cho thêm một dòng `false`: cả hai đều đỏ |
| DB-M-2 / SEC-M3 — RB1 nuốt lỗi áp lại | **ADDRESSED** | [mã] `tests/migrations-rollback.test.ts:466` không còn `.catch` |
| DB-M-3 — chưa có ca chạy lại tệp lùi 022 khi schema đã mất | **ADDRESSED** | [mã] RB2 `tests/migrations-rollback.test.ts:472-493`. [log] `measurements-pg16.txt:11-14`; `fix1a-native-verbose.txt:222` |
| DB-M-4 — danh sách «trước khi bật Z4» thiếu chủ hàm và ACL | **ADDRESSED** | Kế hoạch `:804` (điều kiện 7). Sau đợt sửa, chính điều kiện này lại thiếu thân hàm: finding N-1 |
| DB-M-5 — chú thích «The one place that reads it» | **ADDRESSED** | [mã] `src/server/source-text.ts:17` nêu tên hàm của 022 và «the two must change together» |
| SEC-M4 — không có ca `MERGE` | **ADDRESSED** | [mã] G18 `tests/z4-pointer-guard.test.ts:292-305`, có đối chứng lưu được. [log] `fix1a-native-verbose.txt:214` |
| SEC-M6 — thân hàm definer không được ghim | **ADDRESSED** | [mã] G12 `tests/z4-pointer-guard.test.ts:196-198`: bảy đoạn của `pg_get_functiondef`, gồm phép so mức cô lập và `LTZ02`. [log] đỏ trước sửa `fix1a-red.txt:12-16` |

Hai mục «chỉ ghi phần dư» có bản chất CSDL: SEC-M2 (R22, `AccessShareLock`) và W3 (R23, tham số trong log máy chủ). Tôi đồng ý để nguyên phán quyết: cả hai đúng về động cơ và không có sửa nào ở tầng SQL tốt hơn việc ghi lại.

## 2. Migration 022 bản hiện tại

### Phép kiểm mức cô lập (`:21-23`)

| Điểm xét | Kết quả |
|---|---|
| Giá trị so | [log] `'read committed'` đúng là chuỗi PostgreSQL 16.15 trả cho giao dịch mặc định: đối chứng cuối G16 và mọi ca G khác xanh (`fix1a-native-verbose.txt:197-214`) |
| `read uncommitted` | [suy luận] PostgreSQL chạy mức này y như READ COMMITTED nhưng `transaction_isolation` vẫn in `read uncommitted`, nên guard từ chối bằng `LTZ02`. Hướng đóng, chấp nhận được; chưa ca nào ghim (N-3) |
| `SET TRANSACTION` sau câu lệnh đầu | [suy luận] PostgreSQL từ chối đổi mức sau khi giao dịch đã có ảnh chụp (lỗi 25001), nên giá trị hàm đọc luôn là mức thật của ảnh chụp đang dùng. Đổi mức **trước** câu lệnh đầu thì giao dịch là READ COMMITTED thật |
| Giao dịch con | [suy luận] `SAVEPOINT` và khối `EXCEPTION` thừa hưởng mức của giao dịch ngoài; không đổi được mức trong giao dịch con. `LTZ02` ném trong savepoint chỉ lùi về savepoint, không dòng nào được ghi |
| Hàm `SECURITY DEFINER` đọc thiết lập của ai | [suy luận, có log đỡ] Mức cô lập là thuộc tính của giao dịch, không phải của role; `SECURITY DEFINER` chỉ đổi `current_user` và hai thiết lập ghim trên hàm. G16 đặt mức ở phiên gọi rồi `SET LOCAL ROLE libetech_ai`, và hàm thấy đúng mức đó (`fix1a-native-verbose.txt:212`) |
| Ảnh chụp của câu đọc trong hàm | [suy luận] Hàm trigger là `VOLATILE` (mặc định), nên ở READ COMMITTED mỗi câu SQL trong thân hàm lấy ảnh chụp mới tại lúc trigger chạy, mới hơn cả ảnh chụp của lệnh `INSERT`. Lệnh chèn chạy lâu (`INSERT … SELECT`) vì vậy không mở lại đường đi vòng. Cửa sổ còn lại đúng như R21 ghi: từ câu đọc của guard tới lúc commit |
| `search_path` đã ghim | [mã] `pg_catalog.current_setting` viết đủ schema; toán tử `<>` giải trong `pg_catalog`; `pg_temp` đứng cuối. Guard chạy đúng cả dưới `search_path` rỗng mà `pg_restore` đặt [suy luận] |
| `row_security = off` | [mã, log] Phép kiểm mức cô lập đứng trước câu đọc. Chủ hàm bị RLS lọc: giao dịch READ COMMITTED nhận lỗi RLS của bảng ánh xạ (G11, `fix1a-native-verbose.txt:207`), giao dịch mức khác nhận `LTZ02`. Cả hai đều từ chối |
| Giá trị NULL làm bỏ qua nhánh `IF` | Không xảy ra: thiết lập có sẵn của động cơ luôn có giá trị |
| Lộ thêm thông tin | Không: `LTZ02` được trả trước khi đọc ánh xạ, câu lỗi là hằng, không id |

### Ảnh hưởng tới các đường khác

- **`pg_dump`** chạy REPEATABLE READ nhưng chỉ đọc: không chèn, không chạm guard [suy luận].
- **`pg_restore`** không tự đặt mức cô lập; `--single-transaction` mở một giao dịch ở mức mặc định của phiên [suy luận]. Hai đường cài đặt của repo (`deploy/install-d1.sh:43`, `deploy/install-user.py:161`) không đặt gì thêm [mã], nên trên cụm mặc định guard cho qua phép kiểm mức, rồi theo phép đo thứ tự nạp thì không thấy ánh xạ nào và cho mọi dòng qua. Điều mới sau đợt sửa: nếu CSDL hoặc login phục hồi mang `default_transaction_isolation` khác `read committed`, dòng nháp đầu tiên bị `LTZ02` và cả lần phục hồi lùi (N-6).
- **`COPY`** [log] `measurements-pg16.txt:15-16`: role AI nhận `0A000`, login vận hành nhận `LTZ01`. Guard chạy cho `COPY`.
- **`scripts/migrate.ts`**: 022 không chèn dòng nháp nào, mức cô lập của phiên migrate không liên quan. Vấn đề của trình áp là ở chỗ khác: N-1.
- **Đường ghi nháp khác trong mã:** [mã] một nơi duy nhất, `src/server/suggestions.ts:157`, qua `aiScoped` (`src/server/ai-scope.ts:14-15`) mở bằng `BEGIN` trần (`src/server/db.ts:44`). Mức cô lập là mặc định của login hoặc CSDL (N-5). Không tệp nào trong `scripts/`, `deploy/` ghi bảng này.
- **Bản demo PGlite** chạy lại mọi tệp migration mỗi lần khởi động (`src/server/db.ts:11`): luôn mang thân hàm mới.

### Idempotent, khoá, tệp lùi, mã lỗi

- **Áp lại khi hàm cũ đã có** [suy luận; không ca nào và không log nào đi đúng đường «thân cũ → `CREATE OR REPLACE`»]: thân hàm và hai thiết lập được thay; chủ hàm và ACL giữ nguyên; `REVOKE` lặp lại không đổi gì; trigger được gỡ và tạo lại trong cùng giao dịch, `tgenabled` về `'O'`. G12 chạy tệp hai lần trên thân mới và hình dạng không đổi ([log] `fix1a-native-verbose.txt:208`).
- **Khoá lúc áp** [suy luận, không đổi so với báo cáo trước]: `CREATE OR REPLACE FUNCTION` không khoá bảng. Lần áp đầu: `CREATE TRIGGER` giữ `SHARE ROW EXCLUSIVE` trên `intelligence.ai_drafts` tới `COMMIT`. Áp lại và tệp lùi: `DROP TRIGGER` giữ `ACCESS EXCLUSIVE`. `lock_timeout` 5 giây. Không viết lại bảng, không dựng chỉ mục.
- **Tệp lùi** [mã] gỡ hàm theo chữ ký `intelligence.ai_drafts_pointer_only_guard()`; chữ ký không đổi nên tệp vẫn đúng với hàm mới. [log] RB1, RB2 xanh trên PostgreSQL 16 (`fix1a-native-verbose.txt:221-222`). Lùi 022 nay gỡ cả phép từ chối `LTZ02`.
- **`LTZ02`** [mã, đã tìm trong `src`, `migrations`, `scripts`, `deploy`, `tests`]: chỉ có ở `migrations/022…sql:22` và ca G12, G16, G17. Mã tự đặt khác của repo là `LTR01`–`LTR03` (`migrations/020_document_review.sql`) và `LTZ01`. Không trùng. Dịch vụ cố ý không dịch `LTZ02` (kế hoạch `:784`).
- **Khối SQL trong kế hoạch** trùng từng byte với hai tệp ở `f36e947` (đã so bằng máy).

## 3. Ba câu truy vấn mới và `DRAFT_META_SQL`

Mọi nhận xét về kế hoạch thực thi dưới đây là **[suy luận]**: chưa có `EXPLAIN` nào trên PostgreSQL 16 (điều kiện 13 của kế hoạch, `:810`).

| Câu | Phạm vi | Chỉ mục phục vụ | Logic ba trị và mảng rỗng | Chi phí dự kiến |
|---|---|---|---|---|
| `DOC_SUBJECT_SQL` `src/server/suggestions.ts:109-111` | `project_id=$1` và `document_id=$2` trong câu lệnh; tenant do RLS (mã dự án là khoá chính toàn cục, khoá ngoại `(project_id,tenant_id)` buộc cặp) | `UNIQUE(document_id,revision_no)` `migrations/014_document_registry.sql:42` | Tổng hợp không `GROUP BY` luôn trả đúng một dòng. Mảng rỗng hoặc không khớp: `named = 0` → giữ `SUBJECT_BASELINE_MISSING`. Phần tử NULL trong mảng cũng về `0`: đóng | Một lần quét dải chỉ mục qua các bản của **một** tài liệu. Tối ưu min/max không áp được vì có `FILTER`; không đáng kể. Số mã bị chặn bởi trần 49 152 byte của giá trị |
| `threadHasHiddenText` `src/server/source-text.ts:88-92` | `c`, `e`, `r` đều có `project_id=$1`; tenant do RLS | `c`: khoá chính. `e`: `idx_source_events_thread(tenant_id,chat_id,thread_key)` `migrations/016_intake_inbox.sql:122`, cột đầu lấy từ điều kiện RLS. `r`: `UNIQUE(source_event_id,revision_no)` `:76` | `IS NOT TRUE` đúng: danh sách rỗng, `[null]`, `[null, nhóm khác]` đều cho «đang ẩn» (Q8). Không có dòng trả về → `true` (`:93`) | `EXISTS` dừng ở dòng khớp đầu. Trường hợp xấu nhất là trường hợp thường gặp (không có gì ẩn): quét hết bản sửa của luồng, mỗi dòng lưu chữ thêm một lần dò chỉ mục ánh xạ. Tuyến tính theo cỡ luồng, không trần theo thiết kế (Q5 ii) |
| `threadFreshness` `src/server/source-text.ts:112-120` | `thread` lọc `c.project_id`, `e.project_id`; `later_edit` thêm `r.project_id`; tenant do RLS (chú thích `:103-105`; T8, T12) | như trên | Không mốc: `max` trên tập rỗng là NULL, `has_baseline` là `false`, hai phép `>=` với NULL không chọn dòng nào, bên gọi giữ nháp (`src/server/suggestions.ts:122`). `NOT (… = ANY($3))` chỉ đúng khi mảng không có NULL: hiện do bộ lọc ở `:110` bảo đảm (N-4) | `thread` và `base` được dùng ba lần nên được vật chất hoá một lần; luồng chỉ bị đọc một lần cho cả ba kết quả |
| `DRAFT_META_SQL` `src/server/suggestions.ts:91-92` | Mệnh đề `WHERE` có sẵn, không đổi; chỉ mục `idx_ai_drafts_entity` `migrations/021_ai_suggestions_z4.sql:82` | — | Khoá không có trong `$6` → `->>` trả NULL → phép so là NULL → `CASE` không `ELSE` trả NULL: đóng. `NULL::text`, `NULL::jsonb` giữ hình dạng dòng; không cột nội dung nào rời CSDL | Không đổi so với câu cũ |

- **Trần 10 giây mỗi câu lệnh** (`src/server/db.ts:32`): mỗi câu trên là một câu lệnh. Hết giờ thì lỗi đi lên, `list` không trả gì và `decide` lùi cả giao dịch: đóng. Câu đọc trong trigger tính vào 10 giây của lệnh `INSERT`.
- **Không N+1:** `present` gọi `threadHasHiddenText` một lần cho mỗi đối tượng (`src/server/suggestions.ts:212`). Một lệnh xác nhận gọi nó hai lần (`:298` rồi `:212`); thừa một câu lệnh, không sai.
- **Không cần chỉ mục mới.** Điều cần xem ở lần `EXPLAIN` của điều kiện 13: `Index Scan` trên `idx_source_events_thread` với cả ba cột trong `Index Cond`, không phải quét theo `idx_source_events_project_fk` rồi lọc; phép nối sang bảng bản sửa đi qua chỉ mục theo `source_event_id`.
- **AR-07 / E-DB-10:** cả bốn câu là đọc nghiệp vụ của chính dịch vụ trên một ứng viên, một luồng hoặc một tài liệu, để quyết che hay giữ một nháp. Không câu nào tổng hợp qua nhiều đối tượng cho báo cáo. Đạt.
- **AR-03 / E-AI-04:** không `GRANT` nào; role AI vẫn chỉ ghi Z4. Dịch vụ đọc Z4 và Z1 của chính platform.

## 4. Ca kiểm ở tầng CSDL và Quality Gate

**G1–G15:** so với `9f721f0` chỉ G8 và G12 đổi (đã so bằng `git diff`); phán quyết của báo cáo trước giữ nguyên. [log] cả 18 ca G xanh trên PostgreSQL 16 (`fix1a-native-verbose.txt:197-214`).

| Ca | Có khẳng định điều tên ca nói không |
|---|---|
| G16 `:246` | Có, trừ chữ «whatever the project»: chỉ thử một dự án chưa ánh xạ (N-3) |
| G17 `:275` | **Nửa đầu có, nửa sau không** (N-2) |
| G18 `:292` | Có |
| RB1 `:396` | Có |
| RB2 `:472` | Có, gián tiếp: ca khẳng định bảng không còn, không khẳng định schema không còn. Tệp lùi 021 gỡ schema không `CASCADE` (`migrations/rollback/021_ai_suggestions_z4.sql:24`) nên nó chạy xong thì schema đã mất |
| Q5 (bốn ca) `tests/source-text.test.ts:144-192` | Có khi đọc cả nhóm. Ca đầu mang chữ «the caller's scope» trong tên nhưng phần phạm vi nằm ở ca thứ hai (`:162`). Q5 (ii) chắc chắn: `observedAt` của tin mẫu tăng dần, nên một trần 20 tin mới nhất luôn loại tin gốc |
| Q6 `:194`, Q8 `:206` | Có |
| Q7 | Không phải ca tầng CSDL: là ca đối chứng ở `tests/suggestions.test.ts` («a document draft is not touched by the placeholder») |
| T6–T14 `tests/source-text.test.ts:230-325` | Có. T9, T10, T11, T12, T14 có đột biến đỏ vì `AssertionError` ([log] `fix1b-mutations.txt`). Phép `>=` của `later_edit` (`src/server/source-text.ts:120`) chưa có ca trùng thời điểm; T11 chỉ phủ `newer_message` (N-4) |

| Quality Gate | Kết quả | Căn cứ |
|---|---|---|
| 34a đọc | Đạt | Guard: G4 (điều kiện tenant tường minh, vì hàm chạy ngoài RLS). Câu truy vấn: Q5 `:162` và T8, mỗi ca có đối chứng dương |
| 34b ghi | Đạt | G4: dòng nêu tenant khác bị `WITH CHECK` từ chối, không lưu |
| 34c xoá, sửa | Đạt | G10 |
| 34d không ngữ cảnh | Đạt | G7 |
| 34e bypass | Đạt | G8 (role AI không gọi được hàm definer nào), G6 (login vận hành cũng bị guard buộc), G11 (chủ hàm bị RLS lọc thì đóng); login runtime bị từ chối nếu là superuser hoặc `BYPASSRLS` (`src/server/db.ts:63-64`) |
| M-01 | Đạt | 022 nối tiếp 021. Tệp được sửa tại chỗ dưới cùng số bản: N-1 |
| M-02 | Đạt | `CREATE OR REPLACE`, `DROP TRIGGER IF EXISTS`, `ON CONFLICT DO NOTHING`; G12 |
| M-03 | Đạt | Tệp lùi cùng tên; RB1, RB2 |
| M-04, M-05, M-07 | Không áp dụng | Không cột, không bảng, không đổi tên |
| M-06 | Đạt | Không viết lại bảng; khoá ngắn, có `lock_timeout` |

## 5. Finding mới

| # | Mức | Tệp:dòng | Kịch bản | Sửa thế nào |
|---|---|---|---|---|
| N-1 | **P2** | `docs/plans/oq-45-46-ai-drafts.md:804`, `:754` · `docs/reviews/oq-45-46-evidence-20261118/gates/review-task-1-2-database.md:110-120` · `scripts/migrate.ts:14` · `tests/slice1-db.ts:35` | Tệp 022 được sửa tại chỗ ở `412c8a4`, vẫn dưới số bản `'022'`. Trình áp và harness native đều bỏ qua bản đã ghi, và `schema_migrations` không giữ mã băm. Một CSDL đã ghi `'022'` từ `564712f`…`5013f75` giữ thân hàm cũ, không có `LTZ02`, tức còn nguyên đường đi vòng đã đo (`measurements-pg16.txt:8-9`). Phép kiểm sau khi áp mà điều kiện 7 trỏ tới chỉ xem chủ hàm, ACL, `tgenabled`, `tgtype`, hai thiết lập: thân cũ qua hết. Điều kiện 2 (pipeline tự kiểm lúc khởi động) cũng không kể thân hàm. Trên CSDL thử thì ca G12 bắt được; ngoài CSDL thử không gì bắt. Log `fix1a-native-verbose.txt:1` cho thấy phiên chính đã phải lùi 022 bằng tay trước khi chạy [log]. Kế hoạch ghi 022 chưa áp ở đâu ngoài CSDL thử; tôi không kiểm được | Không đổi SQL. (a) Dùng câu catalog ở mục 6 dưới đây thay cho câu cũ; nó kiểm thêm thân hàm. (b) Sửa điều kiện 7 và điều kiện 2 của kế hoạch để kể «thân hàm có phép kiểm mức cô lập và `LTZ02`». (c) Ghi vào biên nhận: CSDL nào đã ghi `'022'` trước `412c8a4` thì lùi 022 rồi áp lại, hoặc chạy tay tệp thuận |
| N-2 | **P2** | `tests/z4-pointer-guard.test.ts:275-290` (G17) | Lần thử đầu (REPEATABLE READ) ghi ánh xạ `IBS_HI` bản 1 qua một kết nối khác; dòng đó được commit và không lùi theo giao dịch bị từ chối. Khi giao dịch thứ hai (READ COMMITTED) mở, dự án **đã** là `IBS_HI`. `LTZ01` ở `:288` vì vậy không chứng minh «giao dịch READ COMMITTED mở trước khi ánh xạ được commit vẫn thấy ánh xạ đó»: nó chỉ lặp lại G1. Tính chất này là chỗ dựa của R21 và hiện chỉ có một lần đo ngoài bộ ca (`measurements-pg16.txt:10`) | Cho lần thử READ COMMITTED một dự án chưa là `IBS_HI` lúc giao dịch mở: dùng `ids.sales` cho lần thử đó, hoặc commit một dòng `XECA` bản 2 giữa hai lần thử rồi dòng `IBS_HI` bản 3 trong giao dịch. Chỉ đổi ca, không đổi mã |
| N-3 | P3 | `migrations/022_ai_drafts_pointer_only_guard.sql:21-22` · `tests/z4-pointer-guard.test.ts:246-273` | (a) Giao dịch READ UNCOMMITTED bị từ chối `LTZ02` dù động cơ chạy nó như READ COMMITTED; câu lỗi nói «READ COMMITTED» nên người vận hành dễ hiểu nhầm. Chưa ca nào ghim. (b) G16 mang chữ «whatever the project» nhưng chỉ thử dự án chưa ánh xạ; đổi thứ tự hai phép kiểm trong hàm không làm ca nào đỏ | (a) Thêm `'READ UNCOMMITTED'` vào vòng lặp của G16; ghi vào ghi chú triển khai rằng mặc định của login phải đúng là `read committed`. (b) Thêm một lần thử ở REPEATABLE READ cho dự án đã ánh xạ `IBS_HI`, chờ `LTZ02` |
| N-4 | P3 | `src/server/source-text.ts:118`, `:120` | (a) `NOT (t.id = ANY($3::uuid[]))` thành NULL cho mọi tin không được nêu nếu mảng có một phần tử NULL; `newer_message` khi đó là `false`, tức hướng mở. Hôm nay không tới được: `:110` chỉ để lại chuỗi uuid chữ thường. Câu lệnh cùng tệp ở `:92` đã theo kỷ luật `IS NOT TRUE` cho đúng loại rủi ro này. (b) Phép `>=` của `later_edit` chưa có ca trùng thời điểm | (a) Viết `(t.id = ANY($3::uuid[])) IS NOT TRUE` để tính đóng nằm trong SQL. (b) Một ca như T11 cho bản sửa. Cả hai có thể để lượt sau |
| N-5 | P3 | `src/server/ai-scope.ts:14-15` · `src/server/db.ts:44` · đối chiếu `src/server/identity.ts:22-25` | `aiScoped` và `scoped` mở bằng `BEGIN` trần và thừa hưởng mức cô lập của login. `IdentityService.scope` đã ghim mức ngay trong mã với đúng lý do này. Với `aiScoped`: login pipeline cấu hình sai thì mọi lệnh ghi nháp bị `LTZ02` (đóng, nhưng là lỗi CSDL thô). Với `scoped`: thứ tự xếp hàng của `decide` trên khoá dòng tài liệu dựa vào READ COMMITTED; ở REPEATABLE READ lệnh xác nhận đến sau nhận lỗi tuần tự hoá thay cho `SUBJECT_CHANGED` [suy luận] | Không sửa trong PR này (`src/server/ai-scope.ts` nằm ngoài phạm vi được chạm). Thêm vào điều kiện 8: khi bật Z4, ghim `SET TRANSACTION ISOLATION LEVEL READ COMMITTED` làm câu lệnh đầu của `aiScoped` như `identity.ts:25`, guard giữ vai lưới; và giữ login runtime ở `read committed` |
| N-6 | P3 | `docs/plans/oq-45-46-ai-drafts.md:791` (R20), `:807` · `deploy/install-d1.sh:43` · `deploy/install-user.py:161` | R20 chưa nói hai điều sau đợt sửa: (a) phiên phục hồi phải ở READ COMMITTED, nếu không dòng nháp đầu tiên bị `LTZ02` và, với `--exit-on-error --single-transaction`, cả lần phục hồi lùi; (b) phục hồi song song (`pg_restore -j`) làm thứ tự nạp không còn xác định, nên phép đo thứ tự không còn áp dụng [suy luận] | Thêm hai câu vào R20 và điều kiện 10 |

## 6. Ghi chú triển khai cho biên nhận (bản cập nhật)

| # | Mục | So với báo cáo trước |
|---|---|---|
| 1 | **Thứ tự áp.** Sau 021; migration trước, mã sau. CSDL đã ghi `'022'` trước `412c8a4` không được trình áp áp lại: lùi 022 rồi áp lại, hoặc chạy tay tệp thuận | **Đổi** (N-1) |
| 2 | **Ai áp, và câu catalog sau khi áp.** Login migration là superuser. Chạy câu dưới đây, chép kết quả vào biên nhận | **Đổi**: thêm bốn cột về thân hàm và `provolatile` |
| 3 | **Khoá.** `CREATE OR REPLACE FUNCTION` không khoá bảng. Lần đầu: `SHARE ROW EXCLUSIVE` trên `intelligence.ai_drafts`. Áp lại và lùi: `ACCESS EXCLUSIVE`. `lock_timeout` 5 giây | Không đổi |
| 4 | **`lock_timeout` nổ dưới `scripts/migrate.ts`.** Lỗi hiện ra có thể là «current transaction is aborted» của khối `finally` (`scripts/migrate.ts:18`); nguyên nhân thật là lỗi đầu tiên | Không đổi |
| 5 | **Một chiều hay không.** Lùi được, không biến đổi dữ liệu. Lùi nay gỡ cả phép từ chối `LTZ02`. Không chạy trên CSDL thật khi chưa có lời Chairman. Thứ tự lùi: 022 rồi 021 | Đổi nhẹ |
| 6 | **Dữ liệu có sẵn.** 022 không rà dòng cũ (R2, OQ-54) | Không đổi |
| 7 | **Guard vắng mà không ai biết** (R19): `DISABLE TRIGGER`, `session_replication_role = replica`, `pg_restore --disable-triggers`. Thêm một dạng: guard còn đó nhưng mang thân cũ | **Đổi** (N-1) |
| 8 | **Phục hồi data-only.** Đã đo: nháp nạp trước ánh xạ (27 so với 53 trên 61), guard cho mọi dòng qua. Lần phục hồi không lùi vì một nháp cũ, và guard không phải lưới cho dữ liệu phục hồi. Phiên phục hồi phải ở READ COMMITTED. Không dùng `-j`. Đo lại trên bản dump của CSDL thật | **Đổi**: từ «chưa đo» sang đã đo; hai điều kiện mới (N-6) |
| 9 | **Mức cô lập của login pipeline.** Nay do guard thực thi: khác `read committed` thì mọi lệnh ghi nháp bị `LTZ02`. Kiểm lúc tạo login bằng câu thứ hai dưới đây. `read uncommitted` cũng bị từ chối. Chuỗi kết nối của pipeline không được mang `options=-c default_transaction_isolation=…` | **Đổi** |
| 10 | **Log máy chủ.** Mỗi `LTZ01` và mỗi `LTZ02` là một dòng `ERROR`. Khi login pipeline cấu hình sai, **mọi** lệnh ghi nháp thành một dòng `ERROR`; nếu `log_parameter_max_length_on_error` khác 0 thì nội dung của mọi nháp, không riêng nháp `IBS_HI`, nằm lại trong log | **Đổi**: phạm vi của R23 rộng hơn |
| 11 | **Chi phí.** Một lần đọc thiết lập và một lần dò chỉ mục cho mỗi dòng chèn. Không cần chỉ mục mới | Không đổi |
| 12 | **Login runtime** giữ `read committed` (N-5) | Mới |
| 13 | **`EXPLAIN`** của điều kiện 13: xem mục 3 để biết cần thấy gì | Mới |

Câu catalog sau khi áp (chỉ đọc):

```sql
SELECT t.tgenabled, t.tgtype, pg_get_triggerdef(t.oid) AS def,
       p.prosecdef, p.provolatile, p.proconfig, p.proacl::text AS acl,
       r.rolname AS owner, r.rolsuper, r.rolbypassrls,
       strpos(p.prosrc, $q$current_setting('transaction_isolation') <> 'read committed'$q$) > 0 AS has_isolation_check,
       strpos(p.prosrc, $q$ERRCODE = 'LTZ02'$q$) > 0 AS has_ltz02,
       strpos(p.prosrc, $q$ERRCODE = 'LTZ01'$q$) > 0 AS has_ltz01,
       strpos(p.prosrc, 'transaction_isolation') < strpos(p.prosrc, 'FROM public.project_domain_mappings') AS isolation_first
  FROM pg_trigger t
  JOIN pg_proc p ON p.oid = t.tgfoid
  JOIN pg_roles r ON r.oid = p.proowner
 WHERE t.tgrelid = 'intelligence.ai_drafts'::regclass
   AND t.tgname = 'ai_drafts_pointer_only_guard' AND NOT t.tgisinternal;
```

Chờ: đúng một dòng; `tgenabled='O'`; `tgtype=7`; `prosecdef` đúng; `provolatile='v'`; `proconfig` có `search_path=pg_catalog, pg_temp` và `row_security=off`; `acl` chỉ có chủ; `rolsuper` hoặc `rolbypassrls` đúng; bốn cột cuối đều đúng. Câu này tôi viết từ việc đọc tệp, **chưa chạy**: chạy một lần trên CSDL thử trước khi chép vào biên nhận.

Mức cô lập mặc định, kiểm lúc tạo login pipeline (chỉ đọc):

```sql
SHOW default_transaction_isolation;   -- chạy bằng chính login đó; chờ: read committed
SELECT coalesce(d.datname,'*') AS db, coalesce(r.rolname,'*') AS role, c AS setting
  FROM pg_db_role_setting s
  LEFT JOIN pg_database d ON d.oid = s.setdatabase
  LEFT JOIN pg_roles r ON r.oid = s.setrole
  CROSS JOIN LATERAL unnest(s.setconfig) c
 WHERE split_part(c,'=',1) = 'default_transaction_isolation';
```

Chờ: không dòng nào, hoặc chỉ giá trị `read committed`.

## 7. ⚠️ Điều không kiểm được

| # | Điều chưa kiểm | Ai kiểm, bằng gì |
|---|---|---|
| ⚠️-1 | Lượt cả bộ, typecheck, build, coverage ở `f36e947` đang chạy lúc tôi review. Log mới nhất tôi có là `fix1b-native.txt` (8 tệp, 255 ca, 0 bỏ qua) và `fix1a-native-verbose.txt` (6 tệp, 218 ca). Phán quyết dưới đây giả định lượt cuối xanh trên cả hai làn, nhất là G12, G16, G17 | Phiên chính |
| ⚠️-2 | Trạng thái thật của mọi CSDL: thân hàm nào đang nằm ở đâu, chủ hàm, ACL; và câu «022 chưa áp ở đâu ngoài CSDL thử» | Câu catalog ở mục 6 |
| ⚠️-3 | Kế hoạch thực thi của ba câu truy vấn trên luồng dài và tài liệu nhiều bản | `EXPLAIN` của điều kiện 13 |
| ⚠️-4 | Các hành vi động cơ tôi ghi [suy luận]: chuỗi `read uncommitted` và việc nó bị từ chối; `SET TRANSACTION` sau câu lệnh đầu và trong giao dịch con; ảnh chụp mới cho từng câu trong hàm `VOLATILE`; `pg_restore` không đặt mức cô lập; mức khoá của `DROP TRIGGER` và `CREATE TRIGGER`; `CREATE OR REPLACE` đè lên thân cũ; lỗi tuần tự hoá của `decide` ở REPEATABLE READ; phục hồi song song | Sửa G16 theo N-3 và G17 theo N-2 đo được hai mục đầu và mục thứ ba; phần còn lại đo một lần ở làn native nếu cần |
| ⚠️-5 | Thứ tự nạp mới đo trên CSDL thử tổng hợp | Điều kiện 10 |
| ⚠️-6 | Tên từng ca Q5–Q8 và T6–T14 trên PostgreSQL 16: `fix1b-native.txt` chỉ có tổng số | Lượt cuối với reporter verbose |
| ⚠️-7 | Bốn thiết lập log của cụm; mặc định mức cô lập của login pipeline (login chưa tồn tại) | Điều kiện 8, 9 |

## 8. Thứ đã mở ngoài diff

| Rủi ro nêu tên | Thứ đã kiểm | Kết quả |
|---|---|---|
| `LTZ02` trùng mã khác | tìm `LT[A-Z][0-9]{2}` trong `src`, `migrations`, `scripts`, `deploy`, `tests` | Không trùng |
| Nơi khác đặt mức cô lập hoặc ghi nháp ở mức khác | tìm `transaction_isolation`, `ISOLATION LEVEL`, `default_transaction`; tìm `ai_drafts` trong `src`, `scripts`, `deploy` | Chỉ `src/server/identity.ts:25` (ghim READ COMMITTED) và một ca của `tests/doc-approval-isolation.test.ts`; một nơi ghi nháp |
| Trình áp bỏ qua tệp đã sửa | `scripts/migrate.ts`, `tests/slice1-db.ts:29-37`, `src/server/db.ts:9-13` | N-1 |
| Câu truy vấn mới thiếu chỉ mục | `migrations/014_document_registry.sql:29-42`, `:73`; `migrations/016_intake_inbox.sql:44-135`; `migrations/013_project_registry.sql:26-35` | Đủ |
| Câu truy vấn mới lọt tenant khi không có điều kiện tenant | policy `runtime_select` của ba bảng `migrations/016_intake_inbox.sql:162-205`; khoá ngoại `(project_id,tenant_id)` | RLS và khoá ngoại buộc cặp; T8, T12, Q5 |
| Đường phục hồi đặt mức cô lập hoặc chạy song song | `deploy/install-d1.sh:43`, `deploy/install-user.py:159-161`, `docs/DEPLOY-002.md:19` | Không đặt; một giao dịch, không `-j` |
| G17 dùng hai kết nối thật | `tests/slice3-fixtures.ts:19-21`, `tests/slice1-db.ts:27` | Có; chính vì vậy ánh xạ bản 1 không lùi (N-2) |
| Q5 (ii) phụ thuộc may rủi | `tests/slice2-fixtures.ts:37-44` | Không: `observedAt` tăng dần |
| RB2 có thật sự mất schema | `migrations/rollback/021_ai_suggestions_z4.sql:21-24` | Có |
| Khối SQL trong kế hoạch lệch tệp | so bằng máy ba khối `sql` của kế hoạch với hai tệp | Trùng từng byte |
| Bản sao iCloud trong `migrations/` | đếm tệp tên có ` 2` | 0 |

VERDICT: READY FOR GATE
