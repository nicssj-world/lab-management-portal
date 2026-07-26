import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { LAB_ASSEMBLY_POINTS, LAB_SAFETY_EQUIPMENT } from '../lib/lab-map/safety-assets'
import { manifestHashForSnapshots } from '../lib/lab-map/release'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const apply = process.argv.includes('--apply')

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: releases, error } = await db
  .from('lab_map_versions')
  .select('id, version_code, asset_snapshot, assembly_point_snapshot')

if (error) throw error

const legacyReleases = (releases ?? []).filter(release =>
  !Array.isArray(release.asset_snapshot) || release.asset_snapshot.length === 0
  || !Array.isArray(release.assembly_point_snapshot) || release.assembly_point_snapshot.length === 0,
)

console.log(`${apply ? 'Applying' : 'Dry run:'} ${legacyReleases.length} legacy release(s) need snapshots`)

if (!apply) {
  console.log('Run again with --apply after reviewing the target count.')
  process.exit(0)
}

for (const release of legacyReleases) {
  const assetSnapshot = (Array.isArray(release.asset_snapshot) && release.asset_snapshot.length > 0
    ? release.asset_snapshot : LAB_SAFETY_EQUIPMENT) as typeof LAB_SAFETY_EQUIPMENT
  const assemblyPointSnapshot = (Array.isArray(release.assembly_point_snapshot) && release.assembly_point_snapshot.length > 0
    ? release.assembly_point_snapshot : LAB_ASSEMBLY_POINTS) as typeof LAB_ASSEMBLY_POINTS
  const { error: updateError } = await db
    .from('lab_map_versions')
    .update({
      asset_snapshot: assetSnapshot,
      assembly_point_snapshot: assemblyPointSnapshot,
      manifest_hash: manifestHashForSnapshots(assetSnapshot, assemblyPointSnapshot),
    })
    .eq('id', release.id)

  if (updateError) throw new Error(`${release.version_code}: ${updateError.message}`)
  console.log(`Backfilled ${release.version_code}`)
}
