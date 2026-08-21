import { NextRequest, NextResponse } from 'next/server'
import { requireSafetyEditor } from '@/lib/lab-map/safety-access'
import type { SafetyInspectionRoundItemDTO } from '@/lib/lab-map/types'
import { supabaseAdmin } from '@/lib/supabase/admin'

function roundItem(row: Record<string, unknown>): SafetyInspectionRoundItemDTO {
  return {
    id: String(row.id),
    assetId: String(row.asset_id),
    sequence: Number(row.sequence_no),
    status: row.status as SafetyInspectionRoundItemDTO['status'],
    inspectionId: row.inspection_id == null ? null : String(row.inspection_id),
  }
}

async function syncExistingEvidence(roundId: string, actorId: string) {
  const { data, error } = await supabaseAdmin.rpc('sync_lab_map_safety_inspection_round_existing_evidence', {
    p_round_id: roundId,
    p_actor_id: actorId,
  })
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}

async function loadRoundItems(roundId: string) {
  const { data, error } = await supabaseAdmin.from('lab_map_safety_inspection_round_items')
    .select('*').eq('round_id', roundId).order('sequence_no')
  if (error) throw new Error(error.message)
  return (data ?? []).map(roundItem)
}

export async function GET(req: NextRequest) {
  const guard = await requireSafetyEditor()
  if (guard.response) return guard.response
  const requestedRoundId = req.nextUrl.searchParams.get('roundId')
  if (!requestedRoundId) return NextResponse.json({ data: null })
  const { data: round, error } = await supabaseAdmin.from('lab_map_safety_inspection_rounds')
    .select('*').eq('status', 'open').eq('id', requestedRoundId).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!round) return requestedRoundId
    ? NextResponse.json({ error: 'ไม่พบรอบตรวจที่เปิดอยู่ หรือไม่มีสิทธิ์เข้าถึงรอบนี้' }, { status: 404 })
    : NextResponse.json({ data: null })
  // รอบตรวจประจำเดือน (Spill kit / NSS) ใช้แบบฟอร์มของตัวเองในแท็บ "ตรวจประจำเดือน"
  // ถ้าปล่อยให้เปิดในหน้าอุปกรณ์ จะบันทึกผลด้วยแบบถ่ายรูปแล้วปิดจุดตรวจค้าง —
  // แผงประจำเดือนยังเห็นเป็น "ยังไม่ส่ง" แต่ส่งผลหรือข้ามไม่ได้อีกเลย
  if ((round.filter_snapshot as { source?: string } | null)?.source === 'monthly_safety') {
    return NextResponse.json({ error: 'รอบตรวจประจำเดือนต้องบันทึกผลในแท็บ “ตรวจประจำเดือน” ของหน้างานความปลอดภัย' }, { status: 409 })
  }
  try {
    await syncExistingEvidence(String(round.id), guard.actor.id)
    const items = await loadRoundItems(String(round.id))
    return NextResponse.json({ data: {
      id: round.id, nameTh: round.name_th, status: round.status,
      filters: round.filter_snapshot, startedAt: round.started_at,
      items,
    } })
  } catch (syncError) {
    return NextResponse.json({ error: (syncError as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireSafetyEditor()
  if (guard.response) return guard.response
  return NextResponse.json({ error: 'กรุณาเริ่มรอบตรวจจากหน้า งานความปลอดภัย เพื่อให้ Task และอุปกรณ์ใช้รอบเดียวกัน' }, { status: 409 })
}
