# Review theo task — Task 1 và Task 2 (phần CSDL)

- **Ngày:** 18/11/2026 · **Vai:** `liberico-database-reviewer` (chỉ khuyến nghị; không duyệt, không sửa mã).
- **Phạm vi:** `7b96dc0..9f721f0` (hai commit `564712f`, `9f721f0`) của PR OQ-45/OQ-46. Đây là review theo task, không phải review trước khi merge. HEAD của nhánh đã đi tiếp sau `9f721f0`; báo cáo này không phủ phần đó.
- **Căn cứ của PR** — lời Chairman ngày 18/11/2026, chép nguyên: «OQ-45: 1b, 2b, 3b. OQ-46: b, mốc là bản mới nhất nháp nêu». Task 1–2 là điểm 3 (b) của OQ-45; chữ của mục OQ (không phải lời Chairman): «từ chối ngay lúc ghi» (`docs/OPEN-QUESTIONS.md:669`, `:859`).
- **Cách làm:** đọc gói diff `review-7b96dc0..9f721f0.diff` một lần, hai brief, ba đoạn của kế hoạch (`docs/plans/oq-45-46-ai-drafts.md:179-203`, `:237-270`, `:304-331`), hai báo cáo và bốn log của builder. Mã ngoài diff chỉ mở để kiểm một rủi ro nêu được tên (bảng ở cuối). `src/server/suggestions.ts` và `tests/suggestions.test.ts` chỉ đọc qua diff và `git show 9f721f0:`, không đọc từ đĩa.
- **Không làm:** không chạy test, không kết nối CSDL nào, không git ghi, không đọc `.env*` hay `.runtime/`. Mọi câu về hành vi của PostgreSQL 16 dưới đây là **suy luận** từ hiểu biết về động cơ, trừ khi ghi «đọc từ mã».

## Phán quyết

| Câu hỏi | Phán quyết |
|---|---|
| Đúng yêu cầu của hai brief | ✅ Đúng. Không thiếu, không thừa có nghĩa, không hiểu sai. |
| Chất lượng phần CSDL | Đạt. 0 Critical · 1 Important · 6 Minor. Mục Important là nghĩa vụ của ghi chú triển khai và của danh sách «trước khi bật Z4», không đòi sửa mã của Task 1–2. |

## 1. Đúng yêu cầu

**Hai tệp SQL** trùng từng byte với hai khối SQL của kế hoạch (đã so bằng `diff` giữa blob ở `9f721f0` và khối trích từ tệp kế hoạch). `git diff 4f12a3c 9f721f0 -- tests/z4-schema.test.ts` chạm đúng một dòng. Không đường dẫn bị cấm nào (`AGENTS.md`, `CLAUDE.md`, `migrations/001`–`021`, `migrations/rollback/013`–`021`, `src/app`, `src/components`, `src/server/ai-scope.ts`, `skill-context.ts`, `skills.ts`) có trong diff.

**Đối chiếu từng ca với mã test** (đọc từ mã; «giết đột biến» = ca sẽ đỏ nếu hàm sai theo cách nêu):

