# Bàn giao cho Claude Code — LibeTech AI OS, lập trình phần còn lại theo roadmap

**Version:** 1.3 · 2026-11-11 · Chairman duyệt nội dung 1.0 lúc 20:20 ngày 11/11/2026 («Dùng bản sửa. Lát P2 Dev Factory để sau»). Bản 1.1 thêm mục 10 (chạy tự động, mô hình theo công đoạn, cổng phản biện) theo yêu cầu lúc 20:25, và sửa mục 4, 7, 8 cho khớp. Bản 1.2 (20:35): ghi kết quả kiểm Codex trên máy và giao công đoạn lập kế hoạch cho Fable. Bản 1.3 (20:34): Codex đã nối xong.
**Dạng việc:** BUILD — lập trình theo đặc tả đã có, từng lát một. Không thiết kế lại.
**Người viết mã:** Claude Code. **Người kiểm độc lập:** Codex (bên viết không tự chấm). **Người duyệt triển khai:** Chairman.

---

## 1. Đối tượng

| Thành phần | Vị trí | Hiện trạng |
|---|---|---|
| Nền web LibeTech AI OS | `/Users/huyenleduy/Documents/GitHub/libetech-ai-os` | Next.js App Router + PostgreSQL, bản 0.7.1 đang chạy trên d1-ai1 tại `https://libetech.btnet.vn`. Migration tới 012. **Thư mục chưa có git.** |
| Plugin bot AiTogether | `/Users/huyenleduy/Documents/GitHub/libe-tech/hermes-libetech-priority1` | Bản 1.1.4. Repo `libe-tech` còn 30 thay đổi chưa commit, commit cuối `055c270` (02/11). |
| Repo đích trên GitHub | `liberico-ai/ai-together` | Repo AiTogether cũ; AI OS là bản kế thừa. |

## 2. Để làm gì

Nền tảng quản lý dự án Dev và vận hành các platform của LibeTech theo đúng thiết kế đã có. Bot AiTogether là cửa tiếp nhận và trợ lý PM/BA. AI OS giữ trạng thái chính thức, quyền, bằng chứng và dashboard.

## 3. Căn cứ — đọc trước khi viết dòng mã nào

1. `AGENTS.md` của repo và skill `liberico-coding-rules` (`/Users/huyenleduy/.agents/skills/liberico-coding-rules/SKILL.md`); các mã AR-xx / E-xx liên quan.
2. `docs/IMPLEMENTATION-ROADMAP.md` — thứ tự hiện hành P1.0 → P1.3.
3. `docs/SPEC-001` … `SPEC-009`, `docs/ADR-001-foundation.md`. `docs/ADR-002-project-document-ownership.md` đang ở trạng thái Proposed, **chưa ký**.
4. `docs/PM-DOCUMENT-TEMPLATES.md` (mẫu T0–T6), `docs/DESIGN-SYSTEM-PM-DOCUMENTS.md`.
5. Bộ ca kiểm: DOC-01…18 trong SPEC-009; 8 ca trong SPEC-008.
6. Biên nhận gần nhất: `docs/DELIVERY-007-team-catalog-20261111.md`, `docs/DELIVERY-008-pilot-onboarding-20261111.md`.

Chỗ nào các SPEC mâu thuẫn nhau hoặc thiếu: ghi vào `docs/OPEN-QUESTIONS.md` và dừng lát đó. Không tự chọn.

## 4. Bước 0 — điều kiện tiên quyết, làm trước mọi mã mới

`AGENTS.md` ghi việc push repo cần phạm vi cụ thể riêng. Phạm vi được duyệt là đúng các dòng dưới đây, không rộng hơn.

- **Repo đích:** `liberico-ai/ai-together`.
  - Không ghi đè `main`. Gắn tag `aitogether-legacy-final` vào commit `main` hiện tại.
  - Đưa mã `libetech-ai-os` lên nhánh mới `libetech-ai-os`, commit đúng hiện trạng đang chạy 0.7.1.
  - Không commit: `.env*`, khoá, token, tệp lời mời, `node_modules`, `coverage`, `.next`, `tsconfig.tsbuildinfo`, `tests/__pycache__`. Thư mục `data/` có danh mục việc thật của team: liệt kê nội dung và chờ Chairman duyệt trước khi commit.
  - Chỉ đổi nhánh mặc định hoặc merge vào `main` khi Quân xác nhận máy lab 192.168.17.10 (đang chạy mã ai-together cũ, cổng 7060) không tự kéo `main`, và Chairman duyệt.
