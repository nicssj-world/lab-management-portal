import type { News } from '@/lib/supabase/types'
import type { LineFlexMessage } from '@/lib/line/client'
import { CAT_MAP } from '@/lib/validations/news'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

const fmtThaiDate = (s: string) =>
  new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })

// LINE hero images must be public https URLs — body images are on Supabase public storage
export function firstBodyImage(body: string | null): string | null {
  const m = body?.match(/<img[^>]+src="(https:\/\/[^"]+)"/)
  return m?.[1] ?? null
}

export function buildNewsFlex(news: News): LineFlexMessage {
  const cat = CAT_MAP[news.cat as keyof typeof CAT_MAP]
  const catColor = cat?.color ?? '#1E5FAD'
  const catLabel = cat?.th ?? 'ข่าวสาร'
  const heroUrl = firstBodyImage(news.body)

  const headerTop: Record<string, unknown>[] = [
    {
      type: 'text', text: 'ข่าวสารห้องปฏิบัติการ', color: '#FFFFFFB3',
      size: 'xxs', weight: 'bold', flex: 1, gravity: 'center',
    },
  ]
  if (news.is_new) {
    headerTop.push({
      type: 'box', layout: 'vertical', backgroundColor: '#DC2626',
      cornerRadius: '10px', paddingAll: '2px', paddingStart: '10px', paddingEnd: '10px',
      width: '52px', height: '20px', justifyContent: 'center',
      contents: [{ type: 'text', text: 'NEW', color: '#FFFFFF', size: 'xxs', weight: 'bold', align: 'center' }],
    })
  }

  const bodyContents: Record<string, unknown>[] = [
    { type: 'text', text: news.title, weight: 'bold', size: 'md', color: '#0F172A', wrap: true, lineSpacing: '4px' },
  ]
  if (news.excerpt) {
    bodyContents.push({
      type: 'text', text: news.excerpt, size: 'sm', color: '#64748B',
      wrap: true, margin: 'md', lineSpacing: '4px',
    })
  }
  bodyContents.push({ type: 'separator', margin: 'lg', color: '#E5EAF0' })

  const metaRows: Record<string, unknown>[] = [
    {
      type: 'box', layout: 'baseline', spacing: 'sm',
      contents: [
        { type: 'text', text: '📅', size: 'sm', flex: 0 },
        { type: 'text', text: fmtThaiDate(news.created_at), size: 'xs', color: '#64748B', flex: 1 },
      ],
    },
  ]
  if (news.author) {
    metaRows.push({
      type: 'box', layout: 'baseline', spacing: 'sm',
      contents: [
        { type: 'text', text: '✍️', size: 'sm', flex: 0 },
        { type: 'text', text: news.author, size: 'xs', color: '#64748B', flex: 1 },
      ],
    })
  }
  bodyContents.push({ type: 'box', layout: 'vertical', margin: 'lg', spacing: 'sm', contents: metaRows })

  const footerButtons: Record<string, unknown>[] = []
  if (APP_URL) {
    footerButtons.push({
      type: 'button', style: 'primary', height: 'sm', color: catColor,
      action: { type: 'uri', label: 'อ่านรายละเอียด', uri: `${APP_URL}/news/${news.id}` },
    })
    if (news.pdf_path) {
      footerButtons.push({
        type: 'button', style: 'secondary', height: 'sm',
        action: { type: 'uri', label: 'เปิดเอกสารแนบ (PDF)', uri: `${APP_URL}/api/news/${news.id}/pdf` },
      })
    }
  }

  const bubble: Record<string, unknown> = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box', layout: 'vertical', backgroundColor: catColor,
      paddingAll: '16px', spacing: 'sm',
      contents: [
        { type: 'box', layout: 'horizontal', contents: headerTop },
        { type: 'text', text: catLabel, color: '#FFFFFF', size: 'lg', weight: 'bold' },
      ],
    },
    body: { type: 'box', layout: 'vertical', paddingAll: '16px', contents: bodyContents },
  }
  if (heroUrl) {
    bubble.hero = { type: 'image', url: heroUrl, size: 'full', aspectRatio: '20:13', aspectMode: 'cover' }
  }
  if (footerButtons.length > 0) {
    bubble.footer = {
      type: 'box', layout: 'vertical', spacing: 'sm',
      paddingStart: '16px', paddingEnd: '16px', paddingBottom: '16px',
      contents: footerButtons,
    }
  }

  return {
    type: 'flex',
    altText: `📰 ${catLabel}: ${news.title}`.slice(0, 400),
    contents: bubble,
  }
}
