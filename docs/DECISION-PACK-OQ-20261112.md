# Gói quyết định OQ-01…OQ-21 — LibeTech AI OS

Version 0.2 · 12/11/2026 · Lập bởi agent `planner`. **Trạng thái: BẢN CHỐT, đã ký.** Hướng được Chairman duyệt ngày 12/11/2026; [ADR-002](ADR-002-project-document-ownership.md) bản 1.1 **Accepted** — Chairman ký ADR-002 1.1 ngày 12/11/2026 («Ký ADR-002 1.1»). Thay bản 0.1 (đề xuất «phương án đủ»); chỗ nào 0.1 khác bản này thì bản này thắng.

## 1. Quyết định của Chairman, 12/11/2026 (nguyên văn)

> «Duyệt hướng của gói OQ ngày 12/11, với các sửa theo phản biện Codex: OQ-03 chọn b; OQ-04 chưa tự ánh xạ LibeTech nội bộ; OQ-05 chọn a cho cổng P1.0; OQ-07 phải chốt quyền nguồn, lưu giữ và thử khôi phục trước pilot; OQ-09 phải chứng minh đường nhận tin và đối soát hai kho; OQ-14 làm c trước, chỉ nối mô hình sau khi duyệt phân loại dữ liệu; OQ-18 soạn SPEC/ADR trước, lập trình sau pilot; OQ-19 chỉ coi health tự khai là thông tin báo cáo; OQ-20 chỉ yêu cầu rollback từ migration 013. Các mục còn lại theo bảng phản biện.
> Sửa ADR-002 v1.1 và brief cho nhất quán rồi trình lại bản chốt. Giữ main của ai-together cho lab, làm và review AI OS trên nhánh libetech-ai-os, phát hành d1-ai1 theo tuyến riêng. Với libe-tech, giữ cây gateway làm bằng chứng, chuyển có chọn lọc phần mã an toàn lên từ origin/main; không push nguyên 30 thay đổi. Các điểm dừng triển khai, migration thật, gateway restart và gửi tin thật giữ nguyên.»

Câu về `libe-tech` (đã khôi phục đủ ngày 12/11 sau khi phiên điều phối phát hiện đã lược) xử lý ngoài gói này, xem `DELIVERY-009-repo-bootstrap-20261111.md` mục 10.2.

**Cách áp:** mục Chairman nêu tên thắng mọi nguồn khác. Mục không nêu tên: hàng tương ứng trong bảng §4 của [phản biện Codex](reviews/CODEX-STEP0-P1-READINESS-20261112.md) (`:68-87`) thắng chữ cái của gói 0.1. Lời Chairman ngày 12/11 trước đó («Làm đủ luôn», «Không đợi Quân») không còn là căn cứ chọn phương án.

**Chữ ký.** «Duyệt hướng» không thay chữ ký; chữ ký là lời riêng ghi ở Adoption record của ADR-002: Chairman ký ADR-002 1.1 ngày 12/11/2026 («Ký ADR-002 1.1»). Từ đó migration 013+ được phép **viết**; áp lên dữ liệu thật vẫn là điểm dừng. Lời văn sửa `AGENTS.md` ở §5 **chưa** được duyệt bởi chữ ký này; lời văn đó được duyệt riêng sau đó, cùng ngày 12/11/2026 (xem §5).

**Điểm dừng giữ nguyên** (`HANDOFF-CLAUDE-CODE-20261111.md:76`, `SLICE-BRIEFS.md:12`): triển khai d1-ai1 · áp migration trên dữ liệu thật · khởi động lại gateway chung/cài lại bridge · gửi tin vào nhóm hoặc DM thật · sửa `AGENTS.md` · ký ADR. **Luôn cấm:** tự nghiệm thu, tự cấp quyền, điểm dùng cho KPI/lương, khoá bí mật trong repo, đọc DB nền khác.

**Nhánh và tuyến phát hành:** `main` của ai-together giữ cho lab; AI OS làm và review trên nhánh `libetech-ai-os`; phát hành d1-ai1 đi tuyến riêng, mỗi đợt một lần duyệt.

## 2. Bảng chốt

Nguồn: **CH** = Chairman nêu tên · **CX** = hàng Codex §4 · **=** = trùng gói 0.1. «Làm» nghĩa là mã + test + tệp migration trên PGlite/PostgreSQL thử với dữ liệu tổng hợp.

