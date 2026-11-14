### Finding Verdicts
- **I1 ADDRESSED** (src/server/intake-rules.ts:17-39). I ran the redactor in a node probe. All seven required strings are masked: `OPENAI_API_KEY=`, `GITHUB_TOKEN=`, `DB_PASSWORD=`, `access_token=`, `client_secret:`, `{"password":"hunter2"}` and `"api_key": "XYZ"`. `secretary meeting` and `tokens are fine` are unchanged. `Authorization: Bearer abc123` is masked. The known formats and URL userinfo are covered by FORMATS/USERINFO, and the test at tests/intake.test.ts:41-55 exercises each one. `content_hash` is untouched. The cost is the ReDoS issue below.
- **I2 ADDRESSED** (migrations/016_intake_inbox.sql:215-225). Table-level INSERT is revoked for libetech_intake on all five tables and for libetech_runtime on intake_events, then granted per column. I compared each list with the INSERT in src/server/intake.ts:68, 81, 91, 99 and 104. All five lists match exactly: 21, 9, 11, 5 and 10 columns. No other src file inserts into these tables. Runtime on intake_events gets the 10 columns a user audit row needs. The test at tests/intake-schema.test.ts:190-211 proves denial for ingested_at/created_at/id (source_events), created_at/id (revisions and events), created_at/hash_verification (attachments), created_at/version/note/missing_fields (candidates), and created_at and id for runtime on intake_events. The test uses `SET LOCAL ROLE libetech_intake` through asIntake and the scoped runtime role, so it exercises the real roles.
- **M1 ADDRESSED** (src/server/intake.ts:98-101, tests/intake.test.ts:57-64). One `requestId` per ingest call is shared by every audit row. The test asserts a single distinct value across the 2 rows of one call, and two distinct values after two calls.
- **M4 ADDRESSED** (tests/intake.test.ts:66-82). The test asserts the locator `https://t.me/c/<chat minus -100>/<msg>`, the empty locator for a chat that does not start with -100, `source_id=telegram:<chat>:<msg>`, `source_actor=tg:424242`, trace_id, and a correlation_id that is a UUID and differs from trace_id.

### New Issues in the Fix Diff
**Critical:** none.

**Important**
- **ReDoS (quadratic backtracking) in KEYED**, src/server/intake-rules.ts:17. The leading `[A-Za-z0-9_]*` runs before the keyword alternation. Adversarial text such as `a_token_` repeated, or `_secret` repeated with no `=`, retries from every start position. Node probe timings on one synchronous regex call, `a_token_` repeat / `_secret` repeat:

  | Input size | `a_token_` | `_secret` |
  |---|---|---|
  | 2 KB | 84 ms | 41 ms |
  | 4096 chars (the zod cap, intake.ts:23) | 371 ms | 238 ms |
  | 6 KB | 963 ms | 618 ms |
  | 12 KB | 7.8 s | 5.4 s |

  Growth is super-quadratic, not exponential. At the 4096 cap, one message blocks the event loop for about 0.3 to 0.4 s, and the bridge throttle is 120 per bucket. If the cap is ever raised toward 12 KB, one message blocks it for several seconds. Fix: drop the leading prefix and anchor on the keyword, for example `(?<![A-Za-z0-9])(?:[A-Za-z0-9]+_)*(?:KW)...`. A cheap guard is to cap the redaction input, or to run it on the slice (it already slices to 4096 after redaction, so slice first and then redact). The other probed shapes were all under 60 ms: SPACED, FORMATS, USERINFO, the JWT regex and a long whitespace run.
- **Ingest is not exercised under the real intake role.** `svc()` and `svcWith()` in tests/intake.test.ts:15 and tests/intake-concurrency.test.ts:12 use `h.operator`, a superuser. The column grants are verified by hand against the SQL text, and the denial tests use hand-written INSERTs from a subset of columns. A future column added to an INSERT in intake.ts but not to the grant would pass the suite and break on a real login. The grant lists match today. Recommend a test that runs `IntakeService.ingest` through asIntake (SET LOCAL ROLE plus the GUCs).

**Minor**
- The `"password":"hunter2"` output is `"password":[đã che]` with the quotes around the value consumed. This is fine for redaction, but the JSON shape is not preserved.
- SPACED matches `bearer`/`token` followed by any whitespace-separated word, so `token is expired` becomes `token [đã che] expired`. This over-redaction is acceptable and arguably safe. It is not covered by a test.

### Out-of-Scope Observations
- The `_runtime` UPDATE grant on intake_candidates still lists `updated_at` and `version` as updatable columns. This matches the 013/014 precedent and is not a regression.
- The gateway cap is 4096 chars of text (intake.ts:23) but the bridge route allows 16384 bytes of body. The ReDoS exposure is bounded by the zod cap, not by the byte cap.

### Assessment
**Fix round:** Needs another round (one Important: ReDoS in KEYED, src/server/intake-rules.ts:17. The ingest-under-real-role test is recommended in the same round). The four findings themselves are all addressed.
