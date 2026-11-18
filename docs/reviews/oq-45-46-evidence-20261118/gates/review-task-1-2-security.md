# Review bảo mật theo task — Task 1 và Task 2 (OQ-45 điểm 3 (b))

- Ngày: 18/11/2026. Vai: reviewer bảo mật (tư vấn; chỉ tìm và xếp hạng, không sửa mã, không phê duyệt).
- Phạm vi: `7b96dc0..9f721f0` (hai commit `564712f`, `9f721f0`). Không phải review merge.
- Cách làm: chỉ đọc. Không chạy test, không kết nối CSDL nào, không đọc `.env*` hay `.runtime/`. Mã đọc từ gói diff của phiên và từ `git show 9f721f0:<đường dẫn>`; không đọc `src/server/suggestions.ts` và `tests/suggestions.test.ts` từ đĩa.
- Độc lập với hai báo cáo cổng trên kế hoạch: tôi không dùng kết luận của chúng; chỉ dò chúng theo từ khoá để biết mục nào ở đây là mới.
- Nhãn: `#fact` = đọc thấy trong mã, trong diff hoặc trong kết quả lệnh chỉ đọc; `#inference` = suy từ ngữ nghĩa PostgreSQL, chưa đo.
- Thang mức: Critical = khai thác được ngay hoặc lộ bí mật; Important = khai thác được với công sức, hoặc hở cô lập; Minor = gia cố.
- Không finding nào chạm hệ thống vận hành của IBS HI (kết cấu, hàn, MDR, NCR): thứ bị chạm là nhãn miền `IBS_HI` trong LibeTech AI OS.

## Phán quyết

| Câu hỏi | Trả lời |
|---|---|
| Mã có đúng yêu cầu của hai brief không | **ĐẠT** |
| Có an toàn, làm tốt không | **Approved**, kèm 6 mục Minor và 8 mục cảnh báo |
| Số finding | Critical 0 · Important 0 · Minor 6 |

## Bước 0 — quét bí mật

- `#fact` Không tệp được theo dõi nào có tên khớp `.env|secret|credential|key|token`.
- `#fact` Các dòng thêm của diff: không chuỗi kết nối, không JWT, không khoá riêng, không mã nhóm Telegram, không địa chỉ thư, không URL. Năm dòng có chuỗi dài đều là đường dẫn tệp migration. Không ký tự điều khiển hướng chữ hay ký tự độ rộng không.
- `#fact` `.gitignore` phủ `.env`, `.env.local`, `.env.production`, `.env.bak`, `.env.json.bak`, `.runtime/`, `.superpowers/` (thử bằng `git check-ignore` trên tên giả định). Log đỏ/xanh của builder nằm trong `.superpowers/`, không vào repo công khai.
- `#fact` `.gitignore` **không** phủ tên bản sao dạng `<tên> 2.<đuôi>`; lúc review không có bản sao nào dưới `migrations/`, `src/`, `tests/` (đếm 0). Xem mục cảnh báo W7.
- `#fact` Lịch sử git (mọi ref) có một tệp tên `.env.example`; nhánh này không theo dõi nó. Tôi không đọc. Xem W6.
- Dữ liệu thử trong diff: `'Người mẫu'`, `'synthetic-source'`, `'synthetic-model'`, `'Lý do đủ dài'`, các hash `'a'×64`, `'c'×64`, uuid sinh ngẫu nhiên và uuid mẫu của fixture có sẵn. `#fact` Không bí mật, không mã nhóm Telegram thật, không tên người thật.

## 1. Đúng yêu cầu

### 1.1 Đối chiếu với brief