| OQ | Chốt | Nguồn | Làm ở đâu | Còn dừng ở |
|---|---|---|---|---|
| 01 | (b) ký ADR-002 có sửa, bản 1.1 | CX `:70`, = | Hồ sơ đã sửa | Đã chốt: ký 12/11/2026 |
| 02 | (a) một ADR phủ sổ dự án, kênh, sự kiện nguồn, outbox | CX `:70`, = | Hồ sơ đã sửa | Đã chốt: ký 12/11/2026 |
| 03 | **(b)** ba trạng thái + một nguồn số bản + sửa `bridge.ts:43`; không đụng `bot-plugin` | CH | Lát 1 | Không có (không cài lại bridge) |
| 04 | (a) có sửa: nhãn miền báo cáo, **AI không ánh xạ dự án nào**; LibeTech nội bộ không được đề xuất | CH + CX `:72` | Lát 1 (schema), lát 4 (báo cáo) | Dòng ánh xạ do người có quyền tạo; đã chốt khi ký 12/11/2026 |
| 05 | **(a)** hai con trỏ độc lập, bản chuẩn được rỗng «Chưa có» | CH, CX `:73` | Lát 1 | P1.0 không tạo duyệt thật |
| 06 | (a) giữ `source_ref` + «chưa đối soát»; không tạo việc Z1 | CX `:74` | Lát 1 | PM xác nhận khi tới bước cấp ID việc |
| 07 | P1.0 chỉ metadata + mức xác minh hash; kho snapshot chỉ là thiết kế | CH + CX `:75` | Lát 1 | **Cổng trước pilot:** quyền nguồn, lưu giữ, thử khôi phục |
| 08 | (b) bot giữ chỉ đọc; principal tiếp nhận hẹp riêng | CX `:76`, = | Lát 2 | Cấp khoá, sửa `AGENTS.md` |
| 09 | (c) có điều kiện: sổ ticket vẫn là chủ trạng thái; inbox chỉ có hiệu lực sau hai chứng minh | CH + CX `:77` | Lát 2 | Chứng minh đường nhận tin; đối soát hai kho |
| 10 | (b)+(c) tuyến ký riêng, tệp chỉ đi locator + hash | CX `:78`, = | Lát 2 | Sửa proxy, cài plugin; con số trần do reviewer kiểm |
| 11 | (a) gateway kéo outbox, báo biên nhận; P1.0 chỉ lưu ánh xạ «đề xuất» | CX `:78`, = | Lát 1 (đề xuất), lát 2 (hiệu lực) | Gửi thật, chat/topic thật, privacy mode |
| 12 | (c) tách ba ca: DM tự động · phiếu đổi quyền · UAT thật | CX `:79`, = | Lát 2 | UAT thật trên runtime |
| 13 | (c) PM-01…08 + XI-01/07/08, ghi mã theo lát; XI-02…06 hoãn | CX `:80`, = | Lát 2–4 | XI-01/07/08 cần ca thật |
| 14 | **(c) trước**; hướng (a) chỉ nối sau khi duyệt bảng phân loại → mô hình | CH, CX `:81` | Lát 3 (đầu ra giả lập) | Bảng phân loại; Z4 chưa bật |
| 15 | (a) giữ và kiểm hồi quy 3/3 + ba sự kiện; **không** evidence phi mã | CX `:82` | Lát 3 | (b), (c) của gói 0.1 không làm đợt này |
| 16 | (c) lát 3 lưu liên kết + đánh dấu cần xem lại; lát 4 truy ảnh hưởng, thông báo | CX `:83`, = | Lát 3, 4 | Gửi thật |
| 17 | (a) không điểm chính thức; không xoá chức năng điểm nháp cũ | CX `:84`, = | Lát 4 | — |
| 18 | **(a) phần hồ sơ:** soạn SPEC-010 + ADR-003; **lập trình sau pilot** | CH, CX `:85` | Lát 5 = hai bản nháp | Duyệt SPEC-010/ADR-003; pilot |
| 19 | Health tự khai (kể cả `/api/health` của AI OS) là **thông tin báo cáo** | CH, CX `:85` | Ghi vào SPEC-010 | Danh sách dịch vụ, nguồn quan sát độc lập |
| 20 | (a) `migrations/rollback/`, **chỉ từ 013**, thử trên bản sao | CH, CX `:86` | Lát 1–4 | Chạy rollback trên DB thật |
| 21 | (a) tệp mẫu có version + hash trong repo, AI OS giữ chỉ mục; không cài skill bot | CX `:87` | Lát 1 | Cài vào bot (không thuộc P1.0) |

