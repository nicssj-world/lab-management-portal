import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserProfile, UserFilters, UserListResponse } from '@/types/users'
import type { CreateUserInput, UpdateUserInput } from '@/lib/validations/user-schema'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/queries/admin'

// Columns only present after user-management-migration.sql has been run
const NEW_SCHEMA_COLS = new Set(['deleted_at', 'ephis_id', 'dept', 'status', 'updated_at'])

function isMissingColumn(msg: string) {
  return [...NEW_SCHEMA_COLS].some((c) => msg.includes(c)) && msg.includes('does not exist')
}

function buildListQuery(
  supabase: SupabaseClient,
  filters: Partial<UserFilters>,
  page: number,
  pageSize: number,
  sortDir: 'asc' | 'desc',
  sortField: string,
  newSchema: boolean,
) {
  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })

  if (newSchema) query = query.is('deleted_at', null)

  query = query.order(sortField, { ascending: sortDir === 'asc' })

  if (filters.search) {
    const f = newSchema
      ? `name.ilike.%${filters.search}%,ephis_id.ilike.%${filters.search}%`
      : `name.ilike.%${filters.search}%`
    query = query.or(f)
  }
  if (filters.role)              query = query.eq('role', filters.role)
  if (filters.dept && newSchema) query = query.eq('dept', filters.dept)
  if (filters.status && newSchema) query = query.eq('status', filters.status)

  const from = (page - 1) * pageSize
  return query.range(from, from + pageSize - 1)
}

export async function listUsers(
  supabase: SupabaseClient,
  filters: Partial<UserFilters>,
  page = 1,
  pageSize = 10,
  sortField = 'created_at',
  sortDir: 'asc' | 'desc' = 'desc',
): Promise<UserListResponse> {
  const safeSortField = NEW_SCHEMA_COLS.has(sortField) ? 'created_at' : sortField

  let { data, error, count } = await buildListQuery(
    supabase, filters, page, pageSize, sortDir, safeSortField, true,
  )

  // Retry with old-schema compatibility if migrations haven't been run
  if (error && isMissingColumn(error.message)) {
    ;({ data, error, count } = await buildListQuery(
      supabase, filters, page, pageSize, sortDir, 'created_at', false,
    ))
  }

  if (error) throw error

  const total = count ?? 0
  return {
    users: (data ?? []) as UserProfile[],
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  }
}

export async function createUser(
  input: CreateUserInput,
  actorId: string,
): Promise<UserProfile> {
  const email = `${input.ephis_id}@cbh.go.th`
  let authUserId: string
  let freshAuthUser = false

  const initialPassword = input.password?.trim() || process.env.DEFAULT_USER_PASSWORD
  if (!initialPassword) {
    throw new Error('กรุณากรอกรหัสผ่านเริ่มต้น หรือกำหนด DEFAULT_USER_PASSWORD ใน environment')
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: initialPassword,
    email_confirm: true,
    user_metadata: { name: input.name },
  })

  if (authError) {
    const msg = authError.message.toLowerCase()
    if (!msg.includes('already') && !msg.includes('registered') && !msg.includes('exists')) {
      throw new Error(authError.message)
    }

    // Auth user exists — may be orphaned (profile creation failed on a previous attempt).
    // Find them by email and attempt recovery.
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const existingAuth = listData?.users.find((u) => u.email === email)
    if (!existingAuth) throw new Error(authError.message)

    // If a complete, non-deleted profile already exists this is a genuine duplicate.
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, name, deleted_at')
      .eq('id', existingAuth.id)
      .single()
    if (existingProfile?.name && !existingProfile.deleted_at) throw new Error('ผู้ใช้งาน E-Phis นี้มีอยู่ในระบบแล้ว')

    authUserId = existingAuth.id
    await supabaseAdmin.auth.admin.updateUserById(existingAuth.id, {
      password: initialPassword,
      user_metadata: { name: input.name },
    })
  } else {
    authUserId = authData.user.id
    freshAuthUser = true
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        id:         authUserId,
        ephis_id:   input.ephis_id,
        name:       input.name,
        role:       input.role,
        dept:       input.dept,
        status:     'active',
        deleted_at: null,
      },
      { onConflict: 'id' },
    )
    .select()
    .single()

  if (profileError) {
    if (freshAuthUser) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => {})
    }
    if (profileError.message.includes('violates check constraint')) {
      throw new Error(`ข้อมูลไม่ถูกต้อง (constraint): ${profileError.message}`)
    }
    if (profileError.message.includes('column') && profileError.message.includes('ephis_id')) {
      throw new Error(
        'ฐานข้อมูลยังไม่ได้ migration — กรุณารัน scripts/user-management-migration.sql ใน Supabase SQL Editor ก่อน',
      )
    }
    throw new Error(profileError.message)
  }

  await writeAuditLog(supabaseAdmin, {
    action: 'user.create',
    user_id: actorId,
    target: authUserId,
    detail: `Created user ${input.name} (E-Phis: ${input.ephis_id})`,
  }).catch(() => {})

  return profile as UserProfile
}

export async function updateUser(
  supabase: SupabaseClient,
  id: string,
  input: UpdateUserInput,
  actorId: string,
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(input)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single()

  if (error) throw error

  await writeAuditLog(supabase, {
    action: 'user.update',
    user_id: actorId,
    target: id,
    detail: `Updated fields: ${Object.keys(input).join(', ')}`,
  })

  return data as UserProfile
}

export async function setUserStatus(
  supabase: SupabaseClient,
  id: string,
  status: 'active' | 'inactive',
  actorId: string,
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  await writeAuditLog(supabase, {
    action: status === 'active' ? 'user.activate' : 'user.deactivate',
    user_id: actorId,
    target: id,
    detail: `Status set to ${status}`,
  })

  return data as UserProfile
}

export async function softDeleteUser(
  supabase: SupabaseClient,
  id: string,
  actorId: string,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ deleted_at: new Date().toISOString(), status: 'inactive', ephis_id: null })
    .eq('id', id)

  if (error) throw error

  await writeAuditLog(supabase, {
    action: 'user.delete',
    user_id: actorId,
    target: id,
    detail: 'Soft deleted',
  })
}
