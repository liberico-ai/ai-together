# LibeTech AI OS — project instructions

Use Liberico coding rules at `/Users/huyenleduy/.agents/skills/liberico-coding-rules/SKILL.md`.
This is a new, isolated code repository authorized by Chairman on 2026-11-08.
Preserve existing AiTogether, Vault, team source and data. Chairman expanded the scope on 2026-11-08 to username/password organization login, verified Telegram pairing, an isolated PostgreSQL server and a read-only LibeTech bridge. The existing priority1 plugin remains independent.

- Stack: TypeScript, Next.js App Router, PostgreSQL SQL; `pg.Pool` for a configured server; PGlite for the local demonstration only.
- `src/server`: authentication boundary, domain service, scoped repository and analytics projector. API handlers must not perform raw business writes.
- `migrations`: versioned idempotent schema SQL, UUID keys, timestamptz, tenant/project scope, RLS. Every migration from 013 has a rollback file in `migrations/rollback/`, which the runner does not scan; rollback is never run on a real database without Chairman approval.
- `src/app`, `src/components`: web UI. `tests`: negative authorization and lifecycle tests.
- Z1: owned work/service/acceptance records, project registry, proposed channel mappings and document governance metadata (ADR-002 v1.1). Z2: derived summary tables and the document metadata index, each populated by a named projector. Z4: future AI suggestions; not enabled.
- Reports never aggregate across reporting domains (Liberico BU · Xeca · IBS HI). A domain label is not tenant_id, organization_id or entity_code. Project-to-domain rows are created or confirmed by an authorized person with a source; unmapped projects show "Chưa xác nhận". IBS HI: pointers, hashes and Tech work metadata only.
- Demo identity is local-only, synthetic, explicitly labeled, enabled only by `LIBETECH_DEMO=1` plus loopback origin. Server identity uses invitation-only Argon2id login and PostgreSQL sessions. Never enable demo on an external database.
- Bot principal is read-only. Never accept actor/tenant identity from request JSON. No direct connection to another platform database.
- Every write uses a transaction, expected version and immutable audit event. Closed tickets do not imply acceptance.
- Self-reported health, including this service's `/api/health`, is report information, never evidence of observed runtime state.
- Preserve original source IDs as references. The read-only LBRC014 reconciliation and isolated deployment are authorized. Workbook/ticket cutover, public exposure and repository push require their own concrete scope.

