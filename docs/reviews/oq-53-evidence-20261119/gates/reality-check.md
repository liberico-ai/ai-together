VERDICT: READY WITH TEXT FIXES

# Reality check · PR OQ-53 (+ OQ-57) · biên nhận DELIVERY-016 (bản nháp)

Ghế: `liberico-reality-checker` (độc lập; không phải người dựng). Khuyến nghị cho Chairman, không phải phê duyệt. Nhánh `feat/oq-53-subject-verification`, đầu `ea9bf4d`, mã đã đo ở `4df2db3`, gốc `80c1ad8`. Mọi đường dẫn viết `<repo>`/`<scratch>`; báo cáo không chứa secret, chuỗi kết nối, chat ID hay đường dẫn máy. Thẻ: #fact = tôi tự đo/đọc; #inference = suy luận chưa kiểm; #log = chỉ có log của người khác, tôi không chạy lại.

Tổng: **P0 0 · P1 0 · P2 3 · P3 8.** Không finding nào đòi đổi mã, migration hay ca kiểm. Cả ba P2 và tám P3 là chữ của biên nhận hoặc tệp hồ sơ, trong đó một P2 (F-1) phải sửa **trước lần push đầu tiên** vì nằm trong một commit cục bộ.

## 0 · Khẳng định đang xác minh, nguồn tiêu chí, xác minh ở mức nào

Khẳng định (nguyên ý của biên nhận): ba điểm Chairman đã quyết ngày 19/11/2026 cho OQ-53 (điểm 1 (b), điểm 2 (a), điểm 3 (b)) và hai điểm của OQ-57 đã được làm bằng mã, migration 023 (có tệp lùi), hợp đồng/prompt/manifest/eval; hai giữ chỗ `SUBJECT_EDIT_UNVERIFIED`, `SUBJECT_ORDER_UNVERIFIED` đã gỡ; mức hiện là **«đã có mã», chưa merge, chưa triển khai, chưa dùng thật, chưa nghiệm thu**; mã đo xanh ở `4df2db3`. Tiêu chí: «Đạt khi» của brief, `docs/plans/oq-53-subject-verification.md` (0.3), `docs/OPEN-QUESTIONS.md` (:872–882, :924, :944–991, :997–1028).

Mức tôi xác minh: **mã trên nhánh, trên PGlite và trên PostgreSQL 16.15 thật ở CSDL riêng của tôi.** Không phải triển khai, không phải production, không phải gateway chạy thật.

Danh sách probe lập TRƯỚC khi chạy: (P1) ràng buộc phạm vi và điểm dừng bằng `git diff`; (P2) số trong biên nhận ↔ log; (P3) 023 và tệp lùi ↔ bảng W và phần mô tả; (P4) bảng mã lý do ↔ `suggestions.ts`, `source-text.ts`; (P5) bảng ca âm ↔ thân ca; (P6) phản biện bằng phép đo: chạy lại từng tệp trên PGlite, chạy native N7/N8/N12/N13/N14 cùng cả ba tệp native chính, **đối chứng phải đỏ** bằng đột biến trên bản `git archive HEAD` đặt ngoài repo (A: bỏ `head!==baseline`; B: bỏ so `cur <> NEW.subject_thread_seq`; C: bỏ `FOR NO KEY UPDATE`; D: trigger cấp số thành `BEFORE INSERT`); (P7) bốn mức; hai finding còn lại của các ghế; chỗ lệch bị bỏ sót.

## 1 · Bảng «khẳng định → bằng chứng → phán quyết»

