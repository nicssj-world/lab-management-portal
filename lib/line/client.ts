import { createHmac, timingSafeEqual } from 'crypto'
import { requiredEnv } from '@/lib/env'

const secret = () => requiredEnv('LINE_CHANNEL_SECRET')
const token  = () => requiredEnv('LINE_CHANNEL_ACCESS_TOKEN')

export function verifyLineSignature(rawBody: string, signature: string): boolean {
  const expected = createHmac('SHA256', secret())
    .update(rawBody)
    .digest('base64')
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

export interface LineQuickReply {
  items: {
    type: 'action'
    action: { type: 'message'; label: string; text: string }
  }[]
}

export interface LineTextMessage { type: 'text'; text: string; quickReply?: LineQuickReply }

export interface LineFlexMessage {
  type: 'flex'
  altText: string
  contents: Record<string, unknown>
  quickReply?: LineQuickReply
}

export type LineMessage = LineTextMessage | LineFlexMessage

export async function replyMessage(replyToken: string, messages: LineMessage[]) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token()}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  })
}

// Broadcast to every follower of the LINE OA — throws on failure so callers can report it
export async function broadcastMessage(messages: LineMessage[]) {
  const res = await fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token()}`,
    },
    body: JSON.stringify({ messages }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`LINE broadcast failed (${res.status}): ${detail.slice(0, 300)}`)
  }
}
