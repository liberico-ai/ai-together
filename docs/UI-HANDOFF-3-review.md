# Bàn giao giao diện — «Review» và «Người nhận xét của dự án» (lát 3)

Nguồn: `docs/DESIGN-SYSTEM-PM-DOCUMENTS.md` (`:23`, `:62-66`, `:90-103`), `docs/UI-HANDOFF-2-inbox.md` (cùng khuôn, cùng lớp `.doc-*`). Mã: `src/app/review/{page,loading,error}.tsx`, `src/app/review/[documentId]/{page,loading,error}.tsx`, `src/components/review.tsx`, `src/components/review-view.ts`, lớp `.review-*` cuối `src/app/globals.css`, một liên kết «Review» trong `src/components/workspace.tsx`. Ca kiểm: `tests/review-ui.test.tsx`, `tests/review-page.test.ts`.
Vai đọc: `manager`, `engineer`, `technical`, `business`. Giao diện không tự tính quyền: nút quyết định theo `item.eligibility` do dịch vụ trả; khối chỉ định theo `canDesignate` do dịch vụ trả. Mọi từ chối đến từ dịch vụ, qua một thân 404 duy nhất (mã `SCOPE_DENIED`, «Không tìm thấy tài liệu trong phạm vi được cấp.»).

## 1. Bố cục
**Hàng review `/review?projectId=`**: «← Về không gian làm việc» → «Review tài liệu» → tên dự án → danh sách thẻ (skeleton / lỗi / rỗng / từ chối), «a–b / tổng tài liệu» và liên kết «Trang trước» / «Trang sau» (chỉ khi có trang trước / sau) → khối «Người nhận xét của dự án».
Không có `?projectId=`: nhiều dự án thì chỉ danh sách liên kết chọn dự án (chỉ dự án có vai đọc); một dự án thì chuyển thẳng; dự án ngoài quyền: một khối từ chối, không tên, không số đếm, không phần nào khác.
Thẻ tài liệu: «<mã> · <tiêu đề>» → «<loại> · bản r<N> · hash <tự khai — chưa kiểm | đã kiểm>» → hai nhãn chữ: trạng thái quyết định («Chưa có quyết định» / «Đã chấp thuận» / «Yêu cầu sửa») và «Chờ xác định người duyệt» / «Đã có người duyệt» → nếu bản đã có quyết định: «Bản này đã có quyết định. Muốn quyết lại cần một bản mới.» (kể cả khi quyết định là «Yêu cầu sửa»: ô quyết định duy nhất của bản đã dùng) → «Mở để review».
**Khối «Người nhận xét của dự án»** (dưới danh sách): vùng `role="status"` (luôn có mặt) → lỗi tại chỗ (`role="alert"`, có «Tải lại» khi mã là `SCOPE_DENIED` hoặc `DELEGATION_CONFLICT`) → người nhận xét còn hiệu lực (tên + nhãn loại; chỉ điều phối thấy thêm chỉ báo, nút «Thu hồi») → nhóm «Đã thu hồi» (nếu có) → câu «Muốn đổi loại tài liệu của một người: thu hồi rồi chỉ định lại.» (chỉ điều phối) → «Người giữ quyền duyệt bản chuẩn» (chỉ đọc, từ `approvers`; rỗng: «Chờ xác định người duyệt») → câu «Quyền duyệt bản chuẩn không chỉ định ở đây: quyền này cấp qua phiếu đổi quyền, cần một thành viên BoM đồng ý, ở trang Quản trị tài khoản.» → biểu mẫu «Chỉ định người nhận xét» (chỉ điều phối), hoặc câu «Chỉ điều phối của dự án này chỉ định và thu hồi được người nhận xét.» và không điều khiển nào.
**Chi tiết `/review/<documentId>`**: «← Về danh sách review» → «<mã> · <tiêu đề>» + dòng loại/bản/quyết định/người duyệt → vùng `role="status"` → lỗi chung → **RevisionDiff** (banner Conflict nếu có → «Bản r<N> so với bản nền r<M>» hoặc «Chưa có bản nền» → đóng băng + hash kèm «tự khai — chưa kiểm» hoặc «đã kiểm» → nút «Chỉ phần đổi» / «Xem đầy đủ» → từng thay đổi với nhãn chữ Thêm/Xóa/Sửa, hai ô «Trước»/«Sau» → (chế độ đầy đủ) nội dung đầy đủ của bản → «Tài liệu phụ thuộc cần xem lại» → «Nhận xét» gắn bản và mục, mỗi nhận xét gốc chưa đóng có ô «Ghi chú trả lời» và, theo cờ `canAddress` / `canResolve` do dịch vụ trả, nút «Đã sửa» và «Xác nhận đã xử lý»; không cờ nào đúng thì không có ô và không có nút) → quyết định đã ghi (nếu có) → «Nhận xét mới» (ô «Mục nhận xét», ô nội dung, «Gửi nhận xét») → «Quyết định» (câu lý do, ô «Ghi chú phạm vi», ô «Ngoại lệ», «Chấp thuận», «Yêu cầu sửa»).
Phiếu đang soạn không tự chuyển sang bản khác: trang chỉ đọc lại khi người dùng bấm «Đọc bản mới» hoặc «Tải lại»; ghi chú và ngoại lệ đang gõ được giữ qua việc đọc lại.

