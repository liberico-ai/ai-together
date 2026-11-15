# Task 8 — database review (migration 021: Z4 zone and the AI role)

Reviewer: `liberico-database-reviewer` (advisory; recommendations only, nothing fixed). Scope: commit `6f694a1` on top of `45d4c43`, read through
`.superpowers/sdd/slice-3-review-skills/review-8-45d4c43..6f694a1.diff`. Task-scoped gate; the whole-branch review and the Codex review come later.
No database was started or connected; no test was run. Line numbers are for files at `6f694a1`.

Focused checks outside the diff (one per named risk):
- R-a PUBLIC grants / default privileges / `ON ALL` / definer functions in 001–020: `grep` over `migrations/*.sql`.
- R-b who can become `libetech_ai`: `migrations/003_runtime_roles.sql`, `migrations/016_intake_inbox.sql:1-42`, `src/server/db.ts` (whole file).
- R-c functions callable by the AI role: list of every `CREATE [OR REPLACE] FUNCTION` in 001–021 and its `REVOKE`.
- R-d a decision pointing at another document's revision: `migrations/014_document_registry.sql:29-43`.
- R-e rollback data protection compared with 020: `migrations/rollback/020_document_review.sql:1-21`.
- R-f the generic rollback loop covers 021: `tests/migrations-rollback.test.ts:14-63`.

## Spec compliance

| Item of the brief | Status | Where |
|---|---|---|
| Role `libetech_ai NOLOGIN NOSUPERUSER NOBYPASSRLS`, created idempotently, no login created | ✅ (plus `NOCREATEDB NOCREATEROLE`, stricter) | `migrations/021_ai_suggestions_z4.sql:11-15` |
| Guard block `-- guard:ai-role` refuses wrong attributes, members, memberships | ✅ | `021:18-28` |
| Schema `intelligence`, PUBLIC revoked | ✅ | `021:30-31` |
| `intelligence.ai_drafts`: every column, CHECK and default of the brief; `UNIQUE(tenant_id,dedupe_key)`, `UNIQUE(id,tenant_id,project_id)`, scoped FK | ✅ | `021:33-54` |
| `value` backstop `octet_length(value::text) <= 49152` | ✅ | `021:44` |
| `draft_decisions` in `public`: columns, `UNIQUE(draft_id)`, FK to drafts and to `document_revisions` on `(id,tenant_id,project_id)`, both CHECKs | ✅ | `021:55-71` |
| Indexes of the brief + `created_at` on both tables; FK served by `UNIQUE(draft_id)` | ✅ | `021:74-81` |
| RLS ENABLE + FORCE on both tables | ✅ | `021:83-86` |
| Policies `ai_select`, `ai_insert` (+ `app.ai_principal_id`), `runtime_select` on drafts; `runtime_select`, `runtime_insert` (+ `app.person_id`) on decisions; fail-closed on missing context | ✅ | `021:89-111` |
| Guard `draft_decisions_guard()` BEFORE INSERT: value hash equal; confirm needs ≥1 source; not SECURITY DEFINER; pinned `search_path` | ✅ | `021:117-139` |
| `reject_history_mutation` on both tables | ✅ | `021:141-144` |
| Grants: USAGE on `intelligence` to AI + runtime; AI SELECT + column INSERT on drafts only; runtime SELECT on drafts, SELECT + column INSERT on decisions; nothing to intake / identity / web / PUBLIC | ✅ | `021:149-155` |
| Version row last, `ON CONFLICT DO NOTHING`, no other data INSERT, `BEGIN…COMMIT` | ✅ | `021:8,157-158` |
| Rollback: refuses `version > '021'`, drops the two tables, the function, the schema; no CASCADE; deletes `'021'`; keeps the role | ✅ | `migrations/rollback/021_ai_suggestions_z4.sql:4-16` |
| `assertRestrictedLogin`: `'intelligence'` in `owns_tables`; new `ai_role` column | ✅ | `src/server/db.ts:22,26` |
| Helper move (S44): definitions removed, import + same-name wrappers; no `expect`/test name touched; same counts (46+2 / 48) | ✅ | `tests/outbox-schema.test.ts` hunk at old `:721-761`; `tests/slice2-fixtures.ts` tail; `task-08-outbox-before.txt` |
| Case (4) catalog-derived over every `r`/`p` table of `public`, `identity`, `analytics` + the 14 named tables + two definer functions | ✅ | `tests/z4-schema.test.ts:61-82` |
| Privilege query of the brief, with SELECT, REFERENCES/TRIGGER, and the `intelligence` exactness check | ✅ | `tests/z4-schema.test.ts:84-115` |
| No SECURITY DEFINER function executable by `libetech_ai` (unscoped) | ✅ | `tests/z4-schema.test.ts:117-121` |
| Draft scope / principal / no context / backstop 49 149 stored / immutability / runtime read-only / decision rules / guard refusal / restricted login | ✅ | `tests/z4-schema.test.ts:134-371` |
| Native-only: web login cannot `SET ROLE libetech_ai` | ✅ | `tests/z4-schema.test.ts:382-393` |
| Rollback case per S41 (`'022'` hand-inserted, later migrations taken off first, re-applied in `finally`) | ✅ | `tests/migrations-rollback.test.ts:306-361` |
| Generic forward → rollback → forward loop covers 021 without edit | ✅ (file-listing driven, `from013`) | `tests/migrations-rollback.test.ts:14,24-63` |
| Red → green on both engines; full suites green (PGlite 655+35, native 690) | ⚠️ cannot verify from diff beyond the logs shipped in it | `task-08-{red,green,green-native,full-*}.txt` |

