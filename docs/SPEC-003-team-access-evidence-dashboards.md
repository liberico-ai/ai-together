---
status: DRAFT — đặc tả để triển khai và nghiệm thu
---

# SPEC-003 — Cổng Team Tech, sổ bằng chứng và dashboard LibeTech

Phạm vi được giao ngày 09/11/2026 gồm ba mục. Cổng đăng nhập dành cho Team Tech, quản trị tài khoản và quyền, sổ công việc kèm chấm điểm theo bằng chứng và hai dashboard. [Roadmap](IMPLEMENTATION-ROADMAP.md) đặt gói này trước khi mở rộng sang vận hành hệ thống và Dev Factory.

Tại mốc kiểm 15:36 ngày 09/11, nền 0.2.0 có một tài khoản `chairman` đã ghép Telegram, một dự án, một bản đối soát LBRC014 và 0 công việc hoặc bằng chứng trong sổ mới. Portal hiện yêu cầu xác thực Hermes và có danh sách đường dẫn riêng. Căn cứ lịch sử tại `RESUME-SERVER-OBSERVED-20261109.json:7`, `RESUME-SERVER-OBSERVED-20261109.json:20` và `../dashboard-plugin/dashboard/plugin_api.py:22`.

Phạm vi pilot là LibeTech, một dự án Saleman, một hồ sơ thật LBRC014 và hai danh tính tổng hợp để kiểm quyền giữa các dự án. Tài khoản thật và quyền cụ thể lấy từ danh sách được người có thẩm quyền duyệt. Bảng `Đầu việc Tech` tiếp tục là nguồn vận hành. Sổ mới lưu bản đối soát và dấu vết, ghi riêng trạng thái nguồn với nhận định kiểm chứng. Công thức, trọng số, lịch làm việc và phạm vi xem điểm nêu dưới đây là thiết kế đề xuất.

## Đối chiếu AiTogether cũ

Nguồn đối chiếu là checkout `ai-together` tại commit `123f98ae63eaf274acc2ac7146bbdcc6a9bbbc6e`. Đường dẫn `../../ai-together/` tính từ thư mục tài liệu này. Phạm vi đối chiếu là mã nguồn tại commit, tách khỏi tình trạng triển khai của hệ cũ.

| Thành phần cũ | Phần kế thừa | Phần cần sửa hoặc xây mới |
|---|---|---|
| Bộ điểm delivery, quality, speed, consistency, collaboration và composite. `../../ai-together/lib/scoring.js:74`, `../../ai-together/lib/scoring.js:164` | Giữ điểm thành phần, tổng theo phiên bản công thức, xem theo kỳ | Tính từ sự kiện có phạm vi và bằng chứng. `periodStart` và `periodEnd` truyền vào nhưng truy vấn module theo người được giao. Tốc độ dùng `updated_at`, hoạt động lấy 100 dòng gần nhất, cộng tác tính lượt tải và bình luận. Thay bằng mốc bàn giao thực, kỳ có khóa thời gian, số lượng mẫu đủ điều kiện. `../../ai-together/lib/scoring.js:60`, `../../ai-together/lib/scoring.js:121`, `../../ai-together/lib/scoring.js:133`, `../../ai-together/lib/scoring.js:145` |
| Bảng `scores` và leaderboard. `../../ai-together/supabase/schema.sql:142`, `../../ai-together/app/leaderboard/page.jsx:31` | Chọn kỳ, nhìn điểm thành phần và xu hướng | Tạo bản kết quả có phạm vi dự án, chính sách và kỳ chốt. Giao diện cá nhân giải thích điểm tới từng bằng chứng. Bảng xếp hạng chung cần quyết định chia sẻ riêng. |
| API tổng hợp dashboard. `../../ai-together/app/api/dashboard/route.js:6` | Tổng quan tiến độ, việc của tôi và việc cần review | API mới lấy danh tính từ phiên, phân quyền ở truy vấn trước khi tổng hợp. Nguồn cũ lấy `user_id` từ query và gọi các bộ lấy dự án, module, người dùng, hoạt động. `../../ai-together/app/api/dashboard/route.js:9` |
| Chat tạo sự kiện hoạt động. `../../ai-together/app/api/chat/messages/route.js:28` | Ý tưởng nối cuộc trao đổi và lịch sử với việc | Nối yêu cầu có người nhận, thời hạn, biên nhận giao và phản hồi xác thực. Chat cũ ghi `sender_id` từ body và sự kiện cấp phòng. `../../ai-together/app/api/chat/messages/route.js:35`, `../../ai-together/app/api/chat/messages/route.js:50` |
| Ánh xạ GitHub repo sang dự án. `../../ai-together/app/api/webhooks/github/route.js:140` | Giữ repo là nguồn bằng chứng, liên kết tài liệu | Đường webhook đã đọc tập trung vào `push` và tệp tài liệu. Xây bộ thu PR, review, checks, bản phát hành và chủ thể đã xác minh, giữ full SHA. Giai đoạn đầu dùng GitHub REST với phạm vi đã được cấp. `../../ai-together/app/api/webhooks/github/route.js:125`, `../../ai-together/app/api/webhooks/github/route.js:153`, `../../ai-together/app/api/webhooks/github/route.js:165` |
| Đường tính điểm từ máy chủ và đọc kết quả. `../../ai-together/app/api/scores/calculate/route.js:4`, `../../ai-together/app/api/scores/route.js:4` | Tách tính và đọc | Chạy tính bằng projector nội bộ theo yêu cầu có audit. Đường `GET` của app mới chỉ đọc kết quả. Tách quyền rà soát, chốt và xuất báo cáo. |

