import { CAT_MAP } from '@/lib/validations/news'

function visibleTextFromHtml(html: string): string {
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|amp|lt|gt|quot|#\d+);/gi, ' ')
}

export function extractNewsTags(body: string | null, cat: string | null): string[] {
  const tags: string[] = []
  const catInfo = CAT_MAP[cat as keyof typeof CAT_MAP]
  if (catInfo) tags.push(catInfo.th)

  if (body) {
    const matches = visibleTextFromHtml(body).match(/#[\p{L}\p{M}\p{N}_-]+/gu) ?? []
    for (const match of matches) {
      const tag = match.slice(1)
      if (!tags.includes(tag)) tags.push(tag)
    }
  }

  return tags
}
