# Tier-1 database review — slice 1 (P1.0), migrations 013–015 + queries

- **Reviewer:** liberico-database-reviewer (advisory, R1/R2: recommendations only, no approval)
- **Pinned:** worktree `jolly-dewdney-bbabf0`, branch `slice-1-doc-ownership`, base `libetech-ai-os` @ `208d37b`, head `46439aa`
- **Date:** 2026-11-12
- **Method:** static read of every file in scope, plus `migrations/001`, `003`, `005`, `007`, `011`, `scripts/migrate.ts`, `src/server/db.ts`, `src/server/service.ts:57-70`, `docs/SLICE-BRIEFS.md:5-86`, ADR-002 1.1 and OQ-20…24, and the rollback, concurrency and isolation tests. **No database was connected and no EXPLAIN was run** (the brief did not allow it). Query-plan statements are therefore tagged `#inference`. Facts read from files are tagged `#fact`.

## Verdict: **NEEDS WORK**

No Critical findings. Three Important findings must be fixed before the Codex gate. Each fix is a few lines in files that have not been applied to any real database, so fixing them now costs much less than writing a corrective migration 016 later. The tenant/project isolation design is sound and matches the 011/005 house pattern. Race safety in the reviewed queries holds.

### Must-fix (Important)

| # | file:line | Rule | Summary |
|---|---|---|---|
| I-1 | `migrations/rollback/014_document_registry.sql:3` (also `rollback/013_project_registry.sql:3`) | M-03, rollback safety | `CASCADE` silently removes a constraint that belongs to migration 015, and nothing enforces the rollback order |
| I-2 | `migrations/013_project_registry.sql:102`, `migrations/014_document_registry.sql:134-135` | least privilege, E-DB-13 integrity | INSERT grants on audit and history tables cover the whole table, so the runtime can forge `created_at`, `id`, `quality_score`, `ingested_at`, `classification` and `version` |
| I-3 | `migrations/014_document_registry.sql:40` vs `:73-74` | E-DB-08 / QG #16 (MUST) | No index supports the FK `document_revisions(project_id,tenant_id) → projects` |

---

## Findings

### I-1 · Important · Rollback 014 uses CASCADE and neither 013 nor 014 checks rollback order