- `#fact` Gói diff của phiên trùng từng byte với `git diff -U10 7b96dc0 9f721f0`. Bảy tệp đổi, đúng danh sách của hai brief; không tệp nào ngoài danh sách.
- `#fact` `migrations/022_ai_drafts_pointer_only_guard.sql` và `migrations/rollback/022_ai_drafts_pointer_only_guard.sql` ở `9f721f0` trùng từng byte với hai khối SQL của `task-1-brief.md` (và với khối của kế hoạch). Báo cáo builder có ghi một lần ghi đè nhầm tệp thuận bằng tệp lùi rồi viết lại: kết quả cuối không lệch.
- `#fact` `src/server/suggestions.ts:24-25`, `:97-117`: đúng giao diện của brief Task 2. Chỉ lời gọi `aiScoped` được bọc; `return` thành `return await` (cần để `catch` bắt được lỗi bất đồng bộ); chỉ `code==='LTZ01'` được dịch; lỗi khác ném lại nguyên. Không thêm câu đọc ánh xạ; thứ tự các phép từ chối trước CSDL (`:80-95`) không đổi.
- `#fact` Ràng buộc chung: không `GRANT`, không role, không `CASCADE` trong 022; không đụng `migrations/001`–`021`, `migrations/rollback/013`–`021`, `src/app`, `src/components`, `AGENTS.md`, `CLAUDE.md`, `package.json`. Tệp lùi cùng tên tệp thuận (`AGENTS.md:9`).
- `#fact` Bằng chứng «đỏ trước»: log đỏ Task 1 có 8 `AssertionError`, 0 `timed out`; log đỏ Task 2 có 2 `AssertionError`, 0 `timed out`. Log xanh PGlite: 128 đạt / 5 bỏ qua (bảy tệp), 50 đạt / 1 bỏ qua. Lượt PostgreSQL 16 (133 đạt / 0 bỏ qua; 66 đạt) là lời của phiên chính, tôi không đọc log đó (W1).
- Ghi chú về bằng chứng đỏ: ca G8 đỏ vì `function … does not exist` không khớp `/permission denied/`, tức đỏ do thiếu hàm chứ không do hành vi. Brief xếp G8 vào nhóm `AssertionError`; biên nhận nên ghi **7** ca đỏ hành vi (G1, G3, G5, G6, G7, G9, G14) và G8 riêng.

### 1.2 Từng ca có khẳng định điều tên ca nói không

Dòng theo `9f721f0`. «Phân biệt» = ca sẽ đỏ với một cách viết guard sai cụ thể.

| Ca | Dòng | Khẳng định thật | Ghi chú |
|---|---|---|---|
| G1 | `tests/z4-pointer-guard.test.ts:52` | có | khác `null`, `code`, câu đúng từng chữ, không uuid, số dòng không đổi |
| G2 | `:63` | có (đối chứng) | ba lần lưu được, đếm 3; đỏ nếu guard chặn «từng là `IBS_HI`» |
| G3 | `:73` | có | đỏ nếu guard xếp theo thứ tự ghi thay vì `mapping_version` |
| G4 | `:81` | có (đối chứng phân biệt) | đỏ nếu guard bỏ điều kiện tenant, hoặc lấy tenant từ `app.tenant_id` thay vì từ dòng |
| G5 | `:89` | có | so `code`, không chỉ «không dòng nào»; đếm theo khoá là 1 |
| G6 | `:101` | có | login vận hành nhận `LTZ01`, đếm 0 |
| G7 | `:108` | có | không ngữ cảnh: `LTZ01` cho `IBS_HI`, RLS cho dự án khác, cả `code` lẫn câu |
| G8 | `:118` | có | sáu phép: đọc bảng, gọi hàm, ACL đúng `[chủ]`, truy vấn canh definer rỗng, thuộc tính role, quyền bảng. Đỏ nếu thiếu `REVOKE … FROM PUBLIC`. Lưu ý nhỏ: so `regrole::text` với `pg_get_userbyid` sẽ đỏ oan nếu tên login cần dấu nháy |
| G9 | `:133` | có | ghim đúng một bit ngoài phạm vi tự khai; không giấu |
| G10 | `:142` | có | sáu phép; chỉ so câu (`permission denied`, `Append-only`), đúng như brief |
| G11 | `:153` | có | `probe` trả câu lỗi hoặc `null` (`tests/slice2-fixtures.ts:80-94`); ca đòi khác `null` rồi mới so câu, cho cả hai dự án |
| G12 | `:168` | có | hình dạng trước/sau hai lần chạy; danh sách trigger đầy đủ của hai bảng; `tgenabled='O'`, `tgtype=7`; `prosecdef`, hai thiết lập, chủ; chữ của tệp; hai dòng cuối. Không ghim thân hàm (M6) |
| G13 | `:206` | có (đối chứng) | runtime và intake: `permission denied` và `code` khác `LTZ01` |
| G14 | `:218` | có | cả lệnh bị từ chối, dòng hợp lệ đứng trước cũng không lưu; đối chứng hai dòng lưu được |
| G15 | `:233` | có (đối chứng) | role AI: RLS trả lời; login vận hành: `23502` |
| RB1 | `tests/migrations-rollback.test.ts:396` | có | chặn khi có `'023'`; trigger và hàm mất; dòng `'022'` mất; nháp, quyết định, ba trigger và hàm của 021 nguyên; ghi rõ điều tệp lùi mở lại; lùi lặp lại được; thuận hai lần về hình dạng đầu. `finally` nuốt lỗi áp lại (M3) |
| S1 | `tests/suggestions.test.ts:655` | có | `refused` so cả `code` lẫn `status` (`:45-50`); câu đúng từng chữ; không id, không chữ `pointer-only`; đếm 0; lặp với nháp ứng viên. Không ghim `cause` (M5) |
| S2 | `:671` | có | cùng phong bì, sau ánh xạ: `POINTER_ONLY_PROJECT`, không phải `{stored:false}`; đếm 1 |
| S3 | `:680` | có (đối chứng) | ba lần `stored:true`, đếm 3 |
| S4 | `:693` | có | tay nắm giả ném `handle touched` ở mọi lời gọi (`:44`), nên «trước mọi câu lệnh» được chứng minh thật |

