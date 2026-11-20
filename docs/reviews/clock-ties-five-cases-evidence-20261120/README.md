# Evidence — five cases that needed two rows to differ in time (20/11/2026)

Base: `libetech-ai-os` at `8c70088`. Test change: commit `0f4b123` (three test files; no file under `src/`, no migration).
Logs carry `<repo>` in place of the checkout path. The identifiers in the failure dumps are the repository's own fixture ids
(`1x000000-0000-4000-8000-…`) or random ids of rows in a throwaway test database. The held-clock diagnostic is the one of PR 23
(`docs/reviews/f5-order-tie-evidence-20261118/probes/`), always one file at a time and with a time limit per run.

## Verdict per case

Every case is (a): the case assumed that rows written one after the other have different `created_at`; the service's order is total and stable.
No case is (b). Lines are those of the base.

| # | Case (failing line) | What the case did | What the service does | Verdict |
|---|---|---|---|---|
| 1 | `tests/intake.test.ts:268` — «OQ-30 an edit after the group is flagged stores the excerpt on that revision only» | Its own helper read the audit rows `ORDER BY created_at,id` (`:258`) and expected revision 1 first | Writes one audit row per revision, with the revision number in the payload (`src/server/intake.ts:112`). No service query is involved in the failing read | (a) |
| 2 | `tests/doc-approval-proposal.test.ts:492` — «listOwn returns the caller's own open ballots of that project …» | Proposed two ballots in a row and expected them in that order | `ORDER BY a.created_at,a.id LIMIT 200` (`src/server/doc-approval-proposals.ts:196`) | (a) |
| 3 | `tests/document-review.test.ts:433`, `:434` — «comments are tied to the latest revision; addressed and resolved follow their roles; …» | Took `comments.at(-1)` to be the comment just written | `ORDER BY c.created_at,c.id LIMIT 1001` (`src/server/document-review.ts:194`) | (a) |
| 4 | `tests/document-review.test.ts:461` — «a reply is stored on the revision of the comment it answers» | Same: `comments.at(-1)` | Same query | (a) |
| 5 | `tests/document-review.test.ts:669` — «the flags of detail() and the answers of comment() agree for every state of a thread» | In its loop took `comments.at(-1)` to be the new top-level comment (`:662`) and sent the follow-ups to it | Finds the parent by id among top-level comments (`:259`–`:262`); a thread is closed when it has a `resolved` reply, whatever the times (`:118`, `:265`–`:266`) | (a) |

Case 5 is the one where an answer of the service changed. `probe-last-comment.txt` shows why: with every row of one instant the last comment of the
list was not the new comment in 10 of 12 calls; in 6 it was a reply row, and a follow-up sent to a reply row is answered `SCOPE_DENIED` (6 of 6), which is
the service's rule for «not a top-level comment of this document». The same follow-up sent to the comment the call really wrote was answered `ok` 12 of 12.
In the red log the case fails in two ways for the same reason: 4 times on the assertion at `:669` (`SCOPE_DENIED`), and 4 times with an uncaught
`COMMENT_RESOLVED`. The only call of the loop that does not catch is the set-up call at `:663`, so that error means the last comment was an older
top-level comment whose thread an earlier turn of the loop had closed (my reading of the code; the log's stack shows the service frames only).

A sixth case reads through the helper of case 1 and failed the same way (2 of 8 runs): `tests/intake.test.ts:290`, «OQ-30 an edit after the project
becomes IBS HI keeps pointer and hash only». The helper is one function, so the change to it covers both cases.

## Files

| File | What it holds |
|---|---|
| `red-held-clock-before.txt` | The three unchanged files, clock held, 8 runs each (24 runs) |
| `red-summary.txt` | Counts taken from that log with grep/sort/uniq: runs failed per case, failing lines, first lines of the failures |
| `probe-last-comment.txt`, `probes/last-comment.mts` | The probe for case 5 and its script |
| `green-held-clock-after.txt` | The same 24 runs after the change: 24 of 24 pass |
| `mutation.txt` | Three mutations of the service files; each is caught by assertions of the changed cases; sources restored identical |
| `green-pglite-20x.txt` | Each changed file alone, 20 times, clock running: 60 of 60 pass |
| `green-pglite.txt` | `npx vitest run`, PGlite: 67 files passed, 13 skipped; 1288 cases passed, 118 skipped; exit 0 |
| `typecheck.txt`, `build.txt` | `npm run typecheck` exit 0; `rm -rf .next && npm run build` exit 0 |
| `green-native.txt` | PostgreSQL 16.15, a throwaway container: the three files, 3 times each, 9 of 9 pass |
| `green-pglite-on-52b1e84.txt` | The integration branch moved to `52b1e84` (PR 28) after this branch was cut. A local trial merge, never pushed: no conflict; `npx vitest run` 68 files passed, 14 skipped; 1311 cases passed, 136 skipped; exit 0; typecheck exit 0 |

## Limits

- Under the held clock a case fails only when the random ids of its tied rows fall the wrong way, so «red» is a count out of 8, not 8 of 8
  (case 2 failed in 1 run of 8). «Green after» is 0 failures in the same 24 runs.
- The PostgreSQL 16 run used a throwaway container of this session, not `libetech-slice1-pg`, with only `SLICE1_TEST_DATABASE_URL` set: no separate
  restricted web login. The whole suite was not run on PostgreSQL 16.
- On the trial merge with `52b1e84` the suite and the typecheck were run; the build, the held-clock runs and the PostgreSQL 16 run were not repeated
  (that merge touches none of the three files, none of their fixtures and nothing under `src/server`).
- Only these three files were run with the clock held. Other cases of the suite may have the same assumption.
