# Bàn giao giao diện — «Quyết định» (thẻ review và thẻ chia lại việc 3/3, lát 3)

Nguồn: `docs/DESIGN-SYSTEM-PM-DOCUMENTS.md` (`:68-74`, `:90-103`), `docs/UI-HANDOFF-3-review.md` (cùng khuôn, cùng lớp `.doc-*`). Mã: `src/app/decisions/{page,loading,error}.tsx`, `src/components/decisions.tsx`, `src/components/decisions-view.ts`, lớp `.decision-*` cuối `src/app/globals.css`, một liên kết «Quyết định» trong `src/components/workspace.tsx`. Ca kiểm: `tests/decisions-ui.test.tsx`.
Vai đọc: như màn Review (`reader` của `document-review`). Giao diện không tự tính quyền và không tự tính trạng thái: nhãn đọc từ trường của thẻ do `DecisionService.list` trả; nút bỏ phiếu chỉ hiện khi `actorEligibility.canVote === true`; thẻ review không bao giờ có nút quyết định ở đây, chỉ có liên kết «Mở để review» sang `/review/<documentId>` (người duyệt thấy diff ở đó). Mọi từ chối đến từ dịch vụ.

## 1. Bố cục
**`/decisions?projectId=`**: «← Về không gian làm việc» → «Quyết định» → tên dự án → danh sách thẻ (skeleton / lỗi / rỗng / từ chối) → «n thẻ» (`role="status"`) → câu «Phiếu duyệt tài khoản và phiếu đổi quyền, gồm cả quyền duyệt bản chuẩn, nằm ở trang Duyệt tài khoản.» kèm liên kết «Mở trang Duyệt tài khoản» tới `/approvals` (có ở trạng thái có thẻ và trạng thái rỗng; không có ở loading, lỗi, từ chối).
Không có `?projectId=`: nhiều dự án thì danh sách liên kết chọn dự án; một dự án thì chuyển thẳng; dự án ngoài quyền: một khối từ chối, không tên, không số đếm.
**Thẻ review**: «<mã> · <tiêu đề>» → «Tài liệu · bản r<N>» → tóm tắt → hai dòng riêng: quyết định («Chưa có quyết định» / «Đã chấp thuận» / «Yêu cầu sửa») và bản chuẩn («Chưa áp dụng làm bản chuẩn» / «Đã áp dụng làm bản chuẩn») → người đã quyết (tên · lựa chọn · giờ) → câu lý do của `eligibilityCopy` (nếu có) → «Mở để review».
**Thẻ 3/3**: «<mã việc> · <tiêu đề>» → «Phiếu chia lại việc 3/3 · dựa trên phiên bản việc N · hết hạn <giờ>» → lý do → hai dòng riêng: «đủ phiếu» (`reassignmentLabel(state, have)`) và «đã áp dụng» («Chưa áp dụng» hoặc «Đã áp dụng · biên nhận lúc <giờ> · phiên bản việc N») → các phiếu đã bỏ (tên · lựa chọn · giờ) → câu lý do không bỏ phiếu (`voteBlockCopy`) → lỗi tại chỗ → khối «Bỏ phiếu» (ô «Ghi chú (5–2000 ký tự, bắt buộc)», «Đồng ý», «Từ chối», «Yêu cầu sửa») chỉ khi `canVote`.

## 2. Token
Dùng nguyên token của lát 1–3: `--navy` nút chính, `--ink` chữ, `--line` viền, `--white`, `--teal` chỉ vòng focus, `--radius`; #5d6b64 nhãn phụ 12px, #4f5c55 trên #eef1ee dòng trạng thái, #9b2c2c lỗi. Không thêm màu.
Lớp thêm (tất cả `decision-*`, không sửa quy tắc cũ, kể cả `review-*`): `decision-list decision-card decision-form decision-title decision-meta decision-text decision-line decision-notice decision-problem decision-votes decision-vote decision-accounts decision-actions decision-textarea decision-action decision-secondary`. Nút dùng `doc-action decision-action` (≥44×44); nút phụ thêm `decision-secondary`. Dưới 700px nút rộng hết hàng; chuỗi dài `overflow-wrap:anywhere`; không chiều rộng cố định quá 328px.
Tín hiệu không chỉ bằng màu: «đủ phiếu» và «đã áp dụng» là hai dòng chữ riêng; lựa chọn của từng người là chữ; lý do không bỏ phiếu là chữ.

