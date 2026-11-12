# Private pilot deployment — 0.2.0

Observed on d1-ai1 on 2026-11-08: backend 0.2.0 and PostgreSQL are running. Bridge 0.2.1 was installed through standard Hermes Git admission and its native commands activated without restarting the shared gateway. See SERVER-RUNTIME-VERIFICATION-20261108.json, BRIDGE-INSTALL-20261108.log and SERVER-POSTINSTALL-OBSERVED-20261108.json.

## What changes

- A new PostgreSQL cluster `libetech-ai-os`, port 5547, database `libetech_ai_os`. No query or migration is run against another platform database.
- Current pilot mode: private code/data under `/home/iptech/.local/share/libetech-ai-os`, supervised by two `iptech` user services. Original administrator-operated mode remains available separately; see the isolation distinction below.
- Web service binds loopback 3148. The original pilot browser plan used an encrypted SSH tunnel at local port 3150; that route is not available to the user and must not be presented as a working login URL. No public endpoint or DNS change is made by this installer. Organization HTTPS publication needs a chosen domain and its reverse-proxy owner.
- A new independent Hermes plugin `libetech-ai-os-bridge` under only the LibeTech profile, installed through the standard scanner. Existing `libetech-priority1` 1.1.4 source, config keys, ticket store and workbook remain intact.
- Bridge authorization: verified Telegram user ∩ configured chat projects. Internal LibeAI may read the LBRC pilot. Xeca has no LBRC grant. Unknown groups fail closed. Neither plugin nor bot can write work/acceptance through this bridge.

## Preconditions

1. Read `SPEC-002-identity-postgres.md` and verification receipts.
2. Complete the first user's activation on the local pilot before creating the migration archive; password entry stays with the user.
3. Compare local source to `BASELINE.json`, and installed priority1 hashes to the deployment receipt. Preserve unrelated team changes.
4. Source archive must contain no `.runtime`, `.data`, `.env`, database archives or keys. The private DB archive is transferred separately over the authenticated admin channel with file permissions 0600.
5. Archive PostgreSQL data with `pg_dump -Fc --data-only --exclude-table-data=public.schema_migrations`. Preserve the source database as rollback. The installer refuses existing target paths, ports or clusters.

## Operator actions on d1-ai1

The authenticated Hermes dashboard remains a working deployment route. Live checks on 2026-11-08 show `iptech` uid 1000, Ubuntu 24.04.4, `Linger=yes`, a running user service manager, and an official PostgreSQL 16.15 package candidate. The operator does not need the `huyenld` SSH password for this route.

Use `deploy/install-user.py` for this authorized private pilot. It creates only `/home/iptech/.local/share/libetech-ai-os`, two dedicated user units (`libetech-os-postgres.service`, `libetech-ai-os.service`), and the new bridge state directory. It downloads and hash-verifies Ubuntu package contents through apt, extracts them into its own directory without running package maintainer scripts, and runs a genuine PostgreSQL server on loopback 5547. The existing gateway is not restarted.

```sh
python3 /home/iptech/libetech-ai-os-0.2.0/deploy/install-user.py /home/iptech/pilot-data-only-20261108T135324Z.dump --inspect-only
python3 /home/iptech/libetech-ai-os-0.2.0/deploy/install-user.py /home/iptech/pilot-data-only-20261108T135324Z.dump
```

The source archive and private pilot archive are transferred separately through authenticated Hermes Files. Check archive hashes and set the private archive to 0600 before inspection. Use the existing user service manager to supervise a long installer run if the interactive shell timeout is insufficient. Read its completion result and the new service health; a submitted job is not a deployment receipt.

The user-service mode shares the existing Linux account `iptech`; it does not provide the separate Linux-user isolation of the original root-operated `install-d1.sh`. PostgreSQL logins, tenant/project RLS, private paths, loopback listeners and bot scope checks remain enforced. A dedicated Linux account can be introduced later with administrator access. Do not imply these two deployment modes provide identical OS isolation.

`deploy/pilot-scope.json` is the canonical pilot recipient map. Live `home_channel` identifies **LibeAI = -5298399184**. Dragon Forge (-1004338813921) is a different group and has no bridge grant. Xeca has no LBRC grant. Both installers read the same map, covered by a negative regression test.

After backend readiness, install the independent bridge through the normal Hermes scanner. The user-service installer prepares its protected HMAC file but does not install or activate plugin code itself. Do not bypass scanner rejection. Record hot activation versus deferred activation and verify commands in the actual profile.

The backend remains private on d1-ai1 loopback. The already activated Mac UI is a separate preserved instance. A verified browser route to the server instance is still required for server login and Telegram pairing; do not present the Mac session as proof of the server session. No public DNS, reverse proxy or firewall change is included.

