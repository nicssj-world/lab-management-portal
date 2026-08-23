import assert from 'node:assert/strict'

async function main() {
  const loaded = await import('./evacuation').catch((error: unknown) => {
    assert.fail(`ต้องมีโมดูล evacuation ก่อนจึงจะตรวจ domain ได้: ${error instanceof Error ? error.message : String(error)}`)
  })

const {
  calculateEvacuationMetrics,
  missingEvacuationEvidence,
  validateEvacuationDrillSession,
  validateEvacuationPlanForPublish,
} = loaded

const verifiedAssembly = {
  id: 'assembly-1',
  code: 'assembly-front-admin',
  nameTh: 'หน้าอาคารอำนวยการ',
  pointType: 'assembly' as const,
  latitude: 13.756331,
  longitude: 100.501762,
  positionStatus: 'verified' as const,
}

const exits = [
  { code: 'exit-3a', status: 'open' as const },
  { code: 'exit-3b', status: 'open' as const },
]

const basePlan = {
  reportPointId: verifiedAssembly.id,
  headcountResponsible: 'LSO / ผู้แทน',
  assignments: [
    { scopeCode: 'central-lab-left', routeVariant: 'primary' as const, routeCode: 'evacuation-central-3a', exitCode: 'exit-3a', assemblyPointId: verifiedAssembly.id },
    { scopeCode: 'central-lab-left', routeVariant: 'alternate' as const, routeCode: 'evacuation-central-3b', exitCode: 'exit-3b', assemblyPointId: verifiedAssembly.id },
  ],
}

assert.deepEqual(validateEvacuationPlanForPublish({ plan: basePlan, assemblyPoints: [verifiedAssembly], exits }), { ok: true })
const routeMismatch = validateEvacuationPlanForPublish({
  plan: basePlan,
  assemblyPoints: [verifiedAssembly],
  exits,
  availableRoutes: [
    { code: 'evacuation-central-3a', fromStationCode: 'central-corridor', variant: 'primary', destinationCode: 'exit-3a' },
    { code: 'evacuation-central-3b', fromStationCode: 'central-corridor', variant: 'alternate', destinationCode: 'exit-3b' },
  ],
})
assert.equal(routeMismatch.ok, false)
if (!routeMismatch.ok) assert.ok(routeMismatch.errors.some(error => error.includes('ไม่ตรงกับพื้นที่/ทางออก')))

const blocked = validateEvacuationPlanForPublish({
  plan: {
    ...basePlan,
    reportPointId: null,
    headcountResponsible: '',
    assignments: [{ ...basePlan.assignments[0], exitCode: 'exit-locked' }],
  },
  assemblyPoints: [{ ...verifiedAssembly, positionStatus: 'unverified' }],
  exits: [{ code: 'exit-locked', status: 'permanently_locked' }],
})
assert.equal(blocked.ok, false)
if (!blocked.ok) {
  assert.deepEqual([...blocked.errors].sort(), [
    'ต้องกำหนดจุดรายงานตัว',
    'ต้องกำหนดผู้รับผิดชอบการนับคน/รายงานตัว',
    'ต้องมีทางออกหลักและทางออกสำรองสำหรับทุกพื้นที่',
    'จุดปลายทางต้องยืนยันตำแหน่งและมีพิกัด GPS: central-lab-left',
    'ทางออก exit-locked ถูกล็อกถาวรและใช้ในแผนอพยพไม่ได้',
  ].sort())
}

assert.deepEqual(calculateEvacuationMetrics([
  { status: 'completed' as const, durationSeconds: 240, compliancePercent: 100, headcountComplete: true },
  { status: 'completed' as const, durationSeconds: 360, compliancePercent: 80, headcountComplete: false },
  { status: 'planned' as const, durationSeconds: null, compliancePercent: null, headcountComplete: null },
]), {
  completedRate: 67,
  averageDurationSeconds: 300,
  complianceRate: 90,
  headcountReadyRate: 50,
})

assert.deepEqual(
  missingEvacuationEvidence(
    [
      { id: 'req-plan', evidenceKind: 'plan', label: 'แผน', required: true, minimumFiles: 1 },
      { id: 'req-attendance', evidenceKind: 'attendance', label: 'ผู้เข้าร่วม', required: true, minimumFiles: 1 },
      { id: 'req-photo', evidenceKind: 'photo', label: 'ภาพ', required: true, minimumFiles: 2 },
    ],
    [
      { requirementId: 'req-plan' },
      { requirementId: 'req-photo' },
    ],
  ),
  [
    { id: 'req-attendance', evidenceKind: 'attendance', label: 'ผู้เข้าร่วม', minimumFiles: 1, attachedCount: 0 },
    { id: 'req-photo', evidenceKind: 'photo', label: 'ภาพ', minimumFiles: 2, attachedCount: 1 },
  ],
)

assert.deepEqual(validateEvacuationDrillSession({
  status: 'completed', startedAt: null, endedAt: null, reportPointId: null,
  evaluation: null, expectedParticipants: 2, actualParticipants: 3,
  expectedHeadcount: 2, checkedHeadcount: 0, missingHeadcount: 0,
}), [
  'ผู้เข้าร่วมจริงต้องไม่มากกว่าผู้เข้าร่วมคาดหมาย',
  'ผลการซ้อมที่เสร็จสิ้นต้องมีเวลาเริ่มและเวลาสิ้นสุด',
  'ผลการซ้อมที่เสร็จสิ้นต้องมีจุดรายงานตัว',
  'ผลการซ้อมที่เสร็จสิ้นต้องมีผลประเมิน',
])

  console.log('evacuation domain tests passed')
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
