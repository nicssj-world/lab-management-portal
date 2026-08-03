import { NextRequest, NextResponse } from 'next/server'
import { getActor, jsonUnauthorized } from '@/lib/auth/guards'
import { getCheckInContext, recordCheckIn } from '@/lib/quality-tasks/check-in'

type Params = { params: Promise<{ token: string }> }

// เช็คอินเปิดให้ทุกคนที่ล็อกอิน — ไม่ผูกกับสิทธิ์ "งานคุณภาพ" เหมือนกับ
// POST .../risk/incidents/report: คนที่มาเข้าประชุมจริงต้องเช็คอินได้เสมอ
// แม้ไม่มีสิทธิ์เข้าโมดูลนี้ (เช่น ผู้เข้าร่วมนอกทีม/แขกรับเชิญที่ยังล็อกอินอยู่)
export async function GET(_req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  try {
    const context = await getCheckInContext((await params).token, actor.id)
    if (!context) return NextResponse.json({ error: 'ไม่พบ QR สำหรับการประชุมนี้' }, { status: 404 })
    return NextResponse.json({ context, actorName: actor.name ?? null })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}

export async function POST(_req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  try {
    const result = await recordCheckIn((await params).token, actor)
    if (result.status === 'not_found') return NextResponse.json({ error: 'ไม่พบ QR สำหรับการประชุมนี้' }, { status: 404 })
    if (result.status === 'closed') return NextResponse.json({ error: 'การประชุมนี้ปิดงานแล้ว ไม่รับเช็คอินเพิ่ม' }, { status: 409 })
    return NextResponse.json({
      ok: true,
      already: result.status === 'already',
      wasUnlisted: result.status === 'recorded' && result.wasUnlisted,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'เช็คอินไม่สำเร็จ' }, { status: 500 })
  }
}
