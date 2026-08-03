import { NextRequest, NextResponse } from 'next/server'
import { qualityTaskContext, qualityTaskError } from '@/lib/quality-tasks/api'
import { issueCheckInToken } from '@/lib/quality-tasks/check-in'

/** ออก (หรือคืน) QR check-in token ของรอบประชุมนี้ — สิทธิ์เดียวกับการแก้ไขรอบ (canMutateOccurrence) */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await qualityTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const token = await issueCheckInToken((await params).id, ctx.actor, ctx.level)
    return NextResponse.json({ token })
  } catch (error) { return qualityTaskError(error) }
}
