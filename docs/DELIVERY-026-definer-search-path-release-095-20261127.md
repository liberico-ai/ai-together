# DELIVERY-026 — cứng hoá hàm quyền cao (migration 032): bản 0.9.5

Ngày 27/11/2026 · nhánh nền `libetech-ai-os` · phiên Claude Code của GIAO VIỆC 5. Chủ dự án duyệt sửa («Yes, fix it»), rồi duyệt merge PR #53 ở `d59e76c`, đóng gói 0.9.5 và viết runbook («Yes, merge»).

## Mức

| Mục | Đã có mã | Đã thử trên CSDL thử | Đã triển khai | Đã nghiệm thu |
|---|---|---|---|---|
| Mọi hàm `SECURITY DEFINER` ghim `pg_temp` ở cuối `search_path` | có, PR #53 | có: PGlite, PostgreSQL 16 cục bộ, tập dượt nâng 0.9.4 → 0.9.5 | chưa | chưa; bản này không đổi gì người dùng thấy |

Phiên này không vào máy chủ, không khởi động lại gateway, không gửi tin vào nhóm nào.

## PR, merge, cổng

| PR | Merge | Cổng |
|---|---|---|
| [liberico-ai/ai-together#53](https://github.com/liberico-ai/ai-together/pull/53) | `1e54244` | Codex một vòng: `CHANGES_REQUIRED`, 1 P0, đã sửa có ca đỏ trước; Codex chưa đọc lại. Sau khi mở PR, bộ soát bảo mật tự động nêu thêm một lỗ của câu canh; đã sửa có ca đỏ trước. Repo không có CI check cho PR này |

- Merge bằng `--match-head-commit d59e76c…`. Merge có hai cha; cây của merge bằng cây của head. `main` vẫn ở `d23e516`; nhánh mặc định vẫn là `main`. PR #47 vẫn là nháp, chưa merge.
- Từ commit đã chạy cổng (`f3c300b`) tới head chỉ đổi tệp trong `docs/`.

## Cổng test

| Cổng | Kết quả |
|---|---|
| typecheck, build | thoát 0 |
| pytest | 182 đạt, 210 subtest |
| PGlite với coverage | 1632 đạt, 162 bỏ qua; câu lệnh 96,23 %, nhánh 91,88 % |
| PostgreSQL 16 | 1794/1794, không bỏ qua |

Log: `docs/reviews/definer-032-evidence-20261126/`.

## Bản 0.9.5

- Tệp: `~/Documents/libetech-releases/libetech-ai-os-0.9.5-20261127.tar.gz`, đóng gói từ merge `1e54244` trong một worktree sạch bằng `scripts/package-release.py`. 430 tệp.
- SHA-256 của tệp: `9e9f6f661ad7441006d6173a004a7c39f6ea9393d93be7859ec80f0b48cdcc8e` (tệp `.sha256` nằm cạnh; `shasum -a 256 -c` báo OK).
- `treeSha256`: `4d509e07ad37c5d87436103d982b4031763ac6f432524266a5e2b82b8d4c7043`. `deploy/verify-bundle.py` báo `Bundle verified` trên bản giải nén.
- So danh sách và hash với 0.9.4 (427 tệp): thêm `migrations/032_…`, `migrations/rollback/032_…`, `tests/definer-search-path.test.ts`; đổi `tests/intake-pool-isolation.test.ts`, `package.json`, `package-lock.json`. **Mã web, plugin (0.3.6), tệp triển khai và script không đổi.**
- Runbook: `docs/RUNBOOK-095-20261127.md`. Không phải khởi động lại gateway cho bản này.

## Tập dượt nâng bản, trên CSDL tạm của máy cục bộ

CSDL tạm được tạo trong container thử rồi xoá. Runner chạy từ hai gói đã giải nén. Log: `logs/upgrade-rehearsal.txt`.

| Bước | Kết quả |
|---|---|
| Runner của gói 0.9.4 | áp 31 tệp, tệp cuối 031 |
| Trước 032 | 35 hàm quyền cao, 17 chưa ghim |
| Runner của gói 0.9.5 | áp đúng một tệp, 032 |
| Sau 032 | 35 hàm, 0 chưa ghim |
| Chạy runner lần nữa | không áp gì |

## Phát hiện khi tập dượt: runner che câu từ chối

Thử với một hàm tạo tay (`logs/runner-hides-refusal.txt`):
- Runner thoát 1, và **chỉ in** `current transaction is aborted` (`25P02`). Câu của 032 và tên hàm không hiện.
- CSDL không đổi: vẫn tới 031, 18 hàm chưa ghim.
- Chạy tệp 032 bằng `psql -v ON_ERROR_STOP=1` thì thấy đủ câu và tên hàm; vẫn không đổi gì.

Nguyên nhân (đọc mã): khối `finally` của `scripts/migrate.ts` gửi thêm câu mở khoá trên kết nối đang có giao dịch hỏng. Lỗi của câu đó thay lỗi gốc. Runner chưa đổi từ lần nhập repo đầu tiên, nên mọi tệp có giao dịch riêng đều bị như vậy, gồm các câu từ chối của 028 và 029.

Câu «032 dừng và nêu tên» trong bằng chứng và mô tả PR #53 **đúng cho tệp SQL, không đúng khi chạy qua runner**. Các ca test áp tệp trực tiếp nên không thấy. Runbook §4 ghi cách đọc câu thật. **Runner chưa được sửa trong bản này.**

## Còn lại

- Chưa triển khai. Triển khai cần lời Chairman.
- Bằng chứng cần lấy trên d1-ai1: truy vấn ở runbook §3 trả 17 trước khi áp và 0 sau khi áp.
- Sửa `scripts/migrate.ts` để giữ câu lỗi gốc: việc riêng.
