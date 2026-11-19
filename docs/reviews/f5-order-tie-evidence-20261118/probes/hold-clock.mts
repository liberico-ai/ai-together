// Set-up file for a diagnostic run only; the suite never loads it. It holds the JavaScript clock still while a case runs (its beforeEach included),
// so every PGlite transaction of that case gets the same now(): «every row was created within one tick of the clock».
import {afterEach,beforeEach} from 'vitest';
const real=Date.now;
beforeEach(()=>{const held=real();Date.now=()=>held;});
afterEach(()=>{Date.now=real;});
