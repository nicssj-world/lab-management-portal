import assert from 'node:assert/strict'
import { projectEvacuationTask } from './evacuation'

async function main() {
  const task = projectEvacuationTask({
    key: 'CBH-ST-17:2026', instanceId: 'task-17', scheduleId: 'schedule-17', periodStart: '2026-08-01',
    periodLabel: 'สิงหาคม 2569', effectiveDueDate: '2026-08-31', status: 'pending_review', attachments: [
      { id: 'file-1', instanceId: 'task-17', requirementId: 'req-plan', evidenceKind: 'plan', fileName: 'plan.pdf', contentType: 'application/pdf', sizeBytes: 10, uploadedBy: 'user-1', uploadedAt: '2026-08-20T00:00:00Z' },
    ],
    template: {
      sourceKey: 'CBH-ST-17', title: 'ซ้อมแผนฉุกเฉินประจำปี', referenceCode: 'QP-LAB-26 5.2.3', description: 'ทดสอบแผน', frequencyText: 'ทุก 12 เดือน', ownerText: 'คณะทำงานความปลอดภัย', approvalMode: 'required',
      evidenceRequirements: [
        { id: 'req-plan', templateId: 'template-17', label: 'แผนการซ้อม', evidenceKind: 'plan', required: true, minimumFiles: 1, sortOrder: 1 },
        { id: 'req-attendance', templateId: 'template-17', label: 'ผู้เข้าร่วมและการนับคน', evidenceKind: 'attendance', required: true, minimumFiles: 1, sortOrder: 4 },
      ],
    },
  } as never, {
    id: 'link-1', integration_kind: 'evacuation_drill', source_type: 'evacuation_drill_cycle', source_id: 'cycle-1', sync_status: 'pending',
  })

  assert.equal(task.sourceKey, 'CBH-ST-17')
  assert.equal(task.link?.sourceId, 'cycle-1')
  assert.equal(task.requirements.find(item => item.evidenceKind === 'plan')?.attachedCount, 1)
  assert.equal(task.requirements.find(item => item.evidenceKind === 'attendance')?.attachedCount, 0)
  console.log('evacuation server projection tests passed')
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
