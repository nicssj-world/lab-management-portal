import assert from 'node:assert/strict'
import { filterPersonnelRows, type PersonnelSummaryFilter } from './filters'
import type { ExpiryStatus } from './expiry'

type TestRow = {
  name: string
  ephis_id: string | null
  role: string
  dept: string | null
  unit: string | null
  position_title: string | null
  mt_license_no: string | null
  mt_license_expiry: string | null
  licenseStatus: ExpiryStatus
  certExpiring: number
  certExpired: number
  compOverdue: number
  compDueSoon: number
}

function row(name: string, overrides: Partial<TestRow> = {}): TestRow {
  return {
    name,
    ephis_id: null,
    role: 'Medical Technologist',
    dept: null,
    unit: null,
    position_title: null,
    mt_license_no: '99999',
    mt_license_expiry: '2027-12-31',
    licenseStatus: 'valid',
    certExpiring: 0,
    certExpired: 0,
    compOverdue: 0,
    compDueSoon: 0,
    ...overrides,
  }
}

const rows = [
  row('ใบใกล้หมด', { licenseStatus: 'expiring' }),
  row('ใบหมดแล้ว', { licenseStatus: 'expired' }),
  row('ไม่มีเลขใบ ทนพ.', { mt_license_no: null }),
  row('ไม่มีวันหมดอายุใบ ทนพ.', { mt_license_no: '12345', mt_license_expiry: null }),
  row('ผู้จัดการไม่มีใบไม่ต้องนับ', { role: 'Manager', mt_license_no: null, mt_license_expiry: null }),
  row('ผู้ช่วยไม่มีใบไม่ต้องนับ', { role: 'Assistant', mt_license_no: null, mt_license_expiry: null }),
  row('ค้างประเมิน', { compOverdue: 1 }),
  row('ไม่มีแจ้งเตือน', { role: 'Assistant' }),
]

function names(summaryFilter: PersonnelSummaryFilter) {
  return filterPersonnelRows(rows, {
    search: '',
    roleFilter: 'All',
    deptFilter: 'All',
    summaryFilter,
  }).map((r) => r.name)
}

assert.deepEqual(names('all'), rows.map((r) => r.name))
assert.deepEqual(names('license-expiring'), ['ใบใกล้หมด'])
assert.deepEqual(names('license-expired'), ['ใบหมดแล้ว'])
assert.deepEqual(names('license-missing'), ['ไม่มีเลขใบ ทนพ.', 'ไม่มีวันหมดอายุใบ ทนพ.'])
assert.deepEqual(names('comp-overdue'), ['ค้างประเมิน'])

const scoped = filterPersonnelRows(rows, {
  search: 'ใบ',
  roleFilter: 'Medical Technologist',
  deptFilter: 'All',
  summaryFilter: 'license-expiring',
})
assert.deepEqual(scoped.map((r) => r.name), ['ใบใกล้หมด'])
