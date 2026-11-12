# LibeTech AI OS 0.7.0 · Team Tech catalog and web approval

Observed on 11 November 2026 at `https://libetech.btnet.vn/`.

- Public `/api/health`: `0.7.0`, build digest `aa829ca642f4f696bcd57538996a9d950006739b65d90975d700aee0879c3b88`, PostgreSQL schema `001`–`011`.
- `/portfolio`, signed in as Chairman: 45 source task rows, broken down into LBRC 18, XECA 7 and IBS HI 20. It shows 17 platform names from the 26 October platform inventory. Source sheet was last modified at `2026-11-11T04:23:09.206Z`, checked again before activation. Platform account and key columns were excluded.
- Task title, source assignee, source status, due text and source row remain source attributes. The import wrote only `analytics.tech_source_tasks`, `analytics.tech_platform_catalog` and a snapshot receipt, not Z1 `work_items` or the team's Google Sheet. Source status `Hoàn thành` does not imply technical or business acceptance or a payroll score.
- `/approvals`, signed in as Chairman, presents two frozen ballots for Thắng and Linh with Yes/No buttons. The route uses the existing Chairman plus one BoM quorum and vote ledger. Neither ballot was clicked. Chu Hoàng Anh did not appear among live registration requests at the time of readback.
- The deploy staged a source archive with SHA256 `d95cee578a4f4cb6524f8480c8d5619b11783e467e6296ea018fbe6a263ad6b7`, verified all current 0.6.0 release source files against its prior manifest, and built 0.7.0 in a new release directory. A PostgreSQL dump was restored into an isolated cluster; migrations 010–011 and the 45+17 source import passed there before live apply.
- The live import retained 3 users, 6 registration requests, 3 Telegram links, 0 Z1 work items, 1 LBRC014 reconciliation, 2 approval ballots and 0 approval votes. Migration added three catalog projects and Chairman memberships, bringing project memberships to 9. The server activation receipt records `protectedRecordsPreserved=true`, `gatewayPidUnchanged=true`, login HTTP 200, anonymous authentication 401, foreign origin 403, unsigned bridge 401, and both new pages HTTP 200.
- Local verification: 56 tests passed; the exact release archive built with Next.js webpack. The web service alone restarted. The shared Telegram gateway did not restart, and the candidate `/duyet` Telegram Yes/No interaction is not deployed.

Server receipts: `/home/iptech/.local/share/libetech-ai-os/releases/0.7.0-aa829ca642f4/activation/`. The original 0.6.0 release and the pre-migration database dump remain available for recovery. Initial web switch attempts reverted because the unit's `TimeoutStopUSec` is 90 seconds; the successful switch waited through that stop cycle. The final public health readback was 0.7.0.

Remaining scope: team member access to the three new catalog projects must be assigned per verified project roster. The source snapshot is a read-only catalog, not a replacement for the team's work board. No account activation or business task acceptance was performed in this release.

## BoM catalog access · 11 November 2026

Chairman requested BoM access to the new source catalog. A scoped server preflight confirmed that `quan` and `phuong` were active, password activated, Telegram linked and bound to their respective BoM seats. It also confirmed that neither had membership in the three new catalog projects. Chu Hoàng Anh had no verified account, so no grant was made under another person's identity.

An additive operator grant inserted six `viewer` memberships: Quân and Phương each received read-only access to `IBS HI · Team Tech`, `LBRC · Team Tech` and `XECA · Team Tech`. No report permission, acceptance role or scoring authority was added. Existing `LBRC · App Saleman` and `LibeTech AI OS · Nội bộ` memberships were preserved. A pre-change PostgreSQL dump has SHA256 `74e677533165d6a3189bfab815f6d270608fa1d0fe9253885be6c5bc0ea30e17`; six immutable identity audit events recorded the grants. The operator receipt time is `2026-11-11T06:30:26.618669+00:00`.

Live `/team` readback showed the three new roles as `Chỉ đọc` for both accounts. Quân retained `Thực hiện` on `LBRC · App Saleman`; Phương retained `Điều phối` there. The source work board and team data were not changed. This one-time operator grant used the Chairman's explicit instruction because the current account UI blocks access expansion pending a fresh Telegram ballot; future grants should use the product approval flow once implemented. Chu's membership remains pending his own verified registration and Chairman approval.