Không ca rỗng, không ca luôn đúng, không ca chỉ so câu ở chỗ mã lỗi mới là điều cần ghim.

### 1.3 H1, H2, H3

- H1 `tests/z4-schema.test.ts:460` `#fact`: thêm đúng một điều kiện loại một tên; mọi `expect` nguyên. Ca vẫn thấy mọi trigger lạ khác; G12 ghim danh sách đầy đủ. Không nới.
- H2 `tests/suggestions.test.ts:318-323` `#fact`: chỉ đảo thứ tự dựng (gửi nháp trước, ánh xạ sau); tên ca và hai `expect` nguyên. Đây là đường duy nhất còn tới được sau 022. Không nới.
- H3 `tests/migrations-rollback.test.ts:349` `#fact`: chỉ một chú thích. Không nới.
- Bốn ca canh của role AI trong `tests/z4-schema.test.ts` và ca «no route imports the suggestion service…» không bị chạm (diff của `tests/z4-schema.test.ts` là một dòng; hai hunk của `tests/suggestions.test.ts` không chạm ca canh tuyến). Ca «the runtime role cannot submit a draft» (`tests/suggestions.test.ts:171`) nguyên.

### 1.4 Thiếu, thừa, hiểu sai

Không thiếu ca nào của brief; không thừa; không hiểu sai. Một lệch nhỏ so với «theo đúng mẫu của ca 021»: M3.

## 2. An toàn

### 2.1 Sau hai commit, ai học được hay làm được gì mới

| Ai | Học được gì mới | Làm được gì mới |
|---|---|---|
| Người giữ role `libetech_ai` (chèn thô, tự đặt mọi biến `app.*`) | Một bit cho mỗi cặp (tenant, dự án) nêu được: «dòng ánh xạ mới nhất là `IBS_HI`». Không cần ngữ cảnh, xuyên tenant, dò trong savepoint không để lại dòng (`#fact` G7, G9). Không phân biệt được `LIBERICO_BU`, `XECA`, «chưa ánh xạ»; không đọc được bảng ánh xạ, không gọi được hàm (`#fact` G8). Biết một uuid dự án mà không biết tenant của nó thì không có bit (`#fact` G4) | Ở READ COMMITTED không còn chèn được nháp cho dự án `IBS_HI`. Ở REPEATABLE READ hoặc SERIALIZABLE vẫn chèn được sau khi ánh xạ đã commit (`#inference`, M1). Giữ được `AccessShareLock` trên `public.project_domain_mappings` tới hết giao dịch sau một lệnh chèn thành công (`#inference`, M2) |
| Pipeline qua `submitDraft` | `POINTER_ONLY_PROJECT` (422) cho dự án nằm trong `ai.projectIds`: cùng bit với `pointerOnly` của ngữ cảnh nó vốn nhận. Dự án ngoài danh sách: 404 trước mọi câu lệnh (`#fact` `src/server/suggestions.ts:85`, S4) | Không gì. Gửi lại một phong bì đã lưu nay bị từ chối khi dự án đã thành `IBS_HI` (S2), không phụ thuộc khoá có tồn tại hay không |
| Role runtime | Không gì: quyền `INSERT` được kiểm trước trigger (`#fact` G13) | Không gì |
| Role nhận tin | Không gì (`#fact` G13) | Không gì |
| Role identity, web | Không có quyền gì trên bảng nháp (`#fact` `migrations/021_ai_suggestions_z4.sql:159-163`); không có ca riêng, cùng cơ chế với G13 (`#inference`) | Không gì |
| Login vận hành (superuser) | Không gì (vốn đọc được mọi thứ) | Chèn thô cho dự án `IBS_HI` nay bị chặn (`#fact` G6). Vẫn tắt được trigger, `TRUNCATE`, hoặc chạy tệp lùi (phần dư R19, khoảng trống 40) |
| Tenant khác, người dùng thường | Không gì: không tuyến HTTP nào; `submitDraft` lấy tenant và danh sách dự án từ `AiPrincipal`, không từ thân lệnh | Không gì |

