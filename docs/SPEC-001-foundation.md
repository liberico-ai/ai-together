# SPEC-001 — LibeTech AI OS foundation

Authority: Chairman, 2026-11-08: “Chắc đã dừng hoạt động. Em căn cứ để xây mới đi”. The old lab's status remains unverified. This authorizes a new build; it does not establish a shutdown or authorize migration/deployment.

## Outcome
A runnable local web/backend slice for LibeTech operations, with synthetic data, persistent PostgreSQL-compatible storage, scoped read APIs for a future bot, and explicit missing integrations.

## Included
1. Service catalog: owner roles, project/BU, repository reference, environments and observed-version state.
2. Work items: durable UUID and human code, service link, assignee, technical/business acceptor, deadline, spec reference, exact source SHA, state and version.
3. Evidence: bounded metadata and source links, type/revision/ingestion timestamp/quality; never infer delivery from a link.
4. Lifecycle: planned → doing → review → done; blocked/return-to-doing. Done requires separate technical and business acceptance for the current revision/SHA. Neither acceptor may be the implementer; roles are assigned per item.
5. Ticket closure is an independent audit event and never changes acceptance or work state.
6. Shared backend validates web mutations; bot may only read allowed projects. Cross-tenant/project and no-context access must be denied.
7. Append-only audit, optimistic concurrency and idempotent commands. Analytics overview reads Z2 projection with freshness timestamp.
8. Release/operations/Factory pages show the service records and explicitly unconnected integrations; no invented runtime observations.

## Excluded from this slice
Live data import, actual Telegram delivery, AI inference, Factory dispatch, production authentication, external deployment, infrastructure control and payroll decisions.

## Acceptance tests
- A01 scoped lists/details exclude the other tenant/project; no principal denied.
- A02 forged tenant/actor body fields rejected; bot cannot mutate.
- A03 stale version causes 409, no audit/state side effect; retry with same idempotency key returns same result; key reuse with different content rejected.
- A04 implementer cannot accept own work, wrong reviewer rejected; criteria and exact SHA/revision required.
- A05 completing work without both valid acceptance events denied; changing revision invalidates earlier acceptance.
- A06 closing a ticket has no effect on work acceptance.
- A07 audit immutable at database role boundary; missing RLS context yields no rows.
- A08 data survives application restart; health shows database and schema state, never fabricates a source SHA.
- A09 usable Vietnamese UI with filter/search, work detail, evidence/acceptance timeline and actionable errors.
- A10 local demo cannot start an authenticated session from a non-loopback host or without its explicit flag.

The first real pilot remains a separately authorized, source-reconciled work item. Synthetic examples are not evidence for LBRC014 or any customer system.

