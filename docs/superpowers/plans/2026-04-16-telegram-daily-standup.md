# Telegram Daily Standup Bot — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi ngày 08:30 (Asia/Ho_Chi_Minh), hệ thống tự động đăng vào 1 Telegram group chung 1 bản tin liệt kê tất cả task đang `in_progress`, nhóm theo người assign.

**Architecture:** Cron job chạy trên host Docker gọi `GET /api/cron/telegram-daily-standup` (auth bằng `CRON_SECRET`). Handler query DB → format HTML chunks → gọi Telegram Bot API outbound. Không chạm chat nội bộ, không realtime, chỉ 1 chiều outbound.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM (Postgres), Vitest (thêm mới), Telegram Bot API v7 (HTTP), native `fetch`, `date-fns` (đã có).

**Spec reference:** [docs/superpowers/specs/2026-04-16-telegram-daily-standup-design.md](../specs/2026-04-16-telegram-daily-standup-design.md)

**Tier:** 2 (GUARDED) — thêm ENV vars + cron endpoint mới. Không đụng schema DB, không đụng Frozen zone.

---

## File Structure

**Tạo mới:**
| File | Trách nhiệm | Test |
|------|-------------|------|
| `src/lib/telegram.ts` | Low-level Telegram Bot API client (sendMessage, chunking) | `src/lib/__tests__/telegram.test.ts` |
| `src/lib/telegram-standup.ts` | Pure format logic: tasks[] → HTML chunks | `src/lib/__tests__/telegram-standup.test.ts` |
| `src/app/api/cron/telegram-daily-standup/route.ts` | Cron handler: auth + query + format + send | (manual smoke test) |
| `vitest.config.ts` | Test runner config | n/a |

**Sửa:**
| File | Thay đổi |
|------|----------|
| `package.json` | Thêm `vitest`, `@vitest/coverage-v8` devDeps + scripts `test`, `test:watch`, `test:coverage` |
| `.env.example` | Thêm 2 biến ENV mới |
| `README.md` | Thêm section setup Telegram |

**Out of scope toàn bộ plan:** Không đụng `src/mcp/**`, `src/app/api/mcp/**`, `drizzle/schema/**`, `src/server/**`, `src/components/**`, schema migrations, bất kỳ file UI nào.

---

## Pre-flight Checks (ngoài code)

Trước khi bắt đầu Task 1, engineer phải xác nhận (hoặc yêu cầu chairman làm):

- [ ] Bot đã được tạo qua [@BotFather](https://t.me/BotFather), có `TELEGRAM_BOT_TOKEN` (dạng `123456:ABC-DEF...`).
- [ ] Group Telegram "Libe AIOS — Daily Standup" đã tạo, bot đã được add vào group, có quyền gửi message.
- [ ] `TELEGRAM_CHAT_ID` (số âm dạng `-1001234567890`) đã có, lấy từ `https://api.telegram.org/bot<TOKEN>/getUpdates`.
- [ ] `CRON_SECRET` đã tồn tại trong `.env.local` prod (kế thừa từ deadline-warning cron).
- [ ] Host Docker có outbound port 443 tới `api.telegram.org` (99% là có).

Nếu thiếu bất kỳ mục nào → **dừng lại**, bao cáo chairman. Không tự tạo bot.

---

## Task 1: Setup Vitest test runner

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

**Why:** Project hiện chỉ có Playwright E2E, không có unit test runner. 2 file logic mới (`telegram-standup.ts`, `telegram.ts`) là pure functions cần unit test. Vitest zero runtime impact, chỉ devDependency.

**Scope:** `vitest.config.ts` + `package.json` scripts/devDeps.
**Out of scope:** Không sửa `playwright.config.ts`, không đụng test E2E hiện có.

- [ ] **Step 1: Install Vitest devDependencies**

Run:
```bash
cd "/Users/phuonghv/PhuongHV/AI Together/libe-aios"
npm install --save-dev vitest@^2.1.0 @vitest/coverage-v8@^2.1.0
```
Expected: Added to `devDependencies`, `package-lock.json` updated.

- [ ] **Step 2: Add test scripts to package.json**

Edit `package.json`, thêm vào block `"scripts"`:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "mcp": "tsx src/mcp/server.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 3: Create vitest.config.ts**

Tạo `vitest.config.ts` ở root:
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/telegram*.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@drizzle': path.resolve(__dirname, './drizzle'),
    },
  },
});
```

- [ ] **Step 4: Verify test runner works (no tests yet)**

Run:
```bash
npm run test
```
Expected: Vitest starts, reports "No test files found" (exit code 0 or 1, both OK at this stage — we just verify binary works).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add Vitest for unit testing

Required for telegram-standup and telegram lib tests. Coverage
threshold scoped to telegram*.ts files only to avoid blocking on
legacy untested code."
```

