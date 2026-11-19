VERDICT: READY_TO_BUILD

# Review CSDL kế hoạch OQ-53 · vòng 1 · cổng soát kế hoạch (trước khi có mã)

Đối tượng: `docs/plans/oq-53-subject-verification.md` bản 0.1 (commit `725c5da`) và `docs/reviews/oq-53-evidence-20261119/` (`measurements-pg16.txt`, `probe-1.cjs`, `probe-2.cjs`). Ghế: review CSDL, độc lập, khuyến nghị (R1/R2). Ngày 19/11/2026.

**READY_TO_BUILD** nghĩa là: thiết kế CSDL (số theo luồng bằng dòng đếm khoá tới commit; trigger `AFTER INSERT`; so-và-ghi `FOR NO KEY UPDATE` phía xác nhận; hai bảng phụ) đứng vững khi đo lại bằng SQL thật của 016/021/022, không tìm thấy P0 hay P1. Ba mục P2 (DB-1…DB-3) phải được gấp vào bản 0.2 của kế hoạch hoặc vào Task 1/2 trước khi builder viết tệp `023`; bảy mục P3 là sửa chữ hoặc ca kiểm. Đây là cổng soát kế hoạch: SQL thật của 023 vẫn phải qua review riêng ở Task 1 và Task 2 như kế hoạch đã ghi.

| Mức | Số finding |
|---|---|
| P0 | 0 |
| P1 | 0 |
| P2 | 3 (DB-1, DB-2, DB-3) |
| P3 | 7 (DB-4 … DB-10) |

## 0 · Cách làm và giới hạn

- Dựng bản sao trung thực trong hai schema nháp của CSDL thử riêng của phiên (PostgreSQL 16.15), bỏ cuối phiên (kiểm lại: không còn schema, không còn kết nối): chạy **nguyên văn** `016`, `021`, `022` (chỉ đổi tên schema, bỏ phần tạo role và `schema_migrations`), rồi mục 7 của kế hoạch như tôi đọc nó. Chính sách RLS, trigger, quyền cột, trigger bất biến, hàm `SECURITY DEFINER` của ba tệp đó chạy thật; không bảng ứng dụng nào bị đụng, không áp migration nào, không chạy vitest.
- Phần kế hoạch chỉ mô tả mà không đưa SQL (thân backfill bước 8; tệp lùi) tôi viết theo đúng mô tả. Khối kiểm P6 **không** được dựng, nên P6 chỉ được suy luận, không đo. SQL thật của 023 chưa tồn tại: mọi số ở đây là số của bản sao.
- Kịch bản dùng `pg` (nhiều kết nối), `psql` trong container thử (cho `COPY`) và PGlite trong bộ nhớ (cho U3). Kịch bản nằm ngoài repo, trong thư mục tạm của phiên; không in chuỗi kết nối.
- Nhãn: **[đo]** = tôi đo ở phiên này; **[mã]** = đọc từ tệp; **[đo của planner]** = số trong `measurements-pg16.txt` mà tôi không đo lại; **#inference** = chưa kiểm.

## 1 · Finding

| Mã | Mức | Vị trí | Tóm tắt |
|---|---|---|---|
| DB-1 | P2 | §7 bước 2, 3, 5; §20 | Mục 7 tuyên bố idempotent nhưng bước 2, 3, 5 không nói `DROP … IF EXISTS` cho trigger và policy: chạy lần hai lỗi `42710` |
| DB-2 | P2 | §6 W8; §16 N3; §18 U2 | Cửa sổ khoá của migration: số thật gấp đôi số đo, thiếu ACCESS EXCLUSIVE trên `draft_decisions`, thiếu trần kích thước |
| DB-3 | P2 | §7 bước 2; §19 hỏi CSDL 8 | Bảng đếm có ghi đồng thời mà không có `version`: E-DB-12 là MUST*, cần ghi nhận ngoại lệ có lý do |
| DB-4 | P3 | §16 N1, N2; §18 U1 | U1/N2 đóng được bằng mã của gateway; N1 còn mở: repo không đặt `idle_in_transaction_session_timeout` ở đâu |
| DB-5 | P3 | §9 bảng «Ai lấy được khoá», dòng `libetech_runtime` | Mã trả về sai chữ: ngoài phạm vi là `P0001` (guard 021), không phải `42501` |
| DB-6 | P3 | §9 câu «Khoá luồng luôn là khoá cuối cùng» | Không đúng với đường nhận tin; thiếu cạnh «giao dịch phân loại ứng viên»; thời gian giữ khoá của `decide` chưa nêu |
| DB-7 | P3 | §13 Task 1, ca A2 | Khẳng định `xmax = 0` mong manh: một khoá đã commit vẫn để `xmax` khác 0 |
| DB-8 | P3 | §2, §18 U3; `measurements-pg16.txt` | PGlite của repo là PostgreSQL 18.6, không phải 16; U3 đã đo cho đúng SQL của kế hoạch |
| DB-9 | P3 | §7 tệp lùi; §17 L8 | Sau lần xác nhận đầu tiên migration chỉ còn đường tiến; áp lại sau lùi đảo thứ tự số |
| DB-10 | P3 | §13 A3, A6, B3 | Ca catalog nên khẳng định «đúng một policy SELECT, không quyền ghi, không BYPASSRLS»; chữ lỗi cố định |

