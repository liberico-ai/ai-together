# Telegram Daily Standup Bot — Design Spec

**Date:** 2026-04-16
**Author:** Brainstorm với Phương (chairman)
**Status:** Design approved, chờ chuyển `writing-plans`
**Tier:** Tier 2 (GUARDED) — thêm cron job mới + thêm ENV vars + gọi external API
**Phase:** 1 / N (1-chiều outbound only; 2-chiều bot commands là phase sau)

---

## 1. Mục tiêu & Scope

### 1.1 Mục tiêu
Mỗi ngày 08:30 (Asia/Ho_Chi_Minh), hệ thống **tự động đăng** vào 1 group Telegram chung 1 bản tin liệt kê tất cả task đang ở trạng thái `in_progress`, nhóm theo người assign, để cả team nắm được ai đang làm gì.

### 1.2 In scope (Phase 1)
- Outbound 1 chiều: app → Telegram Bot API → group Telegram.
- 1 bot duy nhất, 1 group duy nhất, cấu hình qua ENV vars.
- Cron chạy mỗi ngày 7/7, không phân biệt cuối tuần.
- Filter: **tất cả** task có `status = 'in_progress'` bất kể project status.
- Message format HTML, cắt chunk khi vượt 4000 ký tự.

### 1.3 Out of scope (ghi nhận cho Phase 2+)
- Bot commands inbound (`/mytasks`, `/done` …).
- Identity mapping giữa user libe-aios và Telegram user.
- Per-user DM notifications.
- Per-project group Telegram riêng.
- Event-driven realtime notifications (khi task chuyển status).
- Webhook public URL (HTTPS) hoặc long-polling worker — Phase 2 mới cần.

---

## 2. Prerequisites — Điều kiện PHẢI chuẩn bị trước khi code

