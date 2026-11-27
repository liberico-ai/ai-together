# DELIVERY-027 — vá nhập bảng: bản 0.9.7 (chỉ web)

Ngày 27/11/2026 · nhánh nền `libetech-ai-os` · phiên Claude Code của GIAO VIỆC 5, làm GIAO VIỆC 9.

## Mức

| Mục | Đã có mã | Đã thử trên CSDL thử | Đã triển khai | Đã nghiệm thu |
|---|---|---|---|---|
| Ghi chú «Tách <mã>» là tham chiếu, không phải mã của dòng | có | có: PGlite, PostgreSQL 16 cục bộ | chưa bản 0.9.7; bản vá gốc đang chạy trên máy | chưa |
| Xem trước và biên nhận nhập bảng xếp dọc | có | đo trong trình duyệt máy cục bộ, 1440 và 390 px | chưa bản 0.9.7; bản vá gốc đang chạy trên máy | chưa |
| Vitest không quét `.claude/**` | có | có | không áp dụng | không áp dụng |

Mức «đang chạy trên máy» của bản vá lấy theo lời giao việc; phiên này không vào máy chủ nên không kiểm được. Phiên này không vào máy chủ, không khởi động lại gateway, không gửi tin vào nhóm nào.

## Nguồn của hai sửa

Hai sửa được viết thẳng trên máy chạy ở thư mục chính, chưa commit (ngoại lệ đã xảy ra, không lặp lại). Bản vá được tiếp nhận từ tệp patch có SHA-256 `038340650cf6e83d6a15bfbb45573cc5151c26e446ed8f536dfc2dbe287704c5`. Đối chiếu chỉ đọc: phần giữ trong `git stash` mà Codex tạo từ thư mục chính trùng **từng byte** với tệp patch, và không có tệp chưa theo dõi.

Khác bản vá:
- **Quy tắc tách được viết lại.** Trên 11 cách viết trong ca kiểm, bản vá chỉ xử lý đúng «tách LBRC015». Nó vẫn nhận mã khi có «khỏi», «ra», «mã (việc)», dấu hai chấm, khoảng trắng không ngắt, xuống dòng, tiếng Việt tổ hợp (NFD), và với mã thứ hai trở đi trong danh sách. So trên 300 000 ghi chú ngẫu nhiên: bản 0.9.7 không lần nào nhận một mã mà bản vá đã coi là tham chiếu.
- **CSS dùng `overflow-wrap:break-word`.** `anywhere` của bản vá cắt ô `LBRC` thành ba dòng ở 390 px.
- **Chữ của ca kiểm là chữ tự đặt,** không chép chữ trong bản vá vào repo công khai.

## PR, merge, cổng