### DB-1 · [P2] · Idempotent chưa được nêu ở bước 2, 3, 5 (E-DB-04, M-02)

- **Vị trí:** kế hoạch dòng 106 («idempotent … M-02»), dòng 111–112 (trigger `intake_thread_heads_no_delete`, `source_revision_positions_immutable`), dòng 114 (policy), dòng 131 (chỉ bước 9 nói `DROP TRIGGER IF EXISTS`).
- **Lỗi:** `CREATE TRIGGER` và `CREATE POLICY` không có `IF NOT EXISTS`. Tệp theo đúng chữ của mục 7 chạy lần hai là lỗi.
- **Kịch bản:** áp bước 2–3 lần hai → `42710 trigger "intake_thread_heads_no_delete" for relation "intake_thread_heads" already exists` **[đo]**. Ca có sẵn `tests/migrations-rollback.test.ts:58` (`for(let pass=0;pass<2;pass++)` áp mọi tệp hai lần) sẽ đỏ; Quality Gate M-02 ghi «Reject — phải sửa».
- **Bằng chứng:** các bước 8, 9, 10, 11 áp lần hai sạch **[đo]** (backfill chỉ đánh số bản chưa có số; `DROP TRIGGER IF EXISTS` + `CREATE`; khối `DO` kiểm `pg_constraint`; `CREATE OR REPLACE FUNCTION`). Chỉ bước 2, 3, 5 thiếu.
- **Sửa (mức kế hoạch):** ghi vào mục 7 mẫu của 016/021: `DROP TRIGGER IF EXISTS … ON …; CREATE TRIGGER …` cho cả bốn trigger; `DROP POLICY IF EXISTS …; CREATE POLICY …` cho cả hai policy; `CREATE INDEX IF NOT EXISTS`; `GRANT`/`REVOKE` đã tự idempotent. Ca A6 (chạy 023 hai lần, catalog không đổi) giữ nguyên là phép kiểm.

### DB-2 · [P2] · Cửa sổ khoá của migration trên dữ liệu thật (W8, N3, U2)

- **Vị trí:** dòng 100 (W8), 469 (N3), 502 (U2), bước 8 và 10 của mục 7.
- **Lỗi (ba ý):**
  1. **Số đo không phải số thật.** Đo 6a (260 ms / 60 000 bản) dùng bảng không có khoá ngoại. Với hình dạng thật (hai khoá ngoại có kiểm mỗi dòng, ba chỉ mục duy nhất, năm chỉ mục) **[đo]**: 60 000 bản → 520 ms; 300 000 bản → 3,3 s (tuyến tính, ≈ 11 µs/bản). WAL 44 MB cho 60 000 bản vì mỗi kiểm khoá ngoại đặt khoá `KEY SHARE` lên dòng của `source_event_revisions` (ghi `xmax` vào từng dòng cũ). `size`/`relfilenode` của bảng cũ không đổi, nhưng trang bị ghi.
  2. **Trần.** Trong cả cửa sổ đó mọi `INSERT` vào `source_event_revisions` chờ. Pool của dịch vụ có `statement_timeout: 10000` (`src/server/db.ts:32`); gateway có `HOOK_TIMEOUT = 2` (`bot-plugin/__init__.py:59`). Ở khoảng 900 000 bản cửa sổ chạm trần 10 s: tin vào lúc đó nhận 500 hoặc hết giờ phía gateway (bị đưa vào hàng đợi, không mất: DB-4). Kế hoạch chấp nhận «vài trăm mili giây» mà không có phép đếm trước và không có trần.
  3. **Bước 10 giữ `ACCESS EXCLUSIVE` trên `draft_decisions` tới commit.** `ALTER TABLE … ADD COLUMN` chặn cả `SELECT` thường tới khi cả giao dịch migration commit **[đo]**: một đọc `SELECT count(*) FROM draft_decisions` chờ 507 ms trong lúc mô phỏng. W8 chỉ nói `source_event_revisions`. Z4 chưa bật nên chưa đau; thứ tự của tệp (bước 10–11 **sau** backfill) làm cửa sổ ngắn nhất và phải được giữ khi Task 2 «sửa 023».
- **Cũng đã đo, đạt:** một `INSERT` đến lúc migration đang giữ khoá chờ rồi **được đánh số bởi trigger của migration** (vị trí 1, 2; không bản nào thiếu số) **[đo]**; một giao dịch nhận tin đang mở lúc migration bắt đầu làm migration hết `lock_timeout` sạch (`55P03` sau 1 s, không còn bảng nào) rồi áp được sau khi giao dịch kia commit **[đo]**.
- **Sửa (mức kế hoạch):** (a) điều kiện tiên quyết mới ở §16: chạy `SELECT count(*) FROM source_event_revisions` trước khi áp và ghi vào biên nhận; đặt trần (đề xuất 500 000 bản, tương ứng ≈ 5,5 s), quá trần thì dừng và xin kế hoạch chia lô trước; (b) sửa W8: số của hình dạng thật, thêm dòng `ACCESS EXCLUSIVE` của `draft_decisions` và «bước 10–11 phải ở cuối tệp»; (c) tuỳ chọn, giảm thời gian giữ khoá: tạo chỉ mục duy nhất thứ hai và khoá ngoại **sau** backfill (không phải `NOT VALID` nếu muốn giữ một giao dịch); (d) thêm `ANALYZE source_revision_positions, intake_thread_heads;` vào cuối tệp, vì bảng mới chưa có thống kê tới khi autovacuum chạy. Ghi trong §16 N3: thứ tự triển khai là migration **trước**, mã sau (L8 phụ thuộc vào điều này).

