# DELIVERY-009 · Bước 0 — đưa mã lên git, nối cổng phản biện · 11/11/2026

**Trạng thái: ĐẠT tiêu chí «Đạt khi» của Bước 0** — nhánh `libetech-ai-os` có trên GitHub; `git status` sạch; test, typecheck, build xanh từ clone mới (mục 8); biên nhận ghi SHA và kết quả đối chiếu server (mục 2, 7). **Ngoại lệ:** phần repo `libe-tech` hoãn theo quyết định Chairman 6.3, chưa commit, chưa push.
Căn cứ: `docs/HANDOFF-CLAUDE-CODE-20261111.md` mục 4 (bản 1.3). Lập 11/11/2026, chốt 12/11/2026.

## 1. Bốn mức

| Mức | Trạng thái |
|---|---|
| Đã có mã | Không áp dụng: Bước 0 không thêm mã sản phẩm. Thêm tệp cấu hình chạy tự động (mục 4). |
| Đã triển khai | Không áp dụng: không đụng d1-ai1. |
| Đã dùng thật | Không áp dụng. |
| Đã nghiệm thu | Không áp dụng. |

## 2. Đối chiếu bản đang chạy trên d1-ai1 với cây mã tại máy

Đo lúc 11/11/2026 tối, chỉ đọc.

- `GET https://libetech.btnet.vn/api/health` → HTTP 200, `version` `0.7.1`, `buildDigest` `325663d35332692b27453e1236e2fef1fe9a40a124af5035ed4455913db0e570`, `schema` 001–012, `storage` `postgresql-server`, `synthetic` false, `sourceSha` null (chưa có commit git để gắn).
- Tính lại digest cây mã tại máy bằng đúng thuật toán của `scripts/package-release.py` (125 tệp, không tạo gói): `325663d35332692b27453e1236e2fef1fe9a40a124af5035ed4455913db0e570`. **Trùng** digest server và digest ghi trong `docs/DELIVERY-008-pilot-onboarding-20261111.md:9`.
- Tập digest có gồm `data/team-tech-catalog-20261111.json`. Nếu Chairman không duyệt commit `data/`, commit sẽ lệch server đúng một tệp đó; biên nhận bản chính sẽ ghi chênh lệch này.
- `docs/SOURCE-MANIFEST.json` và `deploy/BUNDLE-MANIFEST.json` trong repo vẫn là manifest **0.2.0** (83 tệp, `dcc6d124…`). Manifest 0.7.1 chỉ nằm trong gói phát hành trên server. Giữ nguyên khi commit hiện trạng; ghi để không ai dùng nhầm.

## 3. Codex — cổng kiểm độc lập

- `codex-companion.mjs setup --json`: `ready: true`; `codex-cli 0.167.0-alpha.3.2`; đăng nhập ChatGPT còn hiệu lực; `reviewGateEnabled: false` (đúng mục 10.2, không bật cổng lúc dừng).
- `~/.local/bin/codex` → `/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex`. Không cài thêm bản nào qua npm.
- Chạy thử `codex exec --sandbox read-only --output-last-message <tệp> -` với lời nhắc tối thiểu trong thư mục tạm: thoát 0, tệp kết quả được ghi.

## 4. Bộ chạy tự động (mục 10) — commit 2 `10b76ee`

| Tệp | Nội dung |
|---|---|
| `CLAUDE.md` | Một dòng `@AGENTS.md`. |
| `.claude/agents/planner.md` | `model: fable`; brief, kế hoạch lát, OPEN-QUESTIONS; không sửa mã. |
| `.claude/agents/builder.md` | `model: sonnet`; TDD, viết mã/test/migration theo kế hoạch đã chốt. |
| `.claude/agents/scout.md` | `model: haiku`; tìm mã, chạy test, tóm tắt log vào `test-results/` (đã gitignore). |
| `.claude/commands/slice.md` | `/slice <1–5>`: chuỗi 7 bước mục 10.1, cổng Codex tối đa hai vòng sửa, các điểm dừng mục 6. |
| `docs/reviews/CODEX-REVIEW-PROMPT.md` | Lời nhắc review cho Codex: thứ tự kiểm, mức P0–P3, định dạng `tệp:dòng`. |
| `docs/SLICE-BRIEFS.md`, `docs/OPEN-QUESTIONS.md` | Do agent planner (Fable) viết — xem mục 5. |

