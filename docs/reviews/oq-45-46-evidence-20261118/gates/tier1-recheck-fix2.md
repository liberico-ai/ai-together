# Soát lại có phạm vi — đợt sửa 2 (`f36e947..383c394`)

- Vai: reviewer mã (`liberico-code-reviewer`). **Khuyến nghị cho Chairman, không phải phê duyệt.**
- Phạm vi: đúng một commit, `383c394`, năm tệp (`src/server/source-text.ts`, `src/server/suggestions.ts`, `tests/source-text.test.ts`, `tests/suggestions.test.ts`, `tests/z4-pointer-guard.test.ts`). Lỗi mới chỉ được báo khi nằm trong diff này.
- Cách làm: chỉ đọc. Đã đọc trọn `.superpowers/sdd/oq-45-46-ai-drafts/review-fix2-f36e947..383c394.diff`, yêu cầu của đợt sửa, lời khai của builder, `fix2-mutations.txt`, `fix2-green.txt`, `final-pglite.txt`, `final-typecheck.txt`, các mục N-2…N-4 của `tier1-database.md`, P3-1…P3-4 và P3-8 của `tier1-security.md`, mục «Sau ba lượt review tầng 1 trên cả nhánh» của kế hoạch, và các đoạn tương ứng của năm tệp ở `383c394`. **Không chạy ca kiểm, không nối CSDL, không ghi git.**
- Nhãn: `#fact` = đọc được trong mã, diff hoặc log; `#inference` = suy ra từ đọc, chưa chạy.

## Tóm tắt

| Mục | Kết quả |
|---|---|
| Mười mục cần phán | ADDRESSED 9 · NOT ADDRESSED 1 (SEC-M6: phép so thân hàm ở G12 luôn đúng) |
| Finding mới trong diff | P0: 0 · P1: 0 · P2: 1 · P3: 3 |
| Các mục cố ý không làm | Phán quyết để lại đều đứng được |
| Chưa kiểm được | Lượt PostgreSQL 16 ở `383c394`; nửa mới của G17 chưa từng chạy ở đâu |

---

## 1. Phán từng mục

`tệp:dòng` là ở `383c394`.

