# Soát lại bảo mật — Task F1b (khoá dòng thay khoá tư vấn), PR mã OQ-45 và OQ-46

- Nhánh `feat/oq-45-46-ai-drafts`, BASE `f434f0a`, HEAD `56d257c` (một commit).
- Gói soát: `.superpowers/sdd/oq-45-46-ai-drafts/review-F1b-f434f0a..56d257c.diff`; đọc thêm tệp hiện hành `migrations/022_ai_drafts_pointer_only_guard.sql`, kế hoạch `docs/plans/oq-45-46-ai-drafts.md:1383-1694` (bản 0.7: R34, điều kiện 18, 23, 24), phần đầu `docs/reviews/oq-45-46-evidence-20261118/measurements-pg16-rowlock.txt`.
- Phạm vi: chỉ diff này; báo cáo trước (`gates/review-codex-fix1-security.md`) không sửa.
- Chế độ: chỉ đọc. Không chạy vitest, không chạm CSDL. Mọi số đo PostgreSQL 16 là của phiên chính.
- Lời Chairman chỉ được trích bằng các chuỗi đã chuyển: «OQ-45: 1b, 2b, 3b. OQ-46: b, mốc là bản mới nhất nháp nêu» và «B: chặn tạm (Recommended)».

## Kết luận

| Câu hỏi | Trả lời |
|---|---|
| A. Phép từ chối dòng dự án không thấy được có cho role chịu RLS câu trả lời mới không | **Không** về nhãn, về tenant khác, về dự án đang được tạo. Một bit thời gian trong phạm vi tự khai nay có dạng khác (S-6, P3) |
| B. Hàm definer thứ hai | Ghim đúng: `search_path`, `row_security = off`, `lock_timeout`, `REVOKE … FROM PUBLIC`, chủ là superuser/`BYPASSRLS`, `VOLATILE`, thân một câu khoá theo khoá chính. Năng lực mới cho người ghi ánh xạ chỉ phát sinh khi có grant tương lai — điều kiện 24 nêu đúng |
| C. Phần dư R34 bản 0.7 | Nêu đúng cỡ. **S-1 đóng** |
| D. S-2, S-3, S-4 | Đã áp (S-3 theo cách khác, tương đương) |
| E. Bật, bí mật, đường dẫn, chat id | Không thấy |

| Mức | Số |
|---|---|
| P0 | 0 |
| P1 | 0 |
| P2 | 0 |
| P3 | 2 |

## A. Câu trả lời cho dòng dự án không thấy được

Thứ tự với một role chịu RLS (`migrations/022_ai_drafts_pointer_only_guard.sql`): trigger phạm vi `42501` → mức cô lập `LTZ02` → dòng dự án không thấy được `23503` → chờ khoá `55P03` khi tới trần → nhãn `LTZ01`.

- **Tới bước `23503` phải qua trigger phạm vi.** Chỉ cặp (tenant, dự án) mà role tự khai mới tới được hàm definer; ngoài đó mọi dự án nhận cùng câu `42501` (G9, G19, G26 nay so năm trường, xem D).
- **Tồn tại của cặp (tenant, dự án).** `#fact` Trước F1b, khoá ngoại ghép `ai_drafts_project_id_tenant_id_fkey` đã trả `23503` cho cặp không có, ở cuối câu lệnh. Bit «cặp có thật» vì vậy không mới; nó thuộc R33 (phạm vi tự khai). Câu của trigger thiếu `DETAIL` mà câu khoá ngoại gốc có, và có `HINT`; nhưng sau F1b mọi `23503` của bảng nháp tới từ trigger (khoá ngoại chỉ còn tự trả lời khi dòng dự án bị xoá giữa câu lệnh — không đường nào xoá), nên hình dạng câu không phân biệt hai trường hợp nào.
- **Tenant khác.** `#fact` Cả hai hàm lọc `p.tenant_id = NEW.tenant_id`. Một dòng nêu dự án của tenant U với tenant T đã khai: không thấy dòng → `23503`, **không khoá dòng của U**, không đọc ánh xạ, không chờ ai của U. Không có vế lọc tenant thì role AI khoá được dòng dự án của tenant khác — vế này cần và đúng. G4, N1 (c) ghim.
- **Dự án đang được tạo.** `#inference` Dòng `projects` chưa commit không thấy được dưới ảnh chụp của câu `PERFORM`, và `FOR NO KEY UPDATE` không chờ dòng không thấy được: «đang được tạo» và «không có» cùng nhận `23503` ngay, không độ trễ khác nhau. N3 đo «ngay» trên PG16 theo lời phiên chính. Trước F1b, trường hợp này cho cùng câu `23503` (nếu giao dịch tạo chưa commit lúc khoá ngoại chạy) hoặc **lưu nháp** (khe B-1) — nay là đóng.
- **Nhãn.** Bước `23503` đứng trước câu đọc ánh xạ: không bao giờ có `LTZ01` cho cặp không thấy được.
- **`NULL`.** Hàm bỏ qua khoá khi `tenant_id` hoặc `project_id` rỗng; bảng trả `23502`. Với role chịu RLS, trigger phạm vi trả `42501` trước đó. Không lỗ.
- **Điều còn lại:** bước `55P03` (S-6).