## 3. Chi tiết các mục đổi so với gói 0.1

**OQ-03 (b).** Lát 1 hiện ba trạng thái `đã cấu hình` / `đã kiểm thực tế` / `chưa nối luồng ghi` (`IMPLEMENTATION-ROADMAP.md:44`), gom số bản về một nguồn (`package.json:3`) thay các chỗ viết cứng (`src/components/workspace.tsx:39`, `:47`, `src/app/api/health/route.ts:10`), sửa `src/server/bridge.ts:43`. Theo Codex `:71`: không gắn «đã kiểm thực tế» chỉ vì có biến cấu hình. Phương án (c) bị loại nên `bot-plugin/__init__.py:15` (`0.3.0`) và `bot-plugin/plugin.yaml:2` (`0.2.1`) giữ nguyên; lệch số bản trong plugin là tồn đọng đã biết.

**OQ-04.** Ba nhãn miền báo cáo Liberico BU · Xeca · IBS HI là nhãn phân nhóm dữ liệu; **không** phải `tenant_id`, `organization_id`, `entity_code`, không khẳng định pháp nhân. Giữ nguyên project ID, membership, RLS; không tách tenant. Mỗi dòng ánh xạ dự án → nhãn do **người có quyền** tạo hoặc xác nhận, có nguồn và audit. AI không tạo, không gieo sẵn, không đề xuất dòng ánh xạ nào; riêng LibeTech nội bộ không được nêu cả ở dạng gợi ý. Dự án chưa có dòng ánh xạ hiện «Chưa xác nhận», không vào tổng nào và không sinh quyền. Bảng ánh xạ `LBRC → …`, `LibeTech → LIBERICO_BU` của gói 0.1 **bị rút**.

**OQ-05 (a).** Cổng P1.0 đạt khi hai con trỏ tách riêng trong schema và giao diện; bản chuẩn rỗng là hợp lệ. P1.0 không tạo bản duyệt thật để «cho đủ». Ca Xeca vẫn ghi «chờ tin gốc» (`HANDOFF…:99`).

**OQ-07.** P1.0 chỉ lưu con trỏ, revision, hash và **mức xác minh** của hash (`tự khai` / `đã kiểm`); hash do người đăng ký khai không bao giờ hiện như đã kiểm. Mọi tài liệu ở `SOURCE_NOT_FROZEN`. Thiết kế kho snapshot (PostgreSQL, bất biến, hash do server tính) được giữ trong ADR-002 như thiết kế; **không đóng băng, tải lên hay duyệt bản chuẩn thật** trước khi chốt ba việc: quyền nguồn Drive/Docs/Git, chính sách lưu giữ, và một lần thử khôi phục đạt. Đây là cổng trước pilot. Trần 10 MB của gói 0.1 chỉ còn là con số thiết kế.

**OQ-09.** Sổ ticket của plugin priority1 tiếp tục là chủ trạng thái ticket. Thiết kế inbox AI OS chỉ có hiệu lực sau hai mục nghiệm thu của P1.1: (1) chứng minh trên đường nhận thật rằng tin nhóm tới được `bot-plugin` của repo này song song với priority1; (2) ca đối soát inbox ↔ sổ ticket đạt. (1) không đạt thì dừng và trình lại; không sửa plugin priority1 (`AGENTS.md:5`).

**OQ-14 (c trước).** Lát 3 dựng bảng Z4, hợp đồng vào/ra, sáu manifest và bộ eval với đầu ra giả lập. Không gọi mô hình; principal pipeline AI chưa được cấp khoá; Z4 chưa bật. Nối mô hình thật là đợt riêng sau khi Chairman duyệt bảng phân loại dữ liệu → mô hình. Nơi chạy kỹ năng theo hướng (a) của gói 0.1 được chốt cùng bảng đó.

**OQ-15 (a).** Giữ nguyên 3/3 (`src/server/bom.ts:101`) và ba sự kiện (`src/server/service.ts:145-162`), thêm test hồi quy. Không migration mở rộng bảng `evidence`; review tài liệu không nới điều kiện nghiệm thu sản phẩm. Bot nhắc phiếu (gói 0.1 «+c») không nằm trong hàng Codex nên không làm đợt này.

