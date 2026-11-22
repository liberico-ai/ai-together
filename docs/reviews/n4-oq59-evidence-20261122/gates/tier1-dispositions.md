# Cổng tầng 1 — từng finding và cách xử lý (N4 theo OQ-59 (b) (1), 22/11/2026)

Sáu ghế, ba đợt, mỗi ghế mới (không ghế nào được dùng lại): đợt 1 bảo mật + CSDL; đợt 2 bảo mật + CSDL (trên thiết kế «loại bản lưu»); đợt 3 `liberico-reality-checker` + `liberico-code-reviewer`. Không ghế nào chạy vitest; số đo là của người làm. Báo cáo gốc của các ghế không được lưu thành tệp (như N4: `docs/reviews/n4-evidence-20261120/gates/tier1-dispositions.md`); đây là bản ghi do người làm viết. Mọi ghế trả `READY` hoặc `NEEDS WORK`/`CHANGES_REQUIRED` **không có P0/P1**, trừ một P2 chung của đợt 2.

## Đợt 1 — trên bản đếm-và-báo đầu tiên

| Ghế | Finding | Xử lý |
|---|---|---|
| Bảo mật | **P2** đường tay cho bản lưu trước 023: trước đây `POST-RESTORE-05` chặn, nay `pass` kèm số đếm; một NOTICE «không bản nào có số» là đoán | **Áp, theo hướng khác sau cổng Codex:** NOTICE đoán bị bỏ; loại bản lưu được nêu cho tệp (xem Codex lần chạy 2) |
| Bảo mật | P3 bộ đọc của `install-d1.sh` là danh sách cấm (`kind=="pre-023"`); `kind` rỗng bị đọc như post-023 | **Áp:** danh sách cho phép; sau đó cả luật pre-023 chuyển vào tệp SQL |
| Bảo mật | P3 câu từ chối pre-023 của bộ cài cùng thông báo với «kiểm không đạt» | Hết nghĩa khi luật chuyển vào tệp (một mã `POST-RESTORE-05`) |
| Bảo mật | P3 ca khẳng định «không lộ chat/luồng» không thể đỏ (giá trị giả không có trong câu trả lời) | **Áp:** `STRAY` (giá trị thừa) trong câu trả lời giả; đợt 3 đổi sang giá trị trung tính |
| Bảo mật | P3 khối shell `|| { …; exit 1; }` dưới `set -e` chỉ ghim bằng regex | **Áp:** `run_shell_block` chạy bằng bash |
| Bảo mật | P3 `docs/plans/n4-restore-after-023.md` còn nói `POST-RESTORE-05` là lỗi | **Áp:** ghi chú có ngày nối cuối kế hoạch |
| Bảo mật | P3 đối số argv của câu trả lời bị trần 131 072 byte (≈ 2 600 dự án) | **Chấp nhận:** thất bại an toàn, không thực tế |
| CSDL | P3 `count(DISTINCT (chat_id, thread_key))` đếm một «luồng ma» cho bản mồ côi (LEFT JOIN) | **Chấp nhận, không sửa:** chỉ ở bản lưu hỏng; phép 09 dừng ngay sau; không ca rẻ để ghim |
| CSDL | P3 `held_threads` là cận trên (đếm cả luồng chưa có ứng viên) | **Áp:** ghi ở runbook; đợt 3 sửa lời của bộ cài |
| CSDL | P3 ca P4b chưa bắt được `count(DISTINCT thread_key)` | **Áp:** cùng khoá luồng ở chat thứ hai |
| CSDL | P3 câu «chỉ in các mã» ở runbook cũ | **Áp** |
| CSDL | Chi phí ở trần 250 000 bản chưa số: ≈ 0,7 s so với ≈ 0,2 s của `count(*)` cũ | Không đáng kể (đo bởi ghế, PostgreSQL 16.15) |

## Đợt 2 — trên thiết kế «loại bản lưu bắt buộc»

| Ghế | Finding | Xử lý |
|---|---|---|
| CSDL | **P2** một mặc định của CSDL/role (`ALTER … SET libetech.archive_kind`) làm thoả «bắt buộc» mà không ai nêu loại | **Áp:** tệp đọc `pg_db_role_setting` và từ chối (P4h); đợt 3 của Codex hẹp lại cho đúng mặc định áp vào phiên (P4j) |
| Bảo mật | **P2** cùng điều trên | như trên |
| CSDL | P3 lệnh `-c … -f -` không có ca với psql thật; P4e không chứng minh thứ tự «hỏi loại trước khi sửa» (khối nguyên tử) | **Áp:** `R8b` chạy psql thật và khẳng định không có NOTICE «put back to A» trước từ chối; hình lệnh của bộ cài chạy trong ca diễn tập |
| Bảo mật | P3 hai bộ cài không đòi câu trả lời nói lại đúng loại | **Áp:** `archive_kind` được nói lại và so |
| Bảo mật | P3 khối `[[ "$kind" == … ]]` chỉ ghim bằng regex | **Áp:** chạy với từ xấu dưới `set -euo pipefail` |
| CSDL | P3 header «never with -c»; hàng 01 chưa nói cách nêu loại; §8 chưa nói loại | **Áp** |
| CSDL | P3 lệnh từ chối ở 05 vẫn lấy khoá của bước sửa và in NOTICE «put back to A» | **Chấp nhận:** vô hại (NOTICE nói «giữ chỉ khi mọi phép kiểm sau đạt»); chuyển phép đếm lên trước bước sửa là tuỳ chọn |
| Bảo mật | P3 `docs/OPEN-QUESTIONS.md:1082` còn nói `post-restore.sql:91` dừng | **Không sửa** (sổ của phiên điều phối; ghi ở biên nhận) |

