import { AuthorizationBatchSchema, type AuthorizationBatchInput as AuthorizationBatchPayload } from '@/lib/validations/personnel'

export { AuthorizationBatchSchema }
export type AuthorizationRole = AuthorizationBatchPayload['roles'][number]

export type AuthorizationInsertRow = {
  profile_id: string
  test_id: number | null
  category: string | null
  role_type: AuthorizationRole
  competency_id?: string | null
  authorized_date?: string | null
  status?: 'active'
  notes?: string | null
  created_by?: string
}

export type AuthorizationBatchInput = {
  profileIds: string[]
  testId: number | null
  categories: string[]
  roles: AuthorizationRole[]
  common: Omit<AuthorizationInsertRow, 'profile_id' | 'test_id' | 'category' | 'role_type'>
}

export function authorizationRowKey(row: Pick<AuthorizationInsertRow, 'profile_id' | 'test_id' | 'category' | 'role_type'>) {
  return `${row.profile_id}|${row.test_id ?? ''}|${row.category ?? ''}|${row.role_type}`
}

export function expandAuthorizationRows(input: AuthorizationBatchInput): AuthorizationInsertRow[] {
  const profileIds = [...new Set(input.profileIds)]
  const roles = [...new Set(input.roles)]
  const scopes = input.testId != null
    ? [{ test_id: input.testId, category: null }]
    : [...new Set(input.categories)].map((category) => ({ test_id: null, category }))

  return profileIds.flatMap((profile_id) => (
    scopes.flatMap((scope) => roles.map((role_type) => ({ profile_id, ...scope, role_type, ...input.common })))
  ))
}
