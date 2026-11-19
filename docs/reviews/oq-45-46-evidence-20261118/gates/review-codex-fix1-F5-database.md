# Review CSDL của Task F5 — guard phía xác nhận (`0ec1e1b..05a6da0`)

Reviewer độc lập, chỉ đọc (không chạy vitest, không chạm CSDL). Đối tượng: phát hiện F1 và F2 của `gates/sweep-races.md` và bản sửa của chúng. Đọc: gói diff của Task F5, brief và báo cáo của builder, ba log bằng chứng `codex-fix1-F5-red.txt`, `codex-fix1-F5-green.txt`, `codex-fix1-F5-native-verbose.txt`.
Nhãn bằng chứng: [mã] = đọc mã; [log — tệp] = log đã có; [suy luận] = hành vi của engine, chưa đo.

## A. F1 và F2 đã đóng chưa

**F1 — đóng cho mọi lệnh xác nhận đi qua trigger.** Chạy lại hai giao dịch với khoá mới:

1. Ánh xạ `IBS_HI` commit **trước** phép kiểm của dịch vụ (`src/server/suggestions.ts:298`): dịch vụ thấy nó và giữ lệnh như trước.
2. Ánh xạ commit **giữa** phép kiểm và câu chèn quyết định: trigger `draft_decisions_pointer_only_guard` khoá dòng dự án rồi đọc lại ánh xạ bằng một câu lệnh riêng, nên câu đọc lấy ảnh chụp mới. Kết quả `LTZ01`, rồi `DRAFT_HELD`/`POINTER_ONLY_PROJECT`, và cả giao dịch lùi: bản đề xuất, claim, không còn gì [mã: `022` hàm 4; `suggestions.ts` khối `try/catch` của câu chèn]. [log — native: ca X1 và «a confirmation that waited for an uncommitted IBS_HI mapping…» xanh.]
3. Ánh xạ bắt đầu **sau** câu chèn quyết định: trigger của bảng ánh xạ chờ dòng dự án mà giao dịch xác nhận đang giữ, tới khi giao dịch đó commit. Quyết định được lưu trước; đó là trường hợp của OQ-54, không phải lỗ mới [log — native: P5].
4. Ánh xạ đang mở, chưa commit, lúc tới câu chèn: lệnh xác nhận chờ. Ánh xạ commit thì `LTZ01`; ánh xạ lùi thì quyết định được lưu [log — native: P4, Y3].

**F2 — đóng.** Sau câu chèn, giao dịch xác nhận giữ dòng dự án tới lúc commit. Không ánh xạ nào commit chen vào được giữa câu đọc của trigger và `present` (`:332`), nên ngữ cảnh dựng lại ở `:298` và câu `projectHasHiddenText` mới trong `present` cùng thấy một ánh xạ. Mọi ánh xạ commit trước câu chèn đều làm lệnh bị từ chối. Từ chối và phát lại không dùng lại ngữ cảnh nào (`contexts` rỗng), như trước [mã].

**Các bên ghi khác:**
- **Bên ghi mà trigger không chạy** (`session_replication_role = replica`, `DISABLE TRIGGER`, apply của logical replication): chỉ superuser hoặc chủ bảng. Cùng lớp R19 và R34 «Khác»; nay thêm một trigger vào danh sách đó. Role runtime không đặt được `session_replication_role` [suy luận: tham số mức superuser]. G20 chỉ đo điều này cho role AI.
- **Mức cô lập khác READ COMMITTED:** lệnh xác nhận bị từ chối `LTZ02` (ca P2). Lỗi đi thô qua `decide`, vì chỉ `LTZ01` được đổi thành `AppError`. Đóng theo hướng chặn, cùng lớp R32.
- **Giao dịch nhiều câu lệnh của login vận hành:**
  - Ánh xạ trước, rồi xác nhận: trigger thấy ánh xạ của chính giao dịch nên từ chối.
  - Xác nhận trước, rồi ánh xạ: cả hai commit cùng lúc, xem Q3.

## B. Thứ tự khoá

`decide`: khoá tư vấn của nháp → dòng tài liệu `FOR UPDATE` → claim (chỉ mục duy nhất của `document_commands`) → [`proposeRevisionIn`: dòng tài liệu lần nữa, các dòng `document_dependencies`, các lệnh chèn có `FOR KEY SHARE` lên `projects`] → dòng dự án `FOR NO KEY UPDATE`, ở câu ghi cuối. Sau đó chỉ còn các câu đọc của `present` và `UPDATE` dòng `document_commands` của chính nó [mã: `src/server/document-commands.ts:24`].

