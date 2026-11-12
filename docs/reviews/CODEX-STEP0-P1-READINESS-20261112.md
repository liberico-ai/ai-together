VERDICT: CHANGES_REQUIRED

# Kiểm độc lập Bước 0 và bàn giao P1.0
Ngày 12/11/2026 · Codex · Phạm vi ghim tại `82292339584f5c6937c4d7c7a9ce39d3536619d8`.

Chairman xác nhận trong phiên này: **Claude Code viết mã; Codex kiểm và chuẩn bị bàn giao.** Hồ sơ này là kết quả kiểm, không phải bản sửa mã hoặc phê duyệt ADR.

**Kết luận:** các kiểm tra nền của Bước 0 đạt; GitHub khớp máy và health trả 0.7.1. Brief P1.0 cần bổ sung trước khi giao builder. Có một lỗi cũ đã tái hiện trong mẫu service mà brief hướng dẫn kế thừa, cùng một khoảng thiếu trong kế hoạch tìm kiếm. Chưa có implementation P1.0 để nghiệm thu. Không tìm thấy finding P0/P1 trong phạm vi diff Bước 0 đã đọc; điều này không phải chứng nhận toàn bộ hệ thống.

## 1. Findings và cách xử lý

### R-01 · P2 · Ràng buộc mã thao tác với đúng đối tượng trước khi kế thừa mẫu
- Vị trí bàn giao: `docs/SLICE-BRIEFS.md:39`; mã liên quan: `src/server/feedback.ts:46–52`.
- #fact: `resolve()` đọc lần xử lý trước theo tenant/actor/request key, nhưng chỉ so version, trạng thái và lý do; bỏ `report_id`.
- Kịch bản đã tái hiện: tạo phản hồi A và B trong cùng dự án; đóng A bằng K; gửi đóng B bằng cùng K, version và lý do. Kết quả trả thành công `replayed:true` cùng mã hành động của A, dù B chưa được đóng. API phải báo `FEEDBACK_KEY_CONFLICT`.
- Đây là lỗi của baseline 0.7.1, không do commit Bước 0 tạo ra. Brief chỉ trực tiếp trỏ `create()` ở dòng 23; không kết luận hàm create mắc cùng lỗi. Cần ghi rõ không sao chép cách replay của `resolve()` cho thao tác đổi revision.
- Đề nghị Claude Code sửa bằng thay đổi riêng nhỏ: kiểm đối tượng, operation và toàn bộ nội dung có ý nghĩa của request; giữ transaction/RLS; thêm hồi quy cùng key/cùng request và cùng key/khác report. Với tài liệu, fingerprint phải gồm doc/revision/expectedVersion, không chỉ tên thao tác.
- Căn cứ: `AGENTS.md:14`; quy ước chống lặp tại `SLICE-BRIEFS.md:8`. Cách `deduplicate()` ở `src/server/service.ts:57–69` đã có hash nội dung, nhưng caller vẫn phải truyền đủ định danh.
- Bằng chứng: [ca kiểm chẩn đoán](step0-p1-evidence-20261112/review-feedback-idempotency.test.ts.txt), [output thất bại đúng kỳ vọng an toàn](step0-p1-evidence-20261112/review-feedback-idempotency.log). Chỉ chạy trên PGlite tạm với dữ liệu giả.

### R-02 · P2 · Bổ sung đường tìm kiếm qua bản chiếu Z2 vào kế hoạch P1.0
- Vị trí: `docs/SLICE-BRIEFS.md:27`, `:41–45`.
- #fact: P1.0 giao tìm theo tên/loại/mã, nhưng danh sách thành phần và migration mới chỉ nêu registry/revision/template; chưa giao projector hoặc chỉ mục tài liệu Z2.
- `SPEC-009-PM-BA-DOCUMENTS-20261111.md:75,131` yêu cầu search đọc projection có quyền. Z2 bảng việc hiện tại không thay được chỉ mục tài liệu mới.
- Đây là thiếu sót của brief, chưa phải lỗi truy vấn đang chạy. Nếu builder hiểu “chưa tìm nội dung” là được bỏ hẳn projection, implementation dễ khác SPEC.
- Đề nghị bổ sung task projector và bảng/chỉ mục metadata Z2 có tenant/project scope; đọc chi tiết nghiệp vụ trong domain service, search qua projection; bảo đảm cập nhật, replay và độ mới. Kiểm quyền trước truy vấn lẫn trước trả kết quả; search không lộ tên/count ngoài phạm vi.
- Ca kiểm thêm: cùng BU khác dự án bị chặn, thu hồi membership rồi tìm/export bị chặn, replay projector không tạo bản sao, mất nguồn không làm mất lịch sử.

