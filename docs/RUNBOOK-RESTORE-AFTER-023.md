# Phục hồi dữ liệu AI OS từ một bản lưu — sau migration 023

Version 0.3 · 22/11/2026 (0.2: 20/11/2026) · N4 của `docs/DELIVERY-016-oq-53-subject-order-and-revisions-20261119.md` (N12 một nửa, N15 phần quy tắc). Biên nhận: `docs/DELIVERY-017-n4-restore-after-023-20261120.md`; bản 0.3 (OQ-59 (b) (1)): `docs/DELIVERY-021-n4-oq59-b1-held-threads-20261122.md`. Kế hoạch: `docs/plans/n4-restore-after-023.md`.

**Trạng thái: đã có mã và đã thử phục hồi trên CSDL thử (PostgreSQL 16.15, `pg_dump` / `pg_restore` / `psql` thật). Chưa chạy trên máy chủ nào; d1-ai1 không bị chạm. Z4 chưa bật; 022 và 023 chưa áp lên dữ liệu thật. Từ 0.3, theo câu trả lời «(b) (1)» của Chairman ngày 22/11/2026 (phương án ghi ở `docs/OPEN-QUESTIONS.md`, mục OQ-59: phục hồi nguyên trạng, dịch vụ chạy, luồng vẫn bị giữ như ở nguồn): bản lưu **sau 023** mà nguồn có luồng bị giữ được phục hồi nguyên trạng, không dừng (mục 7). Số đo của 0.3: `docs/reviews/n4-oq59-evidence-20261122/`.**

## 1 · Khi nào dùng, và khi nào không

- **Dùng:** cài mới từ một bản lưu (`deploy/install-user.py` và `deploy/install-d1.sh` làm đúng các bước 2–7 dưới đây); phục hồi sau sự cố; **diễn tập một bản lưu trước khi áp 022/023** (mục 5): kế hoạch triển khai cần «bản sao lưu đã thử phục hồi».
- **Không dùng:** nạp vào một CSDL đang có dữ liệu hay đang phục vụ. Đích luôn là một CSDL **mới**, đã áp mọi migration của bundle, còn rỗng (bước 4 kiểm điều đó và dừng nếu không). Không dùng để gỡ một luồng bị giữ (mục 7).
- **Không dán** đầu ra của `pg_restore` hay `psql` vào repo, ghi chú PR hay log chung: lời lỗi của PostgreSQL có thể trích nguyên một hàng dữ liệu (`DETAIL: Key (…)=(…)`, `CONTEXT: COPY …: "<cả hàng>"`). Repo này công khai tạm thời. Chỉ các mã `POST-RESTORE-nn` và `PRE-RESTORE-nn` (mục 4) là an toàn để ghi lại.

## 2 · Lập bản lưu

Như `docs/DEPLOY-002.md` (điều kiện 5), không đổi dòng lệnh: bằng một login đọc được mọi bảng, tệp quyền 0600.

```bash
pg_dump -Fc --data-only --exclude-table-data=public.schema_migrations -d <csdl nguồn> -f bản.dump
```

- **Không thêm** `-t`, `-T` hay `--exclude-table-data` nào khác. Một bản lưu thiếu dữ liệu của một bảng vẫn nạp được và không ai nói gì; bộ cài (và bước 3) so danh sách bảng của bản lưu với bảng của đích và từ chối nếu thiếu.
- **Ghi SHA-256 của tệp lúc dump**, ở nơi khác tệp (kênh quản trị, ghi chú của người dump), rồi đưa nó cho bộ cài qua biến `LIBETECH_ARCHIVE_SHA256` (64 chữ số hex thường). Đó là **toàn vẹn**, không phải xác thực danh tính: nó chứng minh tệp là tệp đã lập, không chứng minh ai lập.
- `pg_dump` in cảnh báo «circular foreign-key constraints … You might not be able to restore the dump without using --disable-triggers». Đúng, không phải lỗi: schema có khoá ngoại vòng (`document_records` ↔ `document_revisions`, và bốn bảng tự trỏ). Đó là lý do mọi lần nạp dùng `--disable-triggers`.
- Một bản lưu **sau 023** mang thêm dữ liệu của `intake_thread_heads` và `source_revision_positions`. Không loại chúng: `deploy/restore-plan.py` từ chối bản lưu chỉ có một trong hai. Loại **cả hai** thì bản lưu trông như của trước 023, và bước 6 bắt điều đó qua vị trí mà các quyết định mang. Nếu bản lưu sau 023 bị cắt cả hai bảng số **và** không quyết định nào mang vị trí thì không còn dấu hiệu nào để phân biệt nó với bản lưu trước 023, và áp lại 023 sẽ đánh số cả những bản mà nguồn đang giữ (không có số): phần dư này chỉ đóng bằng đúng lệnh dump ở trên và SHA-256 ghi lúc dump.

