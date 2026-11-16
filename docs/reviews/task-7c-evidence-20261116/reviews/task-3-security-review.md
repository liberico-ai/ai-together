# Security review: Task 7c, Task 3 (commit `a350b1a`, base `87d6f02`)

Verdict: PASS

- Reviewer role: security reviewer, advisory only. The Chairman approves merges. This is the task-scoped gate for Task 3; a whole-branch review comes later.
- Counts: Critical 0 · Important 0 · Minor 2. Eight notes follow that are not findings. Scale: Critical = P0, Important = P1, Minor = P2.
- Method: read-only.
  - Inputs I read:
    - the brief (`.superpowers/sdd/task-7c-coordinator-proposal/task-3-brief.md`): Global Constraints, the error table, T7C-5, T7C-9, T7C-11, T7C-15, T7C-20, T7C-21 and the Task 3 section;
    - the implementer report (`task-3-report.md`), treated as unverified claims, and the review package `review-87d6f02..a350b1a.diff`;
    - N2 of plan gate round 1 (`gates/security-gate-plan-round-1.md`), and the Task 2 security review, for its layout and its F1 lock pattern.
  - Code I read at HEAD:
    - `src/server/accounts.ts` in full, and `access-grants.ts` (`widensAccess`, `docApprovalDelta`);
    - `identity.ts`: `scope`, `grants`, `activeProjectRole`, `principal`, `login`, `activate`;
    - `account-approval.ts`: `approvalReady`;
    - `doc-approval-proposals.ts`, the withdraw lock block only;
    - `auth.ts`, `auth-http.ts` (cookie attributes), `http.ts`, `db.ts`;
    - the route `src/app/api/team/accounts/route.ts` and the page `src/app/team/page.tsx`;
    - `src/components/team-accounts.tsx`, `approvals.tsx` and `api.ts`;
    - migrations 002, 009 and 018.
  - Tests: I read `tests/doc-approval-apply.test.ts` in full, plus the additions to `tests/doc-approver-ui.test.tsx` and `tests/doc-approval-fixtures.ts`.
  - I ran no test, native or PGlite. Every check below comes from code reading, git output or the committed evidence logs.
  - I wrote only this file. Function-body comparisons went to the session scratchpad, outside the repo.
- Line numbers are at HEAD `a350b1a`, clean working tree. `A…` means `src/server/accounts.ts` and `T…` means `src/components/team-accounts.tsx`.
- Tags: `#fact` means I read it in code or command output. `#inference` means I reasoned it from code and did not execute it.

## Step 0: secrets scan

- `git ls-files | grep -Ei '\.env|secret|credential|key|token'` returns no match (exit 1). `#fact`
- History of env-pattern paths: `git log --all -- '*.env' '.env*'` touches only `.env.example`, in three commits. I did not open that file. `#fact`
- The commit changes eight files: one in `src/server`, two in `src/components`, three test files and the two evidence logs (`git diff --numstat`: `accounts.ts` 45/5, `team-accounts.tsx` 62/4, `approvals.tsx` 1/1, `doc-approval-fixtures.ts` 4/1). `#fact`
- I scanned all eight for:
  - URLs and connection strings;
  - home, tmp and private paths;
  - JWT shapes and bot-token shapes;
  - runs of seven or more digits.

  Results: `#fact`
  - The logs show `<repo>` in place of the checkout path. They name the env file only as `$TASK7C_ENV_FILE` (`task-3-green.txt:15`).
  - The only long identifiers are fixed synthetic UUIDs (`11000000-…`) in `task-3-red.txt`. Process ids also appear in the logs, as `node:13327` and similar.
  - No credential-like word appears in either log. The test fixtures use `'fixture-hash'` and synthetic names («Thành viên mẫu», «Điều phối mẫu»).
- Hidden characters: a perl scan for U+200B–U+200F, U+202A–U+202E, U+2066–U+2069, U+2028, U+2029, U+FEFF, U+00AD, CR and C0/C1 controls returns 0 in every changed file. U6 writes its override as the escape `\u202E` (implementer concern 3, verified). `#fact`
- Files that must not change:
  - `git diff --name-only 679ff6c a350b1a -- migrations src/server/account-approval.ts bot-plugin AGENTS.md CLAUDE.md` is empty.
  - `proposeAccessChange` is byte-identical at `679ff6c`, `87d6f02` and `a350b1a` (`cmp`, 25 lines).
  - `cancelAccessChange` is identical at base and HEAD (same md5). `#fact`