---

## Task 2: Type definitions for standup

**Files:**
- Create: `src/lib/telegram-standup.ts` (types section only, no logic yet)

**Why:** Define types first so Task 3 (tests) và Task 4 (impl) dùng chung contract.

**Scope:** Chỉ exported types + empty function stub.
**Out of scope:** Logic format thực tế (Task 4).

- [ ] **Step 1: Create file with type definitions**

Tạo `src/lib/telegram-standup.ts`:
```typescript
export interface StandupTask {
  id: string;
  title: string;
  deadline: Date | null;
  assignee: { id: string; name: string } | null;
}

export interface StandupFormatOptions {
  maxChunkLen?: number;
}

/**
 * Format tasks vào HTML chunks sẵn sàng gửi Telegram.
 * Pure function — không side effect, test được 100%.
 *
 * @param tasks Danh sách task đang in_progress
 * @param now Thời điểm "hôm nay" (inject để test được)
 * @param options Tuỳ chọn (maxChunkLen default 4000)
 * @returns Mảng HTML strings, mỗi phần tử ≤ maxChunkLen ký tự
 */
export function formatStandupMessage(
  tasks: StandupTask[],
  now: Date,
  options: StandupFormatOptions = {}
): string[] {
  throw new Error('not implemented');
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/telegram-standup.ts
git commit -m "feat(telegram): add StandupTask types and format signature"
```

---

## Task 3: Tests for formatStandupMessage (TDD — RED)

**Files:**
- Create: `src/lib/__tests__/telegram-standup.test.ts`

**Why:** TDD. Viết test trước, verify fail, rồi implement ở Task 4.

**Scope:** Unit tests cho `formatStandupMessage` cover 8 scenarios.
**Out of scope:** Test `splitIntoChunks` (Task 6), test `sendTelegramMessage` (Task 8).

- [ ] **Step 1: Create test file with all scenarios**

Tạo `src/lib/__tests__/telegram-standup.test.ts`:
```typescript
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
});
```

- [ ] **Step 2: Run tests — expect RED**

Run:
```bash
npm run test -- telegram-standup
```
Expected: All 8 tests FAIL with `Error: not implemented`.

- [ ] **Step 3: Commit (red phase)**

```bash
git add src/lib/__tests__/telegram-standup.test.ts
git commit -m "test(telegram): add failing tests for formatStandupMessage (red)"
```

---

## Task 4: Implement formatStandupMessage (TDD — GREEN)

**Files:**
- Modify: `src/lib/telegram-standup.ts`

**Why:** Make Task 3 tests pass.

**Scope:** Implementation của `formatStandupMessage`, helper nội bộ `renderAssigneeBlock`, `renderTaskLine`, `splitByBlocks`.
**Out of scope:** `splitIntoChunks` export từ `telegram.ts` (Task 5 dùng lại hoặc inline).

- [ ] **Step 1: Replace stub with full implementation**

Thay toàn bộ nội dung `src/lib/telegram-standup.ts`:
```typescript
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
```

- [ ] **Step 2: Run tests — expect GREEN**

Run:
```bash
npm run test -- telegram-standup
```
Expected: All 8 tests PASS.

- [ ] **Step 3: Check coverage**

Run:
```bash
npm run test:coverage -- telegram-standup
```
Expected: `telegram-standup.ts` coverage ≥80% on all metrics.

