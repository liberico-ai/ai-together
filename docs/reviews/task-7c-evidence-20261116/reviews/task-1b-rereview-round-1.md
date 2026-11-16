# Task 1b re-review, round 1 (fix 80ab225..bd649d6)

### Finding Verdicts
1. Security M2 (read path as bot / other tenant): ADDRESSED. tests/doc-approval-proposal-http.test.ts:526-537 sends GET and HEAD as `bot`, as `{...coordinator,role:'bot'}` (member id, real account row and open ballot) and as `{...coordinator,tenantId:ids.otherTenant}`. Each case asserts status 404, SCOPE_DENIED, a body shape equal to the unknown-project shape taken at :528, and no approvalId in the body. The member-id bot case pins `this.same(p)` at src/server/doc-approval-proposals.ts:176 (builder mutation report is consistent: without it the call reaches the 200 path). Body reads use `r.clone()` (:44), so repeated reads are safe.
2. Security M1 / code review Minor 2 (case 3 comment): ADDRESSED. tests/doc-approval-proposal-concurrency.test.ts:146-151 resets memberships to the frozen previous_grants via the operator login, asserts `grants()` equals `second.previous_grants` and `versionOf` is still v2+1, so the `sameGrants(previous_grants,before)` clause at src/server/accounts.ts:211-213 passes and only the version clause can refuse. Comment now says so. Native result is the builder's (not re-run here).
3. Code review Minor 1 / N2 (vacuous created_at compare): ADDRESSED. concurrency test :470-471 states it only checks start order and that the ADMIN_ROW_UPDATE lock-wait assertion (:466) is the proof.
4. Code review Minor 7 (exclusive database note): ADDRESSED. concurrency test :447.

### New Breakage in the Fix Diff
None found. Only tests and comments changed; no src change. Minor, not a defect: the case-2 setup is order-dependent (it relies on the memberships row for reviewer/S existing and on `grants()` ordering), but the added `toEqual(previous_grants)` assertion makes a drift fail loudly rather than pass vacuously.

### Out-of-Scope Observations
- The HTTP GET case compares HEAD shapes against a GET shape; this works only because the handler returns a body for HEAD in the test harness. Existing cases at :517-519 rely on the same behaviour, so no new risk.
- Not verified here: native run of the fixed cases (per instructions); relied on the builder's report (48 passed / 0 skipped).
