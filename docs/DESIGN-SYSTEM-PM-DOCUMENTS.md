# Mở rộng giao diện PM và tài liệu LibeTech

Version 0.1 · 11/11/2026 · Đặc tả UI, chưa đổi giao diện chạy thật. Liên kết [SPEC-009](SPEC-009-PM-BA-DOCUMENTS-20261111.md) và [bộ mẫu](PM-DOCUMENT-TEMPLATES.md).

## Căn cứ và nguyên tắc

Đã đọc `src/app/globals.css` cùng cấu trúc workspace, reports, approvals và BoM workspace. Đây là rà soát có mục tiêu, không chấm điểm toàn design system. Nền có màu xanh đậm, thẻ, bảng và các màn quyền; mở rộng cùng hệ thị giác. Chưa kiểm accessibility của runtime.

Ba phân biệt phải nhìn được ngay: **nguồn khai báo / đã kiểm**, **bản đang soạn / bản chuẩn đã duyệt**, **đã gửi / người nhận xác nhận**. Mỗi thẻ chỉ một hành động chính; thuật ngữ API/schema không xuất hiện trong luồng người dùng thông thường.

## Tokens kế thừa và bổ sung

| Nhóm | Hiện có trong CSS | Đề xuất áp cho màn mới |
|---|---|---|
| Brand | navy #122d2c; navy2 #1c3f3c; teal #147d6e | Giữ palette; không tạo màu brand riêng cho từng project |
| Nội dung | ink #203330; muted #73817a; bg #f6f8f5; line #e2e8e2 | Muted chỉ dùng sau kiểm tương phản với nền thật; nội dung cần đọc dùng ink |
| Trạng thái | amber #b67524; purple #77649c | Luôn có nhãn/icon; thêm semantic text/background/border theo trạng thái, kiểm tương phản trước áp |
| Chữ | Font hệ thống; có nhiều cỡ 9–12px | Body 14–16px; nhãn phụ tối thiểu 12px để pilot; tiêu đề 20/24/32; line-height 1.5. Không coi đây là tuyên bố đã đạt WCAG |
| Khoảng cách | Nhiều giá trị trực tiếp | Scale 4/8/12/16/24/32; form 16, giữa nhóm 24 |
| Hình dạng | radius 14px | Thẻ 14; field/button 8; pill chỉ dùng nhãn ngắn |
| Focus/motion | outline #34b59b; disabled có cursor wait | Focus nhìn rõ cả nền sáng/tối; disabled dùng giải thích quyền; chỉ busy mới chờ. Motion 120–180ms và tôn trọng reduced-motion |

Quyết định UI pilot: vùng nhấn chính tối thiểu 44×44px; giữ zoom và reflow; không tự công bố đạt chuẩn tiếp cận trước khi đo contrast/keyboard/screen reader. Các con số là thiết kế đề xuất cho màn mới, không sửa toàn bộ CSS trong gói này.

## Kiến trúc thông tin

Sidebar giữ không gian chung và danh sách dự án được phép. Trong dự án: **Tổng quan · Yêu cầu · Kế hoạch · Tài liệu · Quyết định · Hoạt động**. Trang cá nhân tổng hợp việc/cần review theo quyền; không công khai score người khác mặc định.

Trang Tài liệu:

```text
Xeca / Tài liệu                         [Đăng ký tài liệu]
Tìm trong dự án     Loại ▾   Trạng thái ▾   Chủ nội dung ▾

Nâng package theo npm audit             XECA006
Chủ nội dung: …  |  Kiểm nguồn gần nhất: …
Bản chuẩn: Chưa có      Bản đang soạn: r2 · Cần bổ sung
Thiếu: repo, báo cáo trước–sau, bản thực thử
[Mở bản soạn]     [Xem việc liên quan]

Khi xem chi tiết:
Nội dung | Thay đổi | Review | Liên kết bằng chứng | Lịch sử
Nguồn chính …   Phạm vi chia sẻ …   Người có quyền duyệt …
```

## Sáu thành phần mới

### 1. IntakeCard — yêu cầu có nguồn

**Bài toán:** tin từ nhiều nhóm chưa phải việc đã giao. Kế thừa thẻ feedback, thêm nguồn, loại, độ thiếu và đối soát trùng.

Properties: `candidateId`, `projectLabel`, `sourceRef`, `receivedAt`, `classification`, `missingFields[]`, `duplicateCandidates[]`, `permissions`, `version`.

Variants: incident (hiện impact/khôi phục), request (làm rõ), document (đăng ký nguồn). Hành động chính theo trạng thái: Xác nhận yêu cầu / Bổ sung thông tin; gộp trùng cần hiển thị đối tượng và căn cứ. Danh sách chỉ chứa dự án được phép, không trả tên dự án bị chặn.

### 2. DocumentRecord — hai phiên bản rõ ràng

Properties: `docId`, `type`, `title`, `owner`, `canonicalSource`, `draftRevision`, `approvedRevision`, `freshness`, `audience`, `capabilities`.

Variants: card trong mobile; row trong bảng; detail header. Hiển thị hai phiên bản, người duyệt và phạm vi; “Chưa có bản chuẩn” là nhãn trung tính, không tô xanh do đã upload. Mở nguồn là link có tên rõ; API kiểm quyền lại khi tải.

### 3. RevisionDiff — review đúng phần thay đổi

