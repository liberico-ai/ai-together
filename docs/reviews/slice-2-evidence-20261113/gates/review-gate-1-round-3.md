# Gate 1 round 3 re-review (9070d80..d70b9a0)
## Finding Verdict
R3: ADDRESSED. src/server/intake-rules.ts:20 (KEYED). Probes: accessToken=XYZ, {"clientSecret": "XYZ"}, DBPASSWORD=hunter2, apiKey: XYZ, PASSWORD_+40 chars+=x, OPENAI_API_KEY, "api_key": all masked. Earlier forms (ghp_, xoxb-, AKIA, URL userinfo, Bearer, password=abc;def -> masked to whitespace) pass; "secretary meeting", "tokens are fine" intact. vitest -t 'R3|R2-': 4 passed.
Timing (12 KB, KEYED+SPACED alone): all KW shapes (token run, token every 10 chars, tokenabcde, _token, token-, token", token ", long PASSWORD_ run, whitespace runs) <= 0.4 ms. KEYED isolated on 'a-' x n: 0.1 ms at 12 KB, 0.2 ms at 48 KB: linear.
## New Issues in the Fix Diff
Critical: none. Important: none.
Minor (pre-existing, outside the diff, USERINFO unchanged): intake-rules.ts:~30 USERINFO `\b[a-z][a-z0-9+.-]*:\/\/` is quadratic on separator runs without "://": 'a-' x 12 KB 60 ms, 48 KB 0.9 s, 192 KB 11 s; 'token-' 13 ms/12 KB. Within the 200 ms budget at 12 KB (not covered by a test shape) but would break if the input cap were raised. Suggest bounding the scheme to `{0,31}` or anchoring with a lookbehind; not blocking.
Prose: Vietnamese/English sentences with "password"/"token" followed by whitespace get the following word masked by SPACED (e.g. "the password is on" -> "the password [đã che] on"). Pre-existing, accepted round-2 behaviour, not a regression of this diff.
## Assessment
Fix round: Clean
