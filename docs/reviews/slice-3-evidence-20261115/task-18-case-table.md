# Task 18 — bảng ca → test (slice 3), HEAD 2a267c5

Nguồn: log `logs/vitest-native-2a267c5.log` (native, 65 tệp, 929 ca, 0 bỏ qua). Mỗi dòng ca là «tệp > tên ca đầy đủ». Dấu «…» của brief được khớp theo tiền tố hoặc đoạn tên; không đổi tên test nào.

## DOC-05
Mức: Mức mã, đầu ra giả lập

- `suggestions` «Z4 drafts: submit > DOC-05 an AI output without sources stays a draft and never reaches Z1» — passed
- `z4-schema` «runtime cannot confirm a draft that names no source, nor with a wrong value hash; a decision is bound to the acting person; one decision per draft» — passed

## DOC-06
Mức: Mức mã, dữ liệu tổng hợp (concurrency: native)

- `document-review` «document review decisions > DOC-06 a source change during review answers REVISION_CONFLICT and the vote is not applied to the new revision» — passed
- `document-review` «document review decisions > (3) an old vote cannot land on a newer revision: stale revision id, stale hash and stale version are each refused» — passed
- `document-review-concurrency` «document review concurrency (native PostgreSQL) > two approvals of the same revision in parallel store one review_decisions row» — passed
- `document-review-concurrency` «document review concurrency (native PostgreSQL) > one person sending two approvals with two keys stores one decision» — passed
- `document-review-concurrency` «document review concurrency (native PostgreSQL) > an approval and a changes_requested on the same revision store exactly one decision» — passed
- `document-review-concurrency` «document review concurrency (native PostgreSQL) > a decision racing a new revision proposal never lands on the newer revision» — passed
- `document-review-concurrency` «document review concurrency (native PostgreSQL) > authority lost between the read and the insert is answered APPROVER_NOT_AUTHORIZED and nothing is stored» — passed

## DOC-08
Mức: Mức mã

- `document-review` «document review decisions > (1) DOC-08 the author cannot decide the own revision, with a review delegation or with the approval grant» — passed
- `document-review` «document review decisions > DOC-08 a member without any authority, and a holder outside the document type, are refused» — passed
- `document-review` «document review decisions > a reviewer cannot use the review delegation to approve a baseline» — passed
- `slice3-bom-events` «DOC-08/T17 the implementer cannot accept own work, also after reassignment through 3/3» — passed

## DOC-09
Mức: Mức mã

- `slice3-bom-events` «DOC-09/T06 two agrees change nothing: assignment, version and receipts stay» — passed
- `slice3-bom-events` «DOC-09/T07 the third agree applies once with exactly one receipt» — passed
- `decisions` «reassignment cards > DOC-09 a 2/3 card reads pending with have 2 and no receipt; after the third vote it reads applied with the receipt» — passed
- `decisions-ui` «decisions UI > DOC-09 a 2/3 card reads Chưa đủ phiếu (2/3) and never Đã áp dụng» — passed

## DOC-15
Mức: Mức mã, không mô hình

- `skill-contracts` «skill contracts > DOC-15 a tool request outside the allowlist is held and the manifest object is unchanged» — passed
- `skills-eval` «skill eval sets > DOC-15 instructions inside source text change neither the tool allowlist nor the manifest hash» — passed
- `skills-eval` «skill eval sets > intake_analyst/injection: the good output passes and the bad output is caught for the stated reason» — passed
- `skills-eval` «skill eval sets > ba_elicitation/injection: the good output passes and the bad output is caught for the stated reason» — passed
- `skills-eval` «skill eval sets > pm_planning/injection: the good output passes and the bad output is caught for the stated reason» — passed
- `skills-eval` «skill eval sets > technical_writer/injection: the good output passes and the bad output is caught for the stated reason» — passed
- `skills-eval` «skill eval sets > doc_reviewer/injection: the good output passes and the bad output is caught for the stated reason» — passed
- `skills-eval` «skill eval sets > release_librarian/injection: the good output passes and the bad output is caught for the stated reason» — passed

## PM-05
Mức: Mức mã (concurrency: native)

- `slice3-bom-events` «PM-05 reject and revise end the round; a changed source or a revoked link holds the vote for reconciliation» — passed
- `slice3-bom-events` «PM-05/T15 every shortcut around 3/3 is refused» — passed
- `slice3-bom-concurrency` «BoM 3/3 concurrency (native PostgreSQL) > two third votes at the same time create exactly one bom_receipts row» — passed
- `slice3-bom-concurrency` «BoM 3/3 concurrency (native PostgreSQL) > two competing proposals reaching their third vote together yield one receipt and one reconcile» — passed

## PM-06
Mức: Mức mã

- `slice3-bom-events` «PM-06 technical and business acceptance are separate events by different people; closing the ticket replaces neither» — passed