| # | Mục | Phán | Chỗ trả lời | Căn cứ |
|---|---|---|---|---|
| 1 | CSDL N-2 · bảo mật P3-2 — nửa READ COMMITTED của G17 | **ADDRESSED** (mã); chưa có lượt chạy | `tests/z4-pointer-guard.test.ts:286-303` | `#fact` Nửa đó nay dùng `ids.sales`; ca khẳng định dự án **không có dòng ánh xạ nào** ngay trước khi mở giao dịch (`:300`). Trong giao dịch: role AI, ngữ cảnh, một câu `SELECT` (`:288-295`), rồi `mapDomain` commit qua kết nối khác, rồi mới chèn → chờ `LTZ01` (`:301`). Đây đúng là điều N-2 đòi: ánh xạ commit **sau** câu lệnh đầu của giao dịch vẫn được thấy. Có dòng chú thích vì sao chỉ native (`:286`). `#fact` Ca bị bỏ qua trên PGlite (`fix2-green.txt`), builder không chạy được: **chưa có log nào của nửa mới** — xem ⚠️ 1 |
| 2 | CSDL N-3 — G16 | **ADDRESSED** | `tests/z4-pointer-guard.test.ts:260-275` | `#fact` Vòng lặp có `READ UNCOMMITTED`; ở REPEATABLE READ chạy thêm dự án `ids.transport` đã ánh xạ `IBS_HI` (`:261`, `:263`), và `check` đòi đúng `LTZ02` cùng câu chữ. `#inference` Đổi thứ tự hai phép kiểm trong hàm cho `LTZ01` ở lượt đó → đỏ. Xanh trên PGlite |
| 3 | CSDL N-4 — `IS NOT TRUE` và ca T15 | **ADDRESSED** | `src/server/source-text.ts:118`; `tests/source-text.test.ts:315-332` | (a) `#fact` Câu lệnh nay là `(t.id = ANY($3::uuid[])) IS NOT TRUE`. Với mảng không có NULL, kết quả y như cũ. **Không ca nào ghim** — xem F-R4. (b) `#fact` T15 dựng một tin và bản sửa số 2 của nó trong một giao dịch, tự khẳng định hai dòng cùng `created_at` (`:330`), nêu tin đó → `laterEdit:true`. Có đột biến đỏ vì `AssertionError` (`>=` thành `>`; `fix2-mutations.txt`). T15 ghim đúng `>=` của dòng `later_edit` |
| 4 | Bảo mật P3-1 (SEC-M6) — G12 so cả thân hàm | **NOT ADDRESSED** | `tests/z4-pointer-guard.test.ts:199-204`, đối chiếu `:178` | Phép so có trong ca nhưng **không thể sai** — xem F-R1. Bảy đoạn cũ vẫn được ghim như trước (`:197-198`); mức bảo vệ không kém đi, cũng không thêm |
| 5 | Bảo mật ⚠️ 3 (P3-3) — `MERGE` dưới role AI | **ADDRESSED** trên PGlite; PostgreSQL 16 đang chờ | `tests/z4-pointer-guard.test.ts:318-324` | `#fact` Cùng câu `MERGE` chạy trong `asAi` với ngữ cảnh của dự án `IBS_HI`: `LTZ01`, số dòng giữ nguyên. Nửa của login vận hành không đổi. `LTZ01` chỉ do guard ném, nên không cần đối chứng dương riêng |
| 6 | Mã F-1 — ca đi qua mọi `MaskReason` | **ADDRESSED** | `tests/suggestions.test.ts:1033-1081` | Xem mục 2 |
| 7 | Mã F-2 — Q10 | **ADDRESSED** | `tests/source-text.test.ts:216-219` | `#fact` `Queryable` giả trả `rows:[]`, hai mã đúng dạng → `true`. Có đột biến đỏ (`!==false` về `===true`). Ba dòng `===true` của `threadFreshness` không cần ca: `#inference` thiếu dòng thì theo cách viết nào nháp cũng bị giữ (`SUBJECT_BASELINE_MISSING`, hoặc `SUBJECT_CHANGED` kèm `SUBJECT_EDIT_UNVERIFIED`) |
| 8 | Mã F-5 — S1 dùng danh sách cho phép | **ADDRESSED** | `tests/suggestions.test.ts:1105-1106` | `#fact` `Object.keys(e).sort()` bằng đúng `['code','status']`; phép `cause` giữ nguyên. Chặt hơn hẳn danh sách chín tên cũ |
| 9 | Mã F-6 — Q11 | **ADDRESSED** | `tests/source-text.test.ts:221-226` | `#fact` Principal có phạm vi cả hai dự án: hỏi bằng dự án kia → `false`, bằng dự án của ứng viên → `true`. `#inference` Bỏ cả ba điều kiện dự án ở `src/server/source-text.ts:91` → `true` → đỏ; bỏ một trong ba thì hai điều kiện còn lại vẫn chặn (cùng độ mạnh với T12). Không có đột biến ghi lại; yêu cầu của đợt sửa không đòi |
| 10 | Mã F-3, F-8 · bảo mật 4ab-N6 (c) — ba chú thích | **ADDRESSED**, còn một chỗ chưa đúng hẳn | `src/server/suggestions.ts:137`, `:191`, `:211`, `:298`; `tests/suggestions.test.ts:24` | `#fact` F-3: chú thích của `submitDraft` nay nói đúng thứ gì bị từ chối trước CSDL và thứ gì do câu lệnh trả lời. 4ab-N6 (c): hai nơi thêm `THREAD_TEXT_HIDDEN` đều có «a document draft has no equivalent check: OQ-55». F-8: nhãn «(P3)» đã bỏ; G17 có chú thích native. Chú thích cạnh `vi.mock` đã đổi nhưng nói sai về M6 — xem F-R2 |

`#fact` `src/server/suggestions.ts` vẫn không chứa tên bảng bản sửa hay `text_excerpt`. Ngoài các chỗ nêu trên, không `expect` nào của ca có sẵn bị đổi: vòng lặp G16 là tập cha của vòng cũ; S1 chỉ thay một dòng bằng dòng chặt hơn.

## 2. Mã F-1 — ca đi qua mọi `MaskReason`

**Có ghim «bị che lúc đọc thì bị giữ lúc xác nhận» cho cả sáu mã không: có.**