## 2. Kiểm chứng đã thực hiện

| Hạng mục | Kết quả ngày 12/11 |
|---|---|
| Repo local | Nhánh `libetech-ai-os`, HEAD `8229233`, sạch trước kiểm |
| GitHub nhánh triển khai | API GitHub trả đúng cùng HEAD `82292339584f5c6937c4d7c7a9ce39d3536619d8` |
| GitHub main | Vẫn `d23e5168087084a5ef5e4e283de6e745f45573cb`; không đổi nhánh mặc định |
| Diff `b91f219..8229233` | 10 tệp, 828 dòng thêm; cấu hình/quy trình/tài liệu; không đổi mã sản phẩm |
| Health lúc khoảng 10:10 giờ VN | HTTP 200, ready, 0.7.1, PostgreSQL server, synthetic=false; migration 001–012 |
| Vitest baseline | 7 tệp, 57/57 đạt, 22,76 giây |
| Cầu nối Python | 11/11 đạt |
| Typecheck/build | Đạt, exit 0 |
| Kiểm bổ sung R-01 | 1 ca thất bại: hệ thống trả replay thành công cho report khác |
| P1.0 | Chưa có migration 013+, sổ tài liệu hoặc test DOC mới |

Bản kiểm xuất bằng `git archive` đúng HEAD vào thư mục riêng. Thư viện được **chép riêng** từ node_modules trên máy, không dùng symlink và không gọi đây là lần `npm ci` mới. Các biến kết nối DB ngoài được loại khỏi tiến trình test. Database dùng PGlite in-memory, dữ liệu giả. Không chạy lại kiểm PostgreSQL native trong phiên này.

Bằng chứng: [verification.json](step0-p1-evidence-20261112/verification.json), [Vitest](step0-p1-evidence-20261112/vitest.log), [Python](step0-p1-evidence-20261112/bridge-test.log), [typecheck](step0-p1-evidence-20261112/typecheck.log), [build](step0-p1-evidence-20261112/build.log), [GitHub refs](step0-p1-evidence-20261112/github-refs.json), [health](step0-p1-evidence-20261112/health.json).

## 3. Đối chiếu gói phát hành: chính xác tới đâu

Tính lại bằng tập tệp và thuật toán của `scripts/package-release.py`, không tạo hay cài gói:

| Tập so | Số tệp | SHA-256 |
|---|---:|---|
| Commit nhập hiện trạng `b91f219` | 124 | `746832aa99b1b0d4c14e98ed44e5b8e0eb7d7b0ef47b9de2406ace538fd392fc` |
| `b91f219` + catalog local đã được loại khỏi Git | 125 | `325663d35332692b27453e1236e2fef1fe9a40a124af5035ed4455913db0e570` |
| HEAD `8229233` theo tập tệp phát hành | 124 | `44bad502a366d09759e3575e0816f5cb7a93d141ce5cfdd6029e5613411d922b` |

Health khai digest trùng hàng thứ hai. Trong tập phát hành, HEAD khác `b91f219` thêm đúng `.gitignore`; HEAD còn thiếu catalog local theo quyết định không commit dữ liệu. **Không ghi HEAD hiện tại byte-identical với server.**

Health lấy buildDigest từ biến môi trường và sourceSha hiện null (`src/app/api/health/route.ts:10`). Kết quả này xác nhận endpoint đang trả cấu hình phù hợp biên nhận; chưa thay thế phép băm tệp đang chạy trên d1-ai1. Không kiểm mới gateway/Telegram hay 20 bot trong phiên này. Lần triển khai tới phải tạo manifest mới, ghim sourceSha, rồi đối chiếu tệp/runtime. Hai manifest 0.2.0 cũ đã được DELIVERY-009 nhận diện, không dùng làm chứng cứ bản 0.7.1.

Xem [digest-comparison.json](step0-p1-evidence-20261112/digest-comparison.json). Không chép dữ liệu catalog vào hồ sơ này.

## 4. Gỡ 21 câu hỏi theo đúng phần bị ảnh hưởng

Đây là khuyến nghị rà soát; **không tự đánh dấu đã duyệt trong OPEN-QUESTIONS**. Không cần hỏi Chairman 21 câu trước khi chuẩn bị P1.0.

