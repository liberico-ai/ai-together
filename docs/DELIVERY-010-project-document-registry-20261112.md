# Lát 1 · P1.0 — Sổ dự án, kênh nhóm đề xuất, sổ tài liệu, mẫu T0–T6 · 12/11/2026

## Bốn mức — ghi riêng, không gọi mức sau khi mới đạt mức trước

| Mức | Trạng thái | Căn cứ |
|---|---|---|
| **Đã có mã** | **Đạt** ở nhánh `slice-1-doc-ownership`, head `a319e10`, PR __PR__ (chưa merge) | Mục «Bằng chứng kiểm» |
| Đã triển khai | **Chưa.** Không triển khai d1-ai1; migration 013–015 chưa áp lên DB thật nào | Điểm dừng Chairman |
| Đã dùng thật | **Chưa.** Không người dùng thật; mọi dữ liệu là tổng hợp | — |
| Đã nghiệm thu | **Chưa.** Chưa có UAT hay chữ ký nghiệm thu | — |

## Căn cứ và quyết định

- Chữ ký ADR-002 1.1: Chairman, 12/11/2026, «Ký ADR-002 1.1» (Adoption record trong `docs/ADR-002-project-document-ownership.md`). Cho phép **viết** migration 013+, không cho áp lên dữ liệu thật.
- Gói quyết định OQ-01…21: `docs/DECISION-PACK-OQ-20261112.md` 0.2. Áp ở lát này: OQ-03 (b), OQ-04, OQ-05 (a), OQ-06 (a), OQ-07, OQ-11 (phần đề xuất), OQ-20, OQ-21 (a); R-01 và R-02 (gói §4).
- OQ mới khi lập kế hoạch, Chairman chốt ngày 12/11/2026 qua hộp chọn ở phiên điều phối (nhãn nguyên văn): OQ-22 «(b) Login vận hành (Recommended)»; OQ-23 «(a) Chưa bật (Recommended)»; OQ-24 «(b) Từ chối, chỉ tài liệu (Recommended)».
- **OQ-25 — danh sách host được phép cho liên kết nguồn: chưa quyết.** Phải chốt trước khi đưa `/documents`, `/api/documents`, `/api/projects` ra proxy công khai.
- `AGENTS.md` mục 5 do Chairman duyệt («Duyệt lời văn AGENTS.md mục 5») và đã merge qua PR liberico-ai/ai-together#4 (`ac01cf2`, «Sửa câu rồi merge»). Lát này không sửa `AGENTS.md`; nhánh đã merge `ac01cf2`.
- Brief: `docs/SLICE-BRIEFS.md:18-86`. Kế hoạch: `docs/plans/slice-1-doc-ownership.md` (Task 1–17) + Task 18 (màn chi tiết, bổ sung sau kiểm thực tế).

## Đã làm

| Việc brief | Kết quả | Tệp chính |
|---|---|---|
| 1 Sổ dự án | `project_profiles` (bảng phụ, không sửa `projects`), trạng thái qua state machine, ghi theo `expectedVersion` | `migrations/013_project_registry.sql`, `src/server/projects-registry.ts` |
| 2 ProjectChannel | Chỉ trạng thái `proposed`, không cấp quyền; `chatScopes` của gateway vẫn là nguồn hiệu lực; đề xuất theo version hồ sơ dự án | như trên |
| 3 DocumentRecord/Revision | Một `canonical_uri` https/dự án; revision bất biến; hai con trỏ độc lập, bản chuẩn rỗng «Chưa có»; hash chỉ `self_declared`; mọi tài liệu `SOURCE_NOT_FROZEN`; cổng P1.0 chặn ở RLS và quyền cột | `migrations/014_document_registry.sql`, `src/server/documents.ts` |
| 4 API | Đăng ký, đề xuất revision, chi tiết, mở nguồn (hai bước, hiện host), danh sách/tìm/xuất CSV theo dự án, sổ dự án | `src/server/documents-http.ts`, `src/app/api/documents/[[...path]]`, `src/app/api/projects/[...path]` |
| 5 Mẫu T0–T6 | Bảy tệp có version + sha256 trong `docs/templates/`, chỉ mục mẫu trong DB, script đồng bộ cho máy chủ | `docs/templates/`, `src/server/document-templates.ts`, `scripts/sync-document-templates.ts` |
| 6 Hai ca | XECA006/XECA005 và LBRC014 chỉ có trên dữ liệu tổng hợp trong test | `tests/slice1-cases.ts`, `tests/document-cases.test.ts` |
| 7 Nhãn, số bản | Một nguồn số bản (`package.json`); ba trạng thái cầu nối; «đã kiểm thực tế» không bật (OQ-23 a); không đụng `bot-plugin` | `src/server/version.ts`, `src/server/integration-status.ts` |
| 8 Bản chiếu Z2 (R-02) | `analytics.document_index` do projector có tên ghi bằng login vận hành (OQ-22 b); chạy lại không trùng; đánh dấu cũ/chưa chiếu; nguồn mất → `stale` | `migrations/015_document_index_z2.sql`, `src/server/document-projector.ts`, `src/server/document-index.ts`, `scripts/project-document-index.ts` |
| 9 R-01 | `resolve()` khoá report `FOR UPDATE` trước khi tra hành động cũ; nhận khoá bằng `INSERT … ON CONFLICT DO NOTHING RETURNING`; khoá lệnh tài liệu theo tenant+người (`document_commands`, OQ-24 b) | `src/server/feedback.ts`, `src/server/documents.ts` |
| Giao diện | Màn «Tài liệu dự án» (danh sách) và `/documents/[id]` (chi tiết); bốn trạng thái; sáu trạng thái nguồn; 360px | `src/app/documents/`, `src/components/documents*.tsx`, `src/components/document-detail.tsx`, `docs/UI-HANDOFF-1-documents.md` |