- [ ] **Step 4: Type check**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 5: Commit (green phase)**

```bash
git add src/lib/telegram-standup.ts
git commit -m "feat(telegram): implement formatStandupMessage (green)

Groups tasks by assignee A-Z, puts unassigned last, escapes HTML,
flags overdue tasks, and packs output into chunks <= maxChunkLen
without breaking block boundaries."
```

---

## Task 5: Tests for Telegram client (TDD — RED)

**Files:**
- Create: `src/lib/__tests__/telegram.test.ts`

**Why:** TDD for low-level API wrapper. Mock `fetch` — không gọi Telegram thật.

**Scope:** Tests cho `sendTelegramMessage` (happy path, 4xx, 429 retry, missing env).
**Out of scope:** Implementation (Task 6).

- [ ] **Step 1: Create test file**

Tạo `src/lib/__tests__/telegram.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { sendTelegramMessage } from '../telegram';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.TELEGRAM_BOT_TOKEN = 'TEST:TOKEN';
  process.env.TELEGRAM_CHAT_ID = '-1001234567890';
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('sendTelegramMessage', () => {
  it('POSTs to Telegram API with correct body', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await sendTelegramMessage('<b>hello</b>');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.telegram.org/botTEST:TOKEN/sendMessage');
    expect(init?.method).toBe('POST');
    const body = JSON.parse(init?.body as string);
    expect(body).toMatchObject({
      chat_id: '-1001234567890',
      text: '<b>hello</b>',
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  });

  it('throws when TELEGRAM_BOT_TOKEN is missing', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    await expect(sendTelegramMessage('x')).rejects.toThrow(/TELEGRAM_BOT_TOKEN/);
  });

  it('throws when TELEGRAM_CHAT_ID is missing', async () => {
    delete process.env.TELEGRAM_CHAT_ID;
    await expect(sendTelegramMessage('x')).rejects.toThrow(/TELEGRAM_CHAT_ID/);
  });

  it('throws on 4xx response with status + body in message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: false, description: 'Bad Request: entity too large' }), {
        status: 400,
      })
    );
    await expect(sendTelegramMessage('x')).rejects.toThrow(/400.*Bad Request/);
  });

  it('retries once on 429 using retry_after header', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, parameters: { retry_after: 1 } }), { status: 429 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await sendTelegramMessage('x');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws if 429 retry also fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: false, parameters: { retry_after: 0 } }), { status: 429 })
    );
    await expect(sendTelegramMessage('x')).rejects.toThrow(/429/);
  });
});
```

- [ ] **Step 2: Run tests — expect RED (file chưa tồn tại)**

Run:
```bash
npm run test -- telegram.test
```
Expected: FAIL with module not found or all tests fail.

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/telegram.test.ts
git commit -m "test(telegram): add failing tests for sendTelegramMessage (red)"
```

---

## Task 6: Implement Telegram client (TDD — GREEN)

**Files:**
- Create: `src/lib/telegram.ts`

**Why:** Pass Task 5 tests.

**Scope:** `sendTelegramMessage` với retry 429 1 lần, validation ENV vars.
**Out of scope:** Queue/batch sender, webhook handler.

- [ ] **Step 1: Create file**

Tạo `src/lib/telegram.ts`:
```typescript
const TELEGRAM_API_BASE = 'https://api.telegram.org';

