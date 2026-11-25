## Việc (GIAO VIỆC 5, hạng mục C — không phải lát 1–5)

PM đưa danh sách việc của cả team từ bảng hiện có lên nền tảng. Mục tiêu, lời Chairman ngày 25/11/2026, chép nguyên: «Hoàn thiện GO LIVE để toàn bộ Team Tech tạo và cập nhật được công việc thật, gồm cả các vấn đề đã ghi nhận trong LibeAI và Dragon Forge. Phương đưa được danh sách việc của cả team từ bảng hiện có lên nền tảng.»

Yêu cầu của hạng mục C theo giao việc: xem trước bắt buộc; giữ các trường như đã viết; ô trống gắn cờ, không đoán; kết quả từng dòng; nhập lại không tạo trùng; mọi dòng thành yêu cầu chờ BoM duyệt (luật của hạng mục A, `d0d3d76`); IBS HI chỉ con trỏ, hash và metadata công việc Tech (`AGENTS.md`); số đếm không cộng gộp giữa các miền (Liberico BU · Xeca · IBS HI).

Theo giao việc của Cowork điều phối: cổng chạy **một vòng** mỗi PR. Chỉ P0 chặn merge (rò dữ liệu, leo quyền, mất dữ liệu); P1/P2 ghi vào biên nhận và sửa tiến. Vẫn xếp hạng mọi finding theo thang của lời nhắc trên.

Đầu vào là **diff của mã** (`src`, `migrations`, `deploy`, `scripts`, `bot-plugin`, `tests`, `vitest.config.ts`, `package.json`) so với đầu nhánh của hạng mục B (`9a92c42`; B có 025/026, chưa merge; C chỉ cần 024). Đọc `docs/plans/gv5-c-sheet-import.md` (mục 13 thay các mục trên khi khác nhau), OQ-62 cuối `docs/OPEN-QUESTIONS.md`, `docs/EVIDENCE-REQUEST-20261125.md` (EV-10) và phần còn lại từ cây làm việc.

## Đã đổi

- `migrations/027_work_imports.sql` (+ `rollback/027`, từ chối khi có migration sau hoặc khi bảng có dòng; `SET LOCAL row_security = off` để đếm thật):
  - `work_import_batches` (Z1): một lô mỗi lần ghi; `request_key`, `preview_digest`, `file_hash`, nguồn, `counts`/`results` không có chữ của ô; UNIQUE theo người nhập + `request_key`.
  - `work_import_rows` (Z1): một dòng khoá mỗi dòng đã nhập, trỏ tới `work_requests`; ba UNIQUE cùng phạm vi `(tenant_id, source_id, sheet)`: STT, mã, `content_hash`. Ghi bằng `INSERT … ON CONFLICT DO NOTHING`, không đọc-trước-rồi-ghi.
  - RLS `ENABLE` + `FORCE`, `USING` + `WITH CHECK`. Lô: chỉ người nhập. Dòng: đọc = người nhập hoặc ghế BoM của dự án (`work_request_seat`); chèn = người nhập, và `work_request_filer(project_id)` của 024. Runtime đọc theo cột, không có `source_note`.
  - Hàm `SECURITY DEFINER` (chủ `libetech_identity`, `search_path=pg_catalog`, PUBLIC thu hồi): `work_import_project_facts(project)`, `work_import_key_conflicts(...)` (chỉ trả một lớp xung đột theo vị trí dòng), `work_import_is_ibs_text(label)`. Trigger `work_import_rows_guard` từ chối ghi chú khác rỗng cho dòng IBS HI (nhãn BU, BU hoặc ánh xạ miền mới nhất của dự án), khoá dòng `projects` như 022; chặn UPDATE/DELETE.
