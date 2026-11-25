# Bằng chứng GV5-A — Team Tech tạo việc, ghế BoM duyệt (25/11/2026)

Nhánh `feat/gv5-a-tech-create-approval`. Đường dẫn máy trong log đã thay bằng `<repo>`, `<local>`, `<tmp>`. Log không chứa dữ liệu team: chỉ dữ liệu mẫu của bộ test.

## Cổng Codex — một vòng

- `codex-context-round-1.md`: khối ngữ cảnh gửi kèm diff mã.
- `codex-round-1.md`: kết quả nguyên văn. Dòng đầu: `VERDICT: CHANGES_REQUIRED`, gồm 1 P0 và 3 P1.
- Vòng chạy trên cây `a05bb54`. Bản ghi hội thoại của Codex không commit.

| Mục | Xử lý | Ca kiểm |
|---|---|---|
| P0 `024:156` — bot và viewer có quyền xem dự án chèn thẳng được yêu cầu | Sửa. Hàm `work_request_filer(project)` (SECURITY DEFINER, chủ là `libetech_identity`) đọc bảng tài khoản: chỉ thành viên Team Tech, hoặc điều phối của đúng dự án đang trong phạm vi. Luật `request_file` dùng hàm này. Service hỏi cùng câu trước khi chèn và trả `WORK_REQUEST_DENIED`. | `tests/work-requests.test.ts` (11b); `tests/foundation.test.ts` «a work request validates the proposed people…» |
| P1 `024:189` — ghế BoM `UPDATE` thẳng sang `rejected` mà không ghi `work_request_events` | Ghi lại, sửa tiếp sau. Chỉ ghế của dự án làm được; dòng yêu cầu vẫn giữ người quyết và thời điểm. | — |
| P1 rollback 024 chạy lần hai lỗi | Không tái hiện được. Trên PostgreSQL 16, `DROP TRIGGER IF EXISTS … ON <bảng không còn>` chỉ trả NOTICE. Bước 5 của ca rollback chạy rollback hai lần, xanh trên PGlite và trên PostgreSQL. | `tests/migrations-rollback.test.ts` «rollback 024 refuses…» |
| P1 `deploy/bom-seats.sql:25` — không kiểm dự án thuộc `tenant_id` truyền vào | Sửa. Mọi câu lệnh của tệp lọc theo cả `tenant_id` lẫn `project_id`. | `tests/work-requests.test.ts` «the seat script refuses a project that is not of the tenant passed…» |

Các sửa trên làm sau vòng Codex. Codex chưa đọc lại chúng; GIAO VIỆC 5 cho mỗi PR một vòng.

## Đỏ trước khi sửa

- `logs/red-build-before-code.txt`: lần chạy đầu của người dựng, ca viết trước mã. 14 ca hỏng, 13 dòng `AssertionError`.
- `logs/red-pre-fix-new-cases.txt`: ba ca mới của đợt sửa, chạy trên cây `a05bb54` (trước sửa). 3 ca hỏng, 2 dòng `AssertionError`:
  - ca foundation: «promise resolved … instead of rejecting» — hồ sơ demo không có dòng tài khoản vẫn gửi được;
  - ca bom-seats: tệp chạy xong với dự án của tenant khác.
  - Ca (11b) hỏng ở đây vì hàm chưa có (`function public.work_request_filer(unknown) does not exist`). Lỗi đó không chứng minh lỗ hổng, nên có log thứ ba.
- `logs/red-pre-fix-direct-insert.txt`: ca (11b) bỏ dòng gọi hàm, chạy trên `a05bb54`. 1 `AssertionError`: lệnh chèn thẳng của bot trả về một dòng thay vì bị RLS chặn. Đây là P0, thấy được trên cây cũ.

## Xanh trên cây cuối

Chạy một lần sau lần sửa cuối, trên cây của commit PR này (chỉ khác ở thư mục bằng chứng này).

| Log | Lệnh | Kết quả |
|---|---|---|
| `logs/green-typecheck-build.txt` | `npm run typecheck`, `npm run build` | cả hai thoát 0 |
| `logs/green-pglite-coverage.txt` | `npx vitest run --coverage` (PGlite) | 73 tệp đạt, 14 tệp bỏ qua (87); **1379 ca đạt, 156 ca bỏ qua (1535)**; `work-requests.ts` 99,19% câu lệnh, 97,18% nhánh |
| `logs/green-native.txt` | `npx vitest run` trên PostgreSQL 16 (container cục bộ, CSDL riêng của phiên) | **87 tệp đạt; 1535 ca đạt**, không ca nào bỏ qua |

156 ca bỏ qua trên PGlite là các ca chỉ chạy khi có PostgreSQL thật (`skipIf(!native)`); lần chạy native chạy cả 1535.