## Findings

| # | Severity | Location | Class | Evidence | Recommended fix | Owner |
|---|---|---|---|---|---|---|
| F1 | Minor (P2) | `T192`, `T68-71`, `T126-135` | Approval integrity: implicit form submission fires a ballot action | JSX order: the ballot buttons are now the first submit buttons of the account form; `submit` acts on `submitter.value` | Neutralise implicit submission in the account form (a disabled default button first), or make the two ballot buttons `type="button"`; add one UI case | Builder; Chairman approves |
| F2 | Minor (P2) | `tests/doc-approval-apply.test.ts:222-223`; gate at `A58` | Test coverage for AR-06 / Quality Gate 34a on the new read and apply paths | No account test sends the admin's id under another tenant | Add `{...w.admin,tenantId:ids.otherTenant}` to A5's refusal loop, and one apply attempt under that principal | Builder |

### F1: pressing Enter in the account form now applies or cancels the open ballot

What the code does (`#fact`):
- `OpenBallot` sits at `T192`, directly under the status line. That is before `<Grants>`, the GitHub `<details>` (`T194-199`), the «Lý do thay đổi» input (`T200`) and the action row (`T201-207`). The brief requires this placement.
- When the ballot is `approved`, its first button is `type="submit" value="apply_frozen"` (`T69`). When it is a coordinator ballot, the next button is `type="submit" value="cancel_access_change"` (`T70`).
- `submit` takes the action from `(event.nativeEvent as SubmitEvent).submitter.value` (`T126-127`). For either ballot value it sends `ballotCommand(...)` (`T131-135`).
- The form has three text inputs: `reason` (`T200`) and, for an active and activated account, `githubId` and `sourceId` (`T195-196`).

Consequence (`#inference`, from the HTML rule for implicit submission; not run in a browser):
- A form's default button is its first submit button in tree order. Pressing Enter in one of its text inputs fires a click on that button, unless the button is disabled.
- After this task, that button is `apply_frozen` for any account with an approved ballot, whoever proposed it. For an account with a pending coordinator ballot, it is `cancel_access_change`.
- Before this task, for an active and activated account, the default button was `verify_github` inside the `<details>`. With the `sourceId` field empty, that command fails `z.url` with a 422, so it was harmless. For other accounts it was the first `AccessActions` button, and the server refuses an unapproved widening.
- Example:
  1. The admin opens an account to revoke its sessions or to disable it.
  2. The admin types the required reason and presses Enter.
  3. Result A: a coordinator's ballot is cancelled. That starts the 24-hour pair wait (OQ-48 b) and discards the BoM vote.
  4. Result B: the frozen grants are applied. Applying also revokes the member's sessions and consumes their Telegram codes (`A263-273`). The member can then approve canonical revisions.
- In result B, OQ-33 (b) makes the admin the final human gate, and OQ-37 (c) adds «cân nhắc trước khi áp». A keypress passes that gate without a deliberate click.
- The server still checks everything: the frozen set, the version, the echo and the tally. Nothing is widened beyond what a BoM seat approved.

Why P2 and not P1:
- Only the account admin can trigger it, on the admin's own page.
- There is no privilege escalation beyond the approved ballot.
- Both results can be undone: narrow with a direct save, or re-propose (the admin path has no pair wait).

The registration form has the same pre-existing pattern (`T173-177`): Enter in «Căn cứ» on an approved registration fires «Tạo lời mời». That form is outside this task.

Recommended fix (Builder; the layout the brief requires is unchanged; the Chairman approves):
1. Make the account form's first child a submit button that is never enabled, for example `<button type="submit" disabled hidden aria-hidden="true" tabIndex={-1}/>`. Implicit submission does nothing when the default button is disabled, and every visible button keeps working on click.
2. Alternatively, give the two `OpenBallot` buttons `type="button"` and an `onClick` that runs the same `submit` path with the action passed explicitly. Then `requestSubmit` or a shared handler supplies the reason.
3. Add one case to `tests/doc-approver-ui.test.tsx`, in the repo's source-reading style: in the account form's markup, the first `<button` that can submit is the disabled guard, or is not `apply_frozen` or `cancel_access_change`.
4. Optionally, apply the same guard to the registration form.

