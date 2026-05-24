import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { isPanelBloodDraw } from '@/lib/tat/tube-classify'
import { NextRequest, NextResponse } from 'next/server'

// Module-scope caches — populated once per function instance lifetime
let testTargetMap: Map<string, number> | null = null
let testTubeMap: Map<string, string> | null = null

interface TestRow {
  th: string
  en: string | null
  code: string
  lis_code: string | null
  tat: string | null
  tube: string | null
}

async function getTestMaps(): Promise<{ targetMap: Map<string, number>; tubeMap: Map<string, string> }> {
  if (testTargetMap && testTubeMap) return { targetMap: testTargetMap, tubeMap: testTubeMap }

  const { data } = await supabaseAdmin
    .from('tests')
    .select('th, en, code, lis_code, tat, tube')

  testTargetMap = new Map()
  testTubeMap = new Map()

  for (const r of (data ?? []) as TestRow[]) {
    const keys = [r.th, r.en, r.code, r.lis_code].filter((k): k is string => !!k)
    for (const key of keys) {
      const k = key.trim()
      if (r.tat && !testTargetMap.has(k)) {
        const tatVal = parseFloat(r.tat)
        if (!isNaN(tatVal)) testTargetMap.set(k, tatVal)
      }
      if (r.tube && !testTubeMap.has(k)) {
        testTubeMap.set(k, r.tube)
      }
    }
  }

  return { targetMap: testTargetMap, tubeMap: testTubeMap }
}

function resolveTarget(testName: string, map: Map<string, number>): number | null {
  const targets = testName
    .split(',')
    .map(t => map.get(t.trim()))
    .filter((v): v is number => v !== undefined)
  return targets.length > 0 ? Math.max(...targets) : null
}

function resolveIsBloodDraw(testName: string, tubeMap: Map<string, string>): boolean {
  const tubes = testName
    .split(',')
    .map(t => tubeMap.get(t.trim()) ?? null)
  return isPanelBloodDraw(tubes)
}

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

interface RawRow {
  hn: string
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

  const { targetMap, tubeMap } = await getTestMaps()

  // Split comma-separated test names into individual records (one row per test)
  const records = rows.flatMap((row) => {
    const tests = row.test_name.split(',').map(t => t.trim()).filter(Boolean)
    const effectiveTests = tests.length > 0 ? tests : [row.test_name]
    return effectiveTests.map(testName => {
      const target_minutes = row.priority === 'ด่วน' ? 30 : resolveTarget(testName, targetMap)
      const within_target = target_minutes !== null ? row.tat_minutes <= target_minutes : null
      const is_blood_draw = resolveIsBloodDraw(testName, tubeMap)
      return {
        upload_id,
        year: upload.year,
        month: upload.month,
        hn: row.hn || null,
        spcm_at: row.spcm_at,
        rslt_at: row.rslt_at,
        tat_minutes: row.tat_minutes,
        target_minutes,
        within_target,
        is_blood_draw,
        lab_section: row.lab_section,
        ward: row.ward,
        priority: row.priority,
        test_name: testName,
        spcm_hour: row.spcm_hour,
        spcm_dow: row.spcm_dow,
      }
    })
  })

  // Dedup within the chunk
  const seenKeys = new Set<string>()
  const deduped: typeof records = []
  for (const r of records) {
    const key = `${r.spcm_at}|${r.test_name}|${r.lab_section}`
    if (!seenKeys.has(key)) { seenKeys.add(key); deduped.push(r) }
  }

  // Dedup against earlier chunks of this upload
  const spcmAts = [...new Set(deduped.map(r => r.spcm_at))]
  let toInsert = deduped
  if (spcmAts.length > 0) {
    const { data: existing } = await supabaseAdmin
      .from('tat_records')
      .select('spcm_at, test_name, lab_section')
      .eq('upload_id', upload_id)
      .in('spcm_at', spcmAts)
    const existingKeys = new Set((existing ?? []).map(r => `${r.spcm_at}|${r.test_name}|${r.lab_section}`))
    toInsert = deduped.filter(r => !existingKeys.has(`${r.spcm_at}|${r.test_name}|${r.lab_section}`))
  }

  const skipped = records.length - toInsert.length

  let insertedCount = 0
  if (toInsert.length > 0) {
    const { data: inserted, error } = await supabaseAdmin
      .from('tat_records')
      .insert(toInsert)
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    insertedCount = inserted?.length ?? 0
  }

  let joined = false

  if (is_last_chunk) {
    const { count } = await supabaseAdmin
      .from('tat_records')
      .select('id', { count: 'exact', head: true })
      .eq('upload_id', upload_id)
    await supabaseAdmin
      .from('tat_uploads')
      .update({ row_count: count ?? 0 })
      .eq('id', upload_id)

    // Trigger rejoin if phlebotomy data exists for this month
    const { count: phlebCount } = await supabaseAdmin
      .from('phleb_uploads')
      .select('id', { count: 'exact', head: true })
      .eq('year', upload.year)
      .eq('month', upload.month)

    if ((phlebCount ?? 0) > 0) {
      const { error: joinErr } = await supabaseAdmin.rpc('rejoin_tat', { p_year: upload.year, p_month: upload.month })
      if (!joinErr) joined = true
    }
  }

  return NextResponse.json({ inserted: insertedCount, skipped, joined })
}
