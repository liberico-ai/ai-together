# Xem lại bảo mật — Task F5 (`05a6da0`), vòng sửa 1 của cổng

Phạm vi: chỉ diff `0ec1e1b..05a6da0` (11 tệp) cùng các đoạn của bản kế hoạch 0.8 mà diff đó dựa vào. Chỉ đọc: không chạy vitest, không Docker, không cơ sở dữ liệu. Z4 vẫn tắt; lần xem này không bật gì.

Chỉ dẫn lời Chairman nguyên văn: «OQ-45: 1b, 2b, 3b. OQ-46: b, mốc là bản mới nhất nháp nêu» và «B: chặn tạm (Recommended)». Chữ «(Recommended)» là nhãn của phiên điều phối, không phải lý do của Chairman.

## Tóm tắt

| Mức | Số |
|---|---|
| P0 | 0 |
| P1 | 0 |
| P2 | 1 |
| P3 | 1 |

## Trả lời câu A–E

### A. Lớp CX1 trên trigger mới, theo từng bên gọi

#fact — Trigger mới `draft_decisions_pointer_only_guard` là BEFORE INSERT trên `public.draft_decisions` (`migrations/022_ai_drafts_pointer_only_guard.sql`, khối function và `CREATE TRIGGER` mới của F5). Trigger BEFORE chạy theo thứ tự tên, nên `draft_decisions_guard` của 021 chạy trước. Trigger đó là SECURITY INVOKER: nó đọc nháp dưới RLS của chính bên gọi và đòi `t.tenant_id = NEW.tenant_id AND t.project_id = NEW.project_id` (`migrations/021_ai_suggestions_z4.sql`, hàm `draft_decisions_guard`). Ca P3 ghim điều này (`tests/z4-pointer-guard.test.ts`, ca «P3 a decision about a draft outside the caller's scope is answered by draft_decisions_guard, whatever the label of the project»). Ca P2 ghim việc cặp (tenant, project) không có nháp bị 021 trả lời trước.

Hệ quả #inference, theo từng bên gọi:

- **Người dùng qua `decide`**: dịch vụ kiểm quyền trước khi chèn. Dự án hay tenant khác nhận 404 trước mọi lệnh chèn, nên trigger mới không bao giờ thấy dòng ngoài phạm vi.
- **Role runtime (và `libetech_web`, thành viên của nó) chèn thô**: dòng chỉ tới được trigger definer khi (tenant, project) nằm trong phạm vi `app.*` mà role tự đặt. Dòng ngoài phạm vi nhận cùng một thông báo P0001 không phụ thuộc dự án. Role runtime vốn đã đọc được `project_domain_mappings` trong cùng phạm vi đó, nên mã LTZ01 không mở ra oracle nhãn mới.
- **Role AI**: không có INSERT trên `draft_decisions`. Không có đường gọi.
- **Login vận hành**: là superuser, không bị ràng buộc. Trigger không thêm quyền cho login này.

Kết luận A: không có rò lớp CX1 mới.

### B. Function SECURITY DEFINER thứ ba (thứ tư của 022) và R34

#fact — Function được ghim giống hai function kia: `SECURITY DEFINER`, `search_path = pg_catalog, pg_temp`, `row_security = off`, `lock_timeout = '5s'`, `REVOKE ALL ... FROM PUBLIC`. G12 và G20 ghim `prosecdef` và `proconfig` của nó (`tests/z4-pointer-guard.test.ts`, các dòng `draft_decisions_pointer_only_guard:{prosecdef:true,proconfig:[...]}`). Không có GRANT mới. Rollback xoá cả trigger lẫn function (`migrations/rollback/022_ai_drafts_pointer_only_guard.sql`).

Có một quyền mới đáng ghi vào R34; xem phát hiện **S-F5-1**.

### C. Nhánh catch của `decide` và thông báo của nó

#fact — `src/server/suggestions.ts`, khối catch quanh lệnh chèn quyết định. Chỉ khi `input.result === 'confirmed'` và mã là LTZ01 thì lỗi mới đổi thành `DRAFT_HELD` (422), với thông báo chỉ mang mã `POINTER_ONLY_PROJECT`. Mọi lỗi khác được ném lại nguyên trạng. Lệnh chèn này chạy sau các bước kiểm quyền, trạng thái đã quyết, hash giá trị và các lý do giữ.

#inference — Có đường nào trả nội dung sau khi dự án đã thành pointer-only không?

- **Xác nhận**: khóa dòng dự án được giữ từ lệnh chèn quyết định tới commit.
  - Ánh xạ commit trước lệnh chèn: trigger trả LTZ01, rồi `decide` đổi thành lý do giữ, không trả nội dung (ca X1; ca concurrency «held as POINTER_ONLY_PROJECT»).
  - Ánh xạ ghi sau lệnh chèn: phải chờ commit của xác nhận (ca P5).
  - Nhờ vậy `present`, chạy sau lệnh chèn, không còn thấy bối cảnh cũ. Mục F2 của `sweep-races.md` đã đóng cho xác nhận.
- **Từ chối và phát lại**: dựng bối cảnh mới, không dùng lại bối cảnh cũ.
- **Còn lại**: các lần đọc lệch thời điểm của `list` (sweep F3, ghi là R38, P3). F5 không làm việc này tệ hơn.
- **Deadlock**: `decide` khóa dòng tài liệu rồi mới khóa dòng dự án; tôi không thấy đường nào khóa theo thứ tự ngược lại. Bằng chứng F5 không có 40P01.

### D. Phán định của điều phối cho S1, S4, S3

