import { NextRequest, NextResponse } from 'next/server'
import { requireSafetyEditor } from '@/lib/lab-map/safety-access'
import type { SafetyInspectionRoundItemDTO } from '@/lib/lab-map/types'
import { safetyInspectionRoundInputSchema } from '@/lib/validations/lab-map-safety'
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

export async function GET() {
  const guard = await requireSafetyEditor()
  if (guard.response) return guard.response
  const { data: round, error } = await supabaseAdmin.from('lab_map_safety_inspection_rounds')
    .select('*').eq('status', 'open').eq('started_by', guard.actor.id)
    .order('started_at', { ascending: false }).limit(1).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!round) return NextResponse.json({ data: null })
  const { data: rows, error: itemError } = await supabaseAdmin.from('lab_map_safety_inspection_round_items')
    .select('*').eq('round_id', round.id).order('sequence_no')
  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 })
  return NextResponse.json({ data: {
    id: round.id, nameTh: round.name_th, status: round.status,
    filters: round.filter_snapshot, startedAt: round.started_at,
    items: (rows ?? []).map(roundItem),
  } })
}

export async function POST(req: NextRequest) {
  const guard = await requireSafetyEditor()
  if (guard.response) return guard.response
  const parsed = safetyInspectionRoundInputSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })

  const { data: assets, error: assetError } = await supabaseAdmin.from('lab_map_safety_assets')
    .select('id').in('id', parsed.data.orderedAssetIds).eq('lifecycle_status', 'active')
  if (assetError) return NextResponse.json({ error: assetError.message }, { status: 500 })
  const activeIds = new Set((assets ?? []).map(asset => String(asset.id)))
  if (activeIds.size !== parsed.data.orderedAssetIds.length) {
    return NextResponse.json({ error: 'มีอุปกรณ์ที่ไม่พบหรือเลิกใช้งานแล้ว กรุณาโหลดรายการใหม่' }, { status: 422 })
  }

  const { data: round, error: roundError } = await supabaseAdmin.from('lab_map_safety_inspection_rounds').insert({
    name_th: parsed.data.nameTh,
    filter_snapshot: parsed.data.filters,
    started_by: guard.actor.id,
  }).select('*').single()
  if (roundError) return NextResponse.json({ error: roundError.message }, { status: 500 })

  const itemRows = parsed.data.orderedAssetIds.map((assetId, index) => ({
    round_id: round.id, asset_id: assetId, sequence_no: index + 1,
  }))
  const { data: items, error: itemError } = await supabaseAdmin.from('lab_map_safety_inspection_round_items')
    .insert(itemRows).select('*')
  if (itemError) {
    await supabaseAdmin.from('lab_map_safety_inspection_rounds').delete().eq('id', round.id)
    return NextResponse.json({ error: itemError.message }, { status: 500 })
  }
  return NextResponse.json({ data: {
    id: round.id, nameTh: round.name_th, status: round.status,
    filters: round.filter_snapshot, startedAt: round.started_at,
    items: (items ?? []).sort((a, b) => Number(a.sequence_no) - Number(b.sequence_no)).map(roundItem),
  } }, { status: 201 })
}
