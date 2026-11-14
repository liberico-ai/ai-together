# Tier 1 security review — slice 2 (intake + outbox + PM inbox)

Reviewer: liberico-security-reviewer (advisory, R1/R2). Range `ce11242..121d35a`, branch `slice-2-intake-outbox`.
Date: 2026-11-14. Nothing in the repository was edited, committed or run against real data.

## Verdict

**READY WITH FIXES.** This is a recommendation to the Chairman, not an approval.

- Critical: 0
- Important: 1
- Minor: 7
- Deferred-ledger items I triaged as **must fix before merge**: 1 (ledger M5, `progress.md:63`).
- Ledger items I triaged as **must fix before 017 reaches any database other than test**: 1 (`progress.md:171`).

The bridge authentication, scope derivation, inbox role gate, access-change ballot and the proof-by-privilege audit trigger all hold under the probes listed below. The one Important finding is a redaction gap. It is latent today because every real project resolves to `pointer_only`, but it becomes a stored-credential leak the moment a LIBERICO_BU or XECA mapping row exists.

## Step 0 — secrets and public-repo scan

All results #fact, from `git diff ce11242..121d35a`, `git ls-files` and `git log`:

- **Secret-named files.** No tracked file matches `.env`, secret, credential, key or token, apart from source files whose names contain those words as code identifiers.
- **Tokens.** None of the known token formats appears with a realistic value. The only token-shaped strings are synthetic fixtures in the redaction tests.
- **Connection strings.** These use `example.test` only. IP addresses are loopback only.
- **Test keys.** Generated with `randomBytes` (`tests/slice2-fixtures.ts`). No literal key is committed.
- **Chat ids.** New and changed files use synthetic ids only. The pre-existing real-looking ids in two scripts are already tracked by `docs/reviews/AUDIT-telegram-ids-20261112.md` and `progress.md:264`. Noted, not re-raised.
- **Realistic sample name.** The one at `tests/test_bot_bridge.py:52` is a frozen original (`progress.md:249`). Noted, not re-raised.
- **Ignored folders.** No file under `data/`, `.next/`, `coverage/` or `.superpowers/` appears in the branch history. The branch adds no file outside `src/`, `tests/`, `migrations/`, `docs/` and `bot-plugin/`.
- **`.gitignore`.** Covers `.env*`, `data/`, `.next`, `*.pem` and `*.key`. `.superpowers/` is excluded only through `.git/info/exclude`, which is local to this clone (see M7).

## Findings

### Important

**I1 — `redactSecrets` misses the team's ordinary ways of writing a credential**