## 3 · Nạp

Mỗi bước là một lệnh; dừng ở lệnh đầu tiên lỗi. Chạy bằng một role **superuser** của cụm (`--disable-triggers` đòi vậy; bộ cài dùng `iptech` ở cụm riêng của nó, hoặc `postgres`).

**Ranh giới tin cậy.** Mỗi lần nạp chạy với **mọi guard của CSDL tắt**: mười một trigger `BEFORE INSERT` (`ai_drafts_declared_scope_guard`, `ai_drafts_pointer_only_guard`, `delivery_receipts_derive_project`, `draft_decisions_guard`, `draft_decisions_pointer_only_guard`, `memberships_doc_approve_guard`, `outbox_messages_bind_target`, `outbox_state_events_validate`, `project_domain_mappings_draft_lock`, `review_decisions_guard`, `review_delegations_guard`; danh sách đọc từ catalog của CSDL đã áp 001–023, không từ `grep`), hai trigger của 023, và các trigger khoá ngoại. `CHECK`, `UNIQUE`, `NOT NULL` và khoá chính **vẫn chạy**. Sau nạp, `post-restore.sql` kiểm lại khoá ngoại (phép 09) và các bất biến của 023 (phép 05–08), **không** kiểm lại các bất biến của guard 019, 021, 022 (quyền duyệt tài liệu cần phiếu; xác nhận phải mang nguồn và băm của nháp; nháp của dự án IBS HI). Một bản lưu bị sửa tay mà vẫn mang đúng SHA-256 vượt qua mọi kiểm tra công khai: biên giới là **kênh chuyển tệp cộng với SHA-256**, và nguồn của bản lưu đã chạy các guard ấy lúc ghi. Chairman có thể đòi thêm phép kiểm nếu muốn đóng cả trường hợp đó (DELIVERY-017, mục «Còn mở»).

1. Tạo CSDL mới và áp các `migrations/*.sql` theo thứ tự (bộ cài áp mọi migration của bundle). **Bản lưu phải đến từ một CSDL cùng lược đồ với đích:** bước 3 từ chối một bản lưu thiếu dữ liệu của một bảng mà đích có, kể cả khi bảng ấy chỉ vắng vì nguồn cũ hơn (bản lưu của lược đồ 018 vào đích 001–023 bị từ chối với danh sách bảng thiếu). Muốn phục hồi một bản lưu của lược đồ cũ: tạo đích chỉ với các migration mà nguồn đã có, phục hồi (bước 3–5 và 7), rồi áp các migration sau bằng đường áp tại chỗ (023 kèm các điều kiện N1–N5 của DELIVERY-016).
2. Kiểm SHA-256 của tệp bản lưu so với giá trị ghi lúc dump. Tệp gốc chỉ được đọc để băm và chép: bộ cài chép nó sang một tệp riêng (quyền 0600), băm chính các byte mà nó giữ, và dùng bản chép cho mọi bước sau, vì tệp gốc nằm nơi tài khoản dùng chung với gateway ghi được. Bản chép của `install-d1.sh` chỉ root đọc được (`/root`); bản chép của `install-user.py` thuộc chính tài khoản dùng chung với gateway (`state/archive.dump`): nó cố định cái đã được băm, **không** ngăn người cùng tài khoản ghi đè nó sau đó. `install-user.py` xoá bản chép khi lần phục hồi đã qua và khi nó sai băm, và **giữ** nó khi lỗi để kiểm tra (nó là một bản thứ hai của dữ liệu pilot: xoá tay sau khi xong); `install-d1.sh` xoá bản chép ở **mọi** lần thoát, kể cả khi lỗi (chỉ tệp `restore.err` còn lại sau một lần nạp lỗi).
3. Lấy danh sách bảng của đích, phân loại bản lưu và kiểm nó phủ hết các bảng ấy (một từ: `post-023` hoặc `pre-023`; lỗi ⇒ dừng, không in gì ra stdout; một danh sách bảng rỗng cũng bị từ chối, nên lệnh con lỗi không làm phép kiểm đậu):

