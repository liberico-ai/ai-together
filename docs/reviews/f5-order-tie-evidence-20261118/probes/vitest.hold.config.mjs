// Diagnostic configuration: the suite's own settings plus the held clock. Run from the repository root:
//   npx vitest run --config docs/reviews/f5-order-tie-evidence-20261118/probes/vitest.hold.config.mjs tests/review-delegations.test.ts
import {fileURLToPath} from 'node:url';
export default {test:{root:process.cwd(),testTimeout:30000,hookTimeout:30000,fileParallelism:false,setupFiles:[fileURLToPath(new URL('./hold-clock.mts',import.meta.url))]}};
