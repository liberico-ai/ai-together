# Task 5 — negative-case table, checked against both engines

Rows: 33; PASS: 33; FAIL: 0.

Sources: `task-5-native.txt` (PostgreSQL thật, `--reporter=verbose`, 1143 passed, 0 skipped) and `task-5-pglite-verbose.txt` (the same code on PGlite, verbose; the plain `npm run test` log is `task-5-pglite.txt`). Case ids W/H/A/U/P and `ca N` are resolved to full titles through the plan (`docs/plans/task-7c-coordinator-proposal.md`, the bolded titles of Tasks 1a–4); a title fragment is matched as a substring of the last segment of the test name and must hit exactly one test.

Legend: PGlite `pass` = ✓ on PGlite; `skip(native-only)` = ↓ on PGlite and the case lives in a `*-concurrency` file that is `skipIf` on the native flag; PostgreSQL thật `pass` = ✓ in the native run.

| # | Row | Result |
|---|---|---|
| 1 | A manager of project A proposes for a member of project B | **PASS** |
| 2 | Proposal for someone who is not a member | **PASS** |
| 3 | Proposal with any other widening than doc_approve:* | **PASS** |
| 4 | Self-proposal in any letter case (M1) | **PASS** |
| 5 | Resending the same proposal creates no second ballot | **PASS** |
| 6 | Removing proposer and subject seats leaves no BoM seat; error reveals nobody | **PASS** |
| 7 | A non-proposer withdraws (other manager, subject, outsider) | **PASS** |
| 8 | Proposer demoted during the proposal (M3): the first two cases of the concurrency file | **PASS** |
| 9 | Admin cancel: member account version and sessions unchanged | **PASS** |
| 10 | A non-admin calls the cancel command | **PASS** |
| 11 | Proposer lost the role, admin can still apply; /team says so first (OQ-37 c, N2) | **PASS** |
| 12 | The proposer's BoM seat does not vote on the own ballot, web and bot bridge (OQ-35 a) | **PASS** |
| 13 | Ballot says the subject is also a coordinator (OQ-38 c) | **PASS** |
| 14 | OQ-48 (b): own withdrawal re-proposes at once; cancel/reject waits 24 h | **PASS** |
| 15 | OQ-49 (a): the cancel refuses a ballot the admin proposed | **PASS** |
| 16 | OQ-50 (c) three negative cases: removed / demoted / still cannot propose; two projects; HTTP; UI | **PASS** |
| 17 | OQ-51 (b): proposer cannot withdraw an approved ballot; admin can cancel | **PASS** |
| 18 | OQ-52 (a): proposer sees the stage of the own ballot | **PASS** |
| 19 | C1: cancel / re-proposal | **PASS** |
| 20 | C2: stale standing | **PASS** |
| 21 | C3: two projects | **PASS** |
| 22 | C4: bot bridge | **PASS** |
| 23 | C5: basis forgery and name | **PASS** |
| 24 | C6: HTTP paths and 503/500 | **PASS** |
| 25 | C7: version-older ballot | **PASS** |
| 26 | C8: unique violation | **PASS** |
| 27 | C9: membership guard | **PASS** |
| 28 | C10: admin cancel racing a coordinator's proposal | **PASS** |
| 29 | C11: expired at deadline, marked later | **PASS** |
| 30 | C12 (N3): dead by account change cannot be withdrawn | **PASS** |
| 31 | C13: only the proposer's withdrawal exempts the pair | **PASS** |
| 32 | Withdraw takes the ballot id from the path only (T7C-31) | **PASS** |
| 33 | Concurrency without lock cycles: all cases of both *-concurrency files | **PASS** |

## 1. A manager of project A proposes for a member of project B — PASS

Plan reference: proposal; proposal-http

- `title` — tests/doc-approval-proposal.test.ts — full title: `propose > a manager of project A cannot propose for a member of project B`
  - PGlite: pass; PostgreSQL thật: pass
- `title` — tests/doc-approval-proposal-http.test.ts — full title: `coordinator proposal HTTP > each refusal keeps its status and code through the handler`
  - PGlite: pass; PostgreSQL thật: pass

## 2. Proposal for someone who is not a member — PASS

