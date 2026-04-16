# TCR — Telegram Daily Standup Bot (Phase 1)
Date: 2026-04-16
Tier: 2 (GUARDED — thêm ENV vars + cron endpoint + devDependencies)
Branch: main
Agent: Claude Opus 4.6 (subagent-driven-development)

## Đã làm gì (3-5 dòng)
- Thêm Vitest làm unit test runner (project trước đó chỉ có Playwright E2E). Coverage threshold scoped riêng cho `src/lib/telegram*.ts` để không block commit khác.
- Tạo `src/lib/telegram-standup.ts` (pure format logic) + `src/lib/telegram.ts` (Telegram Bot API client với retry 429). 15 unit tests, coverage 97-100% statements.
- Tạo cron endpoint `GET /api/cron/telegram-daily-standup` (auth Bearer `CRON_SECRET`, copy pattern từ `deadline-warning`). Query tasks `in_progress` (max 200), nhóm theo assignee, gửi HTML chunks qua Telegram.
- Cập nhật `.env.example` (2 biến mới) + `README.md` (setup guide + crontab entry).

## Files đã thay đổi
| File | Zone | Thay đổi |
|------|------|---------|
| `vitest.config.ts` | FLUID (NEW) | Config Vitest, node env, alias `@`/`@drizzle`, coverage scoped telegram*.ts |
| `package.json` | GUARDED | +devDeps `vitest@^2.1.9`, `@vitest/coverage-v8@^2.1.9`; +scripts `test`, `test:watch`, `test:coverage` |
| `src/lib/telegram.ts` | FLUID (NEW) | `sendTelegramMessage(text)` — POST Bot API, parse_mode HTML, retry 1x khi 429, throw với status+body khi 4xx/5xx |
| `src/lib/telegram-standup.ts` | FLUID (NEW) | `formatStandupMessage(tasks, now, opts?)` — pure function, nhóm theo assignee A→Z, unassigned cuối, escape HTML tại title/id/name, chunk theo ranh giới block |
| `src/lib/__tests__/telegram.test.ts` | FLUID (NEW) | 6 unit tests cho client (happy path, missing ENV ×2, 4xx, 429 retry success, 429 retry fail) |
| `src/lib/__tests__/telegram-standup.test.ts` | FLUID (NEW) | 9 unit tests cho format (empty, 1 task, overdue, no-deadline, group sort, unassigned group, HTML escape, chunking, line-fallback) |
| `src/app/api/cron/telegram-daily-standup/route.ts` | GUARDED (NEW) | Cron GET handler. Auth `CRON_SECRET` timingSafeEqual → DB try/catch → `formatStandupMessage` try/catch → loop send với rate-limit sleep 1.1s giữa các chunk |
| `.env.example` | GUARDED | Append section `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. **Lưu ý**: file này trước giờ không được git track (bị match bởi `.env*` trong `.gitignore`); commit này dùng `git add -f` |
| `README.md` | FLUID | Append section "Telegram Daily Standup Bot" với setup 5 bước + crontab entry + smoke test |
| `docs/superpowers/specs/2026-04-16-telegram-daily-standup-design.md` | FLUID (NEW) | Spec đã duyệt |
| `docs/superpowers/plans/2026-04-16-telegram-daily-standup.md` | FLUID (NEW) | Implementation plan (10 tasks) |

## Quyết định quan trọng (tham chiếu spec section 11)

| # | Quyết định | Alternative | Lý do |
|---|------------|-------------|-------|
| D1 | 1 group Telegram duy nhất | Per-project group / DM cá nhân | MVP phase 1, đủ cho "mọi người nắm được" |
| D2 | Chỉ outbound, không commands | A+B (bot commands) | User chốt phase 1 chỉ nhắc, không cần tương tác |
| D3 | Config ENV vars | DB `app_config` | 1 group hiếm đổi, zero code overhead |
| D4 | System crontab + curl localhost | Vercel Cron / external / BullMQ | Docker host; pattern có sẵn ở deadline-warning |
| D5 | Parse mode HTML | MarkdownV2 / plain text | MarkdownV2 escape nhiều ký tự; HTML chỉ cần escape 3 char |
| D6 | Cắt chunk thay vì rút gọn | Top N tasks | Giữ thông tin đầy đủ |
| D7 | Phase 1 HTTP OK, localhost only | Bắt buộc HTTPS | Outbound Telegram vẫn HTTPS; inbound crontab local → token không rò |

### Deviations phát sinh trong execution
- **Removed `globals: true` from `vitest.config.ts`**: plan ghi `globals: true` nhưng test file dùng explicit imports. Removing globals loại bỏ gap "globals enabled không type-declared". Không ảnh hưởng hành vi test.
- **`splitIntoChunks` export từ `telegram.ts` không tồn tại riêng**: plan định nghĩa nó là separate export; thực tế chunking logic consolidate vào `packBlocksIntoChunks` (private trong `telegram-standup.ts`) để chunking tôn trọng ranh giới block. Boundary test cho oversized-block path đã được thêm (commit `34a4259`).
- **`rows` typing dùng `as TaskRow[]` cast**: Drizzle infers full schema; partial column-selected shape cần type-annotate để try/catch block reassign được. Chọn inline type alias + cast thay vì `Awaited<ReturnType<...>>` (lỗi type mismatch).

## Contract thay đổi không?
- [x] **Không**. Không touch Drizzle schema, không touch MCP API, không thay đổi auth/session, không thay đổi shared interface nào.
- Endpoint mới `/api/cron/telegram-daily-standup` là GUARDED (cron) theo pattern đã có.

## Tests
- Unit tests: **15/15 pass** (9 format + 6 client).
- Coverage `src/lib/telegram-standup.ts`: statements 97.64%, branches 94.44%, functions 100%, lines 97.64%.
- Coverage `src/lib/telegram.ts`: statements 100%, branches 91.66%, functions 100%, lines 100%.
- Uncovered branches: `.catch(() => '')` fallback khi `response.text()` throw mid-stream — edge case khó trigger, defensive only.
- Integration test handler route: KHÔNG viết. Dùng manual smoke test tại deploy (section dưới).
- `npx tsc --noEmit`: clean.
- `npm run lint` trên 5 file mới: clean.
- `npm run build`: success, route `/api/cron/telegram-daily-standup` xuất hiện.

## Còn dở / Chưa làm (handover để deploy)

### Chairman / ops cần làm tại deploy:
1. Tạo bot qua @BotFather → lấy `TELEGRAM_BOT_TOKEN`.
2. Tạo group "Libe AIOS — Daily Standup", add bot, lấy `chat_id` qua `getUpdates`.
3. Set `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` trong `.env.local` prod (không commit).
4. Restart Docker: `docker-compose -f docker-compose.prod.yml restart`.
5. **Manual smoke test**:
   - `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/telegram-daily-standup`
   - Verify group nhận message đúng format.
   - Test escape: tạo task tạm với title `<script>alert(1)</script>`, verify literal render.
6. Add crontab entry: `30 1 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/telegram-daily-standup >> /var/log/libe-aios-cron.log 2>&1`
7. Monitor 3 ngày, close phase 1.

### Known constraints (accept for Phase 1, xem xét Phase 2):
- **Continuation chunks không có date header** (từ chunk thứ 2+). User khi scroll back trong Telegram không thấy "Daily Standup — …" ở chunk 2. Cosmetic UX gap.
- **`localeCompare` không pin locale 'vi'**: sort tên Vietnamese có thể khác giữa Node/OS. Cosmetic.
- **`startOfDay(now)` dùng local timezone**: nếu container không set `TZ=Asia/Ho_Chi_Minh` thì overdue boundary có thể off-by-one lúc giao ngày. → **RECOMMEND**: set `TZ=Asia/Ho_Chi_Minh` trong `docker-compose.prod.yml` environment khi deploy (không trong scope phase 1).
- **`.gitignore` pattern `.env*` quá rộng**: phải `git add -f` cho `.env.example`. Suggest thêm `!.env.example` negation rule — cleanup nhỏ, không thuộc scope.
- **`result?: any` trong `TelegramResponse`**: unused field (field từ spec giữ nguyên với eslint-disable). Có thể xoá ở cleanup sau.

## Phiên sau cần biết (brief cho agent Phase 2)

**Phase 1 (task này) chỉ outbound 1 chiều, KHÔNG có:**
- Bot commands (`/mytasks`, `/done`, ...) — cần webhook public HTTPS hoặc long-polling worker.
- Identity mapping: Telegram user ↔ libe-aios user. Cần bảng `user_telegram_link` (columns: `user_id`, `telegram_chat_id`, `linked_at`) và flow liên kết từ `/settings`.
- Per-user DM notifications.
- Per-project group Telegram (field `projects.telegramChatId`).
- Event-driven notifications (khi task chuyển status) — hook vào `update_task_status` trong `src/app/api/mcp/route.ts`.

**Entrypoint để mở rộng:**
- Send: `sendTelegramMessage` tại `src/lib/telegram.ts`. Generic, dùng lại được.
- Format: `formatStandupMessage` tại `src/lib/telegram-standup.ts`. Pattern để thêm các loại message khác (weekly digest, deadline reminder etc.) — viết thêm `format*` function pure, reuse `escapeHtml` + chunking helpers.

**Security reminders cho Phase 2:**
- `TELEGRAM_BOT_TOKEN` nằm trong URL của `sendTelegramMessage` — không log biến `url` này.
- Nếu thêm webhook inbound → verify `X-Telegram-Bot-Api-Secret-Token` header để chặn spoofing.
- Identity mapping flow phải dùng one-time token (TTL ngắn), không match qua email plain.

## Commits trong range
```
5af9c5f fix(cron): apply rate-limit sleep between any multi-chunk sends
222d918 fix(cron): wrap DB query in try/catch for clean error response
34a4259 test(telegram): cover oversized-block line-fallback path
6ea643b docs: add Telegram daily standup setup to README
9802a17 chore: document Telegram env vars in .env.example
6ef0643 fix(cron): add query limit and format safety to telegram standup
35d5167 feat(cron): add telegram-daily-standup endpoint
390cb3d refactor(telegram): rename shadowed 'text' to 'responseBody'
9719754 feat(telegram): implement sendTelegramMessage client
719bdc9 test(telegram): add failing tests for sendTelegramMessage (red)
1e6b2ca fix(telegram): escape task.id to prevent latent XSS
911fccc feat(telegram): implement formatStandupMessage (green)
7ec16a6 test(telegram): add failing tests for formatStandupMessage (red)
c5e3bb9 feat(telegram): add StandupTask types and format signature
a48a560 chore: remove globals from vitest config to match explicit-import pattern
7e14e3c chore: add Vitest for unit testing
d481500 docs: add implementation plan for Telegram daily standup bot (phase 1)
e3b3527 docs: add design spec for Telegram daily standup bot (phase 1)
```