| # | Việc | Ghi chú |
|---|------|---------|
| 2.1 | Tạo bot qua [@BotFather](https://t.me/BotFather) | `/newbot` → nhận `TELEGRAM_BOT_TOKEN` dạng `123456:ABC-DEF...` |
| 2.2 | Tạo Telegram group "Libe AIOS — Daily Standup" | Add bot vừa tạo, cấp quyền gửi message (default đã có) |
| 2.3 | Lấy `chat_id` của group | Gửi 1 message bất kỳ → truy cập `https://api.telegram.org/bot<TOKEN>/getUpdates` → tìm `"chat":{"id":-100xxxxxxxxx}`. Group luôn có id âm, ví dụ `-1001234567890` |
| 2.4 | Server có outbound HTTPS tới `api.telegram.org` (port 443) | 99% env có sẵn; chỉ cần check nếu firewall strict |
| 2.5 | Crontab và app chạy **cùng host** | Gọi qua `http://localhost:<PORT>` để tránh Bearer token plaintext trên internet |
| 2.6 | Quyền sửa crontab của user chạy Docker host | `crontab -e` |

### 2.7 Về HTTPS — Phase 1 KHÔNG cần
- Bot API của Telegram (api.telegram.org) là HTTPS → app gọi ra HTTPS bình thường bất kể app serve HTTP hay HTTPS.
- Crontab gọi inbound qua `localhost` → không rời máy, không cần HTTPS.
- **Cảnh báo**: tuyệt đối **không** dùng URL public HTTP (ví dụ `http://libe-aios.com/api/cron/...`) vì `CRON_SECRET` Bearer token sẽ đi plaintext qua internet.

---

## 3. Architecture & data flow

```
┌─────────────────┐   08:30 UTC+7    ┌─────────────────────────────────────────┐
│ host crontab    │ ──── curl ─────▶ │ GET /api/cron/telegram-daily-standup    │
│ (linux system)  │   Bearer CRON_   │                                         │
└─────────────────┘   SECRET         │  1. Verify CRON_SECRET (timingSafeEqual)│
                                     │  2. Query tasks status='in_progress'    │
                                     │     JOIN users(name), projects(title)   │
                                     │  3. Group by assignee + format HTML     │
                                     │  4. Split into chunks ≤4000 chars       │
                                     │  5. For each chunk:                     │
                                     │     POST api.telegram.org/bot<T>/sendMessage
                                     └────────────┬────────────────────────────┘
                                                  │ HTTPS POST (outbound)
                                                  ▼
                                      ┌──────────────────────────┐
                                      │ Telegram Bot API          │
                                      └────────────┬─────────────┘
                                                   │
                                                   ▼
                                          Telegram group chat
```

**Không chạm** các bảng chat nội bộ (`conversations`, `messages`), **không** emit SSE, **không** tạo row trong `notifications`. Feature này độc lập hoàn toàn với kênh chat hiện có.

---

## 4. Files — Thêm mới và sửa

### 4.1 Tạo mới

**`src/lib/telegram.ts`** — Low-level Telegram client wrapper
- `sendTelegramMessage(text: string): Promise<void>`
  - POST `https://api.telegram.org/bot${TOKEN}/sendMessage`
  - body: `{ chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true }`
  - Throw `Error` với status + body khi API trả 4xx/5xx.
- `splitIntoChunks(text: string, maxLen = 4000): string[]`
  - Cắt theo ranh giới **block task** (sau mỗi dòng trống `\n\n`). Vì ranh giới khối không bao giờ rơi vào giữa thẻ HTML inline (`<b>...</b>` luôn gói trong 1 dòng), cách này đảm bảo không vỡ HTML.
  - Fallback: nếu 1 block đơn lẻ vượt `maxLen` (hiếm khi xảy ra, chỉ khi title siêu dài) → cắt theo `\n`, với ghi chú ở cuối chunk `... (tiếp ở tin sau)`.
- Tận dụng `escapeHtml` từ `src/lib/escape-html.ts` đã có (check signature trước khi dùng).

**`src/lib/telegram-standup.ts`** — Pure format logic (unit-testable)
- `formatStandupMessage(tasks: TaskWithAssignee[], now: Date): string[]`
  - Input: array task với nested `assignee` (name) và `project` (title).
  - Output: mảng HTML chunks đã sẵn sàng gửi.
  - Xử lý các edge case ở section 6.

**`src/app/api/cron/telegram-daily-standup/route.ts`** — Cron handler
- `GET(req: Request)` — copy nguyên pattern auth từ `/api/cron/deadline-warning/route.ts`.
- Query tasks với Drizzle `db.query.tasks.findMany({ where: eq(tasks.status, 'in_progress'), with: { assignee: {...}, project: {...} } })`.
- Gọi `formatStandupMessage` → loop chunks → `sendTelegramMessage`.
- Best-effort: 1 chunk fail vẫn thử các chunk còn lại.
- Response JSON: `{ success, totalTasks, chunksSent, chunksFailed, errors?: string[] }`.

### 4.2 Sửa

**`.env.example`** — Thêm 2 biến:
```
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

**`README.md`** — Thêm section "Telegram Daily Standup" mô tả prereq 2.1–2.3 và crontab entry.

### 4.3 Test

**`src/lib/__tests__/telegram-standup.test.ts`** (hoặc vị trí test đang dùng trong repo):
- Test `formatStandupMessage` với: 0 tasks, nhiều task 1 assignee, nhiều assignee, task không assignee, task không deadline, task quá hạn, title chứa HTML.
- Test `splitIntoChunks`: input ngắn → 1 chunk; input dài → nhiều chunk, không cắt giữa dòng.

**Không test E2E tới Telegram API thật** — mock `fetch` trong test của handler route.

---

## 5. Config & Crontab

### 5.1 ENV vars (add vào `.env.local` prod)
```env
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234567890abcdef...
TELEGRAM_CHAT_ID=-1001234567890
# CRON_SECRET đã có sẵn từ deadline-warning, dùng lại
```

### 5.2 Crontab entry (trên Docker host)
```cron
# Libe AIOS — Daily standup bot, 08:30 Asia/Ho_Chi_Minh = 01:30 UTC
30 1 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/telegram-daily-standup >> /var/log/libe-aios-cron.log 2>&1
```
- `30 1 * * *` UTC = **08:30 Asia/Ho_Chi_Minh** (UTC+7).
- Dùng UTC trong crontab để không phụ thuộc timezone host.
- `CRON_SECRET` phải có trong env của user chạy crontab (vd export trong `~/.bashrc` hoặc file `/etc/environment`).
- Port `3000` điều chỉnh theo `docker-compose.prod.yml` / Nginx config thực tế.

---

## 6. Message format — Ví dụ output

### 6.1 Có task
```
🌅 <b>Daily Standup — Thu, Apr 16 2026</b>
Tasks đang In Progress: 7

👤 <b>Nguyễn Văn Nam</b> (3)
• TASK-042 — Refactor auth module
  ⏰ Deadline: 2026-04-18
• TASK-055 — Fix dashboard SSE
  ⚠️ Quá hạn 2 ngày (2026-04-14)
• TASK-061 — Write e2e tests
  (không có deadline)

👤 <b>Trần Linh</b> (2)
• TASK-049 — Design new leaderboard
  ⏰ Deadline: 2026-04-20
• TASK-052 — Update docs
  (không có deadline)

👻 <b>Chưa assign</b> (2)
• TASK-070 — Setup CI
  ⏰ Deadline: 2026-04-22
• TASK-071 — ...
```

### 6.2 Không có task
```
✅ <b>Daily Standup — Thu, Apr 16 2026</b>
Sáng nay không có task nào đang In Progress — chúc team ngày mới! 🚀
```

### 6.3 Quy tắc render
| Field | Rule |
|-------|------|
| Header ngày | Format `EEE, MMM d yyyy` locale `en-US` (giữ ngắn, dễ đọc) |
| Assignee block | `👤 <b>{name}</b> ({count})` — sort theo tên A→Z |
| Task line | `• {taskId} — {escapedTitle}` |
| Deadline future | `⏰ Deadline: {YYYY-MM-DD}` |
| Deadline quá hạn | `⚠️ Quá hạn {N} ngày ({YYYY-MM-DD})` — N tính theo ngày, làm tròn xuống |
| Không deadline | `(không có deadline)` |
| Task không assignee | Group cuối cùng với header `👻 <b>Chưa assign</b>` |
| Escape | Title, assignee name đều chạy qua `escapeHtml` |

---

## 7. Error handling & edge cases

| Tình huống | Xử lý |
|------------|-------|
| `TELEGRAM_BOT_TOKEN` hoặc `TELEGRAM_CHAT_ID` thiếu | `console.error` + return 500 (pattern y `deadline-warning`) |
| `CRON_SECRET` mismatch | Return 401 (đã có sẵn) |
| Telegram API 4xx (vd 400 Bad Request do HTML sai) | Log status + body, tăng `chunksFailed`, thử chunk tiếp theo |
| Telegram API 429 (rate limit) | Đọc `retry_after` → `await sleep(retry_after * 1000)` → retry 1 lần chunk đó |
| DB query throw | Bubble lên try/catch top-level → return 500 |
| Nhiều hơn 5 chunk | `await sleep(1100)` giữa mỗi lần gửi để né rate limit (30 msg/sec hard cap) |
| Task title chứa `< > &` | `escapeHtml` bắt buộc trước khi chèn vào HTML |
| Assignee bị soft-delete / null name | Fallback `"(Unknown)"` |

---

## 8. Testing & validation

### 8.0 Hiện trạng test infra
- Project chưa có unit test runner (`package.json` chỉ có `test:e2e` Playwright).
- **Quyết định**: Setup **Vitest** như một phần của công việc này (zero runtime impact, chỉ thêm devDependency). Lý do: `formatStandupMessage` và `splitIntoChunks` là pure functions, test bằng Playwright là lãng phí và bất tiện.
- Config Vitest tối thiểu: thêm `vitest` + `@vitest/coverage-v8` vào devDependencies, thêm script `"test": "vitest run"` và `"test:watch": "vitest"`, tạo `vitest.config.ts` với path alias khớp `tsconfig.json`.

### 8.1 Unit tests (bắt buộc ≥80% coverage cho 2 file logic mới)
- `formatStandupMessage`: các scenario ở section 6 (0 tasks, 1 assignee, nhiều assignee, quá hạn, không deadline, title có HTML, task không assignee).
- `splitIntoChunks`: boundary testing (empty, ngắn hơn maxLen, đúng maxLen, nhiều blocks, 1 block vượt maxLen).
- File vị trí: `src/lib/__tests__/telegram-standup.test.ts` + `src/lib/__tests__/telegram.test.ts`.

### 8.2 Integration test — OPTIONAL cho phase 1
- Nếu thời gian cho phép: mock `fetch` trong handler route test, verify auth fail → 401, số lần gọi `sendTelegramMessage` = số chunk, 1 chunk fail không làm fail cả batch.
- Nếu không: manual smoke test (8.3) là đủ cho MVP.

### 8.3 Manual smoke test trước deploy (bắt buộc)
1. Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` trỏ vào 1 group sandbox cá nhân.
2. Gọi tay: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/telegram-daily-standup`
3. Kiểm tra message xuất hiện trong group, format đúng.
4. Tạo task có title chứa `<script>` để verify escape HTML.
5. Xoá/đổi status để còn 0 task → gọi lại → kiểm tra message "không có task".

---

## 9. Rollout plan

1. Merge code → deploy lên prod.
2. Set ENV vars `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` trong `.env.local` của prod → restart Docker.
3. Manual smoke test (8.3).
4. Add crontab entry trên host, verify log sau 1 chu kỳ (hôm sau 08:30).
5. Theo dõi 3 ngày, confirm ổn.
6. Close phase 1.

## 10. Acceptance criteria

- [ ] Cron chạy tự động 08:30 VN mỗi ngày.
- [ ] Group Telegram nhận được message đúng format ở section 6.
- [ ] Task `in_progress` đều liệt kê, không thiếu, không trùng.
- [ ] Quá hạn có flag ⚠️.
- [ ] Message dài > 4000 ký tự được cắt thành nhiều tin nhắn liên tiếp, không vỡ HTML.
- [ ] Vitest đã setup; unit tests pass; coverage ≥80% cho `telegram-standup.ts` và `telegram.ts`.
- [ ] `CRON_SECRET` bearer auth hoạt động; gọi thiếu token → 401.
- [ ] Manual smoke test (8.3) pass, bao gồm escape HTML với title chứa `<script>`.
- [ ] `.env.example` có 2 biến mới; README có hướng dẫn setup.

## 11. Quyết định kỹ thuật đã chốt

| # | Quyết định | Alternative đã cân nhắc | Lý do chọn |
|---|------------|------------------------|------------|
| D1 | 1 group Telegram duy nhất | Per-project group / DM cá nhân | MVP đơn giản, đáp ứng đủ nhu cầu "mọi người nắm được" |
| D2 | Chỉ outbound, không commands | A+B (outbound + bot commands) | User chốt phase 1 chỉ cần nhắc, không cần tương tác |
| D3 | Config ENV vars | DB `app_config` table | 1 group hiếm đổi, ENV zero code overhead |
| D4 | System crontab + curl localhost | Vercel Cron / External service / BullMQ | Project dùng Docker không Vercel; pattern đã có ở `deadline-warning` |
| D5 | Parse mode HTML | MarkdownV2 / plain text | MarkdownV2 escape nhiều ký tự phức tạp; HTML chỉ cần escape 3 ký tự |
| D6 | Cắt chunk thay vì rút gọn | Giới hạn top N tasks | Giữ thông tin đầy đủ, user muốn thấy hết |
| D7 | Phase 1 HTTP OK, localhost only | Bắt buộc HTTPS ngay | Outbound Telegram API vẫn HTTPS; inbound crontab local → không cần HTTPS |

---

## 12. References

- Pattern cron hiện có: `src/app/api/cron/deadline-warning/route.ts`
- Escape HTML helper: `src/lib/escape-html.ts`
- Schema tasks: `drizzle/schema/tasks.ts` (status enum có giá trị `'in_progress'`)
- Telegram Bot API docs: https://core.telegram.org/bots/api#sendmessage
- Telegram rate limits: https://core.telegram.org/bots/faq#my-bot-is-hitting-limits-how-do-i-avoid-this