Plan reference: proposal

- `title` — tests/doc-approval-proposal.test.ts — full title: `propose > a proposal for someone who is not an eligible member is refused with one sentence`
  - PGlite: pass; PostgreSQL thật: pass

## 3. Proposal with any other widening than doc_approve:* — PASS

Plan reference: proposal; apply A2

- `title` — tests/doc-approval-proposal.test.ts — full title: `propose > the command cannot express any other widening, and input edges`
  - PGlite: pass; PostgreSQL thật: pass
- `title` — tests/doc-approval-proposal.test.ts — full title: `propose > the answer and the list reveal nothing outside the project`
  - PGlite: pass; PostgreSQL thật: pass
- `A2` — tests/doc-approval-apply.test.ts — full title: `the admin applies a coordinator ballot > a coordinator ballot that widens beyond doc_approve cannot be applied`
  - PGlite: pass; PostgreSQL thật: pass

## 4. Self-proposal in any letter case (M1) — PASS

Plan reference: proposal

- `title` — tests/doc-approval-proposal.test.ts — full title: `propose > a manager cannot propose for themself, in any letter case`
  - PGlite: pass; PostgreSQL thật: pass

## 5. Resending the same proposal creates no second ballot — PASS

Plan reference: proposal; proposal-concurrency

- `title` — tests/doc-approval-proposal.test.ts — full title: `propose > resending the same proposal creates no second ballot`
  - PGlite: pass; PostgreSQL thật: pass
- `title` — tests/doc-approval-proposal-concurrency.test.ts — full title: `coordinator proposal concurrency (native PostgreSQL) > two identical proposals at once store one ballot`
  - PGlite: skip(native-only); PostgreSQL thật: pass

## 6. Removing proposer and subject seats leaves no BoM seat; error reveals nobody — PASS

Plan reference: proposal

- `title` — tests/doc-approval-proposal.test.ts — full title: `propose > OQ-35 when removing the proposer's and the subject's seats leaves no BoM seat, no ballot opens and the answer does not tell who holds a seat`
  - PGlite: pass; PostgreSQL thật: pass
- `title` — tests/doc-approval-proposal.test.ts — full title: `propose > OQ-35 when the proposer is the only BoM seat able to vote, no ballot opens and the answer is the same for every subject`
  - PGlite: pass; PostgreSQL thật: pass
- `title` — tests/doc-approval-proposal.test.ts — full title: `propose > a subject who holds the only other BoM seat gets the same answer as any ineligible member`
  - PGlite: pass; PostgreSQL thật: pass

## 7. A non-proposer withdraws (other manager, subject, outsider) — PASS

Plan reference: withdraw W3; proposal-http

- `W3` — tests/doc-approval-withdraw.test.ts — full title: `withdraw > only the proposer withdraws: another manager of the project, the subject, an outsider and the account admin get the same 404`
  - PGlite: pass; PostgreSQL thật: pass
- `title` — tests/doc-approval-proposal-http.test.ts — full title: `coordinator proposal HTTP > withdraw through the handler keeps each status and code`
  - PGlite: pass; PostgreSQL thật: pass

## 8. Proposer demoted during the proposal (M3): the first two cases of the concurrency file — PASS

Plan reference: proposal-concurrency (first two cases)

- `title` — tests/doc-approval-proposal-concurrency.test.ts — full title: `coordinator proposal concurrency (native PostgreSQL) > a demotion that already holds the admin row makes the proposal wait and then see it`
  - PGlite: skip(native-only); PostgreSQL thật: pass
- `title` — tests/doc-approval-proposal-concurrency.test.ts — full title: `coordinator proposal concurrency (native PostgreSQL) > a proposal about to insert makes the admin command wait, and the ballot predates the demotion`
  - PGlite: skip(native-only); PostgreSQL thật: pass

## 9. Admin cancel: member account version and sessions unchanged — PASS

Plan reference: withdraw H1

- `H1` — tests/doc-approval-withdraw.test.ts — full title: `cancel_access_change > OQ-36 the account admin cancels a coordinator ballot with a basis; the account version and the member's sessions do not change`
  - PGlite: pass; PostgreSQL thật: pass

