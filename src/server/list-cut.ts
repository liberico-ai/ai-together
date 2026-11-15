/** Was a list cut? From the rows fetched and the cap (fetch cap + 1 where there is no total), or from a known total. */
export function wasCut(o: { fetched: number; cap: number; total?: number }): boolean {
  return o.total === undefined ? o.fetched > o.cap : o.total > o.fetched;
}
