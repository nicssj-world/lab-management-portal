import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { isPanelBloodDraw } from '@/lib/tat/tube-classify'
import { rejoinTatBatch } from '@/lib/tat/rejoin-batch'
import { refreshLabWorkloadSummary } from '@/lib/workload/refresh-summary'
import { NextRequest, NextResponse } from 'next/server'

// Module-scope caches — populated once per function instance lifetime
let testTargetMap: Map<string, number> | null = null
let testUrgentTargetMap: Map<string, number> | null = null
let testTubeMap: Map<string, string> | null = null

interface TestRow {
  th: string
  en: string | null
  code: string
  lis_code: string | null
  tat: string | null
  tat_minutes: string | null
  urgent_tat_minutes: string | null
  tube: string | null
}

function parseTatTargetMinutes(value: string | null): number | null {
  if (!value) return null

  const raw = value.trim()
  const nums = raw.match(/\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) ?? []
  if (nums.length === 0) return null

  // For ranges such as "24-48 ชั่วโมง", use the upper bound as the allowed target.
  const n = Math.max(...nums)
  const normalized = raw.toLowerCase().replace(/\s+/g, '')

  if (normalized.includes('นาที')) return n
  if (
    normalized.includes('ชม')
    || normalized.includes('ช.ม')
    || normalized.includes('ชั่วโมง')
    || normalized.includes('hr')
    || normalized.includes('hour')
  ) return n * 60
  if (normalized.includes('วัน')) return n * 24 * 60

  return n
}

async function getTestMaps(): Promise<{ targetMap: Map<string, number>; urgentTargetMap: Map<string, number>; tubeMap: Map<string, string> }> {
  if (testTargetMap && testUrgentTargetMap && testTubeMap) {
    return { targetMap: testTargetMap, urgentTargetMap: testUrgentTargetMap, tubeMap: testTubeMap }
  }

  const { data } = await supabaseAdmin
    .from('tests')
    .select('th, en, code, lis_code, tat, tat_minutes, urgent_tat_minutes, tube')

  testTargetMap = new Map()
  testUrgentTargetMap = new Map()
  testTubeMap = new Map()

  for (const r of (data ?? []) as TestRow[]) {
    const keys = [r.th, r.en, r.code, r.lis_code].filter((k): k is string => !!k)
    for (const key of keys) {
      const k = key.trim()
      const normalTat = r.tat_minutes ?? r.tat
      if (normalTat && !testTargetMap.has(k)) {
        const tatVal = parseTatTargetMinutes(normalTat)
        if (tatVal !== null) testTargetMap.set(k, tatVal)
      }
      if (r.urgent_tat_minutes && !testUrgentTargetMap.has(k)) {
        const urgentTatVal = parseTatTargetMinutes(r.urgent_tat_minutes)
        if (urgentTatVal !== null) testUrgentTargetMap.set(k, urgentTatVal)
      }
      if (r.tube && !testTubeMap.has(k)) {
        testTubeMap.set(k, r.tube)
      }
    }
  }

  return { targetMap: testTargetMap, urgentTargetMap: testUrgentTargetMap, tubeMap: testTubeMap }
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
  ln: string
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

  const { targetMap, urgentTargetMap, tubeMap } = await getTestMaps()

  // Split comma-separated test names into individual records (one row per test)
  const records = rows.flatMap((row) => {
    const tests = row.test_name.split(',').map(t => t.trim()).filter(Boolean)
    const effectiveTests = tests.length > 0 ? tests : [row.test_name]
    return effectiveTests.map(testName => {
      const target_minutes = row.priority === 'ด่วน'
        ? (resolveTarget(testName, urgentTargetMap) ?? resolveTarget(testName, targetMap) ?? 30)
        : resolveTarget(testName, targetMap)
      const within_target = target_minutes !== null ? row.tat_minutes <= target_minutes : null
      const is_blood_draw = resolveIsBloodDraw(testName, tubeMap)
      return {
        upload_id,
        year: upload.year,
        month: upload.month,
        hn: row.hn || null,
        ln: row.ln || null,
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
        match_confidence: 'no_match',
      }
    })
  })

  // Dedup within the chunk
  const seenKeys = new Set<string>()
  const deduped: typeof records = []
  for (const r of records) {
    const key = `${r.ln ?? ''}|${r.hn ?? ''}|${r.spcm_at}|${r.test_name}|${r.lab_section}`
    if (!seenKeys.has(key)) { seenKeys.add(key); deduped.push(r) }
  }

  // Dedup against existing rows for this month. Re-upload normally clears the
  // month first; this still protects retry/double-submit scenarios.
  const spcmAts = [...new Set(deduped.map(r => r.spcm_at))]
  let toInsert = deduped
  if (spcmAts.length > 0) {
    const { data: existing } = await supabaseAdmin
      .from('tat_records')
      .select('ln, hn, spcm_at, test_name, lab_section')
      .eq('year', upload.year)
      .eq('month', upload.month)
      .in('spcm_at', spcmAts)
    const existingKeys = new Set((existing ?? []).map(r => `${r.ln ?? ''}|${r.hn ?? ''}|${r.spcm_at}|${r.test_name}|${r.lab_section}`))
    toInsert = deduped.filter(r => !existingKeys.has(`${r.ln ?? ''}|${r.hn ?? ''}|${r.spcm_at}|${r.test_name}|${r.lab_section}`))
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
    // Count total rows for this snapshot month.
    const { count } = await supabaseAdmin
      .from('tat_records')
      .select('id', { count: 'exact', head: true })
      .eq('year', upload.year)
      .eq('month', upload.month)
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
      await rejoinTatBatch(upload.year, upload.month)
      joined = true
    }

    await refreshLabWorkloadSummary(upload.year, upload.month)
  }

  return NextResponse.json({ inserted: insertedCount, skipped, joined })
}