## 1. Cổng đăng nhập Team Tech

**Luồng.** Mở cổng HTTPS của LibeTech → nhận lời mời một lần → tự đặt mật khẩu → đăng nhập → xem danh sách dự án được cấp → ghép Telegram nếu cần tương tác bot. Tái sử dụng xác minh Argon2id, phiên opaque băm tại DB và kích hoạt của [SPEC-002](SPEC-002-identity-postgres.md). Điểm vào riêng xác thực qua AI OS. Mạng và proxy chỉ đưa ra các route web của cổng team đã duyệt. Cổng quản trị Hermes tiếp tục là một bề mặt riêng, dùng cookie và quyền của chính nó. Cấu hình hostname và TLS cần được chốt trước khi phát lời mời thật.

| Trạng thái | Hành vi yêu cầu |
|---|---|
| Chưa có phiên | `/login`, `/activate` và các tài nguyên cần để tải trang. Trang dự án/nhân sự yêu cầu phiên hợp lệ. |
| Mời hợp lệ | Backend đọc vai trò và dự án từ lời mời do người quản trị đã cấp. Người dùng chỉ nhập mật khẩu, mã được băm và tiêu thụ trong cùng giao dịch kích hoạt. Token hết hạn hoặc đã dùng báo lỗi chung và có đường yêu cầu cấp lại. |
| Phiên hợp lệ | Cookie `Secure`, `HttpOnly`, giới hạn host và thời hạn theo SPEC-002. Yêu cầu đối với thao tác ghi gồm origin hợp lệ, phiên và quyền hiện thời. Hiển thị hướng dẫn khi thiếu dự án và nút đăng nhập lại khi hết phiên. Căn cứ luồng phiên tại `../src/server/auth-http.ts:7`. |
| Lỗi xác thực | Thông báo chung cho sai mật khẩu và tài khoản không hợp lệ, giới hạn lần thử, không ghi mật khẩu hay token vào log. Form có trạng thái đang xử lý và chống gửi lặp. |

