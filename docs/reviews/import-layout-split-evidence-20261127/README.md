# Bằng chứng: vá nhập bảng (0.9.7) — 27/11/2026

Nhánh `fix/import-layout-split-097`, trên `e64794c` (đã gồm 0.9.6). Đường dẫn máy trong log đã thay bằng `<repo>`, `<home>`, `<tmp>`; địa chỉ CSDL thành `<db>`; mã nhóm thử thành `<test-chat>`. Cổng chạy trên mã của commit `bde2d05`; sau commit đó chỉ thêm tài liệu.

## Đỏ trước, xanh sau

Các ca được chạy đỏ trước khi sửa. Máy khởi động lại giữa buổi và xoá thư mục tạm, nên các log đỏ dưới đây được chạy lại trên đúng mã cũ, trong một worktree dùng một lần.

| Log | Trên mã nào | Kết quả |
|---|---|---|
| `logs/red-split-first.txt` | mã nền, chỉ thêm ba ca GV-9 | 2 ca hỏng bằng lỗi khẳng định; ca giữ hành vi cũ đạt |
| `logs/hotfix-rule-on-new-cases.txt` | quy tắc của bản vá, áp tạm | ca STT 31/43 đạt; ca các cách viết hỏng. Từng cách viết: bản vá chỉ xử lý đúng dạng đầu |
| `logs/red-test-scope.txt` | `vitest.config.ts` của nền | ca «từ gốc» hỏng (gom tệp của worktree lồng); ca «từ trong worktree» đạt |
| `logs/red-layout.txt` | màn hình và CSS của nền; rồi CSS của bản vá cho yêu cầu `break-word` | nền: 2 ca hỏng; CSS bản vá: 1 ca hỏng |
| `logs/red-after-codex.txt` | `f5d3b76`, trước khi sửa theo Codex | 2 ca hỏng bằng lỗi khẳng định |
| `logs/hotfix-comparison.txt` | `bde2d05` so với quy tắc của bản vá, 300 000 ghi chú ngẫu nhiên | bản 0.9.7 không lần nào nhận một mã bản vá đã bỏ |
| `logs/browser-layout.txt` | trang `/work-import` chạy cục bộ | số đo trước và sau ở 1440 và 390 px |

## Cổng Codex, một vòng (`codex-round-1.md`)

Đầu vào: `docs/reviews/CODEX-REVIEW-PROMPT.md`, `codex-context-round-1.md` và diff `e64794c..f5d3b76` của `src`, `tests`, `vitest.config.ts`, `package.json`, `package-lock.json`. Kết quả: `VERDICT: CHANGES_REQUIRED`, **không có P0**, hai P1. Theo quy tắc của việc, P1 không chặn merge. Cả hai đã sửa trong PR này, có ca đỏ trước. **Codex chưa đọc lại; không chạy vòng hai.**

| Mức | Finding | Đã làm |
|---|---|---|
| P1 | Danh sách lặp lại từ dẫn («… và từ LBRC016») thì mã thứ hai bị gán cho dòng | Đúng, cùng loại với lỗi đang sửa. Sau dấu nối được lặp «[ra] từ\|khỏi [mã [việc]]» |
| P1 | «Tách LBRC015, LBRC052 là mã mới» làm mất mã riêng LBRC052 | Sửa cho trường hợp ghi chú **nói rõ**: mã trong danh sách đi liền «là mã [việc] mới\|riêng» không thuộc danh sách. Dấu phẩy không nói danh sách dừng ở đâu, nên ngoài trường hợp đó ô vẫn **để trống**, theo quy tắc sẵn có của bộ nhập («trống hoặc không rõ thì để trống, không đoán») |

## Cổng trên cây cuối

| Cổng | Kết quả | Log |
|---|---|---|
| `npm run typecheck` (`tsc --noEmit`) | thoát 0; chạy lại không dùng bộ đệm tăng dần cũng thoát 0 | `logs/typecheck.txt` |
| `npm run build` | thoát 0 | `logs/build.txt` |
| `python3 -m pytest tests/` | 182 ca đạt, 210 subtest | `logs/pytest.txt` |
| PGlite với coverage | 100 tệp đạt, 16 bỏ qua; 1639 ca đạt, 167 bỏ qua; câu lệnh 96,24 %, nhánh 91,88 % | `logs/pglite-coverage.txt` |
| PostgreSQL 16 (container cục bộ, bật tập dượt phục hồi) | 116 tệp, 1806 ca đạt, không ca nào bỏ qua | `logs/native.txt` |

So với 0.9.6: thêm 2 tệp và 7 ca (3 ca quy tắc tách, 2 ca phạm vi Vitest, 2 ca bố cục). Các lượt này không đổi tệp nào đang theo dõi.

## Chưa chứng minh được

- Chưa triển khai. Chưa chạy trên máy chủ.
- Bố cục đo trên trình duyệt của máy phát triển, phiên mô phỏng, dữ liệu tự đặt. Biên nhận được hiện bằng một trả lời tự đặt, vì lệnh ghi ở phiên mô phỏng bị RLS từ chối (lỗi có sẵn, mã nền cũng vậy).
- Ca bố cục trong bộ kiểm chỉ đọc mã nguồn.
- Quy tắc tách chỉ nhận các cách viết đã kê trong biên nhận.