| OQ | Xử lý đề nghị |
|---|---|
| 01–02 | Gom thành bản bổ sung ADR-002 cụ thể ở mục 5; cần người có thẩm quyền chốt trước migration entity mới. |
| 03 | Nhãn cũ đã sửa trong baseline. Chỉ bổ sung trạng thái cấu hình/đã kiểm/chưa nối ghi; không gắn “đã kiểm thực tế” chỉ từ biến cấu hình. |
| 04 | Tách nhãn miền sở hữu khỏi tenant/BU/pháp nhân; giữ quyền hiện có. Mapping từng dự án do người có quyền xác nhận; không tự tách tenant. |
| 05 | Theo SPEC-009 P1.0 và UI mẫu: hai con trỏ độc lập, approved có thể null, hiện “Chưa có”. P1.0 không tự tạo approval thật. |
| 06 | Giữ source_ref là tham chiếu nguồn và nhãn chưa đối soát; chưa tạo work Z1. PM xác nhận mapping khi đến bước cấp work ID. |
| 07 | P1.0 metadata-only có thể chuẩn bị trước; hash tự khai không thành hash đã kiểm. Snapshot/retention/quyền nguồn phải chốt trước đóng băng, tải hoặc duyệt baseline thật. |
| 08 | Để P1.1: tách service principal tiếp nhận hẹp khỏi bot principal chỉ đọc; lập đề xuất sửa hợp đồng quyền có chủ đích. Không sửa AGENTS ngầm. |
| 09 | Giữ sổ ticket hiện hữu là chủ trạng thái đến khi có quyết định chuyển chủ; đối chiếu priority1 trước khi chọn adapter. Không cần đổi chủ intake để làm P1.0. |
| 10–11 | P1.1: tuyến private, sender, topic, quyền và receipt thật. P1.0 chỉ lưu mapping đề xuất/chưa kích hoạt; config gateway vẫn giữ hiệu lực hiện tại. |
| 12 | Phần mã Yes/No có sẵn không đồng nghĩa đã chạy; tách DM tự động, phiếu đổi quyền và UAT thật thành ca riêng cho P1.1. |
| 13 | Ghi rõ mã ca theo lát. PM-01…08 là bộ PM; XI-01/07/08 là intake thật. XI-02…06 thuộc Jira lịch sử, đã được roadmap cho hoãn. Không ép nhập Jira để qua P1.0. |
| 14 | P1.2: cần quyết định nơi chạy AI, dữ liệu được gửi và bộ eval. Không gọi model hoặc bật Z4 trong P1.0. |
| 15 | Giữ và kiểm hồi quy 3/3 cùng ba sự kiện đã có. Review tài liệu không tự mở rộng điều kiện nghiệm thu sản phẩm/phi mã. |
| 16 | Làm rõ phân lát trong kế hoạch: P1.2 lưu liên kết và đánh dấu cần xem lại; P1.3 phục vụ truy ảnh hưởng/thông báo. Không phải quyết định quyền mới. |
| 17 | P1.3 hiển thị công việc/độ phủ bằng chứng; không thêm điểm chính thức hoặc KPI/lương. Đừng tự xóa chức năng điểm nháp cũ ngoài phạm vi. |
| 18–19 | Chốt phạm vi/SPEC và nguồn quan sát trước lát vận hành; không chặn P1.0 vì chưa có danh sách health của nền khác. |
| 20 | Lựa chọn triển khai: rollback ở thư mục riêng không bị runner quét, có kiểm trên bản sao. Không đặt `013_down.sql` cùng migrations tiến. Không bắt viết lại 001–012 để bắt đầu sổ mới. |
| 21 | Đề nghị mẫu T0–T6 là tệp có version/hash trong repo, AI OS giữ chỉ mục mẫu; không cài skill bot lúc P1.0. Builder ghi lựa chọn và test trong kế hoạch. |

Các mục đã có căn cứ SPEC cần planner cập nhật brief và nguồn tham chiếu, thay vì xin lại cùng một quyết định. Các lựa chọn kỹ thuật chưa chốt để người viết đề xuất cụ thể, reviewer kiểm; không diễn giải bảng trên thành ủy quyền thay chính sách.

## 5. Gói quyết định sẵn để hoàn thiện ADR-002 — CHƯA DUYỆT

Đề xuất gộp vào một bản ADR sửa đổi, giữ phần Adoption record chưa ký cho đến khi có quyết định trực tiếp:

