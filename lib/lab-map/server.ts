import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildStaffLabMapDTO, type StaffMapRepository } from './server-builder'

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
}

export async function getStaffLabMapDTO() {
  return buildStaffLabMapDTO(repository)
}