- `#fact` Với từng mã, ca làm bốn việc (`tests/suggestions.test.ts:1070-1079`): đọc bằng `pm` và đòi `maskReasons` **chứa đúng mã đó**; đòi `value` là `null`; xác nhận với đúng `valueHash` và đòi `DRAFT_HELD` 422; đòi câu giữ **chứa đúng mã đó**; đòi không có dòng quyết định nào.
- `#inference` Phép «câu giữ chứa đúng mã đó» là chỗ làm ca đứng vững. Vài nháp trong ca bị giữ vì hơn một lý do (nháp `SCHEMA_INVALID`, `SOURCE_OUT_OF_CONTEXT` và `THREAD_TEXT_HIDDEN` còn dính `SUBJECT_BASELINE_MISSING`). Nếu bước giữ của `decide` thôi nêu mã đang xét thì nháp vẫn bị giữ vì lý do kia, nhưng phép «chứa» đỏ. Tôi đã lần từng mã: gỡ phép tương ứng ở `src/server/suggestions.ts:294-299` thì hoặc lệnh xác nhận đi tiếp (không còn `DRAFT_HELD`), hoặc câu giữ thiếu mã; cả hai đều đỏ. Gỡ ở phía `present` thì phép `maskReasons` đỏ.
- `#fact` Thứ tự chạy an toàn: `POINTER_ONLY_PROJECT` đứng cuối vì dòng ánh xạ nó thêm sẽ che mọi nháp khác của dự án (`:1061-1067`).
- Ngoài phạm vi của ca, đã biết: khi không dựng được ngữ cảnh, phía đọc có thể nêu thêm mã mà phía xác nhận không nêu (R29). `CONFIRM_AUTHORITY_REQUIRED` được loại có chủ đích; L6 và L8 giữ phần đó.

**Một mã mới thêm vào kiểu có buộc phải thêm vào ca không: có, qua `npm run typecheck`.**

- `#fact` `setups` có kiểu `Record<Exclude<MaskReason,'CONFIRM_AUTHORITY_REQUIRED'>,…>` (`:1035`, `:1041`). Thêm một thành viên vào `MaskReason` mà không thêm cách dựng thì `tsc` báo thiếu thuộc tính. `tsconfig.json` gồm `**/*.ts`, tức cả `tests/`; `final-typecheck.txt` ghi mã thoát 0 ở `383c394`.
- `#fact` Phép so với mảng sáu tên (`:1069`) so **khoá của `setups`** với mảng, không so với kiểu (kiểu không tồn tại lúc chạy). Tự nó không phát hiện mã mới; nó buộc người thêm cách dựng phải sửa cả mảng. Lực ép thật là `tsc`, và `vitest` không chạy `tsc`. Repo không có CI, nên lực ép này ở mức «ai đó chạy typecheck» — như mọi cổng khác của PR.
- `#inference` Lỗ còn lại vô hại: một mã của cổng đầu ra được thêm vào tập `VISIBILITY` (`src/server/suggestions.ts:81`) thành mã che mà không qua kiểu (`as MaskReason` ở `:209`); nhưng bước giữ cộng **mọi** mã của cổng (`:297`), nên mã như vậy tự động bị giữ. Mã che không đến từ cổng thì phải vào `Set<MaskReason>` (`:199`), tức phải vào kiểu.

Phần «gộp hai bản cổng thành một hàm» của F-1 được để lại cho lượt mã của OQ-53 và OQ-55 — xem mục 4.

---

## 3. Finding mới trong diff này

**F-R1 · [P2] `tests/z4-pointer-guard.test.ts:199-204` — phép so thân hàm của G12 không thể sai**
- `#fact` Dòng `:178` của chính ca này chạy tệp 022 hai lần (`CREATE OR REPLACE FUNCTION`). Dòng `:203` đọc `prosrc` **sau** đó, rồi `:204` so với phần giữa `AS $$` và `$$;` của **cùng tệp vừa chạy**. Hàm trong CSDL lúc ấy luôn là thân của tệp. `shape()` (`:168-176`) không chứa thân hàm, nên phép «chạy lại không đổi gì» ở `:179` cũng không thấy thân.
- Kịch bản của P3-1 còn nguyên: migration 023 `CREATE OR REPLACE` hàm, giữ bảy đoạn cũ, thêm một câu `EXECUTE` hoặc một thông điệp có `NEW.project_id`. Harness áp 001…023; G12 chạy lại 022 và ghi đè thân của 023; bảy đoạn khớp; `:204` khớp. Ca xanh. Sửa thẳng thân hàm trong tệp 022 cũng xanh, vì hai vế đổi cùng nhau.
- `#fact` Yêu cầu của đợt sửa ghi «Mutation: none needed (a different body is a different string)» và builder không chạy đột biến nào cho mục này. Câu đó đúng với hai chuỗi độc lập; ở đây vế phải được tạo từ vế trái ngay trước phép so.
- Hệ quả hôm nay: không có (chưa có 023; bảy đoạn vẫn được ghim). Hệ quả cho hồ sơ: kế hoạch đang ghi đợt sửa 2 gồm «G12 so cả thân hàm với tệp migration»; SEC-M6 vẫn ở mức «khép một phần» như `tier1-security.md` đã phán.
- Sửa (chỉ ca kiểm, hai dòng): đọc `prosrc` **trước** `:178` và so giá trị đó với thân trong tệp; hoặc thêm `p.prosrc` vào truy vấn `functions` của `shape()` để `:179` phủ luôn thân hàm. Cả hai cách làm kịch bản 023 đỏ. Trên CSDL native giữ migration đã áp, cách này còn bắt được trường hợp tệp 022 bị sửa sau khi đã áp (đúng mối lo của CSDL N-1). Đột biến để chứng minh: tạm `CREATE OR REPLACE` hàm với một dòng thừa ở đầu ca → đỏ. Muốn ghim cả việc sửa tệp 022: so thêm sha256 của thân với một hằng trong ca.
- **Không chặn cổng** nếu hồ sơ ghi đúng trạng thái. Nên sửa trước cổng: `docs/reviews/CODEX-REVIEW-PROMPT.md` mục 5 soát đúng loại này («không assert rỗng»).