**OQ-18, OQ-19.** Lát 5 của đợt này chỉ gồm bản nháp SPEC-010 (mã ca OPS-xx) và ADR-003; không migration, không mã. Lập trình sau pilot và sau khi hai tệp được duyệt. SPEC-010 phải tách hai mức: «báo cáo» (dịch vụ tự khai, kể cả `src/app/api/health/route.ts:10` lấy digest từ biến môi trường) và «quan sát» (kiểm độc lập có bằng chứng). Chỉ mức sau mới được hiện là sự thật đã quan sát.

**OQ-20.** Tệp rollback bắt buộc từ 013, đặt ở `migrations/rollback/` — runner chỉ đọc tên tệp trực tiếp trong `migrations/` (`scripts/migrate.ts:12`, `src/server/db.ts:11`), không quét thư mục con. Mỗi tệp được thử tiến → lùi → tiến trên bản sao. Không viết bù cho 001–012.

**OQ-21 (a).** Tệp mẫu T0–T6 có version và hash trong repo; AI OS giữ chỉ mục (mã, version, hash). Vị trí thư mục do builder ghi trong kế hoạch lát 1 và reviewer kiểm; planner đề xuất `docs/templates/`.

## 4. Hai phát hiện của Codex đưa vào lát 1

| Mã | Phát hiện | Việc trong lát 1 |
|---|---|---|
| R-01 | `resolve()` ở `src/server/feedback.ts:46-52` so lại lần xử lý cũ theo tenant/actor/khoá nhưng bỏ qua đối tượng; cùng khoá cho phản hồi khác vẫn trả «replayed» | Không sao chép cách replay này. Thao tác tài liệu đi qua `deduplicate` (`src/server/service.ts:57`) với dấu vân tay gồm thao tác + mã tài liệu + revision + `expectedVersion`. Sửa `resolve()` là thay đổi nhỏ riêng, có hai ca hồi quy: cùng khoá/cùng yêu cầu và cùng khoá/khác đối tượng |
| R-02 | Brief giao tìm kiếm nhưng không giao projector hay chỉ mục Z2 (`SPEC-009…:75`, `:131`) | Thêm projector có tên và chỉ mục metadata Z2 có `tenant_id` + `project_id`; kiểm quyền trước truy vấn và trước khi trả; không lộ tên hay số đếm; chạy lại projector không tạo bản sao; nguồn mất không làm mất lịch sử |

Lát 4 mở rộng chỉ mục này sang tìm nội dung; không dựng chỉ mục thứ hai.

## 5. Lời văn cho `AGENTS.md` — đã duyệt (R10)

**Duyệt ngày 12/11/2026 (Chairman, nguyên văn):** «Duyệt lời văn AGENTS.md mục 5». Lời duyệt áp cho lời văn của cả chín dòng, nhưng không bỏ cột «Áp khi»: chỉ dòng có điều kiện đã đạt mới được ghi vào `AGENTS.md`. Ngày 12/11 đã áp năm dòng có điều kiện «Ký ADR-002 1.1» hoặc «Bất kỳ lúc nào». Lời duyệt này là lần dừng chờ Chairman mà điểm dừng «sửa `AGENTS.md`» (§1 ở trên, `SLICE-BRIEFS.md:13`) đòi cho năm dòng đã áp. Điểm dừng đó vẫn giữ cho mọi lần sửa khác. Bốn dòng còn lại giữ nguyên lời văn đã duyệt; khi điều kiện đạt, trình Chairman xác nhận điều kiện rồi mới áp. Dòng Z4 hiện tại («Z4: future AI suggestions; not enabled.») giữ nguyên cho tới khi xong lát 3. Số dòng ở cột «Dòng» là số dòng của `AGENTS.md` trước lần áp này.

