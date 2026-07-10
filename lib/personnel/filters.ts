import { mainPersonnelRole } from './roles'
import type { ExpiryStatus } from './expiry'

export type PersonnelSummaryFilter = 'all' | 'license-expiring' | 'license-expired' | 'license-missing' | 'comp-overdue'

export type PersonnelFilterRow = {
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
}

export type PersonnelFilterOptions = {
  search: string
  roleFilter: string
  deptFilter: string
  summaryFilter: PersonnelSummaryFilter
}

function isMedicalTechnologist(row: PersonnelFilterRow): boolean {
  return row.role === 'Medical Technologist'
}

function isMissingMedicalTechnologistLicense(row: PersonnelFilterRow): boolean {
  return isMedicalTechnologist(row) && (!row.mt_license_no || !row.mt_license_expiry)
}

export function matchesPersonnelSummaryFilter(row: PersonnelFilterRow, summaryFilter: PersonnelSummaryFilter): boolean {
  if (summaryFilter === 'license-expiring') return isMedicalTechnologist(row) && row.licenseStatus === 'expiring'
  if (summaryFilter === 'license-expired') return isMedicalTechnologist(row) && row.licenseStatus === 'expired'
  if (summaryFilter === 'license-missing') return isMissingMedicalTechnologistLicense(row)
  if (summaryFilter === 'comp-overdue') return row.compOverdue > 0
  return true
}

export function filterPersonnelRows<T extends PersonnelFilterRow>(rows: T[], options: PersonnelFilterOptions): T[] {
  const q = options.search.trim().toLowerCase()
  return rows.filter((row) => {
    const mainRole = mainPersonnelRole(row.role)
    if (options.roleFilter !== 'All' && mainRole !== options.roleFilter) return false
    if (options.deptFilter !== 'All' && (row.dept ?? '') !== options.deptFilter) return false
    if (!matchesPersonnelSummaryFilter(row, options.summaryFilter)) return false
    if (!q) return true
    return [row.name, row.ephis_id, row.role, mainRole, row.position_title, row.unit, row.dept, row.mt_license_no]
      .some((value) => (value ?? '').toLowerCase().includes(q))
  })
}
