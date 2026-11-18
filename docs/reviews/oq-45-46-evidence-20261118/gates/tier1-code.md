# Review tầng 1 (mã) trên cả nhánh — PR mã của OQ-45 và OQ-46

- Nhánh `feat/oq-45-46-ai-drafts`, gốc `4f12a3c`, đầu `f36e947` (commit cuối đổi mã hoặc ca kiểm: `bcdb360`).
- Vai: reviewer mã (`liberico-code-reviewer`). **Khuyến nghị cho Chairman, không phải phê duyệt.**
- Cách làm: chỉ đọc. Đã đọc trọn `.superpowers/sdd/oq-45-46-ai-drafts/tier1-code-4f12a3c..f36e947.diff`, bản đầu nhánh của `src/server/suggestions.ts`, `src/server/source-text.ts`, `src/server/skill-contracts.ts`, `src/server/skill-context.ts`, `src/server/document-commands.ts`, `src/server/errors.ts`, `src/server/db.ts`, `src/server/ai-scope.ts`; các mục «Global Constraints», «Ca hiện có bị chạm», «Bảng: yêu cầu → ca», «Sau các lượt review theo task» của kế hoạch; sáu báo cáo review theo task; các log trong `docs/reviews/oq-45-46-evidence-20261118/`. **Không chạy ca kiểm, không nối CSDL, không ghi git.**
- Nhãn: `#fact` = đọc được trong mã, diff hoặc log; `#inference` = suy ra từ đọc, chưa chạy.
- Mức finding theo `docs/reviews/CODEX-REVIEW-PROMPT.md`: P0 rò dữ liệu, leo quyền, mất dữ liệu · P1 sai nghiệp vụ hoặc vi phạm MUST · P2 SHOULD hoặc rủi ro bảo trì · P3 góp ý.

## Tóm tắt

| Mục | Kết quả |
|---|---|
| Finding mới | P0: 0 · P1: 0 · P2: 1 · P3: 10 |
| Finding cũ thuộc mã và ca kiểm (17 mục) | ADDRESSED 17 · NOT ADDRESSED 0 (bốn mục có ghi chú «đóng nhưng mỏng hơn cách sửa reviewer nêu») |
| Phán quyết T3-M4 | Nên giữ cho PR này; bổ sung một dòng vào danh sách «trước khi có tuyến» |
| Ca hiện có bị sửa | Đúng H1–H6, K1–K3; không `expect` nào ngoài K1, K2, K3 bị đổi hoặc xoá |
| Ca canh tuyến và bốn ca canh role AI | Nguyên từng ký tự |
| Chưa kiểm được | Lượt toàn bộ ở đầu nhánh (PGlite, PostgreSQL 16), typecheck, build, coverage — đang chạy khi review |

---

## 1. Phán từng finding của các review theo task

`tệp:dòng` là ở đầu nhánh. «Đột biến» = dòng tương ứng trong `docs/reviews/oq-45-46-evidence-20261118/fix1b-mutations.txt`; đó là log của builder, tôi không chạy lại.

