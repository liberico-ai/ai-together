# Review lát 2 (P1.1) — `slice-2-intake-outbox`

Ngày 13–14/11/2026. Hai tầng theo `docs/HANDOFF-CLAUDE-CODE-20261111.md` mục 10.3. Base ghim: `libetech-ai-os` @ `ce11242bf6f476fe4c653730eca083c0b7c81315`. Mã thoát 0 của Codex không tự là PASS; verdict đọc ở dòng đầu tệp kết quả. Tầng 1 cùng họ mô hình với bên viết nên không tính là kiểm độc lập.

Toàn văn từng lượt nằm trong [`slice-2-evidence-20261113/`](slice-2-evidence-20261113/) (đường dẫn máy cục bộ đã thay bằng `<worktree>`, `<scratchpad>`).

## Tầng 1 — reviewer nội bộ

Theo phán quyết S11, review từng task gộp thành bốn cổng thay vì bảy; tầng 1 toàn nhánh là lưới chính. Task 12 (màn Inbox) và Task 13 (SLO, kiểm toàn bộ) không có cổng riêng theo kế hoạch.

| Lượt | Reviewer | Phạm vi · head | Verdict | Tệp |
|---|---|---|---|---|
| Cổng 1 (Task 1–4: 016, cầu nối, ingest) | reviewer task (Opus); re-review Sonnet | `1cb545a..e3d5c1f` | Needs fixes: 0 Critical · 2 Important · 12 Minor. Năm vòng sửa (bốn vòng cho `redactSecrets`: phủ rộng, ReDoS, khoá camelCase, bộ tách token, khoá hai từ dính) → sạch ở `82788e2` | [gates/review-gate-1.md](slice-2-evidence-20261113/gates/review-gate-1.md), `…-round-1..5.md` |
| Cổng 2 (Task 5–6: 017, outbox) | reviewer task (Opus); re-review Sonnet, vòng 4 Opus | `82788e2..cd2b98f` | Needs fixes: 0 Critical · 1 Important (thay đổi trạng thái DM không có audit) · 10 Minor. Bốn vòng sửa: audit mọi đổi trạng thái → ràng sự kiện vào version → DB tự ghi sự kiện → «chứng minh bằng quyền» (role NOLOGIN `libetech_outbox_audit`) → sạch ở `7c274db` | [gates/review-gate-2.md](slice-2-evidence-20261113/gates/review-gate-2.md), `…-round-1.md`, `…-round-4.md` |
| Cổng 3 (Task 7–9: thao tác PM, đối soát, 018) | reviewer task (Opus); re-review Sonnet | `7c274db..8164e54` | Approved: 0 Critical · 0 Important · 12 Minor; tám Minor làm ngay ở `1c11945`, re-review sạch | [gates/review-gate-3.md](slice-2-evidence-20261113/gates/review-gate-3.md), `…-hardening.md` |
| Cổng 4 (Task 11: plugin) | reviewer task (Opus); re-review Sonnet | `1371a25..7e73e7f` | Needs fixes: spec ❌ ×2 · 0 Critical · 3 Important · 11 Minor. Một vòng sửa → sạch ở `eb4804f` | [gates/review-gate-4.md](slice-2-evidence-20261113/gates/review-gate-4.md), `…-round-1.md` |
| Toàn nhánh — mã | `liberico-code-reviewer` (Opus) | `121d35a` | READY WITH FIXES: 0 Critical · 2 Important (`/inbox` HTTP 500 do truyền hàm qua ranh giới RSC; thao tác PM không tới được trạng thái máy chủ có) · 9 Minor | [tier1-code-review.md](slice-2-evidence-20261113/tier1-code-review.md) |
| Toàn nhánh — CSDL | `liberico-database-reviewer` (Opus) | `121d35a` | READY WITH FIXES: 0 Critical · 1 Important (bất biến thành viên role của 017 chưa được ép) · 9 Minor; 018 an toàn trên dữ liệu thật **sau** danh sách 8 bước trước khi áp | [tier1-database-review.md](slice-2-evidence-20261113/tier1-database-review.md) |
| Toàn nhánh — bảo mật | `liberico-security-reviewer` (Opus) | `121d35a` | READY WITH FIXES: 0 Critical · 1 Important (`redactSecrets` sót cách viết tiếng Việt/thường, `Authorization: Basic`, khối PEM) · 7 Minor | [tier1-security-review.md](slice-2-evidence-20261113/tier1-security-review.md) |
| Đợt sửa toàn nhánh + re-review hẹp | builder (Opus) · re-review hẹp (Opus) | `2898def` | Mọi finding đã xử lý; không Critical/Important mới; 1 Minor mới (che quá tay câu thường) | [tier1-fix-wave-rereview.md](slice-2-evidence-20261113/tier1-fix-wave-rereview.md) |
| Kiểm thực tế trước biên nhận | `liberico-reality-checker` | — | **Chưa chạy.** Lệnh lát gọi nó trước khi biên nhận ghi «đạt»; biên nhận ghi «chưa đạt cổng Codex». Sẽ chạy trước khi biên nhận đổi sang «đạt» | — |

