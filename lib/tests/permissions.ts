export type TestActor = {
  role: string
  doc_role?: string | null
}

export type TestPermissionLevel = 'none' | 'view' | 'edit'

export function canEditTests(
  actor: TestActor | null | undefined,
  permissionLevel: TestPermissionLevel = 'none',
) {
  if (actor?.role === 'Admin') return true
  if (actor?.doc_role === 'Reviewer') return true
  return permissionLevel === 'edit'
}

export function canDeleteTests(
  actor: TestActor | null | undefined,
  permissionLevel: TestPermissionLevel = 'none',
) {
  if (actor?.role === 'Admin') return true
  if (actor?.doc_role === 'Reviewer') return false
  return permissionLevel === 'edit'
}
