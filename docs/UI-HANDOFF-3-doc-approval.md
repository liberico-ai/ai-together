# Bàn giao giao diện — «Trình phiếu cấp quyền duyệt bản chuẩn» (màn Review) và khối phiếu đang mở ở `/team` (Task 7c)

Nguồn: kế hoạch `docs/plans/task-7c-coordinator-proposal.md` (Task 3, Task 4; T7C-4, T7C-11, T7C-13, T7C-15, T7C-18, T7C-19, T7C-21, T7C-28, T7C-29, T7C-31, T7C-32, T7C-33, T7C-35), quyết định OQ-35 (a), OQ-36 (b), OQ-37 (c), OQ-38 (c), OQ-48 (b), OQ-49 (a), OQ-50 (c), OQ-51 (b), OQ-52 (a) ở `docs/OPEN-QUESTIONS.md`; khuôn `docs/UI-HANDOFF-3-review.md`; `docs/DESIGN-SYSTEM-PM-DOCUMENTS.md` (`:23`, `:62-66`, `:90-103`).
Mã ở màn Review: `src/components/doc-approval-proposals.tsx` (khối), `src/components/doc-approval-view.ts` (hàm thuần, câu chữ), `src/components/review.tsx` (`ReviewQueue`, `ReviewersPanelView`, `ReviewersPanel`), `src/components/review-view.ts` (`checkBasis`, `APPROVAL_NOTE_WITH_PROPOSALS_COPY`), `src/server/review-page.ts` (`loadOwnProposals`), `src/app/review/page.tsx`. Mã ở `/team` (Task 3): `src/components/team-accounts.tsx` (`AccountForm`, `OpenBallot`, `standingEcho`, `ballotCommand`, `shouldReloadAccounts`, `reloadAfterConflict`). Tuyến: `src/app/api/team/doc-approvals/[[...path]]/route.ts` → `src/server/doc-approval-http.ts` → `src/server/doc-approval-proposals.ts`; lệnh của quản trị qua `/api/team/accounts` có sẵn. Ca kiểm: `tests/doc-approval-ui.test.tsx` (P1–P19, màn Review; P16–P19 của lượt sửa 1), `tests/doc-approver-ui.test.tsx` (khối ở `/team`).
Giao diện không tự tính quyền: khối nào hiện, nút nào hiện theo dữ liệu dịch vụ trả (`canDesignate` của `DelegationService.list`, `accountAdmin` của phiên, danh sách của `DocApprovalProposalService.listOwn`, `accessChange` của `AccountService.list`). Mọi từ chối đến từ dịch vụ. Khối trình phiếu không cấp gì: một phiếu cần một thành viên BoM đồng ý, và chỉ quản trị tài khoản áp, ở `/team`.

## 1. Bố cục
**Màn Review `/review?projectId=`, khi trang có `proposals`** (trang truyền `proposals` khi và chỉ khi khối «Người nhận xét của dự án» hiện, tức `DelegationService.list` trả dữ liệu): như `docs/UI-HANDOFF-3-review.md` mục 1, với hai điểm khác: câu ghi chú trong khối «Người nhận xét của dự án» là «Quyền duyệt bản chuẩn cấp qua phiếu đổi quyền: điều phối dự án hoặc quản trị tài khoản trình, một thành viên BoM đồng ý, quản trị tài khoản áp.» (thay cho câu chỉ sang trang Quản trị tài khoản), và **ngay dưới khối đó** là khối «Trình phiếu cấp quyền duyệt bản chuẩn».
Không có `proposals` (trang chọn dự án, dự án ngoài quyền, người đọc mà `DelegationService.list` từ chối, mọi chỗ khác dựng `ReviewQueue`): màn y như trước, câu ghi chú cũ, không có khối mới.

**Khối «Trình phiếu cấp quyền duyệt bản chuẩn»** (`<section className="review-panel" aria-label="Trình phiếu cấp quyền duyệt bản chuẩn">`), từ trên xuống:
1. Tiêu đề `h2` cùng chữ.
2. Vùng `role="status"` (luôn có mặt, rỗng khi chưa có thông báo).
3. Lỗi của lệnh hoặc lỗi kiểm tại chỗ (`role="alert"`), kèm nút «Tải lại» khi lỗi đó được đánh dấu `reloadable`; «Tải lại» bị vô hiệu trong lúc một lệnh đang chạy. Đây là bản trình đọc màn hình đọc.
4. Thân theo trạng thái (mục 4):
   - `loading`: khung chờ `<div className="doc-list doc-skeleton" aria-busy="true" aria-label="Đang tải phiếu đã trình">` với ba `doc-skel-row`.
   - `admin`: một câu và liên kết «Mở trang Quản trị tài khoản» tới `/team`.
   - `error`: khối `role="alert"` với câu và nút «Thử lại».
   - `denied`: một câu, không gì khác.
   - `former`: câu «Anh/chị không còn là điều phối…» → danh sách «Phiếu anh/chị đã trình».
   - `empty` và `ready`: câu «Phiếu cần một thành viên BoM đồng ý. Quyền chỉ có hiệu lực sau khi quản trị tài khoản áp.» → danh sách «Phiếu anh/chị đã trình» → đoạn ba câu về việc trình lại → nhóm «Trình phiếu mới».
**Danh sách «Phiếu anh/chị đã trình»** (`h3`): rỗng thì «Anh/chị chưa có phiếu nào đang mở.»; ngược lại mỗi phiếu một dòng `review-person`: tên người được cấp (trong `<bdi dir="auto">`; không có trong danh bạ thì «Thành viên chưa rõ tên») → nhãn các loại tài liệu phiếu thêm → «Hết hạn lúc <giờ>» → nhãn giai đoạn → với phiếu `approved`: câu «Phiếu đã đủ xác nhận nên không rút được ở đây; muốn dừng thì nhờ quản trị tài khoản huỷ.»; với phiếu `pending`: nút «Rút phiếu», bấm thì thay bằng ô «Căn cứ rút phiếu (5–500 ký tự)» (ô nhận focus khi mở, `autoFocus`), nút «Xác nhận rút» và «Hủy» ngay tại dòng. Tiêu đề `h3` của danh sách có `tabIndex={-1}`: nhận focus từ mã sau khi rút thành công, không nằm trong vòng Tab.
**Bản nhắc lỗi ngay trên nút gửi** (lượt sửa 1, soát giao diện I-2): khi có lỗi (của lệnh hoặc kiểm tại chỗ), cùng câu đó hiện lần nữa trong `<div className="review-problem" aria-hidden="true">` **ngay trên «Trình phiếu»**, và khi một ô rút đang mở, **ngay trên «Xác nhận rút»** (giữa ô căn cứ rút và nút). Bản nhắc chỉ để nhìn — `aria-hidden="true"`, không `role` — để trình đọc màn hình không đọc hai lần; bản được đọc là vùng `role="alert"` ở đầu khối (mục 3 ở trên). Lý do: ở 360 px vùng lỗi đầu khối có thể nằm xa phía trên nút vừa bấm. Không có bản nhắc cho thông báo thành công.
**Nhóm «Trình phiếu mới»** (`<div className="review-form" role="group" aria-label="Trình phiếu mới">`, tiêu đề `h3` cùng chữ): ô chọn «Thành viên» → (khi người đang chọn là điều phối của dự án) câu «Người này cũng là điều phối của dự án. Phiếu sẽ nêu rõ điều đó cho người bỏ phiếu.» → nhóm tám ô «Loại tài liệu được duyệt bản chuẩn (chọn thêm ít nhất một)» → ô «Căn cứ (5–300 ký tự, một dòng)» → nút «Trình phiếu». Không có phần tử `<form>`: nhấn Enter trong ô căn cứ không gửi gì; chỉ nút gửi.