```bash
tables=$(psql -X -q -At -d <csdl> -c "$(python3 deploy/restore-plan.py --tables-sql)")
```

```bash
pg_restore --list bản.dump | python3 deploy/restore-plan.py --tables "$tables"
```

4. Kiểm đích không có dòng nào (trừ `schema_migrations`). Mã `PRE-RESTORE-02` ⇒ làm lại CSDL mới, không nạp tiếp:

```bash
psql -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=terse -v SHOW_CONTEXT=never -d <csdl> -f deploy/pre-restore.sql
```

5. Nạp, **gõ đủ** năm tham số (một giao dịch: lỗi ⇒ không còn gì của bản lưu trong CSDL). Đây đúng là danh sách mà `python3 deploy/restore-plan.py --pg-restore-args` in ra (một ca kiểm giữ hai nơi bằng nhau); không dùng `$(…)` ở đây: nếu lệnh con lỗi, `pg_restore` vẫn chạy mà thiếu `--single-transaction`, `--exit-on-error` hay `--disable-triggers`:

```bash
pg_restore --exit-on-error --single-transaction --data-only --no-owner --disable-triggers -d <csdl> bản.dump
```

6. **Chỉ khi bước 3 in `pre-023`:** bản lưu trước 023 không có số, và không được mang vị trí nào. Kiểm trước (kết quả phải là `0`; khác `0` nghĩa là hai bảng số đã bị loại lúc dump: dừng):

```bash
psql -X -q -At -d <csdl> -c "$(python3 deploy/restore-plan.py --pre-023-check-sql)"
```

   Rồi áp lại 023: nó đánh số các bản chưa có số theo `created_at, revision_no, id` (cùng kết quả như nâng cấp tại chỗ, đã so ở ca R13) và đặt trigger cấp số ở `A`. Nó có thể từ chối (nháp ứng viên chưa có quyết định, login `libetech_ai` đang kết nối, hơn 250 000 bản chưa số): đừng vòng qua; xem OQ-59 và N3.

```bash
psql -X -q -v ON_ERROR_STOP=1 -d <csdl> -f migrations/023_thread_order.sql
```

7. **Kiểm sau nạp: một lệnh, bắt buộc, trước khi bật bất cứ thứ gì.** `<loại>` là từ mà bước 3 đã in (`post-023` hoặc `pre-023`); tệp **đòi** nó (thiếu, hay một từ khác: `POST-RESTORE-01`, trước khi đọc hay sửa gì) vì nó không đoán được loại bản lưu từ dữ liệu. Thành công khi thoát 0 **và** dòng cuối là `{"post_restore" : "pass", …}`; thiếu dòng đó là thất bại, kể cả khi mã thoát là 0 (chạy thiếu `ON_ERROR_STOP`). Dòng ấy mang `archive_kind` (loại mà tệp được nêu, để người đọc kiểm nó thấy đúng loại; hai bộ cài đòi nó bằng từ họ đã đưa) và `held_by_project`: **từng dự án** một mục `{project_no, revisions, threads}` (`project_no` là số thứ tự theo mã dự án **trong số các dự án còn bản không số**, không có mã nào: nó gọi tên một dự án trong lần chạy này, không so được giữa các lần chạy, nên đối chiếu bằng câu ở mục 7 ngay lúc ấy; `threads` đếm theo `chat_id` và khoá luồng, kể cả luồng chưa có ứng viên, nơi luật 4 và guard chưa chặn gì: là cận trên của «luồng bị giữ»). **Không có tổng của các bản không số qua các dự án** (không trong câu trả lời, không trong thông báo): một dự án thuộc một miền báo cáo, và `AGENTS.md` cấm báo cáo gộp qua các miền (các số `revisions`, `threads`, `foreign_keys` của dòng trả lời có từ N4 là số hàng của cả CSDL, không phải số bản không số); danh sách rỗng là không có bản nào. Một danh sách không rỗng **không** làm lệnh thất bại với bản lưu sau 023 (OQ-59 (b) (1), mục 7); với bản lưu **trước 023** (`pre-023`) tệp **dừng** ở `POST-RESTORE-05` nếu sau bước 6 vẫn còn bản không có số (023 đánh số mọi bản: còn sót là bước 6 chưa chạy hay không đánh số hết, không phải luồng mà nguồn giữ). Một lệnh chạy tay với nhầm loại `post-023` cho bản lưu trước 023 bỏ qua cổng ấy: loại là từ của bước 3, đừng gõ theo trí nhớ. Cơ sở chưa có 023 trả `null` cho `held_by_project` (phép kiểm không chạy, không phải «không có»: danh sách rỗng). Chạy bằng `-f` với tệp trên stdin (`-c` chỉ để nêu loại bản lưu, trong cùng phiên), **không** bằng `psql -1` và không đưa cả tệp vào `-c`; không chạy cùng lúc với một lần áp 023 (hai bên khoá chéo nhau và 023 là bên bị chọn làm nạn nhân).