## 2. Token
Dùng nguyên token của lát 1 và 2: `--navy` nút chính, `--ink` chữ, `--line` viền, `--white`, `--bg`, `--teal` chỉ vòng focus, `--radius`; #5d6b64 nhãn phụ 12px, #4f5c55 trên #eef1ee nhãn trung tính, #9b2c2c lỗi, #8d5a16 chỉ báo cảnh báo. Không thêm màu.
Lớp thêm (tất cả `review-*`, không sửa quy tắc cũ): `review-list review-card review-panel review-section review-form review-title review-meta review-text review-notice review-problem review-badges review-badge review-flag review-plain review-person review-person-name review-comment review-comment-body review-reply review-change review-action review-secondary review-modes review-inline review-textarea review-fieldset review-check review-diff review-side review-full review-flagged review-head`. Nút dùng `doc-action review-action` (≥44×44); nút phụ thêm `review-secondary`.
Tín hiệu không chỉ bằng màu: Thêm/Xóa/Sửa là chữ; «người chỉ định không còn là điều phối» và «đang ngủ» là chữ; trạng thái quyết định và người duyệt là chữ; hash «tự khai — chưa kiểm» / «đã kiểm» là chữ.

## 3. Props thành phần
```ts
// review-view.ts (hàm thuần): reviewPageState, eligibilityCopy, diffLabel, approverCopy, commandErrorCopy, describeError, decisionStateLabel, hashLabel, fieldLabel, docTypeLabel,
//   idempotencyKey, postReview, decisionBody/commentBody/replyBody/grantBody/revokeBody, decisionCommand/commentCommand/replyCommand/grantCommand/revokeCommand, selectableMembers,
//   parseQueueOffset, queueWindow, queueHref (phân trang), commandFailure/commandSuccess (sau lệnh trên tài liệu), panelFailure/panelSuccess/panelReloadFailure (sau lệnh của khối người nhận xét)
ReviewQueueBody({state:'loading'|'error'|'denied'|'empty'|'ready'; items:ReviewItem[]; total:number; error:string|null; projectLabel:string; onRetry?:()=>void; projectId?:string; offset?:number})   // projectId + offset chỉ để dựng hai liên kết trang
RevisionDiff({base:ReviewRevision|null; candidate:ReviewRevision; diff:DiffEntry[]; affectedLinks:DependencyView[]; comments:CommentView[]; sourceChanged:boolean; changedOnly:boolean;
  onReload?; onMode?:(changedOnly:boolean)=>void; documentId?:string; people?:{id;name}[]; onReply?:(cmd:{kind:'addressed'|'resolved';parentId;body})=>Promise<boolean|void>})   // ba thuộc tính cuối là tuỳ chọn
DecisionFormView({item; draft:{scopeNote;exceptions}; busy; error; onDraft; onSubmit:(c:{result;scopeNote;exceptions:string[]})=>void; onInvalid:(m)=>void})   // không hook; nút theo item.eligibility
ReviewDecisionForm({item; busy; error; onSubmit})   // giữ draft; draft sống qua mọi lỗi
CommentFormView({item; draft:{body;anchor}; busy; error; onDraft; onSubmit; onInvalid})   // chỉ hiện khi eligibility.canComment
ReviewersPanelView({reviewers:ListedDelegation[]; approvers:ApproverView[]; people:{id;name;role}[]; viewerId; canDesignate; busy; error; notice; reloadable; localError; draft:PanelDraft; onDraft; onGrant; onRevoke; onInvalid; onReload?})   // không hook
ReviewersPanel({reviewers; approvers; people; viewerId; canDesignate; busy; error; notice?; reloadable?; onReload?; onGrant?; onRevoke?})   // giữ draft; chỉ xoá draft khi lệnh trả khác `false`
ReviewQueue({projects; projectId; initial; denied; delegations:{reviewers:ListedDelegation[];reviewersTruncated?:boolean;approvers;canDesignate}|null; people:{id;name;role}[]; viewerId; offset?:number})   // 'use client'
ReviewDetailScreen({detail:ReviewDetail; affectedLinks:DependencyView[]; people:{id;name}[]})   // 'use client'
ReviewDetailDenied() · ReviewDetailNoRevision() · ReviewDetailNotice({state:'loading'|'error'; onRetry?})
// các trang máy chủ KHÔNG truyền hàm xuống thành phần client (tests/rsc-boundary.test.ts); loading.tsx và error.tsx chỉ truyền `onRetry={reset}` từ tệp client.
```
Dữ liệu: trang đọc `offset` từ query (số nguyên không âm, bội của 50; sai thì 0) và gọi `ReviewService.queue({projectId, limit:50, offset})`, `DelegationService.list`, `ReviewService.detail`, `DependencyService.list({needsReview:true})` (chỉ `SCOPE_DENIED` thành «không có liên kết»; lỗi khác lên `error.tsx`), `WorkService.workspace(principal).people`; trang chỉ chuyển xuống `id`, `name`, vai ở dự án này (`projectRole`) của thành viên dự án. Trang không gọi dịch vụ danh tính nào khác.
Lệnh qua `POST` (mỗi lần có `Idempotency-Key`; một mã mới cho mỗi thao tác của người dùng, giữ nguyên khi thử lại cùng nội dung, đổi sau khi thành công; thân lệnh không bao giờ mang người thực hiện, tenant, quyền, mã uỷ quyền hay `requestId`):
- `POST /api/reviews/<documentId>/comments`: `{kind:'comment',revisionId,anchor,body}`; trả lời nhận xét `{kind:'addressed'|'resolved',parentId,body}`.
- `POST /api/reviews/<documentId>/decisions`: `{revisionId,sourceHash,expectedVersion,result,scopeNote,exceptions}` (ba trường đầu lấy từ bản đang hiển thị: `item.revision.id`, `item.revision.sourceHash`, `item.recordVersion`).
- `POST /api/reviews/delegations`: `{projectId,delegateId,docTypes,basis}`.
- `POST /api/reviews/delegations/<delegationId>/revoke`: `{expectedVersion,basis}`.
Đọc lại: `GET /api/reviews/<documentId>`, `GET /api/reviews?projectId=`, `GET /api/reviews/delegations?projectId=`.
Danh sách người nhận xét đã được lọc theo người xem (OQ-41 (c)): với dòng của người khác, người không phải điều phối chỉ nhận `id`, `delegateId`, `docTypes` — mọi trường khác là `null`. Giao diện vẽ đúng thứ nhận được: không suy ra, không điền, không tải thêm, không bao giờ in chữ «null». Căn cứ chỉ in khi là chuỗi không `null`, trong `<bdi dir="auto">`, và với người không phải điều phối chỉ in ở dòng của chính họ (`delegateId` trùng `viewerId`, so không phân biệt hoa thường), kể cả khi thành phần lỡ được đưa căn cứ của người khác.

