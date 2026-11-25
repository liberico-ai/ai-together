# DELIVERY-022 — GIAO VIỆC 5: GO LIVE để Team Tech tạo và cập nhật việc thật

Ngày 25/11/2026 · nhánh nền `libetech-ai-os` · phiên Claude Code thực hiện GIAO VIỆC 5 bản 3

## Căn cứ

- Mục tiêu, lời Chairman 25/11/2026 (chép nguyên): «Hoàn thiện GO LIVE để toàn bộ Team Tech tạo và cập nhật được công việc thật, gồm cả các vấn đề đã ghi nhận trong LibeAI và Dragon Forge. Phương đưa được danh sách việc của cả team từ bảng hiện có lên nền tảng.»
- Bốn quyết định của Chairman ngày 25/11/2026 (chép nguyên; cũng ở khối 25/11 cuối `docs/OPEN-QUESTIONS.md`):
  - «Tất cả thành viên Team Tech được tạo việc ở tất cả các dự án. Màn hình tạo việc hiển thị đủ danh sách dự án cho thành viên Tech.»
  - «Việc mới ghi ở trạng thái chờ BoM xác nhận hoặc phê duyệt. BoM Tech: Chu Hoàng Anh, Quân, Phương.»
  - «Giữ luật xác nhận 3/3 khi chia lại nhiệm vụ, kể cả chia việc giữa ba thành viên BoM. Quyết định khác cần BoM duyệt: hiện trạng thái và người đã duyệt theo quy chế hiện có.»
  - «Các phản ánh lịch sử có thể chưa được thu nhận đầy đủ. Đối chiếu thêm trực tiếp với Quân, Phương và tin gốc trước khi đánh dấu một lỗi đã đóng.»
- GIAO VIỆC 5 bản 3 của Cowork điều phối (thay bản 1 và 2). Phiên này không thấy lời gốc của Chairman; lời trên được ghi theo giao việc.

## Bốn mức, theo hạng mục

| Hạng mục | Đã có mã | Đã thử trên CSDL thử | Đã triển khai | Đã nghiệm thu với team |
|---|---|---|---|---|
| A — Tech tạo việc, ghế BoM duyệt (024) | có, PR #41 | có: PGlite và PostgreSQL 16 cục bộ | chưa | chưa |
| B — Telegram → IN → phân loại → yêu cầu (025, 026) | có, PR #42 | có: PGlite và PostgreSQL 16 cục bộ | chưa | chưa |
| C — nhập bảng của PM (027) | có, PR #43 | có: PGlite và PostgreSQL 16 cục bộ; chạy thử với bản xuất 25/11 của bảng thật trên PGlite trong bộ nhớ | chưa | chưa |
| D — trả lời quyền/lỗi của bot | chưa | chưa | chưa | chưa |
| E — ticket ngày 20/11 (tệp lớn, Excel, hết giờ chờ, quyền thư mục) | chưa | chưa | chưa | chưa |
| F — nhắc việc theo lịch | chưa | chưa | chưa | chưa |

«Đã triển khai» và «đã nghiệm thu» chỉ được điền khi có bằng chứng từ d1-ai1 và biên bản nghiệm thu (`docs/ACCEPTANCE-GV5-20261125.md`). Phiên này không vào máy chủ.

Không ca lỗi nào được ghi «đã đóng»: mỗi ca giữ «chưa đối chiếu với người báo» cho tới khi người báo xác nhận trên tin gốc.

## PR, merge, cổng Codex

