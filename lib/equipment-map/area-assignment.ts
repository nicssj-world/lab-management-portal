import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'

export interface EquipmentAreaAssignment {
  area_code: string | null
  map_x: null
  map_y: null
  position_set_by: string | null
  position_set_at: string | null
}

export async function resolveEquipmentAreaAssignment(
  value: unknown,
  actorId: string,
): Promise<{ assignment: EquipmentAreaAssignment | null; error: string | null }> {
  const areaCode = typeof value === 'string' ? value.trim() : ''
  if (!areaCode) {
    return {
      assignment: {
        area_code: null,
        map_x: null,
        map_y: null,
        position_set_by: null,
        position_set_at: null,
      },
      error: null,
    }
  }

  const { data, error } = await supabaseAdmin
    .from('equipment_areas')
    .select('code, is_active')
    .eq('code', areaCode)
    .maybeSingle()

  if (error) return { assignment: null, error: error.message }
  if (!data?.is_active) return { assignment: null, error: 'ไม่พบพื้นที่นี้ในระบบ หรือพื้นที่ถูกปิดใช้งาน' }

  return {
    assignment: {
      area_code: data.code as string,
      map_x: null,
      map_y: null,
      position_set_by: actorId,
      position_set_at: new Date().toISOString(),
    },
    error: null,
  }
}