## 4. Trạng thái
Màn hàng review (ưu tiên loading > denied > error > empty > ready):
- loading: skeleton, `aria-busy="true"`, không có số 0 giả.
- denied: «Anh/chị chưa có quyền xem phần review của dự án này.»; không tên dự án, không số đếm.
- error: `role="alert"`, «Không tải được danh sách review. Dữ liệu đã lưu không bị thay đổi.» + «Thử lại».
- empty: «Dự án này chưa có tài liệu nào có bản để review.» (khác hẳn câu từ chối; hàng liệt kê bản mới nhất của mỗi tài liệu, kể cả đã có quyết định).
- ready: thẻ + «a–b / tổng tài liệu» trong `role="status"` (50 thẻ một trang; `/review?projectId=…&offset=…`). «Trang trước» chỉ khi `offset > 0`, «Trang sau» chỉ khi còn tài liệu phía sau; cả hai là liên kết thường ≥44px dựng từ id của máy chủ, tải lại giữ nguyên `offset`. Liên kết quá trang cuối đưa về trang đầu.
- Danh sách bị cắt (người nhận xét quá 200 dòng đang hiệu lực hoặc quá 1000 dòng đọc; nhận xét quá 1000): dịch vụ trả `reviewersTruncated` / `commentsTruncated`; màn hiện đúng một câu «Danh sách dài hơn phần đang hiện.» khi cờ đúng.
Hành động theo `item.eligibility` (dịch vụ trả; giao diện không tính quyền):
| `reason` | Câu hiện | Nút |
|---|---|---|
| `null` | không có câu | «Gửi nhận xét», «Yêu cầu sửa», «Chấp thuận» |
| `AUTHOR` | Anh/chị là tác giả của bản này nên không tự duyệt. | không |
| `NO_DELEGATION` | Anh/chị chưa được chỉ định review tài liệu của dự án này. | không |
| `TYPE_NOT_COVERED` | Uỷ quyền của anh/chị không gồm loại tài liệu này. | không |
| `REVIEW_ONLY` | Anh/chị được chỉ định nhận xét, chưa được chỉ định duyệt bản chuẩn. | «Gửi nhận xét», «Yêu cầu sửa» |
| `NOT_FROZEN` | Nguồn chưa đóng băng nên chưa duyệt thành bản chuẩn được. Anh/chị vẫn có thể nhận xét hoặc yêu cầu sửa. | «Gửi nhận xét», «Yêu cầu sửa» |
| `ALREADY_DECIDED` | Bản này đã có quyết định. Muốn quyết lại cần một bản mới. | không |
Nút thực sự hiện theo ba cờ `canComment`, `canRequestChanges`, `canApprove`, không theo `reason`. Một chỉ định (nhận xét) không bao giờ hiện như quyền duyệt.
Bản đã có quyết định: không ô nhận xét mới, không nút quyết định; thẻ «Quyết định đã ghi» (nhãn, người quyết, giờ, ghi chú phạm vi, ngoại lệ); các nhận xét cũ vẫn hiện; «Đã sửa» và «Xác nhận đã xử lý» hiện theo `canAddress` / `canResolve` của từng nhận xét gốc (dịch vụ áp đúng luật của `comment()` cho người xem, và cả hai là `false` khi chuỗi đã có «Đã xử lý»). Nếu lệnh vẫn bị từ chối (`APPROVER_NOT_AUTHORIZED`), giao diện hiện câu của dịch vụ ngay dưới nhận xét.
**Conflict** (`REVISION_CONFLICT` 409): banner `role="alert"` «Nguồn đã đổi trong lúc anh/chị đang xem. Phiếu chưa được ghi.» + «Đọc bản mới»; nội dung đang nhập được giữ. `REVIEW_ALREADY_DECIDED`: «Bản này đã có quyết định. Muốn quyết lại cần một bản mới.» tại ô quyết định / nhận xét.
Kiểm tại chỗ (không gửi đi): «Ghi chú phạm vi cần ít nhất 5 ký tự.» · «Ghi chú phạm vi tối đa 1000 ký tự.» · «Tối đa 10 ngoại lệ.» · «Mỗi ngoại lệ tối đa 300 ký tự.» · «Nhập nội dung nhận xét.» · «Nhập ghi chú trước khi gửi.» · «Chọn một thành viên.» · «Chọn ít nhất một loại tài liệu.» · «Căn cứ cần từ 5 đến 500 ký tự.» · «Căn cứ không được chứa ký tự điều khiển.»
Lỗi lệnh: câu 404 «Không tìm thấy tài liệu trong phạm vi được cấp.» kèm «Tải lại» (vai trong phiên đã cũ); `DELEGATION_CONFLICT` «Uỷ quyền này đã thay đổi. Tải lại để xem trạng thái mới.» kèm «Tải lại»; `DELEGATION_EXISTS` «Người này đã là người nhận xét của dự án.»; `MANAGER_REQUIRED` «Chỉ điều phối của dự án này chỉ định và thu hồi được người nhận xét.»; `DELEGATION_INVALID` và mã lạ: câu của máy chủ (kèm mã) dạng chữ, không bao giờ một đối tượng thô; mất mạng: «Không kết nối được máy chủ. Nội dung đang nhập vẫn được giữ.» Ghi chú, căn cứ, nội dung nhận xét đang gõ được giữ qua mọi lỗi.
Thành công (`role="status"`): «Đã ghi nhận xét.» · «Đã ghi quyết định.» · «Đã ghi trả lời.» · «Đã chỉ định người nhận xét.» · «Đã thu hồi. Người này không còn nhận xét được từ lệnh kế tiếp; nhận xét và quyết định đã ghi vẫn giữ nguyên.» (thu hồi: dòng chuyển xuống nhóm «Đã thu hồi» kèm người thu hồi và căn cứ — chỉ khi dịch vụ trả các trường đó).
Chỉ báo cho điều phối (OQ-39 (c), OQ-40 (c)): chỉ khi `canDesignate` và đúng giá trị boolean: `designatorIsCoordinator === false` → «người chỉ định không còn là điều phối»; `dormant === true` → «đang ngủ». `null` không hiện gì. Dòng đang ngủ mà chưa thu hồi vẫn có «Thu hồi». Người được chỉ định có thấy chỉ báo thứ nhất ở dòng của mình hay không (OQ-43) và ai thấy danh sách người duyệt (OQ-44) là câu hỏi mở: giao diện vẽ đúng thứ dịch vụ trả.
Thu hồi (OQ-34 a): chỉ khi `canDesignate`, trên dòng chưa thu hồi và có `version` là số: «Thu hồi» mở tại chỗ ô «Căn cứ thu hồi» (5–500 ký tự) + «Xác nhận thu hồi» + «Hủy»; gửi `expectedVersion` của dòng.
Ô chọn thành viên: không có chính người đang xem, không có người vai «Chỉ đọc».