**`/team` — khối phiếu đang mở của một tài khoản** (Task 3, T7C-15): Quản trị chọn tài khoản → biểu mẫu `AccountForm` của tài khoản đó. **Phần tử con đầu tiên của biểu mẫu là `<button type="submit" disabled hidden/>`** (lượt soát bảo mật Task 3, F1): Enter trong một ô chữ gửi biểu mẫu qua nút gửi đầu tiên, và nút đó bị vô hiệu nên không gửi gì; vì vậy Enter không bao giờ áp hay huỷ phiếu đang hiện bên dưới. Mọi nút nhìn thấy vẫn gửi khi bấm. Tiếp theo: dòng tình trạng tài khoản («Đã khóa» / «Đang hoạt động» / «Chờ kích hoạt») → khối `OpenBallot` (chỉ khi tài khoản có `accessChange`) → «Phạm vi dự án» (có tám ô duyệt bản chuẩn theo loại) → xác minh GitHub → «Lý do thay đổi» → hàng nút có sẵn.
Khối `OpenBallot`, từ trên xuống: với phiếu `approved`: «Phiếu đổi quyền đã đủ xác nhận.» và hai dòng «Quyền hiện tại: …» / «→ Quyền đề nghị: …» (đọc từ bộ đóng băng của phiếu); với phiếu `pending`: «Đang có phiếu đổi quyền chờ một thành viên BoM.» → «Căn cứ: <bdi dir="auto">…</bdi>» → (phiếu của điều phối) «Phiếu này do điều phối dự án trình. Huỷ phiếu không đổi tài khoản và không thu hồi phiên của thành viên.» → (phiếu của điều phối và `proposerIsCoordinator === false`) câu `role="note"` «Người trình không còn là điều phối đang hoạt động của dự án này. Phiếu vẫn áp được; cân nhắc trước khi áp.» — **ngay trên nút áp** → hàng nút: «Áp đúng bộ quyền đã được duyệt» (chỉ phiếu `approved`), «Huỷ phiếu của điều phối» (chỉ phiếu của điều phối — OQ-49 a).

## 2. Token
Không thêm màu, không thêm lớp, không `style` nội tuyến, không chiều rộng cố định; `src/app/globals.css` không đổi. Khối ở màn Review chỉ dùng các lớp có sẵn: `review-panel review-form review-notice review-problem review-text review-meta review-plain review-person review-person-name review-badges review-badge review-inline review-fieldset review-check doc-field doc-action review-action review-secondary doc-list doc-skeleton doc-skel-row` (ca P13 đọc `src/components/doc-approval-proposals.tsx` và đòi mọi `className` là chữ cố định thuộc danh sách này; `review-textarea` có trong danh sách được phép nhưng khối không dùng vì cả hai ô căn cứ là `input type="text"`). `doc-skeleton` là lớp đánh dấu, không có luật CSS; kiểu dáng của khung chờ đến từ `doc-list` và `doc-skel-row`, như năm khung chờ hiện có. Nút chính `doc-action review-action`; nút phụ («Rút phiếu», «Hủy», «Tải lại») thêm `review-secondary`.
Tín hiệu không chỉ bằng màu: giai đoạn của phiếu là chữ («Đang chờ một thành viên BoM» / «Đã đủ phiếu, chờ quản trị tài khoản áp»); loại đang giữ là chữ « — đang giữ» cạnh ô đã chọn và khoá; câu về đồng điều phối, câu về người trình ở `/team` là chữ.
`/team` dùng các lớp có sẵn của trang (`action-form`, `team-actions`, `primary`, `secondary`, `muted`); Task 3 không thêm lớp.