## T06, T07, T15, T17, T18 (hồi quy)
Mức: Hồi quy; spec004 :66, :91, :132 đã đối chiếu số dòng với tên ca

- `spec004` «STT 5 applies once at 3/3 and preserves the LBRC014 SHA and acceptance snapshot» — passed
- `spec004` «two proposals at the same version create just one receipt» — passed
- `spec004` «revise cannot bypass 3/3, and BoM vote never grants acceptance» — passed
- `slice3-bom-events` «DOC-09/T06 two agrees change nothing: assignment, version and receipts stay» — passed
- `slice3-bom-events` «DOC-09/T07 the third agree applies once with exactly one receipt» — passed
- `slice3-bom-events` «PM-05/T15 every shortcut around 3/3 is refused» — passed
- `slice3-bom-events` «DOC-08/T17 the implementer cannot accept own work, also after reassignment through 3/3» — passed
- `slice3-bom-events` «T18 a closed ticket leaves acceptance missing and the work in review» — passed

## A04–A06 (hồi quy)
Mức: Hồi quy; foundation :83, :89 đã đối chiếu số dòng với tên ca

- `foundation` «state and acceptance > done requires BOTH acceptances; ticket closure does not change either» — passed
- `foundation` «state and acceptance > rejects implementer, wrong acceptor, old SHA and wrong evidence» — passed
- `slice3-bom-events` «PM-06 technical and business acceptance are separate events by different people; closing the ticket replaces neither» — passed

## Eval kỹ năng
Mức: Bộ chấm với đầu ra giả lập; chưa nối mô hình

- `skills-eval` «skill eval sets > every skill has exactly one case per category» — passed
- `skills-eval` «skill eval sets > every eval context is valid, belongs to its skill and holds only the kinds that skill receives» — passed
- `skills-eval` «skill eval sets > the injection sentence sits in a source text or a title/summary of the injection case only» — passed
- `skills-eval`: 38 cases match «(whole file)», all passed; first three shown

## Quyền âm (1)(3)(5)(6)
Mức: Mức mã

- `document-review` «document review decisions > (1) DOC-08 the author cannot decide the own revision, with a review delegation or with the approval grant» — passed
- `document-review` «document review decisions > (3) an old vote cannot land on a newer revision: stale revision id, stale hash and stale version are each refused» — passed
- `document-review` «document review decisions > (5) an approver of project A cannot see or decide a document of project B; the answer equals the one for an unknown id» — passed
- `document-review` «document review decisions > (6) resending the same decision with the same key stores one decision; the same key with other content conflicts» — passed

## Quyền âm (2)
Mức: Mức mã (đối chiếu theo bảng: slice3-bom-events)

- `slice3-bom-events` «PM-05/T15 every shortcut around 3/3 is refused» — passed

## Quyền âm (4)
Mức: Mức mã

- `z4-schema` «(4) the AI role cannot write any Z1 or Z2 table» — passed

## Quyền âm (7)
Mức: Mức mã

- `skill-context` «skill context > (7) a record of an IBS HI project never enters the context of a Xeca project» — passed

## OQ-31 tự chỉ định mình
Mức: Dịch vụ, CSDL và giao diện

- `review-delegations` «designating a commenter > OQ-31 (1) (a) a manager cannot designate themself» — passed
- `review-schema` «a delegation cannot name its own granter» — passed
- `doc-approver-grant` «the admin cannot propose or apply document approval for their own account» — passed
- `review-ui` «review UI > the reviewers panel lets only a project manager designate, never offers the viewer themself or a read-only member, and requires a document type» — passed

## OQ-31 manager dự án A chỉ định ở B
Mức: Dịch vụ, CSDL và HTTP

- `review-delegations` «designating a commenter > OQ-31 (2) (b) a manager of project A cannot designate in project B, and B is not revealed» — passed
- `review-schema` «only a manager of that very project designates: an engineer, and a manager of project A who is only a member of project B, are refused in B» — passed
- `review-http` «review HTTP > OQ-31 through the handler: self-designation 422, a manager of another project 404, missing document types 422; a designation round trip» — passed

## OQ-31 người nhận xét duyệt bản chuẩn
Mức: Dịch vụ và CSDL

- `document-review` «document review decisions > a reviewer cannot use the review delegation to approve a baseline» — passed
- `review-schema` «a reviewer cannot record an approval by raw SQL» — passed
- `review-delegations` «a commenter can never approve > OQ-31 (3) a designated commenter comments and requests changes for the designated type only, never approves, and the revoke takes effect on the next command» — passed
- `doc-approver-flow` «a reviewer designated by a manager gains nothing from someone else's ballot» — passed

## OQ-31 uỷ quyền thiếu loại tài liệu
Mức: Dịch vụ, CSDL và giao diện

