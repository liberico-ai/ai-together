## Bối cảnh lượt này (GIAO VIỆC 9, bản 0.9.7 «vá nhập bảng», chỉ web)

Nhánh `fix/import-layout-split-097` trên `libetech-ai-os` (đã gồm 0.9.6). Một PR cho ba việc; lời nhắc nền ở trên nói «lát» thì đọc là «PR này».

1. **Ghi chú «Tách <mã>»** (`src/server/sheet-import.ts`). Lỗi thật: STT 31 (mã LBRC015) và STT 43 (ghi chú «Tách LBRC015») cùng ra `DUPLICATE_CODE_IN_FILE`, cả hai bị giữ ngoài hàng chờ. Quy tắc: mã đứng ngay sau cụm «tách [ra] [từ|khỏi] [mã [việc]] [:]» trong **ghi chú** là tham chiếu tới việc gốc, kể cả khi viết thành danh sách (`,` `/` `&` `+` «và»). Mọi kiểu chữ; ghi chú được đưa về NFC chỉ để đọc mã, ghi chú lưu giữ nguyên. Dòng chỉ có mã trong cụm tách ra «không mã». Cách viết khác vẫn đọc như cũ (hai dòng cùng nhận một mã thì cả hai chờ). Tiêu đề không đổi quy tắc. Dòng chỉ đọc tiêu đề (IBS HI, chưa ánh xạ, không được nộp) vẫn không đọc ghi chú.
   - Nhập lại tệp đã nhập: `work_import_key_conflicts` (027) xét STT + vân tay ô trước, mã không nằm trong hai thứ đó; `previewDigest` tính trên phân tích không đọc ghi chú.
2. **Bố cục xem trước và biên nhận** (`src/app/globals.css`, `src/components/work-import.tsx`): hai thẻ này xếp dọc ở mọi bề rộng. Dùng `overflow-wrap:break-word`; `anywhere` làm cột bảng bị bóp, chữ bị cắt giữa từ ở 390 px. `tests/work-import-layout.test.ts` chỉ đọc mã nguồn; bố cục đã đo riêng trong trình duyệt ở 1440 và 390 px.
3. **Phạm vi Vitest** (`vitest.config.ts`): bỏ `**/.claude/**`. `tests/test-scope.test.ts` gọi CLI thật trên một cây giả, từ gốc và từ bên trong worktree lồng.

Giới hạn của việc: không migration, không đổi plugin, không đổi luật 3/3, ranh giới IBS HI (FA #1) hay production.

Ba tệp test mới hoặc đổi: `tests/sheet-import.test.ts` (ba ca GV-9 ở cuối), `tests/work-import-layout.test.ts`, `tests/test-scope.test.ts`. Hai ca đầu của GV-9 đỏ trên mã nền bằng lỗi khẳng định; ca thứ ba giữ hành vi cũ nên xanh cả trước và sau.

Hãy soát kỹ quy tắc tách: có cách viết tự nhiên nào làm **mã riêng của dòng bị bỏ**, hoặc **mã của việc gốc bị gán cho dòng khác** không; biểu thức chính quy có chỗ nào chạy lùi quá mức không (ô tối đa 2000 ký tự); và có đường nào làm ghi chú dòng IBS HI được đọc không.

## Diff
