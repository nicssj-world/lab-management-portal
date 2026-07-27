import { NextResponse, type NextRequest } from 'next/server'
import { listPublicDepartmentSds } from '@/lib/chemical-safety/public'
import { consumeClientRateLimit } from '@/lib/security/request-protection'

// เปิดสาธารณะ — listPublicDepartmentSds คืนเฉพาะงานที่หัวหน้างานกดเผยแพร่แล้ว
export async function GET(request: NextRequest) {
  const rate = consumeClientRateLimit(request.headers, 'public-department-sds', 300, 10 * 60_000)
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, {
      status: 429,
      headers: { 'Retry-After': String(rate.retryAfterSeconds), 'Cache-Control': 'no-store' },
    })
  }

  const groups = await listPublicDepartmentSds()
  return NextResponse.json({ groups }, { headers: { 'Cache-Control': 'no-store' } })
}
