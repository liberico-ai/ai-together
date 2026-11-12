# Slice 1 (doc ownership): Tier-1 security review

- Range: `208d37b..46439aa` (19 commits, 60 files), branch `slice-1-doc-ownership`. Reviewed read-only.
- Method: I read every new authorisation path, the migrations 013–015 with their rollbacks, the HTTP adapter and routes, the UI, the scripts and the test harness. I also ran a secrets scan over `git log -p` for the range and over tracked files at HEAD, and ran one in-process Zod check (no DB, no server).
- Not done: I did not run the test suite, because the brief allows no DB connections. I did not read `.runtime/`. I did not check whether the deploy proxy currently exposes the new routes.

## Verdict

**PASS WITH CONDITIONS.** The review found no Critical or High issue. One Medium (M-1) must be fixed before `/documents` and `/api/documents/*` go behind the public proxy. The plan (`docs/plans/slice-1-doc-ownership.md:526`) treats exposing those routes as a deployment stop point, so they are not public yet. The Lows are hardening.

## Findings

| # | Sev | Location | Class | Evidence | Minimal fix | Owner |
|---|---|---|---|---|---|---|
| M-1 | Medium | `src/server/documents.ts:12-15,23,153-161`; `src/components/documents.tsx:24-25` | Stored link phishing: no host allowlist on the source pointer | #fact `httpsPointer` only checks `https:` and that the URL has no username or password. It accepts any host for `sourceType` `drive`, `git` or `vault`. `openSource` returns the stored URI as-is, and the card opens it with `window.open` without ever showing the host. | Add a per-`sourceType` host allowlist, read from config, in `registerSchema`; for example `drive` → `drive.google.com`/`docs.google.com`, and `git` → the configured forge host and organisation. Check it again in `openSource` before returning `uri`. Show the host on the card or in a confirm step. Also reject query parameters that carry credentials (`token`, `sig`, `access_token`, `X-Amz-*`, …), see L-2. | Builder; Chairman approves the allowlist |
| L-1 | Low | `src/server/projects-registry.ts:13` | Validation crash turns a 422 into a 500 (E-BE-04) | #fact With Zod 4.6.7, a failed `.url()` check does not stop the `.refine`, so `new URL(v)` throws a `TypeError`. A one-line test shows `"abc"` → THROWS TypeError, while `"http://x"` returns a normal Zod issue. `saveProfile` therefore answers HTTP 500 `INTERNAL_ERROR` for `repoUrl:"abc"`. Nothing is written and nothing leaks. | Wrap `new URL` in try/catch, as `documents.ts:13` already does, or reuse `httpsPointer`. Add a regression test with `repoUrl:'abc'` that expects a ZodError. | Builder |
| L-2 | Low | `migrations/014_document_registry.sql:18`; `src/server/documents.ts:118,130`; `migrations/013_project_registry.sql:99-100` | Secrets in a URL become permanent; no DB-level scheme guard | #fact `canonical_uri` has no CHECK constraint. The URI is copied into the `registry_events.payload` and the `document_revisions.source_id` columns. Both are append-only: `reject_history_mutation` triggers block UPDATE and DELETE. #inference If someone pastes a signed or token-bearing link, it reaches every member, viewers included, and only a privileged out-of-band fix can scrub it. A future import or operator path could also store a non-https URI, and `openSource` would hand it to `window.open`. | Add `CHECK (canonical_uri ~ '^https://')` in a new migration (expand step). Re-validate with `httpsPointer` inside `openSource`. Refuse credential-bearing query parameters (folded into M-1). | Builder |
| L-3 | Low | `src/server/projects-registry.ts:26` | State misreporting: an active channel would show as proposed | #fact `toChannel` hard-codes `state:'proposed'`, `enabled_from:null` and `approver_id:null`, whatever the row says. #inference If a channel is ever activated out of band (the test at `tests/project-registry.test.ts:44` builds such a row as operator), the registry tells managers it is only proposed while the bot may be live in that chat. | Map the fields from the row. Alternatively, `invariant(r.state==='proposed')` and fail loudly. | Builder |
| L-4 | Low | `src/server/projects-registry.ts:19,52-60` | Telegram identifiers shown to all members; field length unbounded | #fact `registry()` returns `chat_id` and `topic_id` to every non-bot member, including the `viewer` (customer) role. `chatId` and `topicId` have no length cap; only the 16 KB body limit bounds them. #inference A chat ID is an identifier, not a credential; the bridge still needs HMAC plus verified pairing. | Cap the fields at 20 characters. Hide `channels` from `viewer`, or mask them except for managers. | Builder; Chairman decides who sees channels |
| L-5 | Low | `migrations/015_document_index_z2.sql:36` | Least privilege for the projector | #fact `libetech_projector` gets SELECT on every column of `document_records` and `document_revisions` (including `canonical_uri`, `metadata` and `changes`), and the same role also writes `analytics.evidence_runs` (005:79). It needs only the columns it projects. | Use column-level `GRANT SELECT(...)`. Keep the separate projector role as an open item under OQ-22. | Builder |
| L-6 | Low | `migrations/014_document_registry.sql:78-91`; `013:83-90` | Defence in depth: no DB-level binding of rows to the actor | #fact The RLS on `document_commands` and `registry_events` checks tenant and project, not `actor_id`. Isolation between people in the same project relies on the code filter at `documents.ts:57-58`, `:116` and the `event()` helper. | Optional: put `set_config('app.actor_id',…,true)` in `scoped()` and add `actor_id = current_setting(...)::uuid` to the `document_commands` policies. | Builder |
| L-7 | Low (accepted risk) | `src/server/document-index.ts:25-28`; `src/server/documents.ts:143-161` | Every member sees every pointer; no classification gate | #fact Read access is by membership only, and `classification` is always `'unclassified'` (OQ-14 still pending). The `viewer` (customer) role can list, open and export every registered pointer in the project, internal designs and plans included. This matches the plan at `:463`. | Record it as accepted risk until OQ-14 is decided. If Drive links are shared as "anyone with the link", the actual content is exposed too. | Chairman (decision) |

