const LEGACY_ROLES: Record<string, string> = {
  admin: 'Admin',
  staff: 'Manager',
  editor: 'Medical Technologist',
  viewer: 'Assistant',
}

export function normalizeRole(role: string | null | undefined): string {
  const raw = (role ?? '').trim()
  return LEGACY_ROLES[raw.toLowerCase()] ?? raw
}

export function isAdminRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'Admin'
}
