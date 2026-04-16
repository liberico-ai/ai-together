This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

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