- **Where:** `migrations/rollback/014_document_registry.sql:3` `DROP TABLE IF EXISTS document_commands, document_revisions, document_records, document_templates CASCADE;`. The dependent object is `migrations/015_document_index_z2.sql:15` `FOREIGN KEY(document_id,tenant_id,project_id) REFERENCES document_records(...)`. The same gap exists in `rollback/013_project_registry.sql:3`: `registry_events` stores the document audit trail written by `src/server/documents.ts:117`, `:141`.
- **Scenario (#fact from DDL semantics, #inference for the outcome):** an operator runs rollback 014 on a copy where 015 is still applied, for example to retry 014 alone. `CASCADE` drops the FK constraint on `analytics.document_index` but keeps the table and its rows. Those rows are now orphans that still carry the titles of the dropped documents. `schema_migrations` still lists `015`, so a later forward run re-creates 014 but skips 015, and the index never gets its FK back. The result is a schema that matches neither a fresh install nor the pre-rollback state, with nothing to signal it. In the same way, rolling back 013 while 014 is live deletes every document audit event, and `load()` (`documents.ts:91`) then fails on a missing relation.
- **Why the tests miss it:** `tests/migrations-rollback.test.ts:43` only rolls back in reverse order (015 → 014 → 013). It never tries an out-of-order rollback, and it never compares the catalog (policies, grants, constraints, triggers) after the round trip with a fresh forward install.
- **Minimal fix:** drop `CASCADE`. Without it, PostgreSQL still drops the four tables and their circular FKs, because all of them are in the same statement. Then add an order guard to each rollback file:
  ```sql
  -- rollback/014, before the DROP
  DO $$ BEGIN IF to_regclass('analytics.document_index') IS NOT NULL THEN
    RAISE EXCEPTION 'Roll back 015 before 014'; END IF; END $$;
  -- rollback/013, before the DROP
  DO $$ BEGIN IF to_regclass('public.document_records') IS NOT NULL THEN
    RAISE EXCEPTION 'Roll back 014 before 013'; END IF; END $$;
  ```
  Add two test cases: an out-of-order rollback must raise, and a forward → rollback → forward run must produce a `pg_policies` / `information_schema.role_table_grants` / `column_privileges` / `pg_constraint` / `pg_trigger` snapshot equal to a fresh forward install.

### I-2 · Important · Table-level INSERT grants on audit and history tables

- **Where:** `013_project_registry.sql:102` `GRANT INSERT ON project_profiles, project_channels, registry_events`; `014_document_registry.sql:134` `GRANT INSERT ON document_records, document_revisions`; `:135` `GRANT SELECT, INSERT ON document_commands`. The house precedent for column-scoped INSERT is `migrations/007_team_onboarding_feedback.sql:26`.
- **Scenario (#fact):** `libetech_runtime` can insert `registry_events` rows with any `created_at`, `id` and `actor_id`. Neither the policy (`013:87-90`) nor an FK binds `actor_id` to the session person. The current test at `tests/project-registry.test.ts:18`, `:39` already shows that a hand-built event row is accepted. Because `load()` orders the audit trail by `created_at` (`documents.ts:92`), a backdated row reorders history. On `document_revisions` the runtime can set `quality_score` up to 1 and set `ingested_at` (two AR-05 / E-EXT-01 tracking fields) as well as `created_at`. On `document_records` it can set `classification`, `version` and `created_at`. The append-only trigger only stops UPDATE and DELETE, not a forged INSERT.
- **Minimal fix:** grant only the columns the services actually write, so the DB defaults stay authoritative. The column lists below come from `projects-registry.ts:45`, `:75`, `:88`, `documents.ts:53`, `:112`, `:135`:
  ```sql
  GRANT INSERT (tenant_id,project_id,objective,owner_bu,pm_label,vault_pointer,repo_url,status,updated_by) ON project_profiles TO libetech_runtime;
  GRANT INSERT (tenant_id,project_id,chat_id,topic_id,mode,policy_version,proposed_by) ON project_channels TO libetech_runtime;
  GRANT INSERT (tenant_id,project_id,entity_type,entity_id,actor_id,kind,command_key,payload) ON registry_events TO libetech_runtime;
  GRANT INSERT (tenant_id,project_id,ref_code,doc_type,title,template_id,source_type,canonical_uri,owner_label,metadata,source_links,review_due_at,registered_by) ON document_records TO libetech_runtime;
  GRANT INSERT (tenant_id,project_id,document_id,revision_no,based_on_revision_id,source_id,source_type,source_revision,source_hash,source_modified_at,changes,source_refs,proposed_by) ON document_revisions TO libetech_runtime;
  GRANT SELECT ON document_commands TO libetech_runtime;
  GRANT INSERT (tenant_id,project_id,actor_id,command_key,request_hash) ON document_commands TO libetech_runtime;
  ```
  Remove the literals `quality_score` = `0` and `hash_verification` = `'self_declared'` from `documents.ts:135-137` so the defaults at `014:35`, `:37` apply. The INSERT policy at `014:126` still checks `hash_verification`. Re-run the PGlite and PG16 suites, since a test may insert one of the excluded columns through the runtime.
  Optional defense-in-depth, the same as `005:72`: set `app.person_id` in `scoped()` (`db.ts:37`) and add `AND actor_id = nullif(current_setting('app.person_id',true),'')::uuid` to the `registry_events` and `document_commands` INSERT policies.

### I-3 · Important · Unindexed FK on `document_revisions(project_id,tenant_id)`

- **Where:** the FK is at `014_document_registry.sql:40`. The only index on these columns is `idx_document_revisions_document_scope_created (document_id,tenant_id,project_id,created_at)` (`:73`), which leads with `document_id`. None of the UNIQUE constraints at `:42` leads with `tenant_id` or `project_id`.
- **Scenario (#inference):** every check that touches `projects` against this FK, and any scope-wide scan under the RLS predicate (`tenant_id`, `project_id`), has to read the whole table. Projects are rarely deleted in practice, so the runtime impact is small, but this breaks a MUST checklist item (QG #16, "FK và created_at có index — tạo cùng migration"). Every other new table meets it.
- **Minimal fix:** `CREATE INDEX IF NOT EXISTS idx_document_revisions_scope_created ON document_revisions(tenant_id,project_id,created_at DESC);` in 014.

### M-1 · Minor · Concurrent projector runs can overwrite newer index data with an older snapshot under a fresh `projected_at`

- **Where:** `src/server/document-projector.ts:21-26`. The `ON CONFLICT DO UPDATE` writes unconditionally.
- **Scenario (#inference):** two operator or cron runs overlap for the same project. If the run with the older statement snapshot writes a row last, it resets `record_version` and the revision numbers to older values but stamps `projected_at=now()`. The UI then shows stale data as fresh. This is unlikely while the projector runs by hand (OQ-22 b), but it becomes realistic once the d1-ai1 job exists.
- **Fix:** take `SELECT pg_advisory_xact_lock(hashtextextended('document_index:'||$1||':'||$2,0))` after `set_config` (`:7`), and/or add `WHERE analytics.document_index.record_version <= EXCLUDED.record_version` to the `DO UPDATE`.

### M-2 · Minor · The audit-trail query in `load()` cannot use its index

- **Where:** `documents.ts:91-92` uses `WHERE entity_id=$1 OR (entity_type='document_revision' AND …)`. The index is `013:48` `(entity_type,entity_id,created_at)`.
- **Scenario (#inference, PG16 has no skip scan):** the first disjunct does not constrain the index's leading column, so the planner falls back to a sequential scan of `registry_events`. That table holds every registry event in the tenant, and the query runs on every document detail, register and propose call. It is cheap at P1.0 volumes but grows linearly.
- **Fix:** use `WHERE (entity_type='document' AND entity_id=$1) OR (entity_type='document_revision' AND entity_id IN (SELECT id FROM document_revisions WHERE document_id=$1))`. Semantics stay the same, because only `document` events carry a document id. The planner can then use a BitmapOr on the existing index.

### M-3 · Minor · List and search index fit (requested plan check)

- **Query:** `document-index.ts:38`, `:42-47`. RLS adds `tenant_id = … AND project_id = ANY(…)` (`015:30-32`). Both quals are stable and use leakproof `=`, so they can be index quals.
- **Expected plan (#inference):** an index or bitmap scan on the `(tenant_id,project_id,…)` prefix, which `015:16` and `:18` both provide, then a filter on the three-way `ILIKE '%q%'` (a leading wildcard cannot use a btree), then a top-N sort on `record_updated_at DESC, document_id`, then the limit. `count(*)` repeats the scan.
- **Expected sizes:** P1.0 holds tens of documents per project and possibly about 10³ within a year. At those sizes each call should take well under a millisecond, which is acceptable. At about 10⁵ rows per project, expect tens of milliseconds per call, and deep `OFFSET` pages grow linearly.
- **Index notes:**
  - `idx_document_index_scope_ref` (`015:19`) is not used by any query.
  - `ORDER BY record_updated_at DESC, document_id` has no supporting index.
  - **Fix:** replace `:19` with `(tenant_id,project_id,record_updated_at DESC,document_id)`. Defer `pg_trgm` GIN on `title`/`ref_code` to slice 4 (content search). It also cannot help queries shorter than 3 characters.
- **Verification to run:** the Builder or the Codex gate should capture `EXPLAIN (ANALYZE,BUFFERS)` on the throwaway PG16 at 10³ and 10⁵ synthetic rows per project for list, search, count and the M-2 query.
- **Locale (#hypothesis):** production runs `initdb --locale=C.UTF-8` (`deploy/install-user.py:92`). Under glibc C.UTF-8, `ILIKE` should fold Vietnamese capitals (Đ/đ, Á/á). PGlite may not, and the current search tests use ASCII queries only (`tests/document-index.test.ts:137-193`). Add a native PG16 case with an uppercase Vietnamese title and a lowercase query, and NFC-normalise titles at write time.

### M-4 · Minor · CSV export truncates silently at 5000 rows

- **Where:** `document-index.ts:10`, `:77`. `page.total` is computed but never checked.
- **Scenario:** a project with more than 5000 documents gets an export that looks complete but is not.
- **Fix:** if `total > EXPORT_MAX`, return a 413-class `AppError`, or append a marker row stating that the file is truncated.

### M-5 · Minor · Template version choice is not deterministic

- **Where:** `documents.ts:109` uses `ORDER BY created_at DESC, id`. `created_at DEFAULT now()` (`014:7`) is the transaction start time, and `syncTemplateIndex` inserts the whole manifest in one transaction (`document-templates.ts:12-19`).
- **Scenario:** if the manifest ever lists two versions of one code, both rows get the same `created_at`, so a random UUID decides which version a new document links to. Today the manifest has one version per code (`0.1.0` for T0–T6), so this is latent.
- **Fix:** select the manifest's current version explicitly: `AND template_version = $3`.

### M-6 · Minor · Z2 row has an FK into a Z1 domain table

- **Where:** `015:15` (`analytics.document_index → document_records`).
- **Scenario:** the coupling has three effects:
  - It caused the rollback interplay in I-1.
  - Each newly projected row takes a `FOR KEY SHARE` lock on its Z1 record until the projector commits. That lock conflicts with `proposeRevision`'s `FOR UPDATE` (`documents.ts:127`) (#inference, RI-trigger semantics).
  - It prevents ever moving Z2 to a separate schema owner or a replica (E-DB-10 allows a "read replica" analytics layer).
- **Precedent:** an FK to `projects` already exists in Z2 (`005:14`, `011:12`). An FK into a domain table is new.
- **Fix:** keep the `projects` FK and drop the `document_records` FK. Uniqueness and scope come from `UNIQUE(tenant_id,project_id,document_id)` and the projector's `WHERE`. If the FK is kept, the I-1 fix still covers rollback.

### M-7 · Minor · Constraint guard matches by name only

- **Where:** `014:55`, `:59`, `:63` use `pg_constraint WHERE conname=…`. A constraint name is unique per table, not per database.
- **Fix:** add `AND conrelid = 'public.document_records'::regclass` (and `'public.document_revisions'::regclass` for `:63`).

### M-8 · Minor · Actor columns have no tenant-scoped FK

- **Where:** `013:10` `updated_by`, `:21` `approver_id`/`proposed_by`, `:31` `confirmed_by`, `:41` `actor_id`; `014:23` `registered_by`, `:39` `proposed_by`, `:47` `actor_id`.
- **Precedent:** migrations 005 and 007 bind actors with `FOREIGN KEY(actor_id,tenant_id) REFERENCES identity.users(id,tenant_id)` (`005:31-32`, `007:42`, `:54`).
- **Scenario:** without it, a user id from another tenant can be recorded. That cannot happen through the service, because it takes `p.id`.
- **Fix:** add the same composite FKs, plus the matching indexes per E-DB-08.

### M-9 · Minor · `document_commands` responses can be overwritten

- **Where:** `014:86-91`, `:136`. The runtime can UPDATE `response` on any of its own project's command rows, which lets it change what a later replay returns.
- **Fix:** add `AND response IS NULL` to the `scope_update` USING clause. The claim's single update (`documents.ts:66`) still passes.

### M-10 · Minor · Row lock taken before the role check

- **Where:** `documents.ts:127-130`. A viewer locks the record `FOR UPDATE` before being refused with `READ_ONLY`.
- **Fix:** read the record without a lock, check the role, then lock (or use a second `FOR UPDATE` read).

### M-11 · Minor · Forward-looking gaps to record as OQs, not P1.0 blockers

- **Channel uniqueness:** `project_channels` is unique per `(tenant_id,project_id,chat_id,topic_id)` (`013:24`). That is correct for P1.0, because a global constraint would reveal another project's channel through a 409. Before P1.1 makes channels the effective source, add a partial unique index on `(chat_id,topic_id) WHERE state='active'`, scoped globally because a Telegram chat id is global. Also decide how a whole-chat row (`topic_id=''`) and a topic row may overlap.
- **E-DB-13 audit fields:** `registry_events` (`013:36-43`) has no `request_id` or `trace_id`. This gap is repo-wide: the server has no request or trace id today (grep of `src/server`). It matters before ProjectChannel becomes permission-bearing.
- **Production rollback plan:** the rollback headers (`rollback/013:1`, `014:1`, `015:1`) say "never run against production data". Quality Gate §III therefore requires a separate production rollback plan (feature flag off, or forward-fix) before the Chairman applies migrations. Write it into the delivery receipt, and state the 015 → 014 → 013 order in each header.

### M-12 · Minor · Hygiene

- `project_channels.version` has no `CHECK(version > 0)` (`013:22`).
- `document_revisions.source_type` has no CHECK, unlike `document_records` at `014:17` (`014:34`).
- `quality_score numeric(3,2)` on a 0–1 scale (`014:35`) follows the repo precedent (`001:42`) but differs from E-EXT-01's 0–100 INT. Record the deviation in AGENTS.md or CLAUDE.md, or align it.
- The phase gates in the INSERT policies (`013:59`, `:70`; `014:110-111`, `:126`) put P1.0 rules in the DB. That is justified as security gates under ADR-002 P1.0, but lifting them in P1.2 needs a migration. Note this in the ADR so E-DB-05 is a recorded exception.
- Row triggers do not fire on TRUNCATE. The runtime has no TRUNCATE privilege, and this is the same as `001:92-95`.

---

## Checklist: verified OK

| Check | Result | Evidence (#fact unless tagged) |
|---|---|---|
| UUID PK `gen_random_uuid()` | OK on all 9 new tables | `013:5,15,27,37`; `014:5,13,30,46`; `015:5` |
| `timestamptz` only | OK | every timestamp column in 013–015 |
| Composite FK to `projects(id,tenant_id)` | OK on 8/8 project-scoped tables; `document_templates` is tenant-scoped by design | `013:11,23,33,42`; `014:25,40,50`; `015:14` |
| Index on FK and `created_at` in the same file | OK except I-3 | `013:44-48`; `014:68-75`; `015:18-20` |
| RLS ENABLE + FORCE | OK on 9/9 | `013:49-50,60-61,71-72,81-82`; `014:76-77,92-97`; `015:21-22` |
| USING + WITH CHECK | OK. Per-command policies (SELECT USING / INSERT WITH CHECK / UPDATE both). Commands without a policy (all DELETE; UPDATE on channels, mappings, events, revisions) are denied by default, which is stricter than the 011 `FOR ALL` style (`011:34-38`) | `013:51-96`; `014:78-126`; Z2 is `TO`-role scoped like `005:44-53` (`015:24-32`) |
| Fail-closed without context | OK. `nullif('',…)::uuid` gives NULL; `string_to_array('',',')` gives `{}`, so `ANY` is false. Context is set with `set_config(…,true)`, which is transaction-scoped (`db.ts:37`, `document-projector.ts:7`). Tests: `tests/project-registry.test.ts:28-34`, `tests/documents.test.ts:114-135`. The runtime login has no BYPASSRLS (`tests/slice1-harness.test.ts:27-28`) | — |
| Column-level UPDATE grants | OK. The runtime cannot set `approved_revision_id`, `freeze_state`, `source_state` or `project_id`; tests at `tests/documents.test.ts:162-164`, `:181` | `013:103`; `014:136-137` |
| Column-level INSERT grants | **Not minimal**, see I-2 | — |
| Z2 write path | OK. Runtime has SELECT only; the projector has SELECT/INSERT/UPDATE and no DELETE; no `canonical_uri` in Z2 | `015:34-35`, `015:2-13` |
| AR-07 / E-DB-10 | OK. List, search and export read only `analytics.document_index`; detail and open-source go through the domain service | `document-index.ts:42-47`; `documents.ts:148-163` |
| Append-only triggers on history tables | OK. The shared `reject_history_mutation()` from `001:90-91` is reused, not redefined | `013:97-100`; `014:127-132` |
| Circular pointer FKs | OK. They are re-runnable through the `DO` guard (see M-7). The composite FKs bind `latest`, `approved` and `based_on` to the same document | `014:54-67` |
| Idempotent DDL | OK. `IF NOT EXISTS`; `DROP … IF EXISTS` before CREATE; `ON CONFLICT` on `schema_migrations`; `BEGIN … COMMIT` | `013:104`; `014:138`; `015:37` |
| Rollback completeness | Tables and `schema_migrations` rows are removed. Grants, policies, triggers and constraints go with the dropped tables. Rollback 015 revokes the projector's Z1 SELECT behind a `to_regclass` guard | `rollback/015:4-7` |
| Rollback never drops shared roles or functions | OK. `libetech_projector`, `analytics` USAGE (also granted at `005:78`) and `reject_history_mutation` are all kept. Order and CASCADE problems are in I-1 | `rollback/013`, `014`, `015` |
| Uniqueness semantics | OK. `canonical_uri` is unique per project (`014:27`), so a 409 cannot reveal a document in another project. The document command key is unique without `project_id` (`014:51`, OQ-24 b) | — |

## Lock order and race safety (all verified on paper; native concurrency tests exist)

- **`feedback.resolve`** (`feedback.ts:47-73`):
  - The order is the report row `FOR UPDATE`, then the atomic claim `INSERT … ON CONFLICT (tenant_id,actor_id,request_key) DO NOTHING`, then the replay comparison over every meaningful field, then the version and state checks.
  - If a check throws, the whole transaction rolls back and takes the claim with it.
  - Two identical requests: the second waits on the row lock, then sees the committed action and replays it.
  - The same key on another report: the second waits on the unique index, then gets 409.
  - A prior action hidden by RLS also gets 409.
  - No deadlock cycle: each transaction holds at most one report row and one key.
  - Tests: `tests/feedback-concurrency.test.ts` (native).
- **`proposeRevision`** (`documents.ts:126-146`):
  - The order is record `FOR UPDATE`, then `document_commands` claim, then the version and pointer check under the lock, then `max(revision_no)+1` (serialised by the lock; `UNIQUE(document_id,revision_no)` is the backstop), then the revision insert, the pointer update and the event.
  - Two proposals on the same version: one wins and the other gets `REVISION_CONFLICT`. The same key replays.
  - Tests: `tests/documents-concurrency.test.ts:33-52`.
- **`register` / `saveProfile` / `proposeChannel`:**
  - The order is the idempotency claim (`document_commands` or `commands`), then insert or `FOR UPDATE` with `version=` in the WHERE clause.
  - Duplicate URI, profile or channel: `ON CONFLICT DO NOTHING` returns 409, and the rollback removes the claim.
  - No cycle with `proposeRevision`: these paths never lock an existing `document_records` row; `load()` uses plain reads; FK `KEY SHARE` locks fall on `projects` and `document_templates`, which no path locks `FOR UPDATE`.
- **OQ-24 b cross-project key reuse:**
  - `ON CONFLICT DO NOTHING` does not apply SELECT policies to the existing row (#inference from PostgreSQL RLS rules).
  - So a key whose row sits in a hidden project returns no row, the replay read is empty, and the caller gets 409. That is what the decision requires.
  - Tests: `tests/documents-concurrency.test.ts:54-65`.
- **Projector:** see M-1 (overlapping runs) and M-6 (KEY SHARE on Z1 rows).

## Quality Gate §II migration safety

| Code | Result |
|---|---|
| M-01 sequential version | OK. 013, 014 and 015 follow 012. No other local or remote branch carries 013+ (`git ls-tree` across branches) |
| M-02 idempotent | OK. The test applies the forward files twice (`tests/migrations-rollback.test.ts:48-49`) |
| M-03 rollback | Present; must fix I-1. A production rollback plan is still needed (M-11) |
| M-04 DROP after ≥2 sprints | N/A. Forward migrations drop nothing |
| M-05 NOT NULL on an existing column | N/A. Only new tables |
| M-06 lock on large tables | N/A. Every table is new. The FK creation takes SHARE ROW EXCLUSIVE on `projects` (small, rarely written) and, in 015, on `document_records`, for the length of the migration transaction. Acceptable at deploy time |
| M-07 rename | N/A |
| Expand → migrate → contract | OK. Every change is an expand step. Making ProjectChannel the effective source is deferred to P1.1, as ADR-002 states |

## Not verified

- Live query plans: no database access was allowed.
- The PGlite and PG16 suites were not run.
- The test files were read only where cited.
- Production role membership of the operator login in `libetech_projector`, which `SET LOCAL ROLE` needs at `document-projector.ts:6`. It shares a precondition with `evidence-projector`; check it in the deploy receipt.