| Hạng mục | PR | Đầu PR | Merge | Codex vòng 1 (dòng đầu) | Xử lý |
|---|---|---|---|---|---|
| A | [#41](https://github.com/liberico-ai/ai-together/pull/41) | `a0bab16` | `d0d3d76` | `VERDICT: CHANGES_REQUIRED` — 1 P0, 3 P1 | P0 sửa (bot, viewer chèn thẳng yêu cầu). P1 `bom-seats.sql` không lọc tenant: sửa. P1 từ chối không ghi sự kiện: ghi nhận, sửa tiến. P1 rollback chạy lần hai: không tái hiện |
| B | [#42](https://github.com/liberico-ai/ai-together/pull/42) | `fb9c778` | `fc1d7b8` | `VERDICT: CHANGES_REQUIRED` — 1 P0, 2 P1 | P0 sửa (đếm liên kết lộ cho người không đọc được dự án). Hai P1 sửa (nút liên kết gửi nhầm lệnh; CHECK của payload) |
| C | [#43](https://github.com/liberico-ai/ai-together/pull/43) | `5403cbf` | `c3c9c4a` | `VERDICT: CHANGES_REQUIRED` — 1 P0, 3 P1, 1 P2 | P0 sửa (hàm xung đột dò được mã và nội dung ngoài quyền xem). P1 RLS của lô: sửa. P1 digest chưa gắn ánh xạ: ghi nhận, sửa tiến. P1 rollback chạy lần hai: không tái hiện. P2 CSV: sửa |

- Mỗi PR một vòng Codex trước merge, theo GIAO VIỆC 5. Chỉ P0 chặn merge; P1 ghi lại và sửa tiến. Các sửa làm sau vòng Codex nên Codex chưa đọc lại.
- Merge bằng `gh pr merge --merge --match-head-commit <sha đầy đủ>`. Sau mỗi merge đã kiểm: hai cha; cây của merge bằng cây đầu PR; `main` vẫn `d23e516`; nhánh mặc định vẫn `main`.
- Bằng chứng: `docs/reviews/gv5-a-evidence-20261125/`, `docs/reviews/gv5-b-evidence-20261125/`, `docs/reviews/gv5-c-evidence-20261125/`.

### Cổng test trên cây cuối

| Hạng mục | Typecheck | Build | PGlite (kèm coverage) | PostgreSQL 16 | pytest plugin |
|---|---|---|---|---|---|
| A | 0 | 0 | 73 tệp đạt, 14 bỏ qua; 1379 ca đạt, 156 bỏ qua; câu lệnh 96,5 %, nhánh 92,12 %, dòng 97,72 % | 87 tệp; 1535 ca đạt | — |
| B | 0 | 0 | 78 tệp đạt, 14 bỏ qua; 1434 ca đạt, 158 bỏ qua; câu lệnh 96,36 %, nhánh 91,93 %, dòng 97,73 % | 92 tệp; 1592 ca đạt | 82 đạt |
| C | 0 | 0 | 83 tệp đạt, 15 bỏ qua; 1491 ca đạt, 162 bỏ qua; câu lệnh 96,36 %, nhánh 92,02 %, dòng 97,73 % | 98 tệp; 1653 ca đạt | 82 đạt |

Ca bỏ qua trên PGlite là ca chỉ chạy trên PostgreSQL thật; lần chạy PostgreSQL chạy cả.

- Phần trăm coverage tính trên danh sách tệp của `vitest.config.ts`. README bằng chứng của B ghi «dòng 96.36 %»: đó là cột câu lệnh; cột dòng là 97,73 % (`docs/reviews/gv5-b-evidence-20261125/logs/pglite-coverage.log`).
- Danh sách đó chưa có `sheet-import.ts`, `csv.ts` (C), `intake-pool.ts`, `intake-trail.ts` (B). Đo riêng trên cây cuối của C, cả bộ test PGlite (`docs/reviews/gv5-c-evidence-20261125/logs/coverage-new-modules.log`), câu lệnh / nhánh: `sheet-import.ts` 96,75 / 92,4 %; `csv.ts` 100 / 100 %; `intake-pool.ts` 91,13 / 83,17 %; `intake-trail.ts` 95,34 / 92,75 %. Cả bốn trên ngưỡng 60 %. Thêm chúng vào danh sách là việc sửa tiến.

## Bản nguồn và lần chạy thử nhập

- Bản nguồn dùng để chạy thử: bản xuất CSV ngày 25/11/2026 của Google Sheet «Checklist dau viec cua Tech theo BU_Update 07.11.2026», trang «Đầu việc Tech». SHA-256 của tệp: `c7af427f7b39d58b90180b830462f2354b944fc260a7e2b54778a12292c05cc9`.
- Bản nguồn để nhập thật chưa được PM xác nhận (EV-10 của `docs/EVIDENCE-REQUEST-20261125.md`). Phiên này không sửa bảng nguồn.
- Chạy trên PGlite trong bộ nhớ: tenant, dự án và người nhập là giả, ô người phụ trách để trống. Bản có chữ của ô nằm ngoài repo, quyền 0600.
- Số đếm theo nhãn BU của bảng, không có tổng gộp:

| Nhãn BU | Dòng | Hợp lệ | Trùng | Cần đối chiếu | Yêu cầu mới ở lần chạy thứ hai |
|---|---|---|---|---|---|
| LBRC | 23 | 23 | 0 | 0 | 0 |
| IBS HI | 20 | 20 | 0 | 0 | 0 |
| XECA | 8 | 8 | 0 | 0 | 0 |

- Cờ (một dòng có thể mang nhiều cờ; ô để trống không bị đoán):

| Nhãn BU | `OWNER_NOT_MAPPED` | `MISSING_OWNER` | `MULTI_OWNER` | `MISSING_DUE` | `AMBIGUOUS_DUE` | `UNKNOWN_STATUS` | `IBS_NOTE_NOT_STORED` |
|---|---|---|---|---|---|---|---|
| LBRC | 18 | 1 | 4 | 6 | 3 | 8 | — |
| IBS HI | 13 | 0 | 7 | 19 | 0 | 19 | 9 |
| XECA | 8 | 0 | 0 | 2 | 2 | 1 | — |

- `OWNER_NOT_MAPPED` cao vì lần chạy thử không có tài khoản thật để ánh xạ; với bảng thật, người nhập chọn ánh xạ lúc xem trước.
- Lần chạy thứ hai với đúng tệp đó ghi 0 yêu cầu mới ở cả ba nhãn.

## Dự án và ghế BoM

- Ba ghế BoM Tech của một dự án là `bom_scopes.seat_ids` của dự án đó (migration 006). Operator ghi bằng `deploy/bom-seats.sql`; tên người là dữ liệu ngoài repo.
- Một ghế chỉ được tính khi người đó có membership ở dự án, tài khoản hoạt động, đã liên kết Telegram (`work_request_seat()`, migration 024).
- Dự án nào đã bật ghế trên d1-ai1: **chưa biết**. Repo không đọc được CSDL phục vụ. Hồ sơ 11/11/2026 ghi một trong ba người BoM chưa có membership ở dự án `LBRC · App Saleman`, chưa có bằng chứng kích hoạt hay liên kết (khối 25/11 của `docs/OPEN-QUESTIONS.md`). Yêu cầu bằng chứng: EV-09.
- Dự án chưa có ghế: việc mới nằm chờ, không ai duyệt được (OQ-60 (b) (1), cách hiểu tạm). Giao diện ghi «dự án chưa có ghế BoM».

## Nhóm → dự án → quyền

Theo mã và hồ sơ trong repo. Cấu hình thật nằm trên máy chủ (tệp 0600, ngoài repo); id nhóm không ghi ở đây.

| Nhóm | Khoá cấu hình | Dự án | Ai gửi được | Ai đọc được | Bot |
|---|---|---|---|---|---|
| LibeAI (nhóm nội bộ) | `chatScopes` → dự án pilot LBRC; `intake.chats` | đúng một dự án LBRC (`src/server/intake.ts`, `INTAKE_PROJECT_AMBIGUOUS` khi khác một) | tin của nhóm được ghi nhận thành ứng viên; lập yêu cầu từ ứng viên đã xác nhận: Team Tech hoặc điều phối dự án (OQ-61 B3 (1)) | hộp thư: theo quyền ở dự án; đọc qua bot: người đã liên kết Telegram ∩ dự án của nhóm (`docs/DEPLOY-002.md:11`) | chỉ đọc |
| Libe – Xeca | `chatScopes` → không dự án | không | — | — | trả `SCOPE_DENIED`, không trả nội dung (`docs/DEPLOY-002.md`) |
| Dragon Forge (nhóm chung Team Tech) | hôm nay: bị từ chối (`deploy/pilot-scope.json`, `excluded`). Sau 0.9.1: `intake.poolChats`, không ở `chats`, `excerptChats` hay dự án của `chatScopes` (`src/server/bridge-config.ts:21-24`) | chọn ở bước phân loại; tới lúc đó «chưa gán dự án» | thành viên `identity.tech_roster` đã liên kết Telegram, đang hoạt động, tin gọi bot (OQ-61 B1 (1)) | mục pool: thành viên Tech; yêu cầu và việc sinh ra: theo quyền từng dự án | chỉ đọc; biên nhận «Đã nhận, mã IN-…» không tên dự án, không chữ của tin |
| Nhóm khác | không có | không | — | — | đóng; không lưu gì |

- Dragon Forge chỉ bật sau EV-12 (gateway có giữ chữ của nhóm ở nơi khác không) và EV-13 (bot nhận những tin nào). Trả «có giữ» ⇒ không bật, báo Chairman (`docs/RUNBOOK-GV5-B-POOL.md`).
- Bảng đầy đủ theo nhóm thật và câu trả lời của bot cho từng lỗi là việc của hạng mục D.

## Các ca lỗi

| Ca | Nguồn | Trạng thái |
|---|---|---|
| (a) thành viên BoM nhận `unauthorized`, bot giải thích sai | EV-03 | chưa có mã (D); chưa đối chiếu với người báo |
| (b) thành viên BoM nhận `SCOPE_DENIED` | EV-04 | chưa có mã (D); chưa đối chiếu với người báo |
| (c) ticket 20/11: tệp lớn, Excel, hết giờ chờ, quyền thư mục | EV-05 | chưa có mã (E); chưa đối chiếu với người báo |
| (d) PMTEST 24/11, `IN-F8FA8D30` | EV-06 | chưa đối chiếu |
| (e) đổi giờ họp BoM đã xác nhận trong LibeAI | EV-07 | chưa có mã (F); chưa đối chiếu |
| (f) phiên nhắc theo lịch không đọc được lịch sử nhóm | EV-08 | chưa có mã (F); chưa đối chiếu |

## Cách hiểu tạm (chờ Chairman)

Mã đang chạy theo cách hiểu tạm dưới đây; không phải phương án được chọn.

- **OQ-60** (A, duyệt việc mới): (a) (1) một ghế BoM khác người tạo; (b) (1) dự án chưa có ghế thì chờ; (c) (2) ghế điền chỗ trống khi duyệt, không thay người đã đề xuất; (d) (3) chia lại việc sinh từ yêu cầu dừng ở `SOURCE_RECONCILE`; (e) (1) giao việc mới cho một ghế BoM bị giữ (`SELF_ASSIGNMENT`, `BOM_ASSIGNEE_HELD`).
- **OQ-61** (B, Dragon Forge): B1–B6 đều (1).
- **OQ-62** (C, nhập bảng): câu 1–5, 7, 8 đều (1); Z2 (a); câu 6 chờ PM (EV-10); câu 9 (`AGENTS.md`) chờ Chairman.
- Luật 3/3 khi chia lại không nới. Ranh giới BU không đổi. `AGENTS.md` không sửa.

## Bản 0.9.1

- Bản: `libetech-ai-os-0.9.1-20261125.tar.gz`, đóng gói bằng `scripts/package-release.py` từ merge `c3c9c4a61d5e341979c41c1ee60dce6a25b969cd` trong một worktree sạch.
- SHA-256 của tệp: `e85caf478c62de526e0e938d7b1a6ca92464033592d7854a398b644d99b15e88`. `treeSha256`: `faffe8578c9aa7f66e8362ef87a28b7854a90d350ab1caaaa3edcbe04003b262`. Số tệp: 384 (chưa kể hai tệp manifest), gồm migration 024–027 kèm rollback và plugin 0.3.3.
- Bản lưu ở `~/Documents/libetech-releases/` cùng tệp `.sha256`.
- Đã kiểm sau khi chép ra: `shasum -a 256 -c` khớp; giải nén vào thư mục mới, `deploy/verify-bundle.py` báo `Bundle verified` với đúng `treeSha256` trên.
- Runbook: `docs/RUNBOOK-091-20261125.md` (bản lưu → migration 024–027 → web → bridge/plugin 0.3.3 → khởi động lại gateway nếu cần, ngoài giờ, kiểm lại 20/20 bot).
- Kịch bản nghiệm thu: `docs/ACCEPTANCE-GV5-20261125.md` (7 kịch bản, tài khoản thật).
- Yêu cầu bằng chứng: `docs/EVIDENCE-REQUEST-20261125.md`.

## Sửa tiến (P1 đã ghi nhận, không chặn merge)

- A: ghế BoM từ chối một yêu cầu mà không ghi `work_request_events` (Codex A, P1). Dòng yêu cầu vẫn giữ người quyết và thời điểm.
- C: `previewDigest` chưa gắn với ánh xạ dự án và người phụ trách (Codex C, P1). Lần ghi vẫn kiểm lại quyền, IBS HI, xung đột và `CODE_EXISTS` theo ánh xạ của chính nó.
- B, C: thêm `sheet-import.ts`, `csv.ts`, `intake-pool.ts`, `intake-trail.ts` vào danh sách coverage của `vitest.config.ts`.

## Vướng

- Đợt triển khai 022 + 023 chưa có hồ sơ trong repo (khối 25/11, mục 5). 0.9.1 giả định máy chủ đang ở schema 001–023 (EV-01).
- Bản nguồn của lần nhập thật chờ PM (EV-10).
- Ghế BoM và tài khoản nghiệm thu chờ operator (EV-09).
- **Chia lại việc sinh từ yêu cầu chưa làm được.** Phiếu 3/3 cần một dòng `bom_sources` còn hiệu lực (`src/server/bom.ts`, `SOURCE_RECONCILE`); việc duyệt từ yêu cầu (biểu mẫu, tin nhắn, bảng nhập) không có dòng đó, và đổi người thẳng trả `BOM_REQUIRED`. Vì vậy mọi việc mới sau 0.9.1 giữ người thực hiện đã duyệt cho tới khi Chairman chọn OQ-60 (d). Kịch bản 2 của nghiệm thu chỉ chạy bước 3–4 trên việc cũ có dòng nguồn (EV-15).
- Dragon Forge chờ EV-12, EV-13.
- D, E, F chưa bắt đầu.
- Câu hỏi cho Chairman: OQ-60 (gồm (e)), OQ-61, OQ-62 câu 1–9.