```bash
psql -X -q -At -v ON_ERROR_STOP=1 -v VERBOSITY=terse -v SHOW_CONTEXT=never -d <csdl> -c "SET libetech.archive_kind = '<loại>'" -f - < deploy/post-restore.sql
```

8. Chỉ sau bước 7 mới bật dịch vụ web, gateway hay bất kỳ tiến trình nào ghi vào CSDL.

**Vì sao thứ tự này.** Giữa bước 5 và bước 7 trigger cấp số của 023 ở `O` (chỉ phiên có vai trò gốc), không phải `A` (mọi phiên): `pg_restore --disable-triggers` kết thúc bằng `ENABLE TRIGGER ALL`. 023 chấp nhận cả `O` lẫn `A` (`migrations/023_thread_order.sql`, trigger xác nhận), nên ở `O` mọi thứ vẫn chạy và đường `session_replication_role = replica` mở lại **không có dấu hiệu nào**. Trong khe ấy không có bên ghi nào: dịch vụ web chưa có unit, role web và auth chưa có mật khẩu (bộ cài đặt chúng sau nạp), bot-plugin không có đường tới CSDL; chỉ người vận hành qua socket. Nếu bộ cài chết giữa hai bước, không gì tự chạy lại: chạy bước 7 bằng tay trước khi bật gì. Phép kiểm lúc khởi động của dịch vụ (nửa sau của N12) **chưa có**.

