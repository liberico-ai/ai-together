# Re-review — Codex fix 4, fix round 1 (f6f4ead..001d387), finding M1

Verdict: M1 ADDRESSED. Evidence: bridge-config.ts:21 lowercases each id before the Set; intake.ts:48 lowercases again and counts distinct, so [A, A.toUpperCase()] gives scope.length 1; projectId=scope[0] (intake.ts:52) is lowercase for the scope check, app.project_ids and every insert. codex-fix-4-red.log shows the config test (bridge-io.test.ts:74) and the intake test (intake.test.ts:618, 409 INTAKE_PROJECT_AMBIGUOUS) failing before the fix.

## New breakage in the fix diff
None (no Critical or Important).

Comparisons checked (all against 001d387):
- bridge.ts:32-33: granted=chatScopes[chatId] (now lowercase) vs p.projectIds (session, from identity.ts:51 grants; Postgres/PGlite return uuid text in lowercase). Strictly more matches than before, no match that passed can fail.
- intake-scope.ts:10 and db.ts:51 set app.project_ids from the lowercase value; RLS casts to ::uuid (001_foundation.sql:82), case-insensitive either way.
- intake.ts:70,77-125 pass projectId as a bound uuid parameter to project_domain_mappings, source_events, intake_candidates and so on. uuid type comparison, case-insensitive; DB-stored values are lowercase, so nothing that matched can stop matching.
- bridge-io.ts:26 builds the outbox pull scope from chatScopes (lowercase), then OutboxService/scoped (same set_config path). No string compare against a DB id there.
- intake.principalId (config) is untouched by the fix; chat ids untouched.
No code path compares a config project id to a DB/session id after lowercasing in a way that could newly fail.

## Tests
- bridge-io.test.ts new test: A has hex letters (abcdef01..ab), upper differs; asserts [A.upper, A] -> [A]. Genuinely discriminating (RED failed here).
- intake.test.ts new test: letter-bearing synthetic project A inserted, `expect(A.toUpperCase()).not.toBe(A)` guards vacuity. Case 1 ([A, A.upper]) is discriminating (RED failed at line 618). Case 2 ([A.upper] only) exercises a letter-bearing uuid but was not reached in RED and would likely pass without the fix, because Postgres normalizes the uuid column to lowercase so the final rows assertion cannot tell. Nit only: case 2 is a regression guard, not a RED proof. The "two cases" claim holds for exercise, not for discrimination.
- Not run by me (instructed); test results are as claimed in the report only (#hypothesis).