| Id | Phán | Chỗ trả lời | Ca mới có chứng minh điều finding đòi không |
|---|---|---|---|
| T3-M1 | ADDRESSED | `tests/suggestions.test.ts:769-785` (L3), `:787-810` (L4) | `#fact` Danh sách khoá **cho phép** bằng đúng 16 cột của `DRAFT_META_SQL`; bốn cột nội dung là `null`; có dòng nháp trong bản ghi (`length>0`, L4 đúng 2); đối chứng dương bằng lượt đọc của điều phối. Thêm một cột do bên ghi chọn vào `HEAD` làm L3/L4 đỏ. Không có đột biến ghi lại; `#inference` từ đọc. |
| T3-M2 | ADDRESSED | `tests/suggestions.test.ts:822-840` (oracle ở `:828`) | `#fact` Oracle viết tay (`kind==='document'||p===pm`), không suy từ dịch vụ; bên có quyền **phải** ghi được `rejected`, bên không có quyền **phải** nhận `MANAGER_REQUIRED` 403; «không che» so bằng với «lệnh thành công». Một lệnh hỏng vì lý do khác nay làm ca đỏ. |
| T3-M5 | ADDRESSED | `src/server/suggestions.ts:95-107` (`:96-98`) | `#fact` `toView` tự khử trùng, tự sắp, và khi mặt nạ rỗng mà không có giá trị đã qua lược đồ thì tự thêm `SCHEMA_INVALID` (đóng) thay vì ném lỗi như reviewer gợi ý. Nhánh `:98` không tới được từ `present` nên **không ca nào ghim** — xem F-4. |
| 4ab-I1 | ADDRESSED | `tests/source-text.test.ts:173-182` (Q5 i), `:184-192` (Q5 ii) | (i) có đột biến đỏ vì `AssertionError` (nối riêng tin gốc → `expected false to be true`). (ii) có đối chứng `toBe(22)` và `#inference` sẽ đỏ nếu thêm trần 20 tin; **không có đột biến ghi lại cho (ii)**. Ca ở mức dịch vụ mà reviewer ghi «nên thêm» (nháp không nêu tin ở luồng có tin trả lời lưu chữ) chưa có; không bắt buộc. |
| 4ab-N1 | ADDRESSED (mã) | `src/server/source-text.ts:93`; chú thích `:82-83` | `#fact` `row?.hidden!==false`. **Không ca nào ghim** dù ghim được bằng một `Queryable` giả trả `rows:[]` — xem F-2. |
| 4ab-N2 | ADDRESSED | `tests/suggestions.test.ts:1013-1031` (M10) | `#fact` Ghi chữ của mọi câu lệnh: người không có quyền → không câu nào chạm `source_events` hay `intake_candidates`; điều phối đọc nháp tài liệu → không câu nào chạm `source_events`; đối chứng dương ở cuối. Mạnh hơn cách reviewer gợi ý (dò khoá `hidden`). Chỉ phủ `list`; với `decide` của nháp tài liệu có Q7 (`:1179`) ở mức hành vi. |
| 4ab-N3 | ADDRESSED | `tests/source-text.test.ts:169-170` | `#fact` Đối chứng dương cùng ca: hỏi bằng dự án của chính ứng viên cho `true`. |
| T5-I-1 | ADDRESSED | `tests/suggestions.test.ts:469-480` (nửa sau `:474-479`) | Có đột biến đỏ đúng chỗ: bỏ điều kiện tài liệu của `named` → mất `SUBJECT_BASELINE_MISSING`. Hình dạng mới (A chỉ có r1; nháp về A nêu r2 của B) là cách reviewer nêu. Biến thể «khác dự án» mà reviewer ghi «nên thêm» chưa có — gộp vào F-6. |
| T5-M-1 | ADDRESSED | `tests/suggestions-concurrency.test.ts:100-138` | `#fact` Hai ca có thứ tự (`waitForBlocked(h,1)` rồi `(h,2)`); log native ba lượt đều xanh: `fix1b-native.txt:18-19`, `:33-34`, `:48-49`. |
| T5-M-2 | ADDRESSED | `tests/suggestions.test.ts:513-525` (D7) | `#inference` Thay `namedIds` bằng phép đọc riêng `sources` → nửa đầu thành `SUBJECT_BASELINE_MISSING` (lệnh bị giữ, ca đỏ), nửa sau mất `SUBJECT_CHANGED`. Không có đột biến ghi lại. |
| T5-M-3 | ADDRESSED | `tests/suggestions.test.ts:527-536` (D8) | `#inference` Bỏ bộ lọc ở `src/server/suggestions.ts:118` → `22P02` thô, không khớp `{code:'DRAFT_HELD'}`. Bước giữ cộng dồn lý do chứ không trả sớm (`:281-301`), nên câu lệnh vẫn chạy dù nháp đã bị giữ vì lý do khác: ca ghim đúng bộ lọc. |
| T5-M-4 | ADDRESSED | `src/server/suggestions.ts:118`, `:120`, `:126` | `#fact` Biến TypeScript thành `ids`; `named` chỉ còn một nghĩa (cột SQL). Chữ «Task 6» không còn. |
| T5-M-5 | ADDRESSED | `tests/suggestions.test.ts:81`; `tests/suggestions-concurrency.test.ts:20`, `:47` | `#fact` Ba dòng chú thích nêu OQ-53 (2). |
| T6-I1 | ADDRESSED | `tests/source-text.test.ts:268-274` (T9), `:276-283` (T10) | Cả hai có đột biến đỏ vì `AssertionError` (so theo `observed_at`; thu `later_edit` về tin được nêu). |
| T6-M1 a–d | ADDRESSED | `tests/source-text.test.ts:285-301` (T11), `:303-308` (T12), `:310-315` (T13), `:317-325` (T14) | T11, T12, T14 có đột biến đỏ. T13 dùng `Queryable` bẫy (ném nếu có câu lệnh), tự đủ. |
| T6-M2 | ADDRESSED | `src/server/source-text.ts:104-105` | `#fact` Hai câu tiền điều kiện đã có. Câu về ranh giới tenant nay lặp ở `:103` và `:105` (F-8). |
| SEC-M5 | ADDRESSED | `tests/suggestions.test.ts:1053-1055` | `#fact` `cause` là `undefined` và chín tên trường của lỗi `pg` vắng mặt. Kịch bản reviewer nêu (thêm `{cause:e}`) nay đỏ. Reviewer đòi **danh sách cho phép** (`['code','status']`); ca dùng danh sách cấm — xem F-5. |

**Đối chiếu log đột biến.** `#fact` Bảy đột biến, mỗi cái `1 failed`, `AssertionError count: 1`, `'timed out' count: 0`. `#fact` Mã ở đầu nhánh không còn dấu đột biến nào: `DOC_SUBJECT_SQL` có `v.document_id=$2` (`src/server/suggestions.ts:109-111`); `threadHasHiddenText` nối theo luồng (`src/server/source-text.ts:88-92`); `threadFreshness` so `created_at`, dùng `>=`, có đủ điều kiện dự án, không `LIMIT` (`:112-120`).

### Phán quyết T3-M4 — nên giữ

- `#fact` Thứ tự hiện tại (`src/server/suggestions.ts:250-268`): định vị → vai đọc → thu hẹp phạm vi → khoá tư vấn (`:255`) → đọc cả dòng kể cả `value` (`:256`) → lược đồ lệnh → khoá dòng tài liệu → khoá lệnh (`:266`) → xét quyền (`:268`).
- `#fact` Lý do của phán quyết đứng được: ca K2 (`tests/suggestions.test.ts:604-613`) đòi một điều phối đã bị hạ vai **gửi lại** lệnh cũ vẫn nhận quyết định đã ghi (không nội dung). Đường phát lại nằm trong `claimDocumentCommand` (`src/server/document-commands.ts:19-24`). Đưa phép xét quyền lên trước khoá lệnh, như T3-M4 gợi ý, sẽ trả `MANAGER_REQUIRED` cho lần gửi lại đó, tức đổi hợp đồng khử trùng của lát 3.
- `#inference` Phần dư có hai nửa, và R25 chỉ nêu cách xử cho một nửa:
  1. Khoá tư vấn và chỗ khoá lệnh trước khi bị từ chối → giới hạn tần suất khi có tuyến (R25, mục 11). Đủ.
  2. `value` vào tiến trình Node cho người không có quyền → **đóng được mà không đụng thứ tự**: câu định vị ở `:250` trả thêm `entity_type`, rồi `:256` và `:315` chọn `DRAFT_META_SQL` khi `mayDecide` sai (đúng cách `list` đang làm ở `:228-230`). Thứ tự khoá và đường phát lại giữ nguyên; K2 vẫn xanh vì câu trả lời của người bị hạ vai vốn không có nội dung.
- **Khuyến nghị:** giữ phán quyết, không sửa trong PR này (Z4 chưa bật, không tuyến, không gì rời dịch vụ). Thêm vào danh sách «trước khi thêm tuyến đọc nháp hoặc bật Z4», cạnh mục 11: «`decide` đọc dòng không nội dung cho người không có quyền quyết định».

---

## 2. Cả nhánh — những gì review theo task không thấy được

### Đã kiểm, không thành finding