- Thêm `CLAUDE.md` ở gốc repo, một dòng `@AGENTS.md`, để Claude Code nạp đúng luật của repo.
- Đối chiếu bản dựng 0.7.1 trên d1-ai1 với commit vừa tạo. Ghi chênh lệch nếu có vào biên nhận.
- Repo `libe-tech`: lập danh sách 30 thay đổi đang treo, trình Chairman duyệt danh sách tệp, rồi mới commit và push.
- Dựng bộ chạy tự động theo mục 10: `.claude/agents/planner.md`, `builder.md`, `scout.md` (mỗi tệp khai `model:`), `.claude/commands/slice.md`, và `docs/SLICE-BRIEFS.md` (mỗi lát một brief không quá 150 dòng, có con trỏ tệp:dòng về SPEC).
- Codex: kiểm lúc 20:32 ngày 11/11, plugin Codex của Claude Code báo `ready: false` vì không thấy lệnh `codex` trong PATH. Máy đã có Codex CLI 0.167.0-alpha kèm ứng dụng ChatGPT tại `/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex`, đang đăng nhập bằng ChatGPT. **Đã nối lúc 20:33 ngày 11/11** (Chairman duyệt): liên kết `~/.local/bin/codex` trỏ tới tệp đó; plugin báo `ready: true`, đăng nhập ChatGPT còn hiệu lực. Bước 0 chỉ cần chạy lại `/codex:setup` để xác nhận; nếu ứng dụng ChatGPT cập nhật làm liên kết hỏng thì báo Chairman, không tự cài bản Codex thứ hai qua npm.

**Đạt khi:** nhánh `libetech-ai-os` có trên GitHub; `git status` sạch; `npm run test`, `npm run typecheck`, `npm run build` chạy xanh từ bản clone mới; biên nhận `DELIVERY-009` ghi SHA commit và kết quả đối chiếu với server.

## 5. Các lát — mỗi lát một nhánh, một PR, một biên nhận `DELIVERY-0xx`

| Lát | Nội dung | Ca kiểm chính |
|---|---|---|
| **1 · P1.0** | Sổ dự án; ánh xạ nhóm Telegram → dự án; sổ tài liệu (nguồn chính, revision/hash, bản nháp và bản đã duyệt tách riêng); mẫu T0–T6 | XECA006 và LBRC014 có nguồn, bản nháp và bản chuẩn riêng; kiểm quyền âm qua tìm kiếm, mở tệp, xuất tệp |
| **2 · P1.1** | Tiếp nhận từ nhóm đã cấp quyền: inbox/outbox, lưu trước khi báo nhận, khử trùng khi tin bị sửa hoặc gửi lại, biên nhận gửi đúng nhóm. Phần còn thiếu của SPEC-007: bot tự gửi tin riêng mời duyệt tài khoản, nút Yes/No trên Telegram | Tin thường, tin trả lời, tệp, topic đều được lưu; gửi lại không tạo trùng |
| **3 · P1.2** | Sáu kỹ năng PM/BA; review đúng revision; chia lại việc cần BoM Tech 3/3 có biên nhận; tách ba sự kiện: đóng ticket · chấp nhận kỹ thuật · nghiệm thu nghiệp vụ | Tự nghiệm thu bị chặn; 2/3 chưa áp dụng, 3/3 áp dụng đúng một lần |
| **4 · P1.3** | Chia sẻ bản đã duyệt; tra tài liệu; dashboard dự án và nhân sự truy được về bằng chứng | Thu hồi quyền chặn cả hàng chờ và cache; dữ liệu thiếu không biến thành điểm thấp |
| **5 · Vận hành platform** | Sự cố, change request, release, quan sát SHA đang chạy (mong muốn so với thực tế), bảo trì, runbook, sổ backup | Có thử rollback và khôi phục; thông báo đúng nhóm |

**Để sau, không làm trong đợt này:**
- **P2 — kết nối Dev Factory** (Chairman quyết 11/11: để sau).
- Gói điều hành mở rộng của SPEC-008 (tải công việc, khám phá sản phẩm, chi phí dịch vụ) và Score nhân sự: chỉ làm khi BoM Tech chọn sau pilot.

Thứ tự là 1 → 5. Không mở lát sau khi lát trước chưa có biên nhận đạt.

## 6. Phạm vi

**Được đụng:** mã, test, migration mới (đánh số tiếp từ 013), tài liệu trong repo.

