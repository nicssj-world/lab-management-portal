import { redirect } from 'next/navigation'
import { StaffLabMap } from '@/components/lab-map/StaffLabMap'
import {
  LAB_ACCESS_POINTS,
  LAB_MAP_VERSION,
  LAB_MAP_VIEW_BOX,
  LAB_ROUTE_PRESETS,
  LAB_SPACES,
  LAB_ZONES,
} from '@/lib/lab-map/manifest'
import { createClient } from '@/lib/supabase/server'
import type { LabMapDTO } from '@/lib/lab-map/types'

export default async function StaffLabMapPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  const map: LabMapDTO = {
    version: LAB_MAP_VERSION,
    viewBox: LAB_MAP_VIEW_BOX,
    stationCode: 'office',
    spaces: LAB_SPACES,
    zones: LAB_ZONES,
    accessPoints: LAB_ACCESS_POINTS,
    routes: LAB_ROUTE_PRESETS,
  }

  return <StaffLabMap map={map} />
}
