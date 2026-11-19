VERDICT: READY_FOR_GATE

# Review CSDL (tầng 1, soát truy vấn và mã dịch vụ) · OQ-53 Task 3–8

Đối tượng: nhánh `feat/oq-53-subject-verification`, đầu `26ba304` (gốc `80c1ad8`), phần `src` của `git diff 80c1ad8..26ba304`: `src/server/source-text.ts` (`threadFreshness`, `visibleThreadMessages`), `src/server/skill-context.ts` (câu SQL các bản của tài liệu cho `release_librarian`), `src/server/suggestions.ts` (`decide`, `present`, `subjectReasons`, dịch `LTZ03`), cùng các ca kiểm của chúng. Ghế: review CSDL, độc lập. Migration 023 không soát lại (đã qua hai vòng); chỉ dùng nó để biết chỉ mục, khoá, quyền. Kế hoạch bản 0.3, mục 8, 9, 13 (Task 3–8), 16 (N7, N11), 17.

| Mức | Số finding |
|---|---|
| P0 | 0 |
| P1 | 0 |
| P2 | 1 (SV-DB-1) |
| P3 | 3 (SV-DB-2 … SV-DB-4) |

Một câu: truy vấn đúng ở mọi hình dạng dữ liệu tôi dựng (luật 1–4, các hình dạng của `release_librarian`, kiểu, phạm vi dự án, thứ tự xác định), thời gian giữ khoá của `decide` sau P13 đo được 2,3–2,7 ms (trước P13: 32–34 ms) và sau lệnh ghi không còn câu nào chạm bảng tin; một vấn đề hiệu năng thật nhưng không chặn: luật 2 của `threadFreshness` tốn theo tích «số cặp × độ dài luồng» (153–162 ms ở luồng 3 000 tin với 20 cặp, 4,4 giây ở luồng 20 000 tin với 100 cặp), sửa một câu, kết quả y hệt, nhanh hơn 10–45 lần (đo).

## 0 · Cách làm và giới hạn

