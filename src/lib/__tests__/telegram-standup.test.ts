import { describe, it, expect } from 'vitest';
import { formatStandupMessage, type StandupTask } from '../telegram-standup';

const NOW = new Date('2026-04-16T01:30:00.000Z'); // 08:30 Asia/Ho_Chi_Minh

function makeTask(overrides: Partial<StandupTask> = {}): StandupTask {
  return {
    id: 'TASK-001',
    title: 'Default task',
    deadline: null,
    assignee: { id: 'U1', name: 'Alice' },
    ...overrides,
  };
}

describe('formatStandupMessage', () => {
  it('returns empty-state message when no tasks', () => {
    const chunks = formatStandupMessage([], NOW);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('✅');
    expect(chunks[0]).toContain('Sáng nay không có task nào');
    expect(chunks[0]).toContain('Daily Standup');
  });

  it('renders single task with deadline', () => {
    const chunks = formatStandupMessage(
      [makeTask({ id: 'TASK-042', title: 'Refactor auth', deadline: new Date('2026-04-18T00:00:00Z') })],
      NOW
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('🌅');
    expect(chunks[0]).toContain('Tasks đang In Progress: 1');
    expect(chunks[0]).toContain('<b>Alice</b>');
    expect(chunks[0]).toContain('TASK-042');
    expect(chunks[0]).toContain('Refactor auth');
    expect(chunks[0]).toContain('⏰ Deadline: 2026-04-18');
  });

  it('flags overdue tasks', () => {
    const chunks = formatStandupMessage(
      [makeTask({ id: 'TASK-055', deadline: new Date('2026-04-14T00:00:00Z') })],
      NOW
    );
    expect(chunks[0]).toMatch(/⚠️ Quá hạn \d+ ngày \(2026-04-14\)/);
  });

  it('handles task without deadline', () => {
    const chunks = formatStandupMessage([makeTask({ deadline: null })], NOW);
    expect(chunks[0]).toContain('(không có deadline)');
  });

  it('groups multiple tasks by assignee, sorted A-Z', () => {
    const chunks = formatStandupMessage(
      [
        makeTask({ id: 'T1', assignee: { id: 'U2', name: 'Charlie' } }),
        makeTask({ id: 'T2', assignee: { id: 'U1', name: 'Alice' } }),
        makeTask({ id: 'T3', assignee: { id: 'U1', name: 'Alice' } }),
      ],
      NOW
    );
    const text = chunks.join('\n');
    const alicePos = text.indexOf('Alice');
    const charliePos = text.indexOf('Charlie');
    expect(alicePos).toBeLessThan(charliePos);
    expect(text).toContain('<b>Alice</b> (2)');
    expect(text).toContain('<b>Charlie</b> (1)');
  });

  it('renders unassigned tasks in 👻 group at the end', () => {
    const chunks = formatStandupMessage(
      [
        makeTask({ id: 'T1', assignee: { id: 'U1', name: 'Alice' } }),
        makeTask({ id: 'T2', assignee: null }),
      ],
      NOW
    );
    const text = chunks.join('\n');
    expect(text).toContain('👻');
    expect(text).toContain('Chưa assign');
    expect(text.indexOf('Alice')).toBeLessThan(text.indexOf('Chưa assign'));
  });

  it('escapes HTML in title and assignee name', () => {
    const chunks = formatStandupMessage(
      [
        makeTask({
          title: '<script>alert(1)</script>',
          assignee: { id: 'U1', name: 'Bob & "Jr"' },
        }),
      ],
      NOW
    );
    const text = chunks[0];
    expect(text).not.toContain('<script>');
    expect(text).toContain('&lt;script&gt;');
    expect(text).toContain('Bob &amp; &quot;Jr&quot;');
  });

  it('splits into multiple chunks when exceeding maxChunkLen', () => {
    const longTitle = 'x'.repeat(200);
    const tasks = Array.from({ length: 50 }, (_, i) =>
      makeTask({ id: `TASK-${i}`, title: longTitle })
    );
    const chunks = formatStandupMessage(tasks, NOW, { maxChunkLen: 1000 });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c) => {
      expect(c.length).toBeLessThanOrEqual(1000);
    });
    // Tất cả task vẫn phải xuất hiện trong tổng
    const combined = chunks.join('\n');
    for (let i = 0; i < 50; i++) {
      expect(combined).toContain(`TASK-${i}`);
    }
  });

  it('falls back to line-splitting when a single block exceeds maxChunkLen', () => {
    // Single task with large title that, when rendered with the header, exceeds maxLen=200
    const hugeTitle = 'y'.repeat(300);
    const chunks = formatStandupMessage(
      [makeTask({ id: 'BIG-1', title: hugeTitle })],
      NOW,
      { maxChunkLen: 200 }
    );
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    chunks.forEach((c) => expect(c.length).toBeLessThanOrEqual(200));
    // Title content must still be present across chunks (combined)
    const combined = chunks.join('');
    expect(combined).toContain('BIG-1');
  });
});
