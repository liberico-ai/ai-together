# SPEC-005 · Phase 1A — Bảng ngoại lệ nguồn chỉ đọc

Status: implemented locally, not deployed. Owner proposal: Phương for source mapping; Quân for importer/technical verification. This slice does not change task, HR, BoM or payroll records.

## Problem and decision

The current shared checklist has 44 work rows but 25 of 29 open rows have no due date. Imported source status and deadlines must remain distinguishable from accepted work and an approved baseline. The local AI OS currently has only one project in the observed Chairman scope and no continuous Sheets ingestion. This slice provides a deterministic exception report from a bounded, operator-provided Sheet export before any canonical task mapping.

The report is a **read-only derivative**. Its `source_ref` is a locator, not a permanent task ID. A changed row does not automatically become a reassignment, acceptance, or employee performance event. See `../src/server/source-snapshot.ts:97`.

## Input contract

`src/server/source-snapshot.ts` accepts JSON with the four required external-source tracking fields `source_id`, `source_type`, `ingested_at`, `quality_score`, plus `quality_basis`, `source_url`, `source_modified_at`, `sheet`, `range`, and the eight-column `values` range. `quality_score` measures provisional source trust only; it does not measure an employee. The reader rejects another sheet in a before/after comparison and the wrong header.

```text
node --import tsx scripts/inspect-source-snapshot.ts current.json output.json [previous.json]
```

The output path must be new (`wx`) and is created with owner-only file permissions (`../scripts/inspect-source-snapshot.ts:11`). Use a restricted folder for real team data. This command does not access Google Drive by itself, write the Sheet, or insert AI OS records. The source export must be captured by an authorized reader; later implementation will add a governed adapter and rights review.

## Output and gates

- Report rows, snapshot digest, source metadata, and exception list with source locator and a next step.
- Exceptions: missing owner, missing due for open work, ambiguous date, month/day format conflict, invalid date, duplicate STT, changed row, removed row.
- Ambiguous slash dates stay raw. A changed cell or removed row always requires human mapping, because STT and row numbers are not durable work IDs.
- Status “Hoàn thành” is counted as `source_done`, never as technical or business acceptance.
- No logic for person score, KPI, money, source write, or BoM vote in this slice.

## Verification on 10/11/2026

On an isolated copy: typecheck passed; three focused tests passed. A read-only export of the current `Đầu việc Tech!A1:H65` yielded 44 rows, 15 `source_done`, 29 `source_open`, and 31 exceptions. The 31 exceptions are **events**, not unique rows; a row can appear more than once. The source was observed at 09:13:18 UTC and is not guaranteed current when this file is read later. The output is saved outside the repository; no real-team spreadsheet was modified.

## Next integration slice

1. Confirm all-project catalog and per-project source ownership; capture Drive permission, sheet revision, scope and refresh receipt.
2. #hypothesis: Add an authorized read adapter with watermark and an exception review queue. Map source rows to stable work IDs only after owner confirmation.
3. Feed project/portfolio dashboards from scoped Z2 projections. Confirm the same rights on bot, browser and exports.
4. Run STT5 and LBRC014 against source drift, identity, SHA and acceptance, without rewriting the shared Sheet.
