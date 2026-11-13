# Review — chặn host nguồn tài liệu theo OQ-25

Chairman quyết OQ-25 ngày 13/11/2026, nguyên văn: «(a) Allowlist cố định». Chairman giao viết mã ngay trong phiên điều phối, nguyên văn: «Làm ở đây».

Base `a8ee02bd238e99178d8be39eecc90c9294f01a8e` (`libetech-ai-os`). Nhánh `fix/oq-25-source-host-allowlist`, đặt trên `docs/oq-25-decision` (PR liberico-ai/ai-together#8, chỉ ghi lời quyết định).

## Thay đổi

- `src/server/source-hosts.ts`: danh sách host cố định, bị đóng băng: `drive` → `docs.google.com`, `drive.google.com`; `git` → `github.com`; `vault` không có host nào. Khớp đúng tên host, không nhận tên miền con, chỉ cổng https mặc định. Hàm `sourceHostProblem` không bao giờ ném lỗi.
- `src/server/documents.ts`: schema đăng ký từ chối liên kết có host ngoài danh sách của loại nguồn đó. `openSource` kiểm lại mỗi lần mở, trả `href` đã kiểm và không nhắc lại liên kết đã lưu trong lỗi.
- `src/components/documents.tsx`: tắt lựa chọn Vault trong form đăng ký; dòng gợi ý host được phép, nối với ô liên kết bằng `aria-describedby`.
- Liên kết `url` trong `sourceRefs` của revision không bị giới hạn host, vì trang chi tiết chỉ hiện chúng dạng chữ. Có test UI khẳng định điều đó.
- Test: `tests/source-host-allowlist.test.ts` (đơn vị và dịch vụ), ca HTTP 422 không ghi gì, ca UI. Fixture test tài liệu chuyển từ `example.com` sang `docs.google.com`.

## Tầng 1 · head `e161cb0`

**Bảo mật** (`liberico-security-reviewer`): không có finding Critical, High hay Medium. Thử 38 đầu vào; không đầu vào nào đăng ký hoặc mở được host ngoài danh sách. Ba finding Low:
- Câu kiểm «không nhắc lại liên kết» dùng `JSON.stringify(e)`, mà `AppError` không đưa `message` vào JSON, nên câu kiểm không bắt được việc nhắc lại.
- Hai ca có thông tin đăng nhập trong URL vẫn dùng `example.com`, nên đạt nhờ luật host chứ không nhờ luật thông tin đăng nhập.
- Không test nào khẳng định liên kết `url` trong revision chỉ hiện dạng chữ.

Ba ghi chú Info: `openSource` trả chuỗi đã lưu thay vì `href` đã kiểm; trong các host được phép vẫn có trang đồng ý OAuth của GitHub và Google Forms (giới hạn theo đường dẫn hoặc tổ chức thuộc BoM Tech); thành phần giao diện nhập tệp từ `src/server` không có chốt `server-only`.

**Mã** (`liberico-code-reviewer`): một P2 trùng finding thứ hai ở trên, xác nhận bằng thử đột biến (bỏ kiểm thông tin đăng nhập mà test vẫn xanh). Các P3: thiếu ca `http://` trên host được phép; tầng HTTP đổi mọi lỗi kiểm dữ liệu thành một câu chung nên lời báo về host không tới người dùng; dòng gợi ý chưa nối với ô nhập; thiếu test HTTP và UI cho phần mới.

**Xử lý (commit `2b8481c`):**
- Hai ca thông tin đăng nhập chuyển sang `docs.google.com`. Thử lại đột biến: bỏ kiểm thông tin đăng nhập thì 3 test đỏ.
- Các câu kiểm «không nhắc lại» kiểm cả `e.message` (test mới và hai test cũ).
- Thêm ca `http://` trên host được phép, ca HTTP 422 không ghi dòng nào, ca UI liên kết `url` không thành thẻ `<a>`.
- `openSource` trả `href` đã kiểm; dòng gợi ý có `aria-describedby`.
- Không làm trong PR này: câu báo lỗi chung ở `src/server/http.ts:11` (có từ trước); chốt `server-only` (repo chưa dùng, `src/components/workspace.tsx:6` nhập tương tự); giới hạn `github.com` theo tổ chức (BoM Tech).

Kiểm tại `2b8481c`: `npx tsc --noEmit` exit 0; `npx vitest run` 238 đạt, 9 bỏ qua. 9 ca bỏ qua cần PostgreSQL native, máy kiểm không có; `tests/documents-concurrency.test.ts` thuộc nhóm này và chỉ đổi host fixture. `npm run build` đạt ở `e161cb0`. Hai ca dịch vụ mới đỏ trên mã trước sửa.

## Tầng 2 · Codex vòng 1 · head `2b8481c952f9a08aaf71d7665e78a2593449a13b`

Lời nhắc: `docs/reviews/CODEX-REVIEW-PROMPT.md`, cộng phần bối cảnh riêng (quyết định OQ-25, các lựa chọn thiết kế, ba điểm kiểm thêm A–C), cộng diff `a8ee02b..2b8481c`. Codex chạy `codex exec --sandbox read-only`. Verdict đọc từ dòng đầu tệp kết quả.

VERDICT: PASS

Không có finding trong diff đã ghim. Đây là kết luận review mã và tài liệu, không phải xác nhận triển khai hay nghiệm thu.

## Kết luận

Codex PASS ở vòng 1, sau một vòng sửa theo tầng 1. PASS là kết quả review tĩnh. Mức hiện tại là «đã có mã»: chưa triển khai d1-ai1, chưa đưa `/documents` và `/api/documents` ra proxy công khai. Merge chờ Chairman duyệt.
