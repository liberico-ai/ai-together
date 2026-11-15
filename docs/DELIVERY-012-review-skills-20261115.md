# Lát 3 · P1.2 — Sáu kỹ năng PM/BA, review đúng revision, 3/3, ba sự kiện tách riêng · 15/11/2026

## Bốn mức — ghi riêng, không gọi mức sau khi mới đạt mức trước

| Mức | Trạng thái | Căn cứ |
|---|---|---|
| **Đã có mã** | **Đạt điều kiện của lát ở mã `ee990b4`** — nhánh `slice-3-review-skills`, PR [#12](https://github.com/liberico-ai/ai-together/pull/12), **chưa merge**. Điều kiện gồm: test trên hai động cơ, coverage, pytest, typecheck và build xanh với mã thoát 0 ở đúng mã đó; các ca nghiệm thu của brief có test tự động và đạt; **không còn finding P0/P1 của Codex chưa xử lý**. **Verdict của Codex ở vòng 3 vẫn là CHANGES_REQUIRED, với một finding mức P2 chưa sửa** (danh sách người nhận xét, khoảng trống 39) — **chưa phải PASS**; sửa mục đó và chạy cổng thêm một lượt chờ Chairman quyết. Đường tới đây: ba vòng Codex, hai vòng sửa (hết số vòng được phép). `liberico-reality-checker` soát biên nhận này hai lượt: lượt đầu NEEDS WORK với hai mục chặn về lời văn (thiếu ghi chú về login vận hành; một con trỏ tới sai tệp), đã sửa; lượt soát lại: READY cho mức «đã có mã» đúng như câu chữ ở đây ([reality-check.md](reviews/slice-3-evidence-20261115/gates/reality-check.md)). | Mục «Bằng chứng kiểm», «Review hai tầng» |
| Đã triển khai | **Chưa.** Không triển khai d1-ai1; migration 019–021 chưa áp lên CSDL thật nào; không cài plugin; không khởi động lại gateway | Điểm dừng Chairman |
| Đã dùng thật | **Chưa.** Chưa nối mô hình, Z4 chưa bật, không có login hay khoá nào cho role AI. Eval chạy với đầu ra giả lập. Thao tác duyệt chỉ chạy trên dữ liệu tổng hợp; chưa có bản chuẩn thật nào được duyệt | — |
| Đã nghiệm thu | **Chưa.** PM-02 «chờ tin gốc»: chưa có tin gốc và chủ dự án xác nhận. Chưa có chữ ký nghiệm thu | — |

Mức «đã có mã» chỉ nói mã khớp test trên dữ liệu tổng hợp. Ba mức dưới đều **chưa**.

## Căn cứ và quyết định

- Chairman 15/11/2026, nguyên văn: «Mở lát 3» (phiên điều phối chuyển lời).
- Brief: `docs/SLICE-BRIEFS.md:155-215`. Kế hoạch: `docs/plans/slice-3-review-skills.md` (bản 0.7), do `planner` lập; phán quyết S1–S86 của phiên lát 3 nằm trong đó.
- Quyết định đã áp theo brief: OQ-06, OQ-07, OQ-13, OQ-14 (c), OQ-15 (a), OQ-16 (c), OQ-20, OQ-21.
- **Quyết định của Chairman ngày 15/11/2026**, chọn qua hộp chọn ở phiên điều phối. Câu hỏi và đủ các phương án Chairman thấy chép nguyên văn ở hai nơi: câu hỏi về thứ tự cùng hai nút «Giữ task đầu» và «PR riêng trước» ở `docs/plans/slice-3-review-skills.md:23`; các câu hỏi OQ-31…OQ-42 và câu hỏi về Task 7c ở `docs/OPEN-QUESTIONS.md`. Dưới đây là nhãn phương án đã chọn:
  - Thứ tự: câu hỏi «Giữ việc tách luật hiển thị làm task đầu của lát 3 chứ?», trả lời «Giữ task đầu». Chỉ quyết thứ tự.
  - **OQ-31** — «(b) Manager + phiếu BoM»; phần kèm: «Giữ cả hai (Recommended)».
  - **OQ-32** — «(c) Chỉ thẻ trên web (Recommended)».
  - **OQ-33** — «(b) Thêm đường cho manager».
  - **OQ-34** — «(a) Mọi manager dự án (Recommended)».
  - **OQ-35** — «(a) Người trình không bỏ phiếu (Recommended)».
  - **Task 7c** — «Tách PR riêng sau lát 3 (Recommended)».
  - **OQ-36** — «(b) cùng (d) (Recommended)». **OQ-37** — «(c) Áp được, phải nêu rõ». **OQ-38** — «(c) Được, phiếu nêu rõ (Recommended)».
  - **OQ-39** — «(c) Hiệu lực, nêu rõ (Recommended)». **OQ-40** — «(c) Ngủ, có đánh dấu (Recommended)». **OQ-41** — «(c) Điều phối và đương sự (Recommended)». **OQ-42** — «(a) Luật cấp tài khoản (Recommended)».
- **Chưa quyết** (mã đang theo «Hành vi hiện tại» ghi ở từng mục, không phải phương án được chọn): OQ-43, OQ-44, OQ-45, OQ-46 — xem mục «Câu hỏi mở».
- Không sửa `AGENTS.md`, `CLAUDE.md`. Dòng Z4 ở `AGENTS.md:11` là việc của Chairman sau lát này; đề nghị thêm cùng lúc một dòng khai thư mục `skills/` và schema `intelligence` (reviewer mã tầng 1 nêu).

## Đã làm

| Việc brief | Kết quả | Tệp chính |
|---|---|---|
| 0 Luật hiển thị chữ của tin (task đầu, theo quyết định thứ tự) | Một mô-đun duy nhất đọc chữ của bản sửa tin Telegram; luật nằm trong SQL nên chữ và hash đang ẩn hoặc chỉ con trỏ không tới Node. Inbox của lát 2 đọc qua mô-đun này | `src/server/source-text.ts` |
| 1 Sáu kỹ năng | Hợp đồng vào (`SkillContext`), sáu hợp đồng ra, cổng kiểm đầu ra (`checkSkillOutput`); ngữ cảnh dựng đúng quyền của người yêu cầu, một dự án, dự án `IBS_HI` chỉ con trỏ; sáu manifest (tên, version, hash, allowlist công cụ rỗng, phạm vi dữ liệu, owner giữ chỗ «BoM Tech», `modelBinding: none`, `enabled: false`), sáu prompt tiếng Việt, bộ eval năm ca cho mỗi kỹ năng | `src/server/skill-contracts.ts`, `skill-context.ts`, `skills.ts`, `text-safety.ts`, `skills/**` |
| 2 Bảng Z4 | Schema `intelligence`, bảng `ai_drafts` (bất biến), role `libetech_ai` NOLOGIN chỉ có SELECT và INSERT trên bảng đó; `draft_decisions` (Z1, bất biến) do người ghi. `SuggestionService`: AI chỉ ghi nháp; người xác nhận thì ngữ cảnh được dựng lại dưới quyền người đó và cổng kiểm quyết định; nháp tài liệu được xác nhận sinh đúng một bản qua dịch vụ tài liệu trong cùng transaction. Không tuyến HTTP | `migrations/021_ai_suggestions_z4.sql`, `src/server/suggestions.ts`, `ai-scope.ts` |
| 3 Review và duyệt | `review_decisions` (bất biến, một quyết định cho mỗi bản), `review_comments`, `review_delegations`, `review_events`. Duyệt gắn mã bản, hash nguồn và phiên bản bản ghi; nguồn đổi → `REVISION_CONFLICT`; chưa đóng băng → `SOURCE_NOT_FROZEN`; sai quyền → `APPROVER_NOT_AUTHORIZED`; tác giả không duyệt bản của mình. Thiếu người duyệt hiện «Chờ xác định người duyệt». Người nhận xét do điều phối dự án chỉ định và thu hồi (OQ-31 b, OQ-34 a); quyền duyệt bản chuẩn theo loại tài liệu đi qua phiếu đổi quyền một BoM (migration 019) | `migrations/019_document_approver_grant.sql`, `020_document_review.sql`, `src/server/document-review.ts`, `review-delegations.ts`, `document-commands.ts`, `access-grants.ts`, `src/components/team-accounts.tsx`, `approvals.tsx` |
| 4 3/3 | Máy trạng thái không đổi. Thêm test hồi quy và test đồng thời (hai phiếu thứ ba cùng lúc → một `bom_receipts`). `src/server/bom.ts` chỉ thêm hàm đọc `pending` | `tests/slice3-bom-events.test.ts`, `tests/slice3-bom-concurrency.test.ts`, `src/server/bom.ts` |
| 5 Ba sự kiện | Test hồi quy: chấp nhận kỹ thuật và nghiệm thu nghiệp vụ tách người, phiên bản, thời điểm; đóng ticket không thay nghiệm thu; người làm không tự nghiệm thu kể cả sau khi được chia lại việc. Không đụng bảng `evidence` | `tests/slice3-bom-events.test.ts` |
| 6 Liên kết phụ thuộc | `document_dependencies`: lưu liên kết; khi tài liệu nguồn có bản mới thì đặt cờ «cần xem lại» trong cùng transaction với đề xuất bản. Không có lệnh gỡ cờ ở lát này (lát 4) | `src/server/document-dependencies.ts`, `documents.ts` |
| 7 Thẻ quyết định trên web | `DecisionService` (chỉ đọc): thẻ review cho bản mới nhất của mỗi tài liệu; thẻ 3/3 chỉ người giữ ghế thấy. «Đủ phiếu» và «đã áp dụng» là hai dữ kiện đọc riêng; thẻ chỉ đọc «Đã áp dụng» khi có biên nhận. Phần Telegram: **không làm** (OQ-32 c) | `src/server/decisions.ts` |
| Handler | `/api/reviews/**`, `/api/decisions`: danh tính từ phiên, mã yêu cầu sinh ở máy chủ, mọi POST cần `Idempotency-Key` và qua kiểm origin, một thân 404 cho mọi kiểu từ chối, `no-store` | `src/server/review-http.ts`, `src/app/api/reviews/[[...path]]/route.ts`, `src/app/api/decisions/route.ts` |
| Giao diện | Màn **Review** (`/review`, `/review/[documentId]`) và **Quyết định** (`/decisions`); `/team` và `/approvals` hiện mã quyền duyệt theo loại tài liệu. Đặc tả bàn giao: `docs/UI-HANDOFF-3-review.md`, `docs/UI-HANDOFF-3-decisions.md` | `src/app/review/**`, `src/app/decisions/**`, `src/components/review.tsx`, `review-view.ts`, `decisions.tsx`, `decisions-view.ts` |

Migration 019–021 có tệp lùi ở `migrations/rollback/`; tiến → lùi → tiến chạy trên PGlite và PostgreSQL thật. Số migration lệch brief (brief ghi 018, 019) vì lát 2 đã dùng tới 018; **brief lát 4 phải dời số sang 022 trở đi**.

## Không làm trong PR này

- **Task 7c (điều phối dự án trình phiếu cấp quyền duyệt bản chuẩn — OQ-33 b) và bước 16b (biểu mẫu của nó):** tách PR riêng sau lát 3 theo quyết định của Chairman. Quyết định OQ-33 (b) vì thế **chưa có mã**. Quyền duyệt bản chuẩn hiện chỉ cấp qua đường có sẵn: quản trị tài khoản trình trên `/team`, một BoM đồng ý, quản trị áp. Đầu vào cho PR riêng còn trong repo: phần Task 7c của kế hoạch, `docs/reviews/slice-3-evidence-20261115/gates/security-gate-task-7c-plan.md`, các quyết định OQ-33 (b), OQ-35 (a), OQ-36 (b) cùng (d), OQ-37 (c), OQ-38 (c). Hai điểm kế hoạch của PR đó phải làm rõ: trình lại sau khi rút hoặc huỷ; điều phối khác không rút được phiếu.
- **Phần Telegram của mục 7** (Task 14): không làm, theo OQ-32 (c); dời sang đợt runtime. Plugin không đổi; plugin hiện tại chưa có nhãn cho mã quyền `doc_approve:*` và lệnh `/duyet` dừng ở phiếu mang mã đó.
- Không gọi mô hình, không cấp khoá pipeline AI, không bật Z4, không tuyến HTTP cho nháp, không cài skill vào bot, không evidence phi mã, không bot nhắc phiếu, không gỡ cờ «cần xem lại», không thông báo (lát 4), không tính điểm.

## Bằng chứng kiểm

Lượt cuối chạy tại mã `ee990b4` (commit phía trên chỉ có tài liệu). Mọi lệnh có mã thoát 0, trừ phép `ls` kiểm vắng mặt tệp của Task 7c (mã 1 là kết quả mong đợi: không tệp nào tồn tại); lệnh, mã thoát và tên log ở [manifest.json](reviews/slice-3-evidence-20261115/manifest.json); log đã che đường dẫn máy và chuỗi kết nối ở `reviews/slice-3-evidence-20261115/logs/*-ee990b4.log`. Lượt trước đó, ở `2a267c5`, giữ nguyên log (`*-2a267c5.log`). CSDL thật: PostgreSQL 16.15 trong container Docker chỉ nghe loopback, dữ liệu tổng hợp.

| Lệnh | Kết quả tại `ee990b4` |
|---|---|
| `npx vitest run --reporter=verbose` (PGlite) | 58 tệp đạt, 10 tệp bỏ qua; **966 đạt, 41 bỏ qua** — mọi ca bỏ qua thuộc khối chỉ chạy trên PostgreSQL thật |
| Như trên, PostgreSQL thật | 68 tệp; **1007 đạt, 0 bỏ qua** |
| `npx vitest run --coverage` | statements 96,04 · branches 90,84 · functions 97,71 · lines 97,26; ngưỡng 60 đạt với 13 mô-đun máy chủ của lát trong danh sách đo. Thấp nhất trong số đó: `document-commands.ts` 85,71 % dòng, 75 % nhánh. **Ba mô-đun máy chủ mới của lát không nằm trong danh sách đo:** `text-safety.ts` (một phần của cổng kiểm đầu ra), `list-cut.ts`, `review-page.ts` — chúng có test riêng nhưng không tính vào các số trên. Log chỉ in 9 trong 13 mô-đun: trình báo cáo dạng chữ của Vitest ẩn tệp đạt 100 % (`skipFull`), nên bốn mô-đun còn lại (`access-grants`, `source-text`, `ai-scope`, `decisions`) được suy là 100 %, không đọc được trực tiếp từ log |
| `python3 -m pytest tests/test_bot_bridge.py -q` | 67 đạt (mã plugin không đổi) |
| `npm run typecheck` | sạch |
| `rm -rf .next && npm run build` | sạch; có `/review`, `/review/[documentId]`, `/decisions`, `/api/reviews/[[...path]]`, `/api/decisions`; gói gửi tới trình duyệt không chứa tệp eval hay câu injection mẫu (0 tệp) |
| Truy vấn kiểm quyền của role AI | 0 dòng quyền ghi, 0 dòng quyền đọc trên `public`, `identity`, `analytics`; chỉ SELECT và INSERT trên `intelligence.ai_drafts` ([task-18-ai-privileges.txt](reviews/slice-3-evidence-20261115/task-18-ai-privileges.txt)) |
| Kiểm tĩnh ([task-18-static-checks.txt](reviews/slice-3-evidence-20261115/task-18-static-checks.txt)) | `tests/foundation.test.ts`, `tests/spec004.test.ts`, `AGENTS.md`, `CLAUDE.md`, `bot-plugin/`, `src/server/account-approval.ts` và migration 001–018 không có diff so với nhánh gốc; không migration nào chạm bảng `evidence`; phép kiểm rò mã nhóm: bản gốc in hai dòng là biểu thức chính quy trong test, bản đã chỉnh in 0 dòng (khoảng trống 22); grep trên năm mô-đun kỹ năng không thấy lời gọi mạng; `liberico-reality-checker` mở rộng grep sang `text-safety.ts`, `source-text.ts`, `skills/` và các import `node:http`, `https`, `net`, `undici`: cũng rỗng (ghi ở `gates/reality-check.md`, không phải một lệnh trong manifest) |
| Tệp và tuyến của Task 7c | không tồn tại, đúng theo quyết định tách PR |

Số test tăng qua các mốc: `2a267c5` (sau lượt quét mục nhỏ) 929 trên PostgreSQL thật; `f0d08c8` (sau đợt sửa của review toàn nhánh) 971; `21a5abc` (sau vòng sửa Codex 1) 997; `ee990b4` (sau vòng sửa Codex 2) 1007. Bằng chứng theo task (log đỏ, log xanh, bảng đột biến) nằm trong cùng thư mục: `task-NN-*.txt`, `tier1-fix-*.txt`, `codex-fix1-*.txt`, `codex-fix2-*.txt`.

## Ca kiểm → test tự động

Bảng đầy đủ, từng hàng kèm tệp, tên ca và kết quả trong log PostgreSQL thật: [task-18-case-table.md](reviews/slice-3-evidence-20261115/task-18-case-table.md).

| Ca | Test | Mức |
|---|---|---|
| DOC-05 | `suggestions` «DOC-05 …»; `z4-schema` «runtime cannot confirm a draft that names no source…» | Mức mã, đầu ra giả lập |
| DOC-06 | `document-review` «DOC-06 …», «(3) …»; `document-review-concurrency` (PostgreSQL thật) | Mức mã, dữ liệu tổng hợp |
| DOC-08 | `document-review` «(1) DOC-08 …» và hai ca sai quyền; `slice3-bom-events` «DOC-08/T17 …» | Mức mã |
| DOC-09 | `slice3-bom-events` «DOC-09/T06 …», «DOC-09/T07 …»; `decisions`, `decisions-ui` «DOC-09 …» | Mức mã |
| DOC-15 | `skill-contracts` «DOC-15 …»; `skills-eval` «DOC-15 …» và sáu ca `injection` | Mức mã, **không mô hình** |
| PM-05, PM-06 | `slice3-bom-events`; `slice3-bom-concurrency` (PostgreSQL thật) | Mức mã |
| **PM-02** | không có test | **Không coi đạt** — chờ tin gốc và chủ dự án xác nhận |
| T06, T07, T15, T17, T18 · A04–A06 | `spec004`, `foundation` nguyên trạng (không sửa kỳ vọng) + `slice3-bom-events` | Hồi quy |
| Quyền âm (1)–(7) | (1)(3)(5)(6) `document-review`; (2) `slice3-bom-events`; (4) `z4-schema` + truy vấn kiểm quyền; (7) `skill-context` | Mức mã; (4) ở tầng CSDL |
| Đồng thời | `slice3-bom-concurrency`, `document-review-concurrency`, `review-delegations-concurrency`, `suggestions-concurrency` | PostgreSQL thật, dữ liệu tổng hợp |
| Truy vấn kiểm principal AI | `z4-schema` «privilege query …» + [task-18-ai-privileges.txt](reviews/slice-3-evidence-20261115/task-18-ai-privileges.txt) | 0 dòng ghi, 0 dòng đọc ngoài `intelligence.ai_drafts` |
| OQ-33 (b), OQ-35…38 | không có test | **Chưa làm** — Task 7c ở PR riêng |
| Phần Telegram của mục 7 | không có test | **Chưa làm** — OQ-32 (c) |

**Eval kỹ năng** (không gọi mô hình; test thay `fetch` bằng hàm ném lỗi và grep không thấy import mô-đun mạng nào — đây là kiểm trên mã, không phải chạy trong môi trường đã cắt mạng): `{"skills_eval":{"skills":6,"cases":30,"good_pass":30,"bad_caught":30,"model":"none (mock outputs)"}}`. Sáu kỹ năng × năm loại ca (bịa khi thiếu thông tin, injection, nguồn xung đột, quyền bị thu hồi, cùng tên khác BU); mỗi ca có một đầu ra tốt phải qua cổng kiểm và một đầu ra xấu phải bị giữ đúng mã lý do.

## Review hai tầng

Bảng đầy đủ từng lượt: [REVIEW-slice-3-20261115.md](reviews/REVIEW-slice-3-20261115.md). Mọi reviewer chỉ đọc diff và mã; số test trong các biên bản là của `builder` chạy.

**Tầng 1 — reviewer nội bộ**
- Theo task: mười ba lượt (Task 1; 2 và 3; 4a; 4b; 5; 6; 7a; 7b; 7d; 8; 9 và 11; 10 và 12; 13), cùng một cổng bảo mật trên kế hoạch của Task 7c. Không lượt nào có mục nghiêm trọng; riêng Task 1 và Task 2–3, báo cáo review không nằm trong repo nên với hai lượt đó câu này chỉ dựa trên sổ của phiên. Các task phải sửa: 1, 4a, 7a, 7d, 8 (một vòng), 4b, 9 và 11 (hai vòng), 12 (một vòng) — đều trong trần ba vòng. Task 15, 16, 17 không có cổng riêng theo kế hoạch.
- Toàn nhánh ở `2a267c5`: `liberico-code-reviewer`, `liberico-database-reviewer`, `liberico-security-reviewer` (Opus) — cả ba **READY WITH FIXES**, không P0. Hai mục P1: trang chi tiết Review nuốt lỗi khi đọc danh sách phụ thuộc; test cô lập tenant thiếu chiều. Một đợt sửa gộp 17 mục ở `f0d08c8`; soát lại hẹp: mã và CSDL đều **READY**, không P0/P1/P2 mới.
- Phần sửa theo Codex vòng 1 (`21a5abc`) được reviewer bảo mật soát trước khi chạy lại cổng: **READY**.
- `liberico-reality-checker` (Opus) soát biên nhận này trước khi ghi mức «đã có mã». Lượt đầu: **NEEDS WORK** — 2 mục chặn và 8 mục không chặn, đều về lời văn của biên nhận, không mục nào đòi sửa mã hay chạy lại. Nó tự chạy 12 tệp test trên PGlite (314 đạt, 3 bỏ qua), typecheck, pytest, tính lại 12 hash của prompt và eval, và một phép đột biến (đã hoàn nguyên); **nó không chạy** bộ test trên PostgreSQL thật, build hay coverage — các số đó nó đọc từ log. Sau khi sửa đủ mười mục, lượt soát lại (chỉ đọc, không chạy test): **READY**. Đây là khuyến nghị; nghiệm thu thuộc về Chairman. Toàn văn: [gates/reality-check.md](reviews/slice-3-evidence-20261115/gates/reality-check.md).

**Tầng 2 — Codex** (`codex exec --sandbox read-only`, base ghim `ec3b5e7`)
- Vòng 1, head `4ae074d`: **CHANGES_REQUIRED** — 2 P1, 1 P2 ([codex-round-1.md](reviews/slice-3-evidence-20261115/codex-round-1.md)). Cả ba hợp lệ, sửa ở `21a5abc`: lệnh tạo liên kết phụ thuộc phải nêu bản đã xem; quyết định nháp giữ chỗ khoá lệnh trên toàn bộ nội dung lệnh; nhận xét đã đóng từ chối ghi thêm.
- Vòng 2, head `c363992`: **CHANGES_REQUIRED** — 2 P1 mới, 1 P2 ([codex-round-2.md](reviews/slice-3-evidence-20261115/codex-round-2.md)); ba mục vòng 1 không bị nêu lại. Cả ba hợp lệ, sửa ở `5a75ce9` và `ee990b4` (vòng sửa 2, vòng cuối được phép): con trỏ bản chuẩn chỉ dời cùng giao dịch với quyết định chấp thuận; thẻ 3/3 chỉ đọc «Đã áp dụng» khi đủ ba dữ kiện; ba ca eval «nguồn mâu thuẫn» viết lại. Trước khi chạy lại cổng, hai reviewer tầng 1 quét các lớp lỗi cùng loại (không P0/P1; các mục P2 sửa trong cùng vòng, một mục thành OQ-46) và soát phần sửa.
- **Vòng 3, head `ee990b4`: dòng đầu vẫn là CHANGES_REQUIRED, với đúng một finding mức P2; không có P0, không có P1** ([codex-round-3.md](reviews/slice-3-evidence-20261115/codex-round-3.md)). Finding: danh sách người nhận xét áp trần trước khi loại các uỷ quyền «ngủ» của người khác (`src/server/review-delegations.ts:111`) — truy vấn lấy 1 001 dòng và giữ 1 000, nên từ 1 000 dòng xếp trước nó (dòng của chính người xem và dòng chưa thu hồi của người khác, kể cả các dòng «ngủ» sẽ bị loại sau đó) thì một người nhận xét còn hiệu lực có thể bị sót. Cùng lần cắt đó bật cờ `reviewersTruncated`, nên màn hình hiện câu «Danh sách dài hơn phần đang hiện.» chứ không chỉ báo chưa có ai. Phiên lát 3 đã đối chiếu mã: finding đúng. **Chưa sửa**: hai vòng sửa được phép đã dùng hết, và sửa mã sau lượt chạy cuối sẽ để lại một commit cổng chưa xem.
- Điều kiện của lát («không còn finding P0/P1 của Codex chưa xử lý») **đạt** ở `ee990b4`. Verdict của Codex **chưa phải PASS**. Sửa mục P2 và chạy cổng thêm một lượt là việc Chairman quyết ở điểm dừng merge.

## Giao diện (kiểm tay, không phải nghiệm thu)

Phiên lát 3 kiểm tay ngày 15/11/2026 ở chế độ mô phỏng trên máy cục bộ (`npm run dev`, vai mô phỏng «Điều phối LibeTech», dữ liệu tổng hợp; một tài liệu có hai bản được tạo qua chính API của ứng dụng), ở 1280×800, 949×800 và 360×740. Phần này do phiên tự báo: **không ảnh chụp hay log máy chủ nào của lượt kiểm được lưu vào thư mục bằng chứng**, và nó không tính vào mức nào ở bảng trên. Trong hai đặc tả bàn giao, ô được đánh dấu là mục phiên đã kiểm đủ; mục chỉ kiểm được một phần vẫn để trống.

**Đã kiểm, đạt:**
- `/review`: trang chọn dự án; hàng review (tiêu đề chứa `<script>…</script>` hiện nguyên chữ, «hash tự khai — chưa kiểm», «Chưa có quyết định», «Chờ xác định người duyệt», «1–1 / 1 tài liệu»).
- `/review/<tài liệu>`: ở 1280 diff hai cột «Trước» / «Sau» với nhãn chữ Sửa / Thêm / Xóa, «Nguồn chưa đóng băng», thẻ HTML trong tóm tắt hiện nguyên chữ; tác giả thấy câu lý do và không có biểu mẫu; ở 949 một cột; ở 360×740 một cột, không cuộn ngang, không phần tử nào tràn khung, mọi nút và liên kết hành động ≥ 44px, chuỗi dài không dấu cách xuống dòng.
- `/decisions`: thẻ review với hai dòng riêng «Chưa có quyết định» và «Chưa áp dụng làm bản chuẩn», câu lý do, liên kết sang trang Duyệt tài khoản; ở 360×740 không cuộn ngang.
- Trạng thái không có quyền của hai màn (dự án ngoài phạm vi): câu cố định, không tên, không số. Tài liệu không tồn tại: câu «Không tìm thấy tài liệu trong phạm vi được cấp.».
- Log máy chủ trong lượt kiểm: mọi yêu cầu 200, trừ một 422 do chính lệnh tạo dữ liệu thử của phiên gửi sai.

**Chưa kiểm được bằng trình duyệt** (chỉ dựa trên test dựng tĩnh và test dịch vụ):
- Khối «Người nhận xét của dự án» (chỉ định, thu hồi, hai nhãn của điều phối): dịch vụ đọc vai của người gọi từ bảng danh tính; các vai mô phỏng không có dòng nào ở đó nên khối không hiện.
- Biểu mẫu quyết định và nhận xét, banner Conflict, thông báo thành công, thử hai tab: chế độ mô phỏng không có người duyệt hay người nhận xét.
- Thẻ 3/3 và luồng bỏ phiếu trên màn Quyết định (cần người giữ ghế đã ghép Telegram).
- `/team` và `/approvals` với mã quyền duyệt (dịch vụ danh tính không chạy ở chế độ mô phỏng).
- Vòng focus khi dùng bàn phím; trình đọc màn hình.

Phát hiện khi kiểm tay, đã sửa ở `4ae074d`: tài liệu không có mã hiện dấu ngăn thừa trước tiêu đề. Ở chế độ mô phỏng, nhóm liên kết Team Tech (Inbox, Review, Quyết định…) không hiện — điều kiện có từ trước lát này; hai màn mở bằng đường dẫn.

## Khoảng trống phải biết

**Kỹ năng, eval và Z4**
1. Eval kiểm cổng kiểm và hợp đồng, **không kiểm hành vi của mô hình**: không mô hình nào chạy. Ca injection chỉ chứng minh allowlist công cụ rỗng và hash manifest không đổi. Ca «quyền bị thu hồi» và «cùng tên khác BU» là «mã không có trong ngữ cảnh». Bộ eval không có ca cho chữ đang ẩn, bản chưa chuẩn hay dự án chỉ con trỏ (các luật đó có ca ở `skill-contracts`).
2. Cổng kiểm đầu ra kiểm cấu trúc, mã nguồn dẫn và quyền hiển thị; nó không kiểm được một nhận định có đúng hay không.
3. Ngữ cảnh không có tin nào hiện chữ và không có tài liệu thì mọi nháp đều bị giữ (cần nguồn — DOC-05; nêu một tin không hiện chữ ở bất kỳ trường nào cũng bị giữ). Áp cho dự án `IBS_HI` và cho nhóm chưa bật cờ hiện chữ: ở các nhóm đó kỹ năng phân tích tin không cho ra nháp xác nhận được. Ở ngữ cảnh chỉ con trỏ, mọi đầu ra của `doc_reviewer` bị giữ.
4. Ngữ cảnh chỉ con trỏ vẫn mang mã, `refCode`, loại tài liệu, số bản, hash nguồn của bản, con trỏ tin (`telegram:<nhóm>:<tin>`), thời điểm, cờ chuyển tiếp. `refCode` được coi là «mã» theo S15 (cách hiểu chờ Chairman xác nhận). Tin đang ẩn vẫn hiện như một con trỏ và một thời điểm. Ngữ cảnh có trần 20 tin, 50 tài liệu, 30 bản; nháp trích nguồn ngoài trần bị giữ.
5. «Đã xác nhận» nghĩa là một người chấp nhận nháp và tự viết bản tài liệu; nội dung bản **không** bị ràng với nội dung nháp. `document_revision_id` trên quyết định nháp không có nghĩa «chữ của AI đã được duyệt». Bản được nối với nháp chỉ qua cột đó và khoá lệnh chung.
6. Quyết định nháp không có dòng sự kiện riêng: dòng `draft_decisions` tự là bản ghi bất biến (người quyết, khoá lệnh, mã yêu cầu). Mã truy vết (`trace_id`) của nó là mã ngẫu nhiên, chưa lấy từ yêu cầu — cùng mẫu với các dịch vụ review. Khoá lệnh chỉ được giữ chỗ cho lệnh xác nhận nháp tài liệu; lệnh từ chối và xác nhận nháp ứng viên dựa vào ràng buộc «một quyết định cho mỗi nháp».
7. Theo migration 021 chỉ superuser trở thành role `libetech_ai` được (role không có thành viên, không đăng nhập). Bật Z4 vì thế cần thiết kế và migration riêng cho một login AI, không phải đổi cấu hình. Role này đặt được mọi biến `app.*`, nên ràng buộc ngữ cảnh không cản người đang giữ role. Dòng nháp không bao giờ xoá được trong luật (kể cả superuser phải `TRUNCATE` hoặc tắt trigger): **không đưa gì vào Z4 trước khi OQ-14 và OQ-45 có quyết định**.
8. `SuggestionService.list` trả nội dung nháp cho mọi vai đọc của dự án, kể cả khi nháp trích tin người đọc không còn xem được chữ, và `submitDraft` lưu được nháp của dự án `IBS_HI`. Lát này không có tuyến nào gọi nó; có ca kiểm canh. Xem OQ-45.
9. Hash manifest ràng nội dung prompt, eval và manifest; không ràng schema hay mã cổng kiểm; chỉ được kiểm trong test. Phép kiểm «không tên người» trong `skills/` chỉ bắt email, số điện thoại, @handle, mã nhóm, từ khoá bí mật.
10. Nháp Z4 của dự án `IBS_HI` chỉ bị chặn ở dịch vụ lúc xác nhận, không ở tầng CSDL.

**Review, uỷ quyền, quyền duyệt**
11. Một bản có tối đa một quyết định (S3). Một «yêu cầu sửa» của người nhận xét do điều phối chỉ định vì thế **chiếm lượt quyết định duy nhất của bản**: người giữ quyền duyệt không chấp thuận được cùng bản đó, phải có bản mới. Đây là hệ quả về quyền, không chỉ về giao diện.
12. Quyền nhận xét và việc «thu hồi có hiệu lực ngay» với nhận xét chỉ ép ở dịch vụ, không có guard CSDL (với quyết định thì trigger chặn). `review_events` không kiểm thực thể tồn tại và không có danh sách `kind` cố định ở CSDL.
13. RLS cho mọi người đọc trong phạm vi đọc đủ cột `review_delegations`; giới hạn của OQ-41 (c) chỉ nằm ở hàm liệt kê — mọi truy vấn mới trên bảng này phải mang cùng luật. OQ-42 (a): «không tự chỉ định mình» chỉ chắc trong phạm vi một tài khoản.
14. Guard ở sổ quyền (migration 019) là lưới nhất quán, không phải bằng chứng một BoM đã đồng ý: luật «một BoM đồng ý» do dịch vụ ép; role `libetech_identity` chèn được dòng phiếu ở trạng thái bất kỳ; guard chấp nhận phiếu `issued` cũ. Superuser tắt được trigger.
15. Người nhận xét đồng thời là điều phối tự thu hồi được dòng của mình (S62). Tác giả không tự đánh dấu «đã xử lý xong» nhận xét trên bản của mình, trừ nhận xét do chính họ mở — cách hiểu của phiên lát 3 từ `SPEC-009…:35`, `:127`.
16. Việc chấp thuận dời con trỏ bản chuẩn nhưng không hiện trong mục «Sự kiện» của trang tài liệu lát 1 (`registry_events` thiếu mã yêu cầu; sự kiện mới đi `review_events`), chỉ hiện ở Review. Sự kiện đặt cờ phụ thuộc trên đường trình bản bằng tay mang một mã sinh trong transaction, không phải mã của yêu cầu HTTP.
17. Thẻ review không có hạn hiệu lực. Thẻ review cắt ở 200 tài liệu mỗi dự án; thẻ 3/3 lấy 30 phiếu mới nhất (phiếu đã đóng cũng tính); danh sách người nhận xét cắt ở 200 dòng, nhận xét của một tài liệu ở 1 000. Hai loại thẻ đọc trong hai transaction riêng. `appliedReceipt` của thẻ review rỗng khi con trỏ bản chuẩn không khớp bản đó. Hết hạn phiếu 3/3 trên thẻ tính theo đồng hồ ứng dụng; lệnh bỏ phiếu theo đồng hồ CSDL. Người giữ ghế chưa ghép Telegram chỉ thấy thẻ review.
18. Ở dự án `IBS_HI`, hai màn mới vẫn hiện tiêu đề, tóm tắt, nhận xét, ghi chú phạm vi do người viết cho thành viên của chính dự án đó; chỉ đường kỹ năng AI là «chỉ con trỏ». Kỷ luật nội dung ở các trường chữ tự do đó là của người, không do mã ép.
19. Hai câu «không tìm thấy» cùng tồn tại trong mã («…mục…» ở inbox, uỷ quyền, ngữ cảnh kỹ năng, nháp; «…tài liệu…» ở họ tài liệu). Trong một dịch vụ mọi kiểu từ chối cho một câu; handler review trả một thân duy nhất cho mọi thứ sau nó. Tính không phân biệt được kiểm theo mã trạng thái, mã lỗi, câu và hình dạng; thời gian trả lời chỉ được suy từ hình dạng truy vấn, chưa đo.

**Kiểm và bằng chứng**
20. Log «đỏ» của Task 4a là dựng lại sau, không phải bản chụp lúc chạy đỏ. Log «đỏ» của Task 13, 16 chỉ là thiếu mô-đun. Một số ca hồi quy có RED là đột biến tạm.
21. Một ca của lát 2 (`tests/outbox-schema.test.ts`, «017 rollback refuses…») phải sửa phần hạ tầng, không đổi điều khẳng định, khi 019 xuất hiện; hai helper của tệp đó dời sang `tests/slice2-fixtures.ts`.
22. Phép kiểm rò mã nhóm trên dòng thêm in hai dòng là biểu thức chính quy trong test (chữ mẫu `-100000000000[0-9]`), không phải mã nhóm; phiên lát 3 phán loại hai dòng đó khỏi phép kiểm và ghi cả kết quả thô.
23. Một số task chạy song song khi tệp tách rời (9 với vòng sửa 7d; 11 với 13; 12 với 15; 16, 17 với các vòng sửa). Sau mỗi lần đều có lượt chạy cả bộ trên hai động cơ.

**Thêm sau review toàn nhánh**
24. Tệp lùi 020 nay từ chối khi còn bất kỳ dòng nào trong năm bảng review: **020 thành một chiều, trong luật, kể từ dòng review đầu tiên** (nhận xét, quyết định, uỷ quyền, liên kết phụ thuộc hay sự kiện). Tệp lùi 019 khoá ghi trên bảng danh tính trong lúc chạy; nó nâng khoá từ SHARE lên ACCESS EXCLUSIVE nên có thể khoá chết với một giao dịch danh tính đang chạy (PostgreSQL huỷ một bên). Các tệp lùi chỉ chạy trên bản sao.
25. Ba danh sách có trần nay báo khi bị cắt (cờ `…Truncated` và một câu trên màn hình); chưa phân trang. Với người không phải điều phối, cờ của danh sách người nhận xét được tính trước khi lọc các dòng «ngủ» của người khác: dự án có từ 1 000 dòng như vậy thì cờ cho biết chúng tồn tại.
26. Hàng Review phân trang theo `offset` ở máy chủ (50 mỗi trang). Nút «Đã sửa» và «Xác nhận đã xử lý» nay theo cờ dịch vụ trả về cho từng nhận xét.
27. `HEAD` trên các tuyến review được xử lý như `GET`. Chữ tự do có `dir="auto"`, riêng dòng tên và dòng phiếu chưa có. Ghi chú đang gõ cho bản cũ được giữ lại sau «Đọc bản mới» và sẽ gửi cho bản mới nếu người dùng bấm gửi — chưa có dòng nhắc.
28. Thẻ phiếu ở `/approvals` chưa đánh dấu loại nào là «mới thêm»; phiếu của người vai `viewer` mang mã vẫn đọc như «được cấp quyền duyệt», dù `viewer` không bao giờ là người duyệt (hướng an toàn).
29. Helper giao diện lặp giữa hai màn (`nameOf`, kiểu khoá lệnh, khung đang tải); tập vai đọc ở phía trình duyệt lặp `READ_ROLES` của máy chủ.
30. `tests/review-http.test.ts` còn cách trần 200 phiên của kho phiên mô phỏng một phiên; thêm ca vào tệp đó phải trả phiên.

**Thêm sau hai vòng Codex**
31. Con trỏ bản chuẩn chỉ dời trong **chính giao dịch đã chèn quyết định chấp thuận** (guard ở migration 020). Guard nhận ra điều đó qua trạng thái «đang chạy» của giao dịch đã chèn dòng quyết định, tính quanh mã giao dịch hiện tại để đúng trong savepoint và sau khi mã giao dịch quay vòng. Phần «quay vòng» **không có test nào mô phỏng được**: chỉ có một ca nêu công thức trên số tự đặt và khẳng định hàm đang triển khai chứa đúng các hằng số; phép đột biến quay về cách đọc cũ chỉ bị ca hằng số đó bắt. Một quyết định cũ hơn 2^31 giao dịch nằm ngoài lập luận (chỉ có thể báo lỗi). Các điểm về nội bộ PostgreSQL do reviewer CSDL xác nhận từ hiểu biết mã nguồn, chưa chạy trên một cụm thật. Guard cần PostgreSQL ≥ 13.
32. Tác giả của một bản tài liệu nay bị ràng với người thao tác ở tầng CSDL: 020 tạo lại policy chèn của `document_revisions` (bảng của lát 1) với điều kiện đó; tệp lùi 020 khôi phục bản của 014. Mọi giao dịch chèn bản dưới role chạy ứng dụng phải đặt người thao tác trước; hai tệp test có sẵn đã đổi phần dựng dữ liệu theo, không đổi điều khẳng định.
33. Ranh giới tin cậy của cả thiết kế: role chạy ứng dụng tự đặt được biến «người thao tác» (`app.person_id`). Các guard ở CSDL bảo vệ tính toàn vẹn trước lỗi của ứng dụng, không phải trước một ứng dụng đã bị chiếm.
34. Còn ép ở dịch vụ, không ở CSDL: con trỏ «bản mới nhất» dời được mà không tăng phiên bản và ngoài giao dịch của bản (quyết định review vẫn nêu đích danh bản nên người duyệt bản cũ nhận xung đột); guard của quyết định nháp chấp nhận bất kỳ bản nào của tài liệu, hoặc không bản nào, trên một xác nhận; cờ «cần xem lại» không có cột ghi người đặt; không có ràng buộc duy nhất cho «một lần xác nhận đã xử lý mỗi nhận xét» (dịch vụ kiểm dưới khoá dòng tài liệu); `TRUNCATE` không bị trigger bất biến chặn (không role ứng dụng nào có quyền đó).
35. Lệnh tạo liên kết phụ thuộc phải nêu bản đã xem (`upstreamRevisionId`); chưa màn hình nào gọi tuyến này. Mỗi quyết định nháp giữ chỗ khoá lệnh trên toàn bộ nội dung lệnh; `proposeRevisionIn` là hàm xuất ra ngoài và có cờ để chạy dưới chỗ giữ của người gọi — chỉ dịch vụ nháp truyền cờ đó. Ghi thêm vào một nhận xét đã đóng trả `COMMENT_RESOLVED`.
36. Thẻ 3/3 chỉ đọc «Đã áp dụng» khi đủ ba dữ kiện (trạng thái lưu, biên nhận, ba phiếu đồng ý); mọi tổ hợp lệch đọc «Cần đối soát», và khi có biên nhận mà trạng thái lệch thì dòng thứ hai ghi «Có biên nhận nhưng trạng thái không khớp — cần đối soát.» (chữ do phiên lát 3 đặt). Trên thẻ review, «Biên nhận lúc» là thời điểm quyết định, không phải một biên nhận riêng; hàng review in nhãn hash cả khi hash rỗng.
37. Eval: các ca «nguồn mâu thuẫn» của `release_librarian`, `doc_reviewer`, `technical_writer` đã viết lại hai lần — lần đầu để thành mâu thuẫn thật (hai nguồn nêu hai giá trị không tương thích cho cùng một dữ kiện tại cùng thời điểm), lần hai để ngữ cảnh đúng hình dạng hàm dựng ngữ cảnh trả ra; nay mâu thuẫn là giữa một bản của tài liệu được nêu và bản ghi của một tài liệu khác. Một ghi chú của mẫu `doc_reviewer` được đổi chữ trước khi phép quét dữ liệu cá nhân được sửa (phép quét từng báo nhầm trên một chuỗi hash); chữ không được khôi phục.
38. Lệnh xác nhận nháp tài liệu khoá dòng tài liệu trước khi giữ chỗ khoá lệnh. Reviewer bảo mật và reviewer CSDL không tìm thấy vòng khoá chết giữa các đường quyết định nháp, trình bản tay, duyệt, nhận xét và tạo liên kết — kết luận từ đọc mã, có ca chạy đua trên PostgreSQL thật cho ba cặp.
39. **Finding P2 của Codex vòng 3 còn mở:** danh sách người nhận xét cho người không phải điều phối áp trần (1 000 dòng) trước khi loại các uỷ quyền «ngủ» của người khác, vì «ngủ» được xác định sau truy vấn từ vai hiện tại của người được chỉ định. Truy vấn lấy 1 001 dòng và giữ 1 000: từ 1 000 dòng xếp trước nó (dòng của chính người xem và dòng chưa thu hồi của người khác, kể cả các dòng «ngủ» sẽ bị loại sau đó) thì một người nhận xét còn hiệu lực có thể không hiện; lúc đó cờ «đã cắt» bật và màn hình có câu «Danh sách dài hơn phần đang hiện.». Ca kiểm 1 005 dòng hiện có chỉ phủ dòng đã thu hồi.

**Thêm sau lượt soát của `liberico-reality-checker`** (các điểm reviewer tầng 1 yêu cầu biên nhận phải nêu)
40. **Login vận hành là superuser, theo thiết kế (S7, S34, S61).** Nó vượt RLS, guard chỉ định người nhận xét, phép kiểm «chỉ điều phối mới thu hồi được», hai guard con trỏ (bản chuẩn và bản mới nhất) và phép kiểm chiều của cờ «cần xem lại». Nó **không** vượt guard của quyết định review và guard của quyết định nháp. Superuser còn tắt được trigger và `TRUNCATE` được các bảng lịch sử (có từ migration 001). Login chạy ứng dụng thì bị từ chối lúc khởi động nếu là superuser hoặc có BYPASSRLS. Nguồn: `gates/tier1-database.md` §4 (a) và mục «For the receipt».
41. Khi một khoá khử trùng của nháp đã được dùng ở dự án khác trong cùng tenant, lệnh gửi nháp trả xung đột: role AI vì thế biết được «khoá này tồn tại ở nơi khác». Chỉ role AI quan sát được; **phải quyết trước khi bật Z4** (reviewer bảo mật, `gates/tier1-security.md`, 12 M12-4).
42. `SuggestionService` phải được dựng với đúng danh sách nhóm hiện chữ (`excerptChats`) của đường nhận tin đang chạy. Với giá trị mặc định (danh sách rỗng) mọi nháp dựa trên chữ của tin đều bị giữ. Lát này chưa có nơi nào dựng dịch vụ ngoài test.
43. Hai mục nhỏ còn nguyên: lệnh «Đã sửa» và «Xác nhận đã xử lý» nhận diện tác giả và người viết nhận xét mà không đọc lại tư cách thành viên (vai của người gọi thì có đọc từ CSDL) — Task 5 M-2; gửi lại một lệnh chỉ định đã thành công, sau khi tư cách của người được chỉ định đổi, trả `DELEGATION_INVALID` thay vì câu trả lời đã lưu — Task 7a M6.

## Ghi chú triển khai (đầu vào cho điểm dừng của Chairman; chưa áp ở đâu)

Bản đầy đủ: [tier1-database.md §5](reviews/slice-3-evidence-20261115/gates/tier1-database.md), cùng ghi chú từng migration ở `gates/review-task-4a.md` (019), `review-task-4b-database.md` (020), `review-task-8-database.md` (021). Điểm chính:
- Thứ tự 019 → 020 → 021, áp bằng login migration là **superuser**, không dùng login web hay runtime. `scripts/migrate.ts` áp mọi migration đang chờ trong một lượt; muốn áp riêng 019 phải chạy tay từng tệp.
- 019 giữ khoá ACCESS EXCLUSIVE ngắn trên `identity.memberships` (bảng có dữ liệu thật ở d1-ai1; đã đặt `lock_timeout`). **019 thành một chiều kể từ phiếu đầu tiên nêu một mã `doc_approve:*`**: tệp lùi từ chối khi còn membership hoặc phiếu mang mã đó.
- **021 thành một chiều kể từ quyết định nháp đầu tiên**; dòng nháp không xoá được.
- Kiểm trước: `max(version)` là `018`; PUBLIC không CREATE được trong schema `public`; `libetech_ai` nếu có sẵn thì NOLOGIN, không thành viên, không thuộc role nào; ghi lại danh sách superuser và số dòng `identity.memberships`.
- Vòng lặp gỡ CHECK trên `report_permissions` của 019 chạy lại mỗi lần CSDL nhúng khởi động; migration sau này thêm CHECK trên cột đó phải đặt tên và loại trừ ở đó.
- **020 thành một chiều kể từ dòng review đầu tiên** (tệp lùi từ chối khi còn bất kỳ dòng nào trong năm bảng review). 020 thay policy chèn của `document_revisions` do 014 tạo; không áp lại riêng 014 sau 020.
- Cần PostgreSQL ≥ 13; ở điểm dừng áp migration, kiểm rằng role chạy ứng dụng gọi được `pg_xact_status` và `pg_current_xact_id` (guard con trỏ bản chuẩn dùng hai hàm đó).

## Điểm dừng — không làm, chờ Chairman

Merge PR này · triển khai d1-ai1 · áp 019–021 lên dữ liệu thật · trình phiếu cấp quyền duyệt bản chuẩn cho người thật · sửa `AGENTS.md` (dòng Z4 `:11`, schema `intelligence`, thư mục `skills/`) · cấp login hay khoá cho `libetech_ai` · nối mô hình · duyệt bản chuẩn thật (cổng trước pilot của OQ-07) · đưa `/review`, `/decisions`, `/api/reviews`, `/api/decisions` vào allowlist của proxy · phần Telegram của thẻ quyết định và nhãn quyền mới trong plugin · gửi tin thật · cài plugin · khởi động lại gateway · mở PR riêng cho Task 7c.

## Câu hỏi mở chưa quyết

- **OQ-43** (`docs/OPEN-QUESTIONS.md:625`) — người được chỉ định có thấy nhãn «người chỉ định không còn là điều phối» ở dòng của chính mình không. Hành vi hiện tại: chỉ điều phối thấy.
- **OQ-44** (`:634`) — ai xem danh sách người giữ quyền duyệt bản chuẩn. Hành vi hiện tại: mọi vai đọc của dự án thấy mã người và loại tài liệu.
- **OQ-45** (`:647`) — ai đọc nội dung một nháp AI; có xét lại quyền lúc đọc không; nháp của dự án `IBS_HI` có được lưu không. **Chặn việc thêm tuyến đọc nháp và việc bật Z4.**
- **OQ-46** (`:663`) — nháp AI dựng trên đầu vào đã cũ có được xác nhận không (ví dụ nháp phân tích bản r3, sau đó có bản r4). Hành vi hiện tại: không kiểm thêm; người xác nhận nháp tài liệu vẫn phải gửi phiên bản tài liệu mình thấy. **Cùng OQ-45, chặn việc bật Z4.**
OQ-43, OQ-44, OQ-45 an toàn ở mức «chưa triển khai» theo reviewer bảo mật tầng 1; OQ-43 và OQ-44 cần quyết trước pilot. OQ-46 do reviewer mã nêu khi quét lớp lỗi; phiên lát 3 không tự chọn phương án vì SPEC không định nghĩa nháp «cũ».

## Cách hiểu chờ Chairman xác nhận (không phải lời Chairman; đều theo hướng chặt)

S11 (vai đọc Review và Quyết định: `manager`, `engineer`, `technical`, `business`; chặn `viewer`, `bot`) · S15 (dự án `IBS_HI`: ngữ cảnh chỉ con trỏ, nháp không xác nhận được) · S32 (phiếu đăng ký lần đầu không mang quyền duyệt bản chuẩn) · S33 (người giữ quyền duyệt cũng nhận xét và yêu cầu sửa được cho cùng loại) · S34 (người được chỉ định nhận xét phải là thành viên đang hoạt động có vai đọc) · S51 (`viewer`, `bot` không bao giờ là người duyệt dù sổ quyền mang mã) · S56 (điều phối không đề xuất quyền duyệt cho chính mình) · S62 · các cách hiểu OQ-28 (1)(2), OQ-29 (1)–(3), S13 của lát 2 và mục 24 của `DELIVERY-011` — nay cũng quyết định ai trở thành người duyệt bản chuẩn, vì quyền đó dùng lại nguyên phiếu đổi quyền.

## Ngoài phạm vi (có từ trước, không sửa ở lát này)

`bom_votes` chưa ràng người bỏ phiếu với người đang thao tác ở tầng CSDL (API không nhận actor từ JSON) · `registry_events` thiếu mã yêu cầu và mã truy vết · đường quản trị có sẵn so mã người bằng chuỗi thô (`src/server/accounts.ts`) · `failure()` gắn nhãn «mã việc đã tồn tại» cho mọi lỗi trùng khoá chưa xử lý (`src/server/http.ts`) · hai DeprecationWarning của Node trong log test · mã nhóm tổng hợp dạng cũ ở các tệp có từ trước.

## Sự cố và môi trường của phiên

- **Lộ token ra đầu ra công cụ (không vào repo):** khi kiểm tiến trình, một subagent chạy `pgrep -fl`, lệnh này in dòng lệnh của một tiến trình khác trên máy có biến tên `OBSIDIAN_API_TOKEN`. Giá trị đã vào transcript cục bộ và ngữ cảnh mô hình của subagent đó. Phiên lát 3 không đọc, không in giá trị; đã quét repo, báo cáo và log bằng chứng: không tệp nào chứa nó. Đề nghị Chairman cân nhắc đổi token. Từ đó mọi lệnh giao việc cấm in dòng lệnh tiến trình.
- Tệp biến môi trường thử của lát 2 không còn; phiên lát 3 dựng lại trong thư mục tạm từ biến của chính container, đặt lại mật khẩu role `libetech_web` trong cụm tổng hợp, tạo CSDL thử mới. Không giá trị nào được in hay chép vào repo.
- Bật Docker làm các container khác của máy tự khởi động (`rag-pg`, `tgbot-pg`, `btnet-pg`, `btnet-redis`, `btnet-meili`); không đụng, không đọc. Khi xong chỉ dừng `libetech-slice1-pg`.
- Cảnh báo tự động lúc commit: bốn mục ở migration 020 (ba đã sửa, một ghi nhận ở khoảng trống 12); hai mục ở `review-delegations.ts` là phép đột biến tạm do phiên yêu cầu, đã hoàn nguyên trước commit.
- 56+ commit của nhánh mang địa chỉ email tác giả trong metadata git, như các lát đã push trước.

## Phán quyết của phiên lát 3 (không phải quyết định của Chairman)

S1–S86: `docs/plans/slice-3-review-skills.md`, mục cùng tên. Các phán quyết theo task sau bản 0.7 của kế hoạch, theo thứ tự đưa ra; mỗi mục kèm cái giá nếu sai:

Bản đầy đủ, chép nguyên từ sổ điều phối: [controller-rulings.md](reviews/slice-3-evidence-20261115/controller-rulings.md). Các phán quyết đáng chú ý:

- **Trần vòng sửa theo task là 3**, không phải 5 như mặc định của skill (theo lưu ý của phiên điều phối). Nếu sai: không mất gì, chỉ dừng sớm hơn.
- **Task 9 — cổng kiểm đầu ra đọc theo hướng chặt:** kỹ năng của ngữ cảnh phải khớp manifest; mọi trường mang mã phải nằm trong ngữ cảnh; `release_librarian` chỉ nêu bản chuẩn; ngữ cảnh chỉ con trỏ không nhận nhận định nào. Nếu sai: gỡ từng nhánh kiểm.
- **Rút một phán quyết của chính phiên:** ban đầu cho danh sách `sources` nêu con trỏ; sau review bảo mật, mọi trường mang mã nêu một tin không hiện chữ đều làm đầu ra bị giữ. Nếu sai: nới lại một phép kiểm.
- **Giữ luật «phải có nguồn»** khi ngữ cảnh không có tin hiện chữ và không có tài liệu (DOC-05); prompt sửa cho khớp cổng kiểm. Nếu sai: miễn một luật cho đầu ra rỗng ở ngữ cảnh chỉ con trỏ.
- **Task 10:** một câu trả lời 404 cho mọi kiểu từ chối; một đoạn SQL duy nhất cho «ánh xạ mới nhất là `IBS_HI`»; `release_librarian` chỉ nhận bản chuẩn; đầu vào kỹ năng không nhận được là 422. Nếu sai: đổi một nhánh.
- **Task 12:** khoá khử trùng không thấy dòng (dùng ở dự án khác) là xung đột, không bao giờ là thành công; cùng khoá khác nội dung là xung đột; **quyết định nháp không có dòng sự kiện riêng** (dòng `draft_decisions` là bản ghi bất biến); quyền quyết định áp cho cả «từ chối»; lúc xác nhận tính lại hash từ giá trị đã lưu; dự án chỉ con trỏ và thực thể không tồn tại đều giữ nháp. Nếu sai về sự kiện: thêm một loại thực thể vào CHECK và một lệnh chèn.
- **OQ-45 không tự chọn:** việc ai đọc nội dung nháp không được làm ở lát này; ghi thành câu hỏi mở. Nếu sai: không gì bị lộ, vì chưa có tuyến.
- **Task 13:** chỉ bắt lỗi «ngoài phạm vi» từ hàm đọc phiếu 3/3; `quorum.have` chỉ đếm chấp thuận; `appliedReceipt` đọc từ con trỏ bản chuẩn hiện tại; trạng thái lạ đọc thành «cần đối soát». Nếu sai: đổi một ánh xạ.
- **Task 15:** handler quy mọi lỗi «ngoài phạm vi» 404 về một thân trả lời; danh sách phụ thuộc nhận các bộ lọc của dịch vụ. Nếu sai: gỡ một nhánh.
- **Task 16, 17:** màn hình không tự tính quyền hay trạng thái; bước 16b không làm; hai nhãn của điều phối chỉ hiện với đúng giá trị boolean; OQ-43, OQ-44 không quyết ở giao diện; một khoá lệnh cho mỗi thao tác, dùng lại khi gửi lại; ca kiểm CSS của màn Review chỉ quét khối của nó. Nếu sai: đổi chữ hoặc một điều kiện hiển thị.
- **Phạm vi đợt sửa sau review toàn nhánh:** chỉ thêm cờ «đã cắt», không phân trang ba danh sách; chỉ thêm chú thích vào 019, không đổi câu lệnh; một số mục P3 ghi vào biên nhận thay vì sửa. Nếu sai: một vòng Codex.
- **Phép kiểm rò mã nhóm** loại chữ mẫu của biểu thức chính quy trong test (không phải mã nhóm), ghi cả kết quả thô. Nếu sai: không gì, vì không có mã nào liên quan.
- **Review theo cụm:** Task 9 và 11 review chung, Task 10 và 12 review chung (bảo mật); Task 15, 16, 17 chỉ có review toàn nhánh theo kế hoạch.
- **Vòng sửa 1 theo Codex:** lệnh tạo liên kết phụ thuộc phải nêu bản đã xem; một lần giữ chỗ khoá lệnh cho mỗi quyết định nháp, dấu vân tay gồm toàn bộ lệnh; nhận xét đã đóng trả `COMMENT_RESOLVED` 409 với câu «Nhận xét này đã được xác nhận xử lý xong.» (chữ do phiên đặt). Nếu sai: đổi một mã lỗi hoặc một trường của dấu vân tay.
- **Vòng sửa 2 theo Codex:** con trỏ bản chuẩn chỉ dời trong chính giao dịch đã chèn quyết định chấp thuận — sửa đúng một hàm guard của migration 020; cơ chế do `builder` chọn sau khi cách phiên gợi ý (so thời điểm) không chạy đúng trên PGlite, và công thức phiên đưa ra cho trường hợp mã giao dịch quay vòng sai với savepoint nên được thay. Thẻ 3/3 cần đủ ba dữ kiện mới đọc «Đã áp dụng». «Mâu thuẫn» trong eval nghĩa là hai nguồn nêu hai giá trị không tương thích cho cùng một dữ kiện tại cùng thời điểm, và ngữ cảnh eval phải là hình dạng hàm dựng ngữ cảnh trả ra được. Ràng tác giả của bản ở policy (thay đổi migration thứ hai của vòng). Nếu sai: một điều kiện trong guard, một dòng trong bảng trạng thái, hoặc viết lại mẫu eval.
- **Phép quét dữ liệu cá nhân bỏ qua chuỗi hash** thay vì đổi chữ mẫu cho lọt phép quét. Nếu sai: một biểu thức chính quy.
- **OQ-46 không tự chọn:** thế nào là nháp «cũ» là luật sản phẩm SPEC chưa định; ghi thành câu hỏi mở. Nếu sai: Codex có thể nêu thành P1 — vòng 3 đã không nêu.
- **Sau Codex vòng 3 (một P2, không P0/P1): không sửa mã thêm.** Điều kiện của lát là không còn P0/P1; hai vòng sửa đã dùng hết; sửa sau lượt chạy cuối sẽ để lại commit cổng chưa xem. Finding được ghi là còn mở; việc sửa và chạy cổng thêm một lượt chờ Chairman. Nếu sai: một sửa nhỏ và một lượt Codex, theo lời Chairman.