| Bên kia | Giữ gì | Có vòng không |
|---|---|---|
| `submitDraft` | chỉ dòng dự án (trigger 2), cộng chỉ mục khử trùng của các giao dịch AI khác | Không. Nó không chờ thứ gì `decide` giữ trước dòng dự án. Hai bên chỉ gặp nhau ở dòng dự án và xếp hàng theo thứ tự đến. |
| Lệnh ghi ánh xạ | chỉ dòng dự án | Không |
| Bản trình tay | dòng tài liệu → claim; không chạm dòng dự án (không trigger nào trên `document_revisions`) | Không. Thứ tự dòng tài liệu → claim giống `decide`. |
| Quyết định review (`src/server/document-review.ts:228`) | dòng tài liệu | Không. Không chạm dòng dự án. |
| `decide` khác, cùng dự án, khác tài liệu | khoá tư vấn B, tài liệu B, claim K2, rồi dòng dự án | Không. Bên lấy dòng dự án trước chỉ còn câu đọc và `UPDATE` dòng claim của chính nó. |
| `decide` khác, cùng khoá lệnh | chờ ở claim | Không. Bên đang giữ claim chưa chạm dòng dự án của bên chờ. |
| Liên kết phụ thuộc (`src/server/document-dependencies.ts:78`) | `FOR SHARE` trên dòng tài liệu | Không |

`FOR KEY SHARE` mà khoá ngoại của giao dịch khác đặt lên dòng dự án không xung đột với `FOR NO KEY UPDATE` [suy luận, ma trận khoá dòng; khớp phép đo của 07.3 cho lệnh chèn vào bảng khác].

**Chờ không giới hạn do 022 tự gây ra: không có.** Cả bốn lần chờ của 022 nằm dưới `lock_timeout = 5s` của hàm [log — native: Y4 trả `55P03` trong khoảng 4–9 s, xong thì cùng lệnh thành công]. Lệnh bị chờ mà 022 không đặt trần là `UPDATE` của bên thứ ba trên `projects`: đã có điều kiện 23.

## C. Câu trả lời mới cho người gọi

- **Thứ tự trong một câu chèn:** `draft_decisions_guard` (021, INVOKER, đọc nháp dưới RLS của người gọi) → `draft_decisions_pointer_only_guard` (định nghĩa, theo thứ tự tên; G12 ghim) → khoá ngoại (`AFTER`) → `WITH CHECK` của `runtime_insert`, xét sau mọi trigger `BEFORE` [suy luận, thứ tự của executor].
- **Dự án ngoài phạm vi:** một dòng mà nháp không thấy được trong phạm vi người gọi tự khai bị 021 trả `P0001` trước khi đọc ánh xạ nào, với cùng câu trả lời bất kể nhãn (ca P3).
- **Nhánh `23503` của hàm 4:** thực tế không tới được. 021 đã tìm thấy nháp có đúng (tenant, dự án), và khoá ngoại của nháp bảo đảm dòng dự án tồn tại.
- **`LTZ01` cho một dự án trong phạm vi:** role runtime vốn đọc được `project_domain_mappings` trong phạm vi đó (`scope_select`, `migrations/013_project_registry.sql`), nên bit này **không mới**.
- **`LTZ01` đứng trước `42501`** khi `decided_by` không khớp `app.person_id`: cùng bit đó, không mới.
- **`LTZ02`:** một mã mới, không mang dữ liệu.
- **Thứ mới là năng lực, không phải câu trả lời:** xem Q1.

## D. Các ca

