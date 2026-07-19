export type OutlabCertificateLifecycle = 'current' | 'superseded' | 'revoked'
export type CertificateUrgency = 'valid' | 'watch' | 'urgent' | 'critical' | 'expired' | 'inactive'
export type OutlabSector = 'gov' | 'priv' | 'other'

export const OUTLAB_SECTOR_LABEL: Record<OutlabSector, string> = {
  gov: 'ภาครัฐ',
  priv: 'เอกชน',
  other: 'อื่นๆ',
}

export const OUTLAB_CATALOG_DEPARTMENT = 'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ'
export const OUTLAB_CATALOG_CATEGORY_ID = 'outl'
const OUTLAB_CATALOG_DEPARTMENT_ALIASES = new Set([
  OUTLAB_CATALOG_DEPARTMENT,
  'งานตรวจพิเศษและปฏิบัติการตรวจต่อ',
])

type OutlabCatalogServiceSource = {
  category_id?: string | null
  department?: string | null
  method: string | null
  transport_condition: string | null
  tat: string | null
  tat_hours: number | null
  tat_minutes: string | null
  price: number | null
}

export function isOutlabCatalogTest(test: Pick<OutlabCatalogServiceSource, 'category_id' | 'department'>) {
  return test.category_id === OUTLAB_CATALOG_CATEGORY_ID || OUTLAB_CATALOG_DEPARTMENT_ALIASES.has(test.department?.trim() ?? '')
}

export function findOutlabCatalogTestByEphisCode<T extends { code: string }>(tests: readonly T[], ephisCode: string) {
  const normalized = ephisCode.trim().toLocaleLowerCase()
  return tests.find(test => test.code.trim().toLocaleLowerCase() === normalized)
}

export function catalogServiceDefaults(test: OutlabCatalogServiceSource) {
  return {
    method: test.method ?? '',
    transportCondition: test.transport_condition ?? '',
    tatText: test.tat_minutes ?? test.tat ?? (test.tat_hours == null ? '' : `${test.tat_hours} ชั่วโมง`),
    price: test.price,
  }
}

const DAY_MS = 86_400_000

function parseDate(value: string) {
  return new Date(`${value}T00:00:00Z`)
}

export function certificateUrgency(
  expiresOn: string | null | undefined,
  lifecycle: OutlabCertificateLifecycle,
  today: string,
): CertificateUrgency {
  if (lifecycle !== 'current') return 'inactive'
  if (!expiresOn) return 'critical'
  const remaining = Math.round((parseDate(expiresOn).getTime() - parseDate(today).getTime()) / DAY_MS)
  if (remaining < 0) return 'expired'
  if (remaining <= 30) return 'critical'
  if (remaining <= 60) return 'urgent'
  if (remaining <= 90) return 'watch'
  return 'valid'
}

export const CERTIFICATE_URGENCY_LABEL: Record<CertificateUrgency, string> = {
  valid: 'ปกติ',
  watch: 'เฝ้าระวัง',
  urgent: 'เร่งด่วน',
  critical: 'วิกฤต',
  expired: 'หมดอายุ',
  inactive: 'ไม่ติดตาม',
}