Properties: `baseRevision`, `candidateRevision`, `changedSections[]`, `affectedLinks[]`, `sourceChanged`, `comments[]`.

Desktop hai cột, mobile tuần tự; có chế độ chỉ phần đổi và xem đầy đủ. Không chỉ dùng đỏ/xanh: nhãn Thêm/Xóa/Sửa cùng đánh dấu ký tự. Comment gắn đoạn và revision; nguồn đổi trong lúc review hiện banner và nút Đọc bản mới. Phiếu đang soạn không tự chuyển revision.

### 4. DecisionCard — quyết định đúng người, đúng đối tượng

Properties: `decisionId`, `kind`, `revision`, `summary`, `quorum`, `votes`, `actorEligibility`, `expiresAt`, `appliedReceipt`.

Variants: document review (Chấp thuận/Yêu cầu sửa), reassignment (BoM 3/3), account admission (Chairman +1 BoM), publication (Công bố đúng nhóm). Hiển thị lý do không đủ quyền; 2/3 chưa áp dụng; đủ phiếu và đã áp dụng là hai trạng thái khác nhau. Nếu có nhiều phiếu, chữ “yes” đơn lẻ không chọn hộ phiếu.

Telegram: thẻ ngắn nêu tài liệu/việc, phiên bản, thay đổi và nhóm nhận, nút Có/Không hoặc Đúng/Cần sửa. Callback chỉ chứa ID mờ; server xác minh actor/chat/policy/revision, không dùng việc bấm nút làm bằng chứng quyền. Callback cũ trả “Bản này đã thay đổi. Mở bản mới để xem lại.”

### 5. TraceabilityPanel — nhìn phần đã đủ và còn thiếu

Properties: `requirementIds`, `workRef`, `documentRevisions`, `testEvidence`, `acceptanceEvents`, `gaps[]`, `observedAt`.

Chuỗi yêu cầu → tài liệu → việc → bằng chứng → nghiệm thu. Có danh sách thay thế sơ đồ để đọc bằng bàn phím. Bằng chứng hiển thị đã nhận/đã đọc/đúng bản/đã được người nghiệm thu; không gộp thành một badge PASS. Cho LBRC014, giữ status nguồn “Hoàn thành” cạnh kết luận đối soát “Còn thiếu bằng chứng nghiệm thu”, giải thích đây là hai trường khác nhau.

### 6. SourceAvailability — độ phủ và lỗi nguồn

Properties: `state`, `lastSuccessAt`, `sourceVersion`, `coverageStart`, `coverageGaps`, `retryAllowed`, `nextStep`.

States: fresh, stale, unavailable, denied, not-configured, partially-received. Hiển thị lỗi và hành động tương ứng; denied không rò metadata. Nhóm vừa add có “Chưa xác minh khả năng nhận tin”; không hiện “Đã kết nối đầy đủ” từ heartbeat.

## Trạng thái dùng chung và accessibility

| Trạng thái | Cách hiển thị / hành vi |
|---|---|
| Default/hover/active | Hành động và vùng focus rõ; hover không phải cách duy nhất để thấy chức năng |
| Loading | Skeleton trong vùng dữ liệu; aria-busy; không mất tiêu đề hoặc hiện số 0 giả |
| Empty | “Chưa có tài liệu đã đăng ký”, CTA theo quyền; phân biệt không có dữ liệu với bị chặn |
| Disabled | Nêu lý do cần quyền hoặc thiếu đầu vào; không hiện vòng chờ vô hạn |
| Submitting | Chặn double-click, giữ dữ liệu form; chỉ thành công sau receipt nghiệp vụ |
| Error | Lỗi cạnh trường + tóm tắt có focus; retry an toàn, giữ bản nháp |
| Conflict | Nêu bản nguồn mới, cho đọc diff và gửi lại; không âm thầm ghi đè |
| Success | Cập nhật trạng thái và live-region polite; không chỉ toast biến mất |

HTML semantics: dùng button/link đúng mục đích; table có caption/th; mỗi field có label; status role=status, lỗi chặn role=alert; dialog có tên, focus trap và trả focus khi đóng. Tab đi theo thứ tự đọc, Enter/Space kích hoạt nút, Escape đóng dialog không mất dữ liệu chưa lưu. Không thêm role=grid nếu chưa hỗ trợ toàn bộ điều khiển bàn phím tương ứng.

Không dùng màu làm bằng chứng trạng thái. Nội dung dài, SHA, URL phải wrap/copy riêng; màn 360px không cuộn ngang toàn trang. Người dùng được mở chi tiết kỹ thuật khi cần, mặc định nhìn kết quả/bước tiếp theo.

## Rollout và kiểm giao diện

Màn mới dùng tokens semantic có fallback về hệ cũ; chưa đổi tên hoặc xóa props của component đang dùng. Trước merge đo contrast, kiểm zoom200%, keyboard và screen reader; thử các trạng thái dữ liệu thật/giả và quyền âm. Sau pilot, thay từng hardcoded value trong phạm vi liên quan, không làm đợt thay màu toàn ứng dụng.

Ca UX bắt buộc: tạo chỉ mục từ link trong dưới một luồng không nhập trùng; reviewer biết đúng bản; hai người sửa không mất nội dung; người báo xem bước tiếp theo; Phương thấy phần thiếu LBRC014 mà không cần mở lại mọi tệp; người Xeca không thấy tên/preview/file LBRC014 khi không có quyền. Đây là ca đề xuất, chưa chạy.