**Ghép Telegram.** Web phát mã một lần, hết hạn sau 5 phút. Người dùng tự gửi mã qua tin nhắn riêng với bot. Bridge lấy người gửi thật từ gateway đã xác thực. Mã hết hạn, replay, ghép nhóm và tài khoản Telegram đã thuộc người khác đều bị từ chối. Ghép chỉ xác minh danh tính. Quyền đọc là giao của quyền dự án hiện hành và quyền của hội thoại. Ca mốc ngày 09/11 ghi nhận đọc LibeAI và chặn Libe–Xeca tại `TELEGRAM-GROUP-VERIFICATION-20261109T0922.json:26` và `TELEGRAM-GROUP-VERIFICATION-20261109T0922.json:52`. Mục này bổ sung đường vào cho thành viên mới.

## 2. Quản trị tài khoản, quyền và danh tính

**Vòng đời.** Người có quyền quản trị chọn tên đăng nhập, dự án và vai trò, hệ thống cấp lời mời. Chỉ cấp quyền nằm trong phạm vi được ủy quyền. Kích hoạt, cấp lại, hủy lời mời, đổi quyền, vô hiệu hóa, thu hồi phiên và gỡ liên kết danh tính có nhật ký theo người thao tác, thời điểm, thay đổi và lý do. Lời mời giữ đề nghị quyền. Khi kích hoạt cần kiểm lại quyền mời và dự án còn hiệu lực. Cấp lại thay mã cũ. Tài khoản trùng hoặc lời mời đồng thời chỉ tạo được một danh tính hợp lệ.

**Quyền theo phạm vi.** Tách quyền quản trị danh tính, làm việc, xem dữ liệu nhân sự, đánh giá và chốt kết quả. Mỗi yêu cầu kiểm tra cả tenant, dự án, người được xem và quyền thao tác. Quyền hiển thị nút trên UI là tiện ích, kiểm tra ở máy chủ quyết định truy cập. Dùng quyền hiện hành khi đọc báo cáo lịch sử, tải tệp và xuất dữ liệu. Chuyển từ vai trò cấp tài khoản sang membership có vai trò bằng migration bổ sung và bản đồ quyền được duyệt. Tài khoản hiện hữu được giữ liên kết và dự án, quyền chưa xác định mặc định từ chối. Hiện trạng được neo tại `../migrations/002_identity.sql:9` và `../migrations/002_identity.sql:17`.

| Chủ thể | Xem | Thao tác |
|---|---|---|
| Thành viên | Dashboard dự án được giao và phần nhân sự của mình trong phạm vi hiện còn quyền | Gửi bằng chứng hoặc yêu cầu đính chính, ghép/gỡ danh tính của mình theo luồng xác minh |
| Điều phối dự án | Tiến độ, bằng chứng và đóng góp liên quan trực tiếp đến dự án được giao | Xác nhận ánh xạ việc, chuyển đề nghị review và làm rõ hạn khi được giao |
| Người được giao đánh giá | Mẫu và tiêu chí thuộc phạm vi được phân công | Ghi nhận chất lượng hoặc quyết định kỹ thuật/nghiệp vụ theo quyền riêng. Người thực hiện không xác nhận chất lượng hay nghiệm thu cho chính phần mình. |
| Người được giao xem/chốt nhân sự | Kết quả nhân sự trong phạm vi được giao | Chốt bản điểm theo chính sách đã duyệt và lý do, tách khỏi quyền sửa công thức và ghi bảng việc |
| Quản trị tài khoản | Dữ liệu danh tính và quyền cần để vận hành | Mời, đổi quyền trong phạm vi, khóa, thu hồi. Quyền xem điểm hoặc đánh giá cấp riêng. |
| Bot / khách | Phần việc được phép theo scope hiện có | Cầu nối đọc bản đối soát theo phạm vi dự án, dựa trên `../src/server/bridge.ts:31`. Quyền xem báo cáo nhân sự dành cho chủ thể được cấp trên cổng. |

**Danh tính GitHub.** Dùng ID tài khoản bất biến đã được xác minh qua luồng đăng nhập GitHub hoặc xác minh có bằng chứng và người duyệt. Username, email commit và tên hiển thị dùng làm gợi ý. Lưu nguồn xác minh và thời gian hiệu lực của từng liên kết để quy công đúng thời điểm. Đưa ID trùng, tài khoản máy và đồng tác giả đang chờ xác minh vào hàng đối soát. Yêu cầu thu hồi áp dụng ở lần kiểm quyền kế tiếp trên cả web và bridge. Lịch sử quy công bám chủ thể đã xác minh tại thời điểm sự kiện.

