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

export interface LineTextMessage { type: 'text'; text: string }

export async function replyMessage(replyToken: string, messages: LineTextMessage[]) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token()}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  })
}
