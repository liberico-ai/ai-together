# N4: phục hồi dữ liệu từ một bản lưu lấy sau migration 023 — bộ cài, kiểm trước và sau nạp, quy tắc N15 · 20/11/2026

PR riêng vào `libetech-ai-os` (không vào `main`), việc N4 của `docs/DELIVERY-016-oq-53-subject-order-and-revisions-20261119.md` mục «Điều kiện» (kèm N12 một nửa, N15 phần quy tắc, và phần dư L7/L12). Nhánh `n4-restore-after-023`, gốc `38fe19a` (đầu `libetech-ai-os` lúc cắt nhánh, sau PR #26; PR #27 đến sau và chỉ sửa `DELIVERY-016` và ROADMAP, không trùng tệp). Kế hoạch: `docs/plans/n4-restore-after-023.md`; quy trình: `docs/RUNBOOK-RESTORE-AFTER-023.md`; bằng chứng: `docs/reviews/n4-evidence-20261120/`. **Đã merge** (PR [#28](https://github.com/liberico-ai/ai-together/pull/28)) vào `libetech-ai-os` ngày 20/11/2026 lúc 02:48Z (`52b1e84`, đầu PR `36d3275`) sau lời Chairman «Merge #28» nói ở phiên OQ-53 (phiên điều phối đối chiếu với bản ghi của phiên đó và với GitHub). Chưa triển khai, chưa dùng thật, chưa nghiệm thu.

**Z4 chưa bật và không được bật bởi PR này. 022 và 023 chưa áp ở đâu ngoài CSDL thử. Không triển khai d1-ai1, không chạy `pg_restore` lên CSDL thật, không khởi động lại gateway, không gửi tin vào nhóm thật.** Thứ tự Chairman đã nêu (khối cuối `docs/OPEN-QUESTIONS.md` sau PR #26): N4 làm trước, N2 kiểm trên gateway thật là việc của người, N15 trước khi bật Z4.

## Bốn mức — ghi riêng, không gọi mức sau khi mới đạt mức trước

| Mức | Trạng thái | Căn cứ |
|---|---|---|
| **Đã có mã** | **Đạt mức «đã có mã».** Cổng bảo mật và cổng CSDL trên kế hoạch (không P0); ba review tầng 1 trên mã (không P0; một P1 và các P2 đã đóng, mục «Cổng»); cổng Codex: vòng 1 `CHANGES_REQUIRED` (đã sửa), vòng 2 **`VERDICT: PASS`** (mục «Cổng») | commit trên nhánh; `deploy/restore-plan.py`, `deploy/pre-restore.sql`, `deploy/post-restore.sql`, `deploy/install-user.py`, `deploy/install-d1.sh` |
| **Đã thử phục hồi trên CSDL thử** | **Đạt.** PostgreSQL 16.15, `pg_dump` / `pg_restore` / `psql` thật trong container thử: 17 ca diễn tập xanh, gồm cả «đỏ» của lệnh cũ và «xanh» của quy trình mới trên cùng dữ liệu | `docs/reviews/n4-evidence-20261120/logs/` |
| Đã triển khai | **Chưa.** Không d1-ai1; hai bộ cài **không chạy được đầu-cuối từ cây này** (xem «Còn mở» 1); đường được diễn tập thật là runbook | điểm dừng Chairman |
| Đã dùng thật | **Chưa.** Không bản lưu thật nào được nạp bằng quy trình mới; không ai dùng `LIBETECH_ARCHIVE_SHA256` ngoài ca thử | — |
| Đã nghiệm thu | **Chưa.** Người làm không tự nghiệm thu | — |

## Điều đã đo (PostgreSQL 16.15; #fact)

1. **Lệnh nạp của hai bộ cài trước N4 hỏng với bản lưu sau 023** (CS-DB-2 của `docs/reviews/oq-53-evidence-20261119/gates/class-sweep-database.md` thành số đo): `pg_restore: error: COPY failed for table "draft_decisions": ERROR:  The thread of the candidate moved on` (trigger xác nhận chạy lại trên một quyết định lịch sử mà luồng đã đi tiếp); khi bỏ bảng quyết định ra khỏi danh mục nạp, `COPY failed for table "intake_thread_heads": … duplicate key value violates unique constraint` (trigger cấp số gặp dòng số mà bản lưu cũng mang). Cả hai là ca R2, R2b; mỗi lần giao dịch rollback sạch.
2. **Phát hiện có sẵn, ngoài 023 (F0):** cùng lệnh ấy hỏng với **mọi bản lưu có tài liệu** từ migration 014: `COPY failed for table "document_records": … violates foreign key constraint "fk_document_records_latest_revision"`, vì `document_records` và `document_revisions` trỏ vào nhau bằng hai khoá ngoại không hoãn được và không thứ tự nạp nào thoả cả hai. `pg_dump --data-only` tự cảnh báo điều này. Lần nạp pilot 08/11 chạy được vì lúc đó chưa có tài liệu. Ca R9. Hệ quả: ràng buộc «không đổi hành vi với bản lưu trước 023» của đề bài **không giữ được** cho mọi bản lưu; thay bằng «cùng kết quả như nâng cấp tại chỗ» (ca R10, R13).
3. `pg_restore --disable-triggers` nạp được cả hai loại bản lưu, nhưng cuối cùng chạy `ENABLE TRIGGER ALL` nên trigger cấp số của 023 từ `A` về `O` (ca R3): đường `session_replication_role = replica` mở lại không có dấu hiệu nào, vì 023 chấp nhận cả `O` lẫn `A`. Mọi trigger khác ở `O`; chỉ 023 dùng `ENABLE ALWAYS`.
4. `--disable-triggers` tắt cả mười một trigger `BEFORE INSERT` của CSDL (đọc từ catalog, kể cả `memberships_doc_approve_guard`) và các trigger khoá ngoại trong lúc nạp; `CHECK`, `UNIQUE`, `NOT NULL`, khoá chính vẫn chạy.
5. `deploy/BUNDLE-MANIFEST.json` là của 0.2.0 (08/11): chỉ migration 001–003, hash của cả hai bộ cài đã khác, và `deploy/verify-bundle.py` **đã** báo `Bundle mismatch` ở chính cây này trước khi PR này sửa gì. `scripts/package-release.py` sinh manifest (quét `deploy/`, `migrations/`…); chưa chạy.

## Đã làm

| Tệp | Việc |
|---|---|
| `deploy/restore-plan.py` (mới) | một nơi cho luật: phân loại bản lưu `post-023` / `pre-023` bằng danh mục `pg_restore --list` (một trong hai bảng số ⇒ từ chối), bản lưu phải phủ mọi bảng của đích (danh sách bảng rỗng hay không đọc được ⇒ từ chối), cờ nạp (`--exit-on-error --single-transaction --data-only --no-owner --disable-triggers`), hai câu truy vấn của bộ cài; dùng bởi `install-user.py`, `install-d1.sh` và ca diễn tập |
| `deploy/pre-restore.sql` (mới) | đích không có dòng nào (trừ `schema_migrations`); mã `PRE-RESTORE-01/02/99` |
| `deploy/post-restore.sql` (mới) | một lệnh sau mọi lần nạp: đặt trigger cấp số về `A`, đọc catalog (mọi trigger `O`, trigger cấp số `A`, hình dạng hai trigger của 023), mọi bản có số, dòng đếm khớp số, số khớp luồng của tin, vị trí của quyết định hợp lệ, không khoá ngoại mồ côi (từ `pg_constraint`), một lần ghi thử hoàn tác (phiên thường và phiên `replica`), `ANALYZE`; một dòng JSON; lỗi mã `POST-RESTORE-nn`, không mang dữ liệu; chạy được cả khi đích chưa có 023 (diễn tập bản lưu trước 023 vào lược đồ 022) |
| `deploy/install-user.py`, `deploy/install-d1.sh` | đòi `LIBETECH_ARCHIVE_SHA256` (từ người vận hành; `install-d1.sh` còn đòi `LIBETECH_BUNDLE_TREE_SHA256`, digest của bản phát hành), dùng bản chép riêng đã kiểm băm của bản lưu cho mọi bước sau khi băm và chép, kiểm tệp chạy với quyền cao nằm trong manifest, phân loại → kiểm đích rỗng → nạp một giao dịch với trigger tắt → (bản trước 023: kiểm không có vị trí, áp lại 023) → `post-restore.sql` → mới đến mật khẩu và unit; `install-d1.sh` không chạy gì từ bundle trước khi chép nó: chụp bundle một lần vào thư mục chỉ root vào được, kiểm bản chụp bằng bộ kiểm nằm trong chính script (digest tính lại, hash từng tệp, cả cây không có gì ngoài tệp liệt kê và hai manifest: không symlink, không bytecode) và chạy mọi thứ chạy bằng root/postgres từ đó, `python3 -I`, không in lời lỗi của `pg_restore`; từ nay `install-d1.sh` cũng từ chối bản không phải data-only |
| `docs/RUNBOOK-RESTORE-AFTER-023.md` (mới) | các bước, bảng mã, ranh giới tin cậy của một lần nạp tắt guard, quy tắc N15 và CS-DB-8 cho người ghi thẳng vào CSDL, câu chẩn đoán luồng bị giữ, câu catalog N12 cho CSDL đang phục vụ |
| `docs/DEPLOY-002.md`, `docs/plans/n4-restore-after-023.md`, `docs/OPEN-QUESTIONS.md` | con trỏ; kế hoạch và mục 11 (điều hai cổng đã đổi); **OQ-59** nối cuối tệp |
| `.gitignore` | `.vitest/` |
| `tests/restore-rehearsal.test.ts` (mới; native, cần `SLICE1_PG_CONTAINER`) | 17 ca với `pg_dump` / `pg_restore` / `psql` thật |
| `tests/post-restore.test.ts` (mới; PGlite và native) | 24 ca: sửa trạng thái, từng phép kiểm, ghi thử không để lại gì, hai tenant cùng chat và luồng, khoá bị giữ (native) |
| `tests/test_install_user.py` | từ 17 lên 70 ca: phân loại, thứ tự và lỗi của hai bộ cài, băm, manifest, chỉ in mã |

## Điều kiện của DELIVERY-016

- **N4 — đã có mã và đã thử phục hồi trên CSDL thử; điều kiện N4 chưa đóng.** Một bản lưu lấy sau 023 phục hồi được bằng quy trình mới (R4–R8); lệnh cũ không (R2, R2b). Điều kiện đóng khi bộ cài chạy được từ một bản đóng gói và được diễn tập trọn bộ trước d1-ai1 («Còn mở» 1).
- **N12 — đóng một nửa.** Lệnh kiểm triển khai: `deploy/post-restore.sql` (lúc phục hồi) và câu catalog ở runbook mục 8 (CSDL đang phục vụ) xác nhận `tgenabled = 'A'` cho trigger cấp số và `'O'` cho trigger xác nhận. **Phép kiểm lúc khởi động của dịch vụ chưa có.**
- **N15 — một phần.** Quy tắc cho phiên bảo trì (khoá `FOR UPDATE` dòng đếm của luồng trước) và câu chẩn đoán đã viết (runbook mục 6, 7), và bước kiểm sau phục hồi dừng với `POST-RESTORE-05` thay vì giấu một bản không số. **Quy trình gỡ luồng bị giữ và người chịu trách nhiệm: OQ-59 (a), chưa có quyết định.**
- **L7/L12 — không đổi.** Chủ bảng hoặc superuser `DISABLE TRIGGER`, ghi, bật lại trong một giao dịch mà không khoá dòng đếm vẫn là ranh giới tin cậy; quy tắc 1 của N15 là cách người đó tự giữ mình. Việc nạp bằng superuser với trigger tắt là đúng loại người ấy: nay có `post-restore.sql` kiểm trạng thái sau đó.

## Bằng chứng

| Kiểm | Kết quả |
|---|---|
| `npm run typecheck` | đạt (exit 0) ở `dfdd68c`; lần đầu của lượt đo cuối lỗi vì một bản sao do iCloud tạo cạnh tệp SINH RA `.next/types/routes.d N.ts` (không phải mã); đã xoá các bản sao và chạy lại: `logs/typecheck.txt` |
| `npm run build` | đạt (exit 0) ở `dfdd68c`: `logs/build.txt` |
| `python3 -m unittest tests/test_install_user.py` | 70 ca đạt |
| `tests/post-restore.test.ts` | PGlite: 23 đạt, 1 bỏ qua (ca khoá, native); PostgreSQL 16: 24 đạt |
| `tests/restore-rehearsal.test.ts` (PostgreSQL 16.15, công cụ thật) | 17 đạt: R1, R2, R2b, R3 (lệnh cũ và `--disable-triggers` trơn), R4–R8 (bản lưu sau 023), R9–R13 (bản lưu trước 023) |
| Đột biến `deploy/post-restore.sql` | 17 đột biến (các mã `POST-RESTORE-01, 02, 04`–`10` thành `NOTICE` (không có 03, 98, 99), bỏ bước sửa, bỏ trả lại `lock_timeout`, bỏ phạm vi dự án của phép 06…): 16 làm ít nhất một ca đỏ. Lớp phòng thủ thứ hai (kiểm `session_replication_role` sau lần ghi thử) **không** có ca nào đỏ khi chỉ bỏ nó, và đột biến kết hợp (bỏ cả lớp thứ nhất) đỏ cùng các ca như đột biến đơn của lớp thứ nhất: lớp thứ hai **chưa được chứng minh bằng ca**; nó là phòng thủ, không phải điều kiện |
| Bộ test đầy đủ (`npx vitest run`, cây sạch ở `dfdd68c`) | **PGlite: 1 311 đạt, 136 bỏ qua** (nền ghi trong đề bài: 1 287 / 118; bỏ qua thêm 18 = 17 ca diễn tập chỉ chạy native + ca khoá `P10c`). **PostgreSQL 16.15: 1 447 đạt, 0 bỏ qua** (nền 1 405 / 0). Số ca đạt hơn nền là 24 (PGlite) và 42 (native), nhiều hơn số ca N4 thêm vào 1 ở mỗi bên (PGlite: 23 ca post-restore chạy; native: 24 + 17): một ca ngoài N4 chưa được truy nguyên, có thể nền của đề bài lệch một. `logs/vitest-pglite-full.txt`, `logs/vitest-native-full.txt` |

## Cổng

- **Cổng trên kế hoạch (trước khi viết mã), hai ghế:** bảo mật — không P0, một P1 (bộ bash đọc bản lưu hai lần, không có cổng băm), bảy P2, bốn P3; CSDL — không P0 hay P1, hai P2 (cờ hoàn thành; bản lưu thiếu bảng hoặc bản trước 023 mang vị trí), mười hai P3. Mỗi finding và cách xử lý: `docs/plans/n4-restore-after-023.md` mục 11.
- **Review tầng 1 trên mã, ba ghế:** bảo mật + quét theo lớp — không P0, một P1 (tệp chạy bằng root đọc lại từ thư mục ghi được, `python3` không `-I`), sáu P2, bảy P3; mã — không P0 hay P1, bảy P2, nhiều P3; CSDL — không P0 hay P1, hai P2 (lỗi khoá ở lần ghi thử báo sai mã; `ANALYZE` sau câu trả lời), tám P3. Đã đóng: mọi P1 và P2; mọi P3 trừ các mục ở «Còn mở».
- **Cổng Codex (tầng 2):** vòng 1 `CHANGES_REQUIRED` (P0: `install-d1.sh` chạy `verify-bundle.py` từ bundle trước khi chụp; P1: lệnh nạp thủ công ở runbook dùng `$(…)` có thể rỗng; P2: ô đo của biên nhận chờ lượt cuối) — đã sửa, kèm hai finding cùng lớp của một kiểm tra bảo mật tự động (bytecode và thư mục symlink bị bộ kiểm bỏ qua; digest bản phát hành tuỳ chọn) và các sửa chữ của cổng thực tế; vòng 2 (`codex-round-2.md`) **`VERDICT: PASS`, không có finding**. Hai vòng, không vòng sửa thứ ba. Chỉ tệp `--output-last-message` được lưu; không có transcript thô. **Cổng thực tế (`liberico-reality-checker`):** `READY WITH TEXT FIXES`, không P0/P1; ba P2 và các P3 chữ đã sửa (mục «Còn mở», «Lệch quy trình», runbook, README).

## Còn mở và phần dư

1. **Hai bộ cài không chạy được từ cây này** (manifest 0.2.0). Cần một lần đóng gói (`scripts/package-release.py`) rồi một lần diễn tập trọn bộ cài trên máy thử trước d1-ai1; `--resume-empty-db` của `install-user.py` đã là đường chết từ trước (đòi byte nguồn của lần thử đầu): N4 chỉ cho nó `hold_archive` và băm của người vận hành, **không** kiểm manifest cho nó.
2. **Giao diện vận hành đổi:** cả hai bộ cài đòi `LIBETECH_ARCHIVE_SHA256` (ghi lúc dump, từ kênh khác tệp); `install-d1.sh` còn đòi `LIBETECH_BUNDLE_TREE_SHA256` (`sourceTree` mà `scripts/package-release.py` in); cả hai từ chối bản không phải data-only và bản không phủ mọi bảng của đích (trước đây không kiểm). Kế hoạch triển khai phải nêu điều này.
3. **Không kiểm lại bất biến của guard 019, 021, 022 sau nạp** (quyền duyệt tài liệu cần phiếu; xác nhận phải mang nguồn và băm của nháp; nháp của dự án IBS HI). Biên giới là kênh chuyển tệp cộng SHA-256, và nguồn đã chạy các guard ấy lúc ghi; hai cổng đều không đòi thêm. **Chairman quyết nếu muốn đóng cả trường hợp bản lưu bị sửa tay mà vẫn mang đúng băm.**
4. **Bản lưu sau 023 bị cắt cả hai bảng số và không quyết định nào mang vị trí** không phân biệt được với bản lưu trước 023: áp lại 023 sẽ đánh số cả những bản mà nguồn đang giữ. Chỉ đóng bằng đúng lệnh dump và SHA-256 lúc dump (runbook mục 2).
5. Bản chép bản lưu của `install-user.py` thuộc chính tài khoản dùng chung với gateway: nó cố định cái đã băm, không ngăn người cùng tài khoản ghi đè sau đó (bản của `install-d1.sh` chỉ root đọc được). Bộ cài này chạy chung tài khoản theo thiết kế của 0.2.0.
6. `deploy/provision-server.py` (có từ trước) vẫn chạy bằng `python3` không `-I` vì cần PyYAML; nó chạy từ bản chụp root-only. Bản chép dưới `/opt` (thứ dịch vụ chạy, do bản dựng sinh ra bởi một tài khoản khác) **không** được N4 kiểm lại: có từ trước; không có gì chạy bằng root hay postgres đọc từ đó.
7. Một trigger **bị gỡ** (ngoài hai trigger của 023) hay một mặc định `session_replication_role` đặt sau này không bị câu catalog của runbook mục 8 bắt; phép kiểm lúc khởi động của dịch vụ (nửa sau N12) chưa có.
8. `pre-restore.sql` kiểm đích rỗng rồi bộ cài nạp: không có bên ghi nào giữa hai bước (cụm PostgreSQL do bộ cài vừa tạo, loopback, role web và auth chưa có mật khẩu); `install-d1.sh` cũng vậy.
9. Tên bảng có dấu cách làm phép kiểm «bản lưu phủ mọi bảng» từ chối nhầm (không có tên như vậy; từ chối là phía an toàn).
10. **OQ-59** (a) gỡ luồng bị giữ, (b) bản lưu sau 023 mà nguồn đã có luồng bị giữ, (c) bản lưu trước 023 có nháp ứng viên chưa quyết định: chưa có quyết định; hành vi tạm của N4 là dừng. **Cập nhật 22/11/2026:** Chairman đã quyết (a) (1) tới khi bật Z4, (2) trước khi bật Z4; (b) (1); (c) (1) — lời chép nguyên ở khối cuối `docs/OPEN-QUESTIONS.md`. Câu (b) (1) khác hành vi của mã này (dừng ở `POST-RESTORE-05`); mã chưa đổi.
11. **Bản lưu của lược đồ cũ hơn đích bị từ chối** (phép «phủ mọi bảng»): bản lưu pilot 08/11 (lược đồ 003) hay một bản lưu của bản đang chạy (0.7.1) vào đích 001–023 bị từ chối kèm danh sách bảng thiếu. Cách đúng: tạo đích chỉ với các migration mà nguồn đã có, phục hồi, rồi áp các migration sau tại chỗ (runbook mục 3, bước 1, và mục 5). Bản lưu thật của d1-ai1 chưa được diễn tập theo cách đó.
12. **Phạm vi của số đo:** diễn tập dùng một bộ dữ liệu tổng hợp nhỏ (6 bản, 2 luồng, một tài liệu); chưa đo thời gian ở khối lượng thật; ví dụ `FOR UPDATE` của runbook mục 6 không có ca nào chạy trong PR này (số đo «cả hai thứ tự» là của PR #24, `DELIVERY-016` mục N15).
13. **Gốc tin của bundle:** `install-d1.sh` chạy từ bundle do người vận hành duyệt (chính script); từ đó bộ kiểm nằm trong script và digest của bản phát hành là bắt buộc; `install-user.py` chưa đòi digest ấy. `provision-server.py` (có từ trước) chạy không `-I` từ bản chụp đã kiểm (cả cây sạch) và **đọc** digest từ manifest dưới `/opt` (dữ liệu, không chạy); bản chép dưới `/opt` không được N4 kiểm lại.
14. Các báo cáo gốc của ba ghế tầng 1 không được lưu thành tệp (`gates/tier1-dispositions.md` là bản ghi, do người làm viết); số «mười một trigger `BEFORE INSERT`» xác nhận bằng `grep "CREATE TRIGGER .* BEFORE INSERT" migrations/0*.sql` và bằng catalog của CSDL đã áp 001–023, chưa có tệp kết quả của câu catalog.

## Cần Chairman quyết hoặc xác nhận

1. **OQ-59** (ba câu), trước khi bật Z4 (lời Chairman 19/11/2026: «N15 trước khi bật Z4»). **Đã quyết 22/11/2026** — xem điểm 10 của mục «Còn mở và phần dư» ở trên.
2. Chấp nhận `LIBETECH_ARCHIVE_SHA256` bắt buộc cho cả hai bộ cài (và vì thế mỗi bản lưu phải được ghi băm lúc dump ở một kênh khác tệp).
3. Có đòi thêm phép kiểm sau nạp cho bất biến của guard 019/021/022 không («Còn mở» 3).
4. Ai đóng gói lại bản phát hành và diễn tập bộ cài trọn bộ trước d1-ai1 («Còn mở» 1).

## Điểm dừng — không làm, chờ Chairman

Áp 022/023 lên dữ liệu thật · triển khai d1-ai1 · `pg_restore` lên CSDL thật · khởi động lại gateway chung · gửi tin vào nhóm thật · bật Z4 · quyết N6 · OQ-54, OQ-55 (b), OQ-56, OQ-59 · merge (mọi PR cần Chairman duyệt).

## Lệch quy trình, ghi thật

- Phiên làm việc nhỏ nên **không dùng agent `builder`**: mã và test viết ở phiên chính; `planner` viết kế hoạch; hai cổng soát kế hoạch trước khi mã vào repo.
- **Ca viết cùng lúc với mã hoặc sau mã, không có log đỏ riêng:** `U3b` (thứ tự và lỗi của bộ cài), `U6c`–`U6h` (thứ tự, bản chụp, bộ kiểm, đầu ra của `install-d1.sh`), `U7`, `U8` (phần trích mã), `U9`, `U10` ở `tests/test_install_user.py`; `P7c`, `P10b`, `P10c`, `P17` ở `tests/post-restore.test.ts`; `R4b`, `R7b`, `R7c`, `R13` ở `tests/restore-rehearsal.test.ts`. Phần lớn là phản ứng với finding của hai cổng và ba review; chúng được kiểm bằng **đột biến** (mục «Bằng chứng») hoặc bằng ca chạy trên cây thật (`U6h`), không bằng log đỏ.
- **Log đỏ là của các bản test cũ hơn bản cuối** (`docs/reviews/n4-evidence-20261120/logs/red-*.txt`, xem README): ca diễn tập 14 ca khi chưa có tệp mới (10 đỏ bằng `AssertionError`, 0 lần hết giờ); `post-restore` 16 ca đỏ bằng `ENOENT` khi chưa có tệp (kế hoạch đã ghi đó chưa phải lý do đúng); ca Python 36 trong 67 khi chưa có hàm (lỗi thiếu hàm, không phải khẳng định). Lần chạy đầu khi tệp `post-restore.sql` đã có cho **bốn ca đỏ bằng khẳng định của chính chúng** (P5b, P9, P12, P14: lỗi của ca hoặc của tệp, đã sửa) ở `logs/first-run-post-restore-with-the-file.txt`.
- Ca diễn tập dùng biến `SLICE1_PG_CONTAINER` (kế hoạch 0.2 ghi `RESTORE_REHEARSAL_TOOLS`); không có `tests/restore-tools.ts`.
- Khoá JSON của câu trả lời là `snake_case` vì hook CSDL của máy coi `camelCase` là vi phạm E-DB-02.
