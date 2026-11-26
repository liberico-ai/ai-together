
## Việc (GIAO VIỆC 5, hạng mục D, kèm che ghi chú IBS HI ở Z2)

- **D, nguyên văn đề:** «Bot phải nói đúng nguyên nhân và cách xử lý: chưa liên kết tài khoản, không thuộc dự án, nhóm không được ghi sổ, thiếu quyền vai… mỗi mã lỗi một câu trả lời đúng, không câu chung chung. […] Câu báo lỗi cũng không được lộ tên dự án hay dữ liệu của BU khác. Có test riêng.»
- **Che Z2:** OQ-62 câu 4 (b) «che» (không phải xoá), do phiên điều phối quyết theo uỷ quyền Chairman 25/11/2026 17:48. Chữ ghi chú của dòng IBS HI phải không còn đọc được bởi ứng dụng và projector, nhưng còn trong CSDL cho người vận hành.
- **Kế hoạch:** `docs/plans/gv5-d-bot-replies.md`. Câu tạm: Q-GV5D-1, Q-GV5D-2 (cuối `docs/OPEN-QUESTIONS.md`).

**Cổng:** chạy một vòng. Chỉ P0 chặn merge (rò dữ liệu, leo quyền, mất dữ liệu); P1 và P2 ghi vào biên nhận và sửa tiến. Vẫn xếp hạng mọi finding theo thang của lời nhắc trên.

**Đầu vào:** diff so với `8d1e7a4` (bản 0.9.2), gồm `src`, `migrations`, `scripts`, `bot-plugin`, `tests`, `vitest.config.ts`, `package.json`.

## Đã đổi

- `bridge.ts` thêm trường `reason` vào năm chỗ từ chối `SCOPE_DENIED`; mã và status giữ nguyên, phạm vi đọc giữ nguyên.
- Plugin 0.3.4: bảng câu trả lời theo (mã, reason, status); lệnh trả câu thay vì mã trơ; công cụ đọc trả `reply` kèm lời dặn gửi nguyên văn.
- Migration 029 và rollback: chuyển ghi chú dòng IBS HI sang `analytics.tech_source_notes_held` (RLS bật và ép, không policy, không quyền cho vai `libetech_*`), trigger chặn ghi mới, trigger chuyển ghi chú khi một dự án được xác nhận `IBS_HI`.
- Importer ảnh chụp nguồn ghi ghi chú rỗng cho IBS HI; luật nhãn IBS dùng chung ở `src/server/ibs-label.ts`.

## Điều muốn được soát kỹ

1. Có đường nào để vai ứng dụng, projector hay vai khác của `libetech_*` đọc được chữ trong bảng giữ không (hàm DEFINER, view, trigger, quyền mặc định)?
2. 029 và rollback có mất chữ ở trạng thái nào không (chạy lại, trùng khoá, dòng nguồn bị xoá, dự án đổi miền)?
3. `reason` có làm lộ gì về dự án cho người không thuộc dự án không?
4. Câu trả lời của bot có đường nào chép nội dung máy chủ gửi về (chuỗi tự do, bí mật) không?
