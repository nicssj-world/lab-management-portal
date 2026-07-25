import assert from 'node:assert/strict'

async function main() {
  const mod = await import('./annual-agreements').catch(() => null)
  assert.ok(mod, 'annual agreements module should exist')

  assert.equal(mod.fiscalYearBE(new Date('2026-09-30T12:00:00+07:00')), 2569)
  assert.equal(mod.fiscalYearBE(new Date('2026-10-01T12:00:00+07:00')), 2570)

  assert.equal(mod.validateDisclosure({ hasActivity: false }).ok, true)
  assert.equal(
    mod.validateDisclosure({ hasActivity: true, activityName: '', activityDate: '', place: '', impacts: [] }).ok,
    false,
  )
  assert.equal(
    mod.validateDisclosure({
      hasActivity: true,
      activityName: 'บรรยายให้บริษัทคู่ค้า',
      activityDate: '2026-11-15',
      place: 'กรุงเทพฯ',
      impacts: ['fairness'],
    }).ok,
    true,
  )

  assert.equal(mod.recipientStatus({ confidentialityAcceptedAt: null, impartialityAcceptedAt: null, disclosureAttestedAt: null }), 'pending')
  assert.equal(mod.recipientStatus({ confidentialityAcceptedAt: '2026-10-01T00:00:00Z', impartialityAcceptedAt: '2026-10-01T00:00:00Z', disclosureAttestedAt: '2026-10-01T00:00:00Z' }), 'completed')
  assert.equal(mod.canApproveCampaign([{ status: 'completed' }, { status: 'exempt' }]), true)
  assert.equal(mod.canApproveCampaign([{ status: 'completed' }, { status: 'pending' }]), true)
  assert.equal(mod.canApproveCampaign([{ status: 'pending' }]), false)
  assert.equal(mod.canApproveCampaign([]), false)
  assert.equal(typeof (mod as any).canLockCampaign, 'function')
  assert.equal((mod as any).canLockCampaign([{ status: 'completed' }, { status: 'pending' }]), false)
  assert.equal((mod as any).canLockCampaign([{ status: 'certified' }, { status: 'exempt' }]), true)
  assert.equal(typeof (mod as any).recipientsAwaitingCertification, 'function')
  assert.deepEqual(
    (mod as any).recipientsAwaitingCertification([
      { status: 'certified', certificationBatchId: 'first-batch' },
      { status: 'completed', certificationBatchId: null },
      { status: 'pending', certificationBatchId: null },
    ]),
    [{ status: 'completed', certificationBatchId: null }],
  )
  assert.equal(mod.isAgreementCampaignOpen({ status: 'open', opensOn: '2026-10-01', dueOn: '2026-11-30' }, new Date('2026-10-15T12:00:00+07:00')), true)
  assert.equal(mod.isAgreementCampaignOpen({ status: 'open', opensOn: '2026-10-01', dueOn: '2026-11-30' }, new Date('2026-12-01T12:00:00+07:00')), false)
}

void main()