| Ca | Có khẳng định đúng tên không | Có đỏ được không |
|---|---|---|
| P1 | Có: mã, câu, 0 dòng cho login vận hành và role runtime; từ chối được lưu | Có [log — red] |
| P2 | Có: `LTZ02` ở RR; từ chối qua ở RR; cặp không có thì 021 trả lời trước (`where` không chứa tên hàm mới) | Có [log — red] |
| P3 | Có: cùng câu trả lời trước và sau `IBS_HI`, không phải `LTZ01` | Không đỏ trên SQL cũ, đúng như mong đợi (khi chưa có hàm mới, câu trả lời đã như nhau). Ca này canh hồi quy: nó đỏ nếu thứ tự tên đổi. |
| P4, P5 | Có. `waitForBlocked(h,1)` chứng minh có chờ thật. | Không có log đỏ: lần chạy đỏ chỉ trên PGlite, nơi hai ca này bị bỏ qua (Q4) |
| X1 | Có, với một giới hạn (Q2) | Có [log — red] |
| Y3 | Có: `DRAFT_HELD`, câu, không quyết định, không bản, không claim; khoá còn tự do | Không có log đỏ (Q4) |
| Y4 | Có: `55P03` thô, 4–9 s, không ghi gì, sau đó thành công | Không có log đỏ (Q4) |
| G12 | Có: bốn thân hàm khớp tệp, thứ tự `tgtype = 7` trên bảng quyết định, cấu hình hàm, chủ hàm, thứ tự «từ chối → mức cô lập → khoá → đọc» trong thân hàm 4 | Có [log — red] |
| G20 | Có: role AI không gọi được hàm 4; cấu hình hàm được ghim | Có [log — red] |
| RB1, RB2 | Có: bốn trigger, bốn hàm; bảng quyết định chỉ còn hai trigger của 021; lùi rồi áp lại về đúng hình | Có [log — red]. RB3 không có trong diff, tôi không xét. |

**Về X1.** Cách dựng hợp lý. Ngữ cảnh dựng trước khi có ánh xạ (`pointerOnly` = sai) được trao cho đúng một lời gọi. CSDL đã có ánh xạ, nên chỉ trigger mới có thể giữ lệnh. Ca này chứng minh **tác dụng** của cuộc đua trên một kết nối: đường của dịch vụ đi qua, bản đề xuất được viết rồi bị lùi, khoá lệnh còn tự do. Ca không chứng minh **xen kẽ** (trigger không phải chờ); phần đó do P4 và Y3 lo. Giới hạn ở Q2.

## Phát hiện