### DB-3 · [P2] · Dòng đếm ghi đồng thời không có `version` (E-DB-12, Quality Gate dòng 18)

- **Vị trí:** bước 2 của mục 7 (không có cột `version`); câu hỏi CSDL số 8 (dòng 531).
- **Lỗi:** E-DB-12 là MUST nếu bảng có ghi đồng thời; `intake_thread_heads` đúng là bảng ghi đồng thời. Kế hoạch lý giải bằng một câu hỏi, không bằng một ngoại lệ được ghi.
- **Nhận định kỹ thuật: lý giải của planner đúng.** Mục đích của khoá lạc quan là chống mất cập nhật; ở đây mọi ghi là `last_seq = last_seq + 1` dưới khoá dòng giữ tới commit, bởi một hàm duy nhất, nên không có đường mất cập nhật. Đo: 3 000 lần cập nhật một dòng, 100 % là HOT (2 926 / 2 926), bảng 8 kB, `n_dead_tup` 28 **[đo]**; thử tải 45 s với 4 bên nhận tin, 2 bên xác nhận: 26 304 giao dịch nhận tin, mọi dòng đếm bằng số dòng số của luồng, 0 bản thiếu số **[đo]**. `last_seq` tự là bộ đếm đơn điệu.
- **Sửa:** ghi ngoại lệ ngay trong chú thích đầu 023 và một dòng trong mô tả PR: «E-DB-12 không áp: bảng chỉ được ghi bởi `source_event_revisions_thread_position()`, dưới khoá dòng giữ tới commit, bằng tăng nguyên tử; `last_seq` chính là phiên bản». Nếu không ghi, dòng 18 của Quality Gate (MUST*) bị reviewer PR bắt lại.

### DB-4 · [P3] · U1/N2 đóng được; N1 còn mở

- **Vị trí:** dòng 467–468 (N1, N2), 501 (U1).
- **N2/U1 (có bằng chứng bằng mã):** gateway `bot-plugin/__init__.py:188-210`: mã 5xx và hết giờ được phân loại `answered`/`network`, **không loại nào xoá tin**; `answered` (404, 408, 429, 5xx) được gửi lại và tính vào `SPOOL_MAX_ATTEMPTS = 5` hoặc `SPOOL_MAX_AGE = 24 h` (dòng 48–51) rồi mới sang tệp `intake-dead.jsonl`; không có câu trả lời (`status 0`) thì giữ nguyên thứ tự và không đếm. `HOOK_TIMEOUT = 2` giây (dòng 59): một lần chờ khoá luồng quá 2 s là hết giờ phía gateway, không phải 500. Gửi lại là idempotent (`ON CONFLICT … DO NOTHING`, `src/server/intake.ts:89-93`; lần gửi lại không đánh số: **[đo]**). Vậy một lần `55P03` tốn một lần thử lại, không tốn một tin. Chỗ còn lại: năm lần liên tiếp nhận 5xx của cùng một tin sẽ sang tệp chết, nên một luồng bị giữ lâu vẫn có thể làm mất tin theo nghĩa «phải xử lý tay».
- **N1 (còn mở):** `grep idle_in_transaction_session_timeout` trên `deploy/`, `scripts/`, `src/` không ra dòng nào; `statement_timeout` của pool (10 s, `src/server/db.ts:32`) không chặn giao dịch **nhàn rỗi** giữ khoá. Sau 023, một giao dịch nhận tin treo giữ khoá luồng của nó tới khi kết nối chết.
- **Sửa:** đóng N2 bằng dẫn chứng trên; giữ N1 là cổng trước khi áp 023 lên dữ liệu thật (không phải cổng xây mã); ghi trong N1 giá trị đề xuất (≤ 30 s) cho login `libetech_intake_svc` và `libetech_web`, và rằng nó phải được kiểm bằng `SHOW` dưới chính login đó, không bằng `pg_roles`.

### DB-5 · [P3] · Mã trả về của role ngoài phạm vi

