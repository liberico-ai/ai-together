# Review gate 1, round 5 (dfc6024..82788e2)

## Finding Verdict
**ADDRESSED.** src/server/intake-rules.ts:28 (KEY alternative 1). All six cases masked in a probe (`X-Api Key: abc123`, `client_api key: abc`, `OpenAI_API KEY=abc`, `Stripe-Private Key: abc`, `myprivate key: abc`, `bot-api key = abc`), plus tab and newline between the words, `x-api key:abc`, quoted `"X-Api Key": "abc"`, `X-Api Keys:`, `a-api key:`. `secretary meeting`, `tokens are fine` and `monkey key: v` stay intact. `npx vitest run tests/intake.test.ts`: 31/31 pass.
Timing, 12 KB and 48 KB inputs: `api key `, `xapi `, `private keyx`, `x_api key`, `api key: `, `x-private key x `, `api\nkey`, `apikey`, `private key private key=`: each 0.2-0.5 ms at 12 KB and 0.6-1.1 ms at 48 KB. Linear, far under 200 ms.
Differential, 1.5M random token strings against dfc6024 and d70b9a0: 0 cases where the new code leaks and either old version masked. 1867 cases the new code masks that d70b9a0 leaked. No regression.

## New Issues in the Fix Diff
Critical: none.
Important: none.
Minor (not regressions; the same in dfc6024 and d70b9a0, so out of scope for this finding):
- Two or more whitespace chars between the words leak: `X-API  KEY: abc`, `x_api  key=abc`, `my api   key: abc`, `x api\n key: q`. The KW list allows only one separator char (`api[_\s-]?key`), so these were never keywords. Same class as `password key: x` / `token key: x`.
- Cosmetic over-redaction with a space before `=` or `:` (`bot-api key = abc` becomes `bot-api key [đã che] [đã che]`). The value is still masked.

## Assessment
**Fix round:** Clean
Probe scripts are in the session scratchpad only; no repo files were touched besides this report.
