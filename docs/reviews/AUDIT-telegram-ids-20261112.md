# Audit — mã nhóm và định danh Telegram trong repo công khai `ai-together`

Ngày 12/11/2026. Rà nhánh `libetech-ai-os` tại `decc492594f53a09a9952b8e8f40db2441996261` (302 tệp theo dõi), cùng mọi nhánh trên `origin`. Chỉ đọc: không sửa lịch sử, không xoá tệp, không push. Mọi mã trong tài liệu này đã che, chỉ giữ 3 chữ số cuối.

Lý do rà: review bảo mật lát 1 (`docs/reviews/slice-1-evidence-20261112/tier1-security-review.md:58`, trên nhánh `slice-1-doc-ownership`) đếm 11 tệp có mã nhóm dạng thật trong lúc repo công khai tạm thời. Review xếp việc này ngoài phạm vi lát.

## Kết luận

- #fact Có **3 mã nhóm Telegram thật** trong **15 tệp văn bản (30 dòng)** và **3 tệp zip**. Review lát 1 đếm 11 tệp vì chỉ tìm mẫu `-100` + 10 chữ số. Bốn tệp còn lại chỉ chứa mã nhóm LibeAI. Đây là nhóm thường, mã không có tiền tố `-100`. Ba tệp zip bị bỏ sót vì nội dung nén, `git grep` không đọc được.
- #fact Không thấy **ID số** của người dùng Telegram thật. Các ID người dùng trong test và script đều là giá trị tổng hợp (mục 3). Có **tên hiển thị Telegram** của hai nhân sự trong 11 tệp bằng chứng, và tên đăng nhập công khai của bot.
- #fact Ứng dụng web và plugin bot **không đọc** các mã này từ repo. Chúng đọc `bridge.json` trên máy chủ (`src/app/api/bridge/route.ts:10`, `bot-plugin/__init__.py:65`). Chỉ bộ cài d1-ai1 đọc mã từ repo, qua `deploy/pilot-scope.json`.
- #fact Mọi giá trị thật vào lịch sử qua đúng một commit: `b91f219` (12/11/2026 09:55 +07, «import LibeTech AI OS 0.7.1 as running on d1-ai1»). Commit cha là `d23e516`, đỉnh `main`. `b91f219` **không** nằm trên `main`. Trên `main` chỉ có giá trị mẫu kinh điển (`-100` nối `1234567890`) trong 4 tệp tài liệu và test của bot standup tháng 4.

## 1. Ba mã nhóm

| Nhãn | Mã (đã che) | Loại | Tên nhóm | Vai trò theo `deploy/pilot-scope.json` | Số dòng |
|---|---|---|---|---|---|
| G1 | `-*******184` (10 chữ số) | nhóm thường | LibeAI | `internalChatId` — người nhận pilot được duyệt | 20 |
| G2 | `-100*******311` | supergroup | Libe – Xeca | `deniedChatIds[0]` — bị từ chối | 9 |
| G3 | `-100*******921` | supergroup | Dragon Forge | `excluded` — không phải người nhận | 5 |

Bốn dòng chứa hai mã cùng lúc nên tổng cột (34) cao hơn 30 dòng. Tên nhóm lấy từ `docs/TELEGRAM-GROUP-VERIFICATION-20261109T0922.json:15-17,45-47` và `deploy/pilot-scope.json:13,16`.

## 2. Danh sách tệp

Cột «Loại»: **cấu hình** = mã đang chạy đọc tới; **test** = chạy trong `npm run test`; **script** = công cụ chạy tay; **bằng chứng** = hồ sơ lịch sử, không mã nào đọc nội dung.

