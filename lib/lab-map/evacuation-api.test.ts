import assert from 'node:assert/strict'

async function main() {
  const loaded = await import('./evacuation-api').catch((error: unknown) => {
    assert.fail(`ต้องมี schema ของ evacuation API ก่อน: ${error instanceof Error ? error.message : String(error)}`)
  })

  const validPlan = loaded.createEvacuationPlanSchema.safeParse({
    planCode: 'LAB-EVAC', versionCode: 'EVAC-2569-01', mapReleaseId: '11111111-1111-4111-8111-111111111111',
    effectiveDate: '2026-08-23', reviewDueDate: '2027-08-23', reportPointId: '22222222-2222-4222-8222-222222222222',
    headcountResponsible: 'LSO', notes: null,
    reviewTask: { instanceId: '33333333-3333-4333-8333-333333333333' },
    assignments: [
      { scopeType: 'space', scopeCode: 'central-lab-left', exitCode: 'exit-3a', routeVariant: 'primary', assemblyPointId: '22222222-2222-4222-8222-222222222222' },
      { scopeType: 'space', scopeCode: 'central-lab-left', exitCode: 'exit-3b', routeVariant: 'alternate', assemblyPointId: '22222222-2222-4222-8222-222222222222' },
    ],
  })
  assert.equal(validPlan.success, true)

  const invalidSession = loaded.createDrillSessionSchema.safeParse({
    kind: 'session', cycleId: 'not-a-uuid', scenario: '', expectedParticipants: -1,
  })
  assert.equal(invalidSession.success, false)
  const invalidHeadcount = loaded.createDrillSessionSchema.safeParse({
    kind: 'session', cycleId: '00000000-0000-0000-0000-000000000001', scenario: 'ซ้อม', expectedHeadcount: 10, checkedHeadcount: 8, missingHeadcount: 3,
  })
  assert.equal(invalidHeadcount.success, false)
  const missingExpectedHeadcount = loaded.createDrillSessionSchema.safeParse({
    kind: 'session', cycleId: '00000000-0000-0000-0000-000000000001', scenario: 'ซ้อม', expectedHeadcount: 0, checkedHeadcount: 1,
  })
  assert.equal(missingExpectedHeadcount.success, false)

  assert.equal(loaded.evacuationPlanTransitionSchema.safeParse({ action: 'publish' }).success, true)
  assert.equal(loaded.evacuationPlanTransitionSchema.safeParse({ action: 'delete' }).success, false)
  console.log('evacuation API schema tests passed')
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