Migration 013–015 có tệp lùi cùng tên ở `migrations/rollback/`; tệp lùi không `CASCADE` và từ chối chạy sai thứ tự (015 → 014 → 013).

## Bằng chứng kiểm — head `a319e10`

Môi trường native: PostgreSQL 16.15 trong container Docker `libetech-slice1-pg`, chỉ nghe `127.0.0.1:55471`, DB thử `slice1_verify` dựng mới, dữ liệu tổng hợp; login runtime `libetech_web` (không superuser, không BYPASSRLS). Mật khẩu chỉ nằm trong tệp env ngoài repo. Log đầy đủ trong [`docs/reviews/slice-1-evidence-20261112/logs/`](reviews/slice-1-evidence-20261112/logs/); không log nào chứa chuỗi kết nối.

| Lệnh | Mã thoát | Kết quả | Log |
|---|---|---|---|
| `npx vitest run --reporter=verbose` (PGlite) | 0 | 21 tệp đạt, 2 bỏ qua; 226 ca đạt, 9 bỏ qua (ca chỉ chạy native: đồng thời, vai web) | `logs/vitest-pglite-a319e10.log` |
| `set -a; . $SLICE1_ENV_FILE; set +a; npx vitest run --reporter=verbose` (PostgreSQL thật) | 0 | 23 tệp, **235/235 ca đạt, 0 bỏ qua** | `logs/vitest-native-a319e10.log` |
| `npx vitest run --coverage` | 0 | Câu lệnh 92,82 · nhánh 81,34 · hàm 94,84 · dòng 94,01 (ngưỡng 60) | `logs/coverage-a319e10.log` |
| `npx tsc --noEmit` | 0 | Không lỗi | `logs/tsc-a319e10.log` (rỗng) |
| `rm -rf .next && npm run build` | 0 | Có `/documents`, `/documents/[id]`, `/api/documents/[[...path]]`, `/api/projects/[...path]` | `logs/build-a319e10.log` |
| `python3 -m pytest tests/test_bot_bridge.py -q` | 0 | 11 đạt (không chạm bot; chạy để chứng minh) | `logs/pytest-a319e10.log` |

Mã thoát và số liệu gom ở [`manifest.json`](reviews/slice-1-evidence-20261112/manifest.json). Trước `tsc` phải xoá các bản sao `.next/types/* 2.ts` do đồng bộ thư mục tạo ra (build output bị gitignore); không liên quan mã.

## Ca kiểm → test tự động