- `src/server/sheet-import.ts`: `preview` (không ghi gì) và `commit` (một transaction cho cả lô; tính lại digest, khác → `PREVIEW_STALE`). Mỗi dòng hợp lệ → `work_requests` `origin='import'`, `pending`. Dòng của dự án người nhập không được tạo việc → `needs_reconciliation` `NOT_A_FILER`, các dòng khác vẫn nhập. Mã việc chỉ lấy từ tiêu đề. Dòng IBS HI đọc «chỉ tiêu đề»: ghi chú không vào băm, không vào bảng, không vào xem trước hay biên nhận.
- `src/server/csv.ts`: bộ đọc CSV RFC 4180, UTF-8 nghiêm, giới hạn kích thước, số dòng, độ dài ô. `request-body.ts`: đọc thân yêu cầu theo luồng, dừng ở ngưỡng. `source-snapshot.ts`: tách hàm kiểm dòng dùng chung.
- `src/server/http.ts`: `POST /api/v1/work-imports/preview`, `POST /api/v1/work-imports`, `GET /api/v1/work-imports/:id`; trả 404 như đường không có khi `LIBETECH_WORK_IMPORT` khác `1` (mặc định tắt).
- Giao diện `/work-import`, liên kết «Nhập bảng việc» chỉ khi bật; trang yêu cầu hiện nhãn nguồn.
- `scripts/sheet-import-dry-run.ts`: chạy thử trên PGlite trong bộ nhớ, không nhận chuỗi kết nối; ghi `detail.json` (0600, ngoài repo) và `receipt.json` chỉ có số đếm theo nhãn BU và mã lý do theo số dòng.
- `package.json` 0.9.1.

## Quyết định cố ý (nói nếu bạn thấy sai)

- Cách hiểu tạm OQ-62: 1 (1) khoá chống lặp STT + mã + hash nội dung, không dùng số dòng; 2 (1) người nhập theo luật tạo việc của A, refusal theo từng dòng; 3 (1) dòng «Hoàn thành»/«Tạm dừng» vẫn vào hàng chờ BoM; 4 (1) dòng IBS HI giữ tiêu đề, người, trạng thái, hạn, không giữ ghi chú; 5 (1) ngày hai nghĩa để trống + cờ; 7 (1) mã chỉ từ tiêu đề; 8 (1) hàm xung đột so với mọi dòng khoá của cùng nguồn và trang trong tenant (kể cả do người khác nhập), chỉ trả một lớp theo vị trí dòng, để hai người nhập cùng bảng không ghi lặp.
- `origin='import'` không bị ràng buộc ở CSDL với một dòng khoá: chỉ dịch vụ bảo đảm (plan mục 13, «Ghi nhận, chưa sửa»).
- Sửa ở bảng nguồn sau khi nhập đọc là `SOURCE_CHANGED`; không đồng bộ ngược.
- Bật nhập là bước vận hành, sau khi PM xác nhận bản nguồn (EV-10).

## Hãy soi kỹ

Chữ «Ghi chú» của dòng IBS HI lọt vào bất kỳ cột, băm (`fingerprint`, `content_hash`, `request_hash`), `results`, xem trước, biên nhận, log hay `work_request_events`; một dòng đổi sang IBS HI giữa xem trước và ghi; dùng `work_import_key_conflicts` hay `work_import_project_facts` làm oracle vượt quá lớp đã khai (nội dung, người nhập, dự án); danh tính, tenant hay trạng thái lấy từ JSON; ghi được mà không qua xem trước hoặc với digest cũ; chống lặp bằng kiểm-rồi-ghi; hai lô song song cùng tệp; chèn dòng khoá hay yêu cầu vào dự án người nhập không được tạo việc, hoặc vào lô của người khác; bot ghi được; số tổng cộng qua nhóm ở API, giao diện, `counts`, hay biên nhận; bộ đọc CSV hoặc thân yêu cầu không giới hạn; `sourceUrl` ngoài `docs.google.com`; rollback 027 xoá lịch sử; biên nhận hoặc tài liệu gọi mức «đã triển khai/đã nghiệm thu».