## 3. Sổ công việc, chấm điểm và dashboard

### 3A. Nguồn dữ liệu và sổ bằng chứng

| Nguồn | Phần có thẩm quyền | Quy tắc nạp |
|---|---|---|
| Bảng việc của team | Dòng công việc, trạng thái và nội dung nguồn | Chỉ đọc trong pilot. Giữ mã việc đã xác nhận và con trỏ nguồn, hàng bảng chỉ là vị trí. Ánh xạ chưa rõ giữ chờ đối soát. |
| Telegram và bot | Yêu cầu, biên nhận giao, trả lời của người thật theo ngữ cảnh đã duyệt | Thu từ nhóm/luồng công việc được cấp, xác thực sender và reply-to, lưu tối thiểu dữ liệu cần tra nguồn. Phiên bản tin sửa có lịch sử. Báo lỗi gửi và khoảng mất dữ liệu để đánh giá độ phủ. |
| GitHub | PR, review, commit, Checks và release có nguồn | Đọc repo được cấp, bám mã repo và full SHA. Ưu tiên sự kiện gắn mã việc đã xác nhận. Check thành công chỉ là kết quả lần chạy ở SHA đó. Mở thêm quyền đọc PR, review hoặc repo theo từng phạm vi được duyệt trước khi kết nối nguồn. |
| Hồ sơ bàn giao/UAT | Bản thử, môi trường, ảnh/log, kết quả người thử và biên bản người có thẩm quyền | Băm tệp, ghi mốc gửi và nguồn. Phân biệt lời báo, dấu vết kiểm được, xác nhận chính thức. Giữ riêng quyết định kỹ thuật và nghiệp vụ theo bản bàn giao. |

Luồng đọc nguồn qua API hoặc gói xuất được cấp → chuẩn hóa sự kiện và đối soát → projector ghi dữ liệu dẫn xuất ở Z2 → dashboard đọc Z2 theo quyền. AI OS sở hữu quyền trên cổng, mapping và bản tổng hợp của mình. Bảng việc, Telegram, GitHub và kho hồ sơ tiếp tục sở hữu bản ghi gốc tương ứng. Sự kiện của quy trình do AI OS sở hữu dùng Z1. Gợi ý AI nếu có dùng Z4, cần người có thẩm quyền xác nhận trước khi đưa vào luồng chính thức. Tuân AR-01/03/05/06/07/08/09/10 theo quy tắc Liberico và `../AGENTS.md:11`.

**Hợp đồng sự kiện.** Mỗi dòng có `tenant_id`, `project_id`, `work_id` hoặc tình trạng chưa ánh xạ, loại sự kiện, ID tác nhân đã xác minh hoặc chờ xác minh, `occurred_at`, `observed_at`, `source_id`, `source_type`, `ingested_at`, `quality_score`, cùng `source_sha`, revision và môi trường nếu áp dụng. `quality_score` trong metadata đo độ tin cậy của nguồn, tách khỏi điểm chất lượng của thành viên. Giữ ID bản gốc, bản quan sát và hash tệp. Khóa lặp theo tenant/nguồn/ID sự kiện/bản sửa, khóa quy công theo dự án/người/đơn vị đóng góp. Sự kiện trùng giữ liên kết nguồn mà chỉ tính một lần. Sự kiện đến muộn hoặc được sửa đi qua đối soát, tạo bản tính mới có lịch sử. Bằng chứng giữ quyền của nguồn, liên kết tải kiểm tra quyền ở lần truy cập và không trả thông tin của dự án khác.