| Dòng | Lời văn đề xuất | Áp khi | OQ | Trạng thái |
|---|---|---|---|---|
| `:9` | Thêm: «Every migration from 013 has a rollback file in `migrations/rollback/`, which the runner does not scan; rollback is never run on a real database without Chairman approval.» | Ký ADR-002 1.1 | 20 | Đã áp 12/11/2026 |
| `:11` Z1 | «Z1: owned work/service/acceptance records, project registry, proposed channel mappings and document governance metadata (ADR-002 v1.1).» | Ký ADR-002 1.1 | 02 | Đã áp 12/11/2026 |
| `:11` Z2 | «Z2: derived summary tables and the document metadata index, each populated by a named projector.» | Ký ADR-002 1.1 | R-02 | Đã áp 12/11/2026 |
| `:11` Z4 | «Z4: AI draft tables and contracts may exist but are not enabled: no model call and no AI-pipeline credential until Chairman approves a data-classification-to-model table.» | Xong lát 3 | 14 | Chưa áp — chờ xong lát 3 |
| mới | «Reports never aggregate across reporting domains (Liberico BU · Xeca · IBS HI). A domain label is not tenant_id, organization_id or entity_code. Project-to-domain rows are created or confirmed by an authorized person with a source; unmapped projects show "Chưa xác nhận". IBS HI: pointers, hashes and Tech work metadata only.» | Ký ADR-002 1.1 | 04 | Đã áp 12/11/2026. Mã cũ **chưa tuân thủ**: `overview()` (`src/server/service.ts:72-77`) cộng số liệu của mọi dự án được cấp quyền, không xét nhãn miền. Việc sửa đã xếp ở lát 4 mục 7 (`SLICE-BRIEFS.md:230`). Mã mới viết từ nay theo luật này (`SLICE-BRIEFS.md:11`). |
| `:5` | Thêm: «Its ticket ledger stays the single owner of ticket state; AI OS stores ticket IDs as external references only.» | Hai chứng minh OQ-09 đạt | 09 | Chưa áp — chờ hai chứng minh OQ-09 |
| `:11` Z1 | Thêm vào danh sách Z1: «source events, intake candidates, outbox and delivery receipts». | Hai chứng minh OQ-09 đạt | 02, 09 | Chưa áp — chờ hai chứng minh OQ-09 |
| `:13` | «Bot principal is read-only (existing exception: account-approval ballots). A separate intake/delivery service principal may write only source events, intake candidates and delivery receipts. No machine principal may create, assign, close or accept work, approve a document, or grant access.» | Hai chứng minh OQ-09 đạt | 08, 11 | Chưa áp — chờ hai chứng minh OQ-09 |
| mới | «Self-reported health, including this service's `/api/health`, is report information, never evidence of observed runtime state.» | Bất kỳ lúc nào | 19 | Đã áp 12/11/2026 |

## 6. Chỗ lời Chairman và bảng Codex chưa khớp hẳn, và chỗ chưa chắc

1. **OQ-03.** Codex `:71` viết «chỉ bổ sung trạng thái»; Chairman chọn (b) rộng hơn (gom số bản, sửa `bridge.ts:43`). Áp (b). Builder kiểm trước rằng bot không so trường `version` của cầu nối.
2. **OQ-04.** Lời Chairman chỉ nêu «LibeTech nội bộ»; phiên điều phối giao áp rộng hơn theo Codex `:72`: AI không ánh xạ dự án nào. Bản này áp nghĩa rộng. Codex gọi «nhãn miền sở hữu», bản này dùng «nhãn miền báo cáo».
3. **OQ-07.** Chairman đặt mốc «trước pilot»; Codex `:75` đặt mốc «trước đóng băng, tải hoặc duyệt baseline thật». Áp cả hai. Hệ quả: lát 3 chỉ kiểm thao tác duyệt revision trên dữ liệu tổng hợp.
4. **OQ-14.** Codex `:81` coi nơi chạy AI là việc còn phải quyết; Chairman duyệt hướng gói 0.1 (kỹ năng trong profile bot). Bản này ghi hướng (a) nhưng chỉ chốt cùng bảng phân loại.
5. **OQ-15.** Bot nhắc phiếu 3/3 có trong `SPEC-009…:43` nhưng không có trong hàng Codex `:82`; bản này để ngoài đợt. Muốn giữ thì cần nêu rõ.
6. **OQ-10.** Trần 32 KB cho thân sự kiện, 20 MB cho tệp và danh sách loại tệp là con số planner đề xuất, không lấy từ SPEC và chưa ai duyệt.
7. **OQ-19.** Thẻ dịch vụ hiện đã ghi «Có quan sát» khi có `observed_sha` (`src/components/workspace.tsx:51`); chưa kiểm ai ghi cột đó. SPEC-010 phải rà trước khi dùng lại nhãn này.
8. **OQ-21.** `AGENTS.md:7-10` không khai thư mục cho tệp mẫu; vị trí `docs/templates/` là đề xuất.
