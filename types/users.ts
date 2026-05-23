export type UserRole = 'Admin' | 'Manager' | 'Medical Technologist' | 'Assistant' | 'Document Controller' | 'Medical Science Technician'
export type UserStatus = 'active' | 'inactive' | 'pending'
export type SortField = 'name' | 'role' | 'dept' | 'status' | 'created_at'
export type SortDir = 'asc' | 'desc'

export interface UserProfile {
  id: string
  ephis_id: string | null
  name: string
  role: UserRole
  dept: string | null
  status: UserStatus
  doc_role: string | null
  created_at: string
  updated_at: string | null
  deleted_at: string | null
}

export interface UserFilters {
  search: string
  role: UserRole | ''
  dept: string
  status: UserStatus | ''
}

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface UserListResponse {
  users: UserProfile[]
  pagination: PaginationMeta
}

export interface CreateUserPayload {
  ephis_id: string
  name: string
  password: string
  role: UserRole
  dept: string
}

export interface UpdateUserPayload {
  ephis_id?: string
  name?: string
  role?: UserRole
  dept?: string
  status?: UserStatus
}