**Điều kiện đủ bằng chứng.** Khớp người, việc, mốc và phạm vi. Tách `source_status`, `delivery_state`, `technical_acceptance`, `business_acceptance` và `evidence_state`. Trạng thái đóng của nguồn hiển thị theo nguyên văn. Bàn giao xác nhận bằng sự kiện nộp đầu ra, nghiệm thu có người được giao và đúng bản bàn giao. Hai SHA tương đương trong một phần mã chỉ được dùng lại bằng chứng theo phạm vi có người duyệt. Không dùng đóng ticket, dấu đã đọc hoặc báo cáo tự thử để điền kết luận nghiệm thu. Logic kiểm revision nền tại `../src/server/service.ts:25` và `../src/server/service.ts:135`.

### 3B. Quy tắc đo và chấm điểm

**Kỳ và phạm vi.** Tuần/tháng theo `Asia/Ho_Chi_Minh` dùng khoảng `[bắt đầu, kết thúc)`. Tính thời điểm từ nguồn, có mốc chốt và phiên bản lịch làm việc. Mẫu theo hạn chỉ gồm hạn trong kỳ đã tới tại `as_of`. Khoảng làm việc, ngày nghỉ và ngoại lệ theo lịch dự án được duyệt. Yêu cầu giao ngoài giờ bắt đầu tính ở khoảng làm việc kế tiếp. Ghi người được giao tại thời điểm phát sinh nghĩa vụ. Hạn phải được xác nhận trước khi đo. Đổi hạn lưu hạn cũ, hạn mới, lý do và thời điểm có hiệu lực. Thay đổi sau khi quá hạn hoặc sau khi chốt kỳ phải được xử lý như đính chính có duyệt. Hiển thị lượng mẫu có thể đo, thiếu dữ liệu, không áp dụng và độ phủ theo từng nguồn. Nếu mẫu đủ nhưng kết quả xác định là trễ hoặc không đạt, mới ghi nhận trễ hoặc không đạt.

| Chỉ số | Cách tính và điều kiện hợp lệ |
|---|---|
| K1 — Bàn giao đúng hạn | Mẫu là các việc được giao hợp lệ, đến hạn trong kỳ, có hạn và dữ liệu theo dõi đủ tại mốc chốt. Tử số là việc có bàn giao đủ thành phần bắt buộc, trước hoặc đúng hạn. Điểm `100 × tử số / mẫu số`. Quá hạn còn mở nằm trong mẫu nếu nguồn đầy đủ. Dashboard hiển thị số giao, số đã nghiệm thu kỹ thuật và số đã nghiệm thu nghiệp vụ riêng. |
| K2 — Phản hồi đúng hạn | Mẫu là yêu cầu có một người chịu trách nhiệm, gắn việc, có biên nhận gửi thành công, SLA xác định và đến hạn trong kỳ. Tính từ mốc giao đến phản hồi đầu tiên có nội dung của đúng người, theo giờ làm việc và ngoại lệ đã xác nhận. Tin đã đọc, lời báo sẽ xem, emoji, nhắc lại và bot trả lời tự động ghi riêng. Yêu cầu đến hạn chưa có phản hồi là trễ khi nguồn đủ. Điểm `100 × số phản hồi đúng hạn / số yêu cầu đủ điều kiện`. Lỗi giao hoặc log khuyết hiển thị thiếu dữ liệu. |
| K3 — Chất lượng phản hồi | Người đánh giá được giao áp rubric 0–3. Mỗi tiêu chí đạt được một điểm gồm trả lời đúng yêu cầu, có nguồn/căn cứ hoặc nêu rõ điểm chưa biết và cách kiểm, nêu kết quả hoặc bước tiếp theo phù hợp. Điểm thành phần là `100 × tổng điểm / (3 × số mẫu đã rà)`. Rà trên cùng tập yêu cầu đủ điều kiện ở K2 có phản hồi nội dung. Báo số mẫu đã rà trên tổng phản hồi đủ điều kiện, kể cả mẫu chờ. Mỗi đánh giá lưu phiên bản tin được xem. K2 giữ mốc phản hồi hợp lệ đầu tiên. |
| K4 — Đóng góp GitHub được xác minh | Đếm đơn vị có repo được cấp, người xác minh được, việc hoặc dự án đã đối soát và đầu ra có giá trị theo loại công việc. Ví dụ PR merge có scope được xác nhận, review có nhận xét thực chất, bản sửa/test/tài liệu có liên kết và kết quả rà soát. Commit con đã tính trong PR hiển thị là nguồn, không tạo điểm riêng. Mục tiêu theo vai trò phải được duyệt trước kỳ. Công thức thử `100 × min(đơn vị hợp lệ / mục tiêu, 1)`. Hiển thị các loại đóng góp và mục tiêu thay vì so khối lượng PR thô giữa các vai trò. |