## Strengths

- The boundary is enforced by privilege, not by code: the AI role holds exactly SELECT + column INSERT on one table and has no policy, grant or
  ownership anywhere else; the tests read this from the catalog (`has_table_privilege` / `has_any_column_privilege` over every relation of the three
  application schemas, plus an unscoped `prosecdef` query), so a table or definer function added later is covered without editing the test.
- Fail-closed everywhere: `nullif(current_setting(...,true),'')` on every policy; the guard reads the draft under the caller's RLS before the FK
  (an AFTER trigger) runs, so "not found" and "out of scope" give one message and the FK cannot be used as an existence oracle.
- The guard block checks a pre-existing role instead of trusting `IF NOT EXISTS`, and runs on every re-apply.
- `pg_has_role(...,'MEMBER')` in `assertRestrictedLogin` sees direct and indirect membership independent of `INHERIT`/`SET` options, and the test
  uses `NOINHERIT` logins to prove it.
- The 49 152 backstop arithmetic is sound (below) and the test pins the densest case at 49 149 stored bytes.
- Four mutations, each red in the case that claims to guard it, each restored byte-identical.

## Findings

### Critical

None.

### Important

**I-1 · A confirmed decision can name a revision of a different document (or attach a revision to an intake-candidate draft)** — plan-mandated
- Where: `migrations/021_ai_suggestions_z4.sql:65,69` (FK only on `(document_revision_id,tenant_id,project_id)`) and the guard `021:117-136`.
- Scenario: project P has documents A and B; the AI wrote a draft with `entity_type='document', entity_id=A`. As `libetech_runtime` with
  `app.person_id` = the acting person, `INSERT INTO draft_decisions(..., draft_id=<draft about A>, result='confirmed', document_revision_id=<a revision of B>)`
  succeeds: the FK only requires the revision to be in the same tenant and project. Same for a draft with `entity_type='intake_candidate'`.
