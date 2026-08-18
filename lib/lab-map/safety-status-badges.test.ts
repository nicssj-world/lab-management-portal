import assert from 'node:assert/strict'
import { getSafetyAssetStatusBadges } from './safety-status-badges'

const inspection = (result: 'passed' | 'needs_attention' | 'failed' | 'not_found') => ({ result })

assert.deepEqual(
  getSafetyAssetStatusBadges({
    latestInspection: inspection('passed'),
    operationalStatus: 'due_soon',
    positionStatus: 'verified',
  }),
  [
    { key: 'result', label: 'ผ่าน', color: 'green' },
    { key: 'schedule', label: 'ใกล้ครบกำหนด', color: 'amber' },
  ],
  'a passed inspection must remain visible when its next date is due soon',
)

assert.deepEqual(
  getSafetyAssetStatusBadges({
    latestInspection: inspection('passed'),
    operationalStatus: 'overdue',
    positionStatus: 'verified',
  }),
  [
    { key: 'result', label: 'ผ่าน', color: 'green' },
    { key: 'schedule', label: 'เกินกำหนดตรวจ', color: 'red' },
  ],
)

assert.deepEqual(
  getSafetyAssetStatusBadges({
    latestInspection: inspection('passed'),
    operationalStatus: 'unverified',
    positionStatus: 'unverified',
  }),
  [
    { key: 'result', label: 'ผ่าน', color: 'green' },
    { key: 'position', label: 'รอยืนยันตำแหน่ง', color: 'amber' },
  ],
)

assert.deepEqual(
  getSafetyAssetStatusBadges({
    latestInspection: inspection('failed'),
    operationalStatus: 'failed',
    positionStatus: 'verified',
  }),
  [{ key: 'result', label: 'ไม่พร้อมใช้', color: 'red' }],
  'the operational status must not duplicate the inspection result',
)

assert.deepEqual(
  getSafetyAssetStatusBadges({
    latestInspection: null,
    operationalStatus: 'unverified',
    positionStatus: 'unverified',
  }),
  [{ key: 'position', label: 'รอยืนยันตำแหน่ง', color: 'amber' }],
)

console.log('safety status badges contract passed')