### F2: the foreign-tenant refusal of `list` and of the new apply branch is not pinned by a test

- The gate exists. `operator` refuses `p.tenantId!==this.identity.tenantId`, the bot and any id other than `adminId` (`A58-59`). `list` and `command` both call it first (`A72`, `A217`). `#fact`
- The data behind the gate is tenant-scoped. `scope` sets the role `libetech_identity`, which is `NOBYPASSRLS` (`migrations/002_identity.sql:6`). It also sets `app.tenant_id` with `set_config(…,true)`, which is transaction-local (`identity.ts:22-23`). `#fact`
  - `account_approvals` has `ENABLE` + `FORCE` with `USING` and `WITH CHECK` (`009:56-63`). `users` and `memberships` have `ENABLE` + `FORCE` with `USING` (`002:66-73`).
  - `activeProjectRole` also filters `u.tenant_id` explicitly (`identity.ts:49`).
  - Without the setting the policy compares with NULL, so a query with no tenant context fails closed.
- What is missing (`#fact`):
  - A5 checks the coordinator, the subject and `{...w.admin,role:'bot'}` (`tests/doc-approval-apply.test.ts:222-223`), but not the admin's own id under another tenant.
  - No other account test file has that case. A grep for `otherTenant` across every test file that drives `AccountService` finds it only on the coordinator paths of Tasks 1 and 2 (`doc-approval-proposal.test.ts:438`, `doc-approval-withdraw.test.ts:260`, `doc-approval-proposal-http.test.ts:130`) and in a database-guard case (`doc-approver-grant.test.ts:193-199`).
- So the `p.tenantId` clause of `operator` is not pinned anywhere. This task puts new ballot data and a new apply branch behind it.
- Fix:
  1. Add `{...w.admin,tenantId:ids.otherTenant} as Principal` to A5's loop, expecting `ACCOUNT_ADMIN_REQUIRED`.
  2. In A7, send one `access` with that principal before the real apply, and assert that `snapshot(w)` is unchanged.
  3. Run mutation «drop `p.tenantId===this.identity.tenantId` from `operator`» once and see it go red.

## Checks against the brief

### 1. Authorization of `list` and `accessChange`

- **Admin only.**
  - `list` calls `operator` before any read (`A72`). The route takes the principal from the session cookie only (`src/app/api/team/accounts/route.ts:9`, `authenticatedPrincipal`). The page renders only when `principal.accountAdmin` (`src/app/team/page.tsx:20`).
  - The bot principal and non-admins get `ACCOUNT_ADMIN_REQUIRED` (A5). Another tenant is refused by the same gate (see F2 for the missing case). `#fact`
- **No bridge path.** Only `src/app/team/page.tsx` and the routes `api/team/accounts` and `api/team/registrations` construct `AccountService` (grep over `src` and `bot-plugin`). `bot-plugin/` is unchanged. So the bot cannot reach `accessChange` through the bridge. `#fact`
- **CSRF on GET.** `GET /api/team/accounts` has no origin check. The session cookie is `SameSite=Strict` (`src/server/auth-http.ts:15`), so a cross-site page cannot make the admin's browser run `list`. Every answer carries `no-store` (`src/server/http.ts:8`). `#fact`
- **What the response adds (E-SEC-01):**
  - `approvalId`, `state`, `reason`, `expiresAt`, the frozen `grants` and `previousGrants`, `viaProjectManager` and `proposerIsCoordinator` (`A100-101`).
  - It does not add `proposer_id`, voters, seats, votes or any username.
  - The admin already sees the account's grants, and `list` only returns accounts whose memberships are all inside the admin's scope (`A73-76`). So the frozen `previousGrants`, taken at the same account version, are inside it too.
  - A project id that is not in the admin's workspace is shown as the id, never as a name (`T56`). `#fact`

### 2. Identity source and the echo

