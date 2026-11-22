## Việc (không phải lát 1–5)

N4 theo câu trả lời OQ-59 (b) (1) của Chairman ngày 22/11/2026. Lời Chairman, chép nguyên: «OQ-59: (a) (1) tới khi bật Z4, (2) trước khi bật Z4; (b) (1); (c) (1).» (Phương án (b) (1) ở `docs/OPEN-QUESTIONS.md` mục `## OQ-59`: «phục hồi nguyên trạng: dịch vụ chạy, luồng vẫn bị giữ như ở nguồn, và gỡ theo câu (a)»; văn bản phương án là của phiên PR, lời Chairman chỉ là «(b) (1)».) Trước thay đổi này `deploy/post-restore.sql` dừng ở `POST-RESTORE-05` khi có bản không số và hai bộ cài dừng trước khi bật dịch vụ. Migration 022/023 không đổi (ngoài phạm vi). Đầu vào là **diff của mã** (`deploy/`, `tests/`) so với `35b79e6`; đọc `docs/RUNBOOK-RESTORE-AFTER-023.md` (0.3), `docs/DELIVERY-021-n4-oq59-b1-held-threads-20261122.md`, `docs/reviews/n4-oq59-evidence-20261122/` từ cây làm việc. Đây là **lần chạy hợp lệ thứ ba** của cổng này (lần 1 vô hiệu vì người làm đột biến cây đang bị đọc; lần 2 và 3 `CHANGES_REQUIRED`); cây làm việc **không bị đụng** trong lúc bạn chạy.

## Hai lần chạy hợp lệ trước đã nêu gì, và đã đổi gì

- Lần 2: với bản lưu **trước 023**, người chạy `post-restore.sql` bằng tay mà bỏ bước áp lại 023 vẫn thấy `pass`; một NOTICE «không bản nào có số» đoán loại bản lưu. → **Loại bản lưu bắt buộc**: `SET libetech.archive_kind = 'post-023' | 'pre-023'` (từ của `restore-plan.py`), thiếu hay từ khác ⇒ `POST-RESTORE-01` trước khi đọc hay sửa gì; `pre-023` mà còn bản không số ⇒ dừng ở 05 (không số đếm); `post-023` ⇒ chỉ đếm (lời Chairman). Hai bộ cài chuyển từ của kế hoạch sang tệp, từ chối mọi từ khác hai từ đã biết trước khi lên dòng lệnh, đòi câu trả lời nói lại đúng loại, và không tự xét loại.
- Lần 3: (P1) câu trả lời **cộng các dự án** (`unnumbered_revisions`, `held_threads`) trái `AGENTS.md:16` (báo cáo không gộp qua các miền); (P2) câu của bộ cài nói mọi luồng được đếm «bị giữ» dù đếm cả luồng chưa có ứng viên; (P2) kiểm mặc định của khoá loại quét mọi role. → câu trả lời chỉ còn **từng dự án** `held_by_project: [{project_no, revisions, threads}]` (không tổng của các bản không số, không trong NOTICE, không trong lời từ chối, không trong dòng của bộ cài, một dòng cho mỗi dự án); câu của bộ cài nói điều được giữ («không xác nhận nháp của ứng viên nào đi qua»), không nói mọi luồng được đếm đều bị giữ; kiểm mặc định chỉ tính mặc định **áp vào phiên** (CSDL hay không, role đã kết nối hay không).

## Cổng tầng 1 trên bản này (hai ghế mới, không P0/P1)

Một ghế kiểm AGENTS.md từng luật, lời hứa và biên nhận; một ghế review mã kiểu Quality Gate. Đã áp: lời «không có số nào cộng các dự án» thu hẹp thành «không có **tổng của các bản không số** qua các dự án» (các số `revisions`, `threads`, `foreign_keys` của dòng trả lời có từ N4 là số hàng của cả CSDL: **xem câu hỏi bên dưới**); `project_no` chỉ xếp hạng dự án còn bản không số (đã ghi); runbook không còn trích văn bản phương án như «lời Chairman»; P4i ghim đúng tập khoá của câu trả lời; P12c ghim thứ tự «loại trước bước sửa» ở CI mặc định; ca nối hai từ loại ở năm nơi; giá trị giả trung tính. Chi tiết: `gates/tier1-dispositions.md`.

## Điều đã đo (PostgreSQL 16.15 và PGlite; #fact)

Cây cuối: typecheck đạt, build đạt, 84 ca Python, bộ test đầy đủ native 85 tệp / 1 494 ca đạt, PGlite 71 tệp đạt + 14 bỏ qua / 1 343 ca đạt + 151 bỏ qua; `post-restore` + `restore-rehearsal` native 52 ca đạt. Đột biến: 23/23 bị bắt (K1–K6, I1–I7, T1–T8, N1–N2), hết giờ 0. Đỏ trước mã cho mỗi đợt (`logs/red-*`).

## Chấp nhận có ghi, và một câu hỏi cho bạn

- **Câu hỏi:** câu trả lời của `post-restore.sql` mang từ N4 (đã qua cổng của N4) các số `revisions`, `threads`, `foreign_keys` — số hàng của **cả** CSDL; `install-user.py` ghi cả câu trả lời vào `runtime-receipt.json`. PR này **không** thêm tổng nào và thu hẹp lời hứa cho đúng. Nếu bạn coi biên nhận phục hồi là «báo cáo» theo `AGENTS.md` thì hãy nói rõ lý do, và là P1 của PR này hay là việc riêng cần lời Chairman (biên nhận đã nêu nó là câu hỏi số 5 ở «Còn mở»).
- Người chạy **tay** gõ nhầm `post-023` cho bản lưu trước 023 vượt cổng ở 05; tệp không có nơi nào đọc được loại thật và không đoán từ dữ liệu. `PGOPTIONS` và `postgresql.conf` không được đọc. Bộ phân loại `restore-plan.py` (không đổi) gọi bản lưu sau 023 có hai bảng số rỗng tự nhiên là `pre-023`. Nếu bạn thấy cách đóng mà không đoán và không đổi `restore-plan.py`, nêu rõ.
- Hai dòng của `docs/OPEN-QUESTIONS.md` cũ đi khi PR merge (sổ của phiên điều phối; chữ đề xuất ở biên nhận). `deploy/install-user.py:22` (`exec(compile(...))`, kiểm băm với manifest) có từ N4.
- `docs/DELIVERY-021-…` còn **hai ô** «⟨điền …⟩»: mức «đã có mã» và kết luận của lần chạy này. Chúng được điền sau lần chạy này. Hãy soi các **mức** đã gọi và các chỗ nói về hành vi, không phải hai ô trống.

## Hãy soi kỹ

`AGENTS.md` từng luật so với diff (tách miền báo cáo, danh tính, «tự báo cáo sức khoẻ không phải bằng chứng», không id/chat/luồng trong đầu ra, IBS HI); có đường nào hai bộ cài đi tiếp khi lẽ ra phải dừng (loại sai, câu trả lời không nói lại loại, `held_by_project` sai kiểu, `pre-023` còn bản không số); từ đưa lên dòng lệnh shell, `psql -c` và `current_setting`; mặc định chỉ tính khi áp vào phiên; có câu nào trong runbook, SQL, dòng của bộ cài hay biên nhận nói nhiều hơn điều mã và test chứng minh (bốn mức: đã có mã / đã triển khai / đã dùng thật / đã nghiệm thu); ca test có THỰC SỰ kiểm điều chúng tuyên bố.
