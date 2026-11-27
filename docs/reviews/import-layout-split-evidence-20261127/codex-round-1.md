VERDICT: CHANGES_REQUIRED

- [P1] `src/server/sheet-import.ts:87` — Danh sách tham chiếu có lặp từ dẫn không được loại hết, khiến mã việc gốc bị gán thành mã riêng của dòng.
  Kịch bản: Ghi chú `Tách từ LBRC015 và từ LBRC016` → chỉ `LBRC015` bị loại; dòng nhận mã `LBRC016` và có thể bị đánh dấu trùng với việc gốc.
  Căn cứ: Quy tắc GV-9 về danh sách mã trong ghi chú «Tách».

- [P1] `src/server/sheet-import.ts:87` — Biểu thức nuốt cả mã riêng khi mã đó đứng sau dấu phân cách của một tham chiếu.
  Kịch bản: Ghi chú `Tách LBRC015, LBRC052 là mã mới` → cả hai mã bị loại; dòng được đưa vào hàng chờ với mã rỗng thay vì `LBRC052`.
  Căn cứ: Quy tắc GV-9 chỉ loại mã tham chiếu tới việc gốc; mã riêng của dòng phải được giữ.