- **Vị trí:** dòng 218 («`42501` sau 2 ms … `runtime_insert` và `draft_decisions_guard`»); ca B4, N10.
- **Lỗi:** thứ tự thật là: trigger `BEFORE` (`draft_decisions_guard` của 021 → `draft_decisions_pointer_only_guard` của 022) → `WITH CHECK` → `AFTER` (trigger mới). Với nháp **ngoài** phạm vi của người gọi, `draft_decisions_guard` đọc nháp dưới RLS của người gọi, không thấy, và ném `P0001` («A decision names a draft of its own project») sau 1 ms **[đo]**. `42501` chỉ xuất hiện khi nháp thuộc phạm vi nhưng `decided_by ≠ app.person_id`, hoặc khi dòng mang `project_id` ngoài phạm vi mà nháp vẫn thấy được **[đo]**.
- **Hệ quả:** kết luận của kế hoạch giữ nguyên (không chờ, không khoá), chỉ mã sai. Ca B4 viết «`code` khác `LTZ03`» là đúng; N10 nên khẳng định `code` thuộc `{P0001, 42501}` và thời gian < 100 ms.
- **Phát hiện kèm (đúng thiết kế, ghi để khỏi nhầm):** người có nháp **trong** phạm vi và `decided_by` đúng chờ khoá luồng tới 5 s rồi `55P03` **[đo]**. Đó là L4 của kế hoạch, không phải lỗ.

### DB-6 · [P3] · «Khoá luồng luôn là khoá cuối cùng» và thời gian giữ khoá của `decide`

- **Vị trí:** dòng 205, 211; N6/N11.
- **Lỗi:** với **nhận tin** khoá luồng không phải khoá cuối: sau lệnh chèn bản sửa, `IntakeService.ingest` còn chèn `intake_attachments`, `intake_events`, `INSERT … ON CONFLICT DO NOTHING` vào `intake_candidates` (`src/server/intake.ts:113-118`) và dòng outbox. Lệnh chèn ứng viên **chờ** một giao dịch đã `UPDATE` dòng ứng viên chưa commit (xung đột duy nhất đang chờ của `ON CONFLICT DO NOTHING`); `src/server/inbox.ts:159-163` là giao dịch phân loại khoá `FOR UPDATE` rồi `UPDATE` ứng viên. Vậy có cạnh «giữ khoá luồng, chờ dòng ứng viên của giao dịch phân loại». Không có vòng: giao dịch phân loại không lấy khoá luồng ở bất kỳ đâu.
- **Bằng chứng:** thử tải 45 s có một bên phân loại khoá `FOR UPDATE … ORDER BY id` hai ứng viên rồi `UPDATE` (mẫu `inbox.ts:159`) cùng 4 bên nhận tin (kể cả bản sửa và gửi lại), 2 bên xác nhận, 1 bên chèn ánh xạ, 1 bên chèn nháp bằng role AI: 26 304 nhận tin, 1 892 xác nhận được ghi, 4 454 bị `LTZ03`, 1 134 ánh xạ, 1 487 nháp, 2 832 phân loại: **0 lần `40P01`**, 0 xác nhận cũ **[đo]**.
- **Thời gian giữ:** `decide` giữ khoá dòng dự án (022) và khoá dòng đếm **tới commit**, tức cả `present()` sau lệnh ghi (`src/server/suggestions.ts:352-354`, trong đó `projectHasHiddenText` quét mọi bản của dự án khi không có gì ẩn). Đo câu đó: 15 ms ở 60 000 bản, 55 ms ở 225 000 bản **[đo]**. Nhỏ so với `HOOK_TIMEOUT = 2 s`, nhưng chưa được kế hoạch nêu.
- **Sửa:** viết lại dòng 211 thành «với nhận tin, khoá luồng được lấy ở lệnh chèn bản sửa và giữ tới commit; các lệnh sau đó có thể chờ khoá dòng ứng viên; không đường nào giữ khoá dòng ứng viên rồi chờ khoá luồng»; thêm cạnh vào bảng §9; thêm một ca N: phân loại ứng viên đang mở + nhận tin cùng luồng + xác nhận: không `40P01`.

### DB-7 · [P3] · Ca A2 dựa vào `xmax = 0`

- **Vị trí:** dòng 319.
- **Lỗi:** một khoá hàng đã commit để lại `xmax` khác 0 trên phiên bản dòng hiện hành: dòng đếm có `xmax = 0` trước lần xác nhận và `1396608` sau một lần xác nhận đã commit **[đo]**. Ca sẽ đỏ vô cớ nếu tệp chạy sau một ca xác nhận cùng luồng, hoặc xanh vô cớ nếu đọc `xmax` của phiên bản khác.
- **Sửa:** khẳng định «không bị khoá» bằng `SELECT … FOR NO KEY UPDATE NOWAIT` từ kết nối thứ hai trong lúc giao dịch gửi lại còn mở (xanh khi lấy được), hoặc đếm `pg_locks`. Trên PGlite (một kết nối) chỉ khẳng định được số dòng không đổi, đúng như §15 đã ghi.

### DB-8 · [P3] · PGlite của repo là PostgreSQL 18.6

