# N4 · Phục hồi một bản lưu lấy sau migration 023 — Kế hoạch triển khai

> **Cho người thực thi:** `superpowers:executing-plans`. Mỗi task: viết ca kiểm trước, chạy cho đỏ vì đúng lý do ghi ở bảng §6, rồi mới viết mã. Ô `- [ ]` là bước theo dõi.

Version 0.3 (mục 11: hai cổng và điều đã đổi khi viết; 0.2 = 0.1 + phát hiện F0 do phiên chính đo và báo giữa chừng: D1, D2 viết lại) · 20/11/2026 · agent `planner` (mô hình Fable 5.2, không lùi mô hình) · nhánh `n4-restore-after-023`, gốc `c4f2983`. Planner không đo gì trên CSDL; mọi số «đã đo» dưới đây là của phiên khác (`docs/reviews/oq-53-evidence-20261119/gates/class-sweep-database.md:77-83`, `:257`) và phiên chính đo lại ở Task 6.

**Phát hiện F0 (có sẵn, không phải N4 gốc, cùng một lệnh sửa; phiên chính đo trên PostgreSQL 16.15, #fact của phiên chính).** `pg_dump --data-only` cảnh báo khoá ngoại vòng (`bom_proposals`, `document_records`↔`document_revisions`, `intake_candidates`, `review_comments`); trên CSDL 001–022 có một `document_records` mang `latest_revision_id`, lệnh nạp **hiện có** của bộ cài lỗi `COPY failed for table "document_records": violates foreign key constraint "fk_document_records_latest_revision"`. Tức lệnh nạp cũ hỏng với mọi bản lưu có tài liệu từ migration 014, không liên quan 023; lần nạp 08/11 chạy được vì chưa có tài liệu. Hệ quả: ràng buộc «không đổi hành vi với bản lưu trước 023» của đề bài **không còn giữ được** và bị thay bằng D2 dưới đây.

**Mục tiêu.** Đóng điều kiện N4 (`docs/DELIVERY-016-oq-53-subject-order-and-revisions-20261119.md:170`) và nửa «lệnh kiểm triển khai» của N12 (`:181`): một bản lưu `pg_dump -Fc --data-only` lấy **sau** 023 phục hồi được bằng bộ cài và bằng runbook, giữ nguyên số đã cấp, và kết thúc ở trạng thái mà 023 để lại (`tgenabled = 'A'`); có bằng chứng bằng một lần diễn tập `pg_dump`/`pg_restore` thật trên CSDL thử.

**Không làm.** Áp 023 lên dữ liệu thật · chạm d1-ai1 · sửa `migrations/`, `src/`, `bot-plugin/`, `scripts/`, `deploy/BUNDLE-MANIFEST.json` · phép kiểm lúc khởi động của dịch vụ (nửa sau của N12: còn mở) · tự gỡ luồng bị giữ (N15: chỉ viết quy tắc và chẩn đoán; quy trình sửa chờ OQ-59) · sao lưu định kỳ, diễn tập trên máy chủ (`docs/DEPLOY-002.md:57`) · đổi dòng lệnh dump (`docs/DEPLOY-002.md:19`).

---

## 1 · Sự thật đầu vào (planner đọc từ mã; không đo)

1. Hai nơi nạp, cùng cờ, không `--disable-triggers`: `deploy/install-user.py:161`, `deploy/install-d1.sh:43`. `install-d1.sh` không kiểm danh mục; `install-user.py` có (`validate_data_only_listing`, `:142-149`).
2. Trigger cấp số: `AFTER INSERT`, `ENABLE ALWAYS` (`migrations/023_thread_order.sql:266-270`); trigger xác nhận so với trạng thái **hiện tại** (`:292-357`), không chạy lại được trên dòng lịch sử.
3. 023 chỉ nhận trigger cấp số ở `'O'` hoặc `'A'` (`:345-349`) ⇒ sau `pg_restore --disable-triggers` (để lại `'O'`) lệnh xác nhận vẫn chạy và đường `replica` mở lại **không có dấu hiệu nào**. Phải có một bước sửa và một bước kiểm; không dựa vào lỗi để phát hiện.
4. Ngoài hai trigger của 023 còn **tám** trigger `BEFORE INSERT` chạy lúc nạp ở đường hiện nay (bản trước 023): `draft_decisions_guard`, `draft_decisions_pointer_only_guard`, `ai_drafts_declared_scope_guard`, `ai_drafts_pointer_only_guard`, `review_decisions_guard`, `review_delegations_guard`, `outbox_state_events_validate`, `outbox_messages_bind_target`, `delivery_receipts_derive_project`, `project_domain_mappings_draft_lock` (danh sách `grep "CREATE TRIGGER .* BEFORE INSERT" migrations/0*.sql`). Lần phục hồi thật duy nhất được ghi nhận (`docs/DEPLOY-002.md:61`) là ở schema 001–003, trước khi các trigger này có. Planner nghi đường này chưa có bằng chứng với dữ liệu lát 2–3; F0 xác nhận nó hỏng (vì khoá ngoại vòng, trước cả khi tới các trigger này). Với `--disable-triggers` cho mọi bản lưu, không trigger nào trong số này chạy lúc nạp nữa.
5. `run()` của bộ cài nuốt `stderr` khi lỗi (`deploy/install-user.py:63-68`, có chủ ý: SQL có mật khẩu) ⇒ câu lỗi của bước kiểm sau nạp sẽ không tới người vận hành nếu không có đường riêng.
6. `deploy/BUNDLE-MANIFEST.json` là của 0.2.0 (08/11/2026): hash của `install-user.py` và `install-d1.sh` trong đó đã khác tệp hiện có và không có migration 020–023. Manifest do `scripts/package-release.py` sinh lúc đóng gói ⇒ N4 không sinh lại; bộ cài trong cây này chỉ chạy được sau một lần đóng gói. Runbook (lệnh tay) vì thế là đường chính, bộ cài là đường thứ hai cùng luật.
7. `vitest.config.ts`: `fileParallelism:false`; harness native chỉ nhận CSDL `slice1_verify` hoặc `slice1_verify_<số>` ở `127.0.0.1:55471` (`tests/slice1-db.ts:8-17`).

## 2 · Quyết định thiết kế (P = giữ đề xuất của phiên chính; Đ = planner đổi; M = planner thêm)

| # | Quyết định | Bị loại, vì sao |
|---|---|---|
| D1 (Đ theo F0) | Loại bản lưu **không còn chọn cờ**, chỉ chọn bước đánh số. Phân loại bằng danh mục `pg_restore --list`: có cả `TABLE DATA public source_revision_positions` và `TABLE DATA public intake_thread_heads` ⇒ `post-023`; không có cả hai ⇒ `pre-023`; chỉ một ⇒ từ chối. `pg_dump` ghi mục `TABLE DATA` cho cả bảng rỗng nên CSDL sau 023 chưa có tin vẫn ra `post-023` (#inference, Task 6 khẳng định ở R2b) | Đọc `schema_migrations` của nguồn: bản lưu loại bảng đó theo quy định |
| D2 (Đ theo F0) | **Mọi** bản lưu nạp bằng `pg_restore --exit-on-error --single-transaction --data-only --no-owner --disable-triggers`. `post-023`: nạp nguyên văn, không đánh số lại; nguồn có bản không số thì giữ nguyên trạng và bước kiểm dừng (N15). `pre-023`: sau khi nạp, **áp lại `migrations/023_thread_order.sql`** (đánh số bản chưa có số theo `created_at, revision_no, id`, cùng kết quả như nâng cấp tại chỗ, rồi `ENABLE ALWAYS`), rồi `post-restore.sql`. Đích chưa có 023 (diễn tập bản lưu trước 023 vào lược đồ 022): không có bước áp lại | Loại bảng số rồi đánh số lại: đổi nghĩa `subject_thread_seq` đã ghi (tệp lùi 023, ghi chú 4). Chỉ tắt hai trigger của 023 rồi nạp thường: khoá ngoại vòng vẫn chặn (F0). Để trigger cấp số đánh số lúc nạp bản `pre-023` (đường cũ): không còn chạy vì trigger đã tắt, và thứ tự `COPY` không phải thứ tự của bước 8. Luôn áp lại 023 cho cả hai loại: sẽ âm thầm đánh số bản không số của nguồn `post-023` |
| D3 (Đ) | `deploy/post-restore.sql` = **một khối `DO`** (sửa + kiểm + thử, nguyên tử dù chạy bằng `psql -f`, `psql` stdin hay `pg.exec`) + `ANALYZE;` + một `SELECT` trả một dòng JSON. Không `BEGIN/COMMIT` trong tệp, không lệnh `\` | Nhiều câu rời: `psql` commit từng câu còn `pg.exec`/`pool.query` chạy cả chuỗi trong một giao dịch ngầm ⇒ ca kiểm và bộ cài thấy hai hành vi khác nhau khi một phép kiểm lỗi. `BEGIN` tường minh: một lỗi để kết nối của pool ở trạng thái giao dịch hỏng |
| D4 (Đ) | Luật phân loại ở **một** tệp `deploy/restore-plan.py` (hàm + CLI đọc danh mục từ stdin, in một dòng `pre-023` hoặc `post-023`; cờ nạp là hằng, giống nhau ở hai bộ cài). `install-user.py` nạp nó bằng `importlib` (giữ tên `validate_data_only_listing` cho ca cũ); `install-d1.sh` gọi CLI; ca diễn tập cũng lấy loại từ CLI | Chép luật sang bash và sang TypeScript: ba bản, ca đối chiếu chỉ bắt được lệch đã nghĩ tới |
| D5 (M) | Câu lỗi của `post-restore.sql` có mã cố định `POST-RESTORE-nn`, không mang id, `chat_id`, `thread_key` hay nội dung; chỉ số đếm. Bộ cài in **chỉ** các chuỗi khớp `POST-RESTORE-[0-9]{2}` lọc từ `stderr`, phần còn lại vẫn nuốt | Mở `stderr` của psql: lời lỗi thô của CSDL mang giá trị khoá (repo công khai, log bộ cài) |
| D6 (M) | Bước sửa chỉ có điều kiện (`tgenabled <> 'A'` mới `ENABLE ALWAYS`), dưới `lock_timeout` 5 giây đặt bằng `set_config(…, true)` ⇒ chạy lại trên CSDL lành không lấy `SHARE ROW EXCLUSIVE` lên bảng bản sửa; dùng được làm lệnh kiểm N12 | Luôn chạy `ENABLE ALWAYS`: mỗi lần kiểm chặn nhận tin |
| D7 (M) | Danh sách «trigger phải ở `'A'`» trong `post-restore.sql` là một hằng; ca P13 đọc catalog của CSDL vừa áp mọi migration và đòi tập trigger có `tgenabled <> 'O'` bằng đúng hằng đó ⇒ migration sau này thêm `ENABLE ALWAYS` mà quên tệp này thì ca đỏ | Chụp `tgenabled` trước khi nạp rồi áp lại: thêm trạng thái giữa hai lệnh, mất khi bộ cài chết giữa chừng |
| D8 (M, cổng bảo mật quyết giữ hay hạ) | Từ nay **mọi** lần nạp chạy với mọi guard tắt (hai guard con trỏ của 022, guard quyết định của 021) ⇒ tệp bản lưu là ranh giới tin cậy. Bộ cài đòi `LIBETECH_ARCHIVE_SHA256` (hash ghi lúc dump) và từ chối khi lệch; runbook ghi bước ghi hash lúc dump | Chạy lại guard sau khi nạp: chúng so với trạng thái hiện tại. Nếu cổng cho là ngoài phạm vi: hạ thành bước tay trong runbook, bỏ U7 |
| D9 (P) | Phép thử xác nhận sau nạp chỉ ở ca diễn tập (dịch vụ), không ở SQL | — |
| D11 (theo F0) | `post-restore.sql` chạy được khi đích **chưa có 023**: `to_regclass('public.intake_thread_heads') IS NULL` ⇒ bỏ phép 02, 03, 05–08, 10 và bước sửa, JSON ghi `"threadOrder":"023 not applied"`; phép 01, 04 (không đòi guard của 023), 09 và `ANALYZE` vẫn chạy | Hai tệp kiểm: lệch nhau theo thời gian |
| D10 (Đ) | Phép thử ghi (f) giữ, nhưng trong khối con `BEGIN … EXCEPTION` kết thúc bằng `RAISE` mã riêng để hoàn tác; mọi lỗi khác trong khối ⇒ `POST-RESTORE-10`. Ca P10 đòi số dòng mọi bảng không đổi | Bỏ (f): (c) không thấy thân hàm hay thuộc tính `SECURITY DEFINER` bị đổi |

**Hành vi tạm, không phải phương án được chọn (chờ OQ-59, §8):** bản `post-023` mà nguồn đã có bản không số ⇒ `POST-RESTORE-05`, bộ cài dừng trước khi bật dịch vụ («dừng tại OQ-59 (b)»). Bản `pre-023` có nháp ứng viên chưa quyết định: bước áp lại 023 tự từ chối (phép từ chối 4, `023:100-101`), bộ cài dừng — đây là luật sẵn có của 023, không phải lựa chọn mới. Bản `pre-023` vượt 250 000 bản: 023 dừng ở phép từ chối 3; runbook trỏ điều kiện N3, không tự nâng trần.

## 3 · `deploy/post-restore.sql` — nội dung (builder viết; planner mô tả)

Chạy bằng superuser, trước khi dịch vụ web khởi động: `psql -X -q -At -v ON_ERROR_STOP=1 -d libetech_ai_os -f deploy/post-restore.sql`. Idempotent. Schema ứng dụng = mọi schema không phải `pg_*`, `information_schema`. Đích chưa có 023: xem D11.

| Mã | Phép | Lỗi khi |
|---|---|---|
| 01 | `current_setting('is_superuser') = 'on'` | không phải superuser |
| 02 | trigger cấp số tồn tại, không nội bộ, `tgtype = 5`, `tgqual IS NULL`, `tgfoid = to_regprocedure('public.source_event_revisions_thread_position()')` (điều kiện của `023:345-348`) — **không tự sửa** | vắng hoặc rỗng |
| — | sửa: nếu `tgenabled <> 'A'` thì `ENABLE ALWAYS TRIGGER`; `RAISE NOTICE` trạng thái trước; ghi vào JSON `numberingTriggerWas` | — |
| 03 | sau bước sửa `tgenabled = 'A'` | khác |
| 04 | mọi trigger khác (kể cả nội bộ RI) trên bảng của schema ứng dụng ở `'O'`; riêng `draft_decisions_subject_order_guard` phải tồn tại | bất kỳ `'D'`, `'R'`, `'A'` ngoài hằng D7 |
| 05 | không bản nào của `source_event_revisions` thiếu dòng `source_revision_positions` (câu của `023:336-339`, toàn bảng) | có; in **số đếm** |
| 06 | mỗi dòng đếm: `last_seq = count(*) = max(thread_seq)` của luồng; không dòng số nào thiếu dòng đếm; không dòng đếm nào thiếu dòng số | lệch |
| 07 | `chat_id`, `thread_key` của mỗi dòng số bằng của tin gốc (`source_events`) cùng tenant và dự án | lệch |
| 08 | mỗi quyết định mang `subject_thread_seq`: `result = 'confirmed'`, nháp là `intake_candidate`, luồng của ứng viên có dòng đếm và vị trí ≤ `last_seq` (bất biến không phụ thuộc thời điểm mà trigger xác nhận đã bảo đảm lúc ghi) | lệch |
| 09 | mọi khoá ngoại (`pg_constraint.contype = 'f'`) của schema ứng dụng: không dòng con mồ côi; câu sinh bằng `format('%s', conrelid::regclass)` và `%I` cho cột, nhiều cột, bỏ dòng có cột `NULL` (MATCH SIMPLE); `confmatchtype` khác `'s'` ⇒ lỗi (fail-closed) | mồ côi; in tên ràng buộc |
| 10 | thử: trong khối con, một dự án + một tin + hai bản của một luồng mới ⇒ hai số 1, 2 và `last_seq = 2`; hoàn tác; sau đó đếm lại bằng 0 dòng của luồng thử | sai hoặc còn dòng |

Cuối: `ANALYZE;` (N7, `DELIVERY-016:177`) rồi `SELECT json_build_object('postRestore','pass','numberingTriggerWas',…,'revisions',…,'threads',…,'foreignKeys',…)`. Vì khối `DO` không trả dòng, giá trị `numberingTriggerWas` đi qua `set_config('libetech.post_restore_was', …, false)` (tiền lệ: `libetech.thread_order_max_rows`).

## 4 · Bản đồ tệp

| Tệp | Việc |
|---|---|
| `deploy/post-restore.sql` | mới (§3) |
| `deploy/restore-plan.py` | mới: `validate_data_only_listing`, `classify_archive`, hằng `PG_RESTORE_ARGS`, CLI |
| `deploy/install-user.py` | `finish_install`: danh mục → phân loại → so hash → nạp (`--disable-triggers`) → (pre-023) áp lại 023 từ `BASE/'app/migrations'` → `post-restore.sql` → mới tới `ALTER ROLE`, unit web; hàm `run_post_restore` theo D5 |
| `deploy/install-d1.sh` | danh mục qua stdin → CLI → nạp (`--disable-triggers`) → (pre-023) áp lại 023 → `post-restore.sql` → `provision-server.py`; từ nay cũng từ chối bản không phải data-only (trước đây không kiểm: thay đổi có chủ ý, ghi vào biên nhận) |
| `tests/post-restore.test.ts`, `tests/restore-rehearsal.test.ts`, `tests/restore-tools.ts` | mới |
| `tests/test_install_user.py` | thêm ca U1–U8; ca cũ không đổi |
| `docs/RUNBOOK-RESTORE-AFTER-023.md` | mới (Task 7) |
| `docs/DEPLOY-002.md` | điều kiện 5 thêm «ghi SHA-256 lúc dump»; mục mới «Restore after migration 023» trỏ runbook; không sửa các đoạn «Observed» |
| `docs/OPEN-QUESTIONS.md` | **phiên chính** nối OQ-59 (§8); planner không chạm |
| `docs/DELIVERY-017-n4-restore-after-023-20261120.md`, `docs/reviews/n4-evidence-20261120/` | biên nhận và log (Task 8) |

## 5 · Global Constraints

- Repo công khai: log và tài liệu không có secret, URL có mật khẩu, chat ID thật, tên người, đường dẫn home; thay bằng `<repo>` lúc ghi. Ca diễn tập không in biến môi trường và không ghi tệp dump vào repo (dump đi qua bộ nhớ: stdout của `pg_dump` → stdin của `pg_restore`).
- Lệnh ngoài chạy bằng `spawn`/`execFile` với mảng tham số, không shell, không biến thể sync.
- Ca diễn tập chỉ tạo và chỉ xoá CSDL **do chính nó đặt tên** (`slice1_verify_<số ngẫu nhiên>`, hai cái: nguồn và đích); không `TRUNCATE`, không đụng `slice1_verify` dùng chung; `afterAll` xoá đúng hai tên đó.
- Hook của máy chặn lệnh Bash chứa `ALTER TABLE`/`DROP TABLE`: sửa tệp bằng Edit; SQL chạy qua tệp hoặc qua ca kiểm.
- Bằng chứng đỏ phải là khẳng định (`AssertionError`), không phải hook hết giờ: `grep -c "timed out"` bằng 0 trong log đỏ.
- Lệnh nạp là một hằng cho mọi loại bản lưu (U2 ghim danh sách tham số); thay đổi so với lệnh cũ là đúng một cờ.

## 6 · Ca kiểm

**`tests/post-restore.test.ts` (PGlite và native; mỗi ca tự dựng, tự trả trạng thái trigger như `restoreGuards` của `tests/thread-order.test.ts:35-40`).** Đỏ ban đầu của mọi ca: `ENOENT deploy/post-restore.sql` — chưa phải lý do đúng; builder tạo tệp chỉ có phép 01 rồi chạy lại để mỗi ca đỏ vì khẳng định của chính nó.

| Ca | Dựng | Khẳng định (lý do đỏ trước khi có mã) |
|---|---|---|
| P1 | trigger cấp số đưa về `'O'` (`ENABLE TRIGGER`, như `pg_restore` để lại) | sau tệp: `'A'`; JSON `numberingTriggerWas:"O"` (đỏ: vẫn `'O'`) |
| P2 | chạy hai lần trên CSDL lành | lần hai `numberingTriggerWas:"A"`, số dòng mọi bảng không đổi |
| P3 | sau P1, phiên `SET LOCAL session_replication_role = replica` chèn một bản thô | bản có số (đỏ: không số) |
| P4 | một bản chèn khi trigger tắt | `POST-RESTORE-05`; trigger vẫn ở trạng thái trước (nguyên tử, D3) |
| P5 | `last_seq` lệch (ghi thô khi trigger `no_delete`/bất biến tắt trong ca) | `POST-RESTORE-06` |
| P6 | trigger cấp số tạo lại `WHEN (false)`; rồi `AFTER UPDATE`; rồi hàm khác | `POST-RESTORE-02` cả ba; không bị «sửa» thành `'A'` |
| P7 | `draft_decisions_subject_order_guard` ở `'D'`; rồi bị gỡ | `POST-RESTORE-04` |
| P8 | dòng con mồ côi chèn dưới `DISABLE TRIGGER ALL` (native; PGlite nếu cho phép, không thì `skipIf`) | `POST-RESTORE-09` |
| P9 | quyết định mang vị trí lớn hơn `last_seq` (chèn khi guard tắt) | `POST-RESTORE-08` |
| P10 | CSDL có dữ liệu thật của ca | sau tệp: `count(*)` mọi bảng schema ứng dụng bằng trước; không dự án thử |
| P11 | role không phải superuser (native) | `POST-RESTORE-01` |
| P12 | văn bản tệp | không dòng nào bắt đầu bằng `\`; không `BEGIN;`/`COMMIT;`; mọi `RAISE EXCEPTION` bắt đầu bằng `POST-RESTORE-`; không câu nào nối `chat_id`/`thread_key`/id vào lời lỗi |
| P13 | CSDL vừa áp mọi migration | tập trigger `tgenabled <> 'O'` = hằng của tệp (D7) |

**`tests/test_install_user.py` (`python3 -m unittest tests/test_install_user.py`; đỏ: `AttributeError`/`FileNotFoundError` rồi khẳng định).** U1 danh mục có hai bảng ⇒ `post-023`; không có ⇒ `pre-023`; một ⇒ `RuntimeError`. U2 `PG_RESTORE_ARGS` = tham số của `install-user.py:161` hôm nay + `--disable-triggers`, không phụ thuộc loại. U3 bước sau nạp: `pre-023` ⇒ có «áp lại 023»; `post-023` ⇒ không. U4 CLI: stdin danh mục ⇒ một dòng loại, mã thoát 0; danh mục full dump ⇒ mã thoát khác 0, không in gì ra stdout. U5 thứ tự trong `finish_install`: phân loại < nạp < áp lại 023 (trong nhánh `pre-023`) < `post-restore` < `ALTER ROLE` < `enable --now` web. U6 thứ tự trong `install-d1.sh` (dòng không chú thích): CLI < `pg_restore … --disable-triggers` < `023_thread_order.sql` (trong nhánh `pre-023`) < `post-restore.sql` < `systemctl enable`. U7 (D8) thiếu hoặc lệch hash ⇒ dừng trước khi nạp; lời lỗi không chứa hash. U8 `run_post_restore` với `stderr` giả chứa `POST-RESTORE-05` lẫn một dòng có giá trị khoá ⇒ lời lỗi chỉ có mã.

**`tests/restore-rehearsal.test.ts` (chỉ native và chỉ khi có `RESTORE_REHEARSAL_TOOLS`; không có ⇒ `skip`, ghi rõ ở biên nhận).** Biến môi trường: `RESTORE_REHEARSAL_TOOLS` (tiền tố lệnh, ví dụ `docker exec -i <container>`), `RESTORE_REHEARSAL_CONNECT` (tham số kết nối nhìn từ nơi công cụ chạy). Nguồn dựng bằng `IntakeService` và mẫu SQL của `tests/thread-order.test.ts:84-92`, `:501-502`.

| Chặng | Nội dung | Khẳng định |
|---|---|---|
| R1 (đặc tả quy trình cũ; **log đỏ của N4**) | nguồn sau 023: hai luồng, một tin có hai bản, một quyết định xác nhận ứng viên mà luồng sau đó nhận thêm tin; dump; đích mới áp 001–023; nạp bằng tham số **cũ** | `pg_restore` thoát khác 0; `stderr` khớp `duplicate key value` hoặc `The thread of the candidate moved on`; đích vẫn 0 dòng. Log lời lỗi (đã lọc đường dẫn) là bằng chứng đỏ |
| R2 | cùng dump, loại từ CLI `restore-plan.py` (`post-023`), lệnh mới | thoát 0; trước `post-restore`: `tgenabled = 'O'` và một bản chèn dưới `replica` trong giao dịch bị hoàn tác **không** có số (lý do bước sửa tồn tại); sau `post-restore` (qua `psql` thật): `'A'`, guard xác nhận `'O'`, JSON `pass` |
| R2b | nguồn sau 023 không có tin nào | danh mục vẫn ra `post-023` (D1) |
| R3 | so nguồn và đích | mỗi bảng của schema ứng dụng trừ `schema_migrations`: `count(*)` và `md5(string_agg(md5(t::text), '' ORDER BY md5(t::text)))` bằng nhau (đỏ trước khi có đường mới: R2 không tới đây) |
| R4 | trên đích, bằng dịch vụ | tin mới vào luồng cũ nhận số `last_seq + 1`; xác nhận một nháp ứng viên mới: được; xác nhận với vị trí cũ: `LTZ03` |
| R5 (F0) | nguồn đưa về trước 023 bằng `migrations/rollback/023_thread_order.sql` (không có quyết định mang vị trí), có dữ liệu lát 2–3: một `document_records` mang `latest_revision_id`, tin và bản (kể cả bản 1 có `created_at` muộn hơn bản 2), outbox và sự kiện trạng thái, uỷ quyền và quyết định review, một nháp đã bị từ chối; đích 001–023 | danh mục `pre-023`; lệnh **cũ**: thoát khác 0, `stderr` khớp `fk_document_records_latest_revision` (log đỏ của F0); lệnh mới + áp lại 023 + `post-restore`: `pass`, mọi bản có số, R3 cho mọi bảng trong dump; rồi áp 023 lên chính **nguồn** và so `(revision_id, thread_seq)` và `(luồng, last_seq)` của nguồn với đích: bằng nhau («như nâng cấp tại chỗ») |
| R5b (D11) | cùng dump, đích chỉ áp 001–022 | nạp mới thoát 0; `post-restore`: `pass`, `threadOrder:"023 not applied"`; R3 |
| R5c | như R5 nhưng nguồn có một nháp ứng viên chưa quyết định | bước áp lại 023 dừng với câu `no person has decided`; dịch vụ không được bật |
| R6 | dump thêm `--exclude-table-data=public.intake_thread_heads` | CLI từ chối |
| R7 | chạy `post-restore` lần hai trên đích | JSON `numberingTriggerWas:"A"`; R3 vẫn đúng |

## 7 · Tasks

- [ ] **Task 0 (phiên chính).** Nối OQ-59 vào cuối `docs/OPEN-QUESTIONS.md` theo §8. Không task nào dưới đây chờ lời đáp; hành vi tạm ghi ở §2.
- [ ] **Task 1 · `restore-plan.py`.** Viết U1–U4 → đỏ → mã. Tệp: `deploy/restore-plan.py`, `tests/test_install_user.py`. Kiểm: `python3 -m unittest tests/test_install_user.py`.
- [ ] **Task 2 · `post-restore.sql`, phần catalog.** P1–P3, P6, P7, P11–P13 → đỏ → phép 01–04 và bước sửa. Kiểm: `npx vitest run tests/post-restore.test.ts`, rồi cùng lệnh với `SLICE1_TEST_DATABASE_URL`. **Review riêng: CSDL và bảo mật.**
- [ ] **Task 3 · `post-restore.sql`, phần dữ liệu.** P4, P5, P8–P10 → đỏ → phép 05–10, `ANALYZE`, JSON. Cùng lệnh kiểm. **Review riêng: CSDL.**
- [ ] **Task 4 · `install-user.py`.** U5, U7, U8 → đỏ → `finish_install`, `run_post_restore`. `post-restore.sql` đọc từ bản đã kiểm hash ở `BASE/'app'`, đưa vào `psql` qua stdin như các migration (`install-user.py:137-138`). **Review riêng: bảo mật** (D5, D8).
- [ ] **Task 5 · `install-d1.sh`.** U6 → đỏ → sửa. `pg_restore --list` đọc dump qua stdin dưới `runuser -u postgres` như lệnh nạp hiện có; `set -o pipefail` đã bật nên CLI lỗi là dừng. Kiểm thêm: `bash -n deploy/install-d1.sh`.
- [ ] **Task 6 · Diễn tập (phiên chính chạy; cần container thử).** `tests/restore-tools.ts` + R1–R7. Tệp `tests/restore-rehearsal.test.ts` đã có trong cây làm việc lúc planner soát (chưa theo dõi bởi git, không phải planner tạo): phiên chính đối chiếu nó với bảng §6. Thứ tự: viết R1–R7 → chạy khi Task 1–3 chưa có để lấy log đỏ của R2/R3/R5 (khẳng định) và log R1 → chạy lại xanh. Log vào `docs/reviews/n4-evidence-20261120/`, đã lọc đường dẫn. 
- [ ] **Task 7 · Tài liệu.** `docs/RUNBOOK-RESTORE-AFTER-023.md`: (1) dump + ghi SHA-256 + dừng dịch vụ web trước; (2) đích luôn là CSDL mới đã áp mọi migration của bundle, không bao giờ nạp đè; (3) phân loại bằng CLI, nạp với `--disable-triggers`, bản `pre-023` thì áp lại 023, `post-restore.sql`, đọc JSON; mục riêng «diễn tập bản lưu trước 023 vào lược đồ 022 trước khi áp 023» (D11); (4) bảng mã `POST-RESTORE-nn` → nghĩa → việc làm (05 trỏ OQ-59, không tự sửa); (5) quy tắc N15 và CS-DB-8: phiên bảo trì cố ý ghi bản không số khoá `FOR UPDATE` dòng đếm của luồng trước và giữ tới commit; loader tự viết chạy `replica` phải `DISABLE TRIGGER` trigger cấp số rồi chạy `post-restore.sql`; (6) câu chẩn đoán luồng bị giữ (chạy tay trên máy chủ, kết quả không dán vào repo); (7) lệnh kiểm N12 = chính `post-restore.sql` (D6), nửa «lúc khởi động» còn mở. Cập nhật `docs/DEPLOY-002.md` theo §4.
- [ ] **Task 8 · Kiểm toàn bộ và biên nhận.** `npm run typecheck` · `npm run build` · `npx vitest run` (PGlite: nền 1 287 đạt / 118 bỏ qua cộng ca mới; PostgreSQL 16 với `RESTORE_REHEARSAL_TOOLS`: nền 1 405 đạt / 0 bỏ qua cộng ca mới) · `python3 -m unittest tests/test_install_user.py`. `docs/DELIVERY-017-…`: bốn mức ghi riêng — đã có mã: có · đã thử phục hồi trên CSDL thử: có (trỏ log) · đã triển khai: chưa · đã dùng thật: chưa · đã nghiệm thu: chưa (người làm không tự nghiệm thu). Ghi: N4 đóng ở mức mã và diễn tập; N12 đóng nửa lệnh kiểm; N15 và L7/L12 không đổi; manifest chưa sinh lại (§1.6).

## 8 · Câu hỏi mở — nội dung đề xuất cho OQ-59 (planner không chọn)

- **(a) Gỡ một luồng đã bị giữ vì bản không số (N15, `DELIVERY-016:173`).** Phương án: (1) người vận hành áp lại 023 trong cửa sổ bảo trì, mỗi lần có Chairman duyệt; (2) một kịch bản riêng chỉ đánh số bản thiếu số (phần bước 8 của 023), có người duyệt nêu tên vai trò, qua review CSDL; (3) không gỡ: ứng viên của luồng đó chỉ còn bị từ chối. Ai chịu trách nhiệm, và ghi vết ở đâu.
- **(b) Bản lưu sau 023 mà nguồn đã có bản không số.** Phục hồi nguyên trạng (dịch vụ chạy, luồng vẫn bị giữ như ở nguồn) hay dừng tới khi (a) có quy trình. Hành vi tạm của kế hoạch: dừng (`POST-RESTORE-05`) — nghĩa là một sự cố mất máy chủ trong tình trạng đó chưa phục hồi được bằng bộ cài.
- **(c) Bản lưu trước 023 có nháp ứng viên chưa quyết định.** Với D2 mới, bước áp lại 023 từ chối (luật của 023) ⇒ bản lưu đó không phục hồi được vào lược đồ có 023 cho tới khi nháp được quyết định **ở nguồn** rồi dump lại; nếu nguồn đã mất thì chỉ còn phục hồi vào lược đồ 022. Chấp nhận, hay cần một đường khác có người duyệt. Z4 chưa bật nên hôm nay chưa có nháp nào.
- (Câu (d) của bản 0.1 tự hết: với `--disable-triggers`, quyết định xác nhận không mang vị trí nạp được, như khi áp 023 tại chỗ.)

## 9 · Rủi ro và chỗ chưa chắc

- **G1.** Áp lại 023 sau khi nạp là một «lần chạy thứ hai» trên bảng đầy: lấy `SHARE ROW EXCLUSIVE` và `ACCESS EXCLUSIVE` như `023:60-75` (vô hại: dịch vụ chưa chạy), dừng trên 250 000 bản chưa số (phép từ chối 3) và khi có login thành viên `libetech_ai` đang kết nối. Bản lưu `pre-023` lớn hơn trần chưa có đường phục hồi tự động (N3).
- **G1b.** `pg_restore --disable-triggers` trên bản `pre-023` nạp vào đích có 023 để lại bản không số cho tới khi 023 được áp lại: bộ cài chết ở khe đó ⇒ `post-restore.sql` báo `POST-RESTORE-05`; runbook ghi «bản `pre-023`: áp lại 023 trước, rồi mới kiểm».
- **G2.** Giữa `pg_restore` và `post-restore.sql` trigger ở `'O'`; bộ cài chết ở khe đó thì không lệnh nào tự chạy lại (bộ cài từ chối cài đè). An toàn chỉ vì dịch vụ web chưa có unit; runbook ghi «chạy `post-restore.sql` bằng tay trước khi bật bất cứ thứ gì». Không có phép kiểm lúc khởi động (nửa sau N12).
- **G3.** `--disable-triggers` (nay cho mọi bản lưu) cũng reset mọi trigger đang `'D'` về `'O'` và tắt RI, guard con trỏ 022 trong lúc nạp: phép 09 chỉ bù RI; nội dung Z4 trong bản lưu được tin theo hash (D8).
- **G4.** Phép 10 gắn với cột `NOT NULL` của `projects`, `source_events`, `source_event_revisions`: migration sau này thêm cột bắt buộc làm tệp hỏng; P10 và P13 chạy trên mọi migration nên đỏ ngay ở PR đó.
- **G5.** Phép 09 và `ANALYZE` quét toàn bảng: ổn sau nạp; chạy làm lệnh kiểm N12 trên CSDL đang phục vụ thì tốn (chưa đo). Runbook ghi chạy ngoài giờ cao điểm.
- **G6.** PGlite (PostgreSQL 18.6) có thể khác PostgreSQL 16 ở `DISABLE TRIGGER ALL` và `ANALYZE` trong chuỗi nhiều câu: P8 có `skipIf`; mọi ca P chạy lại trên native.
- **G7.** Bộ cài trong repo ghim 0.2.0 và manifest cũ (§1.6): thay đổi ở Task 4–5 không chạy được đầu-cuối trong N4; chỉ có ca đơn vị và ca thứ tự. Đường được diễn tập thật là runbook (CLI + `pg_restore` + `post-restore.sql`).
- **G8.** Chưa chắc `docker exec -i` chuyển nguyên vẹn dump nhị phân qua stdin/stdout ở kích cỡ lớn; ca dùng dữ liệu nhỏ. Tiền tố và tham số kết nối do phiên chính đặt, không ghi vào repo.

## 10 · Tự soát của planner

Mỗi phép của §3 có ít nhất một ca đỏ ở §6 (01:P11 · 02:P6 · 03:P1 · 04:P7 · 05:P4 · 06:P5 · 07: **chưa có ca riêng — builder thêm P5b** · 08:P9 · 09:P8 · 10:P10). Mỗi quyết định D1–D10 có ca: D1:U1,R2b,R6 · D2:U2,U3,R1,R2,R5,R5c · D11:R5b (và **builder thêm P14**: `post-restore.sql` trên CSDL đã lùi 023 ⇒ `pass`, `023 not applied`) · D3:P4,P12 · D4:U4,U6 · D5:U8,P12 · D6:P2,R7 · D7:P13 · D8:U7 · D9:R4 · D10:P10. Không task nào sửa `migrations/` hay `src/`.

## 11 · Bản 0.3 — kết quả hai cổng trên kế hoạch và điều đã đổi khi viết (phiên chính, 20/11/2026)

Hai cổng (agent `liberico-security-reviewer` và `liberico-database-reviewer`) soát bản 0.2 cùng nguyên mẫu SQL **trước** khi tệp vào repo. Không P0. Cổng bảo mật: một P1, bảy P2, bốn P3; cổng CSDL: không P1, hai P2, mười hai P3 (đo trên PostgreSQL 16.15, CSDL thử riêng đã xoá). Cả hai trả lời «không chặn viết mã» kèm điều kiện; các điều kiện đã làm trước khi chạy ca xanh. Mục này thay các chỗ của §2–§6 trên đây mà mã đã đổi; các mục cũ giữ nguyên để thấy cái đã đổi. **Các hàng của bảng dưới nói theo mã lúc cổng; về sau còn đổi thêm** (cờ hoàn thành bằng `SET` thay `RESET`, `ANALYZE` đặt **trước** câu trả lời, bộ kiểm bundle nằm trong script và digest bản phát hành bắt buộc, danh sách bảng rỗng bị từ chối…): bản ghi đầy đủ của các lượt sau là `docs/reviews/n4-evidence-20261120/gates/tier1-dispositions.md` và biên nhận.

| Finding | Xử lý |
|---|---|
| BM P1: `install-d1.sh` đọc `$dump` hai lần từ đường dẫn tài khoản dùng chung ghi được, không có cổng hash | **Áp.** `install-d1.sh` chép tệp **một lần** sang tệp chỉ root đọc, so SHA-256 (`LIBETECH_ARCHIVE_SHA256`, từ người vận hành), mọi bước sau đọc bản chép; `install-user.py` làm cùng việc (`hold_archive`). Ca U6, U7 |
| BM P2: hash chỉ có giá trị nếu đến từ kênh khác tệp; thứ tự hash → `--list` | **Áp.** Biến môi trường, chuẩn hoá hex thường, không in hash, kiểm trước mọi thứ; runbook ghi «toàn vẹn, không phải xác thực» |
| BM P2 + DB P3: danh sách guard tắt khi nạp sai (kế hoạch ghi «tám», liệt kê mười) | **Áp.** Đọc từ catalog: **mười một** trigger `BEFORE INSERT` (thêm `memberships_doc_approve_guard`); runbook mục 3 |
| BM P2: `SET LOCAL`/khoá ngoài khối DO vô hiệu dưới `psql -f` | **Áp.** `search_path` và `lock_timeout` đặt bằng `set_config(…, true)` trong khối; ca P12b ghim |
| BM P2: harness một giao dịch ≠ `psql -f` từng câu | **Áp.** Ca diễn tập R4–R12 chạy tệp bằng `psql` thật; ca P12b; cờ hoàn thành là cờ phiên, xoá bằng câu riêng đã commit |
| BM P2 vs DB P3: khoá `SHARE ROW EXCLUSIVE` ở đầu khối hay không | **Không khoá khi chỉ đọc** (cổng CSDL đo: mỗi phép kiểm là một câu, bản và số commit nguyên tử, không dương tính giả; khoá chặn nhận tin). Chỉ sửa trạng thái trigger mới lấy khoá (`lock_timeout` 1 giây, đo chờ 4,0 s ở 5 s); lần ghi thử lấy `ROW EXCLUSIVE` bảng bản **trước** (cùng thứ tự với 023, tránh `40P01` đo được). Lệnh N12 cho CSDL đang phục vụ là câu đọc catalog trong runbook mục 8, không phải `post-restore.sql` |
| BM P2: lời lỗi lộ `DETAIL`/`CONTEXT`; bash và lệnh tay không lọc | **Áp.** Mã `POST-RESTORE-nn`; lỗi của PostgreSQL đổi thành `-98`/`-99` kèm SQLSTATE; `psql -v VERBOSITY=terse -v SHOW_CONTEXT=never`; bộ cài in chỉ mã; runbook cấm dán đầu ra |
| BM P2: `verify_bundle` không thấy tệp ngoài manifest | **Áp** (và mở rộng ở lượt review mã: bản chụp root-only của bundle cho `install-d1.sh`, xem `docs/reviews/n4-evidence-20261120/gates/tier1-dispositions.md`). Hai bộ cài từ chối nếu `pre-restore.sql`, `post-restore.sql`, `restore-plan.py`, `023_thread_order.sql` không nằm trong manifest (ca U9) |
| BM P3: N15/CS-DB-8 thiếu ý | **Áp** vào runbook mục 6 (luồng không có dòng đếm, không tự chèn dòng đếm, `ENABLE ALWAYS` chứ không `ENABLE TRIGGER`, thứ tự khoá, ví dụ dùng `<chat_id>`); câu chẩn đoán in số thứ tự dự án |
| BM câu 1: phép kiểm bất biến guard 019/021/022 sau nạp | **Không làm**, ghi **chấp nhận**: biên giới là kênh chuyển + SHA-256, nguồn đã chạy guard. Còn mở ở DELIVERY-017 |
| DB P2: cờ hoàn thành bị hoàn tác khi khối lỗi | **Áp.** `RESET` bằng câu riêng đứng trước khối; cờ session-level; `SELECT` cuối có cổng thứ hai từ catalog (`tgenabled='A'`); `ANALYZE` đặt **sau** `SELECT` |
| DB P2: danh mục chỉ kiểm hai bảng 023 (bảng khác vắng im lặng; loại cả hai bảng số → bản `pre-023` bị đánh số lại, vị trí cũ mất nghĩa) | **Áp.** `restore-plan.py --tables` so với bảng của đích (R7c); bước kiểm vị trí trước khi áp lại 023 (R7b); cả hai ở hai bộ cài |
| DB P3: MATCH FULL bị bỏ lọt, xác nhận không vị trí phải pass, schema mới, phiên ở `replica`, `pg_db_role_setting`, `40P01` | **Áp.** Ca P8b, P9b, P11b; lọc schema bằng `NOT LIKE 'pg\_%'`; POST-RESTORE-01 mở rộng; `40P01` → `-98` |
| DB câu 4: kiểm «đích rỗng» | **Áp.** `deploy/pre-restore.sql` (`PRE-RESTORE-02`), chạy trước khi nạp ở hai bộ cài; ca R4b |

Thay đổi khác của phiên chính, không từ cổng: khoá JSON của câu trả lời là `snake_case` (`post_restore`, `numbering_trigger_was`, `thread_order`, `foreign_keys`: hook CSDL của máy coi `camelCase` là vi phạm E-DB-02); biến môi trường của ca diễn tập là `SLICE1_PG_CONTAINER` (kế hoạch ghi `RESTORE_REHEARSAL_TOOLS` + `RESTORE_REHEARSAL_CONNECT`; dùng `docker exec -i` qua socket cục bộ nên không cần tham số kết nối); không có `tests/restore-tools.ts` (một tệp `restore-rehearsal.test.ts`); ca thêm ngoài bảng §6: P5b, P7b, P8b, P9b, P10b, P11b, P12b, R2b, R4b, R7b, R7c, R13; một lượt **đột biến** `deploy/post-restore.sql` (14 đột biến, mỗi phép kiểm có ca đỏ riêng; một lớp phòng thủ thứ hai chỉ đỏ khi lớp thứ nhất cũng bị bỏ) ghi ở biên nhận. Việc **không làm** so với 0.2: tệp thứ hai `deploy/trigger-state-check.sql` (thay bằng câu catalog ở runbook mục 8, để khỏi có hai nguồn cho trạng thái mong đợi).
