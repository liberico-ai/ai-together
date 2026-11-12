# LibeTech AI OS portal — 2026-11-08

Requested scope (Chairman, current conversation): server web login through Hermes; private Telegram pairing; exact-SHA read in LibeAI; denial in Libe–Xeca; preserve data and team changes. Authorization context: AGENTS.md:4. This paragraph records the request, not a runtime result.

## Current status — 2026-11-09, 09:23 Vietnam time

Live identity and group checks have completed for the authorized pilot: chairman has a verified Telegram link, LibeAI returned the requested LBRC014 reconciliation at the full SHA, and Libe–Xeca returned only `SCOPE_DENIED`. The dated observations below remain as history. Evidence: docs/TELEGRAM-GROUP-VERIFICATION-20261109T0922.json:1; raw receipt: docs/TELEGRAM-IDENTITY-VERIFICATION-20261109T022314Z.json:2.

## Candidate
- AI OS backend stays 0.2.0, source digest `dcc6d1247dfb0677a8271268340d2a9a0576afaec8e899ff1fd9a1bec70f8c68`. Source: docs/SERVER-RUNTIME-VERIFICATION-20261108.json:7.
- Independent portal 0.1.0, package commit `57ca1e8ae40771df77316b3da60d27ce2212cad4`. Source: PORTAL-PACKAGE-20261108.json:4.
- Normal Hermes Git admission; default dashboard profile; no gateway restart or bot plugin replacement.
- Only intended web env changes: HTTPS Hermes origin and local-auth disabled. Only new web service restarts.

## Checks before deployment
- 14 proxy tests passed against a synthetic upstream; JavaScript syntax check passed. Receipt: PORTAL-PACKAGE-20261108.json:16.
- Tests cover Hermes admission, secondary profiles, route/method allowlist, CSRF, Host, content type, size, cookie isolation, cookie scope/flags, backend denials and redirect rejection.
- These do not establish real login, account pairing or group acceptance.

## Evidence / rollback
- Package hashes: `PORTAL-PACKAGE-20261108.json`.
- Operator source: `deploy/libetech-portal-deploy-20261108.py`.
- Server protected baseline and backups: `/home/iptech/libetech-ai-os-stage-20261108/portal-rollout-20261108/`.
- Rollback: disable only `libetech-ai-os-web` through Hermes; restore protected `web-before.env`; restart only `libetech-ai-os.service`. Never restore old database or overwrite bot profiles.

## Observed server deployment
- Normal Hermes installer enabled portal 0.1.0 at the pinned commit. Observation: PORTAL-OBSERVED-20261108.json:4.
- The narrow finish script passed five HTTP checks and preserved profile/plugin hashes and pilot row counts.
- Gateway PID remained 1108021; 20/20 Telegram connections reported connected. No gateway restart.
- Browser displayed the real HTTPS server login; health 200 and anonymous me 401. Evidence: `PORTAL-OBSERVED-20261108.json` (transcribed, not raw receipt).
- Unauthenticated HTTPS request to the Hermes portal API returned 401; the existing Hermes login gate remains enforced.
- At this deployment observation, user credential entry / pairing handoff was pending; superseded by the dated live results below.

## Historical checklist before the 2026-11-09 live checks
1. User logs in with activated chairman credentials and generates a one-use pairing code.
2. User sends that code privately to @LiBeAiTogetherBot; server identity event confirms linkage.
3. LibeAI reads LBRC014 at `8d05141576bcd4db8e7ab9f1a6b7a0dd9bd360ab`.
4. Libe–Xeca gets a scope denial without record content.

Working group syntax separates mention from command because the current shared Hermes Telegram adapter joins tokens when the mention is attached:
`/libetech_check @LiBeAiTogetherBot LBRC014 8d05141576bcd4db8e7ab9f1a6b7a0dd9bd360ab`.


## Readback 2026-11-09, 09:04 Vietnam time