| Ca | Khẳng định có thật không | Ghi chú |
|---|---|---|
| G1 `tests/z4-pointer-guard.test.ts:52` | Có: `code`, `message` đúng nguyên câu, không uuid, số dòng không đổi | Giết đột biến «bỏ `SECURITY DEFINER`» (role AI không đọc được bảng ánh xạ, mã lỗi khác `LTZ01`) |
| G2 `:63` | Có (đối chứng): ba lệnh trả `null`, đếm 3 | Giết đột biến «chỉ cần có một dòng `IBS_HI`» |
| G3 `:73` | Có | Giết «`ORDER BY … ASC`» và «theo `created_at`» (dòng bản 5 được ghi trước dòng bản 4) |
| G4 `:81` | Có | Giết «bỏ điều kiện tenant»: khi đó câu trả lời là `LTZ01`, ca đòi lỗi RLS |
| G5 `:89` | Có | Giết «trigger `AFTER`»: phép dò trùng sẽ trả «không dòng nào», ca đòi lỗi khác `null` |
| G6 `:101` | Có | — |
| G7 `:108` | Có | Ghim: bit có cả khi không có ngữ cảnh |
| G8 `:118` | Có | Giết «thiếu `REVOKE`» (khi `proacl` là NULL, `aclexplode` trả rỗng, khác `[chủ]`). Xem M-1 về cách so tên chủ |
| G9 `:133` | Có | Ghim hành vi một bit ngoài phạm vi tự khai |
| G10 `:142` | Có: sáu lệnh, ba role, đếm 1 | — |
| G11 `:153` | Có: cả hai lệnh dò phải khớp đúng câu lỗi RLS của bảng ánh xạ | Giết «bỏ `row_security = off`»: với ngữ cảnh ca đặt, role runtime đọc được ánh xạ và lệnh cho dự án chưa ánh xạ sẽ trả `null` |
| G12 `:168` | Có: hình dạng trước/sau hai lần chạy, danh sách trigger đúng tên của cả hai bảng, `tgenabled='O'`, `tgtype=7`, hai thiết lập ghim, chủ hàm, chữ của tệp, hai dòng cuối | Thêm một trigger thứ ba lên một trong hai bảng làm ca này đỏ: người thêm buộc phải xét thứ tự so với guard |
| G13 `:206` | Có (đối chứng) | Quyền `INSERT` được kiểm trước khi trigger chạy |
| G14 `:218` | Có, kèm đối chứng hai dòng lưu được | — |
| G15 `:233` | Có: hai giá trị `null`, hai role, mã `23502` cho login vận hành | — |
| RB1 `tests/migrations-rollback.test.ts:396` | Có đủ các bước của brief: chặn khi có `'023'`, gỡ trigger và hàm, giữ hai bảng và số dòng, giữ ba trigger và hàm của 021, lệnh chèn cho dự án `IBS_HI` lưu được sau khi lùi, lùi lần hai, thuận hai lần | Xem M-2 (`finally`) và M-3 (nhánh «schema không còn») |
| S1 `tests/suggestions.test.ts:655` | Có: mã, 422, đúng nguyên câu, không id, không chữ `pointer-only`, 0 dòng; lặp cho nháp ứng viên | Đi hết đường thật (trigger ném, dịch vụ dịch), nên lệch giữa hằng `POINTER_ONLY_SQLSTATE` và `ERRCODE` của 022 sẽ làm ca đỏ |
| S2 `:671` | Có | `{stored:false}` sẽ làm ca đỏ ở `toBeTruthy` |
| S3 `:680` | Có (đối chứng), đếm 3 | — |
| S4 `:693` | Có | Tay nắm giả ném `Error('handle touched')` nếu bị chạm, khi đó mã không phải `SCOPE_DENIED` |
| H1 `tests/z4-schema.test.ts:460` | Chỉ thêm `AND tgname <> 'ai_drafts_pointer_only_guard'`; mọi `expect` nguyên | Không nới: xem dưới |
| H2 `tests/suggestions.test.ts:318` | Chỉ đảo thứ tự dựng; tên ca và hai `expect` nguyên | Sau 022 đây là trạng thái duy nhất còn tới được |
| H3 `tests/migrations-rollback.test.ts:349` | Chỉ chú thích | — |

Không ca nào khẳng định rỗng hoặc luôn đúng. Các phép `?.message).toMatch(...)` đỏ khi lệnh không lỗi (giá trị nhận là `undefined`).

**H1 có che một thay đổi thật không.** Đã đọc cả `migrations/021_ai_suggestions_z4.sql`: chạy lại 021 chỉ gỡ và tạo lại ba trigger của chính nó (`:147-154`), không có lệnh nào chạm trigger hay hàm khác. Guard của 022 vì vậy không đổi khi 021 chạy lại; loại nó khỏi truy vấn của H1 không che điều gì. Danh sách đầy đủ do G12 ghim.

**Log đỏ.** `task-1-red.txt`: 8 dòng `AssertionError`, 0 dòng `timed out`; G11, G12, RB1 đỏ vì thiếu hàm hoặc thiếu tệp và không được tính, đúng như brief. `task-2-red.txt`: S1, S2 đỏ vì nhận mã `LTZ01` thay cho `POINTER_ONLY_PROJECT`.

## 2. Chất lượng CSDL

