import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auditSafety, requireSafetyEditor } from '@/lib/lab-map/safety-access'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { syncSafetyInspectionRoundToTask } from '@/lib/quality-tasks/safety-server'

type Context = { params: Promise<{ id: string }> }

type Row = Record<string, any>

function stringList(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))]
    : []
}

function assetKind(row: Row) {
  const asset = row.asset as Row | null | undefined
  return typeof asset?.kind === 'string' ? asset.kind : ''
}

export async function PATCH(req: NextRequest, { params }: Context) {
  const guard = await requireSafetyEditor()
  if (guard.response) return guard.response
  const parsed = z.object({ close: z.literal(true), kind: z.string().trim().min(1).optional() }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })
  const { id } = await params
  const { data: round, error: roundError } = await supabaseAdmin.from('lab_map_safety_inspection_rounds')
    .select('*').eq('id', id).maybeSingle()
  if (roundError) return NextResponse.json({ error: roundError.message }, { status: 500 })
  if (!round) return NextResponse.json({ error: 'ไม่พบรอบตรวจ' }, { status: 404 })
  if (round.status === 'closed') {
    try {
      const taskSync = await syncSafetyInspectionRoundToTask(id, guard.actor)
      return NextResponse.json({ data: round, taskSync, retried: true })
    } catch (syncError) {
      return NextResponse.json({ data: round, taskSync: { status: 'pending', error: (syncError as Error).message } }, { status: 202 })
    }
  }

  const { data: itemRows, error: itemError } = await supabaseAdmin.from('lab_map_safety_inspection_round_items')
    .select('id,status,asset:lab_map_safety_assets(kind)').eq('round_id', id)
  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 })

  const rows = (itemRows ?? []) as Row[]
  const snapshot = (round.filter_snapshot ?? {}) as Record<string, unknown>
  const configuredKinds = stringList(snapshot.kinds)
  const itemKinds = [...new Set(rows.map(assetKind).filter(Boolean))]
  const kinds = itemKinds.length ? itemKinds : configuredKinds
  const selectedKind = parsed.data.kind ?? (kinds.length === 1 ? kinds[0] : null)
  if (!selectedKind && kinds.length > 1) {
    return NextResponse.json({ error: 'กรุณาเลือกประเภทอุปกรณ์ก่อนปิดรอบ' }, { status: 422 })
  }
  if (selectedKind && kinds.length && !kinds.includes(selectedKind)) {
    return NextResponse.json({ error: 'ประเภทอุปกรณ์นี้ไม่ได้อยู่ในรอบตรวจ' }, { status: 422 })
  }
  const targetRows = selectedKind ? rows.filter(row => assetKind(row) === selectedKind) : rows
  if (!targetRows.length) return NextResponse.json({ error: 'ไม่พบอุปกรณ์ในประเภทที่เลือก' }, { status: 422 })
  const pendingCount = targetRows.filter(row => String(row.status) === 'pending').length
  if (pendingCount > 0) {
    return NextResponse.json({ error: selectedKind
      ? `ประเภท ${selectedKind} ยังมีอุปกรณ์ที่ไม่ได้ตรวจ ${pendingCount} จุด`
      : 'ยังมีอุปกรณ์ที่ไม่ได้ตรวจในรอบนี้' }, { status: 422 })
  }

  const closedKinds = stringList(snapshot.closedKinds)
  if (selectedKind && !closedKinds.includes(selectedKind)) closedKinds.push(selectedKind)
  const allKindsClosed = kinds.length === 0 || kinds.every(kind => closedKinds.includes(kind))
  const nextSnapshot = { ...snapshot, kinds, closedKinds }
  if (!allKindsClosed) {
    const { data, error } = await supabaseAdmin.from('lab_map_safety_inspection_rounds').update({
      filter_snapshot: nextSnapshot,
    }).eq('id', id).eq('status', 'open').select('*').maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'รอบตรวจถูกเปลี่ยนแปลงแล้ว กรุณาโหลดใหม่' }, { status: 409 })
    try {
      await auditSafety('lab_map.safety_inspection_round.close', guard.actor.id, id, {
        status: 'open', equipmentKind: selectedKind, kindStatus: 'closed', closedKinds,
      })
    } catch (auditError) {
      return NextResponse.json({ error: (auditError as Error).message }, { status: 500 })
    }
    return NextResponse.json({
      data, category: { kind: selectedKind, status: 'closed' },
      taskSync: { status: 'pending', closedKinds, remainingKinds: kinds.filter(kind => !closedKinds.includes(kind)) },
    })
  }

  const closedAt = new Date().toISOString()
  const { data, error } = await supabaseAdmin.from('lab_map_safety_inspection_rounds').update({
    status: 'closed', filter_snapshot: nextSnapshot, closed_by: guard.actor.id, closed_at: closedAt,
  }).eq('id', id).eq('status', 'open').select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) {
    const { data: closedRound } = await supabaseAdmin.from('lab_map_safety_inspection_rounds').select('*').eq('id', id).eq('status', 'closed').maybeSingle()
    if (!closedRound) return NextResponse.json({ error: 'ไม่พบรอบตรวจที่เปิดอยู่' }, { status: 404 })
    try {
      const taskSync = await syncSafetyInspectionRoundToTask(id, guard.actor)
      return NextResponse.json({ data: closedRound, taskSync, retried: true })
    } catch (syncError) {
      return NextResponse.json({ data: closedRound, taskSync: { status: 'pending', error: (syncError as Error).message } }, { status: 202 })
    }
  }
  try {
    await auditSafety('lab_map.safety_inspection_round.close', guard.actor.id, id, {
      status: 'closed', closedAt, equipmentKind: selectedKind, closedKinds,
    })
  } catch (auditError) {
    return NextResponse.json({ error: (auditError as Error).message }, { status: 500 })
  }
  try {
    const taskSync = await syncSafetyInspectionRoundToTask(id, guard.actor)
    return NextResponse.json({ data, taskSync })
  } catch (syncError) {
    return NextResponse.json({ data, taskSync: { status: 'pending', error: (syncError as Error).message } }, { status: 202 })
  }
}