## 10. A non-admin calls the cancel command — PASS

Plan reference: withdraw H3

- `H3` — tests/doc-approval-withdraw.test.ts — full title: `cancel_access_change > only the account admin cancels`
  - PGlite: pass; PostgreSQL thật: pass

## 11. Proposer lost the role, admin can still apply; /team says so first (OQ-37 c, N2) — PASS

Plan reference: apply A3, A7; doc-approver-ui U3, U9

- `A3` — tests/doc-approval-apply.test.ts — full title: `the admin applies a coordinator ballot > OQ-37 a ballot whose proposer no longer coordinates the project is still applied by the admin once the list has said so`
  - PGlite: pass; PostgreSQL thật: pass
- `A7` — tests/doc-approval-apply.test.ts — full title: `the admin applies a coordinator ballot > OQ-37 a stale proposer standing is answered VERSION_CONFLICT, and after a reload the note is there and the apply goes through`
  - PGlite: pass; PostgreSQL thật: pass
- `U3` — tests/doc-approver-ui.test.tsx — full title: `open ballots on the team screen > OQ-37 a coordinator ballot whose proposer no longer coordinates says so above the apply button, and still offers it`
  - PGlite: pass; PostgreSQL thật: pass
- `U9` — tests/doc-approver-ui.test.tsx — full title: `open ballots on the team screen > OQ-37 the manual save echoes the standing too, and a VERSION_CONFLICT reloads the account list`
  - PGlite: pass; PostgreSQL thật: pass

## 12. The proposer's BoM seat does not vote on the own ballot, web and bot bridge (OQ-35 a) — PASS

Plan reference: proposal ca 6, ca 30

- `ca 6` — tests/doc-approval-proposal.test.ts — full title: `propose > OQ-35 a proposer who holds a BoM seat is not a voter of the own ballot and cannot vote on it`
  - PGlite: pass; PostgreSQL thật: pass
- `ca 30` — tests/doc-approval-proposal.test.ts — full title: `propose > OQ-35 through the bot bridge the proposer's seat neither lists nor votes on the own ballot`
  - PGlite: pass; PostgreSQL thật: pass

## 13. Ballot says the subject is also a coordinator (OQ-38 c) — PASS

Plan reference: proposal ca 15; doc-approver-ui U8; doc-approval-ui P3

- `ca 15` — tests/doc-approval-proposal.test.ts — full title: `propose > OQ-38 a co-manager of the same project can be proposed, and the ballot says so to the voters`
  - PGlite: pass; PostgreSQL thật: pass
- `U8` — tests/doc-approver-ui.test.tsx — full title: `open ballots on the team screen > OQ-38 the ballot card on /approvals shows who proposed and that the subject also coordinates, as text`
  - PGlite: pass; PostgreSQL thật: pass
- `P3` — tests/doc-approval-ui.test.tsx — full title: `the proposal block on the Review screen > P3 OQ-33 the form offers members who read in the project, never the viewer and never a read-only member; a co-manager is offered and flagged`
  - PGlite: pass; PostgreSQL thật: pass

## 14. OQ-48 (b): own withdrawal re-proposes at once; cancel/reject waits 24 h — PASS

Plan reference: proposal ca 27, 32, 33; withdraw W9, W12, H2, H7

- `ca 27` — tests/doc-approval-proposal.test.ts — full title: `propose > OQ-48 a ballot that was rejected, expired or overtaken by an account change makes the same proposer wait 24 hours from its closing for the same member`
  - PGlite: pass; PostgreSQL thật: pass
- `ca 32` — tests/doc-approval-proposal.test.ts — full title: `propose > OQ-48 a ballot that expired at its deadline and was only marked later does not block beyond 24 hours after the deadline`
  - PGlite: pass; PostgreSQL thật: pass
- `ca 33` — tests/doc-approval-proposal.test.ts — full title: `propose > OQ-48 only a withdrawal recorded by the proposer exempts the pair`
  - PGlite: pass; PostgreSQL thật: pass
- `W9` — tests/doc-approval-withdraw.test.ts — full title: `withdraw > OQ-48 after the proposer's own withdrawal the same member can be proposed again at once`
  - PGlite: pass; PostgreSQL thật: pass