### Tệp thuận (`migrations/022_ai_drafts_pointer_only_guard.sql`)

- **Idempotent.** `CREATE OR REPLACE FUNCTION`, `REVOKE` lặp lại không đổi gì, `DROP TRIGGER IF EXISTS` rồi `CREATE TRIGGER`, dòng `schema_migrations` có `ON CONFLICT DO NOTHING`; tất cả trong một giao dịch nên không có lúc nào hàm mở cho `PUBLIC` hay bảng thiếu trigger. Tính này được dùng thật: bản demo PGlite chạy lại mọi tệp migration mỗi lần khởi động (`src/server/db.ts:11`), còn `scripts/migrate.ts:12-16` bỏ qua bản đã áp. Chạy lại không sửa được hai thứ đã trôi: **chủ hàm** và **ACL ngoài `PUBLIC`** (`CREATE OR REPLACE` giữ cả hai). Chạy lại thì đặt lại `tgenabled` về `'O'` (trigger được tạo mới).
- **Hàm definer.** Thân là SQL tĩnh, một câu đọc, hai đầu vào kiểu `uuid` lấy từ `NEW`; không đọc biến `app.*`; không khối `EXCEPTION` nuốt lỗi, nên mọi lỗi của câu đọc (RLS, quyền, khoá) thành từ chối. `search_path = pg_catalog, pg_temp` với `pg_temp` đặt cuối, bảng viết đủ schema: đúng mẫu `migrations/019_document_approver_grant.sql:66`. `REVOKE ALL … FROM PUBLIC` ở `:25`; không `GRANT` nào; không có `ALTER DEFAULT PRIVILEGES` ở đâu trong `migrations/` (đã tìm). Role AI không gọi thẳng được hàm và không gắn được hàm vào bảng khác (tạo trigger cần `EXECUTE`).
- **Fail-closed có thật.** `public.project_domain_mappings` bật cả `ENABLE` lẫn `FORCE ROW LEVEL SECURITY` (`migrations/013_project_registry.sql:71-72`) và policy đọc không có mệnh đề `TO` (`:74-76`), nên với mọi chủ hàm không phải superuser và không có `BYPASSRLS`, kể cả chủ bảng, `row_security = off` cho lỗi thay vì đọc rỗng. Chủ không có quyền `SELECT` thì nhận `permission denied`. Không có nhánh nào đọc sai mà im lặng.
- **Cùng luật với dịch vụ.** `ORDER BY m.mapping_version DESC LIMIT 1` trùng `latestDomainSql` (`src/server/source-text.ts:18-19`); thêm điều kiện tenant vì hàm chạy ngoài RLS. `UNIQUE(tenant_id,project_id,mapping_version)` (`013:34`) bảo đảm không có hai dòng cùng bản, nên kết quả xác định. Xem M-5 về việc luật nằm ở hai nơi.
- **Chỉ mục và chi phí.** Chính chỉ mục của ràng buộc `UNIQUE(tenant_id,project_id,mapping_version)` phục vụ truy vấn của trigger (hai cột bằng, cột thứ ba cho thứ tự): một lần dò chỉ mục và một lần đọc dòng cho mỗi dòng chèn. **Không cần chỉ mục mới.** Lệnh chèn nhiều dòng trả chi phí theo từng dòng.
- **Khoá lúc chạy.** Câu đọc trong trigger không khoá dòng; nó chỉ lấy khoá đọc mức bảng trên bảng ánh xạ, thứ chỉ xung đột với DDL. Ghi ánh xạ và ghi nháp không chặn nhau; cái giá là phần dư R5 đã ghi trong kế hoạch. Xem M-6 về mức cô lập.
- **Mã lỗi.** `LTZ01` hợp lệ; lớp `LT` nằm ngoài các lớp PostgreSQL dùng; tiền lệ `LTR01`–`LTR03` (`migrations/020_document_review.sql:6`). Câu lỗi là hằng, không có id.

### Thứ tự trigger, RLS, CHECK, `ON CONFLICT`

