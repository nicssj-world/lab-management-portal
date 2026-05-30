// Single source of truth for permission resources and roles.
// Import from here in both server and client code.
// When adding a new module: add its resource name here → it auto-appears in PermissionsMatrix.

export const RESOURCES = [
  'รายการตรวจ',
  'เอกสารคุณภาพ',
  'Master List',
  'ข่าวสาร',
  'ความเสี่ยง / Rejection',
  'สัญญา',
  'ทะเบียนเครื่องมือ',
  'บันทึกการแก้ไข',
  'Workload',
  'KPI',
  'TAT',
  'User Management',
] as const

export type ResourceKey = typeof RESOURCES[number]

export const PERMISSION_ROLES = [
  'Admin',
  'Manager',
  'Medical Technologist',
  'Medical Science Technician',
  'Assistant',
] as const

export type PermissionRole = typeof PERMISSION_ROLES[number]