Hai bộ cài làm đúng các bước 2–7 (và chỉ sau đó mới tạo mật khẩu và unit): cả hai đòi `LIBETECH_ARCHIVE_SHA256` (`install-user.py` kiểm nó ngay ở lượt kiểm trước, kể cả `--inspect-only`, và trước khi viết biên nhận nào), từ chối nếu `deploy/pre-restore.sql`, `deploy/post-restore.sql`, `deploy/restore-plan.py` hay `migrations/023_thread_order.sql` không nằm trong manifest của bundle hoặc nếu các migration sẽ áp không đúng bằng các migration manifest liệt kê (`verify_bundle` chỉ kiểm các tệp manifest liệt kê). `install-user.py` chỉ nạp `restore-plan.py` **sau** khi bundle đã được kiểm và đúng tệp manifest liệt kê. `install-d1.sh` **không chạy gì từ bundle trước khi chép nó**: nó chụp **một lần** bundle vào một thư mục chỉ root vào được (dưới `/root`), kiểm bản chụp bằng một bộ kiểm nằm trong chính script đã được duyệt (không đọc từ bundle): digest của manifest tính lại từ các hash, hash của từng tệp liệt kê, và **cả cây** không có gì khác ngoài các tệp liệt kê và hai manifest do đóng gói ghi (không tệp lạ, không symlink hay thư mục symlink, không bytecode hay `__pycache__`), cùng bốn tệp phục hồi có trong manifest; digest tính được phải bằng `LIBETECH_BUNDLE_TREE_SHA256` (**bắt buộc**; là `sourceTree` mà `scripts/package-release.py` in). Rồi mọi thứ chạy bằng root hay postgres (các tệp phục hồi, migration, `provision-server.py`, unit) đọc từ bản chụp đó, với `python3 -I` (trừ `provision-server.py`): bundle gốc nằm nơi tài khoản dùng chung với gateway ghi được, và bản dựng dưới `/opt` do một tài khoản khác dựng nên không bên nào là chỗ để chạy gì với quyền cao. Digest của bản phát hành là mỏ neo duy nhất cho việc bundle đúng là bản đã đóng gói: một manifest nhất quán cho một tệp đã bị đổi qua mọi kiểm tra mà bundle tự làm với chính nó, nên thiếu digest bộ cài không chạy. `install-user.py` (chạy chung tài khoản với gateway theo thiết kế của 0.2.0) chưa đòi digest này. Bản chép dưới `/opt` được làm từ bản chụp và **không** được N4 kiểm lại (nó là thứ dịch vụ chạy, và do bản dựng sinh ra; điều này có từ trước). **Số đếm luồng bị giữ (từ 0.3):** cả hai bộ cài đọc `held_by_project` từ dòng trả lời của bước 7 và coi một dòng trả lời thiếu nó (hay mang số không phải số nguyên không âm, hay không nói lại đúng loại đã đưa) là chưa đạt. Bản lưu sau 023 mà nguồn có luồng bị giữ **vẫn được phục hồi và dịch vụ vẫn được bật**; bộ cài in **một dòng cho mỗi dự án** (chỉ có số thứ tự và số đếm, không tổng) và một câu, và `install-user.py` ghi cả dòng trả lời vào `runtime-receipt.json` (khoá `restore`). Bộ cài nêu cho tệp loại bản lưu mà kế hoạch đã in (`SET libetech.archive_kind`, cùng phiên; từ khác hai từ đã biết bị từ chối trước khi đưa lên dòng lệnh), nên bản lưu trước 023 còn bản không có số sau khi 023 được áp lại làm **tệp** dừng ở `POST-RESTORE-05` (một luật, một nơi); bộ cài không tự xét loại. **Đầu ra:** `install-user.py` chỉ in các mã `PRE-RESTORE-nn` / `POST-RESTORE-nn` của psql (khi lỗi), cộng các dòng số đếm theo dự án khi bản lưu có luồng bị giữ (do chính bộ cài viết, chỉ gồm số); `install-d1.sh` đưa lời lỗi của `pg_restore` vào một tệp chỉ root đọc (không in; còn lại sau khi lỗi để người vận hành đọc ngay trên máy chủ), và chạy `psql` ở chế độ `terse`, nên nó cũng không in `DETAIL`/`CONTEXT`. Chúng **không chạy được từ cây mã này**: `deploy/BUNDLE-MANIFEST.json` là của 0.2.0 (chỉ migration 001–003; `verify-bundle.py` đã báo `Bundle mismatch` ở chính cây này), nên đường đã diễn tập thật là các bước trên. Manifest do `scripts/package-release.py` sinh khi đóng gói một bản phát hành (nó quét `deploy/`, `migrations/` và các thư mục khác; chưa chạy ở đây): một bản đóng gói sau N4 sẽ liệt kê các tệp mới, và các kiểm tra «tệp phải nằm trong manifest» ở trên mới qua được.

## 4 · Mã lỗi

Lỗi mang mã cố định, không mang id, `chat_id`, `thread_key` hay nội dung; chỉ số đếm. Một lỗi của chính PostgreSQL (có thể trích hàng) được đổi thành `-98` hay `-99` kèm SQLSTATE. Với `psql -v VERBOSITY=terse -v SHOW_CONTEXT=never` không còn `DETAIL`/`CONTEXT`. Bộ cài chỉ in các mã.

