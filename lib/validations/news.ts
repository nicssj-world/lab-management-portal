import { z } from 'zod'

export const CATEGORIES = [
  { key: 'announce', th: 'ข่าวประชาสัมพันธ์', color: '#2563EB' },
  { key: 'training', th: 'กิจกรรมอบรม',       color: '#7C3AED' },
  { key: 'cert',     th: 'การรับรอง',          color: '#059669' },
  { key: 'system',   th: 'ปรับปรุงระบบ',       color: '#D97706' },
  { key: 'service',  th: 'ข่าวบริการ',         color: '#64748B' },
] as const

export type CategoryKey = typeof CATEGORIES[number]['key']

export const CAT_MAP = Object.fromEntries(
  CATEGORIES.map(c => [c.key, c])
) as Record<CategoryKey, typeof CATEGORIES[number]>

export const NewsSchema = z.object({
  title:      z.string().min(1, 'กรุณากรอกหัวข้อข่าว').max(300),
  excerpt:    z.string().max(500).optional(),
  body:       z.string().optional(),
  cat:        z.enum(['announce', 'training', 'cert', 'system', 'service']),
  author:     z.string().max(100).optional(),
  published:  z.boolean().default(false),
  is_new:     z.boolean().default(false),
  new_until:  z.string().nullable().optional(),
  created_at: z.string().optional(),
  removePdf:  z.boolean().optional(),
})

export type NewsInput = z.infer<typeof NewsSchema>