Thứ tự của một lệnh chèn trên PostgreSQL 16 (suy luận; phiên chính cho biết G5, G7, G9, G14, G15 đã xanh trên động cơ thật): kiểm quyền `INSERT` → trigger `BEFORE ROW` → `WITH CHECK` của RLS → NOT NULL và CHECK → phép dò trùng của `ON CONFLICT` → ghi dòng → trigger `AFTER` (kiểm khoá ngoại). Hệ quả đã được kế hoạch nêu và ca ghim: role không có quyền chèn không nhận bit nào (G13); guard trả lời trước RLS (G7, G9), trước ràng buộc (G15), trước phép dò trùng (G5, S2). Một hệ quả tốt chưa ai ghi: dòng bị guard từ chối chưa bao giờ được ghi vào bảng, nên nội dung của nó không vào tệp dữ liệu, WAL hay bản sao lưu.

### Tương tác với 021

- Trên `intelligence.ai_drafts`, 021 chỉ có `ai_drafts_immutable` cho `UPDATE OR DELETE` (`021:151-152`). Guard là trigger `BEFORE INSERT` duy nhất của bảng: không có vấn đề thứ tự theo tên. Đường sửa `project_id` của một dòng có sẵn vẫn bị trigger bất biến chặn (G10).
- Policy `ai_insert` (`021:100-103`) không đổi; guard không sửa `NEW`.
- Tệp lùi 021 từ chối khi còn `version > '021'` (`migrations/rollback/021_ai_suggestions_z4.sql:10`), nên thứ tự lùi là 022 rồi 021. Ca lùi 021 có sẵn lùi 022 trước rồi chạy `DROP SCHEMA IF EXISTS intelligence` không `CASCADE` và vẫn xanh: bằng chứng gián tiếp rằng tệp lùi 022 gỡ hết thứ nó tạo trong schema.

### Tệp lùi (`migrations/rollback/022_ai_drafts_pointer_only_guard.sql`)

Thứ tự đúng: kiểm bản sau (`:7`) → gỡ trigger (`:11-13`) → gỡ hàm (`:14-16`) → xoá dòng `'022'` (`:18`). Không `CASCADE`: nếu còn thứ gì phụ thuộc hàm, `DROP FUNCTION` lỗi và cả tệp lùi. Không đụng dòng dữ liệu nào. Chạy lại được khi trigger và hàm đã mất (RB1). So sánh chuỗi `version > '022'` đúng với số ba chữ số có số 0 đứng đầu, cùng mẫu với 018–021.

### Quality Gate

| Mục | Kết quả |
|---|---|
| E-DB-04, M-01 | Tệp có số, nối tiếp 021 |
| M-02 | Idempotent; có ca (G12) |
| M-03 | Có tệp lùi cùng tên; có ca (RB1) |
| M-04, M-05, M-07 | Không áp dụng: không cột, không bảng, không đổi tên |
| M-06 | Không viết lại bảng, không dựng chỉ mục, không điền lại dữ liệu; khoá ở ghi chú triển khai |
| E-DB-05 | Guard là lưới cách ly, cùng lớp với RLS và các guard của 019–021; lý do chọn tầng CSDL ghi ở B4 (đọc-rồi-ghi ở dịch vụ không đóng được đường chèn thẳng). Không coi là luật nghiệp vụ đặt nhầm tầng |
| AR-03, E-AI-04, AR-01 | Không `GRANT`; role AI vẫn chỉ ghi Z4; hàm đọc một dữ kiện của Z1 trong cùng CSDL của cùng platform |
| 34a–34e | 34b: G4 · 34c: G10 · 34d: G7 · 34a, 34e: G8. Hàm definer đọc ngoài RLS và tự cách ly bằng điều kiện tenant tường minh; G4 giết đột biến bỏ điều kiện đó |
| E-SEC-02 | Ngữ cảnh vẫn đặt bằng `set_config(…, true)` trong giao dịch (`src/server/ai-scope.ts:15-16`); 022 không thêm phụ thuộc nào vào hàm của nhà cung cấp |

## Findings

