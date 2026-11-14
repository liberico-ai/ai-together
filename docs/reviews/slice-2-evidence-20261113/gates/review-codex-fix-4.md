# Review — Codex fix round 4 (429adeb..f6f4ead)

## Part 1 Spec
- R4-1.1 parseBridgeConfig normalises each chatScopes list to distinct ids, first kept, order kept: ✅ (bridge-config.ts:21)
- R4-1.2 intake.ts counts distinct ids; [] DENIED, one distinct accepted, 2+ distinct AMBIGUOUS: ✅ (intake.ts:48-51)
- R4-1.3 other readers audited: ✅ (below)
- Tests listed in the brief present (intake x2, config, HTTP): ✅
- Scope kept (no bot-plugin/migrations/docs change): ✅ (5 files only)
Verdict: spec met.

## Part 2 Findings
Critical: 0. Important: 0.

(a) Normalisation. Subset checks at bridge-config.ts:16-18 run on Object.keys(c.chatScopes) and intake.chats before the return, and the return keeps the same keys (chatId regex is digits only, so no __proto__ key issue). Set dedup of string ids cannot add or remove a granted id, only repeats. [] stays []. intake.chats/excerptChats are passed through unchanged via {...c}.

(b) Readers of chatScopes lists (f6f4ead):
- src/app/api/bridge/route.ts:10 passes config.chatScopes to handleBridge: no list logic.
- src/server/bridge.ts:32 `granted=chatScopes[c.chatId]`, then :33 `p.projectIds.filter(id=>granted.includes(id))`: includes, a duplicate has no effect.
- src/server/bridge-io.ts:26 `[...new Set(i.chats.flatMap(c=>chatScopes[c]??[]))]`: already dedups.
- src/server/bridge-io.ts:22 hands the object to IntakeService; intake.ts:48 the only count (now distinct).
- bridge-config.ts:16-17 uses keys only.
No other reader.

(c) Same pattern elsewhere: none that refuses or mis-routes. intake.chats: only `.includes` (intake.ts:47); chats within bridge-io.ts:26 are flatMapped into a Set. excerptChats: `.includes` at intake.ts:69, inbox.ts:93, and subset check bridge-config.ts:18; no count. Plugin allowlist: bot-plugin/__init__.py:814 `frozenset(chats)`, a duplicate is absorbed.

(d) Tests vs fix. RED log (codex-fix-4-red.log) shows the three behavioural tests failing before the fix (intake [A,A], config dedup, HTTP 200), green log shows 65/65 then full 483 pass. The intake.test [A,A,B] test passes before and after: it is a guard for the unchanged OQ-27 refusal, not a RED test; acceptable. The HTTP test is redundant with the two layers (it fails only if both normalisations are removed); fine, it covers the real path with a config file.

Minor
- M1 src/server/bridge-config.ts:9,21 and intake.ts:48: "distinct" is by string. z.string().uuid() accepts mixed case, so `[A, A.toUpperCase()]` is two entries to the Set and still gives INTAKE_PROJECT_AMBIGUOUS, though Postgres treats it as one project. Scenario: operator pastes an upper-case copy of the same id. Pre-existing looseness, not part of the finding; harmless (refusal is fail-closed, and bridge.ts:33 includes would also not match a differently-cased id). Optional: lower-case in the schema transform.
- M2 intake.ts:48 and bridge-config.ts:21 now duplicate the dedup; intentional per the brief (IntakeService can be built without parseBridgeConfig). No action.

⚠️ Not verifiable here: test runs (not allowed), I relied on the RED/GREEN logs.
