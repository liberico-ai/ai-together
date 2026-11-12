# Review lát 1 (P1.0) — `slice-1-doc-ownership`

Ngày 12/11/2026. Hai tầng theo `docs/HANDOFF-CLAUDE-CODE-20261111.md` mục 10.3. Base ghim: `libetech-ai-os` @ `ac01cf215deb0d384d7b519cc209ff9aa3e79ac1` (sau PR liberico-ai/ai-together#4). Nhánh cắt từ `208d37b` và đã merge `ac01cf2` trước cổng Codex. Mã thoát 0 của Codex không tự là PASS; verdict đọc ở dòng đầu tệp kết quả. Tầng 1 cùng họ mô hình với bên viết nên không tính là kiểm độc lập.

Toàn văn từng lượt nằm trong [`slice-1-evidence-20261112/`](slice-1-evidence-20261112/).

## Tầng 1 — reviewer nội bộ

| Lượt | Reviewer | Head | Verdict | Tệp |
|---|---|---|---|---|
| Review từng task (17 task + Task 18) | general-purpose (Sonnet), mỗi task một lượt; vòng sửa có re-review hẹp | từng commit | Tất cả «Approved» sau vòng sửa; điểm nhỏ ghi sổ | sổ theo dõi của phiên (ngoài git) |
| Review toàn nhánh — mã | `liberico-code-reviewer` (Fable 5.2) | `46439aa` | CHANGES: 6 phải sửa, không Critical | [tier1-code-review.md](slice-1-evidence-20261112/tier1-code-review.md) |
| Review toàn nhánh — CSDL | `liberico-database-reviewer` | `46439aa` | NEEDS WORK: 3 Important, không Critical | [tier1-database-review.md](slice-1-evidence-20261112/tier1-database-review.md) |
| Review toàn nhánh — bảo mật | `liberico-security-reviewer` | `46439aa` | PASS có điều kiện: 1 Medium (M-1), không Critical/High | [tier1-security-review.md](slice-1-evidence-20261112/tier1-security-review.md) |
| Kiểm thực tế trước biên nhận | `liberico-reality-checker` | `4f9771e` | NEEDS WORK — chỉ được ghi «đã có mã»; 3 khoảng trống thật đã làm ở Task 18 | [tier1-reality-check-4f9771e.md](slice-1-evidence-20261112/tier1-reality-check-4f9771e.md) |
| Re-review đợt sửa cuối (A+B), vòng 1–3 | general-purpose (Opus, rồi Sonnet) | `d411054`, `9e04bb9`, `04b6c71` | 21/22 → 6/6 → 2/2 đã xử lý | sổ theo dõi |
| Re-review sửa Codex vòng 1 + Task 18 | general-purpose (Sonnet) | `902a500` | Tất cả đã xử lý | sổ theo dõi |

Ngoài ra, plugin `security-guidance` tự review các commit và nêu ba điểm: trạng thái/quyền ghi của `project_profiles`, tham số mang khoá trong fragment, `%3D` trong fragment. Cả ba đã sửa (`6c3924b`, `9e04bb9`, `ef905e6`). Hai điểm nó nêu về ràng buộc actor ở tầng DB và RLS không xét vai được ghi là tồn đọng hoặc không áp dụng (phán quyết R6, R7 trong biên nhận DELIVERY-010).

**Xử lý review toàn nhánh:** một đợt sửa chia hai builder có tệp không giao nhau (CSDL/server `d411054`; giao diện `750efb7`), rồi ba vòng nhỏ (`9e04bb9`, `04b6c71`, `ef905e6`). Điểm M-1 (allowlist host nguồn) tách thành **OQ-25, chưa quyết**; lát 1 đã làm phần không cần quyết: hiện host trước khi mở, mở bằng liên kết người dùng bấm, từ chối tham số mang khoá ở query/fragment/path, DB chỉ nhận `https://`, `openSource` kiểm lại mỗi lần.

## Tầng 2 — Codex (`codex exec --sandbox read-only`)

Lời nhắc: `docs/reviews/CODEX-REVIEW-PROMPT.md` + phần «Lát / Ghim / Bối cảnh đã chốt» + `git diff --merge-base <base> <head>`.

| Vòng | Base | Head | Verdict | Finding | Xử lý |
|---|---|---|---|---|---|
| 1 | `ac01cf2` | `4f9771e` | CHANGES_REQUIRED | 4 P1 · 1 P2 | P1 sửa ở `2be2dcb`. P2 (`projectId` bắt buộc) **giữ có chủ đích**: `AGENTS.md:16` cấm cộng gộp báo cáo giữa miền; dự án chưa ánh xạ không vào tổng nào (OQ-04); tìm chéo dự án để lát 4 |
| 2 | `ac01cf2` | `24c67f5` | CHANGES_REQUIRED | 0 P0/P1 · 1 P2 (test OQ-24 chưa buộc va chạm) | Codex xác nhận 4 P1 vòng 1 đã xử lý. P2 sửa ở vòng sửa thứ hai (test-only) |
| 3 (xác nhận hẹp) | `ac01cf2` | `a319e10` | **PASS** | Không có finding; không thấy P0/P1 mới khi rà diff toàn nhánh | — |

Toàn văn: [codex-round-1.md](slice-1-evidence-20261112/codex-round-1.md), [codex-round-2.md](slice-1-evidence-20261112/codex-round-2.md), [codex-round-3.md](slice-1-evidence-20261112/codex-round-3.md).

**Kết luận cổng:** không còn finding P0/P1 của Codex chưa xử lý. P2 duy nhất còn mở là `projectId` bắt buộc ở vòng 1, giữ có chủ đích theo `AGENTS.md:16`.

Codex không chạy được Vitest trong sandbox chỉ đọc (Vite cần tạo tệp tạm); kết quả test nằm ở biên nhận DELIVERY-010.
