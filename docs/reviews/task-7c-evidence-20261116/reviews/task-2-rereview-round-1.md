# Task 7c, Task 2: security re-review, fix round 1 (7ce0f56..cc3557e)

Read-only review of the fix diff. I ran no test; test results are the implementer's claims, checked against the code.

### Finding Verdicts
- **F1: `withdraw` has no throttle (P2, elevated to Important)** — ADDRESSED.
  - `src/server/doc-approval-proposals.ts:218`: `await this.identity.throttle('doc-approval-withdraw:'+callerId,10,3600);`. N = 10 and window 3600, as ruled.
  - Placement: after R0 (path uuid), the body parse, R1 (`same(p)`, bot/tenant, and the admin check at :216) and before `this.identity.scope(...)`, hence before the admin `FOR KEY SHARE`, the caller `FOR SHARE` and the ballot `FOR UPDATE`. Bots, other tenants, the admin and bad ids or bodies are not counted.
  - Not inside the transaction: `identity.throttle` (`src/server/identity.ts:30-37`) commits in its own scope and touches only `identity.throttle`, so it takes no account-admin lock. Refused attempts count, which is what closes the lock-holding loop.
  - Answer: the existing `invariant(attempts<=limit,'RATE_LIMITED','Thử lại sau ít phút.',429)`; no new sentence. The caller id is lowercased (:213), so the bucket cannot be split by id case. The 11th call is refused at `attempts=11`, the same behaviour as P3 (`:79`).
  - Tests added (claims checked against the diff):
    - `tests/doc-approval-withdraw.test.ts` "eleventh withdrawal": R0/R1 refusals leave the bucket at 0, ten counted attempts, the 11th gives RATE_LIMITED with `snapshot` unchanged.
    - "cap is per caller": another proposer is unaffected, and the proposal bucket is separate.
    - `tests/doc-approval-proposal-http.test.ts`: 429 through the handler, and the body does not contain the ballot id.
  - The report names the covering command and shows its outcome (PGlite 65 passed and 7 skipped; native 72 passed; typecheck 0) and a mutation (line removed, 3 tests red). I did not re-run them. The claim that no existing case makes more than 10 counted withdrawals per caller is consistent with the diff, which touches no existing case.
- **F2: raw RLO, LRI, U+2028, U+2029 in `tests/doc-approval-withdraw.test.ts`** — ADDRESSED.
  - `tests/doc-approval-withdraw.test.ts:243-244` now use `'\u2028'`, `'\u2029'`, `'\u202e'`, `'\u2066'` and `'\u2028Căn cứ hợp lệ'`. The list keeps seven characters in the same order and the same two trailing cases, so the test means the same thing.
  - Byte scan at HEAD: `python3 -c` with `re.findall('[\u202a-\u202e\u2066-\u2069\u200b-\u200f\u2028\u2029]', open('tests/doc-approval-withdraw.test.ts',encoding='utf8').read())` gives a count of **0**.

### New Breakage in the Fix Diff
None.
- The throttle comes after R1 and outside the transaction, so it counts neither bots nor the admin, and it takes no lock.
- No existing case is touched and none needs `resetThrottle`.
- The new helper `withdrawAttempts` reads `identity.throttle` by `digest(bucket)`, as `throttle` writes it.

### Out-of-Scope Observations
None.

### Verdict
**Fix round:** All findings addressed, no new Critical/Important breakage.
