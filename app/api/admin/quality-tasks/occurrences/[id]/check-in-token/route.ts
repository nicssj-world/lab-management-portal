import { NextRequest, NextResponse } from 'next/server'
import { qualityTaskContext, qualityTaskError } from '@/lib/quality-tasks/api'
import { closeCheckIn, issueCheckInToken, openCheckIn } from '@/lib/quality-tasks/check-in'

/** ออก (หรือคืน) QR check-in token ของรอบประชุมนี้ — สิทธิ์เดียวกับการแก้ไขรอบ (canMutateOccurrence) */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await qualityTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const token = await issueCheckInToken((await params).id, ctx.actor, ctx.level)
    return NextResponse.json({ token })
  } catch (error) { return qualityTaskError(error) }
}

/** เปิดรับเช็คอินก่อนเวลาตามกำหนด — ใช้เป็นข้อยกเว้นเมื่อการประชุมเริ่มเร็ว */
export async function PUT(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await qualityTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const result = await openCheckIn((await params).id, ctx.actor, ctx.level)
    return NextResponse.json(result)
  } catch (error) { return qualityTaskError(error) }
}

/** ปิดรับเช็คอินของ QR เดิม — ใช้สิทธิ์เดียวกับการแก้ไขรอบ */
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await qualityTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const closedAt = await closeCheckIn((await params).id, ctx.actor, ctx.level)
    return NextResponse.json({ closedAt })
  } catch (error) { return qualityTaskError(error) }
}
