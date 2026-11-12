# SPEC-007 · Duyệt tài khoản Team Tech trên Telegram

**Web update, 11 November 2026:** AI OS 0.7.0 provides a signed-in `/approvals` page with Yes/No buttons. It uses the same immutable vote records, frozen voter seats and Chairman plus one BoM quorum as the Telegram route. This web option is active; the Telegram `/duyet` one-tap candidate below remains uninstalled. Two existing ballots were visible but left unvoted. See [0.7.0 delivery](DELIVERY-007-team-catalog-20261111.md).

Status: **0.6.0 deployed on d1-ai1 on 11 November 2026; live first-account vote UAT pending**. Chairman decided on 11 November 2026: approval only at first account activation, with Chairman and any one of Chu Hoàng Anh, Quân or Phương. Later sign-ins use the member's password without a new approval.

## UX correction · 11 November 2026

Chairman stopped the live Thắng/Linh approval exercise and requested a Yes/No interaction instead of copying ballot UUIDs. The two live proposals remain unvoted and must not be issued as invitations for this test. Their frozen ballots expire after 48 hours; the registration requests remain separate.

An isolated source candidate adds `/duyet`: in a private Telegram chat the bot displays one card per pending ballot with the applicant, the **frozen project names, roles and report permissions**, and the administrator's reason. The approver taps **Yes** or **No**. Cancel, timeout, group chat, a missing scope label, or an unexpected choice records no vote. The backend still requires the linked Chairman and one distinct linked BoM member. Existing UUID commands remain for compatibility; the web help text points to `/duyet`.

This candidate is **not deployed**. The current bot does not push an automatic DM when a ballot is created, so the approver must open the private chat and use `/duyet` once. Automatic notification with delivery receipts is the remaining usability requirement before calling the interaction truly one-tap. No real account activation is part of this test.

Isolated verification on 11 November: bot bridge 11/11 tests, backend 53/53 tests, and TypeScript check passed. The SQL query resolves frozen project names while a tenant-isolation test hides another tenant's name. These results do not prove Telegram buttons or notification delivery on the live gateway; no gateway restart or production migration was performed for this candidate.

## Delivery readback · 11 November 2026

Chairman authorized deployment and one shared gateway restart. The server release `0.6.0-33ed20bb200c` answered `/api/health` with version `0.6.0`, build digest `33ed20bb200c376cd88d1e48267dd4ac2413af85ef50bbd8bb9c75d84cacd9c3`, PostgreSQL schema `001`–`009`, and the pre-existing counts of 3 users, 6 memberships, 3 Telegram links, 0 work items and 1 LBRC014 reconciliation at SHA `8d05141576bcd4db8e7ab9f1a6b7a0dd9bd360ab`. Migration 009 was rehearsed on a restored backup before application. The three live approval seats are `chairman`, `bom_quan` and `bom_phuong`; Hoàng Anh has no verified account/seat yet. Only the LibeTech bridge file was changed, after checking it matched the prior installed hash and retaining a backup. Gateway PID changed from `2515108` to `4112740`; its state reported 20/20 Telegram connections and unchanged profile configurations. The new `/libetech-access-pending` handler responded `BOUND_TELEGRAM_REQUIRED` from a local non-Telegram session, proving the running gateway loaded the command and enforced its transport boundary. The public HTTPS login and registration pages loaded.

No new registration was submitted for this readback, so two independent human DM votes, invitation, activation and post-activation group scope have **not** been accepted in production. The final optional server smoke script could not run because the Hermes terminal UI reported a frontend/backend version mismatch after the gateway restart; this did not affect the independently observed web health, bridge command or 20/20 gateway receipt. Server receipts are under `releases/0.6.0-33ed20bb200c/activation/` (`rehearsal-receipt.json`, `bridge-install-receipt.json`, `gateway-before-20261111.json`, `gateway-after-20261111.json`).

## Current boundary

Registration remains public but creates only `registration_requests`. The current 0.5.0 web admin can issue an invitation immediately; the candidate replaces that action with a frozen approval ballot. Neither a Telegram message read receipt nor a bot reply is a vote. The old direct invite API is rejected, and activation of an admin-issued invitation without a completed ballot is denied.

## Proposed flow

1. Tech member submits `/register`. Chairman verifies the person and project scope on `/team`, then proposes the exact grants and reason. No account, membership, invitation, or session is created yet.
2. Configure the Chairman seat and at least one of the three named BoM seats with distinct, active AI OS accounts already linked to Telegram. Missing BoM seats can be added later after verification. New ballots use only seats whose accounts are active and Telegram linked; an unavailable BoM does not block another verified BoM. An unavailable Chairman or all unavailable BoM seats blocks new ballots. Seat mapping is operator provisioned with a read-only check before apply; no seat is seeded by migration.
3. Each approver opens a private chat with `@LiBeAiTogetherBot` and uses `/libetech_access_pending` to view their pending ballots, then `/libetech_access_approve <UUID>` or `/libetech_access_reject <UUID>`. The gateway supplies Telegram ID and chat ID; the signed local bridge checks freshness and replay, resolves the linked AI OS account, checks the frozen seat, and stores one immutable vote. Group votes and forged IDs fail closed.
4. The ballot approves only after Chairman and at least one of the frozen BoM voters agree. Two BoM votes without Chairman are insufficient. A BoM rejection leaves the ballot pending while another frozen BoM can still approve; Chairman rejection or rejection by every frozen BoM closes it. Chairman then issues a one-time invitation on `/team` for the frozen grants. The member sets their password and subsequently signs in normally. Existing activated accounts retain their sessions and are not reapproved.
5. If seats, identity links, grant scope, or a ballot expiry change before issuance, the admin must reconcile and re-propose. Reissuing an invitation for the same approved, not-yet-activated account is allowed without new grants; changing grants before activation is blocked. After activation, reducing scope remains possible; adding a project, elevating a role or expanding report permissions is blocked until the separate access-change ballot is implemented.

## Data and authority

- Migration 009 adds an operator-owned seat map, frozen proposals, two to four voter snapshots, immutable votes, and an invitation reference. It changes no team work item, source sheet, prior membership, or legacy bot profile.
- The account administrator proposes and issues after quorum; no single web or bot actor can create a new account. The bot returns no invitation token. Invitation links still go privately to the verified member.
- Telegram approval is for the new AI OS account and its proposed project grants. It does not itself accept a task, change the BoM work allocation, approve KPI/payroll, or replace a BU data owner’s authorization.
- Because the first ballot freezes its grants, a later web access update cannot quietly expand them. A follow-up ballot for changes to an existing member is required before broader project rollout.
- Only the private chat with the connected bot carries approval commands. No candidate details are posted to a shared group by this candidate. Approvers retrieve their queue; automatic DM notifications are a later delivery feature with its own receipt.

## Tests and release gates

- Isolated tests must cover: no invitation with Chairman alone or BoM alone, approval with Chairman plus one BoM, BoM rejection followed by another BoM approval, Chairman rejection, direct and legacy invitation bypass, private-chat-only voting, and activation/pairing after approval. Typecheck, adapter tests and production build are release gates.
- Production readback completed the verified identity/seat mapping, backup/restore rehearsal, migration, backend/bridge deployment and 20/20 reconnect gates. A real new registration, two independent DM votes, invitation, login and group denial remain the live acceptance gate before calling the approval flow fully verified.