- **Thứ tự kiểm.** `#fact` `present` (`src/server/suggestions.ts:193-218`): quyền → lược đồ → ngữ cảnh → chỉ con trỏ → lý do của cổng đầu ra → luồng có chữ ẩn. Bước giữ của `decide` (`:280-301`): manifest → hash → ngữ cảnh → chỉ con trỏ → cổng → luồng → đối tượng. Hai bên cùng thứ tự và đều **cộng dồn** lý do. Thân khoá lệnh: quyền → đã có quyết định → `valueHash` (`:268-273`), đúng «Global Constraints».
- **Đường trả sớm.** `#fact` Nhánh không có quyền của `present` `continue` trước mọi câu đọc (`:197`; ca M5, M10). `subjectReasons` trả sớm `SUBJECT_BASELINE_MISSING` (`:122`, `:129`) trước khi xét hai trường còn lại — đúng tiền điều kiện ghi ở `src/server/source-text.ts:104`. `newest===0` trả `[]` (`:127`): ca D3 ghim; chỉ tới khi tài liệu chưa có bản nào.
- **Bộ nhớ đệm.** `#fact` `contexts` và `hiddenThread` sống trong một lời gọi, khoá `kỹ năng:loại:mã`. Trong `list` mọi dòng cùng một đối tượng nên không có N+1 (M5 ghim «một lần mỗi kỹ năng»). Trong `decide`, ngữ cảnh dựng **trước** khi `proposeRevisionIn` ghi bản mới được dùng lại cho câu trả lời (`:292`, `:317`). `#inference` Không lệch: bản nháp nêu vẫn nằm trong 30 bản mới nhất; ca phát lại sau khi tài liệu đi tiếp (`tests/suggestions.test.ts:493-504`) dựng ngữ cảnh mới và cho đúng cùng câu trả lời.
- **Đường phát lại.** `#fact` Lần gửi lại không chạy thân khoá lệnh nên `contexts` rỗng; `present` tự dựng dưới quyền người gọi, phép xét quyền của `present` che cho người đã mất quyền (K2), và lớp che hiện hành áp lên quyết định cũ (M9, Q9).
- **Hai hướng lệch giữa `list` và `present` đều đóng.** `#fact` `list` chọn câu lệnh theo `q.entityType` (`:228`), `present` xét lại theo `r.entity_type` (`:197`). Lệch hướng nào cũng ra che: dòng không nội dung mà `present` tưởng có quyền → `SCHEMA_INVALID`; dòng đủ mà `present` thấy không có quyền → `CONFIRM_AUTHORITY_REQUIRED`, hash `null`.
- **Mọi `DraftView` qua một cửa.** `#fact` `toView` chỉ được gọi ở `:197` và `:215`.
- **Lỗi lạ không thành mặt nạ.** `#fact` `contextFor` chỉ đổi `SCOPE_DENIED` và `INVALID_INPUT` thành `null` (`:183`). `#inference` Hai mã 500 của bộ dựng (`CONTEXT_TOO_LARGE`, `CONTEXT_KIND_FORBIDDEN`) không tới được với các trần hiện tại (20 + 50 + 30 = 100, không lớn hơn 100), nên việc lệnh từ chối nay phụ thuộc bước dựng ngữ cảnh chỉ còn nghĩa với lỗi CSDL — thứ đằng nào cũng làm lùi giao dịch.
- **Ràng buộc phạm vi.** `#fact` (`git diff --name-status 4f12a3c..f36e947`) Không tệp nào dưới `src/app`, `src/components`, `bot-plugin/`, `skills/`; không đổi `AGENTS.md`, `CLAUDE.md`, `src/server/skill-context.ts`, `src/server/ai-scope.ts`, `src/server/skills.ts`, `package.json`, `vitest.config.ts`, `migrations/001`–`021`, `migrations/rollback/013`–`021`. `src/server/skill-contracts.ts` chỉ thêm `namedIds` (5 dòng). Đúng một migration. `src/server/suggestions.ts` không chứa chuỗi `source_event_revisions` hay `text_excerpt`.
- **Chỉ mục cho câu đọc mới.** `#fact` Có sẵn: `idx_source_events_thread`, `idx_source_event_revisions_event_fk` (`migrations/016_intake_inbox.sql:122`, `:126`), `idx_document_revisions_document_scope_created` (`migrations/014_document_registry.sql:73`). Chưa có `EXPLAIN` (mục 13 của danh sách «trước khi bật Z4» đã nêu).

### Finding mới

**F-1 · [P2] `src/server/suggestions.ts:198-214` và `:281-300` — cổng xét nháp tồn tại hai bản, giữ khớp bằng tay**
- Kịch bản: quyết định OQ-55 hoặc OQ-53 về sau thêm hay đổi một lý do ở `present` (ví dụ che nháp tài liệu theo phương án (e) của OQ-55) mà quên bước giữ của `decide`. Khi đó một nháp bị che lúc đọc lại xác nhận được. Mọi ca hiện có vẫn xanh, vì bất biến «bị che ⇒ bị giữ» chỉ được ghim **từng lý do một**, bằng cặp ca viết tay (Q3 cho `THREAD_TEXT_HIDDEN`, các ca giữ có sẵn cho năm mã còn lại); không ca nào duyệt qua kiểu `MaskReason`.
- `#fact` Hai bản đã lệch một chỗ (R29): bên đọc xét lược đồ và luồng cả khi không dựng được ngữ cảnh (`:199-200`, `:211-214`), bên xác nhận chỉ xét trong `if(ctx)` (`:294-300`). Hôm nay vô hại vì `ENTITY_NOT_FOUND` đã giữ.
- `#fact` Hệ quả phụ: một lần xác nhận nháp ứng viên chạy câu đọc luồng hai lần (`:298`, rồi `:212` khi dựng câu trả lời) — ngữ cảnh được truyền sang `present`, kết quả phép kiểm luồng thì không.
- Sửa: một hàm `gateReasons(tx,p,projectId,row,ctx)` trả tập đầy đủ; `present` lọc lấy các mã che, `decide` dùng cả tập và thêm `subjectReasons`; một ca tham số chạy qua từng `MaskReason` khẳng định «che ⇒ `DRAFT_HELD`». Làm cùng lượt mã của OQ-53/OQ-55 (đằng nào cũng viết lại đúng hai khối này). **Không chặn cổng.**