Ghi chú: Claude Code 2.1.310 nạp ngay ba agent `planner`/`builder`/`scout` và lệnh `slice` trong phiên tạo ra chúng. Brief ở mục 5 được viết trước khi nạp, bởi subagent chạy mô hình `fable` với cùng chỉ dẫn của `planner.md`.

## 4b. Kiểm trên bản sao sạch (trước commit)

Chép đúng 271 tệp ứng viên commit sang thư mục tạm, không kèm `node_modules`, `.next`, `.runtime`, `.data`, `data/`. Đã lặp lại trên clone mới sau khi push (mục 8).

| Lệnh | Mã thoát | Kết quả |
|---|---|---|
| `npm ci --no-audit --no-fund` | 0 | 98 gói |
| `npm run test` | 0 | 7 tệp, 57/57 ca đạt, 23,6 s |
| `npm run typecheck` | 0 | `tsc --noEmit` không lỗi |
| `npm run build` | 0 | Next.js build hoàn tất |
| `python3 -m pytest -q tests/test_bot_bridge.py` | 0 | 11/11 đạt |

## 5. Brief các lát

`docs/SLICE-BRIEFS.md` (313 dòng) và `docs/OPEN-QUESTIONS.md` (21 mục OQ-01…OQ-21). Subagent `fable`, 348.471 token, 31 lượt công cụ, khoảng 12 phút — số đo đầu tiên cho công đoạn «lập brief» ở mục 10.2.

| Phần | Dòng (trần 150) | Dừng tại |
|---|---|---|
| Quy ước chung | 12 | — |
| Lát 1 · P1.0 | 60 | OQ-01, OQ-02, OQ-04 trước migration |
| Lát 2 · P1.1 | 62 | OQ-08…OQ-12 trước mọi mã ghi từ bot |
| Lát 3 · P1.2 | 61 | OQ-14, OQ-15 |
| Lát 4 · P1.3 | 59 | OQ-17, OQ-11, OQ-07 |
| Lát 5 · Vận hành | 55 | OQ-18, OQ-19 (cả lát; bộ ca OPS-01…08 là đề xuất, chưa có hiệu lực) |

Phiên chính đã kiểm lại bốn phát hiện trên mã:
- **OQ-03** — bản bàn giao mục 9 đã cũ: `src/components/workspace.tsx` không còn chuỗi «Chưa nối nền tảng mới», footer là `0.7.1`. `0.3.0` chỉ còn ở `bot-plugin/__init__.py:15`; `bot-plugin/plugin.yaml:2` khai `0.2.1`.
- **OQ-12** — lệnh `/duyet` đã đăng ký ở `bot-plugin/__init__.py:245`; phần chưa có là DM tự động kèm biên nhận giao.
- **OQ-15** — BoM 3/3 (`src/server/bom.ts:101`) và tách `technical_accept`/`business_accept` (`src/server/service.ts:145`) đã có mã.
- **OQ-20** — `scripts/migrate.ts:12` và `src/server/db.ts:11` chạy mọi tệp `^\d+.*\.sql` trong `migrations/`: tệp rollback đặt cùng thư mục, tên bắt đầu bằng số, sẽ bị chạy như migration tiến. 001–012 chưa có rollback.