| # | Mức | Tệp:dòng | Sai gì · vì sao quan trọng | Sửa thế nào |
|---|---|---|---|---|
| I-1 | Important | `migrations/022_ai_drafts_pointer_only_guard.sql:17-22`, `:28-29` · `deploy/install-user.py:137-138`, `:161` · `deploy/install-d1.sh:39-43` · `docs/DEPLOY-002.md:19` | Guard là trigger đầu tiên của repo có đủ hai tính chất: buộc cả login vận hành (G6), và phán một dòng theo một dữ kiện **đổi được sau khi dòng đã lưu** (ánh xạ mới nhất). Đường cài đặt có trong repo áp mọi migration rồi mới phục hồi dữ liệu kiểu data-only, trigger bật, một giao dịch, `--exit-on-error` (đọc từ mã). Lúc phục hồi, guard xét lại từng dòng nháp. Một nháp lưu hợp lệ trước khi dự án thành `IBS_HI` (trạng thái mà R2 và OQ-54 để lại) qua hay bị từ chối tuỳ `intelligence.ai_drafts` được nạp trước hay sau `public.project_domain_mappings`; hai bảng không có khoá ngoại với nhau nên không gì trong repo ghim thứ tự đó. Bị từ chối thì **cả lần phục hồi lùi**. `docs/DEPLOY-002.md:61` đã ghi một lần phục hồi hỏng vì thứ tự nạp. Suy luận của tôi từ cách `pg_dump` sắp dữ liệu bảng (theo tên schema rồi tên bảng, rồi theo khoá ngoại): `ai_drafts` được nạp trước, guard thấy bảng ánh xạ rỗng và cho qua; **chưa đo**. Kế hoạch (B4, B6, «Giới hạn đã biết») và hai báo cáo cổng không nhắc tới đường phục hồi. Hôm nay Z4 chưa bật nên không có dòng nháp thật: không chặn Task 1–2 | Không đổi SQL. (a) Phiên chính đo một lần (mục ⚠️-3). (b) Ghi vào ghi chú triển khai và thêm một dòng vào danh sách «trước khi bật Z4»: «phục hồi data-only phụ thuộc thứ tự nạp hai bảng; đã đo ngày …, kết quả …». (c) Nếu đo ra thứ tự ngược: dừng và hỏi; `--disable-triggers` tắt luôn các trigger bất biến trong lúc phục hồi, đó là việc cần người quyết |
| M-1 | Minor | `tests/z4-pointer-guard.test.ts:121-124` (G8) | So `grantee::regrole::text` với `pg_get_userbyid(proowner)`. Dạng `regrole` thêm ngoặc kép cho tên cần ngoặc (có gạch nối, chữ hoa); `pg_get_userbyid` thì không. Trên một cụm mà login migration có tên như vậy, ca đỏ oan | So bằng oid: thêm `a.grantee = p.proowner` vào truy vấn và khẳng định đúng một dòng, giá trị `true`. Hạ tầng, không đổi điều khẳng định |
| M-2 | Minor | `tests/migrations-rollback.test.ts:466` (RB1) | `await h.exec(forward).catch(()=>{})` nuốt lỗi áp lại 022 trong `finally`. Ca 021 ngay trên, mẫu mà brief chỉ định, không nuốt. Trên CSDL native dùng chung, một lần áp lại hỏng sẽ không hiện ở ca này | Bỏ `.catch(()=>{})`, như ca 021 |
| M-3 | Minor | `migrations/rollback/022_ai_drafts_pointer_only_guard.sql:10` · `tests/migrations-rollback.test.ts:460` | Chú thích nói tệp chạy lại được cả khi bảng hoặc schema không còn. RB1 chỉ chạy lại khi bảng và schema còn. Nhánh «`to_regclass` và `to_regprocedure` trả NULL khi schema mất» không có ca nào trong repo; planner đo trên PGlite ngoài repo, chưa đo trên PostgreSQL 16. Tôi suy luận là đúng | Một ca mới, không sửa ca có sẵn: lùi 022, lùi 021 (không có dòng quyết định), chạy tệp lùi 022 lần nữa, không lỗi; `finally` áp lại 021 rồi 022. Hoặc phiên chính đo một lần ở làn native và ghi vào biên nhận |
| M-4 | Minor | `migrations/022_ai_drafts_pointer_only_guard.sql:7`, `:13-14` · `tests/z4-pointer-guard.test.ts:197` | Chủ hàm là «ai áp tệp thì là chủ»; câu «Apply as the migration login (a superuser)» chỉ là chú thích, tệp không tự kiểm (021 có khối tự kiểm ở `:19-27`; 019 đặt chủ tường minh ở `:79`). G12 chỉ ghim `rolsuper OR rolbypassrls` trên CSDL thử. Áp bằng một role khác: guard từ chối **mọi** lệnh chèn nháp bằng lỗi RLS thô, không phải `LTZ01`. An toàn, nhưng im lặng cho tới ngày bật Z4. Mục 2 của danh sách «trước khi bật Z4» (`docs/plans/oq-45-46-ai-drafts.md:745`) kể trigger, `tgenabled`, kiểu, `SECURITY DEFINER`, hai thiết lập; **thiếu chủ hàm và ACL** | Không đổi SQL trong PR này. Thêm «chủ hàm có `rolsuper` hoặc `rolbypassrls`; ACL chỉ có chủ» vào mục 2 đó, và chạy câu catalog ở mục ghi chú triển khai ngay sau khi áp. Muốn tệp tự kiểm thì là việc của planner |
| M-5 | Minor | `migrations/022_ai_drafts_pointer_only_guard.sql:17-19` · `src/server/source-text.ts:17` | Luật «dòng ánh xạ có bản cao nhất quyết định» nay nằm ở hai nơi. Đầu tệp 022 trỏ về `isIbsHiSql`; chiều ngược lại không có, và chú thích `source-text.ts:17` vẫn ghi «The one place that reads it». Không ca nào chạy hai cài đặt trên cùng dữ liệu dựng. Đổi luật ở một nơi thì nơi kia lệch mà không ca nào đỏ | Khi Task 4b hoặc 6 sửa `source-text.ts`: sửa chú thích đó thành một dòng nêu tên hàm của migration 022. Tuỳ chọn: một ca chạy cả hai trên ba trường hợp của G2 và G3 |
| M-6 | Minor | `migrations/022_ai_drafts_pointer_only_guard.sql:17-19` · `src/server/db.ts:44` | Phần dư R5 viết cho mức `READ COMMITTED`: câu đọc trong trigger lấy ảnh chụp mới cho mỗi lệnh. Giao dịch của role AI mở bằng `BEGIN` trần, tức theo mặc định của cụm hoặc của login. Ở `REPEATABLE READ` trở lên, khe hở rộng ra thành «từ lệnh đầu của giao dịch», và một dòng ánh xạ `IBS_HI` commit trong khoảng đó không được guard thấy | Ghi vào R5 và ghi chú triển khai: login của pipeline giữ `default_transaction_isolation = read committed`; kiểm lúc tạo login (trước khi bật Z4). Không đổi mã |

