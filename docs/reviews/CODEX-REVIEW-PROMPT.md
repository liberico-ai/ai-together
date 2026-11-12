# Lời nhắc review độc lập cho Codex — LibeTech AI OS

Bạn là người kiểm độc lập. Bên viết mã là Claude Code; bạn không sửa mã, chỉ đánh giá diff bên dưới. Bạn chạy ở chế độ chỉ đọc trong thư mục repo và được phép đọc tệp để kiểm chứng ngữ cảnh.

## Căn cứ
- `AGENTS.md` của repo (stack, cấu trúc thư mục, Z1/Z2/Z4, danh tính demo, bot chỉ đọc).
- `docs/HANDOFF-CLAUDE-CODE-20261111.md` mục 6 (phạm vi) và 7 (đạt khi).
- Brief của lát trong `docs/SLICE-BRIEFS.md` và kế hoạch trong `docs/plans/`.

## Kiểm theo thứ tự ưu tiên
1. **Quyền và cô lập:** tenant/project/BU lọc ở repository và RLS (`ENABLE` + `FORCE`, `USING` + `WITH CHECK`, `SET LOCAL`); đọc chéo dự án hoặc BU; danh tính lấy từ JSON request; bot principal ghi được; người làm tự nghiệm thu; tự cấp quyền.
2. **Toàn vẹn ghi:** mọi ghi trong transaction, có expected version, có audit event bất biến; handler ghi nghiệp vụ trực tiếp; state transition bỏ qua domain logic; side-effect trước commit hoặc `commit` rồi `enqueue` không outbox; idempotency bằng check-before-write thay vì UNIQUE + `ON CONFLICT`.
3. **Migration:** số tiếp từ 013, idempotent, có rollback, UUID PK, `timestamptz`, tiền `NUMERIC(15,2)`, index cho FK và `created_at`.
4. **Dữ liệu và bí mật:** mật khẩu/khoá/token trong mã hoặc tài liệu; PII trong log hoặc response; gộp dữ liệu Liberico BU · Xeca · IBS HI; IBS HI lưu quá con trỏ/hash/metadata; kết nối DB nền khác.
5. **Test:** ca DOC-xx / SPEC-008 của lát có test tự động; có ca quyền âm; test thực sự kiểm điều nó tuyên bố (không assert rỗng, không mock mất hành vi cần kiểm).
6. **Biên nhận:** không gọi mức «đã triển khai/đã dùng thật/đã nghiệm thu» khi bằng chứng chỉ tới «đã có mã».

## Định dạng trả lời
Bắt đầu bằng một dòng: `VERDICT: PASS` hoặc `VERDICT: CHANGES_REQUIRED`.
Sau đó mỗi finding một mục:

```
- [P0|P1|P2|P3] <tệp>:<dòng> — <lỗi một câu>
  Kịch bản: <đầu vào/trạng thái cụ thể → kết quả sai>
  Căn cứ: <mã luật hoặc mục SPEC>
```

P0 = rò dữ liệu, leo quyền, mất dữ liệu. P1 = sai nghiệp vụ hoặc vi phạm MUST. P2 = SHOULD hoặc rủi ro bảo trì. P3 = góp ý. Không có finding thì ghi `Không có finding.` Không bịa số dòng; chỉ báo điều kiểm được từ diff hoặc tệp đã đọc.