## Đợt 3 — trên bản đếm theo dự án

| Ghế | Finding | Xử lý |
|---|---|---|
| Code review | **P2** «không con số nào cộng các dự án» sai trong cùng câu trả lời: `revisions`, `threads`, `foreign_keys` (từ N4) là tổng của cả CSDL và đi vào biên nhận | **Áp:** thu hẹp lời thành «không có tổng của các bản không số qua các dự án» ở SQL, runbook, biên nhận, test; ghi các số cũ là số hàng của cả CSDL; **nêu thành câu hỏi cho Chairman** ở biên nhận (có coi biên nhận phục hồi là «báo cáo» của `AGENTS.md` không) |
| Code review | P3 chú thích còn nêu khoá `held_threads` đã bỏ; chú thích của biến `unnumbered` sai chỗ | **Áp** |
| Reality check | **P2** runbook trích văn bản phương án (b) (1) như «lời Chairman»; lời của Chairman chỉ là «(b) (1)» | **Áp:** sửa ở đầu tệp và mục 7 |
| Reality check | **P2** đầu runbook nói «đã thử phục hồi trên CSDL thử» cạnh lời mới mà thư mục bằng chứng chưa có log xanh | **Áp:** thư mục bằng chứng có log xanh của cây cuối; đầu runbook trỏ tới đó |
| Cả hai | P3 `project_no` chỉ xếp hạng các dự án **còn** bản không số, nên đổi theo lần chạy | **Áp:** ghi ở SQL, runbook bước 7 và mục 7 («đối chiếu trong cùng một lần chạy») |
| Reality check | P3 «bắt buộc (fail-closed)» ở biên nhận không nói `PGOPTIONS`; bộ phân loại (`restore-plan.py`, không đổi) gọi một bản lưu sau 023 mà hai bảng số rỗng một cách tự nhiên là `pre-023` | **Áp:** ghi ở «Còn mở» của biên nhận; không sửa `restore-plan.py` (ngoài phạm vi) |
| Reality check | P3 P4b chặn tổng bằng hai tên khoá cấm; `toMatchObject` cho khoá thừa | **Áp:** `P4i` khẳng định đúng tập khoá của câu trả lời |
| Reality check | P3 giá trị giả có dạng nhóm Telegram (`-100…`) ở `tests/test_install_user.py` | **Áp:** giá trị trung tính; các commit trung gian chứa dạng ấy được **gộp** trước khi push |
| Code review | P3 `P4h`/`P4j` đặt mặc định trên CSDL dùng chung và gỡ ở `afterEach`; tiến trình chết giữa chừng làm mọi ca sau đỏ | **Áp:** mỗi ca bắt đầu bằng việc gỡ mặc định còn sót |
| Code review | P3 `P4e` không phân biệt thứ tự trong PGlite | **Áp:** `P12c` kiểm thứ tự trong văn bản tệp (chạy ở CI mặc định); `R8b` kiểm hành vi với psql thật |
| Code review | P3 `u11` in số đếm ra đầu ra của bộ chạy test; hai từ loại bản lưu ở năm nơi không có ca nối | **Áp:** bọc `redirect_stdout`; ca nối năm nơi |
| Code review | P3 hai khoá mặc định không nhất quán (`session_replication_role`: mọi role; `archive_kind`: role của phiên) | **Chấp nhận:** đã ghi ở hàng 01 của runbook; phép cũ của N4 giữ nguyên |
| Code review | P3 bước 7 của runbook là một đoạn dài; `<loại>` định nghĩa ở cuối | **Áp:** đưa lên đầu bước |
| Code review | **Sự cố của ghế:** ghi tên CSDL thử vào tệp dùng chung trong thư mục nháp; ghế kia ghi đè; vài lệnh của ghế chạy vào CSDL của ghế kia (có một lần chạy `post-023` đã sửa trigger ở đó) | Ghế tự báo. Không chạm repo hay CSDL dùng chung; CSDL của ghế kia đã bị xoá và kết quả của nó tự nhất quán. Bài học ghi vào bộ nhớ (cho mọi lần giao hai ghế dùng cùng container: thêm thư mục riêng, không giữ tên trong tệp dùng chung) |