**F-2 · [P3] `src/server/source-text.ts:93` (và `:121`) — sửa fail-closed của 4ab-N1 không có ca ghim**
- Kịch bản: đổi `!==false` về `===true` → toàn bộ ca xanh. Tương tự ba dòng `===true` của `threadFreshness`.
- Sửa (2 dòng, cùng mẫu `trap` của T13): `const empty:Queryable={query:async()=>({rows:[]})}` → `threadHasHiddenText(empty,ids.sales,a.id,[])` là `true`; `threadFreshness(empty,…)` là ba `false`.

**F-3 · [P3] `src/server/suggestions.ts:137` — chú thích không còn đúng với mã**
- «Everything that can be refused is refused before the database is touched»: sau Task 1–2, `POINTER_ONLY_PROJECT` được quyết **ở CSDL** (guard 022) sau khi câu chèn đã gửi (`:155-175`); `LTZ02` cũng vậy. Cùng lớp với DB-M-5 («The one place that reads it»).
- Sửa: thêm «…except the pointer-only guard of migration 022 and the idempotency conflict, which the database answers».

**F-4 · [P3] `src/server/suggestions.ts:269` và `:98` — hai nhánh không tới được**
- `#fact` `:269` (`READ_ONLY` cho nháp tài liệu): `decide` đã trả 404 ở `:251` cho mọi vai ngoài `READ_ROLES` (`src/server/document-review.ts:23`), và cả bốn vai của `READ_ROLES` đều qua `mayWriteDocuments` (`src/server/documents.ts:84`). Ca L6 xác nhận: vai nào cũng quyết được nháp tài liệu. Trước PR chỗ này là `invariant`; nay là một nhánh riêng, đọc như thể có vai «đọc được mà không ghi sổ được».
- `#fact` `:98` (`toView` tự thêm `SCHEMA_INVALID`): `present` chỉ truyền mặt nạ rỗng kèm `parsed.data`.
- Sửa: một dòng chú thích «unreachable while READ_ROLES ⊆ ledger writers; kept closed» ở `:269`. Không cần đổi hành vi. Hai nhánh này tính vào số nhánh chưa phủ khi đọc coverage.

**F-5 · [P3] `tests/suggestions.test.ts:1053-1055` — SEC-M5 đóng bằng danh sách cấm**
- Kịch bản: một lần sửa gắn vào lỗi một trường của `pg` không nằm trong chín tên (ví dụ `internalQuery`, `column`, `dataType`, `file`, `line`) → ca vẫn xanh. Đây đúng là điểm yếu mà T3-M1 đã chỉ ra ở L3/L4 (dò chuỗi cụ thể thay vì tập cho phép).
- Sửa: `expect(Object.keys(e).sort()).toEqual(['code','status'])` (`#fact` `AppError` chỉ có hai thuộc tính riêng liệt kê được: `src/server/errors.ts:2`).

**F-6 · [P3] Quét cùng lớp với T6-M1 (b): điều kiện dự án của chính câu lệnh chỉ được ghim cho một trong ba câu đọc mới**
- `#fact` T12 dùng một principal có phạm vi cả hai dự án cho `threadFreshness`. Ca tương ứng của `threadHasHiddenText` (`tests/source-text.test.ts:164`) hỏi dưới phạm vi **chỉ có** dự án kia, nên RLS đã trả rỗng: bỏ ba điều kiện `project_id=$1` ở `src/server/source-text.ts:91` vẫn xanh. `DOC_SUBJECT_SQL` (`src/server/suggestions.ts:109-111`) không có ca nào hỏi chéo dự án (biến thể «khác dự án» của T5-I-1 chưa thêm).
- `#inference` Hướng hỏng của cả hai là đóng hoặc vô hại: `threadHasHiddenText` mất điều kiện chỉ trả `true` nhiều hơn (che thừa); `DOC_SUBJECT_SQL` còn `v.document_id=$2` và chỉ tới được sau khi `decide` đã thu phạm vi về một dự án (`:253`). Không có đường rò.
- Sửa: thêm vào ca Q5 phạm vi một dòng `ask(ids.transport,a.id,[],{...pm,projectIds:[ids.sales,ids.transport]})` → `false`.

**F-7 · [P3] PR discipline — `bcdb360` mang loại `test` nhưng đổi mã sản phẩm**
- `#fact` `test(suggestions): cases the task reviews found missing, and three fail-closed touches` đổi `src/server/suggestions.ts` (11 dòng) và `src/server/source-text.ts` (7 dòng). Tiêu đề có nói «three fail-closed touches», nhưng ai lọc lịch sử theo `feat`/`fix` để tìm thay đổi hành vi sẽ sót commit này.
- Sửa: nêu rõ trong mô tả PR (mục WHAT) rằng `bcdb360` có ba thay đổi ở `src`; không cần viết lại lịch sử.

**F-8 · [P3] Chú thích và nhãn**
- `src/server/suggestions.ts:297` — «(P3)» là nhãn bất biến của kế hoạch, vô nghĩa với người đọc mã (cùng lớp với «Task 6» của T5-M-4 (b)). Thay bằng lời: «what read masks, confirm holds».
- `tests/suggestions.test.ts:24` — «one case reads which principal…»: nay ba ca dùng mock này (`:310`, M5, M6), và M6 thay hẳn hành vi một lần.
- `src/server/source-text.ts:103` và `:105` — ranh giới tenant nói hai lần.
- `tests/z4-pointer-guard.test.ts:275` — G17 chỉ có `skipIf(!native)`, không có dòng nào nói vì sao (cần hai kết nối xen nhau). Tệp concurrency có chú thích đó (`tests/suggestions-concurrency.test.ts:100-101`).

**F-9 · [P3] Import, export và cột thừa**
- `src/server/suggestions.ts:10` — `MAX_OUTPUT_BYTES` được import mà không dùng (`#fact` có từ `4f12a3c`; nhánh sửa đúng dòng này mà không gỡ). Repo không có lint và `tsconfig.json` không bật `noUnused*`, nên không công cụ nào bắt.
- `src/server/suggestions.ts:25` — `POINTER_ONLY_SQLSTATE` được `export` nhưng không tệp nào import; ca kiểm khai lại chữ `'LTZ01'`. Bỏ `export`, hoặc cho ca S1 import để nối hằng với ca.
- `src/server/suggestions.ts:84` — `dec_key` được đọc về mà không dùng (có từ gốc; khoá lệnh của người quyết định tới Node cho mọi người đọc; không rời dịch vụ).

