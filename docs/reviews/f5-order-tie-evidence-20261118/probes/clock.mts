// Probe: which clock does PGlite read, and how fine is it? Run from the repository root: npx tsx docs/reviews/f5-order-tie-evidence-20261118/probes/clock.mts
// Opens the same PGlite database the tests use (tests/slice1-db.ts, no SLICE1_* variable set). Reads only; writes nothing.
import {openHarness} from '../../../../tests/slice1-db.ts';
const h=await openHarness();
const one=async(sql:string)=>(await h.operator.query<{t:string}>(sql)).rows[0].t;
const inTx=()=>h.operator.transaction(async tx=>(await tx.query<{t:string}>("SELECT to_char(now(),'HH24:MI:SS.US') t")).rows[0].t);
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
// (a) digits below the millisecond in 300 readings of clock_timestamp()
let fine=0;
for(let i=0;i<300;i++) if(!(await one("SELECT to_char(clock_timestamp(),'US') t")).endsWith('000')) fine++;
console.log(`(a) clock_timestamp(), 300 readings: with a non-zero digit below the millisecond = ${fine}`);
// (b) 300 separate transactions, one after the other: how many got the same now() as the one before
let same=0,prev='';const t0=performance.now();
for(let i=0;i<300;i++){const t=await inTx();if(t===prev) same++;prev=t;}
console.log(`(b) now() of 300 separate transactions in ${(performance.now()-t0).toFixed(0)} ms: equal to the one before = ${same}`);
// (c) the clock is the JavaScript Date.now(): held still, two transactions 30 ms apart get the same now()
const a=await inTx();await sleep(30);const b=await inTx();
console.log(`(c) clock running, two transactions 30 ms apart: ${a} ${b} equal = ${a===b}`);
const real=Date.now,held=real();Date.now=()=>held;
const c=await inTx();await sleep(30);const d=await inTx();
Date.now=real;
console.log(`(c) Date.now() held, two transactions 30 ms apart: ${c} ${d} equal = ${c===d}`);
await h.close();