| # | Mức | Vị trí | Kịch bản | Sửa |
|---|---|---|---|---|
| Q1 | **P2** | `migrations/022_ai_drafts_pointer_only_guard.sql`, hàm 4 (`PERFORM … FOR NO KEY UPDATE`); `docs/plans/oq-45-46-ai-drafts.md`, R34 của bản 0.7 (07.4, «Ai hoãn được lệnh ghi ánh xạ») | R34 viết rằng chỉ một giao dịch đã đưa nháp qua hai trigger, một lệnh ghi ánh xạ, hoặc một role ghi được `projects` mới hoãn được lệnh ghi ánh xạ, và «ba login dịch vụ đang có không còn làm được điều này». **Nay login web (role runtime) cũng làm được.** Một giao dịch chèn một dòng `draft_decisions` `confirmed` cho một nháp nó thấy được rồi **để mở** sẽ giữ dòng dự án. Hệ quả: mọi lệnh ghi ánh xạ (nên cả việc dự án thành `IBS_HI`) và mọi lệnh chèn nháp của dự án đó nhận `55P03` sau 5 giây, chừng nào giao dịch còn mở. Qua `decide` thì khoảng giữ chỉ kéo dài tới hết giao dịch của `decide` (ngắn). Với một phiên SQL trần của login web, phạm vi là phạm vi nó tự khai bằng `app.*`, nên xuyên tenant, cho mọi dự án có ít nhất một nháp có nguồn. Sau khi lùi không còn dòng nào. Trên lệnh xác nhận, cái giá này không gỡ được nếu muốn đóng F1 chặt (cùng lập luận như R34). Kèm theo là kênh thời gian của S-6 cho role runtime: biết một giao dịch chèn nháp hoặc ghi ánh xạ của dự án đang mở hay không. | Ghi vào R34 (sửa câu «ba login dịch vụ» thành hai login dịch vụ, cộng login web qua lệnh xác nhận). Mở rộng điều kiện 18: login web cũng có `idle_in_transaction_session_timeout`. Ghi vào điều kiện 24 rằng nay đã có một trigger định nghĩa trên một bảng mà role runtime ghi được, và nó khoá trước khi `WITH CHECK` xét (lớp CX1). Không đổi mã. |
| Q2 | P3 | `tests/suggestions.test.ts` (ca X1), `tests/suggestions-concurrency.test.ts` (Y3); `src/server/suggestions.ts`, câu `DRAFT_HELD` trong `catch` | Câu của lệnh bị trigger giữ trùng từng chữ với câu dịch vụ tự giữ khi `reasons` chỉ có `POINTER_ONLY_PROJECT`. Hai ca chỉ phân biệt hai đường bằng lập luận: X1 ép ngữ cảnh cũ; ở Y3 không khoá nào của bên ghi ánh xạ chặn `decide` trước phép kiểm. Ca không khẳng định đường nào trả lời. Một thay đổi về sau làm dịch vụ tự thấy ánh xạ (chẳng hạn bỏ việc dùng lại ngữ cảnh) sẽ làm hai ca vẫn xanh mà không còn chạm trigger. | Trong X1, khẳng định `buildSkillContextIn` được gọi đúng một lần và trả bản đã ép. Trong Y3, đọc `pg_blocking_pids`/`wait_event_type = 'Lock'` lúc `blocked` (như `waitForBlocked`). Hoặc cho hai đường một dấu khác nhau ngoài câu cho người dùng, chẳng hạn `cause`, để ca so được. |
| Q3 | P3 | hàm 4; `src/server/suggestions.ts`, câu chèn quyết định | Login vận hành, một giao dịch: xác nhận một nháp, rồi ghi ánh xạ `IBS_HI` cho cùng dự án. Khoá là của chính nó, không chờ; cả hai commit cùng lúc. Mở rộng F7 của `gates/sweep-races.md`, cùng lớp «Phục hồi» của 07.3. | Ghi một câu vào 07.3. Không đổi mã. |
| Q4 | P3 | `docs/reviews/oq-45-46-evidence-20261118/codex-fix1-F5-red.txt` | Lần chạy đỏ chỉ trên PGlite. Bốn ca chỉ chạy native (P4, P5, Y3, Y4) chưa từng được thấy đỏ trên SQL cũ, nên không có bằng chứng rằng chúng thất bại khi thiếu hàm 4. Theo lập luận thì chúng sẽ đỏ: không có hàm 4, P4 và P5 không chờ nên `waitForBlocked` hết giờ; Y3 không chờ và quyết định được lưu; Y4 không chờ và trả thành công. | Một lần chạy native bốn ca này trên thân 022 trước F5, với `AssertionError` đếm được (theo bài học «red evidence must be assertions»). |
| Q5 | P3 | `src/server/suggestions.ts`, khối `catch` quanh câu chèn quyết định | Sau câu chèn, `decide` còn giữ dòng dự án suốt `present`: dựng ngữ cảnh và `projectHasHiddenText`, câu quét mọi bản tin của dự án, chưa đo trên dữ liệu lớn (điều kiện 19). Thời gian đó ăn vào trần 5 giây của lệnh chèn nháp và lệnh ghi ánh xạ cùng dự án đang chờ. `55P03`, `LTZ02` và `23503` từ trigger đi thô ra người gọi (lớp R31). Tuyến đầu tiên dùng `decide` phải đổi chúng thành lỗi thử-lại-được, như điều kiện 18 đã đòi cho `submitDraft`. Thêm một nhánh không tới được: nếu một dòng quyết định đã có mà không qua khoá tư vấn (login vận hành), thì `ON CONFLICT(draft_id) DO NOTHING` vẫn chạy trigger trước, nên một lệnh xác nhận cho dự án `IBS_HI` nhận `DRAFT_HELD` thay vì `DRAFT_ALREADY_DECIDED`. | Ghi vào điều kiện 18 và 19: `decide` cũng thuộc diện. Không đổi mã trong PR. |

## E. Câu chỉ đọc cho biên nhận — A và B sửa cho bốn hàm (**chưa chạy**)

**A — trigger và thứ tự chạy** (chưa chạy; nay chờ 8 dòng: thêm hai trigger của 021 và trigger mới trên `public.draft_decisions`):

```sql
SELECT n.nspname || '.' || c.relname AS tbl, t.tgname, t.tgenabled, t.tgtype,
       pn.nspname || '.' || p.proname AS fn
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = t.tgfoid
  JOIN pg_namespace pn ON pn.oid = p.pronamespace
 WHERE NOT t.tgisinternal
   AND t.tgrelid IN ('intelligence.ai_drafts'::regclass, 'public.project_domain_mappings'::regclass, 'public.draft_decisions'::regclass)
 ORDER BY 1, t.tgname;
```