Mô tả ở B4 và R4 của kế hoạch về bit của role AI khớp với mã (`#fact`). Mô tả ở R5 thì hẹp hơn thật (M1).

### 2.2 Thân hàm definer (`migrations/022_ai_drafts_pointer_only_guard.sql:13-24`)

- `#fact` Một câu `SELECT` tĩnh, tên bảng đủ schema, hai đầu vào kiểu `uuid` lấy từ `NEW`, không SQL động, không đọc biến `app.*`, thông điệp lỗi tĩnh không id. `search_path = pg_catalog, pg_temp` (để `pg_temp` cuối); toán tử so sánh được giải trong `pg_catalog`.
- `#fact` «Mới nhất» là xác định: `UNIQUE(tenant_id,project_id,mapping_version)` ở `migrations/013_project_registry.sql:34`; chỉ mục của ràng buộc đó phục vụ đúng câu `ORDER BY … LIMIT 1`. Nhãn `'IBS_HI'` đúng chữ của CHECK ở `:30`.
- `#fact` Cùng luật với bên đọc: `src/server/source-text.ts:18-21` cũng lấy dòng `mapping_version` cao nhất; guard thêm điều kiện tenant vì không chạy dưới RLS. Khoá ngoại `(project_id,tenant_id)` ở `013:33` và `021:57` buộc dòng ánh xạ và dòng nháp cùng tenant với dự án, nên với mọi dòng lưu được, guard và bên đọc cho cùng kết quả.
- `#fact` Nhãn mà guard tin chỉ login vận hành ghi được: `013:101` cấp `SELECT`, không migration nào cấp `INSERT` trên bảng ánh xạ cho role ứng dụng; không câu `INSERT` nào vào bảng đó trong `src`, `scripts`, `deploy`, `bot-plugin`.
- `#inference` Fail-closed theo cấu trúc: chủ hàm bị RLS lọc → lỗi (G11 `#fact`); chủ hàm thiếu `SELECT` → `permission denied`; đổi tên cột → lỗi lúc chạy. Cả ba đều từ chối mọi lệnh chèn, không lặng lẽ cho qua. `SET row_security = off` là thiết lập của hàm, trả về như cũ khi hàm thoát, kể cả khi lỗi.
- `#fact` Trên `INSERT` chỉ có guard chạy: `ai_drafts_immutable` là `BEFORE UPDATE OR DELETE` (`021:152`). G12 ghim danh sách trigger, nên một trigger `BEFORE INSERT` mới (có thể sửa `NEW` sau guard) buộc phải sửa ca đó.

### 2.3 Quyền gọi

- `#fact` `REVOKE ALL … FROM PUBLIC` cùng giao dịch với `CREATE` (`:25`); ACL chỉ còn chủ (G8). Role AI không có `EXECUTE`; gọi thẳng bị `permission denied`.
- `#inference` Không có `EXECUTE` thì một role sở hữu bảng khác cũng không gắn được hàm này làm trigger cho bảng của mình để dựng máy dò (PostgreSQL kiểm `EXECUTE` lúc `CREATE TRIGGER`).
- `#fact` Ca canh «no SECURITY DEFINER function is executable by libetech_ai» vẫn đúng theo chữ. Về thực chất, đây là mã definer chạy trên hai giá trị do role AI chọn; G8, G9, G12 ghim phần mới đó.

### 2.4 Kênh phụ qua `submitDraft`

