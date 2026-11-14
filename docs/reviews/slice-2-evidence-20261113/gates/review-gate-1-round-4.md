# Review gate 1, round 4 (d70b9a0..dfc6024)

## Finding Verdict
R4: ADDRESSED. src/server/intake-rules.ts KEY/maskKeyedValues has no length cap; 49/64/128-char prefixes and suffixes are redacted (new tests pass, 30/30 in tests/intake.test.ts). 48 KB timing across ~50 shapes totals 38 ms; random 8 KB adversarial worst 0.3 ms.

## Deviations
- exec loop + sticky VALUE_AT: sound. Progress guaranteed (KEY needs >=1 identifier char plus separator; VALUE is non-empty; DOTTED always advances). `user=bob&password=x` and `Server=db;Password=x` verified.
- "-" in key names: sound (X-API-Key, my-secret-key now masked; HEAD leaked the latter).
- optional `api `/`private ` word: works for plain cases but is a regression when glued after an identifier (see Issue 1).
- USERINFO lookbehind: sound, linear.
- maskJwt: sound. Standard JWT, bearer JWT, jwt in quotes/parens, a-eyJ..., eyJ.a.b.eyJx.y.z behave identically to HEAD; `eyJ.x.y`, `Eyjabc.d.e`, two-segment tokens are not masked (same as HEAD). No new prose masking.

## New Issues
Important (1): leak vs HEAD for two-word keys with a prefix:
`X-Api Key: abc123`, `client_api key: abc`, `OpenAI_API KEY=abc`, `Stripe-Private Key: abc`, `myprivate key: abc` -- HEAD masked, new leaks the value. Cause: the optional `(?:api|private)\s` group in KEY (intake-rules.ts, KEY const) is guarded by lookbehind `(?<![A-Za-z0-9_-])`, so it cannot follow `_`/`-`/letters; the remaining identifier `Key` has no keyword. Fuzz (400k random strings) found 217 HEAD-masked/new-unmasked cases, all of this glued "api/private Key" shape; no other leak class found. Also `bot-api key = abc` now masks only one of two tokens (HEAD garbled it too). Fix suggestion: allow `(?:api|private)\s` after `[_-]` or letters (e.g. drop the lookbehind for that optional word via a second small pass on identifier + following word), keeping linearity.
Minor: none beyond the four deferred leaks.

Probes: prose (EN/VI), URLs, times, Windows paths unchanged vs HEAD. Existing prose over-masking ("password policy: 12 chars", "token ring") is HEAD behaviour, unchanged.

## Assessment
Fix round: Needs another round (small): restore masking for glued two-word keys (Issue 1). The finding R4 itself is closed.