| # | Tệp | Dòng khớp (nhóm) | Loại | Ai đọc tệp | Băm tệp bị ghim ở |
|---|---|---|---|---|---|
| 1 | `deploy/pilot-scope.json` | 4 (G1), 6 (G2), 16 (G3) | **cấu hình** — cần cho bộ cài | `deploy/install-user.py:11-15` (dùng ở `:64` đối chiếu `home_channel` thật, `:133` ghi `bridge.json`); `deploy/provision-server.py:11,22`; `tests/identity.test.ts:3`; `scripts/lbrc014-report.ts:1` (chỉ lấy `tenantId`, `projectId`); đóng gói ở `scripts/package-spec003.py:16`. `tests/test_install_user.py:5` nạp `install-user.py`, tệp này đọc `pilot-scope.json` ngay khi import | `deploy/BUNDLE-MANIFEST.json:15`, `docs/SOURCE-MANIFEST.json:15` |
| 2 | `tests/identity.test.ts` | 106 (G1), 111 (G3, G2) | **test** | `npm run test` (vitest). Dòng 106 khẳng định G1 đúng bằng giá trị trong `pilot-scope.json`; dòng 111 dùng G3, G2 làm ca bị từ chối | `BUNDLE-MANIFEST.json:85`, `SOURCE-MANIFEST.json:85` |
| 3 | `scripts/setup-local-verification.ts` | 18 (G3) | script thử cục bộ | Chạy tay. Ghi `.runtime/bridge.json` cấp G3 vào dự án (môi trường thử). Không cần giá trị thật | `BUNDLE-MANIFEST.json:55`, `SOURCE-MANIFEST.json:55` |
| 4 | `scripts/spec003-native-prepare.ts` | 50 (G1) | script thử cô lập | Chạy tay theo `docs/DEPLOY-003-team-access.md:127`. Không cần giá trị thật | — |
| 5 | `scripts/spec003-native-verify.ts` | 71, 75 (G1); 78 (G2) | script thử cô lập | Như trên | — |
| 6 | `deploy/libetech-os-finish-web-20261108.py` | 47 (G1, G2) | script một lần — bằng chứng | Bản đã chạy trên d1-ai1 ngày 08/11. Không tệp nào tham chiếu | — |
| 7 | `deploy/libetech-portal-verify-20261109.py` | 26 (G1, G2) | script một lần — bằng chứng | Bản đã chạy ngày 09/11 để đọc log gateway. Không tệp nào tham chiếu | — |
| 8 | `docs/DEPLOY-002.md` | 36 (G1, G3) | tài liệu cài đặt | `README.md:27` trỏ tới | (manifest ghi bản cũ, đã lệch) |
| 9 | `docs/DELIVERY-002-20261108.md` | 21 (G1) | bằng chứng | — | (manifest ghi bản cũ, đã lệch) |
| 10 | `docs/HERMES-DEPLOY-PREFLIGHT-20261108.json` | 20 (G1), 21 (G3) | bằng chứng | — | `BUNDLE-MANIFEST.json:27`, `SOURCE-MANIFEST.json:27` |
| 11 | `docs/TELEGRAM-CHECK-20261108T215456.json` | 14 (G1) | bằng chứng | — | — |
| 12 | `docs/TELEGRAM-CHECK-20261108T220013.json` | 6 (G1) | bằng chứng | — | — |
| 13 | `docs/TELEGRAM-GROUP-VERIFICATION-20261109T0922.json` | 17 (G1), 47 (G2) | bằng chứng — mục E06 của biên bản nghiệm thu LBRC014 | Liên kết từ `docs/LBRC014-BIEN-BAN-NGHIEM-THU-20261109.md:50` | — |
| 14 | `docs/TELEGRAM-IDENTITY-VERIFICATION-20261109T020433Z.json` | 59 (G2); 60, 61, 62 (G1) | bằng chứng | — | — |
| 15 | `docs/TELEGRAM-IDENTITY-VERIFICATION-20261109T022314Z.json` | 81, 86 (G2); 82–85 (G1) | bằng chứng — biên nhận máy chủ của E06 | — | `docs/TELEGRAM-GROUP-VERIFICATION-20261109T0922.json:6` (`serverReceiptSha256`) |
| 16 | `docs/LBRC014-HO-SO-NGHIEM-THU-20261109.zip` | trong zip: bản sao tệp 13 và 15 (G1 ×5, G2 ×3) | bằng chứng — gói đã gửi vào nhóm LibeAI | — | `docs/LBRC014-DELIVERY-LIBEAI-20261109T1015.json:18` |
| 17 | `docs/LBRC014-HO-SO-CAP-NHAT-1100-20261109.zip` | như tệp 16 | bằng chứng — gói đã gửi | — | `docs/LBRC014-DELIVERY-LIBEAI-20261109T1115.json:34` |
| 18 | `docs/LBRC014-HO-SO-CAP-NHAT-1200-20261109.zip` | như tệp 16 | bằng chứng — gói đã gửi | — | `docs/LBRC014-DELIVERY-LIBEAI-20261109T1212.json:34` |