- `W12` — tests/doc-approval-withdraw.test.ts — full title: `withdraw > a ballot already dead by an account change cannot be withdrawn, so a withdrawal cannot buy an immediate re-proposal`
  - PGlite: pass; PostgreSQL thật: pass
- `H2` — tests/doc-approval-withdraw.test.ts — full title: `cancel_access_change > OQ-48 after the cancel the admin proposes at once, and the proposer waits 24 hours from the cancel`
  - PGlite: pass; PostgreSQL thật: pass
- `H7` — tests/doc-approval-withdraw.test.ts — full title: `cancel_access_change > OQ-48 a cancel at hour 25 of the ballot still makes the same coordinator wait 24 hours from the cancel`
  - PGlite: pass; PostgreSQL thật: pass

## 15. OQ-49 (a): the cancel refuses a ballot the admin proposed — PASS

Plan reference: withdraw H4; doc-approver-ui U4

- `H4` — tests/doc-approval-withdraw.test.ts — full title: `cancel_access_change > OQ-49 the cancel command refuses a ballot the admin proposed`
  - PGlite: pass; PostgreSQL thật: pass
- `U4` — tests/doc-approver-ui.test.tsx — full title: `open ballots on the team screen > OQ-49 only a coordinator ballot offers Huỷ phiếu của điều phối`
  - PGlite: pass; PostgreSQL thật: pass

## 16. OQ-50 (c) three negative cases: removed / demoted / still cannot propose; two projects; HTTP; UI — PASS

Plan reference: withdraw W5, W4, W6, W10; proposal-http; doc-approval-ui P15

- `W5` — tests/doc-approval-withdraw.test.ts — full title: `withdraw > OQ-50 a proposer removed from the project can neither withdraw nor list, and gets the 404 of an unknown project`
  - PGlite: pass; PostgreSQL thật: pass
- `W4` — tests/doc-approval-withdraw.test.ts — full title: `withdraw > OQ-50 a proposer demoted but still a member of the project withdraws and lists the own ballots`
  - PGlite: pass; PostgreSQL thật: pass
- `W6` — tests/doc-approval-withdraw.test.ts — full title: `withdraw > OQ-50 a demoted or removed proposer still cannot propose a new ballot`
  - PGlite: pass; PostgreSQL thật: pass
- `W10` — tests/doc-approval-withdraw.test.ts — full title: `withdraw > OQ-50 a proposer who coordinates two projects and is demoted in one keeps the own ballot there and sees nothing of it from the other project`
  - PGlite: pass; PostgreSQL thật: pass
- `title` — tests/doc-approval-proposal-http.test.ts — full title: `coordinator proposal HTTP > GET requires projectId; a project the caller is not a member of answers the same 404 as an unknown project; a proposer demoted but still in the project still lists the own ballots`
  - PGlite: pass; PostgreSQL thật: pass
- `P15` — tests/doc-approval-ui.test.tsx — full title: `the proposal block on the Review screen > P15 OQ-50 a former coordinator who is still a member sees the own ballots and Rút phiếu, and no proposal form`
  - PGlite: pass; PostgreSQL thật: pass

## 17. OQ-51 (b): proposer cannot withdraw an approved ballot; admin can cancel — PASS

Plan reference: withdraw W2, H1; doc-approval-ui P7

- `W2` — tests/doc-approval-withdraw.test.ts — full title: `withdraw > OQ-51 (b): a ballot a BoM seat has approved cannot be withdrawn by the proposer, and the admin's cancel still closes it`
  - PGlite: pass; PostgreSQL thật: pass
- `H1` — tests/doc-approval-withdraw.test.ts — full title: `cancel_access_change > OQ-36 the account admin cancels a coordinator ballot with a basis; the account version and the member's sessions do not change`
  - PGlite: pass; PostgreSQL thật: pass
- `P7` — tests/doc-approval-ui.test.tsx — full title: `the proposal block on the Review screen > P7 OQ-51 (b): only a pending ballot offers Rút phiếu; a withdrawal needs a basis`
  - PGlite: pass; PostgreSQL thật: pass

## 18. OQ-52 (a): proposer sees the stage of the own ballot — PASS

