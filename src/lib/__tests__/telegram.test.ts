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
