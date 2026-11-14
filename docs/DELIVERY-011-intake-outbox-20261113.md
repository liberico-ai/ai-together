# Lát 2 · P1.1 — Tiếp nhận Telegram: inbox, outbox, phần còn thiếu SPEC-007 · 13/11/2026

## Bốn mức — ghi riêng, không gọi mức sau khi mới đạt mức trước

| Mức | Trạng thái | Căn cứ |
|---|---|---|
| **Đã có mã** | **Chưa đạt cổng Codex.** Mã có, test/typecheck/build xanh ở mã `6038014` (nhánh `slice-2-intake-outbox`, PR nháp [liberico-ai/ai-together#10](https://github.com/liberico-ai/ai-together/pull/10)). Vòng sửa thứ ba đã sửa cả bốn finding của Codex vòng 3. **Codex vòng 4 — vòng cuối — vẫn ra CHANGES_REQUIRED với 1 P1 mới.** Theo quyết định của Chairman ngày 14/11/2026 («chưa đạt thì dừng hẳn và trình lại»), lát dừng ở đây, không có vòng 5, finding chưa sửa | Mục «Bằng chứng kiểm», «Review hai tầng» |
| Đã triển khai | **Chưa.** Không triển khai d1-ai1; migration 016–018 chưa áp lên DB thật nào; plugin chưa cài; gateway chưa khởi động lại | Điểm dừng Chairman |
| Đã dùng thật | **Chưa.** Chưa gửi tin thật vào nhóm hay DM; mọi dữ liệu là tổng hợp | — |
| Đã nghiệm thu | **Chưa.** OQ-09 mục (1) chưa chứng minh; SPEC-007 ca (c) UAT chưa chạy; chưa có chữ ký nghiệm thu | — |

**Finding còn mở — Codex vòng 4** ([codex-round-4.md](reviews/slice-2-evidence-20261113/codex-round-4.md)), **chưa sửa, chờ Chairman:**
- (P1) `src/server/intake.ts:51`: tiếp nhận đếm số phần tử trong `chatScopes[chatId]` chứ không đếm số dự án khác nhau. Nếu người vận hành lỡ khai trùng một mã dự án cho một nhóm (`[A, A]`; `parseBridgeConfig` nhận), tin của nhóm đó bị từ chối `INTAKE_PROJECT_AMBIGUOUS` (409) dù nhóm chỉ thuộc một dự án; plugin chuyển tin sang dead-letter. Phiên lát 2 đã đối chiếu mã: finding đúng. Không tin nào bị xoá (tin nằm trong dead-letter), nhưng không vào Inbox cho tới khi sửa cấu hình và nhập lại.
- Hướng sửa để Chairman quyết (chưa làm): bỏ trùng trước khi đếm ở `intake.ts:48`, hoặc để `parseBridgeConfig` từ chối danh sách có mã trùng (tuyến trả 503, plugin giữ tin trong spool). Cỡ: một đến hai dòng mã và một đến hai test. Sửa xong muốn «đạt cổng» thì cần thêm một lượt Codex, tức một quyết định mới.

**Bốn finding của Codex vòng 3** ([codex-round-3.md](reviews/slice-2-evidence-20261113/codex-round-3.md), phân tích ở [codex-round-3-analysis.md](reviews/slice-2-evidence-20261113/codex-round-3-analysis.md)) **đã sửa ở vòng sửa thứ ba**, theo lớp lỗi:
- (P0) plugin, 401 khi phát lại xoá mọi tin đang chờ → sửa ở `9643b7f` và `82d30c6`: không đường nào của plugin xoá tin tiếp nhận. 401, redirect và lỗi cấu hình cục bộ dừng phát lại và giữ nguyên các dòng.
- (P0 theo Codex, planner xếp P1) plugin, khoá spool bận (`SPOOL_BUSY`) làm mất tin → cùng hai commit: tin sang tệp dead-letter.
- (P1) `intake.ts`, bản sửa lưu chữ cho tin đã ghi chỉ con trỏ → `1054222`, theo quyết định OQ-30 (b) của Chairman: chế độ nội dung thuộc về từng bản sửa.
- (P1) `intake.ts`, bản sửa tới trước tin gốc làm Inbox hiện bản cũ → `9643b7f`: xếp theo `edited_at`, không còn đọc `observed_at` của sự kiện.

Vì OQ-09 mục (1) chưa có bằng chứng, theo brief lát chỉ đạt mức «đã có mã» và **ProjectChannel chưa được kích hoạt**: nguồn hiệu lực vẫn là `chatScopes`, có test khẳng định.

## Căn cứ và quyết định

- Chairman 13/11/2026, nguyên văn: «Mở lát 2» (phiên điều phối chuyển lời).
- Brief: `docs/SLICE-BRIEFS.md:87-152`. Kế hoạch: `docs/plans/slice-2-intake-outbox.md` (Task 1–13), do `planner` lập.
- Quyết định đã áp (brief «Phụ thuộc»): OQ-02, OQ-08 (b), OQ-09, OQ-10 (b)+(c), OQ-11 (a), OQ-12 (c), OQ-13 (c), OQ-20.
- **OQ mới khi lập kế hoạch — Chairman đã quyết ngày 14/11/2026**, chọn qua hộp chọn ở phiên điều phối (`docs/OPEN-QUESTIONS.md`, nguyên văn ở từng mục):
  - **OQ-26** — «(c) Chỉ đối soát tổng hợp (Recommended)». Không có mã nạp sổ ticket thật; hàm đối soát chỉ chạy trên dữ liệu tổng hợp. Đối soát thật làm tay ở đợt runtime bằng hai bản kê hai bên tự xuất (điểm dừng).
  - **OQ-27** — «(a) Chỉ nhóm một dự án (Recommended)». Nhóm gắn từ hai dự án bị từ chối `INTAKE_PROJECT_AMBIGUOUS`, không lưu gì. Nay là hành vi theo quyết định, không còn giữ chỗ.
  - **OQ-28** — «(c) Khai theo từng nhóm». Cờ `intake.excerptChats` trong cấu hình vận hành quyết định nhóm nào được lưu trích; nhãn miền `LIBERICO_BU`/`XECA` không còn quyết định gì. Giá trị cờ cho nhóm thật là điểm dừng triển khai.
  - **OQ-29** — Chairman tự gõ «1 thành viên BOM». Phiếu đổi quyền đủ khi một BoM đã đóng băng đồng ý, không cần phiếu Chairman. Phiếu cấp tài khoản lần đầu vẫn Chairman + một BoM.
- **Cách hiểu chờ Chairman xác nhận** (không phải lời Chairman; đều theo hướng chặt):
  - OQ-28, của phiên điều phối: (1) nhóm không khai cờ chỉ giữ con trỏ + hash; (2) dự án ánh xạ `IBS_HI` luôn chỉ giữ con trỏ + hash, kể cả khi nhóm có cờ.
  - OQ-29, của phiên điều phối: (1) người được đổi quyền không bỏ phiếu cho chính mình; (2) hạn 48 giờ như phiếu lần đầu; (3) một BoM từ chối mà còn BoM khác chưa bỏ phiếu thì phiếu vẫn chờ, mọi BoM đã đóng băng từ chối thì phiếu đóng.
  - OQ-29, của phiên lát 2 (S13): phiếu đồng ý của Chairman không được tính; phiếu từ chối của Chairman đóng phiếu.
- **Quyết định của Chairman ngày 14/11/2026 sau khi cổng dừng** (phiên điều phối chuyển lời, chọn qua hộp chọn):
  - Vòng sửa: «Cho vòng 3, Codex vòng 4 cuối (Recommended)» — «Sửa bốn lỗi theo lớp, gộp với việc áp OQ-26…29 (vốn cũng phải review lại). Codex vòng 4 là vòng cuối; chưa đạt thì dừng hẳn và trình lại. Khoảng 300–450 nghìn token phía Claude cộng một lượt Codex.» Trong phiên lát 2, người dùng cũng bấm «Yes, fix round 3».
  - PR: «Push + PR nháp ngay (Recommended)» — «Có bản sao ngoài máy và team xem được. PR để nháp, biên nhận ghi «chưa đạt cổng Codex», quét bí mật trước khi push vì repo đang công khai. Không merge, không đụng main.»
  - **OQ-30** — «(b) Xét lại từng bản sửa» — «Chế độ ghi theo từng bản sửa với cấu hình hiện tại, có thể nới. Phải sửa schema 016 (chưa phát hành) và mọi chỗ đọc.»
  - **OQ-30 kèm** — «Ẩn ngay, thiết kế xoá sau (Recommended)» — «Giữ trong bảng bất biến nhưng Inbox ẩn theo cấu hình hiện tại. Thủ tục xoá hoặc che có người duyệt thiết kế ở lát sau.»
- Phán quyết S1–S15 của phiên lát 2 (không phải quyết định của Chairman): `docs/plans/slice-2-intake-outbox.md`, mục «Phán quyết của phiên lát 2» (tóm tắt ở cuối biên nhận). R3-1…R3-9 (luật của plugin ở vòng sửa thứ ba) nằm trong [controller-rulings.md](reviews/slice-2-evidence-20261113/controller-rulings.md).
- **Công thức `quality_score`** (S3, hợp đồng dữ liệu của lát; chưa khai trong `AGENTS.md` vì sửa `AGENTS.md` là điểm dừng): `source_events` = 100 − 40 nếu là tin chuyển tiếp − 20 nếu chữ bị cắt − 20 nếu tệp không lưu được, tối thiểu 0 (`src/server/intake-rules.ts:10-16`); `delivery_receipts` = 100 cho biên nhận `send`, 60 cho `reconcile` (`src/server/outbox.ts:180`).
- Không sửa `AGENTS.md`/`CLAUDE.md` (R10). Bốn dòng `AGENTS.md` ở gói quyết định §5 chờ OQ-09 mục (1).

## Đã làm

| Việc brief | Kết quả | Tệp chính |
|---|---|---|
| 1 SourceEvent + inbox | `source_events` bất biến (bốn trường nguồn E-EXT-01, `quality_score` 0–100), `source_event_revisions`, `intake_candidates`, `intake_attachments` (locator + hash, không bytes), `intake_events` (audit bất biến). Khử trùng bằng UNIQUE + `ON CONFLICT DO NOTHING`; hai yêu cầu cùng khoá song song → một dòng Chế độ nội dung (lưu trích hay chỉ con trỏ) nằm trên **từng bản sửa**, DB ép «bản chỉ con trỏ không mang chữ» (OQ-30 (b), `1054222`); Inbox chỉ hiện chữ khi bản sửa có chữ và cấu hình hiện tại còn cho phép | `migrations/016_intake_inbox.sql`, `src/server/intake.ts`, `src/server/intake-rules.ts` |
| 2 Phân quyền | Chat/topic lấy từ phong bì đã ký của gateway, không từ nội dung; phạm vi = `chatScopes` ∩ `intake.chats`; nhóm chưa mapping bị từ chối, không lưu nội dung; người ngoài team được ghi là `source_actor`, không có quyền | `src/server/bridge-config.ts`, `bridge-auth.ts`, `bridge-io.ts`, `intake-scope.ts`, `db.ts` |
| 3 Sửa, album, forward, mốc thu nhận | Sửa → revision mới; mỗi phần album là một sự kiện; forward bị đánh dấu, không thành tác giả; mốc bắt đầu thu nhận và khoảng thiếu (tin đi qua spool) hiện trên Inbox | `intake.ts`, `inbox.ts`, `src/components/inbox.tsx` |
| 4 Tệp | Chỉ locator + sha256 + loại + kích thước; loại ngoài danh sách hoặc quá trần → không lưu, không biên nhận thành công, xếp `intake.attachment_failed`; tên tệp bỏ ký tự điều khiển và Cf | `intake-rules.ts:100-118` |
| 5 Outbox | `outbox_messages`, `delivery_receipts` (bất biến), `outbox_state_events` (DB tự ghi qua trigger SECURITY DEFINER do role NOLOGIN `libetech_outbox_audit` sở hữu). Ghi cùng transaction với thay đổi nghiệp vụ (E-INT-06); envelope E-INT-02; hết hạn lease → `uncertain`, đối soát trước khi gửi lại; lỗi quyền → `dead`, không thử vô hạn; gateway kéo và báo biên nhận qua cầu nối đã ký | `migrations/017_outbox.sql`, `src/server/outbox.ts` |
| 5 Năm trạng thái | received (spool ở gateway) · persisted (`source_events`) · projected (**luôn rỗng**, S4) · delivered (biên nhận `send`) · recipient-acknowledged (chỉ DM phiếu duyệt) — tách riêng, không suy ra nhau | như trên |
| 6 Principal tiếp nhận + Inbox | Khoá và login riêng `libetech_intake_svc` (S1); chỉ ghi sự kiện nguồn, ứng viên, biên nhận; không tạo/gán/chốt việc. Màn `/inbox`: chọn loại (sự cố / yêu cầu / tài liệu), hỏi bổ sung, đánh dấu trùng, bỏ qua, mở lại; danh sách dự án chỉ gồm dự án được phép | `src/server/inbox.ts`, `inbox-http.ts`, `src/app/inbox/`, `src/app/api/inbox/[[...path]]` |
| 7 SPEC-007 (a)(b) | (a) phiếu mới → DM cho người bỏ phiếu qua outbox, có biên nhận giao, thẻ Yes/No dùng `/duyet` sẵn có; (b) phiếu đổi quyền cho thành viên đã có (018): mở rộng quyền đi qua phiếu, đủ khi một BoM đã đóng băng đồng ý (OQ-29, `8f181af`); chỉ giảm quyền lưu thẳng. (c) UAT thật: **chưa chạy** | `migrations/018_access_change_approval.sql`, `src/server/account-approval.ts`, `accounts.ts`, `access-grants.ts`, `src/components/approvals.tsx`, `team-accounts.tsx` |
| 8 Kích hoạt ProjectChannel | **Không làm** (điểm dừng); test khẳng định `chatScopes` vẫn là nguồn hiệu lực | `tests/intake.test.ts` |
| 9 Khoá riêng, trần | Khoá `intake.key` tách khoá bot; trần thân (đề xuất): sự kiện 16384 B, kéo outbox 1024 B, biên nhận 4096 B. Khai `Content-Length` quá trần thì từ chối trước khi đọc; không khai thì đọc theo luồng, quá trần dừng ngay (`request-body.ts`, vòng sửa Codex 2); tệp 20 MiB và danh sách loại tệp là **đề xuất**, chưa là chính sách | `bridge-io.ts:12`, `intake-rules.ts:108-114` |
| Đối soát hai kho (OQ-09 mục 2) | Nối tin với ticket bằng khoá sự kiện chung; chỉ đọc, không sinh ứng viên, không đổi trạng thái ticket; lệch được liệt kê, không tự sửa — trên sổ tổng hợp | `src/server/ledger-reconcile.ts` |
| Plugin | Hook tiếp nhận (chỉ bật khi `intake.json` có `"hookEnabled": true`), allowlist nhóm, spool có dead-letter cho dòng đầu hỏng, con trỏ tệp, adapter giao outbox với `send` giả. Từ vòng sửa thứ ba: không đường nào xoá tin tiếp nhận — tin nằm ở backend, spool hoặc tệp dead-letter (trần 64 MiB); 401, redirect và lỗi cấu hình giữ nguyên hàng chờ. `VERSION`/`plugin.yaml` **không đổi số bản** (S7) dù mã đổi | `bot-plugin/__init__.py`, `bot-plugin/plugin.yaml` |

Migration 016–018 có tệp lùi ở `migrations/rollback/`; 018 lùi từ chối khi còn dòng `access_change`. Ba migration chưa phát hành nên được sửa tại chỗ trong lát; tiến → lùi → tiến chạy trên PGlite và PostgreSQL thật.

## Bằng chứng kiểm — mã ở `6038014` (sau vòng sửa thứ ba và OQ-30)

`scout` chạy đủ tám lệnh ngày 14/11/2026 tại `6038014`, cùng máy, PostgreSQL 16.15 loopback chỉ có dữ liệu tổng hợp. Đây là mã mà Codex vòng 4 đọc. Log có hậu tố `-6038014`; `manifest.json` ghi ở khoá `rerunAfterFixRound3`.

| Lệnh | Kết quả | Log |
|---|---|---|
| `npx vitest run tests/migrations-rollback.test.ts` (native, chạy trước) | 1 tệp · 3 test đạt | `migrations-rollback-6038014.log` |
| `npx vitest run --reporter=verbose` (native) | 41 tệp · **500 test đạt · 0 bỏ qua** | `vitest-native-6038014.log` |
| `npm run test` (PGlite) | 36 tệp đạt + 5 bỏ qua · 479 test đạt + 21 bỏ qua (ca chỉ chạy native) | `vitest-pglite-6038014.log` |
| `npx vitest run --coverage` | statements 95.09 · branches 86.79 · functions 96.67 · lines 96.19; ngưỡng 60 đạt | `coverage-6038014.log` |
| `npm run typecheck` | exit 0 | `typecheck-6038014.log` |
| `rm -rf .next && npm run build` | exit 0; có `/inbox`, `/api/inbox/[[...path]]`, `/api/bridge/[...path]` | `build-6038014.log` |
| `python3 -m pytest tests/test_bot_bridge.py -q` | 66 đạt · 69 subtest đạt | `pytest-6038014.log` |
| Quét | Mã nhóm: chỉ mã tổng hợp, cộng hai script có từ trước (đã che). `priority1`: 0. Mẫu chuỗi kết nối: chỉ fixture, mẫu deploy và tài liệu như trước. Trong log đã lưu: 0 | `greps-6038014.log` |

Hai test plugin từng khẳng định đúng hành vi mà Codex vòng 3 xếp P0 đã được viết lại; trước khi sửa, 22 test plugin và 3 test intake đỏ theo hành vi.

## Bằng chứng kiểm — head `8f181af` (sau quyết định OQ-27/28/29)

`scout` chạy lại đủ tám lệnh ngày 14/11/2026 tại `8f181af`, cùng máy, cùng PostgreSQL 16.15 loopback chỉ có dữ liệu tổng hợp. Log đã che như bộ `2eb9437`, nằm cùng thư mục với hậu tố `-8f181af`; `manifest.json` ghi ở khoá `rerunAfterOqDecisions`.

| Lệnh | Kết quả | Log |
|---|---|---|
| `npx vitest run tests/migrations-rollback.test.ts` (native, chạy trước) | 1 tệp · 3 test đạt | `migrations-rollback-8f181af.log` |
| `npx vitest run --reporter=verbose` (native) | 41 tệp · **479 test đạt · 0 bỏ qua** | `vitest-native-8f181af.log` |
| `npm run test` (PGlite) | 36 tệp đạt + 5 bỏ qua · 458 test đạt + 21 bỏ qua (ca chỉ chạy native) | `vitest-pglite-8f181af.log` |
| `npx vitest run --coverage` | statements 95.04 · branches 86.76 · functions 96.63 · lines 96.16; ngưỡng 60 đạt | `coverage-8f181af.log` |
| `npm run typecheck` | exit 0 | `typecheck-8f181af.log` |
| `rm -rf .next && npm run build` | exit 0; có `/inbox`, `/api/inbox/[[...path]]`, `/api/bridge/[...path]` | `build-8f181af.log` |
| `python3 -m pytest tests/test_bot_bridge.py -q` | 55 đạt · 27 subtest đạt | `pytest-8f181af.log` |
| Quét | Mã nhóm: chỉ mã tổng hợp, cộng hai script có từ trước (đã che). `priority1`: 0. Mẫu chuỗi kết nối trong tệp được theo dõi: cùng 11 dòng như ở `2eb9437` (fixture `redactSecrets`, harness lát 1, mẫu deploy, hai tài liệu), không dòng mới. Trong log đã lưu: 0 | `greps-8f181af.log` |

Bảy test mới hoặc đổi theo quyết định: bốn ca OQ-28 ở `intake` («a flagged group with an unmapped project stores the excerpt», «an unflagged group keeps pointer and hash only even for a XECA project», «an IBS HI project keeps pointer and hash only even in a flagged group», «a flag in the request body is never honoured»), cờ trong cấu hình (`bridge-limits`, `bridge-io`), và các ca phiếu đổi quyền ở `access-change` («… applies once one BoM agrees», «Chairman agreement alone does not approve …», «one BoM rejection keeps it pending …», «a registration ballot still needs Chairman and one BoM»). RED của bốn ca OQ-28 chỉ là lỗi dựng đối tượng do đổi chữ ký hàm, không phải đỏ theo hành vi (review task ghi Minor).

## Bằng chứng kiểm — head `2eb9437`

Phiên điều phối giao cho `scout` (agent chỉ đọc mã) chạy ngày 14/11/2026 trên máy cục bộ, tại head `2eb9437`. PostgreSQL thật là 16.15, trong container loopback, chỉ có dữ liệu tổng hợp. Log đã che đường dẫn máy và chuỗi kết nối, nằm ở [`reviews/slice-2-evidence-20261113/logs/`](reviews/slice-2-evidence-20261113/logs/), kèm `manifest.json`.

| Lệnh | Kết quả | Log |
|---|---|---|
| `npx vitest run tests/migrations-rollback.test.ts` (native, chạy trước) | 1 tệp · 3 test đạt | `migrations-rollback-2eb9437.log` |
| `npx vitest run --reporter=verbose` (native, PostgreSQL thật) | 41 tệp · **472 test đạt · 0 bỏ qua** | `vitest-native-2eb9437.log` |
| `npm run test` (PGlite) | 36 tệp đạt + 5 bỏ qua · 451 test đạt + 21 bỏ qua; ca bỏ qua là ca chỉ chạy trên native | `vitest-pglite-2eb9437.log` |
| `npx vitest run --coverage` | statements 94.99 · branches 86.55 · functions 96.55 · lines 96.13; ngưỡng 60 đạt | `coverage-2eb9437.log` |
| `npm run typecheck` | exit 0, không lỗi | `typecheck-2eb9437.log` |
| `rm -rf .next && npm run build` | exit 0; có `ƒ /inbox`, `ƒ /api/inbox/[[...path]]`, `ƒ /api/bridge/[...path]` | `build-2eb9437.log` |
| `python3 -m pytest tests/test_bot_bridge.py -q` | 55 đạt · 27 subtest đạt | `pytest-2eb9437.log` |
| Quét: mã nhóm `-100…`, `priority1`, chuỗi kết nối có mật khẩu | Chỉ có mã tổng hợp, cộng hai script có từ trước (mã đã che trong log). `priority1`: 0. Chuỗi kết nối có mật khẩu: 0 trong mọi log | `greps-2eb9437.log` |

Xanh ở đây nghĩa là mã khớp với test hiện có. Hai test plugin đang khẳng định đúng hai hành vi mà Codex vòng 3 xếp P0 (`tests/test_bot_bridge.py:599-604` và `:1052-1072`).

## Ca kiểm → test tự động

| Ca | Test (tệp · tên) | Ghi chú mức |
|---|---|---|
| DOC-01 | `intake` · «DOC-01 …», «intake authority comes from chatScopes…» | Mức mã; nhóm thật chưa mapping là kiểm runtime |
| DOC-02, 03, 04, 16 | `intake` các ca cùng tên; `test_bot_bridge` các ca reply/topic/album/tệp | Mức mã |
| DOC-12 | `outbox` · «DOC-12 …»; `test_backend_down_spools_and_recovery_replays…`; `outbox-crash` (native) | Mức mã, chỉ cho mất kết nối mạng. Vòng sửa thứ ba đã đóng đường mất tin khi 401 mà Codex vòng 3 nêu: `test_bot_bridge` có ca cho từng lớp lỗi, kiểm tin nằm đúng một trong ba chỗ (backend, spool, dead-letter) |
| PM-03 | `intake` · «(4) …»; `outbox` · «PM-03 …» | Mức mã |
| PM-07 | `outbox` · «PM-07 …»; `inbox-service` · «PM-07 reopening…»; `inbox-ui` · «PM-07 …» | Mức mã |
| Đồng thời cùng khoá | `intake-concurrency` · «two identical requests in parallel store exactly one source event» (native) | Mức mã |
| Outbox: rollback, tiến trình chết | `outbox-crash` · «a rolled-back business transaction leaves no outbox row», «a process that dies between write and send still delivers exactly once after restart» (native) | Mức mã |
| Đối soát hai kho | `ledger-reconcile` (7 ca) | OQ-09 mục (2) trên dữ liệu tổng hợp; nạp sổ thật dừng ở OQ-26 |
| SPEC-007 | 9 ca cũ `onboarding-feedback` giữ xanh + `account-approval-dm` + `access-change` | Ca (c) UAT thật: **không** tính |
| Quyền âm (1)–(7) | (1)(7) `bridge-io`; (2) `intake`, `inbox-http`; (3) `outbox-schema`, `outbox`, `inbox-service`, `bridge-limits`; (4) `intake`; (5) `inbox-service`, `intake-schema`, `test_bot_bridge`; (6) `account-approval-dm`, `test_bot_bridge` | (7) phần proxy thật là runtime |
| PM-01 (phần đọc) | không có test | **Không coi đạt**: chưa đọc được tin gốc và ticket Xeca («chờ tin gốc») |
| XI-01, XI-07 | không có test | Ca thật trên runtime, tính ở mức «đã dùng thật» |
| SLO thử | `intake-slo` (native) | Số đo trên dữ liệu tổng hợp, không phải cam kết |

**Số đo SLO thử** (một lần chạy native, 200 sự kiện tổng hợp): `{"slo_probe":{"events":200,"persist_ms_p50":3.1,"persist_ms_p95":3.7,"persist_to_receipt_queued_ms_p95":4,"persist_to_delivered_simulated_ms_p95":706.2,"projection":"not_measured: no intake projection in slice 2","overdue_listed_after_s":600}}` (PostgreSQL 16.15, máy cục bộ, head `2eb9437`). Lần chạy ở `8f181af`: p50 3.2 ms, p95 3.6 ms, xếp biên nhận p95 3.9 ms, «delivered» giả lập p95 962.4 ms. Lần chạy ở `6038014`: p50 2.8 ms, p95 3.3 ms, xếp biên nhận p95 3.6 ms, «delivered» giả lập p95 669 ms. Số «delivered» gồm cả thời gian chờ gom lượt kéo giả lập, **không** phải độ trễ giao thật; «projection» không đo được vì lát này không có bản chiếu intake (S4).

## Review hai tầng

Toàn văn ở [REVIEW-slice-2-20261113.md](reviews/REVIEW-slice-2-20261113.md) và thư mục [slice-2-evidence-20261113/](reviews/slice-2-evidence-20261113/).

- **Tầng 1.**
  - Bốn cổng review theo task. Ba reviewer toàn nhánh, mã, CSDL và bảo mật, đều ra «READY WITH FIXES», 0 Critical. Đợt sửa ở `2898def`, re-review hẹp sạch.
  - Kiểm tay giao diện tìm ra sáu lỗi UI-1…UI-6; cả sáu đã sửa.
  - `liberico-reality-checker` **chưa chạy**. Lệnh lát gọi nó trước khi biên nhận ghi «đạt»; biên nhận này ghi «chưa đạt cổng Codex».
- **Tầng 2 Codex.**
  - Vòng 1 (`2898def`): 3 P1 + 1 P2, sửa ở `2e37f17`.
  - Vòng 2 (`2e37f17`): 2 P1, sửa ở `2eb9437`. Đây là vòng sửa thứ hai, vòng cuối được phép.
  - Vòng 3 (`2eb9437`): xác nhận hai sửa vòng 2 đúng, nhưng có **2 P0 + 2 P1 mới**, đều ở mã mà các vòng trước không chạm. `planner` phân tích một lần: cả bốn hợp lệ. Planner xếp lại mức P1 · P0 · P1 · P1, và khuyến nghị Chairman cho một vòng sửa thứ ba theo lớp lỗi. Ở plugin, vòng đó áp một luật: «không đường nào xoá tin tiếp nhận; tin phải nằm ở backend, spool hoặc dead-letter». Tiếp theo là Codex vòng 4, vòng cuối. Sau đó P1 trở xuống ghi thành khoảng trống; P0 mới quay lại Chairman.
- **Sau cổng: quyết định OQ-27/28/29 (`8f181af`).**
  - Review task (`liberico-code-reviewer`): spec ❌ ở hai câu thông báo trên `/team` (I-1, I-2), sửa ở vòng 1, re-review: cả hai đã xử lý, không lỗi mới. 0 Critical.
  - I-3 (Important, hoãn sang OQ-30): cờ theo nhóm làm đường lỗi của finding Codex vòng 3 thứ ba xảy ra chỉ bằng một thay đổi cấu hình. Không sửa vì chưa có phép vòng sửa; ghi thành luật vận hành ở OQ-28/OQ-30 và khoảng trống 6.
  - Codex **chưa** review `8f181af`. Nếu Chairman cho vòng sửa thứ ba, Codex vòng 4 sẽ thấy cả commit này.
- **Vòng sửa thứ ba và OQ-30 (`9643b7f`, `1054222`, `82d30c6`, test `6038014`).**
  - Review task của vòng sửa: spec ✅, 1 Important (redirect và lỗi cục bộ bất ngờ đưa cả hàng chờ sang dead-letter) + 1 Medium từ review bảo mật tự động (tệp dead-letter không có trần). Hai vòng sửa, re-review: cả năm mục đã xử lý, không Critical/Important mới.
  - Review task của OQ-30 (`liberico-database-reviewer`): spec ✅, 0 Critical, 0 Important, 5 Minor (khoảng trống 22–24).
- **Codex vòng 4 (mã `6038014`, vòng cuối): CHANGES_REQUIRED, 1 P1 mới** (`intake.ts:51`, xem đầu biên nhận). Codex xác nhận bốn finding vòng 3 đã được xử lý trong mã. Lượt chạy đầu của vòng 4 không review được vì đầu vào vượt giới hạn 1 048 576 ký tự của Codex CLI; lượt chạy lại bỏ thư mục bằng chứng (log và biên bản, không có mã) khỏi diff gửi kèm, Codex vẫn đọc được thư mục đó trong repo.
- **Kết luận cổng:** **chưa đạt.** Còn 1 P1 chưa xử lý. Theo quyết định của Chairman, dừng hẳn và trình lại; không có vòng 5. Không merge; PR #10 giữ ở trạng thái nháp.

## Giao diện (kiểm tay, không phải nghiệm thu)

Phiên điều phối tự kiểm tay trên trình duyệt, ở chế độ máy chủ. Dữ liệu là CSDL thử `slice2_ui` chỉ có dữ liệu tổng hợp, trên PostgreSQL loopback, với ba tài khoản tổng hợp: điều phối, kỹ sư và chỉ xem. Kiểm ở hai khổ 1280×800 và 360×740. Bảng đầy đủ nằm ở [UI-HANDOFF-2-inbox.md](UI-HANDOFF-2-inbox.md), mục «Kiểm tay». Đây là kiểm của bên làm, không phải UAT hay nghiệm thu.

- **Đạt** ở cả hai khổ:
  - có tin, rỗng (chế độ demo), không quyền, tin chỉ con trỏ;
  - xung đột version, người không phải điều phối;
  - nhóm mới và nhóm đã có tin, `/approvals`, `/team`;
  - lỗi mạng: câu tiếng Việt kèm «Thử lại».
- Ở 360px: không cuộn ngang trên `/inbox`, `/approvals`, `/team`, và không có nút nào trên `/inbox` thấp dưới 44px.
- **Đang tải:** trạng thái tải của chi tiết tin thấy được ở 360px. Trạng thái tải cả trang (`loading.tsx`) chưa tái hiện được vì máy cục bộ tải quá nhanh, nên chỉ có test.
- **Chưa chạy:** thứ tự Tab, zoom 200%, screen reader, đo contrast. Ảnh chụp không lưu thành tệp.
- **Kiểm tay tìm ra sáu lỗi, UI-1 đến UI-6:**
  - `/inbox` trả HTTP 500 do truyền hàm qua ranh giới RSC; trùng finding I-1 của review mã;
  - ba thao tác của PM không tới được (bổ sung thông tin, ghi chú sự cố, danh sách trường thiếu);
  - giờ hiện dạng ISO thô, và mã mẫu tin thô;
  - lỗi mạng hiện nguyên văn «Failed to fetch».
  
  Cả sáu đã sửa ở `2898def` và `2e37f17`, rồi kiểm lại trên trình duyệt.

## Khoảng trống phải biết

1. **Chỉ đạt mức «đã có mã».** OQ-09 mục (1) chưa có bằng chứng ⇒ ProjectChannel không kích hoạt; theo brief, thiết kế inbox chưa có hiệu lực với dữ liệu thật cho tới khi cả hai chứng minh OQ-09 đạt. Mục (2) chỉ chạy trên sổ ticket tổng hợp (đường nạp sổ thật chờ OQ-26).
2. PM-01 «chờ tin gốc»; XI-01, XI-07 là ca runtime; SPEC-007 ca (c) UAT chưa chạy.
3. **Chưa gửi tin thật, chưa cài plugin, chưa khởi động lại gateway.** `send` thật và lịch kéo outbox chưa nối; plugin chỉ được thử với `send` giả. Spool chỉ xả khi có tin mới (tối đa 5 dòng mỗi tin, chưa có lịch). Từ vòng sửa thứ ba, khoá spool bận (`SPOOL_BUSY`) hay spool đầy không còn làm mất tin: tin sang tệp dead-letter. Phần còn lại của plugin ghi ở khoảng trống 21.
4. **Số bản plugin không đổi** (S7): mã plugin đổi nhiều nhưng `VERSION = "0.3.0"` và `plugin.yaml` `version: "0.2.1"` giữ nguyên; đặt số bản thuộc đợt cài plugin.
5. **`redactSecrets` là phòng thủ chiều sâu**, chỉ có tác dụng ở nhóm có cờ lưu trích. Kiểm soát chính là cờ theo nhóm (OQ-28 (c)): nhóm không cờ và dự án `IBS_HI` chỉ giữ con trỏ; cùng với quy tắc không gửi bí mật vào chat. Giới hạn đã biết:
   - còn sót: chữ tiếng Việt dạng tổ hợp NFD («mật khẩu»), `pw:`, «OTP 482913», khoá nhiều từ (`password key: x`, `token := x`, `'token' => 'x'`), JSON có escape, thân khoá PGP;
   - che quá tay câu thường («mật khẩu là gì?», «the secret is out»).
   - Đề xuất: chuẩn hoá NFC trước khi bật lưu trích cho dự án thật.
6. Chưa có đường ghi `project_domain_mappings` ⇒ mọi dự án thật hiện ở «Chưa xác nhận». Sau quyết định OQ-28 (c), việc lưu trích theo cờ của nhóm, nên điều này không còn chặn lưu trích. Hệ quả cần biết: luật «`IBS_HI` luôn chỉ con trỏ» chỉ có tác dụng khi dự án đã có dòng ánh xạ `IBS_HI`. Cho tới khi có đường ghi ánh xạ, ở dữ liệu thật luật đó chưa chặn được gì và chỉ cờ của nhóm quyết định. Khi khai cờ cho nhóm thật (điểm dừng triển khai), không được khai cho nhóm nào của IBS HI. (Luật tạm «không khai cờ cho nhóm đã có tin chỉ con trỏ» hết hiệu lực sau quyết định OQ-30 (b): bản sửa sau khi bật cờ được lưu chữ là hành vi đã quyết.)
7. **Migration 018 trên `identity.account_approvals` đã có dữ liệu thật** chỉ an toàn sau danh sách 8 bước trước khi áp trong [review CSDL](reviews/slice-2-evidence-20261113/tier1-database-review.md). Bước 4 trong đó: không login nào với tới hơn một role ứng dụng — `assertRestrictedLogin` (`src/server/db.ts`) từ chối kết nối như vậy. Hai lưu ý thêm:
   - Khi đã có một phiếu `access_change`, 018 chỉ sửa tiến được (tệp lùi từ chối).
   - `ALTER FUNCTION … OWNER TO libetech_outbox_audit` ở 017 cần login migration có quyền superuser hoặc là thành viên role đích.
8. Kiểm của trigger outbox chỉ chạy trên PostgreSQL thật ⇒ bộ native phải nằm trong cổng. Chưa có test đổi trạng thái bằng chính login `libetech_intake_svc`; test dùng login vận hành rồi `SET LOCAL ROLE`.
9. Nếu `intake.json` của plugin thiếu `chats`, biên nhận nhóm kết thúc `dead` với `TARGET_NOT_ALLOWED` cho tới khi PM xếp lại.
10. DM phiếu duyệt gửi lỗi chưa có bề mặt vận hành: Inbox chỉ liệt kê dòng gửi vào nhóm; cần quyết bề mặt ở lát sau. Cảnh báo outbox quá 10 phút chỉ hiện trong Inbox, chưa gửi cho người vận hành.
11. **Hoãn có chủ đích:**
    - Danh sách ứng viên mở tối đa 50 dòng, chưa có lọc hay phân trang. `link_ticket` có API nhưng chưa có nút. Nút xử lý outbox trên web chưa có (màn chỉ đọc).
    - `sourceRef` đầy đủ giữ làm locator theo brief. `actor_id` lấy từ GUC ứng dụng (thiết kế).
    - M-2/M-6/M-7 của review CSDL (thiết kế). Nút Có/Không 40px ở `/approvals` (có từ trước).
    - Biên nhận thành công sau khi gửi lại tệp đã lỗi, và gộp biên nhận theo album: chưa làm.
12. Thêm bước hỏi lại `needs_info → needs_info`; bảng chuyển trạng thái ở `docs/plans/slice-2-intake-outbox.md:370` chưa có dòng này. Tin trả lời có gọi bot (DOC-16) vẫn có biên nhận riêng cùng mã `IN-`: quyết định sản phẩm, trình Chairman.
13. **RED yếu** — test có trước nhưng lần đỏ không chứng minh hành vi:
    - Task 6 viết `outbox.ts` trước test; RED lấy bằng cách gỡ module.
    - Task 4 và Task 7: RED từ stub không có phương thức.
    - Task 9: phần lớn RED của phiếu đổi quyền là ZodError của lệnh lạ.
    - Task 10: hai trong năm ca đạt cả trên stub 404.
    - Ca race M4 ở đợt củng cố cổng 3 không có RED tất định.
14. **Lệch S12:** sáu commit do builder tự tạo theo chỉ dẫn của phiên điều phối sau khi nén ngữ cảnh: `0742c12`, `7c274db`, `f583afd`, `1ac732b`, `79a9e54`, `8164e54`. Nội dung đã qua review sau đó.
15. Rollback chỉ thử tiến → lùi → tiến trên DB tổng hợp (PGlite và PostgreSQL 16 loopback), chưa thử trên bản sao dữ liệu thật.
16. **Các màn khác vẫn hiện lỗi thô khi mất mạng:** `/approvals`, `/team`, tài liệu, đăng nhập. Lát này chỉ sửa Inbox (UI-6). Ở Inbox, phần nối nút «Thử lại» được chứng minh qua test đối chiếu mã nguồn và kiểm tay, không qua test render DOM, vì repo chưa có thư viện test DOM.
17. Sự kiện `outbox.taken` chưa ghi người giữ trước khi một quản lý khác nhận lại tin. Người giữ trước vẫn tra được qua chuỗi `intake_events` và version, nhưng không nằm ngay trong payload. Đây là Minor, để lát sau.
18. Hai helper test `outboxClock` và `versionAhead` (`tests/slice2-fixtures.ts`) ghi ở chế độ `session_replication_role='replica'` bằng login vận hành. Mục đích là lùi giờ lease và dựng ca giả mạo, vì guard 017 nay khoá các cột đó với mọi role, kể cả superuser. Chúng chỉ dùng trong test. Ở dữ liệu thật, muốn đổi các cột này phải đi qua một bước chuyển trạng thái, không sửa tay bằng SQL.
19. **Cắt thân yêu cầu quá trần** (vòng sửa Codex 2): helper hủy luồng ngay khi vượt trần. Trên máy chủ Next.js thật, việc hủy này có thể đóng kết nối trước khi câu trả lời 413 tới máy khách, nên máy khách gửi quá trần có thể chỉ thấy kết nối bị ngắt. Test dùng đối tượng `Request` trong cùng tiến trình, chưa chạy với máy chủ đang chạy. Plugin không bao giờ gửi quá trần, vì `fit_event` đã cắt trước.
20. **Bốn finding Codex vòng 3 đã sửa** ở vòng sửa thứ ba (xem đầu biên nhận). Hai phán quyết L240 và L241 bị thay bởi R3-1…R3-9.
21. **Plugin sau vòng sửa thứ ba — phần còn lại, có giới hạn và có log:**
    - Tệp dead-letter chưa có công cụ nạp lại; người vận hành đọc tệp và nhập lại. Bản ghi chỉ-con-trỏ (khi hook lỗi trước lúc dựng được sự kiện) không phát lại được.
    - Kênh bị từ chối mãi (401 do lệch đồng hồ hoặc lệch khoá, redirect, lỗi cấu hình): hàng chờ được giữ nguyên, spool đầy ở 1000 dòng, tin mới sang dead-letter tới trần 64 MiB. Sau đó tin mới **mất**, có log `INTAKE_LOST DEAD_FULL`. Đây là chỗ mất duy nhất còn lại; người vận hành phải theo dõi các mã `INTAKE_AUTH_DENIED`, `INTAKE_DEAD_FULL`, `INTAKE_LOST`.
    - Khi tệp dead-letter đầy, một dòng spool cần chuyển sang dead-letter sẽ chặn việc phát lại cho tới khi người vận hành dời tệp.
    - Kiểm trần ở đường trực tiếp không giữ khoá: tranh chấp có thể vượt trần một dòng hoặc một lô. Ghi thiếu khi đĩa đầy để lại nửa dòng.
    - Sau lỗi fsync hoặc rename, một tin có thể nằm ở cả spool và dead-letter; nhập tay lại có thể tạo bản trùng thật.
    - Spool không đọc được thì mọi tin mới sang dead-letter dù backend đang chạy.
    - Lỗi bên trong `intake_event` sau bước allowlist không để lại bản ghi con trỏ (cần một sự kiện gateway mà việc đọc thuộc tính ném lỗi).
    - Chú thích của `drain` và `_failure_kind` còn lệch chữ so với mã (chỉ là chú thích).
22. **OQ-30 (b) — phần chưa làm, theo quyết định là việc của lát sau:**
    - Chữ đã lưu trước khi cấu hình siết lại vẫn nằm trong bảng bất biến; Inbox ẩn, chưa có thủ tục xoá hoặc che có người duyệt.
    - Luật hiển thị (chế độ của bản sửa **và** cấu hình hiện tại) đang nằm riêng trong `src/server/inbox.ts`, và chữ bị ẩn vẫn được đọc từ CSDL rồi bỏ ở tầng dịch vụ. Trước khi lát 3–4 thêm chỗ đọc `source_event_revisions`, phải tách luật này thành mô-đun dùng chung (reviewer đề nghị thêm `CASE` trong SQL). Đây là điều kiện mở lát 3.
    - Tiến trình web phải đọc được tệp cấu hình vận hành (`LIBETECH_BRIDGE_CONFIG`) thì Inbox mới hiện chữ. Thiếu hoặc hỏng thì ẩn hết (fail-closed), có log mã `INBOX_EXCERPT_CONFIG`.
    - Payload sự kiện trong chi tiết ghi chế độ lúc lưu (`excerpt`) trong khi bản sửa đang hiện `hidden`; không lộ chữ hay hash.
    - Kiểm tay giao diện chưa chạy lại cho trạng thái «ẩn» mới; chỉ có test tự động. CSDL thử `slice2_ui` còn ở dạng 016 cũ.
23. **CSDL đã chạy bản 016 cũ trên nhánh này** (chỉ có ở máy phát triển; 016 chưa áp ở đâu thật) không tự nâng: phải lùi 018 → 017 → 016 rồi chạy lại, hoặc xoá kho PGlite cục bộ.
24. **Gợi ý «cùng nội dung» cho phép suy ra nội dung không hiện.** Hai ứng viên cùng dự án, một ở nhóm có cờ (hiện chữ), một ở nhóm không cờ: gợi ý trùng so hash trong SQL, nên người điều phối suy ra được tin không hiện chữ trùng với tin đang hiện. Có từ trước, không vượt ra ngoài một dự án. **Cần Chairman quyết** giữ hay bỏ gợi ý cho tin không hiện chữ.

## Điểm dừng — không làm, chờ Chairman

OQ-09 mục (1) (đường nhận thật song song priority1) · SPEC-007 ca (c) UAT thật · nối `send` thật và lịch kéo outbox trong gateway · triển khai d1-ai1 · áp 016–018 lên dữ liệu thật · cấp mật khẩu `libetech_intake_svc`, `intake.key`, đặt `INTAKE_DATABASE_URL` · khai `intake.excerptChats` cho nhóm thật (không khai cho nhóm của IBS HI) · cài plugin · khởi động lại gateway chung (~20 bot) · gửi tin vào nhóm hoặc DM thật · đổi privacy mode · sửa `AGENTS.md`/`CLAUDE.md` · merge PR. Kế hoạch trình duyệt triển khai phải có bản sao lưu đã thử phục hồi, cách rollback (tệp lùi 018 → 017 → 016, kèm điều kiện ở mục khoảng trống), danh sách bot bị ảnh hưởng, tránh 08:30 ngày làm việc và 16:00 thứ Sáu.

## Ngoài phạm vi (có từ trước, không sửa ở lát này)

- `src/server/accounts.ts:73`: `Promise.all` của nhiều `tx.query` trên cùng một client giao dịch (pg báo `DeprecationWarning`). Có từ `b91f219`.
- `scripts/setup-local-verification.ts:18` và `scripts/spec003-native-verify.ts:78` chứa mã nhóm trông như thật. Có ở merge base, đã theo dõi ở `docs/reviews/AUDIT-telegram-ids-20261112.md`.
- `tests/test_bot_bridge.py` dòng 1–110 là bản gốc đóng băng; có một tên mẫu trông như thật ở `:52`. Lát này không sửa các dòng đó.
- Plugin priority1 có một mã nhóm thật viết cứng, nằm ngoài repo này (S8). Lát này không chép và không sửa nó (`AGENTS.md:5`).

## Token theo công đoạn

Số do harness báo cho từng agent khi nó kết thúc, gồm cả token đọc từ cache. Với agent được nối lại, harness có lúc báo số của lượt cuối, có lúc báo số cộng dồn; dòng nào không chắc đều ghi rõ. Phiên điều phối không tự đo token của chính nó. Codex là công cụ ngoài, số lấy từ dòng «tokens used» trong log của Codex CLI, tách riêng vì đơn vị không cùng hệ.

| Công đoạn | Agent và chi tiết | Token |
|---|---|---|
| Kế hoạch | `planner` (Fable), lập kế hoạch 13 task | 336 353 |
| Viết | 11 builder Sonnet: T1 84 628 · T2 157 612 · T3 104 231 · T4 181 844 · T5 241 178 · T6 270 527 · T7 217 946 · T8 106 551 · T10 99 423 · T12 174 932 · T13 103 591 | 1 742 463 |
| Viết | Builder Opus: T4 vòng sửa 4–5 240 404 · cổng 2 vòng 4 273 356 · T9 97 818 · T11 333 250 + 227 678 (lượt nối lại) | 1 172 506 |
| Review theo cổng | Reviewer Opus: cổng 1 268 011 · cổng 3 302 968 · cổng 4 273 904 · cổng 2 không ghi được số | 844 883 |
| Review theo cổng | Re-review: 9 lượt Sonnet 1 313 654 · cổng 2 vòng 4 Opus 237 552 | 1 551 206 |
| Kiểm tay giao diện | Chuẩn bị môi trường thử `slice2_ui` (Sonnet) | 168 925 |
| Tầng 1 | Reviewer Opus: mã 192 553 · bảo mật 164 403 · CSDL 190 876 | 547 832 |
| Tầng 1 | Đợt sửa: builder Opus 245 780 · re-review hẹp Opus 142 833 | 388 613 |
| Vòng sửa Codex 1 | Builder Opus, lượt đầu 342 227; ba lượt nối lại harness báo 136 772 / 169 992 / 173 376, không rõ là cộng dồn hay từng lượt nên không cộng | 342 227 |
| Vòng sửa Codex 2 | Builder Opus | 269 209 |
| Kiểm cuối | `scout` (Sonnet), tám lệnh kiểm ở `2eb9437` | 89 799 |
| Phân tích sau vòng 3 | `planner` (Fable) | 162 977 |
| Quyết định OQ-27/28/29 | Builder Sonnet 149 398 · review task Opus 230 712 · re-review Sonnet 126 274 · kiểm lại `scout` Sonnet 78 475. Lượt nối lại builder harness báo 152 782, không rõ cộng dồn hay không nên không cộng | 584 859 |
| Vòng sửa thứ ba | Builder Opus 175 383 (hai lượt nối lại harness báo 212 145 và 221 782, không rõ cộng dồn nên không cộng) · review task Opus 231 762 · re-review Opus 162 565 | 569 710 |
| OQ-30 (b) | Builder Opus 196 117 (lượt nối lại 201 973, không cộng) · review task Opus 229 939 | 426 056 |
| Kiểm cuối ở `6038014` | `scout` (Sonnet) | 82 082 |
| **Cộng phía Claude (đo được)** | Không gồm phiên điều phối, review cổng 2 và các lượt nối lại chưa chắc | **9 279 700** |

| Codex (`codex exec --sandbox read-only`) | Vòng 1 385 310 · vòng 2 410 533 · vòng 3 413 452 · vòng 4 482 363 (lượt đầu bị từ chối vì quá dài, không tính) | 1 691 658 |

Planner ước vòng sửa thứ ba 300–450 nghìn token phía Claude; số đo được là 1 077 848, gồm cả việc OQ-30 (b) mà ước tính chưa tính tới.

## Phán quyết của phiên lát 2 (không phải quyết định của Chairman)

Phiên lát 2 tự quyết những chỗ kế hoạch và SPEC chưa nói, để lát không phải dừng. Không phán quyết nào thay quyết định của Chairman. Chairman có thể lật lại từng mục; mỗi dòng gốc đều ghi giá trị phải trả nếu sai.

- S1–S15 nằm ở [kế hoạch](plans/slice-2-intake-outbox.md), mục «Phán quyết của phiên lát 2». S13 (phiếu của Chairman trên phiếu đổi quyền), S14 (hình dạng cờ lưu trích) và S15 (thiết kế cho OQ-30 (b): chế độ ở bản sửa, bỏ cột ở sự kiện, ba chế độ hiển thị) thêm ngày 14/11/2026, sau các quyết định của Chairman.
- Toàn bộ dòng `Ruling` trong sổ theo dõi được chép nguyên văn (tiếng Anh) vào [controller-rulings.md](reviews/slice-2-evidence-20261113/controller-rulings.md).

Các mục chính:

- **Quy trình.**
  - Gộp review riêng thành bốn cổng (S11).
  - Builder không commit (S12); phần lệch ghi ở mục khoảng trống 14.
  - Cổng 2 mở lại khi lượt re-review bỏ sót một lỗi Important.
  - `redactSecrets` qua năm vòng sửa. Sau đó các cách viết hiếm ghi thành giới hạn đã biết, không mở thêm vòng, vì đây chỉ là phòng thủ chiều sâu.
- **016 và cầu nối.**
  - Quyền INSERT cấp theo cột.
  - FK của bản sửa tin gồm cả `source_event_id`.
  - `actor_id` lấy từ GUC ứng dụng.
  - Mỗi lần ingest dùng một `request_id`.
  - Kiểm theo thứ tự khoá → kích thước → HMAC → nonce → giới hạn tần suất. Bucket `bridge-intake` cho 600 lượt mỗi 60 giây.
- **017 outbox.**
  - Không dùng `project_channels` (OQ-09).
  - Trigger ép bảng chuyển trạng thái. `outbox_state_events` chỉ thêm, do CSDL tự ghi, và ràng vào version.
  - «Chứng minh bằng quyền» qua role NOLOGIN `libetech_outbox_audit`, theo mẫu `006`.
  - Mỗi biên nhận có savepoint riêng, nên một biên nhận hỏng không làm hỏng cả lô.
  - Cho phép `uncertain → dead`.
  - Sau Codex vòng 1: khi trạng thái không đổi, các cột lease, lượt và lỗi bị khoá với mọi role, kể cả superuser. Người đang giữ tin bấm nhận lại thì nhận 409, không ghi gì.
- **Biên nhận về nhóm.**
  - Tệp lưu lỗi thì xếp `intake.attachment_failed`, không báo thành công.
  - Biên nhận thành công sau khi gửi lại tệp, và gộp biên nhận theo album: hoãn.
  - Tin trả lời có gọi bot (DOC-16) vẫn có biên nhận riêng cùng mã `IN-`. Đây là quyết định sản phẩm, trình Chairman.
- **Thao tác PM.**
  - Tin quá hạn là tin chưa giao, tạo đã quá ngưỡng. Danh sách lỗi chỉ gồm dòng gửi vào nhóm.
  - Version lệch trả `REVISION_CONFLICT`.
  - Vai đọc Inbox theo brief; S5 chờ Chairman.
  - Cho phép hỏi lại `needs_info → needs_info`.
  - `ticket_ref` lệch sổ chỉ báo là xung đột.
- **SPEC-007 và 018.** `acknowledged_at` chỉ đặt một lần. 018 được review CSDL tầng 1 kiểm riêng.
- **Plugin.**
  - Dòng đầu spool sang dead-letter sau 5 lần backend trả lời lỗi có thể thử lại, hoặc khi đã nằm quá 24 giờ mà backend vẫn trả lời lỗi. Mất mạng thì dòng chờ để giữ thứ tự.
  - Tách bốn lớp lỗi: mạng / đã trả lời / tắt / cuối. **Thay ở vòng sửa thứ ba (R3-1…R3-9):** năm lớp — mạng (giữ, không đếm) · đã trả lời (đếm lượt, dead-letter sau 5) · kênh bị từ chối (401, redirect, lỗi cấu hình: dừng phát lại, giữ nguyên) · tắt · bị từ chối (403, 409, 413, 422…: dead-letter ngay kèm mã). Lớp «cuối = bỏ tin» không còn.
  - Tệp dead-letter có trần 64 MiB (R3-6, theo review bảo mật tự động của commit `9643b7f`). Hook lỗi trước khi dựng sự kiện để lại bản ghi chỉ-con-trỏ (R3-8).
  - Mỗi lần gọi hook: tối đa 2 giây, 1 POST mới và 5 lần phát lại.
  - `intake.json` có danh sách `chats`.
  - Không đổi số bản plugin (S7).
  - Tên mẫu ở phần test gốc đóng băng không sửa.
- **Ngoài phạm vi.** Hai script có từ trước chứa mã nhóm trông như thật; lát này không gỡ.
- **Review.**
  - Đợt sửa tầng 1 nhận cả bốn finding Important và các mục bắt buộc. Hoãn: phân trang, `sourceRef` đầy đủ, M-2/M-6/M-7 của review CSDL.
  - Codex vòng 1 và vòng 2: nhận mọi finding. Vòng 2 sửa luôn hai lỗi cùng loại mà Codex chưa nêu: thân yêu cầu web đọc không giới hạn, và câu trả lời 2xx không phải JSON bị coi là lỗi cuối.
- **Dừng sau Codex vòng 3.** Theo lệnh lát, không làm vòng sửa thứ ba, không push, không mở PR cho tới khi Chairman quyết. Tài liệu chỉ commit trên nhánh cục bộ. Thứ tự lệnh lát đặt quy tắc dừng trước bước giao PR, và push lên repo công khai khó gỡ hơn.
- **Sau quyết định của Chairman ngày 14/11/2026.** Push nhánh và mở PR nháp trước vòng sửa thứ ba. Commit trước khi review ở vòng này, để reviewer đọc một commit cố định trong khi builder khác đang sửa cây làm việc; bản sửa của plugin và việc OQ-30 chạy song song vì tệp và bộ test tách rời. Hai chỗ này lệch S12 và lệch «builder chạy lần lượt», đã ghi trong sổ.