Plan reference: proposal ca 29; doc-approval-ui P7

- `ca 29` — tests/doc-approval-proposal.test.ts — full title: `propose > listOwn returns the caller's own open ballots of that project to a caller who is still a member, whatever the role`
  - PGlite: pass; PostgreSQL thật: pass
- `P7` — tests/doc-approval-ui.test.tsx — full title: `the proposal block on the Review screen > P7 OQ-51 (b): only a pending ballot offers Rút phiếu; a withdrawal needs a basis`
  - PGlite: pass; PostgreSQL thật: pass

## 19. C1: cancel / re-proposal — PASS

Plan reference: withdraw H7; proposal ca 27

- `H7` — tests/doc-approval-withdraw.test.ts — full title: `cancel_access_change > OQ-48 a cancel at hour 25 of the ballot still makes the same coordinator wait 24 hours from the cancel`
  - PGlite: pass; PostgreSQL thật: pass
- `ca 27` — tests/doc-approval-proposal.test.ts — full title: `propose > OQ-48 a ballot that was rejected, expired or overtaken by an account change makes the same proposer wait 24 hours from its closing for the same member`
  - PGlite: pass; PostgreSQL thật: pass

## 20. C2: stale standing — PASS

Plan reference: apply A7

- `A7` — tests/doc-approval-apply.test.ts — full title: `the admin applies a coordinator ballot > OQ-37 a stale proposer standing is answered VERSION_CONFLICT, and after a reload the note is there and the apply goes through`
  - PGlite: pass; PostgreSQL thật: pass

## 21. C3: two projects — PASS

Plan reference: withdraw W10

- `W10` — tests/doc-approval-withdraw.test.ts — full title: `withdraw > OQ-50 a proposer who coordinates two projects and is demoted in one keeps the own ballot there and sees nothing of it from the other project`
  - PGlite: pass; PostgreSQL thật: pass

## 22. C4: bot bridge — PASS

Plan reference: proposal ca 30

- `ca 30` — tests/doc-approval-proposal.test.ts — full title: `propose > OQ-35 through the bot bridge the proposer's seat neither lists nor votes on the own ballot`
  - PGlite: pass; PostgreSQL thật: pass

## 23. C5: basis forgery and name — PASS

Plan reference: proposal ca 21; withdraw W8

- `ca 21` — tests/doc-approval-proposal.test.ts — full title: `propose > the basis cannot forge a line or crash the database`
  - PGlite: pass; PostgreSQL thật: pass
- `W8` — tests/doc-approval-withdraw.test.ts — full title: `withdraw > the withdrawal command is strict, takes the ballot id from its argument only, and its basis is checked like every basis`
  - PGlite: pass; PostgreSQL thật: pass

## 24. C6: HTTP paths and 503/500 — PASS

Plan reference: proposal-http

- `title` — tests/doc-approval-proposal-http.test.ts — full title: `coordinator proposal HTTP > paths under an approval id that the handler does not serve answer the common 404`
  - PGlite: pass; PostgreSQL thật: pass
- `title` — tests/doc-approval-proposal-http.test.ts — full title: `coordinator proposal HTTP > identity not configured answers 503 and an unexpected failure answers 500, both through the handler and both no-store`
  - PGlite: pass; PostgreSQL thật: pass

## 25. C7: version-older ballot — PASS

Plan reference: withdraw H8; withdraw-concurrency

- `H8` — tests/doc-approval-withdraw.test.ts — full title: `cancel_access_change > a ballot frozen at an older account version cannot be cancelled`
  - PGlite: pass; PostgreSQL thật: pass
- `title` — tests/doc-approval-withdraw-concurrency.test.ts — full title: `withdraw and cancel concurrency (native PostgreSQL) > a cancel and a vote on a ballot frozen at an older version do not deadlock`
  - PGlite: skip(native-only); PostgreSQL thật: pass

## 26. C8: unique violation — PASS

Plan reference: proposal ca 31

- `ca 31` — tests/doc-approval-proposal.test.ts — full title: `propose > a unique violation is answered APPROVAL_PENDING only for the one-open-ballot index`
  - PGlite: pass; PostgreSQL thật: pass

