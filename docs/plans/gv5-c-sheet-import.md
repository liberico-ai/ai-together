# Kế hoạch GIAO VIỆC 5 · hạng mục C — Nhập bảng «Đầu việc Tech» lên nền tảng

Ngày: 25/11/2026 · Nhánh: `feat/gv5-c-sheet-import`, tách từ PR A (`0159b1d`, chưa merge); PR B giữ 025 và 026 · Migration: `027`.
Căn cứ: lời Chairman 25/11/2026 về hạng mục C; bổ sung của phiên điều phối 25/11/2026 về dòng IBS HI và số đếm; `AGENTS.md`; `docs/plans/gv5-a-tech-create-approval.md`; `migrations/024_work_requests.sql`; tiền lệ `migrations/011_team_source_catalog.sql`, `src/server/source-snapshot.ts`, `scripts/import-team-tech-catalog.ts`; `docs/SPEC-004-bom-tech-phan-cong.md` mục 3 («nhập hàng loạt» không được đổi phân công); `docs/QUY-CHE-DU-THAO-BOM-TECH.md` Q01, Q02, Q07.
Trạng thái: **đã dựng** (mã và ca kiểm trên nhánh, chưa merge, chưa chạy trên tệp thật). Bản này ghi đúng điều đã dựng, sau các chỉnh của phiên điều phối 25/11/2026 (nêu ở mục 12). Các điểm «tạm» ở mục 11 chờ Chairman (OQ-62 do phiên chính ghi).

## 1. Việc này làm gì, không làm gì

- Làm: người nhập tải một tệp CSV xuất từ bảng nguồn → server đọc → **xem trước** (không ghi gì) → người nhập xác nhận ánh xạ → **ghi** mỗi dòng hợp lệ thành một `work_requests` `origin='import'`, `state='pending'`, chờ ghế BoM duyệt như PR A.
- Không làm: sửa bảng nguồn (bảng của PM, chỉ đọc); đọc tệp .xlsx; gọi Google API; ghi `work_items` trực tiếp; ghi `analytics.tech_source_tasks` (011 giữ nguyên); đổi người thực hiện của việc đã có.
- Bản nguồn: bảng Google Sheet hay workbook .xlsx cũ là bản nguồn — **«chờ PM xác nhận bản nguồn»**. Kế hoạch chỉ nhận trang «Đầu việc Tech» tám cột; tệp khác bị từ chối ở tiêu đề cột.

## 2. Định dạng đầu vào — khuyến nghị (a) CSV

| | (a) CSV UTF-8 tải lên | (b) JSON `sourceSnapshot` |
|---|---|---|
| Ai tạo được tệp | PM, ngay trong Google Sheets | Cần người vận hành dựng JSON (range, hash, mốc sửa) bằng tay hoặc script |
| Phụ thuộc mới | Không (bộ đọc CSV tự viết, ~60 dòng) | Không |
| Ô ngày | Xuất theo chữ đang hiển thị → giữ đúng «như đã viết» | Tuỳ người dựng JSON |
| Điểm yếu | Tệp không mang danh tính nguồn hay mốc sửa: người nhập **khai** liên kết bảng | Dễ sai tay; không phải việc PM tự làm được |

Chọn (a). Lý do: PM tự làm được không cần công cụ; không thêm thư viện; giữ nguyên chữ của ô. Điểm yếu được ghi thẳng: danh tính nguồn là **lời khai của người nhập**, hiển thị đúng như vậy. Phần kiểm dòng dùng lại luật của `source-snapshot.ts` (tiêu đề tám cột, `dueIssue`, vân tay tám ô) bằng cách tách các hàm đó ra dùng chung, không viết lại.

Các bước của PM (chép vào màn hình nhập):
1. Mở bảng nguồn, chọn trang «Đầu việc Tech». Không sửa gì.
2. Tệp → Tải xuống → «Giá trị được phân tách bằng dấu phẩy (.csv)». Google Sheets chỉ xuất trang đang mở, mã UTF-8.
3. Không mở lại tệp bằng Excel rồi lưu (Excel có thể đổi mã ký tự và đổi dạng ngày).
4. Trên AI OS: «Nhập bảng việc» → chọn tệp, dán liên kết của bảng, gõ tên trang → «Xem trước».

Luật đọc tệp:
- Giải mã bằng `TextDecoder('utf-8',{fatal:true})` trên **byte gốc**; sai → `NOT_UTF8` 422 «Tệp không phải UTF-8. Tải lại từ Google Sheets theo bước 2, không lưu qua Excel.». BOM đầu tệp được bỏ.
- CSV theo RFC 4180: ô trong ngoặc kép, `""`, xuống dòng trong ô. Ngoặc không đóng → `CSV_MALFORMED` 422. Số dòng nguồn = thứ tự bản ghi + 1, không phải số dòng vật lý.
- Dòng 1 phải đúng tám tiêu đề `STT | BU | Đầu việc | Người phụ trách | Phối hợp | Trạng thái | Hạn | Ghi chú`; cột thứ chín trở đi phải rỗng ở mọi dòng. Sai → `SOURCE_HEADER_MISMATCH` 422. Không tự bỏ cột lạ.
- Giới hạn: tệp ≤ 256 KB, thân yêu cầu ≤ 400 KB (đọc theo luồng, dừng ở ngưỡng, 413), ≤ 500 dòng dữ liệu, mỗi ô ≤ 2 000 ký tự.

## 3. Luồng và hợp đồng API

Cả hai lệnh nhận cùng một phong bì JSON (schema `strict`): `fileBase64` (byte gốc của tệp), `sourceUrl`, `sheet`. Danh tính và tenant chỉ lấy từ phiên; phong bì có `tenantId`, `importerId`, `state` → bị từ chối.

1. `POST /api/v1/work-imports/preview` — server giải mã, đọc, kiểm từng dòng, **đọc** (không ghi) bảng khoá nhập để báo trước dòng trùng và dòng đã đổi. Trả: `fileHash` (sha256 byte), `previewDigest` (sha256 của `fileHash` + kết quả từng dòng), danh sách dòng với cờ, các nhãn BU gặp trong tệp kèm dự án mặc định (mục 4), các chữ «Người phụ trách» khác nhau kèm ứng viên, và bảng đếm (mục 8). Không transaction ghi nào được mở.
2. Người nhập xác nhận trên màn hình: mỗi nhãn BU → một dự án (chọn rõ); mỗi chữ người phụ trách → một người hoặc để trống.
3. `POST /api/v1/work-imports` — phong bì + `previewDigest`, `requestKey`, `projects: [{buLabel, projectId}]`, `owners: [{text, projectId, userId}]`. Server đọc lại tệp từ byte, tính lại digest; khác → `PREVIEW_STALE` 409 (tệp hoặc luật đã đổi so với lúc xem). Một transaction cho cả lô (mục 5). Trả kết quả từng dòng; kết quả lúc ghi là kết quả thật, có thể khác bản xem trước nếu CSDL đã đổi ở giữa.
4. `GET /api/v1/work-imports/:id` — biên nhận lô cho người nhập: số đếm, số dòng, mã lý do. Không có nội dung ô.