Tệp 1–3, 5–8, 10 và 13–15 là 11 tệp review lát 1 đã đếm. Tệp 4, 9, 11, 12 chỉ chứa G1. Tệp 16–18 là zip.

Về manifest: `deploy/BUNDLE-MANIFEST.json` và `docs/SOURCE-MANIFEST.json` vẫn là bản 0.2.0. #fact Đối chiếu tại `decc492`: 55/83 tệp khớp, 28 tệp đã lệch. `install-user.py:38-47` và `deploy/verify-bundle.py` từ chối cài khi băm lệch. Còn `scripts/package-release.py` sinh lại manifest khi đóng gói. Sửa các tệp bị ghim không làm phát sinh loại lỗi mới.

## 3. Định danh người dùng Telegram

| Loại | Kết quả | Ghi chú |
|---|---|---|
| ID số người dùng | **Không thấy giá trị thật** | Giá trị trong mã đều tổng hợp: `123456789` (`scripts/native-verification.ts:37,41`, `tests/identity.test.ts:12`), `12340090` (`tests/spec003.test.ts:61`), `1234567` (`tests/onboarding-feedback.test.ts:73`), `'7500'+giờ hệ thống` (`scripts/spec003-native-verify.ts:59`), `999` (`tests/test_bot_bridge.py:23`) |
| Tên đăng nhập bot `@LiBeAiTogetherBot` | 15 dòng trong 10 tệp, gồm `src/components/telegram-link.tsx` và bản build `dashboard-plugin/dashboard/dist/index.js` | Tên bot công khai theo thiết kế. Giao diện cần tên này để hướng dẫn ghép tài khoản. Không xếp vào nhóm phải che |
| Tên hiển thị Telegram của hai nhân sự | 25 dòng trong 11 tệp: `docs/LBRC014-RESPONSES-LIBEAI-20261109*.json` (3 tệp), `docs/lbrc014-supplements-20261109/*.json` (6 tệp), `docs/LBRC014-BIEN-BAN-NGHIEM-THU-20261109.md`, `docs/DOI-SOAT-TEAM-TECH-20261110.md` | Toàn bộ là bằng chứng. Các tệp `LBRC014-RESPONSES-*` còn chép lại nội dung tin nhắn trong nhóm LibeAI (trường `body`, và `exactQuotes` ở bản T1500). `scripts/lbrc014-report.ts:37,44` chỉ ghi đường dẫn hai tệp supplements làm `source_id`, không đọc nội dung |
| Tên hiển thị của bot trong nhóm (`AiTogetherLibe`) | 4 dòng trong 2 tệp | #inference Tên hiển thị của bot: đây là người gửi các câu trả lời của bot, không phải người |

## 4. Lịch sử và nhánh

- #fact `git log --all -G '<3 mẫu>'` chỉ trả về `b91f219` cho các giá trị thật. Không commit nào sau đó thêm hay sửa dòng chứa mã. Ba zip cũng chỉ xuất hiện ở commit này.
- #fact `b91f219` nằm trên 6 nhánh từ xa: `libetech-ai-os`, `slice-1-doc-ownership` (PR liberico-ai/ai-together#6, đang mở), `docs/agents-md-sec5-20261112`, `docs/oq-decision-pack-20261112`, `docs/slice-briefs-agents-pointer`, `fix/feedback-resolve-key-binding`. Ba nhánh docs và nhánh `fix/feedback-resolve-key-binding` thuộc các PR đã merge (#2–#5). Hai nhánh cục bộ chưa push (`claude/jolly-dewdney-bbabf0`, `worktree-agent-a970a36635aa68110`) không chứa commit này.
- #fact Từ `b91f219` tới đỉnh 6 nhánh có 53 commit. 26 commit trong đó được trích SHA (7 ký tự) trong 21 tệp tài liệu trên `slice-1-doc-ownership`.
- #fact `main` (`d23e516`) không chứa giá trị thật. Workflow lab `.github/workflows/deploy.yml` trên `main` chỉ chạy khi có push vào `main` (`on: push: branches: [main]`; bản chụp tại `docs/reviews/evidence-20261112-lab-route/deploy-workflow-trigger.txt`).
- #fact API GitHub lúc rà: `visibility: public`, `forks_count: 0`. Tài liệu này không xác định được repo chuyển sang công khai lúc nào, và có ai đã clone hay không.
- #fact Repo `liberico-ai/libe-tech` (riêng tư) có G1, G2, G3 và thêm một mã `-100…` khác trong 7 tệp tại HEAD của bản checkout `hermes-libetech-priority1`. Dù chọn phương án nào ở repo này, các mã vẫn còn trong tổ chức.