- `#fact` Lỗi dịch ra là `new AppError('POINTER_ONLY_PROJECT', câu tĩnh, 422)`; `AppError` chỉ có `code`, `message`, `status` (`src/server/errors.ts:1-3`): không `cause`, không chữ của lỗi CSDL, không id.
- `#fact` Phép kiểm `ai.projectIds` (`:85`) đứng trước `aiScoped`: bit không tới được cho dự án ngoài danh sách của pipeline. Lệnh chèn có đúng một dòng `(ai.tenantId, input.projectId)`.
- `#fact` Không tuyến HTTP nào gọi `submitDraft`. Mọi lỗi CSDL khác vẫn đi nguyên (kể cả `detail` của lỗi khoá ngoại có uuid do chính người gọi nêu): không đổi so với trước; đã nằm ở điều kiện 3 của danh sách «trước khi bật Z4» trong kế hoạch.
- `#fact` Không có ghi log ở `src/server/db.ts`, `src/server/ai-scope.ts`, hay trong khối `catch` mới. Log phía máy chủ PostgreSQL: xem W3.

### 2.5 Đường vòng quanh guard

| Đường | Kết quả | Căn cứ |
|---|---|---|
| Đường ghi khác vào `intelligence.ai_drafts` | Chỉ một câu `INSERT`, ở `src/server/suggestions.ts:99` | `#fact` (dò `src`, `scripts`, `bot-plugin`, `migrations`) |
| Chèn nhiều dòng | Cả lệnh bị từ chối | `#fact` G14 |
| `ON CONFLICT DO NOTHING` | Guard trả lời trước phép dò trùng | `#fact` G5 |
| `ON CONFLICT DO UPDATE`, `UPDATE` (kể cả đổi `project_id`), `DELETE` | Role AI không có `UPDATE`, `DELETE` (`021:159-163`); login vận hành gặp `ai_drafts_immutable` | `#fact` G10 |
| Dòng nêu tenant khác tenant của dự án | Guard im; RLS rồi khoá ngoại trả lời; không lưu | `#fact` G4, `021:57` |
| Dòng thiếu `tenant_id` hoặc `project_id` | Guard im; RLS hoặc NOT NULL trả lời | `#fact` G15 |
| Role không có quyền chèn | `permission denied`, không có bit | `#fact` G13 |
| `COPY … FROM` | Role AI: PostgreSQL không cho `COPY FROM` khi RLS áp cho role. Login vận hành: trigger hàng vẫn chạy | `#inference`; chưa có ca (W4) |
| `MERGE` (PostgreSQL 15 trở lên) | Nhánh `INSERT` chạy trigger `BEFORE INSERT` | `#inference`; chưa có ca (M4) |
| `session_replication_role = replica`, `DISABLE TRIGGER` | Cần superuser hoặc chủ bảng | `#inference`; G12 ghim `tgenabled='O'` trên CSDL thử |
| Lùi 022 | Mở lại đường ghi; RB1 ghi rõ; 021 không lùi được khi 022 còn | `#fact` |
| Giao dịch REPEATABLE READ hoặc SERIALIZABLE | **Lọt** | `#inference` M1 |
| Ánh xạ commit ngay sau khi guard đã đọc | Lọt; phần dư R5 đã ghi | — |
| Dự án chưa ánh xạ | Lưu được, theo thiết kế («chưa ánh xạ không quyết định gì») | `#fact` G2 |

### 2.6 Tệp lùi (`migrations/rollback/022_ai_drafts_pointer_only_guard.sql`)

- `#fact` Từ chối khi còn phiên bản lớn hơn `'022'` (`:7`); gỡ trigger rồi hàm, có kiểm tồn tại (`:11-16`); không `CASCADE`, không đụng dữ liệu; xoá đúng dòng `'022'` (`:18`). Chuỗi SQL động là hằng, không ghép đầu vào.
- `#fact` Chú thích đầu tệp nói rõ điều nó mở lại và rằng không chạy trên dữ liệu thật khi chưa có lời Chairman. RB1 ghim cả hành vi lẫn chữ.
- `#fact` Nếu lùi dở (ca kiểm bị ngắt giữa chừng), harness native tự áp lại migration thiếu ở lần mở kế (`tests/slice1-db.ts:29-36`); các tệp test chạy tuần tự (`vitest.config.ts`: `fileParallelism:false`), nên không có tệp nào chạy trong lúc guard vắng.

### 2.7 Luật