- Actor and tenant come only from the session. `command` has no actor or tenant field, and every member of `commandSchema` is `.strict()` (`A18-32`). `#fact`
- `proposerIsCoordinator` is `z.boolean().optional()` on `access` only (`A22`). Any other kind that carries it fails `.strict()` with a `ZodError`, and so does a non-boolean (`'yes'`, `null`, `1`, `'true'`: A8). `#fact`
- **The echo can only refuse.** The two new checks run only inside the existing `widensAccess` branch, after the existing frozen-set invariant (`A243-245`), and only for a ballot whose proposer is not the admin (`A247`).
  - (1) `delta` null gives `TELEGRAM_APPROVAL_REQUIRED` (`A249-250`).
  - (2) `cmd.proposerIsCoordinator===actual`, or `VERSION_CONFLICT` (`A253-254`).
  - Neither check makes anything pass that failed before this task. A missing field (`undefined`) never equals a boolean, and an equal value only lets through the apply that the code before this task already allowed.
  - Mutations (a) to (d) in the report each turned red the case they target (`task-3-green.txt`, step 6). `#fact`
- **Admin ballots.** The branch at `A247` does not run, so the field is ignored (A6, three variants, exact key set). Mutation (d) shows that running it there turns A6 red. `#fact`

### 3. TOCTOU and lock order (T7C-5)

- The apply path, in order (`#fact`):
  1. admin row `FOR UPDATE` (`A60`);
  2. target row `FOR UPDATE` (`A223`);
  3. plain read of the ballot (`A240-242`);
  4. plain read of the proposer's standing (`A253`, `activeProjectRole`, "Plain read, no lock" at `identity.ts:44-45`);
  5. ballot row `FOR UPDATE` (`approvalReady`, `account-approval.ts:96-97`);
  6. the writes.

  That is the T7C-5 order (admin → account → ballot). The new read takes no lock, so it adds no lock pairing.
- **No application write can slip between the read and the commit** (`#inference` from the code; no native race case covers it, and none is needed for the reason below):
  - Memberships are written only by `setGrants` (`A192-198`).
  - `users.active` and `account_version` are written only by `A284-285`. Both run inside `command`, after `operator`'s `FOR UPDATE` on the admin row.
  - `users.role` is never updated (grep `UPDATE identity.users`).
  - `password_hash` is written only by `activate` (`identity.ts:136`), and only where it `IS NULL`. A proposer who once coordinated is already activated, so activation cannot flip their standing.
  - The memberships foreign key to `projects` has no `ON DELETE CASCADE` (`002:20-21`).
  - So the only application actor who can change the standing is the admin, through the same `FOR UPDATE`. The apply and the change are fully serialized.
  - The residual is the one T7C-11 names: a change made through the operational login.
- **Isolation level.** The argument holds because transactions run at READ COMMITTED (a plain `BEGIN`, `db.ts:44`). Under REPEATABLE READ the snapshot would be taken at `set_config` (`identity.ts:23`), before the admin lock is granted. The standing read could then be stale while the echo still matched it. See Note 2. `#inference`
- **`list` consistency.** `list` computes the standing in the same way (`A97-98`), inside its own transaction, which holds the same admin row lock (`A72`). `#fact`
- **Lock hold and availability (the Task 2 F1 pattern).** Not reproduced here. `#inference` from code:
  - The extra work runs only in the admin's own `list` transaction.
  - Per account it adds one ballot read, which can use `account_approvals_subject` or the partial unique index `account_approval_active_access_change` (`018:30`, `018:32-33`). It adds at most one role read, because the unique index allows at most one open ballot per account.
  - The cap is therefore 200 + 200 small reads on top of the earlier 2 × 200. A coordinator cannot raise the count: the 10-per-hour throttle and the one-open-ballot rule bound it, and closed ballots are filtered out.
  - No non-admin can start `list` (`operator`; SameSite=Strict). So no non-admin gains a lock-holding loop.
  - The cost is a longer admin-row hold per `list`, at most about twice as long. Coordinator `propose` and `withdraw` wait on it through their first `KEY SHARE`. That is the latency coupling T7C-5 (h) accepts, with no cycle.
  - `/team` reloads `list` after each command and after a `VERSION_CONFLICT` (`T146`, `T153`). It does not poll.

### 4. Ballot integrity

