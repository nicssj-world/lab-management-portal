import { GetObjectCommand } from '@aws-sdk/client-s3'
import { NextResponse, type NextRequest } from 'next/server'
import { isAllowedPublicSafetyManualCode, resolvePublicSafetyManual } from '@/lib/chemical-safety/public-manual'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { r2ObjectResponse } from '@/lib/r2/stream-response'
import { consumeClientRateLimit } from '@/lib/security/request-protection'

export async function GET(request: NextRequest, ctx: RouteContext<'/api/public/safety-manual/[code]'>) {
  const { code } = await ctx.params
  if (!isAllowedPublicSafetyManualCode(code)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const rate = consumeClientRateLimit(request.headers, `public-safety-manual:${code.toUpperCase()}`, 60, 10 * 60_000)
  if (!rate.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
  const manual = await resolvePublicSafetyManual(code)
  if (!manual) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  const disposition = request.nextUrl.searchParams.get('disposition') === 'attachment' ? 'attachment' : 'inline'
  const object = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: manual.r2Key, Range: request.headers.get('range') ?? undefined }))
  const response = r2ObjectResponse(object, { contentType: manual.contentType, contentDisposition: `${disposition}; filename="MN-LAB-02.pdf"` })
  response.headers.set('Cache-Control', 'no-store')
  return response
}