**Không được:**
- Sửa bảng việc của Phương hoặc dữ liệu, cập nhật của team.
- Đọc hoặc ghi cơ sở dữ liệu của nền khác (BTNET Core/Lilog và các nền còn lại).
- Tính điểm dùng cho KPI hoặc lương; tự nghiệm thu; tự cấp quyền; tự gửi tin vào nhóm thật.
- Đưa mật khẩu, khoá API, token vào mã, tài liệu, commit hoặc lời nhắc.
- Cộng gộp dữ liệu giữa các thực thể. Dashboard và báo cáo tách theo Liberico BU · Xeca · IBS HI. IBS HI là pháp nhân ngoài Liberico: chỉ lưu con trỏ, hash và metadata việc Tech.

**Dừng và chờ Chairman duyệt từng đợt** trước khi: triển khai lên d1-ai1, áp migration trên dữ liệu thật, khởi động lại gateway chung (khoảng 20 bot). Kế hoạch trình duyệt phải có bản sao lưu đã thử phục hồi, cách rollback, danh sách bot bị ảnh hưởng, và tránh khung giờ lịch tự động 08:30 ngày làm việc và 16:00 thứ Sáu.

## 7. Đạt khi — áp cho mỗi lát

- `npm run test`, `npm run typecheck`, `npm run build` xanh; kèm output lệnh trong biên nhận. Test Python của cầu nối bot (`tests/test_bot_bridge.py`) xanh nếu lát có chạm bot.
- Các ca của lát (DOC-xx, ca SPEC-008) được chuyển thành test tự động và đạt.
- Có ca kiểm quyền âm: nhóm khách đọc chéo dự án hoặc BU bị chặn; người làm không tự nghiệm thu; tin gửi lại không tạo việc trùng.
- Giao diện có đủ trạng thái rỗng, lỗi, đang tải, không có quyền; dùng được trên điện thoại.
- Biên nhận ghi riêng bốn mức: đã có mã · đã triển khai · đã dùng thật · đã nghiệm thu. Không gọi mức sau khi mới đạt mức trước.
- Qua đủ hai tầng phản biện ở mục 10.3; không còn finding P0/P1 của Codex chưa xử lý trước khi merge.

## 8. Đầu ra mỗi lát

1. PR vào nhánh `libetech-ai-os` và biên nhận `docs/DELIVERY-0xx-<tên>-<ngày>.md`.
2. Đặc tả bàn giao giao diện cho màn hình mới, viết theo sáu mục của `design:design-handoff`: bố cục, token, props thành phần, trạng thái, breakpoint, edge case. Skill này không cài trong Claude Code trên máy, nên viết tay theo sáu mục đó vào `docs/`.
3. Cập nhật `docs/IMPLEMENTATION-ROADMAP.md`.
4. Báo Chairman năm dòng: làm gì, bằng chứng, còn thiếu gì, cần quyết gì.

## 9. Việc đang mở, Claude Code cần biết nhưng không tự xử lý

- ADR-002 chưa ký. Lát 1 dựa trên ADR này; nếu tới lúc cần mà chưa ký, ghi vào `OPEN-QUESTIONS.md` và hỏi.
- Bảy tài khoản pilot tạo ngày 11/11 chưa kích hoạt; lời mời hết hạn khoảng 14:56 ngày 12/11. Việc gửi lời mời do Chairman làm.
- Giao diện còn nhãn cũ «Bot LibeTech · Chưa nối nền tảng mới» và footer `0.3.0` trong `src/components/workspace.tsx`: sửa trong lát 1.
- Tin nhắn gốc của ca Xeca (XECA005, XECA006) chưa được đối chiếu; không coi ca kiểm đạt khi chưa có tin gốc.

## 10. Chạy tự động: skill, mô hình theo công đoạn, cổng phản biện

Kiểm trên máy lúc 20:30 ngày 11/11: Claude Code 2.1.310. Plugin đang bật: `superpowers` 7.0.0, `codex@openai-codex` 1.0.6, `feature-dev`, `code-review`, `commit-commands`, `security-guidance`, `context7`, `typescript-lsp`. Có năm agent `liberico-*` trong `~/.claude/agents` (chưa khai `model:`, nên chạy theo mô hình của phiên) và skill `liberico-coding-rules`.

### 10.1 Một lệnh cho mỗi lát

Bước 0 tạo lệnh `/slice <số lát>`. Lệnh chạy chuỗi cố định sau, dừng khi gặp câu hỏi mở hoặc điểm cần Chairman duyệt:

