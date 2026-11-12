# Review PR #4 — áp lời văn `AGENTS.md` (gói quyết định §5)

Base `208d37b045ceccb4bfd40d9a515a256a52406857` (`libetech-ai-os`). Chairman yêu cầu review ngày 12/11/2026, nguyên văn: «Review Codex trước». Codex chạy `codex exec --sandbox read-only`, head được ghim theo từng vòng. Verdict đọc từ dòng đầu tệp kết quả, không suy từ mã thoát. Lời nhắc dựa trên `docs/reviews/CODEX-REVIEW-PROMPT.md`, cộng các mục kiểm riêng cho PR này: A khớp nguyên văn, B điều kiện «Áp khi», C vị trí và nghĩa, D khẳng định về runner, E trạng thái và tài liệu khác, F trích lời Chairman.

## Vòng 1 · head `1554a0bf96a221a25a35b85e735c95393dc65711`

VERDICT: CHANGES_REQUIRED

- [P1] AGENTS.md:12 — Quy tắc báo cáo mới mâu thuẫn với mã hiện tại: tổng quan cộng số liệu của mọi dự án được cấp quyền mà không xét ánh xạ miền báo cáo.
  Kịch bản: tài khoản demo `manager` có quyền ở hai dự án chưa ánh xạ; `overview()` cộng số liệu của cả hai và trả một tổng, thay vì để chúng ở trạng thái «Chưa xác nhận».
  Căn cứ: OQ-04; ADR-002 v1.1 mục “Sổ dự án và nhãn miền báo cáo”; `src/server/service.ts:72-77`, `src/server/identities.ts:10`.

- [P2] docs/DECISION-PACK-OQ-20261112.md:81 — Ghi năm dòng đã được áp nhưng chưa làm rõ điểm dừng “sửa `AGENTS.md`” còn ghi ở §1 và brief các lát.
  Kịch bản: người thực hiện đọc §5 thấy lần sửa này đã duyệt, rồi đọc §1:16 hoặc `docs/SLICE-BRIEFS.md:13` vẫn thấy việc sửa `AGENTS.md` phải dừng chờ Chairman, dẫn tới hai chỉ dẫn trạng thái khác nhau cho cùng lần áp.
  Căn cứ: R10; `docs/DECISION-PACK-OQ-20261112.md:16`; `docs/SLICE-BRIEFS.md:13`.



**Xử lý (commit `92183b7`):**
- P1: không đổi lời văn đã duyệt. Mục §5 ghi rõ mã cũ `overview()` chưa tuân thủ, kèm lịch sửa ở lát 4 mục 7.
- P2: §1 và §5 ghi rõ lời duyệt này thoả điểm dừng «sửa `AGENTS.md`» cho năm dòng đã áp.

## Vòng 2 · head `92183b7bd5dfb6f8d304f103e098d8728a72b096` (sửa vòng 1)

VERDICT: CHANGES_REQUIRED

- [P2] AGENTS.md:12 — Dòng mới làm các con trỏ `AGENTS.md:13` trong brief, ADR-002 và OPEN-QUESTIONS trỏ sai.
  Kịch bản: người thực hiện theo `docs/SLICE-BRIEFS.md:143` để sửa quy tắc bot sẽ tới dòng danh tính demo; quy tắc bot hiện ở `AGENTS.md:14`.
  Căn cứ: `docs/SLICE-BRIEFS.md:9,143`; `docs/OPEN-QUESTIONS.md:106`; `docs/ADR-002-project-document-ownership.md:13,63,69`.

Hai finding vòng 1 đã được xử lý cho phạm vi PR này: §5 nêu rõ mã `overview()` chưa tuân thủ và lịch sửa ở lát 4; §1 và §5 làm rõ lời duyệt chỉ đáp ứng điểm dừng cho năm dòng đã áp. Việc áp quy tắc trước khi sửa mã là phạm vi lời duyệt của Chairman, không phải lỗi mới của bên viết.



**Xử lý (commit `a65b23e`):** chuyển hai dòng mới xuống cuối `AGENTS.md` (dòng 16–17), để mọi con trỏ `AGENTS.md:N` giữ nguyên vị trí như ở base. Không sửa ADR-002 vì đó là văn bản đã ký.

## Vòng 3 · head `a65b23ef3b016561c3e1614a765a4675d5c932cb` (sửa vòng 2, vòng sửa cuối được phép)

VERDICT: CHANGES_REQUIRED

- [P2] docs/DECISION-PACK-OQ-20261112.md:81 — Khẳng định “mọi con trỏ `AGENTS.md:N` … trỏ đúng dòng” quá rộng: vị trí dòng được giữ nguyên so với base, nhưng một con trỏ đã sai nghĩa từ trước.
  Kịch bản: người đọc theo `docs/SLICE-BRIEFS.md:9` để tìm quy tắc “handler mỏng → domain service → repository” tại `AGENTS.md:9` sẽ gặp quy tắc migration; nội dung kiến trúc nằm ở dòng 8.
  Căn cứ: `docs/SLICE-BRIEFS.md:9`; `AGENTS.md:8-9`. Đây là lỗi của khẳng định mới trong §5, không phải con trỏ bị PR làm lệch.



**Quyết định sau vòng 3:** đã hết hai vòng sửa được phép. Chairman quyết ngày 12/11/2026, nguyên văn: «Sửa câu rồi merge».

**Xử lý P2 vòng 3:** câu ghi chú trong §5 đã được thu hẹp. Câu mới chỉ khẳng định điều đã kiểm: các con trỏ `AGENTS.md:N` giữ nguyên vị trí so với base. Câu mới nói rõ lần áp không kiểm nội dung mà từng con trỏ muốn chỉ tới, và nêu con trỏ `SLICE-BRIEFS.md:9` đã sai từ trước nhưng chưa sửa. Không chạy thêm vòng Codex, theo quyết định trên.