| Mã | Nghĩa | Việc làm |
|---|---|---|
| PRE-RESTORE-01 | không chạy bằng superuser | chạy lại bằng superuser |
| PRE-RESTORE-02 | đích đã có dòng ở N bảng | tạo lại CSDL mới, áp migration, rồi nạp; không nạp tiếp vào nó |
| POST-RESTORE-01 | không chạy bằng superuser, hoặc phiên đang ở `replica`, hoặc CSDL/role có mặc định `session_replication_role`, hoặc **chưa nêu loại bản lưu** (`SET libetech.archive_kind` thiếu hay không phải `post-023`/`pre-023`), hoặc CSDL, hay role chạy tệp, có **mặc định** `libetech.archive_kind` (tệp từ chối cả khi lệnh có `SET`: loại được nêu cho từng lần chạy, không có mặc định; mặc định của role khác không tính) | chạy lại bằng superuser ở phiên thường; gỡ mặc định (`session_replication_role`, `libetech.archive_kind`); nêu loại bản lưu bằng `-c "SET libetech.archive_kind = '<loại>'"`, từ mà bước 3 đã in (`PGOPTIONS` hay `postgresql.conf` mà tệp không đọc: đừng đặt ở đó) |
| POST-RESTORE-02 | 023 áp dở (thiếu một bảng), hoặc trigger cấp số không phải trigger mà 023 tạo (vắng, `WHEN`, sự kiện khác, hàm khác) | áp lại `migrations/023_thread_order.sql` rồi chạy lại bước 7; không «sửa tay» trigger |
| POST-RESTORE-03 | bước sửa `ENABLE ALWAYS` không giữ | dừng, báo; không bật dịch vụ |
| POST-RESTORE-04 | có trigger của schema ứng dụng không ở `O` (trigger cấp số: `A`), kể cả trigger khoá ngoại; hoặc trigger xác nhận của 023 vắng/sai | tìm trigger bị tắt: một lần nạp dở hay một người đã `DISABLE TRIGGER`; đừng bật dịch vụ |
| POST-RESTORE-05 | **chỉ với loại `pre-023`:** sau khi 023 được áp lại vẫn còn bản không có số (không in số đếm: nó sẽ cộng các dự án; xem `held_by_project` ở bước 7 của lần chạy `post-023`, hay câu ở mục 7). **Với loại `post-023` không còn là lỗi từ 0.3** (lời Chairman 22/11/2026, OQ-59 (b) (1)): số đếm vào dòng trả lời, mã không in | `pre-023`: **dừng**; áp lại `migrations/023_thread_order.sql` (bước 6) rồi chạy lại bước 7. `post-023`: **không dừng**; số đếm theo dự án ở `held_by_project` (và một NOTICE không mã, không số); luồng vẫn bị giữ như ở nguồn; xem mục 7; không tự đánh số |
| POST-RESTORE-06 | dòng đếm của một luồng lệch với số của nó, hoặc một số không có dòng đếm | dừng; dữ liệu không nhất quán; hỏi trước khi sửa |
| POST-RESTORE-07 | một số thuộc luồng khác với luồng của tin gốc | như 06 |
| POST-RESTORE-08 | một quyết định mang vị trí mà không xác nhận nháp ứng viên nào có thể có (không phải xác nhận, hoặc lớn hơn số cuối của luồng) | như 06 |
| POST-RESTORE-09 | có dòng khoá ngoại không có dòng để trỏ tới (in tên ràng buộc, không in hàng), hoặc một khoá ngoại có kiểu khớp mà tệp không kiểm | bản lưu hỏng hay bị sửa; không dùng bản lưu này |
| POST-RESTORE-10 | lần ghi thử (hoàn tác) không cho kết quả đúng (hàm cấp số không còn đánh số: lần ghi thứ 1 là phiên thường, thứ 2 là phiên `replica`; hay phiên bị bỏ ở chế độ `replica`) | dừng; báo kèm phiên bản PostgreSQL |
| POST-RESTORE-98 | một khoá mà tệp cần đang bị phiên khác giữ (ở bước sửa hoặc ở lần ghi thử) hoặc deadlock | dừng mọi thứ ghi vào CSDL rồi chạy lại |
| POST-RESTORE-99 | lỗi khác (kèm SQLSTATE) | dừng; kiểm CSDL, không kiểm log này |

Một lần chạy lại trên CSDL lành không đổi gì: `numbering_trigger_was` là `A`. Tệp chỉ lấy một khoá khi phải sửa trạng thái trigger (`SHARE ROW EXCLUSIVE` lên `source_event_revisions`, `lock_timeout` 1 giây) và lúc ghi thử (`ROW EXCLUSIVE`, rồi hoàn tác).

## 5 · Diễn tập một bản lưu trước 023 vào lược đồ 022 (trước khi áp 023)

Kế hoạch triển khai cần một bản sao lưu đã thử phục hồi. Một bản lưu lấy **trước** 023 có thể diễn tập vào một CSDL mới chỉ có **các migration mà nguồn đã có** (`001`–`022` là giới hạn trên): các bước 3, 4, 5 và 7 như trên (bước 7 với loại `pre-023`, từ bước 3 đã in), **bỏ bước 6**. `deploy/post-restore.sql` nhận ra CSDL chưa có 023, bỏ các phép kiểm của 023, vẫn kiểm khoá ngoại và trạng thái trigger, và ghi `"thread_order" : "023 not applied"` vào kết quả. Đây là bằng chứng rằng bản lưu nạp được (ca R11); nó không phải bằng chứng rằng 023 áp được lên nó (đo N3 trên bản sao dữ liệu thật vẫn là việc riêng).