**F-10 · [P3] Mã lý do không có một bảng kiểu chung**
- `#fact` Mười lăm mã có thể xuất hiện trong câu `DRAFT_HELD` nằm ở ba nơi: kiểu `HoldReason` (`src/server/skill-contracts.ts:82`), kiểu `MaskReason` (`src/server/suggestions.ts:37`), và chuỗi trần (`:122-130`, `:283`, `:290`, `:293`, `:295`, `:298`). `subjectReasons` trả `string[]`; `:208` ép kiểu `as MaskReason`.
- Kịch bản: gõ sai một mã (`SUBJECT_CHANGE`) vẫn biên dịch; ca dò chuỗi mới bắt được.
- Sửa: một kiểu hợp `DecideHoldReason = HoldReason | 'VALUE_HASH_MISMATCH' | …`, `Set<DecideHoldReason>` ở `:282`. Về câu chữ: cùng một sự việc mang hai tên ở hai bề mặt (`MANAGER_REQUIRED` của `decide`, `CONFIRM_AUTHORITY_REQUIRED` của `list`); chấp nhận được vì mã che dùng chung cho hai loại nháp, nhưng nên ghi vào biên nhận để giao diện về sau không hiểu là hai điều kiện.

**F-11 · [P3] Truy vết: mã ca của kế hoạch không có trong tên ca**
- `#fact` «Bảng: yêu cầu → ca» dùng S1–S4, Q1–Q4, Q7, Q9, D1–D5, T1–T5, RB1–RB2; tên ca trong tệp chỉ mang L1–L9, M1–M10, G1–G18, Q5, Q6, Q8, T6–T14, D6–D8. `grep` theo mã không ra 20 ca trong số đó.
- Sửa: biên nhận chép bảng theo **tên ca**, hoặc thêm mã vào đầu tên ca ở lượt sửa kế tiếp.

### Kích thước và trách nhiệm của `src/server/suggestions.ts`

`#fact` 207 → 320 dòng (tệp lớn thứ ba của `src/server`); `decide` dài 78 dòng với một thân khoá lệnh 47 dòng. Tệp nay mang bốn việc: đường ghi của pipeline, luật ai đọc và che gì, luật giữ khi xác nhận, điều phối lệnh quyết định. Chưa tới mức phải tách trong PR này. Điểm tách tự nhiên là F-1: đưa luật che và giữ (`mayDecide`, `VISIBILITY`, `toView`, `gateReasons`, `subjectReasons`, `DOC_SUBJECT_SQL`) sang một mô-đun riêng khi OQ-53/OQ-55 có quyết định. `tests/suggestions.test.ts` nay khoảng 1 270 dòng, 86 ca, chia theo `describe` rõ ràng.

---

## 3. Ca kiểm của cả nhánh

### Mọi `expect` bị đổi hoặc xoá (`#fact`, lọc mọi dòng `-` của diff)

| # | Tệp | Dòng bị bỏ | Thay bằng | Xếp loại |
|---|---|---|---|---|
| 1 | `tests/suggestions.test.ts` | `expect(Object.keys(first).sort()).toEqual([…15 khoá…])` | cùng phép, thêm `'maskReasons'` (16 khoá) | **K1** — đúng danh sách của kế hoạch |
| 2 | `tests/suggestions.test.ts` | `expect(await decide(svc(),lowered,…)).toEqual(first)` | `.toEqual({...first,sources:[],value:null,questions:null,confidence:null,skillVersion:null,modelVersion:null,valueHash:null,maskReasons:['CONFIRM_AUTHORITY_REQUIRED']})` | **K2** — đúng từng trường; hai dòng 404 và số dòng quyết định giữ nguyên; tên ca đổi đuôi như kế hoạch |
| 3 | `tests/suggestions-concurrency.test.ts` | `expect([c.code,m.code].filter(x=>x==='REVISION_CONFLICT')).toHaveLength(1)` | `expect([confirmed,proposed].filter(Boolean)).toHaveLength(1)` | **K3** (i) |
| 4 | `tests/suggestions-concurrency.test.ts` | `if(c.code==='REVISION_CONFLICT') expect(dec).toHaveLength(0)` | nhánh `else`: `DRAFT_HELD` 422, câu chứa `SUBJECT_CHANGED`, `dec` dài 0 | **K3** (iii) |
| 5 | `tests/suggestions-concurrency.test.ts` | `else { expect(dec).toHaveLength(1); expect(dec[0].document_revision_id).toBe(latest); }` | nhánh `confirmed`: thêm `m.code==='REVISION_CONFLICT'`, giữ hai phép cũ | **K3** (ii) |

Không `expect` nào khác bị đổi hay xoá. `expect(await n('document_revisions')).toBe(revisions+1)` của K3 giữ nguyên (iv).

Các dòng bị bỏ còn lại là hạ tầng, đúng danh sách:

| Mục | Tệp | Đổi gì |
|---|---|---|
| H1 | `tests/z4-schema.test.ts:460` | một truy vấn thêm `AND tgname <> 'ai_drafts_pointer_only_guard'`; `toHaveLength(3)` giữ nguyên |
| H2 | `tests/suggestions.test.ts:320-325` | `mapDomain` chuyển xuống sau khi nháp đã lưu; tên ca và hai phép khẳng định giữ nguyên |
| H3 | `tests/migrations-rollback.test.ts` (ca lùi 021) | chú thích «(none today)» → «(022 today)» |
| H4 | `tests/suggestions.test.ts:79-85` | nguồn mặc định của `docDraft` thêm bản mới nhất; có chú thích OQ-53 (2) |
| H5 | `tests/suggestions-concurrency.test.ts:20-21`, `:47-48` | hai chỗ dựng `output` thêm bản mới nhất |
| H6 | `tests/suggestions.test.ts:65-71` | `candidate` nhận `{excerpt?}` và trả thêm `event` |
| — | bốn tệp test | dòng `import` (thêm tên); hai tên ca K2, K3 |

