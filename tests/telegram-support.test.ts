import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/telegram/webhook/route'

const ADMIN_CHAT_ID = '5173974672'
const WEBHOOK_SECRET = 'a-long-random-secret-for-tests-with-32-chars'

function webhookRequest(payload: unknown, secret = WEBHOOK_SECRET): Request {
  return new Request('https://arbiflow.example/api/telegram/webhook', {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': secret },
    body: JSON.stringify(payload),
  })
}

describe('Telegram support webhook', () => {
  const telegramFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify({ ok: true, result: { message_id: 123 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )

  beforeEach(() => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '12345:test-token')
    vi.stubEnv('TELEGRAM_ADMIN_CHAT_ID', ADMIN_CHAT_ID)
    vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', WEBHOOK_SECRET)
    vi.stubGlobal('fetch', telegramFetch)
    telegramFetch.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('rejects updates without the Telegram webhook secret', async () => {
    const response = await POST(webhookRequest({ message: { text: 'hello' } }, 'wrong-secret'))

    expect(response.status).toBe(401)
    expect(telegramFetch).not.toHaveBeenCalled()
  })

  it('forwards private user messages to the configured admin chat', async () => {
    const response = await POST(
      webhookRequest({
        message: {
          chat: { id: 987654321, type: 'private' },
          from: { first_name: 'Member', username: 'member123' },
          text: 'I need help with my account.',
        },
      }),
    )

    expect(response.status).toBe(200)
    expect(telegramFetch).toHaveBeenCalledOnce()
    const [url, init] = telegramFetch.mock.calls[0]!
    expect(String(url)).toContain('/bot12345:test-token/sendMessage')
    const sent = JSON.parse(String(init?.body)) as { chat_id: string; text: string }
    expect(sent.chat_id).toBe(ADMIN_CHAT_ID)
    expect(sent.text).toContain('I need help with my account.')
    expect(sent.text).toContain('[arbiflow-chat:987654321]')
  })

  it('routes an admin reply to the user identified by the replied-to message', async () => {
    const response = await POST(
      webhookRequest({
        message: {
          chat: { id: Number(ADMIN_CHAT_ID), type: 'private' },
          from: { id: Number(ADMIN_CHAT_ID) },
          text: 'We can help you with that.',
          reply_to_message: {
            text: 'New ArbiFlow support message\n[arbiflow-chat:987654321]',
          },
        },
      }),
    )

    expect(response.status).toBe(200)
    expect(telegramFetch).toHaveBeenCalledOnce()
    const [, init] = telegramFetch.mock.calls[0]!
    const sent = JSON.parse(String(init?.body)) as { chat_id: string; text: string }
    expect(sent.chat_id).toBe('987654321')
    expect(sent.text).toBe('We can help you with that.')
  })

  it('does not forward messages sent in non-private user chats', async () => {
    const response = await POST(
      webhookRequest({
        message: {
          chat: { id: -123, type: 'group' },
          text: 'Group message',
        },
      }),
    )

    expect(response.status).toBe(200)
    expect(telegramFetch).not.toHaveBeenCalled()
  })
})