- AR-03, E-AI-04 `#fact`: role AI vẫn chỉ ghi Z4; 022 không cấp gì. Guard **đọc** một bảng Z1 bằng quyền chủ hàm, không ghi.
- E-SEC-02 `#fact`: guard không dựa vào biến phiên; ngữ cảnh của bảng nháp vẫn là `set_config(…, true)` theo giao dịch; `ENABLE` và `FORCE` của 021 không đổi.
- Quality Gate 34a (G8), 34b (G4, G9), 34c (G10), 34d (G7), 34e (G8: không `BYPASSRLS`, không definer gọi được) đều có ca. 34d: không ngữ cảnh thì luôn là lỗi, không bao giờ lưu; riêng dự án `IBS_HI` lỗi đó mang một bit (đã ghim, R4).
- `AGENTS.md:11` (Z4 chưa bật), `:13` (danh tính không lấy từ thân lệnh), `:16` (IBS HI chỉ con trỏ): không vi phạm.

## 3. Findings

| Mức | Vị trí | Lớp | Bằng chứng | Sửa đề xuất | Vai chủ trì |
|---|---|---|---|---|---|
| Minor M1 | `migrations/022_ai_drafts_pointer_only_guard.sql:17-19` | Lọt guard theo mức cô lập giao dịch; R5 mô tả hẹp hơn thật | `#inference` | Chọn: (a) guard từ chối khi mức cô lập không phải READ COMMITTED, hoặc (b) viết lại R5 và thêm điều kiện «trước khi bật Z4» | Planner sửa kế hoạch; Builder thực hiện; Chairman duyệt |
| Minor M2 | `migrations/022_ai_drafts_pointer_only_guard.sql:17` | Khoá trên bảng Z1 do role AI giữ | `#inference` | Ghi vào phần dư; đưa vào thiết kế login AI | Planner |
| Minor M3 | `tests/migrations-rollback.test.ts:466` | Dọn dẹp ca kiểm nuốt lỗi | `#fact` | Bỏ `.catch(()=>{})`, như ca 021 ở `:390` | Builder |
| Minor M4 | `tests/z4-pointer-guard.test.ts` (ca mới sau `:233`) | Ca còn thiếu: `MERGE` | `#inference` | Thêm một ca `MERGE` | Builder |
| Minor M5 | `tests/suggestions.test.ts:655-669` | Ca chưa ghim «không mang lỗi CSDL» | `#fact` | Thêm hai phép khẳng định | Builder |
| Minor M6 | `migrations/022_ai_drafts_pointer_only_guard.sql:13-14`, `tests/z4-pointer-guard.test.ts:168-204` | Definer do superuser sở hữu; thân hàm chưa ghim | `#fact` | Ghim thân hàm trong G12 | Builder |

### M1 — Minor — guard đọc theo snapshot của giao dịch

- **Kịch bản.** Người giữ role `libetech_ai` mở `BEGIN ISOLATION LEVEL REPEATABLE READ`, chạy một câu đọc bất kỳ (snapshot được chốt), rồi để giao dịch mở. Login vận hành commit dòng ánh xạ `IBS_HI` cho dự án P. Người giữ role chèn nháp cho P: câu `SELECT` trong guard đọc theo snapshot cũ, không thấy dòng mới, trả `NEW`; nháp được lưu khi `COMMIT`, mang `created_at` là lúc bắt đầu giao dịch (trước ánh xạ). SERIALIZABLE cũng vậy: chỉ có một cạnh phụ thuộc đọc–ghi nên không có lỗi tuần tự hoá.
- **Vì sao đáng ghi.** R5 tả cửa sổ là «trong lúc một lệnh chèn nháp đang chạy». Thật ra cửa sổ dài bằng thời gian người giữ role chọn giữ giao dịch, và nội dung chèn có thể được tạo **sau** khi dự án đã thành `IBS_HI`. Đối thủ này chính là đối thủ B1 nêu (chèn thô, không qua `submitDraft`).
- **Giới hạn của hệ quả.** Qua `submitDraft` không xảy ra: `aiScoped` dùng mức mặc định và chỉ có một lệnh chèn (`src/server/ai-scope.ts:14-18`, `src/server/db.ts:44`). Dòng lọt qua thuộc cùng lớp với R2 và OQ-54: đường đọc và cổng xác nhận vẫn che và giữ. Không ai đọc thêm được gì; thứ bị hụt là chữ «từ chối ngay lúc ghi» đối với người giữ role.
- **Sửa.** Không phải lỗi builder: SQL trùng brief từng byte và brief cấm thêm lệnh. Hai hướng để phiên chính và planner chọn, tốt nhất khi 022 chưa merge (sau đó phải là migration thứ hai): (a) trong guard, từ chối fail-closed khi `pg_catalog.current_setting('transaction_isolation')` không phải `read committed` hay `read uncommitted`, kèm một ca native hai kết nối; cần sửa kế hoạch trước. (b) giữ mã, viết lại R5 cho đúng cỡ và thêm một dòng vào danh sách «trước khi bật Z4». Trước khi chọn: đo theo W2.

