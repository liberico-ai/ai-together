# N4 theo OQ-59 (b) (1) — bằng chứng (22/11/2026)

Biên nhận: `docs/DELIVERY-021-n4-oq59-b1-held-threads-20261122.md`. Mọi log đã thay đường dẫn máy bằng `<repo>`, `<home>`, `<scratch>`, bỏ mã màu và cảnh báo của Node; không log nào mang đường dẫn máy, mật khẩu hay URL kết nối, chat ID hay tên người (dữ liệu của các ca là tổng hợp). Một lệnh kiểm cuối chạy trên từng log lúc ghi (`scrub`: lỗi nếu còn `/Users/`, tên máy, `password` hay URL có mật khẩu).

## Môi trường của các lần đo

PostgreSQL 16.15 (image `postgres:16`) trong một container thử, cổng loopback; công cụ `pg_dump`, `pg_restore`, `psql` là của container (`docker exec -i`, ổ cắm cục bộ, không mật khẩu). Một login superuser, một CSDL `slice1_verify_<epoch>` và một login web (`NOSUPERUSER`, `IN ROLE libetech_web`) **tạm** của phiên đo, tạo mới theo công thức của bộ nhớ «native test login recipe»; thông tin đăng nhập nằm ở một tệp quyền 0600 ngoài repo, không bao giờ in. Lệnh đo:

```bash
SLICE1_TEST_DATABASE_URL=… SLICE1_WEB_DATABASE_URL=… SLICE1_PG_CONTAINER=… npx vitest run                      # native
npx vitest run                                                                                                  # PGlite (không đặt ba biến trên)
python3 -m unittest tests.test_install_user
```

Không có hai lần chạy vitest cùng lúc; trước mỗi lần chạy `pgrep -f vitest` in `0`. Mỗi log đỏ và đột biến được đọc bằng số dòng `AssertionError` và số lần hết giờ (`timed out` / `PGlite is closed`), không bằng chữ «N failed»: **0 lần hết giờ ở mọi log đỏ**.

## Nguồn gốc của log: thiết kế đã đổi ba lần trong lúc làm

Thiết kế đi qua cổng Codex nên mỗi log đỏ là của **bản thiết kế lúc đó**, không phải bản cuối: (1) đếm-và-báo với tổng toàn CSDL và bộ cài tự xét bản lưu trước 023; (2) **loại bản lưu bắt buộc** (`SET libetech.archive_kind`), tệp là cổng duy nhất; (3) **đếm theo dự án**, không tổng, mặc định chỉ tính nếu áp vào phiên. Các log `green-*` là của **cây cuối**: bộ test đầy đủ được chạy lại sau sửa cuối của mã (kết quả của Codex lần 4).

## Log