- **Vị trí:** §2 («PostgreSQL 16.15»), §18 U3, đầu `measurements-pg16.txt`.
- **Lỗi:** `@electric-sql/pglite` 0.5.15 trong `node_modules` báo `PostgreSQL 18.6`. Mọi số đo là của 16.15; bộ ca chạy cả hai engine. Không phải lỗi, nhưng «hai engine» là hai phiên bản chính.
- **Bằng chứng:** chạy trong bộ nhớ đúng SQL của mục 7 (hàm `SECURITY DEFINER`, `INSERT … ON CONFLICT … DO UPDATE … RETURNING … INTO`, `SET lock_timeout`/`row_security` ở mức hàm, trigger `AFTER INSERT`, `LOCK TABLE … SHARE ROW EXCLUSIVE`): đánh số 1, 2, 3 và đầu = 3; gửi lại không đánh số; quyết định mang vị trí cũ bị `LTZ03`, vị trí đúng được ghi; `current_setting('transaction_isolation')` thấy `repeatable read` **[đo]**. U3 vì vậy đã đo cho phần cú pháp và cơ chế; ca khoá hai kết nối vẫn chỉ native.
- **Sửa:** sửa U3 thành «đã chạy trên PGlite 18.6, đạt», ghi phiên bản PGlite vào biên nhận.

### DB-9 · [P3] · Tệp lùi: chỉ còn đường tiến sau lần xác nhận đầu; áp lại đảo thứ tự số

- **Vị trí:** dòng 158 (tệp lùi), 83 (P6), 493 (L8).
- **Nhận định:** thiết kế đúng, cần ghi cho người đọc biên nhận. Hai điều đo được:
  1. Khi đã có **một** dòng quyết định `confirmed` mang `subject_thread_seq`, tệp lùi từ chối, và dòng đó không xoá được (`P0001 Append-only…`; `TRUNCATE` là cách duy nhất) **[đo]**. Từ lúc đó 023 thực chất chỉ có đường tiến. Điều này khớp M-03 («rollback hoặc forward-fix plan»), nhưng R-05 của Quality Gate (kế hoạch lùi) phải nói «forward-fix» chứ không «chạy tệp lùi».
  2. Lùi rồi áp lại thay số theo thứ tự commit bằng số theo `created_at`: hai bản A (giao dịch bắt đầu sau, commit trước) và B (bắt đầu trước, commit sau) có số `A→1, B→2` trước lùi và `B→1, A→2` sau áp lại **[đo]**. P6 + việc từ chối lùi khi có vị trí đã ghi chặn đúng chỗ nguy hiểm; đây là thứ L8 nói. Một điều kiện nữa nên ghi vào L8: ngữ cảnh đọc **trước** lần áp lại và nháp ghi **sau** nó chỉ an toàn khi hợp đồng cũ đã bị `MANIFEST_MISMATCH` (C8), tức an toàn vì **nhãn manifest đổi**, không vì P6.
- **Sửa:** chú thích đầu tệp lùi và biên nhận nói rõ «sau lần xác nhận đầu: forward-fix»; thêm vào L8 câu về C8.

### DB-10 · [P3] · Ca catalog và chữ lỗi

- **Vị trí:** A3, A6, B3; dòng 114, 120.
- **(a)** A3/A6 nên khẳng định thêm, từ catalog: mỗi bảng đúng **một** policy `runtime_select` kiểu `SELECT`; không role `libetech_*` hay `PUBLIC` giữ `INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER/REFERENCES` trên hai bảng (ma trận quyền: chỉ `libetech_runtime` có `SELECT` **[đo]**); `rolbypassrls = false` cho `libetech_runtime` và `libetech_intake` (34e). Đó là phép kiểm cho câu «không có policy ghi nào». `tests/rls-catalog.test.ts` chỉ đòi `WITH CHECK` với policy `INSERT/UPDATE/ALL`, nên bảng chỉ có `SELECT` qua được (xem trả lời 3).
- **(b)** Dòng 120 `RAISE …` cho nhánh `23503`: ghi rõ chữ cố định, không đưa `NEW.source_event_id` vào. Bản sao của tôi dùng «The source event of a revision is not visible». Chữ `LTZ03` («The thread of the candidate moved on») không chứa số hay mã; mục `where` của lỗi có tên hàm và số dòng nhưng không phải dữ liệu **[đo]**; `DETAIL` của `23514` (`draft_decisions_thread_seq_only_confirmed`) **không** có «Failing row» với role runtime **[đo]**.

## 2 · Kiểm lại khẳng định của kế hoạch