| PR | Merge | Cổng |
|---|---|---|
| [liberico-ai/ai-together#55](https://github.com/liberico-ai/ai-together/pull/55) (0.9.6, runner migration) | `e64794c` | Cổng của PR đã xong trước đó: Codex một vòng `PASS`, không P0; PG16 1799/1799 trên cây mã cuối. Phiên này đọc lại diff mã và ca kiểm rồi merge |
| [liberico-ai/ai-together#57](https://github.com/liberico-ai/ai-together/pull/57) (0.9.7) | `543ba01` | Codex một vòng: `CHANGES_REQUIRED`, **không P0**, 2 P1; cả hai đã sửa có ca đỏ trước, Codex chưa đọc lại. Repo không có CI check cho PR này |

- Cả hai merge dùng `--match-head-commit`. Mỗi merge có hai cha, và cây của merge bằng cây của head. `main` vẫn ở `d23e516`; nhánh mặc định vẫn là `main`. PR #47 vẫn là nháp, chưa merge. PR #56 (dọn CSDL thử, của phiên khác) vẫn mở, không đụng tới.
- #55: head `c677730`, merge `e64794c`. #57: head `8b1f2c5`, merge `543ba01`.
- Cổng của #57 chạy trên commit mã `bde2d05`; từ đó tới head chỉ đổi tệp trong `docs/`.

## Ba ca đỏ → xanh

| Ca | Đỏ trên mã nền | Xanh |
|---|---|---|
| Quy tắc «tách» (`tests/sheet-import.test.ts`, 3 ca GV-9) | 2 ca hỏng bằng lỗi khẳng định: STT 31 và 43 cùng `DUPLICATE_CODE_IN_FILE`; cả 11 cách viết của lượt đầu đều ra sai (9 dạng một mã: dòng nhận LBRC015; 2 dạng danh sách: `MULTI_CODE`). Ca thứ ba giữ hành vi cũ nên xanh cả trước và sau. Hai ca đỏ nữa sau cổng Codex: `logs/red-after-codex.txt` | xanh trên `bde2d05`, ở PGlite và PostgreSQL 16 |
| Bố cục (`tests/work-import-layout.test.ts`, 2 ca; đo trình duyệt) | 2 ca hỏng bằng lỗi khẳng định; ở 1440 px, 3/10 phần ra ngoài thẻ, nút ghi chỉ rộng 44 px | xanh trên `bde2d05`, ở PGlite và PostgreSQL 16 |
| Phạm vi Vitest (`tests/test-scope.test.ts`, 2 ca) | ca «từ gốc» hỏng: gom cả tệp của worktree lồng. Ca «từ trong worktree» giữ hành vi cũ | xanh trên `bde2d05`, ở PGlite và PostgreSQL 16 |

## Cổng test

| Cổng | Kết quả trên `bde2d05` |
|---|---|
| typecheck, build | thoát 0 |
| pytest | 182 đạt, 210 subtest |
| PGlite với coverage | 1639 đạt, 167 bỏ qua; câu lệnh 96,24 %, nhánh 91,88 % |
| PostgreSQL 16, bật tập dượt phục hồi | 1806/1806, không bỏ qua |

Log: `docs/reviews/import-layout-split-evidence-20261127/`.

## Bản 0.9.7

- Tệp: `~/Documents/libetech-releases/libetech-ai-os-0.9.7-20261127.tar.gz`, đóng gói từ merge `543ba01` trong một worktree sạch (không tệp chưa theo dõi, không tệp bị bỏ qua) bằng `scripts/package-release.py`. **433 tệp.**
- SHA-256 của tệp: `cab8dd2f5aebd9659e0692fd233302af05c10c27dee45a85f47c654649e6301a` (tệp `.sha256` nằm cạnh; `shasum -a 256 -c` báo OK).
- `treeSha256`: `adff3a5ece0419104e7aa05b8d60b2c9aaef1f35970856ee18be75bca9fbeeea`. Giải nén vào thư mục mới trống, `deploy/verify-bundle.py` báo `Bundle verified` đúng mã này.
- Bản giải nén build được (`npm run build` thoát 0, có route `/work-import`).
- Chỉ web: không migration mới, plugin giữ 0.3.6, tệp triển khai không đổi.
- Runbook: `docs/RUNBOOK-097-20261127.md`.

## Bản 0.9.7 lên sau 0.9.5 có mất sửa nào của 0.9.3–0.9.5 không?

**Không mất.**
- Merge của 0.9.7 (`543ba01`) chứa merge của 0.9.5 (`1e54244`).
- So hai gói theo `deploy/BUNDLE-MANIFEST.json` (430 và 433 tệp): không tệp nào bị bỏ; thêm 3 tệp test, đổi 8 tệp; không đổi gì trong `migrations/`, `deploy/`, `bot-plugin/`.
- Ngoài `docs/`, các dòng bị gỡ kể từ 0.9.5 chỉ là: số bản; hai dòng của runner mà 0.9.6 thay; hai tên lớp của hai thẻ (thay bằng tên có thêm lớp mới); một dòng chú thích và một dòng đọc mã trong bộ nhập; hai dòng của `vitest.config.ts` (dòng cấu hình chỉ thêm phần loại trừ, đã đối chiếu bằng máy).

Chiều cần chú ý là chiều kia: máy đang chạy bản vá mà nâng lên **0.9.5** thì mất hai sửa của bản vá cho tới khi lên 0.9.7. `RUNBOOK-097` ghi: trong khoảng đó đừng nhập bảng việc.

## Chưa làm, và giới hạn của quy tắc

- Chưa triển khai, chưa nghiệm thu.
- Quy tắc chỉ nhận: «tách», thêm tuỳ ý «ra», rồi «từ» hoặc «khỏi», rồi «mã» hoặc «mã việc», rồi dấu hai chấm; sau đó là một mã hoặc danh sách mã nối bằng `,` `/` `&` `+` «và», và sau mỗi dấu nối được lặp lại «[ra] từ|khỏi [mã [việc]]». Cách viết khác (ví dụ «tách một phần từ …», «tách thành …») vẫn đọc như trước.
- Dấu phẩy không nói danh sách dừng ở đâu. Mã nằm trong danh sách được coi là tham chiếu, trừ khi ghi chú nói rõ đó là mã của dòng: «… là mã [việc] mới» hoặc «… riêng». Nếu người viết đặt mã riêng ở đó mà không nói rõ, dòng ra «không mã» (không bị gán mã sai); xem trước hiện cột «Mã việc» trống.
- Tiêu đề không đổi quy tắc: mã ở tiêu đề vẫn là mã của dòng, kể cả khi đứng sau «Tách».
- Không sửa dữ liệu đã nhập trước đó.
- Phiên mô phỏng trên máy cục bộ: lệnh ghi nhập bảng trả 500 (RLS từ chối ghi `work_import_batches`); mã nền cũng vậy. Biên nhận được kiểm bằng một trả lời tự đặt. Không sửa trong việc này.
- `next dev` (Next 16.4.5) trên máy phát triển tự ghi thêm một khối «nextjs-agent-rules» vào `AGENTS.md` và sửa `next-env.d.ts`. Phiên này đã hoàn lại cả hai, không commit và không làm theo khối đó. `npm run build` trong lượt chạy cổng không đổi tệp đang theo dõi nào. Máy nào đã chạy `next dev` trong repo thì nên xem lại `git status`.
- Còn nợ của GV-5 cho lần sau, không làm trong việc này: ca nghiệm thu thật còn thiếu, lỗi cũ cần đối chiếu với người báo, việc tệp lớn.
