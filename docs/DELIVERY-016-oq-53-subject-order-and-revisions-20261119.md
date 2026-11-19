# OQ-53: mốc của nháp ứng viên theo số bản của tin và số thứ tự theo luồng; ngữ cảnh `release_librarian` (OQ-57) · 19/11/2026

PR riêng vào `libetech-ai-os` (không vào `main`), làm ba điểm Chairman đã quyết ngày 19/11/2026 cho OQ-53 và sửa ngữ cảnh `release_librarian` (OQ-57), rồi gỡ hai giữ chỗ fail-closed của PR #22. Nhánh `feat/oq-53-subject-verification`, gốc `80c1ad8` (đầu `libetech-ai-os` sau PR #22). Kế hoạch: `docs/plans/oq-53-subject-verification.md` bản 0.3. Review và bằng chứng: `docs/reviews/oq-53-evidence-20261119/`. PR: [liberico-ai/ai-together#24](https://github.com/liberico-ai/ai-together/pull/24), vào `libetech-ai-os`, mở ngày 19/11/2026; merge vào `libetech-ai-os` ngày 19/11/2026 (`b978163`) sau khi Chairman duyệt: «Merge PR #24».

Mã đã đo ở `affe28a` (đầu của lượt kiểm toàn bộ thứ hai, sau hai vòng sửa của cổng Codex và đợt quét theo lớp); lượt đầu ở `4df2db3` ghi để đối chiếu; commit sau `affe28a` chỉ thêm hồ sơ. Mọi ô chờ đã được điền (số PR, kết quả cổng Codex và reality-check); biên nhận không ước con số nào.

**Z4 chưa bật và không được bật bởi PR này.** Không tuyến HTTP nào đọc hay xác nhận nháp (ca «no route imports the suggestion service, and nothing in src builds it with an AI handle» không bị sửa, thân ca giống từng byte với `80c1ad8`); không login hay khoá cho role `libetech_ai`; không mô hình nào được gọi; migration 023 chưa áp ở đâu ngoài các CSDL thử của phiên (đã xoá hoặc chỉ nghe loopback). Dữ liệu thử là dữ liệu tổng hợp.

## Bốn mức — ghi riêng, không gọi mức sau khi mới đạt mức trước

| Mức | Trạng thái | Căn cứ |
|---|---|---|
| **Đã có mã** | **Đạt mức «đã có mã».** Cổng Codex vòng 2 `VERDICT: PASS`, không finding (vòng 1 `CHANGES_REQUIRED`, một P1, đã sửa); `liberico-reality-checker` `READY WITH TEXT FIXES` (0 P0/P1; ba P2 và tám P3 là chữ biên nhận, đã áp). Số đo ở `affe28a`: typecheck 0; build 0; PGlite 1 287 ca đạt / 118 bỏ qua; PostgreSQL 16.15 1 405 đạt / 0 bỏ qua; mọi ghế review tầng 1 `READY_FOR_GATE` ở `26ba304` (đợt sửa 3 ở `4df2db3` chưa có ghế xem lại: xem mục «Review») | Bảng «Bằng chứng kiểm» và mục «Review»; đã merge ngày 19/11/2026 (`b978163`) sau «Merge PR #24». Trước khi merge, phiên điều phối kiểm lại độc lập trên bản merge với đầu `711faf1` (typecheck, build, pytest đạt; PGlite 1 288 đạt / 118 bỏ qua; PostgreSQL 16 1 406 đạt / 0 bỏ qua — mỗi số hơn số trên một ca, là ca của PR #23; coverage 96,40 · 91,85 · 98,07 · 97,64); cây merge thật trùng cây đã kiểm |
| Đã triển khai | **Chưa.** Không triển khai d1-ai1; 023 chưa áp lên dữ liệu thật; không khởi động lại gateway | Điểm dừng Chairman |
| Đã dùng thật | **Chưa.** Không dòng nháp nào ngoài CSDL thử; không pipeline nào ghi `messageRevisions`; không ai gọi `SuggestionService` ngoài test | — |
| Đã nghiệm thu | **Chưa.** | — |

## Căn cứ và quyết định

Lời Chairman ngày 19/11/2026, chép nguyên (`docs/OPEN-QUESTIONS.md:949`): «OQ-53: điểm 1 (b), điểm 2 (a), điểm 3 (b) — làm thành một PR riêng, giữ hành vi chặt tới khi PR đó merge; sửa ngữ cảnh release_librarian trong cùng PR.»

Chữ của phương án đã chọn (từ `docs/OPEN-QUESTIONS.md`, không phải lời Chairman): điểm 1 (b) `:878` «mở rộng hợp đồng đầu ra để nháp nêu hash (hoặc số bản) của từng tin nó trích, lúc xác nhận so với bản mới nhất của tin — chính xác, không giữ oan; phải đổi hợp đồng, prompt, manifest và bộ eval của các kỹ năng nhận tin»; điểm 2 (a) `:879` «không có mốc thì không xác nhận được: giữ nháp khi tài liệu đã có ít nhất một bản (luồng thì luôn có ít nhất một tin) — pipeline buộc phải nêu bản hay tin nó đã đọc»; điểm 3 (b) `:924` «một số thứ tự theo luồng do CSDL cấp lúc ghi, đọc được sau commit — cần migration và đổi đường nhận tin».

OQ-57 (Chairman chọn qua hộp chọn của phiên điều phối, 19/11/2026; toàn văn hai câu hỏi, các phương án và chuỗi trả lời ở khối cuối `docs/OPEN-QUESTIONS.md`): điểm 1 «Thêm con trỏ (Recommended)» — nguồn chỉ-con-trỏ cho bản mới nhất chưa duyệt (mã, mã tài liệu, số bản; không nội dung, không tóm tắt, không hash; R10-g đọc là «chỉ nội dung của bản chuẩn»); điểm 2 «Có, như mọi kỹ năng (Recommended)» — bản chưa duyệt mới hơn bản chuẩn làm nháp «đã cũ». Nhãn «(Recommended)» là của phiên điều phối.