## Runtime acceptance (not replaced by unit tests)

1. `/api/health` reports 0.2.0, PostgreSQL server and migrations 001–003. Anonymous workspace gets 401; demo session gets 403.
2. The invited user signs in; LBRC014 shows exact SHA `8d05141576bcd4db8e7ab9f1a6b7a0dd9bd360ab`, zero check runs, and no inferred acceptance.
3. Create a five-minute code in the web UI. The user sends `/libetech_link <code>` privately to @LiBeAiTogetherBot. This native command does not route the code through the LLM. Verify the web account now shows that actual Telegram ID.
4. In LibeAI, the user sends `/libetech_check @LiBeAiTogetherBot LBRC014 8d05141576bcd4db8e7ab9f1a6b7a0dd9bd360ab`. Match gateway command/reply and backend result. Separately test `libetech_os_read` in a new agent session.
5. The same request in Libe – Xeca must return `SCOPE_DENIED` and no record content. This new backend error is distinct from the existing GitHub tool's `GITHUB_SCOPE_DENIED`.
6. Recheck existing priority1 hashes, gateway status and other bot adapters after any plugin activation. If a shared restart becomes necessary, request approval for that exact release before restarting.

## Rollback

Stop only the newly created `libetech-ai-os.service` (use `systemctl --user` in user-service mode). Stop `libetech-os-postgres.service` only after stopping its web client; preserve its data directory. Disable only the new bridge via the supported Hermes plugin control and confirm its activation/unload receipt. Keep the new database/data and prior local pilot for recovery; do not drop databases or restore over another instance. Existing priority1 1.1.4 remains the bot's prior capability set. If an install stops midway, inspect the partial receipt and paths; do not rerun with deletion or force flags.

## Operations still requiring a later release

Public organization HTTPS domain, administrator account lifecycle UI, scheduled encrypted off-host backups, and server-side restore drills. Current local restore proof is not a server disaster-recovery claim.

## Observed restore correction

The initial server attempt created PostgreSQL and migrations, then its single restore transaction rolled back. A full archive restored with `--data-only` did not preserve the data-only foreign-key ordering. This was independently reproduced on the local native PostgreSQL verification database. Create the archive with `pg_dump --data-only` at dump time. The corrected archive restored 1 activated account, 1 project and the exact LBRC014 reconciliation, with 0 work items; see DATA-ONLY-RESTORE-20261108.json. The narrow `--resume-empty-db` path validates all target data tables are empty, both old/new source manifests match, and application/migration/bot bytes are unchanged. It preserves the previous source directory and never drops or truncates the database.

## Standard bridge install observed

The CLI `plugins install` accepts Git sources, not a plain source directory. The plain-directory attempt was interpreted as a Git identifier and did not install a plugin. A proposed manual-copy installer was rejected by automatic review and was not executed. The completed route used a separate local Git artifact at commit `73687919346aad9f6064094455047462513aceec`, normal `plugins validate`, and normal `plugins install file:///... --ref <full commit> --enable`. No force, no scanner bypass, no GitHub push. The installer reported native gateway commands active immediately; model tools are deferred until a new session.

Bridge 0.2.1 moves the profile check from registration into the backend call, before credential reads/network access, so Hermes can probe capabilities in its temporary profile without granting that profile runtime access. Nine Python bridge tests pass, including denial from a non-LibeTech home. The validator retains a nonblocking warning about use of private session-context fields; these avoid process-environment identity fallback and remain a compatibility limitation for a later Hermes upgrade.

The backend installer also needed two operator fixes: define the user-unit directory in its completion function and unwrap the standard API `data` envelope when checking readiness. The already restored DB and completed build were preserved; a bounded post-build completion script started the web service without restoring data or rotating credentials again. Its source remains pinned to `dcc6d1247dfb0677a8271268340d2a9a0576afaec8e899ff1fd9a1bec70f8c68`.

## Telegram runtime check at 22:00 Vietnam time

A real user message using a separated mention returned `TELEGRAM_NOT_LINKED`; the backend recorded one authenticated request at 15:00:13.701144Z and the gateway sent the 19-character reply to LibeAI at 15:00:13.767Z. This verifies the unlinked-identity rejection path, not authorized record reading or cross-BU Telegram rejection. See TELEGRAM-CHECK-20261108T220013.json.

The standard `/command@bot argument` syntax is currently affected by Hermes mention cleanup: the server adapter removes the mention and trailing whitespace, joining the command and first argument. The user did not enter an invalid command. The operational workaround is `/libetech_check @LiBeAiTogetherBot LBRC014 <full SHA>`; the space before the mention survives cleanup. No shared Hermes code was changed during this read-only check. The earlier three-line suggestion with `@bot` attached to the command does not fix this defect and should not be reused.