Giới hạn planner tự khai: phân bổ DOC-01…18 vào lát là phán đoán (SPEC-009 không gán); vài khoảng dòng chỉ kiểm đầu–cuối; SPEC-004 và SPEC-003 có dòng dài chưa đọc hết đuôi; không đọc `intake.py`/`lanes.py` của plugin priority1.

## 6. Điểm dừng đã trình và quyết định của Chairman (12/11/2026)

| # | Điểm | Quyết định |
|---|---|---|
| 1 | Repo đích là PUBLIC | **Push nguyên trạng lên public.** Chairman chọn sau khi được trình danh mục nội dung nhạy cảm bên dưới; phương án «đổi sang Private» được đề xuất nhưng không chọn. |
| 2 | `data/` | **Không commit, thêm vào `.gitignore`.** |
| 3 | `libe-tech` | **Chưa push; đối chiếu bản đang chạy trên gateway trước.** |

Trước khi push, quét thêm bên trong 7 tệp nén/docx (260 tệp giải nén, kể cả zip lồng): 0 token Telegram/GitHub/OpenAI/Anthropic/AWS/Slack, 0 khoá riêng, 0 JWT, 0 chuỗi kết nối DB có mật khẩu, 0 liên kết lời mời. Một điểm trùng mẫu `PGPASSWORD` ở `deploy/libetech-os-verify-runtime-20261108.py:18` là đọc mật khẩu từ biến lúc chạy, không phải giá trị.

Nội dung đã trình khi xin quyết định:

1. **Repo đích `liberico-ai/ai-together` là PUBLIC.** Bản bàn giao không nêu mức hiển thị. Tập ứng viên commit (271 tệp) gồm 136 tệp `docs/` có: biên bản nghiệm thu và ảnh UAT LBRC014 (mã khách hàng, danh sách khách), số điện thoại, địa chỉ Gmail, tên và vai trò thành viên team, hostname/IP nội bộ (`10.10.1.26`, `192.168.17.10`), tenant UUID, sơ đồ tuyến đầu vào. Quét bí mật: 0 token/khoá; hai chuỗi kết nối DB chỉ là mẫu nội suy biến. Push lên repo công khai là công bố nội dung này.
2. **`data/team-tech-catalog-20261111.json`** (15,6 KB): ảnh chụp sheet «Đầu việc Tech» A1:H46 (Google Sheet, đọc 11/11 05:21Z, `quality_score` 0.5), 45 dòng việc với BU, người phụ trách, phối hợp, trạng thái, hạn, ghi chú; danh sách 17 platform (13 LBRC, 4 IBS HI). Không có cột tài khoản/mật khẩu (đã loại theo ghi chú nguồn). Chỉ `scripts/import-team-tech-catalog.ts` đọc tệp này; test và build không phụ thuộc.
3. **Repo `libe-tech` — tiền đề bản bàn giao đã cũ.** `origin/main` không còn chứa `055c270`: lịch sử trên GitHub đã khởi tạo lại (`6398a1e` 07/11 «Initialize LibeTech bot source with scoped GitHub reads», `a08b63c` 08/11 «Release LibeTech 1.1.4»). Bản trên GitHub là bản đã lược: `plugin/registry.json` là mẫu rỗng `UNCONFIGURED_TEMPLATE`, bỏ các runbook, thư mục `profile/`, script cài đặt. Thư mục máy cũ hơn (tệp sửa cuối 07/11 21:56) và chứa danh bạ người thật trong `registry.json` (+2.281 dòng). Commit «30 thay đổi» lên `055c270` rồi push sẽ không fast-forward được, và nếu ép sẽ đưa lại dữ liệu nội bộ mà bản 1.1.4 đã lược.

### Phụ lục A — 30 mục đang treo trong `libe-tech` (so với `055c270` và `origin/main` `a08b63c`)

Đường dẫn tính từ `hermes-libetech-priority1/`. «Remote»: `same` = trùng byte với `a08b63c`; `diff` = khác; `absent` = `a08b63c` không có. «PII» = số dòng khớp mẫu email/số điện thoại/Telegram id.