### M2 — Minor — role AI giữ được khoá trên bảng ánh xạ

- **Kịch bản.** Sau một lệnh chèn **thành công** (dự án không `IBS_HI`, ngữ cảnh tự đặt), người giữ role để giao dịch mở rồi cuối cùng `ROLLBACK`, không để lại dòng. `AccessShareLock` trên `public.project_domain_mappings` được giữ suốt thời gian đó. Một migration về sau cần `ACCESS EXCLUSIVE` trên bảng này chờ tới `lock_timeout` 5 giây rồi hỏng; trong lúc nó chờ, mọi câu đọc mới vào bảng ánh xạ (các phép kiểm hiển thị chữ) xếp hàng sau nó. Trước 022, role AI không có câu lệnh thành công nào chạm bảng này (câu bị `permission denied` nhả khoá ngay khi lỗi).
- **Cỡ.** Nhỏ: điều tương tự đã có với `projects` qua khoá ngoại; không chặn được lệnh ghi dòng ánh xạ.
- **Sửa.** Không sửa trong PR. Ghi cạnh R4, R5; khi thiết kế login AI, trần thời gian giao dịch phải do tầng kết nối áp, vì thiết lập ở mức role thì người giữ role tự đổi lại được.

### M3 — Minor — `finally` của RB1 nuốt lỗi áp lại 022

- **Kịch bản.** Lệnh áp lại tệp thuận trong `finally` hỏng (ví dụ hết `lock_timeout` trên CSDL native dùng chung): ca vẫn xanh nếu thân ca đã qua; CSDL thử thiếu guard và thiếu dòng `'022'` cho tới lần `openHarness` kế tiếp; lỗi nổi lên ở tệp khác, khó truy về nguồn. Ca 021 mẫu (`:390`) không nuốt lỗi.
- **Sửa.** Bỏ `.catch(()=>{})` ở `tests/migrations-rollback.test.ts:466`.

### M4 — Minor — chưa có ca cho `MERGE`

- **Kịch bản.** `MERGE … WHEN NOT MATCHED THEN INSERT` là một đường chèn mà role AI dùng được với đúng các quyền nó có. Theo ngữ nghĩa PostgreSQL, trigger `BEFORE INSERT` vẫn chạy; chưa ca nào ghim điều đó, trong khi `ON CONFLICT` và chèn nhiều dòng đều đã có ca.
- **Sửa.** Thêm một ca vào `tests/z4-pointer-guard.test.ts`: dưới role AI, `MERGE` cho một dự án `IBS_HI` → `LTZ01`, không dòng nào thêm. `COPY` không ghim được bằng ca (không có client `COPY`, và không thêm dependency): kiểm tay theo W4.

### M5 — Minor — S1 chưa ghim rằng lỗi trả ra không mang lỗi CSDL

- **Kịch bản.** Hôm nay đúng. Một lần sửa về sau thêm `{cause:e}` vào `pointerOnlyRefused` để dễ gỡ lỗi: đối tượng lỗi của CSDL (ngữ cảnh PL/pgSQL, câu lệnh nội bộ) đi theo tới mọi bên ghi log hay tuần tự hoá lỗi, còn S1 vẫn xanh vì chỉ so `message`.
- **Sửa.** Trong S1 thêm: `cause` là `undefined`, và tập khoá riêng của lỗi đúng bằng `['code','status']`.

### M6 — Minor — thân của hàm definer chưa được ghim

- **Kịch bản.** Hàm chạy bằng quyền superuser trên giá trị do role không tin chọn. Thân hôm nay an toàn (mục 2.2). G12 ghim `prosecdef`, hai thiết lập, ACL và chủ, nhưng không ghim thân: một migration sau `CREATE OR REPLACE` hàm với thân rộng hơn (SQL động, đọc biến `app.*`, thông điệp có id) thì G12 vẫn xanh.
- **Sửa.** Trong G12 so thân hàm đang cài với chữ của tệp 022, để mọi thay đổi thân của một definer là việc có chủ ý.
- **Ghi nhận, không yêu cầu đổi.** Repo có tiền lệ definer với chủ hẹp chuyên dụng (`migrations/017_outbox.sql:372-383`). Kế hoạch ghi rằng phương án chủ hẹp đã xét là `libetech_runtime`; một role riêng chỉ có `SELECT` trên bảng ánh xạ chưa thấy được xét. PR này cấm tạo role, nên đây là việc cho một quyết định sau.