### Exploit scenarios

- **M-1:** A project member with the `engineer`, `technical` or `business` role, or someone with a stolen session of such a member, registers a document. They set `sourceType:'drive'` and `canonicalUri:'https://drive-google.<attacker-host>/…'` with a convincing title. A manager clicks "Mở nguồn" ("Open source"). A new tab opens a fake Google sign-in page. The card never shows the host, and the server returns whatever pointer is stored.
- **L-1:** `PUT /api/projects/<id>/profile` with `repoUrl:"abc"` → 500. The impact is log noise and a confusing error message; no data is touched.
- **L-2:** A user pastes a pre-signed object URL or a Drive link that carries a resource key. It lands in immutable audit rows that external viewers can read, and the app cannot redact it.

## Verified controls (passes)

- **Entry point.** Authentication happens before routing, and the Origin is checked on every non-GET request (`documents-http.ts:24-26`). Unknown routes return 404. Routes export only GET/POST (`documents`) and GET/POST/PUT (`projects`).
- **Identity comes only from the session.** All schemas are `.strict()`, and `tenantId`/`actorId` in a request body are rejected (`documents.ts:18-30,37-45`, `projects-registry.ts:14-20`; tests at `project-registry.test.ts:113-118`). The `projectId` in the body is only a selector, checked against `p.projectIds` before any query (`documents.ts:102-105`).
- **Bot principal.** The bot is refused on every document and registry read and write (`documents.ts:100,128,143,149`; `document-index.ts:26,63,74`; `projects-registry.ts:35`). That is stricter than "read-only".
- **RLS.** Every table has `ENABLE` + `FORCE` row-level security. Policies fail closed: a missing tenant setting becomes NULL through `nullif`, and a missing project list becomes an empty array through `coalesce`. Read and write policies are split per command, giving `USING` plus `WITH CHECK` (013:49-96, 014:76-126, 015:21-32).
- **Session-scoped context.** `scoped()` runs `SET LOCAL ROLE libetech_runtime` plus `set_config(…,true)` inside the transaction (`db.ts:36-42`). At boot the code refuses a superuser, BYPASSRLS or table-owner login (`db.ts:18-21,47-48`). `libetech_web` is NOINHERIT and is not a member of `libetech_projector` (003:5,11; 005:4).
- **Column-level grants.** UPDATE is limited to the mutable columns (013:103; 014:136-137). The INSERT `WITH CHECK` blocks forged approval, freeze, hash or source state values (014:107-126). Composite FKs pin revisions and pointers to the same document, tenant and project (014:41,56-66).
- **Errors.** Out-of-scope and nonexistent resources return the same 404 text. No title, project name or count appears in any error. A key reused for another project returns a 409 that only reveals the actor's own earlier use (`documents.ts:47-63`, OQ-24 b).
- **CSV export.** The prefix guard covers `= + - @ TAB CR`. Quotes are doubled, every cell is quoted, the filename is fixed, and the response carries `no-store`. `nosniff` is set globally (`document-index.ts:70`; `next.config.ts`).
- **Open source.** The endpoint returns JSON, never a 3xx. Scope is re-checked through RLS on every call. The link opens with `noreferrer` (`documents-http.ts:41`; `documents.ts:153-161`; `documents.tsx:25`). See M-1 for the remaining gap.
- **Demo identity.** The API resolves the user through `authenticatedPrincipal`, which requires `LIBETECH_DEMO=1` and a loopback host (`auth.ts`). The page uses `identityService()`, which refuses demo mode (`identity.ts:217`). The test harness refuses any non-loopback host, unexpected port or unexpected database name (`tests/slice1-db.ts:9-17`).
- **Projector.** No route or service calls `projectDocumentIndex`; only the operator script does (`scripts/project-document-index.ts`). The script prints only row counts.
- **Logging.** The new code adds no logs that contain PII. The `failure()` path logs only `errorType`.