**F-R2 · [P3] `tests/suggestions.test.ts:24` — chú thích cạnh `vi.mock` vẫn chưa đúng**
- `#fact` Chú thích mới xếp M6 vào «các ca đọc ngữ cảnh được dựng cho principal nào … look at its calls», và giữ câu «wrapped, not replaced». M6 (`:969-972`) không đọc lời gọi nào: nó cho bộ dựng **ném lỗi một lần** (`mockRejectedValueOnce`), tức thay hành vi.
- Sửa: «…the confirmation case and M5 look at its calls; M6 makes it reject once».

**F-R3 · [P3] `tests/z4-pointer-guard.test.ts:252` — tên G16 không theo kịp thân ca**
- `#fact` Tên vẫn là «REPEATABLE READ and SERIALIZABLE are answered LTZ02 whatever the project»; thân nay thử cả `READ UNCOMMITTED` (`:262`). Ai đọc danh sách ca sẽ không biết mức đó đã được ghim.
- Sửa: thêm «READ UNCOMMITTED» vào tên. Phần «ghi vào ghi chú triển khai rằng mặc định của login phải đúng là `read committed`» của N-3 (a) là việc hồ sơ của phiên chính.

**F-R4 · [P3] `src/server/source-text.ts:118` — thay đổi duy nhất ở mã sản phẩm không có ca ghim**
- `#fact` Builder nêu thẳng: bộ lọc ở `:110` bỏ mọi phần tử không phải uuid chữ thường trước câu lệnh, và câu lệnh không được xuất, nên không ca nào đưa được một phần tử NULL qua hàm. Hoàn nguyên về `NOT (…)` thì cả bộ vẫn xanh.
- Lý do đó đứng được; thay đổi đúng hướng đóng và không đổi hành vi nào tới được. Cùng lớp với ba chạm fail-closed của `bcdb360` (F-2, F-4 của `tier1-code.md`).
- Sửa (tuỳ chọn): một ca dùng `Queryable` ghi chữ câu lệnh, đòi chữ đó chứa `IS NOT TRUE` và không chứa `NOT (t.id = ANY` — ghim theo chữ, như bảy đoạn của G12. Tối thiểu: biên nhận ghi «đã viết lại cho đóng, không ghim được bằng ca», không ghi «đã kiểm».

---

## 4. Các mục cố ý không làm — phán quyết để lại có đứng được không

| Mục | Xử lý của phiên chính | Phán |
|---|---|---|
| F-1 phần gộp thành một hàm | Cùng lượt mã của OQ-53 và OQ-55 | **Đứng được.** Đúng khuyến nghị của `tier1-code.md`. Ca ở mục 2 giữ bất biến trong lúc chờ. Lần đọc luồng thứ hai trong một lệnh xác nhận nháp ứng viên còn đó; chỉ là một câu đọc thừa |
| F-4 hai nhánh không tới được | Ghi trong kế hoạch | **Đứng được.** Không đổi hành vi. Khi đọc coverage, hai nhánh này nằm trong số chưa phủ |
| F-7 loại commit của `bcdb360` | Ghi ở mô tả PR | **Đứng được**, với điều kiện mô tả PR có câu đó (PR chưa mở) |
| F-9 import thừa, hằng được xuất, `dec_key` | Không làm | **Đứng được.** Import và `dec_key` có từ gốc; hằng được xuất theo kế hoạch |
| F-10 một kiểu chung cho mã lý do | Không làm | **Đứng được.** Biên nhận nên có câu: `MANAGER_REQUIRED` và `CONFIRM_AUTHORITY_REQUIRED` là một điều kiện ở hai bề mặt |
| F-11 mã ca không nằm trong tên ca | Không làm | **Đứng được** nếu biên nhận chép «Bảng: yêu cầu → ca» theo **tên ca**. Bốn ca mới của đợt này có mã trong tên (Q10, Q11, T15, P3) |
| Bảo mật P3-8 — `decide` đọc dòng không nội dung khi người gọi không có quyền | Điều kiện 15 của danh sách «trước khi thêm tuyến» | **Đứng được.** Đúng nửa còn lại của R25 mà T3-M4 để ngỏ |