## 5. Phương án

Không phương án nào bắt buộc chạm `main`; riêng (d) chỉ an toàn với `main` khi làm đúng điều kiện ghi ở dưới. Không phương án nào thay đổi cấu hình đang chạy trên d1-ai1: `bridge.json` và `home_channel` nằm trên máy chủ.

### (a) Giữ nguyên

- **Làm:** không đổi gì; ghi nhận rủi ro đã được chấp nhận.
- **Vỡ:** không có.
- **Rủi ro còn lại:** 3 mã nhóm, tên nhóm và tên hiển thị của hai nhân sự công khai suốt thời gian repo còn công khai. #inference Mã nhóm không phải thông tin xác thực. Bot lạ không gửi được vào nhóm nếu không phải thành viên. Cầu nối đòi HMAC và tài khoản đã ghép có xác minh (review lát 1, mục L-4). Tác hại chính là lộ cấu trúc nội bộ, tạo điểm bám cho lừa đảo.

### (b) Che giá trị trong commit mới, giữ lịch sử

- **Làm:** một PR vào `libetech-ai-os`. Test và script (tệp 2–5) đổi sang giá trị tổng hợp. Tài liệu bằng chứng (tệp 6–15) thay mã bằng nhãn `G1/G2/G3`. Riêng `deploy/pilot-scope.json` không che được: bộ cài cần giá trị thật (`install-user.py:64` so với `home_channel` trên máy chủ). Tệp này phải giữ nguyên hoặc đi theo (c).
- **Vỡ:**
  - `TELEGRAM-GROUP-VERIFICATION…:6` ghim SHA-256 của tệp 15. Che tệp 15 thì dòng ghim sai. E06 trong biên bản nghiệm thu LBRC014 mất khả năng đối chiếu.
  - Tệp 16–18 là gói đã gửi vào nhóm LibeAI, băm ghim trong biên nhận gửi. Che thì gói không còn là gói đã gửi. Không che thì mã vẫn nằm trong cây hiện tại.
  - Tệp 6–7 là bản đã chạy trên d1-ai1; sửa thì repo lệch với bản đã chạy.
  - `tests/identity.test.ts:106` phải đổi cùng lúc.
- **Lịch sử:** mã vẫn xem được trên GitHub ở `b91f219` và trong trang các PR #2–#6.
- **Công sức:** 1 PR; chạy lại `npm run test`, `npm run typecheck`, `python3 -m pytest tests/`.

### (c) Chuyển ra ngoài repo

- **Làm:**
  - `deploy/pilot-scope.json`: tách thành hai phần. `tenantId`/`projectId` ở lại repo. Mã nhóm đọc từ tệp trên máy chủ hoặc biến môi trường. Sửa `deploy/install-user.py:11-15`, `deploy/provision-server.py:11,22`. Thêm fixture cho `tests/test_install_user.py`. `tests/identity.test.ts` dùng giá trị tổng hợp. `scripts/lbrc014-report.ts` không phải sửa nếu `tenantId`/`projectId` còn trong repo.
  - Bằng chứng (tệp 6–7, 9–18): bản gốc chuyển sang nơi lưu riêng tư (Drive hoặc repo riêng tư). Trong repo để lại con trỏ và SHA-256. `docs/DEPLOY-002.md` là hướng dẫn cài nên ở lại, chỉ viết lại câu ở dòng 36. Bước này có xoá tệp khỏi repo nên là điểm dừng chờ Chairman.
- **Vỡ:** 13 tệp đang trỏ tới tệp sẽ chuyển phải đổi sang con trỏ: `README.md`, `PORTAL-DEPLOY-20261108.md`, `docs/DEPLOY-002.md`, `docs/LBRC014-BIEN-BAN-NGHIEM-THU-20261109.md` (E06, dòng 50), `docs/LBRC014-ACCEPTANCE-GAP-20261109.md`, `docs/RESUME-TEAM-ACCESS-20261109.md`, `docs/SPEC-003-team-access-evidence-dashboards.md`, 3 tệp `docs/LBRC014-DELIVERY-LIBEAI-*.json` và 3 tệp `docs/LBRC014-RESPONSES-LIBEAI-*.json`.
- **Lịch sử:** như (b), mã vẫn còn ở `b91f219`.
- **Công sức:** phần bộ cài là thay đổi mã, nên làm thành một lát hoặc PR riêng, có test và review. Không triển khai lên d1-ai1 khi chưa có Chairman.