| Tệp | Cho thấy |
|---|---|
| `logs/red-1-installer-unit-before-the-code.txt` | Thiết kế (1). Ca Python khi chưa có đọc số đếm: 15 khẳng định + 26 lỗi «chưa có bộ đọc trong script» (`ValueError: substring not found`, không phải khẳng định) |
| `logs/red-2-post-restore-pglite-before-the-code.txt` | Thiết kế (1). `tests/post-restore.test.ts` trên PGlite: 7 đỏ bằng khẳng định; ba ca nhìn thấy đúng lý do cũ: `POST-RESTORE-05 … stay held` |
| `logs/red-3-post-restore-and-rehearsal-pg16-before-the-code.txt` | Thiết kế (1). `post-restore` + `restore-rehearsal` trên PostgreSQL 16.15: 9 đỏ (R8 và R10 vì mã thoát 3) |
| `logs/red-4-installer-reader-after-security-seat.txt` | Sau ghế bảo mật đợt 1: bộ đọc của `install-d1.sh` chỉ cho hai loại đã biết; 6 đỏ khi tạm lui sửa |
| `logs/red-5-closer-notice-native-superseded.txt` | Thiết kế (1) + NOTICE «không bản nào có số» (**bị thay** ở thiết kế (2): NOTICE ấy đoán loại bản lưu). 2 đỏ |
| `logs/red-6-kind-parameter-python.txt`, `red-7-…-pglite.txt` | Thiết kế (2). Python: 5 khẳng định + 34 lỗi chữ ký (`run_post_restore` thêm tham số `kind`); PGlite: 6 đỏ (P12, P14, P4, P4e, P4f, P4g) |
| `logs/red-8-kind-echo-python.txt`, `red-9-default-guard-post-restore-pglite.txt` | Thiết kế (2) sau hai ghế mới: câu trả lời phải nói lại loại (Python 8 đỏ); mặc định của CSDL cho khoá loại (PGlite 1 đỏ: P4h) |
| `logs/red-10-per-project-python.txt`, `red-11-per-project-and-role-default-post-restore-pglite.txt` | Thiết kế (3), sau Codex lần chạy 3: đếm theo dự án không tổng, mặc định chỉ của role chạy tệp. Python 3 đỏ + 10 lỗi (`held_lines` chưa có); PGlite 3 đỏ (P4b, P4f, P4j) |
| `logs/red-12-key-name-match-post-restore-pglite.txt` | Sau Codex lần 4 (P2): ca P4k (mặc định của khoá khác tên có chứa tên khoá loại không được làm tệp dừng) đỏ bằng 1 khẳng định, hết giờ 0, trước khi sửa phép so tên |
| `logs/mutation-run-1-first-design-S3-invalid-S7-native-only.txt` | Đột biến của thiết kế (1) (S1–S7). **S3 sai dạng** (cột không có trong truy vấn con ⇒ lỗi SQL ⇒ 15 ca đỏ: không phải «bắt được» đột biến) và **S7 sống trên PGlite** (NOTICE chỉ được khẳng định ở ca diễn tập native): cả hai được làm lại ở tệp sau |
| `logs/mutation-run-2-S3-valid-S7-native.txt` | S3 đúng dạng (P4, P4b bắt) và S7 trên native (R10 bắt) |
| `logs/mutation-run-3-kind-parameter-K1-K6-I1-I7.txt` | Thiết kế (2): sáu đột biến của tệp SQL (K1–K6: bỏ đòi loại, bỏ từ chối pre-023, bỏ kiểm mặc định, từ chối cả post-023, bỏ `archive_kind`, hỏi loại **sau** bước sửa — K6 chạy native với psql thật) và bảy của hai bộ cài (I1–I7; I3 và I7 bị bắt bằng **lỗi** của chính ca, không phải khẳng định) |
| `logs/mutation-run-4-per-project-T1-T8.txt` | Thiết kế (3): tám đột biến (kiểm mặc định ở mọi role / bỏ qua role chạy tệp; tổng đặt lại vào câu trả lời; bộ cài in dòng cộng dự án / nói «mọi luồng bị giữ» / nhận `held_by_project` sai kiểu / không in dòng) — đều bị bắt bằng khẳng định hoặc lỗi của ca |
| `logs/mutation-run-5-key-set-and-source-order-N1-N2.txt` | Một tổng dưới tên khoá bất kỳ (P4i bắt) và khối «loại» chuyển ra sau bước sửa (P12c bắt trong PGlite) |
| `logs/green-typecheck.txt`, `green-build.txt`, `green-python-unittest.txt` | Cây cuối: typecheck, build, 84 ca Python |
| `logs/green-vitest-native-full.txt` | Cây cuối (sau sửa của Codex lần 4), PostgreSQL 16.15: **85 tệp, 1 495 ca đạt, 0 bỏ qua** |
| `logs/green-vitest-pglite-full.txt` | Cây cuối, PGlite: 71 tệp đạt + 14 bỏ qua, **1 344 ca đạt, 151 bỏ qua** (các ca cần công cụ native) |
| `logs/green-post-restore-and-rehearsal-pg16-verbose.txt` | Cây cuối, native, `--reporter=verbose`: 53 ca (35 của `post-restore`, 18 của ca diễn tập). Dòng `console.info` của R8 mang câu trả lời thật của tệp (chỉ số đếm và số thứ tự) |

## Cổng

`gates/tier1-dispositions.md`: từng finding của sáu ghế tầng 1 (ba đợt, mỗi ghế mới) và cách xử lý. `codex-context-round-1.md`, `codex-context-round-2.md` là hai khối ngữ cảnh đưa cho Codex; `codex-round-1-void.md` (lần chạy **vô hiệu**: cây làm việc đang bị đột biến đồng thời, finding là của chính đột biến), `codex-round-2.md`, `codex-round-3.md`, `codex-round-4.md` (lần hợp lệ thứ ba: `CHANGES_REQUIRED`, một P2 về khớp chuỗi con, đã sửa **sau** cổng; Codex không chạy lại) là phần `--output-last-message` (dòng đầu là kết luận). Transcript thô của Codex **không** được lưu: nó sao cả tệp luật của máy làm việc, mà repo công khai.
