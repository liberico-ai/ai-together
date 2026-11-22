## Việc (không phải lát 1–5)

N4 theo câu trả lời OQ-59 (b) (1) của Chairman ngày 22/11/2026. Lời Chairman, chép nguyên: «OQ-59: (a) (1) tới khi bật Z4, (2) trước khi bật Z4; (b) (1); (c) (1).» Phương án (b) (1) ở `docs/OPEN-QUESTIONS.md` mục `## OQ-59`: «phục hồi nguyên trạng: dịch vụ chạy, luồng vẫn bị giữ như ở nguồn, và gỡ theo câu (a)». Trước thay đổi này mã N4 làm phương án (2): `deploy/post-restore.sql` dừng ở `POST-RESTORE-05` khi có bản (revision) không có số thứ tự luồng, và cả hai bộ cài (`deploy/install-user.py`, `deploy/install-d1.sh`) dừng trước khi bật dịch vụ.

Đầu vào của cổng này là **diff của mã** (`deploy/`, `tests/`) so với `origin/libetech-ai-os` (`35b79e6`); đọc `docs/RUNBOOK-RESTORE-AFTER-023.md` (bản 0.3, mục 3 bước 7, bảng mã mục 4, mục 7), `docs/DELIVERY-021-n4-oq59-b1-held-threads-20261122.md` và `docs/DELIVERY-017-n4-restore-after-023-20261120.md` từ cây làm việc. Migration 022 và 023 không đổi (ngoài phạm vi).

## Đã đổi

- `deploy/post-restore.sql`, bước 05: đếm bản không số (tổng, số luồng, từng dự án với số thứ tự theo mã dự án) vào dòng trả lời (`unnumbered_revisions`, `held_threads`, `held_by_project`; `null` khi chưa có 023) và một `NOTICE` **không mã**; không còn `RAISE EXCEPTION`. Mọi phép kiểm khác (01–04, 06–10) không đổi và vẫn dừng.
- `deploy/install-user.py` (`check_held_threads`), `deploy/install-d1.sh` (bộ đọc dòng trả lời trong chính script): đọc số đếm; dòng trả lời thiếu số đếm hoặc mang số không phải số nguyên không âm (kể cả `true`) **không phải pass**; in **một dòng** chỉ có số đếm; đi tiếp và bật dịch vụ.
- **Thêm có chủ ý, ngoài lời Chairman:** bản lưu phân loại `pre-023` mà sau khi áp lại 023 vẫn còn bản không số thì bộ cài **dừng** (023 đánh số mọi bản; còn sót là lần đánh số hỏng, không phải luồng mà nguồn giữ). Lý do: trước đây phép kiểm của SQL bắt trường hợp «quên bước 6»; SQL không biết loại bản lưu, bộ cài thì biết.
- Tests: P4 đảo, P4b–P4d mới, P2/P12/P14 và R8/R10 chỉnh; U11/U12 mới ở `tests/test_install_user.py`.

## Điều đã đo (PostgreSQL 16.15 và PGlite; #fact)

1. Đỏ trước khi sửa mã, đếm bằng dòng `AssertionError`: Python 15 khẳng định + 26 lỗi «chưa có bộ đọc trong script» (`ValueError: substring not found`, không phải khẳng định); `tests/post-restore.test.ts` trên PGlite 7; `post-restore` + `restore-rehearsal` trên PostgreSQL 16.15 9; hết giờ 0 ở cả ba. Log: `docs/reviews/n4-oq59-evidence-20261122/logs/red-*`.
2. Đột biến của hai bộ cài: chín đột biến (bỏ cổng pre-023, nhận `true` làm số, nhận số âm, không in dòng, không gọi `check_held_threads`, bỏ kiểm số đếm ở shell, không `echo "$report"`…); đột biến cuối (không `echo "$report"`) lúc đầu **sống**, đã thêm ca ghim, nay bị bắt.

## Cổng tầng 1 đã qua (hai ghế mới, cùng `READY`, không P0/P1)