Mong đợi thêm (ba dòng của `public.draft_decisions`, theo thứ tự tên):
- `draft_decisions_guard`: `O`, 7, `public.draft_decisions_guard`
- `draft_decisions_immutable`: `O`, 27 [suy luận], `public.reject_history_mutation`
- `draft_decisions_pointer_only_guard`: `O`, 7, `intelligence.draft_decisions_pointer_only_guard`

Trong các dòng `tgtype = 7` của bảng quyết định, `draft_decisions_guard` phải đứng trước. [log] Tên, `O` và 7 của trigger mới khớp G12 trên PostgreSQL 16; giá trị 27 là [suy luận].

**B — bốn hàm** (chưa chạy; nay chờ 4 dòng). Thêm tên hàm mới và một cột kiểm rằng hàm bỏ qua lệnh từ chối trước mọi khoá:

```sql
SELECT pn.nspname || '.' || p.proname AS fn, p.prosecdef, p.provolatile, p.proconfig,
       md5(p.prosrc) AS body_md5,
       p.proacl IS NOT NULL
         AND (SELECT bool_and(a.grantee = p.proowner) FROM aclexplode(p.proacl) a) AS acl_owner_only,
       has_function_privilege('libetech_ai', p.oid, 'EXECUTE') AS ai_can_execute,
       has_function_privilege('libetech_runtime', p.oid, 'EXECUTE') AS runtime_can_execute,
       r.rolsuper AS owner_is_superuser,
       r.rolsuper OR r.rolbypassrls AS owner_exempt_from_rls,
       has_any_column_privilege(p.proowner, 'public.projects', 'UPDATE') AS owner_can_lock_projects,
       position('FOR NO KEY UPDATE' in p.prosrc) > 0 AS locks_project_row,
       position('IF NOT FOUND THEN' in p.prosrc) > 0 AS refuses_unseen_project,
       position('pg_advisory' in p.prosrc) = 0 AS no_advisory_lock,
       CASE WHEN p.proname = 'draft_decisions_pointer_only_guard'
            THEN position('IS DISTINCT FROM ''confirmed''' in p.prosrc) BETWEEN 1 AND position('FOR NO KEY UPDATE' in p.prosrc) - 1 END AS rejection_returns_first
  FROM pg_proc p
  JOIN pg_namespace pn ON pn.oid = p.pronamespace
  JOIN pg_roles r ON r.oid = p.proowner
 WHERE pn.nspname = 'intelligence'
   AND p.proname IN ('ai_drafts_declared_scope_guard', 'ai_drafts_pointer_only_guard', 'project_domain_mappings_draft_lock', 'draft_decisions_pointer_only_guard')
 ORDER BY 1;
```

Mong đợi cho dòng mới `intelligence.draft_decisions_pointer_only_guard`:
- `prosecdef` = `t`, `provolatile` = `v`
- `proconfig` = `{search_path=pg_catalog, pg_temp,row_security=off,lock_timeout=5s}`
- `acl_owner_only` = `t`, `ai_can_execute` = `f`, `runtime_can_execute` = `f`
- `owner_is_superuser` = `t`, `owner_exempt_from_rls` = `t`, `owner_can_lock_projects` = `t`
- `locks_project_row` = `t`, `refuses_unseen_project` = `t`, `no_advisory_lock` = `t`, `rejection_returns_first` = `t`
- Ba dòng cũ có `rejection_returns_first` = NULL.

`body_md5` của hàm mới phải tính khi chạy; không có giá trị tham chiếu. [log] `prosecdef`, `proconfig` và chủ hàm khớp G12/G20 trên PostgreSQL 16.

## Chưa kiểm được

- Không chạy ca nào. Không có lần đỏ native cho P4, P5, Y3, Y4 (Q4).
- Thứ tự «trigger `BEFORE` trước `WITH CHECK`» và «`FOR KEY SHARE` không xung đột với `FOR NO KEY UPDATE`» là suy luận về engine. Log native chỉ gián tiếp đỡ: P5 và Y3 xanh, không `40P01`.
- Chưa đo việc một phiên SQL trần của login web giữ khoá như Q1 tả. Cũng chưa đo việc đặt `session_replication_role` dưới role runtime bị từ chối.
- Không đọc RB3, vì không có trong diff.
- Các câu A và B ở mục E chưa chạy.

Đếm: P0 0 · P1 0 · P2 1 · P3 4.

VERDICT: READY FOR GATE