interface TelegramResponse {
  ok: boolean;
  description?: string;
  parameters?: { retry_after?: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: any;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gửi 1 message vào Telegram group cấu hình qua ENV.
 * Tự động retry 1 lần khi gặp 429 rate limit (respect retry_after).
 *
 * @throws Error khi thiếu ENV, API trả lỗi, hoặc retry thất bại.
 */
export async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not configured');
  if (!chatId) throw new Error('TELEGRAM_CHAT_ID not configured');

  const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;
  const body = JSON.stringify({
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });

  const doFetch = () =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

  let response = await doFetch();

  if (response.status === 429) {
    const json = (await response.clone().json().catch(() => ({}))) as TelegramResponse;
    const retryAfter = json.parameters?.retry_after ?? 1;
    await sleep(Math.max(retryAfter, 1) * 1000);
    response = await doFetch();
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Telegram API ${response.status}: ${text.slice(0, 500)}`);
  }
}
```

- [ ] **Step 2: Run tests — expect GREEN**

Run:
```bash
npm run test -- telegram.test
```
Expected: All 6 tests PASS.

- [ ] **Step 3: Check coverage**

Run:
```bash
npm run test:coverage -- telegram.test
```
Expected: `telegram.ts` coverage ≥80%.

- [ ] **Step 4: Type check**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/telegram.ts
git commit -m "feat(telegram): implement sendTelegramMessage client

HTML parse_mode, retries once on 429 with retry_after, throws with
status + body on other 4xx/5xx."
```

---

## Task 7: Cron handler route

**Files:**
- Create: `src/app/api/cron/telegram-daily-standup/route.ts`

**Why:** Endpoint crontab gọi tới mỗi 08:30 VN.

**Scope:** Auth + query `tasks` (in_progress) + gọi format + loop send.
**Out of scope:** Test E2E endpoint (manual smoke test sẽ làm ở Task 10).

**Reference pattern:** `src/app/api/cron/deadline-warning/route.ts` — copy auth logic y hệt.

- [ ] **Step 1: Create route handler**

Tạo `src/app/api/cron/telegram-daily-standup/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { tasks } from '@drizzle/schema/tasks';
import { eq } from 'drizzle-orm';
import { formatStandupMessage, type StandupTask } from '@/lib/telegram-standup';
import { sendTelegramMessage } from '@/lib/telegram';

export async function GET(req: Request) {
  // Auth (pattern y hệt /api/cron/deadline-warning)
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[Cron] CRON_SECRET not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${cronSecret}`;
  const { timingSafeEqual } = await import('crypto');
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Query tasks in_progress với assignee info
  const rows = await db.query.tasks.findMany({
    where: eq(tasks.status, 'in_progress'),
    columns: { id: true, title: true, deadline: true, assigneeId: true },
    with: {
      assignee: { columns: { id: true, name: true } },
    },
  });

  const standupTasks: StandupTask[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    deadline: r.deadline,
    assignee: r.assignee ? { id: r.assignee.id, name: r.assignee.name ?? '(Unknown)' } : null,
  }));

  const chunks = formatStandupMessage(standupTasks, new Date());

  // Best-effort send. Failure 1 chunk không block chunks khác.
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    try {
      if (i > 0 && chunks.length > 5) {
        // Rate-limit guard khi >5 chunks
        await new Promise((r) => setTimeout(r, 1100));
      }
      await sendTelegramMessage(chunks[i]);
      sent++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`chunk ${i}: ${msg}`);
      console.error(`[Cron/telegram-daily-standup] Chunk ${i} failed:`, msg);
    }
  }

  return NextResponse.json({
    success: failed === 0,
    totalTasks: standupTasks.length,
    chunksTotal: chunks.length,
    chunksSent: sent,
    chunksFailed: failed,
    errors: errors.length > 0 ? errors : undefined,
  });
}
```

- [ ] **Step 2: Verify assignee relation exists**

Check that `drizzle/schema/relations.ts` defines `tasks.assignee` relation (the existing query pattern in `/api/mcp/route.ts` at `case "get_tasks"` uses `with: { assignee: ... }`, confirming it works).

Run:
```bash
npx tsc --noEmit
```
Expected: No errors. If fails with relation not defined, open `drizzle/schema/relations.ts` và confirm pattern; do NOT modify schema in this plan (that'd be Tier 3).

- [ ] **Step 3: Build to catch Next.js route errors**

Run:
```bash
npm run build
```
Expected: Build succeeds, new route `/api/cron/telegram-daily-standup` appears in output list.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/telegram-daily-standup/route.ts
git commit -m "feat(cron): add telegram-daily-standup endpoint

GET handler protected by CRON_SECRET bearer. Queries in_progress tasks,
formats into HTML chunks, sends via Telegram Bot API. Best-effort
send: failed chunk doesn't block remaining."
```

---

## Task 8: Update .env.example

**Files:**
- Modify: `.env.example`

**Why:** New deploy người dev biết cần config gì.

**Scope:** Thêm 2 dòng ENV.
**Out of scope:** `.env.local` prod (chairman set trực tiếp, không commit).

- [ ] **Step 1: Read current .env.example**

Read `.env.example` để biết format và vị trí thêm.

- [ ] **Step 2: Append Telegram section**

Thêm vào cuối file `.env.example`:
```
# Telegram Daily Standup Bot (src/app/api/cron/telegram-daily-standup)
# - TOKEN: từ @BotFather khi tạo bot
# - CHAT_ID: id của group (số âm, lấy từ /getUpdates)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: document Telegram env vars in .env.example"
```

---

## Task 9: Update README

**Files:**
- Modify: `README.md`

**Why:** Hướng dẫn ops / dev khác biết cách setup.

**Scope:** Thêm 1 section mới.
**Out of scope:** Restructure README tổng, sửa các section khác.

- [ ] **Step 1: Read current README**

Read `README.md` để biết section layout.

- [ ] **Step 2: Append section**

Thêm vào cuối `README.md`:
```markdown
## Telegram Daily Standup Bot

Mỗi ngày 08:30 (Asia/Ho_Chi_Minh), hệ thống đăng bản tin liệt kê task `in_progress` vào 1 group Telegram chung.

### Setup

1. **Tạo bot Telegram**: nhắn [@BotFather](https://t.me/BotFather) → `/newbot` → nhận `TELEGRAM_BOT_TOKEN`.
2. **Tạo group**: tạo group "Libe AIOS — Daily Standup", add bot vào, cấp quyền gửi message.
3. **Lấy chat_id**: gửi 1 message bất kỳ trong group → truy cập `https://api.telegram.org/bot<TOKEN>/getUpdates` → copy `"chat":{"id":-100...}` (số âm).
4. **Set ENV** trong `.env.local`:
   ```
   TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
   TELEGRAM_CHAT_ID=-1001234567890
   ```
5. **Restart app** để load ENV.

### Cron

Trên host Docker, thêm vào crontab (`crontab -e`):

```cron
# 08:30 Asia/Ho_Chi_Minh = 01:30 UTC
30 1 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/telegram-daily-standup >> /var/log/libe-aios-cron.log 2>&1
```

- Đổi port `3000` theo `docker-compose.prod.yml` thực tế.
- `CRON_SECRET` phải có trong env của user chạy crontab.
- **Không** gọi qua public HTTP URL — Bearer token sẽ đi plaintext.

### Manual smoke test

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/telegram-daily-standup
```
Kiểm tra group Telegram nhận được message. Response JSON:
```json
{ "success": true, "totalTasks": 7, "chunksTotal": 1, "chunksSent": 1, "chunksFailed": 0 }
```
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add Telegram daily standup setup to README"
```

---

## Task 10: Final verification & manual smoke test

**Files:** None (verification only)

**Why:** Pre-commit validation theo Liberico R9: import check, syntax check, test pass. Plus manual smoke test per spec section 8.3.

**Scope:** Chạy full checks, không sửa code.
**Out of scope:** Nếu phát hiện bug → tạo task fix riêng, không sửa tại đây.

- [ ] **Step 1: Full test suite**

Run:
```bash
npm run test:coverage
```
Expected:
- `formatStandupMessage`: 8/8 tests PASS.
- `sendTelegramMessage`: 6/6 tests PASS.
- Coverage ≥80% cho `src/lib/telegram-standup.ts` và `src/lib/telegram.ts`.

- [ ] **Step 2: Type check**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Lint**

Run:
```bash
npm run lint
```
Expected: No errors in new files (warnings về file khác OK, ngoài scope).

- [ ] **Step 4: Build**

Run:
```bash
npm run build
```
Expected: Build succeeds. Output list bao gồm `ƒ /api/cron/telegram-daily-standup`.

- [ ] **Step 5: Manual smoke test — local / staging**

Prerequisite: ENV vars `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` đã set trỏ vào **sandbox group** (không phải prod group). `CRON_SECRET` có sẵn.

Run local server:
```bash
npm run dev
```

Trong terminal khác, test 5 scenarios:

**5.1 — Auth fail**
```bash
curl -i http://localhost:3000/api/cron/telegram-daily-standup
```
Expected: `401 Unauthorized`.

**5.2 — Auth fail với token sai**
```bash
curl -i -H "Authorization: Bearer wrong" http://localhost:3000/api/cron/telegram-daily-standup
```
Expected: `401 Unauthorized`.

**5.3 — Happy path có task**
Đảm bảo DB có ít nhất 1 task `status = 'in_progress'`. Sau đó:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/telegram-daily-standup
```
Expected: Response `{ success: true, totalTasks: N > 0, chunksSent: ≥1 }`. Group Telegram nhận được message đúng format section 6.1 của spec.

**5.4 — Empty state**
Tạm update tất cả task in_progress sang status khác (hoặc test trên env trống):
```sql
UPDATE tasks SET status = 'planned' WHERE status = 'in_progress';
```
Gọi lại:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/telegram-daily-standup
```
Expected: Response `{ success: true, totalTasks: 0, chunksSent: 1 }`. Group nhận message "✅ Sáng nay không có task nào…". Sau đó **restore** status về cũ.

**5.5 — HTML escape**
Tạo 1 task với title `<script>alert(1)</script>`, status `in_progress`. Gọi endpoint. Kiểm tra message Telegram hiển thị literal `<script>...</script>` (escaped), không render JS/HTML.

- [ ] **Step 6: Final commit (if README touch-ups needed)**

Nếu manual test phát hiện issue nhỏ trong README (format, typo) → fix và commit:
```bash
git add README.md
git commit -m "docs: fix typo in telegram standup section"
```

- [ ] **Step 7: Deploy checklist (chairman / ops)**

Handover cho người deploy:

1. Merge PR lên `main`.
2. Set `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` trong `.env.local` prod (không commit).
3. Restart Docker: `docker-compose -f docker-compose.prod.yml restart`.
4. Chạy smoke test 5.3 trực tiếp prod (vào group thật).
5. Thêm crontab entry trên host (README section Cron).
6. Theo dõi log `/var/log/libe-aios-cron.log` sau 08:30 hôm sau.
7. Monitor 3 ngày, close phase 1.

---

## Acceptance Checklist (copy từ spec section 10)

- [ ] Cron chạy tự động 08:30 VN mỗi ngày (verify sau khi ops add crontab).
- [ ] Group Telegram nhận được message đúng format section 6 của spec.
- [ ] Task `in_progress` đều liệt kê, không thiếu, không trùng.
- [ ] Quá hạn có flag ⚠️.
- [ ] Message dài > 4000 ký tự được cắt thành nhiều tin nhắn liên tiếp, không vỡ HTML.
- [ ] Vitest đã setup; unit tests pass; coverage ≥80% cho `telegram-standup.ts` và `telegram.ts`.
- [ ] `CRON_SECRET` bearer auth hoạt động; gọi thiếu token → 401.
- [ ] Manual smoke test (Task 10 Step 5) pass, bao gồm escape HTML với title chứa `<script>`.
- [ ] `.env.example` có 2 biến mới; README có hướng dẫn setup.

---

## Post-Implementation — Tạo TCR

Theo Liberico framework, sau khi hoàn thành Tier 2 task → tạo TCR tại `docs/tcr/telegram/TCR-001-daily-standup.md` và link trong `docs/tcr/_index.md`. Nội dung tối thiểu:

- Đã làm gì (3-5 dòng).
- Quyết định quan trọng (tham chiếu spec section 11 D1–D7).
- Files thay đổi (từ plan File Structure).
- Contract thay đổi: KHÔNG (phase 1 không đụng contract).
- Tests: 14 unit tests added, coverage ≥80%.
- Còn dở: Phase 2 (bot commands) — ghi trong spec section 1.3.
- Phiên sau cần biết: ENV vars bắt buộc; crontab trên host; không gọi qua public HTTP.
