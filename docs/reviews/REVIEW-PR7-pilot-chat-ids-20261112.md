# Review PR #7 — đưa mã nhóm Telegram của pilot ra khỏi repo

Base `9873f4aee647c3bab9130c8e648395811fbff3a9` (`libetech-ai-os`). Chairman yêu cầu review ngày 12/11/2026, nguyên văn: «Run Codex review». Lời nhắc: `docs/reviews/CODEX-REVIEW-PROMPT.md`, cộng phần bối cảnh riêng của PR này (không phải lát roadmap; quyết định «(a) + (c) pilot-scope»; bốn điểm kiểm thêm a–d), cộng diff `git diff --merge-base <base> <head>`. Codex chạy `codex exec --sandbox read-only`, head được ghim theo từng vòng. Verdict đọc từ dòng đầu tệp kết quả, không suy từ mã thoát.

## Vòng 1 · head `ac49e08eb7671daacb73a0b82f994e4bfac861e1`

VERDICT: CHANGES_REQUIRED

- [P1] deploy/provision-server.py:16 — Nhánh cài bằng quyền root kiểm tệp mã nhóm quá muộn để đáp ứng yêu cầu “thiếu hoặc sai thì dừng, không cài”.
  Kịch bản: `LIBETECH_PILOT_CHATS` thiếu hoặc tệp sai → `install-d1.sh` đã tạo cluster và restore dữ liệu trước khi gọi bước này và dừng.
  Căn cứ: Quyết định trong audit, dòng 149; `deploy/install-d1.sh:16-42`.

- [P0] deploy/install-user.py:91 — Đường `--resume-empty-db` bỏ qua đối chiếu nhóm được cấp quyền với `home_channel`.
  Kịch bản: Tệp máy chủ chứa một mã nhóm khác nhưng đúng định dạng → resume ghi nhóm đó vào `bridge.json`; người dùng đã ghép tài khoản có thể yêu cầu dữ liệu dự án trong nhóm sai. `provision-server.py:27` cũng cấp quyền từ tệp mà không đối chiếu nhóm.
  Căn cứ: `deploy/install-user.py:84`; `src/server/bridge.ts:38-42`; quyết định pilot-scope trong audit.

- [P2] tests/identity.test.ts:116 — Ca “deployment chat mapping” tự dựng `scopes`, nên không kiểm bản đồ mà bộ cài thực sự ghi.
  Kịch bản: `chat_scopes()` cấp dự án cho nhóm trong `deniedChatIds` → ca TypeScript vẫn xanh; các ca Python mới chỉ kiểm hàm nạp tệp.
  Căn cứ: Yêu cầu kiểm test mục (c); `deploy/install-user.py:37-39`.

- [P2] docs/reviews/AUDIT-telegram-ids-20261112.md:64 — Khẳng định không commit nào sau `b91f219` sửa dòng chứa mã nhóm đã sai ngay tại PR này.
  Kịch bản: Commit của PR sửa `docs/DEPLOY-002.md:36`, dòng vẫn chứa hai mã nhóm thật; `git log --all -G` trả thêm commit đó.
  Căn cứ: Yêu cầu kiểm tính chính xác của audit mục (d).


**Xử lý (commit `f3bb585`):**
- P0: thêm `check_recipient` trong `deploy/install-user.py`. Hàm đối chiếu nhóm được duyệt với `home_channel` thật trước khi ghi quyền, trên cả ba đường: `inspect`, `--resume-empty-db` và `provision-server.py`. Trước PR này, đường resume cũng không đối chiếu; giá trị khi đó lấy từ `pilot-scope.json` trong repo.
- P1: `deploy/install-d1.sh` chạy `provision-server.py --preflight` ngay sau `verify-bundle.py`, trước apt, tạo user, tạo thư mục, tạo cluster và restore. `DEPLOY-002.md` ghi cách truyền biến qua `sudo`.
- P2 (test): thêm ca cho `chat_scopes` (chỉ nhóm được duyệt nhận dự án), cho `check_recipient` (khớp và lệch), và cho thứ tự bước ở resume, `install-d1.sh`, `provision-server.py`. Ba ca sau đỏ trên mã trước khi sửa, xanh sau khi sửa. Ca `chat_scopes` là ca phủ thêm, xanh cả trước khi sửa.
- P2 (audit): câu «chỉ `b91f219`» ghi rõ «tính tới `decc492`». Mục «Quyết định» ghi rằng PR sửa dòng `DEPLOY-002.md:36`, dòng vẫn giữ G1, G3 theo (a).
- Kiểm tại `f3bb585`: `npm run typecheck` exit 0; `npm run test` 227 đạt, 9 bỏ qua; `python3 -m pytest tests/` 27 đạt; `bash -n deploy/install-d1.sh` đạt. Ca `check_recipient` cần PyYAML; máy chạy kiểm có PyYAML nên ca đã chạy thật, không bị bỏ qua.