`previewDigest` chứng minh lệnh ghi nói về đúng kết quả đọc mà server đã trả; nó **không** chứng minh có người đã đọc màn hình. Giao diện không có đường ghi nào bỏ qua bước xem trước.

`sourceUrl` phải là https, host `docs.google.com` (dùng `sourceHostProblem('drive', …)`). `source_id` = **khoá bảng** (không kèm `gid`; `gid` chỉ là siêu dữ liệu của liên kết trong `source_url`); trang được ghim bằng tên «Đầu việc Tech» (NFC) và bằng bước kiểm tiêu đề. Tham chiếu dòng theo tiền lệ 011: `<source_id>/<sheet>!A<n>:H<n>` (tệp + trang + dòng).

## 4. Ánh xạ dự án, người, mã việc, hạn, trạng thái

- **Ai được nhập** (Chairman 25/11: «Tất cả thành viên Team Tech được tạo việc ở tất cả các dự án»): thành viên Team Tech trong danh sách (`app_actor_is_tech_member()` của 024) — vào mọi dự án của tenant —, **hoặc** người có vai `manager` theo dự án (`projectRole`) ở **mọi** dự án đích của lô. Người khác và bot → `IMPORT_DENIED` 403 (xem trước và ghi). Quản lý dự án A nhập vào dự án B không phải của mình → 403, không ghi gì. Dự án đích không thấy được với thành viên Team Tech (không có trong danh mục) → `SCOPE_DENIED` 404.
- **BU → dự án:** người nhập chọn rõ cho từng nhãn BU. Mặc định chỉ gợi ý khi nhãn là `XECA`, `LBRC`, `IBS HI` và tenant có đúng một dự án tên khớp tuyệt đối «XECA · Team Tech», «LBRC · Team Tech», «IBS HI · Team Tech» với cùng `bu`. Nhãn khác, hoặc không có dự án khớp → dòng «cần đối soát» `UNMAPPED_BU`. Không so gần đúng.
- **Người phụ trách:** chữ của ô luôn giữ nguyên (`owner_raw`). Chỉ khi ô là một tên duy nhất **và** người nhập xác nhận cặp chữ → người (người đó là **người thực hiện** — vai `engineer` — của dự án đích, **và** người nhập đã thấy họ là thành viên dự án đó qua danh bạ hiện có; server kiểm lại) thì `work_requests.assignee_id` mới có giá trị; sai → `OWNER_NOT_IN_PROJECT` 422, không ghi gì. Ứng viên chỉ gồm người trùng tuyệt đối tên và nằm trong phạm vi dự án của chính người nhập; không có hàm liệt kê người mới, không lộ thêm gì. Thành viên Team Tech không có quyền ở dự án đích thì không thấy ai: người phụ trách để trống và gắn cờ `OWNER_NOT_MAPPED` (cờ này cũng gắn cho mọi ô một tên chưa được xác nhận). Gợi ý không tự tick. Ô có nhiều người (dấu `,` `;` `/` `&`, « và », xuống dòng) → cờ `MULTI_OWNER`, để trống người. Ô rỗng → cờ `MISSING_OWNER`, để trống. Cột «Phối hợp» chỉ lưu chữ.
- **Duyệt theo đúng PR A đã dựng:** duyệt một yêu cầu nhập tạo `work_items` với người thực hiện đề xuất (ánh xạ đã xác nhận, nếu có) và hai người nghiệm thu đề xuất (để trống ở bảng này) — đó là **giao lần đầu**. Mọi lần đổi người thực hiện sau đó vẫn cần 3/3 (`bom_guard_assignment` và `BOM_REQUIRED`). Nhập bảng không ghi `work_items`, không ghi `bom_sources`, không chạm `bom_guard_assignment`, `bom_sources`, `bom.ts`.
- **Mã việc:** tìm chuỗi dạng mã (khớp ràng buộc `code` của 024) trong «Đầu việc» và «Ghi chú». Đúng một mã → `code`. Nhiều mã khác nhau → cờ `MULTI_CODE`, `code` trống, chữ gốc giữ nguyên. Mã đã có ở `work_items` của dự án đích → «cần đối soát» `CODE_EXISTS` (duyệt sẽ gặp `CODE_TAKEN`).
- **Hạn:** chữ của ô luôn giữ (`due_raw`), hiện là «Hạn theo bảng nguồn». `due_at` chỉ có khi `dueIssue` trả «không vấn đề» (ngày hợp lệ, không đọc được theo hai thứ tự), theo cùng quy ước giờ mà form của PR A dùng: ngày đó lúc 16:00 giờ Việt Nam. Ngày hai nghĩa, ngày sai → `due_at` trống + cờ `AMBIGUOUS_DUE` / `DATE_FORMAT_CONFLICT` / `INVALID_DUE`. Ô rỗng → trống + cờ `MISSING_DUE` (mọi trạng thái, không chỉ việc đang mở). Không đoán.
- **Trạng thái:** lưu nguyên chữ ở `source_status`, hiện với nhãn «Trạng thái theo bảng nguồn». Không ánh xạ sang `state` của Z1, không phải nghiệm thu (tiền lệ 011). Nhãn ngoài bốn nhãn quen («Chưa làm», «Đang làm», «Hoàn thành», «Tạm dừng») → cờ `UNKNOWN_STATUS`; rỗng → `MISSING_STATUS`; cả hai vẫn nhập.
- **Dòng IBS HI** theo luật riêng của mục 6: duy nhất «Ghi chú» và chữ bằng chứng khác nhau giữa dòng IBS HI và dòng LBRC / XECA.
- **Bằng chứng:** bảng không có cột bằng chứng; chữ «Ghi chú» (gồm liên kết nếu có) của dòng LBRC / XECA lưu nguyên ở `source_note` (dòng IBS HI: không lưu, mục 6), không biến thành bản ghi bằng chứng Z1, không chép vào `criteria` (để rỗng).
- **Chờ BoM duyệt — cách hiểu tạm đã dựng (mục 11, câu 3):** mọi dòng nhập đều `pending`, kể cả dòng bảng ghi «Hoàn thành» hoặc «Tạm dừng». Lý do: (1) Q07 chưa có luật đã chốt, PR A áp «một ghế BoM khác người tạo»; (2) trạng thái nguồn không phải trạng thái Z1; (3) không có luật hiện hành nào cho phép việc nhập hàng loạt có hiệu lực ngay. Hệ quả: người nhập là ghế BoM thì không tự duyệt được dòng mình nhập.