## 4. Điều không kiểm được từ diff (mục cảnh báo)

- **W1 — lượt PostgreSQL 16.** Tôi không đọc log native; con số 133 / 0 bỏ qua và 66 là lời của phiên chính. Thứ tự «trigger trước RLS, trước ràng buộc, trước phép dò trùng» và hành vi `row_security = off` chỉ được chứng minh ở lượt đó. Nên: chép vào thư mục bằng chứng (đã lau đường dẫn máy) dòng kết quả native của G5, G7, G9, G11, G14, G15, RB1, S1, S2 và của ca «the runtime role cannot submit a draft».
- **W2 — đo M1.** Trên CSDL thử, hai kết nối: (1) kết nối A `BEGIN ISOLATION LEVEL REPEATABLE READ`, `SET LOCAL ROLE libetech_ai`, đặt ba biến ngữ cảnh bằng một câu `SELECT`; (2) kết nối B chèn dòng ánh xạ `IBS_HI` cho dự án đó và commit; (3) kết nối A chèn một nháp cho dự án đó. Dự đoán: lưu được, không `LTZ01`. Lặp lại với READ COMMITTED: dự đoán `LTZ01`. Kết quả quyết định hướng (a) hay (b) của M1.
- **W3 — log của máy chủ PostgreSQL.** Mỗi lần guard từ chối là một dòng `ERROR` trong log máy chủ, kèm câu lệnh (`log_min_error_statement` mặc định là `error`). Qua `submitDraft` câu lệnh chỉ có `$n`; giá trị tham số chỉ bị ghi khi `log_parameter_max_length_on_error` khác 0 (mặc định 0), hoặc khi `log_statement` / `log_min_duration_statement` đang bật. Với lệnh chèn thô viết giá trị ngay trong chữ SQL, nội dung nháp vào log dù dòng không được lưu. Nên kiểm ba thiết lập đó trên máy chủ PostgreSQL riêng và thêm vào danh sách «trước khi bật Z4». Log này cũng là dấu vết duy nhất của việc dò bit (R4): `log_line_prefix` nên có role và địa chỉ.
- **W4 — `COPY FROM`.** Kiểm tay một lần bằng `psql` trên CSDL thử: role AI → chờ lỗi «COPY FROM not supported with row-level security»; login vận hành với một dự án `IBS_HI` → chờ `LTZ01`.
- **W5 — trạng thái trên CSDL thật.** Các ca chỉ ghim CSDL thử. Khi 022 được áp lần đầu lên một CSDL thật (cần lời Chairman), chạy tay các truy vấn catalog của G8 và G12: chủ hàm là superuser, ACL chỉ có chủ, `tgenabled='O'`. Lưu ý `scripts/migrate.ts:12-16` áp mọi migration đang chờ trong một lượt: lần chạy migrate kế tiếp trên bất kỳ CSDL nào cũng áp luôn 022.
- **W6 — `.env.example` trong lịch sử git.** Ngoài phạm vi diff; tôi không đọc. Xác nhận nó chỉ chứa giá trị giữ chỗ.
- **W7 — bản sao « 2».** `.gitignore` không phủ; bộ nạp migration lấy mọi tệp khớp `^\d+.*\.sql$`. Lúc review đếm 0. Tiếp tục đếm trước mỗi lượt chạy và trước mỗi commit.
- **W8 — phạm vi soát.** Tôi soát đúng `9f721f0`. `src/server/suggestions.ts` đang được sửa tiếp cho các task sau; khối `try`/`catch` ở `:97-117` phải còn nguyên. S1 và S2 ghim điều đó.

## 5. Ba chỗ sửa có tác dụng lớn nhất

1. **M1 cùng W2:** đo, rồi quyết khi 022 chưa merge — guard từ chối ở mức cô lập khác READ COMMITTED, hoặc viết lại R5 cho đúng cỡ và thêm điều kiện «trước khi bật Z4».
2. **W3:** đưa ba thiết lập log của máy chủ PostgreSQL vào danh sách «trước khi bật Z4», để nội dung của một nháp bị từ chối không nằm lại trong log.
3. **M4 và M6:** hai ca rẻ — một ca `MERGE`, và ghim thân hàm definer trong G12.

Task quality: Approved
