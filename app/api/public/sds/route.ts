import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { searchPublicSds } from '@/lib/chemical-safety/public'
import { consumeClientRateLimit } from '@/lib/security/request-protection'

// เส้นทางนี้ต้องเปิดให้ผู้ที่ไม่ได้ล็อกอินใช้ได้ ตามที่หน้า /sds ประกาศไว้
// จึงไม่มี guard ใด ๆ นอกจาก rate limit — ข้อมูลที่ส่งออกถูกคัดกรองใน searchPublicSds แล้ว
const querySchema = z.object({
  q: z.string().trim().max(200).optional(),
  unit: z.string().trim().max(100).optional(),
  language: z.string().trim().max(30).optional(),
  ghs: z.enum(['GHS01', 'GHS02', 'GHS03', 'GHS04', 'GHS05', 'GHS06', 'GHS07', 'GHS08', 'GHS09']).optional(),
  zone: z.enum(['A', 'B', 'C', 'T']).optional(),
  position: z.string().trim().max(20).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
})

export async function GET(request: NextRequest) {
  const rate = consumeClientRateLimit(request.headers, 'public-sds-search', 300, 10 * 60_000)
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, {
      status: 429,
      headers: { 'Retry-After': String(rate.retryAfterSeconds), 'Cache-Control': 'no-store' },
    })
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid filters' }, { status: 422, headers: { 'Cache-Control': 'no-store' } })
  }

  const { page, pageSize, ...filters } = parsed.data
  const all = await searchPublicSds(filters)
  return NextResponse.json(
    { items: all.slice((page - 1) * pageSize, page * pageSize), count: all.length },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