## Ghi chú triển khai cho biên nhận

1. **Thứ tự áp.** Sau 021. Migration và mã của Task 2 không phụ thuộc thứ tự: có mã mà chưa có 022 thì nhánh `LTZ01` không bao giờ chạy; có 022 mà chưa có mã thì người gọi `submitDraft` nhận lỗi CSDL thô mang mã `LTZ01` (không tuyến nào gọi). Khuyến nghị áp migration trước.
2. **Ai áp.** Login migration là superuser, như 019–021. Ngay sau khi áp, chạy câu chỉ đọc dưới đây và chép kết quả vào biên nhận:
   ```sql
   SELECT t.tgenabled, t.tgtype, pg_get_triggerdef(t.oid) AS def,
          p.prosecdef, p.proconfig, p.proacl::text AS acl,
          r.rolname AS owner, r.rolsuper, r.rolbypassrls
     FROM pg_trigger t
     JOIN pg_proc p ON p.oid = t.tgfoid
     JOIN pg_roles r ON r.oid = p.proowner
    WHERE t.tgrelid = 'intelligence.ai_drafts'::regclass
      AND t.tgname = 'ai_drafts_pointer_only_guard' AND NOT t.tgisinternal;
   ```
   Chờ: đúng một dòng; `tgenabled='O'`; `tgtype=7`; `prosecdef` đúng; `proconfig` có `search_path=pg_catalog, pg_temp` và `row_security=off`; `acl` chỉ có chủ; `rolsuper` hoặc `rolbypassrls` đúng.
