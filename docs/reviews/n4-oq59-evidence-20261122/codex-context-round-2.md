## Việc (không phải lát 1–5)

N4 theo câu trả lời OQ-59 (b) (1) của Chairman ngày 22/11/2026. Lời Chairman, chép nguyên: «OQ-59: (a) (1) tới khi bật Z4, (2) trước khi bật Z4; (b) (1); (c) (1).» Phương án (b) (1) ở `docs/OPEN-QUESTIONS.md` mục `## OQ-59`: «phục hồi nguyên trạng: dịch vụ chạy, luồng vẫn bị giữ như ở nguồn, và gỡ theo câu (a)». Trước thay đổi này mã N4 làm phương án (2): `deploy/post-restore.sql` dừng ở `POST-RESTORE-05` khi có bản (revision) không có số thứ tự luồng, và cả hai bộ cài (`deploy/install-user.py`, `deploy/install-d1.sh`) dừng trước khi bật dịch vụ. Migration 022 và 023 không đổi (ngoài phạm vi).

Đầu vào của cổng này là **diff của mã** (`deploy/`, `tests/`) so với `origin/libetech-ai-os` (`35b79e6`); đọc `docs/RUNBOOK-RESTORE-AFTER-023.md` (bản 0.3), `docs/DELIVERY-021-n4-oq59-b1-held-threads-20261122.md` và `docs/DELIVERY-017-n4-restore-after-023-20261120.md` từ cây làm việc.

## Lần chạy trước của cổng này, và điều đã đổi vì nó

Lần chạy thứ nhất bị **vô hiệu** (cây làm việc đang bị chính người làm đột biến đồng thời: dòng `RAISE EXCEPTION POST-RESTORE-05` mà nó báo là của một đột biến, đã xác nhận bằng `git show HEAD:…`). Lần chạy thứ hai, hợp lệ, `CHANGES_REQUIRED` với một P1 và một P2 cùng một ý: với bản lưu **trước 023** (không có số nào cho tới khi 023 được áp lại), người chạy `post-restore.sql` bằng tay mà bỏ bước áp lại 023 từng bị `POST-RESTORE-05` chặn và nay thấy `pass`; một `NOTICE` «không bản nào có số» là **đoán** loại bản lưu từ dữ liệu (một nguồn có 023 mà trigger tắt từ đầu cũng như vậy). Cách đóng của Codex: truyền loại bản lưu đã phân loại vào phép kiểm, bắt buộc số đếm 0 với `pre-023`. Đã làm đúng thế:

- `deploy/post-restore.sql` **đòi** loại bản lưu: `SET libetech.archive_kind = 'post-023' | 'pre-023'` (từ mà `deploy/restore-plan.py` in ở bước 3); thiếu hay từ khác ⇒ `POST-RESTORE-01` trước khi đọc hay sửa gì; một **mặc định** của CSDL/role cho khoá ấy cũng bị từ chối (đọc `pg_db_role_setting`, như tệp đã làm với `session_replication_role`). Với `pre-023` bản không số **dừng ở 05**; với `post-023` chỉ đếm (lời Chairman). Câu trả lời nói lại loại (`archive_kind`). `NOTICE` đoán loại đã bỏ.
- Hai bộ cài chuyển từ của kế hoạch sang tệp bằng `-c "SET …" -f -` (cùng phiên), từ chối mọi từ khác hai từ đã biết trước khi lên dòng lệnh, đòi câu trả lời nói lại đúng từ đã đưa, và **không** tự xét loại (một luật, một nơi).

## Cổng tầng 1 trên bản này (hai ghế mới)

Cả hai `READY`/`NEEDS WORK` chỉ vì một P2 chung (mặc định của khoá, đã đóng) và các P3 (ghim bằng ca chạy thật: `R8b` cho thấy với psql thật tệp từ chối thiếu loại **trước** khi sửa; hình lệnh `-c … -f -` của bộ cài chạy trong ca diễn tập; khối shell của loại được chạy với từ xấu; câu trả lời phải nói lại loại; runbook hàng 01, §8). Hai ghế không chạy vitest.

## Điều đã đo (PostgreSQL 16.15 và PGlite; #fact)

Đột biến: sáu đột biến của tệp SQL (bỏ đòi loại, bỏ từ chối `pre-023`, bỏ kiểm mặc định, từ chối cả `post-023`, bỏ `archive_kind` khỏi câu trả lời, hỏi loại **sau** bước sửa) và bảy của hai bộ cài đều bị ca bắt, bằng khẳng định, 0 lần hết giờ.

## Chấp nhận có ghi (nói nếu bạn thấy cách ghi chưa đúng, hoặc có cách đóng rẻ hơn)

- Người chạy **tay** gõ nhầm `post-023` cho bản lưu trước 023 vượt cổng ấy: tệp không có nơi nào đọc được loại thật của bản lưu (nó không đoán từ dữ liệu). Hai bộ cài lấy từ của kế hoạch, người chạy tay lấy từ bước 3 của runbook, không gõ theo trí nhớ. Nếu bạn thấy cách đóng mà **không** đoán và không đổi `restore-plan.py`, nêu rõ.
- `PGOPTIONS` (là người gọi nói) và `postgresql.conf` không được tệp đọc (ghi ở chú thích và runbook).
- Hai dòng của `docs/OPEN-QUESTIONS.md` («Hành vi hiện tại … (b) dừng», điểm 4 của khối 22/11) cũ đi khi PR này merge; ghi chú đó là của phiên điều phối (ghi ở biên nhận). `deploy/install-user.py:22` (`exec(compile(...))`, kiểm băm với manifest) có từ N4, không thuộc thay đổi này.
- `docs/DELIVERY-021-…` còn các ô «⟨điền …⟩» (số đo bộ test đầy đủ, cổng, phần dư): được điền sau lượt đo cuối. Hãy soi **mức** mà bản nháp đã gọi (bảng «Bốn mức») và các chỗ nó nói về hành vi, không phải các ô trống.

## Hãy soi kỹ

Có đường nào hai bộ cài đi tiếp khi lẽ ra phải dừng (`pre-023` mà còn bản không số; câu trả lời không nói lại loại; loại ngoài hai từ); từ đưa lên dòng lệnh shell, `psql -c` và `current_setting`; `held_threads` / câu truy vấn đếm; có chỗ nào mã in chat/luồng/id; ca test có THỰC SỰ kiểm điều chúng tuyên bố; biên nhận có gọi mức «đã triển khai/đã dùng thật/đã nghiệm thu» khi bằng chứng chỉ tới «đã có mã» hay không.