**Trạng thái điểm.** `PENDING_EVIDENCE` cho việc thiếu nguồn, chờ xác minh người hoặc chờ xác nhận hạn. `PENDING_REVIEW` cho mẫu chờ đánh giá. `NOT_APPLICABLE` cho chỉ số ngoài trách nhiệm đã chốt. `DRAFT` cho kết quả tính được theo công thức thử. `APPROVED` cho bản đã chốt. Mỗi bản lưu phiên bản công thức, phạm vi, cohort, ngưỡng mẫu, tử số/mẫu số, `as_of`, nguồn và lý do loại trừ. Điểm tổng bằng `Σ(trọng số × điểm thành phần)` khi đủ ngưỡng và có chính sách được chọn. Chính sách theo vai quy định chỉ số áp dụng, trọng số có tổng bằng 1 và ngưỡng riêng cho số mẫu, độ phủ nguồn và độ phủ đánh giá. Mẫu cần đối soát mang nhãn thiếu dữ liệu. Trọng số đổi qua phiên bản chính sách đã duyệt. Xác nhận đính chính tạo phiên bản kế tiếp có căn cứ và người chốt khác người được đánh giá. Tách quyền sử dụng kết quả chính thức cho KPI hoặc lương khỏi việc chốt báo cáo vận hành.

**Phép tính trên dữ liệu giả lập E01.** #hypothesis Đặt ngưỡng hai mẫu ở K1–K3 và mục tiêu hai đơn vị GitHub. Giả định một trong hai việc và một trong hai phản hồi đúng hạn, hai phản hồi được rà 3 và 1 điểm, một đơn vị GitHub hợp lệ sau gộp trùng. Công thức kiểm `round(0.35*50 + 0.20*50 + 0.25*(100*4/6) + 0.20*50, 2) = 54.17`. Trọng số trên thuộc riêng E01. Với một yêu cầu thiếu biên nhận giao, tăng bộ đếm thiếu dữ liệu và giữ mẫu hợp lệ là hai. Nếu độ phủ xuống dưới ngưỡng giả lập thì điểm tổng chuyển sang chờ bằng chứng.

### 3C. Hai dashboard và ca LBRC014

| Dashboard | Nội dung và hành vi |
|---|---|
| **Dự án** | Bộ lọc dự án/kỳ, trạng thái từ bảng việc, tiến độ bàn giao, hai lớp nghiệm thu, việc trễ hoặc thiếu hạn, phản hồi chờ và bằng chứng thiếu. Xem đóng góp thành viên theo việc thuộc dự án đang mở. Mỗi ô tổng hợp mở được danh sách cùng bộ lọc và mốc chốt. |
| **Nhân sự** | Mặc định phần của mình. Người có quyền quản lý xem trong phạm vi được giao. Hiển thị từng nhóm điểm, mục tiêu, số mẫu/độ phủ, kỳ và nguồn. Hiển thị riêng bản nháp, bản đã chốt và đính chính. Cho phép yêu cầu rà lại theo bằng chứng. Giao diện và export dùng cùng bộ lọc quyền, không suy ra điểm toàn công ty từ phần dự án đã cấp. |
| **Cả hai** | Cùng phiên bản projector, khóa đóng góp và bộ dữ liệu theo kỳ. Mẫu rỗng, đang tải, nguồn lỗi, dữ liệu cũ hoặc thiếu và quyền bị thu hồi có thông báo riêng. Drill-down phải khớp số tổng hợp, người xem chỉ thấy hàng và trường được cấp. |