Dòng **hợp lệ** = có STT (chữ-số, `.`, `_`, `-`, ≤ 40 ký tự; thiếu → `MISSING_STT`, sai dạng → `INVALID_STT`), nhãn BU đã ánh xạ, «Đầu việc» dài 5–200 ký tự, không vướng khoá (mục 5). Thiếu người, thiếu hạn, thiếu trạng thái **không** làm dòng mất hợp lệ: nhập với ô trống và cờ. Tiêu đề quá dài không bị cắt: «cần đối soát» `TITLE_LENGTH`.

## 5. Chống ghi lặp

Lời Chairman: khoá = mã việc + tham chiếu nguồn. Số dòng không dùng làm khoá vì chèn một dòng phía trên làm mọi dòng dưới đổi số (011 dùng `source_row` và gặp đúng điểm yếu này). Bảng `work_import_rows` có **ba** ràng buộc UNIQUE, cùng phạm vi `(tenant_id, source_id, sheet)`:

| Ràng buộc | Cột thêm | Bắt được |
|---|---|---|
| U1 | `stt` | Nhập lại cùng dòng; số dòng đổi không ảnh hưởng |
| U2 | `code` (chỉ khi có mã) | Cùng mã việc xuất hiện dưới STT khác |
| U3 | `content_hash` (sha256 bảy ô, không tính STT) | PM đánh lại STT, nội dung y nguyên |

Số dòng vẫn được lưu và nằm trong tham chiếu nguồn để người đọc tìm lại, nhưng không quyết định trùng hay không.

Ghi: `INSERT INTO work_import_rows … ON CONFLICT DO NOTHING RETURNING id` (không nêu đích, nên phủ cả ba). Không có bước «đọc trước rồi ghi».
- Có `id` → chèn `work_requests` + `work_request_events('submitted', payload {origin, batchId, sourceRef})` trong cùng transaction → **«đã nhập»**.
- Không có `id` → đọc dòng đang giữ khoá để **gọi tên** lý do (đọc sau xung đột, không phải cổng ghi): cùng STT và cùng `fingerprint` (sha256 tám ô, như 011) → **«bỏ qua (trùng)»** `DUPLICATE`; cùng STT, vân tay khác → **«cần đối soát»** `SOURCE_CHANGED`; khác STT, trùng mã → `CODE_UNDER_OTHER_ROW`; khác STT, trùng nội dung → `CONTENT_UNDER_OTHER_STT`. Không bao giờ ghi đè dòng cũ hay yêu cầu cũ.
- Trong cùng một tệp: hai dòng trùng STT, trùng mã hoặc trùng nội dung → **cả hai** «cần đối soát» (`DUPLICATE_STT`, `DUPLICATE_CODE_IN_FILE`, `DUPLICATE_CONTENT_IN_FILE`); không dòng nào tự thắng.
- `request_key` của lô chống gửi lặp lệnh ghi: cùng key cùng digest → trả lại biên nhận cũ; cùng key khác digest → `IDEMPOTENCY_CONFLICT` 409.

Giới hạn nói thẳng: dòng vừa đổi STT, vừa đổi nội dung, và không có mã thì không phân biệt được với một dòng mới; nó sẽ được nhập như yêu cầu mới và dừng ở cổng duyệt của BoM. Dòng «cần đối soát» chưa có đường xử lý trong ứng dụng ở PR này (mục 10).

## 6. Dòng IBS HI — luật mặc định đang áp (đã dựng)