## 3. Props thành phần và tuyến
```ts
// src/server/review-page.ts
export type ProposalsInitial={state:'ready';items:DocApprovalProposal[];canPropose:boolean}|{state:'denied'}|{state:'admin'}|{state:'error'};
export async function loadOwnProposals(who:{coordinator:boolean;accountAdmin:boolean},read:()=>Promise<DocApprovalProposal[]>):Promise<ProposalsInitial>;
//   accountAdmin → {state:'admin'}, không gọi read. Ngược lại luôn gọi read (người đọc nào của dự án cũng có thể là người đã trình — OQ-50 c):
//   thành công → {state:'ready',items,canPropose:who.coordinator}; AppError SCOPE_DENIED → {state:'denied'}; mọi lỗi khác (kể cả read ném ngay, như
//   identityService() khi chưa cấu hình) → {state:'error'} kèm một dòng console.error JSON {level:'error',event:'doc_approval_proposals_unavailable',errorType}
//   — không tên, không căn cứ, không câu lỗi. Không bao giờ ném.
// DocApprovalProposal (src/server/doc-approval-proposals.ts):
//   {approvalId:string;projectId:string;userId:string;addedTypes:DocApprovalType[];state:'pending'|'approved';expiresAt:string;replayed:boolean}

// src/components/doc-approval-view.ts — hàm thuần
export type ProposalPanelState='loading'|'admin'|'error'|'denied'|'former'|'empty'|'ready';
export function proposalPanelState(i:{loading:boolean;admin:boolean;failed:boolean;denied:boolean;canPropose:boolean;count:number}):ProposalPanelState;
export function canProposeFrom(initial:ProposalsInitial|undefined,canDesignate:boolean):boolean;
//   {state:'ready'} → initial.canPropose (câu trả lời mà trang đã đọc); mọi trạng thái khác → canDesignate của khối người nhận xét — cùng giá trị
//   trang đã đưa vào loadOwnProposals. Lần đọc đầu lỗi rồi «Thử lại» thành công thì điều phối vẫn thấy biểu mẫu, không bị coi là `denied`/`former`.
export function standingAfterReread(initial:ProposalsInitial|undefined,canDesignate:boolean):ProposalsInitial|undefined;
//   Sau mỗi lần đọc lại khối người nhận xét (lượt Codex 1, P2): {state:'ready'} → cùng danh sách, canPropose = canDesignate vừa đọc; mọi trạng thái
//   khác trả nguyên. Điều phối bị hạ vai trong lúc trang mở thấy `former`/`denied` sau «Tải lại»; thành viên được nâng làm điều phối thấy biểu mẫu.
export function standingAfterRereadFailure(initial:ProposalsInitial|undefined,e:unknown):ProposalsInitial|undefined;
//   Sau một lần đọc lại khối người nhận xét bị lỗi (soát lại lượt Codex 1, N1): ApiError `SCOPE_DENIED` → standingAfterReread(initial, false),
//   vì khối người nhận xét từ chối mọi vai ngoài manager/engineer/technical/business (điều phối bị hạ xuống «Chỉ đọc»); lỗi khác → trả nguyên initial.
export type ProposalDraft={userId:string;docTypes:DocType[];basis:string;withdrawId:string|null;withdrawBasis:string};
export const EMPTY_PROPOSAL_DRAFT:ProposalDraft;
export function settledDraft(current:ProposalDraft,sent:ProposalDraft,cleared:Partial<ProposalDraft>,answer:boolean|void):ProposalDraft;
//   answer === false → current nguyên vẹn; khác false → xoá các trường trong `cleared`, nhưng chỉ khi mọi trường đó vẫn giữ đúng giá trị đã gửi
//   (`sent`); nếu người dùng đã gõ lại trong lúc lệnh chạy thì giữ nguyên current
export type ProposalReload={own:{kind:'ok';items:DocApprovalProposal[]}|{kind:'denied'}|{kind:'failed'};delegationsError:string};
export async function reloadProposals(io:{readOwn:()=>Promise<DocApprovalProposal[]>;readDelegations:()=>Promise<void>},withDelegations:boolean):Promise<ProposalReload>;
//   withDelegations → đọc lại khối người nhận xét trước (approvers), rồi danh sách của mình. Không bao giờ ném: SCOPE_DENIED của danh sách → denied,
//   lỗi khác → failed; đọc lại approvers lỗi → delegationsError là câu của describeError, danh sách vẫn được đọc
export function heldTypes(approvers:ApproverView[],userId:string):DocType[];      // so mã không phân biệt hoa thường; theo thứ tự DOC_TYPES
export function proposeCommand(d:ProposalDraft,held:DocType[]):Checked<{userId;docTypes;expectedTypes;reason}>;
export function withdrawCommand(row:Pick<DocApprovalProposal,'approvalId'|'state'>,basis:string):Checked<{approvalId;reason}>;   // chỉ dòng pending
export const proposeBody:(projectId,c)=>{projectId;userId;docTypes;expectedTypes;reason};
export const withdrawBody:(c:{reason})=>{reason};                               // mã phiếu chỉ ở đường dẫn (T7C-31)
export const proposalStateLabel:(s:'pending'|'approved')=>string;
export function proposalFailure(e:unknown):{message:string;reloadable:boolean;keepDraft:true};
//   cùng các hằng câu chữ của khối (PROPOSALS_*_COPY, PROPOSED_NOTICE, WITHDRAWN_NOTICE) — chữ ở mục 4
// src/components/review-view.ts
export const APPROVAL_NOTE_WITH_PROPOSALS_COPY:string;
export function checkBasis(raw:string,rule:{max:number;forbidden:RegExp;forbiddenCopy:string;lengthCopy:string}):Checked<string>;
//   thân cũ của basisCheck, thêm tham số; basisCheck là một lời gọi checkBasis với lớp ký tự điều khiển, 500 và câu cũ (T7C-33)

// src/components/doc-approval-proposals.tsx ('use client')
DocApprovalPanelView({state;proposals:DocApprovalProposal[];approvers:ApproverView[];people:{id;name;role}[];viewerId;busy;error;notice;reloadable;localError;
  draft:ProposalDraft;onDraft;onPropose:(c:{userId;docTypes;expectedTypes;reason})=>void;onWithdraw:(c:{approvalId;reason})=>void;onInvalid:(m)=>void;onReload?;
  listHeadingRef?:Ref<HTMLHeadingElement>;withdrawButtonRef?:(approvalId,el:HTMLButtonElement|null)=>void})   // không hook; hai ref chỉ để DocApprovalPanel chuyển focus
DocApprovalPanel({state;proposals;approvers;people;viewerId;busy;error;notice?;reloadable?;onReload?;
  onPropose?:(c)=>void|Promise<boolean|void>;onWithdraw?:(c)=>void|Promise<boolean|void>})
//   giữ nháp và lỗi kiểm tại chỗ; lệnh trả khác `false` thì chỉ xoá phần nháp của chính lệnh đó (trình: ô thành viên, các ô loại, căn cứ;
//   rút: ô rút đang mở và căn cứ rút), và chỉ khi phần đó vẫn là cái đã gửi (`settledDraft`) — nháp trình đang gõ dở vẫn còn sau khi rút một
//   phiếu khác, và phiếu gõ lại trong lúc lệnh trình đang chạy không bị xoá.
//   Focus: «Hủy» trả focus về «Rút phiếu» của chính dòng đó; rút thành công và ô rút đã đóng → focus tới h3 «Phiếu anh/chị đã trình».

// src/components/review.tsx
ReviewersPanelView({…như cũ…; approvalNote?:string})   ReviewersPanel({…như cũ…; approvalNote?:string})   // mặc định APPROVAL_NOTE_COPY
ReviewQueue({…như cũ…; proposals?:ProposalsInitial})   // 'use client'; không có proposals thì y như trước
//   ReviewQueue giữ trạng thái của khối: danh sách, đang tải, tải lỗi, bị từ chối, đang gửi, lỗi lệnh, thông báo;
//   canPropose = canProposeFrom(proposals, delegations?.canDesignate === true) — màn hình không tự tính quyền.
//   proposals là state, khởi từ prop của trang; reloadDelegations (mọi lần đọc lại khối người nhận xét) gọi
//   setProposals(p => standingAfterReread(p, fresh.canDesignate === true)) (lượt Codex 1, P2); lần đọc lỗi đi qua rereadFailed, gọi
//   setProposals(p => standingAfterRereadFailure(p, e)) rồi ném lại lỗi, nên reloadAll, reloadProposals và command() vẫn hiện câu lỗi (N1).
//   onReload của khối = reloadOwn(proposalReloadable): «Tải lại» cạnh một lỗi reloadable đọc lại cả approvers (reloadDelegations) rồi danh sách;
//   «Thử lại» của trạng thái error chỉ đọc danh sách. reloadOwn bỏ qua khi một lệnh đang chạy.
//   Khối chỉ dựng khi có cả proposals lẫn delegations (loại đang giữ đọc từ delegations.approvers).

// src/components/team-accounts.tsx (Task 3; Task 4 không đổi tệp này)
AccountForm({user:Account;projects:Project[];busy:boolean;expands:boolean;onSubmit:(event:FormEvent<HTMLFormElement>)=>void;onExpands:(expands:boolean)=>void})
//   biểu mẫu của một tài khoản có sẵn, tách nguyên vẹn khỏi TeamAccounts; TeamAccounts giữ trạng thái và lệnh gửi.
//   Phần tử con đầu tiên: <button type="submit" disabled hidden/> (mục 1).
OpenBallot({change:OpenAccessChange|null|undefined;projects:Project[];busy:boolean})   // null hoặc undefined → không dựng gì
//   OpenAccessChange (src/server/accounts.ts): {approvalId;state:'pending'|'approved';reason;expiresAt;grants:ProjectGrant[];previousGrants:ProjectGrant[];
//     viaProjectManager:boolean;proposerIsCoordinator:boolean|null}   // null với phiếu do quản trị trình
standingEcho(user:{accessChange?:OpenAccessChange|null}):{proposerIsCoordinator?:boolean}
//   {proposerIsCoordinator} khi tài khoản có phiếu của điều phối (giá trị boolean của accessChange); ngược lại {}.
ballotCommand(action:'apply_frozen'|'cancel_access_change',user:{id;version;accessChange:OpenAccessChange},reason:unknown):Record<string,unknown>
//   apply_frozen → {kind:'access',userId,expectedVersion,reason,grants:accessChange.grants,...standingEcho(user)};
//   cancel_access_change → {kind:'cancel_access_change',userId,expectedVersion,reason,approvalId:accessChange.approvalId}. Dựng từ phiếu, không từ các ô đang tích.
shouldReloadAccounts(e:unknown):boolean        // true khi ApiError mã VERSION_CONFLICT
reloadAfterConflict(refusal:unknown,reload:()=>Promise<void>,show:(message:string)=>void):Promise<void>
//   tải lại danh sách tài khoản sau VERSION_CONFLICT; tải lại lỗi thì hiện câu từ chối nối thêm «Không tải lại được danh sách tài khoản: <lỗi>»,
//   không bao giờ thay câu từ chối.
// Trang máy chủ không truyền hàm xuống thành phần client (tests/rsc-boundary.test.ts): trang Review chỉ truyền `proposals` đã qua JSON.
```
**Dữ liệu của trang Review** (`src/app/review/page.tsx`): sau `DelegationService.list`, khi `delegations` khác null: `loadOwnProposals({coordinator:delegations.canDesignate,accountAdmin:principal.accountAdmin===true},()=>new DocApprovalProposalService(identityService()).listOwn(principal,{projectId}))`. Điều kiện gọi là «là người đọc của dự án mà khối người nhận xét hiện», không phải «là điều phối» (OQ-50 c). Trang không có `.catch(` hay khối `catch` rỗng; việc bắt lỗi nằm trong `loadOwnProposals`.
**Tuyến** (đi qua `api()` của `src/components/api.ts`; mọi thân lệnh không bao giờ mang người thực hiện, tenant, quyền, vai hay trạng thái — người gọi và tenant lấy từ phiên; lược đồ của dịch vụ là zod `.strict()`, khoá lạ → 422):
- Trình: `POST /api/team/doc-approvals`, thân `{projectId,userId,docTypes,expectedTypes,reason}` (`proposeBody`). Trả phiếu (`DocApprovalProposal`); gửi lại cùng nội dung khi phiếu còn mở trả lại phiếu đó với `replayed:true`.
- Rút: `POST /api/team/doc-approvals/<approvalId>/withdraw`, thân chỉ `{reason}` (`withdrawBody`); mã phiếu chỉ nằm trong đường dẫn. Trả `{approvalId,state:'withdrawn'}`.
- Tải lại: `GET /api/team/doc-approvals?projectId=` → `DocApprovalProposal[]` (phiếu đang mở của chính người gọi ở dự án đó, tối đa 200).
- `/team`: `POST /api/team/accounts` với thân của `ballotCommand` (áp, huỷ) hoặc lệnh `access` của đường lưu tay (kèm `standingEcho`); đọc lại `GET /api/team/accounts`.
Mọi câu trả lời của `/api/team/doc-approvals` có `Cache-Control: no-store`.

