# Repo và công cụ cho PM BA và tài liệu dự án

Ngày kiểm: 11/11/2026. Phạm vi: đọc tài liệu chính thức, README/license và metadata repo; chưa cài, chưa benchmark, chưa audit mã toàn bộ. Các mức chi phí dưới đây là so sánh vận hành, không phải báo giá. Nguồn nội bộ không được gửi vào truy vấn web. Những đề xuất lựa chọn là suy luận cho LibeTech, không phải tuyên bố nhà cung cấp đáp ứng sẵn quy tắc BoM.

## 1 Kết luận lựa chọn

**Giai đoạn 1 dùng Drive/Docs + Git hiện có, AI OS giữ registry/approval/traceability.** Tận dụng mẫu kỹ năng BMAD cho khai thác nhu cầu và viết tài liệu, OpenSpec cho hồ sơ thay đổi, tham khảo arc42 để bao phủ kiến trúc. Chọn một bộ mẫu LibeTech nhất quán; không chạy cả BMAD, Spec Kit và OpenSpec như ba bộ điều phối đồng thời. Việc dùng mẫu chưa đồng nghĩa cài skill trên gateway.

Nếu cần kho cộng tác tự vận hành, thử **BookStack** trước bằng ca phân quyền/thông báo thật. **Docmost** là lựa chọn cộng tác hấp dẫn nhưng API được tài liệu hiện tại ghi là Enterprise; không dự toán chỉ dựa bản OSS. **Outline** cần xem phạm vi BSL và danh tính. **Docusaurus** phù hợp xuất bản hướng dẫn phiên bản; không đóng vai trò inbox/duyệt tài liệu nghiệp vụ.

## 2 So sánh tám repo