## 5. Breakpoint
- 360 (<700): một cột; nút full-width; `.review-diff` một cột; không cuộn ngang; mọi khối chữ `min-width:0; overflow-wrap:anywhere`.
- ≥700: nhóm nút («Chỉ phần đổi/Xem đầy đủ», hàng trả lời nhận xét, xác nhận thu hồi) xếp ngang, rộng theo chữ.
- ≥950: `.review-diff` hai cột «Trước» / «Sau» (duy nhất nơi có hai cột).
- ≥1200: như 950.
Không phần tử nào rộng cố định >328px; nút và liên kết hành động ≥44×44; hộp chọn loại tài liệu cao ≥44px.

## 6. Edge case
- Bản không hash: «Chưa có hash» (không nhãn kiểm). Hash tự khai luôn kèm «tự khai — chưa kiểm»; chữ «đã kiểm» chỉ khi `hashVerification === 'verified'`.
- Chưa có bản chuẩn / chưa có bản nền: «Chưa có bản nền»; mọi mục là «Thêm».
- Chưa có người duyệt: «Chờ xác định người duyệt» ở thẻ và ở khối người duyệt; chỉ chữ, không có nút nào để cấp.
- Chưa có người nhận xét: «Chưa có người nhận xét nào được chỉ định.» (danh sách có thể rỗng).
- Người xem không phải điều phối: thấy người và loại tài liệu của người khác; không biểu mẫu, không nút; dòng của chính mình hiện căn cứ trong `<bdi>`.
- Người đã là người nhận xét: `DELEGATION_EXISTS` tại chỗ.
- Thu hồi khi dòng vừa bị người khác thu hồi: `DELEGATION_CONFLICT`, «Tải lại»; căn cứ đang gõ được giữ.
- Điều phối đang là người nhận xét: không có chính mình trong ô chọn; dòng của mình vẫn hiện, vẫn có «Thu hồi» theo dịch vụ.
- Vai trong phiên đã cũ: 404 chung kèm «Tải lại»; trang chi tiết ngoài phạm vi hiện «Không tìm thấy tài liệu trong phạm vi được cấp.».
- Bản đã có quyết định: xem mục 4.
- Tài liệu chưa có bản nào mở bằng URL (`NO_REVISION`): câu «Tài liệu này chưa có bản nào để review.» và liên kết về danh sách, không qua trang lỗi.
- Nhận xét, tiêu đề, tóm tắt, ghi chú phạm vi, ngoại lệ, ghi chú liên kết do người viết: `dir="auto"` hoặc `<bdi dir="auto">`, để ký tự đảo chiều không xếp lại dòng bên cạnh.
- Tác giả tự mở: câu `AUTHOR`, không nút nhận xét, không nút quyết định.
- Hai tab: tab sau gửi quyết định trước ⇒ tab này nhận `REVIEW_ALREADY_DECIDED` hoặc `REVISION_CONFLICT`; nội dung đang gõ được giữ.
- Nhận xét, căn cứ, tiêu đề dài không dấu cách: `overflow-wrap:anywhere`, không cuộn ngang ở 360.
- Nội dung có ký tự HTML hoặc ký tự đảo chiều (RTL, độ rộng bằng không): chỉ là chữ React; không `dangerouslySetInnerHTML`, không `href` dựng từ chữ lưu; liên kết chỉ tới `/review`, `/review/<documentId>` và trang có sẵn.
- Dòng uỷ quyền chỉ có `id`, `delegateId`, `docTypes` (các trường khác `null`): không «null», không ngày, không chỉ báo, không nút.