## B. Hàm definer thứ hai (`intelligence.project_domain_mappings_draft_lock`)

- `#fact` `:83-99` của tệp hiện hành: `SECURITY DEFINER`, `SET search_path = pg_catalog, pg_temp`, `SET row_security = off`, `SET lock_timeout = '5s'`; mọi tên có schema; không SQL động, không tham số, chỉ một `PERFORM … FOR NO KEY UPDATE` theo khoá chính và một `RAISE`. `REVOKE ALL … FROM PUBLIC`.
- `#fact` Ca ghim: G12 (`prosecdef`, `proconfig`, `provolatile` của ba hàm; chủ của hai hàm definer là superuser hoặc `BYPASSRLS`), G20 (role AI không gọi, không `ALTER FUNCTION … SET lock_timeout = 0` được; ACL chỉ có chủ), G11 bản song sinh (chủ hàm khoá đổi sang role bị RLS lọc → mọi lệnh ghi ánh xạ bị từ chối, không dòng nào), N2 (cặp không có → `23503`, `lock_timeout` của phiên không bị đổi sau lệnh).
- **Người ghi ánh xạ làm được gì thêm.** Hôm nay không role không-superuser nào có `INSERT` trên bảng ánh xạ, nên không ai có thêm gì. Với một grant tương lai: (i) khoá `FOR NO KEY UPDATE` dòng dự án của cặp nó nêu, **kể cả của tenant khác**, trước `WITH CHECK`, và giữ khoá tới hết giao dịch — kể cả khi câu lệnh đã lỗi và giao dịch ở trạng thái huỷ chưa `ROLLBACK`; (ii) phân biệt «cặp có thật» (`42501` từ RLS sau khi khoá) với «không có» (`23503` từ trigger) của tenant khác — lớp CX1; (iii) qua thời gian chờ, biết một giao dịch nháp/ánh xạ của dự án tenant khác đang mở. Điều kiện 24 nêu (i)–(iii) và đòi trigger soi phạm vi trước; đủ. Một role không chịu RLS được cấp `INSERT` là role tin cậy ngang login vận hành.
- So với thiết kế A: năng lực khoá không còn cho mọi role; nó đi kèm quyền ghi một bảng mà hôm nay chỉ superuser có.

## C. Phần dư (R34 bản 0.7) và S-1

- **Ai hoãn được lệnh ghi ánh xạ.** Một giao dịch đã đưa một dòng nháp thật của dự án qua cả hai trigger và còn mở (role AI trong phạm vi tự khai, hoặc login vận hành); một giao dịch ghi ánh xạ khác của dự án đó; một role ghi được `public.projects` (không role runtime nào; phiên chính đo `42501` cho cả mười role `libetech*`, kể cả `libetech_identity` và `libetech_intake` mà báo cáo trước ghi là chưa đo). Khớp với `docs/plans/oq-45-46-ai-drafts.md` R34.
- **Bao lâu, thành tiếng ra sao.** Mỗi lần thử `55P03` sau 5 giây, CONTEXT nêu tên hàm; không có dạng mức phiên; giao dịch bị để mở chỉ bị chặn bởi `idle_in_transaction_session_timeout` chưa đặt (điều kiện 18). Thay `FOR SHARE` bằng `FOR NO KEY UPDATE` loại được việc các giao dịch nháp ngắn gối nhau bỏ đói lệnh ghi ánh xạ mà không trần nào bắt — tôi đồng ý đó là chọn đúng; ý của báo cáo trước (B dùng `FOR SHARE`) sai ở điểm này.
- **Cái giá mới** — nháp của một dự án ghi lần lượt; giao dịch nháp mở làm `UPDATE`/`DELETE` dòng dự án chờ không trần; vòng khoá chết khi hai giao dịch khoá hai dự án ngược thứ tự; khó thấy người giữ khoá; mức khoá cao hơn trên một dòng Z1 (không ghi cột nào) — đều đã ghi ở R34, điều kiện 18 và 23. Không thấy chỗ nào ghi nhẹ hơn thật, trừ S-6.
- **S-1: đóng.** Ba login dịch vụ không còn lấy được khoá; không có dạng mức phiên; kênh `pg_locks` xuyên tenant không còn (N6 ghim rằng khoá tư vấn cũ không còn quyết điều gì).