| Ca | Test (tệp · tên) | Động cơ |
|---|---|---|
| DOC-01 | `project-registry` · «a proposed channel grants nothing» (gọi cầu nối đã ký với `chatScopes={}` → `SCOPE_DENIED`, không sinh bản ghi) | cả hai |
| DOC-07 | `documents` · «proposing a revision moves only the draft pointer» | cả hai |
| DOC-10 | `document-index` · «cross-project and cross-tenant reads are denied before any query», «export is denied across projects»; `document-cases` · «openSource re-checks scope on every call…»; `documents-http` round trip | cả hai |
| DOC-13 | `document-cases` · «DOC-13 XECA006 and XECA005 are two separate index entries (synthetic — chờ tin gốc)» | cả hai |
| DOC-14 | `document-cases` · «DOC-14 LBRC014 keeps the earlier revision and the iOS supplement…» | cả hai |
| DOC-18 | `document-cases` · «DOC-18 a vanished linked source row shows as stale on the index; the record and history stay…»; `document-index` · «a lost source keeps its history» | cả hai |
| PM-08 (phần sổ) | `document-cases` · «PM-08 indexing leaves the Z2 source rows unchanged…»; `migrations-rollback` · «forward → rollback → forward leaves source tables untouched» | cả hai |
| R-01 | `feedback-concurrency` (3 ca, native), `feedback-idempotency` (8 ca, PGlite); `documents-concurrency` (3 ca, native, gồm OQ-24 buộc va chạm) | xem cột |
| R-02 | `document-index` · «projector writes one index row per record and is idempotent», «a principal recomputed after membership removal…», «C2: …pendingProjection / stale» | cả hai |
| Quyền âm (1) Xeca không thấy LBRC014 | `document-index` · «cross-project and cross-tenant reads are denied…»; `document-cases` · openSource | cả hai |
| (2) Không ngữ cảnh RLS → 0 dòng, kể cả Z2 | «new registry tables / document tables / the index return nothing without RLS context»; `rls-catalog` (ENABLE+FORCE, USING+WITH CHECK cho 9 bảng) | cả hai |
| (3) INSERT sang dự án/tenant khác bị từ chối | «runtime cannot insert…», «a project member cannot insert profile or channel rows for another project or tenant»; `fix-wave-db` «project A cannot update project B rows» | cả hai |
| (4) Bot không ghi | «non-manager, viewer, bot and outsider cannot write», «bot, viewer and outsider cannot register», «bot cannot read the document index» | cả hai |
| (5) Gửi lại không trùng; cùng khoá cho đối tượng khác bị từ chối | «same key … replays», «… IDEMPOTENCY_CONFLICT», «same key reused … in another project is IDEMPOTENCY_CONFLICT» | cả hai |
| (6) `expectedVersion` cũ bị từ chối, không audit/version | «stale expectedVersion … REVISION_CONFLICT with no event and no version change» (hồ sơ, kênh, revision) | cả hai |
| (7) Không snapshot; IBS HI chỉ con trỏ/hash | «runtime cannot set the approved pointer, a verified hash or a snapshot», «no document table has a content column» | cả hai |
| (8) Kênh đề xuất không cho đọc | «a proposed channel grants nothing» | cả hai |
| (9) Dự án chưa ánh xạ «Chưa xác nhận», không vào tổng | «unmapped project shows Chưa xác nhận and counts toward no total», «migration 013 ships no domain mapping row» | cả hai |

**Ca Xeca (XECA005/XECA006): chờ tin gốc.** Test xanh trên dữ liệu tổng hợp, **không** ghi là đạt. LBRC014 và XECA006 chỉ tồn tại trong fixture test; lát này không nhập dữ liệu thật.

## Review hai tầng

Xem [`reviews/REVIEW-slice-1-20261112.md`](reviews/REVIEW-slice-1-20261112.md). Codex: vòng 1 bốn P1 đã sửa, P2 giữ có lý do; vòng 2 không còn P0/P1, một P2 đã sửa; vòng 3 xác nhận: **PASS**, không có finding (head `a319e10`).

## Giao diện (kiểm tay, không phải nghiệm thu)

Bản chạy cục bộ chế độ máy chủ trên DB thử riêng `slice1_ui` (dữ liệu tổng hợp, tài khoản thử sinh ngẫu nhiên, ngoài repo), trình duyệt tích hợp:
- 360×740: `scrollWidth` = 360, không phần tử tràn, không vùng nhấn < 44px; danh sách, chi tiết LBRC014 (r2, r1, ba SHA), chi tiết XECA006 (trường thiếu «…: Chưa có»), bị chặn (không lộ tên), tìm không thấy («Không tìm thấy tài liệu khớp…» + «Xoá tìm kiếm»), đăng ký (POST 201 + thông báo `role="status"` kèm thời điểm chiếu), «Mở nguồn» hai bước (hiện host, `rel="noreferrer noopener"`).
- 1280×800: danh sách và chi tiết.
- **Chưa làm:** ảnh chụp lưu thành tệp trong `docs/` (công cụ chụp chỉ trả ảnh cho phiên); trạng thái lỗi và đang tải chỉ kiểm bằng test markup, chưa tái hiện trên trình duyệt; đo contrast, zoom 200%, screen reader.

## Khoảng trống phải biết