## 3. Props thành phần
```ts
// decisions-view.ts (hàm thuần): reassignmentLabel, reviewLabels, voteBlockCopy, voteBody, voteCommand, describeVoteError, voteFailure, voteRecorded, choiceLabel, decisionsPageState (= reviewPageState)
DecisionsBody({state:'loading'|'error'|'denied'|'empty'|'ready'; cards:DecisionCard[]; error:string|null; people:{id;name}[]; truncated?:boolean; onRetry?:()=>void; renderCard?:(c)=>ReactNode})   // renderCard tuỳ chọn: màn có trạng thái dùng nó để gắn thẻ có ô ghi chú
DecisionCardView({card; people; busy; error; onVote?:(choice)=>void; note?; onNote?; reloadable?; onReload?})   // không hook; nút theo canVote
Decisions({projects; projectId; initial:{cards}|null; denied; people:{id;name}[]})   // 'use client'; giữ ghi chú và trạng thái gửi của từng thẻ 3/3
// trang máy chủ KHÔNG truyền hàm xuống thành phần client (tests/rsc-boundary.test.ts); loading.tsx và error.tsx chỉ truyền `onRetry={reset}` từ tệp client.
```
Dữ liệu: trang gọi `DecisionService.list(principal, {projectId})` và `WorkService.workspace(principal).people`; chỉ chuyển xuống `id` và `name` của thành viên dự án (không vai bot). Đọc lại: `GET /api/decisions?projectId=`.
Phiếu qua `POST /api/team/bom` (như `bom-workspace.tsx`), thân đúng bốn trường, không người thực hiện, tenant hay ghế:
`{ "action": "vote", "proposalId": "<decisionId của thẻ>", "choice": "agree" | "reject" | "revise", "note": "<ghi chú đã cắt khoảng trắng, 5–2000 ký tự>" }`
Mỗi thao tác có `Idempotency-Key`: giữ nguyên khi thử lại cùng nội dung, đổi sau khi thành công. Điểm này chặt hơn `bom-workspace.tsx` (mỗi lần gọi một mã mới): một mã cho mỗi thao tác của người dùng, dùng lại khi thử lại cùng thao tác (quyết định của lát 3, thay cho câu «như `bom-workspace.tsx`» ở điểm này).

