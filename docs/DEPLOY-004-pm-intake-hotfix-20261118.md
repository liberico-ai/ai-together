# PM intake bridge hotfix — 18 Nov 2026

## Scope and evidence

- AI OS web release remains `0.8.0-8e0e5c41163b`. No migration, database update, workbook edit, or team source update was made in this hotfix.
- `PMTEST-083` reached the LibeTech gateway from LibeAI at 08:57:11 UTC and from Libe–Xeca at 08:57:21 UTC. LibeAI persisted one `source_event` and one `intake_candidate`, displayed as `IN-1E6D29D8` with source pointer `telegram:-5298399184:1055`. Xeca persisted zero rows. This verifies the intake scope for this one test, not all BU authorization paths.
- LibeAI's `source_events.addressed=false`, so no `outbox_messages` or `delivery_receipts` row was created for that test. The two model responses seen in Telegram sessions were ordinary gateway responses, not official intake receipts. No work item was created.
- Root cause: Hermes removes the `@bot` trigger from `MessageEvent.text` before `pre_gateway_dispatch` and does not copy its mention decision into an event flag. `raw_message` retains Telegram entities and bot identity.

## Changes and verification

- `18026a9` (bridge 0.3.1) recovers sender ID and original text from the placement-bound raw Telegram message when Hermes shared group context removes `source.user_id`.
- `77bcc08` (bridge 0.3.2) derives addressed state from the same raw message's Telegram mention, text mention, or reply to this bot. It does not use a plain-text attribution line or a mention of another bot.
- Local verification: `python3 -m pytest tests/test_bot_bridge.py -q` → 76 passed, 69 subtests passed; `git diff --check` and Python compile passed. One regression uses a real `python-telegram-bot` Message with a UTF-16 entity offset.
- Gateway plugin files were copied atomically after SHA and syntax checks. Prior 0.3.1 files are backed up at `/home/iptech/.local/share/libetech-ai-os/releases/0.8.0-8e0e5c41163b/activation/bridge-0.3.1-backup-20261118T091530Z/`.
- Installed `__init__.py` SHA-256: `ac5f8c1eee02f8cf3e980a120a5321c679609b3bc552b00ab979d6daaac4ecde`; `plugin.yaml`: `75767fae73d5e14a1c7b676d28eddb0eaf64218bf0f51fef555bcb0f2d2ef3a1`.
- Shared gateway restarted at 09:16 UTC. New PID `3399249` was active; 20/20 Telegram profiles connected. LibeTech polling was healthy at 09:21:48 UTC and Xeca at 09:22:43 UTC. No new plugin traceback or intake warning was observed. This proves startup and on-disk hash, not the receipt flow.

## Acceptance still required

Send a fresh `PMTEST-084` mentioning the bot from a human Telegram account in LibeAI and Libe–Xeca after both polling connections. Confirm exactly one LibeAI source event/candidate, an `intake.received` outbox row and delivery receipt with the same `IN-` reference, and zero Xeca source events/candidates. Check actual recipient-visible replies. Do not backfill or replay `PMTEST-083` to manufacture the missing receipt.