| Git | Remote | PII | Tệp |
|---|---|---|---|
| M | absent | 0 | `DEPLOYMENT-1.1.0-RUNBOOK.md` |
| M | same | 0 | `build_bundle.py` |
| M | diff | 0 | `plugin/__init__.py` |
| M | diff | 0 | `plugin/core.py` |
| M | diff | 0 | `plugin/lanes.py` |
| M | same | 0 | `plugin/plugin.yaml` (1.1.4) |
| M | diff | 15 | `plugin/registry.json` — danh bạ người/sản phẩm/repo thật; remote là mẫu rỗng |
| M | diff | 0 | `plugin/sheets.py` |
| M | diff | 0 | `plugin/state.py` |
| M | absent | 0 | `profile/skills/libetech-viec/SKILL.md` |
| M | diff | 2 | `tests/test_core.py` |
| M | diff | 0 | `tests/test_customer_scope.py` |
| ?? | absent | 0 | `.DS_Store` (bỏ, không commit) |
| ?? | absent | 0 | 13 tài liệu: `DELIVERY-VERIFICATION-20261106-1459.md`, `DEPLOYMENT-1.1.1-RECEIPT.json`, `DEPLOYMENT-1.1.1-VERIFICATION-20261105.json`, `DEPLOYMENT-1.1.2-VERIFICATION-20261106.json`, `DOC-CONTRACT-PROPOSAL-20261106.md`, `PM-CAPABILITY-RESEARCH-20261106.md`, `PM-DESIGN-REVIEW-20261107.md`, `PM-LITE-DESIGN-CRITIQUE-20261107.md`, `PM-LITE-PILOT-20261107.md`, `PM-UPGRADE-SPEC-20261106.md`, `RELEASE-REVIEW-20261106.md`, `VAULT-FACTORY-PM-DESIGN-20261106.md`, `WEEKLY-AUTO-VERIFICATION-20261106.md` |
| ?? | absent | 0 | `proposed-skills/libetech-pm/` (2 tệp) |
| ?? | 3 same, 1 diff | 0 | `scripts/` (`libetech-ticket-due.py`, `libetech-ticket-weekly.py`, `libetech_pm_brief.py` trùng; `libetech_ticket_report.py` khác; kèm `__pycache__` bỏ) |
| ?? | same | 0 | `tests/test_ticket_reports.py` |
| ?? | diff | 0 | `tests/test_workbook_writer.py` |

Ngoài 30 mục trên, thư mục máy còn nhiều tệp đã track ở `055c270` mà `a08b63c` đã bỏ (runbook 1.0.2, `DEPLOYMENT*.md`, `ROLLBACK.md`, `README.md` cấp plugin, `build_*`/`install_*`/`customer_data_cleanup.py`, `profile/SOUL.md`, `tests/test_install_lanes_intake.py`). Không xác định được tại máy bản nào đang chạy trên gateway: cả hai đều khai `version: "1.1.4"`.

## 7. Git và GitHub

| Mục | Giá trị |
|---|---|
| Tag `aitogether-legacy-final` | tag có chú thích `be00a13535106ae7fc8c33820d196490bc3b1d1e` → commit `d23e5168087084a5ef5e4e283de6e745f45573cb` (`main` lúc 12/11) |
| Commit 1 `b91f219` | `chore(repo): import LibeTech AI OS 0.7.1 as running on d1-ai1` — 271 tệp, cha là `d23e516` để giữ dòng kế thừa AiTogether → AI OS. `.gitignore` giữ nguyên byte của bản phát hành; loại trừ bằng `.git/info/exclude`. |
| Commit 2 `10b76ee` | `chore(repo): add Step 0 automation, Claude Code entrypoint and slice briefs` — `CLAUDE.md`, `.claude/`, `docs/SLICE-BRIEFS.md`, `docs/OPEN-QUESTIONS.md`, `docs/reviews/`, bổ sung `.gitignore` (gồm `data/`; `dist/`/`build/` giới hạn ở gốc để không che `dashboard-plugin/dashboard/dist/` đang được track). |
| Commit 3 | Biên nhận này. |
| `main` trên GitHub | không đổi, `d23e516`; nhánh mặc định vẫn `main`. |