## 4. Trạng thái
**Bảy trạng thái của khối** (ưu tiên loading > admin > error > denied > former > empty > ready; `proposalPanelState`):
| Trạng thái | Khi nào | Hiện |
|---|---|---|
| `loading` | đang tải lại danh sách («Tải lại», «Thử lại») | khung chờ `aria-busy="true"`, không có số 0 giả; nháp đang gõ được giữ |
| `admin` | người xem là quản trị tài khoản (T7C-4; trang không đọc danh sách) | «Quản trị tài khoản trình phiếu cấp quyền duyệt bản chuẩn ở trang Quản trị tài khoản.» + liên kết «Mở trang Quản trị tài khoản» (`/team`); không biểu mẫu, không nút |
| `error` | đọc danh sách lỗi (không phải từ chối phạm vi) | `role="alert"` «Không tải được phiếu anh/chị đã trình. Dữ liệu đã lưu không bị thay đổi.» + «Thử lại»; không biểu mẫu |
| `denied` | dịch vụ trả 404 phạm vi; hoặc người xem không phải điều phối và không có phiếu nào của mình | «Chỉ điều phối của dự án này trình được phiếu cấp quyền duyệt bản chuẩn.» — không biểu mẫu, không nút, không tên ai |
| `former` | không phải điều phối nhưng còn phiếu của mình (OQ-50 c) | «Anh/chị không còn là điều phối của dự án này nên không trình được phiếu mới. Phiếu đã trình còn chờ thì vẫn rút được ở đây.» + danh sách; không biểu mẫu, không câu về 24 giờ |
| `empty` | điều phối, chưa có phiếu đang mở | câu cố định + «Anh/chị chưa có phiếu nào đang mở.» + đoạn về trình lại + biểu mẫu |
| `ready` | điều phối, có phiếu đang mở | câu cố định + danh sách + đoạn về trình lại + biểu mẫu |
Câu cố định của `empty`/`ready`: «Phiếu cần một thành viên BoM đồng ý. Quyền chỉ có hiệu lực sau khi quản trị tài khoản áp.» Đoạn dưới danh sách (OQ-48 b; câu cuối là trần ở T7C-19 mục 8): «Phiếu tự rút thì anh/chị trình lại được ngay. Phiếu bị quản trị tài khoản huỷ, bị từ chối hoặc hết hạn thì phải qua 24 giờ kể từ lúc phiếu đóng mới trình lại được cho cùng người; cần sớm hơn thì nhờ quản trị tài khoản trình. Phiếu hết dùng được vì tài khoản của người được cấp vừa đổi thì có thể phải chờ tới 24 giờ sau hạn của phiếu.»
**Hai giai đoạn của phiếu** (OQ-52 a; danh sách không nêu ghế nào đã đồng ý):
- `pending`: «Đang chờ một thành viên BoM» + nút «Rút phiếu» (OQ-36 b).
- `approved`: «Đã đủ phiếu, chờ quản trị tài khoản áp» + «Phiếu đã đủ xác nhận nên không rút được ở đây; muốn dừng thì nhờ quản trị tài khoản huỷ.» — không có nút «Rút phiếu» (OQ-51 b).
**Ô chọn thành viên** (OQ-33): `selectableMembers(people,viewerId)` — không có chính người đang xem (so mã không phân biệt hoa thường), không có người vai «Chỉ đọc»; **có** điều phối khác của dự án (OQ-38 c). Chữ mỗi lựa chọn «<tên> · <nhãn vai>»; lựa chọn đầu «Chọn thành viên».
**Tám ô loại**: loại người được chọn đang giữ (`heldTypes(approvers,userId)`, đọc từ «Người giữ quyền duyệt bản chuẩn» của khối người nhận xét) hiện đã chọn, `disabled`, nhãn thêm « — đang giữ». `proposeCommand`: `docTypes` = các loại đã chọn trừ loại đang giữ, theo thứ tự `DOC_TYPES`; `expectedTypes` = đúng các loại đang hiện là đang giữ; `reason` = căn cứ đã bỏ dấu cách U+0020 hai đầu.
**Kiểm tại chỗ** (không gửi đi; câu hiện ở vùng `role="alert"` của khối, và ở bản nhắc `aria-hidden` ngay trên nút vừa bấm — mục 1): «Chọn một thành viên.» · «Chọn thêm ít nhất một loại tài liệu.» · «Căn cứ cần từ 5 đến 300 ký tự.» · «Căn cứ không được chứa ký tự điều khiển hoặc ký tự định dạng ẩn.» · (rút) «Căn cứ cần từ 5 đến 500 ký tự.» · (rút một dòng `approved`) «Phiếu đã đủ xác nhận, không rút được ở đây.» Cả hai ô căn cứ kiểm bằng `checkBasis` với lớp `[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]` của máy chủ, theo đúng thứ tự của máy chủ (T7C-33): (1) ký tự cấm trên chuỗi thô; (2) trần (300 hoặc 500 điểm mã) trên chuỗi thô; (3) sàn 5 điểm mã sau khi bỏ dấu cách U+0020 hai đầu. Ký tự cấm ở đầu hay cuối chuỗi bị từ chối, không bị cắt đi. Máy chủ còn từ chối chuỗi PostgreSQL không lưu được (`storable`); giao diện không kiểm điều đó và để máy chủ trả lời (`INVALID_INPUT` 422).
**Thành công** (`role="status"`, sau khi danh sách đã được đọc lại): «Đã trình phiếu. Quyền chưa đổi cho tới khi một thành viên BoM đồng ý và quản trị tài khoản áp.» · «Đã rút phiếu. Quyền của người này không đổi.» Lệnh qua mà đọc lại danh sách lỗi: vẫn báo thành công, kèm `role="alert"` «Không tải được phiếu anh/chị đã trình. Dữ liệu đã lưu không bị thay đổi.» và «Tải lại».
**Lỗi của lệnh** (`proposalFailure`, T7C-35; nháp đang gõ — người được chọn, các ô đã tích, căn cứ, ô rút đang mở và căn cứ rút — được giữ qua mọi lỗi; không bao giờ in một đối tượng thô; không có hàm cắt hậu tố):
| Mã (HTTP) | Lệnh | Câu hiện | «Tải lại» |
|---|---|---|---|
| `APPROVAL_PENDING` (409) | trình | «Người này đang có một phiếu đổi quyền chưa xong.» (câu cố định, không hậu tố) | không |
| `MANAGER_REQUIRED` (403) | trình | «Chỉ điều phối của dự án này trình được phiếu.» (câu cố định) | có |
| `SCOPE_DENIED` (404) | trình, rút | «Không tìm thấy mục trong phạm vi được cấp.» (câu cố định) | có |
| `APPROVAL_CLOSED` (409) | rút | «Phiếu đã kết thúc hoặc hết hạn.» (câu cố định) | có |
| `BALLOT_ALREADY_APPROVED` (409) | rút | «Phiếu đã đủ xác nhận, không còn rút được ở đây. Nhờ quản trị tài khoản huỷ nếu cần.» (câu cố định) | có |
| `VERSION_CONFLICT` (409) | trình | câu của máy chủ kèm hậu tố: «Quyền duyệt của người này đã đổi. Tải lại trước khi trình. [VERSION_CONFLICT]» | có |
| `DOC_APPROVAL_PROPOSAL_INVALID` (422) | trình | câu của máy chủ kèm « [DOC_APPROVAL_PROPOSAL_INVALID]» — một trong ba: «Không tự trình phiếu cấp quyền duyệt cho chính mình.» · «Quản trị tài khoản trình phiếu ở trang Quản trị tài khoản.» · «Người được đề xuất phải là thành viên đang hoạt động của dự án.» | không |
| `APPROVERS_NOT_READY` (409) | trình | câu của máy chủ kèm hậu tố: «Chưa đủ người bỏ phiếu khi không tính người trình. Nhờ quản trị tài khoản kiểm tra danh sách người duyệt hoặc trình thay. [APPROVERS_NOT_READY]» | không |
| `ACCESS_CHANGE_NOT_NEEDED` (409) | trình | câu của máy chủ kèm hậu tố: «Người này đã giữ quyền duyệt các loại tài liệu đã chọn. [ACCESS_CHANGE_NOT_NEEDED]» | không |
| `RATE_LIMITED` (429) | trình | câu của máy chủ kèm « [RATE_LIMITED]» — một trong hai: «Thử lại sau ít phút.» (quá 10 lần trình mỗi giờ của một người trình) · «Anh/chị chưa trình lại được cho người này: phiếu trước của anh/chị cho họ không được áp, và khoảng chờ 24 giờ sau phiếu đó chưa hết. Thử lại sau, hoặc nhờ quản trị tài khoản trình.» (khoảng chờ theo cặp, OQ-48 b) | không |
| `RATE_LIMITED` (429) | rút | câu của máy chủ kèm hậu tố: «Thử lại sau ít phút. [RATE_LIMITED]» (quá 10 lần rút mỗi giờ của một người gọi, đếm cả lần bị từ chối) | không |
| `INVALID_INPUT` (422, lược đồ zod: khoá lạ, căn cứ máy chủ không lưu được…), `INTERNAL_ERROR` (500), mã lạ | trình, rút | câu của máy chủ kèm mã, đúng như `api()` dựng — ví dụ «Dữ liệu không hợp lệ. Kiểm tra các trường và không gửi trường định danh ngoài biểu mẫu. [INVALID_INPUT]»; `message` rỗng → «Không xử lý được yêu cầu. Nội dung đang nhập vẫn được giữ.» | không |
| mất mạng (`TypeError`) | trình, rút, tải lại | «Không kết nối được máy chủ. Nội dung đang nhập vẫn được giữ.» | không |
| giá trị khác | — | «Không xử lý được yêu cầu. Nội dung đang nhập vẫn được giữ.» | không |
`RATE_LIMITED` không có câu cố định ở phía client vì mã đó mang hai câu; giao diện chuyển nguyên `e.message`.
**Tải lại** («Tải lại», «Thử lại»; `reloadProposals`): `GET /api/team/doc-approvals?projectId=`; trong lúc tải: `loading`; `SCOPE_DENIED` → `denied` (danh sách rỗng); lỗi khác → `error`. **«Tải lại» cạnh một lỗi `reloadable` của lệnh** (bảng trên; cả lỗi đọc lại danh sách sau một lệnh đã qua) **đọc lại trước khối người nhận xét** (`GET /api/reviews/delegations?projectId=`, `reloadDelegations` của `ReviewQueue`), rồi mới đọc danh sách — để loại đang giữ và `expectedTypes` của lần trình sau là mới: sau `VERSION_CONFLICT` «Tải lại trước khi trình», bấm «Tải lại» rồi «Trình phiếu» thì lệnh mang đúng bộ loại máy chủ đang giữ (lượt sửa 1, soát mã Important 1). Đọc lại khối người nhận xét lỗi: khối hiện câu của `describeError` (ví dụ «Không kết nối được máy chủ. Nội dung đang nhập vẫn được giữ.») kèm «Tải lại»; danh sách vẫn được đọc. Lỗi đó là `SCOPE_DENIED` thì có nghĩa người xem không còn đọc được khối người nhận xét (khối chỉ mở cho `manager`, `engineer`, `technical`, `business`; điều phối vừa bị hạ xuống «Chỉ đọc» nhận đúng câu «Không tìm thấy tài liệu trong phạm vi được cấp.»), nên khối coi như vừa đọc được `canDesignate=false` (`standingAfterRereadFailure`; soát lại lượt Codex 1, N1) mà vẫn hiện câu lỗi kèm «Tải lại»; lỗi khác không đổi việc có được trình hay không. «Thử lại» của trạng thái `error` chỉ đọc danh sách. «Tải lại» bị vô hiệu trong lúc một lệnh đang chạy. Việc đọc lại cập nhật `canDesignate` của khối người nhận xét, và từ lần đọc lại đó có được trình hay không theo `canDesignate` vừa đọc, không theo câu trả lời lúc mở trang (`standingAfterReread`; lượt Codex 1, P2; xem đoạn «Focus» bên dưới): sau `MANAGER_REQUIRED`, «Tải lại» đưa khối về `former` hoặc `denied`, không còn biểu mẫu, kể cả khi người đó bị hạ xuống «Chỉ đọc» (một giới hạn khi trang không đọc được danh sách lúc mở: mục «Việc chưa làm»).
**Focus** (lượt sửa 1, soát giao diện I-1): bấm «Rút phiếu» → ô «Căn cứ rút phiếu» nhận focus; «Hủy» → focus về «Rút phiếu» của chính dòng đó; rút thành công và ô đã đóng → focus tới tiêu đề «Phiếu anh/chị đã trình» (`tabIndex={-1}`), `role="status"` đọc thông báo. Rút xong phiếu cuối cùng ở `former` thì khối thành `denied`, không còn tiêu đề đó; focus không được chuyển đi đâu (giới hạn đã biết, mục «Việc chưa làm»). Khi trang không đọc được danh sách lúc mở (`error`, `denied`), có được trình hay không lấy từ `canDesignate` của khối người nhận xét (`canProposeFrom`): «Thử lại» thành công thì điều phối thấy `empty`/`ready` kèm biểu mẫu, người không phải điều phối thấy `denied`/`former`. **Sau mỗi lần đọc lại khối người nhận xét** («Tải lại» cạnh một lỗi `reloadable` của khối, «Tải lại» của khối người nhận xét, sau khi chỉ định hoặc thu hồi), có được trình hay không theo `canDesignate` vừa đọc, không theo câu trả lời lúc mở trang (`standingAfterReread`; lượt Codex 1, P2): điều phối bị hạ vai trong lúc trang đang mở bấm «Trình phiếu» gặp `MANAGER_REQUIRED`, bấm «Tải lại» thì khối thành `former` nếu còn phiếu của mình, `denied` nếu không còn, và không còn biểu mẫu; bị hạ xuống «Chỉ đọc» thì lần đọc lại bị từ chối `SCOPE_DENIED`, và chính lời từ chối đó đưa khối về `former` hoặc `denied` như thế, câu lỗi vẫn hiện (`standingAfterRereadFailure`; soát lại lượt Codex 1, N1); thành viên được nâng làm điều phối trong lúc đó thấy biểu mẫu sau một lần đọc lại như thế.
**Trên `/team`** (Task 3): câu về người trình chỉ ở phiếu của điều phối, ngay trên nút áp, khi `proposerIsCoordinator === false` (mục 1). Nút «Áp đúng bộ quyền đã được duyệt» và đường lưu tay (`AccessActions`) đều gửi `proposerIsCoordinator` đã thấy (`standingEcho`). Máy chủ đọc lại tình trạng người trình lúc áp; thiếu hoặc lệch → `VERSION_CONFLICT` 409 «Tình trạng người trình đã đổi. Tải lại để xem trước khi áp.» — trang hiện câu đó (kèm « [VERSION_CONFLICT]») rồi tải lại danh sách tài khoản (`shouldReloadAccounts`, `reloadAfterConflict`), nên câu về người trình (hoặc việc nó không còn) hiện ngay trên nút; bấm lại thì lệnh đi qua. Tải lại lỗi: câu từ chối giữ nguyên, nối thêm «Không tải lại được danh sách tài khoản: <lỗi>». Lệnh áp không bao giờ bị từ chối chỉ vì người trình đã mất vai. Huỷ thành công: «Đã huỷ phiếu. Phiên bản tài khoản và phiên đăng nhập của thành viên không đổi.»; lỗi của huỷ là câu của máy chủ kèm mã (`APPROVAL_NOT_FOUND` «Không tìm thấy phiếu duyệt.», `APPROVAL_CLOSED`, `BALLOT_CANCEL_NOT_ALLOWED` «Lệnh huỷ chỉ áp cho phiếu do điều phối dự án trình.», `VERSION_CONFLICT`). Enter trong ô «Lý do thay đổi» không áp và không huỷ (mục 1).