Hai ý nhỏ của `tier1-code.md` không được làm và cũng không được ghi lại; cả hai vô hại. Một: nửa `DOC_SUBJECT_SQL` của F-6 (không có ca hỏi chéo dự án; câu lệnh còn `v.document_id=$2` và chỉ chạy sau khi `decide` đã thu phạm vi về một dự án). Hai: câu về ranh giới tenant lặp ở `src/server/source-text.ts:103` và `:105`.

---

## ⚠️ Không kiểm được

1. **Lượt PostgreSQL 16 ở `383c394` đang chạy; tôi không được chạy.** Hệ quả cụ thể:
   - Nửa READ COMMITTED mới của G17 **chưa từng chạy ở đâu** (PGlite bỏ qua). Mục 1 được phán ADDRESSED theo đọc mã; phải có dòng `✓ … G17 …` trong log native của `383c394` mới gọi là có bằng chứng.
   - `MERGE` dưới role AI (G18), `READ UNCOMMITTED` (G16) và các dòng chèn thô của T15 mới xanh trên PGlite. Hành vi của `MERGE` dưới RLS và chuỗi `read uncommitted` trên PostgreSQL 16 là điều hai reviewer kia ghi «suy luận».
   - Một ca đỏ ở lượt đó làm kết luận dưới đây hết giá trị.
2. **Hai đột biến (T15, Q10) là lời khai của builder trên PGlite**; không ai chạy lại. Mục 3 (a), 4, 5, 6, 8, 9, 10 không có đột biến; riêng mục 4 thì không đột biến nào làm đỏ được (F-R1).
3. **Số ca.** `#fact` `final-pglite.txt` ở `383c394`: 1 184 đạt, 65 bỏ qua, tổng 1 249, mã thoát 0. Khớp con số tôi tính trước cho `bcdb360` (1 245) cộng bốn ca mới (Q10, Q11, T15, P3).
4. **Một ca chập chờn ngoài diff.** `#fact` `final-pglite-run1-one-flake.txt` (mã ở `bcdb360`) ghi 1 ca đỏ trên 1 245: `tests/review-delegations.test.ts:537`, thứ tự «mới nhất trước» của hai dòng. Tệp đó và mô-đun của nó không bị nhánh chạm; lượt ở `383c394` xanh. Tôi không soát nguyên nhân (ngoài phạm vi); nêu ra để biên nhận không gọi lượt PGlite là «xanh ngay lần đầu».
5. **Typecheck:** `#fact` `final-typecheck.txt` ghi `tsc --noEmit` thoát 0 ở `383c394`. Tôi đọc log, không chạy.

---

## Kết luận

Chín trên mười mục được trả lời đúng điều reviewer đòi; ca đi qua sáu `MaskReason` thật sự ghim bất biến «bị che thì bị giữ» với cùng mã, và một mã mới bị buộc vào ca qua `tsc`. Mục còn lại, SEC-M6, chưa khép: phép so thân hàm thêm vào G12 luôn đúng vì ca tự chạy lại tệp 022 ngay trước khi so (F-R1, P2). Không có P0 hay P1; đợt sửa không làm hành vi nào kém đi, và thay đổi duy nhất ở mã sản phẩm là một phép so được viết lại theo hướng đóng. Các mục cố ý không làm đều có chỗ ghi và phán quyết đứng được.

Kết luận dưới đây **có điều kiện**: (1) lượt PostgreSQL 16 ở `383c394` xanh, có dòng của G17; (2) SEC-M6 hoặc được sửa bằng hai dòng nêu ở F-R1, hoặc hồ sơ (kế hoạch, biên nhận) ghi đúng là «vẫn khép một phần» thay cho «G12 so cả thân hàm». Tôi khuyên cách thứ nhất, vì cổng soát đúng loại khẳng định không thể sai. Đây là khuyến nghị cho Chairman, không phải phê duyệt.

VERDICT: READY FOR GATE