## 4. Trạng thái
Màn (ưu tiên loading > denied > error > empty > ready):
- loading: skeleton, `aria-busy="true"`, không có số 0 giả.
- denied: «Anh/chị chưa có quyền xem các quyết định của dự án này.»; không tên dự án, không số đếm, không thẻ.
- error: `role="alert"`, «Không tải được danh sách quyết định. Dữ liệu đã lưu không bị thay đổi.» + «Thử lại».
- empty: «Dự án này chưa có thẻ quyết định nào.» (khác hẳn câu từ chối; thẻ review có cả cho bản mới nhất đã có quyết định nên danh sách không chỉ gồm việc đang chờ).
- ready: thẻ + «n thẻ».
Nhãn «đủ phiếu» của thẻ 3/3:
| `state` | Dòng thứ nhất |
|---|---|
| `pending` | Chưa đủ phiếu (n/3) |
| `quorum_met` | Đủ phiếu, chưa áp dụng |
| `applied` | Đã áp dụng |
| `rejected` | Từ chối |
| `revise` | Yêu cầu sửa |
| `cancelled` | Đã hủy |
| `expired` | Hết hạn |
| `reconcile` | Cần đối soát |
Dòng thứ hai của thẻ 3/3 chỉ theo `appliedReceipt`: có biên nhận thì «Đã áp dụng · biên nhận …», không thì «Chưa áp dụng». Không có biên nhận thì không chữ «Đã áp dụng» nào trên thẻ: nếu thẻ mang `state:'applied'` mà `appliedReceipt` rỗng (dịch vụ không tạo ra tổ hợp này), dòng thứ nhất đọc «Cần đối soát».
Thẻ review: dòng quyết định theo `state`; dòng bản chuẩn chỉ theo `appliedReceipt` (một bản «Yêu cầu sửa» hoặc một bản «Đã chấp thuận» mà con trỏ chuẩn đã chuyển đi đều đọc «Chưa áp dụng làm bản chuẩn»).
Lý do không bỏ phiếu (thẻ 3/3, `voteBlockCopy`): `ALREADY_VOTED` «Anh/chị đã bỏ phiếu cho phiếu này.» · `CLOSED` «Vòng xác nhận đã kết thúc.» · `EXPIRED` «Phiếu đã hết hạn.» · `null` không câu.
Lý do trên thẻ review (`eligibilityCopy`, nguyên văn của Review): `AUTHOR` «Anh/chị là tác giả của bản này nên không tự duyệt.» · `NO_DELEGATION` «Anh/chị chưa được chỉ định review tài liệu của dự án này.» · `REVIEW_ONLY` «Anh/chị được chỉ định nhận xét, chưa được chỉ định duyệt bản chuẩn.» · `TYPE_NOT_COVERED` «Uỷ quyền của anh/chị không gồm loại tài liệu này.» · `NOT_FROZEN` «Nguồn chưa đóng băng nên chưa duyệt thành bản chuẩn được. Anh/chị vẫn có thể nhận xét hoặc yêu cầu sửa.» · `ALREADY_DECIDED` «Bản này đã có quyết định. Muốn quyết lại cần một bản mới.»
**Conflict**: `PROPOSAL_CLOSED`, `VERSION_CONFLICT`, `REVISION_CONFLICT`, `REVIEW_ALREADY_DECIDED` đều hiện «Bản này đã thay đổi. Mở bản mới để xem lại.» (`role="alert"`) kèm nút «Tải lại» (đọc lại danh sách, các thẻ không bị gỡ nên ghi chú đang gõ còn). Mã khác: câu của máy chủ (kèm mã) dạng chữ; mất mạng: «Không kết nối được máy chủ. Nội dung đang nhập vẫn được giữ.»; không bao giờ một đối tượng thô.
Kiểm tại chỗ (không gửi đi): «Ghi chú cần từ 5 đến 2000 ký tự.» · «Chọn Đồng ý, Từ chối hoặc Yêu cầu sửa.»
Thành công: danh sách được đọc lại, thẻ chuyển trạng thái theo dịch vụ; ghi chú xoá chỉ khi phiếu đã được ghi. Đọc lại hỏng sau phiếu: một câu «Không tải được danh sách quyết định…» (`role="alert"`) phía trên, thẻ cũ giữ nguyên.

## 5. Breakpoint
- 360 (<700): một cột; thẻ đệm 12px; nút full-width (bỏ phiếu, «Mở để review», «Tải lại»); không cuộn ngang; mọi khối chữ `min-width:0; overflow-wrap:anywhere`.
- ≥700: ba nút bỏ phiếu (`.decision-actions`) nằm một hàng, rộng theo chữ, xuống dòng khi hết chỗ.
- ≥950 và ≥1200: như 700 (danh sách thẻ vẫn một cột để vùng bỏ phiếu không bị ép hẹp).
- Ranh giới đúng 700px: khối `max-width` dùng 699.98px nên chỉ một trong hai khối có hiệu lực (tests/decisions-ui.test.tsx).
Không phần tử nào rộng cố định >328px; nút và liên kết hành động ≥44×44.