## 5. Breakpoint
- 360 (<700): một cột; nút rộng hết khối (`review-action` `width:100%`); ô chọn, ô căn cứ, tám ô loại xếp dọc; không cuộn ngang; tên và căn cứ dài không dấu cách xuống dòng (`overflow-wrap:anywhere` của `review-person`, `review-person-name`, `review-text`, `review-meta`).
- ≥700: nhóm «Xác nhận rút» / «Hủy» và ô căn cứ rút (`review-inline`) xếp ngang, nút rộng theo chữ. «Trình phiếu» và «Rút phiếu» là phần tử con của một khối cột (`review-form`, `review-person`) nên vẫn rộng hết khối, như «Chỉ định» và «Thu hồi» của khối người nhận xét.
- ≥950 và ≥1200: như 700.
Không phần tử nào rộng cố định trên 328 px; nút và liên kết hành động ≥44×44 (`doc-action`, `review-action`); mỗi ô loại cao ≥44 px (`review-check`).

## 6. Edge case
- Người xem không phải điều phối và chưa từng trình: `denied` — một câu, không biểu mẫu, không nút, không tên ai.
- Người xem đã mất vai `manager` nhưng còn là thành viên và còn phiếu của mình: `former` — danh sách và «Rút phiếu» ở phiếu `pending`, không biểu mẫu (OQ-50 c). Rút xong phiếu cuối cùng: khối thành `denied`, thông báo thành công vẫn hiện.
- Người trình đã bị hạ xuống «Chỉ đọc»: màn Review chỉ mở cho `manager`, `engineer`, `technical`, `business`, nên họ không mở được màn để bấm; dịch vụ vẫn nhận lệnh rút của họ qua API (OQ-50 c), còn trên giao diện họ nhờ quản trị tài khoản huỷ. Trang đã mở trước khi họ bị hạ: «Tải lại» bị khối người nhận xét từ chối (`SCOPE_DENIED`, «Không tìm thấy tài liệu trong phạm vi được cấp.»), danh sách của mình vẫn đọc được (OQ-50 c), và khối thành `former` (còn phiếu) hoặc `denied` (hết phiếu), không biểu mẫu, câu lỗi và «Tải lại» vẫn hiện (soát lại lượt Codex 1, N1).
- Người xem là quản trị tài khoản, đồng thời điều phối dự án: `admin` — câu và liên kết sang `/team`; trang không đọc danh sách (dịch vụ trả `[]` cho quản trị).
- Chưa có phiếu nào: `empty` — «Anh/chị chưa có phiếu nào đang mở.» và biểu mẫu.
- Dịch vụ danh tính chưa cấu hình (kể cả chế độ mô phỏng, `IDENTITY_UNAVAILABLE`): `error` — câu tải lỗi và «Thử lại»; một dòng log JSON không tên, không căn cứ.
- Người được chọn đang giữ đủ tám loại: tám ô đều đã chọn và khoá; «Trình phiếu» trả «Chọn thêm ít nhất một loại tài liệu.»
- Người được chọn là đồng điều phối: có trong ô chọn; câu «Người này cũng là điều phối của dự án. Phiếu sẽ nêu rõ điều đó cho người bỏ phiếu.»; căn cứ đóng băng của phiếu dùng phần cố định dài hơn (T7C-7).
- Người trình đang giữ ghế BoM và là ghế BoM duy nhất sẵn sàng: `APPROVERS_NOT_READY` với câu của máy chủ — câu y hệt cho mọi người được chọn (T7C-3).
- Người được chọn đang có phiếu khác chưa xong: `APPROVAL_PENDING` «Người này đang có một phiếu đổi quyền chưa xong.»; nháp giữ nguyên.
- Trình lại trong 24 giờ sau khi phiếu trước của cùng cặp bị huỷ, bị từ chối hoặc hết hạn: `RATE_LIMITED` với câu khoảng chờ theo cặp; đoạn dưới danh sách đã nói trước điều này.
- Trình lại khi phiếu trước đã chết vì tài khoản của người được cấp đổi (chưa ai đánh dấu): khoảng chờ có thể kéo tới 24 giờ sau hạn của phiếu (T7C-19 mục 8; câu cuối của đoạn dưới danh sách); phiếu đó không còn trong danh sách, và lệnh rút nó (từ một tab cũ) trả «Phiếu đã kết thúc hoặc hết hạn.» (T7C-30).
- Trình lại ngay sau khi tự rút: được (OQ-48 b), trong trần 10 lần mỗi giờ.
- Phiếu vừa được một ghế BoM đồng ý lúc bấm rút: `BALLOT_ALREADY_APPROVED` kèm «Tải lại»; tải lại thì dòng hiện «Đã đủ phiếu…» và không còn «Rút phiếu».
- Phiếu vừa bị quản trị huỷ lúc bấm rút: `APPROVAL_CLOSED` «Phiếu đã kết thúc hoặc hết hạn.» kèm «Tải lại»; người trình không được báo việc huỷ ở chỗ nào khác (T7C-18).
- Vai trong phiên đã cũ (vừa mất vai `manager` hoặc bị gỡ khỏi dự án): `MANAGER_REQUIRED` hoặc `SCOPE_DENIED` kèm «Tải lại»; danh tính và vai luôn đọc từ CSDL, không từ phiên.
- Căn cứ dài không dấu cách: xuống dòng, không cuộn ngang ở 360.
- Căn cứ có ký tự HTML (`<script>`): chỉ là chữ React, không `dangerouslySetInnerHTML`.
- Căn cứ có ký tự đảo chiều (U+202E…), dấu ngắt dòng U+2028, hay emoji ghép bằng U+200D: bị từ chối tại chỗ với «Căn cứ không được chứa ký tự điều khiển hoặc ký tự định dạng ẩn.» (hệ quả đã nhận của T7C-20); máy chủ từ chối cùng lớp đó.
- **Tên người trình do người dùng đặt đứng đầu căn cứ đóng băng trên thẻ của người bỏ phiếu (`/approvals`) và trên `/team` — phần dư đã nhận (T7C-21).** Một tên như «Quản trị tài khoản đã duyệt. Ghi chú» làm căn cứ mở đầu bằng chữ trông như của quản trị, trước phần cố định « (điều phối dự án) trình: ». Không thêm được trường có cấu trúc mà không sửa `account-approval.ts`. Tên do quản trị tài khoản và người bỏ phiếu duyệt lúc cấp tài khoản; trên `/team` căn cứ nằm trong `<bdi dir="auto">`.
- Tên người được cấp không có trong danh bạ của trang: «Thành viên chưa rõ tên».
- Trên `/team`: tab mở từ trước khi người trình mất vai — trang còn hiện phiếu như phiếu của một điều phối đang hoạt động; bấm áp thì máy chủ trả `VERSION_CONFLICT` «Tình trạng người trình đã đổi. Tải lại để xem trước khi áp.», trang tải lại, câu «Người trình không còn là điều phối đang hoạt động…» hiện trên nút, bấm lại thì áp (OQ-37 c). Chiều ngược (người trình được trả lại vai) cũng nhận `VERSION_CONFLICT` một lần.

