# Task 3 re-review, fix round 1 (a350b1a..797cb2f)

Read-only. Source: the fix diff file, the brief's item list. I did not re-run tests. One grep of `src/app/globals.css` for a rule that could override `hidden`. Tags: #fact read in diff/code, #inference reasoned.

### Finding Verdicts

1. **Security F1 (Enter applies/cancels a ballot): ADDRESSED.**
   - `src/components/team-accounts.tsx` (`AccountForm`, new): the form's first child is `<button type="submit" disabled hidden/>`, no `value`, no `style`, before `OpenBallot`. A disabled default button makes implicit submission do nothing. #fact (diff) / #inference (HTML rule, not run in a browser).
   - The ballot buttons stay `type="submit"` with their values, so `submitter.value` on a real click is unchanged: a disabled button is never a `submitter`. #inference
   - Move into `AccountForm` is faithful. Old form attributes `className="action-form"`, `onSubmit`, `onChange` (readGrants → expandsAccess → now `onExpands`), the `<p>` status, `OpenBallot`, `Grants`, the GitHub `<details>`, the reason input and the action row are identical line for line in the diff. `key={user.id+':'+user.version}` is kept on the call site. `busy`, `expands`, `projects`, `user` are all passed. No `aria` attribute existed before, none dropped. #fact
   - Test: `tests/doc-approver-ui.test.tsx` new case asserts the first submit-capable button is exactly the disabled hidden one, that it precedes `apply_frozen` and `cancel_access_change`, that the markup starts with it, that exactly one button carries `hidden`, and that the ballot buttons are `type="submit"` and not disabled. It was red before the guard (log: received the `apply_frozen` button) and green after. Existing expectations: 0 removed lines in that file. Existing button-count tests render `TeamAccounts` with nothing selected, so the guard is not counted there; the 45 UI tests pass in the log. #fact
   - CSS: bare `button` has no `display` rule, and the guard has no class, so `.primary/.secondary {display:inline-flex}` cannot undo `hidden`. #fact
   - Registration form left alone, as ruled.
2. **Security F2 (cross-tenant admin): ADDRESSED.**
   - `tests/doc-approval-apply.test.ts` A5: `{...w.admin,tenantId:ids.otherTenant}` is added to the refusal loop, expecting `ADMIN_ONLY` from `list`. A7: `applyWith` takes a principal; one apply with `standing=false` (the right echo) under that principal rejects with `ADMIN_ONLY`, then `snapshot` and `accessEvents` are asserted unchanged, before the real apply. #fact
   - Passes for the right reason: the echo sent is the correct one, so the only thing that can refuse it is the tenant clause. Mutation (e) drops `p.tenantId===this.identity.tenantId` from `operator`; A5 and A7 go red (`expected a refusal, the call succeeded`; `promise resolved ... instead of rejecting`). The two reds are assertion errors, not timeouts. Restore checked by `cmp`. #fact
3. **Code-review Minor 2 (no Promise.all for the new reads): ADDRESSED.** `src/server/accounts.ts` `list`: a sequential `for … await this.openAccessChange(tx,user)` fills a `Map` before the pre-existing `Promise.all`; the map is read as `changes.get(user.id)??null`. The pre-existing `Promise.all` body is unchanged except that one line. Row order comes from the single ordered `rows` query, so `list` order and content are unchanged. The log proves the new reads emit no query on a busy client: with the pre-existing `Promise.all` temporarily serialised, the DeprecationWarning count goes to 0, and all seven stack traces point at `identity.ts:39` via the old `Promise.all`. #fact
4. **Code-review Minor 3 (failed reload overwrites the refusal): ADDRESSED.** `reloadAfterConflict(refusal,reload,show)` shows `refusal.message + ' Không tải lại được danh sách tài khoản: ' + failed.message` only on a failed reload; a good reload shows nothing more. The catch in `submit` still does `setError(error.message)` first and then calls it. New test covers both branches. Only the two error messages are shown, nothing else leaks. #fact
5. **Security note 1 (READ COMMITTED comment): ADDRESSED.** `src/server/accounts.ts`, three comment lines above `activeProjectRole` in the apply branch: plain read, no lock, why app writes are serialised by the admin lock, READ COMMITTED (`db.ts`), and what changes under REPEATABLE READ. Matches the withdraw wording. #fact

### New Breakage in the Fix Diff (severity + file:line, or «None»)

None (Critical/Important).

Minor, for the record:
- `tests/doc-approver-ui.test.tsx` (new F1 case) tests the guard on static markup only, so the actual Enter behaviour in a browser is not exercised. That is the repo's existing style, and the HTML rule is well defined.
- `reloadAfterConflict` casts `refusal as Error`. It is always an `ApiError` on this path (`shouldReloadAccounts` guards it), so safe.

### Out-of-Scope Observations (or «None»)

- The pre-existing `Promise.all` in `list` still produces the pg `DeprecationWarning` (7 lines). Disclosed by the implementer; a future `pg@9` upgrade item, not this task.
- The registration form still has the same implicit-submission pattern (disclosed, out of scope by ruling).

### Verdict — **Fix round:** All findings addressed, no new Critical/Important breakage