- **One path applies an `access_change` ballot:** `A257-258`. `approvalReady` requires `kind` to match (`account-approval.ts:98`). Activation accepts only `kind='registration'` (`identity.ts:120`). `#fact`
- **Exactly the frozen set.**
  - `sameGrants(ballot.grants, cmd.grants)` and `sameGrants(ballot.previous_grants, before)` (`A243-244`) together bind the applied change to the ballot.
  - For a coordinator ballot, `docApprovalDelta` then requires that this change adds only `doc_approve:*` codes, in one existing project, with the same roles and nothing else (`access-grants.ts:33-50`).
  - `grants` and `proposer_id` cannot be changed after insert: the role has `UPDATE(state,updated_at)` only (`009:69`).
  - A2 covers a widening coordinator ballot with all three echo shapes and a control with the admin as proposer. `#fact`
- **The UI cannot build a ballot command from ticked boxes.**
  - For either ballot value, `submit` uses `ballotCommand(kind,{…,accessChange:change},reason)`. `change` is the server's `user.accessChange` (`T131-135`); `readGrants` is computed but not used on that path.
  - U5 pins both bodies' key sets. A forged body still meets every server check. `#fact`
- **Admin ballots.** Behaviour is unchanged apart from one more selected column (`A240`). `#fact`

### 5. Audit

- **Admin ballots.** `...proposerDetail` is `undefined` for admin ballots and for narrowings, so it adds no key (`A232`, `A292`). A6 pins the exact eight keys, and A8 pins the narrowing set without `approvalId`. `#fact`
- **Coordinator ballots.** They add `proposedBy` and, only when the standing read was `false`, `proposerNoLongerCoordinator:true` (`A255`). A1, A3 and A7 cover this. `#fact`
- **Refusals write nothing.** A refused apply (`VERSION_CONFLICT` or `TELEGRAM_APPROVAL_REQUIRED`) throws before `approvalReady` and rolls back. A7 asserts zero new `account_access` events and an unchanged `snapshot`. `#fact`
- **Immutability is unchanged.**
  - The trigger refuses UPDATE and DELETE on `identity.events` (`002:92-93`).
  - The role has `INSERT` there and no `UPDATE` (`002:88-90`: `events` is in the `INSERT` list only).
  - The event is written in the same transaction as the apply (`A290`). `#fact`

### 6. UI

- **XSS.** Every person-written value renders as a React text child. `reason` is inside `<bdi dir="auto">` (`T65`). Project names go through `grantText`, which builds a template string that is rendered as text. Neither file uses `dangerouslySetInnerHTML`, and U7 greps for it. U6 renders `<script>` and U+202E (as an escape) and finds them escaped inside the `bdi`. `#fact`
- **Bidi.**
  - Coordinator reasons pass the `[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]` class at propose time.
  - Admin-proposed reasons use the shared `reason` schema (`A16`), which has no character class, so they could hold an override.
  - `<bdi>` is an isolate, and an isolate closes any embedding or override left open inside it. Such text can reorder only itself, not the «Căn cứ:» label or the buttons. It is also the admin's own text, shown to the admin. `#inference`
- **T7C-21 residual.** On `/team` a user-chosen proposer name can still open the frozen reason. But the line «Phiếu này do điều phối dự án trình…» (`T66`) comes from the server's `viaProjectManager`, outside the reason. A name that imitates the admin is therefore contradicted on this screen. `#fact`
- **The screen computes no right.** The stage, `viaProjectManager` and `proposerIsCoordinator` come from `accessChange`. `standingEcho` sends only the server's boolean (`T76-79`). Whenever the echo is `false`, `OpenBallot` is rendered with the note (`T67`), because `proposerIsCoordinator` is a boolean only when `viaProjectManager` is true (`A95-99`). `#fact`
- **Reload on conflict.** `shouldReloadAccounts` is true for `ApiError` `VERSION_CONFLICT` only (`T89-91`). The catch reloads the list (`T153`). A failed reload leaves the stale page, and the next apply fails closed again. `#fact`
- **Type import.** `import type { OpenAccessChange } from '@/server/accounts'` (`T5`) is erased at compile time. No server module enters the client bundle through it, and `tests/rsc-boundary.test.ts` is green in the step 5 list. `#fact` for the log, `#inference` for the bundling.
- **Enter key:** see F1.

### 7. Tenant isolation (AR-06, Quality Gate 34a–e) for the new read