## D. S-2, S-3, S-4

- **S-2 — đã áp.** `answer()` so `code`, `message`, `detail`, `hint`, `where` (`tests/z4-pointer-guard.test.ts`, dòng `const answer=` của diff).
- **S-3 — đã áp, cách khác.** Lệnh có thể chờ chạy dưới `SET LOCAL statement_timeout = '8s'` (`capped`, `cappedAi`), ca có timeout 20 giây; thiếu trần thì hiện thành `57014` trong phép `expect` trên mã, tức `AssertionError`, không phải timeout của vitest. Tương đương điều tôi đề nghị.
- **S-4 — đã áp.** Dòng «cặp» gửi kèm `revision` → `INVALID_INPUT` 422; không kèm → `heldOnly('ENTITY_NOT_FOUND','SUBJECT_ORDER_UNVERIFIED')`.

## E. Bật, bí mật, đường dẫn, chat id

- `#fact` Diff không có `GRANT`, `CREATE ROLE`, `ALTER ROLE`, login, mật khẩu, tuyến, lời gọi mô hình; không đổi `src`. Hai hàm definer không gọi trực tiếp được.
- `#fact` Grep diff, ba tệp bằng chứng `codex-fix1-F1b-*.txt` và tệp đo `measurements-pg16-rowlock.txt`: không có đường dẫn máy cục bộ, chuỗi kết nối hay chat id dạng thật; tệp đo ghi rõ chỉ dùng mã tổng hợp trong schema nháp đã xoá.

## Finding

| # | Mức | Chỗ | Kịch bản | Sửa |
|---|---|---|---|---|
| S-6 | P3 | `migrations/022_ai_drafts_pointer_only_guard.sql:66` (`PERFORM … FOR NO KEY UPDATE` trong guard) · `docs/plans/oq-45-46-ai-drafts.md` R33, R34 (bản 0.7) | `#inference` Người giữ role AI tự khai (tenant T, dự án P) — được với bất kỳ cặp nào (R33) — rồi thử chèn một nháp và rút lại. Chờ tới `55P03` hay qua ngay cho biết **một giao dịch chèn nháp hay ghi ánh xạ của P đang mở** lúc đó, xuyên tenant, không để lại dòng. Trước PR không có bit này (khoá ngoại `FOR KEY SHARE` không xung đột với chèn ánh xạ); bản 0.6 có nó cho mọi role qua `pg_locks`. Bản 0.7 hẹp hơn cả hai — nhưng R34 nay chỉ ghi «kênh `pg_locks` đã mất», không ghi kênh còn lại. Không lộ nhãn. | Một câu trong R33 hoặc R34: lần chờ của guard cho role AI biết, trong phạm vi tự khai, lúc một giao dịch nháp/ánh xạ của dự án đang mở; đóng hẳn thuộc thiết kế login AI cùng R33. Không sửa mã |
| S-7 | P3 | `tests/z4-pointer-guard.test.ts` G20 (vòng lặp `FOR NO KEY UPDATE`/`FOR SHARE` của diff) | Kết luận «không role runtime nào tự lấy được khoá dòng» — nền của R34 và điều kiện 23 — được đo cho mười role `libetech*` ở tệp đo ngoài ca, nhưng ca trong repo chỉ thử `libetech_ai` và `libetech_runtime`. Một grant tương lai `UPDATE` (dù một cột) trên `projects` cho `libetech_identity` hoặc `libetech_intake` sẽ trả lại năng lực khoá cho login auth hay intake mà không ca nào đỏ. | Thêm vào vòng lặp của G20 hai role nhóm còn lại (`SET LOCAL ROLE libetech_identity` / `libetech_intake`), hoặc một câu catalog: không role nào ngoài superuser có `UPDATE`/`DELETE`/`TRUNCATE` trên `public.projects` |

## Không kiểm được từ diff

- Mọi hành vi PostgreSQL 16 (khoá dòng không chờ dòng chưa commit, thứ tự phục vụ người chờ, `55P03` đúng 5 giây, `42501` của mười role): theo tệp đo và lời phiên chính; người soát không chạy.
- `idle_in_transaction_session_timeout` có cắt một phiên ở trạng thái giao dịch đã huỷ (còn giữ khoá dòng) hay không: `#inference` có, theo tài liệu; chưa đo.
- Các lượt đỏ/xanh `codex-fix1-F1b-*.txt`: chỉ grep tìm đường dẫn và bí mật, không đọc từng dòng.
- Toàn văn tệp lùi sau F1b: diff chỉ đổi 4 dòng chú thích theo gói; không đối chiếu lại thân.

VERDICT: READY FOR GATE
