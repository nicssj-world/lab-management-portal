import assert from 'node:assert/strict'

async function main() {
const safety = await import('./safety').catch(() => null)
const logic = await import('./logic')

assert.ok(safety, 'safety task domain module exists')
assert.equal(typeof safety.fiscalYearForDate, 'function', 'fiscal year helper is exported')
assert.equal(safety.fiscalYearForDate('2026-09-30'), 2569)
assert.equal(safety.fiscalYearForDate('2026-10-01'), 2570)

assert.equal(typeof safety.nextRollingDueDate, 'function', 'rolling recurrence helper is exported')
assert.equal(safety.nextRollingDueDate('2026-08-09', 'day', 60), '2026-10-08')
assert.equal(safety.nextRollingDueDate('2026-08-09', 'day', 90), '2026-11-07')
assert.equal(safety.nextRollingDueDate('2026-08-09', 'year', 1), '2027-08-09')
assert.equal(safety.nextRollingDueDate('2024-02-29', 'year', 1), '2025-02-28')
assert.equal(safety.nextRollingDueDate('2026-01-31', 'month', 1), '2026-02-28')
assert.deepEqual(
  logic.generatePeriods({ id: 'day-20', templateId: 'fire', intervalUnit: 'month', intervalCount: 1, recurrenceMode: 'fixed_calendar', startsOn: '2026-07-21', endsOn: null, active: true }, '2026-08-01', '2026-10-20')
    .map(period => period.end),
  ['2026-08-20', '2026-09-20', '2026-10-20'],
  'fixed calendar task stays due on the 20th',
)

assert.equal(typeof safety.submissionStatus, 'function', 'submission workflow helper is exported')
assert.equal(safety.submissionStatus('none'), 'completed')
assert.equal(safety.submissionStatus('required'), 'pending_review')
assert.equal(safety.canApproveTask('edit', 'editor', null), true)
assert.equal(safety.canApproveTask('view', 'approver', 'approver'), true)
assert.equal(safety.canApproveTask('view', 'viewer', 'approver'), false)

const requirements = [
  { id: 'form', required: true, minimumFiles: 1 },
  { id: 'photo', required: true, minimumFiles: 2 },
  { id: 'note', required: false, minimumFiles: 1 },
]
assert.deepEqual(
  safety.missingEvidenceRequirements(requirements, [
    { requirementId: 'form' },
    { requirementId: 'photo' },
  ]),
  ['photo'],
)
assert.deepEqual(
  safety.missingEvidenceRequirements(requirements, [
    { requirementId: 'form' },
    { requirementId: 'photo' },
    { requirementId: 'photo' },
  ]),
  [],
)

assert.deepEqual(
  safety.certificateRenewalWindow({ expiresOn: '2026-11-07', noExpiry: false }, '2026-08-09'),
  { shouldCreate: true, daysRemaining: 90, urgency: 'normal', reminderStage: 90 },
)
assert.deepEqual(
  safety.certificateRenewalWindow({ expiresOn: '2026-09-08', noExpiry: false }, '2026-08-09'),
  { shouldCreate: true, daysRemaining: 30, urgency: 'due-soon', reminderStage: 30 },
)
assert.deepEqual(
  safety.certificateRenewalWindow({ expiresOn: '2026-08-08', noExpiry: false }, '2026-08-09'),
  { shouldCreate: true, daysRemaining: -1, urgency: 'overdue', reminderStage: 'overdue' },
)
assert.deepEqual(
  safety.certificateRenewalWindow({ expiresOn: null, noExpiry: true }, '2026-08-09'),
  { shouldCreate: false, daysRemaining: null, urgency: 'none', reminderStage: null },
)

assert.equal(typeof safety.validateSafetyEvidenceMetadata, 'function', 'evidence validation is exported')
for (const input of [
  ['report.pdf', 'application/pdf'],
  ['photo.jpg', 'image/jpeg'],
  ['photo.png', 'image/png'],
  ['result.xls', 'application/vnd.ms-excel'],
  ['result.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
] as const) {
  assert.deepEqual(safety.validateSafetyEvidenceMetadata(input[0], input[1], 1024), { ok: true })
}
assert.equal(safety.validateSafetyEvidenceMetadata('script.exe', 'application/octet-stream', 1024).ok, false)
assert.equal(safety.validateSafetyEvidenceMetadata('large.pdf', 'application/pdf', 20 * 1024 * 1024 + 1).ok, false)

console.log('lib/quality-tasks/safety.test.ts: all assertions passed')
}

void main()