## Kiểm tay
**Người viết không chạy danh sách này và không đánh dấu ô nào.** Phiên Task 7c kiểm và ghi kết quả.
- [ ] `npm run build` liệt kê `/review` và `/api/team/doc-approvals/[[...path]]`.
- [ ] 360×740: khối «Trình phiếu cấp quyền duyệt bản chuẩn» một cột, không cuộn ngang; mọi nút và liên kết ≥44×44; ô loại cao ≥44 px; tên và căn cứ dài không dấu cách xuống dòng.
- [ ] 1280×800: khối nằm ngay dưới «Người nhận xét của dự án»; «Xác nhận rút» / «Hủy» xếp ngang.
- [ ] Điều phối: chọn thành viên, loại đang giữ hiện đã chọn và khoá với « — đang giữ»; trình thành công thấy `role="status"` và dòng mới trong danh sách.
- [ ] Đồng điều phối được chọn: câu «Người này cũng là điều phối của dự án…» hiện.
- [ ] Phiếu `pending`: «Rút phiếu» → ô căn cứ tại chỗ → căn cứ ngắn bị từ chối tại chỗ, chữ vẫn còn → rút thành công, dòng biến mất, `role="status"` báo.
- [ ] Phiếu `approved`: không có «Rút phiếu»; câu «Phiếu đã đủ xác nhận nên không rút được ở đây…».
- [ ] Người đọc không phải điều phối, chưa từng trình: chỉ câu `denied`, không tên ai.
- [ ] Quản trị tài khoản: câu và liên kết sang `/team`, không biểu mẫu.
- [ ] Căn cứ có `<script>alert(1)</script>` hiện nguyên chữ trong ô; căn cứ có ký tự đảo chiều bị từ chối tại chỗ.
- [ ] Bàn phím: Tab qua ô chọn, các ô loại, ô căn cứ, «Trình phiếu», «Rút phiếu»; vòng focus thấy rõ; Enter trong ô căn cứ không gửi gì.
- [ ] Trình đọc màn hình: `role="status"` đọc thông báo thành công; `role="alert"` đọc lỗi; nhãn « — đang giữ» được đọc cùng ô.
- [ ] Focus, bàn phím: Enter trên «Rút phiếu» → focus ở ô «Căn cứ rút phiếu», không rơi về đầu trang.
- [ ] Focus, bàn phím: «Hủy» → focus về đúng nút «Rút phiếu» của dòng đó.
- [ ] Focus, bàn phím: «Xác nhận rút» thành công → focus ở tiêu đề «Phiếu anh/chị đã trình»; trình đọc màn hình đọc «Đã rút phiếu…».
- [ ] 360×740: bấm «Trình phiếu» khi thiếu thành viên → câu lỗi hiện ngay trên nút (bản nhắc), và vùng `role="alert"` ở đầu khối; trình đọc màn hình đọc câu đó một lần.
- [ ] 360×740: ô rút đang mở, căn cứ ngắn → câu lỗi hiện ngay trên «Xác nhận rút».
- [ ] `VERSION_CONFLICT` (đổi quyền duyệt của người được chọn ở tab khác rồi trình) → «Tải lại» → ô loại hiện đúng loại đang giữ mới → «Trình phiếu» đi qua.
- [ ] `/team`: phiếu `approved` của điều phối có «Áp đúng bộ quyền đã được duyệt» và «Huỷ phiếu của điều phối»; phiếu `pending` của điều phối chỉ có «Huỷ phiếu của điều phối»; phiếu của quản trị không có nút huỷ; Enter trong «Lý do thay đổi» không áp và không huỷ.
- [ ] `/team`: người trình mất vai trong lúc tab đang mở → bấm áp → câu `VERSION_CONFLICT`, danh sách tải lại, câu về người trình hiện trên nút, bấm lại thì áp.

