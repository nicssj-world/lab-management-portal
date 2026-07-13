import assert from 'node:assert/strict'
import test from 'node:test'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key'
process.env.R2_ACCOUNT_ID ??= 'test-account'
process.env.R2_ACCESS_KEY_ID ??= 'test-access-key'
process.env.R2_SECRET_ACCESS_KEY ??= 'test-secret-key'
process.env.R2_BUCKET_NAME ??= 'test-bucket'

test('cleanup candidate isolation records a poisoned row and continues with a later row', async () => {
  const cleanupModule = await import('./set-upload-cleanup') as Record<string, unknown>
  assert.equal(typeof cleanupModule.runSetUploadCleanupCandidates, 'function')
  const runCandidates = cleanupModule.runSetUploadCleanupCandidates as (
    candidates: { id: string }[],
    processCandidate: (candidate: { id: string }, now: Date) => Promise<void>,
    now: () => Date,
  ) => Promise<{ attempted: number; succeeded: number; failures: { id: string; error: string }[] }>

  const attempted: string[] = []
  const timestamps = [new Date('2026-07-13T01:00:00.000Z'), new Date('2026-07-13T01:00:01.000Z')]
  const summary = await runCandidates(
    [{ id: 'poisoned' }, { id: 'healthy' }],
    async (candidate, now) => {
      attempted.push(`${candidate.id}@${now.toISOString()}`)
      if (candidate.id === 'poisoned') throw new Error('R2 delete failed')
    },
    () => timestamps.shift() ?? new Date('2026-07-13T01:00:02.000Z'),
  )

  assert.deepEqual(attempted, [
    'poisoned@2026-07-13T01:00:00.000Z',
    'healthy@2026-07-13T01:00:01.000Z',
  ])
  assert.deepEqual(summary, {
    attempted: 2,
    succeeded: 1,
    failures: [{ id: 'poisoned', error: 'R2 delete failed' }],
  })
})

test('set upload maintenance invokes pruning even when cleanup rejects', async () => {
  const cleanupModule = await import('./set-upload-cleanup') as Record<string, unknown>
  assert.equal(typeof cleanupModule.runSetUploadMaintenance, 'function')
  const runMaintenance = cleanupModule.runSetUploadMaintenance as (
    cleanup: () => Promise<unknown>,
    prune: () => Promise<unknown>,
  ) => Promise<PromiseSettledResult<unknown>[]>

  let pruned = false
  const results = await runMaintenance(
    () => { throw new Error('cleanup failed') },
    async () => { pruned = true },
  )

  assert.equal(pruned, true)
  assert.equal(results[0].status, 'rejected')
  assert.equal(results[1].status, 'fulfilled')
})