1. Đọc brief của lát trong `docs/SLICE-BRIEFS.md`. Không nạp lại toàn bộ SPEC.
2. `superpowers:writing-plans` → kế hoạch lát, lưu `docs/plans/`.
3. `superpowers:test-driven-development` và `superpowers:subagent-driven-development`: ca kiểm viết trước, mã viết sau, mỗi task một subagent.
4. `superpowers:verification-before-completion`: chạy test, typecheck, build và ghi output.
5. Reviewer nội bộ, chỉ gọi cái liên quan (mục 10.3, tầng 1).
6. Cổng Codex (mục 10.3, tầng 2). Tối đa hai vòng sửa; chưa hội tụ thì dừng và hỏi Chairman.
7. `/commit-commands:commit-push-pr` tạo PR; viết biên nhận; cập nhật roadmap; báo năm dòng.

### 10.2 Mô hình theo công đoạn

Phân bổ dưới đây là đề xuất, chưa đo. Sau lát 1, ghi số token theo công đoạn vào biên nhận rồi chỉnh.

| Công đoạn | Mô hình | Cách đặt |
|---|---|---|
| Lập brief các lát (một lần), kế hoạch lát, xử lý mâu thuẫn SPEC, lỗi khó sau hai vòng sửa không xong | Fable 5.2 | agent `planner`, `model: fable`; nếu Claude Code không nhận tên này thì dùng `claude-fable-5-2`; tài khoản không có Fable thì lùi về `opus` và ghi vào biên nhận |
| Điều phối phiên; viết mã, test, migration theo kế hoạch đã chốt | Sonnet | phiên chính và agent `builder`, `model: sonnet` |
| Tìm mã, chạy test và tóm tắt log, điền biên nhận theo mẫu | Haiku | agent `scout`, `model: haiku` |
| Review nội bộ (`liberico-*`) | Sonnet | chạy theo mô hình phiên chính |
| Kiểm độc lập trước merge | Codex | không dùng token Claude |

Quy tắc giữ token thấp:
- Một lát một phiên; `/clear` giữa các lát. Trạng thái nằm trong tệp (`docs/plans/`, biên nhận, `OPEN-QUESTIONS.md`), không nằm trong hội thoại.
- SPEC-008 (62 KB) và SPEC-009 (29 KB) không nạp nguyên văn vào phiên chính; chỉ đọc brief và đoạn được trỏ tới.
- Tìm mã và chạy test giao cho `scout`; phiên chính chỉ nhận tóm tắt và đường dẫn log.
- Reviewer gọi theo điều kiện; Codex một lần cho mỗi PR.
- Không bật cổng review lúc dừng của plugin Codex (`/codex:setup --enable-review-gate`); dùng cổng theo PR.

### 10.3 Cổng phản biện — hai tầng

**Tầng 1 — reviewer nội bộ.** Cùng họ mô hình với bên viết nên không tính là kiểm độc lập; dùng để bắt lỗi sớm.
- `liberico-code-reviewer`: mọi PR.
- `liberico-database-reviewer`: PR có migration hoặc đổi truy vấn.
- `liberico-security-reviewer`: PR đụng quyền, phiên đăng nhập, cầu nối bot.
- `liberico-reality-checker`: trước khi biên nhận ghi «đạt».

**Tầng 2 — Codex, bắt buộc trước merge.**
- Tự động trong `/slice`: gọi Codex ở chế độ chỉ đọc qua Bash, đầu vào là diff của nhánh so với `libetech-ai-os` và một tệp lời nhắc review; kết quả lưu `docs/reviews/REVIEW-<lát>.md`. Dạng lệnh: `codex exec --sandbox read-only --output-last-message <tệp kết quả> -` (dùng lệnh `codex` đã nối ở Bước 0).
- Gõ tay khi cần: `/codex:adversarial-review --background --base libetech-ai-os --scope branch`. Hai lệnh `/codex:review` và `/codex:adversarial-review` khai `disable-model-invocation: true`, nên Claude Code không tự gọi được; người dùng phải gõ.
- Codex chỉ review, không sửa. Mỗi finding có tệp:dòng và mức độ.

Căn cứ: sổ phân vai Hệ A (`HE-A-ACTOR-REGISTRY-v1.md`, version 1.7, §1.7) quy định bên viết không tự chấm và phần đánh giá mã thuộc Codex. Sổ này xếp việc vá mã cho Antigravity hoặc Codex; ở đây Chairman chọn Claude Code làm bên viết, nên bên chấm phải là Codex. Chairman là người duyệt triển khai.