Đối chiếu digest sau commit: xuất `b91f219` bằng `git archive` → digest tập phát hành `746832aa99b1b0d4c14e98ed44e5b8e0eb7d7b0ef47b9de2406ace538fd392fc` (124 tệp). Thêm đúng `data/team-tech-catalog-20261111.json` → `325663d35332692b27453e1236e2fef1fe9a40a124af5035ed4455913db0e570` (125 tệp) = `buildDigest` của server. **Chênh lệch commit ↔ server: đúng một tệp, `data/team-tech-catalog-20261111.json`, theo quyết định 6.2.**

Ghi chú vận hành: hook `check-git-push.js` trên máy chặn lần push đầu vì chữ `main` nằm trong thông điệp tag cùng dòng lệnh `git push`. Lệnh chưa chạy; tách tạo tag và push thành hai lệnh, refspec chỉ gồm `libetech-ai-os` và tag.

## 8. Kiểm trên clone mới từ GitHub

`git clone --branch libetech-ai-os --single-branch https://github.com/liberico-ai/ai-together.git` vào thư mục tạm trống, ngày 12/11/2026. HEAD `10b76ee1cda94bb473340f9b6c554b9aff6a9df1`, 279 tệp, `git status` sạch trước và sau build.

| Lệnh | Mã thoát | Kết quả |
|---|---|---|
| `npm ci --no-audit --no-fund` | 0 | 98 gói, 3 s |
| `npm run test` | 0 | Test Files 7 passed (7) · Tests 57 passed (57) · 23,68 s |
| `npm run typecheck` | 0 | `tsc --noEmit` không lỗi |
| `npm run build` | 0 | `✓ Compiled successfully`; 4 trang tĩnh; 25 route động gồm `/api/health`, `/api/bridge`, `/api/team/*`, `/approvals`, `/bom`, `/team` |
| `python3 -m pytest -q tests/test_bot_bridge.py` | 0 | 11 passed |

## 9. Còn mở

- ~~Chỉ đổi nhánh mặc định hoặc merge vào `main` khi Quân xác nhận lab…~~ Thay bằng quyết định Chairman 12/11 (mục 10).
- ~~`libe-tech`: đối chiếu bản plugin đang chạy trên gateway…~~ Đã đối chiếu (mục 10).
- Health trả `sourceSha: null`. Lần triển khai sau có thể đặt `SOURCE_SHA` bằng SHA commit để server tự khai bản đang chạy; việc này là triển khai, cần Chairman duyệt.
- 21 câu hỏi mở trong `docs/OPEN-QUESTIONS.md`; lát 1 dừng trước migration tại OQ-01 (ADR-002 chưa ký), OQ-02, OQ-04.

## 10. Bổ sung 12/11/2026 — nhánh `main` của ai-together và repo `libe-tech`

### 10.1 Máy lab 192.168.17.10 và nhánh `main`

