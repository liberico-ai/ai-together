"""Reads the stderr log of the test PostgreSQL server (`docker logs <container>`) and prints, for every DROP DATABASE of a
test-named database (slice1_verify_<13-digit ms><2 digits>) that ended in an error: when, why, and how long after the DROP
was sent the next checkpoint completed. Then the durations of the checkpoints. Prints database names and server times only.

Usage: python3 -I cause.py <server.log> "<until, UTC, YYYY-MM-DD HH:MM:SS>"
Lines after <until> are left out: the work on this branch cancels such drops on purpose (the red runs)."""
import collections
import re
import sys
from datetime import datetime, timedelta

until = sys.argv[2]
lines = [l for l in open(sys.argv[1], errors='replace').read().split('\n') if l[:4].isdigit() and l[:19] <= until]
pat = re.compile(r'^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d+) \S+ \[(\d+)\] (\w+):  (.*)$')
ts = lambda s: datetime.strptime(s, '%Y-%m-%d %H:%M:%S.%f')
checkpoints, hits, durations, last_error, reason = [], [], [], {}, None
for line in lines:
    m = pat.match(line)
    if not m:
        continue
    t, pid, level, msg = m.groups()
    if msg.startswith('checkpoint starting: '):
        reason = msg.split(': ', 1)[1]
        checkpoints.append((ts(t), msg))
    elif msg.startswith('checkpoint complete'):
        checkpoints.append((ts(t), msg))
        total = re.search(r'total=([\d.]+) s', msg)
        if total:
            durations.append((float(total[1]), reason or '?'))
    if level in ('ERROR', 'FATAL', 'PANIC'):
        last_error[pid] = (ts(t), msg)
    elif level == 'STATEMENT':
        d = re.match(r'DROP DATABASE (?:IF EXISTS )?"?(slice1_verify_\d{15})"?(.*)$', msg)
        if d and pid in last_error:
            at, why = last_error.pop(pid)
            hits.append((at, d[1], why, d[2].strip()))

print(f'log: {lines[0][:19]} -> {lines[-1][:19]} UTC')
print(f'\nDROP DATABASE of a test-named database that ended in an error: {len(hits)}')
print('by message:', dict(collections.Counter(h[2] for h in hits)))
for at, name, why, tail in hits:
    sent = at - timedelta(seconds=10)
    start = [(t, m) for t, m in checkpoints if t <= at and m.startswith('checkpoint starting')][-1:]
    done = [(t, m) for t, m in checkpoints if t >= sent and m.startswith('checkpoint complete')][:1]
    print(f'\n{name} {tail}\n  cancelled {at:%m-%d %H:%M:%S} ("{why}"), so sent about {sent:%H:%M:%S}')
    for t, m in start:
        print(f'  latest checkpoint start before the cancel: {t:%H:%M:%S} {m}')
    for t, m in done:
        x = re.search(r'wrote (\d+) buffers.*?write=([\d.]+) s, sync=([\d.]+) s, total=([\d.]+) s', m)
        print(f'  first checkpoint complete after the DROP was sent: {t:%H:%M:%S}, {(t - sent).total_seconds():.1f} s later '
              f'(buffers={x[1]} write={x[2]}s sync={x[3]}s total={x[4]}s)')


def row(label, values):
    v = sorted(x for x, _ in values)
    print(f'{label}: n={len(v)} median={v[len(v) // 2]:.1f}s p99={v[int(.99 * len(v))]:.1f}s max={v[-1]:.1f}s over 10 s: {sum(x > 10 for x in v)}')


print()
row('all checkpoints', durations)
row('checkpoints that started as immediate', [d for d in durations if 'immediate' in d[1]])