### (d) Viết lại lịch sử

- **Phạm vi:** thay đúng 3 chuỗi G1, G2, G3 (và gỡ hoặc dựng lại 3 zip) trong `b91f219` cùng 53 commit con cháu trên 6 nhánh ở mục 4, rồi force-push 6 nhánh đó.
- **Với `main` và lab:** `main` không cần viết lại, **với điều kiện** thay bằng chuỗi cố định và chỉ viết lại các ref chứa `b91f219`. Nếu dùng mẫu chung «`-100` + 10 chữ số», công cụ sẽ đổi cả giá trị mẫu trên `main`. Khi đó `main` đổi SHA. Push `main` thì workflow «Deploy Libe Aios» chạy và lab bị triển khai lại. Phải loại `main` khỏi tập ref bị viết lại và không push `main`.
- **Rủi ro:**
  1. 53 SHA đổi. Trong 21 tệp tài liệu, 26 SHA được trích sẽ trỏ vào commit không còn: biên nhận, review Codex, DELIVERY-010, mô tả PR #6. Sửa lại các trích dẫn đó thì băm của chính các tệp ấy đổi theo.
  2. #inference Theo hướng dẫn «Removing sensitive data» của GitHub, force-push không xoá `refs/pull/<n>/head` của các PR, và trang PR đã merge vẫn hiện commit cũ. Muốn xoá hẳn phải nhờ GitHub Support. Cần kiểm lại hướng dẫn hiện hành trước khi làm.
  3. PR #6 đang mở phải rebase. Mọi worktree và clone (nhiều worktree cục bộ của các phiên) phải đặt lại. Một lần push từ bản cũ sẽ đưa mã trở lại.
  4. Thay chuỗi không với tới nội dung nén. Muốn sạch thì phải gỡ hoặc dựng lại tệp 16–18 trong toàn lịch sử, và băm trong biên nhận gửi LibeAI sẽ sai.
  5. Không thu hồi được bản đã bị tải trong lúc công khai.
  6. Force-push lên remote công khai không hoàn tác được. Cần Chairman duyệt cho từng nhánh.

## 6. Khuyến nghị

#inference Nên chọn **(a) cho lịch sử và tài liệu bằng chứng**, kèm **(c) chỉ cho `deploy/pilot-scope.json`** trong một lát sau. Khi đó cấu hình người nhận thật không còn nằm trong mã nguồn, và test dùng giá trị tổng hợp. Không nên chọn (d): chi phí (vỡ chuỗi SHA bằng chứng, rebase PR #6, cần GitHub Support) lớn hơn lợi ích, vì mã nhóm không phải thông tin xác thực và đã công khai một thời gian. (b) làm hỏng đối chiếu băm của E06 và của gói đã gửi, trong khi mã vẫn còn trong lịch sử.

Nếu repo còn công khai lâu dài, nên xử lý trước những phần lộ rộng hơn ở mục 7.

## 7. Ngoài phạm vi (ghi để làm tiếp, chưa xử lý)

- Tin nhắn nguyên văn của nhân sự trong nhóm LibeAI: `docs/LBRC014-RESPONSES-LIBEAI-20261109*.json`.
- Tên máy chủ `d1-ai1`, đường dẫn `/home/iptech/...` và tên 20 hồ sơ Hermes (có các hồ sơ IBS HI) trong `docs/TELEGRAM-IDENTITY-VERIFICATION-*.json` và nhiều tài liệu triển khai.
- Tên khách hàng (có thể là dữ liệu thử) trong ảnh `docs/lbrc014-supplements-20261109/quan-u7-20261109T1337.jpg`. Chưa mở 8 ảnh `phuong-ios-1502/*.png`.
- Login và ID người dùng GitHub trong `docs/lbrc014-*/*.json`. Đây là dữ liệu GitHub công khai, không phải Telegram.

## Cách rà (tái hiện được)