- **Cơ chế cập nhật lab (#fact, đọc repo):** `main` cũ có `.github/workflows/deploy.yml` «Deploy Libe Aios», chạy khi push vào `main`. Workflow build image `ghcr.io/liberico-ai/ai-together` rồi POST webhook ký HMAC tới `vars.LAB_WEBHOOK_URL`. Lần chạy gần nhất 01/07/2026 triển khai `d23e516`. Lần push nhánh `libetech-ai-os` ngày 12/11 không kích hoạt run nào (cây `libetech-ai-os` không còn thư mục `.github/`).
- **Hồ sơ Codex (#fact, 89 phiên có nhắc 192.168.17.10):** không phiên nào triển khai lên 192.168.17.10. Đó là máy Nginx chạy AiTogether cũ ở cổng 7060, nằm ở trung tâm dữ liệu khác d1-ai1 và không có đường tới («Không thông đâu ạ. 2 DC khác nhau», phiên 08–09/11). Codex triển khai AI OS lên d1-ai1 qua terminal của Hermes dashboard, theo thư mục release, không qua GitHub.
- **Quyết định Chairman 12/11:** «Giữ main của ai-together cho lab, làm và review AI OS trên nhánh libetech-ai-os, phát hành d1-ai1 theo tuyến riêng.» Không đổi nhánh mặc định, không merge vào `main`.

### 10.2 Repo `libe-tech`

- **Bản đang chạy trên gateway (#fact):** `dist/deploy-checks-1.1.4-20261107/installed-readback-20261108.json` (cài 08/11 01:32Z, gói `85add82a…c842f`). Cả 9 tệp plugin đã cài trùng hash với **cây trên máy**: `__init__.py`, `core.py`, `guard.py`, `intake.py`, `lanes.py`, `plugin.yaml`, `registry.json` (`0161a700…`), `sheets.py`, `state.py`. `origin/main` `a08b63c` khác ở 7/9 tệp.
- **Bản chất chênh lệch:** `6398a1e`/`a08b63c` do Codex tạo từ một root sạch, chủ ý giữ cấu hình thật ngoài GitHub. Trên GitHub, chat ID, mã workbook, tên người, đường dẫn và host server được thay bằng biến môi trường/placeholder; `registry.json` là mẫu `UNCONFIGURED_TEMPLATE`. Logic giống nhau; bản GitHub còn thêm chốt `WORKBOOK_SOURCE_NOT_CONFIGURED` và test cho chốt đó.
- **Quyết định Chairman 12/11:** «giữ cây gateway làm bằng chứng, chuyển có chọn lọc phần mã an toàn lên từ origin/main; không push nguyên 30 thay đổi.»
- **Kết quả chọn lọc: không có tệp mã nào cần chuyển.** Mọi tệp mã/test có ở cả hai bên chỉ khác ở phần lược cấu hình. Bảy tệp chỉ có ở cây gateway (`build_customer_scope.py`, `build_lanes_intake.py`, `install_customer_scope.py`, `install_identity_fix.py`, `install_lanes_intake.py`, `customer_data_cleanup.py`, `tests/test_install_lanes_intake.py`) là bộ cài một lần cho bản 1.0.1→1.0.2 và 1.1.0. Chúng chốt theo hash trạng thái cũ, viết cứng đường dẫn hồ sơ và chat ID; riêng `customer_data_cleanup.py` xoá dữ liệu trên hồ sơ đang chạy. `origin/main` không tham chiếu tệp nào trong số đó. Tài liệu, `profile/` và `registry.json` mang dữ liệu riêng. **Không push gì lên `libe-tech`.**
- **Bằng chứng giữ lại:** cây máy không đổi (`git status` vẫn 30 mục). Manifest hash `hermes-libetech-priority1/dist/gateway-tree-evidence-20261112.json` (thư mục đã gitignore, cạnh biên nhận cũ): 54 tệp, tree `bd8e6358ac75690e0ed36baec5b3899a0fb1286ef4411fcb955e03abc2675e2d`, tệp manifest `d024677e0bb52d48ca6d27836dc6c412dcacd154e7168fc9311b6be2491e53c8`. Readback là ngày 08/11; không đọc lại gateway trong lượt này.
- **Việc về sau (cần duyệt riêng, là điểm dừng):** muốn mã đang chạy trùng GitHub thì cài bản `origin/main` lên gateway với cấu hình đưa ra biến môi trường/registry riêng. Việc này phải khởi động lại gateway chung.