| Quyết định | Mã | Task |
|---|---|---|
| Điểm 3 (b), phía nhận tin | `migrations/023_thread_order.sql`: bảng `intake_thread_heads` (một dòng đếm cho mỗi luồng, khoá tới commit), `source_revision_positions` (số của từng bản), trigger `source_event_revisions_thread_position` (`AFTER INSERT`, `SECURITY DEFINER`) | 1 |
| Điểm 3 (b), phía xác nhận (finding CX3 của PR #22) | cột `draft_decisions.subject_thread_seq` + trigger `draft_decisions_subject_order_guard` (so-và-ghi dưới `FOR NO KEY UPDATE`, mã `LTZ03`); `decide` ghi vị trí và dịch `LTZ03` thành `DRAFT_HELD: SUBJECT_CHANGED` | 2, 7 |
| Điểm 1 (b) | ngữ cảnh mang `revisionNo`; đầu ra ba kỹ năng nhận tin có `messageRevisions`; `namedRevisions`; `threadFreshness` theo số | 3, 4, 5, 6 |
| Điểm 2 (a) | `SUBJECT_BASELINE_MISSING` giữ nguyên; thêm «nêu tin mà thiếu số bản» | 5, 6 |
| OQ-57 (1 (a), 2 (a)) | `src/server/skill-context.ts`: nguồn chỉ-con-trỏ cho `release_librarian`; prompt/eval/manifest | 8 |
| Gỡ hai giữ chỗ | `SUBJECT_EDIT_UNVERIFIED` (Task 6), `SUBJECT_ORDER_UNVERIFIED` (Task 7): `grep` cả hai mã trong `src tests skills migrations` = 0 dòng | 6, 7 |

**Cách làm của điểm 3 là của `planner`, không phải lời Chairman** (ánh xạ 7 của phiên điều phối, `docs/OPEN-QUESTIONS.md:975`): kế hoạch đo trên PostgreSQL 16.15 rằng `nextval` thuần có thể commit ngược thứ tự số (đo 1) và rằng một dòng đếm theo luồng bị khoá tới commit thì số đúng thứ tự commit (đo 2); khoá tư vấn bị loại vì không kiểm quyền (DB-9, S-1 của PR #22).

## Cách hiểu chờ Chairman xác nhận (không phải lời Chairman)

| # | Cách hiểu |
|---|---|
| C1 | «hash (hoặc số bản)» ⇒ **số bản** (`revision_no`): hai bản có thể cùng `content_hash`; hash là `null` khi chữ không hiện |
| C2 | «từng tin nó trích» ⇒ mọi tin của luồng có mã ở bất kỳ trường mã nào của đầu ra; thiếu số bản cho một tin như vậy ⇒ không có mốc ⇒ `SUBJECT_BASELINE_MISSING` |
| C3 | «bản mới nhất của tin» ⇒ bản đầu theo `LATEST_REVISION_ORDER`; số nháp nêu khác nó ⇒ `SUBJECT_CHANGED` |
| C4 | điểm 3 (b) gồm cả phía xác nhận (so-và-ghi), vì không có nó finding CX3 còn nguyên |
| C5 | «đổi đường nhận tin» làm ở tầng CSDL (trigger); `src/server/intake.ts` không đổi dòng nào |
| C6 | mã `SUBJECT_EDIT_UNVERIFIED` biến mất; bản sửa đến sau thứ nháp nêu thành `SUBJECT_CHANGED` |
| C7 | giữ oan được chấp nhận (fail-closed): bản sửa cũ đến muộn; tin đến muộn ngoài cửa sổ 20 tin; luồng mà bản ghi sau cùng thuộc tin chỉ-con-trỏ — hết khi luồng có tin mới |
| C8 | nhãn hợp đồng `SkillContext/v2`, version `0.2.0` cho cả sáu kỹ năng ⇒ hash manifest cả sáu đổi; nháp đã lưu bị `MANIFEST_MISMATCH` (không có dòng thật nào) |
| C9 | (đã quyết ngày 19/11/2026: OQ-57 điểm 1 (a), điểm 2 (a)) |
| C11 | (OQ-57 điểm 2 (a)) «một bản được trình sau khi nháp viết xong giữ nháp» được đọc là **giữ**, không nhất thiết bằng mã `SUBJECT_CHANGED`: với nháp `release_librarian` đã nêu con trỏ cũ, mã che `SOURCE_OUT_OF_CONTEXT` giữ nháp trước (fail-closed, từ chối vẫn làm được, không rò). Cách đọc khác: buộc mã `SUBJECT_CHANGED` cho trường hợp này (đổi thứ tự mã che và mã mốc cho riêng thủ thư) |
| C10 | khi áp 023 trên dữ liệu có sẵn, các bản cũ được đánh số theo `created_at, revision_no, id` — không phải thứ tự commit (CSDL không còn biết nó); an toàn nhờ bốn phép từ chối của 023 (bên dưới) |

## Đã làm

Chín task của kế hoạch, mỗi task ca kiểm viết trước (log đỏ là khẳng định hoặc lỗi SQL đúng lý do, không hook-timeout) rồi mã; ba đợt sửa sau review.

| Task | Commit | Nội dung |
|---|---|---|
| 1 | `306a8b9` | migration 023 phần nhận tin: hai bảng, trigger cấp số, đánh số bản cũ, tệp lùi |
| 2 | `4076ba7` | phần xác nhận: cột `subject_thread_seq`, trigger so-và-ghi, ràng buộc |
| 2b, 2c | `00228a4`, `dd8ee26` | đợt sửa sau review tầng 1 của migration (xem mục «Review») |
| 3 | `e120b1d` | ngữ cảnh mang `revisionNo`; `SkillContext/v2` |
| 4 | `9b499ae` | `messageRevisions` ở đầu ra ba kỹ năng nhận tin; `namedRevisions` |
| 5, 6 | `e8c54c5` | `threadFreshness` theo số; `decide` giữ `SUBJECT_BASELINE_MISSING`/`SUBJECT_CHANGED`; gỡ `SUBJECT_EDIT_UNVERIFIED` |
| 7 | `2a94381` | `decide` ghi vị trí luồng; gỡ `SUBJECT_ORDER_UNVERIFIED`; mười hai ca E1–E12 đổi lại |
| 8 | `26ba304` | ngữ cảnh `release_librarian` (OQ-57) |
| 9a | `4df2db3` | đợt sửa 3 sau review lớp dịch vụ (luật 2 không còn tích «cặp × độ dài luồng»; InitPlan; `revisionNo ≥ 1`) |
| 9 | `899bdfe` | kiểm toàn bộ (đầu `4df2db3`) |
| Cổng Codex vòng 1 → sửa | `235c89e`, `bc10fb6` | P1 của vòng 1 (trigger xác nhận chỉ so `last_seq`) và đợt quét theo lớp trước vòng 2: xem mục «Cổng Codex» |

**Migration 023** (`migrations/023_thread_order.sql`; tệp lùi cùng tên trong `migrations/rollback/`). Hai bảng mới ở `public` (`ENABLE`+`FORCE` RLS, đúng một policy `SELECT` cho role runtime, không policy ghi, không `GRANT` nào khác); hai hàm `SECURITY DEFINER` (`search_path = pg_catalog, pg_temp`, `row_security = off`, `lock_timeout = '5s'`, không `EXECUTE` cho role nào); hai trigger `AFTER INSERT` (cấp số — `ENABLE ALWAYS`, nên một phiên `session_replication_role = replica` cũng được đánh số và giữ dòng đếm; so-và-ghi — ngoài việc so `last_seq` còn từ chối `LTZ03` khi luồng có bản chưa có số hoặc khi trigger cấp số không còn bật). `AFTER`, không `BEFORE`: dòng bị `ON CONFLICT DO NOTHING` bỏ qua không chạy trigger (lần gửi lại không đốt số, không lấy khoá) và RLS trả lời trước nên role ngoài phạm vi không chờ khoá của luồng nó không được ghi (đo 3, 5). Bốn phép từ chối của 023, mỗi phép một câu cố định và không tạo gì: (1) người áp không phải superuser; (2) một login không phải superuser là thành viên `libetech_ai` đang kết nối — kiểm hai lần, dưới khoá, lần hai ngay trước khi ghi `schema_migrations`; (3) hơn `libetech.thread_order_max_rows` bản chưa có số (mặc định 250 000); (4) còn nháp ứng viên chưa có quyết định của người trong lúc có bản chưa có số. Idempotent (áp hai lần không đổi gì) và có tệp lùi (từ chối khi còn bản ghi migration sau 023 hoặc khi còn dòng quyết định mang vị trí; khoá `source_event_revisions` rồi `draft_decisions` theo thứ tự của đường xác nhận). Ngoại lệ E-DB-12 (không cột `version` ở bảng đếm): bảng chỉ được ghi bởi một hàm, dưới khoá dòng giữ tới commit, bằng tăng nguyên tử; `last_seq` chính là phiên bản (chép vào chú thích đầu 023 và vào mô tả PR).

### Thay đổi hành vi ghi của hai bảng đã merge ở lát 2 (`source_events`, `source_event_revisions`) — có review CSDL

| # | Điều | Sau PR này |
|---|---|---|
| W1 | cột, kiểu, ràng buộc, chỉ mục, policy, quyền của hai bảng | **không đổi**; `created_at` vẫn là `now()` lúc bắt đầu giao dịch; `source_events` không có trigger mới; `src/server/intake.ts` không đổi |
| W2 | trigger trên `source_event_revisions` | thêm `source_event_revisions_thread_position` (`AFTER INSERT`, sau `WITH CHECK` của policy `intake_insert`) |
| W3 | một lệnh chèn bản sửa | ngoài khoá tư vấn theo tin (`intake.ts:87`) còn khoá dòng đếm của **luồng** tới hết giao dịch: các giao dịch nhận tin của cùng một luồng chạy lần lượt; luồng khác không chờ. Chi phí đo (kế hoạch, mục 6): 8 kết nối dồn vào một luồng giảm thông lượng 2 306 → 1 220 giao dịch/giây, p99 4,6 → 21 ms |
| W4 | lỗi mới của đường nhận tin | `55P03` sau 5 giây khi một giao dịch nhận tin khác của luồng bị để mở; `40001` cho giao dịch REPEATABLE READ bị đua; qua `/api/bridge` đều thành `500 INTERNAL_ERROR` không kèm chữ của CSDL |
| W5 | lần gửi lại một bản đã có | không ghi gì, không lấy khoá luồng, không đốt số |
| W6 | role `libetech_intake` | không thêm quyền nào; không đọc được hai bảng mới; chỉ giữ được khoá của một luồng bằng cách chèn thật một bản vào luồng đó, tức phải qua `WITH CHECK` của chính nó |
| W7 | thứ tự khoá của giao dịch nhận tin | khoá ngoại `KEY SHARE` lên dòng dự án → khoá tư vấn theo tin → **khoá dòng đếm của luồng** (cuối cùng) |
| W9 | trigger bị tắt, `session_replication_role = replica`, phục hồi tắt trigger | bản chèn như vậy không có số và dòng đếm không tăng; luật 4 coi luồng có bản thiếu số là đã đổi (đóng, nhưng giữ luồng mãi: N15) |
| W10 | `TRUNCATE projects … CASCADE` của harness | xoá cả hai bảng mới (khoá ngoại tới `projects`): dòng đếm không sống sót qua một lần reset |
| W8 | lúc áp 023 | `SHARE ROW EXCLUSIVE` trên `source_event_revisions`, `intelligence.ai_drafts` và `draft_decisions` từ ngay sau kiểm superuser (lệnh chèn chờ, lệnh đọc không chờ; thứ tự khớp đường xác nhận nên một lệnh xác nhận đang bay không còn `40P01` với lần áp lại); `ACCESS EXCLUSIVE` trên `draft_decisions` ở bước thêm cột; đo của review CSDL: 0,52 giây cho 60 000 bản, 3,3 giây cho 300 000, WAL 44 MB |

Số cho mọi chỉ số ở bảng này lấy từ `docs/reviews/oq-53-evidence-20261119/measurements-pg16.txt` và các báo cáo review; chúng là số của CSDL thử, không phải của dữ liệu thật.

### Mã lý do sau PR này

| Mã | Thay đổi |
|---|---|
| `SUBJECT_EDIT_UNVERIFIED` | **bỏ** (giữ chỗ của điểm 1). Bản sửa đến sau thứ nháp nêu ⇒ `SUBJECT_CHANGED`; bản sửa mà nháp đã đọc đúng bản đó **không còn giữ nháp** |
| `SUBJECT_ORDER_UNVERIFIED` | **bỏ** (giữ chỗ của điểm 3). Nháp ứng viên nêu bản mới nhất của mọi tin nó nêu, mà luồng không có bản nào được ghi thêm sau tin nó nêu muộn nhất, xác nhận được; luồng đi tiếp giữa phép kiểm và lệnh ghi ⇒ `LTZ03` ⇒ `DRAFT_HELD: SUBJECT_CHANGED` |
| `SUBJECT_BASELINE_MISSING` | không đổi (điểm 2 (a)); thêm: nêu tin của luồng mà thiếu số bản của tin đó |
| `SUBJECT_CHANGED` | nay gồm cả bản sửa mới và luồng đi tiếp sau phép kiểm |
| `THREAD_TEXT_HIDDEN`, `PROJECT_TEXT_HIDDEN`, các mã che, `MASK_REASONS` | không đổi (OQ-55: giữ tới khi có thiết kế pipeline) |
| `SOURCE_OUT_OF_CONTEXT` (OQ-57) | **hành vi khác chữ của quyết định 2 (a), xem C11:** nháp `release_librarian` đã nêu **con trỏ** của bản chưa duyệt N; khi bản N+1 được trình, mã bản N rời ngữ cảnh ⇒ nháp bị che (`value: null`) và lệnh xác nhận trả `DRAFT_HELD … SOURCE_OUT_OF_CONTEXT`, không `SUBJECT_CHANGED` (mã che thắng). Nháp nêu bản chuẩn đúng là bản mới nhất mà có bản mới hơn vẫn `SUBJECT_CHANGED`; từ chối vẫn làm được; không rò gì. Ca ghim `tests/suggestions.test.ts` («SV-S-2 a librarian draft that names the pointer of a revision that is no longer the newest is masked…») |

Sau PR này **nháp ứng viên xác nhận được lại** khi mọi tin nó nêu đều kèm số bản và là bản mới nhất của tin đó, **và** sau tin nó nêu muộn nhất không có bản nào được ghi thêm vào luồng (nó không cần nêu mọi tin của luồng, nhưng nháp chỉ nêu tin cũ của một luồng đã có tin sau thì bị giữ); mười hai ca E1–E12 mà PR #22 đổi sang «bị giữ» nay trở lại «xác nhận được» (kế hoạch, mục 12.1; từng ca đổi ở báo cáo của Task 7).

## Không làm trong PR này

Tuyến HTTP đọc/xác nhận nháp · login hay khoá cho `libetech_ai` · gọi mô hình · bật Z4 · giao diện · `bot-plugin/`, plugin priority1 · sửa `AGENTS.md`, `CLAUDE.md`, `src/server/ai-scope.ts`, `src/server/intake.ts` · mã cho OQ-54, OQ-55 (b), OQ-56 · pipeline ghi `messageRevisions` · sửa hồ sơ của PR #22 (biên nhận DELIVERY-015, kế hoạch `oq-45-46-ai-drafts`, thư mục bằng chứng của nó) và chữ R10-g ở `docs/plans/slice-3-review-skills.md:992`, `docs/DELIVERY-012-review-skills-20261115.md:247` (ghi chú ở khối quyết định OQ-57, không sửa tại chỗ) · triển khai d1-ai1.

## Bằng chứng kiểm

Tệp ở `docs/reviews/oq-53-evidence-20261119/`; đường dẫn máy trong log đã thay bằng `<repo>` hoặc `<scratch>`. Quét bằng mẫu rộng (thư mục home, tiền tố thư mục home viết bằng dấu gạch, thư mục tạm hệ thống, tên người dùng, tiền tố thư mục phiên, thư mục đệm của macOS) trên toàn thư mục bằng chứng, kế hoạch, câu hỏi mở và biên nhận: 0 dòng. Lượt kiểm toàn bộ lần đầu ghi «0» nhưng sót hai dòng đường dẫn tạm của phiên ở `task-9b-hygiene.txt`; `liberico-reality-checker` bắt được; commit chứa chúng chưa từng được push và đã được viết lại. PostgreSQL 16.15 trong container thử chỉ nghe loopback, trên CSDL riêng của phiên; PGlite của repo là `@electric-sql/pglite` 0.5.15 (PostgreSQL 18.6). Lượt kiểm toàn bộ do `scout` chạy (`task-9-verification-summary.md`); các task có log đỏ/xanh riêng ở `logs/task-*`.

| Lệnh | Kết quả | Log |
|---|---|---|
| Nền, đầu `80c1ad8` (PR #22) | PGlite 1 220 đạt / 79 bỏ qua (66 tệp đạt, 12 bỏ qua); PostgreSQL 16 1 299 đạt / 0 bỏ qua (78 tệp) | `docs/reviews/oq-45-46-evidence-20261118/` |
| Ở `affe28a` (lượt đầu ở `4df2db3`: cùng kết quả, số ca thấp hơn): `npm run typecheck` | mã thoát 0 | `task-9b-typecheck.txt` |
| `rm -rf .next && npm run build` | mã thoát 0 | `task-9b-build.txt` |
| `npx vitest run --coverage` trên PGlite | 67 tệp đạt, 13 bỏ qua; **1 287 ca đạt, 118 bỏ qua** (1 405); 0 đỏ; 0 hook-timeout; 0 `AssertionError` (lượt đầu ở `4df2db3`: 1 280 / 112) | `task-9b-pglite-coverage.txt` |
| `npx vitest run --reporter=verbose` trên PostgreSQL 16 | 80 tệp đạt; **1 405 ca đạt, 0 bỏ qua**; 0 đỏ; 0 hook-timeout; không `40P01` thật (9 dòng khớp «deadlock» đều là tên ca đạt) (lượt đầu ở `4df2db3`: 1 392 / 0) | `task-9b-native-verbose.txt` |
| Coverage mọi tệp (câu lệnh · nhánh · hàm · dòng) | nền 96,35 · 91,68 · 98,06 · 97,61 → 96,40 · 91,89 · 98,07 · 97,64; `suggestions.ts` 97,61 · 96,47 · 100 · 99,42 → 97,71 · 96,98 · 100 · 99,46; `skill-context.ts` không đổi; `source-text.ts` 100 · 97,5 · 100 · 100. khối tổng có covered/total: câu lệnh 3 386/3 514 → 3 435/3 563; nhánh 2 204/2 404 → 2 257/2 456; hàm 761/776 → 763/778; dòng 2 536/2 598 → 2 575/2 637; `skill-contracts.ts` 99,38 · 100 · 100 · 100 | `task-9b-pglite-coverage.txt` |
| Áp – lùi – áp lại 023 (CSDL thử riêng, đã xoá) | (a) catalog đúng (trigger cấp số `AFTER INSERT ROW`, `tgenabled = 'A'`; trigger xác nhận `O`; hàm xác nhận thêm `plan_cache_mode = force_custom_plan`); (b) lùi: hai bảng, hai hàm, hai trigger, cột đều hết; (c) áp lại: catalog như (a); (d) áp lần hai: không đổi; (e) lùi 022 khi 023 còn ghi nhận: **từ chối** «Roll back the later migrations before 022.». CSDL đó có 0 bản nên kiểm «mỗi luồng đếm bằng số dòng số» chỉ đúng tầm thường; việc đánh số bản cũ do ca A7 kiểm | `task-9b-migration-cycle.txt` |
| Vệ sinh | `AGENTS.md`, `CLAUDE.md`, `bot-plugin/`, `ai-scope.ts`, `intake.ts`, `src/app/` không đổi; ca canh «no route imports…» giống từng byte; hai mã giữ chỗ 0 dòng; quét mẫu rộng trên dòng thêm của **mọi** commit `80c1ad8..HEAD` và trên bốn nhóm tài liệu: 0 dòng trúng; mọi chat ID `-100…` gặp đều là id giả | `task-9b-hygiene.txt` |
| Đột biến (đối chiếu log builder, không chạy lại) | 9 trong 11 đột biến của kế hoạch Task 9 có log của builder với ca đỏ; **db1** (trigger cấp số thành `BEFORE INSERT`) không có log của builder (`m-before` trong `task-2*-mutants.txt` là trigger của bảng quyết định) — `liberico-reality-checker` chạy trên bản sao ngoài repo: 19 ca đỏ; **db9** (thêm `FOR UPDATE` thừa ở trigger cấp số, kế hoạch đòi N16 đỏ) không thực hiện được: trigger `AFTER INSERT` không được gọi cho dòng `ON CONFLICT DO NOTHING` bỏ qua nên N16 không đổi màu; N16 có thêm đối chứng (một bản thật sự lưu thì giữ dòng đếm) | `task-9-mutation-matrix.txt`, `logs/task-1-mutants-and-numbering-time.txt` |

Thời gian giữ khoá của lệnh xác nhận (từ lệnh ghi quyết định tới commit), do review CSDL đo trên PostgreSQL 16.15 với dự án 99,8 nghìn bản qua `SuggestionService` thật: 2,3–2,7 ms (lần đầu lạnh 8,9 ms) so với 32–34 ms khi phần đuôi còn quét bảng tin; sau lệnh ghi chỉ còn ba câu, không câu nào chạm bảng tin hay hai bảng số (ca K4). 2,3–2,7 ms là số đo trên dữ liệu giả; trần 500 ms là mục tiêu của kế hoạch (điều kiện N11), chưa đo trên dữ liệu thật. `visibleThreadMessages` và `projectHasHiddenText` (có trước PR, chạy trước lệnh ghi) tốn khoảng 30 ms ở 60 000 tin (SV-DB-4).

## Ca âm → test tự động

| Yêu cầu | Ca (tệp) |
|---|---|
| bản sửa đến giữa chừng ⇒ nháp bị giữ | J1 (i), (iii) (bản sửa đến sau nháp), K3 (tin **mới** đến giữa phép kiểm và lệnh ghi) (`tests/suggestions.test.ts`); N13 (`tests/thread-order-concurrency.test.ts`, bản sửa đang bay lúc xác nhận: `decide` chờ rồi `SUBJECT_CHANGED`) |
| bản sửa mà nháp đã đọc **không** giữ oan | J1 (ii), (iv) |
| luồng đến ngược thứ tự commit, PostgreSQL thật, hai kết nối | N12 (giao dịch nhận tin M_A bắt đầu sớm, M_B nhận và commit, nháp nêu M_B, M_A commit sau ⇒ `SUBJECT_CHANGED`; ca khẳng định `created_at` của M_A sớm hơn); N1, N7, N8, N14 cho cơ chế |
| nháp không nêu bản/tin nào | T4, J2 (`tests/suggestions.test.ts`), T18 (`tests/source-text.test.ts`); nháp tài liệu: ca ở `tests/suggestions.test.ts:551` |
| role/dự án ngoài phạm vi không lấy được khoá theo luồng | A4, A5, B4, B8, N5, N10, N20, N21 |
| 023 áp, lùi, áp lại | RB-023 (`tests/migrations-rollback.test.ts`), A6, A7, A7b; lượt `task-9b-migration-cycle.txt` |
| R10-g / OQ-57: nguồn con trỏ không mang nội dung | các ca theo tiêu đề (nhãn L1–L4 là nhãn của kế hoạch, dễ lẫn với L1–L9 khác trong `tests/suggestions.test.ts` và L4 hiệu năng trong `tests/skill-context.test.ts`): `skill-context.test.ts:358`, `:394`; `suggestions.test.ts:1930`, `:1941`; `skill-contracts.test.ts:329`; trong đó (chuỗi đánh dấu của bản chưa duyệt không có trong `JSON.stringify(context)` lẫn trong các dòng `recordingDb` ghi lại), L2–L4, R10-g (`tests/skill-context.test.ts`, `tests/suggestions.test.ts`, `tests/skill-contracts.test.ts`) |
| ca canh «no route imports the suggestion service…» không sửa | kiểm bằng `diff` trong `task-9b-hygiene.txt` |

## Review

- **Cổng trên kế hoạch** (trước mã): bảo mật `READY_TO_BUILD` (0 P0/P1, 3 P2, 6 P3) và review CSDL `READY_TO_BUILD` (0 P0/P1, 3 P2, 7 P3); bản 0.2 áp 19 finding (`gates/plan-*-round-1.md`).
- **Tầng 1, migration 023** (`gates/review-task-1-2-*.md`): vòng đầu cả hai `CHANGES_REQUIRED` — CSDL 1 P1 (phép kiểm login AI chạy trước lúc file chờ writer đang bay), 4 P2, 5 P3; bảo mật 1 P1 (tệp lùi kiểm «còn quyết định mang vị trí» rồi mới xin khoá), 2 P2, 4 P3. Đợt sửa 2b; xem lại: cả hai `READY_FOR_GATE`, còn 5 P3 (đợt sửa 2c đã làm).
- **Tầng 1, lớp dịch vụ** (`gates/review-service-*.md`): bảo mật `READY_FOR_GATE` (0 P0/P1/P2, 5 P3); CSDL `READY_FOR_GATE` (1 P2 — luật 2 của `threadFreshness` tỉ lệ «số cặp × độ dài luồng», 3 P3); code `READY_FOR_GATE` (2 P2, 6 P3). Đợt sửa 3 (`4df2db3`) làm luật 2, InitPlan, `revisionNo ≥ 1`, hai ca ghim hành vi. ** Ba ghế đọc `26ba304`; đợt sửa 3 (3 tệp `src`, 13 dòng, ca T20/T21, L4, SV-S-2, N21) chưa ghế tầng 1 nào xem lại:** chỉ `liberico-reality-checker` (đọc luật 2 cũ/mới: cùng ngữ nghĩa, kể cả «tin không có bản nào» và cặp lặp khác số) và cổng Codex nhìn nó.
- **Cảnh báo tự động** của một công cụ rà soát bảo mật (`suggestions.ts`, tin vào số bản do nháp tự nêu): trùng finding S-2 của cổng kế hoạch và SV-S-1 của ghế bảo mật; xem điều kiện N6.
- `liberico-reality-checker` (`gates/reality-check.md`): `READY WITH TEXT FIXES` — 0 P0/P1, 3 P2 (đường dẫn tạm trong một log; hành vi SV-S-2/C11 và P13 chưa nêu), 8 P3 (chữ); không finding nào đòi đổi mã. Đã áp hết vào biên nhận và hồ sơ; commit chứa đường dẫn tạm chưa từng được push và đã được viết lại.
- **Cổng Codex** (tối đa hai vòng sửa = tối đa ba lượt chạy): vòng 1 (đầu `b844792`, diff `src migrations skills tests` 505 506 ký tự gồm bối cảnh) `CHANGES_REQUIRED`, **một P1**: trigger xác nhận chỉ so `last_seq`, nên một bản không có số ghi sau phép kiểm (phiên `session_replication_role = replica`) lọt qua (`codex-round-1.md`). Vòng sửa 1: `235c89e` (trigger từ chối cả khi luồng có bản chưa có số; ca B10, K3b, N23; N22 ghim phần còn lại). Trước vòng 2, hai ghế **mới** quét theo lớp lỗi «kiểm rồi bên khác commit», oracle, hash (`gates/class-sweep-*.md`): bảo mật `READY_FOR_GATE` (1 P2, 3 P3), CSDL `CHANGES_REQUIRED` (1 P1: đường `replica` còn mở — đo lại được; 1 P2: phục hồi data-only của bộ cài hỏng; 3 P3); sửa ở `bc10fb6` (`ENABLE ALWAYS`, phép kiểm `tgenabled`, thứ tự khoá của lần áp lại, `plan_cache_mode`); xem lại của ghế CSDL `READY_FOR_GATE` (3 P3, đã làm hai, chữ cho CS-DB-8); **vòng 2 (đầu `2c545a6`, mã giống `affe28a`; diff 558 876 ký tự gồm bối cảnh): `VERDICT: PASS`, không finding** (`codex-round-2.md`; sandbox chỉ đọc nên Codex không chạy lại test — các số test là của phiên). Vòng 3 không cần.

## Chỗ khác bản 0.3 của kế hoạch (phán quyết của phiên và của builder; ghi để Chairman cân)

1. **A9 (Task 1)**: khoá ngoại của 016 trả lời trước trigger (`RI_ConstraintTrigger_*` xếp trước theo tên): ca viết lại thành «khoá ngoại từ chối, câu trả lời không mang id hay số»; nhánh `NOT FOUND` của hàm cấp số giữ như phòng thủ chiều sâu và có ca riêng (A9b, tắt khoá ngoại trong giao dịch rollback).
2. **P12**: trần mặc định 250 000 (không 500 000) và chỉ đếm bản **chưa** có số (R-DB-2, R-DB-5).
3. **Cửa sổ khoá của 023** bắt đầu từ bước 1 (khoá hai bảng, kiểm login AI và các phép từ chối dưới khoá); kiểm login AI lần hai sau `pg_stat_clear_snapshot()` (R-DB-1, R-S-3, R-S-8).
4. `CREATE OR REPLACE TRIGGER` (cần PostgreSQL ≥ 14; bộ cài đòi 16) cho trigger cấp số (áp lại không lấy `ACCESS EXCLUSIVE` trên bảng bản sửa); tệp lùi khoá `source_event_revisions` trước `draft_decisions` và đặt `SET LOCAL row_security = off` (R-S-1, R-DB-11).
5. Ca thêm ngoài bảng của kế hoạch: A7b, A9b, A10–A14, B7–B9, N16 (đối chiếu), N17–N21, H1–H4 (hook khôi phục guard sau `DISABLE TRIGGER` dạng đã commit — phụ thuộc thứ tự ca trong tệp, chỉ native). Các khẳng định thời gian (mili giây) đã bỏ khỏi N4, N5, N10.
6. Task 3: dòng «Đầu vào» của prompt không đặt `revisionNo` trong dấu backtick (chưa là trường đầu ra); `contextSchema` thêm `.min(1)` ở đợt sửa 3 (kế hoạch ghi `z.number().int()`).
7. Task 4: «cặp lặp» của `namedRevisions` do builder định nghĩa (cùng `id` và số ⇒ một; cùng `id` khác số ⇒ cả hai); ca `injection` của ba bộ eval mang `revisionNo` 2 trong ngữ cảnh và một câu lái đòi 7.
8. Task 5–6: `hasBaseline:false` luôn kèm `changed:false, position:null`; `subjectReasons` và kiểu `SubjectCheck` được `export` để ca J4 gọi thẳng; vị trí đi qua JS dạng chuỗi (`bigint`).
9. Task 7: K3 trên PGlite dựng «tin đến giữa chừng» trong cùng giao dịch của lệnh (một kết nối) nên không chứng minh chờ khoá — chỉ native chứng minh; N12 dùng album (một tin trả lời không thể có trước tin gốc khi giao dịch của tin gốc còn mở).
10. Task 8: hôm nay (trước task) nháp thủ thư nêu bản mới nhất nhận `SOURCE_OUT_OF_CONTEXT` (mã che thắng), không phải `SUBJECT_BASELINE_MISSING` như chữ kế hoạch; «bản mới nhất» là `max(revision_no)`; chú thích «để người duyệt đọc; cổng không bắt» được ghim bằng ca eval vì `EvalCase` không có trường chữ tự do.
11. Ghi nhận của ghế code, không sửa: `SUBJECT_ORDER_SQLSTATE`, `SubjectCheck` và `subjectReasons` được `export` chỉ để ca kiểm dùng (SV-C-7); hồ sơ bằng chứng còn `127.0.0.1:55471`, tên CSDL thử và hai script đo `probe-*.cjs` 38 KB chỉ phục vụ số đo của kế hoạch — giữ hay bỏ là quyết của Chairman (SV-C-8); chú thích `migrations/023_thread_order.sql:63` ghi «about 11 microseconds a revision» trong khi số đo ngay sau là 13–20 µs (chỉ là chú thích).
12. **P13 (S-3)**: `present` nhận kết quả đã tính thay vì quét lại bảng tin sau lệnh ghi (đóng thời gian giữ khoá: 2,3–2,7 ms) — đổi lớp phần dư L14.
13. **SV-S-2 / C11** (nháp thủ thư nêu con trỏ cũ bị che `SOURCE_OUT_OF_CONTEXT`, không `SUBJECT_CHANGED`) — bảng «Mã lý do».
14. Kế hoạch mục 9 nói khoá luồng «luôn là khoá cuối» và cổng bảo mật trên mã sửa chữ về thứ tự khoá/thời gian giữ; thứ tự khoá của migration (bản sửa → `ai_drafts` → `projects` → `draft_decisions`) không có đường dịch vụ nào lấy cả hai bảng đầu, nên không có vòng chờ do dịch vụ.

## Điều kiện

**Trước khi áp 023 lên dữ liệu thật** (đường nhận tin đang chạy thật; đây không chỉ là điều kiện của Z4):
- **N1.** Login của đường nhận tin và login web có `idle_in_transaction_session_timeout` (đề xuất ≤ 30 giây; kiểm bằng `SHOW`): một giao dịch nhận tin bị để mở nay chặn mọi tin khác của luồng đó (`55P03` sau 5 giây mỗi lần). `libetech_runtime` có `SELECT` nên giữ được `LOCK TABLE … ACCESS SHARE` trên hai bảng mới — chỉ chặn DDL.
- **N2.** Gateway gửi lại khi `/api/bridge` trả 5xx hay hết giờ (đọc từ mã: `bot-plugin/__init__.py:48-52`, `:188-210`; dòng 64 của chính tệp ghi «Not verified against the running gateway»): một `55P03` là một lần thử lại, không phải một tin mất — **chưa kiểm trên gateway chạy thật**. Hạng `answered` của gateway đếm tới `SPOOL_MAX_ATTEMPTS = 5` và 24 giờ rồi chuyển vào dead-letter, nên một luồng bị chặn lâu (N1) có thể dẫn tới đó; `HOOK_TIMEOUT = 2` giây đứng trước trần 5 giây của khoá nên thường là hạng `network`, không đếm (`bot-plugin/__init__.py:46-52`, `:59`, `:188-210`).
- **N3.** Đếm bản trước khi áp; trần 250 000 chưa phải cam kết thời gian (review CSDL đo 6,65–10,16 giây ở 500 000 bản trong cấu hình xấu nhất; pool có `statement_timeout` 10 giây); đo trên bản sao dữ liệu thật; áp migration trước, mã sau.
- **N4.** Phục hồi dữ liệu: bộ cài của chính repo nạp `pg_restore --data-only --single-transaction` không `--disable-triggers` (`deploy/install-user.py:161`, `deploy/install-d1.sh:43`, `docs/DEPLOY-002.md:19`); với 023, trigger nhận tin chạy khi nạp và trigger xác nhận chạy lại trên dòng quyết định lịch sử: **đo được (quét theo lớp, #fact)** rằng nạp `COPY draft_decisions` bị `LTZ03` và bản lưu sau 023 va `UNIQUE(revision_id)` của bảng số; `--disable-triggers` chạy được nhưng đặt trigger cấp số từ `ALWAYS` về `O` (đường `replica` mở lại cho tới khi áp lại 023 hoặc `ENABLE ALWAYS`). Cần chỉnh quy trình (bộ cài nằm ngoài PR) trước khi phục hồi một bản lưu sau 023.
- **N5.** Không có nháp ứng viên chưa quyết định lúc áp (023 tự kiểm).
- **N10.** Chỉ lùi 023 khi đường ghi Z4 đã đóng và mọi lần chạy pipeline dở dang đã bị bỏ; sau khi áp lại, mọi ngữ cảnh dựng trước đó là cũ. Sau lần xác nhận đầu tiên, 023 chỉ còn forward-fix (tệp lùi từ chối khi còn dòng quyết định mang vị trí).
- **N15 (mới, ngoài kế hoạch).** Một bản không có số (trigger bị tắt, `session_replication_role = replica`, phục hồi tắt trigger) làm **cả luồng bị giữ mãi** (luật 4) và cách gỡ duy nhất hôm nay là áp lại 023 — mà chính 023 từ chối khi còn nháp ứng viên chưa quyết định hoặc có login `libetech_ai` đang kết nối. Phiên bảo trì cố ý ghi một bản không số phải khoá `FOR UPDATE` dòng đếm của luồng trước (đo cả hai thứ tự: đóng kín). Cần một quy trình sửa có người chịu trách nhiệm trước khi bật Z4 (review code SV-C-2; số N15 do biên nhận này đặt, các số N1–N14 là của kế hoạch).

**Trước khi thêm tuyến đọc nháp hoặc bật Z4:**
- **N6 (chặn, mức P1 nếu bỏ qua — theo ghế bảo mật).** `messageRevisions` hôm nay là lời khai của mô hình; văn bản tin (không tin cậy) có thể lái nó (ca đã chạy thật: nháp nêu số 2 khi ngữ cảnh hiện số 1, tin được sửa thành bản 2, nháp vẫn xác nhận được; hậu quả là một lần xác nhận lệch bản, không rò dữ liệu, không leo quyền). **Mã của pipeline, không phải mô hình, phải ghi trường này** từ chính ngữ cảnh nó đã đưa, đè lên giá trị mô hình trả về, trước `submitDraft`. Prompt dặn «chép, không suy» và eval có ca `injection`, nhưng đó không phải cơ chế.
- **N7.** `EXPLAIN` trên dữ liệu thật cho `threadFreshness`; luật 4 trên bảng vừa nạp **chưa có thống kê** đo được 3–4 giây (planner chọn nested loop quanh CTE luồng; hết sau `ANALYZE`; builder đo trên dữ liệu giả) — chạy `ANALYZE` sau khi nạp và cân việc viết luật 4 nối thẳng từ ứng viên.
- **N8.** Tuyến đầu tiên gọi `decide` bọc `LTZ03` (nếu lọt thô), `55P03`, `40P01`, `40001` thành lỗi thử-lại-được không kèm `CONTEXT` của CSDL (mở rộng điều kiện 18 của PR #22).
- **N9.** Điều kiện 21 của PR #22 (điểm 3 có quyết định, giữ chỗ được gỡ, mười hai ca đổi kỳ vọng) đóng khi PR này merge.
- **N11.** Thời gian một lệnh xác nhận giữ khoá luồng (từ lệnh ghi quyết định tới commit) có trần mục tiêu dưới 500 ms trên dự án lớn nhất của dữ liệu thật; số đo hiện có là của dữ liệu giả (2,3–2,7 ms ở 99,8 nghìn bản).
- **N12.** Lệnh kiểm triển khai (và phép kiểm lúc khởi động của dịch vụ, khi có) xác nhận `tgenabled = 'A'` cho trigger cấp số và `'O'` cho trigger xác nhận của 023 (cùng loại R19 của PR #22; `pg_restore --disable-triggers` đặt `A` về `O`).
- **N13.** Kế hoạch lùi của lần triển khai ghi: trước lần xác nhận nháp ứng viên đầu tiên, lùi 023 làm được; sau đó chỉ còn forward-fix.
- **N14 (kế hoạch).** Thiết kế login AI phải tính rằng 023 (áp hoặc áp lại) từ chối khi có login thành viên `libetech_ai` đang kết nối, và phép kiểm đó chỉ có ca hành vi dưới tên role thay thế, không dưới role AI thật (điều kiện N14 của kế hoạch).

## Phần dư và giới hạn (cổng Codex ở PR #22 không nhận «phần dư đã ghi» cho ba lớp — kiểm-rồi-bên-khác-commit, rò oracle, hash của nội dung bị che; cột cuối nói vì sao mục không thuộc ba lớp ấy)

| # | Mục | Vì sao không thuộc ba lớp |
|---|---|---|
| L1, L2, L11 | giữ oan: bản sửa cũ đến muộn; tin đến muộn ngoài cửa sổ 20 tin; luồng mà bản ghi sau cùng thuộc tin chỉ-con-trỏ | giữ nháp, không bao giờ cho một lệnh xác nhận đi qua nhờ chúng; hết khi luồng có tin mới |
| L3 | các giao dịch nhận tin của một luồng chạy lần lượt; một giao dịch để mở chặn luồng (`55P03`) | chính cơ chế đóng khe; từ chối thành tiếng, không ghi gì; N1 |
| L4 | role runtime giữ được khoá luồng bằng một dòng quyết định hợp lệ rồi để giao dịch mở | cùng loại với R34 của PR #22; không tự lấy được bằng `SELECT … FOR`; không lộ dữ liệu; N1 |
| L5 | kênh thời gian TRONG phạm vi (người quyết định thấy lệnh của mình chờ khi có tin đang nhận) | người đó đọc được hộp tin của dự án; ngoài phạm vi không có chờ (đo 5d, 5e; ca N20, N21) |
| L6 | `subject_thread_seq` do dịch vụ trao: không phải bằng chứng luật của dịch vụ đã chạy | một phiên SQL thô dưới login web đã có mức tin cậy này (R34); ghi trong `COMMENT ON COLUMN` |
| L7, L12 (N22) | một bản không có số commit **sau** phép kiểm của trigger xác nhận và **trước** commit của giao dịch quyết định: nay chỉ còn khi **chủ bảng hoặc superuser** `DISABLE TRIGGER` theo tên, ghi và `ENABLE ALWAYS` trong một giao dịch mà không khoá dòng đếm (đường `replica` và trigger bị tắt/vắng đã commit đã **đóng**: `ENABLE ALWAYS`, phép kiểm bản thiếu số, phép kiểm `tgenabled`); trigger quyết định vắng ⇒ khe mở lại | cùng ranh giới tin cậy với R19/R37 của PR #22 (cổng Codex vòng 3 PASS với nó ghi nhận): người đó cũng tắt được mọi guard; không có phiên không đặc quyền nào làm được (đo 4 role: `SET session_replication_role`, `DISABLE TRIGGER`, khoá bảng đều bị từ chối); ghim bằng ca N22; phương án thêm constraint trigger hoãn phía người ghi (CS-S-1 B) và khoá bảng (loại: chặn nhận tin của mọi dự án) đã cân, không làm |
| L8 | lùi rồi áp lại 023 đánh số theo `created_at` | đóng bằng bốn phép từ chối cơ học của 023 (kiểm dưới khoá, hai lần); phần dư: một lần chạy pipeline đã ngắt kết nối (N10) |
| L9 | R39 của PR #22: một bản lưu chữ của nhóm không bật cờ commit sau phép kiểm theo dự án của `decide` (luồng khác của dự án) | không ảnh hưởng độ mới của nháp; chữ đó mới hơn nháp nên không thể nằm trong nháp; với cùng luồng nay đóng bằng `LTZ03` |
| L14 (P13) | câu trả lời của lệnh xác nhận nay tả trạng thái **lúc kiểm** (hai kết quả chữ-bị-ẩn đã tính được truyền vào `present`, không quét lại sau lệnh ghi): cửa sổ của câu trả lời rộng ra từ «sau lệnh ghi» thành «từ phép kiểm» | không lộ thêm: (i) nháp bất biến (`ai_drafts_immutable`) nên nội dung là hàm của các tin đã commit trước nháp — tin có chữ ẩn đến sau phép kiểm cũng đến sau nháp; (ii) đường còn lại là nhãn `IBS_HI` đổi: trước lệnh ghi thì guard 022 từ chối (`LTZ01`), sau lệnh ghi thì ghi nhãn chờ khoá dòng dự án mà lệnh xác nhận giữ tới commit. Ca K4 và đột biến m6/m8/m9 của Task 7 chết |
| L15 | một người đọc không có quyền quyết định chờ sau lệnh xác nhận của điều phối (lấy khoá tư vấn theo nháp trước phép kiểm quyền; 2 013 ms so với 7 ms khi một xác nhận đang chờ khoá luồng) — CS-S-2 | có từ PR #22 (T3-M4); người đó đọc được hộp tin của dự án (cùng loại L5); sửa (kiểm quyền trước khoá) đổi hợp đồng «authority first» của lệnh gửi lại |
| L16 | giao dịch nhận tin/xác nhận bị treo chặn luồng (`idle_in_transaction_session_timeout` chưa đặt trong `src/server/db.ts`) — CS-S-3 | khả dụng, không phải ba lớp; N1 giữ là điều kiện triển khai |
| L17 | tin trả lời đến lúc tin gốc chưa commit thành luồng riêng — CS-S-4 | có từ lát 2, `intake.ts` ngoài PR; câu hỏi mở OQ-58 |
| L13 | nguồn con trỏ dùng được làm `basis` cho nhận định về **nội dung** bản chưa duyệt | chỉ là bịa, không phải rò (không có nội dung nào trong ngữ cảnh); S-7 chấp nhận; nguồn `document` đã đủ cho nhận định về sự tồn tại |

## Điểm dừng — không làm, chờ Chairman

(Merge PR: đã làm ngày 19/11/2026, `b978163`.) Còn lại: áp 023 lên dữ liệu thật · triển khai d1-ai1 · khởi động lại gateway chung · gửi tin vào nhóm thật · tuyến đọc/xác nhận nháp · login hay khoá cho role AI · bật Z4 · quyết N6 (và pipeline) · OQ-54, OQ-55 (b), OQ-56.

## Cần Chairman quyết hoặc xác nhận

1. Merge PR: đã làm ngày 19/11/2026 (`b978163`). Còn lại: áp 023 (sau N1–N5).
2. Xác nhận cách hiểu C1–C8, C10 và C11; đặc biệt C1 (số bản, không hash), C5 (đổi đường nhận tin ở tầng CSDL, `intake.ts` không đổi) và C7 (giữ oan được chấp nhận).
3. N6: pipeline phải ghi `messageRevisions` từ ngữ cảnh — điều kiện chặn trước khi bật Z4.
4. Quy trình sửa luồng bị giữ mãi (N15) và chỉnh quy trình phục hồi dữ liệu (N4).
5. Hai chỗ R10-g còn nhắc nghĩa cũ ở hồ sơ lát trước (`docs/plans/slice-3-review-skills.md:992`, `docs/DELIVERY-012-review-skills-20261115.md:247`): không sửa tại chỗ; Chairman muốn ghi chú hay để nguyên.

## Ngoài phạm vi (có từ trước hoặc không thuộc PR; không sửa)

Ca F-5 của `tests/review-delegations.test.ts` thỉnh thoảng đỏ trên PGlite (đã sửa ở PR #23, merge `711faf1` ngày 19/11/2026); `src/server/document-dependencies.ts` dòng 51 làm coverage nhánh dao động; repo không có CI nên mọi kiểm ở trạng thái `manual`; «xanh trên PostgreSQL 16» là số của lượt chạy trong phiên, chưa có CI nào chạy lại.

## Sự cố và môi trường của phiên

- Container thử `libetech-slice1-pg` lúc đầu đang dừng: phiên khởi động nó, tạo CSDL riêng `slice1_verify_531119` và một role vận hành tạm; các ghế review dùng CSDL riêng và đã xoá. Cuối phiên: CSDL `slice1_verify_531119` và role vận hành tạm đã xoá, tệp môi trường tạm ngoài repo đã xoá, container dừng lại như lúc đầu.
- Một ghế review CSDL đột biến tệp migration tại chỗ trong cùng cây làm việc khi ghế bảo mật đang chạy; ghế bảo mật chuyển sang bản sao `git archive`; từ đó mọi ghế đột biến trên bản sao ngoài repo.
- Nhiều lượt chạy vitest do reviewer khởi động khi `pgrep` còn báo tiến trình của ghế khác (đều trên CSDL riêng hoặc PGlite trong bộ nhớ): đã ghi trong báo cáo từng ghế; kết quả không bị ảnh hưởng.
