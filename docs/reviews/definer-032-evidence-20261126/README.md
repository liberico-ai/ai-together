# Bằng chứng: cứng hoá hàm `SECURITY DEFINER` (migration 032, 0.9.5) — 26/11/2026

Nhánh `fix/definer-search-path-032`, trên `21af53f`. Đường dẫn máy trong log đã thay bằng `<repo>`, `<local>`, `<tmp>`; địa chỉ CSDL thành `<db>`; mã nhóm thử thành `<test-chat>`.

## Đỏ trước, xanh sau

| Log | Trên mã nào | Kết quả |
|---|---|---|
| `red-first.txt` | trước khi viết 032 | 4 ca hỏng, mỗi ca một lỗi khẳng định |
| `red-after-codex.txt` | `dcc2835`, trước khi sửa theo Codex | 2 ca hỏng bằng cùng một lỗi khẳng định (vitest gộp một khối lỗi cho cả hai); 6 ca còn lại đạt |

Ca cũ phải đổi: `tests/intake-pool-isolation.test.ts` (6) chờ đúng chuỗi `search_path=pg_catalog`; nay chờ `pg_catalog, pg_temp`.

## Cổng Codex, một vòng (`codex-round-1.md`)

Đầu vào: `codex-context-round-1.md` cùng diff `21af53f..dcc2835` của `migrations`, `tests`, `package.json`. Kết quả: `VERDICT: CHANGES_REQUIRED`, **một P0**. Đã sửa, có ca đỏ trước. Codex chưa đọc lại; không chạy vòng hai.

| Mức | Finding | Đã làm |
|---|---|---|
| P0 | Câu canh cuối 032, và phép kiểm của test, nhận cả đường tìm có `pg_temp` đứng sớm hơn rồi lại đứng cuối | «Ghim» là `pg_temp` có đúng một lần và đứng cuối. Đường tìm không đọc được từng mục thì coi là chưa ghim. Thêm các ca: `pg_temp` đứng hai lần, tên trích dẫn, `pg_temp` đứng trước một schema có tên, và một đường dài hợp lệ |

## Câu canh đã chặn một lần thật

Lượt đủ bộ đầu tiên trên PostgreSQL 16 cục bộ bị 032 chặn, và 032 nêu tên một hàm không migration nào hiện có tạo ra. Đó là hàm của bản nháp 028 trong lúc làm 0.9.2 (có ở `6e3de00`, bỏ ở `1518c3a`), còn lại trên CSDL thử. Không gói phát hành nào (0.9.0–0.9.4) chứa nó. Sau khi đối chiếu định nghĩa với bản nháp, hàm được gỡ khỏi CSDL thử cô lập.

## Cổng trên cây cuối

| Cổng | Kết quả | Log |
|---|---|---|
| `npm run typecheck` | thoát 0 | `logs/typecheck.txt` |
| `npm run build` | thoát 0 | `logs/build.txt` |
| `python3 -m pytest tests/` | 182 ca đạt, 210 subtest | `logs/pytest.txt` |
| PGlite với coverage | 98 tệp đạt, 15 bỏ qua; 1630 ca đạt, 162 bỏ qua; câu lệnh 96,23 %, nhánh 91,88 % | `logs/pglite-coverage.txt` |
| PostgreSQL 16 (container cục bộ) | 113 tệp, 1792 ca đạt, không ca nào bỏ qua | `logs/native.txt` |

## Chưa chứng minh được

Chưa triển khai. Trên máy chủ, nếu có hàm quyền cao nào tạo ngoài migration thì 032 dừng và nêu tên, không đổi gì.
