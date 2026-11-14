# Tier 1 database review: slice 2 (intake + outbox + PM inbox)

Reviewer: `liberico-database-reviewer` (advisory). Range `ce11242..121d35a`, branch `slice-2-intake-outbox`, worktree `hopeful-northcutt-bf136c`.
Lens: migrations 016, 017, 018 and their `migrations/rollback/` files, plus every SQL statement in `src/server/{intake,outbox,inbox,ledger-reconcile,account-approval,accounts,identity}.ts`.
Evidence tags: #fact means I read the code or ran the probe; #inference means I reasoned from code I read; #hypothesis means not verified.
Probes ran on a private PGlite instance (PostgreSQL 18.6, PGlite 0.5.15) with synthetic data, under the real roles and RLS. I did not touch the native container, d1-ai1 or any real data. I edited no repository file and made no commit. The probe scripts live outside the repo, in `<scratchpad>` (`probe.mts`, `plans.mts`, `locks.mts`).

## Verdict

**READY WITH FIXES.** This is a recommendation to Chairman, not an approval.

- Critical: 0. Important: 1. Minor: 9. Notes: 3.
- The one Important item can be fixed before merge without touching real data: 017 is unreleased, and the fix is a guard in a DO block plus a check in `db.ts`.
- 018 is safe to apply to the live `identity.account_approvals` table once the pre-apply checklist below has been run. Applying it is still a Chairman stop point.