- Location: `src/server/intake-rules.ts:18` (`KW`), `:45` (`SPACED`), `:46-51` (`FORMATS`). The redacted text is stored at `src/server/intake.ts:80`.
- Evidence (#fact, probe run with `npx tsx` against the branch code, synthetic values only, probe file deleted afterwards). These phrasings came back unmasked:
  - The Vietnamese words for "password", with or without diacritics, and the common short form `mk`, followed by a colon.
  - A short `pass` keyword.
  - `passcode=` and `otp:`.
  - An HTTP `Authorization: Basic` header, both plain and inside JSON quotes.
  - A PEM private-key block of the OpenSSH type.
- A second, smaller defect (#fact): in the phrasing "`<keyword>` is `<value>`", `SPACED` masks the word "is" and leaves the value in clear.
- Correctly masked (#fact): `PASSWORD <value>` and `<keyword>=<value>`.
- Failure scenario (#inference):
  1. An authorized person records a `project_domain_mappings` row of LIBERICO_BU or XECA for a project. No application code in `src/` writes this table (#fact, `git grep`), so the row would come from operator action.
  2. From then on, `intake.ts:63` puts that project in `excerpt` mode.
  3. A team member pastes Wi-Fi, server or vendor-portal credentials into the group in Vietnamese.
  4. Up to 4096 characters land in `source_event_revisions.text_excerpt`, which is immutable by trigger, and are shown to every manager, engineer, technical and business reader of the project in the Inbox.
- Why this is not the class ruled out at `progress.md:102`: that ruling parks *unusual syntax* (`:=`, `=>`, escaped JSON, run-together pairs) as known limitations. These cases are the plain, most likely phrasings in the team's working language, plus two standard credential carriers (Basic auth, PEM). The keyword list was written in English only.
- Recommended fix:
  - Extend `KW` with the Vietnamese words for password, both with and without diacritics, plus `mk`, `pass`, `passcode`, `otp` and `pin`, each bounded by word boundaries.
  - Add a `Basic\s+[A-Za-z0-9+/=]{8,}` format.
  - Add a `-----BEGIN [A-Z ]*PRIVATE KEY-----` to `-----END ...-----` block format.
  - Make `SPACED` skip a single linking word (`is`, `la`/`là`) before taking the value.
  - Add one test per case.
- Gate: before any mapping row puts a project in excerpt mode. Cheap enough to land in this branch.
- Owner: Builder. Approver: Chairman.

### Minor

**M1 — A malformed bridge config returns 422, which the plugin treats as final, so intake is dropped silently**

- Location: `src/app/api/bridge/[...path]/route.ts:13` and `src/server/http.ts:10`.
- Evidence (#fact): `loadBridgeConfig()` runs inside the `try` block. A JSON `SyntaxError` or `ZodError`, for example the key-equality refinement or the intake-chats ⊆ chatScopes refinement, reaches `failure()` and becomes 422 INVALID_INPUT. The plugin's `_failure_kind` (`bot-plugin/__init__.py:180-189`) classifies 422 as `final`. Each message is dropped with a fixed code and is not spooled.
- Failure scenario (#inference): an operator mistypes the intake block. Every group message during that window is lost rather than spooled for retry. The bot route shares the loader (`src/server/bridge.ts`), so it fails the same way.
- Fix: catch config-load errors in the route and map them to 503 `BRIDGE_UNCONFIGURED`/`INTAKE_UNCONFIGURED`. The plugin already spools on 5xx.

**M2 — The unauthenticated body is fully buffered before the size cap**

- Location: `src/server/bridge-auth.ts:10`.
- Evidence (#fact): `request.text()` reads the whole body, then checks `maxBytes`. The same pattern existed in the base `bridge.ts`.
- Exposure: loopback only. `docs/DEPLOY-003-team-access.md:103-104` returns 404 at nginx for `/api/bridge` and `^~ /api/bridge/`.
- Fix: read the body with a bounded stream reader that stops after `maxBytes + 1`. Low priority while the 404 holds.

**M3 — Full chat id shown in Inbox cards and source props while the source list masks it**

- Location: `src/components/inbox.tsx:91,93` (`card.sourceRef` = `telegram:<chat>:<msg>`), `src/server/inbox.ts:199-211` (`sources()` returns full `chatId`, passed as client props by `src/app/inbox/page.tsx`).
- Evidence (#fact): `src/components/inbox.tsx:21` masks with `chatTail`. The card shows the full id. Readers are project-scoped, so this is not a cross-tenant leak.
- Fix: return a tail, or a server-side reference, in `sourceRef` and `sources`. Keep the full id in the DB only. This matters more while the repo is public and screenshots get shared.

**M4 — File names are not stripped of bidi and format control characters**

- Location: `src/server/intake-rules.ts:77-80` (`cleanFileName`) and `bot-plugin/__init__.py:449` (`_file_name`).
- Evidence (#fact): only C0 controls and DEL are removed. U+202A–202E, U+2066–2069 and U+200E/F pass through and are rendered in the Inbox attachment list.
- Failure scenario (#inference): a name built with a right-to-left override displays as a harmless extension (a `.pdf` look-alike) while the real extension differs. Content is never served from the name, so the impact is social engineering only.
- Fix: strip `\p{Cf}` (or the listed ranges) on both sides.

**M5 — Plugin `_deliver` does not re-check the group target against the gateway allowlist**

- Location: `bot-plugin/__init__.py:839-852`.
- Evidence (#fact): the target comes from the backend's pull response. The server binds group targets by trigger to a visible `source_events` row (017 bind_target).
- Failure scenario (#inference): only if the backend or its DB were compromised could it direct the bot to post into a chat outside `intake.json` `chats`.
- Fix: refuse a group target not in `chats` as defense in depth. This belongs to the wiring round that connects real `send`.

**M6 — `actor_id` in audit rows is the app's claim, not something the DB proves**

- Location: the `migrations/016_intake_inbox.sql` binding at `:185-199` and the `migrations/017_outbox.sql` state-event trigger at `:322-347`. Both take the person or principal from `app.person_id` / `app.intake_principal_id`.
- Evidence (#fact): the DB proves the role through `current_setting('role')`, which is cross-checked with `app.outbox_invoker`. The person id is a GUC the authenticated server process sets. A compromised runtime process could therefore write a false actor under its own role.
- Fix: none required now. Record it as a known limit next to the proof-by-privilege note, so nobody later reads `actor_id` as DB-attested.

**M7 — `.superpowers/` is excluded only locally while the repo is public**

- Location: `.git/info/exclude`, not `.gitignore`.
- Failure scenario (#inference): another clone, a CI checkout or a `git add -A` from a fresh worktree publishes review packages. These include full diffs and ledger notes about stop points and limits.
- Fix: add `.superpowers/` to `.gitignore`.

## Lens results that held (no finding)

All #fact, from code reads and the tests cited.

**Bridge auth**
- The signing text binds timestamp, nonce, method and route path (`bridge-auth.ts:5`). The compare is timing-safe on fixed 32-byte buffers (`:14`). The timestamp window is ±60 s (`:12`).
- A nonce is single-use through `ON CONFLICT DO NOTHING` with a 2-minute TTL (`:15-16`).
- The throttle bucket is separate (`bridge-intake`).
- Key length must be at least 43 characters, else 503 (`:9`).
- The intake key must differ from the bot key (`bridge-config.ts:14`). A missing config returns 503.
- Tests: `tests/bridge-io.test.ts` covers wrong key, stale timestamp, nonce reuse, cross-path replay, key separation and oversize.

**Principal and scope**
- The strict schema rejects tenant, project and actor fields (`intake.ts:20-25`).
- The chat must be in `intakeChats` (`:45`). The project comes from `chatScopes` only, and an ambiguous mapping returns 409 (`:46-48`).
- ProjectChannel is not read for authority, and the intake role has no grant on it.
- `intakeScoped` uses `SET LOCAL ROLE` plus transaction-local GUCs. An empty project list returns 401.

**Inbox roles (S5)**
- Read is limited to manager, engineer, technical and business; act is limited to manager.
- Viewer, bot and unknown ids all get the same SCOPE_DENIED 404 from `locate()`.
- Non-GET requests pass `checkOrigin`. The request id is minted on the server.

**Access-change ballots (018)**
- Only an admin can start one, and never on themselves (`accounts.ts` `operator()`, `cmd.userId!==p.id`).
- The subject's seat is excluded from voters (`account-approval.ts` `frozenVoters`, `verifiedApprovalSeats(excludeUserId)`).
- Widening requires all of these together:
  - `approvalReady(...,'access_change')`;
  - an equal `subject_account_version`;
  - `sameGrants` on both the proposed and the previous grants.
- The ballot moves to `issued` and the version bumps, so it cannot be replayed. A stale ballot is closed on vote.
- Invitations require `kind='registration'` (`identity.ts`), so an access-change ballot cannot be used as an invitation.
- Removing access needs no ballot (`reducesAccess`). I judge this correct, not a widening path.

**Database privilege**
- `libetech_web`, `libetech_auth` and `libetech_intake_svc` are NOINHERIT logins without BYPASSRLS (`003`, `016:5-13`).
- All 016/017 tables are ENABLE + FORCE RLS, with per-role policies and column-level INSERT grants (`016:213-226`).
- Proof by privilege holds:
  - INSERT on `outbox_state_events` is revoked from every app role and PUBLIC, and granted only to NOLOGIN `libetech_outbox_audit`, which owns the SECURITY DEFINER trigger. That trigger has a pinned `search_path` and REVOKE ALL FROM PUBLIC.
  - `tests/outbox-schema.test.ts:470-597` covers a pg_temp function forgery, attaching to a temp table, and zero members asserted by test.
  - Remaining dependency: zero members. See the triage entry for `progress.md:171`.

**S10 — `pointer_only` keeps no text**
- `intake.ts:80` stores a null excerpt.
- `inbox.ts` `detail()` nulls the hash and excerpt.
- The S10 test scans `row::text` across the five tables and spies on the logger and console (`progress.md:47`).
- Plugin logs carry fixed codes only (`intake_hook`, `safe_error`).

**Plugin files**
- Spool, dead-letter, journal and attachments are opened through `_open_private`: O_NOFOLLOW, a 0600 check, an 0700 folder check, atomic writes and flock.
- `call_backend` refuses redirects and proxies and caps responses at 64 KiB.
- Templates are fixed texts. DM params are empty.

## Deferred-items triage (security-relevant ledger lines in `progress.md`)

| Ledger | Item | Triage | Reason |
|---|---|---|---|
| `:63` M5 | No DB-level cross-project/tenant UPDATE 0-row test for runtime on `intake_candidates`; no exact-16384 B body test | **Must fix before merge** (the UPDATE test); body-size test ok to defer | QG 34c and AR-06 require the write/delete dimension. Runtime holds an UPDATE grant on that table (`016:225`) and no test proves a cross-project UPDATE affects 0 rows. It is one test. The exact-cap body test is hygiene only. |
| `:171` | 017 DO block does not refuse a pre-existing `libetech_outbox_audit` that has members | **Must fix before 017 is applied to any database other than test** (cheap enough for this branch) | Zero members is the linchpin of proof by privilege: any member can SET ROLE to the audit role and forge state events. Add a `pg_auth_members` check to the DO block. Optionally assert it again in the validate trigger or a startup check. |
| `:64` M6 | `pointer_only` still stores `file_name`, `source_actor_label` and the locator; unsalted sha256 of short text can be reversed by dictionary | **Needs Chairman** (OQ-28) | This is a scope call on what counts as "pointer". My recommendation for IBS HI and unmapped projects: store the extension and size only, no name or label. The content hash is already hidden in pointer_only `detail()`. |
| `:244` M-3/M-4 | Concurrent `drain_outbox` needs a pass-wide flock; no retention or compaction for journal and attachments | **Must fix before the wiring/install round**, ok to defer past merge | Nothing schedules a drain in this slice. But the dead-letter keeps full event bodies, text included, indefinitely in an owner-only file, so retention must exist before real messages flow. |
| `:253` | Dead-letter append is at-least-once; `chats=None` is permissive in `intake_event` | Ok to defer | The hook always passes `chats` (`:242`), and the server allowlist stays authoritative. Still, I recommend a fail-closed default (`chats=None` means refuse) when the wiring round touches this code. |
| `:66` M8 | Nonce and throttle consumed before schema parse | Ok to defer | This order is intended (`:39`). The gateway mints a new nonce on retry. No security loss. |
| `:65` M7 | Rollbacks 013-015 do not refuse while 016 is applied; rollback/016 keeps USAGE on public | Ok to defer | Rollback is never run on a real database without Chairman approval (AGENTS.md). Test-only today. |
| `:62`, `:61` | Test hygiene (barrier, dead fallback) | Ok to defer | No security effect. |
| `:70` M12 | Raw MIME stored vs lowercased verdict | Ok to defer | The verdict decides storage. The raw value is display only and capped at 100 characters. |
| `:77`, `:80`, `:94`, `:100` | Redaction known limits of the unusual-syntax class | Ok to defer, per ruling `:102` | Distinct from I1 above, which is a different class. |
| `:109` | Second-layer test disables a trigger on the shared test DB | Ok to defer | Test DB only. Prefer DISABLE inside a rolled-back transaction. |
| `:143` | `reject_history_mutation` (001) has no pinned `search_path`; identity ack does not bump version | Ok to defer | The function only raises and reads no table, so there is nothing to shadow. A fix needs a new migration. |
| `:153`, `:156`, `:157`, `:168` | Guard slack (same-state bump, carried-over signal, single-row updates, role-limited tooling) | Ok to defer | Events are written by the DB and validated against legal (from,to) pairs. The remaining slack cannot invent an illegal transition. |
| `:172` | Forward 017 no longer drops the draft objects | Ok to defer | Only relevant to a test copy carrying the draft. The IF EXISTS drops can stay. |
| `:214` | Dead or uncertain ballot DMs have no operator surface | Ok to defer | An availability gap, not exposure. Fold into T12/OQ-29. |
| `:215` | `inboxRows` has no LIMIT | Ok to defer | No route exposes it this slice. Add a LIMIT before any route does (E-BE-05). |
| `:216` | Ack before delivery leaves the DM pending | Ok to defer | A UX gap. The vote event is the audit record. |
| `:249`, `:264` | Realistic sample name; pre-existing real-looking chat ids | Note only | Tracked by existing rulings and `AUDIT-telegram-ids-20261112.md`. |

## What I could not verify

- The real Hermes gateway hook semantics and the attachment download path. I relied on the plugin code and pytest only.
- The d1-ai1 nginx and proxy state, including whether the `/api/bridge` 404 in `DEPLOY-003` is actually deployed.
- The real cluster's `log_min_error_statement` setting, and whether constraint-violation DETAIL lines could put row values, for example a file name or label, into PostgreSQL server logs.
- Membership of `libetech_outbox_audit` on any non-test cluster. 017 has not been applied there, which is a stop point.
- I did not re-run the native PostgreSQL suite. I relied on the `task-13-*.log` receipts, and my own probes were limited to the redaction function.

## Three highest-leverage fixes

1. **I1**: extend redaction to Vietnamese and short-form credential keywords, Basic auth and PEM blocks, and fix "keyword is value". Do this before any project is put in excerpt mode.
2. **Ledger `:171` and `:63`**: add the zero-member check for `libetech_outbox_audit` in 017, and the runtime cross-project UPDATE 0-row isolation test (QG 34c).
3. **M1**: map bridge config-load errors to 503 so a typo spools intake instead of silently dropping it.

Owner for all: Builder. Approver: Chairman.