**Bản đối soát dùng cho SPEC** dựa trên hồ sơ đã lưu đến lần đọc bảng 15:19:49 ngày 09/11. Ánh xạ `LBRC014` với Saleman và hàng A31:H31. Full SHA chức năng `8d05141576bcd4db8e7ab9f1a6b7a0dd9bd360ab`. Tách bản phát hành `5b38598de8bca1b258be7ee4b7086a993810478a` và bản iOS do người thử nêu `751327b853b50ed7b06f87c747198a4a731b0ac6`. Căn cứ tại `LBRC014-BIEN-BAN-NGHIEM-THU-20261109.md:255`, `LBRC014-BIEN-BAN-NGHIEM-THU-20261109.md:309` và `LBRC014-BIEN-BAN-NGHIEM-THU-20261109.md:321`.

| Dấu vết hiện có | Kết quả cần thấy khi chạy pilot |
|---|---|
| Bảng việc ghi “Hoàn thành”. `LBRC014-BIEN-BAN-NGHIEM-THU-20261109.md:321` | Hiển thị nguyên trạng thái bảng, ngày quan sát và trường nghiệm thu người dùng còn chờ. Không cập nhật dòng A31:H31. |
| Cầu nối LibeAI đọc đúng SHA ngày 09/11, Xeca bị chặn, snapshot trả 0 check runs và `acceptedSha=null`. `TELEGRAM-GROUP-VERIFICATION-20261109T0922.json:26`, `TELEGRAM-GROUP-VERIFICATION-20261109T0922.json:52` | Ghi nhận sự kiện truy xuất dữ liệu, tách khỏi K1–K4 và kết quả kiểm thử. Giữ bản snapshot ngày 08/11 và thêm bản quan sát mới dưới ID khác khi có nạp được duyệt. |
| Quân phản hồi 13:23/13:32/13:37, có log build, ảnh U7 và đối chiếu hai tệp chức năng. Một số kết quả là lời báo. `LBRC014-BIEN-BAN-NGHIEM-THU-20261109.md:255`, `LBRC014-BIEN-BAN-NGHIEM-THU-20261109.md:261` | Hiển thị đóng góp kỹ thuật theo nguồn, gộp các tin liên quan cùng đầu ra. Đánh dấu phần log test đúng SHA, review và mối nối bản thử/phát hành còn thiếu. Chỉ quy công điểm GitHub sau khi ánh xạ tài khoản được duyệt. |
| Phương gửi gói iOS 15:02, tự báo 7/7, có tám ảnh. Bằng chứng U4/U6 và mối nối bản thực cài còn thiếu, CVKD chưa dùng. `LBRC014-BIEN-BAN-NGHIEM-THU-20261109.md:294`, `LBRC014-BIEN-BAN-NGHIEM-THU-20261109.md:298`, `LBRC014-BIEN-BAN-NGHIEM-THU-20261109.md:305` | Hiển thị đóng góp UAT nội bộ, giới hạn theo từng ca và yêu cầu đối soát phiên bản. Nghiệm thu nghiệp vụ giữ trạng thái chờ xác nhận của người dùng có thẩm quyền. |
| Có mốc trao đổi, chưa thiết lập SLA/lịch và mẫu chất lượng đủ điều kiện cho kỳ trong hồ sơ đối soát. `LBRC014-BIEN-BAN-NGHIEM-THU-20261109.md:255`, `LBRC014-BIEN-BAN-NGHIEM-THU-20261109.md:280` | Hiện thời điểm đã quan sát. K2/K3 và điểm tổng ở trạng thái thiếu căn cứ hoặc chờ đánh giá. Không quy thiếu bằng chứng thành kết quả 0 cho Quân hoặc Phương. |

## Nghiệm thu và giao từng lát

