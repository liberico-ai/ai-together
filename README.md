# LibeTech AI OS — live 0.5.0; 0.6.0 candidate

Private operational platform for LibeTech: scoped work, evidence and independent technical/business acceptance. The second slice adds username/password organization accounts, persistent PostgreSQL sessions, verified Telegram identity linking, and a read-only bot bridge. Implementation references: `src/server/service.ts:14`, `src/server/identity.ts:64`; live pilot receipt: `docs/TELEGRAM-GROUP-VERIFICATION-20261109T0922.json:1`.

Version 0.6.0 is an isolated candidate for first-account Telegram approval by Chairman and one of the three BoM Tech members before issuing an invitation; it is not deployed. See [SPEC-007](docs/SPEC-007-telegram-account-approval.md).

Version 0.5.0 is live at https://libetech.btnet.vn. It adds member registration requests, administrator-reviewed project grants, and scoped bug/idea reports with manager triage. See [SPEC-006](docs/SPEC-006-team-registration-feedback.md) and [the dated deployment record](docs/DELIVERY-005-team-open-20261110.md).

## Current status

The 0.2.0 backend and private PostgreSQL are deployed on d1-ai1 behind the Hermes portal. On 2026-11-09 at 09:22 Vietnam time, live user traffic verified chairman Telegram pairing, an exact-SHA LBRC014 read in LibeAI and scope denial in Libe–Xeca; see [dated evidence](docs/TELEGRAM-GROUP-VERIFICATION-20261109T0922.json). A read-only server inspection at 15:36 confirmed only the activated, Telegram-linked chairman account, one project, one historical reconciliation and zero work/evidence records or live invitations. The 2026-11-09 access gap is historical; the 2026-11-10 registration and feedback rollout is recorded [here](docs/DELIVERY-005-team-open-20261110.md). See [prior flows and data](docs/RESUME-TEAM-ACCESS-20261109.md) and [prior server observation](docs/RESUME-SERVER-OBSERVED-20261109.json). LBRC014 remains a source reconciliation, not a migrated canonical work item or accepted deliverable. The earlier [local verification](docs/VERIFICATION-002-20261108.md) is retained as historical evidence.

## Identity flow

Operator invitation → user chooses password → organization session → five-minute pairing code → private `/libetech_link` command → verified Telegram ID. The bridge intersects the linked user's projects with the actual chat's grants. No actor or tenant comes from model arguments.

## Run

- `npm ci --ignore-scripts`
- `npm run build`
- `npm run start:demo`: existing loopback-only synthetic PGlite workspace, port 3147.
- Server mode: protected `DATABASE_URL`, `IDENTITY_DATABASE_URL`, `LIBETECH_TENANT_ID`, `LIBETECH_ORIGIN`, optional `LIBETECH_BRIDGE_CONFIG`; `npm start`, loopback 3148. Never combine demo with a server database. Configuration references: `package.json:9`, `src/server/db.ts:44`, `src/server/identity.ts:142`.
- `npm test -- --coverage`, `npm run typecheck`, `python3 -m unittest discover -s tests -p 'test_bot_bridge.py'`.

Registration requests are public, but project access remains administrator approved. Runtime credentials are not migration credentials and never own tables. All migrations are versioned under `migrations/`. Keep `.runtime`, `.data`, `.env*`, keys and database archives out of source packages and git.

[Scope and acceptance](docs/SPEC-002-identity-postgres.md) · [Private server install and rollback](docs/DEPLOY-002.md) · [Foundation architecture](docs/ARCHITECTURE.md)