- Why it matters: `draft_decisions` is the Z1 record of the human confirmation that AR-03 / E-AI-04 rest on ("a person confirms; only then the
  domain service writes Z1"). A wrong link makes the provenance chain say that revision of B was produced from a confirmed draft about A. The brief
  defines the guard exactly and does not ask for this binding, so the implementer followed the plan; it is a plan gap, not an implementation defect.
- Smallest fix (021 is not applied anywhere yet, so it is cheap now): select `t.entity_type, t.entity_id` in the guard and add
  `IF NEW.document_revision_id IS NOT NULL AND (d.entity_type <> 'document' OR NOT EXISTS (SELECT 1 FROM public.document_revisions v WHERE v.id = NEW.document_revision_id AND v.document_id = d.entity_id)) THEN RAISE ...`
  (`document_revisions` already has `UNIQUE(id,document_id)`, `014:42`; runtime reads it under its RLS, fail-closed), plus one refusing case. If the
  planner prefers to keep 021 as briefed, Task 12 must enforce it in `SuggestionService` with a negative test, and the receipt must say the DB does not.

### Minor

**M-1 · `sources`, `questions`, `skill_version`, `model_version` have no size bound** (`021:39,41,46-47`) — plan-mandated (brief gives only the array check).
The AI role can store an arbitrarily large `sources`/`questions` (up to the 1 GB jsonb limit) or text version strings. Rows are immutable, so an
oversized row can never be cleaned except by superuser. Smallest fix: `CHECK(octet_length(sources::text) <= 524288)` (S20: ≤100 sources × 4 096 plus
overhead — the planner picks the number), same for `questions`, `length(skill_version) <= 64`, `length(model_version) <= 200`. `octet_length(x::text)`
needs no CASE form. Adding it now on an empty table is free; later it needs `NOT VALID`.

**M-2 · Rollback drops confirmed decisions without refusal** (`migrations/rollback/021_ai_suggestions_z4.sql:11`) — plan-mandated.
020's rollback refuses while an approved decision exists (`rollback/020:8-20`, with `row_security = off` and a dynamic count). Today nothing
references `draft_decisions`, so dropping loses no basis of another row; but once Task 12 writes Z1 because of a confirmation, a rollback would
silently erase the only record of the human act. Smallest fix: copy the 020 pattern — `SET LOCAL row_security = off;` and refuse when
`to_regclass('public.draft_decisions') IS NOT NULL` and `EXECUTE 'SELECT count(*) FROM public.draft_decisions'` > 0 — plus one case in the rollback test.
Acceptable to defer while Z4 is not enabled, if the receipt says so.

**M-3 · The UPDATE half of case (4) has no teeth on its own** (`tests/z4-schema.test.ts:77`).
`UPDATE t SET col=col WHERE false` also needs SELECT on `col`; a mutation `GRANT UPDATE ON work_items TO libetech_ai` (without SELECT) still yields
`permission denied`, so this probe stays green. The privilege query (`:84-89`) does catch it, so the acceptance criterion is still proven; fix the probe
to `SET col=DEFAULT WHERE false` so each half stands alone. (The INSERT half is sound: `DEFAULT VALUES` passes the "any column" permission check with a
column grant and then fails on NOT NULL, not on permission.)

**M-4 · The catalog evidence does not look at default ACLs, sequences or the role's own attributes beyond the five** (`tests/z4-schema.test.ts:84-131`).
Nothing in 001–021 uses `ALTER DEFAULT PRIVILEGES` (grep: 0) and no sequence exists (UUID keys, no SERIAL/IDENTITY), so there is no gap today. To keep
it so: `SELECT 1 FROM pg_default_acl WHERE defaclacl::text ~ '(^|[{,])(=|libetech_ai=)'` → 0 rows; a `relkind='S'` row in the privilege query; and
assert the computed-but-unasserted `no_password_hash` and add `rolreplication` to the guard (`021:20`) and to the attribute assertion (`:128`).

**M-5 · `UNIQUE(tenant_id,dedupe_key)` crosses projects** (`021:53`) — plan-mandated. Under `ON CONFLICT DO NOTHING` (Task 12), a key already used in
another project of the tenant silently inserts nothing and the follow-up SELECT under the AI's project scope finds nothing. Not a leak of content,
but Task 12 must treat "no row inserted and none visible" as a conflict, never as success. Alternative: `UNIQUE(tenant_id,project_id,dedupe_key)`.

**M-6 · `public` schema CREATE for PUBLIC is assumed absent, not enforced.** PG ≥ 15 fresh databases have no `CREATE` for PUBLIC on `public`, and the
test (`:111-112`) passes on PGlite and the PG16 container. A production database created from an older template or upgraded with `pg_upgrade` keeps
`CREATE` for PUBLIC, and the AI role would then be able to create tables in `public`. Smallest fix: a pre-check in the delivery receipt, or an
idempotent `REVOKE CREATE ON SCHEMA public FROM PUBLIC;` in a future migration (not in 021's brief).

## The implementer's flagged points

1. `sources`/`questions` unbounded — **agree; Minor M-1**, cheap to add now; the application gate (Task 9/12) remains the primary bound.
2. Rollback drops tables with rows — **acceptable while Z4 is not enabled; Minor M-2** recommends the 020 refusal pattern before Task 12 lands.
3. `NOCREATEDB` / `NOCREATEROLE` added — **correct and preferable**; a pre-existing role with those attributes should be refused. Matches
   `libetech_intake_svc` treatment in 016. Deployment pre-check covers it.
4. Guard "not in scope" message relies on the caller's RLS — **correct and intended**: same message for nonexistent and out-of-scope is the
   repo rule; the BEFORE trigger runs before the AFTER FK check, so no oracle. The person's authority over the document is Task 12's.
5. Two wrong test expectations corrected, migration untouched — **accepted**: both corrections are right (column-level INSERT makes
   `has_table_privilege(...,'INSERT')` false; the last line is `COMMIT;`), and the corrected test reads the column privilege too (`:103-108`).
6. Two native-only cases about the web login — **the right two**: only a real separate non-superuser login can show `SET ROLE` refusal
   and the runtime-only read path; everything else (ACLs, RLS, column grants, `SET LOCAL ROLE`) is real PostgreSQL in PGlite and is enforced there.

## What libetech_ai can reach

Assumes a session that has become `libetech_ai` (today only a superuser can do that; see below).

| Object class | What it can do | Evidence |
|---|---|---|
| `intelligence.ai_drafts` | SELECT within `app.tenant_id`/`app.project_ids`; INSERT of 17 named columns within scope and only with `ai_principal_id = app.ai_principal_id`; no UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER | `021:89-98,151-153`; tests `:103-115,134-173,240-262` |
| `public.draft_decisions` | nothing (no grant, no policy) | `021:155`; test `:264-270` |
| Every table, view, MV of `public`, `identity`, `analytics` (incl. `schema_migrations`) | nothing (no INSERT/UPDATE/DELETE/TRUNCATE/SELECT/REFERENCES/TRIGGER, table or column) | no PUBLIC grant in 001–021 (grep); test `:61-102` |
| Schemas | USAGE on `intelligence` (granted) and on `public` (PostgreSQL default for PUBLIC); no CREATE on the four app schemas | `021:150`; test `:109-113` |
| Functions | the three SECURITY DEFINER functions (`bom_eligible_members` `006:115`, `document_approvers` `019:77`, `outbox_messages_record_state_event` `017:411`) are revoked from PUBLIC → denied; every other function in 001–021 is an invoker trigger function (cannot be called directly; runs with the caller's rights); built-ins in `pg_catalog` are invoker and cannot write app tables | grep of `CREATE … FUNCTION`; test `:117-121`, `:79-80` |
| Sequences | none exist | grep (no SERIAL/IDENTITY/SEQUENCE) |
| Default privileges | none defined | grep `DEFAULT PRIVILEGES` → 0 |
| Database | PUBLIC defaults: TEMP (it can create temp tables in its own session), CONNECT (moot: NOLOGIN); no CREATE | PostgreSQL defaults; not tested |
| Large objects | PostgreSQL lets any role `lo_create`; it cannot read or write others' objects with `lo_compat_privileges` off | PostgreSQL default; not tested |
| Session-level | `set_config` of any `app.*` (so the tenant/project/principal binding constrains correctness of the pipeline, not a hostile holder of the role), NOTIFY, advisory locks, read of `pg_catalog`/`information_schema` (catalog metadata incl. policy text, not row data) | PostgreSQL defaults; no LISTEN/advisory use found in migrations |
| Roles | member of nothing, no members, cannot SET ROLE to anything | guard `021:23-27`; test `:123-131` |

## Who can become libetech_ai

- No row in `pg_auth_members` references it (guard + test). In PostgreSQL 16 `SET ROLE` needs a membership with the SET option, or superuser.
  Therefore `libetech_web`, `libetech_auth`, `libetech_intake_svc`, and the NOLOGIN roles `libetech_runtime`, `libetech_identity`, `libetech_intake`
  cannot assume it (native test `:382-388` shows it for the web login; the others follow from the catalog).
- No role holds ADMIN on it, so no CREATEROLE role can grant it (PG16 needs ADMIN OPTION).
- Superusers can, always. In the tests the operator is a superuser, which is how `asAi` works. On a real server this means: whoever holds the
  migration/operator (superuser) credential can act as the AI pipeline. The delivery receipt must list the superuser roles of the cluster
  (`SELECT rolname FROM pg_roles WHERE rolsuper`), state that no membership of `libetech_ai` exists, and state that no login, password or key for
  the AI role was created.
- `assertRestrictedLogin` (`db.ts:20-31`) refuses any app login that can reach `libetech_ai` (direct, indirect, NOINHERIT) or owns a Z4 table; the
  three existing logins still pass (test `:356-358`); it accepts nothing it refused before (one column added, one schema added to an existing
  refusal). Pre-existing limitation, not new: it runs once per pool, so a membership granted while the app is running is caught only at the next start.
- The guard is idempotent and runs on every apply (unconditional DO block after the conditional CREATE).

## Checked and found correct

- Backstop arithmetic (S42): jsonb text output differs from `JSON.stringify` by one space after each structural `:` and `,`; duplicate keys only
  shrink; string escaping is the same set for both once U+0000 and lone surrogates are refused (S64); with no numbers except bounded integers
  (S42 condition), the densest form `[0,0,…]` of 32 767 bytes has 16 382 commas → 49 149 ≤ 49 152; for L ≤ 32 768 the separator count is < L/2.
- Guard uses CASE before `jsonb_array_length`; the column CHECK already forces an array; JSON `null` refused by the type check (test `:200`).
- Guard reads the draft as the invoker (runtime has USAGE + SELECT + `runtime_select`); superuser operator bypasses RLS but is still stopped by the
  hash/source checks (test `:314-319`); `search_path = pg_catalog, public, pg_temp`, `intelligence` schema-qualified.
- Runtime cannot confirm a draft of another project or tenant: `runtime_insert` WITH CHECK on the decision's scope, the composite FK to the draft's
  `(id,tenant_id,project_id)`, and the guard's scoped lookup (tests `:299-300,308-312`). A revision of another project is refused by the composite FK.
- One decision per draft (`UNIQUE(draft_id)`), concurrent second insert gets 23505; immutability by trigger for the superuser and by missing
  privileges for every app role (test `:209-223`).
- `INSERT … RETURNING` by the AI passes because `ai_select` has the same scope.
- Indexes: every FK has a leading-column index (`UNIQUE(draft_id)` serves the draft FK; `(project_id,tenant_id)` for projects; revision FK listed).
- Rollback: order check; no CASCADE, no DROP ROLE (asserted on the file, comments stripped); `DROP SCHEMA` without CASCADE fails closed if foreign
  objects appear; forward → back → forward identical; 019/020 triggers, tables and version rows unchanged (test `:316-356`); `later` taken off and
  put back per S41, so the case keeps working when 022 exists.
- Re-apply identity test compares policies, triggers, function config, table and column ACLs, RLS flags, indexes and the version row.
- Mutations m1–m4 each turn red exactly the case that claims the property; m1 proves both the probe loop and the catalog query.
- Helper move: only the two definitions and the type moved; outbox test keeps same-name wrappers bound to `h.operator`; counts identical.

## Deployment notes for 021

- Effect on a real cluster: creates the cluster-global role `libetech_ai` (shared by every database of the cluster; the rollback never drops it);
  creates schema `intelligence`, two empty tables, one function, three triggers, five policies, grants. No table rewrite. Creating the FKs takes
  `SHARE ROW EXCLUSIVE` on `projects` and `document_revisions` for the duration of the transaction (blocks their writes briefly); `lock_timeout 5s`.
- Apply as a superuser. If applied by a non-superuser CREATEROLE role on PG16, that creator receives an automatic ADMIN membership of the new role
  and the guard refuses the migration — fail-closed and correct; do not "fix" it by revoking inside the migration.
- After apply, every app process restart runs `assertRestrictedLogin` with the new `ai_role` and `intelligence` checks; a login that can reach
  `libetech_ai` will refuse to start.
- Pre-checks: PostgreSQL ≥ 16; `libetech_ai` absent, or present with no membership in either direction and no LOGIN/SUPERUSER/BYPASSRLS/CREATEDB/
  CREATEROLE; `has_schema_privilege('public','public','CREATE')` evaluated for PUBLIC is false (M-6); `pg_default_acl` has no entry for PUBLIC or
  `libetech_ai`; migrations 001–020 recorded; record the superuser list in the receipt.
- Rollback preconditions: no version > `'021'`; today it drops rows without refusal (M-2) — never on real data without Chairman approval (OQ-20).
- Must NOT be done until the Chairman approves the data-to-model classification (OQ-14): no `ALTER ROLE libetech_ai LOGIN`, no password, no
  `GRANT libetech_ai TO …`, no login created for the pipeline, no key or connection string in any environment, no HTTP route (S24), no model call.

## Assessment

Migration 021, its rollback, the `assertRestrictedLogin` extension and the tests match the brief and the repo rules. The acceptance criterion holds
by privilege: `libetech_ai` has no INSERT/UPDATE (or any) privilege on any Z1/Z2 table and can write only `intelligence.ai_drafts` within its
scope and principal; only `libetech_runtime`, bound to the acting person, can record the confirmation. The one Important finding (I-1) is a gap in
the brief's guard, not in the implementation; it needs a planner decision before Task 12 (extend the 021 guard now, or enforce and test it in Task 12
and say so in the receipt). The Minor findings are hardening and test-strength items.

**Database verdict for Task 8:** Approved — conditional on I-1 being routed to the planner (extend the guard in 021 or carry it into Task 12 with a
test) before Task 12 starts.
