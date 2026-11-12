# Verification of identity and PostgreSQL slice — 2026-11-08

## Observed result

LibeTech AI OS 0.2.0 is implemented and has run against native PostgreSQL on the Chairman's Mac, isolated from existing databases. It has **not yet been installed on d1-ai1**, and the new bridge has **not yet been exercised by the actual Telegram bot**. The first account is awaiting user-controlled password activation.

| Check | Evidence / result |
|---|---|
| TypeScript build and type check | Passed |
| Domain/auth/API tests | 28/28 passed |
| Bot adapter tests | 7/7 passed |
| Measured server coverage | 95.78% lines, 83.79% branches across service, auth, HTTP, identity and bridge |
| Production dependency audit | 0 known vulnerabilities reported by npm audit |
| Native PostgreSQL | PostgreSQL 16.15 in a separate container, loopback 5547 |
| Privilege boundary | Both runtime logins are non-owner, non-superuser, no BYPASSRLS/CREATEDB/CREATEROLE; elevated login is refused |
| Tenant and project isolation | All 8 business/analytics tables and 9 identity tables checked; 30 concurrent pool transactions do not leak scope |
| Password/session lifecycle | Invitation single-use; Argon2id password; persistent hashed session; logout/expiry/disable and generic failed login tested |
| Telegram matching | Private-only one-time proof, signature/freshness/replay and project/chat intersection tested with synthetic identity |
| Backup and restore | Pilot restored to a separate database; source SHA, snapshot hash and record counts match |
| Real LBRC014 | GitHub REST freshly returned the exact SHA and 0 check runs; source worksheet snapshot is dated 07/11 and remains labeled historical |
| Business state | No source workbook/ticket changes; 0 work records and 0 acceptance events created by the reconciliation import |
| Existing gateway plugin | Downloaded server `__init__.py` has SHA-256 `a706a3a9bdd83270c9d0f89f28f521d24294306b72f35d892f3abc1243321756`, matching the recorded 1.1.4 deployment |

Receipts: `NATIVE-POSTGRES-VERIFICATION-20261108.json`, `BACKUP-RESTORE-20261108.json`, `LBRC014-RECONCILIATION-20261108.json`. Earlier 0.1.0 receipts remain historical, not claims about this release.

## Outstanding runtime gates

- The invited `chairman` user must choose their password personally. The browser activation page was opened; no password was requested in chat.
- d1-ai1 lacks the checked `/usr/bin/psql`, `pg_dump` and Docker binaries. `sudo -n true` returned “a password is required”; SSH BatchMode to the recorded jump host returned authentication denied. The existing authenticated Hermes dashboard remains an observed admin route, but the browser control connection failed during the readback download.
- An operator with sudo must run the prepared initial installer. Its source has been syntax-checked; the complete d1 installation has not been executed or claimed tested on that machine.
- After installation, prove the exact deployed build, account matching, the bot's scoped LBRC014 read, and the same request denied from Libe – Xeca. The backend denial code is `SCOPE_DENIED`; the unchanged GitHub tool uses `GITHUB_SCOPE_DENIED`.
- A shared gateway restart is not included. Prefer supported per-profile plugin activation; if a restart of all bots is required, review that concrete change first.

## Preserved baseline

The original `libetech-ai-os` source was hash-compared before promotion, with zero intervening file changes. The existing `.data/postgres` demo directory is preserved. Work on `libe-tech`/priority1 is read-only; none of the team's modified or untracked files are reset, committed or pushed.