| Mã | Ca cần chạy | Đạt khi |
|---|---|---|
| A01 | Trình duyệt sạch, người dùng thử qua lời mời, tự đặt mật khẩu, đăng nhập và ghép Telegram riêng | Kỳ vọng danh sách đúng dự án trên cổng Team Tech. Thử ghép sai nhóm, hết hạn và replay, kỳ vọng từ chối theo tiêu chí SPEC-002 mục 5 và `../src/server/identity.ts:118`. |
| A02 | Dùng hai lần cùng mã, mời lại, đổi quyền, vô hiệu hóa khi web và bot đang có phiên | Một lần kích hoạt có hiệu lực. Phiên và lệnh bot bị chặn theo quyền hiện thời. Audit tái dựng được lịch sử mà không chứa bí mật. |
| A03 | Đổi ID người xem và ID dự án ở URL/API, drill-down, export và mở link bằng chứng | Hai tài khoản khác dự án không đọc được hàng, tệp, số tổng hợp hoặc điểm ngoài quyền. Điều phối dự án không truy được trang điểm toàn cá nhân ngoài phạm vi. Kiểm cả trên native PostgreSQL với RLS và hai kết nối liên tiếp. |
| E01 | Chạy fixture K1–K4, biên giờ làm việc và ranh giới kỳ. Ví dụ lịch giả lập thứ Hai–thứ Sáu 09:00–17:00, giao 16:30 thứ Sáu với SLA 60 phút, hạn 09:30 thứ Hai theo lịch làm việc giả lập. | Ra 54,17 ở fixture chuẩn. Hiển thị riêng trễ, đang trong hạn, ngoài phạm vi và thiếu nguồn. Chọn mốc tin có nội dung, lưu tin đã đọc riêng. |
| E02 | Phát lại bản ghi GitHub và Telegram, đổi hạn sau mốc chốt, sửa hoặc nhập muộn một tin | Số đếm không tăng vì phát lại. Thay đổi có lịch sử và kết quả mới đối chiếu được với bản đã chốt. Người làm không thể chốt phần chất lượng của mình. |
| E03 | Chiếu hồ sơ LBRC014 từ nguồn lưu sang bản đọc thử | Hai dashboard dẫn về cùng ID việc và nguồn, hiển thị “Hoàn thành” của bảng và phần nghiệm thu còn thiếu. Phân biệt ba SHA và hiển thị phần đã đủ của Quân, Phương. Không phát sinh điểm chính thức. Đối chiếu lại nguyên văn dòng nguồn theo bản đọc trước/sau khi chạy pilot thật. |
| E04 | Mất nguồn, chưa có mẫu, chưa cấp quyền, nguồn đến chậm và tra lại bản kỳ cũ | Trạng thái hiển thị đúng. Bộ lọc và quyền còn hiệu lực ở cả chi tiết lẫn export. Có đối chiếu bản điểm và công thức qua từng lần chốt. |

**Lát triển khai.** Đầu tiên dựng cổng thử và vòng đời tài khoản. Tiếp theo kiểm quyền PostgreSQL và ghép danh tính. Song song chuẩn bị dữ liệu tổng hợp, khóa sự kiện và bản đối soát LBRC014 chỉ đọc. Sau khi kiểm nguồn và quyền, chạy dashboard dự án rồi dashboard nhân sự ở chế độ rà soát. Mỗi lát có bản thử, log kiểm tra, cách thu hồi phát hành và kết quả người được giao xác nhận. Khôi phục cổng/app bằng gói trước, dữ liệu nguồn vẫn do hệ sở hữu. Projector chạy lại từ sự kiện đã lưu và không cần ghi lại bảng việc.

**Quyết định cần chốt trước khi mở cho team.** Host và phạm vi truy cập, người được mời cùng vai theo dự án, ai được xem hoặc chốt điểm, lịch và SLA, tiêu chí/độ phủ/trọng số theo vai, quyền truy xuất và thời gian lưu bằng chứng. Khi nối nguồn bổ sung hoặc đưa điểm vào KPI/lương, chốt mục đích và phạm vi riêng. Căn cứ tổ chức vận hành trong bot tại `../../libe-tech/hermes-libetech-priority1/profile/skills/libetech-viec/SKILL.md:92`.
