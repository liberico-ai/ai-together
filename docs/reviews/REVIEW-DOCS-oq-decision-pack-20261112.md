# Review PR tài liệu — `docs/oq-decision-pack-20261112`

Base `82292339584f5c6937c4d7c7a9ce39d3536619d8` (`libetech-ai-os`). Codex chạy `codex exec --sandbox read-only`; verdict đọc từ dòng đầu tệp kết quả, không suy từ mã thoát. Vòng 1 kiểm toàn bộ diff (trừ thư mục bằng chứng `step0-p1-evidence-20261112/` do Codex tự tạo); vòng 2 và 3 kiểm diff sửa và đọc lại tệp ở head.

## Vòng 1 · head `3bee5fb90e168fc3f439d15a9fe0c7ed2ccb5da4`

VERDICT: CHANGES_REQUIRED

- [P2] docs/SLICE-BRIEFS.md:101 — Câu “bot chỉ tạo ứng viên intake” giao quyền ghi cho sai principal. **Kịch bản:** builder cho bot ghi ứng viên theo brief lát 2. **Căn cứ:** ADR-002:36 và bảng Codex §4:76 giữ bot chỉ đọc, dành quyền ghi cho principal tiếp nhận riêng; chính brief cũng nói vậy tại dòng 93 và 104.
- [P2] docs/DELIVERY-009-repo-bootstrap-20261111.md:163 — Nhãn “bản đang chạy trên gateway” vượt quá readback ngày 08/11. **Kịch bản:** gateway đã thay đổi sau readback nhưng hồ sơ ngày 12/11 vẫn được dùng như xác nhận runtime hiện tại. **Căn cứ:** dòng 167 nói rõ lượt này không đọc lại gateway.
- [P2] docs/DELIVERY-009-repo-bootstrap-20261111.md:166 — Kết luận mọi tệp mã/test chung “chỉ khác ở phần lược cấu hình” tự mâu thuẫn với hồ sơ. **Kịch bản:** quyết định không chuyển tệp mã dựa trên tiền đề hai cây chỉ khác cấu hình. **Căn cứ:** dòng 164 ghi bản GitHub có thêm chốt `WORKBOOK_SOURCE_NOT_CONFIGURED` và test; cần mô tả chênh lệch chức năng này trong kết quả chọn lọc.
- [P3] docs/DELIVERY-009-repo-bootstrap-20261111.md:157 — “Lần chạy gần nhất 01/07/2026” được ghi `#fact` nhưng PR không kèm biên nhận Actions để kiểm. **Kịch bản:** người đọc coi ngày chạy gần nhất là đã xác minh từ repo. **Căn cứ:** workflow trong lịch sử Git xác nhận điều kiện push `main`, không xác nhận lịch sử các lần chạy; tuyên bố rà 89 phiên ở dòng 158 cũng thiếu con trỏ bằng chứng trong PR.

Các chốt OQ còn lại khớp lời Chairman và bảng Codex §4; ADR-002 vẫn **Proposed, chưa ký**. Không thấy tài liệu cho phép triển khai d1-ai1, migration thật, gateway restart, gửi tin thật hoặc tự sửa `AGENTS.md`.

Năm brief dài lần lượt **67, 66, 60, 57, 47 dòng**, đều ≤150. Lấy mẫu 8 con trỏ đều đúng nội dung: `ADR-002:22,33,73`; `SPEC-009:73,78,125,131`; `SPEC-008:220`. Repo vẫn sạch; chỉ kiểm đọc, không sửa tệp.



## Vòng 2 · head `4a59948` (sửa vòng 1)

VERDICT: CHANGES_REQUIRED

- [P3] docs/DELIVERY-009-repo-bootstrap-20261111.md:157 — Vẫn thiếu biên nhận Actions và deployment trong PR. Hai lệnh được nêu không cố định kết quả ngày 12/11; khi có run mới, người kiểm không thể dùng chúng để xác minh ảnh chụp đã công bố.
- [P3] docs/DELIVERY-009-repo-bootstrap-20261111.md:158 — Con trỏ tới một tệp chỉ có trên máy không chứng minh kết luận đã rà 89 phiên và không phiên nào triển khai lên lab. Cần biên nhận hoặc thu hẹp mức khẳng định.
- [P3] docs/DELIVERY-009-repo-bootstrap-20261111.md:164 — “Logic giống nhau” còn mâu thuẫn với chênh lệch chức năng được nêu ngay tại dòng 166. Kết quả chọn lọc ở dòng 166 đã sửa đúng; câu tổng quát này cũng cần sửa.

Finding về principal tại `SLICE-BRIEFS.md:101` và nhãn readback tại `DELIVERY-009…:163` đã được xử lý. Diff không cho thấy lỗi mới khác; repo vẫn sạch và tôi không sửa tệp.



## Vòng 3 · head `103dbce` (sửa vòng 2, vòng sửa cuối được phép)

VERDICT: PASS

Ba finding vòng 2 đã được xử lý: biên nhận Actions và deployment đã được lưu trong PR và khớp hash manifest; kết luận về 89 phiên đã được hạ thành suy luận chưa có biên nhận; câu về logic đã nêu rõ phần chức năng khác nhau. Không thấy lỗi mới trong diff. Repo sạch; tôi không sửa tệp.
