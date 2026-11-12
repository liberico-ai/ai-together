# Pilot Team Tech onboarding · 11 Nov 2026

## Authority and scope

Chairman authorized one-time approval of the eight registrations already pending on 11 Nov 2026. `quantv` and `quan` identify the same person; `quan` remains the sole login. The normal Chairman plus one BoM approval flow remains in force for later registrations.

## Release and preservation

- LibeTech web runtime: **0.7.1**, source digest `325663d35332692b27453e1236e2fef1fe9a40a124af5035ed4455913db0e570`; health and activation receipt agree.
- Migration `012_pilot_onboarding_exception.sql` applied after a database backup and isolated restore rehearsal. The activation receipt reports protected records preserved and unchanged gateway PID. No shared gateway restart was needed.
- Runtime smoke: login page 200; anonymous account reads 401; foreign origin 403; unsigned local bridge 401.
- The staging receipt reports source verified against the prior release and no prior source drift.

## One-time batch result

The pilot receipt records eight registrations approved, seven new accounts, nine read-only project memberships, seven invitation-specific pilot exceptions, and zero fabricated BoM votes. The duplicate `quantv` registration points to existing `quan`; no `quantv` account was created. Two pending Thắng/Linh ballots were superseded. The platform `/team` page shows **zero pending requests** and lists the seven new accounts alongside Quân and Phương.

New accounts are `chu`, `cuongld`, `hoanba`, `hungduyle`, `linhht`, `sontt`, and `thangnm`. Chu's BoM seat exists, but can only be used after his own activation and Telegram linking. The seven invitation links expire 24 hours after issuance at 14:56 ICT. They are held in a mode 0600 server file and a mode 0600 local handoff file; they are intentionally absent from this record. Each person must set their own password and link their own Telegram account.

## Verification boundary

This proves approval, account creation, project grants and running release. It does not prove that any of the seven people have activated, linked Telegram, logged in, or used the bot yet. The normal approval path for later applicants is covered by local test `onboarding-feedback.test.ts`; no future applicant was created on production merely to test it. Team work items and source catalog were not edited by this batch.

Server receipts: `releases/0.7.1-325663d35332/activation/activation-receipt.json` and `releases/0.7.1-325663d35332/activation/pilot-onboarding-20261111T075656Z/pilot-onboarding-receipt.json` under `/home/iptech/.local/share/libetech-ai-os`.