`#fact` So tên ca giữa gốc và đầu nhánh ở sáu tệp test bị sửa: không ca nào mất; hai tên đổi là K2 và K3. Không có `.skip`, `.only`, `.todo` mới; số `skipIf` ở các tệp cũ không đổi. Tổng tên ca ở bảy tệp (sáu sửa, một mới): 122 → 201, tức **+79**. Lượt toàn bộ ở gốc là 1 166 ca, nên lượt toàn bộ ở đầu nhánh phải là **1 245** (lượt giữa chừng ở `5013f75` là 1 228 = 1 166 + 62; đợt sửa thêm 17). Con số khác đi nghĩa là có tệp bản sao hoặc thiếu tệp.

### Ca canh

- `#fact` Khối `describe('Z4 drafts: boundaries', …)` chứa ca «no route imports the suggestion service, and nothing in src builds it with an AI handle» (`tests/suggestions.test.ts:1033-1044`): so chuỗi giữa `4f12a3c` và đầu nhánh, **giống hệt** (719 ký tự).
- `#fact` `tests/z4-schema.test.ts`: cả tệp chỉ có một hunk, một dòng, trong ca «running 021 again changes nothing…» (`:456`). Bốn ca canh ở `:61`, `:84`, `:117`, `:129` **nguyên từng ký tự**.

### Ca rỗng, luôn đúng, phụ thuộc thời gian

- **Không thấy ca rỗng hay luôn đúng.** Các ca «không chứa» đều có đối chứng dương trong cùng ca: L3, L4 (lượt đọc của điều phối), M10 (`texts.length>0` và câu đối chứng), Q5 (`toBe(22)`), Q6 và T6 (đúng một dòng, đúng tập khoá), D8 (`held` đòi `DRAFT_HELD` 422, lỗi CSDL thô không khớp). G8 so `[{is_owner:true}]`: ACL rỗng hoặc có thêm người được cấp đều đỏ. Một chỗ mỏng: M8 (`tests/suggestions.test.ts:984-1001`) không kiểm lại rằng cột `sources` của dòng chèn thô thật sự chứa các mã lạ; góp ý, không thành finding.
- **Phụ thuộc thời gian.** `#fact` `messageEvent` đặt `observedAt` bằng hằng cộng số thứ tự (`tests/slice2-fixtures.ts:44`); các mốc `editedAt` và `created_at` trong ca là hằng hoặc tương đối với `observedAt`; không ca nào dùng `Date.now()` để so. Ca cần thứ tự ghi **chặt** đều gọi `nextDbInstant` (`tests/slice3-fixtures.ts:137-143`): T7, T9, T10, T11, T14, và ba ca ở `tests/suggestions.test.ts:1215`, `:1224`. Các ca không gọi (`:1202`, `:1255`) chỉ cần `>=`. `nextDbInstant` chờ đồng hồ CSDL đổi chứ không ngủ một khoảng cố định. `#inference` Không thấy chỗ chập chờn.
- **Ca chỉ chạy native.** Tệp concurrency: `describe.skipIf(!native)`, tên nhóm có «(native PostgreSQL)», có chú thích (`:100-101`). G17: chỉ `skipIf` (F-8). `#fact` Bằng chứng native: hai ca thứ tự xanh ba lượt (`fix1b-native.txt`); G5, G7, G9, G11, G14, G15, G16, G17, G18 và hai ca lùi 022 xanh (`fix1a-native-verbose.txt:201-222`).

---

## 4. Quality Gate (PR checklist) cho diff này

Trạng thái enforcement: `#fact` repo không có `.github/workflows` và không có lệnh lint; ngưỡng coverage 60 % nằm trong `vitest.config.ts` và chỉ có hiệu lực khi ai đó chạy coverage tại máy. Theo thang của Quality Gate §IV, mọi dòng dưới đây là `manual` hoặc `advisory`; **không dòng nào là `blocking-ci`**. «Đạt» nghĩa là đạt theo mã và ca tôi đọc, không phải theo một lượt CI.