Standards that pass across all three migrations (#fact, read):

- Every new table has a `uuid` PK defaulting to `gen_random_uuid()`, plus `created_at` and `updated_at` as `timestamptz`. No money columns were added.
- `quality_score smallint CHECK BETWEEN 0 AND 100` holds on `source_events` (`016:20`) and `delivery_receipts` (`017:57`), as ruling S3 requires. Both tables carry all four E-EXT-01 fields (`source_id`, `ingested_at`, `source_type`, `quality_score`).
- Every FK and every `created_at` has an index in the same file (`016:89-106`, `017:79-95`).
- RLS is ENABLE plus FORCE on every table, with per-role policies carrying USING and WITH CHECK.
- Context is fail-closed: policies read `nullif(current_setting(..., true), '')`.
- Context is set only through `SET LOCAL ROLE` plus `set_config(..., true)` (`src/server/db.ts:33-40`, `src/server/intake-scope.ts`).
- INSERT grants are column-level.
- The history tables have immutable triggers.
- DDL is idempotent, and every forward migration has a rollback that refuses to run out of order.

---

## Findings

### Critical

None.

### Important

#### I-1. The 017 proof-by-privilege depends on a role-membership invariant that nothing enforces

This finding takes the deferred item at `progress.md:171` and adds new probe evidence. The deferred item alone would be ok to defer. With the evidence, it should be fixed before merge.

**Where**

- `migrations/017_outbox.sql:8-15` checks `rolcanlogin`, `rolsuper` and `rolbypassrls` on `libetech_outbox_audit`, but not `pg_auth_members`.
- `migrations/017_outbox.sql:317-321`: the comment claims that "a disagreement raises".
- `migrations/017_outbox.sql:329-339`: the definer trigger takes the invoking role from `current_setting('role')`, and the guard's record from `app.outbox_invoker`.
- `src/server/db.ts:19`: `pooledDatabase(..., requireRestricted)` checks superuser, bypassrls, createdb, createrole and table ownership, but not memberships.
- `migrations/016_intake_inbox.sql:5-13` creates `libetech_intake` and `libetech_intake_svc` only when they are missing. It never checks the attributes or memberships of roles that already exist.

**Scenario**

The proof of who changed an outbox state assumes two things:

1. No login can act as `libetech_outbox_audit`.
2. No login can act as both `libetech_runtime` and `libetech_intake`.

Neither assumption is checked anywhere.

- If assumption 2 breaks (#fact, probe): a session that can `SET ROLE` to both roles can forge the actor. It runs `UPDATE outbox_messages SET state='abandoned' ... RETURNING set_config('role','libetech_intake',true), set_config('app.outbox_invoker','libetech_intake',true)`.
  - The BEFORE guard runs as runtime and allows dead→abandoned.
  - The AFTER ROW trigger is queued until the end of the statement, so it runs after RETURNING. It reads the rewritten `role` and `app.outbox_invoker`, which agree, so it records `actor_kind='intake_service'` with the intake principal id.
  - The transaction commits. The audit row names the wrong actor.
  - Switching only `role` in RETURNING fails closed ("the invoking role could not be established").
  - The reverse direction was not probed. #inference: it is limited to requeue and abandon moves by the `actor_kind='user'` check at `017:308-311`.
- If assumption 1 breaks (#inference): anyone given `libetech_outbox_audit` can `SET ROLE` to it. They can then insert arbitrary state events directly, because the validator at `017:288` only checks `current_user`.

Neither path is open today. #fact: `libetech_web` and `libetech_auth` are NOINHERIT logins with a single membership each (`003`). `libetech_intake_svc` is a member of `libetech_intake` only (`016:13`). However, the deferred item at `progress.md:157` says maintenance and backfill tooling must use the runtime or intake roles. A tooling login granted both roles is exactly the setup that opens assumption 2.

**Fix (all pre-merge; 017 is unreleased)**

1. In the 017 DO block, raise if `libetech_outbox_audit` has any member or is itself a member of any role:
   `EXISTS (SELECT 1 FROM pg_auth_members WHERE roleid = 'libetech_outbox_audit'::regrole OR member = 'libetech_outbox_audit'::regrole)`.
2. In the same DO block, and also in 016 (see M-5), raise if any role is a member of both `libetech_runtime` and `libetech_intake`, directly or through another role. Use `pg_has_role(r.oid, 'libetech_runtime', 'MEMBER') AND pg_has_role(r.oid, 'libetech_intake', 'MEMBER')` over `pg_roles`, excluding superusers.
3. Extend the restricted check in `db.ts:19` so that a runtime login refuses to start if it can reach more than one of `libetech_runtime`, `libetech_intake`, `libetech_identity` and `libetech_outbox_audit`. Use `pg_has_role(current_user, x, 'MEMBER')`.
4. Rewrite the comment at `017:317-321` so it states the invariant the proof depends on ("no login is a member of both app roles; no role is a member of the audit role"), rather than implying the check alone is enough.
5. Add a negative test: grant one test login both roles, run the RETURNING forgery, and expect the 017 guard or the `db.ts` check to refuse.

### Minor

#### M-1. 018 sets no `lock_timeout` before it takes ACCESS EXCLUSIVE on a live identity table

**Where:** `migrations/018_access_change_approval.sql:7-29`, `scripts/migrate.ts:7-15` and `deploy/install-user.py:135-138`. Neither apply path sets `lock_timeout`.

**Measured (#fact, probe):** applying 018 takes these locks:
- On `identity.account_approvals`: AccessExclusive, ShareRowExclusive, Share and AccessShare.
- On `identity.users`: ShareRowExclusive and RowShare. The new FK takes ShareRowExclusive on the referenced table.

**Scenario:** if a long transaction holds any lock on `account_approvals`, 018 queues behind it. Every later login, vote or registration read then queues behind 018. The ShareRowExclusive on `identity.users` also blocks user writes for the same time. On a two-row table the DDL itself takes milliseconds; the risk is only the lock queue.

**Fix:** add `SET LOCAL lock_timeout = '5s';` after `BEGIN` in 018, or set it in the apply command. A timeout means retry, not a partial apply: the file is a single transaction.

#### M-2. `libetech_identity` holds table-level INSERT on `identity.account_approvals`, and 018 widens what that grant covers

**Where:** `migrations/009_telegram_account_approval.sql:67-68`, and the comment at `018:5` ("no grant is needed").

**Scenario (#fact, probe):** the identity role can insert an access_change row with `state='approved'` and any `grants` or `previous_grants`. This does not lead to a privilege change.
- `approvalReady` (`src/server/account-approval.ts:76-86`) re-tallies frozen voters and votes.
- `accounts.ts:212-215` also requires a matching `subject_account_version`, plus `sameGrants` on the ballot's grants and its `previous_grants`.

The gap is defence in depth against a compromised identity path, and it matches the table-level grants on voters and votes, which 009 already had.

**Fix:** in a later migration, replace the table-level grant with column-level INSERT on `tenant_id`, `kind`, `registration_id`, `subject_user_id`, `subject_account_version`, `previous_grants`, `proposer_id`, `grants`, `reason` and `expires_at` (only if the code writes it). That way `state`, `id` and the timestamps stay owned by defaults, as in 013, 014 and 016. Do the same later for voters and votes. Not a merge blocker.

#### M-3. `failures()` hides `leased` rows whose lease has expired

**Where:** `src/server/inbox.ts:223`, which lists only `dead`, `uncertain` and overdue `pending` rows.

**Scenario:** rows move from leased to uncertain only inside `pull` (`src/server/outbox.ts:116-120`). If the gateway stops pulling, rows stay `leased` past `lease_expires_at` forever, and the PM inbox shows nothing. That is the failure an operator most needs to see.

**Fix:** add `OR (state='leased' AND lease_expires_at < now())` to the predicate and mark those rows overdue. The query keeps its `LIMIT 200` and the bitmap plan measured below (0.04 ms).

#### M-4. The expired-lease sweep in `pull` has no LIMIT

**Where:** `src/server/outbox.ts:116`.

**Scenario:** after a long gateway outage with a large leased backlog, a single `pull` locks every expired row in one transaction. It then writes one state event and one audit row for each, all in the same gateway request. `statement_timeout` (`db.ts:15`) applies to each statement, not to the transaction, so nothing bounds the total. #inference: if the gateway's HTTP call gives up first, the transaction rolls back and the next pull starts the whole sweep again. Meanwhile the leased rows stay locked. The SELECT itself is cheap (0.02 ms measured on an empty set); the per-row work is what grows.

**Fix:** `LIMIT $2` (the same `limit` as the due batch), with `FOR UPDATE SKIP LOCKED`. The next pull continues the sweep.

#### M-5. 016 does not verify roles that already exist

**Where:** `migrations/016_intake_inbox.sql:5-13`.

**Scenario:** a pre-existing `libetech_intake` with LOGIN or BYPASSRLS, or a pre-existing `libetech_intake_svc` with extra memberships, is accepted silently. 017 performs the same check for its own role (`017:12-14`). 016 does not.

**Fix:** copy the 017 attribute check for both roles. Also require that `libetech_intake_svc` reaches no app role other than `libetech_intake`. This is part of I-1's fix, step 2.

#### M-6. `intake_candidates` updates rely on the service alone for version, actor and state rules

**Where:** `migrations/016_intake_inbox.sql:174-178` and `:225`. The runtime role has UPDATE on `state`, `classification`, `duplicate_of`, `missing_fields`, `note`, `ticket_ref`, `decided_by`, `version` and `updated_at`. There is no BEFORE UPDATE guard.

**Scenario (#fact, test `tests/intake-schema.test.ts:114`):** any runtime path can set `state` to any allowed value, set `decided_by` to any uuid, and leave `version` unchanged. `InboxService` does enforce expected version and transitions (#fact, `inbox.ts`). The outbox has a DB-level guard (`017:229-280`); candidates do not. This is the same rule-placement question (E-DB-05 versus E-INT-05) that 017 answered the other way.

**Fix:** either accept it and record that candidate transitions are application-only, or add a small guard trigger: `NEW.version = OLD.version + 1`, and `NEW.decided_by = nullif(current_setting('app.person_id', true), '')::uuid` when `state` changes. Not a merge blocker. Related deferred test gap: M5 at `progress.md:63`.

#### M-7. `previous_grants` and `grants` have no jsonb shape check

**Where:** `migrations/018_access_change_approval.sql:11` and `:16-19`.

**Scenario:** a non-array `previous_grants` value passes the shape CHECK. `accounts.ts:213` then throws a parse error inside `sameGrants`. The failure is closed and noisy rather than silent.

**Fix (optional):** add `jsonb_typeof(previous_grants) = 'array'` to the access_change branch of `account_approvals_kind_shape`. Because this changes an unreleased migration, do it before 018 reaches real data, or not at all.

#### M-8. Integrity CHECKs missing on outbox counters

**Where:** `migrations/017_outbox.sql:32` (`attempt_no integer NOT NULL DEFAULT 0`, no CHECK) and `:37` (`version integer NOT NULL DEFAULT 1`, no CHECK).

**Scenario:** a negative `attempt_no` or a `version` of 0 is accepted. The guard limits who can change these columns but not their range.

**Fix:** add `CHECK (attempt_no >= 0)` and `CHECK (version >= 1)`. These are cheap, and 017 is unreleased.

#### M-9. Redundant indexes

**Where:**
- `016:98` `idx_intake_attachments_revision_fk` duplicates the leading column of `UNIQUE(revision_id)` (`016:59`).
- On `delivery_receipts`, three indexes lead with `outbox_id`: `017:86` `(outbox_id, created_at)`, `017:90` `(outbox_id, tenant_id)` and the UNIQUE at `017:60`.
- On `outbox_state_events`, three more do the same: `017:91`, `017:95` and the UNIQUE at `017:76`.

**Scenario:** extra write work on every insert, and no query benefits. Each remains correct.

**Fix (optional):** keep the exact FK-matching index plus one `created_at` index per table, and drop the others. Not worth a migration change unless 017 is being edited anyway for I-1.

### Notes (no action needed)

- N-1. `outbox_state_events.trace_id` is nullable (`017:73`), but the definer trigger always fills it from `NEW.trace_id`. That column is `NOT NULL` on `outbox_messages` (`017:23`, `:341`). There is no gap in practice. `SET NOT NULL` could be added with I-1 for clarity.
- N-2. The `delivery_receipts.source_id` value is `${outbox}:${attempt}:${phase}` (`outbox.ts`, `report`). That is an internal composite key, not a gateway identifier. E-EXT-01 is met in form. The gateway's `telegram_message_id` is the external reference. Ledger reconciliation should not treat `source_id` as a Telegram id.
- N-3. `intake.ts:62` reads `project_domain_mappings` through a `TO PUBLIC` select policy. I found no write path for the intake role there. The slice adds no mapping rows (#fact, grep).

---

## 018 on live data (S2 focus)

Context (#fact): `identity.account_approvals` on d1-ai1 holds two unvoted registration ballots. 013-015 have not been applied to any real database either (`docs/DELIVERY-010-project-document-registry-20261112.md:8`), so the real apply is 013 through 018 in one window.

### What 018 does to the existing rows (#fact, probe with two pending registration ballots)

- `ADD COLUMN kind text NOT NULL DEFAULT 'registration' CHECK(...)`.
  - On PostgreSQL 11 and later, a constant default is stored in the catalog. The table is not rewritten, and the two rows read `kind='registration'`.
  - The inline CHECK and `account_approvals_kind_shape` validate both rows: `registration_id IS NOT NULL` and `subject_user_id IS NULL`.
- The other three columns are nullable with no default, so they are added without validation.
- `ALTER COLUMN registration_id DROP NOT NULL` is a catalog change only.
- `account_approvals_subject_fk` validates trivially: `subject_user_id` is NULL on both rows.
- The two new indexes are built over two rows.
- The old code path still works:
  - An INSERT without `kind` gets `'registration'`.
  - An INSERT with a NULL `registration_id` is refused by the shape CHECK.
  - The 009 partial unique index on `(tenant_id, registration_id)` still holds for registrations.
  - `identity.ts:109-111` filters `a.kind='registration'`, so activation cannot pick up an access_change ballot.
- Rerunning 018 is idempotent (#fact).
- A second open access_change ballot for the same subject is refused by `account_approval_active_access_change` (#fact). An access_change row that carries a `registration_id` is refused by the shape CHECK (#fact).

### Rollback behaviour (#fact, probe)

- `rollback/018` refuses with "access_change ballots exist" while any access_change row exists, and leaves the schema unchanged. It reads with `row_security = off`, so a role that RLS would filter gets an error, not a false count of zero.
- With no access_change rows, it drops 018's objects in the right order and restores `registration_id NOT NULL`. That succeeds because every remaining row is a registration with a `registration_id`.
- Once a single access_change ballot exists, 018 can only be fixed forward. Rolling back would mean deleting governance records, which needs its own Chairman decision. Record this in the release plan as the forward-fix plan (Quality Gate R-05).

### One table or separate tables

**Recommendation: keep the single table.**

- Separate tables would have isolated invitations structurally, and would have started with fresh column-level grants (which would have avoided M-2).
- But they would have duplicated the voters, votes and tally code, and the frozen-voter logic in `account-approval.ts` that both ballot kinds now share.
- The isolation separate tables would provide is already enforced in three places:
  - the shape CHECK (`018:16-19`);
  - the kind filter in `approvalReady` (`account-approval.ts:79`), so an invitation asks only for `'registration'`;
  - `identity.ts:109-111`.
- Optional hardening, for later: a composite FK from `identity.invitations(account_approval_id, 'registration')` to `account_approvals(id, kind)` would make "an invitation can only reference a registration ballot" structural.

### Deploy order

- The code depends on 018: `APPROVAL_COLS` selects `kind`. Migrate first, then deploy the code.
- To roll back, revert the code first, then roll back 018, and only while no access_change row exists.

### Pre-apply checklist for d1-ai1 (for Chairman to authorise; I ran none of it)

1. Take a backup and test the restore on a scratch database before the window.
2. Read `SELECT version FROM schema_migrations ORDER BY 1` and confirm that 012 is the latest applied version.
3. Record the two live ballots before the apply:
   `SELECT count(*), state, (registration_id IS NOT NULL) FROM identity.account_approvals GROUP BY 2, 3`.
   Keep the ids for the comparison after the apply. Do not paste them into the repo.
4. Read the roles before the apply: attributes from `pg_roles` and memberships from `pg_auth_members`. Confirm all of the following:
   - `libetech_web` reaches only `libetech_runtime`.
   - `libetech_auth` reaches only `libetech_identity`.
   - `libetech_intake_svc`, if it already exists, reaches only `libetech_intake`.
   - `libetech_outbox_audit`, if it already exists, has no members.
   - No app login has BYPASSRLS or SUPERUSER.
5. Apply 013→018 in order with the superuser migration login, the same path as `deploy/install-user.py:135-138`. 017's `ALTER FUNCTION ... OWNER TO libetech_outbox_audit` needs a superuser, or a role that can become the new owner and that holds CREATE on `public`. Set `lock_timeout` (M-1) and choose an off-peak window, away from 08:30 and Friday 16:00.
6. After the apply, confirm:
   - The same two ballot ids exist, with the same `state`, `kind='registration'`, `registration_id` not NULL, and the new columns NULL.
   - `SELECT count(*) FROM identity.account_approvals WHERE kind='access_change'` returns 0.
   - `schema_migrations` lists 013 through 018.
7. Before any rollback of 018, repeat the access_change count. If it is not 0, do not roll back; fix forward.
8. Repeat step 4 after the apply. 016 and 017 create roles, so the membership invariant from I-1 must hold on the real cluster.

---

## Deferred-items triage (my area only)

| Deferred item (source) | Triage | Why |
|---|---|---|
| 017 DO block checks no `pg_auth_members` for the audit role (`progress.md:171`) | **Must fix before merge** | Folded into I-1. The probe shows that the membership invariant is what the attribution proof rests on. |
| Forward 017 no longer drops the 0742c12 draft objects (`progress.md:172`) | Ok to defer | 017 was never released. Only test copies that carry the draft are affected. Adding `DROP ... IF EXISTS` lines is cheap if 017 is edited for I-1 anyway. |
| `reject_history_mutation` (001) has no pinned `search_path` (`progress.md:143`) | Ok to defer | It only raises and reads no object (`001:90-91`), so there is nothing for a `pg_temp` shadow to resolve. Fixing it needs a new migration. |
| Identity UPDATE grant on `outbox_messages` lacks `version` (`progress.md:143`) | Ok to defer | `acknowledged_at` is set once and is separate from delivery state (ruling `progress.md:187`). The guard freezes it after the first set (`tests/outbox-schema.test.ts:122`). |
| A multi-row state UPDATE fails (`progress.md:168`) | Ok to defer | It fails closed ("needs app.outbox_signal", #fact probe). Every app path updates one row. Document it for maintenance tooling. |
| The guard allows a same-state `version+1` bump (`progress.md:153`) | Ok to defer | Events are written by the DB on real state changes. A spurious bump only forces a client retry. |
| A signal survives a same-state update in the same transaction (`progress.md:156`) | Ok to defer | The validator still binds it to a legal (from, to) pair. The only slack is between signals that are legal for the same move. |
| Only intake or runtime can change outbox state (`progress.md:157`) | Ok to defer (intended) | Tooling must use those roles, and a tooling login must not hold both (I-1). |
| Second-layer test disables the trigger on the shared DB (`progress.md:109`) | Ok to defer | Test hygiene only. Prefer `DISABLE TRIGGER` inside a transaction that is rolled back. |
| M5: no cross-project/tenant UPDATE 0-row test for runtime on candidates (`progress.md:63`) | Ok to defer | The RLS policy has both USING and WITH CHECK (`016:174-178`, #fact). The test closes the E-TEST-01 34c row; add it with M-6. |
| M6: `pointer_only` still stores `file_name` and `source_actor_label`; the sha256 has no salt (`progress.md:64`) | **Needs Chairman** (OQ-28) | This is a data-retention decision, not a schema defect. |
| M7: rollbacks 013-015 do not refuse while 016 is applied; `rollback/016` does not revoke USAGE (`progress.md:65`) | Ok to defer | Only test copies run rollbacks without Chairman approval (`AGENTS.md`). USAGE on `public` grants no table access by itself. |
| T7: `failures()` shows group rows only, so ballot DMs have no operator view (`progress.md:214`) | **Needs Chairman** / T12 | It is a product-surface decision. M-3 above is a separate, smaller gap within group rows. |
| T7: the `lat` CTE recomputes the newest revision on every list, loadCard and command (`progress.md:217`) | Ok to defer, with numbers | #fact, probe at 10k candidates per project: list page 50 takes about 107 ms and loadCard about 19 ms. The CTE is materialized over the whole project, because it is referenced twice. Time grows linearly. Fix before volume: restrict `lat` to the page's ids, or keep a `current_revision_id` on candidates. |
| T8: `inboxRows` has no LIMIT and filters `observed_at` with no index (`progress.md:215`) | Ok to defer | No route exposes it in this slice. #fact probe: 9 ms for 1,778 rows, using the project FK index plus a filter and sort. Before OQ-26 wires the ledger feed, bound the window and add `(project_id, observed_at)`. |
| T9: acknowledgement before delivery leaves the DM pending (`progress.md:216`) | Ok to defer | It is documented, and the vote event is the audit record. No integrity effect. |
| M8, M9, M12 (bridge nonce order, circular import, long lines) | Outside the DB lens | No schema or query impact. |

---

## Query plans (#fact, PGlite, N=20,000 source events, 10k per project, ANALYZE run)

| Query | Plan | Time |
|---|---|---|
| `pull`, due batch (`outbox.ts:122`, `FOR UPDATE SKIP LOCKED LIMIT`) | `idx_outbox_messages_created` with a filter, then LockRows | 0.12 ms |
| `pull`, expired leases (`outbox.ts:116`, no LIMIT) | `idx_outbox_messages_due` | 0.02 ms (empty set; see M-4) |
| Inbox `list`, page 50 (`inbox.ts:59-74`, `:107-120`) | `lat` CTE materialized over the whole project, then sort | about 107 ms |
| Inbox `loadCard`, one id | Same CTE over the whole project | about 19 ms |
| Detail events (`inbox.ts:134`) | `idx_intake_events_entity` | 0.2 ms |
| `failures` (`inbox.ts:218-227`, LIMIT 200) | Bitmap scans | 0.04 ms |
| `inboxRows` (`ledger-reconcile.ts:41-48`, no LIMIT) | Project FK index, `observed_at` filter, sort | 9 ms, 1,778 rows |

PGlite runs single-user with no concurrency. These numbers show the shape of each plan, not production latency.

---

## What I could not verify

- **Native PostgreSQL 16.** Every probe ran on PGlite (PostgreSQL 18.6). The behaviour I relied on is documented as the same since PostgreSQL 11 or earlier: metadata-only ADD COLUMN with a constant default, lock modes for ALTER TABLE and ADD FOREIGN KEY, AFTER ROW trigger timing relative to RETURNING, and `set_config('role', ...)` inside RETURNING. #hypothesis: native 16 matches. I did not use the native container.
- **d1-ai1.** I could not read the real role memberships, the real `schema_migrations`, or the two live ballots. The checklist above covers each of these.
- **Lock contention under real traffic.** I measured which locks 018 takes, not how long it waits behind other sessions.
- **Plans with production statistics or concurrent load.**
- **PgBouncer transaction mode.** The repo uses `pg.Pool` directly (`db.ts:15`). I did not test `SET LOCAL` behaviour behind an external pooler, because none is configured.
- Whether the reverse forgery direction in I-1 (an intake-approved move recorded as a user) is fully closed by `017:308-311`. #inference: yes, for every move other than requeue and abandon. Not probed.
