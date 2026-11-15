import { describe, it, expect } from 'vitest';
import { wasCut } from '../src/server/list-cut';

// W9: one pure rule decides «this list was cut» from the rows fetched and the cap (fetch cap + 1 where no total exists), or from a known total.
describe('wasCut', () => {
  it('without a total: cut only when more than the cap was fetched', () => {
    expect(wasCut({ fetched: 0, cap: 1000 })).toBe(false);
    expect(wasCut({ fetched: 1000, cap: 1000 })).toBe(false);
    expect(wasCut({ fetched: 1001, cap: 1000 })).toBe(true);
    expect(wasCut({ fetched: 201, cap: 200 })).toBe(true);
    expect(wasCut({ fetched: 200, cap: 200 })).toBe(false);
  });
  it('with a total: cut when the total is larger than what is shown', () => {
    expect(wasCut({ fetched: 200, cap: 200, total: 200 })).toBe(false);
    expect(wasCut({ fetched: 200, cap: 200, total: 201 })).toBe(true);
    expect(wasCut({ fetched: 3, cap: 200, total: 3 })).toBe(false);
    expect(wasCut({ fetched: 0, cap: 200, total: 0 })).toBe(false);
  });
});