| # | Dòng | Kết quả | Căn cứ |
|---|---|---|---|
| 01 | Không sync I/O | Đạt | Không có trong phần `src` của diff |
| 02 | Lỗi không bị nuốt | Đạt | `contextFor` chỉ đổi hai mã (`suggestions.ts:183`); `submitDraft` ném lại mọi lỗi khác `LTZ01` (`:173-174`); DB-M-2 đã gỡ `.catch` nuốt lỗi |
| 03 | Cấu hình từ env | Không áp dụng | Không cấu hình mới; `excerptChats` vào qua hàm dựng |
| 04 | Validate đầu vào | Đạt | Ba lược đồ `strictObject` không đổi; mã uuid lọc chữ thường trước `::uuid[]` (`suggestions.ts:118`, `source-text.ts:86`, `:109-110`; ca D8, T7, T13); giá trị đã lưu được xét lại bằng lược đồ lúc đọc (`:199`; ca L9) |
| 05 | Phân trang | Đạt | `list` giữ `limit ≤ 200` và `total`; hai câu đọc luồng trả giá trị đúng/sai, không trả dòng |
| 06 | Auth và authorization | Đạt ở tầng dịch vụ; tuyến: không áp dụng | Vai đọc ở `:224`, `:251`; một luật `mayDecide` cho đọc và quyết (`:78`); quyền xét đầu tiên trong thân khoá lệnh (`:268`; ca L6, L8). Không có tuyến. Phần dư: T3-M4 |
| 07 | Phân loại lỗi, side-effect sau commit | Đạt | Một giao dịch; giữ hay từ chối đều lùi cả khoá lệnh (ca D1, T1, Q3, L8 đếm `document_commands`). Không có side-effect |
| 08 | Idempotent | Đạt, có ghi chú | `ON CONFLICT … DO NOTHING` ở cả ba chỗ ghi, không đổi. Thay đổi có chủ đích: gửi lại một khoá đã lưu, sau khi dự án thành `IBS_HI`, nhận `POINTER_ONLY_PROJECT` thay cho `stored:false` (ca S2 `:1067`, G5) |
| 09–11, 14 | UUID PK, timestamp, tiền, external id | Không áp dụng | Không bảng mới, không cột mới |
| 12 | Migration có tệp, idempotent, có rollback | Đạt | 022 nối tiếp 021; `CREATE OR REPLACE`, `DROP TRIGGER IF EXISTS`, `ON CONFLICT DO NOTHING`; chạy hai lần không đổi (G12); tệp lùi cùng tên, từ chối khi còn bản sau, chạy lại được (hai ca lùi). M-01, M-02, M-03 đạt; M-04, M-05, M-07 không áp dụng; M-06: `lock_timeout 5s`, bảng chưa có dữ liệu thật |
| 13 | Luật nghiệp vụ ở tầng ứng dụng | Đạt theo phán của reviewer CSDL | Guard là lưới cách ly cùng lớp với RLS (`review-task-1-2-database.md:89`; so sánh ở B4). Tôi đồng ý. Ghi chú: luật «bản ánh xạ mới nhất» nay sống ở hai nơi (`source-text.ts:17-18` và hàm 022), nối bằng một câu chú thích; G12 ghim thân hàm, không ca nào ghim hai nơi **khớp nhau** |
| 15 | Cột tenant và ca cách ly | Đạt | Không bảng mới; guard đọc theo `NEW.tenant_id` (G4); câu đọc mới dựa RLS cộng điều kiện dự án (Q5 phạm vi, T8, T12; F-6 cho hai câu còn lại) |
| 16 | Chỉ mục | Không áp dụng (không FK mới) | Câu đọc mới dùng chỉ mục có sẵn; chưa `EXPLAIN` |
| 17 | Reporting không chạm Z1 | Không áp dụng | Không có truy vấn báo cáo |
| 18 | Khoá lạc quan | Đạt | Không đổi: khoá tư vấn, khoá dòng tài liệu, `valueHash`, `expectedVersion`; ba ca chạy đua và hai ca thứ tự |
| 19 | Audit log | Đạt | Dòng `draft_decisions` bất biến, không đổi. Lần guard từ chối không để lại dòng nào ngoài log máy chủ (R23) |
| 20–22 | Frontend | Không áp dụng | |
| 23 | Không chạm CSDL nền khác | Đạt | Hàm 022 đọc `public.project_domain_mappings` của chính nền này |
| 24 | Envelope sự kiện | Không áp dụng | Không sự kiện mới |
| 25 | API tương thích ngược | Không áp dụng (không tuyến) | Hình dạng `DraftView` đổi (K1) nhưng không có bên dùng trong `src` — ca canh tuyến ghim điều đó |
| 26 | Nhiều lần ghi trong một giao dịch | Đạt | `decide` không đổi cấu trúc giao dịch |
| 27 | Chuyển trạng thái qua domain logic | Đạt | Quyết định là một lần chèn sau các phép giữ; không `UPDATE` nào |
| 28–30 | Dữ liệu ngoài | Không áp dụng | |
| 31 | Không lộ dòng thô, không PII | Đạt | Một cửa `toView`; người không có quyền không nhận cột nội dung nào từ SQL (`:91-92`; L3, L4); nội dung chỉ lấy từ giá trị đã qua lược đồ (L7); câu lỗi chỉ có mã (D8, S1, G1, G16). Còn lại: `LTZ02` và lỗi CSDL khác đi nguyên từ `submitDraft` (mục 3 của danh sách «trước khi bật Z4») |
| 32 | Log JSON có `request_id` | Không áp dụng | Mô-đun không ghi log |
| 33 | Trace id xuyên dịch vụ | Không áp dụng cho diff | `trace_id` của quyết định vẫn là `randomUUID()` như trước |
| 34a | Cách ly — đọc | Đạt | Q5 phạm vi, T7, T8, T12, L2, G8, G13; xem F-6 |
| 34b | Cách ly — ghi (`WITH CHECK`) | Đạt | G4, G9, G15 và ca có sẵn «the AI role writes drafts only inside…» |
| 34c | Cách ly — xoá, sửa | Đạt | G10 (bị từ chối hẳn, không «0 dòng») |
| 34d | Không ngữ cảnh ⇒ đóng | Đạt | G7, G11 |
| 34e | Không `BYPASSRLS`, không đường vòng | Đạt | G6, G8, và bốn ca canh không đổi |
| 35 | Unit test domain ≥ 60 % | ⚠️ Chưa kiểm ở đầu nhánh | Lượt coverage đang chạy. `#fact` Tệp `coverage/coverage-summary.json` có sẵn là của ngày 16/11 (trước nhánh): tổng nhánh 90,91 %, `suggestions.ts` 96,42 %. `#inference` Ngưỡng 60 % không bị đe doạ; hai nhánh chết ở F-4 sẽ hạ nhẹ con số của tệp |
| 36 | Integration test API | Không áp dụng | Không tuyến |
| 37 | Sửa lỗi kèm ca tái hiện | Đạt, có ghi chú | Lỗi thật duy nhất do review tìm ra (SEC-M1, đo được) có ca G16 đỏ trước khi sửa (`fix1a-red.txt:28-29`) và G17. Ba chạm fail-closed của `bcdb360` không có ca (F-2, F-4) |
| 38, 39 | JSONB, pool | Không áp dụng | |
| 40 | Outbox | Không áp dụng | Không side-effect có nghĩa vụ nghiệp vụ |
| 41 | RLS `SET LOCAL`, `USING` + `WITH CHECK`, `FORCE` | Đạt | Không policy mới; hàm 022 ghim `row_security = off` để **báo lỗi** thay vì thấy rỗng (G11) |
| 42 | Đúng cấu trúc thư mục | Đạt | `src/server`, `migrations`, `migrations/rollback`, `tests`, `docs` |
| 43 | Không schema hay mẫu tích hợp mới khi chưa có ADR | Đạt | Một trigger và một hàm trong schema `intelligence` có sẵn, theo quyết định OQ-45 điểm 3 (b); không bảng mới |
| 44 | Python | Không áp dụng | |
| 45 | AI chỉ ghi Z4; người duyệt trước khi vào Z1 | Đạt | Role AI không được cấp thêm gì (G8; `GRANT` vắng trong 022 — G12). Hàm 022 **đọc** một bảng Z1 thay cho role AI và trả một bit (R4); không ghi Z1 |