- `review-delegations` «designating a commenter > OQ-31 (4) (c) a designation without document types, with an empty list, an unknown type or a repeat is rejected» — passed
- `review-schema` «a delegation must list document types and only known ones» — passed
- `review-ui` «review UI > the reviewers panel lets only a project manager designate, never offers the viewer themself or a read-only member, and requires a document type» — passed

## Quyền duyệt bản chuẩn qua phiếu đổi quyền
Mức: Mức mã, phiếu tổng hợp; chưa có phiếu thật. test_bot_bridge.py: xem ghi chú

- `doc-approver-grant` «a doc_approve code enters a membership only with an approved or issued access-change ballot that names that project and code» — passed
- `doc-approver-grant` «granting document approval is a widening: without an approved ballot the grant is refused» — passed
- `doc-approver-grant` «one BoM agreeing approves the ballot and the admin applies exactly the frozen grants» — passed
- `doc-approver-flow` «end to end: proposed by the admin, approved by one BoM, applied by the admin, and only then the member approves a frozen design revision» — passed

## viewer không bao giờ là người duyệt (S51)
Mức: CSDL và dịch vụ; cách hiểu chờ Chairman xác nhận cùng S11

- `doc-approver-grant` «document_approvers lists holders of the project in scope only» — passed
- `review-schema` «a reviewer cannot record an approval by raw SQL» — passed
- `doc-approver-flow` «the code alone is not enough: a holder whose project role is viewer is not an approver» — passed

## Mã định danh viết hoa (S76)
Mức: Dịch vụ

- `review-delegations` «designating a commenter > an id in upper case is the same person (h), for designation and for revocation» — passed
- `document-review` «document review input > ids in any letter case mean the same record, and text PostgreSQL cannot store is refused as input» — passed

## Vai trong phiên đã cũ (S74)
Mức: CSDL và dịch vụ

- `review-schema` «each authority branch raises its own SQLSTATE and no integrity branch does» — passed
- `review-delegations` «stale session role and the database guards > a stale session role is answered as out of scope, not as a server error (grant)» — passed
- `review-delegations` «stale session role and the database guards > a stale session role is answered as out of scope, not as a server error (revoke)» — passed

## Bản đã có quyết định (S72)
Mức: Dịch vụ và giao diện

- `document-review` «document review comments > on a decided revision a new comment answers REVIEW_ALREADY_DECIDED, while addressed and resolved on an existing comment are still stored» — passed
- `review-ui` «review UI > a decided revision offers no new comment and no decision, but keeps the follow-up actions on existing comments» — passed

## Ký tự PostgreSQL không lưu được (S64, S80)
Mức: Mức mã

- `skill-contracts` «skill contracts > outputFits refuses U+0000 in a value or a key» — passed
- `skill-contracts` «skill contracts > outputFits refuses a lone surrogate in a value or a key» — passed
- `suggestions` «Z4 drafts: submit > an output with a NUL character answers DRAFT_INVALID before any statement reaches the database» — passed
- `suggestions` «Z4 drafts: submit > an output with a lone surrogate answers DRAFT_INVALID before any statement reaches the database» — passed
- `document-review` «document review input > ids in any letter case mean the same record, and text PostgreSQL cannot store is refused as input» — passed

## OQ-34 (a) thu hồi uỷ quyền
Mức: Dịch vụ, CSDL, HTTP, giao diện (concurrency: native)

- `review-delegations` «revoking a designation > OQ-34 any manager of the project revokes with a basis, also one who did not designate» — passed
- `review-delegations` «revoking a designation > OQ-34 only a manager of that very project revokes (e, f, i)» — passed
- `review-schema` «any manager of that very project revokes, also one who did not designate; the trigger stamps the time and bumps the version» — passed
- `review-schema` «runtime changes the revoke columns only» — passed
- `review-schema` «a revoke cannot be undone or repeated» — passed
- `review-schema` «a revoke names the acting person and carries a basis» — passed
- `review-schema` «decisions and comments written before a revoke are unchanged, and a new designation of the same person is accepted after it» — passed
- `review-schema` «a delegate who lost the project role or was deactivated cannot decide, although the delegation was never revoked» — passed
- `review-http` «review HTTP > OQ-34 through the handler: revoke by a coordinator, refusals, conflict» — passed
- `review-ui` «review UI > OQ-34 only a project manager sees Thu hồi, and a revoke needs a basis» — passed
- `review-delegations-concurrency` «delegation concurrency (native PostgreSQL) > two managers designating the same member at once store one active delegation» — passed
- `review-delegations-concurrency` «delegation concurrency (native PostgreSQL) > two managers revoking the same delegation at once store one revoke» — passed

## Mất quyền giữa lúc đọc và lúc chèn (S38)
Mức: PostgreSQL thật