## 6 · Quy tắc cho người ghi thẳng vào CSDL (N15 và CS-DB-8)

Từ khi có 023, mỗi bản của `source_event_revisions` phải có một dòng ở `source_revision_positions`; trigger cấp số làm việc đó, và chỉ nó. Ai ghi một bản mà không qua trigger đó làm **cả luồng bị giữ**.

1. **Phiên bảo trì cố ý ghi một bản không số** (sửa dữ liệu, một lần nạp riêng) phải **khoá dòng đếm của luồng `FOR UPDATE` trước, và giữ tới commit** của chính nó. Không khoá thì một lệnh xác nhận có thể commit giữa phép kiểm của nó và commit của phiên bảo trì (khe L7/L12 của DELIVERY-016). Đã đo cả hai thứ tự: có khoá thì lệnh xác nhận chờ phiên, hoặc phiên chờ lệnh xác nhận.
   - Luồng **chưa có dòng đếm** thì không có hàng để khoá và không cần: trigger xác nhận từ chối luồng đó (`LTZ03`). **Cấm tự chèn dòng đếm.**
   - Nhiều luồng thì khoá theo một thứ tự cố định `(tenant_id, project_id, chat_id, thread_key)`, kèm `SET LOCAL lock_timeout`, để hai phiên bảo trì không chờ nhau.

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';
SELECT last_seq FROM public.intake_thread_heads WHERE tenant_id = '<tenant_id>' AND project_id = '<project_id>' AND chat_id = '<chat_id>' AND thread_key = '<thread_key>' FOR UPDATE;
-- … ghi bản không số ở đây …
COMMIT;
```

2. **Một loader tự viết chạy với `session_replication_role = replica`** (không phải `pg_restore`, vốn tắt trigger thay vì dùng chế độ đó) nay **vẫn** chạy trigger cấp số (`ENABLE ALWAYS`): nạp một bản trước tin của nó cho `23503`, nạp một bản rồi dòng số đã dump cho `23505`. Đó là chủ ý. Loader như vậy phải `DISABLE TRIGGER` trigger cấp số như `pg_restore --disable-triggers` làm (và lấy khoá dòng đếm theo quy tắc 1), rồi chạy `deploy/post-restore.sql` (loại `post-023`: cơ sở đã có 023 và dữ liệu là của nó); hoặc nạp theo thứ tự mà trigger chấp nhận.
3. **Bật lại trigger cấp số chỉ bằng `ENABLE ALWAYS TRIGGER source_event_revisions_thread_position`** (hoặc áp lại 023). **Cấm** `ENABLE TRIGGER` và `ENABLE TRIGGER ALL`: chúng đặt trigger về `O`, và đường `replica` mở lại không có dấu hiệu nào.

Phần còn lại không đóng được bằng cơ chế (ranh giới tin cậy của R19/R37 ở PR #22, L7/L12): chủ bảng hay superuser `DISABLE TRIGGER` theo tên, ghi, và bật lại trong một giao dịch mà không khoá dòng đếm. Người đó cũng tắt được mọi guard khác. Quy tắc 1 là cách người đó tự giữ mình.

## 7 · Chẩn đoán một luồng bị giữ (chạy tay trên máy chủ; kết quả không dán vào repo)

Số bản không số theo dự án, đánh thứ tự bằng số thứ tự thay vì mã dự án (không in `chat_id`, `thread_key` hay id nào):

```sql
SELECT dense_rank() OVER (ORDER BY r.project_id) AS project_no, count(*) AS revisions_without_number FROM public.source_event_revisions r WHERE NOT EXISTS (SELECT 1 FROM public.source_revision_positions p WHERE p.revision_id = r.id) GROUP BY r.project_id ORDER BY 1;
```

Muốn biết **luồng nào** thì cần `chat_id` và `thread_key`: chạy một câu riêng ở terminal của người vận hành và **không dán** kết quả ở đâu.

`project_no` của câu trên trùng với `held_by_project[].project_no` của dòng trả lời ở bước 7 (cùng thứ tự theo mã dự án), nên số đếm của bộ cài và câu này đối chiếu được mà không in mã nào. Cả hai chỉ xếp hạng các dự án **còn** bản không số, nên số thứ tự đổi khi một dự án được đánh số: đối chiếu trong cùng một lần chạy, đừng so giữa các biên nhận.

**Phục hồi một bản lưu mà nguồn có luồng bị giữ** (OQ-59 (b) (1): Chairman trả lời «(b) (1)» ngày 22/11/2026; phương án ở `docs/OPEN-QUESTIONS.md` đọc «phục hồi nguyên trạng: dịch vụ chạy, luồng vẫn bị giữ như ở nguồn, và gỡ theo câu (a)»): bước 7 đạt và báo số đếm, bộ cài bật dịch vụ. Luồng bị giữ **vì luật 4 của dịch vụ và trigger xác nhận của 023** (một bản không có số ⇒ nháp của luồng bị coi là đã đổi, và xác nhận nháp ứng viên của luồng đó bị từ chối `LTZ03`), không phải vì bước phục hồi dừng. Tin mới đến luồng ấy vẫn được nhận và đánh số tiếp sau dòng đếm của luồng; luồng vẫn bị giữ cho tới khi bản không số được đánh số. Không bước nào của phục hồi đánh số. (Với bản lưu **trước 023**, bản không số sau bước 6 không phải luồng bị giữ mà là bước 6 hỏng: tệp dừng ở `POST-RESTORE-05`.)

**Gỡ** một luồng bị giữ (lời Chairman 22/11/2026: «(a) (1) tới khi bật Z4, (2) trước khi bật Z4»; cách hiểu của phiên điều phối ở khối cuối `docs/OPEN-QUESTIONS.md`, điểm 4, chưa được xác nhận): (1) **tới khi bật Z4**, người vận hành áp lại `migrations/023_thread_order.sql` (bước đánh số của nó) trong một cửa sổ bảo trì, mỗi lần có Chairman duyệt, không viết thêm mã; 023 có thể từ chối (mục 3, bước 6). (2) **trước khi bật Z4**, một kịch bản riêng chỉ đánh số các bản thiếu số, có một vai trò được nêu tên duyệt từng lần chạy: **chưa có**, và vai trò chịu trách nhiệm cùng nơi ghi vết cũng chưa có lời. Đừng tự đánh số bằng `INSERT` vào `source_revision_positions`: bảng đó chỉ có hàm của trigger ghi, và dòng đếm phải khớp.

## 8 · Lệnh kiểm triển khai N12

Trên một CSDL **đang phục vụ** chỉ chạy câu đọc catalog dưới đây (không khoá, không ghi). Kết quả đúng là **đúng hai dòng**: `draft_decisions_subject_order_guard` ở `O` và `source_event_revisions_thread_position` ở `A`. Dòng cấp số ở `O` là chưa sửa sau một lần nạp (đường `replica` đang mở); mọi dòng thứ ba là một trigger không ở `O`; thiếu một trong hai dòng là trigger bị gỡ:

```sql
SELECT c.relname, t.tgname, t.tgenabled FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid JOIN pg_catalog.pg_namespace s ON s.oid = c.relnamespace WHERE s.nspname NOT LIKE 'pg\_%' AND s.nspname <> 'information_schema' AND (t.tgenabled <> 'O' OR t.tgname IN ('draft_decisions_subject_order_guard', 'source_event_revisions_thread_position')) ORDER BY 1, 2;
```

`deploy/post-restore.sql` kiểm nhiều hơn (số, khoá ngoại, ghi thử) và là lệnh của lúc **phục hồi**, khi dịch vụ dừng. Chạy nó trên CSDL đang phục vụ thì phép 09 và `ANALYZE` quét toàn bảng và phép ghi thử ghi rồi hoàn tác: chạy ngoài giờ cao điểm, và không coi nó là phép kiểm hằng ngày. Một trigger bị **gỡ** (ngoài hai trigger của 023) hay một mặc định `session_replication_role` đặt sau này không bị câu trên bắt; phép kiểm lúc khởi động của dịch vụ (nửa sau của N12) vẫn mở. Nếu chạy nó ở đó thì nêu loại `post-023` (cơ sở phục vụ đã có 023; từ `pre-023` là của bản lưu chưa đánh số).