## Việc chưa làm
- Không còn câu hỏi mở nào của khối này: OQ-51, OQ-52 và cách tính giờ của OQ-48 đã có quyết định của Chairman ngày 16/11/2026 (bản 0.2–0.3 của kế hoạch ghi ở đây hai câu hỏi còn mở và một cách hiểu chờ xác nhận).
- Hai giới hạn đã biết của khoảng chờ theo cặp (T7C-19 mục 8 và 9): một phiếu chết vì tài khoản đổi mà chưa ai đánh dấu có thể chặn cặp đó tới 24 giờ sau hạn của phiếu, tức tới 72 giờ kể từ lúc phiếu mở; người trình rút ngay trước khi bị từ chối hoặc bị huỷ thì không phải chờ.
- Câu của máy chủ hiện trên khối mang hậu tố ` [MÃ]` (T7C-35); bỏ hậu tố là việc của `api()` dùng chung, ngoài PR này.
- Không có lịch sử phiếu đã đóng: phiếu bị rút, bị huỷ, bị từ chối, hết hạn chỉ rời danh sách.
- Người trình không được báo khi phiếu bị quản trị huỷ (T7C-18); thông báo thuộc lát 4.
- Người trình bị hạ xuống «Chỉ đọc» không có màn để rút; họ nhờ quản trị tài khoản huỷ.
- Trang không đọc được danh sách lúc mở (`error`) thì sau «Thử lại» có được trình hay không lấy từ `canDesignate` của khối người nhận xét (`canProposeFrom`). Lần đọc lại khối đó bị từ chối `SCOPE_DENIED` không mang `canDesignate` mới, và `standingAfterRereadFailure` không đổi các trạng thái không có câu trả lời riêng, nên điều phối bị hạ xuống «Chỉ đọc» sau một lần «Thử lại» thành công vẫn thấy biểu mẫu; cũng vậy khi người đó bị hạ vai trước lần «Thử lại» (lần «Thử lại» chỉ đọc danh sách, không đọc lại khối người nhận xét); máy chủ vẫn từ chối mọi lần trình (`MANAGER_REQUIRED`). Soát lại lượt Codex 1, N1: ghi lại, không sửa trong PR này (phán quyết của phiên Task 7c, không phải quyết định của Chairman); đóng thì cần một trạng thái quyền riêng của khối cho các trạng thái khác `ready`, hoặc đổi `canDesignate` của khối người nhận xét có từ lát 3.
- Rút xong phiếu cuối cùng ở `former`: khối thành `denied`, tiêu đề danh sách biến mất nên focus không được chuyển (mục 4, «Focus»).
- Kiểm tay chưa làm (mục «Kiểm tay»).