| Khẳng định | Phép kiểm của tôi | Kết quả |
|---|---|---|
| Số theo luồng = thứ tự commit (đo 1, 2c) | 8 bên ghi (15 % giao dịch bị lùi, 50 % giữ ngẫu nhiên 0–4 ms), 2 bên đọc, 8 s, nhận tin thật với khoá tư vấn. Mỗi lần đọc, trong **một** câu lệnh, so `last_seq`, `max(thread_seq)`, `count(positions)` và số bản của luồng | 5 715 commit, 17 284 lần đọc, **0 vi phạm** |
| Giao dịch bắt đầu sớm commit muộn nhận số lớn hơn | A mở `BEGIN; SELECT now()`, B chèn rồi commit, A chèn rồi commit | `created_at` của A < của B, số A = 2, B = 1 |
| Số không có khe sau lùi giao dịch (đo 2d) | giao dịch chèn rồi `ROLLBACK`, chèn tiếp | số kế tiếp không nhảy |
| `AFTER` không chạy cho dòng bị `ON CONFLICT DO NOTHING` bỏ qua (đo 3) | gửi lại cùng `revision_key` | không dòng nào, đầu không tăng |
| Nhiều dòng trong một lệnh (hỏi 3) | `INSERT … SELECT` bốn dòng cùng luồng; ba dòng hai luồng | 1,2,3,4; 1,2 và 1 |
| `FOR NO KEY UPDATE` đóng cả hai chiều; `FOR KEY SHARE` không đóng (đo 4) | thử tải 20 s hỗn hợp, đo lại bằng đột biến: chỉ đổi mức khoá của trigger | `FOR NO KEY UPDATE`: 865 xác nhận ghi, **0** cũ; `FOR KEY SHARE`: 3 030 ghi, **4** cũ. Máy dò thấy lỗi khi có lỗi |
| So-và-ghi đọc lại dòng sau khi chờ ở READ COMMITTED (đo 4b) | nhận tin mở; xác nhận mang vị trí cũ; commit / `ROLLBACK` nhận tin | commit → `LTZ03` sau 303 ms; `ROLLBACK` → ghi được sau 303 ms |
| REPEATABLE READ/SERIALIZABLE (hỏi 2; U4) | xác nhận trong RR; `SELECT … FOR NO KEY UPDATE` dòng đổi sau ảnh chụp | `LTZ02` (guard của 022 chạy trước); `40001` — fail-closed ngay cả khi `LTZ02` vắng |
| Nhận tin chờ xác nhận đang bay (đo 4 (ii)) | xác nhận ghi, nhận tin chèn | nhận tin chờ 304 ms; đầu 3 → 4 sau cả hai commit |
| Từ chối không lấy khoá luồng (đo 4c) | từ chối với lý do ≥ 5 ký tự khi nhận tin mở | ghi sau 1 ms |
| Ba giao dịch không vòng chờ (đo 8) | thử tải 45 s ở dòng trên của DB-6 | **0 lần `40P01`** |
| Role ngoài phạm vi không chờ (đo 5d, 5e) | RLS trước trigger `AFTER` | đúng, mã sai chữ (DB-5) |
| Không role nào tự lấy được khoá (đo 5a–5c) | mọi role `libetech_*`, bốn mức `SELECT … FOR`; gọi hàm trực tiếp; login web không `SET ROLE` | `42501` ở tất cả (role không có quyền dùng schema nháp nhận `42P01`, vì bản sao của tôi chỉ cấp `USAGE` cho bốn role; trên `public` thật là `42501` như đo của planner) |
| `COPY` (hỏi bảo mật 3) | `COPY … FROM STDIN` vào bảng bản sửa bằng `libetech_intake` | `COPY FROM not supported with row-level security` (cả hai dòng, cả dòng trong phạm vi) |
| `INSERT … SELECT` nhiều dòng trộn phạm vi (hỏi bảo mật 3) | luồng của dự án A đang bị giữ; lệnh có một dòng A, một dòng B, cả hai thứ tự | `42501` sau 0 ms, **không** chờ khoá, không khoá |
| Cửa sổ migration (đo 6) | xem DB-2 | số của hình dạng thật gấp ≈ 2 số của planner |
| pg_dump (N4, hỏi 9) | `pg_dump` dạng thuần của schema nháp | dòng `COPY` (467, 493, 515) **trước** `CREATE TRIGGER` (946, 995); hàm nằm cùng schema |

## 3 · Trả lời cho mười câu hỏi của kế hoạch (mục 19, phần CSDL)

1. **Mục 6 toàn bộ (W3, W4, W8).** *Chấp nhận, kèm DB-2 và DB-4.*
   W1: đúng, cột/chỉ mục/policy/quyền của hai bảng lát 2 không đổi; `source_events` không có trigger mới. W2: đúng; thứ tự thật các trigger `AFTER` trên bản sửa là các `RI_ConstraintTrigger_*` rồi `source_event_revisions_immutable` rồi `source_event_revisions_thread_position` (sắp theo tên, `R` hoa đứng trước chữ thường), tức kiểm khoá ngoại trước, đếm sau **[đo]**. W3: nhận tin cùng luồng chạy lần lượt; ở 8 kết nối, thông lượng cả luồng 2 306 → 1 220 giao dịch/s và p99 4,6 → 21 ms; trải trên 8 luồng chỉ mất 8 % (2 102 → 1 938); một kết nối: 450 → 442 giao dịch/s (≈ 1,8 %) **[đo; giao dịch 5 câu mô phỏng `ingest`]**. U6 của kế hoạch («chưa đo») nay có số. W4: lỗi mới còn có `57014` (trần 10 s của pool) và hết giờ phía gateway sau 2 s (DB-4); `40001` chỉ khi RR; `40P01` không dựng được qua dịch vụ. W5: đúng. W6: đúng (ma trận quyền). W7: đúng, và «`KEY SHARE` dự án lần nữa» sau khoá luồng là các lệnh chèn thuộc nhận tin. W8: DB-2. W9: luật 4 (bản không có số) đóng cho trigger bị tắt; `COPY` và `INSERT … SELECT` không mở lối (bảng §2). W10: đúng.