Kiểm tay giao diện của phiên điều phối (chế độ máy chủ, DB thử `slice2_ui`, dữ liệu tổng hợp) thêm sáu finding UI-1…UI-6; UI-1…UI-5 sửa ở `2898def`, UI-6 sửa cùng vòng sửa Codex 1.

## Tầng 2 — Codex (`codex exec --sandbox read-only`)

Lời nhắc: `docs/reviews/CODEX-REVIEW-PROMPT.md` + phần «Lát / Ghim / Bối cảnh đã chốt» + `git diff --merge-base libetech-ai-os` tại head. Phần bối cảnh của từng vòng lưu cạnh kết quả (`codex-context-round-N.md`).

| Vòng | Base | Head | Verdict | Finding | Xử lý | Tệp |
|---|---|---|---|---|---|---|
| 1 | `ce11242` | `2898def` | CHANGES_REQUIRED | 3 P1 · 1 P2 | Nhận cả bốn, sửa ở `2e37f17`: (P1) 017 khoá cột lease/lượt/lỗi khi trạng thái không đổi, với mọi role; đổi người nhận xử lý chỉ cho `libetech_runtime` kèm version+1 · (P1) `delivered` bắt buộc có mã tin Telegram, ở schema và hai CHECK · (P2) gửi lại biên nhận chỉ tính `replayed` khi kết quả, mã tin và mã lỗi đều khớp, khác thì `RECEIPT_CONFLICT` · (P1) plugin chỉ đóng biên nhận khi `accepted + replayed + rejected` khớp lô, sai thì `RECEIPT_RESPONSE_INVALID` và không ghi gì. Cùng vòng: UI-6 (câu lỗi mạng tiếng Việt, nút «Thử lại» cho chi tiết tin); người đang giữ tin bấm nhận lại → 409 `OUTBOX_ALREADY_TAKEN`, không ghi | [codex-round-1.md](slice-2-evidence-20261113/codex-round-1.md) |
| 2 | `ce11242` | `2e37f17` | CHANGES_REQUIRED | 2 P1 (xác nhận bốn sửa vòng 1 có trong mã) | Nhận cả hai, sửa ở `2eb9437` (vòng sửa thứ hai, vòng cuối được phép): (P1) thân yêu cầu cầu nối đọc theo luồng, quá trần thì hủy reader và trả 413 kể cả khi không có `Content-Length`; cùng loại lỗi ở thân yêu cầu web (`body()`, 16 KB) sửa luôn bằng cùng helper · (P1) plugin chỉ coi tin là đã lưu khi nhận đúng `IntakeAck` (`persisted: true` + `sourceEventId`). Mọi câu trả lời 2xx khác (`data:null`, thiếu `data`, không phải JSON, quá lớn, có `error`) được ghi `INTAKE_RESPONSE_INVALID`: tin vào spool, thử lại có đếm lượt, không bao giờ bị bỏ | [codex-round-2.md](slice-2-evidence-20261113/codex-round-2.md) |
| 3 | `ce11242` | `2eb9437` | CHANGES_REQUIRED | 2 P0 · 2 P1, đều mới (xác nhận hai sửa vòng 2 đúng) | **Chưa sửa.** Hai vòng sửa đã dùng hết. `planner` phân tích một lần (theo lệnh lát): cả bốn hợp lệ, xếp lại mức P1 · P0 · P1 · P1. Gốc của hai P0 plugin là phán quyết L241 và L240. P1 `intake.ts:80` do kế hoạch tự mâu thuẫn, đã ghi **OQ-30**. P1 `intake.ts:28` là lỗi mã mà test hiện có che mất. Khuyến nghị: Chairman cho vòng sửa thứ ba theo lớp lỗi, rồi Codex vòng 4 là vòng cuối. **Chờ Chairman** ([phân tích](slice-2-evidence-20261113/codex-round-3-analysis.md)) | [codex-round-3.md](slice-2-evidence-20261113/codex-round-3.md) |

**Kết luận cổng tầng 2: chưa đạt.** Sau hai vòng sửa, Codex vòng 3 còn 2 P0 + 2 P1. Cả bốn đều mới, ở mã các vòng trước không chạm, và đều được xác nhận hợp lệ. Theo `.claude/skills/slice` bước 6, lát dừng ở đây và hỏi Chairman. Không có vòng sửa thứ ba nếu Chairman chưa cho. Không merge.

Codex không chạy được Vitest trong sandbox chỉ đọc; kết quả test nằm ở biên nhận DELIVERY-011.