3. **Khoá** (suy luận). Lần áp đầu: `CREATE TRIGGER` giữ khoá `SHARE ROW EXCLUSIVE` trên `intelligence.ai_drafts` tới `COMMIT`; lệnh ghi bảng phải chờ, lệnh đọc không chờ. Áp lại khi trigger đã có, và tệp lùi: `DROP TRIGGER` giữ `ACCESS EXCLUSIVE`; cả lệnh đọc cũng chờ. Giao dịch ngắn, `lock_timeout` 5 giây. Không khoá nào trên `project_domain_mappings`. Không viết lại bảng, không dựng chỉ mục, không điền lại dữ liệu.
4. **Khi `lock_timeout` nổ dưới `scripts/migrate.ts`** (có sẵn, ngoài diff; đọc từ mã `scripts/migrate.ts:18`, hành vi là suy luận): khối `finally` gọi `pg_advisory_unlock` trong một giao dịch đã hỏng, nên lỗi hiện ra có thể là «current transaction is aborted» thay cho lỗi hết giờ khoá. Nguyên nhân thật là lỗi đầu tiên.
5. **Một chiều hay không.** Lùi được, không biến đổi dữ liệu. Lùi là gỡ mã thực thi điểm 3 (b): không chạy trên CSDL thật khi chưa có lời Chairman (`AGENTS.md:9`). Thứ tự lùi: 022 rồi 021; tệp lùi 022 từ chối khi còn bản lớn hơn.
6. **Dữ liệu có sẵn.** 022 không rà dòng cũ. Nháp đã lưu của một dự án nay là `IBS_HI`, và nháp ghi trong lúc guard vắng, nằm lại; áp lại 022 không gỡ chúng (R2, OQ-54).
7. **Guard có thể vắng mà không ai biết** (R19, thêm ba đường): `DISABLE TRIGGER`; phiên đặt `session_replication_role = replica` (trigger `'O'` không chạy); `pg_restore --disable-triggers`. Cả ba cần superuser, cùng lớp với khoảng trống 40.
8. **Phục hồi data-only:** I-1.
9. **Mức cô lập:** M-6. **Chủ hàm và ACL:** M-4.
10. **Log máy chủ:** ⚠️-5.
11. **Chi phí:** một lần dò chỉ mục cho mỗi dòng chèn; không cần chỉ mục mới.

## ⚠️ Điều không kiểm được từ diff

| # | Điều chưa kiểm | Phiên chính nên kiểm gì |
|---|---|---|
| ⚠️-1 | Hai lượt PostgreSQL 16 (133 ca; 66 ca) không có log trong gói review; thư mục bằng chứng lúc tôi đọc chỉ có hai báo cáo cổng. Các câu về thứ tự trên động cơ thật (G5, G7, G9, G14, G15), G11 và phép `rolsuper OR rolbypassrls` của G12 dựa vào hai lượt đó | Chép hai log (đã thay đường dẫn checkout bằng `<repo>`) vào thư mục bằng chứng trước biên nhận |
| ⚠️-2 | Chưa có lượt cả bộ ở `9f721f0`. `tests/outbox-schema.test.ts` có vòng lùi các migration sau 017, nay gồm 022, và không nằm trong lệnh bảy tệp. Đã tìm: chỉ ba tệp test vừa ánh xạ `IBS_HI` vừa ghi nháp, cả ba nằm trong lệnh bảy tệp, nên rủi ro thấp nhưng chưa đo | Lượt cả bộ trên hai làn trước biên nhận; so số ca với mốc 1104/62 và 1166/0 |
| ⚠️-3 | Thứ tự nạp `intelligence.ai_drafts` so với `public.project_domain_mappings` trong một bản data-only (I-1) | Trên CSDL thử riêng: lưu một nháp, ánh xạ dự án đó sang `IBS_HI`, tạo bản bằng đúng lệnh của `docs/DEPLOY-002.md:19`, đọc `pg_restore --list` xem dòng `TABLE DATA` nào đứng trước. Đọc danh sách là đủ, không cần CSDL thứ hai |
| ⚠️-4 | Chủ hàm và ACL trên CSDL đích | Câu catalog ở ghi chú triển khai, mục 2 |
| ⚠️-5 | Cấu hình log của cụm. Nếu `log_parameter_max_length_on_error` khác 0, hoặc `log_statement`/`log_min_duration_statement` ghi kèm tham số, nội dung của một nháp bị từ chối (tham số của lệnh chèn) nằm lại trong log máy chủ, trái với ý không lưu nội dung nháp của dự án `IBS_HI`. Mặc định của PostgreSQL là không ghi tham số | Đọc bốn thiết lập đó trên cụm trước khi bật Z4; ghi vào danh sách «trước khi bật Z4» |
| ⚠️-6 | Mức cô lập mặc định của login pipeline (M-6) | Kiểm lúc tạo login |
| ⚠️-7 | `to_regclass` và `to_regprocedure` khi schema `intelligence` không còn, trên PostgreSQL 16 (M-3) | Một lần đo ở làn native, hoặc ca mới ở M-3 |