## 27. C9: membership guard — PASS

Plan reference: withdraw W11

- `W11` — tests/doc-approval-withdraw.test.ts — full title: `withdraw > the membership guard refuses a document-approval code whose only ballot was withdrawn`
  - PGlite: pass; PostgreSQL thật: pass

## 28. C10: admin cancel racing a coordinator's proposal — PASS

Plan reference: withdraw-concurrency

- `title` — tests/doc-approval-withdraw-concurrency.test.ts — full title: `withdraw and cancel concurrency (native PostgreSQL) > an admin cancel racing a coordinator's proposal for the same member leaves at most one open ballot`
  - PGlite: skip(native-only); PostgreSQL thật: pass

## 29. C11: expired at deadline, marked later — PASS

Plan reference: proposal ca 32

- `ca 32` — tests/doc-approval-proposal.test.ts — full title: `propose > OQ-48 a ballot that expired at its deadline and was only marked later does not block beyond 24 hours after the deadline`
  - PGlite: pass; PostgreSQL thật: pass

## 30. C12 (N3): dead by account change cannot be withdrawn — PASS

Plan reference: withdraw W12; withdraw-concurrency

- `W12` — tests/doc-approval-withdraw.test.ts — full title: `withdraw > a ballot already dead by an account change cannot be withdrawn, so a withdrawal cannot buy an immediate re-proposal`
  - PGlite: pass; PostgreSQL thật: pass
- `title` — tests/doc-approval-withdraw-concurrency.test.ts — full title: `withdraw and cancel concurrency (native PostgreSQL) > an admin change to the subject racing a withdrawal is seen by it`
  - PGlite: skip(native-only); PostgreSQL thật: pass

## 31. C13: only the proposer's withdrawal exempts the pair — PASS

Plan reference: proposal ca 33

- `ca 33` — tests/doc-approval-proposal.test.ts — full title: `propose > OQ-48 only a withdrawal recorded by the proposer exempts the pair`
  - PGlite: pass; PostgreSQL thật: pass

## 32. Withdraw takes the ballot id from the path only (T7C-31) — PASS

Plan reference: withdraw W8; proposal-http

- `W8` — tests/doc-approval-withdraw.test.ts — full title: `withdraw > the withdrawal command is strict, takes the ballot id from its argument only, and its basis is checked like every basis`
  - PGlite: pass; PostgreSQL thật: pass
- `title` — tests/doc-approval-proposal-http.test.ts — full title: `coordinator proposal HTTP > withdraw takes the ballot id from the path only`
  - PGlite: pass; PostgreSQL thật: pass

## 33. Concurrency without lock cycles: all cases of both *-concurrency files — PASS

Plan reference: both concurrency files

- `title` — tests/doc-approval-proposal-concurrency.test.ts — full title: `coordinator proposal concurrency (native PostgreSQL) > a demotion that already holds the admin row makes the proposal wait and then see it`
  - PGlite: skip(native-only); PostgreSQL thật: pass
- `title` — tests/doc-approval-proposal-concurrency.test.ts — full title: `coordinator proposal concurrency (native PostgreSQL) > a proposal about to insert makes the admin command wait, and the ballot predates the demotion`
  - PGlite: skip(native-only); PostgreSQL thật: pass
- `title` — tests/doc-approval-proposal-concurrency.test.ts — full title: `coordinator proposal concurrency (native PostgreSQL) > the frozen grants are the grants the ballot was built from`
  - PGlite: skip(native-only); PostgreSQL thật: pass
- `title` — tests/doc-approval-proposal-concurrency.test.ts — full title: `coordinator proposal concurrency (native PostgreSQL) > the admin as subject is refused without touching a lock`
  - PGlite: skip(native-only); PostgreSQL thật: pass
- `title` — tests/doc-approval-proposal-concurrency.test.ts — full title: `coordinator proposal concurrency (native PostgreSQL) > two identical proposals at once store one ballot`
  - PGlite: skip(native-only); PostgreSQL thật: pass
- `title` — tests/doc-approval-proposal-concurrency.test.ts — full title: `coordinator proposal concurrency (native PostgreSQL) > two managers proposing for the same member at once store one ballot`
  - PGlite: skip(native-only); PostgreSQL thật: pass
