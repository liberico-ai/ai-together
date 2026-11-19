// Diagnostic configuration: the suite's own settings plus the held clock. Run from the repository root, one file at a time:
//   npx vitest run --config docs/reviews/f5-order-tie-evidence-20261118/probes/vitest.hold.config.mjs tests/review-delegations.test.ts
// Do not run the whole suite with it. On 2026-11-18 such a run stopped advancing after three files; its worker kept one processor busy and
// stayed behind after the run was stopped, until it was stopped by hand (the file it was in was not identified). Give every run a time limit
// and check afterwards that no worker is left.
import {fileURLToPath} from 'node:url';
export default {test:{root:process.cwd(),testTimeout:30000,hookTimeout:30000,fileParallelism:false,setupFiles:[fileURLToPath(new URL('./hold-clock.mts',import.meta.url))]}};
