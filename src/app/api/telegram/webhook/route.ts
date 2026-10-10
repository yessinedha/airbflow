import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type TelegramMessage = {
  chat?: { id?: unknown; type?: unknown }
  from?: {
    first_name?: unknown
    id?: unknown
    last_name?: unknown
    username?: unknown
  }
  text?: unknown
  reply_to_message?: { text?: unknown }
}

type TelegramUpdate = { message?: TelegramMessage }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function constantTimeEqual(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false
  let difference = 0
  for (let index = 0; index < expected.length; index += 1) {
    difference |= provided.charCodeAt(index) ^ expected.charCodeAt(index)
  }
  return difference === 0
}

async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
    signal: AbortSignal.timeout(10_000),
  })

  const result: unknown = await response.json()
  if (!response.ok || !isRecord(result) || result.ok !== true) {
    throw new Error('Telegram sendMessage request failed')
  }
}

function validChatId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

function parseUpdate(payload: unknown): TelegramUpdate | null {
  if (!isRecord(payload)) return null
  if (!('message' in payload)) return {}
  if (!isRecord(payload.message)) return null

  const message = payload.message
  const chat = message.chat
  if (!isRecord(chat)) return null
  if (!validChatId(chat.id)) return null

  const from = isRecord(message.from) ? message.from : undefined
  const reply = isRecord(message.reply_to_message) ? message.reply_to_message : undefined
  return {
    message: {
      chat: {
        id: chat.id,
        type: typeof chat.type === 'string' ? chat.type : undefined,
      },
      from: from
        ? {
            first_name: from.first_name,
            id: from.id,
            last_name: from.last_name,
            username: from.username,
          }
        : undefined,
      text: message.text,
      reply_to_message: reply ? { text: reply.text } : undefined,
    },
  }
}

function displayName(from: TelegramMessage['from']): string {
  const name = [from?.first_name, from?.last_name]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ')

  return name || 'Telegram user'
}

export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET

  if (
    !token ||
    !adminChatId ||
    !/^-?\d+$/.test(adminChatId) ||
    !webhookSecret ||
    !/^[A-Za-z0-9_-]{32,256}$/.test(webhookSecret)
  ) {
    return NextResponse.json({ error: 'Telegram support is not configured' }, { status: 503 })
  }

  const providedSecret = request.headers.get('x-telegram-bot-api-secret-token') ?? ''
  if (!constantTimeEqual(providedSecret, webhookSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const update = parseUpdate(payload)
  if (!update) return NextResponse.json({ error: 'Invalid update' }, { status: 400 })

  const message = update.message
  const chatId = message?.chat?.id
  const text = message?.text
  if (!message || !validChatId(chatId) || typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ ok: true })
  }

  const senderChatId = String(chatId)
  const trimmedText = text.trim()

  try {
    if (senderChatId === adminChatId) {
      if (message.chat?.type !== 'private' || message.from?.id !== chatId) {
        return NextResponse.json({ ok: true })
      }

      const repliedToText = message.reply_to_message?.text
      const recipient = typeof repliedToText === 'string'
        ? repliedToText.match(/(?:^|\n)\[arbiflow-chat:(-?\d+)\]\s*$/)?.[1]
        : undefined

      if (!recipient) return NextResponse.json({ ok: true })
      if (trimmedText.length > 4000) {
        await sendTelegramMessage(token, adminChatId, 'Replies must be 4000 characters or fewer.')
        return NextResponse.json({ ok: true })
      }

      await sendTelegramMessage(token, recipient, trimmedText)
      return NextResponse.json({ ok: true })
    }

    if (message.chat?.type !== 'private') {
      return NextResponse.json({ ok: true })
    }

    if (/^\/start(?:@\w+)?(?:\s|$)/i.test(trimmedText)) {
      await sendTelegramMessage(
        token,
        senderChatId,
        'Welcome to ArbiFlow Support. Send your message here and our support team will reply to you.\n\nمرحباً بك في دعم ArbiFlow. أرسل رسالتك هنا وسيرد عليك فريق الدعم.',
      )
      return NextResponse.json({ ok: true })
    }

    const safeText = trimmedText.slice(0, 3000)
    const username = typeof message.from?.username === 'string' ? `@${message.from.username}` : 'Not provided'
    const forwardedMessage = [
      'New ArbiFlow support message',
      `From: ${displayName(message.from)}`,
      `Telegram username: ${username}`,
      '',
      safeText,
      '',
      'Reply to this message to respond to the user.',
      `[arbiflow-chat:${senderChatId}]`,
    ].join('\n')

    await sendTelegramMessage(token, adminChatId, forwardedMessage)
    return NextResponse.json({ ok: true })
  } catch {
    console.error('[Telegram support] Failed to process webhook update')
    return NextResponse.json({ error: 'Could not process Telegram update' }, { status: 502 })
  }
}