## Kiểm tay
**Người viết không chạy danh sách này. Phiên lát 3 đã kiểm tay một phần ngày 15/11/2026, ở chế độ mô phỏng trên máy cục bộ (`npm run dev`, vai «Điều phối LibeTech», dữ liệu tổng hợp), ở 1280×800, 949×800 và 360×740. Đây là kiểm tay, không phải nghiệm thu.**

Đã kiểm, đạt: trang chọn dự án (hai dự án); hàng review với một tài liệu có hai bản (tiêu đề chứa `<script>…</script>` hiện nguyên chữ; «hash tự khai — chưa kiểm»; «Chưa có quyết định»; «Chờ xác định người duyệt»; «1–1 / 1 tài liệu»); trang chi tiết ở 1280 (`.review-diff` hai cột «Trước» / «Sau», nhãn chữ Sửa / Thêm / Xóa, «Nguồn chưa đóng băng», thẻ `<b>` trong tóm tắt hiện nguyên chữ; tác giả thấy câu lý do và không có biểu mẫu nào); ở 949 một cột; ở 360×740 một cột, không cuộn ngang, không phần tử nào tràn khung, mọi nút và liên kết hành động ≥ 44px, chuỗi dài không dấu cách xuống dòng; khối từ chối của dự án ngoài quyền (câu cố định, không tên, không số); tài liệu không tồn tại (câu «Không tìm thấy tài liệu trong phạm vi được cấp.»). `npm run build` liệt kê đủ ba tuyến (bằng chứng ở thư mục bằng chứng của lát).