- **S1** (valueHash dưới mặt nạ, giữ là phần dư R3): tôi chấm P2. Reviewer ngoài có thể chấm P1 vì hash của một giá trị ngắn bị che có thể bị dò ngược. Chấp nhận được khi Z4 còn tắt; R3 đã viết rõ.
- **S4** (mã lý do giữ cũng rò, R15 đã sửa): P3, chấp nhận được.
- **S3** (văn bản của dự án khác trong một lần gọi mô hình, điều kiện 25): P2 trong đánh giá của tôi. Rủi ro là Codex đã chấm cùng lớp này (CX2) là P0 ở vòng 1. Ngữ cảnh gửi vòng 2 nên nêu thẳng S3 và điều kiện 25.

Không mục nào trong ba mục là P0 hoặc P1 theo đánh giá của tôi.

### E. Có gì được bật hay lộ ra không

#fact:

- Diff không thêm GRANT, route, cờ môi trường hay role nào. Z4 vẫn tắt.
- Ba tệp bằng chứng `codex-fix1-F5-green.txt`, `codex-fix1-F5-native-verbose.txt` và `codex-fix1-F5-red.txt` không chứa đường dẫn máy và không chứa mẫu bí mật: grep đường dẫn tuyệt đối, chuỗi kết nối và mật khẩu không khớp gì.
- Thông báo lỗi mới chỉ chứa tên ràng buộc, tên trigger và mã lý do, không chứa nội dung.

## Phát hiện

### S-F5-1 — P2 — login runtime/web giữ được khóa dòng dự án bằng một lệnh chèn thô, kể cả lệnh bị lỗi

- **Vị trí**: `migrations/022_ai_drafts_pointer_only_guard.sql`, câu `PERFORM 1 FROM public.projects p ... FOR NO KEY UPDATE` trong `draft_decisions_pointer_only_guard`. Kế hoạch 0.8, đoạn R34 «Ai hoãn được lệnh ghi ánh xạ của một dự án».
- **Kịch bản**:
  1. Một kết nối dùng role runtime (hoặc `libetech_web`) tự đặt `app.*` cho một dự án trong phạm vi của nó.
  2. Kết nối đó mở giao dịch READ COMMITTED và chèn thô một dòng `draft_decisions` với `result='confirmed'`, cho một nháp nó đọc được, có nguồn và hash.
  3. Trigger BEFORE lấy khóa `FOR NO KEY UPDATE` trên dòng dự án trước WITH CHECK và trước UNIQUE(draft_id). Khóa vẫn được giữ khi lệnh chèn sau đó lỗi, kể cả khi giao dịch đã ở trạng thái aborted, cho tới khi rollback.
  4. Kết nối để giao dịch mở. Trong lúc đó:
     - Lệnh ghi ánh xạ của dự án, kể cả lệnh chuyển sang IBS_HI, và lệnh chèn nháp đều gặp 55P03 sau 5 giây.
     - Các xác nhận khác của dự án cũng bị chặn như vậy.
     - UPDATE hoặc DELETE dòng dự án chờ không có trần.
  5. Khóa chỉ hết khi giao dịch kết thúc. Bản kế hoạch không đặt `idle_in_transaction_session_timeout` cho login web/runtime.
- **Mâu thuẫn tài liệu**: R34 bản 0.7 viết «Ba login dịch vụ đang có không còn làm được điều này». Mục (iv) thêm ở bản 0.8 chỉ nói tới «giao dịch xác nhận của dịch vụ, ngắn». Nó không nói tới lệnh chèn thô do chính login runtime/web giữ mở. Câu 0.7 vì vậy không còn đúng.
- **Mức**: P2. Đây là từ chối dịch vụ có giới hạn trong phạm vi tự đặt của role, không làm lộ dữ liệu. Hôm nay không khai thác được vì Z4 tắt và không có nháp nào.
- **Sửa**:
  1. Sửa câu R34 của 0.7: login runtime/web hoãn được lệnh ghi ánh xạ và lệnh chèn nháp của một dự án trong phạm vi tự đặt của nó, tới khi giao dịch kết thúc.
  2. Mở rộng điều kiện 18: trước khi bật Z4, login web/runtime phải có `idle_in_transaction_session_timeout`, và một ca kiểm chứng minh giao dịch bị giữ mở bị cắt.
  3. Gia cố tùy chọn, tác dụng hạn chế: không lấy khóa khi nháp đã có quyết định.

### S-F5-2 — P3 — 55P03 và 23503 của xác nhận đi thô ra khỏi `decide`

- **Vị trí**: `src/server/suggestions.ts`, nhánh `throw e` của catch mới. Ca concurrency «waits past the cap fails with the database error 55P03».
- **Kịch bản**: một xác nhận chờ quá 5 giây thì người dùng nhận lỗi cơ sở dữ liệu thô thay vì lỗi dịch vụ có thể thử lại. Không có nội dung nào lộ ra; tầng xử lý lỗi chung vẫn che lỗi.
- **Sửa**: đã nằm trong điều kiện 18 của bản 0.8 (`decide` phải đổi 55P03 và 40P01 thành lỗi dịch vụ có thể thử lại). Tôi chỉ ghi nhận, không chặn.

## Không kiểm chứng được

- Tôi không chạy test. Mọi kết luận về hành vi khóa dựa trên đọc mã, các ca P4, P5, X1 và tệp bằng chứng, không dựa trên lần chạy của tôi.
- Tôi không kiểm cấu hình thật của các login (`idle_in_transaction_session_timeout`, `statement_timeout`) trên máy chủ triển khai.
- Bản kế hoạch 0.8 chưa commit. Tôi đọc bản trong cây làm việc tại thời điểm xem.

VERDICT: READY FOR GATE