## Thứ đã mở ngoài diff

| Rủi ro nêu tên | Thứ đã kiểm | Kết quả |
|---|---|---|
| Truy vấn của trigger không có chỉ mục | `migrations/013_project_registry.sql:26-35`, `:46` | Có `UNIQUE(tenant_id,project_id,mapping_version)`; đủ |
| `row_security = off` không fail-closed với chủ bảng | `013:71-80` | `FORCE` bật, policy không có `TO`: fail-closed |
| Chạy lại 021 gỡ guard, và H1 che việc đó | `migrations/021_ai_suggestions_z4.sql` (cả tệp) | Không lệnh nào chạm trigger hay hàm khác |
| Trigger khác cùng sự kiện đổi `NEW` trước hoặc sau guard | `021:147-154` | Không có trigger `BEFORE INSERT` nào khác trên bảng |
| Thứ tự lùi 022 và 021 | `migrations/rollback/021_ai_suggestions_z4.sql` | 021 từ chối khi `'022'` còn; `DROP SCHEMA` không `CASCADE` |
| Luật của trigger lệch luật của dịch vụ | `src/server/source-text.ts:17-21` (`git show`) | Cùng luật; M-5 |
| Mã lỗi `LTZ01` trùng mã khác, hoặc lệch quy ước | `migrations/020_document_review.sql:6`, `src/server/review-delegations.ts:61` | Không trùng; cùng quy ước |
| Quyền mặc định trao `EXECUTE` cho role khác | tìm `DEFAULT PRIVILEGES` trong `migrations/`, `scripts/`, `deploy/`; `tests/z4-schema.test.ts:117-134` | Không có |
| Tệp thuận có được chạy lại ngoài test không | `scripts/migrate.ts`, `src/server/db.ts:9-13`, `tests/slice1-db.ts:19-56` | Demo PGlite chạy lại mỗi lần khởi động; trình áp thật bỏ qua bản đã áp |
| RB1 gỡ guard dưới chân tệp test khác trên CSDL native dùng chung | `vitest.config.ts` | `fileParallelism:false` |
| Lỗi của trigger để lại giao dịch dở trong pool; mã `code` có tới được chỗ dịch không | `src/server/ai-scope.ts`, `src/server/db.ts:41-46` (`git show`) | `ROLLBACK` rồi mới ném lại; chỗ dịch nằm ngoài giao dịch |
| Nơi ghi nháp thứ hai không dịch `LTZ01`; ca khác ghi nháp cho dự án `IBS_HI` | `git grep` ở `9f721f0` trên `src`, `scripts`, `deploy`, `tests` | Một nơi ghi (`src/server/suggestions.ts:99`); ba tệp test, đều trong lệnh bảy tệp |
| Guard chạy trong đường phục hồi của repo | `deploy/install-user.py:136-161`, `deploy/install-d1.sh:30-43`, `docs/DEPLOY-002.md:19`, `:61` | I-1 |
| Kế hoạch đã ghi đường phục hồi, mức cô lập, log chưa | tìm trong tệp kế hoạch và hai báo cáo cổng | Chưa ghi |
| Bản sao iCloud trong `migrations/`, `tests/`, `src/` lúc review | đếm tệp tên `* 2.*` | 0 |

Task quality: Approved