2. **Bảng phụ thay cột.** *Không, reviewer không muốn cột.* Lý do (tôi tự kiểm được): trigger `AFTER` không thể đặt `NEW.thread_seq`; muốn có cột trên bảng bản sửa thì phải `BEFORE INSERT`, và `BEFORE` chạy trước `WITH CHECK` (role ngoài phạm vi chờ khoá của luồng nó không được ghi, đo 5d của planner) và chạy cả cho dòng `ON CONFLICT DO NOTHING` bỏ qua (đo 3b–3c của planner, không đo lại). Đánh số dòng cũ bằng cột cần tắt trigger bất biến và ghi lại mọi dòng (đo 6c: 8,5 MB → 17,4 MB, của planner). Phép nối thêm: EXPLAIN của một câu theo mục 8 dưới RLS của role runtime cho thấy chỉ có quét chỉ mục (`UNIQUE(revision_id)` của bảng số, `UNIQUE(source_event_id,revision_no)`, `idx_source_events_thread`), không quét tuần tự bảng lớn: 0,4 ms cho luồng 10 tin, 21 ms cho luồng 3 000 tin, trên 60 000 bản **[đo]**.

3. **Hai bảng chỉ có policy `SELECT`.** *Chấp nhận; không cần policy ghi luôn-sai.* Dòng 41 của Quality Gate («cả `USING` và `WITH CHECK`») áp cho policy ghi; dưới `FORCE ROW LEVEL SECURITY` không có policy ghi nghĩa là từ chối mặc định cho mọi role không phải superuser, và không role nào có quyền ghi (ma trận quyền **[đo]**; `libetech_web` không `SET ROLE`: `42501` cho cả `SELECT` và `INSERT`). Hàm `SECURITY DEFINER` do superuser sở hữu bỏ qua RLS đúng như P2. Thêm policy luôn-sai chỉ thêm một chỗ có thể lệch. Việc cần làm là DB-10 (a): biến câu «không có policy ghi» thành phép kiểm catalog.

4. **P6 (từ chối đánh số).** *Chấp nhận; không đổi sang cột «đánh số lúc nào».* Lý do: (i) nó chỉ có thể nổ ở một cấu hình dữ liệu không tồn tại trên dữ liệu thật; (ii) phần lớn trường hợp nguy hiểm đã bị C8 chặn từ trước (mọi nháp cũ bị `MANIFEST_MISMATCH`); (iii) một cột và một phép so thời điểm là thêm một luật thứ hai cho cùng một việc, và thứ tự commit của dòng cũ không còn biết dù có cột. Ghi chú: tôi không dựng P6 nên không đo; điều kiện của P6 nên chỉ đếm nháp có `entity_type = 'intake_candidate'` chưa có dòng quyết định, chữ lỗi cố định. Ca kiểm cũ của `tests/migrations-rollback.test.ts` ở 021/022 tạo một nháp rồi gắn quyết định `rejected` trước khi áp lại hậu duệ (`tests/migrations-rollback.test.ts:441-445`) nên không vướng P6; dù vậy kế hoạch đã nêu «nếu đỏ: báo lại».

5. **Thứ tự P5 và `SHARE ROW EXCLUSIVE` suốt giao dịch.** *Thứ tự: chấp nhận; khoá: chấp nhận có trần, không cần chia lô ở quy mô hiện tại.* Mọi thứ tự xác định đều an toàn vì dòng cũ đều commit trước migration (khoá `SHARE ROW EXCLUSIVE` chờ các giao dịch đang bay) và mọi ngữ cảnh/nháp sau đó đọc cả tập. Chia lô không cần dưới ≈ 500 000 bản (DB-2); trên đó cần kế hoạch riêng vì chia lô làm bản cũ nhận số **sau** bản mới (vẫn an toàn vì luật 4 giữ cho tới khi xong, nhưng phức tạp). Số đo: 0,52 s / 60 000, 3,3 s / 300 000, WAL 44 MB / 60 000.

6. **Trigger quyết định `AFTER INSERT`: thứ tự dự án → luồng giữ ở mọi đường?** *Có; đo 8 đủ cho cấu trúc, thử tải 45 s bổ sung cho các đường còn lại.* Thứ tự firing đã xác nhận (hỏi 1). Cấu trúc không vòng: `KEY SHARE` dự án không xung đột với `NO KEY UPDATE`; không đường nào giữ khoá dòng ứng viên rồi chờ khoá luồng; nhận tin giữ khoá luồng tới commit và có thể chờ dòng ứng viên (DB-6). 0 `40P01` trên 26 304 nhận tin, 1 892 xác nhận, 1 134 ánh xạ, 1 487 nháp, 2 832 phân loại. Kết quả không phụ thuộc vào việc trigger của 022 còn bật: `FOR NO KEY UPDATE` ở khoá luồng tự cho xếp hàng công bằng (đo 7 của planner, mức khoá giống nhau ở cả hai phía).

7. **Tệp lùi từ chối khi có vị trí đã ghi; `DROP COLUMN`.** *Chấp nhận.* M-04 nói về cột đang có người dùng; đây là lùi một cột do chính migration này thêm, và từ chối khi mất dữ liệu đúng mẫu tệp lùi của 020/021/022. Hệ quả cần ghi: sau lần xác nhận đầu tiên chỉ còn forward-fix (DB-9). Không gói `DROP COLUMN` vào `DO` dùng `CASCADE`; kế hoạch đã cấm `CASCADE`.