1. **Chủ dữ liệu P1.0:** nội dung tiếp tục ở Drive/Docs/Vault/Git. AI OS sở hữu hồ sơ dự án mở rộng, registry kênh và chính sách mapping, DocumentRecord/Revision metadata, review/publication/trace metadata theo từng lát. Giữ project ID và membership/RLS hiện có. SourceEvent/intake P1.1 bổ sung riêng hợp đồng chủ sự kiện và sổ ticket; P1.0 không chuyển trạng thái ticket.
2. **Ranh giới miền:** Liberico, Xeca, IBS HI là các miền phân nhóm dữ liệu theo phạm vi được xác nhận, không tự suy là tenant hay pháp nhân kế toán. Bổ sung mapping có nguồn/người xác nhận; thiếu mapping hiện “Chưa xác nhận”, không tự cấp quyền hoặc cộng gộp.
3. **Giới hạn lần đầu:** chỉ đăng ký con trỏ, version/hash có mức xác minh, nháp và chỉ mục tìm kiếm có quyền. Bản chuẩn có thể chưa tồn tại. Không cache IBS HI ngoài phạm vi được duyệt; không tự tạo snapshot, đổi share, cấp work ID, sửa Sheet hoặc áp quyền nhóm mới. Việc áp migration dữ liệu thật là lần triển khai riêng.

Lý do cần chốt: ADR-002 còn Proposed/chưa ký và chưa phủ registry kênh. Căn cứ chính xác: `docs/ADR-002-project-document-ownership.md:3,11–15,27`, `docs/SLICE-BRIEFS.md:21`, AR-09 trong quy định coding. **Quyền triển khai cũ của 0.6/0.7 không được điền thay quyết định này.**

## 6. Bàn giao thực hiện cho Claude Code

1. Đọc hồ sơ này và ghim base `8229233`; kiểm HEAD/team changes trước khi sửa. Giữ main và dữ liệu ngoài Git.
2. Sửa R-01 bằng PR nhỏ, có ca hồi quy đủ request fingerprint. Codex kiểm diff riêng; chưa cần restart để chứng minh lỗi đã sửa trong mã.
3. Planner cập nhật brief theo R-02 và mục 4; chuẩn bị bản ADR cụ thể theo mục 5. Không tự ký ADR hoặc đổi AGENTS.
4. Khi phần quyết định đã chốt, lập kế hoạch P1.0: registry dự án/kênh chưa kích hoạt, tài liệu/revision bất biến, chỉ mục Z2, mẫu có version, UI và bộ kiểm. Giữ hai con trỏ tách biệt, không tạo baseline giả.
5. Giữ ca LBRC014 đủ ba SHA và phần chứng cứ iOS bổ sung; XECA006 tách XECA005, trường thiếu hiển thị chưa có. Không biến fixture thành nguồn thật hay sửa trạng thái Sheet.
6. Bộ nhận bàn giao: DOC-01/07/10/13/14/18 + PM-08 phần sổ; quyền âm theo cả tenant và project; request key khác đối tượng; expected-version; replay migration/projector; rollback trên bản sao; giao diện 360px và desktop. Các ca DB cần cả PGlite và PostgreSQL thử trước rollout.
7. Review ghim base/head cụ thể và lưu chúng cùng output. Cổng phải từ chối khi thiếu output, lệnh tạo diff lỗi hoặc verdict không hợp lệ; mã thoát 0 của CLI không tự đồng nghĩa PASS. Nếu có commit mã mới sau review, kiểm lại đúng diff mới.
8. Giao DELIVERY-010 với bốn mức tách riêng. Dừng ở gói sẵn triển khai; chỉ trình phê duyệt rollout khi có backup/restore, rollback, tuyến mới và phạm vi ảnh hưởng cụ thể.

## 7. Giới hạn và bảo toàn

Không sửa mã sản phẩm, migration, quyền tài khoản, cấu hình bot, server hay bảng việc. Không push, không gửi Telegram, không chạy import/cutover. Chỉ thêm hồ sơ review và bằng chứng. Dữ liệu LBRC014/XECA006 trong thiết kế là nguồn đã đối soát trước, chưa refresh Sheet hay GitHub nghiệp vụ trong lượt này.

Đây là kiểm độc lập với người thực hiện Bước 0; Codex đã tham gia thiết kế PM/BA trước đó nên không gọi đây là phản biện độc lập toàn bộ kiến trúc. Native PostgreSQL, nguồn tài liệu thật, UAT và quyền người dùng thật vẫn là các bước riêng.

