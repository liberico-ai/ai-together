VERDICT: CHANGES_REQUIRED

- [P1] `src/server/doc-approval-proposals.ts:236` — Kiểm hạn bằng `now()` dùng thời điểm bắt đầu giao dịch, nên phiếu có thể được rút sau khi đã hết hạn.
  Kịch bản: Lệnh rút bắt đầu ngay trước hạn 48 giờ, chờ khoá dòng quản trị đến sau hạn rồi tiếp tục → vẫn ghi `access_change_withdrawn`; người trình được trình lại ngay thay vì chờ 24 giờ.
  Căn cứ: OQ-48(b), OQ-51(b), Task 7c bước R5 và T7C-30.

- [P2] `src/components/review.tsx:298` — Quyền hiện biểu mẫu trình phiếu vẫn lấy từ dữ liệu ban đầu sau khi tải lại quyền dự án.
  Kịch bản: Điều phối bị hạ vai, lệnh trình trả `MANAGER_REQUIRED`; «Tải lại» nhận `canDesignate=false` và danh sách phiếu của mình, nhưng màn vẫn hiện biểu mẫu trình thay vì trạng thái `former`.
  Căn cứ: OQ-50(c), `docs/UI-HANDOFF-3-doc-approval.md` mục 4.