| Repo | Loại và phần có thể kế thừa | License quan sát | Tích hợp/quyền và giới hạn | Vận hành / khuyến nghị |
|---|---|---|---|---|
| [BookStack](https://codeberg.org/bookstack/bookstack) | Kho wiki có tổ chức, editor, revision; tham khảo cách trình bày tài liệu | MIT theo [repo](https://github.com/BookStackApp/BookStack); nguồn phát triển đã chuyển Codeberg | REST API cần quyền; content permissions theo sách/chương/trang. Quyền shelf không tự cascade như book/chapter; phải thử mapping project | Thêm PHP/DB và vận hành tài khoản/backup; ứng viên tự host nếu thật sự cần kho mới |
| [Docmost](https://github.com/docmost/docmost) | Editor cộng tác, spaces, comment/history, diagrams | Core AGPL-3.0; EE riêng | [API](https://docmost.com/docs/user-guide/api) yêu cầu Enterprise; [editions](https://docmost.com/docs/editions) phân tầng. Page-level controls/approval và một số import là tính năng trả phí | Thêm dịch vụ và license; không chọn làm dependency bắt buộc trong lát đầu |
| [Outline](https://github.com/outline/outline) | Knowledge base cộng tác và Markdown; xem UX tra cứu | [BSL 1.1](https://github.com/outline/outline/blob/main/LICENSE), không gắn nhãn MIT/OSS thuần | Chưa thử auth, API và permission mapping với nền LibeTech; phải review điều kiện của phiên bản chọn | Có thêm identity, hosting và backup; giữ phương án so sánh, chưa tích hợp |
| [Docusaurus](https://github.com/meta/docusaurus) | Site docs từ Markdown/MDX, [versioning](https://current.docusaurus.io/docs/versioning) | MIT, xác nhận từ metadata repo | Xuất bản tài liệu; quyền private và review phải nằm ở lớp repo/deployment phù hợp, không mặc định có workflow BoM | Chi phí biên soạn/build; dùng sau cho HDSD đã công bố, không phải kho yêu cầu chính |
| [arc42 template](https://github.com/arc42/arc42-template) | Khung mô tả kiến trúc và quyết định, giúp tránh bỏ sót context/interface/risk | [CC BY-SA 4.0](https://faq.arc42.org/questions/A-2/); ghi công/chỉ rõ thay đổi khi phân phối bản phái sinh | Là mẫu tài liệu, không cung cấp ACL, DB, search hay phê duyệt | Ít vận hành; dùng làm checklist tham khảo, không ép mọi việc dùng toàn bộ khung |
| [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) | [Khai thác nhu cầu, brief, PRD và requirements](https://docs.bmad-method.org/plan/define-requirements-and-a-specification/) | [MIT](https://github.com/bmad-code-org/BMAD-METHOD/blob/main/LICENSE), nhãn hiệu riêng | Bộ kỹ năng/workflow cho AI; không phải kho tài liệu. Chỉ tái dùng phần lập tài liệu sau review prompt/tool quyền | Phù hợp học mẫu BA/PM; cần eval tiếng Việt và adapter an toàn riêng |
| [GitHub Spec Kit](https://github.com/github/spec-kit) | [Spec → plan → tasks và kiểm liên kết](https://github.github.io/spec-kit/) | MIT theo README/license | Công cụ khởi tạo quy trình trong repo; cần kiểm cấu hình/hooks trước dùng. Không tự cung cấp governance đa BU | Ứng viên hợp đồng Phase 2; không cài song song một bộ điều phối khác mặc định |
| [OpenSpec](https://github.com/Fission-AI/OpenSpec) | Hồ sơ thay đổi gồm proposal/spec/design/tasks, phù hợp hệ đang có | MIT theo README | Tái dùng cấu trúc và delta; không coi archive là approved. README khai telemetry lệnh/version, có opt-out; cần ghim phiên bản và review trước cài | Chọn cấu trúc change packet cho pilot; CLI/auto-apply chưa bật |

Nguồn bổ sung BookStack: [quyền](https://www.bookstackapp.com/docs/user/roles-and-permissions/), [REST API](https://www.bookstackapp.com/docs/admin/hacking-bookstack/#api), [cài đặt](https://www.bookstackapp.com/docs/admin/installation/). Nguồn Docmost: [tính năng và phân loại trả phí](https://docmost.com/docs/). Chưa kết luận pháp lý cho một cách phân phối cụ thể; chỉ ghi license đang được dự án công bố.

## 3 Độ mới và mức xác minh

| Repo | pushed_at UTC từ metadata khi đọc 11/11 | Giới hạn |
|---|---|---|
| Docmost | 2026-11-11 06:42:37 | Push không chứng minh tính ổn định hoặc bản đã phát hành |
| Outline | 2026-11-10 12:22:10 | Chưa thử tích hợp |
| Docusaurus | 2026-11-06 22:11:43 | URL facebook/docusaurus chuyển sang meta/docusaurus khi đọc |
| arc42-template | 2026-10-19 10:19:23 | Template ít thay đổi khác nhịp ứng dụng |
| BMAD | 2026-11-11 05:22:26 | Metadata license NOASSERTION; đã kiểm LICENSE trực tiếp là MIT |
| Spec Kit | 2026-11-10 23:14:57 | Không suy các extension cộng đồng đã được audit |
| OpenSpec | 2026-11-11 00:48:10 | Trang [release](https://github.com/Fission-AI/OpenSpec/releases) hiển thị 1.17.0 và thông báo 2.0; phải pin khi thử |
| BookStack GitHub | 2026-11-11 04:31:41 | Mô tả chỉ sang Codeberg; không lấy push GitHub làm lịch phát hành Codeberg |

Chưa có số đo hiệu năng, dự toán license hay chi phí hạ tầng của LibeTech cho các sản phẩm này. So sánh chi phí theo phần phát sinh: Drive/Git tận dụng nguồn đang dùng nhưng vẫn cần adapter/quyền/backup; kho mới thêm deployment, nâng cấp, identity và restore; bộ skill thêm review/eval/model usage; site docs thêm build/publish. Chưa mua dịch vụ hoặc cài phần mềm.

## 4 Phần dùng lại và phần phải tự thiết kế

Từ AiTogether cũ: giữ tư duy project→module→checklist, tài liệu theo dự án, thảo luận và review; không sao chép hành vi upload→done hoặc URL public mặc định. Từ nền mới: giữ identity, Telegram pairing, project RLS, audit và tách nghiệm thu. Từ repo bên ngoài: cấu trúc tài liệu, câu hỏi BA, checklist review và UX; không lấy quyền của agent/framework thay quyền LibeTech.

Phần riêng cần xây: registry tài liệu liên nguồn, bản chuẩn bất biến đã được người duyệt, traceability yêu cầu–việc–evidence, mapping nhóm, outbox đúng audience, phiếu quyết định gắn revision, BoM3/3, phát hiện tài liệu lỗi thời và read receipts. Bộ mẫu LibeTech trong gói này được soạn riêng; chưa chép mã hoặc phân phối template phái sinh của các repo.

## 5 Cách thử trước khi chọn kho khác

Thử cùng một bộ ca: hai người sửa tài liệu; reviewer xem đúng revision; cập nhật trong lúc duyệt; user Xeca tìm không thấy LBRC014; thu hồi quyền chặn link/cache/export; bản đã duyệt còn truy lại sau sửa/xóa draft; service account không vượt quyền; export/import và restore giữ liên kết/hash; bot thất bại khi ghi phải báo đúng. Đo thời gian vận hành thực tế và chi phí báo giá, rồi mới quyết chuyển nguồn theo ADR. Không di chuyển dữ liệu team chỉ để thử giao diện.
