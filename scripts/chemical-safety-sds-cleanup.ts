// ตรวจและผูก SDS legacy ที่พิสูจน์ได้ว่าเป็นของห้องสารเคมีกับ room holding
//
//   npm run chemical-safety:cleanup-sds            # dry-run (ค่าเริ่มต้น)
//   npm run chemical-safety:cleanup-sds -- --apply # เขียนเฉพาะ deterministic rows

import { config } from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  buildSdsCleanupPlan,
  type SdsCleanupDepartmentLinkRow,
  type SdsCleanupHoldingRow,
  type SdsCleanupProductRow,
  type SdsCleanupVersionRow,
} from '../lib/chemical-safety/sds-cleanup'

config({ path: '.env.local', override: false })
config({ path: '.env', override: false })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRoleKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

const apply = process.argv.includes('--apply')
const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function assertResult(result: { error: unknown }, operation: string): void {
  if (!result.error) return
  const message = typeof result.error === 'object' && result.error && 'message' in result.error
    ? String(result.error.message)
    : String(result.error)
  throw new Error(`${operation} failed: ${message}`)
}

async function loadRows(client: SupabaseClient) {
  const [versions, holdings, links, products] = await Promise.all([
    client
      .from('chemical_sds_versions')
      .select('id, product_id, source_holding_id, status, file_id'),
    client
      .from('chemical_inventory_holdings')
      .select('id, product_id, storage_scope'),
    client
      .from('chemical_department_chemical_links')
      .select('sds_version_id, holding_id'),
    client
      .from('chemical_products')
      .select('id, canonical_name'),
  ])
  assertResult(versions, 'load chemical_sds_versions')
  assertResult(holdings, 'load chemical_inventory_holdings')
  assertResult(links, 'load chemical_department_chemical_links')
  assertResult(products, 'load chemical_products')

  return {
    versions: (versions.data ?? []) as SdsCleanupVersionRow[],
    holdings: (holdings.data ?? []) as SdsCleanupHoldingRow[],
    departmentLinks: (links.data ?? []) as SdsCleanupDepartmentLinkRow[],
    products: (products.data ?? []) as SdsCleanupProductRow[],
  }
}

function printPlan(
  plan: ReturnType<typeof buildSdsCleanupPlan>,
  totals: { versions: number; holdings: number; links: number },
) {
  console.log(`mode: ${apply ? 'apply' : 'dry-run'}`)
  console.log(`chemical_sds_versions: ${totals.versions}`)
  console.log(`chemical_inventory_holdings: ${totals.holdings}`)
  console.log(`chemical_department_chemical_links: ${totals.links}`)
  console.log(`resolved room: ${plan.resolved.room}`)
  console.log(`resolved department: ${plan.resolved.department}`)
  console.log(`planned room assignments: ${plan.assignments.length}`)
  console.log(`ambiguous: ${plan.ambiguous.length}`)
  console.log(`invariant errors: ${plan.errors.length}`)

  if (plan.assignments.length > 0) {
    console.log('planned assignments:')
    for (const assignment of plan.assignments) {
      console.log(`  ${assignment.versionId} | ${assignment.productName} | holding ${assignment.holdingId} | ${assignment.status ?? 'unknown'}`)
    }
  }
  if (plan.ambiguous.length > 0) {
    console.log('ambiguous rows (not changed):')
    for (const row of plan.ambiguous) {
      console.log(`  ${row.versionId} | ${row.productName} | ${row.reason} | holdings ${row.holdingIds.join(', ') || '(none)'}`)
    }
  }
  if (plan.errors.length > 0) {
    console.log('invariant errors:')
    for (const error of plan.errors) console.log(`  ${error}`)
  }
}

async function applyAssignments(
  client: SupabaseClient,
  plan: ReturnType<typeof buildSdsCleanupPlan>,
  versions: SdsCleanupVersionRow[],
) {
  if (plan.errors.length > 0) throw new Error('cleanup stopped because invariant errors were found')

  const versionById = new Map(versions.map(version => [version.id, version]))
  let applied = 0
  for (const assignment of plan.assignments) {
    const before = versionById.get(assignment.versionId)
    if (!before) throw new Error(`cleanup version disappeared: ${assignment.versionId}`)

    const updated = await client
      .from('chemical_sds_versions')
      .update({ source_holding_id: assignment.holdingId })
      .eq('id', assignment.versionId)
      .is('source_holding_id', null)
      .select('id, product_id, source_holding_id, status, file_id')
      .single()
    assertResult(updated, `update SDS ${assignment.versionId}`)

    const audit = await client.from('audit_log').insert({
      action: 'chemical_safety.sds.cleanup_assign_room_holding',
      user_id: null,
      target: assignment.versionId,
      detail: JSON.stringify({
        before: {
          id: before.id,
          product_id: before.product_id,
          source_holding_id: before.source_holding_id,
          status: before.status ?? null,
          file_id: before.file_id ?? null,
        },
        after: updated.data,
        reason: assignment.reason,
        script: 'scripts/chemical-safety-sds-cleanup.ts',
      }),
    })
    assertResult(audit, `audit SDS ${assignment.versionId}`)
    applied += 1
  }
  console.log(`applied: ${applied}`)
}

async function main() {
  const rows = await loadRows(supabase)
  const plan = buildSdsCleanupPlan(rows)
  printPlan(plan, {
    versions: rows.versions.length,
    holdings: rows.holdings.length,
    links: rows.departmentLinks.length,
  })

  if (!apply) {
    console.log('dry-run complete — re-run with --apply to write deterministic room assignments')
    return
  }
  await applyAssignments(supabase, plan, rows.versions)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
