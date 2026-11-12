# Bàn giao giao diện — «Tài liệu dự án» (lát 1)

Nguồn: `docs/DESIGN-SYSTEM-PM-DOCUMENTS.md`. Mã: `src/components/documents.tsx`, `src/components/documents-view.ts`, `src/app/documents/*`, lớp `.doc-*` cuối `src/app/globals.css`.
Lát này chỉ có danh sách, tìm, mở nguồn và đăng ký. Chưa có chi tiết, diff, quyết định (đặc tả chỉ ghi biến thể).

## 1. Bố cục
Đọc từ trên xuống: tiêu đề «<Dự án> / Tài liệu» + nút «Đăng ký tài liệu» (chỉ khi có quyền) → ô «Tìm trong dự án» → (form đăng ký, mở khi bấm) → vùng dữ liệu (skeleton / lỗi / từ chối / rỗng / danh sách) → dòng «n / tổng tài liệu».
Không có `?projectId=` và nhiều dự án: chỉ hiện danh sách liên kết chọn dự án, không có danh sách chéo dự án. Một dự án: chuyển thẳng.
Biến thể:
- **card** (<950px): một cột; khối tiêu đề → bản chuẩn/đang soạn/hash → nguồn → hành động.
- **row** (≥1200px): cùng `DocumentCard`, CSS xếp ngang theo cột cố định tỉ lệ (32% / 24% / còn lại / hành động). 950–1199px: bố cục ngang có xuống dòng.
- **detail header**: chưa làm ở lát này.

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
DocumentsBody({state:PageState; rows:DocumentIndexRow[]; projectedAt:string|null; canRegister:boolean; error:string|null; projectLabel:string; onRetry?:()=>void; onRegister?:()=>void})
Documents({projects:{id;name}[]; projectId:string|null; initial:DocumentIndexPage|null; denied:boolean; canRegister:boolean; templates:{code;title}[]})  // 'use client'
```
`onRetry`, `onRegister` là hai prop tuỳ chọn thêm so với chữ ký gốc (cần để nút hoạt động). Hàm thuần: `pageState`, `approvedLabel`, `draftLabel`, `hashLabel`, `freshnessLabel`, `SOURCE_STATE_VIEW`.
Gọi API ở client chỉ qua `src/components/api.ts`. «Mở nguồn» gọi `GET /api/documents/:id/source` rồi mở `uri` ở tab mới (`noreferrer`), server kiểm quyền lại mỗi lần.

## 4. Trạng thái
Màn (ưu tiên loading > denied > error > empty > ready):
- loading: skeleton, `aria-busy="true"`, giữ tiêu đề, không có số 0.
- denied: «Tài khoản chưa được cấp dự án này»; không tên dự án, không số đếm, không ô tìm.
- error: `role="alert"`, câu lỗi + «Thử lại», giữ chữ đang tìm.
- empty: «Chưa có tài liệu đã đăng ký» + «Đăng ký tài liệu» nếu có quyền, nếu không «Cần quyền thành viên dự án để đăng ký».
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
Chạy bản local có đăng nhập theo `scripts/setup-local-verification.ts` (đọc trước khi dùng) hoặc chế độ demo (`LIBETECH_DEMO=1`, loopback) rồi mở `/documents?projectId=<id>`.
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
- Bộ lọc Loại/Trạng thái/Chủ nội dung; phân trang; chi tiết tài liệu; «Xem việc liên quan».
- Ảnh chụp (chưa có công cụ trình duyệt).
Theo `DESIGN-SYSTEM-PM-DOCUMENTS.md:107`.
