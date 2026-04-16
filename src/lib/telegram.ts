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