- 34a, read: the new reads are `openAccessChange` (`A88-90`) and `activeProjectRole`. Both run inside `scope` under RLS on `account_approvals`, `users` and `memberships`. `subject_user_id` comes from the RLS-scoped user list, and `users.id` is a global primary key. So a ballot of another tenant cannot name this tenant's user (the subject foreign key is `(subject_user_id,tenant_id)`, `018:25-27`). `#fact` and `#inference`
- 34b and 34c, write and delete: no new write path. The apply writes are the existing ones.
- 34d, no context: `nullif(current_setting('app.tenant_id',true),'')::uuid` is NULL without context, so the query fails closed (`002:71`, `009:60-62`). `#fact`
- 34e, bypass: `libetech_identity` is `NOBYPASSRLS` (`002:6`), and every table involved is `FORCE`. `#fact`
- Test gap: F2.

### 8. Public repo

- Step 0 found no secret, no local path, no real id or token, and no hidden character.
- Both logs scrub the checkout path. The env file appears only by variable name. Fixtures are synthetic.

## Notes (not findings)

1. **Implementer concerns.**
   - Concern 7 is accurate. Lock-hold analysis: §3.
   - Concern 3 is verified: the scan finds 0 raw characters.
   - Concerns 1, 2, 4, 5, 6 and 8 raise no security issue.
     - Concern 1 (a reload clears the typed reason after an account-version conflict) is UX only, and better than the earlier state, where the stale form kept failing.
     - Concern 5 (`VERSION_CONFLICT` before `APPROVERS_CHANGED`) only changes which refusal the admin sees first. The admin then sees the other refusal after the reload.
2. **READ COMMITTED.** The withdraw path records its isolation assumption in a comment (`src/server/doc-approval-proposals.ts:238-239`). The apply comment at `A251-252` says only that the read sits under the admin row lock. One more clause there would keep the two guards documented alike: «under READ COMMITTED (`db.ts:44`); under REPEATABLE READ this read must lock or the echo can match a stale value».
3. **A tampered coordinator ballot is shown as «still applicable».**
   - For a coordinator ballot whose `delta` is null, `list` returns `proposerIsCoordinator:false` (`A98`). `/team` then shows «Phiếu vẫn áp được; cân nhắc trước khi áp.» and an apply button. The server always refuses that apply with `TELEGRAM_APPROVAL_REQUIRED` (`A250`), so this fails closed.
   - Such a row cannot come from the application, because the coordinator path computes the same delta on the same frozen values. It can come only from the operational login (the A2 scenario).
   - A distinct flag, or hiding the apply button for such a row, would turn the misleading text into a tamper signal. This is optional hardening, and it changes the `OpenAccessChange` contract, so it is the planner's call.
4. **Admin rotation** (extends Task 2's Note 3). If `adminId` changes, the former admin's open ballots go through the coordinator branch at apply time:
   - one that widens beyond `doc_approve` can no longer be applied (it must be proposed again);
   - a pure `doc_approve` one needs the former admin's standing echoed.

   Both directions fail closed. This is worth one line under known limits.
5. **`pg` deprecation.**
   - `list` issues its per-account queries through `Promise.all` on one transaction client (`A77-79`). node-postgres 8.23.1 queues them and warns that this behaviour «will be removed in pg@9.0» (`task-3-green.txt:19`; the same warning is in `task-2-green.txt:20`).
   - This task extends a pre-existing pattern. A future `pg` upgrade would break `list`, the admin's only view of ballots.
   - That is an availability item for the upgrade checklist, not a current defect.
6. **Audit fields.** As in Task 2's Note 5, the `account_access` event has no `request_id` or `trace_id` (E-DB-13). That is for a later sweep across identity events.
7. **Cancel reason.** The cancel reason still uses the shared schema without the character class (gate round 2, 3c). Task 3 shows no cancel reason to anyone: the notice after a cancel is a fixed sentence (`T148`), and `OpenBallot` shows only the ballot's own reason. So the condition still holds.
8. **Registration form.** It has the same implicit-submission pattern as F1 (`T173-177`). It is outside this task and is mentioned only so that one fix can cover both forms.

## Three highest-leverage fixes

1. **F1:** neutralise implicit submission in the account form, so that pressing Enter never applies or cancels a ballot. Cover the registration form with the same guard.
2. **F2:** add the foreign-tenant admin principal to A5 and to one apply attempt, and run the `operator` tenant-clause mutation once.
3. **Note 2:** add the READ COMMITTED clause to the apply comment at `A251-252`, matching the withdraw path, so that an isolation-level change cannot silently break the OQ-37 (c) echo.