Ghế bảo mật: một P2 (đường tay cho bản lưu trước 023: thêm một NOTICE khi **không bản nào** có số, và bỏ chữ «như ở nguồn» khỏi NOTICE) và P3 (bộ đọc của `install-d1.sh` chỉ cho hai loại bản lưu đã biết; câu riêng cho lần từ chối pre-023; câu khẳng định không lộ chat/luồng phải có thể đỏ; chạy khối shell bằng bash dưới `set -euo pipefail`; ghi chú cũ ở kế hoạch N4). Ghế CSDL: SQL đúng (đã chạy thật ở PostgreSQL 16.15), định danh luồng khớp guard của 023 và luật 4; chi phí ở trần 250 000 bản chưa số ≈ 0,7 s so với 0,2 s của `count(*)` cũ (không đáng kể); P3: `count(DISTINCT (chat_id, thread_key))` đếm một «luồng ma» cho bản mồ côi (chỉ ở bản lưu hỏng, phép 09 dừng ngay sau đó — chấp nhận, không sửa), `held_threads` là cận trên (đếm cả luồng chưa có ứng viên — đã ghi ở runbook), ca P4b chưa bắt được `count(DISTINCT thread_key)` (đã thêm cùng khoá luồng ở chat thứ hai), câu «chỉ in các mã» ở runbook cũ (đã sửa). Đã sửa hết trừ «luồng ma». Hai ghế **không** chạy vitest; số đo ở mục dưới là của người làm.

## Quyết định cố ý (nói nếu bạn thấy sai)

- Báo cáo là `NOTICE` **không mã** `POST-RESTORE-nn`: `install-user.py` in mọi mã `POST-RESTORE-nn` thấy trong stderr khi một phép kiểm SAU lỗi, nên một mã cho trạng thái không dừng sẽ làm thông báo lỗi sai. Mã 05 chỉ còn là tên của phép kiểm trong chú thích và bảng của runbook.
- Đường **thủ công** cho bản lưu trước 023 (người vận hành bỏ bước 6) từng bị `POST-RESTORE-05` chặn; nay SQL báo số đếm và đạt, bộ cài chặn thay. Runbook bước 7 nói số ấy phải là `0` sau bước 6. Nếu bạn thấy cần đóng cả đường tay, nói rõ cách đóng không dựa vào đoán loại bản lưu trong SQL.
- Không sửa `docs/OPEN-QUESTIONS.md`: hai dòng của nó («Hành vi hiện tại … (b) dừng», điểm 4 của khối 22/11) cũ đi khi PR này merge; việc ghi chú đó là của phiên điều phối (ghi ở biên nhận).
- `deploy/install-user.py:22` (`exec(compile(...))` của `load_restore_plan`, kiểm băm với manifest) có từ N4, không thuộc thay đổi này.

## Đã đóng, không ghi phần dư (các lớp mà cổng ở PR trước đã không nhận phần dư)

- **Lộ dữ liệu qua đầu ra/log:** dòng trả lời, `NOTICE`, dòng bộ cài in và biên nhận chỉ mang số đếm và số thứ tự; test khẳng định đầu ra không chứa chat, luồng, tenant, dự án, và không có dạng UUID.
- **Fail-open:** dòng trả lời thiếu hay sai kiểu số đếm không phải pass ở cả hai bộ cài; `type(v) is int` loại `true`.
- **Kiểm-rồi-dùng / quyền cao:** không có đường mới nào cho dữ liệu đã nạp vào shell, `eval`, tên tệp hay câu SQL; bộ đọc là một phần của script đã duyệt, chạy `python3 -I`, nhận `$kind` và dòng trả lời qua argv.

## Biên nhận chưa điền xong (đừng báo chỗ trống)

`docs/DELIVERY-021-n4-oq59-b1-held-threads-20261122.md` còn các ô «⟨điền …⟩» (số đo của bộ test đầy đủ, cổng, phần dư): chúng được điền sau lượt đo cuối trên cây đã sửa xong, vì kết quả của cổng này có thể đổi mã. Hãy soi **mức** mà bản nháp đã gọi (bảng «Bốn mức») và các chỗ nó nói về hành vi, không phải các ô trống.

## Hãy soi kỹ

Đúng/sai của câu truy vấn đếm mới (`dense_rank` trên kết quả `GROUP BY`, `count(DISTINCT (chat_id, thread_key))` với `LEFT JOIN`, `json_agg … ORDER BY`, kiểu `bigint`/`json`, `search_path` bị ghim); `held_threads` có đúng là «luồng bị giữ» theo luật 4 của dịch vụ và guard của 023 không; hai bộ cài có chỗ nào đi tiếp khi lẽ ra phải dừng; ca test có THỰC SỰ kiểm điều chúng tuyên bố; biên nhận có gọi mức «đã triển khai/đã dùng thật/đã nghiệm thu» khi bằng chứng chỉ tới «đã có mã» hay không.
