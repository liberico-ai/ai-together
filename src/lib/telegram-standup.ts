import { escapeHtml } from './escape-html';
import { format, differenceInCalendarDays, isBefore, startOfDay } from 'date-fns';

export interface StandupTask {
  id: string;
  title: string;
  deadline: Date | null;
  assignee: { id: string; name: string } | null;
}

export interface StandupFormatOptions {
  maxChunkLen?: number;
}

const DEFAULT_MAX_CHUNK_LEN = 4000;
const UNASSIGNED_KEY = '__unassigned__';

interface Group {
  sortKey: string;
  header: string;
  tasks: StandupTask[];
}

function renderTaskLine(task: StandupTask, now: Date): string {
  const title = escapeHtml(task.title);
  const head = `• ${task.id} — ${title}`;
  if (!task.deadline) {
    return `${head}\n  (không có deadline)`;
  }
  const deadlineStr = format(task.deadline, 'yyyy-MM-dd');
  if (isBefore(task.deadline, startOfDay(now))) {
    const daysOverdue = differenceInCalendarDays(startOfDay(now), task.deadline);
    return `${head}\n  ⚠️ Quá hạn ${daysOverdue} ngày (${deadlineStr})`;
  }
  return `${head}\n  ⏰ Deadline: ${deadlineStr}`;
}

function groupTasks(tasks: StandupTask[]): Group[] {
  const map = new Map<string, Group>();
  for (const t of tasks) {
    const key = t.assignee ? t.assignee.id : UNASSIGNED_KEY;
    if (!map.has(key)) {
      const name = t.assignee ? t.assignee.name : 'Chưa assign';
      const emoji = t.assignee ? '👤' : '👻';
      map.set(key, {
        sortKey: t.assignee ? name.toLowerCase() : '\uFFFF', // unassigned cuối
        header: `${emoji} <b>${escapeHtml(name)}</b>`,
        tasks: [],
      });
    }
    map.get(key)!.tasks.push(t);
  }
  return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

function renderGroupBlock(group: Group, now: Date): string {
  const lines = [`${group.header} (${group.tasks.length})`];
  for (const t of group.tasks) lines.push(renderTaskLine(t, now));
  return lines.join('\n');
}

function packBlocksIntoChunks(header: string, blocks: string[], maxLen: number): string[] {
  const chunks: string[] = [];
  let current = header;
  for (const block of blocks) {
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length <= maxLen) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    // Nếu block tự thân vượt maxLen → cắt thô theo dòng
    if (block.length > maxLen) {
      const lines = block.split('\n');
      let buf = '';
      for (const line of lines) {
        const cand = buf ? `${buf}\n${line}` : line;
        if (cand.length <= maxLen) {
          buf = cand;
        } else {
          if (buf) chunks.push(buf);
          buf = line.length <= maxLen ? line : line.slice(0, maxLen);
        }
      }
      current = buf;
    } else {
      current = block;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function formatStandupMessage(
  tasks: StandupTask[],
  now: Date,
  options: StandupFormatOptions = {}
): string[] {
  const maxLen = options.maxChunkLen ?? DEFAULT_MAX_CHUNK_LEN;
  const dateLabel = format(now, 'EEE, MMM d yyyy');

  if (tasks.length === 0) {
    return [
      `✅ <b>Daily Standup — ${dateLabel}</b>\nSáng nay không có task nào đang In Progress — chúc team ngày mới! 🚀`,
    ];
  }

  const header = `🌅 <b>Daily Standup — ${dateLabel}</b>\nTasks đang In Progress: ${tasks.length}`;
  const groups = groupTasks(tasks);
  const blocks = groups.map((g) => renderGroupBlock(g, now));
  return packBlocksIntoChunks(header, blocks, maxLen);
}