Chairman reported Telegram paired. The server record does not yet corroborate AI OS account pairing. The raw server receipt was downloaded through Hermes Files, with identical SHA-256 after local copy: docs/TELEGRAM-IDENTITY-VERIFICATION-20261109T020433Z.json:2.

- No Telegram links and no issued pairing codes exist. Identity events remain the original activation/session on 2026-11-08. Source: docs/TELEGRAM-IDENTITY-VERIFICATION-20261109T020433Z.json:4.
- The last signed bridge request remains the previously reconciled 22:00:13 test on 2026-11-08. Source: docs/TELEGRAM-IDENTITY-VERIFICATION-20261109T020433Z.json:16; prior user-visible result: docs/TELEGRAM-CHECK-20261108T220013.json.
- LBRC014 remains present at the requested full SHA and existing snapshot hash. This is database presence, not a Telegram read. Source: docs/TELEGRAM-IDENTITY-VERIFICATION-20261109T020433Z.json:24.
- Gateway PID remains unchanged, with all twenty Telegram connections reported connected. Protected profile/plugin files matched the prior baseline. This does not establish every bot's business behavior. Source: docs/TELEGRAM-IDENTITY-VERIFICATION-20261109T020433Z.json:33.
- The browser portal displays the server health and login form. No password, pairing code, identity mapping, permission, service or gateway configuration was changed during this readback.

At 09:04, the next required evidence was to determine whether the user paired with Hermes or received the AI OS-specific success response. The authenticated portal is open for user-controlled login and private pairing. Group acceptance remains NOT_RUN after successful pairing; do not replace it with a fabricated signed Telegram context or a direct database grant.


## Live group verification — 2026-11-09, 09:22 Vietnam time

The user sent the same exact-SHA command in both groups. The operator read the actual bot responses in Telegram Lite, then correlated them with the raw server receipt downloaded through Hermes Files. This is live user traffic, not a script fixture or a fabricated Telegram identity. Evidence: docs/TELEGRAM-GROUP-VERIFICATION-20261109T0922.json:1.

- **Identity:** a new server session preceded the `telegram_verified` event and chairman link at 09:21:56 Vietnam time. The user's successful private-pairing response agrees with this metadata. Source: docs/TELEGRAM-IDENTITY-VERIFICATION-20261109T022314Z.json:4.
- **LibeAI:** the visible response has `ok: true`, code `LBRC014`, and exact `source_sha` `8d05141576bcd4db8e7ab9f1a6b7a0dd9bd360ab`; it reports `readOnly: true`, `identityBinding: verified-telegram`, backend `0.2.0` and bridge `0.2.1`. Gateway delivery was 09:22:47 Vietnam time. Source: docs/TELEGRAM-GROUP-VERIFICATION-20261109T0922.json:1.
- **Libe–Xeca:** the visible response to the same command is exactly `SCOPE_DENIED`, with no reconciliation record. Gateway delivery was 09:22:56 Vietnam time. This is the AI OS scope check, distinct from the independent GitHub tool's denial code. Source: docs/TELEGRAM-GROUP-VERIFICATION-20261109T0922.json:1.
- **Preservation:** the raw receipt retains gateway PID 1108021, twenty connected Telegram adapters, protected file hashes equal to the pre-rollout baseline, zero work items and the unchanged LBRC014 snapshot hash. No runtime mutation or restart was performed during this verification. Source: docs/TELEGRAM-IDENTITY-VERIFICATION-20261109T022314Z.json:42.

**Acceptance boundary:** the requested identity/read/deny path is verified. The returned record remains the prior GitHub/workbook reconciliation snapshot: it explicitly reports no check runs, no accepted SHA, technical acceptance not established and deployment not observed. This result does not establish new GitHub data, CI success, LBRC014 business acceptance, or the business behavior of other bots. The attached-mention parser issue remains; retain the verified separated-mention syntax above.

The 09:04 no-link finding is historical and superseded by the 09:21 identity event; the old receipt is preserved. Raw current evidence and selected UI fields are stored separately, with the raw receipt SHA-256 recorded in the UI evidence file. No credential or pairing code is stored.