**PR discipline.** `#fact` Mười hai commit đều đúng dạng `<type>(<scope>): <description>`; ngoại lệ về nghĩa ở F-7. PR chưa mở nên chưa có tiêu đề và mô tả để soát: cần WHY → WHAT → HOW → TESTING, đích là `libetech-ai-os`, và câu «commit ≠ release»: PR chỉ thêm mã và một tệp migration vào repo; 022 chưa áp ở đâu ngoài CSDL thử; Z4 chưa bật.

---

## 5. Điều phải vào biên nhận mà kế hoạch và các báo cáo chưa nêu

1. **Login runtime cũng phải ở READ COMMITTED.** R21 và mục 8 chỉ nói login của pipeline. `#inference` Bước giữ của `decide` cho nháp tài liệu dựa vào việc câu đọc sau khoá dòng thấy commit của bên kia (hai ca thứ tự chứng minh điều này dưới READ COMMITTED). Dưới REPEATABLE READ, `FOR UPDATE` trên dòng vừa bị bên kia sửa sẽ ra lỗi tuần tự hoá thô (đóng, nhưng không phải `DRAFT_HELD`). `src/server/db.ts` không đặt mức cô lập; nó thừa hưởng mặc định của login.
2. **Ba chạm ở `src` của `bcdb360` không có ca ghim** (F-2, F-4): `row?.hidden!==false`, `toView` tự sắp, `toView` tự thêm `SCHEMA_INVALID`. Biên nhận không nên gọi chúng là «đã kiểm».
3. **Bằng chứng đột biến có cho 7 kịch bản; phần còn lại là «đọc thấy sẽ đỏ».** Có đột biến: D2, Q5 (i), T9, T10, T11, T12, T14. Không có: L3, L4, L6, M10, Q5 (ii), D7, D8, S1 và hai ca thứ tự. Log đột biến là lời khai của builder (chạy trên PGlite), không ai chạy lại.
4. **Mục 2 của «Dừng và chỗ chưa chắc» đã đóng, kế hoạch 0.4 chưa ghi.** Thứ tự «trigger trước RLS, trước ràng buộc, trước phép dò trùng» nay có bằng chứng PostgreSQL 16: `fix1a-native-verbose.txt:201-211` (G5, G7, G9, G11, G14, G15).
5. **Hệ quả vận hành của OQ-46 (b), nên có một câu rõ:** xác nhận một nháp tài liệu tạo bản mới, nên **mọi nháp đang chờ khác của cùng tài liệu** (nêu bản cũ) từ đó chỉ còn từ chối được. Với nháp ứng viên: mỗi tin mới của luồng làm mọi nháp đang chờ của luồng đó hết xác nhận được. B5 kéo theo điều này nhưng không viết ra.
6. **Số ca mong đợi ở đầu nhánh: 1 245** (mục 3). Biên nhận ghi con số thật cạnh con số này.
7. **Bằng chứng chưa nằm trong git.** `#fact` 32 tệp `.txt` của `docs/reviews/oq-45-46-evidence-20261118/` là tệp chưa theo dõi ở `f36e947`. Tôi đã dò: không đường dẫn máy, không URL CSDL, không mẫu bí mật. Biên nhận chỉ trích được sau khi chúng được commit.
8. **Hai dòng «Chưa có mã cho quyết định này» vẫn còn ở đầu nhánh** (`docs/OPEN-QUESTIONS.md:671`, `:687`). Mục 11 của «Dừng và chỗ chưa chắc» đã giao việc này cho phiên chính nhưng ở `f36e947` chưa làm. Nếu merge như hiện tại, cây mã vừa chứa mã của quyết định vừa nói là chưa có.
9. **Không có CI.** Mọi cổng của PR này là lượt chạy tại máy cộng review. Biên nhận không nên dùng chữ «CI xanh».
10. **T3-M4:** thêm dòng «`decide` đọc dòng không nội dung cho người không có quyền quyết định» vào danh sách «trước khi thêm tuyến» (mục 1 của báo cáo này).
11. **F-10:** `MANAGER_REQUIRED` và `CONFIRM_AUTHORITY_REQUIRED` là cùng một điều kiện ở hai bề mặt.

---

## ⚠️ Không kiểm được

1. **Lượt toàn bộ ở đầu nhánh** (PGlite và PostgreSQL 16), `npm run typecheck`, `npm run build`, coverage: đang chạy khi review, và tôi không được chạy. Mọi câu «xanh» trong báo cáo này dựa trên log của các lượt **trước** `f36e947` (`interim-*-5013f75.txt`, `fix1a-*`, `fix1b-*`) và trên việc đọc mã. `f36e947` chỉ đổi tài liệu nên `#inference` kết quả của `bcdb360` giữ nguyên, nhưng chưa có log nào của cả bộ ở `bcdb360`.
2. **Typecheck sau đợt sửa:** kiểu của `toView`, `present`, `subjectReasons` đọc thấy khớp; chưa có kết quả `tsc`.
3. **Các đột biến:** không chạy lại (mục 5.3).
4. **Kế hoạch truy vấn** của hai câu đọc luồng và `DOC_SUBJECT_SQL` trên PostgreSQL 16: chưa có `EXPLAIN`.
5. **Tiêu đề và mô tả PR:** PR chưa mở.
6. **Hành vi dưới mức cô lập khác READ COMMITTED của login runtime** (mục 5.1): suy luận, chưa đo.

---

## Kết luận

Không có finding P0 hay P1. Mười bảy finding thuộc mã và ca kiểm của các review theo task đều đã được trả lời; bốn mục đóng bằng cách mỏng hơn cách reviewer nêu (T3-M5, 4ab-N1, 4ab-I1 phần (ii), SEC-M5) và được ghi thành F-2, F-4, F-5. Finding P2 duy nhất (F-1) là rủi ro bảo trì trên một bất biến bảo mật; nên sửa cùng lượt mã của OQ-53 và OQ-55, không cần trước cổng. Các ca hiện có bị sửa khớp H1–H6 và K1–K3; ca canh tuyến và bốn ca canh role AI nguyên vẹn. Kết luận dưới đây **có điều kiện**: bốn lượt đang chạy ở mục ⚠️ 1 phải xanh, với tổng số ca là 1 245; một lượt đỏ thì kết luận này không còn giá trị. Đây là khuyến nghị cho Chairman, không phải phê duyệt.

VERDICT: READY FOR GATE
