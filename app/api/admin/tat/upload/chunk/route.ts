import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

// Module-scope cache — populated once per function instance lifetime
let testTargetMap: Map<string, number> | null = null

async function getTestTargetMap(): Promise<Map<string, number>> {
  if (testTargetMap) return testTargetMap
  const { data } = await supabaseAdmin
    .from('tests')
    .select('name, tat')
    .not('tat', 'is', null)
  testTargetMap = new Map((data ?? []).map(r => [r.name.trim(), r.tat]))
  return testTargetMap
}

// rsltdatetime คือเวลาที่รายงานผลครบทุกตัวใน panel → ใช้ target ที่นานที่สุด
function resolveTarget(testName: string, map: Map<string, number>): number | null {
  const targets = testName
    .split(',')
    .map(t => map.get(t.trim()))
    .filter((v): v is number => v !== undefined)

  return targets.length > 0 ? Math.max(...targets) : null
}

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

interface RawRow {
  spcm_at: string
  rslt_at: string
  tat_minutes: number
  lab_section: string
  ward: string
  priority: string
  test_name: string
  spcm_hour: number
  spcm_dow: number
}

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if (perms['TAT'] !== 'edit') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { upload_id, rows, chunk_index: _ci, is_last_chunk } = await req.json() as {
    upload_id: string
    rows: RawRow[]
    chunk_index: number
    is_last_chunk: boolean
  }

  if (!upload_id || !Array.isArray(rows))
    return NextResponse.json({ error: 'Invalid payload' }, { status: 422 })

  const { data: upload } = await supabaseAdmin
    .from('tat_uploads')
    .select('id, year, month')
    .eq('id', upload_id)
    .maybeSingle()
  if (!upload) return NextResponse.json({ error: 'Upload not found' }, { status: 404 })

  const targetMap = await getTestTargetMap()

  const records = rows.map((row) => {
    const target_minutes = row.priority === 'ด่วน' ? 30 : resolveTarget(row.test_name, targetMap)
    const within_target = target_minutes !== null ? row.tat_minutes <= target_minutes : null

    return {
      upload_id,
      year: upload.year,
      month: upload.month,
      spcm_at: row.spcm_at,
      rslt_at: row.rslt_at,
      tat_minutes: row.tat_minutes,
      target_minutes,
      within_target,
      lab_section: row.lab_section,
      ward: row.ward,
      priority: row.priority,
      test_name: row.test_name,
      spcm_hour: row.spcm_hour,
      spcm_dow: row.spcm_dow,
    }
  })

  const { data: inserted, error } = await supabaseAdmin
    .from('tat_records')
    .insert(records)
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (is_last_chunk) {
    const { count } = await supabaseAdmin
      .from('tat_records')
      .select('id', { count: 'exact', head: true })
      .eq('upload_id', upload_id)
    await supabaseAdmin
      .from('tat_uploads')
      .update({ row_count: count ?? 0 })
      .eq('id', upload_id)
  }

  return NextResponse.json({ inserted: inserted?.length ?? 0 })
}