1. Chỉ đạt mức «đã có mã». Ba mức sau để trống tới khi Chairman duyệt triển khai.
2. Ca Xeca «chờ tin gốc»; LBRC014/XECA006 chỉ là fixture tổng hợp.
3. Rollback chỉ thử tiến → lùi → tiến trên DB thử tổng hợp (PGlite và PostgreSQL 16 loopback), chưa thử trên bản sao dữ liệu thật.
4. OQ-25 mở: chưa chặn host nguồn; không đưa các tuyến tài liệu ra proxy công khai trước khi chốt.
5. Projector chỉ chạy bằng login vận hành (OQ-22 b), chưa có job trên d1-ai1 (điểm dừng triển khai). Tài liệu mới chỉ hiện trong danh sách sau lần chiếu kế tiếp; giao diện báo rõ điều này.
6. Chỉ mục mẫu trên DB máy chủ cần chạy `scripts/sync-document-templates.ts <tenantId>` bằng login vận hành khi triển khai.
7. `feedback-idempotency` chạy trên PGlite; bằng chứng native cho R-01 là `feedback-concurrency`.
8. Tồn đọng chung của repo, không sửa ở lát này: `registry_events`/`audit_events` thiếu `request_id`/`trace_id` (E-DB-13); actor chưa ràng ở tầng DB (phán quyết R6); `overview()` (`src/server/service.ts:72-77`) chưa theo `AGENTS.md:16` — xếp ở lát 4.
9. Ngoài phạm vi diff: review bảo mật thấy 11 tệp có sẵn trong repo chứa mã nhóm Telegram dạng thật (ví dụ `deploy/pilot-scope.json`, `docs/TELEGRAM-*.json`) trong khi repo đang công khai tạm thời — cần Chairman quyết có làm sạch không.
10. Một số tên test ở `tests/document-index.test.ts` mang hậu tố «(synthetic — chờ tin gốc)» dù không dùng dữ liệu Xeca; nhãn thừa, không ảnh hưởng kết quả.

## Điểm dừng — không làm, chờ Chairman

Triển khai d1-ai1 · áp migration 013–015 lên dữ liệu thật · khởi động lại gateway chung · gửi tin vào nhóm thật · merge PR. Kế hoạch trình duyệt triển khai phải có bản sao lưu đã thử phục hồi, cách rollback (tệp lùi 015 → 014 → 013), danh sách bot bị ảnh hưởng (lát này không đụng bot), tránh 08:30 ngày làm việc và 16:00 thứ Sáu.

## Token theo công đoạn (để chỉnh `HANDOFF…` mục 10.2)

Số `subagent_tokens` do harness báo khi mỗi agent kết thúc; với agent được nối lại nhiều vòng, lấy số của lần kết thúc cuối. Phiên điều phối (Opus 5.5) **không đo được** trong phiên. Codex không dùng token Claude.

| Công đoạn | Mô hình | Số agent | Token |
|---|---|---|---|
| Kế hoạch | Fable 5.2 (`planner`) | 1 | 318.603 |
| Viết mã, test, migration | Sonnet (`builder`) | 21 | 2.280.974 |
| Viết mã nhỏ | Haiku (`builder`) | 1 | 73.198 |
| Chạy kiểm, tóm log | Haiku (`scout`) | 1 | 74.462 |
| Review từng task và re-review | Sonnet | 19 | 2.685.651 |
| Re-review đợt sửa lớn | Opus | 1 | 244.830 |
| Tầng 1 `liberico-*` toàn nhánh + kiểm thực tế | Fable (code) · phiên (db, security, reality) | 4 | 1.136.864 |

Nhận xét cho mục 10.2: review từng task bằng Sonnet tốn ngang phần viết mã (mỗi lượt ~130–165 nghìn vì nạp gói diff và brief); nên gộp review task nhỏ hoặc chỉ review task có migration/quyền, và để tầng 1 toàn nhánh làm lưới chính.

## Phán quyết của phiên điều phối (Chairman xem lại được)

R1 danh sách/tìm/xuất bắt buộc `projectId` (không cộng gộp miền; nay là `AGENTS.md:16`) · R2 người điều phối tự kiểm giao diện · R3 builder không commit · R4 nâng ca rollback hành động phản hồi thành bắt buộc · R5 `project_profiles.status` có CHECK và state machine (bảng chuyển trạng thái do phiên đặt, BoM Tech cần xác nhận) · R6 chưa ràng actor ở DB (tồn đọng) · R7 RLS không xét vai — vai kiểm ở domain service · R8 kiểu `DocumentRevision` và cổng `source_state` · R9 Task 16 không review riêng · R10 review cuối = tầng 1 · R11 tách M-1: phần không cần quyết làm ngay, allowlist → OQ-25 · R12 đợt sửa chia hai builder · R13 liên kết nguồn theo từng thẻ · R14 (rút lại) · R15 giữ P2 `projectId` · R16 thêm Task 18 màn chi tiết · R17 dùng vòng sửa Codex thứ hai cho P2 test.