1. `git grep -c -E -- '-100[0-9]{10,}' origin/libetech-ai-os` cho ra 11 tệp, 13 dòng, 2 giá trị.
2. `git grep -n -P -- '(?<![\w.])-(?!100\d{10})\d{9,13}(?!\d)'` tìm số âm dài không có tiền tố `-100`, ra thêm G1. Quét lại toàn cây, không còn số âm dài nào khác.
3. ID người dùng: tìm theo khoá (`telegramId`, `user_id`, `from_id`, `sender_id`, `owner_id`, `allowed_users`, `"id"`…) đi kèm số từ 6 chữ số, và số 7–12 chữ số trên dòng có `telegram|chat|user|sender|pair`. Mọi kết quả hoặc là giá trị tổng hợp, hoặc là ID GitHub hoặc Android.
4. Tệp nén: giải từng mục của 6 zip và 1 docx trong cây (chỉ đọc, ở thư mục tạm ngoài repo) rồi tìm cùng các mẫu. 3 zip LBRC014 khớp; số `userId` trong zip UAT là UID gói Android.
5. Người đọc tệp: `git grep` theo tên từng tệp trong `src/`, `scripts/`, `deploy/`, `tests/`, `bot-plugin/`, `dashboard-plugin/`.
6. Băm bị ghim: tính SHA-256 từng tệp tại `decc492` rồi `git grep -F` giá trị băm.
7. Lịch sử: `git log --all -G` với 3 mẫu; `git branch -r --contains b91f219`; `git rev-list b91f219^..<6 nhánh>`.

**Giới hạn:** chưa OCR ảnh; chỉ mở bằng mắt 2 ảnh (`docs/screenshots/LibeTech-AI-OS-bot-scope.jpg`, `quan-u7-20261109T1337.jpg`), không thấy mã nhóm. ID người dùng Telegram không nằm cạnh khoá nào thì không nhận ra được bằng mẫu. Chưa rà bản triển khai trên d1-ai1, cũng chưa rà repo khác ngoài con số đếm ở mục 4.

## Câu hỏi cho Chairman

Chairman chọn phương án nào cho 3 mã nhóm Telegram trong repo `ai-together`: (a) giữ nguyên, (b) che trong commit mới, (c) chuyển ra ngoài repo, hay (d) viết lại lịch sử? Khuyến nghị ở mục 6 là (a) kèm (c) cho riêng `deploy/pilot-scope.json`.

## Quyết định

Chairman trả lời ngày 12/11/2026, nguyên văn: «(a) + (c) pilot-scope».

Phạm vi thực hiện theo quyết định này:

- **(a)** Lịch sử git, tài liệu bằng chứng (tệp 6–18), script thử (tệp 3–5) giữ nguyên.
- **(c) cho `deploy/pilot-scope.json`:** tệp chỉ còn `tenantId`, `projectId` và nguồn quan sát. Mã nhóm người nhận và mã nhóm bị từ chối chuyển sang một tệp trên máy chủ. Bộ cài đọc tệp đó qua biến `LIBETECH_PILOT_CHATS`: tệp phải là tệp thường, không phải symlink, quyền 0600, mã nhóm đúng dạng. Thiếu hoặc sai thì dừng, không cài.
- `tests/identity.test.ts` dùng mã tổng hợp và kiểm `pilot-scope.json` không còn mã nhóm. `docs/DEPLOY-002.md` chỉ sửa câu nói `pilot-scope.json` là bản đồ người nhận.
- Không chạy bộ cài trên d1-ai1. Cấu hình đang chạy ở đó (`bridge.json`, `home_channel`) không đổi.

Thực hiện trên nhánh cục bộ `fix/pilot-chat-ids-out-of-repo`, chưa push:

- Hàm nạp `load_pilot_chats` nằm trong `deploy/install-user.py`; `deploy/provision-server.py` dùng lại hàm này.
- Hai bộ cài giờ ghi mọi nhóm bị từ chối với quyền rỗng. Trước đây bộ cài user chỉ ghi nhóm đầu tiên. Cầu nối xử lý nhóm có quyền rỗng như nhóm lạ nên kết quả không đổi.
- Kiểm tại commit này: `npm run test` 63/63, `npm run typecheck` sạch, `python3 -m pytest tests/` 23 đạt (thêm 7 ca cho hàm nạp và 1 ca chặn mã nhóm quay lại `pilot-scope.json`).
- Manifest 0.2.0 trong repo không sinh lại ở đây; `scripts/package-release.py` sinh lại khi đóng gói.
