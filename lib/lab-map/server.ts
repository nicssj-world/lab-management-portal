import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Permissions } from '@/lib/permissions'
import { buildStaffLabMapDTO, type StaffMapRepository } from './server-builder'
import type { StaffMapPersonDTO } from './types'

const repository: StaffMapRepository = {
  async activeSpaceCodes() {
    const { data, error } = await supabaseAdmin.from('lab_map_spaces').select('code').eq('is_active', true)
    if (error) throw new Error(`lab map spaces: ${error.message}`)
    return (data ?? []).map((row) => row.code as string)
  },
  async activeZoneCodes() {
    const { data, error } = await supabaseAdmin.from('lab_map_zones').select('code').eq('is_active', true)
    if (error) throw new Error(`lab map zones: ${error.message}`)
    return (data ?? []).map((row) => row.code as string)
  },
  async assignments() {
    const { data, error } = await supabaseAdmin.from('lab_map_person_assignments').select(
      'id, profile_id, assignment_type, profile:profiles!lab_map_person_assignments_profile_id_fkey(id,name,dept), space:lab_map_spaces(code), zone:lab_map_zones(code)',
    )
    if (error) throw new Error(`lab map assignments: ${error.message}`)
    return (data ?? []).map((row) => {
      const profile = row.profile as unknown as { id: string; name: string; dept: string | null }
      const space = row.space as unknown as { code: string } | null
      const zone = row.zone as unknown as { code: string } | null
      return {
        assignmentId: row.id as string,
        profileId: profile.id,
        name: profile.name,
        department: profile.dept,
        assignmentType: row.assignment_type,
        spaceCode: space?.code ?? null,
        zoneCode: zone?.code ?? null,
      } as StaffMapPersonDTO
    })
  },
  async activeProfiles() {
    const { data, error } = await supabaseAdmin.from('profiles')
      .select('id,name,dept').is('deleted_at', null).order('name')
    if (error) throw new Error(`lab map profiles: ${error.message}`)
    return (data ?? []).map((row) => ({
      profileId: row.id as string,
      name: row.name as string,
      department: row.dept as string | null,
    }))
  },
}

export async function getStaffLabMapDTO({ permissions }: { permissions: Permissions }) {
  return buildStaffLabMapDTO(permissions, repository)
}

export { canViewMapPersonnel } from './server-builder'
