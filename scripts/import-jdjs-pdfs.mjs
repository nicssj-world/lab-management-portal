import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

dotenv.config({ path: '.env.local', quiet: true })

const DEFAULT_DIR = 'C:/Users/nicss/Desktop/JDJS'
const STAFF_BUCKET = 'staff-files'
const DEFAULT_EFFECTIVE_DATE = '2026-03-09'
const DEFAULT_APPROVER_NAME = 'นางเกศสิรี กรสิทธิกุล'
const DEFAULT_APPROVER_POSITION = 'รองผู้อำนวยการด้านพัฒนาระบบบริการและสนับสนุนบริการสุขภาพ'

const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const replaceExisting = args.has('--replace-existing')
const dirArg = process.argv.find((arg) => arg.startsWith('--dir='))
const sourceDir = path.resolve(dirArg ? dirArg.slice('--dir='.length) : DEFAULT_DIR)

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

const supabase = createClient(
  requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
  requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false } },
)

const titleWords = [
  'นางสาว',
  'นาง',
  'นาย',
  'น.ส.',
  'นส.',
  'นส',
  'ดร.',
  'ดร',
  'คุณ',
]

function stripTitle(value) {
  for (const title of titleWords) {
    if (value.startsWith(title)) return value.slice(title.length)
  }
  return value
}

function normalizeName(value) {
  return stripTitle((value ?? '')
    .normalize('NFC')
    .replace(/\.pdf$/i, '')
    .replace(/[\s._\-()[\]{}]+/g, '')
    .replace(/์/g, '')
    .trim())
}

function levenshtein(a, b) {
  const left = [...a]
  const right = [...b]
  const rows = left.length
  const cols = right.length
  const dp = Array.from({ length: rows + 1 }, () => Array(cols + 1).fill(0))

  for (let i = 0; i <= rows; i += 1) dp[i][0] = i
  for (let j = 0; j <= cols; j += 1) dp[0][j] = j

  for (let i = 1; i <= rows; i += 1) {
    for (let j = 1; j <= cols; j += 1) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      )
    }
  }

  return dp[rows][cols]
}

function matchFile(file, people) {
  const key = normalizeName(file)
  const ranked = people
    .map((person) => {
      const distance = levenshtein(key, person.key)
      const maxLength = Math.max([...key].length, [...person.key].length) || 1
      return { person, distance, score: 1 - distance / maxLength }
    })
    .sort((a, b) => b.score - a.score || a.distance - b.distance)

  const best = ranked[0]
  const second = ranked[1]
  const exact = best.person.key === key
  const confident = exact || (best.score >= 0.84 && (!second || best.score - second.score >= 0.08))

  return {
    file,
    path: path.join(sourceDir, file),
    profile: best.person,
    score: Number(best.score.toFixed(3)),
    second: second ? `${second.person.name} (${second.score.toFixed(3)})` : '',
    status: confident ? 'READY' : 'REVIEW',
  }
}

async function ensureStaffBucket() {
  const { data, error } = await supabase.storage.listBuckets()
  if (error) throw error
  if (!data?.some((bucket) => bucket.id === STAFF_BUCKET)) {
    const created = await supabase.storage.createBucket(STAFF_BUCKET, { public: false })
    if (created.error) throw created.error
  }
}

async function uploadPdf(row, index) {
  const buffer = fs.readFileSync(row.path)
  const storagePath = `${row.profile.id}/jdjs/${Date.now()}-${index}.pdf`
  const { error } = await supabase.storage
    .from(STAFF_BUCKET)
    .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true })
  if (error) throw error
  return storagePath
}