| # | Khẳng định của biên nhận | Bằng chứng tôi có | Phán quyết |
|---|---|---|---|
| 1 | Mã đo ở `4df2db3`; commit sau chỉ thêm hồ sơ | `git diff --name-only 4df2db3..HEAD`: 9 tệp (biên nhận + 8 tệp bằng chứng), **0** tệp ngoài `docs/` #fact | ĐÚNG |
| 2 | `npm run typecheck` mã thoát 0 | `task-9-typecheck.txt` (`EXIT=0`); tôi chạy `npx tsc --noEmit` và `--incremental false`: thoát 0, 0 dòng #fact | ĐÚNG |
| 3 | `rm -rf .next && npm run build` mã thoát 0 | `task-9-build.txt` (`EXIT=0`) #log. Tôi không chạy build | KHÔNG KIỂM ĐƯỢC bởi tôi (log nhất quán) |
| 4 | PGlite cả bộ: 67 tệp đạt + 13 bỏ qua; 1 280 đạt / 112 bỏ qua; 0 đỏ | `task-9-pglite-coverage.txt:6-7` #log. Tôi không chạy cả bộ (đúng chỉ đạo); chạy từng tệp (xanh): `source-text` 41, `skill-contracts` 42, `skills-manifest` 19, `skills-eval` 44, `skill-context` 23, `thread-order` 22 + 8 bỏ qua, `migrations-rollback` 10, `suggestions` 120 + 1 bỏ qua #fact | ĐÚNG (cả bộ: log; từng tệp: tôi) |
| 5 | PostgreSQL 16.15 cả bộ: 80 tệp, 1 392 đạt / 0 bỏ qua; không `40P01` thật | `task-9-native-verbose.txt`: đếm `✓` = **1 392**, 0 `×`, 25 dòng của `thread-order-concurrency` gồm N12, N13; 8 dòng «deadlock» đều là tên ca đạt #log+#fact. Tôi chạy native ở CSDL riêng: `thread-order` 30, `migrations-rollback` 10, `thread-order-concurrency` 25, `suggestions` 121, `suggestions-concurrency` 9: **195 ca, 0 đỏ, 0 bỏ qua** #fact. Container: `16.15`, chỉ `127.0.0.1` #fact | ĐÚNG |
| 6 | Nền `80c1ad8`: PGlite 1 220/79 (66+12 tệp), PG16 1 299/0 (78 tệp) | `head-9b0f83f-coverage.txt:7`, `head-9b0f83f-native-verbose.txt:1732`; `9b0f83f` là tổ tiên và `git diff --stat 9b0f83f 80c1ad8 -- src tests migrations skills` rỗng #fact | ĐÚNG (nhưng biên nhận trích cả thư mục, nơi còn log cũ `final-*` mang số 1 184/65 và 1 249: xem F-11) |
| 7 | Coverage: 96,35·91,68·98,06·97,61 → 96,40·91,89·98,07·97,64; `suggestions.ts`, `skill-context.ts`, `source-text.ts` | `task-9-pglite-coverage.txt:13-59` và log nền: **mọi số khớp** #log | ĐÚNG các số. **SAI** câu «Reporter chỉ cho %, không cho covered/total»: cả hai log có khối tổng có covered/total (3 386/3 514 → 3 435/3 563; nhánh 2 204/2 404 → 2 257/2 456; hàm 761/776 → 763/778; dòng 2 536/2 598 → 2 575/2 637) (F-6) |
| 8 | 0,52 s cho 60 000 bản; 3,3 s cho 300 000; WAL 44 MB | `gates/plan-database-round-1.md:50` #log | ĐÚNG. Lưu ý đã có trong biên nhận (N3): đo 500 000 bản là 6,65–10,16 s, cao hơn ngoại suy 1,5–2,4 lần (`review-task-1-2-database.md:92`) |
| 9 | Giữ khoá của lệnh xác nhận 2,3–2,7 ms (lạnh 8,9) so với 32–34 ms; dự án 99,8 nghìn bản | `review-service-database.md` §2.2: 8,9/2,4/2,7/2,3/2,6 ms; 34,0/33,7/32,1/33,7/32,7 ms; 99 794 bản #log | ĐÚNG |
| 10 | Trần 250 000; mã `LTZ03`, `55P03`, `40001`, `40P01` | `migrations/023_thread_order.sql:193`; `suggestions.ts` (`SUBJECT_ORDER_SQLSTATE='LTZ03'`); `023:261-283`; N4/N6 #fact | ĐÚNG |
| 11 | Bảng W1–W8 và mô tả 023 (bốn phép từ chối; kiểm login hai lần, lần hai ngay trước `schema_migrations`; `CREATE OR REPLACE TRIGGER`; tệp lùi khoá bản sửa rồi `draft_decisions`; từ chối khi có bản ghi migration sau 023 hoặc dòng quyết định mang vị trí) | Đọc từng dòng `023:86-304` và `rollback/023:18-75` #fact: mọi điều khớp. Chạy A6/A7/A7b/A8/A9–A14/B1–B9 và RB-023 native: xanh | ĐÚNG. **Thiếu** W6, W7, W9, W10 (bảng nhảy W5→W8) và chi phí W3 (F-8) |
| 12 | Bảng «Mã lý do» | Khớp `suggestions.ts` (`subjectReasons`, bắt `LTZ03`), `source-text.ts:135-167`, `MASK_REASONS` không đổi trong diff #fact | ĐÚNG phần đã nêu. **Thiếu** hành vi SV-S-2 (F-2) và việc câu trả lời của lệnh xác nhận nay tả trạng thái lúc kiểm (F-3) |
| 13 | `grep` hai mã giữ chỗ trong `src tests skills migrations` = 0 | tôi chạy: **0** dòng; ca J3 canh chính điều đó (viết mã thành hai mảnh) #fact | ĐÚNG |
| 14 | «Nháp ứng viên xác nhận được lại khi nó nêu bản mới nhất của mọi tin của luồng có chữ hiện» (dòng 94) | Mã (`source-text.ts:166`) và kế hoạch mục 8: không cần nêu mọi tin (E9: nêu tin sau mà không nêu tin trước vẫn xác nhận); nhưng nêu chỉ tin cũ của luồng đã có tin sau thì **bị giữ** (J4) #fact | ĐÚNG MỘT PHẦN, dễ hiểu sai (F-5) |
| 15 | Ca âm: bản sửa đến giữa chừng ⇒ giữ | J1 (i), (iii) và N13 đúng. **K3 không phải bản sửa**: `arrive` chèn một tin mới (`tests/suggestions.test.ts` khối `arrive`) | ĐÚNG trừ nhãn K3 (F-9) |
| 16 | Ca âm: bản sửa nháp đã đọc không giữ oan | J1 (ii), (iv): `confirmed` #fact | ĐÚNG |
| 17 | Ca âm: luồng đến ngược thứ tự commit, PG thật, hai kết nối (N12; N1/N7/N8/N14 cho cơ chế) | Đọc thân N12 (`thread-order-concurrency.test.ts:587-620`), chạy xanh; **đối chứng đỏ**: bỏ `head!==baseline` ⇒ N12 đỏ (`expected a hold`), N7 và N13 vẫn xanh; bỏ so `cur <>` ⇒ N7 và N13 đỏ (`expected undefined to be 'LTZ03'`), N12 xanh; bỏ `FOR NO KEY UPDATE` ⇒ N7 và N13 đỏ (`expected 'settled' to be 'blocked'`) #fact | ĐÚNG. Phân vai rõ: N12 chứng minh số theo luồng khác thứ tự `created_at` và dịch vụ so theo số; N7/N13 chứng minh chờ khoá và so-và-ghi. Một mình N12 không chứng minh «tin đang bay lúc xác nhận» (xem mục 4) |
| 18 | Ca âm: nháp không nêu bản/tin nào: T4, J2, T18, «ca `:543`» | J2 (`:1658`), T18 (`source-text.test.ts:543`) khớp; ca nháp ứng viên «names no message» (`suggestions.test.ts` ~`:1700`, plan gọi là T4) khớp nhưng **không mang nhãn T4**; ca nháp tài liệu nằm ở **`:551`**, không phải `:543` | ĐÚNG nội dung, SAI số dòng/nhãn (F-9) |
| 19 | Ca âm: role/dự án ngoài phạm vi không lấy khoá (A4, A5, B4, B8, N5, N10, N20, N21) | Cả tám có thật, xanh native #fact | ĐÚNG |
| 20 | 023 áp-lùi-áp; RB-023, A6, A7, A7b; chu trình `task-9-migration-cycle.txt` | Ca `rollback 023 …` có thật (nhãn «RB-023» không nằm trong tên ca); chu trình (a)–(e) khớp; giới hạn «0 bản» đã tự nêu #log | ĐÚNG |
| 21 | R10-g/OQ-57: nguồn con trỏ không mang nội dung (L1, L2–L4, R10-g) | Ca có thật nhưng **nhãn L1–L3 chỉ là nhãn của kế hoạch**: trong `tests/suggestions.test.ts` có `L1`–`L9` là ca **khác** (che theo vai, PR #22); trong `skill-context.test.ts` `L4` là ca hiệu năng (9a), không phải L4 của kế hoạch. Ca đúng nằm ở `skill-context.test.ts:358,394`, `suggestions.test.ts:1930,1941`, `skill-contracts.test.ts:329` #fact | ĐÚNG nội dung; nhãn dễ lẫn (F-9) |
| 22 | Ca canh «no route imports…» không sửa, giống từng byte | Tôi tách thân ca (10 dòng) từ `80c1ad8:tests/suggestions.test.ts` và từ HEAD rồi `cmp`: **giống hệt từng byte** #fact | ĐÚNG |
| 23 | Điểm dừng: `AGENTS.md CLAUDE.md bot-plugin ai-scope.ts intake.ts src/app` không đổi; không tệp mới dưới `src/app/api` | `git diff --stat 80c1ad8..HEAD -- <các đường dẫn>`: **0 dòng**; `git diff --name-status … -- src/app`: 0 #fact | ĐÚNG |
| 24 | `OPEN-QUESTIONS.md` chỉ nối cuối | `git diff --numstat`: **37 thêm / 0 xoá**; hunk bắt đầu ở :989 (cuối tệp). Không có dòng sửa tại chỗ nào (brief nhắc «hai dòng sửa tại chỗ»: chưa làm, xem F-10) #fact | ĐÚNG (ràng buộc giữ); F-10 |
| 25 | Z4 chưa bật: không tuyến/không caller; không login/khoá `libetech_ai`; không gọi mô hình | `grep -rln SuggestionService src` = chỉ `suggestions.ts`; `grep submitDraft|new SuggestionService src` ngoài tệp đó: 0; `023` không có `CREATE ROLE/ALTER ROLE/PASSWORD/GRANT … libetech_ai` (chỉ tên role trong phép kiểm) #fact | ĐÚNG |
| 26 | Lời Chairman 19/11 chép nguyên; chữ phương án đã chọn trích đúng | `OPEN-QUESTIONS.md:949`; :878, :879, :924 khớp từng chữ; :975 là ánh xạ 7; khối OQ-57 :997–1028 khớp #fact | ĐÚNG |
| 27 | Bốn mức; không gọi «đã triển khai/dùng thật/nghiệm thu» | Bảng dòng 11–16: ba mức sau ghi «Chưa»; mức «Đã có mã» ghi «CHỜ: …» đúng việc chờ cổng Codex và ghế này; hai chữ «đã triển khai»/«đã dùng thật» chỉ xuất hiện trong bảng ấy #fact | ĐÚNG |
| 28 | Đột biến: «10 trong 11 đột biến của kế hoạch Task 9 có log với ca đỏ» | `task-9-mutation-matrix.txt` ánh xạ **db1** (trigger cấp số thành `BEFORE`) vào `m-before` của `task-2*-mutants.txt`, nhưng `m-before` ấy là trigger của bảng **quyết định** (ca B1–B6). Không log nào là db1. **Tôi chạy db1 trên bản sao: 19 ca đỏ** (A1–A7b, A9, A9b, B1–B9) | SAI con số «10»: log của builder là **9/11** (db1 và db9 không khớp); db1 thực tế bị bắt (F-7) |
| 29 | «Đường dẫn máy trong log đã thay bằng `<repo>` (quét: 0)»; «dòng thêm của diff không trúng mẫu bí mật/đường dẫn máy» | `task-9-hygiene.txt:8-9` chứa **đường dẫn tạm tuyệt đối có tên người dùng và mã phiên**; log của chính ghế scout (khối (f2)) ghi 1 hit cho `task-9-hygiene.txt` và 1 hit cho một tệp `.raw`, rồi tóm tắt báo «0» #fact | **SAI** (F-1) |
| 30 | `messageRevisions` hôm nay là lời khai của mô hình; N6 chặn trước Z4 | `skill-contracts.ts` (`namedRevisions` «neither checks … nor trusts»); SV2 của ghế bảo mật; không dòng mã buộc pipeline ghi lại giá trị #fact | ĐÚNG, và biên nhận đặt đúng chỗ (điều kiện chặn Z4) |
| 31 | N2: gateway gửi lại khi 5xx/hết giờ | Đọc `bot-plugin/__init__.py:46-52,188-210`, dòng 64 «Not verified against the running gateway», `HOOK_TIMEOUT = 2` (:59) #fact | ĐÚNG như một khẳng định đọc-mã; **chưa kiểm trên gateway thật** (biên nhận đã nói). Lưu ý: hạng «answered» đếm tới `SPOOL_MAX_ATTEMPTS = 5` rồi chuyển vào dead-letter, nên «không phải một tin mất» đúng cho một lần, không đúng cho một luồng bị chặn lâu (F-11) |
| 32 | N4: bộ cài nạp `pg_restore --data-only --single-transaction` không `--disable-triggers` | `deploy/install-user.py:161`, `deploy/install-d1.sh:43`, `docs/DEPLOY-002.md:19` khớp từng dòng #fact | ĐÚNG |
| 33 | Hợp đồng/manifest: `SkillContext/v2`, `0.2.0` cho cả sáu, `outputContract` v2 cho ba kỹ năng nhận tin | `skills/*/manifest.json` (đọc bằng `node`): sáu `0.2.0`, sáu `SkillContext/v2`; ba `…/v2`, ba `…/v1`; `enabled:false`, `modelBinding:none`, `toolAllowlist:[]`, 5 ca eval mỗi bộ; ca `injection` mang `revisionNo` 2 và câu lái chứa số 7 #fact | ĐÚNG |
| 34 | Hash commit trong bảng «Đã làm» | `git log 80c1ad8..HEAD`: mọi hash (`306a8b9`, `4076ba7`, `00228a4`, `dd8ee26`, `e120b1d`, `9b499ae`, `e8c54c5`, `2a94381`, `26ba304`, `4df2db3`, `220b342`) có thật và đúng nội dung #fact | ĐÚNG |
| 35 | «mọi ghế review tầng 1 `READY_FOR_GATE`» | Ba báo cáo `review-service-*` đề `READY_FOR_GATE` **ở `26ba304`**; mã đổi ở `4df2db3` (3 tệp `src`, 13 dòng; 166 dòng ca kiểm) không có ghế nào xem lại #fact | ĐÚNG về nhãn, chưa nói rõ trạng thái nào (F-4) |

## 2 · Finding

### F-1 [P2] Đường dẫn máy kèm tên người dùng nằm trong tệp bằng chứng đã commit; lời «quét: 0» sai

- Vị trí: `docs/reviews/oq-53-evidence-20261119/task-9-hygiene.txt:8-9` (commit `220b342`, **chỉ cục bộ**: không nhánh remote nào chứa nó); biên nhận dòng 102 («quét: 0») và dòng 113; `task-9-verification-summary.md` («Quét đường dẫn thư mục home … 0 cho mọi tệp»). Quét của tôi trên 21 047 dòng THÊM của `80c1ad8..HEAD` với mẫu rộng (thư mục home kiểu macOS, thư mục tạm hệ thống, tên người dùng của máy, tiền tố thư mục phiên, thư mục đệm của macOS): đúng **2 dòng**, cả hai ở tệp này. Quét mẫu bí mật/chuỗi kết nối/token/chat ID thật: không có (các lần trúng là bài đo `redact timing` và UUID tổng hợp). Tệp chưa commit `codex-context-round-1.md`: sạch.
- Vì sao quét của scout sót: mẫu chỉ tìm tiền tố thư mục home dạng có dấu gạch chéo mà đường dẫn tạm của phiên viết tiền tố thư mục home viết bằng dấu gạch trong tên thư mục; log (f2) của chính scout đã in hit khác 0 rồi tóm tắt báo 0.
- Sửa: (1) trong `task-9-hygiene.txt` thay phần đầu hai dòng 8-9 bằng `<scratch>/t9/suggestions-80c1ad8.ts` và `<scratch>/t9/suggestions-HEAD.ts`; (2) vì chuỗi đã nằm trong lịch sử `220b342` và nhánh chưa lên remote, gộp bản sửa vào `220b342` (fixup + autosquash) **trước lần push đầu tiên** của một repo công khai tạm thời, hoặc squash khi merge là chưa đủ nếu nhánh đã bị push; (3) chạy lại quét với mẫu rộng (thêm thư mục tạm hệ thống, dạng tiền tố thư mục home viết bằng dấu gạch dùng dấu gạch thay dấu gạch chéo, tiền tố thư mục phiên, thư mục tạm của phiên) trên cả cây lẫn các dòng thêm, ghi số đếm thật vào dòng 102 và 113 của biên nhận; (4) sửa `task-9-verification-summary.md` cùng câu.

### F-2 [P2] Biên nhận không nêu hành vi SV-S-2 của nháp `release_librarian`, trong khi nó lệch chữ của quyết định OQ-57 điểm 2 (a)

- Vị trí: `gates/review-service-security.md` SV-S-2 (đề nghị rõ «một câu trong `DELIVERY-016`»); ca ghim `tests/suggestions.test.ts:1963`; biên nhận bảng «Mã lý do» và mục «Chỗ khác bản 0.3» #10 (chỉ nói hành vi **trước** task).
- Điều xảy ra (#fact, SV1 của ghế bảo mật và ca `:1963`): một nháp thủ thư nêu **con trỏ** của bản chưa duyệt N; khi bản N+1 được trình, mã bản N rời ngữ cảnh ⇒ nháp bị **che** (`value:null`, `maskReasons:['SOURCE_OUT_OF_CONTEXT']`) và lệnh xác nhận trả `DRAFT_HELD … SOURCE_OUT_OF_CONTEXT`, **không** `SUBJECT_CHANGED`. Quyết định của Chairman (2 (a)): «một bản được trình sau khi nháp viết xong giữ nháp `SUBJECT_CHANGED`». Vẫn fail-closed, từ chối vẫn làm được, không rò gì; nhưng nó là chỗ khác chữ lời Chairman và khác `doc_reviewer`.
- Sửa chữ: thêm vào bảng «Mã lý do» một dòng «`SOURCE_OUT_OF_CONTEXT` (OQ-57): nháp `release_librarian` đã nêu con trỏ bản chưa duyệt N; khi bản N+1 được trình, nháp bị che và bị giữ bằng mã này chứ không bằng `SUBJECT_CHANGED` (mã che thắng); nháp nêu bản chuẩn đúng là bản mới nhất thì vẫn giữ `SUBJECT_CHANGED` (ca `:1950`); từ chối vẫn làm được; ca ghim `tests/suggestions.test.ts:1963`», thêm điểm 11 vào «Chỗ khác bản 0.3» và thêm một cách hiểu **C11** vào bảng «Cách hiểu chờ Chairman xác nhận»; thêm C11 vào mục «Cần Chairman quyết hoặc xác nhận» (mục 2).

### F-3 [P2] Biên nhận không nêu việc câu trả lời của lệnh xác nhận (P13) nay tả trạng thái lúc kiểm, thuộc lớp «kiểm rồi bên khác commit» mà cổng Codex ở PR #22 không nhận làm phần dư

- Vị trí: `suggestions.ts` chú thích của `present` («the answer then describes the state the decision was based on») và `decide` (`known`); `review-service-security.md` SV-S-5 (đề nghị ghi vế (ii) của lập luận vào biên nhận); biên nhận mục «Phần dư» (không có dòng nào cho P13) và dòng 116 (chỉ nói «sau lệnh ghi chỉ còn ba câu»).
- Điều nên viết (#fact từ SV-S-5 và mã): trước P13 phần đuôi quét lại hai phép kiểm chữ bị ẩn **sau** lệnh ghi; nay dùng kết quả lúc kiểm, nên cửa sổ của **câu trả lời** rộng ra từ «sau lệnh ghi» thành «từ phép kiểm». Không lộ thêm vì (i) nháp bất biến (`ai_drafts_immutable`) nên nội dung là hàm của các tin đã commit trước nháp, tin có chữ ẩn đến sau phép kiểm cũng đến sau nháp; (ii) đường còn lại là nhãn IBS_HI đổi: trước lệnh ghi thì guard 022 từ chối (`LTZ01`), sau lệnh ghi thì ghi nhãn chờ khoá dòng dự án mà lệnh xác nhận giữ tới commit. Kế hoạch (L9) chỉ có vế (i).
- Sửa chữ: thêm một dòng «P13» vào «Phần dư» (cột «Vì sao không thuộc ba lớp»: hai vế (i) và (ii) trên, ca K4 và đột biến chết), và vào mục «Chỗ khác bản 0.3» để Codex không phải suy ra.

### F-4 [P3] «mọi ghế review tầng 1 `READY_FOR_GATE`» không nói rõ nó là của `26ba304`; 13 dòng `src` của `4df2db3` chưa ghế nào xem lại

- Vị trí: biên nhận dòng 13 và mục «Review» (:135); `git diff 26ba304..4df2db3 -- src`: `source-text.ts` (luật 2 viết lại thành một lần dò chỉ mục mỗi cặp, đúng câu ghế CSDL đề xuất), `skill-context.ts` (InitPlan), `skill-contracts.ts` (`.min(1)`).
- Đánh giá của tôi #fact: đọc cũ/mới cho cùng ngữ nghĩa kể cả trường hợp «tin không có bản nào» (cũ: lateral loại tin ⇒ không khớp ⇒ đổi; mới: `NULL` ⇒ `IS DISTINCT FROM` ⇒ đổi); `source-text` 41/41 và `skill-context` 23/23 xanh ở HEAD; đột biến s2 của 9a chết. Rủi ro thấp, nhưng migration có lượt xem lại (`93f3237`) còn lớp dịch vụ thì không.
- Sửa chữ: «mọi ghế review tầng 1 `READY_FOR_GATE` ở `26ba304`; đợt sửa 3 (`4df2db3`: 3 tệp `src`, 13 dòng, hai ca T20/T21 và ghim hành vi) chưa có ghế xem lại; chỉ ghế này và cổng Codex nhìn nó».

### F-5 [P3] Câu «xác nhận được lại khi nó nêu bản mới nhất của mọi tin của luồng có chữ hiện» (dòng 94; dòng 89 tương tự) mô tả sai điều kiện

- Mã và kế hoạch (mục 8): điều kiện đủ để qua là: mọi tin nó nêu đều có cặp (tin, số bản) và số là bản mới nhất; **và** không có bản nào được ghi vào luồng sau bản nó nêu muộn nhất (luật 3). Không cần nêu mọi tin (E9, T7′ hàng 8); nêu chỉ tin cũ của luồng đã có tin sau thì bị giữ (J4, T7′); luồng có bản ghi sau cùng thuộc tin không có chữ hiện bị giữ (L11).
- Sửa chữ (dòng 94): «Sau PR này nháp ứng viên xác nhận được lại khi mọi tin nó nêu đều kèm số bản và là bản mới nhất của tin đó, và sau tin nó nêu muộn nhất không có bản nào được ghi thêm vào luồng; nó không cần nêu mọi tin của luồng, nhưng nháp chỉ nêu tin cũ của một luồng đã có tin sau thì bị giữ.» Dòng 89 thêm vế «và không có bản nào được ghi vào luồng sau tin nó nêu muộn nhất».

### F-6 [P3] Câu «Reporter chỉ cho %, không cho covered/total» sai

- Vị trí: biên nhận dòng 111; `task-9-verification-summary.md` §Chỉ số coverage. Cả `task-9-pglite-coverage.txt:56-59` và `head-9b0f83f-coverage.txt:55-58` có khối tổng với covered/total.
- Sửa chữ: bỏ câu đó và ghi covered/total của khối tổng: câu lệnh 3 386/3 514 → 3 435/3 563; nhánh 2 204/2 404 → 2 257/2 456; hàm 761/776 → 763/778; dòng 2 536/2 598 → 2 575/2 637. Tệp `skill-contracts.ts` có dòng trong bảng (`...l-contracts.ts` 99,38·100·100·100); câu «không xuất hiện» của bản tóm tắt cũng sai.

### F-7 [P3] «10 trong 11 đột biến có log»: thực ra 9/11 theo log của builder; db1 do tôi chạy

- Vị trí: biên nhận dòng 114; `task-9-mutation-matrix.txt` (db1 gán nhầm `m-before`, là trigger của bảng quyết định, ca B1–B6). Ghế code đã nêu đúng điều này (SV-C-3).
- Phép đo của tôi #fact: db1 (trigger cấp số `AFTER` → `BEFORE INSERT`, hàm trả `NULL` nên huỷ bản chèn) trên bản `git archive HEAD` ngoài repo, PGlite: **19 ca đỏ** (A1–A7b, A9, A9b, B1–B9). db9 vẫn không thực hiện được, đúng như biên nhận nói.
- Sửa chữ: «9 trong 11 đột biến có log của builder (db1 và db9 không); db1 do ghế reality-check chạy trên bản sao: 19 ca đỏ; db9 không thể đỏ (trigger `AFTER` không chạy cho dòng `ON CONFLICT DO NOTHING` bỏ qua)».

### F-8 [P3] Bảng «Thay đổi hành vi ghi» thiếu W6, W7, W9, W10 và chi phí W3; vài mục kế hoạch Task 9 chưa được ghi

- Vị trí: biên nhận dòng 73-80 (bảng nhảy W5→W8; kế hoạch mục 6 có W1–W10). W7 (thứ tự khoá của giao dịch nhận tin: khoá ngoại → khoá tư vấn theo tin → **khoá dòng đếm của luồng**, cuối cùng) là thay đổi thật của đường nhận tin; W9 (trigger tắt ⇒ bản không số) có ở N4/N15 nhưng không ở bảng; W3 mất chi phí đo được trong kế hoạch (8 kết nối dồn vào một luồng: 2 306 → 1 220 giao dịch/giây, p99 4,6 → 21 ms).
- Còn thiếu theo kế hoạch Task 9: phiên bản PGlite cạnh native (`@electric-sql/pglite` 0.5.15 = PostgreSQL 18.6) — biên nhận chỉ ghi 16.15; `CREATE OR REPLACE TRIGGER` cần PostgreSQL ≥ 14 (bộ cài đòi 16: đủ), ghi dòng đó (SV-C-4, D3).
- Sửa chữ: thêm W6, W7, W9 (và W10 nếu muốn) vào bảng, hoặc đánh lại số và nói «W6, W7, W9, W10 xem kế hoạch mục 6»; thêm vào W3 chi phí đo của kế hoạch; thêm «PGlite 0.5.15 (PostgreSQL 18.6)» cạnh «PostgreSQL 16.15» ở bảng «Bằng chứng kiểm»; thêm «cần PostgreSQL ≥ 14» vào mục #4 của «Chỗ khác bản 0.3».

### F-9 [P3] Nhãn ca và số dòng trong bảng «Ca âm → test tự động» không tra được hoặc lệch

- (a) Hàng 1 liệt kê K3 cho «bản sửa đến giữa chừng» nhưng K3 là **tin mới** đến giữa phép kiểm và lệnh ghi; (b) hàng 4: «ca `:543`» nay ở `tests/suggestions.test.ts:551`; (c) «T4», «L1», «L2–L4», «RB-023» là nhãn của kế hoạch, không có trong tên ca (và `suggestions.test.ts` có `L1`–`L9` khác hẳn, `skill-context.test.ts` có `L4` khác hẳn).
- Sửa chữ: hàng 1 «J1 (i), (iii) (bản sửa đến sau nháp); N13 (bản sửa đang bay lúc xác nhận); K3 (tin mới đến giữa phép kiểm và lệnh ghi)»; hàng 4 `:551`; hàng R10-g trích **tiêu đề ca** (hoặc `skill-context.test.ts:358,394`, `suggestions.test.ts:1930,1941`, `skill-contracts.test.ts:329`) thay vì nhãn L.

### F-10 [P3] Hai việc kế hoạch giao cho «phiên chính» chưa làm và biên nhận không nêu «CHỜ»: dòng trạng thái OQ-53 và `docs/IMPLEMENTATION-ROADMAP.md`

- Kế hoạch Task 9 cuối: «cập nhật dòng trạng thái của OQ-53 (tại chỗ, không thêm dòng), `docs/ROADMAP`». `git diff --numstat` của `OPEN-QUESTIONS.md` là 37/0 (không sửa tại chỗ nào; brief cũng nhắc «hai dòng sửa tại chỗ»); `docs/IMPLEMENTATION-ROADMAP.md` không đổi và dòng 59 vẫn viết «Sau PR này **không nháp ứng viên nào xác nhận được**», sẽ mâu thuẫn với mã khi PR này merge.
- Sửa chữ: thêm vào mục «Sự cố và môi trường» hoặc «Điểm dừng» dòng «CHỜ: cập nhật tại chỗ dòng trạng thái OQ-53 và `docs/IMPLEMENTATION-ROADMAP.md` (dòng 59, 61) trước merge — phiên chính».

### F-11 [P3] Những chỗ chính xác hơn nên có

- Dòng 106: trích `head-9b0f83f-coverage.txt` và `head-9b0f83f-native-verbose.txt` thay vì cả thư mục (thư mục còn log cũ `final-*` mang 1 184/65 và 1 249).
- Dòng 116: «Trần mục tiêu của kế hoạch (dưới 500 ms, N11) là số đo trên dữ liệu giả» trộn hai thứ. Viết: «2,3–2,7 ms là số đo trên dữ liệu giả; trần 500 ms là mục tiêu của kế hoạch (N11), chưa đo trên dữ liệu thật».
- N2 (dòng 158): thêm «hạng `answered` của gateway đếm tới `SPOOL_MAX_ATTEMPTS = 5` và 24 giờ rồi chuyển vào dead-letter; một luồng bị chặn lâu (N1) có thể dẫn tới đó; `HOOK_TIMEOUT = 2` giây đứng trước trần 5 giây của khoá nên thường là hạng `network`, không đếm» (`bot-plugin/__init__.py:46-52,59,188-210`).
- Ba mục ghế code nêu, biên nhận không nêu: SV-C-7 (`SUBJECT_ORDER_SQLSTATE`, `SubjectCheck`, `subjectReasons` được `export` chỉ để kiểm; biên nhận mới nêu hai trong ba), SV-C-8 (`127.0.0.1:55471`, tên CSDL thử trong `measurements-pg16.txt`, `probe-*.cjs` 38 KB: giữ hay bỏ là quyết của Chairman), SV-DB-4 (`visibleThreadMessages` và `projectHasHiddenText` tốn ≈ 30 ms ở 60 000 tin, có trước PR, chạy trước lệnh ghi).
- Chú thích `023:63` ghi «about 11 microseconds a revision» rồi ngay sau đó ghi 6,65–10,16 s cho 500 000 bản (13–20 µs); chỉ là chú thích, không đổi hành vi.

## 3 · Điều tôi đã thử phản bác mà không phá được

1. **Khe commit ngược thứ tự.** Chạy xanh N7, N8, N12, N13, N14 trên PG 16.15 thật; ba đột biến đối chứng đỏ đúng chỗ (mục 1, hàng 17) và đột biến db1 làm 19 ca đỏ. Mỗi cơ chế (so theo số của dịch vụ, so-và-ghi dưới `FOR NO KEY UPDATE`, trigger `AFTER`) có ít nhất một ca chỉ nó mới làm đỏ: không có «cổng không thể đỏ».
2. **N12 có thật sự là «tin đang bay lúc xác nhận» không.** Không: ở N12 giao dịch của M_A mới `SELECT now()` rồi chờ cổng; lệnh chèn của nó chạy sau khi M_B đã commit và nháp đã ghi. Cái N12 chứng minh là `created_at` của M_A sớm hơn M_B (`a_earlier:true`) mà số theo luồng muộn hơn (`a_seq:2,b_seq:1`) và dịch vụ vẫn giữ nháp: tức mọi cơ chế theo `created_at` sẽ lọt. Phần «đang bay lúc xác nhận» do N7 và N13 đảm nhiệm (và đã được đột biến chứng minh). Biên nhận phân vai đúng («N12 … ; N1, N7, N8, N14 cho cơ chế»); tôi không coi đó là lỗi.
3. **Định danh luồng có thể đổi sau khi đã đánh số không.** `source_events` có trigger `BEFORE UPDATE OR DELETE` từ chối (`016_intake_inbox.sql:234-235`) và `grep` không thấy `UPDATE source_events` trong `src`: `(chat_id, thread_key)` bất biến, dòng đếm theo luồng không thể bị tách đôi.
4. **Ca cũ bị nới.** Trong `git diff` các tệp ca kiểm: bị xoá/thêm các dòng `expect|heldOnly|held|refused`: `suggestions` 35/92, `source-text` 29/90, `skill-context` 6/48, `z4-schema` 1/9, `z4-pointer-guard` 1/12, `migrations-rollback` 0/29. Đổi mặc định fixture của `z4-schema`/`z4-pointer-guard` sang nháp `document` đi kèm ca mới trên nháp ứng viên thật (P6, «guards of 021 still fire…»): làm chặt, không nới.
5. **Viết lại luật 2 có đổi nghĩa không.** Đọc cũ/mới từng dòng (xem F-4): cùng nghĩa kể cả «tin không có bản» và cặp lặp khác số; không `LIMIT` thiếu `ORDER BY` (`LATEST_REVISION_ORDER` toàn phần nhờ `UNIQUE(source_event_id, revision_no)`).
6. **Mã sản phẩm có caller thật không.** Không: `SuggestionService` chỉ xuất hiện trong `suggestions.ts`; 023 không tạo role, login, mật khẩu, quyền cho `libetech_ai`; ca canh giống từng byte.
7. **Lệch phạm vi.** `git diff` các đường dẫn cấm: 0; không tệp mới dưới `src/app/api`; PR #22 (`DELIVERY-015`, `oq-45-46-ai-drafts.md`, thư mục bằng chứng) không bị sửa; `slice-3-review-skills.md` và `DELIVERY-012` không bị sửa (đúng quyết định OQ-57).
8. **Số trong biên nhận tự mâu thuẫn.** Đối chiếu từng số với log (mục 1): 1 280/112, 1 392/0, 1 220/79, 1 299, coverage, 0,52 s, 3,3 s, 44 MB, 2,3–2,7 ms, 8,9 ms, 32–34 ms, 99,8 nghìn, 250 000, 6,65–10,16 s, `statement_timeout` 10 s (`db.ts:32`), `HOOK_TIMEOUT` 2 s: khớp, trừ các chỗ ở F-1, F-6, F-7.
9. **Bốn mức.** Không chỗ nào gọi mức cao hơn bằng chứng; mô tả «Đã có mã» đúng điều kiện (CHỜ Codex và ghế này).

## 4 · Ba khoảng trống lớn nhất và điều gì đổi được phán quyết

1. **F-1 trước lần push đầu tiên** (chuỗi chứa tên người dùng trong một commit của một repo sắp công khai). Bằng chứng đổi phán quyết: quét rộng sau sửa cho 0 trên cả cây và các dòng thêm, và `git log -p` của nhánh không còn chuỗi.
2. **F-2 và F-3**: hai hành vi/thay đổi mà các ghế đã bảo biên nhận phải nêu nhưng chưa nêu; cả hai thuộc đúng loại điều cổng Codex dò (lớp «kiểm rồi bên khác commit», lệch chữ lời Chairman). Biên nhận cần dòng C11 để Chairman xác nhận, nếu không câu trả lời «Chairman đã đồng ý 2 (a)» che mất một khác biệt.
3. **Điều chưa thể xác minh ở mức này và biên nhận đã nêu trung thực** (không đổi phán quyết; đổi mức): chưa có CI (mọi kiểm ở trạng thái `manual`); `messageRevisions` vẫn là lời khai của mô hình (N6, chặn Z4); chưa kiểm trên gateway chạy thật (N2); chưa đo trên dữ liệu thật (N3, N7, N11); `idle_in_transaction_session_timeout` chưa đặt ở đâu trong repo (N1); phục hồi dữ liệu của bộ cài chưa chỉnh (N4).

Phán quyết sẽ thành `NEEDS WORK` nếu cổng Codex có finding P0/P1 chưa xử lý hoặc nếu một lần chạy lại cho thấy bất cứ ca nào trong mục 1 hàng 4–5 đỏ ở HEAD sau khi đã sửa chữ. Sẽ thành `READY` khi F-1, F-2, F-3 đã sửa và quét F-1 báo 0. «Đã có mã» chỉ ghi sau cổng Codex.

## 5 · Việc tôi đã làm và để lại

- Không sửa tệp nào ngoài báo cáo này; không `git add/commit/push`. `git status` lúc xong: chỉ có tệp `codex-context-round-1.md` chưa theo dõi (không phải của tôi; đã quét sạch).
- CSDL riêng đã tạo (`slice1_verify_5311196`, và ba CSDL đột biến `…53111961/2/3`): **đã `DROP`** (kiểm: 0 còn lại). Các bản sao `git archive` của tôi đặt ngoài repo: đã xoá. Không đụng CSDL `slice1_*` khác. Các lần chạy vitest đều kiểm `pgrep -f '[v]itest' | wc -l` = 0 và `uptime` trước đó.
- Điều tôi không làm: không chạy cả bộ (đã có log), không chạy `npm run build`, không đụng gateway, không kiểm Telegram, không chạy lại mọi tệp native.
