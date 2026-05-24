import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import * as XLSX from 'xlsx'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id,role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

const REQUIRED_COLUMNS = [
  'spcmdate', 'spcmtime', 'ln', 'dspname', 'hn', 'an',
  'spcmnotedt', 'labspcmnm', 'itemno', 'name', 'cnclspcmdt',
  'cnclstfnm', 'cncldatetime', 'name_1', 'dspname_2', 'hptnm',
]

// Thai Buddhist Era years are > 2500; subtract 543 to get CE
function beToce(year: number): number {
  return year > 2500 ? year - 543 : year
}

// Excel serial datetime (integer=date, fraction=time) → ISO string for timestamptz
function parseDateTime(val: unknown): string | null {
  if (!val) return null
  if (typeof val === 'number') {
    const ms = Math.round((val - 25569) * 86400 * 1000)
    const d = new Date(ms)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  const str = String(val).trim()
  if (!str) return null
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function parseDate(val: unknown): string | null {
  if (!val) return null
  if (typeof val === 'number') {
    // Convert Excel serial date to YYYY-MM-DD
    const jsDate = new Date(Math.round((val - 25569) * 86400 * 1000))
    if (isNaN(jsDate.getTime())) return null
    const y = beToce(jsDate.getUTCFullYear())
    const m = String(jsDate.getUTCMonth() + 1).padStart(2, '0')
    const d = String(jsDate.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const str = String(val).trim()
  // Try YYYY-MM-DD (handles both CE and BE)
  const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (ymd) return `${beToce(parseInt(ymd[1]))}-${ymd[2]}-${ymd[3]}`
  // Try DD/MM/YYYY or DD-MM-YYYY (handles both CE and BE)
  const dmy = str.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/)
  if (dmy) return `${beToce(parseInt(dmy[3]))}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  return null
}

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const perms = await getRolePermissions(actor.role)
  if (perms['ความเสี่ยง / Rejection'] !== 'edit') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !['xls', 'xlsx', 'txt'].includes(ext)) {
    return NextResponse.json({ error: 'รองรับเฉพาะ .xls / .xlsx / .txt' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  let rows: Record<string, unknown>[]

  if (ext === 'txt') {
    // Parse tab-delimited or comma-delimited text file
    const text = new TextDecoder('utf-8').decode(buffer)
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) {
      return NextResponse.json({ error: 'File contains no data rows' }, { status: 400 })
    }
    // Auto-detect delimiter: prefer tab, fall back to comma
    const delim = lines[0].includes('\t') ? '\t' : ','
    const headers = lines[0].split(delim).map(h => h.trim().replace(/^["']|["']$/g, ''))
    rows = lines.slice(1).map(line => {
      const vals = line.split(delim).map(v => v.trim().replace(/^["']|["']$/g, ''))
      const row: Record<string, unknown> = {}
      headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
      return row
    })
  } else {
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: false })
    const ws = wb.Sheets[wb.SheetNames[0]]
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: true, defval: '' })
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'File contains no data rows' }, { status: 400 })
  }

  // Normalise column names (lowercase, trim)
  const normalised = rows.map(row => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      out[k.toLowerCase().trim()] = v
    }
    return out
  })

  // Validate required columns exist
  const firstRow = normalised[0]
  const missing = REQUIRED_COLUMNS.filter(c => !(c in firstRow))
  if (missing.length > 0) {
    return NextResponse.json({ error: `Missing columns: ${missing.join(', ')}` }, { status: 400 })
  }

  // Detect data_month via majority vote across all rows
  const monthCount: Record<string, number> = {}
  for (const r of normalised) {
    const d = parseDate(r['spcmdate'])
    if (d && d.length >= 7) {
      const ym = d.slice(0, 7)
      monthCount[ym] = (monthCount[ym] ?? 0) + 1
    }
  }
  const dataMonth = Object.keys(monthCount).length > 0
    ? Object.entries(monthCount).sort((a, b) => b[1] - a[1])[0][0]
    : null

  // Map rows to insert objects
  const mapped = normalised
    .filter(r => r['ln'] && String(r['ln']).trim())
    .map(r => ({
      spcmdate:       parseDate(r['spcmdate']),
      spcmtime:       r['spcmtime'] ? String(r['spcmtime']).trim() : null,
      ln:             String(r['ln']).trim(),
      dspname:        r['dspname'] ? String(r['dspname']).trim() : null,
      hn:             r['hn']      ? String(r['hn']).trim()      : null,
      an:             r['an']      ? String(r['an']).trim()      : null,
      spcmnotedt:     r['spcmnotedt']  ? String(r['spcmnotedt']).trim()  : null,
      labspcmnm:      r['labspcmnm']   ? String(r['labspcmnm']).trim()   : null,
      itemno:         r['itemno']      ? parseInt(String(r['itemno']))    : 1,
      reject:         r['name']        ? String(r['name']).trim()         : null,
      reason:         r['cnclspcmdt']  ? String(r['cnclspcmdt']).trim()  : null,
      cnclstfnm:      r['cnclstfnm']   ? String(r['cnclstfnm']).trim()   : null,
      cncldatetime:   parseDateTime(r['cncldatetime']),
      work:           r['name_1']      ? String(r['name_1']).trim()      : null,
      ward:           r['dspname_2']   ? String(r['dspname_2']).trim()   : null,
      hptnm:          r['hptnm']       ? String(r['hptnm']).trim()       : null,
    }))
    .filter(r => r.spcmdate && !isNaN(r.itemno))

  // Deduplicate within the file itself by (ln, itemno) — first occurrence wins
  const seenKeys = new Set<string>()
  const toInsert = mapped.filter(r => {
    const key = `${r.ln}|${r.itemno}`
    if (seenKeys.has(key)) return false
    seenKeys.add(key)
    return true
  })
  const inFileDups = mapped.length - toInsert.length

  const errors: string[] = []
  let inserted = 0

  for (let i = 0; i < toInsert.length; i += 200) {
    const batch = toInsert.slice(i, i + 200)
    // ON CONFLICT (ln, itemno) DO NOTHING — skips rows already in DB
    const { error, data: upserted } = await supabaseAdmin
      .from('rejection_logs')
      .upsert(batch, { onConflict: 'ln,itemno', ignoreDuplicates: true })
      .select('id')

    if (error) {
      errors.push(error.message)
    } else {
      inserted += upserted?.length ?? 0
    }
  }

  // skipped = in-file dups + existing-in-DB dups
  const skippedDb   = toInsert.length - inserted
  const skipped     = inFileDups + skippedDb
  const total       = mapped.length

  // Record upload history (total = all rows from file before any dedup)
  await supabaseAdmin
    .from('rejection_uploads')
    .insert({
      filename:    file.name,
      data_month:  dataMonth,
      total_rows:  total,
      inserted,
      skipped,
      uploaded_by: actor.id,
    })
    .then(undefined, () => {})

  return NextResponse.json({ inserted, skipped, skipped_in_file: inFileDups, skipped_in_db: skippedDb, total, errors, data_month: dataMonth })
}
