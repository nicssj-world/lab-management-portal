// Sweep stamped uncontrolled copies whose document row no longer exists.
//
// The purge route now deletes these alongside the document, but copies created before
// that fix have no owner and nothing else references them. Safe to run at any time —
// it only touches keys under documents/uncontrolled/ whose id is absent from `documents`.
//
//   npx tsx --env-file=.env.local scripts/purge-orphan-uncontrolled.ts          # dry run
//   npx tsx --env-file=.env.local scripts/purge-orphan-uncontrolled.ts --apply  # delete
import { DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import { r2, R2_BUCKET } from '@/lib/r2/client'

const PREFIX = 'documents/uncontrolled/'
const apply = process.argv.includes('--apply')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  const objects: { key: string; size: number }[] = []
  let token: string | undefined
  do {
    const res = await r2.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET, Prefix: PREFIX, ContinuationToken: token,
    }))
    for (const o of res.Contents ?? []) objects.push({ key: o.Key!, size: o.Size ?? 0 })
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)

  const ids = Array.from(new Set(objects.map((o) => o.key.slice(PREFIX.length).split('/')[0]).filter(Boolean)))
  if (ids.length === 0) {
    console.log('no derivatives found')
    return
  }

  // No deleted_at filter on purpose: a soft-deleted document still owns its files.
  const { data, error } = await supabase.from('documents').select('id').in('id', ids)
  if (error) {
    console.error('lookup failed, aborting without deleting anything:', error.message)
    process.exitCode = 1
    return
  }
  const live = new Set((data ?? []).map((d) => d.id as string))

  const orphans = objects.filter((o) => !live.has(o.key.slice(PREFIX.length).split('/')[0]))
  const bytes = orphans.reduce((n, o) => n + o.size, 0)

  console.log(`derivatives: ${objects.length} across ${ids.length} documents`)
  console.log(`orphaned:    ${orphans.length} (${(bytes / 1024 / 1024).toFixed(1)} MB)`)
  for (const o of orphans) console.log(`  ${o.key}`)

  if (orphans.length === 0) return
  if (!apply) {
    console.log('\ndry run — re-run with --apply to delete')
    return
  }

  for (const o of orphans) {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: o.key }))
    console.log(`deleted ${o.key}`)
  }
  console.log(`\ndone — removed ${orphans.length} object(s)`)
}

main()