## 6. Edge case
- 2/3: «Chưa đủ phiếu (2/3)» và «Chưa áp dụng»; không chữ «Đã áp dụng».
- Đủ phiếu chưa áp dụng: «Đủ phiếu, chưa áp dụng» và «Chưa áp dụng» (ba sự kiện «đủ phiếu», «đã áp dụng», «biên nhận» là ba dữ kiện riêng).
- Cần đối soát: «Cần đối soát», không nút; biên nhận không có thì «Chưa áp dụng».
- Hết hạn: «Hết hạn» (nhãn trạng thái) và «Phiếu đã hết hạn.» (lý do) khi người xem là ghế đã chốt.
- Người xem đã bỏ phiếu: «Anh/chị đã bỏ phiếu cho phiếu này.», không nút; phiếu của mình nằm trong danh sách phiếu.
- Người xem là tác giả của bản review: câu `AUTHOR`, không nút (thẻ review không có nút quyết định ở màn này).
- Không giữ ghế: không có thẻ 3/3 nào và không có số đếm (dịch vụ nuốt `SCOPE_DENIED`); chỉ còn thẻ review nếu đọc được.
- Người xem không thuộc các ghế đã chốt của phiếu: `{canVote:false, reason:null}` (đang giữ ghế nhưng không nằm trong các ghế đóng băng trên phiếu): không nút và không câu nào.
- Thẻ đổi khi đang mở: bấm bỏ phiếu thì dịch vụ trả mã xung đột, hiện câu Conflict + «Tải lại»; ghi chú đang gõ còn.
- Hai giới hạn của danh sách: thẻ review có cho bản mới nhất của mỗi tài liệu, kể cả đã có quyết định, cắt ở 200 tài liệu; thẻ 3/3 là 30 phiếu mới nhất của dự án, kể cả phiếu đã đóng. Dự án vượt giới hạn thì phần cũ hơn không hiện.
- Thẻ review có `quorum.have` chỉ đếm chấp thuận: «Yêu cầu sửa» cho `have:0`, `state:'changes_requested'` và một dòng trong danh sách phiếu; dòng bản chuẩn không đổi.
- Danh sách thẻ review bị cắt (tổng tài liệu lớn hơn 200): dịch vụ trả `reviewCardsTruncated: true`; màn hiện đúng một câu «Danh sách dài hơn phần đang hiện.».
- Sau một phiếu: ghi nhận thì xoá ghi chú và đọc lại; thất bại thì giữ ghi chú; phiếu đã đóng hoặc đổi phiên bản thì câu Conflict kèm «Tải lại» (`voteFailure`, `voteRecorded` trong `decisions-view.ts`; thành phần chỉ gọi chúng).
- Tên, tiêu đề, tóm tắt do người viết: `dir="auto"`.
- Người không có trong danh sách thành viên dự án: «Thành viên chưa rõ tên», không bao giờ id thô.
- Tên, tiêu đề, tóm tắt có ký tự HTML: chỉ là chữ React; không `dangerouslySetInnerHTML`; liên kết chỉ tới `/review/<documentId>` và `/approvals`.
- Phiếu duyệt tài khoản và phiếu đổi quyền: không phải thẻ ở đây, không nút; chỉ câu cố định kèm liên kết `/approvals`.

## Kiểm tay
**Chưa chạy bởi người viết (không có trình duyệt, không `npm run build`, không máy chủ phát triển). Danh sách này dành cho lượt kiểm tay của phiên lát 3 ở 360×740 và 1280×800.**
- [ ] `npm run build` liệt kê `/decisions` và `/api/decisions`.
- [ ] `/decisions` không có `projectId`: một dự án chuyển thẳng; nhiều dự án hiện danh sách chọn.
- [ ] `/decisions?projectId=<dự án ngoài quyền>`: chỉ khối từ chối, không tên, không số, không câu `/approvals`.
- [ ] 360×740: không cuộn ngang; nút ≥44×44 và rộng hết hàng; chuỗi dài không dấu cách (tiêu đề, tóm tắt, tên) xuống dòng.
- [ ] 1280×800: nút bỏ phiếu nằm một hàng, bố cục không rộng quá khung.
- [ ] Mỗi thẻ có hai dòng «đủ phiếu» và «đã áp dụng» (hoặc quyết định và bản chuẩn) tách riêng, đọc được khi tắt màu.
- [ ] Thẻ 3/3 của ghế đã chốt: có ô ghi chú và ba nút; ghi chú ngắn hơn 5 ký tự thì báo tại chỗ, chưa gửi.
- [ ] Bỏ phiếu thành công: thẻ chuyển trạng thái; sau 3/3 thẻ đọc «Đã áp dụng · biên nhận …» chỉ khi có biên nhận.
- [ ] Hai tab: tab A bỏ phiếu đủ 3/3 hoặc huỷ phiếu, tab B bấm bỏ phiếu ⇒ câu Conflict + «Tải lại», ghi chú còn.
- [ ] Thẻ review: chỉ có «Mở để review», dẫn tới `/review/<documentId>`; không nút «Chấp thuận».
- [ ] Chuỗi `<script>alert(1)</script>` trong tiêu đề hiện nguyên chữ.
- [ ] Bàn phím: Tab qua ô và nút, vòng focus rõ.
- [ ] Trình đọc màn hình: `role="alert"` đọc lỗi; `role="status"` đọc «n thẻ».
- [ ] Liên kết «Quyết định» ở thanh bên cạnh «Review».

## Việc chưa làm
- Chưa kiểm bằng trình duyệt (mục 6).
- Thẻ review không có nút quyết định: quyết định ghi ở màn Review. Thẻ công bố (publication) và thẻ duyệt tài khoản chưa có ở màn này.