- `title` — tests/doc-approval-proposal-concurrency.test.ts — full title: `coordinator proposal concurrency (native PostgreSQL) > OQ-38 two co-managers proposing for each other at once both succeed without a deadlock`
  - PGlite: skip(native-only); PostgreSQL thật: pass
- `title` — tests/doc-approval-proposal-concurrency.test.ts — full title: `coordinator proposal concurrency (native PostgreSQL) > OQ-38 a co-manager's proposal waits for the other's row locks and then succeeds`
  - PGlite: skip(native-only); PostgreSQL thật: pass
- `title` — tests/doc-approval-proposal-concurrency.test.ts — full title: `coordinator proposal concurrency (native PostgreSQL) > a unique-index conflict is answered APPROVAL_PENDING`
  - PGlite: skip(native-only); PostgreSQL thật: pass
- `title` — tests/doc-approval-withdraw-concurrency.test.ts — full title: `withdraw and cancel concurrency (native PostgreSQL) > two withdrawals at once write one event`
  - PGlite: skip(native-only); PostgreSQL thật: pass
- `title` — tests/doc-approval-withdraw-concurrency.test.ts — full title: `withdraw and cancel concurrency (native PostgreSQL) > a withdrawal racing a vote never drops the vote silently`
  - PGlite: skip(native-only); PostgreSQL thật: pass
- `title` — tests/doc-approval-withdraw-concurrency.test.ts — full title: `withdraw and cancel concurrency (native PostgreSQL) > a withdrawal racing the admin's cancel writes one closing event`
  - PGlite: skip(native-only); PostgreSQL thật: pass
- `title` — tests/doc-approval-withdraw-concurrency.test.ts — full title: `withdraw and cancel concurrency (native PostgreSQL) > an admin command on the proposer racing a withdrawal never deadlocks`
  - PGlite: skip(native-only); PostgreSQL thật: pass
- `title` — tests/doc-approval-withdraw-concurrency.test.ts — full title: `withdraw and cancel concurrency (native PostgreSQL) > an admin cancel racing a coordinator's proposal for the same member leaves at most one open ballot`
  - PGlite: skip(native-only); PostgreSQL thật: pass
- `title` — tests/doc-approval-withdraw-concurrency.test.ts — full title: `withdraw and cancel concurrency (native PostgreSQL) > a cancel and a vote on a ballot frozen at an older version do not deadlock`
  - PGlite: skip(native-only); PostgreSQL thật: pass
- `title` — tests/doc-approval-withdraw-concurrency.test.ts — full title: `withdraw and cancel concurrency (native PostgreSQL) > an admin change to the subject racing a withdrawal is seen by it`
  - PGlite: skip(native-only); PostgreSQL thật: pass

## Tenant isolation 34a–e (fix wave)

Added by the fix wave after the tier-1 whole-branch reviews (code review I-1, security review F1, database review P3-6). Sources: `final-fix-wave-native.txt` (PostgreSQL thật, `--reporter=verbose`) and `final-fix-wave-pglite.txt` (`npm run test`, PGlite), with a PGlite `--reporter=verbose` run of the cited files for the per-case marks (a run of the four cited files, `npx vitest run --reporter=verbose` with the native variables unset: 4 files passed, 43 passed | 2 skipped (45); the 2 skips are the native-only `slice1-harness` blocks `native` and `native reset`; not saved as a separate log). In both engines tenant B is `ids.otherTenant` with project `ids.otherProject`; its ballots are real `access_change` ballots built by `DocApprovalProposalService.propose` of tenant B, one `pending` and one `approved` by a tenant-B BoM seat.