**Chưa kiểm được ở chế độ mô phỏng** — chỉ dựa trên test dựng tĩnh và test dịch vụ: khối «Người nhận xét của dự án» (chỉ định, thu hồi, hai nhãn của điều phối), vì dịch vụ đọc vai của người gọi từ bảng danh tính mà các vai mô phỏng không có nên khối không hiện; biểu mẫu quyết định và nhận xét, banner Conflict, thông báo `role="status"`, thử hai tab (chế độ mô phỏng không có người duyệt hay người nhận xét nào); vòng focus khi dùng bàn phím; trình đọc màn hình. Các mục tương ứng dưới đây còn để trống.

Phát hiện khi kiểm tay, đã sửa: tài liệu không có mã hiện dấu ngăn thừa trước tiêu đề.
- [ ] `npm run build` liệt kê `/review`, `/review/[documentId]`, `/api/reviews/[[...path]]`.
- [ ] `/review` không có `projectId`: một dự án chuyển thẳng; nhiều dự án hiện danh sách chọn.
- [ ] `/review?projectId=<dự án ngoài quyền>`: chỉ khối từ chối, không tên, không số.
- [ ] 360×740: không cuộn ngang ở hàng review, chi tiết, khối người nhận xét; nút ≥44×44; chuỗi dài không dấu cách (tiêu đề, nhận xét, căn cứ) xuống dòng.
- [ ] 1280×800: `.review-diff` hai cột «Trước» / «Sau»; ở 949px một cột.
- [ ] Chuỗi `<script>alert(1)</script>` trong tiêu đề, nhận xét, căn cứ hiện nguyên chữ.
- [ ] Căn cứ có ký tự RTL không làm đảo bố cục dòng (nằm trong `<bdi>`).
- [ ] Bàn phím: Tab qua nút, ô; vòng focus thấy rõ; bấm «Thu hồi» rồi gõ căn cứ, lỗi thì chữ vẫn còn.
- [ ] Người không phải điều phối: không có «Thu hồi», không biểu mẫu; dòng của người khác chỉ có tên và loại.
- [ ] Điều phối: chỉ định thành công thấy `role="status"`; thu hồi thành công dòng xuống «Đã thu hồi»; ô chọn không có chính mình và không có người «Chỉ đọc».
- [ ] Bản đã có quyết định: không «Gửi nhận xét», không «Chấp thuận», không «Yêu cầu sửa»; «Đã sửa» và «Xác nhận đã xử lý» vẫn có.
- [ ] Hai tab: quyết định ở tab A, thử ở tab B ⇒ câu Conflict hoặc «đã có quyết định», chữ đang gõ còn.
- [ ] Trình đọc màn hình: vùng `role="status"` đọc thông báo thành công; `role="alert"` đọc lỗi.

## Việc chưa làm
- Biểu mẫu để điều phối dự án trình phiếu cấp quyền duyệt bản chuẩn (bước 16b của Task 16, Task 7c): thuộc một PR riêng sau lát 3 (Chairman quyết 15/11/2026). Màn này không có `proposals`, `onPropose` hay biểu mẫu trình phiếu; khối người nhận xét không có điều khiển nào chạm tới quyền duyệt bản chuẩn.
- Câu hỏi mở OQ-43 (người được chỉ định có thấy chỉ báo «người chỉ định không còn là điều phối» ở dòng của mình không) và OQ-44 (ai thấy danh sách người duyệt): giao diện vẽ đúng thứ dịch vụ trả, không tự quyết.
- Kiểm tay mới làm một phần: khối người nhận xét, biểu mẫu quyết định và nhận xét, Conflict, bàn phím và trình đọc màn hình chưa kiểm bằng trình duyệt (xem «Kiểm tay»).
