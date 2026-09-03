import type { ItDepartmentCode } from './domain'

export type LegacyResponsible = {
  departmentCode: ItDepartmentCode
  departmentLabel: string
  displayName: string
  position: string
}

export type LegacyAssigneeProfile = {
  id: string
  name: string
  dept: string | null
  role: string
  status?: string | null
  deletedAt?: string | null
}

export type LegacyAssigneeMatch = {
  departmentCode: ItDepartmentCode
  sourceName: string
  profileId: string
  profileName: string
  profileDepartment: string | null
}

export type LegacyAssigneeResolution = {
  matches: LegacyAssigneeMatch[]
  warnings: string[]
  issues: string[]
}

export type LegacyResponsibleSheetResult = {
  responsibles: LegacyResponsible[]
  warnings: string[]
  issues: string[]
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).replace(/\s+/g, ' ').trim()
}

function compact(value: unknown): string {
  return text(value).replace(/\s/g, '').normalize('NFC')
}

function departmentCodeFromLabel(value: string): ItDepartmentCode | null {
  const label = compact(value).replace('จุุล', 'จุล')
  if (label.includes('เคมี')) return 'CHE'
  if (label.includes('ภูมิคุ้มกัน')) return 'IMM'
  if (label.includes('โลหิต')) return 'HEM'
  if (label.includes('จุลทรรศน์')) return 'MIS'
  if (label.includes('จุลชีว')) return 'MIC'
  if (label.includes('อณู')) return 'MOL'
  if (label.includes('คลังเลือด')) return 'BLB'
  return null
}

export function parseLegacyResponsibleRows(rows: ReadonlyArray<ReadonlyArray<unknown>>): LegacyResponsibleSheetResult {
  const warnings: string[] = []
  const issues: string[] = []
  const responsibles: LegacyResponsible[] = []
  const seenDepartments = new Set<ItDepartmentCode>()
  const headerIndex = rows.findIndex((row) => compact(row[0]) === 'งาน' && compact(row[1]).includes('ชื่อ'))
  const startIndex = headerIndex >= 0 ? headerIndex + 1 : 0

  for (const row of rows.slice(startIndex)) {
    const departmentLabel = text(row[0])
    const displayName = text(row[1])
    const position = text(row[2])
    // The official sheet ends with a form-code footer in the position column;
    // it is not an assignee row.
    if (!departmentLabel && !displayName) continue
    const departmentCode = departmentCodeFromLabel(departmentLabel)
    if (!departmentCode) {
      if (displayName || position) issues.push(`ไม่รู้จักหน่วยงานในชีทผู้รับผิดชอบ: ${departmentLabel || '(ว่าง)'}`)
      continue
    }
    if (!displayName) {
      issues.push(`${departmentCode}: ไม่พบชื่อผู้รับผิดชอบในชีท`)
      continue
    }
    if (seenDepartments.has(departmentCode)) {
      issues.push(`${departmentCode}: พบผู้รับผิดชอบซ้ำในชีท`)
      continue
    }
    seenDepartments.add(departmentCode)
    responsibles.push({ departmentCode, departmentLabel, displayName, position })
  }

  if (headerIndex < 0 && responsibles.length > 0) warnings.push('ไม่พบแถว header ในชีทผู้รับผิดชอบ; ใช้ตำแหน่งคอลัมน์ตามแบบฟอร์ม')
  return { responsibles, warnings, issues }
}

function namesMatch(sourceName: string, profileName: string): boolean {
  const source = text(sourceName).normalize('NFC')
  const profile = text(profileName).normalize('NFC')
  return profile === source || profile.startsWith(`${source} `)
}

export function resolveLegacyAssignees(
  responsibles: ReadonlyArray<LegacyResponsible>,
  profiles: ReadonlyArray<LegacyAssigneeProfile>,
): LegacyAssigneeResolution {
  const warnings: string[] = []
  const issues: string[] = []
  const matches: LegacyAssigneeMatch[] = []

  for (const responsible of responsibles) {
    const candidates = profiles.filter((profile) => {
      if (profile.status && profile.status !== 'active') return false
      if (profile.deletedAt) return false
      return namesMatch(responsible.displayName, profile.name)
    })
    if (candidates.length === 0) {
      issues.push(`${responsible.departmentCode}: ไม่พบ profile สำหรับผู้รับผิดชอบ "${responsible.displayName}"`)
      continue
    }
    if (candidates.length > 1) {
      issues.push(`${responsible.departmentCode}: พบ profile มากกว่า 1 รายการสำหรับ "${responsible.displayName}"`)
      continue
    }
    const profile = candidates[0]
    matches.push({
      departmentCode: responsible.departmentCode,
      sourceName: responsible.displayName,
      profileId: profile.id,
      profileName: profile.name,
      profileDepartment: profile.dept,
    })
  }

  return { matches, warnings, issues }
}
