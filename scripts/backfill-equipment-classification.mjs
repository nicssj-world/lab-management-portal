// For equipment whose cbh_code follows LAB-XX-NN, check whether its stored
// classification is one of the 19 known values (and whether it matches what
// the code itself implies).
// Run: npx tsx scripts/backfill-equipment-classification.mjs
import { getSupabaseServiceEnv } from './lib/env.mjs'
import { LAB_CODE_CLASSIFICATIONS } from '../lib/equipment-lab-code.ts'

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_KEY } = getSupabaseServiceEnv()

const KNOWN_VALUES = new Set(Object.values(LAB_CODE_CLASSIFICATIONS))

function classificationFromCode(code) {
  const match = String(code ?? '').trim().toUpperCase().match(/^LAB-([A-Z]{2})-([0-9]{2})(?:-|$)/)
  if (!match) return null
  return LAB_CODE_CLASSIFICATIONS[match[2]] ?? null
}

async function fetchAll() {
  let page = 0
  const rows = []
  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/equipment?select=id,cbh_code,classification,equipment_type&limit=1000&offset=${page * 1000}`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    )
    const batch = await res.json()
    if (!Array.isArray(batch) || batch.length === 0) break
    rows.push(...batch)
    if (batch.length < 1000) break
    page++
  }
  return rows
}

async function main() {
  const rows = await fetchAll()
  const labCoded = rows.filter(r => classificationFromCode(r.cbh_code) !== null)

  let notInDropdown = []
  let mismatchButKnown = []

  for (const row of labCoded) {
    const current = row.classification?.trim() || ''
    const impliedByCode = classificationFromCode(row.cbh_code)
    if (!current || !KNOWN_VALUES.has(current)) {
      notInDropdown.push({ ...row, current, impliedByCode })
    } else if (current !== impliedByCode) {
      mismatchButKnown.push({ ...row, current, impliedByCode })
    }
  }

  console.log(`Equipment with LAB-XX-NN code: ${labCoded.length} / ${rows.length}\n`)

  console.log(`Classification NOT one of the 19 dropdown values (${notInDropdown.length}):`)
  for (const r of notInDropdown) console.log(`  ${r.id}  ${r.cbh_code}  ${r.equipment_type}  classification="${r.current || '(blank)'}"  code implies="${r.impliedByCode}"`)

  console.log(`\nClassification IS one of the 19 values but disagrees with what the code implies (${mismatchButKnown.length}):`)
  for (const r of mismatchButKnown) console.log(`  ${r.id}  ${r.cbh_code}  ${r.equipment_type}  classification="${r.current}"  code implies="${r.impliedByCode}"`)
}

main()