- `document-review-concurrency` «document review concurrency (native PostgreSQL) > authority lost between the read and the insert is answered APPROVER_NOT_AUTHORIZED and nothing is stored» — passed

## Thẻ quyết định «đúng thẻ còn hiệu lực»
Mức: Mức mã

- `decisions` «review cards > a yes is valid only on the exact live card» — passed

## Đồng thời
Mức: PostgreSQL thật, dữ liệu tổng hợp

- `slice3-bom-concurrency` «BoM 3/3 concurrency (native PostgreSQL) > two third votes at the same time create exactly one bom_receipts row» — passed
- `slice3-bom-concurrency` «BoM 3/3 concurrency (native PostgreSQL) > two competing proposals reaching their third vote together yield one receipt and one reconcile» — passed
- `document-review-concurrency` «document review concurrency (native PostgreSQL) > two approvals of the same revision in parallel store one review_decisions row» — passed
- `document-review-concurrency` «document review concurrency (native PostgreSQL) > one person sending two approvals with two keys stores one decision» — passed
- `document-review-concurrency` «document review concurrency (native PostgreSQL) > an approval and a changes_requested on the same revision store exactly one decision» — passed
- `document-review-concurrency` «document review concurrency (native PostgreSQL) > a decision racing a new revision proposal never lands on the newer revision» — passed
- `document-review-concurrency` «document review concurrency (native PostgreSQL) > authority lost between the read and the insert is answered APPROVER_NOT_AUTHORIZED and nothing is stored» — passed
- `review-delegations-concurrency` «delegation concurrency (native PostgreSQL) > two managers designating the same member at once store one active delegation» — passed
- `review-delegations-concurrency` «delegation concurrency (native PostgreSQL) > two managers revoking the same delegation at once store one revoke» — passed
- `suggestions-concurrency` «draft decision concurrency (native PostgreSQL) > two confirmations of one draft in parallel leave one decision and one revision» — passed
- `suggestions-concurrency` «draft decision concurrency (native PostgreSQL) > a confirmation and a rejection of one draft in parallel leave one decision; the loser answers DRAFT_ALREADY_DECIDED and no revision is orphaned» — passed
- `suggestions-concurrency` «draft decision concurrency (native PostgreSQL) > a draft confirmation racing a manual revision of the same document: one answers REVISION_CONFLICT, no decision without its revision, no revision a decision does not point to» — passed

## Truy vấn kiểm principal AI
Mức: 0 dòng; xem task-18-ai-privileges.txt

- `z4-schema` «privilege query: libetech_ai holds no INSERT, UPDATE, DELETE or TRUNCATE on any table of public, identity or analytics» — passed

## Phiếu ghi chú test_bot_bridge.py

- `tests/test_bot_bridge.py::…::test_a_ballot_with_a_document_approval_code_is_never_asked_by_the_current_plugin` — có trong mã nguồn (dòng 1592); `pytest -q` không in từng ca, tệp chạy `67 passed, 69 subtests passed` (exit 0), nên ca nằm trong số đó. Không chạy lại riêng.

## Hàng chưa làm hoặc không coi đạt

- **OQ-33 (b): điều phối dự án trình phiếu** — Chưa làm — Task 7c dừng, chờ OQ-35…OQ-38 (S66; Chairman quyết định 15/11/2026: Task 7c và bước 16b không thuộc lát 3). Các tệp `tests/doc-approval-proposal*.test.ts` và tuyến `/api/team/doc-approvals` không tồn tại, và điều đó đúng (xem `ls` ở cuối).
- **Quyền âm của OQ-33 (ghi chú 5 của phiên điều phối)** — Chưa làm — Task 7c còn dừng; `doc-approval-proposal`, `doc-approval-proposal-http`, `doc-approval-proposal-concurrency` không có.
- **OQ-35, OQ-36, OQ-37, OQ-38 (chưa quyết)** — Chưa làm — bốn ca «OQ-3x placeholder» chỉ có khi 7c mở lại; giữ chỗ fail-closed, không phải luật đã chốt.
- **Phần Telegram của mục 7 trong brief** — Chưa làm — OQ-32 (c), dời sang đợt runtime; Task 14 (phần Telegram) không thuộc lát này.
- **PM-02** — Không coi đạt: không có test; chờ tin gốc và chủ dự án xác nhận.

## Dòng JSON tổng kết eval (nguyên văn từ log native)

```
{"skills_eval":{"skills":6,"cases":30,"good_pass":30,"bad_caught":30,"model":"none (mock outputs)"}}
```

## ls (bước i)

```
$ ls tests/doc-approval-proposal*.test.ts src/app/api/team/doc-approvals
ls: src/app/api/team/doc-approvals: No such file or directory
ls: tests/doc-approval-proposal*.test.ts: No such file or directory
```