| Dim | What is checked | Case title(s) (file › describe › title) | PGlite | PostgreSQL thật |
|---|---|---|---|---|
| 34a read | `listOwn` and the admin `list` (`openAccessChange`) omit tenant B's ballots and accounts; inside `IdentityService.scope` of tenant A, `SELECT count(*) FROM identity.account_approvals WHERE id=$1` with tenant B's ids is 0 while the operator sees 1 (the mutation-checked read, `final-fix-wave-mutation.txt`); a tenant-B `access_change_withdrawn` event does not exempt tenant A's pair from the P14 wait, the same event in tenant A does; another tenant reads 0 rows of each of the four 009 tables, tenant A reads its own rows only, the business runtime has no access | `tests/doc-approval-isolation.test.ts` › tenant isolation of the coordinator ballot paths (database layer) › `34a listOwn, the admin list (openAccessChange) and a read inside IdentityService.scope show none of tenant B's ballots`; › `34a a tenant-B access_change_withdrawn event naming tenant A's cancelled ballot and its proposer does not exempt the pair from the 24-hour wait; the same event in tenant A does`; › `34a every ballot table of migration 009 isolates tenant: another tenant reads 0 rows of each, and the business runtime has no access` | pass (3 of 3) | pass (3 of 3) |
| 34b write | Pointer to existing cases, no new case. The coordinator path's inserts into the 009 tables and `identity.events` (`src/server/doc-approval-proposals.ts:158-170`, `:247-248`) take `tenant_id` from `IdentityService.tenantId`, the admin path's (`src/server/accounts.ts:320-325`) from the session principal's `tenantId`; none from a body (#fact, code). The catalog case pins `WITH CHECK` (and `USING`, ENABLE, FORCE) on `identity.account_approvals` only, which it lists because migration 018 widens it (shape, not effect); for the other three 009 tables the same policy comes from the loop at `migrations/009_telegram_account_approval.sql:57-60`, with no catalog case. The proposal case refuses a real foreign-tenant account as subject with the one INELIGIBLE sentence (application guard over an RLS-hidden row). No branch case attempts an INSERT with another tenant's `tenant_id` into the 009 tables under `libetech_identity`. | `tests/rls-catalog.test.ts` › `migrations from 013 create tables, and every one has FORCE RLS plus USING and WITH CHECK from the catalog`; `tests/doc-approval-proposal.test.ts` › propose › `a proposal for someone who is not an eligible member is refused with one sentence` | pass (both pointer cases) | pass (both pointer cases) |
| 34c update/delete | `withdraw` by tenant A's coordinator on tenant B's pending and approved ballot ids answers exactly the refusal of an unknown id (`SCOPE_DENIED` 404); the admin `cancel_access_change` answers `APPROVAL_NOT_FOUND` 404 through a tenant-A account and `ACCOUNT_SCOPE_DENIED` 404 through the tenant-B account; afterwards, as the operator, tenant B's ballots keep `state`, `subject_account_version` and `updated_at`, its accounts keep `account_version`, its `identity.events` count is unchanged and no closing event names its ballots | `tests/doc-approval-isolation.test.ts` › tenant isolation of the coordinator ballot paths (database layer) › `34c withdraw and the admin cancel aimed at tenant B's pending and approved ballots answer the refusal of an unknown id, and leave tenant B's ballots, account versions and events unchanged` | pass | pass |
| 34d no context | A transaction with `SET LOCAL ROLE libetech_identity` and no `app.tenant_id` reads each of the four 009 tables: **0 rows, no error** (the operator sees rows in each) | `tests/doc-approval-isolation.test.ts` › tenant isolation of the coordinator ballot paths (database layer) › `34d with no tenant context the four ballot tables of migration 009 return 0 rows under libetech_identity, not every row (rows, no error)` | pass (0 rows, no error) | pass (0 rows, no error) |
| 34e bypass | Pointer to the existing native case on the runtime login (not superuser, not BYPASSRLS). Behaviourally, the 34a read (f) and the 34d case run under `SET LOCAL ROLE libetech_identity` and see no foreign row on both engines, which a `libetech_identity` holding BYPASSRLS would fail (#inference). Caveat: `migrations/002_identity.sql:4-8` creates `libetech_identity` NOBYPASSRLS only when the role does not exist yet, and no case asserts `rolbypassrls=false` for that role itself (follow-up of the code review, not in this wave). | `tests/slice1-harness.test.ts` › native › `runtime login is not superuser and cannot bypass RLS` (native-only); plus the 34a and 34d titles above | harness case skip(native-only); 34a and 34d cases pass | pass (harness case, 34a and 34d cases) |
