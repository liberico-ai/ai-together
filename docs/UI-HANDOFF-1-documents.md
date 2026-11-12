# Bàn giao giao diện — «Tài liệu dự án» (lát 1)

Nguồn: `docs/DESIGN-SYSTEM-PM-DOCUMENTS.md`. Mã: `src/components/documents.tsx`, `src/components/documents-view.ts`, `src/app/documents/*`, lớp `.doc-*` cuối `src/app/globals.css`.
Lát này có danh sách, tìm, mở nguồn, đăng ký và màn chi tiết (phần «Màn chi tiết» cuối tệp). Chưa có diff, quyết định (đặc tả chỉ ghi biến thể).

## 1. Bố cục
Đọc từ trên xuống: liên kết «← Về không gian làm việc» (về `/`, cao ≥44px) → tiêu đề «<Dự án> / Tài liệu» + nút «Đăng ký tài liệu» (chỉ khi có quyền) → ô «Tìm trong dự án» → (form đăng ký, mở khi bấm) → vùng dữ liệu (skeleton / lỗi / từ chối / rỗng / danh sách) → thông báo sau đăng ký (nếu có) → dòng «n / tổng tài liệu». Mỗi trang 50 tài liệu (mặc định của API, trần 200); chưa có nút phân trang.
Không có `?projectId=` và nhiều dự án: chỉ hiện danh sách liên kết chọn dự án, không có danh sách chéo dự án. Một dự án: chuyển thẳng.
Biến thể:
- **card** (<950px): một cột; khối tiêu đề → bản chuẩn/đang soạn/hash → nguồn → hành động.
- **row** (≥1200px): cùng `DocumentCard`, CSS xếp ngang theo cột cố định tỉ lệ (32% / 24% / còn lại / hành động). 950–1199px: bố cục ngang có xuống dòng.
- **detail header**: xem «Màn chi tiết».

