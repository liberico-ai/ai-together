# Tier-1 fix wave re-review (606e620..7a11c1b)

Advisory. Read-only review of the fix diff and the evidence logs; no suite re-run.

## Finding Verdicts

1. Code I-1 / Security F1: ADDRESSED.
   - `tests/doc-approval-isolation.test.ts:46-69` builds a real tenant-B world through the service path: pending and approved access_change ballots, with a fixture self-check read as the operator.
   - Case 34c (:78-96) covers withdraw (SCOPE_DENIED equal to the unknown-id answer), admin cancel (APPROVAL_NOT_FOUND, and ACCOUNT_NOT_FOUND through the tenant-B account) and (e). The (e) check compares ballot state, `updated_at`, account version and tenant-B event count before and after, and counts zero closing events for those ballots.
   - Case 34a (:98-118) covers listOwn, the admin list and openAccessChange. It also covers (f): `operatorCount` is 1 and `seenByTenantA` is 0 for each foreign ballot, with the own ballot at 1. So the operator sees the foreign row in the same case and the empty result is not true by construction.
   - The P14 case (:120-132) plants a tenant-B `access_change_withdrawn` event with the exemption's shape. The refusal still holds, and a control event in tenant A flips it to accepted, which proves the refusal came from the tenant boundary.
   - All four migration-009 tables are checked per table (:134-146). The own count must be above 0, tenant B reads 0, and the business runtime role is refused.
   - 34d (:148-159) runs `SET LOCAL ROLE libetech_identity` with no tenant setting, and asserts 0 rows (no error) on non-empty tables. The title states which outcome it is.
   - Mutation evidence (`final-fix-wave-mutation.txt`) shows (f) red with `expected 1 to be +0`. It was produced by dropping the role switch on the (f) read only. That is a valid proof that RLS under the identity role is what the check tests.
2. Database P2-2: ADDRESSED.
   - `src/server/identity.ts:22-25` runs `SET TRANSACTION ISOLATION LEVEL READ COMMITTED` as the first statement after `db.transaction`'s BEGIN (`db.ts:44`). The service has no other statement before it, and `scope` is the only entry.
   - `new IdentityService` is built only on a top-level Database, with no nested tx, so the statement cannot hit a "must be the first statement" error. Its guard condition does not depend on the session default: SET TRANSACTION before any query is legal at any session default.
   - The case (:169-186) first asserts that a plain transaction reads REPEATABLE READ, then asserts the scope reads READ COMMITTED. It is run red on PGlite and on native before the fix (`final-fix-wave-red.txt`: `expected 'repeatable read' to be 'read committed'`). On native it uses a dedicated pool whose every connection carries the default via the libpq `options` parameter.
3. Bundled items: all ADDRESSED.
   - M3: `team-accounts.tsx` keeps the reason in a `draft` keyed by user id. It is set only on a reload-class error and cleared on success. The test is partly source-text based, which is weak, but the rendering half is real.
   - M4 / N6: `UnmappedUniqueViolation` is added at `doc-approval-http.ts:35-37`. The case asserts the logged `errorType` and that the response shape and headers are byte-equal to the generic 500. It was red before the fix.
   - M6: `ReviewersPanel(...)` in `docs/UI-HANDOFF-3-review.md:31` now ends with `approvalNote?`.
   - Task 2 Note 4: the native case (`withdraw-concurrency.test.ts`) races both orders with a BoM seat (asserted to be `bom_*`) and `noDeadlock` checks. It asserts the two consistent ends (vote then cancel gives expired, with one vote and cancelled from `approved`; cancel then vote gives APPROVAL_CLOSED, with no vote row). The native log shows no failing 40P01 outcome.
   - P3 24 h boundary: the case is at 23 h 59 min (still RATE_LIMITED) and 24 h 1 min (allowed), for both the rejected and the past-deadline closing.
4. Security F2: confirmed. `src/components/approvals.tsx` is absent from the diff and unchanged.

Other checks:
- `git diff 460653e 7a11c1b -- tests` has no removed lines. All 10 files are new on this branch.
- A scan of the diff for U+200B-U+200F, U+2028-U+202E, U+2066-U+2069 and U+FEFF found none.
- The diff has no local path, `.env` file name or connection string. The only hit is the env var name `SLICE1_TEST_DATABASE_URL`, with no value.
- Counts: PGlite 1095 passed + 58 skipped = 1153, and native 1153 passed. That matches, so the native run did load the env.

## New Breakage in the Fix Diff

None.

Minor notes:
- `tests/doc-approver-ui.test.tsx` (M3 case) asserts parts of the component source as text. It is brittle to refactors but not wrong.
- The mutation evidence is a wrapper that drops the role switch, not NO FORCE; the builder says so openly.

## Builder concerns

- FORCE alone would not turn (f) red: residual, acceptable. `libetech_identity` owns no table, and `assertRestrictedLogin` refuses an owner login. Finding 1 is met through RLS and the role switch.
- 34b covered only by pointers, and WITH CHECK pinned only on `account_approvals`: residual, acceptable. This is a pointer-based gap, not a missing dimension.
- 34e has no `rolbypassrls=false` case for `libetech_identity`: residual, acceptable. Case 34a's runtime-role refusal and the (f) read under the role show it is subject to RLS. A direct catalog assertion would be a cheap follow-up.
- Reverse direction (tenant B acting on A's ballot): residual, acceptable. The checks are symmetric RLS predicates, and the per-table check uses tenant B reading A's rows.
- The native W2 case relies on the pg `options` startup parameter: acceptable. It was proven red and green on native, and the control line confirms the default is in force.
- The M3 draft survives an account switch until a command succeeds: acceptable. It is keyed by user id, so another account never sees it, and it is cleared on success.

## Out-of-Scope Observations

- The lock order and the chairman-seat vote versus cancel deadlock were not touched, as ruled.
- `scope` now issues one extra statement per transaction. This is negligible.

## Verdict

All findings addressed, no new Critical/Important breakage.
