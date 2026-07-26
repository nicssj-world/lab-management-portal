import { GetObjectCommand } from '@aws-sdk/client-s3'
import { NextResponse, type NextRequest } from 'next/server'
import { requireChemicalAdmin } from '@/lib/chemical-safety/access'
import { getPublicSdsFile } from '@/lib/chemical-safety/public'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { r2ObjectResponse } from '@/lib/r2/stream-response'
import { consumeClientRateLimit } from '@/lib/security/request-protection'

function safeName(value: string) { return value.replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 180) || 'SDS.pdf' }

export async function GET(request: NextRequest, ctx: RouteContext<'/api/public/sds/[publicId]/file'>) {
  const guard = await requireChemicalAdmin()
  if (guard.response) return guard.response
  const { publicId } = await ctx.params
  const rate = consumeClientRateLimit(request.headers, `public-sds-file:${publicId}`, 120, 10 * 60_000)
  if (!rate.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds), 'Cache-Control': 'no-store' } })
  const file = await getPublicSdsFile(publicId)
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  const disposition = request.nextUrl.searchParams.get('disposition') === 'attachment' ? 'attachment' : 'inline'
  const object = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: file.r2Key, Range: request.headers.get('range') ?? undefined }))
  const response = r2ObjectResponse(object, { contentType: file.contentType, contentDisposition: `${disposition}; filename="${safeName(file.fileName)}"` })
  response.headers.set('Cache-Control', 'no-store')
  return response
}