`AGENTS.md:16`: «IBS HI: pointers, hashes and Tech work metadata only». Tiền lệ 011 (#fact, `migrations/011_team_source_catalog.sql`, `scripts/import-team-tech-catalog.ts`, theo cách hiểu hiệu lực từ 0.7.0) lưu cho dòng IBS HI tiêu đề, người phụ trách, phối hợp, trạng thái, hạn; PR C theo cách hiểu đó, **trừ chữ tự do «Ghi chú» và mọi chữ bằng chứng** — hai thứ này không lưu. Đây là lựa chọn **tạm** của phiên điều phối (25/11/2026); câu hỏi cho Chairman ở OQ-62.

Dòng IBS HI = nhãn BU của bảng là `IBS HI`, **hoặc** `projects.bu` của dự án đích là `IBS HI`, **hoặc** ánh xạ miền mới nhất của dự án là `IBS_HI` (lấy hợp, theo hướng chặt). Hai điều kiện sau đọc qua hàm `work_import_project_facts` (027), chỉ trả BU và mã miền của một dự án mà người nhập có quyền xem hoặc là thành viên Team Tech.

| Của dòng nguồn | Dòng IBS HI | Dòng LBRC / XECA |
|---|---|---|
| Tham chiếu nguồn (tệp + trang + dòng), STT, số dòng | Lưu (con trỏ) | Lưu |
| `fingerprint`, `content_hash` | Lưu (hash) | Lưu |
| Mã việc | Lưu mã tìm thấy **ở tiêu đề**; không đọc ghi chú; cờ `MULTI_CODE` cũng chỉ tính từ tiêu đề | Lưu mã tìm thấy ở tiêu đề hoặc ghi chú |
| Nhãn BU, nhãn trạng thái, hạn như đã viết | Lưu | Lưu |
| «Đầu việc» (tiêu đề yêu cầu), người phụ trách (`owner_raw` + tài khoản đã ánh xạ), «Phối hợp» | **Lưu** (siêu dữ liệu người làm việc Tech, như 011) | Lưu |
| «Ghi chú» và chữ bằng chứng | **Không lưu**, không hiện ở xem trước, biên nhận hay log; cờ `IBS_NOTE_NOT_STORED` | Lưu nguyên chữ (`source_note`) |

- Không sinh tiêu đề trung tính; không có trigger theo mẫu tiêu đề trên `work_requests`.
- Chặn ở hai tầng: dịch vụ (`source_note` của dòng IBS HI luôn rỗng) và trigger `work_import_rows_guard` của 027: dòng khoá có `source_note` khác rỗng mà nhãn BU là IBS HI, hoặc dự án có BU/ánh xạ mới nhất là IBS HI, bị từ chối. Không có ngữ cảnh tenant thì không phân biệt được, nên trigger từ chối mọi ghi chú khác rỗng (đóng khi không chắc).
- Bản xem trước và biên nhận không bao giờ có cột «Ghi chú» (với mọi dòng). Biên nhận không có chữ nào của ô (số dòng, STT, kết quả, mã lý do, cờ).
- Chi phí sử dụng được ghi: ghế BoM đọc tiêu đề thật của dòng IBS HI, nhưng không có ghi chú; muốn ghi chú phải mở bảng nguồn qua con trỏ.
- Phương án nghiêm nhất (chỉ con trỏ, hash, nhãn; tiêu đề trung tính do máy sinh) không dựng; nếu Chairman chọn thì sửa dịch vụ, không cần đổi bảng. Các dòng 011 đang giữ chữ ghi chú IBS HI ở `analytics.tech_source_tasks` nằm ngoài PR này (giữ, che hay xoá: OQ-62).

## 7. Migration 027 và rollback

`migrations/027_work_imports.sql` — bổ sung, idempotent, trong `BEGIN/COMMIT`, chỉ cần 024 (không cần 025/026), không sửa bảng của 024:

- `work_import_batches` (Z1): `id uuid`, `tenant_id`, `importer_id`, `importer_name`, `request_key uuid`, `preview_digest`, `file_hash`, `source_id`, `source_url`, `sheet`, `source_type` (`'google_sheet'`), `ingested_at timestamptz`, `counts jsonb` (mảng theo nhãn BU và theo miền, **không có khoá tổng**), `mapping jsonb`, `results jsonb` (mỗi dòng: số dòng, STT, kết quả, mã lý do, cờ — **không có chữ của ô**), `created_at`, `updated_at`. UNIQUE `(tenant_id, importer_id, request_key)`.
- `work_import_rows` (Z1): `id uuid`, `tenant_id`, `project_id`, `importer_id`, `batch_id`, `request_id`, `source_id`, `sheet`, `source_row integer > 1`, `stt`, `source_ref`, `code`, `fingerprint`, `content_hash`, `bu_label`, `owner_raw`, `collaborators_raw`, `source_status`, `due_raw`, `source_note`, `source_type`, `ingested_at`, `flags text[]`, `quality_score integer 0–100` (100 trừ 20 cho mỗi cờ), `created_at`, `updated_at`. Ba ràng buộc U1 (STT), U2 (mã), U3 (hash nội dung) cùng phạm vi `(tenant_id, source_id, sheet)`, cộng `UNIQUE(request_id)`. FK `(project_id, tenant_id)` → `projects`; `(batch_id, tenant_id, importer_id)` → lô và `(request_id, tenant_id, project_id)` → `work_requests`, cả hai `DEFERRABLE INITIALLY DEFERRED` để dòng khoá được chèn trước yêu cầu và lô trong cùng transaction. Index trên mọi FK và `created_at`.
- Cả hai bảng: `ENABLE` + `FORCE ROW LEVEL SECURITY`; trigger `reject_history_mutation` chặn UPDATE và DELETE; chỉ `GRANT SELECT, INSERT` cho `libetech_runtime`.
- Policy lô: đọc và ghi (`USING`, `WITH CHECK`) = đúng tenant của ngữ cảnh **và** `importer_id = app.person_id`.
- Policy dòng — đọc: đúng tenant và (người nhập, hoặc dự án nằm trong `app.project_ids`). Chèn: đúng tenant, `importer_id = app.person_id`, dự án trong `app.project_ids` **hoặc** thành viên Team Tech; khoá ghép tới lô mang `importer_id` nên không chèn được vào lô của người khác. Không ngữ cảnh → 0 dòng.
- **Mục 13 thay thế đoạn này về hàm, trigger, quyền cột và chính sách đọc.** Hai hàm SECURITY DEFINER thuộc `libetech_identity` (cùng cách 024): `work_import_project_facts(project)` — runtime gọi được, chỉ trả `bu` và mã miền mới nhất của dự án người nhập có quyền xem hoặc là thành viên Team Tech; `work_import_ibs_hi(tenant, project)` — chỉ trigger dùng. Cấp thêm cho `libetech_identity`: `SELECT` bốn cột của `project_domain_mappings` và một policy đọc theo tenant (`identity_ibs_check`). Không hàm nào trả người.
- Trigger `work_import_rows_guard` (mục 6). Dòng `schema_migrations('027')`.
- Việc kiểm vai (Team Tech hay `manager`) ở dịch vụ; RLS giữ ranh giới tenant và dự án. CHECK chỉ cho toàn vẹn (định dạng hash, STT, độ dài), không mang luật nghiệp vụ.

`migrations/rollback/027_work_imports.sql`: từ chối khi có migration sau 027 đã ghi, và khi một trong hai bảng còn dòng; đọc số dòng bằng `EXECUTE` nên chạy lần hai khi bảng đã mất vẫn không lỗi; gỡ trigger, ba hàm, hai bảng, policy `identity_ibs_check` và quyền cột đã cấp, dòng `schema_migrations`. Không `CASCADE`, không phụ thuộc 025/026. Không chạy trên CSDL phục vụ khi chưa có lời Chairman.

## 8. Số đếm và miền báo cáo

Không cộng qua miền (`AGENTS.md`). Bản xem trước, biên nhận và dry-run đếm ba số **hợp lệ / cần đối soát / trùng** cùng số dòng **của từng nhóm**, theo hai cách đặt cạnh nhau và ghi rõ tên. **Không có số tổng gộp các nhóm** ở màn hình, API, biên nhận hay CSDL.

1. «Theo nhãn BU của bảng nguồn — chưa phải miền báo cáo»: một nhóm cho mỗi nhãn gặp trong tệp. Nhãn BU của bảng không phải `tenant_id`, `organization_id`, `entity_code`, cũng không phải ánh xạ miền đã xác nhận. Đây là cách đếm của biên nhận.
2. «Theo miền báo cáo đã xác nhận của dự án đích» (mục 13: mỗi dự án đích chưa xác nhận là một nhóm riêng «Chưa xác nhận · <tên dự án>»): dòng mới nhất của `project_domain_mappings`; chưa có dòng → «Chưa xác nhận» (`reportingDomainLabel`). Kế hoạch giả định hôm nay ba dự án Team Tech chưa có ánh xạ, nên mọi nhóm nằm ở «Chưa xác nhận» — #hypothesis, dry-run đọc bảng để xác nhận.

Dòng `UNMAPPED_BU` chỉ có ở cách đếm 1. Mốc đối chiếu do phiên điều phối cung cấp cho bản xuất 25/11: LBRC 23 · IBS HI 20 · XECA 8 dòng; script không gắn cứng các số này, lệch thì ghi lại.

## 9. Ca kiểm (viết trước) và tệp chạm

Dữ liệu thử là dòng **giả** (tên giả, mã giả kiểu `TEST001`). Không ca nào đọc tệp thật.

`tests/sheet-import-csv.test.ts` (thuần hàm):
1. Ô có dấu phẩy, ngoặc kép, xuống dòng đọc đúng; số dòng nguồn tính theo bản ghi.
2. Byte không phải UTF-8 → `NOT_UTF8`; BOM được bỏ; ngoặc không đóng → `CSV_MALFORMED`.
3. Sai tiêu đề, hoặc cột thứ chín có chữ → `SOURCE_HEADER_MISMATCH`. Quá 500 dòng, ô quá dài → mã tương ứng.
4. Vân tay tám ô của một dòng bằng vân tay `inspectSourceSnapshot` tính cho cùng dòng (không lệch tiền lệ `tests/spec004.test.ts`).

`tests/sheet-import.test.ts` (PGlite, qua dịch vụ):
5. Xem trước không ghi: số dòng của `work_requests`, `work_request_events`, `work_import_*`, `work_items`, `audit_events` trước và sau bằng nhau.
6. Hạn rỗng → `due_at` null, `due_raw` rỗng, cờ `MISSING_DUE`, dòng vẫn «đã nhập». Hạn hai nghĩa → `due_at` null, `due_raw` nguyên chữ, cờ `AMBIGUOUS_DUE`.
7. Ô nhiều người → `MULTI_OWNER`, `assignee_id` null, `owner_raw` nguyên chữ. Ô một tên không có ánh xạ xác nhận → null. Có ánh xạ nhưng người không thuộc dự án đích → `OWNER_NOT_IN_PROJECT` 422, không ghi gì.
8. Nhập lại cùng tệp → 0 yêu cầu mới, mọi dòng «bỏ qua (trùng)». Chèn một dòng lên đầu rồi nhập lại → chỉ dòng mới «đã nhập».
9. Sửa một ô rồi nhập lại → dòng đó «cần đối soát» `SOURCE_CHANGED`; dòng khoá và yêu cầu cũ không đổi một byte.
10. Đổi STT giữ nội dung → `CONTENT_UNDER_OTHER_STT`. Cùng mã dưới STT khác → `CODE_UNDER_OTHER_ROW`. Trùng trong một tệp → cả hai dòng «cần đối soát».
11. Nhãn BU lạ → `UNMAPPED_BU`. Mặc định chỉ hiện khi tên dự án khớp tuyệt đối; tên gần giống không được gợi ý.
12. Mọi yêu cầu tạo ra có `origin='import'`, `state='pending'`, `source_ref` đúng dạng, `criteria=''`; dòng nguồn ghi «Hoàn thành» vẫn `pending` và không sinh `work_items`.
13. Dòng IBS HI: chuỗi canary đặt ở «Ghi chú» của dòng IBS HI không có ở bất kỳ cột chữ hay jsonb nào của mọi bảng (quét toàn bộ), ở đáp án xem trước, đáp án ghi, biên nhận, log. Tiêu đề, người phụ trách, phối hợp, trạng thái, hạn **được giữ**; mã, STT, tham chiếu, hai hash còn đủ; cờ `IBS_NOTE_NOT_STORED`. Chèn thẳng dòng có ghi chú (nhãn IBS HI, dự án BU IBS HI, dự án ánh xạ mới nhất `IBS_HI`, hoặc không có ngữ cảnh tenant) → trigger từ chối. Ánh xạ miền mới nhất đổi sang miền khác → dòng giữ ghi chú. Dòng LBRC / XECA giữ nguyên chữ ghi chú.
14. Số đếm: hai cách đếm đúng theo nhóm; dự án chưa ánh xạ nằm ở «Chưa xác nhận»; đáp án, biên nhận và dòng lô không có khoá tổng gộp các nhóm.
15. Người nhập là ghế BoM không tự duyệt được dòng mình nhập (`SELF_APPROVAL`). Ghế khác duyệt → việc có người thực hiện đã xác nhận ở bước nhập (giao lần đầu), hai người nghiệm thu trống; đổi người thực hiện sau đó vẫn bị `bom_guard_assignment` chặn.
16. `previewDigest` sai → `PREVIEW_STALE`. Cùng `requestKey` → biên nhận cũ; khác digest → `IDEMPOTENCY_CONFLICT`.

`tests/sheet-import-http.test.ts`:
17. `viewer`, `member`, bot → 403 ở cả hai lệnh; thành viên Team Tech nhập được vào dự án không có quyền; điều phối của dự án A nhập vào dự án B → 403, không ghi gì.
18. Phong bì có `tenantId` / `importerId` / `state` → từ chối. Thân vượt ngưỡng → 413 và không được đệm trọn.
19. Lỗi và log không chứa chữ của ô (kiểm bằng một chuỗi canary đặt trong tệp giả).

RLS và hạ tầng (sửa `tests/rls-catalog.test.ts`, `tests/migrations-rollback.test.ts`; thêm `tests/sheet-import-concurrency.test.ts`, native):
20. Không ngữ cảnh → 0 dòng. Tenant khác → 0 dòng đọc; chèn với tenant khác, hoặc vào lô của người khác → bị chặn. UPDATE và DELETE trên hai bảng → bị từ chối, không phải «thành công 0 dòng».
21. Hai lệnh ghi cùng tệp chạy song song → mỗi dòng đúng một yêu cầu.
22. Áp 027 hai lần không lỗi; rollback từ chối khi có dòng.

| Tệp | Thay đổi |
|---|---|
| `migrations/027_work_imports.sql`, `migrations/rollback/027_work_imports.sql` | Mục 7 |
| `src/server/csv.ts` (mới) | Bộ đọc CSV RFC 4180, giải mã UTF-8 chặt, giới hạn tệp; thuần hàm |
| `src/server/source-snapshot.ts` | Chỉ xuất ra `header`, `dueIssue` và hàm vân tay `cellsFingerprint`; hành vi không đổi |
| `src/server/sheet-import.ts` (mới) | `SheetImportService`: `preview`, `commit`, `receipt`; kiểm vai theo dự án; mọi ghi trong một transaction có `app.person_id` |
| `src/server/request-body.ts` | Thêm `readBoundedBytes` (cùng cách đếm, trả byte); `readBoundedText` gọi lại nó, hành vi không đổi |
| `src/server/http.ts` | Ba tuyến của mục 3 |
| `src/app/work-import/page.tsx`, `src/components/work-import.tsx` (mới) | Màn hình tải tệp → xem trước → xác nhận → kết quả; các bước của PM |
| `src/components/work-requests.tsx`, `src/app/work-requests/page.tsx` | Khối riêng `ImportNote`: dòng nhập hiện «Trạng thái theo bảng nguồn», «Hạn theo bảng nguồn», người phụ trách nguyên chữ, tham chiếu nguồn (chỉ cho người tạo và ghế BoM); liên kết «Nhập bảng việc» |
| `tests/migration-stack.ts`, `tests/post-restore.test.ts`, `tests/thread-order.test.ts`, `tests/pre-023-check.test.ts`, `tests/slice1-db.ts` | Ba bộ ca gỡ 023 nay gỡ **mọi** migration trên 023 đọc từ thư mục (không gọi tên 024), rồi đặt lại; `reset()` của native cũng dọn `work_import_batches` (lô không có khoá ngoại tới dự án) |
| `scripts/sheet-import-dry-run.ts` (mới) | Mục 10 |
| `tests/…` | Các tệp nêu trên |

Lệnh kiểm: `npm run typecheck` · `npx vitest run tests/sheet-import-csv.test.ts tests/sheet-import.test.ts tests/sheet-import-http.test.ts tests/sheet-import-concurrency.test.ts tests/rls-catalog.test.ts tests/migrations-rollback.test.ts` · bộ native (`SLICE1_TEST_DATABASE_URL`, `SLICE1_WEB_DATABASE_URL`) cho ca 21 và mọi tệp trên · `npm test` trên cây cuối.

## 10. Dry-run với tệp thật

Do phiên chính chạy, sau khi PM đã xác nhận bản nguồn và đã xuất tệp. Tệp thật và mọi đầu ra có nội dung nằm trong scratchpad, quyền 0600, **không** vào repo.

```sh
umask 077
mkdir -p <SCRATCHPAD>/gv5-c-dryrun
npx tsx scripts/sheet-import-dry-run.ts \
  --file <SCRATCHPAD>/gv5-c-dryrun/<TEP-XUAT>.csv \
  --source-url '<LIEN-KET-BANG-NGUON>' --sheet 'Đầu việc Tech' \
  --detail <SCRATCHPAD>/gv5-c-dryrun/detail.json \
  --receipt <SCRATCHPAD>/gv5-c-dryrun/receipt.json
```

- Script **không nhận chuỗi kết nối**: nó dựng `embeddedDatabase()` (PGlite trong bộ nhớ), áp mọi migration trong thư mục (tới 027), tạo tenant, ba dự án Team Tech và một người nhập **giả**. Không có đường nào tới CSDL phục vụ hay d1-ai1.
- Nó chạy xem trước → ghi → ghi lại lần hai cùng tệp, rồi kiểm lần hai tạo 0 yêu cầu.
- `detail.json` (0600, có nội dung) chỉ để phiên chính và PM đối chiếu. `receipt.json` chỉ có: `fileHash`; với **từng nhãn BU của bảng** bốn số **số dòng / hợp lệ / cần đối soát / trùng** (không có dòng cộng các nhãn); cách đếm 2 của mục 8; danh sách (số dòng, mã lý do); và số yêu cầu mới của lần ghi hai theo từng nhãn (kỳ vọng 0). Chỉ nội dung của `receipt.json` được chép vào biên nhận của lát.
- Ánh xạ người trong dry-run để trống toàn bộ (không có người thật trong CSDL thử): số «hợp lệ» là số dòng nhập được, cờ `MISSING_OWNER`/`MULTI_OWNER` đếm riêng.
- Dòng IBS HI trong `detail.json` chỉ có số dòng, STT, nhãn BU, trạng thái, hạn, kết quả, mã lý do và cờ (không tiêu đề, không người, không ghi chú); dòng khác có thêm tiêu đề, người phụ trách và phối hợp, và không dòng nào có «Ghi chú». Tiền lệ 011 đọc được 45 dòng ở mốc 11/11; mốc đối chiếu 25/11 ở mục 8. Script không gắn cứng con số nào; lệch được ghi lại, không tự giải thích. `receipt.json` thêm bảng cờ theo từng nhãn BU (không cộng chéo nhãn).

Ngoài phạm vi C: xử lý dòng «cần đối soát» trong ứng dụng; tạo `bom_sources` cho việc sinh ra từ dòng nhập; nối với 45 dòng Z2 của 011; nhập workbook .xlsx; nhập trên CSDL phục vụ (cần lời Chairman riêng, `AGENTS.md`: «Workbook/ticket cutover … require their own concrete scope»).

## 11. Điểm chờ Chairman (OQ-62 do phiên chính ghi) và cách hiểu tạm đã dựng

1. Khoá chống lặp: lời Chairman là «mã việc + tham chiếu nguồn»; đã dựng STT + mã + hash nội dung và bỏ số dòng khỏi khoá (mục 5) — chờ xác nhận đúng ý.
2. ~~Ai được nhập~~ — đã có lời Chairman 25/11: thành viên Team Tech, hoặc điều phối của mọi dự án đích (mục 4).
3. Dòng «Hoàn thành» / «Tạm dừng» vào hàng chờ BoM như mọi dòng (cách hiểu tạm đã dựng); chờ Chairman nếu muốn chỉ liệt kê.
4. Dòng IBS HI: đã dựng luật mặc định ở mục 6 (giữ tiêu đề, người phụ trách, phối hợp, trạng thái, hạn; bỏ ghi chú và chữ bằng chứng). Hai phương án để Chairman chọn: (1) như đã dựng; (2) chỉ con trỏ, hash, nhãn. Kèm: các dòng 011 đang giữ chữ ghi chú IBS HI ở Z2 — giữ, che hay xoá.
5. Ngày dd/mm đọc được hai thứ tự: để trống và gắn cờ `AMBIGUOUS_DUE` (cách hiểu tạm đã dựng).
6. Việc sinh ra từ dòng nhập muốn đổi người qua 3/3 thì cần dòng `bom_sources`: ai tạo, lúc nào, hạn hiệu lực bao lâu (OQ-60 (d)).
7. Với PM: bản nguồn là bảng nào, và cột STT có bị đánh lại khi chèn dòng không.

## 12. Điều đã dựng khác kế hoạch ban đầu, và vì sao

- Migration `027` (không phải 026): PR B giữ 025 và 026. Rollback 027 chạy dù 025/026 có hay không.
- Không thêm hàm liệt kê người: ứng viên người phụ trách chỉ lấy từ danh bạ hiện có (`approvers`: danh bạ demo hoặc `identityService().directory`), giới hạn trong phạm vi dự án của chính người nhập. `SheetImportService` nhận nguồn người (tham số thứ hai của hàm dựng) để script dry-run không chạm danh bạ thật.
- IBS HI theo mục 6; không có trigger theo mẫu tiêu đề trên `work_requests`.
- Dòng khoá có thêm `importer_id` (để người nhập đọc lại dòng của mình khi chưa có quyền dự án, và để khoá ghép chặn lô của người khác).
- Dòng khoá do người khác nhập vào dự án người nhập không xem được: xem trước không thấy, nên lúc ghi dòng bị `ON CONFLICT DO NOTHING` bỏ qua với mã `KEY_HELD_ELSEWHERE` («cần đối soát»), không ghi gì.
- `request_key` giống nhưng `previewDigest` khác → `IDEMPOTENCY_CONFLICT`; kiểm tra khoá được đọc **trước** kiểm tra `previewDigest`, vì chính các dòng lô này vừa ghi làm bản xem trước mới nói «trùng». Hai lệnh cùng khoá chạy song song: lệnh thua rollback rồi đọc biên nhận của lệnh thắng.
- Ba bộ ca kiểm cũ (`post-restore`, `thread-order`, `pre-023-check`) gỡ 024 bằng tên; nay gỡ mọi migration trên 023 đọc từ thư mục. PR B (025/026) cần cùng sửa đổi này; ai merge sau giữ bản dùng `tests/migration-stack.ts`.

## 13. Chỉnh sau rà soát (đợt sửa của phiên điều phối 25/11/2026) — thay thế các mục trên khi khác nhau

Mã việc, băm, trigger, quyền đọc, khoá nguồn, công tắc và số đếm sau đây là điều **đã dựng**.

- **Số đếm (1):** theo miền báo cáo, mỗi dự án đích chưa có miền xác nhận là **một nhóm riêng** «Chưa xác nhận · <tên dự án>» (khoá theo mã dự án); các dự án cùng một miền đã xác nhận mới gộp. Không có khoá hay con số nào cộng chéo nhóm, ở API, giao diện, `work_import_batches.counts` hay biên nhận dry-run. Dry-run chỉ đếm theo nhãn BU của bảng (dự án của nó là giả): bỏ `countsByReportingDomain` và số dòng ở dòng in ra; biên nhận thêm `reasonsByBuLabel` (chỉ số đếm). Dry-run từ chối đường dẫn `--detail`/`--receipt` nằm trong kho mã.
- **Băm không chứa ghi chú IBS HI (2, 10, 11):** với mọi dòng đọc «chỉ tiêu đề» (nhãn BU có chứa «ibs» sau khi chuẩn hoá NFKC, chữ thường, chỉ giữ chữ và số; hoặc dự án đích có BU/ánh xạ mới nhất là IBS HI; hoặc dòng chưa có dự án đích), `fingerprint` và `content_hash` tính với ô «Ghi chú» để trống. `request_hash` của yêu cầu nhập là băm của chính các trường yêu cầu đã lưu (dự án, tham chiếu nguồn, tiêu đề, mã, hạn, người thực hiện), không có chữ nào của dòng bảng. `previewDigest` giữ `fileHash` nên sửa ghi chú vẫn làm bản xem trước cũ hết hạn; phần còn lại của digest đọc mọi dòng như dòng IBS HI để không phụ thuộc ánh xạ. Cờ `IBS_NOTE_NOT_STORED` (ô ghi chú khác rỗng) và mã lý do dựa trên băm là điều duy nhất còn nói về ghi chú.
- **Trigger khoá (3):** `work_import_rows_guard` theo mẫu 022: thuộc tài khoản chạy migration (không phải `libetech_identity`), `row_security = off`, `lock_timeout = 5s`, chỉ nhận READ COMMITTED; khi `source_note <> ''`: từ chối nhãn BU IBS, rồi khoá dòng `projects` (`FOR NO KEY UPDATE`, câu riêng — cùng khoá mà lần ghi ánh xạ miền của 022 lấy), từ chối nếu không thấy dự án (không mở ngầm), rồi mới đọc BU và ánh xạ mới nhất. Một ánh xạ `IBS_HI` đang mở khiến lần nhập chờ, rồi bị từ chối. Hàm `work_import_ibs_hi` bỏ; `work_import_is_ibs_text(text)` là phép thử IBS dùng chung (SQL) cho nhãn và BU của dự án.
- **Quyền đọc (4, 12):** `row_read` = người nhập, hoặc ghế BoM của dự án (`work_request_seat`) — hẹp như yêu cầu mà dòng trỏ tới. Runtime chỉ có quyền `SELECT` theo cột, **không** có `source_note`: người đọc ghi chú sau này phải kiểm tra lúc đọc bằng `work_import_is_ibs_text(bu_label)` cùng BU và ánh xạ mới nhất của dự án, và được cấp cột bằng migration riêng.
- **Trả lời xung đột (5, 16):** hàm `work_import_key_conflicts(...)` (SECURITY DEFINER, `libetech_identity`, `search_path = pg_catalog`, PUBLIC bị thu, chỉ runtime được chạy) nhận STT, mã, hai băm của từng dòng của một nguồn và trang, và chỉ trả **một lớp xung đột theo vị trí dòng**: `DUPLICATE` (cùng STT, cùng `fingerprint`), `CONTENT_UNDER_OTHER_STT` (nội dung đã giữ ở STT khác), `SOURCE_CHANGED` (cùng STT, nội dung khác và chưa giữ ở đâu), `CODE_UNDER_OTHER_ROW`. Thứ tự kiểm đúng như vậy: STT bị đánh lại mà nội dung đã giữ đọc là «đã giữ», không phải «đã đổi». Xem trước và ghi cùng dùng hàm này nên xem trước nói «trùng» khi ghi cũng sẽ thế. Bốn lớp trên chỉ trả cho dòng khoá người gọi đọc được (`row_read`: chính họ nhập, hoặc họ giữ ghế BoM của dự án). Dòng khoá khác chỉ trả `STT_IMPORTED` khi cùng STT, như nhau dù nội dung trùng hay khác, và không được so mã hay nội dung (cổng Codex vòng 1, P0). Dòng ra «cần đối soát» với mã đó. **Điều lộ ra, được khai báo:** «STT này của nguồn này đã được nhập», cho bất kỳ ai nhập; hàm không trả người, dự án, yêu cầu hay chữ nào (ca kiểm kiểm cột trả về).
- **Khoá ở CSDL (5, 22):** `work_import_key_stt` = `(tenant_id, source_id, sheet, stt)`; `work_import_key_code` và `work_import_key_content` thêm `importer_id`. Lần ghi bằng `ON CONFLICT DO NOTHING` vì vậy chỉ đụng khoá STT của người khác (điều đã khai báo) hoặc khoá của chính mình, không dùng được để dò mã hay nội dung của người khác.
- **Lô (23):** chính sách ghi của `work_import_batches` đòi người nhập là thành viên Team Tech hoặc `work_request_filer` của ít nhất một dự án trong phạm vi: bot, người xem, kỹ sư không ghi được lô, kể cả khi chạy thẳng dưới vai runtime.
- **CSV:** dấu ngoặc kép giữa một ô không bao trong ngoặc kép là `CSV_MALFORMED` (RFC 4180).
- **Khoá nguồn (6):** `source_id` là khoá bảng; trang ghim «Đầu việc Tech» (NFC); cùng tệp qua liên kết có hay không có `gid` nhập 0 dòng mới.
- **Mã việc (7):** chỉ lấy từ **«Đầu việc»**, cho mọi dòng; không bao giờ đọc «Ghi chú». Mã nằm trong `PreviewRow`, `detail.json` và dòng khoá. Số đếm trên bản xuất 25/11 (chỉ số, theo nhãn BU): xem báo cáo của lần giao việc này; điều đáng nói là **không dòng nào có mã ở tiêu đề**, nên mọi việc được duyệt sẽ nhận mã `WR-…` do hệ thống sinh nếu ghế BoM không điền.
- **Nhập lại sau duyệt (8):** `CODE_EXISTS` không áp cho dòng đã `DUPLICATE`: tệp nguyên vẹn nhập lại sau khi ghế duyệt đọc là «trùng».
- **Công tắc (9):** `LIBETECH_WORK_IMPORT=1` (mặc định tắt), đọc cùng cách các cờ môi trường khác; ba tuyến `/api/v1/work-imports…` trả `404 NOT_FOUND` như đường dẫn không có khi tắt, trang `/work-import` trả 404, liên kết «Nhập bảng việc» chỉ hiện khi bật. **Bật là bước của người vận hành, sau khi PM xác nhận bản nguồn (EV-10)**; `AGENTS.md`: chuyển bảng/ticket sang AI OS cần phạm vi riêng.
- **Xem trước nhận ánh xạ (17):** `preview` nhận tuỳ chọn `projects` và `owners` (digest không phụ thuộc chúng). Không gửi `projects` thì dùng mặc định; gửi thì dùng đúng như gửi, kể cả mảng rỗng. Màn hình chạy lại xem trước mỗi khi đổi ánh xạ nên số đếm, cờ, quyết định IBS HI và `CODE_EXISTS` là của lần ghi.
- **Khoá thao tác (18):** lô lưu băm của `{projects, owners}`; cùng `requestKey` mà khác ánh xạ → `IDEMPOTENCY_CONFLICT`.
- **Người phụ trách (13, 20):** chỉ gắn khi tên tài khoản đúng bằng chữ của ô; giao diện chỉ gợi ý ứng viên của dự án đích của nhãn BU của chính các dòng đó, cho bỏ chọn, và không hiện ô chọn dự án cho nhãn trống hoặc dài quá 100 ký tự.
- **Thứ tự ghi (14):** dòng được ghi theo thứ tự STT để hai lần nhập chồng nhau lấy khoá cùng thứ tự (không 40P01); biên nhận giữ thứ tự dòng của tệp.
- **Rollback (15):** `SET LOCAL row_security = off` ở đầu: tài khoản bị RLS ràng buộc sẽ báo lỗi thay vì đếm 0 dòng rồi xoá lịch sử.
- **Điểm chất lượng (22):** `quality_score` = 100 trừ 20 cho mỗi cờ là **khuyết điểm của bảng nguồn** (`MISSING_OWNER`, `MULTI_OWNER`, `MISSING_DUE`, `AMBIGUOUS_DUE`, `DATE_FORMAT_CONFLICT`, `INVALID_DUE`, `MISSING_STATUS`, `UNKNOWN_STATUS`, `MULTI_CODE`), sàn 0; các cờ chính sách (`IBS_NOTE_NOT_STORED`, `OWNER_NOT_MAPPED`) không làm giảm. `source_type` = `'google_sheet'` (giá trị của migration 011; nguồn là bảng Google, tệp CSV chỉ là cách xuất), CHECK trên cả hai bảng.
- **`work_import_project_facts` (21):** người không thuộc Team Tech và không có quyền ở dự án nhận 0 dòng (có ca kiểm).

### Ghi nhận, chưa sửa (24)

- `origin='import'` ở `work_requests` không bị ràng buộc ở mức CSDL với một dòng khoá: một dòng yêu cầu có origin này vẫn có thể được ghi mà không có dòng khoá (kể cả bởi ai có quyền ghi yêu cầu). Chỉ dịch vụ bảo đảm.
- Trạng thái hay hạn sửa ở bảng nguồn **sau khi** nhập vẫn đọc là `SOURCE_CHANGED` (không đồng bộ ngược): cần nói với PM.
- Hai bảng nhập thuộc Z1; dòng Z1 của `AGENTS.md` không nêu tên chúng — quyết định của Chairman.
- Thứ tự gộp A → B → C vì rollback của 025/026 và 027 gắn nhau (mỗi rollback từ chối khi có migration sau nó đã ghi; ba bộ ca kiểm gỡ 023 dùng `tests/migration-stack.ts`).
- Cổng Codex vòng 1, P1, sửa tiến: `previewDigest` chưa gắn với ánh xạ dự án và người phụ trách, và là SHA-256 tính lại được từ đầu vào, không phải bằng chứng máy chủ đã phát hành bản xem trước. Lần ghi vẫn tính lại mọi kiểm (quyền tạo việc, IBS HI, xung đột, `CODE_EXISTS`) theo ánh xạ của chính nó, nên ánh xạ khác không vượt được kiểm nào; điều còn thiếu là bảo đảm người nhập đã thấy đúng ánh xạ đó. Sửa sau: digest gồm ánh xạ đã giải, ký bằng khoá của máy chủ.
- Cổng Codex vòng 1, P1, không sửa: rollback 027 chạy lần hai vẫn qua. PostgreSQL 16 coi `DROP TRIGGER IF EXISTS … ON <bảng không có>` là NOTICE, không phải lỗi; ca (4) của `tests/migrations-rollback.test.ts` chạy rollback hai lần.
- Khi STT bị đánh lại giữa hai lần nhập của hai người không đọc được dòng khoá của nhau, cùng nội dung có thể thành hai yêu cầu chờ duyệt (OQ-62 câu 8).