8. **`updated_at = clock_timestamp()`, không `version`.** *Đúng về kỹ thuật, nhưng phải ghi ngoại lệ* (DB-3). `clock_timestamp()` ổn (không có truy vấn nào sắp theo nó). Không cột `version`: đúng vì khoá dòng xếp hàng mọi lần ghi.

9. **Phục hồi data-only (N4) và `pg_dump` chỉ schema `public`.** *Đầy đủ: đúng; data-only: `#inference`.* Bản dump đầy đủ nạp được: `COPY` đứng trước `CREATE TRIGGER` trong bản dump dạng thuần **[đo]**, và hàm, bảng, trigger đều nằm cùng schema (không lặp lại DB-8 của PR #22). Phục hồi chỉ dữ liệu không tắt trigger sẽ chạy trigger khi nạp `source_event_revisions` rồi va `UNIQUE(revision_id)` khi nạp bảng số: chưa chạy (cần `pg_restore --disable-triggers` hoặc bỏ hai bảng khỏi lần nạp). Đưa câu này vào §16 N4 là đủ.

10. **Chỉ mục cho luật 3, 4 và cho khoá ngoại.** *Đủ.* Luật 3: bảng đếm tra bằng `UNIQUE(tenant_id,project_id,chat_id,thread_key)` (RLS luôn cho điều kiện `tenant_id`), bảng số tra theo `UNIQUE(revision_id)`; luật 4: chống nối `NOT EXISTS` qua `UNIQUE(revision_id)`; luật 2: `UNIQUE(source_event_id,revision_no)` và chỉ mục khoá ngoại sẵn có. Không cần chỉ mục theo `source_event_id` trên bảng số. `UNIQUE(tenant_id,project_id,chat_id,thread_key,thread_seq)` giữ vì toàn vẹn (không câu truy vấn nào của tôi dùng nó). Khoá ngoại của cả hai bảng đều có chỉ mục dẫn đầu bằng cột khoá ngoại (E-DB-08). Bảng đếm vẫn HOT 100 %.

## 4 · Điều tôi đã thử mà không phá được

- **Khe «số cấp lúc gọi ≠ thứ tự commit»:** thử tải ghi đua (bảng §2): số = thứ tự commit; một ảnh chụp thấy số *s* thì thấy mọi số nhỏ hơn.
- **Khe CX3 phía xác nhận:** trigger `FOR NO KEY UPDATE` đóng; đột biến `FOR KEY SHARE` mở khe và bị máy dò bắt: bằng chứng rằng 0 trên phiên bản đúng là có nghĩa.
- **Vòng chờ nhiều bên:** nhận tin, xác nhận, ánh xạ, nháp bằng role AI, phân loại ứng viên: không `40P01`.
- **Các lối vào khác của khoá luồng:** gửi lại (`ON CONFLICT DO NOTHING`), nhiều dòng trong một lệnh, giao dịch bị lùi, `COPY`, `INSERT … SELECT` trộn phạm vi, `SELECT … FOR <mức>` của từng role, gọi hàm trực tiếp, login web không `SET ROLE`: không lối nào lấy được khoá của luồng ngoài phạm vi.
- **Từ chối khi luồng đang bị giữ:** không chờ (1 ms).
- **Migration:** áp lúc có `INSERT` đang chờ → được đánh số; áp lúc có nhận tin đang bay → hết `lock_timeout` sạch, không còn bảng, áp được sau; áp lần hai các bước 8–11 sạch; lùi rồi áp lại (có dữ liệu); lùi bị từ chối sau lần xác nhận đầu.
- **PGlite 18.6:** cùng SQL chạy đúng (DB-8).
- **Bảo mật phạm vi:** RLS trả lời trước trigger `AFTER` (0–1 ms) cho cả bản sửa lẫn quyết định.
- **Quyền:** chỉ `libetech_runtime` có `SELECT` trên hai bảng mới; `libetech_ai`, `libetech_intake`, `libetech_web` và các role còn lại không có quyền nào; `UPDATE`/`DELETE` của login vận hành lên bảng số hoặc `DELETE` bảng đếm: `Append-only`.

## 5 · Chưa kiểm (`#inference`)

- Quy mô dữ liệu thật của hai bảng lát 2 (U2): tôi dùng 60 000 và 300 000 bản giả.
- Khối P6 và SQL thật của 023: chưa tồn tại.
- `pg_restore --data-only` (N4): suy từ hành vi của pg_dump, không chạy.
- Hành vi thật của đường `/api/bridge` khi `55P03`: đọc mã gateway, không chạy gateway.
- `EXPLAIN` trên PostgreSQL 16 của câu `threadFreshness` thật (N7): tôi chỉ chạy một câu do tôi viết theo mục 8; kế hoạch vẫn nên giữ N7.
- Các đo 2g, 2h, 3b, 3c, 5d, 6c, 7 của planner tôi không đo lại (ghi [đo của planner] ở trên); riêng ý của 2g tôi kiểm gián tiếp bằng U4.
