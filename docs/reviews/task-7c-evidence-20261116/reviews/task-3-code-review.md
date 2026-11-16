# Task 3 code review (87d6f02..a350b1a), Task 7c coordinator proposal

Reviewer scope: task gate only, read-only. Source of truth: the diff file, the brief, the report. I did not re-run tests. The only code read outside the diff was the brief text itself (grep of the T7C-11 and step-7 paragraphs).

### Spec Compliance

- ✅ OQ-37 (c), src/server/accounts.ts access branch: the two checks sit after the existing frozen-set invariant and before `approvalReady`, and run only when `proposer_id` differs from the lower-cased admin id. `delta` null gives `TELEGRAM_APPROVAL_REQUIRED` with the existing sentence. `cmd.proposerIsCoordinator===actual` gives `VERSION_CONFLICT` 409 with the exact message. A missing field and a different field both fail, and an equal `false` goes through. Nothing in this path refuses because the proposer lost the role.
- ✅ Event detail: `proposedBy` is added for coordinator ballots, and `proposerNoLongerCoordinator:true` only when `actual` is false. Admin ballots and narrowing saves keep the A6 key set `['active','after','approvalId','before','previousActive','previousVersion','reason','version']`. A6 and A8 assert this on the event rows.
- ✅ The field is optional and ignored everywhere else. The branch is unreachable for admin ballots, narrowing saves and widening without a ballot. A non-boolean value is rejected by the strict schema (ZodError), asserted in A8.
- ✅ `list` returns `accessChange` per account (open means pending or approved, unexpired, frozen at the current version). Admin ballots give `proposerIsCoordinator:null`. The proposer standing is read in the same transaction that holds the admin row. `proposer_id` is not exposed.
- ✅ `proposeAccessChange` body and `cancel_access_change` are untouched, per the hunk list in the green log. Their line range 301–325 contains no hunk.
- ✅ UI: `OpenBallot` sits under the status line and above `Grants`. It has the note with `role="note"` above the apply button, the apply and cancel buttons, and the reason in `<bdi dir="auto">` as plain text. `ballotCommand` builds the bodies from the listed ballot, not from the ticked boxes. `standingEcho` goes only into the manual `access` body. `shouldReloadAccounts` reloads on any `VERSION_CONFLICT`.
- ✅ File list: `approvals.tsx` changes only `export` on `grantText`. The fixture changes only `applyFrozen`. The UI test file only gains cases (0 removed lines). No migration or `bot-plugin` change. The step-7 outputs are shown in the green log. I did not recompute them.
- ✅ Tenant isolation, Quality Gate 34a–e: no new table or access path. The new read is a scoped select in the admin transaction. A5 asserts that only the account admin may call `list`.
- ⚠️ Cannot verify from the diff: (1) the whole-suite run (62 files, 1065 tests); the diff only has the log lines. (2) The 360 px and 44 px layout checks, which the report says were not measured. (3) That the time between the standing read and the commit is closed against role changes made by login outside the app. The brief itself calls this residual.

### Strengths

- The `access` branch is small, placed exactly where the brief says, and keeps the admin-proposer path byte-for-byte as before. Mutation (d) proves this.
- The tests exercise real behaviour on a real transaction. A3 covers three ways of losing the role (demoted, removed, disabled), each in its own world, with a control apply. A7 covers both directions of a stale standing: a missing field and a wrong field both leave memberships, ballot state, event count and a full snapshot unchanged.
- Four mutations each map to a named red case, and the test text was regenerated so that the red cases are `AssertionError`, not timeouts (this follows the memory rule on red evidence).
- The proposer standing is computed by the same helper (`activeProjectRole` plus `docApprovalDelta`) in `list` and in `access`, so what the admin sees and what the server checks cannot drift apart.
- The raw U+202E was caught by the byte scan and replaced with an escape. Logs are scrubbed to `<repo>`.
- The UI builds ballot commands from server data and never from the form boxes. This respects "never accept identity from request JSON".

### Issues

#### Critical
None.

#### Important
None.

#### Minor

1. src/components/team-accounts.tsx, `OpenBallot` note condition: the note «Phiếu vẫn áp được; cân nhắc trước khi áp.» also shows on a pending coordinator ballot, where no apply button exists and the text is misleading. The report discloses this (Concern 2) and the brief's condition has no stage, so this is plan-literal. Fix: add `change.state==='approved'` to the condition, with a matching U3 case, if the Chairman agrees.
2. src/server/accounts.ts, `list`/`openAccessChange`: this adds one query per account (plus one role read per coordinator ballot), up to 200 accounts. All of them run from `Promise.all` on a single transaction client. The native PostgreSQL run in the green log prints seven pg `DeprecationWarning` lines about `client.query()` while the client is busy. The same warning is in the Task 1b and Task 2 logs, so it predates this task. The report does not mention the noise, and this change adds to the concurrency that causes it. Fix: one batched select for ballots (`subject_user_id = ANY($1)`) and sequential or batched standing reads. Or record the warning as a known item for the whole-branch review.
3. src/components/team-accounts.tsx, `submit` catch: if the reload after a `VERSION_CONFLICT` fails, `setError` replaces the original conflict message with the reload error, so the admin loses the reason for the refusal. Fix: append the reload error, or keep the first message.
4. src/components/team-accounts.tsx, form key `user.id:version` (Concern 1): a reload after the existing account-version conflict remounts the form and clears the typed reason. The standing conflict keeps it, because the version does not change. This is acceptable and disclosed. A note in the follow-up list is enough.
5. tests/doc-approver-ui.test.tsx, the last case: the `submit` and `catch` behaviour is tested by slicing source text (`indexOf('async function submit(')`, regex on `kind==='access'?standingEcho(`). This breaks on harmless reformatting and does not prove the runtime path. The pure helpers (`ballotCommand`, `standingEcho`, `shouldReloadAccounts`) are tested properly, so the gap is small. Fix when a DOM test harness exists.

### Assessment

**Task quality:** Approved.

The server logic matches T7C-11 line by line, leaves admin ballots and narrowing saves untouched, and is pinned by cases A1–A8 and four mutations. The UI builds its commands from the listed ballot. The remaining items are polish or disclosed reading choices, and none blocks the task.
