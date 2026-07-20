export interface ModuleNavigationItem<T extends string = string> {
  id: T
  href: string
  labelTh: string
  labelEn?: string
  icon?: string
  exact?: boolean
}

export interface ViewNavigationItem<T extends string = string> {
  id: T
  label: string
  icon?: string
  shortLabel?: string
}

export const EQA_NAVIGATION = [
  { id: 'dashboard', href: '/staff/eqa', labelTh: 'ภาพรวม', labelEn: 'Overview', icon: 'dash', exact: true },
  { id: 'programs', href: '/staff/eqa/programs', labelTh: 'โครงการ', labelEn: 'Programs', icon: 'clipboard' },
  { id: 'rounds', href: '/staff/eqa/rounds', labelTh: 'รอบและผล', labelEn: 'Rounds & Results', icon: 'calendar' },
  { id: 'coverage', href: '/staff/eqa/coverage', labelTh: 'Coverage', labelEn: 'Coverage', icon: 'chart' },
  { id: 'capa', href: '/staff/eqa/capa', labelTh: 'CAPA', labelEn: 'CAPA', icon: 'alert' },
  { id: 'settings', href: '/staff/eqa/settings', labelTh: 'ตั้งค่า', labelEn: 'Settings', icon: 'settings' },
] as const satisfies readonly ModuleNavigationItem[]

export const OUTLAB_NAVIGATION = [
  { id: 'dashboard', href: '/staff/outlab', labelTh: 'ภาพรวม', labelEn: 'Overview', icon: 'dash', exact: true },
  { id: 'laboratories', href: '/staff/outlab/laboratories', labelTh: 'ห้องปฏิบัติการ', labelEn: 'Laboratories', icon: 'building' },
  { id: 'certificates', href: '/staff/outlab/certificates', labelTh: 'ใบรับรอง', labelEn: 'Certificates', icon: 'doc' },
  { id: 'services', href: '/staff/outlab/services', labelTh: 'บริการส่งต่อ', labelEn: 'Referral Services', icon: 'clipboard' },
  { id: 'settings', href: '/staff/outlab/settings', labelTh: 'ตั้งค่า', labelEn: 'Settings', icon: 'settings' },
] as const satisfies readonly ModuleNavigationItem[]

export const RISK_NAVIGATION = [
  { id: 'dashboard', href: '/staff/risk', labelTh: 'ภาพรวมความเสี่ยง', labelEn: 'Risk Overview', icon: 'chart', exact: true },
  { id: 'ior', href: '/staff/risk/ior', labelTh: 'รายงานอุบัติการณ์ (IOR)', labelEn: 'Incident Reports', icon: 'shield' },
  { id: 'register', href: '/staff/risk/register', labelTh: 'Risk Register', labelEn: 'Risk Register', icon: 'clipboard' },
  { id: 'smart', href: '/staff/risk/smart-rm', labelTh: 'Smart-RM', labelEn: 'Smart-RM', icon: 'shield' },
] as const satisfies readonly ModuleNavigationItem[]

export const SATISFACTION_NAVIGATION = [
  { id: 'overview', href: '/staff/satisfaction', labelTh: 'ภาพรวม', labelEn: 'Overview', icon: 'dash', exact: true },
  { id: 'surveys', href: '/staff/satisfaction/surveys', labelTh: 'แบบสำรวจ', labelEn: 'Surveys', icon: 'clipboard' },
  { id: 'campaigns', href: '/staff/satisfaction/campaigns', labelTh: 'รอบเก็บข้อมูล', labelEn: 'Campaigns', icon: 'calendar' },
  { id: 'comments', href: '/staff/satisfaction/comments', labelTh: 'ความคิดเห็น', labelEn: 'Comments', icon: 'inbox' },
] as const satisfies readonly ModuleNavigationItem[]

export const ROUTE_LABELS: Record<string, { th: string; en: string }> = {
  staff: { th: 'ระบบบุคลากร', en: 'Staff Portal' },
  eqa: { th: 'การควบคุมคุณภาพภายนอก', en: 'EQA / PT' },
  outlab: { th: 'ห้องปฏิบัติการภายนอก', en: 'OUTLAB' },
  risk: { th: 'ทะเบียนความเสี่ยง', en: 'Risk Register' },
  satisfaction: { th: 'แบบสำรวจความพึงพอใจ', en: 'Satisfaction' },
  personnel: { th: 'บุคลากร', en: 'Personnel' },
  documents: { th: 'เอกสารคุณภาพ', en: 'Documents' },
  settings: { th: 'ตั้งค่า', en: 'Settings' },
  programs: { th: 'โครงการ', en: 'Programs' },
  rounds: { th: 'รอบและผล', en: 'Rounds & Results' },
  coverage: { th: 'Coverage', en: 'Coverage' },
  capa: { th: 'CAPA', en: 'CAPA' },
  laboratories: { th: 'ห้องปฏิบัติการ', en: 'Laboratories' },
  services: { th: 'บริการส่งต่อ', en: 'Services' },
  certificates: { th: 'ใบรับรอง', en: 'Certificates' },
  ior: { th: 'รายงานอุบัติการณ์', en: 'Incident Reports' },
  register: { th: 'Risk Register', en: 'Risk Register' },
  'smart-rm': { th: 'Smart-RM', en: 'Smart-RM' },
  surveys: { th: 'แบบสำรวจ', en: 'Surveys' },
  campaigns: { th: 'รอบเก็บข้อมูล', en: 'Campaigns' },
  comments: { th: 'ความคิดเห็น', en: 'Comments' },
}

export function isPathActive(pathname: string, item: Pick<ModuleNavigationItem, 'href' | 'exact'>) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export function normalizeNavigationValue<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value && allowed.includes(value as T) ? value as T : fallback
}

export function resolvePageTitle<T>(pathname: string, titles: Record<string, T>, fallback: T): T {
  const match = Object.keys(titles)
    .filter((route) => pathname === route || pathname.startsWith(`${route}/`))
    .sort((a, b) => b.length - a.length)[0]
  return match ? titles[match] : fallback
}