- Hai CSDL riêng của phiên, PostgreSQL 16.15 (container thử), migration 001–023 áp bằng harness của repo, **đã `DROP` cả hai cuối phiên** (kiểm lại: không còn CSDL mang tên đó). Không áp migration lên CSDL khác, không tạo/đổi role, mật khẩu, quyền. Một CSDL cho dữ liệu giả và EXPLAIN, một CSDL cho các lần chạy vitest native (harness `TRUNCATE` dự án).
- Dữ liệu giả cho EXPLAIN dựng bằng `INSERT … SELECT generate_series` **với trigger cấp số của 023 bật** (nên số, dòng đếm là của chính trigger thật), qua login vận hành: 2 tenant, 5 dự án. Dự án lớn: 2 000 luồng × 30 tin = 60 000 tin, 84 019 bản. Luồng dài: một luồng 3 000 tin, 7 378 bản (60 % có sửa, tới 5 bản). Luồng rất dài: một luồng 20 000 tin, 36 260 bản. Dự án nhiễu 20 000 tin, và một tenant khác 10 000 tin. Tổng 162 075 bản, 3 502 luồng; kiểm sau khi nạp: 0 bản không có số, 0 luồng mà `last_seq` khác `max(thread_seq)` hay `count`.
- Mọi EXPLAIN chạy dưới `SET LOCAL ROLE libetech_runtime` với `app.tenant_id`, `app.project_ids` đặt như `scoped()` (RLS bật thật), lần thứ hai (ấm), kế hoạch tuỳ biến (như `pg` gửi câu không tên); với `threadFreshness` tôi chạy lại bằng `plan_cache_mode = force_generic_plan`: cùng thời gian. Số là cỡ độ lớn: máy dùng chung, tải 2–2,6.
- Câu SQL của EXPLAIN chép nguyên từ `src` (đã thay `${LATEST_REVISION_ORDER}`, `${visibleColumnsSql…}`); câu «đề xuất» là câu tôi viết, chưa vào repo.
- Đã chạy native (16.15), tất cả xanh: `tests/thread-order.test.ts` 30/30, `tests/thread-order-concurrency.test.ts` 24/24 (có N12–N15), `tests/source-text.test.ts` 39/39, `tests/skill-context.test.ts` 22/22, `tests/suggestions.test.ts` 120/120, `tests/suggestions-concurrency.test.ts` 9/9. Mỗi tệp một lần, chạy trên bản sao `git archive 26ba304` đặt ngoài repo (trừ lần đầu của `thread-order.test.ts`, chạy ở worktree chỉ để áp migration).
- Đột biến: chỉ trên bản sao ngoài repo, khôi phục sau mỗi lần; kết quả ở mục 3. `git status` của worktree chỉ có tệp báo cáo này và tệp của ghế khác.
- **Một lỗi quy trình của tôi, nói rõ:** lần chạy vitest đầu tiên của ca đo thời gian giữ khoá (`zz-lockhold`, tệp của tôi trong bản sao) tôi chạy khi `pgrep -f '[v]itest'` báo 6 tiến trình của ghế khác, trái dặn «phải 0». Nó dùng CSDL riêng của tôi nên không đụng dữ liệu ai; từ đó mọi lần chạy đều qua một bộ chờ «đếm = 0 mới chạy».
- Không phủ (#inference): SERIALIZABLE ngoài `LTZ02`/`40001` đã có ca; kế hoạch của PGlite (PostgreSQL 18.6) chưa EXPLAIN (ca kiểm xanh ở cả hai engine); dữ liệu thật; pooler ở chế độ transaction.

## 1 · Finding

| Mã | Mức | Vị trí | Tóm tắt |
|---|---|---|---|
| SV-DB-1 | P2 | `src/server/source-text.ts:148-150`, `:155` | Luật 2 (`not_latest`) tốn «số cặp × số tin của luồng»: CTE `latest` bị chèn thẳng, mỗi cặp chạy lại phép dò bản mới nhất cho **mọi** tin của luồng. 153–162 ms (3 000 tin, 20 cặp), 698 ms (100 cặp), 959 ms và 4 374 ms ở luồng 20 000 tin |
| SV-DB-2 | P3 | `src/server/skill-context.ts:92` | Câu «bản mới nhất» của `release_librarian` là SubPlan tương quan chạy một lần cho mỗi bản của tài liệu: 11,4 ms ở tài liệu 5 000 bản (câu cho ba kỹ năng khác, cùng tài liệu: 0,05 ms); tài liệu thật vài chục bản: không đáng kể |
| SV-DB-3 | P3 | `tests/source-text.test.ts:310-575`, kế hoạch N7, Task 9 | Không ca nào chạm quy mô (luồng lớn nhất 22 tin, tối đa 5 cặp), nên SV-DB-1 vô hình với bộ ca; và số của cổng ở N7 («21 ms cho luồng 3 000 tin») là của câu khác, không phải câu thật (thật: 153–162 ms) |
| SV-DB-4 | P3 | `src/server/source-text.ts:63-80`, `:99-114` (có trước PR, không thuộc diff) | Ghi nhận cho N7: `visibleThreadMessages` dò bản mới nhất của **mọi** tin của luồng trước khi `LIMIT 20` (17 ms ở 3 000 tin, 97 ms ở 20 000); `projectHasHiddenText` quét cả dự án (≈ 30 ms ở 60 000 tin) và chạy hai lần mỗi lệnh xác nhận. Cả hai chạy **trước** lệnh ghi, ngoài thời gian giữ khoá |

### SV-DB-1 · P2 · `threadFreshness`, luật 2 tốn theo tích «số cặp × độ dài luồng»

**Vị trí.** `src/server/source-text.ts:148-150` (CTE `latest`) và `:155` (`EXISTS(SELECT 1 FROM stated s WHERE NOT EXISTS(SELECT 1 FROM latest l WHERE l.event_id=s.event_id AND l.revision_no=s.no)) AS not_latest`).

**Lỗi.** `latest` chỉ được tham chiếu một lần nên PostgreSQL chèn nó thẳng vào câu (không vật hoá). Phép nối `l.event_id=s.event_id` không đẩy xuống được vào lateral (nó đi qua CTE `thread` đã vật hoá, không có chỉ mục), nên kế hoạch là `Nested Loop Anti Join` mà phía trong là «mọi tin của luồng, mỗi tin một lần dò chỉ mục để lấy bản mới nhất», **chạy lại cho từng hàng của `stated`**. Với 20 cặp và luồng 3 000 tin: `loops=20` × `rows=2 990` = 59 810 lần dò, `Rows Removed by Join Filter: 59 790`, 277 026 lần chạm trang chỉ trong riêng nhánh đó; tổng 320 695 lần chạm trang.

**Kịch bản và số đo** (PostgreSQL 16.15, role runtime, thời gian chạy của câu, ms; «đề xuất» ở dưới):

| luồng | cặp | câu hiện tại | câu đề xuất |
|---|---|---|---|
| 30 tin (trong dự án 60 000 tin) | 20 / 30 | 0,96 / 1,08 | 0,29 / 0,38 |
| 3 000 tin, 7 378 bản | 20 | 153–162 | 16–17 |
| 3 000 tin | 100 | 698 | 19 |
| 20 000 tin, 36 260 bản | 20 | 959 | 96 |
| 20 000 tin | 100 | 4 374 | 97 |

100 là trần của `messageRevisions` (`.max(100)`), đạt được bằng 100 cặp phân biệt `(tin, số bản)` (`namedRevisions` chỉ gộp cặp trùng cả hai trường). Ở tốc độ đo (≈ 2,2 µs mỗi lần dò), 100 cặp chạm `statement_timeout` 10 giây của pool (`src/server/db.ts:32`) ở luồng khoảng 45 000 tin, và ngoài lệnh xác nhận chỉ còn lỗi `57014` thô. Câu này chạy **trước** lệnh ghi quyết định (không giữ khoá luồng), nên N11 không bị chạm; cái bị chạm là độ trễ của người xác nhận và điều kiện N7 («`EXPLAIN` trên luồng dài»). Luồng thực tế là chuỗi trả lời (`threadKey`), thường vài chục tin: không có hại trong vận hành hôm nay. Vì vậy P2, không phải P1.

**Cách sửa** (một câu, bỏ CTE `latest`; kết quả đã đối chiếu trùng ở 7 biến thể: đúng số, số 99 không có, số 1 cũ, toàn số 1, không cặp, cặp lặp kèm số khác, tin được nêu không có cặp):

```sql
EXISTS(SELECT 1 FROM stated s
        WHERE s.no IS DISTINCT FROM (SELECT r.revision_no FROM source_event_revisions r
                                      WHERE r.source_event_id=s.event_id AND r.project_id=$1::uuid
                                      ORDER BY ${LATEST_REVISION_ORDER} LIMIT 1)) AS not_latest
```

Ngữ nghĩa giữ nguyên: bản mới nhất theo cùng `LATEST_REVISION_ORDER`; số cặp không khớp, hay tin không có bản nào (NULL), đều là «đã đổi». Mỗi cặp một lần dò chỉ mục. Phần còn lại là tuyến tính theo độ dài luồng (luật 4, `unnumbered`: 15,7 ms cho 7 378 bản), không tránh được nếu giữ luật «mọi bản đều có số».

### SV-DB-2 · P3 · câu của `release_librarian` quét mọi bản của tài liệu

**Vị trí.** `src/server/skill-context.ts:91-92`: `OR v.id=(SELECT n.id FROM document_revisions n WHERE n.project_id=d.project_id AND n.document_id=d.id ORDER BY n.revision_no DESC, n.id LIMIT 1)`.

**Lỗi.** Câu con tham chiếu `d` nên là SubPlan, chạy một lần cho mỗi bản `v` của tài liệu (không phải một lần). Với tài liệu 5 000 bản: SubPlan `loops=4 999`, quét `idx_document_revisions_scope_created` của cả dự án rồi lọc theo `document_id`, 15 149 lần chạm trang, 11,4 ms. Cùng câu ở nhánh ba kỹ năng khác (`$4 = false`, `LIMIT 30`, đọc 31 hàng) tốn 0,048 ms trên cùng tài liệu; câu **cũ** của thủ thư (một InitPlan trên `document_records`) tôi không đo. Chỉ ảnh hưởng `release_librarian` (ba kỹ năng khác có `$4 = false` nên đi nhánh `NOT $4`). Tài liệu thật có vài chục bản: dưới 0,3 ms.

**Cách sửa** (đã chạy, cùng hai hàng, 0,038 ms): thay bằng một InitPlan chỉ dùng tham số:
`OR v.revision_no=(SELECT max(n.revision_no) FROM document_revisions n WHERE n.project_id=$1::uuid AND n.document_id=$2::uuid)`.
`UNIQUE(document_id, revision_no)` (`migrations/014_document_registry.sql`) bảo đảm không có hai bản cùng số, nên cách tách `n.id` ở `ORDER BY` không cần.

### SV-DB-3 · P3 · không ca nào chạm quy mô; số của N7 là của câu khác

Mọi ca `T*` của `threadFreshness` chạy trên luồng nhiều nhất 22 tin với 22 cặp (T14′); ca của thủ thư chạy trên tài liệu 40 bản (`tests/skill-context.test.ts:295`). Hình dạng tích «cặp × luồng» của SV-DB-1 vì vậy không ca nào thấy: câu hiện tại và câu đề xuất cùng xanh toàn bộ.

Kế hoạch N7 ghi 0,4 ms cho luồng 10 tin và 21 ms cho luồng 3 000 tin trên 60 000 bản, và nói chính nó là câu của cổng, không phải câu thật. Câu thật đo được 153–162 ms ở luồng 3 000 tin (20 cặp). Task 9 nên đo `threadFreshness` ở **100 cặp** trên một luồng ≥ 3 000 tin (và 20 000 nếu muốn biết trần), và N7 nên ghi số thật thay số của cổng.

**Đề xuất (không bắt buộc).** Sau SV-DB-1, thêm một ca native: dựng luồng ~600 tin bằng `INSERT … SELECT` qua login vận hành, 100 cặp, và khẳng định **số lần chạm bộ đệm** (`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`, `Shared Hit Blocks` của nút gốc) dưới một ngưỡng — con số xác định theo dữ liệu, không phụ thuộc đồng hồ (mục 10 của kế hoạch cấm ca dựa vào đồng hồ).

### SV-DB-4 · P3 · ghi nhận cho N7, có trước PR

Không thuộc diff, không đòi sửa trong PR này:

- `visibleThreadMessages` (`src/server/source-text.ts:63`): `JOIN LATERAL` lấy bản mới nhất cho **mọi** tin của luồng, rồi mới `ORDER BY … LIMIT $4`: 17,5 ms (3 000 tin), 97 ms (20 000 tin); tuyến tính, dùng chỉ mục, không quét tuần tự. Dòng đổi của PR chỉ thêm cột `r.revision_no`.
- `projectHasHiddenText` (`:99-114`): quét chỉ mục `idx_source_events_scope_created` cả dự án, ≈ 30 ms ở 60 000 tin khi mọi nhóm đều được bật cờ (trường hợp xấu nhất, đáp án «không»); kế hoạch có một `Seq Scan on project_domain_mappings` mỗi hàng `source_events` (`loops=60 000`, bảng rỗng ở CSDL thử). `decide` gọi nó **hai lần** cho mỗi lệnh xác nhận (một lần trong `maskedForCaller`, một lần ở phép kiểm), cả hai trước lệnh ghi (đo ở mục 2: ≈ 29 ms mỗi lần ở dự án 99 800 bản).

## 2 · Số đo

### 2.1 · `EXPLAIN (ANALYZE, BUFFERS)` của `threadFreshness`

Kế hoạch (câu hiện tại, role runtime): không có quét tuần tự nào. `thread` đi `idx_source_events_thread` (3 000 hàng, 1,0 ms); `unnumbered` đi `idx_source_event_revisions_event_fk` rồi `source_revision_positions_revision_id_key` (15,7 ms cho 7 378 bản, 43 402 lần chạm trang); `baseline` đi `source_event_revisions_source_event_id_revision_no_key` rồi khoá duy nhất `revision_id` (0,13 ms); `head` đi khoá duy nhất `(tenant_id, project_id, chat_id, thread_key)` của dòng đếm (0,02 ms). Luật 3 và luật 4 có chỉ mục phục vụ; **luật 2 có chỉ mục nhưng sai hình dạng** (SV-DB-1). Không câu nào quét cả dự án: trong dự án 60 000 tin / 84 019 bản, một luồng 30 tin tốn 0,96–1,08 ms.

Tổng ở luồng 3 000 tin, 20 cặp: câu hiện tại `Buffers: shared hit=320 695`, 153,7 ms; câu đề xuất `shared hit=43 760`, 15,9 ms.

### 2.2 · Thời gian giữ khoá của `decide` (S-3, N11)

Ca đo: một dự án 75 000 tin / 99 794 bản (đủ lớn để phần đuôi cũ tốn), một luồng 5 tin, nháp nêu cả 5 (bản 1), năm lần xác nhận nháp ứng viên liên tiếp qua `SuggestionService.decide` thật, role runtime; ghi giờ ở lớp bọc `Database`: từ lúc gửi câu `INSERT INTO draft_decisions` tới khi `h.db.transaction` trả (gồm `COMMIT`). Khoá luồng lấy ở trigger `AFTER` bên trong câu `INSERT`, nên thời gian giữ thật ≤ số này.

| biến thể | INSERT → COMMIT (5 lần) | câu gửi từ `INSERT` trở đi |
|---|---|---|
| mã hiện hành (P13) | 8,9 (lạnh), 2,4, 2,7, 2,3, 2,6 ms | 3 câu: `INSERT` (0,7–1,4 ms), `UPDATE document_commands` (0,3–0,5), `SELECT` dòng nháp + quyết định (0,5) |
| bản sao bỏ `known` ở lời gọi cuối (đb10, ≈ phần đuôi cũ) | 34,0, 33,7, 32,1, 33,7, 32,7 ms | 5 câu: thêm `SELECT (NOT EXISTS(… projects …) OR EXISTS(… source_events … source_event_revisions …))` **28,6–29,0 ms** và `SELECT EXISTS(… intake_candidates … source_events …)` 0,6–0,7 ms |

Cả lệnh `decide`: 69–71 ms (P13) và 99–107 ms (không `known`), không tính lần đầu (lạnh) của mỗi biến thể: 93 ms và 117 ms. Sau P13 không câu nào sau lệnh ghi nêu `source_events`, `source_event_revisions`, `intake_candidates`, `source_revision_positions` hay `intake_thread_heads`: chỉ còn ghi lại phản hồi lệnh và đọc lại dòng nháp (view). Trần N11 (500 ms) dư khoảng 200 lần. Ca K4 (`tests/suggestions.test.ts:1807`) đỏ bằng `AssertionError` khi bỏ `known` (mục 3), nên chống được việc đưa lần quét trở lại.

### 2.3 · Câu của `release_librarian`, mọi hình dạng

Chạy câu mới và câu cũ trên cùng dữ liệu, role runtime, ba tổ hợp `(pointerOnly, thủ thư)`:

| hình dạng | câu mới (thủ thư, dự án thường) | câu cũ |
|---|---|---|
| D1: 3 bản, không bản chuẩn | 1 hàng: bản 3, con trỏ | 0 hàng |
| D2: bản chuẩn là bản 2 trên 3 | 2 hàng: bản 3 con trỏ, bản 2 đủ nội dung | 1 hàng (bản 2) |
| D3: bản chuẩn là bản mới nhất | 1 hàng đủ nội dung (không trùng) | 1 hàng |
| D4: 1 bản, không bản chuẩn | 1 hàng: con trỏ | 0 hàng |
| D5: 1 bản, là bản chuẩn | 1 hàng đủ nội dung | 1 hàng |
| D6: bản chuẩn là bản 1 trên 2 | 2 hàng: bản 2 con trỏ, bản 1 đủ nội dung | 1 hàng |

Con trỏ: `summary` NULL, `present` và `missing` `[]`, `source_hash` NULL, `hash_verification` hằng `'self_declared'` kể cả khi bản đó lưu `verified` (bản 3 của D1, D2, D4 lưu `verified` ở dữ liệu thử). Ba kỹ năng khác (`$4 = false`): kết quả **y hệt** câu cũ ở cả hai giá trị `pointerOnly`. `pointerOnly = true` với thủ thư: bản chuẩn vẫn mang `source_hash` và `hash_verification` đã lưu (như trước PR), nội dung bị che. Bản chuẩn của tài liệu **khác** không bao giờ vào (câu nối `document_revisions` với đúng `document_records` bằng `document_id`; khoá ngoại `(approved_revision_id, id)` buộc bản chuẩn thuộc đúng tài liệu). Không có hai bản cùng `revision_no` (`UNIQUE(document_id, revision_no)`), nên không hàng thừa, không hàng thiếu do hoà. `m.pointer` và `m.hide` không bao giờ NULL (`IS DISTINCT FROM` và tham số boolean không NULL): đột biến thay `IS DISTINCT FROM` bằng `<>` làm ca đỏ (mục 3). `present` là jsonb `null` (khác NULL của SQL) đi qua `coalesce` nguyên và được `strings()` (`skill-context.ts:35`) biến thành `[]`.

Tài liệu 5 000 bản: xem SV-DB-2 (11,4 ms; câu đề xuất 0,038 ms).

### 2.4 · Kiểu

- `last_seq::text` → `$12::bigint`: một số thập phân không dấu, không số 0 đầu; cột `bigint`. NULL cho mọi lệnh khác. `head !== baseline` so hai chuỗi của hai `bigint`: không có lệch do định dạng.
- Số bản 1 … 2 147 483 647: `$5::int[]` nhận; `2147483648`, 0, âm, lẻ, NaN, chuỗi bị bỏ trước khi tới CSDL (T19, đã đọc; ca có đối chứng ở cả hai đầu).
- `unnest($4::uuid[], $5::int[]) AS p(id,no)`: hai mảng cùng độ dài do mã dựng; mảng rỗng cho 0 hàng; không dùng tên dành riêng (`no` không phải từ khoá).
- `LIMIT $4` của `visibleThreadMessages` bị kẹp 0–200 ở mã; `LIMIT $5::int` của thủ thư (`MAX_REVISIONS` = 30) không còn ý nghĩa với thủ thư (tối đa 2 hàng) và không đổi với ba kỹ năng.

## 3 · Điều tôi đã thử mà không phá được

Đột biến trên bản sao ngoài repo (PGlite trừ khi ghi khác), mỗi lần khôi phục; «chết» = ít nhất một ca đỏ bằng `AssertionError`.

| Đột biến | Kết quả |
|---|---|
| `decide`: bỏ tham số `known` ở lời gọi `present` cuối (đb10) | chết: K4 (`expected [ Array(1) ] to deeply equal []`) |
| `present` sau lệnh ghi gọi lại `threadFreshness` | chết: K4 (cùng `AssertionError`) |
| `decide`: ghi `NULL` thay vị trí luồng (đb6) | chết: K1 |
| `decide`: bỏ nhánh dịch `LTZ03` | chết: K3 (`to match object { code: 'DRAFT_HELD', status: 422 }`) |
| `decide`: vị trí cố định `'1'` | chết: K1 |
| `threadFreshness`: bỏ `JOIN thread` ở `stated` (cặp của luồng khác tính vào) | chết: T17 |
| `threadFreshness`: `max` → `min` ở `baseline` | chết: 6 ca (T7′ hàng 8, tin khác, L1, T14′, T17, T18) |
| `threadFreshness`: bỏ `q.project_id=$1` trong `unnumbered` | **sống** — đột biến tương đương: `q.revision_id=r.id` đã là khoá duy nhất, điều kiện dự án ở đó chỉ là phòng thủ thêm; không đòi ca |
| thủ thư: con trỏ lộ `hash_verification` đã lưu | chết: ca «gets the content of the approved revision only» |
| thủ thư: con trỏ lộ `source_hash` | chết: cùng ca |
| thủ thư: `hide` chỉ theo `pointerOnly` (con trỏ lộ nội dung) | chết: 2 ca, trong đó R10-g |
| thủ thư: `IS DISTINCT FROM` → `<>` (NULL khi không có bản chuẩn) | chết: ca con trỏ |

Đã thử mà đúng:

- **Phạm vi dự án, tenant.** Mọi bảng đọc trong câu đều có `project_id = $1` riêng (và `h.tenant_id = c.tenant_id` cho dòng đếm), không dựa RLS để lọc dự án; dưới RLS với tenant khác: T8′ trả `hasBaseline:false`. Không `SELECT` nào của diff thiếu `project_id`. Không `LIMIT` ở `thread` là có chủ ý (L2), kết quả một hàng.
- **Thứ tự xác định.** `LATEST_REVISION_ORDER` (`edited_at DESC NULLS LAST, revision_no DESC`) là thứ tự toàn phần vì `UNIQUE(source_event_id, revision_no)`; `visibleThreadMessages` xếp `observed_at, id`; thủ thư xếp `revision_no, id`. Không cột chữ nào được xếp: không cần `COLLATE "C"`.
- **Cạnh tranh ghi.** Mỗi bản sửa mới tăng `last_seq` của luồng; khoá `FOR NO KEY UPDATE` ở trigger so lại **sau khi chờ** (READ COMMITTED đọc lại bản mới nhất): bất cứ bản nào commit sau `threadFreshness` đều làm `last_seq` khác `subject_thread_seq`. N12 (khe commit ngược), N13 (sửa đang bay), N14 (xác nhận đang bay làm nhận tin chờ), N15 (`55P03` thô, không ghi gì, cùng lệnh thành công khi luồng rảnh) đều xanh trên 16.15.
- **Mã lỗi đi ra khỏi `decide`.** `LTZ01`, `LTZ03` được dịch thành `DRAFT_HELD` (K3: `Object.keys(e) = ['code','status']`, không `cause`, không chữ của CSDL, không id); `LTZ03` chỉ được dịch khi `result = confirmed` và nháp là ứng viên: dịch vụ chỉ gửi vị trí đúng ở tổ hợp đó, nên một `LTZ03` ở tổ hợp khác (không đến được từ dịch vụ) đi thô. `LTZ02`, `55P03`, `40P01`, `40001`, `57014` và mã của hai guard 021/022 đi thô như kế hoạch (mục 9; N8 là điều kiện cho tuyến đầu tiên gọi `decide`). `scoped()` mở giao dịch ở mức mặc định của login và repo không đặt `default_transaction_isolation` ở đâu (`src`, `deploy`, `scripts`, `migrations`: 0 dòng), nên `LTZ02` không đến được từ đường dịch vụ trừ khi người vận hành đặt mức khác cho login (#inference: không kiểm trên login thật).
- **Không còn vòng chờ mới.** Thứ tự khoá của `decide` không đổi so với 022 cộng khoá luồng ở cuối; không truy vấn nào của diff lấy khoá hàng (chỉ đọc).
- **Dữ liệu nạp hàng loạt.** 162 075 bản nạp một phiên: số liền mạch, `last_seq` khớp ở cả 3 502 luồng, 0 bản không số (trigger đúng ở quy mô).

## 4 · Đối chiếu từng ý soi đặc biệt

- **(a) EXPLAIN:** mục 2.1; một vấn đề (SV-DB-1). Chỉ mục phục vụ luật 3, 4; luật 2 dùng chỉ mục nhưng tích «cặp × luồng»; không quét tuần tự, không quét cả dự án.
- **(b) thời gian giữ khoá:** mục 2.2; chứng minh bằng log câu lệnh (3 câu sau `INSERT`, không câu nào chạm bảng tin hay bảng số) và bằng giờ đo (2,3–2,7 ms so với 32–34 ms).
- **(c) thủ thư:** mục 2.3; không hàng thừa, không hàng thiếu ở sáu hình dạng; SV-DB-2 (hiệu năng, P3).
- **(d) kiểu:** mục 2.4; không phát hiện lỗi.
- **(e) cô lập, `LTZ02`, `lock_timeout`, mã thô:** mục 3 («Mã lỗi đi ra khỏi `decide`»); không lỗi thô nào lọt ngoài danh sách của kế hoạch.
- **(f) `project_id`, `LIMIT`, thứ tự, `COLLATE`:** mục 3; không phát hiện.
- **(g) ca kiểm:** K1–K4, J1–J4, L1 (thủ thư), R10-g, N12–N15, T6′–T19 đều có đối chứng dương và đỏ bằng khẳng định với đột biến liên quan (mục 3). Điểm yếu duy nhất tôi tìm được là SV-DB-3 (không ca nào chạm quy mô). K4 dùng mẫu tên bảng `source_events|source_event_revisions|intake_candidates`: không nêu hai bảng mới, nhưng mọi lần đọc lại `threadFreshness` đều nêu cả ba bảng kia nên bị bắt (đột biến thứ hai ở bảng trên); chỉ một lần đọc thuần dòng đếm sau lệnh ghi mới lọt, và lần đọc đó là tra một dòng, không phải lần quét: không cần mở rộng.