## Secrets scan (Step 0)

- Range `git log -p 208d37b..46439aa` (#fact):
  - No connection string with credentials was added (0 hits). Test URLs carry a username only (`postgresql://u@127.0.0.1:55471/...`).
  - No `.env`, key, PEM or credential file was added (0 hits).
  - No `password=` or passphrase literal was added (0 hits). The `password_hash` values are the placeholder `fixture-only`.
  - No value of the shape `-100` followed by 10 digits was added (0 hits).
  - Chat IDs added in tests are `-100123`, `-100999` and two 7-digit values in the `-100999000x` pattern, plus a Telegram user ID `555000111`. #inference All of these look synthetic.
- `.gitignore` covers `.env*`, `.runtime/`, `.data/`, `*.pem` and `*.key`, checked with `git check-ignore`. `.superpowers/` is excluded only by the local `.git/info/exclude`.
- `deploy/install-user.py` and `deploy/provision-server.py` build their DB URLs by f-string interpolation; there is no literal password (#fact).

## Outside the range: pre-existing, published while the repo is public

- **Real-looking Telegram supergroup IDs.** 11 tracked files at HEAD contain values shaped like a real ID (`-100` followed by 10 digits): `deploy/pilot-scope.json`, three `docs/TELEGRAM-*.json`, `docs/DEPLOY-002.md`, `docs/HERMES-DEPLOY-PREFLIGHT-20261108.json`, two `deploy/*.py`, two `scripts/*.ts` and `tests/identity.test.ts`. None was added in this range. Values are not quoted here. #inference They are identifiers, not credentials; the Chairman should decide whether to scrub them before the repo stays public.
- **`/api/health`.** In non-demo mode this endpoint is unauthenticated and returns the schema version list and integration states. That behaviour pre-dates this range; the diff only adds `botWriteFlow` and takes the version from `package.json`.
- **Personal name.** The new lines in `docs/OPEN-QUESTIONS.md` name a person instead of a role, against the role-based reference rule. The base docs already do the same in many places.

## Highest-leverage fixes

1. **M-1:** host allowlist per `sourceType` at registration, re-checked in `openSource`, with the host shown before the link opens.
2. **L-2:** DB `CHECK` on the `https://` scheme, and refusal of credential-bearing query parameters before they reach immutable rows.
3. **L-1 and L-3:** guard `new URL` in the registry schema, and map the channel state from the row; both are one-line fixes with regression tests.