## 2. Token
| Token | Giá trị | Dùng cho |
|---|---|---|
| `--navy` | #122d2c | nút chính |
| `--ink` | #203330 | chữ thân |
| `--muted` | #73817a | không dùng cho nhãn phụ (độ tương phản thấp); nhãn phụ dùng #5d6b64 |
| `--line` | #e2e8e2 | viền thẻ, ô nhập |
| `--bg` | #f6f8f5 | nền skeleton |
| `--teal` | #147d6e | chỉ vòng focus; KHÔNG dùng cho «Chưa có» |
| `--amber` | #b67524 | không dùng trực tiếp; cảnh báo dùng #8d5a16 |
| `--radius` | 14px | thẻ, ô, nút |
Màu thêm: #4f5c55 trên #eef1ee (nhãn trung tính), #9b2c2c (lỗi), #8d5a16 (cảnh báo). Khoảng cách 4/8/12/16/24/32; chữ thân 14px, nhãn phụ 12px; mục chạm ≥44×44.
Lớp: `.doc-page .doc-head .doc-filters .doc-field .doc-form .doc-action .doc-picker .doc-list .doc-card .doc-main .doc-title .doc-meta .doc-ref .doc-revs .doc-tag-neutral .doc-rev .doc-hash .doc-source(-warn/-error) .doc-actions .doc-problem .doc-state(.doc-denied/.doc-error/.doc-empty) .doc-skeleton .doc-skel-row .doc-projected`.
Ngoài lớp `.doc-*`, một luật `.bridge-labels` (12px, #c9d8d2) vá nhãn trạng thái cầu nối ở sidebar.

## 3. Props thành phần
```ts
DocumentCard({row:DocumentIndexRow; projectLabel:string; canOpen:boolean})
SourceAvailability({state:SourceState; lastSuccessAt:string|null})
SourceLink({uri:string})
DocumentsBody({state:PageState; term?:string; onClearSearch?:()=>void; rows:DocumentIndexRow[]; projectedAt:string|null; canRegister:boolean; error:string|null; projectLabel:string; onRetry?:()=>void; onRegister?:()=>void})
Documents({projects:{id;name}[]; projectId:string|null; initial:DocumentIndexPage|null; denied:boolean; canRegister:boolean; templates:{code;title}[]})  // 'use client'
```
`onRetry`, `onRegister` là hai prop tuỳ chọn thêm so với chữ ký gốc (cần để nút hoạt động). Hàm thuần: `pageState`, `approvedLabel`, `draftLabel`, `hashLabel`, `freshnessLabel`, `SOURCE_STATE_VIEW`.
Gọi API ở client chỉ qua `src/components/api.ts`. «Mở nguồn» gọi `GET /api/documents/:id/source` (`{uri, host, sourceType, sourceState, title}`) rồi hiện host + liên kết https; server kiểm quyền lại mỗi lần. `Documents` được gắn `key={projectId ?? 'picker'}` để đổi dự án không giữ dòng cũ.

## 4. Trạng thái
Màn (ưu tiên loading > denied > error > no-results > empty > ready):
- loading: skeleton, `aria-busy="true"`, giữ tiêu đề, không có số 0.
- denied: «Tài khoản chưa được cấp dự án này»; không tên dự án, không số đếm, không ô tìm.
- error: `role="alert"`, câu lỗi + «Thử lại», giữ chữ đang tìm.
- no-results: chỉ khi đã áp dụng từ khoá và 0 dòng: «Không tìm thấy tài liệu khớp "<từ khoá>"» (từ khoá là văn bản) + nút «Xoá tìm kiếm» khôi phục danh sách. KHÔNG hiện «Chưa có tài liệu đã đăng ký» hay nút đăng ký.
- empty: dự án chưa có tài liệu: «Chưa có tài liệu đã đăng ký» + câu theo lần chiếu (chưa chiếu: «Chỉ mục chưa được chiếu lần nào; tài liệu đã đăng ký sẽ hiện sau lần chiếu đầu tiên.») + «Đăng ký tài liệu» nếu có quyền, nếu không «Cần quyền thành viên dự án để đăng ký».
- Sau đăng ký thành công: `role="status"` «Đã đăng ký "<tiêu đề>". Tài liệu sẽ hiện trong danh sách sau lần chiếu chỉ mục kế tiếp (lần chiếu gần nhất: <thời điểm> | chưa chiếu lần nào).»
- Mở nguồn hai bước: bấm «Mở nguồn» → gọi API → hiện «Máy chủ: <host>» và liên kết «Mở liên kết tại <host>» (`target="_blank" rel="noreferrer noopener"`), chỉ khi URI là https; khác https hoặc lỗi → hiện câu báo lỗi, không mở gì. Không dùng `window.open`. Bấm lại hoặc mở thẻ khác thì liên kết cũ bị xoá.
- Quyền đăng ký: theo vai trò trong dự án (`projectRole`), viewer/bot không thấy nút; không có projectId thì không có nút.
Nguồn: `fresh` Nguồn vừa kiểm · `stale` Nguồn chưa kiểm mới · `unavailable` Nguồn không mở được · `denied` Không đủ quyền xem nguồn · `not-configured` Chưa cấu hình kiểm nguồn · `partially-received` Mới nhận một phần. `denied` không hiện thời điểm kiểm; `denied`/`unavailable` không có nút «Mở nguồn».
Nhãn:
- «Bản chuẩn: Chưa có» — nhãn trung tính xám, không xanh; lát này luôn rỗng. Không có chữ «đã duyệt».
- «Hash tự khai — chưa kiểm» — mọi hash hiện là tự khai; «Hash đã kiểm» chỉ tồn tại trong hàm, chưa dữ liệu nào tới.
- «chưa đối soát» — nhãn của liên kết dòng nguồn Z2; chưa hiện ở danh sách (dành cho chi tiết).
- «Chưa xác nhận» — dự án chưa ánh xạ miền báo cáo; màn này không hiện miền nên không dùng, ghi để chi tiết/báo cáo dùng.
- Chiếu: «Chiếu lúc …» / «Chưa kiểm mới · chiếu lúc …» (chỉ mục cũ hơn bản ghi) / «Chưa chiếu».

## 5. Breakpoint
- 360 (<700): thẻ một cột, bộ lọc xếp dọc, nút full-width, không cuộn ngang trang.
- ≥700: bộ lọc nằm ngang, nút theo nội dung.
- ≥950: thẻ xếp ngang có xuống dòng.
- ≥1200: dạng bảng hàng với cột tỉ lệ cố định; không phần tử nào rộng cố định >328px.

## 6. Edge case
- Tiêu đề dài, URL dài, SHA 40/64 ký tự: `overflow-wrap:anywhere`, không đặt chiều rộng cố định.
- 0 dòng → empty; 200 dòng (trần API) → danh sách cuộn trang, chưa phân trang/ảo hoá; dòng «n / tổng» hiển thị.
- Chỉ mục cũ hơn Z1: nhãn «Chưa kiểm mới · chiếu lúc …».
- Nguồn mất/denied: bỏ nút mở, nêu bước tiếp theo; lịch sử trong sổ vẫn còn.
- Chủ nội dung rỗng: «Chưa có». Mã tham chiếu rỗng: «Chưa có mã».
- Dự án chưa ánh xạ miền: màn này không phân miền, không vào tổng nào.
- Bot không dùng màn này; viewer thấy danh sách nhưng không có nút đăng ký.

## Kiểm tay (người điều phối chụp ảnh vào `docs/screenshots/`)
Chạy bản local có đăng nhập theo `scripts/setup-local-verification.ts` (đọc trước khi dùng) hoặc chế độ demo (`LIBETECH_DEMO=1`, loopback) rồi mở `/documents?projectId=<id>`. Ở chế độ demo trang dùng phiên demo (cookie `libetech_demo_session`, chỉ khi host là loopback), giống trang chủ; chọn vai ở `/` trước khi mở `/documents`.
Chụp ở 360×740 và 1280×800:
- [ ] có dữ liệu
- [ ] rỗng (dự án chưa có tài liệu)
- [ ] không quyền (projectId ngoài danh sách)
- [ ] lỗi (ngắt API rồi bấm Tìm)
- [ ] đang tải (giảm tốc mạng)
- [ ] 360px không cuộn ngang; Tab đi đúng thứ tự đọc

## Việc chưa làm
- Đo contrast thực tế (nhãn phụ 12px, nhãn trung tính, cảnh báo).
- Kiểm zoom 200%.
- Kiểm screen reader (danh sách `role=list`, `role=alert`, `aria-busy`).
- Bộ lọc Loại/Trạng thái/Chủ nội dung; phân trang; diff giữa hai bản; «Xem việc liên quan».
- Ảnh chụp (chưa có công cụ trình duyệt).
Theo `DESIGN-SYSTEM-PM-DOCUMENTS.md:107`.

## Màn chi tiết `/documents/<id>`
Mã: `src/app/documents/[id]/{page,loading,error}.tsx`, `src/components/document-detail.tsx`. Dùng lại `SourceAvailability`, `SourceOpener` (mở nguồn hai bước, như thẻ danh sách), nhãn trong `documents-view.ts`.

### 1. Bố cục
Từ trên xuống: liên kết «← Về danh sách tài liệu» (về `/documents?projectId=<project_id>`, ≥44px) → tiêu đề, mã tham chiếu · loại · dự án, «Chủ nội dung» (rỗng → «Chưa có») → hai con trỏ cạnh nhau: «Bản đang soạn: r<n>|Chưa có» và «Bản chuẩn: Chưa có» (thẻ `.doc-tag-neutral`) → dòng «Nguồn chưa đóng băng (SOURCE_NOT_FROZEN) · Phân loại: Chưa phân loại» → «Thông tin còn thiếu» (mỗi trường «<tên>: Chưa có») → «Dòng nguồn liên kết» (mỗi dòng «<giá trị> · chưa đối soát») → «Nguồn» (trạng thái + «Mở nguồn») → «Các bản (mới nhất trước)» → «Sự kiện» (tên loại + thời điểm, không hiện mã người thực hiện).
Mỗi bản: «r<n>», thời điểm, tóm tắt, «Đã có:» / «Còn thiếu:», «Bản nguồn», từng tham chiếu «nhãn: giá trị», nhãn hash (`hashLabel`: tự khai → «Hash tự khai — chưa kiểm»; không có hash → «Chưa có hash»). Không có chữ «đã duyệt» hay «Hash đã kiểm».

### 2. Token
Như danh sách. Lớp thêm: `.doc-detail-head .doc-pointers .doc-pointer .doc-section .doc-revlist .doc-rev-item .doc-rev-head .doc-cols .doc-wrap .doc-refs`. SHA/URL dùng `overflow-wrap:anywhere`; không phần tử nào rộng cố định >328px.

### 3. Props
```ts
DocumentDetailView({detail:DocumentDetail; projectLabel:string; canOpen:boolean})
DocumentDeniedBlock()   // không prop
SourceOpener({documentId:string; sourceState:SourceState; canOpen:boolean})  // 'use client', dùng chung với thẻ danh sách
```
Trang server lấy phiên bằng `pagePrincipal()` (không phiên → `/login`), gọi `DocumentService.detail(principal, id)`.

### 4. Trạng thái
- loading: `loading.tsx`, skeleton, `aria-busy="true"`.
- error: `error.tsx`, `role="alert"`, «Thử lại»; dữ liệu không đổi.
- denied (`SCOPE_DENIED`, `READ_ONLY`, mã không hợp lệ, tài liệu không tồn tại): một khối chung «Không tìm thấy tài liệu trong phạm vi được cấp»; không tiêu đề, mã, tên dự án hay số đếm.
- ready: như «Bố cục». Không có bản nào → «Bản đang soạn: Chưa có», «Chưa có bản nào.»

### 5. Breakpoint
- ≤700px: hai con trỏ xếp dọc, hai cột «Đã có/Còn thiếu» xếp dọc, một cột, nút full-width, không cuộn ngang ở 360px.
- >700px: hai con trỏ cạnh nhau; hai cột cạnh nhau.

### 6. Edge case
- Hai bản với ba SHA (`source_revision` r1, `source_revision` r2 và một tham chiếu `git_sha`): cả ba hiện đủ, bản r2 trước r1.
- Bảy trường thiếu (XECA006): bảy dòng «<trường>: Chưa có».
- Dòng nguồn đã mất khỏi bảng việc (`present:false`): vẫn hiện «<giá trị> · chưa đối soát» kèm «Dòng nguồn không còn trong bảng việc — lịch sử trong sổ vẫn giữ».
- Nguồn `denied`/`unavailable`: không có nút «Mở nguồn».
- Không phiên, không quyền, id sai: `/login` hoặc khối denied như trên.
