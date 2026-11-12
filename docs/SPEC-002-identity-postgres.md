# Identity, PostgreSQL and the first read-only bot integration

Authorized 2026-11-08: continue organization login, a PostgreSQL server, reconcile a real task and connect LibeTech without replacing team data. Chairman chose username/password, followed by matching Telegram ID.

## Decision and boundaries

- Password login uses Argon2id. No public registration: an operator issues a single-use invitation with preset tenant, role and project membership. The invited person chooses their own password. No password is written to logs or supplied by an assistant.
- Persistent opaque sessions are hashed in PostgreSQL, expire after eight hours and are revocable. Disabled users lose access immediately. Browser writes require the exact configured origin. Demo mode remains loopback-only and cannot use a server database.
- Telegram pairing requires a short-lived web-issued secret and an authenticated private Telegram update. User IDs, chat/lane, tenant and project rights never come from model arguments. Pairing grants no additional project rights. A Telegram identity cannot replace another user's binding. Codes are consumed atomically.
- Two database logins: business runtime (forced tenant/project RLS) and identity runtime (identity schema only). Neither is a superuser or owns application tables. Migration credentials never enter the web runtime. All new DDL is additive and versioned.
- The pilot exposes only read access through a separately authenticated bridge. Backend independently intersects the bound user's projects with the configured chat's projects. Unknown chats, missing identity and cross-BU access fail closed. The bridge cannot create, accept or close work.
- LBRC014 is a source reconciliation in Z2. Existing workbook/ticket ownership stays unchanged. A reported closure without an accepted SHA is not an acceptance. Zero GitHub check runs is not a passing check.
- Install an isolated database/data directory and app service. Preserve the baseline source manifest and existing local demo data. No overwrite, migration or restart of another platform.

## Acceptance

1. Correct password works; wrong, unknown and disabled users fail generically. Rate limiting persists across workers.
2. Invitation is single-use and expires; users cannot self-assign a role, tenant or projects.
3. Session survives app restart; logout, expiry and user disable revoke access.
4. Forged actor/tenant/project, cross-origin mutations and demo login in server mode are denied.
5. Verified Telegram pairing works once; expiry, replay, group pairing, wrong signature and identity collision fail.
6. Bot reads the LBRC014 snapshot at the exact source SHA through its configured scope; Xeca cannot read the same record.
7. PostgreSQL runtime roles have no superuser/BYPASSRLS; tenant/project isolation and pool transaction isolation pass on native PostgreSQL.
8. Backup restores into an isolated verification database. Existing team source and source records remain unchanged.
9. Report installation, direct API verification, bot runtime verification and human acceptance separately.

## References

[OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [node-postgres pooling](https://node-postgres.com/features/pooling). Implementation uses Argon2id memory 19 MiB, time cost 2, parallelism 1; parameter upgrades are versioned with the stored hash.