async function saveJdjs(row, fileUrl, existing) {
  const payload = {
    file_url: fileUrl,
    effective_date: DEFAULT_EFFECTIVE_DATE,
    approver_name: DEFAULT_APPROVER_NAME,
    approver_position: DEFAULT_APPROVER_POSITION,
    status: 'Active',
  }

  if (existing) {
    const { error } = await supabase
      .from('staff_jd')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error?.message?.includes('approver_position')) {
      const { approver_position, ...legacyPayload } = payload
      void approver_position
      const fallback = await supabase
        .from('staff_jd')
        .update({ ...legacyPayload, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (fallback.error) throw fallback.error
      return 'updated'
    }
    if (error) throw error
    return 'updated'
  }

  const { error } = await supabase
    .from('staff_jd')
    .insert({
      ...payload,
      profile_id: row.profile.id,
    })
  if (error?.message?.includes('approver_position')) {
    const { approver_position, ...legacyPayload } = payload
    void approver_position
    const fallback = await supabase
      .from('staff_jd')
      .insert({
        ...legacyPayload,
        profile_id: row.profile.id,
      })
    if (fallback.error) throw fallback.error
    return 'created'
  }
  if (error) throw error
  return 'created'
}

async function main() {
  if (!fs.existsSync(sourceDir)) throw new Error(`Folder not found: ${sourceDir}`)

  const files = fs.readdirSync(sourceDir).filter((file) => file.toLowerCase().endsWith('.pdf'))
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id,name,ephis_id,role,deleted_at')
    .is('deleted_at', null)
    .order('name')
  if (profileError) throw profileError

  const { data: existingJd, error: jdError } = await supabase
    .from('staff_jd')
    .select('id,profile_id,file_url,status,created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (jdError) throw jdError

  const people = profiles.map((profile) => ({ ...profile, key: normalizeName(profile.name) }))
  const existingByProfile = new Map()
  for (const jd of existingJd ?? []) {
    if (!existingByProfile.has(jd.profile_id)) existingByProfile.set(jd.profile_id, jd)
  }

  const rows = files.map((file) => matchFile(file, people))
  const ready = rows.filter((row) => row.status === 'READY')
  const review = rows.filter((row) => row.status === 'REVIEW')
  const duplicateProfileIds = ready
    .map((row) => row.profile.id)
    .filter((profileId, index, all) => all.indexOf(profileId) !== index)

  console.log(`Source: ${sourceDir}`)
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`)
  console.log(`PDF files: ${files.length}`)
  console.log(`Profiles: ${profiles.length}`)
  console.log(`Ready: ${ready.length}`)
  console.log(`Review: ${review.length}`)
  console.log(`Duplicate ready matches: ${new Set(duplicateProfileIds).size}`)

  if (review.length > 0) {
    console.log('\nNeed review:')
    for (const row of review) {
      console.log(`- ${row.file} -> ${row.profile.name} score=${row.score} second=${row.second}`)
    }
  }

  const matchedReadyProfileIds = new Set(ready.map((row) => row.profile.id))
  const withoutReady = people.filter((person) => !matchedReadyProfileIds.has(person.id))
  if (withoutReady.length > 0) {
    console.log('\nProfiles without ready match:')
    for (const person of withoutReady) console.log(`- ${person.name}`)
  }

  if (!apply) {
    console.log('\nDry-run only. Add --apply to upload READY files. Add --replace-existing to overwrite existing JDJS file links.')
    return
  }

  if (duplicateProfileIds.length > 0) {
    throw new Error('Resolve duplicate matches before applying.')
  }

  if (review.length > 0) {
    console.log('\nReview rows will be skipped.')
  }

  await ensureStaffBucket()

  let created = 0
  let updated = 0
  let skipped = 0
  for (const [index, row] of ready.entries()) {
    const existing = existingByProfile.get(row.profile.id)
    if (existing?.file_url && !replaceExisting) {
      skipped += 1
      console.log(`SKIP existing: ${row.profile.name} <- ${row.file}`)
      continue
    }

    const fileUrl = await uploadPdf(row, index)
    const action = await saveJdjs(row, fileUrl, existing)
    if (action === 'created') created += 1
    if (action === 'updated') updated += 1
    console.log(`${action.toUpperCase()}: ${row.profile.name} <- ${row.file}`)
  }

  console.log(`\nDone. created=${created} updated=${updated} skipped=${skipped}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
